import { describe, expect, it } from "vitest";

import {
  asMoneyCents,
  assertSimulationInvariants,
  buildUnlockedMealUniverse,
  compareMealBalanceAmongUnlockedOptions,
  deserializeGameState,
  dispatchCommand,
  finalizeDrainWatchdogState,
  ledgerReconciliationDeltaCents,
  mealComponentsForState,
  serializeGameState,
  servingDistancesForState,
  stepSimulation,
  visitXp,
  type Customer,
  type GameState,
  type NutritionMetric,
  type NutritionProfile,
  type NutritionValue,
  type PlacedObject,
  type SimulationCatalog,
} from "../../src/game/core";
import { NUTRITION_METRICS } from "../../src/game/core/nutrition";
import { INITIAL_OBJECTS, makeGame, TEST_CATALOG } from "./fixtures";

function profile(id: string, energy: number): NutritionProfile {
  return {
    id,
    dishId: id,
    status: "released",
    nutritionClass: "meal",
    nutrients: Object.fromEntries(NUTRITION_METRICS.map((metric) => [
      metric,
      { status: "known", value: metric === "energyKcal" ? energy : 1 },
    ])) as Record<NutritionMetric, NutritionValue>,
    intentFits: { "lighter-energy": energy < 400 ? 0.8 : 0.4 },
    conditionRatings: { diabetes: energy < 400 ? 4 : 3 },
  };
}

const mainProfile = profile("profile-main", 450);
const sideProfile = profile("profile-side", 180);

function comboCatalog(sameStall: boolean): SimulationCatalog {
  const dishes: SimulationCatalog["dishes"] = {
    noodles: {
      ...TEST_CATALOG.dishes.noodles!,
      price: 5,
      priceCents: asMoneyCents(500),
      ingredientCostCents: asMoneyCents(175),
      preparationMs: 100,
      servingMs: 0,
      eatingMs: 100,
      activePreparationId: "noodles::main",
      mealRole: "main",
      defaultNutritionVariantId: "main",
      activeNutritionVariantId: "main",
      nutritionVariants: [{
        id: "main",
        label: "Main",
        unlockRank: 1,
        profileId: mainProfile.id,
        visualKey: "main",
        profile: mainProfile,
      }],
    },
    rice: {
      ...TEST_CATALOG.dishes.rice!,
      price: 2.5,
      priceCents: asMoneyCents(250),
      ingredientCostCents: asMoneyCents(80),
      preparationMs: 100,
      servingMs: 0,
      eatingMs: 100,
      activePreparationId: "rice::side",
      mealRole: "side",
      defaultNutritionVariantId: "side",
      activeNutritionVariantId: "side",
      nutritionVariants: [{
        id: "side",
        label: "Side",
        unlockRank: 1,
        profileId: sideProfile.id,
        visualKey: "side",
        profile: sideProfile,
      }],
    },
  };
  const base = TEST_CATALOG.placeables.stall!;
  const placeables = sameStall
    ? {
        ...TEST_CATALOG.placeables,
        "stall-both": {
          ...base,
          id: "stall-both",
          stall: { ...base.stall!, dishIds: ["noodles", "rice"] },
        },
      }
    : {
        ...TEST_CATALOG.placeables,
        "stall-main": {
          ...base,
          id: "stall-main",
          stall: { ...base.stall!, dishIds: ["noodles"] },
        },
        "stall-side": {
          ...base,
          id: "stall-side",
          stall: { ...base.stall!, dishIds: ["rice"] },
        },
      };
  return { ...TEST_CATALOG, dishes, placeables };
}

function comboObjects(sameStall: boolean): readonly PlacedObject[] {
  const facilities = INITIAL_OBJECTS
    .filter((object) => object.definitionId !== "stall")
    .map((object) => object.id === "seat-1"
      ? { ...object, origin: { x: 9, y: 2 } }
      : object);
  return sameStall
    ? [
        { id: "stall-main-1", definitionId: "stall-both", origin: { x: 2, y: 0 }, rotation: 0, open: true },
        ...facilities,
      ]
    : [
        { id: "stall-main-1", definitionId: "stall-main", origin: { x: 2, y: 0 }, rotation: 0, open: true },
        { id: "stall-side-1", definitionId: "stall-side", origin: { x: 6, y: 0 }, rotation: 0, open: true },
        ...facilities,
      ];
}

function comboCustomer(periodSequenceId: number): Customer {
  return {
    id: "combo-visit",
    archetypeId: "regular",
    status: "ordering",
    position: { x: 2, y: 2 },
    path: [],
    pathIndex: 0,
    movementProgress: 0,
    stateElapsedMs: 100,
    visitElapsedMs: 0,
    walkingDistanceTiles: 0,
    patienceRemainingMs: 8_000,
    satisfaction: 3,
    arrivalPeriodSequenceId: periodSequenceId,
    forecastGroupSize: 1,
    forecastMealMixId: "main-and-side",
    forecastBudgetCents: asMoneyCents(2_000),
    healthConditions: ["diabetes"],
    nutritionIntentId: "lighter-energy",
    sourceEntranceId: "entrance-primary",
    targetStallId: "stall-main-1",
    hasTray: false,
    served: false,
    spentCents: asMoneyCents(0),
    spent: 0,
    stuckMs: 0,
  };
}

function queueBlocker(id: string, index: number, periodSequenceId: number): Customer {
  return {
    ...comboCustomer(periodSequenceId),
    id,
    status: "queued",
    position: { x: 6, y: 2 + index },
    targetStallId: "stall-side-1",
    forecastMealMixId: "main-only",
    healthConditions: [],
    nutritionIntentId: undefined,
  };
}

function comboGame(sameStall: boolean): GameState {
  const state = makeGame({
    catalog: comboCatalog(sameStall),
    initialObjects: comboObjects(sameStall),
    config: { spawnIntervalMs: 100_000 },
  });
  const customer = comboCustomer(state.servicePeriod.sequenceId);
  return {
    ...state,
    progression: {
      ...state.progression,
      level: 5,
      claimedMilestoneIds: [
        ...state.progression.claimedMilestoneIds,
        "growth-1",
        ...(sameStall ? [] : ["variety-1"]),
      ],
      milestoneBaselinePending: false,
    },
    comboBoard: {
      slots: [{
        id: "main-side",
        preparationIds: ["noodles::main", "rice::side"],
      }, null, null],
    },
    customers: { [customer.id]: customer },
    queues: {
      ...state.queues,
      "stall-main-1": [customer.id],
      ...(sameStall ? {} : { "stall-side-1": [] }),
    },
    servicePeriod: { ...state.servicePeriod, cohortCustomerIds: [customer.id] },
    forecast: {
      ...state.forecast,
      mealMix: [{ id: "main-and-side", basisPoints: 10_000 }],
    },
    forecastArrivals: [{
      periodSequenceId: state.servicePeriod.sequenceId,
      customerId: customer.id,
      archetypeId: customer.archetypeId,
      budgetCents: customer.forecastBudgetCents!,
      groupSize: 1,
      mealMixId: "main-and-side",
      nutritionIntent: customer.nutritionIntentId,
      healthConditions: customer.healthConditions,
    }],
    metrics: { ...state.metrics, spawnedCustomers: 1 },
    spawnCountdownMs: 100_000,
  };
}

function spawnedChoiceGame(comboEnabled: boolean): GameState {
  const base = comboGame(false);
  const regular = base.catalog.archetypes.regular!;
  return {
    ...base,
    catalog: {
      ...base.catalog,
      dishes: {
        ...base.catalog.dishes,
        noodles: { ...base.catalog.dishes.noodles!, starRating: 1, quality: 1 },
        rice: { ...base.catalog.dishes.rice!, starRating: 5, quality: 5 },
      },
      archetypes: {
        ...base.catalog.archetypes,
        regular: { ...regular, preferenceTags: ["rice"] },
      },
    },
    comboBoard: comboEnabled ? base.comboBoard : { slots: [null, null, null] },
    customers: {},
    queues: { "stall-main-1": [], "stall-side-1": [] },
    servicePeriod: { ...base.servicePeriod, cohortCustomerIds: [] },
    forecast: {
      ...base.forecast,
      demandRange: [1, 1],
      crowdProfiles: [{ id: "regular", basisPoints: 10_000 }],
      budgetBands: [{
        id: "combo-budget",
        basisPoints: 10_000,
        minimumCents: 2_000,
        maximumCents: 2_000,
      }],
      groupSizeMix: [{ id: "solo", size: 1, basisPoints: 10_000 }],
      mealMix: [{ id: "main-and-side", basisPoints: 10_000 }],
      nutritionIntentIncidenceBasisPoints: 0,
      conditionAwareIncidenceBasisPoints: 0,
    },
    forecastArrivals: [],
    metrics: {
      ...base.metrics,
      spawnedCustomers: 0,
      despawnedCustomers: 0,
      completedCustomers: 0,
    },
    nextCustomerSequence: 1,
    spawnCountdownMs: 0,
  };
}

function runUntil(
  source: GameState,
  predicate: (state: GameState) => boolean,
  limit = 500,
): GameState {
  let state = source;
  for (let index = 0; index < limit && !predicate(state); index += 1) {
    state = stepSimulation(state);
    assertSimulationInvariants(state);
  }
  if (!predicate(state)) throw new Error("Combo simulation predicate was not reached");
  return state;
}

function mainServedAtSecondStop(source: GameState, status?: Customer["status"]): GameState {
  return runUntil(source, (state) => {
    const customer = state.customers["combo-visit"];
    return Boolean(
      customer?.mealStopIndex === 1 &&
      customer.settledMealLineIds?.length === 1 &&
      (!status || customer.status === status),
    );
  });
}

function grossSales(state: GameState) {
  return state.periodLedgers[state.servicePeriod.sequenceId]!.entries
    .filter((entry) => entry.kind === "gross-sale");
}

function stableMealBalance(state: GameState): number | undefined {
  const components = mealComponentsForState(state, true);
  const universe = buildUnlockedMealUniverse(
    components,
    servingDistancesForState(state, state.entrance, true),
    new Set(components.flatMap((component) => component.stallInstanceIds)),
  );
  return compareMealBalanceAmongUnlockedOptions(
    "pair:noodles::main+rice::side",
    universe,
  ).rating;
}

describe("live Combo Board settlement", () => {
  it("uses a valid board from normal spawn choice and falls back deterministically", () => {
    const withBoard = stepSimulation(spawnedChoiceGame(true));
    const fallback = stepSimulation(spawnedChoiceGame(false));
    const comboGuest = withBoard.customers["customer-1"]!;
    const fallbackGuest = fallback.customers["customer-1"]!;
    expect(comboGuest.targetStallId).toBe("stall-main-1");
    expect(fallbackGuest.targetStallId).toBe("stall-side-1");
    expect(withBoard.rngState).toBe(fallback.rngState);
    expect(() => assertSimulationInvariants(withBoard)).not.toThrow();
    expect(() => assertSimulationInvariants(fallback)).not.toThrow();

    const comboOrdered = runUntil(withBoard, (state) => Boolean(
      state.customers["customer-1"]?.mealOrderSnapshot,
    ));
    const fallbackOrdered = runUntil(fallback, (state) => Boolean(
      state.customers["customer-1"]?.orderLineSnapshot,
    ));
    expect(comboOrdered.customers["customer-1"]?.mealOrderSnapshot?.offerId).toBe("main-side");
    expect(fallbackOrdered.customers["customer-1"]?.mealOrderSnapshot).toBeUndefined();
  });

  it("falls back deterministically for future guests when the only complement stall is closed", () => {
    const closeComplement = (source: GameState) => {
      const result = dispatchCommand(source, {
        type: "set-stall-open",
        objectId: "stall-side-1",
        open: false,
      });
      expect(result.accepted).toBe(true);
      return result.state;
    };
    const withBoard = stepSimulation(closeComplement(spawnedChoiceGame(true)));
    const withoutBoard = stepSimulation(closeComplement(spawnedChoiceGame(false)));
    expect(withBoard.customers["customer-1"]?.targetStallId).toBe("stall-main-1");
    expect(withoutBoard.customers["customer-1"]?.targetStallId).toBe("stall-main-1");
    expect(withBoard.rngState).toBe(withoutBoard.rngState);

    const ordered = runUntil(withBoard, (state) => Boolean(
      state.customers["customer-1"]?.orderLineSnapshot,
    ));
    expect(ordered.customers["customer-1"]?.mealOrderSnapshot).toBeUndefined();
    expect(() => assertSimulationInvariants(ordered)).not.toThrow();
  });

  it("keeps the fixed meal universe stable across board, queue, position, and shutter state", () => {
    const source = comboGame(false);
    const expected = stableMealBalance(source);
    const varied: GameState = {
      ...source,
      comboBoard: { slots: [null, null, null] },
      objects: {
        ...source.objects,
        "stall-side-1": { ...source.objects["stall-side-1"]!, open: false },
      },
      queues: {
        ...source.queues,
        "stall-side-1": ["queued-a", "queued-b", "queued-c"],
      },
      customers: {
        ...source.customers,
        "combo-visit": {
          ...source.customers["combo-visit"]!,
          position: { x: 10, y: 7 },
        },
      },
    };
    expect(stableMealBalance(varied)).toBe(expected);
  });

  it("serves a same-stall pair as one visit with two exact lines", () => {
    const initial = comboGame(true);
    const completed = runUntil(initial, (state) => (
      state.customers["combo-visit"]?.mealSettlementCause === "complete"
    ));
    const customer = completed.customers["combo-visit"]!;
    expect(customer.settledMealLineIds).toEqual(["combo-visit:1", "combo-visit:2"]);
    expect(customer.servedStallDefinitionIds).toEqual(["stall-both"]);
    expect(customer.firstServeBonusXp).toBe(4);
    expect(completed.economy.completedVisits).toBe(1);
    expect(completed.economy.cashCents - initial.economy.cashCents).toBe(495);
    expect(grossSales(completed)).toMatchObject([
      { visitId: "combo-visit", lineId: "combo-visit:1", preparationId: "noodles::main" },
      { visitId: "combo-visit", lineId: "combo-visit:2", preparationId: "rice::side" },
    ]);
    expect(completed.metrics.nutrition).toMatchObject({ servedMeals: 1, profiledServings: 1 });
    expect(completed.metrics.nutrition.dishServings).toMatchObject({ noodles: 1, rice: 1 });
    expect(completed.forecastArrivals[0]?.nutritionResult).toBeDefined();
    expect(ledgerReconciliationDeltaCents(
      completed.periodLedgers[completed.servicePeriod.sequenceId]!,
      completed.economy.cashCents,
    )).toBe(0);

    const exited = runUntil(completed, (state) => !state.customers["combo-visit"]);
    const rating = exited.metrics.visitRatings.find((entry) => entry.customerId === "combo-visit")!;
    expect(exited.progression.xp).toBe(4 + visitXp(rating.score));
    expect(exited.economy.completedVisits).toBe(1);
    expect(exited.progression.stallMastery["stall-both"]?.points).toBeGreaterThan(0);
    expect(Object.keys(exited.progression.stallMastery)).toEqual(["stall-both"]);
  });

  it("serves a two-stall pair and preserves frozen terms after catalogue changes", () => {
    const ordered = runUntil(comboGame(false), (state) => Boolean(
      state.customers["combo-visit"]?.mealOrderSnapshot,
    ));
    const frozen = ordered.customers["combo-visit"]!.mealOrderSnapshot!;
    const changed: GameState = {
      ...ordered,
      catalog: {
        ...ordered.catalog,
        dishes: {
          ...ordered.catalog.dishes,
          noodles: {
            ...ordered.catalog.dishes.noodles!,
            priceCents: asMoneyCents(9_999),
            ingredientCostCents: asMoneyCents(4_000),
            preparationMs: 9_999,
          },
          rice: {
            ...ordered.catalog.dishes.rice!,
            priceCents: asMoneyCents(8_888),
            ingredientCostCents: asMoneyCents(3_000),
            preparationMs: 8_888,
          },
        },
      },
    };
    const completed = runUntil(changed, (state) => (
      state.customers["combo-visit"]?.mealSettlementCause === "complete"
    ));
    expect(completed.customers["combo-visit"]?.mealOrderSnapshot).toEqual(frozen);
    expect(completed.customers["combo-visit"]?.servedStallDefinitionIds).toEqual([
      "stall-main",
      "stall-side",
    ]);
    expect(grossSales(completed).map((entry) => entry.amountCents)).toEqual([500, 250]);
    expect(completed.economy.completedVisits).toBe(1);
    const exited = runUntil(completed, (state) => !state.customers["combo-visit"]);
    expect(exited.progression.stallMastery["stall-main"]?.points).toBeGreaterThan(0);
    expect(exited.progression.stallMastery["stall-side"]?.points).toBe(
      exited.progression.stallMastery["stall-main"]?.points,
    );
  });

  it("waits for temporary second-queue capacity without false cancellation or overcharge", () => {
    const ordered = runUntil(comboGame(false), (state) => Boolean(
      state.customers["combo-visit"]?.mealOrderSnapshot,
    ));
    const blockerIds = ["blocker-1", "blocker-2", "blocker-3", "blocker-4"];
    const blockers = Object.fromEntries(blockerIds.map((id, index) => [
      id,
      queueBlocker(id, index, ordered.servicePeriod.sequenceId),
    ]));
    const blocked: GameState = {
      ...ordered,
      customers: { ...ordered.customers, ...blockers },
      queues: { ...ordered.queues, "stall-side-1": blockerIds },
      servicePeriod: {
        ...ordered.servicePeriod,
        cohortCustomerIds: [...ordered.servicePeriod.cohortCustomerIds, ...blockerIds],
      },
      metrics: {
        ...ordered.metrics,
        spawnedCustomers: ordered.metrics.spawnedCustomers + blockerIds.length,
      },
    };
    expect(() => assertSimulationInvariants(blocked)).not.toThrow();
    const deferred = stepSimulation(blocked);
    const waitingCombo = deferred.customers["combo-visit"]!;
    expect(waitingCombo.status).toBe("walking-to-queue");
    expect(waitingCombo.mealStopIndex).toBe(1);
    expect(waitingCombo.settledMealLineIds).toEqual(["combo-visit:1"]);
    expect(waitingCombo.mealSettlementCause).toBeUndefined();
    expect(deferred.queues["stall-side-1"]).not.toContain("combo-visit");

    const completed = runUntil(deferred, (state) => (
      state.customers["combo-visit"]?.mealSettlementCause === "complete"
    ), 2_000);
    const comboEntries = grossSales(completed).filter((entry) => entry.visitId === "combo-visit");
    expect(comboEntries.map((entry) => entry.amountCents)).toEqual([500, 250]);
    expect(new Set(comboEntries.map((entry) => entry.lineId)).size).toBe(2);
    expect(completed.events.some((event) => (
      event.type === "meal-partial" && event.entityId === "combo-visit"
    ))).toBe(false);
  });

  it("round-trips between stops and settles the original frozen cents", () => {
    const betweenStops = mainServedAtSecondStop(comboGame(false), "walking-to-queue");
    const frozen = betweenStops.customers["combo-visit"]!.mealOrderSnapshot!;
    const originalCatalog = comboCatalog(false);
    const changedCatalog: SimulationCatalog = {
      ...originalCatalog,
      dishes: {
        ...originalCatalog.dishes,
        noodles: {
          ...originalCatalog.dishes.noodles!,
          priceCents: asMoneyCents(9_999),
          ingredientCostCents: asMoneyCents(4_000),
          preparationMs: 9_999,
        },
        rice: {
          ...originalCatalog.dishes.rice!,
          priceCents: asMoneyCents(8_888),
          ingredientCostCents: asMoneyCents(3_000),
          preparationMs: 8_888,
        },
      },
    };
    const loadedWithOriginalCatalog = deserializeGameState(
      serializeGameState(betweenStops),
      originalCatalog,
      { config: betweenStops.config },
    );
    expect(loadedWithOriginalCatalog.customers["combo-visit"]?.mealOrderSnapshot).toEqual(frozen);
    const loaded: GameState = { ...loadedWithOriginalCatalog, catalog: changedCatalog };
    const completed = runUntil(loaded, (state) => (
      state.customers["combo-visit"]?.mealSettlementCause === "complete"
    ), 2_000);
    expect(grossSales(completed).map((entry) => entry.amountCents)).toEqual([500, 250]);
    expect(completed.customers["combo-visit"]?.firstServeBonusXp).toBe(4);
    expect(completed.economy.completedVisits).toBe(1);
    expect(ledgerReconciliationDeltaCents(
      completed.periodLedgers[completed.servicePeriod.sequenceId]!,
      completed.economy.cashCents,
    )).toBe(0);
  });

  for (const status of ["walking-to-queue", "queued"] as const) {
    it(`settles the main only when stop two closes while ${status}`, () => {
      const atSecond = mainServedAtSecondStop(comboGame(false), status);
      const closed = dispatchCommand(atSecond, {
        type: "set-stall-open",
        objectId: "stall-side-1",
        open: false,
      });
      expect(closed.accepted).toBe(true);
      expect(closed.state.comboBoard.slots[0]?.id).toBe("main-side");
      const finalized = stepSimulation(closed.state);
      const customer = finalized.customers["combo-visit"]!;
      expect(customer.mealSettlementCause).toBe("second-stall-unavailable");
      expect(customer.settledMealLineIds).toEqual(["combo-visit:1"]);
      expect(grossSales(finalized)).toHaveLength(1);
      expect(finalized.economy.cashCents - comboGame(false).economy.cashCents).toBe(325);
      expect(finalized.metrics.nutrition.servedMeals).toBe(1);
      expect(finalized.events.filter((event) => event.type === "meal-partial")).toMatchObject([
        { entityId: "combo-visit", message: "second-stall-unavailable" },
      ]);
      expect(() => assertSimulationInvariants(finalized)).not.toThrow();
    });
  }

  it("watchdog-finalizes a served main without charging its pending side", () => {
    const atSecond = mainServedAtSecondStop(comboGame(false), "walking-to-queue");
    const draining: GameState = {
      ...atSecond,
      servicePeriod: {
        ...atSecond.servicePeriod,
        phase: "draining",
        drainElapsedMs: 180_000,
      },
    };
    const result = finalizeDrainWatchdogState(draining);
    expect(result.servedTimeoutIds).toEqual(["combo-visit"]);
    expect(result.state.customers["combo-visit"]).toBeUndefined();
    expect(grossSales(result.state)).toHaveLength(1);
    expect(result.state.progression.xp).toBe(5);
    expect(result.state.metrics.nutrition.servedMeals).toBe(1);
    expect(result.state.forecastArrivals[0]?.nutritionResult).toBeDefined();
    expect(result.state.events).toContainEqual(expect.objectContaining({
      type: "meal-partial",
      entityId: "combo-visit",
      message: "served-timeout",
    }));
    const rating = result.state.metrics.visitRatings.find(
      (entry) => entry.customerId === "combo-visit",
    )!;
    expect(rating.components.foodQuality).toBeGreaterThan(50);
    expect(ledgerReconciliationDeltaCents(
      result.state.periodLedgers[result.state.servicePeriod.sequenceId]!,
      result.state.economy.cashCents,
    )).toBe(0);
  });
});
