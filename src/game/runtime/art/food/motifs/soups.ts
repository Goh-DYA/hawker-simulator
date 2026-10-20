/**
 * Soup and porridge motifs: chicken congee, century egg and minced pork porridges, soto ayam,
 * mee soto, sayur lodeh with lontong, fishball tang hoon soup, kway chap, the prawn dumplings in
 * light soup and watercress pork rib soup. (Sliced fish soup, fish porridge, yong tau foo and
 * bak kut teh paint their broth and pieces in their variant layers.)
 *
 * Each paints the broth's surface inside the bowl first, darker towards the rim with a sheen
 * and oil beads where the dish has them, then floats its pieces on top.
 */
import { speckle } from "../../canvas";
import { at, heap_scale, paint_in_layer, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  paint_ball,
  paint_chunk,
  paint_dots,
  paint_dumpling,
  paint_egg_half,
  paint_herb_flecks,
  paint_liquid,
  paint_noodles,
  paint_rib,
  paint_slice,
  SAMBAL,
  SHALLOT,
} from "../parts";
import {
  paint_century_egg_wedge,
  paint_dollop,
  paint_fish_cake,
  paint_greens,
  paint_lime_half,
  paint_scallions,
  paint_shreds,
  paint_sprouts,
  paint_tofu_puff,
  paint_youtiao,
} from "../toppings";

/** Cantonese congee: silky, broken-down rice porridge. */
const CONGEE = 0xf2e8cc;
/** Minced pork simmered in porridge: pale pink-brown crumbs. */
const MINCED_PORK = 0xb88466;
/** Watercress soup: a clear, faintly green-gold pork stock. */
const WATERCRESS_BROTH = 0xc2b47a;

/**
 * Cantonese chicken congee: silky rice porridge with shredded chicken, ginger, fried shallots,
 * spring onion and slices of dough fritter.
 *
 * @param p - The motif paint.
 */
function paint_chicken_congee(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xf2e8cc, { sheen: 0.35 });
  if (!isLowDetail) {
    speckle(
      ctx,
      area.x - area.rx * 0.7,
      area.y - area.ry * 0.6,
      area.rx * 1.4,
      area.ry * 1.2,
      10,
      [0xfbf6e8],
      seed,
      1,
    );
  }
  const size = heap_scale(p.remaining);
  paint_shreds(
    ctx,
    area.x - 1,
    area.y,
    area.rx * 0.45 * size,
    isLowDetail ? 4 : 8,
    0xe2c294,
    seed ^ 0x11,
    4,
    1.4,
  );
  paint_shreds(
    ctx,
    area.x + 2,
    area.y - 1,
    area.rx * 0.35,
    isLowDetail ? 2 : 4,
    0xf1d985,
    seed ^ 0x12,
    3,
    0.7,
  );
  paint_dots(ctx, area.x, area.y, area.rx * 0.5, isLowDetail ? 3 : 6, 0.7, SHALLOT, seed ^ 0x13);
  paint_scallions(ctx, area.x + 1, area.y - 1, area.rx * 0.4, isLowDetail ? 3 : 5, seed ^ 0x14);
  if (p.remaining > 0.5) {
    const [yx, yy] = at(area, 0.55, 0.3);
    paint_youtiao(ctx, yx, yy, 5);
  }
}

/**
 * Soto ayam: a clear turmeric-gold chicken broth with shredded chicken, rice cake cubes, bean
 * sprouts, a potato begedil and coriander.
 *
 * @param p - The motif paint.
 */
function paint_soto_ayam(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xe2ad3c, {
    sheen: 0.28,
    oil: isLowDetail ? 3 : 7,
    oilColour: 0xf6cf6a,
    seed,
  });
  const size = heap_scale(p.remaining);
  paint_shreds(
    ctx,
    area.x - 2,
    area.y,
    area.rx * 0.45 * size,
    isLowDetail ? 4 : 7,
    0xefdcb8,
    seed ^ 0x21,
    4,
    1.4,
  );
  const cubes = pieces_left(2, p.remaining);
  for (let cube = 0; cube < cubes; cube += 1) {
    const [x, y] = at(area, 0.3 + cube * 0.3, -0.35 + cube * 0.4);
    paint_chunk(ctx, x, y, 3.6, 0xf1ecd8, 0.3, { gloss: 0.4 });
  }
  paint_sprouts(ctx, area.x - 3, area.y + 2, area.rx * 0.35, isLowDetail ? 2 : 4, seed ^ 0x22);
  if (p.remaining > 0.5) {
    const [bx, by] = at(area, -0.45, -0.35);
    paint_slice(ctx, bx, by, 6, 4.6, 0, 0xc78a3e, { gloss: 0.3 });
  }
  paint_herb_flecks(
    ctx,
    area.x,
    area.y - 1,
    area.rx * 0.5,
    isLowDetail ? 2 : 5,
    0x4e9a3e,
    seed ^ 0x23,
  );
}

/**
 * Sayur lodeh with lontong: compressed rice cubes and vegetables in a golden coconut gravy,
 * with tofu and a dab of sambal.
 *
 * @param p - The motif paint.
 */
function paint_lontong_sayur(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xe0aa58, {
    sheen: 0.22,
    oil: isLowDetail ? 3 : 6,
    oilColour: 0xf2b44a,
    seed,
  });
  const cubes = pieces_left(4, p.remaining);
  for (let cube = 0; cube < cubes; cube += 1) {
    const [x, y] = at(area, -0.5 + (cube % 2) * 0.42, -0.3 + Math.floor(cube / 2) * 0.55);
    paint_chunk(ctx, x, y, 4, 0xf3efdf, 0.15 * cube, { gloss: 0.35, edge: 0.4 });
  }
  paint_shreds(
    ctx,
    area.x + 3,
    area.y,
    area.rx * 0.4,
    isLowDetail ? 3 : 6,
    0xa9c870,
    seed ^ 0x31,
    4,
    1.5,
  );
  const [tx, ty] = at(area, 0.45, -0.4);
  paint_tofu_puff(ctx, tx, ty, 3.6, 0xd7a14c, seed);
  const [sx, sy] = at(area, 0.5, 0.45);
  paint_dollop(ctx, sx, sy, 2.2, SAMBAL, seed ^ 0x32);
}

/**
 * Fishball tang hoon soup: a clear broth with a tangle of translucent glass noodles, bouncy
 * white fishballs, thin fish cake slices, bean sprouts, spring onion and fried shallots.
 *
 * @param p - The motif paint.
 */
function paint_fishball_tang_hoon_soup(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xd9cc9e, { sheen: 0.3 });
  const size = heap_scale(p.remaining);
  ctx.save();
  ctx.globalAlpha = 0.85;
  paint_noodles(
    ctx,
    area.x - 1,
    area.y + 1,
    area.rx * 0.6 * size,
    0xeee8d8,
    seed,
    0.7,
    isLowDetail,
  );
  ctx.restore();
  paint_sprouts(ctx, area.x + 3, area.y + 2, area.rx * 0.35, isLowDetail ? 2 : 4, seed ^ 0x43);
  const slices = pieces_left(3, p.remaining);
  for (let slice = 0; slice < slices; slice += 1) {
    const [x, y] = at(area, -0.55 + slice * 0.22, 0.3 + slice * 0.08);
    paint_fish_cake(ctx, x, y, 2.2);
  }
  const balls = pieces_left(4, p.remaining);
  for (let ball = 0; ball < balls; ball += 1) {
    const [x, y] = at(area, -0.3 + ball * 0.26, -0.38 + (ball % 2) * 0.32);
    paint_ball(ctx, x, y, 2.6);
  }
  paint_scallions(ctx, area.x, area.y, area.rx * 0.55, isLowDetail ? 3 : 6, seed ^ 0x41);
  paint_dots(
    ctx,
    area.x + 1,
    area.y + 1,
    area.rx * 0.5,
    isLowDetail ? 2 : 5,
    0.6,
    SHALLOT,
    seed ^ 0x42,
  );
}

/**
 * Kway chap: silky folded rice sheets in a dark herbal soy broth with a braised egg, tofu puff,
 * braised pork belly and fried garlic.
 *
 * @param p - The motif paint.
 */
function paint_kway_chap(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0x5a3a26, { sheen: 0.3 });
  const sheets = pieces_left(3, p.remaining);
  for (let sheet = 0; sheet < sheets; sheet += 1) {
    const [x, y] = at(area, -0.35 + sheet * 0.3, -0.2 + sheet * 0.22);
    paint_slice(ctx, x, y, 11, 5.2, -0.35 + sheet * 0.3, 0xf2ece0, { gloss: 0.5 });
  }
  const [ex, ey] = at(area, 0.5, -0.35);
  paint_egg_half(ctx, ex, ey, 3.2, { white: 0xb8854f, yolk: 0xd49a33 });
  if (p.remaining > 0.5) {
    const [tx, ty] = at(area, -0.55, 0.35);
    paint_tofu_puff(ctx, tx, ty, 3.4, 0xb98048, seed);
    const [px, py] = at(area, 0.4, 0.45);
    paint_slice(ctx, px, py, 6, 3, -0.2, 0x7a4630, { skin: 0xe8d2b4 });
  }
  paint_dots(ctx, area.x, area.y, area.rx * 0.55, isLowDetail ? 3 : 6, 0.6, 0xe0b46a, seed ^ 0x51);
  paint_herb_flecks(
    ctx,
    area.x - 1,
    area.y - 1,
    area.rx * 0.4,
    isLowDetail ? 2 : 3,
    0x4e9a3e,
    seed ^ 0x52,
  );
}

/**
 * Prawn dumplings in light soup: four translucent pleated dumplings with pink prawn showing
 * through, bamboo shoot and greens.
 *
 * @param p - The motif paint.
 */
function paint_har_gow(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xe6dcc2, { sheen: 0.3 });
  const [gx, gy] = at(area, 0.45, 0.4);
  paint_greens(ctx, gx, gy, 8, -2.6, 0x3f8a3a);
  paint_shreds(
    ctx,
    area.x - 3,
    area.y + 3,
    area.rx * 0.3,
    isLowDetail ? 2 : 4,
    0xead9a0,
    seed ^ 0x61,
    2.4,
    1.6,
  );
  const spots: ReadonlyArray<readonly [number, number]> = [
    [-0.42, -0.35],
    [0.25, -0.38],
    [-0.35, 0.3],
    [0.32, 0.18],
  ];
  const shown = pieces_left(spots.length, p.remaining);
  for (const [u, v] of spots.slice(0, shown)) {
    const [x, y] = at(area, u, v);
    paint_dumpling(ctx, x, y, 3.8, 0xf2ece4, { blush: 0xf08a6a, isCrescent: true, pleats: 4 });
  }
}

/**
 * Pours a bowl of Cantonese congee: the silky porridge with a speckle of broken rice grains.
 *
 * @param p - The motif paint.
 */
function pour_congee(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, CONGEE, { sheen: 0.35 });
  if (!isLowDetail) {
    speckle(
      ctx,
      area.x - area.rx * 0.7,
      area.y - area.ry * 0.6,
      area.rx * 1.4,
      area.ry * 1.2,
      10,
      [0xfbf6e8],
      seed,
      1,
    );
  }
}

/**
 * Century egg and pork porridge: silky congee with wedges of dark, translucent century egg,
 * minced pork and spring onion.
 *
 * @param p - The motif paint.
 */
function paint_century_egg_porridge(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  pour_congee(p);
  const size = heap_scale(p.remaining);
  paint_dots(
    ctx,
    area.x - 1,
    area.y + 1,
    area.rx * 0.45 * size,
    isLowDetail ? 5 : 10,
    0.9,
    MINCED_PORK,
    seed ^ 0x71,
  );
  const wedges = pieces_left(4, p.remaining);
  for (let wedge = 0; wedge < wedges; wedge += 1) {
    const [x, y] = at(area, -0.4 + (wedge % 2) * 0.7, -0.32 + Math.floor(wedge / 2) * 0.55);
    paint_century_egg_wedge(ctx, x, y, 5.2, -0.6 + wedge * 1.1);
  }
  paint_scallions(ctx, area.x, area.y - 1, area.rx * 0.45, isLowDetail ? 3 : 6, seed ^ 0x72);
}

/**
 * Minced pork porridge: congee with crumbs of minced pork, spring onion and rounds of crisp
 * dough fritter.
 *
 * @param p - The motif paint.
 */
function paint_minced_pork_porridge(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  pour_congee(p);
  const size = heap_scale(p.remaining);
  paint_dots(
    ctx,
    area.x - 1,
    area.y,
    area.rx * 0.55 * size,
    isLowDetail ? 7 : 14,
    1,
    MINCED_PORK,
    seed ^ 0x81,
  );
  paint_dots(
    ctx,
    area.x - 1,
    area.y,
    area.rx * 0.4 * size,
    isLowDetail ? 3 : 6,
    0.6,
    0xd8a88a,
    seed ^ 0x82,
  );
  const rounds = pieces_left(3, p.remaining);
  for (let round = 0; round < rounds; round += 1) {
    const [x, y] = at(area, 0.5 - round * 0.12, -0.4 + round * 0.38);
    paint_youtiao(ctx, x, y, 4.6);
  }
  paint_scallions(ctx, area.x - 1, area.y - 1, area.rx * 0.5, isLowDetail ? 3 : 6, seed ^ 0x83);
}

/**
 * Mee soto: yellow noodles in a spiced, turmeric-gold soto broth with shredded chicken, fried
 * shallots and a lime half.
 *
 * @param p - The motif paint.
 */
function paint_mee_soto(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xd9a53a, {
    sheen: 0.28,
    oil: isLowDetail ? 3 : 8,
    oilColour: 0xf2c25a,
    seed,
  });
  const size = heap_scale(p.remaining);
  paint_noodles(
    ctx,
    area.x - 1,
    area.y + 1,
    area.rx * 0.55 * size,
    0xe8c050,
    seed ^ 0x91,
    1.5,
    isLowDetail,
  );
  paint_shreds(
    ctx,
    area.x + 1,
    area.y - 1,
    area.rx * 0.42 * size,
    isLowDetail ? 4 : 8,
    0xf0dcb8,
    seed ^ 0x92,
    4,
    1.4,
  );
  paint_dots(ctx, area.x, area.y, area.rx * 0.5, isLowDetail ? 3 : 7, 0.65, SHALLOT, seed ^ 0x93);
  if (p.remaining > 0.5) {
    const [lx, ly] = at(area, 0.55, 0.4);
    paint_lime_half(ctx, lx, ly, 2.4, 0xd8e06a);
  }
  paint_herb_flecks(
    ctx,
    area.x - 2,
    area.y,
    area.rx * 0.4,
    isLowDetail ? 2 : 4,
    0x4e9a3e,
    seed ^ 0x94,
  );
}

/**
 * Watercress pork rib soup: pork ribs and dark watercress in a clear stock, with red dates
 * and wolfberries floating in it.
 *
 * @param p - The motif paint.
 */
function paint_watercress_pork_rib_soup(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, WATERCRESS_BROTH, { sheen: 0.32 });
  const sprigs = pieces_left(5, p.remaining);
  for (let sprig = 0; sprig < sprigs; sprig += 1) {
    const [x, y] = at(area, -0.55 + sprig * 0.27, 0.42 - (sprig % 2) * 0.3);
    paint_greens(ctx, x, y, 8.4, -0.6 + sprig * 0.9, 0x2f6a2a);
  }
  const ribs = pieces_left(2, p.remaining);
  for (let rib = 0; rib < ribs; rib += 1) {
    const [x, y] = at(area, -0.25 + rib * 0.5, -0.32 + rib * 0.12);
    paint_rib(ctx, x, y, 7.6, 4.8, -0.2 + rib * 0.35, 0xb88a6a, WATERCRESS_BROTH);
  }
  const dates = pieces_left(2, p.remaining);
  for (let date = 0; date < dates; date += 1) {
    const [x, y] = at(area, 0.55 - date * 0.95, -0.05 + date * 0.1);
    paint_ball(ctx, x, y, 1.4, 0x9a2a1e);
  }
  paint_dots(
    ctx,
    area.x + 1,
    area.y,
    area.rx * 0.55,
    isLowDetail ? 3 : 6,
    0.7,
    0xe0482a,
    seed ^ 0xa1,
  );
}

/** The soup and porridge motifs, keyed by dish ID without the `dish.` prefix. */
export const SOUP_MOTIFS: Readonly<Record<string, Motif>> = {
  "chicken-congee": paint_chicken_congee,
  "soto-ayam": paint_soto_ayam,
  "lontong-sayur": paint_lontong_sayur,
  "teochew-fish-dumpling-soup": paint_fishball_tang_hoon_soup,
  "kway-chap": paint_kway_chap,
  "har-gow": paint_har_gow,
  "sliced-fish-soup": paint_in_layer,
  "yong-tau-foo": paint_in_layer,
  "bak-kut-teh": paint_in_layer,
  "century-egg-porridge": paint_century_egg_porridge,
  "fish-porridge": paint_in_layer,
  "minced-pork-porridge": paint_minced_pork_porridge,
  "mee-soto": paint_mee_soto,
  "watercress-pork-rib-soup": paint_watercress_pork_rib_soup,
};
