/**
 * The customer status bubbles: a cream speech bubble with a tail towards the guest's head and a
 * crisp ink pictogram for each status (question, footsteps, queue, order, clock, seat, meal,
 * return and exit), drawn bold enough to read when the whole bubble texture is 32 screen pixels.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  line,
  linear_gradient,
  stroke_ellipse,
  type PaintContext,
} from "../canvas";
import { EFFECT_SIZE, type PaintFrame } from "../specs";

/** The status pictograms, in `EFFECT_KINDS` order. */
export const INDICATOR_KINDS = [
  "question",
  "footsteps",
  "queue",
  "order",
  "clock",
  "seat",
  "meal",
  "return",
  "exit",
] as const;
export type IndicatorKind = (typeof INDICATOR_KINDS)[number];

/** Bubble fill. */
const BUBBLE = 0xfff8e8;
/** Pictogram ink. */
const INK = 0x263238;
/** Shadow ink. */
const SHADOW = 0x18323b;
/** Bubble radius. */
const BUBBLE_RADIUS = 19;
/** Bubble centre: raised in the texture so the tail can reach down towards the guest's head. */
const BUBBLE_X = EFFECT_SIZE / 2;
const BUBBLE_Y = EFFECT_SIZE / 2 - 6;
/** The tail's tip, down and to the left, where the guest's head is. */
const TAIL_TIP = [EFFECT_SIZE / 2 - 14, EFFECT_SIZE / 2 + 20] as const;
/** The arc angles the tail leaves the bubble between, in radians. */
const TAIL_START = (112 / 180) * Math.PI;
const TAIL_END = (146 / 180) * Math.PI;

/**
 * Traces the bubble outline: the circle with the tail cut into it as one path.
 *
 * @param ctx - The paint context.
 */
function trace_bubble(ctx: PaintContext): void {
  ctx.beginPath();
  ctx.moveTo(TAIL_TIP[0], TAIL_TIP[1]);
  ctx.arc(BUBBLE_X, BUBBLE_Y, BUBBLE_RADIUS, TAIL_END, TAIL_START + Math.PI * 2);
  ctx.closePath();
}

/**
 * Paints the bubble: a soft shadow, a cream fill lit from the top and a thin tinted outline (a
 * thick ink one in high contrast).
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_bubble(ctx: PaintContext, frame: PaintFrame): void {
  ctx.save();
  if (!frame.isLowDetail) {
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    ctx.shadowColor = css(SHADOW, 0.32);
  }
  trace_bubble(ctx);
  ctx.fillStyle = linear_gradient(ctx, 0, BUBBLE_Y - BUBBLE_RADIUS, 0, BUBBLE_Y + BUBBLE_RADIUS, [
    [0, 0xffffff],
    [0.5, BUBBLE],
    [1, 0xf3e6c9],
  ]);
  ctx.fill();
  ctx.restore();
  trace_bubble(ctx);
  ctx.strokeStyle = css(INK, frame.isHighContrast ? 1 : 0.35);
  ctx.lineWidth = frame.isHighContrast ? 2.6 : 1.4;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/**
 * Strokes a pictogram path in ink with round caps and joins.
 *
 * @param ctx - The paint context.
 * @param width - Stroke width.
 */
function ink_stroke(ctx: PaintContext, width: number): void {
  ctx.strokeStyle = css(INK);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

/**
 * Draws a question mark: a hook and a dot.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 * @param weight - Stroke width.
 */
function draw_question(ctx: PaintContext, x: number, y: number, weight: number): void {
  ctx.beginPath();
  ctx.arc(x, y - 4.5, 6, Math.PI * 1.05, Math.PI * 2.3);
  ctx.quadraticCurveTo(x, y - 0.5, x, y + 3);
  ink_stroke(ctx, weight + 0.4);
  fill_circle(ctx, x, y + 9, weight * 0.75, css(INK));
}

/**
 * Draws two staggered shoe prints, each a forefoot and a heel.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 */
function draw_footsteps(ctx: PaintContext, x: number, y: number): void {
  for (const [dx, dy, lean] of [
    [-5, 4, -0.18],
    [5, -4, 0.18],
  ] as const) {
    ctx.save();
    ctx.translate(x + dx, y + dy);
    ctx.rotate(lean);
    fill_ellipse(ctx, 0, -2.5, 3.6, 5.2, css(INK));
    fill_ellipse(ctx, 0, 5.4, 2.8, 2.4, css(INK));
    ctx.restore();
  }
}

/**
 * Draws three people standing in line, the nearest one largest.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 */
function draw_queue(ctx: PaintContext, x: number, y: number): void {
  for (const [dx, size] of [
    [8, 0.78],
    [1, 0.88],
    [-7.5, 1],
  ] as const) {
    const head_y = y - 4 * size - 1;
    fill_circle(ctx, x + dx, head_y, 3 * size, css(INK));
    ctx.beginPath();
    ctx.moveTo(x + dx - 4.6 * size, y + 9);
    ctx.lineTo(x + dx - 4.6 * size, y + 4 * size - 1);
    ctx.quadraticCurveTo(x + dx - 4.6 * size, y + 0.2, x + dx, y + 0.2);
    ctx.quadraticCurveTo(x + dx + 4.6 * size, y + 0.2, x + dx + 4.6 * size, y + 4 * size - 1);
    ctx.lineTo(x + dx + 4.6 * size, y + 9);
    ctx.closePath();
    ctx.fillStyle = css(INK);
    ctx.fill();
    // A cream gap between the figures keeps them separate at small sizes.
    ctx.strokeStyle = css(BUBBLE);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/**
 * Draws an order ticket: an ink slip with a torn zigzag foot and cream lines of text.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 */
function draw_order(ctx: PaintContext, x: number, y: number): void {
  const left = x - 7.5;
  const right = x + 7.5;
  const top = y - 10;
  const foot = y + 8;
  const points: [number, number][] = [
    [left, top],
    [right, top],
    [right, foot],
  ];
  for (let step = 1; step <= 5; step += 1) {
    const step_x = right - step * 3;
    points.push([step_x, step % 2 === 1 ? foot + 2.5 : foot]);
  }
  points.push([left, foot]);
  fill_polygon(ctx, points, css(INK));
  for (const [line_y, length] of [
    [y - 5.5, 9],
    [y - 1.5, 9],
    [y + 2.5, 5],
  ] as const) {
    line(ctx, x - 4.5, line_y, x - 4.5 + length, line_y, css(BUBBLE), 1.8);
  }
}

/**
 * Draws a clock face with tick marks and two hands.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 * @param weight - Stroke width.
 */
function draw_clock(ctx: PaintContext, x: number, y: number, weight: number): void {
  stroke_ellipse(ctx, x, y, 10, 10, css(INK), weight);
  for (const [dx, dy] of [
    [0, -6.6],
    [6.6, 0],
    [0, 6.6],
    [-6.6, 0],
  ] as const) {
    fill_circle(ctx, x + dx, y + dy, 1.1, css(INK));
  }
  line(ctx, x, y, x, y - 6, css(INK), weight * 0.85);
  line(ctx, x, y, x + 4.2, y + 2.2, css(INK), weight * 0.85);
  fill_circle(ctx, x, y, 1.7, css(INK));
}

/**
 * Draws a round hawker stool from the side: a thick seat, splayed legs and a foot ring.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 * @param weight - Stroke width.
 */
function draw_seat(ctx: PaintContext, x: number, y: number, weight: number): void {
  fill_ellipse(ctx, x, y - 6.5, 9, 3, css(INK));
  fill_rounded_rect(ctx, x - 9, y - 6.5, 18, 4.5, 2, css(INK));
  line(ctx, x - 6, y - 2, x - 8.5, y + 10, css(INK), weight);
  line(ctx, x + 6, y - 2, x + 8.5, y + 10, css(INK), weight);
  line(ctx, x - 1.8, y - 2, x - 2.4, y + 10, css(INK), weight * 0.8);
  line(ctx, x + 1.8, y - 2, x + 2.4, y + 10, css(INK), weight * 0.8);
  line(ctx, x - 7.3, y + 5, x + 7.3, y + 5, css(INK), weight * 0.7);
}

/**
 * Draws a bowl with chopsticks and two wisps of steam.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 * @param weight - Stroke width.
 */
function draw_meal(ctx: PaintContext, x: number, y: number, weight: number): void {
  line(ctx, x - 1, y + 0.5, x + 9.5, y - 10, css(INK), weight * 0.7);
  line(ctx, x + 2.5, y + 0.5, x + 11.5, y - 7.5, css(INK), weight * 0.7);
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.quadraticCurveTo(x + 9, y + 9, x, y + 9.5);
  ctx.quadraticCurveTo(x - 9, y + 9, x - 10, y);
  ctx.closePath();
  ctx.fillStyle = css(INK);
  ctx.fill();
  fill_rounded_rect(ctx, x - 3.5, y + 9, 7, 2.2, 1, css(INK));
  for (const wisp_x of [x - 6, x - 1]) {
    ctx.beginPath();
    ctx.moveTo(wisp_x, y - 2.5);
    ctx.quadraticCurveTo(wisp_x - 2.2, y - 5.5, wisp_x, y - 8);
    ctx.quadraticCurveTo(wisp_x + 2.2, y - 10.5, wisp_x, y - 12.5);
    ink_stroke(ctx, weight * 0.6);
  }
}

/**
 * Draws a tray with a U-turn arrow above it: take the tray back.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 * @param weight - Stroke width.
 */
function draw_return(ctx: PaintContext, x: number, y: number, weight: number): void {
  ctx.beginPath();
  ctx.moveTo(x + 7, y + 1);
  ctx.lineTo(x + 7, y - 4);
  ctx.arc(x + 1, y - 4, 6, 0, Math.PI, true);
  ctx.lineTo(x - 5, y - 1);
  ink_stroke(ctx, weight);
  fill_polygon(
    ctx,
    [
      [x - 10, y - 2.5],
      [x - 0, y - 2.5],
      [x - 5, y + 3.5],
    ],
    css(INK),
  );
  fill_rounded_rect(ctx, x - 11, y + 6, 22, 4.5, 1.5, css(INK));
  fill_rounded_rect(ctx, x - 11, y + 3.5, 3, 4, 1, css(INK));
  fill_rounded_rect(ctx, x + 8, y + 3.5, 3, 4, 1, css(INK));
}

/**
 * Draws an open doorway with an arrow walking out through it.
 *
 * @param ctx - The paint context.
 * @param x - Pictogram centre x.
 * @param y - Pictogram centre y.
 * @param weight - Stroke width.
 */
function draw_exit(ctx: PaintContext, x: number, y: number, weight: number): void {
  ctx.beginPath();
  ctx.moveTo(x + 1, y - 11);
  ctx.lineTo(x - 9, y - 11);
  ctx.lineTo(x - 9, y + 11);
  ctx.lineTo(x + 1, y + 11);
  ink_stroke(ctx, weight * 0.85);
  fill_polygon(
    ctx,
    [
      [x - 9, y - 11],
      [x - 3, y - 8],
      [x - 3, y + 13],
      [x - 9, y + 11],
    ],
    css(INK),
  );
  line(ctx, x - 0.5, y + 1, x + 7.5, y + 1, css(INK), weight);
  fill_polygon(
    ctx,
    [
      [x + 12.5, y + 1],
      [x + 6, y - 5],
      [x + 6, y + 7],
    ],
    css(INK),
  );
}

/**
 * Paints one status bubble with its pictogram.
 *
 * @param ctx - The paint context.
 * @param kind - The status.
 * @param frame - The paint frame.
 */
export function paint_indicator(ctx: PaintContext, kind: IndicatorKind, frame: PaintFrame): void {
  paint_bubble(ctx, frame);
  const x = BUBBLE_X;
  const y = BUBBLE_Y;
  const weight = frame.isHighContrast ? 3.6 : 3.1;
  ctx.save();
  switch (kind) {
    case "question":
      draw_question(ctx, x, y, weight);
      break;
    case "footsteps":
      draw_footsteps(ctx, x, y);
      break;
    case "queue":
      draw_queue(ctx, x, y);
      break;
    case "order":
      draw_order(ctx, x, y);
      break;
    case "clock":
      draw_clock(ctx, x, y, weight);
      break;
    case "seat":
      draw_seat(ctx, x, y, weight);
      break;
    case "meal":
      draw_meal(ctx, x, y, weight);
      break;
    case "return":
      draw_return(ctx, x, y, weight);
      break;
    case "exit":
      draw_exit(ctx, x, y, weight);
      break;
  }
  ctx.restore();
}
