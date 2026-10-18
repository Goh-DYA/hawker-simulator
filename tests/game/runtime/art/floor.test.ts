/**
 * Draw-output tests for the hall floor painter in `runtime/art/floor.ts`.
 *
 * The launch hall is painted into a recording context for the default, high-contrast and
 * low-detail frames, and the digests of its calls show that each frame, each gate layout, the
 * route-guide lanes and the expansion bays change what is painted, while the same spec always
 * paints the same calls and a gate paints the same whether its tile is marked wall or floor.
 */
import { describe, expect, it } from "vitest";

import { createGridMap, type GridMap } from "@/src/game/core";
import { expandGridMap } from "@/src/game/core/grid";
import { build_floor_grid, PILLAR_HEIGHT, tile_top } from "@/src/game/runtime/art/floor/layout";
import { pillar_positions } from "@/src/game/runtime/art/floor/walls";
import { FLOOR_MARGIN, type FloorPaintSpec, type PaintFrame } from "@/src/game/runtime/art/specs";

import { record_paint } from "./fixtures";

/** The launch map's size and its entrance and exit row. */
const LAUNCH_WIDTH = 24;
const LAUNCH_HEIGHT = 16;
const ACCESS_ROW = 7;

/** The three paint frames every item is checked in. */
const FRAMES: Readonly<Record<string, PaintFrame>> = {
  default: { isHighContrast: false, isLowDetail: false },
  "high contrast": { isHighContrast: true, isLowDetail: false },
  "low detail": { isHighContrast: false, isLowDetail: true },
};

/**
 * Builds the launch map: a walled hall whose entrance and exit tiles are floor, as in the game.
 *
 * @param gate_tile - What the access tiles are marked as.
 * @returns The map.
 */
function launch_map(gate_tile: "floor" | "wall" = "floor"): GridMap {
  const tiles = Array<"floor" | "wall">(LAUNCH_WIDTH * LAUNCH_HEIGHT).fill("floor");
  for (let x = 0; x < LAUNCH_WIDTH; x += 1) {
    tiles[x] = "wall";
    tiles[(LAUNCH_HEIGHT - 1) * LAUNCH_WIDTH + x] = "wall";
  }
  for (let y = 0; y < LAUNCH_HEIGHT; y += 1) {
    tiles[y * LAUNCH_WIDTH] = "wall";
    tiles[y * LAUNCH_WIDTH + LAUNCH_WIDTH - 1] = "wall";
  }
  tiles[ACCESS_ROW * LAUNCH_WIDTH] = gate_tile;
  tiles[ACCESS_ROW * LAUNCH_WIDTH + LAUNCH_WIDTH - 1] = gate_tile;
  return { ...createGridMap(LAUNCH_WIDTH, LAUNCH_HEIGHT, { tileSize: 48 }), tiles };
}

/**
 * Builds a floor spec for a map with the launch entrance and exit.
 *
 * @param map - The map.
 * @param frame - The paint frame.
 * @param overrides - Fields to replace.
 * @returns The spec.
 */
function floor_spec(
  map: GridMap,
  frame: PaintFrame,
  overrides: Partial<FloorPaintSpec> = {},
): FloorPaintSpec {
  return {
    kind: "floor",
    map,
    accessPoints: [
      { id: "entrance-1", kind: "entrance", position: { x: 0, y: ACCESS_ROW } },
      { id: "exit-1", kind: "exit", position: { x: map.width - 1, y: ACCESS_ROW } },
    ],
    routeGuidePoints: [],
    baseWidth: LAUNCH_WIDTH,
    baseHeight: LAUNCH_HEIGHT,
    frame,
    ...overrides,
  };
}

describe("hall floor painter", () => {
  it("paints the launch hall in every frame at the map size plus the margin", () => {
    for (const [name, frame] of Object.entries(FRAMES)) {
      const painted = record_paint(floor_spec(launch_map(), frame));

      expect(painted.width, name).toBe(LAUNCH_WIDTH * 48 + FLOOR_MARGIN * 2);
      expect(painted.height, name).toBe(LAUNCH_HEIGHT * 48 + FLOOR_MARGIN * 2);
      expect(painted.log.length, name).toBeGreaterThan(1000);
    }
  });

  it("paints each frame differently", () => {
    const digests = Object.values(FRAMES).map((frame) =>
      record_paint(floor_spec(launch_map(), frame)).digest(),
    );

    expect(new Set(digests).size).toBe(digests.length);
  });

  it("paints the same spec twice to the same calls", () => {
    const spec = floor_spec(launch_map(), FRAMES.default as PaintFrame, {
      routeGuidePoints: [
        { x: 3, y: ACCESS_ROW },
        { x: 4, y: ACCESS_ROW },
      ],
    });

    expect(record_paint(spec).digest()).toBe(record_paint(spec).digest());
  });

  it("paints route lanes, gates and expansion bays as distinct floors", () => {
    for (const [name, frame] of Object.entries(FRAMES)) {
      const variants = [
        floor_spec(launch_map(), frame),
        floor_spec(launch_map(), frame, {
          routeGuidePoints: [
            { x: 3, y: ACCESS_ROW },
            { x: 4, y: ACCESS_ROW },
            { x: 4, y: ACCESS_ROW + 1 },
          ],
        }),
        floor_spec(launch_map(), frame, { routeGuidePoints: [{ x: 9, y: 9 }] }),
        floor_spec(launch_map(), frame, {
          accessPoints: [
            { id: "entrance-1", kind: "entrance", position: { x: 0, y: ACCESS_ROW } },
            { id: "exit-1", kind: "exit", position: { x: LAUNCH_WIDTH - 1, y: ACCESS_ROW } },
            { id: "entrance-2", kind: "entrance", position: { x: 10, y: LAUNCH_HEIGHT - 1 } },
            { id: "exit-2", kind: "exit", position: { x: 6, y: 0 } },
          ],
        }),
        floor_spec(expandGridMap(launch_map(), 4, 2), frame),
      ];
      const digests = variants.map((spec) => record_paint(spec).digest());

      expect(new Set(digests).size, name).toBe(digests.length);
    }
  });

  it("paints a gate the same whether its tile is marked wall or floor", () => {
    const frame = FRAMES.default as PaintFrame;

    expect(record_paint(floor_spec(launch_map("wall"), frame)).digest()).toBe(
      record_paint(floor_spec(launch_map("floor"), frame)).digest(),
    );
  });

  it("raises every north-wall pillar inside the texture", () => {
    for (const map of [launch_map(), expandGridMap(launch_map(), 4, 2)]) {
      const spec = floor_spec(map, FRAMES.default as PaintFrame);
      const width = map.width * 48 + FLOOR_MARGIN * 2;
      const pillars = pillar_positions(build_floor_grid(spec));

      expect(pillars.length).toBeGreaterThanOrEqual(2);
      for (const centre_x of pillars) {
        expect(centre_x).toBeGreaterThan(0);
        expect(centre_x).toBeLessThan(width);
      }
      expect(tile_top(1) - PILLAR_HEIGHT).toBeGreaterThanOrEqual(0);
    }
  });

  it("paints a map without walls or gates", () => {
    const map = createGridMap(6, 4, { tileSize: 48 });
    const painted = record_paint(
      floor_spec(map, FRAMES.default as PaintFrame, { accessPoints: [] }),
    );

    expect(painted.log.length).toBeGreaterThan(0);
  });
});
