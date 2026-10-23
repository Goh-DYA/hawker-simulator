/**
 * The guided practice day: the coach's steps, the checks that tell when the player has done
 * each one, and the placement of the coach card beside the element it points at.
 *
 * The practice day runs on a throwaway centre. The shell keeps the player's real centre in
 * memory, swaps in a fresh one, stops every save while practice lasts, and loads the real centre
 * back when the player exits. This module holds only the pure parts: the step copy is written
 * for young players who are new to management games, so each card is a short lead-in line, a few
 * one-sentence points with an icon each and, where it helps, a row of stages. Each check is a
 * function of the latest snapshot, the open panel and the baselines the progress records: one as
 * practice began and one as each step is first shown, plus a count of objects moved, so a check
 * sees what changed since its step began. The steps can be walked back as well as forward, and
 * after the finish card come optional bonus steps, counted on their own.
 */
import type { RuntimeSnapshot } from "@/src/game/runtime/types";
import type { Panel } from "./display";
import type { GuidePoint } from "./guide";

/** The snapshot fields the practice checks read. */
export type PracticeSnapshot = Pick<
  RuntimeSnapshot,
  | "activeDishVariants"
  | "accessPoints"
  | "buildTool"
  | "cash"
  | "day"
  | "isOpen"
  | "neighbourhood"
  | "placedObjectCount"
  | "placedStalls"
  | "routeGuidePoints"
  | "selectedBuildId"
  | "selectedCustomerNutrition"
  | "selectedObjectId"
  | "servedCustomers"
  | "speed"
  | "stallMenus"
  | "timeLabel"
>;

/**
 * The figures a check compares against: the practice centre's as practice began, or the
 * centre's as a step was first shown.
 */
export interface PracticeBaseline {
  readonly cash: number;
  readonly day: number;
  readonly servedCustomers: number;
  readonly placedStallCount: number;
  readonly placedObjectCount: number;
  readonly accessPointCount: number;
  readonly routeGuideCount: number;
  readonly movesCompleted: number;
  readonly stallMenus: RuntimeSnapshot["stallMenus"];
  readonly activeDishVariants: RuntimeSnapshot["activeDishVariants"];
}

/** What a practice check sees: the latest snapshot, the baselines, the panel and the dialogs. */
export interface PracticeContext {
  /** The latest runtime snapshot. */
  readonly snapshot: PracticeSnapshot;
  /** The practice centre's figures as practice began; undefined until its first snapshot. */
  readonly baseline: PracticeBaseline | undefined;
  /** The centre's figures as each step was first shown, by step ID. */
  readonly stepBaselines: Readonly<Record<string, PracticeBaseline>>;
  /** How many objects the player has moved with the Move tool during practice. */
  readonly movesCompleted: number;
  /** The steps the player finished before moving on; they stay done when revisited. */
  readonly completedStepIds: readonly string[];
  /** The panel the management area shows. */
  readonly panel: Panel;
  /** Whether that panel is on screen (always on wide screens, only as a sheet on narrow ones). */
  readonly isPanelVisible: boolean;
  /** Whether a modal dialog, such as the Service Review, is open. */
  readonly hasOpenDialog: boolean;
  /** Whether the screen is narrow, so the panels open as a sheet from the dock. */
  readonly isCompact: boolean;
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
   * Whether the step needs the map in view, so arriving on it closes the panel sheet that covers
   * the map on a narrow screen; absent counts as false.
   */
  readonly isMapNeeded?: boolean;
  /** Whether moving forward onto the step pauses the game; absent counts as false. */
  readonly pausesOnEnter?: boolean;
  /**
   * Which edge of a target with no room beside it (the map on a phone) the card covers; absent
   * counts as the bottom. Placing and moving cover the top, because the tables sit lower down.
   */
  readonly coverEdge?: CoverEdge;
  /**
   * A line drawn from the game, such as the Service Review's tip, shown after the lead-in.
   *
   * @param context - The practice context.
   * @returns The line, or undefined for none.
   */
  readonly note?: (context: PracticeContext) => string | undefined;
  /** What the player should do now; read-only steps have none and move on with Next. */
  readonly task?: string;
  /**
   * Whether the task cannot be skipped, because the steps after it depend on it (day 2's steps
   * need day 2); absent counts as false.
   */
  readonly isRequired?: boolean;
  /**
   * A step that must be done before this one makes sense (an item picked before it is put
   * down); while it is not done, this step is passed over in either direction.
   */
  readonly requiresStepId?: string;
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
 * Ring a map tool's button until the tool is on, then ring the map; once the step is done, keep
 * ringing the map, so the ring never invites a second use of the tool.
 *
 * @param tool - The tool the step needs.
 * @param step_id - The step's ID.
 * @returns The step's target picker.
 */
function target_tool(
  tool: "select" | "move" | "remove" | "access" | "route",
  step_id: string,
): (context: PracticeContext) => string {
  return ({ snapshot, completedStepIds }) =>
    snapshot.buildTool === tool || completedStepIds.includes(step_id)
      ? ".world-frame"
      : `[data-coach="tool-${tool}"]`;
}

/**
 * Read the baseline recorded when a step was first shown.
 *
 * @param context - The practice context.
 * @param step_id - The step whose baseline to read.
 * @returns The baseline, or undefined before that step's first snapshot.
 */
function step_baseline(context: PracticeContext, step_id: string): PracticeBaseline | undefined {
  return context.stepBaselines[step_id];
}

/**
 * Decide whether two records of string values hold the same entries.
 *
 * @param first - One record, such as the stall menus.
 * @param second - The other.
 * @returns Whether every key maps to an equal value (arrays compared item by item).
 */
function is_same_record(
  first: Readonly<Record<string, string | readonly string[]>>,
  second: Readonly<Record<string, string | readonly string[]>>,
): boolean {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  for (const key of keys) {
    const a = first[key];
    const b = second[key];
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length || a.some((value, index) => value !== b[index])) return false;
    } else if (a !== b) {
      return false;
    }
  }
  return true;
}

/**
 * The practice day's steps, in order: a look around; the centre opened and its guests watched;
 * a seat bought, moved, sold back and brought back while the game waits; the day run to its
 * Service Review; then day 2's morning (the report's tip, a new stall, the menu and a recipe),
 * when the first day's sales have unlocked them; and the finish card. After it come the optional
 * bonus steps (doors and paths), which end on their own card.
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
      { icon: "➖", text: "Card in the way? Press – to fold it, and Show guide to bring it back." },
      { icon: "⬅️", text: "Press Back to see a card again." },
    ],
  },
  {
    id: "money",
    title: "Your cash and your hearts",
    points: [
      { icon: "💵", text: "Cash is your money. You earn it when guests buy food." },
      { icon: "♥", text: "The heart is your reputation: how much guests like your centre." },
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
    id: "map",
    isMapNeeded: true,
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
    id: "open-centre",
    isMapNeeded: true,
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
    isMapNeeded: true,
    title: "Here come the guests",
    intro: "Watch what each guest does:",
    flow: {
      label: "A guest's visit",
      stages: ["Pick a stall", "Line up", "Get food", "Sit and eat", "Go home"],
    },
    points: [
      { icon: "💬", text: "The bubbles over their heads show what they are doing." },
      { icon: "⚙️", text: "Settings has a key that explains every bubble." },
    ],
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
    title: "Meet a guest",
    intro: "Every guest wants something a little different.",
    points: [
      { icon: "🎯", text: "Intent is what they want, like Protein-forward: more protein." },
      { icon: "🤷", text: "Some guests don't mind what they eat." },
      { icon: "🩺", text: "Health needs show if they must watch things like salt or sugar." },
      { icon: "😊", text: "Give guests what they want, and they leave happy." },
    ],
    task: "Press Select, then click a guest walking around.",
    doneMessage: "Now you know what this guest wants!",
    target: ({ snapshot }) => {
      if (snapshot.selectedCustomerNutrition) return ".customer-nutrition-inspector";
      return snapshot.buildTool === "select" ? ".world-frame" : "[data-coach='tool-select']";
    },
    isDone: ({ snapshot }) => snapshot.selectedCustomerNutrition !== undefined,
  },
  {
    id: "today",
    title: "Today and your goals",
    points: [
      { icon: "📅", text: "The Today card shows when the lunch and dinner crowds come." },
      { icon: "🎯", text: "Today's focus lists your goals. They win you cash and level you up." },
      { icon: "📱", text: "On a small screen, press Focus to see your goals." },
    ],
    target: ({ isCompact }) => (isCompact ? "[data-coach='dock-focus']" : ".left-rail"),
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
    id: "seats",
    title: "More seats for the rush",
    intro: "At lunch, lots of guests come at once.",
    points: [
      { icon: "😟", text: "If they can't find a seat, they go home unhappy." },
      { icon: "🪑", text: "Let's buy a stool and put it by a table." },
      { icon: "⏸", text: "The game is paused, so you can build calmly." },
    ],
    pausesOnEnter: true,
  },
  {
    id: "pick-seat",
    title: "Buy a stool",
    task: "Open Build, type “stool” in the search box, and click the Stacking Stool.",
    doneMessage: "You picked something to build!",
    target: target_panel("build"),
    isDone: ({ snapshot }) => snapshot.buildTool === "place",
  },
  {
    id: "place-seat",
    isMapNeeded: true,
    title: "Put it down",
    points: [
      { icon: "👆", text: "Move over the floor. The stool follows you." },
      { icon: "🟥", text: "Red means it does not fit there. Try another tile." },
      { icon: "✋", text: "In practice you build one at a time. At home, press Select when done." },
    ],
    task: "Click an empty floor tile beside a table.",
    doneMessage: "Your new stool is in!",
    requiresStepId: "pick-seat",
    coverEdge: "top",
    target: () => ".world-frame",
    isDone: (context) => {
      const before = step_baseline(context, "pick-seat");
      return before !== undefined && context.snapshot.cash < before.cash;
    },
  },
  {
    id: "move",
    isMapNeeded: true,
    title: "Move a stool",
    intro: "Changed your mind? Move things around for free.",
    flow: {
      label: "Moving something",
      stages: ["Press Move", "Click a stool", "Click a new tile", "Press Select"],
    },
    points: [{ icon: "🟥", text: "If the new spot is taken, pick another tile." }],
    task: "Move a stool to a new spot, then press Select.",
    doneMessage: "Moved! Nothing was lost.",
    coverEdge: "top",
    target: target_tool("move", "move"),
    isDone: (context) => {
      const before = step_baseline(context, "move");
      return (
        before !== undefined &&
        context.movesCompleted > before.movesCompleted &&
        context.snapshot.buildTool === "select"
      );
    },
  },
  {
    id: "remove",
    isMapNeeded: true,
    title: "Sell something back",
    points: [
      { icon: "🗑️", text: "Remove sells a thing. You get some of its price back as cash." },
      { icon: "⚠️", text: "It happens with one click, so press Select straight after." },
    ],
    task: "Press Remove, click a stool, then press Select.",
    doneMessage: "Sold! You got some cash back.",
    coverEdge: "top",
    target: target_tool("remove", "remove"),
    isDone: (context) => {
      const before = step_baseline(context, "remove");
      return (
        before !== undefined &&
        context.snapshot.placedObjectCount < before.placedObjectCount &&
        context.snapshot.buildTool === "select"
      );
    },
  },
  {
    id: "undo",
    title: "Oops? Undo it!",
    points: [
      { icon: "↶", text: "Undo takes back your last building change." },
      { icon: "🪑", text: "Press it now to bring the stool back." },
    ],
    task: "Press ↶ Undo, under the map.",
    doneMessage: "The stool is back, just like before!",
    isSkippedWhenHidden: true,
    target: () => "[data-coach='undo']",
    isDone: (context) => {
      const before = step_baseline(context, "undo");
      return before !== undefined && context.snapshot.placedObjectCount > before.placedObjectCount;
    },
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
    isMapNeeded: true,
    title: "Finish the day",
    points: [
      { icon: "🕕", text: "The rest of the day zooms by. Guests keep coming until evening." },
      {
        icon: "📝",
        text: "When the day ends, you get a Service Review: a report card for your centre.",
      },
      { icon: "✔", text: "Read it, then press Open for Day 2." },
    ],
    task: "Wait for the day to end.",
    doneMessage: "You finished the day!",
    isRequired: true,
    target: () => ".clock-card",
    isDone: ({ snapshot, baseline, hasOpenDialog }) =>
      baseline !== undefined && snapshot.day > baseline.day && !hasOpenDialog,
    progress: ({ snapshot }) => `The clock says ${snapshot.timeLabel}`,
  },
  {
    id: "new-day",
    title: "Good morning, day 2!",
    intro: "Your report card had one thing to try:",
    note: ({ snapshot }) => {
      const tip = snapshot.neighbourhood?.lastReport?.focusTip;
      return tip ? `${tip.label}: ${tip.action}` : "Nothing! Your guests had a good day.";
    },
    points: [
      { icon: "📝", text: "Find your report card again under Focus." },
      { icon: "⬆️", text: "Your centre grew, so new stalls and dishes are ready." },
      { icon: "⏸", text: "The game is paused while you set up." },
    ],
    pausesOnEnter: true,
  },
  {
    id: "pick-stall",
    title: "Add a new stall",
    points: [
      { icon: "🍜", text: "More stalls mean more kinds of food, so more guests find a meal." },
      { icon: "🆕", text: "Kopi Canopy is new today." },
      { icon: "🔒", text: "If it is locked, build another of your first stalls." },
    ],
    task: "Open Stalls, scroll down to “Add another stall”, and click one.",
    doneMessage: "Good choice! Now find it a spot.",
    coverEdge: "top",
    target: target_panel("stalls"),
    isDone: ({ snapshot }) =>
      snapshot.buildTool === "place" && snapshot.selectedBuildId?.startsWith("stall.") === true,
  },
  {
    id: "place-stall",
    isMapNeeded: true,
    title: "Find it a spot",
    points: [
      { icon: "📐", text: "A stall is big. It needs a wide empty space." },
      { icon: "🟥", text: "If it turns red, it does not fit there. Try another spot." },
      {
        icon: "🚶",
        text: "A message about “unreachable” means guests can't walk to it. Try another spot.",
      },
    ],
    task: "Click a big empty space on the floor.",
    doneMessage: "Your new stall is open for business!",
    requiresStepId: "pick-stall",
    coverEdge: "top",
    target: () => ".world-frame",
    isDone: (context) => {
      const before = step_baseline(context, "pick-stall");
      return before !== undefined && context.snapshot.placedStalls.length > before.placedStallCount;
    },
  },
  {
    id: "menu",
    title: "Choose the menu",
    points: [
      { icon: "🍽️", text: "Each stall has a few menu slots." },
      { icon: "☑️", text: "Tick Offer to sell a dish. Untick it to stop selling it." },
      { icon: "🔒", text: "Locked dishes unlock as your level grows." },
    ],
    task: "Open Dishes and tick Offer on a new dish, like Roast Chicken Rice.",
    doneMessage: "Your menu has something new!",
    coverEdge: "top",
    target: target_panel("dishes"),
    isDone: (context) => {
      const before = step_baseline(context, "menu");
      return (
        before !== undefined && !is_same_record(before.stallMenus, context.snapshot.stallMenus)
      );
    },
  },
  {
    id: "recipe",
    title: "Try a new recipe",
    intro: "Some dishes can be cooked in different ways.",
    flow: {
      label: "Changing a recipe",
      stages: [
        "Choose Coconut & Lime in the stall box",
        "Press Tune recipe on Nasi Lemak",
        "Pick another recipe",
        "Press Done",
      ],
    },
    points: [
      { icon: "♥", text: "Watch the Health number. Recipes change it, not Stars." },
      { icon: "↩️", text: "Liked the old one? Switch back any time." },
      { icon: "🔒", text: "Grey ones unlock as the stall cooks more." },
    ],
    task: "Pick another recipe for Nasi Lemak.",
    doneMessage: "Recipe changed! Check its Health number.",
    target: target_panel("dishes"),
    isDone: (context) => {
      const before = step_baseline(context, "recipe");
      return (
        before !== undefined &&
        !is_same_record(before.activeDishVariants, context.snapshot.activeDishVariants)
      );
    },
  },
  {
    id: "finish",
    title: "You're ready!",
    intro: "Now you know how to:",
    points: [
      { icon: "👀", text: "Open up and check on your guests" },
      { icon: "🪑", text: "Buy, move and sell things, and undo a change" },
      { icon: "🍜", text: "Add stalls, choose dishes and change recipes" },
      { icon: "🚪", text: "Want more? Bonus tools shows doors and paths." },
      { icon: "🎉", text: "Your real centre is ready. Have fun: happy guests come back!" },
    ],
    pausesOnEnter: true,
  },
  {
    id: "access",
    isMapNeeded: true,
    title: "Add a door",
    intro: "Guests come in through entrances and leave through exits.",
    flow: {
      label: "Adding a door",
      stages: [
        "Press Access",
        "Press + Entry",
        "Click the teal wall at the hall's edge",
        "Press Finish access",
      ],
    },
    points: [
      {
        icon: "🧱",
        text: "A door must go on the outer wall, not on the floor or the path outside.",
      },
      { icon: "⏸", text: "The game waits while you change the doors." },
    ],
    task: "Add a new entrance, then press Finish access.",
    doneMessage: "A new door! More guests can find their way in.",
    target: ({ snapshot }) =>
      snapshot.buildTool === "access" ? ".tool-segment" : "[data-coach='tool-access']",
    isDone: (context) => {
      const before = step_baseline(context, "access");
      return (
        before !== undefined &&
        context.snapshot.accessPoints.length > before.accessPointCount &&
        context.snapshot.buildTool !== "access"
      );
    },
  },
  {
    id: "route",
    isMapNeeded: true,
    title: "Paint a path",
    intro: "Guests like to walk along painted paths, so lines and tables stay clear.",
    flow: {
      label: "Painting a path",
      stages: ["Press Route", "Click a few floor tiles", "Press Finish route"],
    },
    points: [
      { icon: "👣", text: "Paint from a door towards the stalls." },
      { icon: "↩️", text: "Click a painted tile again to wipe it off." },
    ],
    task: "Paint a path of a few tiles, then press Finish route.",
    doneMessage: "Nice path! Guests will follow it.",
    target: target_tool("route", "route"),
    isDone: (context) => {
      const before = step_baseline(context, "route");
      return (
        before !== undefined &&
        context.snapshot.routeGuidePoints.length > before.routeGuideCount &&
        context.snapshot.buildTool !== "route"
      );
    },
  },
  {
    id: "bonus-finish",
    title: "Bonus tools done!",
    intro: "Now you can also:",
    points: [
      { icon: "🚪", text: "Add doors for guests to come in and go out" },
      { icon: "🛣️", text: "Paint paths that guests like to walk on" },
      { icon: "🎉", text: "You're a hawker centre pro. Have fun!" },
    ],
  },
];

/** The index of the finish card, which ends the main practice day. */
export const PRACTICE_FINISH_STEP = PRACTICE_STEPS.findIndex((step) => step.id === "finish");

/** The index of the last step, the card that ends the bonus steps. */
export const PRACTICE_LAST_STEP = PRACTICE_STEPS.length - 1;

/** Where a step sits for the coach's counter: in the main day or among the bonus steps. */
export interface PracticePosition {
  /** "Step" in the main day, "Bonus step" after the finish card. */
  readonly label: "Step" | "Bonus step";
  /** The step's number within its part, from 1. */
  readonly number: number;
  /** How many steps that part has. */
  readonly total: number;
}

/**
 * Count a step within its part of the practice day, so the main day ends on its finish card
 * and the bonus steps count on their own.
 *
 * @param step_index - The step's index in {@link PRACTICE_STEPS}.
 * @returns The step's label, number and total.
 */
export function get_practice_position(step_index: number): PracticePosition {
  if (step_index <= PRACTICE_FINISH_STEP) {
    return { label: "Step", number: step_index + 1, total: PRACTICE_FINISH_STEP + 1 };
  }
  return {
    label: "Bonus step",
    number: step_index - PRACTICE_FINISH_STEP,
    total: PRACTICE_LAST_STEP - PRACTICE_FINISH_STEP,
  };
}

/** Which way the player last moved through the steps. */
export type PracticeDirection = 1 | -1;

/** Where the player is in the practice day. */
export interface PracticeProgress {
  /** The index of the current step in {@link PRACTICE_STEPS}. */
  readonly stepIndex: number;
  /** Which way the player last moved, which is the way a hidden step is skipped. */
  readonly direction: PracticeDirection;
  /** The practice centre's starting figures; undefined until its first snapshot arrives. */
  readonly baseline: PracticeBaseline | undefined;
  /** The centre's figures as each step was first shown, by step ID. */
  readonly stepBaselines: Readonly<Record<string, PracticeBaseline>>;
  /** How many objects the Move tool has put down during practice. */
  readonly movesCompleted: number;
  /** Whether the Move tool is holding an object, waiting for its new tile. */
  readonly isMoveHeld: boolean;
  /** The steps the player finished before moving on; they stay done when revisited. */
  readonly completedStepIds: readonly string[];
  /** Whether the coach is folded away. */
  readonly isCollapsed: boolean;
}

/** The progress of a practice day that has just begun. */
export const PRACTICE_START: PracticeProgress = {
  stepIndex: 0,
  direction: 1,
  baseline: undefined,
  stepBaselines: {},
  movesCompleted: 0,
  isMoveHeld: false,
  completedStepIds: [],
  isCollapsed: false,
};

/** The snapshot fields a baseline records. */
export type PracticeBaselineSource = Pick<
  RuntimeSnapshot,
  | "accessPoints"
  | "activeDishVariants"
  | "cash"
  | "day"
  | "placedObjectCount"
  | "placedStalls"
  | "routeGuidePoints"
  | "servedCustomers"
  | "stallMenus"
>;

/**
 * Take a baseline from a snapshot.
 *
 * @param snapshot - A runtime snapshot.
 * @param moves_completed - How many moves the player has made so far.
 * @returns The baseline.
 */
function build_baseline(
  snapshot: PracticeBaselineSource,
  moves_completed: number,
): PracticeBaseline {
  return {
    cash: snapshot.cash,
    day: snapshot.day,
    servedCustomers: snapshot.servedCustomers,
    placedStallCount: snapshot.placedStalls.length,
    placedObjectCount: snapshot.placedObjectCount,
    accessPointCount: snapshot.accessPoints.length,
    routeGuideCount: snapshot.routeGuidePoints.length,
    movesCompleted: moves_completed,
    stallMenus: snapshot.stallMenus,
    activeDishVariants: snapshot.activeDishVariants,
  };
}

/**
 * Record the current step's baseline the first time the step is shown.
 *
 * @param progress - The practice progress.
 * @param snapshot - The snapshot to record it from.
 * @returns The progress with that step's baseline; unchanged when it already has one.
 */
function record_step_baseline(
  progress: PracticeProgress,
  snapshot: PracticeBaselineSource,
): PracticeProgress {
  const step_id = PRACTICE_STEPS[progress.stepIndex]?.id;
  if (step_id === undefined || progress.stepBaselines[step_id] !== undefined) return progress;
  return {
    ...progress,
    stepBaselines: {
      ...progress.stepBaselines,
      [step_id]: build_baseline(snapshot, progress.movesCompleted),
    },
  };
}

/**
 * Fold a new runtime snapshot into the practice progress: record the starting baseline and the
 * current step's baseline the first time, and count each object the Move tool puts down (it
 * holds an object, then lets go of it while the tool stays on).
 *
 * @param progress - The practice progress, or undefined outside practice.
 * @param snapshot - The new runtime snapshot.
 * @returns The updated progress; the same object when nothing changed.
 */
export function observe_practice_snapshot(
  progress: PracticeProgress | undefined,
  snapshot: PracticeBaselineSource & Pick<RuntimeSnapshot, "buildTool" | "selectedObjectId">,
): PracticeProgress | undefined {
  if (progress === undefined) return undefined;
  let next = progress;
  if (next.baseline === undefined) {
    next = { ...next, baseline: build_baseline(snapshot, next.movesCompleted) };
  }
  next = record_step_baseline(next, snapshot);
  const is_holding = snapshot.buildTool === "move" && snapshot.selectedObjectId !== undefined;
  if (is_holding && !next.isMoveHeld) {
    next = { ...next, isMoveHeld: true };
  } else if (!is_holding && next.isMoveHeld) {
    const has_put_down = snapshot.buildTool === "move";
    next = {
      ...next,
      isMoveHeld: false,
      movesCompleted: next.movesCompleted + (has_put_down ? 1 : 0),
    };
  }
  return next;
}

/**
 * Move one step forward or back, staying within the steps, and record the new step's baseline
 * from the latest snapshot if it has none yet. A step that is done as the player leaves it is
 * remembered, so it stays done when they come back, whatever has changed since, and a step whose
 * required step is not done is passed over.
 *
 * @param progress - The practice progress.
 * @param direction - 1 for the next step, -1 for the previous one.
 * @param snapshot - The latest runtime snapshot.
 * @param is_current_done - Whether the step being left is done.
 * @returns The progress on the new step.
 */
export function move_practice(
  progress: PracticeProgress,
  direction: PracticeDirection,
  snapshot: PracticeBaselineSource,
  is_current_done: boolean,
): PracticeProgress {
  const current_id = PRACTICE_STEPS[progress.stepIndex]?.id;
  const completed_step_ids =
    is_current_done && current_id !== undefined && !progress.completedStepIds.includes(current_id)
      ? [...progress.completedStepIds, current_id]
      : progress.completedStepIds;
  let step_index = clamp(progress.stepIndex + direction, 0, PRACTICE_LAST_STEP);
  while (
    step_index > 0 &&
    step_index < PRACTICE_LAST_STEP &&
    !is_step_reachable(PRACTICE_STEPS[step_index]!, completed_step_ids)
  ) {
    step_index += direction;
  }
  return record_step_baseline(
    { ...progress, stepIndex: step_index, direction, completedStepIds: completed_step_ids },
    snapshot,
  );
}

/**
 * Decide whether a step can be shown: its required step, if it has one, is done.
 *
 * @param step - The practice step.
 * @param completed_step_ids - The steps done so far.
 * @returns Whether the step makes sense now.
 */
function is_step_reachable(step: PracticeStep, completed_step_ids: readonly string[]): boolean {
  return step.requiresStepId === undefined || completed_step_ids.includes(step.requiresStepId);
}

/**
 * Decide whether a step's task is done: a step without a task always is, a step finished before
 * the player moved on stays done, and otherwise its check decides.
 *
 * @param step - The practice step.
 * @param context - The practice context.
 * @returns Whether the player may move on without skipping.
 */
export function is_practice_step_done(step: PracticeStep, context: PracticeContext): boolean {
  if (context.completedStepIds.includes(step.id)) return true;
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
