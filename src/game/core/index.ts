/**
 * Public API of the pure, deterministic simulation core.
 *
 * Only names consumed outside `src/game/core` (the runtime, the app and the tests) are
 * re-exported here, grouped by the module that defines them. Everything else stays
 * exported from its own module for use inside core, and code that needs such an internal
 * imports that module directly.
 */
export type * from "./types";

/** Ordered vocabulary tuples that the core unions are derived from. */
export {
  HEALTH_CONDITIONS,
  NUTRITION_INTENTS,
  NUTRITION_METRICS,
  NUTRITION_OBJECTIVE_CRITERIA,
  NUTRITION_UNAVAILABLE_REASONS,
  OBJECTIVE_KINDS,
  QUALITY_MODES,
  QUEUE_DIRECTIONS,
  ROTATIONS,
  TILE_KINDS,
  VISIT_RATING_COMPONENT_KEYS,
} from "./enums";

/** Deterministic hashing shared by seeds and save checksums. */
export { compute_fnv1a32 } from "./rng";

/** Grid geometry, tile access, footprints and placement validation. */
export {
  createGridMap,
  getBlockedTileKeys,
  getObjectOccupiedTiles,
  getObjectQueueAnchor,
  getOccupiedTiles,
  getSeatLocations,
  getTile,
  pointKey,
  rotatePoint,
  rotatedFootprint,
  tileToWorld,
  validatePlacement,
  withTile,
  worldToTile,
} from "./grid";

/** Deterministic A* pathfinding over the tile grid. */
export { findPath } from "./pathfinding";

/** Stall queue layout planning. */
export {
  get_navigation_reserved_points,
  getStallQueueCells,
  planStallQueueLayouts,
  type StallQueueLayouts,
} from "./queueing";

/** Utility placeables: influence, wayfinding and meal duration effects. */
export {
  adjustedEatingDurationMs,
  getGlobalWayfinding,
  getUtilityInfluence,
  mealConsumptionFraction,
  utilitySatisfactionBonus,
} from "./utility";

/** Sales, expansion costs and levelling. */
export { applySale, calculateExpansionCost, calculateLevel, xpRequiredForLevel } from "./economy";

/** Operating day clock, objectives, visit ratings and stall upgrades. */
export {
  MILESTONE_TRACKS,
  OPERATING_DAY_MS,
  UPGRADE_RANK_REQUIREMENTS,
  averageVisitRating,
  createDailyObjectives,
  distinctOpenStallTypes,
  effectiveStallDefinition,
  operatingMinuteOfDay,
} from "./progression";

/** Catalog validation. */
export { validateCatalog } from "./validation";

/** New-game creation and snapshots. */
export { createNewGame, createSnapshot } from "./state";

/** Player command dispatch. */
export { dispatchCommand } from "./commands";

/** Visit rating weights and walking satisfaction scoring. */
export { VISIT_RATING_WEIGHTS, walkingSatisfactionScore } from "./satisfaction";

/** Nutrition intents, health conditions and the dish and stall choice bonuses they drive. */
export {
  bestEnabledNutritionIntentFit,
  createEmptyNutritionMetrics,
  healthConditionFromRoll,
  healthConditionRating,
  healthDishChoiceBonus,
  healthImpactFromRating,
  healthPreferenceResultForRating,
  nutritionDishChoiceBonus,
  nutritionIntentFromRoll,
  nutritionRequestResult,
  nutritionStallChoiceBonus,
  personalizedHealthRating,
} from "./nutrition";

/** Fixed-step simulation. */
export { advanceSimulation, stepSimulation } from "./simulation";

/** Customer arrival weighting. */
export { customerArchetypeSpawnWeight } from "./arrivals";

/** Customer stall and dish choice. */
export { boundedDishDemandAppeal } from "./choices";

/** Determinism digests and invariant checks. */
export { assertSimulationInvariants, simulationDigest, stateDigest } from "./diagnostics";

/** Save serialisation, migration and validated deserialisation. */
export {
  PersistenceError,
  deserializeGameState,
  deserializeGameStateWithReport,
  migratePersistentState,
  persistentStateFromGame,
  serializeGameState,
  type DeserializeOptions,
} from "./persistence";
