/**
 * Vendor workwear painters: the four apron styles (bib, cross-back, waist and utility) in the
 * apron colour with its trim, and the six kinds of headwear (service cap, visor, headband, hair
 * wrap, chef cap and hairnet), each drawn for the front, back and side views of a posed rig.
 *
 * Vendors stand behind a counter that hides their legs, so the apron's bib, straps and ties and
 * the headwear carry most of a vendor's read at play zoom.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  shade,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import type { StallVendorRecipe } from "../../visuals/vendor";
import { fill_lit_path, outline_style, outline_width, polyline } from "./draw";
import type { Rig } from "./rig";

/** The white of a chef cap. */
const CAP_WHITE = 0xf6f1e6;

/**
 * Traces a polygon path without filling it.
 *
 * @param ctx - The paint context.
 * @param points - The vertices.
 */
function trace_polygon(ctx: PaintContext, points: ReadonlyArray<readonly [number, number]>): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/**
 * Paints a bow of apron ties at the small of the back.
 *
 * @param ctx - The paint context.
 * @param x - Bow centre x.
 * @param y - Bow centre y.
 * @param colour - The tie colour.
 */
function paint_bow(ctx: PaintContext, x: number, y: number, colour: number): void {
  fill_ellipse(ctx, x - 1.6, y, 1.6, 1, css(colour));
  fill_ellipse(ctx, x + 1.6, y, 1.6, 1, css(colour));
  polyline(
    ctx,
    [
      { x: x - 0.4, y },
      { x: x - 1.4, y: y + 3 },
    ],
    0.8,
    css(colour),
  );
  polyline(
    ctx,
    [
      { x: x + 0.4, y },
      { x: x + 1.2, y: y + 3.2 },
    ],
    0.8,
    css(colour),
  );
  fill_circle(ctx, x, y, 0.8, css(shade(colour, 0.2)));
}

/**
 * Paints the front of an apron.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param recipe - The vendor recipe.
 * @param frame - The paint frame.
 */
function paint_apron_front(
  ctx: PaintContext,
  rig: Rig,
  recipe: StallVendorRecipe,
  frame: PaintFrame,
): void {
  const m = rig.metrics;
  const sx = rig.shoulder.x;
  const hx = rig.hip.x;
  const top = rig.shoulder.y + m.torso * (recipe.apronStyle === "waist" ? 0.62 : 0.2);
  const bottom = rig.hip.y + 6.5;
  const topHalf = recipe.apronStyle === "cross-back" ? m.shoulderHalf * 0.66 : m.shoulderHalf * 0.5;
  const bottomHalf = m.hipHalf + 0.8;
  const strap = css(shade(recipe.apron, 0.12));
  if (recipe.apronStyle !== "waist") {
    // Neck strap (bib and utility) or straps over the shoulders (cross-back).
    const reach = recipe.apronStyle === "cross-back" ? m.shoulderHalf - 1.2 : m.headWidth * 0.24;
    for (const sign of [-1, 1]) {
      polyline(
        ctx,
        [
          { x: sx + sign * (topHalf - 0.6), y: top + 0.4 },
          { x: sx + sign * reach, y: rig.shoulder.y - 0.6 },
        ],
        1.1,
        strap,
      );
    }
  }
  const waistY = rig.waist.y;
  const points: [number, number][] =
    recipe.apronStyle === "waist"
      ? [
          [hx - m.waistHalf - 0.6, top],
          [hx + m.waistHalf + 0.6, top],
          [hx + bottomHalf, bottom],
          [hx - bottomHalf, bottom],
        ]
      : [
          [sx - topHalf, top],
          [sx + topHalf, top],
          [sx + topHalf + 0.2, waistY - 1.6],
          [hx + bottomHalf, waistY + 0.6],
          [hx + bottomHalf, bottom],
          [hx - bottomHalf, bottom],
          [hx - bottomHalf, waistY + 0.6],
          [sx - topHalf - 0.2, waistY - 1.6],
        ];
  trace_polygon(ctx, points);
  fill_lit_path(
    ctx,
    { x: hx - bottomHalf, y: top, width: bottomHalf * 2, height: bottom - top },
    recipe.apron,
    frame,
    { lift: 0.18 },
  );
  const trim = css(recipe.apronTrim);
  // Waist ties in the trim colour.
  polyline(
    ctx,
    [
      { x: hx - m.waistHalf - 1.4, y: waistY },
      { x: hx + m.waistHalf + 1.4, y: waistY },
    ],
    1,
    trim,
  );
  if (recipe.apronStyle === "waist") {
    fill_rounded_rect(
      ctx,
      hx - m.waistHalf - 0.6,
      top - 0.2,
      (m.waistHalf + 0.6) * 2,
      1.6,
      0.5,
      trim,
    );
  } else if (recipe.apronStyle === "utility") {
    for (const offset of [-1, 1]) {
      fill_rounded_rect(
        ctx,
        sx + offset * 2.4 - 1.8,
        top + 2,
        3.6,
        3,
        0.6,
        css(recipe.apronTrim, 0.85),
      );
    }
    polyline(
      ctx,
      [
        { x: sx - 1.6, y: top + 2.2 },
        { x: sx - 1.3, y: top + 0.4 },
      ],
      0.6,
      css(0x2f4a6b),
    );
  } else {
    fill_rounded_rect(ctx, hx - 2.6, waistY + 1.2, 5.2, 3, 0.8, css(recipe.apronTrim, 0.8));
  }
  if (!frame.isLowDetail) {
    polyline(
      ctx,
      [
        { x: sx - topHalf + 0.6, y: top + 0.7 },
        { x: sx + topHalf - 0.6, y: top + 0.7 },
      ],
      0.6,
      css(tint(recipe.apron, 0.4), 0.6),
    );
  }
}

/**
 * Paints the back of an apron: its straps and the tie bow.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param recipe - The vendor recipe.
 */
function paint_apron_back(ctx: PaintContext, rig: Rig, recipe: StallVendorRecipe): void {
  const m = rig.metrics;
  const sx = rig.shoulder.x;
  const waistY = rig.waist.y;
  const strap = css(shade(recipe.apron, 0.1));
  // The apron's skirt peeks out at both hips.
  for (const sign of [-1, 1]) {
    fill_rounded_rect(
      ctx,
      rig.hip.x + sign * (m.hipHalf + 0.3) - 1,
      waistY,
      2,
      rig.hip.y + 6 - waistY,
      0.8,
      css(shade(recipe.apron, 0.15)),
    );
  }
  if (recipe.apronStyle === "cross-back") {
    for (const sign of [-1, 1]) {
      polyline(
        ctx,
        [
          { x: sx + sign * (m.shoulderHalf - 1.4), y: rig.shoulder.y - 0.4 },
          { x: rig.hip.x - sign * (m.waistHalf - 0.6), y: waistY - 0.4 },
        ],
        1.4,
        strap,
      );
    }
  } else if (recipe.apronStyle === "utility") {
    for (const sign of [-1, 1]) {
      polyline(
        ctx,
        [
          { x: sx + sign * 2.2, y: rig.shoulder.y - 0.4 },
          { x: rig.hip.x + sign * 2.4, y: waistY - 0.4 },
        ],
        1.3,
        strap,
      );
    }
  } else if (recipe.apronStyle === "bib") {
    ctx.beginPath();
    ctx.ellipse(sx, rig.shoulder.y - 0.6, m.headWidth * 0.26, 1.2, 0, 0, Math.PI);
    ctx.lineWidth = 1;
    ctx.strokeStyle = strap;
    ctx.stroke();
  }
  polyline(
    ctx,
    [
      { x: rig.hip.x - m.waistHalf - 0.6, y: waistY },
      { x: rig.hip.x + m.waistHalf + 0.6, y: waistY },
    ],
    1.1,
    css(recipe.apronTrim),
  );
  paint_bow(ctx, rig.hip.x, waistY, recipe.apronTrim);
}

/**
 * Paints an apron in profile: the panel down the body's front, its strap and the tie.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param recipe - The vendor recipe.
 * @param frame - The paint frame.
 */
function paint_apron_side(
  ctx: PaintContext,
  rig: Rig,
  recipe: StallVendorRecipe,
  frame: PaintFrame,
): void {
  const m = rig.metrics;
  const front = rig.shoulder.x + m.depthHalf;
  const hipFront = rig.hip.x + m.depthHalf;
  const isWaist = recipe.apronStyle === "waist";
  const top = isWaist ? rig.waist.y - 0.6 : rig.shoulder.y + m.torso * 0.2;
  const bottom = rig.hip.y + 6.5;
  if (!isWaist) {
    polyline(
      ctx,
      [
        { x: front - 1.6, y: top + 0.4 },
        { x: rig.shoulder.x - 0.6, y: rig.shoulder.y - 0.4 },
      ],
      1.1,
      css(shade(recipe.apron, 0.12)),
    );
  }
  trace_polygon(ctx, [
    [front - 1.8, top],
    [front + 0.9, top + 0.6],
    [hipFront + 1.2, rig.waist.y],
    [hipFront + 1.7, bottom],
    [hipFront - 2.8, bottom],
    [hipFront - 1.9, rig.waist.y],
  ]);
  fill_lit_path(
    ctx,
    { x: front - 3, y: top, width: 6, height: bottom - top },
    recipe.apron,
    frame,
    { lift: 0.18 },
  );
  polyline(
    ctx,
    [
      { x: hipFront - 1.2, y: rig.waist.y },
      { x: rig.hip.x - m.depthHalf - 0.8, y: rig.waist.y },
    ],
    1,
    css(recipe.apronTrim),
  );
  polyline(
    ctx,
    [
      { x: rig.hip.x - m.depthHalf - 0.8, y: rig.waist.y },
      { x: rig.hip.x - m.depthHalf - 2.2, y: rig.waist.y + 3.4 },
    ],
    0.9,
    css(recipe.apronTrim),
  );
}

/**
 * Paints a vendor's apron for the rig's facing.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param recipe - The vendor recipe.
 * @param frame - The paint frame.
 */
export function paint_apron(
  ctx: PaintContext,
  rig: Rig,
  recipe: StallVendorRecipe,
  frame: PaintFrame,
): void {
  if (rig.facing === "south") paint_apron_front(ctx, rig, recipe, frame);
  else if (rig.facing === "north") paint_apron_back(ctx, rig, recipe);
  else paint_apron_side(ctx, rig, recipe, frame);
}

/**
 * Paints a vendor's headwear over the hair for the rig's facing.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param recipe - The vendor recipe.
 * @param frame - The paint frame.
 */
export function paint_headwear(
  ctx: PaintContext,
  rig: Rig,
  recipe: StallVendorRecipe,
  frame: PaintFrame,
): void {
  const x = rig.head.x;
  const y = rig.head.y;
  const a = rig.metrics.headWidth / 2;
  const b = rig.metrics.headHeight / 2;
  const isSide = rig.facing === "east";
  const isFront = rig.facing === "south";
  const apron = recipe.apron;
  const trim = recipe.apronTrim;
  // The band sits above the brows, so a brim shades the forehead and never hides the eyes.
  const band = y - b * 0.5;
  switch (recipe.headwear) {
    case "service-cap": {
      ctx.beginPath();
      ctx.ellipse(x - (isSide ? 0.6 : 0), band, a + 0.7, b * 0.78, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      fill_lit_path(ctx, { x: x - a, y: band - b, width: a * 2, height: b }, apron, frame);
      fill_circle(ctx, x - (isSide ? 0.6 : 0), band - b * 0.78, 0.9, css(shade(apron, 0.2)));
      if (isFront) {
        ctx.beginPath();
        ctx.ellipse(x, band + 0.7, a * 0.92, 1.3, 0, 0, Math.PI * 2);
        fill_lit_path(ctx, { x: x - a, y: band, width: a * 2, height: 2.4 }, trim, frame);
      } else if (isSide) {
        ctx.beginPath();
        ctx.ellipse(x + a * 0.85, band + 0.4, a * 0.62, 1.1, 0, 0, Math.PI * 2);
        fill_lit_path(ctx, { x: x, y: band - 1, width: a * 1.5, height: 2.4 }, trim, frame);
      } else {
        fill_rounded_rect(ctx, x - 2, band - 1.8, 4, 1.6, 0.6, css(shade(apron, 0.3)));
      }
      break;
    }
    case "visor":
      ctx.beginPath();
      ctx.ellipse(x, band + 0.2, a + 0.5, 1.5, 0, 0, Math.PI * 2);
      fill_lit_path(ctx, { x: x - a, y: band - 1, width: a * 2, height: 3 }, apron, frame);
      if (isFront) {
        ctx.beginPath();
        ctx.ellipse(x, band + 0.9, a * 0.85, 1.3, 0, 0, Math.PI);
        ctx.closePath();
        fill_lit_path(ctx, { x: x - a, y: band, width: a * 2, height: 2.6 }, trim, frame);
      } else if (isSide) {
        ctx.beginPath();
        ctx.ellipse(x + a * 0.9, band + 0.8, a * 0.55, 1, 0, 0, Math.PI * 2);
        fill_lit_path(ctx, { x, y: band, width: a * 1.4, height: 2 }, trim, frame);
      }
      break;
    case "headband":
      ctx.beginPath();
      ctx.ellipse(x, band - 0.6, a + 0.4, 1.4, 0, 0, Math.PI * 2);
      fill_lit_path(ctx, { x: x - a, y: band - 2, width: a * 2, height: 3 }, trim, frame);
      if (!isFront) {
        const knotX = isSide ? x - a - 0.6 : x;
        fill_circle(ctx, knotX, band - 0.4, 1.2, css(shade(trim, 0.15)));
        polyline(
          ctx,
          [
            { x: knotX, y: band },
            { x: knotX - 1.6, y: band + 4 },
          ],
          0.9,
          css(trim),
        );
        polyline(
          ctx,
          [
            { x: knotX, y: band },
            { x: knotX + 0.6, y: band + 4.4 },
          ],
          0.9,
          css(trim),
        );
      }
      break;
    case "hair-wrap": {
      const reach = rig.facing === "north" ? b * 0.55 : b * 0.05;
      ctx.beginPath();
      ctx.ellipse(x - (isSide ? 0.8 : 0), y - 0.6, a + 1, b + 0.8, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(x + a + 0.6, y + reach);
      ctx.quadraticCurveTo(x, y + reach - (isFront ? b * 0.5 : -1), x - a - 1, y + reach);
      ctx.closePath();
      fill_lit_path(ctx, { x: x - a, y: y - b, width: a * 2, height: b * 1.2 }, apron, frame);
      if (!frame.isLowDetail) {
        for (const offset of [-0.4, 0.15]) {
          ctx.beginPath();
          ctx.ellipse(x, y - 0.6, a * (0.6 + offset), b * 0.75, 0, Math.PI * 1.15, Math.PI * 1.85);
          ctx.lineWidth = 0.6;
          ctx.strokeStyle = css(shade(apron, 0.25), 0.55);
          ctx.stroke();
        }
      }
      const knot = isFront
        ? { x: x + a * 0.2, y: y - b - 0.6 }
        : isSide
          ? { x: x - a - 0.6, y: y - b * 0.2 }
          : { x: x + a * 0.35, y: y - b * 0.55 };
      fill_circle(ctx, knot.x - 1, knot.y, 1.5, css(trim));
      fill_circle(ctx, knot.x + 1, knot.y, 1.5, css(shade(trim, 0.12)));
      break;
    }
    case "chef-cap": {
      ctx.beginPath();
      ctx.ellipse(x, y - b - 1, a * 0.98, 3, 0, 0, Math.PI * 2);
      fill_lit_path(ctx, { x: x - a, y: y - b - 4, width: a * 2, height: 5 }, CAP_WHITE, frame, {
        drop: 0.12,
      });
      trace_polygon(ctx, [
        [x - a * 0.92, y - b - 1.2],
        [x + a * 0.92, y - b - 1.2],
        [x + a * 0.98, band],
        [x - a * 0.98, band],
      ]);
      fill_lit_path(ctx, { x: x - a, y: y - b, width: a * 2, height: b * 0.7 }, CAP_WHITE, frame, {
        drop: 0.12,
      });
      if (!frame.isLowDetail) {
        for (const offset of [-0.45, 0, 0.45]) {
          polyline(
            ctx,
            [
              { x: x + offset * a, y: y - b - 3 },
              { x: x + offset * a * 1.05, y: band - 0.6 },
            ],
            0.5,
            css(shade(CAP_WHITE, 0.25), 0.6),
          );
        }
      }
      polyline(
        ctx,
        [
          { x: x - a * 0.97, y: band - 0.6 },
          { x: x + a * 0.97, y: band - 0.6 },
        ],
        1,
        css(trim),
      );
      break;
    }
    case "hairnet": {
      const edge = rig.facing === "north" ? y + b * 0.5 : isSide ? y + b * 0.1 : y - b * 0.42;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x - (isSide ? 0.6 : 0), y - 0.5, a + 1.1, b + 0.8, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(x + a + 1.1, edge);
      ctx.lineTo(x - a - 1.1, edge);
      ctx.closePath();
      ctx.fillStyle = css(tint(apron, 0.6), 0.32);
      ctx.fill();
      ctx.lineWidth = outline_width(frame);
      ctx.strokeStyle = outline_style(tint(apron, 0.3), frame);
      ctx.stroke();
      ctx.clip();
      if (!frame.isLowDetail) {
        for (let step = -3; step <= 3; step += 1) {
          const from = x + step * 2.6;
          polyline(
            ctx,
            [
              { x: from - 6, y: y - b - 2 },
              { x: from + 6, y: y + b },
            ],
            0.4,
            css(0xffffff, 0.45),
          );
          polyline(
            ctx,
            [
              { x: from + 6, y: y - b - 2 },
              { x: from - 6, y: y + b },
            ],
            0.4,
            css(0xffffff, 0.45),
          );
        }
      }
      ctx.restore();
      fill_polygon(
        ctx,
        [
          [x - a - 1, edge - 0.6],
          [x + a + 1, edge - 0.6],
          [x + a + 1, edge + 0.4],
          [x - a - 1, edge + 0.4],
        ],
        css(tint(apron, 0.3), 0.8),
      );
      break;
    }
  }
}
