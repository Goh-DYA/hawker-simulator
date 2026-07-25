"use client";

import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Clock3,
  Focus as FocusIcon,
  Grid3X3,
  Lightbulb,
  Save as SaveIcon,
  Store,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  CUSTOMER_ARCHETYPES,
  DISHES,
  ENGLISH_LOCALIZATION,
  getNutritionProfile,
  PLACEABLES,
  STALLS,
  validateContent,
  type DishDefinition,
  type PlaceableDefinition,
  type StallDefinition,
} from "@/src/content";
import { AudioDirector } from "@/src/game/audio/AudioDirector";
import {
  MAIN_GAME_SCOPE,
  clearScopedGame,
  deserializeProgressBundle,
  eraseAllProgress,
  exportProgressBundle,
  importProgressBundle,
  loadMetaProgression,
  loadPreference,
  loadScopedGameCandidates,
  resetMainProgress,
  saveMetaProgression,
  savePreference,
  saveScopedGame,
  scenarioGameScope,
  type GameSaveScope,
  type ProgressBundleSnapshot,
  type ProgressBundleValidators,
} from "@/src/game/persistence/saveStore";
import { registerPwa } from "@/src/game/pwa/registerPwa";
import { asMoneyCents, asMoneyDeltaCents } from "@/src/game/core/money";
import {
  acceptMasteryOfferInMeta,
  applyMasteryPeriodDebriefToMeta,
  createEmptyMetaProgression,
  deriveMasteryOffer,
  masteryProgressionFromMeta,
  skipMasteryOfferInMeta,
  type MasteryPeriodDebrief,
  type MetaProgressionV1,
} from "@/src/game/core/strategicProgression";
import {
  derivePeriodForecast,
  lockForecastAudience,
  profileForPeriod,
} from "@/src/game/core/forecast";
import {
  SCENARIOS,
  type MasteryContractTemplate,
  type ScenarioId,
  type ScenarioMedal,
  type ScenarioScoreUnit,
} from "@/src/content/strategicGameplay";
import { utilityEffectsForPlaceable } from "@/src/game/runtime/contentUtility";
import { describeSgd, formatSgd } from "@/src/game/runtime/money";
import { defaultStallMenusForProgression } from "@/src/game/runtime/stallMenus";
import {
  activityEntryAccessibleMessage,
  activityEntryMessage,
  appendActivityEvent,
  shouldShowPopup,
  type ActivityEntry,
} from "@/src/game/runtime/activityFeed";
import {
  CUSTOMER_INDICATOR_LEGEND,
  visualRecipeForDish,
  visualRecipeForPlaceable,
  type CustomerIndicator,
} from "@/src/game/runtime/visualRecipes";
import type {
  BuildTool,
  GameSpeed,
  RuntimeController,
  RuntimeComboBoardSummary,
  RuntimeComboComponentSummary,
  RuntimeComboRatingSummary,
  RuntimeFrozenMealSummary,
  RuntimeNeighbourhoodEventSummary,
  RuntimeEvent,
  RuntimeForecast,
  RuntimeObjective,
  RuntimePartySummary,
  RuntimePeriodDebrief,
  RuntimePeriodLedger,
  RuntimeRegularProgressSummary,
  RuntimeServicePeriod,
  RuntimeSettings,
  RuntimeSnapshot,
} from "@/src/game/runtime/types";
import {
  customerVariantLabel,
  CustomerNutritionInspector,
  DishRatingSummary,
  dialogFocusAction,
  NutritionDisclosure,
  NutritionProfileSummary,
  NutritionPulseCard,
  preparationDurationLabel,
  PreparationTermsSummary,
  VariantLabDialog,
  type NutritionFamilyView,
  type NutritionProfileView,
  type NutritionPulseView,
  type PreparationTermsView,
} from "./NutritionEducation";
import { StrategicChallenges } from "./StrategicChallenges";
import {
  buildMasteryPanelView,
  buildMetaGallery,
  buildScenarioProgress,
  masteryFeasibilityContext,
} from "./strategicChallengeModel";

const INITIAL_LEVEL = 1;
const INITIAL_REPUTATION = 8;
const INITIAL_CASH_CENTS = asMoneyCents(420_000);
const ZERO_CENTS = asMoneyCents(0);
const ZERO_DELTA_CENTS = asMoneyDeltaCents(0);
const INITIAL_UNLOCKED_CONTENT_IDS = [...new Set(
  [...PLACEABLES, ...STALLS]
    .filter((definition) => definition.unlockRequirement.level <= INITIAL_LEVEL)
    .map((definition) => definition.id),
)].sort();
const INITIAL_ELIGIBLE_FORECAST_PERSONA_IDS = CUSTOMER_ARCHETYPES
  .filter((persona) => (
    persona.unlockRequirement.level <= INITIAL_LEVEL
    && persona.unlockRequirement.reputation <= INITIAL_REPUTATION
    && persona.unlockRequirement.prerequisiteIds.every((id) => (
      INITIAL_UNLOCKED_CONTENT_IDS.includes(id)
    ))
  ))
  .map((persona) => persona.id);
const INITIAL_CORE_FORECAST = lockForecastAudience(
  derivePeriodForecast(profileForPeriod("breakfast"), 1, 1),
  INITIAL_ELIGIBLE_FORECAST_PERSONA_IDS,
);
export const INITIAL_RUNTIME_FORECAST: RuntimeForecast = {
  periodSequenceId: INITIAL_CORE_FORECAST.periodSequenceId,
  periodId: INITIAL_CORE_FORECAST.periodId,
  day: INITIAL_CORE_FORECAST.day,
  demandRange: INITIAL_CORE_FORECAST.demandRange,
  crowdProfiles: INITIAL_CORE_FORECAST.crowdProfiles,
  budgetBands: INITIAL_CORE_FORECAST.budgetBands,
  groupSizeMix: INITIAL_CORE_FORECAST.groupSizeMix,
  mealMix: INITIAL_CORE_FORECAST.mealMix,
  nutritionIntents: INITIAL_CORE_FORECAST.nutritionNeeds.filter(
    (need) => need.kind === "nutrition-intent",
  ),
  conditionAwareNeeds: INITIAL_CORE_FORECAST.nutritionNeeds.filter(
    (need) => need.kind === "condition-aware",
  ),
  nutritionIntentIncidenceBasisPoints:
    INITIAL_CORE_FORECAST.nutritionIntentIncidenceBasisPoints,
  conditionAwareIncidenceBasisPoints:
    INITIAL_CORE_FORECAST.conditionAwareIncidenceBasisPoints,
  needShareBasis: INITIAL_CORE_FORECAST.needShareBasis,
  coverage: [],
  menuIndependent: true,
  explanation:
    "Needs are forecast independently of the menu. Coverage reflects active preparations.",
};

export function latestRuntimeSavePayload(
  controller: Pick<RuntimeController, "exportState"> | undefined,
  pendingPayload: unknown,
): unknown {
  const freshPayload = controller?.exportState();
  return freshPayload === undefined ? pendingPayload : freshPayload;
}

const INITIAL_SNAPSHOT: RuntimeSnapshot = {
  cashCents: INITIAL_CASH_CENTS,
  cash: 4_200,
  reputation: INITIAL_REPUTATION,
  level: INITIAL_LEVEL,
  experience: 0,
  nextLevelExperience: 120,
  day: 1,
  timeLabel: "06:00",
  servicePeriod: {
    sequenceId: 1,
    day: 1,
    id: "breakfast",
    label: "Breakfast",
    phase: "planning",
    startMinute: 360,
    endMinute: 600,
    clockLabel: "06:00",
    arrivalElapsedMs: 0,
    drainElapsedMs: 0,
    arrivalRemainingMs: 240_000,
    drainRemainingMs: 180_000,
    configurationLocked: false,
    canAdvance: true,
    actionLabel: "Start breakfast",
  },
  forecast: INITIAL_RUNTIME_FORECAST,
  periodLedger: {
    periodSequenceId: 1,
    openingCashCents: INITIAL_CASH_CENTS,
    grossSalesCents: ZERO_CENTS,
    ingredientCostsCents: ZERO_CENTS,
    refundsCents: ZERO_CENTS,
    purchasesCents: ZERO_CENTS,
    resaleCents: ZERO_CENTS,
    upkeepCents: ZERO_CENTS,
    objectiveRewardsCents: ZERO_CENTS,
    milestoneRewardsCents: ZERO_CENTS,
    recoveryCents: ZERO_CENTS,
    contributionCents: ZERO_DELTA_CENTS,
    operatingMargin: undefined,
    recordedCashMovementCents: ZERO_DELTA_CENTS,
    actualCashMovementCents: ZERO_DELTA_CENTS,
    reconciliationDeltaCents: ZERO_DELTA_CENTS,
    reconcilesToCash: true,
    entries: [],
  },
  isOpen: false,
  speed: 1,
  quality: "standard",
  activeCustomers: 0,
  servedCustomers: 0,
  averageSatisfaction: 100,
  hasSatisfactionRatings: false,
  satisfactionTips: [],
  queuePressure: 0,
  queueFlowState: "good",
  queueFlowMessage: "No queues are forming and every stall approach is clear.",
  freeSeats: 8,
  totalSeats: 8,
  cleanliness: 100,
  trayReturnStations: 1,
  buildTool: "select",
  routeGuidePoints: [],
  unlockedContentIds: INITIAL_UNLOCKED_CONTENT_IDS,
  stallMenus: defaultStallMenusForProgression({
    level: INITIAL_LEVEL,
    reputation: INITIAL_REPUTATION,
  }),
  activeDishVariants: {},
  unlockedPreparationCount: 0,
  activePreparations: [],
  comboBoard: {
    unlockLevel: 5,
    unlocked: false,
    slots: [null, null, null],
    candidates: [],
    valid: true,
    issues: [],
    configuredOfferCount: 0,
  },
  nutritionFamilies: [],
  nutritionPulse: {
    servedMeals: 0,
    profiledMeals: 0,
    intentRequests: 0,
    intentMatches: 0,
    intentMisses: 0,
    intentUnknowns: 0,
    averages: {},
    knownCounts: {
      energyKcal: 0,
      proteinG: 0,
      dietaryFibreG: 0,
      sodiumMg: 0,
    },
  },
  placedStalls: [],
  canUndo: false,
  objectiveProgress: 0,
  objectiveTarget: 5,
  objectives: [],
  objectiveRefreshLabel: "Choose now",
  claimedMilestoneCount: 0,
  milestoneTracks: [],
  stallMastery: [],
  accessPoints: [
    { id: "entrance-1", kind: "entrance", position: { x: 0, y: 7 } },
    { id: "exit-1", kind: "exit", position: { x: 23, y: 7 } },
  ],
  expansionCount: 0,
  nextExpansionCost: 1_000,
  fps: 60,
  simulationMs: 0,
  autosaveState: "saved",
};

const DEFAULT_SETTINGS: RuntimeSettings = {
  quality: "standard",
  reducedMotion: false,
  highContrast: false,
  textScale: 1,
  musicVolume: 0.32,
  ambienceVolume: 0.24,
  sfxVolume: 0.55,
  masterMuted: false,
};

function normalizeSettings(
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
    textScale: Math.max(1, Math.min(2, number("textScale", 1))),
    musicVolume: Math.max(0, Math.min(1, number("musicVolume", 0.32))),
    ambienceVolume: Math.max(0, Math.min(1, number("ambienceVolume", number("musicVolume", 0.24)))),
    sfxVolume: Math.max(0, Math.min(1, number("sfxVolume", 0.55))),
    masterMuted: typeof record.masterMuted === "boolean" ? record.masterMuted : false,
  };
}

type Panel =
  | "focus"
  | "build"
  | "stalls"
  | "dishes"
  | "challenges"
  | "insights"
  | "activity";
type TutorialStep = 0 | 1 | 2 | 3 | 4 | 5;
type NutritionTourStep = 0 | 1 | 2;

const MANAGEMENT_SECTIONS = [
  { value: "focus", label: "Focus" },
  { value: "build", label: "Build" },
  { value: "stalls", label: "Stalls" },
  { value: "dishes", label: "Dishes" },
  { value: "challenges", label: "Challenges" },
  { value: "insights", label: "Insights" },
  { value: "activity", label: "Activity" },
] as const satisfies readonly { readonly value: Panel; readonly label: string }[];

export function panelSelectionIsVisible(
  overlayManagement: boolean,
  managementSheetOpen: boolean,
): boolean {
  return !overlayManagement || managementSheetOpen;
}

export function shouldRestoreManagementFocus(
  closeRequested: boolean,
  focusWasInsideSheet: boolean,
  returnFocusConnected: boolean,
  anotherModalOpen: boolean,
): boolean {
  return (
    (closeRequested || focusWasInsideSheet)
    && returnFocusConnected
    && !anotherModalOpen
  );
}

export function revealScrollableControl(
  control: Pick<HTMLElement, "scrollIntoView">,
  reducedMotion: boolean,
) {
  control.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "nearest",
    inline: "nearest",
  });
}

type ForecastNeedView = RuntimeForecast["nutritionIntents"][number];

export interface GuidedDecisionOption {
  readonly dishId: string;
  readonly responseId: string;
  readonly label: string;
  readonly variantLabel?: string;
  readonly terms: PreparationTermsView;
  readonly profile?: NutritionProfileView;
  readonly intentFit?: number;
}

interface GuidedDecision {
  readonly needId: string;
  readonly needLabel: string;
  readonly options: readonly [GuidedDecisionOption, GuidedDecisionOption];
}

const PANEL_COPY: Readonly<Record<Panel, { kicker: string; title: string }>> = {
  focus: { kicker: "Today at a glance", title: "Focus" },
  build: { kicker: "Build catalogue", title: "Make it yours" },
  stalls: { kicker: "Food & drink", title: "Stalls" },
  dishes: { kicker: "Dishes & nutrition", title: "Menu planning" },
  challenges: { kicker: "Scenarios & mastery", title: "Challenges" },
  insights: { kicker: "Service review", title: "Centre insights" },
  activity: { kicker: "Recent events", title: "Activity" },
};

const ACTIVE_SCOPE_PREFERENCE = "active-game-scope-v1";
const MAIN_LEVEL_PREFERENCE = "main-progression-level-v1";
const MASTERY_SEED = "hawker-balance-mastery-v1";
const SCENARIO_ID_SET = new Set<ScenarioId>(
  SCENARIOS.map((scenario) => scenario.id),
);
const SCENARIO_MEDAL_RANK: Readonly<Record<ScenarioMedal, number>> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && SCENARIO_ID_SET.has(value as ScenarioId);
}

export function parseActiveGameScope(value: unknown): GameSaveScope {
  if (
    value &&
    typeof value === "object" &&
    (value as { kind?: unknown }).kind === "scenario" &&
    isScenarioId((value as { scenarioId?: unknown }).scenarioId)
  ) {
    return scenarioGameScope(
      (value as { scenarioId: ScenarioId }).scenarioId,
    );
  }
  return MAIN_GAME_SCOPE;
}

function sameGameScope(left: GameSaveScope, right: GameSaveScope): boolean {
  return (
    left.kind === right.kind &&
    (
      left.kind === "main" ||
      (
        right.kind === "scenario" &&
        left.scenarioId === right.scenarioId
      )
    )
  );
}

export interface LocalDataOperationGate {
  current: boolean;
}

export function claimLocalDataOperation(
  gate: LocalDataOperationGate,
): boolean {
  if (gate.current) return false;
  gate.current = true;
  return true;
}

export function releaseLocalDataOperation(
  gate: LocalDataOperationGate,
): void {
  gate.current = false;
}

export function canCaptureLifecycleSave(
  gate: LocalDataOperationGate,
): boolean {
  return !gate.current;
}

export async function runSerializedProgressExport<T>(input: {
  readonly controller?: Pick<RuntimeController, "setSpeed">;
  readonly previousSpeed: GameSpeed;
  readonly flushCore: () => Promise<unknown>;
  readonly flushMeta: () => Promise<unknown>;
  readonly exportBundle: () => Promise<T>;
}): Promise<T> {
  input.controller?.setSpeed(0);
  try {
    await input.flushCore();
    await input.flushMeta();
    return await input.exportBundle();
  } finally {
    input.controller?.setSpeed(input.previousSpeed);
  }
}

function humanizeScenarioCode(value: string): string {
  return value
    .replace(/^scenario\./, "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function scenarioScoreUnitLabel(unit: ScenarioScoreUnit): string {
  switch (unit) {
    case "points":
      return "points";
    case "contribution-cents":
      return "contribution";
    case "distinct-preparations":
      return "preparations";
    case "completed-visits":
      return "completed visits";
  }
}

function scenarioScoreLabel(value: number, unit: ScenarioScoreUnit): string {
  return unit === "contribution-cents"
    ? `${formatSgd(value, "ledger")} contribution`
    : `${value.toLocaleString("en-SG")} ${scenarioScoreUnitLabel(unit)}`;
}

export function scenarioFailureGuidance(code: string): string {
  const known: Readonly<Record<string, string>> = {
    "scenario-incomplete":
      "Finish the authored service period and reach its debrief before the run can earn a medal.",
    "ledger-not-reconciled":
      "The run did not reconcile to the cent and cannot earn a medal.",
    "contribution-mismatch":
      "The reported contribution did not match sales minus ingredient costs, upkeep, and refunds.",
    "cash-went-negative":
      "Keep the isolated scenario balance at or above SGD 0 throughout the run.",
    "score-below-bronze":
      "The scored result is below the Bronze threshold shown on the scenario card.",
    "flow-too-low":
      "Open a clearer route between the entrance, stalls, seating, and return point.",
    "route-reliability-too-low":
      "Check that every service and seating destination remains reachable.",
    "completion-rate-too-low":
      "Reduce waits and protect serving capacity through the peak.",
    "meal-role-spread-too-small":
      "Serve more distinct reviewed preparations across the required meal roles.",
    "zone-coverage-missing":
      "Complete at least one visit in each authored seating zone.",
    "zone-balance-too-low":
      "Serve both hall zones instead of concentrating every completed visit on one side.",
    "wait-too-long":
      "Shorten queues and place the required stalls closer to guest routes.",
    "recovery-used":
      "Finish with the scenario's starting resources without a recovery grant.",
  };
  return known[code] ?? humanizeScenarioCode(code);
}

export function remainingScenarioFailureCodes(
  failureCodes: readonly string[],
  nextMedalConstraintFailureCodes: readonly string[] = [],
): readonly string[] {
  const nextMedalFailures = new Set(nextMedalConstraintFailureCodes);
  return [...new Set(failureCodes)].filter(
    (code) => !nextMedalFailures.has(code),
  );
}

export function recordScenarioResultInMeta(
  meta: MetaProgressionV1,
  scenario: NonNullable<RuntimeSnapshot["scenario"]>,
): MetaProgressionV1 {
  if (!scenario.runComplete || !scenario.medal) return meta;
  const previous = meta.scenarioMedals[scenario.scenarioId];
  const best = previous &&
      SCENARIO_MEDAL_RANK[previous] > SCENARIO_MEDAL_RANK[scenario.medal]
    ? previous
    : scenario.medal;
  return {
    ...meta,
    scenarioMedals: {
      ...meta.scenarioMedals,
      [scenario.scenarioId]: best,
    },
    unlockedCosmeticIds: [
      ...new Set([
        ...meta.unlockedCosmeticIds,
        ...scenario.cosmeticRewardIds,
      ]),
    ].sort((left, right) => left.localeCompare(right)),
  };
}

export function resetMetaForFreshMain(
  meta: MetaProgressionV1,
): MetaProgressionV1 {
  return {
    ...meta,
    mastery: { schemaVersion: 1 },
  };
}

export function masteryPeriodDebriefFromSnapshot(
  snapshot: RuntimeSnapshot,
): MasteryPeriodDebrief | undefined {
  const debrief = snapshot.periodDebrief;
  if (!debrief) return undefined;
  const masteryMetrics = debrief.masteryMetrics;
  const comparison = debrief.forecastComparison;
  return {
    periodSequenceId: debrief.periodSequenceId,
    completedVisits: Math.max(
      0,
      debrief.servedVisits - debrief.timedOutServedVisits,
    ),
    grossSalesCents: snapshot.periodLedger.grossSalesCents,
    contributionCents: snapshot.periodLedger.contributionCents,
    ...(masteryMetrics.minimumSatisfaction === undefined
      ? {}
      : { minimumSatisfaction: masteryMetrics.minimumSatisfaction }),
    ...(masteryMetrics.medianWaitSeconds === undefined
      ? {}
      : { medianWaitSeconds: masteryMetrics.medianWaitSeconds }),
    flowSeconds: masteryMetrics.flowSeconds,
    distinctPreparationIds: masteryMetrics.distinctPreparationIds,
    partyVisits: debrief.partyVisits,
    trayReturns: masteryMetrics.trayReturns,
    trayReturnOpportunities: masteryMetrics.trayReturnOpportunities,
    forecastNeedsMet: comparison.nutritionMatches,
    refundCents: snapshot.periodLedger.refundsCents,
    comboVisits: debrief.completedComboVisits,
  };
}

export type MasteryDebriefSaveStatus = "idle" | "saving" | "error";

export function masteryDebriefContinuePresentation(
  status: MasteryDebriefSaveStatus,
  actionLabel: string,
): {
  readonly disabled: boolean;
  readonly label: string;
  readonly statusMessage?: string;
} {
  if (status === "saving") {
    return {
      disabled: true,
      label: "Saving mastery progress\u2026",
      statusMessage:
        "Mastery progress is being saved before the next period opens.",
    };
  }
  if (status === "error") {
    return {
      disabled: false,
      label: "Retry save and continue",
      statusMessage:
        "Mastery progress was not saved. Retry before opening the next period.",
    };
  }
  return {
    disabled: false,
    label: actionLabel,
  };
}

export async function ensureMasteryDebriefSaved(
  currentSave: Promise<boolean>,
  pendingDebrief: MasteryPeriodDebrief | undefined,
  expectedPeriodSequenceId: number,
  retry: (debrief: MasteryPeriodDebrief) => Promise<boolean>,
): Promise<"saved" | "missing" | "failed"> {
  if (await currentSave) return "saved";
  if (
    !pendingDebrief ||
    pendingDebrief.periodSequenceId !== expectedPeriodSequenceId
  ) {
    return "missing";
  }
  return await retry(pendingDebrief) ? "saved" : "failed";
}

export function dishMenuUsesMainProgressionGate(
  scenarioMenuFixed: boolean,
  requirement: {
    readonly level: number;
    readonly reputation: number;
    readonly prerequisiteIds: readonly string[];
  },
  progression: {
    readonly level: number;
    readonly reputation: number;
    readonly unlockedContentIds: readonly string[];
  },
): boolean {
  return !scenarioMenuFixed && (
    requirement.level > progression.level ||
    requirement.reputation > progression.reputation ||
    requirement.prerequisiteIds.some(
      (id) => !progression.unlockedContentIds.includes(id),
    )
  );
}

const EMPTY_NUTRITION_PULSE = {
  servedMeals: 0,
  profiledMeals: 0,
  intentRequests: 0,
  intentMatches: 0,
  intentMisses: 0,
  intentUnknowns: 0,
  averages: {},
  knownCounts: {
    energyKcal: 0,
    proteinG: 0,
    dietaryFibreG: 0,
    sodiumMg: 0,
  },
} as const;

const subscribeToStaticValue = () => () => undefined;
const getDebugSnapshot = () =>
  process.env.NODE_ENV !== "production" &&
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("debug");
const getServerDebugSnapshot = () => false;

interface Toast extends RuntimeEvent {
  id: number;
}

function localize(key: string) {
  return ENGLISH_LOCALIZATION[key] ?? key;
}

type CustomerLegendSymbol = CustomerIndicator | "patience";

function CustomerIndicatorIcon({ indicator }: { indicator: CustomerLegendSymbol }) {
  if (indicator === "patience") {
    return (
      <svg
        className="customer-indicator-icon is-patience"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.28" />
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="#e8b94f"
          strokeWidth="2.5"
          strokeDasharray="30 21"
          transform="rotate(-90 12 12)"
        />
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="#c75542"
          strokeWidth="2.5"
          strokeDasharray="10 41"
          strokeDashoffset="-31"
          transform="rotate(-90 12 12)"
        />
      </svg>
    );
  }

  let glyph;
  if (indicator === "question") {
    glyph = (
      <>
        <circle cx="12" cy="9" r="3.5" />
        <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
      </>
    );
  } else if (indicator === "footsteps") {
    glyph = (
      <>
        <ellipse cx="8.5" cy="14" rx="1.8" ry="3.6" fill="currentColor" stroke="none" />
        <ellipse cx="15.5" cy="10" rx="1.8" ry="3.6" fill="currentColor" stroke="none" />
      </>
    );
  } else if (indicator === "queue") {
    glyph = [7, 12, 17].map((cx) => (
      <circle key={cx} cx={cx} cy="12" r="1.7" fill="currentColor" stroke="none" />
    ));
  } else if (indicator === "order") {
    glyph = (
      <>
        <rect x="6" y="6.5" width="12" height="8.5" rx="2" />
        <path d="M10 15 8 19 8.5 15" />
      </>
    );
  } else if (indicator === "clock") {
    glyph = (
      <>
        <circle cx="12" cy="12" r="6" />
        <path d="M12 12V8M12 12l4 2" />
      </>
    );
  } else if (indicator === "seat") {
    glyph = <path d="M7 6v11M7 13h10M17 13v5" />;
  } else if (indicator === "meal") {
    glyph = (
      <>
        <circle cx="13" cy="12" r="5.5" />
        <path d="M6 6v12" />
      </>
    );
  } else if (indicator === "return") {
    glyph = <path d="M18 12H6m0 0 4-4m-4 4 4 4" />;
  } else {
    glyph = <path d="M6 12h12m0 0-4-4m4 4-4 4" />;
  }

  return (
    <svg
      className={`customer-indicator-icon is-${indicator}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="customer-indicator-bubble" cx="12" cy="12" r="10" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </g>
    </svg>
  );
}

function CustomerStatusLegend() {
  return (
    <div className="customer-status-legend">
      <p>The bubble above each customer shows what they are doing now.</p>
      <ul data-testid="customer-status-legend">
        {CUSTOMER_INDICATOR_LEGEND.map((entry) => (
          <li key={entry.indicator}>
            <CustomerIndicatorIcon indicator={entry.indicator} />
            <span>
              <strong>{entry.label}</strong>
              <small>{entry.description}</small>
            </span>
          </li>
        ))}
        <li>
          <CustomerIndicatorIcon indicator="patience" />
          <span>
            <strong>Patience ring</strong>
            <small>
              Shows patience remaining from the queue. It turns red when low and remains visible
              while food is prepared.
            </small>
          </span>
        </li>
      </ul>
    </div>
  );
}

function CustomerStatusGuide() {
  const [open, setOpen] = useState(false);

  return (
    <section className="settings-guide" aria-label="Customer status icon guide">
      <button
        type="button"
        aria-label="Customer status bubbles"
        aria-expanded={open}
        aria-controls="customer-status-legend-content"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>Customer status bubbles</strong>
          <small>See what every on-map symbol means</small>
        </span>
      </button>
      {open ? (
        <div id="customer-status-legend-content">
          <CustomerStatusLegend />
        </div>
      ) : null}
    </section>
  );
}

function legacySgdCents(value: number) {
  return Math.round(value * 100);
}

function SgdAmount({
  cents,
  ledger = false,
}: {
  cents: number;
  ledger?: boolean;
}) {
  return (
    <>
      <span aria-hidden="true">{formatSgd(cents, ledger ? "ledger" : "compact")}</span>
      <span className="sr-only">{describeSgd(cents)}</span>
    </>
  );
}

export function scenarioBreakdownLabel(id: string): string {
  const labels: Readonly<Record<string, string>> = {
    completion: "Completed-service points",
    "route-reliability": "Route-reliability points",
    flow: "Flow points",
    "controlled-waits": "Controlled-wait points",
    "zone-balance": "Zone-balance points",
    "both-zones-served": "Both-zone coverage points",
    "contribution-cents": "Contribution",
    "distinct-preparations": "Distinct preparations served",
    "distinct-meal-roles": "Distinct meal roles served",
    "completed-visits": "Completed visits",
    "completion-basis-points": "Completion rate",
    "median-wait-ms": "Median service wait",
  };
  return labels[id] ?? titleFromId(id);
}

function medalLabel(medal: ScenarioMedal): string {
  return `${medal[0]!.toUpperCase()}${medal.slice(1)}`;
}

function ScenarioScoreValue({
  value,
  unit,
}: {
  value: number;
  unit: ScenarioScoreUnit;
}) {
  if (unit === "contribution-cents") {
    return (
      <>
        <SgdAmount cents={value} />
        <span> contribution</span>
      </>
    );
  }
  const suffix = unit === "points"
    ? "points"
    : unit === "distinct-preparations"
      ? value === 1 ? "preparation" : "preparations"
      : value === 1 ? "completed visit" : "completed visits";
  return <>{value.toLocaleString("en-SG")} {suffix}</>;
}

function ScenarioBreakdownValue({
  entry,
}: {
  entry: NonNullable<RuntimeSnapshot["scenario"]>["breakdown"][number];
}) {
  if (entry.id === "contribution-cents") {
    return <SgdAmount cents={entry.value} />;
  }
  if (entry.id === "completion-basis-points") {
    return <>{(entry.value / 100).toLocaleString("en-SG", {
      maximumFractionDigits: 1,
    })}%</>;
  }
  if (entry.id === "median-wait-ms") {
    return <>{(entry.value / 1_000).toLocaleString("en-SG", {
      maximumFractionDigits: 1,
    })} seconds</>;
  }
  if (entry.maximum !== undefined) {
    const suffix = entry.id === "distinct-meal-roles" ? "roles" : "points";
    return <>{entry.value.toLocaleString("en-SG")} of{" "}
      {entry.maximum.toLocaleString("en-SG")} {suffix}</>;
  }
  const suffix = entry.id === "distinct-preparations"
    ? entry.value === 1 ? "preparation" : "preparations"
    : entry.id === "completed-visits"
      ? entry.value === 1 ? "completed visit" : "completed visits"
      : "";
  return <>{entry.value.toLocaleString("en-SG")}{suffix ? ` ${suffix}` : ""}</>;
}

function catalogueIcon(category: PlaceableDefinition["category"] | "stall") {
  const icons: Record<string, string> = {
    table: "▦",
    seat: "◒",
    "stall-fixture": "▤",
    "tray-waste": "↺",
    lighting: "✦",
    fan: "✣",
    plant: "♧",
    signage: "▱",
    divider: "╫",
    facility: "⬡",
    decor: "◆",
    stall: "▰",
  };
  return icons[category] ?? "◇";
}

function getContentPrice(item: PlaceableDefinition | StallDefinition) {
  return "purchaseCost" in item ? item.purchaseCost : item.price;
}

function getContentPriceCents(item: PlaceableDefinition | StallDefinition) {
  return legacySgdCents(getContentPrice(item));
}

const SERVICE_PHASE_LABELS: Readonly<Record<RuntimeServicePeriod["phase"], string>> = {
  planning: "Planning",
  arrivals: "Arrivals open",
  draining: "Finishing current visits",
  debrief: "Period debrief",
};

const DEBRIEF_CAUSE_LABELS: Readonly<Record<RuntimePeriodDebrief["causeCodes"][number], string>> = {
  "period-complete": "The period cohort finished service.",
  "served-timeout": "A served visit reached the drain watchdog and received the explicit timeout result.",
  "unserved-departure": "An unserved guest departed with no sale or experience awarded.",
  "partial-meal-second-stall-unavailable": "A two-item meal became partial after its second stall became unavailable. Only the served component was charged.",
  "partial-meal-served-timeout": "A two-item meal became partial at the drain watchdog. Only the served component was charged.",
};

const FORECAST_LABELS: Readonly<Record<string, string>> = {
  value: "Value budgets",
  everyday: "Everyday budgets",
  flexible: "Flexible budgets",
  solo: "Solo visits",
  pair: "Pairs",
  "small-group": "Groups of three",
  "group-four": "Groups of four",
  "group-five": "Groups of five",
  "group-six": "Groups of six",
  "main-only": "Main only",
  "main-and-drink": "Main and drink",
  "main-and-side": "Main and side",
  "light-bite": "Light bite",
  "drink-led": "Drink-led visit",
  "lighter-energy": "Lighter energy",
  "protein-forward": "Protein-forward",
  "fibre-forward": "Fibre-forward",
  "sodium-aware": "Sodium-aware",
  "lower-total-sugar-drink": "Lower total sugar drink",
  diabetes: "Diabetes-aware visit need",
  hypertension: "Hypertension-aware visit need",
  "high-cholesterol": "Cholesterol-aware visit need",
  obesity: "Weight-management-aware visit need",
};

const SATISFACTION_CAUSE_LABELS = {
  foodQuality: "Food quality",
  wait: "Waiting experience",
  value: "Value for the visit budget",
  walking: "Walking distance",
  comfort: "Seating comfort",
  cleanliness: "Cleanliness",
  ambience: "Ambience",
} as const;

function highestCountEntry(values: Readonly<Record<string, number>>) {
  return Object.entries(values).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0];
}

function titleFromId(id: string) {
  const bare = id.replace(/^(customer|intent|condition)\./, "");
  return FORECAST_LABELS[bare]
    ?? bare.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function forecastShareLabel(basisPoints: number) {
  const percentage = basisPoints / 100;
  return `${percentage.toFixed(Number.isInteger(percentage) ? 0 : 1)}%`;
}

function forecastNeedLabel(need: ForecastNeedView | string) {
  if (typeof need === "string") return titleFromId(need);
  return titleFromId(need.nutritionIntent ?? need.healthCondition ?? need.id);
}

type SatisfactionCause = keyof typeof SATISFACTION_CAUSE_LABELS;

const SATISFACTION_NEXT_ACTIONS: Readonly<Record<SatisfactionCause, string>> = {
  foodQuality: "Compare the available preparation trade-offs before the next service.",
  wait: "Inspect queue pressure and preparation times before the next service.",
  value: "Compare the forecast budget bands with menu prices before the next service.",
  walking: "Inspect guest routes and stall-to-seat distance before the next service.",
  comfort: "Review the available seating and comfort signals before the next service.",
  cleanliness: "Review the cleanliness result before the next service.",
  ambience: "Review the ambience result during the next planning period.",
};

export function debriefTryNextCopy(
  forecast: Pick<RuntimeForecast, "coverage" | "nutritionIntents" | "conditionAwareNeeds">,
  comparison: RuntimePeriodDebrief["forecastComparison"] | undefined,
  lowestSatisfactionCauses: readonly (readonly [SatisfactionCause, number])[],
): string | undefined {
  const needsById = new Map(
    [...forecast.nutritionIntents, ...forecast.conditionAwareNeeds].map((need) => [need.id, need]),
  );
  const leadingGap = forecast.coverage
    .filter((coverage) => !coverage.covered)
    .sort((left, right) => (
      (needsById.get(right.needId)?.basisPoints ?? 0)
      - (needsById.get(left.needId)?.basisPoints ?? 0)
      || left.needId.localeCompare(right.needId)
    ))[0];
  if (leadingGap) {
    return `${forecastNeedLabel(leadingGap.needId)} had no active viable preparation in this period’s menu. Review that in-game coverage gap before the next service.`;
  }

  const lowestCause = lowestSatisfactionCauses[0];
  const waitScore = comparison?.averageWaitScore;
  if (waitScore !== undefined && (!lowestCause || waitScore <= lowestCause[1])) {
    return `Waiting experience was the lowest observed result at ${Math.round(waitScore)}/100. Inspect queue pressure and preparation times before the next service.`;
  }
  if (!lowestCause) return undefined;
  return `${SATISFACTION_CAUSE_LABELS[lowestCause[0]]} was the lowest observed cause at ${Math.round(lowestCause[1])}/100. ${SATISFACTION_NEXT_ACTIONS[lowestCause[0]]}`;
}

function neighbourhoodEventResolution(
  event: RuntimeNeighbourhoodEventSummary,
): string {
  if (event.requiresDecision) return "Decision needed before service";
  const selectedChoice = event.choices.find(
    (choice) => choice.id === event.selectedChoiceId,
  );
  if (selectedChoice) return `Plan chosen: ${selectedChoice.label}`;
  if (event.choices.length === 0) return "Forecast notice applied";
  return event.dismissed ? "Neutral outcome applied" : "Planning decision resolved";
}

function NeighbourhoodEventForecast({
  event,
  compact,
}: {
  event: RuntimeNeighbourhoodEventSummary;
  compact: boolean;
}) {
  const modifierLabels = event.modifierLabels ?? [];
  const selectedChoice = event.choices.find(
    (choice) => choice.id === event.selectedChoiceId,
  );
  const body = (
    <>
      <p>{event.description}</p>
      {selectedChoice ? (
        <p>
          <strong>{selectedChoice.label}.</strong>{" "}
          {selectedChoice.resultingOutcome}
        </p>
      ) : null}
      {event.dismissed && event.choices.length > 0 ? (
        <p><strong>Neutral outcome.</strong> {event.neutralOutcome}</p>
      ) : null}
      <div className="forecast-event-modifiers">
        <strong>Forecast modifiers</strong>
        {modifierLabels.length > 0 ? (
          <ul>
            {modifierLabels.map((label) => <li key={label}>{label}</li>)}
          </ul>
        ) : (
          <span>No operational change.</span>
        )}
      </div>
    </>
  );

  if (compact) {
    return (
      <details className="forecast-event is-compact" data-decision={event.requiresDecision}>
        <summary>
          <span>Neighbourhood event</span>
          <strong>{event.name}</strong>
          <em>{neighbourhoodEventResolution(event)}</em>
        </summary>
        <div>{body}</div>
      </details>
    );
  }

  return (
    <section className="forecast-event" data-decision={event.requiresDecision} aria-label={`${event.name} neighbourhood event`}>
      <header>
        <div>
          <span>Neighbourhood event</span>
          <h3>{event.name}</h3>
        </div>
        <strong>{neighbourhoodEventResolution(event)}</strong>
      </header>
      {body}
    </section>
  );
}

function partyPhaseLabel(party: RuntimePartySummary): string {
  if (party.phase === "forming") return "Finding a workable order";
  if (party.phase === "routing") {
    return party.servingStopCount > 0
      ? `Travelling to stop ${Math.min(party.nextStopIndex + 1, party.servingStopCount)} of ${party.servingStopCount}`
      : "Travelling together";
  }
  if (party.phase === "queueing") {
    return party.servingStopCount > 0
      ? `Queueing at stop ${Math.min(party.nextStopIndex + 1, party.servingStopCount)} of ${party.servingStopCount}`
      : "Queueing together";
  }
  if (party.phase === "seeking-seat") return "Finding suitable seats";
  if (party.phase === "seated") {
    return party.splitExplained ? "Seated at adjacent tables after an explained split" : "Seated together";
  }
  return "Leaving together";
}

function PartyServiceCard({
  parties,
}: {
  parties: readonly RuntimePartySummary[];
}) {
  const totalGuests = parties.reduce((total, party) => total + party.guestCount, 0);
  const servedGuests = parties.reduce((total, party) => total + party.servedGuestCount, 0);

  return (
    <section className="party-service-card" aria-labelledby="party-service-title">
      <header>
        <div>
          <span>Coordinated visits</span>
          <h3 id="party-service-title">Party service</h3>
        </div>
        <strong>{parties.length} active · {totalGuests} guests</strong>
      </header>
      {parties.length > 0 ? (
        <>
          <p>{servedGuests} of {totalGuests} party guests have received their planned serving so far.</p>
          <ul>
            {parties.map((party) => (
              <li key={party.partyId}>
                <div>
                  <strong>{party.guestCount}-guest party</strong>
                  <span>{partyPhaseLabel(party)}</span>
                </div>
                <small>
                  {party.servedGuestCount}/{party.guestCount} served
                  {" · "}
                  {party.servingStopCount === 0
                    ? "fallback pending"
                    : `${party.servingStopCount} ${party.servingStopCount === 1 ? "stop" : "stops"}`}
                  {party.reservedSeatCount > 0 ? ` · ${party.reservedSeatCount} seats held` : ""}
                </small>
                <details className="party-member-plans">
                  <summary>Guest plans and budgets</summary>
                  <ul>
                    {party.members.map((member) => (
                      <li key={member.memberId} data-served={member.served}>
                        <span>
                          {titleFromId(member.archetypeId)} · {dishLabel(member.plannedDishId)}
                        </span>
                        <strong><SgdAmount cents={member.budgetCents} /> · {member.served ? "served" : "in progress"}</strong>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Parties of up to six arrive as one visible group. They queue together while each guest keeps an individual budget, need, order, and result.</p>
      )}
    </section>
  );
}

function RegularGallery({
  regulars,
}: {
  regulars: readonly RuntimeRegularProgressSummary[];
}) {
  const metCount = regulars.filter((regular) => regular.encounterCount > 0).length;
  return (
    <article className="regulars-insight" data-state="neutral">
      <span aria-hidden="true">⌁</span>
      <div>
        <strong>Neighbourhood regulars</strong>
        <p>
          {regulars.length === 0
            ? "The regular roster is loading with the simulation."
            : metCount > 0
            ? `${metCount} of ${regulars.length} recurring guests met. Story beats progress through visits, while nutrition needs are resampled independently each time.`
            : `${regulars.length} recurring fictional guests may visit. Their stories never define a health condition or nutrition need.`}
        </p>
        {regulars.length > 0 ? <details className="regular-gallery">
          <summary>Open the regular gallery</summary>
          <ul>
            {regulars.map((regular) => (
              <li key={regular.regularId} data-met={regular.encounterCount > 0}>
                <div>
                  <strong>{regular.name}</strong>
                  <span>{regular.description}</span>
                </div>
                <small>
                  {regular.encounterCount > 0
                    ? `${regular.encounterCount} ${regular.encounterCount === 1 ? "visit" : "visits"} · story step ${regular.storyStep}`
                    : "Not met yet"}
                </small>
                {regular.currentStoryBeat ? <p>{regular.currentStoryBeat}</p> : null}
              </li>
            ))}
          </ul>
        </details> : null}
      </div>
      <em>{metCount}/{regulars.length}</em>
    </article>
  );
}

function ForecastCard({
  forecast,
  periodLabel,
  neighbourhoodEvent,
  compact = false,
  canOpenGuide,
  onOpenGuide,
}: {
  readonly forecast: RuntimeForecast;
  readonly periodLabel: string;
  readonly neighbourhoodEvent?: RuntimeNeighbourhoodEventSummary;
  readonly compact?: boolean;
  readonly canOpenGuide: boolean;
  onOpenGuide(): void;
}) {
  const topCrowd = [...forecast.crowdProfiles].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topBudget = [...forecast.budgetBands].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topGroup = [...forecast.groupSizeMix].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topMeal = [...forecast.mealMix].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topIntent = [...forecast.nutritionIntents].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topCondition = [...forecast.conditionAwareNeeds].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const coverageReady = forecast.coverage.length > 0;
  const coveredCount = forecast.coverage.filter((need) => need.covered).length;
  const coverageGaps = forecast.coverage.filter((need) => !need.covered);

  return (
    <section className={`forecast-card${compact ? " is-compact" : ""}`} aria-label={`${periodLabel} planning forecast`}>
      <div className="forecast-heading">
        <div>
          <span>{compact ? "Forecast" : "Period forecast"}</span>
          <h2>{compact ? `${periodLabel} forecast` : `${periodLabel}: plan for the range`}</h2>
        </div>
        <strong>{forecast.demandRange[0]}–{forecast.demandRange[1]} visits</strong>
      </div>

      <dl className="forecast-overview">
        <div>
          <dt>Crowd</dt>
          <dd>{topCrowd ? (compact ? personaLabel(topCrowd.id) : `${personaLabel(topCrowd.id)} · ${forecastShareLabel(topCrowd.basisPoints)}`) : "Not available"}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{topBudget ? <><SgdAmount cents={topBudget.minimumCents} />–<SgdAmount cents={topBudget.maximumCents} /></> : "Not available"}</dd>
        </div>
        {!compact ? <div>
          <dt>Group-size intent</dt>
          <dd>{topGroup ? `${titleFromId(topGroup.id)} · ${forecastShareLabel(topGroup.basisPoints)}` : "Not available"}</dd>
        </div> : null}
        <div>
          <dt>{compact ? "Actionable need" : "Future meal intent"}</dt>
          <dd>{compact
            ? topIntent
              ? `${forecastNeedLabel(topIntent)} · ${forecastShareLabel(forecast.nutritionIntentIncidenceBasisPoints)} of visits`
              : "Not available"
            : topMeal
              ? `${titleFromId(topMeal.id)} · ${forecastShareLabel(topMeal.basisPoints)}`
              : "Not available"}</dd>
        </div>
        {!compact ? <div>
          <dt>Nutrition intent</dt>
          <dd>{topIntent ? `${forecastShareLabel(forecast.nutritionIntentIncidenceBasisPoints)} of visits · ${forecastNeedLabel(topIntent)} leads flagged mix` : "Not available"}</dd>
        </div> : null}
        {!compact ? <div>
          <dt>Condition-aware</dt>
          <dd>{topCondition ? `${forecastShareLabel(forecast.conditionAwareIncidenceBasisPoints)} of visits · ${forecastNeedLabel(topCondition)} leads flagged mix` : "Not available"}</dd>
        </div> : null}
        {!compact ? <div>
          <dt>Menu coverage</dt>
          <dd>{coveredCount}/{forecast.coverage.length || 0} needs covered</dd>
        </div> : null}
      </dl>

      {neighbourhoodEvent ? (
        <NeighbourhoodEventForecast
          event={neighbourhoodEvent}
          compact={compact}
        />
      ) : null}

      {!compact ? (
        <details className="forecast-breakdown">
          <summary>View crowd, budget, group, meal, and need details</summary>
          <div className="forecast-distributions">
            <section>
              <h3>Crowd profiles</h3>
              <ul>{forecast.crowdProfiles.map((item) => <li key={item.id}><span>{personaLabel(item.id)}</span><strong>{forecastShareLabel(item.basisPoints)}</strong></li>)}</ul>
            </section>
            <section>
              <h3>Budget bands</h3>
              <ul>{forecast.budgetBands.map((item) => <li key={item.id}><span>{titleFromId(item.id)} · <SgdAmount cents={item.minimumCents} />–<SgdAmount cents={item.maximumCents} /></span><strong>{forecastShareLabel(item.basisPoints)}</strong></li>)}</ul>
            </section>
            <section>
              <h3>Latent group-size intent</h3>
              <ul>{forecast.groupSizeMix.map((item) => <li key={item.id}><span>{titleFromId(item.id)}</span><strong>{forecastShareLabel(item.basisPoints)}</strong></li>)}</ul>
              <p>Parties arrive as one visible group of up to six, route and queue together, and keep individual guest budgets, needs, orders, and results.</p>
            </section>
            <section>
              <h3>Future meal-composition intent</h3>
              <ul>{forecast.mealMix.map((item) => <li key={item.id}><span>{titleFromId(item.id)}</span><strong>{forecastShareLabel(item.basisPoints)}</strong></li>)}</ul>
              <p>Service can use one exact preparation or a validated two-item Combo Board meal. Each served visit scores once while component sales and costs remain explicit.</p>
            </section>
            <section className="forecast-needs">
              <h3>Nutrition intents</h3>
              <p>{forecastShareLabel(forecast.nutritionIntentIncidenceBasisPoints)} of visits may carry a nutrition intent. Each share below is among those flagged visits.</p>
              <ul>{forecast.nutritionIntents.map((item) => <li key={item.id}><span>{forecastNeedLabel(item)}</span><strong>{forecastShareLabel(item.basisPoints)} of flagged</strong></li>)}</ul>
            </section>
            <section className="forecast-needs">
              <h3>Condition-aware needs</h3>
              <p>{forecastShareLabel(forecast.conditionAwareIncidenceBasisPoints)} of visits may carry a condition-aware need in this fictional scenario mix, not a prevalence estimate. Each share below is among those independently flagged visits.</p>
              <ul>{forecast.conditionAwareNeeds.map((item) => <li key={item.id}><span>{forecastNeedLabel(item)}</span><strong>{forecastShareLabel(item.basisPoints)} of flagged</strong></li>)}</ul>
              <p>Sampled independently for every visit; events, appearance, persona, regular identity, and neighbourhood theme never set these needs.</p>
            </section>
          </div>
        </details>
      ) : null}

      <div className="forecast-coverage" data-gaps={coverageReady && coverageGaps.length > 0}>
        <strong>{!coverageReady
          ? "Checking menu coverage"
          : coverageGaps.length > 0
            ? `${coverageGaps.length} menu ${coverageGaps.length === 1 ? "gap" : "gaps"}`
            : compact
              ? "Menu: all forecast needs covered"
              : "Current menu covers every forecast need"}</strong>
        {coverageGaps.length > 0 ? <span>{coverageGaps.slice(0, compact ? 2 : 4).map((need) => forecastNeedLabel(need.needId)).join(" · ")}</span> : null}
      </div>
      {!compact ? (
        <p className="forecast-independence-note">
          Crowd, budget, group-size, and meal percentages are conditional mixes among expected visits. {forecast.explanation} Menu changes update coverage only; they never rewrite who is expected or what visitors need.
          Validated main-and-complement signals can become two-item Combo Board meals; every other percentage remains a forecast, not a guarantee.
        </p>
      ) : null}
      <button type="button" className="forecast-guide-button" disabled={!canOpenGuide} onClick={onOpenGuide}>
        {canOpenGuide
          ? compact ? "Open What’s new guide" : "Try the What’s new decision"
          : compact ? "Guide available in planning" : "Guide available in planning with two unlocked options"}
      </button>
    </section>
  );
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function meaningfulServiceAnnouncement(
  period: Pick<
    RuntimeServicePeriod,
    "sequenceId" | "day" | "label" | "phase" | "arrivalRemainingMs" | "drainRemainingMs"
  >,
): { readonly key: string; readonly message: string } {
  const prefix = `Day ${period.day}, ${period.label}`;
  if (period.phase === "planning") {
    return {
      key: `${period.sequenceId}:planning`,
      message: `${prefix} planning is ready. Review the forecast before starting service.`,
    };
  }
  if (period.phase === "arrivals") {
    if (period.arrivalRemainingMs <= 30_000) {
      return {
        key: `${period.sequenceId}:arrivals-30-seconds`,
        message: `${prefix} arrivals close in 30 seconds.`,
      };
    }
    if (period.arrivalRemainingMs <= 60_000) {
      return {
        key: `${period.sequenceId}:arrivals-60-seconds`,
        message: `${prefix} arrivals close in one minute.`,
      };
    }
    return {
      key: `${period.sequenceId}:arrivals-open`,
      message: `${prefix} arrivals are open.`,
    };
  }
  if (period.phase === "draining") {
    if (period.drainRemainingMs <= 60_000) {
      return {
        key: `${period.sequenceId}:drain-60-seconds`,
        message: `${prefix} drain watchdog has one minute remaining.`,
      };
    }
    return {
      key: `${period.sequenceId}:draining`,
      message: `${prefix} arrivals are closed. Finishing current visits.`,
    };
  }
  return {
    key: `${period.sequenceId}:debrief`,
    message: `${prefix} service is complete. Review the period debrief.`,
  };
}

function ObjectiveBoard({
  objectives,
  refreshLabel,
  onAccept,
  onSkip,
}: {
  objectives: readonly RuntimeObjective[];
  refreshLabel: string;
  onAccept(objectiveId: string): void;
  onSkip(): void;
}) {
  const canSkipBoard = objectives.some((objective) => objective.canSkip);
  const progressLabel = (objective: RuntimeObjective) => {
    const progress = Math.max(0, Math.min(objective.progress, objective.target));
    if (objective.kind === "revenue") {
      return {
        visible: `${formatSgd(Math.round(progress))} / ${formatSgd(Math.round(objective.target))}`,
        accessible: `${describeSgd(Math.round(progress))} of ${describeSgd(Math.round(objective.target))} in gross sales`,
      };
    }
    if (objective.kind === "flow") {
      return {
        visible: `${formatCountdown(progress)} / ${formatCountdown(objective.target)}`,
        accessible: `${Math.round(progress / 1_000)} seconds of ${Math.round(objective.target / 1_000)} seconds of qualifying flow`,
      };
    }
    if (objective.kind === "happiness") {
      return {
        visible: `${Math.round(progress)}% / ${Math.round(objective.target)}%`,
        accessible: `${Math.round(progress)} percent of ${Math.round(objective.target)} percent happiness`,
      };
    }
    return {
      visible: `${Math.round(progress)} / ${Math.round(objective.target)}`,
      accessible: `${Math.round(progress)} of ${Math.round(objective.target)}`,
    };
  };
  return (
    <section className="objective-card">
      <div className="card-kicker">
        <span>Period objectives</span>
        <span>{refreshLabel}</span>
      </div>
      <h2>Three feasible ways to grow</h2>
      <div className="objective-list">
        {objectives.map((objective) => (
          <article key={objective.id} data-complete={objective.completed}>
            <div className="objective-title-row">
              <strong>{objective.completed ? "✓ " : ""}{objective.title}</strong>
              {objective.skipped
                ? <span>Skipped</span>
                : objective.accepted && !objective.completed
                  ? <span>Target locked</span>
                  : null}
            </div>
            <p>
              <span aria-hidden="true">{objective.description}</span>
              <span className="sr-only">{objective.accessibleDescription}</span>
            </p>
            <div className="objective-progress">
              <span
                style={{
                  width: `${Math.min(100, (objective.progress / Math.max(1, objective.target)) * 100)}%`,
                }}
              />
            </div>
            <div className="objective-reward-row">
              <small>
                <span aria-hidden="true">{progressLabel(objective).visible}</span>
                <span className="sr-only">{progressLabel(objective).accessible}</span>
                {" · "}<SgdAmount cents={objective.rewardCashCents} /> + {objective.rewardXp} XP
              </small>
              {objective.canAccept ? (
                <span className="objective-offer-actions">
                  <button type="button" className="accept" onClick={() => onAccept(objective.id)}>
                    Accept<span className="sr-only"> {objective.title}</span>
                  </button>
                </span>
              ) : null}
            </div>
          </article>
        ))}
        {objectives.length === 0 ? <small>Preparing this period&apos;s objective board…</small> : null}
      </div>
      {canSkipBoard ? (
        <button type="button" className="objective-board-skip" onClick={onSkip}>
          Skip objectives for this period
        </button>
      ) : null}
    </section>
  );
}

function PeriodLedgerCard({
  ledger,
  compact = false,
}: {
  ledger: RuntimePeriodLedger;
  compact?: boolean;
}) {
  const overtimeUpkeepCents = ledger.entries
    .filter((entry) => entry.kind === "overtime-upkeep")
    .reduce((total, entry) => total + entry.amountCents, 0);
  const regularUpkeepCents = Math.max(0, ledger.upkeepCents - overtimeUpkeepCents);
  const rows = [
    ["Gross sales", ledger.grossSalesCents, "income"],
    ["Ingredient costs", -ledger.ingredientCostsCents, "cost"],
    ["Refunds", -ledger.refundsCents, "cost"],
    ["Paid upkeep", -regularUpkeepCents, "cost"],
    ["Overtime upkeep", -overtimeUpkeepCents, "cost"],
    ["Contribution", ledger.contributionCents, "total"],
    ["Purchases", -ledger.purchasesCents, "cost"],
    ["Resale", ledger.resaleCents, "income"],
    ["Objective rewards", ledger.objectiveRewardsCents, "income"],
    ["Milestone rewards", ledger.milestoneRewardsCents, "income"],
    ["Recovery", ledger.recoveryCents, "income"],
  ] as const;

  return (
    <section className={compact ? "period-ledger is-compact" : "period-ledger"} aria-label="Period Singapore dollar reconciliation">
      <div className="period-ledger-heading">
        <div>
          <span>SGD reconciliation</span>
          <h3>Period ledger</h3>
        </div>
        <strong aria-label={`Net cash change ${describeSgd(ledger.actualCashMovementCents)}`}>
          {ledger.actualCashMovementCents >= 0 ? "+" : "−"}
          {formatSgd(Math.abs(ledger.actualCashMovementCents), "ledger")}
        </strong>
      </div>
      <dl>
        {rows.map(([label, cents, tone]) => (
          <div key={label} data-tone={tone}>
            <dt>{label}</dt>
            <dd><SgdAmount cents={cents} ledger /></dd>
          </div>
        ))}
      </dl>
      <p className="ledger-reconciliation" data-reconciled={ledger.reconcilesToCash} role="status">
        <span aria-hidden="true">
          {ledger.reconcilesToCash
            ? `Reconciled to the cent from opening cash of ${formatSgd(ledger.openingCashCents, "ledger")}.`
            : `Reconciliation difference: ${formatSgd(ledger.reconciliationDeltaCents, "ledger")}.`}
        </span>
        <span className="sr-only">
          {ledger.reconcilesToCash
            ? `Reconciled to the cent from opening cash of ${describeSgd(ledger.openingCashCents)}.`
            : `Reconciliation difference: ${describeSgd(ledger.reconciliationDeltaCents)}.`}
        </span>
      </p>
      <p className="margin-note">
        <strong>Operating margin: {ledger.operatingMargin === undefined ? "Not available" : `${Math.round(ledger.operatingMargin * 100)}%`}</strong>
        <span>Gross sales minus ingredient costs and paid upkeep, divided by gross sales. Purchases, resale, refunds, objectives, recovery, scenarios, and cosmetics are excluded.</span>
      </p>
    </section>
  );
}

function PeriodDebrief({
  dialogRef,
  period,
  forecast,
  ledger,
  debrief,
  scenario,
  neighbourhoodEvent,
  activeParties,
  regularProgress,
  masterySaveStatus,
  onContinue,
}: {
  dialogRef: RefObject<HTMLElement | null>;
  period: RuntimeServicePeriod;
  forecast: RuntimeForecast;
  ledger: RuntimePeriodLedger;
  debrief?: RuntimePeriodDebrief;
  scenario?: RuntimeSnapshot["scenario"];
  neighbourhoodEvent?: RuntimeNeighbourhoodEventSummary;
  activeParties: readonly RuntimePartySummary[];
  regularProgress: readonly RuntimeRegularProgressSummary[];
  masterySaveStatus: MasteryDebriefSaveStatus;
  onContinue(): void;
}) {
  const comparison = debrief?.forecastComparison;
  const demandResultCopy = comparison?.demandResult === "within-range"
    ? "Arrivals landed inside the forecast range."
    : comparison?.demandResult === "below-range"
      ? "Arrivals landed below the forecast range."
      : comparison?.demandResult === "above-range"
        ? "Arrivals exceeded the forecast range."
        : "No arrival comparison is available.";
  const topExpectedCrowd = [...forecast.crowdProfiles].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topExpectedBudget = [...forecast.budgetBands].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topExpectedGroup = [...forecast.groupSizeMix].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topExpectedMeal = [...forecast.mealMix].sort((left, right) => right.basisPoints - left.basisPoints)[0];
  const topObservedCrowd = highestCountEntry(comparison?.crowdProfileCounts ?? {});
  const topObservedBudget = highestCountEntry(comparison?.budgetBandCounts ?? {});
  const topObservedGroup = highestCountEntry(comparison?.groupSizeCounts ?? {});
  const topObservedMeal = highestCountEntry(comparison?.mealMixCounts ?? {});
  const topObservedIntent = highestCountEntry(comparison?.nutritionIntentCounts ?? {});
  const topObservedCondition = highestCountEntry(comparison?.conditionAwareCounts ?? {});
  const activePartyGuestCount = activeParties.reduce(
    (total, party) => total + party.guestCount,
    0,
  );
  const regularsSeenToday = regularProgress.filter(
    (regular) => regular.lastVisitDay === period.day && regular.encounterCount > 0,
  );
  const selectedEventChoice = neighbourhoodEvent?.choices.find(
    (choice) => choice.id === neighbourhoodEvent.selectedChoiceId,
  );
  const intentResultVisits = comparison
    ? comparison.intentMatches + comparison.intentMisses + comparison.intentUnknowns
    : 0;
  const conditionResultVisits = comparison
    ? comparison.conditionMatches + comparison.conditionMisses + comparison.conditionUnknowns
    : 0;
  const lowestSatisfactionCauses = Object.entries(comparison?.satisfactionCauseScores ?? {})
    .filter((entry): entry is [keyof typeof SATISFACTION_CAUSE_LABELS, number] => (
      entry[0] in SATISFACTION_CAUSE_LABELS && typeof entry[1] === "number"
    ))
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
    .slice(0, 3);
  const tryNextCopy = debriefTryNextCopy(forecast, comparison, lowestSatisfactionCauses);
  const remainingScenarioFailures = scenario
    ? remainingScenarioFailureCodes(
        scenario.failureCodes,
        scenario.nextMedal?.constraintFailureCodes,
      )
    : [];
  const continuePresentation = masteryDebriefContinuePresentation(
    masterySaveStatus,
    scenario
      ? "Record result and return to main centre"
      : period.actionLabel,
  );
  const mixRows = [
    {
      label: "Crowd profile",
      expected: topExpectedCrowd ? `${personaLabel(topExpectedCrowd.id)} · ${forecastShareLabel(topExpectedCrowd.basisPoints)} of mix` : "Not available",
      observed: topObservedCrowd ? `${personaLabel(topObservedCrowd[0])} · ${topObservedCrowd[1]} visits` : "No observed visits",
    },
    {
      label: "Budget band",
      expected: topExpectedBudget ? `${titleFromId(topExpectedBudget.id)} · ${forecastShareLabel(topExpectedBudget.basisPoints)} of mix` : "Not available",
      observed: topObservedBudget ? `${titleFromId(topObservedBudget[0])} · ${topObservedBudget[1]} visits` : "No observed visits",
    },
    {
      label: "Group-size intent",
      expected: topExpectedGroup ? `${titleFromId(topExpectedGroup.id)} · ${forecastShareLabel(topExpectedGroup.basisPoints)} of mix` : "Not available",
      observed: topObservedGroup ? `${topObservedGroup[0]} ${topObservedGroup[0] === "1" ? "person" : "people"} · ${topObservedGroup[1]} visits` : "No observed visits",
    },
    {
      label: "Future meal intent",
      expected: topExpectedMeal ? `${titleFromId(topExpectedMeal.id)} · ${forecastShareLabel(topExpectedMeal.basisPoints)} of arrival mix` : "Not available",
      observed: topObservedMeal ? `${titleFromId(topObservedMeal[0])} · ${topObservedMeal[1]} arrival intents` : "No observed arrivals",
    },
  ];
  return (
    <section
      ref={dialogRef}
      className="period-debrief"
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-debrief-title"
      tabIndex={-1}
    >
      <div className="period-debrief-card">
        <div className="period-debrief-scroll">
          <span className="period-debrief-kicker">Day {period.day} · {period.label} complete</span>
          <h2 id="period-debrief-title" tabIndex={-1} data-modal-initial-focus>Service debrief</h2>
          <p>The clock is frozen. Read the result from forecast to causes, then use the ledger to plan the next period.</p>
          <dl className="debrief-outcomes" aria-label="Visit outcomes">
            <div><dt>Served visits</dt><dd>{debrief?.servedVisits ?? 0}</dd></div>
            <div><dt>Served timeouts</dt><dd>{debrief?.timedOutServedVisits ?? 0}</dd></div>
            <div><dt>Unserved departures</dt><dd>{debrief?.unservedDepartures ?? 0}</dd></div>
            <div><dt>Completed two-item meals</dt><dd>{debrief?.completedComboVisits ?? 0}</dd></div>
            <div><dt>Partial two-item meals</dt><dd>{debrief?.partialMeals ?? 0}</dd></div>
          </dl>
          {scenario ? (
            <section
              className="debrief-neighbourhood-context"
              aria-labelledby="debrief-scenario-result-title"
            >
              <div className="debrief-section-heading">
                <span>Scenario result</span>
                <h3 id="debrief-scenario-result-title">
                  {humanizeScenarioCode(scenario.scenarioId)}
                </h3>
              </div>
              <dl>
                <div>
                  <dt>Score</dt>
                  <dd>
                    <strong>
                      <ScenarioScoreValue
                        value={scenario.score}
                        unit={scenario.scoreUnit}
                      />
                    </strong>
                  </dd>
                </div>
                <div>
                  <dt>Medal</dt>
                  <dd>
                    <strong>
                      {scenario.medal
                        ? medalLabel(scenario.medal)
                        : "No medal earned"}
                    </strong>
                    <span>
                      Scenario rewards are cosmetics only. Main-centre cash and
                      experience stay unchanged.
                    </span>
                    <span>
                      Returning records the best medal and clears this completed
                      run slot.
                    </span>
                  </dd>
                </div>
              </dl>
              <p id="debrief-scenario-breakdown-title">
                <strong>How the score was built</strong>
              </p>
              <dl aria-labelledby="debrief-scenario-breakdown-title">
                {scenario.breakdown.map((entry) => (
                  <div key={entry.id}>
                    <dt>{scenarioBreakdownLabel(entry.id)}</dt>
                    <dd>
                      <strong>
                        <ScenarioBreakdownValue entry={entry} />
                      </strong>
                    </dd>
                  </div>
                ))}
              </dl>
              {scenario.nextMedal ? (
                <div className="debrief-cause-summary" role="status">
                  <strong>
                    Next medal target: {medalLabel(scenario.nextMedal.medal)}
                  </strong>{" "}
                  {scenario.nextMedal.scoreShortfall > 0 ? (
                    <span>
                      Add{" "}
                      <ScenarioScoreValue
                        value={scenario.nextMedal.scoreShortfall}
                        unit={scenario.scoreUnit}
                      />{" "}
                      to reach the{" "}
                      <ScenarioScoreValue
                        value={scenario.nextMedal.threshold}
                        unit={scenario.scoreUnit}
                      />{" "}
                      threshold.
                    </span>
                  ) : (
                    <span>
                      The{" "}
                      <ScenarioScoreValue
                        value={scenario.nextMedal.threshold}
                        unit={scenario.scoreUnit}
                      />{" "}
                      score threshold is met.
                      {scenario.nextMedal.constraintFailureCodes.length > 0
                        ? " Resolve the remaining constraints below."
                        : ""}
                    </span>
                  )}
                  {scenario.nextMedal.constraintFailureCodes.length > 0 ? (
                    <ul>
                      {scenario.nextMedal.constraintFailureCodes.map((code) => (
                        <li key={code}>{scenarioFailureGuidance(code)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : scenario.medal === "gold" ? (
                <p className="debrief-cause-summary">
                  <strong>Gold standard reached.</strong>{" "}
                  There is no higher scenario medal.
                </p>
              ) : null}
              {remainingScenarioFailures.length > 0 ? (
                <div className="debrief-partial-meals" role="status">
                  <strong>What held this run back</strong>
                  <ul>
                    {remainingScenarioFailures.map((code) => (
                      <li key={code}>
                        <span>{scenarioFailureGuidance(code)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : scenario.failureCodes.length === 0 ? (
                <p className="debrief-cause-summary">
                  <strong>Validated run.</strong>{" "}
                  The scenario result reconciled and met its scored constraints.
                </p>
              ) : null}
            </section>
          ) : null}
          {(neighbourhoodEvent || debrief || activeParties.length > 0 || regularsSeenToday.length > 0) ? (
            <section className="debrief-neighbourhood-context" aria-labelledby="debrief-neighbourhood-title">
              <div className="debrief-section-heading">
                <span>Neighbourhood context</span>
                <h3 id="debrief-neighbourhood-title">What shaped this period</h3>
              </div>
              <dl>
                {neighbourhoodEvent ? (
                  <div>
                    <dt>Event</dt>
                    <dd>
                      <strong>{neighbourhoodEvent.name}</strong>
                      <span>
                        {selectedEventChoice
                          ? selectedEventChoice.label
                          : neighbourhoodEvent.choices.length > 0
                            ? "Neutral outcome"
                            : "Forecast notice"}
                        {(neighbourhoodEvent.modifierLabels ?? []).length > 0
                          ? ` · ${(neighbourhoodEvent.modifierLabels ?? []).join(" · ")}`
                          : " · No operational change"}
                      </span>
                      {neighbourhoodEvent.resolvedOutcome ? (
                        <span>{neighbourhoodEvent.resolvedOutcome}</span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Party service</dt>
                  <dd>
                    <strong>
                      {debrief?.partyVisits ?? 0} parties · {debrief?.partyGuests ?? 0} guests
                      {(debrief?.partySplits ?? 0) > 0 ? ` · ${debrief?.partySplits} explained splits` : ""}
                      {(debrief?.partialPartyVisits ?? 0) > 0 ? ` · ${debrief?.partialPartyVisits} partial` : ""}
                    </strong>
                    <span>
                      Party members kept separate budgets, orders, and results while moving as one group.
                      {activeParties.length > 0 ? ` ${activeParties.length} groups (${activePartyGuestCount} guests) remained active in this snapshot.` : ""}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Regular stories seen today</dt>
                  <dd>
                    <strong>
                      {debrief?.regularStoryBeats ?? 0} new story {(debrief?.regularStoryBeats ?? 0) === 1 ? "beat" : "beats"}
                      {regularsSeenToday.length > 0 ? ` · ${regularsSeenToday.map((regular) => regular.name).join(" · ")}` : ""}
                    </strong>
                    <span>Regular identity never determines a condition-aware need.</span>
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
          {debrief?.comboOfferOutcomes.length ? (
            <div className="debrief-combo-outcomes">
              <strong>Combo Board results</strong>
              <p>Each two-item meal counts once here; its component sales and costs remain separate in the ledger.</p>
              <ul>
                {debrief.comboOfferOutcomes.map((outcome) => (
                  <li key={outcome.offerId}>
                    <span>{outcome.offerId.replace(/^combo-slot-/, "Offer ")}</span>
                    <b>{outcome.completedVisits} complete · {outcome.partialVisits} partial</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {debrief?.partialMealCauses.length ? (
            <div className="debrief-partial-meals" role="status">
              <strong>Partial-meal settlement</strong>
              <ul>
                {debrief.partialMealCauses.map((entry) => (
                  <li key={entry.cause}>
                    <span>{entry.cause === "second-stall-unavailable"
                      ? "Second stall unavailable"
                      : "Second component timed out"}</span>
                    <b>{entry.count}</b>
                  </li>
                ))}
              </ul>
              <p>Only served components were charged; cancelled components produced no sale or ingredient cost.</p>
            </div>
          ) : null}
          {debrief?.causeCodes.length ? (
            <p className="debrief-cause-summary">
              <strong>{debrief.causeCodes.length} recorded {debrief.causeCodes.length === 1 ? "cause" : "causes"}.</strong>{" "}
              {DEBRIEF_CAUSE_LABELS[debrief.causeCodes[0]!]}
            </p>
          ) : null}
          {tryNextCopy ? (
            <p className="debrief-cause-summary">
              <strong>Try next.</strong> {tryNextCopy}
            </p>
          ) : null}
          {comparison ? (
            <section className="debrief-forecast-check" aria-labelledby="debrief-forecast-title">
              <div className="debrief-section-heading">
                <span>Forecast → result</span>
                <h3 id="debrief-forecast-title">What matched, and what did not</h3>
              </div>
              <p className="debrief-demand-result" data-result={comparison.demandResult}>
                <strong>{comparison.observedArrivals} arrivals</strong>
                <span>Forecast {forecast.demandRange[0]}–{forecast.demandRange[1]} · {demandResultCopy}</span>
              </p>
              <dl className="debrief-strategy-outcomes">
                <div><dt>Wait experience</dt><dd>{comparison.averageWaitScore === undefined ? "Not available" : `${Math.round(comparison.averageWaitScore)}/100`}</dd></div>
                <div><dt>Contribution</dt><dd><SgdAmount cents={comparison.contributionCents} ledger /></dd></div>
              </dl>
              <div className="debrief-need-results">
                <section aria-labelledby="debrief-intent-results-title">
                  <div>
                    <h4 id="debrief-intent-results-title">Nutrition-intent results</h4>
                    <p>{intentResultVisits} served intent-flagged {intentResultVisits === 1 ? "visit" : "visits"} scored</p>
                  </div>
                  <dl>
                    <div><dt>Matched</dt><dd>{comparison.intentMatches}</dd></div>
                    <div><dt>Missed</dt><dd>{comparison.intentMisses}</dd></div>
                    <div><dt>Unknown</dt><dd>{comparison.intentUnknowns}</dd></div>
                  </dl>
                </section>
                <section aria-labelledby="debrief-condition-results-title">
                  <div>
                    <h4 id="debrief-condition-results-title">Condition-aware results</h4>
                    <p>{conditionResultVisits} served condition-flagged {conditionResultVisits === 1 ? "visit" : "visits"} scored once each</p>
                  </div>
                  <dl>
                    <div><dt>Matched</dt><dd>{comparison.conditionMatches}</dd></div>
                    <div><dt>Missed</dt><dd>{comparison.conditionMisses}</dd></div>
                    <div><dt>Unknown</dt><dd>{comparison.conditionUnknowns}</dd></div>
                  </dl>
                </section>
              </div>
              <details className="debrief-mix-comparison">
                <summary>Compare expected and observed mixes</summary>
                <dl>
                  {mixRows.map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd><span>Expected: {row.expected}</span><strong>Observed: {row.observed}</strong></dd>
                    </div>
                  ))}
                </dl>
                <p>
                  Observed arrival flags: {topObservedIntent ? `${titleFromId(topObservedIntent[0])} led intents with ${topObservedIntent[1]}` : "no nutrition intents"};{" "}
                  {topObservedCondition ? `${titleFromId(topObservedCondition[0])} led condition-aware flags with ${topObservedCondition[1]}` : "no condition-aware flags"}.
                </p>
                <small>Parties arrive and route as coordinated groups, while each guest keeps an individual budget, order, nutrition result, sale, cost, and satisfaction outcome. Two-item Combo Board meals are scored once per served guest.</small>
              </details>
            </section>
          ) : null}
          {lowestSatisfactionCauses.length > 0 ? (
            <section className="debrief-satisfaction-causes" aria-labelledby="debrief-satisfaction-title">
              <div className="debrief-section-heading">
                <span>Satisfaction causes</span>
                <h3 id="debrief-satisfaction-title">Lowest-scoring parts of the visit</h3>
              </div>
              <ol>
                {lowestSatisfactionCauses.map(([cause, score]) => (
                  <li key={cause}><span>{SATISFACTION_CAUSE_LABELS[cause]}</span><strong>{Math.round(score)}/100</strong></li>
                ))}
              </ol>
              <p>These are cause scores, not diagnoses. Improve the lowest operational cause that fits your next forecast.</p>
            </section>
          ) : null}
          <PeriodLedgerCard ledger={ledger} />
          {debrief?.causeCodes.length ? (
            <div className="debrief-causes">
              <h3>Recorded causes</h3>
              <ul>
                {debrief.causeCodes.map((cause) => <li key={cause}>{DEBRIEF_CAUSE_LABELS[cause]}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
        <footer className="period-debrief-footer">
          {continuePresentation.statusMessage ? (
            <p
              id="mastery-debrief-save-status"
              role={masterySaveStatus === "error" ? "alert" : "status"}
            >
              {continuePresentation.statusMessage}
            </p>
          ) : null}
          <button
            type="button"
            className="primary-button"
            disabled={continuePresentation.disabled}
            aria-busy={masterySaveStatus === "saving"}
            aria-describedby={
              continuePresentation.statusMessage
                ? "mastery-debrief-save-status"
                : undefined
            }
            onClick={onContinue}
          >
            {continuePresentation.label}
          </button>
        </footer>
      </div>
    </section>
  );
}

function comboComponentName(component: RuntimeComboComponentSummary): string {
  return [component.label, component.variantLabel, component.servingLabel]
    .filter(Boolean)
    .join(" · ");
}

function comboRatingValue(
  rating: RuntimeComboRatingSummary,
  scale: "five" | "percent",
): string {
  if (rating.dataState === "unavailable" || rating.value === undefined) {
    return "Unavailable";
  }
  return scale === "five"
    ? `${rating.value.toFixed(1)}/5`
    : `${Math.round(rating.value * 100)}%`;
}

function comboCoverageText(rating: RuntimeComboRatingSummary): string {
  return rating.knownWeightBasisPoints === undefined
    ? "Source coverage not stored"
    : `${Math.round(rating.knownWeightBasisPoints / 100)}% source coverage`;
}

function ComboOfferEditor({
  slot,
  board,
  locked,
  onSave,
  onClear,
}: {
  slot: 0 | 1 | 2;
  board: RuntimeComboBoardSummary;
  locked: boolean;
  onSave(slot: 0 | 1 | 2, mainId: string, complementId: string): boolean;
  onClear(slot: 0 | 1 | 2): boolean;
}) {
  const offer = board.slots[slot];
  const savedMain = offer?.components?.find((component) => component.role === "main");
  const savedComplement = offer?.components?.find((component) => component.role !== "main");
  const mainCandidates = board.candidates
    .filter((candidate) => candidate.role === "main")
    .concat(savedMain && !board.candidates.some(
      (candidate) => candidate.preparationId === savedMain.preparationId,
    ) ? [savedMain] : []);
  const complementCandidates = board.candidates
    .filter((candidate) => candidate.role !== "main")
    .concat(savedComplement && !board.candidates.some(
      (candidate) => candidate.preparationId === savedComplement.preparationId,
    ) ? [savedComplement] : []);
  const [mainId, setMainId] = useState(offer?.components?.find(
    (component) => component.role === "main",
  )?.preparationId ?? "");
  const [complementId, setComplementId] = useState(offer?.components?.find(
    (component) => component.role !== "main",
  )?.preparationId ?? "");
  const [feedback, setFeedback] = useState("");

  const main = mainCandidates.find((candidate) => candidate.preparationId === mainId);
  const complement = complementCandidates.find(
    (candidate) => candidate.preparationId === complementId,
  );
  const draftPriceCents = (main?.terms.priceCents ?? 0) +
    (complement?.terms.priceCents ?? 0);
  const draftIngredientCostCents = (main?.terms.ingredientCostCents ?? 0) +
    (complement?.terms.ingredientCostCents ?? 0);
  const unchanged = Boolean(
    offer?.components &&
    offer.components.some((component) => component.preparationId === mainId) &&
    offer.components.some((component) => component.preparationId === complementId),
  );
  const mainSelectId = `combo-main-${slot}`;
  const complementSelectId = `combo-complement-${slot}`;
  const statusId = `combo-status-${slot}`;

  return (
    <article className="combo-offer-editor" data-valid={offer?.valid ?? true}>
      <header>
        <div>
          <span>Board slot {slot + 1}</span>
          <h4>{offer ? "Two-item meal" : "Open slot"}</h4>
        </div>
        {offer ? (
          <button
            type="button"
            className="combo-clear-button"
            disabled={locked}
            onClick={() => {
              const cleared = onClear(slot);
              setFeedback(cleared ? `Offer ${slot + 1} cleared.` : "Offer could not be cleared.");
            }}
          >
            Clear
          </button>
        ) : null}
      </header>

      {offer && !offer.components ? (
        <div className="combo-offer-error" role="alert">
          <strong>Saved offer needs attention</strong>
          <p>{offer.dataExplanation}</p>
          <code>{offer.preparationIds.join(" + ")}</code>
        </div>
      ) : null}

      <div className="combo-offer-fields">
        <label htmlFor={mainSelectId}>
          <span>Main</span>
          <select
            id={mainSelectId}
            value={mainId}
            disabled={locked}
            onChange={(event) => {
              setMainId(event.target.value);
              setFeedback("");
            }}
          >
            <option value="">Choose an exact main serving</option>
            {mainCandidates.map((candidate) => (
              <option
                key={candidate.preparationId}
                value={candidate.preparationId}
                disabled={candidate.availableStallCount === 0}
              >
                {comboComponentName(candidate)}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={complementSelectId}>
          <span>Drink, dessert, or add-on</span>
          <select
            id={complementSelectId}
            value={complementId}
            disabled={locked}
            onChange={(event) => {
              setComplementId(event.target.value);
              setFeedback("");
            }}
          >
            <option value="">Choose an exact second serving</option>
            {complementCandidates.map((candidate) => (
              <option
                key={candidate.preparationId}
                value={candidate.preparationId}
                disabled={candidate.availableStallCount === 0}
              >
                {candidate.componentLabel} · {comboComponentName(candidate)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mainCandidates.length === 0 || complementCandidates.length === 0 ? (
        <p className="combo-candidate-empty" role="status">
          More exact serving options appear when a compatible stall and dish are active in the centre.
        </p>
      ) : null}

      {main || complement ? (
        <div className="combo-draft-summary">
          {main ? (
            <p><strong>Main</strong><span>{comboComponentName(main)}</span></p>
          ) : null}
          {complement ? (
            <p><strong>{complement.componentLabel}</strong><span>{comboComponentName(complement)}</span></p>
          ) : null}
          {main && complement ? (
            <p className="combo-price-equation">
              <strong>No discount</strong>
              <span>
                <SgdAmount cents={main.terms.priceCents} />
                <span aria-hidden="true"> + </span>
                <span className="sr-only"> plus </span>
                <SgdAmount cents={complement.terms.priceCents} />
                <span aria-hidden="true"> = </span>
                <span className="sr-only"> equals </span>
                <SgdAmount cents={draftPriceCents} />
              </span>
              <small>Both component prices add in full.</small>
              <small>
                Ingredient cost <SgdAmount cents={draftIngredientCostCents} />
                <span aria-hidden="true"> · </span>
                <span className="sr-only">. </span>
                contribution <SgdAmount cents={draftPriceCents - draftIngredientCostCents} />
              </small>
            </p>
          ) : null}
          {main || complement ? (
            <details className="combo-term-details">
              <summary>Compare component timing, Star appeal, and demand</summary>
              {[main, complement]
                .filter((component): component is RuntimeComboComponentSummary => Boolean(component))
                .map((component) => (
                  <section key={component.preparationId}>
                    <strong>{component.componentLabel} · {component.label}</strong>
                    <PreparationTermsSummary
                      terms={component.terms}
                      label={`${component.label} exact serving terms`}
                      compact
                    />
                  </section>
                ))}
            </details>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="combo-save-button"
        disabled={locked || !main || !complement || unchanged}
        aria-describedby={statusId}
        onClick={() => {
          if (!main || !complement) return;
          const saved = onSave(slot, main.preparationId, complement.preparationId);
          setFeedback(saved
            ? `Offer ${slot + 1} saved. Both component prices apply with no discount.`
            : "Offer could not be saved. Review the highlighted board issue.");
        }}
      >
        {unchanged ? "Offer saved" : "Save two-item meal"}
      </button>
      <p id={statusId} className="combo-slot-status" role="status">{feedback}</p>

      {offer?.components ? (
        <div className="combo-saved-summary">
          <p className="combo-route-summary">
            <strong><SgdAmount cents={offer.priceCents ?? 0} /> total · no discount</strong>
            <span>
              Ingredient cost <SgdAmount cents={offer.ingredientCostCents ?? 0} /> · contribution{" "}
              <SgdAmount cents={(offer.priceCents ?? 0) - (offer.ingredientCostCents ?? 0)} />
            </span>
            <span>{offer.servingStopCount ?? "—"} stall {offer.servingStopCount === 1 ? "stop" : "stops"}{offer.routeDistanceTiles === undefined ? "" : ` · ${offer.routeDistanceTiles} route tiles`}</span>
          </p>
          <details className="combo-term-details">
            <summary>Review frozen offer terms</summary>
            {offer.components.map((component) => (
              <section key={component.preparationId}>
                <strong>{component.componentLabel} · {comboComponentName(component)}</strong>
                <PreparationTermsSummary
                  terms={component.terms}
                  label={`${component.label} saved offer terms`}
                  compact
                />
              </section>
            ))}
          </details>
          <dl className="combo-fit-grid">
            <div>
              <dt>Meal balance</dt>
              <dd>{comboRatingValue(offer.mealBalance, "five")}</dd>
              <small>
                Among unlocked feasible options ·{" "}
                {comboCoverageText(offer.mealBalance)}
              </small>
            </div>
            <div>
              <dt>Forecast intent fit</dt>
              <dd>{comboRatingValue(offer.intentFit, "percent")}</dd>
              <small>{offer.intentFit.needId ? titleFromId(offer.intentFit.needId) : "No leading intent"}</small>
            </div>
            <div>
              <dt>Condition-aware game fit</dt>
              <dd>At order</dd>
              <small>Visit-specific; not treatment advice</small>
            </div>
          </dl>
          <p className="combo-data-note" data-state={offer.mealBalance.dataState}>
            {offer.dataExplanation}
          </p>
        </div>
      ) : null}
      {offer?.issues.length ? (
        <ul className="combo-offer-issues" role="alert">
          {offer.issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      ) : null}
    </article>
  );
}

export function ComboBoardPlanner({
  board,
  locked,
  onSave,
  onClear,
}: {
  board: RuntimeComboBoardSummary;
  locked: boolean;
  onSave(slot: 0 | 1 | 2, mainId: string, complementId: string): boolean;
  onClear(slot: 0 | 1 | 2): boolean;
}) {
  const firstInvalidSlot = board.slots.findIndex((offer) => offer?.valid === false);
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2>(
    firstInvalidSlot >= 0 ? firstInvalidSlot as 0 | 1 | 2 : 0,
  );

  return (
    <section className="combo-board" aria-labelledby="combo-board-title">
      <div className="combo-board-heading">
        <div>
          <span>Level 5 planning</span>
          <h3 id="combo-board-title">Combo Board</h3>
        </div>
        <em>{board.configuredOfferCount}/3 offers</em>
      </div>
      {!board.unlocked ? (
        <div className="combo-board-locked">
          <strong>Build trust across the centre</strong>
          <p>
            At level 5, pair an exact main with a drink, dessert, or add-on to answer forecast needs across at most two reachable stall stops.
          </p>
        </div>
      ) : (
        <>
          {locked ? (
            <p className="configuration-lock-notice" role="status">
              Combo offers are frozen for this service cohort. Frozen orders keep the terms captured at acceptance.
            </p>
          ) : null}
          {board.compatibilityWarning ? (
            <p className="combo-board-warning" role="alert">{board.compatibilityWarning}</p>
          ) : null}
          {board.liveAvailabilityWarning ? (
            <p className="combo-board-live-warning" role="status">
              <strong>Live availability</strong>
              <span>{board.liveAvailabilityWarning}</span>
            </p>
          ) : null}
          {!board.valid && board.issues.length > 0 ? (
            <div className="combo-board-errors" role="alert">
              <strong>Resolve before starting service</strong>
              <ul>{[...new Set(board.issues)].map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          ) : null}
          <details className="combo-board-workspace">
            <summary>
              <span>Plan two-item offers</span>
              <small>Compare forecast fit, contribution, and route stops</small>
            </summary>
            <p className="combo-board-intro">
              Pair across stalls when the forecast makes the trade-off worthwhile. Each component keeps its exact serving, full price, cost, timing, and nutrition data; prices add with no combo discount.
            </p>
            <div className="combo-slot-switcher" role="group" aria-label="Choose a Combo Board slot to edit">
              {([0, 1, 2] as const).map((slot) => {
                const offer = board.slots[slot];
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={activeSlot === slot}
                    aria-controls="combo-active-editor"
                    data-valid={offer?.valid ?? true}
                    onClick={() => setActiveSlot(slot)}
                  >
                    <strong>Offer {slot + 1}</strong>
                    <span>{offer?.valid === false
                      ? "Needs attention"
                      : offer
                        ? "Saved"
                        : "Open"}</span>
                  </button>
                );
              })}
            </div>
            <div id="combo-active-editor">
              <ComboOfferEditor
                key={`${activeSlot}:${board.slots[activeSlot]?.preparationIds.join("+") ?? "empty"}`}
                slot={activeSlot}
                board={board}
                locked={locked}
                onSave={onSave}
                onClear={onClear}
              />
            </div>
            <p className="combo-board-disclaimer">
              Meal balance is a comparative in-game score among unlocked feasible options. Forecast intent fit and visit-specific condition-aware game fit are separate views. None is a universal health claim or medical advice.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

export function FrozenMealInspector({ meal }: { meal: RuntimeFrozenMealSummary }) {
  const causeCopy = meal.settlementCause === "second-stall-unavailable"
    ? "The main was served; the second stall became unavailable, so that component was cancelled without charge."
    : meal.settlementCause === "served-timeout"
      ? "The main was served; the second component timed out and was cancelled without charge."
      : meal.settlementCause === "cancelled-before-service"
        ? "No component was served or charged."
        : meal.settlementCause === "complete"
          ? "Both components were served and charged."
          : meal.servedPreparationIds.length === 1
            ? "The main is served. The guest is heading to the second stall or waiting for temporary queue space; the second component remains pending and uncharged."
            : "This two-item meal is still in progress; no component has been charged yet.";
  const combinedDataState = meal.explanationCodes.some((code) => code.startsWith("unavailable:"))
    ? "unavailable"
    : meal.explanationCodes.some((code) => code.startsWith("trace-component:"))
      ? "trace"
      : "known";
  const combinedDataCopy = combinedDataState === "unavailable"
    ? "At least one combined nutrient is unavailable because a component lacks a reported value; missing values were not imputed."
    : combinedDataState === "trace"
      ? "At least one component contains a source-reported trace value; trace was preserved rather than converted to zero."
      : "The combined nutrition inputs and fit explanations were frozen when this visit ordered.";
  return (
    <section className="frozen-meal-inspector" aria-labelledby="frozen-meal-title">
      <div>
        <span>Frozen two-item meal</span>
        <h4 id="frozen-meal-title">{meal.offerId}</h4>
      </div>
      <ul className="frozen-meal-components">
        {meal.components.map((component) => {
          const served = meal.servedPreparationIds.includes(component.preparationId);
          const cancelled = meal.cancelledPreparationIds.includes(component.preparationId);
          return (
            <li key={component.preparationId} data-state={served ? "served" : cancelled ? "cancelled" : "pending"}>
              <strong>{component.componentLabel} · {component.label}</strong>
              <span>{[component.variantLabel, component.servingLabel].filter(Boolean).join(" · ")}</span>
              <small>{served ? "Served and charged" : cancelled ? "Cancelled · no charge" : "Pending"}</small>
            </li>
          );
        })}
      </ul>
      <p className="frozen-meal-charge">
        <strong>Charged subtotal: <SgdAmount cents={meal.chargedPriceCents} /></strong>
        <span>Full two-item price: <SgdAmount cents={meal.priceCents} /> · no discount if both are served</span>
      </p>
      <p className="frozen-meal-cause" role="status">{causeCopy}</p>
      <dl className="combo-fit-grid is-frozen">
        <div><dt>Meal balance</dt><dd>{comboRatingValue(meal.mealBalance, "five")}</dd><small>Among unlocked feasible options at order · {comboCoverageText(meal.mealBalance)}</small></div>
        <div><dt>Intent fit</dt><dd>{comboRatingValue(meal.intentFit, "percent")}</dd><small>{meal.intentFit.needId ? titleFromId(meal.intentFit.needId) : "No visit intent"}</small></div>
        <div><dt>Condition-aware game fit</dt><dd>{comboRatingValue(meal.conditionAwareFit, "percent")}</dd><small>Visit-specific; not treatment advice</small></div>
      </dl>
      <p className="combo-data-note" data-state={combinedDataState}>{combinedDataCopy}</p>
    </section>
  );
}

type PreviewStyle = CSSProperties & {
  "--preview-accent": string;
};

type DishPreviewStyle = CSSProperties & {
  "--dish-portion": string;
  "--dish-garnish": string;
};

function placeablePreview(item: PlaceableDefinition): {
  recipe: ReturnType<typeof visualRecipeForPlaceable>;
  style: PreviewStyle;
} {
  const recipe = visualRecipeForPlaceable(item.id, item.category, item.tags);
  return {
    recipe,
    style: {
      "--preview-accent": `#${recipe.accent.toString(16).padStart(6, "0")}`,
    },
  };
}

function dishPresentation(recipe: ReturnType<typeof visualRecipeForDish>) {
  const presentation = recipe.presentation;
  if (presentation.vessel === "tall-drinking-glass") return "tall-drink";
  if (presentation.vessel === "kopitiam-cup-and-saucer") return "mug";
  return {
    "rice-mound": "composed-rice",
    porridge: "porridge",
    "noodle-tangle": "noodles",
    broth: "soup",
    liquid: "mug",
    "shaved-ice": "shaved-dessert",
    flatbread: presentation.motif.includes("thosai") ? "rolled-bread" : "flatbread",
    "cake-cubes": "fried-plate",
    omelette: "fried-plate",
    fritters: "small-cakes",
    dumplings: "dumplings",
    skewers: "skewers",
    "grilled-pieces": "grilled",
    pudding: "porridge",
    "whole-seafood": "seafood",
    "leaf-parcel": "leaf-parcel",
    buns: "dumplings",
    "braised-scoop": "braised-scoop",
    "vegetable-scoop": "vegetable-scoop",
  }[presentation.portionShape];
}

function dishPreview(dish: (typeof DISHES)[number]): {
  recipe: ReturnType<typeof visualRecipeForDish>;
  presentation: string;
  style: DishPreviewStyle;
} {
  const recipe = visualRecipeForDish(dish);
  return {
    recipe,
    presentation: dishPresentation(recipe),
    style: {
      "--dish-portion": `#${recipe.portionColour.toString(16).padStart(6, "0")}`,
      "--dish-garnish": `#${recipe.garnishColour.toString(16).padStart(6, "0")}`,
    },
  };
}

function nutritionProfileView(
  dishId: string,
  variantId?: string,
): NutritionProfileView | undefined {
  const profile = getNutritionProfile(dishId, variantId);
  if (!profile) return undefined;
  const ratedProfile = profile as typeof profile & {
    readonly healthRating?: number;
    readonly conditionRatings?: Readonly<Record<string, number>>;
  };
  return {
    status: profile.status,
    servingLabel: profile.serving?.label,
    energyKcal: profile.nutrients.energyKcal,
    proteinG: profile.nutrients.proteinG,
    totalFatG: profile.nutrients.totalFatG,
    saturatedFatG: profile.nutrients.saturatedFatG,
    transFatG: profile.nutrients.transFatG,
    carbohydrateG: profile.nutrients.carbohydrateG,
    dietaryFibreG: profile.nutrients.dietaryFibreG,
    sodiumMg: profile.nutrients.sodiumMg,
    totalSugarG: profile.nutrients.totalSugarG,
    calciumMg: profile.nutrients.calciumMg,
    ironMg: profile.nutrients.ironMg,
    waterG: profile.nutrients.waterG,
    healthRating: ratedProfile.healthRating,
    conditionRatings: ratedProfile.conditionRatings,
    ratingStates: profile.ratingStates,
    intentFits: profile.intentFits,
  };
}

function dishLabel(dishId: string) {
  const dish = DISHES.find((candidate) => candidate.id === dishId);
  return dish ? localize(dish.nameKey) : dishId.replace(/^dish\./, "").replaceAll("-", " ");
}

function dishStarRating(dishId: string) {
  const dish = DISHES.find((candidate) => candidate.id === dishId) as
    | (DishDefinition & { readonly starRating?: number })
    | undefined;
  return dish?.starRating;
}

function personaLabel(archetypeId: string) {
  const archetype = CUSTOMER_ARCHETYPES.find((candidate) => candidate.id === archetypeId);
  return archetype
    ? localize(archetype.nameKey)
    : archetypeId.replace(/^customer\./, "").replaceAll("-", " ");
}

function isDishAvailableForGuide(
  dish: DishDefinition,
  snapshot: Pick<RuntimeSnapshot, "level" | "reputation" | "unlockedContentIds">,
) {
  return (
    dish.unlockRequirement.level <= snapshot.level
    && dish.unlockRequirement.reputation <= snapshot.reputation
    && dish.unlockRequirement.prerequisiteIds.every((id) => snapshot.unlockedContentIds.includes(id))
  );
}

export function guidedOptionAdvantageCount(
  option: GuidedDecisionOption,
  other: GuidedDecisionOption,
) {
  return [
    option.terms.priceCents < other.terms.priceCents,
    option.terms.ingredientCostCents < other.terms.ingredientCostCents,
    option.terms.preparationTimeMs < other.terms.preparationTimeMs,
    option.terms.starAppeal > other.terms.starAppeal,
    option.terms.demandModifierBasisPoints > other.terms.demandModifierBasisPoints,
    option.intentFit !== undefined && other.intentFit !== undefined && option.intentFit > other.intentFit,
  ].filter(Boolean).length;
}

export function guidedPairScore(
  left: GuidedDecisionOption,
  right: GuidedDecisionOption,
) {
  const leftAdvantages = guidedOptionAdvantageCount(left, right);
  const rightAdvantages = guidedOptionAdvantageCount(right, left);
  if (leftAdvantages === 0 || rightAdvantages === 0) return Number.NEGATIVE_INFINITY;
  const distinctDishBonus = left.dishId !== right.dishId ? 100 : 0;
  const fitDifference = left.intentFit !== undefined && right.intentFit !== undefined
    ? Math.round(Math.abs(left.intentFit - right.intentFit) * 100)
    : 0;
  return 1_000 + distinctDishBonus + Math.min(leftAdvantages, rightAdvantages) * 20 + fitDifference;
}

export function selectGuidedTradeoffPair(
  candidates: readonly GuidedDecisionOption[],
): readonly [GuidedDecisionOption, GuidedDecisionOption] | undefined {
  let bestPair: readonly [GuidedDecisionOption, GuidedDecisionOption] | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < candidates.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const pair = [candidates[leftIndex]!, candidates[rightIndex]!] as const;
      const score = guidedPairScore(pair[0], pair[1]);
      if (Number.isFinite(score) && score > bestScore) {
        bestPair = pair;
        bestScore = score;
      }
    }
  }
  return bestPair;
}

function buildGuidedDecision(
  snapshot: RuntimeSnapshot,
  forecast: RuntimeForecast | undefined,
  nutritionFamilies: readonly NutritionFamilyView[],
): GuidedDecision | undefined {
  if (!forecast) return undefined;
  const needsById = new Map(forecast.nutritionIntents.map((need) => [need.id, need]));
  const eligibleCoverage = forecast.coverage
    .filter((coverage) => coverage.eligibleForRequiredContent && needsById.has(coverage.needId))
    .sort((left, right) => (
      (needsById.get(right.needId)?.basisPoints ?? 0) - (needsById.get(left.needId)?.basisPoints ?? 0)
      || left.needId.localeCompare(right.needId)
    ));
  const selectedCoverage = eligibleCoverage[0];
  const selectedNeed = selectedCoverage
    ? needsById.get(selectedCoverage.needId)
    : [...forecast.nutritionIntents].sort(
        (left, right) => right.basisPoints - left.basisPoints || left.id.localeCompare(right.id),
      )[0];
  if (!selectedNeed) return undefined;
  const intentId = selectedNeed.nutritionIntent ?? selectedNeed.id.replace(/^intent\./, "");
  const viableIds = new Set(selectedCoverage?.unlockedViableResponseIds ?? []);
  const restrictToViableResponses = Boolean(selectedCoverage);
  const candidates: GuidedDecisionOption[] = [];

  for (const preparation of snapshot.activePreparations) {
    const dish = DISHES.find((candidate) => candidate.id === preparation.dishId);
    if (!dish || !isDishAvailableForGuide(dish, snapshot)) continue;
    const family = nutritionFamilies.find((candidate) => candidate.dishId === dish.id);
    const variant = family?.variants.find((candidate) => candidate.id === preparation.variantId)
      ?? family?.variants.find((candidate) => candidate.id === family.activeVariantId);
    if (family && (!variant || !variant.unlocked)) continue;
    const profile = variant?.profile ?? nutritionProfileView(dish.id, preparation.variantId);
    const responseMatches = viableIds.has(preparation.preparationId)
      || viableIds.has(preparation.dishId)
      || (preparation.variantId ? viableIds.has(preparation.variantId) : false);
    if (restrictToViableResponses && !responseMatches) continue;
    if (!profile || profile.status !== "released") continue;
    candidates.push({
      dishId: dish.id,
      responseId: [...viableIds].find((id) => (
        id === preparation.preparationId || id === preparation.dishId || id === preparation.variantId
      )) ?? preparation.preparationId,
      label: dishLabel(dish.id),
      variantLabel: variant && variant.label !== dishLabel(dish.id) ? variant.label : undefined,
      terms: preparation.terms,
      profile,
      intentFit: profile?.intentFits?.[intentId],
    });
  }

  for (const family of nutritionFamilies) {
    const dish = DISHES.find((candidate) => candidate.id === family.dishId);
    if (!dish || !isDishAvailableForGuide(dish, snapshot)) continue;
    for (const variant of family.variants) {
      if (!variant.unlocked) continue;
      const variantPreparationId = `${family.dishId}::${variant.id}`;
      const responseId = [...viableIds].find((id) => id === variantPreparationId)
        ?? variantPreparationId;
      if (restrictToViableResponses && !viableIds.has(responseId)) continue;
      if (!variant.profile || variant.profile.status !== "released") continue;
      const duplicate = candidates.some((candidate) => candidate.responseId === responseId);
      if (duplicate) continue;
      candidates.push({
        dishId: family.dishId,
        responseId,
        label: dishLabel(family.dishId),
        variantLabel: variant.label !== dishLabel(family.dishId) ? variant.label : undefined,
        terms: variant.terms,
        profile: variant.profile,
        intentFit: variant.profile?.intentFits?.[intentId],
      });
    }
  }

  const bestPair = selectGuidedTradeoffPair(candidates);
  if (!bestPair) return undefined;
  return {
    needId: selectedNeed.id,
    needLabel: forecastNeedLabel(selectedNeed),
    options: bestPair,
  };
}

export function guidedRevealCopy(
  selected: GuidedDecisionOption,
  other: GuidedDecisionOption,
  needLabel: string,
) {
  if (
    guidedOptionAdvantageCount(selected, other) === 0
    || guidedOptionAdvantageCount(other, selected) === 0
  ) {
    throw new Error("Guided decisions require at least one strict advantage for each option.");
  }

  let benefit: string | undefined;
  let benefitAccessible: string | undefined;
  if (selected.intentFit !== undefined && other.intentFit !== undefined && selected.intentFit > other.intentFit) {
    benefit = `${Math.round(selected.intentFit * 100)}% in-game ${needLabel.toLocaleLowerCase("en-SG")} fit, compared with ${Math.round(other.intentFit * 100)}% for the other option.`;
    benefitAccessible = benefit;
  } else if (selected.terms.priceCents < other.terms.priceCents) {
    const difference = other.terms.priceCents - selected.terms.priceCents;
    benefit = `${formatSgd(difference)} less for the guest.`;
    benefitAccessible = `${describeSgd(difference)} less for the guest.`;
  } else if (selected.terms.ingredientCostCents < other.terms.ingredientCostCents) {
    const difference = other.terms.ingredientCostCents - selected.terms.ingredientCostCents;
    benefit = `${formatSgd(difference)} less ingredient cost per serving.`;
    benefitAccessible = `${describeSgd(difference)} less ingredient cost per serving.`;
  } else if (selected.terms.preparationTimeMs < other.terms.preparationTimeMs) {
    benefit = `${preparationDurationLabel(other.terms.preparationTimeMs - selected.terms.preparationTimeMs)} faster to prepare.`;
    benefitAccessible = benefit;
  } else if (selected.terms.starAppeal > other.terms.starAppeal) {
    benefit = `${(selected.terms.starAppeal - other.terms.starAppeal).toFixed(1)} more Star appeal in this comparison.`;
    benefitAccessible = benefit;
  } else if (selected.terms.demandModifierBasisPoints > other.terms.demandModifierBasisPoints) {
    benefit = `${forecastShareLabel(selected.terms.demandModifierBasisPoints - other.terms.demandModifierBasisPoints)} more relative demand pull.`;
    benefitAccessible = benefit;
  }

  let tradeoff: string | undefined;
  let tradeoffAccessible: string | undefined;
  if (selected.intentFit !== undefined && other.intentFit !== undefined && selected.intentFit < other.intentFit) {
    tradeoff = `${Math.round((other.intentFit - selected.intentFit) * 100)} percentage points less in-game fit for this forecast need.`;
    tradeoffAccessible = tradeoff;
  } else if (selected.terms.ingredientCostCents > other.terms.ingredientCostCents) {
    const difference = selected.terms.ingredientCostCents - other.terms.ingredientCostCents;
    tradeoff = `${formatSgd(difference)} more ingredient cost per serving.`;
    tradeoffAccessible = `${describeSgd(difference)} more ingredient cost per serving.`;
  } else if (selected.terms.preparationTimeMs > other.terms.preparationTimeMs) {
    tradeoff = `${preparationDurationLabel(selected.terms.preparationTimeMs - other.terms.preparationTimeMs)} longer to prepare.`;
    tradeoffAccessible = tradeoff;
  } else if (selected.terms.priceCents > other.terms.priceCents) {
    const difference = selected.terms.priceCents - other.terms.priceCents;
    tradeoff = `${formatSgd(difference)} higher guest price.`;
    tradeoffAccessible = `${describeSgd(difference)} higher guest price.`;
  } else if (selected.terms.starAppeal < other.terms.starAppeal) {
    tradeoff = `${(other.terms.starAppeal - selected.terms.starAppeal).toFixed(1)} less Star appeal.`;
    tradeoffAccessible = tradeoff;
  } else if (selected.terms.demandModifierBasisPoints < other.terms.demandModifierBasisPoints) {
    tradeoff = `${forecastShareLabel(other.terms.demandModifierBasisPoints - selected.terms.demandModifierBasisPoints)} less relative demand pull.`;
    tradeoffAccessible = tradeoff;
  }
  if (!benefit || !benefitAccessible || !tradeoff || !tradeoffAccessible) {
    throw new Error("Guided decision copy must resolve one specific benefit and trade-off.");
  }
  return { benefit, benefitAccessible, tradeoff, tradeoffAccessible };
}

function signedEffect(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${Math.round(value)}${suffix}`;
}

function utilityEffects(item: PlaceableDefinition): readonly string[] {
  const effects: string[] = [];
  const resolved = utilityEffectsForPlaceable(item);
  if (resolved.ambience !== 0) effects.push(`Ambience ${signedEffect(resolved.ambience)}`);
  if (resolved.cleanliness !== 0) {
    effects.push(`Cleanliness ${signedEffect(resolved.cleanliness)}`);
  }
  if (resolved.queuePatience !== 0) {
    effects.push(`Queue patience ${signedEffect(resolved.queuePatience * 100, "%")}`);
  }
  if (resolved.eatingSpeed !== 0) {
    effects.push(`Eating speed ${signedEffect(resolved.eatingSpeed * 100, "%")}`);
  }
  if (resolved.cleaningEfficiency !== 0) {
    effects.push(`Cleaning efficiency ${signedEffect(resolved.cleaningEfficiency * 100, "%")}`);
  }
  if (resolved.movementSpeed !== 0) {
    effects.push(`Walking speed ${signedEffect(resolved.movementSpeed * 100, "%")}`);
  }
  if (resolved.wayfinding > 0) {
    effects.push(`Wayfinding ${signedEffect(resolved.wayfinding * 100, "%")}`);
  }
  if (item.lightRadius > 0) effects.push(`Lights ${item.lightRadius}-tile radius`);
  for (const role of new Set(item.interactionPoints.map((point) => point.role))) {
    effects.push(
      {
        "return-tray": "Enables tray return",
        "dispose-waste": "Supports cleaner waste handling",
        "wash-hands": "Improves hygiene and dining comfort",
        "collect-water": "Improves refreshment and dining comfort",
        "inspect-menu": "Improves stall discovery",
        queue: "Improves queue patience and flow",
        sit: "Provides usable seating",
        use: "Provides passive facility support",
      }[role],
    );
  }
  if (item.queuePoints.length > 0) effects.push(`${item.queuePoints.length} queue guide points`);
  return [...new Set(effects)];
}

function primaryUtility(item: PlaceableDefinition) {
  return utilityEffects(item)[0] ??
    (item.walkability === "blocked" ? "Shapes guest routes" : "Walk-through decor");
}

const UNLOCKABLE_CONTENT = [...PLACEABLES, ...STALLS] as const;
const UNLOCKABLE_BY_ID = new Map(UNLOCKABLE_CONTENT.map((item) => [item.id, item]));
const CUSTOMER_PERSONAS_BY_UNLOCK = [...CUSTOMER_ARCHETYPES].sort(
  (left, right) =>
    left.unlockRequirement.level - right.unlockRequirement.level ||
    left.unlockRequirement.reputation - right.unlockRequirement.reputation ||
    left.id.localeCompare(right.id, "en-SG"),
);

function unlockLabel(
  item: Pick<PlaceableDefinition | StallDefinition | DishDefinition, "nameKey" | "unlockRequirement">,
  level: number,
  reputation: number,
  unlockedContentIds: readonly string[],
) {
  if (item.unlockRequirement.level > level) {
    return `Level ${item.unlockRequirement.level}`;
  }
  if (item.unlockRequirement.reputation > reputation) {
    return `Rep ${item.unlockRequirement.reputation}`;
  }
  const prerequisiteId = item.unlockRequirement.prerequisiteIds.find(
    (id) => !unlockedContentIds.includes(id),
  );
  const prerequisite = prerequisiteId ? UNLOCKABLE_BY_ID.get(prerequisiteId) : undefined;
  return prerequisite ? `After ${localize(prerequisite.nameKey)}` : "Locked";
}

const TUTORIAL_COPY = [
  {
    eyebrow: "Welcome, neighbour",
    title: "Run the centre. Read the plate.",
    body: "Your community dining hall is ready for its first breakfast service. Every choice changes how people move, queue, eat, and compare menu trade-offs.",
    action: "Show me around",
  },
  {
    eyebrow: "Step 1 of 4",
    title: "Move around the centre",
    body: "Drag the floor to pan. Use the wheel or the camera controls to zoom. Keyboard players can use the arrow keys and + or −.",
    action: "Got it",
  },
  {
    eyebrow: "Step 2 of 4",
    title: "Choose something to place",
    body: "Open Build, choose an unlocked item, then select a highlighted tile. Press R to rotate and Escape to cancel.",
    action: "Next",
  },
  {
    eyebrow: "Step 3 of 4",
    title: "Read the living layout",
    body: "Dotted paths show routes. Numbered queue markers show pressure. Seat rings show reservations. Centre insights explains every bottleneck.",
    action: "Next",
  },
  {
    eyebrow: "Step 4 of 4",
    title: "Check the breakfast forecast",
    body: "Each period opens for a fixed four-minute arrival cohort, then drains the same guests before a debrief. First, compare two unlocked options against one expected visit need. You will still choose when service starts.",
    action: "Compare two options",
  },
] as const;

export function HawkerSimulator() {
  const gameHostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RuntimeController | undefined>(undefined);
  const audioRef = useRef<AudioDirector | undefined>(undefined);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const pendingSaveRef = useRef<unknown>(undefined);
  const pendingSaveScopeRef = useRef<GameSaveScope>(MAIN_GAME_SCOPE);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const metaSaveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveSequenceRef = useRef(0);
  const runtimeGenerationRef = useRef(0);
  const localDataOperationRef = useRef(false);
  const activeScopeRef = useRef<GameSaveScope>(MAIN_GAME_SCOPE);
  const mainLevelRef = useRef(INITIAL_LEVEL);
  const metaProgressionRef = useRef<MetaProgressionV1>(
    createEmptyMetaProgression(),
  );
  const lastMasteryDebriefRef = useRef<number | undefined>(undefined);
  const pendingMasteryDebriefRef = useRef<MasteryPeriodDebrief | undefined>(
    undefined,
  );
  const masteryDebriefSaveRef = useRef<Promise<boolean>>(
    Promise.resolve(true),
  );
  const masteryDebriefAttemptRef = useRef(0);
  const masteryDebriefContinuePendingRef = useRef(false);
  const masteryDecisionPendingRef = useRef(false);
  const recordedScenarioResultRef = useRef<string | undefined>(undefined);
  const scenarioRewardSaveRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const storageWarningRef = useRef(false);
  const audioWarningRef = useRef(false);
  const toastSequenceRef = useRef(0);
  const activitySequenceRef = useRef(0);
  const panelRef = useRef<Panel>("build");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tutorialDialogRef = useRef<HTMLElement>(null);
  const nutritionTourDialogRef = useRef<HTMLElement>(null);
  const cataloguePanelRef = useRef<HTMLElement>(null);
  const settingsDialogRef = useRef<HTMLElement>(null);
  const helpDialogRef = useRef<HTMLElement>(null);
  const resetDialogRef = useRef<HTMLElement>(null);
  const eraseAllDialogRef = useRef<HTMLElement>(null);
  const periodDebriefDialogRef = useRef<HTMLElement>(null);
  const eventDecisionDialogRef = useRef<HTMLElement>(null);
  const managementReturnFocusRef = useRef<HTMLElement | null>(null);
  const managementFocusRestoreRequestedRef = useRef(false);

  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [activeScope, setActiveScope] = useState<GameSaveScope>(
    MAIN_GAME_SCOPE,
  );
  const [mainLevel, setMainLevel] = useState(INITIAL_LEVEL);
  const [metaProgression, setMetaProgression] = useState<MetaProgressionV1>(
    createEmptyMetaProgression,
  );
  const [scenarioHasSave, setScenarioHasSave] = useState<
    Readonly<Partial<Record<ScenarioId, boolean>>>
  >({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [panel, setPanel] = useState<Panel>("build");
  const [buildCategory, setBuildCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [menuStallId, setMenuStallId] = useState(STALLS[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [eraseAllOpen, setEraseAllOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(0);
  const [nutritionTourStep, setNutritionTourStep] = useState<NutritionTourStep>(2);
  const [guidedPredictionId, setGuidedPredictionId] = useState<string>();
  const [nutritionLens, setNutritionLens] = useState(true);
  const [variantLabDishId, setVariantLabDishId] = useState<string>();
  const [managementOpen, setManagementOpen] = useState(false);
  const [compactManagement, setCompactManagement] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activityEntries, setActivityEntries] = useState<readonly ActivityEntry[]>([]);
  const [activityUnread, setActivityUnread] = useState(0);
  const [online, setOnline] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localDataBusy, setLocalDataBusy] = useState(false);
  const [masteryDebriefSaveStatus, setMasteryDebriefSaveStatus] =
    useState<MasteryDebriefSaveStatus>("idle");
  const [masteryDecisionBusy, setMasteryDecisionBusy] = useState(false);
  const [loadingError, setLoadingError] = useState<string>();
  const [debugOpen, setDebugOpen] = useState(false);
  const [serviceAnnouncement, setServiceAnnouncement] = useState("");
  const eventDecisionOpen = Boolean(
    snapshot.neighbourhoodEvent?.requiresDecision
    && snapshot.servicePeriod.phase === "planning"
    && tutorialStep === 5
    && nutritionTourStep >= 2
    && !settingsOpen
    && !helpOpen
    && !resetOpen
    && !eraseAllOpen
    && !variantLabDishId
  );
  const debugEnabled = useSyncExternalStore(
    subscribeToStaticValue,
    getDebugSnapshot,
    getServerDebugSnapshot,
  );

  const announce = useCallback((event: RuntimeEvent) => {
    const activityId = ++activitySequenceRef.current;
    setActivityEntries((current) => appendActivityEvent(current, event, activityId));
    if (panelRef.current !== "activity") {
      setActivityUnread((current) => Math.min(99, current + 1));
    }
    if (!shouldShowPopup(event)) return;
    const id = ++toastSequenceRef.current;
    setToasts([{ ...event, id }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      event.kind === "error" ? 6_000 : 3_400,
    );
  }, []);

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  const reportStorageIssue = useCallback(
    (message: string) => {
      if (storageWarningRef.current) return;
      storageWarningRef.current = true;
      announce({ kind: "warning", message });
    },
    [announce],
  );

  function beginLocalDataOperation(): boolean {
    if (!claimLocalDataOperation(localDataOperationRef)) return false;
    setLocalDataBusy(true);
    return true;
  }

  function finishLocalDataOperation(): void {
    releaseLocalDataOperation(localDataOperationRef);
    setLocalDataBusy(false);
  }

  const performSave = useCallback(
    async (
      payload: unknown,
      scope: GameSaveScope,
      announceSuccess = false,
    ) => {
      const sequence = ++saveSequenceRef.current;
      setSnapshot((current) => ({ ...current, autosaveState: "saving" }));
      const operation = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveScopedGame(scope, payload));
      saveQueueRef.current = operation;
      try {
        await operation;
        if (sequence === saveSequenceRef.current) {
          setSnapshot((current) => ({ ...current, autosaveState: "saved" }));
        }
        if (announceSuccess) {
          announce({
            kind: "success",
            message: scope.kind === "main"
              ? "Centre saved on this device."
              : "Scenario saved on this device.",
          });
        }
      } catch {
        if (sequence === saveSequenceRef.current) {
          setSnapshot((current) => ({ ...current, autosaveState: "error" }));
        }
        announce({
          kind: "error",
          message: "Could not save locally. Storage may be unavailable or full.",
        });
        throw new Error("Local save failed");
      }
    },
    [announce],
  );

  const flushPendingSave = useCallback(
    async (
      captureFreshState = false,
      suppressFailure = true,
    ): Promise<boolean> => {
      window.clearTimeout(saveTimerRef.current);
      if (captureFreshState) {
        const freshPayload = latestRuntimeSavePayload(
          controllerRef.current,
          pendingSaveRef.current,
        );
        if (freshPayload !== undefined) {
          pendingSaveRef.current = freshPayload;
          pendingSaveScopeRef.current = activeScopeRef.current;
        }
      }
      const payload = pendingSaveRef.current;
      const operation = payload === undefined
        ? saveQueueRef.current
        : performSave(payload, pendingSaveScopeRef.current);
      pendingSaveRef.current = undefined;
      try {
        await operation;
        return true;
      } catch (error) {
        if (suppressFailure) return false;
        throw error;
      }
    },
    [performSave],
  );

  const persistMeta = useCallback(
    (nextMeta: MetaProgressionV1): Promise<boolean> => {
      const operation = metaSaveQueueRef.current
        .catch(() => false)
        .then(async () => {
          if (
            process.env.NODE_ENV !== "production" &&
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("visualQa")
          ) {
            metaProgressionRef.current = nextMeta;
            setMetaProgression(nextMeta);
            return true;
          }
          try {
            await saveMetaProgression(nextMeta);
            metaProgressionRef.current = nextMeta;
            setMetaProgression(nextMeta);
            return true;
          } catch {
            reportStorageIssue(
              "Medals, titles, cosmetics, or mastery progress could not be saved.",
            );
            return false;
          }
        });
      metaSaveQueueRef.current = operation;
      return operation;
    },
    [reportStorageIssue],
  );

  const persistMasteryDebrief = useCallback(
    (masteryDebrief: MasteryPeriodDebrief): Promise<boolean> => {
      const attempt = ++masteryDebriefAttemptRef.current;
      pendingMasteryDebriefRef.current = masteryDebrief;
      setMasteryDebriefSaveStatus("saving");
      const operation = (async () => {
        try {
          const result = applyMasteryPeriodDebriefToMeta(
            metaProgressionRef.current,
            masteryDebrief,
          );
          if (
            result.meta !== metaProgressionRef.current &&
            !(await persistMeta(result.meta))
          ) {
            if (attempt === masteryDebriefAttemptRef.current) {
              setMasteryDebriefSaveStatus("error");
            }
            return false;
          }
          if (attempt === masteryDebriefAttemptRef.current) {
            pendingMasteryDebriefRef.current = undefined;
            setMasteryDebriefSaveStatus("idle");
          }
          if (result.outcome) {
            announce({
              kind: result.outcome.status === "completed"
                ? "success"
                : "info",
              importance: "important",
              message: result.outcome.status === "completed"
                ? "Mastery contract complete. Its keepsake is now in the gallery."
                : "The mastery contract ended. A new rotation will arrive later.",
            });
          }
          return true;
        } catch (error) {
          if (attempt === masteryDebriefAttemptRef.current) {
            setMasteryDebriefSaveStatus("error");
          }
          announce({
            kind: "error",
            importance: "important",
            message: error instanceof Error
              ? `Mastery progress was not applied: ${error.message}`
              : "Mastery progress was not applied.",
          });
          return false;
        }
      })();
      masteryDebriefSaveRef.current = operation;
      return operation;
    },
    [announce, persistMeta],
  );

  const installRuntime = useCallback(
    async (
      scope: GameSaveScope,
      initialStates: readonly unknown[],
      runtimeSettings: RuntimeSettings,
      visualQa: boolean,
    ) => {
      const generation = ++runtimeGenerationRef.current;
      const previous = controllerRef.current;
      controllerRef.current = undefined;
      previous?.destroy();
      const { createHawkerRuntime } = await import(
        "@/src/game/runtime/createHawkerRuntime"
      );
      const controller = await createHawkerRuntime({
        parent: gameHostRef.current!,
        settings: runtimeSettings,
        ...(scope.kind === "scenario"
          ? { scenarioId: scope.scenarioId }
          : {}),
        initialStates,
        onSnapshot(nextSnapshot) {
          if (generation !== runtimeGenerationRef.current) return;
          setSnapshot((current) => ({
            ...nextSnapshot,
            autosaveState: current.autosaveState,
          }));
          if (scope.kind === "main") {
            if (mainLevelRef.current !== nextSnapshot.level) {
              mainLevelRef.current = nextSnapshot.level;
              setMainLevel(nextSnapshot.level);
              void savePreference(
                MAIN_LEVEL_PREFERENCE,
                nextSnapshot.level,
              ).catch(() =>
                reportStorageIssue(
                  "Main-centre challenge unlocks could not be saved.",
                ),
              );
            }
            const masteryDebrief = masteryPeriodDebriefFromSnapshot(
              nextSnapshot,
            );
            if (
              masteryDebrief &&
              lastMasteryDebriefRef.current !==
                masteryDebrief.periodSequenceId
            ) {
              lastMasteryDebriefRef.current =
                masteryDebrief.periodSequenceId;
              void persistMasteryDebrief(masteryDebrief);
            }
          } else if (
            nextSnapshot.scenario?.runComplete &&
            nextSnapshot.servicePeriod.phase === "debrief"
          ) {
            const resultKey = [
              nextSnapshot.scenario.scenarioId,
              nextSnapshot.servicePeriod.sequenceId,
              nextSnapshot.scenario.score,
              nextSnapshot.scenario.medal ?? "none",
            ].join(":");
            if (recordedScenarioResultRef.current !== resultKey) {
              recordedScenarioResultRef.current = resultKey;
              const nextMeta = recordScenarioResultInMeta(
                metaProgressionRef.current,
                nextSnapshot.scenario,
              );
              if (nextMeta !== metaProgressionRef.current) {
                const rewardSave = persistMeta(nextMeta).then((saved) => {
                  if (!saved) recordedScenarioResultRef.current = undefined;
                  return saved;
                });
                scenarioRewardSaveRef.current = rewardSave;
              }
            }
          }
          audioRef.current?.setGameplayState(
            nextSnapshot.isOpen,
            nextSnapshot.activeCustomers,
            nextSnapshot.queuePressure,
          );
        },
        onEvent(event) {
          if (generation !== runtimeGenerationRef.current) return;
          announce(event);
          if (event.kind === "success") audioRef.current?.play("sale");
          if (event.kind === "error") audioRef.current?.play("invalid");
        },
        onPersistentChange(state) {
          if (visualQa || generation !== runtimeGenerationRef.current) return;
          pendingSaveRef.current = state;
          pendingSaveScopeRef.current = scope;
          if (scope.kind === "scenario") {
            setScenarioHasSave((current) => ({
              ...current,
              [scope.scenarioId]: true,
            }));
          }
          window.clearTimeout(saveTimerRef.current);
          setSnapshot((current) => ({
            ...current,
            autosaveState: "saving",
          }));
          saveTimerRef.current = window.setTimeout(() => {
            void flushPendingSave();
          }, 200);
        },
      });
      if (generation !== runtimeGenerationRef.current) {
        controller.destroy();
        return;
      }
      controllerRef.current = controller;
    },
    [
      announce,
      flushPendingSave,
      persistMasteryDebrief,
      persistMeta,
      reportStorageIssue,
    ],
  );

  useEffect(() => {
    let disposed = false;
    let unregisterPwa: () => void = () => {};
    audioRef.current = new AudioDirector();

    async function start() {
      try {
        validateContent();
        const qaParams = process.env.NODE_ENV !== "production"
          ? new URLSearchParams(window.location.search)
          : undefined;
        const visualQa = qaParams?.has("visualQa") === true;
        let savedSettings = DEFAULT_SETTINGS;
        let completedTutorial = false;
        let completedNutritionTour = false;
        let completedGuidedDecision = false;
        let savedNutritionLens = true;
        let initialStates: readonly unknown[] = [];
        let savedScope: GameSaveScope = MAIN_GAME_SCOPE;
        let savedMainLevel = INITIAL_LEVEL;
        let savedMeta = createEmptyMetaProgression();
        let savedScenarioSlots: Readonly<
          Partial<Record<ScenarioId, boolean>>
        > = {};
        try {
          const initialSettings = {
            ...DEFAULT_SETTINGS,
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          };
          savedSettings = normalizeSettings(
            await loadPreference<unknown>("settings", undefined),
            initialSettings,
          );
          completedTutorial =
            (await loadPreference<unknown>("tutorial-complete", false)) === true;
          completedNutritionTour =
            (await loadPreference<unknown>("nutrition-tour-v1-complete", false)) === true;
          const guidedDecisionPreference = await loadPreference<unknown>(
            "forecast-guide-v1-complete",
            undefined,
          );
          completedGuidedDecision = guidedDecisionPreference === true
            || (guidedDecisionPreference === undefined && completedNutritionTour);
          savedNutritionLens =
            (await loadPreference<unknown>("nutrition-lens-enabled", true)) !== false;
          savedScope = parseActiveGameScope(
            await loadPreference<unknown>(
              ACTIVE_SCOPE_PREFERENCE,
              MAIN_GAME_SCOPE,
            ),
          );
          const storedMainLevel = await loadPreference<unknown>(
            MAIN_LEVEL_PREFERENCE,
            INITIAL_LEVEL,
          );
          savedMainLevel =
            typeof storedMainLevel === "number" &&
              Number.isSafeInteger(storedMainLevel) &&
              storedMainLevel >= INITIAL_LEVEL
              ? storedMainLevel
              : INITIAL_LEVEL;
        } catch {
          reportStorageIssue(
            "Local preferences are unavailable. The game will continue with defaults.",
          );
        }
        if (visualQa) {
          window.history.scrollRestoration = "manual";
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          const requestedScale = Number(qaParams?.get("textScale"));
          savedSettings = {
            ...savedSettings,
            textScale: Number.isFinite(requestedScale)
              ? Math.min(2, Math.max(1, requestedScale))
              : 1,
          };
          completedTutorial = true;
          completedNutritionTour = true;
          completedGuidedDecision = true;
          savedScope = MAIN_GAME_SCOPE;
        } else {
          try {
            const slotEntries = await Promise.all(
              SCENARIOS.map(async (scenario) => [
                scenario.id,
                (await loadScopedGameCandidates(
                  scenarioGameScope(scenario.id),
                )).length > 0,
              ] as const),
            );
            savedScenarioSlots = Object.fromEntries(slotEntries);
            if (
              savedScope.kind === "scenario" &&
              savedScenarioSlots[savedScope.scenarioId] !== true
            ) {
              savedScope = MAIN_GAME_SCOPE;
            }
            const [scopeCandidates, mainCandidates, loadedMeta] =
              await Promise.all([
                loadScopedGameCandidates(savedScope),
                savedScope.kind === "main"
                  ? Promise.resolve<readonly unknown[]>([])
                  : loadScopedGameCandidates(MAIN_GAME_SCOPE),
                loadMetaProgression(),
              ]);
            initialStates = scopeCandidates;
            savedMeta = loadedMeta;
            if (savedScope.kind === "scenario" && mainCandidates.length > 0) {
              const { buildCatalog, restoreRuntimeEnvelope } = await import(
                "@/src/game/runtime/createHawkerRuntime"
              );
              const authoredCatalog = buildCatalog().catalog;
              for (const candidate of mainCandidates) {
                try {
                  savedMainLevel = restoreRuntimeEnvelope(
                    candidate,
                    authoredCatalog,
                  ).state.progression.level;
                  break;
                } catch {
                  // Try the backup candidate before falling back to the
                  // persisted main-level preference.
                }
              }
            }
          } catch {
            reportStorageIssue(
              "Local saves are unavailable in this browser session. You can still play, but progress may not persist.",
            );
          }
        }
        if (disposed || !gameHostRef.current) return;
        setSettings(savedSettings);
        activeScopeRef.current = savedScope;
        setActiveScope(savedScope);
        mainLevelRef.current = savedMainLevel;
        setMainLevel(savedMainLevel);
        metaProgressionRef.current = savedMeta;
        setMetaProgression(savedMeta);
        setScenarioHasSave(savedScenarioSlots);
        setTutorialStep(completedTutorial ? 5 : 0);
        setNutritionTourStep(completedGuidedDecision ? 2 : 0);
        setNutritionLens(savedNutritionLens);
        await installRuntime(
          savedScope,
          initialStates,
          savedSettings,
          visualQa,
        );
        if (disposed) {
          runtimeGenerationRef.current += 1;
          controllerRef.current?.destroy();
          controllerRef.current = undefined;
        } else {
          if (!visualQa) {
            unregisterPwa = registerPwa({
              onOfflineReady() {
                setOfflineReady(true);
              },
              onUpdateReady() {
                setUpdateReady(true);
              },
              onConnectivityChange(isOnline) {
                setOnline(isOnline);
              },
              onOfflineError(message) {
                announce({ kind: "warning", message: `Offline cache: ${message}` });
              },
            });
          }
        }
      } catch (error) {
        setLoadingError(
          error instanceof Error ? error.message : "The game could not start.",
        );
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void start();
    const flushOnPageHide = () => {
      if (!canCaptureLifecycleSave(localDataOperationRef)) return;
      void flushPendingSave(true);
    };
    window.addEventListener("pagehide", flushOnPageHide);

    return () => {
      disposed = true;
      runtimeGenerationRef.current += 1;
      window.clearTimeout(saveTimerRef.current);
      if (canCaptureLifecycleSave(localDataOperationRef)) {
        void flushPendingSave(true);
      }
      window.removeEventListener("pagehide", flushOnPageHide);
      controllerRef.current?.destroy();
      audioRef.current?.destroy();
      unregisterPwa();
    };
  }, [
    announce,
    flushPendingSave,
    installRuntime,
    reportStorageIssue,
  ]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--player-text-scale",
      String(settings.textScale),
    );
    controllerRef.current?.setQuality(settings.quality);
    controllerRef.current?.setTextScale(settings.textScale);
    controllerRef.current?.setReducedMotion(settings.reducedMotion);
    controllerRef.current?.setHighContrast(settings.highContrast);
    audioRef.current?.setVoiceLimit(settings.quality === "standard" ? 16 : 8);
    audioRef.current?.setVolumes(
      settings.musicVolume,
      settings.ambienceVolume,
      settings.sfxVolume,
      settings.masterMuted,
    );
    void savePreference("settings", settings).catch(() =>
      reportStorageIssue("Preferences could not be saved on this device."),
    );
  }, [reportStorageIssue, settings]);

  useEffect(() => {
    if (loading) return;
    void savePreference("nutrition-lens-enabled", nutritionLens).catch(() =>
      reportStorageIssue("Nutrition Lens preference could not be saved."),
    );
  }, [loading, nutritionLens, reportStorageIssue]);

  useEffect(() => {
    if (snapshot.unlockedContentIds.includes(menuStallId)) return;
    const firstUnlockedStall = STALLS.find((stall) =>
      snapshot.unlockedContentIds.includes(stall.id)
    );
    if (!firstUnlockedStall) return;
    const update = window.setTimeout(
      () => setMenuStallId(firstUnlockedStall.id),
      0,
    );
    return () => window.clearTimeout(update);
  }, [menuStallId, snapshot.unlockedContentIds]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 899px)");
    const updateCompactManagement = () => setCompactManagement(mediaQuery.matches);
    updateCompactManagement();
    mediaQuery.addEventListener("change", updateCompactManagement);
    return () => mediaQuery.removeEventListener("change", updateCompactManagement);
  }, []);

  const serviceAnnouncementMoment = meaningfulServiceAnnouncement(snapshot.servicePeriod);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setServiceAnnouncement(serviceAnnouncementMoment.message),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [serviceAnnouncementMoment.key, serviceAnnouncementMoment.message]);

  useEffect(() => {
    const modal = eraseAllOpen
      ? eraseAllDialogRef.current
      : resetOpen
      ? resetDialogRef.current
      : settingsOpen
        ? settingsDialogRef.current
        : helpOpen
          ? helpDialogRef.current
          : snapshot.servicePeriod.phase === "debrief"
            ? periodDebriefDialogRef.current
            : tutorialStep < 5
              ? tutorialDialogRef.current
              : nutritionTourStep < 2
                ? nutritionTourDialogRef.current
                : eventDecisionOpen
                  ? eventDecisionDialogRef.current
                  : null;
    if (!modal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[href]",
      "summary",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusables = () =>
      Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
      );
    const initial = modal.querySelector<HTMLElement>("[data-modal-initial-focus]")
      ?? modal.querySelector<HTMLElement>("[autofocus]")
      ?? focusables()[0]
      ?? modal;
    window.requestAnimationFrame(() => initial.focus());

    const handleModalKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (localDataBusy && (eraseAllOpen || resetOpen)) return;
        if (eraseAllOpen) setEraseAllOpen(false);
        else if (resetOpen) setResetOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (helpOpen) setHelpOpen(false);
        else if (snapshot.servicePeriod.phase === "debrief") {
          (focusables()[0] ?? modal).focus();
        }
        else if (tutorialStep < 5) {
          setTutorialStep(5);
          void savePreference("tutorial-complete", true).catch(() =>
            reportStorageIssue("Tutorial progress could not be saved."),
          );
        } else if (nutritionTourStep < 2) {
          setNutritionTourStep(2);
          setGuidedPredictionId(undefined);
          void savePreference("forecast-guide-v1-complete", true).catch(() =>
            reportStorageIssue("What’s new guide progress could not be saved."),
          );
          void savePreference("nutrition-tour-v1-complete", true).catch(() =>
            reportStorageIssue("Legacy nutrition guide progress could not be saved."),
          );
        } else if (eventDecisionOpen) {
          controllerRef.current?.dismissNeighbourhoodEvent();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const available = focusables();
      if (available.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = available[0]!;
      const last = available[available.length - 1]!;
      if (document.activeElement === initial && !available.includes(initial)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleModalKeys);
    return () => {
      document.removeEventListener("keydown", handleModalKeys);
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [
    helpOpen,
    eraseAllOpen,
    localDataBusy,
    nutritionTourStep,
    eventDecisionOpen,
    reportStorageIssue,
    resetOpen,
    settingsOpen,
    snapshot.activePreparations.length,
    snapshot.nutritionFamilies.length,
    snapshot.servicePeriod.phase,
    tutorialStep,
  ]);

  const buildCategories = useMemo(
    () => ["all", ...new Set(PLACEABLES.map((item) => item.category))],
    [],
  );

  const visiblePlaceables = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en-SG");
    return PLACEABLES.filter((item) => {
      const matchesCategory = buildCategory === "all" || item.category === buildCategory;
      const searchable = `${localize(item.nameKey)} ${localize(item.descriptionKey)}`.toLocaleLowerCase("en-SG");
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [buildCategory, query]);

  const selectedContent = useMemo(
    () =>
      PLACEABLES.find((item) => item.id === selectedId) ??
      STALLS.find((stall) => stall.id === selectedId),
    [selectedId],
  );
  const configurationLocked = snapshot.servicePeriod.configurationLocked;
  const scenarioMenuFixed = activeScope.kind === "scenario";

  function explainConfigurationLock() {
    announce({
      kind: "info",
      message: `${snapshot.servicePeriod.label} service is in progress. Layout, menu, and preparation changes reopen during planning.`,
    });
  }

  function unlockAudio() {
    void audioRef.current
      ?.unlock()
      .then(() => audioRef.current?.startAmbience())
      .catch(() => {
        if (audioWarningRef.current) return;
        audioWarningRef.current = true;
        announce({
          kind: "warning",
          message: "Audio is unavailable; every important cue still has a visual equivalent.",
        });
      });
  }

  function selectBuildItem(item: PlaceableDefinition | StallDefinition) {
    unlockAudio();
    if (configurationLocked) {
      explainConfigurationLock();
      return;
    }
    if (!snapshot.unlockedContentIds.includes(item.id)) {
      announce({
        kind: "warning",
        message: `${localize(item.nameKey)} unlocks with ${unlockLabel(item, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds).toLocaleLowerCase("en-SG")}.`,
      });
      return;
    }
    if (getContentPriceCents(item) > snapshot.cashCents) {
      announce({ kind: "warning", message: "You need more Singapore dollars for that item." });
      return;
    }
    setSelectedId(item.id);
    controllerRef.current?.selectBuildItem(item.id);
    controllerRef.current?.setBuildTool("place");
    audioRef.current?.play("ui");
  }

  function chooseTool(tool: BuildTool) {
    if (configurationLocked && tool !== "select") {
      explainConfigurationLock();
      return;
    }
    setSelectedId(tool === "place" ? selectedId : undefined);
    controllerRef.current?.setBuildTool(tool);
    if (tool !== "place") controllerRef.current?.selectBuildItem(undefined);
    audioRef.current?.play("ui");
  }

  function chooseRouteTool() {
    const nextTool: BuildTool = snapshot.buildTool === "route" ? "select" : "route";
    chooseTool(nextTool);
    if (nextTool === "route") {
      window.requestAnimationFrame(() => gameHostRef.current?.focus());
    }
  }

  function setGameSpeed(speed: GameSpeed) {
    unlockAudio();
    controllerRef.current?.setSpeed(speed);
    audioRef.current?.play("ui");
  }

  async function toggleCentre() {
    unlockAudio();
    if (
      snapshot.servicePeriod.phase === "debrief" &&
      activeScopeRef.current.kind === "scenario"
    ) {
      void leaveScenario(activeScopeRef.current.scenarioId);
      return;
    }
    if (
      snapshot.servicePeriod.phase === "debrief" &&
      activeScopeRef.current.kind === "main"
    ) {
      if (masteryDebriefContinuePendingRef.current) return;
      masteryDebriefContinuePendingRef.current = true;
      try {
        const masterySaveResult = await ensureMasteryDebriefSaved(
          masteryDebriefSaveRef.current,
          pendingMasteryDebriefRef.current,
          snapshot.servicePeriod.sequenceId,
          persistMasteryDebrief,
        );
        if (masterySaveResult === "missing") {
          announce({
            kind: "error",
            importance: "important",
            message:
              "Mastery progress is not ready to retry. The debrief remains open so no period progress is skipped.",
          });
          return;
        }
        if (masterySaveResult === "failed") {
          announce({
            kind: "error",
            importance: "important",
            message:
              "Mastery progress still could not be saved. The debrief remains open; retry when local storage is available.",
          });
          return;
        }
        const changed = controllerRef.current?.toggleOpen() ?? false;
        if (changed) {
          audioRef.current?.play("open");
        }
        return;
      } finally {
        masteryDebriefContinuePendingRef.current = false;
      }
    }
    if (snapshot.servicePeriod.phase === "planning") {
      setSelectedId(undefined);
      setVariantLabDishId(undefined);
      controllerRef.current?.selectBuildItem(undefined);
      controllerRef.current?.setBuildTool("select");
    }
    const changed = controllerRef.current?.toggleOpen() ?? false;
    if (changed) {
      audioRef.current?.play(snapshot.servicePeriod.phase === "arrivals" ? "close" : "open");
    }
  }

  function skipObjective() {
    if (controllerRef.current?.skipObjective()) {
      audioRef.current?.play("ui");
      announce({ kind: "info", message: "Objective skipped for this period." });
    }
  }

  function acceptObjective(objectiveId: string) {
    if (controllerRef.current?.acceptObjective(objectiveId)) {
      audioRef.current?.play("reward");
      announce({ kind: "success", message: "Objective accepted. Its target and reward are now locked for this period." });
    }
  }

  async function finishTutorial() {
    setTutorialStep(5);
    await savePreference("tutorial-complete", true).catch(() =>
      reportStorageIssue("Tutorial progress could not be saved."),
    );
  }

  async function finishNutritionTour() {
    setNutritionTourStep(2);
    setGuidedPredictionId(undefined);
    await savePreference("forecast-guide-v1-complete", true).catch(() =>
      reportStorageIssue("What’s new guide progress could not be saved."),
    );
    await savePreference("nutrition-tour-v1-complete", true).catch(() =>
      reportStorageIssue("Legacy nutrition guide progress could not be saved."),
    );
  }

  function openGuidedDecision() {
    setGuidedPredictionId(undefined);
    setNutritionTourStep(0);
  }

  function openPanel(nextPanel: Panel, returnFocus?: HTMLElement) {
    if (
      !managementOpen &&
      !managementReturnFocusRef.current &&
      (
        window.matchMedia("(max-width: 899px)").matches ||
        settings.textScale >= 1.75
      )
    ) {
      managementReturnFocusRef.current =
        returnFocus ?? document.activeElement as HTMLElement | null;
    }
    setPanel(nextPanel);
    setManagementOpen(true);
    if (nextPanel === "activity") setActivityUnread(0);
  }

  function closeManagementSheet() {
    managementFocusRestoreRequestedRef.current = true;
    setManagementOpen(false);
    controllerRef.current?.selectCustomer(undefined);
  }

  async function switchGameScope(
    nextScope: GameSaveScope,
    clearNextSlot = false,
    operationAlreadyClaimed = false,
    successMessage?: string,
  ): Promise<boolean> {
    if (sameGameScope(activeScopeRef.current, nextScope) && !clearNextSlot) {
      return true;
    }
    const ownsOperation = !operationAlreadyClaimed;
    if (
      ownsOperation
        ? !beginLocalDataOperation()
        : !localDataOperationRef.current
    ) {
      return false;
    }
    const visualQa =
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("visualQa");
    if (visualQa) {
      setLoading(true);
      try {
        controllerRef.current?.setSpeed(0);
        pendingSaveRef.current = undefined;
        pendingSaveScopeRef.current = nextScope;
        activeScopeRef.current = nextScope;
        setActiveScope(nextScope);
        lastMasteryDebriefRef.current = undefined;
        recordedScenarioResultRef.current = undefined;
        await installRuntime(nextScope, [], settings, true);
        announce({
          kind: "success",
          importance: "important",
          message: successMessage ?? (
            nextScope.kind === "main"
              ? "Returned to the visual QA main centre."
              : `${humanizeScenarioCode(nextScope.scenarioId)} opened in a non-persisting visual QA fixture.`
          ),
        });
        return true;
      } finally {
        if (ownsOperation) finishLocalDataOperation();
        setLoading(false);
      }
    }
    const previousScope = activeScopeRef.current;
    setLoading(true);
    try {
      controllerRef.current?.setSpeed(0);
      await flushPendingSave(true, false);
      if (clearNextSlot) {
        await clearScopedGame(nextScope);
        if (nextScope.kind === "scenario") {
          setScenarioHasSave((current) => ({
            ...current,
            [nextScope.scenarioId]: false,
          }));
        }
      }
      const initialStates = clearNextSlot
        ? []
        : await loadScopedGameCandidates(nextScope);
      pendingSaveRef.current = undefined;
      pendingSaveScopeRef.current = nextScope;
      activeScopeRef.current = nextScope;
      setActiveScope(nextScope);
      lastMasteryDebriefRef.current = undefined;
      recordedScenarioResultRef.current = undefined;
      await savePreference(ACTIVE_SCOPE_PREFERENCE, nextScope);
      await installRuntime(nextScope, initialStates, settings, false);
      const installedState = controllerRef.current?.exportState();
      if (installedState !== undefined) {
        await performSave(installedState, nextScope);
        if (nextScope.kind === "scenario") {
          setScenarioHasSave((current) => ({
            ...current,
            [nextScope.scenarioId]: true,
          }));
        }
      }
      announce({
        kind: "success",
        importance: "important",
        message: successMessage ?? (
          nextScope.kind === "main"
            ? "Returned to the saved main centre."
            : `${humanizeScenarioCode(nextScope.scenarioId)} opened in its isolated save slot.`
        ),
      });
      return true;
    } catch (error) {
      try {
        activeScopeRef.current = previousScope;
        setActiveScope(previousScope);
        pendingSaveScopeRef.current = previousScope;
        await savePreference(ACTIVE_SCOPE_PREFERENCE, previousScope);
        await installRuntime(
          previousScope,
          await loadScopedGameCandidates(previousScope),
          settings,
          false,
        );
      } catch {
        // The original error remains the most actionable message. The global
        // loading error boundary still protects a subsequent full reload.
      }
      announce({
        kind: "error",
        message: error instanceof Error
          ? `Could not switch game saves: ${error.message}`
          : "Could not switch game saves.",
      });
      return false;
    } finally {
      if (ownsOperation) finishLocalDataOperation();
      setLoading(false);
    }
  }

  async function startScenario(scenarioId: ScenarioId) {
    if (activeScope.kind !== "main" || mainLevel < 3) {
      return;
    }
    await switchGameScope(scenarioGameScope(scenarioId), true);
  }

  async function resumeScenario(scenarioId: ScenarioId) {
    if (activeScope.kind !== "main" || mainLevel < 3) {
      return;
    }
    await switchGameScope(scenarioGameScope(scenarioId));
  }

  async function restartScenario(scenarioId: ScenarioId): Promise<boolean> {
    const currentScope = activeScopeRef.current;
    if (
      currentScope.kind !== "scenario" ||
      currentScope.scenarioId !== scenarioId
    ) {
      return false;
    }
    return switchGameScope(
      scenarioGameScope(scenarioId),
      true,
      false,
      "The scenario restarted from its authored setup. Main-centre progress and earned gallery rewards were preserved.",
    );
  }

  async function leaveScenario(scenarioId: ScenarioId) {
    const currentScope = activeScopeRef.current;
    if (
      currentScope.kind !== "scenario" ||
      currentScope.scenarioId !== scenarioId
    ) {
      return;
    }
    if (!beginLocalDataOperation()) return;
    try {
      const runComplete = snapshot.scenario?.runComplete === true;
      if (runComplete && snapshot.scenario) {
        await scenarioRewardSaveRef.current;
        const durableMeta = recordScenarioResultInMeta(
          metaProgressionRef.current,
          snapshot.scenario,
        );
        if (
          durableMeta !== metaProgressionRef.current &&
          !(await persistMeta(durableMeta))
        ) {
          announce({
            kind: "error",
            importance: "important",
            message:
              "The medal could not be saved, so this completed scenario was kept for a safe retry.",
          });
          return;
        }
      }
      if (
        await switchGameScope(MAIN_GAME_SCOPE, false, true) &&
        runComplete
      ) {
        try {
          await clearScopedGame(scenarioGameScope(scenarioId));
          setScenarioHasSave((current) => ({
            ...current,
            [scenarioId]: false,
          }));
        } catch {
          reportStorageIssue("The completed scenario slot could not be cleared.");
        }
      }
    } finally {
      finishLocalDataOperation();
    }
  }

  function currentMasteryOffer() {
    return deriveMasteryOffer({
      seed: MASTERY_SEED,
      day: snapshot.day,
      periodId: snapshot.servicePeriod.id,
      context: masteryFeasibilityContext({
        ...snapshot,
        level: mainLevel,
      }),
      progression: masteryProgressionFromMeta(metaProgressionRef.current),
      meta: metaProgressionRef.current,
    });
  }

  async function acceptMasteryContract(
    contractId: MasteryContractTemplate["id"],
  ) {
    if (
      activeScopeRef.current.kind !== "main" ||
      snapshot.servicePeriod.phase !== "planning" ||
      masteryDecisionPendingRef.current
    ) return;
    masteryDecisionPendingRef.current = true;
    setMasteryDecisionBusy(true);
    const offer = currentMasteryOffer();
    if (offer.status !== "available") {
      masteryDecisionPendingRef.current = false;
      setMasteryDecisionBusy(false);
      return;
    }
    try {
      const nextMeta = acceptMasteryOfferInMeta(
        metaProgressionRef.current,
        offer,
        contractId,
        snapshot.day,
        snapshot.servicePeriod.sequenceId,
      );
      if (!(await persistMeta(nextMeta))) return;
      audioRef.current?.play("reward");
      announce({
        kind: "success",
        importance: "important",
        message: "Mastery contract accepted. Its target and keepsake are frozen.",
      });
    } catch (error) {
      announce({
        kind: "error",
        message: error instanceof Error
          ? error.message
          : "The mastery contract could not be accepted.",
      });
    } finally {
      masteryDecisionPendingRef.current = false;
      setMasteryDecisionBusy(false);
    }
  }

  async function skipMasteryContracts() {
    if (
      activeScopeRef.current.kind !== "main" ||
      snapshot.servicePeriod.phase !== "planning" ||
      masteryDecisionPendingRef.current
    ) return;
    masteryDecisionPendingRef.current = true;
    setMasteryDecisionBusy(true);
    const offer = currentMasteryOffer();
    if (offer.status !== "available") {
      masteryDecisionPendingRef.current = false;
      setMasteryDecisionBusy(false);
      return;
    }
    try {
      if (!(await persistMeta(
        skipMasteryOfferInMeta(metaProgressionRef.current, offer),
      ))) return;
      announce({
        kind: "info",
        message: "This mastery rotation was skipped without penalty.",
      });
    } catch (error) {
      announce({
        kind: "error",
        message: error instanceof Error
          ? error.message
          : "The mastery offer could not be skipped.",
      });
    } finally {
      masteryDecisionPendingRef.current = false;
      setMasteryDecisionBusy(false);
    }
  }

  async function saveNow(): Promise<boolean> {
    if (!beginLocalDataOperation()) {
      announce({
        kind: "info",
        message: "Another local-data operation is still finishing.",
      });
      return false;
    }
    try {
      window.clearTimeout(saveTimerRef.current);
      pendingSaveRef.current = undefined;
      const state = controllerRef.current?.exportState();
      if (!state) return false;
      await performSave(state, activeScopeRef.current, true);
      return true;
    } catch {
      return false;
    } finally {
      finishLocalDataOperation();
    }
  }

  async function applyReadyUpdate() {
    if (!(await saveNow())) return;
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration?.waiting) {
      location.reload();
      return;
    }
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => location.reload(),
      { once: true },
    );
    registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
  }

  async function downloadSave() {
    if (!beginLocalDataOperation()) {
      announce({
        kind: "info",
        message: "Another local-data operation is still finishing.",
      });
      return;
    }
    try {
      const source = await runSerializedProgressExport({
        controller: controllerRef.current,
        previousSpeed: snapshot.speed,
        flushCore: () => flushPendingSave(true, false),
        flushMeta: () => metaSaveQueueRef.current,
        exportBundle: async () => {
          const freshMain = activeScopeRef.current.kind === "main"
            ? controllerRef.current?.exportState()
            : undefined;
          const [
            { buildCatalog, restoreRuntimeEnvelope },
            { restoreScenarioRuntimeEnvelope },
          ] = await Promise.all([
            import("@/src/game/runtime/createHawkerRuntime"),
            import("@/src/game/runtime/scenarioState"),
          ]);
          const authoredCatalog = buildCatalog().catalog;
          const validators: ProgressBundleValidators = {
            validateMain(payload) {
              restoreRuntimeEnvelope(payload, authoredCatalog);
            },
            validateScenario(scenarioId, payload) {
              restoreScenarioRuntimeEnvelope(
                scenarioId,
                payload,
                authoredCatalog,
              );
            },
          };
          return exportProgressBundle(freshMain, validators);
        },
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob([source], { type: "application/json" }),
      );
      link.download = `hawker-balance-day-${snapshot.day}-progress.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      announce({
        kind: "success",
        message: "Main centre, scenarios, medals, and mastery progress exported.",
      });
    } catch (error) {
      announce({
        kind: "error",
        message: error instanceof Error
          ? error.message
          : "Could not export progress.",
      });
    } finally {
      finishLocalDataOperation();
    }
  }

  async function uploadSave(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!beginLocalDataOperation()) {
      announce({
        kind: "info",
        message: "Another local-data operation is still finishing.",
      });
      return;
    }
    let loadingShown = false;
    let runtimePaused = false;
    let callbacksInvalidated = false;
    let committedImport: ProgressBundleSnapshot | undefined;
    const previousScope = activeScopeRef.current;
    const previousSpeed = snapshot.speed;
    try {
      const [
        { buildCatalog, restoreRuntimeEnvelope },
        { restoreScenarioRuntimeEnvelope },
      ] = await Promise.all([
        import("@/src/game/runtime/createHawkerRuntime"),
        import("@/src/game/runtime/scenarioState"),
      ]);
      const authoredCatalog = buildCatalog().catalog;
      const source = await file.text();
      const validators: ProgressBundleValidators = {
        validateMain(payload) {
          restoreRuntimeEnvelope(payload, authoredCatalog);
        },
        validateScenario(scenarioId, payload) {
          restoreScenarioRuntimeEnvelope(
            scenarioId,
            payload,
            authoredCatalog,
          );
        },
      };
      // Validate the full bundle before pausing or replacing any live data.
      deserializeProgressBundle(source, validators);
      setLoading(true);
      loadingShown = true;
      controllerRef.current?.setSpeed(0);
      runtimePaused = true;
      await flushPendingSave(true, false);
      await metaSaveQueueRef.current;
      runtimeGenerationRef.current += 1;
      callbacksInvalidated = true;
      window.clearTimeout(saveTimerRef.current);
      pendingSaveRef.current = undefined;
      const imported = await importProgressBundle(source, validators);
      committedImport = imported;
      const replacedController = controllerRef.current;
      controllerRef.current = undefined;
      replacedController?.destroy();
      const [loadedMeta, slotEntries] = await Promise.all([
        loadMetaProgression(),
        Promise.all(
          SCENARIOS.map(async (scenario) => [
            scenario.id,
            (await loadScopedGameCandidates(
              scenarioGameScope(scenario.id),
            )).length > 0,
          ] as const),
        ),
      ]);
      metaProgressionRef.current = loadedMeta;
      setMetaProgression(loadedMeta);
      setScenarioHasSave(Object.fromEntries(slotEntries));
      activeScopeRef.current = MAIN_GAME_SCOPE;
      setActiveScope(MAIN_GAME_SCOPE);
      pendingSaveRef.current = undefined;
      pendingSaveScopeRef.current = MAIN_GAME_SCOPE;
      lastMasteryDebriefRef.current = undefined;
      recordedScenarioResultRef.current = undefined;
      await savePreference(ACTIVE_SCOPE_PREFERENCE, MAIN_GAME_SCOPE);
      await installRuntime(
        MAIN_GAME_SCOPE,
        [imported.main],
        settings,
        false,
      );
      announce({
        kind: "success",
        message: "Progress bundle imported and semantically checked.",
        importance: "important",
      });
    } catch (error) {
      if (committedImport) {
        const committed = committedImport;
        try {
          const recoveredMeta = await loadMetaProgression().catch(
            () => committed.metaProgression,
          );
          const recoveredSlots = await Promise.all(
            SCENARIOS.map(async (scenario) => [
              scenario.id,
              await loadScopedGameCandidates(
                scenarioGameScope(scenario.id),
              ).then(
                (candidates) => candidates.length > 0,
                () => Object.hasOwn(committed.scenarios, scenario.id),
              ),
            ] as const),
          );
          metaProgressionRef.current = recoveredMeta;
          setMetaProgression(recoveredMeta);
          setScenarioHasSave(Object.fromEntries(recoveredSlots));
          activeScopeRef.current = MAIN_GAME_SCOPE;
          setActiveScope(MAIN_GAME_SCOPE);
          pendingSaveRef.current = undefined;
          pendingSaveScopeRef.current = MAIN_GAME_SCOPE;
          lastMasteryDebriefRef.current = undefined;
          recordedScenarioResultRef.current = undefined;
          await savePreference(
            ACTIVE_SCOPE_PREFERENCE,
            MAIN_GAME_SCOPE,
          ).catch(() =>
            reportStorageIssue(
              "The imported active-save preference could not be saved.",
            ),
          );
          await installRuntime(
            MAIN_GAME_SCOPE,
            [committed.main],
            settings,
            false,
          );
          announce({
            kind: "warning",
            importance: "important",
            message:
              "Progress was imported. A later setup step failed, so the committed imported centre was recovered.",
          });
        } catch (recoveryError) {
          setLoadingError(
            "Progress was imported and replaced the previous local progress, but its main centre could not start. Reload to open the committed import.",
          );
          announce({
            kind: "error",
            importance: "important",
            message: recoveryError instanceof Error
              ? `Progress was imported, but recovery failed: ${recoveryError.message}`
              : "Progress was imported, but the imported centre must be reloaded.",
          });
        }
      } else {
        try {
          if (callbacksInvalidated) {
            activeScopeRef.current = previousScope;
            setActiveScope(previousScope);
            pendingSaveScopeRef.current = previousScope;
            await installRuntime(
              previousScope,
              await loadScopedGameCandidates(previousScope),
              settings,
              false,
            );
          } else if (runtimePaused) {
            controllerRef.current?.setSpeed(previousSpeed);
          }
        } catch {
          setLoadingError(
            "The import did not replace local progress, but the current save must be reloaded.",
          );
        }
        announce({
          kind: "error",
          message: error instanceof Error ? error.message : "Could not import that save.",
        });
      }
    } finally {
      if (loadingShown) setLoading(false);
      finishLocalDataOperation();
    }
  }

  async function confirmReset() {
    if (!beginLocalDataOperation()) return;
    const previousSpeed = snapshot.speed;
    let resetCommitted = false;
    setLoading(true);
    try {
      controllerRef.current?.setSpeed(0);
      await flushPendingSave(true, false);
      await metaSaveQueueRef.current;
      const resetMeta = resetMetaForFreshMain(metaProgressionRef.current);
      await resetMainProgress(resetMeta);
      resetCommitted = true;
      runtimeGenerationRef.current += 1;
      const replacedController = controllerRef.current;
      controllerRef.current = undefined;
      replacedController?.destroy();
      metaProgressionRef.current = resetMeta;
      setMetaProgression(resetMeta);
      pendingSaveRef.current = undefined;
      pendingSaveScopeRef.current = MAIN_GAME_SCOPE;
      activeScopeRef.current = MAIN_GAME_SCOPE;
      setActiveScope(MAIN_GAME_SCOPE);
      mainLevelRef.current = INITIAL_LEVEL;
      setMainLevel(INITIAL_LEVEL);
      lastMasteryDebriefRef.current = undefined;
      recordedScenarioResultRef.current = undefined;
      await savePreference(ACTIVE_SCOPE_PREFERENCE, MAIN_GAME_SCOPE).catch(
        () => reportStorageIssue("The fresh main-centre scope could not be saved."),
      );
      setTutorialStep(0);
      setNutritionTourStep(0);
      setGuidedPredictionId(undefined);
      await savePreference("tutorial-complete", false).catch(() =>
        reportStorageIssue("Tutorial progress could not be reset."),
      );
      await savePreference("nutrition-tour-v1-complete", false).catch(() =>
        reportStorageIssue("Nutrition tour progress could not be reset."),
      );
      await savePreference("forecast-guide-v1-complete", false).catch(() =>
        reportStorageIssue("What’s new guide progress could not be reset."),
      );
      await installRuntime(MAIN_GAME_SCOPE, [], settings, false);
      const freshState = latestRuntimeSavePayload(
        controllerRef.current,
        undefined,
      );
      if (freshState === undefined) {
        throw new Error("The fresh main centre did not start");
      }
      await performSave(freshState, MAIN_GAME_SCOPE);
      setResetOpen(false);
      announce({
        kind: "info",
        message:
          "A fresh main centre is ready. Scenario saves and earned gallery rewards were preserved; the active mastery contract ended.",
      });
    } catch (error) {
      if (resetCommitted) {
        try {
          activeScopeRef.current = MAIN_GAME_SCOPE;
          setActiveScope(MAIN_GAME_SCOPE);
          pendingSaveRef.current = undefined;
          pendingSaveScopeRef.current = MAIN_GAME_SCOPE;
          await installRuntime(MAIN_GAME_SCOPE, [], settings, false);
          const recoveredFreshState = controllerRef.current?.exportState();
          if (recoveredFreshState !== undefined) {
            await performSave(
              recoveredFreshState,
              MAIN_GAME_SCOPE,
            ).catch(() => undefined);
          }
          setResetOpen(false);
          announce({
            kind: "warning",
            importance: "important",
            message:
              "The main reset was committed. A later setup step failed, so the fresh centre was recovered without restoring the old mastery contract.",
          });
        } catch (recoveryError) {
          setResetOpen(false);
          setLoadingError(
            "The main reset was committed, but a fresh centre could not start. Reload to create the reset centre.",
          );
          announce({
            kind: "error",
            importance: "important",
            message: recoveryError instanceof Error
              ? `The main reset was committed, but recovery failed: ${recoveryError.message}`
              : "The main reset was committed, but the fresh centre must be reloaded.",
          });
        }
      } else {
        controllerRef.current?.setSpeed(previousSpeed);
        announce({
          kind: "error",
          message: error instanceof Error
            ? `The main centre was not reset: ${error.message}`
            : "The main centre was not reset.",
        });
      }
    } finally {
      setLoading(false);
      finishLocalDataOperation();
    }
  }

  async function confirmEraseAll() {
    if (!beginLocalDataOperation()) return;
    const previousScope = activeScopeRef.current;
    let eraseCommitted = false;
    window.clearTimeout(saveTimerRef.current);
    controllerRef.current?.setSpeed(0);
    pendingSaveRef.current = undefined;
    setLoading(true);
    await saveQueueRef.current.catch(() => undefined);
    await metaSaveQueueRef.current.catch(() => false);
    runtimeGenerationRef.current += 1;
    try {
      await eraseAllProgress();
      eraseCommitted = true;
      const replacedController = controllerRef.current;
      controllerRef.current = undefined;
      replacedController?.destroy();
      const emptyMeta = createEmptyMetaProgression();
      metaProgressionRef.current = emptyMeta;
      setMetaProgression(emptyMeta);
      setScenarioHasSave({});
      setTutorialStep(0);
      setNutritionTourStep(0);
      setGuidedPredictionId(undefined);
      activeScopeRef.current = MAIN_GAME_SCOPE;
      setActiveScope(MAIN_GAME_SCOPE);
      mainLevelRef.current = INITIAL_LEVEL;
      setMainLevel(INITIAL_LEVEL);
      lastMasteryDebriefRef.current = undefined;
      recordedScenarioResultRef.current = undefined;
      await Promise.all([
        savePreference(ACTIVE_SCOPE_PREFERENCE, MAIN_GAME_SCOPE),
        savePreference(MAIN_LEVEL_PREFERENCE, INITIAL_LEVEL),
      ]);
      await installRuntime(MAIN_GAME_SCOPE, [], settings, false);
      const freshState = latestRuntimeSavePayload(
        controllerRef.current,
        undefined,
      );
      if (freshState !== undefined) {
        await performSave(freshState, MAIN_GAME_SCOPE);
      }
      setEraseAllOpen(false);
      setResetOpen(false);
      setSettingsOpen(false);
      announce({
        kind: "info",
        importance: "important",
        message: "All local game progress was erased. A new centre is ready.",
      });
    } catch (error) {
      if (eraseCommitted) {
        const emptyMeta = createEmptyMetaProgression();
        metaProgressionRef.current = emptyMeta;
        setMetaProgression(emptyMeta);
        setScenarioHasSave({});
        setTutorialStep(0);
        setNutritionTourStep(0);
        setGuidedPredictionId(undefined);
        activeScopeRef.current = MAIN_GAME_SCOPE;
        setActiveScope(MAIN_GAME_SCOPE);
        pendingSaveRef.current = undefined;
        pendingSaveScopeRef.current = MAIN_GAME_SCOPE;
        mainLevelRef.current = INITIAL_LEVEL;
        setMainLevel(INITIAL_LEVEL);
        lastMasteryDebriefRef.current = undefined;
        recordedScenarioResultRef.current = undefined;
        try {
          await Promise.all([
            savePreference(ACTIVE_SCOPE_PREFERENCE, MAIN_GAME_SCOPE),
            savePreference(MAIN_LEVEL_PREFERENCE, INITIAL_LEVEL),
          ]).catch(() =>
            reportStorageIssue(
              "Fresh-centre preferences could not be saved after erasing progress.",
            ),
          );
          await installRuntime(MAIN_GAME_SCOPE, [], settings, false);
          const recoveredFreshState = controllerRef.current?.exportState();
          if (recoveredFreshState !== undefined) {
            await performSave(
              recoveredFreshState,
              MAIN_GAME_SCOPE,
            ).catch(() => undefined);
          }
          setEraseAllOpen(false);
          setResetOpen(false);
          setSettingsOpen(false);
          announce({
            kind: "warning",
            importance: "important",
            message:
              "All previous progress was erased. A later setup step failed, so a fresh empty centre was recovered.",
          });
        } catch (recoveryError) {
          setEraseAllOpen(false);
          setResetOpen(false);
          setSettingsOpen(false);
          setLoadingError(
            "All previous progress was erased, but a fresh centre could not start. Reload to create a new empty centre.",
          );
          announce({
            kind: "error",
            importance: "important",
            message: recoveryError instanceof Error
              ? `Progress was erased, but fresh-centre recovery failed: ${recoveryError.message}`
              : "Progress was erased, but a fresh centre must be created after reload.",
          });
        }
      } else {
        try {
          activeScopeRef.current = previousScope;
          setActiveScope(previousScope);
          pendingSaveScopeRef.current = previousScope;
          await installRuntime(
            previousScope,
            await loadScopedGameCandidates(previousScope),
            settings,
            false,
          );
        } catch {
          setLoadingError(
            "Erase all did not commit, but the current save must be reloaded.",
          );
        }
        announce({
          kind: "error",
          message: error instanceof Error
            ? error.message
            : "All progress could not be erased.",
        });
      }
    } finally {
      finishLocalDataOperation();
      setLoading(false);
    }
  }

  const tutorialCopy = TUTORIAL_COPY[Math.min(tutorialStep, 4)]!;
  const nutritionFamilies: readonly NutritionFamilyView[] = snapshot.nutritionFamilies;
  const nutritionPulse: NutritionPulseView = snapshot.nutritionPulse ?? EMPTY_NUTRITION_PULSE;
  const selectedCustomerNutrition = snapshot.selectedCustomerNutrition;
  const periodForecast = snapshot.forecast;
  const guidedDecision = useMemo(
    () => buildGuidedDecision(snapshot, periodForecast, nutritionFamilies),
    [nutritionFamilies, periodForecast, snapshot],
  );
  const guidedSelectedOption = guidedDecision?.options.find(
    (option) => option.responseId === guidedPredictionId,
  );
  const guidedOtherOption = guidedDecision?.options.find(
    (option) => option.responseId !== guidedPredictionId,
  );
  const guidedResult = guidedSelectedOption && guidedOtherOption && guidedDecision
    ? guidedRevealCopy(guidedSelectedOption, guidedOtherOption, guidedDecision.needLabel)
    : undefined;
  const overlayManagement = compactManagement || settings.textScale >= 1.75;
  const managementSheetOpen = overlayManagement && (
    managementOpen || Boolean(selectedCustomerNutrition)
  );
  const variantLabFamily = variantLabDishId
    ? nutritionFamilies.find((family) => family.dishId === variantLabDishId)
    : undefined;
  const interfaceInert =
    localDataBusy ||
    tutorialStep < 5 ||
    (nutritionTourStep < 2 && Boolean(guidedDecision)) ||
    settingsOpen ||
    helpOpen ||
    resetOpen ||
    eraseAllOpen ||
    snapshot.servicePeriod.phase === "debrief" ||
    eventDecisionOpen ||
    Boolean(variantLabFamily);
  const managementBackgroundInert = interfaceInert || managementSheetOpen;
  const visiblePanelSelection = panelSelectionIsVisible(
    overlayManagement,
    managementSheetOpen,
  );

  useEffect(() => {
    if (!managementSheetOpen) return;
    const sheet = cataloguePanelRef.current;
    if (!sheet) return;
    if (!managementReturnFocusRef.current) {
      managementReturnFocusRef.current = document.activeElement as HTMLElement | null;
    }
    managementFocusRestoreRequestedRef.current = false;
    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[href]",
      "summary",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusables = () =>
      Array.from(sheet.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
      );
    const initialFocusFrame = window.requestAnimationFrame(() => {
      const inspectorClose = sheet.querySelector<HTMLElement>(
        ".customer-nutrition-inspector button",
      );
      (inspectorClose ?? focusables()[0] ?? sheet).focus();
    });
    const handleSheetKeys = (event: KeyboardEvent) => {
      const activeModal = (document.activeElement as HTMLElement | null)?.closest(
        "[aria-modal='true']",
      );
      if (activeModal && activeModal !== sheet) return;
      const available = focusables();
      const first = available[0];
      const last = available.at(-1);
      const activeElement = document.activeElement;
      const action = dialogFocusAction(
        event.key,
        event.shiftKey,
        available.length,
        activeElement === first || !sheet.contains(activeElement),
        activeElement === last || !sheet.contains(activeElement),
      );
      if (action === "close") {
        event.preventDefault();
        closeManagementSheet();
      } else if (action === "container") {
        event.preventDefault();
        sheet.focus();
      } else if (action === "last") {
        event.preventDefault();
        last?.focus();
      } else if (action === "first") {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleSheetKeys);
    return () => {
      window.cancelAnimationFrame(initialFocusFrame);
      document.removeEventListener("keydown", handleSheetKeys);
      const focusWasInsideSheet = sheet.contains(document.activeElement);
      const closeRequested = managementFocusRestoreRequestedRef.current;
      const returnFocus = managementReturnFocusRef.current;
      managementReturnFocusRef.current = null;
      managementFocusRestoreRequestedRef.current = false;
      const anotherModalOpen = Array.from(
        document.querySelectorAll<HTMLElement>("[aria-modal='true']"),
      ).some((dialog) => dialog !== sheet);
      if (shouldRestoreManagementFocus(
        closeRequested,
        focusWasInsideSheet,
        Boolean(returnFocus?.isConnected),
        anotherModalOpen,
      )) {
        window.requestAnimationFrame(() => {
          const modalNowOpen = Array.from(
            document.querySelectorAll<HTMLElement>("[aria-modal='true']"),
          ).some((dialog) => dialog !== sheet);
          if (returnFocus?.isConnected && !modalNowOpen) returnFocus.focus();
        });
      }
    };
  }, [managementSheetOpen]);
  const unlockedCustomerCount = CUSTOMER_ARCHETYPES.filter(
    (customer) =>
      customer.unlockRequirement.level <= snapshot.level &&
      customer.unlockRequirement.reputation <= snapshot.reputation &&
      customer.unlockRequirement.prerequisiteIds.every((id) =>
        snapshot.unlockedContentIds.includes(id),
      ),
  ).length;
  const scenarioProgress = buildScenarioProgress(
    scenarioHasSave,
    metaProgression,
  );
  const derivedMasteryPanel = buildMasteryPanelView(
    {
      ...snapshot,
      level: mainLevel,
    },
    masteryProgressionFromMeta(metaProgression),
    metaProgression,
  );
  const masteryPanel = activeScope.kind === "scenario" &&
      derivedMasteryPanel.kind !== "active"
    ? {
          kind: "unavailable" as const,
          explanation:
            "Return to the main centre during breakfast planning to choose or skip a mastery contract.",
        }
    : snapshot.servicePeriod.phase !== "planning" &&
        derivedMasteryPanel.kind === "offer"
      ? {
          kind: "unavailable" as const,
          explanation:
            "Choices can only be accepted during breakfast planning. Finish this service and return during a future breakfast.",
        }
      : derivedMasteryPanel;
  const activeScenarioDefinition = activeScope.kind === "scenario"
    ? SCENARIOS.find((scenario) => scenario.id === activeScope.scenarioId)
    : undefined;
  const activeScenarioView =
    activeScope.kind === "scenario" && activeScenarioDefinition
      ? {
          scenarioId: activeScope.scenarioId,
          cashCents: snapshot.cashCents,
          periodLabel:
            `${snapshot.servicePeriod.label} · ${snapshot.servicePeriod.phase}`,
          scoreLabel:
            snapshot.servicePeriod.phase === "planning"
              ? "Scoring starts with service"
              : snapshot.scenario
                ? scenarioScoreLabel(
                    snapshot.scenario.score,
                    snapshot.scenario.scoreUnit,
                  )
                : "Scoring starts with service",
          objectiveLabel:
            `Bronze begins at ${scenarioScoreLabel(
              activeScenarioDefinition.medalThresholds.bronze,
              activeScenarioDefinition.scoreUnit,
            )}.`,
          ...(snapshot.scenario?.medal
            ? { projectedMedal: snapshot.scenario.medal }
            : {}),
          saveStatusLabel: snapshot.autosaveState === "saving"
            ? "Saving scenario…"
            : snapshot.autosaveState === "error"
              ? "Scenario save needs attention"
              : "Scenario saved on this device",
        }
      : undefined;

  return (
    <main
      className="game-shell"
      aria-busy={loading || localDataBusy}
      data-contrast={settings.highContrast ? "high" : "normal"}
      data-motion={settings.reducedMotion ? "reduced" : "full"}
      data-text-scale={
        settings.textScale >= 1.75
          ? "large"
          : settings.textScale >= 1.35
            ? "medium"
            : "normal"
      }
      data-service-phase={snapshot.servicePeriod.phase}
      data-management-open={managementOpen || Boolean(selectedCustomerNutrition)}
      onPointerDown={unlockAudio}
    >
      <header
        className="topbar"
        inert={managementBackgroundInert}
        aria-hidden={managementBackgroundInert}
      >
        <div className="brand-lockup" aria-label="Hawker Balance">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <p>Nutrition edition</p>
            <h1>Hawker Balance</h1>
            <span className="brand-tagline">Run the centre. Read the plate.</span>
          </div>
        </div>

        <dl className="hud-stats" aria-label="Centre status">
          <div>
            <dt>{activeScenarioDefinition ? "Scenario cash" : "Cash"}</dt>
            <dd data-testid="cash-value"><SgdAmount cents={snapshot.cashCents} /></dd>
          </div>
          <div>
            <dt>Reputation</dt>
            <dd>
              <span aria-hidden="true">♥</span> {Math.round(snapshot.reputation)}
            </dd>
          </div>
          <div className="level-stat">
            <dt>
              {activeScenarioDefinition
                ? `Main level ${mainLevel}`
                : `Level ${snapshot.level}`}
            </dt>
            <dd>
              {activeScenarioDefinition ? (
                <>
                  <strong aria-hidden="true">ISOLATED</strong>
                  <span className="sr-only">
                    Scenario play does not change main-centre experience
                  </span>
                </>
              ) : snapshot.nextLevelExperience === null ? (
                <>
                  <strong aria-hidden="true">MAX</strong>
                  <span className="sr-only">Maximum authored level reached</span>
                </>
              ) : (
                <>
                  <span className="progress-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.min(100, (snapshot.experience / Math.max(1, snapshot.nextLevelExperience)) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="sr-only">
                    {snapshot.experience} of {snapshot.nextLevelExperience} experience
                  </span>
                </>
              )}
            </dd>
          </div>
        </dl>

        <div className="day-controls">
          <div className="clock-card">
            <span>
              {activeScenarioDefinition
                ? `${activeScenarioDefinition.name} scenario · ${snapshot.servicePeriod.label}`
                : `Day ${snapshot.servicePeriod.day} · ${snapshot.servicePeriod.label}`}
            </span>
            <strong>{snapshot.servicePeriod.clockLabel}</strong>
            <small>{SERVICE_PHASE_LABELS[snapshot.servicePeriod.phase]}</small>
          </div>
          <div className="speed-group" aria-label="Simulation speed">
            {([0, 1, 2, 4, 10] as const).map((speed) => (
              <button
                type="button"
                key={speed}
                className={snapshot.speed === speed ? "is-active" : ""}
                aria-pressed={snapshot.speed === speed}
                aria-label={speed === 0 ? "Pause" : `${speed} times speed`}
                onClick={() => setGameSpeed(speed)}
              >
                {speed === 0 ? "Ⅱ" : `${speed}×`}
              </button>
            ))}
          </div>
          <select
            className="speed-select"
            aria-label="Simulation speed"
            value={snapshot.speed}
            onChange={(event) => setGameSpeed(Number(event.target.value) as GameSpeed)}
          >
            {([0, 1, 2, 4, 10] as const).map((speed) => (
              <option key={speed} value={speed}>
                {speed === 0 ? "Pause" : `${speed}× speed`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button"
            aria-label="Open settings and icon guide"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Open help"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
        </div>
      </header>

      <section className="play-layout">
        <aside
          className="left-rail"
          aria-label="Objectives and centre pulse"
          inert={managementBackgroundInert}
          aria-hidden={managementBackgroundInert}
        >
          {periodForecast ? (
            <ForecastCard
              forecast={periodForecast}
              periodLabel={snapshot.servicePeriod.label}
              neighbourhoodEvent={snapshot.neighbourhoodEvent}
              compact
              canOpenGuide={Boolean(guidedDecision) && snapshot.servicePeriod.phase === "planning"}
              onOpenGuide={openGuidedDecision}
            />
          ) : null}
          <ObjectiveBoard
            objectives={snapshot.objectives}
            refreshLabel={snapshot.objectiveRefreshLabel}
            onAccept={acceptObjective}
            onSkip={skipObjective}
          />

          <PeriodLedgerCard ledger={snapshot.periodLedger} compact />

          <NutritionPulseCard
            compact
            pulse={nutritionPulse}
            dishLabel={dishLabel}
            onReview={() => openPanel("dishes")}
          />

          <section className="tip-card">
            <span aria-hidden="true">✦</span>
            <div>
              <strong>Layout tip</strong>
              <p>Leave two tiles before popular stall queues to reduce crowd knots.</p>
            </div>
          </section>
        </aside>

        <section
          className="world-column"
          aria-label="Hawker centre map"
          inert={managementBackgroundInert}
          aria-hidden={managementBackgroundInert}
        >
          <div className="world-toolbar">
            <div className="mode-pill">
              <span className={snapshot.buildTool === "place" || snapshot.buildTool === "queue" || snapshot.buildTool === "access" || snapshot.buildTool === "route" ? "amber-dot" : "green-dot"} />
              {snapshot.buildTool === "place"
                ? "Build mode"
                : snapshot.buildTool === "queue"
                  ? "Queue editor"
                  : snapshot.buildTool === "access"
                    ? "Access editor"
                    : snapshot.buildTool === "route"
                      ? "Route editor"
                      : SERVICE_PHASE_LABELS[snapshot.servicePeriod.phase]}
            </div>
            <div className="period-hud" data-phase={snapshot.servicePeriod.phase}>
              <div>
                <span>Day {snapshot.servicePeriod.day} · {snapshot.servicePeriod.label}</span>
                <strong>{snapshot.servicePeriod.clockLabel}</strong>
                <em>{SERVICE_PHASE_LABELS[snapshot.servicePeriod.phase]}</em>
                {snapshot.servicePeriod.phase === "arrivals" ? (
                  <small>{formatCountdown(snapshot.servicePeriod.arrivalRemainingMs)} arrivals</small>
                ) : snapshot.servicePeriod.phase === "draining" ? (
                  <small>{formatCountdown(snapshot.servicePeriod.drainRemainingMs)} watchdog</small>
                ) : null}
              </div>
              <span className="world-message">
                {configurationLocked
                  ? `${snapshot.activeCustomers} period guests remain · configuration reopens after the debrief`
                  : snapshot.buildTool === "queue"
                    ? "Queue editor: choose adjacent clear tiles to bend the line; Escape finishes"
                    : snapshot.buildTool === "access"
                      ? "Access editor: choose an entry or exit, then choose a boundary tile"
                    : snapshot.buildTool === "route"
                      ? "Route editor: choose clear floor tiles to guide guests; choose a guide again to remove it; Escape finishes"
                      : selectedContent
                        ? `${localize(selectedContent.nameKey)} selected — choose a clear tile`
                        : "Arrange the centre and menu during planning, then start the period"}
              </span>
            </div>
            <div
              className="tool-segment"
              role="group"
              aria-label="Build tools"
              aria-describedby="build-tools-overflow-hint"
              onFocusCapture={(event) => {
                if (event.target instanceof HTMLElement) {
                  revealScrollableControl(event.target, settings.reducedMotion);
                }
              }}
            >
              <span id="build-tools-overflow-hint" className="sr-only">
                At smaller text sizes, scroll horizontally to reach every build tool.
              </span>
              {(["select", "move", "remove"] as const).map((tool) => (
                <button
                  type="button"
                  key={tool}
                  aria-pressed={snapshot.buildTool === tool}
                  className={snapshot.buildTool === tool ? "is-active" : ""}
                  disabled={configurationLocked && tool !== "select"}
                  onClick={() => chooseTool(tool)}
                >
                  {tool === "select" ? "Select" : tool === "move" ? "Move" : "Remove"}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={snapshot.buildTool === "access"}
                className={snapshot.buildTool === "access" ? "is-active" : ""}
                disabled={configurationLocked}
                onClick={() => chooseTool(snapshot.buildTool === "access" ? "select" : "access")}
              >
                {snapshot.buildTool === "access" ? "Finish access" : "Access"}
              </button>
              <button
                type="button"
                aria-pressed={snapshot.buildTool === "route"}
                className={snapshot.buildTool === "route" ? "is-active" : ""}
                disabled={configurationLocked}
                onClick={chooseRouteTool}
              >
                {snapshot.buildTool === "route" ? "Finish route" : "Route"}
              </button>
              {snapshot.buildTool === "access" ? (
                <>
                  <button type="button" disabled={configurationLocked} onClick={() => controllerRef.current?.addAccessPoint("entrance")}>+ Entry</button>
                  <button type="button" disabled={configurationLocked} onClick={() => controllerRef.current?.addAccessPoint("exit")}>+ Exit</button>
                  <button type="button" disabled={configurationLocked || !snapshot.selectedAccessPointId} onClick={() => controllerRef.current?.removeSelectedAccessPoint()}>Remove access</button>
                </>
              ) : null}
              {snapshot.selectedObjectId && snapshot.selectedObjectDefinitionId?.startsWith("stall.") ? (
                <button
                  type="button"
                  aria-pressed={snapshot.buildTool === "queue"}
                  className={snapshot.buildTool === "queue" ? "is-active" : ""}
                  disabled={configurationLocked}
                  onClick={() => {
                    if (snapshot.buildTool === "queue") controllerRef.current?.finishQueueEdit();
                    else controllerRef.current?.beginQueueEdit(snapshot.selectedObjectId as string);
                  }}
                >
                  {snapshot.buildTool === "queue" ? "Finish queue" : "Edit queue"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="world-frame">
            <div
              ref={gameHostRef}
              className="game-host"
              data-testid="game-world"
              role="application"
              inert={snapshot.servicePeriod.phase === "debrief"}
              aria-hidden={snapshot.servicePeriod.phase === "debrief" || undefined}
              aria-label={snapshot.buildTool === "route"
                ? "Guest route editor. Use arrow keys to move the route cursor, Enter to add or remove a preferred route guide, and Escape to finish."
                : "Interactive hawker centre. Use arrow keys to move the cursor. Enter selects a guest or places the current item, R rotates, and Escape clears the selection."}
              tabIndex={0}
            >
              {loading ? (
                <div className="loading-centre" role="status">
                  <span className="loading-bowl" aria-hidden="true" />
                  <strong>Setting the tables…</strong>
                  <small>Preparing the local simulation</small>
                </div>
              ) : null}
              {loadingError ? (
                <div className="loading-centre error-card" role="alert">
                  <strong>The shutters could not open</strong>
                  <small>{loadingError}</small>
                  <button type="button" onClick={() => location.reload()}>
                    Reload game
                  </button>
                </div>
              ) : null}
            </div>

            <div className="camera-controls" aria-label="Camera controls">
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => controllerRef.current?.zoomBy(0.15)}
              >
                +
              </button>
              <button
                type="button"
                aria-label="Centre camera"
                onClick={() => controllerRef.current?.centreCamera()}
              >
                ◎
              </button>
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => controllerRef.current?.zoomBy(-0.15)}
              >
                −
              </button>
            </div>

            <div className="map-legend" aria-label="Map legend">
              <span><i className="legend-preferred-route" /> Preferred route guide</span>
              <span><i className="legend-predicted-route" /> Predicted guest path</span>
              <span><i className="legend-queue" /> Queue</span>
              <span><i className="legend-seat" /> Reserved seat</span>
            </div>
          </div>

          <div className="action-strip">
            <div className="service-save-state" role="status">
              <div className="save-state">
                <span className={snapshot.autosaveState === "error" ? "error-dot" : "green-dot"} />
                {snapshot.autosaveState === "saving"
                  ? "Saving…"
                  : snapshot.autosaveState === "error"
                    ? "Save needs attention"
                    : "Saved on this device"}
              </div>
              {configurationLocked ? <small>Planning changes locked during service</small> : null}
            </div>
            <div className="edit-actions">
              {snapshot.buildTool === "route" ? (
                <>
                  <button
                    type="button"
                    disabled={configurationLocked || !snapshot.canUndo}
                    onClick={() => controllerRef.current?.undo()}
                  >
                    ↶ Undo
                  </button>
                  <button
                    type="button"
                    disabled={configurationLocked || snapshot.routeGuidePoints.length === 0}
                    onClick={() => controllerRef.current?.clearGuestRoute()}
                  >
                    Clear route
                  </button>
                  <button type="button" disabled={configurationLocked} onClick={() => chooseTool("select")}>
                    Finish <kbd>Esc</kbd>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={configurationLocked || !snapshot.canUndo}
                    onClick={() => controllerRef.current?.undo()}
                  >
                    ↶ Undo
                  </button>
                  <button type="button" disabled={configurationLocked} onClick={() => controllerRef.current?.rotateSelection()}>
                    ↻ Rotate <kbd>R</kbd>
                  </button>
                  <button type="button" disabled={configurationLocked} onClick={() => chooseTool("select")}>
                    Cancel <kbd>Esc</kbd>
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              className={`centre-toggle phase-${snapshot.servicePeriod.phase}`}
              data-testid="toggle-centre"
              disabled={!snapshot.servicePeriod.canAdvance}
              aria-label={`${snapshot.servicePeriod.actionLabel} for ${snapshot.servicePeriod.label}`}
              onClick={toggleCentre}
            >
              <span aria-hidden="true">
                {snapshot.servicePeriod.phase === "planning"
                  ? "▶"
                  : snapshot.servicePeriod.phase === "arrivals"
                    ? "◷"
                    : snapshot.servicePeriod.phase === "draining"
                      ? "…"
                      : "→"}
              </span>
              {snapshot.servicePeriod.actionLabel}
            </button>
          </div>
        </section>

        <aside
          id="management-panel"
          ref={cataloguePanelRef}
          className="catalogue-panel"
          aria-label={`${PANEL_COPY[panel].title} panel`}
          aria-modal={managementSheetOpen || undefined}
          aria-hidden={interfaceInert}
          role={managementSheetOpen ? "dialog" : undefined}
          tabIndex={managementSheetOpen ? -1 : undefined}
          inert={interfaceInert}
        >
          <div className="catalogue-heading">
            <div>
              <span>{PANEL_COPY[panel].kicker}</span>
              <h2>{PANEL_COPY[panel].title}</h2>
            </div>
            <span className="count-badge">
              {panel === "stalls"
                ? STALLS.length
                : panel === "dishes"
                  ? DISHES.length
                : panel === "focus"
                    ? snapshot.objectives.length
                  : panel === "challenges"
                    ? SCENARIOS.length
                  : panel === "insights"
                    ? snapshot.activeCustomers
                    : panel === "activity"
                      ? activityEntries.length
                      : PLACEABLES.length}
            </span>
            <button
              type="button"
              className="sheet-close-button"
              aria-label="Close management sheet"
              onClick={closeManagementSheet}
            >
              ×
            </button>
          </div>

          {managementSheetOpen ? (
            <nav className="management-sheet-tabs" aria-label="Management sections">
              {MANAGEMENT_SECTIONS.map(({ value, label }) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={panel === value}
                  className={panel === value ? "is-active" : ""}
                  onClick={() => openPanel(value)}
                >
                  {label}
                  {value === "activity" && activityUnread > 0
                    ? ` (${activityUnread} unread)`
                    : ""}
                </button>
              ))}
            </nav>
          ) : null}

          {panel === "focus" ? (
            <div className="focus-panel">
              {periodForecast ? (
                <ForecastCard
                  forecast={periodForecast}
                  periodLabel={snapshot.servicePeriod.label}
                  neighbourhoodEvent={snapshot.neighbourhoodEvent}
                  canOpenGuide={Boolean(guidedDecision) && snapshot.servicePeriod.phase === "planning"}
                  onOpenGuide={openGuidedDecision}
                />
              ) : null}
              <ObjectiveBoard
                objectives={snapshot.objectives}
                refreshLabel={snapshot.objectiveRefreshLabel}
                onAccept={acceptObjective}
                onSkip={skipObjective}
              />
              <PeriodLedgerCard ledger={snapshot.periodLedger} />
              <PartyServiceCard parties={snapshot.activeParties ?? []} />
              <NutritionPulseCard
                pulse={nutritionPulse}
                dishLabel={dishLabel}
                onReview={() => openPanel("dishes")}
              />
              <section className="service-pulse-card" aria-label="Service pulse">
                <h3>Service pulse</h3>
                <dl>
                  <div><dt>Guests inside</dt><dd>{snapshot.activeCustomers}</dd></div>
                  <div><dt>Free seats</dt><dd>{snapshot.freeSeats}/{snapshot.totalSeats}</dd></div>
                  <div><dt>Happiness</dt><dd>{snapshot.hasSatisfactionRatings ? `${Math.round(snapshot.averageSatisfaction)}%` : "—"}</dd></div>
                  <div><dt>Cleanliness</dt><dd>{Math.round(snapshot.cleanliness)}%</dd></div>
                </dl>
              </section>
              <NutritionDisclosure />
            </div>
          ) : null}

          {panel === "build" ? (
            <>
              {configurationLocked ? (
                <p className="configuration-lock-notice" role="status">
                  Service is underway. You can inspect the catalogue now; placement, movement, removal, routes, and purchases reopen in planning.
                </p>
              ) : null}
              <label className="search-field">
                <span className="sr-only">Search catalogue</span>
                <span aria-hidden="true">⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tables, fans, plants…"
                />
              </label>
              <div className="category-scroller" aria-label="Catalogue categories">
                {buildCategories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={buildCategory === category ? "is-active" : ""}
                    aria-pressed={buildCategory === category}
                    onClick={() => setBuildCategory(category)}
                  >
                    {category === "all" ? "All" : category.replace("-", " ")}
                  </button>
                ))}
              </div>
              <div className="catalogue-grid" data-testid="build-catalogue">
                {visiblePlaceables.map((item) => {
                  const locked = !snapshot.unlockedContentIds.includes(item.id);
                  const selected = selectedId === item.id;
                  const preview = placeablePreview(item);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`catalogue-item ${selected ? "is-selected" : ""}`}
                      aria-pressed={selected}
                      disabled={configurationLocked}
                      aria-label={`${localize(item.nameKey)}, ${describeSgd(legacySgdCents(item.price))}${locked ? `, locked: ${unlockLabel(item, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds)}` : configurationLocked ? ", configuration locked during service" : ""}`}
                      onClick={() => selectBuildItem(item)}
                    >
                      <span
                        className={`item-art item-${item.category}`}
                        data-motif={preview.recipe.motif}
                        data-form={preview.recipe.form}
                        data-material={preview.recipe.material}
                        style={preview.style}
                        aria-hidden="true"
                      >
                        <span>{catalogueIcon(item.category)}</span>
                      </span>
                      <strong>{localize(item.nameKey)}</strong>
                      <small>
                        {locked
                          ? unlockLabel(item, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds)
                          : <><SgdAmount cents={legacySgdCents(item.price)} /> · {primaryUtility(item)}</>}
                      </small>
                      {locked ? <i aria-hidden="true">●</i> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {panel === "stalls" ? (
            <div className="stall-list" data-testid="stall-catalogue">
              {configurationLocked ? (
                <p className="configuration-lock-notice" role="status">
                  Stall placement, queue routes, and upgrades reopen after the period debrief. Stall details remain available for inspection.
                </p>
              ) : null}
              {snapshot.placedStalls.length > 0 ? (
                <section className="operating-stalls" aria-labelledby="operating-stalls-title">
                  <h3 id="operating-stalls-title">Operating queue plans</h3>
                  {snapshot.placedStalls.map((placed) => (
                    <article key={placed.objectId} className="queue-manager-row">
                      <div>
                        <strong>{placed.name}</strong>
                        <small>
                          {placed.queueCount} queueing · {placed.customQueue ? "custom path" : `${placed.queueDirection} auto-line`}
                        </small>
                        {snapshot.stallMastery.filter((mastery) => mastery.definitionId === placed.definitionId).map((mastery) => (
                          <small key={mastery.definitionId}>Mastery rank {mastery.rank} · Upgrade {mastery.upgradeLevel}/4</small>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="stall-shutter-toggle"
                        data-open={placed.open}
                        aria-pressed={placed.open}
                        onClick={() => controllerRef.current?.setStallOpen(placed.objectId, !placed.open)}
                      >
                        {placed.open ? "Close stall" : "Open stall"}
                      </button>
                      <div className="queue-direction-group" aria-label={`${placed.name} queue direction`}>
                        {(["north", "east", "south", "west"] as const).map((direction) => (
                          <button
                            type="button"
                            key={direction}
                            className={!placed.customQueue && placed.queueDirection === direction ? "is-active" : ""}
                            aria-pressed={!placed.customQueue && placed.queueDirection === direction}
                            aria-label={`Route ${placed.name} queue ${direction}`}
                            disabled={configurationLocked}
                            onClick={() => controllerRef.current?.setQueueDirection(placed.objectId, direction)}
                          >
                            {{ north: "↑", east: "→", south: "↓", west: "←" }[direction]}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={placed.customQueue ? "is-active edit-queue-button" : "edit-queue-button"}
                          disabled={configurationLocked}
                          onClick={() => controllerRef.current?.beginQueueEdit(placed.objectId)}
                        >
                          Bend line
                        </button>
                      </div>
                      {snapshot.stallMastery.filter((mastery) => mastery.definitionId === placed.definitionId && mastery.nextUpgradeCost !== undefined).map((mastery) => (
                        <button
                          type="button"
                          key={`upgrade-${mastery.definitionId}`}
                          className="stall-upgrade-button"
                          disabled={configurationLocked || mastery.rank < (mastery.requiredRank ?? 1) || snapshot.cashCents < legacySgdCents(mastery.nextUpgradeCost ?? 0)}
                          onClick={() => controllerRef.current?.upgradeStall(mastery.definitionId)}
                        >
                          <span className="stall-upgrade-copy">
                            Upgrade to level {mastery.upgradeLevel + 1}
                            <small>Requires mastery rank {mastery.requiredRank}</small>
                          </span>
                          <strong><SgdAmount cents={legacySgdCents(mastery.nextUpgradeCost ?? 0)} /></strong>
                        </button>
                      ))}
                    </article>
                  ))}
                </section>
              ) : null}
              <h3 className="catalogue-subheading">Add another stall</h3>
              {STALLS.map((stall) => {
                const locked = !snapshot.unlockedContentIds.includes(stall.id);
                return (
                  <button
                    type="button"
                    key={stall.id}
                    className={selectedId === stall.id ? "stall-card is-selected" : "stall-card"}
                    disabled={configurationLocked}
                    onClick={() => selectBuildItem(stall)}
                  >
                    <span
                      className="stall-swatch"
                      data-stall={stall.id.slice("stall.".length)}
                      style={{
                        background: `linear-gradient(145deg, ${stall.visual.palette[0]}, ${stall.visual.palette[1]})`,
                      }}
                      aria-hidden="true"
                    >
                      {catalogueIcon("stall")}
                    </span>
                    <span>
                      <strong>{localize(stall.nameKey)}</strong>
                      <small>{stall.dishIds.length} dishes · {Math.round(stall.quality * 100)} quality</small>
                    </span>
                    <em>{locked ? unlockLabel(stall, snapshot.level, snapshot.reputation, snapshot.unlockedContentIds) : <SgdAmount cents={legacySgdCents(stall.purchaseCost)} />}</em>
                  </button>
                );
              })}
            </div>
          ) : null}

          {panel === "dishes" ? (
            <div className="menu-manager">
              <ComboBoardPlanner
                board={snapshot.comboBoard}
                locked={configurationLocked}
                onSave={(slot, mainId, complementId) => (
                  controllerRef.current?.setComboOffer(slot, mainId, complementId) ?? false
                )}
                onClear={(slot) => controllerRef.current?.clearComboOffer(slot) ?? false}
              />
              {configurationLocked ? (
                <p className="configuration-lock-notice" role="status">
                  Menu offers and preparation terms are frozen for this service cohort. Nutrition and recipe details remain available to inspect.
                </p>
              ) : null}
              <label className="menu-stall-picker">
                Operating stall
                <select value={menuStallId} onChange={(event) => setMenuStallId(event.target.value)}>
                  {STALLS.map((stall) => (
                    <option
                      key={stall.id}
                      value={stall.id}
                      disabled={!snapshot.unlockedContentIds.includes(stall.id)}
                    >
                      {localize(stall.nameKey)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="nutrition-lens-toolbar">
                <label>
                  <span>Nutrition Lens</span>
                  <input
                    type="checkbox"
                    checked={nutritionLens}
                    onChange={(event) => setNutritionLens(event.target.checked)}
                  />
                </label>
                <p>Compare health, popularity, and every nutrient per listed serving.</p>
              </div>
              {STALLS.filter((stall) => stall.id === menuStallId).map((stall) => {
                const activeMenu = snapshot.stallMenus[stall.id] ?? [];
                const mastery = snapshot.stallMastery.find((candidate) => candidate.definitionId === stall.id);
                const upgrade = stall.upgradeLevels.find((candidate) => candidate.level === mastery?.upgradeLevel);
                const menuSlots = stall.menuSlots + (upgrade?.menuSlotsBonus ?? 0);
                return (
                  <div className="dish-list" key={stall.id}>
                    <p className="menu-capacity">
                      {activeMenu.length} of {menuSlots} menu slots active
                    </p>
                    {DISHES.filter((dish) => dish.stallIds.includes(stall.id)).map((dish) => {
                      const checked = activeMenu.includes(dish.id);
                      const preview = dishPreview(dish);
                      const gated = dishMenuUsesMainProgressionGate(
                        scenarioMenuFixed,
                        dish.unlockRequirement,
                        snapshot,
                      );
                      const atCapacity = !checked && activeMenu.length >= menuSlots;
                      const unavailableReason = scenarioMenuFixed
                        ? "Scenario menu and preparations are fixed for comparable scoring"
                        : configurationLocked
                          ? "Menu changes reopen during planning"
                          : gated
                          ? unlockLabel(
                              dish,
                              snapshot.level,
                              snapshot.reputation,
                              snapshot.unlockedContentIds,
                            )
                          : atCapacity
                            ? `All ${menuSlots} menu slots are active`
                            : undefined;
                      const reasonId = `dish-menu-reason-${dish.id.slice("dish.".length)}`;
                      const dishTitleId = `dish-menu-title-${dish.id.slice("dish.".length)}`;
                      const nutritionFamily = nutritionFamilies.find(
                        (family) => family.dishId === dish.id,
                      );
                      const activeVariant = nutritionFamily?.variants.find(
                        (variant) => variant.id === nutritionFamily.activeVariantId,
                      );
                      const activePreparation = snapshot.activePreparations.find(
                        (preparation) => preparation.dishId === dish.id,
                      );
                      const profile = activeVariant?.profile
                        ?? nutritionProfileView(dish.id, activeVariant?.id);
                      const starRating = activePreparation?.terms.starAppeal
                        ?? nutritionFamily?.starRating
                        ?? dishStarRating(dish.id);
                      return (
                        <article
                          key={dish.id}
                          className="dish-row menu-dish-row"
                          aria-labelledby={dishTitleId}
                        >
                          <span
                            className="dish-preview"
                            data-dish={dish.id.slice("dish.".length)}
                            data-variant={activeVariant?.visualKey}
                            data-form={preview.recipe.foodForm}
                            data-motif={preview.recipe.presentation.motif}
                            data-presentation={preview.presentation}
                            data-semantic={preview.recipe.presentation.semanticKey}
                            data-vessel={preview.recipe.presentation.vessel}
                            style={preview.style}
                            aria-hidden="true"
                          >
                            <i className="dish-preview-portion" />
                            <i className="dish-preview-garnish" />
                            <i className="dish-preview-side" />
                          </span>
                          <div className="dish-menu-main">
                            <h3 id={dishTitleId}>{localize(dish.nameKey)}</h3>
                            <small>{dish.category.replace("-", " ")}</small>
                            {activeVariant ? <small>Serving: {activeVariant.label}</small> : null}
                            {activePreparation ? (
                              <PreparationTermsSummary
                                terms={activePreparation.terms}
                                label={`Active ${localize(dish.nameKey)} preparation terms`}
                                compact
                              />
                            ) : null}
                          </div>
                          {nutritionLens ? (
                            <NutritionProfileSummary
                              profile={profile}
                              starRating={starRating}
                            />
                          ) : (
                            <DishRatingSummary
                              healthRating={profile?.healthRating}
                              healthRatingState={profile?.ratingStates?.overall}
                              starRating={starRating}
                            />
                          )}
                          <div className="dish-menu-actions">
                            <button
                              type="button"
                              aria-label={`View nutrition for ${localize(dish.nameKey)}`}
                              onClick={() => setNutritionLens(true)}
                            >
                              View nutrition
                            </button>
                            {nutritionFamily ? (
                              <button
                                type="button"
                                aria-label={`Tune recipe for ${localize(dish.nameKey)}${
                                  scenarioMenuFixed
                                    ? ", unavailable: scenario preparations are fixed for comparable scoring"
                                    : ""
                                }`}
                                disabled={configurationLocked || scenarioMenuFixed}
                                onClick={() => setVariantLabDishId(dish.id)}
                              >
                                Tune recipe
                              </button>
                            ) : null}
                            <label className="dish-offer-control">
                              <span>Offer</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={Boolean(unavailableReason)}
                                aria-label={`Offer ${localize(dish.nameKey)}${unavailableReason ? `, unavailable: ${unavailableReason}` : ""}`}
                                aria-describedby={unavailableReason ? reasonId : undefined}
                                onChange={(event) =>
                                  controllerRef.current?.setDishEnabled(
                                    stall.id,
                                    dish.id,
                                    event.target.checked,
                                  )
                                }
                              />
                            </label>
                          </div>
                          {unavailableReason ? (
                            <em id={reasonId}>{unavailableReason}</em>
                          ) : null}
                        </article>
                      );
                    })}
                    <p className="nutrition-lens-note">
                      Nutrition values are estimates for the listed serving. Actual recipes and portions vary.
                    </p>
                    <NutritionDisclosure />
                  </div>
                );
              })}
            </div>
          ) : null}

          {panel === "insights" ? (
            <div className="insights-list">
              <article data-state={snapshot.queueFlowState}>
                <span aria-hidden="true">↝</span>
                <div>
                  <strong>Queue flow</strong>
                  <p>
                    {snapshot.queueFlowMessage}
                  </p>
                </div>
                <em>{Math.round(snapshot.queuePressure)}% used</em>
              </article>
              <article data-state={snapshot.freeSeats < 2 ? "warning" : "good"}>
                <span aria-hidden="true">◒</span>
                <div>
                  <strong>Communal seating</strong>
                  <p>
                    {snapshot.freeSeats < 2
                      ? "Very few seats are free. Add a table family or improve turnover."
                      : `${snapshot.freeSeats} seats are ready for arriving diners.`}
                  </p>
                </div>
                <em>{snapshot.freeSeats}/{snapshot.totalSeats}</em>
              </article>
              <article data-state="good">
                <span aria-hidden="true">★</span>
                <div>
                  <strong>Centre journey</strong>
                  <p>{snapshot.claimedMilestoneCount} permanent milestones completed.</p>
                  <dl className="milestone-progress-list">
                    {snapshot.milestoneTracks.map((track) => (
                      <div key={track.id}>
                        <dt>{track.title} tier {track.tier}</dt>
                        <dd>{Math.round(track.progress).toLocaleString()} / {track.target.toLocaleString()}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <em>{snapshot.claimedMilestoneCount}/16</em>
              </article>
              <article data-state={snapshot.hasSatisfactionRatings && snapshot.averageSatisfaction < 70 ? "warning" : "good"}>
                <span aria-hidden="true">♥</span>
                <div>
                  <strong>Guest happiness</strong>
                  <p>{snapshot.hasSatisfactionRatings ? `Recent guest visits average ${Math.round(snapshot.averageSatisfaction)}%.` : "Complete a visit to receive the first rating."}</p>
                  {snapshot.satisfactionBreakdown ? (
                    <dl className="happiness-breakdown" aria-label="Guest happiness factors">
                      {[
                        ["Food", snapshot.satisfactionBreakdown.foodQuality],
                        ["Wait", snapshot.satisfactionBreakdown.wait],
                        ["Value", snapshot.satisfactionBreakdown.value],
                        ["Route efficiency", snapshot.satisfactionBreakdown.walking],
                        ["Comfort", snapshot.satisfactionBreakdown.comfort],
                        ["Cleanliness", snapshot.satisfactionBreakdown.cleanliness],
                        ["Ambience", snapshot.satisfactionBreakdown.ambience],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd aria-label={`${label} ${Math.round(Number(value))} out of 100`}>
                            {Math.round(Number(value))}/100
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {snapshot.satisfactionTips.length ? (
                    <div className="happiness-advice">
                      <b>Ways to improve</b>
                      <ul>
                        {snapshot.satisfactionTips.map((tip) => (
                          <li key={tip.factor}>
                            <strong>{tip.label} · {Math.round(tip.score)}</strong>
                            <span>{tip.action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <em>{snapshot.hasSatisfactionRatings ? `${Math.round(snapshot.averageSatisfaction)}%` : "—"}</em>
              </article>
              <article data-state={snapshot.trayReturnStations === 0 || snapshot.cleanliness < 70 ? "warning" : "good"}>
                <span aria-hidden="true">↺</span>
                <div>
                  <strong>Tray return</strong>
                  <p>
                    {snapshot.trayReturnStations === 0
                      ? "There is no usable tray-return station. Add a return rack on a clear exit route."
                      : snapshot.cleanliness < 70
                        ? "Tray-return capacity is strained. Add a visible rack near an exit route."
                        : `${snapshot.trayReturnStations} return point${snapshot.trayReturnStations === 1 ? " is" : "s are"} visible and tables are turning over cleanly.`}
                  </p>
                </div>
                <em>{Math.round(snapshot.cleanliness)}%</em>
              </article>
              <article data-state="neutral">
                <span aria-hidden="true">◎</span>
                <div>
                  <strong>Customer personas</strong>
                  <p>
                    {unlockedCustomerCount} of {CUSTOMER_ARCHETYPES.length} distinct behaviour
                    profiles can currently visit.
                  </p>
                  <details className="persona-roster">
                    <summary>Browse the persona roster</summary>
                    <ul>
                      {CUSTOMER_PERSONAS_BY_UNLOCK.map((customer) => {
                        const unlocked =
                          customer.unlockRequirement.level <= snapshot.level &&
                          customer.unlockRequirement.reputation <= snapshot.reputation &&
                          customer.unlockRequirement.prerequisiteIds.every((id) =>
                            snapshot.unlockedContentIds.includes(id),
                          );
                        return (
                          <li key={customer.id} data-locked={!unlocked}>
                            <strong>{localize(customer.nameKey)}</strong>
                            <span>{localize(customer.descriptionKey)}</span>
                            <small>
                              {unlocked
                                ? "Can visit now"
                                : unlockLabel(
                                    customer,
                                    snapshot.level,
                                    snapshot.reputation,
                                    snapshot.unlockedContentIds,
                                  )}
                            </small>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </div>
                <em>{unlockedCustomerCount}/{CUSTOMER_ARCHETYPES.length}</em>
              </article>
              <RegularGallery regulars={snapshot.regularProgress ?? []} />
              <button
                type="button"
                className="expansion-button"
                disabled={configurationLocked || snapshot.level < 3 || snapshot.cashCents < legacySgdCents(snapshot.nextExpansionCost)}
                onClick={() => {
                  if (controllerRef.current?.expandMap()) audioRef.current?.play("reward");
                }}
              >
                <span>Expand hall · plot {snapshot.expansionCount + 1}</span>
                <strong>
                  {snapshot.level < 3 ? "Unlocks at level 3" : <SgdAmount cents={legacySgdCents(snapshot.nextExpansionCost)} />}
                </strong>
                <small>Add 4 × 2 buildable tiles</small>
              </button>
            </div>
          ) : null}

          {panel === "challenges" ? (
            <StrategicChallenges
              level={mainLevel}
              scenarioProgress={scenarioProgress}
              activeScenario={activeScenarioView}
              mastery={masteryPanel}
              masteryDecisionBusy={masteryDecisionBusy}
              gallery={buildMetaGallery(metaProgression)}
              onStartScenario={(scenarioId) => {
                void startScenario(scenarioId);
              }}
              onResumeScenario={(scenarioId) => {
                void resumeScenario(scenarioId);
              }}
              onLeaveScenario={(scenarioId) => {
                void leaveScenario(scenarioId);
              }}
              onRestartScenario={(scenarioId) => {
                return restartScenario(scenarioId);
              }}
              onAcceptMasteryContract={(contractId) => {
                void acceptMasteryContract(contractId);
              }}
              onSkipMasteryContracts={() => {
                void skipMasteryContracts();
              }}
            />
          ) : null}

          {panel === "activity" ? (
            <div className="activity-panel">
              <div className="activity-toolbar">
                <span>Latest first · routine events stay here</span>
                <button
                  type="button"
                  disabled={activityEntries.length === 0}
                  onClick={() => {
                    setActivityEntries([]);
                    setActivityUnread(0);
                  }}
                >
                  Clear
                </button>
              </div>
              {activityEntries.length === 0 ? (
                <div className="activity-empty">
                  <span aria-hidden="true">◎</span>
                  <strong>No activity yet</strong>
                  <p>Sales, build actions and centre updates will appear here.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {activityEntries.map((entry) => (
                    <article key={entry.id} data-kind={entry.kind} data-importance={entry.importance ?? "routine"}>
                      <span aria-hidden="true">
                        {entry.kind === "success" ? "✓" : entry.kind === "warning" ? "!" : entry.kind === "error" ? "×" : "i"}
                      </span>
                      <div>
                        <strong>
                          {entry.kind === "success" ? "Completed" : entry.kind === "warning" ? "Attention" : entry.kind === "error" ? "Problem" : "Update"}
                        </strong>
                        <p>
                          <span aria-hidden="true">{activityEntryMessage(entry)}</span>
                          <span className="sr-only">{activityEntryAccessibleMessage(entry)}</span>
                        </p>
                      </div>
                      {entry.count > 1 ? <em>×{entry.count}</em> : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {selectedCustomerNutrition ? (
            <>
              <CustomerNutritionInspector
                customer={selectedCustomerNutrition}
                dishLabel={dishLabel}
                starRating={(dishId) => snapshot.activePreparations.find(
                  (preparation) => preparation.dishId === dishId,
                )?.terms.starAppeal ?? dishStarRating(dishId)}
                personaLabel={personaLabel}
                variantLabel={(dishId, variantId) =>
                  customerVariantLabel(nutritionFamilies, dishId, variantId)}
                onClose={() => controllerRef.current?.selectCustomer(undefined)}
                onRestoreFocus={() => gameHostRef.current?.focus()}
              />
              {selectedCustomerNutrition.frozenMeal ? (
                <FrozenMealInspector meal={selectedCustomerNutrition.frozenMeal} />
              ) : null}
            </>
          ) : null}

          {selectedContent &&
          panel !== "activity" &&
          panel !== "challenges" ? (
            <div className="selection-card">
              <button
                type="button"
                aria-label="Clear selection"
                onClick={() => {
                  setSelectedId(undefined);
                  controllerRef.current?.selectBuildItem(undefined);
                }}
              >
                ×
              </button>
              <span>{"category" in selectedContent ? selectedContent.category : "food stall"}</span>
              <strong>{localize(selectedContent.nameKey)}</strong>
              <p>{localize(selectedContent.descriptionKey)}</p>
              <dl>
                <div><dt>Footprint</dt><dd>{selectedContent.footprint.width} × {selectedContent.footprint.height}</dd></div>
                <div><dt>Price</dt><dd><SgdAmount cents={getContentPriceCents(selectedContent)} /></dd></div>
              </dl>
              <small className="sgd-disclaimer">
                Simplified in-game SGD balance value; not a factual hawker price, operating-cost estimate, or business recommendation.
              </small>
              {"category" in selectedContent ? (
                <div className="utility-card">
                  <strong>In-game utility</strong>
                  <ul>
                    {utilityEffects(selectedContent).map((effect) => (
                      <li key={effect}>{effect}</li>
                    ))}
                    {utilityEffects(selectedContent).length === 0 ? (
                      <li>
                        {selectedContent.walkability === "blocked"
                          ? "Shapes guest routes and collision-safe queue lines"
                          : "Adds a walk-through visual landmark"}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </section>

      {snapshot.servicePeriod.phase === "debrief" ? (
        <PeriodDebrief
          dialogRef={periodDebriefDialogRef}
          period={snapshot.servicePeriod}
          forecast={snapshot.forecast}
          ledger={snapshot.periodLedger}
          debrief={snapshot.periodDebrief}
          scenario={snapshot.scenario}
          neighbourhoodEvent={snapshot.neighbourhoodEvent}
          activeParties={snapshot.activeParties ?? []}
          regularProgress={snapshot.regularProgress ?? []}
          masterySaveStatus={
            activeScope.kind === "main"
              ? masteryDebriefSaveStatus
              : "idle"
          }
          onContinue={() => void toggleCentre()}
        />
      ) : null}

      <nav
        className="bottom-dock"
        aria-label="Game sections; scroll horizontally for more sections when needed"
        inert={managementBackgroundInert}
        aria-hidden={managementBackgroundInert}
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement) {
            revealScrollableControl(event.target, settings.reducedMotion);
          }
        }}
      >
        {(
          [
            ["focus", FocusIcon, "Focus"],
            ["build", Grid3X3, "Build"],
            ["stalls", Store, "Stalls"],
            ["dishes", UtensilsCrossed, "Dishes"],
            ["challenges", Trophy, "Challenges"],
            ["insights", Lightbulb, "Insights"],
            ["activity", Clock3, "Activity"],
          ] as const
        ).map(([value, Icon, label]) => {
          const DockIcon = Icon as LucideIcon;
          return (
            <button
              type="button"
              key={value}
              className={visiblePanelSelection && panel === value ? "is-active" : ""}
              aria-current={visiblePanelSelection && panel === value ? "page" : undefined}
              aria-controls={overlayManagement ? "management-panel" : undefined}
              aria-expanded={overlayManagement ? managementSheetOpen && panel === value : undefined}
              aria-haspopup={overlayManagement ? "dialog" : undefined}
              aria-label={value === "activity" && activityUnread > 0 ? `Activity, ${activityUnread} unread` : label}
              onClick={(event) => {
                openPanel(value, event.currentTarget);
              }}
            >
              <DockIcon aria-hidden="true" focusable="false" />
              {label}
              {value === "activity" && activityUnread > 0 ? (
                <i className="dock-unread" aria-hidden="true">{activityUnread}</i>
              ) : null}
            </button>
          );
        })}
        <span className="dock-divider" />
        <button
          type="button"
          disabled={localDataBusy}
          onClick={() => void saveNow()}
        >
          <SaveIcon aria-hidden="true" focusable="false" />
          Save now
        </button>
      </nav>

      <div className="connection-badge" data-online={online} inert={managementBackgroundInert} aria-hidden={managementBackgroundInert}>
        <span />
        {online ? (offlineReady ? "Online · offline-ready" : "Online") : "Playing offline"}
      </div>

      <div className="toast-stack" aria-live="polite" aria-atomic="false" inert={managementBackgroundInert} aria-hidden={managementBackgroundInert}>
        {updateReady ? (
          <div className="toast info">
            <span>↻</span>
            <p>A safe update is ready. Save, then reload when convenient.</p>
            <button type="button" onClick={() => void applyReadyUpdate()}>Save &amp; update</button>
          </div>
        ) : null}
        {toasts.map((toast) => (
          <div className={`toast ${toast.kind}`} key={toast.id}>
            <span aria-hidden="true">{toast.kind === "success" ? "✓" : toast.kind === "error" ? "!" : "i"}</span>
            <p>{toast.message}</p>
          </div>
        ))}
      </div>

      {tutorialStep < 5 ? (
        <div className="modal-backdrop tutorial-backdrop" role="presentation">
          <section
            ref={tutorialDialogRef}
            className="tutorial-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-title"
            tabIndex={-1}
          >
            <div className="tutorial-art" aria-hidden="true">
              <div className="awning"><i /><i /><i /><i /></div>
              <div className="mini-floor">
                <span className="mini-stall" />
                <span className="mini-table one" />
                <span className="mini-table two" />
                <span className="mini-person a" />
                <span className="mini-person b" />
                <span className="mini-plant" />
              </div>
            </div>
            <div className="tutorial-copy">
              <span>{tutorialCopy.eyebrow}</span>
              <h2 id="tutorial-title" tabIndex={-1} data-modal-initial-focus>{tutorialCopy.title}</h2>
              <p>{tutorialCopy.body}</p>
              <div className="tutorial-dots" aria-label={`Tutorial step ${tutorialStep + 1} of 5`}>
                {TUTORIAL_COPY.map((_, index) => (
                  <i key={index} className={index === tutorialStep ? "is-active" : ""} />
                ))}
              </div>
              <div className="tutorial-actions">
                <button type="button" className="text-button" onClick={() => void finishTutorial()}>
                  Skip tutorial
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    if (tutorialStep === 4) void finishTutorial();
                    else setTutorialStep((tutorialStep + 1) as TutorialStep);
                  }}
                >
                  {tutorialCopy.action} <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {tutorialStep === 5 && nutritionTourStep < 2 && guidedDecision ? (
        <div className="modal-backdrop nutrition-tour-backdrop" role="presentation">
          <section
            ref={nutritionTourDialogRef}
            className="nutrition-tour-modal guided-decision-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nutrition-tour-title"
            tabIndex={-1}
          >
            <div className="nutrition-tour-art" aria-hidden="true">
              {nutritionTourStep === 0 ? "?" : "✓"}
            </div>
            <div className="nutrition-tour-copy">
              <span>What’s new · {nutritionTourStep === 0 ? "Predict" : "Reveal"}</span>
              <h2 id="nutrition-tour-title" tabIndex={-1} data-modal-initial-focus>
                {nutritionTourStep === 0
                  ? `Which option fits ${guidedDecision.needLabel.toLocaleLowerCase("en-SG")}?`
                  : "One benefit, one trade-off"}
              </h2>
              {nutritionTourStep === 0 ? (
                <>
                  <p>
                    Some {snapshot.servicePeriod.label.toLocaleLowerCase("en-SG")} visits may carry this need.
                    Predict which real unlocked preparation fits this context better, then reveal a benefit and a trade-off.
                  </p>
                  <fieldset className="guided-choice-list">
                    <legend>Choose your prediction</legend>
                    {guidedDecision.options.map((option) => {
                      const inputId = `guided-choice-${option.responseId.replace(/[^a-z0-9_-]/gi, "-")}`;
                      return (
                        <article key={`${option.dishId}-${option.responseId}`} data-selected={guidedPredictionId === option.responseId}>
                          <label className="guided-choice-heading" htmlFor={inputId}>
                            <input
                              id={inputId}
                              type="radio"
                              name="guided-forecast-choice"
                              checked={guidedPredictionId === option.responseId}
                              onChange={() => setGuidedPredictionId(option.responseId)}
                            />
                            <span><strong>{option.label}</strong><small>{option.variantLabel ?? "Listed serving"} · Unlocked</small></span>
                          </label>
                          <PreparationTermsSummary terms={option.terms} label={`${option.label} comparison terms`} compact />
                        </article>
                      );
                    })}
                  </fieldset>
                  <p className="guided-no-penalty">Prediction only: this does not change your menu, cash, objective, or service.</p>
                  <div className="tutorial-actions">
                    <button type="button" className="text-button" onClick={() => void finishNutritionTour()}>
                      Skip and keep planning
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!guidedSelectedOption}
                      onClick={() => setNutritionTourStep(1)}
                    >
                      Reveal the trade-off <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : guidedSelectedOption && guidedOtherOption && guidedResult ? (
                <>
                  <p>
                    You picked <strong>{guidedSelectedOption.label}</strong>{guidedSelectedOption.variantLabel ? ` · ${guidedSelectedOption.variantLabel}` : ""}.
                    Both options remain valid; the stronger choice changes with the visit and operating context.
                  </p>
                  <div className="guided-reveal" role="status" aria-live="polite">
                    <article data-tone="benefit"><span>Benefit</span><p aria-label={guidedResult.benefitAccessible}>{guidedResult.benefit}</p></article>
                    <article data-tone="tradeoff"><span>Trade-off</span><p aria-label={guidedResult.tradeoffAccessible}>{guidedResult.tradeoff}</p></article>
                  </div>
                  <p className="guided-no-penalty">
                    No score, reward, cash, or configuration changed. Price, queue time, walking distance, Star appeal, demand, and other needs can still alter the best response.
                  </p>
                  <div className="tutorial-actions">
                    <button type="button" className="text-button" onClick={() => setGuidedPredictionId(guidedOtherOption.responseId)}>
                      Reveal {guidedOtherOption.label}
                    </button>
                    <button type="button" className="primary-button" onClick={() => void finishNutritionTour()}>
                      Keep planning <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {eventDecisionOpen && snapshot.neighbourhoodEvent ? (
        <div className="modal-backdrop event-decision-backdrop" role="presentation">
          <section
            ref={eventDecisionDialogRef}
            className="event-decision-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-decision-title"
            aria-describedby="event-decision-description"
            tabIndex={-1}
          >
            <header>
              <span>Untimed neighbourhood choice · planning is paused</span>
              <h2 id="event-decision-title" tabIndex={-1} data-modal-initial-focus>
                {snapshot.neighbourhoodEvent.name}
              </h2>
              <p id="event-decision-description">{snapshot.neighbourhoodEvent.description}</p>
            </header>
            <div className="event-decision-content">
              <div className="event-decision-forecast">
                <strong>Base event forecast before your choice</strong>
                {snapshot.neighbourhoodEvent.baseModifierLabels.length > 0 ? (
                  <ul>
                    {snapshot.neighbourhoodEvent.baseModifierLabels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No operational change is applied before your choice.</p>
                )}
              </div>
              <fieldset className="event-choice-list">
                <legend>{snapshot.neighbourhoodEvent.choicePrompt ?? "Choose a service response"}</legend>
                {snapshot.neighbourhoodEvent.choices.map((choice) => (
                  <button
                    type="button"
                    key={choice.id}
                    onClick={() => controllerRef.current?.chooseNeighbourhoodEvent(choice.id)}
                  >
                    <strong>{choice.label}</strong>
                    <span className="event-choice-outcome">
                      <b>Outcome:</b> {choice.resultingOutcome}
                    </span>
                    <span className="event-choice-deltas">
                      <b>Choice adjustment:</b>{" "}
                      {choice.choiceDeltaLabels.join(" · ")}
                    </span>
                    <span className="event-choice-result">
                      <b>Resulting forecast:</b>{" "}
                      {choice.resultingModifierLabels.join(" · ")}
                    </span>
                  </button>
                ))}
              </fieldset>
              <section className="event-neutral-copy" aria-label="Neutral event outcome">
                <strong>Neutral outcome</strong>
                <p>{snapshot.neighbourhoodEvent.neutralOutcome}</p>
                <p>
                  <b>Resulting forecast:</b>{" "}
                  {snapshot.neighbourhoodEvent.neutralModifierLabels.join(" · ")}
                </p>
              </section>
            </div>
            <footer>
              <button
                type="button"
                className="text-button"
                onClick={() => controllerRef.current?.dismissNeighbourhoodEvent()}
              >
                Apply neutral outcome
              </button>
              <small>Escape applies the same neutral outcome. No service timer runs while this choice is open.</small>
            </footer>
          </section>
        </div>
      ) : null}

      {variantLabFamily && !configurationLocked ? (
        <VariantLabDialog
          dishName={dishLabel(variantLabFamily.dishId)}
          family={variantLabFamily}
          onChoose={(variantId) => {
            if (configurationLocked) {
              explainConfigurationLock();
              return;
            }
            controllerRef.current?.setDishVariant(variantLabFamily.dishId, variantId);
          }}
          onClose={() => setVariantLabDishId(undefined)}
        />
      ) : null}

      {settingsOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section ref={settingsDialogRef} className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} inert={resetOpen || eraseAllOpen} aria-hidden={resetOpen || eraseAllOpen}>
            <header>
              <div><span>Preferences &amp; guide</span><h2 id="settings-title">Settings</h2></div>
              <button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button>
            </header>
            <div className="settings-content">
              <CustomerStatusGuide />
              <fieldset>
                <legend>Performance</legend>
                <label>
                  Quality mode
                  <select
                    value={settings.quality}
                    onChange={(event) => setSettings((current) => ({ ...current, quality: event.target.value as RuntimeSettings["quality"] }))}
                  >
                    <option value="standard">Standard · target 60 FPS</option>
                    <option value="lower-end">Lower-end · target 30 FPS</option>
                  </select>
                </label>
                <label className="switch-row">
                  <span><strong>Reduced motion</strong><small>Calmer camera and fewer ambient animations</small></span>
                  <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings((current) => ({ ...current, reducedMotion: event.target.checked }))} />
                </label>
              </fieldset>
              <fieldset>
                <legend>Readability</legend>
                <label>
                  Text size <strong>{Math.round(settings.textScale * 100)}%</strong>
                  <input type="range" min="1" max="2" step="0.05" value={settings.textScale} onChange={(event) => setSettings((current) => ({ ...current, textScale: Number(event.target.value) }))} />
                </label>
                <label className="switch-row">
                  <span><strong>High contrast</strong><small>Deeper outlines and stronger status patterns</small></span>
                  <input type="checkbox" checked={settings.highContrast} onChange={(event) => setSettings((current) => ({ ...current, highContrast: event.target.checked }))} />
                </label>
              </fieldset>
              <fieldset>
                <legend>Audio</legend>
                <label className="switch-row"><span><strong>Mute all audio</strong></span><input type="checkbox" checked={settings.masterMuted} onChange={(event) => setSettings((current) => ({ ...current, masterMuted: event.target.checked }))} /></label>
                <label>Music volume <strong>{Math.round(settings.musicVolume * 100)}%</strong><input type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={(event) => setSettings((current) => ({ ...current, musicVolume: Number(event.target.value) }))} /></label>
                <label>Ambience volume <strong>{Math.round(settings.ambienceVolume * 100)}%</strong><input type="range" min="0" max="1" step="0.05" value={settings.ambienceVolume} onChange={(event) => setSettings((current) => ({ ...current, ambienceVolume: Number(event.target.value) }))} /></label>
                <label>Effects volume <strong>{Math.round(settings.sfxVolume * 100)}%</strong><input type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(event) => setSettings((current) => ({ ...current, sfxVolume: Number(event.target.value) }))} /></label>
              </fieldset>
              <fieldset disabled={localDataBusy} aria-busy={localDataBusy}>
                <legend>Local data</legend>
                {localDataBusy ? (
                  <small role="status">Finishing a local-data operation…</small>
                ) : null}
                <div className="button-row">
                  <button type="button" onClick={() => void downloadSave()}>Export progress</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}>Import progress</button>
                  <input ref={fileInputRef} className="sr-only" type="file" accept="application/json" onChange={uploadSave} />
                </div>
                <button type="button" className="danger-button" onClick={() => setResetOpen(true)}>Reset main centre…</button>
                <button type="button" className="danger-button" onClick={() => setEraseAllOpen(true)}>Erase all progress…</button>
              </fieldset>
            </div>
            <footer><button type="button" className="primary-button" onClick={() => setSettingsOpen(false)}>Done</button></footer>
          </section>
        </div>
      ) : null}

      {helpOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section ref={helpDialogRef} className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" tabIndex={-1}>
            <header><div><span>How to play</span><h2 id="help-title">Neighbourhood guide</h2></div><button type="button" aria-label="Close help" onClick={() => setHelpOpen(false)}>×</button></header>
            <div className="help-grid">
              <article><kbd>Drag</kbd><strong>Pan the map</strong><p>Or use the arrow keys while the world is focused.</p></article>
              <article><kbd>Wheel</kbd><strong>Zoom</strong><p>Use + and − on the keyboard too.</p></article>
              <article><kbd>R</kbd><strong>Rotate</strong><p>Multi-tile footprints preview before purchase.</p></article>
              <article><kbd>Esc</kbd><strong>Cancel</strong><p>Leave build mode without spending anything.</p></article>
              <article><kbd>Space</kbd><strong>Pause</strong><p>The simulation clamps time after a suspended tab.</p></article>
              <article><kbd>U</kbd><strong>Undo</strong><p>Restore the most recent build change safely.</p></article>
              <article><kbd>Menu</kbd><strong>Compare two ratings</strong><p>Health is a serving-specific comparative in-game balance score; Stars reflect taste and popularity.</p></article>
              <article><kbd>Guest</kbd><strong>Inspect a visit</strong><p>See simulated visit needs, condition-aware game fit, reasons, and fictional stat effects.</p></article>
            </div>
            <NutritionDisclosure />
            <footer>
              <button type="button" onClick={() => { setHelpOpen(false); setGuidedPredictionId(undefined); setNutritionTourStep(0); setTutorialStep(0); }}>Replay tutorial</button>
              <button
                type="button"
                disabled={!guidedDecision || snapshot.servicePeriod.phase !== "planning"}
                onClick={() => { setHelpOpen(false); openGuidedDecision(); }}
              >
                What’s new guide{snapshot.servicePeriod.phase !== "planning" ? " · planning only" : ""}
              </button>
              <button type="button" className="primary-button" onClick={() => setHelpOpen(false)}>Back to centre</button>
            </footer>
          </section>
        </div>
      ) : null}

      {resetOpen ? (
        <div className="modal-backdrop nested" role="presentation">
          <section ref={resetDialogRef} className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" tabIndex={-1}>
            <span aria-hidden="true">!</span>
            <h2 id="reset-title">Reset the main centre?</h2>
            <p id="reset-description">
              This starts the main centre again. Scenario saves, medals, titles,
              and cosmetics are preserved. Any active mastery contract ends so
              its old period sequence cannot carry into the fresh centre.
            </p>
            <div>
              <button
                type="button"
                disabled={localDataBusy}
                onClick={() => setResetOpen(false)}
              >
                Keep playing
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={localDataBusy}
                onClick={() => void confirmReset()}
              >
                Reset main centre
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {eraseAllOpen ? (
        <div className="modal-backdrop nested" role="presentation">
          <section
            ref={eraseAllDialogRef}
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="erase-all-title"
            aria-describedby="erase-all-description"
            tabIndex={-1}
          >
            <span aria-hidden="true">!</span>
            <h2 id="erase-all-title">Erase all progress?</h2>
            <p id="erase-all-description">
              This removes the main centre, every scenario save, medals,
              titles, cosmetics, and mastery progress from this device.
              Display and audio preferences remain.
            </p>
            <div>
              <button
                type="button"
                disabled={localDataBusy}
                onClick={() => setEraseAllOpen(false)}
              >
                Keep progress
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={localDataBusy}
                onClick={() => void confirmEraseAll()}
              >
                Erase all progress
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {debugEnabled ? (
        <section className={debugOpen ? "debug-panel is-open" : "debug-panel"} aria-label="Developer tools" inert={managementBackgroundInert} aria-hidden={managementBackgroundInert}>
          <button type="button" onClick={() => setDebugOpen((value) => !value)}>Debug {debugOpen ? "×" : "+"}</button>
          {debugOpen ? (
            <div>
              <code>{snapshot.fps.toFixed(0)} FPS · {snapshot.simulationMs.toFixed(2)} ms sim</code>
              <button type="button" onClick={() => controllerRef.current?.setDebugOverlay(true)}>Show grid data</button>
              <button type="button" onClick={() => controllerRef.current?.spawnCustomer()}>Spawn customer</button>
              <button
                type="button"
                aria-label={`Add ${describeSgd(100_000)}`}
                onClick={() => controllerRef.current?.addCash(100_000)}
              >
                + <SgdAmount cents={100_000} />
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {serviceAnnouncement}
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {localDataBusy ? "A local game-data operation is in progress." : ""}
      </p>
    </main>
  );
}
