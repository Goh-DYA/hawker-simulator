import { describe, expect, it } from "vitest";

import {
  assessForecastCoverage,
  derivePeriodForecast,
  FORECAST_SERVICE_PERIODS,
  type PeriodDemandProfile,
} from "@/src/game/core/forecast";
import {
  asSgdCents,
  createServingTerms,
  findDominatedVariants,
  snapshotOrderLine,
  validateVariantWinningContexts,
} from "@/src/game/core/servingTerms";

const breakfastProfile: PeriodDemandProfile = {
  periodId: "breakfast",
  demandRange: [18, 24],
  crowdProfiles: [
    { id: "early-workers", basisPoints: 6_000 },
    { id: "neighbours", basisPoints: 4_000 },
  ],
  budgetBands: [
    { id: "value", basisPoints: 5_000, minimumCents: 300, maximumCents: 700 },
    { id: "flexible", basisPoints: 5_000, minimumCents: 701, maximumCents: 1_200 },
  ],
  groupSizeMix: [
    { id: "solo", size: 1, basisPoints: 7_000 },
    { id: "pair", size: 2, basisPoints: 3_000 },
  ],
  mealMix: [
    { id: "single", basisPoints: 8_000 },
    { id: "paired", basisPoints: 2_000 },
  ],
  nutritionNeeds: [
    {
      id: "need.sodium-aware",
      kind: "nutrition-intent",
      nutritionIntent: "sodium-aware",
      basisPoints: 3_000,
    },
    {
      id: "need.condition-aware",
      kind: "condition-aware",
      healthCondition: "hypertension",
      basisPoints: 7_000,
    },
  ],
};

const terms = (overrides: Partial<Parameters<typeof createServingTerms>[0]> = {}) => (
  createServingTerms({
    priceCents: 700,
    ingredientCostCents: 250,
    preparationTimeMs: 20_000,
    servingTimeMs: 8_000,
    eatingTimeMs: 40_000,
    starAppeal: 3.5,
    demandModifierBasisPoints: 10_000,
    ...overrides,
  })
);

describe("period forecasts", () => {
  it("defines the four authored service periods", () => {
    expect(FORECAST_SERVICE_PERIODS.map((period) => [period.id, period.startHour, period.endHour])).toEqual([
      ["breakfast", 6, 10],
      ["lunch", 10, 14],
      ["tea", 14, 18],
      ["evening", 18, 22],
    ]);
  });

  it("derives the same frozen result without consuming or accepting RNG state", () => {
    const first = derivePeriodForecast(breakfastProfile, 3, 9, {
      demandBasisPoints: 12_500,
      groupSizeBasisPointDeltas: { solo: -1_000, pair: 1_000 },
    });
    const second = derivePeriodForecast(breakfastProfile, 3, 9, {
      demandBasisPoints: 12_500,
      groupSizeBasisPointDeltas: { solo: -1_000, pair: 1_000 },
    });

    expect(first).toEqual(second);
    expect(first.demandRange).toEqual([23, 30]);
    expect(first.groupSizeMix.reduce((sum, entry) => sum + entry.basisPoints, 0)).toBe(10_000);
    expect(first.nutritionIntentIncidenceBasisPoints).toBe(4_000);
    expect(first.conditionAwareIncidenceBasisPoints).toBe(4_000);
    expect(first.needShareBasis).toBe("among-flagged-needs");
    expect(first.nutritionNeeds.filter((need) => need.kind === "nutrition-intent")
      .reduce((sum, need) => sum + need.basisPoints, 0)).toBe(10_000);
    expect(first.nutritionNeeds.filter((need) => need.kind === "condition-aware")
      .reduce((sum, need) => sum + need.basisPoints, 0)).toBe(10_000);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("does not let crowd or event-style modifiers alter condition-aware needs", () => {
    const baseline = derivePeriodForecast(breakfastProfile, 1, 1);
    const busy = derivePeriodForecast(breakfastProfile, 1, 1, {
      demandBasisPoints: 15_000,
      crowdProfileBasisPointDeltas: { "early-workers": 2_000 },
      mealMixBasisPointDeltas: { paired: 2_000 },
    });

    expect(busy.nutritionNeeds).toEqual(baseline.nutritionNeeds);
  });

  it("projects menu coverage separately and gates required needs behind two responses", () => {
    const forecast = derivePeriodForecast(breakfastProfile, 1, 1);
    const oneResponse = assessForecastCoverage(forecast, [
      { responseId: "dish-a", needId: "need.sodium-aware", unlocked: true, viable: true, active: true },
    ]);
    const twoResponses = assessForecastCoverage(forecast, [
      { responseId: "dish-a", needId: "need.sodium-aware", unlocked: true, viable: true, active: true },
      { responseId: "dish-b", needId: "need.sodium-aware", unlocked: true, viable: true, active: false },
    ]);

    expect(oneResponse[0]).toMatchObject({ covered: true, eligibleForRequiredContent: false });
    expect(twoResponses[0]).toMatchObject({ covered: true, eligibleForRequiredContent: true });
    expect(forecast.nutritionNeeds).toEqual(
      derivePeriodForecast(breakfastProfile, 1, 1).nutritionNeeds,
    );
  });

  it("changes active coverage without changing unlocked eligibility or forecast needs", () => {
    const forecast = derivePeriodForecast(breakfastProfile, 1, 1);
    const planning = assessForecastCoverage(forecast, [
      { responseId: "prep-a", needId: "need.sodium-aware", unlocked: true, viable: true, active: true },
      { responseId: "prep-b", needId: "need.sodium-aware", unlocked: true, viable: true, active: false },
    ]);
    const menuGap = assessForecastCoverage(forecast, [
      { responseId: "prep-a", needId: "need.sodium-aware", unlocked: true, viable: true, active: false },
      { responseId: "prep-b", needId: "need.sodium-aware", unlocked: true, viable: true, active: false },
    ]);

    expect(planning[0]).toMatchObject({ covered: true, eligibleForRequiredContent: true });
    expect(menuGap[0]).toMatchObject({ covered: false, eligibleForRequiredContent: true });
    expect(menuGap[0]?.unlockedViableResponseIds).toEqual(["prep-a", "prep-b"]);
    expect(forecast.nutritionNeeds).toEqual(derivePeriodForecast(breakfastProfile, 1, 1).nutritionNeeds);
  });
});

describe("serving-term snapshots and variant validation", () => {
  it("requires integer cents and freezes order-time serving terms", () => {
    expect(() => asSgdCents(1.5)).toThrow(/safe integer/);
    const snapshot = snapshotOrderLine({
      lineId: "line-1",
      dishId: "dish-a",
      variantId: "quick",
      arrivalPeriodSequenceId: 1,
      terms: terms(),
      explanationCodes: ["forecast:fast-service"],
    });

    expect(snapshot.terms.priceCents).toBe(700);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.terms)).toBe(true);
    expect(Object.isFrozen(snapshot.explanationCodes)).toBe(true);
  });

  it("reports a variant that is worse on every comparable dimension", () => {
    const strong = {
      id: "strong",
      terms: terms({
        priceCents: 600,
        ingredientCostCents: 150,
        preparationTimeMs: 15_000,
        starAppeal: 4,
        demandModifierBasisPoints: 11_000,
      }),
      nutritionFit: 0.8,
    };
    const weak = {
      id: "weak",
      terms: terms({
        priceCents: 700,
        ingredientCostCents: 300,
        preparationTimeMs: 25_000,
        starAppeal: 3,
        demandModifierBasisPoints: 9_000,
      }),
      nutritionFit: 0.6,
    };
    expect(findDominatedVariants([strong, weak])).toEqual({ weak: ["strong"] });
  });

  it("requires every preparation to have a unique seeded winning context", () => {
    const value = {
      id: "value",
      terms: terms({ priceCents: 500, ingredientCostCents: 200, starAppeal: 3 }),
      nutritionFit: 0.5,
    };
    const premium = {
      id: "premium",
      terms: terms({ priceCents: 900, ingredientCostCents: 300, starAppeal: 5 }),
      nutritionFit: 0.7,
    };
    expect(validateVariantWinningContexts([value, premium], [
      { id: "tight-budget", weights: { affordability: 1 } },
      { id: "star-seeker", weights: { starAppeal: 1 } },
    ])).toEqual([]);
    expect(validateVariantWinningContexts([value, premium], [
      { id: "tight-budget", weights: { affordability: 1 } },
    ])).toEqual(["Variant premium has no unique winning context."]);
  });
});
