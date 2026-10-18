/**
 * The painter registry: resolves a paint spec to its paint plan (texture size, painter and
 * sheet frames) so the texture studio and the gallery tool need one entry point.
 *
 * The painters themselves are Phaser-free Canvas 2D functions in the sibling modules.
 */
import { plan_effect } from "./effects";
import { plan_floor } from "./floor";
import { plan_dish } from "./food";
import { plan_placeable } from "./furniture";
import { plan_customer_sheet, plan_vendor_sheet } from "./people";
import type { PaintPlan, PaintSpec } from "./specs";
import { plan_stall } from "./stalls";

/**
 * Plans the texture for a spec.
 *
 * @param spec - The paint spec.
 * @returns The plan.
 */
export function plan_texture(spec: PaintSpec): PaintPlan {
  switch (spec.kind) {
    case "placeable":
      return plan_placeable(spec);
    case "stall":
      return plan_stall(spec);
    case "customer":
      return plan_customer_sheet(spec);
    case "vendor":
      return plan_vendor_sheet(spec);
    case "dish":
      return plan_dish(spec);
    case "floor":
      return plan_floor(spec);
    case "effect":
      return plan_effect(spec);
  }
}
