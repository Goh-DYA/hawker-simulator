/**
 * The launch roster: how many records of each kind the launch content ships.
 *
 * These counts are the one source for the roster checks in `validateContent`, so the
 * Zod schemas only require non-empty lists and adding or removing content means
 * changing a number here (plus the localization entries and the counts quoted in the
 * docs). The nutrition profile total is not listed: `validateContent` derives it from
 * the dishes and the variant families.
 */
import type { PlaceableCategory } from "./types";

/**
 * The record counts of the launch content. Every count is exact, except `placeables`,
 * which is a minimum.
 */
export const LAUNCH_ROSTER = {
  stalls: 14,
  dishes: 54,
  placeables: 80,
  customerArchetypes: 12,
  nutritionSourceSnapshots: 2,
  nutritionVariantFamilies: 14,
  nutritionIntents: 5,
  nutritionGuidelines: 11,
} as const;

/** The fewest placeables each category must offer at launch. */
export const PLACEABLE_CATEGORY_MINIMUMS = {
  table: 8,
  seat: 10,
  "stall-fixture": 8,
  "tray-waste": 8,
  lighting: 7,
  fan: 6,
  plant: 8,
  signage: 7,
  divider: 6,
  facility: 7,
  decor: 5,
} as const satisfies Readonly<Record<PlaceableCategory, number>>;

/**
 * The mastery rank at which each nutrition variant of a family unlocks, by its position
 * in the family. Variants past the end of the list unlock at the last rank.
 */
export const VARIANT_UNLOCK_RANKS = [1, 2, 4, 7] as const;

/**
 * The nutrition guidelines that must be explicitly excluded from direct comparison with
 * a dish's nutrients.
 */
export const NOT_COMPARABLE_GUIDELINE_IDS = [
  "added-sugar",
  "cholesterol",
  "drinking-water",
] as const;
