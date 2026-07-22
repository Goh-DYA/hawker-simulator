import { describe, expect, it } from "vitest";
import {
  ARRIVAL_PERIOD_MS,
  advanceFlowQualification,
  arrivalUpkeepChargesDue,
  advanceServicePeriod,
  acceptDailyObjective,
  applyCompletedVisit,
  beginServiceDrain,
  chargeUpkeep,
  createEconomyState,
  createInitialServicePeriod,
  createDailyObjectives,
  createPeriodLedger,
  dispatchCommand,
  finalizeDrainWatchdog,
  finalizeDrainWatchdogState,
  grantRecovery,
  ingredientCostFromRate,
  ledgerContributionCents,
  ledgerReconciliationDeltaCents,
  migratePersistentState,
  objectiveFeasibilityLimits,
  objectiveRewardCashCents,
  objectiveRewardXp,
  overtimeUpkeepChargeDue,
  operatingMargin,
  planNextServicePeriod,
  recordLedgerEntry,
  sgdToCents,
  skipDailyObjective,
  startServicePeriod,
  stepSimulation,
  updateProgressionSystems,
  visitXp,
  type GameState,
  type ProgressionState,
} from "../../src/game/core";
import { makeGame } from "./fixtures";

function progression(): ProgressionState {
  return {
    xp: 0,
    level: 1,
    reputation: 2.5,
    unlockedDefinitionIds: [],
    expansionCount: 0,
    focusDay: 1,
    dailyObjectives: [],
    claimedMilestoneIds: [],
    stallMastery: {},
    firstServedPreparationIds: [],
  };
}

describe("integer SGD economy", () => {
  it("uses half-up cents for authored SGD and basis-point ingredient rates", () => {
    expect(sgdToCents(4.205)).toBe(421);
    expect(ingredientCostFromRate(sgdToCents(7.95), 3_333)).toBe(265);
  });

  it("awards visit XP independently of price and only one first-serve bonus", () => {
    expect(visitXp(0)).toBe(5);
    expect(visitXp(100)).toBe(10);
    expect(visitXp(100, true)).toBe(3);
    const first = applyCompletedVisit(createEconomyState(sgdToCents(20)), progression(), {
      priceCents: sgdToCents(4),
      ingredientCostCents: sgdToCents(1.2),
      satisfaction: 80,
      preparationId: "rice-standard",
    });
    const second = applyCompletedVisit(first.economy, first.progression, {
      priceCents: sgdToCents(40),
      ingredientCostCents: sgdToCents(12),
      satisfaction: 80,
      preparationId: "rice-standard",
    });
    expect(first.progression.xp).toBe(11);
    expect(second.progression.xp - first.progression.xp).toBe(9);
    expect(first.economy.cashCents).toBe(sgdToCents(22.8));
  });

  it("caps upkeep at available cash and recovery at the unresolved shortfall", () => {
    const charged = chargeUpkeep(createEconomyState(sgdToCents(3)), sgdToCents(5));
    expect(charged.paidCents).toBe(300);
    expect(charged.economy.cashCents).toBe(0);
    const recovery = grantRecovery(charged.economy, sgdToCents(900));
    expect(recovery.grantedCents).toBe(sgdToCents(650));
    expect(recovery.remainingShortfallCents).toBe(sgdToCents(250));
  });

  it("charges authored open-stall upkeep on each arrivals minute", () => {
    const source = makeGame({
      catalog: {
        ...makeGame().catalog,
        placeables: {
          ...makeGame().catalog.placeables,
          stall: { ...makeGame().catalog.placeables.stall, upkeepCents: sgdToCents(1) },
        },
      },
    });
    const state = {
      ...source,
      spawnCountdownMs: 10_000,
      servicePeriod: {
        ...source.servicePeriod,
        arrivalElapsedMs: 59_900,
        stallOpenElapsedMs: { "stall-1": 59_900 },
      },
    };
    const advanced = stepSimulation(state);
    expect(advanced.economy.cashCents).toBe(state.economy.cashCents - 100);
    expect(advanced.periodLedgers[1]!.upkeepCents).toBe(100);
  });

  it("reconciles a cause-coded period ledger to the cent", () => {
    let ledger = createPeriodLedger(7);
    for (const [id, kind, amount] of [
      ["sale", "gross-sale", 1_000],
      ["food", "ingredient-cost", 330],
      ["refund", "refund", 50],
      ["upkeep", "upkeep", 100],
      ["objective", "objective", 200],
      ["recovery", "recovery", 100],
    ] as const) {
      ledger = recordLedgerEntry(ledger, {
        id,
        kind,
        amountCents: sgdToCents(amount / 100),
        tick: 1,
      });
    }
    expect(ledgerContributionCents(ledger)).toBe(520);
    expect(operatingMargin(ledger)).toBeCloseTo(0.57);
    expect(ledgerReconciliationDeltaCents(ledger)).toBe(0);
  });

  it("applies the authored objective reward caps", () => {
    expect(objectiveRewardCashCents(1)).toBe(sgdToCents(18));
    expect(objectiveRewardCashCents(20)).toBe(sgdToCents(60));
    expect(objectiveRewardXp(1)).toBe(12);
    expect(objectiveRewardXp(20)).toBe(40);
  });

  it("offers three locked targets and permits a reward-free skip", () => {
    const offered = createDailyObjectives(makeGame(), 1);
    expect(offered).toHaveLength(3);
    expect(offered.every((objective) => objective.accepted === false)).toBe(true);
    const accepted = acceptDailyObjective(offered, offered[1]!.id);
    expect(accepted.filter((objective) => objective.accepted)).toHaveLength(1);
    expect(accepted[1]!.target).toBe(offered[1]!.target);
    const skipped = skipDailyObjective(offered, offered[0]!.id);
    expect(skipped[0]).toMatchObject({
      target: offered[0]!.target,
      accepted: false,
      skipped: true,
      completed: false,
    });
  });

  it("caps level-20 objectives to deterministic setup throughput and available nutrition", () => {
    const defaultHighLevel = {
      ...makeGame(),
      progression: { ...makeGame().progression, level: 20 },
    };
    const defaultLimits = objectiveFeasibilityLimits(defaultHighLevel);
    const defaultOffers = createDailyObjectives(defaultHighLevel, 1);
    expect(defaultLimits.serviceVisitLimit).toBe(18);
    expect(defaultOffers.find((objective) => objective.kind === "serve")?.target).toBe(18);
    expect(defaultOffers.find((objective) => objective.kind === "serve")?.target).not.toBe(45);

    const constrainedBase = makeGame({ config: { spawnIntervalMs: 100_000 } });
    const constrained: GameState = {
      ...constrainedBase,
      progression: { ...constrainedBase.progression, level: 20 },
    };
    const limits = objectiveFeasibilityLimits(constrained);
    const first = createDailyObjectives(constrained, 1);
    const repeated = createDailyObjectives(constrained, 1);
    expect(limits.serviceVisitLimit).toBe(1);
    expect(first).toEqual(repeated);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((objective) => objective.kind)).size).toBe(3);
    expect(first.find((objective) => objective.kind === "serve")?.target).toBe(1);
    expect(first.some((objective) => objective.kind === "flow")).toBe(false);
    expect(first.some((objective) => objective.kind === "nutrition")).toBe(false);
    expect(first.find((objective) => objective.kind === "facility")?.target).toBe(1);
    expect(first.find((objective) => objective.kind === "revenue")?.target)
      .toBeLessThanOrEqual(limits.revenueLimitCents);
  });

  it("refreshes objective offers for lunch on the same day", () => {
    const breakfast = makeGame();
    const lunchPeriod = planNextServicePeriod({ ...breakfast.servicePeriod, phase: "debrief" });
    const lunch = updateProgressionSystems({ ...breakfast, servicePeriod: lunchPeriod });
    expect(lunch.servicePeriod.day).toBe(1);
    expect(lunch.progression.focusDay).toBe(2);
    expect(lunch.progression.dailyObjectives.every((objective) => objective.id.startsWith("period-2-"))).toBe(true);
    expect(lunch.progression.dailyObjectives.every((objective) => objective.accepted === false)).toBe(true);
  });
});

describe("service periods and drains", () => {
  it("runs exactly 240 seconds of arrivals and freezes the clock during drain", () => {
    const arrivals = startServicePeriod(createInitialServicePeriod());
    const almostClosed = advanceServicePeriod(arrivals, 239_999, ["guest-1"]);
    expect(almostClosed.state.phase).toBe("arrivals");
    const closed = advanceServicePeriod(almostClosed.state, 1, ["guest-1"]);
    expect(closed.closedArrivals).toBe(true);
    expect(closed.state).toMatchObject({ phase: "draining", displayedMinute: 600 });
    const draining = advanceServicePeriod(closed.state, 60_000, ["guest-1"]);
    expect(draining.state.displayedMinute).toBe(600);
    expect(draining.state.drainElapsedMs).toBe(60_000);
  });

  it("rejects an early close and classifies watchdog causes after the authored close", () => {
    const arrivals = startServicePeriod(createInitialServicePeriod());
    expect(() => beginServiceDrain(arrivals, ["a", "b"])).toThrow(/240,000 milliseconds/);
    const drain = beginServiceDrain({
      ...arrivals,
      arrivalElapsedMs: ARRIVAL_PERIOD_MS,
    }, ["a", "b"]);
    expect(drain.phase).toBe("draining");
    const result = finalizeDrainWatchdog([
      { id: "a", served: true },
      { id: "b", served: false },
    ]);
    expect(result).toEqual({ servedTimeoutIds: ["a"], unservedDepartureIds: ["b"] });
  });

  it("locks configuration during arrivals while preserving stall controls", () => {
    const source = makeGame();
    const state = {
      ...source,
      servicePeriod: { ...source.servicePeriod, arrivalElapsedMs: 0 },
    };
    expect(dispatchCommand(state, {
      type: "place-object",
      objectId: "locked-table",
      definitionId: "table",
      origin: { x: 4, y: 6 },
    }).accepted).toBe(false);
    expect(dispatchCommand(state, {
      type: "set-stall-open",
      objectId: "stall-1",
      open: false,
    }).accepted).toBe(true);
  });

  it("charges four arrival minutes and at most one drain overtime minute", () => {
    expect(arrivalUpkeepChargesDue(0, 240_000)).toBe(4);
    expect(arrivalUpkeepChargesDue(59_999, 60_000)).toBe(1);
    expect(overtimeUpkeepChargeDue(59_999, 60_000, false)).toBe(true);
    expect(overtimeUpkeepChargeDue(59_999, 60_000, true)).toBe(false);
    expect(overtimeUpkeepChargeDue(60_000, 120_000, false)).toBe(false);
  });

  it("ends at the 180-second watchdog and advances periods only after debrief", () => {
    const arrivals = startServicePeriod(createInitialServicePeriod());
    const draining = beginServiceDrain({
      ...arrivals,
      arrivalElapsedMs: ARRIVAL_PERIOD_MS,
    }, ["a"]);
    const expired = advanceServicePeriod(draining, 180_000, ["a"]);
    expect(expired.watchdogExpired).toBe(true);
    expect(expired.state.phase).toBe("debrief");
    expect(planNextServicePeriod(expired.state)).toMatchObject({ periodId: "lunch", sequenceId: 2 });
  });

  it("atomically finalizes the watchdog cohort with exact timeout XP", () => {
    const spawned = stepSimulation(makeGame());
    const template = Object.values(spawned.customers)[0]!;
    const state = {
      ...spawned,
      customers: {
        served: {
          ...template,
          id: "served",
          served: true,
          awardedVisitXp: 9,
          firstServeBonusAwarded: false,
        },
        unserved: { ...template, id: "unserved", served: false },
      },
      progression: { ...spawned.progression, xp: 9 },
      queues: Object.fromEntries(Object.keys(spawned.queues).map((id) => [id, []])),
      seatReservations: {},
      metrics: { ...spawned.metrics, spawnedCustomers: 2, despawnedCustomers: 0 },
      servicePeriod: {
        ...spawned.servicePeriod,
        phase: "debrief" as const,
        drainElapsedMs: 180_000,
        cohortCustomerIds: ["served", "unserved"],
      },
    };
    const result = finalizeDrainWatchdogState(state);
    expect(result.servedTimeoutIds).toEqual(["served"]);
    expect(result.unservedDepartureIds).toEqual(["unserved"]);
    expect(result.state.progression.xp).toBe(3);
    expect(result.state.customers).toEqual({});
    expect(result.state.economy.abandonedVisits).toBe(state.economy.abandonedVisits + 1);
    expect(result.state.events.map((event) => event.message)).toEqual(
      expect.arrayContaining(["served-timeout", "unserved-period-close"]),
    );
  });

  it("requires uninterrupted qualifying flow with three active guests", () => {
    expect(advanceFlowQualification(59_900, 80, 3, 100)).toBe(60_000);
    expect(advanceFlowQualification(59_900, 79.9, 3, 100)).toBe(0);
    expect(advanceFlowQualification(59_900, 100, 2, 100)).toBe(0);
  });

  it("does not advance or complete a flow objective during drain", () => {
    const spawned = stepSimulation(makeGame());
    const template = Object.values(spawned.customers)[0]!;
    const flowOffer = createDailyObjectives(spawned, 3).find(
      (objective) => objective.kind === "flow",
    )!;
    const accepted = acceptDailyObjective(
      createDailyObjectives(spawned, 3),
      flowOffer.id,
    ).map((objective) => objective.id === flowOffer.id
      ? { ...objective, flowQualifiedMs: 59_900, progress: 59_900 }
      : objective);
    const draining: GameState = {
      ...spawned,
      customers: Object.fromEntries(["a", "b", "c"].map((id) => [id, {
        ...template,
        id,
        arrivalPeriodSequenceId: spawned.servicePeriod.sequenceId,
      }])),
      progression: { ...spawned.progression, dailyObjectives: accepted },
      servicePeriod: {
        ...spawned.servicePeriod,
        phase: "draining",
        cohortCustomerIds: ["a", "b", "c"],
      },
    };
    const progressed = updateProgressionSystems(draining);
    const flow = progressed.progression.dailyObjectives.find(
      (objective) => objective.id === flowOffer.id,
    );
    expect(flow).toMatchObject({
      accepted: true,
      completed: false,
      flowQualifiedMs: 59_900,
      progress: 59_900,
    });
  });
});

describe("V5 money migration", () => {
  it("multiplies legacy SGD units exactly once", () => {
    const game = makeGame();
    const legacy = {
      schemaVersion: 4,
      savedAtTick: game.tick,
      map: game.map,
      accessPoints: game.accessPoints,
      routeGuidePoints: game.routeGuidePoints,
      qualityMode: game.qualityMode,
      objects: Object.values(game.objects),
      economy: {
        currency: 321.45,
        lifetimeRevenue: 88.1,
        lifetimeSpend: 12,
        completedVisits: 3,
        abandonedVisits: 1,
      },
      progression: {
        ...game.progression,
        level: 5,
        xp: 120,
      },
      metrics: {
        trayReturns: 0,
        visitRatings: [],
        nutrition: game.metrics.nutrition,
      },
      rngState: game.rngState,
      nextCustomerSequence: game.nextCustomerSequence,
      elapsedMs: game.elapsedMs,
    };
    const migrated = migratePersistentState(legacy);
    const migratedAgain = migratePersistentState(migrated);
    expect(migrated.economy.cashCents).toBe(32_145);
    expect(migratedAgain.economy.cashCents).toBe(32_145);
    expect(migrated.progression.level).toBe(5);
  });
});
