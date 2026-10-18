/**
 * Variant layers for the plated rice and fried dishes: the nasi lemak sides, the briyani
 * protein, the duck rice toppings and the white or black fried carrot cake.
 *
 * Each lays its pieces beside the rice the dish's base motif painted, in the food area of the
 * dish's own vessel.
 */
import {
  css,
  fill_ellipse,
  fill_rounded_rect,
  line,
  linear_gradient,
  radial_gradient,
  SHADOW_INK,
  speckle,
} from "../../canvas";
import { at, heap_scale, pieces_left } from "../motif";
import {
  paint_ball,
  paint_chunk,
  paint_cucumber,
  paint_dots,
  paint_liquid,
  paint_egg_half,
  paint_fried_egg,
  paint_gloss,
  paint_leaf,
  paint_prawn,
  DARK_SOY,
  PEANUT,
} from "../parts";
import {
  paint_dollop,
  paint_drumstick,
  paint_fried_fish,
  paint_scallions,
  paint_shreds,
  paint_slice_row,
  paint_wing,
} from "../toppings";
import { food_area } from "../vessels";
import type { LayerPaint } from "./layer";

/**
 * Paints a breaded chicken cutlet cut into strips: a golden crumbed slab with cut lines.
 *
 * @param q - The layer paint.
 * @param x - Cutlet centre x.
 * @param y - Cutlet centre y.
 * @param size - Cutlet length.
 */
function paint_cutlet(q: LayerPaint, x: number, y: number, size: number): void {
  const { ctx } = q;
  const width = size;
  const height = size * 0.55;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25);
  fill_rounded_rect(
    ctx,
    -width / 2 + 0.8,
    -height / 2 + 1.4,
    width,
    height,
    2,
    css(SHADOW_INK, 0.26),
  );
  fill_rounded_rect(ctx, -width / 2, -height / 2 + 1, width, height, 2, css(0x8a4e1e));
  fill_rounded_rect(
    ctx,
    -width / 2,
    -height / 2,
    width,
    height,
    2,
    linear_gradient(ctx, -width / 2, -height / 2, width / 2, height / 2, [
      [0, 0xe8b25a],
      [0.6, 0xc8822e],
      [1, 0xa0601e],
    ]),
  );
  if (!q.isLowDetail) {
    speckle(
      ctx,
      -width / 2 + 1,
      -height / 2 + 0.6,
      width - 2,
      height - 1.2,
      10,
      [0xf2cf80, 0x9a581c],
      q.seed ^ 0x77,
      0.7,
    );
  }
  for (let cut = 1; cut < 4; cut += 1) {
    const cx = -width / 2 + (cut * width) / 4;
    line(ctx, cx, -height / 2 + 0.4, cx - 0.6, height / 2 - 0.2, css(0x6a3a14, 0.75), 0.6);
  }
  ctx.restore();
}

/**
 * The nasi lemak layer: chicken wing, cutlet, both, egg with anchovies and peanuts, fried fish,
 * or plain rice with a pandan leaf.
 *
 * @param q - The layer paint.
 */
export function paint_nasi_lemak_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("leaf-plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  if (q.has("rice-only")) {
    const [px, py] = at(area, -0.32, -0.3);
    paint_leaf(ctx, px, py, 8 * size, -0.5, 0x3d9a3a);
    for (let slice = 0; slice < pieces_left(2, q.remaining); slice += 1) {
      const [cx, cy] = at(area, 0.4 + slice * 0.25, -0.1 + slice * 0.25);
      paint_cucumber(ctx, cx, cy, 2.6);
    }
    return;
  }
  if (q.has("egg-ikan")) {
    const [ex, ey] = at(area, 0.42, -0.3);
    paint_fried_egg(ctx, ex, ey, 4.6 * size);
    const [ax, ay] = at(area, 0.5, 0.32);
    paint_shreds(ctx, ax, ay, 3.4 * size, q.isLowDetail ? 4 : 8, 0xb88a52, q.seed ^ 0x11, 2.6, 1.1);
    paint_dots(ctx, ax + 1, ay, 3 * size, q.isLowDetail ? 3 : 6, 0.9, PEANUT, q.seed ^ 0x12);
    return;
  }
  if (q.has("fish")) {
    const [fx, fy] = at(area, 0.42, -0.08);
    paint_fried_fish(ctx, fx, fy, 14 * size, -0.35, 0xc8862e);
    return;
  }
  const hasWing = q.has("wing");
  const hasCutlet = q.has("cutlet");
  if (hasCutlet) {
    const [cx, cy] = at(area, 0.42, hasWing ? -0.45 : -0.15);
    paint_cutlet(q, cx, cy, 11 * size);
  }
  if (hasWing) {
    const [wx, wy] = at(area, 0.45, hasCutlet ? 0.3 : -0.05);
    paint_wing(ctx, wx, wy, 11.5 * size, -0.4, 0xbf7a32);
  }
}

/**
 * The briyani layer: a masala chicken leg, fish and prawns, mutton on the bone or mixed
 * vegetables, each with a spoon of gravy.
 *
 * @param q - The layer paint.
 */
export function paint_briyani_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  const [gx, gy] = at(area, 0.42, 0.1);
  if (q.has("vegetable")) {
    paint_dollop(ctx, gx, gy, 4 * size, 0xc8862e, q.seed ^ 0x21);
    for (let floret = 0; floret < pieces_left(3, q.remaining); floret += 1) {
      paint_ball(ctx, gx - 3 + floret * 3, gy - 2 + (floret % 2) * 3, 2.1, 0xf1ead2);
    }
    paint_chunk(ctx, gx + 3, gy + 2.5, 2.8, 0xe8782a, 0.4, { gloss: 0.4 });
    paint_dots(ctx, gx, gy + 1, 3, q.isLowDetail ? 3 : 5, 0.8, 0x5aa040, q.seed ^ 0x22);
    return;
  }
  if (q.has("fish-prawn")) {
    paint_dollop(ctx, gx, gy + 1, 3.6 * size, 0xa8461e, q.seed ^ 0x23);
    paint_chunk(ctx, gx - 1, gy - 1.5, 5 * size, 0xc8782e, 0.3, { gloss: 0.4 });
    for (let prawn = 0; prawn < pieces_left(2, q.remaining); prawn += 1) {
      paint_prawn(ctx, gx + 2 + prawn * 2, gy + 2.5 - prawn * 5, 5.2, 0.4 + prawn * 2);
    }
    return;
  }
  if (q.has("mutton")) {
    paint_dollop(ctx, gx, gy, 4.4 * size, 0x6a2e18, q.seed ^ 0x24);
    for (let chunk = 0; chunk < pieces_left(3, q.remaining); chunk += 1) {
      paint_chunk(ctx, gx - 3 + chunk * 3, gy - 1.5 + (chunk % 2) * 3, 3.8, 0x5e3222, chunk * 0.5, {
        gloss: 0.35,
      });
    }
    return;
  }
  paint_dollop(ctx, gx, gy + 1, 3.8 * size, 0x8a3a1a, q.seed ^ 0x25);
  paint_drumstick(ctx, gx, gy - 0.5, 12.5 * size, -0.5, 0x9a4a24);
}

/**
 * The duck rice layer: braised duck with a braised egg and tofu, lacquered roast duck, or the
 * rice alone with salted vegetables.
 *
 * @param q - The layer paint.
 */
export function paint_duck_rice_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  if (q.has("rice-only")) {
    const [sx, sy] = at(area, 0.4, -0.15);
    paint_shreds(ctx, sx, sy, 4 * size, q.isLowDetail ? 4 : 8, 0x6a7a34, q.seed ^ 0x31, 3.6, 1.6);
    const [dx, dy] = at(area, -0.35, -0.05);
    paint_liquid(ctx, dx + 0.5, dy + 0.8, 4.6, 3.4, DARK_SOY, { sheen: 0.45, alpha: 0.55 });
    paint_scallions(ctx, dx, dy, 3, 4, q.seed ^ 0x33, 0x4e9a3e);
    return;
  }
  const isRoast = q.has("roasted");
  const [sx, sy] = at(area, 0.08, -0.25);
  paint_slice_row(
    ctx,
    sx,
    sy,
    pieces_left(5, q.remaining),
    isRoast ? 0xd89a7a : 0x9a6a4e,
    isRoast ? 0x8a2e1a : 0x5a2e1a,
    isRoast ? 0.6 : 0.35,
  );
  if (isRoast) {
    const [px, py] = at(area, 0.3, -0.1);
    paint_gloss(ctx, px, py, 3, 1, 0.5);
    return;
  }
  const [ex, ey] = at(area, 0.05, 0.55);
  paint_egg_half(ctx, ex, ey, 3.2, { white: 0xb8824a, yolk: 0xd49a33 });
  const [tx, ty] = at(area, 0.42, 0.5);
  paint_chunk(ctx, tx, ty, 3.6, 0x9a6a3a, 0.3, { gloss: 0.35 });
}

/**
 * The fried carrot cake layer: pale radish cake cubes scrambled with golden egg (white), or
 * the same glazed in dark sweet soy (black), with preserved radish and spring onion.
 *
 * @param q - The layer paint.
 */
export function paint_carrot_cake_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("plate", 0, 0, 1, q.remaining);
  const isBlack = q.has("black-sauce");
  const cake = isBlack ? 0x5c3826 : 0xf0dfb2;
  const egg = isBlack ? 0xc8963a : 0xf2c64a;
  const size = heap_scale(q.remaining);
  fill_ellipse(
    ctx,
    area.x + 0.6,
    area.y + 1,
    area.rx * 0.82 * size,
    area.ry * 0.76 * size,
    css(SHADOW_INK, 0.2),
  );
  fill_ellipse(
    ctx,
    area.x,
    area.y,
    area.rx * 0.82 * size,
    area.ry * 0.76 * size,
    radial_gradient(ctx, area.x - 3, area.y - 3, 1, area.rx * 0.9, [
      [0, isBlack ? 0x7a5232 : 0xf4d98a],
      [0.7, isBlack ? 0x5a3622 : 0xdcae52],
      [1, isBlack ? 0x3a2216 : 0xb8823a],
    ]),
  );
  const spots: ReadonlyArray<readonly [number, number]> = [
    [-0.45, -0.35],
    [0.05, -0.45],
    [0.5, -0.2],
    [-0.55, 0.25],
    [-0.05, 0.15],
    [0.4, 0.45],
    [-0.15, 0.6],
  ];
  const shown = pieces_left(spots.length, q.remaining);
  spots.slice(0, shown).forEach(([u, v], index) => {
    const [ex, ey] = at(area, u + 0.12, v + 0.15);
    if (index % 2 === 0) paint_dollop(ctx, ex, ey, 2.2, egg, q.seed ^ index);
    const [x, y] = at(area, u, v);
    paint_chunk(ctx, x, y, 4.4, cake, index * 0.6, { gloss: isBlack ? 0.5 : 0.3, edge: 0.7 });
    fill_ellipse(ctx, x + 1, y + 1, 1.2, 0.8, css(isBlack ? 0x2a160c : 0xb87a32, 0.7));
  });
  paint_dots(
    ctx,
    area.x,
    area.y,
    area.rx * 0.55,
    q.isLowDetail ? 3 : 6,
    0.7,
    0x8a5a2a,
    q.seed ^ 0x41,
  );
  paint_scallions(ctx, area.x, area.y - 1, area.rx * 0.6, q.isLowDetail ? 3 : 6, q.seed ^ 0x42);
  if (isBlack) fill_ellipse(ctx, area.x - 3, area.y - 3, 4, 1, css(0xffffff, 0.3));
}
