/**
 * Bridge types between the Phaser runtime and the React UI: the HUD snapshot, runtime events
 * and settings, the controller the UI drives, and the runtime options.
 *
 * The UI depends on these types only, never on the runtime's internals. `RuntimePersistentState`
 * is re-exported here so the UI can name the save shape.
 */
import type { NutritionHealthReason } from "@/src/content";
import type {
  AccessPoint,
  GridPoint,
  HealthCondition,
  NutritionIntent,
  NutritionProfileStatus,
  NutritionRequestResult,
  NutritionValue,
  QualityMode,
  QueueDirection,
  VisitRatingComponents,
} from "@/src/game/core";
import type { SatisfactionTip } from "./satisfactionInsight";
import type { QueueFlowState } from "./queueInsight";
import type { RuntimePersistentState } from "./saves";

export type { QualityMode, RuntimePersistentState };
/** A simulation speed multiplier; 0 pauses. */
export type GameSpeed = 0 | 1 | 2 | 4 | 10;
/** The active world tool, which decides what a tile click does. */
export type BuildTool = "select" | "place" | "move" | "remove" | "queue" | "access" | "route";
/** A health condition ID as the UI names it; the same values as the core `HealthCondition`. */
export type HealthConditionId = HealthCondition;

/** A daily objective as the HUD shows it. */
export interface RuntimeObjective {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly progress: number;
  readonly target: number;
  readonly rewardCash: number;
  readonly rewardXp: number;
  readonly completed: boolean;
}

/** A nutrition profile flattened for display: its status, serving, nutrient values and ratings. */
export interface RuntimeNutritionProfileSummary {
  readonly status: NutritionProfileStatus;
  readonly servingLabel?: string;
  readonly energyKcal?: NutritionValue;
  readonly proteinG?: NutritionValue;
  readonly totalFatG?: NutritionValue;
  readonly saturatedFatG?: NutritionValue;
  readonly transFatG?: NutritionValue;
  readonly carbohydrateG?: NutritionValue;
  readonly dietaryFibreG?: NutritionValue;
  readonly sodiumMg?: NutritionValue;
  readonly totalSugarG?: NutritionValue;
  readonly calciumMg?: NutritionValue;
  readonly ironMg?: NutritionValue;
  readonly waterG?: NutritionValue;
  /** Overall in-game balance score for this exact listed serving. */
  readonly healthRating?: number;
  /** Up to three main reasons for the Health rating, for its tooltip; absent when not rated. */
  readonly healthReasons?: readonly NutritionHealthReason[];
  /** Condition-aware scores used to personalise customers' menu choices. */
  readonly conditionRatings?: Partial<Readonly<Record<HealthConditionId, number>>>;
  readonly intentFits?: Partial<Readonly<Record<NutritionIntent, number>>>;
}

/** One variant of a dish family for the Variant Lab, with its unlock and selection state. */
export interface RuntimeNutritionVariantSummary {
  readonly id: string;
  readonly label: string;
  readonly unlockRank: number;
  readonly profileId: string;
  readonly visualKey: string;
  readonly unlocked: boolean;
  readonly selected: boolean;
  readonly profile?: RuntimeNutritionProfileSummary;
}

/** A dish's nutrition variant family for the Variant Lab. */
export interface RuntimeNutritionFamilySummary {
  readonly dishId: string;
  /** Taste and popularity score; unlike health ratings, this is shared by every variant. */
  readonly starRating?: number;
  readonly defaultVariantId: string;
  readonly activeVariantId: string;
  readonly variants: readonly RuntimeNutritionVariantSummary[];
}

/** The Nutrition Pulse summary: today's servings, intent results and nutrient averages. */
export interface RuntimeNutritionPulse {
  readonly servedMeals: number;
  readonly profiledMeals: number;
  readonly intentRequests: number;
  readonly intentMatches: number;
  readonly intentMisses: number;
  readonly intentUnknowns: number;
  readonly averages: Readonly<{
    energyKcal?: number;
    proteinG?: number;
    dietaryFibreG?: number;
    sodiumMg?: number;
  }>;
  readonly knownCounts: Readonly<{
    energyKcal: number;
    proteinG: number;
    dietaryFibreG: number;
    sodiumMg: number;
  }>;
  readonly mostServedDishId?: string;
  readonly leadingUnmetIntent?: NutritionIntent;
}

/** The nutrition details of the selected customer for the customer inspector. */
export interface RuntimeCustomerNutritionSummary {
  readonly customerId: string;
  readonly archetypeId: string;
  readonly status: string;
  /** At most two neutral, evidence-based factors from the selected dish. */
  readonly decisionReasons: readonly string[];
  readonly intentId?: NutritionIntent;
  readonly dishId?: string;
  readonly variantId?: string;
  readonly requestResult?: NutritionRequestResult;
  readonly healthConditionIds: readonly HealthConditionId[];
  readonly personalizedHealthRating?: number;
  readonly healthImpact?: number;
  readonly healthPreferenceResult?: NutritionRequestResult;
  readonly healthDecisionReasons: readonly string[];
  readonly profile?: RuntimeNutritionProfileSummary;
}

/** A stall definition's mastery for the HUD, with the cost and rank needed for its next upgrade. */
export interface RuntimeStallMastery {
  readonly definitionId: string;
  readonly points: number;
  readonly rank: number;
  readonly upgradeLevel: 1 | 2 | 3 | 4;
  readonly nextUpgradeCost?: number;
  readonly requiredRank?: number;
}

/** The next unclaimed tier of a milestone track and the progress towards it. */
export interface RuntimeMilestoneTrack {
  readonly id: string;
  readonly title: string;
  readonly tier: number;
  readonly progress: number;
  readonly target: number;
}

/** A placed stall for the stalls panel. */
export interface RuntimeStallSummary {
  readonly objectId: string;
  readonly definitionId: string;
  readonly name: string;
  readonly queueCount: number;
  readonly queueDirection: QueueDirection;
  readonly customQueue: boolean;
  readonly open: boolean;
}

/** One neighbourhood day card as the HUD shows it. */
export interface RuntimeDayCard {
  id: string;
  name: string;
  /** One short line naming the day's effect. */
  summary: string;
  /** The forecast line shown the day before. */
  forecast: string;
}

/** One of the day's crowds on the HUD timeline, in in-game minutes of the day. */
export interface RuntimeRushWindow {
  kind: "lunch" | "dinner";
  label: string;
  /** Start and end of the rush core, which the timeline draws as a band. */
  startMinute: number;
  endMinute: number;
}

/** Today's food-writer visit as the HUD shows it. */
export interface RuntimeWriterVisit {
  stallDefinitionId: string;
  stallName: string;
  threshold: number;
  /** In-game minutes of the day during which sales are reviewed. */
  windowStartMinute: number;
  windowEndMinute: number;
  /** `upcoming` before the window, `reviewing` during it and until the verdict, then `done`. */
  status: "upcoming" | "reviewing" | "done";
  outcome: "pending" | "plaque" | "no-plaque" | "too-few-visits";
  visitCount: number;
  /** Average score of the counted visits so far, or 0 before any. */
  averageScore: number;
}

/** A count of guests who left for one reason. */
export interface RuntimeDepartureReason {
  reason: string;
  label: string;
  count: number;
}

/** The finished day's Service Review. */
export interface RuntimeDayReport {
  day: number;
  cardName: string;
  /** Warm grade word; never a fail grade. */
  grade: string;
  /** A glyph that pairs with the grade, so it never relies on colour alone. */
  gradeGlyph: string;
  /** One sentence that sums the day up. */
  headline: string;
  served: number;
  leftEarly: number;
  revenue: number;
  averageScore: number;
  ratedVisits: number;
  /** The reasons guests left early, most common first. */
  leftEarlyReasons: readonly RuntimeDepartureReason[];
  /** The weakest rating factor and one thing to try, or `undefined` without ratings. */
  focusTip?: SatisfactionTip;
  trayReturns: number;
  objectivesCompleted: number;
  objectivesTotal: number;
  unlockedCount: number;
  /** The food writer's verdict, if the writer visited. */
  writer?: {
    stallName: string;
    outcome: "plaque" | "no-plaque" | "too-few-visits";
    averageScore: number;
    threshold: number;
    quote: string;
  };
}

/** The neighbourhood as the HUD shows it. */
export interface RuntimeNeighbourhood {
  today: RuntimeDayCard;
  tomorrow: RuntimeDayCard;
  /** In-game minute of the day now. */
  minuteOfDay: number;
  /** The day's opening, last-orders and closing minutes, for the timeline. */
  openingMinute: number;
  lastOrdersMinute: number;
  closingMinute: number;
  rushWindows: readonly RuntimeRushWindow[];
  /** The crowd under way now, if any. */
  activeRush?: "lunch" | "dinner";
  /** A short notice of the next rush within the warning lead time, if any. */
  rushNotice?: string;
  writer?: RuntimeWriterVisit;
  isWriterTomorrow: boolean;
  writerPickStallIds: readonly string[];
  lastReport?: RuntimeDayReport;
}

/** The nearest locked item and what it still needs. */
export interface RuntimeNextUnlock {
  id: string;
  name: string;
  kind: "stall" | "placeable" | "dish";
  requiredLevel: number;
  /** Required reputation on the 0-100 display scale. */
  requiredReputation: number;
  isLevelMet: boolean;
  isReputationMet: boolean;
  /** Share of the way there, from 0 to 1, for a progress bar. */
  progress: number;
  /** One actionable sentence. */
  hint: string;
}

/**
 * Everything the HUD shows, pushed through `RuntimeOptions.onSnapshot` after each change and
 * periodically while running.
 */
export interface RuntimeSnapshot {
  cash: number;
  reputation: number;
  level: number;
  experience: number;
  nextLevelExperience: number;
  day: number;
  timeLabel: string;
  isOpen: boolean;
  speed: GameSpeed;
  quality: QualityMode;
  activeCustomers: number;
  servedCustomers: number;
  averageSatisfaction: number;
  hasSatisfactionRatings: boolean;
  satisfactionBreakdown?: VisitRatingComponents;
  satisfactionTips: readonly SatisfactionTip[];
  queuePressure: number;
  queueFlowState: QueueFlowState;
  queueFlowMessage: string;
  freeSeats: number;
  totalSeats: number;
  cleanliness: number;
  trayReturnStations: number;
  /** How many objects (stalls and placeables) are placed in the hall. */
  placedObjectCount: number;
  /** Seats holding a tray that the table-cleaning crew has not cleared yet. */
  unclearedTrays: number;
  /** Trays the crew can clear at once. */
  cleaningCrew: number;
  /** Peak reputation on the 0-100 display scale, which unlocks read. */
  peakReputation: number;
  /**
   * The operating day each locked stall that meets its other unlock rules is offered by tender,
   * keyed by stall ID; the first waiting stall takes the next tender, the second the one after.
   */
  stallTenderDays: Readonly<Record<string, number>>;
  neighbourhood?: RuntimeNeighbourhood;
  nextUnlock?: RuntimeNextUnlock;
  buildTool: BuildTool;
  selectedBuildId?: string;
  selectedObjectId?: string;
  selectedObjectDefinitionId?: string;
  unlockedContentIds: readonly string[];
  stallMenus: Readonly<Record<string, readonly string[]>>;
  activeDishVariants: Readonly<Record<string, string>>;
  nutritionFamilies: readonly RuntimeNutritionFamilySummary[];
  nutritionPulse: RuntimeNutritionPulse;
  selectedCustomerId?: string;
  selectedCustomerNutrition?: RuntimeCustomerNutritionSummary;
  placedStalls: readonly RuntimeStallSummary[];
  canUndo: boolean;
  objectiveProgress: number;
  objectiveTarget: number;
  objectives: readonly RuntimeObjective[];
  objectiveRefreshLabel: string;
  claimedMilestoneCount: number;
  milestoneTracks: readonly RuntimeMilestoneTrack[];
  stallMastery: readonly RuntimeStallMastery[];
  accessPoints: readonly AccessPoint[];
  routeGuidePoints: readonly GridPoint[];
  selectedAccessPointId?: string;
  expansionCount: number;
  nextExpansionCost: number;
  fps: number;
  simulationMs: number;
  autosaveState: "saved" | "saving" | "error";
  pausedReason?: string;
}

/**
 * A player-facing message for the activity feed and toasts; `groupKey` merges repeats into one feed
 * entry.
 */
export interface RuntimeEvent {
  readonly kind: "info" | "success" | "warning" | "error";
  readonly message: string;
  readonly importance?: "routine" | "important";
  readonly groupKey?: string;
  readonly amount?: number;
}

/** The player settings the runtime starts with. */
export interface RuntimeSettings {
  quality: QualityMode;
  reducedMotion: boolean;
  highContrast: boolean;
  textScale: number;
  musicVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
  masterMuted: boolean;
}

/**
 * The interface the UI uses to drive the runtime.
 *
 * `createHawkerRuntime` returns the controller before the Phaser scene has booted. Every method is
 * safe to call before boot: state changes, saves, events and HUD snapshots happen at once, while
 * drawing waits for the scene and camera-only calls (`zoomBy`, `centreCamera`) do nothing until it
 * exists. Methods that return a boolean return true when the change was made or was already in
 * effect, and false when it was rejected; a rejection usually also emits a warning or error event.
 */
export interface RuntimeController {
  /** Destroys the Phaser game and releases the scene. */
  destroy(): void;
  /**
   * Chooses the catalogue item to place, resetting its rotation and switching to the place tool; no
   * item clears the choice.
   */
  selectBuildItem(itemId?: string): void;
  /**
   * Switches the world tool. Entering the access or route tool pauses the simulation, and leaving
   * it restores the earlier speed.
   */
  setBuildTool(tool: BuildTool): void;
  /** Rotates the selected object, or, with nothing selected, the next placement. */
  rotateSelection(): void;
  /** Undoes the most recent build command while its undo window is open. */
  undo(): void;
  /**
   * Opens every placed stall, or closes them all when the centre is open; false when no stall is
   * placed.
   */
  toggleOpen(): boolean;
  /** Sets the simulation speed. */
  setSpeed(speed: GameSpeed): void;
  /** Sets the simulation quality mode and the matching frame-rate cap. */
  setQuality(quality: QualityMode): void;
  /** Turns reduced motion on or off for the world rendering. */
  setReducedMotion(enabled: boolean): void;
  /** Turns the high-contrast world rendering on or off. */
  setHighContrast(enabled: boolean): void;
  /** Shows or hides the developer debug overlay. */
  setDebugOverlay(enabled: boolean): void;
  /** Changes the camera zoom by `delta`, within the zoom limits. */
  zoomBy(delta: number): void;
  /** Centres the camera on the hall. */
  centreCamera(): void;
  /** Returns the current save payload (`RuntimePersistentState`). */
  exportState(): unknown;
  /**
   * Replaces the session with a save payload and clears the customer selection.
   *
   * @throws Error When the payload cannot be loaded; the current session is then unchanged.
   */
  importState(value: unknown): void;
  /**
   * Replaces the session with a fresh centre, returns to the select tool at normal speed, and
   * saves.
   */
  reset(): void;
  /**
   * Developer action: spawns a customer by running one fixed step with the spawn countdown cleared.
   */
  spawnCustomer(): void;
  /** Developer action: adds cash, never going below zero, and saves. */
  addCash(amount: number): void;
  /**
   * Buys the next map expansion; false below the required level or when the purchase is rejected.
   */
  expandMap(): boolean;
  /**
   * Starts editing a placed stall's queue route with the queue tool; false when the object is not a
   * placed stall with a queue anchor.
   */
  beginQueueEdit(objectId: string): boolean;
  /** Sets a stall's automatic queue direction and ends any queue edit; false when rejected. */
  setQueueDirection(objectId: string, direction: QueueDirection): boolean;
  /** Ends the current queue edit; does nothing unless the queue tool is active. */
  finishQueueEdit(): void;
  /**
   * Adds a dish to or removes it from a stall's menu; false for an unknown or locked dish, a full
   * menu, or removing the last dish.
   */
  setDishEnabled(stallId: string, dishId: string, enabled: boolean): boolean;
  /**
   * Selects the nutrition variant a dish serves for future orders; false for an unknown variant or
   * one above the stall's mastery rank.
   */
  setDishVariant(dishId: string, variantId: string): boolean;
  /** Selects a customer for the inspector; an unknown or missing ID clears the selection. */
  selectCustomer(customerId?: string): void;
  /** Arms the access tool so the next boundary tile clicked becomes a new entrance or exit. */
  addAccessPoint(kind: AccessPoint["kind"]): void;
  /** Selects an access point with the access tool; an unknown ID is ignored. */
  selectAccessPoint(accessPointId?: string): void;
  /** Removes the selected access point; false when none is selected or the removal is rejected. */
  removeSelectedAccessPoint(): boolean;
  /** Clears every preferred guest route tile. */
  clearGuestRoute(): boolean;
  /** Buys the next mastery upgrade for a stall definition; false when rejected. */
  upgradeStall(definitionId: string): boolean;
  /**
   * Paints the thumbnail of a buildable definition (a placeable or a stall) with the world's own
   * painters and returns it as a PNG data URL; undefined before the scene exists or for an unknown
   * definition.
   */
  renderPreview(definitionId: string): string | undefined;
  /**
   * Paints a dish serving, with the given variant or the dish's active variant, as a PNG data
   * URL; undefined before the scene exists or for an unknown dish.
   */
  renderDishPreview(dishId: string, variantId?: string): string | undefined;
}

/**
 * The inputs to `createHawkerRuntime`: the parent element, the starting settings, the save
 * candidates to try in order, and the callbacks for snapshots, events and save payloads.
 */
export interface RuntimeOptions {
  parent: HTMLElement;
  settings: RuntimeSettings;
  initialStates?: readonly unknown[];
  /**
   * Supplies the world seed of each new centre (first start without a save, recovery and
   * reset). Without it every new centre uses the launch world seed.
   */
  createWorldSeed?: () => number;
  onSnapshot(snapshot: RuntimeSnapshot): void;
  onEvent(event: RuntimeEvent): void;
  onPersistentChange(state: unknown): void;
}
