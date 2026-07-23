import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DISHES } from "@/src/content/dishes";
import { NUTRITION_CONTENT } from "@/src/content/nutrition";
import {
  MAX_VARIANT_PRICE_PREMIUM_BASIS_POINTS,
  MIN_VARIANT_PRICE_BASIS_POINTS,
  PREPARATION_FAMILY_REVIEWS,
  PREPARATION_GAMEPLAY_BY_ID,
  PREPARATION_GAMEPLAY_CATALOGUE,
  REVIEWED_PREPARATION_OPERATIONS,
  REVIEWED_MEAL_ROLES,
  derivePreparationForecastResponses,
  ingredientCostFromBasisPoints,
  validatePreparationGameplayContent,
} from "@/src/content/preparationGameplay";
import {
  VARIANT_TRADEOFF_AXES,
  createServingTerms,
  findDominatedVariants,
  scoreVariantContext,
} from "@/src/game/core/servingTerms";
import {
  DEFAULT_PERIOD_DEMAND_PROFILES,
  assessForecastCoverage,
  derivePeriodForecast,
} from "@/src/game/core/forecast";
import {
  PRIMARY_PROFILE_MAPPINGS,
  VARIANT_FAMILY_MAPPINGS,
} from "@/tools/nutrition/manifest.mjs";
import {
  canonicalRowHash,
  parseCsv,
} from "@/tools/nutrition/importer.mjs";

describe("reviewed preparation gameplay content", () => {
  it("covers every dish with one explicit reviewed meal role", () => {
    expect(Object.keys(REVIEWED_MEAL_ROLES).sort()).toEqual(
      DISHES.map((dish) => dish.id).sort(),
    );
    expect(Object.values(REVIEWED_MEAL_ROLES).every((role) => (
      role === "main" || role === "side" || role === "drink"
    ))).toBe(true);
    expect(REVIEWED_MEAL_ROLES).toMatchObject({
      "dish.fried-carrot-cake": "main",
      "dish.idli-sambar": "main",
      "dish.chicken-satay-set": "main",
      "dish.beef-satay-set": "main",
      "dish.char-siew-bao": "main",
      "dish.vadai-set": "side",
      "dish.siew-mai": "side",
    });
  });

  it("covers every selectable manifest preparation and no invented variant", () => {
    const manifestVariantIds = new Set(
      VARIANT_FAMILY_MAPPINGS.flatMap((family) => (
        family.variants.map((variant) => `${family.dishId}::${variant.id}`)
      )),
    );
    const familyDishIds = new Set(VARIANT_FAMILY_MAPPINGS.map((family) => family.dishId));
    const expectedIds = new Set([
      ...manifestVariantIds,
      ...PRIMARY_PROFILE_MAPPINGS
        .filter((mapping) => !familyDishIds.has(mapping.dishId))
        .map((mapping) => `${mapping.dishId}::base`),
    ]);
    expect(new Set(PREPARATION_GAMEPLAY_CATALOGUE.map((entry) => entry.id))).toEqual(
      expectedIds,
    );
  });

  it("keeps cents safe, default prices nominal, and ingredient rates reviewed", () => {
    for (const preparation of PREPARATION_GAMEPLAY_CATALOGUE) {
      expect(Number.isSafeInteger(preparation.terms.priceCents)).toBe(true);
      expect(Number.isSafeInteger(preparation.terms.ingredientCostCents)).toBe(true);
      expect(preparation.terms.ingredientCostBasisPoints).toBeGreaterThanOrEqual(2_800);
      expect(preparation.terms.ingredientCostBasisPoints).toBeLessThanOrEqual(4_200);
      if (REVIEWED_PREPARATION_OPERATIONS[preparation.id]) {
        expect(preparation.terms.ingredientCostBasisPoints, preparation.id)
          .toBeGreaterThanOrEqual(3_200);
        expect(preparation.terms.ingredientCostBasisPoints, preparation.id)
          .toBeLessThanOrEqual(3_800);
      }
      expect(preparation.terms.ingredientCostCents).toBe(
        ingredientCostFromBasisPoints(
          preparation.terms.priceCents,
          preparation.terms.ingredientCostBasisPoints,
        ),
      );
      if (preparation.isDefault) {
        const dish = DISHES.find((candidate) => candidate.id === preparation.dishId)!;
        expect(preparation.terms.priceCents).toBe(Math.round(dish.price * 100));
      }
      expect(Object.isFrozen(preparation)).toBe(true);
      expect(Object.isFrozen(preparation.terms)).toBe(true);
      expect(Object.isFrozen(preparation.nutritionFitByIntent)).toBe(true);
      expect(Object.isFrozen(preparation.conditionFitByCondition)).toBe(true);
    }
  });

  it("covers every family preparation with an explicit semantic operational review", () => {
    const expectedIds = NUTRITION_CONTENT.variantFamilies.flatMap((family) => (
      family.variants.map((variant) => `${family.dishId}::${variant.id}`)
    ));
    expectedIds.push("dish.poached-chicken-rice::base");
    expectedIds.sort();

    expect(Object.keys(REVIEWED_PREPARATION_OPERATIONS).sort()).toEqual(expectedIds);
    for (const preparation of PREPARATION_GAMEPLAY_CATALOGUE.filter((entry) => (
      REVIEWED_PREPARATION_OPERATIONS[entry.id]
    ))) {
      expect(preparation.operationalReviewNote.trim().length, preparation.id)
        .toBeGreaterThan(35);
      expect(preparation.operationalReviewNote, preparation.id)
        .not.toContain("Alternative exchanges a higher price");
    }
  });

  it("uses a modest practised-staple profile only for the two starter defaults", () => {
    for (const id of [
      "dish.poached-chicken-rice::base",
      "dish.nasi-lemak::nasi-lemak-chicken-wing",
    ]) {
      const preparation = PREPARATION_GAMEPLAY_BY_ID[id]!;
      const dish = DISHES.find((candidate) => candidate.id === preparation.dishId)!;
      expect(preparation.terms.priceCents, id).toBe(Math.round(dish.price * 100));
      expect(preparation.terms.ingredientCostBasisPoints, id).toBe(3_500);
      expect(preparation.terms.preparationTimeMs, id)
        .toBe(Math.round(dish.preparationTimeMs * 0.75));
      expect(preparation.terms.servingTimeMs, id)
        .toBe(Math.round(dish.servingTimeMs * 0.75));
      expect(preparation.terms.eatingTimeMs, id)
        .toBe(Math.round(dish.eatingTimeMs * 0.8));
      expect(preparation.terms.starAppeal, id).toBe(dish.starRating);
      expect(preparation.terms.demandModifierBasisPoints, id).toBe(10_000);
      expect(preparation.operationalReviewNote, id).toContain("batches");
    }
  });

  it("allows reviewed smaller portions while capping premiums at 18 percent", () => {
    let largestPremiumBasisPoints = 0;
    let smallestPremiumBasisPoints = 0;
    for (const family of PREPARATION_FAMILY_REVIEWS) {
      const preparations = family.preparationIds.map((id) => PREPARATION_GAMEPLAY_BY_ID[id]!);
      const nominalPriceCents = preparations.find((preparation) => preparation.isDefault)!
        .terms.priceCents;
      for (const preparation of preparations) {
        const premiumBasisPoints = Math.floor(
          ((preparation.terms.priceCents - nominalPriceCents) * 10_000)
          / nominalPriceCents,
        );
        largestPremiumBasisPoints = Math.max(largestPremiumBasisPoints, premiumBasisPoints);
        smallestPremiumBasisPoints = Math.min(smallestPremiumBasisPoints, premiumBasisPoints);
        expect(premiumBasisPoints, preparation.id)
          .toBeGreaterThanOrEqual(MIN_VARIANT_PRICE_BASIS_POINTS - 10_000);
        expect(premiumBasisPoints, preparation.id)
          .toBeLessThanOrEqual(MAX_VARIANT_PRICE_PREMIUM_BASIS_POINTS);
      }
    }
    expect(largestPremiumBasisPoints).toBeGreaterThanOrEqual(1_700);
    expect(smallestPremiumBasisPoints).toBeLessThanOrEqual(-4_500);
  });

  it("prices and times plain, rice-only, and vegetable variants semantically", () => {
    const assertReducedServing = (reducedId: string, baselineId: string) => {
      const reduced = PREPARATION_GAMEPLAY_BY_ID[reducedId]!;
      const baseline = PREPARATION_GAMEPLAY_BY_ID[baselineId]!;
      expect(reduced.terms.priceCents, reducedId).toBeLessThan(baseline.terms.priceCents);
      expect(reduced.terms.preparationTimeMs, reducedId)
        .toBeLessThan(baseline.terms.preparationTimeMs);
      expect(reduced.terms.starAppeal, reducedId).toBeLessThan(baseline.terms.starAppeal);
      expect(
        reduced.terms.priceCents - reduced.terms.ingredientCostCents,
        reducedId,
      ).toBeLessThan(baseline.terms.priceCents - baseline.terms.ingredientCostCents);
    };

    assertReducedServing(
      "dish.nasi-lemak::nasi-lemak-rice-only",
      "dish.nasi-lemak::nasi-lemak-chicken-wing",
    );
    assertReducedServing(
      "dish.roti-prata::prata-plain",
      "dish.roti-prata::prata-two-plain-curry",
    );
    assertReducedServing(
      "dish.masala-thosai::thosai-plain",
      "dish.masala-thosai::thosai-masala",
    );
    assertReducedServing(
      "dish.duck-rice::duck-rice-rice-only",
      "dish.duck-rice::duck-rice-braised",
    );

    for (const [vegetableId, baselineId] of [
      ["dish.chicken-murtabak::murtabak-vegetable", "dish.chicken-murtabak::murtabak-chicken"],
      ["dish.nasi-briyani::briyani-vegetable", "dish.nasi-briyani::briyani-chicken"],
    ] as const) {
      const vegetable = PREPARATION_GAMEPLAY_BY_ID[vegetableId]!;
      const baseline = PREPARATION_GAMEPLAY_BY_ID[baselineId]!;
      expect(vegetable.terms.priceCents, vegetableId).toBeLessThan(baseline.terms.priceCents);
      expect(vegetable.terms.preparationTimeMs, vegetableId)
        .toBe(baseline.terms.preparationTimeMs);
    }
  });

  it("proves every real preparation uniquely wins a seeded all-axis context", () => {
    for (const family of PREPARATION_FAMILY_REVIEWS) {
      const preparations = family.preparationIds.map((id) => PREPARATION_GAMEPLAY_BY_ID[id]!);
      const tradeoffs = preparations.map((preparation) => ({
        id: preparation.id,
        terms: createServingTerms(preparation.terms),
        nutritionFits: Object.fromEntries([
          ...Object.entries(preparation.nutritionFitByIntent).map(([intentId, fit]) => [
            `intent:${intentId}`,
            fit,
          ]),
          ...Object.entries(preparation.conditionFitByCondition).map(([condition, fit]) => [
            `condition:${condition}`,
            fit,
          ]),
        ]),
      }));

      expect(findDominatedVariants(tradeoffs), family.dishId).toEqual({});
      expect(family.winningContexts, family.dishId).toHaveLength(preparations.length);
      expect(new Set(family.winningContexts.map((context) => context.preparationId)).size)
        .toBe(preparations.length);

      for (const context of family.winningContexts) {
        expect(Number.isSafeInteger(context.seed), context.id).toBe(true);
        expect(context.seed, context.id).toBeGreaterThan(0);
        expect(context.nutritionNeedId, context.id).toBeDefined();
        for (const axis of VARIANT_TRADEOFF_AXES) {
          expect(context.weights[axis], `${context.id}:${axis}`).toBeGreaterThan(0);
        }
        const weights = VARIANT_TRADEOFF_AXES.map((axis) => context.weights[axis] ?? 0);
        expect(Math.min(...weights), context.id).toBeGreaterThanOrEqual(0.2);
        expect(Math.max(...weights), context.id).toBeLessThanOrEqual(2);
        expect(Math.max(...weights) / Math.min(...weights), context.id)
          .toBeLessThanOrEqual(10);
        const expected = PREPARATION_GAMEPLAY_BY_ID[context.preparationId]!;
        expect(context.maximumPriceCents, context.id).toBe(expected.terms.priceCents);
        const scores = scoreVariantContext(tradeoffs, context);
        expect(scores[0]?.id, context.id).toBe(context.preparationId);
        expect(scores[0]?.score, context.id).toBeGreaterThan(scores[1]?.score ?? -Infinity);
      }
    }
  });

  it("derives required-need responses only from unlocked matching preparations", () => {
    const forecast = derivePeriodForecast(DEFAULT_PERIOD_DEMAND_PROFILES[0]!, 1, 1);
    const forecastNeed = forecast.nutritionNeeds.find(
      (candidate) => candidate.nutritionIntent === "sodium-aware",
    )!;
    const need = {
      id: forecastNeed.id,
      nutritionIntent: forecastNeed.nutritionIntent,
    };
    const allResponses = derivePreparationForecastResponses(
      [need],
      PREPARATION_GAMEPLAY_CATALOGUE.map((preparation) => preparation.id),
    );
    const viable = allResponses.filter((response) => response.viable);
    expect(viable.length).toBeGreaterThanOrEqual(2);

    const oneUnlocked = derivePreparationForecastResponses(
      [need],
      [viable[0]!.responseId],
      [viable[0]!.responseId],
    );
    const twoUnlocked = derivePreparationForecastResponses(
      [need],
      viable.slice(0, 2).map((response) => response.responseId),
      [viable[0]!.responseId],
    );
    expect(oneUnlocked.filter((response) => response.unlocked && response.viable)).toHaveLength(1);
    expect(oneUnlocked.filter((response) => response.active && response.viable)).toHaveLength(1);
    expect(twoUnlocked.filter((response) => response.unlocked && response.viable)).toHaveLength(2);
    expect(assessForecastCoverage(forecast, oneUnlocked).find(
      (coverage) => coverage.needId === need.id,
    )).toMatchObject({ covered: true, eligibleForRequiredContent: false });
    expect(assessForecastCoverage(forecast, twoUnlocked).find(
      (coverage) => coverage.needId === need.id,
    )).toMatchObject({ covered: true, eligibleForRequiredContent: true });

    const conditionNeed = forecast.nutritionNeeds.find(
      (candidate) => candidate.healthCondition === "hypertension",
    )!;
    expect(derivePreparationForecastResponses(
      [{ id: conditionNeed.id, healthCondition: conditionNeed.healthCondition }],
      PREPARATION_GAMEPLAY_CATALOGUE.map((preparation) => preparation.id),
    ).filter((response) => response.unlocked && response.viable).length).toBeGreaterThanOrEqual(2);
    expect(derivePreparationForecastResponses(
      [{ id: "need.condition-aware" }],
      PREPARATION_GAMEPLAY_CATALOGUE.map((preparation) => preparation.id),
    )).toEqual([]);
  });

  it("passes the complete catalogue validation", () => {
    expect(validatePreparationGameplayContent()).toEqual([]);
  });
});

describe("read-only nutrition provenance audit", () => {
  it("retains the authoritative source snapshot and exact source rows", () => {
    const sourcePath = resolve(
      process.cwd(),
      "data/food_nutrition_sgfoodid_combined_nutrition_subset.csv",
    );
    const source = readFileSync(sourcePath, "utf8");
    const snapshot = NUTRITION_CONTENT.sourceSnapshots.find((entry) => (
      entry.fileName === "food_nutrition_sgfoodid_combined_nutrition_subset.csv"
    ));
    expect(snapshot).toBeDefined();
    expect(createHash("sha256").update(source).digest("hex")).toBe(snapshot!.sha256);

    const parsed = parseCsv(source);
    for (const preparation of PREPARATION_GAMEPLAY_CATALOGUE) {
      const audit = preparation.nutritionAudit;
      if (audit.status !== "released") continue;
      const exactMatches = parsed.rows.filter((row) => (
        row.values["Food Name"] === audit.sourceFoodName
      ));
      expect(exactMatches, preparation.id).toHaveLength(1);
      const row = exactMatches[0]!;
      expect(row.sourceRowNumber, preparation.id).toBe(audit.sourceRowNumber);
      expect(canonicalRowHash(parsed.headers, row.values), preparation.id)
        .toBe(audit.sourceRowSha256);
      expect(audit.reviewNote).toContain("nutrition mapping");
      const profile = NUTRITION_CONTENT.profiles.find((candidate) => (
        candidate.id === preparation.profileId
      ))!;
      expect(preparation.nutritionFitByIntent, preparation.id).toEqual(profile.intentFits);
      expect(preparation.conditionFitByCondition, preparation.id)
        .toEqual(profile.conditionRatings);
      expect(audit.servingLabel, preparation.id).toBe(profile.serving?.label);
      expect(audit.sourceFileSha256, preparation.id).toBe(profile.provenance?.sourceFileSha256);
      expect(audit.sourceFoodName, preparation.id).toBe(profile.provenance?.sourceFoodName);
    }
  });
});
