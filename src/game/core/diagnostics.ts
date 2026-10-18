/**
 * Determinism and soak-test diagnostics: the simulation invariant check and the two
 * state digests that seeded runs compare.
 */
import { getBlockedTileKeys, getSeatLocations, getTile, isInBounds, is_boundary_point, pointKey } from "./grid";
import { get_navigation_reserved_points, planStallQueueLayouts } from "./queueing";
import { compareIds } from "./ordering";
import { createSnapshot } from "./state";
import { get_effective_catalog, VISIT_HISTORY_LIMIT } from "./progression";
import type { GameState } from "./types";

/**
 * Checks the cross-entity invariants of a game state, for determinism and soak tests.
 *
 * Covers route guides, queues, seat reservations, customer positions, economy and metric
 * values, visit ratings, and spawn accounting.
 *
 * @param state - The state to check.
 * @throws Error When any invariant is broken; the message names the first broken one.
 */
export function assertSimulationInvariants(state: GameState): void {
  const customerIds = new Set(Object.keys(state.customers));
  const queued = new Set<string>();
  const invariantCatalog = get_effective_catalog(state);
  const queueCellsByStall = planStallQueueLayouts(
    state.map,
    state.objects,
    invariantCatalog,
    get_navigation_reserved_points(state),
  );
  const blocked = getBlockedTileKeys(state.objects, state.catalog);
  const routeKeys = new Set<string>();
  for (const point of state.routeGuidePoints) {
    if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
      throw new Error("Preferred route points must use integer coordinates");
    }
    if (
      !isInBounds(state.map, point) ||
      is_boundary_point(state.map, point) ||
      getTile(state.map, point) !== "floor" ||
      blocked.has(pointKey(point))
    ) {
      throw new Error(`Preferred route point ${pointKey(point)} is invalid`);
    }
    if (routeKeys.has(pointKey(point))) throw new Error(`Preferred route point ${pointKey(point)} is repeated`);
    routeKeys.add(pointKey(point));
  }
  for (const [stallId, queue] of Object.entries(state.queues)) {
    const stall = state.objects[stallId];
    const definition = stall ? invariantCatalog.placeables[stall.definitionId] : undefined;
    if (!stall || definition?.kind !== "stall" || !definition.stall) {
      throw new Error(`Queue exists for missing or invalid stall ${stallId}`);
    }
    if (queue.length > definition.stall.queueCapacity) throw new Error(`Queue ${stallId} exceeds capacity`);
    const queueCells = queueCellsByStall[stallId] ?? [];
    if (queue.length > queueCells.length) throw new Error(`Queue ${stallId} exceeds its traversable queue route`);
    for (const customerId of queue) {
      const customer = state.customers[customerId];
      if (!customerIds.has(customerId) || !customer) throw new Error(`Queue ${stallId} references missing customer ${customerId}`);
      if (queued.has(customerId)) throw new Error(`Customer ${customerId} is in more than one queue`);
      if (customer.targetStallId !== stallId) throw new Error(`Queued customer ${customerId} targets another stall`);
      if (customer.status !== "walking-to-queue" && customer.status !== "queued" && customer.status !== "ordering") {
        throw new Error(`Customer ${customerId} has invalid queued status ${customer.status}`);
      }
      queued.add(customerId);
    }
  }
  const validSeatKeys = new Set(getSeatLocations(state.objects, state.catalog).map((seat) => seat.key));
  for (const [seatKey, customerId] of Object.entries(state.seatReservations)) {
    if (!validSeatKeys.has(seatKey)) throw new Error(`Reservation references missing seat ${seatKey}`);
    const customer = state.customers[customerId];
    if (!customer) throw new Error(`Seat ${seatKey} is reserved by missing customer ${customerId}`);
    if (customer.reservedSeatKey !== seatKey) throw new Error(`Seat reservation ${seatKey} is not mirrored by its customer`);
  }
  for (const customer of Object.values(state.customers)) {
    if (customer.reservedSeatKey && state.seatReservations[customer.reservedSeatKey] !== customer.id) {
      throw new Error(`Customer ${customer.id} has an orphaned seat reservation`);
    }
    if (!Number.isFinite(customer.position.x) || !Number.isFinite(customer.position.y)) {
      throw new Error(`Customer ${customer.id} has an invalid position`);
    }
    if (!Number.isFinite(customer.walkingDistanceTiles) || customer.walkingDistanceTiles < 0) {
      throw new Error(`Customer ${customer.id} has an invalid walking distance`);
    }
  }
  for (const [name, value] of Object.entries(state.economy)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Economy value ${name} is invalid`);
  }
  for (const [name, value] of Object.entries(state.metrics)) {
    if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) throw new Error(`Metric ${name} is invalid`);
  }
  if (
    state.metrics.visitRatings.length > VISIT_HISTORY_LIMIT ||
    state.metrics.visitRatings.some(
      (rating) =>
        rating.walkingMetricVersion !== 2 ||
        !Number.isFinite(rating.score) ||
        rating.score < 0 ||
        rating.score > 100 ||
        Object.values(rating.components).some(
          (component) => !Number.isFinite(component) || component < 0 || component > 100,
        ),
    )
  ) {
    throw new Error("Visit ratings are invalid");
  }
  if (state.metrics.spawnedCustomers !== state.metrics.despawnedCustomers + customerIds.size) {
    throw new Error("Spawn/despawn/active customer accounting does not balance");
  }
}

/**
 * Serialises the dynamic simulation state (tick, RNG, economy, progression, queues,
 * reservations, customers and metrics) into a string for determinism comparisons.
 *
 * @param state - The state to digest.
 * @returns The digest string; equal states give equal strings.
 */
export function simulationDigest(state: GameState): string {
  const customers = Object.values(state.customers)
    .sort((a, b) => compareIds(a.id, b.id))
    .map((customer) => ({
      id: customer.id,
      status: customer.status,
      at: pointKey(customer.position),
      stall: customer.targetStallId,
      seat: customer.reservedSeatKey,
      spent: customer.spent,
    }));
  return JSON.stringify({
    tick: state.tick,
    rngState: state.rngState,
    economy: state.economy,
    progression: state.progression,
    queues: state.queues,
    reservations: state.seatReservations,
    customers,
    metrics: state.metrics,
  });
}

/**
 * Serialises the snapshot of a game state, including map tiles and object origins, for
 * determinism comparisons.
 *
 * @param state - The state to digest.
 * @returns The digest string; equal states give equal strings.
 */
export function stateDigest(state: GameState): string {
  const snapshot = createSnapshot(state);
  return JSON.stringify({
    ...snapshot,
    map: { ...snapshot.map, tiles: [...snapshot.map.tiles] },
    objectKeys: snapshot.objects.map((object) => pointKey(object.origin)),
  });
}
