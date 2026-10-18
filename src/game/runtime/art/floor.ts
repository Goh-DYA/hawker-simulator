/**
 * The hall floor painter: one texture per map state holding the whole static hall in the 3/4
 * oblique view, painted back to front. Outside: the concrete apron, drain channel, kerbs and
 * planter beds. Inside: terrazzo panels (a newer mosaic in the expansion bays) under a soft
 * skylight, the painted route-guide lanes and the corner floor drains. Then the shadows the
 * walls and pillars cast on the floor, the walls themselves (the tall north wall with its
 * pillars rising into the margin, the low side and south parapets) and the gates with their
 * mats, posts and signs.
 *
 * The floor is painted once per map state, so it carries every static detail and the renderer
 * never redraws tiles per tick. The pieces live in `floor/`.
 */
import { TILE, type PaintContext } from "./canvas";
import { paint_gates } from "./floor/gates";
import { paint_route_lanes } from "./floor/lanes";
import { build_floor_grid, is_expansion, is_open_floor, type FloorGrid } from "./floor/layout";
import { paint_apron, paint_drain_channel, paint_planters } from "./floor/surround";
import {
  paint_corner_drains,
  paint_expansion_seams,
  paint_mosaic_tile,
  paint_skylight,
  paint_terrazzo_tile,
} from "./floor/tiles";
import {
  paint_pillar,
  paint_pillar_shadow,
  paint_wall_shadows,
  paint_walls,
  pillar_positions,
} from "./floor/walls";
import { FLOOR_MARGIN, type FloorPaintSpec, type PaintPlan } from "./specs";

/**
 * Paints the hall's ground plane: every open floor tile, the expansion seams, the skylight, the
 * route-guide lanes and the corner drains.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 */
function paint_ground(ctx: PaintContext, grid: FloorGrid): void {
  const { frame } = grid.spec;
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      if (!is_open_floor(grid, x, y)) continue;
      if (is_expansion(grid, x, y)) paint_mosaic_tile(ctx, x, y, frame);
      else paint_terrazzo_tile(ctx, x, y, frame);
    }
  }
  paint_expansion_seams(ctx, grid);
  if (!frame.isHighContrast) paint_skylight(ctx, grid);
  paint_route_lanes(ctx, grid, frame);
  paint_corner_drains(ctx, grid, frame);
}

/**
 * Plans the floor texture for a map state.
 *
 * @param spec - The floor spec.
 * @returns The plan; the map's tile (0, 0) sits at `(FLOOR_MARGIN, FLOOR_MARGIN)`.
 */
export function plan_floor(spec: FloorPaintSpec): PaintPlan {
  const width = spec.map.width * TILE + FLOOR_MARGIN * 2;
  const height = spec.map.height * TILE + FLOOR_MARGIN * 2;
  return {
    width,
    height,
    paint: (ctx) => {
      const grid = build_floor_grid(spec);
      const { frame } = spec;
      const seed =
        (Math.imul(spec.map.width, 73856093) ^ Math.imul(spec.map.height, 19349663)) >>> 0;
      paint_apron(ctx, width, height, frame, seed);
      paint_drain_channel(ctx, grid, frame);
      paint_planters(ctx, width, height, frame, seed);
      paint_ground(ctx, grid);
      paint_wall_shadows(ctx, grid, frame);
      const pillars = pillar_positions(grid);
      for (const centre_x of pillars) paint_pillar_shadow(ctx, centre_x, frame);
      paint_walls(ctx, grid, frame);
      for (const centre_x of pillars) paint_pillar(ctx, centre_x, frame);
      paint_gates(ctx, grid, frame);
    },
  };
}
