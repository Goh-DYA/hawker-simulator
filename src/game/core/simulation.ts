import {
  awardCompletedVisitXp,
  calculateLevel,
  chargeUpkeep,
  createPeriodLedger,
  getUnlockedDefinitionIds,
  economyWithCompatibilityAliases,
  recordLedgerEntry,
  settleServedComponents,
  settleServedOrder,
} from "./economy";
import { asMoneyCents, centsToSgd } from "./money";
import {
  advanceServicePeriod,
  overtimeUpkeepChargeDue,
  UPKEEP_INTERVAL_MS,
} from "./servicePeriods";
import {
  getBlockedTileKeys,
  getTile,
  getObjectQueueAnchor,
  getObjectOccupiedTiles,
  getObjectTrayReturnPoint,
  getSeatLocations,
  isInBounds,
  isTileWalkable,
  pointKey,
  samePoint,
  type SeatLocation,
} from "./grid";
import { findPath } from "./pathfinding";
import { getCustomerQueueCell, planStallQueueLayouts } from "./queueing";
import { nextFloat } from "./rng";
import { compareIds } from "./ordering";
import {
  forecastArrivalIntervalMs,
  forecastArrivalTarget,
  forecastUnitInterval,
  sampleForecastInteger,
  sampleForecastShare,
} from "./forecast";
import { cloneCustomer, cloneStrategicGameplayState } from "./state";
import { walkingSatisfactionScore } from "./satisfaction";
import {
  activeNutritionVariant,
  bestEnabledNutritionIntentFit,
  bestEnabledPersonalizedHealthRating,
  cloneNutritionMetrics,
  cloneNutritionProfile,
  createEmptyNutritionDayMetrics,
  dishStarRating,
  healthDishChoiceBonus,
  healthImpactFromRating,
  healthPreferenceResultForRating,
  healthStallChoiceBonus,
  NUTRITION_METRICS,
  nutritionIntentFit,
  nutritionDishChoiceBonus,
  nutritionRequestResult,
  nutritionStallChoiceBonus,
  personalizedHealthRating,
} from "./nutrition";
import {
  awardStallMastery,
  effectiveStallDefinition,
  updateProgressionSystems,
} from "./progression";
import {
  createServingTerms,
  snapshotMealOrder,
  snapshotOrderLine,
  type MealOrderSnapshot,
} from "./servingTerms";
import {
  aggregateNutritionProfiles,
  buildUnlockedMealUniverse,
  compareMealBalanceAmongUnlockedOptions,
  exactPreparationId,
  mealComponentsForState,
  resolveComboOffer,
  selectReachableServingPlan,
  servingDistancesForState,
  validateComboBoardForState,
  type MealComponent,
  type MealRole,
} from "./mealComposition";
import {
  adjustedEatingDurationMs,
  getGlobalWayfinding,
  getUtilityInfluence,
  utilitySatisfactionBonus,
} from "./utility";
import {
  findPartySeatAssignment,
  planPartyOrders,
  reservePartySeatsAtomically,
  type PartyDishOption,
  type PartyMemberRequest,
  type SeatCluster,
} from "./parties";
import {
  REGULAR_UNLOCK_LEVEL,
  recordRegularEncounter,
  selectRegularForVisit,
} from "./strategicProgression";
import {
  NEIGHBOURHOOD_EVENTS,
  projectEventModifiers,
  type RegularDefinition,
} from "../../content/strategicGameplay";
import type {
  AdvanceResult,
  Customer,
  CustomerArchetype,
  CustomerStatus,
  DishDefinition,
  GameState,
  GridPoint,
  HealthCondition,
  PlaceableDefinition,
  PlacedObject,
  SimulationEvent,
  SimulationMetrics,
  NutritionIntent,
  NutritionRequestResult,
  NutritionVariant,
  NutritionProfile,
  PartyLifecycleState,
  PartyMemberVisitState,
  SeatPreference,
} from "./types";

interface Draft {
  readonly source: GameState;
  objects: Readonly<Record<string, PlacedObject>>;
  customers: Record<string, Customer>;
  queues: Record<string, readonly string[]>;
  readonly queueCellsByStall: Readonly<Record<string, readonly GridPoint[]>>;
  readonly preferredRouteKeys: ReadonlySet<string>;
  seatReservations: Record<string, string>;
  economy: GameState["economy"];
  progression: GameState["progression"];
  periodLedgers: GameState["periodLedgers"];
  forecastArrivals: GameState["forecastArrivals"];
  strategicGameplay: GameState["strategicGameplay"];
  rngState: number;
  nextCustomerSequence: number;
  spawnCountdownMs: number;
  metrics: SimulationMetrics;
  events: SimulationEvent[];
  tick: number;
}

interface StallRuntime {
  readonly object: PlacedObject;
  readonly definition: PlaceableDefinition;
  readonly queueAnchor: GridPoint;
  readonly queueCells: readonly GridPoint[];
}

interface MoveResult {
  readonly customer: Customer;
  readonly arrived: boolean;
  readonly failed: boolean;
}

const PARTY_SEAT_RETRY_MS = 1_000;
const PARTY_COMPANION_PATIENCE_ALLOWANCE_MS = 10_000;

function createDraft(state: GameState, tick: number): Draft {
  const effectiveCatalog = {
    ...state.catalog,
    placeables: Object.fromEntries(Object.entries(state.catalog.placeables).map(([id, definition]) => [
      id,
      definition.stall
        ? { ...definition, stall: effectiveStallDefinition(state, id, definition.stall) }
        : definition,
    ])),
  };
  return {
    source: state,
    objects: state.objects,
    customers: Object.fromEntries(
      Object.entries(state.customers).map(([id, customer]) => [id, cloneCustomer(customer)]),
    ),
    queues: Object.fromEntries(Object.entries(state.queues).map(([id, queue]) => [id, [...queue]])),
    queueCellsByStall: planStallQueueLayouts(
      state.map,
      state.objects,
      effectiveCatalog,
      [
        ...state.accessPoints.map((point) => point.position),
        ...state.routeGuidePoints,
      ],
    ),
    preferredRouteKeys: new Set(state.routeGuidePoints.map(pointKey)),
    seatReservations: { ...state.seatReservations },
    economy: { ...state.economy },
    progression: {
      ...state.progression,
      unlockedDefinitionIds: [...state.progression.unlockedDefinitionIds],
      dailyObjectives: state.progression.dailyObjectives.map((objective) => ({ ...objective })),
      claimedMilestoneIds: [...state.progression.claimedMilestoneIds],
      stallMastery: Object.fromEntries(Object.entries(state.progression.stallMastery).map(([id, mastery]) => [id, { ...mastery }])),
      firstServedPreparationIds: [...state.progression.firstServedPreparationIds],
    },
    periodLedgers: Object.fromEntries(Object.entries(state.periodLedgers).map(([id, ledger]) => [
      id,
      { ...ledger, entries: ledger.entries.map((entry) => ({ ...entry })) },
    ])),
    forecastArrivals: state.forecastArrivals.map((arrival) => ({
      ...arrival,
      healthConditions: [...arrival.healthConditions],
    })),
    strategicGameplay: cloneStrategicGameplayState(state.strategicGameplay),
    rngState: state.rngState,
    nextCustomerSequence: state.nextCustomerSequence,
    spawnCountdownMs: state.spawnCountdownMs,
    metrics: {
      ...state.metrics,
      visitRatings: state.metrics.visitRatings.map((rating) => ({
        ...rating,
        components: { ...rating.components },
      })),
      nutrition: cloneNutritionMetrics(state.metrics.nutrition),
    },
    events: [],
    tick,
  };
}

function event(draft: Draft, value: Omit<SimulationEvent, "tick">): void {
  draft.events.push({ ...value, tick: draft.tick });
}

function transition(draft: Draft, customer: Customer, status: CustomerStatus): Customer {
  if (customer.status !== status) {
    event(draft, { type: "customer-state-changed", entityId: customer.id, message: `${customer.status} -> ${status}` });
  }
  return {
    ...customer,
    status,
    stateElapsedMs: 0,
    path: [],
    pathIndex: 0,
    movementProgress: 0,
    stuckMs: 0,
  };
}

function getArchetype(draft: Draft, customer: Customer): CustomerArchetype {
  const archetype = draft.source.catalog.archetypes[customer.archetypeId];
  if (!archetype) throw new Error(`Customer ${customer.id} references missing archetype ${customer.archetypeId}`);
  return archetype;
}

function getStall(draft: Draft, stallId: string | undefined): StallRuntime | undefined {
  if (!stallId) return undefined;
  const object = draft.objects[stallId];
  const definition = object ? draft.source.catalog.placeables[object.definitionId] : undefined;
  const queueAnchor = object ? getObjectQueueAnchor(object, draft.source.catalog) : undefined;
  const queueCells = stallId ? draft.queueCellsByStall[stallId] ?? [] : [];
  if (!object || !object.open || definition?.kind !== "stall" || !definition.stall || !queueAnchor || queueCells.length === 0) {
    return undefined;
  }
  return {
    object,
    definition: {
      ...definition,
      stall: effectiveStallDefinition({ progression: draft.progression }, object.definitionId, definition.stall),
    },
    queueAnchor,
    queueCells,
  };
}

function blockedTiles(draft: Draft): ReadonlySet<string> {
  return getBlockedTileKeys(draft.objects, draft.source.catalog);
}

function requestPath(draft: Draft, start: GridPoint, end: GridPoint): readonly GridPoint[] | null {
  const result = findPath(draft.source.map, start, end, {
    blocked: blockedTiles(draft),
    preferred: draft.preferredRouteKeys,
    allowEndBlocked: true,
  });
  draft.metrics = {
    ...draft.metrics,
    pathRequests: draft.metrics.pathRequests + 1,
    pathFailures: draft.metrics.pathFailures + (result.path ? 0 : 1),
  };
  return result.path;
}

function preparePath(customer: Customer, path: readonly GridPoint[]): Customer {
  return {
    ...customer,
    path: path.map((point) => ({ ...point })),
    pathIndex: path.length > 1 ? 1 : path.length,
    movementProgress: 0,
    stuckMs: 0,
  };
}

function pathNeedsRefresh(
  draft: Draft,
  customer: Customer,
  destination: GridPoint,
  blocked: ReadonlySet<string>,
): boolean {
  if (customer.path.length === 0) return true;
  const final = customer.path.at(-1);
  if (!final || !samePoint(final, destination)) return true;
  const next = customer.path[customer.pathIndex];
  if (!next) return !samePoint(customer.position, destination);
  return !isTileWalkable(draft.source.map, next, blocked, destination);
}

function moveToward(draft: Draft, customer: Customer, destination: GridPoint, deltaMs: number): MoveResult {
  if (samePoint(customer.position, destination)) return { customer, arrived: true, failed: false };
  const blocked = blockedTiles(draft);
  let next = customer;
  if (pathNeedsRefresh(draft, next, destination, blocked)) {
    const path = requestPath(draft, customer.position, destination);
    if (!path) {
      next = { ...customer, path: [], pathIndex: 0, stuckMs: customer.stuckMs + deltaMs };
      return { customer: next, arrived: false, failed: next.stuckMs >= draft.source.config.stuckRecoveryMs };
    }
    next = preparePath(customer, path);
  }

  const archetype = getArchetype(draft, next);
  const utility = getUtilityInfluence(draft.objects, draft.source.catalog, next.position);
  let progress =
    next.movementProgress +
    archetype.walkingSpeed * (1 + utility.movementSpeed) * (deltaMs / 1_000);
  let position = next.position;
  let pathIndex = next.pathIndex;
  let completedSteps = 0;
  while (progress >= 1 && pathIndex < next.path.length) {
    const step = next.path[pathIndex] as GridPoint;
    if (!isTileWalkable(draft.source.map, step, blocked, destination)) {
      return {
        customer: {
          ...next,
          position,
          path: [],
          pathIndex: 0,
          movementProgress: 0,
          walkingDistanceTiles: next.walkingDistanceTiles + completedSteps,
          stuckMs: next.stuckMs + deltaMs,
        },
        arrived: false,
        failed: next.stuckMs + deltaMs >= draft.source.config.stuckRecoveryMs,
      };
    }
    position = { ...step };
    pathIndex += 1;
    progress -= 1;
    completedSteps += 1;
  }
  const arrived = samePoint(position, destination);
  return {
    customer: {
      ...next,
      position,
      pathIndex,
      movementProgress: arrived ? 0 : progress,
      walkingDistanceTiles: next.walkingDistanceTiles + completedSteps,
      stuckMs: 0,
    },
    arrived,
    failed: false,
  };
}

function removeFromAllQueues(draft: Draft, customerId: string): void {
  for (const [stallId, queue] of Object.entries(draft.queues)) {
    if (queue.includes(customerId)) draft.queues[stallId] = queue.filter((id) => id !== customerId);
  }
}

function releaseSeat(draft: Draft, customer: Customer): Customer {
  const party = customer.partyId
    ? draft.strategicGameplay.parties[customer.partyId]
    : undefined;
  const seatKeys = party?.seatKeys.length
    ? party.seatKeys
    : customer.reservedSeatKey
      ? [customer.reservedSeatKey]
      : [];
  if (seatKeys.length === 0) return customer;
  for (const seatKey of seatKeys) {
    if (draft.seatReservations[seatKey] === customer.id) {
      delete draft.seatReservations[seatKey];
    }
  }
  if (party) {
    replaceParty(draft, {
      ...party,
      seatKeys: [],
    });
  }
  return { ...customer, reservedSeatKey: undefined };
}

function markRecovery(draft: Draft, customer: Customer, message: string): void {
  draft.metrics = { ...draft.metrics, recoveredTargets: draft.metrics.recoveredTargets + 1 };
  event(draft, { type: "target-recovered", entityId: customer.id, message });
}

function normalizeQuality(value: number): number {
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value * 20));
}

function chooseExit(draft: Draft, customer: Customer) {
  const exits = draft.source.accessPoints.filter((point) => point.kind === "exit");
  const blocked = blockedTiles(draft);
  return exits
    .map((exit) => ({
      exit,
      path: findPath(draft.source.map, customer.position, exit.position, {
        blocked,
        preferred: draft.preferredRouteKeys,
      }).path,
    }))
    .filter((candidate): candidate is { exit: (typeof exits)[number]; path: readonly GridPoint[] } => Boolean(candidate.path))
    .sort((a, b) => a.path.length - b.path.length || compareIds(a.exit.id, b.exit.id))[0]?.exit ?? exits[0];
}

function settleVisitRating(draft: Draft, source: Customer, abandoned: boolean, reason: string): Customer {
  if (source.ratingSettled) return source;
  const archetype = getArchetype(draft, source);
  const supplied = source.ratingFactors ?? {};
  const baseComponents = {
    foodQuality: supplied.foodQuality ?? (source.served ? 70 : 0),
    wait: supplied.wait ?? Math.max(0, Math.min(100, (source.patienceRemainingMs / Math.max(1, archetype.patienceMs)) * 100)),
    value: supplied.value ?? (source.served ? 70 : 20),
    walking: supplied.walking ?? walkingSatisfactionScore(source.walkingDistanceTiles),
    comfort: supplied.comfort ?? (source.served ? 65 : 20),
    cleanliness: supplied.cleanliness ?? 70,
    ambience: supplied.ambience ?? 65,
  };
  const modifiers =
    source.satisfactionModifiers ?? archetype.satisfactionModifiers;
  const adjusted = (value: number, modifier = 0) =>
    Math.max(0, Math.min(100, value * (1 + Math.max(-0.35, Math.min(0.35, modifier)))));
  const varietySignal = (source.servedStallDefinitionIds?.length ?? 0) > 1
    ? 1
    : source.orderLineSnapshot?.explanationCodes.includes("non-default-preparation")
      ? 0.5
      : 0;
  const components = {
    ...baseComponents,
    foodQuality: adjusted(
      baseComponents.foodQuality,
      (modifiers?.variety ?? 0) * varietySignal,
    ),
    wait: adjusted(baseComponents.wait, modifiers?.speed),
    value: adjusted(baseComponents.value, modifiers?.value),
    comfort: adjusted(baseComponents.comfort, modifiers?.comfort),
    cleanliness: adjusted(
      baseComponents.cleanliness,
      modifiers?.cleanliness,
    ),
  };
  let score =
    components.foodQuality * 0.3 +
    components.wait * 0.2 +
    components.value * 0.15 +
    components.walking * 0.1 +
    components.comfort * 0.1 +
    components.cleanliness * 0.1 +
    components.ambience * 0.05;
  if (abandoned) score = Math.min(source.served ? 62 : 45, score - (source.served ? 12 : 28));
  score = Math.round(Math.max(0, Math.min(100, score)));
  const rating = {
    customerId: source.id,
    walkingMetricVersion: 2 as const,
    score,
    served: source.served,
    abandoned,
    reason,
    stallDefinitionId: source.servedStallDefinitionId,
    components,
    waitMs: source.waitElapsedMs ?? 0,
    day: draft.source.servicePeriod.day,
    arrivalPeriodSequenceId: source.arrivalPeriodSequenceId,
  };
  draft.metrics = { ...draft.metrics, visitRatings: [...draft.metrics.visitRatings, rating].slice(-50) };
  if (abandoned) draft.economy = { ...draft.economy, abandonedVisits: draft.economy.abandonedVisits + 1 };
  const reputation = Math.max(0, Math.min(5, draft.progression.reputation + (score - 70) / 500));
  draft.progression = { ...draft.progression, reputation };
  if (source.served) {
    const servedStallDefinitionIds = [...new Set([
      ...(source.servedStallDefinitionIds ?? []),
      ...(source.servedStallDefinitionId ? [source.servedStallDefinitionId] : []),
    ])].sort(compareIds);
    for (const definitionId of servedStallDefinitionIds) {
      draft.progression = awardStallMastery(
        { progression: draft.progression },
        definitionId,
        score,
      );
    }
  }
  return { ...source, satisfaction: score / 20, ratingSettled: true };
}

/** Awards normal visit XP only after all visit satisfaction factors are final. */
function awardFinalCompletedVisitXp(draft: Draft, source: Customer): Customer {
  if (!source.served) return source;
  const firstServeBonusXp = source.firstServeBonusXp ?? (source.firstServeBonusAwarded ? 2 : 0);
  // V5 live visits always persist the handover amount. An absent amount denotes
  // a legacy in-flight visit whose XP was already settled at handover.
  if (source.awardedVisitXp === undefined || source.awardedVisitXp > firstServeBonusXp) {
    return source;
  }
  const update = awardCompletedVisitXp(draft.progression, source.satisfaction * 20);
  draft.progression = {
    ...update.progression,
    unlockedDefinitionIds: getUnlockedDefinitionIds(
      draft.source.catalog,
      update.progression.level,
      update.progression.unlockedDefinitionIds,
    ),
  };
  if (update.levelUp) {
    event(draft, {
      type: "level-up",
      entityId: source.id,
      message: String(update.progression.level),
    });
  }
  return {
    ...source,
    awardedVisitXp: source.awardedVisitXp + update.xpAwarded,
  };
}

function beginExit(draft: Draft, source: Customer, abandoned: boolean): Customer {
  let customer = releaseSeat(draft, source);
  removeFromAllQueues(draft, customer.id);
  const party = partyForCustomer(draft, customer);
  if (party) {
    replaceParty(draft, {
      ...party,
      phase: "departing",
      nextStopIndex: party.stallIds.length,
      seatKeys: [],
    });
  }
  const targetExit = chooseExit(draft, customer);
  customer = transition(draft, customer, "walking-to-exit");
  customer = {
    ...customer,
    targetStallId: undefined,
    orderedDishId: customer.orderedDishId,
    reservedSeatKey: undefined,
    targetTrayReturnId: undefined,
    targetExitId: targetExit?.id,
    satisfaction: abandoned ? Math.max(0, customer.satisfaction - 1) : customer.satisfaction,
  };
  return customer;
}

function openStalls(draft: Draft): readonly StallRuntime[] {
  return Object.values(draft.objects)
    .sort((a, b) => compareIds(a.id, b.id))
    .map((object) => getStall(draft, object.id))
    .filter((stall): stall is StallRuntime => Boolean(stall));
}

const OFF_SCHEDULE_PERSONA_WEIGHT = 0.2;

function needFromIncidenceRoll<T extends NutritionIntent | HealthCondition>(
  roll: number,
  incidenceBasisPoints: number,
  weightedIds: readonly { readonly id: string; readonly basisPoints: number }[],
): T | undefined {
  const incidence = incidenceBasisPoints / 10_000;
  if (roll >= incidence || weightedIds.length === 0) return undefined;
  const total = weightedIds.reduce((sum, entry) => sum + entry.basisPoints, 0);
  if (total <= 0) return undefined;
  let target = (roll / incidence) * total;
  for (const entry of weightedIds) {
    target -= entry.basisPoints;
    if (target < 0) return entry.id as T;
  }
  return weightedIds[weightedIds.length - 1]?.id as T | undefined;
}

function recordIntentRequest(draft: Draft, intent: NutritionIntent | undefined): void {
  if (!intent) return;
  const current = draft.metrics.nutrition;
  const day = draft.source.servicePeriod.day;
  const today = current.today.day === day
    ? current.today
    : createEmptyNutritionDayMetrics(day);
  draft.metrics = {
    ...draft.metrics,
    nutrition: {
      ...current,
      intentRequests: current.intentRequests + 1,
      byIntent: {
        ...current.byIntent,
        [intent]: {
          ...current.byIntent[intent],
          requests: current.byIntent[intent].requests + 1,
        },
      },
      today: {
        ...today,
        intentRequests: today.intentRequests + 1,
        byIntent: {
          ...today.byIntent,
          [intent]: {
            ...today.byIntent[intent],
            requests: today.byIntent[intent].requests + 1,
          },
        },
      },
    },
  };
}

export function customerArchetypeSpawnWeight(
  archetype: CustomerArchetype,
  level: number,
  reputation: number,
  displayedMinute: number,
  unlockedDefinitionIds: readonly string[] = [],
): number {
  if (
    level < (archetype.unlockLevel ?? 1) ||
    reputation < (archetype.unlockReputation ?? 0) ||
    (archetype.unlockPrerequisiteIds ?? []).some(
      (id) => !unlockedDefinitionIds.includes(id),
    )
  ) {
    return 0;
  }
  if (!archetype.visitSchedule) return 1;

  const hour = displayedMinute / 60;
  const isScheduled =
    hour >= archetype.visitSchedule.startHour &&
    hour < archetype.visitSchedule.endHour;
  return isScheduled
    ? archetype.visitSchedule.peakMultiplier
    : OFF_SCHEDULE_PERSONA_WEIGHT;
}

export interface SampledPreferenceTagAdjustments {
  readonly addedTags: readonly string[];
  readonly suppressedTags: readonly string[];
}

/**
 * Converts authored percentage-point deltas into a keyed per-visit adjustment.
 * Reusing the same roll for one tag makes a +24pp audience a strict subset of
 * the corresponding +34pp audience without consuming the simulation RNG.
 */
export function samplePreferenceTagAdjustments(
  basisPointDeltas: Readonly<Record<string, number>>,
  samplingKey: string,
): SampledPreferenceTagAdjustments {
  const addedTags: string[] = [];
  const suppressedTags: string[] = [];
  for (const [tag, basisPointDelta] of Object.entries(basisPointDeltas).sort(
    ([left], [right]) => compareIds(left, right),
  )) {
    if (
      !Number.isSafeInteger(basisPointDelta) ||
      basisPointDelta < -10_000 ||
      basisPointDelta > 10_000
    ) {
      throw new RangeError(
        `Preference-tag delta for ${tag} must be integer basis points from -10,000 to 10,000.`,
      );
    }
    if (
      basisPointDelta === 0 ||
      forecastUnitInterval(`${samplingKey}:event-preference:${tag}`) * 10_000 >=
        Math.abs(basisPointDelta)
    ) {
      continue;
    }
    (basisPointDelta > 0 ? addedTags : suppressedTags).push(tag);
  }
  return { addedTags, suppressedTags };
}

function currentEventPreferenceAdjustments(
  draft: Draft,
  samplingKey: string,
): SampledPreferenceTagAdjustments {
  const occurrence = draft.strategicGameplay.neighbourhoodEvents.current;
  if (
    !occurrence ||
    occurrence.periodSequenceId !== draft.source.servicePeriod.sequenceId ||
    occurrence.periodId !== draft.source.servicePeriod.periodId
  ) {
    return { addedTags: [], suppressedTags: [] };
  }
  const definition = NEIGHBOURHOOD_EVENTS.find(
    (event) => event.id === occurrence.eventId,
  );
  if (!definition) return { addedTags: [], suppressedTags: [] };
  const projected = projectEventModifiers(
    definition,
    occurrence.dismissed ? undefined : occurrence.selectedChoiceId,
  );
  return samplePreferenceTagAdjustments(
    projected.preferenceTagBasisPointDeltas,
    `${samplingKey}:${occurrence.eventId}`,
  );
}

function reachablePartyDishOptions(
  draft: Draft,
  origin: GridPoint,
  includeInactive = false,
): readonly PartyDishOption[] {
  return openStalls(draft).flatMap((stall) => {
    const queue = draft.queues[stall.object.id] ?? [];
    const queueCell = stall.queueCells[queue.length];
    if (!queueCell || !requestPath(draft, origin, queueCell)) return [];
    const activeDishIds = stall.definition.stall?.dishIds ?? [];
    const dishIds = includeInactive
      ? stall.definition.stall?.allDishIds ?? activeDishIds
      : activeDishIds;
    return dishIds.flatMap((dishId) => {
      const dish = draft.source.catalog.dishes[dishId];
      return dish
        ? [{
            dishId,
            stallId: stall.object.id,
            priceCents: dish.priceCents,
            available: includeInactive || activeDishIds.includes(dishId),
          }]
        : [];
    });
  });
}

function preferredPartyDishes(
  draft: Draft,
  budgetCents: number,
  nutritionIntentId: NutritionIntent | undefined,
  healthConditions: readonly HealthCondition[],
  preferenceTags: readonly string[],
): readonly string[] {
  const preferredTags = new Set(preferenceTags);
  return Object.values(draft.source.catalog.dishes)
    .filter((dish) => dish.priceCents <= budgetCents)
    .map((dish) => {
      const tagMatches = (dish.preferenceTags ?? []).filter(
        (tag) => preferredTags.has(tag),
      ).length;
      const intentFit = nutritionIntentFit(dish, nutritionIntentId) ?? 0;
      const conditionRating =
        personalizedHealthRating(
          activeNutritionVariant(dish)?.profile,
          healthConditions,
        ) ?? 1;
      return {
        dish,
        score:
          tagMatches * 10 +
          intentFit * 5 +
          conditionRating +
          dishStarRating(dish) -
          dish.priceCents / Math.max(1, budgetCents),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || compareIds(left.dish.id, right.dish.id),
    )
    .map(({ dish }) => dish.id);
}

function memberBudgetCents(
  draft: Draft,
  arrivalKey: string,
  spendMultiplier: number,
  authoredBandCents?: readonly [number, number],
) {
  const band = authoredBandCents
    ? {
        minimumCents: authoredBandCents[0],
        maximumCents: authoredBandCents[1],
      }
    : sampleForecastShare(
        draft.source.forecast.budgetBands,
        `${arrivalKey}:budget-band`,
      );
  const sampled = sampleForecastInteger(
    band.minimumCents,
    band.maximumCents,
    `${arrivalKey}:budget-cents`,
  );
  const shifted = Math.round(sampled * spendMultiplier);
  return asMoneyCents(
    Math.max(band.minimumCents, Math.min(band.maximumCents, shifted)),
  );
}

function regularGroupSize(
  regular: RegularDefinition,
  arrivalKey: string,
): number {
  return sampleForecastShare(
    Object.entries(regular.groupSizeWeightsBasisPoints).map(
      ([size, basisPoints]) => ({
        id: `regular-group-${size}`,
        size: Number(size),
        basisPoints,
      }),
    ),
    `${arrivalKey}:regular-group-size`,
  ).size;
}

function sampledMemberNeeds(
  draft: Draft,
  arrivalKey: string,
): {
  readonly nutritionIntentId?: NutritionIntent;
  readonly healthConditions: readonly HealthCondition[];
} {
  const healthCondition = needFromIncidenceRoll<HealthCondition>(
    forecastUnitInterval(`${arrivalKey}:condition`),
    draft.source.forecast.conditionAwareIncidenceBasisPoints,
    draft.source.forecast.nutritionNeeds
      .filter((need) => need.kind === "condition-aware")
      .map((need) => ({
        id: need.healthCondition!,
        basisPoints: need.basisPoints,
      })),
  );
  const nutritionIntentId = needFromIncidenceRoll<NutritionIntent>(
    forecastUnitInterval(`${arrivalKey}:intent`),
    draft.source.forecast.nutritionIntentIncidenceBasisPoints,
    draft.source.forecast.nutritionNeeds
      .filter((need) => need.kind === "nutrition-intent")
      .map((need) => ({
        id: need.nutritionIntent!,
        basisPoints: need.basisPoints,
      })),
  );
  return {
    nutritionIntentId,
    healthConditions: healthCondition ? [healthCondition] : [],
  };
}

function spawnCustomer(draft: Draft, remainingGuestTarget: number): void {
  const archetypes = Object.values(draft.source.catalog.archetypes).sort((a, b) => compareIds(a.id, b.id));
  if (archetypes.length === 0 || openStalls(draft).length === 0) return;
  const firstSequence = draft.nextCustomerSequence;
  const id = `customer-${firstSequence}`;
  const arrivalKey = `${draft.source.arrivalSamplingSeed}:${draft.source.forecast.periodSequenceId}:${id}`;
  const archetypesById = new Map(archetypes.map((archetype) => [archetype.id, archetype]));
  const forecastAudience = draft.source.forecast.crowdProfiles.filter(
    (profile) => archetypesById.has(profile.id),
  );
  const audience = forecastAudience.length > 0
    ? forecastAudience
    : archetypes.map((archetype) => ({ id: archetype.id, basisPoints: 1 }));
  const crowdProfile = sampleForecastShare(audience, `${arrivalKey}:crowd`);
  const selectedArchetype = archetypesById.get(crowdProfile.id) ?? archetypes[0];
  if (!selectedArchetype) return;
  const authoredRegularsAvailable =
    draft.source.progression.level >= REGULAR_UNLOCK_LEVEL;
  const regular = authoredRegularsAvailable
    ? selectRegularForVisit({
        seed: draft.source.arrivalSamplingSeed,
        day: draft.source.servicePeriod.day,
        periodId: draft.source.servicePeriod.periodId,
        arrivalSequenceId: firstSequence,
        progress: draft.strategicGameplay.regularProgress,
      })
    : undefined;
  const entrances = draft.source.accessPoints.filter((point) => point.kind === "entrance");
  const entrance = [...entrances].sort((a, b) => {
    const nearbyA = Object.values(draft.customers).filter((customer) => Math.abs(customer.position.x - a.position.x) + Math.abs(customer.position.y - a.position.y) <= 3).length;
    const nearbyB = Object.values(draft.customers).filter((customer) => Math.abs(customer.position.x - b.position.x) + Math.abs(customer.position.y - b.position.y) <= 3).length;
    return nearbyA - nearbyB || compareIds(a.id, b.id);
  })[0];
  if (!entrance) return;
  const forecastGroup = sampleForecastShare(
    draft.source.forecast.groupSizeMix,
    `${arrivalKey}:group-size`,
  );
  // Catalogues created before party gameplay omitted this field. Keep those
  // archetypes singleton-only; party sizes are enabled only when authored.
  const [minimumGroupSize, maximumGroupSize] =
    selectedArchetype.groupSizeRange ?? [1, 1];
  const plannedGroupSize = Math.max(1, Math.min(
    remainingGuestTarget,
    6,
    regular
      ? regularGroupSize(regular, arrivalKey)
      : Math.min(
          maximumGroupSize,
          Math.max(minimumGroupSize, forecastGroup.size),
        ),
  ));
  const memberIds = Array.from(
    { length: plannedGroupSize },
    (_, index) => `customer-${firstSequence + index}`,
  );
  const singleOptions = reachablePartyDishOptions(draft, entrance.position);
  const memberDrafts = memberIds.map((memberId, memberIndex) => {
    const memberKey = `${draft.source.arrivalSamplingSeed}:${draft.source.forecast.periodSequenceId}:${memberId}`;
    const memberCrowd = memberIndex === 0
      ? crowdProfile
      : sampleForecastShare(audience, `${memberKey}:crowd`);
    const memberArchetype =
      archetypesById.get(memberCrowd.id) ?? selectedArchetype;
    const needs = sampledMemberNeeds(draft, memberKey);
    const spendMultiplier = memberIndex === 0 && regular
      ? regular.spendMultiplierBasisPoints / 10_000
      : memberArchetype.spendMultiplier ?? 1;
    const budgetCents = memberBudgetCents(
      draft,
      memberKey,
      spendMultiplier,
      memberIndex === 0 && regular
        ? regular.budgetBandCents
        : undefined,
    );
    const eventPreferenceAdjustments = currentEventPreferenceAdjustments(
      draft,
      memberKey,
    );
    const suppressedPreferenceTags = new Set(
      eventPreferenceAdjustments.suppressedTags,
    );
    const extraTags = [
      ...(memberIndex === 0 && regular ? regular.preferenceTags : []),
      ...eventPreferenceAdjustments.addedTags,
    ].filter((tag, index, values) =>
      !suppressedPreferenceTags.has(tag) && values.indexOf(tag) === index
    ).sort(compareIds);
    const effectivePreferenceTags = [
      ...(memberArchetype.preferenceTags ?? []),
      ...extraTags,
    ].filter((tag, index, values) =>
      !suppressedPreferenceTags.has(tag) && values.indexOf(tag) === index
    ).sort(compareIds);
    const mealMix = sampleForecastShare(
      draft.source.forecast.mealMix,
      `${memberKey}:meal-mix`,
    );
    const preferredDishIds = preferredPartyDishes(
      draft,
      budgetCents,
      needs.nutritionIntentId,
      needs.healthConditions,
      effectivePreferenceTags,
    );
    const trayReturnChance = memberIndex === 0 && regular
      ? regular.trayReturnProbabilityBasisPoints / 10_000
      : memberArchetype.trayReturnChance ?? 1;
    return {
      memberId,
      memberArchetype,
      budgetCents,
      needs,
      mealMix,
      preferredDishIds,
      extraTags,
      seatPreference:
        memberIndex === 0 && regular
          ? regular.seatPreference
          : memberArchetype.seatPreference,
      satisfactionModifiers:
        memberIndex === 0 && regular
          ? { ...regular.satisfactionModifiers }
          : memberArchetype.satisfactionModifiers
            ? { ...memberArchetype.satisfactionModifiers }
            : undefined,
      trayReturnPlanned:
        forecastUnitInterval(`${memberKey}:tray-return`) < trayReturnChance,
    };
  });
  const requests: readonly PartyMemberRequest[] = memberDrafts.map((member) => ({
    memberId: member.memberId,
    budgetCents: member.budgetCents,
    visitNeedIds: [
      ...(member.needs.nutritionIntentId
        ? [`intent.${member.needs.nutritionIntentId}`]
        : []),
      ...member.needs.healthConditions.map((condition) => `condition.${condition}`),
    ],
    preferredDishIds: member.preferredDishIds,
  }));
  const comboOptions = memberDrafts.flatMap((member) =>
    comboChoicesForContext(
      draft,
      entrance.position,
      {
        id: member.memberId,
        arrivalPeriodSequenceId: draft.source.servicePeriod.sequenceId,
        forecastMealMixId: member.mealMix.id,
        budgetCents: member.budgetCents,
        spentCents: 0,
        nutritionIntentId: member.needs.nutritionIntentId,
        healthConditions: member.needs.healthConditions,
        archetype: member.memberArchetype,
      },
    ).map((choice) => ({
      memberId: member.memberId,
      dishId: choice.main.dishId,
      stallId: choice.snapshot.servingPlan.stops[0]!.stallInstanceId,
      stallIds: choice.snapshot.servingPlan.stops.map(
        (stop) => stop.stallInstanceId,
      ),
      priceCents: choice.priceCents,
      available: true,
      mealOfferId: choice.snapshot.offerId,
      preparationIds: choice.snapshot.lines.map(
        (line) => line.orderLine.preparationId!,
      ) as [string, string],
      preferencePriority: 1,
    } satisfies PartyDishOption)),
  );
  const plan = plannedGroupSize > 1
    ? planPartyOrders(requests, [...singleOptions, ...comboOptions])
    : undefined;
  const authoredSingleOptions = reachablePartyDishOptions(
    draft,
    entrance.position,
    true,
  );
  const authoredComboOptions = memberDrafts.flatMap((member) =>
    comboChoicesForContext(
      draft,
      entrance.position,
      {
        id: member.memberId,
        arrivalPeriodSequenceId: draft.source.servicePeriod.sequenceId,
        forecastMealMixId: member.mealMix.id,
        budgetCents: member.budgetCents,
        spentCents: 0,
        nutritionIntentId: member.needs.nutritionIntentId,
        healthConditions: member.needs.healthConditions,
        archetype: member.memberArchetype,
      },
      true,
    ).map((choice) => ({
      memberId: member.memberId,
      dishId: choice.main.dishId,
      stallId: choice.snapshot.servingPlan.stops[0]!.stallInstanceId,
      stallIds: choice.snapshot.servingPlan.stops.map(
        (stop) => stop.stallInstanceId,
      ),
      priceCents: choice.priceCents,
      available: true,
      mealOfferId: choice.snapshot.offerId,
      preparationIds: choice.snapshot.lines.map(
        (line) => line.orderLine.preparationId!,
      ) as [string, string],
      preferencePriority: 1,
    } satisfies PartyDishOption)),
  );
  const authoredPlan = plannedGroupSize > 1 && !plan?.accepted
    ? planPartyOrders(
        requests,
        [...authoredSingleOptions, ...authoredComboOptions],
      )
    : undefined;
  const isParty = plannedGroupSize > 1;
  const activeMembers = memberDrafts;
  const actualGroupSize = activeMembers.length;
  const authoredCandidatePlan = plan?.accepted
    ? plan
    : authoredPlan?.accepted
      ? authoredPlan
      : undefined;
  const pendingFallbackOptions: readonly PartyDishOption[] = openStalls(draft).flatMap((stall) =>
    (stall.definition.stall?.dishIds ?? []).flatMap((dishId) => {
      const dish = draft.source.catalog.dishes[dishId];
      return dish
        ? [{
            dishId,
            stallId: stall.object.id,
            priceCents: dish.priceCents,
            available: true,
          } satisfies PartyDishOption]
        : [];
    }),
  ).sort(
    (left, right) =>
      compareIds(left.stallId, right.stallId) ||
      compareIds(left.dishId, right.dishId),
  );
  const deferredSingleMealPlan = isParty && !plan?.accepted
    ? planPartyOrders(requests, pendingFallbackOptions)
    : undefined;
  const activePlan = plan?.accepted
    ? plan
    : deferredSingleMealPlan?.accepted
      ? deferredSingleMealPlan
      : authoredCandidatePlan;
  const activePlanAvailable = Boolean(
    plan?.accepted || deferredSingleMealPlan?.accepted,
  );
  if (isParty && !activePlan && pendingFallbackOptions.length === 0) return;
  const leader = activeMembers[0]!;
  draft.nextCustomerSequence += actualGroupSize;
  if (regular) {
    const previous = draft.strategicGameplay.regularProgress[regular.id];
    const regularProgress = recordRegularEncounter(
      draft.strategicGameplay.regularProgress,
      regular.id,
      draft.source.servicePeriod.day,
    );
    draft.strategicGameplay = {
      ...draft.strategicGameplay,
      regularProgress,
    };
    const next = regularProgress[regular.id];
    if ((next?.storyStep ?? 0) > (previous?.storyStep ?? 0)) {
      event(draft, {
        type: "regular-story",
        entityId: id,
        message: `${regular.id}:${next!.storyStep}`,
      });
    }
  }
  const partyId = isParty
    ? `party-${draft.source.servicePeriod.sequenceId}-${firstSequence}`
    : undefined;
  if (partyId) {
    const members: readonly PartyMemberVisitState[] = activeMembers.map(
      (member) => {
        const order = activePlan?.orders.find(
          (candidate) => candidate.memberId === member.memberId,
        ) ?? pendingFallbackOptions.find(
          (candidate) =>
            member.preferredDishIds.includes(candidate.dishId) &&
            candidate.priceCents <= member.budgetCents,
        ) ?? pendingFallbackOptions[0]!;
        return {
          memberId: member.memberId,
          archetypeId: member.memberArchetype.id,
          budgetCents: member.budgetCents,
          nutritionIntentId: member.needs.nutritionIntentId,
          healthConditions: [...member.needs.healthConditions],
          plannedStallId: order.stallId,
          plannedDishId: order.dishId,
          plannedStallIds: [...(order.stallIds ?? [order.stallId])],
          plannedMealOfferId: order.mealOfferId,
          plannedPreparationIds: order.preparationIds
            ? [...order.preparationIds] as [string, string]
            : undefined,
          seatPreference: member.seatPreference,
          satisfactionModifiers: member.satisfactionModifiers
            ? { ...member.satisfactionModifiers }
            : undefined,
          trayReturnPlanned: member.trayReturnPlanned,
          served: false,
          satisfaction: 3,
          awardedVisitXp: 0,
          firstServeBonusXp: 0,
          spentCents: asMoneyCents(0),
        };
      },
    );
    draft.strategicGameplay = {
      ...draft.strategicGameplay,
      parties: {
        ...draft.strategicGameplay.parties,
        [partyId]: {
          partyId,
          leaderCustomerId: id,
          memberCustomerIds: members.map((member) => member.memberId),
          members,
          phase: activePlanAvailable ? "routing" : "forming",
          orderStrategy:
            activePlanAvailable && activePlan
              ? activePlan.strategy
              : "pending",
          stallIds:
            activePlanAvailable && activePlan
              ? [...activePlan.stallIds]
              : [],
          nextStopIndex: 0,
          seatKeys: [],
          seatWaitElapsedMs: 0,
          splitExplained: false,
        },
      },
    };
    event(draft, {
      type: "party-created",
      entityId: partyId,
      message: String(actualGroupSize),
    });
  }
  draft.customers[id] = {
    id,
    archetypeId: leader.memberArchetype.id,
    status: "choosing-stall",
    position: { ...entrance.position },
    path: [],
    pathIndex: 0,
    movementProgress: 0,
    stateElapsedMs: 0,
    visitElapsedMs: 0,
    waitElapsedMs: 0,
    walkingDistanceTiles: 0,
    patienceRemainingMs: isParty
      ? Math.max(
          ...activeMembers.map(
            (member) => member.memberArchetype.patienceMs,
          ),
        ) +
        (actualGroupSize - 1) * PARTY_COMPANION_PATIENCE_ALLOWANCE_MS
      : leader.memberArchetype.patienceMs,
    satisfaction: 3,
    arrivalPeriodSequenceId: draft.source.servicePeriod.sequenceId,
    forecastGroupSize: actualGroupSize as 1 | 2 | 3 | 4 | 5 | 6,
    forecastMealMixId: leader.mealMix.id,
    forecastBudgetCents: leader.budgetCents,
    partyId,
    regularId: regular?.id,
    regularStoryStep: regular
      ? draft.strategicGameplay.regularProgress[regular.id]?.storyStep
      : undefined,
    seatPreference: leader.seatPreference,
    satisfactionModifiers: leader.satisfactionModifiers
      ? { ...leader.satisfactionModifiers }
      : undefined,
    visitPreferenceTags: leader.extraTags,
    trayReturnPlanned: activeMembers.some((member) => member.trayReturnPlanned),
    healthConditions: leader.needs.healthConditions,
    nutritionIntentId: leader.needs.nutritionIntentId,
    sourceEntranceId: entrance.id,
    hasTray: false,
    served: false,
    spentCents: asMoneyCents(0),
    spent: 0,
    stuckMs: 0,
  };
  draft.forecastArrivals = [
    ...draft.forecastArrivals,
    ...activeMembers.map((member) => ({
      periodSequenceId: draft.source.servicePeriod.sequenceId,
      customerId: member.memberId,
      archetypeId: member.memberArchetype.id,
      budgetCents: member.budgetCents,
      groupSize: actualGroupSize as 1 | 2 | 3 | 4 | 5 | 6,
      mealMixId: member.mealMix.id,
      nutritionIntent: member.needs.nutritionIntentId,
      healthConditions: member.needs.healthConditions,
    })),
  ];
  draft.metrics = {
    ...draft.metrics,
    spawnedCustomers: draft.metrics.spawnedCustomers + actualGroupSize,
  };
  event(draft, { type: "customer-spawned", entityId: id });
}

function affordableDishes(draft: Draft, stall: StallRuntime, customer: Customer): readonly DishDefinition[] {
  const budgetCents =
    customer.forecastBudgetCents ?? getArchetype(draft, customer).budgetCents;
  return (stall.definition.stall?.dishIds ?? [])
    .map((id) => draft.source.catalog.dishes[id])
    .filter((dish): dish is DishDefinition => Boolean(
      dish && dish.priceCents + customer.spentCents <= budgetCents,
    ));
}

function partyForCustomer(
  draft: Draft,
  customer: Customer,
): PartyLifecycleState | undefined {
  return customer.partyId
    ? draft.strategicGameplay.parties[customer.partyId]
    : undefined;
}

function replaceParty(draft: Draft, party: PartyLifecycleState): void {
  draft.strategicGameplay = {
    ...draft.strategicGameplay,
    parties: {
      ...draft.strategicGameplay.parties,
      [party.partyId]: party,
    },
  };
}

function partyMembersAtStop(
  party: PartyLifecycleState,
  stallId: string,
): readonly PartyMemberVisitState[] {
  return party.members.filter(
    (member) => {
      if (!(member.plannedStallIds ?? [member.plannedStallId]).includes(stallId)) {
        return false;
      }
      if (!member.mealOrderSnapshot) return !member.served;
      const settled = new Set(member.settledMealLineIds ?? []);
      const stop = member.mealOrderSnapshot.servingPlan.stops.find(
        (candidate) => candidate.stallInstanceId === stallId,
      );
      return Boolean(
        stop?.preparationIds.some((preparationId) =>
          member.mealOrderSnapshot!.lines.some(
            (line) =>
              line.orderLine.preparationId === preparationId &&
              !settled.has(line.orderLine.lineId),
          )
        ),
      );
    },
  );
}

function handlePartyStopUnavailable(
  draft: Draft,
  source: Customer,
  message: string,
): Customer | undefined {
  const party = partyForCustomer(draft, source);
  if (!party) return undefined;
  removeFromAllQueues(draft, source.id);
  const members = party.members.map((member) => {
    const snapshot = member.mealOrderSnapshot;
    const settledLineIds = new Set(member.settledMealLineIds ?? []);
    if (
      !snapshot ||
      settledLineIds.size === 0 ||
      settledLineIds.size === snapshot.lines.length ||
      member.mealSettlementCause !== undefined
    ) {
      return member;
    }
    const finalized = finalizeFrozenMeal(
      draft,
      customerForPartyMember(source, party, member),
      "second-stall-unavailable",
    );
    return {
      ...member,
      mealSettlementCause: finalized.mealSettlementCause,
      served: finalized.served,
      nutritionResult: finalized.nutritionRequestResult,
      satisfaction: finalized.satisfaction,
      ratingFactors: finalized.ratingFactors
        ? { ...finalized.ratingFactors }
        : undefined,
      awardedVisitXp: finalized.awardedVisitXp ?? 0,
      firstServeBonusXp: finalized.firstServeBonusXp ?? 0,
      spentCents: finalized.spentCents,
      servedStallDefinitionIds: finalized.servedStallDefinitionIds
        ? [...finalized.servedStallDefinitionIds]
        : undefined,
    };
  });
  const servedMembers = members.filter((member) => member.served);
  const terminalServiceOutcome = servedMembers.length > 0
    ? "partial-second-stop" as const
    : "zero-served-unavailable" as const;
  if (
    servedMembers.length > 0 &&
    party.terminalServiceOutcome === undefined
  ) {
    event(draft, {
      type: "party-partial",
      entityId: party.partyId,
      message,
    });
  }
  if (servedMembers.length === 0) {
    if (party.terminalServiceOutcome === undefined) {
      event(draft, {
        type: "party-unserved",
        entityId: party.partyId,
        message,
      });
    }
    replaceParty(draft, {
      ...party,
      members,
      phase: "departing",
      nextStopIndex: party.stallIds.length,
      terminalServiceOutcome,
    });
    return beginExit(draft, source, true);
  }
  replaceParty(draft, {
    ...party,
    members,
    phase: "seeking-seat",
    nextStopIndex: party.stallIds.length,
    terminalServiceOutcome,
  });
  const leaderMember =
    members.find((member) => member.memberId === party.leaderCustomerId) ??
    members[0]!;
  const spentCents = leaderMember.spentCents ?? asMoneyCents(0);
  return {
    ...transition(draft, source, "seeking-seat"),
    targetStallId: undefined,
    served: true,
    hasTray: true,
    orderLineSnapshot: leaderMember.mealOrderSnapshot
      ? undefined
      : leaderMember.orderLineSnapshot,
    mealOrderSnapshot: leaderMember.mealOrderSnapshot,
    mealStopIndex: leaderMember.mealOrderSnapshot
      ? leaderMember.mealOrderSnapshot.servingPlan.stops.length - 1
      : undefined,
    settledMealLineIds: leaderMember.settledMealLineIds,
    mealSettlementCause: leaderMember.mealSettlementCause,
    nutritionRequestResult: leaderMember.nutritionResult,
    ratingFactors: leaderMember.ratingFactors
      ? { ...leaderMember.ratingFactors }
      : source.ratingFactors,
    spentCents,
    spent: centsToSgd(spentCents),
    awardedVisitXp: leaderMember.awardedVisitXp ?? 0,
    firstServeBonusXp: leaderMember.firstServeBonusXp ?? 0,
    satisfaction:
      members.reduce(
        (sum, member) => sum + (member.satisfaction ?? 3),
        0,
      ) / Math.max(1, members.length),
    trayReturnPlanned: servedMembers.some(
      (member) => member.trayReturnPlanned,
    ),
  };
}

export function boundedDishDemandAppeal(dish: DishDefinition) {
  const demand = Math.max(0, Math.min(
    1,
    (dish.baseDemand ?? 0.5) * (dish.demandModifierBasisPoints ?? 10_000) / 10_000,
  ));
  return (demand - 0.5) * 0.8;
}

function chooseStall(
  draft: Draft,
  source: Customer,
  deltaMs: number,
): Customer {
  const party = partyForCustomer(draft, source);
  if (party) {
    if (party.orderStrategy === "pending") {
      return handlePartyStopUnavailable(
        draft,
        source,
        "no-feasible-two-stop-plan",
      )!;
    }
    const stallId = party.stallIds[party.nextStopIndex];
    const stall = getStall(draft, stallId);
    const queue = stallId ? draft.queues[stallId] ?? [] : [];
    const queueCell = stall?.queueCells[queue.length];
    if (!stall) {
      return handlePartyStopUnavailable(
        draft,
        source,
        party.members.some((member) => member.served)
          ? "second-stall-unavailable"
          : "first-stall-unavailable",
      )!;
    }
    if (!queueCell) {
      const alreadyServed = party.members.some((member) => member.served);
      const waiting = {
        ...source,
        patienceRemainingMs: alreadyServed
          ? source.patienceRemainingMs
          : source.patienceRemainingMs - deltaMs,
      };
      return waiting.patienceRemainingMs <= 0
        ? beginExit(draft, waiting, true)
        : waiting;
    }
    const path = requestPath(draft, source.position, queueCell);
    if (!path) {
      return handlePartyStopUnavailable(
        draft,
        source,
        party.members.some((member) => member.served)
          ? "second-stall-unavailable"
          : "first-stall-unavailable",
      )!;
    }
    draft.queues[stall.object.id] = [...queue, source.id];
    replaceParty(draft, { ...party, phase: "queueing" });
    return {
      ...preparePath(transition(draft, source, "walking-to-queue"), path),
      targetStallId: stall.object.id,
    };
  }
  const archetype = getArchetype(draft, source);
  const wayfinding = getGlobalWayfinding(draft.objects, draft.source.catalog);
  let best: { stall: StallRuntime; path: readonly GridPoint[]; score: number } | undefined;
  let waitingForQueueCapacity = false;
  for (const stall of openStalls(draft)) {
    const config = stall.definition.stall as NonNullable<PlaceableDefinition["stall"]>;
    const queue = draft.queues[stall.object.id] ?? [];
    const dishes = affordableDishes(draft, stall, source);
    const effectiveCapacity = Math.min(config.queueCapacity, stall.queueCells.length);
    const targetQueueCell = stall.queueCells[queue.length];
    if (dishes.length === 0) continue;
    if (queue.length >= effectiveCapacity || !targetQueueCell) {
      waitingForQueueCapacity = true;
      continue;
    }
    const path = requestPath(draft, source.position, targetQueueCell);
    if (!path) continue;
    const preferredTags = new Set(archetype.preferenceTags ?? []);
    const singleMenuAppeal = Math.max(
      ...dishes.map((dish) => {
        const preferenceMatches = (dish.preferenceTags ?? []).filter((tag) => preferredTags.has(tag)).length;
        return (
          dishStarRating(dish) * archetype.qualitySensitivity +
          boundedDishDemandAppeal(dish) +
          preferenceMatches * 2.25 -
          (dish.priceCents / 100) * archetype.priceSensitivity
        );
      }),
    );
    const combo = chooseCombo(draft, stall, source);
    const comboMenuAppeal = combo
      ? combo.snapshot.lines.reduce((sum, line) => (
          sum + line.orderLine.terms.starAppeal +
          line.orderLine.terms.demandModifierBasisPoints / 10_000
        ), 0) -
        (combo.snapshot.lines.reduce(
          (sum, line) => sum + line.orderLine.terms.priceCents,
          0,
        ) / 100) * archetype.priceSensitivity +
        3
      : Number.NEGATIVE_INFINITY;
    const menuAppeal = Math.max(singleMenuAppeal, comboMenuAppeal);
    const nutritionBonus = nutritionStallChoiceBonus(
      bestEnabledNutritionIntentFit(dishes, source.nutritionIntentId),
    );
    const healthBonus = healthStallChoiceBonus(
      bestEnabledPersonalizedHealthRating(dishes, source.healthConditions),
      source.healthConditions,
    );
    const random = nextFloat(draft.rngState);
    draft.rngState = random.state;
    const novelty = random.value * (archetype.noveltyPreference ?? 0.35) * 2.5;
    const queueLoad = queue.length / Math.max(1, effectiveCapacity);
    const committedWait = queue.length + activePreparationCount(draft, stall.object.id) * 0.5;
    const score =
      menuAppeal +
      nutritionBonus +
      healthBonus +
      config.popularity * 1.25 +
      config.quality * archetype.qualitySensitivity +
      novelty -
      committedWait * archetype.queueSensitivity * 1.5 -
      queueLoad * 2.25 -
      (path.length - 1) * archetype.distanceSensitivity * 0.18 * (1 - wayfinding);
    if (!best || score > best.score || (score === best.score && stall.object.id < best.stall.object.id)) {
      best = { stall, path, score };
    }
  }
  if (!best) {
    if (waitingForQueueCapacity) {
      const waiting = {
        ...source,
        patienceRemainingMs: source.patienceRemainingMs - deltaMs,
      };
      return waiting.patienceRemainingMs <= 0
        ? beginExit(draft, waiting, true)
        : waiting;
    }
    return beginExit(draft, source, true);
  }
  draft.queues[best.stall.object.id] = [...(draft.queues[best.stall.object.id] ?? []), source.id];
  const customer = preparePath(transition(draft, source, "walking-to-queue"), best.path);
  return { ...customer, targetStallId: best.stall.object.id };
}

interface DishChoice {
  readonly dish: DishDefinition;
  readonly variant?: NutritionVariant;
}

function chooseDish(draft: Draft, stall: StallRuntime, customer: Customer): DishChoice | undefined {
  const archetype = getArchetype(draft, customer);
  const preferred = new Set(archetype.preferenceTags ?? []);
  let best: { dish: DishDefinition; variant?: NutritionVariant; score: number } | undefined;
  for (const dish of [...affordableDishes(draft, stall, customer)].sort((a, b) => compareIds(a.id, b.id))) {
    const matches = (dish.preferenceTags ?? []).filter((tag) => preferred.has(tag)).length;
    const random = nextFloat(draft.rngState);
    draft.rngState = random.state;
    const variant = activeNutritionVariant(dish);
    const nutritionBonus = nutritionDishChoiceBonus(
      nutritionIntentFit(dish, customer.nutritionIntentId),
    );
    const healthBonus = healthDishChoiceBonus(
      personalizedHealthRating(variant?.profile, customer.healthConditions),
      customer.healthConditions,
    );
    const score =
      dishStarRating(dish) * archetype.qualitySensitivity +
      boundedDishDemandAppeal(dish) +
      matches * 2 -
      (dish.priceCents / 100) * archetype.priceSensitivity +
      nutritionBonus +
      healthBonus +
      random.value * 0.001;
    if (!best || score > best.score || (score === best.score && dish.id < best.dish.id)) {
      best = { dish, variant, score };
    }
  }
  return best ? { dish: best.dish, variant: best.variant } : undefined;
}

interface ComboChoice {
  readonly snapshot: MealOrderSnapshot;
  readonly main: MealComponent;
  readonly complement: MealComponent;
  readonly priceCents: number;
}

interface ComboCustomerContext {
  readonly id: string;
  readonly arrivalPeriodSequenceId: number;
  readonly forecastMealMixId?: string;
  readonly budgetCents: number;
  readonly spentCents: number;
  readonly nutritionIntentId?: NutritionIntent;
  readonly healthConditions: readonly HealthCondition[];
  readonly archetype: CustomerArchetype;
}

function gameStateFromDraft(draft: Draft): GameState {
  return {
    ...draft.source,
    objects: draft.objects,
    customers: draft.customers,
    queues: draft.queues,
    seatReservations: draft.seatReservations,
    economy: draft.economy,
    progression: draft.progression,
    periodLedgers: draft.periodLedgers,
    forecastArrivals: draft.forecastArrivals,
    strategicGameplay: draft.strategicGameplay,
    rngState: draft.rngState,
    nextCustomerSequence: draft.nextCustomerSequence,
    spawnCountdownMs: draft.spawnCountdownMs,
    metrics: draft.metrics,
    tick: draft.tick,
    events: draft.events,
  };
}

function requestedComboRole(
  customer: Pick<ComboCustomerContext, "forecastMealMixId">,
): Exclude<MealRole, "main"> | undefined {
  if (customer.forecastMealMixId === "main-and-side") return "side";
  if (customer.forecastMealMixId === "main-and-drink") return "drink";
  return undefined;
}

function meanKnown(values: readonly (number | undefined)[]): number | undefined {
  if (values.length === 0 || values.some((value) => value === undefined)) return undefined;
  return values.reduce<number>((sum, value) => sum + value!, 0) / values.length;
}

function aggregateMealProfile(
  orderId: string,
  components: readonly [MealComponent, MealComponent],
  intentId: NutritionIntent | undefined,
): NutritionProfile {
  const aggregate = aggregateNutritionProfiles(components.map((component) => component.nutritionProfile));
  const intentFit = intentId
    ? meanKnown(components.map((component) => {
        const fit = component.nutritionProfile?.status === "released"
          ? component.nutritionProfile.intentFits[intentId]
          : undefined;
        return typeof fit === "number" && Number.isFinite(fit)
          ? Math.max(0, Math.min(1, fit))
          : undefined;
      }))
    : undefined;
  const released = components.every((component) => component.nutritionProfile?.status === "released");
  return {
    id: `meal:${orderId}`,
    dishId: `meal:${orderId}`,
    status: released ? "released" : "unavailable",
    nutrients: aggregate.nutrients,
    intentFits: intentId && intentFit !== undefined ? { [intentId]: intentFit } : {},
    nutritionClass: "meal",
  };
}

function comboChoicesForContext(
  draft: Draft,
  origin: GridPoint,
  customer: ComboCustomerContext,
  includeClosed = false,
  requiredFirstStallId?: string,
): readonly ComboChoice[] {
  const desiredRole = requestedComboRole(customer);
  if (
    !desiredRole ||
    draft.progression.level < 5 ||
    draft.source.comboBoard.slots.every((offer) => offer === null)
  ) return [];
  const state = gameStateFromDraft(draft);
  const components = mealComponentsForState(state, includeClosed);
  const componentsById = Object.fromEntries(components.map((component) => [
    component.preparationId,
    component,
  ]));
  const availableStallIds = new Set(components.flatMap((component) => component.stallInstanceIds));
  const distances = servingDistancesForState(state, origin, includeClosed);
  const planningComponents = mealComponentsForState(state, true);
  const planningAvailableStallIds = new Set(
    planningComponents.flatMap((component) => component.stallInstanceIds),
  );
  const planningOrigin = state.accessPoints.find((point) => point.kind === "entrance")?.position ??
    state.entrance;
  const universe = buildUnlockedMealUniverse(
    planningComponents,
    servingDistancesForState(state, planningOrigin, true),
    planningAvailableStallIds,
  );
  const budgetCents = customer.budgetCents;
  const candidates = state.comboBoard.slots.flatMap((offer) => {
    if (!offer) return [];
    const resolved = resolveComboOffer(offer, componentsById);
    if (!resolved || resolved.components.some((component) => !component.unlocked)) return [];
    const main = resolved.components.find((component) => component.role === "main");
    const complement = resolved.components.find((component) => component.role === desiredRole);
    if (
      !main ||
      !complement ||
      (
        requiredFirstStallId !== undefined &&
        main.stallInstanceIds.every((id) => id !== requiredFirstStallId)
      )
    ) return [];
    if (resolved.priceCents + customer.spentCents > budgetCents) return [];
    const servingPlan = selectReachableServingPlan(
      [main, complement],
      distances,
      availableStallIds,
      requiredFirstStallId,
    );
    if (!servingPlan) return [];
    const candidateId = `pair:${main.preparationId}+${complement.preparationId}`;
    if (!universe.some((candidate) => candidate.id === candidateId)) return [];
    const balance = compareMealBalanceAmongUnlockedOptions(candidateId, universe);
    const orderId = `${customer.id}:meal`;
    const aggregateProfile = aggregateMealProfile(orderId, [main, complement], customer.nutritionIntentId);
    const intentFit = customer.nutritionIntentId
      ? aggregateProfile.intentFits[customer.nutritionIntentId]
      : undefined;
    const conditionRating = personalizedHealthRating(aggregateProfile, customer.healthConditions);
    const conditionAwareFit = conditionRating === undefined
      ? undefined
      : Math.max(0, Math.min(1, (conditionRating - 1) / 4));
    const aggregate = aggregateNutritionProfiles([main.nutritionProfile, complement.nutritionProfile]);
    const explanationCodes = [
      "frozen-at-order",
      "meal-balance-among-unlocked-options",
      ...(intentFit === undefined && customer.nutritionIntentId ? ["intent-fit-unavailable"] : []),
      ...(conditionAwareFit === undefined && customer.healthConditions.length > 0
        ? ["condition-aware-fit-unavailable"]
        : []),
    ];
    const snapshot = snapshotMealOrder({
      orderId,
      offerId: offer.id,
      arrivalPeriodSequenceId: customer.arrivalPeriodSequenceId,
      lines: [main, complement].map((component, index) => ({
        role: component.role,
        orderLine: snapshotOrderLine({
          lineId: `${customer.id}:${index + 1}`,
          dishId: component.dishId,
          variantId: component.variantId,
          preparationId: component.preparationId,
          mealRole: component.role,
          arrivalPeriodSequenceId: customer.arrivalPeriodSequenceId,
          terms: component.terms!,
          nutritionProfile: component.nutritionProfile,
          mealBalanceRating: balance.rating,
          intentFit: customer.nutritionIntentId
            ? component.nutritionProfile?.intentFits[customer.nutritionIntentId]
            : undefined,
          explanationCodes,
        }),
      })) as unknown as MealOrderSnapshot["lines"],
      servingPlan,
      nutrition: aggregate,
      fit: {
        mealBalance: balance.rating,
        mealBalanceKnownWeightBasisPoints: Math.round(
          (balance.availableWeight / balance.totalWeight) * 10_000,
        ),
        intentId: customer.nutritionIntentId,
        intentFit,
        conditionIds: customer.healthConditions,
        conditionAwareFit,
        explanationCodes: [
          ...balance.explanationCodes,
          ...explanationCodes,
        ],
      },
      explanationCodes,
    });
    const score = main.terms!.starAppeal + complement.terms!.starAppeal +
      (main.terms!.demandModifierBasisPoints + complement.terms!.demandModifierBasisPoints) / 20_000 -
      (resolved.priceCents / 100) * customer.archetype.priceSensitivity +
      (intentFit ?? 0) * 2 + (conditionAwareFit ?? 0) * 2;
    return [{
      snapshot,
      main,
      complement,
      priceCents: resolved.priceCents,
      score,
    }];
  }).sort((left, right) => right.score - left.score || left.snapshot.offerId.localeCompare(right.snapshot.offerId));
  return candidates;
}

function chooseCombo(
  draft: Draft,
  stall: StallRuntime,
  customer: Customer,
): ComboChoice | undefined {
  return comboChoicesForContext(
    draft,
    customer.position,
    {
      id: customer.id,
      arrivalPeriodSequenceId: customer.arrivalPeriodSequenceId,
      forecastMealMixId: customer.forecastMealMixId,
      budgetCents:
        customer.forecastBudgetCents ??
        getArchetype(draft, customer).budgetCents,
      spentCents: customer.spentCents,
      nutritionIntentId: customer.nutritionIntentId,
      healthConditions: customer.healthConditions,
      archetype: getArchetype(draft, customer),
    },
    false,
    stall.object.id,
  )[0];
}

function findSeat(draft: Draft, customer: Customer): { seat: SeatLocation; path: readonly GridPoint[] } | undefined {
  const preference =
    customer.seatPreference ??
    getArchetype(draft, customer).seatPreference ??
    "any";
  const allSeats = getSeatLocations(draft.objects, draft.source.catalog);
  const openStallAnchors = openStalls(draft).map((stall) => stall.queueAnchor);
  const objectSeatCounts = new Map<string, number>();
  for (const seat of allSeats) {
    objectSeatCounts.set(
      seat.objectId,
      (objectSeatCounts.get(seat.objectId) ?? 0) + 1,
    );
  }
  let best:
    | { seat: SeatLocation; path: readonly GridPoint[]; score: number }
    | undefined;
  for (const seat of allSeats) {
    if (draft.seatReservations[seat.key]) continue;
    if (preference === "accessible" && !seat.accessible) continue;
    const path = requestPath(draft, customer.position, seat.point);
    if (!path) continue;
    const tags = new Set(seat.environmentTags);
    const preferredEnvironment = preference === "quiet" ||
      preference === "breezy" ||
      preference === "bright";
    const preferencePenalty = preferredEnvironment && !tags.has(preference)
      ? 8
      : preference === "group-table" &&
          (objectSeatCounts.get(seat.objectId) ?? 0) < 4
        ? 6
        : 0;
    const nearStallPenalty =
      preference === "near-stall" && openStallAnchors.length > 0
      ? Math.min(
          ...openStallAnchors.map(
            (anchor) =>
              Math.abs(seat.point.x - anchor.x) +
              Math.abs(seat.point.y - anchor.y),
          ),
        ) * 0.25
      : 0;
    const score =
      path.length +
      preferencePenalty +
      nearStallPenalty -
      Math.max(-2, Math.min(2, seat.comfort));
    if (
      !best ||
      score < best.score ||
      (score === best.score && seat.key < best.seat.key)
    ) {
      best = { seat, path, score };
    }
  }
  return best;
}

function findReservedSeat(draft: Draft, customer: Customer): SeatLocation | undefined {
  if (
    !customer.reservedSeatKey ||
    draft.seatReservations[customer.reservedSeatKey] !== customer.id
  ) {
    return undefined;
  }
  const seats = getSeatLocations(draft.objects, draft.source.catalog);
  const party = partyForCustomer(draft, customer);
  if (
    party &&
    (
      party.seatKeys.length !== party.members.length ||
      party.seatKeys.some(
        (seatKey) =>
          draft.seatReservations[seatKey] !== customer.id ||
          !seats.some((seat) => seat.key === seatKey),
      )
    )
  ) {
    return undefined;
  }
  return seats.find((seat) => seat.key === customer.reservedSeatKey);
}

function buildReachablePartySeatClusters(
  draft: Draft,
  customer: Customer,
  party: PartyLifecycleState,
  includeAdjacentSplits: boolean,
): readonly SeatCluster[] {
  const byObject = new Map<string, SeatLocation[]>();
  const tableGroups = Object.values(draft.objects)
    .filter(
      (object) =>
        draft.source.catalog.placeables[object.definitionId]?.kind === "table",
    )
    .sort((left, right) => compareIds(left.id, right.id))
    .map((object) => ({
      object,
      occupiedTiles: getObjectOccupiedTiles(
        object,
        draft.source.catalog,
      ),
    }));
  for (const seat of getSeatLocations(draft.objects, draft.source.catalog)) {
    if (draft.seatReservations[seat.key]) continue;
    if (!requestPath(draft, customer.position, seat.point)) continue;
    const nearestTable = tableGroups
      .map((table) => ({
        table,
        distance: Math.min(
          ...table.occupiedTiles.map(
            (tile) =>
              Math.abs(tile.x - seat.point.x) +
              Math.abs(tile.y - seat.point.y),
          ),
        ),
      }))
      .filter(({ distance }) => distance <= 3)
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          compareIds(left.table.object.id, right.table.object.id),
      )[0]?.table.object;
    const clusterObjectId = nearestTable?.id ?? seat.objectId;
    const existing = byObject.get(clusterObjectId) ?? [];
    byObject.set(clusterObjectId, [...existing, seat]);
  }
  const openStallAnchors = openStalls(draft).map((stall) => stall.queueAnchor);
  const preferenceFor = (member: PartyMemberVisitState): SeatPreference =>
    member.seatPreference ??
    draft.source.catalog.archetypes[member.archetypeId]?.seatPreference ??
    "any";
  const clusters = [...byObject.entries()]
    .sort(([left], [right]) => compareIds(left, right))
    .map(([objectId, seats]) => {
      const centre = {
        x: seats.reduce((sum, seat) => sum + seat.point.x, 0) / seats.length,
        y: seats.reduce((sum, seat) => sum + seat.point.y, 0) / seats.length,
      };
      const environmentTags = new Set(
        [
          ...seats.flatMap((seat) => seat.environmentTags),
          ...(
            draft.source.catalog.placeables[
              draft.objects[objectId]?.definitionId ?? ""
            ]?.environmentTags ?? []
          ),
        ],
      );
      const preferenceScore = party.members.reduce((total, member) => {
        const preference = preferenceFor(member);
        if (
          preference === "quiet" ||
          preference === "breezy" ||
          preference === "bright"
        ) {
          return total + (environmentTags.has(preference) ? 0 : 8);
        }
        if (preference === "group-table") {
          return total + (seats.length >= Math.min(4, party.members.length)
            ? 0
            : 6);
        }
        if (preference === "near-stall" && openStallAnchors.length > 0) {
          return total + Math.min(
            ...openStallAnchors.map(
              (anchor) =>
                Math.abs(centre.x - anchor.x) +
                Math.abs(centre.y - anchor.y),
            ),
          ) * 0.25;
        }
        return total;
      }, 0);
      return {
        clusterId: `cluster:${objectId}`,
        tableId: objectId,
        availableSeatIds: seats.map((seat) => seat.key).sort(compareIds),
        accessibleSeatIds: seats
          .filter((seat) => seat.accessible)
          .map((seat) => seat.key)
          .sort(compareIds),
        reachable: seats.length > 0,
        preferenceScore,
        centre,
      };
    });
  if (!includeAdjacentSplits) return clusters;
  return clusters.map((cluster) => {
    const clusterSeats = byObject.get(cluster.tableId) ?? [];
    const adjacentClusterIds = clusters
      .filter((candidate) => candidate.clusterId !== cluster.clusterId)
      .filter((candidate) => {
        const candidateSeats = byObject.get(candidate.tableId) ?? [];
        return clusterSeats.some((leftSeat) =>
          candidateSeats.some((rightSeat) => {
            const manhattanDistance =
              Math.abs(leftSeat.point.x - rightSeat.point.x) +
              Math.abs(leftSeat.point.y - rightSeat.point.y);
            if (manhattanDistance > 4) return false;
            const path = requestPath(
              draft,
              leftSeat.point,
              rightSeat.point,
            );
            return Boolean(path && path.length - 1 <= 4);
          }),
        );
      })
      .map((candidate) => candidate.clusterId)
      .sort(compareIds);
    return {
      ...cluster,
      adjacentClusterIds,
    };
  });
}

function reservePartySeatAssignment(
  draft: Draft,
  customer: Customer,
  party: PartyLifecycleState,
  seatWaitElapsedMs: number,
): { readonly customer: Customer; readonly explanationCode: string } | undefined {
  const requiredAccessibleSeats = party.members.filter(
    (member) =>
      (
        member.seatPreference ??
        draft.source.catalog.archetypes[member.archetypeId]?.seatPreference
      ) === "accessible",
  ).length;
  const totalPatienceMs = Math.min(
    ...party.members.map(
      (member) =>
        draft.source.catalog.archetypes[member.archetypeId]?.patienceMs ??
        getArchetype(draft, customer).patienceMs,
    ),
  );
  const assignment = findPartySeatAssignment(
    party.members.length,
    buildReachablePartySeatClusters(
      draft,
      customer,
      party,
      seatWaitElapsedMs * 10 >= totalPatienceMs * 4,
    ),
    seatWaitElapsedMs,
    totalPatienceMs,
    4,
    customer.position,
    requiredAccessibleSeats,
  );
  if (!assignment) return undefined;
  const reservation = reservePartySeatsAtomically(
    draft.seatReservations,
    customer.id,
    assignment,
  );
  if (!reservation.accepted) return undefined;
  const primarySeat = getSeatLocations(
    draft.objects,
    draft.source.catalog,
  ).find((seat) => seat.key === assignment.seatIds[0]);
  const path = primarySeat
    ? requestPath(draft, customer.position, primarySeat.point)
    : undefined;
  if (!primarySeat || !path) return undefined;
  draft.seatReservations = { ...reservation.reservations };
  replaceParty(draft, {
    ...party,
    phase: "seated",
    seatKeys: [...assignment.seatIds],
    seatWaitElapsedMs,
    splitExplained:
      party.splitExplained || assignment.kind === "adjacent-split",
  });
  event(draft, {
    type: "party-seated",
    entityId: party.partyId,
    message: assignment.explanationCode,
  });
  return {
    customer: {
      ...preparePath(
        transition(draft, customer, "walking-to-seat"),
        path,
      ),
      reservedSeatKey: primarySeat.key,
    },
    explanationCode: assignment.explanationCode,
  };
}

function findTrayReturn(
  draft: Draft,
  customer: Customer,
): { object: PlacedObject; point: GridPoint; path: readonly GridPoint[] } | undefined {
  let best: { object: PlacedObject; point: GridPoint; path: readonly GridPoint[] } | undefined;
  for (const object of Object.values(draft.objects).sort((a, b) => compareIds(a.id, b.id))) {
    if (draft.source.catalog.placeables[object.definitionId]?.kind !== "tray-return") continue;
    const point = getObjectTrayReturnPoint(object, draft.source.catalog);
    if (!point) continue;
    const path = requestPath(draft, customer.position, point);
    if (!path) continue;
    if (!best || path.length < best.path.length || (path.length === best.path.length && object.id < best.object.id)) {
      best = { object, point, path };
    }
  }
  return best;
}

function findTargetTrayPoint(draft: Draft, id: string | undefined): GridPoint | undefined {
  if (!id) return undefined;
  const object = draft.objects[id];
  if (!object || draft.source.catalog.placeables[object.definitionId]?.kind !== "tray-return") return undefined;
  return getObjectTrayReturnPoint(object, draft.source.catalog);
}

function activePreparationCount(draft: Draft, stallId: string): number {
  return Object.values(draft.customers).reduce((count, customer) => {
    if (
      customer.targetStallId !== stallId ||
      (customer.status !== "ordering" && customer.status !== "waiting-for-food")
    ) {
      return count;
    }
    const party = partyForCustomer(draft, customer);
    return count + (
      party
        ? Math.max(1, partyMembersAtStop(party, stallId).length)
        : 1
    );
  }, 0);
}

function completeSale(draft: Draft, source: Customer, dish: DishDefinition): Customer {
  const servedStall = source.targetStallId ? draft.objects[source.targetStallId] : undefined;
  const stallDefinition = servedStall ? draft.source.catalog.placeables[servedStall.definitionId]?.stall : undefined;
  const terms = source.orderLineSnapshot?.terms ?? createServingTerms({
    priceCents: dish.priceCents,
    ingredientCostCents: dish.ingredientCostCents,
    preparationTimeMs: dish.preparationMs,
    servingTimeMs: dish.servingMs ?? stallDefinition?.orderMs ?? 0,
    eatingTimeMs: dish.eatingMs,
    starAppeal: Math.max(1, Math.min(5, dishStarRating(dish))),
    demandModifierBasisPoints: dish.demandModifierBasisPoints ?? Math.round(
      Math.max(0, dish.baseDemand ?? 0.5) * 20_000,
    ),
  });
  const tasteRating = terms.starAppeal;
  const healthRating = source.personalizedHealthRating ?? personalizedHealthRating(
    source.orderedNutritionProfile,
    source.healthConditions,
  );
  const healthImpact = source.healthConditions.length > 0
    ? healthImpactFromRating(healthRating)
    : undefined;
  const healthPreferenceResult = source.healthConditions.length > 0
    ? healthPreferenceResultForRating(healthRating)
    : undefined;
  const priceCents = asMoneyCents(terms.priceCents);
  const ingredientCostCents = asMoneyCents(terms.ingredientCostCents);
  const preparationId = source.orderLineSnapshot?.preparationId ?? exactPreparationId(
    dish.id,
    source.orderedNutritionVariantId,
  );
  const update = settleServedOrder(
    draft.economy,
    draft.progression,
    {
      priceCents,
      ingredientCostCents,
      satisfaction: source.satisfaction * 20,
      preparationId,
      legacyPreparationIds: [dish.id, source.orderedNutritionVariantId]
        .filter((id): id is string => Boolean(id)),
      reputationGain: 0,
    },
  );
  draft.economy = update.economy;
  draft.progression = {
    ...update.progression,
    unlockedDefinitionIds: getUnlockedDefinitionIds(
      draft.source.catalog,
      update.progression.level,
      update.progression.unlockedDefinitionIds,
    ),
  };
  const ledger = draft.periodLedgers[source.arrivalPeriodSequenceId ?? draft.source.servicePeriod.sequenceId]
    ?? createPeriodLedger(source.arrivalPeriodSequenceId ?? draft.source.servicePeriod.sequenceId);
  let updatedLedger = recordLedgerEntry(ledger, {
    id: `${source.id}-${source.orderLineSnapshot?.lineId ?? "line-1"}-sale`,
    kind: "gross-sale",
    amountCents: priceCents,
    tick: draft.tick,
    referenceId: dish.id,
    visitId: source.id,
    lineId: source.orderLineSnapshot?.lineId,
    preparationId,
  });
  if (ingredientCostCents !== undefined && ingredientCostCents > 0) {
    updatedLedger = recordLedgerEntry(updatedLedger, {
      id: `${source.id}-${source.orderLineSnapshot?.lineId ?? "line-1"}-ingredients`,
      kind: "ingredient-cost",
      amountCents: ingredientCostCents,
      tick: draft.tick,
      referenceId: dish.id,
      visitId: source.id,
      lineId: source.orderLineSnapshot?.lineId,
      preparationId,
    });
  }
  draft.periodLedgers = {
    ...draft.periodLedgers,
    [updatedLedger.periodSequenceId]: updatedLedger,
  };
  removeFromAllQueues(draft, source.id);
  event(draft, {
    type: "sale-completed",
    entityId: source.id,
    amount: priceCents,
    amountCents: priceCents,
    message: dish.id,
  });
  if (update.levelUp) event(draft, { type: "level-up", entityId: source.id, message: String(update.progression.level) });
  const profile = cloneNutritionProfile(source.orderedNutritionProfile);
  const requestResult = source.nutritionIntentId
    ? nutritionRequestResult(source.nutritionIntentId, profile)
    : undefined;
  const conditionResult = source.healthConditions.length > 0
    ? healthPreferenceResult
    : undefined;
  const needResults = [requestResult, conditionResult].filter(
    (result): result is NutritionRequestResult => result !== undefined,
  );
  const combinedNutritionResult: NutritionRequestResult | undefined = needResults.length === 0
    ? undefined
    : needResults.some((result) => result === "missed")
      ? "missed"
      : needResults.every((result) => result === "matched")
        ? "matched"
        : "unknown";
  draft.forecastArrivals = draft.forecastArrivals.map((arrival) => (
    arrival.customerId === source.id
      ? {
          ...arrival,
          nutritionResult: combinedNutritionResult,
          nutritionIntentResult: requestResult,
          conditionAwareResult: conditionResult,
        }
      : arrival
  ));
  recordIntentRequest(draft, source.nutritionIntentId);
  const nutrition = draft.metrics.nutrition;
  const saleDay = draft.source.servicePeriod.day;
  const today = nutrition.today.day === saleDay
    ? nutrition.today
    : createEmptyNutritionDayMetrics(saleDay);
  const nutrientTotals = { ...nutrition.nutrientTotals };
  const nutrientKnownCounts = { ...nutrition.nutrientKnownCounts };
  const dailyNutrientTotals = { ...today.nutrientTotals };
  const dailyNutrientKnownCounts = { ...today.nutrientKnownCounts };
  if (profile?.status === "released") {
    for (const metric of NUTRITION_METRICS) {
      const value = profile.nutrients[metric];
      if (value?.status !== "known") continue;
      nutrientTotals[metric] += value.value;
      nutrientKnownCounts[metric] += 1;
      dailyNutrientTotals[metric] += value.value;
      dailyNutrientKnownCounts[metric] += 1;
    }
  }
  const usedNonDefaultVariant = source.orderLineSnapshot
    ? source.orderLineSnapshot.explanationCodes.includes("non-default-preparation")
    : Boolean(
        source.orderedNutritionVariantId &&
        dish.defaultNutritionVariantId &&
        source.orderedNutritionVariantId !== dish.defaultNutritionVariantId,
      );
  const byIntent = { ...nutrition.byIntent };
  const dailyByIntent = { ...today.byIntent };
  let intentMatches = nutrition.intentMatches;
  let intentMisses = nutrition.intentMisses;
  let intentUnknowns = nutrition.intentUnknowns;
  if (source.nutritionIntentId && requestResult) {
    const intent = source.nutritionIntentId;
    const currentIntent = byIntent[intent];
    byIntent[intent] = {
      ...currentIntent,
      matches: currentIntent.matches + (requestResult === "matched" ? 1 : 0),
      misses: currentIntent.misses + (requestResult === "missed" ? 1 : 0),
      unknowns: currentIntent.unknowns + (requestResult === "unknown" ? 1 : 0),
    };
    const currentDailyIntent = dailyByIntent[intent];
    dailyByIntent[intent] = {
      ...currentDailyIntent,
      matches: currentDailyIntent.matches + (requestResult === "matched" ? 1 : 0),
      misses: currentDailyIntent.misses + (requestResult === "missed" ? 1 : 0),
      unknowns: currentDailyIntent.unknowns + (requestResult === "unknown" ? 1 : 0),
    };
    intentMatches += requestResult === "matched" ? 1 : 0;
    intentMisses += requestResult === "missed" ? 1 : 0;
    intentUnknowns += requestResult === "unknown" ? 1 : 0;
  }
  draft.metrics = {
    ...draft.metrics,
    trayReturnOpportunities: draft.metrics.trayReturnOpportunities + 1,
    nutrition: {
      ...nutrition,
      servedMeals: nutrition.servedMeals + 1,
      profiledServings: nutrition.profiledServings + (profile?.status === "released" ? 1 : 0),
      nonDefaultVariantServings:
        nutrition.nonDefaultVariantServings + (usedNonDefaultVariant ? 1 : 0),
      intentMatches,
      intentMisses,
      intentUnknowns,
      byIntent,
      nutrientTotals,
      nutrientKnownCounts,
      dishServings: profile?.status === "released"
        ? {
            ...nutrition.dishServings,
            [dish.id]: (nutrition.dishServings[dish.id] ?? 0) + 1,
          }
        : nutrition.dishServings,
      recentOutcomes: [
        ...nutrition.recentOutcomes,
        {
          customerId: source.id,
          day: draft.source.servicePeriod.day,
          intentId: source.nutritionIntentId,
          dishId: dish.id,
          variantId: source.orderedNutritionVariantId,
          result: requestResult ?? "unknown",
          profile,
        },
      ].slice(-50),
      today: {
        ...today,
        servedMeals: today.servedMeals + 1,
        profiledServings: today.profiledServings + (profile?.status === "released" ? 1 : 0),
        intentMatches: today.intentMatches + (requestResult === "matched" ? 1 : 0),
        intentMisses: today.intentMisses + (requestResult === "missed" ? 1 : 0),
        intentUnknowns: today.intentUnknowns + (requestResult === "unknown" ? 1 : 0),
        byIntent: dailyByIntent,
        nutrientTotals: dailyNutrientTotals,
        nutrientKnownCounts: dailyNutrientKnownCounts,
        dishServings: profile?.status === "released"
          ? {
              ...today.dishServings,
              [dish.id]: (today.dishServings[dish.id] ?? 0) + 1,
            }
          : today.dishServings,
      },
    },
  };
  return {
    ...transition(draft, source, "seeking-seat"),
    targetStallId: undefined,
    servedStallDefinitionId: servedStall?.definitionId,
    servedStallDefinitionIds: servedStall?.definitionId
      ? [servedStall.definitionId]
      : undefined,
    orderedDishId: dish.id,
    nutritionRequestResult: requestResult,
    hasTray: true,
    served: true,
    awardedVisitXp: update.xpAwarded,
    firstServeBonusAwarded: update.firstServeBonusAwarded,
    firstServeBonusXp: update.xpAwarded,
    spentCents: asMoneyCents(source.spentCents + priceCents),
    spent: centsToSgd(asMoneyCents(source.spentCents + priceCents)),
    personalizedHealthRating: healthRating,
    healthImpact,
    healthPreferenceResult,
    satisfaction: Math.max(
      0,
      Math.min(
        5,
        source.satisfaction + normalizeQuality(tasteRating) / 100 + (healthImpact ?? 0),
      ),
    ),
    ratingFactors: {
      ...source.ratingFactors,
      foodQuality: Math.max(
        0,
        Math.min(
          100,
          normalizeQuality(tasteRating) * 0.7 +
            normalizeQuality(stallDefinition?.quality ?? dish.quality) * 0.3 +
            (healthImpact ?? 0) * 20,
        ),
      ),
      value: Math.max(25, Math.min(100, 120 - (
        priceCents / Math.max(
          1,
          source.forecastBudgetCents ?? getArchetype(draft, source).budgetCents,
        )
      ) * 70)),
    },
  };
}

function freezePartyStopOrders(
  draft: Draft,
  source: Customer,
  stall: StallRuntime,
  party: PartyLifecycleState,
): Customer {
  const members = party.members.map((member) => {
    const plannedStallIds =
      member.plannedStallIds ?? [member.plannedStallId];
    if (!plannedStallIds.includes(stall.object.id)) {
      return member;
    }
    if (member.plannedMealOfferId && member.plannedPreparationIds) {
      if (member.mealOrderSnapshot) return member;
      if (plannedStallIds[0] !== stall.object.id) return member;
      const complementRole = mealComponentsForState(
        gameStateFromDraft(draft),
        true,
      ).find(
        (component) =>
          component.preparationId === member.plannedPreparationIds![1],
      )?.role;
      const choice = comboChoicesForContext(
        draft,
        source.position,
        {
          id: member.memberId,
          arrivalPeriodSequenceId: source.arrivalPeriodSequenceId,
          forecastMealMixId:
            complementRole === "drink"
              ? "main-and-drink"
              : complementRole === "side"
                ? "main-and-side"
                : undefined,
          budgetCents: member.budgetCents,
          spentCents: member.spentCents ?? 0,
          nutritionIntentId: member.nutritionIntentId,
          healthConditions: member.healthConditions,
          archetype:
            draft.source.catalog.archetypes[member.archetypeId] ??
            getArchetype(draft, source),
        },
        false,
        stall.object.id,
      ).find((candidate) =>
        candidate.snapshot.offerId === member.plannedMealOfferId &&
        candidate.snapshot.lines
          .map((line) => line.orderLine.preparationId)
          .join("|") === member.plannedPreparationIds!.join("|") &&
        candidate.snapshot.servingPlan.stops
          .map((stop) => stop.stallInstanceId)
          .join("|") === plannedStallIds.join("|")
      );
      return choice
        ? {
            ...member,
            mealOrderSnapshot: choice.snapshot,
            settledMealLineIds: [],
          }
        : member;
    }
    if (member.served) return member;
    const dish = draft.source.catalog.dishes[member.plannedDishId];
    if (!dish || dish.priceCents > member.budgetCents) return member;
    const variant = activeNutritionVariant(dish);
    return {
      ...member,
      orderLineSnapshot: snapshotOrderLine({
        lineId: `${party.partyId}:${member.memberId}:line`,
        dishId: dish.id,
        variantId: variant?.id,
        preparationId:
          dish.activePreparationId ??
          exactPreparationId(dish.id, variant?.id),
        mealRole: dish.mealRole,
        arrivalPeriodSequenceId: source.arrivalPeriodSequenceId,
        terms: createServingTerms({
          priceCents: dish.priceCents,
          ingredientCostCents: dish.ingredientCostCents,
          preparationTimeMs: dish.preparationMs,
          servingTimeMs:
            dish.servingMs ?? stall.definition.stall?.orderMs ?? 0,
          eatingTimeMs: dish.eatingMs,
          starAppeal: Math.max(1, Math.min(5, dishStarRating(dish))),
          demandModifierBasisPoints:
            dish.demandModifierBasisPoints ??
            Math.round(Math.max(0, dish.baseDemand ?? 0.5) * 20_000),
        }),
        nutritionProfile: variant?.profile,
        intentFit: nutritionIntentFit(dish, member.nutritionIntentId),
        explanationCodes: [
          "frozen-at-order",
          "party-member-line",
          variant?.id &&
          dish.defaultNutritionVariantId &&
          variant.id !== dish.defaultNutritionVariantId
            ? "non-default-preparation"
            : "default-preparation",
        ],
      }),
    };
  });
  const frozenAtStop = members.filter(
    (member) => {
      if (
        !(member.plannedStallIds ?? [member.plannedStallId]).includes(
          stall.object.id,
        )
      ) {
        return false;
      }
      if (member.mealOrderSnapshot) {
        return member.mealOrderSnapshot.servingPlan.stops.some(
          (stop) => stop.stallInstanceId === stall.object.id,
        );
      }
      return !member.served && Boolean(member.orderLineSnapshot);
    },
  );
  if (frozenAtStop.length === 0) {
    replaceParty(draft, { ...party, phase: "departing" });
    return beginExit(draft, source, true);
  }
  const leaderMember =
    members.find((member) => member.memberId === source.id) ??
    frozenAtStop[0]!;
  const leaderLine =
    leaderMember.orderLineSnapshot ??
    leaderMember.mealOrderSnapshot?.lines[0].orderLine ??
    frozenAtStop[0]!.orderLineSnapshot ??
    frozenAtStop[0]!.mealOrderSnapshot!.lines[0].orderLine;
  const leaderMeal = leaderMember.mealOrderSnapshot;
  replaceParty(draft, {
    ...party,
    members,
    phase: "queueing",
  });
  removeFromAllQueues(draft, source.id);
  return {
    ...transition(draft, source, "waiting-for-food"),
    orderedDishId: leaderLine.dishId,
    orderedNutritionVariantId: leaderLine.variantId,
    orderedNutritionProfile: cloneNutritionProfile(
      leaderLine.nutritionProfile,
    ),
    orderLineSnapshot: leaderMeal ? undefined : leaderLine,
    mealOrderSnapshot: leaderMeal,
    mealStopIndex: leaderMeal
      ? leaderMeal.servingPlan.stops.findIndex(
          (stop) => stop.stallInstanceId === stall.object.id,
        )
      : undefined,
    settledMealLineIds: leaderMeal
      ? [...(leaderMember.settledMealLineIds ?? [])]
      : undefined,
  };
}

function partyStopServiceMs(
  party: PartyLifecycleState,
  stallId: string,
  preparationCapacity: number,
): number {
  const total = party.members
    .reduce((sum, member) => {
      if (member.mealOrderSnapshot) {
        const settled = new Set(member.settledMealLineIds ?? []);
        const stop = member.mealOrderSnapshot.servingPlan.stops.find(
          (candidate) => candidate.stallInstanceId === stallId,
        );
        return sum + (stop?.preparationIds.reduce((lineTotal, preparationId) => {
          const line = member.mealOrderSnapshot!.lines.find(
            (candidate) =>
              candidate.orderLine.preparationId === preparationId &&
              !settled.has(candidate.orderLine.lineId),
          );
          return lineTotal + (line
            ? line.orderLine.terms.preparationTimeMs +
              line.orderLine.terms.servingTimeMs
            : 0);
        }, 0) ?? 0);
      }
      return sum + (
        !member.served &&
        member.plannedStallId === stallId &&
        member.orderLineSnapshot
          ? member.orderLineSnapshot.terms.preparationTimeMs +
            member.orderLineSnapshot.terms.servingTimeMs
          : 0
      );
    }, 0);
  return Math.ceil(total / Math.max(1, preparationCapacity));
}

function customerForPartyMember(
  source: Customer,
  party: PartyLifecycleState,
  member: PartyMemberVisitState,
  targetStallId?: string,
): Customer {
  const servedStallDefinitionIds = member.servedStallDefinitionIds
    ? [...member.servedStallDefinitionIds]
    : [];
  return {
    ...source,
    id: member.memberId,
    partyId: undefined,
    regularId:
      member.memberId === party.leaderCustomerId
        ? source.regularId
        : undefined,
    regularStoryStep:
      member.memberId === party.leaderCustomerId
        ? source.regularStoryStep
        : undefined,
    archetypeId: member.archetypeId,
    seatPreference: member.seatPreference,
    satisfactionModifiers: member.satisfactionModifiers
      ? { ...member.satisfactionModifiers }
      : undefined,
    forecastBudgetCents: member.budgetCents,
    nutritionIntentId: member.nutritionIntentId,
    healthConditions: [...member.healthConditions],
    targetStallId,
    orderedDishId:
      member.orderLineSnapshot?.dishId ??
      member.mealOrderSnapshot?.lines[0].orderLine.dishId,
    orderedNutritionVariantId:
      member.orderLineSnapshot?.variantId ??
      member.mealOrderSnapshot?.lines[0].orderLine.variantId,
    orderedNutritionProfile: cloneNutritionProfile(
      member.orderLineSnapshot?.nutritionProfile ??
      member.mealOrderSnapshot?.lines[0].orderLine.nutritionProfile,
    ),
    orderLineSnapshot: member.mealOrderSnapshot
      ? undefined
      : member.orderLineSnapshot,
    mealOrderSnapshot: member.mealOrderSnapshot,
    mealStopIndex: member.mealOrderSnapshot
      ? member.mealOrderSnapshot.servingPlan.stops.findIndex(
          (stop) => stop.stallInstanceId === targetStallId,
        )
      : undefined,
    settledMealLineIds: member.settledMealLineIds
      ? [...member.settledMealLineIds]
      : undefined,
    mealSettlementCause: member.mealSettlementCause,
    served: member.served,
    hasTray: member.served,
    spentCents: member.spentCents ?? asMoneyCents(0),
    spent: centsToSgd(member.spentCents ?? asMoneyCents(0)),
    nutritionRequestResult: member.nutritionResult,
    servedStallDefinitionId: servedStallDefinitionIds[0],
    servedStallDefinitionIds,
    satisfaction: member.satisfaction ?? 3,
    ratingFactors: member.ratingFactors
      ? { ...member.ratingFactors }
      : undefined,
    ratingSettled: false,
    awardedVisitXp: member.awardedVisitXp ?? 0,
    firstServeBonusXp: member.firstServeBonusXp ?? 0,
    firstServeBonusAwarded: (member.firstServeBonusXp ?? 0) > 0,
  };
}

function settlePartyComboMemberAtStop(
  draft: Draft,
  source: Customer,
  snapshot: MealOrderSnapshot,
  stallId: string,
): Customer {
  const stop = snapshot.servingPlan.stops.find(
    (candidate) => candidate.stallInstanceId === stallId,
  );
  if (!stop) return source;
  const alreadySettled = new Set(source.settledMealLineIds ?? []);
  const stopLines = snapshot.lines.filter(
    (line) =>
      stop.preparationIds.includes(line.orderLine.preparationId!) &&
      !alreadySettled.has(line.orderLine.lineId),
  );
  if (stopLines.length === 0) return source;
  const update = settleServedComponents(
    draft.economy,
    draft.progression,
    stopLines.map((line) => ({
      priceCents: line.orderLine.terms.priceCents,
      ingredientCostCents: line.orderLine.terms.ingredientCostCents,
      preparationId: line.orderLine.preparationId,
      legacyPreparationIds: [
        line.orderLine.dishId,
        line.orderLine.variantId,
      ].filter((id): id is string => Boolean(id)),
    })),
    { countVisit: alreadySettled.size === 0, reputationGain: 0 },
  );
  draft.economy = update.economy;
  draft.progression = {
    ...update.progression,
    unlockedDefinitionIds: getUnlockedDefinitionIds(
      draft.source.catalog,
      update.progression.level,
      update.progression.unlockedDefinitionIds,
    ),
  };
  let ledger =
    draft.periodLedgers[source.arrivalPeriodSequenceId] ??
    createPeriodLedger(source.arrivalPeriodSequenceId);
  for (const line of stopLines) {
    const preparationId = line.orderLine.preparationId!;
    ledger = recordLedgerEntry(ledger, {
      id: `${source.id}-${line.orderLine.lineId}-sale`,
      kind: "gross-sale",
      amountCents: line.orderLine.terms.priceCents,
      tick: draft.tick,
      referenceId: line.orderLine.dishId,
      visitId: source.id,
      lineId: line.orderLine.lineId,
      preparationId,
    });
    if (line.orderLine.terms.ingredientCostCents > 0) {
      ledger = recordLedgerEntry(ledger, {
        id: `${source.id}-${line.orderLine.lineId}-ingredients`,
        kind: "ingredient-cost",
        amountCents: line.orderLine.terms.ingredientCostCents,
        tick: draft.tick,
        referenceId: line.orderLine.dishId,
        visitId: source.id,
        lineId: line.orderLine.lineId,
        preparationId,
      });
    }
    alreadySettled.add(line.orderLine.lineId);
    event(draft, {
      type: "sale-completed",
      entityId: source.id,
      amount: line.orderLine.terms.priceCents,
      amountCents: line.orderLine.terms.priceCents,
      message: preparationId,
    });
  }
  draft.periodLedgers = {
    ...draft.periodLedgers,
    [ledger.periodSequenceId]: ledger,
  };
  if (update.levelUp) {
    event(draft, {
      type: "level-up",
      entityId: source.id,
      message: String(update.progression.level),
    });
  }
  const priceCents = asMoneyCents(
    stopLines.reduce(
      (sum, line) => sum + line.orderLine.terms.priceCents,
      0,
    ),
  );
  const stallObject = draft.objects[stallId];
  const servedStallDefinitionIds = [...new Set([
    ...(source.servedStallDefinitionIds ?? []),
    ...(source.servedStallDefinitionId
      ? [source.servedStallDefinitionId]
      : []),
    ...(stallObject?.definitionId ? [stallObject.definitionId] : []),
  ])].sort(compareIds);
  const updated: Customer = {
    ...source,
    mealOrderSnapshot: snapshot,
    settledMealLineIds: [...alreadySettled].sort(compareIds),
    served: alreadySettled.has(snapshot.lines[0].orderLine.lineId),
    hasTray: alreadySettled.has(snapshot.lines[0].orderLine.lineId),
    servedStallDefinitionId:
      source.servedStallDefinitionId ?? stallObject?.definitionId,
    servedStallDefinitionIds,
    spentCents: asMoneyCents(source.spentCents + priceCents),
    spent: centsToSgd(asMoneyCents(source.spentCents + priceCents)),
    awardedVisitXp: (source.awardedVisitXp ?? 0) + update.xpAwarded,
    firstServeBonusAwarded: Boolean(
      source.firstServeBonusAwarded || update.firstServeBonusAwarded,
    ),
    firstServeBonusXp:
      (source.firstServeBonusXp ?? 0) + update.xpAwarded,
  };
  return alreadySettled.size === snapshot.lines.length
    ? finalizeFrozenMeal(draft, updated, "complete")
    : updated;
}

function completePartyStop(
  draft: Draft,
  source: Customer,
  stall: StallRuntime,
  party: PartyLifecycleState,
): Customer {
  const stopMembers = partyMembersAtStop(party, stall.object.id);
  if (stopMembers.length === 0) {
    replaceParty(draft, { ...party, phase: "departing" });
    return beginExit(draft, source, true);
  }
  const completedById = new Map<string, Customer>();
  for (const member of stopMembers) {
    const temporary = customerForPartyMember(
      source,
      party,
      member,
      stall.object.id,
    );
    const completed = member.mealOrderSnapshot
      ? settlePartyComboMemberAtStop(
          draft,
          temporary,
          member.mealOrderSnapshot,
          stall.object.id,
        )
      : member.orderLineSnapshot
        ? completeSale(
            draft,
            temporary,
            draft.source.catalog.dishes[member.orderLineSnapshot.dishId]!,
          )
        : temporary;
    completedById.set(member.memberId, completed);
  }
  const members = party.members.map((member) => {
    const completed = completedById.get(member.memberId);
    return completed
      ? {
          ...member,
          orderLineSnapshot: completed.mealOrderSnapshot
            ? undefined
            : completed.orderLineSnapshot,
          mealOrderSnapshot: completed.mealOrderSnapshot,
          settledMealLineIds: completed.settledMealLineIds,
          mealSettlementCause: completed.mealSettlementCause,
          served: completed.served,
          nutritionResult: completed.nutritionRequestResult,
          satisfaction: completed.satisfaction,
          ratingFactors: completed.ratingFactors
            ? { ...completed.ratingFactors }
            : undefined,
          awardedVisitXp: completed.awardedVisitXp ?? 0,
          firstServeBonusXp: completed.firstServeBonusXp ?? 0,
          spentCents: completed.spentCents,
          servedStallDefinitionIds: completed.servedStallDefinitionIds
            ? [...completed.servedStallDefinitionIds]
            : undefined,
        }
      : member;
  });
  const nextStopIndex = party.nextStopIndex + 1;
  const serviceComplete = nextStopIndex >= party.stallIds.length;
  const updatedParty: PartyLifecycleState = {
    ...party,
    members,
    nextStopIndex,
    phase: serviceComplete ? "seeking-seat" : "routing",
  };
  replaceParty(draft, updatedParty);
  removeFromAllQueues(draft, source.id);
  const leaderMember =
    members.find((member) => member.memberId === source.id) ?? members[0]!;
  const leaderCompleted = completedById.get(leaderMember.memberId);
  const servedMemberCount = members.filter((member) => member.served).length;
  const awardedVisitXp = leaderMember.awardedVisitXp ?? 0;
  const firstServeBonusXp = leaderMember.firstServeBonusXp ?? 0;
  const spentCents = leaderMember.spentCents ?? asMoneyCents(0);
  const servedStallDefinitionIds = [...new Set(
    members.flatMap((member) => member.servedStallDefinitionIds ?? []),
  )].sort(compareIds);
  const nextCustomer: Customer = {
    ...source,
    served: servedMemberCount > 0,
    hasTray: servedMemberCount > 0,
    targetStallId: undefined,
    orderedDishId:
      leaderMember.orderLineSnapshot?.dishId ?? source.orderedDishId,
    orderedNutritionVariantId:
      leaderMember.orderLineSnapshot?.variantId ??
      source.orderedNutritionVariantId,
    orderedNutritionProfile: cloneNutritionProfile(
      leaderMember.orderLineSnapshot?.nutritionProfile ??
      source.orderedNutritionProfile,
    ),
    orderLineSnapshot: leaderMember.mealOrderSnapshot
      ? undefined
      : leaderMember.orderLineSnapshot ?? source.orderLineSnapshot,
    mealOrderSnapshot:
      leaderMember.mealOrderSnapshot ?? source.mealOrderSnapshot,
    mealStopIndex: leaderMember.mealOrderSnapshot
      ? Math.min(
          nextStopIndex,
          leaderMember.mealOrderSnapshot.servingPlan.stops.length - 1,
        )
      : source.mealStopIndex,
    settledMealLineIds:
      leaderMember.settledMealLineIds ?? source.settledMealLineIds,
    mealSettlementCause:
      leaderMember.mealSettlementCause ?? source.mealSettlementCause,
    nutritionRequestResult:
      leaderCompleted?.nutritionRequestResult ??
      source.nutritionRequestResult,
    awardedVisitXp,
    firstServeBonusXp,
    firstServeBonusAwarded: firstServeBonusXp > 0,
    spentCents,
    spent: centsToSgd(spentCents),
    servedStallDefinitionIds,
    servedStallDefinitionId: servedStallDefinitionIds[0],
    satisfaction:
      members.reduce(
        (sum, member) => sum + (member.satisfaction ?? 3),
        0,
      ) / Math.max(1, members.length),
    ratingFactors: leaderMember.ratingFactors
      ? { ...leaderMember.ratingFactors }
      : source.ratingFactors,
    trayReturnPlanned: members.some(
      (member) => member.served && member.trayReturnPlanned,
    ),
  };
  if (!serviceComplete) {
    return transition(draft, nextCustomer, "choosing-stall");
  }
  return transition(draft, nextCustomer, "seeking-seat");
}

function finalizePartyDeparture(
  draft: Draft,
  source: Customer,
  party: PartyLifecycleState,
  movementFailed: boolean,
): void {
  for (const member of party.members) {
    const temporary: Customer = {
      ...customerForPartyMember(source, party, member),
      hasTray: false,
      ratingSettled: false,
    };
    const rated = settleVisitRating(
      draft,
      temporary,
      !member.served,
      member.served
        ? movementFailed
          ? "party-served-forced-exit"
          : "party-served"
        : "party-unserved",
    );
    awardFinalCompletedVisitXp(draft, rated);
  }
  const servedCount = party.members.filter((member) => member.served).length;
  draft.metrics = {
    ...draft.metrics,
    despawnedCustomers:
      draft.metrics.despawnedCustomers + party.members.length,
    completedCustomers: draft.metrics.completedCustomers + servedCount,
  };
  const parties = { ...draft.strategicGameplay.parties };
  delete parties[party.partyId];
  draft.strategicGameplay = {
    ...draft.strategicGameplay,
    parties,
  };
  event(draft, {
    type: "customer-despawned",
    entityId: party.partyId,
    message: movementFailed
      ? `party-forced-after-stuck:${servedCount}/${party.members.length}`
      : `party-completed:${servedCount}/${party.members.length}`,
  });
}

function processCustomer(draft: Draft, source: Customer, deltaMs: number): Customer | undefined {
  const waitingForService =
    source.status === "queued" ||
    source.status === "ordering" ||
    source.status === "waiting-for-food";
  let customer: Customer = {
    ...source,
    visitElapsedMs: source.visitElapsedMs + deltaMs,
    stateElapsedMs: source.stateElapsedMs + deltaMs,
    waitElapsedMs:
      (source.waitElapsedMs ?? 0) + (waitingForService ? deltaMs : 0),
  };

  if (
    !customer.served &&
    customer.visitElapsedMs >= draft.source.config.maxVisitMs &&
    customer.status !== "walking-to-exit"
  ) {
    return beginExit(draft, customer, true);
  }

  switch (customer.status) {
    case "choosing-stall":
      return chooseStall(draft, customer, deltaMs);

    case "walking-to-queue": {
      const stall = getStall(draft, customer.targetStallId);
      if (!stall) {
        const partyResult = handlePartyStopUnavailable(
          draft,
          customer,
          "serving-stall-unavailable-while-routing",
        );
        if (partyResult) return partyResult;
        const mainLineId = customer.mealOrderSnapshot?.lines[0].orderLine.lineId;
        if (mainLineId && customer.settledMealLineIds?.includes(mainLineId)) {
          removeFromAllQueues(draft, customer.id);
          return finalizeFrozenMeal(draft, customer, "second-stall-unavailable");
        }
        removeFromAllQueues(draft, customer.id);
        markRecovery(draft, customer, "Stall unavailable while walking to queue");
        return { ...transition(draft, customer, "choosing-stall"), targetStallId: undefined, orderedDishId: undefined };
      }
      let queue = draft.queues[stall.object.id] ?? [];
      let queueCell = getCustomerQueueCell(queue, customer.id, stall.queueCells);
      const mainLineId = customer.mealOrderSnapshot?.lines[0].orderLine.lineId;
      const awaitingSecondComboStop = Boolean(
        mainLineId &&
        customer.settledMealLineIds?.includes(mainLineId) &&
        (customer.mealStopIndex ?? 0) > 0,
      );
      if (awaitingSecondComboStop && !queue.includes(customer.id)) {
        const availableCell = stall.queueCells[queue.length];
        if (!availableCell) {
          // A full live queue is temporary capacity pressure, not a lost
          // serving stall. Retry deterministically until space or watchdog.
          return { ...customer, path: [], pathIndex: 0, movementProgress: 0 };
        }
        const joiningPath = requestPath(draft, customer.position, availableCell);
        if (!joiningPath) {
          return finalizeFrozenMeal(draft, customer, "second-stall-unavailable");
        }
        queue = [...queue, customer.id];
        draft.queues[stall.object.id] = queue;
        queueCell = availableCell;
        customer = preparePath(customer, joiningPath);
      }
      if (!queueCell) {
        const partyResult = handlePartyStopUnavailable(
          draft,
          customer,
          "party-queue-position-unavailable",
        );
        if (partyResult) return partyResult;
        if (mainLineId && customer.settledMealLineIds?.includes(mainLineId)) {
          removeFromAllQueues(draft, customer.id);
          return { ...customer, path: [], pathIndex: 0, movementProgress: 0 };
        }
        removeFromAllQueues(draft, customer.id);
        markRecovery(draft, customer, "Queue assignment disappeared");
        return { ...transition(draft, customer, "choosing-stall"), targetStallId: undefined };
      }
      const movement = moveToward(draft, customer, queueCell, deltaMs);
      customer = movement.customer;
      if (movement.failed) {
        const partyResult = handlePartyStopUnavailable(
          draft,
          customer,
          "serving-stall-route-became-unreachable",
        );
        if (partyResult) return partyResult;
        const mainLineId = customer.mealOrderSnapshot?.lines[0].orderLine.lineId;
        if (mainLineId && customer.settledMealLineIds?.includes(mainLineId)) {
          removeFromAllQueues(draft, customer.id);
          return finalizeFrozenMeal(draft, movement.customer, "second-stall-unavailable");
        }
        removeFromAllQueues(draft, customer.id);
        markRecovery(draft, customer, "Queue path became unreachable");
        return { ...transition(draft, customer, "choosing-stall"), targetStallId: undefined };
      }
      if (!movement.arrived) return customer;
      return transition(draft, customer, "queued");
    }

    case "queued": {
      const stall = getStall(draft, customer.targetStallId);
      const queue = customer.targetStallId ? draft.queues[customer.targetStallId] ?? [] : [];
      if (!stall || !queue.includes(customer.id)) {
        const partyResult = handlePartyStopUnavailable(
          draft,
          customer,
          "party-queue-target-unavailable",
        );
        if (partyResult) return partyResult;
        const mainLineId = customer.mealOrderSnapshot?.lines[0].orderLine.lineId;
        if (mainLineId && customer.settledMealLineIds?.includes(mainLineId)) {
          removeFromAllQueues(draft, customer.id);
          return finalizeFrozenMeal(draft, customer, "second-stall-unavailable");
        }
        removeFromAllQueues(draft, customer.id);
        markRecovery(draft, customer, "Queue target was removed");
        return { ...transition(draft, customer, "choosing-stall"), targetStallId: undefined };
      }
      const queueCell = getCustomerQueueCell(queue, customer.id, stall.queueCells);
      if (!queueCell) {
        const partyResult = handlePartyStopUnavailable(
          draft,
          customer,
          "party-queue-route-unavailable",
        );
        if (partyResult) return partyResult;
        const mainLineId = customer.mealOrderSnapshot?.lines[0].orderLine.lineId;
        if (mainLineId && customer.settledMealLineIds?.includes(mainLineId)) {
          removeFromAllQueues(draft, customer.id);
          return finalizeFrozenMeal(draft, customer, "second-stall-unavailable");
        }
        removeFromAllQueues(draft, customer.id);
        markRecovery(draft, customer, "Queue cell became unavailable");
        return { ...transition(draft, customer, "choosing-stall"), targetStallId: undefined };
      }
      if (!samePoint(customer.position, queueCell)) return transition(draft, customer, "walking-to-queue");
      const queueUtility = getUtilityInfluence(
        draft.objects,
        draft.source.catalog,
        customer.position,
      );
      customer = {
        ...customer,
        // Once a main is served, the accepted second component remains a
        // committed order. Base queue patience no longer cancels that line.
        patienceRemainingMs: customer.mealOrderSnapshot &&
          customer.settledMealLineIds?.includes(
            customer.mealOrderSnapshot.lines[0].orderLine.lineId,
          )
          ? customer.patienceRemainingMs
          : customer.patienceRemainingMs - deltaMs * (1 - queueUtility.queuePatience),
      };
      if (customer.patienceRemainingMs <= 0) return beginExit(draft, customer, true);
      if (
        queue[0] === customer.id &&
        activePreparationCount(draft, stall.object.id) < (stall.definition.stall?.preparationCapacity ?? 1)
      ) {
        return transition(draft, customer, "ordering");
      }
      return customer;
    }

    case "ordering": {
      const stall = getStall(draft, customer.targetStallId);
      if (!stall) {
        const partyResult = handlePartyStopUnavailable(
          draft,
          customer,
          "serving-stall-closed-during-ordering",
        );
        if (partyResult) return partyResult;
        const mainLineId = customer.mealOrderSnapshot?.lines[0].orderLine.lineId;
        if (mainLineId && customer.settledMealLineIds?.includes(mainLineId)) {
          removeFromAllQueues(draft, customer.id);
          return finalizeFrozenMeal(draft, customer, "second-stall-unavailable");
        }
        removeFromAllQueues(draft, customer.id);
        markRecovery(draft, customer, "Stall closed during ordering");
        return { ...transition(draft, customer, "choosing-stall"), targetStallId: undefined };
      }
      const party = partyForCustomer(draft, customer);
      const partyOrderCount = party
        ? Math.max(
            1,
            partyMembersAtStop(party, stall.object.id).length,
          )
        : 1;
      if (
        customer.stateElapsedMs <
        (stall.definition.stall?.orderMs ?? 0) * partyOrderCount
      ) {
        return customer;
      }
      if (party) {
        return freezePartyStopOrders(draft, customer, stall, party);
      }
      if (customer.mealOrderSnapshot && (customer.mealStopIndex ?? 0) > 0) {
        removeFromAllQueues(draft, customer.id);
        return transition(draft, customer, "waiting-for-food");
      }
      const combo = chooseCombo(draft, stall, customer);
      if (combo) {
        const conditionRating = combo.snapshot.fit.conditionAwareFit === undefined
          ? undefined
          : 1 + combo.snapshot.fit.conditionAwareFit * 4;
        removeFromAllQueues(draft, customer.id);
        return {
          ...transition(draft, customer, "waiting-for-food"),
          orderedDishId: combo.main.dishId,
          orderedNutritionVariantId: combo.main.variantId,
          orderedNutritionProfile: cloneNutritionProfile(combo.main.nutritionProfile),
          orderLineSnapshot: undefined,
          mealOrderSnapshot: combo.snapshot,
          mealStopIndex: 0,
          settledMealLineIds: [],
          mealSettlementCause: undefined,
          nutritionRequestResult: undefined,
          personalizedHealthRating: conditionRating,
          healthImpact: undefined,
          healthPreferenceResult: customer.healthConditions.length > 0
            ? healthPreferenceResultForRating(conditionRating)
            : undefined,
        };
      }
      const choice = chooseDish(draft, stall, customer);
      if (!choice) return beginExit(draft, customer, true);
      const healthRating = personalizedHealthRating(
        choice.variant?.profile,
        customer.healthConditions,
      );
      // Ordering occupies the queue head; preparation occupies a capacity slot.
      // Releasing here lets the next customer advance while this meal is prepared.
      removeFromAllQueues(draft, customer.id);
      return {
        ...transition(draft, customer, "waiting-for-food"),
        orderedDishId: choice.dish.id,
        orderedNutritionVariantId: choice.variant?.id,
        orderedNutritionProfile: cloneNutritionProfile(choice.variant?.profile),
        orderLineSnapshot: snapshotOrderLine({
          lineId: `${customer.id}:1`,
          dishId: choice.dish.id,
          variantId: choice.variant?.id,
          preparationId:
            choice.dish.activePreparationId ??
            exactPreparationId(choice.dish.id, choice.variant?.id),
          mealRole: choice.dish.mealRole,
          arrivalPeriodSequenceId: customer.arrivalPeriodSequenceId ?? draft.source.servicePeriod.sequenceId,
          terms: createServingTerms({
            priceCents: choice.dish.priceCents,
            ingredientCostCents: choice.dish.ingredientCostCents,
            preparationTimeMs: choice.dish.preparationMs,
            servingTimeMs: choice.dish.servingMs ?? stall.definition.stall?.orderMs ?? 0,
            eatingTimeMs: choice.dish.eatingMs,
            starAppeal: Math.max(1, Math.min(5, dishStarRating(choice.dish))),
            demandModifierBasisPoints: choice.dish.demandModifierBasisPoints ?? Math.round(
              Math.max(0, choice.dish.baseDemand ?? 0.5) * 20_000,
            ),
          }),
          nutritionProfile: choice.variant?.profile,
          intentFit: nutritionIntentFit(choice.dish, customer.nutritionIntentId),
          explanationCodes: [
            "frozen-at-order",
            choice.variant?.id && choice.dish.defaultNutritionVariantId &&
              choice.variant.id !== choice.dish.defaultNutritionVariantId
              ? "non-default-preparation"
              : "default-preparation",
          ],
        }),
        nutritionRequestResult: undefined,
        personalizedHealthRating: healthRating,
        healthImpact: undefined,
        healthPreferenceResult: customer.healthConditions.length > 0
          ? healthPreferenceResultForRating(healthRating)
          : undefined,
      };
    }

    case "waiting-for-food": {
      const party = partyForCustomer(draft, customer);
      if (party) {
        const expectedStallId = party.stallIds[party.nextStopIndex];
        const stall = getStall(draft, customer.targetStallId);
        if (
          !stall ||
          !expectedStallId ||
          stall.object.id !== expectedStallId
        ) {
          return handlePartyStopUnavailable(
            draft,
            customer,
            "serving-stall-unavailable-during-preparation",
          )!;
        }
        const serviceMs = partyStopServiceMs(
          party,
          stall.object.id,
          stall.definition.stall?.preparationCapacity ?? 1,
        );
        if (customer.stateElapsedMs < serviceMs) return customer;
        return completePartyStop(draft, customer, stall, party);
      }
      if (customer.mealOrderSnapshot) {
        const stopIndex = customer.mealStopIndex ?? 0;
        const stop = customer.mealOrderSnapshot.servingPlan.stops[stopIndex];
        const stall = getStall(draft, customer.targetStallId);
        if (!stop || !stall || stall.object.id !== stop.stallInstanceId) {
          const mainLineId = customer.mealOrderSnapshot.lines[0].orderLine.lineId;
          if (customer.settledMealLineIds?.includes(mainLineId)) {
            return finalizeFrozenMeal(draft, customer, "second-stall-unavailable");
          }
          removeFromAllQueues(draft, customer.id);
          markRecovery(draft, customer, "Combo serving stall disappeared before the main was served");
          return {
            ...transition(draft, customer, "choosing-stall"),
            targetStallId: undefined,
            orderedDishId: undefined,
            orderedNutritionVariantId: undefined,
            orderedNutritionProfile: undefined,
            mealOrderSnapshot: undefined,
            mealStopIndex: undefined,
            settledMealLineIds: undefined,
          };
        }
        const settled = new Set(customer.settledMealLineIds ?? []);
        const stopLines = customer.mealOrderSnapshot.lines.filter((line) => (
          stop.preparationIds.includes(line.orderLine.preparationId!) &&
          !settled.has(line.orderLine.lineId)
        ));
        const serviceMs = stopLines.reduce((sum, line) => (
          sum + line.orderLine.terms.preparationTimeMs + line.orderLine.terms.servingTimeMs
        ), 0);
        if (customer.stateElapsedMs < serviceMs) return customer;
        return completeFrozenMealStop(draft, customer);
      }
      const stall = getStall(draft, customer.targetStallId);
      const dish = customer.orderedDishId ? draft.source.catalog.dishes[customer.orderedDishId] : undefined;
      if (!stall || !dish) {
        removeFromAllQueues(draft, customer.id);
        markRecovery(draft, customer, "Order target disappeared during preparation");
        return { ...transition(draft, customer, "choosing-stall"), targetStallId: undefined, orderedDishId: undefined };
      }
      const preparationMs = customer.orderLineSnapshot?.terms.preparationTimeMs ?? dish.preparationMs;
      const servingMs = customer.orderLineSnapshot?.terms.servingTimeMs ?? dish.servingMs ?? 0;
      if (customer.stateElapsedMs < preparationMs + servingMs) return customer;
      return completeSale(draft, customer, dish);
    }

    case "seeking-seat": {
      const party = partyForCustomer(draft, customer);
      if (party) {
        const seatWaitElapsedMs = party.seatWaitElapsedMs + deltaMs;
        const totalPatienceMs = Math.min(
          ...party.members.map(
            (member) =>
              draft.source.catalog.archetypes[member.archetypeId]?.patienceMs ??
              getArchetype(draft, customer).patienceMs,
          ),
        );
        const crossedSplitThreshold =
          party.seatWaitElapsedMs * 10 < totalPatienceMs * 4 &&
          seatWaitElapsedMs * 10 >= totalPatienceMs * 4;
        const shouldRetry =
          party.seatWaitElapsedMs === 0 ||
          crossedSplitThreshold ||
          Math.floor(party.seatWaitElapsedMs / PARTY_SEAT_RETRY_MS) !==
            Math.floor(seatWaitElapsedMs / PARTY_SEAT_RETRY_MS);
        const selected = shouldRetry
          ? reservePartySeatAssignment(
              draft,
              customer,
              party,
              seatWaitElapsedMs,
            )
          : undefined;
        if (selected) return selected.customer;
        replaceParty(draft, {
          ...party,
          phase: "seeking-seat",
          seatWaitElapsedMs,
        });
        customer = {
          ...customer,
          patienceRemainingMs: customer.patienceRemainingMs - deltaMs,
        };
        if (customer.patienceRemainingMs <= 0) {
          return beginExit(draft, customer, false);
        }
        return customer;
      }
      const selected = findSeat(draft, customer);
      if (!selected) {
        customer = { ...customer, patienceRemainingMs: customer.patienceRemainingMs - deltaMs };
        if (customer.patienceRemainingMs <= 0) return beginExit(draft, customer, false);
        return customer;
      }
      draft.seatReservations[selected.seat.key] = customer.id;
      return {
        ...preparePath(transition(draft, customer, "walking-to-seat"), selected.path),
        reservedSeatKey: selected.seat.key,
      };
    }

    case "walking-to-seat": {
      const seat = findReservedSeat(draft, customer);
      if (!seat) {
        customer = releaseSeat(draft, customer);
        const party = partyForCustomer(draft, customer);
        if (party) {
          replaceParty(draft, {
            ...party,
            phase: "seeking-seat",
            seatKeys: [],
          });
        }
        markRecovery(draft, customer, "Reserved seat was removed");
        return transition(draft, customer, "seeking-seat");
      }
      const movement = moveToward(draft, customer, seat.point, deltaMs);
      if (movement.failed) {
        customer = releaseSeat(draft, movement.customer);
        const party = partyForCustomer(draft, customer);
        if (party) {
          replaceParty(draft, {
            ...party,
            phase: "seeking-seat",
            seatKeys: [],
          });
        }
        markRecovery(draft, customer, "Reserved seat became unreachable");
        return transition(draft, customer, "seeking-seat");
      }
      return movement.arrived ? transition(draft, movement.customer, "eating") : movement.customer;
    }

    case "eating": {
      const seat = findReservedSeat(draft, customer);
      const dish = customer.orderedDishId ? draft.source.catalog.dishes[customer.orderedDishId] : undefined;
      if (!seat) {
        customer = releaseSeat(draft, customer);
        markRecovery(draft, customer, "Seat was removed while eating");
        return transition(draft, customer, "seeking-seat");
      }
      const diningUtility = getUtilityInfluence(
        draft.objects,
        draft.source.catalog,
        seat.point,
      );
      const party = partyForCustomer(draft, customer);
      const partyEatingTimes = party?.members
        .filter((member) => member.served && member.orderLineSnapshot)
        .map((member) => member.orderLineSnapshot!.terms.eatingTimeMs) ?? [];
      const frozenEatingMs = partyEatingTimes.length > 0
        ? Math.max(...partyEatingTimes)
        : customer.mealOrderSnapshot
          ? Math.max(...customer.mealOrderSnapshot.lines
              .filter((line) => customer.settledMealLineIds?.includes(line.orderLine.lineId))
              .map((line) => line.orderLine.terms.eatingTimeMs))
          : customer.orderLineSnapshot?.terms.eatingTimeMs ?? dish?.eatingMs;
      const adjustedEatingMs = frozenEatingMs !== undefined
        ? adjustedEatingDurationMs(frozenEatingMs, diningUtility.eatingSpeed)
        : Number.POSITIVE_INFINITY;
      if (frozenEatingMs === undefined || customer.stateElapsedMs < adjustedEatingMs) return customer;
      customer = releaseSeat(draft, customer);
      return {
        ...transition(draft, customer, "seeking-tray-return"),
        satisfaction: Math.max(
          0,
          Math.min(
            5,
            customer.satisfaction + 0.25 + utilitySatisfactionBonus(diningUtility),
          ),
        ),
        ratingFactors: {
          ...customer.ratingFactors,
          comfort: Math.max(45, Math.min(100, 76 + diningUtility.ambience * 6)),
          cleanliness: Math.max(35, Math.min(100, 82 + diningUtility.cleanliness * 8 + diningUtility.cleaningEfficiency * 6)),
          ambience: Math.max(40, Math.min(100, 72 + diningUtility.ambience * 9)),
        },
      };
    }

    case "seeking-tray-return": {
      if (!customer.trayReturnPlanned) {
        return beginExit(draft, customer, false);
      }
      const selected = findTrayReturn(draft, customer);
      if (!selected) return beginExit(draft, customer, false);
      return {
        ...preparePath(transition(draft, customer, "walking-to-tray-return"), selected.path),
        targetTrayReturnId: selected.object.id,
      };
    }

    case "walking-to-tray-return": {
      const point = findTargetTrayPoint(draft, customer.targetTrayReturnId);
      if (!point) {
        markRecovery(draft, customer, "Tray-return target was removed");
        return { ...transition(draft, customer, "seeking-tray-return"), targetTrayReturnId: undefined };
      }
      const movement = moveToward(draft, customer, point, deltaMs);
      if (movement.failed) {
        markRecovery(draft, movement.customer, "Tray-return target became unreachable");
        return beginExit(draft, movement.customer, false);
      }
      if (!movement.arrived) return movement.customer;
      const returnUtility = getUtilityInfluence(
        draft.objects,
        draft.source.catalog,
        point,
      );
      const party = partyForCustomer(draft, customer);
      const returnedTrayCount = party
        ? party.members.filter(
            (member) => member.served && member.trayReturnPlanned,
          ).length
        : 1;
      draft.metrics = {
        ...draft.metrics,
        trayReturns: draft.metrics.trayReturns + returnedTrayCount,
      };
      return beginExit(
        draft,
        {
          ...movement.customer,
          hasTray: false,
          satisfaction: Math.min(
            5,
            movement.customer.satisfaction +
              0.1 +
              returnUtility.cleaningEfficiency * 0.25,
          ),
        },
        false,
      );
    }

    case "walking-to-exit": {
      const targetExit = draft.source.accessPoints.find((point) => point.id === customer.targetExitId && point.kind === "exit")
        ?? chooseExit(draft, customer);
      if (!targetExit) return undefined;
      const movement = moveToward(draft, customer, targetExit.position, deltaMs);
      if (!movement.arrived && !movement.failed) return movement.customer;
      const party = partyForCustomer(draft, movement.customer);
      if (party) {
        removeFromAllQueues(draft, movement.customer.id);
        releaseSeat(draft, movement.customer);
        finalizePartyDeparture(
          draft,
          movement.customer,
          party,
          movement.failed,
        );
        return undefined;
      }
      customer = settleVisitRating(
        draft,
        movement.customer,
        !movement.customer.served,
        movement.customer.served ? "served" : "abandoned",
      );
      customer = awardFinalCompletedVisitXp(draft, customer);
      removeFromAllQueues(draft, customer.id);
      releaseSeat(draft, customer);
      draft.metrics = {
        ...draft.metrics,
        despawnedCustomers: draft.metrics.despawnedCustomers + 1,
        completedCustomers: draft.metrics.completedCustomers + (customer.served ? 1 : 0),
      };
      event(draft, {
        type: "customer-despawned",
        entityId: customer.id,
        message: movement.failed ? "forced-after-stuck" : customer.served ? "completed" : "abandoned",
      });
      return undefined;
    }
  }
}

export interface DrainWatchdogStateResult {
  readonly state: GameState;
  readonly servedTimeoutIds: readonly string[];
  readonly unservedDepartureIds: readonly string[];
}

/** Atomically settles and removes the remaining cohort at the drain watchdog. */
export function finalizeDrainWatchdogState(source: GameState): DrainWatchdogStateResult {
  const originalCohort = Object.values(source.customers)
    .filter((customer) => customer.arrivalPeriodSequenceId === source.servicePeriod.sequenceId)
    .sort((left, right) => compareIds(left.id, right.id));
  if (originalCohort.length === 0) {
    return { state: source, servedTimeoutIds: [], unservedDepartureIds: [] };
  }
  const watchdogDraft = createDraft(source, source.tick);
  for (const customer of originalCohort.filter((candidate) => candidate.served)) {
    const snapshot = customer.mealOrderSnapshot;
    if (!snapshot || customer.mealSettlementCause !== undefined) continue;
    const settled = new Set(customer.settledMealLineIds ?? []);
    const mainSettled = settled.has(snapshot.lines[0].orderLine.lineId);
    const complementSettled = settled.has(snapshot.lines[1].orderLine.lineId);
    if (!mainSettled || complementSettled) continue;
    watchdogDraft.customers[customer.id] = finalizeFrozenMeal(
      watchdogDraft,
      customer,
      "served-timeout",
    );
  }
  const cohort = originalCohort.map((customer) => watchdogDraft.customers[customer.id] ?? customer);
  const guestOutcomes = cohort.flatMap((customer) => {
    const party = customer.partyId
      ? watchdogDraft.strategicGameplay.parties[customer.partyId]
      : undefined;
    if (!party) {
      return [{
        id: customer.id,
        served: customer.served,
        satisfaction: customer.satisfaction,
        ratingFactors: customer.ratingFactors,
        awardedVisitXp: customer.awardedVisitXp,
        firstServeBonusXp:
          customer.firstServeBonusXp ??
          (customer.firstServeBonusAwarded ? 2 : 0),
        stallDefinitionId: customer.servedStallDefinitionId,
        arrivalPeriodSequenceId: customer.arrivalPeriodSequenceId,
      }];
    }
    return party.members.map((member) => ({
      id: member.memberId,
      served: member.served,
      satisfaction: member.satisfaction ?? 3,
      ratingFactors: member.ratingFactors,
      awardedVisitXp: member.awardedVisitXp ?? 0,
      firstServeBonusXp: member.firstServeBonusXp ?? 0,
      stallDefinitionId: member.servedStallDefinitionIds?.[0],
      arrivalPeriodSequenceId: customer.arrivalPeriodSequenceId,
    }));
  });
  const served = guestOutcomes.filter((outcome) => outcome.served);
  const unserved = guestOutcomes.filter((outcome) => !outcome.served);
  const removedIds = new Set(cohort.map((customer) => customer.id));
  const removedPartyIds = new Set(
    cohort
      .map((customer) => customer.partyId)
      .filter((partyId): partyId is string => Boolean(partyId)),
  );
  const customers = Object.fromEntries(
    Object.entries(source.customers).filter(([id]) => !removedIds.has(id)),
  );
  const queues = Object.fromEntries(Object.entries(source.queues).map(([id, queue]) => [
    id,
    queue.filter((customerId) => !removedIds.has(customerId)),
  ]));
  const seatReservations = Object.fromEntries(
    Object.entries(source.seatReservations).filter(([, customerId]) => !removedIds.has(customerId)),
  );
  const xpCorrection = guestOutcomes.reduce((total, outcome) => {
    if (!outcome.served) return total;
    const desiredXp = 3 + (outcome.firstServeBonusXp ?? 0);
    return total + desiredXp - (outcome.awardedVisitXp ?? desiredXp);
  }, 0);
  const xp = Math.max(0, source.progression.xp + xpCorrection);
  const fallbackComponents = {
    foodQuality: 50,
    wait: 50,
    value: 50,
    walking: 70,
    comfort: 50,
    cleanliness: 50,
    ambience: 50,
  } as const;
  const visitRatings = [
    ...watchdogDraft.metrics.visitRatings,
    ...guestOutcomes.map((outcome) => ({
      customerId: outcome.id,
      walkingMetricVersion: 2 as const,
      score: Math.round(Math.max(0, Math.min(100, outcome.satisfaction * 20))),
      served: outcome.served,
      abandoned: !outcome.served,
      reason: outcome.served ? "served-timeout" : "unserved-period-close",
      stallDefinitionId: outcome.stallDefinitionId,
      components: { ...fallbackComponents, ...outcome.ratingFactors },
      day: source.servicePeriod.day,
      arrivalPeriodSequenceId: outcome.arrivalPeriodSequenceId,
    })),
  ].slice(-50);
  const events: SimulationEvent[] = [
    ...source.events,
    ...watchdogDraft.events.filter((entry) => entry.type === "meal-partial"),
    ...cohort.flatMap((customer, index) => {
      const party = customer.partyId
        ? watchdogDraft.strategicGameplay.parties[customer.partyId]
        : undefined;
      if (
        cohort.findIndex((candidate) => candidate.partyId === customer.partyId) !==
          index ||
        !party ||
        party.members.every((member) => member.served) ||
        party.members.every((member) => !member.served) ||
        party.terminalServiceOutcome === "partial-second-stop"
      ) {
        return [];
      }
      return [{
        type: "party-partial" as const,
        tick: source.tick,
        entityId: party.partyId,
        message: "drain-watchdog-partial",
      }];
    }),
    ...served.map((outcome) => ({
      type: "customer-despawned" as const,
      tick: source.tick,
      entityId: outcome.id,
      message: "served-timeout",
    })),
    ...unserved.map((outcome) => ({
      type: "customer-despawned" as const,
      tick: source.tick,
      entityId: outcome.id,
      message: "unserved-period-close",
    })),
  ];
  const strategicGameplay = {
    ...watchdogDraft.strategicGameplay,
    parties: Object.fromEntries(
      Object.entries(watchdogDraft.strategicGameplay.parties).filter(
        ([partyId]) => !removedPartyIds.has(partyId),
      ),
    ),
  };
  const finalizedState = updateProgressionSystems({
    ...source,
    customers,
    queues,
    seatReservations,
    strategicGameplay,
    economy: economyWithCompatibilityAliases({
      ...source.economy,
      abandonedVisits: source.economy.abandonedVisits + unserved.length,
    }),
    progression: {
      ...source.progression,
      xp,
      level: Math.max(source.progression.level, calculateLevel(xp)),
    },
    servicePeriod: { ...source.servicePeriod, phase: "debrief", cohortCustomerIds: [] },
    forecastArrivals: watchdogDraft.forecastArrivals,
    metrics: {
      ...watchdogDraft.metrics,
      despawnedCustomers:
        watchdogDraft.metrics.despawnedCustomers + guestOutcomes.length,
      completedCustomers: watchdogDraft.metrics.completedCustomers + served.length,
      visitRatings,
    },
    events,
  });
  return {
    state: finalizedState,
    servedTimeoutIds: served.map((outcome) => outcome.id),
    unservedDepartureIds: unserved.map((outcome) => outcome.id),
  };
}

function frozenMealProfile(
  snapshot: MealOrderSnapshot,
  servedLineIds: ReadonlySet<string>,
): NutritionProfile {
  const servedLines = snapshot.lines.filter((line) => servedLineIds.has(line.orderLine.lineId));
  const aggregate = aggregateNutritionProfiles(
    servedLines.map((line) => line.orderLine.nutritionProfile),
  );
  const intentFit = snapshot.fit.intentId && servedLines.length === snapshot.lines.length
    ? snapshot.fit.intentFit
    : snapshot.fit.intentId
      ? meanKnown(servedLines.map((line) => line.orderLine.intentFit))
      : undefined;
  return {
    id: `meal:${snapshot.orderId}:${servedLines.map((line) => line.orderLine.lineId).join("+")}`,
    dishId: `meal:${snapshot.offerId}`,
    status: servedLines.length > 0 && servedLines.every(
      (line) => line.orderLine.nutritionProfile?.status === "released",
    ) ? "released" : "unavailable",
    nutrients: aggregate.nutrients,
    intentFits: snapshot.fit.intentId && intentFit !== undefined
      ? { [snapshot.fit.intentId]: intentFit }
      : {},
    nutritionClass: "meal",
  };
}

function recordFrozenMealNutrition(
  draft: Draft,
  source: Customer,
  snapshot: MealOrderSnapshot,
  servedLineIds: ReadonlySet<string>,
  profile: NutritionProfile,
  requestResult: NutritionRequestResult | undefined,
): void {
  recordIntentRequest(draft, source.nutritionIntentId);
  const nutrition = draft.metrics.nutrition;
  const day = draft.source.servicePeriod.day;
  const today = nutrition.today.day === day
    ? nutrition.today
    : createEmptyNutritionDayMetrics(day);
  const nutrientTotals = { ...nutrition.nutrientTotals };
  const nutrientKnownCounts = { ...nutrition.nutrientKnownCounts };
  const dailyNutrientTotals = { ...today.nutrientTotals };
  const dailyNutrientKnownCounts = { ...today.nutrientKnownCounts };
  if (profile.status === "released") {
    for (const metric of NUTRITION_METRICS) {
      const value = profile.nutrients[metric];
      if (value.status !== "known") continue;
      nutrientTotals[metric] += value.value;
      nutrientKnownCounts[metric] += 1;
      dailyNutrientTotals[metric] += value.value;
      dailyNutrientKnownCounts[metric] += 1;
    }
  }
  const byIntent = { ...nutrition.byIntent };
  const dailyByIntent = { ...today.byIntent };
  let intentMatches = nutrition.intentMatches;
  let intentMisses = nutrition.intentMisses;
  let intentUnknowns = nutrition.intentUnknowns;
  if (source.nutritionIntentId && requestResult) {
    const intent = source.nutritionIntentId;
    byIntent[intent] = {
      ...byIntent[intent],
      matches: byIntent[intent].matches + (requestResult === "matched" ? 1 : 0),
      misses: byIntent[intent].misses + (requestResult === "missed" ? 1 : 0),
      unknowns: byIntent[intent].unknowns + (requestResult === "unknown" ? 1 : 0),
    };
    dailyByIntent[intent] = {
      ...dailyByIntent[intent],
      matches: dailyByIntent[intent].matches + (requestResult === "matched" ? 1 : 0),
      misses: dailyByIntent[intent].misses + (requestResult === "missed" ? 1 : 0),
      unknowns: dailyByIntent[intent].unknowns + (requestResult === "unknown" ? 1 : 0),
    };
    intentMatches += requestResult === "matched" ? 1 : 0;
    intentMisses += requestResult === "missed" ? 1 : 0;
    intentUnknowns += requestResult === "unknown" ? 1 : 0;
  }
  const servedLines = snapshot.lines.filter((line) => servedLineIds.has(line.orderLine.lineId));
  const dishServings = { ...nutrition.dishServings };
  const dailyDishServings = { ...today.dishServings };
  for (const line of servedLines) {
    if (line.orderLine.nutritionProfile?.status !== "released") continue;
    dishServings[line.orderLine.dishId] = (dishServings[line.orderLine.dishId] ?? 0) + 1;
    dailyDishServings[line.orderLine.dishId] = (dailyDishServings[line.orderLine.dishId] ?? 0) + 1;
  }
  const nonDefault = servedLines.some((line) => (
    line.orderLine.explanationCodes.includes("non-default-preparation")
  ));
  draft.metrics = {
    ...draft.metrics,
    trayReturnOpportunities: draft.metrics.trayReturnOpportunities + 1,
    nutrition: {
      ...nutrition,
      servedMeals: nutrition.servedMeals + 1,
      profiledServings: nutrition.profiledServings + (profile.status === "released" ? 1 : 0),
      nonDefaultVariantServings: nutrition.nonDefaultVariantServings + (nonDefault ? 1 : 0),
      intentMatches,
      intentMisses,
      intentUnknowns,
      byIntent,
      nutrientTotals,
      nutrientKnownCounts,
      dishServings,
      recentOutcomes: [
        ...nutrition.recentOutcomes,
        {
          customerId: source.id,
          day,
          intentId: source.nutritionIntentId,
          dishId: `meal:${snapshot.offerId}`,
          result: requestResult ?? "unknown",
          profile,
        },
      ].slice(-50),
      today: {
        ...today,
        servedMeals: today.servedMeals + 1,
        profiledServings: today.profiledServings + (profile.status === "released" ? 1 : 0),
        intentMatches: today.intentMatches + (requestResult === "matched" ? 1 : 0),
        intentMisses: today.intentMisses + (requestResult === "missed" ? 1 : 0),
        intentUnknowns: today.intentUnknowns + (requestResult === "unknown" ? 1 : 0),
        byIntent: dailyByIntent,
        nutrientTotals: dailyNutrientTotals,
        nutrientKnownCounts: dailyNutrientKnownCounts,
        dishServings: dailyDishServings,
      },
    },
  };
}

function finalizeFrozenMeal(
  draft: Draft,
  source: Customer,
  cause: "complete" | "second-stall-unavailable" | "served-timeout",
): Customer {
  const snapshot = source.mealOrderSnapshot;
  if (!snapshot) throw new Error("A frozen meal is required for combo finalization");
  const settledLineIds = new Set(source.settledMealLineIds ?? []);
  const profile = frozenMealProfile(snapshot, settledLineIds);
  const requestResult = source.nutritionIntentId
    ? nutritionRequestResult(source.nutritionIntentId, profile)
    : undefined;
  const conditionRating = cause === "complete" && snapshot.fit.conditionAwareFit !== undefined
    ? 1 + snapshot.fit.conditionAwareFit * 4
    : personalizedHealthRating(profile, source.healthConditions);
  const healthPreferenceResult = source.healthConditions.length > 0
    ? healthPreferenceResultForRating(conditionRating)
    : undefined;
  const healthImpact = source.healthConditions.length > 0
    ? healthImpactFromRating(conditionRating)
    : undefined;
  const conditionResult = source.healthConditions.length > 0
    ? healthPreferenceResult
    : undefined;
  const needResults = [requestResult, conditionResult].filter(
    (result): result is NutritionRequestResult => result !== undefined,
  );
  const combinedResult: NutritionRequestResult | undefined = needResults.length === 0
    ? undefined
    : needResults.some((result) => result === "missed")
      ? "missed"
      : needResults.every((result) => result === "matched")
        ? "matched"
        : "unknown";
  draft.forecastArrivals = draft.forecastArrivals.map((arrival) => arrival.customerId === source.id
    ? {
        ...arrival,
        nutritionResult: combinedResult,
        nutritionIntentResult: requestResult,
        conditionAwareResult: conditionResult,
      }
    : arrival);
  recordFrozenMealNutrition(draft, source, snapshot, settledLineIds, profile, requestResult);
  const servedLines = snapshot.lines.filter((line) => settledLineIds.has(line.orderLine.lineId));
  const averageAppeal = servedLines.reduce(
    (sum, line) => sum + line.orderLine.terms.starAppeal,
    0,
  ) / Math.max(1, servedLines.length);
  if (cause !== "complete") {
    event(draft, {
      type: "meal-partial",
      entityId: source.id,
      message: cause,
    });
  }
  const budget = source.forecastBudgetCents ?? getArchetype(draft, source).budgetCents;
  return {
    ...transition(draft, source, "seeking-seat"),
    targetStallId: undefined,
    orderedNutritionProfile: cloneNutritionProfile(profile),
    nutritionRequestResult: requestResult,
    personalizedHealthRating: conditionRating,
    healthImpact,
    healthPreferenceResult,
    mealSettlementCause: cause,
    hasTray: true,
    served: true,
    satisfaction: Math.max(
      0,
      Math.min(5, source.satisfaction + normalizeQuality(averageAppeal) / 100 + (healthImpact ?? 0)),
    ),
    ratingFactors: {
      ...source.ratingFactors,
      foodQuality: Math.max(0, Math.min(100, normalizeQuality(averageAppeal) + (healthImpact ?? 0) * 20)),
      value: Math.max(25, Math.min(100, 120 - (source.spentCents / Math.max(1, budget)) * 70)),
    },
  };
}

function completeFrozenMealStop(draft: Draft, source: Customer): Customer {
  const snapshot = source.mealOrderSnapshot;
  const stopIndex = source.mealStopIndex ?? 0;
  const stop = snapshot?.servingPlan.stops[stopIndex];
  if (!snapshot || !stop) throw new Error("A frozen meal stop is required for settlement");
  const alreadySettled = new Set(source.settledMealLineIds ?? []);
  const stopLines = snapshot.lines.filter((line) => (
    stop.preparationIds.includes(line.orderLine.preparationId!) &&
    !alreadySettled.has(line.orderLine.lineId)
  ));
  let customer = source;
  if (stopLines.length > 0) {
    const update = settleServedComponents(
      draft.economy,
      draft.progression,
      stopLines.map((line) => ({
        priceCents: line.orderLine.terms.priceCents,
        ingredientCostCents: line.orderLine.terms.ingredientCostCents,
        preparationId: line.orderLine.preparationId,
        legacyPreparationIds: [line.orderLine.dishId, line.orderLine.variantId]
          .filter((id): id is string => Boolean(id)),
      })),
      { countVisit: alreadySettled.size === 0, reputationGain: 0 },
    );
    draft.economy = update.economy;
    draft.progression = {
      ...update.progression,
      unlockedDefinitionIds: getUnlockedDefinitionIds(
        draft.source.catalog,
        update.progression.level,
        update.progression.unlockedDefinitionIds,
      ),
    };
    let ledger = draft.periodLedgers[source.arrivalPeriodSequenceId] ??
      createPeriodLedger(source.arrivalPeriodSequenceId);
    for (const line of stopLines) {
      const preparationId = line.orderLine.preparationId!;
      ledger = recordLedgerEntry(ledger, {
        id: `${source.id}-${line.orderLine.lineId}-sale`,
        kind: "gross-sale",
        amountCents: line.orderLine.terms.priceCents,
        tick: draft.tick,
        referenceId: line.orderLine.dishId,
        visitId: source.id,
        lineId: line.orderLine.lineId,
        preparationId,
      });
      if (line.orderLine.terms.ingredientCostCents > 0) {
        ledger = recordLedgerEntry(ledger, {
          id: `${source.id}-${line.orderLine.lineId}-ingredients`,
          kind: "ingredient-cost",
          amountCents: line.orderLine.terms.ingredientCostCents,
          tick: draft.tick,
          referenceId: line.orderLine.dishId,
          visitId: source.id,
          lineId: line.orderLine.lineId,
          preparationId,
        });
      }
      alreadySettled.add(line.orderLine.lineId);
      event(draft, {
        type: "sale-completed",
        entityId: source.id,
        amount: line.orderLine.terms.priceCents,
        amountCents: line.orderLine.terms.priceCents,
        message: preparationId,
      });
    }
    draft.periodLedgers = { ...draft.periodLedgers, [ledger.periodSequenceId]: ledger };
    if (update.levelUp) {
      event(draft, { type: "level-up", entityId: source.id, message: String(update.progression.level) });
    }
    const priceCents = asMoneyCents(
      stopLines.reduce((sum, line) => sum + line.orderLine.terms.priceCents, 0),
    );
    const mainWasServed = alreadySettled.has(snapshot.lines[0].orderLine.lineId);
    const stallObject = draft.objects[stop.stallInstanceId];
    const servedStallDefinitionIds = [...new Set([
      ...(source.servedStallDefinitionIds ?? []),
      ...(source.servedStallDefinitionId ? [source.servedStallDefinitionId] : []),
      ...(stallObject?.definitionId ? [stallObject.definitionId] : []),
    ])].sort(compareIds);
    customer = {
      ...source,
      settledMealLineIds: [...alreadySettled].sort(compareIds),
      served: mainWasServed,
      hasTray: mainWasServed,
      servedStallDefinitionId: source.servedStallDefinitionId ?? stallObject?.definitionId,
      servedStallDefinitionIds,
      spentCents: asMoneyCents(source.spentCents + priceCents),
      spent: centsToSgd(asMoneyCents(source.spentCents + priceCents)),
      awardedVisitXp: (source.awardedVisitXp ?? 0) + update.xpAwarded,
      firstServeBonusAwarded: Boolean(source.firstServeBonusAwarded || update.firstServeBonusAwarded),
      firstServeBonusXp: (source.firstServeBonusXp ?? 0) + update.xpAwarded,
    };
  }
  removeFromAllQueues(draft, source.id);
  if (alreadySettled.size === snapshot.lines.length) {
    return finalizeFrozenMeal(draft, customer, "complete");
  }
  const nextStopIndex = stopIndex + 1;
  const nextStop = snapshot.servingPlan.stops[nextStopIndex];
  const nextStall = getStall(draft, nextStop?.stallInstanceId);
  if (!nextStop || !nextStall) {
    return finalizeFrozenMeal(draft, customer, "second-stall-unavailable");
  }
  const queue = draft.queues[nextStall.object.id] ?? [];
  const targetCell = nextStall.queueCells[queue.length];
  if (!targetCell) {
    return {
      ...transition(draft, customer, "walking-to-queue"),
      targetStallId: nextStall.object.id,
      mealStopIndex: nextStopIndex,
    };
  }
  const path = requestPath(draft, customer.position, targetCell);
  if (!path) {
    return finalizeFrozenMeal(draft, customer, "second-stall-unavailable");
  }
  draft.queues[nextStall.object.id] = [...queue, customer.id];
  return {
    ...preparePath(transition(draft, customer, "walking-to-queue"), path),
    targetStallId: nextStall.object.id,
    mealStopIndex: nextStopIndex,
  };
}

export function stepSimulation(state: GameState): GameState {
  const deltaMs = state.config.fixedStepMs;
  const tick = state.tick + 1;
  const draft = createDraft(state, tick);
  draft.spawnCountdownMs -= deltaMs;
  const arrivalTarget = forecastArrivalTarget(
    draft.source.forecast,
    state.arrivalSamplingSeed,
  );

  if (
    draft.spawnCountdownMs <= 0 &&
    state.servicePeriod.phase === "arrivals" &&
    draft.forecastArrivals.length < arrivalTarget
  ) {
    spawnCustomer(draft, arrivalTarget - draft.forecastArrivals.length);
    const interval = forecastArrivalIntervalMs(
      draft.source.forecast,
      state.config.spawnIntervalMs,
      state.arrivalSamplingSeed,
    );
    draft.spawnCountdownMs += Math.max(1, interval);
  }

  const ids = Object.keys(draft.customers).sort((a, b) => {
    const aNumber = Number(a.slice(a.lastIndexOf("-") + 1));
    const bNumber = Number(b.slice(b.lastIndexOf("-") + 1));
    return aNumber - bNumber || compareIds(a, b);
  });
  for (const id of ids) {
    const customer = draft.customers[id];
    if (!customer) continue;
    const processed = processCustomer(draft, customer, deltaMs);
    if (processed) draft.customers[id] = processed;
    else delete draft.customers[id];
  }

  const activeCohortCustomerIds = Object.values(draft.customers)
    .filter((customer) => customer.arrivalPeriodSequenceId === state.servicePeriod.sequenceId)
    .map((customer) => customer.id)
    .sort(compareIds);
  const serviceAdvance = advanceServicePeriod(
    state.servicePeriod,
    deltaMs,
    activeCohortCustomerIds,
  );
  let servicePeriod = serviceAdvance.state;
  const overtimeCharge = state.servicePeriod.phase === "draining"
    ? overtimeUpkeepChargeDue(
        state.servicePeriod.drainElapsedMs,
        servicePeriod.drainElapsedMs,
        state.servicePeriod.overtimeUpkeepCharged,
      )
    : false;
  let periodLedger = draft.periodLedgers[state.servicePeriod.sequenceId]
    ?? createPeriodLedger(state.servicePeriod.sequenceId, state.economy.cashCents);
  const stallOpenElapsedMs = { ...state.servicePeriod.stallOpenElapsedMs };
  if (state.servicePeriod.phase === "arrivals") {
    const openDeltaMs = servicePeriod.arrivalElapsedMs - state.servicePeriod.arrivalElapsedMs;
    for (const stall of openStalls(draft)) {
      const previousOpenMs = stallOpenElapsedMs[stall.object.id] ?? 0;
      const nextOpenMs = previousOpenMs + openDeltaMs;
      const chargesDue = Math.floor(nextOpenMs / UPKEEP_INTERVAL_MS) -
        Math.floor(previousOpenMs / UPKEEP_INTERVAL_MS);
      stallOpenElapsedMs[stall.object.id] = nextOpenMs;
      const upkeepCents = stall.definition.upkeepCents;
      for (let chargeIndex = 0; chargeIndex < chargesDue; chargeIndex += 1) {
        const charge = chargeUpkeep(draft.economy, upkeepCents);
        draft.economy = charge.economy;
        periodLedger = recordLedgerEntry(periodLedger, {
          id: `period-${state.servicePeriod.sequenceId}-upkeep-${stall.object.id}-${Math.floor(previousOpenMs / UPKEEP_INTERVAL_MS) + chargeIndex + 1}`,
          kind: "upkeep",
          amountCents: charge.paidCents,
          tick,
          referenceId: stall.object.id,
        });
      }
    }
    servicePeriod = { ...servicePeriod, stallOpenElapsedMs };
  }
  if (overtimeCharge) {
    const overtimeStalls = openStalls(draft);
    const requestedCents = asMoneyCents(overtimeStalls.reduce(
      (total, stall) => total + stall.definition.upkeepCents,
      0,
    ));
    const charge = chargeUpkeep(draft.economy, requestedCents);
    draft.economy = charge.economy;
    periodLedger = recordLedgerEntry(periodLedger, {
      id: `period-${state.servicePeriod.sequenceId}-overtime-upkeep`,
      kind: "overtime-upkeep",
      amountCents: charge.paidCents,
      tick,
      referenceId: overtimeStalls.length > 0
        ? overtimeStalls.map((stall) => stall.object.id).join(",")
        : "no-open-stalls",
    });
    servicePeriod = { ...servicePeriod, overtimeUpkeepCharged: true };
  }
  draft.periodLedgers = {
    ...draft.periodLedgers,
    [state.servicePeriod.sequenceId]: periodLedger,
  };

  const next = {
    ...state,
    customers: draft.customers,
    queues: draft.queues,
    seatReservations: draft.seatReservations,
    economy: draft.economy,
    progression: draft.progression,
    periodLedgers: draft.periodLedgers,
    forecastArrivals: draft.forecastArrivals,
    strategicGameplay: draft.strategicGameplay,
    servicePeriod,
    rngState: draft.rngState,
    nextCustomerSequence: draft.nextCustomerSequence,
    spawnCountdownMs: draft.spawnCountdownMs,
    metrics: draft.metrics,
    tick,
    elapsedMs: state.elapsedMs + deltaMs,
    undoStack: state.undoStack.filter(
      (entry) => tick - entry.createdAtTick <= Math.ceil(state.config.buildUndoWindowMs / state.config.fixedStepMs),
    ),
    events: draft.events,
  };
  const progressed = updateProgressionSystems(next);
  return serviceAdvance.watchdogExpired
    ? finalizeDrainWatchdogState(progressed).state
    : progressed;
}

export function advanceSimulation(state: GameState, realDeltaMs: number): AdvanceResult {
  if (!Number.isFinite(realDeltaMs) || realDeltaMs < 0) throw new RangeError("Delta time must be a non-negative number");
  const fixedStepMs = state.config.fixedStepMs;
  let accumulator = state.accumulatorMs + realDeltaMs;
  const availableSteps = Math.floor(accumulator / fixedStepMs);
  const quality = state.qualityMode === "standard" ? state.config.standard : state.config.lowerEnd;
  const fixedSteps = Math.min(availableSteps, quality.maxFixedStepsPerAdvance);
  const droppedSteps = Math.max(0, availableSteps - fixedSteps);
  const droppedMs = droppedSteps * fixedStepMs;
  accumulator -= (fixedSteps + droppedSteps) * fixedStepMs;

  let working: GameState = { ...state, accumulatorMs: accumulator, events: [] };
  const events: SimulationEvent[] = [];
  for (let index = 0; index < fixedSteps; index += 1) {
    working = stepSimulation(working);
    events.push(...working.events);
  }
  working = { ...working, accumulatorMs: accumulator, events };
  return { state: working, fixedSteps, droppedMs, events };
}

export function assertSimulationInvariants(state: GameState): void {
  if (state.comboBoard.slots.length !== 3) {
    throw new Error("Combo Board must contain exactly three slots");
  }
  const boardIssues = validateComboBoardForState(state, state.comboBoard, true)
    .filter((issue) => issue.code !== "unavailable-stall");
  if (boardIssues.length > 0) {
    throw new Error(`Combo Board is invalid: ${boardIssues[0]!.message}`);
  }
  const customerIds = new Set(Object.keys(state.customers));
  const queued = new Set<string>();
  const invariantCatalog = {
    ...state.catalog,
    placeables: Object.fromEntries(Object.entries(state.catalog.placeables).map(([id, definition]) => [
      id,
      definition.stall ? { ...definition, stall: effectiveStallDefinition(state, id, definition.stall) } : definition,
    ])),
  };
  const queueCellsByStall = planStallQueueLayouts(
    state.map,
    state.objects,
    invariantCatalog,
    [
      ...state.accessPoints.map((point) => point.position),
      ...state.routeGuidePoints,
    ],
  );
  const blocked = getBlockedTileKeys(state.objects, state.catalog);
  const routeKeys = new Set<string>();
  for (const point of state.routeGuidePoints) {
    if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
      throw new Error("Preferred route points must use integer coordinates");
    }
    if (
      !isInBounds(state.map, point) ||
      point.x === 0 ||
      point.y === 0 ||
      point.x === state.map.width - 1 ||
      point.y === state.map.height - 1 ||
      getTile(state.map, point) !== "floor" ||
      blocked.has(pointKey(point))
    ) {
      throw new Error(`Preferred route point ${pointKey(point)} is invalid`);
    }
    if (routeKeys.has(pointKey(point))) throw new Error(`Preferred route point ${pointKey(point)} is repeated`);
    routeKeys.add(pointKey(point));
  }
  for (const [stallId, queue] of Object.entries(state.queues)) {
    const stall = state.objects[stallId];
    const definition = stall ? invariantCatalog.placeables[stall.definitionId] : undefined;
    if (!stall || definition?.kind !== "stall" || !definition.stall) {
      throw new Error(`Queue exists for missing or invalid stall ${stallId}`);
    }
    if (queue.length > definition.stall.queueCapacity) throw new Error(`Queue ${stallId} exceeds capacity`);
    const queueCells = queueCellsByStall[stallId] ?? [];
    if (queue.length > queueCells.length) throw new Error(`Queue ${stallId} exceeds its traversable queue route`);
    for (const customerId of queue) {
      const customer = state.customers[customerId];
      if (!customerIds.has(customerId) || !customer) throw new Error(`Queue ${stallId} references missing customer ${customerId}`);
      if (queued.has(customerId)) throw new Error(`Customer ${customerId} is in more than one queue`);
      if (customer.targetStallId !== stallId) throw new Error(`Queued customer ${customerId} targets another stall`);
      if (customer.status !== "walking-to-queue" && customer.status !== "queued" && customer.status !== "ordering") {
        throw new Error(`Customer ${customerId} has invalid queued status ${customer.status}`);
      }
      queued.add(customerId);
    }
  }
  const validSeatKeys = new Set(getSeatLocations(state.objects, state.catalog).map((seat) => seat.key));
  for (const [seatKey, customerId] of Object.entries(state.seatReservations)) {
    if (!validSeatKeys.has(seatKey)) throw new Error(`Reservation references missing seat ${seatKey}`);
    const customer = state.customers[customerId];
    if (!customer) throw new Error(`Seat ${seatKey} is reserved by missing customer ${customerId}`);
    const party = customer.partyId
      ? state.strategicGameplay.parties[customer.partyId]
      : undefined;
    if (
      party
        ? party.leaderCustomerId !== customer.id ||
          !party.seatKeys.includes(seatKey)
        : customer.reservedSeatKey !== seatKey
    ) {
      throw new Error(`Seat reservation ${seatKey} is not mirrored by its visit`);
    }
  }
  const activePartyMemberIds = new Set<string>();
  for (const [partyId, party] of Object.entries(
    state.strategicGameplay.parties,
  )) {
    const leader = state.customers[party.leaderCustomerId];
    if (!leader || leader.partyId !== partyId) {
      throw new Error(`Party ${partyId} has no canonical active leader`);
    }
    if (
      party.memberCustomerIds.length < 2 ||
      party.memberCustomerIds.length > 6 ||
      party.members.length !== party.memberCustomerIds.length ||
      party.memberCustomerIds[0] !== party.leaderCustomerId ||
      new Set(party.memberCustomerIds).size !==
        party.memberCustomerIds.length ||
      party.members.some(
        (member, index) =>
          member.memberId !== party.memberCustomerIds[index] ||
          activePartyMemberIds.has(member.memberId),
      )
    ) {
      throw new Error(`Party ${partyId} has invalid atomic membership`);
    }
    for (const memberId of party.memberCustomerIds) {
      activePartyMemberIds.add(memberId);
    }
    if (
      party.stallIds.length > 2 ||
      party.nextStopIndex < 0 ||
      party.nextStopIndex > party.stallIds.length
    ) {
      throw new Error(`Party ${partyId} has invalid serving progress`);
    }
    if (
      party.seatKeys.some(
        (seatKey) =>
          state.seatReservations[seatKey] !== party.leaderCustomerId,
      )
    ) {
      throw new Error(`Party ${partyId} has an orphaned seat reservation`);
    }
  }
  for (const customer of Object.values(state.customers)) {
    if (customer.reservedSeatKey && state.seatReservations[customer.reservedSeatKey] !== customer.id) {
      throw new Error(`Customer ${customer.id} has an orphaned seat reservation`);
    }
    const party = customer.partyId
      ? state.strategicGameplay.parties[customer.partyId]
      : undefined;
    if (
      party?.seatKeys.length &&
      (
        !customer.reservedSeatKey ||
        !party.seatKeys.includes(customer.reservedSeatKey)
      )
    ) {
      throw new Error(`Party ${party.partyId} has no primary reserved seat`);
    }
    if (!Number.isFinite(customer.position.x) || !Number.isFinite(customer.position.y)) {
      throw new Error(`Customer ${customer.id} has an invalid position`);
    }
    if (!Number.isFinite(customer.walkingDistanceTiles) || customer.walkingDistanceTiles < 0) {
      throw new Error(`Customer ${customer.id} has an invalid walking distance`);
    }
    if (customer.orderLineSnapshot && customer.mealOrderSnapshot) {
      throw new Error(`Customer ${customer.id} has both a single and combo order snapshot`);
    }
    if (customer.mealOrderSnapshot) {
      const [main, complement] = customer.mealOrderSnapshot.lines;
      if (main.orderLine.mealRole !== "main") {
        throw new Error(`Customer ${customer.id}'s combo does not start with a main`);
      }
      if (complement.orderLine.mealRole !== "side" && complement.orderLine.mealRole !== "drink") {
        throw new Error(`Customer ${customer.id}'s combo has an invalid complement`);
      }
      const validLineIds = new Set(customer.mealOrderSnapshot.lines.map((line) => line.orderLine.lineId));
      if ((customer.settledMealLineIds ?? []).some((lineId) => !validLineIds.has(lineId))) {
        throw new Error(`Customer ${customer.id} settled an unknown combo line`);
      }
      if ((customer.settledMealLineIds ?? []).includes(complement.orderLine.lineId) &&
        !(customer.settledMealLineIds ?? []).includes(main.orderLine.lineId)) {
        throw new Error(`Customer ${customer.id} settled a complement before its main`);
      }
      const settled = new Set(customer.settledMealLineIds ?? []);
      const settledCount = settled.size;
      const expectedSpentCents = customer.mealOrderSnapshot.lines
        .filter((line) => settled.has(line.orderLine.lineId))
        .reduce((sum, line) => sum + line.orderLine.terms.priceCents, 0);
      if (customer.spentCents !== expectedSpentCents) {
        throw new Error(`Customer ${customer.id}'s meal spend does not match settled lines`);
      }
      const stopIndex = customer.mealStopIndex;
      if (
        stopIndex === undefined ||
        stopIndex >= customer.mealOrderSnapshot.servingPlan.stops.length
      ) {
        throw new Error(`Customer ${customer.id} has an invalid meal stop`);
      }
      const activeStatuses = new Set<CustomerStatus>([
        "walking-to-queue", "queued", "ordering", "waiting-for-food",
      ]);
      const postStatuses = new Set<CustomerStatus>([
        "seeking-seat", "walking-to-seat", "eating", "seeking-tray-return",
        "walking-to-tray-return", "walking-to-exit",
      ]);
      if (customer.mealSettlementCause === undefined) {
        const validActive = settledCount === 0
          ? customer.status === "waiting-for-food" && stopIndex === 0 && !customer.served && !customer.hasTray
          : settledCount === 1 &&
            customer.mealOrderSnapshot.servingPlan.stops.length === 2 &&
            stopIndex === 1 &&
            (
              activeStatuses.has(customer.status) ||
              Boolean(
                party &&
                customer.status === "choosing-stall" &&
                party.nextStopIndex === 1,
              )
            ) &&
            customer.served &&
            customer.hasTray;
        if (!validActive) throw new Error(`Customer ${customer.id} has invalid active meal progress`);
      } else if (customer.mealSettlementCause === "complete") {
        if (
          settledCount !== 2 ||
          stopIndex !== customer.mealOrderSnapshot.servingPlan.stops.length - 1 ||
          !postStatuses.has(customer.status) ||
          !customer.served ||
          (customer.status !== "walking-to-exit" && !customer.hasTray)
        ) {
          throw new Error(`Customer ${customer.id} has invalid completed meal progress`);
        }
      } else if (customer.mealSettlementCause === "second-stall-unavailable") {
        if (
          settledCount !== 1 ||
          customer.mealOrderSnapshot.servingPlan.stops.length !== 2 ||
          stopIndex !== 1 ||
          !postStatuses.has(customer.status) ||
          !customer.served ||
          (customer.status !== "walking-to-exit" && !customer.hasTray)
        ) {
          throw new Error(`Customer ${customer.id} has invalid partial meal progress`);
        }
      } else if (customer.mealSettlementCause === "served-timeout") {
        throw new Error(`Customer ${customer.id} persisted after its meal watchdog timeout`);
      } else if (
        settledCount !== 0 ||
        stopIndex !== 0 ||
        customer.status !== "walking-to-exit" ||
        customer.served ||
        customer.hasTray
      ) {
        throw new Error(`Customer ${customer.id} has invalid cancelled meal progress`);
      }
    } else if ((customer.settledMealLineIds?.length ?? 0) > 0 || customer.mealStopIndex !== undefined) {
      throw new Error(`Customer ${customer.id} has combo progress without a combo order snapshot`);
    }
  }
  for (const [name, value] of Object.entries(state.economy)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Economy value ${name} is invalid`);
  }
  for (const [name, value] of Object.entries(state.metrics)) {
    if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) throw new Error(`Metric ${name} is invalid`);
  }
  if (
    state.metrics.visitRatings.length > 50 ||
    state.metrics.visitRatings.some(
      (rating) =>
        rating.walkingMetricVersion !== 2 ||
        !Number.isFinite(rating.score) ||
        rating.score < 0 ||
        rating.score > 100 ||
        Object.values(rating.components).some(
          (component) => !Number.isFinite(component) || component < 0 || component > 100,
        ),
    )
  ) {
    throw new Error("Visit ratings are invalid");
  }
  const activeGuestCount = Object.values(state.customers).reduce(
    (total, customer) => {
      const party = customer.partyId
        ? state.strategicGameplay.parties[customer.partyId]
        : undefined;
      return total + (party ? party.members.length : 1);
    },
    0,
  );
  if (
    state.metrics.spawnedCustomers !==
    state.metrics.despawnedCustomers + activeGuestCount
  ) {
    throw new Error("Spawn/despawn/active customer accounting does not balance");
  }
}

function canonicalDigestValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalDigestValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareIds(left, right))
        .map(([key, entry]) => [key, canonicalDigestValue(entry)]),
    );
  }
  return value;
}

export function simulationDigest(state: GameState): string {
  const customers = Object.values(state.customers)
    .sort((a, b) => compareIds(a.id, b.id))
    .map((customer) => ({
      id: customer.id,
      status: customer.status,
      at: pointKey(customer.position),
      stall: customer.targetStallId,
      seat: customer.reservedSeatKey,
      spentCents: customer.spentCents,
      orderLine: customer.orderLineSnapshot?.lineId,
      mealOrder: customer.mealOrderSnapshot
        ? {
            offerId: customer.mealOrderSnapshot.offerId,
            lines: customer.mealOrderSnapshot.lines.map((line) => line.orderLine.lineId),
            settled: customer.settledMealLineIds,
            stop: customer.mealStopIndex,
            cause: customer.mealSettlementCause,
          }
        : undefined,
    }));
  return JSON.stringify(canonicalDigestValue({
    tick: state.tick,
    rngState: state.rngState,
    economy: state.economy,
    progression: state.progression,
    queues: state.queues,
    reservations: state.seatReservations,
    comboBoard: state.comboBoard,
    strategicGameplay: state.strategicGameplay,
    customers,
    metrics: state.metrics,
  }));
}
