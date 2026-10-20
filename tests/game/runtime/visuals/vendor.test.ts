/**
 * Contract tests for the code-native stall vendor visual recipes and poses in
 * `runtime/visuals/vendor.ts`.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { STALLS } from "@/src/content/index";
import {
  vendorAnimationPoseForStall,
  visualRecipeForStallVendor,
} from "@/src/game/runtime/visuals/vendor";

describe("code-native stall vendor visual recipes", () => {
  it("gives every stall vendor a deterministic and materially distinct work profile", () => {
    const recipes = STALLS.map(visualRecipeForStallVendor);

    assert.equal(recipes.length, 18);
    assert.deepEqual(recipes, STALLS.map(visualRecipeForStallVendor));
    assert.equal(new Set(recipes.map((recipe) => recipe.contractKey)).size, STALLS.length);
    assert.equal(new Set(recipes.map((recipe) => recipe.renderSignature)).size, STALLS.length);
    assert.equal(new Set(recipes.map((recipe) => recipe.tool)).size, STALLS.length);
    assert.equal(new Set(recipes.map((recipe) => recipe.workAction)).size, STALLS.length);
    assert.equal(new Set(recipes.map((recipe) => recipe.emblem)).size, STALLS.length);
    assert.ok(new Set(recipes.map((recipe) => recipe.skin)).size >= 5);
    assert.ok(new Set(recipes.map((recipe) => recipe.hair)).size >= 4);
    assert.ok(new Set(recipes.map((recipe) => recipe.shirt)).size >= 6);
    assert.ok(new Set(recipes.map((recipe) => recipe.apron)).size >= 10);
    for (const recipe of recipes) {
      assert.ok(recipe.skin > 0);
      assert.ok(recipe.hair > 0);
      assert.ok(recipe.shirt > 0);
      assert.ok(recipe.apron > 0);
      assert.ok(recipe.apronTrim > 0);
      assert.ok(recipe.hairStyle.length >= 4);
      assert.ok(recipe.apronStyle.length >= 3);
      assert.ok(recipe.headwear.length >= 5);
      assert.ok(recipe.tool.length >= 5);
      assert.ok(recipe.workAction.length >= 4);
      assert.ok(recipe.emblem.length >= 5);
      assert.match(recipe.contractKey, new RegExp(`^${recipe.stallId.replace(".", "\\.")}:`));
    }

    assert.equal(
      recipes.find((recipe) => recipe.stallId === "stall.pick-and-mix")?.tool,
      "ingredient-tongs",
    );
    assert.equal(
      recipes.find((recipe) => recipe.stallId === "stall.herbal-cauldron")?.tool,
      "claypot-ladle",
    );

    const source = STALLS[0];
    assert.ok(source);
    const futureStall = {
      ...source,
      id: "stall.future-steamer",
      animationReferences: [
        "stall.common.idle",
        "stall.steamer-lid.prepare",
        "stall.basket-stack.serve",
      ],
    };
    const futureRecipe = visualRecipeForStallVendor(futureStall);
    assert.deepEqual(futureRecipe, visualRecipeForStallVendor(futureStall));
    assert.equal(futureRecipe.tool, "steamer-cloth");
    assert.equal(futureRecipe.workAction, "lift-steamer");
  });

  it("animates stall vendors deterministically across idle, ordering, and preparation", () => {
    const stall = STALLS.find((candidate) => candidate.id === "stall.cinder-wok");
    assert.ok(stall);
    const recipe = visualRecipeForStallVendor(stall);

    for (const activity of ["idle", "order", "prepare"] as const) {
      const early = vendorAnimationPoseForStall(recipe, 7, false, activity);
      const repeated = vendorAnimationPoseForStall(recipe, 7, false, activity);
      const late = vendorAnimationPoseForStall(recipe, 11, false, activity);
      assert.deepEqual(early, repeated);
      assert.notDeepEqual(early, late);
      assert.ok(
        [
          early.bob,
          early.lean,
          early.headTurn,
          early.workingArm,
          early.supportArm,
          early.toolAngle,
          early.toolLift,
          early.reach,
        ].some((offset) => Math.abs(offset) > 0),
      );
    }
  });

  it("freezes every stall vendor offset when reduced motion is enabled", () => {
    const stall = STALLS.find((candidate) => candidate.id === "stall.bamboo-basket");
    assert.ok(stall);
    const recipe = visualRecipeForStallVendor(stall);

    for (const activity of ["idle", "order", "prepare"] as const) {
      const early = vendorAnimationPoseForStall(recipe, 1, true, activity);
      const late = vendorAnimationPoseForStall(recipe, 10_000, true, activity);
      assert.deepEqual(early, late);
      assert.deepEqual(
        {
          bob: early.bob,
          lean: early.lean,
          headTurn: early.headTurn,
          workingArm: early.workingArm,
          supportArm: early.supportArm,
          toolAngle: early.toolAngle,
          toolLift: early.toolLift,
          reach: early.reach,
        },
        {
          bob: 0,
          lean: 0,
          headTurn: 0,
          workingArm: 0,
          supportArm: 0,
          toolAngle: 0,
          toolLift: 0,
          reach: 0,
        },
      );
    }
  });
});
