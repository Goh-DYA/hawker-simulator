/**
 * Tests for the shared ambience helpers in `runtime/art/furniture/ambience.ts` and the curve
 * helper in `foliage.ts`: the orientation rule for linear objects, the real-world height scale and
 * the frond curve points.
 */
import { describe, expect, it } from "vitest";

import type { Rotation } from "@/src/game/core";
import {
  PX_PER_METRE,
  resolve_linear_rotation,
  standing_height,
} from "@/src/game/runtime/art/furniture/ambience";
import { curve_point } from "@/src/game/runtime/art/furniture/foliage";
import type { Box } from "@/src/game/runtime/art/furniture/shared";

/**
 * Builds a footprint box of a size.
 *
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @returns The box, with its top at the overhang.
 */
function box_of(width: number, height: number): Box {
  return {
    x: 0,
    y: 16,
    width,
    height,
    centreX: width / 2,
    centreY: 16 + height / 2,
    right: width,
    bottom: 16 + height,
  };
}

describe("resolve_linear_rotation", () => {
  it("keeps a rotation that already matches the box", () => {
    const cases: readonly (readonly [Box, Rotation])[] = [
      [box_of(96, 48), 0],
      [box_of(96, 48), 180],
      [box_of(48, 96), 90],
      [box_of(48, 96), 270],
      [box_of(48, 48), 90],
    ];
    for (const [box, rotation] of cases) {
      expect(resolve_linear_rotation(box, rotation)).toBe(rotation);
    }
  });

  it("turns a rotation that disagrees with the box to follow its long side", () => {
    expect(resolve_linear_rotation(box_of(48, 96), 0)).toBe(90);
    expect(resolve_linear_rotation(box_of(48, 96), 180)).toBe(270);
    expect(resolve_linear_rotation(box_of(96, 48), 90)).toBe(0);
    expect(resolve_linear_rotation(box_of(96, 48), 270)).toBe(180);
  });
});

describe("curve_point", () => {
  it("starts and ends on the curve's end points with unit tangents", () => {
    const curve = { from: [2, 40], control: [10, 4], to: [30, 20] } as const;
    const start = curve_point(curve, 0);
    const end = curve_point(curve, 1);

    expect([start.x, start.y]).toEqual([2, 40]);
    expect([end.x, end.y]).toEqual([30, 20]);
    expect(Math.hypot(start.tx, start.ty)).toBeCloseTo(1, 9);
    expect(Math.hypot(end.tx, end.ty)).toBeCloseTo(1, 9);
  });
});

describe("standing_height", () => {
  it("puts a guest-sized height in the 34 to 44 px range the people are painted at", () => {
    expect(standing_height(1.6)).toBeGreaterThanOrEqual(34);
    expect(standing_height(1.9)).toBeLessThanOrEqual(44);
  });

  it("rounds a height in metres to whole pixels at the shared scale", () => {
    expect(standing_height(0)).toBe(0);
    expect(standing_height(1)).toBe(PX_PER_METRE);
    expect(Number.isInteger(standing_height(0.7))).toBe(true);
  });
});
