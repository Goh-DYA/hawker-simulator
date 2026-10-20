/**
 * Variant layers for the bowl dishes: fish soup (clear or milky, sliced or fried fish, with or
 * without bee hoon), fish porridge (fried or sliced fish),
 * bak chor mee (dry or soup), yong tau foo (clear or laksa broth with boiled, fried, mixed or
 * noodle pieces), ban mian (six ways, plus mee hoon kway dry or in soup) and bak kut teh
 * (peppery, dry claypot or herbal).
 *
 * Each pours its broth (or sauce) into the bowl's food area first, then lays the noodles and
 * pieces that tell its siblings apart. Bak kut teh also has a side pass, painted after the
 * bowl's rim and outside its clip: a side bowl of rice and a you tiao stick across the rim.
 */
import {
  css,
  fill_ellipse,
  fill_polygon,
  line,
  linear_gradient,
  seeded,
  shade,
  SHADOW_INK,
  speckle,
  stroke_ellipse,
  TAU,
  tint,
  type PaintContext,
} from "../../canvas";
import { at, heap_scale, pieces_left } from "../motif";
import {
  FRIED_BATTER,
  paint_ball,
  paint_battered_piece,
  paint_chilli_slice,
  paint_dots,
  paint_drizzle,
  paint_dumpling,
  paint_fried_egg,
  paint_leaf,
  paint_liquid,
  paint_noodles,
  paint_prawn,
  paint_rib,
  paint_rice_mound,
  paint_slice,
  paint_tofu,
  PORCELAIN,
  SHALLOT,
  type FoodArea,
} from "../parts";
import {
  paint_greens,
  paint_mushroom,
  paint_scallions,
  paint_shreds,
  paint_tofu_puff,
  paint_youtiao_stick,
} from "../toppings";
import { food_area } from "../vessels";
import type { LayerPaint } from "./layer";

/** White rice vermicelli. */
const BEE_HOON = 0xf3ecdc;
/** Yellow egg noodles. */
const YELLOW_NOODLE = 0xe2bc5e;
/** Hand-made ban mian. */
const BAN_MIAN = 0xead39a;
/** Clear fish soup: a light amber stock, dark enough for the white slices to stand out. */
const CLEAR_FISH_BROTH = 0xc9a462;
/** Milky fish soup, whitened with evaporated milk. */
const MILKY_FISH_BROTH = 0xe4cfa4;
/** Sliced fish: white flesh with a faint pink and its grey-pink skin edge. */
const FISH_SLICE = { flesh: 0xf9efe8, skin: 0x8f7c7e, edge: 0x9a8784 } as const;
/** Bak kut teh's pork: pink-brown meat simmered in the broth. */
const RIB_MEAT = 0xa8705a;
/** Where bak kut teh's ribs lie in the bowl, back to front: food-area position and angle. */
const RIB_PLACES: ReadonlyArray<readonly [number, number, number]> = [
  [-0.28, -0.38, -0.16],
  [0.28, -0.04, 0.22],
  [-0.18, 0.34, -0.06],
];

/**
 * Pours a broth into a bowl's food area.
 *
 * @param q - The layer paint.
 * @param area - The food area.
 * @param colourValue - The broth colour.
 * @param oil - Oil beads on the surface (0 for none).
 */
function pour(q: LayerPaint, area: FoodArea, colourValue: number, oil = 0): void {
  paint_liquid(q.ctx, area.x, area.y, area.rx, area.ry, colourValue, {
    sheen: 0.3,
    oil: q.isLowDetail ? Math.ceil(oil / 2) : oil,
    oilColour: 0xf0a040,
    seed: q.seed,
  });
}

/**
 * Paints a white fish slice: tender flesh with its grey-pink skin edge and a fine darker rim,
 * so it stands out against the broth.
 *
 * @param q - The layer paint.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param angle - Tilt in radians.
 */
function paint_fish_slice(q: LayerPaint, x: number, y: number, angle: number): void {
  const { ctx } = q;
  paint_slice(ctx, x, y, 8.6, 4.2, angle, FISH_SLICE.flesh, { skin: FISH_SLICE.skin, gloss: 0.5 });
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  stroke_ellipse(ctx, 0, 0, 4.3, 2.1, css(FISH_SLICE.edge, 0.55), 0.5);
  ctx.restore();
}

/** Milky fish broth soaked into the lower edge of a fried piece. */
const MILKY_SOAK = 0xd9b98a;
/** Cantonese congee: silky, broken-down rice porridge. */
const CONGEE = 0xf2e8cc;
/** Congee soaked into the lower edge of a fried fish piece. */
const CONGEE_SOAK = 0xd8c49a;

/**
 * The fish soup layer: clear or milky broth, with or without bee hoon, holding either flat
 * sliced fish or a golden heap of battered fried fish pieces (with fried shallots), plus
 * greens, tomato and spring onion.
 *
 * @param q - The layer paint.
 */
export function paint_fish_soup_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("bowl", 0, 0, 1, q.remaining);
  const isMilky = q.has("milky");
  pour(q, area, isMilky ? MILKY_FISH_BROTH : CLEAR_FISH_BROTH);
  const size = heap_scale(q.remaining);
  const hasBeehoon = q.has("beehoon");
  if (hasBeehoon)
    paint_noodles(
      ctx,
      area.x - 1,
      area.y + 1,
      area.rx * 0.5 * size,
      BEE_HOON,
      q.seed,
      0.9,
      q.isLowDetail,
    );
  if (q.has("fried")) {
    // The fried pieces heap in two rows on the right half of the bowl, above the noodles.
    const soak_colour = isMilky ? MILKY_SOAK : FRIED_BATTER.crater;
    const pieces = pieces_left(hasBeehoon ? 4 : 5, q.remaining);
    for (let piece = 0; piece < pieces; piece += 1) {
      const [x, y] = at(
        area,
        0.05 + (piece % 3) * 0.24,
        -0.4 + Math.floor(piece / 3) * 0.32 + (piece % 2) * 0.12,
      );
      const seed = q.seed ^ (piece * 0x9e37);
      paint_battered_piece(
        ctx,
        x,
        y,
        10.4,
        6.8,
        -0.4 + piece * 0.5,
        seed,
        soak_colour,
        q.isLowDetail,
      );
    }
    if (!q.isLowDetail) {
      const [sx, sy] = at(area, 0.1, -0.1);
      paint_dots(ctx, sx, sy, area.rx * 0.4, 5, 0.7, SHALLOT, q.seed ^ 0x5a);
    }
  } else {
    const slices = pieces_left(hasBeehoon ? 3 : 4, q.remaining);
    for (let slice = 0; slice < slices; slice += 1) {
      const [x, y] = at(area, -0.35 + slice * 0.28, -0.35 + (slice % 2) * 0.3);
      paint_fish_slice(q, x, y, -0.3 + slice * 0.4);
    }
  }
  const [gx, gy] = at(area, -0.5, 0.4);
  paint_greens(ctx, gx, gy, 8, 0.3, 0x3f8a3a);
  const [tx, ty] = at(area, 0.55, 0.35);
  paint_chilli_slice(ctx, tx, ty, 2, 0xd8432a);
  paint_scallions(ctx, area.x, area.y, area.rx * 0.5, q.isLowDetail ? 3 : 5, q.seed ^ 0x11);
}

/**
 * The fish porridge layer: silky congee holding a golden heap of battered fried fish pieces
 * with fried shallots, or flat sliced fish with leafy greens, finished with spring onion.
 *
 * @param q - The layer paint.
 */
export function paint_porridge_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("bowl", 0, 0, 1, q.remaining);
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, CONGEE, { sheen: 0.35 });
  if (!q.isLowDetail) {
    speckle(
      ctx,
      area.x - area.rx * 0.7,
      area.y - area.ry * 0.6,
      area.rx * 1.4,
      area.ry * 1.2,
      10,
      [0xfbf6e8],
      q.seed,
      1,
    );
  }
  if (q.has("fried")) {
    const pieces = pieces_left(4, q.remaining);
    for (let piece = 0; piece < pieces; piece += 1) {
      const [x, y] = at(
        area,
        -0.2 + (piece % 2) * 0.42,
        -0.32 + Math.floor(piece / 2) * 0.42 + (piece % 2) * 0.1,
      );
      paint_battered_piece(
        ctx,
        x,
        y,
        10.4,
        6.8,
        -0.4 + piece * 0.5,
        q.seed ^ (piece * 0x9e37),
        CONGEE_SOAK,
        q.isLowDetail,
      );
    }
    const [sx, sy] = at(area, 0.05, 0);
    paint_dots(ctx, sx, sy, area.rx * 0.5, q.isLowDetail ? 3 : 6, 0.7, SHALLOT, q.seed ^ 0x5b);
  } else {
    const slices = pieces_left(3, q.remaining);
    for (let slice = 0; slice < slices; slice += 1) {
      const [x, y] = at(area, -0.3 + slice * 0.3, -0.32 + (slice % 2) * 0.32);
      paint_fish_slice(q, x, y, -0.3 + slice * 0.4);
    }
    const [gx, gy] = at(area, -0.45, 0.42);
    paint_greens(ctx, gx, gy, 8, 0.3, 0x3f8a3a);
    const [hx, hy] = at(area, 0.45, 0.38);
    paint_greens(ctx, hx, hy, 7, -2.7, 0x4c8a3c);
  }
  paint_scallions(ctx, area.x, area.y - 1, area.rx * 0.5, q.isLowDetail ? 3 : 6, q.seed ^ 0x5c);
}

/**
 * The bak chor mee layer: dry mee pok tossed in chilli and black vinegar, or the soup version,
 * with minced pork, sliced pork, mushroom, a fishball and spring onion.
 *
 * @param q - The layer paint.
 */
export function paint_bak_chor_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("bowl", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  const isSoup = q.has("broth");
  if (isSoup) {
    pour(q, area, 0xc6a26a);
    paint_noodles(ctx, area.x, area.y + 1, area.rx * 0.55 * size, YELLOW_NOODLE, q.seed, 2, true);
    const [lx, ly] = at(area, 0.5, 0.3);
    paint_leaf(ctx, lx, ly, 7, -0.4, 0x7fb64e);
  } else {
    fill_ellipse(ctx, area.x, area.y, area.rx, area.ry, css(0x9a4a2a, 0.85));
    paint_noodles(ctx, area.x, area.y, area.rx * 0.92 * size, 0xd9aa4e, q.seed, 2, q.isLowDetail);
    paint_drizzle(ctx, area.x, area.y, area.rx * 0.5 * size, 0xb83a22, q.seed ^ 0x21, 3, 1);
  }
  paint_dots(
    ctx,
    area.x - 1,
    area.y - 1,
    area.rx * 0.35 * size,
    q.isLowDetail ? 4 : 8,
    0.9,
    0x8a5034,
    q.seed ^ 0x22,
  );
  const [px, py] = at(area, 0.35, -0.35);
  paint_slice(ctx, px, py, 6, 3, 0.4, 0xd8a888, { skin: 0xb06a4a });
  const [mx, my] = at(area, -0.45, -0.3);
  paint_mushroom(ctx, mx, my, 2.2);
  const [bx, by] = at(area, -0.4, 0.4);
  paint_ball(ctx, bx, by, 2.4);
  paint_scallions(ctx, area.x, area.y, area.rx * 0.5, q.isLowDetail ? 3 : 5, q.seed ^ 0x23);
}

/**
 * Paints a boiled yong tau foo piece: tofu, bitter gourd or chilli stuffed with fish paste.
 *
 * @param q - The layer paint.
 * @param x - Piece centre x.
 * @param y - Piece centre y.
 * @param kind - Which boiled piece (0 tofu, 1 bitter gourd, 2 chilli, 3 fishball).
 */
function paint_boiled_piece(q: LayerPaint, x: number, y: number, kind: number): void {
  const { ctx } = q;
  if (kind === 0) {
    paint_tofu(ctx, x, y, 4.6, 3.8, 0xf4eedc, 0xe2d8c2);
  } else if (kind === 1) {
    fill_ellipse(ctx, x + 0.4, y + 0.8, 2.8, 2.2, css(0x18323b, 0.22));
    fill_ellipse(ctx, x, y, 2.8, 2.2, css(0x5f9a3a));
    fill_ellipse(ctx, x, y, 1.9, 1.5, css(0xeee6d2));
  } else if (kind === 2) {
    paint_slice(ctx, x, y, 6.4, 2.8, 0.5, 0xc8302a, { gloss: 0.5 });
  } else {
    paint_ball(ctx, x, y, 2.2);
  }
}

/**
 * Paints a fried yong tau foo piece: a tofu puff, a crinkled fried wonton or a fried tofu-skin
 * roll.
 *
 * @param q - The layer paint.
 * @param x - Piece centre x.
 * @param y - Piece centre y.
 * @param kind - Which fried piece (0 tofu puff, 1 wonton, 2 roll).
 */
function paint_fried_piece(q: LayerPaint, x: number, y: number, kind: number): void {
  const { ctx } = q;
  if (kind === 0) {
    paint_tofu_puff(ctx, x, y, 4, 0xc8862e, q.seed);
  } else if (kind === 1) {
    paint_dumpling(ctx, x, y, 3, 0xd8a040, { pleats: 4 });
  } else {
    paint_slice(ctx, x, y, 6.4, 3, -0.4, 0xc0782a, { skin: 0x8a4a18, gloss: 0.4 });
  }
}

/**
 * The yong tau foo layer: clear soup or laksa broth with boiled pieces, fried pieces, a mix of
 * both, or boiled pieces over noodles, always with greens.
 *
 * @param q - The layer paint.
 */
export function paint_yong_tau_foo_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("bowl", 0, 0, 1, q.remaining);
  const isLaksa = q.has("laksa");
  pour(q, area, isLaksa ? 0xd8682e : 0xd8caa0, isLaksa ? 8 : 0);
  if (q.has("noodles")) {
    paint_noodles(
      ctx,
      area.x,
      area.y + 1,
      area.rx * 0.6 * heap_scale(q.remaining),
      YELLOW_NOODLE,
      q.seed,
      1.6,
      q.isLowDetail,
    );
  }
  const [gx, gy] = at(area, 0.5, 0.35);
  paint_greens(ctx, gx, gy, 8, -2.7, 0x3f8a3a);
  const spots: ReadonlyArray<readonly [number, number]> = [
    [-0.45, -0.3],
    [0.15, -0.4],
    [-0.15, 0.25],
    [0.5, -0.05],
  ];
  const isFried = q.has("fried");
  const isMixed = q.has("mixed");
  const shown = pieces_left(q.has("noodles") ? 3 : spots.length, q.remaining);
  spots.slice(0, shown).forEach(([u, v], index) => {
    const [x, y] = at(area, u, v);
    if (isFried || (isMixed && index % 2 === 1)) paint_fried_piece(q, x, y, index % 3);
    else paint_boiled_piece(q, x, y, index);
  });
}

/**
 * The ban mian layer: soup, dry-tossed in dark sauce, tossed in chilli, with pork dumplings,
 * in tom yum, or all vegetable; the soup and tossed versions keep the minced pork, poached egg,
 * fried anchovies and greens.
 *
 * @param q - The layer paint.
 */
export function paint_ban_mian_layer(q: LayerPaint): void {
  const { ctx } = q;
  const area = food_area("bowl", 0, 0, 1, q.remaining);
  // Checked before the dry and soup branches, since a mee hoon kway key names one of them too.
  if (q.has("mee-hoon-kway")) {
    paint_mee_hoon_kway(q, area);
    return;
  }
  const size = heap_scale(q.remaining);
  const isDry = q.has("dry-toss", "chilli-toss");
  if (q.has("tom-yum")) pour(q, area, 0xd8582a, 8);
  else if (!isDry) pour(q, area, 0xdac99c);
  else
    fill_ellipse(
      ctx,
      area.x,
      area.y,
      area.rx,
      area.ry,
      css(q.has("chilli") ? 0xa83a22 : 0x5a3a24, 0.85),
    );
  const noodle = q.has("chilli") ? 0xd06a3a : q.has("dry-toss") ? 0xc89a5a : BAN_MIAN;
  paint_noodles(
    ctx,
    area.x,
    area.y + 0.5,
    area.rx * (isDry ? 0.9 : 0.6) * size,
    noodle,
    q.seed,
    2.4,
    q.isLowDetail,
  );
  if (q.has("chilli"))
    paint_dots(
      ctx,
      area.x,
      area.y,
      area.rx * 0.5,
      q.isLowDetail ? 3 : 6,
      0.6,
      0xc8201a,
      q.seed ^ 0x31,
    );
  const greens = q.has("vegetable") ? 3 : 1;
  for (let piece = 0; piece < greens; piece += 1) {
    const [gx, gy] = at(area, -0.5 + piece * 0.45, 0.4 - (piece % 2) * 0.7);
    paint_greens(ctx, gx, gy, 8, 0.4 + piece, 0x2f7a32);
  }
  if (q.has("vegetable")) {
    const [mx, my] = at(area, 0.45, 0.35);
    paint_mushroom(ctx, mx, my, 2.2);
    const [tx, ty] = at(area, 0.05, -0.05);
    paint_tofu(ctx, tx, ty, 3.6, 3, 0xf0e2c0);
    return;
  }
  if (q.has("pork-dumpling")) {
    for (let dumpling = 0; dumpling < pieces_left(3, q.remaining); dumpling += 1) {
      const [x, y] = at(area, -0.1 + dumpling * 0.3, -0.35 + (dumpling % 2) * 0.45);
      paint_dumpling(ctx, x, y, 3, 0xf2e6d2, { blush: 0xd8a080, pleats: 3 });
    }
  } else if (q.has("tom-yum")) {
    const [px, py] = at(area, 0.3, -0.3);
    paint_prawn(ctx, px, py, 5.6, 0.9);
    const [lx, ly] = at(area, -0.1, -0.45);
    paint_leaf(ctx, lx, ly, 4.4, 0.3, 0x3f7a2a);
    paint_chilli_slice(ctx, px - 2, py + 4, 1.3);
  } else {
    const [ex, ey] = at(area, 0.35, -0.3);
    paint_fried_egg(ctx, ex, ey, 3.4 * size);
  }
  paint_dots(
    ctx,
    area.x - 2,
    area.y - 1,
    area.rx * 0.3,
    q.isLowDetail ? 3 : 6,
    0.8,
    0x8a5034,
    q.seed ^ 0x32,
  );
  paint_shreds(
    ctx,
    area.x + 2,
    area.y + 2,
    area.rx * 0.35,
    q.isLowDetail ? 3 : 6,
    0xc09a5a,
    q.seed ^ 0x33,
    2.4,
    1.1,
  );
  paint_scallions(ctx, area.x, area.y, area.rx * 0.5, q.isLowDetail ? 2 : 4, q.seed ^ 0x34);
}

/**
 * Paints a torn piece of hand-made dough (mee hoon kway): a flat, ragged sheet of pale dough
 * with a fold across it.
 *
 * @param ctx - The paint context.
 * @param x - Piece centre x.
 * @param y - Piece centre y.
 * @param size - Piece width.
 * @param angle - Rotation in radians.
 * @param seed - Outline seed.
 */
function paint_torn_dough(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  angle: number,
  seed: number,
): void {
  const next = seeded(seed);
  const points: [number, number][] = [];
  for (let corner = 0; corner < 7; corner += 1) {
    const turn = (corner / 7) * TAU;
    const reach = 0.7 + next() * 0.4;
    points.push([Math.cos(turn) * size * 0.5 * reach, Math.sin(turn) * size * 0.32 * reach]);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_polygon(
    ctx,
    points.map(([px, py]) => [px + 0.5, py + 0.8] as const),
    css(SHADOW_INK, 0.22),
  );
  fill_polygon(
    ctx,
    points,
    linear_gradient(ctx, -size * 0.5, -size * 0.3, size * 0.5, size * 0.3, [
      [0, tint(BAN_MIAN, 0.35)],
      [0.6, BAN_MIAN],
      [1, shade(BAN_MIAN, 0.25)],
    ]),
  );
  line(
    ctx,
    -size * 0.3,
    -size * 0.05,
    size * 0.25,
    size * 0.08,
    css(shade(BAN_MIAN, 0.35), 0.7),
    0.5,
  );
  ctx.restore();
}

/**
 * Paints mee hoon kway: torn pieces of hand-made dough, dry in a dark sauce or in a clear
 * soup, with ribbons of beaten egg, minced pork, chye sim and fried anchovies.
 *
 * @param q - The layer paint.
 * @param area - The bowl's food area.
 */
function paint_mee_hoon_kway(q: LayerPaint, area: FoodArea): void {
  const { ctx } = q;
  const isDry = q.has("dry");
  if (isDry) fill_ellipse(ctx, area.x, area.y, area.rx, area.ry, css(0x5a3a24, 0.85));
  else pour(q, area, 0xdac99c);
  const next = seeded(q.seed ^ 0x3a);
  const pieces = pieces_left(isDry ? 8 : 6, q.remaining);
  for (let piece = 0; piece < pieces; piece += 1) {
    const angle = next() * TAU;
    const reach = Math.sqrt(next()) * 0.62;
    paint_torn_dough(
      ctx,
      area.x + Math.cos(angle) * area.rx * reach,
      area.y + Math.sin(angle) * area.ry * reach,
      5.6,
      next() * Math.PI,
      q.seed ^ (piece * 0x2b),
    );
  }
  paint_shreds(
    ctx,
    area.x + 1,
    area.y,
    area.rx * 0.5,
    q.isLowDetail ? 3 : 6,
    0xf2d060,
    q.seed ^ 0x3b,
    3.4,
    1.2,
  );
  paint_dots(
    ctx,
    area.x - 2,
    area.y - 1,
    area.rx * 0.3,
    q.isLowDetail ? 3 : 6,
    0.8,
    0x8a5034,
    q.seed ^ 0x3c,
  );
  const [gx, gy] = at(area, 0.5, 0.35);
  paint_greens(ctx, gx, gy, 8, -2.6, 0x2f7a32);
  paint_shreds(
    ctx,
    area.x - 2,
    area.y + 2,
    area.rx * 0.35,
    q.isLowDetail ? 3 : 6,
    0xc09a5a,
    q.seed ^ 0x3d,
    2.4,
    1.1,
  );
  paint_scallions(ctx, area.x, area.y, area.rx * 0.5, q.isLowDetail ? 2 : 4, q.seed ^ 0x3e);
}

/**
 * Paints whole garlic cloves in their papery skins.
 *
 * @param q - The layer paint.
 * @param area - The food area.
 * @param count - Cloves on a full serving.
 */
function paint_garlic(q: LayerPaint, area: FoodArea, count: number): void {
  for (let clove = 0; clove < pieces_left(count, q.remaining); clove += 1) {
    const [x, y] = at(area, 0.5 - clove * 0.3, 0.45 - (clove % 2) * 0.25);
    fill_ellipse(q.ctx, x + 0.3, y + 0.6, 1.8, 1.3, css(0x18323b, 0.22));
    fill_ellipse(q.ctx, x, y, 1.8, 1.3, css(0xf2e8d2));
    stroke_ellipse(q.ctx, x, y, 1.8, 1.3, css(0xc8a882, 0.7), 0.4);
  }
}

/**
 * The key parts that order a side with bak kut teh: `rice` for a side bowl of white rice and
 * `youtiao` for a you tiao stick. A key with neither is served no side, and its side pass
 * paints nothing.
 */
export const BAK_KUT_TEH_SIDE_PARTS: readonly string[] = ["rice", "youtiao"];

/**
 * The side rice bowl: its centre from the dish centre (in front of the soup bowl's south-west
 * rim), its rim radii and depth, its teal band and the rice in it.
 */
const SIDE_RICE_BOWL = {
  x: -10.2,
  y: 9.6,
  rx: 5.8,
  ry: 2.2,
  depth: 4.2,
  band: 0x2f8f8f,
  rice: 0xfbf8f0,
} as const;

/** The you tiao stick across the soup bowl's north-east rim: centre, full length and angle. */
const SIDE_YOUTIAO = { x: 8.4, y: -10.4, length: 18, angle: 0.36 } as const;

/**
 * Paints the sides served with a bak kut teh bowl, outside the bowl's clip and over its rim so
 * a sprite never reads them as porridge: a small bowl of white rice in front of the south-west
 * rim, whose rice sinks as it is eaten, and a you tiao stick resting across the north-east rim,
 * which shortens as it is eaten.
 *
 * @param q - The layer paint, translated to the dish centre.
 */
export function paint_bak_kut_teh_sides(q: LayerPaint): void {
  const { ctx } = q;
  if (q.has("rice")) {
    const { x, y, rx, ry, depth } = SIDE_RICE_BOWL;
    fill_ellipse(ctx, x + 0.8, y + 3.6, rx - 0.2, ry, css(SHADOW_INK, 0.24));
    fill_polygon(
      ctx,
      [
        [x - rx, y],
        [x + rx, y],
        [x + 3.4, y + depth],
        [x - 3.4, y + depth],
      ],
      linear_gradient(ctx, x, y, x, y + depth, [
        [0, PORCELAIN],
        [1, 0xc9c2b4],
      ]),
    );
    fill_ellipse(ctx, x, y + 2.4, rx - 1.2, 0.6, css(SIDE_RICE_BOWL.band, 0.85));
    fill_ellipse(ctx, x, y, rx, ry, css(0xe9e3d6));
    // At this size the rice keeps the lower-end grain count in every frame.
    paint_rice_mound(
      ctx,
      x,
      y - 0.6 - q.remaining * 0.4,
      rx - 1.2,
      ry + q.remaining * 0.6,
      SIDE_RICE_BOWL.rice,
      q.seed ^ 0x45,
      true,
    );
  }
  if (q.has("youtiao")) {
    const { x, y, length, angle } = SIDE_YOUTIAO;
    paint_youtiao_stick(ctx, x, y, length * (0.6 + 0.4 * q.remaining), angle, q.isLowDetail);
  }
}

/**
 * The bak kut teh layer: pork ribs in a peppery golden broth, glazed in a dark dry claypot
 * sauce with dried chillies and okra, or in a dark herbal broth with goji berries.
 *
 * @param q - The layer paint.
 */
export function paint_bak_kut_teh_layer(q: LayerPaint): void {
  const { ctx } = q;
  const isDry = q.has("dry-claypot");
  const area = food_area(isDry ? "claypot" : "bowl", 0, 0, 1, q.remaining);
  const isHerbal = q.has("herbal");
  const liquid = isDry ? 0x4a2618 : isHerbal ? 0x5a3a22 : 0xcfae72;
  if (isDry) {
    paint_liquid(ctx, area.x, area.y, area.rx, area.ry, liquid, { sheen: 0.4 });
  } else {
    pour(q, area, liquid);
  }
  // The ribs lie on their sides in the broth, back to front, with a bone tip showing.
  const ribs = pieces_left(RIB_PLACES.length, q.remaining);
  for (const [u, v, angle] of RIB_PLACES.slice(0, ribs)) {
    const [x, y] = at(area, u, v);
    paint_rib(ctx, x, y, 8, 5, angle, isDry ? 0x7a4428 : RIB_MEAT, liquid);
  }
  if (isDry) {
    for (let chilli = 0; chilli < 2; chilli += 1) {
      const [x, y] = at(area, -0.45 + chilli * 0.85, 0.5 - chilli * 0.9);
      paint_slice(ctx, x, y, 5.6, 1.8, 0.6 - chilli, 0xb0281a, { gloss: 0.5 });
    }
    for (let okra = 0; okra < 2; okra += 1) {
      const [x, y] = at(area, 0.2 + okra * 0.3, 0.55 - okra * 0.2);
      fill_ellipse(ctx, x, y, 1.6, 1.3, css(0x5f9a3a));
      fill_ellipse(ctx, x, y, 0.9, 0.7, css(0xd8e8b0));
    }
    paint_shreds(
      ctx,
      area.x - 2,
      area.y - 1,
      area.rx * 0.35,
      q.isLowDetail ? 2 : 4,
      0xd8b88a,
      q.seed ^ 0x41,
      3,
      1.2,
    );
    return;
  }
  paint_garlic(q, area, 3);
  if (isHerbal) {
    paint_dots(
      ctx,
      area.x,
      area.y,
      area.rx * 0.6,
      q.isLowDetail ? 3 : 6,
      0.8,
      0xd8402a,
      q.seed ^ 0x42,
    );
    const [hx, hy] = at(area, -0.5, 0.35);
    paint_slice(ctx, hx, hy, 5, 2.4, 0.3, 0xc8a070, { gloss: 0.2 });
  } else {
    paint_dots(
      ctx,
      area.x,
      area.y,
      area.rx * 0.75,
      q.isLowDetail ? 6 : 14,
      0.35,
      0x2a2420,
      q.seed ^ 0x43,
    );
    paint_dots(
      ctx,
      area.x + 1,
      area.y + 1,
      area.rx * 0.4,
      q.isLowDetail ? 2 : 4,
      0.5,
      SHALLOT,
      q.seed ^ 0x44,
    );
  }
}
