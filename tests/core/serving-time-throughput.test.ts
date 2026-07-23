import { describe, expect, it } from "vitest";

import { stepSimulation, type SimulationCatalog } from "@/src/game/core";
import { makeGame, TEST_CATALOG } from "./fixtures";

function catalogueWithServingTime(servingMs: number): SimulationCatalog {
  return {
    ...TEST_CATALOG,
    dishes: {
      noodles: {
        ...TEST_CATALOG.dishes.noodles!,
        preparationMs: 100,
        servingMs,
      },
    },
    placeables: {
      ...TEST_CATALOG.placeables,
      stall: {
        ...TEST_CATALOG.placeables.stall!,
        stall: {
          ...TEST_CATALOG.placeables.stall!.stall!,
          dishIds: ["noodles"],
          allDishIds: ["noodles"],
          orderMs: 100,
        },
      },
    },
  };
}

function ticksUntilFirstSale(servingMs: number) {
  const initial = makeGame({
    catalog: catalogueWithServingTime(servingMs),
    seed: "serving-time-throughput",
  });
  let state = stepSimulation({
    ...initial,
    forecast: {
      ...initial.forecast,
      budgetBands: [{
        id: "fixture-budget",
        basisPoints: 10_000,
        minimumCents: 3_000,
        maximumCents: 3_000,
      }],
    },
  });
  state = {
    ...state,
    servicePeriod: {
      ...state.servicePeriod,
      phase: "draining",
      cohortCustomerIds: Object.keys(state.customers),
    },
  };
  const startedAt = state.tick;
  while (state.periodLedgers[state.servicePeriod.sequenceId]!.grossSalesCents === 0) {
    state = stepSimulation(state);
    if (state.tick - startedAt > 300) throw new Error("Fixture did not complete its first sale.");
  }
  return {
    ticks: state.tick - startedAt,
    snapshot: Object.values(state.customers)[0]?.orderLineSnapshot,
  };
}

describe("serving-time throughput", () => {
  it("uses the frozen serving time in the actual handoff duration", () => {
    const quick = ticksUntilFirstSale(0);
    const attentive = ticksUntilFirstSale(5_000);

    expect(attentive.ticks - quick.ticks).toBeGreaterThanOrEqual(50);
    expect(quick.snapshot?.terms.servingTimeMs).toBe(0);
    expect(attentive.snapshot?.terms.servingTimeMs).toBe(5_000);
  });
});
