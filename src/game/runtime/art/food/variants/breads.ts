/**
 * Variant layers for the griddle breads: roti prata (plain, two plain, or the folded egg
 * parcels with onion and cheese), murtabak squares with their filling showing at the cut, and
 * masala thosai folded, rolled, with egg or glossed with ghee.
 */
import {
  css,
  fill_ellipse,
  fill_rounded_rect,
  line,
  linear_gradient,
  radial_gradient,
  seeded,
  shade,
  SHADOW_INK,
  tint,
  type PaintContext,
} from "../../canvas";
import { at, heap_scale, pieces_left } from "../motif";
import { paint_dots, paint_flatbread_round, paint_gloss, WHITE } from "../parts";
import { paint_dollop, paint_mushroom } from "../toppings";
import { food_area } from "../vessels";
import type { LayerPaint } from "./layer";

/** Griddled prata gold. */
const PRATA = 0xdca952;
/** Murtabak crust. */
const MURTABAK_CRUST = 0xc8853a;
/** Thosai gold. */
const THOSAI = 0xd69a3d;
/** Potato masala yellow. */
const MASALA = 0xe8b83a;

/**
 * Paints an egg prata: a square-folded parcel of crisp dough with the egg showing through and
 * optional onion and melted cheese.
 *
 * @param q - The layer paint.
 * @param x - Parcel centre x.
 * @param y - Parcel centre y.
 * @param size - Parcel side.
 */
function paint_egg_prata(q: LayerPaint, x: number, y: number, size: number): void {
  const { ctx } = q;
  const half = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  fill_rounded_rect(
    ctx,
    -half + 0.8,
    -half * 0.8 + 1.6,
    size,
    size * 0.8,
    2,
    css(SHADOW_INK, 0.28),
  );
  fill_rounded_rect(ctx, -half, -half * 0.8 + 1.1, size, size * 0.8, 2, css(shade(PRATA, 0.35)));
  fill_rounded_rect(
    ctx,
    -half,
    -half * 0.8,
    size,
    size * 0.8,
    2,
    radial_gradient(ctx, -half * 0.3, -half * 0.3, 0.5, size * 0.8, [
      [0, tint(PRATA, 0.35)],
      [0.6, PRATA],
      [1, shade(PRATA, 0.25)],
    ]),
  );
  line(ctx, -half + 1, 0, half - 1, -0.6, css(shade(PRATA, 0.4), 0.6), 0.6);
  line(ctx, -0.4, -half * 0.8 + 1, 0.4, half * 0.8 - 1, css(shade(PRATA, 0.4), 0.6), 0.6);
  fill_ellipse(ctx, -half * 0.3, -half * 0.25, half * 0.32, half * 0.2, css(0xf6eccb, 0.85));
  fill_ellipse(ctx, half * 0.35, half * 0.2, half * 0.28, half * 0.18, css(0xf2c64a, 0.85));
  fill_ellipse(ctx, -half * 0.25, half * 0.3, half * 0.2, half * 0.13, css(0xf2c64a, 0.7));
  if (q.has("onion")) {
    paint_dots(ctx, 0, 0, half * 0.7, q.isLowDetail ? 3 : 5, 0.7, 0x9a5a8a, q.seed ^ 0x51);
  }
  if (q.has("cheese")) {
    for (const [dx, length] of [
      [-half * 0.5, 2.6],
      [half * 0.2, 3.4],
    ] as const) {
      fill_rounded_rect(ctx, dx, half * 0.8 - 1.4, 2.2, length, 1, css(0xf0b830));
      fill_ellipse(ctx, dx + 1.1, half * 0.8 - 1.2, 1.6, 1, css(0xf6cf50));
    }
    fill_ellipse(ctx, 0, -0.5, half * 0.5, half * 0.2, css(0xf4c640, 0.85));
  }
  ctx.restore();
}

/**
 * The prata layer: one or two plain flaky rounds, or the folded egg parcel with onion and
 * cheese.
 *
 * @param q - The layer paint.
 */
export function paint_prata_layer(q: LayerPaint): void {
  const area = food_area("plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  if (q.has("egg")) {
    const [x, y] = at(area, -0.22, 0.15);
    paint_egg_prata(q, x, y, 14 * size);
    return;
  }
  const pieces = q.has("two-curry") ? pieces_left(2, q.remaining) : 1;
  for (let piece = 0; piece < pieces; piece += 1) {
    const [x, y] = at(area, -0.42 + piece * 0.42, -0.05 + piece * 0.38);
    paint_flatbread_round(q.ctx, x, y, 6.8 * size, PRATA, q.seed ^ piece, true);
  }
}

/**
 * Paints one murtabak square: a crisp griddled top and, on its south face, the cut showing a
 * layer of filling between the dough.
 *
 * @param ctx - The paint context.
 * @param x - Square centre x.
 * @param y - Square top-face centre y.
 * @param filling - The filling colour.
 */
function paint_murtabak_square(ctx: PaintContext, x: number, y: number, filling: number): void {
  const width = 5.8;
  const depth = 4.2;
  const face = 2.6;
  fill_rounded_rect(
    ctx,
    x - width / 2 + 0.8,
    y - depth / 2 + 1.4,
    width,
    depth + face,
    1,
    css(SHADOW_INK, 0.28),
  );
  fill_rounded_rect(
    ctx,
    x - width / 2,
    y + depth / 2 - 0.6,
    width,
    face + 0.6,
    0.8,
    css(shade(MURTABAK_CRUST, 0.2)),
  );
  fill_rounded_rect(
    ctx,
    x - width / 2 + 0.3,
    y + depth / 2 + 0.3,
    width - 0.6,
    face * 0.55,
    0.4,
    css(filling),
  );
  fill_rounded_rect(
    ctx,
    x - width / 2,
    y - depth / 2,
    width,
    depth,
    1,
    linear_gradient(ctx, x - width / 2, y - depth / 2, x + width / 2, y + depth / 2, [
      [0, tint(MURTABAK_CRUST, 0.35)],
      [0.6, MURTABAK_CRUST],
      [1, shade(MURTABAK_CRUST, 0.25)],
    ]),
  );
  line(
    ctx,
    x - width / 2 + 0.8,
    y - 0.4,
    x + width / 2 - 0.8,
    y + 0.2,
    css(shade(MURTABAK_CRUST, 0.45), 0.6),
    0.5,
  );
  fill_ellipse(ctx, x - 1.2, y - 1.1, 1.4, 0.5, css(WHITE, 0.4));
}

/**
 * The murtabak layer: six squares cut from the stuffed bread, their cut faces showing chicken,
 * mutton or vegetable filling, with mushroom and melted cheese for that variant.
 *
 * @param q - The layer paint.
 */
export function paint_murtabak_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("platter", 0, 0, 1, q.remaining);
  const filling = q.has("vegetable") ? 0x5f9a4a : q.has("mutton") ? 0x6a3a2a : 0xd2a05a;
  const squares = pieces_left(6, q.remaining);
  for (let square = 0; square < squares; square += 1) {
    const column = square % 3;
    const row = Math.floor(square / 3);
    const [x, y] = at(area, -0.75 + column * 0.45 + row * 0.08, -0.45 + row * 0.62);
    paint_murtabak_square(ctx, x, y, filling);
  }
  if (q.has("vegetable")) {
    const [vx, vy] = at(area, -0.3, 0.05);
    paint_dots(ctx, vx, vy, 4, q.isLowDetail ? 2 : 4, 0.7, 0x7fc05a, q.seed ^ 0x61);
  }
  if (q.has("mushroom-cheese")) {
    const [cx, cy] = at(area, -0.3, -0.1);
    paint_dollop(ctx, cx, cy, 3.4, 0xf2c440, q.seed ^ 0x62);
    paint_mushroom(ctx, cx - 4, cy + 3, 1.8);
    paint_mushroom(ctx, cx + 4, cy - 1, 1.8);
  }
}

/**
 * Traces a thosai folded in half: a broad half-moon with its straight fold to the north.
 *
 * @param ctx - The paint context.
 * @param x - Fold centre x.
 * @param y - Fold y.
 * @param radius - Half the crepe's width.
 */
function trace_half_moon(ctx: PaintContext, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x - radius, y);
  ctx.ellipse(x, y, radius, radius * 0.62, 0, Math.PI, 0, true);
  ctx.closePath();
}

/**
 * Paints the lacy browning of a thosai: scattered darker spots.
 *
 * @param ctx - The paint context.
 * @param x - Scatter centre x.
 * @param y - Scatter centre y.
 * @param radius - Scatter radius.
 * @param seed - Spot seed.
 * @param count - Spot count.
 */
function paint_lace(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  seed: number,
  count: number,
): void {
  const next = seeded(seed);
  for (let spot = 0; spot < count; spot += 1) {
    fill_ellipse(
      ctx,
      x + (next() - 0.5) * radius * 1.6,
      y + next() * radius * 0.5,
      0.6 + next() * 0.8,
      0.4 + next() * 0.4,
      css(shade(THOSAI, 0.4), 0.6),
    );
  }
}

/**
 * The thosai layer: folded over potato masala, rolled plain, spread with egg, or folded and
 * glossed with ghee.
 *
 * @param q - The layer paint.
 */
export function paint_thosai_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("steel-leaf-plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  const radius = area.rx * 0.95 * size;
  const [x, y] = at(area, 0.05, -0.1);
  if (q.has("plain-roll")) {
    const length = radius * 2;
    fill_rounded_rect(ctx, x - length / 2 + 1, y + 1.2, length, 6.4, 3.2, css(SHADOW_INK, 0.28));
    fill_rounded_rect(
      ctx,
      x - length / 2,
      y - 1,
      length,
      6.4,
      3.2,
      linear_gradient(ctx, 0, y - 1, 0, y + 5.4, [
        [0, tint(THOSAI, 0.4)],
        [0.5, THOSAI],
        [1, shade(THOSAI, 0.35)],
      ]),
    );
    fill_ellipse(ctx, x - length / 2 + 2.6, y + 2.2, 2.2, 2.9, css(shade(THOSAI, 0.2)));
    ctx.save();
    ctx.beginPath();
    ctx.arc(x - length / 2 + 2.6, y + 2.2, 1.3, 0, Math.PI * 1.6);
    ctx.strokeStyle = css(tint(THOSAI, 0.4));
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
    paint_lace(ctx, x, y, radius, q.seed, q.isLowDetail ? 4 : 9);
    return;
  }
  const isGhee = q.has("ghee-gloss");
  const crepe = isGhee ? 0xc98a2e : THOSAI;
  ctx.save();
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1.5;
  ctx.shadowColor = css(SHADOW_INK, 0.3);
  trace_half_moon(ctx, x, y, radius);
  ctx.fillStyle = radial_gradient(ctx, x - radius * 0.3, y, 1, radius * 1.1, [
    [0, tint(crepe, 0.35)],
    [0.6, crepe],
    [1, shade(crepe, 0.3)],
  ]);
  ctx.fill();
  ctx.restore();
  paint_lace(ctx, x, y, radius, q.seed, q.isLowDetail ? 4 : 10);
  if (q.has("masala")) {
    for (let lump = 0; lump < 3; lump += 1) {
      paint_dollop(
        ctx,
        x - radius * 0.5 + lump * radius * 0.5,
        y - 0.6,
        1.9,
        MASALA,
        q.seed ^ (0x71 + lump),
      );
    }
  }
  if (q.has("egg-centre")) {
    fill_ellipse(ctx, x, y + radius * 0.25, radius * 0.55, radius * 0.24, css(0xf2c64a, 0.9));
    fill_ellipse(
      ctx,
      x - radius * 0.2,
      y + radius * 0.2,
      radius * 0.22,
      radius * 0.1,
      css(0xfaf0d2, 0.9),
    );
  }
  line(ctx, x - radius, y, x + radius, y, css(tint(crepe, 0.45)), 1);
  if (isGhee) {
    paint_gloss(ctx, x - radius * 0.3, y + radius * 0.15, radius * 0.35, 1.2, 0.75, 0);
    paint_gloss(ctx, x + radius * 0.35, y + radius * 0.3, radius * 0.25, 0.9, 0.6, 0);
  }
}
