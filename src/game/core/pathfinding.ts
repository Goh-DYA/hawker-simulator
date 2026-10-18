/**
 * Deterministic grid A*: four-way movement over floor tiles with optional blocked and
 * preferred (cheaper) cells, and a visited-node budget.
 *
 * Ties are broken by f, h, row, column and insertion order, and neighbours are expanded in
 * `CARDINAL_OFFSETS` order, so the same inputs always produce the same path.
 */
import {
  CARDINAL_OFFSETS,
  compute_manhattan_distance,
  getTile,
  isInBounds,
  pointKey,
  samePoint,
} from "./grid";
import type { GridMap, GridPoint } from "./types";

/**
 * Options for {@link findPath}: blocked tile keys, preferred tile keys, whether the goal may be
 * blocked, and the visited-node budget.
 */
export interface PathfindingOptions {
  readonly blocked?: ReadonlySet<string>;
  /** Floor cells that should be favoured without becoming mandatory waypoints. */
  readonly preferred?: ReadonlySet<string>;
  readonly allowEndBlocked?: boolean;
  readonly maxVisited?: number;
}

/**
 * The outcome of {@link findPath}: the path, or null when unreachable, and the number of nodes
 * visited.
 */
export interface PathResult {
  /** Includes both the start and destination. Null means unreachable. */
  readonly path: readonly GridPoint[] | null;
  readonly visited: number;
}

interface Node {
  readonly point: GridPoint;
  readonly key: string;
  readonly g: number;
  readonly h: number;
  readonly f: number;
  readonly order: number;
}

class MinHeap {
  private readonly nodes: Node[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: Node): void {
    this.nodes.push(node);
    let index = this.nodes.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareNodes(this.nodes[parent] as Node, node) <= 0) break;
      this.nodes[index] = this.nodes[parent] as Node;
      index = parent;
    }
    this.nodes[index] = node;
  }

  pop(): Node | undefined {
    const first = this.nodes[0];
    const last = this.nodes.pop();
    if (!first || !last || this.nodes.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.nodes.length) break;
      let child = left;
      if (right < this.nodes.length && compareNodes(this.nodes[right] as Node, this.nodes[left] as Node) < 0) {
        child = right;
      }
      if (compareNodes(last, this.nodes[child] as Node) <= 0) break;
      this.nodes[index] = this.nodes[child] as Node;
      index = child;
    }
    this.nodes[index] = last;
    return first;
  }
}

function compareNodes(a: Node, b: Node): number {
  return a.f - b.f || a.h - b.h || a.point.y - b.point.y || a.point.x - b.point.x || a.order - b.order;
}

const PREFERRED_STEP_COST = 0.65;

/**
 * Finds a shortest path between two floor tiles. Preferred cells cost 0.65 per step instead of 1.
 *
 * @param map - The map to search.
 * @param start - The starting tile.
 * @param end - The goal tile.
 * @param options - Blocked and preferred tile keys, whether the goal may be blocked, and the
 *   visited-node budget (default: every tile).
 * @returns The path from start to end inclusive, or null when either end is not floor, the goal is
 *   blocked, or the budget runs out; and the nodes visited.
 */
export function findPath(
  map: GridMap,
  start: GridPoint,
  end: GridPoint,
  options: PathfindingOptions = {},
): PathResult {
  if (!isInBounds(map, start) || !isInBounds(map, end) || getTile(map, start) !== "floor" || getTile(map, end) !== "floor") {
    return { path: null, visited: 0 };
  }
  if (samePoint(start, end)) return { path: [{ ...start }], visited: 1 };

  const blocked = options.blocked ?? new Set<string>();
  const preferred = options.preferred;
  const minimumStepCost = preferred && preferred.size > 0 ? PREFERRED_STEP_COST : 1;
  if (blocked.has(pointKey(end)) && !options.allowEndBlocked) return { path: null, visited: 0 };
  const maxVisited = options.maxVisited ?? Math.max(1, map.width * map.height);
  const open = new MinHeap();
  const startKey = pointKey(start);
  const gScores = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, string>();
  const points = new Map<string, GridPoint>([[startKey, { ...start }]]);
  const closed = new Set<string>();
  let order = 0;
  const startH = compute_manhattan_distance(start, end) * minimumStepCost;
  open.push({ point: { ...start }, key: startKey, g: 0, h: startH, f: startH, order: order++ });
  let visited = 0;

  while (open.size > 0 && visited < maxVisited) {
    const current = open.pop() as Node;
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    visited += 1;

    if (samePoint(current.point, end)) {
      const path: GridPoint[] = [{ ...end }];
      let cursor = current.key;
      while (cursor !== startKey) {
        const parent = cameFrom.get(cursor);
        if (!parent) return { path: null, visited };
        cursor = parent;
        path.push({ ...(points.get(cursor) as GridPoint) });
      }
      path.reverse();
      return { path, visited };
    }

    for (const offset of CARDINAL_OFFSETS) {
      const point = { x: current.point.x + offset.x, y: current.point.y + offset.y };
      const key = pointKey(point);
      if (!isInBounds(map, point) || getTile(map, point) !== "floor" || closed.has(key)) continue;
      if (blocked.has(key) && !(options.allowEndBlocked && samePoint(point, end))) continue;
      const stepCost = preferred?.has(key) ? PREFERRED_STEP_COST : 1;
      const tentative = current.g + stepCost;
      if (tentative >= (gScores.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      gScores.set(key, tentative);
      cameFrom.set(key, current.key);
      points.set(key, point);
      const h = compute_manhattan_distance(point, end) * minimumStepCost;
      open.push({ point, key, g: tentative, h, f: tentative + h, order: order++ });
    }
  }
  return { path: null, visited };
}

/**
 * Tests whether {@link findPath} finds a path between two tiles.
 *
 * @param map - The map to search.
 * @param start - The starting tile.
 * @param end - The goal tile.
 * @param options - The same options as {@link findPath}.
 * @returns True when a path exists within the budget.
 */
export function isReachable(
  map: GridMap,
  start: GridPoint,
  end: GridPoint,
  options: PathfindingOptions = {},
): boolean {
  return findPath(map, start, end, options).path !== null;
}
