/**
 * Contract tests for the save file envelope and the IndexedDB slots of `saveStore`.
 *
 * The envelope is a persisted format: players keep exported files, and IndexedDB holds the
 * same envelope in its save slots. These tests pin the exact text of `exportSave` for a
 * fixed payload and clock, which fixes the field order, `appVersion` "1.0.0",
 * `saveVersion` 2, the pretty-printing and the 32-bit FNV-1a checksum over the payload's
 * key-sorted serialisation. They also pin the rules by which `importSave` rejects a file.
 *
 * The `IndexedDB` block runs `saveStore` against fake-indexeddb, an in-memory IndexedDB.
 * It pins the database and store names, the active-to-backup slot rotation, the fallback
 * past an invalid active slot, `clearGame`, preferences, and the request order that keeps
 * saved settings alive at startup (TD-08). The envelope tests never open a database.
 *
 * The golden changes only in an intentional save-format commit. If a refactor makes it
 * fail, the refactor changed the save format: fix the code, never the golden.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportSave, importSave } from "@/src/game/persistence/saveStore";

/** The clock that `writtenAt` records in every export of this suite. */
const FIXED_NOW = new Date("2026-01-02T03:04:05.678Z");

/** The error `importSave` throws for every rejected file. */
const DAMAGED_SAVE_MESSAGE = "The save file is damaged or unsupported.";

/** A save version that `importSave` does not accept. */
const UNSUPPORTED_SAVE_VERSION = 3;

/**
 * A small runtime-shaped payload. Its keys are deliberately unsorted, mixed-case and
 * nested, and its strings hold non-ASCII and astral characters, so the golden pins the
 * key sort and the UTF-16 code units that the checksum hashes.
 */
function create_fixed_payload(): unknown {
  return {
    runtimeSchemaVersion: 2,
    core: {
      schemaVersion: 4,
      objects: [
        { id: "starter-1", origin: { x: 2, y: 1 }, rotation: 0, open: true },
        { id: "placed-15", origin: { x: 17, y: 13 }, rotation: 90, open: false },
      ],
      economy: { currency: 4200.5, lifetimeRevenue: 0, reputation: -0.25 },
      queuePath: null,
    },
    stallMenus: { "stall.coconut-lime": ["dish.b", "dish.a"], Zeta: [], _private: [1e21] },
    nutritionDataVersion: "nutrition-2026.1 — Coconut & Lime é \u{1F35C}",
    activeDishVariants: {},
  };
}

/** The FNV-1a checksum of {@link create_fixed_payload}, as `exportSave` writes it. */
const GOLDEN_CHECKSUM = "15cc06a4";

/** `exportSave(create_fixed_payload())` at {@link FIXED_NOW}. */
const GOLDEN_EXPORT = `{
  "appVersion": "1.0.0",
  "saveVersion": 2,
  "writtenAt": "2026-01-02T03:04:05.678Z",
  "checksum": "${GOLDEN_CHECKSUM}",
  "payload": {
    "runtimeSchemaVersion": 2,
    "core": {
      "schemaVersion": 4,
      "objects": [
        {
          "id": "starter-1",
          "origin": {
            "x": 2,
            "y": 1
          },
          "rotation": 0,
          "open": true
        },
        {
          "id": "placed-15",
          "origin": {
            "x": 17,
            "y": 13
          },
          "rotation": 90,
          "open": false
        }
      ],
      "economy": {
        "currency": 4200.5,
        "lifetimeRevenue": 0,
        "reputation": -0.25
      },
      "queuePath": null
    },
    "stallMenus": {
      "stall.coconut-lime": [
        "dish.b",
        "dish.a"
      ],
      "Zeta": [],
      "_private": [
        1e+21
      ]
    },
    "nutritionDataVersion": "nutrition-2026.1 — Coconut & Lime é \u{1F35C}",
    "activeDishVariants": {}
  }
}`;

/**
 * @param source - An exported save file.
 * @returns The envelope parsed as a plain record, for editing one field.
 */
function parse_envelope(source: string): Record<string, unknown> {
  return JSON.parse(source) as Record<string, unknown>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saveStore export envelope", () => {
  it("exports the fixed payload as the golden file text", () => {
    expect(exportSave(create_fixed_payload())).toBe(GOLDEN_EXPORT);
  });

  it("imports the golden file back to the payload", () => {
    expect(importSave(GOLDEN_EXPORT)).toEqual(create_fixed_payload());
  });

  it("imports a valid saveVersion 1 envelope", () => {
    const envelope = { ...parse_envelope(GOLDEN_EXPORT), saveVersion: 1 };

    expect(importSave(JSON.stringify(envelope))).toEqual(create_fixed_payload());
  });

  it("rejects a payload changed after export", () => {
    const envelope = parse_envelope(GOLDEN_EXPORT);
    const tampered = {
      ...envelope,
      payload: { ...(envelope.payload as object), runtimeSchemaVersion: 3 },
    };

    expect(() => importSave(JSON.stringify(tampered))).toThrow(DAMAGED_SAVE_MESSAGE);
  });

  it("rejects a wrong checksum", () => {
    const envelope = { ...parse_envelope(GOLDEN_EXPORT), checksum: "00000000" };

    expect(() => importSave(JSON.stringify(envelope))).toThrow(DAMAGED_SAVE_MESSAGE);
  });

  it("rejects an unsupported save version", () => {
    const envelope = { ...parse_envelope(GOLDEN_EXPORT), saveVersion: UNSUPPORTED_SAVE_VERSION };

    expect(() => importSave(JSON.stringify(envelope))).toThrow(DAMAGED_SAVE_MESSAGE);
  });

  it("gives the same checksum whatever the payload's key order", () => {
    const reordered = {
      activeDishVariants: {},
      nutritionDataVersion: "nutrition-2026.1 — Coconut & Lime é \u{1F35C}",
      stallMenus: { _private: [1e21], Zeta: [], "stall.coconut-lime": ["dish.b", "dish.a"] },
      core: {
        queuePath: null,
        economy: { reputation: -0.25, lifetimeRevenue: 0, currency: 4200.5 },
        objects: [
          { open: true, rotation: 0, origin: { y: 1, x: 2 }, id: "starter-1" },
          { open: false, rotation: 90, origin: { y: 13, x: 17 }, id: "placed-15" },
        ],
        schemaVersion: 4,
      },
      runtimeSchemaVersion: 2,
    };

    expect(parse_envelope(exportSave(reordered)).checksum).toBe(GOLDEN_CHECKSUM);
  });

  // Known behaviour (TD-06): the checksum serialises an undefined-valued key as
  // `"key":undefined`, but the exported JSON drops that key, so importing the file
  // recomputes a different checksum and rejects it. Runtime saves always write
  // `queuePath`, undefined when a stall has no custom queue, so this hits real exports.
  it("known behaviour (TD-06): rejects the export of a payload with an undefined-valued key", () => {
    const exported = exportSave({ ...(create_fixed_payload() as object), queuePath: undefined });

    expect(() => importSave(exported)).toThrow(DAMAGED_SAVE_MESSAGE);
  });
});

/** The database that `saveStore` opens. Players' saves live under this name. */
const DATABASE_NAME = "hawker-simulator";

/** The clock of the second save in a slot-rotation test, later than {@link FIXED_NOW}. */
const SECOND_SAVE_TIME = new Date("2026-01-02T04:05:06.789Z");

/** Settings shaped like the app's defaults. */
const DEFAULT_SETTINGS = {
  quality: "standard",
  reducedMotion: false,
  highContrast: false,
  textScale: 1,
  musicVolume: 0.32,
  ambienceVolume: 0.24,
  sfxVolume: 0.55,
  masterMuted: false,
};

/** Settings a player saved in an earlier session; every value differs from the defaults. */
const STORED_SETTINGS = {
  quality: "low",
  reducedMotion: true,
  highContrast: true,
  textScale: 1.25,
  musicVolume: 0.1,
  ambienceVolume: 0,
  sfxVolume: 0.8,
  masterMuted: true,
};

/** @returns A payload that differs from {@link create_fixed_payload}, for a second save. */
function create_second_payload(): unknown {
  return { ...(create_fixed_payload() as object), activeDishVariants: { "dish.a": "variant.b" } };
}

/**
 * Import a fresh `saveStore`. The caller resets the module registry first, so the new
 * instance has no cached database connection and opens the current fake IndexedDB.
 *
 * @returns The freshly evaluated `saveStore` module.
 */
function import_save_store() {
  return import("@/src/game/persistence/saveStore");
}

/**
 * Open a second connection to the database `saveStore` created, without upgrading it.
 *
 * @returns The open connection; the caller closes it.
 */
function open_existing_database() {
  return openDB(DATABASE_NAME);
}

/**
 * @param slot - The save slot key, `"active"` or `"backup"`.
 * @returns The envelope stored in that slot, read past `saveStore`'s validation.
 */
async function read_save_slot(slot: string): Promise<unknown> {
  const db = await open_existing_database();
  const envelope: unknown = await db.get("saves", slot);
  db.close();
  return envelope;
}

/**
 * Overwrite the active slot with its own envelope whose payload was edited after the
 * checksum was written, as a corrupted or hand-edited save would be.
 */
async function tamper_active_slot(): Promise<void> {
  const db = await open_existing_database();
  const active = (await db.get("saves", "active")) as Record<string, unknown>;
  const payload = { ...(active.payload as object), runtimeSchemaVersion: 3 };
  await db.put("saves", { ...active, payload }, "active");
  db.close();
}

describe("IndexedDB", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.indexedDB = new IDBFactory();
  });

  it("opens the hawker-simulator database at version 1", async () => {
    const store = await import_save_store();
    await store.loadGameCandidates();

    expect(await indexedDB.databases()).toEqual([{ name: DATABASE_NAME, version: 1 }]);
  });

  it("creates the saves and preferences object stores", async () => {
    const store = await import_save_store();
    await store.loadGameCandidates();
    const db = await open_existing_database();
    const store_names = [...db.objectStoreNames];
    db.close();

    expect(store_names).toEqual(["preferences", "saves"]);
  });

  it("moves the previous active envelope into the backup slot on save", async () => {
    const store = await import_save_store();
    const first_envelope = parse_envelope(exportSave(create_fixed_payload()));
    await store.saveGame(create_fixed_payload());
    vi.setSystemTime(SECOND_SAVE_TIME);
    const second_envelope = parse_envelope(exportSave(create_second_payload()));
    await store.saveGame(create_second_payload());

    expect({
      active: await read_save_slot("active"),
      backup: await read_save_slot("backup"),
    }).toEqual({ active: second_envelope, backup: first_envelope });
  });

  it("returns only the backup payload when the active envelope is tampered", async () => {
    const store = await import_save_store();
    await store.saveGame(create_fixed_payload());
    await store.saveGame(create_second_payload());
    await tamper_active_slot();

    expect(await store.loadGameCandidates()).toEqual([create_fixed_payload()]);
  });

  it("clearGame removes both save slots", async () => {
    const store = await import_save_store();
    await store.saveGame(create_fixed_payload());
    await store.saveGame(create_second_payload());
    await store.clearGame();
    const db = await open_existing_database();
    const slot_keys = await db.getAllKeys("saves");
    db.close();

    expect(slot_keys).toEqual([]);
  });

  it("loads a saved preference back", async () => {
    const store = await import_save_store();
    await store.savePreference("settings", STORED_SETTINGS);

    expect(await store.loadPreference("settings", DEFAULT_SETTINGS)).toEqual(STORED_SETTINGS);
  });

  it("returns the fallback for a preference that was never saved", async () => {
    const store = await import_save_store();

    expect(await store.loadPreference("settings", DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS);
  });

  // TD-08: at startup the app issues loadPreference("settings") and, in the same tick,
  // savePreference("settings", defaults) from the settings effect. Saved settings survive
  // only because the load is issued first, so its read is queued before the write.
  it("returns the stored settings to a load issued just before a save of the defaults", async () => {
    const previous_session = await import_save_store();
    await previous_session.savePreference("settings", STORED_SETTINGS);
    vi.resetModules();
    const store = await import_save_store();

    const loaded = store.loadPreference<unknown>("settings", undefined);
    const saved = store.savePreference("settings", DEFAULT_SETTINGS);
    const [loaded_settings] = await Promise.all([loaded, saved]);

    expect(loaded_settings).toEqual(STORED_SETTINGS);
  });
});
