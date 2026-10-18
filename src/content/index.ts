/**
 * The public entry point of the launch content.
 *
 * Callers outside `src/content` import content, schemas, types and the validator from
 * here rather than from the individual modules.
 */
export {
  DISH_BY_ID,
  LAUNCH_CONTENT,
  PLACEABLE_BY_ID,
  STALL_BY_ID,
} from "./catalog";
export { CUSTOMER_ARCHETYPES, CUSTOMER_ENGLISH } from "./customers";
export { DISHES, DISH_ENGLISH } from "./dishes";
export { ECONOMY } from "./economy";
export { ENGLISH_LOCALIZATION, localize_key } from "./localization";
export {
  NUTRITION_CONTENT,
  getNutritionIntent,
  getNutritionProfile,
  getNutritionVariant,
  getNutritionVariantFamily,
} from "./nutrition";
export { PLACEABLES, PLACEABLE_ENGLISH } from "./placeables";
export { LAUNCH_ROSTER, PLACEABLE_CATEGORY_MINIMUMS } from "./roster";
export * from "./schemas";
export { STALLS, STALL_ENGLISH } from "./stalls";
export * from "./types";
export {
  ContentValidationError,
  validateContent,
  type ContentValidationReport,
} from "./validate";
