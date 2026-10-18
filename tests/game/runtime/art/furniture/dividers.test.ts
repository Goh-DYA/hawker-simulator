/**
 * Draw-output tests for the divider painter in `runtime/art/furniture/dividers.ts`: every
 * launch divider paints at every frame and rotation, each divider paints differently from the
 * others, the output is deterministic, and a divider turned north-south is painted end-on
 * (differently from its east-west form, and differently again for each visible side).
 */
import { describe, expect, it } from "vitest";

import { paint_divider } from "@/src/game/runtime/art/furniture/dividers";

import { record_paint } from "../fixtures";
import {
  ALL_ROTATIONS,
  launch_items,
  PAINT_FRAMES,
  paint_with,
  placeable_spec,
} from "./standing_fixtures";

const DIVIDERS = launch_items("divider");

describe("paint_divider", () => {
  it("covers the six launch dividers", () => {
    expect(DIVIDERS).toHaveLength(6);
  });

  it("paints every divider at every frame and rotation", () => {
    for (const item of DIVIDERS) {
      for (const frame of PAINT_FRAMES) {
        for (const rotation of ALL_ROTATIONS) {
          const { calls } = paint_with(paint_divider, placeable_spec(item, rotation, frame));

          expect(calls, `${item.id} r${rotation}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it("paints through the furniture dispatcher", () => {
    for (const item of DIVIDERS) {
      expect(record_paint(placeable_spec(item)).log.length, item.id).toBeGreaterThan(20);
    }
  });

  it("paints each divider differently from every other divider", () => {
    const digests = DIVIDERS.map((item) => paint_with(paint_divider, placeable_spec(item)).digest);

    expect(new Set(digests).size).toBe(DIVIDERS.length);
  });

  it("paints the same spec the same way twice", () => {
    for (const item of DIVIDERS) {
      const spec = placeable_spec(item, 270);

      expect(paint_with(paint_divider, spec).digest).toBe(paint_with(paint_divider, spec).digest);
    }
  });

  it("paints a north-south divider end-on, showing the side its front was turned to", () => {
    for (const item of DIVIDERS) {
      const east_west = paint_with(paint_divider, placeable_spec(item, 0)).digest;
      const west_side = paint_with(paint_divider, placeable_spec(item, 90)).digest;
      const east_side = paint_with(paint_divider, placeable_spec(item, 270)).digest;

      expect(west_side, item.id).not.toBe(east_west);
      expect(east_side, item.id).not.toBe(east_west);
      expect(east_side, item.id).not.toBe(west_side);
    }
  });
});
