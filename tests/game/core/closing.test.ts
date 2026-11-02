/**
 * Tests of the closing wind-down: in a centre that keeps operating hours the doors close to new
 * guests at 19:20, a stall takes only orders it can hand over by the closing call, last orders at
 * 20:00 sends guests who have not reached a counter home without a rating, the closing call at
 * 20:12 has diners finish up, and the step that ends the day clears
 * whoever is left, so each day opens with an empty hall. A fixed arrival interval ignores the
 * clock and keeps its guests across the day change.
 *
 * The scenarios use the synthetic test catalog with a slow counter, patient guests and hour-long
 * meals, so guests are still queueing at last orders and eating at the closing call.
 */
import { describe, expect, it } from "vitest";

import {
  assertSimulationInvariants,
  stepSimulation,
  type GameState,
  type VisitRating,
} from "@/src/game/core";
import { OPERATING_DAY_MS } from "@/src/game/core/progression";
import { CLOSING_CALL_MINUTE, DOORS_CLOSE_MINUTE, LAST_ORDERS_MINUTE } from "@/src/game/core/rush";
import { build_catalog_with_stall_config, makeGame, TEST_CATALOG } from "./fixtures";

/** Simulated milliseconds per in-game minute. */
const MS_PER_MINUTE = 1_000;
/** In-game minute at which the operating day opens (10:30). */
const OPENING_MINUTE = 10 * 60 + 30;
/** In-game minute at which the scenarios start: the dinner crowd, forty minutes before the doors close. */
const START_MINUTE = 18 * 60 + 40;
/** A meal long enough that every diner is still eating at the closing call. */
const HOUR_LONG_MEAL_MS = 60 * MS_PER_MINUTE;
/** Patience long enough that nobody gives up queueing before last orders. */
const PATIENT_GUEST_MS = 600 * MS_PER_MINUTE;

/**
 * @param minute - An in-game minute of the day.
 * @param day - The operating day, from 1.
 * @returns The simulated time at that minute.
 */
function elapsed_at(minute: number, day = 1): number {
  return (day - 1) * OPERATING_DAY_MS + (minute - OPENING_MINUTE) * MS_PER_MINUTE;
}

/**
 * @param state - A game state.
 * @returns The in-game minute of the day the state's clock shows.
 */
function minute_of(state: GameState): number {
  return OPENING_MINUTE + Math.floor((state.elapsedMs % OPERATING_DAY_MS) / MS_PER_MINUTE);
}

/**
 * Builds a game at 18:40 on day 1 with a slow counter, patient guests and hour-long meals.
 *
 * @param is_adaptive - Whether arrivals follow the adaptive model, which keeps operating hours;
 * otherwise they come at a fixed interval that ignores the clock.
 * @param preparation_ms - A cooking time for every dish, with room for three orders at once;
 * omitted, the test catalog's short times and single order apply.
 * @returns The starting state, with an arrival due on the first step.
 */
function make_closing_game(is_adaptive = true, preparation_ms?: number): GameState {
  const slow_counter = build_catalog_with_stall_config({
    orderMs: 12_000,
    queueCapacity: 6,
    ...(preparation_ms === undefined ? {} : { preparationCapacity: 3 }),
  });
  const catalog = {
    ...slow_counter,
    dishes: Object.fromEntries(
      Object.entries(TEST_CATALOG.dishes).map(([id, dish]) => [
        id,
        {
          ...dish,
          eatingMs: HOUR_LONG_MEAL_MS,
          ...(preparation_ms === undefined ? {} : { preparationMs: preparation_ms }),
        },
      ]),
    ),
    archetypes: Object.fromEntries(
      Object.entries(TEST_CATALOG.archetypes).map(([id, archetype]) => [
        id,
        { ...archetype, patienceMs: PATIENT_GUEST_MS },
      ]),
    ),
  };
  const start = makeGame({
    catalog,
    config: {
      fixedStepMs: 100,
      spawnIntervalMs: 700,
      stuckRecoveryMs: 1_000,
      maxVisitMs: 300 * MS_PER_MINUTE,
      standard: { maxActiveCustomers: is_adaptive ? undefined : 20 },
    },
  });
  return { ...start, elapsedMs: elapsed_at(START_MINUTE), spawnCountdownMs: 0 };
}

/** What one stepped run from 18:40 to just after the next opening records. */
interface ClosingRun {
  /** The minute of the day of every step that spawned a guest. */
  readonly spawn_minutes: readonly number[];
  /** The state at the first step from the doors closing, and from last orders. */
  readonly at_doors_close: GameState;
  readonly at_last_orders: GameState;
  /** The state just before the closing call, and at its first step. */
  readonly before_closing_call: GameState;
  readonly at_closing_call: GameState;
  /** The state just before and just after the day changes. */
  readonly before_day_change: GameState;
  readonly after_day_change: GameState;
  /** The IDs of the guests whose despawn event said they were sent home. */
  readonly sent_home_ids: ReadonlySet<string>;
  /** The minute of the day at which each sent-home guest was sent on their way. */
  readonly sent_home_minutes: readonly number[];
  /** For every order taken, the simulated time at which its dish is ready. */
  readonly order_ready_ms: readonly number[];
  /** Every visit rating settled during the run, by guest ID. */
  readonly ratings: ReadonlyMap<string, VisitRating>;
}

/**
 * Steps a closing game from 18:40 through the day change, checking the invariants at each step.
 *
 * @param start - The starting state.
 * @returns The recorded states, spawns, sent-home guests and ratings.
 */
function run_through_closing(start: GameState): ClosingRun {
  const spawn_minutes: number[] = [];
  const sent_home_ids = new Set<string>();
  const sent_home_minutes: number[] = [];
  const order_ready_ms: number[] = [];
  const ratings = new Map<string, VisitRating>();
  const states: Partial<Record<keyof ClosingRun, GameState>> = {};
  let state = start;
  while (state.progression.focusDay === 1 || minute_of(state) < OPENING_MINUTE + 1) {
    const previous = state;
    state = stepSimulation(state);
    assertSimulationInvariants(state);
    if (state.metrics.spawnedCustomers > previous.metrics.spawnedCustomers) {
      spawn_minutes.push(minute_of(previous));
    }
    for (const event of state.events) {
      if (event.type === "customer-despawned" && event.message === "sent-home" && event.entityId) {
        sent_home_ids.add(event.entityId);
      }
    }
    for (const rating of state.metrics.visitRatings) ratings.set(rating.customerId, rating);
    for (const customer of Object.values(state.customers)) {
      const was = previous.customers[customer.id];
      if (customer.isSentHome && !was?.isSentHome) sent_home_minutes.push(minute_of(previous));
      if (customer.status === "waiting-for-food" && was?.status !== "waiting-for-food") {
        const dish = state.catalog.dishes[customer.orderedDishId ?? ""];
        order_ready_ms.push(previous.elapsedMs + (dish?.preparationMs ?? 0));
      }
    }
    // A step applies the schedule at the clock it starts from, so the first step that starts at
    // a minute is the one that acts on it.
    if (minute_of(previous) === DOORS_CLOSE_MINUTE && !states.at_doors_close) {
      states.at_doors_close = state;
    }
    if (minute_of(previous) === LAST_ORDERS_MINUTE && !states.at_last_orders) {
      states.at_last_orders = state;
    }
    if (minute_of(state) === CLOSING_CALL_MINUTE - 1) states.before_closing_call = state;
    if (minute_of(previous) === CLOSING_CALL_MINUTE && !states.at_closing_call) {
      states.at_closing_call = state;
    }
    if (previous.progression.focusDay === 1 && state.progression.focusDay === 2) {
      states.before_day_change = previous;
      states.after_day_change = state;
    }
  }
  return {
    spawn_minutes,
    at_doors_close: states.at_doors_close!,
    at_last_orders: states.at_last_orders!,
    before_closing_call: states.before_closing_call!,
    at_closing_call: states.at_closing_call!,
    before_day_change: states.before_day_change!,
    after_day_change: states.after_day_change!,
    sent_home_ids,
    sent_home_minutes,
    order_ready_ms,
    ratings,
  };
}

describe("closing wind-down", () => {
  const run = run_through_closing(make_closing_game());

  it("lets no guest in from the moment the doors close until the next opening", () => {
    const late = run.spawn_minutes.filter(
      (minute) => minute >= DOORS_CLOSE_MINUTE || minute < OPENING_MINUTE,
    );

    expect([run.spawn_minutes.length > 0, late]).toEqual([true, []]);
  });

  it("turns no guest away: everyone still queueing when the doors close is served", () => {
    const queued_at_doors_close = Object.values(run.at_doors_close.customers)
      .filter((customer) => customer.status === "queued" || customer.status === "walking-to-queue")
      .map((customer) => customer.id);
    const served = queued_at_doors_close.filter((id) => run.ratings.get(id)?.served === true);

    expect({
      sent_home: run.sent_home_ids.size,
      is_anyone_queued: queued_at_doors_close.length > 0,
      served,
    }).toEqual({ sent_home: 0, is_anyone_queued: true, served: queued_at_doors_close });
  });

  it("sends a guest still waiting at the closing call home without a rating", () => {
    // Jump a queue that admission expected to clear straight to the closing call.
    const waiting_ids = Object.values(run.at_doors_close.customers)
      .filter((customer) => customer.status === "queued" || customer.status === "walking-to-queue")
      .map((customer) => customer.id);
    const late = stepSimulation({
      ...run.at_doors_close,
      elapsedMs: elapsed_at(CLOSING_CALL_MINUTE),
    });
    let state = late;
    for (let step = 0; step < 600 && waiting_ids.some((id) => state.customers[id]); step += 1) {
      state = stepSimulation(state);
    }
    const rated = state.metrics.visitRatings.filter((rating) =>
      waiting_ids.includes(rating.customerId),
    );

    expect({
      has_waiting: waiting_ids.length > 0,
      not_sent_home: waiting_ids.filter((id) => late.customers[id]?.isSentHome !== true),
      rated,
    }).toEqual({ has_waiting: true, not_sent_home: [], rated: [] });
  });

  it("lets every guest through the doors reach last orders with time to order", () => {
    const last_entry = Math.max(...run.spawn_minutes.filter((minute) => minute >= START_MINUTE));

    expect(LAST_ORDERS_MINUTE - last_entry).toBeGreaterThanOrEqual(20);
  });

  it("has every diner finish up at the closing call, rated as served", () => {
    const diners = Object.values(run.before_closing_call.customers)
      .filter((customer) => customer.status === "eating")
      .map((customer) => customer.id);
    const still_eating = Object.values(run.at_closing_call.customers).filter(
      (customer) => customer.status === "eating",
    );
    const finished = diners.map((id) => run.at_closing_call.customers[id]?.status);

    expect({ has_diners: diners.length > 0, still_eating }).toEqual({
      has_diners: true,
      still_eating: [],
    });
    expect(
      finished.every((status) => status === "walking-to-exit" || status === "seeking-tray-return"),
    ).toBe(true);
    expect(
      diners.map((id) => {
        const rating = run.ratings.get(id);
        return { served: rating?.served, abandoned: rating?.abandoned };
      }),
    ).toEqual(diners.map(() => ({ served: true, abandoned: false })));
  });

  it("opens the next day with an empty hall, no queues, no reserved seats and no trays", () => {
    const after = run.after_day_change;

    expect({
      customers: after.customers,
      queued: Object.values(after.queues).flat(),
      seatReservations: after.seatReservations,
      unclearedTrays: after.unclearedTrays,
    }).toEqual({ customers: {}, queued: [], seatReservations: {}, unclearedTrays: {} });
  });
});

describe("closing with a fixed arrival interval", () => {
  it("ignores the clock: guests keep arriving after the doors close and stay across the day change", () => {
    const run = run_through_closing(make_closing_game(false));

    expect({
      has_late_arrival: run.spawn_minutes.some((minute) => minute >= DOORS_CLOSE_MINUTE),
      is_hall_kept: Object.keys(run.after_day_change.customers).length > 0,
      sent_home: run.sent_home_ids.size,
    }).toEqual({ has_late_arrival: true, is_hall_kept: true, sent_home: 0 });
  });
});

describe("the kitchen cut-off", () => {
  /** A cooking time long enough that orders stop well before last orders. */
  const SLOW_DISH_MS = 25 * MS_PER_MINUTE;
  const run = run_through_closing(make_closing_game(true, SLOW_DISH_MS));

  it("takes no order that cannot be handed over by the closing call", () => {
    const closing_call_ms = elapsed_at(CLOSING_CALL_MINUTE);
    const late = run.order_ready_ms.filter((ready_ms) => ready_ms > closing_call_ms);

    expect({ has_orders: run.order_ready_ms.length > 0, late }).toEqual({
      has_orders: true,
      late: [],
    });
  });

  it("stops letting guests in once the slow kitchen could not serve them, so nobody is turned away", () => {
    const fast_run_last_entry = Math.max(...run_through_closing(make_closing_game()).spawn_minutes);
    const slow_last_entry = Math.max(...run.spawn_minutes);

    expect({
      is_earlier: slow_last_entry < fast_run_last_entry,
      is_in_time: slow_last_entry <= CLOSING_CALL_MINUTE - SLOW_DISH_MS / MS_PER_MINUTE,
      sent_home: run.sent_home_ids.size,
    }).toEqual({ is_earlier: true, is_in_time: true, sent_home: 0 });
  });
});
