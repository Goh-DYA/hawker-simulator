import { describe, expect, it } from "vitest";

import {
  createServingTerms,
  scoreVariantContext,
  validateVariantWinningContexts,
  variantDominates,
  type VariantTradeoff,
} from "@/src/game/core/servingTerms";

function tradeoff(
  id: string,
  overrides: Partial<Parameters<typeof createServingTerms>[0]> = {},
  nutritionFits: Readonly<Record<string, number | undefined>> = {
    "sodium-aware": 0.75,
  },
): VariantTradeoff {
  return {
    id,
    terms: createServingTerms({
      priceCents: 700,
      ingredientCostCents: 245,
      preparationTimeMs: 20_000,
      servingTimeMs: 8_000,
      eatingTimeMs: 40_000,
      starAppeal: 3.5,
      demandModifierBasisPoints: 10_000,
      ...overrides,
    }),
    nutritionFits,
  };
}

describe("complete variant trade-off dimensions", () => {
  it("treats preparation, serving, and eating time as separate dominance axes", () => {
    const candidate = tradeoff("candidate", {
      priceCents: 650,
      ingredientCostCents: 180,
      preparationTimeMs: 18_000,
      servingTimeMs: 7_000,
      eatingTimeMs: 45_000,
      starAppeal: 4,
      demandModifierBasisPoints: 10_500,
    });
    const other = tradeoff("other");

    expect(variantDominates(candidate, other)).toBe(false);
    expect(variantDominates({
      ...candidate,
      terms: createServingTerms({
        ...candidate.terms,
        eatingTimeMs: 35_000,
      }),
    }, other)).toBe(true);
  });

  it("checks every need-specific nutrition fit before declaring dominance", () => {
    const candidate = tradeoff("candidate", {
      priceCents: 650,
      ingredientCostCents: 200,
      preparationTimeMs: 18_000,
      servingTimeMs: 7_000,
      eatingTimeMs: 35_000,
      starAppeal: 4,
      demandModifierBasisPoints: 10_500,
    }, {
      "sodium-aware": 0.9,
      "fibre-forward": 0.4,
    });
    const other = tradeoff("other", {}, {
      "sodium-aware": 0.7,
      "fibre-forward": 0.8,
    });

    expect(variantDominates(candidate, other)).toBe(false);
  });

  it("does not impute an unavailable nutrition fit into a winning score", () => {
    const known = tradeoff("known", {}, { "sodium-aware": 0.8 });
    const unavailable = tradeoff("unavailable", {
      priceCents: 600,
    }, { "sodium-aware": undefined });
    const context = {
      id: "sodium-request",
      nutritionNeedId: "sodium-aware",
      weights: { affordability: 0.2, nutritionFit: 0.8 },
    } as const;

    expect(scoreVariantContext([known, unavailable], context)).toEqual([
      { id: "known", score: 0.8 },
      { id: "unavailable", score: Number.NEGATIVE_INFINITY },
    ]);
    expect(validateVariantWinningContexts([known, unavailable], [context])).toEqual([
      "Variant unavailable has no unique winning context.",
    ]);
  });

  it("applies a hard visit budget before scoring a plausible context", () => {
    const value = tradeoff("value", { priceCents: 600 });
    const premium = tradeoff("premium", {
      priceCents: 900,
      ingredientCostCents: 300,
      preparationTimeMs: 12_000,
      starAppeal: 5,
      demandModifierBasisPoints: 11_000,
    });
    const context = {
      id: "budget-700",
      maximumPriceCents: 700,
      weights: { contribution: 1, preparationTime: 1, starAppeal: 1 },
    } as const;

    expect(scoreVariantContext([value, premium], context)[0]?.id).toBe("value");
    expect(scoreVariantContext([value, premium], context)[1]?.score)
      .toBe(Number.NEGATIVE_INFINITY);
  });
});
