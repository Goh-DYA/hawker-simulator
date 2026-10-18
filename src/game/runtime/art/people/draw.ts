/**
 * Drawing helpers the people painters share: tinted outlines (thick ink only in high contrast),
 * rounded limb strokes with a lit edge, and filled shapes with a soft north-west light.
 *
 * Every helper is a pure function of its arguments over a {@link PaintContext}, so the figures
 * stay deterministic and paint the same calls into a recording context as onto a canvas.
 */
import {
  css,
  linear_gradient,
  radial_gradient,
  shade,
  SHADOW_INK,
  tint,
  type PaintContext,
  type PaintStyle,
} from "../canvas";
import type { PaintFrame } from "../specs";
import type { Point } from "./rig";

/**
 * Gives the outline style of a part: its own colour shaded, thin and translucent, or solid ink
 * in high contrast.
 *
 * @param colour - The part's colour.
 * @param frame - The paint frame.
 * @returns The stroke style.
 */
export function outline_style(colour: number, frame: PaintFrame): string {
  return frame.isHighContrast ? css(SHADOW_INK, 1) : css(shade(colour, 0.55), 0.72);
}

/**
 * Gives the extra width an outlined stroke adds to a part.
 *
 * @param frame - The paint frame.
 * @returns The total extra width (half on each side).
 */
export function outline_extra(frame: PaintFrame): number {
  return frame.isHighContrast ? 2.2 : 1.1;
}

/**
 * Gives the line width of a shape's outline stroke.
 *
 * @param frame - The paint frame.
 * @returns The stroke width.
 */
export function outline_width(frame: PaintFrame): number {
  return frame.isHighContrast ? 1.6 : 0.8;
}

/**
 * Strokes a polyline with round caps and joins.
 *
 * @param ctx - The paint context.
 * @param points - The points, at least two.
 * @param width - The stroke width.
 * @param style - The stroke style.
 */
export function polyline(
  ctx: PaintContext,
  points: readonly Point[],
  width: number,
  style: PaintStyle,
): void {
  const [first, ...rest] = points;
  if (!first || rest.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const point of rest) ctx.lineTo(point.x, point.y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.stroke();
}

/**
 * Paints a rounded limb segment: a tinted outline, the base colour and a lit edge towards the
 * north-west key light.
 *
 * @param ctx - The paint context.
 * @param points - The limb's points (root to end).
 * @param width - The limb thickness.
 * @param colour - The material colour.
 * @param frame - The paint frame.
 */
export function limb_stroke(
  ctx: PaintContext,
  points: readonly Point[],
  width: number,
  colour: number,
  frame: PaintFrame,
): void {
  polyline(ctx, points, width + outline_extra(frame), outline_style(colour, frame));
  polyline(ctx, points, width, css(colour));
  if (frame.isLowDetail) return;
  const lit = points.map((point) => ({ x: point.x - width * 0.2, y: point.y - 0.15 }));
  polyline(ctx, lit, Math.max(0.6, width * 0.32), css(tint(colour, 0.32), 0.45));
}

/**
 * Fills the current path with a soft north-west-lit gradient and strokes its tinted outline.
 *
 * @param ctx - The paint context (with a path already traced).
 * @param box - The shape's bounds, for the gradient.
 * @param colour - The material colour.
 * @param frame - The paint frame.
 * @param options - `lift` brightens the lit side, `drop` darkens the shaded side.
 */
export function fill_lit_path(
  ctx: PaintContext,
  box: { x: number; y: number; width: number; height: number },
  colour: number,
  frame: PaintFrame,
  options: { lift?: number; drop?: number } = {},
): void {
  ctx.fillStyle = linear_gradient(ctx, box.x, box.y, box.x + box.width, box.y + box.height * 0.7, [
    [0, tint(colour, options.lift ?? 0.14)],
    [0.5, colour],
    [1, shade(colour, options.drop ?? 0.2)],
  ]);
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = outline_width(frame);
  ctx.strokeStyle = outline_style(colour, frame);
  ctx.stroke();
}

/**
 * Fills an ellipse as a lit, outlined volume (heads, hands, buns).
 *
 * @param ctx - The paint context.
 * @param centre - The centre.
 * @param radiusX - Horizontal radius.
 * @param radiusY - Vertical radius.
 * @param colour - The material colour.
 * @param frame - The paint frame.
 */
export function lit_ellipse(
  ctx: PaintContext,
  centre: Point,
  radiusX: number,
  radiusY: number,
  colour: number,
  frame: PaintFrame,
): void {
  ctx.beginPath();
  ctx.ellipse(
    centre.x,
    centre.y,
    Math.max(0.2, radiusX),
    Math.max(0.2, radiusY),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = radial_gradient(
    ctx,
    centre.x - radiusX * 0.35,
    centre.y - radiusY * 0.4,
    0,
    Math.max(radiusX, radiusY) * 1.25,
    [
      [0, tint(colour, 0.16)],
      [0.6, colour],
      [1, shade(colour, 0.18)],
    ],
  );
  ctx.fill();
  ctx.lineWidth = outline_width(frame);
  ctx.strokeStyle = outline_style(colour, frame);
  ctx.stroke();
}

/**
 * Interpolates between two points.
 *
 * @param a - The start.
 * @param b - The end.
 * @param t - 0 at `a`, 1 at `b`.
 * @returns The point between.
 */
export function lerp_point(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
