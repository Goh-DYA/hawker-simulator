/**
 * Test helpers for the standing-object painter suites (signage, dividers, decor): placeable
 * paint specs built from the launch content at any rotation and frame, and digests of painting
 * a spec straight through a category painter, which takes the rotation as an argument.
 */
import { PLACEABLES, type PlaceableCategory } from "@/src/content";
import type { Rotation } from "@/src/game/core";
import type { PaintContext } from "@/src/game/runtime/art/canvas";
import { footprint_box, type Box } from "@/src/game/runtime/art/furniture/shared";
import {
  DEFAULT_PAINT_FRAME,
  rotated_size,
  type PaintFrame,
  type PlaceablePaintSpec,
} from "@/src/game/runtime/art/specs";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";

import { create_recording_context } from "../fixtures";

/** The default, high-contrast and low-detail frames every painter must handle. */
export const PAINT_FRAMES: readonly PaintFrame[] = [
  DEFAULT_PAINT_FRAME,
  { isHighContrast: true, isLowDetail: false },
  { isHighContrast: false, isLowDetail: true },
];

/** The four placement rotations. */
export const ALL_ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

/** A painter of one category, called with the rotation the dispatcher will pass. */
export type StandingPainter = (
  ctx: PaintContext,
  box: Box,
  recipe: PlaceablePaintSpec["recipe"],
  frame: PaintFrame,
  rotation: Rotation,
) => void;

/** A launch placeable definition. */
export type LaunchPlaceable = (typeof PLACEABLES)[number];

/**
 * Lists the launch placeables of a category.
 *
 * @param category - The placeable category.
 * @returns The definitions, in content order.
 */
export function launch_items(category: PlaceableCategory): readonly LaunchPlaceable[] {
  return PLACEABLES.filter((item) => item.category === category);
}

/**
 * Builds the paint spec of a launch placeable at a rotation and frame.
 *
 * @param item - The placeable definition.
 * @param rotation - The placement rotation.
 * @param frame - The paint frame.
 * @returns The spec, with the rotated footprint size.
 */
export function placeable_spec(
  item: LaunchPlaceable,
  rotation: Rotation = 0,
  frame: PaintFrame = DEFAULT_PAINT_FRAME,
): PlaceablePaintSpec {
  const size = rotated_size(item.footprint.width * 48, item.footprint.height * 48, rotation);
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
 * Paints a spec through a category painter into a fresh recording context.
 *
 * @param painter - The category painter.
 * @param spec - The spec.
 * @returns The digest of the recorded calls and the number of calls.
 */
export function paint_with(
  painter: StandingPainter,
  spec: PlaceablePaintSpec,
): { digest: string; calls: number } {
  const recording = create_recording_context();
  painter(recording.ctx, footprint_box(spec), spec.recipe, spec.frame, spec.rotation);
  return { digest: recording.digest(), calls: recording.log.length };
}
