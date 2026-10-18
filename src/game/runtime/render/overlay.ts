/**
 * The overlay view: the interface drawn above the world each render. Queue lanes and their
 * markers, reserved seats, the selected object and guest, guests' patience arcs, the placement
 * ghost of the item being placed (the real sprite, tinted valid or invalid), the route tool
 * highlight, the hover tile and the debug footprints and paths.
 *
 * Most of it is dynamic line work in one Graphics object; the ghost is a retained sprite from
 * the texture studio. Phaser is imported as a type only.
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

import { OVERHANG, type PaintFrame } from "../art/specs";
import { TILE_SIZE } from "../world";
import type { OverlayContext } from "./context";
import { boundsForObject, DEPTH_OVERLAY, renderedCustomerPosition } from "./geometry";
import { SpriteSlot, type ImageFactory } from "./sprites";
import type { TextureStudio } from "./textures";
import { placeable_spec, stall_spec } from "./world";

/** The scene factories the overlay uses. */
export interface OverlaySceneSurface {
  readonly add: {
    image: ImageFactory;
    graphics(): Phaser.GameObjects.Graphics;
  };
}

const SELECTION_BLUE = 0x2d78d4;
const VALID_TEAL = 0x1f9f91;
const INVALID_RED = 0xc75542;
const QUEUE_AMBER = 0xe8b94f;
const SEAT_BLUE = 0x4da8bc;
const INK = 0x17352e;
const CREAM = 0xfff7e5;

/**
 * Draws the interface overlay.
 */
export class OverlayView {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private ghost: SpriteSlot | undefined;
  private readonly createImage: ImageFactory;

  /**
   * @param scene - The scene's image and graphics factories.
   * @param studio - The texture studio, for the placement ghost.
   */
  constructor(
    scene: OverlaySceneSurface,
    private readonly studio: TextureStudio,
  ) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(DEPTH_OVERLAY);
    this.createImage = scene.add.image;
  }

  /**
   * Redraws the overlay for a render context.
   *
   * @param context - The overlay context.
   */
  draw(context: OverlayContext): void {
    const graphics = this.graphics;
    graphics.clear();
    this.draw_queues(context);
    this.draw_seats(context);
    this.draw_selection(context);
    this.draw_customers(context);
    this.draw_tool(context);
    if (context.isDebugOverlay) this.draw_debug(context);
  }

  /** Destroys the graphics and the ghost sprite. */
  destroy(): void {
    this.graphics.destroy();
    this.ghost?.destroy();
    this.ghost = undefined;
  }

  private draw_queues(context: OverlayContext): void {
    const { snapshot, state, catalog } = context;
    const graphics = this.graphics;
    const layouts = planStallQueueLayouts(
      snapshot.map,
      state.objects,
      context.effectiveCatalog,
      get_navigation_reserved_points(snapshot),
    );
    for (const stall of snapshot.objects) {
      if (catalog.placeables[stall.definitionId]?.kind !== "stall") continue;
      const queue = snapshot.queues[stall.id] ?? [];
      const cells = layouts[stall.id] ?? [];
      if (cells.length === 0) continue;
      // Lane: a soft amber band with a dashed centre line.
      graphics.lineStyle(14, QUEUE_AMBER, 0.14);
      for (let index = 1; index < cells.length; index += 1) {
        const previous = tileToWorld(snapshot.map, cells[index - 1] as GridPoint);
        const point = tileToWorld(snapshot.map, cells[index] as GridPoint);
        graphics.lineBetween(previous.x, previous.y, point.x, point.y);
      }
      graphics.lineStyle(2, QUEUE_AMBER, 0.75);
      for (let index = 1; index < cells.length; index += 1) {
        const previous = tileToWorld(snapshot.map, cells[index - 1] as GridPoint);
        const point = tileToWorld(snapshot.map, cells[index] as GridPoint);
        const steps = 3;
        for (let step = 0; step < steps; step += 1) {
          const t0 = (step + 0.15) / steps;
          const t1 = (step + 0.6) / steps;
          graphics.lineBetween(
            previous.x + (point.x - previous.x) * t0,
            previous.y + (point.y - previous.y) * t0,
            previous.x + (point.x - previous.x) * t1,
            previous.y + (point.y - previous.y) * t1,
          );
        }
      }
      // Markers: filled while a guest stands there, outlined while free.
      for (let index = 0; index < cells.length; index += 1) {
        const point = tileToWorld(snapshot.map, cells[index] as GridPoint);
        const occupied = index < queue.length;
        graphics.fillStyle(occupied ? QUEUE_AMBER : CREAM, occupied ? 0.22 : 0.3);
        graphics.fillCircle(point.x, point.y, occupied ? 16 : 11);
        graphics.lineStyle(2, occupied ? 0xd69a35 : 0xb39769, occupied ? 0.95 : 0.65);
        graphics.strokeCircle(point.x, point.y, occupied ? 16 : 11);
        if (index === 0) {
          // Head of the queue: a small pennant.
          graphics.fillStyle(INK, 0.85);
          graphics.fillTriangle(
            point.x + 10,
            point.y - 18,
            point.x + 20,
            point.y - 14,
            point.x + 10,
            point.y - 10,
          );
          graphics.fillRect(point.x + 9, point.y - 18, 1.5, 12);
        }
      }
    }
  }

  private draw_seats(context: OverlayContext): void {
    const { snapshot, state, catalog } = context;
    const graphics = this.graphics;
    const seats = getSeatLocations(state.objects, catalog);
    for (const key of Object.keys(snapshot.seatReservations)) {
      const [objectId, indexSource] = key.split(":");
      const seat = seats.find(
        (location) => location.objectId === objectId && location.index === Number(indexSource),
      );
      if (!seat) continue;
      const x = (seat.point.x + 0.5) * TILE_SIZE;
      const y = (seat.point.y + 0.5) * TILE_SIZE;
      graphics.lineStyle(2.5, SEAT_BLUE, 0.95);
      graphics.strokeCircle(x, y, 17);
      graphics.fillStyle(SEAT_BLUE, 0.18);
      graphics.fillCircle(x, y, 17);
    }
  }

  private draw_selection(context: OverlayContext): void {
    const { snapshot, catalog, selectedObjectId } = context;
    const graphics = this.graphics;
    const isHighContrast = context.frame.isHighContrast;
    const selected = selectedObjectId
      ? snapshot.objects.find((object) => object.id === selectedObjectId)
      : undefined;
    if (!selected) return;
    const bounds = boundsForObject(selected, catalog);
    if (!bounds) return;
    graphics.lineStyle(4, isHighContrast ? 0xffffff : SELECTION_BLUE, 1);
    graphics.strokeRoundedRect(
      bounds.minX + 1,
      bounds.minY + 1,
      bounds.width - 2,
      bounds.height - 2,
      8,
    );
    graphics.lineStyle(1.5, isHighContrast ? INK : CREAM, 0.9);
    graphics.strokeRoundedRect(
      bounds.minX + 4,
      bounds.minY + 4,
      bounds.width - 8,
      bounds.height - 8,
      6,
    );
    // Corner handles.
    graphics.fillStyle(isHighContrast ? 0xffffff : CREAM, 1);
    graphics.lineStyle(2, isHighContrast ? INK : SELECTION_BLUE, 1);
    for (const [cx, cy] of [
      [bounds.minX + 1, bounds.minY + 1],
      [bounds.maxX - 1, bounds.minY + 1],
      [bounds.minX + 1, bounds.maxY - 1],
      [bounds.maxX - 1, bounds.maxY - 1],
    ] as const) {
      graphics.fillCircle(cx, cy, 5);
      graphics.strokeCircle(cx, cy, 5);
    }
  }

  private draw_customers(context: OverlayContext): void {
    const { snapshot, catalog, selectedCustomerId } = context;
    const graphics = this.graphics;
    const { isReducedMotion, isHighContrast } = context.frame;
    for (const customer of snapshot.customers) {
      const position = renderedCustomerPosition(customer, isReducedMotion);
      const x = (position.x + 0.5) * TILE_SIZE;
      const y = (position.y + 0.5) * TILE_SIZE;
      if (customer.id === selectedCustomerId) {
        graphics.lineStyle(4, isHighContrast ? 0xffffff : SELECTION_BLUE, 1);
        graphics.strokeCircle(x, y - 2, 24);
        graphics.lineStyle(1.5, isHighContrast ? INK : CREAM, 1);
        graphics.strokeCircle(x, y - 2, 20);
      }
      if (customer.status === "queued" || customer.status === "waiting-for-food") {
        const patience = catalog.archetypes[customer.archetypeId]?.patienceMs ?? 1;
        const fraction = Math.max(0, Math.min(1, customer.patienceRemainingMs / patience));
        graphics.lineStyle(3, INK, 0.18);
        graphics.strokeCircle(x, y - 2, 18);
        graphics.lineStyle(3, fraction > 0.35 ? QUEUE_AMBER : INVALID_RED, 1);
        graphics.beginPath();
        graphics.arc(x, y - 2, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
        graphics.strokePath();
      }
    }
  }

  private draw_tool(context: OverlayContext): void {
    const { snapshot, state, catalog, buildTool, selectedBuildId, hoverTile, placementCandidate } =
      context;
    const graphics = this.graphics;
    const frame: PaintFrame = {
      isHighContrast: context.frame.isHighContrast,
      isLowDetail: context.frame.qualityMode !== "standard",
    };
    let ghostShown = false;
    if (buildTool === "place" && selectedBuildId) {
      const candidate = placementCandidate(hoverTile);
      if (candidate) {
        const result = validatePlacement(state.map, state.objects, catalog, candidate, {
          reservedPoints: get_navigation_reserved_points(state),
        });
        const colour = result.valid ? VALID_TEAL : INVALID_RED;
        for (const cell of result.occupiedTiles) {
          graphics.fillStyle(colour, 0.22);
          graphics.fillRoundedRect(
            cell.x * TILE_SIZE + 2,
            cell.y * TILE_SIZE + 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4,
            5,
          );
          if (!result.valid) {
            graphics.lineStyle(2.5, INVALID_RED, 0.9);
            graphics.lineBetween(
              cell.x * TILE_SIZE + 12,
              cell.y * TILE_SIZE + 12,
              (cell.x + 1) * TILE_SIZE - 12,
              (cell.y + 1) * TILE_SIZE - 12,
            );
            graphics.lineBetween(
              (cell.x + 1) * TILE_SIZE - 12,
              cell.y * TILE_SIZE + 12,
              cell.x * TILE_SIZE + 12,
              (cell.y + 1) * TILE_SIZE - 12,
            );
          }
        }
        const bounds = boundsForObject(candidate, catalog);
        const definition = catalog.placeables[candidate.definitionId];
        const visual = context.visuals[candidate.definitionId];
        if (bounds && definition && visual) {
          graphics.lineStyle(3, colour, 0.95);
          graphics.strokeRoundedRect(
            bounds.minX + 1,
            bounds.minY + 1,
            bounds.width - 2,
            bounds.height - 2,
            7,
          );
          const { width, height } = definition.footprint;
          const spec =
            visual.category === "stall"
              ? stall_spec(
                  candidate.definitionId,
                  visual.name,
                  visual.palette,
                  visual.signShape,
                  width,
                  height,
                  candidate.rotation,
                  "full",
                  frame,
                )
              : placeable_spec(
                  candidate.definitionId,
                  visual.category,
                  width,
                  height,
                  candidate.rotation,
                  frame,
                );
          const painted = this.studio.ensure(spec);
          const left = bounds.minX;
          const top = bounds.minY - OVERHANG;
          this.ghost ??= new SpriteSlot(this.createImage(left, top, painted.key));
          this.ghost.apply({
            key: painted.key,
            x: left,
            y: top,
            originX: 0,
            originY: 0,
            scale: painted.scale,
            depth: DEPTH_OVERLAY - 1,
            alpha: result.valid ? 0.78 : 0.55,
            tint: result.valid ? 0xffffff : 0xffb3a3,
          });
          ghostShown = true;
        }
      }
    } else if (buildTool === "route") {
      const hoverKey = `${hoverTile.x},${hoverTile.y}`;
      const isExisting = snapshot.routeGuidePoints.some(
        (point) => point.x === hoverTile.x && point.y === hoverTile.y,
      );
      const layouts = planStallQueueLayouts(
        snapshot.map,
        state.objects,
        context.effectiveCatalog,
        get_navigation_reserved_points(snapshot),
      );
      const occupiedQueueCells = new Set(
        Object.values(layouts)
          .flat()
          .map((point) => `${point.x},${point.y}`),
      );
      const valid =
        isExisting ||
        (hoverTile.x > 0 &&
          hoverTile.y > 0 &&
          hoverTile.x < snapshot.map.width - 1 &&
          hoverTile.y < snapshot.map.height - 1 &&
          getTile(snapshot.map, hoverTile) === "floor" &&
          !getBlockedTileKeys(state.objects, catalog).has(hoverKey) &&
          !occupiedQueueCells.has(hoverKey));
      const colour = isExisting ? QUEUE_AMBER : valid ? VALID_TEAL : INVALID_RED;
      graphics.fillStyle(colour, 0.26);
      graphics.fillRoundedRect(
        hoverTile.x * TILE_SIZE + 3,
        hoverTile.y * TILE_SIZE + 3,
        TILE_SIZE - 6,
        TILE_SIZE - 6,
        8,
      );
      graphics.lineStyle(3, colour, 1);
      graphics.strokeRoundedRect(
        hoverTile.x * TILE_SIZE + 3,
        hoverTile.y * TILE_SIZE + 3,
        TILE_SIZE - 6,
        TILE_SIZE - 6,
        8,
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
      graphics.fillStyle(0xffffff, 0.12);
      graphics.fillRoundedRect(
        hoverTile.x * TILE_SIZE + 3,
        hoverTile.y * TILE_SIZE + 3,
        TILE_SIZE - 6,
        TILE_SIZE - 6,
        7,
      );
      graphics.lineStyle(2, 0xffffff, 0.9);
      graphics.strokeRoundedRect(
        hoverTile.x * TILE_SIZE + 3,
        hoverTile.y * TILE_SIZE + 3,
        TILE_SIZE - 6,
        TILE_SIZE - 6,
        7,
      );
    }
    if (!ghostShown) this.ghost?.hide();
  }

  private draw_debug(context: OverlayContext): void {
    const { snapshot, catalog } = context;
    const graphics = this.graphics;
    graphics.lineStyle(2, 0x7a2e88, 0.8);
    for (const object of snapshot.objects) {
      for (const tile of getObjectOccupiedTiles(object, catalog)) {
        graphics.strokeRect(
          tile.x * TILE_SIZE + 5,
          tile.y * TILE_SIZE + 5,
          TILE_SIZE - 10,
          TILE_SIZE - 10,
        );
      }
    }
    graphics.lineStyle(2, 0x287ec0, 0.55);
    for (const customer of snapshot.customers) {
      const position = renderedCustomerPosition(customer, context.frame.isReducedMotion);
      let previous = { x: (position.x + 0.5) * TILE_SIZE, y: (position.y + 0.5) * TILE_SIZE };
      for (const step of customer.path.slice(customer.pathIndex)) {
        const point = tileToWorld(snapshot.map, step);
        graphics.lineBetween(previous.x, previous.y, point.x, point.y);
        previous = point;
      }
    }
  }
}
