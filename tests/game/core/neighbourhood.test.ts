import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  simulationDigest,
  stepSimulation,
  type CalendarCardDefinition,
  type GameState,
  type SimulationCatalog,
  type WriterVisit,
} from "@/src/game/core";
import {
  compute_card_weight,
  compute_day_performance,
  compute_rush_windows,
  compute_writer_threshold,
  day_stream,
  draw_calendar_card,
  get_writer_pick_bonus,
  list_bag_card_ids,
  roll_neighbourhood_day,
  settle_writer_review,
  WRITER_PICK_POPULARITY_BONUS,
  WRITER_VERDICT_MINUTE,
} from "@/src/game/core/neighbourhood";
import { OPERATING_DAY_MS } from "@/src/game/core/progression";
import { DINNER_RUSH, LUNCH_RUSH } from "@/src/game/core/rush";
import { makeGame, TEST_CATALOG } from "./fixtures";

/** In-game minute at which the operating day opens (10:30). */
const OPENING_MINUTE = 10 * 60 + 30;
/** Days drawn when checking the shuffle-bag properties. */
const BAG_TEST_DAYS = 600;
/** The adaptive arrival model, without the fixture's fixed arrival interval. */
const ADAPTIVE_CONFIG = {
  fixedStepMs: 100,
  spawnIntervalMs: 700,
  stuckRecoveryMs: 1_000,
  maxVisitMs: 30_000,
  standard: { maxFixedStepsPerAdvance: 100 },
  lowerEnd: { maxFixedStepsPerAdvance: 50 },
} as const;

function card(
  id: string,
  intensity: number,
  overrides: Partial<CalendarCardDefinition> = {},
): CalendarCardDefinition {
  return {
    id,
    isOpeningDay: false,
    intensity,
    arrivalFactor: 1,
    lunchPeakFactor: 1,
    dinnerPeakFactor: 1,
    eatingTimeFactor: 1,
    archetypeFactors: [],
    categoryAppeal: [],
    ...overrides,
  };
}

const CARDS: readonly CalendarCardDefinition[] = [
  card("calendar.opening", 0.2, { isOpeningDay: true }),
  card("calendar.calm", 0.1, { arrivalFactor: 0.8 }),
  card("calendar.busy", 0.9, { arrivalFactor: 1.3, lunchPeakFactor: 1.5 }),
  card("calendar.middle", 0.5, { dinnerPeakFactor: 1.4, eatingTimeFactor: 1.2 }),
  card("calendar.lively", 0.8, { archetypeFactors: [{ archetypeId: "regular", factor: 2 }] }),
];

const CATALOG: SimulationCatalog = { ...TEST_CATALOG, calendarCards: CARDS };

function seeded_game(world_seed = 2026): GameState {
  return makeGame({ catalog: CATALOG, worldSeed: world_seed, config: ADAPTIVE_CONFIG });
}

function draw_days(tension: number, world_seed: number): readonly string[] {
  let bag = list_bag_card_ids(CATALOG);
  let previous = "";
  const drawn: string[] = [];
  for (let day = 2; day < 2 + BAG_TEST_DAYS; day += 1) {
    const result = draw_calendar_card(CATALOG, bag, previous, tension, world_seed, day);
    drawn.push(result.cardId);
    bag = result.bagCardIds;
    previous = result.cardId;
  }
  return drawn;
}

function run_days(state: GameState, days: number): GameState {
  let current = state;
  const steps = (days * OPERATING_DAY_MS) / current.config.fixedStepMs;
  for (let step = 0; step < steps; step += 1) current = stepSimulation(current);
  return current;
}

function at_minute(state: GameState, minute: number): GameState {
  return { ...state, elapsedMs: (minute - OPENING_MINUTE) * 1_000 };
}

function with_writer(state: GameState, writer: WriterVisit): GameState {
  const neighbourhood = state.neighbourhood!;
  return {
    ...state,
    neighbourhood: { ...neighbourhood, calendar: { ...neighbourhood.calendar, writer } },
  };
}

describe("neighbourhood streams", () => {
  it("derives a day stream only from the world seed, the system and the day", () => {
    expect(day_stream(7, "calendar", 3)).toBe(day_stream(7, "calendar", 3));
    expect(day_stream(7, "calendar", 3)).not.toBe(day_stream(7, "calendar", 4));
    expect(day_stream(7, "calendar", 3)).not.toBe(day_stream(7, "writer", 3));
    expect(day_stream(7, "calendar", 3)).not.toBe(day_stream(8, "calendar", 3));
  });

  it("leaves a centre without a world seed without a neighbourhood", () => {
    const state = makeGame();
    expect(state.neighbourhood).toBeUndefined();
    expect(compute_rush_windows(state)).toEqual([LUNCH_RUSH, DINNER_RUSH]);
  });
});

describe("calendar shuffle bag", () => {
  it("opens day 1 with the opening card and forecasts a bag card for day 2", () => {
    const calendar = seeded_game().neighbourhood!.calendar;
    expect(calendar.day).toBe(1);
    expect(calendar.todayCardId).toBe("calendar.opening");
    expect(list_bag_card_ids(CATALOG)).toContain(calendar.tomorrowCardId);
  });

  it("never draws the same card on two days in a row", () => {
    for (const tension of [0, 0.5, 1]) {
      const drawn = draw_days(tension, 99);
      for (let index = 1; index < drawn.length; index += 1) {
        expect(drawn[index]).not.toBe(drawn[index - 1]);
      }
    }
  });

  it("shows every bag card before any card repeats", () => {
    const bag_size = list_bag_card_ids(CATALOG).length;
    const drawn = draw_days(0.5, 4);
    expect(new Set(drawn.slice(0, bag_size)).size).toBe(bag_size);
    for (const id of list_bag_card_ids(CATALOG)) {
      expect(drawn.filter((drawn_id) => drawn_id === id).length).toBeGreaterThan(
        BAG_TEST_DAYS / bag_size / 2,
      );
    }
  });

  it("favours intense days after strong days and calm days after rough ones", () => {
    const busy = CARDS.find((entry) => entry.id === "calendar.busy")!;
    const calm = CARDS.find((entry) => entry.id === "calendar.calm")!;
    expect(compute_card_weight(busy, 1)).toBeGreaterThan(compute_card_weight(calm, 1));
    expect(compute_card_weight(calm, 0)).toBeGreaterThan(compute_card_weight(busy, 0));
    expect(compute_card_weight(busy, 0.5)).toBe(compute_card_weight(calm, 0.5));
    expect(compute_card_weight(busy, 0)).toBeGreaterThan(0);
  });

  it("scores a day's performance from its average score and how many visits went smoothly", () => {
    const day = (averageScore: number, smooth_visits: number) =>
      compute_day_performance({
        ratedVisits: 10,
        averageScore,
        departureCounts: { served: smooth_visits },
      } as never);
    expect(day(90, 10)).toBe(1);
    expect(day(50, 10)).toBe(0);
    expect(day(70, 5)).toBeCloseTo(0.25, 12);
  });

  it("decorrelates the streams of neighbouring days", () => {
    const first = (day: number, seed: number) => day_stream(seed, "calendar", day) / 2 ** 32;
    let sum_xy = 0;
    let sum_x = 0;
    let sum_y = 0;
    let sum_xx = 0;
    let sum_yy = 0;
    let count = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      for (let day = 1; day < 50; day += 1) {
        const x = first(day, seed);
        const y = first(day + 1, seed);
        sum_x += x;
        sum_y += y;
        sum_xy += x * y;
        sum_xx += x * x;
        sum_yy += y * y;
        count += 1;
      }
    }
    const covariance = sum_xy / count - (sum_x / count) * (sum_y / count);
    const deviation = Math.sqrt(
      (sum_xx / count - (sum_x / count) ** 2) * (sum_yy / count - (sum_y / count) ** 2),
    );
    expect(Math.abs(covariance / deviation)).toBeLessThan(0.05);
  });
});

describe("day cards in the simulation", () => {
  it("scales the day's crowds by today's card", () => {
    const state = seeded_game();
    const busy_day: GameState = {
      ...state,
      neighbourhood: {
        ...state.neighbourhood!,
        calendar: { ...state.neighbourhood!.calendar, todayCardId: "calendar.busy" },
      },
    };
    const [lunch, dinner] = compute_rush_windows(busy_day);
    expect(lunch?.peak).toBeCloseTo(LUNCH_RUSH.peak * 1.5, 12);
    expect(dinner?.peak).toBe(DINNER_RUSH.peak);
    expect(Math.abs((lunch?.centre_minute ?? 0) - LUNCH_RUSH.centre_minute)).toBeLessThanOrEqual(
      15,
    );
  });

  it("closes each day with a report, a day-ended event and a fresh ledger", () => {
    let state = seeded_game();
    const ended: number[] = [];
    let visits_at_day_start = state.economy.completedVisits;
    for (let step = 0; step < (2 * OPERATING_DAY_MS) / state.config.fixedStepMs + 1; step += 1) {
      state = stepSimulation(state);
      for (const event of state.events) {
        if (event.type !== "day-ended") continue;
        ended.push(event.amount ?? 0);
        const report = state.neighbourhood!.lastReport!;
        expect(report.day).toBe(event.amount);
        expect(report.served).toBe(state.economy.completedVisits - visits_at_day_start);
        expect(report.objectivesTotal).toBe(3);
        expect(state.neighbourhood!.ledger.day).toBe(report.day + 1);
        expect(state.neighbourhood!.ledger.ratedVisits).toBe(0);
        visits_at_day_start = state.economy.completedVisits;
      }
    }
    expect(ended).toEqual([1, 2]);
    expect(state.neighbourhood!.calendar.day).toBe(3);
  });

  it("reproduces a seeded neighbourhood run exactly, and differs for another seed", () => {
    const hash = (state: GameState) =>
      createHash("sha256").update(simulationDigest(state)).digest("hex");
    const first = run_days(seeded_game(11), 2);
    const again = run_days(seeded_game(11), 2);
    const other = run_days(seeded_game(12), 2);
    expect(hash(again)).toBe(hash(first));
    expect(first.neighbourhood).toEqual(again.neighbourhood);
    expect(other.neighbourhood?.worldSeed).not.toBe(first.neighbourhood?.worldSeed);
  });

  it("keeps the peak reputation at or above the live reputation", () => {
    let state = seeded_game();
    for (let step = 0; step < 3_000; step += 1) {
      state = stepSimulation(state);
      expect(state.progression.peakReputation).toBeGreaterThanOrEqual(state.progression.reputation);
    }
  });
});

describe("food writer", () => {
  it("raises the threshold with every plaque held, up to a cap", () => {
    expect(compute_writer_threshold(0)).toBe(68);
    expect(compute_writer_threshold(2)).toBe(74);
    expect(compute_writer_threshold(10)).toBe(82);
  });

  it("awards a plaque when the reviewed stall's average meets the threshold", () => {
    const state = with_writer(at_minute(seeded_game(), WRITER_VERDICT_MINUTE), {
      stallDefinitionId: "stall",
      threshold: 68,
      scoreTotal: 280,
      visitCount: 4,
      outcome: "pending",
    });
    const settled = settle_writer_review(state);
    expect(settled.neighbourhood!.calendar.writer?.outcome).toBe("plaque");
    expect(settled.neighbourhood!.writerPickStallIds).toEqual(["stall"]);
    expect(settled.events.at(-1)).toMatchObject({
      type: "writer-reviewed",
      entityId: "stall",
      message: "plaque",
      amount: 70,
    });
    expect(get_writer_pick_bonus(settled, "stall")).toBe(WRITER_PICK_POPULARITY_BONUS);
  });

  it("gives no plaque and costs nothing below the threshold or with too few visits", () => {
    const base = at_minute(seeded_game(), WRITER_VERDICT_MINUTE);
    const low = settle_writer_review(
      with_writer(base, {
        stallDefinitionId: "stall",
        threshold: 68,
        scoreTotal: 240,
        visitCount: 4,
        outcome: "pending",
      }),
    );
    const few = settle_writer_review(
      with_writer(base, {
        stallDefinitionId: "stall",
        threshold: 68,
        scoreTotal: 190,
        visitCount: 2,
        outcome: "pending",
      }),
    );
    expect(low.neighbourhood!.calendar.writer?.outcome).toBe("no-plaque");
    expect(few.neighbourhood!.calendar.writer?.outcome).toBe("too-few-visits");
    expect(low.neighbourhood!.writerPickStallIds).toEqual([]);
    expect(low.economy).toEqual(base.economy);
    expect(low.progression).toEqual(base.progression);
  });

  it("waits for the end of the review window before settling", () => {
    const state = with_writer(at_minute(seeded_game(), WRITER_VERDICT_MINUTE - 1), {
      stallDefinitionId: "stall",
      threshold: 68,
      scoreTotal: 280,
      visitCount: 4,
      outcome: "pending",
    });
    expect(settle_writer_review(state)).toBe(state);
  });

  it("schedules writers from day 3 on, at least three days apart", () => {
    let state = seeded_game(77);
    const writer_days: number[] = [];
    for (let day = 2; day <= 90; day += 1) {
      const rolled = roll_neighbourhood_day(
        { ...state, elapsedMs: (day - 1) * OPERATING_DAY_MS },
        day,
      );
      state = { ...state, neighbourhood: rolled.neighbourhood };
      if (rolled.neighbourhood.calendar.writer) writer_days.push(day);
    }
    expect(writer_days.length).toBeGreaterThan(5);
    expect(writer_days[0]).toBeGreaterThanOrEqual(3);
    for (let index = 1; index < writer_days.length; index += 1) {
      expect(writer_days[index]! - writer_days[index - 1]!).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("seeded daily objectives", () => {
  it("keeps the fixed day-1 objectives and seeds later days from the day stream", () => {
    const start = seeded_game(5);
    expect(start.progression.dailyObjectives.map((item) => item.kind)).toEqual([
      "serve",
      "happiness",
      "nutrition",
    ]);
    const day_two = run_days(start, 1);
    const again = run_days(seeded_game(5), 1);
    expect(day_two.progression.focusDay).toBe(2);
    expect(day_two.progression.dailyObjectives).toEqual(again.progression.dailyObjectives);
    const [service, quality, nutrition] = day_two.progression.dailyObjectives;
    expect(["serve", "revenue"]).toContain(service?.kind);
    expect(["happiness", "flow", "variety", "facility"]).toContain(quality?.kind);
    expect(nutrition?.kind).toBe("nutrition");
  });

  it("asks for about what the centre managed the day before, never less than the fixed floor", () => {
    const day_two = run_days(seeded_game(5), 1);
    const report = day_two.neighbourhood!.lastReport!;
    const service = day_two.progression.dailyObjectives[0]!;
    const yesterday = service.kind === "serve" ? report.served : report.revenue;
    const floor =
      service.kind === "serve"
        ? 5 + day_two.progression.level * 2
        : Math.round(35 + day_two.progression.level * 8);
    expect(service.target).toBeGreaterThanOrEqual(floor);
    expect(service.target).toBeLessThanOrEqual(Math.max(floor, Math.round(yesterday * 1.15)));
    expect(service.target).toBeGreaterThanOrEqual(
      Math.min(Math.round(yesterday * 0.95), Math.max(floor, yesterday)),
    );
  });
});
