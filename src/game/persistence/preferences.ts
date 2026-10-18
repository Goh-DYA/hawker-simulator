/**
 * Player preference keys, settings defaults and settings normalisation.
 *
 * The four preference keys are persisted in the IndexedDB `preferences` store, so their
 * strings are part of the save contract: renaming one would orphan the stored value.
 * `tests/game/persistence/preferences.test.ts` pins them. The settings defaults, the text
 * scale range and the audio mix live here so the HUD, the audio director and the settings
 * loader agree on one set of values.
 */
import type { QualityMode, RuntimeSettings } from "@/src/game/runtime/types";

/** The IndexedDB `preferences` store keys. Persisted: never rename a value. */
export const PREFERENCE_KEYS = {
  SETTINGS: "settings",
  TUTORIAL_COMPLETE: "tutorial-complete",
  NUTRITION_TOUR_COMPLETE: "nutrition-tour-v1-complete",
  NUTRITION_LENS_ENABLED: "nutrition-lens-enabled",
} as const;

/** One of the persisted preference keys in {@link PREFERENCE_KEYS}. */
export type PreferenceKey = (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

/** The smallest player text scale (100%). */
export const TEXT_SCALE_MIN = 1;

/** The largest player text scale (135%). */
export const TEXT_SCALE_MAX = 1.35;

/** The step of the text size slider. */
export const TEXT_SCALE_STEP = 0.05;

/** The default bus volumes of the audio mix, each in `[0, 1]`. */
export const DEFAULT_MIX = {
  music: 0.32,
  ambience: 0.24,
  sfx: 0.55,
} as const;

/** The audio voice limit at standard quality. */
const STANDARD_VOICE_LIMIT = 16;

/** The audio voice limit at lower-end quality. */
const LOWER_END_VOICE_LIMIT = 8;

/** The settings a new player starts with. */
export const DEFAULT_SETTINGS: RuntimeSettings = {
  quality: "standard",
  reducedMotion: false,
  highContrast: false,
  textScale: 1,
  musicVolume: DEFAULT_MIX.music,
  ambienceVolume: DEFAULT_MIX.ambience,
  sfxVolume: DEFAULT_MIX.sfx,
  masterMuted: false,
};

/**
 * Return the number of simultaneous audio voices allowed at a quality mode.
 *
 * @param quality - The player's quality setting.
 * @returns 16 at standard quality, 8 otherwise.
 */
export function get_voice_limit_for_quality(quality: QualityMode): number {
  return quality === "standard" ? STANDARD_VOICE_LIMIT : LOWER_END_VOICE_LIMIT;
}

/**
 * Turn a stored settings value into complete, in-range settings.
 *
 * Only `reducedMotion` and `highContrast` fall back to `defaults`; the numeric fields fall
 * back to literal values equal to {@link DEFAULT_SETTINGS}, and `quality` and
 * `masterMuted` fall back to `"standard"` and `false`. A missing `ambienceVolume` falls
 * back to the stored `musicVolume` first, because older saves had a single music volume.
 *
 * @param value - The value read from the `settings` preference, of unknown shape.
 * @param defaults - The settings returned when `value` is not an object.
 * @returns The normalised settings, with the text scale and volumes clamped to range.
 */
export function normalizeSettings(
  value: unknown,
  defaults: RuntimeSettings = DEFAULT_SETTINGS,
): RuntimeSettings {
  if (!value || typeof value !== "object") return defaults;
  const record = value as Partial<Record<keyof RuntimeSettings, unknown>>;
  const number = (key: "textScale" | "musicVolume" | "ambienceVolume" | "sfxVolume", fallback: number) =>
    typeof record[key] === "number" && Number.isFinite(record[key])
      ? Number(record[key])
      : fallback;
  return {
    quality: record.quality === "lower-end" ? "lower-end" : "standard",
    reducedMotion:
      typeof record.reducedMotion === "boolean"
        ? record.reducedMotion
        : defaults.reducedMotion,
    highContrast:
      typeof record.highContrast === "boolean"
        ? record.highContrast
        : defaults.highContrast,
    textScale: Math.max(1, Math.min(1.35, number("textScale", 1))),
    musicVolume: Math.max(0, Math.min(1, number("musicVolume", 0.32))),
    ambienceVolume: Math.max(0, Math.min(1, number("ambienceVolume", number("musicVolume", 0.24)))),
    sfxVolume: Math.max(0, Math.min(1, number("sfxVolume", 0.55))),
    masterMuted: typeof record.masterMuted === "boolean" ? record.masterMuted : false,
  };
}

/** Reads one stored preference, resolving to `fallback` when none is stored. */
export type PreferenceLoader = <T>(key: PreferenceKey, fallback: T) => Promise<T>;

/** The player preferences the app reads at startup. */
export interface PlayerPreferences {
  /** The normalised player settings. */
  settings: RuntimeSettings;
  /** Whether the player finished the tutorial. */
  isTutorialComplete: boolean;
  /** Whether the player finished the nutrition tour. */
  isNutritionTourComplete: boolean;
  /** Whether the Nutrition Lens is on. */
  isNutritionLensEnabled: boolean;
}

/** The outcome of {@link load_player_preferences}. */
export interface PlayerPreferencesResult {
  /** Every value read before a failed read; the remaining fields keep their fallbacks. */
  values: PlayerPreferences;
  /** The error of the read that failed, if one did. */
  error?: unknown;
}

/**
 * Read the four startup preferences, one after another.
 *
 * The settings read is issued synchronously, before this function first awaits, so a
 * caller that runs it ahead of the mount's write of the default settings has its read
 * queued first in IndexedDB and still sees the stored settings (TD-08). The other reads
 * follow in order, each after the previous one resolves. A rejected read stops the
 * sequence: the values read before it are kept, and the rest keep their fallbacks
 * (`DEFAULT_SETTINGS`, both onboarding flows unfinished, and the Nutrition Lens on).
 *
 * @param load - Reads one stored preference, such as `saveStore.loadPreference`.
 * @param read_initial_settings - Returns the defaults that a stored settings value is
 * normalised against; it runs only after the settings read succeeds.
 * @returns The values read and, when a read rejected, its error. It rejects only if
 * `load` throws synchronously instead of returning a rejected promise.
 */
export async function load_player_preferences(
  load: PreferenceLoader,
  read_initial_settings: () => RuntimeSettings = () => DEFAULT_SETTINGS,
): Promise<PlayerPreferencesResult> {
  const settings_read = load<unknown>(PREFERENCE_KEYS.SETTINGS, undefined);
  const values: PlayerPreferences = {
    settings: DEFAULT_SETTINGS,
    isTutorialComplete: false,
    isNutritionTourComplete: false,
    isNutritionLensEnabled: true,
  };
  try {
    values.settings = normalizeSettings(await settings_read, read_initial_settings());
    values.isTutorialComplete =
      (await load<unknown>(PREFERENCE_KEYS.TUTORIAL_COMPLETE, false)) === true;
    values.isNutritionTourComplete =
      (await load<unknown>(PREFERENCE_KEYS.NUTRITION_TOUR_COMPLETE, false)) === true;
    values.isNutritionLensEnabled =
      (await load<unknown>(PREFERENCE_KEYS.NUTRITION_LENS_ENABLED, true)) !== false;
    return { values };
  } catch (error) {
    return { values, error };
  }
}
