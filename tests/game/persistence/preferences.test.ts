/**
 * Contract tests for the player preference keys and settings normalisation.
 *
 * The preference key strings are stored in IndexedDB, so a typo would orphan every saved
 * preference: the strings are pinned literally. Normalisation is checked for the shapes a
 * stored value may take, including the legacy fallback of the ambience volume to the music
 * volume.
 *
 * `load_player_preferences` runs against the real `saveStore` on fake-indexeddb, an
 * in-memory IndexedDB, so the request order that keeps saved settings alive at startup
 * (TD-08) is checked against real transactions.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_MIX,
  DEFAULT_SETTINGS,
  get_voice_limit_for_quality,
  load_player_preferences,
  normalizeSettings,
  type PreferenceKey,
  PREFERENCE_KEYS,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
} from "@/src/game/persistence/preferences";
import type { RuntimeSettings } from "@/src/game/runtime/types";

/** Defaults that differ from {@link DEFAULT_SETTINGS} in every field. */
const CUSTOM_DEFAULTS: RuntimeSettings = {
  quality: "lower-end",
  reducedMotion: true,
  highContrast: true,
  textScale: 1.2,
  musicVolume: 0.9,
  ambienceVolume: 0.8,
  sfxVolume: 0.7,
  masterMuted: true,
};

describe("preference keys", () => {
  it("pins the persisted key strings", () => {
    expect(PREFERENCE_KEYS).toEqual({
      SETTINGS: "settings",
      TUTORIAL_COMPLETE: "tutorial-complete",
      NUTRITION_TOUR_COMPLETE: "nutrition-tour-v1-complete",
      NUTRITION_LENS_ENABLED: "nutrition-lens-enabled",
    });
  });
});

describe("settings defaults", () => {
  it("pins the default settings", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      quality: "standard",
      reducedMotion: false,
      highContrast: false,
      textScale: 1,
      musicVolume: 0.32,
      ambienceVolume: 0.24,
      sfxVolume: 0.55,
      masterMuted: false,
    });
  });

  it("pins the default mix and the text scale range", () => {
    expect(DEFAULT_MIX).toEqual({ music: 0.32, ambience: 0.24, sfx: 0.55 });
    expect([TEXT_SCALE_MIN, TEXT_SCALE_MAX, TEXT_SCALE_STEP]).toEqual([1, 1.35, 0.05]);
  });

  it("allows 16 voices at standard quality and 8 at lower-end quality", () => {
    expect([
      get_voice_limit_for_quality("standard"),
      get_voice_limit_for_quality("lower-end"),
    ]).toEqual([16, 8]);
  });
});

describe("normalizeSettings", () => {
  it.each([undefined, null, 0, "settings", true])("returns the defaults for %j", (value) => {
    expect(normalizeSettings(value, CUSTOM_DEFAULTS)).toBe(CUSTOM_DEFAULTS);
  });

  it("uses DEFAULT_SETTINGS when no defaults are given", () => {
    expect(normalizeSettings(undefined)).toBe(DEFAULT_SETTINGS);
  });

  it("keeps a complete, in-range stored value", () => {
    expect(normalizeSettings({ ...CUSTOM_DEFAULTS }, DEFAULT_SETTINGS)).toEqual(CUSTOM_DEFAULTS);
  });

  it("takes only the motion and contrast fallbacks from the defaults for an empty object", () => {
    expect(normalizeSettings({}, CUSTOM_DEFAULTS)).toEqual({
      quality: "standard",
      reducedMotion: true,
      highContrast: true,
      textScale: 1,
      musicVolume: 0.32,
      ambienceVolume: 0.24,
      sfxVolume: 0.55,
      masterMuted: false,
    });
  });

  it("falls back from a missing ambience volume to the stored music volume", () => {
    expect(normalizeSettings({ musicVolume: 0.6 }).ambienceVolume).toBe(0.6);
  });

  it("clamps the text scale and volumes to range", () => {
    const settings = normalizeSettings({
      textScale: 9,
      musicVolume: -1,
      ambienceVolume: 2,
      sfxVolume: -0.5,
    });
    expect([
      settings.textScale,
      settings.musicVolume,
      settings.ambienceVolume,
      settings.sfxVolume,
    ]).toEqual([1.35, 0, 1, 0]);
  });

  it("raises a text scale below the minimum", () => {
    expect(normalizeSettings({ textScale: 0.5 }).textScale).toBe(1);
  });

  it("replaces non-finite and non-number volumes with the literal fallbacks", () => {
    const settings = normalizeSettings({
      textScale: Number.NaN,
      musicVolume: Number.POSITIVE_INFINITY,
      ambienceVolume: "0.5",
      sfxVolume: null,
    });
    expect([
      settings.textScale,
      settings.musicVolume,
      settings.ambienceVolume,
      settings.sfxVolume,
    ]).toEqual([1, 0.32, 0.24, 0.55]);
  });

  it("accepts only lower-end as an alternative quality", () => {
    expect([
      normalizeSettings({ quality: "lower-end" }).quality,
      normalizeSettings({ quality: "ultra" }).quality,
    ]).toEqual(["lower-end", "standard"]);
  });

  it("ignores non-boolean flags", () => {
    const settings = normalizeSettings(
      { reducedMotion: 1, highContrast: "yes", masterMuted: "true" },
      CUSTOM_DEFAULTS,
    );
    expect([settings.reducedMotion, settings.highContrast, settings.masterMuted]).toEqual([
      true,
      true,
      false,
    ]);
  });
});

/** Settings a player saved in an earlier session, in range and unlike the defaults. */
const STORED_SETTINGS: RuntimeSettings = {
  ...DEFAULT_SETTINGS,
  highContrast: true,
  textScale: 1.35,
  musicVolume: 0,
};

/** The error the failing read of a partial-failure case rejects with. */
const READ_FAILURE = new Error("Simulated preference read failure");

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
 * Store preferences as an earlier session would, then return a fresh `saveStore`.
 *
 * @param values - The preference values to store, by key.
 * @returns A `saveStore` with no cached connection to the database it now reads.
 */
async function open_store_with(
  values: ReadonlyArray<readonly [PreferenceKey, unknown]>,
): Promise<Awaited<ReturnType<typeof import_save_store>>> {
  const previous_session = await import_save_store();
  for (const [key, value] of values) await previous_session.savePreference(key, value);
  vi.resetModules();
  return import_save_store();
}

describe("load_player_preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.indexedDB = new IDBFactory();
  });

  it("returns the fallbacks when nothing is stored", async () => {
    const store = await import_save_store();

    expect(await load_player_preferences(store.loadPreference)).toEqual({
      values: {
        settings: DEFAULT_SETTINGS,
        isTutorialComplete: false,
        isNutritionTourComplete: false,
        isNutritionLensEnabled: true,
      },
    });
  });

  it("normalises a missing settings value against the initial settings", async () => {
    const store = await import_save_store();
    const initial_settings = { ...DEFAULT_SETTINGS, reducedMotion: true };

    const result = await load_player_preferences(store.loadPreference, () => initial_settings);

    expect(result.values.settings).toBe(initial_settings);
  });

  it("returns every stored preference", async () => {
    const store = await open_store_with([
      [PREFERENCE_KEYS.SETTINGS, STORED_SETTINGS],
      [PREFERENCE_KEYS.TUTORIAL_COMPLETE, true],
      [PREFERENCE_KEYS.NUTRITION_TOUR_COMPLETE, true],
      [PREFERENCE_KEYS.NUTRITION_LENS_ENABLED, false],
    ]);

    expect(await load_player_preferences(store.loadPreference)).toEqual({
      values: {
        settings: STORED_SETTINGS,
        isTutorialComplete: true,
        isNutritionTourComplete: true,
        isNutritionLensEnabled: false,
      },
    });
  });

  it("keeps the stored settings when the second read rejects", async () => {
    const store = await open_store_with([
      [PREFERENCE_KEYS.SETTINGS, STORED_SETTINGS],
      [PREFERENCE_KEYS.TUTORIAL_COMPLETE, true],
      [PREFERENCE_KEYS.NUTRITION_TOUR_COMPLETE, true],
    ]);
    const read_keys: PreferenceKey[] = [];
    const load = <T>(key: PreferenceKey, fallback: T): Promise<T> => {
      read_keys.push(key);
      if (key === PREFERENCE_KEYS.TUTORIAL_COMPLETE) return Promise.reject(READ_FAILURE);
      return store.loadPreference(key, fallback);
    };

    const result = await load_player_preferences(load);

    expect({ result, read_keys }).toEqual({
      result: {
        values: {
          settings: STORED_SETTINGS,
          isTutorialComplete: false,
          isNutritionTourComplete: false,
          isNutritionLensEnabled: true,
        },
        error: READ_FAILURE,
      },
      read_keys: [PREFERENCE_KEYS.SETTINGS, PREFERENCE_KEYS.TUTORIAL_COMPLETE],
    });
  });

  // TD-08: the mount writes the default settings in the same tick as the startup read.
  it("returns the stored settings when the defaults are written right after the call", async () => {
    const store = await open_store_with([[PREFERENCE_KEYS.SETTINGS, STORED_SETTINGS]]);

    const loaded = load_player_preferences(store.loadPreference);
    const saved = store.savePreference(PREFERENCE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const [result] = await Promise.all([loaded, saved]);

    expect(result.values.settings).toEqual(STORED_SETTINGS);
  });
});
