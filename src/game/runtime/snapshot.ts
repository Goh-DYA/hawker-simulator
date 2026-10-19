/**
 * The HUD snapshot projection: game state plus the runtime's interaction state, as the HUD sees it.
 *
 * `build_runtime_snapshot` is a pure function of its input. The runtime assembles that input at
 * every HUD push, so nothing here caches state between calls. The focused helpers below each
 * project one part of the snapshot; the nutrition parts live in `./nutrition`.
 */
import { PLACEABLE_BY_ID as CONTENT_PLACEABLE_BY_ID, STALLS } from "@/src/content";
import {
  averageVisitRating,
  calculateExpansionCost,
  createSnapshot,
  distinctOpenStallTypes,
  effectiveStallDefinition,
  findPath,
  getBlockedTileKeys,
  getSeatLocations,
  get_navigation_reserved_points,
  MILESTONE_TRACKS,
  OPERATING_DAY_MS,
  operatingMinuteOfDay,
  planStallQueueLayouts,
  UPGRADE_RANK_REQUIREMENTS,
  VISIT_RATING_COMPONENT_KEYS,
  xpRequiredForLevel,
  type GameSnapshot,
  type GameState,
  type GridPoint,
  type QueueDirection,
  type SimulationCatalog,
  type VisitRating,
  type VisitRatingComponents,
} from "@/src/game/core";
import { effectiveCatalog, type VisualDefinition } from "./catalog";
import {
  build_customer_nutrition,
  build_nutrition_families,
  build_nutrition_pulse,
} from "./nutrition";
import { deriveQueueFlowInsight } from "./queueInsight";
import { MAP_EXPANSION, REPUTATION_SCALE } from "./rules";
import { deriveSatisfactionTips } from "./satisfactionInsight";
import { build_neighbourhood_view, count_hall_cleaning_crew, find_next_unlock } from "./neighbourhood";
import type { BuildTool, GameSpeed, RuntimeMilestoneTrack, RuntimeSnapshot } from "./types";

type MilestoneTrackId = (typeof MILESTONE_TRACKS)[number]["id"];

/** HUD title of each core milestone track. */
const MILESTONE_TRACK_TITLES: Readonly<Record<MilestoneTrackId, string>> = {
  service: "Service",
  hospitality: "Hospitality",
  variety: "Variety",
  growth: "Growth",
};

/** Index of the last milestone target; tiers beyond it keep chasing that final target. */
const LAST_MILESTONE_TARGET_INDEX = 3;

/** HUD cleanliness of a hall before any support, tray-return or crowding adjustment. */
const CLEANLINESS_BASE = 86;
/** Cleanliness added per point of placed cleanliness support. */
const CLEANLINESS_PER_SUPPORT_POINT = 4;
/** Cleanliness added per placed tray-return station. */
const CLEANLINESS_PER_TRAY_RETURN = 4;
/** Cleanliness removed when guests are present but no tray-return station is placed. */
const CLEANLINESS_NO_TRAY_RETURN_PENALTY = 28;
/** Cleanliness removed per guest in the centre. */
const CLEANLINESS_PER_CUSTOMER = 0.5;
/** Cleanliness removed per queued guest. */
const CLEANLINESS_PER_QUEUED_CUSTOMER = 1.2;
/** Lowest cleanliness the HUD estimate reports. */
const CLEANLINESS_MIN = 25;
/** Highest cleanliness the HUD estimate reports. */
const CLEANLINESS_MAX = 100;

/** The hall figures the HUD cleanliness estimate is computed from. */
export interface HallCleanlinessInput {
  /** Sum of the cleanliness modifiers of every placed content item. */
  readonly cleanlinessSupport: number;
  /** Number of placed tray-return stations. */
  readonly trayReturnStations: number;
  /** Number of guests in the centre. */
  readonly customerCount: number;
  /** Number of guests waiting in all stall queues. */
  readonly queueCount: number;
}

/**
 * Estimates the hall's cleanliness for the HUD meter.
 *
 * This is a HUD heuristic only: the visit ratings that drive satisfaction compute their own
 * cleanliness inputs in core, and nothing reads this estimate back into the simulation.
 *
 * @param input - Placed support, tray-return stations, guests and queued guests.
 * @returns The estimate, clamped to the range 25 to 100.
 */
export function estimate_hall_cleanliness(input: HallCleanlinessInput): number {
  const {
    cleanlinessSupport: cleanliness_support,
    trayReturnStations: tray_return_stations,
    customerCount: customer_count,
    queueCount: queue_count,
  } = input;
  return Math.max(
    CLEANLINESS_MIN,
    Math.min(
      CLEANLINESS_MAX,
      CLEANLINESS_BASE +
        cleanliness_support * CLEANLINESS_PER_SUPPORT_POINT +
        tray_return_stations * CLEANLINESS_PER_TRAY_RETURN -
        (tray_return_stations === 0 && customer_count > 0 ? CLEANLINESS_NO_TRAY_RETURN_PENALTY : 0) -
        customer_count * CLEANLINESS_PER_CUSTOMER -
        queue_count * CLEANLINESS_PER_QUEUED_CUSTOMER,
    ),
  );
}

/**
 * Resolves the direction a stall's queue faces.
 *
 * An explicit direction on the stall wins. Otherwise the direction is inferred from the step
 * between the first two planned queue cells, and a queue shorter than two cells faces south.
 *
 * @param queue_direction - The stall's explicit queue direction, if any.
 * @param cells - The stall's planned queue cells, front first.
 * @returns The queue direction the HUD reports.
 */
export function resolve_queue_direction(
  queue_direction: QueueDirection | undefined,
  cells: readonly GridPoint[],
): QueueDirection {
  const first = cells[0];
  const second = cells[1];
  return (
    queue_direction ??
    (first && second
      ? second.x > first.x
        ? "east"
        : second.x < first.x
          ? "west"
          : second.y < first.y
            ? "north"
            : "south"
      : "south")
  );
}

/**
 * Builds the HUD milestone tracks, in core track order.
 *
 * A track's tier is the number of its claimed milestones, and its target is the target of that
 * tier, clamped to the last target once every tier is claimed.
 *
 * @param progress - Current progress value of each track.
 * @param claimed_milestone_ids - IDs of every claimed milestone, prefixed with their track ID.
 * @returns One track summary per core milestone track.
 */
export function build_milestone_tracks(
  progress: Readonly<Record<MilestoneTrackId, number>>,
  claimed_milestone_ids: readonly string[],
): readonly RuntimeMilestoneTrack[] {
  return MILESTONE_TRACKS.map((track) => {
    const tier = claimed_milestone_ids.filter((id) => id.startsWith(`${track.id}-`)).length;
    return { id: track.id, title: MILESTONE_TRACK_TITLES[track.id], tier, progress: progress[track.id], target: track.targets[Math.min(LAST_MILESTONE_TARGET_INDEX, tier)]! };
  });
}

/**
 * Collects the cells of the preferred path from every entrance to every exit.
 *
 * Paths avoid blocked tiles and favour route-guide points. A cell shared by several paths is
 * listed once, at its first position.
 *
 * @param snapshot - Snapshot whose map, access points and route-guide points are used.
 * @param objects - Placed objects whose footprints block movement.
 * @param catalog - Catalog that defines each placed object's footprint.
 * @returns The distinct route cells, in first-visit order.
 */
export function get_main_guest_route(
  snapshot: Pick<GameSnapshot, "map" | "accessPoints" | "routeGuidePoints">,
  objects: GameState["objects"],
  catalog: SimulationCatalog,
): GridPoint[] {
  const blocked = getBlockedTileKeys(objects, catalog);
  const preferred = new Set(snapshot.routeGuidePoints.map((point) => `${point.x},${point.y}`));
  const routeCells = new Map<string, GridPoint>();
  for (const entrance of snapshot.accessPoints.filter((point) => point.kind === "entrance")) {
    for (const exit of snapshot.accessPoints.filter((point) => point.kind === "exit")) {
      for (const point of findPath(snapshot.map, entrance.position, exit.position, {
        blocked,
        preferred,
      }).path ?? []) {
        routeCells.set(`${point.x},${point.y}`, point);
      }
    }
  }
  return [...routeCells.values()];
}

/**
 * Average each visit-rating component across the given ratings.
 *
 * Components are summed left to right from zero in rating order and visited in
 * `VISIT_RATING_COMPONENT_KEYS` order, so the floating-point result and the key order of the
 * returned object match the snapshot output pinned by the runtime goldens.
 *
 * @param ratings - Non-empty list of visit ratings; an empty list yields `NaN` components.
 * @returns The mean of every component, keyed in persisted component order.
 */
function compute_average_visit_components(ratings: readonly VisitRating[]): VisitRatingComponents {
  const averages = Object.fromEntries(
    VISIT_RATING_COMPONENT_KEYS.map((key) => [
      key,
      ratings.reduce((sum, rating) => sum + rating.components[key], 0) / ratings.length,
    ]),
  );
  // Object.fromEntries widens to a string index; the entries cover every component key.
  return averages as Record<keyof VisitRatingComponents, number>;
}

/** The runtime's interaction state that the HUD snapshot reports. */
export interface SnapshotInteraction {
  /** The active build tool. */
  readonly buildTool: BuildTool;
  /** The catalogue item chosen for placement, if any. */
  readonly selectedBuildId: string | undefined;
  /** The selected placed object, if any. */
  readonly selectedObjectId: string | undefined;
  /** The selected guest, if any. */
  readonly selectedCustomerId: string | undefined;
  /** The selected entrance or exit, if any. */
  readonly selectedAccessPointId: string | undefined;
  /** The simulation speed. */
  readonly speed: GameSpeed;
}

/** Everything one HUD snapshot is projected from, assembled fresh for each push. */
export interface SnapshotInput {
  /** Current game state. */
  readonly state: GameState;
  /** Catalog with the player's stall menus and dish variants layered on. */
  readonly catalog: SimulationCatalog;
  /** Display names and visuals of each definition. */
  readonly visuals: Readonly<Record<string, VisualDefinition>>;
  /** The player's stall menus. */
  readonly stallMenus: Readonly<Record<string, readonly string[]>>;
  /** The active variant of each dish family. */
  readonly activeDishVariants: Readonly<Record<string, string>>;
  /** Tool, selection and speed state of the runtime. */
  readonly interaction: SnapshotInteraction;
  /** Measured frames per second, or the default when no frame has been measured. */
  readonly fps: number;
  /** Duration of the last simulation advance, in milliseconds. */
  readonly simulationMs: number;
}

/**
 * Formats the in-game clock of an operating day as a 12-hour label.
 *
 * @param elapsedMs - Simulated time since the centre opened.
 * @returns The clock label, for example `9:05 AM`.
 */
function timeLabel(elapsedMs: number) {
  const minuteInDay = operatingMinuteOfDay(elapsedMs);
  const hour = Math.floor(minuteInDay / 60);
  const minute = minuteInDay % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const clockHour = hour % 12 || 12;
  return `${clockHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

/**
 * Reports whether any placed stall is open.
 *
 * @param state - Game state whose placed objects are checked.
 * @param catalog - Catalog that says which definitions are stalls.
 * @returns Whether at least one stall is open.
 */
export function isCentreOpen(state: GameState, catalog: SimulationCatalog): boolean {
  return Object.values(state.objects).some(
    (object) => catalog.placeables[object.definitionId]?.kind === "stall" && object.open,
  );
}

/**
 * Projects the game state and the runtime's interaction state into the HUD snapshot.
 *
 * @param input - State, catalog layers, interaction state and frame timing, built per call.
 * @returns The HUD snapshot; the autosave state always reads `saved`.
 */
export function build_runtime_snapshot(input: SnapshotInput): RuntimeSnapshot {
  const { state, catalog, visuals, stallMenus, activeDishVariants, fps, simulationMs } = input;
  const {
    buildTool,
    selectedBuildId,
    selectedObjectId,
    selectedCustomerId,
    selectedAccessPointId,
    speed,
  } = input.interaction;
  const snapshot = createSnapshot(state);
  const seats = getSeatLocations(state.objects, catalog);
  const queueCount = Object.values(snapshot.queues).reduce((sum, queue) => sum + queue.length, 0);
  const placedContent = snapshot.objects
    .map((object) => CONTENT_PLACEABLE_BY_ID.get(object.definitionId))
    .filter((item) => item !== undefined);
  const cleanlinessSupport = placedContent.reduce(
    (sum, item) => sum + item.cleanlinessModifier,
    0,
  );
  const trayReturnStations = snapshot.objects.filter(
    (object) => catalog.placeables[object.definitionId]?.kind === "tray-return",
  ).length;
  const averageSatisfaction = averageVisitRating(state);
  const satisfactionBreakdown = snapshot.metrics.visitRatings.length
    ? compute_average_visit_components(snapshot.metrics.visitRatings)
    : undefined;
  const nextLevelExperience = xpRequiredForLevel(snapshot.progression.level + 1);
  const queueLayouts = planStallQueueLayouts(
    snapshot.map,
    state.objects,
    effectiveCatalog(state, catalog),
    get_navigation_reserved_points(snapshot),
  );
  const mainGuestRoute = get_main_guest_route(snapshot, state.objects, catalog);
  const queueFlow = deriveQueueFlowInsight(
    snapshot.objects
      .filter((object) => catalog.placeables[object.definitionId]?.kind === "stall")
      .map((object) => {
        const definition = catalog.placeables[object.definitionId];
        const cells = queueLayouts[object.id] ?? [];
        const count = snapshot.queues[object.id]?.length ?? 0;
        return {
          open: object.open,
          queueCount: count,
          routeCapacity: cells.length,
          designedCapacity: definition?.stall
            ? effectiveStallDefinition(state, object.definitionId, definition.stall).queueCapacity
            : cells.length,
          occupiedCells: cells.slice(0, count),
        };
      }),
    mainGuestRoute,
  );
  const placedStalls = snapshot.objects
    .filter((object) => catalog.placeables[object.definitionId]?.kind === "stall")
    .map((object) => {
      const cells = queueLayouts[object.id] ?? [];
      const inferredDirection = resolve_queue_direction(object.queueDirection, cells);
      return {
        objectId: object.id,
        definitionId: object.definitionId,
        name: visuals[object.definitionId]?.name ?? object.definitionId,
        queueCount: snapshot.queues[object.id]?.length ?? 0,
        queueDirection: inferredDirection,
        customQueue: Boolean(object.queuePath?.length),
        open: object.open,
      };
    });
  const milestone_progress: Readonly<Record<MilestoneTrackId, number>> = {
    service: snapshot.economy.completedVisits,
    hospitality: averageSatisfaction ?? 0,
    variety: distinctOpenStallTypes(state),
    growth: snapshot.progression.level,
  };
  const milestoneTracks = build_milestone_tracks(
    milestone_progress,
    snapshot.progression.claimedMilestoneIds,
  );
  const remainingObjectiveMinutes = Math.ceil((OPERATING_DAY_MS - (snapshot.elapsedMs % OPERATING_DAY_MS)) / 1_000);
  const day = 1 + Math.floor(snapshot.elapsedMs / OPERATING_DAY_MS);
  const nutritionFamilies = build_nutrition_families(
    snapshot.progression,
    catalog,
    activeDishVariants,
  );
  const nutritionPulse = build_nutrition_pulse(snapshot.metrics.nutrition, day);
  const selectedCustomer = selectedCustomerId
    ? snapshot.customers.find((customer) => customer.id === selectedCustomerId)
    : undefined;
  return {
    cash: snapshot.economy.currency,
    reputation: snapshot.progression.reputation * REPUTATION_SCALE,
    level: snapshot.progression.level,
    experience: snapshot.progression.xp,
    nextLevelExperience,
    day,
    timeLabel: timeLabel(snapshot.elapsedMs),
    isOpen: isCentreOpen(state, catalog),
    speed,
    quality: snapshot.qualityMode,
    activeCustomers: snapshot.customers.length,
    servedCustomers: snapshot.economy.completedVisits,
    averageSatisfaction: Math.max(0, Math.min(100, averageSatisfaction ?? 0)),
    hasSatisfactionRatings: averageSatisfaction !== undefined,
    satisfactionBreakdown,
    satisfactionTips: deriveSatisfactionTips(satisfactionBreakdown),
    queuePressure: queueFlow.pressure,
    queueFlowState: queueFlow.state,
    queueFlowMessage: queueFlow.message,
    freeSeats: Math.max(
      0,
      seats.length - Object.keys(snapshot.seatReservations).length - Object.keys(snapshot.unclearedTrays).length,
    ),
    totalSeats: seats.length,
    cleanliness: estimate_hall_cleanliness({
      cleanlinessSupport,
      trayReturnStations,
      customerCount: snapshot.customers.length,
      queueCount,
    }),
    trayReturnStations,
    unclearedTrays: Object.keys(snapshot.unclearedTrays).length,
    cleaningCrew: count_hall_cleaning_crew(state),
    peakReputation: snapshot.progression.peakReputation * REPUTATION_SCALE,
    neighbourhood: build_neighbourhood_view(state, visuals),
    nextUnlock: find_next_unlock(state),
    buildTool,
    selectedBuildId,
    selectedObjectId,
    selectedObjectDefinitionId: selectedObjectId
      ? state.objects[selectedObjectId]?.definitionId
      : undefined,
    unlockedContentIds: snapshot.progression.unlockedDefinitionIds,
    stallMenus,
    activeDishVariants,
    nutritionFamilies,
    nutritionPulse,
    selectedCustomerId: selectedCustomer?.id,
    selectedCustomerNutrition: selectedCustomer
      ? build_customer_nutrition(selectedCustomer, catalog)
      : undefined,
    placedStalls,
    canUndo: snapshot.canUndo,
    objectiveProgress: Math.min(5, snapshot.economy.completedVisits),
    objectiveTarget: 5,
    objectives: snapshot.progression.dailyObjectives.map((objective) => ({
      id: objective.id,
      title: objective.title,
      description: objective.description,
      progress: objective.progress,
      target: objective.target,
      rewardCash: objective.rewardCash,
      rewardXp: objective.rewardXp,
      completed: objective.completed,
    })),
    objectiveRefreshLabel: `${Math.floor(remainingObjectiveMinutes / 60)}h ${remainingObjectiveMinutes % 60}m`,
    claimedMilestoneCount: snapshot.progression.claimedMilestoneIds.length,
    milestoneTracks,
    stallMastery: STALLS.map((definition) => {
      const mastery = snapshot.progression.stallMastery[definition.id] ?? { points: 0, rank: 1, upgradeLevel: 1 as const };
      const nextLevel = mastery.upgradeLevel + 1;
      const nextUpgrade = definition.upgradeLevels.find((upgrade) => upgrade.level === nextLevel);
      return {
        definitionId: definition.id,
        ...mastery,
        nextUpgradeCost: nextUpgrade?.cost,
        requiredRank: Object.hasOwn(UPGRADE_RANK_REQUIREMENTS, nextLevel)
          ? UPGRADE_RANK_REQUIREMENTS[nextLevel as keyof typeof UPGRADE_RANK_REQUIREMENTS]
          : undefined,
      };
    }),
    accessPoints: snapshot.accessPoints,
    routeGuidePoints: snapshot.routeGuidePoints,
    selectedAccessPointId,
    expansionCount: snapshot.progression.expansionCount,
    nextExpansionCost: calculateExpansionCost(
      snapshot.map,
      snapshot.progression,
      state.config,
      MAP_EXPANSION.addColumns,
      MAP_EXPANSION.addRows,
    ),
    fps,
    simulationMs,
    autosaveState: "saved",
  };
}
