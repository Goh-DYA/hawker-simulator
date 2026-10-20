/**
 * Variant layers for the noodle dishes that change their whole serving: prawn mee (in its red
 * prawn broth, or dry and tossed in dark gravy), mee siam (under tamarind gravy, or fried dry)
 * and wanton mee (dry with wantons and char siew, or in clear soup with large sui kow or with
 * small wantons).
 *
 * The default variant of each paints the dish as its own motif did before it had variants.
 * The soup variants of wanton mee are served in a bowl rather than on its plate, so their layer
 * lays the soup in the bowl's food area.
 */
import {
  css,
  fill_ellipse,
  line,
  linear_gradient,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  type PaintContext,
} from "../../canvas";
import { at, heap_scale, pieces_left } from "../motif";
import {
  paint_chilli_slice,
  paint_dots,
  paint_drizzle,
  paint_dumpling,
  paint_egg_half,
  paint_liquid,
  paint_noodles,
  paint_prawn,
  paint_slice,
  SHALLOT,
  WHITE,
  type FoodArea,
} from "../parts";
import {
  paint_fish_cake,
  paint_greens,
  paint_lime_half,
  paint_scallions,
  paint_shreds,
  paint_tofu_puff,
} from "../toppings";
import { food_area } from "../vessels";
import type { LayerPaint } from "./layer";

/** Yellow alkaline noodles. */
const YELLOW_NOODLE = 0xe0b552;
/** Mee siam's thin rice vermicelli, stained pink-orange by the chilli paste it is fried in. */
const MEE_SIAM_NOODLE = 0xe7a184;
/** Mee siam goreng's vermicelli, fried dry in the gravy until it darkens. */
const FRIED_MEE_SIAM_NOODLE = 0xd27a52;
/** Mee siam's sweet-sour tamarind gravy. */
const TAMARIND_GRAVY = 0xc4552e;
/** Wanton mee's thin, springy egg noodles. */
const EGG_NOODLE = 0xe9c86a;
/** The deep orange-red broth of prawn noodle soup, boiled from prawn heads and shells. */
const PRAWN_BROTH = 0xb8422a;
/** Dry prawn mee's dark, glossy gravy. */
const PRAWN_MEE_GRAVY = 0x5a2e1c;
/** Wanton noodle soup's clear, pale stock. */
const CLEAR_STOCK = 0xdcc99a;
/** Char siew's lacquered red edge and its pink meat. */
const CHAR_SIEW = { glaze: 0xa8321e, meat: 0xd9826a } as const;

/**
 * Paints a whole shell-on prawn lying in broth: the curled red-orange tail with its head and
 * feelers.
 *
 * @param ctx - The paint context.
 * @param x - Prawn centre x.
 * @param y - Prawn centre y.
 * @param angle - Rotation in radians.
 */
function paint_whole_prawn(ctx: PaintContext, x: number, y: number, angle: number): void {
  paint_prawn(ctx, x, y, 7, angle);
  const head_x = x + Math.cos(angle + 0.2) * 4.2;
  const head_y = y + Math.sin(angle + 0.2) * 4.2;
  ctx.save();
  ctx.translate(head_x, head_y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0.5, 0.8, 2.6, 1.6, css(SHADOW_INK, 0.24));
  fill_ellipse(
    ctx,
    0,
    0,
    2.6,
    1.6,
    linear_gradient(ctx, -2.6, -1.6, 2.6, 1.6, [
      [0, 0xf49a64],
      [1, shade(0xd8502a, 0.15)],
    ]),
  );
  fill_ellipse(ctx, 1.4, -0.4, 0.45, 0.45, css(0x2a1a14));
  line(ctx, 2.2, -0.6, 6, -2.4, css(0xd8502a, 0.85), 0.35);
  line(ctx, 2.2, 0, 6.2, -0.6, css(0xd8502a, 0.85), 0.35);
  fill_ellipse(ctx, -0.8, -0.6, 1, 0.4, css(WHITE, 0.4));
  ctx.restore();
}

/**
 * Lays prawn mee's whole prawns and lean pork slices.
 *
 * @param q - The layer paint.
 * @param area - The food area.
 */
function paint_prawns_and_pork(q: LayerPaint, area: FoodArea): void {
  const prawns = pieces_left(2, q.remaining);
  for (let prawn = 0; prawn < prawns; prawn += 1) {
    const [x, y] = at(area, -0.45 + prawn * 0.75, -0.3 + prawn * 0.05);
    paint_whole_prawn(q.ctx, x, y, prawn === 0 ? -0.4 : 3.4);
  }
  const pork = pieces_left(2, q.remaining);
  for (let slice = 0; slice < pork; slice += 1) {
    const [x, y] = at(area, 0.1 + slice * 0.32, 0.38 - slice * 0.1);
    paint_slice(q.ctx, x, y, 5.6, 2.8, 0.2 - slice * 0.3, 0xe8c2a8, { gloss: 0.35 });
  }
}

/**
 * The prawn mee layer: yellow noodles in a deep orange-red prawn broth beaded with oil, with
 * whole prawns, lean pork slices, fish cake, kangkong and fried shallots; or the dry bowl, its
 * noodles tossed in a dark gravy under the prawns and pork, with no soup.
 *
 * @param q - The layer paint.
 */
export function paint_prawn_mee_layer(q: LayerPaint): void {
  const { ctx, seed, isLowDetail } = q;
  const area = food_area("bowl", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  if (q.has("dry")) {
    fill_ellipse(ctx, area.x, area.y, area.rx, area.ry, css(PRAWN_MEE_GRAVY, 0.9));
    paint_noodles(ctx, area.x, area.y, area.rx * 0.9 * size, 0xd0a048, seed, 1.6, isLowDetail);
    paint_drizzle(ctx, area.x, area.y, area.rx * 0.55 * size, PRAWN_MEE_GRAVY, seed ^ 0x84, 3, 1.1);
    paint_prawns_and_pork(q, area);
    const [gx, gy] = at(area, 0.58, 0.15);
    paint_greens(ctx, gx, gy, 7, -2.4, 0x2f7a32);
    paint_dots(
      ctx,
      area.x,
      area.y,
      area.rx * 0.55,
      isLowDetail ? 4 : 8,
      0.65,
      SHALLOT,
      seed ^ 0x82,
    );
    return;
  }
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, PRAWN_BROTH, {
    sheen: 0.25,
    oil: isLowDetail ? 4 : 10,
    oilColour: 0xe0703a,
    seed,
  });
  paint_noodles(
    ctx,
    area.x - 1,
    area.y + 1,
    area.rx * 0.5 * size,
    YELLOW_NOODLE,
    seed ^ 0x81,
    1.4,
    true,
  );
  paint_prawns_and_pork(q, area);
  const [fx, fy] = at(area, -0.48, 0.38);
  paint_fish_cake(ctx, fx, fy, 2.2);
  const [gx, gy] = at(area, 0.58, 0.1);
  paint_greens(ctx, gx, gy, 7, -2.4, 0x2f7a32);
  paint_dots(ctx, area.x, area.y, area.rx * 0.55, isLowDetail ? 4 : 8, 0.65, SHALLOT, seed ^ 0x82);
  paint_scallions(ctx, area.x - 1, area.y - 1, area.rx * 0.4, isLowDetail ? 2 : 4, seed ^ 0x83);
}

/**
 * The mee siam layer: thin pink-orange rice vermicelli under a ladle of red tamarind gravy, or
 * fried dry in it (mee siam goreng), with halved hard-boiled eggs, fried tau pok, chives and a
 * calamansi half.
 *
 * @param q - The layer paint.
 */
export function paint_mee_siam_layer(q: LayerPaint): void {
  const { ctx, seed, isLowDetail } = q;
  const area = food_area("plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  const isFried = q.has("fried");
  const noodle = isFried ? FRIED_MEE_SIAM_NOODLE : MEE_SIAM_NOODLE;
  paint_noodles(ctx, area.x, area.y, area.rx * 0.92 * size, noodle, seed, 0.8, isLowDetail);
  paint_noodles(ctx, area.x + 1, area.y - 1, area.rx * 0.6 * size, noodle, seed ^ 0x45, 0.7, true);
  if (isFried) {
    // Fried until dry: the gravy is cooked into the noodles, leaving only a few dark flecks.
    paint_dots(
      ctx,
      area.x,
      area.y,
      area.rx * 0.6 * size,
      isLowDetail ? 4 : 9,
      0.7,
      0x8a2e18,
      seed ^ 0x48,
    );
  } else {
    paint_liquid(
      ctx,
      area.x + 1,
      area.y + 1.5,
      area.rx * 0.62 * size,
      area.ry * 0.55 * size,
      TAMARIND_GRAVY,
      {
        sheen: 0.35,
        oil: isLowDetail ? 2 : 5,
        oilColour: 0xe8783a,
        seed: seed ^ 0x46,
      },
    );
  }
  const eggs = pieces_left(isFried ? 1 : 2, q.remaining);
  for (let egg = 0; egg < eggs; egg += 1) {
    const [ex, ey] = at(area, -0.35 + egg * 0.6, -0.3 + egg * 0.12);
    paint_egg_half(ctx, ex, ey, 3.2 * Math.max(0.8, size), { angle: -0.3 + egg * 0.5 });
  }
  const puffs = pieces_left(3, q.remaining);
  for (let puff = 0; puff < puffs; puff += 1) {
    const [tx, ty] = at(area, -0.2 + puff * 0.3, 0.45 - (puff % 2) * 0.2);
    paint_tofu_puff(ctx, tx, ty, 2.6, 0xd39a48, seed ^ puff);
  }
  paint_shreds(
    ctx,
    area.x,
    area.y,
    area.rx * 0.5,
    isLowDetail ? 3 : 6,
    0x3f8a36,
    seed ^ 0x47,
    3,
    0.8,
  );
  const [lx, ly] = at(area, 0.82, 0.55);
  paint_lime_half(ctx, lx, ly, 2.6);
}

/**
 * Paints a boiled wanton: a small knot of pork filling under a crinkled, translucent skin whose
 * loose tails trail beside it.
 *
 * @param ctx - The paint context.
 * @param x - Wanton centre x.
 * @param y - Wanton centre y.
 * @param angle - Which way its skin tails trail, in radians.
 */
function paint_wanton(ctx: PaintContext, x: number, y: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 2.6, 0.6, 2.8, 1.4, css(0xf3ead2, 0.75));
  fill_ellipse(ctx, 2.8, 0.4, 1.6, 0.6, css(WHITE, 0.4));
  ctx.restore();
  paint_dumpling(ctx, x, y, 2.6, 0xf1e6cc, { blush: 0xd8a890, pleats: 3 });
}

/**
 * Paints a char siew slice for the noodle plates: pink meat inside a lacquered red rim.
 *
 * @param ctx - The paint context.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param angle - Tilt in radians.
 */
function paint_char_siew_slice(ctx: PaintContext, x: number, y: number, angle: number): void {
  paint_slice(ctx, x, y, 7, 3.4, angle, CHAR_SIEW.meat, { skin: CHAR_SIEW.glaze, gloss: 0.4 });
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  stroke_ellipse(ctx, 0, 0, 3.5, 1.7, css(CHAR_SIEW.glaze, 0.9), 0.6);
  ctx.restore();
}

/**
 * Paints wanton mee in clear soup: egg noodles in a pale stock, with either large sui kow
 * (prawn dumplings) or small pork wantons and char siew, and greens.
 *
 * @param q - The layer paint.
 */
function paint_wanton_soup(q: LayerPaint): void {
  const { ctx, seed, isLowDetail } = q;
  const area = food_area("bowl", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, CLEAR_STOCK, { sheen: 0.32 });
  paint_noodles(ctx, area.x - 1, area.y + 1, area.rx * 0.55 * size, EGG_NOODLE, seed, 1, true);
  const [gx, gy] = at(area, 0.5, 0.4);
  paint_greens(ctx, gx, gy, 8, -2.6, 0x3f8a3a);
  if (q.has("sui-kow")) {
    const dumplings = pieces_left(3, q.remaining);
    for (let dumpling = 0; dumpling < dumplings; dumpling += 1) {
      const [x, y] = at(area, -0.42 + dumpling * 0.42, -0.32 + (dumpling % 2) * 0.4);
      paint_dumpling(ctx, x, y, 3.8, 0xf2ead8, { blush: 0xf08a6a, pleats: 4 });
    }
  } else {
    const wantons = pieces_left(3, q.remaining);
    for (let wanton = 0; wanton < wantons; wanton += 1) {
      const [x, y] = at(area, -0.5 + wanton * 0.3, -0.3 + (wanton % 2) * 0.45);
      paint_wanton(ctx, x, y, 0.4 + wanton * 1.3);
    }
    const slices = pieces_left(2, q.remaining);
    for (let slice = 0; slice < slices; slice += 1) {
      const [x, y] = at(area, 0.3 + slice * 0.15, -0.4 + slice * 0.3);
      paint_char_siew_slice(ctx, x, y, -0.5 + slice * 0.2);
    }
  }
  paint_scallions(ctx, area.x, area.y, area.rx * 0.5, isLowDetail ? 2 : 4, seed ^ 0x53);
}

/**
 * The wanton mee layer: thin springy egg noodles tossed in a dark savoury sauce, with boiled
 * wantons, char siew slices, choy sum and pickled green chilli; or the noodles in clear soup,
 * with large sui kow or with small wantons.
 *
 * @param q - The layer paint.
 */
export function paint_wanton_mee_layer(q: LayerPaint): void {
  if (q.has("soup")) {
    paint_wanton_soup(q);
    return;
  }
  const { ctx, seed, isLowDetail } = q;
  const area = food_area("plate", 0, 0, 1, q.remaining);
  const size = heap_scale(q.remaining);
  paint_noodles(ctx, area.x - 1, area.y, area.rx * 0.92 * size, EGG_NOODLE, seed, 1, isLowDetail);
  paint_liquid(ctx, area.x, area.y + 1, area.rx * 0.45 * size, area.ry * 0.4 * size, 0x5a321c, {
    sheen: 0.4,
    alpha: 0.45,
  });
  const slices = pieces_left(3, q.remaining);
  for (let slice = 0; slice < slices; slice += 1) {
    const [x, y] = at(area, 0.05 + slice * 0.22, -0.32 + slice * 0.12);
    paint_char_siew_slice(ctx, x, y, -0.5 + slice * 0.1);
  }
  const wantons = pieces_left(3, q.remaining);
  for (let wanton = 0; wanton < wantons; wanton += 1) {
    const [x, y] = at(area, -0.5 + wanton * 0.25, 0.1 + (wanton % 2) * 0.32);
    paint_wanton(ctx, x, y, 0.4 + wanton * 1.3);
  }
  const [gx, gy] = at(area, 0.48, 0.45);
  paint_greens(ctx, gx, gy, 9, -0.35, 0x3f8a3a);
  for (let chilli = 0; chilli < 3; chilli += 1) {
    const [cx, cy] = at(area, -0.62 + chilli * 0.14, -0.5 + (chilli % 2) * 0.1);
    paint_chilli_slice(ctx, cx, cy, 1.2, 0x8fb04a);
  }
  paint_scallions(ctx, area.x, area.y, area.rx * 0.45, isLowDetail ? 2 : 4, seed ^ 0x53);
}
