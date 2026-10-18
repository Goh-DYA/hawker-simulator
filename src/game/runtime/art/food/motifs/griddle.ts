/**
 * Griddle and South Indian motifs: fried carrot cake, oyster omelette, roti prata, murtabak,
 * masala thosai, idli with sambar, vadai and popiah.
 *
 * Prata, murtabak, thosai and carrot cake paint only their side dishes here (the curry cup,
 * pickled onions or chutneys); their variant layers lay the bread or cake itself.
 */
import {
  css,
  fill_ellipse,
  fill_rounded_rect,
  linear_gradient,
  radial_gradient,
  seeded,
  shade,
  SHADOW_INK,
  TAU,
  tint,
  type PaintContext,
} from "../../canvas";
import { at, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  FLAT_RATIO,
  paint_dots,
  paint_fried_ring,
  paint_gloss,
  paint_herb_flecks,
  paint_leaf,
  paint_liquid,
  paint_sauce_cup,
  PORCELAIN,
  WHITE,
} from "../parts";
import { paint_dollop, paint_slivers } from "../toppings";

/** Fish curry, as served with prata and murtabak. */
const CURRY = 0xc8642a;
/** Coconut chutney. */
const COCONUT_CHUTNEY = 0xf2ecd6;
/** Sambar. */
const SAMBAR = 0xc8742e;
/** Curry leaf green. */
const CURRY_LEAF = 0x2f6a2c;
/** Orh luak's colours: the crisp browned crust, the set golden egg, its lit top and the starch. */
const OMELETTE = { crust: 0xa8621f, gold: 0xe6a63c, light: 0xf7d77a, starch: 0xf3e4bd } as const;

/**
 * Fried carrot cake's side: the chilli sauce dab at the plate's edge. The variant layer fries
 * the radish cake white or black.
 *
 * @param p - The motif paint.
 */
function paint_fried_carrot_cake(p: MotifPaint): void {
  const [x, y] = at(p.area, 0.82, 0.62);
  paint_dollop(p.ctx, x, y, 2.2, 0xd9472a, p.seed ^ 0x11);
}

/**
 * Traces the oyster omelette's ragged outline: one irregular spread whose edge wobbles at a few
 * seeded frequencies, with a wedge cut from the south (the diner's side) for the eaten share.
 *
 * @param ctx - The paint context.
 * @param x - Spread centre x.
 * @param y - Spread centre y.
 * @param rx - Spread horizontal radius.
 * @param ry - Spread vertical radius.
 * @param phases - Seeded phases of the edge's wobble.
 * @param gap - Half-angle of the eaten wedge, 0 for a whole omelette.
 */
function trace_omelette(
  ctx: PaintContext,
  x: number,
  y: number,
  rx: number,
  ry: number,
  phases: readonly number[],
  gap: number,
): void {
  const [first = 0, second = 0, third = 0] = phases;
  const start = Math.PI / 2 + gap;
  const sweep = TAU - gap * 2;
  const steps = 40;
  ctx.beginPath();
  if (gap > 0) ctx.moveTo(x, y + ry * 0.12);
  for (let step = 0; step <= steps; step += 1) {
    const angle = start + (sweep * step) / steps;
    const reach =
      1 +
      0.07 * Math.sin(3 * angle + first) +
      0.05 * Math.sin(5 * angle + second) +
      0.035 * Math.sin(11 * angle + third);
    const px = x + Math.cos(angle) * rx * reach;
    const py = y + Math.sin(angle) * ry * reach;
    if (step === 0 && gap === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Orh luak (oyster omelette): one irregular golden spread, crisp and lacy at its browned edge
 * with holes where the batter fried through, set with glossy starch and plump grey oysters, with
 * coriander and chilli sauce. Each eaten third cuts a wider wedge from the diner's side.
 *
 * @param p - The motif paint.
 */
function paint_oyster_omelette(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const next = seeded(seed);
  const phases = [next() * TAU, next() * TAU, next() * TAU];
  const gap = (1 - p.remaining) * Math.PI * 0.72;
  const x = area.x - 0.4;
  const y = area.y - 0.3;
  const rx = area.rx * 0.88;
  const ry = area.ry * 0.86;
  trace_omelette(ctx, x + 0.6, y + 1, rx, ry, phases, gap);
  ctx.fillStyle = css(SHADOW_INK, 0.22);
  ctx.fill();
  trace_omelette(ctx, x, y, rx, ry, phases, gap);
  ctx.fillStyle = css(OMELETTE.crust);
  ctx.fill();
  trace_omelette(ctx, x - 0.2, y - 0.3, rx * 0.88, ry * 0.86, phases, gap);
  ctx.fillStyle = radial_gradient(ctx, x - rx * 0.3, y - ry * 0.35, 0.5, rx * 1.1, [
    [0, OMELETTE.light],
    [0.6, OMELETTE.gold],
    [1, shade(OMELETTE.gold, 0.18)],
  ]);
  ctx.fill();
  // Lacy holes in the crisp rim, where the plate shows through, outside the eaten wedge.
  const holes = isLowDetail ? 5 : 10;
  for (let hole = 0; hole < holes; hole += 1) {
    const angle = next() * TAU;
    const reach = 0.74 + next() * 0.16;
    const size = 0.55 + next() * 0.6;
    const fromSouth = Math.abs(
      Math.atan2(Math.sin(angle - Math.PI / 2), Math.cos(angle - Math.PI / 2)),
    );
    if (fromSouth < gap + 0.25) continue;
    const hx = x + Math.cos(angle) * rx * reach;
    const hy = y + Math.sin(angle) * ry * reach;
    fill_ellipse(ctx, hx, hy, size * 1.3, size, css(OMELETTE.crust));
    fill_ellipse(ctx, hx + 0.15, hy + 0.15, size * 0.95, size * 0.7, css(shade(PORCELAIN, 0.04)));
  }
  // The browned lace and the glossy starch stay on the omelette, clear of the eaten wedge.
  ctx.save();
  trace_omelette(ctx, x - 0.2, y - 0.3, rx * 0.88, ry * 0.86, phases, gap);
  ctx.clip();
  for (let patch = 0; patch < (isLowDetail ? 3 : 6); patch += 1) {
    const [bx, by] = at(area, (next() - 0.5) * 1.3, (next() - 0.6) * 1.1);
    fill_ellipse(ctx, bx, by, 1 + next() * 1.1, 0.6 + next() * 0.5, css(OMELETTE.crust, 0.45));
  }
  for (let patch = 0; patch < (isLowDetail ? 2 : 4); patch += 1) {
    const [sx, sy] = at(area, (next() - 0.5) * 1, (next() - 0.7) * 0.8);
    fill_ellipse(ctx, sx, sy, 2.4, 1.5, css(OMELETTE.starch, 0.6));
    fill_ellipse(ctx, sx - 0.6, sy - 0.4, 1, 0.35, css(WHITE, 0.7));
  }
  ctx.restore();
  const oysters = pieces_left(4, p.remaining);
  for (let oyster = 0; oyster < oysters; oyster += 1) {
    const [ox, oy] = at(area, -0.45 + oyster * 0.3, oyster % 2 ? -0.05 : -0.42);
    fill_ellipse(ctx, ox + 0.4, oy + 0.6, 2.4, 1.7, css(SHADOW_INK, 0.24));
    fill_ellipse(ctx, ox, oy, 2.4, 1.7, css(0x6b625a));
    fill_ellipse(
      ctx,
      ox - 0.2,
      oy - 0.2,
      1.9,
      1.3,
      radial_gradient(ctx, ox - 0.6, oy - 0.5, 0.1, 2, [
        [0, 0xf0e6d6],
        [1, 0xb3a593],
      ]),
    );
  }
  for (const [u, v] of [
    [-0.15, -0.55],
    [0.45, -0.2],
  ] as const) {
    const [lx, ly] = at(area, u, v);
    paint_leaf(ctx, lx, ly, 3.6, u * 3, 0x4e9a3e);
  }
  const [cx, cy] = at(area, 0.85, 0.6);
  paint_dollop(ctx, cx, cy, 2.2, 0xe0502e, seed ^ 0x21);
}

/**
 * Roti prata's side: a bowl of fish curry. The variant layer lays the prata.
 *
 * @param p - The motif paint.
 */
function paint_roti_prata(p: MotifPaint): void {
  const [x, y] = at(p.area, 0.62, -0.5);
  paint_sauce_cup(p.ctx, x, y, 4.6, CURRY);
}

/**
 * Murtabak's sides on the platter: the curry bowl and a heap of pickled red onion. The variant
 * layer lays the cut squares.
 *
 * @param p - The motif paint.
 */
function paint_chicken_murtabak(p: MotifPaint): void {
  const { ctx, area, seed } = p;
  const [cx, cy] = at(area, 0.72, -0.45);
  paint_sauce_cup(ctx, cx, cy, 4.2, CURRY);
  const [ox, oy] = at(area, 0.78, 0.5);
  paint_slivers(ctx, ox, oy, 2.4, p.isLowDetail ? 3 : 6, 0xc04a78, seed ^ 0x31);
  paint_slivers(ctx, ox - 1, oy + 1, 2, 2, 0x8fbf5a, seed ^ 0x32);
}

/**
 * Masala thosai's sides: coconut chutney and sambar in small cups. The variant layer lays the
 * thosai.
 *
 * @param p - The motif paint.
 */
function paint_masala_thosai(p: MotifPaint): void {
  const { ctx, area } = p;
  const [lx, ly] = at(area, -0.65, -0.62);
  paint_sauce_cup(ctx, lx, ly, 3.6, COCONUT_CHUTNEY);
  const [rx, ry] = at(area, -0.05, -0.75);
  paint_sauce_cup(ctx, rx, ry, 3.6, SAMBAR);
}

/**
 * Paints a steamed idli: a soft white dome with a faint pitted surface.
 *
 * @param ctx - The paint context.
 * @param x - Idli centre x.
 * @param y - Idli centre y.
 * @param radius - Idli radius.
 */
function paint_idli(ctx: MotifPaint["ctx"], x: number, y: number, radius: number): void {
  const ry = radius * FLAT_RATIO;
  fill_ellipse(ctx, x + 0.6, y + 1.2, radius, ry, css(SHADOW_INK, 0.25));
  fill_ellipse(ctx, x, y + 0.9, radius, ry, css(0xd9d0bc));
  fill_ellipse(
    ctx,
    x,
    y,
    radius,
    ry,
    radial_gradient(ctx, x - radius * 0.35, y - ry * 0.4, 0.2, radius * 1.2, [
      [0, WHITE],
      [0.6, 0xf3efe2],
      [1, 0xd8d0be],
    ]),
  );
  paint_gloss(ctx, x - radius * 0.3, y - ry * 0.35, radius * 0.3, ry * 0.18, 0.5);
}

/**
 * Idli sambar: three steamed rice cakes half in a pool of sambar, with coconut chutney and
 * curry leaf.
 *
 * @param p - The motif paint.
 */
function paint_idli_sambar(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const [px, py] = at(area, 0.1, 0.2);
  paint_liquid(ctx, px, py, area.rx * 0.8, area.ry * 0.62, SAMBAR, {
    sheen: 0.25,
    oil: isLowDetail ? 2 : 5,
    oilColour: 0xe8a050,
    seed,
  });
  paint_herb_flecks(ctx, px, py, area.rx * 0.5, isLowDetail ? 2 : 4, 0xe08a3a, seed ^ 0x41, 2);
  const spots: ReadonlyArray<readonly [number, number]> = [
    [-0.4, -0.3],
    [0.3, -0.35],
    [-0.05, 0.2],
  ];
  const shown = pieces_left(spots.length, p.remaining);
  for (const [u, v] of spots.slice(0, shown)) {
    const [x, y] = at(area, u, v);
    paint_idli(ctx, x, y, 4.4);
  }
  const [cx, cy] = at(area, 0.7, 0.45);
  paint_dollop(ctx, cx, cy, 2.6, COCONUT_CHUTNEY, seed ^ 0x42);
  paint_herb_flecks(ctx, cx, cy, 1.6, 2, CURRY_LEAF, seed ^ 0x43, 1.4);
  const [lx, ly] = at(area, -0.72, 0.5);
  paint_leaf(ctx, lx, ly, 4, 0.5, CURRY_LEAF);
}

/**
 * Vadai: two crisp lentil doughnuts with sambar and coconut chutney cups and a curry leaf.
 *
 * @param p - The motif paint.
 */
function paint_vadai_set(p: MotifPaint): void {
  const { ctx, area, seed } = p;
  const [sx, sy] = at(area, 0.62, -0.5);
  paint_sauce_cup(ctx, sx, sy, 3.6, SAMBAR);
  const [cx, cy] = at(area, 0.72, 0.45);
  paint_sauce_cup(ctx, cx, cy, 3.4, COCONUT_CHUTNEY);
  const rings = pieces_left(2, p.remaining);
  // The last vadai shrinks as it is eaten down, leaving crumbs.
  const ring_size = p.remaining < 0.5 ? 0.78 : 1;
  for (let ring = 0; ring < rings; ring += 1) {
    const [x, y] = at(area, -0.45 + ring * 0.45, -0.15 + ring * 0.35);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(ring_size, FLAT_RATIO * ring_size);
    fill_ellipse(
      ctx,
      0,
      0,
      5,
      5,
      radial_gradient(ctx, -1.5, -1.5, 0.5, 5.5, [
        [0, 0xd99a4a],
        [0.7, 0xb06a2a],
        [1, 0x7a4418],
      ]),
    );
    ctx.restore();
    paint_fried_ring(ctx, x, y, 3.3 * ring_size, 3.2 * ring_size, 0xb8722e, seed ^ ring);
    fill_ellipse(ctx, x, y, 1.2 * ring_size, ring_size, css(shade(0xf6efe0, 0.15)));
  }
  if (p.remaining < 1) {
    const [bx, by] = at(area, 0.05, 0.35);
    paint_dots(ctx, bx, by, 2.4, 4, 0.6, 0xb06a2a, seed ^ 0x45);
  }
  const [lx, ly] = at(area, -0.6, 0.55);
  paint_leaf(ctx, lx, ly, 4.2, 0.4, CURRY_LEAF);
}

/**
 * Paints one popiah roll lying north to south: a soft white wrapper whose cut south end shows
 * the turnip, carrot, egg and lettuce filling.
 *
 * @param ctx - The paint context.
 * @param x - Roll centre x.
 * @param y - Roll centre y.
 * @param length - Roll length.
 * @param angle - Tilt in radians.
 */
function paint_popiah_roll(
  ctx: MotifPaint["ctx"],
  x: number,
  y: number,
  length: number,
  angle: number,
): void {
  const wrapper = 0xf1e8d4;
  const radius = 3.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_rounded_rect(
    ctx,
    -radius + 1,
    -length / 2 + 1.5,
    radius * 2,
    length,
    radius,
    css(SHADOW_INK, 0.24),
  );
  fill_rounded_rect(
    ctx,
    -radius,
    -length / 2,
    radius * 2,
    length,
    radius,
    linear_gradient(ctx, -radius, 0, radius, 0, [
      [0, tint(wrapper, 0.5)],
      [0.45, wrapper],
      [1, shade(wrapper, 0.25)],
    ]),
  );
  const end = length / 2 - radius * 0.7;
  fill_ellipse(ctx, 0, end, radius * 0.95, radius * 0.72, css(0xa8885a));
  fill_ellipse(ctx, -0.6, end - 0.3, radius * 0.6, radius * 0.4, css(0xd7bf86));
  fill_ellipse(ctx, 1.2, end + 0.4, 0.9, 0.6, css(0xe07a2a));
  fill_ellipse(ctx, -1.4, end + 0.6, 0.8, 0.5, css(0xf0c53e));
  fill_ellipse(ctx, 1.4, end - 0.9, 0.9, 0.5, css(0x5e9e3e));
  fill_rounded_rect(
    ctx,
    -radius * 0.55,
    -length / 2 + 1,
    radius * 0.5,
    length - 4,
    1,
    css(WHITE, 0.35),
  );
  ctx.restore();
}

/**
 * Popiah: a fresh spring roll cut in two, with braised turnip, carrot, egg and lettuce showing
 * at the cut, and a smear of sweet sauce and chilli.
 *
 * @param p - The motif paint.
 */
function paint_popiah(p: MotifPaint): void {
  const { ctx, area, seed } = p;
  const [sx, sy] = at(area, 0.7, -0.45);
  paint_dollop(ctx, sx, sy, 2, 0x5a3220, seed ^ 0x51);
  paint_dollop(ctx, sx + 1, sy + 4, 1.6, 0xd9472a, seed ^ 0x52);
  const [lx, ly] = at(area, -0.15, 0.05);
  paint_leaf(ctx, lx, ly, area.rx * 1.5, -0.2, 0x8fbf5a);
  const rolls = pieces_left(2, p.remaining);
  for (let roll = 0; roll < rolls; roll += 1) {
    const [x, y] = at(area, -0.4 + roll * 0.5, -0.05 + roll * 0.08);
    paint_popiah_roll(ctx, x, y, p.remaining < 0.5 ? 9 : 14, -0.25 + roll * 0.12);
  }
}

/** The griddle and South Indian motifs, keyed by dish ID without the `dish.` prefix. */
export const GRIDDLE_MOTIFS: Readonly<Record<string, Motif>> = {
  "fried-carrot-cake": paint_fried_carrot_cake,
  "oyster-omelette": paint_oyster_omelette,
  "roti-prata": paint_roti_prata,
  "chicken-murtabak": paint_chicken_murtabak,
  "masala-thosai": paint_masala_thosai,
  "idli-sambar": paint_idli_sambar,
  "vadai-set": paint_vadai_set,
  popiah: paint_popiah,
};
