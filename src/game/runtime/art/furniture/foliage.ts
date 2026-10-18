/**
 * Foliage primitives for the plant painters, drawn in the 3/4 oblique view: arching pinnate
 * fronds whose leaflets hang under gravity (areca palms, ferns), tapered strap leaves along a
 * curve (pandan, chives, sedge), banana paddle leaves, heart-shaped taro leaves, curving vines
 * and soft rounded leaf clusters.
 *
 * Every primitive paints in at least three greens, darker where leaves face away from the
 * north-west key light, with small highlights, a thin tinted edge and an ink edge only in high
 * contrast. Low detail drops leaflets and veins but keeps the silhouette.
 */
import {
  css,
  fill_ellipse,
  line,
  linear_gradient,
  seeded,
  shade,
  TAU,
  tint,
  type PaintContext,
} from "../canvas";
import { type PaintFrame } from "../specs";
import { ink_current_path } from "./ambience";
import { LEAF_DARK, LEAF_LIGHT } from "./shared";

/** The Art Bible leaf green. */
export const LEAF_MID = 0x4f7d4a;
/** A fresh mid-light green between the Art Bible leaf and the light foliage tone. */
export const LEAF_FRESH = 0x6a9a5b;
/** The highlight on the lightest leaves. */
export const LEAF_HIGHLIGHT = tint(LEAF_LIGHT, 0.4);
/** The greens from darkest to lightest. */
export const GREENS = [LEAF_DARK, LEAF_MID, LEAF_FRESH, LEAF_LIGHT] as const;
/** Cream variegation of pothos leaves. */
export const VARIEGATION = 0xe7e3a0;

/** A point in texture pixels. */
export type Point = readonly [number, number];

/** A quadratic curve: start, control and end. */
export interface Curve {
  readonly from: Point;
  readonly control: Point;
  readonly to: Point;
}

/**
 * Evaluates a point and the unit tangent along a quadratic curve.
 *
 * @param curve - The curve.
 * @param t - Position along it, 0 to 1.
 * @returns The point and the unit tangent.
 */
export function curve_point(
  curve: Curve,
  t: number,
): { x: number; y: number; tx: number; ty: number } {
  const u = 1 - t;
  const x = u * u * curve.from[0] + 2 * u * t * curve.control[0] + t * t * curve.to[0];
  const y = u * u * curve.from[1] + 2 * u * t * curve.control[1] + t * t * curve.to[1];
  const dx = 2 * u * (curve.control[0] - curve.from[0]) + 2 * t * (curve.to[0] - curve.control[0]);
  const dy = 2 * u * (curve.control[1] - curve.from[1]) + 2 * t * (curve.to[1] - curve.control[1]);
  const length = Math.hypot(dx, dy) || 1;
  return { x, y, tx: dx / length, ty: dy / length };
}

/**
 * Strokes a quadratic curve as a stem or midrib.
 *
 * @param ctx - The paint context.
 * @param curve - The curve.
 * @param colour - The stem colour.
 * @param width - The stroke width.
 */
export function stroke_curve(ctx: PaintContext, curve: Curve, colour: string, width: number): void {
  ctx.beginPath();
  ctx.moveTo(curve.from[0], curve.from[1]);
  ctx.quadraticCurveTo(curve.control[0], curve.control[1], curve.to[0], curve.to[1]);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

/** How an arching pinnate frond is drawn. */
export interface FrondOptions {
  readonly colour: number;
  /** Longest leaflet length, near the frond's base. */
  readonly leaflet: number;
  readonly pairs: number;
  /** How much the leaflets hang down under gravity, 0 (straight out) to 1 (straight down). */
  readonly droop: number;
  readonly frame: PaintFrame;
  readonly stem_width?: number;
}

/**
 * Paints an arching pinnate frond (areca palm, fern): a curved midrib with narrow leaflets in
 * pairs that hang down under gravity and shorten towards the tip.
 *
 * @param ctx - The paint context.
 * @param curve - The midrib.
 * @param options - Colour, leaflet size, pair count, droop and frame.
 */
export function paint_arching_frond(ctx: PaintContext, curve: Curve, options: FrondOptions): void {
  const { colour, frame } = options;
  const pairs = frame.isLowDetail ? Math.ceil(options.pairs * 0.6) : options.pairs;
  for (let pair = 1; pair <= pairs; pair += 1) {
    const t = pair / (pairs + 1);
    const point = curve_point(curve, t);
    const size = options.leaflet * (1 - t * 0.55) * Math.min(1, 0.45 + t * 3);
    for (const side of [-1, 1] as const) {
      let dx = -point.ty * side * (1 - options.droop) + point.tx * 0.45;
      let dy = point.tx * side * (1 - options.droop) + point.ty * 0.45 + options.droop;
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      const tone = side < 0 ? tint(colour, 0.14) : shade(colour, 0.12);
      ctx.save();
      ctx.translate(point.x + (dx * size) / 2, point.y + (dy * size) / 2);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.ellipse(0, 0, size / 2, Math.max(0.7, size * 0.15), 0, 0, TAU);
      ctx.fillStyle = css(pair % 2 === 0 ? tone : colour);
      ctx.fill();
      // Small leaflets (ferns) stay un-inked so a dense crown does not turn into a dark blot.
      if (size >= 5) ink_current_path(ctx, frame, 0.6);
      ctx.restore();
    }
  }
  stroke_curve(ctx, curve, css(shade(colour, 0.3)), options.stem_width ?? 1);
  if (frame.isHighContrast) stroke_curve(ctx, curve, css(0x263238, 0.8), 0.6);
}

/**
 * Paints a tapered strap leaf along a curve (pandan, chives, sedge): widest at the base,
 * darker there and lighter at the tip, with a pale crease down its middle.
 *
 * @param ctx - The paint context.
 * @param curve - The leaf's centre line from base to tip.
 * @param width - The width at the base.
 * @param colour - The green.
 * @param frame - The paint frame.
 */
export function paint_strap_leaf(
  ctx: PaintContext,
  curve: Curve,
  width: number,
  colour: number,
  frame: PaintFrame,
): void {
  const steps = frame.isLowDetail ? 4 : 7;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const point = curve_point(curve, t);
    const half = (width / 2) * (1 - t * 0.92);
    left.push([point.x - point.ty * half, point.y + point.tx * half]);
    right.push([point.x + point.ty * half, point.y - point.tx * half]);
  }
  ctx.beginPath();
  const [first, ...rest] = left;
  if (!first) return;
  ctx.moveTo(first[0], first[1]);
  for (const [x, y] of rest) ctx.lineTo(x, y);
  for (const [x, y] of [...right].reverse()) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, curve.from[0], curve.from[1], curve.to[0], curve.to[1], [
    [0, shade(colour, 0.3)],
    [0.6, colour],
    [1, tint(colour, 0.22)],
  ]);
  ctx.fill();
  ink_current_path(ctx, frame, 0.7);
  if (!frame.isLowDetail && width >= 2.4) {
    stroke_curve(
      ctx,
      {
        from: curve.from,
        control: curve.control,
        to: [
          curve.to[0] * 0.9 + curve.control[0] * 0.1,
          curve.to[1] * 0.9 + curve.control[1] * 0.1,
        ],
      },
      css(tint(colour, 0.45), 0.55),
      0.6,
    );
  }
}

/**
 * Traces a paddle leaf along +x: a narrow stalk swelling to a broad blade with a rounded tip.
 *
 * @param ctx - The paint context.
 * @param length - The leaf length.
 * @param width - The leaf's widest extent.
 */
function paddle_path(ctx: PaintContext, length: number, width: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(length * 0.12, -width * 0.7, length * 0.82, -width * 0.62, length, 0);
  ctx.bezierCurveTo(length * 0.8, width * 0.55, length * 0.12, width * 0.66, 0, 0);
  ctx.closePath();
}

/**
 * Paints a banana paddle leaf: a broad blade lit on its upper half, with a pale midrib,
 * parallel veins and wind splits along its edges.
 *
 * @param ctx - The paint context.
 * @param x - Base x.
 * @param y - Base y.
 * @param angle - Direction in radians, clockwise from east.
 * @param length - Leaf length.
 * @param width - Leaf width.
 * @param colour - The green.
 * @param seed - Seed for the split positions.
 * @param frame - The paint frame.
 */
export function paint_paddle_leaf(
  ctx: PaintContext,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  colour: number,
  seed: number,
  frame: PaintFrame,
): void {
  const next = seeded(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  paddle_path(ctx, length, width);
  ctx.fillStyle = linear_gradient(ctx, 0, -width / 2, 0, width / 2, [
    [0, tint(colour, 0.24)],
    [0.5, colour],
    [1, shade(colour, 0.32)],
  ]);
  ctx.fill();
  ctx.strokeStyle = frame.isHighContrast ? css(0x263238, 0.9) : css(shade(colour, 0.5), 0.6);
  ctx.lineWidth = frame.isHighContrast ? 1.2 : 0.8;
  ctx.stroke();
  if (!frame.isLowDetail) {
    const veins = 7;
    for (let vein = 1; vein <= veins; vein += 1) {
      const along = length * (0.12 + 0.78 * (vein / veins));
      const half = width * 0.6 * Math.sin((Math.PI * along) / length);
      line(ctx, along, 0, along + half * 0.45, -half, css(shade(colour, 0.3), 0.3), 0.6);
      line(ctx, along, 0, along + half * 0.45, half, css(shade(colour, 0.3), 0.3), 0.6);
    }
    for (let split = 0; split < 3; split += 1) {
      const along = length * (0.3 + next() * 0.55);
      const side = split % 2 === 0 ? -1 : 1;
      const half = width * 0.6 * Math.sin((Math.PI * along) / length);
      line(
        ctx,
        along + half * 0.45,
        side * half,
        along + half * 0.18,
        side * half * 0.35,
        css(shade(colour, 0.65), 0.7),
        0.9,
      );
    }
  }
  line(ctx, 1, 0, length - 3, 0, css(tint(colour, 0.5), 0.75), 1.2);
  ctx.restore();
}

/**
 * Paints a heart-shaped taro leaf hanging from the top of its stalk, tip down, with radiating
 * veins.
 *
 * @param ctx - The paint context.
 * @param x - Where the stalk meets the leaf.
 * @param y - Where the stalk meets the leaf.
 * @param size - The leaf's length.
 * @param angle - The tilt of the leaf's axis from straight down, in radians.
 * @param colour - The green.
 * @param frame - The paint frame.
 */
export function paint_heart_leaf(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  angle: number,
  colour: number,
  frame: PaintFrame,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-size * 0.25, -size * 0.3, -size * 0.75, -size * 0.1, -size * 0.55, size * 0.4);
  ctx.quadraticCurveTo(-size * 0.35, size * 0.8, 0, size);
  ctx.quadraticCurveTo(size * 0.35, size * 0.8, size * 0.55, size * 0.4);
  ctx.bezierCurveTo(size * 0.75, -size * 0.1, size * 0.25, -size * 0.3, 0, 0);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, -size * 0.6, -size * 0.2, size * 0.6, size, [
    [0, tint(colour, 0.25)],
    [0.55, colour],
    [1, shade(colour, 0.35)],
  ]);
  ctx.fill();
  ctx.strokeStyle = frame.isHighContrast ? css(0x263238, 0.9) : css(shade(colour, 0.5), 0.6);
  ctx.lineWidth = frame.isHighContrast ? 1.2 : 0.8;
  ctx.stroke();
  line(ctx, 0, 0, 0, size * 0.95, css(tint(colour, 0.45), 0.7), 0.9);
  if (!frame.isLowDetail) {
    for (const side of [-1, 1] as const) {
      for (let vein = 1; vein <= 3; vein += 1) {
        const along = size * vein * 0.22;
        line(
          ctx,
          0,
          along,
          side * size * (0.42 - vein * 0.06),
          along + size * 0.16,
          css(tint(colour, 0.35), 0.45),
          0.6,
        );
      }
    }
  }
  ctx.restore();
}

/**
 * Evaluates a cubic Bezier curve.
 *
 * @param points - Start, two controls and end.
 * @param t - Position along the curve, 0 to 1.
 * @returns The point.
 */
export function cubic_point(
  points: readonly [Point, Point, Point, Point],
  t: number,
): { x: number; y: number } {
  const [p0, p1, p2, p3] = points;
  const u = 1 - t;
  return {
    x: u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    y: u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  };
}

/**
 * Paints a vine: a curving stem with alternate heart-ish leaves along it that shrink towards
 * its tip.
 *
 * @param ctx - The paint context.
 * @param points - The stem's cubic Bezier control points.
 * @param leaves - Leaves along the stem.
 * @param leaf - The largest leaf radius.
 * @param frame - The paint frame.
 * @param is_variegated - Cream flecks on some leaves (pothos).
 */
export function paint_vine(
  ctx: PaintContext,
  points: readonly [Point, Point, Point, Point],
  leaves: number,
  leaf: number,
  frame: PaintFrame,
  is_variegated = false,
): void {
  const [p0, p1, p2, p3] = points;
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
  ctx.strokeStyle = css(shade(LEAF_MID, 0.35));
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.stroke();
  const count = frame.isLowDetail ? Math.ceil(leaves * 0.6) : leaves;
  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.6) / (count + 0.2);
    const point = cubic_point(points, t);
    const ahead = cubic_point(points, Math.min(1, t + 0.05));
    const heading = Math.atan2(ahead.y - point.y, ahead.x - point.x);
    const side = index % 2 === 0 ? -1 : 1;
    const size = leaf * (1 - t * 0.4);
    const colour = GREENS[(index + 1) % GREENS.length] ?? LEAF_MID;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(heading + side * 1.1);
    ctx.beginPath();
    ctx.ellipse(size * 0.9, 0, size, size * 0.7, 0, 0, TAU);
    ctx.fillStyle = css(colour);
    ctx.fill();
    ink_current_path(ctx, frame, 0.7);
    line(ctx, 0, 0, size * 1.5, 0, css(tint(colour, 0.4), 0.6), 0.6);
    if (is_variegated && index % 2 === 0) {
      fill_ellipse(ctx, size * 1.1, -size * 0.25, size * 0.38, size * 0.24, css(VARIEGATION, 0.85));
    }
    ctx.restore();
  }
}

/** How a soft leaf cluster is scattered. */
export interface ClusterOptions {
  readonly count: number;
  /** Largest leaf radius. */
  readonly leaf: number;
  readonly spread_x: number;
  readonly spread_y: number;
  readonly seed: number;
  readonly frame: PaintFrame;
  /** Cream flecks on some leaves (pothos). */
  readonly is_variegated?: boolean;
}

/** A leaf of a cluster, before it is sorted into paint order. */
interface ClusterLeaf {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly angle: number;
  /** Position along the key light, -1 at the north-west edge to 1 at the south-east edge. */
  readonly light: number;
  readonly index: number;
}

/**
 * Paints a rounded cluster of small leaves (basil, a pothos crown, bougainvillea foliage): a
 * dark underside pass, then the leaves from the shaded south-east to the lit north-west, with
 * highlights on the lightest.
 *
 * @param ctx - The paint context.
 * @param cx - Cluster centre x.
 * @param cy - Cluster centre y.
 * @param options - Count, leaf size, spread, seed and frame.
 */
export function paint_leaf_cluster(
  ctx: PaintContext,
  cx: number,
  cy: number,
  options: ClusterOptions,
): void {
  const next = seeded(options.seed);
  const count = options.frame.isLowDetail ? Math.ceil(options.count * 0.6) : options.count;
  const leaves: ClusterLeaf[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next());
    const x = cx + Math.cos(angle) * distance * options.spread_x;
    const y = cy + Math.sin(angle) * distance * options.spread_y;
    const rx = options.leaf * (0.7 + next() * 0.5);
    const light =
      ((x - cx) / Math.max(1, options.spread_x) + (y - cy) / Math.max(1, options.spread_y)) / 2;
    leaves.push({ x, y, rx, ry: rx * (0.6 + next() * 0.3), angle: next() * Math.PI, light, index });
  }
  leaves.sort((a, b) => b.light - a.light || a.index - b.index);
  for (const leaf of leaves) {
    ctx.save();
    ctx.translate(leaf.x + 1, leaf.y + 1.8);
    ctx.rotate(leaf.angle);
    fill_ellipse(ctx, 0, 0, leaf.rx, leaf.ry, css(shade(LEAF_DARK, 0.3), 0.85));
    ctx.restore();
  }
  for (const leaf of leaves) {
    const colour =
      leaf.light > 0.45
        ? LEAF_DARK
        : leaf.light > 0.05
          ? LEAF_MID
          : leaf.light > -0.4
            ? LEAF_FRESH
            : LEAF_LIGHT;
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf.rx, leaf.ry, 0, 0, TAU);
    ctx.fillStyle = css(colour);
    ctx.fill();
    ink_current_path(ctx, options.frame, 0.7);
    if (!options.frame.isLowDetail) {
      line(ctx, -leaf.rx * 0.7, 0, leaf.rx * 0.75, 0, css(tint(colour, 0.35), 0.55), 0.6);
    }
    if (options.is_variegated && leaf.index % 3 !== 1) {
      fill_ellipse(
        ctx,
        leaf.rx * 0.2,
        -leaf.ry * 0.3,
        leaf.rx * 0.35,
        leaf.ry * 0.3,
        css(VARIEGATION, 0.85),
      );
    }
    ctx.restore();
  }
  for (const leaf of leaves.slice(-3)) {
    fill_ellipse(
      ctx,
      leaf.x - leaf.rx * 0.3,
      leaf.y - leaf.ry * 0.35,
      leaf.rx * 0.3,
      leaf.ry * 0.3,
      css(LEAF_HIGHLIGHT, 0.8),
    );
  }
}
