import { SERVICE_PERIODS as CORE_SERVICE_PERIODS } from "./servicePeriods";
import type {
  HealthCondition,
  NutritionIntent,
  NutritionRequestResult,
  ProgressionState,
  ServicePeriodId,
  ServicePeriodState,
  SimulationCatalog,
} from "./types";

export interface ForecastServicePeriodDefinition {
  readonly id: ServicePeriodId;
  readonly label: string;
  readonly startHour: number;
  readonly endHour: number;
}

export const FORECAST_SERVICE_PERIODS: readonly ForecastServicePeriodDefinition[] = Object.freeze([
  ...CORE_SERVICE_PERIODS.map((period) => Object.freeze({
    id: period.id,
    label: period.label,
    startHour: period.startMinute / 60,
    endHour: period.endMinute / 60,
  })),
]);

export interface ForecastShare {
  readonly id: string;
  /** Integer basis points. Shares in one distribution are normalized to 10,000. */
  readonly basisPoints: number;
}

export interface ForecastBudgetBand extends ForecastShare {
  readonly minimumCents: number;
  readonly maximumCents: number;
}

export interface ForecastGroupSize extends ForecastShare {
  readonly size: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface ForecastNeed extends ForecastShare {
  readonly kind: "nutrition-intent" | "condition-aware";
  readonly nutritionIntent?: NutritionIntent;
  readonly healthCondition?: HealthCondition;
}

export interface PeriodDemandProfile {
  readonly periodId: ServicePeriodId;
  readonly demandRange: readonly [number, number];
  readonly crowdProfiles: readonly ForecastShare[];
  readonly budgetBands: readonly ForecastBudgetBand[];
  readonly groupSizeMix: readonly ForecastGroupSize[];
  readonly mealMix: readonly ForecastShare[];
  readonly nutritionNeeds: readonly ForecastNeed[];
  /** Independent incidence before selecting from the intent mix. */
  readonly nutritionIntentIncidenceBasisPoints?: number;
  /** Independent incidence before selecting from the condition-aware mix. */
  readonly conditionAwareIncidenceBasisPoints?: number;
}

export interface ForecastModifier {
  /** Applies to demand only. 10,000 is neutral. */
  readonly demandBasisPoints?: number;
  /** Applies to every budget boundary. 10,000 is neutral. */
  readonly budgetBasisPoints?: number;
  readonly crowdProfileBasisPointDeltas?: Readonly<Record<string, number>>;
  readonly groupSizeBasisPointDeltas?: Readonly<Record<string, number>>;
  readonly mealMixBasisPointDeltas?: Readonly<Record<string, number>>;
}

export interface PeriodForecast extends PeriodDemandProfile {
  readonly periodSequenceId: number;
  readonly day: number;
  readonly nutritionIntentIncidenceBasisPoints: number;
  readonly conditionAwareIncidenceBasisPoints: number;
  /** Need shares are conditional mixes, not a claim that every visit has a need. */
  readonly needShareBasis: "among-flagged-needs";
  /** True once the progression-eligible audience is frozen for this period. */
  readonly audienceLocked: boolean;
}

export interface ForecastArrivalObservation {
  readonly periodSequenceId: number;
  readonly customerId: string;
  readonly archetypeId: string;
  readonly budgetCents: number;
  /** Latent visit-size intent until Stage 4 renders atomic parties. */
  readonly groupSize: 1 | 2 | 3 | 4 | 5 | 6;
  readonly mealMixId: string;
  readonly nutritionIntent?: NutritionIntent;
  readonly healthConditions: readonly HealthCondition[];
  readonly nutritionResult?: NutritionRequestResult;
  readonly nutritionIntentResult?: NutritionRequestResult;
  readonly conditionAwareResult?: NutritionRequestResult;
}

export type ForecastDemandResult = "below-range" | "within-range" | "above-range";

export interface ForecastComparison {
  readonly observedArrivals: number;
  readonly demandResult: ForecastDemandResult;
  readonly crowdProfileCounts: Readonly<Record<string, number>>;
  readonly budgetBandCounts: Readonly<Record<string, number>>;
  readonly groupSizeCounts: Readonly<Record<string, number>>;
  readonly mealMixCounts: Readonly<Record<string, number>>;
  readonly nutritionIntentCounts: Readonly<Record<string, number>>;
  readonly conditionAwareCounts: Readonly<Record<string, number>>;
  readonly nutritionMatches: number;
  readonly nutritionMisses: number;
  readonly nutritionUnknowns: number;
  readonly nutritionOutcomeVisits: number;
  readonly intentOutcomeVisits: number;
  readonly intentMatches: number;
  readonly intentMisses: number;
  readonly intentUnknowns: number;
  readonly conditionOutcomeVisits: number;
  readonly conditionMatches: number;
  readonly conditionMisses: number;
  readonly conditionUnknowns: number;
}

export interface ForecastResponse {
  readonly responseId: string;
  readonly needId: string;
  readonly unlocked: boolean;
  readonly viable: boolean;
  readonly active: boolean;
}

export interface ForecastCoverage {
  readonly needId: string;
  readonly viableResponseIds: readonly string[];
  readonly unlockedViableResponseIds: readonly string[];
  readonly covered: boolean;
  readonly eligibleForRequiredContent: boolean;
}

function assertInteger(value: number, label: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer of at least ${minimum}.`);
  }
}

function normalizeShares<T extends ForecastShare>(
  values: readonly T[],
  deltas: Readonly<Record<string, number>> = {},
): readonly T[] {
  if (values.length === 0) return Object.freeze([]);
  const adjusted = values.map((value) => {
    assertInteger(value.basisPoints, `Share ${value.id}`);
    const delta = deltas[value.id] ?? 0;
    if (!Number.isSafeInteger(delta)) {
      throw new Error(`Share delta ${value.id} must be a safe integer.`);
    }
    return Math.max(0, value.basisPoints + delta);
  });
  const total = adjusted.reduce((sum, value) => sum + value, 0);
  if (total === 0) throw new Error("A forecast distribution cannot have zero total weight.");

  const floors = adjusted.map((value) => Math.floor((value * 10_000) / total));
  let remainder = 10_000 - floors.reduce((sum, value) => sum + value, 0);
  const fractions = adjusted
    .map((value, index) => ({
      index,
      fraction: (value * 10_000) % total,
      id: values[index]!.id,
    }))
    .sort((left, right) => right.fraction - left.fraction || left.id.localeCompare(right.id));
  for (let index = 0; index < fractions.length && remainder > 0; index += 1) {
    floors[fractions[index]!.index] += 1;
    remainder -= 1;
  }
  return Object.freeze(values.map((value, index) => Object.freeze({
    ...value,
    basisPoints: floors[index]!,
  })));
}

function scaleInteger(value: number, basisPoints: number): number {
  assertInteger(value, "Forecast value");
  assertInteger(basisPoints, "Forecast multiplier");
  return Math.floor((value * basisPoints + 5_000) / 10_000);
}

/**
 * Pure forecast derivation. It consumes no RNG state and deliberately accepts
 * no menu data, so changing a menu cannot change underlying visit needs.
 */
export function derivePeriodForecast(
  profile: PeriodDemandProfile,
  day: number,
  periodSequenceId: number,
  modifier: ForecastModifier = {},
): PeriodForecast {
  assertInteger(day, "Forecast day", 1);
  assertInteger(periodSequenceId, "Period sequence id", 1);
  const demandBasisPoints = modifier.demandBasisPoints ?? 10_000;
  const budgetBasisPoints = modifier.budgetBasisPoints ?? 10_000;
  assertInteger(demandBasisPoints, "Demand multiplier");
  assertInteger(budgetBasisPoints, "Budget multiplier");
  const nutritionIntentIncidenceBasisPoints = profile.nutritionIntentIncidenceBasisPoints ?? 4_000;
  const conditionAwareIncidenceBasisPoints = profile.conditionAwareIncidenceBasisPoints ?? 4_000;
  assertInteger(nutritionIntentIncidenceBasisPoints, "Nutrition-intent incidence");
  assertInteger(conditionAwareIncidenceBasisPoints, "Condition-aware incidence");
  if (nutritionIntentIncidenceBasisPoints > 10_000 || conditionAwareIncidenceBasisPoints > 10_000) {
    throw new Error("Forecast incidence cannot exceed 10,000 basis points.");
  }
  const [minimumDemand, maximumDemand] = profile.demandRange;
  assertInteger(minimumDemand, "Minimum demand");
  assertInteger(maximumDemand, "Maximum demand", minimumDemand);

  const budgetBands = normalizeShares(
    profile.budgetBands.map((band) => {
      assertInteger(band.minimumCents, `Minimum budget ${band.id}`);
      assertInteger(band.maximumCents, `Maximum budget ${band.id}`, band.minimumCents);
      return {
        ...band,
        minimumCents: scaleInteger(band.minimumCents, budgetBasisPoints),
        maximumCents: scaleInteger(band.maximumCents, budgetBasisPoints),
      };
    }),
  );

  return Object.freeze({
    periodId: profile.periodId,
    periodSequenceId,
    day,
    demandRange: Object.freeze([
      scaleInteger(minimumDemand, demandBasisPoints),
      scaleInteger(maximumDemand, demandBasisPoints),
    ] as const),
    crowdProfiles: normalizeShares(
      profile.crowdProfiles,
      modifier.crowdProfileBasisPointDeltas,
    ),
    budgetBands,
    groupSizeMix: normalizeShares(
      profile.groupSizeMix,
      modifier.groupSizeBasisPointDeltas,
    ),
    mealMix: normalizeShares(profile.mealMix, modifier.mealMixBasisPointDeltas),
    // Needs remain independently authored: crowd/event modifiers cannot alter
    // condition-aware prevalence or infer it from any customer profile.
    nutritionNeeds: Object.freeze([
      ...normalizeShares(profile.nutritionNeeds.filter((need) => need.kind === "nutrition-intent")),
      ...normalizeShares(profile.nutritionNeeds.filter((need) => need.kind === "condition-aware")),
    ]),
    nutritionIntentIncidenceBasisPoints,
    conditionAwareIncidenceBasisPoints,
    needShareBasis: "among-flagged-needs",
    audienceLocked: false,
  });
}

/** Menu-dependent coverage is a separate projection over an immutable forecast. */
export function assessForecastCoverage(
  forecast: PeriodForecast,
  responses: readonly ForecastResponse[],
): readonly ForecastCoverage[] {
  return Object.freeze(forecast.nutritionNeeds.map((need) => {
    const unlockedViableResponseIds = responses
      .filter((response) => (
        response.needId === need.id && response.unlocked && response.viable
      ))
      .map((response) => response.responseId)
      .sort((left, right) => left.localeCompare(right));
    const viableResponseIds = responses
      .filter((response) => (
        response.needId === need.id && response.unlocked && response.viable && response.active
      ))
      .map((response) => response.responseId)
      .sort((left, right) => left.localeCompare(right));
    return Object.freeze({
      needId: need.id,
      viableResponseIds: Object.freeze(viableResponseIds),
      unlockedViableResponseIds: Object.freeze(unlockedViableResponseIds),
      covered: viableResponseIds.length > 0,
      eligibleForRequiredContent: unlockedViableResponseIds.length >= 2,
    });
  }));
}

const CONDITION_NEEDS: readonly ForecastNeed[] = [
  { id: "condition.high-cholesterol", kind: "condition-aware", healthCondition: "high-cholesterol", basisPoints: 1_000 },
  { id: "condition.obesity", kind: "condition-aware", healthCondition: "obesity", basisPoints: 1_000 },
  { id: "condition.diabetes", kind: "condition-aware", healthCondition: "diabetes", basisPoints: 1_000 },
  { id: "condition.hypertension", kind: "condition-aware", healthCondition: "hypertension", basisPoints: 1_000 },
] as const;

function intentNeeds(weights: Readonly<Record<NutritionIntent, number>>): readonly ForecastNeed[] {
  return Object.entries(weights).map(([intent, basisPoints]) => ({
    id: `intent.${intent}`,
    kind: "nutrition-intent" as const,
    nutritionIntent: intent as NutritionIntent,
    basisPoints,
  }));
}

export const DEFAULT_PERIOD_DEMAND_PROFILES: readonly PeriodDemandProfile[] = [
  {
    periodId: "breakfast",
    demandRange: [48, 60],
    crowdProfiles: [
      { id: "customer.early-shift-regular", basisPoints: 5_500 },
      { id: "customer.comfort-seeking-regular", basisPoints: 2_500 },
    ],
    budgetBands: [
      { id: "value", basisPoints: 5_000, minimumCents: 700, maximumCents: 900 },
      { id: "everyday", basisPoints: 4_000, minimumCents: 901, maximumCents: 1_400 },
      { id: "flexible", basisPoints: 1_000, minimumCents: 1_401, maximumCents: 2_400 },
    ],
    groupSizeMix: [
      { id: "solo", size: 1, basisPoints: 5_800 },
      { id: "pair", size: 2, basisPoints: 2_800 },
      { id: "small-group", size: 3, basisPoints: 900 },
      { id: "group-four", size: 4, basisPoints: 400 },
      { id: "group-five", size: 5, basisPoints: 80 },
      { id: "group-six", size: 6, basisPoints: 20 },
    ],
    mealMix: [
      { id: "main-only", basisPoints: 6_200 },
      { id: "main-and-drink", basisPoints: 3_000 },
      { id: "light-bite", basisPoints: 800 },
    ],
    nutritionNeeds: [
      ...intentNeeds({
        "lighter-energy": 1_500,
        "protein-forward": 1_400,
        "fibre-forward": 900,
        "sodium-aware": 1_200,
        "lower-total-sugar-drink": 1_000,
      }),
      ...CONDITION_NEEDS,
    ],
  },
  {
    periodId: "lunch",
    demandRange: [104, 124],
    crowdProfiles: [
      { id: "customer.office-lunch-sprinter", basisPoints: 4_500 },
      { id: "customer.student-saver", basisPoints: 2_500 },
      { id: "customer.family-table", basisPoints: 1_500 },
      { id: "customer.curious-food-explorer", basisPoints: 1_500 },
    ],
    budgetBands: [
      { id: "value", basisPoints: 3_000, minimumCents: 400, maximumCents: 800 },
      { id: "everyday", basisPoints: 5_000, minimumCents: 801, maximumCents: 1_500 },
      { id: "flexible", basisPoints: 2_000, minimumCents: 1_501, maximumCents: 3_000 },
    ],
    groupSizeMix: [
      { id: "solo", size: 1, basisPoints: 3_600 },
      { id: "pair", size: 2, basisPoints: 3_100 },
      { id: "small-group", size: 3, basisPoints: 1_800 },
      { id: "group-four", size: 4, basisPoints: 1_000 },
      { id: "group-five", size: 5, basisPoints: 400 },
      { id: "group-six", size: 6, basisPoints: 100 },
    ],
    mealMix: [
      { id: "main-only", basisPoints: 5_500 },
      { id: "main-and-drink", basisPoints: 2_500 },
      { id: "main-and-side", basisPoints: 2_000 },
    ],
    nutritionNeeds: [
      ...intentNeeds({
        "lighter-energy": 1_000,
        "protein-forward": 1_600,
        "fibre-forward": 1_200,
        "sodium-aware": 1_500,
        "lower-total-sugar-drink": 700,
      }),
      ...CONDITION_NEEDS,
    ],
  },
  {
    periodId: "tea",
    demandRange: [72, 88],
    crowdProfiles: [
      { id: "customer.student-saver", basisPoints: 3_500 },
      { id: "customer.comfort-seeking-regular", basisPoints: 3_000 },
      { id: "customer.family-table", basisPoints: 1_500 },
      { id: "customer.curious-food-explorer", basisPoints: 2_000 },
    ],
    budgetBands: [
      { id: "value", basisPoints: 5_000, minimumCents: 300, maximumCents: 700 },
      { id: "everyday", basisPoints: 4_000, minimumCents: 701, maximumCents: 1_200 },
      { id: "flexible", basisPoints: 1_000, minimumCents: 1_201, maximumCents: 2_400 },
    ],
    groupSizeMix: [
      { id: "solo", size: 1, basisPoints: 4_500 },
      { id: "pair", size: 2, basisPoints: 3_400 },
      { id: "small-group", size: 3, basisPoints: 1_300 },
      { id: "group-four", size: 4, basisPoints: 600 },
      { id: "group-five", size: 5, basisPoints: 150 },
      { id: "group-six", size: 6, basisPoints: 50 },
    ],
    mealMix: [
      { id: "light-bite", basisPoints: 3_500 },
      { id: "drink-led", basisPoints: 4_700 },
      { id: "main-only", basisPoints: 1_800 },
    ],
    nutritionNeeds: [
      ...intentNeeds({
        "lighter-energy": 1_200,
        "protein-forward": 700,
        "fibre-forward": 900,
        "sodium-aware": 800,
        "lower-total-sugar-drink": 2_400,
      }),
      ...CONDITION_NEEDS,
    ],
  },
  {
    periodId: "evening",
    demandRange: [94, 112],
    crowdProfiles: [
      { id: "customer.evening-social-diner", basisPoints: 4_000 },
      { id: "customer.family-table", basisPoints: 2_500 },
      { id: "customer.curious-food-explorer", basisPoints: 2_000 },
      { id: "customer.student-saver", basisPoints: 1_500 },
    ],
    budgetBands: [
      { id: "value", basisPoints: 2_000, minimumCents: 500, maximumCents: 900 },
      { id: "everyday", basisPoints: 5_000, minimumCents: 901, maximumCents: 1_800 },
      { id: "flexible", basisPoints: 3_000, minimumCents: 1_801, maximumCents: 4_800 },
    ],
    groupSizeMix: [
      { id: "solo", size: 1, basisPoints: 2_100 },
      { id: "pair", size: 2, basisPoints: 3_100 },
      { id: "small-group", size: 3, basisPoints: 2_100 },
      { id: "group-four", size: 4, basisPoints: 1_500 },
      { id: "group-five", size: 5, basisPoints: 800 },
      { id: "group-six", size: 6, basisPoints: 400 },
    ],
    mealMix: [
      { id: "main-only", basisPoints: 4_500 },
      { id: "main-and-drink", basisPoints: 2_500 },
      { id: "main-and-side", basisPoints: 3_000 },
    ],
    nutritionNeeds: [
      ...intentNeeds({
        "lighter-energy": 900,
        "protein-forward": 1_500,
        "fibre-forward": 1_200,
        "sodium-aware": 1_600,
        "lower-total-sugar-drink": 800,
      }),
      ...CONDITION_NEEDS,
    ],
  },
] as const;

export function profileForPeriod(
  periodId: ServicePeriodId,
  profiles: readonly PeriodDemandProfile[] = DEFAULT_PERIOD_DEMAND_PROFILES,
): PeriodDemandProfile {
  const profile = profiles.find((candidate) => candidate.periodId === periodId);
  if (!profile) throw new Error(`No forecast profile exists for ${periodId}.`);
  return profile;
}

export function forecastForServicePeriod(
  period: ServicePeriodState,
  profiles: readonly PeriodDemandProfile[] = DEFAULT_PERIOD_DEMAND_PROFILES,
  modifier: ForecastModifier = {},
): PeriodForecast {
  return derivePeriodForecast(
    profileForPeriod(period.periodId, profiles),
    period.day,
    period.sequenceId,
    modifier,
  );
}

export function forecastUnitInterval(key: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

export function sampleForecastShare<T extends ForecastShare>(
  values: readonly T[],
  stableKey: string,
): T {
  if (values.length === 0) throw new Error("Cannot sample an empty forecast distribution.");
  let target = forecastUnitInterval(stableKey) * 10_000;
  for (const value of values) {
    target -= value.basisPoints;
    if (target < 0) return value;
  }
  return values[values.length - 1]!;
}

export function sampleForecastInteger(
  minimum: number,
  maximum: number,
  stableKey: string,
): number {
  assertInteger(minimum, "Forecast sample minimum");
  assertInteger(maximum, "Forecast sample maximum", minimum);
  return minimum + Math.floor(forecastUnitInterval(stableKey) * (maximum - minimum + 1));
}

const AUTHORED_BASE_SPAWN_INTERVAL_MS = 2_500;

/** Menu-neutral interval calibrated to a seeded target inside the frozen range. */
export function forecastArrivalIntervalMs(
  forecast: PeriodForecast,
  configuredSpawnIntervalMs: number,
  arrivalSamplingSeed: number,
): number {
  if (!Number.isFinite(configuredSpawnIntervalMs) || configuredSpawnIntervalMs <= 0) {
    throw new Error("Configured spawn interval must be positive.");
  }
  const target = forecastArrivalTarget(forecast, arrivalSamplingSeed);
  if (target <= 0) return configuredSpawnIntervalMs;
  return (240_000 / target) *
    (configuredSpawnIntervalMs / AUTHORED_BASE_SPAWN_INTERVAL_MS);
}

export function forecastArrivalTarget(
  forecast: PeriodForecast,
  arrivalSamplingSeed: number,
): number {
  assertInteger(arrivalSamplingSeed, "Arrival sampling seed", 1);
  return sampleForecastInteger(
    forecast.demandRange[0],
    forecast.demandRange[1],
    `${arrivalSamplingSeed}:${forecast.periodSequenceId}:demand-target`,
  );
}

export function eligibleForecastAudienceIds(
  catalog: SimulationCatalog,
  progression: ProgressionState,
): readonly string[] {
  return Object.values(catalog.archetypes)
    .filter((archetype) => (
      progression.level >= (archetype.unlockLevel ?? 1) &&
      progression.reputation >= (archetype.unlockReputation ?? 0) &&
      (archetype.unlockPrerequisiteIds ?? []).every((id) => (
        progression.unlockedDefinitionIds.includes(id)
      ))
    ))
    .map((archetype) => archetype.id)
    .sort();
}

/** Freezes the current period's audience; later progression cannot alter it. */
export function lockForecastAudience(
  forecast: PeriodForecast,
  eligibleIds: readonly string[],
): PeriodForecast {
  if (eligibleIds.length === 0) throw new Error("A period forecast requires at least one eligible persona.");
  const eligibleSet = new Set(eligibleIds);
  const authoredEligible = forecast.crowdProfiles.filter((profile) => eligibleSet.has(profile.id));
  const audience = authoredEligible.length > 0
    ? authoredEligible
    : eligibleIds.map((id) => ({ id, basisPoints: 1 }));
  return Object.freeze({
    ...forecast,
    crowdProfiles: normalizeShares(audience),
    audienceLocked: true,
  });
}

/** Freezes the current period's audience; later progression cannot alter it. */
export function lockPeriodForecast(
  forecast: PeriodForecast,
  catalog: SimulationCatalog,
  progression: ProgressionState,
): PeriodForecast {
  return lockForecastAudience(
    forecast,
    eligibleForecastAudienceIds(catalog, progression),
  );
}

function increment(record: Record<string, number>, id: string): void {
  record[id] = (record[id] ?? 0) + 1;
}

export function compareForecastToArrivals(
  forecast: PeriodForecast,
  arrivals: readonly ForecastArrivalObservation[],
): ForecastComparison {
  const crowdProfileCounts: Record<string, number> = {};
  const budgetBandCounts: Record<string, number> = {};
  const groupSizeCounts: Record<string, number> = {};
  const mealMixCounts: Record<string, number> = {};
  const nutritionIntentCounts: Record<string, number> = {};
  const conditionAwareCounts: Record<string, number> = {};
  let nutritionMatches = 0;
  let nutritionMisses = 0;
  let nutritionUnknowns = 0;
  let nutritionOutcomeVisits = 0;
  let intentOutcomeVisits = 0;
  let intentMatches = 0;
  let intentMisses = 0;
  let intentUnknowns = 0;
  let conditionOutcomeVisits = 0;
  let conditionMatches = 0;
  let conditionMisses = 0;
  let conditionUnknowns = 0;
  for (const arrival of arrivals) {
    increment(crowdProfileCounts, arrival.archetypeId);
    const budgetBand = forecast.budgetBands.find(
      (band) => arrival.budgetCents >= band.minimumCents && arrival.budgetCents <= band.maximumCents,
    );
    increment(budgetBandCounts, budgetBand?.id ?? "outside-forecast-bands");
    increment(groupSizeCounts, String(arrival.groupSize));
    increment(mealMixCounts, arrival.mealMixId);
    if (arrival.nutritionIntent) increment(nutritionIntentCounts, arrival.nutritionIntent);
    for (const condition of arrival.healthConditions) increment(conditionAwareCounts, condition);
    if (arrival.nutritionIntentResult !== undefined) intentOutcomeVisits += 1;
    if (arrival.nutritionIntentResult === "matched") intentMatches += 1;
    else if (arrival.nutritionIntentResult === "missed") intentMisses += 1;
    else if (arrival.nutritionIntentResult === "unknown") intentUnknowns += 1;
    if (arrival.conditionAwareResult !== undefined) conditionOutcomeVisits += 1;
    if (arrival.conditionAwareResult === "matched") conditionMatches += 1;
    else if (arrival.conditionAwareResult === "missed") conditionMisses += 1;
    else if (arrival.conditionAwareResult === "unknown") conditionUnknowns += 1;
    if (arrival.nutritionResult !== undefined) nutritionOutcomeVisits += 1;
    if (arrival.nutritionResult === "matched") nutritionMatches += 1;
    else if (arrival.nutritionResult === "missed") nutritionMisses += 1;
    else if (arrival.nutritionResult === "unknown") nutritionUnknowns += 1;
  }
  const [minimum, maximum] = forecast.demandRange;
  return Object.freeze({
    observedArrivals: arrivals.length,
    demandResult: arrivals.length < minimum
      ? "below-range"
      : arrivals.length > maximum
        ? "above-range"
        : "within-range",
    crowdProfileCounts: Object.freeze(crowdProfileCounts),
    budgetBandCounts: Object.freeze(budgetBandCounts),
    groupSizeCounts: Object.freeze(groupSizeCounts),
    mealMixCounts: Object.freeze(mealMixCounts),
    nutritionIntentCounts: Object.freeze(nutritionIntentCounts),
    conditionAwareCounts: Object.freeze(conditionAwareCounts),
    nutritionMatches,
    nutritionMisses,
    nutritionUnknowns,
    nutritionOutcomeVisits,
    intentOutcomeVisits,
    intentMatches,
    intentMisses,
    intentUnknowns,
    conditionOutcomeVisits,
    conditionMatches,
    conditionMisses,
    conditionUnknowns,
  });
}
