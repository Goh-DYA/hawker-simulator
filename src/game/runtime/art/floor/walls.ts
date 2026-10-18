/**
 * The hall's perimeter walls in the 3/4 view: the tall north wall with its teal steel dado,
 * breeze-block ventilation band, top rail and coping; the pillars that rise from it into the
 * margin; the low east, west and south parapets (coping plus a sliver of inner face, or a short
 * south face); and the soft shadows the walls and pillars cast onto the floor.
 *
 * Light comes from the north-west, so the north wall and the pillars throw their shadows south
 * and east across the floor, the west parapet a narrow band to the east, and the east and south
 * parapets only a little ambient occlusion where they meet the floor.
 */
import {
  css,
  fill_circle,
  fill_polygon,
  fill_rounded_rect,
  linear_gradient,
  shade,
  stroke_ellipse,
  stroke_rounded_rect,
  TILE,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import {
  BREEZE_BLOCK,
  COPING,
  COPING_DEPTH,
  CUT_FACE,
  DAYLIGHT,
  is_open_floor,
  is_solid_wall,
  NORTH_WALL_HEIGHT,
  PILLAR_HEIGHT,
  PILLAR_SPACING,
  PILLAR_WIDTH,
  SHADOW,
  SOUTH_WALL_DROP,
  TEAL,
  tile_left,
  tile_top,
  wall_side,
  WALL_THICKNESS,
  type FloorGrid,
} from "./layout";

/** Height of the north wall's top rail. */
const TOP_RAIL = 5;
/** Height of the breeze-block ventilation band. */
const VENT_BAND = 14;
/** Height of the rail under the ventilation band. */
const MID_RAIL = 3;
/** Height of the dark skirting along the floor line. */
const SKIRTING = 5;
/** Width of one breeze block. */
const BREEZE_BLOCK_WIDTH = 16;
/** Depth of the north wall's shadow on the floor in front of it. */
const NORTH_SHADOW = 22;

/** A rectangle in texture pixels. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Strokes the thin tinted outline of a wall part, or the thick ink one in high contrast.
 *
 * @param ctx - The paint context.
 * @param box - The part's rectangle.
 * @param frame - The paint frame.
 */
function outline_part(ctx: PaintContext, box: Box, frame: PaintFrame): void {
  stroke_rounded_rect(
    ctx,
    box.x + 0.5,
    box.y + 0.5,
    box.width - 1,
    box.height - 1,
    1,
    css(frame.isHighContrast ? SHADOW : shade(TEAL, 0.55), frame.isHighContrast ? 1 : 0.7),
    frame.isHighContrast ? 2 : 1,
  );
}

/**
 * Paints the shadows and ambient occlusion the walls cast onto the floor tiles beside them.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param frame - The paint frame.
 */
export function paint_wall_shadows(ctx: PaintContext, grid: FloorGrid, frame: PaintFrame): void {
  const strength = frame.isHighContrast ? 1.3 : 1;
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      if (!is_open_floor(grid, x, y)) continue;
      const left = tile_left(x);
      const top = tile_top(y);
      if (is_solid_wall(grid, x, y - 1)) {
        const depth = wall_side(grid, x, y - 1) === "north" ? NORTH_SHADOW : 8;
        ctx.fillStyle = linear_gradient(ctx, 0, top, 0, top + depth, [
          [0, SHADOW, 0.3 * strength],
          [0.45, SHADOW, 0.13 * strength],
          [1, SHADOW, 0],
        ]);
        ctx.fillRect(left, top, TILE, depth);
      }
      if (is_solid_wall(grid, x - 1, y)) {
        ctx.fillStyle = linear_gradient(ctx, left, 0, left + 12, 0, [
          [0, SHADOW, 0.18 * strength],
          [1, SHADOW, 0],
        ]);
        ctx.fillRect(left, top, 12, TILE);
      }
      if (is_solid_wall(grid, x + 1, y)) {
        ctx.fillStyle = linear_gradient(ctx, left + TILE - 5, 0, left + TILE, 0, [
          [0, SHADOW, 0],
          [1, SHADOW, 0.09 * strength],
        ]);
        ctx.fillRect(left + TILE - 5, top, 5, TILE);
      }
      if (is_solid_wall(grid, x, y + 1)) {
        ctx.fillStyle = linear_gradient(ctx, 0, top + TILE - 5, 0, top + TILE, [
          [0, SHADOW, 0],
          [1, SHADOW, 0.09 * strength],
        ]);
        ctx.fillRect(left, top + TILE - 5, TILE, 5);
      }
    }
  }
}

/**
 * Paints a coping strip seen from above: lit teal steel with a highlight on its north-west
 * edges and a round top rail along its length.
 *
 * @param ctx - The paint context.
 * @param box - The strip.
 * @param is_vertical - True for a strip running north to south.
 */
function paint_coping(ctx: PaintContext, box: Box, is_vertical: boolean): void {
  const { x, y, width, height } = box;
  ctx.fillStyle = is_vertical
    ? linear_gradient(ctx, x, 0, x + width, 0, [
        [0, tint(COPING, 0.2)],
        [1, shade(COPING, 0.06)],
      ])
    : linear_gradient(ctx, 0, y, 0, y + height, [
        [0, tint(COPING, 0.2)],
        [1, shade(COPING, 0.06)],
      ]);
  ctx.fillRect(x, y, width, height);
  // The round top rail along the middle of the coping, lit on its north-west side.
  if (is_vertical) {
    const rail_x = x + width / 2 - 3;
    ctx.fillStyle = css(shade(COPING, 0.18));
    ctx.fillRect(rail_x, y, 6, height);
    ctx.fillStyle = css(tint(COPING, 0.45));
    ctx.fillRect(rail_x + 1, y, 2, height);
  } else {
    const rail_y = y + height / 2 - 3;
    ctx.fillStyle = css(shade(COPING, 0.18));
    ctx.fillRect(x, rail_y, width, 6);
    ctx.fillStyle = css(tint(COPING, 0.45));
    ctx.fillRect(x, rail_y + 1, width, 2);
  }
  ctx.fillStyle = css(0xffffff, 0.35);
  if (is_vertical) ctx.fillRect(x, y, 1, height);
  else ctx.fillRect(x, y, width, 1);
}

/**
 * Paints a short south-facing wall face (the low south wall, or the cut end of a parapet).
 *
 * @param ctx - The paint context.
 * @param box - The face.
 */
function paint_cut_face(ctx: PaintContext, box: Box): void {
  const { x, y, width, height } = box;
  ctx.fillStyle = linear_gradient(ctx, 0, y, 0, y + height, [
    [0, TEAL],
    [1, shade(TEAL, 0.32)],
  ]);
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = css(0xffffff, 0.28);
  ctx.fillRect(x, y, width, 1);
  ctx.fillStyle = css(shade(TEAL, 0.5));
  ctx.fillRect(x, y + height - 2, width, 2);
}

/**
 * Paints the seam between two parapet panels across a coping strip.
 *
 * @param ctx - The paint context.
 * @param x - Seam position (vertical seam) or strip left (horizontal seam).
 * @param y - Strip top (vertical seam) or seam position (horizontal seam).
 * @param length - Seam length.
 * @param is_vertical - True for a seam running north to south.
 */
function paint_seam(
  ctx: PaintContext,
  x: number,
  y: number,
  length: number,
  is_vertical: boolean,
): void {
  ctx.fillStyle = css(shade(TEAL, 0.5), 0.55);
  if (is_vertical) ctx.fillRect(x - 0.5, y, 1, length);
  else ctx.fillRect(x, y - 0.5, length, 1);
  ctx.fillStyle = css(0xffffff, 0.22);
  if (is_vertical) ctx.fillRect(x + 0.5, y, 1, length);
  else ctx.fillRect(x, y + 0.5, length, 1);
}

/**
 * Paints one tile of the low west or east parapet: its coping, a sliver of the inner face on the
 * hall side, and its south face where the wall ends at a gate.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param tile_x - Tile column.
 * @param tile_y - Tile row.
 * @param frame - The paint frame.
 */
function paint_side_parapet(
  ctx: PaintContext,
  grid: FloorGrid,
  tile_x: number,
  tile_y: number,
  frame: PaintFrame,
): void {
  const is_west = wall_side(grid, tile_x, tile_y) === "west";
  const left = tile_left(tile_x) + (is_west ? TILE - WALL_THICKNESS : 0);
  const top = tile_top(tile_y);
  const has_end = !is_solid_wall(grid, tile_x, tile_y + 1);
  const coping: Box = {
    x: left,
    y: top,
    width: WALL_THICKNESS,
    height: TILE - (has_end ? CUT_FACE : 0),
  };
  paint_coping(ctx, coping, true);
  // The inner face shows as a sliver: shaded on the west wall (it faces east, away from the
  // light), lit on the east wall.
  ctx.fillStyle = css(is_west ? shade(TEAL, 0.38) : TEAL);
  ctx.fillRect(is_west ? left + WALL_THICKNESS - 3 : left, top, 3, coping.height);
  paint_seam(ctx, left, top, WALL_THICKNESS, false);
  if (has_end) {
    paint_cut_face(ctx, {
      x: left,
      y: top + TILE - CUT_FACE,
      width: WALL_THICKNESS,
      height: CUT_FACE,
    });
  }
  if (frame.isHighContrast) {
    outline_part(ctx, { x: left, y: top, width: WALL_THICKNESS, height: TILE }, frame);
  }
}

/**
 * Paints one tile of the low south parapet: coping above a short south face, cut low so it never
 * hides the floor in front of it.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param tile_x - Tile column.
 * @param tile_y - Tile row.
 * @param frame - The paint frame.
 */
function paint_south_parapet(
  ctx: PaintContext,
  grid: FloorGrid,
  tile_x: number,
  tile_y: number,
  frame: PaintFrame,
): void {
  const is_west_corner = tile_x === 0;
  const is_east_corner = tile_x === grid.columns - 1;
  const left = tile_left(tile_x) + (is_west_corner ? TILE - WALL_THICKNESS : 0);
  const width = is_west_corner || is_east_corner ? WALL_THICKNESS : TILE;
  const top = tile_top(tile_y);
  paint_coping(ctx, { x: left, y: top, width, height: WALL_THICKNESS }, false);
  paint_cut_face(ctx, { x: left, y: top + WALL_THICKNESS, width, height: CUT_FACE });
  if (!is_west_corner) paint_seam(ctx, left, top, WALL_THICKNESS + CUT_FACE, true);
  // Contact shadow of the low wall on the apron below it.
  ctx.fillStyle = linear_gradient(ctx, 0, top + SOUTH_WALL_DROP + WALL_THICKNESS, 0, top + 34, [
    [0, SHADOW, 0.22],
    [1, SHADOW, 0],
  ]);
  ctx.fillRect(left + 2, top + SOUTH_WALL_DROP + WALL_THICKNESS, width, 6);
  if (frame.isHighContrast) {
    outline_part(ctx, { x: left, y: top, width, height: WALL_THICKNESS + CUT_FACE }, frame);
  }
}

/**
 * Paints a wall tile inside the hall as a plain block: coping on top and a short south face
 * where nothing solid stands in front of it.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param tile_x - Tile column.
 * @param tile_y - Tile row.
 * @param frame - The paint frame.
 */
function paint_inner_wall(
  ctx: PaintContext,
  grid: FloorGrid,
  tile_x: number,
  tile_y: number,
  frame: PaintFrame,
): void {
  const left = tile_left(tile_x);
  const top = tile_top(tile_y);
  const has_face = !is_solid_wall(grid, tile_x, tile_y + 1);
  paint_coping(
    ctx,
    { x: left, y: top, width: TILE, height: TILE - (has_face ? CUT_FACE : 0) },
    false,
  );
  if (has_face)
    paint_cut_face(ctx, { x: left, y: top + TILE - CUT_FACE, width: TILE, height: CUT_FACE });
  outline_part(ctx, { x: left, y: top, width: TILE, height: TILE }, frame);
}

/**
 * Paints the breeze-block ventilation band of one north-wall segment: a lattice of concrete
 * vent blocks, each a ring inside a square, with the daylight outside showing through the
 * openings.
 *
 * @param ctx - The paint context.
 * @param box - The band.
 * @param frame - The paint frame.
 */
function paint_breeze_blocks(ctx: PaintContext, box: Box, frame: PaintFrame): void {
  const { x, y, width, height } = box;
  const lattice = shade(BREEZE_BLOCK, 0.16);
  ctx.fillStyle = css(frame.isHighContrast ? lattice : DAYLIGHT);
  ctx.fillRect(x, y, width, height);
  if (frame.isHighContrast) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  const first = Math.floor(x / BREEZE_BLOCK_WIDTH) * BREEZE_BLOCK_WIDTH;
  const radius = height / 2 - 1.6;
  for (let block_x = first; block_x < x + width; block_x += BREEZE_BLOCK_WIDTH) {
    const centre_x = block_x + BREEZE_BLOCK_WIDTH / 2;
    const centre_y = y + height / 2;
    if (frame.isLowDetail) {
      ctx.fillStyle = css(lattice);
      ctx.fillRect(block_x, y, 1.5, height);
      continue;
    }
    // The lattice: the block's frame and its ring, lit along their top edges.
    stroke_rounded_rect(
      ctx,
      block_x + 0.9,
      y + 0.9,
      BREEZE_BLOCK_WIDTH - 1.8,
      height - 1.8,
      1,
      css(lattice),
      1.8,
    );
    stroke_ellipse(ctx, centre_x, centre_y, radius, radius, css(lattice), 1.9);
    ctx.fillStyle = css(BREEZE_BLOCK, 0.9);
    ctx.fillRect(block_x + 0.5, y + 0.2, BREEZE_BLOCK_WIDTH - 1, 0.9);
    fill_circle(ctx, centre_x, centre_y, 1.4, css(lattice));
  }
  ctx.restore();
}

/**
 * Paints the teal steel dado of one north-wall segment: a panel lit from above with brushed
 * bands and bevelled vertical seams every half tile.
 *
 * @param ctx - The paint context.
 * @param box - The panel.
 * @param frame - The paint frame.
 */
function paint_dado(ctx: PaintContext, box: Box, frame: PaintFrame): void {
  const { x, y, width, height } = box;
  ctx.fillStyle = linear_gradient(ctx, 0, y, 0, y + height, [
    [0, tint(TEAL, 0.12)],
    [0.5, TEAL],
    [1, shade(TEAL, 0.22)],
  ]);
  ctx.fillRect(x, y, width, height);
  if (!frame.isLowDetail) {
    for (let band = 0; band < height; band += 3) {
      ctx.fillStyle = css(band % 6 === 0 ? 0xffffff : SHADOW, 0.05);
      ctx.fillRect(x, y + band + 1, width, 1);
    }
  }
  const half = TILE / 2;
  const first = Math.ceil(x / half) * half;
  for (let seam_x = first; seam_x < x + width; seam_x += half) {
    paint_seam(ctx, seam_x, y, height, true);
  }
}

/**
 * Paints one segment of the tall north wall: coping, top rail, breeze-block band, mid rail,
 * steel dado and skirting, from the coping down to the floor line.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param tile_x - Tile column.
 * @param frame - The paint frame.
 */
function paint_north_wall(
  ctx: PaintContext,
  grid: FloorGrid,
  tile_x: number,
  frame: PaintFrame,
): void {
  const tile_x_left = tile_left(tile_x);
  const left = tile_x === 0 ? tile_x_left + TILE - WALL_THICKNESS : tile_x_left;
  const right = tile_x === grid.columns - 1 ? tile_x_left + WALL_THICKNESS : tile_x_left + TILE;
  const width = right - left;
  const floor_line = tile_top(0) + TILE;
  const face_top = floor_line - NORTH_WALL_HEIGHT;
  paint_coping(ctx, { x: left, y: face_top - COPING_DEPTH, width, height: COPING_DEPTH }, false);
  // Top rail: a round tube along the top of the face.
  ctx.fillStyle = linear_gradient(ctx, 0, face_top, 0, face_top + TOP_RAIL, [
    [0, tint(TEAL, 0.4)],
    [0.45, TEAL],
    [1, shade(TEAL, 0.4)],
  ]);
  ctx.fillRect(left, face_top, width, TOP_RAIL);
  const vent_top = face_top + TOP_RAIL;
  paint_breeze_blocks(ctx, { x: left, y: vent_top, width, height: VENT_BAND }, frame);
  // The vent band sits in the shade of the top rail.
  ctx.fillStyle = linear_gradient(ctx, 0, vent_top, 0, vent_top + 5, [
    [0, SHADOW, 0.28],
    [1, SHADOW, 0],
  ]);
  ctx.fillRect(left, vent_top, width, 5);
  const rail_top = vent_top + VENT_BAND;
  ctx.fillStyle = css(tint(TEAL, 0.22));
  ctx.fillRect(left, rail_top, width, MID_RAIL);
  ctx.fillStyle = css(0xffffff, 0.3);
  ctx.fillRect(left, rail_top, width, 1);
  const dado_top = rail_top + MID_RAIL;
  paint_dado(ctx, { x: left, y: dado_top, width, height: floor_line - SKIRTING - dado_top }, frame);
  ctx.fillStyle = css(shade(TEAL, 0.5));
  ctx.fillRect(left, floor_line - SKIRTING, width, SKIRTING);
  ctx.fillStyle = css(0xffffff, 0.18);
  ctx.fillRect(left, floor_line - SKIRTING, width, 1);
  if (frame.isHighContrast) {
    outline_part(
      ctx,
      { x: left, y: face_top - COPING_DEPTH, width, height: NORTH_WALL_HEIGHT + COPING_DEPTH },
      frame,
    );
  }
}

/**
 * Lists the centres of the pillars along the north wall: one at each corner and one on every
 * fourth tile boundary between them, wherever the wall is solid on both sides.
 *
 * @param grid - The floor grid.
 * @returns The pillar centre x positions, west to east.
 */
export function pillar_positions(grid: FloorGrid): number[] {
  const positions: number[] = [];
  if (is_solid_wall(grid, 0, 0)) positions.push(tile_left(0) + TILE - WALL_THICKNESS / 2);
  for (let boundary = 2; boundary <= grid.columns - 3; boundary += 1) {
    if (boundary % PILLAR_SPACING !== 0) continue;
    if (!is_solid_wall(grid, boundary - 1, 0) || !is_solid_wall(grid, boundary, 0)) continue;
    positions.push(tile_left(boundary));
  }
  if (is_solid_wall(grid, grid.columns - 1, 0)) {
    positions.push(tile_left(grid.columns - 1) + WALL_THICKNESS / 2);
  }
  return positions;
}

/**
 * Paints the soft shadow a pillar casts down and to the east across the floor, and the narrow
 * one it throws along the wall face beside it.
 *
 * @param ctx - The paint context.
 * @param centre_x - The pillar's centre.
 * @param frame - The paint frame.
 */
export function paint_pillar_shadow(ctx: PaintContext, centre_x: number, frame: PaintFrame): void {
  const floor_line = tile_top(0) + TILE;
  const half = PILLAR_WIDTH / 2;
  const reach = 34;
  ctx.save();
  if (!frame.isLowDetail) {
    ctx.shadowBlur = 6;
    ctx.shadowColor = css(SHADOW, 0.12);
  }
  fill_polygon(
    ctx,
    [
      [centre_x - half + 2, floor_line],
      [centre_x + half + 2, floor_line],
      [centre_x + half + 2 + reach * 0.6, floor_line + reach],
      [centre_x - half + 2 + reach * 0.6, floor_line + reach],
    ],
    linear_gradient(ctx, 0, floor_line, 0, floor_line + reach, [
      [0, SHADOW, 0.2],
      [1, SHADOW, 0],
    ]),
  );
  ctx.restore();
  ctx.fillStyle = linear_gradient(ctx, centre_x + half, 0, centre_x + half + 9, 0, [
    [0, SHADOW, 0.24],
    [1, SHADOW, 0],
  ]);
  ctx.fillRect(centre_x + half, floor_line - NORTH_WALL_HEIGHT, 9, NORTH_WALL_HEIGHT);
}

/**
 * Paints one pillar: a plinth, a teal steel shaft lit on its west side with a shaded east sliver,
 * and a capital that rises into the margin above the wall.
 *
 * @param ctx - The paint context.
 * @param centre_x - The pillar's centre.
 * @param frame - The paint frame.
 */
export function paint_pillar(ctx: PaintContext, centre_x: number, frame: PaintFrame): void {
  const floor_line = tile_top(0) + TILE;
  const half = PILLAR_WIDTH / 2;
  const top = floor_line - PILLAR_HEIGHT;
  const shaft_top = top + 10;
  const plinth = 8;
  const shaft: Box = {
    x: centre_x - half,
    y: shaft_top,
    width: PILLAR_WIDTH,
    height: floor_line - plinth - shaft_top,
  };
  ctx.fillStyle = linear_gradient(ctx, shaft.x, 0, shaft.x + shaft.width, 0, [
    [0, tint(TEAL, 0.24)],
    [0.4, TEAL],
    [0.82, shade(TEAL, 0.2)],
    [0.84, shade(TEAL, 0.42)],
    [1, shade(TEAL, 0.48)],
  ]);
  ctx.fillRect(shaft.x, shaft.y, shaft.width, shaft.height);
  ctx.fillStyle = css(0xffffff, 0.26);
  ctx.fillRect(shaft.x + 2, shaft.y, 1.5, shaft.height);
  // Ambient occlusion where the shaft meets its plinth.
  ctx.fillStyle = linear_gradient(ctx, 0, floor_line - plinth - 12, 0, floor_line - plinth, [
    [0, SHADOW, 0],
    [1, SHADOW, 0.22],
  ]);
  ctx.fillRect(shaft.x, floor_line - plinth - 12, shaft.width, 12);
  // Plinth.
  fill_rounded_rect(
    ctx,
    centre_x - half - 2,
    floor_line - plinth,
    PILLAR_WIDTH + 4,
    plinth,
    1,
    linear_gradient(ctx, 0, floor_line - plinth, 0, floor_line, [
      [0, shade(TEAL, 0.25)],
      [1, shade(TEAL, 0.5)],
    ]),
  );
  ctx.fillStyle = css(0xffffff, 0.3);
  ctx.fillRect(centre_x - half - 2, floor_line - plinth, PILLAR_WIDTH + 4, 1);
  // Capital: its lit top surface and a short front face.
  fill_rounded_rect(
    ctx,
    centre_x - half - 3,
    top,
    PILLAR_WIDTH + 6,
    6,
    1.5,
    css(tint(COPING, 0.25)),
  );
  ctx.fillStyle = linear_gradient(ctx, 0, top + 6, 0, top + 10, [
    [0, tint(TEAL, 0.15)],
    [1, shade(TEAL, 0.3)],
  ]);
  ctx.fillRect(centre_x - half - 3, top + 6, PILLAR_WIDTH + 6, 4);
  ctx.fillStyle = css(0xffffff, 0.4);
  ctx.fillRect(centre_x - half - 2, top + 0.5, PILLAR_WIDTH + 4, 1);
  const edge = css(
    frame.isHighContrast ? SHADOW : shade(TEAL, 0.6),
    frame.isHighContrast ? 1 : 0.55,
  );
  const edge_width = frame.isHighContrast ? 2 : 1;
  stroke_rounded_rect(
    ctx,
    shaft.x + 0.5,
    shaft.y,
    shaft.width - 1,
    shaft.height,
    0,
    edge,
    edge_width,
  );
  stroke_rounded_rect(
    ctx,
    centre_x - half - 2.5,
    top + 0.5,
    PILLAR_WIDTH + 5,
    9.5,
    1.5,
    edge,
    edge_width,
  );
}

/**
 * Paints every solid wall tile, side by side: the low parapets and inner walls first, then the
 * tall north wall over them.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param frame - The paint frame.
 */
export function paint_walls(ctx: PaintContext, grid: FloorGrid, frame: PaintFrame): void {
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      if (!is_solid_wall(grid, x, y)) continue;
      const side = wall_side(grid, x, y);
      if (side === "west" || side === "east") paint_side_parapet(ctx, grid, x, y, frame);
      else if (side === "south") paint_south_parapet(ctx, grid, x, y, frame);
      else if (side === "inner") paint_inner_wall(ctx, grid, x, y, frame);
    }
  }
  for (let x = 0; x < grid.columns; x += 1) {
    if (is_solid_wall(grid, x, 0)) paint_north_wall(ctx, grid, x, frame);
  }
}
