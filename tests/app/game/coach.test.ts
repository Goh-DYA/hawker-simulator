// @vitest-environment jsdom
/**
 * Render tests of the practice coach in `app/game/coach.tsx`: the step card with its task, its
 * praise and its buttons, the ring around the target, the finish card, and the folded bar. The
 * coach's wiring into the running shell (starting, saving nothing and exiting) is covered in
 * `HawkerSimulator.test.ts`.
 */
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PracticeCoach } from "@/app/game/coach";
import {
  PRACTICE_FINISH_STEP,
  PRACTICE_START,
  PRACTICE_STEPS,
  type PracticeContext,
  type PracticeProgress,
} from "@/app/game/practice";

/** A context on the fresh practice centre, with the Build panel on screen. */
const CONTEXT: PracticeContext = {
  snapshot: {
    buildTool: "select",
    cash: 4_200,
    day: 1,
    isOpen: false,
    selectedCustomerNutrition: undefined,
    servedCustomers: 0,
    speed: 1,
    timeLabel: "10:30 AM",
  },
  baseline: { cash: 4_200, day: 1, servedCustomers: 0 },
  panel: "build",
  isPanelVisible: true,
  hasOpenDialog: false,
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
  const callbacks = { onNext: vi.fn(), onCollapsedChange: vi.fn(), onExit: vi.fn() };
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
    expect(coach.textContent).toContain(`Step 1 of ${PRACTICE_STEPS.length}`);
    expect(within(coach).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
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
      points: ["💬The bubbles over their heads show what they are doing."],
    });
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

  it("offers the way home, or more practice, on the finish card", () => {
    const { container, callbacks } = render_coach({
      ...PRACTICE_START,
      stepIndex: PRACTICE_FINISH_STEP,
    });
    fireEvent.click(within(container).getByRole("button", { name: "Go to my centre" }));
    fireEvent.click(within(container).getByRole("button", { name: "Keep practising" }));
    expect(callbacks.onExit).toHaveBeenCalledTimes(1);
    expect(callbacks.onCollapsedChange).toHaveBeenCalledWith(true);
    expect(within(container).queryByRole("button", { name: "Skip this step" })).toBeNull();
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
    const callbacks = { onNext: vi.fn(), onCollapsedChange: vi.fn(), onExit: vi.fn() };
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
    expect(document.activeElement?.textContent).toBe("Your cash and your fans");
  });

  it("leaves focus alone when the step changes while the player is elsewhere", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const callbacks = { onNext: vi.fn(), onCollapsedChange: vi.fn(), onExit: vi.fn() };
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
    expect(callbacks.onNext).toHaveBeenCalledTimes(1);
  });

  it("keeps a step whose target is on screen", () => {
    const stats = document.createElement("dl");
    stats.className = "hud-stats";
    stats.checkVisibility = () => true;
    document.body.append(stats);
    const { callbacks } = render_coach({ ...PRACTICE_START, stepIndex: step_index("money") });
    expect(callbacks.onNext).not.toHaveBeenCalled();
  });
});
