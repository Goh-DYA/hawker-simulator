/**
 * Composes a stall texture from its parts, layer by layer.
 *
 * The back layer holds everything behind the vendor, painted back to front: the interior floor,
 * the wall face with its tube light, hanging wares, menu board, shelf and extractor hood, the
 * counter seen from behind with the hanging wares over its far end (rotation 180), the work bench
 * with its station and its wall-mounted hood (0, 90 and 270), the tall cabinet or floor clutter,
 * the posts, and last the roof band and signboard. The front layer holds what hides the vendor's
 * legs: the counter, its return and the walls cut down to counter height, or at 180 the work bench
 * right behind the vendor with its station and canopy hood, the floor props and the back shelf;
 * and a closed stall's roller shutter.
 */
import { slab_top, type Box, type StallScene } from "./common";
import {
  paint_back_wall,
  paint_bench,
  paint_counter_from_behind,
  paint_front_counter,
  paint_shutter,
} from "./counter";
import {
  paint_clutter,
  paint_hanging_wares,
  paint_hood,
  paint_low_extra,
  paint_menu_board,
  paint_shelf_goods,
  paint_shelf_plank,
  paint_side_hood,
  paint_tall_extra,
  paint_tube_light,
} from "./props";
import { paint_header } from "./roof";
import { paint_side_piece, paint_station } from "./stations";
import {
  paint_floor_fittings,
  paint_interior_floor,
  paint_posts,
  paint_wall_finish,
} from "./walls";

/** Smallest wall face, in pixels, that has room for a shelf under the menu board. */
const SHELF_MIN_WALL_HEIGHT = 30;

/**
 * Gives the span of the wall face that no counter, bench or cabinet stands in front of.
 *
 * @param scene - The stall scene.
 * @param wall - The wall face.
 * @returns The clear span's ends.
 */
function clear_span(scene: StallScene, wall: Box): { from: number; to: number } {
  const { geo } = scene;
  const bench = geo.bench;
  const tall = geo.tallExtra;
  switch (geo.side) {
    case "west":
      return { from: geo.counter.x + geo.counter.width, to: bench.x };
    case "east":
      return { from: bench.x + bench.width, to: geo.counter.x };
    default:
      if (!tall) return { from: wall.x, to: wall.x + wall.width };
      return geo.isMirrored
        ? { from: tall.x + tall.width, to: wall.x + wall.width }
        : { from: wall.x, to: tall.x };
  }
}

/**
 * Dresses the wall face: a fluorescent tube, the rail of hanging wares, the lit menu board, a
 * shelf of goods where the wall is tall enough, and the extractor hood over the station on the
 * back wall. The board and shelf sit at the end away from the station (the left on mirrored
 * stalls), the wares between them and the hood.
 *
 * @param scene - The stall scene.
 * @param wall - The wall face.
 */
function paint_wall_dressing(scene: StallScene, wall: Box): void {
  const { geo } = scene;
  const clear = clear_span(scene, wall);
  const from = clear.from + 4;
  const to = clear.to - 4;
  const span = to - from;
  if (span < 20) return;
  const hood = geo.hoodMount === "back-wall" ? geo.hood : undefined;
  const isBoardLeft = geo.side === "south" && geo.isMirrored;
  const boardWidth = Math.min(50, span * 0.34);
  const board: Box = {
    width: boardWidth,
    height: Math.min(16, Math.max(8, wall.height * 0.42)),
    x: isBoardLeft ? from : to - boardWidth,
    y: wall.y + 3,
  };
  const tubeFrom = isBoardLeft ? to - span * 0.32 - Math.min(32, span * 0.26) : from + span * 0.32;
  paint_tube_light(scene, tubeFrom, tubeFrom + Math.min(32, span * 0.26), wall.y + 2.5);
  const hangFrom = isBoardLeft
    ? Math.max(board.x + board.width + 6, to - span * 0.58)
    : hood
      ? hood.x + hood.width + 5
      : from + 2;
  const hangTo = isBoardLeft
    ? hood
      ? hood.x - 5
      : to - 2
    : Math.min(from + span * 0.58, board.x - 6);
  if (hangTo - hangFrom >= 12) paint_hanging_wares(scene, hangFrom, hangTo, wall.y + 6);
  paint_menu_board(scene, board);
  if (wall.height >= SHELF_MIN_WALL_HEIGHT) {
    const plankY = board.y + board.height + 15;
    const shelfFrom = isBoardLeft ? from : Math.max(hangTo + 4, board.x - 14);
    const shelfTo = isBoardLeft ? Math.min(hangFrom - 4, board.x + board.width + 14) : to;
    paint_shelf_plank(scene, shelfFrom, shelfTo, plankY);
    paint_shelf_goods(scene, shelfFrom + 2, shelfTo - 2, plankY - 1.5);
  }
  if (hood) paint_hood(scene, hood);
}

/**
 * Paints the bench and the pieces standing on it, and the hood over the station when it hangs
 * from the ceiling or a side wall.
 *
 * @param scene - The stall scene.
 */
function paint_work_bench(scene: StallScene): void {
  const { geo } = scene;
  paint_bench(scene);
  if (geo.wallBench && geo.island) {
    // With a prep island, the bench along the north wall holds the shelf goods.
    const top = slab_top(geo.wallBench);
    paint_shelf_goods(scene, top.x + 4, top.x + top.width - 4, top.y + top.height * 0.75);
  }
  paint_station(scene, geo.stations[0]);
  paint_side_piece(scene, geo.stations[1]);
  if (geo.hood && geo.hoodMount === "side-wall") paint_side_hood(scene, geo.hood);
  if (geo.hood && geo.hoodMount === "ceiling") paint_hood(scene, geo.hood);
}

/**
 * Paints the props standing on the interior floor: the gas cylinder, sacks or ice box and the
 * crates, stool or bucket.
 *
 * @param scene - The stall scene.
 */
function paint_floor_props(scene: StallScene): void {
  paint_low_extra(scene);
  paint_clutter(scene);
}

/**
 * Paints the back layer: everything behind the vendor.
 *
 * @param scene - The stall scene.
 */
export function paint_back_layer(scene: StallScene): void {
  const { geo } = scene;
  paint_interior_floor(scene);
  paint_floor_fittings(scene);
  if (geo.wall) {
    paint_wall_finish(scene, geo.wall);
    paint_wall_dressing(scene, geo.wall);
  }
  if (geo.side === "north") {
    paint_counter_from_behind(scene);
    if (geo.wares) paint_hanging_wares(scene, geo.wares.from, geo.wares.to, geo.wares.railY);
  }
  if (geo.tallExtra) paint_tall_extra(scene, geo.tallExtra);
  if (!geo.isBenchInFront) paint_work_bench(scene);
  if (!geo.isFloorPropsInFront) paint_floor_props(scene);
  paint_posts(scene);
  paint_header(scene);
}

/**
 * Paints the front layer: the counter, return and cut-down walls that hide the vendor's legs (or
 * at 180 the bench behind the vendor, the floor props and the back shelf), and the shutter when
 * the stall is closed. At 180 the shutter comes down last, over the whole opening.
 *
 * @param scene - The stall scene.
 */
export function paint_front_layer(scene: StallScene): void {
  const { geo, spec } = scene;
  if (geo.isBenchInFront) {
    paint_work_bench(scene);
    if (geo.isFloorPropsInFront) paint_floor_props(scene);
    paint_back_wall(scene);
    if (!spec.isOpen) paint_shutter(scene);
    return;
  }
  if (!spec.isOpen) paint_shutter(scene);
  paint_front_counter(scene);
}
