/**
 * Regenerates `fixtures/gallery-save.json`, the save the render and save suites draw and load.
 *
 * It is skipped unless `GALLERY_REGENERATE=1` is set:
 *
 *   GALLERY_REGENERATE=1 npx vitest run tests/game/runtime/gallery.test.ts
 *
 * Starting from the committed gallery save, it raises the centre to the level cap with every
 * definition unlocked and every stall at mastery rank 7, resets the recipe-variant choices to
 * the current defaults, and lists each stall's variant-family dishes first on its menu, so
 * every reviewed variant can show on a counter. It then places every stall the save does not
 * hold yet through the place tool, in authored order, on the first tile (scanning rows) whose
 * footprint and a one-tile margin around it are clear floor, expanding the hall whenever no
 * such tile is left, and writes the exported save.
 * Run it only for an intentional content or visual change, then re-pin the render digests.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, it, vi } from "vitest";

import { ECONOMY, NUTRITION_CONTENT, PLACEABLES, STALLS } from "@/src/content";
import type { GridPoint } from "@/src/game/core";
import { compute_menu_slots } from "@/src/game/runtime/stallMenus";
import { create_test_runtime, install_runtime_stubs, restore_runtime_stubs } from "./fixtures";

vi.mock("phaser", async () => (await import("./fixtures")).PHASER_STUB_MODULE);

const GALLERY_URL = new URL("./fixtures/gallery-save.json", import.meta.url);

/** The XP of the first point of the level cap: level = 1 + floor(sqrt(xp / 100)). */
const CAP_XP = 100 * (ECONOMY.maxLevel - 1) ** 2;

/** The mastery every stall holds in the gallery. */
const GALLERY_MASTERY = { points: 3600, rank: 7, upgradeLevel: 1 } as const;

/** A tile's world size in pixels, as the scene's pointer handlers read it. */
const TILE_SIZE_PX = 48;

interface GallerySave {
  core: {
    map: { width: number; height: number; tiles: string[] };
    objects: { definitionId: string; origin: GridPoint; rotation: number }[];
    progression: {
      xp: number;
      level: number;
      unlockedDefinitionIds: string[];
      stallMastery: Record<string, unknown>;
    };
  };
  stallMenus: Record<string, string[]>;
  nutritionDataVersion: string;
  activeDishVariants: Record<string, string>;
}

/**
 * @param definition_id - A stall or placeable ID.
 * @returns Its footprint at rotation 0.
 */
function footprint_of(definition_id: string): { width: number; height: number } {
  const definition =
    STALLS.find((stall) => stall.id === definition_id) ??
    PLACEABLES.find((placeable) => placeable.id === definition_id);
  if (definition === undefined) throw new Error(`Unknown definition ${definition_id}`);
  return definition.footprint;
}

/**
 * Lists the occupied tiles of a save, keyed as `x,y`.
 *
 * @param save - The gallery save.
 * @returns The occupied tile keys.
 */
function occupied_tiles(save: GallerySave): Set<string> {
  const occupied = new Set<string>();
  for (const object of save.core.objects) {
    const { width, height } = footprint_of(object.definitionId);
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        occupied.add(`${object.origin.x + dx},${object.origin.y + dy}`);
      }
    }
  }
  return occupied;
}

/**
 * Finds the first origin, scanning rows, where the footprint and a one-tile margin are clear
 * floor.
 *
 * @param save - The gallery save.
 * @param definition_id - The stall to place.
 * @returns The origin, or undefined when the map has no room.
 */
function find_clear_origin(save: GallerySave, definition_id: string): GridPoint | undefined {
  const { width, height, tiles } = save.core.map;
  const footprint = footprint_of(definition_id);
  const occupied = occupied_tiles(save);
  const is_clear = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    tiles[y * width + x] === "floor" &&
    !occupied.has(`${x},${y}`);
  for (let y = 1; y < height - footprint.height; y += 1) {
    for (let x = 1; x < width - footprint.width; x += 1) {
      let is_room = true;
      for (let dy = -1; dy <= footprint.height && is_room; dy += 1) {
        for (let dx = -1; dx <= footprint.width && is_room; dx += 1) {
          is_room = is_clear(x + dx, y + dy);
        }
      }
      if (is_room) return { x, y };
    }
  }
  return undefined;
}

beforeEach(() => install_runtime_stubs());
afterEach(() => restore_runtime_stubs());

it.skipIf(process.env.GALLERY_REGENERATE !== "1")(
  "regenerates the gallery save",
  async () => {
    const save = JSON.parse(readFileSync(GALLERY_URL, "utf8")) as GallerySave;
    const progression = save.core.progression;
    progression.xp = CAP_XP;
    progression.level = ECONOMY.maxLevel;
    const unlocked = new Set(progression.unlockedDefinitionIds);
    for (const definition of [...STALLS, ...PLACEABLES]) unlocked.add(definition.id);
    progression.unlockedDefinitionIds = [...unlocked];
    const family_dish_ids = new Set(
      NUTRITION_CONTENT.variantFamilies.map((family) => family.dishId),
    );
    for (const stall of STALLS) {
      progression.stallMastery[stall.id] = { ...GALLERY_MASTERY };
      const menu = [
        ...stall.dishIds.filter((dish_id) => family_dish_ids.has(dish_id)),
        ...stall.dishIds.filter((dish_id) => !family_dish_ids.has(dish_id)),
      ];
      save.stallMenus[stall.id] = menu.slice(
        0,
        compute_menu_slots(stall, GALLERY_MASTERY.upgradeLevel),
      );
    }
    save.nutritionDataVersion = NUTRITION_CONTENT.dataVersion;
    save.activeDishVariants = Object.fromEntries(
      NUTRITION_CONTENT.variantFamilies.map((family) => [family.dishId, family.defaultVariantId]),
    );

    const placed = new Set(save.core.objects.map((object) => object.definitionId));
    const runtime = await create_test_runtime([save]);
    const scene = runtime.boot();
    let exported = save;
    for (const stall of STALLS.filter((candidate) => !placed.has(candidate.id))) {
      let origin = find_clear_origin(exported, stall.id);
      while (origin === undefined) {
        if (!runtime.controller.expandMap()) throw new Error(`No room for ${stall.id}`);
        exported = runtime.controller.exportState() as GallerySave;
        origin = find_clear_origin(exported, stall.id);
      }
      runtime.controller.selectBuildItem(stall.id);
      const camera = scene.cameras.main;
      const pointer = {
        x: ((origin.x + 0.5) * TILE_SIZE_PX - camera.scrollX) * camera.zoom,
        y: ((origin.y + 0.5) * TILE_SIZE_PX - camera.scrollY) * camera.zoom,
        isDown: false,
      };
      scene.input.emit("pointerdown", pointer);
      scene.input.emit("pointerup", pointer);
      exported = runtime.controller.exportState() as GallerySave;
      if (!exported.core.objects.some((object) => object.definitionId === stall.id)) {
        throw new Error(`The place tool rejected ${stall.id} at ${origin.x},${origin.y}`);
      }
    }
    runtime.controller.selectBuildItem(undefined);
    writeFileSync(GALLERY_URL, `${JSON.stringify(runtime.controller.exportState(), null, 2)}\n`);
  },
  60_000,
);
