/**
 * Tests of the guided practice day's pure parts in `app/game/practice.ts`: the step list, the
 * check behind each task, the baseline, move counting and step bookkeeping (forward and back,
 * passing over a step whose required step was skipped), the counter of the main day and the
 * bonus steps, and the placement of the coach card beside the element it rings.
 */
import { describe, expect, it } from "vitest";

import {
  COACH_GAP_PX,
  COACH_MARGIN_PX,
  get_practice_position,
  is_practice_step_done,
  move_practice,
  observe_practice_snapshot,
  place_coach_card,
  PRACTICE_FINISH_STEP,
  PRACTICE_GUESTS_TO_SERVE,
  PRACTICE_LAST_STEP,
  PRACTICE_START,
  PRACTICE_STEPS,
  type PracticeBaseline,
  type PracticeContext,
  type PracticeProgress,
  type PracticeSnapshot,
  type PracticeStep,
} from "@/app/game/practice";
import type { RuntimeStallSummary } from "@/src/game/runtime/types";

/** A starter stall as the snapshot lists it. */
const SUNRISE_ROOST: RuntimeStallSummary = {
  objectId: "starter-1",
  definitionId: "stall.sunrise-roost",
  name: "Sunrise Roost",
  queueCount: 0,
  queueDirection: "south",
  customQueue: false,
  open: false,
};

/** A snapshot of the fresh practice centre before the player does anything. */
const FRESH_SNAPSHOT: PracticeSnapshot = {
  activeDishVariants: { "dish.nasi-lemak": "nasi-lemak-chicken-wing" },
  accessPoints: [
    { id: "entrance-1", kind: "entrance", position: { x: 0, y: 7 } },
    { id: "exit-1", kind: "exit", position: { x: 23, y: 7 } },
  ],
  buildTool: "select",
  cash: 4_200,
  day: 1,
  isOpen: false,
  neighbourhood: undefined,
  placedObjectCount: 14,
  placedStalls: [SUNRISE_ROOST],
  routeGuidePoints: [],
  selectedBuildId: undefined,
  selectedCustomerNutrition: undefined,
  selectedObjectId: undefined,
  servedCustomers: 0,
  speed: 1,
  stallMenus: { "stall.sunrise-roost": ["dish.poached-chicken-rice"] },
  timeLabel: "10:30 AM",
};

/** The fresh practice centre's figures. */
const BASELINE: PracticeBaseline = {
  cash: 4_200,
  day: 1,
  servedCustomers: 0,
  placedStallCount: 1,
  placedObjectCount: 14,
  accessPointCount: 2,
  routeGuideCount: 0,
  movesCompleted: 0,
  stallMenus: FRESH_SNAPSHOT.stallMenus,
  activeDishVariants: FRESH_SNAPSHOT.activeDishVariants,
};

/**
 * Build a practice context on the fresh centre with some fields changed. Every step's baseline
 * is the fresh centre's unless `changes` gives others.
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
    stepBaselines: Object.fromEntries(PRACTICE_STEPS.map((step) => [step.id, BASELINE])),
    movesCompleted: 0,
    completedStepIds: [],
    panel: "build",
    isPanelVisible: true,
    hasOpenDialog: false,
    isCompact: false,
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
  it("looks around, opens up, fixes the seating, ends the day and grows on day 2", () => {
    expect(PRACTICE_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "money",
      "clock",
      "map",
      "open-centre",
      "watch-guests",
      "inspect-guest",
      "today",
      "insights",
      "seats",
      "pick-seat",
      "place-seat",
      "move",
      "remove",
      "undo",
      "dishes",
      "fast-forward",
      "end-of-day",
      "new-day",
      "pick-stall",
      "place-stall",
      "menu",
      "recipe",
      "finish",
      "access",
      "route",
      "bonus-finish",
    ]);
    expect([PRACTICE_STEPS[PRACTICE_FINISH_STEP]?.id, PRACTICE_LAST_STEP]).toEqual([
      "finish",
      PRACTICE_STEPS.length - 1,
    ]);
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

  it("teaches every map tool: Select, Move and Remove on day 1, Access and Route as bonus steps", () => {
    const ringed = PRACTICE_STEPS.flatMap((step) => {
      const target = step.target?.(build_context({}, { buildTool: "place" }));
      return target?.includes("tool-") ? [target.replace(/.*tool-(\w+).*/, "$1")] : [];
    });
    expect(ringed).toEqual(["select", "move", "remove", "access", "route"]);
  });

  it("clears the phone sheet off the map for every card played on the map", () => {
    expect(PRACTICE_STEPS.filter((step) => step.isMapNeeded).map((step) => step.id)).toEqual([
      "map",
      "open-centre",
      "watch-guests",
      "place-seat",
      "move",
      "remove",
      "end-of-day",
      "place-stall",
      "access",
      "route",
    ]);
  });

  it("lets the player skip any task but the end of the day, which day 2 needs", () => {
    expect(PRACTICE_STEPS.filter((step) => step.isRequired).map((step) => step.id)).toEqual([
      "end-of-day",
    ]);
  });

  it("pauses the game for building, on the next morning and on the finish card only", () => {
    expect(PRACTICE_STEPS.filter((step) => step.pausesOnEnter).map((step) => step.id)).toEqual([
      "seats",
      "new-day",
      "finish",
    ]);
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
    for (const id of ["welcome", "today", "seats", "new-day", "finish", "bonus-finish"]) {
      expect({ id, done: is_practice_step_done(find_step(id), build_context()) }).toEqual({
        id,
        done: true,
      });
    }
  });

  it("finishes picking a stool once the place tool is on", () => {
    const step = find_step("pick-seat");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { buildTool: "place" }))).toBe(true);
  });

  it("finishes placing once cash drops below the cash as the stool was picked", () => {
    const step = find_step("place-seat");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { cash: 4_165 }))).toBe(true);
    expect(is_practice_step_done(step, build_context({ stepBaselines: {} }, { cash: 4_165 }))).toBe(
      false,
    );
  });

  it("finishes moving once an object is put down and the Select tool is back", () => {
    const step = find_step("move");
    expect(step.target?.(build_context())).toBe('[data-coach="tool-move"]');
    expect(step.target?.(build_context({}, { buildTool: "move" }))).toBe(".world-frame");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(
      is_practice_step_done(step, build_context({ movesCompleted: 1 }, { buildTool: "move" })),
    ).toBe(false);
    expect(is_practice_step_done(step, build_context({ movesCompleted: 1 }))).toBe(true);
  });

  it("rings the map, not the tool, once a tool's task is done", () => {
    const step = find_step("remove");
    expect([
      step.target?.(build_context()),
      step.target?.(build_context({ completedStepIds: ["remove"] })),
    ]).toEqual(['[data-coach="tool-remove"]', ".world-frame"]);
  });

  it("finishes removing once an object is gone and the Select tool is back, not on sales", () => {
    const step = find_step("remove");
    expect([
      is_practice_step_done(step, build_context({}, { cash: 4_300, isOpen: true })),
      is_practice_step_done(
        step,
        build_context({}, { placedObjectCount: 13, buildTool: "remove" }),
      ),
      is_practice_step_done(step, build_context({}, { placedObjectCount: 13 })),
    ]).toEqual([false, false, true]);
  });

  it("finishes undoing once an object comes back", () => {
    const step = find_step("undo");
    expect([
      step.isSkippedWhenHidden,
      is_practice_step_done(step, build_context({}, { placedObjectCount: 13 })),
      is_practice_step_done(step, build_context({}, { placedObjectCount: 15 })),
    ]).toEqual([true, false, true]);
  });

  it("keeps a step done once the player finished it and moved on", () => {
    const step = find_step("pick-seat");
    expect([
      is_practice_step_done(step, build_context()),
      is_practice_step_done(step, build_context({ completedStepIds: ["pick-seat"] })),
    ]).toEqual([false, true]);
  });

  it("finishes adding a door once there is another access point and the editor is closed", () => {
    const step = find_step("access");
    const with_door = [
      ...FRESH_SNAPSHOT.accessPoints,
      { id: "entrance-3", kind: "entrance" as const, position: { x: 0, y: 3 } },
    ];
    expect(step.target?.(build_context())).toBe("[data-coach='tool-access']");
    expect(step.target?.(build_context({}, { buildTool: "access" }))).toBe(".tool-segment");
    expect(
      is_practice_step_done(
        step,
        build_context({}, { accessPoints: with_door, buildTool: "access" }),
      ),
    ).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { accessPoints: with_door }))).toBe(true);
  });

  it("finishes painting once a route tile is added and the editor is closed", () => {
    const step = find_step("route");
    const painted = [{ x: 6, y: 6 }];
    expect(
      is_practice_step_done(
        step,
        build_context({}, { routeGuidePoints: painted, buildTool: "route" }),
      ),
    ).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { routeGuidePoints: painted }))).toBe(
      true,
    );
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

  it("rings the goals rail, or the Focus tab on a narrow screen", () => {
    const step = find_step("today");
    expect([
      step.target?.(build_context()),
      step.target?.(build_context({ isCompact: true })),
    ]).toEqual([".left-rail", "[data-coach='dock-focus']"]);
  });

  it("finishes inspecting once a guest is selected, ringing Select until it is on", () => {
    const step = find_step("inspect-guest");
    expect([
      step.target?.(build_context({}, { buildTool: "place" })),
      step.target?.(build_context()),
    ]).toEqual(["[data-coach='tool-select']", ".world-frame"]);
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

  it("quotes the Service Review's tip on the next morning", () => {
    const step = find_step("new-day");
    const tip = { factor: "comfort", label: "Seating", score: 0, action: "Add tables." };
    const with_tip = build_context(
      {},
      {
        neighbourhood: {
          lastReport: { focusTip: tip },
        } as unknown as PracticeSnapshot["neighbourhood"],
      },
    );
    expect([step.note?.(with_tip), step.note?.(build_context())]).toEqual([
      "Seating: Add tables.",
      "Nothing! Your guests had a good day.",
    ]);
  });

  it("finishes picking a stall only for a stall, not a placeable", () => {
    const step = find_step("pick-stall");
    expect(
      is_practice_step_done(
        step,
        build_context({}, { buildTool: "place", selectedBuildId: "placeable.stacking-stool" }),
      ),
    ).toBe(false);
    expect(
      is_practice_step_done(
        step,
        build_context({}, { buildTool: "place", selectedBuildId: "stall.kopi-canopy" }),
      ),
    ).toBe(true);
  });

  it("finishes placing a stall once there is another stall", () => {
    const step = find_step("place-stall");
    const two_stalls = [SUNRISE_ROOST, { ...SUNRISE_ROOST, objectId: "placed-9" }];
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(is_practice_step_done(step, build_context({}, { placedStalls: two_stalls }))).toBe(true);
  });

  it("finishes the menu step once any stall's menu changes", () => {
    const step = find_step("menu");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(
      is_practice_step_done(
        step,
        build_context(
          {},
          {
            stallMenus: {
              "stall.sunrise-roost": ["dish.poached-chicken-rice", "dish.roast-chicken-rice"],
            },
          },
        ),
      ),
    ).toBe(true);
  });

  it("finishes the recipe step once a dish's active recipe changes", () => {
    const step = find_step("recipe");
    expect(is_practice_step_done(step, build_context())).toBe(false);
    expect(
      is_practice_step_done(
        step,
        build_context(
          {},
          { activeDishVariants: { "dish.nasi-lemak": "nasi-lemak-chicken-cutlet" } },
        ),
      ),
    ).toBe(true);
  });
});

describe("practice progress", () => {
  /** A snapshot of the fresh centre with the Move tool holding the starter table. */
  const HOLDING: Partial<PracticeSnapshot> = { buildTool: "move", selectedObjectId: "starter-3" };

  /**
   * @param changes - The snapshot fields to change from the fresh centre.
   * @returns The snapshot `observe_practice_snapshot` reads.
   */
  function seen(changes: Partial<PracticeSnapshot> = {}) {
    return { ...FRESH_SNAPSHOT, ...changes };
  }

  it("records the starting and first step's baselines from the first snapshot only", () => {
    const first = observe_practice_snapshot(PRACTICE_START, seen());
    const later = observe_practice_snapshot(first, seen({ cash: 1, day: 9 }));
    expect([first?.baseline, first?.stepBaselines.welcome, later?.baseline]).toEqual([
      BASELINE,
      BASELINE,
      BASELINE,
    ]);
  });

  it("leaves no progress outside practice", () => {
    expect(observe_practice_snapshot(undefined, seen())).toBeUndefined();
  });

  it("counts a move when the Move tool puts its object down, but not when it is cancelled", () => {
    let progress: PracticeProgress | undefined = PRACTICE_START;
    for (const snapshot of [seen(HOLDING), seen({ buildTool: "move" })]) {
      progress = observe_practice_snapshot(progress, snapshot);
    }
    const moved = progress;
    for (const snapshot of [seen(HOLDING), seen()]) {
      progress = observe_practice_snapshot(progress, snapshot);
    }
    expect([moved?.movesCompleted, progress?.movesCompleted, progress?.isMoveHeld]).toEqual([
      1,
      1,
      false,
    ]);
  });

  it("moves forward and back, staying within the steps, and remembers the direction", () => {
    const forward = move_practice(PRACTICE_START, 1, seen(), true);
    const back = move_practice(forward, -1, seen(), true);
    const before_first = move_practice(PRACTICE_START, -1, seen(), true);
    const into_bonus = move_practice(
      { ...PRACTICE_START, stepIndex: PRACTICE_FINISH_STEP },
      1,
      seen(),
      true,
    );
    const at_end = move_practice(
      { ...PRACTICE_START, stepIndex: PRACTICE_LAST_STEP },
      1,
      seen(),
      true,
    );
    expect([
      [forward.stepIndex, forward.direction],
      [back.stepIndex, back.direction],
      before_first.stepIndex,
      into_bonus.stepIndex,
      at_end.stepIndex,
    ]).toEqual([[1, 1], [0, -1], 0, PRACTICE_FINISH_STEP + 1, PRACTICE_LAST_STEP]);
  });

  it("passes over putting an item down, either way, when picking it was skipped", () => {
    const pick = PRACTICE_STEPS.findIndex((step) => step.id === "pick-seat");
    const on_pick = { ...PRACTICE_START, stepIndex: pick };
    const skipped = move_practice(on_pick, 1, seen(), false);
    const picked = move_practice(on_pick, 1, seen(), true);
    const back = move_practice(skipped, -1, seen(), true);
    expect([
      PRACTICE_STEPS[skipped.stepIndex]?.id,
      PRACTICE_STEPS[picked.stepIndex]?.id,
      PRACTICE_STEPS[back.stepIndex]?.id,
    ]).toEqual(["move", "place-seat", "pick-seat"]);
  });

  it("remembers a step as done only when it is done as the player leaves it", () => {
    const done = move_practice(PRACTICE_START, 1, seen(), true);
    const skipped = move_practice(done, 1, seen(), false);
    expect([done.completedStepIds, skipped.completedStepIds]).toEqual([["welcome"], ["welcome"]]);
  });

  it("records a step's baseline when it is first shown and keeps it when the player comes back", () => {
    const shown = move_practice(PRACTICE_START, 1, seen({ cash: 4_000 }), true);
    const back = move_practice(shown, -1, seen(), true);
    const again = move_practice(back, 1, seen({ cash: 3_000 }), true);
    expect([shown.stepBaselines.money?.cash, again.stepBaselines.money?.cash]).toEqual([
      4_000, 4_000,
    ]);
  });
});

describe("get_practice_position", () => {
  it("counts the main day up to the finish card, then the bonus steps on their own", () => {
    expect([
      get_practice_position(0),
      get_practice_position(PRACTICE_FINISH_STEP),
      get_practice_position(PRACTICE_FINISH_STEP + 1),
      get_practice_position(PRACTICE_LAST_STEP),
    ]).toEqual([
      { label: "Step", number: 1, total: PRACTICE_FINISH_STEP + 1 },
      { label: "Step", number: PRACTICE_FINISH_STEP + 1, total: PRACTICE_FINISH_STEP + 1 },
      { label: "Bonus step", number: 1, total: 3 },
      { label: "Bonus step", number: 3, total: 3 },
    ]);
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
