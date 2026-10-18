/**
 * Build command handlers: placing, moving, rotating and removing objects, expanding the map,
 * configuring stall queues, the preferred guest route and access points.
 *
 * Internal to core; it is not re-exported from the barrel. `dispatchCommand` captures the undo
 * snapshot before calling a handler, and each handler validates the whole command before it
 * changes anything. The order of the checks inside a handler decides which rejection message a
 * player sees, so it must not change.
 */
import { applyPurchase, applyRefund, calculateExpansionCost, calculateRefund, canAfford } from "./economy";
import {
  expandGridMap,
  getBlockedTileKeys,
  getTile,
  isInBounds,
  is_boundary_point,
  normalizeBoundaryOpenings,
  normalizeRotation,
  pointKey,
  projectExpandedBoundaryPoint,
  validatePlacement,
  withTile,
} from "./grid";
import { validateWorldNavigationAccess } from "./navigation";
import {
  get_navigation_reserved_points,
  getStallQueueCells,
  planStallQueueLayouts,
  validateConfiguredQueuePath,
} from "./queueing";
import { reconcileWorldGeometryChange } from "./reconcile";
import { accept, commandEvent, reject } from "./results";
import { clone_access_points, clonePlacedObject } from "./state";
import { withUndo } from "./undo";
import { isValidSimulationId } from "./validation";
import type {
  AccessPoint,
  AddAccessPointCommand,
  CommandResult,
  ConfigureGuestRouteCommand,
  ConfigureQueueCommand,
  ExpandMapCommand,
  GameState,
  GridMap,
  MoveAccessPointCommand,
  MoveObjectCommand,
  PlaceableDefinition,
  PlacedObject,
  PlaceObjectCommand,
  RemoveAccessPointCommand,
  RemoveObjectCommand,
  RotateObjectCommand,
  Rotation,
  SetStallQueueDirectionCommand,
  UndoSnapshot,
} from "./types";

function nextAllowedRotation(current: Rotation, allowed: readonly Rotation[], clockwise = true): Rotation {
  const ordered = [...new Set(allowed)].sort((a, b) => a - b);
  const index = ordered.indexOf(current);
  if (index < 0 || ordered.length === 0) throw new RangeError("Current rotation is not allowed by its definition");
  return ordered[(index + (clockwise ? 1 : ordered.length - 1)) % ordered.length] as Rotation;
}

/**
 * Checks that a candidate set of objects keeps the current map and access points navigable.
 *
 * @param state - The state whose map and access points are checked.
 * @param objects - The candidate placed objects.
 * @returns The first navigation problem, or `undefined` when the layout is navigable.
 */
export function navigationError(state: GameState, objects: Readonly<Record<string, PlacedObject>>): string | undefined {
  return validateWorldNavigationAccess(state.map, state.accessPoints, objects, state.catalog);
}

function withAccessAliases(state: GameState, map: GridMap, accessPoints: readonly AccessPoint[]): GameState {
  const entrance = accessPoints.find((point) => point.kind === "entrance")?.position;
  const exit = accessPoints.find((point) => point.kind === "exit")?.position;
  if (!entrance || !exit) throw new RangeError("At least one entrance and one exit are required");
  return { ...state, map, accessPoints, entrance: { ...entrance }, exit: { ...exit } };
}

/** A placed object a command targets, with its catalog definition, or the rejection to return. */
type TargetLookup =
  | { readonly existing: PlacedObject; readonly definition: PlaceableDefinition }
  | { readonly rejection: CommandResult };

/**
 * Looks up the placed object a command targets and its definition.
 *
 * @param state - The current state.
 * @param object_id - The ID of the targeted object.
 * @returns The object and its definition, or the rejection for a missing object or definition.
 */
function lookup_target_object(state: GameState, object_id: string): TargetLookup {
  const existing = state.objects[object_id];
  if (!existing) return { rejection: reject(state, `Object does not exist: ${object_id}`) };
  const definition = state.catalog.placeables[existing.definitionId];
  if (!definition) return { rejection: reject(state, `Definition no longer exists: ${existing.definitionId}`) };
  return { existing, definition };
}

/**
 * Validates and commits an access-point change shared by the add, move and remove commands.
 *
 * Guests lose their chosen exit, since the set of exits may have changed.
 *
 * @param state - The state before the command.
 * @param command - The access-point command being applied.
 * @param before - The undo snapshot captured before the command.
 * @param map - The map with the boundary tiles already opened or closed.
 * @param accessPoints - The access points after the change.
 * @returns The accepted result, or a rejection when the layout is no longer navigable.
 */
function commit_access_point_change(
  state: GameState,
  command: AddAccessPointCommand | MoveAccessPointCommand | RemoveAccessPointCommand,
  before: UndoSnapshot,
  map: GridMap,
  accessPoints: readonly AccessPoint[],
): CommandResult {
  const routeError = validateWorldNavigationAccess(map, accessPoints, state.objects, state.catalog);
  if (routeError) return reject(state, routeError);
  const world = withAccessAliases(state, map, accessPoints);
  const reconciled = reconcileWorldGeometryChange(world, state.objects);
  const customers = Object.fromEntries(Object.entries(reconciled.customers).map(([id, customer]) => [id, { ...customer, targetExitId: undefined }]));
  const next = withUndo({ ...world, ...reconciled, customers }, command, before);
  return accept(next, [commandEvent(state, true, command.type)]);
}

/**
 * Handles `add-access-point`: opens a new entrance or exit on the map boundary.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_add_access_point(
  state: GameState,
  command: AddAccessPointCommand,
  before: UndoSnapshot,
): CommandResult {
  let accessPoints = clone_access_points(state.accessPoints);
  let map = state.map;
  const point = command.accessPoint;
  if (!isValidSimulationId(point.id)) return reject(state, "Access point id must be a non-empty safe ID");
  if (point.kind !== "entrance" && point.kind !== "exit") return reject(state, "Unknown access point kind");
  if (accessPoints.some((candidate) => candidate.id === point.id)) return reject(state, "Access point id already exists");
  if (!is_boundary_point(map, point.position)) return reject(state, "Access points must be on the map boundary");
  if (accessPoints.some((candidate) => candidate.position.x === point.position.x && candidate.position.y === point.position.y)) {
    return reject(state, "Access points cannot overlap");
  }
  if (getBlockedTileKeys(state.objects, state.catalog).has(`${point.position.x},${point.position.y}`)) {
    return reject(state, "An object occupies that boundary tile");
  }
  map = withTile(map, point.position, "floor");
  accessPoints = [...accessPoints, { ...point, position: { ...point.position } }];
  return commit_access_point_change(state, command, before, map, accessPoints);
}

/**
 * Handles `move-access-point`: moves an entrance or exit to another boundary tile.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_move_access_point(
  state: GameState,
  command: MoveAccessPointCommand,
  before: UndoSnapshot,
): CommandResult {
  const accessPoints = clone_access_points(state.accessPoints);
  let map = state.map;
  const index = accessPoints.findIndex((point) => point.id === command.accessPointId);
  if (index < 0) return reject(state, "Access point does not exist");
  const current = accessPoints[index]!;
  if (!is_boundary_point(map, command.position)) return reject(state, "Access points must be on the map boundary");
  if (accessPoints.some((candidate, candidateIndex) => candidateIndex !== index && candidate.position.x === command.position.x && candidate.position.y === command.position.y)) {
    return reject(state, "Access points cannot overlap");
  }
  if (getBlockedTileKeys(state.objects, state.catalog).has(`${command.position.x},${command.position.y}`)) {
    return reject(state, "An object occupies that boundary tile");
  }
  map = withTile(withTile(map, current.position, "wall"), command.position, "floor");
  accessPoints[index] = { ...current, position: { ...command.position } };
  return commit_access_point_change(state, command, before, map, accessPoints);
}

/**
 * Handles `remove-access-point`: closes an entrance or exit, keeping at least one of each kind.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_remove_access_point(
  state: GameState,
  command: RemoveAccessPointCommand,
  before: UndoSnapshot,
): CommandResult {
  const accessPoints = clone_access_points(state.accessPoints);
  let map = state.map;
  const index = accessPoints.findIndex((point) => point.id === command.accessPointId);
  if (index < 0) return reject(state, "Access point does not exist");
  const current = accessPoints[index]!;
  if (accessPoints.filter((point) => point.kind === current.kind).length <= 1) {
    return reject(state, `At least one ${current.kind} must remain`);
  }
  accessPoints.splice(index, 1);
  map = withTile(map, current.position, "wall");
  return commit_access_point_change(state, command, before, map, accessPoints);
}

/**
 * Handles `configure-guest-route`: replaces the preferred guest route tiles.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_configure_guest_route(
  state: GameState,
  command: ConfigureGuestRouteCommand,
  before: UndoSnapshot,
): CommandResult {
  if (!Array.isArray(command.points)) return reject(state, "Preferred route points must be an array");
  const pointsByKey = new Map<string, { x: number; y: number }>();
  const blocked = getBlockedTileKeys(state.objects, state.catalog);
  const existingGuideKeys = new Set(state.routeGuidePoints.map(pointKey));
  const queueCells = new Set(
    // Raw catalog on purpose; see TD-46
    Object.values(planStallQueueLayouts(
      state.map,
      state.objects,
      state.catalog,
      get_navigation_reserved_points(state),
    )).flat().map(pointKey),
  );
  for (const point of command.points) {
    if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
      return reject(state, "Preferred route points must use integer coordinates");
    }
    if (!isInBounds(state.map, point) || getTile(state.map, point) !== "floor") {
      return reject(state, `Preferred route tile ${pointKey(point)} must be a floor tile inside the map`);
    }
    if (is_boundary_point(state.map, point)) {
      return reject(state, `Preferred route tile ${pointKey(point)} must be inside the hawker centre`);
    }
    if (blocked.has(pointKey(point))) {
      return reject(state, `Preferred route tile ${pointKey(point)} is blocked by an object`);
    }
    if (!existingGuideKeys.has(pointKey(point)) && queueCells.has(pointKey(point))) {
      return reject(state, `Preferred route tile ${pointKey(point)} is occupied by a stall queue`);
    }
    pointsByKey.set(pointKey(point), { ...point });
  }
  const routeGuidePoints = [...pointsByKey.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  if (
    routeGuidePoints.length === state.routeGuidePoints.length &&
    routeGuidePoints.every((point, index) => pointKey(point) === pointKey(state.routeGuidePoints[index]!))
  ) {
    return accept(state, [commandEvent(state, true, "Preferred guest route is unchanged")]);
  }
  const world = { ...state, routeGuidePoints };
  const reconciled = reconcileWorldGeometryChange(world, state.objects);
  const next = withUndo({ ...world, ...reconciled }, command, before);
  const message = routeGuidePoints.length === 0
    ? "Cleared the preferred guest route"
    : `Updated the preferred guest route (${routeGuidePoints.length} tiles)`;
  return accept(next, [commandEvent(state, true, message)]);
}

/**
 * Handles `place-object`: buys and places a new object.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_place_object(
  state: GameState,
  command: PlaceObjectCommand,
  before: UndoSnapshot,
): CommandResult {
  if (!isValidSimulationId(command.objectId)) return reject(state, "Object id must be a non-empty safe ID");
  if (state.objects[command.objectId]) return reject(state, `Object id already exists: ${command.objectId}`);
  const definition = state.catalog.placeables[command.definitionId];
  if (!definition) return reject(state, `Unknown placeable: ${command.definitionId}`);
  if (!state.progression.unlockedDefinitionIds.includes(definition.id)) return reject(state, "Placeable is locked");
  if (!canAfford(state.economy, definition.price)) return reject(state, "Insufficient currency");
  let rotation: Rotation;
  try {
    rotation = normalizeRotation(command.rotation ?? 0);
  } catch (error) {
    return reject(state, error instanceof Error ? error.message : "Invalid rotation");
  }
  const object: PlacedObject = {
    id: command.objectId,
    definitionId: command.definitionId,
    origin: { ...command.origin },
    rotation,
    open: definition.kind === "stall",
  };
  const validation = validatePlacement(state.map, state.objects, state.catalog, object, {
    reservedPoints: get_navigation_reserved_points(state),
  });
  if (!validation.valid) return reject(state, validation.reasons.join("; "));
  const objects = { ...state.objects, [object.id]: object };
  const routeError = navigationError(state, objects);
  if (routeError) return reject(state, routeError);
  const queues = definition.kind === "stall" ? { ...state.queues, [object.id]: [] } : state.queues;
  const reconciled = reconcileWorldGeometryChange({ ...state, queues }, objects);
  const next = withUndo(
    {
      ...state,
      objects,
      ...reconciled,
      economy: applyPurchase(state.economy, definition.price),
    },
    command,
    before,
  );
  return accept(next, [
    commandEvent(state, true),
    { type: "object-placed", tick: state.tick, entityId: object.id },
  ]);
}

/**
 * Handles `expand-map`: buys extra columns and rows and carries the access points outward.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_expand_map(
  state: GameState,
  command: ExpandMapCommand,
  before: UndoSnapshot,
): CommandResult {
  let map;
  try {
    map = expandGridMap(state.map, command.addColumns, command.addRows);
  } catch (error) {
    return reject(state, error instanceof Error ? error.message : "Invalid expansion");
  }
  const accessPoints = state.accessPoints.map((point) => ({
    ...point,
    position: projectExpandedBoundaryPoint(point.position, state.map, command.addColumns, command.addRows),
  }));
  map = normalizeBoundaryOpenings(map, accessPoints.map((point) => point.position));
  const routeError = validateWorldNavigationAccess(map, accessPoints, state.objects, state.catalog);
  if (routeError) return reject(state, routeError);
  const cost = calculateExpansionCost(state.map, state.progression, state.config, command.addColumns, command.addRows);
  if (!canAfford(state.economy, cost)) return reject(state, "Insufficient currency");
  const expandedState: GameState = withAccessAliases({
    ...state,
    economy: applyPurchase(state.economy, cost),
    progression: { ...state.progression, expansionCount: state.progression.expansionCount + 1 },
  }, map, accessPoints);
  const reconciled = reconcileWorldGeometryChange(expandedState, state.objects);
  const next = withUndo(
    { ...expandedState, ...reconciled },
    command,
    before,
  );
  return accept(next, [commandEvent(state, true)]);
}

/**
 * Handles `configure-queue`: sets a stall's custom queue path.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_configure_queue(
  state: GameState,
  command: ConfigureQueueCommand,
  before: UndoSnapshot,
): CommandResult {
  const target = lookup_target_object(state, command.objectId);
  if ("rejection" in target) return target.rejection;
  const { existing, definition } = target;
  if (definition.kind !== "stall" || !definition.stall) return reject(state, "Only stalls can have queue paths");
  const updated: PlacedObject = {
    ...clonePlacedObject(existing),
    queuePath: command.points.map((point) => ({ ...point })),
  };
  // Raw catalog on purpose; see TD-46
  const validation = validateConfiguredQueuePath(
    state.map,
    state.objects,
    state.catalog,
    updated,
    updated.queuePath,
    get_navigation_reserved_points(state),
  );
  if (!validation.valid) return reject(state, validation.reasons.join("; "));
  const objects = { ...state.objects, [existing.id]: updated };
  // Raw catalog on purpose; see TD-46
  const queueCells = getStallQueueCells(
    state.map,
    objects,
    state.catalog,
    updated,
    get_navigation_reserved_points(state),
  );
  if (queueCells.length === 0) return reject(state, "The configured queue conflicts with another stall or portal");
  const reconciled = reconcileWorldGeometryChange(state, objects);
  const next = withUndo({ ...state, objects, ...reconciled }, command, before);
  return accept(next, [commandEvent(state, true, `Configured ${updated.queuePath?.length ?? 0} queue cells`)]);
}

/**
 * Handles `set-stall-queue-direction`: points a stall's automatic queue in a direction.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_set_queue_direction(
  state: GameState,
  command: SetStallQueueDirectionCommand,
  before: UndoSnapshot,
): CommandResult {
  const target = lookup_target_object(state, command.objectId);
  if ("rejection" in target) return target.rejection;
  const { existing, definition } = target;
  if (definition.kind !== "stall" || !definition.stall) return reject(state, "Only stalls can have queue directions");
  if (!["north", "east", "south", "west"].includes(command.direction)) return reject(state, "Unknown queue direction");
  const updated: PlacedObject = {
    ...clonePlacedObject(existing),
    queueDirection: command.direction,
    queuePath: undefined,
  };
  const objects = { ...state.objects, [existing.id]: updated };
  // Raw catalog on purpose; see TD-46
  const queueCells = getStallQueueCells(
    state.map,
    objects,
    state.catalog,
    updated,
    get_navigation_reserved_points(state),
  );
  if (queueCells.length === 0) return reject(state, "The queue anchor is not traversable in that layout");
  const reconciled = reconcileWorldGeometryChange(state, objects);
  const next = withUndo({ ...state, objects, ...reconciled }, command, before);
  return accept(next, [commandEvent(state, true, `Queue now starts ${command.direction}`)]);
}

/**
 * Handles `remove-object`: removes an object and refunds part of its price.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_remove_object(
  state: GameState,
  command: RemoveObjectCommand,
  before: UndoSnapshot,
): CommandResult {
  const target = lookup_target_object(state, command.objectId);
  if ("rejection" in target) return target.rejection;
  const { existing, definition } = target;
  const objects = { ...state.objects };
  delete objects[existing.id];
  const reconciled = reconcileWorldGeometryChange(state, objects, existing.id);
  const refund = calculateRefund(definition.price, definition.refundRate ?? 0.5);
  const next = withUndo(
    { ...state, objects, ...reconciled, economy: applyRefund(state.economy, refund) },
    command,
    before,
  );
  return accept(next, [
    commandEvent(state, true),
    { type: "object-removed", tick: state.tick, entityId: existing.id, amount: refund },
  ]);
}

/**
 * Handles `move-object` and `rotate-object`: moves or turns a placed object.
 *
 * A move keeps a custom queue path, shifted with the object, unless the rotation changes;
 * a rotation always drops it.
 *
 * @param state - The state before the command.
 * @param command - The command to apply.
 * @param before - The undo snapshot captured before the command.
 * @returns The accepted result, or the first rejection found.
 */
export function handle_transform_object(
  state: GameState,
  command: MoveObjectCommand | RotateObjectCommand,
  before: UndoSnapshot,
): CommandResult {
  const target = lookup_target_object(state, command.objectId);
  if ("rejection" in target) return target.rejection;
  const { existing, definition } = target;
  let rotation = existing.rotation;
  let origin = existing.origin;
  let queuePath = existing.queuePath;
  if (command.type === "move-object") {
    origin = { ...command.origin };
    if (command.rotation !== undefined) {
      try {
        rotation = normalizeRotation(command.rotation);
      } catch (error) {
        return reject(state, error instanceof Error ? error.message : "Invalid rotation");
      }
    }
    if (queuePath && rotation === existing.rotation) {
      const offset = { x: origin.x - existing.origin.x, y: origin.y - existing.origin.y };
      queuePath = queuePath.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
    } else if (rotation !== existing.rotation) {
      queuePath = undefined;
    }
  } else {
    rotation = nextAllowedRotation(existing.rotation, definition.allowedRotations, command.clockwise ?? true);
    queuePath = undefined;
  }
  const updated: PlacedObject = { ...clonePlacedObject(existing), origin, rotation, queuePath };
  if (
    updated.origin.x === existing.origin.x &&
    updated.origin.y === existing.origin.y &&
    updated.rotation === existing.rotation
  ) {
    return accept(state, [commandEvent(state, true, "Object is already in the requested orientation")]);
  }
  const validation = validatePlacement(state.map, state.objects, state.catalog, updated, {
    ignoreObjectId: existing.id,
    reservedPoints: get_navigation_reserved_points(state),
  });
  if (!validation.valid) return reject(state, validation.reasons.join("; "));
  if (updated.queuePath) {
    // Raw catalog on purpose; see TD-46
    const queueValidation = validateConfiguredQueuePath(
      state.map,
      { ...state.objects, [existing.id]: updated },
      state.catalog,
      updated,
      updated.queuePath,
      get_navigation_reserved_points(state),
    );
    if (!queueValidation.valid) return reject(state, queueValidation.reasons.join("; "));
  }
  const objects = { ...state.objects, [existing.id]: updated };
  const routeError = navigationError(state, objects);
  if (routeError) return reject(state, routeError);
  const reconciled = reconcileWorldGeometryChange(state, objects, existing.id);
  const next = withUndo({ ...state, objects, ...reconciled }, command, before);
  return accept(next, [
    commandEvent(state, true),
    { type: "object-moved", tick: state.tick, entityId: existing.id },
  ]);
}
