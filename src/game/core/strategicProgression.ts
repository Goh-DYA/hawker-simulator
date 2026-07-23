import {
  MASTERY_CONTRACT_TEMPLATES,
  MAX_NEIGHBOURHOOD_EVENTS_PER_DAY,
  MAX_NEIGHBOURHOOD_EVENTS_PER_PERIOD,
  NEIGHBOURHOOD_EVENTS,
  REGULARS,
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
}

export function isMasteryContractFeasible(
  template: MasteryContractTemplate,
  context: MasteryFeasibilityContext,
): boolean {
  return (
    context.level >= template.unlockLevel &&
    context.openStallCount >= template.feasibility.minimumOpenStalls &&
    context.availableSeatCount >= template.feasibility.minimumSeats &&
    (!template.feasibility.requiresComboBoard || context.comboBoardUnlocked)
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
  return MASTERY_CONTRACT_TEMPLATES.filter((template) =>
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
    .slice(0, 3)
    .map(({ template }) => template);
}

export interface AcceptedMasteryContract {
  readonly templateId: string;
  readonly acceptedDay: number;
  readonly expiresAfterPeriod: number;
  readonly target: MasteryContractTemplate["target"];
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
    expiresAfterPeriod: currentPeriodSequence + template.durationPeriods,
    target: { ...template.target },
    reward: { ...template.reward },
  };
}

export interface MetaProgressionV1 {
  readonly schemaVersion: 1;
  readonly scenarioMedals: Readonly<Partial<Record<ScenarioId, ScenarioMedal>>>;
  readonly unlockedCosmeticIds: readonly string[];
  readonly unlockedTitleIds: readonly string[];
  readonly completedContractIds: readonly string[];
}

export function createEmptyMetaProgression(): MetaProgressionV1 {
  return {
    schemaVersion: 1,
    scenarioMedals: {},
    unlockedCosmeticIds: [],
    unlockedTitleIds: [],
    completedContractIds: [],
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
  medal: ScenarioMedal,
): StrategicSaveBundle<MainState> {
  if (session.scenarioId !== definition.id) {
    throw new RangeError("Scenario session does not match its definition");
  }
  const previousMedal = bundle.meta.scenarioMedals[definition.id];
  const bestMedal =
    previousMedal && MEDAL_RANK[previousMedal] > MEDAL_RANK[medal]
      ? previousMedal
      : medal;
  return {
    main: bundle.main,
    scenarios: {
      ...bundle.scenarios,
      [definition.id]: { ...session, completed: true },
    },
    meta: {
      ...bundle.meta,
      scenarioMedals: {
        ...bundle.meta.scenarioMedals,
        [definition.id]: bestMedal,
      },
      unlockedCosmeticIds: addUnique(
        bundle.meta.unlockedCosmeticIds,
        definition.cosmeticRewardIds[medal],
      ),
    },
  };
}

export function recordMasteryCompletion(
  meta: MetaProgressionV1,
  contract: AcceptedMasteryContract,
): MetaProgressionV1 {
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
