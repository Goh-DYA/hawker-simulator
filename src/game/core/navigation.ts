/**
 * World-navigation validation: checks that a layout keeps every entrance, exit,
 * queue, service point, tray return and seat reachable over the shared walkable network.
 *
 * Commands and new-game setup call it before accepting a layout; it builds on the A*
 * search in `pathfinding.ts` and the queue-path rules in `queueing.ts`.
 */
import {
  getBlockedTileKeys,
  getObjectQueueAnchor,
  getObjectOccupiedTiles,
  getObjectServicePoint,
  getObjectTrayReturnPoint,
  getSeatLocations,
  isInBounds,
  pointKey,
  samePoint,
} from "./grid";
import type { AccessPoint, GridMap, GridPoint, PlacedObject, SimulationCatalog } from "./types";
import { compareIds } from "./ordering";
import { isReachable } from "./pathfinding";
import { validateConfiguredQueuePath } from "./queueing";

/**
 * Validates all access points and every operational interaction against the shared walkable network.
 *
 * @param map - The grid map the layout sits on.
 * @param accessPoints - The entrances and exits of the layout.
 * @param objects - The placed objects keyed by ID.
 * @param catalog - The catalog that defines each placed object.
 * @returns The first navigation problem found, or `undefined` when the layout is navigable.
 */
export function validateWorldNavigationAccess(
  map: GridMap,
  accessPoints: readonly AccessPoint[],
  objects: Readonly<Record<string, PlacedObject>>,
  catalog: SimulationCatalog,
): string | undefined {
  const entrances = accessPoints.filter((point) => point.kind === "entrance");
  const exits = accessPoints.filter((point) => point.kind === "exit");
  if (entrances.length === 0 || exits.length === 0) return "At least one entrance and one exit are required";
  const blocked = getBlockedTileKeys(objects, catalog);
  for (const entrance of entrances) {
    if (!exits.some((exit) => isReachable(map, entrance.position, exit.position, { blocked }))) {
      return `Placement would block the entrance-to-exit route for ${entrance.id}`;
    }
  }
  for (const exit of exits) {
    if (!entrances.some((entrance) => isReachable(map, entrance.position, exit.position, { blocked }))) {
      return `Exit ${exit.id} would not be reachable from an entrance`;
    }
  }
  const reservedPoints = accessPoints.map((point) => point.position);

  for (const object of Object.values(objects).sort((a, b) => compareIds(a.id, b.id))) {
    const definition = catalog.placeables[object.definitionId];
    if (!definition) continue;
    if (definition.kind === "stall" && object.queuePath !== undefined) {
      const queueValidation = validateConfiguredQueuePath(
        map,
        objects,
        catalog,
        object,
        object.queuePath,
        reservedPoints,
      );
      if (!queueValidation.valid) return `Queue path for ${object.id} is invalid: ${queueValidation.reasons.join("; ")}`;
    }
    const destinations: GridPoint[] = [];
    const queueAnchor = getObjectQueueAnchor(object, catalog);
    if (definition.kind === "stall" && queueAnchor) destinations.push(queueAnchor);
    const servicePoint = getObjectServicePoint(object, catalog);
    if (definition.kind === "stall" && servicePoint && (!queueAnchor || !samePoint(servicePoint, queueAnchor))) {
      destinations.push(servicePoint);
    }
    const trayPoint = getObjectTrayReturnPoint(object, catalog);
    if (trayPoint) destinations.push(trayPoint);
    const ownOccupied = new Set(getObjectOccupiedTiles(object, catalog).map(pointKey));
    for (const destination of destinations) {
      if (!isInBounds(map, destination)) return `Interaction point for ${object.id} is outside the map`;
      const blockedByOwnObject = ownOccupied.has(pointKey(destination));
      if (blocked.has(pointKey(destination)) && !blockedByOwnObject) {
        return `Interaction point for ${object.id} is blocked by another object`;
      }
      if (!entrances.some((entrance) => isReachable(map, entrance.position, destination, { blocked, allowEndBlocked: blockedByOwnObject }))) {
        return `Interaction point for ${object.id} would be unreachable`;
      }
    }
  }
  for (const seat of getSeatLocations(objects, catalog)) {
    if (!isInBounds(map, seat.point)) return `Seat point for ${seat.objectId} is outside the map`;
    const owner = objects[seat.objectId];
    const blockedByOwnObject = owner
      ? new Set(getObjectOccupiedTiles(owner, catalog).map(pointKey)).has(pointKey(seat.point))
      : false;
    if (blocked.has(pointKey(seat.point)) && !blockedByOwnObject) {
      return `Seat point for ${seat.objectId} is blocked by another object`;
    }
    if (!entrances.some((entrance) => isReachable(map, entrance.position, seat.point, { blocked, allowEndBlocked: blockedByOwnObject }))) {
      return `Seat point for ${seat.objectId} would be unreachable`;
    }
  }
  return undefined;
}
