/**
 * The figure painter: paints one posed person into one frame, back to front, from a rig and a
 * look, with hooks for the layers customers and vendors add (bags, aprons, headwear and tools).
 *
 * The order follows the 3/4 view: the contact shadow, hair that falls behind the body, limbs on
 * the far side, the legs and lower garment, the neck and upper garment, limbs on the near side,
 * then the head, its face and hair. Which arm is near depends on the facing and the pose: the
 * side view's far arm is behind the body, and a hand reaching away from the camera goes behind
 * the torso.
 */
import { radial_gradient, SHADOW_INK, type PaintContext } from "../canvas";
import { PERSON_FEET_Y } from "../specs";
import { paint_hair, paint_hair_behind, paint_head, paint_neck, type HeadLook } from "./head";
import { paint_arm, paint_lower_body, type LowerLook, type SleeveLook } from "./limbs";
import { SIDES, type Chain, type Rig } from "./rig";
import { paint_top, type TopLook } from "./top";

/** Everything a figure wears and looks like. */
export interface FigureLook {
  readonly head: HeadLook;
  readonly top: TopLook;
  readonly sleeve: SleeveLook;
  readonly lower: LowerLook;
}

/** A layer hook: paints extra parts at one point of the figure's order. */
export type FigureLayer = (ctx: PaintContext, rig: Rig) => void;

/** The layers customers and vendors add to the base figure. */
export interface FigureLayers {
  /** Painted after the shadow, behind the whole body. */
  readonly behind?: FigureLayer;
  /** Painted over the upper garment, under the near arms (aprons, bag straps). */
  readonly overTorso?: FigureLayer;
  /** Painted after the near arms, before the head (bags, backpacks seen from behind). */
  readonly beforeHead?: FigureLayer;
  /** Painted last (headwear, props in hand). */
  readonly front?: FigureLayer;
  /** Painted right after an arm, so a prop in that hand layers with it. */
  readonly hand?: (ctx: PaintContext, rig: Rig, arm: Chain) => void;
}

/** How far behind the body a hand must be before its arm is drawn behind the torso. */
const BEHIND_DEPTH = -1.2;

/**
 * Paints the soft elliptical contact shadow at the feet, offset to the south-east. A seated
 * figure casts a smaller one where its feet rest, ahead of the seat (the seat casts its own),
 * and none when seen from behind, where the feet are hidden beyond the seat.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 */
export function paint_contact_shadow(ctx: PaintContext, rig: Rig): void {
  if (rig.isSeated && rig.facing === "north") return;
  const m = rig.metrics;
  const feetX = (rig.legs.right.end.x + rig.legs.left.end.x) / 2;
  const feetY = rig.isSeated
    ? Math.max(rig.legs.right.end.y, rig.legs.left.end.y) + m.ankle
    : PERSON_FEET_Y;
  const radiusX =
    (rig.facing === "east" ? m.depthHalf + 5 : m.hipHalf + 3.6) * (rig.isSeated ? 0.6 : 1);
  const radiusY = rig.isSeated ? 1.8 : 2.7;
  ctx.save();
  ctx.translate(feetX + 1, feetY + 0.8);
  ctx.scale(1, radiusY / radiusX);
  ctx.beginPath();
  ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
  ctx.fillStyle = radial_gradient(ctx, 0, 0, 0, radiusX, [
    [0, SHADOW_INK, 0.3],
    [0.65, SHADOW_INK, 0.2],
    [1, SHADOW_INK, 0],
  ]);
  ctx.fill();
  ctx.restore();
}

/**
 * Tells whether an arm is drawn behind the torso.
 *
 * @param rig - The posed rig.
 * @param arm - The arm.
 * @returns True when the arm is on the far side or reaching away from the camera.
 */
function is_arm_behind(rig: Rig, arm: Chain): boolean {
  if (rig.facing === "east") return arm.side === "left";
  return arm.depth < BEHIND_DEPTH;
}

/**
 * Paints a posed figure.
 *
 * @param ctx - The paint context, translated to the frame's top-left corner.
 * @param rig - The posed rig.
 * @param look - The figure's look.
 * @param layers - Extra layers the caller adds.
 */
export function paint_figure(
  ctx: PaintContext,
  rig: Rig,
  look: FigureLook,
  layers: FigureLayers = {},
): void {
  const arms = SIDES.map((side) => rig.arms[side]);
  const paint_one_arm = (arm: Chain) => {
    paint_arm(ctx, rig, arm, look.sleeve, look.head.skin, look.head.frame);
    layers.hand?.(ctx, rig, arm);
  };
  paint_contact_shadow(ctx, rig);
  layers.behind?.(ctx, rig);
  paint_hair_behind(ctx, rig, look.head);
  for (const arm of arms) if (is_arm_behind(rig, arm)) paint_one_arm(arm);
  paint_lower_body(ctx, rig, look.lower);
  paint_neck(ctx, rig, look.head.skin);
  paint_top(ctx, rig, look.top);
  layers.overTorso?.(ctx, rig);
  for (const arm of arms) if (!is_arm_behind(rig, arm)) paint_one_arm(arm);
  layers.beforeHead?.(ctx, rig);
  paint_head(ctx, rig, look.head);
  paint_hair(ctx, rig, look.head);
  layers.front?.(ctx, rig);
}
