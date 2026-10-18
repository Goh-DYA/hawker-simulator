/**
 * Unit tests for the pure nutrition metric recorders in `src/game/core/nutrition.ts`.
 *
 * They pin the per-intent unknown counters and the daily nutrient totals that
 * `record_nutrition_sale` keeps, because the simulation goldens do not reach those paths.
 */
import { describe, expect, it } from "vitest";
import { createEmptyNutritionMetrics, record_nutrition_sale } from "@/src/game/core/nutrition";
import { NUTRITION_METRICS } from "@/src/game/core/enums";
import type {
  Customer,
  DishDefinition,
  NutritionMetric,
  NutritionProfile,
  NutritionProfileStatus,
  NutritionValue,
} from "@/src/game/core";

/** The operating day every recorded sale falls on. */
const SALE_DAY = 0;

/** The dish every test serves. */
const DISH: DishDefinition = {
  id: "test-dish",
  price: 5,
  preparationMs: 1000,
  eatingMs: 1000,
  quality: 3,
};

/** A served customer that requested the fibre-forward intent. */
const CUSTOMER: Customer = {
  id: "customer-1",
  archetypeId: "test-archetype",
  status: "eating",
  position: { x: 0, y: 0 },
  path: [],
  pathIndex: 0,
  movementProgress: 0,
  stateElapsedMs: 0,
  visitElapsedMs: 0,
  walkingDistanceTiles: 0,
  patienceRemainingMs: 1000,
  satisfaction: 0.5,
  healthConditions: [],
  nutritionIntentId: "fibre-forward",
  hasTray: true,
  served: true,
  spent: 5,
  stuckMs: 0,
};

function build_profile(
  status: NutritionProfileStatus,
  nutrients: Partial<Record<NutritionMetric, NutritionValue>> = {},
): NutritionProfile {
  const unavailable: NutritionValue = { status: "unavailable", reason: "not-reported" };
  return {
    id: "test-dish-profile",
    dishId: DISH.id,
    status,
    nutrients: Object.fromEntries(
      NUTRITION_METRICS.map((metric) => [metric, nutrients[metric] ?? unavailable]),
    ) as Record<NutritionMetric, NutritionValue>,
    intentFits: {},
    healthRating: 3,
    conditionRatings: {},
    nutritionClass: "meal",
  };
}

describe("record_nutrition_sale", () => {
  it("counts an intent sale with a non-released profile as unknown everywhere", () => {
    const before = createEmptyNutritionMetrics();
    const after = record_nutrition_sale(
      before,
      DISH,
      build_profile("unavailable"),
      CUSTOMER,
      "unknown",
      SALE_DAY,
    );
    expect({
      lifetime: after.byIntent["fibre-forward"].unknowns,
      today: after.today.byIntent["fibre-forward"].unknowns,
      total: after.intentUnknowns,
    }).toEqual({
      lifetime: before.byIntent["fibre-forward"].unknowns + 1,
      today: before.today.byIntent["fibre-forward"].unknowns + 1,
      total: before.intentUnknowns + 1,
    });
  });

  it("accumulates today's nutrient totals for a released profile", () => {
    const released = build_profile("released", { energyKcal: { status: "known", value: 450 } });
    const once = record_nutrition_sale(
      createEmptyNutritionMetrics(),
      DISH,
      released,
      CUSTOMER,
      undefined,
      SALE_DAY,
    );
    const twice = record_nutrition_sale(once, DISH, released, CUSTOMER, undefined, SALE_DAY);
    expect({
      total: twice.today.nutrientTotals.energyKcal,
      known: twice.today.nutrientKnownCounts.energyKcal,
    }).toEqual({ total: 900, known: 2 });
  });
});
