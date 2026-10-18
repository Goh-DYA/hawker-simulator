/**
 * Draw-output tests for the decor painter in `runtime/art/furniture/decor.ts`: every launch
 * decor piece paints at every frame and rotation, each piece paints differently from the others,
 * the output is deterministic, long pieces change form when they run north-south, the symmetric
 * flower vase ignores the rotation, the hung panels hang high and keep their height at every
 * rotation, and the vase stands small in its tile's north-west corner.
 */
import { describe, expect, it } from "vitest";

import { TILE } from "@/src/game/runtime/art/canvas";
import {
  hung_decor_panel,
  paint_decor,
  vase_layout,
  type HungDecor,
} from "@/src/game/runtime/art/furniture/decor";
import { footprint_box } from "@/src/game/runtime/art/furniture/shared";
import { OVERHANG } from "@/src/game/runtime/art/specs";

import { record_paint } from "../fixtures";
import {
  ALL_ROTATIONS,
  launch_items,
  PAINT_FRAMES,
  paint_with,
  placeable_spec,
} from "./standing_fixtures";

const DECOR = launch_items("decor");

/** The hung panel each panel-like decor piece is painted as. */
const HUNG_PANELS: Readonly<Record<string, HungDecor>> = {
  "item.geometric-tile-mural": "mural",
  "item.community-noticeboard": "noticeboard",
  "item.feature-centre-clock": "clock",
};

/**
 * Finds a launch decor piece by ID.
 *
 * @param id - The content ID.
 * @returns The piece.
 */
function decor_item(id: string): (typeof DECOR)[number] {
  const item = DECOR.find((decor) => decor.id === id);
  if (!item) throw new Error(`missing ${id}`);
  return item;
}

describe("paint_decor", () => {
  it("covers the five launch decor pieces", () => {
    expect(DECOR).toHaveLength(5);
  });

  it("paints every piece at every frame and rotation", () => {
    for (const item of DECOR) {
      for (const frame of PAINT_FRAMES) {
        for (const rotation of ALL_ROTATIONS) {
          const { calls } = paint_with(paint_decor, placeable_spec(item, rotation, frame));

          expect(calls, `${item.id} r${rotation}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it("paints through the furniture dispatcher", () => {
    for (const item of DECOR) {
      expect(record_paint(placeable_spec(item)).log.length, item.id).toBeGreaterThan(20);
    }
  });

  it("paints each piece differently from every other piece", () => {
    const digests = DECOR.map((item) => paint_with(paint_decor, placeable_spec(item)).digest);

    expect(new Set(digests).size).toBe(DECOR.length);
  });

  it("paints the same spec the same way twice", () => {
    for (const item of DECOR) {
      const spec = placeable_spec(item, 90);

      expect(paint_with(paint_decor, spec).digest).toBe(paint_with(paint_decor, spec).digest);
    }
  });

  it("changes a long piece's form when it runs north-south", () => {
    for (const item of DECOR.filter((decor) => decor.footprint.width > 1)) {
      const east_west = paint_with(paint_decor, placeable_spec(item, 0)).digest;
      const north_south = paint_with(paint_decor, placeable_spec(item, 90)).digest;

      expect(north_south, item.id).not.toBe(east_west);
    }
  });

  it("paints the flower vase the same at every rotation", () => {
    const vase = DECOR.find((decor) => decor.id === "item.tabletop-flower-vase");
    if (!vase) throw new Error("missing vase");
    const digests = ALL_ROTATIONS.map(
      (rotation) => paint_with(paint_decor, placeable_spec(vase, rotation)).digest,
    );

    expect(new Set(digests).size).toBe(1);
  });
});

describe("hung_decor_panel", () => {
  it("hangs each panel high in the texture at every rotation", () => {
    for (const [id, kind] of Object.entries(HUNG_PANELS)) {
      for (const rotation of ALL_ROTATIONS) {
        const spec = placeable_spec(decor_item(id), rotation);
        const panel = hung_decor_panel(footprint_box(spec), kind);
        const label = `${id} r${rotation}`;

        expect(panel.x, label).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width, label).toBeLessThanOrEqual(spec.width);
        expect(panel.y - 3, label).toBeGreaterThanOrEqual(0);
        expect(panel.y + panel.height, label).toBeLessThanOrEqual(OVERHANG + TILE / 2);
      }
    }
  });

  it("keeps each panel's height at every rotation", () => {
    for (const [id, kind] of Object.entries(HUNG_PANELS)) {
      const heights = ALL_ROTATIONS.map(
        (rotation) =>
          hung_decor_panel(footprint_box(placeable_spec(decor_item(id), rotation)), kind).height,
      );

      expect(new Set(heights).size, id).toBe(1);
    }
  });
});

describe("vase_layout", () => {
  const box = footprint_box(placeable_spec(decor_item("item.tabletop-flower-vase")));
  const layout = vase_layout(box);

  it("tucks the stand into the tile's north-west corner", () => {
    expect(layout.cx - layout.standRadius).toBeGreaterThanOrEqual(box.x);
    expect(layout.cx + layout.standRadius).toBeLessThanOrEqual(box.x + TILE * 0.375);
    expect(layout.floorY).toBeLessThanOrEqual(box.y + TILE / 3);
  });

  it("sizes the vase and its blooms at tabletop scale", () => {
    expect(layout.surfaceY - layout.mouthY).toBeGreaterThanOrEqual(5);
    expect(layout.surfaceY - layout.mouthY).toBeLessThanOrEqual(6);
    expect(layout.surfaceY - layout.bloomTopY).toBeCloseTo(10, 0);
    expect(layout.bloomTopY).toBeGreaterThanOrEqual(0);
  });
});
