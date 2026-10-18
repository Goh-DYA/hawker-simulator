/**
 * Where every part of a stall sits in its texture, for each of the four rotations, and the
 * layout of the live children (vendor, counter dishes, steam, queue badge, sign glow) the world
 * view places on top of it.
 *
 * A stall is a cutaway building in the 3/4 oblique view: horizontal surfaces are seen from above
 * and lifted by their height, south faces hang below them, and the roof and signboard rise into
 * the overhang at the top of the texture. Whatever the rotation, the header (roof and sign) runs
 * along the top edge so the sign stays readable.
 *
 * The vendor always stands behind the counter directly opposite the stall's service tile (the
 * content's `servicePoint`, rotated the way core's `rotatePoint` turns it), so the guest at the
 * head of the queue faces the person serving them, and the counter dishes cluster on the counter
 * within about half a tile either side of the vendor, never in front of the vendor's torso. A
 * front-layer slab of counter height always stands directly south of the vendor's feet, so its
 * lifted top hides the legs:
 *
 * - **0 (serves south)**: the back wall face with its shelves, menu board and hood, a work bench
 *   along it with the station on the left or (mirrored stalls) the right, the interior floor,
 *   and the counter along the south edge, which hides the vendor's legs.
 * - **180 (serves north)**: the counter along the north edge, seen from the vendor's side with
 *   its inner shelves, kept clear of the roof's valance; the vendor just south of it, facing
 *   north; a work bench right behind the vendor carrying the station beside them (it hides the
 *   legs); and on deep stalls the back wall cut down to a shelf at the south edge, with floor
 *   props between.
 * - **90 (serves west) and 270 (serves east)**: the counter runs along the serving edge, with a
 *   short return just south of the vendor at the service row; the work bench runs along the
 *   opposite wall under a wall-mounted hood, the north wall face carries the shelves and menu
 *   board, a prep island fills the longer stretch of open floor, and the south wall is cut down
 *   to counter height.
 *
 * All coordinates are texture pixels of the rotated texture: the footprint's top-left corner is
 * at `(0, OVERHANG)`.
 */
import { STALL_BY_ID } from "@/src/content";

import { stableVisualHash } from "../../visuals/palette";
import { TILE } from "../canvas";
import { DISH_SIZE, OVERHANG, type Facing, type StallLayout, type StallPaintSpec } from "../specs";
import { slab_top, type Box, type Slab } from "./common";
import { resolve_dressing } from "./identity";

/** The edge a stall serves across. */
export type ServiceSide = "south" | "west" | "north" | "east";

/** A point in texture pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** How a bench's visible face is finished. */
export type BenchFace = "doors" | "wall" | "sliver";

/** Where the extractor hood hangs, which decides how it is drawn. */
export type HoodMount = "back-wall" | "side-wall" | "ceiling";

/** Width of the full-height side walls and posts framing a stall. */
const POST_WIDTH = 8;
/** Footprint depth of a counter, as seen from above: room for a plate. */
export const COUNTER_DEPTH = 18;
/** Height of a counter and of the walls and benches cut down to counter height. */
export const COUNTER_HEIGHT = 18;
/** Height of the floor strip in front of a counter that holds the step and drain. */
export const STEP_HEIGHT = 4;
/** Footprint depth of the south wall cut down to counter height (rotations 90 and 270). */
const NEAR_WALL_DEPTH = 10;
/** Width of a counter that runs along a west or east serving edge. */
const SIDE_COUNTER_WIDTH = 22;
/** Width of a work bench that runs along a west or east wall. */
const SIDE_BENCH_WIDTH = 30;
/** Width of a tall cabinet (drinks fridge or drawer cabinet) standing in the interior. */
const TALL_EXTRA_WIDTH = 24;
/** Draw scale of the vendor: the same size as the guests. */
const VENDOR_SCALE = 1;
/** Gap between the vendor's feet and the north edge of the slab that hides the legs. */
const VENDOR_GAP = 1;
/** How far the vendor stands from a side counter's inner edge. */
const SIDE_VENDOR_STANDOFF = 14;
/** Footprint depth of a side counter's return south of the vendor. */
const RETURN_DEPTH = 12;
/** How far a side counter's return runs past the vendor's centre. */
const RETURN_REACH = 18;
/** Floor between the north counter's footprint and the vendor's feet at rotation 180. */
const NORTH_STANDOFF = 12;
/** Clear space between the roof's valance and the north counter's top at rotation 180. */
const HEADER_CLEARANCE = 5;
/** Footprint depth of the work bench right behind the vendor on deep stalls at rotation 180. */
const MID_BENCH_DEPTH = 18;
/** Footprint depth of the back wall cut down to a shelf on deep stalls at rotation 180. */
const BACK_WALL_DEPTH = 12;
/** Draw scale of a counter dish (its texture is `DISH_SIZE` square). */
const DISH_SCALE = 0.5;
/** Spacing of the dish slots: about half a tile. */
const DISH_SPACING = 24;
/** Room kept at each end of a counter for its condiment props. */
const COUNTER_PROP_ROOM = 22;
/** Clear space either side of the vendor's centre that the bench station keeps (rotation 180). */
const VENDOR_CLEARANCE = 14;
/** Screen height of the hood over a side bench (rotations 90 and 270). */
const SIDE_HOOD_HEIGHT = 18;
/** Shortest stretch of open floor that holds floor props (rotations 90 and 270). */
const MIN_PROP_FLOOR = 22;
/** Stretch of open floor south of a side return long enough for a second floor prop. */
const LONG_PROP_FLOOR = 60;
/** Where the sink sits between the station and the side piece, picked per stall (rotation 0). */
const SINK_SHARES = [0.32, 0.5, 0.68] as const;

/** Where every part of a stall sits in its texture. */
export interface StallGeometry {
  /** Texture width (the rotated footprint width). */
  readonly width: number;
  /** Texture height (the rotated footprint height plus the overhang). */
  readonly height: number;
  /** Texture y of the footprint's south edge. */
  readonly bottom: number;
  /** The edge the stall serves across. */
  readonly side: ServiceSide;
  /** True for stalls three tiles deep from the serving edge to the back wall. */
  readonly isDeep: boolean;
  /** True when the station, hood and wall dressing are laid out mirrored. */
  readonly isMirrored: boolean;
  /** The roof band along the top edge. */
  readonly header: Box;
  /** The signboard on the roof band. */
  readonly sign: Box;
  /** The wall face seen frontally (back wall at 0, north wall at 90 and 270); none at 180. */
  readonly wall?: Box;
  /** The interior floor the vendor stands on. */
  readonly floor: Box;
  /** The full-height side walls and posts. */
  readonly posts: readonly Box[];
  /** The service counter. */
  readonly counter: Slab;
  /** The work bench carrying the cooking station. */
  readonly bench: Slab;
  /** How the bench's visible face is finished. */
  readonly benchFace: BenchFace;
  /** True when the bench stands in front of the vendor (rotation 180), on the front layer. */
  readonly isBenchInFront: boolean;
  /** The back wall cut down to a shelf at the south edge (deep stalls at rotation 180). */
  readonly backWall?: Slab;
  /** The south wall cut down to counter height (rotations 90 and 270). */
  readonly nearWall?: Slab;
  /** The side counter's short return just south of the vendor (rotations 90 and 270). */
  readonly counterReturn?: Slab;
  /** The front-layer slab directly south of the vendor whose lifted top hides the legs. */
  readonly legCover: Slab;
  /** A second bench along the north wall, between the counter and the side bench (90, 270). */
  readonly wallBench?: Slab;
  /** The sink basin set into a bench top. */
  readonly sink: Box;
  /** A prep island in the open floor of a long interior (90 and 270). */
  readonly island?: Slab;
  /** Footprints of the main station and the side piece on the bench top. */
  readonly stations: readonly [Box, Box];
  /** The extractor hood over the main station, when the stall has one. */
  readonly hood?: Box;
  /** How the hood is mounted. */
  readonly hoodMount: HoodMount;
  /** The tall cabinet standing in the interior, when the stall has one. */
  readonly tallExtra?: Slab;
  /** Base point of low clutter on the interior floor; none where there is no room. */
  readonly lowExtra?: Point;
  /** True when the floor props stand in front of the bench, so paint on the front layer. */
  readonly isFloorPropsInFront: boolean;
  /** The anti-fatigue mat the vendor stands on (clipped to the floor). */
  readonly mat: Box;
  /** The floor drain channel. */
  readonly drain: Box;
  /** Base points of the crates, stools and buckets on the interior floor. */
  readonly clutter: readonly Point[];
  /** The rail of hanging wares over the far end of the counter (rotation 180). */
  readonly wares?: { readonly from: number; readonly to: number; readonly railY: number };
  /** The opening a closed stall's roller shutter covers. */
  readonly shutter: Box;
  /** The vendor's feet, draw scale and facing. */
  readonly vendor: StallLayout["vendor"];
  /** Centres of the counter dish slots, in order along the counter. */
  readonly dishSlots: readonly Point[];
  /** Draw scale of a counter dish. */
  readonly dishScale: number;
  /** Centre of the queue-count badge. */
  readonly badge: Point;
}

/** The geometry a rotation lays out, before the shared header, sign and side are added. */
type Parts = Omit<StallGeometry, "height" | "side" | "sign" | "isMirrored">;

/** The parts every rotation shares, worked out once. */
interface Frame {
  readonly width: number;
  readonly bottom: number;
  readonly headerBottom: number;
  readonly isDeep: boolean;
  readonly isMirrored: boolean;
  readonly hasTallExtra: boolean;
  readonly hasHood: boolean;
  readonly seed: number;
  /** Centre of the service tile along the counter (x at 0 and 180, y at 90 and 270). */
  readonly serviceAt: number;
  readonly sign: Box;
}

/**
 * Gives the edge a stall serves across at a rotation.
 *
 * @param rotation - The placement rotation.
 * @returns The serving edge.
 */
export function service_side(rotation: StallPaintSpec["rotation"]): ServiceSide {
  switch (rotation) {
    case 90:
      return "west";
    case 180:
      return "north";
    case 270:
      return "east";
    default:
      return "south";
  }
}

/**
 * Gives the way the vendor faces: towards the counter, across the serving edge.
 *
 * @param side - The serving edge.
 * @returns The vendor's facing.
 */
function vendor_facing(side: ServiceSide): Facing {
  return side;
}

/**
 * Clamps a value into a range.
 *
 * @param value - The value.
 * @param low - The lower bound.
 * @param high - The upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Finds the centre of the stall's service tile along its counter, in texture pixels: the
 * content's service point turned the way core's `rotatePoint` turns it (at 90 the service column
 * becomes the row, at 180 the column counts from the east, at 270 the row counts from the south).
 * A stall without a service point is served at the middle of its counter.
 *
 * @param spec - The stall spec.
 * @param side - The serving edge.
 * @returns The x (south, north) or y (west, east) of the service tile's centre.
 */
export function service_position(spec: StallPaintSpec, side: ServiceSide): number {
  const isAcross = side === "south" || side === "north";
  const length = isAcross ? spec.width : spec.height;
  const tiles = Math.max(1, Math.round(length / TILE));
  const point = STALL_BY_ID.get(spec.definitionId)?.servicePoint;
  const column = point ? clamp(point.x, 0, tiles - 1) : (tiles - 1) / 2;
  const index = side === "north" || side === "east" ? tiles - 1 - column : column;
  return (isAcross ? 0 : OVERHANG) + (index + 0.5) * TILE;
}

/**
 * Works out the parts every rotation shares: the header and sign along the top edge, the
 * dressing flags and where the service tile sits.
 *
 * @param spec - The stall spec.
 * @returns The shared frame.
 */
function frame_of(spec: StallPaintSpec): Frame {
  const side = service_side(spec.rotation);
  const depth = side === "south" || side === "north" ? spec.height : spec.width;
  const isDeep = depth >= TILE * 3;
  const headerBottom = OVERHANG + (isDeep ? 14 : 10);
  const signHeight = isDeep ? 18 : 15;
  const signWidth = Math.max(
    Math.min(spec.width - 24, 72),
    Math.min(spec.width - 24, spec.name.length * 7 + 26),
  );
  const dressing = resolve_dressing(spec);
  return {
    width: spec.width,
    bottom: OVERHANG + spec.height,
    headerBottom,
    isDeep,
    isMirrored: dressing.isMirrored,
    hasTallExtra: dressing.extra === "fridge" || dressing.extra === "drawers",
    hasHood: dressing.hasHood,
    seed: stableVisualHash(spec.definitionId),
    serviceAt: service_position(spec, side),
    sign: {
      x: (spec.width - signWidth) / 2,
      y: headerBottom - signHeight - (isDeep ? 5 : 4),
      width: signWidth,
      height: signHeight,
    },
  };
}

/**
 * Picks dish slot positions along a counter that runs across the texture, flanking the vendor:
 * the first pair half a tile either side, then further out on the roomier side first. No slot
 * lands on the vendor, so the vendor's torso stays clear of plates.
 *
 * @param centre - The vendor's x.
 * @param count - How many slots to lay out.
 * @param low - The lowest slot centre the counter allows.
 * @param high - The highest slot centre the counter allows.
 * @returns The slot x positions, west to east.
 */
function flanking_slots(centre: number, count: number, low: number, high: number): number[] {
  const isLeftRoomier = centre - low >= high - centre;
  const steps = [1, 2, 3, 4].flatMap((step) => (isLeftRoomier ? [-step, step] : [step, -step]));
  const picked = steps
    .map((step) => centre + step * DISH_SPACING)
    .filter((x) => x >= low && x <= high)
    .slice(0, count);
  return picked.sort((a, b) => a - b);
}

/**
 * Clusters dish slots along a side counter around a centre, shifted as a whole to stay inside
 * the counter.
 *
 * @param centre - The cluster's centre.
 * @param count - How many slots to lay out.
 * @param low - The lowest slot centre the counter allows.
 * @param high - The highest slot centre the counter allows.
 * @returns The slot positions, north to south.
 */
function clustered_slots(centre: number, count: number, low: number, high: number): number[] {
  const spacing = DISH_SPACING - 2;
  const first = centre - (spacing * (count - 1)) / 2;
  const last = first + spacing * (count - 1);
  const shift = first < low ? low - first : last > high ? high - last : 0;
  return Array.from({ length: count }, (_, index) => first + shift + index * spacing);
}

/**
 * Mirrors a box across the texture's vertical centre line when the layout is mirrored.
 *
 * @param box - The box.
 * @param width - The texture width.
 * @param isMirrored - True to mirror.
 * @returns The box, mirrored or not.
 */
function mirror_box<T extends Box | Slab>(box: T, width: number, isMirrored: boolean): T {
  return isMirrored ? { ...box, x: width - box.x - box.width } : box;
}

/**
 * Mirrors a point across the texture's vertical centre line when the layout is mirrored.
 *
 * @param point - The point.
 * @param width - The texture width.
 * @param isMirrored - True to mirror.
 * @returns The point, mirrored or not.
 */
function mirror_point(point: Point, width: number, isMirrored: boolean): Point {
  return isMirrored ? { x: width - point.x, y: point.y } : point;
}

/**
 * Gives the two full-height posts framing a stall that serves south or north.
 *
 * @param frame - The shared frame.
 * @returns The posts.
 */
function framing_posts(frame: Frame): Box[] {
  const { width, bottom, headerBottom } = frame;
  const height = bottom - headerBottom + 6;
  return [
    { x: 0, y: headerBottom - 6, width: POST_WIDTH, height },
    { x: width - POST_WIDTH, y: headerBottom - 6, width: POST_WIDTH, height },
  ];
}

/**
 * Lays out a stall that serves south: back wall, bench, floor, then the counter at the front.
 * Mirrored stalls put the station, hood and tall cabinet on the right and the menu board on the
 * left.
 *
 * @param frame - The shared frame.
 * @returns The geometry.
 */
function geometry_south(frame: Frame): Parts {
  const { width, bottom, headerBottom, isDeep, hasTallExtra, isMirrored, seed } = frame;
  const inner = width - POST_WIDTH * 2;
  const counter: Slab = {
    x: POST_WIDTH,
    y: bottom - STEP_HEIGHT - COUNTER_DEPTH,
    width: inner,
    depth: COUNTER_DEPTH,
    height: COUNTER_HEIGHT,
  };
  const counterTop = slab_top(counter);
  const benchFront = bottom - (isDeep ? 58 : 44);
  const benchDepth = isDeep ? 16 : 11;
  const benchHeight = isDeep ? 15 : 12;
  const benchRight = width - POST_WIDTH - (hasTallExtra ? TALL_EXTRA_WIDTH + 2 : 0);
  // Laid out unmirrored (station on the left), then mirrored as a whole where the stall says so.
  const bench: Slab = {
    x: POST_WIDTH,
    y: benchFront - benchDepth,
    width: benchRight - POST_WIDTH,
    depth: benchDepth,
    height: benchHeight,
  };
  const benchTop = slab_top(bench);
  const mainWidth = Math.min(isDeep ? 70 : 48, bench.width * 0.44);
  const sideWidth = Math.min(40, bench.width * 0.3);
  const main: Box = { x: POST_WIDTH + 6, y: benchTop.y, width: mainWidth, height: benchTop.height };
  const sidePiece: Box = {
    x: benchRight - 6 - sideWidth,
    y: benchTop.y,
    width: sideWidth,
    height: benchTop.height,
  };
  const sinkGap = sidePiece.x - (main.x + main.width) - 26;
  const sinkX = main.x + main.width + Math.max(0, sinkGap) * SINK_SHARES[seed % 3];
  const wall: Box = {
    x: POST_WIDTH,
    y: headerBottom,
    width: inner,
    height: benchTop.y - headerBottom + 2,
  };
  const tallBase = benchFront - 12;
  const vendorX = clamp(frame.serviceAt, POST_WIDTH + 16, width - POST_WIDTH - 16);
  const slotCount = width >= TILE * 4 ? 3 : 2;
  const mirror = <T extends Box | Slab>(box: T) => mirror_box(box, width, isMirrored);
  const hood: Box = {
    x: main.x - 3,
    y: headerBottom + 1,
    width: main.width + 6,
    height: Math.max(8, Math.min(15, wall.height * 0.36)),
  };
  return {
    width,
    bottom,
    isDeep,
    header: { x: 0, y: 0, width, height: headerBottom },
    wall,
    floor: {
      x: POST_WIDTH,
      y: benchFront - 1,
      width: inner,
      height: bottom - STEP_HEIGHT - benchFront + 1,
    },
    posts: framing_posts(frame),
    counter,
    bench: mirror(bench),
    benchFace: "doors",
    isBenchInFront: false,
    legCover: counter,
    stations: [mirror(main), mirror(sidePiece)],
    hood: frame.hasHood ? mirror(hood) : undefined,
    hoodMount: "back-wall",
    tallExtra: hasTallExtra
      ? mirror({
          x: width - POST_WIDTH - TALL_EXTRA_WIDTH,
          y: tallBase,
          width: TALL_EXTRA_WIDTH,
          depth: 12,
          height: tallBase - headerBottom - 4,
        })
      : undefined,
    lowExtra: mirror_point({ x: width - POST_WIDTH - 14, y: benchFront + 11 }, width, isMirrored),
    isFloorPropsInFront: false,
    sink: mirror({ x: sinkX, y: benchTop.y + 2, width: 26, height: benchTop.height - 4 }),
    mat: { x: vendorX - 24, y: benchFront + 9, width: 48, height: 60 },
    drain: { x: POST_WIDTH, y: benchFront + 2, width: inner, height: 3 },
    clutter: [mirror_point({ x: POST_WIDTH + 13, y: benchFront + 15 }, width, isMirrored)],
    shutter: {
      x: POST_WIDTH,
      y: headerBottom,
      width: inner,
      height: counterTop.y - headerBottom + 2,
    },
    vendor: {
      x: vendorX,
      y: counter.y - VENDOR_GAP,
      scale: VENDOR_SCALE,
      facing: vendor_facing("south"),
    },
    dishSlots: flanking_slots(
      vendorX,
      slotCount,
      counterTop.x + COUNTER_PROP_ROOM,
      counterTop.x + counterTop.width - COUNTER_PROP_ROOM,
    ).map((x) => ({ x, y: counterTop.y + counterTop.height / 2 })),
    dishScale: DISH_SCALE,
    badge: { x: width - 26, y: bottom - 2 },
  };
}

/**
 * Lays out a stall that serves north: the counter along the north edge (below the roof's
 * valance), the vendor just south of it, and a work bench right behind the vendor that carries
 * the station beside them and hides their legs. A shallow stall's bench is its back wall cut down;
 * a deep stall has a freestanding bench, floor props and the back wall cut down to a shelf.
 *
 * @param frame - The shared frame.
 * @returns The geometry.
 */
function geometry_north(frame: Frame): Parts {
  const { width, bottom, headerBottom, isDeep, isMirrored } = frame;
  const inner = width - POST_WIDTH * 2;
  const counter: Slab = {
    x: POST_WIDTH,
    y: headerBottom + HEADER_CLEARANCE + COUNTER_HEIGHT,
    width: inner,
    depth: COUNTER_DEPTH,
    height: COUNTER_HEIGHT,
  };
  const counterTop = slab_top(counter);
  const vendorX = clamp(frame.serviceAt, POST_WIDTH + 16, width - POST_WIDTH - 16);
  const vendorY = counter.y + counter.depth + NORTH_STANDOFF;
  const benchY = vendorY + VENDOR_GAP;
  const kerb = bottom - STEP_HEIGHT;
  const bench: Slab = {
    x: POST_WIDTH,
    y: benchY,
    width: inner,
    depth: isDeep ? MID_BENCH_DEPTH : kerb - benchY,
    height: COUNTER_HEIGHT,
  };
  const benchTop = slab_top(bench);
  const backWall: Slab | undefined = isDeep
    ? {
        x: POST_WIDTH,
        y: kerb - BACK_WALL_DEPTH,
        width: inner,
        depth: BACK_WALL_DEPTH,
        height: COUNTER_HEIGHT,
      }
    : undefined;
  // The station goes on the roomier side of the vendor, the side piece on the other.
  const leftFrom = POST_WIDTH + 4;
  const leftTo = vendorX - VENDOR_CLEARANCE;
  const rightFrom = vendorX + VENDOR_CLEARANCE;
  const rightTo = width - POST_WIDTH - 4;
  const leftRoom = leftTo - leftFrom;
  const rightRoom = rightTo - rightFrom;
  const isMainLeft = leftRoom === rightRoom ? !isMirrored : leftRoom > rightRoom;
  const mainRoom = isMainLeft ? leftRoom : rightRoom;
  const sideRoom = isMainLeft ? rightRoom : leftRoom;
  const mainWidth = Math.min(isDeep ? 70 : 48, mainRoom);
  const sideWidth = Math.max(0, Math.min(40, sideRoom - 4));
  const stationY = benchTop.y + 2;
  const stationHeight = isDeep ? benchTop.height - 4 : benchTop.height - 12;
  const centred = (from: number, room: number, size: number) => from + (room - size) / 2;
  const main: Box = {
    x: isMainLeft
      ? centred(leftFrom, leftRoom, mainWidth)
      : centred(rightFrom, rightRoom, mainWidth),
    y: stationY,
    width: mainWidth,
    height: stationHeight,
  };
  const sidePiece: Box = {
    x: isMainLeft
      ? centred(rightFrom, rightRoom, sideWidth)
      : centred(leftFrom, leftRoom, sideWidth),
    y: stationY,
    width: sideWidth,
    height: stationHeight,
  };
  // A deep stall's sink is set into the back shelf behind the side piece; a shallow stall's into
  // the south edge of its bench, below the vendor's waist so the tap never crosses the torso.
  const backTop = backWall ? slab_top(backWall) : undefined;
  const sink: Box = backTop
    ? {
        x: clamp(sidePiece.x + sidePiece.width / 2 - 13, POST_WIDTH + 2, width - POST_WIDTH - 28),
        y: backTop.y + 2,
        width: 26,
        height: backTop.height - 4,
      }
    : { x: vendorX - 13, y: benchTop.y + benchTop.height - 10, width: 26, height: 8 };
  const floorTop = counter.y + counter.depth - 2;
  const slotCount = width >= TILE * 4 ? 3 : 2;
  const slots = flanking_slots(
    vendorX,
    slotCount,
    counterTop.x + COUNTER_PROP_ROOM,
    counterTop.x + counterTop.width - COUNTER_PROP_ROOM,
  );
  // The hanging wares fill the counter's far end beyond the dishes, on its roomier side.
  const dishHalf = (DISH_SCALE * DISH_SIZE) / 2;
  const waresLeft = { from: counterTop.x + 4, to: (slots[0] ?? vendorX) - dishHalf - 4 };
  const waresRight = {
    from: (slots[slots.length - 1] ?? vendorX) + dishHalf + 4,
    to: counterTop.x + counterTop.width - 4,
  };
  const waresSpan =
    waresLeft.to - waresLeft.from >= waresRight.to - waresRight.from ? waresLeft : waresRight;
  // The strip of floor between a deep stall's bench and its back shelf holds the floor props.
  const stripBase = backWall ? slab_top(backWall).y - 2 : kerb;
  const propsLeft = !isMainLeft;
  return {
    width,
    bottom,
    isDeep,
    header: { x: 0, y: 0, width, height: headerBottom },
    floor: { x: POST_WIDTH, y: floorTop, width: inner, height: kerb - floorTop },
    posts: framing_posts(frame),
    counter,
    bench,
    benchFace: isDeep ? "doors" : "wall",
    isBenchInFront: true,
    backWall,
    legCover: bench,
    stations: [main, sidePiece],
    hood: frame.hasHood
      ? {
          x: main.x - 3,
          y: counterTop.y + counterTop.height + 2,
          width: main.width + 6,
          height: Math.max(8, main.y - (counterTop.y + counterTop.height + 2)),
        }
      : undefined,
    hoodMount: "ceiling",
    lowExtra: isDeep
      ? { x: propsLeft ? POST_WIDTH + 16 : width - POST_WIDTH - 16, y: stripBase }
      : undefined,
    isFloorPropsInFront: true,
    sink,
    mat: {
      x: vendorX - 24,
      y: counter.y + counter.depth - 1,
      width: 48,
      height: NORTH_STANDOFF + 2,
    },
    drain: isDeep
      ? { x: POST_WIDTH, y: stripBase - 8, width: inner, height: 3 }
      : { x: POST_WIDTH, y: floorTop + 3, width: inner, height: 3 },
    clutter: isDeep
      ? [{ x: propsLeft ? width - POST_WIDTH - 40 : POST_WIDTH + 40, y: stripBase }]
      : [],
    wares:
      waresSpan.to - waresSpan.from >= 18 ? { ...waresSpan, railY: headerBottom + 3 } : undefined,
    shutter: {
      x: POST_WIDTH,
      y: headerBottom,
      width: inner,
      height: kerb - headerBottom,
    },
    vendor: { x: vendorX, y: vendorY, scale: VENDOR_SCALE, facing: vendor_facing("north") },
    dishSlots: slots.map((x) => ({ x, y: counterTop.y + counterTop.height / 2 })),
    dishScale: DISH_SCALE,
    badge: { x: width - 26, y: counter.y + 4 },
  };
}

/**
 * Lays out a stall that serves west or east: the counter along the serving edge with a short
 * return south of the vendor at the service row, the bench along the opposite wall under its
 * hood, a prep island in the longer stretch of open floor, and the south wall cut down to
 * counter height in front.
 *
 * @param frame - The shared frame.
 * @param side - `west` or `east`.
 * @returns The geometry.
 */
function geometry_side(frame: Frame, side: "west" | "east"): Parts {
  const { width, bottom, headerBottom, isDeep, hasTallExtra, isMirrored } = frame;
  const isWest = side === "west";
  const wallBase = headerBottom + (isDeep ? 34 : 28);
  const counterX = isWest ? 0 : width - SIDE_COUNTER_WIDTH;
  const benchX = isWest ? width - POST_WIDTH - SIDE_BENCH_WIDTH : POST_WIDTH;
  const postX = isWest ? width - POST_WIDTH : 0;
  const nearY = bottom - STEP_HEIGHT - NEAR_WALL_DEPTH;
  const counter: Slab = {
    x: counterX,
    y: wallBase,
    width: SIDE_COUNTER_WIDTH,
    depth: bottom - STEP_HEIGHT - wallBase,
    height: COUNTER_HEIGHT,
  };
  const counterTop = slab_top(counter);
  const nearWall: Slab = {
    x: isWest ? SIDE_COUNTER_WIDTH : POST_WIDTH,
    y: nearY,
    width: width - POST_WIDTH - SIDE_COUNTER_WIDTH,
    depth: NEAR_WALL_DEPTH,
    height: COUNTER_HEIGHT,
  };
  // The vendor stands at the service row, just inside the counter, with the return south of them.
  const vendorX = isWest
    ? SIDE_COUNTER_WIDTH + SIDE_VENDOR_STANDOFF
    : width - SIDE_COUNTER_WIDTH - SIDE_VENDOR_STANDOFF;
  const vendorY = clamp(frame.serviceAt, wallBase + 22, nearY - RETURN_DEPTH - 4);
  const returnFrom = isWest ? SIDE_COUNTER_WIDTH : vendorX - RETURN_REACH;
  const returnTo = isWest ? vendorX + RETURN_REACH : width - SIDE_COUNTER_WIDTH;
  const counterReturn: Slab = {
    x: returnFrom,
    y: vendorY + VENDOR_GAP,
    width: returnTo - returnFrom,
    depth: RETURN_DEPTH,
    height: COUNTER_HEIGHT,
  };
  const benchY = wallBase + (hasTallExtra ? 18 : 0);
  const bench: Slab = {
    x: benchX,
    y: benchY,
    width: SIDE_BENCH_WIDTH,
    depth: nearY - benchY,
    height: 14,
  };
  const benchTop = slab_top(bench);
  const mainHeight = Math.min(50, Math.max(24, benchTop.height - 8) * 0.55);
  const sinkHeight = Math.max(10, Math.min(22, benchTop.height - mainHeight - 18));
  // Mirrored stalls keep the station at the south end of the bench and the sink at the north.
  const mainY = isMirrored ? benchTop.y + benchTop.height - 6 - mainHeight : benchTop.y + 4;
  const sinkY = isMirrored ? benchTop.y + 5 : mainY + mainHeight + 5;
  const main: Box = { x: benchX + 3, y: mainY, width: SIDE_BENCH_WIDTH - 6, height: mainHeight };
  const wallBenchX = isWest ? SIDE_COUNTER_WIDTH : benchX + SIDE_BENCH_WIDTH;
  const wallBench: Slab = {
    x: wallBenchX,
    y: wallBase,
    width: isWest ? benchX - SIDE_COUNTER_WIDTH : width - SIDE_COUNTER_WIDTH - wallBenchX,
    depth: 12,
    height: 14,
  };
  const wallBenchTop = slab_top(wallBench);
  const sideWidth = Math.min(36, wallBench.width - 6);
  const sidePiece: Box = {
    x: wallBench.x + (wallBench.width - sideWidth) / 2,
    y: wallBenchTop.y,
    width: sideWidth,
    height: wallBenchTop.height,
  };
  const interiorX = isWest ? SIDE_COUNTER_WIDTH : POST_WIDTH;
  const interiorWidth = width - POST_WIDTH - SIDE_COUNTER_WIDTH;
  // The open floor north and south of the vendor, and the part of the aisle clear of the return.
  const northFrom = wallBase + wallBench.depth + 4;
  const northTo = vendorY - 6;
  const southFrom = counterReturn.y + RETURN_DEPTH + 6;
  const southTo = nearY - 6;
  const clearFrom = isWest ? returnTo + 6 : benchX + SIDE_BENCH_WIDTH + 4;
  const clearTo = isWest ? benchX - 4 : returnFrom - 6;
  const islandWidth = Math.min(44, clearTo - clearFrom);
  const isNorthLonger = northTo - northFrom > southTo - southFrom;
  const regionFrom = isNorthLonger ? northFrom : southFrom;
  const regionLength = isNorthLonger ? northTo - northFrom : southTo - southFrom;
  const islandDepth = Math.min(40, regionLength - 8);
  const island: Slab | undefined =
    islandWidth >= 24 && islandDepth >= 24
      ? {
          x: (clearFrom + clearTo - islandWidth) / 2,
          y: regionFrom + (regionLength - islandDepth) / 2,
          width: islandWidth,
          depth: islandDepth,
          height: 16,
        }
      : undefined;
  const islandTop = island ? slab_top(island) : undefined;
  // Floor props fill the stretch the island leaves (or the longer one without an island), at its
  // end away from the vendor, and stand clear of the vendor and the return.
  const isPropsNorth =
    island && (isNorthLonger ? southTo - southFrom : northTo - northFrom) >= MIN_PROP_FLOOR
      ? !isNorthLonger
      : isNorthLonger;
  const propY = isPropsNorth ? northFrom + 18 : southTo - 8;
  const nearBench = isWest ? benchX - 12 : benchX + SIDE_BENCH_WIDTH + 12;
  const clutterX = isPropsNorth
    ? (clearFrom + clearTo) / 2
    : isWest
      ? returnTo + 10
      : returnFrom - 10;
  const propRegion = isPropsNorth ? northTo - northFrom : southTo - southFrom;
  const clutter: Point[] = [{ x: clutterX, y: propY + 2 }];
  if (!isPropsNorth && propRegion >= LONG_PROP_FLOOR) {
    // A long stretch south of the return gets a second stack beside the counter.
    clutter.push({
      x: isWest ? SIDE_COUNTER_WIDTH + 12 : width - SIDE_COUNTER_WIDTH - 12,
      y: propY,
    });
  }
  const slotCount = bottom - OVERHANG >= TILE * 4 ? 3 : 2;
  const slotLow = Math.max(counterTop.y, headerBottom) + 10;
  const slotHigh = counterTop.y + counterTop.height - 10;
  return {
    width,
    bottom,
    isDeep,
    header: { x: 0, y: 0, width, height: headerBottom },
    wall: {
      x: isWest ? 0 : POST_WIDTH,
      y: headerBottom,
      width: width - POST_WIDTH,
      height: wallBase - headerBottom,
    },
    floor: {
      x: interiorX,
      y: wallBase,
      width: interiorWidth,
      height: bottom - STEP_HEIGHT - wallBase,
    },
    posts: [
      { x: postX, y: headerBottom - 6, width: POST_WIDTH, height: bottom - headerBottom + 6 },
    ],
    counter,
    bench,
    benchFace: "sliver",
    isBenchInFront: false,
    nearWall,
    counterReturn,
    legCover: counterReturn,
    wallBench,
    sink: {
      x: benchX + 5,
      y: sinkY,
      width: SIDE_BENCH_WIDTH - 10,
      height: sinkHeight,
    },
    island,
    stations: [
      main,
      islandTop
        ? {
            x: islandTop.x + 4,
            y: islandTop.y + 4,
            width: islandTop.width - 8,
            height: Math.min(18, islandTop.height - 8),
          }
        : sidePiece,
    ],
    hood: frame.hasHood
      ? {
          x: isWest ? benchX - 4 : POST_WIDTH,
          y: main.y - 10,
          width: SIDE_BENCH_WIDTH + 4,
          height: SIDE_HOOD_HEIGHT,
        }
      : undefined,
    hoodMount: "side-wall",
    tallExtra: hasTallExtra
      ? {
          x: benchX,
          y: wallBase,
          width: SIDE_BENCH_WIDTH,
          depth: 16,
          height: wallBase - headerBottom - 2,
        }
      : undefined,
    lowExtra: { x: nearBench, y: propY },
    isFloorPropsInFront: false,
    mat: {
      x: isWest ? SIDE_COUNTER_WIDTH : width - SIDE_COUNTER_WIDTH - 22,
      y: vendorY - 30,
      width: 22,
      height: 32,
    },
    drain: {
      x: isWest ? benchX - 4 : benchX + SIDE_BENCH_WIDTH + 1,
      y: wallBase,
      width: 3,
      height: nearY - wallBase,
    },
    clutter,
    shutter: {
      x: interiorX,
      y: headerBottom,
      width: interiorWidth,
      height: slab_top(nearWall).y - headerBottom + 2,
    },
    vendor: { x: vendorX, y: vendorY, scale: VENDOR_SCALE, facing: vendor_facing(side) },
    dishSlots: clustered_slots(vendorY - COUNTER_HEIGHT - 2, slotCount, slotLow, slotHigh).map(
      (y) => ({ x: counterX + SIDE_COUNTER_WIDTH / 2, y }),
    ),
    dishScale: DISH_SCALE,
    badge: { x: isWest ? 26 : width - 26, y: bottom - 2 },
  };
}

/**
 * Lays out a stall texture for its rotation.
 *
 * @param spec - The stall spec.
 * @returns The geometry in texture pixels.
 */
export function stall_geometry(spec: StallPaintSpec): StallGeometry {
  const frame = frame_of(spec);
  const side = service_side(spec.rotation);
  const parts =
    side === "south"
      ? geometry_south(frame)
      : side === "north"
        ? geometry_north(frame)
        : geometry_side(frame, side);
  return {
    ...parts,
    height: frame.bottom,
    side,
    sign: frame.sign,
    isMirrored: frame.isMirrored,
  };
}

/**
 * Computes where the stall's live children sit: the vendor stands behind the counter opposite
 * the service tile, with a front-layer slab hiding the legs; the dishes flank the vendor on the
 * counter top; steam rises from the main station; the queue badge sits by the serving edge and a
 * lightbox sign glows.
 *
 * @param spec - The stall spec.
 * @returns The layout in texture pixels of the rotated texture.
 */
export function stall_layout(spec: StallPaintSpec): StallLayout {
  const geo = stall_geometry(spec);
  const main = geo.stations[0];
  return {
    vendor: geo.vendor,
    dishSlots: geo.dishSlots,
    dishScale: geo.dishScale,
    steamSource: { x: main.x + main.width / 2, y: Math.max(2, main.y - 6) },
    badge: geo.badge,
    signGlow:
      spec.signShape === "lightbox"
        ? {
            x: geo.sign.x + geo.sign.width / 2,
            y: geo.sign.y + geo.sign.height / 2,
            radius: Math.min(geo.sign.width * 0.55, 60),
          }
        : undefined,
  };
}
