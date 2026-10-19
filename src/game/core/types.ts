/** Pure simulation-domain types. Rendering and UI state intentionally live elsewhere. */

import type {
  DEPARTURE_REASONS,
  HEALTH_CONDITIONS,
  NUTRITION_INTENTS,
  NUTRITION_METRICS,
  NUTRITION_OBJECTIVE_CRITERIA,
  NUTRITION_UNAVAILABLE_REASONS,
  OBJECTIVE_KINDS,
  PERSISTENT_SCHEMA_VERSION,
  QUALITY_MODES,
  QUEUE_DIRECTIONS,
  ROTATIONS,
  TILE_KINDS,
} from "./enums";

/** A tile position in map coordinates, with x to the right and y downwards. */
export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

/** Whether an access point admits guests or lets them leave. */
export type AccessPointKind = "entrance" | "exit";

/** An entrance or exit on the map boundary. */
export interface AccessPoint {
  readonly id: string;
  readonly kind: AccessPointKind;
  readonly position: GridPoint;
}

/** A position in world (pixel) coordinates. */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** A supported clockwise rotation in degrees: 0, 90, 180 or 270. */
export type Rotation = (typeof ROTATIONS)[number];
/** The kind of a map tile; only `floor` can be walked on or built on. */
export type TileKind = (typeof TILE_KINDS)[number];
/** The simulation quality mode, which selects the per-mode settings in `SimulationConfig`. */
export type QualityMode = (typeof QUALITY_MODES)[number];
/** A cardinal direction for an automatically planned queue. */
export type QueueDirection = (typeof QUEUE_DIRECTIONS)[number];

/** The tiles an unrotated placeable covers. */
export interface Footprint {
  readonly width: number;
  readonly height: number;
  /** Missing cells means a full width-by-height rectangle. */
  readonly cells?: readonly GridPoint[];
}

/** The hall's tile map: its size, tile size, world origin and row-major tiles. */
export interface GridMap {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly worldOrigin: WorldPoint;
  /** Row-major and always width * height entries long. */
  readonly tiles: readonly TileKind[];
}

/**
 * A dish as the simulation sees it: price, timings, quality, ratings, preference tags, gates and
 * nutrition variants.
 */
export interface DishDefinition {
  readonly id: string;
  readonly price: number;
  readonly preparationMs: number;
  readonly eatingMs: number;
  readonly quality: number;
  /** Authored taste and popularity rating in the inclusive 1-5 range. */
  readonly starRating?: number;
  /** Authored relative appeal in the inclusive 0-1 range. */
  readonly baseDemand?: number;
  readonly preferenceTags?: readonly string[];
  /** Optional progression gates used when evaluating nutrition-intent availability. */
  readonly unlockLevel?: number;
  readonly unlockReputation?: number;
  /** Reviewed nutrition variants. The runtime selects exactly one active variant. */
  readonly nutritionVariants?: readonly NutritionVariant[];
  readonly defaultNutritionVariantId?: string;
  readonly activeNutritionVariantId?: string;
}

/**
 * The stall behaviour of a placeable: its menu, service timings, capacities, appeal and upgrade
 * ladder.
 */
export interface StallDefinition {
  readonly dishIds: readonly string[];
  /** Full authored menu, retained when dishIds is narrowed to the active menu. */
  readonly allDishIds?: readonly string[];
  readonly orderMs: number;
  readonly preparationCapacity: number;
  readonly queueCapacity: number;
  readonly popularity: number;
  readonly quality: number;
  readonly menuSlots?: number;
  readonly upgradeLevels?: readonly StallUpgradeDefinition[];
}

/** One level of a stall's upgrade ladder and the changes it applies. */
export interface StallUpgradeDefinition {
  readonly level: 2 | 3 | 4;
  readonly cost: number;
  readonly serviceTimeMultiplier: number;
  readonly capacityBonus: number;
  readonly qualityBonus: number;
  readonly menuSlotsBonus: number;
}

/** The spatial effects a placeable has on guests within its radius. */
export interface UtilityEffects {
  readonly radius: number;
  readonly ambience: number;
  readonly cleanliness: number;
  readonly queuePatience: number;
  readonly eatingSpeed: number;
  readonly cleaningEfficiency: number;
  readonly movementSpeed: number;
  /** Directories, route signs, and menu previews reduce entrance-distance bias. */
  readonly wayfinding: number;
}

/** The gameplay role of a placeable definition. */
export type PlaceableKind =
  | "stall"
  | "seat"
  | "table"
  | "tray-return"
  | "facility"
  | "decoration";

/**
 * A placeable as the simulation sees it: footprint, rotations, collision, price, unlock,
 * interaction points, and optional stall and utility data.
 */
export interface PlaceableDefinition {
  readonly id: string;
  readonly kind: PlaceableKind;
  readonly footprint: Footprint;
  readonly allowedRotations: readonly Rotation[];
  readonly blocksMovement: boolean;
  readonly price: number;
  readonly refundRate?: number;
  readonly unlockLevel?: number;
  /** Points are expressed relative to the unrotated footprint origin. */
  readonly servicePoint?: GridPoint;
  readonly queueAnchor?: GridPoint;
  readonly seatPoints?: readonly GridPoint[];
  readonly trayReturnPoint?: GridPoint;
  readonly stall?: StallDefinition;
  /** Spatial gameplay effects supplied by signs, facilities, comfort, and decor. */
  readonly utility?: UtilityEffects;
}

/**
 * A customer behaviour profile: budget, patience, speed, choice sensitivities, preferences,
 * progression gates and visit schedule.
 */
export interface CustomerArchetype {
  readonly id: string;
  readonly budget: number;
  readonly patienceMs: number;
  /** Tiles per simulated second. */
  readonly walkingSpeed: number;
  readonly priceSensitivity: number;
  readonly qualitySensitivity: number;
  readonly queueSensitivity: number;
  readonly distanceSensitivity: number;
  /** How willing this archetype is to explore a less-obvious stall. Zero disables exploration. */
  readonly noveltyPreference?: number;
  /**
   * Share of guests of this archetype who return their tray when a tray return is close enough.
   * Defaults to every guest.
   */
  readonly trayReturnChance?: number;
  readonly preferenceTags?: readonly string[];
  /** Optional progression gates. Reputation uses the core zero-to-five scale. */
  readonly unlockLevel?: number;
  readonly unlockReputation?: number;
  readonly unlockPrerequisiteIds?: readonly string[];
  readonly visitSchedule?: {
    readonly startHour: number;
    readonly endHour: number;
    readonly peakMultiplier: number;
  };
}

/** The definitions the simulation runs on, keyed by ID. */
export interface SimulationCatalog {
  readonly placeables: Readonly<Record<string, PlaceableDefinition>>;
  readonly dishes: Readonly<Record<string, DishDefinition>>;
  readonly archetypes: Readonly<Record<string, CustomerArchetype>>;
}

/** A placeable instance on the map, with its stall state and queue settings. */
export interface PlacedObject {
  readonly id: string;
  readonly definitionId: string;
  readonly origin: GridPoint;
  readonly rotation: Rotation;
  readonly open: boolean;
  /** Preferred world-space direction for an automatically planned queue. */
  readonly queueDirection?: QueueDirection;
  /**
   * Optional player-authored queue cells in head-to-tail order, expressed in
   * absolute map coordinates. When absent, the simulation plans a deterministic
   * obstacle-aware route from the stall's queue anchor.
   */
  readonly queuePath?: readonly GridPoint[];
}

/** The lifecycle states a customer moves through during a visit. */
export type CustomerStatus =
  | "choosing-stall"
  | "walking-to-queue"
  | "queued"
  | "ordering"
  | "waiting-for-food"
  | "seeking-seat"
  | "walking-to-seat"
  | "eating"
  | "seeking-tray-return"
  | "walking-to-tray-return"
  | "walking-to-exit";

/**
 * A guest in the hall: lifecycle state, movement, timers, targets, order, nutrition outcome and
 * rating inputs. Customers exist only at runtime and are not saved.
 */
export interface Customer {
  readonly id: string;
  readonly archetypeId: string;
  readonly status: CustomerStatus;
  readonly position: GridPoint;
  readonly path: readonly GridPoint[];
  readonly pathIndex: number;
  readonly movementProgress: number;
  readonly stateElapsedMs: number;
  readonly visitElapsedMs: number;
  /** Completed grid steps across the guest's full centre journey. */
  readonly walkingDistanceTiles: number;
  readonly patienceRemainingMs: number;
  readonly satisfaction: number;
  /** Visit-specific conditions assigned independently of customer archetype. */
  readonly healthConditions: readonly HealthCondition[];
  readonly sourceEntranceId?: string;
  readonly targetExitId?: string;
  readonly servedStallDefinitionId?: string;
  readonly ratingFactors?: Partial<VisitRatingComponents>;
  readonly ratingSettled?: boolean;
  readonly targetStallId?: string;
  readonly orderedDishId?: string;
  /** Fictional preference for this visit; it is never a diagnosis or demographic trait. */
  readonly nutritionIntentId?: NutritionIntent;
  /** Order-time values remain frozen when the player changes a stall recipe. */
  readonly orderedNutritionVariantId?: string;
  readonly orderedNutritionProfile?: NutritionProfile;
  readonly nutritionRequestResult?: NutritionRequestResult;
  /** Frozen condition-aware rating for the ordered nutrition variant. */
  readonly personalizedHealthRating?: number;
  /** Signed satisfaction delta applied for the ordered meal, from -0.2 to 0.2. */
  readonly healthImpact?: number;
  readonly healthPreferenceResult?: HealthPreferenceResult;
  readonly reservedSeatKey?: string;
  readonly targetTrayReturnId?: string;
  readonly hasTray: boolean;
  /** Why the guest is leaving, once a specific reason is known; settles the visit rating. */
  readonly departureReason?: DepartureReason;
  /** True once the order has been handed over, including a zero-price dish. */
  readonly served: boolean;
  readonly spent: number;
  readonly stuckMs: number;
}

/** The 0-100 component scores combined into a visit rating. */
export interface VisitRatingComponents {
  readonly foodQuality: number;
  readonly wait: number;
  readonly value: number;
  readonly walking: number;
  readonly comfort: number;
  readonly cleanliness: number;
  readonly ambience: number;
}

/** The settled rating of one finished visit. */
export interface VisitRating {
  readonly customerId: string;
  readonly walkingMetricVersion: 2;
  readonly score: number;
  readonly served: boolean;
  readonly abandoned: boolean;
  readonly reason: string;
  readonly stallDefinitionId?: string;
  readonly components: VisitRatingComponents;
  readonly day: number;
}

/** The kind of a daily objective, which selects how its progress is measured. */
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number];

/** Why a guest left, recorded on the visit rating. */
export type DepartureReason = (typeof DEPARTURE_REASONS)[number];

/**
 * A tray a guest left on their seat. The seat cannot be used until the table-cleaning crew has
 * cleared it. Uncleared trays exist only at runtime and are not saved.
 */
export interface UnclearedTray {
  /** Tick on which the tray was left, which orders the crew's work. */
  readonly leftAtTick: number;
  /** Crew time still needed to clear the tray, in simulated milliseconds. */
  readonly workRemainingMs: number;
}

/** What a nutrition objective counts. */
export type NutritionObjectiveCriterion = (typeof NUTRITION_OBJECTIVE_CRITERIA)[number];

/** One of the day's objectives, with its target, progress and reward. */
export interface DailyObjective {
  readonly id: string;
  readonly day: number;
  readonly kind: ObjectiveKind;
  readonly title: string;
  readonly description: string;
  readonly target: number;
  readonly progress: number;
  readonly startValue: number;
  readonly rewardCash: number;
  readonly rewardXp: number;
  readonly completed: boolean;
  readonly nutritionCriterion?: NutritionObjectiveCriterion;
}

/** A fictional nutrition request a guest can bring to a visit. */
export type NutritionIntent = (typeof NUTRITION_INTENTS)[number];

/**
 * A simplified health condition a guest can be assigned for a visit; a game trait, not a diagnosis.
 */
export type HealthCondition = (typeof HEALTH_CONDITIONS)[number];

/** Whether the served meal met a guest's health preference. */
export type HealthPreferenceResult = "matched" | "missed" | "unknown";

/** A nutrient tracked by nutrition profiles. */
export type NutritionMetric = (typeof NUTRITION_METRICS)[number];

/** One nutrient value: a known amount, a trace amount, or unavailable with a reason. */
export type NutritionValue =
  | { readonly status: "known"; readonly value: number }
  | { readonly status: "trace" }
  | {
      readonly status: "unavailable";
      readonly reason?: (typeof NUTRITION_UNAVAILABLE_REASONS)[number];
    };

/** The review status of a nutrition profile; only released profiles are used. */
export type NutritionProfileStatus = "released" | "unavailable" | "quarantined";
/** Whether a profile is rated among meals or among drinks. */
export type NutritionClass = "meal" | "drink";

/** The serving a profile's nutrient values refer to. */
export interface NutritionServing {
  readonly amount: number;
  readonly unit: "g" | "ml";
  readonly label: string;
}

/**
 * The nutrition data of one dish preparation: serving, nutrients, intent fits and health ratings.
 */
export interface NutritionProfile {
  readonly id: string;
  readonly dishId: string;
  readonly status: NutritionProfileStatus;
  readonly serving?: NutritionServing;
  readonly nutrients: Readonly<Record<NutritionMetric, NutritionValue>>;
  /** Precomputed relative fits among reviewed in-game meal or drink options. */
  readonly intentFits: Partial<Readonly<Record<NutritionIntent, number>>>;
  /** General balanced-meal rating in the inclusive 1-5 range. */
  readonly healthRating?: number;
  /** Condition-aware ratings in the inclusive 1-5 range. */
  readonly conditionRatings?: Partial<Readonly<Record<HealthCondition, number>>>;
  readonly nutritionClass: NutritionClass;
}

/** One reviewed preparation of a dish, with its unlock rank and profile. */
export interface NutritionVariant {
  readonly id: string;
  readonly label: string;
  readonly unlockRank: number;
  readonly profileId: string;
  readonly visualKey: string;
  readonly profile?: NutritionProfile;
}

/** Whether the served meal met a guest's nutrition intent. */
export type NutritionRequestResult = "matched" | "missed" | "unknown";

/** The nutrition result of one served meal, kept in the recent-outcomes list. */
export interface NutritionOutcome {
  readonly customerId: string;
  readonly day: number;
  readonly intentId?: NutritionIntent;
  readonly dishId: string;
  readonly variantId?: string;
  readonly result: NutritionRequestResult;
  readonly profile?: NutritionProfile;
}

/** Request, match, miss and unknown counts for one nutrition intent. */
export interface NutritionIntentMetrics {
  readonly requests: number;
  readonly matches: number;
  readonly misses: number;
  readonly unknowns: number;
}

/** Lifetime nutrition metrics, with today's metrics nested. */
export interface NutritionMetrics {
  readonly servedMeals: number;
  readonly profiledServings: number;
  readonly nonDefaultVariantServings: number;
  readonly intentRequests: number;
  readonly intentMatches: number;
  readonly intentMisses: number;
  readonly intentUnknowns: number;
  readonly byIntent: Readonly<Record<NutritionIntent, NutritionIntentMetrics>>;
  readonly nutrientTotals: Readonly<Record<NutritionMetric, number>>;
  readonly nutrientKnownCounts: Readonly<Record<NutritionMetric, number>>;
  readonly dishServings: Readonly<Record<string, number>>;
  readonly recentOutcomes: readonly NutritionOutcome[];
  readonly today: NutritionDailyMetrics;
}

/** Nutrition metrics for one operating day. */
export interface NutritionDailyMetrics {
  readonly day: number;
  readonly servedMeals: number;
  readonly profiledServings: number;
  readonly intentRequests: number;
  readonly intentMatches: number;
  readonly intentMisses: number;
  readonly intentUnknowns: number;
  readonly byIntent: Readonly<Record<NutritionIntent, NutritionIntentMetrics>>;
  readonly nutrientTotals: Readonly<Record<NutritionMetric, number>>;
  readonly nutrientKnownCounts: Readonly<Record<NutritionMetric, number>>;
  readonly dishServings: Readonly<Record<string, number>>;
}

/** A stall definition's mastery points, rank and upgrade level. */
export interface StallMasteryState {
  readonly points: number;
  readonly rank: number;
  readonly upgradeLevel: 1 | 2 | 3 | 4;
}

/** The centre's currency and lifetime economy counters. */
export interface EconomyState {
  readonly currency: number;
  readonly lifetimeRevenue: number;
  readonly lifetimeSpend: number;
  readonly completedVisits: number;
  readonly abandonedVisits: number;
}

/** XP, level, reputation, unlocks, expansions, daily objectives, milestones and stall mastery. */
export interface ProgressionState {
  readonly xp: number;
  readonly level: number;
  readonly reputation: number;
  readonly unlockedDefinitionIds: readonly string[];
  readonly expansionCount: number;
  readonly focusDay: number;
  readonly dailyObjectives: readonly DailyObjective[];
  readonly claimedMilestoneIds: readonly string[];
  readonly stallMastery: Readonly<Record<string, StallMasteryState>>;
}

/** Simulation counters and recent visit ratings; only an explicit subset is saved. */
export interface SimulationMetrics {
  readonly spawnedCustomers: number;
  readonly despawnedCustomers: number;
  readonly completedCustomers: number;
  readonly pathRequests: number;
  readonly pathFailures: number;
  readonly recoveredTargets: number;
  readonly trayReturns: number;
  readonly visitRatings: readonly VisitRating[];
  readonly nutrition: NutritionMetrics;
}

/** Per-quality-mode simulation settings. */
export interface QualitySettings {
  /**
   * Arrival-model switch, not a cap. When present, customers arrive at the fixed
   * `SimulationConfig.spawnIntervalMs` and the adaptive demand model is off; when absent,
   * the adaptive model scales the interval. The numeric value itself is never read.
   */
  readonly maxActiveCustomers?: number;
  readonly maxFixedStepsPerAdvance: number;
}

/** Simulation timing, cost and quality-mode settings. */
export interface SimulationConfig {
  readonly fixedStepMs: number;
  readonly spawnIntervalMs: number;
  readonly stuckRecoveryMs: number;
  readonly maxVisitMs: number;
  /** @deprecated Not read; visit reputation comes from settleVisitRating. */
  readonly reputationGainPerVisit: number;
  readonly expansionBaseCostPerTile: number;
  readonly expansionCostGrowth: number;
  readonly buildUndoWindowMs: number;
  readonly standard: QualitySettings;
  readonly lowerEnd: QualitySettings;
}

/** Partial overrides of `SimulationConfig`, including partial quality settings. */
export type SimulationConfigOverrides = Omit<Partial<SimulationConfig>, "standard" | "lowerEnd"> & {
  readonly standard?: Partial<QualitySettings>;
  readonly lowerEnd?: Partial<QualitySettings>;
};

/** An event emitted by a command or simulation step, for the activity feed and UI. */
export interface SimulationEvent {
  readonly type:
    | "command-applied"
    | "command-rejected"
    | "object-placed"
    | "object-moved"
    | "object-removed"
    | "customer-spawned"
    | "customer-state-changed"
    | "customer-despawned"
    | "sale-completed"
    | "level-up"
    | "target-recovered"
    | "objective-completed"
    | "milestone-completed"
    /** Never emitted: stall upgrades currently report through `command-applied`. */
    | "stall-upgraded";
  readonly tick: number;
  readonly entityId?: string;
  readonly message?: string;
  readonly amount?: number;
}

/** The parts of the state a build undo restores. */
export interface UndoSnapshot {
  readonly map: GridMap;
  readonly accessPoints: readonly AccessPoint[];
  readonly routeGuidePoints: readonly GridPoint[];
  readonly entrance: GridPoint;
  readonly exit: GridPoint;
  readonly objects: Readonly<Record<string, PlacedObject>>;
  readonly economy: EconomyState;
  readonly expansionCount: number;
  readonly xp: number;
}

/** One undoable build command, with its snapshot and economy deltas. */
export interface UndoEntry {
  readonly commandType: BuildCommand["type"];
  readonly snapshot: UndoSnapshot;
  /** Difference applied by the build command; undo subtracts these from live economy state. */
  readonly currencyDelta: number;
  readonly lifetimeSpendDelta: number;
  readonly expansionCountDelta: number;
  readonly createdAtTick: number;
}

/** The complete simulation state. It is immutable; commands and steps return a new state. */
export interface GameState {
  readonly schemaVersion: typeof PERSISTENT_SCHEMA_VERSION;
  readonly map: GridMap;
  readonly accessPoints: readonly AccessPoint[];
  readonly routeGuidePoints: readonly GridPoint[];
  /** Compatibility aliases for callers that have not migrated to accessPoints. */
  readonly entrance: GridPoint;
  readonly exit: GridPoint;
  readonly catalog: SimulationCatalog;
  readonly config: SimulationConfig;
  readonly qualityMode: QualityMode;
  readonly objects: Readonly<Record<string, PlacedObject>>;
  readonly customers: Readonly<Record<string, Customer>>;
  readonly queues: Readonly<Record<string, readonly string[]>>;
  readonly seatReservations: Readonly<Record<string, string>>;
  /** Trays left on seats, keyed by seat key; runtime-only like the reservations. */
  readonly unclearedTrays: Readonly<Record<string, UnclearedTray>>;
  readonly economy: EconomyState;
  readonly progression: ProgressionState;
  readonly rngState: number;
  readonly nextCustomerSequence: number;
  readonly spawnCountdownMs: number;
  readonly accumulatorMs: number;
  readonly tick: number;
  readonly elapsedMs: number;
  readonly arrivalPerformancePressure: number;
  readonly undoStack: readonly UndoEntry[];
  readonly metrics: SimulationMetrics;
  readonly events: readonly SimulationEvent[];
}

/** The inputs to `createNewGame`. */
export interface NewGameOptions {
  readonly map: GridMap;
  readonly entrance?: GridPoint;
  readonly exit?: GridPoint;
  readonly accessPoints?: readonly AccessPoint[];
  readonly routeGuidePoints?: readonly GridPoint[];
  readonly catalog: SimulationCatalog;
  readonly seed?: number | string;
  readonly startingCurrency?: number;
  readonly qualityMode?: QualityMode;
  readonly config?: SimulationConfigOverrides;
  readonly initialObjects?: readonly PlacedObject[];
  readonly initiallyUnlockedDefinitionIds?: readonly string[];
}

/** Places a new object. */
export interface PlaceObjectCommand {
  readonly type: "place-object";
  readonly objectId: string;
  readonly definitionId: string;
  readonly origin: GridPoint;
  readonly rotation?: Rotation;
}

/** Moves, and optionally rotates, a placed object. */
export interface MoveObjectCommand {
  readonly type: "move-object";
  readonly objectId: string;
  readonly origin: GridPoint;
  readonly rotation?: Rotation;
}

/** Rotates a placed object to its next allowed rotation, clockwise unless `clockwise` is false. */
export interface RotateObjectCommand {
  readonly type: "rotate-object";
  readonly objectId: string;
  readonly clockwise?: boolean;
}

/** Removes a placed object and refunds part of its price. */
export interface RemoveObjectCommand {
  readonly type: "remove-object";
  readonly objectId: string;
}

/** Buys extra columns on the right and rows at the bottom. */
export interface ExpandMapCommand {
  readonly type: "expand-map";
  readonly addColumns: number;
  readonly addRows: number;
}

/** Sets a stall's authored queue route. */
export interface ConfigureQueueCommand {
  readonly type: "configure-queue";
  readonly objectId: string;
  /** Absolute queue cells in head-to-tail order. */
  readonly points: readonly GridPoint[];
}

/** Sets the direction of a stall's automatic queue. */
export interface SetStallQueueDirectionCommand {
  readonly type: "set-stall-queue-direction";
  readonly objectId: string;
  readonly direction: QueueDirection;
}

/** Replaces the preferred guest route tiles. */
export interface ConfigureGuestRouteCommand {
  readonly type: "configure-guest-route";
  readonly points: readonly GridPoint[];
}

/** Adds an entrance or exit on the boundary. */
export interface AddAccessPointCommand {
  readonly type: "add-access-point";
  readonly accessPoint: AccessPoint;
}

/** Moves an entrance or exit along the boundary. */
export interface MoveAccessPointCommand {
  readonly type: "move-access-point";
  readonly accessPointId: string;
  readonly position: GridPoint;
}

/** Removes an entrance or exit. */
export interface RemoveAccessPointCommand {
  readonly type: "remove-access-point";
  readonly accessPointId: string;
}

/** Upgrades every stall of one definition to its next level. */
export interface UpgradeStallCommand {
  readonly type: "upgrade-stall";
  readonly definitionId: string;
}

/** The undoable build commands. */
export type BuildCommand =
  | PlaceObjectCommand
  | MoveObjectCommand
  | RotateObjectCommand
  | RemoveObjectCommand
  | ExpandMapCommand
  | ConfigureQueueCommand
  | SetStallQueueDirectionCommand
  | ConfigureGuestRouteCommand
  | AddAccessPointCommand
  | MoveAccessPointCommand
  | RemoveAccessPointCommand;

/** Every command `dispatchCommand` accepts. */
export type GameCommand =
  | BuildCommand
  | { readonly type: "undo" }
  | { readonly type: "set-stall-open"; readonly objectId: string; readonly open: boolean }
  | { readonly type: "set-quality-mode"; readonly mode: QualityMode }
  | UpgradeStallCommand;

/**
 * The outcome of `dispatchCommand`: the next state, whether it was accepted, the rejection reason
 * and the events.
 */
export interface CommandResult {
  readonly state: GameState;
  readonly accepted: boolean;
  readonly error?: string;
  readonly events: readonly SimulationEvent[];
}

/**
 * The outcome of `advanceSimulation`: the next state, the fixed steps run, the time dropped by the
 * step cap, and the events.
 */
export interface AdvanceResult {
  readonly state: GameState;
  readonly fixedSteps: number;
  readonly droppedMs: number;
  readonly events: readonly SimulationEvent[];
}

/** A read-only, deep-copied projection of the state for the UI and saves. */
export interface GameSnapshot {
  readonly schemaVersion: typeof PERSISTENT_SCHEMA_VERSION;
  readonly tick: number;
  readonly elapsedMs: number;
  readonly map: GridMap;
  readonly accessPoints: readonly AccessPoint[];
  readonly routeGuidePoints: readonly GridPoint[];
  readonly qualityMode: QualityMode;
  readonly entrance: GridPoint;
  readonly exit: GridPoint;
  readonly objects: readonly PlacedObject[];
  readonly customers: readonly Customer[];
  readonly queues: Readonly<Record<string, readonly string[]>>;
  readonly seatReservations: Readonly<Record<string, string>>;
  readonly unclearedTrays: Readonly<Record<string, UnclearedTray>>;
  readonly economy: EconomyState;
  readonly progression: ProgressionState;
  readonly metrics: SimulationMetrics;
  readonly canUndo: boolean;
  readonly events: readonly SimulationEvent[];
}

/** Save V2 deliberately normalizes transient customers on load. */
export interface PersistentGameStateV2 {
  readonly schemaVersion: 2;
  readonly savedAtTick: number;
  readonly map: GridMap;
  readonly entrance: GridPoint;
  readonly exit: GridPoint;
  readonly qualityMode: QualityMode;
  readonly objects: readonly PlacedObject[];
  readonly economy: EconomyState;
  readonly progression: ProgressionState;
  readonly rngState: number;
  readonly nextCustomerSequence: number;
  readonly elapsedMs: number;
}

/** Save V3: adds access points, route guides and the saved visit metrics. */
export interface PersistentGameStateV3 {
  readonly schemaVersion: 3;
  readonly savedAtTick: number;
  readonly map: GridMap;
  readonly accessPoints: readonly AccessPoint[];
  readonly routeGuidePoints: readonly GridPoint[];
  readonly qualityMode: QualityMode;
  readonly objects: readonly PlacedObject[];
  readonly economy: EconomyState;
  readonly progression: ProgressionState;
  readonly metrics: Pick<SimulationMetrics, "trayReturns" | "visitRatings">;
  readonly rngState: number;
  readonly nextCustomerSequence: number;
  readonly elapsedMs: number;
}

/** Save V4, the current core save shape: adds the saved nutrition metrics. */
export interface PersistentGameStateV4 {
  readonly schemaVersion: 4;
  readonly savedAtTick: number;
  readonly map: GridMap;
  readonly accessPoints: readonly AccessPoint[];
  readonly routeGuidePoints: readonly GridPoint[];
  readonly qualityMode: QualityMode;
  readonly objects: readonly PlacedObject[];
  readonly economy: EconomyState;
  readonly progression: ProgressionState;
  readonly metrics: Pick<SimulationMetrics, "trayReturns" | "visitRatings" | "nutrition">;
  readonly rngState: number;
  readonly nextCustomerSequence: number;
  readonly elapsedMs: number;
}

/** Save V1, the original core save shape. */
export interface PersistentGameStateV1 {
  readonly schemaVersion: 1;
  readonly map: GridMap;
  readonly entrance: GridPoint;
  readonly exit: GridPoint;
  readonly objects: readonly PlacedObject[];
  readonly money: number;
  readonly xp: number;
  readonly reputation?: number;
  readonly seed: number;
}

/** Any core save version that `deserializeGameState` can migrate. */
export type AnyPersistentGameState =
  | PersistentGameStateV1
  | PersistentGameStateV2
  | PersistentGameStateV3
  | PersistentGameStateV4;
