/**
 * Tests for `load_runtime_save`, the save-load pipeline that startup and import share.
 *
 * The saves mirror the S14 cases of `createHawkerRuntime.test.ts`: a valid runtime V2
 * envelope that differs from a fresh centre only in cash, the same envelope with a truncated
 * core, a runtime V1 envelope, a V2 envelope without its nutrition fields, a V2 envelope with an
 * outdated nutrition data version, and a bare core save. The expanded gallery save from
 * `fixtures/gallery-save.json` checks a save with every placeable, and a level 1 save that
 * already owns a late stall checks that the stall keeps its opening dishes. Each save goes
 * through JSON first, as storage would hand it back.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { NUTRITION_CONTENT } from "@/src/content";
import { persistentStateFromGame } from "@/src/game/core";
import { buildCatalog } from "@/src/game/runtime/catalog";
import {
  load_runtime_save,
  RUNTIME_SCHEMA_VERSION,
  type RuntimePersistentState,
} from "@/src/game/runtime/saves";
import { create_fresh_session } from "@/src/game/runtime/world";

/** Cash added to the fresh centre so the valid save differs from a new one. */
const VALID_SAVE_CASH_BONUS = 250;
/** Length of the truncated JSON string that stands in for a damaged core save. */
const DAMAGED_CORE_LENGTH = 64;
/** A late stall whose dishes are all gated above a level 1 centre. */
const LATE_STALL_ID = "stall.herbal-cauldron";
/** The late stall's opening dish, gated at the stall's own level and reputation. */
const LATE_OPENING_DISH_ID = "dish.bak-kut-teh";
/** One of the late stall's dishes gated above the stall itself. */
const LATE_LATER_DISH_ID = "dish.duck-rice";

const AUTHORED_CATALOG = buildCatalog().catalog;

/**
 * @returns A stored runtime V2 envelope of a fresh centre with extra cash.
 */
function create_valid_save(): RuntimePersistentState {
  const session = create_fresh_session(AUTHORED_CATALOG);
  const state = {
    ...session.state,
    economy: {
      ...session.state.economy,
      currency: session.state.economy.currency + VALID_SAVE_CASH_BONUS,
    },
  };
  const payload: RuntimePersistentState = {
    runtimeSchemaVersion: RUNTIME_SCHEMA_VERSION,
    core: persistentStateFromGame(state),
    stallMenus: session.stallMenus,
    nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
    activeDishVariants: session.activeDishVariants,
  };
  return JSON.parse(JSON.stringify(payload)) as RuntimePersistentState;
}

/**
 * @returns A stored runtime V2 envelope of a level 1 centre that already owns the late stall,
 *   as an older save may after content moves the stall's gates later, with the stall's
 *   opening and later dishes on its saved menu.
 */
function create_owned_late_stall_save(): RuntimePersistentState {
  const session = create_fresh_session(AUTHORED_CATALOG);
  const state = {
    ...session.state,
    progression: {
      ...session.state.progression,
      unlockedDefinitionIds: [...session.state.progression.unlockedDefinitionIds, LATE_STALL_ID],
    },
  };
  const payload: RuntimePersistentState = {
    runtimeSchemaVersion: RUNTIME_SCHEMA_VERSION,
    core: persistentStateFromGame(state),
    stallMenus: {
      ...session.stallMenus,
      [LATE_STALL_ID]: [LATE_OPENING_DISH_ID, LATE_LATER_DISH_ID],
    },
    nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
    activeDishVariants: session.activeDishVariants,
  };
  return JSON.parse(JSON.stringify(payload)) as RuntimePersistentState;
}

describe("load_runtime_save", () => {
  it("loads a valid runtime V2 envelope without a recipe reset", () => {
    const save = create_valid_save();

    const loaded = load_runtime_save(save, AUTHORED_CATALOG);

    expect(loaded.isRecovered).toBe(false);
    expect(loaded.stallMenus).toEqual(save.stallMenus);
    expect(loaded.activeDishVariants).toEqual(save.activeDishVariants);
    expect(loaded.state.economy.currency).toBe(
      (save.core as { economy: { currency: number } }).economy.currency,
    );
  });

  it("stores the layered catalog on the loaded state", () => {
    const loaded = load_runtime_save(create_valid_save(), AUTHORED_CATALOG);

    expect(loaded.state.catalog).toBe(loaded.catalog);
  });

  it("round-trips a valid save through the core serialiser", () => {
    const save = create_valid_save();

    const loaded = load_runtime_save(save, AUTHORED_CATALOG);

    expect(JSON.parse(JSON.stringify(persistentStateFromGame(loaded.state)))).toEqual(save.core);
  });

  it("throws the core error for a damaged core save", () => {
    const save = create_valid_save();
    const damaged_save = {
      ...save,
      core: JSON.stringify(save.core).slice(0, DAMAGED_CORE_LENGTH),
    };

    expect(() => load_runtime_save(damaged_save, AUTHORED_CATALOG)).toThrow(
      "Save data is not valid JSON",
    );
  });

  it("loads a runtime V1 envelope without a recipe reset", () => {
    const save = create_valid_save();
    const v1_envelope = {
      runtimeSchemaVersion: 1,
      core: save.core,
      stallMenus: save.stallMenus,
    };

    expect(load_runtime_save(v1_envelope, AUTHORED_CATALOG).isRecovered).toBe(false);
  });

  it("marks a runtime V2 envelope without nutrition fields as recovered", () => {
    const save = create_valid_save();
    const incomplete_v2_envelope = {
      runtimeSchemaVersion: 2,
      core: save.core,
      stallMenus: save.stallMenus,
    };

    expect(load_runtime_save(incomplete_v2_envelope, AUTHORED_CATALOG).isRecovered).toBe(true);
  });

  it("marks a save from an outdated nutrition data version as recovered", () => {
    const outdated_save = { ...create_valid_save(), nutritionDataVersion: "outdated" };

    expect(load_runtime_save(outdated_save, AUTHORED_CATALOG).isRecovered).toBe(true);
  });

  it("loads a bare core save with the reviewed default variants", () => {
    const save = create_valid_save();

    const loaded = load_runtime_save(save.core, AUTHORED_CATALOG);

    expect(loaded.isRecovered).toBe(false);
    expect(loaded.activeDishVariants).toEqual(save.activeDishVariants);
  });

  it("keeps an owned stall's opening dishes on its menu below their own gates", () => {
    const loaded = load_runtime_save(create_owned_late_stall_save(), AUTHORED_CATALOG);

    expect([
      loaded.state.progression.level,
      loaded.state.progression.unlockedDefinitionIds.includes(LATE_STALL_ID),
      loaded.stallMenus[LATE_STALL_ID],
      loaded.catalog.placeables[LATE_STALL_ID]?.stall?.dishIds,
    ]).toEqual([1, true, [LATE_OPENING_DISH_ID], [LATE_OPENING_DISH_ID]]);
  });

  it("loads the expanded gallery save at its saved map size", () => {
    const gallery_save = JSON.parse(
      readFileSync(new URL("./fixtures/gallery-save.json", import.meta.url), "utf8"),
    ) as RuntimePersistentState;

    const loaded = load_runtime_save(gallery_save, AUTHORED_CATALOG);

    expect(loaded.isRecovered).toBe(false);
    expect({ width: loaded.state.map.width, height: loaded.state.map.height }).toEqual({
      width: 40,
      height: 24,
    });
  });
});
