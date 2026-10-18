/**
 * Contract tests for the code-native placeable visual recipes in `runtime/visuals/placeable.ts`.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { PLACEABLES } from "@/src/content/index";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";

describe("code-native placeable visual recipes", () => {
  it("assigns every launch placeable a stable, materially distinct semantic contract", () => {
    const recipes = PLACEABLES.map((item) =>
      visualRecipeForPlaceable(item.id, item.category, item.tags),
    );

    assert.equal(recipes.length, 80);
    assert.equal(new Set(recipes.map((recipe) => recipe.contractKey)).size, 80);
    assert.equal(new Set(recipes.map((recipe) => recipe.semanticKey)).size, 80);
    assert.equal(new Set(recipes.map((recipe) => recipe.motif)).size, 80);
    assert.ok(recipes.every((recipe) => recipe.motif.length >= 4));
    assert.ok(recipes.every((recipe) => recipe.form.length >= 4));
    assert.ok(recipes.every((recipe) => recipe.material !== "composite"));
    assert.ok(recipes.every((recipe) => recipe.detailCues.length >= 2));
    assert.deepEqual(
      recipes,
      PLACEABLES.map((item) => visualRecipeForPlaceable(item.id, item.category, item.tags)),
    );
  });
});
