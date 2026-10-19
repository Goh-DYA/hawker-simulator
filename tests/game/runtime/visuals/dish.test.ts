/**
 * Contract tests for the code-native dish and nutrition-variant visual recipes in
 * `runtime/visuals/dish.ts`.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { DISHES, NUTRITION_CONTENT } from "@/src/content/index";
import { nutritionVisualKeyForVariant } from "@/src/game/runtime/nutrition";
import {
  variantVisualFamilyForKey,
  visualRecipeForDish,
  visualRecipeForDishVariant,
} from "@/src/game/runtime/visuals/dish";

describe("code-native dish visual recipes", () => {
  it("gives every dish a unique, recognisable real-life serving profile", () => {
    const recipes = DISHES.map(visualRecipeForDish);

    assert.equal(recipes.length, 67);
    assert.equal(new Set(recipes.map((recipe) => recipe.contractKey)).size, DISHES.length);
    assert.equal(
      new Set(recipes.map((recipe) => recipe.presentation.semanticKey)).size,
      DISHES.length,
    );
    assert.equal(
      new Set(recipes.map((recipe) => recipe.presentation.motif)).size,
      DISHES.length,
    );
    for (const [index, recipe] of recipes.entries()) {
      assert.match(recipe.foodFrame, /.+:.+/);
      assert.match(recipe.containerFrame, /.+:.+/);
      assert.equal(recipe.steam, DISHES[index]?.steamEffect);
      assert.ok(recipe.portionColour > 0);
      assert.equal(recipe.presentation.source, "catalogue");
      assert.ok(recipe.presentation.ingredientCues.length >= 2);
      assert.ok(recipe.presentation.detailCues.length >= 1);
      assert.doesNotMatch(recipe.presentation.motif, /generic|catalogue/);
    }
  });

  it("distinguishes visually similar menu families with real ingredient and serviceware cues", () => {
    const recipes = new Map(
      DISHES.map((dish) => [dish.id, visualRecipeForDish(dish)]),
    );

    assert.deepEqual(
      recipes.get("dish.poached-chicken-rice")?.presentation.ingredientCues,
      ["fragrant-rice", "poached-chicken", "cucumber"],
    );
    assert.deepEqual(
      recipes.get("dish.roast-chicken-rice")?.presentation.ingredientCues,
      ["fragrant-rice", "roast-chicken", "cucumber"],
    );
    assert.equal(
      recipes.get("dish.kopi")?.presentation.vessel,
      "kopitiam-cup-and-saucer",
    );
    assert.equal(
      recipes.get("dish.sugarcane-juice")?.presentation.vessel,
      "tall-drinking-glass",
    );
    assert.equal(
      recipes.get("dish.ice-kacang")?.presentation.portionShape,
      "shaved-ice",
    );
    assert.ok(
      recipes.get("dish.black-pepper-crab")?.presentation.ingredientCues.includes("quarter-crab"),
    );
    assert.ok(
      recipes.get("dish.har-gow")?.presentation.detailCues.includes("light-soup"),
    );
    assert.equal(
      recipes.get("dish.har-gow")?.presentation.vessel,
      "deep-ceramic-bowl",
    );
    assert.equal(
      recipes.get("dish.ayam-buah-keluak")?.presentation.portionShape,
      "braised-scoop",
    );
    assert.equal(
      recipes.get("dish.chap-chye")?.presentation.portionShape,
      "vegetable-scoop",
    );
    assert.ok(
      !recipes.get("dish.babi-pongteh")?.presentation.ingredientCues.includes("rice"),
    );
    assert.ok(
      recipes.get("dish.siew-mai")?.presentation.detailCues.includes("crab-roe"),
    );
    assert.equal(
      recipes.get("dish.siew-mai")?.presentation.vessel,
      "bamboo-steamer",
    );
    assert.equal(
      recipes.get("dish.sambal-grilled-squid")?.presentation.vessel,
      "banana-leaf-lined-plate",
    );
    assert.equal(
      recipes.get("dish.chicken-satay-set")?.presentation.vessel,
      "shared-oval-platter",
    );
    assert.equal(
      recipes.get("dish.teh-tarik")?.presentation.vessel,
      "tall-drinking-glass",
    );
    assert.ok(
      recipes.get("dish.chicken-satay-set")?.presentation.detailCues.includes("bamboo-skewers"),
    );
    assert.ok(
      recipes.get("dish.pulut-hitam")?.presentation.detailCues.includes("white-coconut-swirl"),
    );
    assert.ok(
      recipes.get("dish.yong-tau-foo")?.presentation.ingredientCues.includes("stuffed-tofu"),
    );
    assert.ok(
      recipes.get("dish.thunder-tea-rice")?.presentation.detailCues.includes("green-tea-broth"),
    );
    assert.ok(
      recipes.get("dish.bak-kut-teh")?.presentation.ingredientCues.includes("pork-ribs"),
    );
    assert.ok(
      recipes.get("dish.claypot-chicken-rice")?.presentation.detailCues.includes("claypot-crust"),
    );
  });

  it("gives every reviewed nutrition variant a non-colour composition contract", () => {
    const dishById = new Map(DISHES.map((dish) => [dish.id, dish]));
    const recipes = NUTRITION_CONTENT.variantFamilies.flatMap((family) => {
      const dish = dishById.get(family.dishId);
      assert.ok(dish);
      return family.variants.map((variant) =>
        visualRecipeForDishVariant(dish, variant.visualKey),
      );
    });

    assert.ok(recipes.length > 40);
    assert.equal(
      new Set(recipes.map((recipe) => recipe.presentation.semanticKey)).size,
      recipes.length,
    );
    assert.equal(
      new Set(recipes.map((recipe) => recipe.variantGeometryCue)).size,
      recipes.length,
    );
    assert.ok(recipes.every((recipe) => recipe.variantVisualKey));
    assert.ok(recipes.every((recipe) => recipe.variantVisualFamily !== "fallback"));
    assert.ok(
      recipes.every((recipe) =>
        recipe.presentation.detailCues.includes(recipe.variantGeometryCue as string),
      ),
    );
    assert.deepEqual(
      new Set(recipes.map((recipe) => recipe.variantVisualFamily)),
      new Set([
        "drink",
        "nasi-lemak",
        "carrot-cake",
        "prata",
        "fish-soup",
        "bak-chor",
        "murtabak",
        "briyani",
        "thosai",
        "yong-tau-foo",
        "ban-mian",
        "bak-kut-teh",
        "duck-rice",
      ]),
    );
    assert.equal(variantVisualFamilyForKey("future-variant"), "fallback");
  });

  it("omits variant geometry for synthetic listed servings", () => {
    const family = NUTRITION_CONTENT.variantFamilies[0];
    const variant = family?.variants[0];
    assert.ok(family);
    assert.ok(variant);
    assert.equal(
      nutritionVisualKeyForVariant(family.dishId, variant.id),
      variant.visualKey,
    );

    const listedProfile = NUTRITION_CONTENT.profiles.find(
      (profile) =>
        profile.id === profile.dishId &&
        !NUTRITION_CONTENT.variantFamilies.some(
          (candidate) => candidate.dishId === profile.dishId,
        ),
    );
    assert.ok(listedProfile);
    const dish = DISHES.find((candidate) => candidate.id === listedProfile.dishId);
    assert.ok(dish);
    const visualKey = nutritionVisualKeyForVariant(listedProfile.dishId, listedProfile.id);
    const recipe = visualRecipeForDishVariant(dish, visualKey);

    assert.equal(visualKey, undefined);
    assert.equal(recipe.variantVisualKey, undefined);
    assert.equal(recipe.variantGeometryCue, undefined);
  });

  it("infers a useful deterministic profile for future catalogue dishes", () => {
    const source = DISHES[0];
    assert.ok(source);
    const futureDish = {
      ...source,
      id: "dish.future-spicy-noodle-bowl",
      category: "noodles" as const,
      preferenceTags: ["noodles", "spicy", "vegetable-forward"],
      dietaryTags: ["spicy" as const],
      foodSprite: { atlas: "food", frame: "future-spicy-noodle-bowl" },
      containerSprite: { atlas: "serviceware", frame: "bowl" },
    };

    const first = visualRecipeForDish(futureDish);
    const second = visualRecipeForDish(futureDish);
    assert.deepEqual(first, second);
    assert.equal(first.presentation.source, "inferred");
    assert.equal(first.presentation.portionShape, "noodle-tangle");
    assert.equal(first.presentation.vessel, "deep-ceramic-bowl");
    assert.ok(first.presentation.ingredientCues.includes("noodles"));
    assert.deepEqual(first.presentation.detailCues, ["chilli-garnish"]);
  });
});
