/**
 * Limb painters for people: legs with knees and shoes, the lower garment (trousers, jeans,
 * shorts, skirt or long skirt), and arms with sleeves and hands.
 *
 * Limbs are drawn from a posed {@link Rig}, so a stride bends the knee and a reach bends the
 * elbow. Bare skin shows only where the garment leaves it: calves below shorts and skirts,
 * forearms below short sleeves. Far limbs in the side view are dimmed a little, so the near leg
 * and arm read in front.
 */
import {
  css,
  fill_ellipse,
  fill_rounded_rect,
  linear_gradient,
  mix,
  shade,
  tint,
  type PaintContext,
} from "../canvas";
import type { Legwear, PaintFrame } from "../specs";
import {
  fill_lit_path,
  lerp_point,
  limb_stroke,
  lit_ellipse,
  outline_style,
  polyline,
} from "./draw";
import { SIDES, type Chain, type LegChain, type Point, type Rig, type Side } from "./rig";

/** What a figure wears below the waist and on its feet. */
export interface LowerLook {
  readonly skin: number;
  readonly legwear: Legwear;
  readonly legwearColour: number;
  readonly shoeColour: number;
  readonly frame: PaintFrame;
}

/** How a sleeve covers an arm. */
export interface SleeveLook {
  readonly length: "short" | "elbow" | "long";
  readonly colour: number;
  /** Extra width at the sleeve opening (loose sleeves). */
  readonly flare: number;
  /** Colour of a cuff band at the sleeve end, if any. */
  readonly cuff?: number;
  /** Colour of a stripe running down the sleeve, if any. */
  readonly stripe?: number;
}

/** How much a far limb in the side view is darkened. */
const FAR_DIM = 0.14;

/** A dark sole colour for shoes. */
const SOLE_INK = 0x1f1d1b;

/**
 * Gives how much a limb is dimmed: far limbs of the side view sit in the body's shadow.
 *
 * @param rig - The posed rig.
 * @param side - The limb's side.
 * @returns The shade amount.
 */
export function limb_dim(rig: Rig, side: Side): number {
  return rig.facing === "east" && side === "left" ? FAR_DIM : 0;
}

/**
 * Orders the two legs back to front for the facing.
 *
 * @param rig - The posed rig.
 * @returns The legs, farthest first.
 */
function legs_back_to_front(rig: Rig): LegChain[] {
  return SIDES.map((side) => rig.legs[side]).sort((a, b) => a.depth - b.depth);
}

/**
 * Paints a shoe at the end of a leg, seen from the facing.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param leg - The leg.
 * @param colour - The shoe colour.
 * @param frame - The paint frame.
 */
function paint_shoe(
  ctx: PaintContext,
  rig: Rig,
  leg: LegChain,
  colour: number,
  frame: PaintFrame,
): void {
  const dim = limb_dim(rig, leg.side);
  const upper = shade(colour, dim);
  const sole = mix(upper, SOLE_INK, 0.55);
  const half = rig.metrics.legWidth * 0.5 + 0.55;
  const ankle = leg.end;
  const height = rig.metrics.ankle;
  if (rig.facing === "east") {
    ctx.save();
    ctx.translate(ankle.x, ankle.y);
    if (leg.isHeelUp) {
      // Pivot on the toe, so the heel lifts off the floor.
      ctx.translate(3.6, height);
      ctx.rotate(0.5);
      ctx.translate(-3.6, -height);
    } else if (leg.lift > 0) {
      ctx.rotate(0.22);
    }
    ctx.beginPath();
    ctx.moveTo(-1.8, -0.5);
    ctx.quadraticCurveTo(0.6, -1.3, 1.8, -0.2);
    ctx.quadraticCurveTo(4.6, 0.3, 4.4, height + 0.4);
    ctx.lineTo(-1.9, height + 0.4);
    ctx.quadraticCurveTo(-2.4, height * 0.4, -1.8, -0.5);
    ctx.closePath();
    fill_lit_path(ctx, { x: -2, y: -1, width: 6, height: height + 1.5 }, upper, frame);
    fill_rounded_rect(ctx, -2, height - 0.5, 6.4, 1.1, 0.5, css(sole));
    ctx.restore();
    return;
  }
  const isSouth = rig.facing === "south";
  const top = ankle.y - 0.4;
  const bottom = ankle.y + height + (isSouth && !leg.isHeelUp ? 1.1 : 0.4);
  ctx.beginPath();
  ctx.ellipse(ankle.x, (top + bottom) / 2, half, (bottom - top) / 2 + 0.2, 0, 0, Math.PI * 2);
  fill_lit_path(
    ctx,
    { x: ankle.x - half, y: top, width: half * 2, height: bottom - top },
    upper,
    frame,
  );
  // The sole shows along the bottom edge; more of it when the heel is raised.
  const soleHeight = leg.isHeelUp || leg.lift > 0 ? 1.5 : 0.9;
  fill_rounded_rect(
    ctx,
    ankle.x - half + 0.4,
    bottom - soleHeight + 0.2,
    half * 2 - 0.8,
    soleHeight,
    0.6,
    css(sole, 0.9),
  );
  if (!frame.isLowDetail && isSouth) {
    fill_ellipse(
      ctx,
      ankle.x - half * 0.3,
      top + 1.1,
      half * 0.45,
      0.6,
      css(tint(upper, 0.45), 0.6),
    );
  }
}

/**
 * Paints the bare skin of a leg, with a soft knee highlight.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param leg - The leg.
 * @param skin - The skin colour.
 * @param frame - The paint frame.
 */
function paint_bare_leg(
  ctx: PaintContext,
  rig: Rig,
  leg: LegChain,
  skin: number,
  frame: PaintFrame,
): void {
  const colour = shade(skin, limb_dim(rig, leg.side));
  limb_stroke(ctx, [leg.root, leg.joint, leg.end], rig.metrics.legWidth * 0.86, colour, frame);
  if (!frame.isLowDetail) {
    fill_ellipse(ctx, leg.joint.x - 0.3, leg.joint.y, 0.9, 0.7, css(tint(colour, 0.3), 0.55));
  }
}

/**
 * Paints the garment part of one leg: a full trouser leg, a jeans leg with its seam and cuff, or
 * a shorts leg over the bare thigh.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param leg - The leg.
 * @param look - The lower-body look.
 */
function paint_leg_garment(ctx: PaintContext, rig: Rig, leg: LegChain, look: LowerLook): void {
  const cloth = shade(look.legwearColour, limb_dim(rig, leg.side));
  const width = rig.metrics.legWidth;
  if (look.legwear === "trousers" || look.legwear === "jeans") {
    const hem = lerp_point(leg.joint, leg.end, 0.94);
    limb_stroke(ctx, [leg.root, leg.joint, hem], width + 0.5, cloth, look.frame);
    if (look.legwear === "jeans" && !look.frame.isLowDetail) {
      const outward = rig.facing === "east" ? 0 : (leg.root.x < rig.hip.x ? -1 : 1) * width * 0.3;
      polyline(
        ctx,
        [leg.root, leg.joint, hem].map((point) => ({ x: point.x + outward, y: point.y + 0.2 })),
        0.5,
        css(tint(cloth, 0.45), 0.75),
      );
      polyline(ctx, [lerp_point(leg.joint, hem, 0.82), hem], width + 0.9, css(tint(cloth, 0.2)));
    } else if (!look.frame.isLowDetail) {
      // A pressed crease down the trouser front.
      polyline(ctx, [leg.root, leg.joint, hem], 0.45, css(shade(cloth, 0.25), 0.45));
    }
    return;
  }
  if (look.legwear === "shorts") {
    const hem = lerp_point(leg.root, leg.joint, 0.78);
    limb_stroke(ctx, [leg.root, hem], width + 1.2, cloth, look.frame);
    polyline(ctx, [lerp_point(leg.root, hem, 0.85), hem], width + 1.3, css(shade(cloth, 0.12)));
  }
}

/**
 * Traces the pelvis of the lower garment: the waist down to the crotch, joining the legs.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param expand - Pixels the shape grows on every side (for the outline underlay).
 */
function trace_pelvis(ctx: PaintContext, rig: Rig, expand: number): void {
  const { hip, waist, metrics } = rig;
  ctx.beginPath();
  if (rig.facing === "east") {
    const back = hip.x - metrics.depthHalf - 0.3 - expand - (rig.isSeated ? 0.8 : 0);
    const front = hip.x + metrics.depthHalf + 0.2 + expand;
    const top = waist.y - 0.6 - expand;
    const bottom = hip.y + metrics.legWidth * 0.5 + expand;
    ctx.moveTo(back + 1, top);
    ctx.lineTo(front - 0.5, top);
    ctx.quadraticCurveTo(front + 0.3, top, front, top + 2);
    ctx.lineTo(front, bottom - 1);
    ctx.lineTo(back + 2, bottom);
    ctx.quadraticCurveTo(back, bottom, back, bottom - 2.2);
    ctx.lineTo(back + 0.2, top + 1.4);
    ctx.quadraticCurveTo(back + 0.2, top, back + 1, top);
    ctx.closePath();
    return;
  }
  const waistHalf = metrics.waistHalf + 0.2 + expand;
  const hipHalf = metrics.hipHalf + expand;
  const top = waist.y - 0.6 - expand;
  const crotch = hip.y + metrics.legWidth * 0.55 + expand;
  ctx.moveTo(waist.x - waistHalf, top);
  ctx.lineTo(waist.x + waistHalf, top);
  ctx.quadraticCurveTo(hip.x + hipHalf + 0.2, hip.y - 1.5, hip.x + hipHalf, hip.y + 0.6);
  ctx.quadraticCurveTo(hip.x + hipHalf * 0.6, crotch + 0.4, hip.x, crotch);
  ctx.quadraticCurveTo(hip.x - hipHalf * 0.6, crotch + 0.4, hip.x - hipHalf, hip.y + 0.6);
  ctx.quadraticCurveTo(hip.x - hipHalf - 0.2, hip.y - 1.5, waist.x - waistHalf, top);
  ctx.closePath();
}

/**
 * Tells whether a rig shows a seated lap: seated and facing the viewer, so the thighs run
 * towards the camera from the seat.
 *
 * @param rig - The posed rig.
 * @returns True for the seated front view.
 */
function shows_lap(rig: Rig): boolean {
  return rig.isSeated && rig.facing === "south";
}

/**
 * Gives the two knees of a seated rig, the viewer's left one first.
 *
 * @param rig - The posed rig.
 * @returns The knees.
 */
function knees_left_to_right(rig: Rig): [Point, Point] {
  const right = rig.legs.right.joint;
  const left = rig.legs.left.joint;
  return right.x < left.x ? [right, left] : [left, right];
}

/**
 * Traces the lap of a figure seated facing the viewer: the tops of both thighs from the hips to
 * the knees, a horizontal plane seen from above.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param reach - How far towards the knees the shape runs (1 is the knees).
 * @param spread - Extra half width (a skirt is fuller than trousers).
 */
function trace_lap(ctx: PaintContext, rig: Rig, reach: number, spread: number): void {
  const { hip, metrics } = rig;
  const [left, right] = knees_left_to_right(rig);
  const half = metrics.legWidth * 0.55 + spread;
  const leftEnd = lerp_point({ x: hip.x - metrics.legSpread, y: hip.y }, left, reach);
  const rightEnd = lerp_point({ x: hip.x + metrics.legSpread, y: hip.y }, right, reach);
  ctx.beginPath();
  ctx.moveTo(hip.x - metrics.hipHalf - spread * 0.5, hip.y - 1);
  ctx.lineTo(hip.x + metrics.hipHalf + spread * 0.5, hip.y - 1);
  ctx.quadraticCurveTo(rightEnd.x + half + 0.3, hip.y + 0.6, rightEnd.x + half, rightEnd.y);
  ctx.quadraticCurveTo(
    rightEnd.x + half * 0.2,
    rightEnd.y + half * 0.9,
    rightEnd.x - half * 0.6,
    rightEnd.y + half * 0.5,
  );
  ctx.quadraticCurveTo(
    (leftEnd.x + rightEnd.x) / 2,
    rightEnd.y + 0.2,
    leftEnd.x + half * 0.6,
    leftEnd.y + half * 0.5,
  );
  ctx.quadraticCurveTo(leftEnd.x - half * 0.2, leftEnd.y + half * 0.9, leftEnd.x - half, leftEnd.y);
  ctx.quadraticCurveTo(
    leftEnd.x - half - 0.3,
    hip.y + 0.6,
    hip.x - metrics.hipHalf - spread * 0.5,
    hip.y - 1,
  );
  ctx.closePath();
}

/**
 * Paints a seated lap: the tops of the thighs lit from above, the knees catching the light, and
 * the shadow the lap casts on the shins below it, so a seated guest seen from the front reads as
 * sitting rather than standing.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param colour - The garment over the thighs.
 * @param frame - The paint frame.
 * @param reach - How far towards the knees the garment covers.
 * @param spread - Extra half width of the lap shape.
 */
function paint_lap(
  ctx: PaintContext,
  rig: Rig,
  colour: number,
  frame: PaintFrame,
  reach: number,
  spread: number,
): void {
  const [left, right] = knees_left_to_right(rig);
  const half = rig.metrics.legWidth * 0.55 + spread;
  if (!frame.isLowDetail) {
    // The lap's shadow on the shins just below the knees.
    for (const knee of [left, right]) {
      fill_ellipse(ctx, knee.x + 0.3, knee.y + half + 0.4, half * 0.9, 0.9, css(SOLE_INK, 0.22));
    }
  }
  trace_lap(ctx, rig, reach, spread);
  ctx.fillStyle = linear_gradient(ctx, 0, rig.hip.y - 1, 0, Math.max(left.y, right.y) + half, [
    [0, tint(colour, 0.08)],
    [0.55, tint(colour, 0.2)],
    [1, colour],
  ]);
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = frame.isHighContrast ? 1.4 : 0.7;
  ctx.strokeStyle = outline_style(colour, frame);
  ctx.stroke();
  if (frame.isLowDetail || reach < 1) return;
  // The crease between the thighs and the lit knee caps.
  polyline(
    ctx,
    [
      { x: rig.hip.x, y: rig.hip.y + 0.4 },
      { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 + half * 0.3 },
    ],
    0.5,
    css(shade(colour, 0.35), 0.6),
  );
  for (const knee of [left, right]) {
    fill_ellipse(
      ctx,
      knee.x - 0.3,
      knee.y - 0.1,
      half * 0.55,
      half * 0.4,
      css(tint(colour, 0.32), 0.6),
    );
  }
}

/**
 * Paints a skirt or long skirt over the legs. The hem follows the legs, so it swings with a
 * stride and drapes over the lap when seated.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param look - The lower-body look.
 */
function paint_skirt(ctx: PaintContext, rig: Rig, look: LowerLook): void {
  const { hip, waist, metrics } = rig;
  const isLong = look.legwear === "long-skirt";
  if (shows_lap(rig)) {
    paint_seated_skirt(ctx, rig, look, isLong);
    return;
  }
  const right = rig.legs.right;
  const left = rig.legs.left;
  // Seen from behind, a seated skirt falls over the seat; the legs are under the table.
  const isTucked = rig.isSeated && rig.facing === "north";
  const hem_of = (leg: LegChain) =>
    isTucked
      ? hip.y + (isLong ? 3.2 : 2.2)
      : isLong
        ? leg.end.y + metrics.ankle * 0.25
        : leg.joint.y + (rig.isSeated ? 0.9 : 0.6);
  const top = waist.y - 0.6;
  ctx.beginPath();
  if (rig.facing === "east") {
    const back = hip.x - metrics.depthHalf - 0.4;
    const front = hip.x + metrics.depthHalf + 0.3;
    const reach = isLong ? [right.end, left.end] : [right.joint, left.joint];
    const backHem = Math.min(...reach.map((point) => point.x)) - 1.8;
    const frontHem = Math.max(...reach.map((point) => point.x)) + 1.8;
    const hemY = (hem_of(right) + hem_of(left)) / 2;
    ctx.moveTo(back, top);
    ctx.lineTo(front, top);
    if (rig.isSeated) {
      // Over the lap to the knee, then (long) down the shins.
      const knee = right.joint;
      ctx.lineTo(knee.x + 1.6, knee.y - metrics.legWidth * 0.55);
      if (isLong) {
        ctx.lineTo(knee.x + 2, hemY);
        ctx.lineTo(knee.x - 2.4, hemY);
      } else {
        ctx.lineTo(knee.x + 1.4, knee.y + 1.4);
      }
      ctx.lineTo(hip.x - 0.5, hip.y + metrics.legWidth * 0.7);
      ctx.quadraticCurveTo(back - 0.6, hip.y + 1, back, top + 1);
    } else {
      ctx.lineTo(frontHem, hemY);
      ctx.quadraticCurveTo((frontHem + backHem) / 2, hemY + 1, backHem, hemY);
    }
    ctx.closePath();
  } else {
    const flare = isLong ? 2.6 : 2.1;
    const [viewLeft, viewRight] = right.end.x < left.end.x ? [right, left] : [left, right];
    const leftHem = hem_of(viewLeft);
    const rightHem = hem_of(viewRight);
    const leftX = Math.min(viewLeft.joint.x, viewLeft.end.x) - metrics.legWidth / 2 - flare;
    const rightX = Math.max(viewRight.joint.x, viewRight.end.x) + metrics.legWidth / 2 + flare;
    ctx.moveTo(waist.x - metrics.waistHalf - 0.3, top);
    ctx.lineTo(waist.x + metrics.waistHalf + 0.3, top);
    ctx.quadraticCurveTo(hip.x + metrics.hipHalf + 0.6, hip.y, rightX, rightHem);
    ctx.quadraticCurveTo(hip.x, (leftHem + rightHem) / 2 + 1.2, leftX, leftHem);
    ctx.quadraticCurveTo(
      hip.x - metrics.hipHalf - 0.6,
      hip.y,
      waist.x - metrics.waistHalf - 0.3,
      top,
    );
    ctx.closePath();
  }
  fill_lit_path(
    ctx,
    { x: hip.x - 8, y: top, width: 16, height: Math.max(4, hem_of(right) - top) },
    look.legwearColour,
    look.frame,
  );
  if (look.frame.isLowDetail) return;
  // Soft folds from the waist to the hem.
  const folds = rig.facing === "east" ? [-1.5, 1.5] : [-2.6, 0, 2.6];
  for (const offset of folds) {
    polyline(
      ctx,
      [
        { x: hip.x + offset * 0.6, y: top + 2 },
        { x: hip.x + offset, y: Math.min(hem_of(right), hem_of(left)) - 0.8 },
      ],
      0.6,
      css(shade(look.legwearColour, 0.28), 0.4),
    );
  }
  fill_rounded_rect(
    ctx,
    waist.x - (rig.facing === "east" ? metrics.depthHalf : metrics.waistHalf),
    top,
    (rig.facing === "east" ? metrics.depthHalf : metrics.waistHalf) * 2,
    1.4,
    0.6,
    css(shade(look.legwearColour, 0.18)),
  );
}

/**
 * Paints a skirt on a figure seated facing the viewer: the cloth drawn tight over the lap to the
 * knees, lit from above, and (for a long skirt) falling from the knees in shadow towards the
 * ankles.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param look - The lower-body look.
 * @param isLong - True for a long skirt.
 */
function paint_seated_skirt(ctx: PaintContext, rig: Rig, look: LowerLook, isLong: boolean): void {
  const { waist, metrics } = rig;
  const [left, right] = knees_left_to_right(rig);
  const cloth = look.legwearColour;
  const half = metrics.legWidth * 0.55 + 1.1;
  if (isLong) {
    const hemY = Math.max(rig.legs.right.end.y, rig.legs.left.end.y) - 0.4;
    ctx.beginPath();
    ctx.moveTo(left.x - half, left.y);
    ctx.lineTo(right.x + half, right.y);
    ctx.quadraticCurveTo(right.x + half + 0.9, (right.y + hemY) / 2, right.x + half + 0.6, hemY);
    ctx.quadraticCurveTo((left.x + right.x) / 2, hemY + 0.9, left.x - half - 0.6, hemY);
    ctx.quadraticCurveTo(left.x - half - 0.9, (left.y + hemY) / 2, left.x - half, left.y);
    ctx.closePath();
    fill_lit_path(
      ctx,
      { x: left.x - half, y: left.y, width: right.x - left.x + half * 2, height: hemY - left.y },
      shade(cloth, 0.12),
      look.frame,
    );
    if (!look.frame.isLowDetail) {
      for (const share of [0.3, 0.7]) {
        const x = left.x + (right.x - left.x) * share;
        polyline(
          ctx,
          [
            { x, y: left.y + 1.4 },
            { x: x + (share - 0.5) * 1.6, y: hemY - 0.6 },
          ],
          0.55,
          css(shade(cloth, 0.38), 0.45),
        );
      }
    }
  }
  paint_lap(ctx, rig, cloth, look.frame, 1, 1.1);
  // The skirt's waist, over the top of the lap.
  fill_rounded_rect(
    ctx,
    waist.x - metrics.waistHalf - 0.2,
    waist.y - 0.6,
    (metrics.waistHalf + 0.2) * 2,
    rig.hip.y - waist.y + 0.2,
    0.8,
    css(cloth),
  );
}

/**
 * Paints the lower body: legs (bare where the garment allows), the lower garment and shoes, back
 * to front. Seated figures seen from the north hide their legs under the table in front of them.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param look - The lower-body look.
 */
export function paint_lower_body(ctx: PaintContext, rig: Rig, look: LowerLook): void {
  const hidesLegs = rig.isSeated && rig.facing === "north";
  const hasSkirt = look.legwear === "skirt" || look.legwear === "long-skirt";
  const hasPelvis = !hasSkirt;
  if (hasPelvis) {
    trace_pelvis(ctx, rig, look.frame.isHighContrast ? 1.1 : 0.55);
    ctx.fillStyle = outline_style(look.legwearColour, look.frame);
    ctx.fill();
  }
  if (!hidesLegs) {
    for (const leg of legs_back_to_front(rig)) {
      const isBare =
        look.legwear === "shorts" || look.legwear === "skirt" || look.legwear === "long-skirt";
      if (isBare) paint_bare_leg(ctx, rig, leg, look.skin, look.frame);
      paint_leg_garment(ctx, rig, leg, look);
      paint_shoe(ctx, rig, leg, look.shoeColour, look.frame);
    }
  }
  if (hasPelvis) {
    trace_pelvis(ctx, rig, 0);
    ctx.fillStyle = linear_gradient(ctx, rig.hip.x - 6, rig.waist.y, rig.hip.x + 6, rig.hip.y + 3, [
      [0, tint(look.legwearColour, 0.1)],
      [1, shade(look.legwearColour, 0.16)],
    ]);
    ctx.fill();
    if (shows_lap(rig)) {
      paint_lap(
        ctx,
        rig,
        look.legwearColour,
        look.frame,
        look.legwear === "shorts" ? 0.74 : 1,
        0.3,
      );
    }
    if (look.legwear === "jeans" && !look.frame.isLowDetail && rig.facing !== "east") {
      // Fly seam and a back or front pocket hint.
      polyline(
        ctx,
        [
          { x: rig.hip.x + 0.6, y: rig.waist.y + 0.6 },
          { x: rig.hip.x + 0.6, y: rig.hip.y + 0.8 },
        ],
        0.5,
        css(tint(look.legwearColour, 0.4), 0.7),
      );
    }
  } else {
    paint_skirt(ctx, rig, look);
  }
}

/**
 * Paints a hand as a small lit volume at the end of the forearm.
 *
 * @param ctx - The paint context.
 * @param arm - The arm.
 * @param skin - The skin colour.
 * @param width - The arm thickness.
 * @param frame - The paint frame.
 * @param dim - How much to darken the hand.
 */
export function paint_hand(
  ctx: PaintContext,
  arm: Chain,
  skin: number,
  width: number,
  frame: PaintFrame,
  dim: number,
): void {
  const dx = arm.end.x - arm.joint.x;
  const dy = arm.end.y - arm.joint.y;
  const length = Math.hypot(dx, dy) || 1;
  // A hand is a little longer than the wrist is wide and points along the forearm; a forearm
  // seen end-on shows the hand nearly round.
  const along = Math.min(1, length / 3);
  const centre: Point = {
    x: arm.end.x + (dx / length) * 0.9 * along,
    y: arm.end.y + (dy / length) * 0.9 * along,
  };
  const half = width * 0.42 + 0.2;
  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.rotate(Math.atan2(dy, dx));
  lit_ellipse(ctx, { x: 0, y: 0 }, half * (1 + 0.35 * along), half, shade(skin, dim), frame);
  ctx.restore();
}

/**
 * Paints an arm: bare skin, the sleeve over its share of the arm, an optional stripe and cuff,
 * and the hand.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param arm - The arm.
 * @param sleeve - How the sleeve covers the arm.
 * @param skin - The skin colour.
 * @param frame - The paint frame.
 */
export function paint_arm(
  ctx: PaintContext,
  rig: Rig,
  arm: Chain,
  sleeve: SleeveLook,
  skin: number,
  frame: PaintFrame,
): void {
  const dim = limb_dim(rig, arm.side);
  const width = rig.metrics.armWidth;
  const colour = shade(sleeve.colour, dim);
  if (sleeve.length !== "long") {
    limb_stroke(ctx, [arm.root, arm.joint, arm.end], width * 0.9, shade(skin, dim), frame);
  }
  const covered: Point[] =
    sleeve.length === "short"
      ? [arm.root, lerp_point(arm.root, arm.joint, 0.62)]
      : sleeve.length === "elbow"
        ? [arm.root, lerp_point(arm.root, arm.joint, 1.08)]
        : [arm.root, arm.joint, lerp_point(arm.joint, arm.end, 0.86)];
  limb_stroke(ctx, covered, width + 0.5 + sleeve.flare, colour, frame);
  const opening = covered[covered.length - 1] as Point;
  const before = covered[covered.length - 2] as Point;
  if (sleeve.stripe !== undefined && !frame.isLowDetail) {
    const side = rig.facing === "east" ? 0 : arm.root.x < rig.shoulder.x ? -1 : 1;
    polyline(
      ctx,
      covered.map((point) => ({ x: point.x + side * width * 0.32, y: point.y })),
      0.8,
      css(shade(sleeve.stripe, dim)),
    );
  }
  const cuff = sleeve.cuff ?? shade(colour, 0.14);
  polyline(
    ctx,
    [lerp_point(before, opening, 0.84), opening],
    width + 0.7 + sleeve.flare,
    css(shade(cuff, dim)),
  );
  paint_hand(ctx, arm, skin, width, frame, dim);
}
