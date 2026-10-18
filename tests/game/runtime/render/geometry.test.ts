/**
 * Tests for the renderer geometry in `runtime/render/geometry.ts`: depth bands keep their order
 * and the rendered customer position follows movement progress.
 */
import { describe, expect, it } from "vitest";

import {
  DEPTH_OVERHEAD,
  DEPTH_WORLD,
  depth_for,
  renderedCustomerPosition,
} from "@/src/game/runtime/render/geometry";

describe("depth_for", () => {
  it("sorts lower objects in front and keeps overhead fittings above every standing object", () => {
    expect(depth_for(DEPTH_WORLD, 100)).toBeLessThan(depth_for(DEPTH_WORLD, 148));
    expect(depth_for(DEPTH_WORLD, 100, 0.00001)).toBeGreaterThan(depth_for(DEPTH_WORLD, 100));
    expect(depth_for(DEPTH_OVERHEAD, 0)).toBeGreaterThan(depth_for(DEPTH_WORLD, 100_000));
  });
});

describe("renderedCustomerPosition", () => {
  const customer = {
    id: "customer-1",
    position: { x: 2, y: 3 },
    path: [
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ],
    pathIndex: 1,
    movementProgress: 0.25,
  };

  it("interpolates towards the next path tile by the movement progress", () => {
    expect(renderedCustomerPosition(customer, false)).toEqual({ x: 2.25, y: 3 });
  });

  it("snaps to the tile under reduced motion or without a next tile", () => {
    expect(renderedCustomerPosition(customer, true)).toEqual({ x: 2, y: 3 });
    expect(renderedCustomerPosition({ ...customer, pathIndex: 2 }, false)).toEqual({ x: 2, y: 3 });
    expect(renderedCustomerPosition({ ...customer, movementProgress: 1.7 }, false)).toEqual({
      x: 3,
      y: 3,
    });
  });
});
