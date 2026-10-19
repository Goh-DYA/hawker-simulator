/**
 * Effect painters: the small textures the renderer scales, fades and tints at run time (steam
 * puffs, lamp light pools, sale sparkles, the selection ring, queue and reserved-seat markers,
 * the carried tray, a tray left on a seat, the Writer's Pick plaque, the customer status
 * bubbles and the patience arc track).
 *
 * Each effect is centred in an {@link EFFECT_SIZE} square. Steam, the light pool, the sparkle and
 * the selection ring are painted white so the renderer can tint them; the markers are white tape
 * with a faint dark edge so they read on the pale floor; the tray keeps its own laminate colours
 * and the status bubbles (in `effects/indicators.ts`) are cream with ink pictograms.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  line,
  linear_gradient,
  radial_gradient,
  shade,
  stroke_ellipse,
  stroke_rounded_rect,
  TAU,
  tint,
  type PaintContext,
} from "./canvas";
import { paint_indicator, type IndicatorKind } from "./effects/indicators";
import {
  EFFECT_SIZE,
  type EffectKind,
  type EffectPaintSpec,
  type PaintFrame,
  type PaintPlan,
} from "./specs";

const CENTRE = EFFECT_SIZE / 2;
const WHITE = 0xffffff;
const SHADOW = 0x18323b;
/** The brown laminate of a hawker food tray. */
const TRAY_LAMINATE = 0x9a6438;
/** The printed paper liner on the tray. */
const TRAY_LINER = 0xf4e9d2;

/** A painter for one effect. */
type EffectPainter = (ctx: PaintContext, frame: PaintFrame) => void;

/**
 * Paints one soft lobe of vapour: a radial falloff that is dense at its heart and feathers out.
 *
 * @param ctx - The paint context.
 * @param x - Lobe centre x.
 * @param y - Lobe centre y.
 * @param radius - Lobe radius.
 * @param alpha - Peak opacity.
 */
function paint_vapour_lobe(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  fill_circle(
    ctx,
    x,
    y,
    radius,
    radial_gradient(ctx, x, y, 0, radius, [
      [0, WHITE, alpha],
      [0.35, WHITE, alpha * 0.75],
      [0.7, WHITE, alpha * 0.28],
      [1, WHITE, 0],
    ]),
  );
}

/**
 * Paints a steam puff: three soft lobes stacked into a rising, slightly leaning plume, with a
 * faint curl between them.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_steam(ctx: PaintContext, frame: PaintFrame): void {
  paint_vapour_lobe(ctx, CENTRE - 3, CENTRE + 10, 10, 0.55);
  paint_vapour_lobe(ctx, CENTRE + 4, CENTRE - 1, 13, 0.5);
  paint_vapour_lobe(ctx, CENTRE - 2, CENTRE - 14, 11, 0.42);
  if (frame.isLowDetail) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CENTRE - 2, CENTRE + 16);
  ctx.bezierCurveTo(CENTRE + 9, CENTRE + 6, CENTRE - 9, CENTRE - 6, CENTRE + 2, CENTRE - 22);
  ctx.strokeStyle = css(WHITE, 0.14);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints a lamp's pool of light: a wide, smooth, near-Gaussian falloff the renderer tints warm
 * and blends additively over the floor.
 *
 * @param ctx - The paint context.
 */
function paint_light_pool(ctx: PaintContext): void {
  fill_circle(
    ctx,
    CENTRE,
    CENTRE,
    CENTRE,
    radial_gradient(ctx, CENTRE, CENTRE, 0, CENTRE, [
      [0, WHITE, 0.5],
      [0.18, WHITE, 0.44],
      [0.38, WHITE, 0.3],
      [0.58, WHITE, 0.15],
      [0.78, WHITE, 0.05],
      [1, WHITE, 0],
    ]),
  );
}

/**
 * Traces a four-pointed star with pinched, curved sides.
 *
 * @param ctx - The paint context.
 * @param length - Tip distance from the centre.
 * @param waist - How far the sides pinch out from the centre.
 */
function trace_star(ctx: PaintContext, length: number, waist: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -length);
  ctx.quadraticCurveTo(waist, -waist, length, 0);
  ctx.quadraticCurveTo(waist, waist, 0, length);
  ctx.quadraticCurveTo(-waist, waist, -length, 0);
  ctx.quadraticCurveTo(-waist, -waist, 0, -length);
  ctx.closePath();
}

/**
 * Paints a sale sparkle: a long four-point star, a shorter one turned 45 degrees, a glowing core
 * and two small twinkles beside it.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_sparkle(ctx: PaintContext, frame: PaintFrame): void {
  fill_circle(
    ctx,
    CENTRE,
    CENTRE,
    16,
    radial_gradient(ctx, CENTRE, CENTRE, 0, 16, [
      [0, WHITE, 0.45],
      [1, WHITE, 0],
    ]),
  );
  ctx.save();
  ctx.translate(CENTRE, CENTRE);
  trace_star(ctx, 22, 3.6);
  ctx.fillStyle = css(WHITE, 0.92);
  ctx.fill();
  ctx.rotate(Math.PI / 4);
  trace_star(ctx, 12, 2.4);
  ctx.fillStyle = css(WHITE, 0.85);
  ctx.fill();
  ctx.restore();
  fill_circle(ctx, CENTRE, CENTRE, 3.2, css(WHITE));
  if (frame.isLowDetail) return;
  for (const [x, y, size] of [
    [CENTRE + 15, CENTRE - 14, 6],
    [CENTRE - 14, CENTRE + 13, 4.5],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    trace_star(ctx, size, 1.2);
    ctx.fillStyle = css(WHITE, 0.85);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Paints the selection ring: a soft halo, a bold ring with a faint dark edge so it holds on the
 * pale floor, and a thin inner ring.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_selection_ring(ctx: PaintContext, frame: PaintFrame): void {
  fill_circle(
    ctx,
    CENTRE,
    CENTRE,
    30,
    radial_gradient(ctx, CENTRE, CENTRE, 16, 30, [
      [0, WHITE, 0],
      [0.5, WHITE, 0.3],
      [1, WHITE, 0],
    ]),
  );
  stroke_ellipse(ctx, CENTRE, CENTRE, 24, 24, css(SHADOW, frame.isHighContrast ? 0.6 : 0.22), 5.5);
  stroke_ellipse(ctx, CENTRE, CENTRE, 24, 24, css(WHITE), frame.isHighContrast ? 4 : 3.4);
  stroke_ellipse(ctx, CENTRE, CENTRE, 18.5, 18.5, css(WHITE, 0.7), 1.4);
}

/**
 * Paints a queue cell marker: a dashed ring of floor tape around a faint disc and a centre spot,
 * like the stand-here stickers on a hawker centre floor.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_queue_marker(ctx: PaintContext, frame: PaintFrame): void {
  fill_circle(
    ctx,
    CENTRE,
    CENTRE,
    20,
    radial_gradient(ctx, CENTRE, CENTRE, 0, 20, [
      [0, WHITE, 0.3],
      [0.8, WHITE, 0.16],
      [1, WHITE, 0],
    ]),
  );
  ctx.save();
  ctx.setLineDash([5, 3.5]);
  stroke_ellipse(ctx, CENTRE, CENTRE, 17, 17, css(SHADOW, frame.isHighContrast ? 0.55 : 0.2), 4);
  stroke_ellipse(ctx, CENTRE, CENTRE, 17, 17, css(WHITE, 0.95), 2.4);
  ctx.restore();
  fill_circle(ctx, CENTRE, CENTRE, 4.5, css(SHADOW, frame.isHighContrast ? 0.5 : 0.18));
  fill_circle(ctx, CENTRE, CENTRE, 3.4, css(WHITE, 0.95));
}

/**
 * Paints a reserved-seat marker: a ring with a packet of tissues on it, the way regulars reserve
 * a seat at a hawker centre.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_seat_marker(ctx: PaintContext, frame: PaintFrame): void {
  stroke_ellipse(ctx, CENTRE, CENTRE, 18, 18, css(SHADOW, frame.isHighContrast ? 0.55 : 0.2), 4.4);
  stroke_ellipse(ctx, CENTRE, CENTRE, 18, 18, css(WHITE, 0.95), 2.6);
  // The tissue packet, seen from above with a thin front edge.
  const width = 20;
  const height = 13;
  const x = CENTRE - width / 2;
  const y = CENTRE - height / 2 - 1;
  if (!frame.isLowDetail) {
    fill_rounded_rect(ctx, x + 1.5, y + 2.5, width, height + 1.5, 3, css(SHADOW, 0.22));
  }
  fill_rounded_rect(ctx, x, y + 1.5, width, height, 3, css(0xd8dcdc));
  fill_rounded_rect(ctx, x, y, width, height, 3, css(WHITE));
  fill_rounded_rect(ctx, x + 2, y + 2, width - 4, 3, 1.5, css(0xe9eeee));
  fill_ellipse(ctx, CENTRE, y + height / 2 + 0.5, 6, 1.6, css(0xb9c2c4));
  // A tuft of tissue pulled from the slit.
  fill_ellipse(ctx, CENTRE + 1, y + height / 2 - 1, 4.5, 3.2, css(WHITE));
  stroke_rounded_rect(
    ctx,
    x,
    y,
    width,
    height + 1.5,
    3,
    css(SHADOW, frame.isHighContrast ? 0.9 : 0.35),
    frame.isHighContrast ? 1.6 : 1,
  );
}

/**
 * Paints a food tray in 3/4: a brown laminate tray with a lit rim, a visible front edge, the
 * far inner wall of its well catching the light, and a printed paper liner where the dish sits
 * (centred on the texture, a pixel or two above the middle).
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_tray(ctx: PaintContext, frame: PaintFrame): void {
  const width = 44;
  const top_height = 27;
  const front = 5;
  const x = CENTRE - width / 2;
  const y = CENTRE - 2 - top_height / 2;
  if (!frame.isLowDetail) {
    ctx.save();
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.shadowColor = css(SHADOW, 0.32);
    fill_rounded_rect(ctx, x, y, width, top_height + front, 5, css(shade(TRAY_LAMINATE, 0.4)));
    ctx.restore();
  }
  // The front edge, then the rim seen from above.
  fill_rounded_rect(
    ctx,
    x,
    y + top_height - 6,
    width,
    front + 6,
    5,
    linear_gradient(ctx, 0, y + top_height - 1, 0, y + top_height + front, [
      [0, shade(TRAY_LAMINATE, 0.25)],
      [1, shade(TRAY_LAMINATE, 0.45)],
    ]),
  );
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    top_height,
    5,
    linear_gradient(ctx, x, y, x + width * 0.4, y + top_height, [
      [0, tint(TRAY_LAMINATE, 0.22)],
      [1, TRAY_LAMINATE],
    ]),
  );
  // The well: its floor a shade darker, its far wall lit.
  fill_rounded_rect(
    ctx,
    x + 3,
    y + 3,
    width - 6,
    top_height - 6,
    3.5,
    css(shade(TRAY_LAMINATE, 0.14)),
  );
  fill_rounded_rect(ctx, x + 3, y + 3, width - 6, 2.5, 1.5, css(tint(TRAY_LAMINATE, 0.3)));
  // The paper liner with a printed border rule.
  fill_rounded_rect(ctx, x + 6, y + 6, width - 12, top_height - 11, 1.5, css(TRAY_LINER));
  if (!frame.isLowDetail) {
    stroke_rounded_rect(
      ctx,
      x + 8,
      y + 8,
      width - 16,
      top_height - 15,
      1,
      css(0xd95d39, 0.35),
      0.8,
    );
    line(
      ctx,
      x + 10,
      y + top_height - 9,
      x + width - 10,
      y + top_height - 9,
      css(0x167d7f, 0.25),
      0.8,
    );
  }
  ctx.fillStyle = css(WHITE, 0.35);
  ctx.fillRect(x + 5, y + 1, width - 10, 1.2);
  stroke_rounded_rect(
    ctx,
    x,
    y,
    width,
    top_height + front,
    5,
    css(frame.isHighContrast ? SHADOW : shade(TRAY_LAMINATE, 0.6), frame.isHighContrast ? 1 : 0.7),
    frame.isHighContrast ? 2 : 1,
  );
}

/**
 * Paints the patience arc track: a faint ring with a darker underlay so it holds over the floor.
 * The live arc itself is drawn by the overlay; this texture is the track under it.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_patience_arc(ctx: PaintContext, frame: PaintFrame): void {
  ctx.beginPath();
  ctx.arc(CENTRE, CENTRE, 22, 0, TAU);
  ctx.strokeStyle = css(SHADOW, frame.isHighContrast ? 0.5 : 0.22);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CENTRE, CENTRE, 22, 0, TAU);
  ctx.strokeStyle = css(WHITE, 0.45);
  ctx.lineWidth = 3.4;
  ctx.stroke();
  for (let quarter = 0; quarter < 4; quarter += 1) {
    const angle = (quarter / 4) * TAU - Math.PI / 2;
    fill_circle(
      ctx,
      CENTRE + Math.cos(angle) * 22,
      CENTRE + Math.sin(angle) * 22,
      1.2,
      css(WHITE, 0.8),
    );
  }
}

/**
 * Wraps a status bubble as an effect painter.
 *
 * @param kind - The status.
 * @returns The painter.
 */
function indicator(kind: IndicatorKind): EffectPainter {
  return (ctx, frame) => paint_indicator(ctx, kind, frame);
}

/** The ceramic of an empty bowl left on a tray. */
const BOWL_CERAMIC = 0xf3efe6;
/** The paper of a used tissue left on a tray. */
const TISSUE_PAPER = 0xfbfaf6;
/** The brass of a Writer's Pick plaque. */
const PLAQUE_BRASS = 0xc9a24a;
/** The ink of the star on a Writer's Pick plaque. */
const PLAQUE_INK = 0x5a3e12;

/**
 * Paints a tray a guest left on their seat: the food tray with an empty bowl, a resting pair of
 * chopsticks and a crumpled tissue, so it reads as waiting for the table-cleaning crew.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_left_tray(ctx: PaintContext, frame: PaintFrame): void {
  paint_tray(ctx, frame);
  const bowl_x = CENTRE - 4;
  const bowl_y = CENTRE - 2;
  fill_ellipse(ctx, bowl_x, bowl_y + 1.5, 9, 5.5, css(shade(BOWL_CERAMIC, 0.25)));
  fill_ellipse(ctx, bowl_x, bowl_y, 9, 5.5, css(BOWL_CERAMIC));
  fill_ellipse(ctx, bowl_x, bowl_y + 0.5, 6.5, 3.6, css(shade(BOWL_CERAMIC, 0.12)));
  stroke_ellipse(ctx, bowl_x, bowl_y, 9, 5.5, css(SHADOW, frame.isHighContrast ? 0.9 : 0.3), frame.isHighContrast ? 1.2 : 0.8);
  line(ctx, CENTRE + 5, CENTRE - 7, CENTRE + 14, CENTRE + 3, css(shade(TRAY_LINER, 0.45)), 1.4);
  line(ctx, CENTRE + 7, CENTRE - 7, CENTRE + 16, CENTRE + 2, css(shade(TRAY_LINER, 0.45)), 1.4);
  fill_circle(ctx, CENTRE + 9, CENTRE + 5, 3, css(TISSUE_PAPER));
  fill_circle(ctx, CENTRE + 11.5, CENTRE + 4, 2.2, css(shade(TISSUE_PAPER, 0.08)));
}

/**
 * Paints a Writer's Pick plaque: a small brass plate with a bevelled rim and a five-point star,
 * hung on a stall that earned the food writer's recommendation.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 */
function paint_writer_plaque(ctx: PaintContext, frame: PaintFrame): void {
  const width = 26;
  const height = 20;
  const x = CENTRE - width / 2;
  const y = CENTRE - height / 2;
  if (!frame.isLowDetail) fill_rounded_rect(ctx, x + 1, y + 2, width, height, 4, css(SHADOW, 0.3));
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    4,
    linear_gradient(ctx, x, y, x + width, y + height, [
      [0, tint(PLAQUE_BRASS, 0.35)],
      [1, shade(PLAQUE_BRASS, 0.2)],
    ]),
  );
  stroke_rounded_rect(ctx, x + 2, y + 2, width - 4, height - 4, 3, css(shade(PLAQUE_BRASS, 0.35)), 1);
  const points: [number, number][] = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? 6.5 : 2.8;
    points.push([CENTRE + Math.cos(angle) * radius, CENTRE + 0.5 + Math.sin(angle) * radius]);
  }
  fill_polygon(ctx, points, css(frame.isHighContrast ? 0x000000 : PLAQUE_INK));
}

const EFFECT_PAINTERS: Readonly<Record<EffectKind, EffectPainter>> = {
  steam: paint_steam,
  "light-pool": paint_light_pool,
  sparkle: paint_sparkle,
  "selection-ring": paint_selection_ring,
  "queue-marker": paint_queue_marker,
  "seat-marker": paint_seat_marker,
  tray: paint_tray,
  "indicator-question": indicator("question"),
  "indicator-footsteps": indicator("footsteps"),
  "indicator-queue": indicator("queue"),
  "indicator-order": indicator("order"),
  "indicator-clock": indicator("clock"),
  "indicator-seat": indicator("seat"),
  "indicator-meal": indicator("meal"),
  "indicator-return": indicator("return"),
  "indicator-exit": indicator("exit"),
  "patience-arc": paint_patience_arc,
  "left-tray": paint_left_tray,
  "writer-plaque": paint_writer_plaque,
};

/**
 * Plans an effect texture.
 *
 * @param spec - The effect spec.
 * @returns The square plan.
 */
export function plan_effect(spec: EffectPaintSpec): PaintPlan {
  return {
    width: EFFECT_SIZE,
    height: EFFECT_SIZE,
    paint: (ctx) => EFFECT_PAINTERS[spec.effect](ctx, spec.frame),
  };
}
