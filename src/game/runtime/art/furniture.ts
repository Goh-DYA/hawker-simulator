/**
 * Furniture painters: one painter per non-stall placeable category, each in its own module under
 * `furniture/`, dispatched here by category, plus the overhead rule the world view uses to lift
 * overhead fittings above people and the fan motion-frame count.
 *
 * Every object is painted in the 3/4 oblique view: a contact shadow, lit top surfaces, visible
 * south faces and height rising into the {@link OVERHANG} above its footprint. Textures are
 * painted per rotation, inside the rotated footprint, and the sprite is never rotated, so each
 * painter receives the placement's rotation and lays the object out for it.
 */
import type { PlaceableCategory } from "@/src/content";

import type { PlaceableVisualRecipe } from "../visuals/placeable";
import type { PaintContext } from "./canvas";
import { paint_decor } from "./furniture/decor";
import { paint_divider } from "./furniture/dividers";
import { paint_facility } from "./furniture/facilities";
import { paint_fan } from "./furniture/fans";
import { paint_fixture } from "./furniture/fixtures";
import { paint_lighting } from "./furniture/lighting";
import { paint_plant } from "./furniture/plants";
import { paint_seat } from "./furniture/seats";
import { footprint_box, type Box } from "./furniture/shared";
import { paint_signage } from "./furniture/signage";
import { paint_table } from "./furniture/tables";
import { paint_tray_waste } from "./furniture/trayWaste";
import { OVERHANG, type PaintPlan, type PlaceablePaintSpec } from "./specs";

type FurniturePainter = (ctx: PaintContext, box: Box, spec: PlaceablePaintSpec) => void;

/** The painter for each non-stall category. */
const CATEGORY_PAINTERS: Readonly<Record<PlaceableCategory, FurniturePainter>> = {
  table: (ctx, box, spec) => paint_table(ctx, box, spec.recipe, spec.frame, spec.rotation),
  seat: (ctx, box, spec) => paint_seat(ctx, box, spec.recipe, spec.frame, spec.rotation),
  "stall-fixture": (ctx, box, spec) =>
    paint_fixture(ctx, box, spec.recipe, spec.frame, spec.rotation),
  "tray-waste": (ctx, box, spec) =>
    paint_tray_waste(ctx, box, spec.recipe, spec.frame, spec.rotation),
  lighting: (ctx, box, spec) => paint_lighting(ctx, box, spec.recipe, spec.frame, spec.rotation),
  fan: (ctx, box, spec) => paint_fan(ctx, box, spec.recipe, spec.motion, spec.frame, spec.rotation),
  plant: (ctx, box, spec) => paint_plant(ctx, box, spec.recipe, spec.frame, spec.rotation),
  signage: (ctx, box, spec) => paint_signage(ctx, box, spec.recipe, spec.frame, spec.rotation),
  divider: (ctx, box, spec) => paint_divider(ctx, box, spec.recipe, spec.frame, spec.rotation),
  facility: (ctx, box, spec) => paint_facility(ctx, box, spec.recipe, spec.frame, spec.rotation),
  decor: (ctx, box, spec) => paint_decor(ctx, box, spec.recipe, spec.frame, spec.rotation),
};

/** Number of motion frames a fan cycles through. */
export const FAN_MOTION_FRAMES = 6;

/**
 * Motifs of walk-through placeables that stand at table or counter height instead of hanging:
 * guests step around them on the tile, so they sort with the world.
 */
const LOW_WALKABLE_MOTIFS = ["task-light", "herb-planter", "flower-vase"] as const;

/**
 * Reports whether a placeable hangs overhead or is mounted high and draws above people. Every
 * walk-through (underpass) placeable does except the few low ones in {@link LOW_WALKABLE_MOTIFS},
 * because guests walk across its tiles and would otherwise be drawn behind it.
 *
 * @param recipe - The recipe, whose motif names the item.
 * @param blocksMovement - Whether the placeable blocks movement in the simulation catalog.
 * @returns True for ceiling-hung and high wall-mounted fittings.
 */
export function is_overhead(recipe: PlaceableVisualRecipe, blocksMovement: boolean): boolean {
  if (blocksMovement) return false;
  return !LOW_WALKABLE_MOTIFS.some((motif) => recipe.motif.includes(motif));
}

/**
 * Plans a placeable texture.
 *
 * @param spec - The placeable spec.
 * @returns The plan, `width × (height + OVERHANG)` pixels.
 */
export function plan_placeable(spec: PlaceablePaintSpec): PaintPlan {
  return {
    width: spec.width,
    height: spec.height + OVERHANG,
    paint: (ctx) => {
      CATEGORY_PAINTERS[spec.category](ctx, footprint_box(spec), spec);
    },
  };
}
