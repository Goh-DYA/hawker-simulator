/**
 * The map renderer: floor and wall tiles, route-guide tiles, the predicted guest route and the
 * entrance and exit portals.
 *
 * It draws only from its arguments into the Phaser graphics it is given, so it can live outside
 * the scene. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import { findPath, getBlockedTileKeys, type GridPoint } from "@/src/game/core";

import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "../world";
import type { RenderContext } from "./context";

/**
 * Draws the map: the surround, every tile, the route guides, the predicted guest route from
 * each entrance to each exit, and the labelled access-point portals.
 *
 * @param graphics - The world graphics object to draw into.
 * @param context - The render context; the snapshot supplies the map, access points and route
 *   guides, the live state and layered catalog supply the blocked tiles, and `addLabel` places
 *   the portal labels.
 */
export function drawMap(graphics: Phaser.GameObjects.Graphics, context: RenderContext) {
  const { snapshot } = context;
  const width = snapshot.map.width * TILE_SIZE;
  const height = snapshot.map.height * TILE_SIZE;
  graphics.fillStyle(0x365f53, 1);
  graphics.fillRect(-96, -96, width + 192, height + 192);
  graphics.fillStyle(0x477567, 1);
  graphics.fillRoundedRect(-56, -56, width + 112, height + 112, 24);
  graphics.fillStyle(0xe9d7b5, 1);
  graphics.fillRect(0, 0, width, height);
  for (let y = 0; y < snapshot.map.height; y += 1) {
    for (let x = 0; x < snapshot.map.width; x += 1) {
      const tile = snapshot.map.tiles[y * snapshot.map.width + x];
      const accessPoint = snapshot.accessPoints.find((point) => point.position.x === x && point.position.y === y);
      const isEntrance = accessPoint?.kind === "entrance";
      const isExit = accessPoint?.kind === "exit";
      const alternate = (x + y) % 2 === 0;
      const isExpansion = x >= MAP_WIDTH || y >= MAP_HEIGHT;
      graphics.fillStyle(
        tile === "wall" && !isEntrance && !isExit
          ? 0x3f695a
          : isExpansion
            ? alternate
              ? 0xf0dfbd
              : 0xe9d4af
            : alternate
              ? 0xecdcbc
              : 0xe5d1ad,
        1,
      );
      graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      graphics.lineStyle(
        1,
        tile === "wall" && !isEntrance && !isExit ? 0x274c40 : 0xcfb88f,
        0.46,
      );
      graphics.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      if (tile === "wall" && !isEntrance && !isExit) {
        graphics.fillStyle(0x729584, 0.5);
        graphics.fillRect(x * TILE_SIZE + 3, y * TILE_SIZE + 3, TILE_SIZE - 6, 6);
      } else if (isExpansion && (x + y) % 4 === 0) {
        graphics.fillStyle(0xd6bc8f, 0.34);
        graphics.fillCircle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 2);
      }
    }
  }

  // Preferred tiles are authored guidance, while the dashed line remains a
  // prediction of the route guests can actually take through the live map.
  for (const point of snapshot.routeGuidePoints) {
    const x = point.x * TILE_SIZE;
    const y = point.y * TILE_SIZE;
    graphics.fillStyle(0x1f9f91, 0.2);
    graphics.fillRoundedRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10, 7);
    graphics.lineStyle(2, 0x14796f, 0.88);
    graphics.strokeRoundedRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10, 7);
    for (const offset of [15, 28]) {
      graphics.lineBetween(x + offset - 4, y + 18, x + offset + 3, y + 24);
      graphics.lineBetween(x + offset + 3, y + 24, x + offset - 4, y + 30);
    }
  }

  const preferred = new Set(snapshot.routeGuidePoints.map((point) => `${point.x},${point.y}`));
  graphics.lineStyle(3, 0xfff7e5, 0.82);
  for (const entrance of snapshot.accessPoints.filter((point) => point.kind === "entrance")) {
    for (const exit of snapshot.accessPoints.filter((point) => point.kind === "exit")) {
      const guestRoute = findPath(snapshot.map, entrance.position, exit.position, {
        blocked: getBlockedTileKeys(context.state.objects, context.catalog),
        preferred,
      }).path ?? [];
      for (let index = 1; index < guestRoute.length; index += 1) {
        const previous = guestRoute[index - 1] as GridPoint;
        const current = guestRoute[index] as GridPoint;
        const startX = (previous.x + 0.5) * TILE_SIZE;
        const startY = (previous.y + 0.5) * TILE_SIZE;
        const deltaX = (current.x - previous.x) * TILE_SIZE;
        const deltaY = (current.y - previous.y) * TILE_SIZE;
        graphics.lineBetween(startX + deltaX * 0.12, startY + deltaY * 0.12, startX + deltaX * 0.68, startY + deltaY * 0.68);
      }
    }
  }

  const drawPortal = (point: GridPoint, label: string, pointsInward: boolean) => {
    const x = point.x * TILE_SIZE;
    const y = point.y * TILE_SIZE;
    graphics.fillStyle(0xf4c65a, 1);
    graphics.fillRoundedRect(x + 3, y + 6, TILE_SIZE - 6, TILE_SIZE - 12, 5);
    graphics.fillStyle(0xfff3c9, 1);
    graphics.fillRoundedRect(x + 8, y + 11, TILE_SIZE - 16, TILE_SIZE - 22, 3);
    graphics.lineStyle(3, 0x8b5b27, 0.8);
    graphics.strokeRoundedRect(x + 3, y + 6, TILE_SIZE - 6, TILE_SIZE - 12, 5);
    const direction = point.x === 0 ? 1 : point.x === snapshot.map.width - 1 ? -1 : pointsInward ? 1 : -1;
    const centreX = x + TILE_SIZE / 2;
    const centreY = y + TILE_SIZE / 2;
    graphics.fillStyle(0x355e52, 1);
    graphics.fillTriangle(
      centreX + direction * 9,
      centreY,
      centreX - direction * 4,
      centreY - 8,
      centreX - direction * 4,
      centreY + 8,
    );
    const labelX = centreX + (point.x === 0 ? 34 : point.x === snapshot.map.width - 1 ? -34 : 0);
    context.addLabel(labelX, centreY - 21, label);
  };

  for (const point of snapshot.accessPoints) {
    drawPortal(point.position, point.kind === "entrance" ? "ENTRY" : "EXIT", point.kind === "entrance");
  }
}
