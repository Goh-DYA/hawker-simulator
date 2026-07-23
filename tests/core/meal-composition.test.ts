import { describe, expect, it } from "vitest";

import {
  MEAL_BALANCE_SCHEME,
  aggregateNutritionProfiles,
  buildUnlockedMealUniverse,
  comboOffersReferencingComponent,
  compareMealBalanceAmongUnlockedOptions,
  resolveComboOffer,
  selectReachableServingPlan,
  settleMealComponents,
  validateComboBoard,
  type ComboBoard,
  type MealComponent,
} from "../../src/game/core/mealComposition";
import { asMoneyCents } from "../../src/game/core/money";
import { NUTRITION_METRICS } from "../../src/game/core/nutrition";
import type {
  NutritionMetric,
  NutritionProfile,
  NutritionValue,
} from "../../src/game/core/types";
import { HEALTH_RATING_SCHEMES } from "../../tools/nutrition/importer.mjs";

function profile(
  id: string,
  overrides: Partial<Record<NutritionMetric, NutritionValue>> = {},
): NutritionProfile {
  return {
    id,
    dishId: id,
    status: "released",
    nutritionClass: "meal",
    nutrients: Object.fromEntries(NUTRITION_METRICS.map((metric) => [
      metric,
      overrides[metric] ?? { status: "known", value: 1 },
    ])) as Record<NutritionMetric, NutritionValue>,
    intentFits: {},
  };
}

function component(
  id: string,
  role: MealComponent["role"],
  nutritionProfile: NutritionProfile = profile(id),
  stalls: readonly string[] = [`stall-${id}`],
): MealComponent {
  return {
    preparationId: id,
    dishId: `dish-${id}`,
    role,
    priceCents: asMoneyCents(role === "main" ? 700 : 250),
    ingredientCostCents: asMoneyCents(role === "main" ? 250 : 80),
    unlocked: true,
    stallInstanceIds: stalls,
    nutritionProfile,
  };
}

const main = component("main", "main", profile("main", {
  energyKcal: { status: "known", value: 500 },
  dietaryFibreG: { status: "known", value: 5 },
}));
const side = component("side", "side", profile("side", {
  energyKcal: { status: "known", value: 120 },
  dietaryFibreG: { status: "trace" },
}));
const drink = component("drink", "drink", profile("drink", {
  energyKcal: { status: "known", value: 80 },
  sodiumMg: { status: "unavailable", reason: "not-reported" },
}));

describe("Combo Board", () => {
  const board: ComboBoard = {
    slots: [{ id: "offer-main-side", preparationIds: ["main", "side"] }, null, null],
  };

  it("unlocks at level 5 and accepts exactly one main plus a side or drink", () => {
    const distances = [
      { stallInstanceId: "stall-main", distance: 4 },
      { fromStallInstanceId: "stall-main", stallInstanceId: "stall-side", distance: 6 },
    ];
    expect(validateComboBoard(4, board, [main, side], distances).map((issue) => issue.code))
      .toContain("locked");
    expect(validateComboBoard(5, board, [main, side], distances)).toEqual([]);
    const invalid: ComboBoard = {
      slots: [{ id: "two-sides", preparationIds: ["side", "drink"] }, null, null],
    };
    expect(validateComboBoard(5, invalid, [side, drink], [
      { stallInstanceId: "stall-side", distance: 1 },
      { fromStallInstanceId: "stall-side", stallInstanceId: "stall-drink", distance: 1 },
    ]).map((issue) => issue.code)).toContain("meal-role");
  });

  it("sums terms without a discount and exposes references", () => {
    expect(resolveComboOffer(board.slots[0]!, { main, side })).toMatchObject({
      priceCents: 950,
      ingredientCostCents: 330,
    });
    expect(comboOffersReferencingComponent(board, "side")).toEqual(["offer-main-side"]);
  });

  it("routes the main first through the nearest actual instances", () => {
    const flexibleMain = component("main-flex", "main", main.nutritionProfile, ["far", "near"]);
    const plan = selectReachableServingPlan([side, flexibleMain], [
      { stallInstanceId: "far", distance: 10 },
      { stallInstanceId: "near", distance: 2 },
      { fromStallInstanceId: "far", stallInstanceId: "stall-side", distance: 1 },
      { fromStallInstanceId: "near", stallInstanceId: "stall-side", distance: 3 },
    ]);
    expect(plan?.stops).toEqual([
      { preparationIds: ["main-flex"], stallInstanceId: "near", distance: 2 },
      { preparationIds: ["side"], stallInstanceId: "stall-side", distance: 3 },
    ]);
  });

  it("uses one stop when the same stall serves both preparations", () => {
    const sharedMain = component("shared-main", "main", main.nutritionProfile, ["shared"]);
    const sharedDrink = component("shared-drink", "drink", drink.nutritionProfile, ["shared"]);
    expect(selectReachableServingPlan([sharedDrink, sharedMain], [
      { stallInstanceId: "shared", distance: 3 },
    ])).toEqual({
      stops: [{
        preparationIds: ["shared-main", "shared-drink"],
        stallInstanceId: "shared",
        distance: 3,
      }],
      totalDistance: 3,
    });
  });

  it("rejects duplicate logical pairs even when ids and order differ", () => {
    const duplicate: ComboBoard = {
      slots: [
        { id: "first", preparationIds: ["main", "side"] },
        { id: "second", preparationIds: ["side", "main"] },
        null,
      ],
    };
    expect(validateComboBoard(5, duplicate, [main, side], [
      { stallInstanceId: "stall-main", distance: 1 },
      { fromStallInstanceId: "stall-main", stallInstanceId: "stall-side", distance: 1 },
    ]).some((issue) => issue.slot === 1 && issue.code === "duplicate-offer")).toBe(true);
  });
});

describe("meal nutrition and settlement", () => {
  it("sums known values, discloses trace components, and propagates unavailable", () => {
    const combined = aggregateNutritionProfiles([main.nutritionProfile, side.nutritionProfile]);
    expect(combined.nutrients.energyKcal).toEqual({ status: "known", value: 620 });
    expect(combined.nutrients.dietaryFibreG).toEqual({ status: "unavailable" });
    expect(combined.traceComponentCounts.dietaryFibreG).toBe(1);
    expect(combined.explanationCodes).toContain("trace-component:dietaryFibreG");
    expect(combined.explanationCodes).toContain("unavailable:dietaryFibreG");
    expect(aggregateNutritionProfiles([main.nutritionProfile, drink.nutritionProfile])
      .nutrients.sodiumMg).toEqual({ status: "unavailable", reason: "not-reported" });
  });

  it("compares the fixed unlocked universe independent of board slots", () => {
    const low = component("low", "main", profile("low", {
      energyKcal: { status: "known", value: 300 },
    }));
    const high = component("high", "main", profile("high", {
      energyKcal: { status: "known", value: 800 },
    }));
    const universe = buildUnlockedMealUniverse([low, high, side], [
      { stallInstanceId: "stall-low", distance: 1 },
      { stallInstanceId: "stall-high", distance: 2 },
      { fromStallInstanceId: "stall-low", stallInstanceId: "stall-side", distance: 1 },
      { fromStallInstanceId: "stall-high", stallInstanceId: "stall-side", distance: 1 },
    ]);
    expect(universe.map((candidate) => candidate.id)).toEqual([
      "pair:high+side",
      "pair:low+side",
      "single:high",
      "single:low",
    ]);
    expect(compareMealBalanceAmongUnlockedOptions("single:low", universe).rating)
      .toBeGreaterThan(compareMealBalanceAmongUnlockedOptions("single:high", universe).rating!);
  });

  it("excludes trace metrics from ranking instead of treating trace as zero", () => {
    const traced = component("traced", "main", profile("traced", {
      energyKcal: { status: "trace" },
    }));
    const known = component("known", "main", profile("known", {
      energyKcal: { status: "known", value: 800 },
    }));
    const universe = buildUnlockedMealUniverse([traced, known], [
      { stallInstanceId: "stall-traced", distance: 1 },
      { stallInstanceId: "stall-known", distance: 1 },
    ]);
    const tracedResult = compareMealBalanceAmongUnlockedOptions("single:traced", universe);
    const knownResult = compareMealBalanceAmongUnlockedOptions("single:known", universe);
    expect(tracedResult.availableWeight).toBeLessThan(knownResult.availableWeight);
    expect(tracedResult.explanationCodes).toContain("unavailable:energyKcal");
  });

  it("charges only a served main after the second stall is lost", () => {
    expect(settleMealComponents([
      {
        preparationId: "main",
        role: "main",
        served: true,
        priceCents: main.priceCents,
        ingredientCostCents: main.ingredientCostCents,
      },
      {
        preparationId: "side",
        role: "side",
        served: false,
        priceCents: side.priceCents,
        ingredientCostCents: side.ingredientCostCents,
      },
    ], "second-stall-unavailable")).toMatchObject({
      result: "partial",
      grossSalesCents: 700,
      ingredientCostCents: 250,
      chargedPreparationIds: ["main"],
      cancelledPreparationIds: ["side"],
    });
  });

  it("uses the generated Health-rating directions and weights", () => {
    const overall = HEALTH_RATING_SCHEMES.overall as unknown as readonly (
      readonly [NutritionMetric, "higher" | "lower", number]
    )[];
    expect(MEAL_BALANCE_SCHEME).toEqual(overall.map(([metric, direction, weight]) => ({
      metric,
      direction,
      weight,
    })));
  });
});
