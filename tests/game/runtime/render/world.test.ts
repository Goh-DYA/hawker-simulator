/**
 * Tests for the diner meal placement in `runtime/render/world.ts`: a seated guest's meal goes on
 * the top of the nearest table within reach, in front of the diner just inside the edge they face,
 * lifted by that table's own top height, wholly on the painted top (`table_top` in the table
 * painter) and clear of the other diners' meals, and sorts in front of the table; with no table
 * in reach it stays on the lap.
 */
import { describe, expect, it } from "vitest";

import { PLACEABLES } from "@/src/content";
import type { GameSnapshot, PlacedObject, Rotation, SimulationCatalog } from "@/src/game/core";
import type { Box } from "@/src/game/runtime/art/furniture/shared";
import { table_top, type TableTop } from "@/src/game/runtime/art/furniture/tables";
import { TABLE_TOP_LIFT } from "@/src/game/runtime/art/specs";
import { buildCatalog, type VisualDefinition } from "@/src/game/runtime/catalog";
import { boundsForObject } from "@/src/game/runtime/render/geometry";
import {
  MEAL_HALF_DEPTH,
  MEAL_HALF_WIDTH,
  nearest_table_meal_anchor,
} from "@/src/game/runtime/render/world";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";

/** World pixels per tile. */
const TILE = 48;
/** The four placement rotations. */
const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
/** How far a meal sits inside the edge its diner faces (`MEAL_INSET` in the world view). */
const MEAL_INSET = 10;
/** How far a meal on a rectangular top sits to its diner's left (`MEAL_SIDE_STEP`). */
const MEAL_SIDE_STEP = 9.75;

/** A 1 x 1 and a 2 x 1 table, the only definitions the synthetic cases read. */
const CATALOG: SimulationCatalog = {
  placeables: {
    "item.table": {
      id: "item.table",
      kind: "table",
      footprint: { width: 1, height: 1 },
      allowedRotations: [0],
      blocksMovement: true,
      price: 1,
    },
    "item.long-table": {
      id: "item.long-table",
      kind: "table",
      footprint: { width: 2, height: 1 },
      allowedRotations: [0],
      blocksMovement: true,
      price: 1,
    },
  },
  dishes: {},
  archetypes: {},
};

const VISUALS: Readonly<Record<string, VisualDefinition>> = {
  "item.table": { category: "table", name: "Table", palette: [] },
  "item.long-table": { category: "table", name: "Long table", palette: [] },
};

/** The launch content's catalog and visuals, for the cases over every launch table. */
const LAUNCH = buildCatalog();

/**
 * Builds the snapshot fields the anchor reads for a set of placed objects.
 *
 * @param objects - The placed objects.
 * @param launch - True to use the launch catalog instead of the synthetic one.
 * @returns The context the anchor takes.
 */
function context_with(objects: readonly PlacedObject[], launch = false) {
  const snapshot: Pick<GameSnapshot, "objects"> = { objects };
  return {
    snapshot: snapshot as GameSnapshot,
    visuals: launch ? LAUNCH.visuals : VISUALS,
    catalog: launch ? LAUNCH.catalog : CATALOG,
  };
}

/**
 * Places a table at a tile.
 *
 * @param x - Tile column.
 * @param y - Tile row.
 * @param definitionId - The table definition.
 * @param rotation - The placement rotation.
 * @returns The placed object.
 */
function table_at(
  x: number,
  y: number,
  definitionId = "item.table",
  rotation: Rotation = 0,
): PlacedObject {
  return { id: `table-${x}-${y}`, definitionId, origin: { x, y }, rotation, open: false };
}

/**
 * Gives a launch table's top in world pixels, the way the anchor finds it.
 *
 * @param table - The placed launch table.
 * @returns The top and the footprint's tile range.
 */
function launch_top(table: PlacedObject): {
  top: TableTop;
  tiles: { x0: number; y0: number; x1: number; y1: number };
} {
  const bounds = boundsForObject(table, LAUNCH.catalog);
  if (!bounds) throw new Error(`No bounds for ${table.definitionId}`);
  const box: Box = {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    centreX: bounds.centreX,
    centreY: bounds.centreY,
    right: bounds.maxX,
    bottom: bounds.maxY,
  };
  const content = PLACEABLES.find((item) => item.id === table.definitionId);
  const top = table_top(box, visualRecipeForPlaceable(table.definitionId, "table", content?.tags));
  return {
    top,
    tiles: {
      x0: bounds.minX / TILE,
      y0: bounds.minY / TILE,
      x1: bounds.maxX / TILE - 1,
      y1: bounds.maxY / TILE - 1,
    },
  };
}

/**
 * Lists the tiles around a footprint where a diner can sit.
 *
 * @param tiles - The footprint's tile range.
 * @param isSideOnly - True to leave out the four diagonal corner tiles.
 * @returns The tile coordinates.
 */
function neighbour_tiles(
  tiles: { x0: number; y0: number; x1: number; y1: number },
  isSideOnly: boolean,
): Array<readonly [number, number]> {
  const result: Array<readonly [number, number]> = [];
  for (let y = tiles.y0 - 1; y <= tiles.y1 + 1; y += 1) {
    for (let x = tiles.x0 - 1; x <= tiles.x1 + 1; x += 1) {
      const isInside = x >= tiles.x0 && x <= tiles.x1 && y >= tiles.y0 && y <= tiles.y1;
      const isCorner = (x < tiles.x0 || x > tiles.x1) && (y < tiles.y0 || y > tiles.y1);
      if (isInside || (isSideOnly && isCorner)) continue;
      result.push([x, y]);
    }
  }
  return result;
}

/**
 * Finds where a diner's meal lands on the floor under the top (before the lift).
 *
 * @param table - The placed launch table.
 * @param tile - The diner's tile.
 * @returns The meal's floor centre.
 */
function meal_on_floor(table: PlacedObject, tile: readonly [number, number]) {
  const { top } = launch_top(table);
  const anchor = nearest_table_meal_anchor(
    context_with([table], true),
    (tile[0] + 0.5) * TILE,
    (tile[1] + 0.5) * TILE,
  );
  return { x: anchor.x, y: anchor.y + top.lift };
}

/**
 * Reports whether a meal centred at a floor point lies wholly on a table top.
 *
 * @param top - The table top.
 * @param x - Floor x of the meal's centre.
 * @param y - Floor y of the meal's centre.
 * @returns True when every point of the meal's outline is on the top.
 */
function is_meal_on_top(top: TableTop, x: number, y: number): boolean {
  const epsilon = 1e-6;
  if (top.shape === "rect") {
    return (
      Math.abs(x - top.centreX) + MEAL_HALF_WIDTH <= top.halfWidth + epsilon &&
      Math.abs(y - top.centreY) + MEAL_HALF_DEPTH <= top.halfDepth + epsilon
    );
  }
  for (let step = 0; step < 32; step += 1) {
    const angle = (step / 32) * Math.PI * 2;
    const pointX = x + Math.cos(angle) * MEAL_HALF_WIDTH - top.centreX;
    const pointY = y + Math.sin(angle) * MEAL_HALF_DEPTH - top.centreY;
    if ((pointX / top.halfWidth) ** 2 + (pointY / top.halfDepth) ** 2 > 1 + epsilon) return false;
  }
  return true;
}

describe("nearest_table_meal_anchor", () => {
  it("puts the meal on the table south of a diner, inside its north edge and to the diner's left", () => {
    // Diner on tile (4, 4), facing south, table on tile (4, 5); its top is inset 4 px.
    const anchor = nearest_table_meal_anchor(context_with([table_at(4, 5)]), 4.5 * 48, 4.5 * 48);

    expect(anchor.x).toBeCloseTo(4.5 * 48 + MEAL_SIDE_STEP);
    expect(anchor.y).toBe(5 * 48 + 4 + MEAL_INSET - TABLE_TOP_LIFT);
    expect(anchor.sortY).toBe(6 * 48 + 0.5);
    expect([anchor.faceX, anchor.faceY]).toEqual([4.5 * 48, 5 * 48]);
  });

  it("puts the meal inside the nearest edge of a table to the west of the diner", () => {
    // Diner on tile (6, 3), facing west, long table on tiles (4, 3) and (5, 3).
    const anchor = nearest_table_meal_anchor(
      context_with([table_at(4, 3, "item.long-table")]),
      6.5 * 48,
      3.5 * 48,
    );

    expect(anchor.x).toBe(6 * 48 - 4 - MEAL_INSET);
    expect(anchor.y).toBeCloseTo(3.5 * 48 + MEAL_SIDE_STEP - TABLE_TOP_LIFT);
    expect([anchor.faceX, anchor.faceY]).toEqual([6 * 48, 3.5 * 48]);
  });

  it("turns a diner at the end of a long side to face across the table", () => {
    // Diner on tile (4, 2), north of the west end of the long table on (4, 3) and (5, 3).
    const anchor = nearest_table_meal_anchor(
      context_with([table_at(4, 3, "item.long-table")]),
      4.5 * 48,
      2.5 * 48,
    );

    expect([anchor.faceX, anchor.faceY]).toEqual([4.5 * 48, 3 * 48]);
    expect(anchor.y).toBe(3 * 48 + 4 + MEAL_INSET - TABLE_TOP_LIFT);
  });

  it("chooses the nearest of several tables and ignores tables out of reach", () => {
    const near = table_at(4, 5);
    const far = table_at(9, 9);

    const anchor = nearest_table_meal_anchor(context_with([far, near]), 4.5 * 48, 4.5 * 48);

    expect(anchor.faceY).toBe(5 * 48);
  });

  it("keeps the plate on the diner's lap when no table is within reach", () => {
    const anchor = nearest_table_meal_anchor(context_with([table_at(9, 9)]), 4.5 * 48, 4.5 * 48);

    expect(anchor.x).toBe(4.5 * 48);
    expect(anchor.y).toBeLessThan(4.5 * 48);
    expect(anchor.sortY).toBeGreaterThan(4.5 * 48);
  });

  it("lifts a meal on the standing ledge by the ledge's own height", () => {
    const ledge = table_at(5, 5, "item.standing-snack-ledge");
    const { top } = launch_top(ledge);

    const anchor = nearest_table_meal_anchor(context_with([ledge], true), 5.5 * 48, 4.5 * 48);

    expect(top.lift).toBeGreaterThan(TABLE_TOP_LIFT);
    expect(anchor.y).toBe(top.centreY - top.lift);
  });

  it("keeps every meal wholly on its table top, for every launch table, rotation and seat tile", () => {
    const tables = PLACEABLES.filter((item) => item.category === "table");
    expect(tables).toHaveLength(8);
    for (const item of tables) {
      for (const rotation of ROTATIONS) {
        const table = table_at(5, 5, item.id, rotation);
        const { top, tiles } = launch_top(table);
        for (const tile of neighbour_tiles(tiles, false)) {
          const meal = meal_on_floor(table, tile);

          expect(
            is_meal_on_top(top, meal.x, meal.y),
            `${item.id} r${rotation} diner ${tile.join(",")} meal ${meal.x},${meal.y}`,
          ).toBe(true);
        }
      }
    }
  });

  it("keeps the meals apart when every side seat of a table is taken", () => {
    for (const item of PLACEABLES.filter((entry) => entry.category === "table")) {
      for (const rotation of ROTATIONS) {
        const table = table_at(5, 5, item.id, rotation);
        const { tiles } = launch_top(table);
        // The standing ledge is too shallow for meals at its short ends as well as its sides.
        const isLedge = item.id === "item.standing-snack-ledge";
        const isAcrossLong = tiles.x1 - tiles.x0 >= tiles.y1 - tiles.y0;
        const seats = neighbour_tiles(tiles, true).filter(
          ([x, y]) =>
            !isLedge ||
            (isAcrossLong ? y < tiles.y0 || y > tiles.y1 : x < tiles.x0 || x > tiles.x1),
        );
        const meals = seats.map((tile) => meal_on_floor(table, tile));
        for (const [index, first] of meals.entries()) {
          for (const second of meals.slice(index + 1)) {
            const isOverlapping =
              Math.abs(first.x - second.x) < MEAL_HALF_WIDTH * 2 - 1e-6 &&
              Math.abs(first.y - second.y) < MEAL_HALF_DEPTH * 2 - 1e-6;

            expect(isOverlapping, `${item.id} r${rotation}`).toBe(false);
          }
        }
      }
    }
  });

  it("puts each meal in front of its diner", () => {
    // Four stools around the compact square table: each meal is on the diner's side of the top's
    // centre, within a meal's width of the line the diner faces along.
    const table = table_at(5, 5, "item.compact-square-table");
    const { top } = launch_top(table);
    for (const [x, y] of [
      [5, 4],
      [6, 5],
      [5, 6],
      [4, 5],
    ] as const) {
      const meal = meal_on_floor(table, [x, y]);
      const dinerX = (x + 0.5) * TILE;
      const dinerY = (y + 0.5) * TILE;
      const isBeside = x !== 5;

      if (isBeside) {
        expect(Math.sign(meal.x - top.centreX)).toBe(Math.sign(dinerX - top.centreX));
        expect(Math.abs(meal.y - dinerY)).toBeLessThan(MEAL_HALF_WIDTH * 2);
      } else {
        expect(Math.sign(meal.y - top.centreY)).toBe(Math.sign(dinerY - top.centreY));
        expect(Math.abs(meal.x - dinerX)).toBeLessThan(MEAL_HALF_WIDTH * 2);
      }
    }
  });
});
