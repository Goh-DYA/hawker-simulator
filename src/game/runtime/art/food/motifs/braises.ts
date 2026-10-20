/**
 * Nonya, dim sum and plated-snack motifs: ayam pongteh, chap chye and babi pongteh plated in
 * their gravies, kueh pie tee's crisp pastry cups, the siew mai and char siew bao standing in
 * their bamboo steamers, chee cheong fun's rice rolls under sweet sauce, and gado-gado under its
 * peanut gravy.
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
  stroke_ellipse,
  tint,
} from "../../canvas";
import { at, heap_scale, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  paint_bun,
  paint_chunk,
  paint_dots,
  paint_egg_half,
  paint_gloss,
  paint_herb_flecks,
  paint_leaf,
  paint_liquid,
  paint_prawn,
  paint_sauce_cup,
  paint_slice,
  paint_tofu,
  WHITE,
} from "../parts";
import {
  paint_dollop,
  paint_mushroom,
  paint_rice_roll,
  paint_shreds,
  paint_sprouts,
} from "../toppings";

/** Kueh pie tee's crisp fried pastry shell and its braised turnip filling. */
const PIE_TEE = { shell: 0xd9a441, filling: 0xe6d3a2 } as const;
/** The glossy brown-red barbecued pork filling that shows where a char siew bao splits. */
const CHAR_SIEW_FILLING = 0x9a3424;
/** Chee cheong fun's dark sweet sauce. */
const SWEET_SAUCE = 0x6b3a1e;
/** Gado-gado's thick peanut gravy. */
const PEANUT_GRAVY = 0xb8803e;

/**
 * Paints a braise's gravy spread on the plate: a glossy pool a little smaller than the food
 * area.
 *
 * @param p - The motif paint.
 * @param colourValue - The gravy colour.
 */
function paint_gravy(p: MotifPaint, colourValue: number): void {
  const size = heap_scale(p.remaining);
  paint_liquid(
    p.ctx,
    p.area.x,
    p.area.y + 0.5,
    p.area.rx * 0.95 * size,
    p.area.ry * 0.88 * size,
    colourValue,
    {
      sheen: 0.3,
    },
  );
}

/**
 * Ayam pongteh: chicken and potato braised in a dark fermented-soybean gravy, with shiitake and
 * coriander.
 *
 * @param p - The motif paint.
 */
function paint_ayam_pongteh(p: MotifPaint): void {
  const { ctx, area, isLowDetail, seed } = p;
  paint_gravy(p, 0x5a3a24);
  const chicken = pieces_left(3, p.remaining);
  for (let piece = 0; piece < chicken; piece += 1) {
    const [x, y] = at(area, -0.45 + piece * 0.42, (piece % 2 ? 0.3 : -0.3) * p.remaining);
    paint_chunk(ctx, x, y, 5, 0x8a5230, 0.3 + piece * 0.4, { radius: 1.8, gloss: 0.45 });
  }
  const potatoes = pieces_left(2, p.remaining);
  for (let potato = 0; potato < potatoes; potato += 1) {
    const [x, y] = at(area, -0.1 + potato * 0.5, 0.45 - potato * 0.85);
    paint_chunk(ctx, x, y, 4.6, 0xd8a85e, 0.2, { radius: 2, gloss: 0.4 });
  }
  const [mx, my] = at(area, -0.55, 0.45);
  paint_mushroom(ctx, mx, my, 2.4);
  paint_herb_flecks(
    ctx,
    area.x,
    area.y - 1,
    area.rx * 0.4,
    isLowDetail ? 2 : 4,
    0x4e9a3e,
    seed ^ 0x11,
    2.6,
  );
}

/**
 * Nonya chap chye: cabbage, carrot, baby corn, black fungus and glass noodles braised in a
 * light savoury gravy.
 *
 * @param p - The motif paint.
 */
function paint_chap_chye(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  paint_gravy(p, 0xa07c4a);
  paint_shreds(
    ctx,
    area.x,
    area.y,
    area.rx * 0.6,
    isLowDetail ? 3 : 6,
    0xe9dcc0,
    seed ^ 0x21,
    6,
    0.7,
  );
  const leaves = pieces_left(3, p.remaining);
  for (let leaf = 0; leaf < leaves; leaf += 1) {
    const [x, y] = at(area, -0.4 + leaf * 0.38, -0.3 + (leaf % 2) * 0.35);
    paint_leaf(ctx, x, y, 8, -0.4 + leaf * 0.7, leaf % 2 ? 0xcfe0a6 : 0xb8d48a);
  }
  const carrots = pieces_left(3, p.remaining);
  for (let carrot = 0; carrot < carrots; carrot += 1) {
    const [x, y] = at(area, 0.45 - carrot * 0.4, 0.45 - (carrot % 2) * 0.75);
    fill_ellipse(ctx, x + 0.4, y + 0.7, 2, 1.6, css(SHADOW_INK, 0.2));
    fill_ellipse(ctx, x, y, 2, 1.6, css(0xe8782a));
    fill_ellipse(ctx, x - 0.4, y - 0.4, 0.8, 0.5, css(tint(0xe8782a, 0.5)));
  }
  const [cx, cy] = at(area, 0.05, 0.4);
  paint_slice(ctx, cx, cy, 6, 2.4, 0.5, 0xf0d060, { gloss: 0.4 });
  const [fx, fy] = at(area, -0.6, 0.35);
  paint_dollop(ctx, fx, fy, 2, 0x2a2220, seed ^ 0x22);
}

/**
 * Babi pongteh: layered pork belly, potato and shiitake braised in a dark fermented-soybean
 * gravy, with coriander.
 *
 * @param p - The motif paint.
 */
function paint_babi_pongteh(p: MotifPaint): void {
  const { ctx, area, isLowDetail, seed } = p;
  paint_gravy(p, 0x6c3e24);
  const pork = pieces_left(3, p.remaining);
  for (let piece = 0; piece < pork; piece += 1) {
    const [x, y] = at(area, -0.45 + piece * 0.4, (piece % 2 ? 0.25 : -0.3) * p.remaining);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.2 + piece * 0.3);
    fill_rounded_rect(ctx, -2.4, -2, 5.4, 5, 1.2, css(SHADOW_INK, 0.25));
    fill_rounded_rect(
      ctx,
      -2.8,
      -2.6,
      5.6,
      5,
      1.2,
      linear_gradient(ctx, 0, -2.6, 0, 2.4, [
        [0, 0x7a3e22],
        [0.3, 0x9a5a34],
        [0.42, 0xf0dcc0],
        [0.56, 0x8a4a2a],
        [0.75, 0xe8d0b0],
        [1, 0x6a3420],
      ]),
    );
    fill_rounded_rect(ctx, -2.2, -2.2, 2.6, 0.8, 0.4, css(WHITE, 0.4));
    ctx.restore();
  }
  const potatoes = pieces_left(2, p.remaining);
  for (let potato = 0; potato < potatoes; potato += 1) {
    const [x, y] = at(area, 0.5 - potato * 0.95, 0.45);
    paint_chunk(ctx, x, y, 4.4, 0xc9984e, 0.4, { radius: 2, gloss: 0.4 });
  }
  const [mx, my] = at(area, 0.55, -0.4);
  paint_mushroom(ctx, mx, my, 2.4);
  paint_herb_flecks(
    ctx,
    area.x,
    area.y,
    area.rx * 0.4,
    isLowDetail ? 2 : 4,
    0x4e9a3e,
    seed ^ 0x31,
    2.6,
  );
}

/**
 * Paints one kueh pie tee standing on the platter: a fluted golden "top hat" shell fried crisp,
 * its flared brim round a heap of braised turnip, crowned with a small prawn and a sliver of
 * chilli.
 *
 * @param ctx - The paint context.
 * @param x - Cup centre x.
 * @param y - Cup base y.
 * @param seed - Filling seed.
 * @param is_low_detail - True for fewer turnip strands.
 */
function paint_pie_tee_cup(
  ctx: MotifPaint["ctx"],
  x: number,
  y: number,
  seed: number,
  is_low_detail: boolean,
): void {
  const radius = 3;
  const height = 3.6;
  const brim = radius * 1.45;
  const top = y - height;
  fill_ellipse(ctx, x + 0.8, y + 0.8, brim, brim * 0.45, css(SHADOW_INK, 0.26));
  fill_rounded_rect(
    ctx,
    x - radius,
    top,
    radius * 2,
    height + radius * 0.3,
    radius * 0.5,
    linear_gradient(ctx, x - radius, 0, x + radius, 0, [
      [0, tint(PIE_TEE.shell, 0.35)],
      [0.5, PIE_TEE.shell],
      [1, shade(PIE_TEE.shell, 0.35)],
    ]),
  );
  for (let flute = -1; flute <= 1; flute += 1) {
    line(
      ctx,
      x + flute * 1.4,
      top + 0.8,
      x + flute * 1.2,
      y,
      css(shade(PIE_TEE.shell, 0.4), 0.6),
      0.5,
    );
  }
  // The flared, fluted brim and the dark mouth of the cup inside it.
  fill_ellipse(ctx, x, top, brim, brim * 0.42, css(tint(PIE_TEE.shell, 0.15)));
  stroke_ellipse(ctx, x, top, brim, brim * 0.42, css(shade(PIE_TEE.shell, 0.35), 0.8), 0.5);
  fill_ellipse(ctx, x, top + 0.1, radius * 0.95, radius * 0.38, css(shade(PIE_TEE.shell, 0.45)));
  paint_dollop(ctx, x, top - 0.4, radius * 0.85, PIE_TEE.filling, seed);
  paint_shreds(
    ctx,
    x,
    top - 0.6,
    radius * 0.7,
    is_low_detail ? 2 : 4,
    0xf3e6c2,
    seed ^ 0x5,
    2,
    0.6,
  );
  paint_prawn(ctx, x + 0.2, top - 1.2, 2.8, 0.6);
  fill_ellipse(ctx, x - 1.4, top - 1.2, 0.7, 0.4, css(0xd43b2a));
}

/**
 * Kueh pie tee: five crisp golden top-hat pastry cups filled with braised turnip, each topped
 * with a small prawn and chilli, with a dish of sweet chilli sauce.
 *
 * @param p - The motif paint.
 */
function paint_kueh_pie_tee(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const spots: ReadonlyArray<readonly [number, number]> = [
    [-0.55, -0.05],
    [-0.12, -0.2],
    [0.3, -0.05],
    [-0.35, 0.68],
    [0.1, 0.62],
  ];
  const shown = pieces_left(spots.length, p.remaining);
  spots.slice(0, shown).forEach(([u, v], index) => {
    const [x, y] = at(area, u, v);
    paint_pie_tee_cup(ctx, x, y, seed ^ (index * 0x2d), isLowDetail);
  });
  const [sx, sy] = at(area, 0.72, 0.2);
  paint_sauce_cup(ctx, sx, sy, 3.6, 0xd8502e);
  const [lx, ly] = at(area, 0.7, -0.55);
  paint_leaf(ctx, lx, ly, 3.6, 0.5, 0x4e9a3e);
}

/**
 * Paints one siew mai standing upright: a pleated yellow wanton-skin cup with the minced pork
 * filling showing on top and a dot of orange crab roe.
 *
 * @param ctx - The paint context.
 * @param x - Siew mai centre x.
 * @param y - Siew mai base y.
 */
function paint_siew_mai(ctx: MotifPaint["ctx"], x: number, y: number): void {
  const radius = 3.3;
  const height = 4;
  fill_ellipse(ctx, x + 0.8, y + 1, radius, radius * 0.6, css(SHADOW_INK, 0.28));
  fill_rounded_rect(
    ctx,
    x - radius,
    y - height,
    radius * 2,
    height + radius * 0.4,
    radius * 0.6,
    linear_gradient(ctx, x - radius, 0, x + radius, 0, [
      [0, 0xf3d873],
      [0.5, 0xe6bb48],
      [1, shade(0xe6bb48, 0.3)],
    ]),
  );
  for (let pleat = -1; pleat <= 1; pleat += 1) {
    line(
      ctx,
      x + pleat * 1.5,
      y - height + 0.6,
      x + pleat * 1.2,
      y,
      css(shade(0xe6bb48, 0.35), 0.6),
      0.5,
    );
  }
  fill_ellipse(ctx, x, y - height, radius, radius * 0.6, css(0xe9c25a));
  fill_ellipse(
    ctx,
    x,
    y - height + 0.2,
    radius * 0.8,
    radius * 0.46,
    radial_gradient(ctx, x - 0.8, y - height - 0.5, 0.2, radius, [
      [0, 0xe8a888],
      [1, 0xb06a4c],
    ]),
  );
  fill_ellipse(ctx, x + 0.3, y - height - 0.1, 0.9, 0.6, css(0xf0702a));
}

/**
 * Siew mai: four open-topped minced-pork dumplings in wanton skin, each topped with crab roe,
 * standing in their basket.
 *
 * @param p - The motif paint.
 */
function paint_siew_mai_basket(p: MotifPaint): void {
  const { ctx, area } = p;
  const spots: ReadonlyArray<readonly [number, number]> = [
    [-0.42, -0.2],
    [0.3, -0.25],
    [-0.35, 0.55],
    [0.38, 0.5],
  ];
  const shown = pieces_left(spots.length, p.remaining);
  for (const [u, v] of spots.slice(0, shown)) {
    const [x, y] = at(area, u, v);
    paint_siew_mai(ctx, x, y);
  }
}

/**
 * Char siew bao: three fluffy white buns, each burst open on top in its own uneven cracks
 * showing the brown-red barbecued pork, in their basket.
 *
 * @param p - The motif paint.
 */
function paint_char_siew_bao(p: MotifPaint): void {
  const { ctx, area } = p;
  const spots: ReadonlyArray<readonly [number, number]> = [
    [-0.4, -0.15],
    [0.42, -0.1],
    [0, 0.45],
  ];
  const shown = pieces_left(spots.length, p.remaining);
  spots.slice(0, shown).forEach(([u, v], index) => {
    const [x, y] = at(area, u, v);
    paint_bun(ctx, x, y - 1, 5.6, CHAR_SIEW_FILLING, p.seed ^ (index * 0x3b));
  });
}

/**
 * Chee cheong fun: three soft steamed rice-sheet rolls side by side under a drizzle of dark
 * sweet sauce, shining with sesame oil and sprinkled with sesame seeds.
 *
 * @param p - The motif paint.
 */
function paint_chee_cheong_fun(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const rolls = pieces_left(3, p.remaining);
  const length = area.rx * 1.45;
  ctx.save();
  ctx.lineCap = "round";
  for (let roll = 0; roll < rolls; roll += 1) {
    const [x, y] = at(area, (roll - 1) * 0.06, -0.5 + roll * 0.5);
    paint_rice_roll(ctx, x, y, length, -0.1);
    // A ribbon of sweet sauce squeezed along the top of each roll.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.1);
    ctx.beginPath();
    ctx.moveTo(-length * 0.4, -0.6);
    for (let wave = 1; wave <= 4; wave += 1) {
      const wave_x = -length * 0.4 + (length * 0.8 * wave) / 4;
      ctx.quadraticCurveTo(wave_x - length * 0.1, wave % 2 ? -1.8 : 0.4, wave_x, -0.6);
    }
    ctx.strokeStyle = css(SWEET_SAUCE, 0.92);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // The sauce pools a little at the rolls' foot; sesame oil shines and seeds are scattered.
  const [px, py] = at(area, 0.4, -0.25 + rolls * 0.3);
  paint_liquid(ctx, px, py, 3.4, 1.7, SWEET_SAUCE, { sheen: 0.5, alpha: 0.85 });
  paint_gloss(ctx, area.x - 2, area.y - 1, 4, 0.7, 0.45);
  paint_dots(ctx, area.x, area.y, area.rx * 0.6, isLowDetail ? 3 : 7, 0.45, 0xf4ead0, seed ^ 0x82);
}

/**
 * Gado-gado: golden fried beancurd, halved hard-boiled egg, ketupat rice cakes, boiled green
 * beans and beansprouts, under a thick peanut gravy.
 *
 * @param p - The motif paint.
 */
function paint_gado_gado(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_sprouts(ctx, area.x - 2, area.y + 2, area.rx * 0.7 * size, isLowDetail ? 4 : 8, seed);
  const beans = pieces_left(4, p.remaining);
  for (let bean = 0; bean < beans; bean += 1) {
    const [x, y] = at(area, -0.8 + bean * 0.12, 0.3 + (bean % 2) * 0.2);
    line(ctx, x, y, x + 5, y - 2.4, css(0x2f6a26), 1.5);
    line(ctx, x + 0.4, y - 0.4, x + 4.2, y - 2.2, css(0x6aa64a, 0.8), 0.5);
  }
  // The thick peanut gravy smothers the middle of the plate.
  paint_liquid(ctx, area.x, area.y, area.rx * 0.62 * size, area.ry * 0.6 * size, PEANUT_GRAVY, {
    sheen: 0.4,
  });
  const cakes = pieces_left(3, p.remaining);
  for (let cake = 0; cake < cakes; cake += 1) {
    const [x, y] = at(area, 0.25 + cake * 0.22, 0.42 - (cake % 2) * 0.28);
    paint_chunk(ctx, x, y, 3.6, 0xf1ecd8, 0.2 * cake, { gloss: 0.35, edge: 0.5 });
  }
  const tofu = pieces_left(2, p.remaining);
  for (let piece = 0; piece < tofu; piece += 1) {
    const [x, y] = at(area, -0.42 + piece * 0.4, -0.3 + piece * 0.1);
    paint_tofu(ctx, x, y, 4.6, 3.8, 0xd8a04a);
  }
  if (p.remaining > 0.5) {
    const [ex, ey] = at(area, 0.4, -0.4);
    paint_egg_half(ctx, ex, ey, 3.2);
  }
  const [gx, gy] = at(area, -0.1, 0.05);
  paint_dollop(ctx, gx, gy, 2.6 * size, PEANUT_GRAVY, seed ^ 0x92);
  paint_dots(ctx, gx, gy, 3, isLowDetail ? 2 : 5, 0.5, 0x7a4a1e, seed ^ 0x93);
}

/** The braise and dim sum motifs, keyed by dish ID without the `dish.` prefix. */
export const BRAISE_MOTIFS: Readonly<Record<string, Motif>> = {
  "ayam-buah-keluak": paint_ayam_pongteh,
  "chap-chye": paint_chap_chye,
  "babi-pongteh": paint_babi_pongteh,
  "kueh-pie-tee": paint_kueh_pie_tee,
  "siew-mai": paint_siew_mai_basket,
  "char-siew-bao": paint_char_siew_bao,
  "chee-cheong-fun": paint_chee_cheong_fun,
  "gado-gado": paint_gado_gado,
};
