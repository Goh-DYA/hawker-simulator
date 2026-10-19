/**
 * Game state construction and copying: the default simulation config, `createNewGame`
 * with its validation of the starting world, the deep-copy helpers, undo snapshots, and
 * the read-only `GameSnapshot` projection.
 *
 * The copy helpers keep the key order of their sources, because the digests serialise
 * state in key order.
 */
import { getUnlockedDefinitionIds, STARTING_REPUTATION } from "./economy";
import { getBlockedTileKeys, getTile, pointKey, validatePlacement } from "./grid";
import { validateWorldNavigationAccess } from "./navigation";
import { isReachable } from "./pathfinding";
import { validateConfiguredQueuePath } from "./queueing";
import { hashSeed } from "./rng";
import { compareIds } from "./ordering";
import { PERSISTENT_SCHEMA_VERSION } from "./enums";
import { createDailyObjectives } from "./progression";
import { clone_neighbourhood, create_neighbourhood } from "./neighbourhood";
import {
  cloneNutritionMetrics,
  cloneNutritionProfile,
  createEmptyNutritionMetrics,
} from "./nutrition";
import type {
  Customer,
  GameSnapshot,
  GameState,
  GridMap,
  GridPoint,
  NewGameOptions,
  PlacedObject,
  QualitySettings,
  SimulationConfig,
  SimulationConfigOverrides,
  SimulationMetrics,
  UndoSnapshot,
  AccessPoint,
} from "./types";
import { assertValidCatalog, isValidSimulationId } from "./validation";

/**
 * The simulation config used when `NewGameOptions.config` overrides nothing: a 100 ms (10 Hz) fixed
 * step and the standard and lower-end step caps.
 */
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  fixedStepMs: 100,
  spawnIntervalMs: 2_500,
  stuckRecoveryMs: 3_000,
  maxVisitMs: 120_000,
  reputationGainPerVisit: 0.02,
  expansionBaseCostPerTile: 5,
  expansionCostGrowth: 1.35,
  buildUndoWindowMs: 5_000,
  standard: { maxFixedStepsPerAdvance: 40 },
  lowerEnd: { maxFixedStepsPerAdvance: 20 },
};

function mergeConfig(config: SimulationConfigOverrides | undefined): SimulationConfig {
  const merged: SimulationConfig = {
    ...DEFAULT_SIMULATION_CONFIG,
    ...config,
    standard: { ...DEFAULT_SIMULATION_CONFIG.standard, ...config?.standard },
    lowerEnd: { ...DEFAULT_SIMULATION_CONFIG.lowerEnd, ...config?.lowerEnd },
  };
  for (const [name, value] of [
    ["fixedStepMs", merged.fixedStepMs],
    ["spawnIntervalMs", merged.spawnIntervalMs],
    ["stuckRecoveryMs", merged.stuckRecoveryMs],
    ["maxVisitMs", merged.maxVisitMs],
    ["expansionBaseCostPerTile", merged.expansionBaseCostPerTile],
    ["expansionCostGrowth", merged.expansionCostGrowth],
    ["buildUndoWindowMs", merged.buildUndoWindowMs],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`);
  }
  if (!Number.isFinite(merged.reputationGainPerVisit) || merged.reputationGainPerVisit < 0) {
    throw new RangeError("reputationGainPerVisit must be non-negative");
  }
  for (const [name, settings] of [["standard", merged.standard], ["lowerEnd", merged.lowerEnd]] as const) {
    if (!Number.isInteger(settings.maxFixedStepsPerAdvance) || settings.maxFixedStepsPerAdvance <= 0) {
      throw new RangeError(`${name}.maxFixedStepsPerAdvance must be a positive integer`);
    }
  }
  return merged;
}

function assertValidMap(map: GridMap): void {
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width <= 0 || map.height <= 0) {
    throw new RangeError("Map dimensions must be positive integers");
  }
  if (map.tiles.length !== map.width * map.height) throw new RangeError("Map tile count is invalid");
}

const EMPTY_METRICS: SimulationMetrics = {
  spawnedCustomers: 0,
  despawnedCustomers: 0,
  completedCustomers: 0,
  pathRequests: 0,
  pathFailures: 0,
  recoveredTargets: 0,
  trayReturns: 0,
  visitRatings: [],
  nutrition: createEmptyNutritionMetrics(),
};

function initialAccessPoints(options: NewGameOptions): readonly AccessPoint[] {
  const supplied = options.accessPoints?.map((point) => ({
    ...point,
    position: { ...point.position },
  }));
  if (supplied?.length) return supplied;
  if (!options.entrance || !options.exit) {
    throw new RangeError("At least one entrance and one exit are required");
  }
  return [
    { id: "entrance-1", kind: "entrance", position: { ...options.entrance } },
    { id: "exit-1", kind: "exit", position: { ...options.exit } },
  ];
}

function initialRouteGuidePoints(options: NewGameOptions): readonly GridPoint[] {
  const points = options.routeGuidePoints ?? [];
  const seen = new Set<string>();
  const normalized = points.map((point, index) => {
    if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
      throw new RangeError(`Route guide point ${index + 1} must use integer coordinates`);
    }
    if (
      point.x <= 0 ||
      point.y <= 0 ||
      point.x >= options.map.width - 1 ||
      point.y >= options.map.height - 1
    ) {
      throw new RangeError(`Route guide point ${pointKey(point)} must be inside the map boundary`);
    }
    if (getTile(options.map, point) !== "floor") {
      throw new RangeError(`Route guide point ${pointKey(point)} must be on a floor tile`);
    }
    const key = pointKey(point);
    if (seen.has(key)) throw new RangeError(`Route guide point ${key} is repeated`);
    seen.add(key);
    return { ...point };
  });
  return normalized.sort((left, right) => left.y - right.y || left.x - right.x);
}

/**
 * Creates a validated new game: a fresh economy and progression, empty queues for each stall, a
 * seeded RNG, and the first day's objectives.
 *
 * @param options - The map, catalog, access points, starting objects, route guides, config
 *   overrides, seed and starting currency.
 * @returns The new game state.
 * @throws CatalogValidationError When the catalog is invalid.
 * @throws RangeError When the map, config, access points, route guides, starting objects, their
 *   queues, the navigation between entrances and exits, or the starting currency is invalid.
 */
export function createNewGame(options: NewGameOptions): GameState {
  assertValidCatalog(options.catalog);
  assertValidMap(options.map);
  const accessPoints = initialAccessPoints(options);
  const entrances = accessPoints.filter((point) => point.kind === "entrance");
  const exits = accessPoints.filter((point) => point.kind === "exit");
  if (entrances.length === 0 || exits.length === 0) throw new RangeError("At least one entrance and one exit are required");
  if (new Set(accessPoints.map((point) => point.id)).size !== accessPoints.length) {
    throw new RangeError("Access point ids must be unique");
  }
  if (accessPoints.some((point) => point.position.x !== 0 && point.position.y !== 0 && point.position.x !== options.map.width - 1 && point.position.y !== options.map.height - 1)) {
    throw new RangeError("Access points must be on the map boundary");
  }
  if (accessPoints.some((point) => getTile(options.map, point.position) !== "floor")) {
    throw new RangeError("Entrance and exit must be floor tiles inside the map");
  }
  if (entrances.some((entrance) => !exits.some((exit) => isReachable(options.map, entrance.position, exit.position)))) {
    throw new RangeError("Entrance and exit must be connected by floor tiles");
  }
  const entrance = entrances[0]!.position;
  const exit = exits[0]!.position;
  const routeGuidePoints = initialRouteGuidePoints(options);
  const reservedPoints = [
    ...accessPoints.map((point) => point.position),
    ...routeGuidePoints,
  ];
  if (!Number.isFinite(options.startingCurrency ?? 1_000) || (options.startingCurrency ?? 1_000) < 0) {
    throw new RangeError("Starting currency must be non-negative");
  }

  const objects: Record<string, PlacedObject> = {};
  for (const source of options.initialObjects ?? []) {
    if (!isValidSimulationId(source.id)) throw new RangeError(`Invalid initial object id: ${source.id}`);
    if (objects[source.id]) throw new RangeError(`Duplicate initial object id: ${source.id}`);
    const object = clonePlacedObject(source);
    const validation = validatePlacement(options.map, objects, options.catalog, object, {
      reservedPoints,
    });
    if (!validation.valid) throw new RangeError(`Invalid initial object ${object.id}: ${validation.reasons.join("; ")}`);
    objects[object.id] = object;
  }
  const blocked = getBlockedTileKeys(objects, options.catalog);
  const blockedGuide = routeGuidePoints.find((point) => blocked.has(pointKey(point)));
  if (blockedGuide) {
    throw new RangeError(`Route guide point ${pointKey(blockedGuide)} is blocked by an initial object`);
  }
  for (const object of Object.values(objects)) {
    if (object.queuePath === undefined) continue;
    const queueValidation = validateConfiguredQueuePath(
      options.map,
      objects,
      options.catalog,
      object,
      object.queuePath,
      reservedPoints,
    );
    if (!queueValidation.valid) {
      throw new RangeError(`Invalid initial queue for ${object.id}: ${queueValidation.reasons.join("; ")}`);
    }
  }
  const navigationError = validateWorldNavigationAccess(options.map, accessPoints, objects, options.catalog);
  if (navigationError) throw new RangeError(`Invalid initial world navigation: ${navigationError}`);

  const initialLevel = 1;
  const state: GameState = {
    schemaVersion: PERSISTENT_SCHEMA_VERSION,
    map: cloneMap(options.map),
    accessPoints,
    routeGuidePoints,
    entrance: { ...entrance },
    exit: { ...exit },
    catalog: options.catalog,
    config: mergeConfig(options.config),
    qualityMode: options.qualityMode ?? "standard",
    objects,
    customers: {},
    queues: Object.fromEntries(
      Object.values(objects)
        .filter((object) => options.catalog.placeables[object.definitionId]?.kind === "stall")
        .map((object) => [object.id, []]),
    ),
    seatReservations: {},
    unclearedTrays: {},
    economy: {
      currency: options.startingCurrency ?? 1_000,
      lifetimeRevenue: 0,
      lifetimeSpend: 0,
      completedVisits: 0,
      abandonedVisits: 0,
    },
    progression: {
      xp: 0,
      level: initialLevel,
      reputation: STARTING_REPUTATION,
      peakReputation: STARTING_REPUTATION,
      unlockedDefinitionIds: getUnlockedDefinitionIds(
        options.catalog,
        initialLevel,
        options.initiallyUnlockedDefinitionIds,
      ),
      expansionCount: 0,
      focusDay: 0,
      dailyObjectives: [],
      claimedMilestoneIds: [],
      stallMastery: {},
    },
    rngState: hashSeed(options.seed ?? "hawker-simulator"),
    nextCustomerSequence: 1,
    spawnCountdownMs: 0,
    accumulatorMs: 0,
    tick: 0,
    elapsedMs: 0,
    arrivalPerformancePressure: 0,
    undoStack: [],
    metrics: { ...EMPTY_METRICS, nutrition: createEmptyNutritionMetrics() },
    events: [],
  };
  const started: GameState = {
    ...state,
    progression: {
      ...state.progression,
      focusDay: 1,
      dailyObjectives: createDailyObjectives(state, 1),
    },
  };
  return options.worldSeed === undefined
    ? started
    : { ...started, neighbourhood: create_neighbourhood(started, options.worldSeed) };
}

/**
 * Deep-copies a map, including its origin and tiles.
 *
 * @param map - The map to copy.
 * @returns The copy.
 */
export function cloneMap(map: GridMap): GridMap {
  return { ...map, worldOrigin: { ...map.worldOrigin }, tiles: [...map.tiles] };
}

/**
 * Deep-copies a placed object, including its origin and authored queue path.
 *
 * @param object - The object to copy.
 * @returns The copy.
 */
export function clonePlacedObject(object: PlacedObject): PlacedObject {
  return {
    ...object,
    origin: { ...object.origin },
    queuePath: object.queuePath?.map((point) => ({ ...point })),
  };
}

/**
 * Deep-copies a customer, including its position, path, health conditions and ordered nutrition
 * profile.
 *
 * @param customer - The customer to copy.
 * @returns The copy.
 */
export function cloneCustomer(customer: Customer): Customer {
  return {
    ...customer,
    position: { ...customer.position },
    path: customer.path.map((point) => ({ ...point })),
    healthConditions: [...customer.healthConditions],
    orderedNutritionProfile: cloneNutritionProfile(customer.orderedNutritionProfile),
  };
}

/**
 * Deep-copies progression so a draft or snapshot can change it without aliasing `source`.
 *
 * @param progression - The progression state to copy.
 * @returns A copy with fresh arrays, objectives and stall mastery entries, in the same key order.
 */
export function clone_progression(progression: GameState["progression"]): GameState["progression"] {
  return {
    ...progression,
    unlockedDefinitionIds: [...progression.unlockedDefinitionIds],
    dailyObjectives: progression.dailyObjectives.map((objective) => ({ ...objective })),
    claimedMilestoneIds: [...progression.claimedMilestoneIds],
    stallMastery: Object.fromEntries(Object.entries(progression.stallMastery).map(([id, mastery]) => [id, { ...mastery }])),
  };
}

/**
 * Deep-copies visit ratings, including each rating's component breakdown.
 *
 * @param visitRatings - The visit ratings to copy.
 * @returns A new array of copied ratings in the same order.
 */
export function clone_visit_ratings(visitRatings: SimulationMetrics["visitRatings"]): SimulationMetrics["visitRatings"] {
  return visitRatings.map((rating) => ({
    ...rating,
    components: { ...rating.components },
  }));
}

/**
 * Deep-copies every simulation metric, including runtime-only counters.
 *
 * Persistence must not use this: a save keeps only an explicit subset of the metrics.
 *
 * @param metrics - The metrics to copy.
 * @returns A copy whose keys keep the order of `metrics`.
 */
export function clone_metrics(metrics: SimulationMetrics): SimulationMetrics {
  return {
    ...metrics,
    visitRatings: clone_visit_ratings(metrics.visitRatings),
    nutrition: cloneNutritionMetrics(metrics.nutrition),
  };
}

/**
 * Deep-copies access points, including each point's position.
 *
 * @param accessPoints - The access points to copy.
 * @returns A new array of copied access points in the same order.
 */
export function clone_access_points(accessPoints: readonly AccessPoint[]): AccessPoint[] {
  return accessPoints.map((point) => ({ ...point, position: { ...point.position } }));
}

/**
 * Selects the quality settings for the state's current quality mode.
 *
 * @param state - The game state whose `qualityMode` and config are read.
 * @returns `config.standard` in standard mode, otherwise `config.lowerEnd`.
 */
export function get_quality_settings(state: GameState): QualitySettings {
  return state.qualityMode === "standard" ? state.config.standard : state.config.lowerEnd;
}

/**
 * Converts the build-undo window from milliseconds to whole simulation ticks.
 *
 * @param config - The simulation config holding the undo window and fixed step.
 * @returns The undo window in ticks, rounded up.
 */
export function compute_undo_window_ticks(config: SimulationConfig): number {
  return Math.ceil(config.buildUndoWindowMs / config.fixedStepMs);
}

/**
 * Captures the parts of the state that a build undo restores: the map, access points, route guides,
 * objects, economy, expansion count and XP.
 *
 * @param state - The state before the build command.
 * @returns A deep copy of those parts.
 */
export function captureUndoSnapshot(state: GameState): UndoSnapshot {
  return {
    map: cloneMap(state.map),
    accessPoints: clone_access_points(state.accessPoints),
    routeGuidePoints: state.routeGuidePoints.map((point) => ({ ...point })),
    entrance: { ...state.entrance },
    exit: { ...state.exit },
    objects: Object.fromEntries(Object.entries(state.objects).map(([id, object]) => [id, clonePlacedObject(object)])),
    economy: { ...state.economy },
    expansionCount: state.progression.expansionCount,
    xp: state.progression.xp,
  };
}

/**
 * Projects the state into a read-only snapshot for the UI and saves, with objects and customers
 * sorted by ID.
 *
 * @param state - The state to project.
 * @returns A deep-copied snapshot.
 */
export function createSnapshot(state: GameState): GameSnapshot {
  const objects = Object.values(state.objects).map(clonePlacedObject).sort((a, b) => compareIds(a.id, b.id));
  const customers = Object.values(state.customers).map(cloneCustomer).sort((a, b) => compareIds(a.id, b.id));
  return {
    schemaVersion: PERSISTENT_SCHEMA_VERSION,
    tick: state.tick,
    elapsedMs: state.elapsedMs,
    map: cloneMap(state.map),
    accessPoints: clone_access_points(state.accessPoints),
    routeGuidePoints: state.routeGuidePoints.map((point) => ({ ...point })),
    qualityMode: state.qualityMode,
    entrance: { ...state.entrance },
    exit: { ...state.exit },
    objects,
    customers,
    queues: Object.fromEntries(Object.entries(state.queues).map(([id, queue]) => [id, [...queue]])),
    seatReservations: { ...state.seatReservations },
    neighbourhood: state.neighbourhood ? clone_neighbourhood(state.neighbourhood) : undefined,
    unclearedTrays: Object.fromEntries(
      Object.entries(state.unclearedTrays).map(([key, tray]) => [key, { ...tray }]),
    ),
    economy: { ...state.economy },
    progression: clone_progression(state.progression),
    metrics: clone_metrics(state.metrics),
    canUndo: state.undoStack.length > 0,
    events: state.events.map((event) => ({ ...event })),
  };
}
