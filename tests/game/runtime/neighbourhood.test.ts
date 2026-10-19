import { describe, expect, it } from "vitest";

import {
  advanceSimulation,
  dispatchCommand,
  type DayReport,
  type GameState,
} from "@/src/game/core";
import { create_neighbourhood } from "@/src/game/core";
import { buildCatalog } from "@/src/game/runtime/catalog";
import {
  build_day_review,
  build_neighbourhood_view,
  find_next_unlock,
  RUSH_NOTICE_LEAD_MINUTES,
} from "@/src/game/runtime/neighbourhood";
import { create_fresh_session, ensure_neighbourhood } from "@/src/game/runtime/world";

const { catalog: AUTHORED_CATALOG, visuals: VISUALS } = buildCatalog();

/** In-game minute at which the operating day opens (10:30). */
const OPENING_MINUTE = 10 * 60 + 30;

function fresh_state(world_seed = 99): GameState {
  return create_fresh_session(AUTHORED_CATALOG, world_seed).state;
}

function at_minute(state: GameState, minute: number): GameState {
  return { ...state, elapsedMs: (minute - OPENING_MINUTE) * 1_000 };
}

function report_with(overrides: Partial<DayReport>): DayReport {
  return {
    day: 3,
    cardId: "calendar.monsoon-shower",
    served: 80,
    leftEarly: 12,
    revenue: 600,
    ratedVisits: 90,
    averageScore: 71,
    componentAverages: {
      foodQuality: 80,
      wait: 60,
      value: 75,
      walking: 90,
      comfort: 40,
      cleanliness: 70,
      ambience: 65,
    },
    departureCounts: {
      served: 78,
      abandoned: 0,
      "no-stall": 2,
      "long-queue": 3,
      "no-dish": 0,
      "no-seat": 7,
      "visit-cap": 0,
    },
    trayReturns: 30,
    servedStallCount: 2,
    objectivesCompleted: 2,
    objectivesTotal: 3,
    unlockedCount: 1,
    writer: null,
    ...overrides,
  };
}

describe("neighbourhood view", () => {
  it("names today's opening day and tomorrow's forecast for a fresh centre", () => {
    const view = build_neighbourhood_view(fresh_state(), VISUALS)!;
    expect(view.today.name).toBe("Opening day");
    expect(view.tomorrow.forecast.length).toBeGreaterThan(20);
    expect(view.rushWindows.map((window) => window.kind)).toEqual(["lunch", "dinner"]);
    expect(view.lastReport).toBeUndefined();
  });

  it("announces a rush within the lead time and names the rush under way", () => {
    const state = fresh_state();
    const view = build_neighbourhood_view(state, VISUALS)!;
    const lunch = view.rushWindows[0]!;
    const before = build_neighbourhood_view(at_minute(state, lunch.startMinute - 30), VISUALS)!;
    const dinner = view.rushWindows[1]!;
    const far = build_neighbourhood_view(
      at_minute(state, dinner.startMinute - RUSH_NOTICE_LEAD_MINUTES - 5),
      VISUALS,
    )!;
    const during = build_neighbourhood_view(at_minute(state, lunch.startMinute + 5), VISUALS)!;
    expect(before.rushNotice).toMatch(/^Lunch crowd from about/);
    expect(far.rushNotice).toBeUndefined();
    expect(during.activeRush).toBe("lunch");
    expect(during.rushNotice).toMatch(/^Lunch rush under way/);
  });

  it("is absent for a centre without a neighbourhood and added on load", () => {
    const state = fresh_state();
    const bare: GameState = { ...state, neighbourhood: undefined };
    expect(build_neighbourhood_view(bare, VISUALS)).toBeUndefined();
    const ensured = ensure_neighbourhood(bare);
    expect(ensured.neighbourhood?.worldSeed).toBe(
      ensure_neighbourhood(bare).neighbourhood?.worldSeed,
    );
    expect(ensure_neighbourhood(state)).toBe(state);
  });

  it("gives every new centre seed its own calendar", () => {
    const tomorrow_cards = new Set(
      Array.from(
        { length: 12 },
        (_, seed) => create_neighbourhood(fresh_state(), seed + 1).calendar.tomorrowCardId,
      ),
    );
    expect(tomorrow_cards.size).toBeGreaterThan(2);
  });
});

describe("service review", () => {
  it("grades warmly, lists why guests left and names one thing to try", () => {
    const review = build_day_review(
      report_with({
        departureCounts: { ...report_with({}).departureCounts, "no-seat": 12 },
      }),
      VISUALS,
    );
    expect(review.grade).toBe("Good");
    expect(review.gradeGlyph).toBe("●");
    expect(review.cardName).toBe("Monsoon shower");
    expect(review.leftEarlyReasons.map((entry) => entry.reason)).toEqual([
      "no-seat",
      "long-queue",
      "no-stall",
    ]);
    expect(review.focusTip?.label).toBe("Seating");
    expect(review.focusTip?.action).toMatch(/tables and seats/);
  });

  it("falls back to the weakest rating factor when few guests left early", () => {
    const review = build_day_review(
      report_with({
        departureCounts: {
          ...report_with({}).departureCounts,
          "no-seat": 2,
          "long-queue": 1,
          "no-stall": 0,
        },
      }),
      VISUALS,
    );
    expect(review.focusTip?.factor).toBe("wait");
  });

  it("never gives a fail grade, even with no rated visits", () => {
    const review = build_day_review(report_with({ ratedVisits: 0, averageScore: 0 }), VISUALS);
    expect(review.grade).toBe("Finding our feet");
    expect(review.focusTip).toBeUndefined();
  });

  it("quotes the food writer on the day's strongest and weakest factors", () => {
    const review = build_day_review(
      report_with({
        writer: {
          stallDefinitionId: "stall.sunrise-roost",
          threshold: 68,
          averageScore: 74,
          visitCount: 6,
          outcome: "plaque",
        },
      }),
      VISUALS,
    );
    expect(review.writer?.stallName).toBe(VISUALS["stall.sunrise-roost"]?.name);
    expect(review.writer?.quote).toContain("An easy walk from the gate");
    expect(review.writer?.quote).toContain("seats that were hard to find");
    expect(review.writer?.quote).not.toMatch(/healthy|unhealthy/i);
  });
});

describe("next unlock", () => {
  it("points a fresh centre at a nearby unlock with an actionable hint", () => {
    const next = find_next_unlock(fresh_state())!;
    expect(next.name.length).toBeGreaterThan(2);
    expect(next.progress).toBeGreaterThanOrEqual(0);
    expect(next.progress).toBeLessThan(1);
    expect(next.hint).toMatch(/level|reputation/);
  });

  it("moves on once the centre has grown", () => {
    let state = fresh_state();
    for (const object of Object.values(state.objects)) {
      if (state.catalog.placeables[object.definitionId]?.kind === "stall") {
        state = dispatchCommand(state, {
          type: "set-stall-open",
          objectId: object.id,
          open: true,
        }).state;
      }
    }
    const before = find_next_unlock(state)!;
    const grown: GameState = {
      ...state,
      progression: { ...state.progression, level: 20, reputation: 5, peakReputation: 5 },
    };
    const after = find_next_unlock(grown);
    expect(after?.id).not.toBe(before.id);
    expect(advanceSimulation(state, 100).state.tick).toBe(state.tick + 1);
  });
});
