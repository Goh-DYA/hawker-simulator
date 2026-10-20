/**
 * Grill and seafood motifs: chicken, beef and mutton satay, barbecued wings, sotong panggang
 * (grilled squid), sambal stingray, black pepper and chilli crab, ayam panggang and black
 * pepper steak. (Chicken chop and fish and chips paint the whole plate in their variant layer.)
 *
 * Satay lies as a row of skewers beside its peanut sauce, wings and squid lie on their platter
 * or leaf, the stingray and the quarter crab each fill their dish as one bold silhouette, and
 * the grilled chicken and the steak lie seared and glazed beside their rice or sides.
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
import { at, heap_scale, paint_in_layer, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  paint_chunk,
  paint_dots,
  paint_gloss,
  paint_leaf,
  paint_liquid,
  paint_rice_mound,
  paint_sauce_cup,
  paint_skewer,
  PEANUT,
  SAMBAL,
  WHITE,
} from "../parts";
import {
  paint_dollop,
  paint_drumstick,
  paint_greens,
  paint_grilled_cut,
  paint_lime_half,
  paint_scallions,
  paint_shreds,
  paint_slivers,
  paint_wing,
} from "../toppings";

/** The stingray wing's fan: the angles its ridges span, from east round towards the south. */
const STINGRAY_FAN = { start: 0.02, end: 1.2 } as const;
/** Sotong panggang's red spice paste and the char of the coals. */
const SQUID = { paste: 0xd0643a, char: 0x4a1e10 } as const;
/** Black pepper crab's cooked shell, its pale meat and its dark peppery sauce. */
const CRAB = { shell: 0xc04a28, meat: 0xf4e8d8, sauce: 0x4a2c1c } as const;
/** The pale, translucent cartilage comb left once the flesh is eaten off the wing. */
const STINGRAY_CARTILAGE = 0xeadcc0;
/** Chilli crab's thick red chilli gravy and the ribbons of egg stirred through it. */
const CHILLI_CRAB = { gravy: 0xd2502f, egg: 0xf8e08a } as const;

/**
 * Lays a set of satay: a row of skewers and the peanut sauce bowl, with cucumber, red onion and
 * ketupat rice cake when the set comes with sides.
 *
 * @param p - The motif paint.
 * @param meat - The glazed meat colour.
 * @param isCubed - True for square-cut beef or mutton, false for rounded chicken.
 * @param has_sides - False for a set served with its sauce alone.
 */
function paint_satay(p: MotifPaint, meat: number, isCubed: boolean, has_sides = true): void {
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
  if (!has_sides) return;
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
 * Mutton satay: dark, spiced square-cut mutton with its peanut gravy, the sauce alone beside it.
 *
 * @param p - The motif paint.
 */
function paint_mutton_satay(p: MotifPaint): void {
  paint_satay(p, 0x7a4a32, true, false);
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
 * Paints one charcoal-grilled squid: a tapering body tube scored in a cross-hatch, rubbed with
 * a red spice paste and charred along its edges, with its fins and a tuft of curled tentacles.
 *
 * @param ctx - The paint context.
 * @param x - Body centre x.
 * @param y - Body centre y.
 * @param length - Body length.
 * @param angle - Rotation in radians, the tentacles towards +x.
 */
function paint_grilled_squid(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  angle: number,
): void {
  const half = length / 2;
  const girth = length * 0.22;
  const trace_body = () => {
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.quadraticCurveTo(-half * 0.6, -girth * 1.1, half * 0.55, -girth);
    ctx.lineTo(half * 0.62, girth);
    ctx.quadraticCurveTo(-half * 0.6, girth * 1.1, -half, 0);
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineCap = "round";
  // The tentacles, curling back from the cut end.
  for (let arm = 0; arm < 5; arm += 1) {
    const offset = (arm - 2) * girth * 0.3;
    const curl = arm % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(half * 0.5, offset);
    ctx.bezierCurveTo(
      half * 0.8,
      offset * 1.4,
      half * 0.95,
      offset * 1.6 + curl * girth * 0.5,
      half * 0.8,
      offset * 1.8 + curl * girth * 0.7,
    );
    ctx.strokeStyle = css(SQUID.char);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.strokeStyle = css(SQUID.paste, 0.85);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  // The fins at the tip.
  fill_ellipse(ctx, -half * 0.82, 0, half * 0.24, girth * 1.25, css(shade(SQUID.paste, 0.15)));
  ctx.save();
  ctx.shadowBlur = 1.5;
  ctx.shadowOffsetX = 0.8;
  ctx.shadowOffsetY = 1.2;
  ctx.shadowColor = css(SHADOW_INK, 0.35);
  trace_body();
  ctx.fillStyle = linear_gradient(ctx, 0, -girth, 0, girth, [
    [0, tint(SQUID.paste, 0.25)],
    [0.55, SQUID.paste],
    [1, shade(SQUID.paste, 0.35)],
  ]);
  ctx.fill();
  ctx.restore();
  ctx.save();
  trace_body();
  ctx.clip();
  // The cross-hatch scoring, darkened by the coals.
  for (let cut = -4; cut <= 4; cut += 1) {
    const offset = cut * length * 0.1;
    line(ctx, offset - girth, -girth, offset + girth, girth, css(SQUID.char, 0.55), 0.45);
    line(ctx, offset - girth, girth, offset + girth, -girth, css(SQUID.char, 0.55), 0.45);
  }
  ctx.restore();
  trace_body();
  ctx.strokeStyle = css(SQUID.char, 0.8);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  paint_gloss(ctx, -half * 0.2, -girth * 0.45, half * 0.4, girth * 0.22, 0.45, 0);
  ctx.restore();
}

/**
 * Sotong panggang: two whole squid marinated in spice paste and grilled over charcoal until
 * scored and charred, on banana leaf with sliced shallot, a calamansi half and sambal.
 *
 * @param p - The motif paint.
 */
function paint_sotong_panggang(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const squid = pieces_left(2, p.remaining);
  // The second squid is eaten down to a shorter piece before it goes.
  const lengths = p.remaining < 0.5 ? [12] : p.remaining < 1 ? [17, 12] : [17, 17];
  for (let piece = 0; piece < squid; piece += 1) {
    const [x, y] = at(area, -0.12 + piece * 0.08, -0.32 + piece * 0.55);
    paint_grilled_squid(ctx, x, y, lengths[piece] ?? 12, -0.18 + piece * 0.12);
  }
  const [ox, oy] = at(area, 0.68, -0.55);
  paint_slivers(ctx, ox, oy, 2.6, isLowDetail ? 3 : 5, 0xb04a7a, seed ^ 0x21);
  const [lx, ly] = at(area, 0.75, 0.55);
  paint_lime_half(ctx, lx, ly, 2.6);
  const [sx, sy] = at(area, -0.75, 0.62);
  paint_dollop(ctx, sx, sy, 2.2, SAMBAL, seed ^ 0x22);
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
 * Paints the big claw of a crab: the swollen, cracked shell of the pincer with its two dark
 * tips, lying with its joint towards the body.
 *
 * @param ctx - The paint context.
 * @param x - Claw centre x.
 * @param y - Claw centre y.
 * @param size - Claw length.
 * @param angle - Rotation in radians, the pincer tips towards +x.
 */
function paint_crab_claw(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  angle: number,
): void {
  const rx = size * 0.38;
  const ry = size * 0.24;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineCap = "round";
  // The arm joint back towards the body.
  line(ctx, -rx * 1.6, ry * 0.3, -rx * 0.6, 0, css(shade(CRAB.shell, 0.15)), size * 0.16);
  // The two fingers of the pincer.
  line(ctx, rx * 0.6, -ry * 0.35, rx * 1.75, -ry * 0.5, css(CRAB.shell), size * 0.13);
  line(ctx, rx * 0.6, ry * 0.35, rx * 1.55, ry * 0.15, css(shade(CRAB.shell, 0.1)), size * 0.11);
  fill_ellipse(ctx, rx * 1.75, -ry * 0.5, size * 0.05, size * 0.05, css(0x1e120c));
  fill_ellipse(ctx, rx * 1.55, ry * 0.15, size * 0.045, size * 0.045, css(0x1e120c));
  fill_ellipse(ctx, 0.5, 0.8, rx, ry, css(SHADOW_INK, 0.24));
  fill_ellipse(
    ctx,
    0,
    0,
    rx,
    ry,
    radial_gradient(ctx, -rx * 0.35, -ry * 0.4, 0.3, rx * 1.2, [
      [0, tint(CRAB.shell, 0.35)],
      [0.7, CRAB.shell],
      [1, shade(CRAB.shell, 0.35)],
    ]),
  );
  // The crack in the shell where the meat shows.
  line(ctx, -rx * 0.3, ry * 0.2, rx * 0.4, ry * 0.45, css(CRAB.meat, 0.9), 0.8);
  paint_gloss(ctx, -rx * 0.3, -ry * 0.4, rx * 0.35, ry * 0.18, 0.5, 0);
  ctx.restore();
}

/**
 * Paints a quarter of a crab: one wedge of the shell and body with its walking legs fanned out
 * behind it, showing the pale meat along the cut.
 *
 * @param ctx - The paint context.
 * @param x - The body piece's cut corner x.
 * @param y - The body piece's cut corner y.
 * @param size - The piece's reach.
 */
function paint_quarter_crab(ctx: PaintContext, x: number, y: number, size: number): void {
  const rx = size * 0.85;
  const ry = size * 0.6;
  ctx.save();
  ctx.lineCap = "round";
  // The walking legs, jointed where they leave the shell's rim.
  for (let leg = 0; leg < 3; leg += 1) {
    const angle = Math.PI * (1.08 + leg * 0.16);
    const root_x = x + Math.cos(angle) * rx * 0.9;
    const root_y = y + Math.sin(angle) * ry * 0.9;
    const knee_x = root_x + Math.cos(angle) * size * 0.4;
    const knee_y = root_y + Math.sin(angle) * size * 0.3;
    line(ctx, root_x + 0.4, root_y + 0.7, knee_x + 0.4, knee_y + 0.7, css(SHADOW_INK, 0.22), 1.8);
    line(ctx, root_x, root_y, knee_x, knee_y, css(shade(CRAB.shell, 0.1)), 1.7);
    line(ctx, knee_x, knee_y, knee_x - 1.2, knee_y + 2.6, css(shade(CRAB.shell, 0.25)), 1.2);
  }
  // The shell wedge: a quarter ellipse whose straight edges are the cuts.
  const trace = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy);
    ctx.ellipse(x + dx, y + dy, rx, ry, 0, Math.PI, Math.PI * 1.5, false);
    ctx.closePath();
  };
  trace(0.6, 1.2);
  ctx.fillStyle = css(SHADOW_INK, 0.26);
  ctx.fill();
  // The pale meat showing along the cuts.
  trace(0.3, 1.1);
  ctx.fillStyle = css(CRAB.meat);
  ctx.fill();
  trace(-0.5, -0.4);
  ctx.fillStyle = radial_gradient(ctx, x - rx * 0.55, y - ry * 0.6, 0.3, rx, [
    [0, tint(CRAB.shell, 0.35)],
    [0.7, CRAB.shell],
    [1, shade(CRAB.shell, 0.35)],
  ]);
  ctx.fill();
  ctx.strokeStyle = css(shade(CRAB.shell, 0.45), 0.8);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - 0.5, y - 0.4, rx * 0.78, ry * 0.74, 0, Math.PI * 1.08, Math.PI * 1.42);
  ctx.strokeStyle = css(WHITE, 0.35);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();
}

/**
 * Black pepper crab: a quarter crab, a wedge of the body with its legs and the big claw
 * beside it, in a glossy black-pepper sauce flecked with cracked pepper and curry leaves.
 * Each eaten third takes the legs, then cracks into the body.
 *
 * @param p - The motif paint.
 */
function paint_black_pepper_crab(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_liquid(ctx, area.x, area.y + 1, area.rx * 0.95 * size, area.ry * 0.9 * size, CRAB.sauce, {
    sheen: 0.3,
  });
  if (p.remaining > 0.5) {
    const [bx, by] = at(area, 0.72, 0.42);
    paint_quarter_crab(ctx, bx, by, 15 * Math.max(0.85, size));
  } else {
    // Only cracked shell pieces with meat picked from them are left of the body.
    for (let shard = 0; shard < 2; shard += 1) {
      const [sx, sy] = at(area, 0.05 + shard * 0.35, -0.1 + shard * 0.2);
      paint_chunk(ctx, sx, sy, 3.6, CRAB.shell, 0.5 + shard, { radius: 1, gloss: 0.4 });
    }
  }
  const [cx, cy] = at(area, -0.42, 0.3);
  paint_crab_claw(ctx, cx, cy, 14, -0.35);
  paint_dots(ctx, area.x, area.y, area.rx * 0.7, isLowDetail ? 6 : 14, 0.45, 0x1a1412, seed ^ 0x41);
  paint_gloss(ctx, area.x - 3 * size, area.y - 2 * size, 3 * size, 1.1, 0.5);
  for (const [u, v, angle] of [
    [-0.7, -0.35, 0.6],
    [0.7, 0.55, -0.9],
  ] as const) {
    const [lx, ly] = at(area, u, v);
    paint_leaf(ctx, lx, ly, 3.6, angle, 0x2f6a2c);
  }
}

/**
 * Chilli crab: a quarter crab and its big claw in a thick red chilli gravy laced with ribbons
 * of egg. Each eaten third takes the legs, then cracks into the body.
 *
 * @param p - The motif paint.
 */
function paint_chilli_crab(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  paint_liquid(
    ctx,
    area.x,
    area.y + 1,
    area.rx * 0.95 * size,
    area.ry * 0.9 * size,
    CHILLI_CRAB.gravy,
    { sheen: 0.4, oil: isLowDetail ? 3 : 6, oilColour: 0xe8783a, seed: seed ^ 0x51 },
  );
  if (p.remaining > 0.5) {
    const [bx, by] = at(area, 0.72, 0.42);
    paint_quarter_crab(ctx, bx, by, 15 * Math.max(0.85, size));
  } else {
    for (let shard = 0; shard < 2; shard += 1) {
      const [sx, sy] = at(area, 0.05 + shard * 0.35, -0.1 + shard * 0.2);
      paint_chunk(ctx, sx, sy, 3.6, CRAB.shell, 0.5 + shard, { radius: 1, gloss: 0.4 });
    }
  }
  const [cx, cy] = at(area, -0.42, 0.3);
  paint_crab_claw(ctx, cx, cy, 14, -0.35);
  paint_shreds(
    ctx,
    area.x - 1,
    area.y + 1,
    area.rx * 0.7 * size,
    isLowDetail ? 7 : 14,
    CHILLI_CRAB.egg,
    seed ^ 0x52,
    2.8,
    0.75,
  );
  paint_scallions(ctx, area.x - 2, area.y - 2, area.rx * 0.4, isLowDetail ? 2 : 4, seed ^ 0x53);
}

/**
 * Ayam panggang: a chicken leg marinated in spice paste and grilled to a dark, glossy red
 * glaze with char stripes, lying over a mound of white rice.
 *
 * @param p - The motif paint.
 */
function paint_ayam_panggang(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [rx, ry] = at(area, -0.38, -0.12);
  paint_rice_mound(
    ctx,
    rx,
    ry,
    area.rx * 0.5 * size,
    area.ry * 0.62 * size,
    0xf6f1e4,
    seed,
    isLowDetail,
  );
  const [lx, ly] = at(area, 0.22, 0.12);
  const leg = 15 * Math.max(0.7, size);
  const angle = -0.35;
  paint_drumstick(ctx, lx, ly, leg, angle, 0x9a4a22);
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(angle);
  ctx.lineCap = "round";
  for (let stripe = 0; stripe < 3; stripe += 1) {
    const along = (-0.3 + stripe * 0.15) * leg;
    line(ctx, along - 0.8, -leg * 0.18, along + 0.8, leg * 0.18, css(0x3a1608, 0.75), 0.9);
  }
  ctx.restore();
  paint_gloss(ctx, lx - leg * 0.2, ly - leg * 0.12, leg * 0.16, 0.8, 0.55);
  const [gx, gy] = at(area, 0.62, -0.55);
  paint_leaf(ctx, gx, gy, 5, -0.4, 0x4f8a3a);
}

/**
 * Black pepper steak: a grilled beef steak on a sizzling hot plate with roast potato wedges and
 * vegetables, the black pepper sauce served on the side in its own cup.
 *
 * @param p - The motif paint.
 */
function paint_black_pepper_steak(p: MotifPaint): void {
  const { ctx, area, seed, isLowDetail } = p;
  const size = heap_scale(p.remaining);
  const [sx, sy] = at(area, -0.2, -0.05);
  paint_grilled_cut(ctx, sx, sy, 15 * size, 9.6 * size, -0.12, 0x5a3a2a, 4);
  const wedges = pieces_left(3, p.remaining);
  for (let wedge = 0; wedge < wedges; wedge += 1) {
    const [wx, wy] = at(area, -0.6 + wedge * 0.32, 0.62 - (wedge % 2) * 0.12);
    paint_chunk(ctx, wx, wy, 3.6, 0xe2b65c, 0.5 * wedge - 0.4, { radius: 1.4, gloss: 0.35 });
  }
  const [gx, gy] = at(area, 0.62, 0.42);
  paint_greens(ctx, gx, gy, 7, -2.6, 0x3f8a3a);
  paint_dots(ctx, gx - 1, gy - 1, 2, isLowDetail ? 2 : 4, 0.8, 0xe8782a, seed ^ 0x61);
  const [cx, cy] = at(area, 0.68, -0.5);
  paint_sauce_cup(ctx, cx, cy, 3.6, 0x3a2418);
  paint_dots(ctx, cx, cy - 0.2, 1.8, isLowDetail ? 3 : 6, 0.4, 0x0e0a08, seed ^ 0x62);
}

/** The grill and seafood motifs, keyed by dish ID without the `dish.` prefix. */
export const GRILL_MOTIFS: Readonly<Record<string, Motif>> = {
  "chicken-satay-set": paint_chicken_satay,
  "beef-satay-set": paint_beef_satay,
  "bbq-chicken-wings": paint_bbq_wings,
  "sambal-grilled-squid": paint_sotong_panggang,
  "sambal-stingray": paint_sambal_stingray,
  "black-pepper-crab": paint_black_pepper_crab,
  "mutton-satay-set": paint_mutton_satay,
  "chilli-crab": paint_chilli_crab,
  "ayam-panggang": paint_ayam_panggang,
  "black-pepper-steak": paint_black_pepper_steak,
  "chicken-chop": paint_in_layer,
  "fish-and-chips": paint_in_layer,
};
