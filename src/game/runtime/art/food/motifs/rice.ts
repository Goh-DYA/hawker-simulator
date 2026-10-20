/**
 * Rice dish motifs: chicken rice three ways, char siew rice, nasi lemak, briyani, lemon rice,
 * duck rice, claypot chicken rice, thunder tea rice, lotus leaf rice, ayam penyet and nasi
 * goreng.
 *
 * Each lays a domed rice mound (or the rice inside its pot or leaf) and two or three bold
 * toppings in the dish's true colours. Dishes with reviewed nutrition variants (nasi lemak,
 * briyani, duck rice) paint only their shared base here; the variant layer adds the protein.
 * Nasi padang and economic rice paint the whole plate in their variant layers.
 */
import {
  css,
  fill_ellipse,
  fill_rounded_rect,
  line,
  linear_gradient,
  radial_gradient,
  shade,
  SHADOW_INK,
  speckle,
  stroke_rounded_rect,
  TAU,
  tint,
  type PaintContext,
} from "../../canvas";
import { at, heap_scale, paint_in_layer, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  DARK_SOY,
  paint_chilli_slice,
  paint_chunk,
  paint_citrus_wedge,
  paint_cucumber,
  paint_dots,
  paint_liquid,
  paint_leaf,
  paint_rice_mound,
  paint_sauce_cup,
  paint_tofu,
  PEANUT,
  SAMBAL,
  SHALLOT,
  SPRING_ONION,
  WHITE,
} from "../parts";
import {
  paint_dollop,
  paint_greens,
  paint_mushroom,
  paint_sausage_slice,
  paint_scallions,
  paint_slice_row,
  paint_smashed_chicken,
} from "../toppings";

/** Chicken rice's stock-cooked rice, a touch more golden than plain rice. */
const CHICKEN_RICE = 0xf1e2b8;
/** Coconut rice, creamy white. */
const COCONUT_RICE = 0xf6efdc;
/** Char siew's lacquered, honey-glazed edge and its pink roast meat. */
const CHAR_SIEW = { glaze: 0xa8321e, meat: 0xd9826a } as const;
/** Lotus leaf rice's soy-stained glutinous rice. */
const LOTUS_RICE = 0xb98a52;
/**
 * The hollow scooped out of lotus leaf rice after each eaten third, in units of the rice
 * mound's radii: its centre offset and its radii. A full serving has none.
 */
const LOTUS_SCOOPS: ReadonlyArray<
  { readonly u: number; readonly v: number; readonly rx: number; readonly ry: number } | undefined
> = [undefined, { u: 0.5, v: 0.5, rx: 0.78, ry: 0.78 }, { u: 0.22, v: 0.34, rx: 1.12, ry: 1.02 }];

/**
 * Paints the cucumber slices tucked along the near edge of a rice plate.
 *
 * @param p - The motif paint.
 * @param u - Where the row starts across the food area.
 * @param count - Slices on a full plate.
 */
function paint_cucumber_row(p: MotifPaint, u: number, count: number): void {
  const slices = pieces_left(count, p.remaining);
  for (let slice = 0; slice < slices; slice += 1) {
    const [x, y] = at(p.area, u + slice * 0.22, 0.72 - slice * 0.05);
    paint_cucumber(p.ctx, x, y, 2.6);
  }
}

/**
 * Lays sliced chicken in a shingled row beside the rice.
 *
 * @param p - The motif paint.
 * @param flesh - The meat colour.
 * @param skin - The skin colour along each slice's exposed edge.
 * @param count - Slices on a full plate.
 */
function paint_chicken_slices(p: MotifPaint, flesh: number, skin: number, count = 5): void {
  const [x, y] = at(p.area, 0.08, -0.25);
  paint_slice_row(p.ctx, x, y, pieces_left(count, p.remaining), flesh, skin, 0.45);
}

/**
 * Hainanese poached chicken rice: pale silky chicken slices over golden rice, cucumber and a
 * sprig of coriander, with the chilli dip beside.
 *
 * @param p - The motif paint.
 */
function paint_poached_chicken_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.38, -0.05);
  paint_rice_mound(
    ctx,
    rx,
    ry,
    area.rx * 0.58 * size,
    area.ry * 0.7 * size,
    CHICKEN_RICE,
    seed,
    isLowDetail,
  );
  paint_chicken_slices(p, 0xf6e6cc, 0xeac77e);
  paint_cucumber_row(p, -0.75, 3);
  const [cx, cy] = at(area, 0.25, -0.35);
  paint_leaf(ctx, cx, cy, 4.2, -0.6, SPRING_ONION);
  const [dx, dy] = at(area, 0.82, 0.62);
  paint_sauce_cup(ctx, dx, dy, 3.2, 0xe0512f);
}

/**
 * Roast chicken rice: lacquered mahogany-skinned chicken slices with a dark soy drizzle.
 *
 * @param p - The motif paint.
 */
function paint_roast_chicken_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.38, -0.05);
  paint_rice_mound(
    ctx,
    rx,
    ry,
    area.rx * 0.58 * size,
    area.ry * 0.7 * size,
    CHICKEN_RICE,
    seed,
    isLowDetail,
  );
  paint_chicken_slices(p, 0xf0d6b0, 0xa8481c);
  paint_cucumber_row(p, -0.75, 3);
  const [dx, dy] = at(area, 0.82, 0.62);
  paint_sauce_cup(ctx, dx, dy, 3.2, 0xe0512f);
}

/**
 * Vegetarian "chicken" rice: glazed golden soy-protein slices and bright bok choy over rice.
 *
 * @param p - The motif paint.
 */
function paint_soya_tofu_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.4, -0.1);
  paint_rice_mound(
    ctx,
    rx,
    ry,
    area.rx * 0.55 * size,
    area.ry * 0.68 * size,
    0xf2e8d0,
    seed,
    isLowDetail,
  );
  paint_chicken_slices(p, 0xe0b880, 0xb8783a, 4);
  const greens = pieces_left(2, p.remaining);
  for (let piece = 0; piece < greens; piece += 1) {
    const [gx, gy] = at(area, -0.55 + piece * 0.45, 0.62);
    paint_greens(ctx, gx, gy, 9, -0.25 + piece * 0.35, 0x3f8a3a);
  }
  const [scx, scy] = at(area, 0.3, -0.2);
  paint_scallions(ctx, scx, scy, 3, isLowDetail ? 2 : 4, seed ^ 0x71);
}

/**
 * Nasi lemak's shared base: a cone of coconut rice, a glossy sambal dollop and cucumber. The
 * variant layer adds the wing, cutlet, egg, fish or anchovies.
 *
 * @param p - The motif paint.
 */
function paint_nasi_lemak(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.32, -0.12);
  paint_rice_mound(
    ctx,
    rx,
    ry,
    area.rx * 0.5 * size,
    area.ry * 0.66 * size,
    COCONUT_RICE,
    seed,
    isLowDetail,
  );
  const [sx, sy] = at(area, -0.05, 0.55);
  paint_dollop(ctx, sx, sy, 3.2, SAMBAL, seed ^ 0x5a);
  paint_cucumber_row(p, -0.85, 2);
}

/**
 * Paints one slice of char siew lying on the rice: pink roast meat inside a lacquered
 * mahogany-red rim, blackened where the fire caught its corners, with a glaze highlight.
 *
 * @param ctx - The paint context.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param angle - Tilt in radians.
 */
function paint_char_siew_slice(ctx: PaintContext, x: number, y: number, angle: number): void {
  const width = 3.6;
  const length = 8.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_rounded_rect(
    ctx,
    -width / 2 + 0.6,
    -length / 2 + 0.9,
    width,
    length,
    1.4,
    css(SHADOW_INK, 0.26),
  );
  fill_rounded_rect(
    ctx,
    -width / 2,
    -length / 2,
    width,
    length,
    1.4,
    linear_gradient(ctx, -width / 2, 0, width / 2, 0, [
      [0, CHAR_SIEW.glaze],
      [0.25, CHAR_SIEW.meat],
      [0.7, tint(CHAR_SIEW.meat, 0.15)],
      [1, CHAR_SIEW.glaze],
    ]),
  );
  stroke_rounded_rect(ctx, -width / 2, -length / 2, width, length, 1.4, css(0x7a1a10), 0.7);
  fill_ellipse(ctx, -width / 2 + 0.5, -length / 2 + 0.8, 0.8, 0.6, css(0x2a0c06, 0.8));
  fill_ellipse(ctx, width / 2 - 0.4, length / 2 - 1, 0.7, 0.9, css(0x2a0c06, 0.7));
  fill_rounded_rect(
    ctx,
    -width / 2 + 0.9,
    -length / 2 + 1.2,
    0.7,
    length * 0.55,
    0.3,
    css(WHITE, 0.45),
  );
  ctx.restore();
}

/**
 * Char siew rice: lacquered barbecued pork slices, red at the glazed edge and pink inside,
 * fanned over white rice under a glossy sweet sauce, with cucumber and spring onion.
 *
 * @param p - The motif paint.
 */
function paint_char_siew_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_rice_mound(
    ctx,
    area.x - 2,
    area.y - 1,
    area.rx * 0.75 * size,
    area.ry * 0.78 * size,
    0xf6f0e0,
    seed,
    isLowDetail,
  );
  // The sweet sauce poured over the slices soaks into the rice round them.
  paint_liquid(ctx, area.x + 1, area.y, area.rx * 0.5 * size, area.ry * 0.45 * size, 0x7a2a16, {
    sheen: 0.5,
    alpha: 0.7,
  });
  const slices = pieces_left(5, p.remaining);
  for (let slice = slices - 1; slice >= 0; slice -= 1) {
    const [x, y] = at(area, -0.4 + slice * 0.24, -0.12 + slice * 0.06);
    paint_char_siew_slice(ctx, x, y, 0.5 - slice * 0.06);
  }
  paint_cucumber_row(p, -0.85, 3);
  const [gx, gy] = at(area, 0.62, -0.5);
  paint_scallions(ctx, gx, gy, 2.4, isLowDetail ? 2 : 4, seed ^ 0x5d);
  const [dx, dy] = at(area, 0.82, 0.58);
  paint_sauce_cup(ctx, dx, dy, 3, 0xe0512f);
}

/**
 * Briyani's shared base: saffron-streaked basmati with fried onions and a pickle. The variant
 * layer adds the chicken, mutton, fish and prawn or vegetables.
 *
 * @param p - The motif paint.
 */
function paint_nasi_briyani(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.3, -0.1);
  const mound_rx = area.rx * 0.62 * size;
  const mound_ry = area.ry * 0.72 * size;
  paint_rice_mound(ctx, rx, ry, mound_rx, mound_ry, 0xf0d58c, seed, isLowDetail);
  speckle(
    ctx,
    rx - mound_rx * 0.7,
    ry - mound_ry * 0.7,
    mound_rx * 1.4,
    mound_ry * 1.2,
    isLowDetail ? 5 : 12,
    [0xe08a2a, 0xf7efd8, 0xd8662a],
    seed ^ 0x2b,
    1.1,
  );
  paint_dots(ctx, rx + 1, ry - 2, mound_rx * 0.5, isLowDetail ? 3 : 6, 0.7, SHALLOT, seed ^ 0x44);
  const [ax, ay] = at(area, -0.62, 0.62);
  paint_dollop(ctx, ax, ay, 2.6, 0xc84b2c, seed ^ 0x19);
  paint_cucumber(ctx, ax + 5, ay + 0.5, 2.4);
}

/**
 * South Indian lemon rice: turmeric-yellow rice with peanuts, mustard seeds, curry leaves and a
 * lemon wedge.
 *
 * @param p - The motif paint.
 */
function paint_lemon_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.1, -0.05);
  const mound_rx = area.rx * 0.7 * size;
  const mound_ry = area.ry * 0.74 * size;
  paint_rice_mound(ctx, rx, ry, mound_rx, mound_ry, 0xeccb3c, seed, isLowDetail);
  paint_dots(ctx, rx, ry - 1, mound_rx * 0.7, isLowDetail ? 4 : 7, 1, PEANUT, seed ^ 0x61);
  paint_dots(ctx, rx, ry, mound_rx * 0.75, isLowDetail ? 3 : 8, 0.45, 0x2b2620, seed ^ 0x62);
  for (const [u, v, angle] of [
    [-0.35, -0.45, 0.6],
    [0.25, -0.3, -0.4],
  ] as const) {
    const [lx, ly] = at(area, u, v);
    paint_leaf(ctx, lx, ly, 4.4, angle, 0x2f6a2c);
  }
  const [wx, wy] = at(area, 0.72, 0.55);
  paint_citrus_wedge(ctx, wx, wy, 3.6, 0.3, { rind: 0xe3bc22, flesh: 0xf7eaa6 });
}

/**
 * Teochew braised duck rice's shared base: rice soaked in the dark braising sauce, cucumber and
 * a chilli-vinegar dip. The variant layer adds the duck, egg and tofu.
 *
 * @param p - The motif paint.
 */
function paint_duck_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.35, -0.05);
  paint_rice_mound(
    ctx,
    rx,
    ry,
    area.rx * 0.56 * size,
    area.ry * 0.7 * size,
    0xd8b88a,
    seed,
    isLowDetail,
  );
  paint_liquid(ctx, rx + 0.5, ry + 0.8, area.rx * 0.45 * size, area.ry * 0.5 * size, DARK_SOY, {
    sheen: 0.45,
    alpha: 0.5,
  });
  paint_cucumber_row(p, -0.8, 2);
  const [dx, dy] = at(area, 0.82, 0.62);
  paint_sauce_cup(ctx, dx, dy, 3.2, 0xd8472a);
}

/**
 * Claypot chicken rice: rice with a charred crust at the pot's edge, glazed chicken, sliced
 * Chinese sausage, a shiitake cap and spring onion under a dark soy drizzle.
 *
 * @param p - The motif paint.
 */
function paint_claypot_chicken_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const rice_rx = area.rx;
  const rice_ry = area.ry;
  paint_rice_mound(ctx, area.x, area.y, rice_rx, rice_ry, 0xddbb82, seed, isLowDetail);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(area.x, area.y, rice_rx - 0.6, rice_ry - 0.6, 0, 0, Math.PI * 2);
  ctx.strokeStyle = css(0x5a3018, 0.75);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
  const chunks = pieces_left(4, p.remaining);
  for (let chunk = 0; chunk < chunks; chunk += 1) {
    const [x, y] = at(area, -0.5 + chunk * 0.32, -0.25 + (chunk % 2) * 0.35);
    paint_chunk(ctx, x, y, 4.4, 0xa35a2a, 0.3 * chunk, { gloss: 0.4 });
  }
  const sausages = pieces_left(3, p.remaining);
  for (let slice = 0; slice < sausages; slice += 1) {
    const [x, y] = at(area, 0.45 - slice * 0.28, 0.5 - slice * 0.12);
    paint_sausage_slice(ctx, x, y, 2.2, 0.4);
  }
  const [mx, my] = at(area, -0.45, 0.4);
  paint_mushroom(ctx, mx, my, 2.6);
  paint_scallions(ctx, area.x + 2, area.y - 1, area.rx * 0.5, isLowDetail ? 3 : 6, seed ^ 0x3e);
}

/**
 * Paints a small heap of chopped vegetables or crumbs.
 *
 * @param ctx - The paint context.
 * @param x - Heap centre x.
 * @param y - Heap centre y.
 * @param radius - Heap radius.
 * @param colours - The chopped pieces' colours.
 * @param seed - Scatter seed.
 * @param count - Number of pieces.
 */
function paint_heap(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  colours: readonly number[],
  seed: number,
  count: number,
): void {
  speckle(ctx, x - radius, y - radius * 0.8, radius * 2, radius * 1.6, count, colours, seed, 1.5);
}

/**
 * Hakka thunder tea rice: brown rice under neat heaps of chopped greens, long beans, tofu,
 * preserved radish and peanuts, with the green tea broth pooled in the middle.
 *
 * @param p - The motif paint.
 */
function paint_thunder_tea_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_rice_mound(
    ctx,
    area.x,
    area.y,
    area.rx * 0.9 * size,
    area.ry * 0.88 * size,
    0xc8a271,
    seed,
    isLowDetail,
  );
  const count = isLowDetail ? 6 : 12;
  const heaps: ReadonlyArray<readonly [number, number, readonly number[]]> = [
    [-0.5, -0.35, [0x2f6b2c, 0x3f7f35]],
    [0.05, -0.55, [0x8db85a, 0x9cc46a]],
    [0.55, -0.25, [0xd9a24a, 0xe8b85e]],
    [0.5, 0.4, [0x9a6a3a, 0x7d532c]],
    [-0.1, 0.55, [0x5d9c45, 0x6eae4f]],
    [-0.6, 0.3, [PEANUT, 0xd9aa6c]],
  ];
  const shown = pieces_left(heaps.length, p.remaining);
  heaps.slice(0, shown).forEach(([u, v, colours], index) => {
    const [hx, hy] = at(area, u * size, v * size);
    paint_heap(ctx, hx, hy, 3.6, colours, seed ^ (index * 97), count);
  });
  const [gx, gy] = at(area, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(gx, gy, 3.2 * size, 2.3 * size, 0, 0, Math.PI * 2);
  ctx.fillStyle = css(0x6e9a3e);
  ctx.fill();
  ctx.restore();
}

/**
 * Lotus leaf rice: an opened, veined lotus leaf around glossy glutinous rice studded with
 * Chinese sausage, char siew and mushroom. Each eaten third scoops a wider hollow out of the
 * rice from the diner's side and takes a topping with it.
 *
 * @param p - The motif paint.
 */
function paint_lotus_leaf_rice(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const leaf = 0x5f733a;
  const leaf_rx = area.rx * 1.05;
  const leaf_ry = area.ry * 1.02;
  ctx.save();
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1.6;
  ctx.shadowColor = css(SHADOW_INK, 0.3);
  // The steamed lotus leaf, opened out flat: a broad olive sheet with its folds pressed open.
  ctx.beginPath();
  for (let point = 0; point <= 8; point += 1) {
    const angle = (point / 8) * Math.PI * 2;
    const reach = point % 2 === 0 ? 1 : 0.82;
    const px = area.x + Math.cos(angle) * leaf_rx * reach;
    const py = area.y + Math.sin(angle) * leaf_ry * reach;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = radial_gradient(ctx, area.x - 3, area.y - 3, 1, leaf_rx, [
    [0, 0x8a9a52],
    [0.6, leaf],
    [1, shade(leaf, 0.3)],
  ]);
  ctx.fill();
  ctx.restore();
  for (let vein = 0; vein < 8; vein += 1) {
    const angle = (vein / 8) * Math.PI * 2 + 0.39;
    line(
      ctx,
      area.x,
      area.y,
      area.x + Math.cos(angle) * leaf_rx * 0.85,
      area.y + Math.sin(angle) * leaf_ry * 0.85,
      css(0xb8c47a, 0.45),
      0.6,
    );
  }
  // The glutinous rice, scooped away from the diner's (south-east) side as it is eaten, so the
  // leaf shows through a widening hollow and the toppings go one by one.
  const eaten = Math.round((1 - p.remaining) * 3);
  const mound_rx = area.rx * 0.68;
  const mound_ry = area.ry * 0.7;
  const scoop = LOTUS_SCOOPS[eaten];
  ctx.save();
  if (scoop) {
    ctx.beginPath();
    ctx.rect(area.x - area.rx * 2, area.y - area.ry * 2, area.rx * 4, area.ry * 4);
    ctx.ellipse(
      area.x + scoop.u * mound_rx,
      area.y + scoop.v * mound_ry,
      scoop.rx * mound_rx,
      scoop.ry * mound_ry,
      0,
      0,
      TAU,
      true,
    );
    ctx.clip();
  }
  paint_rice_mound(ctx, area.x, area.y, mound_rx, mound_ry, LOTUS_RICE, seed, isLowDetail);
  ctx.restore();
  if (scoop) {
    // The cut wall of rice along the far edge of the hollow, and a few stray grains in it.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(area.x, area.y, mound_rx, mound_ry, 0, 0, TAU);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(
      area.x + scoop.u * mound_rx,
      area.y + scoop.v * mound_ry,
      scoop.rx * mound_rx,
      scoop.ry * mound_ry,
      0,
      Math.PI * 0.95,
      Math.PI * 2.05,
      false,
    );
    ctx.strokeStyle = css(shade(LOTUS_RICE, 0.4));
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
    for (const [u, v] of [
      [0.35, 0.55],
      [0.6, 0.2],
      [0.15, 0.75],
    ] as const) {
      const [gx, gy] = at(area, u * 0.68 * (1 + eaten * 0.2), v * 0.7);
      fill_ellipse(ctx, gx, gy, 0.9, 0.45, css(tint(LOTUS_RICE, 0.35)));
    }
  }
  if (eaten === 0) {
    const [sx, sy] = at(area, 0.28, 0.08);
    paint_sausage_slice(ctx, sx, sy, 2, -0.3);
  }
  if (eaten <= 1) {
    const [mx, my] = at(area, 0.02, -0.38);
    paint_mushroom(ctx, mx, my, 2);
  }
  const [cx, cy] = at(area, -0.32, -0.12);
  paint_chunk(ctx, cx, cy, 3.2, 0xa8402e, 0.4, { gloss: 0.45 });
}

/**
 * Ayam penyet: deep-fried chicken smashed flat into its crust, on a banana leaf beside white
 * rice, fried tofu, raw vegetables and a dollop of fresh sambal.
 *
 * @param p - The motif paint.
 */
function paint_ayam_penyet(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.45, -0.25);
  paint_rice_mound(
    ctx,
    rx,
    ry,
    area.rx * 0.42 * size,
    area.ry * 0.5 * size,
    0xf6f1e4,
    seed,
    isLowDetail,
  );
  const [lx, ly] = at(area, -0.55, 0.5);
  paint_leaf(ctx, lx, ly, 7, -0.3, 0x7fb04e);
  paint_cucumber(ctx, lx + 4.5, ly - 0.5, 2.4);
  const [tx, ty] = at(area, -0.05, 0.5);
  paint_tofu(ctx, tx, ty, 5 * Math.max(0.8, size), 4, 0xd8a04a);
  const [cx, cy] = at(area, 0.35, -0.1);
  paint_smashed_chicken(ctx, cx, cy, 9.6 * size, -0.2, seed ^ 0x61, isLowDetail);
  const [sx, sy] = at(area, 0.72, 0.5);
  paint_dollop(ctx, sx, sy, 2.6, SAMBAL, seed ^ 0x62);
}

/**
 * Nasi goreng: Malay-style fried rice stained red-gold with chilli and tomato, flecked with egg,
 * peas and carrot, with cucumber slices and sliced red chilli on the side.
 *
 * @param p - The motif paint.
 */
function paint_nasi_goreng(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.12, -0.1);
  const mound_rx = area.rx * 0.72 * size;
  const mound_ry = area.ry * 0.75 * size;
  paint_rice_mound(ctx, rx, ry, mound_rx, mound_ry, 0xc9772f, seed, isLowDetail);
  paint_dots(ctx, rx, ry, mound_rx * 0.75, isLowDetail ? 4 : 9, 0.9, 0xf2cf5b, seed ^ 0x71);
  paint_dots(ctx, rx, ry, mound_rx * 0.7, isLowDetail ? 3 : 6, 0.65, 0x6aa040, seed ^ 0x72);
  paint_dots(ctx, rx, ry, mound_rx * 0.7, isLowDetail ? 2 : 4, 0.6, 0xe8782a, seed ^ 0x73);
  paint_cucumber_row(p, 0.2, 3);
  for (let chilli = 0; chilli < 2; chilli += 1) {
    const [cx, cy] = at(area, -0.72 + chilli * 0.14, 0.55 - chilli * 0.1);
    paint_chilli_slice(ctx, cx, cy, 1.3);
  }
}

/** The rice dish motifs, keyed by dish ID without the `dish.` prefix. */
export const RICE_MOTIFS: Readonly<Record<string, Motif>> = {
  "poached-chicken-rice": paint_poached_chicken_rice,
  "roast-chicken-rice": paint_roast_chicken_rice,
  "soya-tofu-rice": paint_soya_tofu_rice,
  "nasi-lemak": paint_nasi_lemak,
  "nasi-briyani": paint_nasi_briyani,
  "lemon-rice": paint_lemon_rice,
  "duck-rice": paint_duck_rice,
  "claypot-chicken-rice": paint_claypot_chicken_rice,
  "thunder-tea-rice": paint_thunder_tea_rice,
  "lotus-leaf-rice": paint_lotus_leaf_rice,
  "char-siew-rice": paint_char_siew_rice,
  "nasi-padang": paint_in_layer,
  "economic-rice": paint_in_layer,
  "ayam-penyet": paint_ayam_penyet,
  "nasi-goreng": paint_nasi_goreng,
};
