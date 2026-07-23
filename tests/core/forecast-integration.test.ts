import { describe, expect, it } from "vitest";

import {
  deserializeGameState,
  compareForecastToArrivals,
  createPeriodLedger,
  eligibleForecastAudienceIds,
  forecastArrivalTarget,
  forecastForServicePeriod,
  lockPeriodForecast,
  migratePersistentState,
  NUTRITION_METRICS,
  persistentStateFromGame,
  planNextServicePeriod,
  startServicePeriod,
  stepSimulation,
  type NutritionProfile,
  type ForecastArrivalObservation,
  type GameState,
  type SimulationCatalog,
} from "@/src/game/core";
import {
  buildCatalog,
  decodeRuntimeSave,
  defaultDishVariants,
  deriveRuntimeForecastAvailability,
  freshState,
} from "@/src/game/runtime/createHawkerRuntime";
import { makeGame, TEST_CATALOG } from "./fixtures";

function releasedProfile(id: string, dishId: string): NutritionProfile {
  return {
    id,
    dishId,
    status: "released",
    nutrients: Object.fromEntries(NUTRITION_METRICS.map((metric) => [
      metric,
      { status: "unavailable", reason: "Fixture intentionally omits nutrient values." },
    ])) as unknown as NutritionProfile["nutrients"],
    intentFits: {
      "lighter-energy": 0.8,
      "protein-forward": 0.8,
      "fibre-forward": 0.8,
      "sodium-aware": 0.8,
      "lower-total-sugar-drink": 0.8,
    },
    conditionRatings: {
      "high-cholesterol": 4,
      obesity: 4,
      diabetes: 4,
      hypertension: 4,
    },
    nutritionClass: "meal",
  };
}

function nutritionCatalogue(activeDishId: "noodles" | "rice"): SimulationCatalog {
  return {
    ...TEST_CATALOG,
    dishes: Object.fromEntries(Object.entries(TEST_CATALOG.dishes).map(([id, dish]) => [id, {
      ...dish,
      defaultNutritionVariantId: `${id}-standard`,
      nutritionVariants: [{
        id: `${id}-standard`,
        label: "Standard",
        unlockRank: 1,
        profileId: `${id}-profile`,
        visualKey: id,
        profile: releasedProfile(`${id}-profile`, id),
      }],
    }])),
    placeables: {
      ...TEST_CATALOG.placeables,
      stall: {
        ...TEST_CATALOG.placeables.stall!,
        stall: {
          ...TEST_CATALOG.placeables.stall!.stall!,
          dishIds: [activeDishId],
          allDishIds: ["noodles", "rice"],
        },
      },
    },
  };
}

function productionPeriodState(
  level: number,
  periodIndex: 0 | 1 | 2 | 3,
  seed: string,
): GameState {
  const { catalog } = buildCatalog();
  const initial = freshState(catalog, seed);
  let planning = initial.servicePeriod;
  for (let index = 0; index < periodIndex; index += 1) {
    planning = planNextServicePeriod({ ...planning, phase: "debrief" });
  }
  const servicePeriod = startServicePeriod(planning);
  const progression = {
    ...initial.progression,
    level,
    reputation: 5,
    unlockedDefinitionIds: Object.keys(catalog.placeables),
  };
  const forecast = lockPeriodForecast(
    forecastForServicePeriod(servicePeriod),
    catalog,
    progression,
  );
  return {
    ...initial,
    objects: Object.fromEntries(Object.entries(initial.objects).map(([id, object]) => [id, {
      ...object,
      open: catalog.placeables[object.definitionId]?.kind === "stall" ? true : object.open,
    }])),
    progression,
    servicePeriod,
    periodLedgers: {
      [servicePeriod.sequenceId]: createPeriodLedger(
        servicePeriod.sequenceId,
        initial.economy.cashCents,
      ),
    },
    forecast,
    forecastArrivals: [],
  };
}

function runArrivalWindow(state: GameState, durationMs = 240_000): GameState {
  let current = state;
  for (let elapsedMs = 0; elapsedMs < durationMs; elapsedMs += current.config.fixedStepMs) {
    current = stepSimulation(current);
  }
  return current;
}

function arrivalTuple(arrival: ForecastArrivalObservation) {
  return {
    periodSequenceId: arrival.periodSequenceId,
    customerId: arrival.customerId,
    archetypeId: arrival.archetypeId,
    budgetCents: arrival.budgetCents,
    groupSize: arrival.groupSize,
    mealMixId: arrival.mealMixId,
    nutritionIntent: arrival.nutritionIntent,
    healthConditions: arrival.healthConditions,
  };
}

describe("forecast integration", () => {
  it("keeps production demand and locked audience calibrated at levels 1, 5, 13, and 20", () => {
    for (const level of [1, 5, 13, 20]) {
      for (const periodIndex of [0, 1, 2, 3] as const) {
        for (const seed of ["forecast-throughput", "forecast-value"]) {
          const initial = productionPeriodState(level, periodIndex, `${seed}-${level}-${periodIndex}`);
          const eligibleIds = new Set(eligibleForecastAudienceIds(initial.catalog, initial.progression));
          expect(initial.forecast.crowdProfiles.length).toBeGreaterThan(0);
          expect(initial.forecast.crowdProfiles.every((profile) => eligibleIds.has(profile.id))).toBe(true);
          if (level === 1) {
            expect(initial.forecast.nutritionIntentIncidenceBasisPoints).toBeGreaterThan(0);
            expect(initial.forecast.crowdProfiles.map((profile) => profile.id)).toEqual(
              periodIndex === 0
                ? ["customer.early-shift-regular"]
                : periodIndex === 1
                  ? ["customer.office-lunch-sprinter", "customer.student-saver"]
                  : ["customer.student-saver"],
            );
          }
          const state = runArrivalWindow(initial);
          expect(state.forecastArrivals.length).toBe(forecastArrivalTarget(
            initial.forecast,
            initial.arrivalSamplingSeed,
          ));
          expect(state.forecastArrivals.length).toBeGreaterThanOrEqual(initial.forecast.demandRange[0]);
          expect(state.forecastArrivals.length).toBeLessThanOrEqual(initial.forecast.demandRange[1]);
          expect(state.forecastArrivals.every((arrival) => (
            initial.forecast.crowdProfiles.some((profile) => profile.id === arrival.archetypeId) &&
            initial.forecast.budgetBands.some((band) => (
              arrival.budgetCents >= band.minimumCents && arrival.budgetCents <= band.maximumCents
            ))
          ))).toBe(true);
          if (level === 1) {
            expect(state.forecastArrivals.some((arrival) => arrival.nutritionIntent)).toBe(true);
          }
        }
      }
    }
  }, 180_000);

  it("assigns actual visit needs independently of the active menu", () => {
    const spawn = (activeDishId: "noodles" | "rice") => {
      const initial = makeGame({ catalog: nutritionCatalogue(activeDishId), seed: "menu-independent-needs" });
      const state = stepSimulation({
        ...initial,
        progression: { ...initial.progression, level: 2 },
        forecast: {
          ...initial.forecast,
          nutritionIntentIncidenceBasisPoints: 10_000,
          conditionAwareIncidenceBasisPoints: 10_000,
        },
      });
      return {
        customer: Object.values(state.customers)[0],
        arrival: state.forecastArrivals[0],
        arrivalSamplingSeed: state.arrivalSamplingSeed,
        forecast: state.forecast,
      };
    };
    const noodles = spawn("noodles");
    const rice = spawn("rice");
    expect(noodles.customer?.nutritionIntentId).toBe(rice.customer?.nutritionIntentId);
    expect(noodles.customer?.healthConditions).toEqual(rice.customer?.healthConditions);
    expect((noodles.customer?.healthConditions.length ?? 0) +
      (noodles.customer?.nutritionIntentId ? 1 : 0)).toBeGreaterThan(0);
    expect(noodles.arrival).toEqual(rice.arrival);
    expect(noodles.arrivalSamplingSeed).toBe(rice.arrivalSamplingSeed);
    expect(noodles.forecast).toEqual(rice.forecast);
  });

  it("loads a Stage 1 core V5/runtime V3 save without forecast fields deterministically", () => {
    const source = makeGame({ seed: "stage1-v5-no-forecast" });
    const core = JSON.parse(JSON.stringify(persistentStateFromGame(source))) as Record<string, unknown>;
    delete core.forecast;
    delete core.forecastArrivals;
    delete core.arrivalSamplingSeed;
    const decoded = decodeRuntimeSave({
      runtimeSchemaVersion: 3,
      core,
      stallMenus: {},
      activeDishVariants: {},
      nutritionDataVersion: "stage1-fixture",
      periodOutcomes: {},
    });
    const loaded = deserializeGameState(decoded.core, TEST_CATALOG, { config: source.config });
    expect(loaded.forecast).toEqual(lockPeriodForecast(
      forecastForServicePeriod(loaded.servicePeriod),
      TEST_CATALOG,
      loaded.progression,
    ));
    expect(loaded.forecastArrivals).toEqual([]);
    expect(loaded.rngState).toBe(source.rngState);
    expect(loaded.arrivalSamplingSeed).toBeGreaterThan(0);
    expect(loaded.economy.cashCents).toBe(source.economy.cashCents);
  });

  it("regenerates malformed persisted forecast DTOs instead of trusting nested data", () => {
    const source = makeGame({ seed: "malformed-forecast" });
    const persisted = JSON.parse(JSON.stringify(persistentStateFromGame(source))) as Record<string, unknown>;
    persisted.forecast = {
      ...(persisted.forecast as Record<string, unknown>),
      conditionAwareIncidenceBasisPoints: 10_001,
      groupSizeMix: [{ id: "invalid", basisPoints: 10_000, size: 99 }],
    };
    const migrated = migratePersistentState(persisted);
    expect(migrated.forecast).toEqual(forecastForServicePeriod(migrated.servicePeriod));
    expect(migrated.forecastArrivals).toEqual([]);
    expect(migrated.rngState).toBe(source.rngState);
    expect(migrated.economy.cashCents).toBe(source.economy.cashCents);
  });

  it("freezes the current audience when progression changes during service", () => {
    const initial = productionPeriodState(1, 2, "frozen-audience");
    const lockedAudience = initial.forecast.crowdProfiles;
    const firstHalf = runArrivalWindow(initial, 120_000);
    const progressed = {
      ...firstHalf,
      progression: {
        ...firstHalf.progression,
        level: 20,
        reputation: 5,
      },
    };
    const complete = runArrivalWindow(progressed, 120_000);
    expect(complete.forecast.crowdProfiles).toEqual(lockedAudience);
    expect(new Set(complete.forecastArrivals.map((arrival) => arrival.archetypeId))).toEqual(
      new Set(["customer.student-saver"]),
    );
  });

  it("keeps every keyed arrival tuple identical across different active menus", () => {
    const base = productionPeriodState(20, 1, "same-seed-different-menu");
    const stallIds = Object.values(base.objects)
      .filter((object) => base.catalog.placeables[object.definitionId]?.kind === "stall")
      .map((object) => object.definitionId);
    const firstStallId = stallIds[0]!;
    const availableDishIds = base.catalog.placeables[firstStallId]!.stall!.dishIds;
    expect(availableDishIds.length).toBeGreaterThan(1);
    const withMenu = (dishId: string) => ({
      ...base,
      catalog: {
        ...base.catalog,
        placeables: {
          ...base.catalog.placeables,
          [firstStallId]: {
            ...base.catalog.placeables[firstStallId]!,
            stall: {
              ...base.catalog.placeables[firstStallId]!.stall!,
              dishIds: [dishId],
            },
          },
        },
      },
    });
    const first = runArrivalWindow(withMenu(availableDishIds[0]!) as typeof base);
    const second = runArrivalWindow(withMenu(availableDishIds[1]!) as typeof base);
    expect(first.forecastArrivals.map(arrivalTuple)).toEqual(
      second.forecastArrivals.map(arrivalTuple),
    );
  });

  it("varies keyed arrival tuples by game seed", () => {
    const first = runArrivalWindow(productionPeriodState(20, 3, "arrival-seed-a"), 60_000);
    const second = runArrivalWindow(productionPeriodState(20, 3, "arrival-seed-b"), 60_000);
    expect(first.arrivalSamplingSeed).not.toBe(second.arrivalSamplingSeed);
    expect(first.forecastArrivals.map(arrivalTuple)).not.toEqual(
      second.forecastArrivals.map(arrivalTuple),
    );
  });

  it("samples more than one in-range demand target across 30 immutable seeds", () => {
    const targets = new Set(Array.from({ length: 30 }, (_, index) => {
      const state = productionPeriodState(5, 0, `demand-target-${index}`);
      const target = forecastArrivalTarget(state.forecast, state.arrivalSamplingSeed);
      expect(target).toBeGreaterThanOrEqual(state.forecast.demandRange[0]);
      expect(target).toBeLessThanOrEqual(state.forecast.demandRange[1]);
      return target;
    }));
    expect(targets.size).toBeGreaterThan(1);
  });

  it("preserves the remaining keyed tuple stream through a mid-period save", () => {
    const initial = productionPeriodState(13, 1, "arrival-save-reload");
    const midpoint = runArrivalWindow(initial, 60_000);
    const savedCount = midpoint.forecastArrivals.length;
    const loaded = deserializeGameState(
      persistentStateFromGame(midpoint),
      midpoint.catalog,
      { config: midpoint.config },
    );
    expect(loaded.arrivalSamplingSeed).toBe(midpoint.arrivalSamplingSeed);
    const uninterrupted = runArrivalWindow(midpoint, 60_000);
    const resumed = runArrivalWindow(loaded as typeof initial, 60_000);
    expect(resumed.forecastArrivals.slice(savedCount).map(arrivalTuple)).toEqual(
      uninterrupted.forecastArrivals.slice(savedCount).map(arrivalTuple),
    );
  });

  it("samples budgets into authored bands with approximately authored shares", () => {
    const state = runArrivalWindow(productionPeriodState(20, 1, "budget-distribution"));
    const comparison = compareForecastToArrivals(state.forecast, state.forecastArrivals);
    for (const band of state.forecast.budgetBands) {
      const observedShare = (comparison.budgetBandCounts[band.id] ?? 0) /
        state.forecastArrivals.length;
      expect(Math.abs(observedShare - band.basisPoints / 10_000)).toBeLessThan(0.13);
    }
    expect(comparison.budgetBandCounts["outside-forecast-bands"]).toBeUndefined();
  });

  it("uses the sampled visit budget for affordability instead of the persona midpoint", () => {
    const source = makeGame({ seed: "sampled-affordability" });
    const lowBudget = stepSimulation({
      ...source,
      forecast: {
        ...source.forecast,
        budgetBands: [{ id: "fixture-low", basisPoints: 10_000, minimumCents: 500, maximumCents: 500 }],
      },
    });
    const customer = Object.values(lowBudget.customers)[0];
    expect(customer?.forecastBudgetCents).toBe(500);
    expect(customer?.status).toBe("walking-to-exit");
    expect(customer?.targetStallId).toBeUndefined();
  });

  it("excludes unplaced stall support and missing prerequisites from forecast viability", () => {
    const base = productionPeriodState(20, 1, "coverage-guards");
    const noPlacedStalls = {
      ...base,
      objects: Object.fromEntries(Object.entries(base.objects).filter(([, object]) => (
        base.catalog.placeables[object.definitionId]?.kind !== "stall"
      ))),
    };
    const allMenus = Object.fromEntries(Object.values(base.catalog.placeables)
      .filter((definition) => definition.kind === "stall")
      .map((definition) => [definition.id, definition.stall?.dishIds ?? []]));
    const unplaced = deriveRuntimeForecastAvailability(noPlacedStalls, allMenus, {});
    expect(unplaced.unlockedPreparationIds.size).toBe(0);
    expect(unplaced.activePreparationIds.size).toBe(0);

    const placedStall = Object.values(base.objects).find((object) => (
      base.catalog.placeables[object.definitionId]?.kind === "stall"
    ))!;
    const dishId = base.catalog.placeables[placedStall.definitionId]!.stall!.dishIds[0]!;
    const preparationId = Array.from(deriveRuntimeForecastAvailability(base, allMenus, {})
      .unlockedPreparationIds).find((id) => id.startsWith(`${dishId}:`));
    expect(preparationId).toBeDefined();
    const withoutAllDishIds = {
      ...base,
      catalog: {
        ...base.catalog,
        placeables: {
          ...base.catalog.placeables,
          [placedStall.definitionId]: {
            ...base.catalog.placeables[placedStall.definitionId]!,
            stall: {
              ...base.catalog.placeables[placedStall.definitionId]!.stall!,
              allDishIds: undefined,
            },
          },
        },
      },
    };
    expect(deriveRuntimeForecastAvailability(withoutAllDishIds, allMenus, {})
      .unlockedPreparationIds.has(preparationId!)).toBe(true);
    const missingPrerequisite = {
      ...base,
      catalog: {
        ...base.catalog,
        dishes: {
          ...base.catalog.dishes,
          [dishId]: {
            ...base.catalog.dishes[dishId]!,
            unlockPrerequisiteIds: ["fixture.missing-prerequisite"],
          },
        },
      },
    };
    const guarded = deriveRuntimeForecastAvailability(missingPrerequisite, allMenus, {});
    expect(guarded.unlockedPreparationIds.has(preparationId!)).toBe(false);
  });

  it("treats placed closed stalls as unlock support but not active forecast coverage", () => {
    const { catalog } = buildCatalog();
    const closed = freshState(catalog, "closed-stall-coverage");
    const menus = Object.fromEntries(Object.values(catalog.placeables)
      .filter((definition) => definition.kind === "stall")
      .map((definition) => [definition.id, definition.stall?.dishIds ?? []]));
    const variants = defaultDishVariants();
    const closedAvailability = deriveRuntimeForecastAvailability(closed, menus, variants);
    expect(closedAvailability.unlockedPreparationIds.size).toBeGreaterThan(0);
    expect(closedAvailability.activePreparationIds.size).toBe(0);
    expect(closedAvailability.coverage.length).toBeGreaterThan(0);
    expect(closedAvailability.coverage.every((need) => !need.covered)).toBe(true);

    const opened = {
      ...closed,
      objects: Object.fromEntries(Object.entries(closed.objects).map(([id, object]) => [id, {
        ...object,
        open: catalog.placeables[object.definitionId]?.kind === "stall" ? true : object.open,
      }])),
    };
    const openAvailability = deriveRuntimeForecastAvailability(opened, menus, variants);
    expect(openAvailability.unlockedPreparationIds).toEqual(
      closedAvailability.unlockedPreparationIds,
    );
    expect(openAvailability.activePreparationIds.size).toBeGreaterThan(0);
    expect(openAvailability.coverage.some((need) => need.covered)).toBe(true);
  });

  it("keeps intent and condition outcome denominators independent", () => {
    const forecast = productionPeriodState(20, 1, "split-outcomes").forecast;
    const base = {
      periodSequenceId: forecast.periodSequenceId,
      archetypeId: forecast.crowdProfiles[0]!.id,
      budgetCents: forecast.budgetBands[0]!.minimumCents,
      groupSize: forecast.groupSizeMix[0]!.size,
      mealMixId: forecast.mealMix[0]!.id,
    } as const;
    const comparison = compareForecastToArrivals(forecast, [
      {
        ...base,
        customerId: "customer-1",
        healthConditions: ["hypertension"],
        conditionAwareResult: "matched",
        nutritionResult: "matched",
      },
      {
        ...base,
        customerId: "customer-2",
        nutritionIntent: "sodium-aware",
        healthConditions: [],
        nutritionIntentResult: "missed",
        nutritionResult: "missed",
      },
      {
        ...base,
        customerId: "customer-3",
        nutritionIntent: "protein-forward",
        healthConditions: ["diabetes"],
        nutritionIntentResult: "matched",
        conditionAwareResult: "unknown",
        nutritionResult: "unknown",
      },
      { ...base, customerId: "customer-4", healthConditions: [] },
    ]);
    expect(comparison).toMatchObject({
      nutritionOutcomeVisits: 3,
      nutritionMatches: 1,
      nutritionMisses: 1,
      nutritionUnknowns: 1,
      intentOutcomeVisits: 2,
      intentMatches: 1,
      intentMisses: 1,
      intentUnknowns: 0,
      conditionOutcomeVisits: 2,
      conditionMatches: 1,
      conditionMisses: 0,
      conditionUnknowns: 1,
    });
  });

  it("normalizes tampered arrival rows and clears them when the forecast regenerates", () => {
    const source = stepSimulation(makeGame({ seed: "tampered-arrivals" }));
    const persisted = JSON.parse(JSON.stringify(persistentStateFromGame(source))) as Record<string, unknown>;
    const arrivals = persisted.forecastArrivals as Array<Record<string, unknown>>;
    const valid = arrivals[0]!;
    valid.nutritionIntent = undefined;
    valid.healthConditions = [];
    valid.nutritionResult = "matched";
    valid.nutritionIntentResult = "matched";
    valid.conditionAwareResult = "matched";
    arrivals.push(
      { ...valid },
      { ...valid, customerId: "customer-999", archetypeId: "unknown-persona" },
      { ...valid, customerId: "customer-2", mealMixId: "unknown-meal" },
      { ...valid, customerId: "customer-3", budgetCents: 999_999 },
      { ...valid, customerId: "customer-4", periodSequenceId: 999 },
    );
    persisted.nextCustomerSequence = 5;
    const loaded = deserializeGameState(persisted, TEST_CATALOG, { config: source.config });
    expect(loaded.forecastArrivals).toHaveLength(1);
    expect(loaded.forecastArrivals[0]).toMatchObject({
      customerId: "customer-1",
      nutritionResult: undefined,
      nutritionIntentResult: undefined,
      conditionAwareResult: undefined,
    });

    (persisted.forecast as Record<string, unknown>).periodSequenceId = 999;
    const regenerated = deserializeGameState(persisted, TEST_CATALOG, { config: source.config });
    expect(regenerated.forecastArrivals).toEqual([]);
  });

  it("round-trips separate intent and condition outcomes", () => {
    const spawned = stepSimulation(makeGame({ seed: "outcome-roundtrip" }));
    const observation = spawned.forecastArrivals[0]!;
    const source = {
      ...spawned,
      forecastArrivals: [{
        ...observation,
        nutritionIntent: "sodium-aware" as const,
        healthConditions: ["hypertension" as const],
        nutritionIntentResult: "matched" as const,
        conditionAwareResult: "unknown" as const,
        nutritionResult: "unknown" as const,
      }],
    };
    const loaded = deserializeGameState(
      persistentStateFromGame(source),
      TEST_CATALOG,
      { config: source.config },
    );
    expect(loaded.forecastArrivals[0]).toMatchObject({
      nutritionIntentResult: "matched",
      conditionAwareResult: "unknown",
      nutritionResult: "unknown",
    });
    expect(compareForecastToArrivals(loaded.forecast, loaded.forecastArrivals)).toMatchObject({
      nutritionOutcomeVisits: 1,
      intentOutcomeVisits: 1,
      conditionOutcomeVisits: 1,
    });
  });
});
