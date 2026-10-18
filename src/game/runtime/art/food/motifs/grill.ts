/**
 * Grill and seafood motifs: chicken and beef satay, barbecued wings, salted egg squid, sambal
 * stingray and black pepper crab.
 *
 * Satay lies as a row of skewers beside its peanut sauce, wings and squid pile on their
 * platter or leaf, and the stingray and crab each fill their dish as one bold silhouette.
 */
import {
  css,
  fill_ellipse,
  linear_gradient,
  line,
  radial_gradient,
  shade,
  SHADOW_INK,
  tint,
  type PaintContext,
} from "../../canvas";
import { at, heap_scale, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  paint_chilli_slice,
  paint_chunk,
  paint_crab,
  paint_cucumber,
  paint_dots,
  paint_fried_ring,
  paint_gloss,
  paint_leaf,
  paint_liquid,
  paint_sauce_cup,
  paint_skewer,
  PEANUT,
  SAMBAL,
} from "../parts";
import { paint_dollop, paint_lime_half, paint_slivers, paint_wing } from "../toppings";

/** The stingray wing's fan: the angles its ridges span, from east round towards the south. */
const STINGRAY_FAN = { start: 0.02, end: 1.2 } as const;
/** The pale, translucent cartilage comb left once the flesh is eaten off the wing. */
const STINGRAY_CARTILAGE = 0xeadcc0;

/**
 * Lays a set of satay: a row of skewers, the peanut sauce bowl, cucumber, red onion and
 * ketupat rice cake.
 *
 * @param p - The motif paint.
 * @param meat - The glazed meat colour.
 * @param isCubed - True for square-cut beef, false for rounded chicken.
 */
function paint_satay(p: MotifPaint, meat: number, isCubed: boolean): void {
  const { ctx, area, seed, isLowDetail } = p;
  const skewers = pieces_left(5, p.remaining);
  for (let skewer = 0; skewer < skewers; skewer += 1) {
    const v = -0.62 + skewer * 0.3;
    const [x0, y0] = at(area, -0.95, v + 0.18);
    const [x1, y1] = at(area, 0.3, v - 0.12);
    paint_skewer(ctx, x0, y0, x1, y1, meat, 4, isCubed);
  }
  const [sx, sy] = at(area, 0.72, -0.3);
  paint_sauce_cup(ctx, sx, sy, 4.4, 0xb8682c);
  paint_dots(ctx, sx, sy - 0.4, 2.2, isLowDetail ? 2 : 4, 0.6, PEANUT, seed ^ 0x11);
  const [cx, cy] = at(area, 0.55, 0.55);
  paint_chunk(ctx, cx, cy, 3, 0xdcecbd, 0.3, { gloss: 0.3, edge: 0.6 });
  paint_chunk(ctx, cx + 3.4, cy + 0.6, 3, 0xc96a8a, -0.2, { gloss: 0.3 });
  paint_chunk(ctx, cx + 6, cy - 2.4, 3.4, 0xe6edd2, 0.1, { gloss: 0.3, edge: 0.5 });
}

/**
 * Chicken satay: turmeric-glazed rounded chicken pieces, charred at the edges.
 *
 * @param p - The motif paint.
 */
function paint_chicken_satay(p: MotifPaint): void {
  paint_satay(p, 0xc9712c, false);
}

/**
 * Beef satay: darker, square-cut beef pieces.
 *
 * @param p - The motif paint.
 */
function paint_beef_satay(p: MotifPaint): void {
  paint_satay(p, 0x6c3a24, true);
}

/**
 * Barbecued chicken wings: three sticky charred wings with a calamansi half and chilli dip.
 *
 * @param p - The motif paint.
 */
function paint_bbq_wings(p: MotifPaint): void {
  const { ctx, area } = p;
  const wings = pieces_left(3, p.remaining);
  for (let wing = 0; wing < wings; wing += 1) {
    const [x, y] = at(area, -0.5 + wing * 0.42, -0.25 + (wing % 2) * 0.4);
    paint_wing(ctx, x, y, 11.5, -0.3 + wing * 0.25, 0xa4462a);
    line(ctx, x - 2, y - 1, x + 1, y + 1, css(0x3a1a10, 0.6), 0.9);
  }
  const [lx, ly] = at(area, 0.75, 0.5);
  paint_lime_half(ctx, lx, ly, 2.8);
  const [cx, cy] = at(area, 0.78, -0.45);
  paint_sauce_cup(ctx, cx, cy, 3.4, 0xd8472a);
}

/**
 * Salted egg squid: crisp golden squid rings tossed in frothy salted-egg yolk with curry leaves
 * and chilli.
 *
 * @param p - The motif paint.
 */
function paint_salted_egg_squid(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const spots: ReadonlyArray<readonly [number, number]> = [
    [-0.45, -0.3],
    [0.1, -0.4],
    [0.55, -0.15],
    [-0.25, 0.3],
    [0.3, 0.35],
    [-0.65, 0.25],
    [0, 0],
  ];
  const shown = pieces_left(spots.length, p.remaining);
  spots.slice(0, shown).forEach(([u, v], index) => {
    const [x, y] = at(area, u, v);
    paint_fried_ring(ctx, x, y, 2.4, 2.4, 0xe0a840, seed ^ index);
  });
  const size = heap_scale(p.remaining);
  for (let froth = 0; froth < (isLowDetail ? 2 : 4); froth += 1) {
    const [x, y] = at(area, -0.4 + froth * 0.3, (froth % 2 ? 0.1 : -0.1) * size);
    paint_dollop(ctx, x, y, 1.6, 0xf3c94a, seed ^ (0x21 + froth));
  }
  for (const [u, v, angle] of [
    [-0.15, -0.6, 0.4],
    [0.45, 0.5, -0.8],
    [-0.55, 0.55, 1.2],
  ] as const) {
    const [x, y] = at(area, u, v);
    paint_leaf(ctx, x, y, 3.8, angle, 0x2f6a2c);
  }
  const [cx, cy] = at(area, 0.2, 0.05);
  paint_chilli_slice(ctx, cx, cy, 1.3);
  paint_chilli_slice(ctx, cx - 6, cy + 2, 1.2);
}

/**
 * Sambal stingray: a grilled stingray wing, its fan of ridges smothered in sambal and onion,
 * on banana leaf with calamansi. The calamansi is squeezed over it first, and eating strips the
 * flesh from the wing's southern edge towards its root, leaving the pale comb of cartilage
 * bare, so each eaten third shows more comb and less sambal.
 *
 * @param p - The motif paint.
 */
function paint_sambal_stingray(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const [rootX, rootY] = at(area, -0.85, -0.7);
  const radius = area.rx * 1.6;
  const flat = 0.66;
  const { start, end } = STINGRAY_FAN;
  // The first helpings come off the thick southern edge, so the comb shows from the first third.
  const flesh_end = start + (end - start) * p.remaining ** 1.3;
  const trace_fan = (reach: number, from: number, to: number) => {
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.ellipse(rootX, rootY, radius * reach, radius * flat * reach, 0, from, to, false);
    ctx.closePath();
  };
  const ridge_end = (angle: number, reach: number): [number, number] => [
    rootX + Math.cos(angle) * radius * reach,
    rootY + Math.sin(angle) * radius * flat * reach,
  ];
  if (flesh_end < end) {
    // The eaten part of the wing: a thin film over the bare comb of cartilage.
    trace_fan(0.98, flesh_end, end);
    ctx.fillStyle = css(STINGRAY_CARTILAGE, 0.35);
    ctx.fill();
    for (let angle = flesh_end + 0.03; angle < end; angle += 0.055) {
      const [x, y] = ridge_end(angle, 0.96);
      line(ctx, rootX, rootY, x, y, css(STINGRAY_CARTILAGE, 0.9), 0.45);
    }
    line(ctx, rootX, rootY, ...ridge_end(end, 0.98), css(shade(STINGRAY_CARTILAGE, 0.25)), 0.6);
  }
  ctx.save();
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1.5;
  ctx.shadowColor = css(SHADOW_INK, 0.35);
  trace_fan(1, start, flesh_end);
  ctx.fillStyle = linear_gradient(ctx, rootX, rootY, rootX + radius, rootY + radius * flat, [
    [0, 0xe8cfa0],
    [0.65, 0xc8955a],
    [1, 0x6e4020],
  ]);
  ctx.fill();
  ctx.restore();
  ctx.save();
  trace_fan(1, start, flesh_end);
  ctx.clip();
  for (let ridge = 0; ridge < 8; ridge += 1) {
    const [x, y] = ridge_end(0.08 + ridge * 0.15, 1);
    line(ctx, rootX, rootY, x, y, css(shade(0xc8955a, 0.45), 0.55), 0.7);
  }
  // The sambal coats the thick inner part of the wing and leaves the grilled edge bare.
  trace_fan(0.72, start, flesh_end);
  ctx.fillStyle = radial_gradient(
    ctx,
    rootX + radius * 0.3,
    rootY + radius * 0.15,
    0.5,
    radius * 0.75,
    [
      [0, 0xd84a2a],
      [0.7, SAMBAL],
      [1, 0x7a2010],
    ],
  );
  ctx.fill();
  for (let blob = 0; blob < 3; blob += 1) {
    const angle = 0.25 + blob * 0.35;
    if (angle > flesh_end) continue;
    const [x, y] = ridge_end(angle, 0.5);
    paint_dollop(ctx, x, y, 2.6, SAMBAL, seed ^ (0x31 + blob));
  }
  ctx.restore();
  if (flesh_end < end) {
    // The flesh's thickness casts a soft shadow onto the bare comb beside it.
    const [edgeX, edgeY] = ridge_end(flesh_end + 0.04, 0.96);
    line(ctx, rootX + 0.4, rootY + 0.6, edgeX, edgeY, css(SHADOW_INK, 0.22), 1.2);
  }
  const onions = Math.max(1, Math.round((isLowDetail ? 2 : 4) * p.remaining));
  const [ox, oy] = at(area, -0.2, -0.05);
  paint_slivers(ctx, ox, oy, 3 * heap_scale(p.remaining), onions, 0xb04a7a, seed ^ 0x35);
  const [lx, ly] = at(area, 0.7, -0.6);
  if (p.remaining < 1) paint_squeezed_lime(ctx, lx, ly, 2.8);
  else paint_lime_half(ctx, lx, ly, 2.8);
}

/**
 * Paints a calamansi half after it has been squeezed over the fish: the rind folded flat and
 * the pale, spent flesh showing in its crease.
 *
 * @param ctx - The paint context.
 * @param x - Rind centre x.
 * @param y - Rind centre y.
 * @param radius - The half's radius before it was squeezed.
 */
function paint_squeezed_lime(ctx: PaintContext, x: number, y: number, radius: number): void {
  fill_ellipse(ctx, x + 0.5, y + 0.8, radius * 1.1, radius * 0.5, css(SHADOW_INK, 0.24));
  fill_ellipse(ctx, x, y, radius * 1.1, radius * 0.55, css(0x4f8a35));
  fill_ellipse(ctx, x - 0.2, y - 0.3, radius * 0.85, radius * 0.22, css(0xd9cf9a));
  line(ctx, x - radius * 0.9, y, x + radius * 0.9, y - 0.2, css(shade(0x4f8a35, 0.4), 0.7), 0.5);
}

/**
 * Black pepper crab: a whole crab with raised claws in a glossy black-pepper sauce, flecked
 * with cracked pepper.
 *
 * @param p - The motif paint.
 */
function paint_black_pepper_crab(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_liquid(ctx, area.x, area.y + 1, area.rx * 0.95, area.ry * 0.9, 0x4a2c1c, { sheen: 0.3 });
  paint_crab(ctx, area.x, area.y + 0.5, 15 * size, 0xb0442a);
  fill_ellipse(ctx, area.x, area.y + 1.5, 6 * size, 3 * size, css(0x3a2216, 0.45));
  paint_dots(ctx, area.x, area.y, area.rx * 0.7, isLowDetail ? 6 : 14, 0.45, 0x1a1412, seed ^ 0x41);
  paint_gloss(ctx, area.x - 3 * size, area.y - 2 * size, 3 * size, 1.1, 0.5);
  if (p.remaining > 0.5) {
    const [cx, cy] = at(area, 0.75, 0.55);
    paint_chunk(ctx, cx, cy, 3.4, tint(0xb0442a, 0.1), 0.6, { gloss: 0.4 });
  }
  const [hx, hy] = at(area, -0.75, 0.55);
  paint_leaf(ctx, hx, hy, 3.6, 0.6, 0x4e9a3e);
  paint_cucumber(ctx, hx + 3, hy - 1, 1.8);
}

/** The grill and seafood motifs, keyed by dish ID without the `dish.` prefix. */
export const GRILL_MOTIFS: Readonly<Record<string, Motif>> = {
  "chicken-satay-set": paint_chicken_satay,
  "beef-satay-set": paint_beef_satay,
  "bbq-chicken-wings": paint_bbq_wings,
  "sambal-grilled-squid": paint_salted_egg_squid,
  "sambal-stingray": paint_sambal_stingray,
  "black-pepper-crab": paint_black_pepper_crab,
};
