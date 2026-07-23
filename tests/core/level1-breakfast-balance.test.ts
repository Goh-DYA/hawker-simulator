import { describe, expect, it } from "vitest";

import {
  DRAIN_TARGET_P95_MS,
  DRAIN_WATCHDOG_MS,
  createPeriodLedger,
  forecastArrivalTarget,
  getSeatLocations,
  ledgerReconciliationDeltaCents,
  startServicePeriod,
  stepSimulation,
  validateWorldNavigationAccess,
  type GameState,
  type SimulationCatalog,
} from "@/src/game/core";
import { buildCatalog, freshState } from "@/src/game/runtime/createHawkerRuntime";
import { defaultStallMenusForProgression } from "@/src/game/runtime/stallMenus";

function withMenus(
  catalog: SimulationCatalog,
  menus: Readonly<Record<string, readonly string[]>>,
): SimulationCatalog {
  return {
    ...catalog,
    placeables: Object.fromEntries(Object.entries(catalog.placeables).map(([id, definition]) => [
      id,
      definition.stall
        ? { ...definition, stall: { ...definition.stall, dishIds: menus[id] ?? [] } }
        : definition,
    ])),
  };
}

function initialBreakfast(seed: string): GameState {
  const { catalog: authoredCatalog } = buildCatalog();
  const menus = defaultStallMenusForProgression({ level: 1, reputation: 8 });
  const catalog = withMenus(authoredCatalog, menus);
  const initial = freshState(authoredCatalog, seed);
  const servicePeriod = startServicePeriod(initial.servicePeriod);
  return {
    ...initial,
    catalog,
    objects: Object.fromEntries(Object.entries(initial.objects).map(([id, object]) => [id, {
      ...object,
      open: catalog.placeables[object.definitionId]?.kind === "stall" ? true : object.open,
    }])),
    servicePeriod,
    periodLedgers: {
      [servicePeriod.sequenceId]: createPeriodLedger(
        servicePeriod.sequenceId,
        initial.economy.cashCents,
      ),
    },
  };
}

function runBreakfast(seed: string) {
  let state = initialBreakfast(seed);
  const target = forecastArrivalTarget(state.forecast, state.arrivalSamplingSeed);
  const activeDishPrices = Object.values(state.objects).flatMap((object) => {
    const definition = state.catalog.placeables[object.definitionId];
    return object.open && definition?.kind === "stall"
      ? (definition.stall?.dishIds ?? []).map((dishId) => state.catalog.dishes[dishId]!.priceCents)
      : [];
  });
  let guard = 0;
  let peakActiveCustomers = 0;
  let peakQueueDepth = 0;
  let peakReservedSeats = 0;
  while (state.servicePeriod.phase !== "debrief" && guard < 4_500) {
    peakActiveCustomers = Math.max(peakActiveCustomers, Object.keys(state.customers).length);
    peakQueueDepth = Math.max(
      peakQueueDepth,
      ...Object.values(state.queues).map((queue) => queue.length),
    );
    peakReservedSeats = Math.max(peakReservedSeats, Object.keys(state.seatReservations).length);
    state = stepSimulation(state);
    guard += 1;
  }
  const ledger = state.periodLedgers[state.servicePeriod.sequenceId]!;
  return {
    target,
    arrivals: state.forecastArrivals.length,
    completed: state.economy.completedVisits,
    abandoned: state.economy.abandonedVisits,
    drainMs: state.servicePeriod.drainElapsedMs,
    reconciliationDeltaCents: ledgerReconciliationDeltaCents(ledger, state.economy.cashCents),
    budgets: state.forecastArrivals.map((arrival) => arrival.budgetCents),
    activeDishPrices,
    peakActiveCustomers,
    peakQueueDepth,
    peakReservedSeats,
    phase: state.servicePeriod.phase,
  };
}

function percentile(values: readonly number[], proportion: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * proportion) - 1]!;
}

describe("level-one Breakfast production balance", () => {
  it("starts with nine reachable seats around the authored table clusters", () => {
    const state = initialBreakfast("starter-seat-layout");
    expect(getSeatLocations(state.objects, state.catalog)).toHaveLength(9);
    expect(validateWorldNavigationAccess(
      state.map,
      state.accessPoints,
      state.objects,
      state.catalog,
    )).toBeUndefined();
  });

  it("keeps the narrowed starter menu affordable and drains below the p95 target", () => {
    const initial = initialBreakfast("production-profile-contract");
    expect(initial.forecast.demandRange).toEqual([48, 60]);
    expect(initial.forecast.budgetBands).toEqual([
      { id: "value", basisPoints: 5_000, minimumCents: 700, maximumCents: 900 },
      { id: "everyday", basisPoints: 4_000, minimumCents: 901, maximumCents: 1_400 },
      { id: "flexible", basisPoints: 1_000, minimumCents: 1_401, maximumCents: 2_400 },
    ]);
    const results = Array.from({ length: 30 }, (_, index) => (
      runBreakfast(`level-one-breakfast-${String(index + 1).padStart(2, "0")}`)
    ));
    const observed = {
      arrivalsMedian: percentile(results.map((result) => result.arrivals), 0.5),
      completedMedian: percentile(results.map((result) => result.completed), 0.5),
      abandonedMedian: percentile(results.map((result) => result.abandoned), 0.5),
      drainP50: percentile(results.map((result) => result.drainMs), 0.5),
      drainP95: percentile(results.map((result) => result.drainMs), 0.95),
      drainMax: Math.max(...results.map((result) => result.drainMs)),
      peakActiveMedian: percentile(results.map((result) => result.peakActiveCustomers), 0.5),
      peakQueueMedian: percentile(results.map((result) => result.peakQueueDepth), 0.5),
      peakSeatsMedian: percentile(results.map((result) => result.peakReservedSeats), 0.5),
    };
    expect(results.every((result) => result.phase === "debrief")).toBe(true);
    expect(results.every((result) => result.arrivals === result.target)).toBe(true);
    expect(results.every((result) => result.arrivals >= 48 && result.arrivals <= 60)).toBe(true);
    expect(results.every((result) => result.budgets.every((budget) => (
      result.activeDishPrices.some((price) => price <= budget)
    )))).toBe(true);
    expect(results.every((result) => (
      [...result.activeDishPrices].sort((left, right) => left - right).join(",") === "700,800"
    ))).toBe(true);
    expect(results.every((result) => result.completed + result.abandoned === result.arrivals)).toBe(true);
    expect(results.every((result) => result.reconciliationDeltaCents === 0)).toBe(true);
    expect(observed.completedMedian).toBeGreaterThanOrEqual(48);
    expect(observed.abandonedMedian).toBeLessThanOrEqual(3);
    expect(observed.peakActiveMedian).toBeGreaterThanOrEqual(15);
    expect(observed.peakQueueMedian).toBeGreaterThanOrEqual(1);
    expect(observed.peakSeatsMedian).toBeGreaterThanOrEqual(7);
    expect(observed.drainP95).toBeLessThan(DRAIN_TARGET_P95_MS);
    expect(observed.drainMax).toBeLessThan(DRAIN_WATCHDOG_MS);
  }, 180_000);
});
