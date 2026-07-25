import { describe, expect, it } from "vitest";

import { PREPARATION_GAMEPLAY_CATALOGUE } from "../src/content/preparationGameplay";
import {
  asMoneyCents,
  createPeriodLedger,
  recordLedgerEntry,
  type Customer,
  type GameState,
  type PartyLifecycleState,
  type VisitRating,
} from "../src/game/core";
import {
  evaluateScenarioRun,
  getExecutableScenario,
} from "../src/game/core/scenarios";
import {
  buildScenarioRunReport,
  createScenarioRunTelemetry,
  observeScenarioAdvance,
  observeScenarioState,
  parseScenarioRunTelemetry,
} from "../src/game/runtime/scenarioTelemetry";
import { makeGame } from "./core/fixtures";

const SCENARIO_ID = "scenario.split-hall" as const;

function customer(
  id: string,
  partyId: string | undefined,
  reservedSeatKey: string,
): Customer {
  return {
    id,
    archetypeId: "regular",
    status: "eating",
    position: { x: 5, y: 5 },
    path: [],
    pathIndex: 0,
    movementProgress: 0,
    stateElapsedMs: 0,
    visitElapsedMs: 20_000,
    walkingDistanceTiles: 10,
    patienceRemainingMs: 5_000,
    satisfaction: 4,
    arrivalPeriodSequenceId: 1,
    partyId,
    healthConditions: [],
    reservedSeatKey,
    hasTray: true,
    served: true,
    spentCents: asMoneyCents(1_500),
    spent: 15,
    stuckMs: 0,
  };
}

function rating(
  customerId: string,
  wait: number,
  walking: number,
  waitMs: number,
): VisitRating {
  return {
    customerId,
    walkingMetricVersion: 2,
    score: 80,
    served: true,
    abandoned: false,
    reason: "party-served",
    components: {
      foodQuality: 80,
      wait,
      value: 75,
      walking,
      comfort: 80,
      cleanliness: 80,
      ambience: 75,
    },
    waitMs,
    day: 1,
    arrivalPeriodSequenceId: 1,
  };
}

function party(): PartyLifecycleState {
  const member = (memberId: string) => ({
    memberId,
    archetypeId: "regular",
    budgetCents: asMoneyCents(3_000),
    healthConditions: [],
    plannedStallId: "stall-1",
    plannedDishId: "noodles",
    trayReturnPlanned: true,
    served: true,
  });
  return {
    partyId: "party-1",
    leaderCustomerId: "guest-1",
    memberCustomerIds: ["guest-1", "guest-2"],
    members: [member("guest-1"), member("guest-2")],
    phase: "seated",
    orderStrategy: "single-stall-fallback",
    stallIds: ["stall-1"],
    nextStopIndex: 1,
    seatKeys: ["west-seat:0", "east-seat:0"],
    seatWaitElapsedMs: 0,
    splitExplained: true,
  };
}

function splitHallState(): GameState {
  const base = makeGame();
  const scenario = getExecutableScenario(SCENARIO_ID);
  return {
    ...base,
    map: scenario.map.grid,
    accessPoints: scenario.map.accessPoints,
    entrance: scenario.map.accessPoints.find(
      (point) => point.kind === "entrance",
    )!.position,
    exit: scenario.map.accessPoints.find(
      (point) => point.kind === "exit",
    )!.position,
    objects: {
      "west-seat": {
        id: "west-seat",
        definitionId: "seat",
        origin: { x: 5, y: 5 },
        rotation: 0,
        open: false,
      },
      "east-seat": {
        id: "east-seat",
        definitionId: "seat",
        origin: { x: 18, y: 5 },
        rotation: 0,
        open: false,
      },
    },
    customers: {
      "guest-1": customer("guest-1", "party-1", "west-seat:0"),
    },
    seatReservations: {
      "west-seat:0": "guest-1",
      "east-seat:0": "guest-1",
    },
    strategicGameplay: {
      ...base.strategicGameplay,
      parties: {
        "party-1": party(),
      },
    },
    economy: {
      ...base.economy,
      cashCents: asMoneyCents(10_000),
    },
    metrics: {
      ...base.metrics,
      spawnedCustomers: 2,
      pathRequests: 4,
      pathFailures: 1,
      visitRatings: [],
    },
  };
}

describe("scenario runtime telemetry", () => {
  it("attributes every Split Hall party member to the reserved-seat zone", () => {
    const before = splitHallState();
    const initialized = createScenarioRunTelemetry(
      SCENARIO_ID,
      1,
      "balanced-party-route",
      before,
    );
    const after: GameState = {
      ...before,
      customers: {},
      seatReservations: {},
      strategicGameplay: {
        ...before.strategicGameplay,
        parties: {},
      },
      servicePeriod: {
        ...before.servicePeriod,
        phase: "debrief",
        arrivalElapsedMs: 100_000,
      },
      metrics: {
        ...before.metrics,
        pathRequests: 10,
        pathFailures: 1,
        qualifyingFlowMs: 51_000,
        visitRatings: [
          rating("guest-1", 60, 80, 42_000),
          rating("guest-2", 40, 90, 58_000),
        ],
      },
      economy: {
        ...before.economy,
        cashCents: asMoneyCents(11_300),
      },
    };

    const observed = observeScenarioAdvance(initialized, before, after);

    expect(observed.seatZoneByCustomerId).toEqual({
      "guest-1": "zone.west-hall",
      "guest-2": "zone.east-hall",
    });
    expect(observed.completedVisitZoneById).toEqual({
      "guest-1": "zone.west-hall",
      "guest-2": "zone.east-hall",
    });
    expect(observed.waitSamplesMs).toEqual([42_000, 58_000]);
    expect(observed.flowQualifyingMs).toBe(51_000);
    expect(observed.flowObservedMs).toBe(100_000);
  });

  it("survives JSON reload and observes the same ratings idempotently", () => {
    const before = splitHallState();
    const ratingState: GameState = {
      ...before,
      metrics: {
        ...before.metrics,
        visitRatings: [rating("guest-1", 50, 75, 31_000)],
      },
    };
    const observed = observeScenarioState(
      createScenarioRunTelemetry(
        SCENARIO_ID,
        1,
        "reload-safe",
        before,
      ),
      ratingState,
    );
    const restored = parseScenarioRunTelemetry(
      JSON.parse(JSON.stringify(observed)),
    );

    expect(restored).toBeDefined();
    expect(observeScenarioState(restored!, ratingState)).toEqual(restored);
  });

  it("binds restored telemetry to the expected scenario and period", () => {
    const before = splitHallState();
    const telemetry = createScenarioRunTelemetry(
      SCENARIO_ID,
      1,
      "bound-run",
      before,
    );

    expect(parseScenarioRunTelemetry(telemetry, {
      scenarioId: SCENARIO_ID,
      periodSequenceId: 1,
    })).toEqual(telemetry);
    expect(parseScenarioRunTelemetry(telemetry, {
      scenarioId: "scenario.narrow-aisles",
      periodSequenceId: 1,
    })).toBeUndefined();
    expect(parseScenarioRunTelemetry(telemetry, {
      scenarioId: SCENARIO_ID,
      periodSequenceId: 2,
    })).toBeUndefined();
  });

  it("requires exact wait measurements for completed visits", () => {
    const before = splitHallState();
    const missingExactWait: GameState = {
      ...before,
      metrics: {
        ...before.metrics,
        visitRatings: [{
          ...rating("guest-1", 99, 99, 1),
          waitMs: undefined,
        }],
      },
    };

    expect(() =>
      observeScenarioState(
        createScenarioRunTelemetry(
          SCENARIO_ID,
          1,
          "exact-waits",
          before,
        ),
        missingExactWait,
      )
    ).toThrow(/exact wait measurement/);
  });

  it("builds a terminal, cent-exact report and keeps partial saves in progress", () => {
    const before = splitHallState();
    let ledger = createPeriodLedger(1, asMoneyCents(10_000));
    const preparation = PREPARATION_GAMEPLAY_CATALOGUE.find(
      (candidate) => candidate.dishId === "dish.poached-chicken-rice",
    )!;
    ledger = recordLedgerEntry(ledger, {
      id: "sale-1",
      kind: "gross-sale",
      amountCents: asMoneyCents(3_000),
      tick: 1,
      visitId: "guest-1",
      lineId: "line-1",
      preparationId: preparation.id,
    });
    ledger = recordLedgerEntry(ledger, {
      id: "cost-1",
      kind: "ingredient-cost",
      amountCents: asMoneyCents(1_000),
      tick: 1,
      visitId: "guest-1",
      lineId: "line-1",
      preparationId: preparation.id,
    });
    ledger = recordLedgerEntry(ledger, {
      id: "upkeep-1",
      kind: "upkeep",
      amountCents: asMoneyCents(500),
      tick: 1,
    });
    ledger = recordLedgerEntry(ledger, {
      id: "refund-1",
      kind: "refund",
      amountCents: asMoneyCents(200),
      tick: 1,
      visitId: "guest-2",
    });
    const terminalState: GameState = {
      ...before,
      customers: {},
      seatReservations: {},
      strategicGameplay: {
        ...before.strategicGameplay,
        parties: {},
      },
      servicePeriod: {
        ...before.servicePeriod,
        phase: "debrief",
        arrivalElapsedMs: 100_000,
      },
      periodLedgers: { 1: ledger },
      economy: {
        ...before.economy,
        cashCents: asMoneyCents(11_300),
      },
      metrics: {
        ...before.metrics,
        pathRequests: 10,
        pathFailures: 1,
        qualifyingFlowMs: 51_000,
        visitRatings: [
          rating("guest-1", 10, 5, 42_000),
          rating("guest-2", 99, 100, 58_000),
        ],
      },
    };
    const telemetry = observeScenarioAdvance(
      createScenarioRunTelemetry(
        SCENARIO_ID,
        1,
        "balanced-party-route",
        before,
      ),
      before,
      terminalState,
    );
    const partial = buildScenarioRunReport({
      scenarioId: SCENARIO_ID,
      telemetry,
      state: terminalState,
      outcome: { kind: "in-progress" },
    });
    const report = buildScenarioRunReport({
      scenarioId: SCENARIO_ID,
      telemetry,
      state: terminalState,
      outcome: {
        kind: "terminal-debrief",
        periodSequenceId: 1,
        servedTimeoutIds: [],
        unservedDepartureIds: [],
      },
    });

    expect(partial.completionBoundary).toBe("in-progress");
    expect(report).toMatchObject({
      completionBoundary: "terminal-period-debrief",
      completedVisits: 2,
      completedVisitsByZone: {
        "zone.west-hall": 1,
        "zone.east-hall": 1,
      },
      flowBasisPoints: 8_500,
      reachableVisitBasisPoints: 9_000,
      medianWaitMs: 50_000,
      grossSalesCents: 3_000,
      ingredientCostCents: 1_000,
      paidUpkeepCents: 500,
      refundsCents: 200,
      contributionCents: 1_300,
      minimumCashCents: 10_000,
      recoveryCashCents: 0,
      ledgerReconciliationDeltaCents: 0,
    });
    expect(report.distinctServedPreparations).toEqual([
      {
        preparationId: preparation.id,
        dishId: preparation.dishId,
        mealRole: preparation.mealRole,
      },
    ]);
    expect(evaluateScenarioRun(report).scenarioId).toBe(SCENARIO_ID);
    expect(() =>
      buildScenarioRunReport({
        scenarioId: "scenario.narrow-aisles",
        telemetry,
        state: terminalState,
        outcome: { kind: "in-progress" },
      })
    ).toThrow(/cannot use/);
  });
});
