/**
 * Tests of the guided practice day's pure parts in `app/game/practice.ts`: the step list, the
 * check behind each task, the baseline and step bookkeeping, and the placement of the coach card
 * beside the element it rings.
 */
import { describe, expect, it } from "vitest";

import {
  advance_practice,
  COACH_GAP_PX,
  COACH_MARGIN_PX,
  is_practice_step_done,
  place_coach_card,
  PRACTICE_FINISH_STEP,
  PRACTICE_GUESTS_TO_SERVE,
  PRACTICE_START,
  PRACTICE_STEPS,
  type PracticeBaseline,
  type PracticeContext,
  type PracticeSnapshot,
  type PracticeStep,
  record_practice_baseline,
} from "@/app/game/practice";

/** The fresh practice centre's figures. */
const BASELINE: PracticeBaseline = { cash: 4_200, day: 1, servedCustomers: 0 };

/** A snapshot of the fresh practice centre before the player does anything. */
const FRESH_SNAPSHOT: PracticeSnapshot = {
  buildTool: "select",
  cash: BASELINE.cash,
  day: BASELINE.day,
  isOpen: false,
  selectedCustomerNutrition: undefined,
  servedCustomers: BASELINE.servedCustomers,
  speed: 1,
  timeLabel: "10:30 AM",
};

/**
 * Build a practice context on the fresh centre with some fields changed.
 *
 * @param changes - The context fields to change.
 * @param snapshot_changes - The snapshot fields to change.
 * @returns The context.
 */
function build_context(
  changes: Partial<PracticeContext> = {},
  snapshot_changes: Partial<PracticeSnapshot> = {},
): PracticeContext {
  return {
    snapshot: { ...FRESH_SNAPSHOT, ...snapshot_changes },
    baseline: BASELINE,
    panel: "build",
    isPanelVisible: true,
    hasOpenDialog: false,
    ...changes,
  };
}

/**
 * @param step - A practice step.
 * @returns Every line of its card's copy, joined with spaces.
 */
function card_copy(step: PracticeStep): string {
  return [
    step.intro,
    ...(step.flow?.stages ?? []),
    ...(step.points ?? []).map((point) => point.text),
    step.task,
  ]
    .filter((line) => line !== undefined)
    .join(" ");
}

/**
 * @param id - A practice step ID.
 * @returns The step with that ID.
 * @throws Error If no step has that ID.
 */
function find_step(id: string): PracticeStep {
  const step = PRACTICE_STEPS.find((candidate) => candidate.id === id);
  if (step === undefined) throw new Error(`No practice step ${id}`);
  return step;
}

describe("PRACTICE_STEPS", () => {
  it("walks the whole day in order, from the welcome to the finish card", () => {
    expect(PRACTICE_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "money",
      "clock",
      "today",
      "map",
      "pick-seat",
      "place-seat",
      "stop-building",
      "open-centre",
      "watch-guests",
      "inspect-guest",
      "dishes",
      "insights",
      "fast-forward",
      "end-of-day",
      "finish",
    ]);
    expect(PRACTICE_FINISH_STEP).toBe(PRACTICE_STEPS.length - 1);
  });

  it("gives every step with a task a check and praise", () => {
    for (const step of PRACTICE_STEPS.filter((candidate) => candidate.task !== undefined)) {
      expect({
        id: step.id,
        hasCheck: step.isDone !== undefined,
        hasPraise: Boolean(step.doneMessage),
      }).toEqual({ id: step.id, hasCheck: true, hasPraise: true });
    }
  });

  it("keeps every card short enough to read at a glance", () => {
    for (const step of PRACTICE_STEPS) {
      const words = card_copy(step).trim().split(/\s+/).length;
      expect({ id: step.id, isShort: words <= 60 }).toEqual({ id: step.id, isShort: true });
    }
  });

  it("breaks the copy into points of one or two short sentences, each with an icon", () => {
    for (const step of PRACTICE_STEPS) {
      for (const point of step.points ?? []) {
        const sentences = point.text.split(/[.!?]\s/).length;
        expect({ id: step.id, icon: point.icon.length > 0, isShort: sentences <= 2 }).toEqual({
          id: step.id,
          icon: true,
          isShort: true,
        });
      }
    }
  });

  it("shows a guest's visit as stages while the player watches the guests", () => {
    expect(find_step("watch-guests").flow).toEqual({
      label: "A guest's visit",
      stages: ["Pick a stall", "Line up", "Get food", "Sit and eat", "Go home"],
    });
  });

  it("never labels food as good or bad", () => {
    const copy = PRACTICE_STEPS.map((step) => `${step.title} ${card_copy(step)}`)
      .join(" ")
      .toLocaleLowerCase("en-SG");
    expect(copy).not.toMatch(/\b(healthy|unhealthy|junk|bad food|good food)\b/);
  });
});

describe("practice checks", () => {
  it("counts read-only steps as done", () => {
    expect(is_practice_step_done(find_step("welcome"), build_context())).toBe(true);
    expect(is_practice_step_done(find_step("finish"), build_context())).toBe(true);
  });

  it("finishes picking a stool once the place tool is on", () => {
    const step = find_step("pick-seat");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { buildTool: "place" }))).toBe(true);
  });

  it("finishes placing once cash drops below the starting cash, and never before a baseline", () => {
    const step = find_step("place-seat");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { cash: 4_165 }))).toBe(true);
    expect(
      is_practice_step_done(step, build_context({ baseline: undefined }, { cash: 4_165 })),
    ).toBe(false);
  });

  it("finishes stopping the build once the select tool is back", () => {
    const step = find_step("stop-building");
    expect(is_practice_step_done(step, build_context({}, { buildTool: "place" }))).toBe(false);
    expect(is_practice_step_done(step, build_context())).toBe(true);
  });

  it("finishes opening once the centre is open", () => {
    const step = find_step("open-centre");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { isOpen: true }))).toBe(true);
  });

  it("counts guests served since practice began, and shows the count", () => {
    const step = find_step("watch-guests");
    const almost = build_context(
      { baseline: { ...BASELINE, servedCustomers: 4 } },
      { servedCustomers: 4 + PRACTICE_GUESTS_TO_SERVE - 1 },
    );
    const enough = build_context(
      { baseline: { ...BASELINE, servedCustomers: 4 } },
      { servedCustomers: 4 + PRACTICE_GUESTS_TO_SERVE + 5 },
    );
    expect(is_practice_step_done(step, almost)).toBe(false);
    expect(step.progress?.(almost)).toBe("Guests served: 2 of 3");
    expect(is_practice_step_done(step, enough)).toBe(true);
    expect(step.progress?.(enough)).toBe("Guests served: 3 of 3");
  });

  it("finishes inspecting once a guest is selected", () => {
    const step = find_step("inspect-guest");
    const selected = build_context(
      {},
      {
        selectedCustomerNutrition: {
          customerId: "customer-1",
          archetypeId: "customer.early-shift-regular",
          status: "eating",
          decisionReasons: [],
          healthConditionIds: [],
          healthDecisionReasons: [],
        },
      },
    );
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(is_practice_step_done(step, selected)).toBe(true);
  });

  it.each(["dishes", "insights"] as const)(
    "rings the %s tab, then the panel, and finishes once that panel is on screen",
    (panel) => {
      const step = find_step(panel);
      const on_screen = build_context({ panel });
      const behind_sheet = build_context({ panel, isPanelVisible: false });
      expect(step.target?.(build_context())).toBe(`[data-coach="dock-${panel}"]`);
      expect(step.target?.(behind_sheet)).toBe(`[data-coach="dock-${panel}"]`);
      expect(step.target?.(on_screen)).toBe(".catalogue-panel");
      expect(is_practice_step_done(step, behind_sheet)).toBe(false);
      expect(is_practice_step_done(step, on_screen)).toBe(true);
    },
  );

  it("finishes fast-forwarding at 4× or faster", () => {
    const step = find_step("fast-forward");
    expect(is_practice_step_done(step, build_context({}, { speed: 2 }))).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { speed: 4 }))).toBe(true);
    expect(is_practice_step_done(step, build_context({}, { speed: 10 }))).toBe(true);
  });

  it("finishes the day only on a later day with the Service Review closed", () => {
    const step = find_step("end-of-day");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(is_practice_step_done(step, build_context({ hasOpenDialog: true }, { day: 2 }))).toBe(
      false,
    );
    expect(is_practice_step_done(step, build_context({}, { day: 2 }))).toBe(true);
    expect(step.progress?.(build_context({}, { timeLabel: "6:05 PM" }))).toBe(
      "The clock says 6:05 PM",
    );
  });
});

describe("practice progress", () => {
  it("records the baseline from the first snapshot only", () => {
    const recorded = record_practice_baseline(PRACTICE_START, { ...BASELINE, cash: 4_200 });
    expect(recorded?.baseline).toEqual(BASELINE);
    expect(record_practice_baseline(recorded, { cash: 1, day: 9, servedCustomers: 99 })).toBe(
      recorded,
    );
  });

  it("leaves no progress outside practice", () => {
    expect(record_practice_baseline(undefined, BASELINE)).toBeUndefined();
  });

  it("advances one step at a time and stops at the finish card", () => {
    expect(advance_practice(PRACTICE_START).stepIndex).toBe(1);
    const at_finish = { ...PRACTICE_START, stepIndex: PRACTICE_FINISH_STEP };
    expect(advance_practice(at_finish).stepIndex).toBe(PRACTICE_FINISH_STEP);
  });
});

describe("place_coach_card", () => {
  const VIEWPORT = { width: 1_440, height: 900 };
  const CARD = { width: 360, height: 240 };

  it("centres the card when nothing is ringed", () => {
    expect(place_coach_card(undefined, CARD, VIEWPORT)).toEqual({ top: 330, left: 540 });
  });

  it("puts the card below a target near the top, centred on it", () => {
    const target = { top: 10, left: 520, width: 400, height: 60 };
    expect(place_coach_card(target, CARD, VIEWPORT)).toEqual({
      top: 70 + COACH_GAP_PX,
      left: 540,
    });
  });

  it("puts the card above a target near the bottom", () => {
    const target = { top: 830, left: 500, width: 80, height: 60 };
    expect(place_coach_card(target, CARD, VIEWPORT)).toEqual({
      top: 830 - COACH_GAP_PX - CARD.height,
      left: 360,
    });
  });

  it("puts the card beside a tall rail", () => {
    const target = { top: 90, left: 10, width: 240, height: 720 };
    expect(place_coach_card(target, CARD, VIEWPORT)).toEqual({
      top: 330,
      left: 250 + COACH_GAP_PX,
    });
  });

  it("puts the card to the left of a tall panel on the right edge", () => {
    const target = { top: 90, left: 1_075, width: 355, height: 730 };
    expect(place_coach_card(target, CARD, VIEWPORT)).toEqual({
      top: 335,
      left: 1_075 - COACH_GAP_PX - CARD.width,
    });
  });

  it("leans the card against the roomier edge beside the map on a wide screen", () => {
    const map = { top: 134, left: 258, width: 816, height: 650 };
    const card = { width: 360, height: 400 };
    expect(place_coach_card(map, card, VIEWPORT)).toEqual({
      top: 259,
      left: VIEWPORT.width - card.width - COACH_MARGIN_PX,
    });
  });

  it("puts the card inside the bottom-left corner of a target too big for any side", () => {
    const target = { top: 20, left: 20, width: 1_400, height: 860 };
    expect(place_coach_card(target, CARD, VIEWPORT)).toEqual({
      top: 880 - CARD.height - COACH_GAP_PX,
      left: 20 + COACH_GAP_PX,
    });
  });

  it("covers the top of a target with no room beside it when the step asks", () => {
    const phone = { width: 390, height: 844 };
    const map = { top: 90, left: 8, width: 374, height: 630 };
    const card = { width: 366, height: 260 };
    expect(place_coach_card(map, card, phone, "top")).toEqual({
      top: 90 + COACH_GAP_PX,
      left: COACH_MARGIN_PX,
    });
    expect(find_step("place-seat").coverEdge).toBe("top");
  });

  it("keeps the card inside the viewport on a small screen", () => {
    const small = { width: 390, height: 844 };
    const card = { width: 366, height: 300 };
    const placed = place_coach_card({ top: 0, left: 0, width: 390, height: 844 }, card, small);
    expect(placed.left).toBe(COACH_MARGIN_PX);
    expect(placed.top + card.height).toBeLessThanOrEqual(small.height - COACH_MARGIN_PX);
  });
});
