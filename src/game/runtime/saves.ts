/**
 * The runtime save envelope, its decoders and the shared save-load pipeline.
 *
 * The runtime wraps the core save with the player's stall menus, active dish variants and the
 * nutrition data version they were chosen against. This module defines that shape, turns a
 * stored payload back into its parts and loads it into a playable session, so startup and
 * import run the same sequence.
 */
import { NUTRITION_CONTENT } from "@/src/content";
import {
  deserializeGameState,
  type GameState,
  type SimulationCatalog,
} from "@/src/game/core";
import { layer_catalog } from "./catalog";
import { resolveDishVariants } from "./nutrition";
import {
  normalizeStallMenuSelection,
  resolveStallMenus,
  stallMenuProgression,
  stallMenuSlotBonuses,
} from "./stallMenus";
import { assertRuntimeMap, ensure_neighbourhood, reconcileRuntimeUnlocks } from "./world";

/** Version of the runtime save envelope that this build writes. */
export const RUNTIME_SCHEMA_VERSION = 2 as const;

/** Runtime save wrapper around the core save: player stall menus, dish variants and data version. */
export interface RuntimePersistentState {
  readonly runtimeSchemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  readonly core: unknown;
  readonly stallMenus: Readonly<Record<string, readonly string[]>>;
  readonly nutritionDataVersion: string;
  readonly activeDishVariants: Readonly<Record<string, string>>;
}

/**
 * Resolves persisted variant choices, resetting them when the nutrition data has changed.
 *
 * @param value - Persisted variant map, or `undefined` for a save without one.
 * @param nutritionDataVersion - Nutrition data version stored with the save, if any.
 * @param state - Progression whose stall mastery ranks gate each variant.
 * @returns The resolved selection per family and whether any choice had to be reset.
 */
export function resolvePersistedDishVariants(
  value: unknown,
  nutritionDataVersion: string | undefined,
  state: Pick<GameState, "progression">,
): {
  readonly selections: Readonly<Record<string, string>>;
  readonly recovered: boolean;
} {
  const outdated =
    value !== undefined &&
    nutritionDataVersion !== NUTRITION_CONTENT.dataVersion;
  const resolved = resolveDishVariants(outdated ? undefined : value, state);
  return {
    selections: resolved.selections,
    recovered: outdated || resolved.recovered,
  };
}

/**
 * Splits a stored payload into the core save and the runtime layer's fields.
 *
 * A payload without a recognised `runtimeSchemaVersion` is treated as a bare core save.
 *
 * @param value - Stored payload: a runtime envelope (version 1 or 2) or a bare core save.
 * @returns The core save plus the decoded runtime fields when the envelope is recognised.
 */
export function decodeRuntimeSave(value: unknown): {
  core: unknown;
  runtimeSchemaVersion?: 1 | typeof RUNTIME_SCHEMA_VERSION;
  menus?: Readonly<Record<string, readonly string[]>>;
  variants?: unknown;
  nutritionDataVersion?: string;
} {
  if (
    value &&
    typeof value === "object" &&
    ((value as { runtimeSchemaVersion?: unknown }).runtimeSchemaVersion === 1 ||
      (value as { runtimeSchemaVersion?: unknown }).runtimeSchemaVersion === RUNTIME_SCHEMA_VERSION)
  ) {
    const runtime = value as Partial<RuntimePersistentState> & {
      readonly runtimeSchemaVersion?: 1 | typeof RUNTIME_SCHEMA_VERSION;
    };
    return {
      core: runtime.core,
      runtimeSchemaVersion: runtime.runtimeSchemaVersion,
      menus: normalizeStallMenuSelection(runtime.stallMenus),
      variants: runtime.activeDishVariants,
      nutritionDataVersion: typeof runtime.nutritionDataVersion === "string"
        ? runtime.nutritionDataVersion
        : undefined,
    };
  }
  return { core: value };
}

/** A stored payload loaded into a playable session, ready for the runtime to adopt. */
export interface LoadedRuntimeSave {
  /** Loaded game state, carrying the layered catalog. */
  readonly state: GameState;
  /** Authored catalog with the loaded stall menus and dish variants layered on top. */
  readonly catalog: SimulationCatalog;
  /** Stall menus resolved against the loaded progression. */
  readonly stallMenus: Readonly<Record<string, readonly string[]>>;
  /** Active dish variants resolved against the loaded progression. */
  readonly activeDishVariants: Readonly<Record<string, string>>;
  /** Whether any recipe choice was reset to its reviewed default while loading. */
  readonly isRecovered: boolean;
}

/**
 * Loads a stored payload into a playable session.
 *
 * Startup and import share this sequence: decode the envelope, deserialise and check the core
 * save, reconcile runtime unlocks, resolve the stall menus and dish variants against the loaded
 * progression, then layer them onto the authored catalog. A version 2 envelope that lacks its
 * variants or nutrition data version counts as recovered. The caller owns the messages it shows.
 *
 * @param value - Stored payload: a runtime envelope (version 1 or 2) or a bare core save.
 * @param authored - Authored catalog the core save is validated against.
 * @returns The loaded state, its layered catalog, the resolved menus and variants, and whether
 *   any recipe choice was reset.
 * @throws Error When the core save cannot be deserialised or its map geometry is unsupported.
 */
export function load_runtime_save(value: unknown, authored: SimulationCatalog): LoadedRuntimeSave {
  const decoded = decodeRuntimeSave(value);
  const loadedCore = reconcileRuntimeUnlocks(
    ensure_neighbourhood(assertRuntimeMap(deserializeGameState(decoded.core, authored))),
  );
  const stallMenus = resolveStallMenus(decoded.menus ?? {}, {
    ...stallMenuProgression(loadedCore),
    slotBonuses: stallMenuSlotBonuses(loadedCore),
  });
  const resolvedVariants = resolvePersistedDishVariants(
    decoded.variants,
    decoded.nutritionDataVersion,
    loadedCore,
  );
  const is_incomplete_runtime_v2 =
    decoded.runtimeSchemaVersion === RUNTIME_SCHEMA_VERSION &&
    (decoded.variants === undefined || decoded.nutritionDataVersion === undefined);
  const activeDishVariants = resolvedVariants.selections;
  const catalog = layer_catalog(authored, activeDishVariants, stallMenus);
  return {
    state: { ...loadedCore, catalog },
    catalog,
    stallMenus,
    activeDishVariants,
    isRecovered: resolvedVariants.recovered || is_incomplete_runtime_v2,
  };
}
