/**
 * Draw-output tests for the lighting painters in `runtime/art/furniture/lighting.ts`.
 *
 * Every launch fitting is painted into a recording context at every rotation and paint frame,
 * and the digests of the recorded calls prove that each fitting paints, stays inside its
 * texture, differs from the other fittings, repeats exactly, and that the directional and
 * linear fittings change with their rotation. The walk-through task light's layout is checked
 * to stay against one edge of its footprint, clear of the tile centres where guests cross.
 */
import { describe, expect, it } from "vitest";

import { PLACEABLES } from "@/src/content";
import type { Rotation } from "@/src/game/core";
import { paint_lighting, task_light_layout } from "@/src/game/runtime/art/furniture/lighting";
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
/** Every placement rotation. */
const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
/** The default, high-contrast and low-detail frames. */
const FRAMES: readonly PaintFrame[] = [
  { isHighContrast: false, isLowDetail: false },
  { isHighContrast: true, isLowDetail: false },
  { isHighContrast: false, isLowDetail: true },
];
/** How far in from its edge the walk-through task light may reach (a tile centre is at 24). */
const TASK_LIGHT_EDGE_STRIP = 16;
/** Half the width of a task light clamp base. */
const CLAMP_HALF = 5;
/** The radius of a task light's arm joints, with room for the arm's stroke. */
const JOINT_RADIUS = 2.5;
/** The launch lighting fittings. */
const LIGHTING = PLACEABLES.filter((item) => item.category === "lighting");

/**
 * Builds the paint spec of a lighting fitting.
 *
 * @param item - The content definition.
 * @param rotation - The placement rotation.
 * @param frame - The paint frame.
 * @returns The spec, sized to the rotated footprint.
 */
function lighting_spec(
  item: (typeof LIGHTING)[number],
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
 * Paints a spec with the lighting painter, passing its rotation.
 *
 * @param spec - The spec.
 * @returns The recording.
 */
function paint(spec: PlaceablePaintSpec): RecordingContext {
  const recording = create_recording_context();
  paint_lighting(recording.ctx, footprint_box(spec), spec.recipe, spec.frame, spec.rotation);
  return recording;
}

/**
 * Finds a fitting by content ID.
 *
 * @param id - The content ID.
 * @returns The definition.
 */
function fitting(id: string): (typeof LIGHTING)[number] {
  const item = LIGHTING.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing lighting fitting ${id}`);
  return item;
}

describe("lighting painters", () => {
  it("covers the seven launch fittings", () => {
    expect(LIGHTING).toHaveLength(7);
  });

  it("paints every fitting at every rotation and frame, clipped to its texture", () => {
    for (const item of LIGHTING) {
      for (const rotation of ROTATIONS) {
        for (const frame of FRAMES) {
          const spec = lighting_spec(item, rotation, frame);
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

  it("paints every fitting differently from the others", () => {
    const digests = LIGHTING.map((item) => paint(lighting_spec(item)).digest());

    expect(new Set(digests).size).toBe(LIGHTING.length);
  });

  it("paints the same spec identically twice", () => {
    for (const item of LIGHTING) {
      for (const rotation of ROTATIONS) {
        const spec = lighting_spec(item, rotation);

        expect(paint(spec).digest(), `${item.id} r${rotation}`).toBe(paint(spec).digest());
      }
    }
  });

  it("turns the task light to face each rotation", () => {
    const item = fitting("item.counter-task-light");
    const digests = ROTATIONS.map((rotation) => paint(lighting_spec(item, rotation)).digest());

    expect(new Set(digests).size).toBe(ROTATIONS.length);
  });

  it("tucks the walk-through task light against one edge, clear of the tile centres", () => {
    const item = fitting("item.counter-task-light");
    for (const rotation of ROTATIONS) {
      const box = footprint_box(lighting_spec(item, rotation));
      const layout = task_light_layout(box, rotation);
      const { bar } = layout;
      const parts = [
        ...layout.bases.map(([x, y]) => [x, y, CLAMP_HALF] as const),
        ...[...layout.elbows, ...layout.heads].map(([x, y]) => [x, y, JOINT_RADIUS] as const),
      ];

      if (rotation === 0 || rotation === 180) {
        const lowest = Math.max(bar.y + bar.height, ...parts.map(([, y, r]) => y + r));
        expect(lowest, `r${rotation}`).toBeLessThanOrEqual(box.y + TASK_LIGHT_EDGE_STRIP);
      } else if (rotation === 90) {
        const furthest = Math.max(bar.x + bar.width, ...parts.map(([x, , r]) => x + r));
        expect(furthest, `r${rotation}`).toBeLessThanOrEqual(box.x + TASK_LIGHT_EDGE_STRIP);
      } else {
        const furthest = Math.min(bar.x, ...parts.map(([x, , r]) => x - r));
        expect(furthest, `r${rotation}`).toBeGreaterThanOrEqual(box.right - TASK_LIGHT_EDGE_STRIP);
      }
    }
  });

  it("lays the batten and the string lights along their footprint's long side", () => {
    for (const id of ["item.ceiling-tube-light", "item.festive-string-lights"]) {
      const item = fitting(id);

      expect(paint(lighting_spec(item, 90)).digest(), id).not.toBe(
        paint(lighting_spec(item, 0)).digest(),
      );
    }
  });

  it("paints every fitting through the placeable plan", () => {
    for (const item of LIGHTING) {
      const spec = lighting_spec(item);
      const recording = record_paint(spec);

      expect(recording.height, item.id).toBe(spec.height + OVERHANG);
      expect(recording.log.length, item.id).toBeGreaterThan(20);
    }
  });
});
