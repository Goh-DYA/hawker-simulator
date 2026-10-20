/**
 * More ingredient primitives for the dish motifs, alongside `parts.ts`: shreds and bean sprouts,
 * leafy greens, scallion rings, sambal dollops, fish cake and sausage slices, mushrooms, tofu
 * puffs, chicken wings and drumsticks, small fried fish, dough-fritter slices and sticks,
 * calamansi halves, shaved-ice mounds and spoons.
 *
 * Each is a pure Canvas 2D painter in world pixels, lit from the north-west with a small cast
 * shadow to the south-east, and flat round things are foreshortened by `FLAT_RATIO` so they lie
 * on the dish in the 3/4 view.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  line,
  linear_gradient,
  radial_gradient,
  seeded,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  TAU,
  tint,
  type PaintContext,
} from "../canvas";
import { FLAT_RATIO, paint_gloss, WHITE } from "./parts";

/**
 * A row of chopped chicken or duck: each piece's skin top (width and foreshortened length),
 * the spacing that overlaps neighbours, the thin cut edge showing east and south of it, and
 * the lean of the first piece in radians.
 */
const SLICE_ROW = { width: 4, length: 6.8, step: 2.7, face: 0.8, lean: -0.42 } as const;

/**
 * Scatters short curved strips: shredded chicken, ginger julienne, egg ribbons or onion.
 *
 * @param ctx - The paint context.
 * @param x - Scatter centre x.
 * @param y - Scatter centre y.
 * @param radius - Scatter radius.
 * @param count - Number of strips.
 * @param colourValue - The strip colour.
 * @param seed - Position seed.
 * @param length - Strip length.
 * @param width - Strip width.
 */
export function paint_shreds(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  count: number,
  colourValue: number,
  seed: number,
  length = 4,
  width = 1.1,
): void {
  const next = seeded(seed);
  ctx.save();
  ctx.lineCap = "round";
  for (let strip = 0; strip < count; strip += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radius;
    const sx = x + Math.cos(angle) * distance;
    const sy = y + Math.sin(angle) * distance * FLAT_RATIO;
    const heading = next() * Math.PI;
    const dx = Math.cos(heading) * length * 0.5;
    const dy = Math.sin(heading) * length * 0.5 * FLAT_RATIO;
    const bend = (next() - 0.5) * length * 0.5;
    const trace = (offset: number) => {
      ctx.beginPath();
      ctx.moveTo(sx - dx + offset, sy - dy + offset);
      ctx.quadraticCurveTo(
        sx + bend + offset,
        sy - bend + offset,
        sx + dx + offset,
        sy + dy + offset,
      );
      ctx.stroke();
    };
    ctx.strokeStyle = css(SHADOW_INK, 0.2);
    ctx.lineWidth = width;
    trace(0.5);
    ctx.strokeStyle = css(strip % 3 === 0 ? tint(colourValue, 0.3) : colourValue);
    trace(0);
  }
  ctx.restore();
}

/**
 * Scatters bean sprouts: pale translucent stems, each with a small yellow head.
 *
 * @param ctx - The paint context.
 * @param x - Scatter centre x.
 * @param y - Scatter centre y.
 * @param radius - Scatter radius.
 * @param count - Number of sprouts.
 * @param seed - Position seed.
 */
export function paint_sprouts(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  count: number,
  seed: number,
): void {
  paint_shreds(ctx, x, y, radius, count, 0xf3efd8, seed, 4.6, 1);
  const next = seeded(seed ^ 0x51);
  for (let head = 0; head < Math.ceil(count / 2); head += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radius;
    fill_circle(
      ctx,
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance * FLAT_RATIO,
      0.65,
      css(0xe9d77a),
    );
  }
}

/**
 * Paints a piece of leafy green (choy sum, bok choy, lettuce): a pale stalk running into a
 * ruffled dark leaf.
 *
 * @param ctx - The paint context.
 * @param x - Piece centre x.
 * @param y - Piece centre y.
 * @param length - Stalk-to-tip length.
 * @param angle - Rotation in radians.
 * @param colourValue - The leaf colour.
 */
export function paint_greens(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  angle: number,
  colourValue = 0x4c8a3c,
): void {
  const half = length / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, FLAT_RATIO + 0.1);
  fill_ellipse(ctx, 0.6, 0.9, half, length * 0.26, css(SHADOW_INK, 0.2));
  fill_rounded_rect(ctx, -half, -length * 0.07, length * 0.55, length * 0.14, 1, css(0xd5e3b0));
  ctx.beginPath();
  ctx.moveTo(-length * 0.05, 0);
  ctx.bezierCurveTo(length * 0.05, -length * 0.36, half, -length * 0.3, half, 0);
  ctx.bezierCurveTo(half, length * 0.3, length * 0.05, length * 0.36, -length * 0.05, 0);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, 0, -length * 0.3, half, length * 0.3, [
    [0, tint(colourValue, 0.25)],
    [1, shade(colourValue, 0.3)],
  ]);
  ctx.fill();
  line(ctx, -length * 0.05, 0, half * 0.85, 0, css(tint(colourValue, 0.55), 0.8), 0.6);
  ctx.restore();
}

/**
 * Scatters sliced spring onion: small green rings with pale centres.
 *
 * @param ctx - The paint context.
 * @param x - Scatter centre x.
 * @param y - Scatter centre y.
 * @param radius - Scatter radius.
 * @param count - Number of rings.
 * @param seed - Position seed.
 * @param colourValue - The ring colour.
 */
export function paint_scallions(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  count: number,
  seed: number,
  colourValue = 0x5fa04e,
): void {
  const next = seeded(seed);
  for (let ring = 0; ring < count; ring += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radius;
    const rx = x + Math.cos(angle) * distance;
    const ry = y + Math.sin(angle) * distance * FLAT_RATIO;
    fill_ellipse(ctx, rx + 0.3, ry + 0.4, 0.95, 0.75, css(SHADOW_INK, 0.2));
    stroke_ellipse(
      ctx,
      rx,
      ry,
      0.8,
      0.62,
      css(ring % 2 ? tint(colourValue, 0.35) : colourValue),
      0.75,
    );
  }
}

/**
 * Paints a glossy dollop of thick sauce (sambal, chilli paste, curry): overlapping lobes with a
 * darker rim and a wet highlight.
 *
 * @param ctx - The paint context.
 * @param x - Dollop centre x.
 * @param y - Dollop centre y.
 * @param radius - Dollop radius.
 * @param colourValue - The sauce colour.
 * @param seed - Lobe seed.
 */
export function paint_dollop(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  colourValue: number,
  seed: number,
): void {
  const next = seeded(seed);
  const lobes: [number, number, number][] = [[0, 0, radius]];
  for (let lobe = 0; lobe < 3; lobe += 1) {
    const angle = next() * TAU;
    lobes.push([
      Math.cos(angle) * radius * 0.5,
      Math.sin(angle) * radius * 0.4,
      radius * (0.5 + next() * 0.25),
    ]);
  }
  for (const [dx, dy, r] of lobes) {
    fill_ellipse(ctx, x + dx + 0.5, y + dy + 0.8, r, r * FLAT_RATIO, css(SHADOW_INK, 0.22));
  }
  for (const [dx, dy, r] of lobes) {
    fill_ellipse(
      ctx,
      x + dx,
      y + dy,
      r,
      r * FLAT_RATIO,
      radial_gradient(ctx, x + dx - r * 0.3, y + dy - r * 0.35, 0.2, r * 1.2, [
        [0, tint(colourValue, 0.25)],
        [0.6, colourValue],
        [1, shade(colourValue, 0.35)],
      ]),
    );
  }
  paint_gloss(ctx, x - radius * 0.3, y - radius * 0.32, radius * 0.32, radius * 0.16, 0.55);
}

/**
 * Paints a fish cake slice: a flat white round with a pink-tinged or browned edge.
 *
 * @param ctx - The paint context.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param radius - Slice radius.
 * @param edge - The edge colour (pink for steamed, brown for fried).
 */
export function paint_fish_cake(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  edge = 0xe7909b,
): void {
  const ry = radius * FLAT_RATIO;
  fill_ellipse(ctx, x + 0.4, y + 0.8, radius, ry, css(SHADOW_INK, 0.22));
  fill_ellipse(ctx, x, y + 0.5, radius, ry, css(shade(edge, 0.2)));
  fill_ellipse(ctx, x, y, radius, ry, css(edge));
  fill_ellipse(
    ctx,
    x,
    y,
    radius * 0.82,
    ry * 0.82,
    radial_gradient(ctx, x - radius * 0.3, y - ry * 0.3, 0.2, radius, [
      [0, WHITE],
      [1, 0xeee4d2],
    ]),
  );
}

/**
 * Paints a slice of Chinese sausage (lap cheong): a red-brown round flecked with fat.
 *
 * @param ctx - The paint context.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param radius - Slice radius.
 * @param angle - Tilt in radians (sausage is cut on the bias).
 */
export function paint_sausage_slice(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  angle = 0.3,
): void {
  const sausage = 0xb23a3a;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0.4, 0.8, radius * 1.3, radius * FLAT_RATIO, css(SHADOW_INK, 0.22));
  fill_ellipse(ctx, 0, 0.5, radius * 1.3, radius * FLAT_RATIO, css(shade(sausage, 0.4)));
  fill_ellipse(
    ctx,
    0,
    0,
    radius * 1.3,
    radius * FLAT_RATIO,
    radial_gradient(ctx, -radius * 0.4, -radius * 0.3, 0.2, radius * 1.4, [
      [0, tint(sausage, 0.25)],
      [1, shade(sausage, 0.2)],
    ]),
  );
  for (const [dx, dy] of [
    [-0.5, -0.2],
    [0.3, 0.25],
    [0.55, -0.3],
    [-0.1, 0.35],
  ] as const) {
    fill_circle(ctx, dx * radius, dy * radius, radius * 0.16, css(0xf3d9c8));
  }
  ctx.restore();
}

/**
 * Paints a shiitake mushroom cap: a domed brown cap with a pale cross cut.
 *
 * @param ctx - The paint context.
 * @param x - Cap centre x.
 * @param y - Cap centre y.
 * @param radius - Cap radius.
 */
export function paint_mushroom(ctx: PaintContext, x: number, y: number, radius: number): void {
  const cap = 0x5b3a26;
  fill_ellipse(ctx, x + 0.5, y + 0.9, radius, radius * FLAT_RATIO, css(SHADOW_INK, 0.25));
  fill_ellipse(
    ctx,
    x,
    y,
    radius,
    radius * FLAT_RATIO,
    radial_gradient(ctx, x - radius * 0.35, y - radius * 0.35, 0.2, radius * 1.2, [
      [0, tint(cap, 0.35)],
      [0.65, cap],
      [1, shade(cap, 0.35)],
    ]),
  );
  line(
    ctx,
    x - radius * 0.45,
    y - radius * 0.3,
    x + radius * 0.45,
    y + radius * 0.3,
    css(0xd8c3a0, 0.85),
    0.6,
  );
  line(
    ctx,
    x - radius * 0.45,
    y + radius * 0.3,
    x + radius * 0.45,
    y - radius * 0.3,
    css(0xd8c3a0, 0.85),
    0.6,
  );
  fill_ellipse(
    ctx,
    x - radius * 0.35,
    y - radius * 0.35,
    radius * 0.25,
    radius * 0.12,
    css(WHITE, 0.35),
  );
}

/**
 * Paints a fried tofu puff (tau pok): a puffy golden cube with a spongy, darker crust.
 *
 * @param ctx - The paint context.
 * @param x - Puff centre x.
 * @param y - Puff centre y.
 * @param size - Puff side length.
 * @param colourValue - The crust colour.
 * @param seed - Pore seed.
 */
export function paint_tofu_puff(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  colourValue = 0xd59a43,
  seed = 7,
): void {
  const half = size / 2;
  fill_rounded_rect(
    ctx,
    x - half + 0.6,
    y - half + 1,
    size,
    size,
    size * 0.3,
    css(SHADOW_INK, 0.24),
  );
  fill_rounded_rect(
    ctx,
    x - half,
    y - half + size * 0.25,
    size,
    size * 0.85,
    size * 0.3,
    css(shade(colourValue, 0.3)),
  );
  fill_rounded_rect(
    ctx,
    x - half,
    y - half,
    size,
    size * 0.85,
    size * 0.3,
    radial_gradient(ctx, x - half * 0.4, y - half * 0.5, 0.2, size, [
      [0, tint(colourValue, 0.35)],
      [0.7, colourValue],
      [1, shade(colourValue, 0.2)],
    ]),
  );
  const next = seeded(seed);
  for (let pore = 0; pore < 4; pore += 1) {
    fill_circle(
      ctx,
      x + (next() - 0.5) * size * 0.7,
      y + (next() - 0.5) * size * 0.6,
      size * 0.07,
      css(shade(colourValue, 0.35), 0.7),
    );
  }
}

/**
 * Paints a chicken wing: a drumette and a flat joined at an angle, with glazed skin.
 *
 * @param ctx - The paint context.
 * @param x - Wing centre x.
 * @param y - Wing centre y.
 * @param size - Wing length.
 * @param angle - Rotation in radians.
 * @param colourValue - The skin colour.
 */
export function paint_wing(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  angle: number,
  colourValue: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const skin = (cx: number, cy: number, rx: number, ry: number) =>
    radial_gradient(ctx, cx - rx * 0.3, cy - ry * 0.45, 0.2, rx * 1.2, [
      [0, tint(colourValue, 0.4)],
      [0.55, colourValue],
      [1, shade(colourValue, 0.35)],
    ]);
  fill_ellipse(ctx, 0.7, 1.1, size * 0.5, size * 0.27, css(SHADOW_INK, 0.24));
  // The flat: a broad oval with a tip.
  fill_ellipse(
    ctx,
    size * 0.15,
    0,
    size * 0.32,
    size * 0.2,
    skin(size * 0.15, 0, size * 0.32, size * 0.2),
  );
  fill_ellipse(
    ctx,
    size * 0.45,
    size * 0.06,
    size * 0.1,
    size * 0.08,
    css(shade(colourValue, 0.15)),
  );
  // The drumette: a club with a knuckle.
  ctx.save();
  ctx.rotate(-0.5);
  fill_ellipse(
    ctx,
    -size * 0.25,
    -size * 0.04,
    size * 0.24,
    size * 0.15,
    skin(-size * 0.25, -size * 0.04, size * 0.24, size * 0.15),
  );
  fill_circle(ctx, -size * 0.47, -size * 0.04, size * 0.08, css(tint(colourValue, 0.2)));
  ctx.restore();
  fill_circle(ctx, size * 0.02, size * 0.03, size * 0.07, css(shade(colourValue, 0.4), 0.5));
  paint_gloss(ctx, size * 0.08, -size * 0.08, size * 0.12, size * 0.04, 0.55, -0.1);
  ctx.restore();
}

/**
 * Paints a chicken leg: a plump curry- or skin-coated thigh with the bone end showing.
 *
 * @param ctx - The paint context.
 * @param x - Leg centre x.
 * @param y - Leg centre y.
 * @param size - Leg length.
 * @param angle - Rotation in radians.
 * @param colourValue - The coating colour.
 */
export function paint_drumstick(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  angle: number,
  colourValue: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0.8, 1.2, size * 0.42, size * 0.3, css(SHADOW_INK, 0.26));
  line(ctx, size * 0.2, 0, size * 0.48, -size * 0.02, css(0xefe3cc), size * 0.13);
  fill_circle(ctx, size * 0.5, -size * 0.03, size * 0.08, css(0xf6eedf));
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, 0);
  ctx.bezierCurveTo(
    -size * 0.42,
    -size * 0.3,
    -size * 0.05,
    -size * 0.32,
    size * 0.24,
    -size * 0.07,
  );
  ctx.lineTo(size * 0.24, size * 0.07);
  ctx.bezierCurveTo(-size * 0.05, size * 0.32, -size * 0.42, size * 0.3, -size * 0.42, 0);
  ctx.closePath();
  ctx.fillStyle = radial_gradient(ctx, -size * 0.2, -size * 0.12, 0.2, size * 0.5, [
    [0, tint(colourValue, 0.35)],
    [0.6, colourValue],
    [1, shade(colourValue, 0.4)],
  ]);
  ctx.fill();
  paint_gloss(ctx, -size * 0.18, -size * 0.12, size * 0.14, size * 0.05, 0.5, -0.2);
  ctx.restore();
}

/**
 * Paints a small whole fried fish (ikan kuning style): a golden body, a forked tail and an eye.
 *
 * @param ctx - The paint context.
 * @param x - Body centre x.
 * @param y - Body centre y.
 * @param length - Nose-to-tail length.
 * @param angle - Rotation in radians.
 * @param colourValue - The fried skin colour.
 */
export function paint_fried_fish(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  angle: number,
  colourValue: number,
): void {
  const half = length / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0.6, 1, half * 0.85, length * 0.2, css(SHADOW_INK, 0.24));
  fill_polygon(
    ctx,
    [
      [half * 0.55, 0],
      [half, -length * 0.17],
      [half * 0.9, 0],
      [half, length * 0.17],
    ],
    css(shade(colourValue, 0.2)),
  );
  fill_ellipse(
    ctx,
    -half * 0.08,
    0,
    half * 0.72,
    length * 0.18,
    linear_gradient(ctx, 0, -length * 0.18, 0, length * 0.18, [
      [0, tint(colourValue, 0.3)],
      [0.6, colourValue],
      [1, shade(colourValue, 0.35)],
    ]),
  );
  for (let score = 0; score < 3; score += 1) {
    const sx = -half * 0.25 + score * half * 0.22;
    line(
      ctx,
      sx,
      -length * 0.12,
      sx + length * 0.04,
      length * 0.1,
      css(shade(colourValue, 0.45), 0.7),
      0.55,
    );
  }
  fill_circle(ctx, -half * 0.6, -length * 0.03, length * 0.035, css(0x263238));
  paint_gloss(ctx, -half * 0.15, -length * 0.09, half * 0.3, length * 0.03, 0.5, 0);
  ctx.restore();
}

/**
 * Paints slices of fried dough fritter (you tiao): puffy golden twin rounds.
 *
 * @param ctx - The paint context.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param size - Slice width.
 */
export function paint_youtiao(ctx: PaintContext, x: number, y: number, size: number): void {
  const dough = 0xd9963c;
  for (const offset of [-0.22, 0.22]) {
    const cx = x + offset * size;
    fill_ellipse(ctx, cx + 0.5, y + 0.9, size * 0.3, size * 0.24, css(SHADOW_INK, 0.22));
    fill_ellipse(
      ctx,
      cx,
      y,
      size * 0.3,
      size * 0.26,
      radial_gradient(ctx, cx - size * 0.1, y - size * 0.1, 0.2, size * 0.34, [
        [0, 0xf3d79a],
        [0.6, dough],
        [1, shade(dough, 0.3)],
      ]),
    );
    fill_ellipse(ctx, cx, y, size * 0.13, size * 0.1, css(0xf6e3b8));
  }
}

/** You tiao dough: golden brown, with its pale crumb and the lit crust it fades to. */
const YOUTIAO = { dough: 0xd9963c, crumb: 0xf6e3b8, lit: 0xf3d79a } as const;

/** Where the blisters sit on a you tiao stick: along its length (-1 to 1) and across it. */
const YOUTIAO_BLISTERS: ReadonlyArray<readonly [number, number]> = [
  [-0.5, -1.1],
  [-0.1, 1.1],
  [0.35, -0.9],
  [0.62, 0.9],
];

/**
 * Paints a length of you tiao: two golden dough sticks joined along a pale seam, lying at an
 * angle, with a few blistered bubbles on the crust.
 *
 * @param ctx - The paint context.
 * @param x - Stick centre x.
 * @param y - Stick centre y.
 * @param length - Stick length.
 * @param angle - Rotation in radians.
 * @param isLowDetail - True to skip the blisters.
 */
export function paint_youtiao_stick(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  angle: number,
  isLowDetail: boolean,
): void {
  const half = length / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0.6, 1.8, half, 2.1, css(SHADOW_INK, 0.22));
  for (const offset of [-0.95, 0.95]) {
    fill_ellipse(
      ctx,
      0,
      offset,
      half,
      1.25,
      radial_gradient(ctx, -half * 0.3, offset - 0.6, 0.2, half, [
        [0, YOUTIAO.lit],
        [0.55, YOUTIAO.dough],
        [1, shade(YOUTIAO.dough, 0.32)],
      ]),
    );
  }
  fill_ellipse(ctx, 0, 0, half * 0.86, 0.35, css(YOUTIAO.crumb, 0.9));
  if (!isLowDetail) {
    for (const [along, across] of YOUTIAO_BLISTERS) {
      fill_ellipse(ctx, along * half, across, 0.5, 0.32, css(tint(YOUTIAO.dough, 0.45), 0.85));
    }
  }
  ctx.restore();
}

/**
 * Paints a calamansi or lime half: a green rind ring around juicy orange-yellow flesh.
 *
 * @param ctx - The paint context.
 * @param x - Half centre x.
 * @param y - Half centre y.
 * @param radius - Half radius.
 * @param flesh - The flesh colour (calamansi orange by default).
 */
export function paint_lime_half(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  flesh = 0xf2c75a,
): void {
  const ry = radius * FLAT_RATIO;
  fill_ellipse(ctx, x + 0.5, y + 0.9, radius, ry, css(SHADOW_INK, 0.24));
  fill_ellipse(ctx, x, y + radius * 0.25, radius, ry, css(0x3f7a2f));
  fill_ellipse(ctx, x, y, radius, ry, css(0x6ea845));
  fill_ellipse(ctx, x, y, radius * 0.78, ry * 0.78, css(flesh));
  for (let segment = 0; segment < 6; segment += 1) {
    const angle = (segment / 6) * TAU;
    line(
      ctx,
      x,
      y,
      x + Math.cos(angle) * radius * 0.7,
      y + Math.sin(angle) * ry * 0.7,
      css(WHITE, 0.55),
      0.4,
    );
  }
  fill_ellipse(ctx, x - radius * 0.3, y - ry * 0.35, radius * 0.25, ry * 0.12, css(WHITE, 0.6));
}

/**
 * Traces the outline of a shaved-ice mound (without filling it), so syrups can be clipped to it.
 *
 * @param ctx - The paint context.
 * @param x - Mound centre x.
 * @param base - The y of the mound's foot.
 * @param radius - Half the mound's width at its foot.
 * @param height - The mound's height above its foot.
 */
export function trace_ice_mound(
  ctx: PaintContext,
  x: number,
  base: number,
  radius: number,
  height: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x - radius, base);
  ctx.bezierCurveTo(
    x - radius,
    base - height * 0.7,
    x - radius * 0.45,
    base - height,
    x,
    base - height,
  );
  ctx.bezierCurveTo(
    x + radius * 0.45,
    base - height,
    x + radius,
    base - height * 0.7,
    x + radius,
    base,
  );
  ctx.ellipse(x, base, radius, radius * 0.45, 0, 0, Math.PI, false);
  ctx.closePath();
}

/**
 * Paints a shaved-ice mound rising from a bowl: a snowy dome with a cool shaded side and
 * glittering crystals.
 *
 * @param ctx - The paint context.
 * @param x - Mound centre x.
 * @param base - The y of the mound's foot (the bowl's surface line).
 * @param radius - Half the mound's width at its foot.
 * @param height - The mound's height above its foot.
 * @param seed - Crystal seed.
 * @param isLowDetail - True to paint fewer crystals.
 */
export function paint_ice_mound(
  ctx: PaintContext,
  x: number,
  base: number,
  radius: number,
  height: number,
  seed: number,
  isLowDetail: boolean,
): void {
  trace_ice_mound(ctx, x, base, radius, height);
  ctx.fillStyle = linear_gradient(ctx, x - radius, base - height, x + radius, base, [
    [0, WHITE],
    [0.45, 0xf2f8fa],
    [1, 0xc9dde3],
  ]);
  ctx.fill();
  const next = seeded(seed);
  const crystals = isLowDetail ? 4 : 10;
  for (let crystal = 0; crystal < crystals; crystal += 1) {
    const u = next() * 2 - 1;
    const v = next();
    fill_circle(
      ctx,
      x + u * radius * 0.8,
      base - v * height * (1 - Math.abs(u) * 0.5),
      0.5 + next() * 0.5,
      css(crystal % 2 ? WHITE : 0xb4d2da, 0.85),
    );
  }
}

/**
 * Paints a spoon lying on a saucer or dish: a stainless teaspoon or a white ceramic soup spoon.
 *
 * @param ctx - The paint context.
 * @param x - Bowl-of-the-spoon centre x.
 * @param y - Bowl-of-the-spoon centre y.
 * @param length - Spoon length.
 * @param angle - Direction of the handle in radians.
 * @param colourValue - Stainless grey or porcelain white.
 */
export function paint_spoon(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  angle: number,
  colourValue = 0xc9d3d0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  line(ctx, 1, 0.9, length * 0.9, 0.9, css(SHADOW_INK, 0.22), length * 0.1);
  fill_ellipse(ctx, 0.5, 0.8, length * 0.2, length * 0.13, css(SHADOW_INK, 0.22));
  line(ctx, length * 0.1, 0, length * 0.9, 0, css(colourValue), length * 0.09);
  line(
    ctx,
    length * 0.15,
    -length * 0.02,
    length * 0.85,
    -length * 0.02,
    css(WHITE, 0.6),
    length * 0.03,
  );
  fill_ellipse(
    ctx,
    0,
    0,
    length * 0.2,
    length * 0.13,
    linear_gradient(ctx, -length * 0.2, -length * 0.13, length * 0.2, length * 0.13, [
      [0, tint(colourValue, 0.5)],
      [1, shade(colourValue, 0.25)],
    ]),
  );
  fill_ellipse(ctx, -length * 0.05, -length * 0.04, length * 0.08, length * 0.04, css(WHITE, 0.7));
  ctx.restore();
}

/**
 * Scatters curved slivers (red onion, pickled onion, ginger): thin arcs with a bright edge.
 *
 * @param ctx - The paint context.
 * @param x - Scatter centre x.
 * @param y - Scatter centre y.
 * @param radius - Scatter radius.
 * @param count - Number of slivers.
 * @param colourValue - The sliver colour.
 * @param seed - Position seed.
 */
export function paint_slivers(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  count: number,
  colourValue: number,
  seed: number,
): void {
  const next = seeded(seed);
  ctx.save();
  ctx.lineCap = "round";
  for (let sliver = 0; sliver < count; sliver += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radius;
    const cx = x + Math.cos(angle) * distance;
    const cy = y + Math.sin(angle) * distance * FLAT_RATIO;
    const start = next() * TAU;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6, start, start + Math.PI * 0.9);
    ctx.strokeStyle = css(colourValue);
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Lays a row of chopped meat the way a chicken rice or duck rice stall plates it: pieces cut
 * across the bird and shingled skin up, so the row reads as broad glossy skin tops with a thin
 * strip of pale cut meat along the east and south edge of each piece. Fewer pieces leave from
 * the east end.
 *
 * @param ctx - The paint context.
 * @param x - Centre x of the first (leftmost) piece.
 * @param y - Centre y of the first piece.
 * @param count - Number of pieces.
 * @param flesh - The cut meat colour.
 * @param skin - The skin colour on top.
 * @param gloss - The glaze highlight opacity.
 */
export function paint_slice_row(
  ctx: PaintContext,
  x: number,
  y: number,
  count: number,
  flesh: number,
  skin: number,
  gloss: number,
): void {
  const { width, step, face } = SLICE_ROW;
  // The pieces shingle: each lies over the west edge of its eastern neighbour, so they are laid
  // from east to west, and each leans a little so the row fans like slices set down by a
  // cleaver rather than standing up. Every piece shows a broad skin top with a thin cut edge.
  for (let piece = count - 1; piece >= 0; piece -= 1) {
    const length = SLICE_ROW.length + ((piece * 7) % 3) * 0.35;
    const centreX = x + piece * step;
    const centreY = y + piece * 0.35 - Math.sin((piece + 0.5) * 0.6) * 0.6;
    const left = -width / 2;
    const top = -length / 2;
    ctx.save();
    ctx.translate(centreX, centreY);
    ctx.rotate(SLICE_ROW.lean + piece * 0.05);
    fill_rounded_rect(
      ctx,
      left + 0.7,
      top + 1.1,
      width + face,
      length + face,
      1.6,
      css(SHADOW_INK, 0.24),
    );
    fill_rounded_rect(
      ctx,
      left,
      top + 0.5,
      width + face,
      length + face - 0.3,
      1.6,
      linear_gradient(ctx, 0, top, 0, top + length + face, [
        [0, tint(flesh, 0.2)],
        [1, shade(flesh, 0.22)],
      ]),
    );
    fill_rounded_rect(
      ctx,
      left,
      top,
      width,
      length,
      1.8,
      linear_gradient(ctx, left, top, left + width, top + length, [
        [0, tint(skin, 0.35)],
        [0.45, skin],
        [1, shade(skin, 0.25)],
      ]),
    );
    line(
      ctx,
      left + width - 0.3,
      top + 1.4,
      left + width - 0.3,
      top + length - 1.2,
      css(shade(skin, 0.4), 0.45),
      0.4,
    );
    fill_rounded_rect(ctx, left + 0.6, top + 1, 0.9, length * 0.5, 0.4, css(WHITE, gloss));
    ctx.restore();
  }
}
