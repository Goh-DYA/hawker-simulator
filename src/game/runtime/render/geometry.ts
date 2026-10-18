/**
 * World-space geometry the renderer and the interaction hit tests share: an object's footprint
 * bounds, a customer's rendered position between tiles and the depth bands the display list is
 * sorted into.
 *
 * Everything here is pure and Phaser-free.
 */
import {
  getObjectOccupiedTiles,
  type Customer,
  type PlacedObject,
  type SimulationCatalog,
} from "@/src/game/core";

import { TILE_SIZE } from "../world";
import type { ObjectVisualBounds } from "./context";

/** Depth of the floor texture. */
export const DEPTH_FLOOR = 0;
/** Depth of the additive lamp pools, over the floor and under everything that stands on it. */
export const DEPTH_LIGHT_POOLS = 5;
/** Base depth of standing objects and people; their bottom edge adds a fraction for y-sorting. */
export const DEPTH_WORLD = 10;
/** Base depth of overhead fittings (ceiling fans, hung lights, bunting), above people. */
export const DEPTH_OVERHEAD = 40;
/** Depth of steam and sparkles. */
export const DEPTH_EFFECTS = 60;
/** Depth of the time-of-day tint, over the world and under the interface overlays. */
export const DEPTH_TINT = 70;
/** Depth of the overlay graphics (hover, queue paths, selection, placement ghost). */
export const DEPTH_OVERLAY = 80;
/** Depth of the status bubbles, above the tint so they stay bright. */
export const DEPTH_INDICATORS = 85;
/** Depth of the live text labels. */
export const DEPTH_LABELS = 90;

/** Scale that turns a world y into the fraction added to a depth band for y-sorting. */
const DEPTH_PER_WORLD_Y = 0.0001;

/**
 * Computes the sort depth of something standing on the floor from its bottom edge.
 *
 * @param band - The depth band (`DEPTH_WORLD` or `DEPTH_OVERHEAD`).
 * @param bottomY - World y of the object's bottom edge or the person's feet.
 * @param nudge - A small extra offset for children that must draw just above their parent.
 * @returns The depth.
 */
export function depth_for(band: number, bottomY: number, nudge = 0): number {
  return band + bottomY * DEPTH_PER_WORLD_Y + nudge;
}

/**
 * Computes the world-space pixel bounds of an object's occupied footprint.
 *
 * @param object - The placed object.
 * @param catalog - The catalog that defines the object's footprint.
 * @returns The bounds, or undefined when the object occupies no tiles.
 */
export function boundsForObject(
  object: PlacedObject,
  catalog: SimulationCatalog,
): ObjectVisualBounds | undefined {
  const cells = getObjectOccupiedTiles(object, catalog);
  if (cells.length === 0) return undefined;
  const minX = Math.min(...cells.map((cell) => cell.x)) * TILE_SIZE;
  const minY = Math.min(...cells.map((cell) => cell.y)) * TILE_SIZE;
  const maxX = (Math.max(...cells.map((cell) => cell.x)) + 1) * TILE_SIZE;
  const maxY = (Math.max(...cells.map((cell) => cell.y)) + 1) * TILE_SIZE;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centreX: (minX + maxX) / 2,
    centreY: (minY + maxY) / 2,
  };
}

/** The customer fields that decide where a customer's avatar is drawn. */
export type CustomerMovementState = Pick<
  Customer,
  "id" | "position" | "path" | "pathIndex" | "movementProgress"
>;

/**
 * Computes where a customer's avatar is drawn: part way to the next path tile by their movement
 * progress, or on their tile when they are not moving or reduced motion is on.
 *
 * @param customer - The customer's movement fields.
 * @param reducedMotion - Whether reduced motion is on, which snaps the avatar to its tile.
 * @returns The grid position of the avatar, possibly between tiles.
 */
export function renderedCustomerPosition(customer: CustomerMovementState, reducedMotion: boolean) {
  const next = customer.path[customer.pathIndex];
  if (!next || reducedMotion) return customer.position;
  const progress = Math.max(0, Math.min(1, customer.movementProgress));
  return {
    x: customer.position.x + (next.x - customer.position.x) * progress,
    y: customer.position.y + (next.y - customer.position.y) * progress,
  };
}
