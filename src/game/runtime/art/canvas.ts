/**
 * The painter toolkit: the Canvas 2D surface painters draw on and the shared primitives they
 * build their art from (colour strings, rounded paths, gradients, soft shadows, slabs with a
 * lit top and a shaded front face, material fills and baked text).
 *
 * Every painter in `art/` is a pure function over a {@link PaintContext}: it reads nothing but
 * its arguments, never touches Phaser, the DOM or the clock, and takes any randomness from a
 * seeded sequence, so the same spec always paints the same pixels. The texture studio hands
 * painters a context already scaled to the device pixel ratio, so painters work in world pixels
 * (48 per tile). Tests hand them a recording context, and the gallery tool hands them a
 * `@napi-rs/canvas` context.
 */

/** A gradient object as the painters use it. */
export interface PaintGradient {
  addColorStop(offset: number, colour: string): void;
}

/** A fill or stroke style: a CSS colour string or a gradient. */
export type PaintStyle = string | PaintGradient;

/**
 * The subset of `CanvasRenderingContext2D` the painters use. Keeping it explicit lets the
 * tests record calls through a proxy and lets the gallery tool pass a Node canvas context.
 */
export interface PaintContext {
  fillStyle: PaintStyle;
  strokeStyle: PaintStyle;
  lineWidth: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "round" | "bevel" | "miter";
  globalAlpha: number;
  globalCompositeOperation: string;
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  font: string;
  textAlign: "left" | "right" | "center" | "start" | "end";
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(
    x: number,
    y: number,
    radius: number,
    start: number,
    end: number,
    anticlockwise?: boolean,
  ): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    start: number,
    end: number,
    anticlockwise?: boolean,
  ): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  setLineDash(segments: number[]): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): PaintGradient;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): PaintGradient;
}

/** A painter: draws one texture's worth of art into a context, in world pixels. */
export type Painter = (ctx: PaintContext) => void;

/** World pixels per map tile, duplicated from `runtime/world.ts` so `art/` stays a leaf. */
export const TILE = 48;

/** The scene's key-light direction: everything is lit from the north-west. */
export const LIGHT_DIRECTION = { x: -0.6, y: -0.8 } as const;

/** The deep green-black every shadow is mixed from (the Art Bible's deep shadow). */
export const SHADOW_INK = 0x18323b;

/** The font stack baked text uses; a bold humanist sans that every platform has a stand-in for. */
export const SIGN_FONT_FAMILY =
  '"Avenir Next", "Segoe UI", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';

/** Two pi, for full arcs. */
export const TAU = Math.PI * 2;

/**
 * Formats a 24-bit colour as a CSS `rgba()` string.
 *
 * @param colourValue - The colour as `0xrrggbb`.
 * @param alpha - Opacity from 0 to 1; values outside are clamped.
 * @returns The CSS colour string.
 */
export function css(colourValue: number, alpha = 1): string {
  const r = (colourValue >>> 16) & 0xff;
  const g = (colourValue >>> 8) & 0xff;
  const b = colourValue & 0xff;
  const a = Math.max(0, Math.min(1, alpha));
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
}

/**
 * Blends two colours channel by channel (the same arithmetic as `visuals/palette.ts`, kept
 * here so `art/` has no import above itself).
 *
 * @param base - The starting colour.
 * @param blend - The colour blended in.
 * @param amount - Weight of `blend`, clamped to 0 to 1.
 * @returns The blended colour.
 */
export function mix(base: number, blend: number, amount: number): number {
  const weight = Math.max(0, Math.min(1, amount));
  const channel = (shift: number) =>
    Math.round(((base >>> shift) & 0xff) * (1 - weight) + ((blend >>> shift) & 0xff) * weight);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * Lightens a colour towards white.
 *
 * @param base - The starting colour.
 * @param amount - Weight of white, 0 to 1.
 * @returns The lighter colour.
 */
export function tint(base: number, amount: number): number {
  return mix(base, 0xffffff, amount);
}

/**
 * Darkens a colour towards the shadow ink.
 *
 * @param base - The starting colour.
 * @param amount - Weight of the shadow ink, 0 to 1.
 * @returns The darker colour.
 */
export function shade(base: number, amount: number): number {
  return mix(base, SHADOW_INK, amount);
}

/**
 * Makes a deterministic pseudo-random sequence (mulberry32) for speckles, grain and jitter.
 *
 * @param seed - Any 32-bit seed; recipes supply theirs.
 * @returns A function that returns the next value in [0, 1).
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Traces a rounded rectangle path (without filling it).
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @param radius - Corner radius, clamped to half the shorter side.
 */
export function rounded_rect_path(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Fills a rounded rectangle.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @param radius - Corner radius.
 * @param style - The fill style.
 */
export function fill_rounded_rect(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  style: PaintStyle,
): void {
  rounded_rect_path(ctx, x, y, width, height, radius);
  ctx.fillStyle = style;
  ctx.fill();
}

/**
 * Strokes a rounded rectangle.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @param radius - Corner radius.
 * @param style - The stroke style.
 * @param lineWidth - The stroke width.
 */
export function stroke_rounded_rect(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  style: PaintStyle,
  lineWidth: number,
): void {
  rounded_rect_path(ctx, x, y, width, height, radius);
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Fills an ellipse.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radiusX - Horizontal radius.
 * @param radiusY - Vertical radius.
 * @param style - The fill style.
 */
export function fill_ellipse(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  style: PaintStyle,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, radiusX), Math.max(0.1, radiusY), 0, 0, TAU);
  ctx.fillStyle = style;
  ctx.fill();
}

/**
 * Strokes an ellipse.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radiusX - Horizontal radius.
 * @param radiusY - Vertical radius.
 * @param style - The stroke style.
 * @param lineWidth - The stroke width.
 */
export function stroke_ellipse(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  style: PaintStyle,
  lineWidth: number,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, radiusX), Math.max(0.1, radiusY), 0, 0, TAU);
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Fills a circle.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - The radius.
 * @param style - The fill style.
 */
export function fill_circle(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  style: PaintStyle,
): void {
  fill_ellipse(ctx, cx, cy, radius, radius, style);
}

/**
 * Strokes a straight line.
 *
 * @param ctx - The paint context.
 * @param x0 - Start x.
 * @param y0 - Start y.
 * @param x1 - End x.
 * @param y1 - End y.
 * @param style - The stroke style.
 * @param lineWidth - The stroke width.
 * @param cap - The line cap; round by default, which suits the illustrated look.
 */
export function line(
  ctx: PaintContext,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  style: PaintStyle,
  lineWidth: number,
  cap: PaintContext["lineCap"] = "round",
): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = cap;
  ctx.stroke();
}

/**
 * Fills a polygon.
 *
 * @param ctx - The paint context.
 * @param points - The vertices as `[x, y]` pairs, at least three.
 * @param style - The fill style.
 */
export function fill_polygon(
  ctx: PaintContext,
  points: ReadonlyArray<readonly [number, number]>,
  style: PaintStyle,
): void {
  if (points.length < 3) return;
  ctx.beginPath();
  const [first, ...rest] = points as [readonly [number, number], ...(readonly [number, number])[]];
  ctx.moveTo(first[0], first[1]);
  for (const [x, y] of rest) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = style;
  ctx.fill();
}

/** A gradient stop: offset, colour and optional alpha. */
export type GradientStop = readonly [offset: number, colour: number, alpha?: number];

/**
 * Builds a linear gradient from colour stops.
 *
 * @param ctx - The paint context.
 * @param x0 - Start x.
 * @param y0 - Start y.
 * @param x1 - End x.
 * @param y1 - End y.
 * @param stops - The colour stops in offset order.
 * @returns The gradient, ready to use as a style.
 */
export function linear_gradient(
  ctx: PaintContext,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: readonly GradientStop[],
): PaintGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, colourValue, alpha] of stops) {
    gradient.addColorStop(offset, css(colourValue, alpha ?? 1));
  }
  return gradient;
}

/**
 * Builds a radial gradient centred on one point.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param innerRadius - Radius where the first stop sits.
 * @param outerRadius - Radius where the last stop sits.
 * @param stops - The colour stops in offset order.
 * @returns The gradient, ready to use as a style.
 */
export function radial_gradient(
  ctx: PaintContext,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  stops: readonly GradientStop[],
): PaintGradient {
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    Math.max(0, innerRadius),
    cx,
    cy,
    Math.max(0.1, outerRadius),
  );
  for (const [offset, colourValue, alpha] of stops) {
    gradient.addColorStop(offset, css(colourValue, alpha ?? 1));
  }
  return gradient;
}

/**
 * Runs a draw callback with a soft drop shadow, then restores the context.
 *
 * @param ctx - The paint context.
 * @param draw - The fills to shadow.
 * @param options - Blur radius, offset and shadow colour; defaults give the scene's key-light shadow.
 */
export function with_shadow(
  ctx: PaintContext,
  draw: () => void,
  options: {
    blur?: number;
    offsetX?: number;
    offsetY?: number;
    colour?: number;
    alpha?: number;
  } = {},
): void {
  ctx.save();
  ctx.shadowBlur = options.blur ?? 6;
  ctx.shadowOffsetX = options.offsetX ?? 2;
  ctx.shadowOffsetY = options.offsetY ?? 4;
  ctx.shadowColor = css(options.colour ?? SHADOW_INK, options.alpha ?? 0.28);
  draw();
  ctx.restore();
}

/**
 * Paints the soft contact shadow an object casts on the floor, offset to the south-east.
 *
 * @param ctx - The paint context.
 * @param x - Left of the object's footprint.
 * @param y - Top of the object's footprint.
 * @param width - Footprint width in pixels.
 * @param height - Footprint height in pixels.
 * @param options - `round` for an elliptical shadow, `inset` to pull the shadow in from the
 *   footprint edge, `alpha` for its darkness.
 */
export function contact_shadow(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    round?: boolean;
    inset?: number;
    alpha?: number;
    offsetX?: number;
    offsetY?: number;
  } = {},
): void {
  const inset = options.inset ?? 4;
  const offsetX = options.offsetX ?? 3;
  const offsetY = options.offsetY ?? 5;
  const alpha = options.alpha ?? 0.22;
  ctx.save();
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = css(SHADOW_INK, alpha);
  ctx.fillStyle = css(SHADOW_INK, alpha * 0.7);
  if (options.round) {
    ctx.beginPath();
    ctx.ellipse(
      x + width / 2 + offsetX,
      y + height / 2 + offsetY,
      Math.max(1, width / 2 - inset),
      Math.max(1, height / 2 - inset),
      0,
      0,
      TAU,
    );
    ctx.fill();
  } else {
    rounded_rect_path(
      ctx,
      x + inset + offsetX,
      y + inset + offsetY,
      Math.max(1, width - inset * 2),
      Math.max(1, height - inset * 2),
      6,
    );
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Paints a slab: a block seen from above with a lit top surface, a shaded south front face and
 * a thin tinted outline. This is the basic unit of the top-down-with-front-face perspective.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the top surface.
 * @param y - Top edge of the top surface.
 * @param width - Width of the slab.
 * @param height - Height of the top surface (the front face hangs below it).
 * @param depth - Height of the front face in pixels.
 * @param radius - Corner radius of the top surface.
 * @param colourValue - The base material colour.
 * @param options - `gloss` adds a highlight band along the top edge; `outline` sets the outline alpha.
 */
export function slab(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  radius: number,
  colourValue: number,
  options: { gloss?: number; outline?: number; front?: number } = {},
): void {
  const front = options.front ?? shade(colourValue, 0.34);
  // Front face.
  fill_rounded_rect(ctx, x, y + height - radius, width, depth + radius, radius, css(front));
  // Top surface with a soft vertical gradient (lit from the top-left).
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    radius,
    linear_gradient(ctx, x, y, x + width * 0.3, y + height, [
      [0, tint(colourValue, 0.12)],
      [1, shade(colourValue, 0.08)],
    ]),
  );
  const gloss = options.gloss ?? 0.22;
  if (gloss > 0) {
    fill_rounded_rect(
      ctx,
      x + radius * 0.6 + 1,
      y + 1.5,
      Math.max(2, width - radius * 1.2 - 2),
      Math.max(1.5, Math.min(4, height * 0.12)),
      2,
      css(0xffffff, gloss),
    );
  }
  stroke_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    radius,
    css(shade(colourValue, 0.55), options.outline ?? 0.55),
    1,
  );
}

/**
 * Scatters terrazzo chips or speckles over a rectangle.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the area.
 * @param y - Top edge of the area.
 * @param width - Width of the area.
 * @param height - Height of the area.
 * @param count - Number of chips.
 * @param colours - Chip colours, cycled.
 * @param seed - Seed for the chip positions and sizes.
 * @param size - Largest chip radius.
 */
export function speckle(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  count: number,
  colours: readonly number[],
  seed: number,
  size = 2.2,
): void {
  if (colours.length === 0 || count <= 0) return;
  const next = seeded(seed);
  for (let index = 0; index < count; index += 1) {
    const chipX = x + next() * width;
    const chipY = y + next() * height;
    const radiusX = size * (0.45 + next() * 0.55);
    const radiusY = radiusX * (0.6 + next() * 0.5);
    const colourValue = colours[index % colours.length] as number;
    ctx.save();
    ctx.translate(chipX, chipY);
    ctx.rotate(next() * Math.PI);
    fill_ellipse(ctx, 0, 0, radiusX, radiusY, css(colourValue, 0.8 + next() * 0.2));
    ctx.restore();
  }
}

/**
 * Lays timber grain over a rectangle: long translucent streaks in a lighter and a darker tone.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the plank area.
 * @param y - Top edge of the plank area.
 * @param width - Width of the area.
 * @param height - Height of the area.
 * @param base - The timber colour the streaks are mixed from.
 * @param seed - Seed for the streak positions.
 * @param isVertical - True to run the grain top to bottom.
 */
export function wood_grain(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  base: number,
  seed: number,
  isVertical = false,
): void {
  const next = seeded(seed);
  const streaks = Math.max(2, Math.round((isVertical ? width : height) / 5));
  ctx.save();
  ctx.lineCap = "round";
  for (let index = 0; index < streaks; index += 1) {
    const along = (index + 0.3 + next() * 0.5) / streaks;
    const light = next() > 0.5;
    ctx.strokeStyle = css(light ? tint(base, 0.18) : shade(base, 0.22), 0.5);
    ctx.lineWidth = 0.8 + next() * 0.9;
    ctx.beginPath();
    if (isVertical) {
      const streakX = x + along * width;
      ctx.moveTo(streakX, y + 2 + next() * 4);
      ctx.quadraticCurveTo(
        streakX + (next() - 0.5) * 3,
        y + height / 2,
        streakX,
        y + height - 2 - next() * 4,
      );
    } else {
      const streakY = y + along * height;
      ctx.moveTo(x + 2 + next() * 4, streakY);
      ctx.quadraticCurveTo(
        x + width / 2,
        streakY + (next() - 0.5) * 3,
        x + width - 2 - next() * 4,
        streakY,
      );
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Fills a rectangle with brushed stainless steel: a cool base with fine horizontal sheen bands.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height.
 * @param radius - Corner radius.
 * @param base - The steel colour; the Art Bible stainless by default.
 */
export function brushed_steel(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  base = 0xc9d3d0,
): void {
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    radius,
    linear_gradient(ctx, x, y, x, y + height, [
      [0, tint(base, 0.3)],
      [0.35, base],
      [0.6, shade(base, 0.12)],
      [1, tint(base, 0.1)],
    ]),
  );
  ctx.save();
  rounded_rect_path(ctx, x, y, width, height, radius);
  ctx.clip();
  const bands = Math.max(2, Math.floor(height / 3));
  for (let band = 0; band < bands; band += 1) {
    const bandY = y + (band + 0.5) * (height / bands);
    ctx.fillStyle = css(band % 2 === 0 ? 0xffffff : SHADOW_INK, 0.05);
    ctx.fillRect(x, bandY, width, 1);
  }
  ctx.restore();
}

/**
 * Paints a soft radial glow, for lamps, sign lightboxes and embers.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Outer radius where the glow fades to nothing.
 * @param colourValue - The glow colour.
 * @param alpha - Peak opacity at the centre.
 */
export function glow(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  colourValue: number,
  alpha: number,
): void {
  fill_circle(
    ctx,
    cx,
    cy,
    radius,
    radial_gradient(ctx, cx, cy, 0, radius, [
      [0, colourValue, alpha],
      [0.55, colourValue, alpha * 0.4],
      [1, colourValue, 0],
    ]),
  );
}

/**
 * Bakes a short text label, shrinking the font until the text fits the width budget.
 *
 * The fit is estimated from the character count (about 0.6 em per glyph for a bold sans), so
 * painters never need `measureText`, which the recording test context cannot answer.
 *
 * @param ctx - The paint context.
 * @param text - The label text.
 * @param x - Anchor x.
 * @param y - Anchor y (the text's vertical middle).
 * @param options - Max width, starting font size, colour, weight, alignment, letter case and an
 *   optional outline colour drawn behind the glyphs.
 */
export function label(
  ctx: PaintContext,
  text: string,
  x: number,
  y: number,
  options: {
    maxWidth: number;
    size?: number;
    colour?: number;
    alpha?: number;
    weight?: number;
    align?: PaintContext["textAlign"];
    uppercase?: boolean;
    outline?: number;
    letterSpacing?: boolean;
  },
): void {
  const content = options.uppercase ? text.toUpperCase() : text;
  const glyphWidth = (options.weight ?? 800) >= 700 ? 0.62 : 0.56;
  const startSize = options.size ?? 11;
  const fitted = Math.max(
    6,
    Math.min(startSize, options.maxWidth / Math.max(1, content.length * glyphWidth)),
  );
  ctx.save();
  ctx.font = `${options.weight ?? 800} ${fitted.toFixed(1)}px ${SIGN_FONT_FAMILY}`;
  ctx.textAlign = options.align ?? "center";
  ctx.textBaseline = "middle";
  if (options.outline !== undefined) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, fitted * 0.28);
    ctx.strokeStyle = css(options.outline, 0.9);
    ctx.strokeText(content, x, y, options.maxWidth);
  }
  ctx.fillStyle = css(options.colour ?? 0x263238, options.alpha ?? 1);
  ctx.fillText(content, x, y, options.maxWidth);
  ctx.restore();
}

/**
 * Strokes a thin tinted outline around a rounded rectangle, the way the illustrated style
 * separates an object from the floor without a black line.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height.
 * @param radius - Corner radius.
 * @param colourValue - The colour the outline is shaded from.
 * @param isHighContrast - True to draw the outline thicker and darker.
 */
export function outline(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  colourValue: number,
  isHighContrast = false,
): void {
  stroke_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    radius,
    css(isHighContrast ? SHADOW_INK : shade(colourValue, 0.6), isHighContrast ? 1 : 0.7),
    isHighContrast ? 2.5 : 1.2,
  );
}

/**
 * Converts a hex colour string from content (`#rrggbb`) to a number, with a fallback.
 *
 * @param value - The colour string; a leading `#` is optional.
 * @param fallback - Colour returned when the string does not parse.
 * @returns The colour number.
 */
export function parse_colour(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}
