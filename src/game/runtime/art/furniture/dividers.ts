/**
 * Divider painters: the retractable queue rail, low timber screen, tiled half wall, clear wind
 * screen, integrated planter divider and acoustic screen, in the 3/4 oblique view.
 *
 * A divider is a long, thin, standing piece, so it is painted as a wall: running east-west (the
 * authored rotation and 180 degrees) it stands on a ground band just south of its footprint's
 * centre line, with its top surface lifted by its height and its south face below that top;
 * running north-south (90 and 270 degrees) it is seen end-on along its length, as a long top
 * strip, its south end face and a sliver of the long side its front was turned towards. Every
 * divider casts a soft shadow to the south-east and stands on feet, bases, slim legs or its own
 * plinth. The construction is chosen through the ID-keyed style tables in `render/art.ts`, with
 * the motif telling the three solid panels apart.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  brushed_steel,
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  line,
  linear_gradient,
  mix,
  outline,
  rounded_rect_path,
  seeded,
  SHADOW_INK,
  shade,
  slab,
  speckle,
  tint,
  wood_grain,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import { type Box, DARK_STEEL, LEAF_DARK, LEAF_LIGHT, SOIL, STEEL, TIMBER } from "./shared";
import {
  CREAM,
  DEEP_TEAL,
  east_west_faces,
  east_west_shadow,
  east_west_wall,
  fill_lit_face,
  fill_top_surface,
  floor_shadow,
  GROUT,
  north_south_faces,
  north_south_shadow,
  north_south_wall,
  paint_foot_plate,
  paint_post,
  paint_weighted_base,
  type Rect,
  side_for_rotation,
  TEAL_STEEL,
  TERRAZZO,
  TERRAZZO_CHIPS,
  VERMILION,
  ZINC,
} from "./uprights";

/** White glazed wall tile. */
const GLAZED_TILE = 0xf1efe6;
/** The walnut cladding of the planter box. */
const WALNUT = 0x8a5a3c;
/** The tinted acrylic of the wind screen. */
const ACRYLIC = 0xbfe3e8;
/** The sea-green edge of the wind screen's panes, which shows when they are seen end-on. */
const GLASS_EDGE = 0x5f9fa3;
/** The darker steel of the wind screen's rails. */
const RAIL_STEEL = 0x8d9b9a;
/** Bougainvillea blooms in the planter. */
const BLOOM = 0xd84f8a;
/** Paler bougainvillea bracts. */
const BLOOM_PALE = 0xf2a0b6;
/** Mid foliage tone. */
const LEAF_MID = 0x5a8a4f;

/** Height of a queue-rail stanchion, about 0.95 m. */
const RAIL_HEIGHT = 20;
/** Thickness and height of the low timber screen, about 1 m tall. */
const TIMBER_SCREEN = { thickness: 5, height: 21 } as const;
/** Thickness and height of the tiled half wall, about 1.1 m tall. */
const HALF_WALL = { thickness: 9, height: 24 } as const;
/** Thickness and height of the clear wind screen, about 1.5 m tall. */
const WIND_SCREEN = { thickness: 3, height: 30 } as const;
/** Depth and box height of the planter divider; its foliage rises `PLANTER_FOLIAGE` above. */
const PLANTER = { thickness: 20, height: 12 } as const;
/** How far the planter's foliage rises above its soil. */
const PLANTER_FOLIAGE = 13;
/**
 * Thickness and height of the acoustic screen, about 1.7 m tall, and the floor gap its slim legs
 * leave under the felt.
 */
const ACOUSTIC_SCREEN = { thickness: 3, height: 34, legGap: 6 } as const;

/** The six divider constructions. */
type DividerKind = "queue-rail" | "timber" | "tiled" | "wind" | "planter" | "acoustic";

/** Paints one divider construction in one orientation. */
type DividerPainter = (
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
) => void;

/**
 * Paints a divider in its rotated orientation.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box (already the rotated size).
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; 90 and 270 run the divider north-south.
 */
export function paint_divider(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  const kind = divider_kind(recipe);
  const painters = DIVIDER_PAINTERS[kind];
  const painter = box.height > box.width ? painters.northSouth : painters.eastWest;
  painter(ctx, box, recipe, frame, rotation);
}

/**
 * Picks the construction of a divider from its style and motif.
 *
 * @param recipe - The recipe.
 * @returns The construction.
 */
function divider_kind(recipe: PlaceableVisualRecipe): DividerKind {
  const style = resolve_placeable_style("divider", recipe);
  if (style === "queue-rail") return "queue-rail";
  if (style === "clear-wind") return "wind";
  if (style === "planter") return "planter";
  if (recipe.motif.includes("tiled")) return "tiled";
  if (recipe.motif.includes("acoustic")) return "acoustic";
  return "timber";
}

/**
 * Paints one queue-rail stanchion: a stainless post on a weighted base with the belt cassette
 * at its head and a domed cap.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the post.
 * @param ground - Texture y where the post meets its base.
 * @param frame - The paint frame.
 */
function paint_stanchion(ctx: PaintContext, cx: number, ground: number, frame: PaintFrame): void {
  const top = ground - RAIL_HEIGHT;
  paint_weighted_base(ctx, cx, ground, 7, DARK_STEEL, frame);
  paint_post(ctx, cx, top + 4, ground, STEEL, 3.4, frame);
  fill_rounded_rect(
    ctx,
    cx - 3.4,
    top,
    6.8,
    7,
    2,
    linear_gradient(ctx, cx - 3.4, 0, cx + 3.4, 0, [
      [0, tint(STEEL, 0.35)],
      [0.45, STEEL],
      [1, shade(STEEL, 0.45)],
    ]),
  );
  fill_rounded_rect(ctx, cx - 3.4, top + 5.6, 6.8, 1.4, 0.7, css(shade(STEEL, 0.4)));
  fill_ellipse(ctx, cx, top, 3.4, 1.6, css(tint(STEEL, 0.55)));
  fill_ellipse(ctx, cx - 1, top - 0.4, 1.3, 0.6, css(0xffffff, 0.7));
  if (frame.isHighContrast) {
    ctx.save();
    rounded_rect_path(ctx, cx - 3.4, top - 1.6, 6.8, 8.6, 2);
    ctx.strokeStyle = css(SHADOW_INK);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Paints a taut belt span running east-west between two stanchions, with a lit top edge.
 *
 * @param ctx - The paint context.
 * @param x0 - West end.
 * @param x1 - East end.
 * @param y - Top of the belt.
 * @param colour_value - Belt colour.
 * @param frame - The paint frame.
 */
function paint_belt_east_west(
  ctx: PaintContext,
  x0: number,
  x1: number,
  y: number,
  colour_value: number,
  frame: PaintFrame,
): void {
  const trace = (offset: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, y + offset);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + offset + 2.4, x1, y + offset);
  };
  ctx.save();
  ctx.lineCap = "butt";
  if (frame.isHighContrast) {
    trace(1.4);
    ctx.strokeStyle = css(SHADOW_INK);
    ctx.lineWidth = 4.4;
    ctx.stroke();
  }
  trace(1.4);
  ctx.strokeStyle = css(colour_value);
  ctx.lineWidth = 2.8;
  ctx.stroke();
  trace(0.3);
  ctx.strokeStyle = css(tint(colour_value, 0.5));
  ctx.lineWidth = 0.8;
  ctx.stroke();
  if (!frame.isLowDetail) {
    trace(2.5);
    ctx.strokeStyle = css(shade(colour_value, 0.45), 0.6);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.restore();
}

/** The retractable queue rail running east-west: three stanchions and two taut belts. */
const paint_queue_rail_east_west: DividerPainter = (ctx, box, recipe, frame) => {
  const ground = box.centreY + 6;
  const posts = [box.x + 9, box.centreX, box.right - 11];
  const belt_y = ground - RAIL_HEIGHT + 2.5;
  floor_shadow(ctx, box, box.x + 14, ground + 1, box.width - 22, 3.5, 0.1);
  for (let span = 0; span < posts.length - 1; span += 1) {
    const x0 = (posts[span] as number) + 3;
    const x1 = (posts[span + 1] as number) - 3;
    paint_belt_east_west(ctx, x0, x1, belt_y, recipe.accent, frame);
  }
  for (const post of posts) paint_stanchion(ctx, post, ground, frame);
};

/**
 * The retractable queue rail running north-south: three stanchions down the middle of the
 * footprint, each belt seen from above as a thin strip with the sliver of one face.
 */
const paint_queue_rail_north_south: DividerPainter = (ctx, box, recipe, frame, rotation) => {
  const cx = box.centreX;
  const grounds = [box.y + 12, box.centreY + 2, box.bottom - 9];
  const lit_west = side_for_rotation(rotation) === "west";
  floor_shadow(
    ctx,
    box,
    cx + 3,
    (grounds[0] as number) + 2,
    5,
    (grounds[2] as number) - (grounds[0] as number),
    0.08,
    "east",
  );
  grounds.forEach((ground, index) => {
    paint_stanchion(ctx, cx, ground, frame);
    const next_ground = grounds[index + 1];
    if (next_ground === undefined) return;
    const y0 = ground - RAIL_HEIGHT + 3;
    const y1 = next_ground - RAIL_HEIGHT + 3;
    fill_rounded_rect(ctx, cx - 1.3, y0, 2.6, y1 - y0, 0.6, css(recipe.accent));
    fill_rounded_rect(
      ctx,
      lit_west ? cx - 1.3 : cx + 0.2,
      y0,
      1.1,
      y1 - y0,
      0.5,
      css(lit_west ? tint(recipe.accent, 0.4) : shade(recipe.accent, 0.3)),
    );
    if (frame.isHighContrast) {
      ctx.save();
      rounded_rect_path(ctx, cx - 1.8, y0, 3.6, y1 - y0, 0.8);
      ctx.strokeStyle = css(SHADOW_INK);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  });
};

/**
 * Paints the slats of the timber screen's face: shadowed gaps and vertical slats with a lit
 * left edge.
 *
 * @param ctx - The paint context.
 * @param rect - The slatted area.
 * @param seed - Seed for the slat tones.
 */
function paint_slats(ctx: PaintContext, rect: Rect, seed: number): void {
  const next = seeded(seed);
  fill_rounded_rect(ctx, rect.x, rect.y, rect.width, rect.height, 0, css(SHADOW_INK, 0.2));
  const slat = 4.5;
  const pitch = 7;
  const count = Math.floor((rect.width + pitch - slat) / pitch);
  const start = rect.x + (rect.width - (count * pitch - (pitch - slat))) / 2;
  for (let index = 0; index < count; index += 1) {
    const slat_x = start + index * pitch;
    const tone = mix(TIMBER, 0xd9a86c, next() * 0.3);
    fill_rounded_rect(
      ctx,
      slat_x,
      rect.y,
      slat,
      rect.height,
      0.8,
      linear_gradient(ctx, slat_x, 0, slat_x + slat, 0, [
        [0, tint(tone, 0.24)],
        [0.5, tone],
        [1, shade(tone, 0.3)],
      ]),
    );
  }
}

/** The low timber screen running east-west: a grained cap, open slats, a bottom rail, feet. */
const paint_timber_east_west: DividerPainter = (ctx, box, recipe, frame) => {
  const wall = east_west_wall(box, TIMBER_SCREEN.thickness, TIMBER_SCREEN.height);
  const { top, front } = east_west_faces(wall);
  east_west_shadow(ctx, box, wall, 0.16);
  paint_slats(
    ctx,
    { x: front.x + 1.5, y: front.y + 3, width: front.width - 3, height: front.height - 7 },
    recipe.seed,
  );
  fill_lit_face(
    ctx,
    { x: front.x, y: wall.ground - 5, width: front.width, height: 3.5 },
    shade(TIMBER, 0.12),
  );
  fill_lit_face(
    ctx,
    { x: front.x, y: front.y, width: front.width, height: 3 },
    shade(TIMBER, 0.08),
  );
  fill_rounded_rect(ctx, front.x + 1, front.y + 3, front.width - 2, 1, 0, css(SHADOW_INK, 0.22));
  fill_top_surface(ctx, top, TIMBER, 1.2);
  if (!frame.isLowDetail)
    wood_grain(ctx, top.x + 2, top.y + 0.5, top.width - 4, top.height - 1, TIMBER, recipe.seed);
  fill_rounded_rect(
    ctx,
    top.x + top.width - 1.5,
    top.y,
    1.5,
    front.height + top.height - 1.5,
    0.6,
    css(shade(TIMBER, 0.45), 0.8),
  );
  const feet =
    box.width >= 120
      ? [front.x + 14, box.centreX, front.x + front.width - 14]
      : [front.x + 14, front.x + front.width - 14];
  for (const foot of feet) paint_foot_plate(ctx, foot, wall.ground - 2, 5, 6, DARK_STEEL);
  if (frame.isHighContrast)
    outline(ctx, top.x, top.y, top.width, wall.ground - top.y - 1.5, 1.5, TIMBER, true);
};

/** The low timber screen running north-south: a grained cap strip, slatted side, end face. */
const paint_timber_north_south: DividerPainter = (ctx, box, recipe, frame, rotation) => {
  const wall = north_south_wall(box, TIMBER_SCREEN.thickness, TIMBER_SCREEN.height, rotation);
  const { top, front, side } = north_south_faces(wall);
  north_south_shadow(ctx, box, wall, 0.16);
  for (const foot of [wall.north + 6, wall.south - 4])
    paint_foot_plate(ctx, wall.cx, foot - 2, 16, 4, DARK_STEEL);
  fill_lit_face(ctx, side, wall.side === "west" ? TIMBER : shade(TIMBER, 0.25));
  if (!frame.isLowDetail) {
    for (let joint = side.y + 6; joint < side.y + side.height - 2; joint += 7) {
      fill_rounded_rect(ctx, side.x, joint, side.width, 1.2, 0, css(SHADOW_INK, 0.28));
    }
  }
  fill_top_surface(ctx, top, TIMBER, 1.2);
  if (!frame.isLowDetail)
    wood_grain(
      ctx,
      top.x + 0.5,
      top.y + 2,
      top.width - 1,
      top.height - 4,
      TIMBER,
      recipe.seed,
      true,
    );
  fill_lit_face(ctx, front, shade(TIMBER, 0.2));
  fill_rounded_rect(ctx, front.x, front.y + 3, front.width, 1, 0, css(SHADOW_INK, 0.25));
  fill_rounded_rect(ctx, front.x, wall.south - 5, front.width, 1, 0, css(SHADOW_INK, 0.25));
  if (frame.isHighContrast)
    outline(ctx, top.x, top.y, top.width, wall.south - top.y, 1.5, TIMBER, true);
};

/**
 * Paints the half wall's decorative band: teal tiles with a cream diamond alternating with
 * cream tiles carrying a vermilion flower dot and four teal petals.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the first tile.
 * @param y - Top edge of the band.
 * @param columns - Number of tiles.
 * @param tile_width - Width of one tile.
 * @param row_height - Height of the band.
 * @param frame - The paint frame.
 */
function paint_tile_band(
  ctx: PaintContext,
  x: number,
  y: number,
  columns: number,
  tile_width: number,
  row_height: number,
  frame: PaintFrame,
): void {
  for (let column = 0; column < columns; column += 1) {
    const tile_x = x + column * tile_width;
    const cx = tile_x + tile_width / 2;
    const cy = y + row_height / 2;
    if (column % 2 === 0) {
      fill_rounded_rect(ctx, tile_x, y, tile_width, row_height, 0, css(TEAL_STEEL));
      fill_polygon(
        ctx,
        [
          [cx, cy - 2.8],
          [cx + 2.5, cy],
          [cx, cy + 2.8],
          [cx - 2.5, cy],
        ],
        css(CREAM),
      );
    } else {
      fill_rounded_rect(ctx, tile_x, y, tile_width, row_height, 0, css(0xf8f1e2));
      fill_circle(ctx, cx, cy, 1.4, css(VERMILION));
      if (!frame.isLowDetail) {
        for (const [dx, dy] of [
          [-2.2, -2.2],
          [2.2, -2.2],
          [-2.2, 2.2],
          [2.2, 2.2],
        ] as const) {
          fill_circle(ctx, cx + dx, cy + dy, 0.75, css(TEAL_STEEL));
        }
      }
    }
  }
}

/** The tiled half wall running east-west: terrazzo coping over glazed tiles and a skirting. */
const paint_tiled_east_west: DividerPainter = (ctx, box, recipe, frame) => {
  const wall = east_west_wall(box, HALF_WALL.thickness, HALF_WALL.height);
  const { top, front } = east_west_faces(wall);
  east_west_shadow(ctx, box, wall, 0.22);
  const lip = 3;
  const skirting = 3.5;
  fill_lit_face(ctx, front, GLAZED_TILE, 0.5, 0.1);
  const tile = 8;
  const columns = Math.floor(front.width / tile);
  const field_x = front.x + (front.width - columns * tile) / 2;
  const band_y = front.y + lip + 6;
  paint_tile_band(ctx, field_x, band_y, columns, tile, 8, frame);
  for (const grout_y of [band_y - 0.5, band_y + 7.5, wall.ground - skirting - 4]) {
    fill_rounded_rect(ctx, front.x, grout_y, front.width, 1, 0, css(GROUT));
  }
  for (let column = 1; column < columns; column += 1) {
    const grout_x = field_x + column * tile - 0.4;
    fill_rounded_rect(
      ctx,
      grout_x,
      front.y + lip,
      0.8,
      front.height - lip - skirting,
      0,
      css(GROUT, 0.85),
    );
  }
  fill_lit_face(
    ctx,
    { x: front.x, y: wall.ground - skirting, width: front.width, height: skirting },
    DEEP_TEAL,
    0.5,
  );
  fill_lit_face(
    ctx,
    { x: front.x - 1, y: front.y, width: front.width + 2, height: lip },
    shade(TERRAZZO, 0.12),
    0.8,
  );
  fill_rounded_rect(ctx, front.x, front.y + lip, front.width, 1.6, 0, css(SHADOW_INK, 0.18));
  const coping: Rect = { x: top.x - 1, y: top.y, width: top.width + 2, height: top.height };
  fill_top_surface(ctx, coping, TERRAZZO, 1);
  if (!frame.isLowDetail) {
    speckle(
      ctx,
      coping.x + 1,
      coping.y + 1,
      coping.width - 2,
      coping.height - 2,
      Math.round(coping.width / 3),
      TERRAZZO_CHIPS,
      recipe.seed,
      1.1,
    );
  }
  fill_rounded_rect(
    ctx,
    coping.x + 2,
    coping.y + 0.6,
    coping.width - 4,
    0.9,
    0.45,
    css(0xffffff, 0.45),
  );
  fill_rounded_rect(
    ctx,
    front.x + front.width - 1.5,
    front.y + lip,
    1.5,
    front.height - lip,
    0,
    css(SHADOW_INK, 0.16),
  );
  if (frame.isHighContrast)
    outline(ctx, coping.x, coping.y, coping.width, wall.ground - coping.y, 1.5, TEAL_STEEL, true);
};

/** The tiled half wall running north-south: a coping strip, a tiled side and its end face. */
const paint_tiled_north_south: DividerPainter = (ctx, box, recipe, frame, rotation) => {
  const wall = north_south_wall(box, HALF_WALL.thickness, HALF_WALL.height, rotation);
  const { top, front, side } = north_south_faces(wall);
  north_south_shadow(ctx, box, wall, 0.22);
  fill_lit_face(ctx, side, GLAZED_TILE, 0, 0.12);
  for (let tile_y = side.y + 4; tile_y < side.y + side.height - 6; tile_y += 8) {
    const index = Math.round((tile_y - side.y) / 8);
    if (index % 2 === 0)
      fill_rounded_rect(ctx, side.x, tile_y, side.width, 7, 0, css(TEAL_STEEL, 0.85));
    fill_rounded_rect(ctx, side.x, tile_y + 7, side.width, 1, 0, css(GROUT));
  }
  fill_rounded_rect(ctx, side.x, wall.south - 3.5, side.width, 3.5, 0, css(DEEP_TEAL));
  fill_lit_face(ctx, front, GLAZED_TILE, 0.5, 0.1);
  paint_tile_band(ctx, front.x, front.y + 9, 1, front.width, 8, frame);
  fill_rounded_rect(ctx, front.x, front.y + 3, front.width, 1.4, 0, css(SHADOW_INK, 0.18));
  fill_rounded_rect(ctx, front.x, wall.south - 3.5, front.width, 3.5, 0, css(DEEP_TEAL));
  const coping: Rect = { x: top.x - 1, y: top.y - 1, width: top.width + 2, height: top.height + 4 };
  fill_top_surface(ctx, coping, TERRAZZO, 1);
  fill_lit_face(
    ctx,
    { x: coping.x, y: front.y, width: coping.width, height: 3 },
    shade(TERRAZZO, 0.12),
    0.8,
  );
  if (!frame.isLowDetail) {
    speckle(
      ctx,
      coping.x + 1,
      coping.y + 1,
      coping.width - 2,
      coping.height - 2,
      Math.round(coping.height / 3),
      TERRAZZO_CHIPS,
      recipe.seed,
      1.1,
    );
  }
  fill_rounded_rect(
    ctx,
    coping.x + 0.6,
    coping.y + 2,
    0.9,
    coping.height - 4,
    0.45,
    css(0xffffff, 0.45),
  );
  if (frame.isHighContrast)
    outline(ctx, coping.x, coping.y, coping.width, wall.south - coping.y, 1.5, TEAL_STEEL, true);
};

/**
 * Paints a pane of tinted acrylic with diagonal sheen streaks and a row of frosted dots.
 *
 * @param ctx - The paint context.
 * @param pane - The pane.
 * @param frame - The paint frame.
 */
function paint_glass_pane(ctx: PaintContext, pane: Rect, frame: PaintFrame): void {
  fill_rounded_rect(ctx, pane.x, pane.y, pane.width, pane.height, 0.5, css(ACRYLIC, 0.28));
  if (!frame.isLowDetail) {
    ctx.save();
    rounded_rect_path(ctx, pane.x, pane.y, pane.width, pane.height, 0.5);
    ctx.clip();
    for (const [start, span] of [
      [0.1, 0.12],
      [0.3, 0.04],
      [0.66, 0.06],
    ] as const) {
      fill_polygon(
        ctx,
        [
          [pane.x + pane.width * start, pane.y],
          [pane.x + pane.width * (start + span), pane.y],
          [pane.x + pane.width * (start + span) - pane.height * 0.6, pane.y + pane.height],
          [pane.x + pane.width * start - pane.height * 0.6, pane.y + pane.height],
        ],
        css(0xffffff, 0.24),
      );
    }
    ctx.restore();
  }
  const dot_y = pane.y + pane.height * 0.45;
  for (let dot_x = pane.x + 5; dot_x < pane.x + pane.width - 3; dot_x += 7) {
    fill_circle(ctx, dot_x, dot_y, 1.1, css(0xffffff, 0.65));
  }
  fill_rounded_rect(ctx, pane.x, pane.y, pane.width, 0.8, 0, css(0xffffff, 0.5));
}

/**
 * Paints a square steel post of the wind screen, lit on its left.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param top - Top of the post.
 * @param bottom - Foot of the post.
 */
function paint_square_post(ctx: PaintContext, cx: number, top: number, bottom: number): void {
  fill_rounded_rect(
    ctx,
    cx - 1.6,
    top,
    3.2,
    bottom - top,
    0.4,
    linear_gradient(ctx, cx - 1.6, 0, cx + 1.6, 0, [
      [0, tint(STEEL, 0.35)],
      [1, shade(STEEL, 0.4)],
    ]),
  );
  fill_rounded_rect(ctx, cx - 1.6, top - 1.6, 3.2, 1.6, 0.4, css(tint(STEEL, 0.5)));
}

/** The clear wind screen running east-west: acrylic panes in a steel frame on three posts. */
const paint_wind_east_west: DividerPainter = (ctx, box, _recipe, frame) => {
  const wall = east_west_wall(box, WIND_SCREEN.thickness, WIND_SCREEN.height);
  const { top, front } = east_west_faces(wall);
  floor_shadow(ctx, box, front.x + 6, wall.ground - 1, front.width - 4, 6, 0.08);
  const posts = [front.x + 1.6, box.centreX, front.x + front.width - 1.6];
  const rail = 2.6;
  const bottom_rail = wall.ground - 5;
  for (let span = 0; span < posts.length - 1; span += 1) {
    const x0 = (posts[span] as number) + 1.6;
    const x1 = (posts[span + 1] as number) - 1.6;
    paint_glass_pane(
      ctx,
      { x: x0, y: front.y + rail, width: x1 - x0, height: bottom_rail - front.y - rail },
      frame,
    );
  }
  brushed_steel(ctx, front.x, bottom_rail, front.width, 2.6, 0.8);
  brushed_steel(ctx, front.x, front.y, front.width, rail, 0.8);
  fill_top_surface(ctx, top, STEEL, 0.8);
  for (const post of posts) paint_square_post(ctx, post, front.y, wall.ground - 1);
  for (const post of posts) paint_foot_plate(ctx, post, wall.ground - 2, 7, 5, DARK_STEEL);
  if (frame.isHighContrast)
    outline(ctx, top.x, top.y, top.width, wall.ground - top.y, 1, 0x477c86, true);
};

/**
 * The clear wind screen running north-south: a dark steel top rail strip, the panes seen almost
 * edge-on as a sea-green glass sliver with a bright lit edge, the bottom rail, and the posts.
 */
const paint_wind_north_south: DividerPainter = (ctx, box, _recipe, frame, rotation) => {
  const wall = north_south_wall(box, WIND_SCREEN.thickness, WIND_SCREEN.height, rotation);
  const { top, side } = north_south_faces(wall);
  floor_shadow(ctx, box, wall.cx + 1, wall.north + 2, 7, wall.south - wall.north, 0.12, "east");
  const grounds = [wall.north, (wall.north + wall.south) / 2, wall.south];
  for (const ground of grounds) paint_foot_plate(ctx, wall.cx, ground - 2.5, 9, 4, DARK_STEEL);
  const glass = { ...side, height: side.height - 4 };
  fill_rounded_rect(ctx, glass.x, glass.y, glass.width, glass.height, 0.5, css(GLASS_EDGE, 0.42));
  const lit_x = wall.side === "west" ? glass.x + 0.4 : glass.x + glass.width - 0.4;
  line(ctx, lit_x, glass.y + 2, lit_x, glass.y + glass.height - 2, css(0xffffff, 0.75), 0.8);
  if (!frame.isLowDetail) {
    for (let glint = glass.y + 10; glint < glass.y + glass.height - 10; glint += 22) {
      fill_rounded_rect(ctx, glass.x, glint, glass.width, 6, 0.5, css(0xffffff, 0.4));
    }
  }
  fill_rounded_rect(
    ctx,
    wall.cx - 0.9,
    top.y,
    1.8,
    wall.south - top.y - 4,
    0.5,
    css(GLASS_EDGE, 0.85),
  );
  brushed_steel(ctx, top.x, wall.north - 5, top.width, wall.south - wall.north, 0.8, RAIL_STEEL);
  for (const ground of grounds) paint_square_post(ctx, wall.cx, ground - wall.height, ground - 1);
  fill_rounded_rect(
    ctx,
    top.x - 0.5,
    top.y - 0.5,
    top.width + 1,
    top.height + 1,
    0.8,
    css(shade(RAIL_STEEL, 0.35)),
  );
  fill_rounded_rect(ctx, top.x, top.y, top.width * 0.45, top.height, 0.5, css(tint(STEEL, 0.4)));
  if (frame.isHighContrast)
    outline(ctx, top.x - 1, top.y, top.width + 2, wall.south - top.y, 1, 0x477c86, true);
};

/**
 * Paints a bed of rounded shrubs seen from above: rows from back to front, each shrub a shaded
 * mound with a lit crown, with optional bougainvillea blooms on the crowns.
 *
 * @param ctx - The paint context.
 * @param bed - The soil area the shrubs grow from.
 * @param rise - How far the shrub crowns rise above the soil.
 * @param seed - Seed for the shrub layout.
 * @param frame - The paint frame.
 * @param bloom_count - Number of blooms scattered over the crowns.
 */
function paint_foliage_bed(
  ctx: PaintContext,
  bed: Rect,
  rise: number,
  seed: number,
  frame: PaintFrame,
  bloom_count = 0,
): void {
  const next = seeded(seed);
  const rows = Math.max(2, Math.round(bed.height / 8));
  const columns = Math.max(1, Math.round(bed.width / 10));
  const crowns: { x: number; y: number; r: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    const soil_y = bed.y + (bed.height * (row + 0.5)) / rows;
    for (let column = 0; column < columns; column += 1) {
      const radius = Math.min(bed.width / 2 + 2, 4.6 + next() * 2.4);
      const x = bed.x + (bed.width * (column + 0.5)) / columns + (next() - 0.5) * 4;
      const y = soil_y - rise * (0.45 + next() * 0.4);
      fill_ellipse(ctx, x + 1, soil_y, radius * 0.9, radius * 0.45, css(SHADOW_INK, 0.25));
      fill_circle(ctx, x, y + radius * 0.3, radius, css(LEAF_DARK));
      fill_circle(ctx, x - radius * 0.2, y, radius * 0.82, css(LEAF_MID));
      crowns.push({ x, y, r: radius });
    }
  }
  if (!frame.isLowDetail) {
    for (const crown of crowns) {
      fill_circle(
        ctx,
        crown.x - crown.r * 0.4,
        crown.y - crown.r * 0.35,
        crown.r * 0.38,
        css(LEAF_LIGHT, 0.85),
      );
      fill_ellipse(
        ctx,
        crown.x + crown.r * 0.5,
        crown.y + crown.r * 0.4,
        1.6,
        0.9,
        css(LEAF_LIGHT, 0.5),
      );
    }
  }
  for (let index = 0; index < bloom_count && crowns.length > 0; index += 1) {
    const crown = crowns[Math.floor(next() * crowns.length)] as (typeof crowns)[number];
    const bx = crown.x + (next() - 0.5) * crown.r;
    const by = crown.y + (next() - 0.6) * crown.r;
    fill_circle(ctx, bx, by, 1.8, css(index % 3 === 2 ? BLOOM_PALE : BLOOM));
    if (!frame.isLowDetail) fill_circle(ctx, bx - 0.4, by - 0.4, 0.6, css(0xfff1c2));
  }
}

/**
 * Paints the planter box's walnut cladding: a lit face with plank joints, a lighter rim lip and
 * a shadowed kick at the floor.
 *
 * @param ctx - The paint context.
 * @param face - The cladding face.
 * @param plank - Spacing of the plank joints.
 * @param frame - The paint frame.
 */
function paint_walnut_face(ctx: PaintContext, face: Rect, plank: number, frame: PaintFrame): void {
  fill_lit_face(ctx, face, WALNUT, 1, 0.2);
  if (!frame.isLowDetail && plank > 0) {
    for (let joint = face.x + plank; joint < face.x + face.width - 3; joint += plank) {
      line(
        ctx,
        joint,
        face.y + 2.5,
        joint,
        face.y + face.height - 2,
        css(shade(WALNUT, 0.45), 0.4),
        0.8,
      );
    }
  }
  fill_rounded_rect(ctx, face.x, face.y, face.width, 2, 0.6, css(tint(WALNUT, 0.22)));
  fill_rounded_rect(
    ctx,
    face.x,
    face.y + face.height - 1.5,
    face.width,
    1.5,
    0,
    css(SHADOW_INK, 0.3),
  );
}

/**
 * Paints the planter box's top: a walnut rim around dark soil.
 *
 * @param ctx - The paint context.
 * @param top - The top surface.
 * @param seed - Seed for the soil grains.
 * @param frame - The paint frame.
 * @returns The soil area inside the rim.
 */
function paint_planter_top(ctx: PaintContext, top: Rect, seed: number, frame: PaintFrame): Rect {
  fill_top_surface(ctx, top, WALNUT, 1.5);
  const soil: Rect = { x: top.x + 2, y: top.y + 2, width: top.width - 4, height: top.height - 3.5 };
  fill_rounded_rect(ctx, soil.x, soil.y, soil.width, soil.height, 1, css(SOIL));
  fill_rounded_rect(ctx, soil.x, soil.y, soil.width, 1.4, 0, css(SHADOW_INK, 0.3));
  if (!frame.isLowDetail) {
    speckle(
      ctx,
      soil.x,
      soil.y,
      soil.width,
      soil.height,
      Math.round((soil.width * soil.height) / 40),
      [0x6e5843, 0x4a3828],
      seed,
      0.9,
    );
  }
  return soil;
}

/** The planter divider running east-west: a walnut planter box with a shrub hedge. */
const paint_planter_east_west: DividerPainter = (ctx, box, recipe, frame) => {
  const wall = east_west_wall(box, PLANTER.thickness, PLANTER.height);
  const { top, front } = east_west_faces(wall);
  east_west_shadow(ctx, box, wall, 0.22);
  paint_walnut_face(ctx, front, 9, frame);
  const soil = paint_planter_top(ctx, top, recipe.seed, frame);
  paint_foliage_bed(ctx, soil, PLANTER_FOLIAGE, recipe.seed, frame, 7 + (recipe.detailVariant % 3));
  if (frame.isHighContrast)
    outline(ctx, top.x, top.y, top.width, wall.ground - top.y, 2, WALNUT, true);
};

/** The planter divider running north-south: the box's long top, side sliver and end face. */
const paint_planter_north_south: DividerPainter = (ctx, box, recipe, frame, rotation) => {
  const wall = {
    ...north_south_wall(box, PLANTER.thickness, PLANTER.height, rotation),
    north: box.y + PLANTER.height + 2,
  };
  const { top, front, side } = north_south_faces(wall);
  north_south_shadow(ctx, box, wall, 0.22);
  fill_lit_face(ctx, side, wall.side === "west" ? WALNUT : shade(WALNUT, 0.25), 0.5);
  paint_walnut_face(ctx, front, 0, frame);
  const soil = paint_planter_top(ctx, top, recipe.seed, frame);
  paint_foliage_bed(ctx, soil, PLANTER_FOLIAGE, recipe.seed, frame, 7 + (recipe.detailVariant % 3));
  if (frame.isHighContrast)
    outline(ctx, top.x, top.y, top.width, wall.south - top.y, 2, WALNUT, true);
};

/**
 * Paints the acoustic screen's fabric: one stretch of matte felt in a muted accent, lit from
 * above, with a fine woven texture and flecks of lighter and darker yarn.
 *
 * @param ctx - The paint context.
 * @param area - The felt inside the frame.
 * @param felt - The felt colour.
 * @param seed - Seed for the yarn flecks.
 * @param frame - The paint frame; low detail drops the weave.
 */
function paint_felt(
  ctx: PaintContext,
  area: Rect,
  felt: number,
  seed: number,
  frame: PaintFrame,
): void {
  fill_rounded_rect(
    ctx,
    area.x,
    area.y,
    area.width,
    area.height,
    0.8,
    linear_gradient(ctx, area.x, area.y, area.x + area.width * 0.2, area.y + area.height, [
      [0, tint(felt, 0.14)],
      [0.6, felt],
      [1, shade(felt, 0.14)],
    ]),
  );
  if (!frame.isLowDetail) {
    ctx.save();
    rounded_rect_path(ctx, area.x, area.y, area.width, area.height, 0.8);
    ctx.clip();
    for (let weave_y = area.y + 0.8; weave_y < area.y + area.height; weave_y += 1.6) {
      fill_rounded_rect(ctx, area.x, weave_y, area.width, 0.5, 0, css(SHADOW_INK, 0.07));
    }
    for (let weave_x = area.x + 1; weave_x < area.x + area.width; weave_x += 2) {
      fill_rounded_rect(ctx, weave_x, area.y, 0.5, area.height, 0, css(0xffffff, 0.05));
    }
    speckle(
      ctx,
      area.x,
      area.y,
      area.width,
      area.height,
      Math.round((area.width * area.height) / 45),
      [tint(felt, 0.14), shade(felt, 0.16)],
      seed,
      0.5,
    );
    ctx.restore();
  }
  fill_rounded_rect(ctx, area.x, area.y, area.width, 0.8, 0, css(SHADOW_INK, 0.2));
}

/**
 * Paints one slim steel leg of the acoustic screen, from the bottom of its panel to the floor.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the leg.
 * @param top - Texture y of the panel's bottom edge.
 * @param ground - Texture y of the floor.
 */
function paint_screen_leg(ctx: PaintContext, cx: number, top: number, ground: number): void {
  fill_rounded_rect(
    ctx,
    cx - 0.9,
    top - 1,
    1.8,
    ground - top + 0.5,
    0.5,
    linear_gradient(ctx, cx - 0.9, 0, cx + 0.9, 0, [
      [0, tint(ZINC, 0.3)],
      [1, shade(ZINC, 0.45)],
    ]),
  );
}

/**
 * The acoustic screen running east-west: a thin felt screen in a slim zinc frame, raised on
 * two slim legs with splayed feet so floor shows beneath it.
 */
const paint_acoustic_east_west: DividerPainter = (ctx, box, recipe, frame) => {
  const wall = east_west_wall(box, ACOUSTIC_SCREEN.thickness, ACOUSTIC_SCREEN.height, 5);
  const { top, front } = east_west_faces(wall);
  east_west_shadow(ctx, box, wall, 0.16);
  const panel_bottom = wall.ground - ACOUSTIC_SCREEN.legGap;
  const legs = [front.x + 10, front.x + front.width - 10];
  for (const leg of legs) {
    slab(ctx, leg - 1.6, wall.ground - 8, 3.2, 9, 1.4, 1, DARK_STEEL, { gloss: 0.15 });
    paint_screen_leg(ctx, leg, panel_bottom, wall.ground - 3);
  }
  const panel: Rect = {
    x: front.x,
    y: front.y,
    width: front.width,
    height: panel_bottom - front.y,
  };
  fill_lit_face(ctx, panel, ZINC, 0.8, 0.22);
  paint_felt(
    ctx,
    { x: panel.x + 1.3, y: panel.y + 0.8, width: panel.width - 2.6, height: panel.height - 2 },
    mix(recipe.accent, 0x8e8e8e, 0.3),
    recipe.seed,
    frame,
  );
  fill_top_surface(ctx, top, ZINC, 0.6);
  if (frame.isHighContrast)
    outline(ctx, top.x, top.y, top.width, panel_bottom - top.y, 1, DARK_STEEL, true);
};

/**
 * The acoustic screen running north-south: a thin zinc cap strip, the felt side sliver, and the
 * end frame standing on its slim leg with floor showing beneath it.
 */
const paint_acoustic_north_south: DividerPainter = (ctx, box, recipe, frame, rotation) => {
  const wall = north_south_wall(
    box,
    ACOUSTIC_SCREEN.thickness + 1,
    ACOUSTIC_SCREEN.height,
    rotation,
  );
  const { top, front, side } = north_south_faces(wall);
  const gap = ACOUSTIC_SCREEN.legGap;
  north_south_shadow(ctx, box, wall, 0.16);
  for (const foot of [wall.north + 4, wall.south - 2]) {
    slab(ctx, wall.cx - 6, foot - 3, 12, 3, 1.4, 1, DARK_STEEL, { gloss: 0.15 });
  }
  paint_screen_leg(ctx, wall.cx, wall.south - gap, wall.south - 2.5);
  const felt = mix(recipe.accent, 0x8e8e8e, 0.3);
  paint_felt(
    ctx,
    { ...side, height: side.height - gap },
    wall.side === "west" ? felt : shade(felt, 0.2),
    recipe.seed,
    frame,
  );
  fill_lit_face(ctx, { ...front, height: front.height - gap }, ZINC, 0.6);
  fill_rounded_rect(
    ctx,
    front.x + 1,
    front.y + 1,
    front.width - 2,
    front.height - gap - 2,
    0.4,
    css(shade(felt, 0.1)),
  );
  fill_top_surface(ctx, top, ZINC, 0.8);
  if (frame.isHighContrast)
    outline(ctx, top.x, top.y, top.width, wall.south - gap - top.y, 1, DARK_STEEL, true);
};

/** The painters of each divider construction, by orientation. */
const DIVIDER_PAINTERS: Readonly<
  Record<DividerKind, { readonly eastWest: DividerPainter; readonly northSouth: DividerPainter }>
> = {
  "queue-rail": { eastWest: paint_queue_rail_east_west, northSouth: paint_queue_rail_north_south },
  timber: { eastWest: paint_timber_east_west, northSouth: paint_timber_north_south },
  tiled: { eastWest: paint_tiled_east_west, northSouth: paint_tiled_north_south },
  wind: { eastWest: paint_wind_east_west, northSouth: paint_wind_north_south },
  planter: { eastWest: paint_planter_east_west, northSouth: paint_planter_north_south },
  acoustic: { eastWest: paint_acoustic_east_west, northSouth: paint_acoustic_north_south },
};
