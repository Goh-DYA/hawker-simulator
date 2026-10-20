/**
 * Dish vessels in the 3/4 view: plates, platters and the cast-iron hot plate on its timber
 * underliner seen from above with the sliver of their edge showing, bowls, claypots and bamboo steamers showing their rim and the outer side below
 * it, a kopitiam cup on its saucer and a tall glass showing its side.
 *
 * A vessel is painted in two passes around the food: `paint_vessel` paints everything behind
 * the food (the cast shadow, the body, the inside) and returns the food area plus a clip that
 * keeps food inside the rim, a `finish` pass that paints what sits in front of the food (the
 * front lip, the glass's front wall and the glaze highlights) and the high-contrast ink line.
 * `food_area` gives the same food area without painting, so the variant cues can place their
 * pieces on the vessel their dish is served in.
 *
 * Every vessel stays inside the dish texture, cast shadow and high-contrast ink included. The
 * shadows are painted gradients in world pixels rather than canvas blurs, so they scale with
 * the vessel and end at the same place at every pixel ratio. `vessel_scale` gives each vessel's
 * draw scale, so a cup, a steamer or a bowl is sized against the dinner plate as in life.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  line,
  linear_gradient,
  radial_gradient,
  seeded,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  tint,
  type PaintContext,
} from "../canvas";
import { INK, PORCELAIN, WHITE, type FoodArea } from "./parts";

/** The vessel shapes a dish can be painted in. */
export type VesselKind =
  | "plate"
  | "leaf-plate"
  | "steel-leaf-plate"
  | "platter"
  | "hot-plate"
  | "bowl"
  | "claypot"
  | "steamer"
  | "cup"
  | "glass";

/** How a vessel is dressed: its shape and its decorative band colour. */
export interface VesselStyle {
  readonly kind: VesselKind;
  /** The colour of the painted rim band or the bowl's outer band. */
  readonly band: number;
}

/** What `paint_vessel` hands back to the dish painter. */
export interface VesselPaint {
  /** Where the portion goes. */
  readonly area: FoodArea;
  /** Clips the food to the inside of the vessel (a no-op for flat dishes). */
  clip(ctx: PaintContext): void;
  /** Paints what sits in front of the food: the front lip, glass wall and glaze highlights. */
  finish(ctx: PaintContext): void;
  /**
   * Strokes the vessel's silhouette in ink, for the high-contrast frame.
   *
   * @param ctx - The paint context.
   * @param weight - Multiplies the ink widths, so a vessel drawn scaled down keeps its line.
   */
  ink(ctx: PaintContext, weight: number): void;
}

/** Stainless steel, for the Indian thali-style plates. */
const STAINLESS = 0xc9d3d0;
/** Unglazed bamboo. */
const BAMBOO = 0xc79a5c;
/** The dark glaze of a claypot. */
const CLAY_GLAZE = 0x3b2a24;
/** The unglazed clay of a claypot's lip. */
const CLAY = 0xa8673f;
/** Banana leaf green. */
const BANANA_LEAF = 0x4f8a45;

/** Plate geometry: the top ellipse radii and the visible edge thickness. */
const PLATE = { rx: 16, ry: 12.2, edge: 1.8 } as const;
/** Platter geometry: the oval's radii and how far its centre sits below the dish centre. */
const PLATTER = { rx: 16.2, ry: 11.8, drop: 0.5 } as const;
/** Bowl geometry: the rim centre offset and radii, and the depth of its outer side. */
const BOWL = { rimY: -3.6, rx: 15.6, ry: 10.6, bottom: 12.6 } as const;
/** Cup geometry, relative to the dish centre, with the saucer's radii. */
const CUP = {
  x: -1.5,
  rimY: -5,
  rx: 9.4,
  ry: 5.4,
  baseY: 8.6,
  saucerY: 7.6,
  saucerRx: 15.4,
  saucerRy: 8.6,
} as const;
/** The claypot's body radius at its rim. */
const CLAYPOT_RX = 15;
/** Glass geometry, relative to the dish centre. */
const GLASS = { x: -1, rimY: -12, rx: 7.4, ry: 2.8, baseY: 12.4, baseRx: 6.2 } as const;
/** Steamer geometry: rim offset and radii and the height of the basket wall. */
const STEAMER = { rimY: -3.2, rx: 15.6, ry: 10.2, wall: 7 } as const;
/** The ink widths of the high-contrast silhouette and rim lines. */
const INK_WIDTH = { silhouette: 1.6, rim: 1.4 } as const;

/**
 * Each vessel's draw scale, set so its width against the dinner plate matches real hawker
 * crockery: a noodle bowl or claypot about three quarters of a plate across, a dim sum steamer
 * about 0.6 and a kopitiam cup on its saucer about 0.55. Plates, platters and the hot plate
 * fill the texture, and a tall glass keeps its full height.
 */
const VESSEL_SCALE: Readonly<Record<VesselKind, number>> = {
  plate: 1,
  "leaf-plate": 1,
  "steel-leaf-plate": 1,
  platter: 1,
  "hot-plate": 1,
  bowl: (0.75 * PLATE.rx) / BOWL.rx,
  claypot: (0.75 * PLATE.rx) / CLAYPOT_RX,
  steamer: (0.6 * PLATE.rx) / STEAMER.rx,
  cup: (0.55 * PLATE.rx) / CUP.saucerRx,
  glass: 1,
};

/**
 * Gives the scale a vessel and its food are drawn at inside the dish texture, about the
 * texture's centre, so each vessel keeps its real size against the dinner plate.
 *
 * @param kind - The vessel shape.
 * @returns The draw scale, 1 for plates, platters and glasses.
 */
export function vessel_scale(kind: VesselKind): number {
  return VESSEL_SCALE[kind];
}

/**
 * Paints a soft cast shadow on the table: an ellipse whose ink fades out to its edge. It is a
 * gradient in world pixels rather than a canvas blur, so it scales with the vessel and ends at
 * the same place at every pixel ratio.
 *
 * @param ctx - The paint context.
 * @param x - Shadow centre x.
 * @param y - Shadow centre y.
 * @param rx - Horizontal radius, where the shadow has faded out.
 * @param ry - Vertical radius.
 * @param alpha - The shadow's opacity at its centre.
 */
function paint_cast_shadow(
  ctx: PaintContext,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  fill_circle(
    ctx,
    0,
    0,
    rx,
    radial_gradient(ctx, 0, 0, 0, rx, [
      [0, SHADOW_INK, alpha],
      [0.6, SHADOW_INK, alpha * 0.8],
      [1, SHADOW_INK, 0],
    ]),
  );
  ctx.restore();
}

/**
 * Gives the food area of a vessel without painting it.
 *
 * In bowls, cups and glasses the surface sinks and narrows as the serving is eaten, so the
 * level visibly drops while the vessel stays the same.
 *
 * @param kind - The vessel shape.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param scale - Draw scale (1 at the dish texture size).
 * @param remaining - The uneaten share, 1/3 to 1.
 * @returns The centre and radii the food stays within.
 */
export function food_area(
  kind: VesselKind,
  cx: number,
  cy: number,
  scale: number,
  remaining: number,
): FoodArea {
  const eaten = 1 - remaining;
  switch (kind) {
    case "plate":
      return { x: cx, y: cy - 0.4 * scale, rx: 12 * scale, ry: 9.2 * scale };
    case "leaf-plate":
    case "steel-leaf-plate":
      return { x: cx, y: cy - 0.4 * scale, rx: 12.4 * scale, ry: 9.4 * scale };
    case "platter":
      return { x: cx, y: cy, rx: 13.2 * scale, ry: 8.4 * scale };
    case "hot-plate":
      return { x: cx, y: cy - 0.6 * scale, rx: 11.6 * scale, ry: 7.8 * scale };
    case "bowl": {
      const narrow = 1 - eaten * 0.16;
      return {
        x: cx,
        y: cy + (BOWL.rimY + 1.9 + eaten * 2.6) * scale,
        rx: 12.6 * narrow * scale,
        ry: 8.2 * narrow * scale,
      };
    }
    case "claypot": {
      const narrow = 1 - eaten * 0.14;
      return {
        x: cx,
        y: cy + (BOWL.rimY + 2 + eaten * 2) * scale,
        rx: 11.8 * narrow * scale,
        ry: 7.6 * narrow * scale,
      };
    }
    case "steamer":
      return { x: cx, y: cy + (STEAMER.rimY + 1.6) * scale, rx: 11.8 * scale, ry: 7.2 * scale };
    case "cup": {
      const narrow = 1 - eaten * 0.18;
      return {
        x: cx + CUP.x * scale,
        y: cy + (CUP.rimY + 0.9 + eaten * 3.2) * scale,
        rx: 8.2 * narrow * scale,
        ry: 4.5 * narrow * scale,
      };
    }
    case "glass": {
      const top = glass_level(cy, scale, remaining);
      const rx = glass_half_width(cy, scale, top) - 0.7 * scale;
      return { x: cx + GLASS.x * scale, y: top, rx, ry: rx * 0.38 };
    }
  }
}

/**
 * Gives the y of a glass's liquid surface for how much of the drink is left.
 *
 * @param cy - Dish centre y.
 * @param scale - Draw scale.
 * @param remaining - The uneaten share, 1/3 to 1.
 * @returns The surface y.
 */
function glass_level(cy: number, scale: number, remaining: number): number {
  return cy + (GLASS.rimY + 2.6 + (1 - remaining) * 14) * scale;
}

/**
 * Gives the inside of a kopitiam cup's rim, which a drink's surface is clipped to.
 *
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param scale - Draw scale.
 * @returns The inner rim ellipse.
 */
export function cup_inner(cx: number, cy: number, scale: number): FoodArea {
  return {
    x: cx + CUP.x * scale,
    y: cy + (CUP.rimY + 0.3) * scale,
    rx: (CUP.rx - 1.1) * scale,
    ry: (CUP.ry - 0.8) * scale,
  };
}

/**
 * Gives a glass's half width at a height, tapering from the rim to the base.
 *
 * @param cy - Dish centre y.
 * @param scale - Draw scale.
 * @param y - The height to measure at.
 * @returns The half width.
 */
function glass_half_width(cy: number, scale: number, y: number): number {
  const top = cy + GLASS.rimY * scale;
  const bottom = cy + GLASS.baseY * scale;
  const t = Math.max(0, Math.min(1, (y - top) / (bottom - top)));
  return (GLASS.rx + (GLASS.baseRx - GLASS.rx) * t) * scale;
}

/**
 * Paints the column of drink inside a tall glass, seen through its side, with its surface.
 *
 * @param ctx - The paint context.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param scale - Draw scale.
 * @param remaining - The uneaten share, which sets the level.
 * @param colourValue - The drink colour.
 * @returns The surface area, for foam, ice and straws.
 */
export function paint_glass_drink(
  ctx: PaintContext,
  cx: number,
  cy: number,
  scale: number,
  remaining: number,
  colourValue: number,
): FoodArea {
  const area = food_area("glass", cx, cy, scale, remaining);
  const bottom = cy + (GLASS.baseY - 0.8) * scale;
  const baseRx = GLASS.baseRx * scale - 0.7 * scale;
  ctx.beginPath();
  ctx.moveTo(area.x - area.rx, area.y);
  ctx.lineTo(area.x - baseRx, bottom);
  ctx.ellipse(area.x, bottom, baseRx, baseRx * 0.38, 0, Math.PI, 0, true);
  ctx.lineTo(area.x + area.rx, area.y);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, area.x - area.rx, 0, area.x + area.rx, 0, [
    [0, tint(colourValue, 0.25), 0.94],
    [0.4, colourValue, 0.94],
    [1, shade(colourValue, 0.3), 0.94],
  ]);
  ctx.fill();
  fill_ellipse(
    ctx,
    area.x,
    area.y,
    area.rx,
    area.ry,
    radial_gradient(ctx, area.x - area.rx * 0.3, area.y - area.ry * 0.3, 0.2, area.rx, [
      [0, tint(colourValue, 0.3)],
      [1, tint(colourValue, 0.05)],
    ]),
  );
  return area;
}

/**
 * Paints a vessel behind its food.
 *
 * @param ctx - The paint context.
 * @param style - The vessel shape and band colour.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param remaining - The uneaten share, which lowers the level in bowls, cups and glasses.
 * @param isLowDetail - True to skip fine texture passes.
 * @returns The food area and the clip, finish and ink passes.
 */
export function paint_vessel(
  ctx: PaintContext,
  style: VesselStyle,
  cx: number,
  cy: number,
  remaining: number,
  isLowDetail: boolean,
): VesselPaint {
  const area = food_area(style.kind, cx, cy, 1, remaining);
  switch (style.kind) {
    case "plate":
    case "leaf-plate":
    case "steel-leaf-plate":
      return paint_plate(ctx, style, cx, cy, area, isLowDetail);
    case "platter":
      return paint_platter(ctx, style, cx, cy, area);
    case "hot-plate":
      return paint_hot_plate(ctx, cx, cy, area, isLowDetail);
    case "bowl":
      return paint_bowl(ctx, style, cx, cy, area, PORCELAIN, isLowDetail);
    case "claypot":
      return paint_claypot(ctx, cx, cy, area);
    case "steamer":
      return paint_steamer(ctx, cx, cy, area, isLowDetail);
    case "cup":
      return paint_cup(ctx, style, cx, cy, area);
    case "glass":
      return paint_glass(ctx, cx, cy, area);
  }
}

/**
 * Builds the clip that keeps food inside an open vessel: the front half of the inner rim
 * ellipse, opened upwards so food piled above the rim still shows.
 *
 * @param x - Inner rim centre x.
 * @param y - Inner rim centre y.
 * @param rx - Inner rim horizontal radius.
 * @param ry - Inner rim vertical radius.
 * @returns The clip pass.
 */
function rim_clip(x: number, y: number, rx: number, ry: number): (ctx: PaintContext) => void {
  return (ctx) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI, false);
    ctx.lineTo(x - rx, y - 40);
    ctx.lineTo(x + rx, y - 40);
    ctx.closePath();
    ctx.clip();
  };
}

/**
 * Paints the glaze on a rim: a bright arc on the lit far edge and a soft line on the front lip,
 * which sits in front of the food.
 *
 * @param ctx - The paint context.
 * @param x - Rim centre x.
 * @param y - Rim centre y.
 * @param rx - Rim horizontal radius.
 * @param ry - Rim vertical radius.
 * @param lip - The lip colour.
 */
function paint_rim_glaze(
  ctx: PaintContext,
  x: number,
  y: number,
  rx: number,
  ry: number,
  lip: number,
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(x, y, rx - 0.7, ry - 0.6, 0, 0.08 * Math.PI, 0.92 * Math.PI, false);
  ctx.strokeStyle = css(lip);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, rx - 0.7, ry - 0.6, 0, 1.08 * Math.PI, 1.55 * Math.PI, false);
  ctx.strokeStyle = css(WHITE, 0.85);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, rx - 0.2, ry - 0.1, 0, 0.3 * Math.PI, 0.55 * Math.PI, false);
  ctx.strokeStyle = css(WHITE, 0.7);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints a round plate: its cast shadow, the edge sliver, the glazed top, the well and its
 * painted band, plus a banana-leaf lining on the leaf plates.
 *
 * @param ctx - The paint context.
 * @param style - The vessel style.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param area - The food area.
 * @param isLowDetail - True to skip the leaf veins and steel brushing.
 * @returns The plate passes.
 */
function paint_plate(
  ctx: PaintContext,
  style: VesselStyle,
  cx: number,
  cy: number,
  area: FoodArea,
  isLowDetail: boolean,
): VesselPaint {
  const isSteel = style.kind === "steel-leaf-plate";
  const body = isSteel ? STAINLESS : PORCELAIN;
  const { rx, ry, edge } = PLATE;
  paint_cast_shadow(ctx, cx + 1.1, cy + edge + 1.3, rx + 0.6, ry + 0.8, 0.36);
  fill_ellipse(ctx, cx, cy + edge, rx, ry, css(shade(body, isSteel ? 0.4 : 0.26)));
  fill_ellipse(
    ctx,
    cx,
    cy,
    rx,
    ry,
    linear_gradient(ctx, cx - rx, cy - ry, cx + rx * 0.6, cy + ry, [
      [0, tint(body, 0.6)],
      [0.5, body],
      [1, shade(body, isSteel ? 0.18 : 0.08)],
    ]),
  );
  if (isSteel && !isLowDetail) {
    for (let ring = 1; ring <= 3; ring += 1) {
      stroke_ellipse(
        ctx,
        cx,
        cy,
        rx * (1 - ring * 0.05),
        ry * (1 - ring * 0.05),
        css(WHITE, 0.25),
        0.4,
      );
    }
  }
  fill_ellipse(
    ctx,
    cx + 0.3,
    cy + 0.5,
    rx * 0.76,
    ry * 0.75,
    radial_gradient(ctx, cx + 2, cy + 2.5, 1, rx * 0.8, [
      [0, tint(body, 0.35)],
      [0.75, body],
      [1, shade(body, 0.16)],
    ]),
  );
  if (!isSteel) stroke_ellipse(ctx, cx, cy, rx * 0.88, ry * 0.88, css(style.band, 0.6), 0.9);
  if (style.kind !== "plate") paint_banana_leaf(ctx, cx, cy, isLowDetail);
  return {
    area,
    clip: () => undefined,
    finish: (target) => {
      target.save();
      target.beginPath();
      target.ellipse(cx, cy, rx - 0.6, ry - 0.5, 0, 1.08 * Math.PI, 1.5 * Math.PI, false);
      target.strokeStyle = css(WHITE, 0.9);
      target.lineWidth = 0.9;
      target.lineCap = "round";
      target.stroke();
      target.restore();
    },
    ink: (target, weight) => {
      stroke_ellipse(
        target,
        cx,
        cy + edge * 0.5,
        rx + 0.3,
        ry + edge * 0.5 + 0.3,
        css(INK),
        INK_WIDTH.silhouette * weight,
      );
    },
  };
}

/**
 * Paints a square of banana leaf lining a plate: a glossy green sheet with a pale midrib and
 * fine parallel veins.
 *
 * @param ctx - The paint context.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param isLowDetail - True to skip the veins.
 */
function paint_banana_leaf(ctx: PaintContext, cx: number, cy: number, isLowDetail: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, PLATE.rx * 0.93, PLATE.ry * 0.92, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.beginPath();
  ctx.moveTo(-16, -6.5);
  ctx.quadraticCurveTo(0, -10.5, 15, -7.5);
  ctx.lineTo(14.5, 7.5);
  ctx.quadraticCurveTo(0, 11, -15.5, 7);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, -12, -9, 12, 9, [
    [0, tint(BANANA_LEAF, 0.3)],
    [0.5, BANANA_LEAF],
    [1, shade(BANANA_LEAF, 0.3)],
  ]);
  ctx.fill();
  line(ctx, -15, -2.2, 14.5, -1.4, css(0xb8d08a, 0.85), 0.9);
  if (!isLowDetail) {
    for (let vein = -13; vein <= 13; vein += 2.2) {
      line(ctx, vein, -2, vein + 2.4, -9, css(0x9cc070, 0.35), 0.5);
      line(ctx, vein, -1.6, vein + 2.4, 8.5, css(shade(BANANA_LEAF, 0.4), 0.35), 0.5);
    }
  }
  fill_ellipse(ctx, -6, -6, 6, 1.2, css(WHITE, 0.25));
  ctx.restore();
}

/** The sizzling plate: a timber underliner under a cast-iron oval with a raised lip. */
const HOT_PLATE = { rx: 16.4, ry: 12, ironRx: 14.2, ironRy: 9.8, lift: 1.4 } as const;
/** Cast iron. */
const IRON = 0x2b2826;
/** The timber underliner. */
const UNDERLINER = 0x8a5a32;
/** Where the underliner's grain strokes run, as vertical offsets from its centre. */
const UNDERLINER_GRAIN: readonly number[] = [-6, -2, 3, 7];

/**
 * Paints a hawker Western sizzling plate: an oval cast-iron plate with a raised lip, sitting
 * in an oval timber underliner, with a faint heat sheen on the iron.
 *
 * @param ctx - The paint context.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param area - The food area.
 * @param isLowDetail - True to skip the wood grain and soften the highlight.
 * @returns The hot plate passes.
 */
function paint_hot_plate(
  ctx: PaintContext,
  cx: number,
  cy: number,
  area: FoodArea,
  isLowDetail: boolean,
): VesselPaint {
  const { rx, ry, ironRx, ironRy, lift } = HOT_PLATE;
  const top = cy + 0.8;
  paint_cast_shadow(ctx, cx + 1, top + 3, rx + 0.4, ry + 0.6, 0.36);
  fill_ellipse(ctx, cx, top + 1.6, rx, ry, css(shade(UNDERLINER, 0.35)));
  fill_ellipse(
    ctx,
    cx,
    top,
    rx,
    ry,
    linear_gradient(ctx, cx - rx, top - ry, cx + rx, top + ry, [
      [0, tint(UNDERLINER, 0.25)],
      [1, shade(UNDERLINER, 0.15)],
    ]),
  );
  if (!isLowDetail) {
    for (const offset of UNDERLINER_GRAIN) {
      stroke_ellipse(
        ctx,
        cx,
        top + offset * 0.25,
        rx * 0.97,
        ry * 0.2 + Math.abs(offset) * 0.6,
        css(shade(UNDERLINER, 0.3), 0.25),
        0.4,
      );
    }
  }
  const iron_y = top - lift;
  fill_ellipse(ctx, cx, iron_y + 1.4, ironRx, ironRy, css(shade(IRON, 0.4)));
  fill_ellipse(ctx, cx, iron_y, ironRx, ironRy, css(IRON));
  fill_ellipse(
    ctx,
    cx + 0.3,
    iron_y + 0.5,
    ironRx * 0.86,
    ironRy * 0.84,
    radial_gradient(ctx, cx - 3, iron_y - 3, 1, ironRx, [
      [0, tint(IRON, 0.22)],
      [1, shade(IRON, 0.2)],
    ]),
  );
  return {
    area,
    clip: () => undefined,
    finish: (target) => {
      target.save();
      target.beginPath();
      target.ellipse(
        cx,
        iron_y,
        ironRx - 0.5,
        ironRy - 0.4,
        0,
        1.05 * Math.PI,
        1.55 * Math.PI,
        false,
      );
      target.strokeStyle = css(WHITE, isLowDetail ? 0.35 : 0.55);
      target.lineWidth = 0.7;
      target.stroke();
      target.restore();
    },
    ink: (target, weight) =>
      stroke_ellipse(
        target,
        cx,
        top + 0.8,
        rx + 0.3,
        ry + 1,
        css(INK),
        INK_WIDTH.silhouette * weight,
      ),
  };
}

/**
 * Paints an oval sharing platter with a vermilion rim band.
 *
 * @param ctx - The paint context.
 * @param style - The vessel style.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param area - The food area.
 * @returns The platter passes.
 */
function paint_platter(
  ctx: PaintContext,
  style: VesselStyle,
  cx: number,
  cy: number,
  area: FoodArea,
): VesselPaint {
  const { rx, ry } = PLATTER;
  const top = cy + PLATTER.drop;
  paint_cast_shadow(ctx, cx + 1, top + 2.8, rx + 0.4, ry + 0.8, 0.36);
  fill_ellipse(ctx, cx, top + 1.6, rx, ry, css(shade(PORCELAIN, 0.26)));
  fill_ellipse(
    ctx,
    cx,
    top,
    rx,
    ry,
    linear_gradient(ctx, cx - rx, top - ry, cx + rx * 0.6, top + ry, [
      [0, tint(PORCELAIN, 0.6)],
      [0.5, PORCELAIN],
      [1, shade(PORCELAIN, 0.08)],
    ]),
  );
  stroke_ellipse(ctx, cx, top, rx * 0.91, ry * 0.9, css(style.band, 0.85), 1.1);
  stroke_ellipse(ctx, cx, top, rx * 0.84, ry * 0.82, css(style.band, 0.45), 0.5);
  fill_ellipse(
    ctx,
    cx + 0.3,
    top + 0.4,
    rx * 0.78,
    ry * 0.74,
    radial_gradient(ctx, cx + 2, top + 2, 1, rx * 0.8, [
      [0, tint(PORCELAIN, 0.35)],
      [0.8, PORCELAIN],
      [1, shade(PORCELAIN, 0.14)],
    ]),
  );
  return {
    area,
    clip: () => undefined,
    finish: (target) => {
      target.save();
      target.beginPath();
      target.ellipse(cx, top, rx - 0.6, ry - 0.5, 0, 1.08 * Math.PI, 1.5 * Math.PI, false);
      target.strokeStyle = css(WHITE, 0.9);
      target.lineWidth = 0.9;
      target.stroke();
      target.restore();
    },
    ink: (target, weight) =>
      stroke_ellipse(
        target,
        cx,
        top + 0.8,
        rx + 0.3,
        ry + 1.1,
        css(INK),
        INK_WIDTH.silhouette * weight,
      ),
  };
}

/**
 * Traces a rounded bowl body from its rim ellipse down to its foot.
 *
 * @param ctx - The paint context.
 * @param cx - Bowl centre x.
 * @param rimY - Rim centre y.
 * @param rx - Rim horizontal radius.
 * @param bottom - Foot y.
 * @param belly - How far the sides bulge before curving in (0 to 1).
 * @param isClosed - False to leave the rim side open, for stroking the silhouette.
 */
function trace_bowl_body(
  ctx: PaintContext,
  cx: number,
  rimY: number,
  rx: number,
  bottom: number,
  belly: number,
  isClosed = true,
): void {
  const depth = bottom - rimY;
  ctx.beginPath();
  ctx.moveTo(cx - rx, rimY);
  ctx.bezierCurveTo(cx - rx, rimY + depth * belly, cx - rx * 0.55, bottom, cx, bottom);
  ctx.bezierCurveTo(cx + rx * 0.55, bottom, cx + rx, rimY + depth * belly, cx + rx, rimY);
  if (isClosed) ctx.closePath();
}

/**
 * Paints a deep bowl: its foot and cast shadow, the rounded outer side with a painted band, the
 * rim and the shaded inside.
 *
 * @param ctx - The paint context.
 * @param style - The vessel style.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param area - The food area.
 * @param body - The glaze colour.
 * @param isLowDetail - True to paint a single band line.
 * @returns The bowl passes.
 */
function paint_bowl(
  ctx: PaintContext,
  style: VesselStyle,
  cx: number,
  cy: number,
  area: FoodArea,
  body: number,
  isLowDetail: boolean,
): VesselPaint {
  const rimY = cy + BOWL.rimY;
  const bottom = cy + BOWL.bottom;
  const { rx, ry } = BOWL;
  paint_cast_shadow(ctx, cx + 2.2, bottom - 0.8, rx * 0.82, 3.8, 0.4);
  fill_ellipse(ctx, cx, bottom - 1.2, 5.6, 1.8, css(shade(body, 0.4)));
  trace_bowl_body(ctx, cx, rimY, rx, bottom - 1.5, 0.62);
  ctx.fillStyle = linear_gradient(ctx, cx - rx, 0, cx + rx, 0, [
    [0, tint(body, 0.5)],
    [0.4, body],
    [1, shade(body, 0.3)],
  ]);
  ctx.fill();
  trace_bowl_body(ctx, cx, rimY, rx, bottom - 1.5, 0.62);
  ctx.fillStyle = linear_gradient(ctx, 0, rimY, 0, bottom, [
    [0, SHADOW_INK, 0],
    [0.55, SHADOW_INK, 0.04],
    [1, SHADOW_INK, 0.22],
  ]);
  ctx.fill();
  ctx.save();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(cx, rimY + 3.4, rx - 0.5, ry - 0.3, 0, 0.1 * Math.PI, 0.9 * Math.PI, false);
  ctx.strokeStyle = css(style.band, 0.9);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!isLowDetail) {
    ctx.beginPath();
    ctx.ellipse(cx, rimY + 5.6, rx - 1.6, ry - 1.4, 0, 0.16 * Math.PI, 0.84 * Math.PI, false);
    ctx.strokeStyle = css(style.band, 0.5);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.restore();
  fill_ellipse(ctx, cx, rimY, rx, ry, css(tint(body, 0.45)));
  const inner = { x: cx, y: rimY + 0.4, rx: rx - 1.4, ry: ry - 1.2 };
  fill_ellipse(
    ctx,
    inner.x,
    inner.y,
    inner.rx,
    inner.ry,
    linear_gradient(ctx, 0, inner.y - inner.ry, 0, inner.y + inner.ry, [
      [0, shade(body, 0.32)],
      [0.45, shade(body, 0.1)],
      [1, tint(body, 0.2)],
    ]),
  );
  return {
    area,
    clip: rim_clip(inner.x, inner.y, inner.rx, inner.ry),
    finish: (target) => paint_rim_glaze(target, cx, rimY, rx, ry, tint(body, 0.5)),
    ink: (target, weight) => {
      trace_bowl_body(target, cx, rimY, rx, bottom - 1.5, 0.62, false);
      target.strokeStyle = css(INK);
      target.lineWidth = INK_WIDTH.silhouette * weight;
      target.stroke();
      stroke_ellipse(target, cx, rimY, rx, ry, css(INK), INK_WIDTH.rim * weight);
    },
  };
}

/**
 * Paints a claypot: a squat, dark-glazed pot with an unglazed clay lip and two lug handles.
 *
 * @param ctx - The paint context.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param area - The food area.
 * @returns The claypot passes.
 */
function paint_claypot(ctx: PaintContext, cx: number, cy: number, area: FoodArea): VesselPaint {
  const rimY = cy + BOWL.rimY;
  const rx = CLAYPOT_RX;
  const ry = 10.2;
  const bottom = cy + 11.6;
  paint_cast_shadow(ctx, cx + 2, bottom - 0.4, 13.4, 4.2, 0.42);
  fill_ellipse(ctx, cx, bottom - 1.5, 11, 3, css(CLAY_GLAZE));
  for (const side of [-1, 1]) {
    fill_ellipse(ctx, cx + side * (rx + 0.6), rimY + 3.5, 2, 1.4, css(shade(CLAY_GLAZE, 0.2)));
  }
  trace_bowl_body(ctx, cx, rimY, rx, bottom, 0.8);
  ctx.fillStyle = linear_gradient(ctx, cx - rx, 0, cx + rx, 0, [
    [0, tint(CLAY_GLAZE, 0.35)],
    [0.35, CLAY_GLAZE],
    [1, shade(CLAY_GLAZE, 0.4)],
  ]);
  ctx.fill();
  fill_ellipse(ctx, cx - rx * 0.5, rimY + 6, 2.2, 3.4, css(WHITE, 0.18));
  fill_ellipse(ctx, cx, rimY, rx, ry, css(CLAY));
  fill_ellipse(ctx, cx, rimY + 0.4, rx - 1.6, ry - 1.4, css(shade(CLAY_GLAZE, 0.3)));
  const inner = { x: cx, y: rimY + 0.4, rx: rx - 1.6, ry: ry - 1.4 };
  return {
    area,
    clip: rim_clip(inner.x, inner.y, inner.rx, inner.ry),
    finish: (target) => paint_rim_glaze(target, cx, rimY, rx, ry, tint(CLAY, 0.2)),
    ink: (target, weight) => {
      trace_bowl_body(target, cx, rimY, rx, bottom, 0.8, false);
      target.strokeStyle = css(INK);
      target.lineWidth = INK_WIDTH.silhouette * weight;
      target.stroke();
      stroke_ellipse(target, cx, rimY, rx, ry, css(INK), INK_WIDTH.rim * weight);
    },
  };
}

/**
 * Paints a bamboo steamer basket: the woven wall with its binding bands, the rim and the
 * paper-lined slatted floor.
 *
 * @param ctx - The paint context.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param area - The food area.
 * @param isLowDetail - True to skip the weave and slats.
 * @returns The steamer passes.
 */
function paint_steamer(
  ctx: PaintContext,
  cx: number,
  cy: number,
  area: FoodArea,
  isLowDetail: boolean,
): VesselPaint {
  const rimY = cy + STEAMER.rimY;
  const floor = rimY + STEAMER.wall;
  const { rx, ry } = STEAMER;
  const trace_wall = (target: PaintContext) => {
    target.beginPath();
    target.moveTo(cx - rx, rimY);
    target.lineTo(cx - rx, floor);
    target.ellipse(cx, floor, rx, ry, 0, Math.PI, 0, true);
    target.lineTo(cx + rx, rimY);
    target.ellipse(cx, rimY, rx, ry, 0, 0, Math.PI, false);
    target.closePath();
  };
  paint_cast_shadow(ctx, cx + 1.6, floor + 1.6, rx + 0.6, ry + 0.8, 0.4);
  fill_ellipse(ctx, cx, floor, rx, ry, css(shade(BAMBOO, 0.4)));
  trace_wall(ctx);
  ctx.fillStyle = linear_gradient(ctx, cx - rx, 0, cx + rx, 0, [
    [0, tint(BAMBOO, 0.3)],
    [0.4, BAMBOO],
    [1, shade(BAMBOO, 0.35)],
  ]);
  ctx.fill();
  if (!isLowDetail) {
    ctx.save();
    trace_wall(ctx);
    ctx.clip();
    for (let slat = -rx; slat <= rx; slat += 2.2) {
      line(ctx, cx + slat, rimY, cx + slat, floor + ry, css(shade(BAMBOO, 0.35), 0.35), 0.5);
    }
    ctx.restore();
  }
  for (const [offset, width] of [
    [1.3, 1.6],
    [STEAMER.wall - 0.6, 1.8],
  ] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, rimY + offset, rx - 0.2, ry, 0, 0.02 * Math.PI, 0.98 * Math.PI, false);
    ctx.strokeStyle = css(shade(BAMBOO, 0.3));
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }
  fill_ellipse(ctx, cx, rimY, rx, ry, css(tint(BAMBOO, 0.2)));
  const inner = { x: cx, y: rimY + 0.4, rx: rx - 1.6, ry: ry - 1.3 };
  fill_ellipse(
    ctx,
    inner.x,
    inner.y,
    inner.rx,
    inner.ry,
    linear_gradient(ctx, 0, inner.y - inner.ry, 0, inner.y + inner.ry, [
      [0, shade(BAMBOO, 0.35)],
      [0.35, 0xe9dcbc],
      [1, 0xf4ead2],
    ]),
  );
  if (!isLowDetail) {
    const next = seeded(0x5ea3);
    for (let hole = 0; hole < 7; hole += 1) {
      fill_circle(
        ctx,
        inner.x + (next() - 0.5) * inner.rx * 1.4,
        inner.y + (next() - 0.2) * inner.ry * 0.9,
        0.4,
        css(shade(BAMBOO, 0.3), 0.6),
      );
    }
  }
  return {
    area,
    clip: rim_clip(inner.x, inner.y, inner.rx, inner.ry),
    finish: (target) => paint_rim_glaze(target, cx, rimY, rx, ry, tint(BAMBOO, 0.35)),
    ink: (target, weight) => {
      trace_wall(target);
      target.strokeStyle = css(INK);
      target.lineWidth = INK_WIDTH.silhouette * weight;
      target.stroke();
      stroke_ellipse(target, cx, rimY, rx, ry, css(INK), INK_WIDTH.rim * weight);
    },
  };
}

/**
 * Paints a kopitiam cup on its saucer: the saucer, the thick white cup with its green leaf
 * print and handle, and the inside of the rim.
 *
 * @param ctx - The paint context.
 * @param style - The vessel style.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param area - The food area (the drink's surface).
 * @returns The cup passes.
 */
function paint_cup(
  ctx: PaintContext,
  style: VesselStyle,
  cx: number,
  cy: number,
  area: FoodArea,
): VesselPaint {
  const saucerY = cy + CUP.saucerY;
  const x = cx + CUP.x;
  const rimY = cy + CUP.rimY;
  const baseY = cy + CUP.baseY;
  const { saucerRx, saucerRy } = CUP;
  paint_cast_shadow(ctx, cx + 1.2, saucerY + 2.4, saucerRx + 0.8, saucerRy + 1, 0.36);
  fill_ellipse(ctx, cx, saucerY + 1.4, saucerRx, saucerRy, css(shade(PORCELAIN, 0.28)));
  fill_ellipse(
    ctx,
    cx,
    saucerY,
    saucerRx,
    saucerRy,
    linear_gradient(ctx, cx - 15, saucerY - 8, cx + 10, saucerY + 8, [
      [0, tint(PORCELAIN, 0.6)],
      [0.5, PORCELAIN],
      [1, shade(PORCELAIN, 0.1)],
    ]),
  );
  stroke_ellipse(ctx, cx, saucerY, 13.6, 7.6, css(style.band, 0.55), 0.8);
  fill_ellipse(ctx, cx + 0.5, saucerY + 0.6, 9.4, 5, css(shade(PORCELAIN, 0.12)));
  const trace_cup = (target: PaintContext, isClosed = true) => {
    target.beginPath();
    target.moveTo(x - CUP.rx, rimY);
    target.bezierCurveTo(x - CUP.rx, rimY + 9, x - 6.8, baseY, x, baseY);
    target.bezierCurveTo(x + 6.8, baseY, x + CUP.rx, rimY + 9, x + CUP.rx, rimY);
    if (isClosed) target.closePath();
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + CUP.rx - 0.8, rimY + 2.4);
  ctx.bezierCurveTo(
    x + CUP.rx + 5.6,
    rimY + 1.6,
    x + CUP.rx + 5.2,
    rimY + 9.6,
    x + CUP.rx - 2.2,
    rimY + 9.4,
  );
  ctx.strokeStyle = css(shade(PORCELAIN, 0.2));
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.strokeStyle = css(tint(PORCELAIN, 0.5));
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();
  paint_cast_shadow(ctx, x + 2.4, baseY - 0.6, 7.6, 3.2, 0.34);
  trace_cup(ctx);
  ctx.fillStyle = linear_gradient(ctx, x - CUP.rx, 0, x + CUP.rx, 0, [
    [0, tint(PORCELAIN, 0.6)],
    [0.4, PORCELAIN],
    [1, shade(PORCELAIN, 0.26)],
  ]);
  ctx.fill();
  for (const [dx, dy, angle] of [
    [-4.2, 5.6, -0.6],
    [0.2, 6.4, 0.4],
    [4.2, 5.4, -0.2],
  ] as const) {
    ctx.save();
    ctx.translate(x + dx, rimY + dy);
    ctx.rotate(angle);
    fill_ellipse(ctx, 0, 0, 1.6, 0.7, css(0x3f8a54, 0.9));
    ctx.restore();
  }
  fill_circle(ctx, x - 2, rimY + 6.8, 0.6, css(0xd95d39, 0.85));
  fill_circle(ctx, x + 2.2, rimY + 7.3, 0.6, css(0xd95d39, 0.85));
  fill_ellipse(ctx, x, rimY, CUP.rx, CUP.ry, css(tint(PORCELAIN, 0.5)));
  const inner = { x, y: rimY + 0.3, rx: CUP.rx - 1.1, ry: CUP.ry - 0.8 };
  fill_ellipse(
    ctx,
    inner.x,
    inner.y,
    inner.rx,
    inner.ry,
    linear_gradient(ctx, 0, inner.y - inner.ry, 0, inner.y + inner.ry, [
      [0, shade(PORCELAIN, 0.3)],
      [1, tint(PORCELAIN, 0.2)],
    ]),
  );
  return {
    area,
    // The drink clips itself to the cup (`cup_inner`), so the spoon and sugar on the saucer
    // can sit outside the rim.
    clip: () => undefined,
    finish: (target) => paint_rim_glaze(target, x, rimY, CUP.rx, CUP.ry, tint(PORCELAIN, 0.6)),
    ink: (target, weight) => {
      stroke_ellipse(
        target,
        cx,
        saucerY + 0.7,
        saucerRx + 0.2,
        saucerRy + 0.6,
        css(INK),
        INK_WIDTH.rim * weight,
      );
      trace_cup(target, false);
      target.strokeStyle = css(INK);
      target.lineWidth = INK_WIDTH.silhouette * weight;
      target.stroke();
      stroke_ellipse(target, x, rimY, CUP.rx, CUP.ry, css(INK), INK_WIDTH.rim * weight);
    },
  };
}

/**
 * Paints a tall drinking glass: its cast shadow and the faint back wall; the drink itself is
 * painted by the motif, and the front wall, rim and highlights by the finish pass.
 *
 * @param ctx - The paint context.
 * @param cx - Dish centre x.
 * @param cy - Dish centre y.
 * @param area - The food area (the drink's surface).
 * @returns The glass passes.
 */
function paint_glass(ctx: PaintContext, cx: number, cy: number, area: FoodArea): VesselPaint {
  const x = cx + GLASS.x;
  const rimY = cy + GLASS.rimY;
  const baseY = cy + GLASS.baseY;
  const trace_glass = (target: PaintContext, isClosed = true) => {
    target.beginPath();
    target.moveTo(x - GLASS.rx, rimY);
    target.lineTo(x - GLASS.baseRx, baseY);
    target.ellipse(x, baseY, GLASS.baseRx, GLASS.baseRx * 0.38, 0, Math.PI, 0, true);
    target.lineTo(x + GLASS.rx, rimY);
    if (isClosed) target.closePath();
  };
  paint_cast_shadow(ctx, x + 2.6, baseY + 1.2, GLASS.baseRx + 3, 3.4, 0.34);
  fill_ellipse(ctx, x, baseY, GLASS.baseRx, 2.4, css(0xb9cfcd, 0.7));
  trace_glass(ctx);
  ctx.fillStyle = css(0xe2efee, 0.4);
  ctx.fill();
  stroke_ellipse(ctx, x, rimY, GLASS.rx, GLASS.ry, css(0x9fbcba, 0.6), 0.6);
  return {
    area,
    clip: () => undefined,
    finish: (target) => {
      trace_glass(target, false);
      target.strokeStyle = css(0x7fa3a0, 0.75);
      target.lineWidth = 0.8;
      target.stroke();
      stroke_ellipse(target, x, baseY - 0.6, GLASS.baseRx - 0.4, 1.8, css(WHITE, 0.55), 1);
      line(
        target,
        x - GLASS.rx + 1.8,
        rimY + 2.5,
        x - GLASS.baseRx + 1.6,
        baseY - 2.5,
        css(WHITE, 0.6),
        1.3,
      );
      line(
        target,
        x + GLASS.rx - 1.6,
        rimY + 3,
        x + GLASS.baseRx - 1.4,
        baseY - 3,
        css(WHITE, 0.25),
        0.7,
      );
      target.save();
      target.beginPath();
      target.ellipse(x, rimY, GLASS.rx, GLASS.ry, 0, 0, Math.PI, false);
      target.strokeStyle = css(WHITE, 0.85);
      target.lineWidth = 0.9;
      target.stroke();
      target.restore();
    },
    ink: (target, weight) => {
      trace_glass(target, false);
      target.strokeStyle = css(INK);
      target.lineWidth = INK_WIDTH.silhouette * weight;
      target.stroke();
      stroke_ellipse(target, x, rimY, GLASS.rx, GLASS.ry, css(INK), 1.2 * weight);
    },
  };
}
