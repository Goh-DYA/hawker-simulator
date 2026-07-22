import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DISHES } from "@/src/content/dishes";
import { NUTRITION_CONTENT } from "@/src/content/nutrition";
import {
  PREPARATION_FAMILY_REVIEWS,
  PREPARATION_GAMEPLAY_CATALOGUE,
  REVIEWED_MEAL_ROLES,
  ingredientCostFromBasisPoints,
  validatePreparationGameplayContent,
} from "@/src/content/preparationGameplay";
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
    }
  });

  it("has no dominant preparations and gives every preparation a winning context", () => {
    const issues = validatePreparationGameplayContent();
    expect(issues.filter((issue) => issue.code === "dominant-preparation")).toEqual([]);
    expect(issues.filter((issue) => issue.code === "missing-winning-context")).toEqual([]);
    expect(PREPARATION_FAMILY_REVIEWS.every((family) => (
      family.preparationIds.length === family.winningContexts.length
    ))).toBe(true);
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
    }
  });
});
