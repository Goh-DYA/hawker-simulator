/**
 * Contract tests between the content Zod schemas and the core vocabulary tuples.
 *
 * Content is validated with Zod before it reaches the core, and the core derives its unions
 * from the tuples in `src/game/core/enums.ts`. Both lists must hold the same values in the
 * same order, or content that passes validation could carry a value the core never handles.
 */
import { describe, expect, it } from "vitest";

import {
  cardinalDirectionSchema,
  healthConditionSchema,
  nutritionIntentIdSchema,
  nutritionMetricSchema,
  nutritionNutrientsSchema,
  nutritionValueSchema,
  rotationSchema,
} from "@/src/content/schemas";
import {
  HEALTH_CONDITIONS,
  NUTRITION_INTENTS,
  NUTRITION_METRICS,
  NUTRITION_UNAVAILABLE_REASONS,
  QUEUE_DIRECTIONS,
  ROTATIONS,
} from "@/src/game/core";

describe("content schemas match the core vocabulary tuples", () => {
  it("lists the queue directions as the cardinal direction options", () => {
    expect(cardinalDirectionSchema.options).toEqual([...QUEUE_DIRECTIONS]);
  });

  it("lists the rotations as the rotation literals", () => {
    expect(rotationSchema.options.map((option) => option.value)).toEqual([...ROTATIONS]);
  });

  it("lists the nutrition metrics as the metric options", () => {
    expect(nutritionMetricSchema.options).toEqual([...NUTRITION_METRICS]);
  });

  it("lists the nutrition metrics as the nutrient keys", () => {
    expect(Object.keys(nutritionNutrientsSchema.shape)).toEqual([...NUTRITION_METRICS]);
  });

  it("lists the nutrition intents as the intent id options", () => {
    expect(nutritionIntentIdSchema.options).toEqual([...NUTRITION_INTENTS]);
  });

  it("lists the health conditions as the condition options", () => {
    expect(healthConditionSchema.options).toEqual([...HEALTH_CONDITIONS]);
  });

  it("lists the unavailable reasons as the unavailable nutrient reason options", () => {
    const unavailable = nutritionValueSchema.options.find(
      (option) => option.shape.status.value === "unavailable",
    );

    expect(
      unavailable && "reason" in unavailable.shape ? unavailable.shape.reason.options : [],
    ).toEqual([...NUTRITION_UNAVAILABLE_REASONS]);
  });
});
