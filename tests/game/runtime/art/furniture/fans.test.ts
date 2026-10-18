/**
 * Draw-output tests for the fan painters in `runtime/art/furniture/fans.ts`.
 *
 * Every launch fan is painted into a recording context at every rotation, paint frame and
 * motion frame, and the digests of the recorded calls prove that each fan paints, stays inside
 * its texture, differs from the other fans, repeats exactly, turns its rotor through six
 * distinct frames, and that the wall fan and the exhaust change with their rotation. The drum
 * fan's layout is checked to keep it at real-world scale, no taller than a tall guest.
 */
import { describe, expect, it } from "vitest";

import { PLACEABLES } from "@/src/content";
import type { Rotation } from "@/src/game/core";
import { FAN_MOTION_FRAMES } from "@/src/game/runtime/art/furniture";
import { drum_fan_layout, paint_fan } from "@/src/game/runtime/art/furniture/fans";
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
/** The tallest a guest is painted, in world pixels. */
const TALLEST_GUEST = 44;
/** Every placement rotation. */
const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
/** The default, high-contrast and low-detail frames. */
const FRAMES: readonly PaintFrame[] = [
  { isHighContrast: false, isLowDetail: false },
  { isHighContrast: true, isLowDetail: false },
  { isHighContrast: false, isLowDetail: true },
];
/** The launch fans. */
const FANS = PLACEABLES.filter((item) => item.category === "fan");
/** The fans whose rotor or airflow turns with the motion frame. */
const ROTOR_FANS = [
  "item.wall-circulation-fan",
  "item.ceiling-fan",
  "item.high-volume-air-fan",
  "item.quiet-corner-fan",
];
/** The fans that stay still whatever the motion frame. */
const STILL_FANS = ["item.column-fan", "item.stall-exhaust-booster"];

/**
 * Builds the paint spec of a fan.
 *
 * @param item - The content definition.
 * @param rotation - The placement rotation.
 * @param frame - The paint frame.
 * @param motion - The motion frame.
 * @returns The spec, sized to the rotated footprint.
 */
function fan_spec(
  item: (typeof FANS)[number],
  rotation: Rotation = 0,
  frame: PaintFrame = FRAMES[0] as PaintFrame,
  motion = 0,
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
    motion,
    frame,
  };
}

/**
 * Paints a spec with the fan painter, passing its motion frame and rotation.
 *
 * @param spec - The spec.
 * @returns The recording.
 */
function paint(spec: PlaceablePaintSpec): RecordingContext {
  const recording = create_recording_context();
  paint_fan(
    recording.ctx,
    footprint_box(spec),
    spec.recipe,
    spec.motion,
    spec.frame,
    spec.rotation,
  );
  return recording;
}

/**
 * Finds a fan by content ID.
 *
 * @param id - The content ID.
 * @returns The definition.
 */
function fan(id: string): (typeof FANS)[number] {
  const item = FANS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing fan ${id}`);
  return item;
}

describe("fan painters", () => {
  it("covers the six launch fans", () => {
    expect(FANS.map((item) => item.id).sort()).toEqual([...ROTOR_FANS, ...STILL_FANS].sort());
  });

  it("paints every fan at every rotation, frame and motion frame, clipped to its texture", () => {
    for (const item of FANS) {
      for (const rotation of ROTATIONS) {
        for (const frame of FRAMES) {
          for (let motion = 0; motion < FAN_MOTION_FRAMES; motion += 1) {
            const spec = fan_spec(item, rotation, frame, motion);
            const { log } = paint(spec);

            expect(log.length, `${item.id} r${rotation} m${motion}`).toBeGreaterThan(20);
            expect(log.slice(0, 4), `${item.id} r${rotation}`).toEqual([
              JSON.stringify(["save"]),
              JSON.stringify(["beginPath"]),
              JSON.stringify(["rect", 0, 0, spec.width, spec.height + OVERHANG]),
              JSON.stringify(["clip"]),
            ]);
          }
        }
      }
    }
  });

  it("paints every fan differently from the others", () => {
    const digests = FANS.map((item) => paint(fan_spec(item)).digest());

    expect(new Set(digests).size).toBe(FANS.length);
  });

  it("paints the same spec identically twice", () => {
    for (const item of FANS) {
      for (const rotation of ROTATIONS) {
        const spec = fan_spec(item, rotation);

        expect(paint(spec).digest(), `${item.id} r${rotation}`).toBe(paint(spec).digest());
      }
    }
  });

  it("turns each rotor through six distinct motion frames", () => {
    for (const id of ROTOR_FANS) {
      const item = fan(id);
      const digests = Array.from({ length: FAN_MOTION_FRAMES }, (_, motion) =>
        paint(fan_spec(item, 0, FRAMES[0], motion)).digest(),
      );

      expect(new Set(digests).size, id).toBe(FAN_MOTION_FRAMES);
    }
  });

  it("keeps the column fan and the exhaust still across motion frames", () => {
    for (const id of STILL_FANS) {
      const item = fan(id);

      expect(paint(fan_spec(item, 0, FRAMES[0], 3)).digest(), id).toBe(
        paint(fan_spec(item, 0, FRAMES[0], 0)).digest(),
      );
    }
  });

  it("mounts the wall fan on the edge each rotation turns it to", () => {
    const item = fan("item.wall-circulation-fan");
    const digests = ROTATIONS.map((rotation) => paint(fan_spec(item, rotation)).digest());

    expect(new Set(digests).size).toBe(ROTATIONS.length);
  });

  it("lays the exhaust booster along its footprint's long side", () => {
    const item = fan("item.stall-exhaust-booster");

    expect(paint(fan_spec(item, 90)).digest()).not.toBe(paint(fan_spec(item, 0)).digest());
  });

  it("keeps the drum fan at real-world scale, no taller than a tall guest", () => {
    const item = fan("item.high-volume-air-fan");
    for (const rotation of ROTATIONS) {
      const box = footprint_box(fan_spec(item, rotation));
      const layout = drum_fan_layout(box);

      expect(layout.floor_y - layout.top_y, `r${rotation}`).toBeLessThanOrEqual(TALLEST_GUEST);
      expect(layout.top_y, `r${rotation}`).toBeGreaterThanOrEqual(box.y - OVERHANG);
      expect(layout.floor_y, `r${rotation}`).toBeLessThanOrEqual(box.bottom);
    }
  });

  it("paints every fan through the placeable plan", () => {
    for (const item of FANS) {
      const spec = fan_spec(item);
      const recording = record_paint(spec);

      expect(recording.height, item.id).toBe(spec.height + OVERHANG);
      expect(recording.log.length, item.id).toBeGreaterThan(20);
    }
  });
});
