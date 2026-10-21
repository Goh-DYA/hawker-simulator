/**
 * The guided practice day: the coach's steps, the checks that tell when the player has done
 * each one, and the placement of the coach card beside the element it points at.
 *
 * The practice day runs on a throwaway centre. The shell keeps the player's real centre in
 * memory, swaps in a fresh one, stops every save while practice lasts, and loads the real centre
 * back when the player exits. This module holds only the pure parts: the step copy is written
 * for young players who are new to management games, so each card is a short lead-in line, a few
 * one-sentence points with an icon each and, where it helps, a row of stages, and each check is a function of the latest snapshot and the open panel, so the coach
 * needs no state of its own beyond the step index and the snapshot taken as practice began.
 */
import type { RuntimeSnapshot } from "@/src/game/runtime/types";
import type { Panel } from "./display";
import type { GuidePoint } from "./guide";

/** The snapshot fields the practice checks read. */
export type PracticeSnapshot = Pick<
  RuntimeSnapshot,
  | "buildTool"
  | "cash"
  | "day"
  | "isOpen"
  | "selectedCustomerNutrition"
  | "servedCustomers"
  | "speed"
  | "timeLabel"
>;

/** The figures of the fresh practice centre that later checks compare against. */
export type PracticeBaseline = Pick<RuntimeSnapshot, "cash" | "day" | "servedCustomers">;

/** What a practice check sees: the latest snapshot, the open panel and the dialogs. */
export interface PracticeContext {
  /** The latest runtime snapshot. */
  readonly snapshot: PracticeSnapshot;
  /** The practice centre's figures as practice began; undefined until its first snapshot. */
  readonly baseline: PracticeBaseline | undefined;
  /** The panel the management area shows. */
  readonly panel: Panel;
  /** Whether that panel is on screen (always on wide screens, only as a sheet on narrow ones). */
  readonly isPanelVisible: boolean;
  /** Whether a modal dialog, such as the Service Review, is open. */
  readonly hasOpenDialog: boolean;
}

/** The edge of a target that the coach card covers when there is no room beside it. */
export type CoverEdge = "top" | "bottom";

/** One coach card of the practice day. */
export interface PracticeStep {
  /** A stable name for the step. */
  readonly id: string;
  /** The card's heading. */
  readonly title: string;
  /** A short lead-in line, if the points need one. */
  readonly intro?: string;
  /** What the highlighted part of the screen is for, one short point per line. */
  readonly points?: readonly GuidePoint[];
  /** A sequence to show as chips joined by arrows, such as a guest's visit, and its name. */
  readonly flow?: { readonly label: string; readonly stages: readonly string[] };
  /**
   * Whether the coach skips the step when its target is hidden, as some HUD parts are on phones;
   * absent counts as false.
   */
  readonly isSkippedWhenHidden?: boolean;
  /**
   * Which edge of a target with no room beside it (the map on a phone) the card covers; absent
   * counts as the bottom. Placing a stool covers the top, because the tables sit lower down.
   */
  readonly coverEdge?: CoverEdge;
  /** What the player should do now; read-only steps have none and move on with Next. */
  readonly task?: string;
  /** The praise shown once the task is done. */
  readonly doneMessage?: string;
  /**
   * Pick the element to ring.
   *
   * @param context - The practice context.
   * @returns A CSS selector, or undefined to ring nothing and centre the card.
   */
  readonly target?: (context: PracticeContext) => string | undefined;
  /**
   * Decide whether the player has done the task.
   *
   * @param context - The practice context.
   * @returns Whether the task is done.
   */
  readonly isDone?: (context: PracticeContext) => boolean;
  /**
   * Describe the progress towards the task.
   *
   * @param context - The practice context.
   * @returns A short progress line, or undefined for none.
   */
  readonly progress?: (context: PracticeContext) => string | undefined;
}

/** The notice shown when the player tries to save, load or reset during practice. */
export const PRACTICE_NOT_SAVED_MESSAGE =
  "This is a practice day, so nothing is saved. Press Exit practice to go back to your own centre.";

/** How many guests the player watches being served before moving on. */
export const PRACTICE_GUESTS_TO_SERVE = 3;

/** The simulation speed, at or above which the fast-forward step counts as done. */
export const PRACTICE_FAST_SPEED = 4;

/**
 * Ring a dock tab until its panel is on screen, then ring the panel itself.
 *
 * @param panel - The panel the step needs.
 * @returns The step's target picker.
 */
function target_panel(panel: Panel): (context: PracticeContext) => string {
  return (context) =>
    context.panel === panel && context.isPanelVisible
      ? ".catalogue-panel"
      : `[data-coach="dock-${panel}"]`;
}

/**
 * The practice day's steps, in order. The last step is the finish card, which offers the way
 * back to the player's own centre.
 */
export const PRACTICE_STEPS: readonly PracticeStep[] = [
  {
    id: "welcome",
    title: "Welcome to your practice day!",
    intro: "This is a pretend hawker centre, just for practising.",
    points: [
      { icon: "🧪", text: "Nothing here is saved, so try anything!" },
      { icon: "🏠", text: "Your real centre is waiting safely for you." },
      { icon: "✨", text: "Follow the glowing ring to see where to look." },
      { icon: "🚪", text: "Press Exit practice whenever you like." },
    ],
  },
  {
    id: "money",
    title: "Your cash and your fans",
    points: [
      { icon: "💵", text: "Cash is your money. You earn it when guests buy food." },
      { icon: "♥", text: "The heart is your reputation. It grows when guests leave happy." },
      { icon: "⭐", text: "Your level goes up as you finish goals." },
    ],
    target: () => ".hud-stats",
    isSkippedWhenHidden: true,
  },
  {
    id: "clock",
    title: "The clock and the speed buttons",
    points: [
      { icon: "🕥", text: "A day starts at 10:30 AM and ends in the evening." },
      { icon: "⏸", text: "Pause stops the game." },
      { icon: "⏩", text: "The × buttons, like 10×, make time go faster." },
    ],
    target: () => ".day-controls",
  },
  {
    id: "today",
    title: "Today and your goals",
    points: [
      { icon: "📅", text: "The top card shows when the lunch and dinner crowds come." },
      { icon: "🎯", text: "Below it are today's goals. Finish them to win cash and level up." },
    ],
    target: () => ".left-rail",
    isSkippedWhenHidden: true,
  },
  {
    id: "map",
    title: "Your hawker centre",
    points: [
      { icon: "🏪", text: "The two shops at the top are your food stalls." },
      { icon: "✋", text: "Drag the floor to look around." },
      { icon: "🔍", text: "Press + and − to zoom in and out." },
      { icon: "◎", text: "This button brings the map back to the middle." },
    ],
    target: () => ".world-frame",
  },
  {
    id: "pick-seat",
    title: "Buy a stool",
    intro: "Guests need somewhere to sit. Let's buy one more stool.",
    points: [{ icon: "🔎", text: "Tip: type “stool” in the search box to find it fast." }],
    task: "Find the Stacking Stool ($35) in Build and click it.",
    doneMessage: "You picked something to build!",
    target: target_panel("build"),
    isDone: ({ snapshot }) => snapshot.buildTool === "place",
  },
  {
    id: "place-seat",
    title: "Put it down",
    points: [
      { icon: "👆", text: "Move over the floor. The stool follows you." },
      { icon: "🪑", text: "Click an empty tile next to a table." },
      { icon: "🔄", text: "On a keyboard, press R to turn it around." },
    ],
    task: "Click an empty floor tile beside a table.",
    doneMessage: "Your new stool is in!",
    coverEdge: "top",
    target: () => ".world-frame",
    isDone: ({ snapshot, baseline }) => baseline !== undefined && snapshot.cash < baseline.cash,
  },
  {
    id: "stop-building",
    title: "Stop building",
    points: [
      { icon: "🧱", text: "While you are building, every click places another one." },
      { icon: "✋", text: "When you have enough, stop building." },
    ],
    task: "Press Select, at the top of the map.",
    doneMessage: "Building stopped.",
    target: () => "[data-coach='tool-select']",
    isDone: ({ snapshot }) => snapshot.buildTool === "select",
  },
  {
    id: "open-centre",
    title: "Open for business!",
    points: [
      { icon: "🔒", text: "Your stalls are still closed." },
      { icon: "🚪", text: "Open them so guests can come in." },
    ],
    task: "Press the green Open centre button.",
    doneMessage: "The shutters are up!",
    target: () => "[data-testid='toggle-centre']",
    isDone: ({ snapshot }) => snapshot.isOpen,
  },
  {
    id: "watch-guests",
    title: "Here come the guests",
    intro: "Watch what each guest does:",
    flow: {
      label: "A guest's visit",
      stages: ["Pick a stall", "Line up", "Get food", "Sit and eat", "Go home"],
    },
    points: [{ icon: "💬", text: "The bubbles over their heads show what they are doing." }],
    task: `Wait until ${PRACTICE_GUESTS_TO_SERVE} guests have bought a meal. A faster speed makes it quicker.`,
    doneMessage: "Your first guests are fed!",
    target: () => ".world-frame",
    isDone: ({ snapshot, baseline }) =>
      baseline !== undefined &&
      snapshot.servedCustomers - baseline.servedCustomers >= PRACTICE_GUESTS_TO_SERVE,
    progress: ({ snapshot, baseline }) => {
      if (baseline === undefined) return undefined;
      const served = Math.min(
        PRACTICE_GUESTS_TO_SERVE,
        Math.max(0, snapshot.servedCustomers - baseline.servedCustomers),
      );
      return `Guests served: ${served} of ${PRACTICE_GUESTS_TO_SERVE}`;
    },
  },
  {
    id: "inspect-guest",
    title: "Say hello to a guest",
    intro: "Every guest is different.",
    points: [
      { icon: "💸", text: "Some want something cheap." },
      { icon: "🍗", text: "Some want something filling." },
      { icon: "🥢", text: "Some want a lighter meal." },
    ],
    task: "Click on a guest to see what they are looking for.",
    doneMessage: "Now you know what they want!",
    target: ({ snapshot }) =>
      snapshot.selectedCustomerNutrition ? ".customer-nutrition-inspector" : ".world-frame",
    isDone: ({ snapshot }) => snapshot.selectedCustomerNutrition !== undefined,
  },
  {
    id: "dishes",
    title: "Look at the menu",
    points: [
      { icon: "🍜", text: "Each stall sells a few dishes." },
      { icon: "⭐", text: "Stars show how tasty and popular a dish is." },
      { icon: "♥", text: "The Health rating shows how balanced one serving is." },
      { icon: "😊", text: "Guests care about both!" },
    ],
    task: "Press Dishes at the bottom of the screen.",
    doneMessage: "That's the menu!",
    target: target_panel("dishes"),
    isDone: ({ panel, isPanelVisible }) => panel === "dishes" && isPanelVisible,
  },
  {
    id: "insights",
    title: "Check for problems",
    points: [
      { icon: "📊", text: "Insights shows when lines are too long or seats run out." },
      { icon: "⏳", text: "Guests who wait too long get grumpy. Some give up and leave." },
    ],
    task: "Press Insights at the bottom of the screen.",
    doneMessage: "Now you can spot problems early.",
    target: target_panel("insights"),
    isDone: ({ panel, isPanelVisible }) => panel === "insights" && isPanelVisible,
  },
  {
    id: "fast-forward",
    title: "Fast-forward to the evening",
    intro: "Great job! Let's finish the day quickly.",
    task: "Press 10× to make time zoom.",
    doneMessage: "Whoosh! Time is flying.",
    target: () => ".speed-group",
    isDone: ({ snapshot }) => snapshot.speed >= PRACTICE_FAST_SPEED,
  },
  {
    id: "end-of-day",
    title: "Almost closing time",
    points: [
      { icon: "🕕", text: "Watch the time go by." },
      {
        icon: "📝",
        text: "When the day ends, you get a Service Review: a report card for your centre.",
      },
      { icon: "✔", text: "Read it, then press its button to close it." },
    ],
    task: "Wait for the day to end.",
    doneMessage: "You finished the day!",
    target: () => ".clock-card",
    isDone: ({ snapshot, baseline, hasOpenDialog }) =>
      baseline !== undefined && snapshot.day > baseline.day && !hasOpenDialog,
    progress: ({ snapshot }) => `The clock says ${snapshot.timeLabel}`,
  },
  {
    id: "finish",
    title: "You ran a whole day!",
    intro: "Now you know how to:",
    points: [
      { icon: "🪑", text: "Buy and place things" },
      { icon: "🚪", text: "Open your stalls" },
      { icon: "👀", text: "Check on your guests" },
      { icon: "📝", text: "Read your report card" },
      { icon: "🎉", text: "Your real centre is ready. Have fun: happy guests come back!" },
    ],
  },
];

/** The index of the finish card, the last practice step. */
export const PRACTICE_FINISH_STEP = PRACTICE_STEPS.length - 1;

/** Where the player is in the practice day. */
export interface PracticeProgress {
  /** The index of the current step in {@link PRACTICE_STEPS}. */
  readonly stepIndex: number;
  /** The practice centre's starting figures; undefined until its first snapshot arrives. */
  readonly baseline: PracticeBaseline | undefined;
  /** Whether the coach is folded down to its small bar. */
  readonly isCollapsed: boolean;
}

/** The progress of a practice day that has just begun. */
export const PRACTICE_START: PracticeProgress = {
  stepIndex: 0,
  baseline: undefined,
  isCollapsed: false,
};

/**
 * Record the practice centre's starting figures from its first snapshot.
 *
 * @param progress - The practice progress, or undefined outside practice.
 * @param snapshot - A runtime snapshot.
 * @returns The progress with its baseline set; unchanged when it already has one.
 */
export function record_practice_baseline(
  progress: PracticeProgress | undefined,
  snapshot: PracticeBaseline,
): PracticeProgress | undefined {
  if (progress === undefined || progress.baseline !== undefined) return progress;
  return {
    ...progress,
    baseline: { cash: snapshot.cash, day: snapshot.day, servedCustomers: snapshot.servedCustomers },
  };
}

/**
 * Move to the next step, stopping at the finish card.
 *
 * @param progress - The practice progress.
 * @returns The progress on the next step.
 */
export function advance_practice(progress: PracticeProgress): PracticeProgress {
  return { ...progress, stepIndex: Math.min(PRACTICE_FINISH_STEP, progress.stepIndex + 1) };
}

/**
 * Decide whether a step's task is done; a step without a task always counts as done.
 *
 * @param step - The practice step.
 * @param context - The practice context.
 * @returns Whether the player may move on without skipping.
 */
export function is_practice_step_done(step: PracticeStep, context: PracticeContext): boolean {
  return step.isDone?.(context) ?? true;
}

/** A box on screen, in CSS pixels. */
export interface ScreenRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** A width and a height, in CSS pixels. */
export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

/** The space between the ringed element and the coach card. */
export const COACH_GAP_PX = 16;

/** The smallest space between the coach card and the edge of the viewport. */
export const COACH_MARGIN_PX = 12;

/** The share of the card's width that must fit beside a target before the card leans there. */
export const COACH_MIN_SIDE_SHARE = 0.5;

/**
 * Clamp a value between a lower and an upper bound, preferring the lower bound when the range
 * is empty.
 *
 * @param value - The value.
 * @param lower - The lower bound.
 * @param upper - The upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(value, upper));
}

/**
 * Place the coach card beside the ringed element without covering it.
 *
 * The card tries below, above, right and then left of the target, and takes the first side
 * where it fits inside the viewport. When no side fits but the roomier side outside the target
 * holds at least `COACH_MIN_SIDE_SHARE` of the card, the card sits against that edge of the
 * viewport and covers only the target's edge (the map on a wide screen). A target with no room
 * beside it (the map on a phone) gets the card inside its own bottom-left corner (top-left when
 * `cover_edge` is `top`), and a step
 * with no target centres the card.
 *
 * @param target - The ringed element's box, or undefined for none.
 * @param card - The coach card's size.
 * @param viewport - The viewport's size.
 * @param cover_edge - Which edge of a target with no room beside it the card covers.
 * @returns The card's top-left corner.
 */
export function place_coach_card(
  target: ScreenRect | undefined,
  card: ScreenSize,
  viewport: ScreenSize,
  cover_edge: CoverEdge = "bottom",
): { readonly top: number; readonly left: number } {
  const max_left = viewport.width - card.width - COACH_MARGIN_PX;
  const max_top = viewport.height - card.height - COACH_MARGIN_PX;
  if (target === undefined) {
    return {
      top: clamp((viewport.height - card.height) / 2, COACH_MARGIN_PX, max_top),
      left: clamp((viewport.width - card.width) / 2, COACH_MARGIN_PX, max_left),
    };
  }
  const centred_left = clamp(
    target.left + (target.width - card.width) / 2,
    COACH_MARGIN_PX,
    max_left,
  );
  const centred_top = clamp(
    target.top + (target.height - card.height) / 2,
    COACH_MARGIN_PX,
    max_top,
  );
  const below = target.top + target.height + COACH_GAP_PX;
  if (below <= max_top) return { top: below, left: centred_left };
  const above = target.top - COACH_GAP_PX - card.height;
  if (above >= COACH_MARGIN_PX) return { top: above, left: centred_left };
  const right = target.left + target.width + COACH_GAP_PX;
  if (right <= max_left) return { top: centred_top, left: right };
  const left = target.left - COACH_GAP_PX - card.width;
  if (left >= COACH_MARGIN_PX) return { top: centred_top, left };
  const room_right = viewport.width - (target.left + target.width);
  const room_left = target.left;
  if (Math.max(room_right, room_left) >= card.width * COACH_MIN_SIDE_SHARE) {
    return { top: centred_top, left: room_right >= room_left ? max_left : COACH_MARGIN_PX };
  }
  const inside_top =
    cover_edge === "top"
      ? target.top + COACH_GAP_PX
      : target.top + target.height - card.height - COACH_GAP_PX;
  return {
    top: clamp(inside_top, COACH_MARGIN_PX, max_top),
    left: clamp(target.left + COACH_GAP_PX, COACH_MARGIN_PX, max_left),
  };
}
