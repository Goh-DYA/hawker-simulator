/**
 * Contract tests for the code-native customer visual recipes, animation poses and status legend
 * in `runtime/visuals/customer.ts`.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { CUSTOMER_ARCHETYPES } from "@/src/content/index";
import type { CustomerStatus } from "@/src/game/core/index";
import {
  CUSTOMER_INDICATOR_LEGEND,
  animationPoseForCustomer,
  customerAppearanceForId,
  type CustomerIndicator,
  visualRecipeForCustomer,
} from "@/src/game/runtime/visuals/customer";

describe("code-native customer visual recipes", () => {
  it("maps all archetypes and customer states to readable visual contracts", () => {
    const archetypes = CUSTOMER_ARCHETYPES.map(visualRecipeForCustomer);
    assert.equal(archetypes.length, 12);
    assert.equal(
      new Set(archetypes.map((recipe) => recipe.renderSignature)).size,
      archetypes.length,
    );

    const appearances = Array.from({ length: 24 }, (_, index) =>
      customerAppearanceForId(`customer-${index + 1}`),
    );
    assert.deepEqual(customerAppearanceForId("customer-7"), customerAppearanceForId("customer-7"));
    assert.ok(new Set(appearances.map((appearance) => appearance.skin)).size > 1);
    assert.ok(new Set(appearances.map((appearance) => appearance.clothing)).size > 1);

    const states: CustomerStatus[] = [
      "choosing-stall",
      "walking-to-queue",
      "queued",
      "ordering",
      "waiting-for-food",
      "seeking-seat",
      "walking-to-seat",
      "eating",
      "seeking-tray-return",
      "walking-to-tray-return",
      "walking-to-exit",
    ];
    const poses = states.map((status) => animationPoseForCustomer(status, 7, 19, false));
    assert.equal(new Set(poses.map((pose) => pose.signature)).size, states.length);
    assert.ok(poses.some((pose) => Math.abs(pose.stride) > 0));

    const walkingEarly = animationPoseForCustomer("walking-to-seat", 7, 19, false);
    const walkingLate = animationPoseForCustomer("walking-to-seat", 8, 19, false);
    assert.notEqual(walkingEarly.stride, walkingLate.stride);
    assert.notEqual(walkingEarly.bob, walkingLate.bob);

    for (const status of states) {
      const still = animationPoseForCustomer(status, 7, 19, true);
      assert.equal(still.bob, 0);
      assert.equal(still.stride, 0);
      assert.equal(still.armSwing, 0);
    }
  });

  it("keeps the customer status legend aligned with every runtime indicator", () => {
    const expectedIndicators: Readonly<Record<CustomerStatus, CustomerIndicator>> = {
      "choosing-stall": "question",
      "walking-to-queue": "footsteps",
      queued: "queue",
      ordering: "order",
      "waiting-for-food": "clock",
      "seeking-seat": "seat",
      "walking-to-seat": "footsteps",
      eating: "meal",
      "seeking-tray-return": "return",
      "walking-to-tray-return": "return",
      "walking-to-exit": "exit",
    };

    for (const [status, expectedIndicator] of Object.entries(expectedIndicators)) {
      const pose = animationPoseForCustomer(status as CustomerStatus, 7, 19, false);
      assert.equal(pose.indicator, expectedIndicator);
    }

    assert.deepEqual(
      CUSTOMER_INDICATOR_LEGEND.map((entry) => entry.indicator).sort(),
      [...new Set(Object.values(expectedIndicators))].sort(),
    );
    assert.equal(
      new Set(CUSTOMER_INDICATOR_LEGEND.map((entry) => entry.label)).size,
      CUSTOMER_INDICATOR_LEGEND.length,
    );
    assert.ok(CUSTOMER_INDICATOR_LEGEND.every((entry) => entry.description.length >= 24));
  });
});
