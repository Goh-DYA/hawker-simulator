import type {
  ServicePeriodId,
  ServicePeriodPhase,
  ServicePeriodState,
} from "./types";

export const ARRIVAL_PERIOD_MS = 240_000;
export const DRAIN_WATCHDOG_MS = 180_000;
export const DRAIN_TARGET_P95_MS = 120_000;
export const OVERTIME_UPKEEP_THRESHOLD_MS = 60_000;
export const UPKEEP_INTERVAL_MS = 60_000;

export interface ServicePeriodDefinition {
  readonly id: ServicePeriodId;
  readonly label: string;
  readonly startMinute: number;
  readonly endMinute: number;
}

export const SERVICE_PERIODS: readonly ServicePeriodDefinition[] = [
  { id: "breakfast", label: "Breakfast", startMinute: 6 * 60, endMinute: 10 * 60 },
  { id: "lunch", label: "Lunch", startMinute: 10 * 60, endMinute: 14 * 60 },
  { id: "tea", label: "Tea", startMinute: 14 * 60, endMinute: 18 * 60 },
  { id: "evening", label: "Evening", startMinute: 18 * 60, endMinute: 22 * 60 },
] as const;

export function createInitialServicePeriod(): ServicePeriodState {
  return {
    day: 1,
    periodIndex: 0,
    periodId: "breakfast",
    sequenceId: 1,
    phase: "planning",
    arrivalElapsedMs: 0,
    drainElapsedMs: 0,
    displayedMinute: SERVICE_PERIODS[0]!.startMinute,
    cohortCustomerIds: [],
    overtimeUpkeepCharged: false,
    stallOpenElapsedMs: {},
  };
}

export function startServicePeriod(state: ServicePeriodState): ServicePeriodState {
  if (state.phase !== "planning") throw new RangeError("Only a planned period can start arrivals");
  return { ...state, phase: "arrivals" };
}

/** Begins drain after the complete authored arrivals window, preserving its cohort. */
export function beginServiceDrain(
  source: ServicePeriodState,
  activeCohortCustomerIds: readonly string[],
): ServicePeriodState {
  if (source.phase !== "arrivals") throw new RangeError("Only an active arrivals period can begin drain");
  if (source.arrivalElapsedMs !== ARRIVAL_PERIOD_MS) {
    throw new RangeError("Arrivals must run for exactly 240,000 milliseconds before drain");
  }
  const definition = SERVICE_PERIODS[source.periodIndex]!;
  return {
    ...source,
    phase: activeCohortCustomerIds.length === 0 ? "debrief" : "draining",
    displayedMinute: definition.endMinute,
    cohortCustomerIds: [...activeCohortCustomerIds],
  };
}

export interface DrainWatchdogVisit {
  readonly id: string;
  readonly served: boolean;
}

export interface DrainWatchdogFinalization {
  /** Served visits receive the explicit three-XP timeout settlement. */
  readonly servedTimeoutIds: readonly string[];
  /** Unserved visits leave with no sale and no XP. */
  readonly unservedDepartureIds: readonly string[];
}

export function finalizeDrainWatchdog(
  visits: readonly DrainWatchdogVisit[],
): DrainWatchdogFinalization {
  return {
    servedTimeoutIds: visits.filter((visit) => visit.served).map((visit) => visit.id),
    unservedDepartureIds: visits.filter((visit) => !visit.served).map((visit) => visit.id),
  };
}

function displayedMinute(definition: ServicePeriodDefinition, arrivalElapsedMs: number): number {
  const durationMinutes = definition.endMinute - definition.startMinute;
  const ratio = Math.min(1, Math.max(0, arrivalElapsedMs) / ARRIVAL_PERIOD_MS);
  return Math.min(definition.endMinute, definition.startMinute + Math.floor(durationMinutes * ratio));
}

export interface ServicePeriodAdvance {
  readonly state: ServicePeriodState;
  readonly closedArrivals: boolean;
  readonly drainCompleted: boolean;
  readonly watchdogExpired: boolean;
}

/**
 * Advances only the authored service clock. Customer processing remains in the
 * simulation, which supplies the ids still active in this period's cohort.
 */
export function advanceServicePeriod(
  source: ServicePeriodState,
  deltaMs: number,
  activeCohortCustomerIds: readonly string[],
): ServicePeriodAdvance {
  if (!Number.isSafeInteger(deltaMs) || deltaMs < 0) {
    throw new RangeError("Service clock delta must be a non-negative integer number of milliseconds");
  }
  if (source.phase === "planning" || source.phase === "debrief" || deltaMs === 0) {
    return { state: source, closedArrivals: false, drainCompleted: false, watchdogExpired: false };
  }
  const definition = SERVICE_PERIODS[source.periodIndex]!;
  if (source.phase === "arrivals") {
    const arrivalElapsedMs = Math.min(ARRIVAL_PERIOD_MS, source.arrivalElapsedMs + deltaMs);
    if (arrivalElapsedMs < ARRIVAL_PERIOD_MS) {
      return {
        state: {
          ...source,
          arrivalElapsedMs,
          displayedMinute: displayedMinute(definition, arrivalElapsedMs),
          cohortCustomerIds: [...activeCohortCustomerIds],
        },
        closedArrivals: false,
        drainCompleted: false,
        watchdogExpired: false,
      };
    }
    const spillMs = source.arrivalElapsedMs + deltaMs - ARRIVAL_PERIOD_MS;
    const drainElapsedMs = Math.min(DRAIN_WATCHDOG_MS, Math.max(0, spillMs));
    const drainCompleted = activeCohortCustomerIds.length === 0;
    const watchdogExpired = !drainCompleted && drainElapsedMs >= DRAIN_WATCHDOG_MS;
    return {
      state: {
        ...source,
        phase: drainCompleted || watchdogExpired ? "debrief" : "draining",
        arrivalElapsedMs: ARRIVAL_PERIOD_MS,
        drainElapsedMs,
        displayedMinute: definition.endMinute,
        cohortCustomerIds: [...activeCohortCustomerIds],
      },
      closedArrivals: true,
      drainCompleted,
      watchdogExpired,
    };
  }
  const drainElapsedMs = Math.min(DRAIN_WATCHDOG_MS, source.drainElapsedMs + deltaMs);
  const drainCompleted = activeCohortCustomerIds.length === 0;
  const watchdogExpired = !drainCompleted && drainElapsedMs >= DRAIN_WATCHDOG_MS;
  return {
    state: {
      ...source,
      phase: drainCompleted || watchdogExpired ? "debrief" : "draining",
      drainElapsedMs,
      displayedMinute: definition.endMinute,
      cohortCustomerIds: [...activeCohortCustomerIds],
    },
    closedArrivals: false,
    drainCompleted,
    watchdogExpired,
  };
}

export function planNextServicePeriod(source: ServicePeriodState): ServicePeriodState {
  if (source.phase !== "debrief") throw new RangeError("Finish the current debrief before planning the next period");
  const nextIndex = ((source.periodIndex + 1) % SERVICE_PERIODS.length) as 0 | 1 | 2 | 3;
  const day = source.day + (nextIndex === 0 ? 1 : 0);
  const definition = SERVICE_PERIODS[nextIndex]!;
  return {
    day,
    periodIndex: nextIndex,
    periodId: definition.id,
    sequenceId: source.sequenceId + 1,
    phase: "planning",
    arrivalElapsedMs: 0,
    drainElapsedMs: 0,
    displayedMinute: definition.startMinute,
    cohortCustomerIds: [],
    overtimeUpkeepCharged: false,
    stallOpenElapsedMs: {},
  };
}

export function isConfigurationLocked(phase: ServicePeriodPhase): boolean {
  return phase === "arrivals" || phase === "draining";
}

export function arrivalsEnabled(state: Pick<ServicePeriodState, "phase">): boolean {
  return state.phase === "arrivals";
}

export function arrivalUpkeepChargesDue(previousElapsedMs: number, nextElapsedMs: number): number {
  if (
    !Number.isSafeInteger(previousElapsedMs) ||
    !Number.isSafeInteger(nextElapsedMs) ||
    previousElapsedMs < 0 ||
    nextElapsedMs < previousElapsedMs
  ) {
    throw new RangeError("Arrival upkeep timestamps must be ordered non-negative integer milliseconds");
  }
  return Math.max(
    0,
    Math.floor(Math.min(nextElapsedMs, ARRIVAL_PERIOD_MS) / UPKEEP_INTERVAL_MS) -
      Math.floor(Math.min(previousElapsedMs, ARRIVAL_PERIOD_MS) / UPKEEP_INTERVAL_MS),
  );
}

export function overtimeUpkeepChargeDue(
  previousDrainElapsedMs: number,
  nextDrainElapsedMs: number,
  alreadyCharged: boolean,
): boolean {
  return !alreadyCharged &&
    previousDrainElapsedMs < OVERTIME_UPKEEP_THRESHOLD_MS &&
    nextDrainElapsedMs >= OVERTIME_UPKEEP_THRESHOLD_MS;
}
