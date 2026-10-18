/**
 * The stall vendor sprite sheet: {@link SHEET_FACINGS} rows by {@link VENDOR_POSES} columns of one
 * stall's worker, built on the same full-size figure as the guests (average height, with the
 * build varying by stall).
 *
 * Poses: two idle frames with the hands resting on the counter and a slight shift of weight;
 * two order frames (an open hand raised to the guest, then a hand held out over the counter);
 * and four prepare frames that act out the stall's own work at counter height: chopping with a
 * cleaver against the board, stirring or tossing in a pot or wok, pouring from height into a
 * cup or bowl held below, dipping and shaking a basket, or turning food on a griddle or grill.
 * The working hand is the right hand; the other hand steadies the board, the pot or the cup.
 *
 * The counter in front hides the vendor below the waist, so the work happens just above the
 * waist, where the hands and tools show over the counter's back edge.
 */
import type { PaintContext } from "../canvas";
import {
  PERSON_FRAME_HEIGHT,
  PERSON_FRAME_WIDTH,
  person_frame_name,
  SHEET_FACINGS,
  VENDOR_POSES,
  type PaintPlan,
  type SheetFacing,
  type SheetFrame,
  type VendorPaintSpec,
  type VendorPose,
} from "../specs";
import type { StallVendorRecipe, StallVendorWorkAction } from "../../visuals/vendor";
import { paint_apron, paint_headwear } from "./apparel";
import { paint_figure, type FigureLook } from "./figure";
import type { HairStyle } from "./head";
import {
  body_metrics,
  build_rig,
  reach_for,
  type ArmIntent,
  type BodyMetrics,
  type HandTarget,
  type PoseIntent,
  type Rig,
  type Vec3,
} from "./rig";
import { sleeve_for, type Silhouette } from "./top";
import { paint_tool } from "./tools";

/** The hair shape each vendor hair style is drawn with. */
const VENDOR_HAIR: Readonly<Record<StallVendorRecipe["hairStyle"], HairStyle>> = {
  cropped: "crop",
  "side-part": "side-part",
  wavy: "wavy",
  coiled: "curly",
  "tied-back": "ponytail",
  "close-cut": "buzz",
};

/** Work trousers behind the counter. */
const VENDOR_TROUSERS = 0x3a4048;
/** Work shoes. */
const VENDOR_SHOES = 0x2b2b2b;

/**
 * Height of the work surface above the vendor's feet. The stall counters cover a vendor to about
 * 19 px above the feet, so the hands work at the counter's back edge, a little below the chest.
 */
const WORK_HEIGHT = 24;

/** How the stall's work moves the hands and the tool. */
type WorkMotion = "strike" | "stir" | "toss" | "pour" | "dip" | "turn";

/** The motion each stall action is acted out with. */
const WORK_MOTION: Readonly<Record<StallVendorWorkAction, WorkMotion>> = {
  chop: "strike",
  ladle: "stir",
  "stir-braise": "stir",
  "tend-claypot": "stir",
  "wok-toss": "toss",
  pour: "pour",
  "layer-dessert": "pour",
  "spread-batter": "pour",
  blanch: "dip",
  "lift-steamer": "dip",
  "griddle-turn": "turn",
  "turn-skewers": "turn",
  chargrill: "turn",
  "pick-pieces": "turn",
};

/**
 * One key of a work motion: the working hand and the steadying hand (heights relative to
 * {@link WORK_HEIGHT}), the tool's elevation and sideways tilt, the lean, and whether a pour is
 * running.
 */
interface WorkKey {
  readonly hand: HandTarget;
  readonly support: HandTarget;
  /** Tool elevation in radians: positive points up, negative down towards the counter. */
  readonly elevation: number;
  /** Sideways tilt of the tool, towards the vendor's right (positive) or left. */
  readonly tilt: number;
  readonly lean: number;
  readonly isPouring?: boolean;
}

/**
 * Builds a work key.
 *
 * @param hand - The working hand: forward, out and up from the work surface.
 * @param support - The steadying hand, the same way.
 * @param elevation - Tool elevation in radians.
 * @param tilt - Sideways tilt of the tool.
 * @param lean - Forward lean.
 * @param isPouring - True while a pour runs.
 * @returns The key.
 */
function key(
  hand: readonly [number, number, number],
  support: readonly [number, number, number],
  elevation: number,
  tilt: number,
  lean: number,
  isPouring = false,
): WorkKey {
  return {
    hand: { forward: hand[0], x: hand[1], up: hand[2] },
    support: { forward: support[0], x: support[1], up: support[2] },
    elevation,
    tilt,
    lean,
    isPouring,
  };
}

/** The four prepare keys of each motion, in frame order. */
const WORK_KEYS: Readonly<Record<WorkMotion, readonly [WorkKey, WorkKey, WorkKey, WorkKey]>> = {
  // Cleaver raised, struck down on the board, pushing the pieces aside, raised again; the other
  // hand holds the meat on the board.
  strike: [
    key([4, 3.4, 5.5], [5, 1.2, 0.3], 1.1, -0.7, 0.4),
    key([5.5, 2.2, 1], [5, 1.2, 0.3], -0.35, -0.9, 1.2),
    key([5.5, 1.4, 0.8], [5.4, 0.8, 0.3], -0.15, -1, 1.1),
    key([4.5, 3, 3.2], [5, 1.2, 0.3], 0.5, -0.8, 0.7),
  ],
  // A ladle circling in the pot; the other hand on the pot's rim.
  stir: [
    key([5, 3, 2.6], [4.5, 4.4, 0.6], -1, -0.7, 0.7),
    key([6, 1.8, 2.2], [4.5, 4.4, 0.6], -1.1, -0.8, 1),
    key([5.5, 0.6, 2.6], [4.5, 4.4, 0.6], -1, -0.9, 0.9),
    key([4.5, 2, 3.2], [4.5, 4.4, 0.6], -0.85, -0.7, 0.6),
  ],
  // Spatula in the wok, the wok jerked up with the other hand, back down, stirring.
  toss: [
    key([5.5, 2.6, 1.6], [5, 3.6, 1], -0.6, -0.8, 1.1),
    key([4.5, 2.4, 4], [4.5, 3.6, 3.2], -0.15, -0.7, 0.4),
    key([6, 2, 2], [5.5, 3.6, 0.8], -0.75, -0.9, 1.3),
    key([5, 2.8, 2.4], [5, 3.6, 1.2], -0.5, -0.8, 0.9),
  ],
  // Lifting the kettle or cup and pouring down into the cup or bowl held below.
  pour: [
    key([5, 3.4, 3], [5, 0.4, 0.6], 0.1, -0.6, 0.5),
    key([5.5, 3.4, 6], [5, 0.4, 0.6], -0.35, -0.7, 0.4, true),
    key([5, 3.6, 7.5], [5, 0.4, 0.4], -0.45, -0.7, 0.3, true),
    key([5.5, 3.4, 4], [5, 0.4, 0.6], -0.1, -0.6, 0.5),
  ],
  // Lifting the basket or steamer, shaking it, dipping it down, rising again.
  dip: [
    key([5, 2.4, 4.4], [4.5, 3.8, 0.6], 0.1, -0.6, 0.6),
    key([5.5, 3.4, 3.8], [4.5, 3.8, 0.6], 0, -0.4, 0.7),
    key([6, 2.2, 0.8], [4.5, 3.8, 0.6], -0.5, -0.6, 1.2),
    key([5.2, 2.6, 2.8], [4.5, 3.8, 0.6], -0.15, -0.6, 0.8),
  ],
  // Sliding the turner or tongs under the food, across, flipping it over, setting it down.
  turn: [
    key([5.5, 3.6, 1.4], [4.5, 3, 0.4], -0.3, -0.9, 0.9),
    key([6.5, 1.6, 1], [4.5, 3, 0.4], -0.2, -1, 1.2),
    key([5.5, 1.8, 3.2], [4.5, 3, 0.4], 0.5, -0.9, 0.9),
    key([5, 3, 1.8], [4.5, 3, 0.4], -0.1, -0.8, 0.8),
  ],
};

/** Headwear that covers the hair, so longer hair is pinned up in a low bun beneath it. */
const COVERING_HEADWEAR: ReadonlySet<StallVendorRecipe["headwear"]> = new Set([
  "hair-wrap",
  "hairnet",
  "chef-cap",
]);

/** One vendor frame: the body pose, the tool's direction and whether a pour runs. */
interface VendorFrame {
  readonly intent: PoseIntent;
  /** The tool's direction in body space. */
  readonly toolDirection: Vec3;
  readonly isPouring: boolean;
}

/**
 * Gives the direction a tool points for an elevation and a sideways tilt.
 *
 * @param elevation - Radians above (positive) or below the horizontal.
 * @param tilt - Sideways share towards the vendor's right.
 * @returns The direction in body space.
 */
function tool_direction(elevation: number, tilt: number): Vec3 {
  return { right: tilt, forward: Math.cos(elevation), up: Math.sin(elevation) };
}

/**
 * Describes one vendor frame.
 *
 * @param pose - The vendor pose column.
 * @param metrics - The body metrics.
 * @param action - The stall's work action.
 * @returns The frame description.
 */
export function vendor_frame(
  pose: VendorPose,
  metrics: BodyMetrics,
  action: StallVendorWorkAction,
): VendorFrame {
  const hipUp = metrics.hipHeight;
  const arm = (lean: number, target: HandTarget): ArmIntent =>
    reach_for(metrics, hipUp, lean, { ...target, up: WORK_HEIGHT + target.up }, "down");
  const pose_of = (lean: number, right: ArmIntent, left: ArmIntent, sway = 0): PoseIntent => ({
    hipDrop: 0,
    isSeated: false,
    lean,
    sway,
    legs: {
      right: { stride: 0, lift: 0, isHeelUp: false },
      left: { stride: 0.6, lift: 0, isHeelUp: false },
    },
    arms: { right, left },
  });
  if (pose === "idle0" || pose === "idle1") {
    // Hands resting on the counter's edge with the tool laid forward; the weight shifts between
    // the two frames.
    const isSecond = pose === "idle1";
    return {
      intent: pose_of(
        0.5,
        arm(0.5, { forward: 5.5, x: 3.4, up: isSecond ? 0.6 : 0.2 }),
        arm(0.5, { forward: 5.5, x: isSecond ? 2.6 : 3.4, up: 0.2 }),
        isSecond ? 0.5 : 0,
      ),
      toolDirection: tool_direction(-0.5, -0.8),
      isPouring: false,
    };
  }
  if (pose === "order0") {
    // An open hand raised to greet the guest.
    const greet = { forward: 3.5, x: 6.4, up: hipUp + metrics.torso + 1 };
    return {
      intent: pose_of(
        0.2,
        reach_for(metrics, hipUp, 0.2, greet, "down"),
        arm(0.2, { forward: 5.5, x: 3.4, up: 0.2 }),
      ),
      toolDirection: tool_direction(0, 0),
      isPouring: false,
    };
  }
  if (pose === "order1") {
    // A hand held out over the counter, passing a plate or taking payment.
    return {
      intent: pose_of(
        1.3,
        arm(1.3, { forward: 11, x: 2.4, up: 2.6 }),
        arm(1.3, { forward: 5.5, x: 3.4, up: 0.2 }),
      ),
      toolDirection: tool_direction(0, 0),
      isPouring: false,
    };
  }
  const index = Number(pose.slice(-1)) as 0 | 1 | 2 | 3;
  const work = WORK_KEYS[WORK_MOTION[action]][index];
  return {
    intent: pose_of(work.lean, arm(work.lean, work.hand), arm(work.lean, work.support)),
    toolDirection: tool_direction(work.elevation, work.tilt),
    isPouring: work.isPouring ?? false,
  };
}

/**
 * Gives the hair shape a vendor is drawn with: tied-back and wavy hair is pinned into a low bun
 * under a wrap, net or chef cap, as kitchen hygiene asks, and worn as it is otherwise.
 *
 * @param recipe - The vendor recipe.
 * @returns The hair style.
 */
function vendor_hair(recipe: StallVendorRecipe): HairStyle {
  const style = VENDOR_HAIR[recipe.hairStyle];
  const isLong = style === "ponytail" || style === "wavy";
  return isLong && COVERING_HEADWEAR.has(recipe.headwear) ? "low-bun" : style;
}

/**
 * Builds the look of a vendor from the recipe.
 *
 * @param recipe - The vendor recipe.
 * @param spec - The vendor spec (for the paint frame).
 * @returns The figure look.
 */
function vendor_look(recipe: StallVendorRecipe, spec: VendorPaintSpec): FigureLook {
  const silhouette: Silhouette = recipe.seed % 2 === 0 ? "compact" : "classic";
  const top = {
    silhouette,
    colour: recipe.shirt,
    accent: recipe.apronTrim,
    pattern: "plain" as const,
    skin: recipe.skin,
    frame: spec.frame,
  };
  return {
    head: {
      skin: recipe.skin,
      hair: recipe.hair,
      hairStyle: vendor_hair(recipe),
      frame: spec.frame,
    },
    top,
    sleeve: sleeve_for(top),
    lower: {
      skin: recipe.skin,
      legwear: "trousers",
      legwearColour: VENDOR_TROUSERS,
      shoeColour: VENDOR_SHOES,
      frame: spec.frame,
    },
  };
}

/**
 * Gives a vendor's body: the guests' average height, so a vendor drawn at full size behind the
 * counter matches the guests in front of it, with the build varying by stall.
 *
 * @param recipe - The vendor recipe.
 * @returns The body metrics.
 */
export function vendor_metrics(recipe: StallVendorRecipe): BodyMetrics {
  return body_metrics(1, ((recipe.seed >>> 3) % 3) as 0 | 1 | 2);
}

/**
 * Paints one vendor frame.
 *
 * @param ctx - The paint context, translated to the frame's corner.
 * @param spec - The vendor spec.
 * @param facing - The sheet row.
 * @param pose - The sheet column.
 */
export function paint_vendor_frame(
  ctx: PaintContext,
  spec: VendorPaintSpec,
  facing: SheetFacing,
  pose: VendorPose,
): void {
  const recipe = spec.recipe;
  const metrics = vendor_metrics(recipe);
  const described = vendor_frame(pose, metrics, recipe.workAction);
  const rig = build_rig(facing, metrics, described.intent);
  const holdsTool = !pose.startsWith("order");
  const paint_held_tool = (layer: PaintContext, posed: Rig) => {
    if (!holdsTool) return;
    const arm = posed.arms.right;
    paint_tool(
      layer,
      recipe.tool,
      posed.facing,
      arm.end,
      arm.endBody,
      described.toolDirection,
      spec.frame,
      described.isPouring,
    );
  };
  // Seen from behind, the working hand is beyond the body, so the tool goes with the arm;
  // otherwise it is in front of the body and is painted last, over the head if raised.
  const isBehind = facing === "north";
  paint_figure(ctx, rig, vendor_look(recipe, spec), {
    overTorso: (layer, posed) => paint_apron(layer, posed, recipe, spec.frame),
    hand: (layer, posed, arm) => {
      if (isBehind && arm.side === "right") paint_held_tool(layer, posed);
    },
    front: (layer, posed) => {
      paint_headwear(layer, posed, recipe, spec.frame);
      if (!isBehind) paint_held_tool(layer, posed);
    },
  });
}

/**
 * Plans a vendor sprite sheet: {@link SHEET_FACINGS} rows by {@link VENDOR_POSES} columns.
 *
 * @param spec - The vendor spec.
 * @returns The sheet plan with one frame per facing and pose, named `facing/pose`.
 */
export function plan_vendor_sheet(spec: VendorPaintSpec): PaintPlan {
  const frames: SheetFrame[] = SHEET_FACINGS.flatMap((facing, row) =>
    VENDOR_POSES.map((pose, column) => ({
      name: person_frame_name(facing, pose),
      x: column * PERSON_FRAME_WIDTH,
      y: row * PERSON_FRAME_HEIGHT,
      width: PERSON_FRAME_WIDTH,
      height: PERSON_FRAME_HEIGHT,
    })),
  );
  return {
    width: VENDOR_POSES.length * PERSON_FRAME_WIDTH,
    height: SHEET_FACINGS.length * PERSON_FRAME_HEIGHT,
    frames,
    paint: (ctx) => {
      for (const [row, facing] of SHEET_FACINGS.entries()) {
        for (const [column, pose] of VENDOR_POSES.entries()) {
          ctx.save();
          ctx.translate(column * PERSON_FRAME_WIDTH, row * PERSON_FRAME_HEIGHT);
          // Each frame paints only inside its own cell of the sheet.
          ctx.beginPath();
          ctx.rect(0, 0, PERSON_FRAME_WIDTH, PERSON_FRAME_HEIGHT);
          ctx.clip();
          paint_vendor_frame(ctx, spec, facing, pose);
          ctx.restore();
        }
      }
    },
  };
}
