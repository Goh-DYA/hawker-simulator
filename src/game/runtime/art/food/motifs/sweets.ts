/**
 * Drink and dessert motifs: kopi and teh tarik (whose variant layers pour the drink),
 * sugarcane juice, barley water, soya bean milk, ice kacang, chendol, tau huay and pulut hitam.
 *
 * Drinks fill their cup or glass to a level that drops as they are drunk; shaved-ice desserts
 * rise above the bowl's rim in a dome streaked with syrup.
 */
import {
  css,
  fill_ellipse,
  radial_gradient,
  shade,
  speckle,
  stroke_ellipse,
  type PaintContext,
} from "../../canvas";
import { at, heap_scale, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  paint_citrus_wedge,
  paint_dots,
  paint_drizzle,
  paint_ice_cube,
  paint_liquid,
  paint_straw,
} from "../parts";
import { paint_ice_mound, paint_shreds, paint_spoon, trace_ice_mound } from "../toppings";
import type { FoodArea } from "../parts";
import { paint_glass_drink } from "../vessels";

/** Where a glass's straw tip rests, relative to the dish centre: just above the right rim. */
const STRAW_TIP = { x: 9.5, y: -15.5 } as const;
/** Tau huay's syrup: a deep amber that the white beancurd stands out against. */
const TAU_HUAY_SYRUP = 0xb5742c;
/** Soft soy beancurd. */
const BEANCURD = 0xf6eed6;
/** Cloudy, pale gold barley water. */
const BARLEY_WATER = 0xe2d4a4;
/** Creamy off-white soy milk. */
const SOY_MILK = 0xefe6cf;

/**
 * Kopi's saucer furniture: the teaspoon resting on the saucer. The variant layer pours the
 * coffee and sets out the sugar.
 *
 * @param p - The motif paint.
 */
function paint_kopi(p: MotifPaint): void {
  paint_spoon(p.ctx, p.cx + 5.5, p.cy + 12.4, 9, -0.38);
}

/**
 * Paints a drinking straw leaning on a glass's rim, with its tip just above the glass and
 * inside the texture, and its foot in the drink as the level drops.
 *
 * @param p - The motif paint.
 * @param surface - The drink's surface.
 * @param colour_value - The straw colour.
 */
function paint_glass_straw(p: MotifPaint, surface: FoodArea, colour_value: number): void {
  const straw_x = surface.x + 1.5;
  const tip_x = p.cx + STRAW_TIP.x;
  const tip_y = p.cy + STRAW_TIP.y;
  paint_straw(
    p.ctx,
    straw_x,
    surface.y,
    Math.hypot(tip_x - straw_x, tip_y - surface.y),
    Math.atan2(tip_y - surface.y, tip_x - straw_x),
    colour_value,
  );
}

/**
 * Fresh sugarcane juice: a tall glass of pale green-gold juice over ice, with a straw and a
 * lemon slice on the rim.
 *
 * @param p - The motif paint.
 */
function paint_sugarcane_juice(p: MotifPaint): void {
  const { ctx } = p;
  const surface = paint_glass_drink(ctx, p.cx, p.cy, 1, p.remaining, 0xc6d067);
  const cubes = pieces_left(3, p.remaining);
  for (let cube = 0; cube < cubes; cube += 1) {
    paint_ice_cube(
      ctx,
      surface.x - 3 + cube * 3,
      surface.y + 0.5 - (cube % 2) * 1.2,
      3.2,
      0.3 * cube,
    );
  }
  ctx.save();
  ctx.globalAlpha = 0.85;
  paint_dots(ctx, surface.x, surface.y + 8, 3, 4, 0.5, 0xeef4c8, p.seed);
  ctx.restore();
  paint_glass_straw(p, surface, 0x5f9e52);
  paint_citrus_wedge(ctx, surface.x - surface.rx + 0.5, p.cy - 12, 3.4, -0.5, {
    rind: 0xe3c02a,
    flesh: 0xf6eaa4,
  });
}

/**
 * Barley water: a tall glass of cloudy, pale gold barley water over ice, with the softened
 * pearl barley settled at the bottom of the glass.
 *
 * @param p - The motif paint.
 */
function paint_barley_drink(p: MotifPaint): void {
  const { ctx } = p;
  const surface = paint_glass_drink(ctx, p.cx, p.cy, 1, p.remaining, BARLEY_WATER);
  // The pearl barley settled in a soft layer at the foot of the glass.
  const base_y = p.cy + 10.4;
  fill_ellipse(ctx, surface.x, base_y, 5, 1.8, css(shade(BARLEY_WATER, 0.12), 0.9));
  paint_dots(ctx, surface.x, base_y - 0.4, 4.2, p.isLowDetail ? 6 : 12, 0.7, 0xf4ecd0, p.seed);
  paint_dots(ctx, surface.x, base_y - 0.2, 4, p.isLowDetail ? 3 : 6, 0.55, 0xb8a070, p.seed ^ 0x31);
  const cubes = pieces_left(4, p.remaining);
  for (let cube = 0; cube < cubes; cube += 1) {
    paint_ice_cube(
      ctx,
      surface.x - 3.6 + cube * 2.4,
      surface.y + 0.4 - (cube % 2) * 1.1,
      3,
      0.4 - 0.25 * cube,
    );
  }
  paint_glass_straw(p, surface, 0xe8eef0);
}

/**
 * Soya bean milk: a tall glass of creamy, opaque off-white soy milk with a thin ring of fine
 * bubbles round the surface and a red straw, served chilled without ice.
 *
 * @param p - The motif paint.
 */
function paint_soya_bean_milk(p: MotifPaint): void {
  const { ctx } = p;
  const surface = paint_glass_drink(ctx, p.cx, p.cy, 1, p.remaining, SOY_MILK);
  stroke_ellipse(
    ctx,
    surface.x,
    surface.y,
    surface.rx - 0.8,
    surface.ry - 0.4,
    css(0xfffaf0, 0.95),
    1.1,
  );
  const next_ring = p.isLowDetail ? 6 : 12;
  for (let bubble = 0; bubble < next_ring; bubble += 1) {
    const angle = (bubble / next_ring) * Math.PI * 2 + 0.3;
    fill_ellipse(
      ctx,
      surface.x + Math.cos(angle) * (surface.rx - 1.2),
      surface.y + Math.sin(angle) * (surface.ry - 0.5),
      0.55,
      0.4,
      css(0xffffff, 0.9),
    );
  }
  // Condensation beading on the cold glass.
  ctx.save();
  ctx.globalAlpha = 0.7;
  paint_dots(ctx, surface.x - 2, surface.y + 9, 3.4, p.isLowDetail ? 3 : 6, 0.45, 0xffffff, p.seed);
  ctx.restore();
  paint_glass_straw(p, surface, 0xd8423a);
}

/**
 * Teh tarik's glass: the variant layer pours the tea and pulls the foam.
 *
 * @returns Nothing.
 */
const paint_teh_tarik: Motif = () => undefined;

/**
 * Paints syrup soaked into a shaved-ice mound: soft-edged patches poured from the top that
 * fade as they run down, clipped to the mound.
 *
 * @param p - The motif paint.
 * @param x - Mound centre x.
 * @param base - Mound foot y.
 * @param radius - Mound half width.
 * @param height - Mound height.
 * @param patches - Each patch's centre across the mound (-1 to 1), height up the mound (0 at
 *   the foot, 1 at the top), size (a share of the mound's width), colour and alpha.
 */
function paint_syrups(
  p: MotifPaint,
  x: number,
  base: number,
  radius: number,
  height: number,
  patches: ReadonlyArray<readonly [number, number, number, number, number]>,
): void {
  const { ctx } = p;
  ctx.save();
  trace_ice_mound(ctx, x, base, radius, height);
  ctx.clip();
  for (const [u, v, size, colour, alpha] of patches) {
    const px = x + u * radius;
    const py = base - v * height;
    const pr = size * radius;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, 1.3);
    fill_ellipse(
      ctx,
      0,
      0,
      pr,
      pr,
      radial_gradient(ctx, 0, -pr * 0.3, 0.2, pr, [
        [0, colour, alpha],
        [0.65, colour, alpha * 0.8],
        [1, colour, 0],
      ]),
    );
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Ice kacang: a tall dome of shaved ice streaked with rose, pandan and sarsi syrups and
 * evaporated milk, crowned with sweet corn, red beans and jelly, its melt pooling pink.
 *
 * @param p - The motif paint.
 */
function paint_ice_kacang(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xe7a0b6, { sheen: 0.25 });
  const size = heap_scale(p.remaining);
  const base = area.y + area.ry * 0.45;
  const radius = area.rx * 0.88 * size;
  const height = 17 * size;
  paint_ice_mound(ctx, area.x, base, radius, height, seed, isLowDetail);
  paint_syrups(p, area.x, base, radius, height, [
    [-0.4, 0.62, 0.62, 0xd8344f, 0.85],
    [0.42, 0.55, 0.5, 0x3f9f4e, 0.75],
    [0.05, 0.25, 0.5, 0x8a4430, 0.55],
    [-0.1, 0.92, 0.42, 0xe0405a, 0.8],
  ]);
  const top = base - height;
  paint_drizzle(ctx, area.x, top + height * 0.35, radius * 0.5, 0xfdf8ec, seed ^ 0x11, 2, 1);
  paint_dots(
    ctx,
    area.x - 1,
    top + 3,
    radius * 0.4,
    isLowDetail ? 3 : 6,
    0.8,
    0xf2c83a,
    seed ^ 0x12,
  );
  paint_dots(
    ctx,
    area.x + 1,
    top + 4,
    radius * 0.4,
    isLowDetail ? 2 : 4,
    0.8,
    0x6e2222,
    seed ^ 0x13,
  );
  speckle(
    ctx,
    area.x - radius * 0.4,
    top + 1,
    radius * 0.8,
    4,
    isLowDetail ? 2 : 4,
    [0x5fbf5a, 0xe5506a],
    seed ^ 0x14,
    1.4,
  );
}

/**
 * Chendol: a low dome of shaved ice over coconut milk, heaped with bright green pandan jelly
 * and red beans and drizzled with dark gula melaka.
 *
 * @param p - The motif paint.
 */
function paint_chendol(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0xf1e6cc, { sheen: 0.3 });
  const size = heap_scale(p.remaining);
  const base = area.y + area.ry * 0.35;
  const radius = area.rx * 0.78 * size;
  const height = 9 * size;
  paint_ice_mound(ctx, area.x, base, radius, height, seed, isLowDetail);
  paint_shreds(
    ctx,
    area.x,
    base - height * 0.55,
    radius * 0.6,
    isLowDetail ? 5 : 9,
    0x3faa48,
    seed ^ 0x21,
    4.4,
    1.7,
  );
  paint_dots(
    ctx,
    area.x + 2,
    base - height * 0.4,
    radius * 0.45,
    isLowDetail ? 2 : 4,
    0.9,
    0x6a2424,
    seed ^ 0x22,
  );
  paint_drizzle(ctx, area.x, base - height * 0.6, radius * 0.55, 0x5a2c16, seed ^ 0x23, 3, 1.2);
}

/**
 * Paints one scoop of tau huay: a thin, glossy layer of beancurd lifted by the ladle, with its
 * shaded underside and a fine edge so it stands off the beancurd beneath.
 *
 * @param ctx - The paint context.
 * @param x - Scoop centre x.
 * @param y - Scoop centre y.
 * @param width - Scoop width.
 * @param height - Scoop depth, foreshortened.
 * @param angle - Tilt in radians.
 */
function paint_beancurd_scoop(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
): void {
  const rx = width / 2;
  const ry = height / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0.4, 0.8, rx, ry, css(shade(BEANCURD, 0.32)));
  fill_ellipse(
    ctx,
    0,
    0,
    rx,
    ry,
    radial_gradient(ctx, -rx * 0.3, -ry * 0.4, 0.2, rx * 1.1, [
      [0, 0xffffff],
      [0.6, BEANCURD],
      [1, shade(BEANCURD, 0.12)],
    ]),
  );
  stroke_ellipse(ctx, 0, 0, rx, ry, css(shade(BEANCURD, 0.4), 0.55), 0.45);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx - 0.6, ry - 0.5, 0, 1.1 * Math.PI, 1.6 * Math.PI, false);
  ctx.strokeStyle = css(0xffffff, 0.85);
  ctx.lineWidth = 0.6;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

/**
 * Tau huay: silky soy beancurd scooped in thin, glossy layers, sitting in a deep amber syrup
 * that pools round it in the bowl.
 *
 * @param p - The motif paint.
 */
function paint_tau_huay(p: MotifPaint): void {
  const { ctx, area } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, TAU_HUAY_SYRUP, { sheen: 0.45 });
  const size = heap_scale(p.remaining);
  const curd_rx = area.rx * 0.78 * size;
  const curd_ry = area.ry * 0.72 * size;
  fill_ellipse(ctx, area.x, area.y + 0.4, curd_rx, curd_ry, css(shade(BEANCURD, 0.34)));
  paint_liquid(ctx, area.x - 0.5, area.y - 0.6, curd_rx, curd_ry, BEANCURD, { sheen: 0.5 });
  const layers = pieces_left(3, p.remaining);
  for (let layer = 0; layer < layers; layer += 1) {
    const [x, y] = at(area, -0.3 + layer * 0.28, -0.28 + layer * 0.2);
    paint_beancurd_scoop(ctx, x, y, 9 * size, 4.4 * size, -0.3 + layer * 0.12);
  }
}

/**
 * Pulut hitam: a thick, purple-black glutinous rice pudding with a swirl of coconut cream.
 *
 * @param p - The motif paint.
 */
function paint_pulut_hitam(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_liquid(ctx, area.x, area.y, area.rx, area.ry, 0x4a2c47, { sheen: 0.25 });
  speckle(
    ctx,
    area.x - area.rx * 0.8,
    area.y - area.ry * 0.7,
    area.rx * 1.6,
    area.ry * 1.4,
    isLowDetail ? 8 : 18,
    [0x2c1a2c, 0x6c4a66, 0x3a2238],
    seed,
    1.1,
  );
  const size = heap_scale(p.remaining);
  ctx.save();
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let turn = 0; turn <= 24; turn += 1) {
    const angle = turn * 0.5;
    const radius = (0.5 + turn * 0.22) * size;
    const x = area.x + Math.cos(angle) * radius;
    const y = area.y + Math.sin(angle) * radius * 0.7;
    if (turn === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = css(0xf7f0e2, 0.95);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** The drink and dessert motifs, keyed by dish ID without the `dish.` prefix. */
export const SWEET_MOTIFS: Readonly<Record<string, Motif>> = {
  kopi: paint_kopi,
  "sugarcane-juice": paint_sugarcane_juice,
  "teh-tarik": paint_teh_tarik,
  "barley-drink": paint_barley_drink,
  "soya-bean-milk": paint_soya_bean_milk,
  "ice-kacang": paint_ice_kacang,
  chendol: paint_chendol,
  "tau-huay": paint_tau_huay,
  "pulut-hitam": paint_pulut_hitam,
};
