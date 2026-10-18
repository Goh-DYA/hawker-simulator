/**
 * Vendor tool painters: the fourteen hand tools a stall vendor works with (cleaver, ladles, a
 * long-spout kettle, spatulas, a noodle basket, cups, tongs and a bamboo steamer held in a cloth),
 * drawn in the working hand along a direction given in body space.
 *
 * A tool is drawn in its own frame: the hand at the origin and the handle running along +x, so
 * one shape serves every facing; the direction is projected for the facing, which foreshortens a
 * tool that points at or away from the camera. Materials are stainless steel, timber, bamboo and
 * enamel; nothing carries a brand.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_rounded_rect,
  linear_gradient,
  shade,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame, SheetFacing } from "../specs";
import type { StallVendorTool } from "../../visuals/vendor";
import { outline_style, outline_width, polyline } from "./draw";
import { project, type Point, type Vec3 } from "./rig";

/** Stainless steel. */
const STEEL = 0xc9d3d0;
/** Dark steel for edges and shafts. */
const DARK_STEEL = 0x7e8b88;
/** Handle timber. */
const WOOD = 0x8a5a33;
/** Bamboo for the steamer. */
const BAMBOO = 0xc9a05a;
/** Kopi poured from the kettle. */
const KOPI = 0x8a5a33;

/**
 * Fills the current path and strokes a thin outline in the material's shade.
 *
 * @param ctx - The paint context.
 * @param colour - The material colour.
 * @param frame - The paint frame.
 */
function fill_part(ctx: PaintContext, colour: number, frame: PaintFrame): void {
  ctx.fillStyle = css(colour);
  ctx.fill();
  ctx.lineWidth = outline_width(frame) * 0.8;
  ctx.strokeStyle = outline_style(colour, frame);
  ctx.stroke();
}

/**
 * Traces a rounded rectangle path.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height.
 * @param radius - Corner radius.
 */
function trace_box(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Paints a handle from the hand along +x.
 *
 * @param ctx - The paint context.
 * @param length - Handle length.
 * @param width - Handle thickness.
 * @param colour - Handle material.
 * @param frame - The paint frame.
 */
function handle(
  ctx: PaintContext,
  length: number,
  width: number,
  colour: number,
  frame: PaintFrame,
): void {
  polyline(
    ctx,
    [
      { x: -1.5, y: 0 },
      { x: length, y: 0 },
    ],
    width + (frame.isHighContrast ? 1.6 : 0.8),
    outline_style(colour, frame),
  );
  polyline(
    ctx,
    [
      { x: -1.5, y: 0 },
      { x: length, y: 0 },
    ],
    width,
    css(colour),
  );
}

/**
 * Paints a tool's head in the tool frame (hand at the origin, handle along +x).
 *
 * @param ctx - The paint context.
 * @param tool - The tool.
 * @param frame - The paint frame.
 */
function paint_tool_shape(ctx: PaintContext, tool: StallVendorTool, frame: PaintFrame): void {
  switch (tool) {
    case "cleaver":
      handle(ctx, 5, 2, WOOD, frame);
      trace_box(ctx, 4.4, -1.4, 8.6, 6.6, 1);
      ctx.fillStyle = linear_gradient(ctx, 0, -1.4, 0, 5.2, [
        [0, tint(STEEL, 0.25)],
        [0.7, STEEL],
        [1, tint(STEEL, 0.5)],
      ]);
      ctx.fill();
      ctx.lineWidth = outline_width(frame) * 0.8;
      ctx.strokeStyle = outline_style(STEEL, frame);
      ctx.stroke();
      polyline(
        ctx,
        [
          { x: 4.8, y: -1 },
          { x: 12.6, y: -1 },
        ],
        0.8,
        css(DARK_STEEL),
      );
      fill_circle(ctx, 6, 0.6, 0.6, css(DARK_STEEL));
      break;
    case "ladle":
    case "braising-ladle":
    case "claypot-ladle": {
      handle(ctx, 11.5, 1.2, DARK_STEEL, frame);
      ctx.beginPath();
      ctx.ellipse(13.4, 0.6, 3.2, 2.6, 0, 0, Math.PI * 2);
      fill_part(ctx, STEEL, frame);
      const broth =
        tool === "claypot-ladle" ? 0x7a3b24 : tool === "braising-ladle" ? 0xa0612a : 0xd9a441;
      fill_ellipse(ctx, 13.4, 0.2, 2.3, 1.5, css(broth));
      fill_ellipse(ctx, 12.8, -0.3, 0.9, 0.4, css(0xffffff, 0.45));
      break;
    }
    case "long-spout-kettle":
      // Held by its top handle: the pot hangs below the hand and the spout reaches forward.
      polyline(
        ctx,
        [
          { x: 2.4, y: 2.6 },
          { x: 12.5, y: -2.4 },
        ],
        1.9,
        outline_style(STEEL, frame),
      );
      polyline(
        ctx,
        [
          { x: 2.4, y: 2.6 },
          { x: 12.5, y: -2.4 },
        ],
        1.1,
        css(STEEL),
      );
      trace_box(ctx, -3, 1, 7.4, 6.8, 2.6);
      ctx.fillStyle = linear_gradient(ctx, -3, 0, 4.4, 0, [
        [0, tint(STEEL, 0.3)],
        [0.5, STEEL],
        [1, shade(STEEL, 0.25)],
      ]);
      ctx.fill();
      ctx.lineWidth = outline_width(frame) * 0.8;
      ctx.strokeStyle = outline_style(STEEL, frame);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0.7, 0.2, 2.8, 1.6, 0, Math.PI, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = css(DARK_STEEL);
      ctx.stroke();
      break;
    case "wok-spatula":
    case "griddle-spatula":
    case "fish-turner": {
      handle(ctx, 9, 1.6, WOOD, frame);
      const width = tool === "griddle-spatula" ? 6 : tool === "fish-turner" ? 4.6 : 4.4;
      trace_box(ctx, 8.6, -width / 2, tool === "fish-turner" ? 7 : 5.4, width, 1.2);
      fill_part(ctx, STEEL, frame);
      if (tool !== "wok-spatula" && !frame.isLowDetail) {
        for (const offset of [-1, 0, 1]) {
          polyline(
            ctx,
            [
              { x: 10, y: offset * 1.2 },
              { x: tool === "fish-turner" ? 14.6 : 13, y: offset * 1.2 },
            ],
            0.45,
            css(DARK_STEEL),
          );
        }
      }
      break;
    }
    case "noodle-basket":
      handle(ctx, 8.4, 1.6, WOOD, frame);
      ctx.beginPath();
      ctx.arc(12, 0.4, 3.6, 0, Math.PI * 2);
      fill_part(ctx, tint(STEEL, 0.2), frame);
      fill_ellipse(ctx, 12, 0.2, 2.6, 2.2, css(0xf0d9a0));
      if (!frame.isLowDetail) {
        for (const offset of [-1.6, 0, 1.6]) {
          polyline(
            ctx,
            [
              { x: 12 + offset, y: -3 },
              { x: 12 + offset, y: 3.8 },
            ],
            0.35,
            css(DARK_STEEL, 0.6),
          );
        }
      }
      break;
    case "measuring-cup":
    case "batter-cup": {
      const reach = tool === "batter-cup" ? 6.5 : 1;
      if (tool === "batter-cup") handle(ctx, reach, 1.2, DARK_STEEL, frame);
      trace_box(ctx, reach, -2.6, 5, 5.4, 1.2);
      fill_part(ctx, tool === "batter-cup" ? STEEL : 0xe8eef0, frame);
      fill_rounded_rect(
        ctx,
        reach + 0.7,
        -1.8,
        3.6,
        2.2,
        0.8,
        css(tool === "batter-cup" ? 0xf1dfb2 : 0x9fd0d6, 0.95),
      );
      break;
    }
    case "grill-tongs":
    case "ingredient-tongs": {
      const spread = tool === "grill-tongs" ? 1.4 : 1;
      const colour = tool === "grill-tongs" ? DARK_STEEL : STEEL;
      for (const sign of [-1, 1]) {
        polyline(
          ctx,
          [
            { x: -1, y: 0 },
            { x: 6, y: sign * spread * 0.6 },
            { x: 13, y: sign * spread },
          ],
          1.7,
          outline_style(colour, frame),
        );
        polyline(
          ctx,
          [
            { x: -1, y: 0 },
            { x: 6, y: sign * spread * 0.6 },
            { x: 13, y: sign * spread },
          ],
          1,
          css(colour),
        );
      }
      if (tool === "ingredient-tongs") fill_circle(ctx, 13.4, 0, 1.4, css(0xd9a441));
      break;
    }
    case "steamer-cloth":
      // A bamboo steamer basket lifted with a cloth.
      fill_rounded_rect(ctx, -2, -2.2, 4.4, 4.4, 1.6, css(0xf1e6d2));
      trace_box(ctx, 2.6, -1.4, 9, 5, 1.6);
      fill_part(ctx, BAMBOO, frame);
      ctx.beginPath();
      ctx.ellipse(7.1, -1.4, 4.5, 1.6, 0, 0, Math.PI * 2);
      fill_part(ctx, tint(BAMBOO, 0.18), frame);
      if (!frame.isLowDetail) {
        polyline(
          ctx,
          [
            { x: 2.8, y: 1.4 },
            { x: 11.4, y: 1.4 },
          ],
          0.5,
          css(shade(BAMBOO, 0.35), 0.8),
        );
      }
      break;
  }
}

/**
 * Paints a vendor's tool in the working hand, pointing along a body-space direction.
 *
 * @param ctx - The paint context.
 * @param tool - The tool.
 * @param facing - The sheet row.
 * @param hand - The hand in frame pixels.
 * @param handBody - The hand in body space.
 * @param direction - The tool's direction in body space (need not be unit length).
 * @param frame - The paint frame.
 * @param isPouring - True to draw a stream of kopi from a kettle's spout.
 */
export function paint_tool(
  ctx: PaintContext,
  tool: StallVendorTool,
  facing: SheetFacing,
  hand: Point,
  handBody: Vec3,
  direction: Vec3,
  frame: PaintFrame,
  isPouring: boolean,
): void {
  const size = Math.hypot(direction.right, direction.forward, direction.up) || 1;
  const tipBody: Vec3 = {
    right: handBody.right + direction.right / size,
    forward: handBody.forward + direction.forward / size,
    up: handBody.up + direction.up / size,
  };
  const base = project(facing, handBody);
  const tip = project(facing, tipBody);
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const reach = Math.max(0.5, Math.min(1, Math.hypot(dx, dy)));
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  ctx.scale(reach, 1);
  paint_tool_shape(ctx, tool, frame);
  ctx.restore();
  if (isPouring && tool === "long-spout-kettle") {
    // The spout tip in frame pixels: (12.5, -2.4) in the tool frame.
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const spout = {
      x: hand.x + 12.5 * reach * cos + 2.4 * sin,
      y: hand.y + 12.5 * reach * sin - 2.4 * cos,
    };
    polyline(ctx, [spout, { x: spout.x + 0.4, y: spout.y + 8 }], 0.9, css(KOPI, 0.85));
  }
}
