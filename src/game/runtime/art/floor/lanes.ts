/**
 * The painted route-guide lanes: a continuous band of teal floor paint through the guided tiles,
 * with a darker painted edge, chevrons pointing along the lane towards the exit, a junction
 * diamond where lanes cross, and a little scuffing where feet have worn the paint.
 *
 * Route guides are a set of tiles, not an ordered path, so each tile reads its neighbours to
 * decide which way the lane runs.
 */
import {
  css,
  fill_polygon,
  fill_rounded_rect,
  line,
  mix,
  shade,
  speckle,
  TILE,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import {
  CHIP_TONES,
  LANE,
  PLASTER,
  tile_left,
  tile_seed,
  tile_top,
  type FloorGrid,
} from "./layout";

/** Width of the painted lane band. */
const LANE_WIDTH = 24;
/** Width of the darker painted edge around the band. */
const LANE_EDGE = 2;

/** Which neighbouring tiles are also route guides. */
interface LaneLinks {
  readonly north: boolean;
  readonly east: boolean;
  readonly south: boolean;
  readonly west: boolean;
}

/** A rectangle in texture pixels. */
type Box = readonly [x: number, y: number, width: number, height: number];

/**
 * Lists the rectangles a lane tile's paint covers: the centre square first, then an arm out to
 * each linked neighbour, grown by `grow` across the lane (never along it, so arms meet flush).
 * Only the centre square is rounded, so the arms of neighbouring tiles join without a notch.
 *
 * @param x - Tile left.
 * @param y - Tile top.
 * @param links - The linked neighbours.
 * @param grow - How far to grow each piece across the lane.
 * @returns The rectangles.
 */
function lane_boxes(x: number, y: number, links: LaneLinks, grow: number): Box[] {
  const near = (TILE - LANE_WIDTH) / 2 - grow;
  const span = LANE_WIDTH + grow * 2;
  const boxes: Box[] = [[x + near, y + near, span, span]];
  if (links.north) boxes.push([x + near, y, span, TILE / 2]);
  if (links.south) boxes.push([x + near, y + TILE / 2, span, TILE / 2]);
  if (links.west) boxes.push([x, y + near, TILE / 2, span]);
  if (links.east) boxes.push([x + TILE / 2, y + near, TILE / 2, span]);
  return boxes;
}

/**
 * Paints the chevrons on a straight lane tile, pointing along the lane.
 *
 * @param ctx - The paint context.
 * @param x - Tile left.
 * @param y - Tile top.
 * @param direction_x - Horizontal flow, -1, 0 or 1.
 * @param direction_y - Vertical flow, -1, 0 or 1.
 * @param colour - The chevron paint.
 * @param width - The stroke width.
 */
function paint_chevrons(
  ctx: PaintContext,
  x: number,
  y: number,
  direction_x: number,
  direction_y: number,
  colour: string,
  width: number,
): void {
  const centre_x = x + TILE / 2;
  const centre_y = y + TILE / 2;
  ctx.save();
  ctx.lineJoin = "round";
  for (const offset of [-8, 6]) {
    const tip_x = centre_x + direction_x * (offset + 4);
    const tip_y = centre_y + direction_y * (offset + 4);
    const back_x = centre_x + direction_x * (offset - 3);
    const back_y = centre_y + direction_y * (offset - 3);
    ctx.beginPath();
    ctx.moveTo(back_x - direction_y * 7, back_y - direction_x * 7);
    ctx.lineTo(tip_x, tip_y);
    ctx.lineTo(back_x + direction_y * 7, back_y + direction_x * 7);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Paints every route-guide lane tile.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param frame - The paint frame.
 */
export function paint_route_lanes(ctx: PaintContext, grid: FloorGrid, frame: PaintFrame): void {
  const points = grid.spec.routeGuidePoints;
  if (points.length === 0) return;
  const keys = new Set(points.map((point) => `${point.x},${point.y}`));
  const has = (x: number, y: number) => keys.has(`${x},${y}`);
  const exit = grid.spec.accessPoints.find((point) => point.kind === "exit")?.position;
  const edge = frame.isHighContrast ? shade(LANE, 0.35) : mix(PLASTER, LANE, 0.62);
  const wash = frame.isHighContrast ? mix(0xffffff, LANE, 0.3) : mix(PLASTER, LANE, 0.2);
  const mark = css(frame.isHighContrast ? shade(LANE, 0.5) : shade(LANE, 0.12), 0.9);
  const tiles = points.map((point) => ({
    point,
    links: {
      north: has(point.x, point.y - 1),
      east: has(point.x + 1, point.y),
      south: has(point.x, point.y + 1),
      west: has(point.x - 1, point.y),
    },
  }));
  // The edge colour first under every tile, then the wash, so neighbouring pieces join cleanly.
  for (const { point, links } of tiles) {
    lane_boxes(tile_left(point.x), tile_top(point.y), links, LANE_EDGE).forEach(
      ([x, y, w, h], index) => fill_rounded_rect(ctx, x, y, w, h, index === 0 ? 5 : 0, css(edge)),
    );
  }
  for (const { point, links } of tiles) {
    lane_boxes(tile_left(point.x), tile_top(point.y), links, 0).forEach(([x, y, w, h], index) =>
      fill_rounded_rect(ctx, x, y, w, h, index === 0 ? 3 : 0, css(wash)),
    );
  }
  for (const { point, links } of tiles) {
    const x = tile_left(point.x);
    const y = tile_top(point.y);
    const is_horizontal = links.east || links.west;
    const is_vertical = links.north || links.south;
    if (is_horizontal && is_vertical) {
      const centre_x = x + TILE / 2;
      const centre_y = y + TILE / 2;
      fill_polygon(
        ctx,
        [
          [centre_x, centre_y - 7],
          [centre_x + 7, centre_y],
          [centre_x, centre_y + 7],
          [centre_x - 7, centre_y],
        ],
        mark,
      );
    } else if (is_horizontal || is_vertical) {
      const toward = is_horizontal
        ? Math.sign((exit?.x ?? point.x + 1) - point.x) || 1
        : Math.sign((exit?.y ?? point.y + 1) - point.y) || 1;
      paint_chevrons(
        ctx,
        x,
        y,
        is_horizontal ? toward : 0,
        is_horizontal ? 0 : toward,
        mark,
        frame.isHighContrast ? 3.4 : 2.8,
      );
    } else {
      line(ctx, x + 17, y + 24, x + 31, y + 24, mark, 3);
      line(ctx, x + 24, y + 17, x + 24, y + 31, mark, 3);
    }
    if (!frame.isLowDetail && !frame.isHighContrast) {
      speckle(
        ctx,
        x + (TILE - LANE_WIDTH) / 2,
        y + (TILE - LANE_WIDTH) / 2,
        LANE_WIDTH,
        LANE_WIDTH,
        6,
        CHIP_TONES,
        tile_seed(point.x, point.y, 9),
        1.1,
      );
    }
  }
}
