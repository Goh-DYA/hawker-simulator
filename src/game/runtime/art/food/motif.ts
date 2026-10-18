/**
 * The shared shape of a dish motif: the painter that lays a dish's own ingredients into the food
 * area of its vessel, plus the small placement helpers the motif modules share.
 *
 * Motifs place everything relative to the food area, so the same motif fits a plate, a bowl or
 * a platter, and they read `remaining` to take pieces away as the serving is eaten.
 */
import type { PaintContext } from "../canvas";
import type { FoodArea } from "./parts";

/** Everything a motif painter needs. */
export interface MotifPaint {
  readonly ctx: PaintContext;
  /** The dish texture's centre x, which the vessel geometry is measured from. */
  readonly cx: number;
  /** The dish texture's centre y. */
  readonly cy: number;
  /** Where the portion goes. */
  readonly area: FoodArea;
  /** The uneaten share of the serving: 1, 2/3 or 1/3. */
  readonly remaining: number;
  /** A stable seed for grains, strands and scatter. */
  readonly seed: number;
  /** True for the lower-end frame: fewer grains, strands and flecks. */
  readonly isLowDetail: boolean;
  /** The dish's authored portion colour. */
  readonly portion: number;
}

/** A dish motif painter. */
export type Motif = (paint: MotifPaint) => void;

/**
 * Converts a position given in food-area units (-1 to 1 across each radius) to pixels.
 *
 * @param area - The food area.
 * @param u - Horizontal position, -1 at the left edge and 1 at the right.
 * @param v - Vertical position, -1 at the far edge and 1 at the near edge.
 * @returns The pixel position as `[x, y]`.
 */
export function at(area: FoodArea, u: number, v: number): [number, number] {
  return [area.x + u * area.rx, area.y + v * area.ry];
}

/**
 * Gives the pieces of a serving still on the dish, never fewer than one.
 *
 * @param count - The pieces on a full serving.
 * @param remaining - The uneaten share.
 * @returns The pieces left.
 */
export function pieces_left(count: number, remaining: number): number {
  return Math.max(1, Math.round(count * remaining));
}

/**
 * Gives the size of a heap (a rice mound, a noodle nest) for how much is left.
 *
 * @param remaining - The uneaten share.
 * @returns A factor from about 0.6 (a third left) to 1.
 */
export function heap_scale(remaining: number): number {
  return 0.45 + 0.55 * remaining;
}
