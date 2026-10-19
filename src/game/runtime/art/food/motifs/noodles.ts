/**
 * Noodle dish motifs: char kway teow, beef hor fun, Hokkien prawn mee, mee goreng, mee rebus,
 * mee siam, fishball mee pok, wanton mee, lor mee, laksa and prawn noodle soup. (Bak chor mee
 * and ban mian paint everything in their variant layers.)
 *
 * Each paints a nest of noodles in the right width and colour, then the toppings that tell the
 * dishes apart at a glance: cockles and sausage, beef in egg gravy, prawns and squid, red wok
 * sauce, thick gravy, tamarind gravy, white fishballs, wantons and char siew, dark lor gravy,
 * orange laksa broth or red prawn broth.
 */
import { at, heap_scale, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  paint_ball,
  paint_chunk,
  paint_chilli_slice,
  paint_drizzle,
  paint_egg_half,
  paint_herb_flecks,
  paint_liquid,
  paint_noodles,
  paint_prawn,
  paint_slice,
  paint_dots,
  paint_dumpling,
  SAMBAL,
  SHALLOT,
  WHITE,
  YOLK,
} from "../parts";
import {
  paint_dollop,
  paint_fish_cake,
  paint_greens,
  paint_lime_half,
  paint_sausage_slice,
  paint_scallions,
  paint_shreds,
  paint_sprouts,
  paint_tofu_puff,
} from "../toppings";
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

/** Yellow alkaline noodles. */
const YELLOW_NOODLE = 0xe0b552;
/** Thick white rice vermicelli. */
const BEE_HOON = 0xf3ecdc;
/** Hor fun's broad rice noodles, seared in the wok. */
const HOR_FUN = 0xf0e2c4;
/** The silky egg gravy poured over beef hor fun: translucent and soy-tinted. */
const EGG_GRAVY = 0x9a6a3a;
/** Mee siam's thin rice vermicelli, stained pink-orange by the chilli paste it is fried in. */
const MEE_SIAM_NOODLE = 0xe7a184;
/** Mee siam's sweet-sour tamarind gravy. */
const TAMARIND_GRAVY = 0xc4552e;
/** Wanton mee's thin, springy egg noodles. */
const EGG_NOODLE = 0xe9c86a;
/** The deep orange-red broth of prawn noodle soup, boiled from prawn heads and shells. */
const PRAWN_BROTH = 0xb8422a;
/** Char siew's lacquered red edge and its pink meat. */
const CHAR_SIEW = { glaze: 0xa8321e, meat: 0xd9826a } as const;

/**
 * Char kway teow: glossy dark flat rice noodles fried with egg, cockles, sliced Chinese sausage,
 * bean sprouts and chives.
 *
 * @param p - The motif paint.
 */
function paint_char_kway_teow(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_noodles(ctx, area.x, area.y, area.rx * 0.95 * size, 0x84502e, seed, 2.4, isLowDetail);
  paint_shreds(
    ctx,
    area.x,
    area.y,
    area.rx * 0.7 * size,
    isLowDetail ? 2 : 4,
    0xf0c94e,
    seed ^ 0x13,
    3,
    1.4,
  );
  paint_sprouts(
    ctx,
    area.x - 2,
    area.y + 2,
    area.rx * 0.6 * size,
    isLowDetail ? 3 : 5,
    seed ^ 0x14,
  );
  const cockles = pieces_left(4, p.remaining);
  for (let cockle = 0; cockle < cockles; cockle += 1) {
    const [x, y] = at(area, -0.45 + cockle * 0.3, (cockle % 2 ? -0.35 : 0.3) * size);
    paint_ball(ctx, x, y, 1.4, 0x8a5a48);
  }
  const sausages = pieces_left(3, p.remaining);
  for (let slice = 0; slice < sausages; slice += 1) {
    const [x, y] = at(area, 0.4 - slice * 0.35, (slice % 2 ? 0.45 : -0.1) * size);
    paint_sausage_slice(ctx, x, y, 1.9, 0.5);
  }
  paint_shreds(
    ctx,
    area.x + 2,
    area.y - 1,
    area.rx * 0.6 * size,
    isLowDetail ? 2 : 4,
    0x3f8a36,
    seed ^ 0x15,
    5,
    1,
  );
  paint_drizzle(ctx, area.x, area.y, area.rx * 0.5, 0xffffff, seed ^ 0x16, 1, 0.5);
}

/**
 * Beef hor fun: broad flat rice noodles seared in the wok, smothered in a glossy, silky egg
 * gravy with ribbons of egg white, tender beef slices and choy sum.
 *
 * @param p - The motif paint.
 */
function paint_beef_hor_fun(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_liquid(ctx, area.x, area.y + 0.5, area.rx * 0.95 * size, area.ry * 0.9 * size, EGG_GRAVY, {
    sheen: 0.4,
  });
  paint_noodles(ctx, area.x, area.y, area.rx * 0.72 * size, HOR_FUN, seed, 3.2, isLowDetail);
  // The wok hei: scorched patches on the noodles.
  paint_dots(
    ctx,
    area.x,
    area.y,
    area.rx * 0.55 * size,
    isLowDetail ? 3 : 7,
    0.8,
    0x9a6a3a,
    seed ^ 0x17,
  );
  paint_liquid(
    ctx,
    area.x + 1,
    area.y + 0.5,
    area.rx * 0.7 * size,
    area.ry * 0.62 * size,
    EGG_GRAVY,
    {
      sheen: 0.6,
      alpha: 0.35,
    },
  );
  paint_shreds(
    ctx,
    area.x,
    area.y,
    area.rx * 0.65 * size,
    isLowDetail ? 3 : 7,
    0xfaf4e4,
    seed ^ 0x18,
    2.6,
    0.9,
  );
  const slices = pieces_left(4, p.remaining);
  for (let slice = 0; slice < slices; slice += 1) {
    const [x, y] = at(area, -0.35 + slice * 0.26, (slice % 2 ? 0.2 : -0.25) * size);
    paint_slice(ctx, x, y, 6.4, 3.4, -0.3 + slice * 0.25, 0x6a3a24, { gloss: 0.45 });
  }
  const greens = pieces_left(2, p.remaining);
  for (let piece = 0; piece < greens; piece += 1) {
    const [gx, gy] = at(area, -0.62 + piece * 1.1, 0.5 - piece * 0.1);
    paint_greens(ctx, gx, gy, 8, -0.4 + piece * 0.8, 0x3f8a3a);
  }
}

/**
 * Hokkien prawn mee: golden yellow noodles and white vermicelli braised in prawn stock, with
 * prawns, squid rings, sambal and a calamansi half.
 *
 * @param p - The motif paint.
 */
function paint_hokkien_prawn_mee(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_noodles(ctx, area.x - 1, area.y, area.rx * 0.95 * size, 0xd9b45e, seed, 1.5, isLowDetail);
  paint_noodles(
    ctx,
    area.x + 1,
    area.y + 1,
    area.rx * 0.6 * size,
    BEE_HOON,
    seed ^ 0x21,
    1.1,
    true,
  );
  const prawns = pieces_left(3, p.remaining);
  for (let prawn = 0; prawn < prawns; prawn += 1) {
    const [x, y] = at(area, -0.4 + prawn * 0.38, (prawn % 2 ? 0.25 : -0.3) * size);
    paint_prawn(ctx, x, y, 5.4, 0.5 + prawn * 1.4);
  }
  const rings = pieces_left(2, p.remaining);
  for (let ring = 0; ring < rings; ring += 1) {
    const [x, y] = at(area, 0.2 - ring * 0.55, 0.55 * size);
    stroke_ellipse(ctx, x + 0.4, y + 0.6, 1.8, 1.4, css(0x18323b, 0.2), 1.2);
    stroke_ellipse(ctx, x, y, 1.8, 1.4, css(0xf6efe4), 1.2);
  }
  paint_scallions(ctx, area.x, area.y, area.rx * 0.6, isLowDetail ? 2 : 4, seed ^ 0x22);
  const [lx, ly] = at(area, 0.85, -0.55);
  paint_lime_half(ctx, lx, ly, 2.4);
  const [sx, sy] = at(area, 0.88, 0.25);
  paint_dollop(ctx, sx, sy, 2.2, SAMBAL, seed ^ 0x23);
}

/**
 * Mamak mee goreng: red chilli-tomato wok-fried noodles with fried tofu, egg, potato, bean
 * sprouts and a lime half.
 *
 * @param p - The motif paint.
 */
function paint_mee_goreng(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_noodles(ctx, area.x, area.y, area.rx * 0.95 * size, 0xcc5530, seed, 1.6, isLowDetail);
  const cubes = pieces_left(3, p.remaining);
  for (let cube = 0; cube < cubes; cube += 1) {
    const [x, y] = at(area, -0.4 + cube * 0.4, (cube % 2 ? 0.35 : -0.3) * size);
    paint_chunk(ctx, x, y, 3.4, cube === 1 ? 0xe2c06a : 0xd38f3e, cube * 0.5, { gloss: 0.35 });
  }
  paint_shreds(
    ctx,
    area.x,
    area.y,
    area.rx * 0.55 * size,
    isLowDetail ? 2 : 4,
    YOLK,
    seed ^ 0x31,
    3,
    1.4,
  );
  paint_sprouts(
    ctx,
    area.x + 1,
    area.y - 1,
    area.rx * 0.5 * size,
    isLowDetail ? 2 : 4,
    seed ^ 0x32,
  );
  paint_scallions(ctx, area.x, area.y, area.rx * 0.5, isLowDetail ? 2 : 4, seed ^ 0x33);
  const [lx, ly] = at(area, 0.85, 0.55);
  paint_lime_half(ctx, lx, ly, 2.6);
}

/**
 * Mee rebus: yellow noodles in a thick, spiced sweet-potato gravy with a halved egg, bean
 * sprouts, green chilli, fried shallots and lime.
 *
 * @param p - The motif paint.
 */
function paint_mee_rebus(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xc4802f, { sheen: 0.18 });
  const size = heap_scale(p.remaining);
  paint_noodles(
    ctx,
    area.x - 1,
    area.y,
    area.rx * 0.7 * size,
    YELLOW_NOODLE,
    seed,
    1.5,
    isLowDetail,
  );
  paint_liquid(ctx, area.x + 2, area.y + 2, area.rx * 0.55, area.ry * 0.5, 0xc4802f, {
    sheen: 0,
    alpha: 0.55,
  });
  const [ex, ey] = at(area, 0.35, -0.3);
  paint_egg_half(ctx, ex, ey, 3.4 * Math.max(0.8, size));
  paint_sprouts(ctx, area.x - 3, area.y + 1, area.rx * 0.4, isLowDetail ? 2 : 4, seed ^ 0x41);
  for (let slice = 0; slice < 2; slice += 1) {
    const [cx, cy] = at(area, -0.3 + slice * 0.3, 0.5);
    paint_chilli_slice(ctx, cx, cy, 1.3, 0x5c9a32);
  }
  paint_dots(
    ctx,
    area.x,
    area.y - 1,
    area.rx * 0.5,
    isLowDetail ? 3 : 6,
    0.6,
    SHALLOT,
    seed ^ 0x42,
  );
  const [lx, ly] = at(area, -0.6, -0.4);
  paint_lime_half(ctx, lx, ly, 2.4);
}

/**
 * Mee siam: thin pink-orange rice vermicelli under a ladle of red tamarind gravy, with halved
 * eggs, fried tau pok, chives and a calamansi half.
 *
 * @param p - The motif paint.
 */
function paint_mee_siam(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_noodles(
    ctx,
    area.x,
    area.y,
    area.rx * 0.92 * size,
    MEE_SIAM_NOODLE,
    seed,
    0.8,
    isLowDetail,
  );
  paint_noodles(
    ctx,
    area.x + 1,
    area.y - 1,
    area.rx * 0.6 * size,
    MEE_SIAM_NOODLE,
    seed ^ 0x45,
    0.7,
    true,
  );
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
  const eggs = pieces_left(2, p.remaining);
  for (let egg = 0; egg < eggs; egg += 1) {
    const [ex, ey] = at(area, -0.35 + egg * 0.6, -0.3 + egg * 0.12);
    paint_egg_half(ctx, ex, ey, 3.2 * Math.max(0.8, size), { angle: -0.3 + egg * 0.5 });
  }
  const puffs = pieces_left(3, p.remaining);
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
 * Fishball mee pok: flat yellow egg noodles tossed in chilli, with bouncy white fishballs, fish
 * cake slices and choy sum.
 *
 * @param p - The motif paint.
 */
function paint_fishball_mee_pok(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_noodles(ctx, area.x, area.y, area.rx * 0.95 * size, 0xe6c46a, seed, 2.1, isLowDetail);
  paint_drizzle(ctx, area.x, area.y, area.rx * 0.5 * size, 0xc8432a, seed ^ 0x51, 2, 0.8);
  const balls = pieces_left(4, p.remaining);
  for (let ball = 0; ball < balls; ball += 1) {
    const [x, y] = at(area, -0.45 + ball * 0.3, (ball % 2 ? 0.3 : -0.35) * size);
    paint_ball(ctx, x, y, 2.4);
  }
  const [fx, fy] = at(area, 0.55, 0.45);
  paint_fish_cake(ctx, fx, fy, 2.4);
  const [gx, gy] = at(area, -0.6, 0.45);
  paint_greens(ctx, gx, gy, 8, -0.3, 0x3f8a3a);
  paint_scallions(ctx, area.x, area.y, area.rx * 0.5, isLowDetail ? 2 : 4, seed ^ 0x52);
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
 * Wanton mee: thin springy egg noodles tossed in a dark savoury sauce, with boiled wantons,
 * char siew slices, choy sum and pickled green chilli.
 *
 * @param p - The motif paint.
 */
function paint_wanton_mee(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_noodles(ctx, area.x - 1, area.y, area.rx * 0.92 * size, EGG_NOODLE, seed, 1, isLowDetail);
  paint_liquid(ctx, area.x, area.y + 1, area.rx * 0.45 * size, area.ry * 0.4 * size, 0x5a321c, {
    sheen: 0.4,
    alpha: 0.45,
  });
  const slices = pieces_left(3, p.remaining);
  for (let slice = 0; slice < slices; slice += 1) {
    const [x, y] = at(area, 0.05 + slice * 0.22, -0.32 + slice * 0.12);
    paint_char_siew_slice(ctx, x, y, -0.5 + slice * 0.1);
  }
  const wantons = pieces_left(3, p.remaining);
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

/**
 * Lor mee: thick flat noodles drowned in a glossy dark starch gravy, with a braised egg, fried
 * fish, braised pork, garlic and coriander.
 *
 * @param p - The motif paint.
 */
function paint_lor_mee(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0x6a4128, { sheen: 0.32 });
  const size = heap_scale(p.remaining);
  paint_noodles(ctx, area.x, area.y + 1, area.rx * 0.55 * size, 0xc79a48, seed, 2.2, true);
  paint_liquid(ctx, area.x, area.y + 1.5, area.rx * 0.5, area.ry * 0.42, 0x6a4128, {
    sheen: 0.2,
    alpha: 0.5,
  });
  const [ex, ey] = at(area, -0.4, -0.3);
  paint_egg_half(ctx, ex, ey, 3.4 * Math.max(0.8, size), { white: 0xc89a62, yolk: 0xd9a032 });
  const fish = pieces_left(2, p.remaining);
  for (let piece = 0; piece < fish; piece += 1) {
    const [x, y] = at(area, 0.25 + piece * 0.35, -0.35 + piece * 0.5);
    paint_chunk(ctx, x, y, 3.6, 0xd89a48, 0.4, { gloss: 0.3 });
  }
  const [px, py] = at(area, -0.1, 0.45);
  paint_slice(ctx, px, py, 6, 3, 0.2, 0x8c5236, { skin: 0xe8cfb0 });
  paint_dots(
    ctx,
    area.x + 2,
    area.y,
    area.rx * 0.5,
    isLowDetail ? 3 : 5,
    0.7,
    0xf4ecd8,
    seed ^ 0x61,
  );
  paint_herb_flecks(
    ctx,
    area.x,
    area.y - 1,
    area.rx * 0.5,
    isLowDetail ? 2 : 4,
    0x4e9a3e,
    seed ^ 0x62,
  );
}

/**
 * Nyonya laksa: thick vermicelli in an orange coconut-curry broth beaded with chilli oil,
 * topped with prawns, fish cake, half an egg, tofu puffs and chopped laksa leaf.
 *
 * @param p - The motif paint.
 */
function paint_nyonya_laksa(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xd9692f, {
    sheen: 0.2,
    oil: isLowDetail ? 4 : 9,
    oilColour: 0xf0a040,
    seed,
  });
  const size = heap_scale(p.remaining);
  paint_noodles(
    ctx,
    area.x - 2,
    area.y + 1,
    area.rx * 0.45 * size,
    BEE_HOON,
    seed ^ 0x71,
    1.3,
    true,
  );
  const prawns = pieces_left(2, p.remaining);
  for (let prawn = 0; prawn < prawns; prawn += 1) {
    const [x, y] = at(area, 0.35 - prawn * 0.25, -0.4 + prawn * 0.25);
    paint_prawn(ctx, x, y, 5.6, 0.8 + prawn * 1.6);
  }
  const [fx, fy] = at(area, -0.45, -0.3);
  paint_fish_cake(ctx, fx, fy, 2.4);
  const [ex, ey] = at(area, 0.45, 0.35);
  paint_egg_half(ctx, ex, ey, 3 * Math.max(0.8, size));
  if (p.remaining > 0.5) {
    const [tx, ty] = at(area, -0.55, 0.35);
    paint_tofu_puff(ctx, tx, ty, 3.4, 0xd0913c, seed);
  }
  paint_shreds(
    ctx,
    area.x,
    area.y - 1,
    area.rx * 0.45,
    isLowDetail ? 3 : 6,
    0x4f8a3c,
    seed ^ 0x72,
    2.2,
    1,
  );
  const [sx, sy] = at(area, 0.05, 0.05);
  paint_dollop(ctx, sx, sy, 1.8, SAMBAL, seed ^ 0x73);
}

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
 * Prawn noodle soup: yellow noodles in a deep orange-red prawn broth beaded with oil, with
 * whole prawns, lean pork slices, fish cake, kangkong and fried shallots.
 *
 * @param p - The motif paint.
 */
function paint_prawn_noodle_soup(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, PRAWN_BROTH, {
    sheen: 0.25,
    oil: isLowDetail ? 4 : 10,
    oilColour: 0xe0703a,
    seed,
  });
  const size = heap_scale(p.remaining);
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
  const prawns = pieces_left(2, p.remaining);
  for (let prawn = 0; prawn < prawns; prawn += 1) {
    const [x, y] = at(area, -0.45 + prawn * 0.75, -0.3 + prawn * 0.05);
    paint_whole_prawn(ctx, x, y, prawn === 0 ? -0.4 : 3.4);
  }
  const pork = pieces_left(2, p.remaining);
  for (let slice = 0; slice < pork; slice += 1) {
    const [x, y] = at(area, 0.1 + slice * 0.32, 0.38 - slice * 0.1);
    paint_slice(ctx, x, y, 5.6, 2.8, 0.2 - slice * 0.3, 0xe8c2a8, { gloss: 0.35 });
  }
  const [fx, fy] = at(area, -0.48, 0.38);
  paint_fish_cake(ctx, fx, fy, 2.2);
  const [gx, gy] = at(area, 0.58, 0.1);
  paint_greens(ctx, gx, gy, 7, -2.4, 0x2f7a32);
  paint_dots(ctx, area.x, area.y, area.rx * 0.55, isLowDetail ? 4 : 8, 0.65, SHALLOT, seed ^ 0x82);
  paint_scallions(ctx, area.x - 1, area.y - 1, area.rx * 0.4, isLowDetail ? 2 : 4, seed ^ 0x83);
}

/**
 * A no-op motif for dishes whose variant layer paints the noodles and every topping.
 *
 * @returns Nothing.
 */
const paint_nothing: Motif = () => undefined;

/** The noodle dish motifs, keyed by dish ID without the `dish.` prefix. */
export const NOODLE_MOTIFS: Readonly<Record<string, Motif>> = {
  "char-kway-teow": paint_char_kway_teow,
  "hokkien-prawn-mee": paint_hokkien_prawn_mee,
  "mee-goreng-mamak": paint_mee_goreng,
  "mee-rebus": paint_mee_rebus,
  "fishball-mee-pok": paint_fishball_mee_pok,
  "lor-mee": paint_lor_mee,
  "nyonya-laksa": paint_nyonya_laksa,
  "beef-hor-fun": paint_beef_hor_fun,
  "mee-siam": paint_mee_siam,
  "wanton-mee": paint_wanton_mee,
  "prawn-noodle-soup": paint_prawn_noodle_soup,
  "bak-chor-mee": paint_nothing,
  "ban-mian": paint_nothing,
};
