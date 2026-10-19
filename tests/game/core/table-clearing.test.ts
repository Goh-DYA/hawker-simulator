import { describe, expect, it } from "vitest";

import {
  assertSimulationInvariants,
  dispatchCommand,
  stepSimulation,
  type Customer,
  type GameState,
  type SimulationCatalog,
} from "@/src/game/core";
import {
  BASE_CLEANING_CREW,
  count_cleaning_crew,
  is_tray_returner,
  TRAY_CLEAR_MS,
} from "@/src/game/core/clearing";
import { DEPARTURE_REASONS } from "@/src/game/core/enums";
import { INITIAL_OBJECTS, makeGame, runUntil, TEST_CATALOG } from "./fixtures";

/** Step budget for reaching each clearing condition. */
const MAX_STEPS = 800;
/** Steps of a longer run used for the invariant soak. */
const SOAK_STEPS = 1_500;

/** Starts the fixture centre without its tray return, so every guest leaves their tray. */
function game_without_tray_return(): GameState {
  return makeGame({ initialObjects: INITIAL_OBJECTS.filter((object) => object.id !== "tray-1") });
}

function catalog_with_tray_return_chance(chance: number): SimulationCatalog {
  return {
    ...TEST_CATALOG,
    archetypes: Object.fromEntries(
      Object.entries(TEST_CATALOG.archetypes).map(([id, archetype]) => [
        id,
        { ...archetype, trayReturnChance: chance },
      ]),
    ),
  };
}

function guest(id: string): Customer {
  return { id } as Customer;
}

describe("tray-return habit", () => {
  it("reads a guest's habit from a hash of their ID, so it is stable and draws no randomness", () => {
    const ids = Array.from({ length: 200 }, (_, index) => `customer-${index + 1}`);
    const returners = ids.filter((id) => is_tray_returner(guest(id), 0.7));
    expect(returners).toEqual(ids.filter((id) => is_tray_returner(guest(id), 0.7)));
    expect(returners.length).toBeGreaterThan(110);
    expect(returners.length).toBeLessThan(170);
  });

  it("treats an archetype without a habit as always returning, and a zero habit as never", () => {
    expect(is_tray_returner(guest("customer-1"), undefined)).toBe(true);
    expect(is_tray_returner(guest("customer-1"), 1)).toBe(true);
    expect(is_tray_returner(guest("customer-1"), 0)).toBe(false);
  });
});

describe("table-cleaning crew", () => {
  it("has the base crew plus one member per tray-return station", () => {
    const state = makeGame();
    expect(count_cleaning_crew(state.objects, state.catalog)).toBe(BASE_CLEANING_CREW + 1);
    const without_return = game_without_tray_return();
    expect(count_cleaning_crew(without_return.objects, without_return.catalog)).toBe(
      BASE_CLEANING_CREW,
    );
  });

  it("leaves the tray on the seat when no tray return is reachable, then clears it", () => {
    const left = runUntil(
      game_without_tray_return(),
      (state) => Object.keys(state.unclearedTrays).length > 0,
      MAX_STEPS,
    );
    const [seat_key, tray] = Object.entries(left.unclearedTrays)[0] ?? [];
    expect(seat_key).toBeDefined();
    expect(tray?.workRemainingMs).toBeLessThanOrEqual(TRAY_CLEAR_MS);
    expect(left.metrics.trayReturns).toBe(0);
    const cleared = runUntil(
      left,
      (state) => !state.unclearedTrays[seat_key as string],
      TRAY_CLEAR_MS / left.config.fixedStepMs + 1,
    );
    expect(cleared.unclearedTrays[seat_key as string]).toBeUndefined();
  });

  it("never seats a guest at a seat with a tray on it", () => {
    let state = game_without_tray_return();
    for (let step = 0; step < SOAK_STEPS; step += 1) {
      state = stepSimulation(state);
      for (const seat_key of Object.keys(state.unclearedTrays)) {
        expect(state.seatReservations[seat_key]).toBeUndefined();
      }
      assertSimulationInvariants(state);
    }
  });

  it("clears only as many trays at once as it has crew members", () => {
    const state = makeGame({
      initialObjects: INITIAL_OBJECTS.filter((object) => object.id !== "tray-1"),
    });
    const seeded: GameState = {
      ...state,
      unclearedTrays: {
        "seat-1:0": { leftAtTick: 0, workRemainingMs: 1_000 },
        "seat-2:0": { leftAtTick: 1, workRemainingMs: 1_000 },
      },
    };
    const after = stepSimulation(seeded);
    expect(after.unclearedTrays["seat-1:0"]?.workRemainingMs).toBe(
      1_000 - state.config.fixedStepMs,
    );
    expect(after.unclearedTrays["seat-2:0"]?.workRemainingMs).toBe(1_000);
  });

  it("keeps a removed seat's tray while undo can restore the seat, then drops it", () => {
    const state = makeGame();
    const seeded: GameState = {
      ...state,
      unclearedTrays: { "seat-1:0": { leftAtTick: 0, workRemainingMs: 10_000 } },
    };
    const removed = dispatchCommand(seeded, { type: "remove-object", objectId: "seat-1" });
    expect(removed.accepted).toBe(true);
    const stepped = stepSimulation(removed.state);
    expect(stepped.unclearedTrays["seat-1:0"]).toEqual({ leftAtTick: 0, workRemainingMs: 10_000 });
    const undone = dispatchCommand(stepped, { type: "undo" });
    expect(undone.accepted).toBe(true);
    expect(stepSimulation(undone.state).unclearedTrays["seat-1:0"]?.workRemainingMs).toBeLessThan(
      10_000,
    );
    const settled = stepSimulation({ ...removed.state, undoStack: [] });
    expect(settled.unclearedTrays["seat-1:0"]).toBeUndefined();
  });

  it("sends guests who never return a tray past the tray return", () => {
    const left = runUntil(
      makeGame({ catalog: catalog_with_tray_return_chance(0) }),
      (state) => Object.keys(state.unclearedTrays).length > 0,
      MAX_STEPS,
    );
    expect(left.metrics.trayReturns).toBe(0);
  });
});

describe("visit cap and departure reasons", () => {
  it("lets a seated guest finish their meal past the visit cap", () => {
    const seated = runUntil(
      makeGame(),
      (state) => Object.values(state.customers).some((customer) => customer.status === "eating"),
      MAX_STEPS,
    );
    const diner = Object.values(seated.customers).find((customer) => customer.status === "eating");
    expect(diner).toBeDefined();
    const capped: GameState = {
      ...seated,
      customers: {
        ...seated.customers,
        [diner!.id]: { ...diner!, visitElapsedMs: seated.config.maxVisitMs },
      },
    };
    expect(stepSimulation(capped).customers[diner!.id]?.status).toBe("eating");
  });

  it("records why a guest left on their visit rating", () => {
    const state = runUntil(
      makeGame({
        config: {
          fixedStepMs: 100,
          spawnIntervalMs: 100,
          maxVisitMs: 30_000,
          standard: { maxActiveCustomers: 20, maxFixedStepsPerAdvance: 100 },
        },
      }),
      (current) => current.metrics.visitRatings.some((rating) => rating.reason !== "served"),
      SOAK_STEPS,
    );
    const departures = state.metrics.visitRatings.filter((rating) => rating.reason !== "served");
    expect(departures.length).toBeGreaterThan(0);
    for (const rating of departures) {
      expect(DEPARTURE_REASONS).toContain(rating.reason);
      expect(rating.reason).not.toBe("abandoned");
    }
  });
});
