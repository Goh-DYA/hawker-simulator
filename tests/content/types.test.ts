/**
 * Type-level tests that each content type equals its Zod schema output.
 *
 * The content types in `src/content/types.ts` are derived from the schemas in
 * `src/content/schemas.ts`. These assertions are checked by `tsc` (`npm run typecheck`),
 * so a type that is redefined by hand, or derived from the wrong schema, cannot drift from
 * what `validateContent` actually parses.
 */
import { describe, expectTypeOf, it } from "vitest";
import type { z } from "zod";

import type {
  audioReferenceSchema,
  AudioReference,
  cardinalDirectionSchema,
  CardinalDirection,
  customerArchetypeSchema,
  CustomerArchetypeDefinition,
  dishSchema,
  DishDefinition,
  economySchema,
  EconomyDefinition,
  footprintSchema,
  Footprint,
  gridPointSchema,
  GridPoint,
  healthConditionSchema,
  HealthCondition,
  interactionPointSchema,
  InteractionPoint,
  launchContentSchema,
  LaunchContent,
  limitNutrientSchema,
  LimitNutrient,
  nutritionContentSchema,
  NutritionContent,
  nutritionDailyReferenceSchema,
  NutritionDailyReference,
  nutritionGuidelineSchema,
  NutritionGuideline,
  nutritionHealthPartsSchema,
  NutritionHealthParts,
  nutritionIntentIdSchema,
  NutritionIntentId,
  nutritionIntentSchema,
  NutritionIntentDefinition,
  nutritionMetricSchema,
  NutritionMetric,
  nutritionNutrientsSchema,
  NutritionNutrients,
  nutritionProfileSchema,
  NutritionProfile,
  nutritionProvenanceSchema,
  NutritionProvenance,
  nutritionServingSchema,
  NutritionServing,
  nutritionSourceSnapshotSchema,
  NutritionSourceSnapshot,
  nutritionValueSchema,
  NutritionValue,
  nutritionVariantFamilySchema,
  NutritionVariantFamily,
  nutritionVariantSchema,
  NutritionVariant,
  placeableCategorySchema,
  PlaceableCategory,
  placeableSchema,
  PlaceableDefinition,
  ReadonlyDeep,
  calendarCardSchema,
  CalendarCardContent,
  rotationSchema,
  Rotation,
  seatPointSchema,
  SeatPoint,
  spriteReferenceSchema,
  SpriteReference,
  stallSchema,
  StallDefinition,
  stallUpgradeSchema,
  StallUpgradeLevel,
  unlockRequirementSchema,
  UnlockRequirement,
} from "@/src/content";

/** The deeply readonly output type of the Zod schema `S`. */
type Parsed<S extends z.ZodType> = ReadonlyDeep<z.output<S>>;

describe("content types", () => {
  it("match the top-level record schemas", () => {
    expectTypeOf<Parsed<typeof stallSchema>>().toEqualTypeOf<StallDefinition>();
    expectTypeOf<Parsed<typeof dishSchema>>().toEqualTypeOf<DishDefinition>();
    expectTypeOf<Parsed<typeof calendarCardSchema>>().toEqualTypeOf<CalendarCardContent>();
    expectTypeOf<Parsed<typeof placeableSchema>>().toEqualTypeOf<PlaceableDefinition>();
    expectTypeOf<
      Parsed<typeof customerArchetypeSchema>
    >().toEqualTypeOf<CustomerArchetypeDefinition>();
    expectTypeOf<Parsed<typeof economySchema>>().toEqualTypeOf<EconomyDefinition>();
    expectTypeOf<Parsed<typeof launchContentSchema>>().toEqualTypeOf<LaunchContent>();
  });

  it("match the nutrition schemas", () => {
    expectTypeOf<Parsed<typeof nutritionContentSchema>>().toEqualTypeOf<NutritionContent>();
    expectTypeOf<Parsed<typeof nutritionProfileSchema>>().toEqualTypeOf<NutritionProfile>();
    expectTypeOf<Parsed<typeof nutritionVariantSchema>>().toEqualTypeOf<NutritionVariant>();
    expectTypeOf<
      Parsed<typeof nutritionVariantFamilySchema>
    >().toEqualTypeOf<NutritionVariantFamily>();
    expectTypeOf<Parsed<typeof nutritionIntentSchema>>().toEqualTypeOf<NutritionIntentDefinition>();
    expectTypeOf<
      Parsed<typeof nutritionSourceSnapshotSchema>
    >().toEqualTypeOf<NutritionSourceSnapshot>();
    expectTypeOf<Parsed<typeof nutritionGuidelineSchema>>().toEqualTypeOf<NutritionGuideline>();
    expectTypeOf<Parsed<typeof nutritionServingSchema>>().toEqualTypeOf<NutritionServing>();
    expectTypeOf<Parsed<typeof nutritionProvenanceSchema>>().toEqualTypeOf<NutritionProvenance>();
    expectTypeOf<Parsed<typeof nutritionValueSchema>>().toEqualTypeOf<NutritionValue>();
    expectTypeOf<Parsed<typeof nutritionNutrientsSchema>>().toEqualTypeOf<NutritionNutrients>();
    expectTypeOf<Parsed<typeof nutritionHealthPartsSchema>>().toEqualTypeOf<NutritionHealthParts>();
    expectTypeOf<
      Parsed<typeof nutritionDailyReferenceSchema>
    >().toEqualTypeOf<NutritionDailyReference>();
  });

  it("match the shared part schemas", () => {
    expectTypeOf<Parsed<typeof gridPointSchema>>().toEqualTypeOf<GridPoint>();
    expectTypeOf<Parsed<typeof footprintSchema>>().toEqualTypeOf<Footprint>();
    expectTypeOf<Parsed<typeof unlockRequirementSchema>>().toEqualTypeOf<UnlockRequirement>();
    expectTypeOf<Parsed<typeof spriteReferenceSchema>>().toEqualTypeOf<SpriteReference>();
    expectTypeOf<Parsed<typeof audioReferenceSchema>>().toEqualTypeOf<AudioReference>();
    expectTypeOf<Parsed<typeof stallUpgradeSchema>>().toEqualTypeOf<StallUpgradeLevel>();
    expectTypeOf<Parsed<typeof interactionPointSchema>>().toEqualTypeOf<InteractionPoint>();
    expectTypeOf<Parsed<typeof seatPointSchema>>().toEqualTypeOf<SeatPoint>();
  });

  it("match the enumerated value schemas", () => {
    expectTypeOf<Parsed<typeof cardinalDirectionSchema>>().toEqualTypeOf<CardinalDirection>();
    expectTypeOf<Parsed<typeof rotationSchema>>().toEqualTypeOf<Rotation>();
    expectTypeOf<Parsed<typeof placeableCategorySchema>>().toEqualTypeOf<PlaceableCategory>();
    expectTypeOf<Parsed<typeof nutritionMetricSchema>>().toEqualTypeOf<NutritionMetric>();
    expectTypeOf<Parsed<typeof nutritionIntentIdSchema>>().toEqualTypeOf<NutritionIntentId>();
    expectTypeOf<Parsed<typeof healthConditionSchema>>().toEqualTypeOf<HealthCondition>();
    expectTypeOf<Parsed<typeof limitNutrientSchema>>().toEqualTypeOf<LimitNutrient>();
  });
});
