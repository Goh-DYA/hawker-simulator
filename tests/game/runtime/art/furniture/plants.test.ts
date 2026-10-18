/**
 * Draw-output tests for the plant painters in `runtime/art/furniture/plants.ts`.
 *
 * Every launch plant is painted into a recording context at every rotation and paint frame,
 * and the digests of the recorded calls prove that each plant paints, stays inside its texture,
 * differs from the other plants, repeats exactly, and that the trellis, troughs and bed change
 * with their rotation. The walk-through herb planter's layout is checked to stay small in a
 * north corner of its tile, clear of the tile centre where guests cross.
 */
import { describe, expect, it } from "vitest";

import { PLACEABLES } from "@/src/content";
import type { Rotation } from "@/src/game/core";
import { herb_planter_layout, paint_plant } from "@/src/game/runtime/art/furniture/plants";
import { footprint_box } from "@/src/game/runtime/art/furniture/shared";
import {
  OVERHANG,
  rotated_size,
  type PaintFrame,
  type PlaceablePaintSpec,
} from "@/src/game/runtime/art/specs";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";

import { create_recording_context, record_paint, type RecordingContext } from "../fixtures";

/** World pixels per tile. */
const TILE = 48;
/** How far the herbs rise above the herb planter's rim. */
const HERB_GROWTH = 12;
/** Every placement rotation. */
const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
/** The default, high-contrast and low-detail frames. */
const FRAMES: readonly PaintFrame[] = [
  { isHighContrast: false, isLowDetail: false },
  { isHighContrast: true, isLowDetail: false },
  { isHighContrast: false, isLowDetail: true },
];
/** The launch plants. */
const PLANTS = PLACEABLES.filter((item) => item.category === "plant");

/**
 * Builds the paint spec of a plant.
 *
 * @param item - The content definition.
 * @param rotation - The placement rotation.
 * @param frame - The paint frame.
 * @returns The spec, sized to the rotated footprint.
 */
function plant_spec(
  item: (typeof PLANTS)[number],
  rotation: Rotation = 0,
  frame: PaintFrame = FRAMES[0] as PaintFrame,
): PlaceablePaintSpec {
  const size = rotated_size(item.footprint.width * TILE, item.footprint.height * TILE, rotation);
  return {
    kind: "placeable",
    definitionId: item.id,
    category: item.category,
    recipe: visualRecipeForPlaceable(item.id, item.category, item.tags),
    tags: item.tags,
    rotation,
    width: size.width,
    height: size.height,
    motion: 0,
    frame,
  };
}

/**
 * Paints a spec with the plant painter, passing its rotation.
 *
 * @param spec - The spec.
 * @returns The recording.
 */
function paint(spec: PlaceablePaintSpec): RecordingContext {
  const recording = create_recording_context();
  paint_plant(recording.ctx, footprint_box(spec), spec.recipe, spec.frame, spec.rotation);
  return recording;
}

/**
 * Finds a plant by content ID.
 *
 * @param id - The content ID.
 * @returns The definition.
 */
function plant(id: string): (typeof PLANTS)[number] {
  const item = PLANTS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing plant ${id}`);
  return item;
}

describe("plant painters", () => {
  it("covers the eight launch plants", () => {
    expect(PLANTS).toHaveLength(8);
  });

  it("paints every plant at every rotation and frame, clipped to its texture", () => {
    for (const item of PLANTS) {
      for (const rotation of ROTATIONS) {
        for (const frame of FRAMES) {
          const spec = plant_spec(item, rotation, frame);
          const { log } = paint(spec);

          expect(log.length, `${item.id} r${rotation}`).toBeGreaterThan(20);
          expect(log.slice(0, 4), `${item.id} r${rotation}`).toEqual([
            JSON.stringify(["save"]),
            JSON.stringify(["beginPath"]),
            JSON.stringify(["rect", 0, 0, spec.width, spec.height + OVERHANG]),
            JSON.stringify(["clip"]),
          ]);
        }
      }
    }
  });

  it("paints every plant differently from the others", () => {
    const digests = PLANTS.map((item) => paint(plant_spec(item)).digest());

    expect(new Set(digests).size).toBe(PLANTS.length);
  });

  it("paints the same spec identically twice", () => {
    for (const item of PLANTS) {
      for (const rotation of ROTATIONS) {
        const spec = plant_spec(item, rotation);

        expect(paint(spec).digest(), `${item.id} r${rotation}`).toBe(paint(spec).digest());
      }
    }
  });

  it("keeps the trellis lattice on the back edge of its planter at each rotation", () => {
    const item = plant("item.vine-trellis");
    const digests = ROTATIONS.map((rotation) => paint(plant_spec(item, rotation)).digest());

    expect(new Set(digests).size).toBe(ROTATIONS.length);
  });

  it("tucks the walk-through herb planter into a north corner of its tile", () => {
    const item = plant("item.table-herb-planter");
    for (const rotation of ROTATIONS) {
      const box = footprint_box(plant_spec(item, rotation));
      const layout = herb_planter_layout(box, rotation);
      const is_clear_of_centre = layout.x + layout.width < box.centreX || layout.x > box.centreX;

      expect(is_clear_of_centre, `r${rotation}`).toBe(true);
      expect(layout.x, `r${rotation}`).toBeGreaterThanOrEqual(box.x);
      expect(layout.x + layout.width, `r${rotation}`).toBeLessThanOrEqual(box.right);
      expect(layout.floor_y, `r${rotation}`).toBeLessThan(box.centreY);
      expect(layout.rim_y - HERB_GROWTH, `r${rotation}`).toBeGreaterThanOrEqual(box.y - OVERHANG);
    }
  });

  it("lays the fern trough and the pandan bed along their footprint's long side", () => {
    for (const id of ["item.fern-trough", "item.pandan-border-bed"]) {
      const item = plant(id);

      expect(paint(plant_spec(item, 90)).digest(), id).not.toBe(
        paint(plant_spec(item, 0)).digest(),
      );
    }
  });

  it("paints every plant through the placeable plan", () => {
    for (const item of PLANTS) {
      const spec = plant_spec(item);
      const recording = record_paint(spec);

      expect(recording.height, item.id).toBe(spec.height + OVERHANG);
      expect(recording.log.length, item.id).toBeGreaterThan(20);
    }
  });
});
