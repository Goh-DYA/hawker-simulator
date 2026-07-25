import {
  MASTERY_CONTRACT_TEMPLATES,
  MAX_NEIGHBOURHOOD_EVENTS_PER_DAY,
  MAX_NEIGHBOURHOOD_EVENTS_PER_PERIOD,
  NEIGHBOURHOOD_EVENTS,
  REGULARS,
  type MasteryContractQualification,
  type MasteryMetric,
  type MasteryContractTemplate,
  type NeighbourhoodEventDefinition,
  type RegularDefinition,
  type ScenarioDefinition,
  type ScenarioId,
  type ScenarioMedal,
  type ServicePeriodId,
} from "../../content/strategicGameplay";
import type {
  HealthCondition,
  NutritionIntentId,
} from "../../content/types";
import { compareIds } from "./ordering";
import { choose, hashSeed, nextFloat } from "./rng";
import type {
  NeighbourhoodEventOccurrenceState,
  RegularProgressState,
} from "./types";
import type { ScenarioEvaluation } from "./scenarios";

export const MAX_EVENTS_PER_PERIOD = MAX_NEIGHBOURHOOD_EVENTS_PER_PERIOD;
export const MAX_EVENTS_PER_DAY = MAX_NEIGHBOURHOOD_EVENTS_PER_DAY;
export const EVENT_OCCURRENCE_BASIS_POINTS = 6_500;
export const MASTERY_UNLOCK_LEVEL = 13;
export const MASTERY_ROTATION_DAYS = 7;
export const REGULAR_VISIT_BASIS_POINTS = 1_500;
export const REGULAR_UNLOCK_LEVEL = 3;

export interface EventSelectionInput {
  readonly seed: number | string;
  readonly day: number;
  readonly periodId: ServicePeriodId;
  readonly periodSequenceId: number;
  readonly history: readonly NeighbourhoodEventOccurrenceState[];
}

/**
 * Event selection uses a keyed stream, never the simulation RNG. Definitions
 * can alter operational demand only; health-condition prevalence is absent
 * from their modifier union.
 */
export function selectNeighbourhoodEvent(
  input: EventSelectionInput,
): NeighbourhoodEventDefinition | undefined {
  const todaysEvents = input.history.filter((event) => event.day === input.day);
  if (
    todaysEvents.length >= MAX_EVENTS_PER_DAY ||
    input.history.some((event) => (
      event.periodSequenceId === input.periodSequenceId ||
      (event.day === input.day && event.periodId === input.periodId)
    ))
  ) {
    return undefined;
  }
  const eligible = NEIGHBOURHOOD_EVENTS
    .filter((event) => event.eligiblePeriods.includes(input.periodId))
    .sort((left, right) => compareIds(left.id, right.id));
  if (eligible.length === 0) return undefined;
  const selectionKey =
    `${input.seed}:${input.day}:${input.periodSequenceId}:${input.periodId}:neighbourhood-event`;
  const occurrence = nextFloat(hashSeed(`${selectionKey}:occurrence`));
  if (occurrence.value * 10_000 >= EVENT_OCCURRENCE_BASIS_POINTS) {
    return undefined;
  }
  return eligible
    .map((event) => ({
      event,
      score: hashSeed(`${selectionKey}:${event.seedSalt}`),
    }))
    .sort(
      (left, right) =>
        left.score - right.score || compareIds(left.event.id, right.event.id),
    )[0]?.event;
}

export type RegularProgressById = Readonly<Record<string, RegularProgressState>>;

export function createRegularProgress(): RegularProgressById {
  return Object.fromEntries(
    REGULARS.map((regular) => [
      regular.id,
      { encounterCount: 0, storyStep: 0 },
    ]),
  );
}

const STORY_STEP_THRESHOLDS = [1, 3, 6, 10] as const;

export function recordRegularEncounter(
  progress: RegularProgressById,
  regularId: string,
  day: number,
): RegularProgressById {
  if (!REGULARS.some((regular) => regular.id === regularId)) {
    throw new RangeError(`Unknown regular: ${regularId}`);
  }
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError("Regular encounter day must be a positive integer");
  }
  const current = progress[regularId] ?? { encounterCount: 0, storyStep: 0 };
  const encounterCount = current.encounterCount + 1;
  const storyStep = STORY_STEP_THRESHOLDS.filter(
    (threshold) => encounterCount >= threshold,
  ).length;
  return {
    ...progress,
    [regularId]: {
      encounterCount,
      storyStep,
      lastVisitDay: day,
    },
  };
}

export interface RegularVisitSelectionInput {
  readonly seed: number | string;
  readonly day: number;
  readonly periodId: ServicePeriodId;
  readonly arrivalSequenceId: number;
  readonly progress: RegularProgressById;
  readonly incidenceBasisPoints?: number;
}

/**
 * Selects a recurring fictional identity on its own keyed stream. The function
 * accepts no condition, persona, appearance, event, or nutrition arguments, so
 * those properties cannot define a regular or affect regular incidence.
 */
export function selectRegularForVisit(
  input: RegularVisitSelectionInput,
): RegularDefinition | undefined {
  const incidenceBasisPoints =
    input.incidenceBasisPoints ?? REGULAR_VISIT_BASIS_POINTS;
  if (
    !Number.isSafeInteger(incidenceBasisPoints) ||
    incidenceBasisPoints < 0 ||
    incidenceBasisPoints > 10_000
  ) {
    throw new RangeError("Regular incidence must be integer basis points.");
  }
  const key = `${input.seed}:${input.day}:${input.periodId}:${input.arrivalSequenceId}:regular`;
  const roll = nextFloat(hashSeed(`${key}:incidence`));
  if (roll.value * 10_000 >= incidenceBasisPoints) return undefined;
  const eligible = REGULARS
    .filter((regular) => regular.preferredPeriods.includes(input.periodId))
    .map((regular) => ({
      regular,
      encounters: input.progress[regular.id]?.encounterCount ?? 0,
      score: hashSeed(`${key}:${regular.seedSalt}`),
    }))
    .sort(
      (left, right) =>
        left.encounters - right.encounters ||
        left.score - right.score ||
        compareIds(left.regular.id, right.regular.id),
    );
  return eligible[0]?.regular;
}

const VISIT_INTENTS = [
  "lighter-energy",
  "protein-forward",
  "fibre-forward",
  "sodium-aware",
  "lower-total-sugar-drink",
] as const satisfies readonly NutritionIntentId[];

const HEALTH_CONDITIONS = [
  "high-cholesterol",
  "obesity",
  "diabetes",
  "hypertension",
] as const satisfies readonly HealthCondition[];

export interface IndependentlySampledVisitNeeds {
  readonly nutritionIntentId: NutritionIntentId;
  readonly conditionAwareNeed?: HealthCondition;
}

/**
 * Samples visit needs without accepting a regular, persona, event, appearance,
 * or neighbourhood identifier.
 */
export function sampleIndependentVisitNeeds(
  seed: number | string,
  arrivalSequenceId: number,
  conditionAwareProbability = 0.18,
): IndependentlySampledVisitNeeds {
  if (!Number.isInteger(arrivalSequenceId) || arrivalSequenceId < 0) {
    throw new RangeError("Arrival sequence ID must be a non-negative integer");
  }
  if (
    !Number.isFinite(conditionAwareProbability) ||
    conditionAwareProbability < 0 ||
    conditionAwareProbability > 1
  ) {
    throw new RangeError("Condition-aware probability must be between zero and one");
  }
  const intent = choose(
    hashSeed(`${seed}:${arrivalSequenceId}:intent`),
    VISIT_INTENTS,
  ).value;
  const conditionRoll = nextFloat(
    hashSeed(`${seed}:${arrivalSequenceId}:condition-roll`),
  );
  if (conditionRoll.value >= conditionAwareProbability) {
    return { nutritionIntentId: intent };
  }
  return {
    nutritionIntentId: intent,
    conditionAwareNeed: choose(conditionRoll.state, HEALTH_CONDITIONS).value,
  };
}

export interface MasteryFeasibilityContext {
  readonly level: number;
  readonly openStallCount: number;
  readonly availableSeatCount: number;
  readonly comboBoardUnlocked: boolean;
  /** Valid configured offers that can currently produce a combo visit. */
  readonly validComboOfferCount: number;
  /** Current tray-return capacity; zero cannot produce a tray-return outcome. */
  readonly trayReturnStationCount: number;
  /** Whether the current forecast contains any non-solo party demand. */
  readonly partyDemandAvailable: boolean;
  /** Whether the current forecast contains a nutrition-intent opportunity. */
  readonly forecastNutritionIntentAvailable: boolean;
  /** When supplied, prevents offering Menu Craft above the current unlock set. */
  readonly unlockedPreparationCount?: number;
}

export function isMasteryContractFeasible(
  template: MasteryContractTemplate,
  context: MasteryFeasibilityContext,
): boolean {
  const metricIsFeasible = (() => {
    switch (template.target.metric) {
      case "distinct-preparations":
        return (
          context.unlockedPreparationCount === undefined ||
          context.unlockedPreparationCount >= template.target.value
        );
      case "party-visits":
        return context.partyDemandAvailable;
      case "tray-return-rate-percent":
        return context.trayReturnStationCount > 0;
      case "forecast-needs-met":
        return context.forecastNutritionIntentAvailable;
      case "combo-visits":
        return context.validComboOfferCount > 0;
      default:
        return true;
    }
  })();
  return (
    context.level >= template.unlockLevel &&
    context.openStallCount >= template.feasibility.minimumOpenStalls &&
    context.availableSeatCount >= template.feasibility.minimumSeats &&
    (!template.feasibility.requiresComboBoard || context.comboBoardUnlocked) &&
    metricIsFeasible
  );
}

export function offerMasteryContracts(
  seed: number | string,
  day: number,
  context: MasteryFeasibilityContext,
): readonly MasteryContractTemplate[] {
  if (context.level < MASTERY_UNLOCK_LEVEL) return [];
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError("Contract day must be a positive integer");
  }
  const rotation = Math.floor((day - 1) / MASTERY_ROTATION_DAYS);
  const ranked = MASTERY_CONTRACT_TEMPLATES.filter((template) =>
    isMasteryContractFeasible(template, context),
  )
    .map((template) => ({
      template,
      score: hashSeed(`${seed}:${rotation}:${template.id}`),
    }))
    .sort(
      (left, right) =>
        left.score - right.score ||
        compareIds(left.template.id, right.template.id),
    )
    .map(({ template }) => template);
  return ranked.length >= 3 ? ranked.slice(0, 3) : [];
}

export interface AcceptedMasteryContract {
  readonly templateId: string;
  readonly acceptedDay: number;
  /** Inclusive first period; optional only for preceding V1-compatible records. */
  readonly acceptedPeriodSequence?: number;
  /** Frozen duration; optional only for preceding V1-compatible records. */
  readonly durationPeriods?: number;
  /** Exclusive period boundary. */
  readonly expiresAfterPeriod: number;
  readonly target: MasteryContractTemplate["target"];
  readonly qualification?: MasteryContractQualification;
  readonly reward: MasteryContractTemplate["reward"];
}

/** Snapshots target and reward so later content changes cannot move the goal. */
export function acceptMasteryContract(
  template: MasteryContractTemplate,
  acceptedDay: number,
  currentPeriodSequence: number,
): AcceptedMasteryContract {
  return {
    templateId: template.id,
    acceptedDay,
    acceptedPeriodSequence: currentPeriodSequence,
    durationPeriods: template.durationPeriods,
    expiresAfterPeriod: currentPeriodSequence + template.durationPeriods,
    target: { ...template.target },
    ...(template.qualification === undefined
      ? {}
      : { qualification: { ...template.qualification } }),
    reward: { ...template.reward },
  };
}

export interface MasteryAccumulationV1 {
  readonly completedVisits: number;
  readonly grossSalesCents: number;
  readonly contributionCents: number;
  readonly minimumSatisfaction?: number;
  readonly maximumMedianWaitSeconds?: number;
  readonly flowSeconds: number;
  readonly distinctPreparationIds: readonly string[];
  readonly partyVisits: number;
  readonly trayReturns: number;
  readonly trayReturnOpportunities: number;
  readonly forecastNeedsMet: number;
  readonly periodsWithoutRefund: number;
  readonly comboVisits: number;
  readonly processedPeriodSequenceIds: readonly number[];
  readonly qualifiedPeriodSequenceIds: readonly number[];
}

export interface ActiveMasteryContractV1 {
  readonly schemaVersion: 1;
  readonly contract: AcceptedMasteryContract;
  readonly progress: MasteryAccumulationV1;
}

export interface MasteryContractOutcomeV1 {
  readonly schemaVersion: 1;
  readonly contract: AcceptedMasteryContract;
  readonly status: "completed" | "failed";
  readonly endedAtPeriodSequence: number;
  readonly progress: MasteryAccumulationV1;
  readonly rewardGranted: boolean;
}

/**
 * JSON-safe mastery state. Keeping its schema independent from the main game
 * save lets persistence add it to runtime V5 or a separate envelope without
 * changing the deterministic rules below.
 */
export interface MasteryProgressionV1 {
  readonly schemaVersion: 1;
  readonly decidedRotation?: number;
  readonly decision?: "accepted" | "skipped";
  readonly activeContract?: ActiveMasteryContractV1;
  readonly lastOutcome?: MasteryContractOutcomeV1;
}

export function createEmptyMasteryProgression(): MasteryProgressionV1 {
  return { schemaVersion: 1 };
}

function emptyMasteryAccumulation(): MasteryAccumulationV1 {
  return {
    completedVisits: 0,
    grossSalesCents: 0,
    contributionCents: 0,
    flowSeconds: 0,
    distinctPreparationIds: [],
    partyVisits: 0,
    trayReturns: 0,
    trayReturnOpportunities: 0,
    forecastNeedsMet: 0,
    periodsWithoutRefund: 0,
    comboVisits: 0,
    processedPeriodSequenceIds: [],
    qualifiedPeriodSequenceIds: [],
  };
}

export function masteryRotationForDay(day: number): number {
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError("Contract day must be a positive integer");
  }
  return Math.floor((day - 1) / MASTERY_ROTATION_DAYS);
}

export type MasteryOfferUnavailableReason =
  | "mastery-locked"
  | "breakfast-only"
  | "active-contract"
  | "rotation-decided"
  | "fewer-than-three-feasible-contracts";

export interface AvailableMasteryOffer {
  readonly status: "available";
  readonly rotation: number;
  readonly availableFromDay: number;
  readonly availableThroughDay: number;
  readonly choices: readonly [
    MasteryContractTemplate,
    MasteryContractTemplate,
    MasteryContractTemplate,
  ];
}

export interface UnavailableMasteryOffer {
  readonly status: "unavailable";
  readonly rotation: number;
  readonly reason: MasteryOfferUnavailableReason;
  readonly feasibleChoiceCount: number;
  readonly choices: readonly [];
}

export type MasteryOffer = AvailableMasteryOffer | UnavailableMasteryOffer;

export interface MasteryOfferInput {
  readonly seed: number | string;
  readonly day: number;
  readonly periodId: ServicePeriodId;
  readonly context: MasteryFeasibilityContext;
  readonly progression: MasteryProgressionV1;
  readonly meta: MetaProgressionV1;
}

function rankedMasteryContracts(
  seed: number | string,
  rotation: number,
  context: MasteryFeasibilityContext,
  completedContractIds: readonly string[],
): readonly MasteryContractTemplate[] {
  const completed = new Set(completedContractIds);
  return MASTERY_CONTRACT_TEMPLATES
    .filter((template) => isMasteryContractFeasible(template, context))
    .map((template) => ({
      template,
      previouslyCompleted: completed.has(template.id),
      score: hashSeed(`${seed}:${rotation}:${template.id}`),
    }))
    .sort(
      (left, right) =>
        Number(left.previouslyCompleted) - Number(right.previouslyCompleted) ||
        left.score - right.score ||
        compareIds(left.template.id, right.template.id),
    )
    .map(({ template }) => template);
}

/**
 * Derives a complete player decision surface. An offer is never partially
 * populated. Unearned contracts are shown first; deterministic completed
 * replays fill any remaining slots so a feasible breakfast still presents
 * exactly three choices.
 */
export function deriveMasteryOffer(input: MasteryOfferInput): MasteryOffer {
  const rotation = masteryRotationForDay(input.day);
  const unavailable = (
    reason: MasteryOfferUnavailableReason,
    feasibleChoiceCount = 0,
  ): UnavailableMasteryOffer => ({
    status: "unavailable",
    rotation,
    reason,
    feasibleChoiceCount,
    choices: [],
  });
  if (input.context.level < MASTERY_UNLOCK_LEVEL) {
    return unavailable("mastery-locked");
  }
  if (input.periodId !== "breakfast") {
    return unavailable("breakfast-only");
  }
  if (input.progression.activeContract) {
    return unavailable("active-contract");
  }
  if (input.progression.decidedRotation === rotation) {
    return unavailable("rotation-decided");
  }
  const ranked = rankedMasteryContracts(
    input.seed,
    rotation,
    input.context,
    input.meta.completedContractIds,
  );
  if (ranked.length < 3) {
    return unavailable(
      "fewer-than-three-feasible-contracts",
      ranked.length,
    );
  }
  return {
    status: "available",
    rotation,
    availableFromDay: rotation * MASTERY_ROTATION_DAYS + 1,
    availableThroughDay: (rotation + 1) * MASTERY_ROTATION_DAYS,
    choices: [ranked[0]!, ranked[1]!, ranked[2]!],
  };
}

function assertUndecidedOffer(
  progression: MasteryProgressionV1,
  offer: AvailableMasteryOffer,
): void {
  if (
    progression.activeContract ||
    progression.decidedRotation === offer.rotation
  ) {
    throw new RangeError("This mastery-contract rotation is already decided");
  }
}

export function acceptMasteryOffer(
  progression: MasteryProgressionV1,
  offer: AvailableMasteryOffer,
  templateId: string,
  acceptedDay: number,
  currentPeriodSequence: number,
): MasteryProgressionV1 {
  assertUndecidedOffer(progression, offer);
  if (masteryRotationForDay(acceptedDay) !== offer.rotation) {
    throw new RangeError("The mastery offer is not current for this day");
  }
  if (!Number.isSafeInteger(currentPeriodSequence) || currentPeriodSequence < 1) {
    throw new RangeError("Contract period sequence must be a positive integer");
  }
  const template = offer.choices.find((choice) => choice.id === templateId);
  if (!template) {
    throw new RangeError("The selected mastery contract is not in this offer");
  }
  return {
    ...progression,
    decidedRotation: offer.rotation,
    decision: "accepted",
    activeContract: {
      schemaVersion: 1,
      contract: acceptMasteryContract(
        template,
        acceptedDay,
        currentPeriodSequence,
      ),
      progress: emptyMasteryAccumulation(),
    },
  };
}

export function skipMasteryOffer(
  progression: MasteryProgressionV1,
  offer: AvailableMasteryOffer,
): MasteryProgressionV1 {
  assertUndecidedOffer(progression, offer);
  return {
    ...progression,
    decidedRotation: offer.rotation,
    decision: "skipped",
  };
}

export interface MasteryPeriodDebrief {
  readonly periodSequenceId: number;
  readonly completedVisits: number;
  readonly grossSalesCents: number;
  readonly contributionCents: number;
  readonly minimumSatisfaction?: number;
  readonly medianWaitSeconds?: number;
  readonly flowSeconds: number;
  readonly distinctPreparationIds: readonly string[];
  readonly partyVisits: number;
  readonly trayReturns: number;
  readonly trayReturnOpportunities: number;
  readonly forecastNeedsMet: number;
  readonly refundCents: number;
  readonly comboVisits: number;
}

function assertSafeNonNegative(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function validateMasteryDebrief(debrief: MasteryPeriodDebrief): void {
  const nonNegativeValues: readonly [number, string][] = [
    [debrief.periodSequenceId, "Period sequence"],
    [debrief.completedVisits, "Completed visits"],
    [debrief.grossSalesCents, "Gross sales"],
    [debrief.flowSeconds, "Flow seconds"],
    [debrief.partyVisits, "Party visits"],
    [debrief.trayReturns, "Tray returns"],
    [debrief.trayReturnOpportunities, "Tray return opportunities"],
    [debrief.forecastNeedsMet, "Forecast needs met"],
    [debrief.refundCents, "Refund"],
    [debrief.comboVisits, "Combo visits"],
  ];
  for (const [value, label] of nonNegativeValues) {
    assertSafeNonNegative(value, label);
  }
  if (!Number.isSafeInteger(debrief.contributionCents)) {
    throw new RangeError("Contribution must be safe integer cents");
  }
  if (debrief.trayReturns > debrief.trayReturnOpportunities) {
    throw new RangeError("Tray returns cannot exceed their opportunities");
  }
  if (
    debrief.minimumSatisfaction !== undefined &&
    (!Number.isFinite(debrief.minimumSatisfaction) ||
      debrief.minimumSatisfaction < 0 ||
      debrief.minimumSatisfaction > 100)
  ) {
    throw new RangeError("Minimum satisfaction must be between 0 and 100");
  }
  if (
    debrief.medianWaitSeconds !== undefined &&
    (!Number.isFinite(debrief.medianWaitSeconds) ||
      debrief.medianWaitSeconds < 0)
  ) {
    throw new RangeError("Median wait must be a non-negative number");
  }
  if (
    debrief.distinctPreparationIds.some(
      (preparationId) => preparationId.trim().length === 0,
    )
  ) {
    throw new RangeError("Preparation IDs cannot be empty");
  }
}

function accumulateMasteryDebrief(
  progress: MasteryAccumulationV1,
  debrief: MasteryPeriodDebrief,
  targetMetric: MasteryMetric,
  qualifies: boolean,
  requiresQualification: boolean,
): MasteryAccumulationV1 {
  const includeQualifiedSample = !requiresQualification || qualifies;
  const minimumSatisfaction =
    !includeQualifiedSample || debrief.minimumSatisfaction === undefined
    ? progress.minimumSatisfaction
    : Math.min(
        progress.minimumSatisfaction ?? debrief.minimumSatisfaction,
        debrief.minimumSatisfaction,
      );
  const maximumMedianWaitSeconds =
    !includeQualifiedSample || debrief.medianWaitSeconds === undefined
    ? progress.maximumMedianWaitSeconds
    : Math.max(
        progress.maximumMedianWaitSeconds ?? debrief.medianWaitSeconds,
        debrief.medianWaitSeconds,
      );
  const includeTraySample =
    targetMetric !== "tray-return-rate-percent" || includeQualifiedSample;
  return {
    completedVisits: progress.completedVisits + debrief.completedVisits,
    grossSalesCents: progress.grossSalesCents + debrief.grossSalesCents,
    contributionCents:
      progress.contributionCents + debrief.contributionCents,
    ...(minimumSatisfaction === undefined ? {} : { minimumSatisfaction }),
    ...(maximumMedianWaitSeconds === undefined
      ? {}
      : { maximumMedianWaitSeconds }),
    flowSeconds: progress.flowSeconds + debrief.flowSeconds,
    distinctPreparationIds: [
      ...new Set([
        ...progress.distinctPreparationIds,
        ...debrief.distinctPreparationIds,
      ]),
    ].sort(compareIds),
    partyVisits: progress.partyVisits + debrief.partyVisits,
    trayReturns:
      progress.trayReturns + (includeTraySample ? debrief.trayReturns : 0),
    trayReturnOpportunities:
      progress.trayReturnOpportunities +
      (includeTraySample ? debrief.trayReturnOpportunities : 0),
    forecastNeedsMet:
      progress.forecastNeedsMet + debrief.forecastNeedsMet,
    periodsWithoutRefund:
      progress.periodsWithoutRefund +
      (
        debrief.refundCents === 0 &&
        (debrief.completedVisits > 0 || debrief.grossSalesCents > 0)
          ? 1
          : 0
      ),
    comboVisits: progress.comboVisits + debrief.comboVisits,
    processedPeriodSequenceIds: [
      ...progress.processedPeriodSequenceIds,
      debrief.periodSequenceId,
    ].sort((left, right) => left - right),
    qualifiedPeriodSequenceIds: qualifies
      ? [
          ...progress.qualifiedPeriodSequenceIds,
          debrief.periodSequenceId,
        ].sort((left, right) => left - right)
      : progress.qualifiedPeriodSequenceIds,
  };
}

function masteryDebriefMeetsQualification(
  contract: AcceptedMasteryContract,
  debrief: MasteryPeriodDebrief,
): boolean {
  const qualification = contract.qualification;
  if (!qualification) return false;
  if (
    qualification.minimumCompletedVisitsPerPeriod !== undefined &&
    debrief.completedVisits < qualification.minimumCompletedVisitsPerPeriod
  ) {
    return false;
  }
  if (
    qualification.minimumTrayReturnOpportunitiesPerPeriod !== undefined &&
    debrief.trayReturnOpportunities <
      qualification.minimumTrayReturnOpportunitiesPerPeriod
  ) {
    return false;
  }
  if (
    contract.target.metric === "minimum-satisfaction" &&
    debrief.minimumSatisfaction === undefined
  ) {
    return false;
  }
  if (
    contract.target.metric === "maximum-median-wait-seconds" &&
    debrief.medianWaitSeconds === undefined
  ) {
    return false;
  }
  if (
    contract.target.metric === "tray-return-rate-percent" &&
    debrief.trayReturnOpportunities === 0
  ) {
    return false;
  }
  return true;
}

function masteryRequiredQualifiedPeriods(
  active: ActiveMasteryContractV1,
): number {
  if (!active.contract.qualification) return 0;
  if (active.contract.durationPeriods !== undefined) {
    return active.contract.durationPeriods;
  }
  if (active.contract.acceptedPeriodSequence !== undefined) {
    return Math.max(
      0,
      active.contract.expiresAfterPeriod -
        active.contract.acceptedPeriodSequence,
    );
  }
  return active.progress.processedPeriodSequenceIds.length;
}

export interface MasteryProgressValue {
  readonly metric: MasteryMetric;
  readonly value?: number;
  readonly target: number;
  readonly direction: "at-least" | "at-most";
  readonly observed: boolean;
  readonly satisfied: boolean;
}

const AT_MOST_MASTERY_METRICS = new Set<MasteryMetric>([
  "maximum-median-wait-seconds",
]);

const END_GUARDRAIL_MASTERY_METRICS = new Set<MasteryMetric>([
  "minimum-satisfaction",
  "maximum-median-wait-seconds",
  "tray-return-rate-percent",
]);

export function deriveMasteryProgressValue(
  active: ActiveMasteryContractV1,
): MasteryProgressValue {
  const { metric, value: target } = active.contract.target;
  const progress = active.progress;
  let value: number | undefined;
  switch (metric) {
    case "completed-visits":
      value = progress.completedVisits;
      break;
    case "gross-sales-cents":
      value = progress.grossSalesCents;
      break;
    case "contribution-cents":
      value = progress.contributionCents;
      break;
    case "minimum-satisfaction":
      value = progress.minimumSatisfaction;
      break;
    case "maximum-median-wait-seconds":
      value = progress.maximumMedianWaitSeconds;
      break;
    case "flow-seconds":
      value = progress.flowSeconds;
      break;
    case "distinct-preparations":
      value = progress.distinctPreparationIds.length;
      break;
    case "party-visits":
      value = progress.partyVisits;
      break;
    case "tray-return-rate-percent":
      value = progress.trayReturnOpportunities === 0
        ? undefined
        : (progress.trayReturns * 100) / progress.trayReturnOpportunities;
      break;
    case "forecast-needs-met":
      value = progress.forecastNeedsMet;
      break;
    case "periods-without-refund":
      value = progress.periodsWithoutRefund;
      break;
    case "combo-visits":
      value = progress.comboVisits;
      break;
  }
  const direction = AT_MOST_MASTERY_METRICS.has(metric)
    ? "at-most"
    : "at-least";
  return {
    metric,
    ...(value === undefined ? {} : { value }),
    target,
    direction,
    observed: value !== undefined,
    satisfied:
      value !== undefined &&
      (direction === "at-most" ? value <= target : value >= target),
  };
}

export interface MasteryContractView {
  readonly status: "active" | "completed" | "failed";
  readonly templateId: string;
  readonly metric: MasteryMetric;
  readonly value?: number;
  readonly target: number;
  readonly direction: "at-least" | "at-most";
  readonly observed: boolean;
  readonly satisfied: boolean;
  readonly progressBasisPoints: number;
  readonly completedPeriods: number;
  readonly totalPeriods: number;
  readonly remainingPeriods: number;
  readonly qualifiedPeriods: number;
  readonly requiredQualifiedPeriods: number;
  readonly qualificationSatisfied: boolean;
  readonly reward: AcceptedMasteryContract["reward"];
  readonly rewardGranted?: boolean;
}

function activeFromOutcome(
  outcome: MasteryContractOutcomeV1,
): ActiveMasteryContractV1 {
  return {
    schemaVersion: 1,
    contract: outcome.contract,
    progress: outcome.progress,
  };
}

/** Derives stable display values without consulting mutable authored content. */
export function deriveMasteryContractView(
  source: ActiveMasteryContractV1 | MasteryContractOutcomeV1,
): MasteryContractView {
  const active = "status" in source ? activeFromOutcome(source) : source;
  const progress = deriveMasteryProgressValue(active);
  const acceptedPeriodSequence =
    active.contract.acceptedPeriodSequence ??
    active.contract.expiresAfterPeriod -
      active.progress.processedPeriodSequenceIds.length;
  const totalPeriods =
    active.contract.durationPeriods ??
    Math.max(
      0,
      active.contract.expiresAfterPeriod - acceptedPeriodSequence,
    );
  const completedPeriods = active.progress.processedPeriodSequenceIds.filter(
    (sequenceId) => (
      sequenceId >= acceptedPeriodSequence &&
      sequenceId < active.contract.expiresAfterPeriod
    ),
  ).length;
  const qualifiedPeriods = active.progress.qualifiedPeriodSequenceIds.filter(
    (sequenceId) => (
      sequenceId >= acceptedPeriodSequence &&
      sequenceId < active.contract.expiresAfterPeriod
    ),
  ).length;
  const requiredQualifiedPeriods = masteryRequiredQualifiedPeriods(active);
  const ended = "status" in source;
  const ratio = progress.value === undefined
    ? 0
    : progress.direction === "at-most"
      ? progress.value <= progress.target
        ? 1
        : progress.target / Math.max(progress.value, 1)
      : progress.target <= 0
        ? 1
        : progress.value / progress.target;
  return {
    status: "status" in source ? source.status : "active",
    templateId: active.contract.templateId,
    metric: progress.metric,
    ...(progress.value === undefined ? {} : { value: progress.value }),
    target: progress.target,
    direction: progress.direction,
    observed: progress.observed,
    satisfied: progress.satisfied,
    progressBasisPoints: Math.max(
      0,
      Math.min(10_000, Math.floor(ratio * 10_000)),
    ),
    completedPeriods,
    totalPeriods,
    remainingPeriods: ended
      ? 0
      : Math.max(0, totalPeriods - completedPeriods),
    qualifiedPeriods,
    requiredQualifiedPeriods,
    qualificationSatisfied:
      requiredQualifiedPeriods === 0 ||
      qualifiedPeriods >= requiredQualifiedPeriods,
    reward: active.contract.reward,
    ...("status" in source
      ? { rewardGranted: source.rewardGranted }
      : {}),
  };
}

export interface ApplyMasteryDebriefResult {
  readonly progression: MasteryProgressionV1;
  readonly meta: MetaProgressionV1;
  readonly outcome?: MasteryContractOutcomeV1;
  readonly rewardGranted: boolean;
}

function masteryOutcome(
  active: ActiveMasteryContractV1,
  status: MasteryContractOutcomeV1["status"],
  endedAtPeriodSequence: number,
  rewardGranted: boolean,
): MasteryContractOutcomeV1 {
  return {
    schemaVersion: 1,
    contract: active.contract,
    status,
    endedAtPeriodSequence,
    progress: active.progress,
    rewardGranted,
  };
}

/**
 * The sole accumulation entry point consumes a finalized period debrief. It is
 * idempotent by period sequence and completes guardrail/rate contracts only at
 * their final eligible debrief, when their result can no longer degrade.
 */
export function applyMasteryPeriodDebrief(
  progression: MasteryProgressionV1,
  meta: MetaProgressionV1,
  debrief: MasteryPeriodDebrief,
): ApplyMasteryDebriefResult {
  validateMasteryDebrief(debrief);
  const current = progression.activeContract;
  if (!current) {
    return { progression, meta, rewardGranted: false };
  }
  if (
    current.progress.processedPeriodSequenceIds.includes(
      debrief.periodSequenceId,
    )
  ) {
    return { progression, meta, rewardGranted: false };
  }
  const acceptedPeriodSequence =
    current.contract.acceptedPeriodSequence ??
    current.progress.processedPeriodSequenceIds[0] ??
    debrief.periodSequenceId;
  const expectedPeriodSequence =
    (current.progress.processedPeriodSequenceIds.at(-1) ??
      acceptedPeriodSequence - 1) + 1;
  if (debrief.periodSequenceId < acceptedPeriodSequence) {
    throw new RangeError("Mastery debrief precedes contract acceptance");
  }
  if (
    debrief.periodSequenceId < current.contract.expiresAfterPeriod &&
    debrief.periodSequenceId !== expectedPeriodSequence
  ) {
    throw new RangeError("Mastery debriefs must be applied in period order");
  }
  if (debrief.periodSequenceId >= current.contract.expiresAfterPeriod) {
    const outcome = masteryOutcome(
      current,
      "failed",
      debrief.periodSequenceId,
      false,
    );
    return {
      progression: {
        ...progression,
        activeContract: undefined,
        lastOutcome: outcome,
      },
      meta,
      outcome,
      rewardGranted: false,
    };
  }
  const requiresQualification = current.contract.qualification !== undefined;
  const qualifies = masteryDebriefMeetsQualification(
    current.contract,
    debrief,
  );
  const accumulated: ActiveMasteryContractV1 = {
    ...current,
    progress: accumulateMasteryDebrief(
      current.progress,
      debrief,
      current.contract.target.metric,
      qualifies,
      requiresQualification,
    ),
  };
  const progressValue = deriveMasteryProgressValue(accumulated);
  const qualificationSatisfied =
    !requiresQualification ||
    accumulated.progress.qualifiedPeriodSequenceIds.length >=
      masteryRequiredQualifiedPeriods(accumulated);
  const finalEligiblePeriod =
    debrief.periodSequenceId === current.contract.expiresAfterPeriod - 1;
  const canCompleteNow =
    progressValue.satisfied &&
    qualificationSatisfied &&
    (
      !END_GUARDRAIL_MASTERY_METRICS.has(progressValue.metric) ||
      finalEligiblePeriod
    );
  if (canCompleteNow) {
    const rewardGranted = !meta.completedContractIds.includes(
      accumulated.contract.templateId,
    );
    const nextMeta = rewardGranted
      ? recordMasteryCompletion(meta, accumulated.contract)
      : meta;
    const outcome = masteryOutcome(
      accumulated,
      "completed",
      debrief.periodSequenceId,
      rewardGranted,
    );
    return {
      progression: {
        ...progression,
        activeContract: undefined,
        lastOutcome: outcome,
      },
      meta: nextMeta,
      outcome,
      rewardGranted,
    };
  }
  if (finalEligiblePeriod) {
    const outcome = masteryOutcome(
      accumulated,
      "failed",
      debrief.periodSequenceId,
      false,
    );
    return {
      progression: {
        ...progression,
        activeContract: undefined,
        lastOutcome: outcome,
      },
      meta,
      outcome,
      rewardGranted: false,
    };
  }
  return {
    progression: {
      ...progression,
      activeContract: accumulated,
    },
    meta,
    rewardGranted: false,
  };
}

export function expireMasteryContract(
  progression: MasteryProgressionV1,
  currentPeriodSequence: number,
): MasteryProgressionV1 {
  if (!Number.isSafeInteger(currentPeriodSequence) || currentPeriodSequence < 1) {
    throw new RangeError("Contract period sequence must be a positive integer");
  }
  const active = progression.activeContract;
  if (!active || currentPeriodSequence < active.contract.expiresAfterPeriod) {
    return progression;
  }
  const outcome = masteryOutcome(
    active,
    "failed",
    currentPeriodSequence,
    false,
  );
  return {
    ...progression,
    activeContract: undefined,
    lastOutcome: outcome,
  };
}

export interface MetaProgressionV1 {
  readonly schemaVersion: 1;
  readonly scenarioMedals: Readonly<Partial<Record<ScenarioId, ScenarioMedal>>>;
  readonly unlockedCosmeticIds: readonly string[];
  readonly unlockedTitleIds: readonly string[];
  readonly completedContractIds: readonly string[];
  /**
   * Optional only for Stage 4 / preceding-preview V1 records. New records
   * always write the deterministic empty or current mastery state.
   */
  readonly mastery?: MasteryProgressionV1;
}

export function createEmptyMetaProgression(): MetaProgressionV1 {
  return {
    schemaVersion: 1,
    scenarioMedals: {},
    unlockedCosmeticIds: [],
    unlockedTitleIds: [],
    completedContractIds: [],
    mastery: createEmptyMasteryProgression(),
  };
}

/** Migration-safe accessor for Stage 4 meta records with no mastery field. */
export function masteryProgressionFromMeta(
  meta: MetaProgressionV1,
): MasteryProgressionV1 {
  return meta.mastery ?? createEmptyMasteryProgression();
}

export function withMasteryProgression(
  meta: MetaProgressionV1,
  mastery: MasteryProgressionV1,
): MetaProgressionV1 {
  return {
    ...meta,
    mastery,
  };
}

export function acceptMasteryOfferInMeta(
  meta: MetaProgressionV1,
  offer: AvailableMasteryOffer,
  templateId: string,
  acceptedDay: number,
  currentPeriodSequence: number,
): MetaProgressionV1 {
  return withMasteryProgression(
    meta,
    acceptMasteryOffer(
      masteryProgressionFromMeta(meta),
      offer,
      templateId,
      acceptedDay,
      currentPeriodSequence,
    ),
  );
}

export function skipMasteryOfferInMeta(
  meta: MetaProgressionV1,
  offer: AvailableMasteryOffer,
): MetaProgressionV1 {
  return withMasteryProgression(
    meta,
    skipMasteryOffer(masteryProgressionFromMeta(meta), offer),
  );
}

export interface ApplyMasteryMetaDebriefResult {
  readonly meta: MetaProgressionV1;
  readonly outcome?: MasteryContractOutcomeV1;
  readonly rewardGranted: boolean;
}

/** Atomically persists contract progression and any once-only meta reward. */
export function applyMasteryPeriodDebriefToMeta(
  meta: MetaProgressionV1,
  debrief: MasteryPeriodDebrief,
): ApplyMasteryMetaDebriefResult {
  const result = applyMasteryPeriodDebrief(
    masteryProgressionFromMeta(meta),
    meta,
    debrief,
  );
  return {
    meta: withMasteryProgression(result.meta, result.progression),
    ...(result.outcome ? { outcome: result.outcome } : {}),
    rewardGranted: result.rewardGranted,
  };
}

export interface ScenarioSessionState {
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly cashCents: number;
  readonly xp: 0;
  readonly score: number;
  readonly completed: boolean;
}

export function createScenarioSession(
  definition: ScenarioDefinition,
): ScenarioSessionState {
  return {
    scenarioId: definition.id,
    seed: definition.seed,
    cashCents: definition.startingCashCents,
    xp: 0,
    score: 0,
    completed: false,
  };
}

export interface StrategicSaveBundle<MainState> {
  readonly main: MainState;
  readonly scenarios: Readonly<Partial<Record<ScenarioId, ScenarioSessionState>>>;
  readonly meta: MetaProgressionV1;
}

const MEDAL_RANK: Readonly<Record<ScenarioMedal, number>> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

function addUnique(values: readonly string[], value: string): readonly string[] {
  return values.includes(value) ? values : [...values, value].sort(compareIds);
}

export function recordScenarioCompletion<MainState>(
  bundle: StrategicSaveBundle<MainState>,
  definition: ScenarioDefinition,
  session: ScenarioSessionState,
  evaluation: ScenarioEvaluation,
): StrategicSaveBundle<MainState> {
  if (
    session.scenarioId !== definition.id ||
    evaluation.scenarioId !== definition.id
  ) {
    throw new RangeError(
      "Scenario session and validated evaluation must match the definition",
    );
  }
  if (
    evaluation.medal !== undefined &&
    (
      evaluation.metaReward?.scenarioId !== definition.id ||
      evaluation.metaReward.medal !== evaluation.medal
    )
  ) {
    throw new RangeError(
      "Scenario medals require their matching validated meta reward",
    );
  }
  const previousMedal = bundle.meta.scenarioMedals[definition.id];
  const medal = evaluation.medal;
  const bestMedal =
    medal === undefined
      ? previousMedal
      : previousMedal && MEDAL_RANK[previousMedal] > MEDAL_RANK[medal]
        ? previousMedal
        : medal;
  const unlockedCosmeticIds = (
    evaluation.metaReward?.cosmeticIds ?? []
  ).reduce<readonly string[]>(
    (ids, cosmeticId) => addUnique(ids, cosmeticId),
    bundle.meta.unlockedCosmeticIds,
  );
  return {
    main: bundle.main,
    scenarios: {
      ...bundle.scenarios,
      [definition.id]: {
        ...session,
        score: evaluation.score,
        completed: true,
      },
    },
    meta: {
      ...bundle.meta,
      scenarioMedals: bestMedal === undefined
        ? bundle.meta.scenarioMedals
        : {
            ...bundle.meta.scenarioMedals,
            [definition.id]: bestMedal,
          },
      unlockedCosmeticIds,
    },
  };
}

export function recordMasteryCompletion(
  meta: MetaProgressionV1,
  contract: AcceptedMasteryContract,
): MetaProgressionV1 {
  if (meta.completedContractIds.includes(contract.templateId)) {
    return meta;
  }
  return {
    ...meta,
    completedContractIds: addUnique(
      meta.completedContractIds,
      contract.templateId,
    ),
    unlockedCosmeticIds:
      contract.reward.kind === "cosmetic"
        ? addUnique(meta.unlockedCosmeticIds, contract.reward.cosmeticId)
        : meta.unlockedCosmeticIds,
    unlockedTitleIds:
      contract.reward.kind === "title"
        ? addUnique(meta.unlockedTitleIds, contract.reward.titleId)
        : meta.unlockedTitleIds,
  };
}

export function resetMainProgression<MainState>(
  bundle: StrategicSaveBundle<MainState>,
  freshMain: MainState,
): StrategicSaveBundle<MainState> {
  return {
    main: freshMain,
    scenarios: bundle.scenarios,
    meta: bundle.meta,
  };
}

export function eraseAllProgress<MainState>(
  freshMain: MainState,
): StrategicSaveBundle<MainState> {
  return {
    main: freshMain,
    scenarios: {},
    meta: createEmptyMetaProgression(),
  };
}
