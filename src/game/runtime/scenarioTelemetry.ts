import { PREPARATION_GAMEPLAY_BY_ID } from "../../content/preparationGameplay";
import {
  SCENARIOS,
  type ScenarioId,
} from "../../content/strategicGameplay";
import {
  ledgerContributionCents,
  ledgerReconciliationDeltaCents,
} from "../core/economy";
import { getSeatLocations } from "../core/grid";
import {
  asMoneyCents,
  asMoneyDeltaCents,
} from "../core/money";
import {
  getExecutableScenario,
  SCENARIO_TERMINAL_BOUNDARY,
  type ScenarioRunReport,
  type ScenarioServedPreparation,
} from "../core/scenarios";
import type {
  GameState,
  PeriodLedger,
  VisitRating,
} from "../core/types";

export const SCENARIO_RUN_TELEMETRY_VERSION = 1 as const;

/**
 * JSON-only scenario measurements that can be embedded in a runtime envelope.
 * Sets are represented as sorted arrays so reloads preserve idempotency.
 */
export interface ScenarioRunTelemetryV1 {
  readonly schemaVersion: typeof SCENARIO_RUN_TELEMETRY_VERSION;
  readonly scenarioId: ScenarioId;
  readonly periodSequenceId: number;
  readonly strategyId: string;
  readonly minimumCashCents: number;
  readonly lastSpawnedCustomers: number;
  readonly lastPathRequests: number;
  readonly lastPathFailures: number;
  readonly lastQualifyingFlowMs: number;
  readonly lastArrivalElapsedMs: number;
  readonly totalArrivals: number;
  readonly pathRequests: number;
  readonly pathFailures: number;
  readonly flowQualifyingMs: number;
  readonly flowObservedMs: number;
  readonly seatZoneByCustomerId: Readonly<Record<string, string>>;
  readonly processedRatingKeys: readonly string[];
  readonly completedVisitIds: readonly string[];
  readonly completedVisitZoneById: Readonly<Record<string, string>>;
  readonly waitSamplesMs: readonly number[];
}

export type ScenarioRunOutcomeInput =
  | {
      readonly kind: "in-progress";
    }
  | {
      readonly kind: "terminal-debrief";
      readonly periodSequenceId: number;
      readonly servedTimeoutIds?: readonly string[];
      readonly unservedDepartureIds?: readonly string[];
    };

export interface BuildScenarioRunReportInput {
  readonly scenarioId: ScenarioId;
  readonly telemetry: ScenarioRunTelemetryV1;
  readonly state: GameState;
  readonly outcome: ScenarioRunOutcomeInput;
  readonly ledger?: PeriodLedger;
}

export interface ScenarioTelemetryExpectation {
  readonly scenarioId: ScenarioId;
  readonly periodSequenceId: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScenarioId(value: unknown): value is ScenarioId {
  return (
    typeof value === "string" &&
    SCENARIOS.some((scenario) => scenario.id === value)
  );
}

function safeInteger(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= minimum &&
    (value as number) <= maximum
  );
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    return undefined;
  }
  return [...new Set(value)].sort();
}

function integerArray(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): readonly number[] | undefined {
  if (
    !Array.isArray(value) ||
    value.some((entry) => !safeInteger(entry, minimum, maximum))
  ) {
    return undefined;
  }
  return [...value] as number[];
}

function stringRecord(
  value: unknown,
  allowedValues?: ReadonlySet<string>,
): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) return undefined;
  const entries: [string, string][] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (
      key.length === 0 ||
      typeof entry !== "string" ||
      entry.length === 0 ||
      (allowedValues && !allowedValues.has(entry))
    ) {
      return undefined;
    }
    entries.push([key, entry]);
  }
  return Object.fromEntries(entries.sort(([left], [right]) =>
    left.localeCompare(right)
  ));
}

/** Safely restores optional telemetry from a persisted runtime envelope. */
export function parseScenarioRunTelemetry(
  value: unknown,
  expected?: ScenarioTelemetryExpectation,
): ScenarioRunTelemetryV1 | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SCENARIO_RUN_TELEMETRY_VERSION ||
    !isScenarioId(value.scenarioId) ||
    !safeInteger(value.periodSequenceId, 1) ||
    typeof value.strategyId !== "string" ||
    value.strategyId.trim().length === 0 ||
    !safeInteger(value.minimumCashCents, Number.MIN_SAFE_INTEGER) ||
    !safeInteger(value.lastSpawnedCustomers, 0) ||
    !safeInteger(value.lastPathRequests, 0) ||
    !safeInteger(value.lastPathFailures, 0) ||
    !safeInteger(value.lastQualifyingFlowMs, 0) ||
    !safeInteger(value.lastArrivalElapsedMs, 0) ||
    !safeInteger(value.totalArrivals, 0) ||
    !safeInteger(value.pathRequests, 0) ||
    !safeInteger(value.pathFailures, 0) ||
    !safeInteger(value.flowQualifyingMs, 0) ||
    !safeInteger(value.flowObservedMs, 0) ||
    (expected !== undefined &&
      (value.scenarioId !== expected.scenarioId ||
        value.periodSequenceId !== expected.periodSequenceId))
  ) {
    return undefined;
  }

  const zoneIds = new Set(
    getExecutableScenario(value.scenarioId).map.seatingZones.map(
      (zone) => zone.id,
    ),
  );
  const seatZoneByCustomerId = stringRecord(
    value.seatZoneByCustomerId,
    zoneIds,
  );
  const completedVisitZoneById = stringRecord(
    value.completedVisitZoneById,
    zoneIds,
  );
  const processedRatingKeys = stringArray(value.processedRatingKeys);
  const completedVisitIds = stringArray(value.completedVisitIds);
  const waitSamplesMs = integerArray(value.waitSamplesMs, 0);
  if (
    !seatZoneByCustomerId ||
    !completedVisitZoneById ||
    !processedRatingKeys ||
    !completedVisitIds ||
    !waitSamplesMs ||
    value.lastPathFailures > value.lastPathRequests ||
    value.pathFailures > value.pathRequests ||
    value.flowQualifyingMs > value.flowObservedMs ||
    waitSamplesMs.length !== completedVisitIds.length ||
    completedVisitIds.some(
      (customerId) =>
        completedVisitZoneById[customerId] !== undefined &&
        seatZoneByCustomerId[customerId] !==
          completedVisitZoneById[customerId],
    )
  ) {
    return undefined;
  }

  return {
    schemaVersion: SCENARIO_RUN_TELEMETRY_VERSION,
    scenarioId: value.scenarioId,
    periodSequenceId: value.periodSequenceId,
    strategyId: value.strategyId.trim(),
    minimumCashCents: value.minimumCashCents,
    lastSpawnedCustomers: value.lastSpawnedCustomers,
    lastPathRequests: value.lastPathRequests,
    lastPathFailures: value.lastPathFailures,
    lastQualifyingFlowMs: value.lastQualifyingFlowMs,
    lastArrivalElapsedMs: value.lastArrivalElapsedMs,
    totalArrivals: value.totalArrivals,
    pathRequests: value.pathRequests,
    pathFailures: value.pathFailures,
    flowQualifyingMs: value.flowQualifyingMs,
    flowObservedMs: value.flowObservedMs,
    seatZoneByCustomerId,
    processedRatingKeys,
    completedVisitIds,
    completedVisitZoneById,
    waitSamplesMs,
  };
}

function zoneForPoint(
  scenarioId: ScenarioId,
  point: { readonly x: number; readonly y: number },
): string | undefined {
  return getExecutableScenario(scenarioId).map.seatingZones.find(
    (zone) =>
      point.x >= zone.minimum.x &&
      point.x <= zone.maximum.x &&
      point.y >= zone.minimum.y &&
      point.y <= zone.maximum.y,
  )?.id;
}

function captureSeatZones(
  telemetry: ScenarioRunTelemetryV1,
  state: GameState,
): Readonly<Record<string, string>> {
  const assignments = { ...telemetry.seatZoneByCustomerId };
  const seats = new Map(
    getSeatLocations(state.objects, state.catalog).map((seat) => [
      seat.key,
      seat,
    ]),
  );
  const assign = (customerId: string, seatKey: string | undefined): void => {
    const seat = seatKey ? seats.get(seatKey) : undefined;
    const zoneId = seat
      ? zoneForPoint(telemetry.scenarioId, seat.point)
      : undefined;
    if (zoneId) assignments[customerId] = zoneId;
  };

  for (const party of Object.values(state.strategicGameplay.parties)) {
    party.memberCustomerIds.forEach((customerId, index) => {
      assign(customerId, party.seatKeys[index]);
    });
  }
  for (const customer of Object.values(state.customers)) {
    if (!customer.partyId) {
      assign(customer.id, customer.reservedSeatKey);
    }
  }
  return Object.fromEntries(
    Object.entries(assignments).sort(([left], [right]) =>
      left.localeCompare(right)
    ),
  );
}

function ratingKey(rating: VisitRating): string {
  return `${rating.arrivalPeriodSequenceId}:${rating.customerId}`;
}

function waitSampleMs(rating: VisitRating): number {
  if (
    !Number.isSafeInteger(rating.waitMs) ||
    (rating.waitMs ?? -1) < 0
  ) {
    throw new RangeError(
      `Scenario visit ${rating.customerId} is missing its exact wait measurement.`,
    );
  }
  return rating.waitMs!;
}

function isCompletedRating(rating: VisitRating): boolean {
  return rating.served && rating.reason !== "served-timeout";
}

/**
 * Observes one immutable core state. Calling it repeatedly with the same state
 * is safe; finalized ratings are keyed and counted once.
 */
export function observeScenarioState(
  telemetry: ScenarioRunTelemetryV1,
  state: GameState,
): ScenarioRunTelemetryV1 {
  if (state.servicePeriod.sequenceId !== telemetry.periodSequenceId) {
    throw new RangeError(
      `Scenario telemetry period ${telemetry.periodSequenceId} cannot observe period ${state.servicePeriod.sequenceId}.`,
    );
  }

  const seatZoneByCustomerId = captureSeatZones(telemetry, state);
  const processed = new Set(telemetry.processedRatingKeys);
  const completed = new Set(telemetry.completedVisitIds);
  const completedVisitZoneById = {
    ...telemetry.completedVisitZoneById,
  };
  const waitSamplesMs = [...telemetry.waitSamplesMs];

  const ratings = state.metrics.visitRatings
    .filter(
      (rating) =>
        rating.arrivalPeriodSequenceId === telemetry.periodSequenceId,
    )
    .sort((left, right) => ratingKey(left).localeCompare(ratingKey(right)));
  for (const rating of ratings) {
    const key = ratingKey(rating);
    if (processed.has(key)) continue;
    processed.add(key);
    if (!isCompletedRating(rating)) continue;
    completed.add(rating.customerId);
    const zoneId = seatZoneByCustomerId[rating.customerId];
    if (zoneId) completedVisitZoneById[rating.customerId] = zoneId;
    waitSamplesMs.push(waitSampleMs(rating));
  }

  const spawnedDelta = Math.max(
    0,
    state.metrics.spawnedCustomers - telemetry.lastSpawnedCustomers,
  );
  const pathRequestDelta = Math.max(
    0,
    state.metrics.pathRequests - telemetry.lastPathRequests,
  );
  const pathFailureDelta = Math.max(
    0,
    state.metrics.pathFailures - telemetry.lastPathFailures,
  );
  const flowObservedDelta = Math.max(
    0,
    state.servicePeriod.arrivalElapsedMs - telemetry.lastArrivalElapsedMs,
  );
  const flowQualifyingDelta = Math.min(
    flowObservedDelta,
    Math.max(
      0,
      state.metrics.qualifyingFlowMs - telemetry.lastQualifyingFlowMs,
    ),
  );

  return {
    ...telemetry,
    minimumCashCents: Math.min(
      telemetry.minimumCashCents,
      state.economy.cashCents,
    ),
    lastSpawnedCustomers: state.metrics.spawnedCustomers,
    lastPathRequests: state.metrics.pathRequests,
    lastPathFailures: state.metrics.pathFailures,
    lastQualifyingFlowMs: state.metrics.qualifyingFlowMs,
    lastArrivalElapsedMs: state.servicePeriod.arrivalElapsedMs,
    totalArrivals: telemetry.totalArrivals + spawnedDelta,
    pathRequests: telemetry.pathRequests + pathRequestDelta,
    pathFailures: Math.min(
      telemetry.pathRequests + pathRequestDelta,
      telemetry.pathFailures + pathFailureDelta,
    ),
    flowQualifyingMs:
      telemetry.flowQualifyingMs + flowQualifyingDelta,
    flowObservedMs: telemetry.flowObservedMs + flowObservedDelta,
    seatZoneByCustomerId,
    processedRatingKeys: [...processed].sort(),
    completedVisitIds: [...completed].sort(),
    completedVisitZoneById: Object.fromEntries(
      Object.entries(completedVisitZoneById).sort(([left], [right]) =>
        left.localeCompare(right)
      ),
    ),
    waitSamplesMs,
  };
}

/**
 * Captures seats before an advance releases them, then observes finalized
 * metrics from the resulting state.
 */
export function observeScenarioAdvance(
  telemetry: ScenarioRunTelemetryV1,
  before: GameState,
  after: GameState,
): ScenarioRunTelemetryV1 {
  return observeScenarioState(
    {
      ...telemetry,
      seatZoneByCustomerId: captureSeatZones(telemetry, before),
      minimumCashCents: Math.min(
        telemetry.minimumCashCents,
        before.economy.cashCents,
      ),
    },
    after,
  );
}

export function createScenarioRunTelemetry(
  scenarioId: ScenarioId,
  periodSequenceId: number,
  strategyId: string,
  state: GameState,
): ScenarioRunTelemetryV1 {
  if (
    !Number.isSafeInteger(periodSequenceId) ||
    periodSequenceId < 1 ||
    state.servicePeriod.sequenceId !== periodSequenceId
  ) {
    throw new RangeError(
      "Scenario telemetry requires the active positive period sequence.",
    );
  }
  if (strategyId.trim().length === 0) {
    throw new RangeError("Scenario strategy ID must not be empty.");
  }

  const telemetry: ScenarioRunTelemetryV1 = {
    schemaVersion: SCENARIO_RUN_TELEMETRY_VERSION,
    scenarioId,
    periodSequenceId,
    strategyId: strategyId.trim(),
    minimumCashCents: state.economy.cashCents,
    lastSpawnedCustomers: 0,
    lastPathRequests: 0,
    lastPathFailures: 0,
    lastQualifyingFlowMs: 0,
    lastArrivalElapsedMs: 0,
    totalArrivals: 0,
    pathRequests: 0,
    pathFailures: 0,
    flowQualifyingMs: 0,
    flowObservedMs: 0,
    seatZoneByCustomerId: {},
    processedRatingKeys: [],
    completedVisitIds: [],
    completedVisitZoneById: {},
    waitSamplesMs: [],
  };
  return observeScenarioState(telemetry, state);
}

/**
 * Reports exact progress toward the documented one-minute qualifying-flow
 * challenge. This preserves the core requirement (80% flow with at least
 * three active period guests) without treating satisfaction as a proxy or
 * penalizing an efficient centre for quiet time before/after its rush.
 */
function qualifiedFlowBasisPoints(qualifyingMs: number): number {
  return Math.min(
    10_000,
    Math.floor((qualifyingMs * 10_000) / 60_000),
  );
}

function median(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return Math.floor((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function distinctPreparations(
  ledger: PeriodLedger,
): readonly ScenarioServedPreparation[] {
  const preparationIds = [
    ...new Set(
      ledger.entries
        .filter((entry) => entry.kind === "gross-sale")
        .map((entry) => entry.preparationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ].sort();
  return preparationIds.map((preparationId) => {
    const preparation = PREPARATION_GAMEPLAY_BY_ID[preparationId];
    if (!preparation) {
      throw new RangeError(
        `Scenario ledger references unknown preparation ${preparationId}.`,
      );
    }
    return {
      preparationId,
      dishId: preparation.dishId,
      mealRole: preparation.mealRole,
    };
  });
}

export function buildScenarioRunReport(
  input: BuildScenarioRunReportInput,
): ScenarioRunReport {
  const { scenarioId, telemetry, state, outcome } = input;
  if (telemetry.scenarioId !== scenarioId) {
    throw new RangeError(
      `Scenario report for ${scenarioId} cannot use ${telemetry.scenarioId} telemetry.`,
    );
  }
  if (state.servicePeriod.sequenceId !== telemetry.periodSequenceId) {
    throw new RangeError("Scenario report state does not match its period.");
  }
  const executable = getExecutableScenario(scenarioId);
  const ledger =
    input.ledger ?? state.periodLedgers[telemetry.periodSequenceId];
  if (!ledger || ledger.periodSequenceId !== telemetry.periodSequenceId) {
    throw new RangeError("Scenario report requires its attributed period ledger.");
  }

  const timeoutIds = new Set(
    outcome.kind === "terminal-debrief"
      ? outcome.servedTimeoutIds ?? []
      : [],
  );
  const completedVisitIds = telemetry.completedVisitIds.filter(
    (customerId) => !timeoutIds.has(customerId),
  );
  const completedVisitsByZone = Object.fromEntries(
    executable.map.seatingZones.map((zone) => [
      zone.id,
      completedVisitIds.filter(
        (customerId) =>
          telemetry.completedVisitZoneById[customerId] === zone.id,
      ).length,
    ]),
  );
  const outcomeCount =
    outcome.kind === "terminal-debrief"
      ? completedVisitIds.length +
        (outcome.servedTimeoutIds?.length ?? 0) +
        (outcome.unservedDepartureIds?.length ?? 0)
      : 0;
  const completionBoundary =
    outcome.kind === "terminal-debrief" &&
    outcome.periodSequenceId === telemetry.periodSequenceId &&
    state.servicePeriod.phase === "debrief"
      ? SCENARIO_TERMINAL_BOUNDARY
      : "in-progress";
  const reachableVisitBasisPoints =
    telemetry.pathRequests === 0
      ? 10_000
      : Math.floor(
          ((telemetry.pathRequests - telemetry.pathFailures) * 10_000) /
            telemetry.pathRequests,
        );

  return {
    scenarioId,
    seed: executable.definition.seed,
    completionBoundary,
    strategyId: telemetry.strategyId,
    totalArrivals: Math.max(
      1,
      telemetry.totalArrivals,
      outcomeCount,
    ),
    completedVisits: completedVisitIds.length,
    completedVisitsByZone,
    flowBasisPoints: qualifiedFlowBasisPoints(
      telemetry.flowQualifyingMs,
    ),
    reachableVisitBasisPoints,
    medianWaitMs: median(telemetry.waitSamplesMs),
    grossSalesCents: asMoneyCents(ledger.grossSalesCents),
    ingredientCostCents: asMoneyCents(ledger.ingredientCostsCents),
    paidUpkeepCents: asMoneyCents(ledger.upkeepCents),
    refundsCents: asMoneyCents(ledger.refundsCents),
    contributionCents: asMoneyDeltaCents(
      ledgerContributionCents(ledger),
    ),
    minimumCashCents: asMoneyDeltaCents(telemetry.minimumCashCents),
    recoveryCashCents: asMoneyCents(ledger.recoveryCents),
    ledgerReconciliationDeltaCents: asMoneyDeltaCents(
      ledgerReconciliationDeltaCents(ledger, state.economy.cashCents),
    ),
    distinctServedPreparations: distinctPreparations(ledger),
  };
}
