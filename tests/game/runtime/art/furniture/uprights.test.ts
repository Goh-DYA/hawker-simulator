/**
 * Tests for the shared upright construction in `runtime/art/furniture/uprights.ts`: the arrow
 * heading and visible side each rotation gives, the wall placement and face geometry, which
 * must keep every face inside the texture and inside the footprint's sides, and the floor line
 * under a hung piece.
 */
import { describe, expect, it } from "vitest";

import type { Rotation } from "@/src/game/core";
import type { Box } from "@/src/game/runtime/art/furniture/shared";
import {
  east_west_faces,
  east_west_wall,
  heading_for_rotation,
  hung_floor_line,
  is_north_south,
  north_south_faces,
  north_south_wall,
  side_for_rotation,
  type Rect,
} from "@/src/game/runtime/art/furniture/uprights";
import { OVERHANG } from "@/src/game/runtime/art/specs";

/**
 * Builds the footprint box of a texture-sized footprint.
 *
 * @param width - Footprint width in pixels.
 * @param height - Footprint height in pixels.
 * @returns The box, with its top at the overhang.
 */
function box_of(width: number, height: number): Box {
  return {
    x: 0,
    y: OVERHANG,
    width,
    height,
    centreX: width / 2,
    centreY: OVERHANG + height / 2,
    right: width,
    bottom: OVERHANG + height,
  };
}

/**
 * Asserts that a rectangle lies inside a footprint's texture.
 *
 * @param rect - The rectangle.
 * @param box - The footprint box.
 * @param label - The assertion label.
 */
function expect_inside(rect: Rect, box: Box, label: string): void {
  expect(rect.x, label).toBeGreaterThanOrEqual(box.x);
  expect(rect.x + rect.width, label).toBeLessThanOrEqual(box.right);
  expect(rect.y, label).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height, label).toBeLessThanOrEqual(box.bottom);
}

/** Heights and thicknesses that span the launch dividers, mural and clock. */
const WALL_SIZES = [
  [5, 21],
  [9, 24],
  [3, 30],
  [20, 12],
  [5, 34],
  [7, 36],
] as const;

describe("heading_for_rotation", () => {
  it("turns an east-pointing arrow clockwise with each quarter turn", () => {
    const rotations: readonly Rotation[] = [0, 90, 180, 270];

    expect(rotations.map(heading_for_rotation)).toEqual(["east", "south", "west", "north"]);
  });
});

describe("side_for_rotation", () => {
  it("shows the west side at 90 and the east side at 270", () => {
    expect(side_for_rotation(90)).toBe("west");
    expect(side_for_rotation(270)).toBe("east");
    expect(is_north_south(90) && is_north_south(270)).toBe(true);
    expect(is_north_south(0) || is_north_south(180)).toBe(false);
  });
});

describe("wall faces", () => {
  it("keeps an east-west piece's faces inside its texture", () => {
    for (const width of [96, 144, 192]) {
      const box = box_of(width, 48);
      for (const [thickness, height] of WALL_SIZES) {
        const faces = east_west_faces(east_west_wall(box, thickness, height));

        expect_inside(faces.top, box, `top ${width} ${thickness}x${height}`);
        expect_inside(faces.front, box, `front ${width} ${thickness}x${height}`);
      }
    }
  });

  it("keeps a north-south piece's faces inside its texture", () => {
    for (const length of [96, 144, 192]) {
      const box = box_of(48, length);
      for (const [thickness, height] of WALL_SIZES) {
        for (const rotation of [90, 270] as const) {
          const faces = north_south_faces(north_south_wall(box, thickness, height, rotation));
          const label = `${length} ${thickness}x${height} r${rotation}`;

          expect_inside(faces.top, box, `top ${label}`);
          expect_inside(faces.front, box, `front ${label}`);
          expect_inside(faces.side, box, `side ${label}`);
        }
      }
    }
  });

  it("stands a north-south piece's end face on its south ground line", () => {
    const wall = north_south_wall(box_of(48, 144), 9, 24, 90);
    const faces = north_south_faces(wall);

    expect(faces.front.y + faces.front.height).toBe(wall.south);
    expect(faces.top.y + faces.top.height).toBe(faces.front.y);
  });
});

describe("hung_floor_line", () => {
  it("puts a hung piece's shadow below the piece and inside the footprint", () => {
    for (const [width, height] of [
      [48, 48],
      [96, 48],
      [48, 192],
    ] as const) {
      const box = box_of(width, height);
      for (const bottom of [29, 35, 38]) {
        const floor = hung_floor_line(box, bottom);

        expect(floor, `${width}x${height} ${bottom}`).toBeGreaterThan(bottom);
        expect(floor + 7, `${width}x${height} ${bottom}`).toBeLessThanOrEqual(box.bottom);
      }
    }
  });
});
