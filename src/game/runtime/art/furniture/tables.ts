/**
 * Table painters: the eight launch tables (compact laminate, round marble café, long communal,
 * family trestle, accessible end, standing snack ledge, folding overflow and terrazzo feature),
 * painted in the 3/4 view from the south.
 *
 * Each table's top surface comes from {@link table_top}: its outline on the floor (a rectangle,
 * or the café table's ellipse) and the height it is lifted by. The painters draw the top there,
 * and the world view places diners' meals inside the same outline at the same height, so meals
 * always land on the painted top. Most tops are the footprint less a small inset; the café and
 * terrazzo tops are foreshortened (about two-thirds as deep as they are wide) and the snack ledge
 * is a narrow shelf at standing height. The top's edge shows as a south face below it, and the
 * legs, pedestal foot, trestles or folding frame peek out below that, with the far legs between
 * the near ones. The construction comes from the ID-keyed style tables in `render/art.ts`
 * (support and top branch) and the motif picks the material: kopitiam laminate with a chrome
 * edge, matt marble, timber planks, blow-moulded plastic or terrazzo. Long tables run along their
 * rotated footprint; round and square ones ignore the rotation. Everything is seeded from the
 * recipe, so the same spec paints the same pixels.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style, type TableStyle } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
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
  speckle,
  stroke_rounded_rect,
  TAU,
  tint,
  wood_grain,
  type PaintContext,
  type PaintGradient,
} from "../canvas";
import { TABLE_TOP_LIFT, type PaintFrame } from "../specs";
import {
  fit_rotation,
  floor_shadow,
  outline_style,
  paint_block,
  paint_post,
  paint_strut,
  rotated_side,
  type GroundRect,
  type ScreenRect,
} from "./seatingKit";
import { type Box, DARK_STEEL, STEEL, TIMBER } from "./shared";

/** Polished aluminium edging of laminate tops. */
const CHROME = 0xd2dbd8;
/** Brass edging and inlay of the terrazzo feature table. */
const BRASS = 0xc9a24a;
/** Dark bronze of the feature table's pedestal. */
const BRONZE = 0x6e5a3a;
/** Cast iron of the café table's pedestal. */
const CAST_IRON = 0x3f4a4a;
/** Warm grey-cream marble of the round café top. */
const MARBLE = 0xe4dccd;
/** Grey-green marble veining. */
const MARBLE_VEIN = 0x7f8c88;
/** Cream terrazzo binder. */
const TERRAZZO = 0xe9dfcf;
/** Pale oak of the family trestle table. */
const OAK = 0xc99a62;
/** Dark stained teak of the snack ledge. */
const TEAK = 0x7a4e2d;
/** Off-white moulded plastic of the folding table. */
const PLASTIC = 0xe6e9e3;
/** Grey plastic rim of the folding table. */
const PLASTIC_RIM = 0xaeb7b3;
/** Grey tubular steel of chrome-plated table legs. */
const TUBE_STEEL = 0x8c9794;
/** Rubber feet caps of folding legs. */
const RUBBER = 0x454b4a;
/** Blue of the wheelchair access plate. */
const ACCESS_BLUE = 0x2a6db5;
/** Mustard of the accessible table's high-visibility approach edge. */
const VISIBILITY_EDGE = 0xd5a021;
/** Inset of a table top from the footprint sides. */
const TOP_INSET = 4;
/** Thickness of a top's edge (its apron), seen as its south face. */
const APRON = 3;
/** Width of a plain table leg. */
const LEG_WIDTH = 3;
/** How far the far legs peek in from the near ones. */
const PEEK_INSET = 5;
/** How much higher the far legs' feet sit than the near ones'. */
const PEEK_RISE = 3;
/** Height of the standing snack ledge's top, above the dining tables. */
const LEDGE_LIFT = TABLE_TOP_LIFT + 4;
/** Depth of the standing snack ledge's narrow top. */
const LEDGE_DEPTH = 20;
/** How far the accessible table's legs are set back from its approach end. */
const KNEE_SPACE = 26;
/** Width of the rim band seen around a top. */
const RIM_WIDTH = 1.6;
/** Inset of the round café top from the footprint's sides, so it fills most of the width. */
const CAFE_TOP_INSET = 5;
/**
 * Depth of the round café top as a share of its width: a horizontal disc seen from above at
 * about 55 to 60 degrees reads as an ellipse, not a circle (a circle reads as a standing mirror).
 */
const CAFE_TOP_DEPTH = 0.63;
/** Inset of the terrazzo feature top from the footprint's sides. */
const TERRAZZO_TOP_INSET = 6;
/** Depth of the terrazzo feature top as a share of its width, foreshortened like the café top. */
const TERRAZZO_TOP_DEPTH = 0.65;
/** Width of the terrazzo feature table's square bronze legs. */
const TERRAZZO_LEG_WIDTH = 4.5;
/** Thickness of the bullnose edge of the café and terrazzo tops, seen on their south side. */
const THICK_EDGE = 4.5;
/** Cast iron of the café table's foot, lit on its rounded top. */
const IRON_HIGHLIGHT = 0x6f7c7a;
/** Muted terrazzo aggregate: the warm greys, beiges and taupes that make up most of the chips. */
const TERRAZZO_FINE_CHIPS = [0xcbbca4, 0xb3a58f, 0xd8cdb9, 0x9c9488, 0xf5efe4, 0xa89c8c] as const;
/** The few larger terrazzo accent chips: vermilion, teal, mustard and ink, toned into the binder. */
const TERRAZZO_ACCENT_CHIPS = [0xd95d39, 0x167d7f, 0xd5a021, 0x263238] as const;

/**
 * The top surface of a table on the floor, before its lift raises it: its outline, its centre,
 * its half extents and its height. The painters paint the top from it and the world view places
 * diners' meals inside it, so the art and the meal placement cannot drift apart.
 */
export interface TableTop {
  /** `rect` for a rectangular top, `ellipse` for a round one. */
  readonly shape: "rect" | "ellipse";
  /** Floor x of the top's centre. */
  readonly centreX: number;
  /** Floor y of the top's centre. */
  readonly centreY: number;
  /** Half the top's width; an ellipse's horizontal radius. */
  readonly halfWidth: number;
  /** Half the top's depth; an ellipse's vertical radius. */
  readonly halfDepth: number;
  /** Height of the top surface above the floor: it is drawn this many pixels higher. */
  readonly lift: number;
}

/**
 * Insets the footprint to a table's top rectangle on the floor.
 *
 * @param box - The footprint box.
 * @param inset - Inset from every side.
 * @returns The top's floor rectangle.
 */
function top_rect(box: Box, inset: number): GroundRect {
  return { x0: box.x + inset, y0: box.y + inset, x1: box.right - inset, y1: box.bottom - inset };
}

/**
 * Shrinks a floor rectangle on every side.
 *
 * @param rect - The rectangle.
 * @param inset - Inset from every side.
 * @returns The smaller rectangle.
 */
function inset_rect(rect: GroundRect, inset: number): GroundRect {
  return { x0: rect.x0 + inset, y0: rect.y0 + inset, x1: rect.x1 - inset, y1: rect.y1 - inset };
}

/**
 * Builds a rectangular table top from its floor rectangle.
 *
 * @param rect - The top's floor rectangle.
 * @param lift - Height of the top surface.
 * @returns The table top.
 */
function rect_top(rect: GroundRect, lift: number): TableTop {
  return {
    shape: "rect",
    centreX: (rect.x0 + rect.x1) / 2,
    centreY: (rect.y0 + rect.y1) / 2,
    halfWidth: (rect.x1 - rect.x0) / 2,
    halfDepth: (rect.y1 - rect.y0) / 2,
    lift,
  };
}

/**
 * Gives the floor rectangle a table top covers (an elliptical top's bounding rectangle).
 *
 * @param top - The table top.
 * @returns The floor rectangle.
 */
function top_ground_rect(top: TableTop): GroundRect {
  return {
    x0: top.centreX - top.halfWidth,
    y0: top.centreY - top.halfDepth,
    x1: top.centreX + top.halfWidth,
    y1: top.centreY + top.halfDepth,
  };
}

/**
 * Lays out the standing snack ledge's narrow top along its footprint.
 *
 * @param box - The footprint box.
 * @returns The ledge's floor rectangle.
 */
function ledge_rect(box: Box): GroundRect {
  return box.width >= box.height
    ? {
        x0: box.x + TOP_INSET,
        y0: box.centreY - LEDGE_DEPTH / 2 + 2,
        x1: box.right - TOP_INSET,
        y1: box.centreY + LEDGE_DEPTH / 2 + 2,
      }
    : {
        x0: box.centreX - LEDGE_DEPTH / 2,
        y0: box.y + TOP_INSET,
        x1: box.centreX + LEDGE_DEPTH / 2,
        y1: box.bottom - TOP_INSET,
      };
}

/**
 * Gives a table's top surface: where it lies on the floor and how high it is lifted. Long tables
 * follow their rotated footprint box; the round café top is an ellipse centred on the footprint;
 * the terrazzo top is foreshortened; the snack ledge is a narrow shelf at standing height.
 *
 * @param box - The footprint box (the rotated footprint), in texture or world pixels.
 * @param recipe - The table's recipe, whose style picks the construction.
 * @returns The top, in the same coordinates as the box.
 */
export function table_top(box: Box, recipe: PlaceableVisualRecipe): TableTop {
  const style: TableStyle = resolve_placeable_style("table", recipe);
  if (style.top === "round") {
    const halfWidth = box.width / 2 - CAFE_TOP_INSET;
    return {
      shape: "ellipse",
      centreX: box.centreX,
      centreY: box.centreY,
      halfWidth,
      halfDepth: Math.min(box.height / 2 - CAFE_TOP_INSET, Math.round(halfWidth * CAFE_TOP_DEPTH)),
      lift: TABLE_TOP_LIFT,
    };
  }
  if (style.top === "terrazzo") {
    const halfWidth = box.width / 2 - TERRAZZO_TOP_INSET;
    return {
      shape: "rect",
      centreX: box.centreX,
      centreY: box.centreY,
      halfWidth,
      halfDepth: Math.min(
        box.height / 2 - TERRAZZO_TOP_INSET,
        Math.round(halfWidth * TERRAZZO_TOP_DEPTH),
      ),
      lift: TABLE_TOP_LIFT,
    };
  }
  if (style.top === "snack-ledge") return rect_top(ledge_rect(box), LEDGE_LIFT);
  return rect_top(
    top_rect(box, style.support === "trestle" ? TOP_INSET + 1 : TOP_INSET),
    TABLE_TOP_LIFT,
  );
}

/**
 * Builds the vertical sheen of an edge: a bright lip, the body, a shaded underside and a thin
 * reflected light at the bottom.
 *
 * @param ctx - The paint context.
 * @param top - Top of the edge face.
 * @param bottom - Bottom of the edge face.
 * @param rim - The edge material colour.
 * @returns The gradient.
 */
function edge_gradient(ctx: PaintContext, top: number, bottom: number, rim: number): PaintGradient {
  return linear_gradient(ctx, 0, top, 0, bottom, [
    [0, tint(rim, 0.45)],
    [0.35, rim],
    [0.75, shade(rim, 0.32)],
    [1, shade(rim, 0.12)],
  ]);
}

/**
 * Adds the shared lighting of a top: a soft north-west sheen, south-east falloff and a dark
 * band of ambient occlusion along the south edge, then a short specular streak.
 *
 * @param ctx - The paint context (already clipped to the top).
 * @param face - The top face.
 */
function light_top(ctx: PaintContext, face: ScreenRect): void {
  const { x, y, width, height } = face;
  ctx.fillStyle = linear_gradient(ctx, x, y, x + width * 0.45, y + height, [
    [0, 0xffffff, 0.16],
    [0.5, 0xffffff, 0],
    [1, SHADOW_INK, 0.1],
  ]);
  ctx.fillRect(x, y, width, height);
  fill_rounded_rect(
    ctx,
    x + 4,
    y + 2.5,
    Math.max(4, Math.min(width * 0.4, 40)),
    1.6,
    0.8,
    css(0xffffff, 0.32),
  );
}

/**
 * Paints a rectangular table top: the edge face, the material, the lighting, the rim band and
 * the outline.
 *
 * @param ctx - The paint context.
 * @param rect - The top's floor rectangle.
 * @param lift - Height of the top surface.
 * @param material - Top colour, rim colour, corner radius, and optionally the edge face's
 *   thickness and colour (the apron and the rim colour by default).
 * @param frame - The paint frame.
 * @param fill - Paints the material over the top face (clipped to it).
 * @returns The top face in texture pixels.
 */
function paint_rect_top(
  ctx: PaintContext,
  rect: GroundRect,
  lift: number,
  material: {
    readonly top: number;
    readonly rim: number;
    readonly radius: number;
    readonly edgeDepth?: number;
    readonly edge?: number;
  },
  frame: PaintFrame,
  fill: (face: ScreenRect) => void,
): ScreenRect {
  const edgeDepth = material.edgeDepth ?? APRON;
  const faces = paint_block(
    ctx,
    rect,
    lift - edgeDepth,
    lift,
    {
      top: material.top,
      radius: material.radius,
      gloss: 0.35,
      frontStyle: edge_gradient(
        ctx,
        rect.y1 - lift,
        rect.y1 - lift + edgeDepth,
        material.edge ?? material.rim,
      ),
    },
    frame,
    (painted) => {
      fill(painted.top);
      light_top(ctx, painted.top);
    },
  );
  const { top } = faces;
  stroke_rounded_rect(
    ctx,
    top.x + RIM_WIDTH / 2 + 0.4,
    top.y + RIM_WIDTH / 2 + 0.4,
    top.width - RIM_WIDTH - 0.8,
    top.height - RIM_WIDTH - 0.8,
    Math.max(0.5, material.radius - RIM_WIDTH / 2),
    css(tint(material.rim, 0.3), 0.85),
    RIM_WIDTH,
  );
  return top;
}

/**
 * Fills a laminate top: a pastel of the recipe accent with a diagonal sheen and the soft cloudy
 * figure of a kopitiam laminate.
 *
 * @param ctx - The paint context (clipped to the top).
 * @param face - The top face.
 * @param accent - The recipe accent the pastel is tinted from.
 * @param seed - Seed for the figure positions.
 * @param frame - The paint frame.
 */
function fill_laminate(
  ctx: PaintContext,
  face: ScreenRect,
  accent: number,
  seed: number,
  frame: PaintFrame,
): void {
  const base = tint(accent, 0.42);
  const { x, y, width, height } = face;
  ctx.fillStyle = linear_gradient(ctx, x, y, x + width * 0.5, y + height, [
    [0, tint(base, 0.1)],
    [1, shade(base, 0.05)],
  ]);
  ctx.fillRect(x, y, width, height);
  fill_polygon(
    ctx,
    [
      [x, y + height * 0.3],
      [x + Math.min(width, height) * 0.4, y],
      [x + Math.min(width, height) * 0.62, y],
      [x, y + height * 0.72],
    ],
    css(0xffffff, 0.1),
  );
  if (frame.isLowDetail) return;
  const next = seeded(seed);
  const clouds = Math.max(3, Math.round((width * height) / 500));
  for (let cloud = 0; cloud < clouds; cloud += 1) {
    const cloudX = x + width * (0.1 + next() * 0.8);
    const cloudY = y + height * (0.1 + next() * 0.8);
    const radius = 3 + next() * Math.min(width, height) * 0.18;
    fill_ellipse(
      ctx,
      cloudX,
      cloudY,
      radius * 1.4,
      radius,
      radial_gradient(ctx, cloudX, cloudY, 0, radius * 1.4, [
        [0, 0xffffff, 0.13],
        [1, 0xffffff, 0],
      ]),
    );
  }
}

/**
 * Fills a timber top with planks running along its length, each in its own tone with grain,
 * separated by a dark joint and a lit arris.
 *
 * @param ctx - The paint context (clipped to the top).
 * @param face - The top face.
 * @param base - The timber colour.
 * @param plankWidth - Width of one plank across the grain.
 * @param seed - Seed for the tones and grain.
 * @param frame - The paint frame.
 */
function fill_planks(
  ctx: PaintContext,
  face: ScreenRect,
  base: number,
  plankWidth: number,
  seed: number,
  frame: PaintFrame,
): void {
  const isVertical = face.height > face.width;
  const across = isVertical ? face.width : face.height;
  const planks = Math.max(2, Math.round(across / plankWidth));
  const size = across / planks;
  const next = seeded(seed);
  for (let index = 0; index < planks; index += 1) {
    const tone = mix(base, index % 2 === 0 ? 0xffffff : SHADOW_INK, 0.03 + next() * 0.08);
    const plank: ScreenRect = isVertical
      ? { x: face.x + index * size, y: face.y, width: size + 0.4, height: face.height }
      : { x: face.x, y: face.y + index * size, width: face.width, height: size + 0.4 };
    ctx.fillStyle = isVertical
      ? linear_gradient(ctx, plank.x, 0, plank.x + size, 0, [
          [0, tint(tone, 0.1)],
          [1, shade(tone, 0.08)],
        ])
      : linear_gradient(ctx, 0, plank.y, 0, plank.y + size, [
          [0, tint(tone, 0.1)],
          [1, shade(tone, 0.08)],
        ]);
    ctx.fillRect(plank.x, plank.y, plank.width, plank.height);
    if (!frame.isLowDetail) {
      wood_grain(
        ctx,
        plank.x,
        plank.y,
        plank.width,
        plank.height,
        tone,
        seed + index * 977,
        isVertical,
      );
    }
    if (index === 0) continue;
    if (isVertical) {
      line(
        ctx,
        plank.x,
        face.y,
        plank.x,
        face.y + face.height,
        css(shade(base, 0.5), 0.8),
        1,
        "butt",
      );
      line(
        ctx,
        plank.x + 1.1,
        face.y,
        plank.x + 1.1,
        face.y + face.height,
        css(tint(base, 0.3), 0.4),
        0.8,
        "butt",
      );
    } else {
      line(
        ctx,
        face.x,
        plank.y,
        face.x + face.width,
        plank.y,
        css(shade(base, 0.5), 0.8),
        1,
        "butt",
      );
      line(
        ctx,
        face.x,
        plank.y + 1.1,
        face.x + face.width,
        plank.y + 1.1,
        css(tint(base, 0.3), 0.4),
        0.8,
        "butt",
      );
    }
  }
}

/**
 * Fills a terrazzo top: a warm cream binder densely set with small, muted aggregate chips and a
 * few larger accent chips toned into the binder.
 *
 * @param ctx - The paint context (clipped to the top).
 * @param face - The top face.
 * @param seed - Seed for the chip scatter.
 * @param frame - The paint frame.
 */
function fill_terrazzo(ctx: PaintContext, face: ScreenRect, seed: number, frame: PaintFrame): void {
  const { x, y, width, height } = face;
  ctx.fillStyle = linear_gradient(ctx, x, y, x + width * 0.45, y + height, [
    [0, tint(TERRAZZO, 0.22)],
    [1, shade(TERRAZZO, 0.07)],
  ]);
  ctx.fillRect(x, y, width, height);
  const fines = Math.round((width * height) / (frame.isLowDetail ? 30 : 11));
  speckle(ctx, x, y, width, height, fines, TERRAZZO_FINE_CHIPS, seed, 0.8);
  speckle(
    ctx,
    x + 3,
    y + 3,
    width - 6,
    height - 6,
    frame.isLowDetail ? 6 : 11,
    TERRAZZO_ACCENT_CHIPS.map((chip) => mix(chip, TERRAZZO, 0.42)),
    seed ^ 0x9e3779b9,
    1.3,
  );
}

/**
 * Fills a folding table's blow-moulded top: pebbled off-white with the fold seam across the
 * middle, its hinge plates and the carry-handle slot.
 *
 * @param ctx - The paint context (clipped to the top).
 * @param face - The top face.
 * @param seed - Seed for the pebble texture.
 * @param frame - The paint frame.
 */
function fill_plastic(ctx: PaintContext, face: ScreenRect, seed: number, frame: PaintFrame): void {
  const { x, y, width, height } = face;
  ctx.fillStyle = linear_gradient(ctx, x, y, x + width * 0.4, y + height, [
    [0, tint(PLASTIC, 0.3)],
    [1, shade(PLASTIC, 0.06)],
  ]);
  ctx.fillRect(x, y, width, height);
  if (!frame.isLowDetail) {
    speckle(ctx, x, y, width, height, 90, [tint(PLASTIC, 0.6), shade(PLASTIC, 0.14)], seed, 0.7);
  }
  const isWide = width >= height;
  const seamX = x + width / 2;
  const seamY = y + height / 2;
  if (isWide) {
    line(ctx, seamX, y, seamX, y + height, css(shade(PLASTIC, 0.4), 0.85), 1.1, "butt");
    line(ctx, seamX + 1.2, y, seamX + 1.2, y + height, css(0xffffff, 0.55), 0.9, "butt");
    for (const hingeY of [y + 3, y + height - 7]) {
      fill_rounded_rect(ctx, seamX - 4, hingeY, 8, 4, 1, css(TUBE_STEEL));
    }
    fill_rounded_rect(ctx, seamX - 1.6, seamY - 6, 3.2, 12, 1.6, css(shade(PLASTIC, 0.42), 0.8));
    return;
  }
  line(ctx, x, seamY, x + width, seamY, css(shade(PLASTIC, 0.4), 0.85), 1.1, "butt");
  line(ctx, x, seamY + 1.2, x + width, seamY + 1.2, css(0xffffff, 0.55), 0.9, "butt");
  for (const hingeX of [x + 3, x + width - 7]) {
    fill_rounded_rect(ctx, hingeX, seamY - 2, 4, 4.4, 1, css(TUBE_STEEL));
  }
  fill_rounded_rect(ctx, seamX - 6, seamY - 4.6, 12, 3.2, 1.6, css(shade(PLASTIC, 0.42), 0.8));
}

/**
 * Shades the floor seen under a top's south edge: the table's own shadow, darkest against the
 * apron and fading towards the feet, so the top reads as standing above the floor.
 *
 * @param ctx - The paint context.
 * @param rect - The top's floor rectangle.
 * @param lift - Height of the top surface.
 */
function shade_under(ctx: PaintContext, rect: GroundRect, lift: number): void {
  const top = rect.y1 - lift + APRON;
  const bottom = rect.y1 - 0.5;
  ctx.fillStyle = linear_gradient(ctx, 0, top, 0, bottom, [
    [0, SHADOW_INK, 0.26],
    [1, SHADOW_INK, 0.04],
  ]);
  ctx.fillRect(rect.x0 + 2, top, rect.x1 - rect.x0 - 2, bottom - top);
}

/**
 * Paints a row of straight legs below a top: the far legs peeking in from the outermost near
 * legs, darker and a little higher, then the near legs down to the floor.
 *
 * @param ctx - The paint context.
 * @param xs - Centre x of each near leg.
 * @param footY - Floor y of the near legs' feet.
 * @param height - Leg height, up to the underside of the apron.
 * @param colour - The leg material.
 * @param frame - The paint frame.
 * @param width - Leg width.
 */
function paint_leg_row(
  ctx: PaintContext,
  xs: readonly number[],
  footY: number,
  height: number,
  colour: number,
  frame: PaintFrame,
  width = LEG_WIDTH,
): void {
  if (xs.length === 0) return;
  const west = Math.min(...xs);
  const east = Math.max(...xs);
  const far = shade(colour, 0.42);
  for (const legX of east - west > PEEK_INSET * 3 ? [west + PEEK_INSET, east - PEEK_INSET] : []) {
    paint_post(ctx, legX, footY - PEEK_RISE, 0, height - PEEK_RISE, width * 0.85, far, frame);
  }
  for (const legX of xs) paint_post(ctx, legX, footY, 0, height, width, colour, frame);
}

/**
 * Paints the condiment caddy of a shared table: a steel tray holding a chilli bottle, a soy
 * bottle, a chopstick cup and a tissue box.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the tray.
 * @param cy - Centre y of the tray.
 */
function paint_caddy(ctx: PaintContext, cx: number, cy: number): void {
  fill_rounded_rect(ctx, cx - 9, cy - 3, 20, 10, 2, css(SHADOW_INK, 0.2));
  fill_rounded_rect(ctx, cx - 10, cy - 5, 20, 10, 2, css(shade(STEEL, 0.25)));
  fill_rounded_rect(ctx, cx - 9, cy - 4.5, 18, 8, 1.5, css(tint(STEEL, 0.3)));
  // Chilli and soy bottles, seen from above with a little of their south face.
  for (const [bottleX, body, cap] of [
    [cx - 5.5, 0xc8392b, 0xf4d7c4],
    [cx + 0.5, 0x3a2622, 0xd8c7a0],
  ] as const) {
    fill_rounded_rect(ctx, bottleX - 2.6, cy - 4.5, 5.2, 7, 2, css(shade(body, 0.2)));
    fill_circle(ctx, bottleX, cy - 4.5, 2.6, css(body));
    fill_circle(ctx, bottleX, cy - 4.5, 1.1, css(cap));
  }
  fill_circle(ctx, cx - 5.5, cy + 2.5, 2.1, css(0xd9d3c3));
  line(ctx, cx - 6.4, cy + 1.6, cx - 4.6, cy + 3.4, css(0x8a6a48), 0.8);
  fill_rounded_rect(ctx, cx + 4, cy - 3.5, 5, 7, 1, css(0xf6f1e4));
  line(ctx, cx + 6.5, cy - 2.2, cx + 6.5, cy + 2.2, css(0xbfb6a3), 1);
}

/**
 * Paints the chopstick-and-spoon tub and tissue packet of the family table.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the pair.
 * @param cy - Centre y of the pair.
 */
function paint_cutlery_tub(ctx: PaintContext, cx: number, cy: number): void {
  fill_ellipse(ctx, cx - 3, cy + 3, 5, 2.4, css(SHADOW_INK, 0.2));
  fill_rounded_rect(ctx, cx - 8, cy - 3, 9, 6, 2, css(0x8f9a97));
  fill_ellipse(ctx, cx - 3.5, cy - 3, 4.5, 2.4, css(0xcfd6d3));
  for (const [tipX, tipY] of [
    [-6, -9],
    [-4.5, -9.5],
    [-1.5, -8.5],
    [0, -9],
  ] as const) {
    line(ctx, cx - 3.5, cy - 3, cx + tipX + 2, cy + tipY, css(0xc49a62), 0.9);
  }
  fill_rounded_rect(ctx, cx + 3, cy - 3, 8, 6, 1.2, css(0xf6f1e4));
  line(ctx, cx + 4.5, cy - 0.2, cx + 9.5, cy - 0.2, css(0xbfb6a3), 0.8);
}

/**
 * Paints the small chrome napkin holder on a standing ledge.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the holder.
 * @param cy - Centre y of the holder.
 */
function paint_napkin_holder(ctx: PaintContext, cx: number, cy: number): void {
  fill_rounded_rect(ctx, cx - 4, cy - 1, 9, 5, 1.5, css(SHADOW_INK, 0.2));
  fill_rounded_rect(ctx, cx - 4.5, cy - 4, 9, 6, 1, css(shade(STEEL, 0.15)));
  fill_rounded_rect(ctx, cx - 4.5, cy - 4, 9, 2, 1, css(tint(STEEL, 0.4)));
  fill_rounded_rect(ctx, cx - 3, cy - 6.5, 6, 3, 0.8, css(0xfbf7ee));
}

/**
 * Paints the wheelchair access plate: a blue tile with the white access symbol (head, body,
 * seat and chair wheel).
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the plate.
 * @param cy - Centre y of the plate.
 */
function paint_access_plate(ctx: PaintContext, cx: number, cy: number): void {
  fill_rounded_rect(ctx, cx - 6.5, cy - 6.5, 13, 13, 2.5, css(ACCESS_BLUE));
  stroke_rounded_rect(ctx, cx - 6.5, cy - 6.5, 13, 13, 2.5, css(0xffffff, 0.8), 0.9);
  fill_circle(ctx, cx - 1, cy - 3.8, 1.5, css(0xffffff));
  line(ctx, cx - 1, cy - 1.8, cx - 1, cy + 0.8, css(0xffffff), 1.7);
  line(ctx, cx - 1, cy + 0.8, cx + 2.8, cy + 0.8, css(0xffffff), 1.7);
  line(ctx, cx + 2.8, cy + 0.8, cx + 3.3, cy + 3.8, css(0xffffff), 1.3);
  ctx.beginPath();
  ctx.arc(cx - 1.2, cy + 2.4, 2.6, -Math.PI * 0.95, Math.PI * 0.65);
  ctx.strokeStyle = css(0xffffff);
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Paints the compact square table: a pastel laminate top with a chrome edge on four tubular
 * steel legs.
 *
 * @param ctx - The paint context.
 * @param top - The table top.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_compact_table(
  ctx: PaintContext,
  top: TableTop,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const rect = top_ground_rect(top);
  floor_shadow(ctx, inset_rect(rect, 3), { alpha: 0.26 });
  shade_under(ctx, rect, TABLE_TOP_LIFT);
  paint_leg_row(
    ctx,
    [rect.x0 + 3, rect.x1 - 3],
    rect.y1 - 1.5,
    TABLE_TOP_LIFT - APRON,
    TUBE_STEEL,
    frame,
  );
  paint_rect_top(
    ctx,
    rect,
    TABLE_TOP_LIFT,
    { top: tint(recipe.accent, 0.42), rim: CHROME, radius: 3 },
    frame,
    (face) => fill_laminate(ctx, face, recipe.accent, recipe.seed, frame),
  );
}

/**
 * Paints the long communal table: teak planks along its length on dark steel legs, with a
 * condiment caddy at the middle (a tile boundary, clear of the diners' plates).
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param top - The table top.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_communal_table(
  ctx: PaintContext,
  box: Box,
  top: TableTop,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const rect = top_ground_rect(top);
  const isWide = box.width >= box.height;
  floor_shadow(ctx, inset_rect(rect, 3), { alpha: 0.26 });
  shade_under(ctx, rect, TABLE_TOP_LIFT);
  const legs = isWide ? [rect.x0 + 3, box.centreX, rect.x1 - 3] : [rect.x0 + 3, rect.x1 - 3];
  paint_leg_row(ctx, legs, rect.y1 - 1.5, TABLE_TOP_LIFT - APRON, DARK_STEEL, frame, 3.4);
  const face = paint_rect_top(
    ctx,
    rect,
    TABLE_TOP_LIFT,
    { top: TIMBER, rim: shade(TIMBER, 0.2), radius: 2 },
    frame,
    (painted) => fill_planks(ctx, painted, TIMBER, 10, recipe.seed, frame),
  );
  paint_caddy(ctx, face.x + face.width / 2, face.y + face.height / 2);
}

/**
 * Paints the trestle legs of the family table. Along a wide table the trestles stand at its
 * west and east ends, seen edge-on as stout posts on foot beams with the stretcher between
 * them; along a deep table the south trestle faces the viewer as a splayed A-frame.
 *
 * @param ctx - The paint context.
 * @param rect - The top's floor rectangle.
 * @param isWide - True when the table runs east to west.
 * @param frame - The paint frame.
 */
function paint_trestles(
  ctx: PaintContext,
  rect: GroundRect,
  isWide: boolean,
  frame: PaintFrame,
): void {
  const wood = shade(OAK, 0.32);
  const footY = rect.y1 + 1;
  const height = TABLE_TOP_LIFT - APRON + 1;
  const stroke = outline_style(frame, wood);
  if (isWide) {
    // The stretcher, further back, between the two trestles.
    fill_rounded_rect(
      ctx,
      rect.x0 + 12,
      footY - 7,
      rect.x1 - rect.x0 - 24,
      3,
      1,
      css(shade(wood, 0.35)),
    );
    for (const postX of [rect.x0 + 11, rect.x1 - 11]) {
      fill_rounded_rect(ctx, postX - 6, footY - 3, 12, 3, 1.2, css(shade(wood, 0.15)));
      stroke_rounded_rect(ctx, postX - 6, footY - 3, 12, 3, 1.2, stroke.style, stroke.width);
      paint_post(ctx, postX, footY - 2.5, 0, height - 2.5, 5, wood, frame);
    }
    return;
  }
  const cx = (rect.x0 + rect.x1) / 2;
  const topY = footY - height;
  for (const side of [-1, 1] as const) {
    paint_strut(
      ctx,
      cx + side * 6,
      topY,
      cx + side * ((rect.x1 - rect.x0) / 2 - 6),
      footY - 2,
      4,
      wood,
      frame,
    );
  }
  line(ctx, cx - 8, topY + 4, cx + 8, topY + 4, css(shade(wood, 0.2)), 2.2);
  fill_rounded_rect(
    ctx,
    rect.x0 + 2,
    footY - 3,
    rect.x1 - rect.x0 - 4,
    3,
    1.2,
    css(shade(wood, 0.12)),
  );
  stroke_rounded_rect(
    ctx,
    rect.x0 + 2,
    footY - 3,
    rect.x1 - rect.x0 - 4,
    3,
    1.2,
    stroke.style,
    stroke.width,
  );
}

/**
 * Paints the family trestle table: a broad pale-oak top with breadboard ends on two trestles,
 * with a cutlery tub and tissues at its middle.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param top - The table top.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_trestle_table(
  ctx: PaintContext,
  box: Box,
  top: TableTop,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const rect = top_ground_rect(top);
  const isWide = box.width >= box.height;
  floor_shadow(ctx, inset_rect(rect, 4), { alpha: 0.26 });
  shade_under(ctx, rect, TABLE_TOP_LIFT);
  paint_trestles(ctx, rect, isWide, frame);
  const face = paint_rect_top(
    ctx,
    rect,
    TABLE_TOP_LIFT,
    { top: OAK, rim: shade(OAK, 0.25), radius: 3 },
    frame,
    (top) => {
      fill_planks(ctx, top, OAK, 14, recipe.seed, frame);
      // Breadboard ends: a board across the grain at each end.
      const ends: ScreenRect[] = isWide
        ? [
            { x: top.x, y: top.y, width: 7, height: top.height },
            { x: top.x + top.width - 7, y: top.y, width: 7, height: top.height },
          ]
        : [
            { x: top.x, y: top.y, width: top.width, height: 7 },
            { x: top.x, y: top.y + top.height - 7, width: top.width, height: 7 },
          ];
      for (const end of ends) {
        ctx.fillStyle = css(shade(OAK, 0.08));
        ctx.fillRect(end.x, end.y, end.width, end.height);
        if (!frame.isLowDetail) {
          wood_grain(ctx, end.x, end.y, end.width, end.height, OAK, recipe.seed ^ 0x51, isWide);
        }
        stroke_rounded_rect(
          ctx,
          end.x,
          end.y,
          end.width,
          end.height,
          0,
          css(shade(OAK, 0.5), 0.7),
          0.9,
        );
      }
    },
  );
  paint_cutlery_tub(ctx, face.x + face.width / 2, face.y + face.height / 2);
}

/**
 * Paints the accessible end table: a laminate top whose approach end (east as authored) has its
 * legs set back for clear knee space, a high-visibility edge and the wheelchair access plate.
 *
 * @param ctx - The paint context.
 * @param top - The table top.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation, which turns the approach end.
 */
function paint_accessible_table(
  ctx: PaintContext,
  top: TableTop,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const rect = top_ground_rect(top);
  const approach = rotated_side(rotation, "east");
  const legHeight = TABLE_TOP_LIFT - APRON;
  floor_shadow(ctx, inset_rect(rect, 3), { alpha: 0.26 });
  shade_under(ctx, rect, TABLE_TOP_LIFT);
  if (approach === "south") {
    // The legs stand back under the top: only their far pair peeks out of the knee space.
    for (const legX of [rect.x0 + 3 + PEEK_INSET, rect.x1 - 3 - PEEK_INSET]) {
      paint_post(
        ctx,
        legX,
        rect.y1 - 1.5 - PEEK_RISE - 1,
        0,
        legHeight - PEEK_RISE - 1,
        2.6,
        shade(TUBE_STEEL, 0.45),
        frame,
      );
    }
  } else if (approach === "north") {
    paint_leg_row(ctx, [rect.x0 + 3, rect.x1 - 3], rect.y1 - 1.5, legHeight, TUBE_STEEL, frame);
  } else {
    const legs =
      approach === "east"
        ? [rect.x0 + 3, rect.x1 - KNEE_SPACE]
        : [rect.x0 + KNEE_SPACE, rect.x1 - 3];
    paint_leg_row(ctx, legs, rect.y1 - 1.5, legHeight, TUBE_STEEL, frame);
  }
  const face = paint_rect_top(
    ctx,
    rect,
    TABLE_TOP_LIFT,
    { top: tint(recipe.accent, 0.42), rim: CHROME, radius: 3 },
    frame,
    (painted) => fill_laminate(ctx, painted, recipe.accent, recipe.seed, frame),
  );
  // The high-visibility strip goes over the rim and outline, so it reads at every rotation.
  const strip = 4;
  const inner = 0.6;
  const edge: ScreenRect =
    approach === "east"
      ? {
          x: face.x + face.width - strip - inner,
          y: face.y + inner,
          width: strip,
          height: face.height - inner * 2,
        }
      : approach === "west"
        ? { x: face.x + inner, y: face.y + inner, width: strip, height: face.height - inner * 2 }
        : approach === "north"
          ? { x: face.x + inner, y: face.y + inner, width: face.width - inner * 2, height: strip }
          : {
              x: face.x + inner,
              y: face.y + face.height - strip - inner,
              width: face.width - inner * 2,
              height: strip,
            };
  fill_rounded_rect(ctx, edge.x, edge.y, edge.width, edge.height, 1.2, css(VISIBILITY_EDGE));
  if (approach === "south") {
    fill_rounded_rect(
      ctx,
      face.x,
      face.y + face.height,
      face.width,
      APRON,
      1,
      css(VISIBILITY_EDGE, 0.85),
    );
  }
  const right = face.x + face.width - 9;
  const plateY = approach === "south" ? face.y + face.height - 9 : face.y + 9;
  paint_access_plate(ctx, approach === "west" ? face.x + 9 : right, plateY);
}

/**
 * Paints the folding legs of the overflow table. Along a wide table each end's leg frame splays
 * out towards its end with a folding brace; along a deep table the south frame faces the viewer
 * as two legs joined by cross bars.
 *
 * @param ctx - The paint context.
 * @param rect - The top's floor rectangle.
 * @param isWide - True when the table runs east to west.
 * @param frame - The paint frame.
 */
function paint_folding_legs(
  ctx: PaintContext,
  rect: GroundRect,
  isWide: boolean,
  frame: PaintFrame,
): void {
  const topY = rect.y1 - TABLE_TOP_LIFT + APRON;
  const footY = rect.y1 + 1;
  if (isWide) {
    for (const side of [-1, 1] as const) {
      const end = side < 0 ? rect.x0 : rect.x1;
      const hip = end - side * 18;
      const foot = end - side * 7;
      // The far leg of the same frame, darker and shorter.
      paint_strut(
        ctx,
        hip - side * 2,
        topY,
        foot - side * 3,
        footY - 3,
        2,
        shade(TUBE_STEEL, 0.4),
        frame,
      );
      paint_strut(ctx, hip, topY, foot, footY - 1, 2.4, TUBE_STEEL, frame);
      paint_strut(
        ctx,
        (hip + foot) / 2,
        (topY + footY) / 2,
        hip + side * 14,
        topY,
        1.4,
        TUBE_STEEL,
        frame,
      );
      fill_ellipse(ctx, foot, footY - 0.8, 2.2, 1.2, css(RUBBER));
    }
    return;
  }
  const west = rect.x0 + 6;
  const east = rect.x1 - 6;
  for (const legX of [west, east]) {
    paint_post(ctx, legX, footY - 1, 0, footY - 1 - topY, 2.4, TUBE_STEEL, frame);
    fill_ellipse(ctx, legX, footY - 0.8, 2.2, 1.2, css(RUBBER));
  }
  line(ctx, west, footY - 3, east, footY - 3, css(TUBE_STEEL), 1.8);
  line(ctx, west, topY + 2.5, east, topY + 2.5, css(shade(TUBE_STEEL, 0.2)), 1.4);
}

/**
 * Paints the folding overflow table: a pebbled blow-moulded top with its fold seam, on folding
 * steel legs with rubber feet.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param top - The table top.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_folding_table(
  ctx: PaintContext,
  box: Box,
  top: TableTop,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const rect = top_ground_rect(top);
  const isWide = box.width >= box.height;
  floor_shadow(ctx, inset_rect(rect, 3), { alpha: 0.22 });
  shade_under(ctx, rect, TABLE_TOP_LIFT);
  paint_folding_legs(ctx, rect, isWide, frame);
  paint_rect_top(
    ctx,
    rect,
    TABLE_TOP_LIFT,
    { top: PLASTIC, rim: PLASTIC_RIM, radius: 4 },
    frame,
    (face) => fill_plastic(ctx, face, recipe.seed, frame),
  );
}

/**
 * Paints the standing snack ledge: a narrow dark-teak shelf with a stainless edge, standing
 * higher than the dining tables on slim steel posts with base plates and a foot rail, with bag
 * hooks under its edge and a napkin holder at one end.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param top - The ledge's top.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_snack_ledge(
  ctx: PaintContext,
  box: Box,
  top: TableTop,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const isWide = box.width >= box.height;
  const rect = top_ground_rect(top);
  const footY = Math.min(box.bottom - 2, rect.y1 + 2);
  const postHeight = footY - (rect.y1 - top.lift + APRON);
  const posts = isWide ? [rect.x0 + 10, rect.x1 - 10] : [box.centreX];
  floor_shadow(
    ctx,
    { x0: rect.x0 + 3, y0: rect.y0 + 2, x1: rect.x1 - 3, y1: rect.y1 },
    { alpha: 0.22 },
  );
  shade_under(ctx, rect, top.lift);
  for (const postX of posts) {
    fill_ellipse(ctx, postX, footY - 0.5, 5.5, 2, css(shade(DARK_STEEL, 0.3)));
    fill_ellipse(ctx, postX, footY - 1.2, 5, 1.6, css(tint(DARK_STEEL, 0.2)));
  }
  if (isWide) {
    line(
      ctx,
      posts[0] as number,
      footY - 5,
      posts[1] as number,
      footY - 5,
      css(shade(STEEL, 0.2)),
      2.4,
    );
    line(
      ctx,
      (posts[0] as number) + 2,
      footY - 5.7,
      (posts[1] as number) - 2,
      footY - 5.7,
      css(0xffffff, 0.45),
      0.8,
    );
  } else {
    // The foot rail runs away from the viewer: a short stub in front of the post.
    fill_ellipse(ctx, box.centreX, footY - 5, 2, 1.4, css(shade(STEEL, 0.15)));
  }
  for (const postX of posts)
    paint_post(ctx, postX, footY - 1, 0, postHeight - 1, 3.2, DARK_STEEL, frame);
  const face = paint_rect_top(
    ctx,
    rect,
    top.lift,
    { top: TEAK, rim: STEEL, radius: 2.5 },
    frame,
    (painted) => fill_planks(ctx, painted, TEAK, 10, recipe.seed, frame),
  );
  const hookY = face.y + face.height + APRON - 0.8;
  if (isWide) {
    for (let hook = 0; hook < 3; hook += 1) {
      fill_circle(ctx, box.centreX - 16 + hook * 16, hookY, 1.4, css(tint(STEEL, 0.25)));
    }
    // Midway along the ledge, between the diners' places, so plates never cover it.
    paint_napkin_holder(ctx, face.x + face.width / 2, face.y + face.height / 2 + 1);
  } else {
    fill_circle(ctx, box.centreX, hookY, 1.4, css(tint(STEEL, 0.25)));
    paint_napkin_holder(ctx, face.x + face.width / 2, face.y + face.height / 2);
  }
}

/**
 * Fills a matt marble top: a warm white stone, lighter towards the key light, with faint clouding
 * and a few soft grey veins that wander diagonally from the north-west and break up, as the
 * marble of a kopitiam table does.
 *
 * @param ctx - The paint context (clipped to the top).
 * @param cx - Centre x of the top.
 * @param cy - Centre y of the top, on the texture.
 * @param rx - Horizontal radius.
 * @param ry - Vertical radius.
 * @param seed - Seed for the clouding and vein paths.
 * @param frame - The paint frame.
 */
function fill_marble(
  ctx: PaintContext,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  frame: PaintFrame,
): void {
  ctx.fillStyle = linear_gradient(ctx, cx - rx, cy - ry, cx + rx * 0.6, cy + ry, [
    [0, tint(MARBLE, 0.3)],
    [0.55, MARBLE],
    [1, shade(MARBLE, 0.1)],
  ]);
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  if (frame.isLowDetail) return;
  const next = seeded(seed);
  for (let cloud = 0; cloud < 4; cloud += 1) {
    const cloudX = cx + (next() - 0.5) * rx * 1.4;
    const cloudY = cy + (next() - 0.5) * ry * 1.2;
    const radius = rx * (0.22 + next() * 0.2);
    fill_ellipse(
      ctx,
      cloudX,
      cloudY,
      radius,
      radius * 0.6,
      radial_gradient(ctx, cloudX, cloudY, 0, radius, [
        [0, MARBLE_VEIN, 0.08],
        [1, MARBLE_VEIN, 0],
      ]),
    );
  }
  // Veins run along a diagonal (foreshortened like the top) and wander as a random walk; some
  // steps are skipped so each vein breaks up instead of crossing the top as one stroke.
  const heading = Math.atan2(0.45, 1);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let vein = 0; vein < 5; vein += 1) {
    const across = (vein / 4 - 0.5) * ry * 2.2 + (next() - 0.5) * ry * 0.4;
    let x = cx - rx * (0.75 + next() * 0.3) - Math.sin(heading) * across;
    let y = cy + Math.cos(heading) * across - ry * 0.35;
    let angle = heading + (next() - 0.5) * 0.4;
    const alpha = 0.13 + next() * 0.12;
    const branches: Array<readonly [number, number, number]> = [];
    ctx.strokeStyle = css(MARBLE_VEIN, alpha);
    ctx.lineWidth = 0.5 + next() * 0.5;
    let isDrawing = false;
    for (let step = 0; step < 16; step += 1) {
      angle += (next() - 0.5) * 0.7;
      angle = heading + Math.max(-0.6, Math.min(0.6, angle - heading));
      const length = 5 + next() * 4;
      const toX = x + Math.cos(angle) * length;
      const toY = y + Math.sin(angle) * length * 0.7;
      if (next() > 0.25) {
        if (!isDrawing) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          isDrawing = true;
        }
        ctx.lineTo(toX, toY);
      } else if (isDrawing) {
        ctx.stroke();
        isDrawing = false;
      }
      if (next() > 0.86) branches.push([toX, toY, angle + (next() > 0.5 ? 0.9 : -0.9)]);
      x = toX;
      y = toY;
    }
    if (isDrawing) ctx.stroke();
    // Fine hairlines branching off the vein.
    for (const [branchX, branchY, branch] of branches) {
      line(
        ctx,
        branchX,
        branchY,
        branchX + Math.cos(branch) * 5,
        branchY + Math.sin(branch) * 3.5,
        css(MARBLE_VEIN, alpha * 0.6),
        0.45,
      );
    }
  }
  ctx.restore();
}

/**
 * Paints the café table's cast-iron cross foot: a domed hub with four flat feet, the two near
 * feet splaying towards the viewer and the far two peeking out behind the hub, on its own soft
 * contact shadow.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the hub.
 * @param footY - Texture y of the hub's base on the floor.
 * @param stubTop - Texture y where the column stub comes out from under the top.
 * @param frame - The paint frame.
 */
function paint_cafe_foot(
  ctx: PaintContext,
  cx: number,
  footY: number,
  stubTop: number,
  frame: PaintFrame,
): void {
  ctx.save();
  ctx.shadowBlur = 5;
  ctx.shadowColor = css(SHADOW_INK, 0.3);
  fill_ellipse(ctx, cx + 2, footY + 2.2, 17, 3.8, css(SHADOW_INK, 0.2));
  ctx.restore();
  const stroke = outline_style(frame, CAST_IRON);
  const iron = (left: number, right: number) =>
    linear_gradient(ctx, left, 0, right, 0, [
      [0, tint(CAST_IRON, 0.3)],
      [0.5, CAST_IRON],
      [1, shade(CAST_IRON, 0.4)],
    ]);
  for (const side of [-1, 1] as const) {
    paint_strut(
      ctx,
      cx + side * 2,
      footY - 1.2,
      cx + side * 11,
      footY - 3.4,
      2.6,
      shade(CAST_IRON, 0.3),
      frame,
    );
  }
  fill_rounded_rect(
    ctx,
    cx - 3.6,
    stubTop,
    7.2,
    footY - 1.5 - stubTop,
    1.2,
    iron(cx - 3.6, cx + 3.6),
  );
  for (const side of [-1, 1] as const) {
    const foot: Array<readonly [number, number]> = [
      [cx + side * 2.5, footY - 2.6],
      [cx + side * 15.5, footY + 1.6],
      [cx + side * 16, footY + 3.6],
      [cx + side * 2.5, footY + 0.8],
    ];
    fill_polygon(
      ctx,
      foot,
      iron(cx + Math.min(side * 2.5, side * 16), cx + Math.max(side * 2.5, side * 16)),
    );
    line(
      ctx,
      cx + side * 3,
      footY - 2.4,
      cx + side * 15.5,
      footY + 1.6,
      css(IRON_HIGHLIGHT, 0.8),
      0.8,
    );
    if (frame.isHighContrast) {
      ctx.beginPath();
      foot.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = stroke.style;
      ctx.lineWidth = stroke.width * 0.6;
      ctx.stroke();
    }
    fill_ellipse(ctx, cx + side * 15.8, footY + 3.4, 2.2, 1, css(shade(CAST_IRON, 0.5)));
  }
  fill_ellipse(
    ctx,
    cx,
    footY - 1,
    5.2,
    2.8,
    radial_gradient(ctx, cx - 1.8, footY - 2.6, 0.3, 6, [
      [0, IRON_HIGHLIGHT],
      [1, shade(CAST_IRON, 0.25)],
    ]),
  );
}

/**
 * Paints the small things that live on a café table: a tissue packet and a stainless toothpick
 * holder at the middle, clear of the diners' places.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the top.
 * @param cy - Centre y of the top, on the texture.
 */
function paint_cafe_condiments(ctx: PaintContext, cx: number, cy: number): void {
  fill_rounded_rect(ctx, cx - 9, cy - 2.6, 9, 6, 1.2, css(SHADOW_INK, 0.16));
  fill_rounded_rect(ctx, cx - 10, cy - 4, 9, 6, 1.2, css(0xf7f2e6));
  line(ctx, cx - 8.8, cy - 1, cx - 2.2, cy - 1, css(0xc9bfab), 0.7);
  fill_rounded_rect(ctx, cx - 9.6, cy - 3.6, 8.2, 1.4, 0.7, css(0xffffff, 0.7));
  fill_ellipse(ctx, cx + 5, cy + 1.6, 2.6, 1.2, css(SHADOW_INK, 0.18));
  fill_rounded_rect(ctx, cx + 2.2, cy - 2.4, 4.6, 4, 1.4, css(shade(STEEL, 0.2)));
  fill_ellipse(ctx, cx + 4.5, cy - 2.4, 2.3, 1, css(tint(STEEL, 0.35)));
  for (const pickX of [-0.8, 0, 0.9]) {
    line(ctx, cx + 4.5 + pickX, cy - 2.6, cx + 4.5 + pickX * 1.6, cy - 5, css(0xd9c39a), 0.5);
  }
}

/**
 * Paints the round café table: a matt marble top seen from above as an ellipse, with a thick
 * bullnose edge on its near side and a soft shade under it, on a cast-iron pedestal that is
 * hidden under the top apart from a short stub and the cross foot peeking out below its edge.
 *
 * @param ctx - The paint context.
 * @param top - The table's elliptical top.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_cafe_table(
  ctx: PaintContext,
  top: TableTop,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const cx = top.centreX;
  const rx = top.halfWidth;
  const ry = top.halfDepth;
  const cy = top.centreY - top.lift;
  const edgeBottom = cy + ry + THICK_EDGE;
  floor_shadow(
    ctx,
    { x0: cx - rx + 5, y0: top.centreY - ry + 5, x1: cx + rx - 5, y1: top.centreY + ry - 1 },
    { round: true, alpha: 0.26 },
  );
  // The pedestal stands under the top's centre; drawn in the 3/4 view, only its stub and cross
  // foot show below the near edge.
  paint_cafe_foot(ctx, cx, edgeBottom + 5.5, edgeBottom - 2, frame);
  // The bullnose edge: a darker underside, then its rounded upper half catching some light.
  fill_ellipse(ctx, cx, cy + THICK_EDGE, rx, ry, css(shade(MARBLE, 0.32)));
  fill_ellipse(ctx, cx, cy + THICK_EDGE * 0.5, rx, ry, css(shade(MARBLE, 0.13)));
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.clip();
  fill_marble(ctx, cx, cy, rx, ry, recipe.seed, frame);
  ctx.fillStyle = linear_gradient(ctx, 0, cy + ry * 0.35, 0, cy + ry, [
    [0, SHADOW_INK, 0],
    [1, SHADOW_INK, 0.09],
  ]);
  ctx.fillRect(cx - rx, cy, rx * 2, ry);
  fill_ellipse(
    ctx,
    cx - rx * 0.32,
    cy - ry * 0.3,
    rx * 0.62,
    ry * 0.5,
    radial_gradient(ctx, cx - rx * 0.32, cy - ry * 0.3, 0, rx * 0.62, [
      [0, 0xffffff, 0.14],
      [1, 0xffffff, 0],
    ]),
  );
  ctx.restore();
  // The arris where the top meets its edge, lit along the near side.
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 0.6, ry - 0.6, 0, Math.PI * 0.1, Math.PI * 0.9);
  ctx.strokeStyle = css(0xffffff, 0.4);
  ctx.lineWidth = 0.9;
  ctx.lineCap = "round";
  ctx.stroke();
  paint_cafe_condiments(ctx, cx, cy);
  const stroke = outline_style(frame, MARBLE);
  ctx.beginPath();
  ctx.ellipse(cx, cy + THICK_EDGE, rx, ry, 0, 0, Math.PI);
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.strokeStyle = stroke.style;
  ctx.lineWidth = stroke.width;
  ctx.stroke();
}

/**
 * Paints the terrazzo feature table: a foreshortened terrazzo top with a thick polished edge
 * finished in brass, on four short square bronze legs that are mostly hidden under it, with a
 * feathered shade on the floor below.
 *
 * @param ctx - The paint context.
 * @param top - The table's top.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_terrazzo_table(
  ctx: PaintContext,
  top: TableTop,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const rect = top_ground_rect(top);
  const radius = 5;
  floor_shadow(ctx, inset_rect(rect, 5), { alpha: 0.3 });
  // Four short, square bronze legs stand under the corners of the top; in the 3/4 view the near
  // pair peeks out below its edge, with the far pair further in and a little higher.
  const legHeight = top.lift - THICK_EDGE;
  const footY = rect.y1 - 1;
  paint_leg_row(
    ctx,
    [rect.x0 + 9, rect.x1 - 9],
    footY,
    legHeight,
    shade(BRONZE, 0.15),
    frame,
    TERRAZZO_LEG_WIDTH,
  );
  const face = paint_rect_top(
    ctx,
    rect,
    top.lift,
    {
      top: TERRAZZO,
      rim: shade(TERRAZZO, 0.08),
      radius,
      edgeDepth: THICK_EDGE,
      edge: shade(TERRAZZO, 0.1),
    },
    frame,
    (painted) => fill_terrazzo(ctx, painted, recipe.seed, frame),
  );
  if (!frame.isLowDetail) {
    // The polished edge shows the same aggregate, more sparsely.
    ctx.save();
    ctx.beginPath();
    ctx.rect(face.x + radius, face.y + face.height, face.width - radius * 2, THICK_EDGE - 0.6);
    ctx.clip();
    speckle(
      ctx,
      face.x + radius,
      face.y + face.height,
      face.width - radius * 2,
      THICK_EDGE,
      Math.round(face.width / 4),
      TERRAZZO_FINE_CHIPS,
      recipe.seed ^ 0x5bd1e995,
      0.7,
    );
    ctx.restore();
  }
  // A brass strip finishes the near edge.
  line(
    ctx,
    face.x + radius - 1,
    face.y + face.height + 0.4,
    face.x + face.width - radius + 1,
    face.y + face.height + 0.4,
    css(BRASS, 0.9),
    0.9,
    "butt",
  );
}

/**
 * Paints a table in the 3/4 view, turned to its placement rotation.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box (the rotated footprint, top at the overhang).
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; long tables run along their rotated footprint and
 *   the accessible table turns its approach end. Defaults to the authored orientation.
 */
export function paint_table(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  const style: TableStyle = resolve_placeable_style("table", recipe);
  const top = table_top(box, recipe);
  const motif = recipe.motif;
  if (style.top === "terrazzo") paint_terrazzo_table(ctx, top, recipe, frame);
  else if (style.top === "round") paint_cafe_table(ctx, top, recipe, frame);
  else if (style.top === "snack-ledge") paint_snack_ledge(ctx, box, top, recipe, frame);
  else if (style.support === "folding") paint_folding_table(ctx, box, top, recipe, frame);
  else if (style.support === "trestle") paint_trestle_table(ctx, box, top, recipe, frame);
  else if (motif.includes("accessible")) {
    paint_accessible_table(ctx, top, recipe, frame, fit_rotation(box, rotation));
  } else if (motif.includes("communal")) paint_communal_table(ctx, box, top, recipe, frame);
  else paint_compact_table(ctx, top, recipe, frame);
}
