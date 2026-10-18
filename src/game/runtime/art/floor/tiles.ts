/**
 * The hall's ground plane: terrazzo panels with chips, mottling and thin grout; the newer mosaic
 * of the expansion bays; the zinc divider strip where new floor meets old; the soft skylight
 * over the hall; and the stainless floor drains in the inner corners.
 *
 * The ground stays flat and low in contrast so the furniture, stalls and people standing on it
 * carry the strong values.
 */
import {
  css,
  fill_circle,
  fill_rounded_rect,
  linear_gradient,
  mix,
  radial_gradient,
  seeded,
  shade,
  speckle,
  stroke_rounded_rect,
  TILE,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import {
  CHIP_ACCENTS,
  CHIP_TONES,
  GROUT,
  is_expansion,
  is_open_floor,
  MOSAIC_ACCENT,
  MOSAIC_GROUT,
  MOSAIC_TONES,
  PLASTER,
  SHADOW,
  STAINLESS,
  tile_left,
  tile_seed,
  tile_top,
  ZINC,
  type FloorGrid,
} from "./layout";

/** Mosaic cells per tile side in the expansion bays. */
const MOSAIC_CELLS = 4;
/** Side of a corner floor drain. */
const DRAIN_SIZE = 18;

/**
 * Picks a tile's base tone: the plaster nudged a little warmer or cooler, lighter or darker.
 *
 * @param base - The floor's base colour.
 * @param next - The tile's seeded sequence.
 * @returns The tile tone.
 */
function tile_tone(base: number, next: () => number): number {
  const value = (next() - 0.5) * 0.06;
  const lit = value > 0 ? tint(base, value) : shade(base, -value * 0.7);
  return next() > 0.5 ? mix(lit, 0xf3dcc0, 0.12) : mix(lit, 0xe4e1d3, 0.12);
}

/**
 * Paints one terrazzo panel: tone, soft mottling, chips in three sizes and a bevelled grout line.
 *
 * @param ctx - The paint context.
 * @param tile_x - Tile column.
 * @param tile_y - Tile row.
 * @param frame - The paint frame.
 */
export function paint_terrazzo_tile(
  ctx: PaintContext,
  tile_x: number,
  tile_y: number,
  frame: PaintFrame,
): void {
  const x = tile_left(tile_x);
  const y = tile_top(tile_y);
  const next = seeded(tile_seed(tile_x, tile_y, 1));
  const base = frame.isHighContrast ? tint(PLASTER, 0.3) : PLASTER;
  const tone = tile_tone(base, next);
  ctx.fillStyle = css(tone);
  ctx.fillRect(x, y, TILE, TILE);
  if (!frame.isLowDetail) {
    const mottle_x = x + 13 + next() * 22;
    const mottle_y = y + 13 + next() * 22;
    const mottle = next() > 0.5 ? shade(tone, 0.05) : tint(tone, 0.12);
    fill_circle(
      ctx,
      mottle_x,
      mottle_y,
      12,
      radial_gradient(ctx, mottle_x, mottle_y, 0, 12, [
        [0, mottle, 0.55],
        [1, mottle, 0],
      ]),
    );
  }
  const small = frame.isLowDetail ? 5 : frame.isHighContrast ? 8 : 12;
  const medium = frame.isLowDetail ? 1 : frame.isHighContrast ? 1 : 3;
  speckle(
    ctx,
    x + 2,
    y + 2,
    TILE - 4,
    TILE - 4,
    small,
    CHIP_TONES,
    tile_seed(tile_x, tile_y, 2),
    1.2,
  );
  speckle(
    ctx,
    x + 4,
    y + 4,
    TILE - 8,
    TILE - 8,
    medium,
    CHIP_TONES,
    tile_seed(tile_x, tile_y, 3),
    2.3,
  );
  if (!frame.isLowDetail && !frame.isHighContrast && next() > 0.35) {
    speckle(
      ctx,
      x + 3,
      y + 3,
      TILE - 6,
      TILE - 6,
      2,
      CHIP_ACCENTS,
      tile_seed(tile_x, tile_y, 4),
      1,
    );
  }
  paint_grout(ctx, x, y, frame.isHighContrast ? shade(GROUT, 0.3) : GROUT, frame);
}

/**
 * Paints a tile's bevelled joint: a lit hairline on the top-left edges (the key light is in the
 * north-west) and the grout line on the bottom-right edges.
 *
 * @param ctx - The paint context.
 * @param x - Tile left.
 * @param y - Tile top.
 * @param grout - The grout colour.
 * @param frame - The paint frame.
 */
function paint_grout(
  ctx: PaintContext,
  x: number,
  y: number,
  grout: number,
  frame: PaintFrame,
): void {
  ctx.fillStyle = css(0xffffff, frame.isHighContrast ? 0.35 : 0.24);
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillRect(x, y + 1, 1, TILE - 1);
  const width = frame.isHighContrast ? 1.5 : 1;
  ctx.fillStyle = css(grout, frame.isHighContrast ? 1 : 0.8);
  ctx.fillRect(x, y + TILE - width, TILE, width);
  ctx.fillRect(x + TILE - width, y, width, TILE - width);
}

/**
 * Paints one expansion-bay tile: a newer, cooler mosaic of small glazed cells in light grout,
 * with the odd sage accent cell and a faint gloss.
 *
 * @param ctx - The paint context.
 * @param tile_x - Tile column.
 * @param tile_y - Tile row.
 * @param frame - The paint frame.
 */
export function paint_mosaic_tile(
  ctx: PaintContext,
  tile_x: number,
  tile_y: number,
  frame: PaintFrame,
): void {
  const x = tile_left(tile_x);
  const y = tile_top(tile_y);
  const next = seeded(tile_seed(tile_x, tile_y, 5));
  ctx.fillStyle = css(frame.isHighContrast ? tint(MOSAIC_GROUT, 0.4) : MOSAIC_GROUT);
  ctx.fillRect(x, y, TILE, TILE);
  const cell = TILE / MOSAIC_CELLS;
  for (let row = 0; row < MOSAIC_CELLS; row += 1) {
    for (let column = 0; column < MOSAIC_CELLS; column += 1) {
      const pick = next();
      const tone =
        pick > 0.94 && !frame.isHighContrast
          ? MOSAIC_ACCENT
          : (MOSAIC_TONES[Math.floor(pick * MOSAIC_TONES.length) % MOSAIC_TONES.length] as number);
      const colour = frame.isHighContrast ? tint(tone, 0.3) : tone;
      const cell_x = x + column * cell + 0.8;
      const cell_y = y + row * cell + 0.8;
      if (frame.isLowDetail) {
        ctx.fillStyle = css(colour);
        ctx.fillRect(cell_x, cell_y, cell - 1.6, cell - 1.6);
      } else {
        fill_rounded_rect(ctx, cell_x, cell_y, cell - 1.6, cell - 1.6, 1.4, css(colour));
        ctx.fillStyle = css(0xffffff, 0.3);
        ctx.fillRect(cell_x + 1, cell_y + 0.6, cell - 3.6, 0.8);
      }
    }
  }
  if (!frame.isLowDetail && !frame.isHighContrast) {
    ctx.fillStyle = linear_gradient(ctx, x, y, x + TILE, y + TILE, [
      [0, 0xffffff, 0.1],
      [0.5, 0xffffff, 0],
      [1, SHADOW, 0.03],
    ]);
    ctx.fillRect(x, y, TILE, TILE);
  }
  paint_grout(
    ctx,
    x,
    y,
    frame.isHighContrast ? shade(GROUT, 0.3) : shade(MOSAIC_GROUT, 0.12),
    frame,
  );
}

/**
 * Paints the zinc divider strips where expansion-bay floor meets the launch terrazzo.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 */
export function paint_expansion_seams(ctx: PaintContext, grid: FloorGrid): void {
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      if (!is_open_floor(grid, x, y)) continue;
      const is_new = is_expansion(grid, x, y);
      if (is_open_floor(grid, x - 1, y) && is_expansion(grid, x - 1, y) !== is_new) {
        ctx.fillStyle = css(shade(ZINC, 0.2));
        ctx.fillRect(tile_left(x) - 1.5, tile_top(y), 3, TILE);
        ctx.fillStyle = css(tint(ZINC, 0.45));
        ctx.fillRect(tile_left(x) - 1.5, tile_top(y), 1, TILE);
      }
      if (is_open_floor(grid, x, y - 1) && is_expansion(grid, x, y - 1) !== is_new) {
        ctx.fillStyle = css(shade(ZINC, 0.2));
        ctx.fillRect(tile_left(x), tile_top(y) - 1.5, TILE, 3);
        ctx.fillStyle = css(tint(ZINC, 0.45));
        ctx.fillRect(tile_left(x), tile_top(y) - 1.5, TILE, 1);
      }
    }
  }
}

/**
 * Finds the bounding box of the open floor, in texture pixels.
 *
 * @param grid - The floor grid.
 * @returns The box, or undefined when the map has no open floor.
 */
function floor_bounds(
  grid: FloorGrid,
): { x: number; y: number; width: number; height: number } | undefined {
  let min_x = Infinity;
  let min_y = Infinity;
  let max_x = -Infinity;
  let max_y = -Infinity;
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      if (!is_open_floor(grid, x, y)) continue;
      min_x = Math.min(min_x, x);
      min_y = Math.min(min_y, y);
      max_x = Math.max(max_x, x);
      max_y = Math.max(max_y, y);
    }
  }
  if (!Number.isFinite(min_x)) return undefined;
  return {
    x: tile_left(min_x),
    y: tile_top(min_y),
    width: (max_x - min_x + 1) * TILE,
    height: (max_y - min_y + 1) * TILE,
  };
}

/**
 * Paints the soft skylight over the hall: a broad warm brightening towards the middle of the
 * hall and a faint falloff into the corners, so the floor reads as a sheltered, daylit room.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 */
export function paint_skylight(ctx: PaintContext, grid: FloorGrid): void {
  const bounds = floor_bounds(grid);
  if (!bounds) return;
  const centre_x = bounds.x + bounds.width / 2;
  const centre_y = bounds.y + bounds.height * 0.42;
  const reach = Math.max(bounds.width, bounds.height) * 0.62;
  ctx.fillStyle = radial_gradient(ctx, centre_x, centre_y, 0, reach, [
    [0, 0xfff6e2, 0.16],
    [0.55, 0xfff6e2, 0.06],
    [1, SHADOW, 0.05],
  ]);
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

/**
 * Paints one recessed stainless floor drain: a frame, a dark well whose north lip catches the
 * light, and a slotted grating.
 *
 * @param ctx - The paint context.
 * @param x - Drain left.
 * @param y - Drain top.
 * @param frame - The paint frame.
 */
function paint_floor_drain(ctx: PaintContext, x: number, y: number, frame: PaintFrame): void {
  fill_rounded_rect(ctx, x + 1, y + 1.5, DRAIN_SIZE, DRAIN_SIZE, 3, css(SHADOW, 0.12));
  fill_rounded_rect(
    ctx,
    x,
    y,
    DRAIN_SIZE,
    DRAIN_SIZE,
    3,
    linear_gradient(ctx, x, y, x + DRAIN_SIZE, y + DRAIN_SIZE, [
      [0, tint(STAINLESS, 0.35)],
      [1, shade(STAINLESS, 0.2)],
    ]),
  );
  fill_rounded_rect(ctx, x + 3, y + 3, DRAIN_SIZE - 6, DRAIN_SIZE - 6, 1.5, css(0x2c3a3c));
  ctx.fillStyle = css(tint(ZINC, 0.2), 0.75);
  ctx.fillRect(x + 3, y + 3, DRAIN_SIZE - 6, 1.5);
  const slots = frame.isLowDetail ? 3 : 5;
  const pitch = (DRAIN_SIZE - 8) / slots;
  for (let slot = 0; slot < slots; slot += 1) {
    ctx.fillStyle = css(shade(STAINLESS, 0.1));
    ctx.fillRect(x + 4, y + 4.5 + slot * pitch + pitch * 0.55, DRAIN_SIZE - 8, 1.2);
  }
  stroke_rounded_rect(
    ctx,
    x,
    y,
    DRAIN_SIZE,
    DRAIN_SIZE,
    3,
    css(frame.isHighContrast ? SHADOW : shade(STAINLESS, 0.55), frame.isHighContrast ? 1 : 0.7),
    frame.isHighContrast ? 1.5 : 1,
  );
}

/**
 * Paints a floor drain in each inner corner of the hall, tucked into the corner of the tile.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param frame - The paint frame.
 */
export function paint_corner_drains(ctx: PaintContext, grid: FloorGrid, frame: PaintFrame): void {
  const corners: ReadonlyArray<readonly [number, number, number, number]> = [
    [1, 1, 5, 7],
    [grid.columns - 2, 1, TILE - DRAIN_SIZE - 5, 7],
    [1, grid.rows - 2, 5, TILE - DRAIN_SIZE - 5],
    [grid.columns - 2, grid.rows - 2, TILE - DRAIN_SIZE - 5, TILE - DRAIN_SIZE - 5],
  ];
  const seen = new Set<string>();
  for (const [tile_x, tile_y, offset_x, offset_y] of corners) {
    const key = `${tile_x},${tile_y}`;
    if (seen.has(key) || !is_open_floor(grid, tile_x, tile_y)) continue;
    seen.add(key);
    paint_floor_drain(ctx, tile_left(tile_x) + offset_x, tile_top(tile_y) + offset_y, frame);
  }
}
