import { describe, expect, it } from "vitest";

import {
  EMPTY_COMBO_BOARD,
  aggregateNutritionProfiles,
  assertSimulationInvariants,
  createServingTerms,
  deserializeGameState,
  dispatchCommand,
  migratePersistentState,
  persistentStateFromGame,
  serializeGameState,
  settleServedComponents,
  snapshotMealOrder,
  snapshotOrderLine,
  stepSimulation,
  type ComboBoard,
  type GameState,
  type NutritionMetric,
  type NutritionProfile,
  type NutritionValue,
  type SimulationCatalog,
} from "../../src/game/core";
import { NUTRITION_METRICS } from "../../src/game/core/nutrition";
import { makeGame, TEST_CATALOG } from "./fixtures";

function profile(id: string): NutritionProfile {
  return {
    id,
    dishId: id,
    status: "released",
    nutritionClass: "meal",
    nutrients: Object.fromEntries(NUTRITION_METRICS.map((metric) => [
      metric,
      { status: "known", value: 1 },
    ])) as Record<NutritionMetric, NutritionValue>,
    intentFits: { "lighter-energy": 0.6 },
  };
}

const mainProfile = profile("main");
const sideProfile = profile("side");
const terms = createServingTerms({
  priceCents: 500,
  ingredientCostCents: 175,
  preparationTimeMs: 200,
  servingTimeMs: 100,
  eatingTimeMs: 300,
  starAppeal: 4,
  demandModifierBasisPoints: 10_000,
});

function mealSnapshot(periodSequenceId = 1) {
  const lines = [
    {
      role: "main" as const,
      orderLine: snapshotOrderLine({
        lineId: "visit:1",
        dishId: "noodles",
        preparationId: "noodles::base",
        mealRole: "main",
        arrivalPeriodSequenceId: periodSequenceId,
        terms,
        nutritionProfile: mainProfile,
        mealBalanceRating: 3.5,
        intentFit: 0.6,
      }),
    },
    {
      role: "side" as const,
      orderLine: snapshotOrderLine({
        lineId: "visit:2",
        dishId: "rice",
        preparationId: "rice::base",
        mealRole: "side",
        arrivalPeriodSequenceId: periodSequenceId,
        terms,
        nutritionProfile: sideProfile,
        mealBalanceRating: 3.5,
        intentFit: 0.6,
      }),
    },
  ] as const;
  return snapshotMealOrder({
    orderId: "visit:meal",
    offerId: "value-pair",
    arrivalPeriodSequenceId: periodSequenceId,
    lines,
    servingPlan: {
      stops: [{
        stallInstanceId: "stall-1",
        preparationIds: ["noodles::base", "rice::base"],
        distance: 4,
      }],
      totalDistance: 4,
    },
    nutrition: aggregateNutritionProfiles([mainProfile, sideProfile]),
    fit: {
      mealBalance: 3.5,
      intentId: "lighter-energy",
      intentFit: 0.6,
      conditionIds: ["diabetes"],
      conditionAwareFit: 0.5,
      explanationCodes: ["frozen-at-order"],
    },
  });
}

function comboCatalog(): SimulationCatalog {
  return {
    ...TEST_CATALOG,
    dishes: {
      noodles: {
        ...TEST_CATALOG.dishes.noodles!,
        activePreparationId: "noodles::base",
        mealRole: "main",
      },
      rice: {
        ...TEST_CATALOG.dishes.rice!,
        activePreparationId: "rice::base",
        mealRole: "side",
      },
    },
  };
}

function levelFiveGame(): GameState {
  const state = makeGame({ catalog: comboCatalog() });
  return {
    ...state,
    progression: { ...state.progression, level: 5 },
    servicePeriod: { ...state.servicePeriod, phase: "planning" },
  };
}

describe("frozen Combo Board orders", () => {
  it("requires exact main-first serving-plan coverage", () => {
    const valid = mealSnapshot();
    expect(valid.servingPlan.stops[0]?.preparationIds).toEqual([
      "noodles::base",
      "rice::base",
    ]);
    expect(() => snapshotMealOrder({
      ...valid,
      servingPlan: {
        stops: [{
          stallInstanceId: "stall-1",
          preparationIds: ["rice::base", "foreign::base"],
          distance: 4,
        }],
        totalDistance: 4,
      },
    })).toThrow(/frozen main then complement exactly once/);
    expect(() => snapshotMealOrder({
      ...valid,
      servingPlan: {
        stops: [
          { stallInstanceId: "stall-1", preparationIds: ["noodles::base"], distance: 2 },
          { stallInstanceId: "stall-2", preparationIds: ["rice::base"], distance: 3 },
        ],
        totalDistance: 4,
      },
    })).toThrow(/total must equal/);
  });

  it("bounds frozen comparison values and de-duplicates condition ids", () => {
    const valid = mealSnapshot();
    expect(() => snapshotMealOrder({
      ...valid,
      fit: { ...valid.fit, mealBalance: 5.1 },
    })).toThrow(/between 1 and 5/);
    expect(() => snapshotMealOrder({
      ...valid,
      fit: { ...valid.fit, intentFit: 1.1 },
    })).toThrow(/between 0 and 1/);
    expect(() => snapshotMealOrder({
      ...valid,
      fit: { ...valid.fit, conditionIds: ["diabetes", "diabetes"] },
    })).toThrow(/must be unique/);
  });
});

describe("component settlement", () => {
  it("awards two discovery bonuses but counts and later awards visit XP once", () => {
    const state = levelFiveGame();
    const settled = settleServedComponents(state.economy, state.progression, [
      {
        priceCents: terms.priceCents,
        ingredientCostCents: terms.ingredientCostCents,
        preparationId: "noodles::base",
        legacyPreparationIds: ["noodles"],
      },
      {
        priceCents: terms.priceCents,
        ingredientCostCents: terms.ingredientCostCents,
        preparationId: "rice::base",
        legacyPreparationIds: ["rice"],
      },
    ]);
    expect(settled).toMatchObject({
      xpAwarded: 4,
      firstServeBonusCount: 2,
      firstServeBonusAwarded: true,
    });
    expect(settled.economy.completedVisits).toBe(state.economy.completedVisits + 1);
    expect(settled.progression.firstServedPreparationIds).toEqual([
      "noodles::base",
      "rice::base",
    ]);
    const replayedSecondLine = settleServedComponents(
      settled.economy,
      settled.progression,
      [{
        priceCents: terms.priceCents,
        ingredientCostCents: terms.ingredientCostCents,
        preparationId: "rice::base",
        legacyPreparationIds: ["rice"],
      }],
      { countVisit: false },
    );
    expect(replayedSecondLine.xpAwarded).toBe(0);
    expect(replayedSecondLine.economy.completedVisits).toBe(settled.economy.completedVisits);
  });
});

describe("core V6 persistence", () => {
  const board: ComboBoard = {
    slots: [{
      id: "value-pair",
      preparationIds: ["noodles::base", "rice::base"],
    }, null, null],
  };

  it("locks board edits below level 5 and throughout arrivals and drain", () => {
    const planning = levelFiveGame();
    const belowLevel = dispatchCommand({
      ...planning,
      progression: { ...planning.progression, level: 4 },
    }, { type: "set-combo-board", board });
    expect(belowLevel.accepted).toBe(false);
    expect(belowLevel.error).toContain("level 5");

    for (const phase of ["arrivals", "draining"] as const) {
      const locked = dispatchCommand({
        ...planning,
        servicePeriod: { ...planning.servicePeriod, phase },
      }, { type: "set-combo-board", board });
      expect(locked.accepted, phase).toBe(false);
      expect(locked.error).toContain("locked");
    }
  });

  it("migrates V5 to an empty board and round-trips a configured V6 board", () => {
    const source = levelFiveGame();
    const configured = dispatchCommand(source, { type: "set-combo-board", board });
    expect(configured.accepted).toBe(true);
    const loaded = deserializeGameState(
      serializeGameState(configured.state),
      comboCatalog(),
      { config: source.config },
    );
    expect(loaded.schemaVersion).toBe(6);
    expect(loaded.comboBoard).toEqual(board);
    expect(() => assertSimulationInvariants(loaded)).not.toThrow();

    const v6 = persistentStateFromGame(source);
    const withoutBoard = Object.fromEntries(
      Object.entries(v6).filter(([key]) => key !== "comboBoard"),
    );
    const migrated = migratePersistentState({ ...withoutBoard, schemaVersion: 5 });
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.comboBoard).toEqual(EMPTY_COMBO_BOARD);
  });

  it("rejects a crafted V6 save whose plan contains a foreign preparation", () => {
    const planned = levelFiveGame();
    const active = stepSimulation({
      ...planned,
      servicePeriod: { ...planned.servicePeriod, phase: "arrivals" },
    });
    const save = JSON.parse(JSON.stringify(persistentStateFromGame(active))) as Record<string, unknown> & {
      customers: Array<Record<string, unknown>>;
    };
    expect(save.customers.length).toBeGreaterThan(0);
    const frozen = JSON.parse(JSON.stringify(mealSnapshot(active.servicePeriod.sequenceId))) as {
      servingPlan: { stops: Array<{ preparationIds: string[] }> };
    };
    frozen.servingPlan.stops[0]!.preparationIds[1] = "foreign::base";
    save.customers[0] = {
      ...save.customers[0],
      orderLineSnapshot: undefined,
      mealOrderSnapshot: frozen,
      mealStopIndex: 0,
      settledMealLineIds: [],
    };
    expect(() => deserializeGameState(save, comboCatalog(), { config: active.config }))
      .toThrow(/frozen main then complement exactly once/);
  });

  it("requires exact V6 cohort ids and consistent settlement progress", () => {
    const planned = levelFiveGame();
    const active = stepSimulation({
      ...planned,
      servicePeriod: { ...planned.servicePeriod, phase: "arrivals" },
    });
    const save = JSON.parse(JSON.stringify(persistentStateFromGame(active))) as Record<string, unknown> & {
      customers: Array<Record<string, unknown>>;
    };
    const frozen = JSON.parse(JSON.stringify(mealSnapshot(active.servicePeriod.sequenceId))) as Record<string, unknown>;
    save.customers[0] = {
      ...save.customers[0],
      orderLineSnapshot: undefined,
      mealOrderSnapshot: frozen,
      mealStopIndex: 0,
      settledMealLineIds: ["visit:1"],
      mealSettlementCause: "complete",
      spentCents: 500,
      spent: 5,
      served: true,
    };
    expect(() => deserializeGameState(save, comboCatalog(), { config: active.config }))
      .toThrow(/does not match settled meal lines/);

    const missingPeriod = JSON.parse(JSON.stringify(save)) as typeof save;
    missingPeriod.customers[0]!.mealSettlementCause = undefined;
    missingPeriod.customers[0]!.settledMealLineIds = [];
    const meal = missingPeriod.customers[0]!.mealOrderSnapshot as Record<string, unknown>;
    delete meal.arrivalPeriodSequenceId;
    expect(() => deserializeGameState(missingPeriod, comboCatalog(), { config: active.config }))
      .toThrow(/arrivalPeriodSequenceId/);
  });

  it("validates persisted Combo Board lifecycle and settled spend", () => {
    const planned = levelFiveGame();
    const active = stepSimulation({
      ...planned,
      servicePeriod: { ...planned.servicePeriod, phase: "arrivals" },
    });
    const base = JSON.parse(JSON.stringify(persistentStateFromGame(active))) as Record<string, unknown> & {
      customers: Array<Record<string, unknown>>;
    };
    const completed = JSON.parse(JSON.stringify(base)) as typeof base;
    completed.customers[0] = {
      ...completed.customers[0],
      status: "walking-to-exit",
      orderLineSnapshot: undefined,
      mealOrderSnapshot: mealSnapshot(active.servicePeriod.sequenceId),
      mealStopIndex: 0,
      settledMealLineIds: ["visit:1", "visit:2"],
      mealSettlementCause: "complete",
      spentCents: 1_000,
      spent: 10,
      served: true,
      hasTray: false,
      servedStallDefinitionId: "stall",
      servedStallDefinitionIds: ["stall"],
    };
    const completedCustomerId = String(completed.customers[0]!.id);
    for (const [stallId, queuedCustomerIds] of Object.entries(
      completed.queues as Record<string, string[]>,
    )) {
      (completed.queues as Record<string, string[]>)[stallId] = queuedCustomerIds.filter(
        (customerId) => customerId !== completedCustomerId,
      );
    }
    expect(() => deserializeGameState(completed, comboCatalog(), { config: active.config }))
      .not.toThrow();

    const duplicateStallCredits = JSON.parse(JSON.stringify(completed)) as typeof completed;
    duplicateStallCredits.customers[0]!.servedStallDefinitionIds = ["stall", "stall"];
    expect(() => deserializeGameState(duplicateStallCredits, comboCatalog(), { config: active.config }))
      .toThrow(/unique non-empty string array/);

    const terminalDuringService = JSON.parse(JSON.stringify(completed)) as typeof completed;
    terminalDuringService.customers[0]!.status = "waiting-for-food";
    expect(() => deserializeGameState(terminalDuringService, comboCatalog(), { config: active.config }))
      .toThrow(/incompatible completed Combo Board state/);

    const incompatibleActiveStop = JSON.parse(JSON.stringify(completed)) as typeof completed;
    incompatibleActiveStop.customers[0]!.status = "walking-to-queue";
    incompatibleActiveStop.customers[0]!.mealSettlementCause = undefined;
    incompatibleActiveStop.customers[0]!.settledMealLineIds = ["visit:1"];
    incompatibleActiveStop.customers[0]!.spentCents = 500;
    incompatibleActiveStop.customers[0]!.spent = 5;
    incompatibleActiveStop.customers[0]!.hasTray = true;
    expect(() => deserializeGameState(incompatibleActiveStop, comboCatalog(), { config: active.config }))
      .toThrow(/incompatible active Combo Board progress/);

    const wrongSpend = JSON.parse(JSON.stringify(completed)) as typeof completed;
    wrongSpend.customers[0]!.spentCents = 999;
    expect(() => deserializeGameState(wrongSpend, comboCatalog(), { config: active.config }))
      .toThrow(/settled frozen meal-line prices/);
  });
});
