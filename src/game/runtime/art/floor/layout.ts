/**
 * The hall floor's shared geometry, palette and tile lookups: where a map tile sits in the floor
 * texture, which tiles are solid wall or gate openings, which side of the perimeter a wall tile
 * belongs to, and the wall, pillar, drain and planter dimensions every floor painter agrees on.
 *
 * The floor is a 3/4 oblique view: the north wall shows its tall inner face rising into the
 * margin above the map, the east and west walls show their coping plus a sliver of inner face,
 * and the south wall is cut low so it never hides the floor in front of it.
 */
import { TILE } from "../canvas";
import { FLOOR_MARGIN, type FloorPaintSpec } from "../specs";

/** Base terrazzo tone of the launch floor (the Art Bible plaster, a touch deeper). */
export const PLASTER = 0xefe2cb;
/** Terrazzo chip tones, all close to the base so the floor stays low contrast. */
export const CHIP_TONES = [0xd9c7a8, 0xe9decb, 0xcdb898, 0xf8f1e4, 0xc4b08f] as const;
/** Sparse darker chips: grey-green and rust aggregate. */
export const CHIP_ACCENTS = [0xa3aa98, 0xc39272, 0x8f9a8c] as const;
/** Grout and divider strips between terrazzo panels. */
export const GROUT = 0xcdbb9c;
/** The newer expansion-bay mosaic tones. */
export const MOSAIC_TONES = [0xe4e6da, 0xdbe0d2, 0xeaebe1, 0xdfe4d8] as const;
/** The occasional pale sage accent tile in the mosaic. */
export const MOSAIC_ACCENT = 0xc9d8cf;
/** The light grout of the newer mosaic. */
export const MOSAIC_GROUT = 0xf3f1e8;
/** Teal structural steel. */
export const TEAL = 0x167d7f;
/** The lighter teal of horizontal steel surfaces that catch the skylight. */
export const COPING = 0x5aa3a2;
/** Zinc for divider strips and gratings. */
export const ZINC = 0x9aa8a6;
/** Brushed stainless steel. */
export const STAINLESS = 0xc9d3d0;
/** Breeze-block concrete in the north wall's ventilation band. */
export const BREEZE_BLOCK = 0xe3d8c3;
/** Daylight seen through the breeze-block openings. */
export const DAYLIGHT = 0xeeeee0;
/** The concrete apron outside the hall. */
export const CONCRETE = 0xc3bdaf;
/** Planter soil. */
export const SOIL = 0x5a4634;
/** Foliage tones, darkest first. */
export const LEAF = [0x2f5a35, 0x3d6b3f, 0x4f7d4a, 0x6a9a5b, 0x8fb86e] as const;
/** Bloom colours: bougainvillea magenta and pink, ixora red-orange, frangipani cream. */
export const BLOOMS = [0xc8377e, 0xe66fa4, 0xe2552e, 0xf6efd9] as const;
/** Route-guide lane paint. */
export const LANE = 0x1f9f91;
/** The deep shadow every cast shadow is mixed from. */
export const SHADOW = 0x18323b;
/** Ink for baked text and pictograms. */
export const INK = 0x263238;

/** Plan thickness of the perimeter parapets, in world pixels. */
export const WALL_THICKNESS = 16;
/** Height of the north wall's visible inner face, in world pixels. */
export const NORTH_WALL_HEIGHT = 44;
/** Foreshortened depth of the north wall's coping (its top surface). */
export const COPING_DEPTH = 8;
/** Height of the visible face of a cut-down wall (the south wall and wall ends). */
export const CUT_FACE = 12;
/** How far the south wall's plan sits below its tile's top edge, so its top never hides floor. */
export const SOUTH_WALL_DROP = 12;
/** Width of a north-wall pillar's front face. */
export const PILLAR_WIDTH = 20;
/** How far a pillar rises above the floor line. */
export const PILLAR_HEIGHT = 92;
/** Pillars stand on every this many tile boundaries along the north wall. */
export const PILLAR_SPACING = 4;
/** Width of the drain channel that rings the hall outside its walls. */
export const DRAIN_WIDTH = 12;

/** Which side of the hall a wall tile or gate belongs to; `inner` for walls inside the hall. */
export type WallSide = "north" | "south" | "west" | "east" | "inner";

/** The kind of access point a gate is. */
export type GateKind = FloorPaintSpec["accessPoints"][number]["kind"];

/** The floor spec with its tile lookups prepared once. */
export interface FloorGrid {
  readonly spec: FloorPaintSpec;
  /** Map width in tiles. */
  readonly columns: number;
  /** Map height in tiles. */
  readonly rows: number;
  /** Access points by `x,y` key. */
  readonly gates: ReadonlyMap<string, GateKind>;
}

/**
 * Prepares the tile lookups for a floor spec.
 *
 * @param spec - The floor spec.
 * @returns The grid.
 */
export function build_floor_grid(spec: FloorPaintSpec): FloorGrid {
  return {
    spec,
    columns: spec.map.width,
    rows: spec.map.height,
    gates: new Map(
      spec.accessPoints.map((point) => [`${point.position.x},${point.position.y}`, point.kind]),
    ),
  };
}

/**
 * Gives the gate kind at a tile, if an access point sits there.
 *
 * @param grid - The floor grid.
 * @param x - Tile column.
 * @param y - Tile row.
 * @returns The gate kind, or undefined.
 */
export function gate_at(grid: FloorGrid, x: number, y: number): GateKind | undefined {
  return grid.gates.get(`${x},${y}`);
}

/**
 * Tests whether a tile is solid wall: a wall tile with no gate in it.
 *
 * @param grid - The floor grid.
 * @param x - Tile column.
 * @param y - Tile row.
 * @returns True for solid wall; false off the map.
 */
export function is_solid_wall(grid: FloorGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.columns || y >= grid.rows) return false;
  return grid.spec.map.tiles[y * grid.columns + x] === "wall" && !gate_at(grid, x, y);
}

/**
 * Tests whether a tile is open hall floor: a floor tile with no gate in it.
 *
 * @param grid - The floor grid.
 * @param x - Tile column.
 * @param y - Tile row.
 * @returns True for open floor; false off the map.
 */
export function is_open_floor(grid: FloorGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.columns || y >= grid.rows) return false;
  return grid.spec.map.tiles[y * grid.columns + x] === "floor" && !gate_at(grid, x, y);
}

/**
 * Tests whether a tile lies in an expansion bay (beyond the launch map's width or height).
 *
 * @param grid - The floor grid.
 * @param x - Tile column.
 * @param y - Tile row.
 * @returns True for an expansion-bay tile.
 */
export function is_expansion(grid: FloorGrid, x: number, y: number): boolean {
  return x >= grid.spec.baseWidth || y >= grid.spec.baseHeight;
}

/**
 * Names the side of the hall a perimeter tile belongs to. The north and south rows own their
 * corners, so a corner reads as the end of the north wall or of the low south wall.
 *
 * @param grid - The floor grid.
 * @param x - Tile column.
 * @param y - Tile row.
 * @returns The side, or `inner` for a tile off the perimeter.
 */
export function wall_side(grid: FloorGrid, x: number, y: number): WallSide {
  if (y === 0) return "north";
  if (y === grid.rows - 1) return "south";
  if (x === 0) return "west";
  if (x === grid.columns - 1) return "east";
  return "inner";
}

/**
 * Gives a tile's left edge in floor-texture pixels.
 *
 * @param x - Tile column.
 * @returns The texture x.
 */
export function tile_left(x: number): number {
  return FLOOR_MARGIN + x * TILE;
}

/**
 * Gives a tile's top edge in floor-texture pixels.
 *
 * @param y - Tile row.
 * @returns The texture y.
 */
export function tile_top(y: number): number {
  return FLOOR_MARGIN + y * TILE;
}

/**
 * Hashes a tile position into a seed, so each tile's chips and tone stay put when the map grows
 * or a route guide changes elsewhere.
 *
 * @param x - Tile column.
 * @param y - Tile row.
 * @param salt - Distinguishes the different uses of one tile.
 * @returns A 32-bit seed.
 */
export function tile_seed(x: number, y: number, salt: number): number {
  return (
    (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(salt, 83492791)) >>> 0
  );
}
