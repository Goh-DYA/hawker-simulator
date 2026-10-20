/**
 * Variant layers for the plated rice, fried and Western dishes: the nasi lemak sides, the
 * briyani protein, the duck rice toppings (or its dry noodles), the white or black fried carrot
 * cake, the two dishes picked for economic rice, the side served with nasi padang's rice, and
 * the hawker Western plates (a chicken chop or fish with its sides).
 *
 * Most lay their pieces beside the rice the dish's base motif painted, in the food area of the
 * dish's own vessel; economic rice, nasi padang and the Western plates paint the whole serving.
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
import type { PaintContext } from "../../canvas";
import { at, heap_scale, pieces_left } from "../motif";
import {
  FRIED_BATTER,
  paint_ball,
  paint_battered_piece,
  paint_chilli_slice,
  paint_chunk,
  paint_citrus_wedge,
  paint_cucumber,
  paint_dots,
  paint_drizzle,
  paint_liquid,
  paint_egg_half,
  paint_fried_egg,
  paint_gloss,
  paint_leaf,
  paint_noodles,
  paint_prawn,
  paint_rice_mound,
  paint_slice,
  paint_tofu,
  DARK_SOY,
  PEANUT,
  type FoodArea,
} from "../parts";
import {
  paint_dollop,
  paint_drumstick,
  paint_fried_fish,
  paint_fries,
  paint_greens,
  paint_grilled_cut,
  paint_scallions,
  paint_shreds,
  paint_slice_row,
  paint_slivers,
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
 * Paints braised duck noodles, dry: egg noodles tossed in a black braising gravy that covers
 * the rice the dish's base painted, under shredded braised duck and its skin, with greens.
 *
 * @param q - The layer paint.
 * @param area - The plate's food area.
 */
function paint_duck_noodles(q: LayerPaint, area: FoodArea): void {
  const { ctx } = q;
  const size = heap_scale(q.remaining);
  const [nx, ny] = at(area, -0.3, -0.05);
  paint_liquid(ctx, nx, ny + 0.6, area.rx * 0.66 * size, area.ry * 0.8 * size, 0x2e1c12, {
    sheen: 0.4,
  });
  paint_noodles(ctx, nx, ny, area.rx * 0.58 * size, 0xb88a42, q.seed, 1.3, q.isLowDetail);
  paint_drizzle(ctx, nx, ny, area.rx * 0.4 * size, 0x2e1c12, q.seed ^ 0x35, 2, 1);
  paint_shreds(
    ctx,
    nx + 2,
    ny - 1,
    4.4 * size,
    q.isLowDetail ? 4 : 8,
    0x9a6a4e,
    q.seed ^ 0x36,
    3.6,
    1.6,
  );
  paint_shreds(
    ctx,
    nx + 2,
    ny - 1,
    3.6 * size,
    q.isLowDetail ? 2 : 4,
    0x5a2e1a,
    q.seed ^ 0x37,
    3,
    1.2,
  );
  const [gx, gy] = at(area, 0.42, 0.25);
  paint_greens(ctx, gx, gy, 8, -0.4, 0x3f8a3a);
}

/**
 * The duck rice layer: braised duck with a braised egg and tofu, lacquered roast duck, the rice
 * alone with salted vegetables, or dry braised duck noodles.
 *
 * @param q - The layer paint.
 */
export function paint_duck_rice_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  if (q.has("noodles")) {
    paint_duck_noodles(q, area);
    return;
  }
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

/** Economic rice's white rice and the curry ladled over it. */
const ECONOMIC_RICE = { rice: 0xf6f1e4, curry: 0xd2802a } as const;

/**
 * Paints economic rice's stir-fried cabbage and carrot, the vegetable dish every plate has.
 *
 * @param q - The layer paint.
 * @param area - The plate's food area.
 */
function paint_cabbage_scoop(q: LayerPaint, area: FoodArea): void {
  const leaves = pieces_left(3, q.remaining);
  for (let leaf = 0; leaf < leaves; leaf += 1) {
    const [lx, ly] = at(area, -0.55 + leaf * 0.28, 0.5 + (leaf % 2) * 0.12);
    paint_leaf(q.ctx, lx, ly, 6.4, -0.5 + leaf * 0.6, leaf % 2 ? 0xd8e6b0 : 0xb9d68a);
  }
  const [vx, vy] = at(area, -0.3, 0.5);
  paint_shreds(q.ctx, vx, vy, 3.6, q.isLowDetail ? 2 : 4, 0xe8782a, q.seed ^ 0x81, 3, 1);
}

/**
 * Paints economic rice's second dish beside the rice, by the variant's key: sweet-and-sour
 * pork, a steamed fish fillet in light soy, a second vegetable (dark leafy greens) or crisp
 * fried meat. `fried-meat` is checked before `meat`, which it contains.
 *
 * @param q - The layer paint.
 * @param area - The plate's food area.
 */
function paint_economic_rice_side(q: LayerPaint, area: FoodArea): void {
  const { ctx } = q;
  const size = heap_scale(q.remaining);
  const [mx, my] = at(area, 0.45, 0.05);
  if (q.has("fried-meat")) {
    const pieces = pieces_left(4, q.remaining);
    for (let piece = 0; piece < pieces; piece += 1) {
      const [px, py] = at(area, 0.3 + (piece % 2) * 0.3, -0.2 + Math.floor(piece / 2) * 0.4);
      paint_battered_piece(
        ctx,
        px,
        py,
        6.4,
        4.6,
        0.4 * piece - 0.3,
        q.seed ^ (piece * 0x3d),
        FRIED_BATTER.crater,
        q.isLowDetail,
      );
    }
    return;
  }
  if (q.has("fish")) {
    paint_liquid(ctx, mx, my, area.rx * 0.42 * size, area.ry * 0.5 * size, 0xa8783a, {
      sheen: 0.45,
      alpha: 0.8,
    });
    const fillets = pieces_left(2, q.remaining);
    for (let fillet = 0; fillet < fillets; fillet += 1) {
      const [fx, fy] = at(area, 0.35 + fillet * 0.22, -0.18 + fillet * 0.38);
      paint_slice(ctx, fx, fy, 8, 4.4, -0.3 + fillet * 0.4, 0xf6ece0, {
        skin: 0x8f7c7e,
        gloss: 0.5,
      });
    }
    paint_slivers(ctx, mx, my, 3, q.isLowDetail ? 2 : 4, 0xf0d890, q.seed ^ 0x84);
    paint_scallions(ctx, mx, my, 3, q.isLowDetail ? 2 : 3, q.seed ^ 0x85);
    return;
  }
  if (q.has("two-veg")) {
    const stems = pieces_left(3, q.remaining);
    for (let stem = 0; stem < stems; stem += 1) {
      const [gx, gy] = at(area, 0.3 + (stem % 2) * 0.3, -0.25 + stem * 0.3);
      paint_greens(ctx, gx, gy, 8.4, -0.6 + stem * 0.5, 0x2f6a2a);
    }
    paint_dots(ctx, mx, my, 3.4, q.isLowDetail ? 2 : 5, 0.6, 0xf2e2b0, q.seed ^ 0x86);
    return;
  }
  // The meat: sweet-and-sour pork in its glossy red sauce.
  paint_liquid(ctx, mx, my, area.rx * 0.42 * size, area.ry * 0.5 * size, 0xd0402a, {
    sheen: 0.5,
  });
  const pork = pieces_left(4, q.remaining);
  for (let piece = 0; piece < pork; piece += 1) {
    const [px, py] = at(area, 0.3 + (piece % 2) * 0.3, -0.2 + Math.floor(piece / 2) * 0.4);
    paint_chunk(ctx, px, py, 4, 0xc8452a, 0.4 * piece, { radius: 1.8, gloss: 0.55 });
  }
  paint_slivers(ctx, mx, my, 3.2, q.isLowDetail ? 2 : 3, 0x4f9a3a, q.seed ^ 0x82);
}

/**
 * The economic rice layer: a scoop of white rice with a ladle of curry over it, and the two
 * dishes picked from the trays beside it in their own heaps: stir-fried cabbage and carrot,
 * and then sweet-and-sour pork, fish, a second vegetable or fried meat.
 *
 * @param q - The layer paint.
 */
export function paint_economic_rice_layer(q: LayerPaint): void {
  const { ctx, seed, isLowDetail } = q;
  const area = food_area("plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  const [rx, ry] = at(area, -0.42, -0.3);
  const mound_rx = area.rx * 0.48 * size;
  const mound_ry = area.ry * 0.55 * size;
  // The curry ladled over the rice runs down into a pool at its foot.
  paint_liquid(ctx, rx + 2, ry + 2.2, mound_rx * 0.95, mound_ry * 0.75, ECONOMIC_RICE.curry, {
    sheen: 0.35,
    oil: isLowDetail ? 2 : 5,
    oilColour: 0xe8a040,
    seed: seed ^ 0x80,
  });
  paint_rice_mound(
    ctx,
    rx - 1,
    ry - 0.8,
    mound_rx * 0.85,
    mound_ry * 0.85,
    ECONOMIC_RICE.rice,
    seed,
    isLowDetail,
  );
  paint_drizzle(ctx, rx, ry - 0.5, mound_rx * 0.45, ECONOMIC_RICE.curry, seed ^ 0x83, 1, 0.8);
  paint_cabbage_scoop(q, area);
  paint_economic_rice_side(q, area);
}

/** Beef rendang's dark, reduced coconut-spice gravy and its slow-cooked beef. */
const RENDANG = { gravy: 0x6e3a1c, beef: 0x5a2c18 } as const;

/**
 * Paints long beans: short dark-green lengths with a lighter ridge.
 *
 * @param ctx - The paint context.
 * @param area - The food area.
 * @param count - Beans to paint.
 * @param u - Where the first bean starts across the food area.
 * @param v - Where the first bean sits down the food area.
 */
function paint_long_beans(
  ctx: PaintContext,
  area: FoodArea,
  count: number,
  u: number,
  v: number,
): void {
  for (let bean = 0; bean < count; bean += 1) {
    const [lx, ly] = at(area, u + bean * 0.2, v - bean * 0.05);
    line(ctx, lx, ly, lx + 4.2, ly - 1.2, css(0x2f6a26), 1.6);
    line(ctx, lx + 0.4, ly - 0.4, lx + 3.4, ly - 1.3, css(0x6aa64a, 0.8), 0.5);
  }
}

/**
 * Paints nasi padang's side dish beside the rice, by the variant's key: beef rendang with long
 * beans; sambal goreng (tempeh, long beans and tofu in a red chilli glaze); spiced chicken in
 * its gravy; or assam pedas, fish in a thin, spicy sour curry.
 *
 * @param q - The layer paint.
 * @param area - The leaf plate's food area.
 */
function paint_padang_side(q: LayerPaint, area: FoodArea): void {
  const { ctx, seed, isLowDetail } = q;
  const size = heap_scale(q.remaining);
  const [gx, gy] = at(area, 0.3, 0.05);
  if (q.has("sambal-goreng")) {
    paint_liquid(ctx, gx, gy, area.rx * 0.5 * size, area.ry * 0.55 * size, 0xa8341c, {
      sheen: 0.45,
      oil: isLowDetail ? 2 : 5,
      oilColour: 0xd8582a,
      seed: seed ^ 0x6c,
    });
    const pieces = pieces_left(4, q.remaining);
    for (let piece = 0; piece < pieces; piece += 1) {
      const [px, py] = at(area, 0.12 + (piece % 2) * 0.36, -0.22 + Math.floor(piece / 2) * 0.42);
      if (piece % 2 === 0) {
        paint_chunk(ctx, px, py, 4.2, 0xc8a060, 0.3 * piece, { radius: 1, gloss: 0.3 });
        paint_dots(ctx, px, py, 1.6, 3, 0.5, 0xf0dcae, seed ^ piece);
      } else {
        paint_tofu(ctx, px, py, 4, 3.2, 0xd89848);
      }
    }
    paint_long_beans(ctx, area, pieces_left(3, q.remaining), 0.05, 0.6);
    return;
  }
  if (q.has("chicken")) {
    paint_liquid(ctx, gx, gy, area.rx * 0.5 * size, area.ry * 0.55 * size, 0xa04a1e, {
      sheen: 0.4,
      oil: isLowDetail ? 2 : 5,
      oilColour: 0xd8783a,
      seed: seed ^ 0x6d,
    });
    paint_drumstick(ctx, gx, gy - 0.5, 12 * Math.max(0.75, size), -0.4, 0x9a4a1e);
    if (q.remaining > 0.5) {
      const [cx, cy] = at(area, 0.55, 0.45);
      paint_chunk(ctx, cx, cy, 4, 0xa8522a, 0.4, { radius: 1.6, gloss: 0.4 });
    }
    return;
  }
  if (q.has("assam-pedas")) {
    paint_liquid(ctx, gx, gy, area.rx * 0.52 * size, area.ry * 0.58 * size, 0xd0582a, {
      sheen: 0.35,
      oil: isLowDetail ? 3 : 7,
      oilColour: 0xe88a3a,
      seed: seed ^ 0x6e,
    });
    const pieces = pieces_left(2, q.remaining);
    for (let piece = 0; piece < pieces; piece += 1) {
      const [fx, fy] = at(area, 0.18 + piece * 0.3, -0.12 + piece * 0.3);
      paint_slice(ctx, fx, fy, 7.6, 4.6, -0.3 + piece * 0.5, 0xe8d8c0, {
        skin: 0x7a6a62,
        gloss: 0.4,
      });
    }
    for (let chilli = 0; chilli < 2; chilli += 1) {
      const [cx, cy] = at(area, 0.6 - chilli * 0.3, -0.55 + chilli * 0.1);
      paint_chilli_slice(ctx, cx, cy, 1.3);
    }
    return;
  }
  paint_liquid(ctx, gx, gy, area.rx * 0.5 * size, area.ry * 0.55 * size, RENDANG.gravy, {
    sheen: 0.35,
    oil: isLowDetail ? 3 : 7,
    oilColour: 0xc0642a,
    seed: seed ^ 0x6a,
  });
  const pieces = pieces_left(4, q.remaining);
  for (let piece = 0; piece < pieces; piece += 1) {
    const [bx, by] = at(area, 0.12 + (piece % 2) * 0.36, -0.2 + Math.floor(piece / 2) * 0.42);
    paint_chunk(ctx, bx, by, 4.8, RENDANG.beef, 0.35 * piece - 0.2, { radius: 1.6, gloss: 0.35 });
  }
  // Toasted coconut (kerisik) clinging to the beef.
  paint_dots(ctx, gx, gy, area.rx * 0.32, isLowDetail ? 4 : 9, 0.55, 0x9a5a28, seed ^ 0x6b);
  paint_long_beans(ctx, area, pieces_left(3, q.remaining), -0.6, 0.62);
  for (let chilli = 0; chilli < 2; chilli += 1) {
    const [cx, cy] = at(area, 0.48 - chilli * 0.3, -0.62 + chilli * 0.1);
    paint_chilli_slice(ctx, cx, cy, 1.3);
  }
}

/**
 * The nasi padang layer: white rice on banana leaf beside one side dish picked by the variant.
 *
 * @param q - The layer paint.
 */
export function paint_nasi_padang_layer(q: LayerPaint): void {
  const area = food_area("leaf-plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  const [rx, ry] = at(area, -0.45, -0.12);
  paint_rice_mound(
    q.ctx,
    rx,
    ry,
    area.rx * 0.48 * size,
    area.ry * 0.62 * size,
    0xf6f1e4,
    q.seed,
    q.isLowDetail,
  );
  paint_padang_side(q, area);
}

/** The hawker Western plates' colours: the chicken chop, grilled fish, coleslaw and sides. */
const WESTERN = {
  chop: 0xb0743a,
  gravy: 0x6a3a1e,
  grilled_fish: 0xe6cfa6,
  coleslaw: 0xf2ead0,
  mash: 0xf2e2b8,
  spaghetti: 0xec7a44,
  potato: 0xe2b65c,
  corn: 0xf2c83a,
} as const;

/**
 * Paints the Western plate's protein on the west of the plate, by the variant's key: a grilled
 * chicken chop (under gravy when it comes with spaghetti), a battered fish fillet with tartar
 * sauce and lemon, or a grilled fish fillet.
 *
 * @param q - The layer paint.
 * @param area - The plate's food area.
 */
function paint_western_protein(q: LayerPaint, area: FoodArea): void {
  const { ctx } = q;
  const size = heap_scale(q.remaining);
  const [px, py] = at(area, -0.3, -0.12);
  if (q.has("chop")) {
    paint_grilled_cut(ctx, px, py, 13.6 * size, 9 * size, -0.18, WESTERN.chop, 3);
    if (q.has("spaghetti")) {
      // The brown gravy ladled across the chop.
      paint_drizzle(ctx, px + 0.5, py, 4.4 * size, WESTERN.gravy, q.seed ^ 0x94, 3, 1.3);
    }
    return;
  }
  if (q.has("fish-chips")) {
    paint_battered_piece(
      ctx,
      px,
      py,
      15 * size,
      8 * size,
      -0.2,
      q.seed ^ 0x91,
      FRIED_BATTER.crater,
      q.isLowDetail,
    );
    const [tx, ty] = at(area, -0.05, 0.55);
    paint_dollop(ctx, tx, ty, 2.4, 0xf2ecd2, q.seed ^ 0x92);
    paint_dots(ctx, tx, ty, 1.6, 3, 0.4, 0x6a8a3a, q.seed ^ 0x93);
    const [lx, ly] = at(area, -0.72, 0.55);
    paint_citrus_wedge(ctx, lx, ly, 3, -0.4, { rind: 0xe3c02a, flesh: 0xf6eaa4 });
    return;
  }
  paint_grilled_cut(ctx, px, py, 14 * size, 7.6 * size, -0.2, WESTERN.grilled_fish, 3);
}

/**
 * Paints the Western plate's sides on the east of the plate, by the variant's key: fries,
 * coleslaw, mashed potato, tomato spaghetti, or potato, salad and corn.
 *
 * @param q - The layer paint.
 * @param area - The plate's food area.
 */
function paint_western_sides(q: LayerPaint, area: FoodArea): void {
  const { ctx, seed, isLowDetail } = q;
  const size = heap_scale(q.remaining);
  const has_chips = q.has("fries", "fish-chips");
  if (q.has("spaghetti")) {
    const [sx, sy] = at(area, 0.45, 0.1);
    paint_noodles(ctx, sx, sy, area.rx * 0.5 * size, WESTERN.spaghetti, seed, 1.1, isLowDetail);
    paint_dots(ctx, sx, sy, 3.4 * size, isLowDetail ? 3 : 6, 0.7, 0xc8402a, seed ^ 0xa1);
  }
  if (has_chips) {
    const [fx, fy] = at(area, 0.45, q.has("coleslaw", "mash") ? -0.3 : 0);
    paint_fries(
      ctx,
      fx,
      fy,
      6.4 * size,
      pieces_left(isLowDetail ? 6 : 9, q.remaining),
      seed ^ 0xa2,
    );
  }
  if (q.has("coleslaw")) {
    const [cx, cy] = at(area, 0.42, 0.45);
    fill_ellipse(ctx, cx + 0.4, cy + 0.6, 4 * size, 2.6 * size, css(SHADOW_INK, 0.2));
    fill_ellipse(ctx, cx, cy, 4 * size, 2.6 * size, css(0xefe6c8));
    paint_shreds(
      ctx,
      cx,
      cy,
      3.4 * size,
      isLowDetail ? 6 : 12,
      WESTERN.coleslaw,
      seed ^ 0xa3,
      2.6,
      1.1,
    );
    paint_shreds(ctx, cx, cy, 3 * size, isLowDetail ? 2 : 4, 0xe8782a, seed ^ 0xa4, 2, 0.8);
    paint_shreds(ctx, cx, cy, 3 * size, isLowDetail ? 2 : 4, 0x7ab84a, seed ^ 0xa5, 2, 0.8);
  }
  if (q.has("mash")) {
    const [mx, my] = at(area, 0.42, 0.45);
    paint_dollop(ctx, mx, my, 3.4 * size, WESTERN.mash, seed ^ 0xa6);
  }
  if (q.has("potato-salad-corn")) {
    const wedges = pieces_left(3, q.remaining);
    for (let wedge = 0; wedge < wedges; wedge += 1) {
      const [wx, wy] = at(area, 0.3 + (wedge % 2) * 0.28, -0.4 + wedge * 0.18);
      paint_chunk(ctx, wx, wy, 3.6, WESTERN.potato, 0.5 * wedge - 0.4, {
        radius: 1.4,
        gloss: 0.35,
      });
    }
    const [lx, ly] = at(area, 0.45, 0.42);
    paint_leaf(ctx, lx - 2, ly, 6, -0.5, 0x6aa84a);
    paint_leaf(ctx, lx + 2, ly - 1, 5.4, 0.6, 0x8ac05a);
    const [kx, ky] = at(area, -0.1, 0.55);
    paint_dots(ctx, kx, ky, 2.6, isLowDetail ? 4 : 8, 0.75, WESTERN.corn, seed ^ 0xa7);
  }
}

/**
 * The hawker Western layer: a grilled chicken chop on its sizzling hot plate, or battered or
 * grilled fish on a plate, with the sides each variant names.
 *
 * @param q - The layer paint.
 */
export function paint_western_layer(q: LayerPaint): void {
  const area = food_area(q.has("chop") ? "hot-plate" : "plate", 0, 0, 1, q.remaining);
  paint_western_sides(q, area);
  paint_western_protein(q, area);
}
