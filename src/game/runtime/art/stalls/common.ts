/**
 * The shared vocabulary of the stall painters: the material palette, the boxes and slabs the
 * stall geometry hands out, the scene a stall is painted from and the small primitives every
 * stall module builds on (plain rectangles, clips, ambient-occlusion bands, lit cylinders,
 * specular glints, arcs, the Peranakan rosette and the tinted or high-contrast outline).
 *
 * A slab is a block seen in the 3/4 oblique view: its footprint on the floor is lifted by its
 * height to give the top surface, and its south face fills the strip between the lifted top and
 * the footprint's south edge.
 */
import {
  css,
  fill_circle,
  fill_rounded_rect,
  linear_gradient,
  shade,
  SHADOW_INK,
  stroke_rounded_rect,
  tint,
  type PaintContext,
  type PaintStyle,
} from "../canvas";
import type { StallPaintSpec } from "../specs";
import type { StallGeometry } from "./geometry";
import type { StallDressing } from "./identity";

/** Warm plaster. */
export const PLASTER = 0xf4e7d3;
/** Zinc roofing. */
export const ZINC = 0x9aa8a6;
/** Brushed stainless steel. */
export const STEEL = 0xc9d3d0;
/** Stainless steel in shade. */
export const STEEL_DARK = 0x7e8b88;
/** Light timber. */
export const TIMBER = 0xb07a47;
/** Dark timber. */
export const TIMBER_DARK = 0x6b462d;
/** Sign ink. */
export const INK = 0x263238;
/** Warm lamp light. */
export const LAMP = 0xffd98a;
/** Vermilion accent. */
export const VERMILION = 0xd95d39;
/** Mustard accent. */
export const MUSTARD = 0xd5a021;
/** Charcoal and seasoned iron. */
export const CHARCOAL = 0x2b3231;
/** Glowing ember. */
export const EMBER = 0xff7a3a;
/** Gas flame. */
export const FLAME = 0xf0a13b;
/** Clear glass. */
export const GLASS = 0xdfeef0;
/** Fired clay. */
export const CLAY = 0xb8613d;
/** Brass fittings. */
export const BRASS = 0xb08d3a;
/** Sign cream. */
export const CREAM = 0xfff6e2;
/** Poured concrete kerbs. */
export const CONCRETE = 0xcfc6b4;
/** Porcelain white. */
export const PORCELAIN = 0xf6f2ea;

/** A rectangle in texture pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A block standing on the floor: `y` is the north edge of its footprint, `depth` the footprint's
 * north-south extent and `height` how far the block rises (and so how far its top is lifted).
 */
export interface Slab {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

/** Everything the stall painters share while painting one texture. */
export interface StallScene {
  readonly ctx: PaintContext;
  readonly spec: StallPaintSpec;
  readonly geo: StallGeometry;
  readonly dressing: StallDressing;
  readonly seed: number;
  readonly isLowDetail: boolean;
  readonly isHighContrast: boolean;
}

/**
 * Gives the top surface of a slab, as seen from above: its footprint lifted by its height.
 *
 * @param slab - The slab.
 * @returns The top surface box.
 */
export function slab_top(slab: Slab): Box {
  return { x: slab.x, y: slab.y - slab.height, width: slab.width, height: slab.depth };
}

/**
 * Gives the south face of a slab: the strip from its lifted top's south edge to the floor.
 *
 * @param slab - The slab.
 * @returns The south face box.
 */
export function slab_face(slab: Slab): Box {
  return {
    x: slab.x,
    y: slab.y + slab.depth - slab.height,
    width: slab.width,
    height: slab.height,
  };
}

/**
 * Fills a plain rectangle.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height.
 * @param style - The fill style.
 */
export function fill_rect(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  style: PaintStyle,
): void {
  ctx.fillStyle = style;
  ctx.fillRect(x, y, width, height);
}

/**
 * Fills a box.
 *
 * @param ctx - The paint context.
 * @param box - The box.
 * @param style - The fill style.
 */
export function fill_box(ctx: PaintContext, box: Box, style: PaintStyle): void {
  fill_rect(ctx, box.x, box.y, box.width, box.height, style);
}

/**
 * Clips the following drawing to a box until the caller's matching `restore()`.
 *
 * @param ctx - The paint context.
 * @param box - The clip box.
 */
export function clip_box(ctx: PaintContext, box: Box): void {
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
}

/**
 * Lays a vertical shadow fade over a rectangle, for ambient occlusion where parts meet and for
 * the shade a canopy casts.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height of the fade.
 * @param alpha - Darkness at the dark end.
 * @param isDarkAtTop - True when the shadow falls from the top edge; false from the bottom.
 */
export function shade_band(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
  isDarkAtTop = true,
): void {
  if (height <= 0 || width <= 0) return;
  fill_rect(
    ctx,
    x,
    y,
    width,
    height,
    linear_gradient(ctx, 0, y, 0, y + height, [
      [0, SHADOW_INK, isDarkAtTop ? alpha : 0],
      [1, SHADOW_INK, isDarkAtTop ? 0 : alpha],
    ]),
  );
}

/**
 * Lays a horizontal shadow fade over a rectangle, for the occlusion beside posts and walls.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width of the fade.
 * @param height - Height.
 * @param alpha - Darkness at the dark end.
 * @param isDarkAtLeft - True when the shadow falls from the left edge; false from the right.
 */
export function shade_band_x(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
  isDarkAtLeft = true,
): void {
  if (height <= 0 || width <= 0) return;
  fill_rect(
    ctx,
    x,
    y,
    width,
    height,
    linear_gradient(ctx, x, 0, x + width, 0, [
      [0, SHADOW_INK, isDarkAtLeft ? alpha : 0],
      [1, SHADOW_INK, isDarkAtLeft ? 0 : alpha],
    ]),
  );
}

/**
 * Paints a metal or ceramic body lit from the left, as a vertical cylinder seen from the side.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height.
 * @param radius - Corner radius.
 * @param base - The body colour.
 */
export function fill_cylinder(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  base: number,
): void {
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    radius,
    linear_gradient(ctx, x, 0, x + width, 0, [
      [0, tint(base, 0.35)],
      [0.4, base],
      [1, shade(base, 0.32)],
    ]),
  );
}

/**
 * Paints a soft specular glint on a vertical body.
 *
 * @param ctx - The paint context.
 * @param x - Left of the glint.
 * @param y - Top of the glint.
 * @param height - Height of the glint.
 * @param alpha - Opacity.
 */
export function specular(
  ctx: PaintContext,
  x: number,
  y: number,
  height: number,
  alpha = 0.35,
): void {
  if (height <= 0) return;
  fill_rounded_rect(ctx, x, y, 1.2, height, 0.6, css(0xffffff, alpha));
}

/**
 * Strokes an arc, for handles, hooks and rims.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - The radius.
 * @param start - Start angle in radians.
 * @param end - End angle in radians.
 * @param style - The stroke style.
 * @param lineWidth - The stroke width.
 */
export function stroke_arc(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
  style: PaintStyle,
  lineWidth: number,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.1, radius), start, end);
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Paints a four-petal rosette, the motif of the Peranakan tiles.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Reach of the petals.
 * @param petal - Petal colour.
 * @param centre - Centre dot colour.
 */
export function paint_rosette(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  petal: number,
  centre: number,
): void {
  const reach = radius * 0.55;
  const size = radius * 0.46;
  fill_circle(ctx, cx - reach, cy, size, css(petal));
  fill_circle(ctx, cx + reach, cy, size, css(petal));
  fill_circle(ctx, cx, cy - reach, size, css(petal));
  fill_circle(ctx, cx, cy + reach, size, css(petal));
  fill_circle(ctx, cx, cy, size * 0.7, css(centre));
}

/**
 * Strokes the outline that separates a part from what is behind it: thin and tinted from the
 * part's colour normally, thick ink in high contrast.
 *
 * @param scene - The stall scene.
 * @param box - The part's box.
 * @param radius - Corner radius.
 * @param colourValue - The part's colour the outline is shaded from.
 */
export function edge_outline(
  scene: StallScene,
  box: Box,
  radius: number,
  colourValue: number,
): void {
  const { ctx, isHighContrast } = scene;
  stroke_rounded_rect(
    ctx,
    box.x + 0.5,
    box.y + 0.5,
    Math.max(1, box.width - 1),
    Math.max(1, box.height - 1),
    radius,
    css(isHighContrast ? INK : shade(colourValue, 0.55), isHighContrast ? 1 : 0.7),
    isHighContrast ? 2 : 1,
  );
}
