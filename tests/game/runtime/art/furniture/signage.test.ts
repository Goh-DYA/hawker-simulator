/**
 * Draw-output tests for the signage painter in `runtime/art/furniture/signage.ts`: every launch
 * sign paints at every frame and rotation, each sign paints differently from the others, the
 * output is deterministic, directional signs turn their arrows with the rotation, and the
 * exported layout keeps every panel, post and base inside the texture, hangs the walk-under signs
 * high from the ceiling, and keeps each sign's panel height at every rotation.
 */
import { describe, expect, it } from "vitest";

import type { Rotation } from "@/src/game/core";
import { TILE } from "@/src/game/runtime/art/canvas";
import { paint_signage, signage_layout } from "@/src/game/runtime/art/furniture/signage";
import { footprint_box } from "@/src/game/runtime/art/furniture/shared";
import { OVERHANG } from "@/src/game/runtime/art/specs";
import { resolve_placeable_style } from "@/src/game/runtime/render/art";

import { record_paint } from "../fixtures";
import {
  ALL_ROTATIONS,
  launch_items,
  PAINT_FRAMES,
  paint_with,
  placeable_spec,
} from "./standing_fixtures";

const SIGNS = launch_items("signage");

/** Room above a panel for its lit top edge or the identity sign's zinc cap. */
const ZINC_CAP_ALLOWANCE = 5;

/** The signs whose arrows or chevrons point somewhere, so every rotation paints differently. */
const DIRECTIONAL_SIGNS = [
  "item.tray-return-arrow-sign",
  "item.accessible-wayfinding-sign",
  "item.queue-etiquette-sign",
  "item.stall-row-marker",
];

describe("paint_signage", () => {
  it("covers the seven launch signs", () => {
    expect(SIGNS).toHaveLength(7);
  });

  it("paints every sign at every frame and rotation", () => {
    for (const item of SIGNS) {
      for (const frame of PAINT_FRAMES) {
        for (const rotation of ALL_ROTATIONS) {
          const { calls } = paint_with(paint_signage, placeable_spec(item, rotation, frame));

          expect(calls, `${item.id} r${rotation}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it("paints through the furniture dispatcher", () => {
    for (const item of SIGNS) {
      expect(record_paint(placeable_spec(item)).log.length, item.id).toBeGreaterThan(20);
    }
  });

  it("paints each sign differently from every other sign", () => {
    const digests = SIGNS.map((item) => paint_with(paint_signage, placeable_spec(item)).digest);

    expect(new Set(digests).size).toBe(SIGNS.length);
  });

  it("paints the same spec the same way twice", () => {
    for (const item of SIGNS) {
      const spec = placeable_spec(item, 90);

      expect(paint_with(paint_signage, spec).digest).toBe(paint_with(paint_signage, spec).digest);
    }
  });

  it("turns a directional sign's arrow with each rotation", () => {
    for (const id of DIRECTIONAL_SIGNS) {
      const item = SIGNS.find((sign) => sign.id === id);
      if (!item) throw new Error(`missing ${id}`);
      const digests = ALL_ROTATIONS.map(
        (rotation) => paint_with(paint_signage, placeable_spec(item, rotation)).digest,
      );

      expect(new Set(digests).size, id).toBe(4);
    }
  });
});

describe("signage_layout", () => {
  /**
   * Lays out a launch sign at a rotation.
   *
   * @param item - The sign.
   * @param rotation - The placement rotation.
   * @returns The spec and its layout.
   */
  function layout_of(item: (typeof SIGNS)[number], rotation: Rotation) {
    const spec = placeable_spec(item, rotation);
    const layout = signage_layout(
      footprint_box(spec),
      resolve_placeable_style("signage", spec.recipe),
      rotation,
    );
    return { spec, layout };
  }

  it("keeps every panel, post, rod and base inside the texture", () => {
    for (const item of SIGNS) {
      for (const rotation of ALL_ROTATIONS) {
        const { spec, layout } = layout_of(item, rotation);
        const label = `${item.id} r${rotation}`;

        expect(layout.panel.x, label).toBeGreaterThanOrEqual(0);
        expect(layout.panel.x + layout.panel.width, label).toBeLessThanOrEqual(spec.width);
        expect(layout.panel.y - ZINC_CAP_ALLOWANCE, label).toBeGreaterThanOrEqual(0);
        expect(layout.ground, label).toBeLessThanOrEqual(spec.height + OVERHANG);
        expect(layout.postTop, label).toBeGreaterThanOrEqual(0);
        for (const post of layout.posts) {
          expect(post - layout.baseRadius, label).toBeGreaterThanOrEqual(0);
          expect(post + layout.baseRadius, label).toBeLessThanOrEqual(spec.width);
        }
        for (const hanger of layout.hangers) {
          expect(hanger, label).toBeGreaterThan(layout.panel.x);
          expect(hanger, label).toBeLessThan(layout.panel.x + layout.panel.width);
        }
      }
    }
  });

  it("hangs every walk-under sign high from the ceiling, with no floor posts", () => {
    for (const item of SIGNS.filter((sign) => sign.walkability === "underpass")) {
      for (const rotation of ALL_ROTATIONS) {
        const { layout } = layout_of(item, rotation);
        const label = `${item.id} r${rotation}`;

        expect(layout.isHanging, label).toBe(true);
        expect(layout.posts, label).toHaveLength(0);
        expect(layout.hangers.length, label).toBeGreaterThan(0);
        expect(layout.panel.y + layout.panel.height, label).toBeLessThanOrEqual(
          OVERHANG + TILE / 2,
        );
        expect(layout.ground, label).toBeGreaterThan(layout.panel.y + layout.panel.height);
      }
    }
  });

  it("stands every sign that blocks movement on posts", () => {
    for (const item of SIGNS.filter((sign) => sign.walkability !== "underpass")) {
      for (const rotation of ALL_ROTATIONS) {
        const { layout } = layout_of(item, rotation);

        expect(layout.isHanging, `${item.id} r${rotation}`).toBe(false);
        expect(layout.posts.length, `${item.id} r${rotation}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps each sign's panel height at every rotation", () => {
    for (const item of SIGNS) {
      const heights = ALL_ROTATIONS.map(
        (rotation) => layout_of(item, rotation).layout.panel.height,
      );

      expect(new Set(heights).size, item.id).toBe(1);
    }
  });

  it("shows a narrower panel only when a long sign runs north-south", () => {
    const directory = SIGNS.find((sign) => sign.id === "item.entrance-directory");
    if (!directory) throw new Error("missing directory");

    expect(layout_of(directory, 0).layout.isPortrait).toBe(false);
    expect(layout_of(directory, 90).layout.isPortrait).toBe(true);
  });
});
