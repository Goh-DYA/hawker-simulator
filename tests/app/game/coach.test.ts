// @vitest-environment jsdom
/**
 * Render tests of the practice coach in `app/game/coach.tsx`: the step card with its task, its
 * praise, its note and its buttons, the counter of the main day and the bonus steps, the ring
 * around the target, the finish cards, and the folded bar. The
 * coach's wiring into the running shell (starting, saving nothing and exiting) is covered in
 * `HawkerSimulator.test.ts`.
 */
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PracticeCoach } from "@/app/game/coach";
import {
  PRACTICE_FINISH_STEP,
  PRACTICE_LAST_STEP,
  PRACTICE_START,
  PRACTICE_STEPS,
  type PracticeContext,
  type PracticeProgress,
} from "@/app/game/practice";

/** A context on the fresh practice centre, with the Build panel on screen. */
const CONTEXT: PracticeContext = {
  snapshot: {
    activeDishVariants: {},
    accessPoints: [],
    buildTool: "select",
    cash: 4_200,
    day: 1,
    isOpen: false,
    neighbourhood: undefined,
    placedObjectCount: 14,
    placedStalls: [],
    routeGuidePoints: [],
    selectedBuildId: undefined,
    selectedCustomerNutrition: undefined,
    selectedObjectId: undefined,
    servedCustomers: 0,
    speed: 1,
    stallMenus: {},
    timeLabel: "10:30 AM",
  },
  baseline: undefined,
  stepBaselines: {},
  movesCompleted: 0,
  completedStepIds: [],
  panel: "build",
  isPanelVisible: true,
  hasOpenDialog: false,
  isCompact: false,
};

/**
 * @param id - A practice step ID.
 * @returns The index of that step.
 */
function step_index(id: string): number {
  return PRACTICE_STEPS.findIndex((step) => step.id === id);
}

/**
 * Render the coach with recorded callbacks.
 *
 * @param progress - Where the player is.
 * @param context - What the checks read.
 * @returns The coach's container and the callbacks.
 */
function render_coach(progress: PracticeProgress, context: PracticeContext = CONTEXT) {
  const callbacks = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkipHidden: vi.fn(),
    onCollapsedChange: vi.fn(),
    onExit: vi.fn(),
  };
  const { container } = render(createElement(PracticeCoach, { progress, context, ...callbacks }));
  return { container, callbacks };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("PracticeCoach", () => {
  it("opens on the welcome card, counting the steps", () => {
    const { container } = render_coach(PRACTICE_START);
    const coach = within(container).getByRole("complementary", { name: "Practice guide" });
    expect(within(coach).getByRole("heading").textContent).toBe("Welcome to your practice day!");
    expect(coach.textContent).toContain(`Step 1 of ${PRACTICE_FINISH_STEP + 1}`);
    expect(within(coach).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
  });

  it("counts the bonus steps on their own", () => {
    const { container } = render_coach({ ...PRACTICE_START, stepIndex: PRACTICE_FINISH_STEP + 1 });
    const coach = within(container).getByRole("complementary", { name: "Practice guide" });
    const bar = within(coach).getByRole("progressbar");
    expect([
      coach.querySelector(".practice-count")?.textContent,
      bar.getAttribute("aria-valuenow"),
      bar.getAttribute("aria-valuemax"),
    ]).toEqual(["Bonus step 1 of 3", "1", "3"]);
  });

  it("lays the card out as a lead-in, the visit's stages and icon points", () => {
    const { container } = render_coach({
      ...PRACTICE_START,
      stepIndex: step_index("watch-guests"),
    });
    const coach = within(container).getByRole("complementary", { name: "Practice guide" });
    const flow = within(coach).getByRole("list", { name: "A guest's visit" });
    expect({
      intro: coach.querySelector("h2 + p")?.textContent,
      stages: Array.from(flow.children, (stage) => stage.textContent),
      points: Array.from(coach.querySelectorAll(".guide-points li"), (item) => item.textContent),
    }).toEqual({
      intro: "Watch what each guest does:",
      stages: ["Pick a stall", "Line up", "Get food", "Sit and eat", "Go home"],
      points: [
        "💬The bubbles over their heads show what they are doing.",
        "⚙️Settings has a key that explains every bubble.",
      ],
    });
  });

  it("offers Back on every card but the first", () => {
    const first = render_coach(PRACTICE_START);
    const has_back_first = within(first.container).queryByRole("button", { name: "Back" }) !== null;
    cleanup();
    const later = render_coach({ ...PRACTICE_START, stepIndex: step_index("move") });
    fireEvent.click(within(later.container).getByRole("button", { name: "Back" }));
    expect([has_back_first, later.callbacks.onBack.mock.calls.length]).toEqual([false, 1]);
  });

  it("offers Back on the finish card too", () => {
    const { container, callbacks } = render_coach({
      ...PRACTICE_START,
      stepIndex: PRACTICE_FINISH_STEP,
    });
    fireEvent.click(within(container).getByRole("button", { name: "Back" }));
    expect(callbacks.onBack).toHaveBeenCalledTimes(1);
  });

  it("moves on from a read-only card with its primary button", () => {
    const { container, callbacks } = render_coach(PRACTICE_START);
    fireEvent.click(within(container).getByRole("button", { name: "Let's go" }));
    expect(callbacks.onNext).toHaveBeenCalledTimes(1);
  });

  it("shows the task and offers a skip until the task is done", () => {
    const { container, callbacks } = render_coach({
      ...PRACTICE_START,
      stepIndex: step_index("open-centre"),
    });
    const coach = within(container).getByRole("complementary", { name: "Practice guide" });
    expect(coach.textContent).toContain("Your turn: Press the green Open centre button.");
    expect(coach.getAttribute("data-done")).toBe("false");
    fireEvent.click(within(coach).getByRole("button", { name: "Skip this step" }));
    expect(callbacks.onNext).toHaveBeenCalledTimes(1);
  });

  it("offers no skip on the end of the day, which day 2 needs", () => {
    const { container } = render_coach({ ...PRACTICE_START, stepIndex: step_index("end-of-day") });
    const coach = within(container).getByRole("complementary", { name: "Practice guide" });
    expect(
      within(coach)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["–", "Show tips", "← Back", "Exit practice"]);
  });

  it("shows the Service Review's tip on the next morning", () => {
    const { container } = render_coach(
      { ...PRACTICE_START, stepIndex: step_index("new-day") },
      {
        ...CONTEXT,
        snapshot: {
          ...CONTEXT.snapshot,
          neighbourhood: {
            lastReport: {
              focusTip: { factor: "comfort", label: "Seating", score: 0, action: "Add seats." },
            },
          } as unknown as PracticeContext["snapshot"]["neighbourhood"],
        },
      },
    );
    expect(container.querySelector(".practice-note")?.textContent).toBe("Seating: Add seats.");
  });

  it("praises a finished task and offers Next", () => {
    const { container } = render_coach(
      { ...PRACTICE_START, stepIndex: step_index("open-centre") },
      { ...CONTEXT, snapshot: { ...CONTEXT.snapshot, isOpen: true } },
    );
    const coach = within(container).getByRole("complementary", { name: "Practice guide" });
    expect(coach.getAttribute("data-done")).toBe("true");
    expect(coach.textContent).toContain("The shutters are up!");
    expect(within(coach).queryByRole("button", { name: "Skip this step" })).toBeNull();
    expect(within(coach).getByRole("button", { name: "Next" })).toBeDefined();
  });

  it("rings the step's target", () => {
    const toggle = document.createElement("button");
    toggle.dataset.testid = "toggle-centre";
    toggle.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 900, y: 780, width: 130, height: 40 });
    document.body.append(toggle);
    const { container } = render_coach({
      ...PRACTICE_START,
      stepIndex: step_index("open-centre"),
    });
    const ring = container.querySelector<HTMLElement>(".practice-ring");
    expect(ring?.style.cssText).toBe("top: 774px; left: 894px; width: 142px; height: 52px;");
  });

  it("measures again while the step shows, and stops when it unmounts", () => {
    vi.useFakeTimers();
    try {
      const toggle = document.createElement("button");
      toggle.dataset.testid = "toggle-centre";
      let top = 780;
      toggle.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 900, y: top, width: 130, height: 40 });
      document.body.append(toggle);
      const { container } = render_coach({
        ...PRACTICE_START,
        stepIndex: step_index("open-centre"),
      });
      top = 700;
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(container.querySelector<HTMLElement>(".practice-ring")?.style.top).toBe("694px");
      cleanup();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers the way home, more practice or the bonus tools on the finish card", () => {
    const { container, callbacks } = render_coach({
      ...PRACTICE_START,
      stepIndex: PRACTICE_FINISH_STEP,
    });
    fireEvent.click(within(container).getByRole("button", { name: "Go to my centre" }));
    fireEvent.click(within(container).getByRole("button", { name: "Keep practising" }));
    fireEvent.click(within(container).getByRole("button", { name: "Bonus tools" }));
    expect(callbacks.onExit).toHaveBeenCalledTimes(1);
    expect(callbacks.onCollapsedChange).toHaveBeenCalledWith(true);
    expect(callbacks.onNext).toHaveBeenCalledTimes(1);
    expect(within(container).queryByRole("button", { name: "Skip this step" })).toBeNull();
  });

  it("ends the bonus steps with the way home and no more bonus", () => {
    const { container } = render_coach({ ...PRACTICE_START, stepIndex: PRACTICE_LAST_STEP });
    expect(
      within(container)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["–", "← Back", "Keep practising", "Go to my centre →"]);
  });

  it("exits from any step and folds down from its hide button", () => {
    const { container, callbacks } = render_coach({ ...PRACTICE_START, stepIndex: 3 });
    fireEvent.click(within(container).getByRole("button", { name: "Exit practice" }));
    fireEvent.click(within(container).getByRole("button", { name: "Hide the practice guide" }));
    expect(callbacks.onExit).toHaveBeenCalledTimes(1);
    expect(callbacks.onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it("renders nothing while folded away, leaving its controls to the action strip", () => {
    const { container } = render_coach({ ...PRACTICE_START, isCollapsed: true });
    expect(container.innerHTML).toBe("");
  });

  it("sends focus to the next step's heading when the player moves on from the card", () => {
    const callbacks = {
      onNext: vi.fn(),
      onBack: vi.fn(),
      onSkipHidden: vi.fn(),
      onCollapsedChange: vi.fn(),
      onExit: vi.fn(),
    };
    const { container, rerender } = render(
      createElement(PracticeCoach, { progress: PRACTICE_START, context: CONTEXT, ...callbacks }),
    );
    const next = within(container).getByRole("button", { name: "Let's go" });
    next.focus();
    fireEvent.click(next);
    rerender(
      createElement(PracticeCoach, {
        progress: { ...PRACTICE_START, stepIndex: 1 },
        context: CONTEXT,
        ...callbacks,
      }),
    );
    expect(document.activeElement?.textContent).toBe("Your cash and your hearts");
  });

  it("gives its heading focus when it opens again and focus has fallen to the page", () => {
    const callbacks = {
      onNext: vi.fn(),
      onBack: vi.fn(),
      onSkipHidden: vi.fn(),
      onCollapsedChange: vi.fn(),
      onExit: vi.fn(),
    };
    const folded = { ...PRACTICE_START, isCollapsed: true };
    const { rerender } = render(
      createElement(PracticeCoach, { progress: folded, context: CONTEXT, ...callbacks }),
    );
    rerender(
      createElement(PracticeCoach, { progress: PRACTICE_START, context: CONTEXT, ...callbacks }),
    );
    expect(document.activeElement?.textContent).toBe("Welcome to your practice day!");
  });

  it("leaves focus alone when the step changes while the player is elsewhere", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const callbacks = {
      onNext: vi.fn(),
      onBack: vi.fn(),
      onSkipHidden: vi.fn(),
      onCollapsedChange: vi.fn(),
      onExit: vi.fn(),
    };
    const { rerender } = render(
      createElement(PracticeCoach, { progress: PRACTICE_START, context: CONTEXT, ...callbacks }),
    );
    rerender(
      createElement(PracticeCoach, {
        progress: { ...PRACTICE_START, stepIndex: 1 },
        context: CONTEXT,
        ...callbacks,
      }),
    );
    expect(document.activeElement).toBe(outside);
  });

  it("folds a task step's tips behind a toggle that phones show", () => {
    const { container } = render_coach({ ...PRACTICE_START, stepIndex: step_index("place-seat") });
    const coach = within(container).getByRole("complementary", { name: "Practice guide" });
    const toggle = within(coach).getByRole("button", { name: "Show tips" });
    expect([coach.dataset.tips, toggle.getAttribute("aria-expanded")]).toEqual(["closed", "false"]);
    fireEvent.click(toggle);
    expect([
      coach.dataset.tips,
      within(coach).getByRole("button", { name: "Hide tips" }).getAttribute("aria-expanded"),
    ]).toEqual(["open", "true"]);
  });

  it("keeps a read-only step's points in view, with no tips toggle", () => {
    const { container } = render_coach({ ...PRACTICE_START, stepIndex: step_index("money") });
    const coach = within(container).getByRole("complementary", { name: "Practice guide" });
    expect([
      coach.dataset.tips,
      within(coach).queryByRole("button", { name: "Show tips" }),
    ]).toEqual([undefined, null]);
  });

  it("skips a step whose target the browser hides, once", () => {
    const stats = document.createElement("dl");
    stats.className = "hud-stats";
    stats.checkVisibility = () => false;
    document.body.append(stats);
    const { callbacks } = render_coach({ ...PRACTICE_START, stepIndex: step_index("money") });
    expect([callbacks.onSkipHidden.mock.calls.length, callbacks.onNext.mock.calls.length]).toEqual([
      1, 0,
    ]);
  });

  it("keeps a step whose target is on screen", () => {
    const stats = document.createElement("dl");
    stats.className = "hud-stats";
    stats.checkVisibility = () => true;
    document.body.append(stats);
    const { callbacks } = render_coach({ ...PRACTICE_START, stepIndex: step_index("money") });
    expect(callbacks.onSkipHidden).not.toHaveBeenCalled();
  });
});
