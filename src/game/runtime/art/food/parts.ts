/**
 * The ingredient primitives the dish motifs and variant cues are painted from: rice mounds and
 * noodle tangles, broth and gravy pools, meat slices and chunks, eggs, dumplings, buns, prawns,
 * skewers, flatbread rounds, garnish flecks and the small sauce cup, plus the food colours they
 * share and `includes_any`, the substring test the motif and cue choices make on kebab-case keys.
 *
 * Every primitive is a pure Canvas 2D painter in world pixels, lit from the north-west with a
 * soft drop shadow to the south-east, and takes any randomness from a seed it is given.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  line,
  linear_gradient,
  mix,
  radial_gradient,
  seeded,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  stroke_rounded_rect,
  TAU,
  tint,
  type PaintContext,
} from "../canvas";

/**
 * Reports whether a string contains any of the given substrings.
 *
 * Variant visual keys and dish IDs are kebab-case compounds, so painters pick their cues by
 * substring rather than by exact match.
 *
 * @param value - The string to search, such as a variant visual key or a dish ID.
 * @param parts - The substrings to look for.
 * @returns True when at least one part occurs in the value.
 */
export function includes_any(value: string, parts: readonly string[]): boolean {
  return parts.some((part) => value.includes(part));
}

/** The centre and radii the portion of a dish stays within, in texture pixels. */
export interface FoodArea {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

/** Pure white, for highlights. */
export const WHITE = 0xffffff;
/** The ink outlines and seeds are drawn with. */
export const INK = 0x263238;
/** Glazed porcelain. */
export const PORCELAIN = 0xf7f3ea;
/** Steamed white rice. */
export const RICE = 0xf3ead3;
/** Spring onion and coriander green. */
export const SPRING_ONION = 0x5f9e52;
/** Dark leafy greens. */
export const LEAF_GREEN = 0x4f7d4a;
/** Fresh chilli red. */
export const CHILLI_RED = 0xd43b2a;
/** Egg white. */
export const EGG_WHITE = 0xf8f2e2;
/** Egg yolk. */
export const YOLK = 0xe8a92a;
/** Roasted peanut. */
export const PEANUT = 0xc9955a;
/** Dark soy sauce. */
export const DARK_SOY = 0x4a2c1c;
/** Fried shallot brown. */
export const SHALLOT = 0x9a5a2c;
/** Cooked prawn pink-orange. */
export const PRAWN = 0xf08a6a;
/** Bone and cartilage white. */
export const BONE = 0xefe6d6;
/** Sambal: a deep, glossy chilli red. */
export const SAMBAL = 0xb8361f;

/**
 * How tall a flat round thing lying on a dish looks relative to its width in the 3/4 view
 * (the camera looks down at about 55 degrees, so circles on the table read as ellipses).
 */
export const FLAT_RATIO = 0.8;

/**
 * Scales a count of pieces by how much of the serving remains, never below one.
 *
 * @param count - The pieces on a full serving.
 * @param remaining - The uneaten share, 1/3 to 1.
 * @returns The pieces still on the plate.
 */
export function piece_count(count: number, remaining: number): number {
  return Math.max(1, Math.round(count * remaining));
}

/**
 * Scales a portion radius by how much of the serving remains.
 *
 * @param radius - The radius of a full serving.
 * @param remaining - The uneaten share, 1/3 to 1.
 * @returns The radius of what remains.
 */
export function portion_radius(radius: number, remaining: number): number {
  return radius * (0.55 + 0.45 * remaining);
}

/**
 * Paints a specular highlight: a soft white ellipse, tilted to the north-west key light.
 *
 * @param ctx - The paint context.
 * @param x - Highlight centre x.
 * @param y - Highlight centre y.
 * @param radiusX - Horizontal radius.
 * @param radiusY - Vertical radius.
 * @param alpha - The highlight opacity.
 * @param angle - Tilt in radians; the key-light tilt by default.
 */
export function paint_gloss(
  ctx: PaintContext,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  alpha: number,
  angle = -0.55,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0, 0, radiusX, radiusY, css(WHITE, alpha));
  ctx.restore();
}

/**
 * Paints a mound of rice with highlighted grains.
 *
 * @param ctx - The paint context.
 * @param x - Mound centre x.
 * @param y - Mound centre y.
 * @param radiusX - Horizontal radius.
 * @param radiusY - Vertical radius.
 * @param colourValue - Rice colour.
 * @param seed - Grain seed.
 * @param isLowDetail - True to paint fewer grains.
 */
export function paint_rice_mound(
  ctx: PaintContext,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  colourValue: number,
  seed: number,
  isLowDetail: boolean,
): void {
  fill_ellipse(ctx, x + 0.7, y + 1.1, radiusX, radiusY * 0.95, css(SHADOW_INK, 0.18));
  fill_ellipse(
    ctx,
    x,
    y,
    radiusX,
    radiusY,
    radial_gradient(ctx, x - radiusX * 0.35, y - radiusY * 0.45, 0.5, radiusX * 1.25, [
      [0, tint(colourValue, 0.3)],
      [0.6, colourValue],
      [1, shade(colourValue, 0.3)],
    ]),
  );
  const next = seeded(seed);
  const grains = isLowDetail ? 5 : 11;
  for (let grain = 0; grain < grains; grain += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radiusX * 0.8;
    ctx.save();
    ctx.translate(
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance * (radiusY / radiusX),
    );
    ctx.rotate(next() * Math.PI);
    fill_ellipse(ctx, 0.4, 0.5, 1.5, 0.65, css(shade(colourValue, 0.35), 0.35));
    fill_ellipse(ctx, 0, 0, 1.5, 0.65, css(tint(colourValue, 0.55), 0.95));
    ctx.restore();
  }
}

/**
 * Paints a tangle of noodle strands within a radius.
 *
 * @param ctx - The paint context.
 * @param x - Tangle centre x.
 * @param y - Tangle centre y.
 * @param radius - Tangle radius.
 * @param colourValue - Noodle colour.
 * @param seed - Strand seed.
 * @param width - Strand width.
 * @param isLowDetail - True to paint fewer strands.
 */
export function paint_noodles(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  colourValue: number,
  seed: number,
  width: number,
  isLowDetail: boolean,
): void {
  const next = seeded(seed);
  fill_ellipse(ctx, x + 0.5, y + 1.2, radius, radius * 0.78, css(SHADOW_INK, 0.2));
  fill_ellipse(ctx, x, y + 0.6, radius, radius * 0.78, css(shade(colourValue, 0.2), 0.95));
  const strands = isLowDetail ? 7 : 13;
  ctx.save();
  ctx.lineCap = "round";
  for (let strand = 0; strand < strands; strand += 1) {
    const startAngle = next() * TAU;
    const sx = x + Math.cos(startAngle) * radius * 0.72;
    const sy = y + Math.sin(startAngle) * radius * 0.6;
    const c1x = x + (next() - 0.5) * radius * 1.6;
    const c1y = y + (next() - 0.5) * radius * 1.5;
    const c2x = x + (next() - 0.5) * radius * 1.6;
    const c2y = y + (next() - 0.5) * radius * 1.5;
    const ex = x + (next() - 0.5) * radius * 1.4;
    const ey = y + (next() - 0.5) * radius * 1.2;
    const trace = (offset: number) => {
      ctx.beginPath();
      ctx.moveTo(sx + offset, sy + offset);
      ctx.bezierCurveTo(
        c1x + offset,
        c1y + offset,
        c2x + offset,
        c2y + offset,
        ex + offset,
        ey + offset,
      );
      ctx.stroke();
    };
    if (!isLowDetail) {
      ctx.strokeStyle = css(shade(colourValue, 0.45), 0.45);
      ctx.lineWidth = width + 0.5;
      trace(0.6);
    }
    ctx.strokeStyle = css(strand % 3 === 0 ? tint(colourValue, 0.32) : colourValue);
    ctx.lineWidth = width;
    trace(0);
  }
  ctx.restore();
}

/**
 * Paints a pool of broth or gravy: a liquid surface darker towards its edge, a meniscus line, a
 * soft sheen and optional floating oil droplets.
 *
 * @param ctx - The paint context.
 * @param x - Pool centre x.
 * @param y - Pool centre y.
 * @param radiusX - Horizontal radius.
 * @param radiusY - Vertical radius.
 * @param colourValue - The liquid colour.
 * @param options - `sheen` sets the highlight opacity, `oil` the droplet count (seeded by
 *   `seed`, in `oilColour`), and `alpha` the liquid opacity for a translucent overlay.
 */
export function paint_liquid(
  ctx: PaintContext,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  colourValue: number,
  options: {
    sheen?: number;
    oil?: number;
    oilColour?: number;
    seed?: number;
    alpha?: number;
  } = {},
): void {
  const alpha = options.alpha ?? 1;
  fill_ellipse(
    ctx,
    x,
    y,
    radiusX,
    radiusY,
    radial_gradient(ctx, x - radiusX * 0.25, y - radiusY * 0.3, 0.5, radiusX * 1.1, [
      [0, tint(colourValue, 0.12), alpha],
      [0.7, colourValue, alpha],
      [1, shade(colourValue, 0.32), alpha],
    ]),
  );
  stroke_ellipse(
    ctx,
    x,
    y,
    radiusX - 0.4,
    radiusY - 0.4,
    css(shade(colourValue, 0.5), 0.35 * alpha),
    0.8,
  );
  const sheen = options.sheen ?? 0.22;
  if (sheen > 0) {
    paint_gloss(ctx, x - radiusX * 0.32, y - radiusY * 0.4, radiusX * 0.4, radiusY * 0.18, sheen);
  }
  if (options.oil) {
    const next = seeded(options.seed ?? 1);
    const oilColour = options.oilColour ?? tint(colourValue, 0.4);
    for (let droplet = 0; droplet < options.oil; droplet += 1) {
      fill_circle(
        ctx,
        x + (next() - 0.5) * radiusX * 1.3,
        y + (next() - 0.5) * radiusY * 1.3,
        0.7 + next() * 0.9,
        css(oilColour, 0.6),
      );
    }
  }
}

/**
 * Paints a slice of meat, fish or cake: a tilted ellipse with a lit centre, an optional skin
 * strip along its upper edge and a glaze highlight.
 *
 * @param ctx - The paint context.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param width - Slice length.
 * @param height - Slice thickness.
 * @param angle - Tilt in radians.
 * @param colourValue - The flesh colour.
 * @param options - `skin` draws a skin strip in that colour; `gloss` sets the highlight opacity.
 */
export function paint_slice(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  colourValue: number,
  options: { skin?: number; gloss?: number } = {},
): void {
  const rx = width / 2;
  const ry = height / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0.5, 0.8, rx, ry, css(SHADOW_INK, 0.2));
  fill_ellipse(
    ctx,
    0,
    0,
    rx,
    ry,
    linear_gradient(ctx, -rx, -ry, rx, ry, [
      [0, tint(colourValue, 0.22)],
      [1, shade(colourValue, 0.24)],
    ]),
  );
  if (options.skin !== undefined) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = css(options.skin);
    ctx.lineWidth = Math.max(0.9, height * 0.3);
    ctx.lineCap = "round";
    ctx.stroke();
  }
  fill_ellipse(ctx, -rx * 0.3, -ry * 0.2, rx * 0.3, ry * 0.3, css(WHITE, options.gloss ?? 0.28));
  ctx.restore();
}

/**
 * Paints a chunk: a rounded cube with a lit top-left, a shaded bottom-right and a highlight.
 *
 * @param ctx - The paint context.
 * @param x - Chunk centre x.
 * @param y - Chunk centre y.
 * @param size - Side length.
 * @param colourValue - The chunk colour.
 * @param angle - Rotation in radians.
 * @param options - `radius` rounds the corners, `gloss` sets the highlight opacity and `edge`
 *   strokes a tinted outline at that opacity.
 */
export function paint_chunk(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  colourValue: number,
  angle = 0,
  options: { radius?: number; gloss?: number; edge?: number } = {},
): void {
  const half = size / 2;
  const radius = options.radius ?? size * 0.26;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_rounded_rect(ctx, -half + 0.6, -half + 0.9, size, size, radius, css(SHADOW_INK, 0.2));
  fill_rounded_rect(
    ctx,
    -half,
    -half,
    size,
    size,
    radius,
    linear_gradient(ctx, -half, -half, half, half, [
      [0, tint(colourValue, 0.26)],
      [0.55, colourValue],
      [1, shade(colourValue, 0.3)],
    ]),
  );
  if (options.edge) {
    stroke_rounded_rect(
      ctx,
      -half,
      -half,
      size,
      size,
      radius,
      css(shade(colourValue, 0.5), options.edge),
      0.6,
    );
  }
  fill_rounded_rect(
    ctx,
    -half + size * 0.16,
    -half + size * 0.14,
    size * 0.42,
    size * 0.18,
    radius * 0.6,
    css(WHITE, options.gloss ?? 0.3),
  );
  ctx.restore();
}

/**
 * Paints a halved hard-boiled egg: the white with its yolk, lit from the north-west.
 *
 * @param ctx - The paint context.
 * @param x - Egg centre x.
 * @param y - Egg centre y.
 * @param radius - The long radius of the half.
 * @param options - `white` and `yolk` override the colours (a braised egg is tea-stained);
 *   `angle` tilts the half.
 */
export function paint_egg_half(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  options: { white?: number; yolk?: number; angle?: number } = {},
): void {
  const white = options.white ?? EGG_WHITE;
  const yolk = options.yolk ?? YOLK;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(options.angle ?? -0.4);
  fill_ellipse(ctx, 0.5, 0.8, radius, radius * 0.78, css(SHADOW_INK, 0.2));
  fill_ellipse(
    ctx,
    0,
    0,
    radius,
    radius * 0.78,
    radial_gradient(ctx, -radius * 0.3, -radius * 0.3, 0.3, radius * 1.2, [
      [0, tint(white, 0.5)],
      [0.8, white],
      [1, shade(white, 0.22)],
    ]),
  );
  fill_circle(
    ctx,
    0,
    0,
    radius * 0.5,
    radial_gradient(ctx, -radius * 0.15, -radius * 0.15, 0.2, radius * 0.55, [
      [0, tint(yolk, 0.35)],
      [1, shade(yolk, 0.15)],
    ]),
  );
  ctx.restore();
}

/**
 * Paints a fried egg: a wobbly white with crisp edges and a glossy yolk.
 *
 * @param ctx - The paint context.
 * @param x - Yolk centre x.
 * @param y - Yolk centre y.
 * @param radius - Radius of the white.
 */
export function paint_fried_egg(ctx: PaintContext, x: number, y: number, radius: number): void {
  const lobes: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 0, radius, radius * 0.85],
    [-radius * 0.45, radius * 0.3, radius * 0.6, radius * 0.5],
    [radius * 0.5, -radius * 0.3, radius * 0.55, radius * 0.5],
  ];
  for (const [dx, dy, rx, ry] of lobes) {
    fill_ellipse(ctx, x + dx + 0.5, y + dy + 0.8, rx, ry, css(SHADOW_INK, 0.16));
  }
  for (const [dx, dy, rx, ry] of lobes) {
    fill_ellipse(ctx, x + dx, y + dy, rx, ry, css(0xd9b06a, 0.7));
    fill_ellipse(ctx, x + dx, y + dy, rx * 0.88, ry * 0.86, css(EGG_WHITE));
  }
  fill_circle(
    ctx,
    x,
    y,
    radius * 0.46,
    radial_gradient(ctx, x - radius * 0.15, y - radius * 0.15, 0.2, radius * 0.5, [
      [0, tint(YOLK, 0.4)],
      [1, shade(YOLK, 0.12)],
    ]),
  );
  fill_circle(ctx, x - radius * 0.15, y - radius * 0.16, radius * 0.12, css(WHITE, 0.6));
}

/**
 * Paints a cucumber slice: a green rind around pale flesh with a seed ring.
 *
 * @param ctx - The paint context.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param radius - Slice radius.
 */
export function paint_cucumber(ctx: PaintContext, x: number, y: number, radius: number): void {
  const ry = radius * FLAT_RATIO;
  fill_ellipse(ctx, x + 0.4, y + 0.7, radius, ry, css(SHADOW_INK, 0.18));
  fill_ellipse(ctx, x, y + 0.5, radius, ry, css(0x3f6f35));
  fill_ellipse(ctx, x, y, radius, ry, css(0x6f9f4a));
  fill_ellipse(ctx, x, y, radius * 0.78, ry * 0.78, css(0xdcecbd));
  for (let seed = 0; seed < 3; seed += 1) {
    const angle = (seed / 3) * TAU + 0.5;
    fill_circle(
      ctx,
      x + Math.cos(angle) * radius * 0.32,
      y + Math.sin(angle) * ry * 0.32,
      radius * 0.14,
      css(0xb9cf8f),
    );
  }
  fill_ellipse(ctx, x - radius * 0.3, y - ry * 0.3, radius * 0.22, ry * 0.16, css(WHITE, 0.5));
}

/**
 * Paints a small dipping saucer with sauce in it, the chilli or curry cup beside a dish.
 *
 * @param ctx - The paint context.
 * @param x - Cup centre x.
 * @param y - Cup centre y.
 * @param radius - Cup radius.
 * @param sauce - The sauce colour.
 */
export function paint_sauce_cup(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  sauce: number,
): void {
  const ry = radius * FLAT_RATIO;
  const depth = radius * 0.32;
  fill_ellipse(ctx, x + 0.9, y + depth + 0.9, radius, ry, css(SHADOW_INK, 0.24));
  fill_ellipse(ctx, x, y + depth, radius * 0.92, ry * 0.92, css(0xc9bfae));
  fill_rounded_rect(ctx, x - radius * 0.92, y, radius * 1.84, depth, 0.5, css(0xe2dacb));
  fill_ellipse(
    ctx,
    x,
    y,
    radius,
    ry,
    radial_gradient(ctx, x - radius * 0.3, y - ry * 0.3, 0.2, radius * 1.2, [
      [0, WHITE],
      [0.7, PORCELAIN],
      [1, 0xd8cfbf],
    ]),
  );
  fill_ellipse(
    ctx,
    x,
    y + ry * 0.08,
    radius * 0.72,
    ry * 0.68,
    radial_gradient(ctx, x - radius * 0.2, y - ry * 0.1, 0.2, radius * 0.8, [
      [0, tint(sauce, 0.2)],
      [0.7, sauce],
      [1, shade(sauce, 0.35)],
    ]),
  );
  fill_ellipse(ctx, x - radius * 0.25, y - ry * 0.18, radius * 0.24, ry * 0.12, css(WHITE, 0.55));
  stroke_ellipse(ctx, x, y, radius, ry, css(0xa99d89, 0.65), 0.5);
}

/**
 * Scatters herb flecks (spring onion rings, coriander, curry leaf bits) over a circle.
 *
 * @param ctx - The paint context.
 * @param x - Scatter centre x.
 * @param y - Scatter centre y.
 * @param radius - Scatter radius.
 * @param count - Number of flecks.
 * @param colourValue - The herb colour.
 * @param seed - Position seed.
 * @param length - Fleck length.
 */
export function paint_herb_flecks(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  count: number,
  colourValue: number,
  seed: number,
  length = 2.4,
): void {
  const next = seeded(seed);
  for (let fleck = 0; fleck < count; fleck += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radius;
    ctx.save();
    ctx.translate(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
    ctx.rotate(next() * Math.PI);
    fill_ellipse(ctx, 0.3, 0.4, length / 2, length * 0.3, css(SHADOW_INK, 0.2));
    fill_ellipse(ctx, 0, 0, length / 2, length * 0.3, css(colourValue));
    fill_ellipse(ctx, -length * 0.1, -length * 0.08, length * 0.22, length * 0.1, css(WHITE, 0.35));
    ctx.restore();
  }
}

/**
 * Scatters round dots (peanuts, shallots, beans, pepper) over a circle.
 *
 * @param ctx - The paint context.
 * @param x - Scatter centre x.
 * @param y - Scatter centre y.
 * @param radius - Scatter radius.
 * @param count - Number of dots.
 * @param size - Dot radius.
 * @param colourValue - The dot colour.
 * @param seed - Position seed.
 */
export function paint_dots(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  count: number,
  size: number,
  colourValue: number,
  seed: number,
): void {
  const next = seeded(seed);
  for (let dot = 0; dot < count; dot += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radius;
    const dotX = x + Math.cos(angle) * distance;
    const dotY = y + Math.sin(angle) * distance;
    fill_circle(ctx, dotX + 0.3, dotY + 0.5, size, css(SHADOW_INK, 0.22));
    fill_circle(
      ctx,
      dotX,
      dotY,
      size,
      radial_gradient(ctx, dotX - size * 0.3, dotY - size * 0.3, 0.1, size * 1.1, [
        [0, tint(colourValue, 0.3)],
        [1, shade(colourValue, 0.2)],
      ]),
    );
  }
}

/**
 * Paints a satay skewer: a bamboo stick threaded with charred, glazed pieces of meat.
 *
 * @param ctx - The paint context.
 * @param x0 - Stick start x (the handle end).
 * @param y0 - Stick start y.
 * @param x1 - Stick end x.
 * @param y1 - Stick end y.
 * @param meat - The meat colour.
 * @param pieces - Pieces on the stick.
 * @param isCubed - True for square-cut pieces (beef) rather than rounded ones (chicken).
 */
export function paint_skewer(
  ctx: PaintContext,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  meat: number,
  pieces: number,
  isCubed: boolean,
): void {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  line(ctx, x0 + 0.4, y0 + 0.7, x1 + 0.4, y1 + 0.7, css(SHADOW_INK, 0.22), 1.3);
  line(ctx, x0, y0, x1, y1, css(0xd9b97c), 1.1);
  line(ctx, x0, y0, x0 + (x1 - x0) * 0.15, y0 + (y1 - y0) * 0.15, css(0xb8955a), 1.1);
  for (let piece = 0; piece < pieces; piece += 1) {
    const t = 0.3 + (piece / Math.max(1, pieces - 1)) * 0.6;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    if (isCubed) {
      fill_rounded_rect(ctx, -1.6, -1.3, 3.4, 2.8, 0.6, css(SHADOW_INK, 0.22));
      fill_rounded_rect(
        ctx,
        -1.9,
        -1.6,
        3.4,
        2.8,
        0.6,
        linear_gradient(ctx, -1.9, -1.6, 1.5, 1.2, [
          [0, tint(meat, 0.25)],
          [1, shade(meat, 0.3)],
        ]),
      );
    } else {
      fill_ellipse(ctx, 0.3, 0.4, 2, 1.5, css(SHADOW_INK, 0.22));
      fill_ellipse(
        ctx,
        0,
        0,
        2,
        1.5,
        linear_gradient(ctx, -2, -1.5, 2, 1.5, [
          [0, tint(meat, 0.3)],
          [1, shade(meat, 0.3)],
        ]),
      );
    }
    line(ctx, -1, 0.8, 0.9, 0.3, css(shade(meat, 0.65), 0.75), 0.6);
    fill_circle(ctx, -0.7, -0.6, 0.55, css(WHITE, 0.42));
    ctx.restore();
  }
}

/**
 * Paints a dumpling: a translucent wrapper over a blush of filling, with pleat lines.
 *
 * @param ctx - The paint context.
 * @param x - Dumpling centre x.
 * @param y - Dumpling centre y.
 * @param radius - Dumpling radius.
 * @param wrapper - The wrapper colour.
 * @param options - `blush` is the filling colour seen through the wrapper, `pleats` the pleat
 *   count and `isCrescent` draws a boat-shaped dumpling instead of a round one.
 */
export function paint_dumpling(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  wrapper: number,
  options: { blush?: number; pleats?: number; isCrescent?: boolean } = {},
): void {
  const ry = options.isCrescent ? radius * 0.62 : radius * 0.86;
  const pleats = options.pleats ?? 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(options.isCrescent ? -0.35 : 0);
  fill_ellipse(ctx, 0.5, 0.9, radius, ry, css(SHADOW_INK, 0.2));
  fill_ellipse(
    ctx,
    0,
    0,
    radius,
    ry,
    radial_gradient(ctx, -radius * 0.3, -ry * 0.35, 0.3, radius * 1.2, [
      [0, tint(wrapper, 0.4)],
      [0.8, wrapper],
      [1, shade(wrapper, 0.25)],
    ]),
  );
  if (options.blush !== undefined) {
    fill_ellipse(ctx, radius * 0.05, ry * 0.1, radius * 0.55, ry * 0.5, css(options.blush, 0.45));
  }
  ctx.lineCap = "round";
  for (let pleat = 0; pleat < pleats; pleat += 1) {
    const offset = (pleat - (pleats - 1) / 2) * radius * 0.42;
    line(
      ctx,
      offset * 1.1,
      -ry * 0.75,
      offset * 0.6,
      ry * 0.15,
      css(shade(wrapper, 0.4), 0.55),
      0.6,
    );
  }
  fill_ellipse(ctx, -radius * 0.3, -ry * 0.35, radius * 0.25, ry * 0.18, css(WHITE, 0.4));
  ctx.restore();
}

/**
 * Paints a steamed bun: a soft white dome, its shaded lower side showing in the 3/4 view, whose
 * top has burst open in three or four uneven fissures showing the glossy filling, the way a
 * char siew bao splits as it steams.
 *
 * @param ctx - The paint context.
 * @param x - Bun centre x.
 * @param y - Bun centre y.
 * @param radius - Bun radius.
 * @param filling - The filling colour showing through the split.
 * @param seed - Sets the number, length and angle of the fissures, so buns differ.
 */
export function paint_bun(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  filling: number,
  seed = 0,
): void {
  const dough = 0xf6ecdc;
  const next = seeded(seed ^ 0xb4a0);
  fill_ellipse(
    ctx,
    x + 0.7,
    y + radius * 0.35,
    radius * 1.02,
    radius * 0.72,
    css(SHADOW_INK, 0.24),
  );
  fill_ellipse(ctx, x, y + radius * 0.2, radius, radius * 0.74, css(shade(dough, 0.22)));
  fill_ellipse(
    ctx,
    x,
    y - radius * 0.06,
    radius * 0.98,
    radius * 0.8,
    radial_gradient(ctx, x - radius * 0.35, y - radius * 0.45, 0.3, radius * 1.3, [
      [0, WHITE],
      [0.55, dough],
      [1, shade(dough, 0.18)],
    ]),
  );
  // The burst: uneven wedges radiating from a point a little off the crown.
  const crownX = x + (next() - 0.5) * radius * 0.16;
  const crownY = y - radius * 0.2 + (next() - 0.5) * radius * 0.1;
  const fissures = 3 + Math.floor(next() * 2);
  const turn = next() * TAU;
  const filling_dark = shade(filling, 0.35);
  for (let fissure = 0; fissure < fissures; fissure += 1) {
    const angle = turn + (fissure / fissures) * TAU + (next() - 0.5) * 0.7;
    const reach = radius * (0.55 + next() * 0.25);
    const open = radius * (0.17 + next() * 0.08);
    const bend = (next() - 0.5) * 0.6;
    const tipX = crownX + Math.cos(angle) * reach;
    const tipY = crownY + Math.sin(angle) * reach * FLAT_RATIO;
    const midX = crownX + Math.cos(angle + bend) * reach * 0.5;
    const midY = crownY + Math.sin(angle + bend) * reach * 0.5 * FLAT_RATIO;
    const normalX = -Math.sin(angle) * open;
    const normalY = Math.cos(angle) * open * FLAT_RATIO;
    const wedge: ReadonlyArray<readonly [number, number]> = [
      [crownX + normalX, crownY + normalY],
      [midX + normalX * 0.6, midY + normalY * 0.6],
      [tipX, tipY],
      [midX - normalX * 0.6, midY - normalY * 0.6],
      [crownX - normalX, crownY - normalY],
    ];
    fill_polygon(
      ctx,
      wedge.map(([px, py]) => [px + 0.25, py + 0.35] as const),
      css(shade(dough, 0.38)),
    );
    fill_polygon(ctx, wedge, css(filling_dark));
    fill_polygon(
      ctx,
      wedge.slice(0, 3).map(([px, py]) => [px + normalX * 0.15, py + normalY * 0.15] as const),
      css(filling),
    );
    line(
      ctx,
      crownX - normalX * 1.1,
      crownY - normalY * 1.1 - 0.15,
      midX - normalX * 0.8,
      midY - normalY * 0.8 - 0.15,
      css(WHITE, 0.75),
      0.45,
    );
  }
  fill_ellipse(ctx, crownX, crownY, radius * 0.26, radius * 0.2, css(filling_dark));
  fill_ellipse(ctx, crownX - 0.1, crownY - 0.1, radius * 0.18, radius * 0.13, css(filling));
  fill_ellipse(
    ctx,
    crownX - radius * 0.06,
    crownY - radius * 0.06,
    radius * 0.06,
    radius * 0.03,
    css(WHITE, 0.6),
  );
}

/**
 * Paints a cooked prawn: a curled pink crescent with segments and a tail fan.
 *
 * @param ctx - The paint context.
 * @param x - Prawn centre x.
 * @param y - Prawn centre y.
 * @param size - Prawn length.
 * @param angle - Rotation in radians.
 */
export function paint_prawn(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  angle: number,
): void {
  const radius = size * 0.5;
  const start = Math.PI * 0.15;
  const end = Math.PI * 1.1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0.5, 0.8, radius, start, end);
  ctx.strokeStyle = css(SHADOW_INK, 0.22);
  ctx.lineWidth = size * 0.42;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius, start, end);
  ctx.strokeStyle = css(PRAWN);
  ctx.lineWidth = size * 0.42;
  ctx.stroke();
  for (let segment = 0; segment < 3; segment += 1) {
    const segmentAngle = Math.PI * (0.35 + segment * 0.25);
    line(
      ctx,
      Math.cos(segmentAngle) * radius * 0.78,
      Math.sin(segmentAngle) * radius * 0.78,
      Math.cos(segmentAngle) * radius * 1.22,
      Math.sin(segmentAngle) * radius * 1.22,
      css(0xd9604a, 0.8),
      0.7,
    );
  }
  const tailX = Math.cos(end) * radius;
  const tailY = Math.sin(end) * radius;
  fill_polygon(
    ctx,
    [
      [tailX, tailY],
      [tailX - size * 0.3, tailY - size * 0.24],
      [tailX - size * 0.34, tailY + size * 0.1],
    ],
    css(0xe06a55),
  );
  ctx.beginPath();
  ctx.arc(-0.3, -0.4, radius * 0.95, Math.PI * 0.4, Math.PI * 0.8);
  ctx.strokeStyle = css(WHITE, 0.42);
  ctx.lineWidth = size * 0.1;
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints a lime or lemon wedge: a rind arc around pale segmented flesh.
 *
 * @param ctx - The paint context.
 * @param x - Wedge centre x.
 * @param y - Wedge centre y.
 * @param radius - Wedge radius.
 * @param angle - Rotation in radians.
 * @param options - `rind` and `flesh` override the lime colours (a lemon is yellow).
 */
export function paint_citrus_wedge(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  angle: number,
  options: { rind?: number; flesh?: number } = {},
): void {
  const rind = options.rind ?? 0x5f9a3c;
  const flesh = options.flesh ?? 0xd4e89a;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0.4, 0.7, radius, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = css(SHADOW_INK, 0.2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = css(rind);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.72, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = css(flesh);
  ctx.fill();
  for (const segmentAngle of [Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75]) {
    line(
      ctx,
      0,
      0,
      Math.cos(segmentAngle) * radius * 0.7,
      Math.sin(segmentAngle) * radius * 0.7,
      css(WHITE, 0.6),
      0.5,
    );
  }
  ctx.restore();
}

/**
 * Paints a pointed leaf (lettuce, coriander, curry leaf, pandan) with a pale midrib.
 *
 * @param ctx - The paint context.
 * @param x - Leaf centre x.
 * @param y - Leaf centre y.
 * @param length - Tip-to-tip length.
 * @param angle - Rotation in radians.
 * @param colourValue - The leaf colour.
 */
export function paint_leaf(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  angle: number,
  colourValue: number,
): void {
  const half = length / 2;
  const width = length * 0.36;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-half + 0.4, 0.6);
  ctx.quadraticCurveTo(0.4, -width + 0.6, half + 0.4, 0.6);
  ctx.quadraticCurveTo(0.4, width + 0.6, -half + 0.4, 0.6);
  ctx.closePath();
  ctx.fillStyle = css(SHADOW_INK, 0.18);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.quadraticCurveTo(0, -width, half, 0);
  ctx.quadraticCurveTo(0, width, -half, 0);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, -half, -width, half, width, [
    [0, tint(colourValue, 0.28)],
    [1, shade(colourValue, 0.28)],
  ]);
  ctx.fill();
  line(ctx, -half * 0.7, 0, half * 0.7, 0, css(tint(colourValue, 0.5), 0.7), 0.5);
  ctx.restore();
}

/**
 * Paints a chilli slice: a red ring with pale flesh and seeds.
 *
 * @param ctx - The paint context.
 * @param x - Slice centre x.
 * @param y - Slice centre y.
 * @param radius - Slice radius.
 * @param colourValue - The chilli colour; red by default.
 */
export function paint_chilli_slice(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  colourValue = CHILLI_RED,
): void {
  const ry = radius * FLAT_RATIO;
  fill_ellipse(ctx, x + 0.3, y + 0.5, radius, ry, css(SHADOW_INK, 0.2));
  fill_ellipse(ctx, x, y, radius, ry, css(colourValue));
  fill_ellipse(ctx, x, y, radius * 0.55, ry * 0.55, css(tint(colourValue, 0.55)));
  fill_circle(ctx, x - radius * 0.2, y - ry * 0.1, radius * 0.16, css(0xf4e7b0));
  fill_circle(ctx, x + radius * 0.22, y + ry * 0.15, radius * 0.16, css(0xf4e7b0));
}

/**
 * Paints a fish ball or meat ball: a sphere with a soft highlight.
 *
 * @param ctx - The paint context.
 * @param x - Ball centre x.
 * @param y - Ball centre y.
 * @param radius - Ball radius.
 * @param colourValue - The ball colour; fish-paste cream by default.
 */
export function paint_ball(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  colourValue = 0xf2e8d6,
): void {
  fill_circle(ctx, x + 0.5, y + 0.9, radius, css(SHADOW_INK, 0.22));
  fill_circle(
    ctx,
    x,
    y,
    radius,
    radial_gradient(ctx, x - radius * 0.35, y - radius * 0.4, 0.2, radius * 1.3, [
      [0, tint(colourValue, 0.45)],
      [0.65, colourValue],
      [1, shade(colourValue, 0.32)],
    ]),
  );
  fill_circle(ctx, x - radius * 0.35, y - radius * 0.38, radius * 0.22, css(WHITE, 0.5));
}

/**
 * Paints sauce strokes over a circle: a drizzle of soy, chilli oil or syrup.
 *
 * @param ctx - The paint context.
 * @param x - Drizzle centre x.
 * @param y - Drizzle centre y.
 * @param radius - Drizzle radius.
 * @param colourValue - The sauce colour.
 * @param seed - Stroke seed.
 * @param count - Number of strokes.
 * @param width - Stroke width.
 */
export function paint_drizzle(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  colourValue: number,
  seed: number,
  count: number,
  width: number,
): void {
  const next = seeded(seed);
  ctx.save();
  ctx.lineCap = "round";
  for (let stroke = 0; stroke < count; stroke += 1) {
    const startAngle = next() * TAU;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(startAngle) * radius, y + Math.sin(startAngle) * radius * 0.8);
    ctx.quadraticCurveTo(
      x + (next() - 0.5) * radius * 1.4,
      y + (next() - 0.5) * radius * 1.4,
      x + (next() - 0.5) * radius * 1.6,
      y + (next() - 0.5) * radius * 1.3,
    );
    ctx.strokeStyle = css(colourValue, 0.9);
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.strokeStyle = css(tint(colourValue, 0.5), 0.35);
    ctx.lineWidth = width * 0.35;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Paints a pork rib lying on its side in broth or sauce: a short, lumpy chunk of braised meat
 * whose glossy top shows above the waterline while its lower half is dimmed by the liquid, a
 * ripple ring where it breaks the surface, and a short knob of bone at one end.
 *
 * @param ctx - The paint context.
 * @param x - Rib centre x.
 * @param y - Rib centre y, at the waterline.
 * @param length - Rib length along the bone.
 * @param thickness - Rib thickness across it.
 * @param angle - Rotation in radians, small so the rib lies along the bowl.
 * @param meat - The meat colour.
 * @param liquid - The broth or sauce colour it lies in.
 */
export function paint_rib(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  thickness: number,
  angle: number,
  meat: number,
  liquid: number,
): void {
  const half = length / 2;
  const waterline = thickness * 0.15;
  // The meat's two lumps either side of the bone, as offsets and radii along the rib.
  const lumps: ReadonlyArray<readonly [number, number, number, number]> = [
    [-half * 0.38, -thickness * 0.12, half * 0.66, thickness * 0.46],
    [half * 0.3, -thickness * 0.18, half * 0.6, thickness * 0.42],
  ];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_ellipse(ctx, 0, waterline + 0.3, half + 0.4, thickness * 0.42, css(mix(meat, liquid, 0.6)));
  stroke_ellipse(
    ctx,
    0,
    waterline + 0.2,
    half + 1,
    thickness * 0.5,
    css(tint(liquid, 0.45), 0.7),
    0.5,
  );
  // The knob of bone, sawn across, showing at the east end.
  fill_ellipse(ctx, half + 0.2, -thickness * 0.08, 1.3, thickness * 0.24, css(shade(BONE, 0.12)));
  fill_ellipse(ctx, half + 0.5, -thickness * 0.08, 0.7, thickness * 0.16, css(shade(BONE, 0.32)));
  for (const [lx, ly, lrx, lry] of lumps) {
    fill_ellipse(
      ctx,
      lx,
      ly,
      lrx,
      lry,
      linear_gradient(ctx, 0, ly - lry, 0, ly + lry, [
        [0, tint(meat, 0.3)],
        [0.55, meat],
        [1, shade(meat, 0.35)],
      ]),
    );
  }
  const [fatX, fatY, fatRx, fatRy] = lumps[0] as readonly [number, number, number, number];
  ctx.beginPath();
  ctx.ellipse(fatX, fatY, fatRx * 0.82, fatRy * 0.7, 0, 1.15 * Math.PI, 1.75 * Math.PI, false);
  ctx.strokeStyle = css(tint(meat, 0.65), 0.6);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  line(ctx, -0.2, -thickness * 0.45, 0.4, waterline - 0.3, css(shade(meat, 0.45), 0.5), 0.45);
  fill_ellipse(
    ctx,
    -half * 0.45,
    -thickness * 0.34,
    length * 0.12,
    thickness * 0.08,
    css(WHITE, 0.4),
  );
  // The broth laps over the meat's lower edge.
  ctx.beginPath();
  ctx.ellipse(0, waterline, half + 0.2, thickness * 0.18, 0, 0.05 * Math.PI, 0.95 * Math.PI, false);
  ctx.strokeStyle = css(liquid, 0.8);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints a block of tofu, stuffed when a paste colour is given.
 *
 * @param ctx - The paint context.
 * @param x - Block centre x.
 * @param y - Block centre y.
 * @param width - Block width.
 * @param height - Block height.
 * @param colourValue - The tofu colour.
 * @param paste - The fish-paste colour of the stuffing, when stuffed.
 */
export function paint_tofu(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  colourValue: number,
  paste?: number,
): void {
  fill_rounded_rect(
    ctx,
    x - width / 2 + 0.5,
    y - height / 2 + 0.9,
    width,
    height,
    1,
    css(SHADOW_INK, 0.22),
  );
  fill_rounded_rect(
    ctx,
    x - width / 2,
    y - height / 2,
    width,
    height,
    1,
    linear_gradient(ctx, x - width / 2, y - height / 2, x + width / 2, y + height / 2, [
      [0, tint(colourValue, 0.3)],
      [1, shade(colourValue, 0.26)],
    ]),
  );
  if (paste !== undefined) {
    fill_ellipse(ctx, x, y + height * 0.05, width * 0.34, height * 0.28, css(paste));
    fill_ellipse(
      ctx,
      x - width * 0.1,
      y - height * 0.05,
      width * 0.12,
      height * 0.1,
      css(WHITE, 0.4),
    );
  }
  fill_rounded_rect(
    ctx,
    x - width * 0.38,
    y - height * 0.4,
    width * 0.36,
    height * 0.14,
    0.6,
    css(WHITE, 0.35),
  );
}

/**
 * Paints a foam cap: a cream disc covered in bubbles, for pulled tea.
 *
 * @param ctx - The paint context.
 * @param x - Cap centre x.
 * @param y - Cap centre y.
 * @param radius - Cap radius.
 * @param seed - Bubble seed.
 * @param isLowDetail - True to paint fewer bubbles.
 */
export function paint_foam(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  seed: number,
  isLowDetail: boolean,
): void {
  const cream = 0xfbefd4;
  fill_circle(
    ctx,
    x,
    y,
    radius,
    radial_gradient(ctx, x - radius * 0.3, y - radius * 0.3, 0.3, radius * 1.2, [
      [0, tint(cream, 0.5)],
      [0.75, cream],
      [1, shade(cream, 0.18)],
    ]),
  );
  const next = seeded(seed);
  const bubbles = isLowDetail ? 5 : 10;
  for (let bubble = 0; bubble < bubbles; bubble += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radius * 0.8;
    const bubbleX = x + Math.cos(angle) * distance;
    const bubbleY = y + Math.sin(angle) * distance;
    const size = 0.7 + next() * 1.1;
    stroke_ellipse(ctx, bubbleX, bubbleY, size, size, css(shade(cream, 0.3), 0.5), 0.5);
    fill_circle(ctx, bubbleX - size * 0.3, bubbleY - size * 0.3, size * 0.35, css(WHITE, 0.8));
  }
}

/**
 * Paints an ice cube: a translucent rounded square with a bright facet.
 *
 * @param ctx - The paint context.
 * @param x - Cube centre x.
 * @param y - Cube centre y.
 * @param size - Side length.
 * @param angle - Rotation in radians.
 */
export function paint_ice_cube(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  angle: number,
): void {
  const half = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fill_rounded_rect(ctx, -half, -half, size, size, size * 0.2, css(0xf4fbfc, 0.72));
  stroke_rounded_rect(ctx, -half, -half, size, size, size * 0.2, css(WHITE, 0.9), 0.7);
  fill_rounded_rect(
    ctx,
    -half + size * 0.18,
    -half + size * 0.16,
    size * 0.36,
    size * 0.2,
    0.5,
    css(WHITE, 0.9),
  );
  line(
    ctx,
    -half + size * 0.3,
    half - size * 0.25,
    half - size * 0.2,
    half - size * 0.25,
    css(0xb8d8dc, 0.6),
    0.5,
  );
  ctx.restore();
}

/**
 * Paints a drinking straw leaning out of a glass.
 *
 * @param ctx - The paint context.
 * @param x - Straw start x (in the glass).
 * @param y - Straw start y.
 * @param length - Straw length.
 * @param angle - Direction in radians.
 * @param colourValue - The straw colour.
 */
export function paint_straw(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  angle: number,
  colourValue: number,
): void {
  const endX = x + Math.cos(angle) * length;
  const endY = y + Math.sin(angle) * length;
  line(ctx, x + 0.5, y + 0.9, endX + 0.5, endY + 0.9, css(SHADOW_INK, 0.2), 2.2);
  line(ctx, x, y, endX, endY, css(colourValue), 2.2);
  line(ctx, x, y, endX, endY, css(tint(colourValue, 0.55), 0.8), 0.7);
  ctx.save();
  ctx.setLineDash([1.6, 1.6]);
  line(ctx, x, y, endX, endY, css(WHITE, 0.75), 0.9, "butt");
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Paints a round of flaky flatbread (prata, thosai): a golden disc with spiral layers, browned
 * blisters and an optional fold.
 *
 * @param ctx - The paint context.
 * @param x - Round centre x.
 * @param y - Round centre y.
 * @param radius - Round radius.
 * @param colourValue - The bread colour.
 * @param seed - Layer and blister seed.
 * @param isFolded - True to fold the round over a chord.
 */
export function paint_flatbread_round(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  colourValue: number,
  seed: number,
  isFolded = false,
): void {
  const next = seeded(seed);
  const ry = radius * FLAT_RATIO;
  // A crumpled, uneven rim: the griddled dough never lies in a perfect circle.
  const rim: [number, number][] = [];
  for (let point = 0; point < 14; point += 1) {
    const angle = (point / 14) * TAU;
    const reach = 0.86 + next() * 0.16;
    rim.push([x + Math.cos(angle) * radius * reach, y + Math.sin(angle) * ry * reach]);
  }
  const trace_rim = (dx: number, dy: number) => {
    ctx.beginPath();
    rim.forEach(([px, py], index) => {
      const [nx, ny] = rim[(index + 1) % rim.length] as [number, number];
      if (index === 0) ctx.moveTo((px + nx) / 2 + dx, (py + ny) / 2 + dy);
      else ctx.quadraticCurveTo(px + dx, py + dy, (px + nx) / 2 + dx, (py + ny) / 2 + dy);
    });
    const [fx, fy] = rim[0] as [number, number];
    const [sx, sy] = rim[1] as [number, number];
    ctx.quadraticCurveTo(fx + dx, fy + dy, (fx + sx) / 2 + dx, (fy + sy) / 2 + dy);
    ctx.closePath();
  };
  trace_rim(0.7, 1.4);
  ctx.fillStyle = css(SHADOW_INK, 0.24);
  ctx.fill();
  trace_rim(0, 0.9);
  ctx.fillStyle = css(shade(colourValue, 0.35));
  ctx.fill();
  trace_rim(0, 0);
  ctx.fillStyle = radial_gradient(ctx, x - radius * 0.3, y - ry * 0.3, 0.5, radius * 1.15, [
    [0, tint(colourValue, 0.4)],
    [0.6, colourValue],
    [1, shade(colourValue, 0.25)],
  ]);
  ctx.fill();
  ctx.save();
  trace_rim(0, 0);
  ctx.clip();
  // Crisp browned patches from the griddle.
  for (let patch = 0; patch < 6; patch += 1) {
    const angle = next() * TAU;
    const distance = Math.sqrt(next()) * radius * 0.75;
    fill_ellipse(
      ctx,
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance * FLAT_RATIO,
      1.2 + next() * 1.6,
      0.8 + next() * 0.9,
      css(shade(colourValue, 0.38), 0.55),
    );
  }
  // Flaky spiral layers.
  ctx.lineCap = "round";
  for (let ring = 1; ring <= 3; ring += 1) {
    const start = next() * TAU;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      radius * 0.25 * ring,
      ry * 0.25 * ring,
      0,
      start,
      start + Math.PI * (1 + next() * 0.7),
    );
    ctx.strokeStyle = css(tint(colourValue, 0.5), 0.55);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  if (isFolded) {
    // The near half is folded back over itself: a lighter flap with a crisp fold line.
    ctx.beginPath();
    ctx.ellipse(x, y, radius, ry, 0, Math.PI * 0.1, Math.PI * 0.9, false);
    ctx.closePath();
    ctx.fillStyle = css(tint(colourValue, 0.25), 0.6);
    ctx.fill();
    line(
      ctx,
      x - radius * 0.95,
      y + ry * 0.3,
      x + radius * 0.95,
      y + ry * 0.3,
      css(shade(colourValue, 0.5), 0.6),
      0.8,
    );
  }
  ctx.restore();
  paint_gloss(ctx, x - radius * 0.35, y - ry * 0.4, radius * 0.3, ry * 0.15, 0.4);
}

/**
 * Paints a whole crab seen from above: legs, two claws, the shell and its eyes.
 *
 * @param ctx - The paint context.
 * @param x - Shell centre x.
 * @param y - Shell centre y.
 * @param size - Shell width.
 * @param colourValue - The shell colour.
 */
export function paint_crab(
  ctx: PaintContext,
  x: number,
  y: number,
  size: number,
  colourValue: number,
): void {
  const bodyX = size * 0.5;
  const bodyY = size * 0.37;
  const legColour = css(shade(colourValue, 0.22));
  ctx.save();
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 3; leg += 1) {
      line(
        ctx,
        x + side * bodyX * 0.65,
        y + (leg - 1) * bodyY * 0.5,
        x + side * (bodyX + size * 0.22 + leg * 0.6),
        y + (leg - 1.2) * bodyY * 0.95 + size * 0.12,
        legColour,
        1.3,
      );
    }
    ctx.save();
    ctx.translate(x + side * (bodyX + size * 0.1), y - bodyY * 0.95);
    ctx.rotate(side * 0.65);
    fill_ellipse(ctx, 0.4, 0.7, size * 0.24, size * 0.16, css(SHADOW_INK, 0.2));
    fill_ellipse(
      ctx,
      0,
      0,
      size * 0.24,
      size * 0.16,
      radial_gradient(ctx, -size * 0.08, -size * 0.06, 0.3, size * 0.3, [
        [0, tint(colourValue, 0.3)],
        [1, shade(colourValue, 0.3)],
      ]),
    );
    line(
      ctx,
      size * 0.08,
      -size * 0.1,
      size * 0.24,
      -size * 0.04,
      css(shade(colourValue, 0.6), 0.8),
      0.8,
    );
    ctx.restore();
  }
  fill_ellipse(ctx, x + 0.6, y + 1, bodyX, bodyY, css(SHADOW_INK, 0.22));
  fill_ellipse(
    ctx,
    x,
    y,
    bodyX,
    bodyY,
    radial_gradient(ctx, x - bodyX * 0.35, y - bodyY * 0.4, 0.3, bodyX * 1.3, [
      [0, tint(colourValue, 0.28)],
      [0.7, colourValue],
      [1, shade(colourValue, 0.32)],
    ]),
  );
  ctx.beginPath();
  ctx.ellipse(x, y + bodyY * 0.1, bodyX * 0.85, bodyY * 0.8, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = css(WHITE, 0.3);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  fill_circle(ctx, x - bodyX * 0.32, y - bodyY * 0.8, 0.8, css(INK));
  fill_circle(ctx, x + bodyX * 0.32, y - bodyY * 0.8, 0.8, css(INK));
  ctx.restore();
}

/**
 * Paints a ring of fried batter or a squid ring: a thick golden ring with crumb speckles.
 *
 * @param ctx - The paint context.
 * @param x - Ring centre x.
 * @param y - Ring centre y.
 * @param radius - Ring centre-line radius.
 * @param width - Ring thickness.
 * @param colourValue - The batter colour.
 * @param seed - Speckle seed.
 */
export function paint_fried_ring(
  ctx: PaintContext,
  x: number,
  y: number,
  radius: number,
  width: number,
  colourValue: number,
  seed: number,
): void {
  stroke_ellipse(ctx, x + 0.5, y + 0.9, radius, radius, css(SHADOW_INK, 0.22), width);
  stroke_ellipse(ctx, x, y, radius, radius, css(colourValue), width);
  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI * 1.05, Math.PI * 1.6);
  ctx.strokeStyle = css(tint(colourValue, 0.4), 0.75);
  ctx.lineWidth = width * 0.45;
  ctx.lineCap = "round";
  ctx.stroke();
  const next = seeded(seed);
  for (let speck = 0; speck < 6; speck += 1) {
    const angle = next() * TAU;
    fill_circle(
      ctx,
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
      0.45 + next() * 0.4,
      css(shade(colourValue, 0.45), 0.8),
    );
  }
}
