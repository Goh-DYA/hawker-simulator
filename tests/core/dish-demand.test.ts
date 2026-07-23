import { describe, expect, it } from "vitest";
import {
  boundedDishDemandAppeal,
  sgdToCents,
  stepSimulation,
  type GameState,
  type SimulationCatalog,
} from "../../src/game/core";
import { makeGame, TEST_CATALOG } from "./fixtures";

function demandCatalog(): SimulationCatalog {
  const sharedDish = {
    price: 6,
    priceCents: sgdToCents(6),
    ingredientCostCents: sgdToCents(0),
    preparationMs: 100_000,
    eatingMs: 1_000,
    quality: 0.7,
    preferenceTags: [] as readonly string[],
  };
  return {
    ...TEST_CATALOG,
    dishes: {
      "low-demand": { id: "low-demand", ...sharedDish, baseDemand: 0.1 },
      "high-demand": { id: "high-demand", ...sharedDish, baseDemand: 0.9 },
    },
    archetypes: {
      regular: {
        ...TEST_CATALOG.archetypes.regular,
        preferenceTags: [],
      },
    },
    placeables: {
      ...TEST_CATALOG.placeables,
      stall: {
        ...TEST_CATALOG.placeables.stall,
        stall: {
          ...TEST_CATALOG.placeables.stall.stall,
          dishIds: ["low-demand", "high-demand"],
          orderMs: 1,
        } as NonNullable<typeof TEST_CATALOG.placeables.stall.stall>,
      },
    },
  };
}

describe("dish base demand", () => {
  it("is neutral by default and bounded for malformed content", () => {
    const dish = TEST_CATALOG.dishes.rice;

    expect(boundedDishDemandAppeal(dish)).toBe(0);
    expect(boundedDishDemandAppeal({ ...dish, baseDemand: -4 })).toBe(-0.4);
    expect(boundedDishDemandAppeal({ ...dish, baseDemand: 7 })).toBe(0.4);
  });

  it("treats preparation demand terms as multipliers of authored base demand", () => {
    const dish = { ...TEST_CATALOG.dishes.rice, baseDemand: 0.8 };

    expect(boundedDishDemandAppeal({ ...dish, demandModifierBasisPoints: 10_000 })).toBeCloseTo(0.24);
    expect(boundedDishDemandAppeal({ ...dish, demandModifierBasisPoints: 10_800 })).toBeCloseTo(0.2912);
  });

  it("breaks otherwise equal menu choices in favour of the authored demand", () => {
    let state: GameState = makeGame({
      catalog: demandCatalog(),
      config: {
        fixedStepMs: 100,
        spawnIntervalMs: 100_000,
        standard: { maxActiveCustomers: 1 },
      },
    });

    for (let step = 0; step < 100; step += 1) {
      state = stepSimulation(state);
      const ordered = Object.values(state.customers).find(
        (customer) => customer.orderedDishId,
      );
      if (ordered) {
        expect(ordered.orderedDishId).toBe("high-demand");
        return;
      }
    }

    throw new Error("The test customer never reached the ordering state.");
  });
});
