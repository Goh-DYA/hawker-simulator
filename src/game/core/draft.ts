/**
 * Step draft primitives shared by the simulation step: the mutable draft, event and
 * status helpers, stall lookup, queue and seat bookkeeping, and customer movement.
 *
 * Internal to core; it is not re-exported from the barrel. Every helper edits the draft
 * in place and keeps its random-number and iteration order, so seeded runs stay identical.
 */
import { getBlockedTileKeys, getObjectQueueAnchor, isTileWalkable, pointKey, samePoint } from "./grid";
import { findPath } from "./pathfinding";
import { get_navigation_reserved_points, planStallQueueLayouts } from "./queueing";
import { compareIds } from "./ordering";
import { clone_metrics, clone_progression, cloneCustomer } from "./state";
import { effectiveStallDefinition, get_effective_catalog } from "./progression";
import { getUtilityInfluence } from "./utility";
import type {
  Customer,
  CustomerArchetype,
  CustomerStatus,
  GameState,
  GridPoint,
  PlaceableDefinition,
  PlacedObject,
  SimulationEvent,
  SimulationMetrics,
  UnclearedTray,
} from "./types";

/** The mutable working copy of a game state that one simulation step edits in place. */
export interface Draft {
  readonly source: GameState;
  objects: Readonly<Record<string, PlacedObject>>;
  customers: Record<string, Customer>;
  queues: Record<string, readonly string[]>;
  readonly queueCellsByStall: Readonly<Record<string, readonly GridPoint[]>>;
  readonly preferredRouteKeys: ReadonlySet<string>;
  seatReservations: Record<string, string>;
  unclearedTrays: Record<string, UnclearedTray>;
  economy: GameState["economy"];
  progression: GameState["progression"];
  rngState: number;
  nextCustomerSequence: number;
  spawnCountdownMs: number;
  metrics: SimulationMetrics;
  events: SimulationEvent[];
  tick: number;
}

/** An open, operational stall with its effective definition and planned queue cells. */
export interface StallRuntime {
  readonly object: PlacedObject;
  readonly definition: PlaceableDefinition;
  readonly queueAnchor: GridPoint;
  readonly queueCells: readonly GridPoint[];
}

/** The outcome of moving a customer one step towards a destination. */
export interface MoveResult {
  readonly customer: Customer;
  readonly arrived: boolean;
  readonly failed: boolean;
}

/**
 * Copies a game state into a draft for one simulation step.
 *
 * @param state - The state the step starts from; it is not mutated.
 * @param tick - The tick number the step produces.
 * @returns A draft whose customers, queues, reservations, economy, progression and metrics are copies.
 */
export function createDraft(state: GameState, tick: number): Draft {
  const effectiveCatalog = get_effective_catalog(state);
  return {
    source: state,
    objects: state.objects,
    customers: Object.fromEntries(
      Object.entries(state.customers).map(([id, customer]) => [id, cloneCustomer(customer)]),
    ),
    queues: Object.fromEntries(Object.entries(state.queues).map(([id, queue]) => [id, [...queue]])),
    queueCellsByStall: planStallQueueLayouts(
      state.map,
      state.objects,
      effectiveCatalog,
      get_navigation_reserved_points(state),
    ),
    preferredRouteKeys: new Set(state.routeGuidePoints.map(pointKey)),
    seatReservations: { ...state.seatReservations },
    unclearedTrays: { ...state.unclearedTrays },
    economy: { ...state.economy },
    progression: clone_progression(state.progression),
    rngState: state.rngState,
    nextCustomerSequence: state.nextCustomerSequence,
    spawnCountdownMs: state.spawnCountdownMs,
    metrics: clone_metrics(state.metrics),
    events: [],
    tick,
  };
}

/**
 * Records a simulation event stamped with the draft's tick.
 *
 * @param draft - The draft that collects the step's events.
 * @param value - The event without its tick.
 */
export function event(draft: Draft, value: Omit<SimulationEvent, "tick">): void {
  draft.events.push({ ...value, tick: draft.tick });
}

/**
 * Moves a customer to a new status and clears its path, movement and stuck timers.
 *
 * Emits a `customer-state-changed` event only when the status actually changes.
 *
 * @param draft - The draft that collects the step's events.
 * @param customer - The customer to transition.
 * @param status - The new status.
 * @returns The customer in the new status.
 */
export function transition(draft: Draft, customer: Customer, status: CustomerStatus): Customer {
  if (customer.status !== status) {
    event(draft, { type: "customer-state-changed", entityId: customer.id, message: `${customer.status} -> ${status}` });
  }
  return {
    ...customer,
    status,
    stateElapsedMs: 0,
    path: [],
    pathIndex: 0,
    movementProgress: 0,
    stuckMs: 0,
  };
}

/**
 * Looks up a customer's archetype in the catalog.
 *
 * @param draft - The draft whose catalog is used.
 * @param customer - The customer whose archetype is needed.
 * @returns The customer's archetype.
 * @throws Error When the catalog has no such archetype.
 */
export function getArchetype(draft: Draft, customer: Customer): CustomerArchetype {
  const archetype = draft.source.catalog.archetypes[customer.archetypeId];
  if (!archetype) throw new Error(`Customer ${customer.id} references missing archetype ${customer.archetypeId}`);
  return archetype;
}

/**
 * Resolves a stall that can currently serve customers.
 *
 * @param draft - The draft whose objects, catalog and queue layouts are used.
 * @param stallId - The ID of the placed stall, if any.
 * @returns The stall runtime, or `undefined` when the stall is missing, closed, not a stall, or has no queue.
 */
export function getStall(draft: Draft, stallId: string | undefined): StallRuntime | undefined {
  if (!stallId) return undefined;
  const object = draft.objects[stallId];
  const definition = object ? draft.source.catalog.placeables[object.definitionId] : undefined;
  const queueAnchor = object ? getObjectQueueAnchor(object, draft.source.catalog) : undefined;
  const queueCells = stallId ? draft.queueCellsByStall[stallId] ?? [] : [];
  if (!object || !object.open || definition?.kind !== "stall" || !definition.stall || !queueAnchor || queueCells.length === 0) {
    return undefined;
  }
  return {
    object,
    definition: {
      ...definition,
      stall: effectiveStallDefinition({ progression: draft.progression }, object.definitionId, definition.stall),
    },
    queueAnchor,
    queueCells,
  };
}

/**
 * Collects the tile keys blocked by the draft's placed objects.
 *
 * @param draft - The draft whose objects are used.
 * @returns The blocked tile keys.
 */
function blockedTiles(draft: Draft): ReadonlySet<string> {
  return getBlockedTileKeys(draft.objects, draft.source.catalog);
}

/**
 * Finds a path for a customer and counts the request, and any failure, in the step metrics.
 *
 * @param draft - The draft whose map, objects and route guides are used.
 * @param start - The starting tile.
 * @param end - The destination tile, which may itself be blocked.
 * @returns The path including both ends, or `null` when the destination is unreachable.
 */
export function requestPath(draft: Draft, start: GridPoint, end: GridPoint): readonly GridPoint[] | null {
  const result = findPath(draft.source.map, start, end, {
    blocked: blockedTiles(draft),
    preferred: draft.preferredRouteKeys,
    allowEndBlocked: true,
  });
  draft.metrics = {
    ...draft.metrics,
    pathRequests: draft.metrics.pathRequests + 1,
    pathFailures: draft.metrics.pathFailures + (result.path ? 0 : 1),
  };
  return result.path;
}

/**
 * Gives a customer a fresh path, positioned at its first step.
 *
 * @param customer - The customer to route.
 * @param path - The path including the customer's current tile.
 * @returns The customer with the copied path and reset movement progress.
 */
export function preparePath(customer: Customer, path: readonly GridPoint[]): Customer {
  return {
    ...customer,
    path: path.map((point) => ({ ...point })),
    pathIndex: path.length > 1 ? 1 : path.length,
    movementProgress: 0,
    stuckMs: 0,
  };
}

/**
 * Decides whether a customer's current path must be recomputed.
 *
 * @param draft - The draft whose map is used.
 * @param customer - The routed customer.
 * @param destination - Where the customer is heading.
 * @param blocked - The currently blocked tile keys.
 * @returns `true` when the path is empty, ends elsewhere, or its next step is no longer walkable.
 */
function pathNeedsRefresh(
  draft: Draft,
  customer: Customer,
  destination: GridPoint,
  blocked: ReadonlySet<string>,
): boolean {
  if (customer.path.length === 0) return true;
  const final = customer.path.at(-1);
  if (!final || !samePoint(final, destination)) return true;
  const next = customer.path[customer.pathIndex];
  if (!next) return !samePoint(customer.position, destination);
  return !isTileWalkable(draft.source.map, next, blocked, destination);
}

/**
 * Advances a customer along its path towards a destination for one step.
 *
 * Recomputes the path when needed and accumulates stuck time when no path exists or the
 * next tile is blocked.
 *
 * @param draft - The draft whose map, objects, catalog and metrics are used.
 * @param customer - The customer to move.
 * @param destination - Where the customer is heading.
 * @param deltaMs - The simulated time of the step, in milliseconds.
 * @returns The moved customer, whether it arrived, and whether it has been stuck too long.
 */
export function moveToward(draft: Draft, customer: Customer, destination: GridPoint, deltaMs: number): MoveResult {
  if (samePoint(customer.position, destination)) return { customer, arrived: true, failed: false };
  const blocked = blockedTiles(draft);
  let next = customer;
  if (pathNeedsRefresh(draft, next, destination, blocked)) {
    const path = requestPath(draft, customer.position, destination);
    if (!path) {
      next = { ...customer, path: [], pathIndex: 0, stuckMs: customer.stuckMs + deltaMs };
      return { customer: next, arrived: false, failed: next.stuckMs >= draft.source.config.stuckRecoveryMs };
    }
    next = preparePath(customer, path);
  }

  const archetype = getArchetype(draft, next);
  const utility = getUtilityInfluence(draft.objects, draft.source.catalog, next.position);
  let progress =
    next.movementProgress +
    archetype.walkingSpeed * (1 + utility.movementSpeed) * (deltaMs / 1_000);
  let position = next.position;
  let pathIndex = next.pathIndex;
  let completedSteps = 0;
  while (progress >= 1 && pathIndex < next.path.length) {
    const step = next.path[pathIndex] as GridPoint;
    if (!isTileWalkable(draft.source.map, step, blocked, destination)) {
      return {
        customer: {
          ...next,
          position,
          path: [],
          pathIndex: 0,
          movementProgress: 0,
          walkingDistanceTiles: next.walkingDistanceTiles + completedSteps,
          stuckMs: next.stuckMs + deltaMs,
        },
        arrived: false,
        failed: next.stuckMs + deltaMs >= draft.source.config.stuckRecoveryMs,
      };
    }
    position = { ...step };
    pathIndex += 1;
    progress -= 1;
    completedSteps += 1;
  }
  const arrived = samePoint(position, destination);
  return {
    customer: {
      ...next,
      position,
      pathIndex,
      movementProgress: arrived ? 0 : progress,
      walkingDistanceTiles: next.walkingDistanceTiles + completedSteps,
      stuckMs: 0,
    },
    arrived,
    failed: false,
  };
}

/**
 * Removes a customer from every stall queue in the draft.
 *
 * @param draft - The draft whose queues are edited.
 * @param customerId - The customer to remove.
 */
export function removeFromAllQueues(draft: Draft, customerId: string): void {
  for (const [stallId, queue] of Object.entries(draft.queues)) {
    if (queue.includes(customerId)) draft.queues[stallId] = queue.filter((id) => id !== customerId);
  }
}

/**
 * Releases a customer's seat reservation, if the customer still holds it.
 *
 * @param draft - The draft whose seat reservations are edited.
 * @param customer - The customer giving up its seat.
 * @returns The customer without a reserved seat.
 */
export function releaseSeat(draft: Draft, customer: Customer): Customer {
  if (!customer.reservedSeatKey) return customer;
  if (draft.seatReservations[customer.reservedSeatKey] === customer.id) {
    delete draft.seatReservations[customer.reservedSeatKey];
  }
  return { ...customer, reservedSeatKey: undefined };
}

/**
 * Counts a recovered customer target and records a `target-recovered` event.
 *
 * @param draft - The draft whose metrics and events are edited.
 * @param customer - The customer whose target was recovered.
 * @param message - Why the target had to be recovered.
 */
export function markRecovery(draft: Draft, customer: Customer, message: string): void {
  draft.metrics = { ...draft.metrics, recoveredTargets: draft.metrics.recoveredTargets + 1 };
  event(draft, { type: "target-recovered", entityId: customer.id, message });
}

/**
 * Picks the exit with the shortest reachable path from a customer, breaking ties by exit ID.
 *
 * @param draft - The draft whose map, objects, route guides and access points are used.
 * @param customer - The leaving customer.
 * @returns The nearest reachable exit, or the first exit when none is reachable.
 */
export function chooseExit(draft: Draft, customer: Customer) {
  const exits = draft.source.accessPoints.filter((point) => point.kind === "exit");
  const blocked = blockedTiles(draft);
  return exits
    .map((exit) => ({
      exit,
      path: findPath(draft.source.map, customer.position, exit.position, {
        blocked,
        preferred: draft.preferredRouteKeys,
      }).path,
    }))
    .filter((candidate): candidate is { exit: (typeof exits)[number]; path: readonly GridPoint[] } => Boolean(candidate.path))
    .sort((a, b) => a.path.length - b.path.length || compareIds(a.exit.id, b.exit.id))[0]?.exit ?? exits[0];
}

/**
 * Lists every stall that can currently serve customers, in ID order.
 *
 * @param draft - The draft whose objects are used.
 * @returns The open stall runtimes.
 */
export function openStalls(draft: Draft): readonly StallRuntime[] {
  return Object.values(draft.objects)
    .sort((a, b) => compareIds(a.id, b.id))
    .map((object) => getStall(draft, object.id))
    .filter((stall): stall is StallRuntime => Boolean(stall));
}

/**
 * Counts the customers ordering or waiting for food at a stall.
 *
 * @param draft - The draft whose customers are used.
 * @param stallId - The stall to count for.
 * @returns The number of orders the stall is preparing.
 */
export function activePreparationCount(draft: Draft, stallId: string): number {
  return Object.values(draft.customers).filter(
    (customer) => customer.targetStallId === stallId && (customer.status === "ordering" || customer.status === "waiting-for-food"),
  ).length;
}

/**
 * Releases a customer's seat and queue place and sends it towards the nearest exit.
 *
 * @param draft - The draft whose seats, queues and events are edited.
 * @param source - The leaving customer.
 * @param abandoned - Whether the customer gave up, which costs one point of satisfaction.
 * @returns The customer walking to its exit.
 */
export function beginExit(draft: Draft, source: Customer, abandoned: boolean): Customer {
  let customer = releaseSeat(draft, source);
  removeFromAllQueues(draft, customer.id);
  const targetExit = chooseExit(draft, customer);
  customer = transition(draft, customer, "walking-to-exit");
  customer = {
    ...customer,
    targetStallId: undefined,
    orderedDishId: customer.orderedDishId,
    reservedSeatKey: undefined,
    targetTrayReturnId: undefined,
    targetExitId: targetExit?.id,
    satisfaction: abandoned ? Math.max(0, customer.satisfaction - 1) : customer.satisfaction,
  };
  return customer;
}
