/**
 * Save serialisation, migration and validated deserialisation for the simulation core.
 *
 * This is the public entry of the persistence folder. Field readers live in `fields.ts`,
 * section parsers in `parsers.ts`, per-version parsing and migration in `migrations.ts`,
 * and catalog recovery of objects and unlocks in `recovery.ts`.
 */
import { getUnlockedDefinitionIds } from "../economy";
import { PERSISTENT_SCHEMA_VERSION } from "../enums";
import { normalizeBoundaryOpenings } from "../grid";
import { clone_visit_ratings, createNewGame } from "../state";
import { compareIds } from "../ordering";
import { cloneNutritionMetrics } from "../nutrition";
import { clone_neighbourhood } from "../neighbourhood";
import type {
  AnyPersistentGameState,
  GameState,
  PersistentGameStateV5,
  SimulationCatalog,
  SimulationConfigOverrides,
} from "../types";
import { PersistenceError, isRecord } from "./fields";
import { migratePersistentState } from "./migrations";
import { normalizeObjects, normalizeUnlocks } from "./recovery";

export { PERSISTENT_SCHEMA_VERSION } from "../enums";
export { PersistenceError } from "./fields";
export { migratePersistentState } from "./migrations";

/**
 * Options for loading a save against a catalog that may have changed since it was written.
 */
export interface DeserializeOptions {
  readonly config?: SimulationConfigOverrides;
  /** Explicit content migrations, keyed by an ID present in the save. */
  readonly definitionIdAliases?: Readonly<Record<string, string>>;
  /** Explicit compensation for intentionally removed content. */
  readonly removedDefinitionRefunds?: Readonly<Record<string, number>>;
}

/**
 * What a load changed to fit the current catalog.
 */
export interface PersistenceRecoveryReport {
  readonly warnings: readonly string[];
  readonly remappedObjectIds: Readonly<Record<string, string>>;
  readonly removedObjectIds: readonly string[];
  readonly currencyRefunded: number;
}

/**
 * A loaded game state together with its recovery report.
 */
export interface DeserializeResult {
  readonly state: GameState;
  readonly recovery: PersistenceRecoveryReport;
}

/**
 * Copies the saved subset of a game state into a current-version persistent state.
 *
 * Objects are ordered by ID with `compareIds`. Runtime-only data (customers, queues,
 * reservations and uncleared trays) is not saved; a centre without a neighbourhood saves `null`.
 *
 * @param state - The game state to save.
 * @returns A deep copy of the persisted fields.
 */
export function persistentStateFromGame(state: GameState): PersistentGameStateV5 {
  return {
    schemaVersion: PERSISTENT_SCHEMA_VERSION,
    savedAtTick: state.tick,
    map: {
      ...state.map,
      worldOrigin: { ...state.map.worldOrigin },
      tiles: [...state.map.tiles],
    },
    accessPoints: state.accessPoints.map((point) => ({ ...point, position: { ...point.position } })),
    routeGuidePoints: state.routeGuidePoints.map((point) => ({ ...point })),
    qualityMode: state.qualityMode,
    objects: Object.values(state.objects)
      .sort((a, b) => compareIds(a.id, b.id))
      .map((object) => ({
        ...object,
        origin: { ...object.origin },
        queuePath: object.queuePath?.map((point) => ({ ...point })),
      })),
    economy: { ...state.economy },
    progression: {
      ...state.progression,
      unlockedDefinitionIds: [...state.progression.unlockedDefinitionIds],
      dailyObjectives: state.progression.dailyObjectives.map((objective) => ({ ...objective })),
      claimedMilestoneIds: [...state.progression.claimedMilestoneIds],
      stallMastery: Object.fromEntries(Object.entries(state.progression.stallMastery).map(([id, mastery]) => [id, { ...mastery }])),
    },
    metrics: {
      trayReturns: state.metrics.trayReturns,
      visitRatings: clone_visit_ratings(state.metrics.visitRatings),
      nutrition: cloneNutritionMetrics(state.metrics.nutrition),
    },
    rngState: state.rngState,
    neighbourhood: state.neighbourhood ? clone_neighbourhood(state.neighbourhood) : null,
    nextCustomerSequence: state.nextCustomerSequence,
    elapsedMs: state.elapsedMs,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

/**
 * Serialises a game state to JSON with recursively sorted keys.
 *
 * @param state - The game state to save.
 * @returns The canonical JSON save string.
 */
export function serializeGameState(state: GameState): string {
  return JSON.stringify(canonicalize(persistentStateFromGame(state)));
}

/**
 * Loads a save of any supported version into a playable game state.
 *
 * @param serialized - A JSON save string, or an already decoded save object.
 * @param catalog - The simulation catalog to validate the save against.
 * @param options - Config overrides and explicit content migrations.
 * @returns The game state and a report of every recovery applied.
 * @throws PersistenceError When the save is invalid JSON, malformed, unsupported or cannot be normalised into a playable map.
 */
export function deserializeGameStateWithReport(
  serialized: string | AnyPersistentGameState | unknown,
  catalog: SimulationCatalog,
  options: DeserializeOptions = {},
): DeserializeResult {
  let raw: unknown = serialized;
  if (typeof serialized === "string") {
    try {
      raw = JSON.parse(serialized) as unknown;
    } catch (error) {
      throw new PersistenceError("Save data is not valid JSON", { cause: error });
    }
  }
  const save = migratePersistentState(raw);
  const normalized = normalizeObjects(save, catalog, options);
  const normalizedMap = normalizeBoundaryOpenings(
    save.map,
    save.accessPoints.map((point) => point.position),
  );
  const normalizedUnlocks = normalizeUnlocks(save.progression.unlockedDefinitionIds, catalog, options);
  const recovery: PersistenceRecoveryReport = {
    ...normalized.recovery,
    warnings: [...normalized.recovery.warnings, ...normalizedUnlocks.warnings],
  };
  const recoveredEconomy = {
    ...save.economy,
    currency: save.economy.currency + normalized.recovery.currencyRefunded,
  };
  let base: GameState;
  try {
    base = createNewGame({
      map: normalizedMap,
      accessPoints: save.accessPoints,
      routeGuidePoints: save.routeGuidePoints,
      catalog,
      seed: save.rngState,
      startingCurrency: recoveredEconomy.currency,
      qualityMode: save.qualityMode,
      config: options.config,
      initialObjects: normalized.objects,
      initiallyUnlockedDefinitionIds: normalizedUnlocks.ids,
    });
  } catch (error) {
    throw new PersistenceError("Save data could not be normalized into a playable map", { cause: error });
  }
  const unlockedDefinitionIds = getUnlockedDefinitionIds(
    catalog,
    save.progression.level,
    normalizedUnlocks.ids,
  );
  const state: GameState = {
    ...base,
    economy: recoveredEconomy,
    progression: { ...save.progression, unlockedDefinitionIds },
    rngState: save.rngState,
    ...(save.neighbourhood ? { neighbourhood: clone_neighbourhood(save.neighbourhood) } : {}),
    nextCustomerSequence: save.nextCustomerSequence,
    tick: save.savedAtTick,
    elapsedMs: save.elapsedMs,
    metrics: {
      ...base.metrics,
      trayReturns: save.metrics.trayReturns,
      visitRatings: save.metrics.visitRatings,
      nutrition: cloneNutritionMetrics(save.metrics.nutrition),
    },
    spawnCountdownMs: 0,
    accumulatorMs: 0,
    undoStack: [],
    events: [],
  };
  return { state, recovery };
}

/**
 * Loads a save of any supported version into a playable game state, discarding the recovery report.
 *
 * @param serialized - A JSON save string, or an already decoded save object.
 * @param catalog - The simulation catalog to validate the save against.
 * @param options - Config overrides and explicit content migrations.
 * @returns The game state.
 * @throws PersistenceError When the save cannot be loaded.
 */
export function deserializeGameState(
  serialized: string | AnyPersistentGameState | unknown,
  catalog: SimulationCatalog,
  options: DeserializeOptions = {},
): GameState {
  return deserializeGameStateWithReport(serialized, catalog, options).state;
}
