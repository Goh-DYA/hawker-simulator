/**
 * What the ambience painters (lighting, fans and plants) share: the 3/4 oblique conventions
 * they draw with (how far a horizontal circle is foreshortened, how many pixels a metre of
 * height rises), the clip that keeps them inside their footprint, tinted outlines, soft glows,
 * the faint floor shadow a ceiling-hung fitting casts far to the south-east, ceiling cords and
 * the orientation rule for linear objects.
 *
 * Ceiling-hung fittings are drawn as seen from the south and a little above, high in their
 * texture with their cords running up to its top edge, and they never get a contact shadow:
 * their shadow lies on the floor well to the south-east, which is what tells the eye they hang.
 */
import type { Rotation } from "@/src/game/core";

import {
  css,
  fill_circle,
  fill_ellipse,
  glow,
  line,
  radial_gradient,
  shade,
  SHADOW_INK,
  tint,
  TAU,
  type PaintContext,
} from "../canvas";
import { OVERHANG, type PaintFrame } from "../specs";
import { type Box } from "./shared";

/** The ink outlines switch to in high contrast. */
export const INK = 0x263238;
/** The warm lamp light of the Art Bible palette. */
export const LAMP_LIGHT = 0xffd98a;
/** The warm cream of a lit shade interior or diffuser. */
export const LIT_INTERIOR = 0xfff1c6;
/** Dark steel of cords, rods, brackets and clamps. */
export const FITTING_STEEL = 0x4f5f5c;
/**
 * How much a horizontal circle (a pot rim, a rotor disc, a table top) is squashed vertically
 * by the oblique camera: its vertical radius is this fraction of its horizontal radius.
 */
export const FORESHORTEN = 0.62;
/** World pixels a metre of height rises on screen (a 1.7 m guest is about 38 px tall). */
export const PX_PER_METRE = 22;

/**
 * Converts a real-world height to the screen pixels it rises in the oblique view, so standing
 * objects keep real-world scale next to the guests (a 1.1 m tower fan rises 24 px, a 0.7 m
 * bollard 15 px).
 *
 * @param metres - The height in metres.
 * @returns The height in world pixels, rounded to the nearest pixel.
 */
export function standing_height(metres: number): number {
  return Math.round(metres * PX_PER_METRE);
}

/**
 * Picks the outline colour and width for a frame: thin and tinted normally, ink in high
 * contrast.
 *
 * @param base - The colour the tinted outline is shaded from.
 * @param frame - The paint frame.
 * @returns The stroke style and width.
 */
export function outline_style(base: number, frame: PaintFrame): { colour: string; width: number } {
  return frame.isHighContrast
    ? { colour: css(INK), width: 2 }
    : { colour: css(shade(base, 0.55), 0.7), width: 1 };
}

/**
 * Strokes the current path as an outline: tinted from a base colour normally, ink in high
 * contrast.
 *
 * @param ctx - The paint context.
 * @param base - The colour the tinted outline is shaded from.
 * @param frame - The paint frame.
 */
export function stroke_outline(ctx: PaintContext, base: number, frame: PaintFrame): void {
  const edge = outline_style(base, frame);
  ctx.strokeStyle = edge.colour;
  ctx.lineWidth = edge.width;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/**
 * Strokes the current path in ink, but only when the frame is high contrast.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 * @param width - The ink width.
 */
export function ink_current_path(ctx: PaintContext, frame: PaintFrame, width = 1): void {
  if (!frame.isHighContrast) return;
  ctx.strokeStyle = css(INK, 0.9);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/**
 * Clips drawing to the footprint box plus the overhang above it, so no painter leaks past the
 * texture's sides or bottom.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 */
export function clip_texture(ctx: PaintContext, box: Box): void {
  ctx.beginPath();
  ctx.rect(box.x, box.y - OVERHANG, box.width, box.height + OVERHANG);
  ctx.clip();
}

/**
 * Paints a soft elliptical glow (the circular glow stretched to an ellipse).
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius_x - Horizontal radius where the glow fades out.
 * @param radius_y - Vertical radius where the glow fades out.
 * @param colour - The glow colour.
 * @param alpha - Peak opacity at the centre.
 */
export function soft_glow(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius_x: number,
  radius_y: number,
  colour: number,
  alpha: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, Math.max(0.05, radius_y / Math.max(0.1, radius_x)));
  glow(ctx, 0, 0, radius_x, colour, alpha);
  ctx.restore();
}

/**
 * Paints a soft, blurred ellipse of shadow on the floor: the contact shadow of a small standing
 * object, or (fainter and further away) the shadow a hanging fitting casts from high above.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius_x - Horizontal radius.
 * @param radius_y - Vertical radius.
 * @param alpha - Darkness of the shadow.
 */
export function floor_shadow(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius_x: number,
  radius_y: number,
  alpha: number,
): void {
  ctx.save();
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = css(SHADOW_INK, alpha);
  fill_ellipse(ctx, cx, cy, radius_x, radius_y, css(SHADOW_INK, alpha * 0.8));
  ctx.restore();
}

/**
 * Paints a ceiling cord or rod hanging straight down from the top of the texture (the ceiling
 * is out of frame above it), with a small ceiling rose where it leaves the frame.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box, whose overhang top is the ceiling line.
 * @param x - The cord's x.
 * @param bottom_y - Where the cord meets the fitting.
 * @param width - The cord's stroke width.
 */
export function ceiling_cord(
  ctx: PaintContext,
  box: Box,
  x: number,
  bottom_y: number,
  width: number,
): void {
  const top_y = box.y - OVERHANG;
  line(ctx, x, top_y, x, bottom_y, css(FITTING_STEEL), width, "butt");
  if (width >= 1.4) {
    line(
      ctx,
      x - width * 0.25,
      top_y,
      x - width * 0.25,
      bottom_y,
      css(0xffffff, 0.22),
      width * 0.35,
    );
  }
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, top_y, width + 2.5, 2.2, 0, 0, Math.PI);
  ctx.fillStyle = css(tint(FITTING_STEEL, 0.25));
  ctx.fill();
  ctx.restore();
}

/**
 * Paints a lit bulb glow and its bright core, the small light source inside a fitting.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - The bulb radius.
 * @param colour - The light colour.
 */
export function paint_bulb(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  colour: number,
): void {
  fill_circle(
    ctx,
    cx,
    cy,
    radius,
    radial_gradient(ctx, cx - radius * 0.3, cy - radius * 0.3, 0, radius * 1.2, [
      [0, 0xffffff],
      [0.45, tint(colour, 0.6)],
      [1, colour],
    ]),
  );
}

/**
 * Traces an elliptical arc as a fresh path (without stroking it).
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius_x - Horizontal radius.
 * @param radius_y - Vertical radius.
 * @param start - Start angle in radians, clockwise from east.
 * @param end - End angle in radians.
 */
export function arc_path(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius_x: number,
  radius_y: number,
  start = 0,
  end = TAU,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, radius_x), Math.max(0.1, radius_y), 0, start, end);
}

/**
 * Resolves the rotation a linear object is drawn at, so its long side always follows the box:
 * a box taller than wide is a quarter turn, whatever rotation the caller passed.
 *
 * @param box - The rotated footprint box.
 * @param rotation - The placement rotation.
 * @returns The rotation to draw with.
 */
export function resolve_linear_rotation(box: Box, rotation: Rotation): Rotation {
  const is_quarter = rotation === 90 || rotation === 270;
  const is_tall = box.height > box.width;
  if (is_quarter === is_tall || box.width === box.height) return rotation;
  if (is_tall) return rotation === 180 ? 270 : 90;
  return rotation === 270 ? 180 : 0;
}
