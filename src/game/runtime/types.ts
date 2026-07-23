import type {
  AccessPoint,
  GridPoint,
  HealthCondition,
  MoneyCents,
  MoneyDeltaCents,
  NutritionIntent,
  NutritionProfileStatus,
  NutritionRequestResult,
  NutritionValue,
  ObjectiveKind,
  PartyLifecyclePhase,
  PartyOrderStrategy,
  PeriodLedgerEntryKind,
  QueueDirection,
  ServicePeriodId,
  ServicePeriodPhase,
  VisitRatingComponents,
  ForecastComparison,
  ForecastCoverage,
  ForecastBudgetBand,
  ForecastGroupSize,
  ForecastNeed,
  ForecastShare,
} from "@/src/game/core";
import type { SatisfactionTip } from "./satisfactionInsight";
import type { QueueFlowState } from "./queueInsight";

export type QualityMode = "standard" | "lower-end";
export type GameSpeed = 0 | 1 | 2 | 4 | 10;
export type BuildTool = "select" | "place" | "move" | "remove" | "queue" | "access" | "route";
export type HealthConditionId =
  | "high-cholesterol"
  | "obesity"
  | "diabetes"
  | "hypertension";

export interface RuntimeObjective {
  readonly id: string;
  readonly kind: ObjectiveKind;
  readonly title: string;
  readonly description: string;
  readonly accessibleDescription: string;
  readonly progress: number;
  readonly target: number;
  readonly rewardCashCents: MoneyCents;
  /** @deprecated Compatibility-only whole-SGD view. */
  readonly rewardCash: number;
  readonly rewardXp: number;
  readonly completed: boolean;
  readonly accepted: boolean;
  readonly skipped?: boolean;
  readonly canAccept?: boolean;
  readonly canSkip: boolean;
}

export interface RuntimeServicePeriod {
  readonly sequenceId: number;
  readonly day: number;
  readonly id: ServicePeriodId;
  readonly label: string;
  readonly phase: ServicePeriodPhase;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly clockLabel: string;
  readonly arrivalElapsedMs: number;
  readonly drainElapsedMs: number;
  readonly arrivalRemainingMs: number;
  readonly drainRemainingMs: number;
  readonly configurationLocked: boolean;
  readonly canAdvance: boolean;
  readonly actionLabel: string;
}

export interface RuntimePeriodLedgerEntry {
  readonly id: string;
  readonly periodSequenceId: number;
  readonly kind: PeriodLedgerEntryKind;
  readonly amountCents: MoneyCents;
  readonly tick: number;
  readonly referenceId?: string;
}

export interface RuntimePeriodLedger {
  readonly periodSequenceId: number;
  readonly openingCashCents: MoneyCents;
  readonly grossSalesCents: MoneyCents;
  readonly ingredientCostsCents: MoneyCents;
  readonly refundsCents: MoneyCents;
  readonly purchasesCents: MoneyCents;
  readonly resaleCents: MoneyCents;
  readonly upkeepCents: MoneyCents;
  readonly objectiveRewardsCents: MoneyCents;
  readonly milestoneRewardsCents: MoneyCents;
  readonly recoveryCents: MoneyCents;
  readonly contributionCents: MoneyDeltaCents;
  readonly operatingMargin?: number;
  /** Sum of all cash-affecting entries recorded for this period. */
  readonly recordedCashMovementCents: MoneyDeltaCents;
  /** Current cash less the immutable cash balance captured when planning began. */
  readonly actualCashMovementCents: MoneyDeltaCents;
  readonly reconciliationDeltaCents: MoneyDeltaCents;
  readonly reconcilesToCash: boolean;
  readonly entries: readonly RuntimePeriodLedgerEntry[];
}

export type RuntimeDebriefCauseCode =
  | "period-complete"
  | "served-timeout"
  | "unserved-departure"
  | "partial-meal-second-stall-unavailable"
  | "partial-meal-served-timeout";

export interface RuntimePartialMealCauseSummary {
  readonly cause: "second-stall-unavailable" | "served-timeout";
  readonly count: number;
}

export interface RuntimeComboOfferOutcomeSummary {
  readonly offerId: string;
  readonly completedVisits: number;
  readonly partialVisits: number;
  readonly partialMealCauses: readonly RuntimePartialMealCauseSummary[];
}

export interface RuntimePeriodDebrief {
  readonly periodSequenceId: number;
  readonly servedVisits: number;
  readonly timedOutServedVisits: number;
  readonly unservedDepartures: number;
  readonly partialMeals: number;
  readonly partialMealCauses: readonly RuntimePartialMealCauseSummary[];
  readonly partyVisits: number;
  readonly partyGuests: number;
  readonly partySplits: number;
  readonly partialPartyVisits: number;
  readonly regularStoryBeats: number;
  readonly completedComboVisits: number;
  readonly comboOfferOutcomes: readonly RuntimeComboOfferOutcomeSummary[];
  readonly causeCodes: readonly RuntimeDebriefCauseCode[];
  readonly forecastComparison: RuntimeForecastComparison;
}

export interface RuntimeForecastComparison extends ForecastComparison {
  readonly averageWaitScore?: number;
  readonly contributionCents: MoneyDeltaCents;
  readonly satisfactionCauseScores: Partial<VisitRatingComponents>;
}

export interface RuntimeForecast {
  readonly periodSequenceId: number;
  readonly periodId: ServicePeriodId;
  readonly day: number;
  readonly demandRange: readonly [number, number];
  readonly crowdProfiles: readonly ForecastShare[];
  readonly budgetBands: readonly ForecastBudgetBand[];
  readonly groupSizeMix: readonly ForecastGroupSize[];
  readonly mealMix: readonly ForecastShare[];
  readonly nutritionIntents: readonly ForecastNeed[];
  readonly conditionAwareNeeds: readonly ForecastNeed[];
  readonly nutritionIntentIncidenceBasisPoints: number;
  readonly conditionAwareIncidenceBasisPoints: number;
  readonly needShareBasis: "among-flagged-needs";
  readonly coverage: readonly ForecastCoverage[];
  readonly menuIndependent: true;
  readonly explanation: string;
}

export interface RuntimeNeighbourhoodEventChoice {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Player-facing statement of what choosing this response does. */
  readonly resultingOutcome: string;
  /** Exact operational change added by this choice, separate from the event. */
  readonly choiceDeltaLabels: readonly string[];
  /** Exact combined event-and-choice forecast shown before confirmation. */
  readonly resultingModifierLabels: readonly string[];
}

export interface RuntimeNeighbourhoodEventSummary {
  readonly eventId: string;
  readonly name: string;
  readonly description: string;
  readonly neutralOutcome: string;
  readonly choicePrompt?: string;
  readonly choices: readonly RuntimeNeighbourhoodEventChoice[];
  readonly selectedChoiceId?: string;
  readonly dismissed: boolean;
  /** True only while an authored untimed choice still needs a planning decision. */
  readonly requiresDecision: boolean;
  /** Exact event-only forecast before an optional service choice. */
  readonly baseModifierLabels: readonly string[];
  /** Exact forecast that results from taking the documented neutral response. */
  readonly neutralModifierLabels: readonly string[];
  /** Resolved player-facing outcome, absent while a choice is still open. */
  readonly resolvedOutcome?: string;
  /** Exact combined operational changes, suitable for the planning UI. */
  readonly modifierLabels: readonly string[];
  readonly preferenceTagBasisPointDeltas: Readonly<Record<string, number>>;
}

export interface RuntimePartySummary {
  readonly partyId: string;
  readonly leaderCustomerId: string;
  readonly guestCount: number;
  readonly servedGuestCount: number;
  readonly phase: PartyLifecyclePhase;
  readonly orderStrategy: PartyOrderStrategy;
  readonly servingStopCount: number;
  readonly nextStopIndex: number;
  readonly reservedSeatCount: number;
  readonly splitExplained: boolean;
  readonly members: readonly {
    readonly memberId: string;
    readonly archetypeId: string;
    readonly budgetCents: MoneyCents;
    readonly plannedDishId: string;
    readonly plannedStallId: string;
    readonly nutritionIntentId?: NutritionIntent;
    readonly healthConditions: readonly HealthCondition[];
    readonly served: boolean;
  }[];
}

export interface RuntimeRegularProgressSummary {
  readonly regularId: string;
  readonly name: string;
  readonly description: string;
  readonly encounterCount: number;
  readonly storyStep: number;
  readonly lastVisitDay?: number;
  readonly currentStoryBeat?: string;
}

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
  /** Condition-aware scores used to personalise customers' menu choices. */
  readonly conditionRatings?: Partial<Readonly<Record<HealthConditionId, number>>>;
  readonly intentFits?: Partial<Readonly<Record<NutritionIntent, number>>>;
}

/** Fully resolved player-facing terms for one preparation or frozen order line. */
export interface RuntimeServingTermsSummary {
  readonly priceCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
  readonly preparationTimeMs: number;
  readonly servingTimeMs: number;
  readonly eatingTimeMs: number;
  readonly starAppeal: number;
  readonly demandModifierBasisPoints: number;
}

export interface RuntimePreparationSummary {
  readonly preparationId: string;
  readonly dishId: string;
  readonly variantId?: string;
  readonly terms: RuntimeServingTermsSummary;
}

export type RuntimeMealRole = "main" | "side" | "drink";

export interface RuntimeComboComponentSummary {
  readonly preparationId: string;
  readonly dishId: string;
  readonly variantId?: string;
  readonly label: string;
  readonly variantLabel?: string;
  readonly servingLabel?: string;
  readonly role: RuntimeMealRole;
  readonly componentLabel: "Main" | "Drink" | "Dessert" | "Add-on";
  readonly terms: RuntimeServingTermsSummary;
  readonly availableStallCount: number;
}

export interface RuntimeComboRatingSummary {
  readonly value?: number;
  readonly dataState: "known" | "trace" | "unavailable";
  readonly explanation: string;
}

export interface RuntimeComboOfferSummary {
  readonly id: string;
  readonly slot: number;
  readonly preparationIds: readonly [string, string];
  readonly components?: readonly [RuntimeComboComponentSummary, RuntimeComboComponentSummary];
  readonly priceCents?: MoneyCents;
  readonly ingredientCostCents?: MoneyCents;
  readonly servingStopCount?: number;
  readonly routeDistanceTiles?: number;
  readonly valid: boolean;
  readonly issues: readonly string[];
  /** Comparative in-game balance among the fixed unlocked feasible meal universe. */
  readonly mealBalance: RuntimeComboRatingSummary;
  /** Fit for the leading current forecast intent, kept separate from Meal balance. */
  readonly intentFit: RuntimeComboRatingSummary & { readonly needId?: string };
  /** Visit-specific fit is frozen only after a guest with a condition-aware need orders. */
  readonly conditionAwareFit: RuntimeComboRatingSummary;
  readonly dataExplanation: string;
}

export interface RuntimeComboBoardSummary {
  readonly unlockLevel: 5;
  readonly unlocked: boolean;
  readonly slots: readonly [
    RuntimeComboOfferSummary | null,
    RuntimeComboOfferSummary | null,
    RuntimeComboOfferSummary | null,
  ];
  readonly candidates: readonly RuntimeComboComponentSummary[];
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly configuredOfferCount: number;
  readonly compatibilityWarning?: string;
  /** Temporary service-time status; saved offers remain intact while a needed stall is closed. */
  readonly liveAvailabilityWarning?: string;
}

export interface RuntimeFrozenMealSummary {
  readonly offerId: string;
  readonly components: readonly [RuntimeComboComponentSummary, RuntimeComboComponentSummary];
  readonly priceCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
  readonly chargedPriceCents: MoneyCents;
  readonly chargedIngredientCostCents: MoneyCents;
  readonly servingStopCount: number;
  readonly mealBalance: RuntimeComboRatingSummary;
  readonly intentFit: RuntimeComboRatingSummary & { readonly needId?: string };
  readonly conditionAwareFit: RuntimeComboRatingSummary;
  readonly explanationCodes: readonly string[];
  readonly settlementCause?: "complete" | "second-stall-unavailable" | "served-timeout" | "cancelled-before-service";
  readonly servedPreparationIds: readonly string[];
  readonly cancelledPreparationIds: readonly string[];
}

export interface RuntimeNutritionVariantSummary {
  readonly id: string;
  readonly label: string;
  readonly unlockRank: number;
  readonly profileId: string;
  readonly visualKey: string;
  readonly unlocked: boolean;
  readonly selected: boolean;
  readonly terms: RuntimeServingTermsSummary;
  readonly profile?: RuntimeNutritionProfileSummary;
}

export interface RuntimeNutritionFamilySummary {
  readonly dishId: string;
  /** Active preparation's taste-and-popularity score. */
  readonly starRating?: number;
  readonly defaultVariantId: string;
  readonly activeVariantId: string;
  readonly variants: readonly RuntimeNutritionVariantSummary[];
}

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
  /** Immutable serving terms captured when this order was accepted. */
  readonly servingTerms?: RuntimeServingTermsSummary;
  readonly profile?: RuntimeNutritionProfileSummary;
  /** Immutable two-component order terms, fit, routing, and settlement state. */
  readonly frozenMeal?: RuntimeFrozenMealSummary;
}

export interface RuntimeStallMastery {
  readonly definitionId: string;
  readonly points: number;
  readonly rank: number;
  readonly upgradeLevel: 1 | 2 | 3 | 4;
  /** Legacy authored whole-SGD catalogue display; the purchase boundary resolves it to MoneyCents. */
  readonly nextUpgradeCost?: number;
  readonly requiredRank?: number;
}

export interface RuntimeMilestoneTrack {
  readonly id: string;
  readonly title: string;
  readonly tier: number;
  readonly progress: number;
  readonly target: number;
}

export interface RuntimeStallSummary {
  readonly objectId: string;
  readonly definitionId: string;
  readonly name: string;
  readonly queueCount: number;
  readonly queueDirection: QueueDirection;
  readonly customQueue: boolean;
  readonly open: boolean;
}

export interface RuntimeSnapshot {
  readonly cashCents: MoneyCents;
  /** @deprecated Compatibility-only whole-SGD view. */
  cash: number;
  reputation: number;
  level: number;
  experience: number;
  /** Null is the explicit authored-level-cap sentinel. */
  nextLevelExperience: number | null;
  day: number;
  timeLabel: string;
  readonly servicePeriod: RuntimeServicePeriod;
  readonly forecast: RuntimeForecast;
  readonly neighbourhoodEvent?: RuntimeNeighbourhoodEventSummary;
  readonly activeParties?: readonly RuntimePartySummary[];
  readonly regularProgress?: readonly RuntimeRegularProgressSummary[];
  readonly periodLedger: RuntimePeriodLedger;
  readonly periodDebrief?: RuntimePeriodDebrief;
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
  buildTool: BuildTool;
  selectedBuildId?: string;
  selectedObjectId?: string;
  selectedObjectDefinitionId?: string;
  unlockedContentIds: readonly string[];
  stallMenus: Readonly<Record<string, readonly string[]>>;
  activeDishVariants: Readonly<Record<string, string>>;
  activePreparations: readonly RuntimePreparationSummary[];
  comboBoard: RuntimeComboBoardSummary;
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

export interface RuntimeEvent {
  kind: "info" | "success" | "warning" | "error";
  message: string;
  importance?: "routine" | "important";
  groupKey?: string;
  /** UI aggregation DTO; validated core events are converted before display. */
  amountCents?: number;
  /** @deprecated Use amountCents for monetary events. */
  amount?: number;
}

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

export interface RuntimeController {
  destroy(): void;
  selectBuildItem(itemId?: string): void;
  setBuildTool(tool: BuildTool): void;
  rotateSelection(): void;
  undo(): void;
  toggleOpen(): boolean;
  setStallOpen(objectId: string, open: boolean): boolean;
  setSpeed(speed: GameSpeed): void;
  setQuality(quality: QualityMode): void;
  setReducedMotion(enabled: boolean): void;
  setHighContrast(enabled: boolean): void;
  /** Updates text drawn inside the game canvas independently of DOM CSS. */
  setTextScale(scale: number): void;
  setDebugOverlay(enabled: boolean): void;
  zoomBy(delta: number): void;
  centreCamera(): void;
  exportState(): unknown;
  importState(value: unknown): void;
  reset(): void;
  spawnCustomer(): void;
  addCash(amountCents: number): void;
  expandMap(): boolean;
  beginQueueEdit(objectId: string): boolean;
  setQueueDirection(objectId: string, direction: QueueDirection): boolean;
  finishQueueEdit(): void;
  setDishEnabled(stallId: string, dishId: string, enabled: boolean): boolean;
  setDishVariant(dishId: string, variantId: string): boolean;
  setComboOffer(
    slot: 0 | 1 | 2,
    mainPreparationId: string,
    complementPreparationId: string,
  ): boolean;
  clearComboOffer(slot: 0 | 1 | 2): boolean;
  /** Resolves the current planning event with one authored choice. */
  chooseNeighbourhoodEvent(choiceId: string): boolean;
  /** Applies the event's documented neutral outcome during planning. */
  dismissNeighbourhoodEvent(): boolean;
  acceptObjective(objectiveId: string): boolean;
  /** Declines the complete three-offer board for the current period. */
  skipObjective(): boolean;
  selectCustomer(customerId?: string): void;
  addAccessPoint(kind: AccessPoint["kind"]): void;
  selectAccessPoint(accessPointId?: string): void;
  removeSelectedAccessPoint(): boolean;
  clearGuestRoute(): boolean;
  upgradeStall(definitionId: string): boolean;
}

export interface RuntimeOptions {
  parent: HTMLElement;
  settings: RuntimeSettings;
  initialStates?: readonly unknown[];
  onSnapshot(snapshot: RuntimeSnapshot): void;
  onEvent(event: RuntimeEvent): void;
  onPersistentChange(state: unknown): void;
}
