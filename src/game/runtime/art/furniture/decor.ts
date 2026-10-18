/**
 * Decor painters: fabric ceiling bunting, the tabletop flower vase, the feature centre clock,
 * the geometric tile mural and the community noticeboard, in the 3/4 oblique view.
 *
 * Guests walk across every decor tile, so the world view draws all but the vase above people,
 * and those pieces hang from the ceiling. The bunting swags along its footprint in two strings
 * east-west, and zig-zags across the aisle in one string north-south. The clock, the mural and
 * the noticeboard are panels hung on rods that rise out of the texture's top edge, high in the
 * overhang with empty floor and only a faint shadow below; each faces the camera at every
 * rotation and keeps its height, so turned north-south it becomes a narrower panel over the
 * north tile. The mural is an original Peranakan-inspired geometric tile panel in a timber
 * frame, the clock a wall clock on a teal-framed plaque, the noticeboard cork with pinned
 * papers. The vase is the one low piece: a small vase of flowers on a low stand tucked into its
 * tile's north-west corner, so a guest crossing the tile passes beside it. The vase is lit from
 * the north-west and casts a soft shadow to the south-east. The construction is chosen through
 * the ID-keyed style tables in `render/art.ts`, with the motif telling the mural from the
 * noticeboard.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  label,
  line,
  linear_gradient,
  outline,
  radial_gradient,
  seeded,
  SHADOW_INK,
  shade,
  speckle,
  stroke_ellipse,
  TAU,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import { type Box, TIMBER } from "./shared";
import {
  CREAM,
  fill_lit_face,
  fill_top_surface,
  hung_floor_line,
  hung_shadow,
  INK,
  LEAF,
  MUSTARD,
  paint_board,
  paint_hanger,
  PLASTER,
  type Rect,
  TEAL_STEEL,
  VERMILION,
} from "./uprights";

/** Bunting cable colour. */
const CABLE = 0x6b4c32;
/** Celadon glaze of the flower vase. */
const CELADON = 0x5f9ea0;
/** Teak of the vase's low stand. */
const TEAK = 0x8c5a3a;
/** Bougainvillea pink. */
const BLOOM_PINK = 0xd84f8a;
/** Brass of the clock bezel. */
const BRASS = 0xc9a24a;
/** Walnut rim of the clock. */
const CLOCK_WOOD = 0x8c633f;
/** Cork of the noticeboard. */
const CORK = 0xcf9b60;
/** Darker and lighter cork granules. */
const CORK_CHIPS = [0xb5813f, 0xdeb07a, 0xa77238] as const;
/** The paper colours pinned to the noticeboard. */
const PAPERS = [0xfdf6e3, 0xf9e7a1, 0xcfe6ea, 0xf6cfd1, 0xd9ead3, 0xfdf6e3] as const;
/** The pin head colours of the noticeboard. */
const PINS = [VERMILION, 0x3d6fa8, MUSTARD, LEAF] as const;
/** The flower colours of the vase. */
const VASE_BLOOMS = [BLOOM_PINK, MUSTARD, CREAM, 0xf2a0b6] as const;
/** Glazed tile body of the mural. */
const TILE_CREAM = 0xf6eedc;
/** Rose glaze of the mural. */
const TILE_ROSE = 0xd9839b;
/** Cobalt glaze of the mural. */
const TILE_COBALT = 0x3d6fa8;
/** Jade glaze of the mural. */
const TILE_JADE = 0x5e9c83;
/** Size of one mural tile; the panel holds two rows. */
const MURAL_TILE = 10.5;
/** Width of the mural's timber frame around the tiles. */
const MURAL_FRAME = 2.5;
/** Depth of a hung panel's top edge, seen from above. */
const PANEL_DEPTH = 3;
/** How far a board's lit top edge rises above its front face (see `paint_board`). */
const BOARD_EDGE = 2.5;
/** Radius of the clock face. */
const CLOCK_RADIUS = 9;
/** Height of the vase's low stand, from the floor to its top surface. */
const VASE_STAND_HEIGHT = 7;
/** Radius of the vase stand's round top. */
const VASE_STAND_RADIUS = 6.5;
/** Height of the vase from the stand's surface to its mouth. */
const VASE_HEIGHT = 6;
/** How far the blooms rise above the stand's surface. */
const VASE_BLOOM_RISE = 10;

/** The decor pieces that hang from the ceiling as framed panels. */
export type HungDecor = "mural" | "noticeboard" | "clock";

/**
 * The front face of each hung panel: its top edge, its height (kept at every rotation) and its
 * widest east-west width.
 */
const HUNG_DECOR_PANELS: Readonly<
  Record<HungDecor, { readonly top: number; readonly height: number; readonly maxWidth: number }>
> = {
  mural: { top: 9, height: MURAL_TILE * 2 + MURAL_FRAME * 2, maxWidth: 180 },
  noticeboard: { top: 8, height: 28, maxWidth: 80 },
  clock: { top: 8, height: 26, maxWidth: 66 },
};

/** One string of pennants: its anchor points, sag, pennant count, scale and opacity. */
interface PennantString {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly sag: number;
  readonly count: number;
  readonly size: number;
  readonly alpha: number;
}

/** The two glaze schemes the mural's tiles alternate between. */
interface TileScheme {
  readonly petal: number;
  readonly leaf: number;
}

/** The mural's checkerboard of schemes; the corner motifs share one colour so they join. */
const TILE_SCHEMES: readonly TileScheme[] = [
  { petal: TILE_ROSE, leaf: TILE_JADE },
  { petal: TILE_COBALT, leaf: MUSTARD },
];

/** Where the flower vase and its stand sit inside the texture. */
export interface VaseLayout {
  /** Centre x of the stand and the vase. */
  readonly cx: number;
  /** Texture y of the stand's floor point. */
  readonly floorY: number;
  /** Texture y of the centre of the stand's top surface, where the vase stands. */
  readonly surfaceY: number;
  /** Radius of the stand's top. */
  readonly standRadius: number;
  /** Texture y of the vase's mouth. */
  readonly mouthY: number;
  /** Texture y the highest bloom reaches. */
  readonly bloomTopY: number;
}

/** Paints one decor construction in its rotated orientation. */
type DecorPainter = (
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
) => void;

/**
 * Paints decor in its rotated orientation.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box (already the rotated size).
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; 90 and 270 run long pieces north-south.
 */
export function paint_decor(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  const style = resolve_placeable_style("decor", recipe);
  const painter =
    style === "board"
      ? recipe.motif.includes("mural")
        ? paint_tile_mural
        : paint_noticeboard
      : DECOR_PAINTERS[style];
  painter(ctx, box, recipe, frame, rotation);
}

/**
 * Lays out a hung decor panel: high in the texture, centred on the footprint's width, as wide
 * as the piece allows east-west and as wide as the tile north-south.
 *
 * @param box - The footprint box (already the rotated size).
 * @param kind - Which panel.
 * @returns The panel's front face.
 */
export function hung_decor_panel(box: Box, kind: HungDecor): Rect {
  const size = HUNG_DECOR_PANELS[kind];
  const width = box.height > box.width ? box.width - 8 : Math.min(size.maxWidth, box.width - 12);
  return { x: box.centreX - width / 2, y: size.top, width, height: size.height };
}

/**
 * Lays out the flower vase: a low round stand in the tile's north-west corner with a small
 * vase on it, sized as a tabletop vase.
 *
 * @param box - The footprint box.
 * @returns The layout.
 */
export function vase_layout(box: Box): VaseLayout {
  const floor_y = box.y + 11;
  const surface_y = floor_y - VASE_STAND_HEIGHT;
  return {
    cx: box.x + 10,
    floorY: floor_y,
    surfaceY: surface_y,
    standRadius: VASE_STAND_RADIUS,
    mouthY: surface_y - VASE_HEIGHT,
    bloomTopY: surface_y - VASE_BLOOM_RISE,
  };
}

/**
 * Paints what holds a hung panel up: its faint shadow on the floor far below and a rod near
 * each end rising out of the texture's top edge.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param panel - The panel's front face.
 * @param edge - How far the panel's top edge rises above its front face.
 * @param frame - The paint frame.
 */
function paint_hung_supports(
  ctx: PaintContext,
  box: Box,
  panel: Rect,
  edge: number,
  frame: PaintFrame,
): void {
  hung_shadow(ctx, box, panel.x + 8, hung_floor_line(box, panel.y + panel.height), panel.width - 6);
  const inset = Math.min(12, panel.width / 5);
  for (const hanger of [panel.x + inset, panel.x + panel.width - inset]) {
    paint_hanger(ctx, hanger, panel.y - edge + 1, frame);
  }
}

/**
 * Gives a point on a quadratic cable at a fraction of its length.
 *
 * @param string - The string.
 * @param t - The fraction, 0 to 1.
 * @returns The point.
 */
function cable_point(string: PennantString, t: number): { x: number; y: number } {
  const control_x = (string.x0 + string.x1) / 2;
  const control_y = (string.y0 + string.y1) / 2 + string.sag * 2;
  const u = 1 - t;
  return {
    x: u * u * string.x0 + 2 * u * t * control_x + t * t * string.x1,
    y: u * u * string.y0 + 2 * u * t * control_y + t * t * string.y1,
  };
}

/**
 * Paints one string of pennants along a sagging cable, each pennant's hem sewn along the cable
 * and its tip hanging straight down with a little seeded flutter, and a clip at each end.
 *
 * @param ctx - The paint context.
 * @param string - The string.
 * @param colours - The pennant colours, cycled.
 * @param colour_offset - Where in the cycle the string starts.
 * @param next - The seeded sequence.
 * @param frame - The paint frame.
 */
function paint_pennant_string(
  ctx: PaintContext,
  string: PennantString,
  colours: readonly number[],
  colour_offset: number,
  next: () => number,
  frame: PaintFrame,
): void {
  const { x0, x1, y0, y1, sag, count, size, alpha } = string;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
  ctx.strokeStyle = css(frame.isHighContrast ? SHADOW_INK : CABLE);
  ctx.lineWidth = (frame.isHighContrast ? 2.2 : 1.4) * size;
  ctx.lineCap = "round";
  ctx.stroke();
  const length = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
  const half_span = Math.min(0.42 / count, (5.5 * size) / length);
  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    const colour_value = colours[(index + colour_offset) % colours.length] as number;
    paint_pennant(
      ctx,
      cable_point(string, t - half_span),
      cable_point(string, t + half_span),
      14 * size,
      (next() - 0.5) * 2.4 * size,
      colour_value,
      frame,
    );
  }
  fill_circle(ctx, x0, y0, 1.5 * size, css(shade(CABLE, 0.2)));
  fill_circle(ctx, x1, y1, 1.5 * size, css(shade(CABLE, 0.2)));
  ctx.restore();
}

/**
 * Paints one fabric pennant: its hem sewn along the cable between two points and its tip
 * hanging straight down from the hem's middle, with the half towards the light lit, a crease
 * and the hem's seam.
 *
 * @param ctx - The paint context.
 * @param start - One end of the hem.
 * @param end - The other end of the hem.
 * @param drop - How far the tip hangs below the hem's middle.
 * @param flutter - How far the tip swings sideways.
 * @param colour_value - Fabric colour.
 * @param frame - The paint frame.
 */
function paint_pennant(
  ctx: PaintContext,
  start: { x: number; y: number },
  end: { x: number; y: number },
  drop: number,
  flutter: number,
  colour_value: number,
  frame: PaintFrame,
): void {
  const west = start.x <= end.x ? start : end;
  const east = start.x <= end.x ? end : start;
  const middle = { x: (west.x + east.x) / 2, y: (west.y + east.y) / 2 };
  const tip = { x: middle.x + flutter, y: middle.y + drop };
  fill_polygon(
    ctx,
    [
      [west.x, west.y],
      [east.x, east.y],
      [tip.x, tip.y],
    ],
    css(colour_value),
  );
  fill_polygon(
    ctx,
    [
      [west.x, west.y],
      [middle.x, middle.y],
      [tip.x, tip.y],
    ],
    css(tint(colour_value, 0.4), 0.45),
  );
  if (!frame.isLowDetail) {
    line(
      ctx,
      middle.x + 0.6,
      middle.y + 1.5,
      tip.x + 0.4,
      tip.y - 2.5,
      css(shade(colour_value, 0.5), 0.25),
      0.8,
    );
  }
  line(ctx, west.x, west.y, east.x, east.y, css(shade(colour_value, 0.3)), 2);
  if (frame.isHighContrast) {
    ctx.beginPath();
    ctx.moveTo(west.x, west.y);
    ctx.lineTo(east.x, east.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.closePath();
    ctx.strokeStyle = css(SHADOW_INK);
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

/**
 * The ceiling bunting: east-west, a soft back string and a front string swagging the length of
 * the footprint; north-south, one string zig-zagging across the aisle from end to end.
 */
const paint_bunting: DecorPainter = (ctx, box, recipe, frame) => {
  const next = seeded(recipe.seed);
  const colours = [recipe.accent, MUSTARD, CREAM, TEAL_STEEL, VERMILION, LEAF] as const;
  if (box.height > box.width) {
    const segments = Math.max(2, Math.round(box.height / 48));
    const top = box.y - 8;
    const step = (box.bottom - 22 - top) / segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const is_eastward = segment % 2 === 0;
      paint_pennant_string(
        ctx,
        {
          x0: is_eastward ? box.x + 5 : box.right - 5,
          x1: is_eastward ? box.right - 5 : box.x + 5,
          y0: top + segment * step,
          y1: top + (segment + 1) * step,
          sag: 3,
          count: 3,
          size: 0.8,
          alpha: 1,
        },
        colours,
        segment * 3,
        next,
        frame,
      );
    }
    return;
  }
  if (!frame.isLowDetail) {
    paint_pennant_string(
      ctx,
      {
        x0: box.x + 14,
        x1: box.right - 14,
        y0: box.y - 8,
        y1: box.y - 8,
        sag: 8,
        count: 7,
        size: 0.72,
        alpha: 0.8,
      },
      colours,
      2,
      next,
      frame,
    );
  }
  paint_pennant_string(
    ctx,
    {
      x0: box.x + 4,
      x1: box.right - 4,
      y0: box.y,
      y1: box.y,
      sag: 12,
      count: 9,
      size: 1,
      alpha: 1,
    },
    colours,
    0,
    next,
    frame,
  );
};

/**
 * Paints the vase's low stand: its soft shadow, a short turned teak column with a foot, and a
 * round top seen from above with its shaded rim.
 *
 * @param ctx - The paint context.
 * @param layout - The vase layout.
 * @param frame - The paint frame.
 */
function paint_vase_stand(ctx: PaintContext, layout: VaseLayout, frame: PaintFrame): void {
  const { cx, floorY, surfaceY, standRadius } = layout;
  const radius_y = standRadius * 0.42;
  ctx.save();
  ctx.shadowBlur = 4;
  ctx.shadowColor = css(SHADOW_INK, 0.2);
  fill_ellipse(ctx, cx + 3, floorY + 1.4, standRadius + 1, radius_y + 0.8, css(SHADOW_INK, 0.18));
  ctx.restore();
  fill_ellipse(ctx, cx, floorY, 4.4, 1.7, css(shade(TEAK, 0.35)));
  fill_rounded_rect(
    ctx,
    cx - 2.6,
    surfaceY,
    5.2,
    floorY - surfaceY,
    1.2,
    linear_gradient(ctx, cx - 2.6, 0, cx + 2.6, 0, [
      [0, tint(TEAK, 0.3)],
      [0.5, TEAK],
      [1, shade(TEAK, 0.4)],
    ]),
  );
  fill_ellipse(ctx, cx, surfaceY + 1.3, standRadius, radius_y, css(shade(TEAK, 0.3)));
  fill_ellipse(
    ctx,
    cx,
    surfaceY,
    standRadius,
    radius_y,
    radial_gradient(ctx, cx - 2, surfaceY - 1, 0, standRadius, [
      [0, tint(TEAK, 0.35)],
      [1, tint(TEAK, 0.05)],
    ]),
  );
  if (frame.isHighContrast) {
    stroke_ellipse(ctx, cx, surfaceY + 0.6, standRadius, radius_y + 0.6, css(SHADOW_INK), 1.2);
  }
}

/**
 * The tabletop flower vase: a small celadon vase of blooms on a low teak stand, tucked into the
 * tile's north-west corner at tabletop scale.
 */
const paint_flower_vase: DecorPainter = (ctx, box, recipe, frame) => {
  const layout = vase_layout(box);
  const { cx, surfaceY, mouthY } = layout;
  const next = seeded(recipe.seed);
  paint_vase_stand(ctx, layout, frame);
  fill_ellipse(ctx, cx + 1, surfaceY + 0.3, 3, 0.9, css(SHADOW_INK, 0.3));
  const body_y = surfaceY - 2.3;
  fill_ellipse(
    ctx,
    cx,
    body_y,
    2.7,
    2.6,
    linear_gradient(ctx, cx - 2.7, 0, cx + 2.7, 0, [
      [0, tint(CELADON, 0.35)],
      [0.5, CELADON],
      [1, shade(CELADON, 0.4)],
    ]),
  );
  fill_rounded_rect(
    ctx,
    cx - 1.2,
    mouthY,
    2.4,
    body_y - mouthY,
    0.8,
    linear_gradient(ctx, cx - 1.2, 0, cx + 1.2, 0, [
      [0, tint(CELADON, 0.3)],
      [1, shade(CELADON, 0.35)],
    ]),
  );
  if (!frame.isLowDetail) fill_ellipse(ctx, cx - 1.1, body_y - 0.9, 0.6, 1.1, css(0xffffff, 0.45));
  const rise = mouthY - layout.bloomTopY;
  const blooms: { x: number; y: number }[] = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI * 0.86 + (index * Math.PI * 0.72) / 4;
    const reach = rise * (0.75 + next() * 0.25);
    const bloom_x = cx + Math.cos(angle) * reach * 1.15;
    const bloom_y = mouthY + Math.sin(angle) * reach;
    line(ctx, cx, mouthY, bloom_x, bloom_y, css(LEAF), 0.7);
    blooms.push({ x: bloom_x, y: bloom_y });
    if (index % 2 === 1 && !frame.isLowDetail) {
      ctx.save();
      ctx.translate((cx + bloom_x) / 2, (mouthY + bloom_y) / 2);
      ctx.rotate(angle + Math.PI / 2);
      fill_ellipse(ctx, 0, 0, 1.5, 0.7, css(0x6a9a5b));
      ctx.restore();
    }
  }
  fill_ellipse(ctx, cx, mouthY, 1.5, 0.6, css(tint(CELADON, 0.2)));
  blooms.forEach((bloom, index) => {
    const colour_value =
      index === 2 ? recipe.accent : (VASE_BLOOMS[index % VASE_BLOOMS.length] as number);
    for (let petal = 0; petal < 5; petal += 1) {
      ctx.save();
      ctx.translate(bloom.x, bloom.y);
      ctx.rotate((petal / 5) * TAU + index * 0.4);
      fill_ellipse(ctx, 1, 0, 1, 0.75, css(colour_value));
      ctx.restore();
    }
    fill_circle(ctx, bloom.x, bloom.y, 0.6, css(index % 2 ? 0x8a5a2b : MUSTARD));
  });
  if (frame.isHighContrast) stroke_ellipse(ctx, cx, body_y, 2.7, 2.6, css(SHADOW_INK), 1);
};

/**
 * Paints a wall clock seen face-on: its shadow on the plaque, a walnut rim with a brass bezel, a
 * cream face with bold quarter ticks, hands at ten past ten and a vermilion second hand.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the face.
 * @param cy - Centre y of the face.
 * @param radius - Radius of the face.
 * @param frame - The paint frame.
 */
function paint_clock_face(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  frame: PaintFrame,
): void {
  const rim = radius + 2.4;
  ctx.save();
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1.5;
  ctx.shadowOffsetY = 2;
  ctx.shadowColor = css(SHADOW_INK, 0.35);
  fill_circle(ctx, cx, cy, rim, css(shade(CLOCK_WOOD, 0.35)));
  ctx.restore();
  fill_circle(
    ctx,
    cx,
    cy,
    rim,
    radial_gradient(ctx, cx - 3, cy - 3, 1, rim + 3, [
      [0, tint(CLOCK_WOOD, 0.3)],
      [1, shade(CLOCK_WOOD, 0.2)],
    ]),
  );
  stroke_ellipse(ctx, cx, cy, radius + 0.7, radius + 0.7, css(BRASS), 1.1);
  fill_circle(
    ctx,
    cx,
    cy,
    radius,
    radial_gradient(ctx, cx - 2.5, cy - 3, 1, radius * 1.4, [
      [0, 0xfffaf0],
      [1, 0xeadfc8],
    ]),
  );
  for (let mark = 0; mark < 12; mark += 1) {
    const angle = (mark / 12) * TAU;
    const is_quarter = mark % 3 === 0;
    if (frame.isLowDetail && !is_quarter) continue;
    const inner = radius - (is_quarter ? 3.2 : 2);
    const outer = radius - 1;
    line(
      ctx,
      cx + Math.cos(angle) * inner,
      cy + Math.sin(angle) * inner,
      cx + Math.cos(angle) * outer,
      cy + Math.sin(angle) * outer,
      css(INK),
      is_quarter ? 1.4 : 0.8,
    );
  }
  const hour = -Math.PI / 2 + TAU * (10 / 12 + 10 / 720);
  const minute = -Math.PI / 2 + TAU * (10 / 60);
  const second = -Math.PI / 2 + TAU * (38 / 60);
  line(
    ctx,
    cx,
    cy,
    cx + Math.cos(hour) * radius * 0.52,
    cy + Math.sin(hour) * radius * 0.52,
    css(INK),
    1.9,
  );
  line(
    ctx,
    cx,
    cy,
    cx + Math.cos(minute) * radius * 0.8,
    cy + Math.sin(minute) * radius * 0.8,
    css(INK),
    1.4,
  );
  line(
    ctx,
    cx - Math.cos(second) * 2.5,
    cy - Math.sin(second) * 2.5,
    cx + Math.cos(second) * radius * 0.85,
    cy + Math.sin(second) * radius * 0.85,
    css(VERMILION),
    0.7,
  );
  fill_circle(ctx, cx, cy, 1.5, css(INK));
  fill_circle(ctx, cx, cy, 0.6, css(VERMILION));
  if (!frame.isLowDetail) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, Math.PI * 1.05, Math.PI * 1.45);
    ctx.strokeStyle = css(0xffffff, 0.45);
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  if (frame.isHighContrast) stroke_ellipse(ctx, cx, cy, rim, rim, css(SHADOW_INK), 1.8);
}

/**
 * Paints the top edge of a hung panel, seen from above, so the panel reads as a solid board.
 *
 * @param ctx - The paint context.
 * @param panel - The panel's front face.
 * @param colour_value - The edge's material.
 */
function paint_panel_top(ctx: PaintContext, panel: Rect, colour_value: number): void {
  fill_top_surface(
    ctx,
    { x: panel.x + 0.5, y: panel.y - PANEL_DEPTH, width: panel.width - 1, height: PANEL_DEPTH + 1 },
    colour_value,
    1,
  );
}

/**
 * Paints the small glazed diamonds that flank the clock on its wider east-west plaque.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the column of diamonds.
 * @param cy - Vertical centre of the column.
 * @param colours - The glaze of the upper and the lower diamond.
 */
function paint_clock_diamonds(
  ctx: PaintContext,
  cx: number,
  cy: number,
  colours: readonly [number, number],
): void {
  colours.forEach((colour_value, index) => {
    const centre_y = cy + (index === 0 ? -4.6 : 4.6);
    fill_polygon(
      ctx,
      [
        [cx, centre_y - 4],
        [cx + 3.4, centre_y],
        [cx, centre_y + 4],
        [cx - 3.4, centre_y],
      ],
      css(colour_value),
    );
    fill_circle(ctx, cx, centre_y, 1, css(CREAM));
  });
}

/**
 * The feature centre clock: a wall clock on a teal-framed plaster plaque hung from two rods,
 * flanked by glazed diamonds on its wider east-west plaque.
 */
const paint_feature_clock: DecorPainter = (ctx, box, _recipe, frame) => {
  const plaque = hung_decor_panel(box, "clock");
  paint_hung_supports(ctx, box, plaque, PANEL_DEPTH, frame);
  paint_panel_top(ctx, plaque, tint(TEAL_STEEL, 0.2));
  fill_lit_face(ctx, plaque, TEAL_STEEL, 1.5, 0.2);
  const field: Rect = {
    x: plaque.x + 2.5,
    y: plaque.y + 2.5,
    width: plaque.width - 5,
    height: plaque.height - 5,
  };
  fill_lit_face(ctx, field, PLASTER, 1, 0.08);
  fill_rounded_rect(ctx, field.x, field.y, field.width, 1.4, 0, css(SHADOW_INK, 0.18));
  const cx = plaque.x + plaque.width / 2;
  const cy = plaque.y + plaque.height / 2;
  if (plaque.width > 48 && !frame.isLowDetail) {
    const offset = (plaque.width - 5) / 4 + 3;
    paint_clock_diamonds(ctx, cx - offset, cy, [TEAL_STEEL, MUSTARD]);
    paint_clock_diamonds(ctx, cx + offset, cy, [MUSTARD, VERMILION]);
  }
  paint_clock_face(ctx, cx, cy, CLOCK_RADIUS, frame);
  if (frame.isHighContrast) {
    outline(
      ctx,
      plaque.x,
      plaque.y - PANEL_DEPTH,
      plaque.width,
      plaque.height + PANEL_DEPTH,
      1.5,
      TEAL_STEEL,
      true,
    );
  }
};

/**
 * Paints one geometric tile: a cream body with a four-petal rosette and diagonal leaves, and a
 * jade quarter disc in each corner, so four tiles meeting at a corner form a jade medallion
 * with a mustard heart. The motif is an original composition, not a copy of any tile.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param scheme - The glazes of this tile.
 * @param frame - The paint frame.
 */
function paint_mural_tile(
  ctx: PaintContext,
  x: number,
  y: number,
  scheme: TileScheme,
  frame: PaintFrame,
): void {
  const size = MURAL_TILE;
  const cx = x + size / 2;
  const cy = y + size / 2;
  fill_rounded_rect(ctx, x + 0.4, y + 0.4, size - 0.8, size - 0.8, 0, css(TILE_CREAM));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 0.4, y + 0.4, size - 0.8, size - 0.8);
  ctx.clip();
  for (const [corner_x, corner_y] of [
    [x, y],
    [x + size, y],
    [x, y + size],
    [x + size, y + size],
  ] as const) {
    fill_circle(ctx, corner_x, corner_y, size * 0.3, css(TILE_JADE));
    fill_circle(ctx, corner_x, corner_y, size * 0.14, css(MUSTARD));
  }
  ctx.restore();
  for (let petal = 0; petal < 4; petal += 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((petal * Math.PI) / 2);
    fill_ellipse(ctx, size * 0.19, 0, size * 0.17, size * 0.085, css(scheme.petal));
    if (!frame.isLowDetail) {
      ctx.rotate(Math.PI / 4);
      fill_ellipse(ctx, size * 0.2, 0, size * 0.1, size * 0.045, css(scheme.leaf));
    }
    ctx.restore();
  }
  fill_circle(ctx, cx, cy, size * 0.09, css(MUSTARD));
  fill_circle(ctx, cx, cy, size * 0.035, css(TILE_CREAM));
}

/**
 * Paints the mural's tile field inside its frame, with a glaze sheen across the top row.
 *
 * @param ctx - The paint context.
 * @param field - The area inside the frame.
 * @param frame - The paint frame.
 */
function paint_mural_field(ctx: PaintContext, field: Rect, frame: PaintFrame): void {
  const columns = Math.floor(field.width / MURAL_TILE);
  const rows = Math.floor(field.height / MURAL_TILE + 0.01);
  const start_x = field.x + (field.width - columns * MURAL_TILE) / 2;
  const start_y = field.y + (field.height - rows * MURAL_TILE) / 2;
  fill_rounded_rect(ctx, field.x, field.y, field.width, field.height, 0, css(0xd8cdb6));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const scheme = TILE_SCHEMES[(row + column) % TILE_SCHEMES.length] as TileScheme;
      paint_mural_tile(
        ctx,
        start_x + column * MURAL_TILE,
        start_y + row * MURAL_TILE,
        scheme,
        frame,
      );
    }
  }
  if (!frame.isLowDetail) {
    fill_rounded_rect(ctx, field.x, field.y + 1, field.width, 1.2, 0, css(0xffffff, 0.28));
  }
  fill_rounded_rect(ctx, field.x, field.y, field.width, 1.2, 0, css(SHADOW_INK, 0.2));
}

/**
 * The geometric tile mural: two rows of glazed tiles in a timber frame, hung from two rods; the
 * panel faces the camera at every rotation, three tiles wide north-south.
 */
const paint_tile_mural: DecorPainter = (ctx, box, _recipe, frame) => {
  const panel = hung_decor_panel(box, "mural");
  paint_hung_supports(ctx, box, panel, PANEL_DEPTH, frame);
  paint_panel_top(ctx, panel, TIMBER);
  fill_lit_face(ctx, panel, TIMBER, 1.5, 0.2);
  paint_mural_field(
    ctx,
    {
      x: panel.x + MURAL_FRAME,
      y: panel.y + MURAL_FRAME,
      width: panel.width - MURAL_FRAME * 2,
      height: panel.height - MURAL_FRAME * 2,
    },
    frame,
  );
  fill_rounded_rect(
    ctx,
    panel.x + panel.width - 1.4,
    panel.y,
    1.4,
    panel.height,
    0.6,
    css(shade(TIMBER, 0.45)),
  );
  if (frame.isHighContrast) {
    outline(
      ctx,
      panel.x,
      panel.y - PANEL_DEPTH,
      panel.width,
      panel.height + PANEL_DEPTH,
      1.5,
      TIMBER,
      true,
    );
  }
};

/**
 * The community noticeboard: a timber-framed cork board hung from two rods, with a teal header
 * and a scatter of pinned, slightly askew papers. It faces the camera at every rotation:
 * north-south it is two papers wide instead of three.
 */
const paint_noticeboard: DecorPainter = (ctx, box, recipe, frame) => {
  const board = hung_decor_panel(box, "noticeboard");
  paint_hung_supports(ctx, box, board, BOARD_EDGE, frame);
  const face = paint_board(ctx, board, TIMBER, CORK, frame);
  const header = 6;
  fill_rounded_rect(ctx, face.x, face.y, face.width, header, 1.2, css(TEAL_STEEL));
  label(ctx, "NOTICES", face.x + face.width / 2, face.y + header / 2 + 0.3, {
    maxWidth: face.width - 6,
    size: 5.5,
    colour: CREAM,
    uppercase: true,
  });
  const cork: Rect = {
    x: face.x,
    y: face.y + header,
    width: face.width,
    height: face.height - header,
  };
  if (!frame.isLowDetail) {
    speckle(
      ctx,
      cork.x + 1,
      cork.y + 1,
      cork.width - 2,
      cork.height - 2,
      Math.round((cork.width * cork.height) / 14),
      CORK_CHIPS,
      recipe.seed,
      1,
    );
  }
  paint_notices(ctx, cork, box.height > box.width ? 2 : 3, 2, recipe, frame);
};

/**
 * Pins papers over the cork in a loose grid, each slightly askew.
 *
 * @param ctx - The paint context.
 * @param cork - The cork area.
 * @param columns - Papers per row.
 * @param rows - Rows of papers.
 * @param recipe - The recipe, whose seed jitters the papers and whose accent heads the poster.
 * @param frame - The paint frame.
 */
function paint_notices(
  ctx: PaintContext,
  cork: Rect,
  columns: number,
  rows: number,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const next = seeded(recipe.seed);
  const cell_width = (cork.width - 4) / columns;
  const cell_height = (cork.height - 2) / rows;
  for (let index = 0; index < columns * rows; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const width = Math.min(cell_width - 1.5, 9.5 + next() * 4);
    const height = Math.min(cell_height - 0.5, 7.5 + next() * 2.5);
    const cx = cork.x + 2 + cell_width * (column + 0.5) + (next() - 0.5) * 1.5;
    const cy = cork.y + 1 + cell_height * (row + 0.5) + (next() - 0.5) * 1;
    paint_notice(ctx, cx, cy, width, height, (next() - 0.5) * 0.22, index, recipe.accent, frame);
  }
}

/**
 * Paints one pinned notice: a tilted paper with its shadow, text lines, a poster header on the
 * first one and a coloured pin.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param width - Paper width.
 * @param height - Paper height.
 * @param tilt - Rotation in radians.
 * @param index - Which paper, for its colour and pin.
 * @param accent - Colour of the poster header.
 * @param frame - The paint frame.
 */
function paint_notice(
  ctx: PaintContext,
  cx: number,
  cy: number,
  width: number,
  height: number,
  tilt: number,
  index: number,
  accent: number,
  frame: PaintFrame,
): void {
  const half = width / 2;
  const top = -height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  fill_rounded_rect(ctx, -half + 1, top + 1.2, width, height, 0.8, css(SHADOW_INK, 0.2));
  fill_rounded_rect(
    ctx,
    -half,
    top,
    width,
    height,
    0.8,
    css(PAPERS[index % PAPERS.length] as number),
  );
  if (index === 0) fill_rounded_rect(ctx, -half + 1.5, top + 1.4, width - 3, 2, 0.5, css(accent));
  if (!frame.isLowDetail) {
    const first_line = index === 0 ? top + 4.6 : top + 2.6;
    for (let line_index = 0; line_index < 3; line_index += 1) {
      const line_y = first_line + line_index * 1.8;
      if (line_y > top + height - 1.4) break;
      const line_width = width - 4 - (line_index === 2 ? width * 0.3 : 0);
      fill_rounded_rect(ctx, -half + 2, line_y, line_width, 0.7, 0, css(INK, 0.3));
    }
  }
  fill_circle(ctx, 0, top + 1.2, 1.3, css(PINS[index % PINS.length] as number));
  if (!frame.isLowDetail) fill_circle(ctx, -0.4, top + 0.8, 0.45, css(0xffffff, 0.7));
  ctx.restore();
}

/** The painter of each non-board decor style. */
const DECOR_PAINTERS: Readonly<Record<"bunting" | "flower-vase" | "clock", DecorPainter>> = {
  bunting: paint_bunting,
  "flower-vase": paint_flower_vase,
  clock: paint_feature_clock,
};
