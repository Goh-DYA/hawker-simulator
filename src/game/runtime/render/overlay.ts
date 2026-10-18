/**
 * The overlay renderer: queue paths and guest counts, reserved seats, the build-tool hover
 * preview and the debug footprint outlines, drawn above the world.
 *
 * It draws only from its arguments into the Phaser graphics it is given, so it can live outside
 * the scene. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import {
  getBlockedTileKeys,
  getObjectOccupiedTiles,
  getSeatLocations,
  getTile,
  get_navigation_reserved_points,
  planStallQueueLayouts,
  tileToWorld,
  validatePlacement,
  type GridPoint,
} from "@/src/game/core";

import { TILE_SIZE } from "../world";
import type { OverlayContext } from "./context";
import { boundsForObject } from "./objects";

/**
 * Draws the overlay: each stall's queue path and guest-count label, the reserved seats, the
 * hover preview for the current build tool, and the object footprints when the debug overlay
 * is on.
 *
 * @param graphics - The overlay graphics object to draw into.
 * @param context - The overlay context; besides the world context it supplies the effective
 *   catalog for queue planning and the build tool, selected build ID, hover tile and placement
 *   preview for the hover feedback.
 */
export function drawOverlay(graphics: Phaser.GameObjects.Graphics, context: OverlayContext) {
  const { snapshot, state, catalog, buildTool, selectedBuildId, hoverTile, placementCandidate } =
    context;
  const queueLayouts = planStallQueueLayouts(
    snapshot.map,
    state.objects,
    context.effectiveCatalog,
    get_navigation_reserved_points(snapshot),
  );
  for (const stall of snapshot.objects) {
    const definition = catalog.placeables[stall.definitionId];
    if (definition?.kind !== "stall") continue;
    const queue = snapshot.queues[stall.id] ?? [];
    const queueCells = queueLayouts[stall.id] ?? [];
    const bounds = boundsForObject(stall, catalog);
    if (bounds) {
      context.addLabel(
        bounds.maxX - 25,
        bounds.minY + 25,
        `${queue.length} ${queue.length === 1 ? "guest" : "guests"}`,
        queue.length >= (definition.stall?.queueCapacity ?? 7) ? "#9a3e31" : "#17352e",
      );
    }
    if (queueCells.length === 0) continue;
    graphics.lineStyle(4, 0xe8b94f, 0.45);
    for (let index = 1; index < queueCells.length; index += 1) {
      const previous = tileToWorld(snapshot.map, queueCells[index - 1] as GridPoint);
      const point = tileToWorld(snapshot.map, queueCells[index] as GridPoint);
      graphics.lineBetween(previous.x, previous.y, point.x, point.y);
    }
    for (let index = 0; index < queueCells.length; index += 1) {
      const point = tileToWorld(snapshot.map, queueCells[index] as GridPoint);
      const occupied = index < queue.length;
      graphics.fillStyle(occupied ? 0xe8b94f : 0xfff7e5, occupied ? 0.24 : 0.36);
      graphics.fillCircle(point.x, point.y, occupied ? 17 : 12);
      graphics.lineStyle(2.5, occupied ? 0xd69a35 : 0xb39769, occupied ? 1 : 0.72);
      graphics.strokeCircle(point.x, point.y, occupied ? 17 : 12);
      graphics.fillStyle(0x17352e, occupied ? 0.92 : 0.56);
      graphics.fillCircle(point.x + 10, point.y - 10, 7);
      graphics.fillStyle(0xfff7e5, 1);
      const pipCount = Math.min(3, index + 1);
      for (let pip = 0; pip < pipCount; pip += 1) {
        graphics.fillCircle(point.x + 7 + pip * 3, point.y - 10, 1);
      }
    }
  }

  for (const key of Object.keys(snapshot.seatReservations)) {
    const [objectId, indexSource] = key.split(":");
    const seat = getSeatLocations(state.objects, catalog).find(
      (location) => location.objectId === objectId && location.index === Number(indexSource),
    );
    if (!seat) continue;
    graphics.lineStyle(3, 0x4da8bc, 1);
    graphics.strokeCircle((seat.point.x + 0.5) * TILE_SIZE, (seat.point.y + 0.5) * TILE_SIZE, 17);
  }

  if (buildTool === "place" && selectedBuildId) {
    const candidate = placementCandidate(hoverTile);
    if (candidate) {
      const result = validatePlacement(state.map, state.objects, catalog, candidate, {
        reservedPoints: get_navigation_reserved_points(state),
      });
      const cells = result.occupiedTiles;
      for (const cell of cells) {
        graphics.fillStyle(result.valid ? 0x2b83b8 : 0xc75542, 0.34);
        graphics.fillRect(cell.x * TILE_SIZE + 2, cell.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        graphics.lineStyle(3, result.valid ? 0x1d648f : 0x8f2e22, 1);
        graphics.strokeRect(cell.x * TILE_SIZE + 2, cell.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        if (!result.valid) {
          graphics.lineBetween(cell.x * TILE_SIZE + 9, cell.y * TILE_SIZE + 9, (cell.x + 1) * TILE_SIZE - 9, (cell.y + 1) * TILE_SIZE - 9);
          graphics.lineBetween((cell.x + 1) * TILE_SIZE - 9, cell.y * TILE_SIZE + 9, cell.x * TILE_SIZE + 9, (cell.y + 1) * TILE_SIZE - 9);
        }
      }
    }
  } else if (buildTool === "route") {
    const hoverKey = `${hoverTile.x},${hoverTile.y}`;
    const isExisting = snapshot.routeGuidePoints.some(
      (point) => point.x === hoverTile.x && point.y === hoverTile.y,
    );
    const occupiedQueueCells = new Set(
      Object.values(queueLayouts).flat().map((point) => `${point.x},${point.y}`),
    );
    const valid = isExisting || (
      hoverTile.x > 0 &&
      hoverTile.y > 0 &&
      hoverTile.x < snapshot.map.width - 1 &&
      hoverTile.y < snapshot.map.height - 1 &&
      getTile(snapshot.map, hoverTile) === "floor" &&
      !getBlockedTileKeys(state.objects, catalog).has(hoverKey) &&
      !occupiedQueueCells.has(hoverKey)
    );
    graphics.fillStyle(isExisting ? 0xe8b94f : valid ? 0x28b7a7 : 0xc75542, 0.28);
    graphics.fillRoundedRect(
      hoverTile.x * TILE_SIZE + 3,
      hoverTile.y * TILE_SIZE + 3,
      TILE_SIZE - 6,
      TILE_SIZE - 6,
      7,
    );
    graphics.lineStyle(3, isExisting ? 0x9a6a20 : valid ? 0x14796f : 0x8f2e22, 1);
    graphics.strokeRoundedRect(
      hoverTile.x * TILE_SIZE + 3,
      hoverTile.y * TILE_SIZE + 3,
      TILE_SIZE - 6,
      TILE_SIZE - 6,
      7,
    );
    if (isExisting) {
      graphics.lineBetween(
        hoverTile.x * TILE_SIZE + 14,
        hoverTile.y * TILE_SIZE + 14,
        (hoverTile.x + 1) * TILE_SIZE - 14,
        (hoverTile.y + 1) * TILE_SIZE - 14,
      );
      graphics.lineBetween(
        (hoverTile.x + 1) * TILE_SIZE - 14,
        hoverTile.y * TILE_SIZE + 14,
        hoverTile.x * TILE_SIZE + 14,
        (hoverTile.y + 1) * TILE_SIZE - 14,
      );
    }
  } else {
    graphics.lineStyle(2, 0xffffff, 0.85);
    graphics.strokeRect(hoverTile.x * TILE_SIZE + 3, hoverTile.y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  }

  if (context.isDebugOverlay) {
    graphics.lineStyle(2, 0x7a2e88, 0.8);
    for (const object of snapshot.objects) {
      for (const tile of getObjectOccupiedTiles(object, catalog)) {
        graphics.strokeRect(tile.x * TILE_SIZE + 5, tile.y * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10);
      }
    }
  }
}
