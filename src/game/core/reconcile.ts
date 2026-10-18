/**
 * World reconciliation: repairs customers, queues and seat reservations after the layout changes.
 *
 * Internal to core; it is not re-exported from the barrel. Build commands, stall opening and
 * undo call these after they edit objects, access points or the map, so live guests whose
 * targets vanished choose again instead of walking to a stale stall, seat or tray return.
 */
import { getSeatLocations } from "./grid";
import { get_navigation_reserved_points, planStallQueueLayouts } from "./queueing";
import { cloneCustomer } from "./state";
import type { Customer, GameState, PlacedObject } from "./types";

function clearNavigation(customer: Customer): Customer {
  return { ...customer, path: [], pathIndex: 0, movementProgress: 0, stuckMs: 0 };
}

/**
 * Reconciles queues and reservations after a target is removed, moved, rotated, or closed.
 *
 * @param state - The state whose customers, queues and reservations are reconciled.
 * @param objects - The placed objects after the change.
 * @param invalidatedObjectId - An object whose targets are dropped even if it still exists.
 * @returns The reconciled customers, queues, seat reservations and metrics.
 */
export function reconcileWorldTargets(
  state: GameState,
  objects: Readonly<Record<string, PlacedObject>>,
  invalidatedObjectId?: string,
): Pick<GameState, "customers" | "queues" | "seatReservations" | "metrics"> {
  const customers: Record<string, Customer> = Object.fromEntries(
    Object.entries(state.customers).map(([id, customer]) => [id, cloneCustomer(customer)]),
  );
  const queues: Record<string, readonly string[]> = {};
  const reservations: Record<string, string> = { ...state.seatReservations };
  let recovered = 0;

  const allStallIds = new Set(
    Object.values(objects)
      .filter((object) => {
        const definition = state.catalog.placeables[object.definitionId];
        return definition?.kind === "stall";
      })
      .map((object) => object.id),
  );
  const validStallIds = new Set(
    [...allStallIds].filter((id) => objects[id]?.open),
  );
  const validSeatKeys = new Set(getSeatLocations(objects, state.catalog).map((seat) => seat.key));
  const validTrayIds = new Set(
    Object.values(objects)
      .filter((object) => state.catalog.placeables[object.definitionId]?.kind === "tray-return")
      .map((object) => object.id),
  );

  for (const key of Object.keys(reservations)) {
    const objectId = key.slice(0, key.lastIndexOf(":"));
    if (!validSeatKeys.has(key) || objectId === invalidatedObjectId) delete reservations[key];
  }

  for (const [id, customer] of Object.entries(customers)) {
    let next = clearNavigation(customer);
    const stallInvalid =
      Boolean(customer.targetStallId) &&
      (!validStallIds.has(customer.targetStallId as string) || customer.targetStallId === invalidatedObjectId);
    const seatObjectId = customer.reservedSeatKey?.slice(0, customer.reservedSeatKey.lastIndexOf(":"));
    const seatInvalid =
      Boolean(customer.reservedSeatKey) &&
      (!validSeatKeys.has(customer.reservedSeatKey as string) || seatObjectId === invalidatedObjectId);
    const trayInvalid =
      Boolean(customer.targetTrayReturnId) &&
      (!validTrayIds.has(customer.targetTrayReturnId as string) || customer.targetTrayReturnId === invalidatedObjectId);

    if (stallInvalid) {
      if (customer.reservedSeatKey) delete reservations[customer.reservedSeatKey];
      next = {
        ...next,
        status: "choosing-stall",
        stateElapsedMs: 0,
        targetStallId: undefined,
        orderedDishId: undefined,
        reservedSeatKey: undefined,
        targetTrayReturnId: undefined,
      };
      recovered += 1;
    } else if (seatInvalid) {
      next = {
        ...next,
        status: customer.hasTray ? "seeking-seat" : "choosing-stall",
        stateElapsedMs: 0,
        reservedSeatKey: undefined,
      };
      recovered += 1;
    } else if (trayInvalid) {
      next = {
        ...next,
        status: customer.hasTray ? "seeking-tray-return" : "walking-to-exit",
        stateElapsedMs: 0,
        targetTrayReturnId: undefined,
      };
      recovered += 1;
    }
    customers[id] = next;
  }

  for (const stallId of allStallIds) {
    const existing = state.queues[stallId] ?? [];
    queues[stallId] = validStallIds.has(stallId) ? existing.filter((customerId) => {
      const customer = customers[customerId];
      return Boolean(customer && customer.targetStallId === stallId && customer.status !== "choosing-stall");
    }) : [];
  }
  for (const [key, customerId] of Object.entries(reservations)) {
    if (!customers[customerId] || customers[customerId]?.reservedSeatKey !== key) delete reservations[key];
  }

  return {
    customers,
    queues,
    seatReservations: reservations,
    metrics: { ...state.metrics, recoveredTargets: state.metrics.recoveredTargets + recovered },
  };
}

/**
 * Replans navigation after a stall's queue geometry changes without treating
 * the still-operational stall as a removed target. Customers that still fit
 * retain their queue order/status, and meals already being prepared remain
 * attached to the stall. If a player deliberately shortens a live custom
 * route, only the overflow guests are released to choose again.
 *
 * @param state - The state whose customers, queues and reservations are reconciled.
 * @param objects - The placed objects after the change.
 * @param invalidatedObjectId - An object whose targets are dropped even if it still exists.
 * @returns The reconciled customers, queues, seat reservations and metrics.
 */
export function reconcileWorldGeometryChange(
  state: GameState,
  objects: Readonly<Record<string, PlacedObject>>,
  invalidatedObjectId?: string,
): Pick<GameState, "customers" | "queues" | "seatReservations" | "metrics"> {
  const reconciled = reconcileWorldTargets(state, objects, invalidatedObjectId);
  // Raw catalog on purpose; see TD-46
  const queueLayouts = planStallQueueLayouts(
    state.map,
    objects,
    state.catalog,
    get_navigation_reserved_points(state),
  );
  const queues = { ...reconciled.queues };
  const customers = { ...reconciled.customers };
  let released = 0;

  for (const [stallId, queue] of Object.entries(queues)) {
    const capacity = queueLayouts[stallId]?.length ?? 0;
    if (queue.length <= capacity) continue;
    queues[stallId] = queue.slice(0, capacity);
    for (const customerId of queue.slice(capacity)) {
      const customer = customers[customerId];
      if (!customer) continue;
      customers[customerId] = {
        ...clearNavigation(customer),
        status: "choosing-stall",
        stateElapsedMs: 0,
        targetStallId: undefined,
        orderedDishId: undefined,
      };
      released += 1;
    }
  }

  if (released === 0) return reconciled;

  return {
    ...reconciled,
    customers,
    queues,
    metrics: {
      ...reconciled.metrics,
      recoveredTargets: reconciled.metrics.recoveredTargets + released,
    },
  };
}
