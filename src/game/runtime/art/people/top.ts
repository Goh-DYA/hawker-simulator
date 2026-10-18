/**
 * Upper-garment painters for people: the six outfit silhouettes (a compact tee, a relaxed loose
 * shirt, a structured collared shirt with a placket, a layered open jacket over an inner shirt,
 * a sporty hoodie with a stripe, and a classic short-sleeved shirt with collar points and
 * buttons) and the five garment patterns drawn in the accent colour.
 *
 * Each silhouette has its own cut (sleeve length, ease, hem drop and flare), so outfits differ in
 * shape as well as colour, and each is drawn for the south (front), north (back) and east
 * (profile) views of a posed {@link Rig}.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  mix,
  shade,
  SHADOW_INK,
  tint,
  type PaintContext,
} from "../canvas";
import type { CustomerPaintSpec, PaintFrame } from "../specs";
import { fill_lit_path, outline_style, outline_width, polyline } from "./draw";
import type { SleeveLook } from "./limbs";
import type { Rig } from "./rig";

/** An outfit silhouette. */
export type Silhouette = CustomerPaintSpec["silhouette"];

/** A garment pattern. */
export type Pattern = CustomerPaintSpec["pattern"];

/** What a figure wears on its upper body. */
export interface TopLook {
  readonly silhouette: Silhouette;
  readonly colour: number;
  readonly accent: number;
  readonly pattern: Pattern;
  readonly skin: number;
  readonly frame: PaintFrame;
}

/** The cut of a silhouette. */
interface GarmentCut {
  readonly sleeve: SleeveLook["length"];
  readonly sleeveFlare: number;
  /** Extra half width over the body. */
  readonly ease: number;
  /** Hem below the hip joints (negative is tucked in above them). */
  readonly hemDrop: number;
  /** Extra half width at the hem. */
  readonly flare: number;
}

/** The cut of every silhouette. */
const CUTS: Readonly<Record<Silhouette, GarmentCut>> = {
  compact: { sleeve: "short", sleeveFlare: 0.3, ease: 0, hemDrop: 1.3, flare: 0.1 },
  relaxed: { sleeve: "elbow", sleeveFlare: 1.3, ease: 1.1, hemDrop: 3.4, flare: 1.6 },
  structured: { sleeve: "long", sleeveFlare: 0, ease: 0.3, hemDrop: -1.3, flare: 0 },
  layered: { sleeve: "long", sleeveFlare: 0.4, ease: 0.9, hemDrop: 3.6, flare: 0.9 },
  sporty: { sleeve: "long", sleeveFlare: 0.3, ease: 0.8, hemDrop: 1.8, flare: -0.3 },
  classic: { sleeve: "short", sleeveFlare: 0.8, ease: 0.5, hemDrop: 2, flare: 0.4 },
};

/** A leather belt colour. */
const BELT = 0x3b2a20;

/** The outline geometry of a torso garment. */
interface TorsoShape {
  readonly top: number;
  readonly hem: number;
  readonly left: number;
  readonly right: number;
  /** Half width at the shoulders (or, in the side view, the half depth). */
  readonly shoulderHalf: number;
  readonly hemHalf: number;
}

/**
 * Gives the colour of the inner shirt under an open jacket: a pale version of the jacket.
 *
 * @param colour - The jacket colour.
 * @returns The inner shirt colour.
 */
function inner_shirt(colour: number): number {
  return mix(colour, 0xf4efe6, 0.74);
}

/**
 * Describes the sleeves of a top, for the arm painter.
 *
 * @param look - The upper-body look.
 * @returns The sleeve look.
 */
export function sleeve_for(look: TopLook): SleeveLook {
  const cut = CUTS[look.silhouette];
  const base = { length: cut.sleeve, colour: look.colour, flare: cut.sleeveFlare };
  switch (look.silhouette) {
    case "structured":
      return { ...base, cuff: tint(look.colour, 0.16) };
    case "layered":
      return { ...base, cuff: inner_shirt(look.colour) };
    case "sporty":
      return { ...base, cuff: shade(look.colour, 0.16), stripe: tint(look.colour, 0.66) };
    default:
      return look.pattern === "piped" ? { ...base, cuff: look.accent } : base;
  }
}

/**
 * Traces the torso garment's outline for the rig's facing and returns its geometry.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param cut - The garment cut.
 * @returns The torso shape.
 */
function trace_torso(ctx: PaintContext, rig: Rig, cut: GarmentCut): TorsoShape {
  const m = rig.metrics;
  const sx = rig.shoulder.x;
  const top = rig.shoulder.y - 0.6;
  const hx = rig.hip.x;
  const hem = rig.hip.y + (rig.isSeated ? Math.min(cut.hemDrop, 1.2) : cut.hemDrop);
  ctx.beginPath();
  if (rig.facing === "east") {
    const depth = m.depthHalf + cut.ease * 0.5;
    const front = hx + depth + cut.flare * 0.4 + (rig.isSeated ? 0.6 : 0);
    const back = hx - depth - cut.flare * 0.4;
    ctx.moveTo(sx - 0.6, top - 0.2);
    ctx.quadraticCurveTo(sx + depth, top - 0.2, sx + depth, top + 2.2);
    ctx.quadraticCurveTo(sx + depth + 1.1, (top + hem) / 2, front, hem - 1);
    ctx.quadraticCurveTo(front, hem, front - 1, hem);
    ctx.lineTo(back + 1, hem);
    ctx.quadraticCurveTo(back, hem, back, hem - 1);
    ctx.quadraticCurveTo(sx - depth - 0.4, (top + hem) / 2, sx - depth, top + 2.4);
    ctx.quadraticCurveTo(sx - depth, top - 0.2, sx - 0.6, top - 0.2);
    ctx.closePath();
    return { top, hem, left: back, right: front, shoulderHalf: depth, hemHalf: depth };
  }
  const shoulderHalf = m.shoulderHalf + cut.ease * 0.5;
  const waistHalf = m.waistHalf + cut.ease;
  const hemHalf = m.hipHalf + cut.ease + cut.flare + (rig.isSeated ? 0.8 : 0);
  const neckHalf = m.headWidth * 0.2;
  const wx = rig.waist.x;
  const wy = rig.waist.y;
  ctx.moveTo(sx - neckHalf, top);
  ctx.quadraticCurveTo(sx - shoulderHalf, top, sx - shoulderHalf, top + 2.6);
  ctx.quadraticCurveTo(sx - shoulderHalf + 0.2, wy - 1.5, wx - waistHalf, wy);
  ctx.lineTo(hx - hemHalf, hem - 1);
  ctx.quadraticCurveTo(hx - hemHalf, hem, hx - hemHalf + 1.2, hem);
  ctx.quadraticCurveTo(hx, hem + 0.8, hx + hemHalf - 1.2, hem);
  ctx.quadraticCurveTo(hx + hemHalf, hem, hx + hemHalf, hem - 1);
  ctx.lineTo(wx + waistHalf, wy);
  ctx.quadraticCurveTo(sx + shoulderHalf - 0.2, wy - 1.5, sx + shoulderHalf, top + 2.6);
  ctx.quadraticCurveTo(sx + shoulderHalf, top, sx + neckHalf, top);
  ctx.quadraticCurveTo(sx, top + (rig.facing === "south" ? 2.2 : 0.9), sx - neckHalf, top);
  ctx.closePath();
  return {
    top,
    hem,
    left: Math.min(sx - shoulderHalf, hx - hemHalf),
    right: Math.max(sx + shoulderHalf, hx + hemHalf),
    shoulderHalf,
    hemHalf,
  };
}

/**
 * Paints the accent pattern over a torso, clipped to it.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param shape - The torso shape (its path must be the current path).
 * @param look - The upper-body look.
 */
function paint_pattern(ctx: PaintContext, rig: Rig, shape: TorsoShape, look: TopLook): void {
  const accent = css(look.accent);
  const height = shape.hem - shape.top;
  const sx = rig.shoulder.x;
  const hx = rig.hip.x;
  ctx.save();
  ctx.clip();
  switch (look.pattern) {
    case "banded":
      ctx.fillStyle = accent;
      ctx.fillRect(
        shape.left - 2,
        shape.top + height * 0.36,
        shape.right - shape.left + 4,
        height * 0.16,
      );
      ctx.fillRect(
        shape.left - 2,
        shape.top + height * 0.6,
        shape.right - shape.left + 4,
        height * 0.07,
      );
      break;
    case "panelled":
      if (rig.facing === "east") {
        fill_rounded_rect(ctx, (sx + hx) / 2 - 1.4, shape.top - 1, 2.8, height + 2, 0.5, accent);
      } else {
        const panel = shape.shoulderHalf * 0.36;
        ctx.fillStyle = accent;
        ctx.fillRect(shape.left - 2, shape.top, panel + 2, height + 1);
        ctx.fillRect(shape.right - panel, shape.top, panel + 2, height + 1);
        ctx.fillRect(shape.left - 2, shape.top - 1, shape.right - shape.left + 4, 2.4);
      }
      break;
    case "sashed": {
      const direction = rig.facing === "north" ? -1 : 1;
      const from =
        rig.facing === "east"
          ? { x: sx - shape.shoulderHalf, y: shape.top + 1 }
          : { x: sx - direction * shape.shoulderHalf * 0.75, y: shape.top };
      const to =
        rig.facing === "east"
          ? { x: hx + shape.hemHalf, y: shape.hem - 1 }
          : { x: hx + direction * shape.hemHalf, y: shape.hem };
      polyline(ctx, [from, to], 2.8, accent);
      polyline(ctx, [from, to], 0.6, css(tint(look.accent, 0.4), 0.7));
      break;
    }
    case "piped":
      polyline(
        ctx,
        [
          { x: shape.left - 1, y: shape.hem - 1.4 },
          { x: shape.right + 1, y: shape.hem - 1.4 },
        ],
        0.9,
        accent,
      );
      if (rig.facing === "east") {
        polyline(
          ctx,
          [
            { x: sx, y: shape.top },
            { x: hx, y: shape.hem },
          ],
          0.9,
          accent,
        );
      } else {
        for (const sign of [-1, 1]) {
          polyline(
            ctx,
            [
              { x: sx + sign * (shape.shoulderHalf - 1.1), y: shape.top + 1.6 },
              { x: hx + sign * (shape.hemHalf - 1.1), y: shape.hem - 1 },
            ],
            0.9,
            accent,
          );
        }
      }
      break;
    case "pocketed":
      if (rig.facing === "south") {
        // A chest pocket over the heart (the viewer's right) with its flap.
        const x = sx + shape.shoulderHalf * 0.2;
        const y = shape.top + height * 0.24;
        fill_rounded_rect(ctx, x, y, 3.4, 3.2, 0.6, accent);
        fill_rounded_rect(ctx, x - 0.2, y - 0.2, 3.8, 1.1, 0.4, css(shade(look.accent, 0.2)));
      } else if (rig.facing === "east") {
        fill_rounded_rect(ctx, hx + 0.2, shape.hem - height * 0.36, 3, 2.8, 0.6, accent);
      } else {
        fill_rounded_rect(ctx, hx - 4.2, shape.hem - 3.6, 8.4, 2.2, 0.8, accent);
      }
      break;
    case "plain":
      break;
  }
  ctx.restore();
}

/**
 * Paints the neck details of a silhouette: neckline ribbing, collars, lapels or a hood.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param shape - The torso shape.
 * @param look - The upper-body look.
 */
function paint_neckline(ctx: PaintContext, rig: Rig, shape: TorsoShape, look: TopLook): void {
  const sx = rig.shoulder.x;
  const top = shape.top;
  const neckHalf = rig.metrics.headWidth * 0.2;
  const trim = css(shade(look.colour, 0.28), 0.8);
  const collar = tint(look.colour, 0.3);
  const isFront = rig.facing === "south";
  const isSide = rig.facing === "east";
  switch (look.silhouette) {
    case "compact":
    case "relaxed":
      if (isSide) {
        polyline(
          ctx,
          [
            { x: sx - 0.4, y: top },
            { x: sx + 1.6, y: top + 1.2 },
          ],
          0.8,
          trim,
        );
      } else {
        ctx.beginPath();
        ctx.moveTo(sx - neckHalf, top);
        ctx.quadraticCurveTo(sx, top + (isFront ? 2.6 : 1.2), sx + neckHalf, top);
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = trim;
        ctx.stroke();
        if (look.silhouette === "relaxed" && isFront) {
          fill_polygon(
            ctx,
            [
              [sx - neckHalf * 0.7, top + 0.4],
              [sx + neckHalf * 0.7, top + 0.4],
              [sx, top + 3.6],
            ],
            css(shade(look.skin, 0.08)),
          );
        }
      }
      break;
    case "structured":
    case "classic": {
      const point = look.silhouette === "classic" ? 3.4 : 2.4;
      if (isSide) {
        fill_polygon(
          ctx,
          [
            [sx - 1.2, top - 0.6],
            [sx + 2, top + 0.4],
            [sx + 1.6, top + point],
          ],
          css(collar),
        );
      } else if (isFront) {
        for (const sign of [-1, 1]) {
          fill_polygon(
            ctx,
            [
              [sx + sign * (neckHalf + 0.6), top - 0.6],
              [sx + sign * 0.2, top + 1],
              [sx + sign * (neckHalf * 0.5), top + point],
            ],
            css(collar),
          );
        }
      } else {
        fill_rounded_rect(
          ctx,
          sx - neckHalf - 0.4,
          top - 0.8,
          neckHalf * 2 + 0.8,
          1.6,
          0.6,
          css(collar),
        );
      }
      ctx.lineWidth = outline_width(look.frame) * 0.7;
      ctx.strokeStyle = outline_style(collar, look.frame);
      ctx.stroke();
      break;
    }
    case "layered":
      if (isFront) {
        for (const sign of [-1, 1]) {
          fill_polygon(
            ctx,
            [
              [sx + sign * neckHalf, top - 0.4],
              [sx + sign * (neckHalf + 2.4), top + 1.2],
              [sx + sign * 1.6, top + (shape.hem - top) * 0.42],
            ],
            css(tint(look.colour, 0.14)),
          );
        }
      } else if (isSide) {
        fill_polygon(
          ctx,
          [
            [sx - 0.8, top - 0.6],
            [sx + 2.6, top + 0.6],
            [sx + 2.2, top + 3.6],
          ],
          css(tint(look.colour, 0.14)),
        );
      } else {
        fill_rounded_rect(
          ctx,
          sx - neckHalf - 0.6,
          top - 1,
          neckHalf * 2 + 1.2,
          1.8,
          0.7,
          css(tint(look.colour, 0.1)),
        );
      }
      break;
    case "sporty":
      if (isFront) {
        // The hood bunched behind the neck, and the drawstrings.
        ctx.beginPath();
        ctx.ellipse(sx, top + 0.2, neckHalf + 2.4, 1.8, 0, Math.PI, Math.PI * 2);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = css(shade(look.colour, 0.12));
        ctx.stroke();
        for (const sign of [-1, 1]) {
          polyline(
            ctx,
            [
              { x: sx + sign * 1.3, y: top + 0.8 },
              { x: sx + sign * 1.5, y: top + 4.2 },
            ],
            0.6,
            css(tint(look.colour, 0.7)),
          );
        }
      }
      break;
  }
}

/**
 * Paints the body details of a silhouette: placket and buttons, belt, open jacket front,
 * hoodie pocket and ribbing, and soft folds.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param shape - The torso shape.
 * @param look - The upper-body look.
 */
function paint_body_details(ctx: PaintContext, rig: Rig, shape: TorsoShape, look: TopLook): void {
  const sx = rig.shoulder.x;
  const hx = rig.hip.x;
  const height = shape.hem - shape.top;
  const isFront = rig.facing === "south";
  const isSide = rig.facing === "east";
  const seam = css(shade(look.colour, 0.3), 0.6);
  const button = css(tint(look.colour, 0.6));
  switch (look.silhouette) {
    case "structured": {
      const x = isSide ? hx + shape.hemHalf - 1.4 : hx;
      if (isFront || isSide) {
        polyline(
          ctx,
          [
            { x: isSide ? sx + shape.shoulderHalf - 1.2 : sx, y: shape.top + 1.5 },
            { x, y: shape.hem },
          ],
          0.7,
          seam,
        );
        for (let index = 0; index < 3; index += 1) {
          const t = 0.25 + index * 0.25;
          fill_circle(
            ctx,
            (isSide ? sx + shape.shoulderHalf - 1.2 : sx) * (1 - t) + x * t + 0.6,
            shape.top + height * t,
            0.45,
            button,
          );
        }
      } else {
        polyline(
          ctx,
          [
            { x: sx - shape.shoulderHalf + 1, y: shape.top + 2.6 },
            { x: sx + shape.shoulderHalf - 1, y: shape.top + 2.6 },
          ],
          0.6,
          seam,
        );
      }
      // Tucked in with a belt.
      const beltLeft = isSide ? shape.left : hx - shape.hemHalf;
      const beltRight = isSide ? shape.right : hx + shape.hemHalf;
      fill_rounded_rect(
        ctx,
        beltLeft + 0.2,
        shape.hem - 1.2,
        beltRight - beltLeft - 0.4,
        1.6,
        0.5,
        css(BELT),
      );
      if (isFront) fill_rounded_rect(ctx, hx - 1, shape.hem - 1.4, 2, 2, 0.4, css(0xc9b37a));
      break;
    }
    case "classic":
      if (isFront) {
        for (let index = 0; index < 4; index += 1) {
          fill_circle(
            ctx,
            sx + (hx - sx) * (index / 4),
            shape.top + 3.4 + (index * (height - 4)) / 4,
            0.5,
            button,
          );
        }
        polyline(
          ctx,
          [
            { x: sx, y: shape.top + 2.6 },
            { x: hx, y: shape.hem },
          ],
          0.5,
          css(shade(look.colour, 0.2), 0.5),
        );
      } else if (isSide) {
        for (let index = 0; index < 3; index += 1) {
          fill_circle(
            ctx,
            sx + shape.shoulderHalf - 0.8,
            shape.top + 3.4 + index * 2.6,
            0.45,
            button,
          );
        }
      } else {
        polyline(
          ctx,
          [
            { x: sx - shape.shoulderHalf + 1, y: shape.top + 2.4 },
            { x: sx + shape.shoulderHalf - 1, y: shape.top + 2.4 },
          ],
          0.6,
          seam,
        );
      }
      break;
    case "layered":
      if (isFront) {
        // The open front shows the inner shirt between the jacket's edges.
        const gapTop = rig.metrics.headWidth * 0.18;
        fill_polygon(
          ctx,
          [
            [sx - gapTop, shape.top + 0.4],
            [sx + gapTop, shape.top + 0.4],
            [hx + 2.2, shape.hem],
            [hx - 2.2, shape.hem],
          ],
          css(inner_shirt(look.colour)),
        );
        for (const sign of [-1, 1]) {
          polyline(
            ctx,
            [
              { x: sx + sign * gapTop, y: shape.top + 0.4 },
              { x: hx + sign * 2.2, y: shape.hem },
            ],
            0.8,
            css(shade(look.colour, 0.3)),
          );
          fill_rounded_rect(
            ctx,
            hx + sign * (shape.hemHalf - 2.2) - 1.6,
            shape.hem - 3.4,
            3.2,
            0.9,
            0.4,
            seam,
          );
        }
      } else if (isSide) {
        fill_polygon(
          ctx,
          [
            [sx + shape.shoulderHalf - 1.6, shape.top + 1.6],
            [sx + shape.shoulderHalf + 0.3, shape.top + 2.4],
            [hx + shape.hemHalf + 0.2, shape.hem - 0.4],
            [hx + shape.hemHalf - 1.4, shape.hem - 0.4],
          ],
          css(inner_shirt(look.colour)),
        );
      } else {
        polyline(
          ctx,
          [
            { x: sx, y: shape.top + 1.5 },
            { x: hx, y: shape.hem },
          ],
          0.7,
          seam,
        );
      }
      break;
    case "sporty":
      if (isFront) {
        ctx.beginPath();
        ctx.moveTo(hx - 3.6, shape.hem - 1.2);
        ctx.lineTo(hx - 2.6, shape.hem - 4.6);
        ctx.lineTo(hx + 2.6, shape.hem - 4.6);
        ctx.lineTo(hx + 3.6, shape.hem - 1.2);
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = seam;
        ctx.stroke();
      } else if (!isSide) {
        // The hood lies over the upper back.
        ctx.beginPath();
        ctx.moveTo(sx - shape.shoulderHalf * 0.62, shape.top - 0.4);
        ctx.quadraticCurveTo(
          sx,
          shape.top + height * 0.55,
          sx + shape.shoulderHalf * 0.62,
          shape.top - 0.4,
        );
        ctx.closePath();
        fill_lit_path(
          ctx,
          { x: sx - 4, y: shape.top, width: 8, height: height * 0.5 },
          shade(look.colour, 0.08),
          look.frame,
        );
      } else {
        fill_ellipse(
          ctx,
          sx - shape.shoulderHalf + 0.6,
          shape.top + 1.4,
          2.2,
          2.4,
          css(shade(look.colour, 0.1)),
        );
      }
      fill_rounded_rect(
        ctx,
        shape.left + 0.5,
        shape.hem - 1.5,
        shape.right - shape.left - 1,
        1.5,
        0.6,
        css(shade(look.colour, 0.14)),
      );
      break;
    case "relaxed":
      for (const sign of isSide ? [1] : [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx + sign * (shape.shoulderHalf - 1.6), shape.top + 3);
        ctx.quadraticCurveTo(
          hx + sign * 1.2,
          shape.top + height * 0.6,
          hx + sign * (shape.hemHalf - 2.6),
          shape.hem - 0.6,
        );
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = css(shade(look.colour, 0.3), 0.45);
        ctx.stroke();
      }
      break;
    case "compact":
      break;
  }
}

/**
 * Paints a figure's upper garment: the torso with its silhouette's cut, the pattern in the
 * accent colour, and the silhouette's details.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param look - The upper-body look.
 */
export function paint_top(ctx: PaintContext, rig: Rig, look: TopLook): void {
  const cut = CUTS[look.silhouette];
  const shape = trace_torso(ctx, rig, cut);
  fill_lit_path(
    ctx,
    { x: shape.left, y: shape.top, width: shape.right - shape.left, height: shape.hem - shape.top },
    look.colour,
    look.frame,
  );
  if (look.pattern !== "plain") {
    trace_torso(ctx, rig, cut);
    paint_pattern(ctx, rig, shape, look);
  }
  if (!look.frame.isLowDetail || look.silhouette === "layered") {
    paint_body_details(ctx, rig, shape, look);
  }
  paint_neckline(ctx, rig, shape, look);
  if (rig.facing === "south" && !look.frame.isLowDetail) {
    // The head's soft shadow on the chest.
    fill_ellipse(
      ctx,
      rig.shoulder.x + 0.6,
      shape.top + 1.4,
      rig.metrics.headWidth * 0.3,
      1.3,
      css(SHADOW_INK, 0.16),
    );
  }
}
