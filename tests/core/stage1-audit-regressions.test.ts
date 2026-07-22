import { describe, expect, it } from "vitest";
import {
  DRAIN_TARGET_P95_MS,
  DRAIN_WATCHDOG_MS,
  acceptDailyObjective,
  applyCompletedVisit,
  applyRecoveryPolicy,
  createServingTerms,
  deserializeGameState,
  dispatchCommand,
  ledgerReconciliationDeltaCents,
  serializeGameState,
  sgdToCents,
  skipDailyObjective,
  snapshotOrderLine,
  stepSimulation,
  updateProgressionSystems,
  visitXp,
  type GameState,
  type SimulationCatalog,
} from "../../src/game/core";
import { INITIAL_OBJECTS, makeGame, TEST_CATALOG } from "./fixtures";

function planning(source: GameState): GameState {
  return { ...source, servicePeriod: { ...source.servicePeriod, phase: "planning" } };
}

function runUntil(
  source: GameState,
  predicate: (state: GameState) => boolean,
  limit = 500,
): GameState {
  let state = source;
  for (let index = 0; index < limit && !predicate(state); index += 1) {
    state = stepSimulation(state);
  }
  return state;
}

describe("Stage 1 independent-audit regressions", () => {
  it("preserves an authored high level, overflow XP, and unlocks across later awards", () => {
    const game = makeGame();
    const authored = {
      ...game.progression,
      xp: 12,
      level: 13,
      unlockedDefinitionIds: [...game.progression.unlockedDefinitionIds, "legacy-valid-unlock"],
    };
    const sale = applyCompletedVisit(game.economy, authored, {
      priceCents: sgdToCents(8),
      ingredientCostCents: sgdToCents(2.8),
      satisfaction: 80,
      preparationId: "audit-preparation",
    });
    expect(sale.progression.level).toBe(13);
    expect(sale.progression.xp).toBeGreaterThan(12);
    expect(sale.progression.unlockedDefinitionIds).toContain("legacy-valid-unlock");

    const objectives = acceptDailyObjective(game.progression.dailyObjectives, game.progression.dailyObjectives[0]!.id)
      .map((objective, index) => index === 0 ? { ...objective, target: 0 } : objective);
    const progressed = updateProgressionSystems({
      ...game,
      progression: { ...authored, dailyObjectives: objectives },
    });
    expect(progressed.progression.level).toBe(13);
    expect(progressed.progression.xp).toBeGreaterThan(12);
  });

  it("marks an accepted objective skipped and never pays it retroactively", () => {
    const game = makeGame();
    const offered = game.progression.dailyObjectives;
    const accepted = acceptDailyObjective(offered, offered[0]!.id);
    const skipped = skipDailyObjective(accepted, offered[0]!.id)
      .map((objective, index) => index === 0 ? { ...objective, target: 0 } : objective);
    expect(skipped[0]).toMatchObject({ accepted: false, skipped: true, completed: false });
    const updated = updateProgressionSystems({
      ...game,
      progression: { ...game.progression, dailyObjectives: skipped },
    });
    expect(updated.progression.dailyObjectives[0]).toMatchObject({ skipped: true, completed: false });
    expect(updated.economy.cashCents).toBe(game.economy.cashCents);
  });

  it("uses canonical cents for affordability even when legacy SGD inputs disagree", () => {
    const catalog: SimulationCatalog = {
      ...TEST_CATALOG,
      archetypes: {
        only: {
          ...TEST_CATALOG.archetypes.regular,
          id: "only",
          budget: 100,
          budgetCents: sgdToCents(5),
          preferenceTags: ["expensive"],
        },
      },
      dishes: {
        expensive: {
          ...TEST_CATALOG.dishes.noodles,
          id: "expensive",
          price: 1,
          priceCents: sgdToCents(10),
          preferenceTags: ["expensive"],
        },
        affordable: {
          ...TEST_CATALOG.dishes.rice,
          id: "affordable",
          price: 99,
          priceCents: sgdToCents(4),
          preferenceTags: [],
        },
      },
      placeables: {
        ...TEST_CATALOG.placeables,
        stall: {
          ...TEST_CATALOG.placeables.stall,
          stall: { ...TEST_CATALOG.placeables.stall.stall!, dishIds: ["expensive", "affordable"] },
        },
      },
    };
    const ordered = runUntil(makeGame({
      catalog,
      seed: "cents-affordability",
      config: { spawnIntervalMs: 100_000 },
    }), (state) => Object.values(state.customers).some((customer) => Boolean(customer.orderedDishId)));
    expect(Object.values(ordered.customers).find((customer) => customer.orderedDishId)?.orderedDishId)
      .toBe("affordable");
  });

  it("persists frozen order terms and settles the saved price after catalogue changes", () => {
    const ordered = runUntil(makeGame({
      seed: "frozen-order",
      config: { spawnIntervalMs: 100_000 },
    }), (state) => Object.values(state.customers).some((customer) => Boolean(customer.orderLineSnapshot)));
    const before = Object.values(ordered.customers).find((customer) => customer.orderLineSnapshot)!;
    expect(before.orderLineSnapshot).toBeDefined();
    const frozen = before.orderLineSnapshot!;
    const changedCatalog: SimulationCatalog = {
      ...ordered.catalog,
      dishes: {
        ...ordered.catalog.dishes,
        [frozen.dishId]: {
          ...ordered.catalog.dishes[frozen.dishId]!,
          price: 999,
          priceCents: sgdToCents(999),
          ingredientCostCents: sgdToCents(300),
          preparationMs: 50_000,
          eatingMs: 50_000,
        },
      },
    };
    const loaded = deserializeGameState(serializeGameState(ordered), changedCatalog, {
      config: ordered.config,
    });
    expect(loaded.customers[before.id]?.orderLineSnapshot).toEqual(frozen);
    const grossBefore = loaded.economy.lifetimeGrossSalesCents;
    const settled = runUntil(
      loaded,
      (state) => state.economy.lifetimeGrossSalesCents > grossBefore,
      1_000,
    );
    expect(settled.economy.lifetimeGrossSalesCents - grossBefore).toBe(frozen.terms.priceCents);
  });

  it("settles cash at handover but awards normal visit XP from the final rating", () => {
    const initial = makeGame({
      seed: "final-satisfaction-xp",
      config: { spawnIntervalMs: 100_000 },
    });
    const handedOver = runUntil(
      initial,
      (state) => state.economy.completedVisits > initial.economy.completedVisits,
      1_000,
    );
    const served = Object.values(handedOver.customers).find((customer) => customer.served);
    expect(served).toBeDefined();
    expect(handedOver.economy.cashCents).toBeGreaterThan(initial.economy.cashCents);
    expect(handedOver.progression.xp - initial.progression.xp).toBe(
      served?.firstServeBonusAwarded ? 2 : 0,
    );
    expect(served?.awardedVisitXp).toBe(served?.firstServeBonusAwarded ? 2 : 0);

    const completed = runUntil(
      handedOver,
      (state) => state.customers[served!.id] === undefined,
      1_000,
    );
    const rating = completed.metrics.visitRatings.find((entry) => entry.customerId === served!.id);
    expect(rating).toBeDefined();
    expect(completed.progression.xp - handedOver.progression.xp).toBe(visitXp(rating!.score));
    expect(completed.economy.cashCents).toBe(handedOver.economy.cashCents);
  });

  it("restores a draining cohort and applies watchdog outcomes after reload", () => {
    const spawned = stepSimulation(makeGame({ config: { spawnIntervalMs: 100_000 } }));
    const template = Object.values(spawned.customers)[0]!;
    const frozen = snapshotOrderLine({
      lineId: "served:1",
      dishId: "rice",
      arrivalPeriodSequenceId: spawned.servicePeriod.sequenceId,
      terms: createServingTerms({
        priceCents: 600,
        ingredientCostCents: 200,
        preparationTimeMs: 0,
        servingTimeMs: 0,
        eatingTimeMs: 999_999,
        starAppeal: 3,
        demandModifierBasisPoints: 10_000,
      }),
    });
    const draining: GameState = {
      ...spawned,
      customers: {
        served: {
          ...template,
          id: "served",
          status: "eating",
          served: true,
          awardedVisitXp: 9,
          orderLineSnapshot: frozen,
          orderedDishId: "rice",
          arrivalPeriodSequenceId: spawned.servicePeriod.sequenceId,
        },
        unserved: {
          ...template,
          id: "unserved",
          served: false,
          arrivalPeriodSequenceId: spawned.servicePeriod.sequenceId,
        },
      },
      queues: { "stall-1": ["unserved"] },
      seatReservations: {},
      metrics: { ...spawned.metrics, spawnedCustomers: 2, despawnedCustomers: 0 },
      progression: { ...spawned.progression, xp: 9 },
      servicePeriod: {
        ...spawned.servicePeriod,
        phase: "draining",
        drainElapsedMs: 179_900,
        cohortCustomerIds: ["served", "unserved"],
      },
    };
    const loaded = deserializeGameState(serializeGameState(draining), draining.catalog, {
      config: draining.config,
    });
    expect(loaded.servicePeriod.phase).toBe("draining");
    expect(Object.keys(loaded.customers).sort()).toEqual(["served", "unserved"]);
    const finalized = stepSimulation(loaded);
    expect(finalized.servicePeriod.phase).toBe("debrief");
    expect(finalized.customers).toEqual({});
    expect(finalized.progression.xp).toBe(3);
    expect(finalized.events.map((event) => event.message)).toEqual(
      expect.arrayContaining(["served-timeout", "unserved-period-close"]),
    );
  });

  it("reconciles planning purchases and resales against actual period cash", () => {
    const initial = planning(makeGame());
    const placed = dispatchCommand(initial, {
      type: "place-object",
      objectId: "audit-table",
      definitionId: "table",
      origin: { x: 4, y: 6 },
    });
    expect(placed.accepted).toBe(true);
    const removed = dispatchCommand(placed.state, { type: "remove-object", objectId: "audit-table" });
    expect(removed.accepted).toBe(true);
    const ledger = removed.state.periodLedgers[removed.state.servicePeriod.sequenceId]!;
    expect(ledger.purchasesCents).toBe(sgdToCents(40));
    expect(ledger.resaleCents).toBe(sgdToCents(28));
    expect(removed.state.economy.lifetimeResaleCents).toBe(sgdToCents(28));
    expect(removed.state.economy.lifetimeRefundsCents).toBe(0);
    expect(ledgerReconciliationDeltaCents(ledger, removed.state.economy.cashCents)).toBe(0);
    expect(removed.events[1]?.amountCents).toBe(sgdToCents(28));
  });

  it("grants once, stays retryable until validation, and gives reclaimed essentials zero resale", () => {
    const initial = planning(makeGame({ startingCurrency: 0 }));
    const recovered = applyRecoveryPolicy(initial, {
      episodeId: "missing-setup-1",
      validSetupCostCents: sgdToCents(900),
      reclaimed: [{
        purpose: "essential",
        object: {
          id: "recovered-table",
          definitionId: "table",
          origin: { x: 4, y: 6 },
          rotation: 0,
          open: false,
        },
      }],
    });
    expect(recovered.grantedCents).toBe(sgdToCents(650));
    expect(recovered.state.recovery.zeroResaleObjectIds).toContain("recovered-table");
    const duplicate = applyRecoveryPolicy(recovered.state, {
      episodeId: "missing-setup-1",
      validSetupCostCents: sgdToCents(900),
    });
    expect(duplicate.alreadyResolved).toBe(false);
    expect(duplicate.resolved).toBe(false);
    expect(duplicate.grantedCents).toBe(0);
    const validated = applyRecoveryPolicy(duplicate.state, {
      episodeId: "missing-setup-1",
      validSetupCostCents: sgdToCents(0),
      setupValidated: true,
    });
    expect(validated.resolved).toBe(true);
    expect(validated.state.recovery.resolvedEpisodeIds).toContain("missing-setup-1");
    const resolvedRetry = applyRecoveryPolicy(validated.state, {
      episodeId: "missing-setup-1",
      validSetupCostCents: sgdToCents(900),
    });
    expect(resolvedRetry.alreadyResolved).toBe(true);
    expect(resolvedRetry.grantedCents).toBe(0);
    const removed = dispatchCommand(recovered.state, {
      type: "remove-object",
      objectId: "recovered-table",
    });
    expect(removed.accepted).toBe(true);
    expect(removed.state.economy.cashCents).toBe(recovered.state.economy.cashCents);
    expect(removed.events[1]?.amountCents).toBe(0);
  });

  it("tracks actual open time per stall and charges only each crossed minute", () => {
    const catalog: SimulationCatalog = {
      ...TEST_CATALOG,
      placeables: {
        ...TEST_CATALOG.placeables,
        stall: { ...TEST_CATALOG.placeables.stall, upkeepCents: sgdToCents(1) },
      },
    };
    const source = makeGame({
      catalog,
      initialObjects: [
        ...INITIAL_OBJECTS,
        { id: "stall-2", definitionId: "stall", origin: { x: 5, y: 0 }, rotation: 0, open: true },
      ],
      config: { spawnIntervalMs: 100_000 },
    });
    const nearMinute: GameState = {
      ...source,
      servicePeriod: {
        ...source.servicePeriod,
        arrivalElapsedMs: 59_900,
        stallOpenElapsedMs: { "stall-1": 59_900, "stall-2": 30_000 },
      },
    };
    const first = stepSimulation(nearMinute);
    expect(first.periodLedgers[1]!.upkeepCents).toBe(100);
    expect(first.servicePeriod.stallOpenElapsedMs).toMatchObject({ "stall-1": 60_000, "stall-2": 30_100 });
    const closed = dispatchCommand(first, { type: "set-stall-open", objectId: "stall-1", open: false });
    expect(closed.accepted).toBe(true);
    const second = stepSimulation({
      ...closed.state,
      servicePeriod: {
        ...closed.state.servicePeriod,
        stallOpenElapsedMs: { ...closed.state.servicePeriod.stallOpenElapsedMs, "stall-2": 59_900 },
      },
    });
    expect(second.periodLedgers[1]!.upkeepCents).toBe(200);
    expect(second.servicePeriod.stallOpenElapsedMs["stall-1"]).toBe(60_000);
  });

  it("aggregates multi-stall drain overtime into one labelled period charge", () => {
    const catalog: SimulationCatalog = {
      ...TEST_CATALOG,
      placeables: {
        ...TEST_CATALOG.placeables,
        stall: { ...TEST_CATALOG.placeables.stall, upkeepCents: sgdToCents(1) },
      },
    };
    const source = makeGame({
      catalog,
      initialObjects: [
        ...INITIAL_OBJECTS,
        { id: "stall-2", definitionId: "stall", origin: { x: 5, y: 0 }, rotation: 0, open: true },
      ],
      config: { spawnIntervalMs: 100_000 },
    });
    const draining: GameState = {
      ...source,
      customers: {},
      servicePeriod: {
        ...source.servicePeriod,
        phase: "draining",
        drainElapsedMs: 59_900,
        cohortCustomerIds: [],
      },
    };
    const charged = stepSimulation(draining);
    const overtimeEntries = charged.periodLedgers[1]!.entries.filter(
      (entry) => entry.kind === "overtime-upkeep",
    );
    expect(overtimeEntries).toHaveLength(1);
    expect(overtimeEntries[0]).toMatchObject({
      amountCents: sgdToCents(2),
      referenceId: "stall-1,stall-2",
    });
    expect(charged.servicePeriod.overtimeUpkeepCharged).toBe(true);
    expect(charged.economy.cashCents).toBe(draining.economy.cashCents - sgdToCents(2));
    const afterDebriefTick = stepSimulation(charged);
    expect(afterDebriefTick.periodLedgers[1]!.entries.filter(
      (entry) => entry.kind === "overtime-upkeep",
    )).toHaveLength(1);
  });

  it("keeps a 30-seed standard-service drain p95 below two minutes", () => {
    const drainDurations = Array.from({ length: 30 }, (_, index) => {
      let state = makeGame({
        seed: `stage1-drain-${String(index + 1).padStart(2, "0")}`,
        config: {
          spawnIntervalMs: 2_500,
          maxVisitMs: 120_000,
          standard: { maxFixedStepsPerAdvance: 100, maxActiveCustomers: undefined },
        },
      });
      let guard = 0;
      while (state.servicePeriod.phase === "arrivals" && guard < 2_500) {
        state = stepSimulation(state);
        guard += 1;
      }
      expect(state.servicePeriod.arrivalElapsedMs).toBe(240_000);
      while (state.servicePeriod.phase === "draining" && guard < 4_500) {
        state = stepSimulation(state);
        guard += 1;
      }
      expect(state.servicePeriod.phase).toBe("debrief");
      expect(state.servicePeriod.drainElapsedMs).toBeLessThanOrEqual(DRAIN_WATCHDOG_MS);
      expect(Object.keys(state.customers)).toHaveLength(0);
      return state.servicePeriod.drainElapsedMs;
    }).sort((left, right) => left - right);

    const p95Index = Math.ceil(drainDurations.length * 0.95) - 1;
    const p95Ms = drainDurations[p95Index]!;
    expect(p95Ms).toBe(3_800);
    expect(p95Ms).toBeLessThan(DRAIN_TARGET_P95_MS);
  });
});
