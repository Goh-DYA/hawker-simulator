/**
 * The content types, derived from the Zod schemas in `schemas.ts`.
 *
 * Each type is the deeply readonly output of its schema, so a field is described once and
 * a schema change updates its type. The field comments live on the schema keys.
 * `ContentId` and `LocalizedSeed` have no schema and stay hand-written.
 */
import type { z } from "zod";

import type {
  audioReferenceSchema,
  calendarCardSchema,
  cardinalDirectionSchema,
  customerArchetypeSchema,
  dietaryTagSchema,
  dishCategorySchema,
  dishSchema,
  economySchema,
  footprintSchema,
  gridPointSchema,
  healthConditionSchema,
  interactionPointSchema,
  interactionRoleSchema,
  launchContentSchema,
  nutritionClassSchema,
  nutritionContentSchema,
  nutritionGuidelineSchema,
  nutritionIntentIdSchema,
  nutritionIntentSchema,
  nutritionMetricSchema,
  nutritionNutrientsSchema,
  nutritionProfileSchema,
  nutritionProfileStatusSchema,
  nutritionProvenanceSchema,
  nutritionServingSchema,
  nutritionSourceSnapshotSchema,
  nutritionUnavailableReasonSchema,
  nutritionValueSchema,
  nutritionVariantFamilySchema,
  nutritionVariantSchema,
  placeableCategorySchema,
  placeableSchema,
  rotationSchema,
  seatPointSchema,
  seatPreferenceSchema,
  spriteReferenceSchema,
  stallSchema,
  stallUpgradeSchema,
  unlockRequirementSchema,
} from "./schemas";

/** A deeply readonly view of `T`: objects, arrays and tuples become readonly at every level. */
export type ReadonlyDeep<T> = T extends object
  ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> }
  : T;

export type ContentId = string;

export type CardinalDirection = ReadonlyDeep<z.output<typeof cardinalDirectionSchema>>;
export type Rotation = ReadonlyDeep<z.output<typeof rotationSchema>>;

export type GridPoint = ReadonlyDeep<z.output<typeof gridPointSchema>>;

export type Footprint = ReadonlyDeep<z.output<typeof footprintSchema>>;

export type UnlockRequirement = ReadonlyDeep<z.output<typeof unlockRequirementSchema>>;

export type SpriteReference = ReadonlyDeep<z.output<typeof spriteReferenceSchema>>;

export type AudioReference = ReadonlyDeep<z.output<typeof audioReferenceSchema>>;

export type StallUpgradeLevel = ReadonlyDeep<z.output<typeof stallUpgradeSchema>>;

export type StallDefinition = ReadonlyDeep<z.output<typeof stallSchema>>;

export type DishCategory = ReadonlyDeep<z.output<typeof dishCategorySchema>>;

export type CalendarCardContent = ReadonlyDeep<z.output<typeof calendarCardSchema>>;

export type DietaryTag = ReadonlyDeep<z.output<typeof dietaryTagSchema>>;

export type DishDefinition = ReadonlyDeep<z.output<typeof dishSchema>>;

export type PlaceableCategory = ReadonlyDeep<z.output<typeof placeableCategorySchema>>;

export type InteractionRole = ReadonlyDeep<z.output<typeof interactionRoleSchema>>;

export type InteractionPoint = ReadonlyDeep<z.output<typeof interactionPointSchema>>;

export type SeatPoint = ReadonlyDeep<z.output<typeof seatPointSchema>>;

export type PlaceableDefinition = ReadonlyDeep<z.output<typeof placeableSchema>>;

export type SeatPreference = ReadonlyDeep<z.output<typeof seatPreferenceSchema>>;

export type CustomerArchetypeDefinition = ReadonlyDeep<z.output<typeof customerArchetypeSchema>>;

export type EconomyDefinition = ReadonlyDeep<z.output<typeof economySchema>>;

export type NutritionMetric = ReadonlyDeep<z.output<typeof nutritionMetricSchema>>;

export type NutritionUnavailableReason = ReadonlyDeep<
  z.output<typeof nutritionUnavailableReasonSchema>
>;

export type NutritionValue = ReadonlyDeep<z.output<typeof nutritionValueSchema>>;

export type NutritionNutrients = ReadonlyDeep<z.output<typeof nutritionNutrientsSchema>>;

export type NutritionProfileStatus = ReadonlyDeep<z.output<typeof nutritionProfileStatusSchema>>;

export type NutritionClass = ReadonlyDeep<z.output<typeof nutritionClassSchema>>;

export type HealthCondition = ReadonlyDeep<z.output<typeof healthConditionSchema>>;

export type NutritionIntentId = ReadonlyDeep<z.output<typeof nutritionIntentIdSchema>>;

export type NutritionServing = ReadonlyDeep<z.output<typeof nutritionServingSchema>>;

export type NutritionProvenance = ReadonlyDeep<z.output<typeof nutritionProvenanceSchema>>;

export type NutritionProfile = ReadonlyDeep<z.output<typeof nutritionProfileSchema>>;

export type NutritionVariant = ReadonlyDeep<z.output<typeof nutritionVariantSchema>>;

export type NutritionVariantFamily = ReadonlyDeep<z.output<typeof nutritionVariantFamilySchema>>;

export type NutritionIntentDefinition = ReadonlyDeep<z.output<typeof nutritionIntentSchema>>;

export type NutritionSourceSnapshot = ReadonlyDeep<z.output<typeof nutritionSourceSnapshotSchema>>;

export type NutritionGuideline = ReadonlyDeep<z.output<typeof nutritionGuidelineSchema>>;

export type NutritionContent = ReadonlyDeep<z.output<typeof nutritionContentSchema>>;

export type LaunchContent = ReadonlyDeep<z.output<typeof launchContentSchema>>;

export interface LocalizedSeed {
  readonly name: string;
  readonly description: string;
}
