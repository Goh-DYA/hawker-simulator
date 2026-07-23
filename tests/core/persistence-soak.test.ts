import { describe, expect, it } from "vitest";
import {
  ARRIVAL_PERIOD_MS,
  assertSimulationInvariants,
  beginServiceDrain,
  deserializeGameState,
  deserializeGameStateWithReport,
  dispatchCommand,
  ledgerReconciliationDeltaCents,
  migratePersistentState,
  persistentStateFromGame,
  serializeGameState,
  simulationDigest,
  stepSimulation,
  validateCatalog,
  type GameState,
  type SimulationCatalog,
} from "../../src/game/core";
import { makeGame, TEST_CATALOG } from "./fixtures";

function runSteps(state: GameState, count: number): GameState {
  let current = state;
  for (let index = 0; index < count; index += 1) {
    current = stepSimulation(current);
    assertSimulationInvariants(current);
  }
  return current;
}

function runUntil(
  state: GameState,
  predicate: (candidate: GameState) => boolean,
  limit = 2_000,
): GameState {
  let current = state;
  for (let index = 0; index < limit && !predicate(current); index += 1) {
    current = stepSimulation(current);
    assertSimulationInvariants(current);
  }
  return current;
}

describe("versioned persistence", () => {
  it("round-trips active visits, queues, reservations, and frozen cohort state", () => {
    const active = runSteps(makeGame({ seed: 77 }), 25);
    expect(Object.keys(active.customers).length).toBeGreaterThan(0);
    const serialized = serializeGameState(active);
    const loaded = deserializeGameState(serialized, TEST_CATALOG, { config: active.config });
    expect(loaded.schemaVersion).toBe(6);
    expect(loaded.economy).toEqual(active.economy);
    expect(loaded.progression).toEqual(active.progression);
    expect(loaded.objects).toEqual(active.objects);
    expect(loaded.customers).toEqual(active.customers);
    expect(loaded.queues).toEqual(active.queues);
    expect(loaded.seatReservations).toEqual(active.seatReservations);
    expect(loaded.metrics).toEqual(active.metrics);
    expect(() => assertSimulationInvariants(loaded)).not.toThrow();
    expect(loaded.servicePeriod.cohortCustomerIds).toEqual(
      Object.values(active.customers)
        .filter((customer) => customer.arrivalPeriodSequenceId === active.servicePeriod.sequenceId)
        .map((customer) => customer.id)
        .sort(),
    );
  });

  it("round-trips active-cohort counters and preserves accounting through drain completion", () => {
    const active = runSteps(makeGame({ seed: "cohort-round-trip" }), 25);
    const cohortIds = Object.values(active.customers)
      .filter((customer) => customer.arrivalPeriodSequenceId === active.servicePeriod.sequenceId)
      .map((customer) => customer.id)
      .sort();
    expect(cohortIds.length).toBeGreaterThan(0);
    const draining = {
      ...active,
      servicePeriod: beginServiceDrain({
        ...active.servicePeriod,
        arrivalElapsedMs: ARRIVAL_PERIOD_MS,
      }, cohortIds),
    };
    const loaded = deserializeGameState(serializeGameState(draining), TEST_CATALOG, {
      config: draining.config,
    });
    expect(loaded.metrics).toEqual(draining.metrics);
    expect(() => assertSimulationInvariants(loaded)).not.toThrow();

    const completed = runUntil(
      loaded,
      (candidate) => candidate.servicePeriod.phase === "debrief",
    );
    expect(completed.servicePeriod.phase).toBe("debrief");
    expect(Object.keys(completed.customers)).toHaveLength(0);
    expect(completed.metrics.spawnedCustomers).toBe(completed.metrics.despawnedCustomers);
  });

  it("rejects a V5 save whose persisted active-customer counters do not reconcile", () => {
    const active = runSteps(makeGame({ seed: "broken-cohort-counters" }), 10);
    const save = persistentStateFromGame(active);
    expect(() => deserializeGameState({
      ...save,
      metrics: {
        ...save.metrics,
        spawnedCustomers: save.metrics.spawnedCustomers + 1,
      },
    }, TEST_CATALOG, { config: active.config })).toThrow(/simulation invariants/);
  });

  it("normalizes transitional period ids and rejects a frozen-order cohort mismatch", () => {
    const ordered = runUntil(
      makeGame({ seed: "period-id-normalization", config: { spawnIntervalMs: 100_000 } }),
      (candidate) => Object.values(candidate.customers).some(
        (customer) => customer.orderLineSnapshot !== undefined,
      ),
    );
    const serialized = serializeGameState(ordered);
    const transitional = JSON.parse(serialized) as {
      schemaVersion: number;
      comboBoard?: unknown;
      servicePeriod: { sequenceId: number };
      customers: Array<{
        arrivalPeriodSequenceId?: unknown;
        orderLineSnapshot?: { arrivalPeriodSequenceId?: unknown };
      }>;
    };
    const orderedCustomer = transitional.customers.find(
      (customer) => customer.orderLineSnapshot !== undefined,
    );
    expect(orderedCustomer).toBeDefined();
    transitional.schemaVersion = 5;
    delete transitional.comboBoard;
    delete orderedCustomer!.arrivalPeriodSequenceId;
    orderedCustomer!.orderLineSnapshot!.arrivalPeriodSequenceId = "preview-period-id";
    const normalized = deserializeGameState(transitional, TEST_CATALOG, {
      config: ordered.config,
    });
    const normalizedCustomer = Object.values(normalized.customers).find(
      (customer) => customer.orderLineSnapshot !== undefined,
    );
    expect(normalizedCustomer?.arrivalPeriodSequenceId).toBe(
      transitional.servicePeriod.sequenceId,
    );
    expect(normalizedCustomer?.orderLineSnapshot?.arrivalPeriodSequenceId).toBe(
      transitional.servicePeriod.sequenceId,
    );

    const mismatched = JSON.parse(serialized) as typeof transitional;
    const mismatchedCustomer = mismatched.customers.find(
      (customer) => customer.orderLineSnapshot !== undefined,
    )!;
    mismatchedCustomer.orderLineSnapshot!.arrivalPeriodSequenceId =
      mismatched.servicePeriod.sequenceId + 1;
    expect(() => deserializeGameState(mismatched, TEST_CATALOG, {
      config: ordered.config,
    })).toThrow(/must match the visit cohort/);
  });

  it("migrates a representative V1 save without discarding player currency or XP", () => {
    const current = makeGame();
    const migrated = migratePersistentState({
      schemaVersion: 1,
      map: current.map,
      entrance: current.entrance,
      exit: current.exit,
      objects: Object.values(current.objects),
      money: 321,
      xp: 450,
      reputation: 4,
      seed: 123,
    });
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.economy.cashCents).toBe(32_100);
    expect(migrated.progression).toMatchObject({ xp: 450, level: 3, reputation: 4 });
  });

  it("replaces origin/main continuous-day objectives with period-scoped offers", () => {
    const current = makeGame({ seed: "origin-main-v4-objectives" });
    const originMainV4 = {
      schemaVersion: 4,
      savedAtTick: current.tick,
      map: current.map,
      accessPoints: current.accessPoints,
      routeGuidePoints: current.routeGuidePoints,
      qualityMode: current.qualityMode,
      objects: Object.values(current.objects),
      economy: {
        currency: 321.45,
        lifetimeRevenue: 88.1,
        lifetimeSpend: 12,
        completedVisits: 3,
        abandonedVisits: 1,
      },
      progression: {
        xp: 120,
        level: 5,
        reputation: 4,
        unlockedDefinitionIds: current.progression.unlockedDefinitionIds,
        expansionCount: 0,
        focusDay: 1,
        dailyObjectives: [
          {
            id: "day-1-1",
            day: 1,
            kind: "revenue",
            title: "A lively service",
            description: "Earn 43 credits today.",
            target: 43,
            progress: 43,
            startValue: 0,
            rewardCash: 100,
            rewardXp: 30,
            completed: true,
          },
          {
            id: "day-1-2",
            day: 1,
            kind: "flow",
            title: "Easy movement",
            description: "Keep queue flow at 80% or better.",
            target: 80,
            progress: 80,
            startValue: 0,
            rewardCash: 100,
            rewardXp: 30,
            completed: true,
          },
          {
            id: "day-1-3",
            day: 1,
            kind: "facility",
            title: "Tidy trays",
            description: "Return two trays today.",
            target: 2,
            progress: 2,
            startValue: 0,
            rewardCash: 100,
            rewardXp: 30,
            completed: true,
          },
        ],
        claimedMilestoneIds: [],
        stallMastery: {},
      },
      metrics: {
        trayReturns: 0,
        visitRatings: [],
        nutrition: current.metrics.nutrition,
      },
      rngState: current.rngState,
      nextCustomerSequence: current.nextCustomerSequence,
      elapsedMs: current.elapsedMs,
    };

    const migrated = migratePersistentState(originMainV4);
    expect(migrated.progression).toMatchObject({ focusDay: 0, dailyObjectives: [] });

    const loaded = deserializeGameState(originMainV4, TEST_CATALOG, { config: current.config });
    expect(loaded.progression.focusDay).toBe(loaded.servicePeriod.sequenceId);
    expect(loaded.progression.dailyObjectives).toHaveLength(3);
    expect(loaded.progression.dailyObjectives.every(
      (objective) => objective.id.startsWith("period-1-") &&
        objective.accepted === false &&
        objective.completed === false,
    )).toBe(true);
    expect(loaded.progression.dailyObjectives.some(
      (objective) => objective.description.includes("today") ||
        objective.description.includes("credits"),
    )).toBe(false);
  });

  it("rebuilds imported ledger aggregates from immutable entries", () => {
    const current = makeGame({ seed: "ledger-aggregate-repair" });
    const save = persistentStateFromGame(current);
    const sequenceId = save.servicePeriod.sequenceId;
    const openingCashCents = save.periodLedgers[sequenceId]!.openingCashCents;
    const imported = {
      ...save,
      economy: { ...save.economy, cashCents: openingCashCents + 600 },
      periodLedgers: {
        ...save.periodLedgers,
        [sequenceId]: {
          ...save.periodLedgers[sequenceId]!,
          // These forged aggregate rows have the same net as the entries and
          // therefore used to appear reconciled despite misstating the split.
          grossSalesCents: 600,
          ingredientCostsCents: 0,
          entries: [
            {
              id: "sale-1",
              periodSequenceId: sequenceId,
              kind: "gross-sale" as const,
              amountCents: 1_000,
              tick: 1,
            },
            {
              id: "cost-1",
              periodSequenceId: sequenceId,
              kind: "ingredient-cost" as const,
              amountCents: 400,
              tick: 1,
            },
          ],
        },
      },
    };

    const migrated = migratePersistentState(imported);
    const ledger = migrated.periodLedgers[sequenceId]!;
    expect(ledger).toMatchObject({
      grossSalesCents: 1_000,
      ingredientCostsCents: 400,
    });
    expect(ledgerReconciliationDeltaCents(ledger, migrated.economy.cashCents)).toBe(0);
  });

  it("rejects an imported active ledger whose entries do not reconcile to cash", () => {
    const current = makeGame({ seed: "ledger-cash-rejection" });
    const save = persistentStateFromGame(current);
    const sequenceId = save.servicePeriod.sequenceId;
    const ledger = save.periodLedgers[sequenceId]!;
    const imported = {
      ...save,
      economy: { ...save.economy, cashCents: ledger.openingCashCents + 601 },
      periodLedgers: {
        ...save.periodLedgers,
        [sequenceId]: {
          ...ledger,
          grossSalesCents: 1_000,
          ingredientCostsCents: 400,
          entries: [
            {
              id: "sale-1",
              periodSequenceId: sequenceId,
              kind: "gross-sale" as const,
              amountCents: 1_000,
              tick: 1,
            },
            {
              id: "cost-1",
              periodSequenceId: sequenceId,
              kind: "ingredient-cost" as const,
              amountCents: 400,
              tick: 1,
            },
          ],
        },
      },
    };

    expect(() => migratePersistentState(imported)).toThrow(
      `periodLedgers.${sequenceId} does not reconcile with economy.cashCents`,
    );
  });

  it("neutralizes legacy elapsed-time walking ratings when loading V3 saves", () => {
    const save = persistentStateFromGame(makeGame());
    const legacy = {
      ...save,
      metrics: {
        ...save.metrics,
        visitRatings: [
          {
            customerId: "legacy-guest",
            score: 60,
            served: true,
            abandoned: false,
            reason: "served",
            day: 1,
            components: {
              foodQuality: 140,
              wait: 70,
              value: 70,
              walking: 30,
              comfort: 70,
              cleanliness: 70,
              ambience: 70,
            },
          },
        ],
      },
    };

    const loaded = deserializeGameState(legacy, TEST_CATALOG);
    expect(loaded.metrics.visitRatings[0]).toMatchObject({
      walkingMetricVersion: 2,
      score: 64,
      components: { foodQuality: 100, walking: 70 },
    });
  });

  it("requires an explicit alias or refund when saved content has been removed", () => {
    const current = makeGame();
    const save = persistentStateFromGame(current);
    const changed = {
      ...save,
      objects: save.objects.map((object) =>
        object.id === "seat-1" ? { ...object, definitionId: "retired-seat" } : object,
      ),
    };
    expect(() => deserializeGameState(changed, TEST_CATALOG)).toThrow(/removed definition/);
    const recovered = deserializeGameStateWithReport(changed, TEST_CATALOG, {
      removedDefinitionRefunds: { "retired-seat": 25 },
    });
    expect(recovered.state.objects["seat-1"]).toBeUndefined();
    expect(recovered.state.economy.currency).toBe(current.economy.currency + 25);
    expect(recovered.recovery).toMatchObject({ removedObjectIds: ["seat-1"], currencyRefunded: 25 });
    const activeLedger = recovered.state.periodLedgers[recovered.state.servicePeriod.sequenceId]!;
    expect(activeLedger.openingCashCents).toBe(
      current.periodLedgers[current.servicePeriod.sequenceId]!.openingCashCents + 2_500,
    );
    expect(ledgerReconciliationDeltaCents(activeLedger, recovered.state.economy.cashCents)).toBe(0);
    const reloaded = deserializeGameState(serializeGameState(recovered.state), TEST_CATALOG);
    expect(reloaded.economy.cashCents).toBe(recovered.state.economy.cashCents);
    expect(ledgerReconciliationDeltaCents(
      reloaded.periodLedgers[reloaded.servicePeriod.sequenceId]!,
      reloaded.economy.cashCents,
    )).toBe(0);
  });

  it("remaps explicit unlock progression through the same content alias table", () => {
    const save = persistentStateFromGame(makeGame());
    const changed = {
      ...save,
      progression: {
        ...save.progression,
        unlockedDefinitionIds: [...save.progression.unlockedDefinitionIds, "old-premium"],
      },
    };
    const catalog: SimulationCatalog = {
      ...TEST_CATALOG,
      placeables: {
        ...TEST_CATALOG.placeables,
        premium: { ...TEST_CATALOG.placeables.table, id: "premium", unlockLevel: 5 },
      },
    };
    const loaded = deserializeGameStateWithReport(changed, catalog, {
      definitionIdAliases: { "old-premium": "premium" },
    });
    expect(loaded.state.progression.unlockedDefinitionIds).toContain("premium");
    expect(loaded.recovery.warnings.join(" ")).toContain("old-premium");
  });

  it("reports malformed catalog references before simulation starts", () => {
    const malformed: SimulationCatalog = {
      ...TEST_CATALOG,
      placeables: {
        ...TEST_CATALOG.placeables,
        broken: {
          ...TEST_CATALOG.placeables.stall,
          id: "broken",
          stall: {
            dishIds: ["missing"],
            orderMs: 100,
            preparationCapacity: 1,
            queueCapacity: 4,
            popularity: 1,
            quality: 3,
          },
        },
      },
    };
    expect(validateCatalog(malformed).some((issue) => issue.message.includes("unknown dish"))).toBe(true);
    const deeplyMalformed = {
      ...TEST_CATALOG,
      placeables: {
        bad: {
          ...TEST_CATALOG.placeables.table,
          id: "bad",
          allowedRotations: "bad",
          seatPoints: "bad",
          footprint: { width: 1, height: 1, cells: [null] },
        },
      },
    } as unknown as SimulationCatalog;
    expect(() => validateCatalog(deeplyMalformed)).not.toThrow();
    expect(validateCatalog(deeplyMalformed).length).toBeGreaterThan(0);
    const emptyIdCatalog = {
      ...TEST_CATALOG,
      dishes: { ...TEST_CATALOG.dishes, "": { ...TEST_CATALOG.dishes.rice, id: "" } },
    } as SimulationCatalog;
    expect(validateCatalog(emptyIdCatalog).some((issue) => issue.message.includes("safe ID"))).toBe(true);
  });
});

describe("seeded soak", () => {
  it("is reproducible and leaks neither queues nor reservations after closing", () => {
    const first = runSteps(makeGame({ seed: "soak-2026" }), 600);
    const second = runSteps(makeGame({ seed: "soak-2026" }), 600);
    expect(simulationDigest(first)).toBe(simulationDigest(second));
    expect(first.metrics.spawnedCustomers).toBe(first.metrics.despawnedCustomers + Object.keys(first.customers).length);

    const closed = dispatchCommand(first, { type: "set-stall-open", objectId: "stall-1", open: false }).state;
    const drained = runSteps(closed, 300);
    expect(Object.keys(drained.customers)).toHaveLength(0);
    expect(drained.queues["stall-1"]).toEqual([]);
    expect(drained.seatReservations).toEqual({});
  });
});
