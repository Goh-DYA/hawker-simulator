import {
  calculateLevel,
  createPeriodLedger,
  economyWithCompatibilityAliases,
  getUnlockedDefinitionIds,
  objectiveRewardCashCents,
  objectiveRewardXp,
  recordLedgerEntry,
} from "./economy";
import {
  addCents,
  asMoneyCents,
  centsToSgd,
  formatSgd,
  sgdToCents,
  type MoneyCents,
} from "./money";
import { ARRIVAL_PERIOD_MS } from "./servicePeriods";
import type {
  DailyObjective,
  GameState,
  ObjectiveKind,
  SimulationEvent,
  StallDefinition,
  StallMasteryState,
  NutritionObjectiveCriterion,
} from "./types";

/** @deprecated Historical save/test adapter. Live gameplay uses servicePeriod.day. */
export const OPERATING_DAY_MS = 8 * 60 * 1_000;
const OPERATING_START_MINUTE = 10 * 60 + 30;
const MASTERY_RANK_DIVISOR = 100;
const MAX_PERIOD_OBJECTIVE_VISITS = 18;
const MAX_HAPPINESS_OBJECTIVE = 85;

/** @deprecated Live gameplay uses servicePeriod.day. */
export function operatingDay(elapsedMs: number): number {
  return 1 + Math.floor(Math.max(0, elapsedMs) / OPERATING_DAY_MS);
}

/** @deprecated Live gameplay uses servicePeriod.displayedMinute. */
export function operatingMinuteOfDay(elapsedMs: number): number {
  const operatingElapsedMs = Math.max(0, elapsedMs) % OPERATING_DAY_MS;
  return OPERATING_START_MINUTE + Math.floor(operatingElapsedMs / 1_000);
}

export function averageVisitRating(state: Pick<GameState, "metrics">): number | undefined {
  const ratings = state.metrics.visitRatings;
  if (ratings.length === 0) return undefined;
  return ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length;
}

export function masteryRank(points: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, points) / MASTERY_RANK_DIVISOR));
}

export function effectiveStallDefinition(
  state: Pick<GameState, "progression">,
  definitionId: string,
  stall: StallDefinition,
): StallDefinition {
  const level = state.progression.stallMastery[definitionId]?.upgradeLevel ?? 1;
  const upgrade = stall.upgradeLevels?.find((candidate) => candidate.level === level);
  if (!upgrade) return stall;
  return {
    ...stall,
    orderMs: Math.max(100, Math.round(stall.orderMs * upgrade.serviceTimeMultiplier)),
    preparationCapacity: stall.preparationCapacity + upgrade.capacityBonus,
    queueCapacity: stall.queueCapacity + upgrade.capacityBonus,
    quality: Math.min(5, stall.quality + upgrade.qualityBonus),
    menuSlots: (stall.menuSlots ?? stall.dishIds.length) + upgrade.menuSlotsBonus,
  };
}

export function awardStallMastery(
  state: Pick<GameState, "progression">,
  definitionId: string,
  happiness: number,
): GameState["progression"] {
  const current = state.progression.stallMastery[definitionId] ?? {
    points: 0,
    rank: 1,
    upgradeLevel: 1,
  } satisfies StallMasteryState;
  const points = current.points + 10 + Math.round(Math.max(0, Math.min(100, happiness)) / 10);
  return {
    ...state.progression,
    stallMastery: {
      ...state.progression.stallMastery,
      [definitionId]: { ...current, points, rank: masteryRank(points) },
    },
  };
}

function distinctOpenStallTypes(state: GameState): number {
  return new Set(
    Object.values(state.objects)
      .filter((object) => object.open && state.catalog.placeables[object.definitionId]?.kind === "stall")
      .map((object) => object.definitionId),
  ).size;
}

function queueFlowScore(state: GameState): number {
  const counts = Object.values(state.queues).reduce((sum, queue) => sum + queue.length, 0);
  const capacity = Object.values(state.objects).reduce((sum, object) => {
    if (!object.open) return sum;
    const stall = state.catalog.placeables[object.definitionId]?.stall;
    return sum + (stall ? effectiveStallDefinition(state, object.definitionId, stall).queueCapacity : 0);
  }, 0);
  return Math.max(0, Math.min(100, 100 - (counts / Math.max(1, capacity)) * 100));
}

function objective(
  day: number,
  periodSequenceId: number,
  slot: number,
  values: Omit<DailyObjective, "id" | "day" | "progress" | "completed">,
): DailyObjective {
  return {
    id: `period-${periodSequenceId}-${slot}-${values.kind}`,
    day,
    progress: 0,
    completed: false,
    accepted: false,
    ...values,
  };
}

function nutritionObjectiveCriterion(
  state: GameState,
  day: number,
): NutritionObjectiveCriterion {
  if (state.progression.level < 2) return "profiled-servings";
  const preferred: NutritionObjectiveCriterion = [
    "profiled-servings",
    "intent-matches",
    "variant-servings",
  ][(day - 1) % 3] as NutritionObjectiveCriterion;
  const profiles = Object.values(state.objects).flatMap((object) => {
    const stall = state.catalog.placeables[object.definitionId]?.stall;
    if (!object.open || !stall) return [];
    const rank = state.progression.stallMastery[object.definitionId]?.rank ?? 1;
    const dishIds = stall.allDishIds ?? stall.dishIds;
    return dishIds.flatMap((dishId) => {
      const dish = state.catalog.dishes[dishId];
      if (
        !dish ||
        state.progression.level < (dish.unlockLevel ?? 1) ||
        state.progression.reputation < (dish.unlockReputation ?? 0)
      ) return [];
      return dish.nutritionVariants
        ?.filter((variant) => variant.unlockRank <= rank)
        .map((variant) => ({ dish, variant })) ?? [];
    });
  });
  if (preferred === "intent-matches") {
    const hasIntentFit = profiles.some(
      ({ variant }) =>
        variant.profile?.status === "released" &&
        Object.values(variant.profile.intentFits).some((fit) => typeof fit === "number"),
    );
    return hasIntentFit ? preferred : "profiled-servings";
  }
  if (preferred === "variant-servings") {
    const hasAlternative = profiles.some(
      ({ dish, variant }) =>
        variant.profile?.status === "released" &&
        variant.id !== dish.defaultNutritionVariantId,
    );
    return hasAlternative ? preferred : "profiled-servings";
  }
  return preferred;
}

function nutritionObjective(
  state: GameState,
  day: number,
  periodSequenceId: number,
  scale: number,
  limits: ObjectiveFeasibilityLimits,
): DailyObjective | undefined {
  const preferredCriterion = nutritionObjectiveCriterion(state, day);
  const criterion = preferredCriterion === "intent-matches" && limits.intentMatchLimit < 1
    ? "profiled-servings"
    : preferredCriterion === "variant-servings" && limits.variantServingLimit < 1
      ? "profiled-servings"
      : preferredCriterion;
  const values = criterion === "intent-matches"
    ? {
        title: "Read the request",
        target: Math.min(limits.intentMatchLimit, Math.min(6, 2 + Math.floor(scale / 3))),
        startValue: state.metrics.nutrition.intentMatches,
      }
    : criterion === "variant-servings"
      ? {
          title: "Try another recipe",
          target: Math.min(limits.variantServingLimit, Math.min(10, 3 + Math.floor(scale / 2))),
          startValue: state.metrics.nutrition.nonDefaultVariantServings,
        }
      : {
          title: "Read the plate",
          target: Math.min(limits.profiledServingLimit, Math.min(12, 4 + scale)),
          startValue: state.metrics.nutrition.profiledServings,
        };
  if (values.target < 1) return undefined;
  const description = criterion === "intent-matches"
    ? `Match ${values.target} nutrition intents this period.`
    : criterion === "variant-servings"
      ? `Serve ${values.target} reviewed non-default variants this period.`
      : `Serve ${values.target} meals with reviewed nutrition data this period.`;
  return objective(day, periodSequenceId, 3, {
    kind: "nutrition",
    nutritionCriterion: criterion,
    description,
    ...values,
    rewardCashCents: objectiveRewardCashCents(scale),
    rewardCash: centsToSgd(objectiveRewardCashCents(scale)),
    rewardXp: objectiveRewardXp(scale),
  });
}

function setupFallbackObjective(
  state: GameState,
  day: number,
  periodSequenceId: number,
  slot: number,
  scale: number,
  limits: ObjectiveFeasibilityLimits,
  excludedKinds: ReadonlySet<ObjectiveKind> = new Set(),
): DailyObjective {
  const rewardCashCents = objectiveRewardCashCents(scale);
  const rewardCash = centsToSgd(rewardCashCents);
  const rewardXp = objectiveRewardXp(scale);
  if (limits.trayReturnLimit > 0 && !excludedKinds.has("facility")) {
    const target = Math.min(3, limits.trayReturnLimit);
    return objective(day, periodSequenceId, slot, {
      kind: "facility",
      title: "Clear the tables",
      description: `Return ${target} ${target === 1 ? "tray" : "trays"} this period.`,
      target,
      startValue: state.metrics.trayReturns,
      rewardCashCents,
      rewardCash,
      rewardXp,
    });
  }
  if (limits.serviceVisitLimit > 0 && !excludedKinds.has("serve")) {
    const target = Math.min(3, limits.serviceVisitLimit);
    return objective(day, periodSequenceId, slot, {
      kind: "serve",
      title: "Steady service",
      description: `Complete ${target} ${target === 1 ? "served visit" : "served visits"} this period.`,
      target,
      startValue: state.economy.completedVisits,
      rewardCashCents,
      rewardCash,
      rewardXp,
    });
  }
  if (limits.revenueLimitCents > 0 && !excludedKinds.has("revenue")) {
    const target = asMoneyCents(Math.min(limits.revenueLimitCents, sgdToCents(24)));
    return objective(day, periodSequenceId, slot, {
      kind: "revenue",
      title: "Cover the basics",
      description: `Earn ${formatSgd(target)} in gross sales this period.`,
      target,
      startValue: state.economy.lifetimeGrossSalesCents,
      rewardCashCents,
      rewardCash,
      rewardXp,
    });
  }
  if (limits.supportsFiveRatings && !excludedKinds.has("happiness")) {
    return objective(day, periodSequenceId, slot, {
      kind: "happiness",
      title: "A comfortable visit",
      description: "Reach 75% happiness after five new ratings.",
      target: 75,
      startValue: state.metrics.completedCustomers,
      rewardCashCents,
      rewardCash,
      rewardXp,
    });
  }
  if (limits.supportsFlow && !excludedKinds.has("flow")) {
    return objective(day, periodSequenceId, slot, {
      kind: "flow",
      title: "Easy movement",
      description: "Keep flow at 80% or better for 60 seconds with at least three active guests.",
      target: 60_000,
      startValue: 0,
      flowQualifiedMs: 0,
      flowRequiredMs: 60_000,
      flowMinimumActiveGuests: 3,
      rewardCashCents,
      rewardCash,
      rewardXp,
    });
  }
  if (!excludedKinds.has("variety")) {
    return objective(day, periodSequenceId, slot, {
      kind: "variety",
      title: "Ready to serve",
      description: "Operate at least one reachable stall type this period.",
      target: 1,
      startValue: 0,
      rewardCashCents,
      rewardCash,
      rewardXp,
    });
  }
  throw new RangeError("The current setup cannot produce three distinct feasible objectives");
}

export interface ObjectiveFeasibilityLimits {
  /** Conservative number of visits supported by arrivals and the available setup. */
  readonly serviceVisitLimit: number;
  /** Gross sales reachable by serving serviceVisitLimit copies of the cheapest viable dish. */
  readonly revenueLimitCents: MoneyCents;
  readonly supportsFiveRatings: boolean;
  readonly supportsFlow: boolean;
  readonly profiledServingLimit: number;
  readonly intentMatchLimit: number;
  readonly variantServingLimit: number;
  readonly trayReturnLimit: number;
  readonly openStallTypeCount: number;
}

/**
 * Produces deterministic, setup-derived caps for a single 240-second arrivals
 * period. The two-times timing margin prevents authored level scaling from
 * outgrowing the currently available arrival and preparation throughput.
 */
export function objectiveFeasibilityLimits(state: GameState): ObjectiveFeasibilityLimits {
  const placedStalls = Object.values(state.objects)
    .filter((object) => state.catalog.placeables[object.definitionId]?.kind === "stall")
    .sort((left, right) => left.id.localeCompare(right.id));
  const candidateDefinitions = placedStalls.length > 0
    ? placedStalls.map((object) => ({
        instanceId: object.id,
        definitionId: object.definitionId,
      }))
    : Object.values(state.catalog.placeables)
        .filter((definition) => (
          definition.kind === "stall" &&
          (definition.unlockLevel ?? 1) <= state.progression.level
        ))
        // A missing starter stall can be reclaimed by the Stage 1 recovery policy.
        .sort((left, right) => (
          left.priceCents - right.priceCents ||
          left.id.localeCompare(right.id)
        ))
        .slice(0, 1)
        .map((definition) => ({ instanceId: definition.id, definitionId: definition.id }));
  const maxGuestBudgetCents = Object.values(state.catalog.archetypes).reduce(
    (maximum, archetype) => Math.max(maximum, archetype.budgetCents),
    0,
  );
  let preparationLimit = 0;
  let totalQueueCapacity = 0;
  let cheapestDishCents: number | undefined;
  let hasProfiledDish = false;
  let hasIntentFit = false;
  let hasAlternativeVariant = false;
  for (const candidate of candidateDefinitions) {
    const definition = state.catalog.placeables[candidate.definitionId];
    if (!definition?.stall) continue;
    const stall = effectiveStallDefinition(state, candidate.definitionId, definition.stall);
    const dishes = stall.dishIds
      .map((dishId) => state.catalog.dishes[dishId])
      .filter((dish) => Boolean(
        dish &&
        state.progression.level >= (dish.unlockLevel ?? 1) &&
        state.progression.reputation >= (dish.unlockReputation ?? 0) &&
        dish.priceCents <= maxGuestBudgetCents,
      ));
    if (dishes.length === 0) continue;
    const fastestPreparationMs = Math.min(...dishes.map((dish) => dish!.preparationMs));
    const conservativeCycleMs = Math.max(
      state.config.fixedStepMs,
      2 * (stall.orderMs + fastestPreparationMs),
    );
    preparationLimit += Math.max(
      1,
      Math.floor((ARRIVAL_PERIOD_MS * stall.preparationCapacity) / conservativeCycleMs),
    );
    totalQueueCapacity += stall.queueCapacity;
    const masteryRank = state.progression.stallMastery[candidate.definitionId]?.rank ?? 1;
    for (const dish of dishes) {
      if (!dish) continue;
      const priceCents = dish.priceCents;
      cheapestDishCents = Math.min(cheapestDishCents ?? priceCents, priceCents);
      const variants = dish.nutritionVariants?.filter((variant) => variant.unlockRank <= masteryRank) ?? [];
      hasProfiledDish ||= variants.some((variant) => variant.profile?.status === "released");
      hasIntentFit ||= variants.some((variant) => (
        variant.profile?.status === "released" &&
        Object.values(variant.profile.intentFits).some((fit) => typeof fit === "number")
      ));
      hasAlternativeVariant ||= variants.some((variant) => (
        variant.profile?.status === "released" && variant.id !== dish.defaultNutritionVariantId
      ));
    }
  }
  const arrivalLimit = candidateDefinitions.length === 0
    ? 0
    : Math.max(1, Math.floor(ARRIVAL_PERIOD_MS / (state.config.spawnIntervalMs * 2)));
  const serviceVisitLimit = Math.max(
    0,
    Math.min(MAX_PERIOD_OBJECTIVE_VISITS, arrivalLimit, preparationLimit),
  );
  const hasSeat = Object.values(state.objects).some((object) => (
    (state.catalog.placeables[object.definitionId]?.seatPoints?.length ?? 0) > 0
  ));
  const hasTrayReturn = Object.values(state.objects).some((object) => (
    state.catalog.placeables[object.definitionId]?.kind === "tray-return"
  ));
  return {
    serviceVisitLimit,
    revenueLimitCents: asMoneyCents((cheapestDishCents ?? 0) * serviceVisitLimit),
    supportsFiveRatings: serviceVisitLimit >= 5 && hasSeat,
    supportsFlow: serviceVisitLimit >= 3 && totalQueueCapacity >= 3,
    profiledServingLimit: hasProfiledDish ? serviceVisitLimit : 0,
    intentMatchLimit: hasIntentFit
      ? Math.min(serviceVisitLimit, Math.max(1, Math.floor(serviceVisitLimit / 4)))
      : 0,
    variantServingLimit: hasAlternativeVariant ? serviceVisitLimit : 0,
    trayReturnLimit: hasSeat && hasTrayReturn ? serviceVisitLimit : 0,
    openStallTypeCount: distinctOpenStallTypes(state),
  };
}

export function advanceFlowQualification(
  previousMs: number,
  flowScore: number,
  activePeriodGuests: number,
  deltaMs: number,
  minimumGuests = 3,
): number {
  if (![previousMs, flowScore, activePeriodGuests, deltaMs, minimumGuests].every(Number.isFinite)) {
    throw new RangeError("Flow qualification inputs must be finite");
  }
  return flowScore >= 80 && activePeriodGuests >= minimumGuests
    ? Math.max(0, previousMs) + Math.max(0, deltaMs)
    : 0;
}

export function skipDailyObjective(
  objectives: readonly DailyObjective[],
  objectiveId: string,
): readonly DailyObjective[] {
  return objectives.map((item) => item.id === objectiveId && !item.completed
    ? { ...item, accepted: false, skipped: true }
    : item);
}

export function acceptDailyObjective(
  objectives: readonly DailyObjective[],
  objectiveId: string,
): readonly DailyObjective[] {
  if (!objectives.some((item) => item.id === objectiveId && !item.completed && !item.skipped)) {
    throw new RangeError("Objective offer does not exist or is already completed");
  }
  return objectives.map((item) => ({ ...item, accepted: item.id === objectiveId, skipped: item.skipped ?? false }));
}

export function skipDailyObjectives(
  objectives: readonly DailyObjective[],
): readonly DailyObjective[] {
  return objectives.map((item) => item.completed ? item : { ...item, accepted: false, skipped: true });
}

export function createDailyObjectives(
  state: GameState,
  day = state.servicePeriod.day,
  periodSequenceId = state.servicePeriod.sequenceId,
): readonly DailyObjective[] {
  const scale = Math.max(1, state.progression.level);
  const limits = objectiveFeasibilityLimits(state);
  const rewardCashCents = objectiveRewardCashCents(scale);
  const rewardCash = centsToSgd(rewardCashCents);
  const rewardXp = objectiveRewardXp(scale);
  const service = limits.serviceVisitLimit < 1
    ? setupFallbackObjective(state, day, periodSequenceId, 1, scale, limits)
    : day % 2 === 0 && limits.revenueLimitCents > 0
    ? objective(day, periodSequenceId, 1, {
        kind: "revenue",
        title: "A lively service",
        description: `Earn ${formatSgd(asMoneyCents(Math.min(
          limits.revenueLimitCents,
          sgdToCents(Math.round(35 + scale * 8)),
        )))} in gross sales this period.`,
        target: asMoneyCents(Math.min(
          limits.revenueLimitCents,
          sgdToCents(Math.round(35 + scale * 8)),
        )),
        startValue: state.economy.lifetimeGrossSalesCents,
        rewardCashCents,
        rewardCash,
        rewardXp,
      })
    : objective(day, periodSequenceId, 1, {
        kind: "serve",
        title: "Warm welcome",
        description: `Serve ${Math.min(5 + scale * 2, limits.serviceVisitLimit)} neighbours this period.`,
        target: Math.min(5 + scale * 2, limits.serviceVisitLimit),
        startValue: state.economy.completedVisits,
        rewardCashCents,
        rewardCash,
        rewardXp,
      });
  const quality = day % 3 === 0 && limits.supportsFlow
    ? objective(day, periodSequenceId, 2, {
        kind: "flow",
        title: "Easy movement",
        description: "Keep flow at 80% or better for 60 seconds with at least three active guests.",
        target: 60_000,
        startValue: 0,
        flowQualifiedMs: 0,
        flowRequiredMs: 60_000,
        flowMinimumActiveGuests: 3,
        rewardCashCents,
        rewardCash,
        rewardXp,
      })
    : limits.supportsFiveRatings
      ? objective(day, periodSequenceId, 2, {
        kind: "happiness",
        title: "Happy tables",
        description: `Reach ${Math.min(MAX_HAPPINESS_OBJECTIVE, 72 + scale)}% happiness after five new ratings.`,
        target: Math.min(MAX_HAPPINESS_OBJECTIVE, 72 + scale),
        startValue: state.metrics.completedCustomers,
        rewardCashCents,
        rewardCash,
        rewardXp,
      })
      : setupFallbackObjective(
          state,
          day,
          periodSequenceId,
          2,
          scale,
          limits,
          new Set([service.kind]),
        );
  const nutrition = nutritionObjective(state, day, periodSequenceId, scale, limits)
    ?? setupFallbackObjective(
      state,
      day,
      periodSequenceId,
      3,
      scale,
      limits,
      new Set([service.kind, quality.kind]),
    );
  const offers = [service, quality, nutrition] as const;
  if (new Set(offers.map((item) => item.kind)).size !== offers.length) {
    throw new RangeError("Objective offers must use three distinct feasible templates");
  }
  return offers;
}

function objectiveProgress(state: GameState, item: DailyObjective): number {
  switch (item.kind) {
    case "serve": return state.economy.completedVisits - item.startValue;
    case "revenue": return state.economy.lifetimeGrossSalesCents - item.startValue;
    case "happiness": {
      const newRatingCount = state.metrics.completedCustomers - item.startValue;
      if (newRatingCount < 5) return 0;
      const newRatings = state.metrics.visitRatings.slice(-Math.min(50, newRatingCount));
      return newRatings.reduce((sum, rating) => sum + rating.score, 0) / newRatings.length;
    }
    case "flow": return item.flowQualifiedMs ?? 0;
    case "variety": return distinctOpenStallTypes(state);
    case "facility": return state.metrics.trayReturns - item.startValue;
    case "nutrition": {
      if (item.nutritionCriterion === "intent-matches") {
        return state.metrics.nutrition.intentMatches - item.startValue;
      }
      if (item.nutritionCriterion === "variant-servings") {
        return state.metrics.nutrition.nonDefaultVariantServings - item.startValue;
      }
      return state.metrics.nutrition.profiledServings - item.startValue;
    }
  }
}

const MILESTONES = [
  ...[50, 250, 1_000, 5_000].map((target, index) => ({ id: `service-${index + 1}`, tier: index + 1, met: (state: GameState) => state.economy.completedVisits >= target })),
  ...[75, 85, 90, 95].map((target, index) => ({ id: `hospitality-${index + 1}`, tier: index + 1, met: (state: GameState) => state.metrics.visitRatings.length >= 20 && (averageVisitRating(state) ?? 0) >= target })),
  ...[2, 4, 6, 8].map((target, index) => ({ id: `variety-${index + 1}`, tier: index + 1, met: (state: GameState) => distinctOpenStallTypes(state) >= target })),
  ...[3, 7, 12, 20].map((target, index) => ({ id: `growth-${index + 1}`, tier: index + 1, met: (state: GameState) => state.progression.level >= target })),
] as const;

export function metMilestoneIds(state: GameState): readonly string[] {
  return MILESTONES.filter((milestone) => milestone.met(state)).map((milestone) => milestone.id);
}

export function updateProgressionSystems(source: GameState): GameState {
  const day = source.servicePeriod.day;
  const periodSequenceId = source.servicePeriod.sequenceId;
  const activePeriodGuests = Object.values(source.customers).filter(
    (customer) =>
      customer.arrivalPeriodSequenceId === source.servicePeriod.sequenceId,
  ).length;
  const currentFlowScore = queueFlowScore(source);
  const flowQualifies =
    source.servicePeriod.phase === "arrivals" &&
    currentFlowScore >= 80 &&
    activePeriodGuests >= 3;
  let state = flowQualifies
    ? {
        ...source,
        metrics: {
          ...source.metrics,
          qualifyingFlowMs:
            source.metrics.qualifyingFlowMs + source.config.fixedStepMs,
        },
      }
    : source;
  if (state.progression.focusDay !== periodSequenceId || state.progression.dailyObjectives.length !== 3) {
    state = {
      ...state,
      progression: {
        ...state.progression,
        focusDay: periodSequenceId,
        dailyObjectives: createDailyObjectives(state, day, periodSequenceId),
      },
    };
  }
  let cashCents = state.economy.cashCents;
  let objectiveRewardsCents = state.economy.lifetimeObjectiveRewardsCents;
  let milestoneRewardsCents = state.economy.lifetimeMilestoneRewardsCents;
  let xp = state.progression.xp;
  const events: SimulationEvent[] = [...state.events];
  const dailyObjectives = state.progression.dailyObjectives.map((item) => {
    if (item.completed || item.skipped) return item;
    if (item.accepted === false) return item;
    const flowCanQualify = item.kind === "flow" && state.servicePeriod.phase === "arrivals";
    const flowQualifiedMs = item.kind === "flow"
      ? flowCanQualify
        ? advanceFlowQualification(
            item.flowQualifiedMs ?? 0,
            currentFlowScore,
            activePeriodGuests,
            state.config.fixedStepMs,
            item.flowMinimumActiveGuests ?? 3,
          )
        : item.flowQualifiedMs ?? 0
      : item.flowQualifiedMs;
    const progress = Math.max(0, objectiveProgress(state, { ...item, flowQualifiedMs }));
    if (item.kind === "flow" && !flowCanQualify) {
      return { ...item, progress, flowQualifiedMs };
    }
    if (progress < item.target) return { ...item, progress, flowQualifiedMs };
    cashCents = addCents(cashCents, item.rewardCashCents);
    objectiveRewardsCents = addCents(objectiveRewardsCents, item.rewardCashCents);
    xp += item.rewardXp;
    events.push({
      type: "objective-completed",
      tick: state.tick,
      entityId: item.id,
      amount: item.rewardCashCents,
      amountCents: item.rewardCashCents,
      message: item.title,
    });
    return { ...item, progress, flowQualifiedMs, completed: true };
  });
  const claimed = new Set(state.progression.claimedMilestoneIds);
  for (const milestone of MILESTONES) {
    if (claimed.has(milestone.id) || !milestone.met(state)) continue;
    claimed.add(milestone.id);
    const cashReward = sgdToCents(250 * milestone.tier);
    const xpReward = 100 * milestone.tier;
    cashCents = addCents(cashCents, cashReward);
    milestoneRewardsCents = addCents(milestoneRewardsCents, cashReward);
    xp += xpReward;
    events.push({
      type: "milestone-completed",
      tick: state.tick,
      entityId: milestone.id,
      amount: cashReward,
      amountCents: cashReward,
    });
  }
  const nextLevel = Math.max(state.progression.level, calculateLevel(xp));
  return {
    ...state,
    economy: economyWithCompatibilityAliases({
      ...state.economy,
      cashCents,
      lifetimeObjectiveRewardsCents: objectiveRewardsCents,
      lifetimeMilestoneRewardsCents: milestoneRewardsCents,
    }),
    progression: {
      ...state.progression,
      xp,
      level: nextLevel,
      unlockedDefinitionIds: getUnlockedDefinitionIds(
        state.catalog,
        nextLevel,
        state.progression.unlockedDefinitionIds,
      ),
      dailyObjectives,
      claimedMilestoneIds: [...claimed],
    },
    periodLedgers: {
      ...state.periodLedgers,
      [state.servicePeriod.sequenceId]: (() => {
        let ledger = dailyObjectives.reduce((current, item) => {
        const original = state.progression.dailyObjectives.find((candidate) => candidate.id === item.id);
        if (!item.completed || original?.completed) return current;
        return recordLedgerEntry(current, {
          id: `${item.id}-reward`,
          kind: "objective",
          amountCents: item.rewardCashCents,
          tick: state.tick,
          referenceId: item.id,
        });
        }, state.periodLedgers[state.servicePeriod.sequenceId] ?? createPeriodLedger(
          state.servicePeriod.sequenceId,
          state.economy.cashCents,
        ));
        for (const milestone of MILESTONES) {
          if (state.progression.claimedMilestoneIds.includes(milestone.id) || !claimed.has(milestone.id)) continue;
          ledger = recordLedgerEntry(ledger, {
            id: `${milestone.id}-reward`,
            kind: "milestone",
            amountCents: sgdToCents(250 * milestone.tier),
            tick: state.tick,
            referenceId: milestone.id,
          });
        }
        return ledger;
      })(),
    },
    events,
  };
}
