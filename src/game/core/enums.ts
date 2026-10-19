/**
 * Ordered vocabulary tuples for the simulation core.
 *
 * Each tuple is the single runtime list of an enumerated value, and `types.ts` derives the
 * matching union from it, so the list is exhaustive by construction. The order is
 * load-bearing: the simulation iterates some of these lists, and the order feeds digested
 * state and save output, so never reorder entries. This module imports nothing.
 */

/** Allowed placement rotations in degrees, clockwise. */
export const ROTATIONS = [0, 90, 180, 270] as const;

/** Kinds of grid tile. */
export const TILE_KINDS = ["floor", "wall", "void"] as const;

/** Rendering quality presets. */
export const QUALITY_MODES = ["standard", "lower-end"] as const;

/** Directions a stall queue can extend in. */
export const QUEUE_DIRECTIONS = ["north", "east", "south", "west"] as const;

/** Kinds of daily objective. */
export const OBJECTIVE_KINDS = [
  "serve",
  "revenue",
  "happiness",
  "flow",
  "variety",
  "facility",
  "nutrition",
] as const;

/**
 * Why a guest left, recorded on the visit rating. `served` is a completed visit; `abandoned` is
 * the legacy reason of ratings saved before the specific reasons existed.
 */
export const DEPARTURE_REASONS = [
  "served",
  "abandoned",
  "no-stall",
  "long-queue",
  "no-dish",
  "no-seat",
  "visit-cap",
] as const;

/** What a nutrition daily objective counts. */
export const NUTRITION_OBJECTIVE_CRITERIA = [
  "profiled-servings",
  "intent-matches",
  "variant-servings",
] as const;

/** Component keys of a visit rating, in persisted order. */
export const VISIT_RATING_COMPONENT_KEYS = [
  "foodQuality",
  "wait",
  "value",
  "walking",
  "comfort",
  "cleanliness",
  "ambience",
] as const;

/** Why a nutrient value is unavailable. */
export const NUTRITION_UNAVAILABLE_REASONS = [
  "not-reported",
  "invalid-source",
  "unmapped",
  "implausible-source",
] as const;

/** Health conditions a customer can carry. */
export const HEALTH_CONDITIONS = [
  "high-cholesterol",
  "obesity",
  "diabetes",
  "hypertension",
] as const;

/** Nutrition requests a customer can make. */
export const NUTRITION_INTENTS = [
  "lighter-energy",
  "protein-forward",
  "fibre-forward",
  "sodium-aware",
  "lower-total-sugar-drink",
] as const;

/** Reported nutrients, in profile key order. */
export const NUTRITION_METRICS = [
  "energyKcal",
  "proteinG",
  "totalFatG",
  "saturatedFatG",
  "transFatG",
  "carbohydrateG",
  "totalSugarG",
  "dietaryFibreG",
  "sodiumMg",
  "calciumMg",
  "ironMg",
  "waterG",
] as const;

/**
 * The current persisted save schema version, written by every new save.
 *
 * It lives in this leaf module so that `state.ts` and `types.ts` can use it without importing
 * the persistence folder, which itself imports `state.ts`.
 */
export const PERSISTENT_SCHEMA_VERSION = 5 as const;
