/**
 * Customer accessory painters: a tote on the shoulder, a briefcase in the right hand, a backpack
 * (its straps from the front, the whole pack from behind and in profile) and a walking stick.
 *
 * Accessories are drawn in the guest's accent colour (timber for the stick). They are placed on
 * the posed rig, so a briefcase swings with its hand and a stick stays planted ahead of the feet,
 * and they stay plausible when the side view is mirrored for a west-facing guest.
 */
import { css, fill_rounded_rect, shade, tint, type PaintContext } from "../canvas";
import type { CustomerPaintSpec, PaintFrame } from "../specs";
import { fill_lit_path, limb_stroke, polyline } from "./draw";
import { project, type Chain, type Rig } from "./rig";

/** A carried prop, or none. */
export type Accessory = CustomerPaintSpec["accessory"];

/** The walking stick's timber. */
const STICK = 0x6b462d;

/** Briefcase leather is the accent pushed darker. */
const CASE_SHADE = 0.42;

/**
 * Tells whether an accessory is held in the right hand (so the pose keeps that hand on it).
 *
 * @param accessory - The accessory.
 * @returns True for the briefcase and the walking stick.
 */
export function is_hand_held(accessory: Accessory): boolean {
  return accessory === "briefcase" || accessory === "walking-aid";
}

/**
 * Fills a rounded box as a lit, outlined volume.
 *
 * @param ctx - The paint context.
 * @param box - The box.
 * @param radius - Corner radius.
 * @param colour - The material colour.
 * @param frame - The paint frame.
 */
function lit_box(
  ctx: PaintContext,
  box: { x: number; y: number; width: number; height: number },
  radius: number,
  colour: number,
  frame: PaintFrame,
): void {
  const r = Math.min(radius, box.width / 2, box.height / 2);
  ctx.beginPath();
  ctx.moveTo(box.x + r, box.y);
  ctx.lineTo(box.x + box.width - r, box.y);
  ctx.quadraticCurveTo(box.x + box.width, box.y, box.x + box.width, box.y + r);
  ctx.lineTo(box.x + box.width, box.y + box.height - r);
  ctx.quadraticCurveTo(
    box.x + box.width,
    box.y + box.height,
    box.x + box.width - r,
    box.y + box.height,
  );
  ctx.lineTo(box.x + r, box.y + box.height);
  ctx.quadraticCurveTo(box.x, box.y + box.height, box.x, box.y + box.height - r);
  ctx.lineTo(box.x, box.y + r);
  ctx.quadraticCurveTo(box.x, box.y, box.x + r, box.y);
  ctx.closePath();
  fill_lit_path(ctx, box, colour, frame);
}

/**
 * Paints the backpack seen from behind: the pack over the upper back with its pocket and loop.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param accent - The bag colour.
 * @param frame - The paint frame.
 */
function paint_backpack_back(ctx: PaintContext, rig: Rig, accent: number, frame: PaintFrame): void {
  const m = rig.metrics;
  const width = m.shoulderHalf * 1.25;
  const height = m.torso * 0.88;
  const x = rig.shoulder.x - width / 2;
  const y = rig.shoulder.y + 0.4;
  polyline(
    ctx,
    [
      { x: rig.shoulder.x - 1.2, y: y + 0.2 },
      { x: rig.shoulder.x + 1.2, y: y + 0.2 },
    ],
    1.4,
    css(shade(accent, 0.3)),
  );
  lit_box(ctx, { x, y: y + 0.6, width, height }, 2.6, accent, frame);
  lit_box(
    ctx,
    { x: x + 1.4, y: y + height * 0.48, width: width - 2.8, height: height * 0.45 },
    1.6,
    shade(accent, 0.1),
    frame,
  );
  if (!frame.isLowDetail) {
    polyline(
      ctx,
      [
        { x: x + 1.8, y: y + height * 0.45 },
        { x: x + width - 1.8, y: y + height * 0.45 },
      ],
      0.5,
      css(tint(accent, 0.5), 0.7),
    );
  }
}

/**
 * Paints the backpack in profile, behind the back, with its near strap over the shoulder.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param accent - The bag colour.
 * @param frame - The paint frame.
 */
function paint_backpack_side(ctx: PaintContext, rig: Rig, accent: number, frame: PaintFrame): void {
  const m = rig.metrics;
  const back = rig.shoulder.x - m.depthHalf - 0.2;
  lit_box(
    ctx,
    { x: back - 3.6, y: rig.shoulder.y + 0.2, width: 4.6, height: m.torso * 0.86 },
    1.8,
    accent,
    frame,
  );
}

/**
 * Paints the straps of a backpack seen from the front, or the near strap in profile.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param accent - The bag colour.
 */
function paint_backpack_straps(ctx: PaintContext, rig: Rig, accent: number): void {
  const m = rig.metrics;
  const strap = css(shade(accent, 0.18));
  if (rig.facing === "east") {
    polyline(
      ctx,
      [
        { x: rig.shoulder.x - m.depthHalf + 0.6, y: rig.shoulder.y + 0.2 },
        { x: rig.shoulder.x + 0.6, y: rig.shoulder.y + 0.6 },
        { x: rig.hip.x - m.depthHalf * 0.4, y: rig.shoulder.y + m.torso * 0.75 },
      ],
      1.3,
      strap,
    );
    return;
  }
  for (const sign of [-1, 1]) {
    polyline(
      ctx,
      [
        { x: rig.shoulder.x + sign * (m.shoulderHalf * 0.45), y: rig.shoulder.y - 0.4 },
        { x: rig.shoulder.x + sign * (m.shoulderHalf * 0.55), y: rig.shoulder.y + m.torso * 0.7 },
      ],
      1.3,
      strap,
    );
  }
}

/**
 * Paints a tote bag hanging from the shoulder at the hip, with its strap.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param accent - The bag colour.
 * @param frame - The paint frame.
 */
function paint_tote(ctx: PaintContext, rig: Rig, accent: number, frame: PaintFrame): void {
  const m = rig.metrics;
  const isSide = rig.facing === "east";
  // South: the person's left is the viewer's right; north: the viewer's left.
  const side = rig.facing === "south" ? 1 : -1;
  // In profile the bag hangs against the near hip, a little behind the body's centre.
  const bagX = isSide ? rig.hip.x - 1.4 : rig.hip.x + side * (m.hipHalf + 1.6);
  const bagTop = rig.waist.y - 0.4;
  const width = isSide ? 5.8 : 3.6;
  const height = m.torso * 0.62;
  const shoulder = isSide
    ? { x: rig.shoulder.x - 0.4, y: rig.shoulder.y + 0.2 }
    : { x: rig.shoulder.x + side * (m.shoulderHalf * 0.55), y: rig.shoulder.y - 0.3 };
  polyline(
    ctx,
    [shoulder, { x: bagX + (isSide ? 1.2 : -side * 0.6), y: bagTop + 0.5 }],
    0.9,
    css(shade(accent, 0.25)),
  );
  lit_box(ctx, { x: bagX - width / 2, y: bagTop, width, height }, 1.2, accent, frame);
  if (!frame.isLowDetail) {
    fill_rounded_rect(
      ctx,
      bagX - width / 2 + 0.6,
      bagTop + height * 0.42,
      width - 1.2,
      0.8,
      0.3,
      css(tint(accent, 0.35), 0.7),
    );
  }
}

/**
 * Paints a briefcase hanging from a hand.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param arm - The arm holding it.
 * @param accent - The case colour (darkened to leather).
 * @param frame - The paint frame.
 */
function paint_briefcase(
  ctx: PaintContext,
  rig: Rig,
  arm: Chain,
  accent: number,
  frame: PaintFrame,
): void {
  const leather = shade(accent, CASE_SHADE);
  const isSide = rig.facing === "east";
  const width = isSide ? 8.4 : 3;
  const height = 6.2;
  const x = arm.end.x - width / 2 + (isSide ? 0.6 : 0);
  const y = arm.end.y + 1.6;
  polyline(
    ctx,
    [
      { x: arm.end.x - 1.2, y: y + 0.2 },
      { x: arm.end.x - 1, y: arm.end.y + 0.4 },
      { x: arm.end.x + 1, y: arm.end.y + 0.4 },
      { x: arm.end.x + 1.2, y: y + 0.2 },
    ],
    0.8,
    css(shade(leather, 0.3)),
  );
  lit_box(ctx, { x, y, width, height }, 1, leather, frame);
  if (isSide && !frame.isLowDetail) {
    fill_rounded_rect(ctx, x + width / 2 - 1, y + 1.4, 2, 1, 0.3, css(0xc9b37a));
  }
}

/**
 * Paints a walking stick from the hand to the floor just ahead of the feet.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param arm - The arm holding it.
 * @param frame - The paint frame.
 */
function paint_stick(ctx: PaintContext, rig: Rig, arm: Chain, frame: PaintFrame): void {
  const tip = project(rig.facing, {
    right: arm.endBody.right + 0.8,
    forward: arm.endBody.forward + 1.4,
    up: 0,
  });
  const handle = { x: arm.end.x, y: arm.end.y - 1 };
  limb_stroke(ctx, [handle, tip], 1.3, STICK, frame);
  const crook = rig.facing === "east" ? 1 : rig.facing === "south" ? -1 : 1;
  polyline(
    ctx,
    [handle, { x: handle.x + crook * 2.4, y: handle.y - 0.6 }],
    1.4,
    css(shade(STICK, 0.1)),
  );
  polyline(ctx, [{ x: tip.x, y: tip.y - 1 }, tip], 1.6, css(0x2b2b2b));
}

/**
 * Builds the accessory layers of a customer for one pose.
 *
 * @param accessory - The carried prop.
 * @param accent - The prop colour.
 * @param frame - The paint frame.
 * @param isHandFree - False while both hands hold a tray or rest on a table (no briefcase or
 *   stick then).
 * @returns The layer hooks for the figure painter.
 */
export function accessory_layers(
  accessory: Accessory,
  accent: number,
  frame: PaintFrame,
  isHandFree: boolean,
): {
  behind?: (ctx: PaintContext, rig: Rig) => void;
  overTorso?: (ctx: PaintContext, rig: Rig) => void;
  beforeHead?: (ctx: PaintContext, rig: Rig) => void;
  hand?: (ctx: PaintContext, rig: Rig, arm: Chain) => void;
} {
  switch (accessory) {
    case "backpack":
      return {
        behind: (ctx, rig) => {
          if (rig.facing === "east") paint_backpack_side(ctx, rig, accent, frame);
        },
        overTorso: (ctx, rig) => {
          if (rig.facing !== "north") paint_backpack_straps(ctx, rig, accent);
        },
        beforeHead: (ctx, rig) => {
          if (rig.facing === "north") paint_backpack_back(ctx, rig, accent, frame);
        },
      };
    case "tote":
      return {
        overTorso: (ctx, rig) => paint_tote(ctx, rig, accent, frame),
      };
    case "briefcase":
      return isHandFree
        ? {
            hand: (ctx, rig, arm) => {
              if (arm.side === "right") paint_briefcase(ctx, rig, arm, accent, frame);
            },
          }
        : {};
    case "walking-aid":
      return isHandFree
        ? {
            hand: (ctx, rig, arm) => {
              if (arm.side === "right") paint_stick(ctx, rig, arm, frame);
            },
          }
        : {};
    case "none":
      return {};
  }
}
