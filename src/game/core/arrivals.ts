/**
 * Customer arrivals: who arrives (archetype weighting and the nutrition intents and health
 * conditions a new customer may carry), the spawn itself, and the adaptive interval until
 * the next arrival.
 *
 * Every random draw keeps its position, so seeded runs stay identical.
 */
import { MAX_REPUTATION } from "./economy";
import { getSeatLocations } from "./grid";
import { event, openStalls, type Draft } from "./draft";
import { nextFloat } from "./rng";
import { compareIds } from "./ordering";
import { get_quality_settings } from "./state";
import {
  HEALTH_CONDITIONS,
  healthConditionFromRoll,
  healthConditionRating,
  NUTRITION_INTENTS,
  nutritionIntentFromRoll,
  record_intent_request,
} from "./nutrition";
import { operatingDay, operatingMinuteOfDay } from "./progression";
import { active_rush_window, compute_time_demand, is_last_orders, ms_until_day_end } from "./rush";
import { compute_rush_windows, get_archetype_factor, get_today_card } from "./neighbourhood";
import type { CustomerArchetype, HealthCondition, NutritionIntent } from "./types";

/** Spawn weight of a scheduled persona outside its visit window. */
const OFF_SCHEDULE_PERSONA_WEIGHT = 0.2;

// Adaptive arrival model (stepSimulation). The spawn interval is the configured base interval
// divided by demand (reputation x stall offer x time of day) and multiplied by backpressure.
// The time-of-day curve and last orders live in `rush.ts`.

/** Smallest infrastructure capacity used when measuring occupancy pressure. */
const MIN_ARRIVAL_INFRASTRUCTURE = 4;
/** Infrastructure capacity contributed by each stall preparation slot. */
const PREPARATION_SLOT_INFRASTRUCTURE = 3;
/** Infrastructure capacity contributed by each entrance. */
const ENTRANCE_INFRASTRUCTURE = 4;
/** Arrival demand at zero reputation. */
const BASE_REPUTATION_DEMAND = 0.75;
/** Extra arrival demand added at maximum reputation. */
const REPUTATION_DEMAND_RANGE = 1.25;
/** Lowest stall-offer demand, so a small or unpopular centre still receives guests. */
const MIN_STALL_DEMAND = 0.6;
/** Popularity assumed for a stall definition that does not author one. */
const DEFAULT_STALL_POPULARITY = 0.5;
/** Backpressure added per squared unit of occupancy pressure. */
const OCCUPANCY_BACKPRESSURE_WEIGHT = 2.5;
/** Backpressure added per squared unit of queue pressure. */
const QUEUE_BACKPRESSURE_WEIGHT = 3;
/**
 * Share of the occupancy and queue backpressure kept during a rush, so a crowded layout shows
 * as visible queues and seat searches instead of quietly receiving fewer guests.
 */
const RUSH_BACKPRESSURE_SHARE = 0.5;
/** Backpressure added per unit of reported arrival performance pressure. */
const PERFORMANCE_BACKPRESSURE_WEIGHT = 4;
/** Lowest combined demand multiplier, which caps how fast guests can arrive. */
const MIN_ARRIVAL_DEMAND = 0.2;
/** Shortest spawn interval, in milliseconds. */
const MIN_SPAWN_INTERVAL_MS = 1;

/**
 * Lists the nutrition intents some open stall can currently fit with a released, unlocked variant.
 *
 * @param draft - The draft whose stalls, progression and catalog are used.
 * @returns The eligible intents, in `NUTRITION_INTENTS` order.
 */
function eligibleNutritionIntents(draft: Draft): readonly NutritionIntent[] {
  const eligible = new Set<NutritionIntent>();
  for (const stall of openStalls(draft)) {
    const definitionId = stall.object.definitionId;
    const masteryRank = draft.progression.stallMastery[definitionId]?.rank ?? 1;
    const dishIds = stall.definition.stall?.allDishIds ?? stall.definition.stall?.dishIds ?? [];
    for (const dishId of dishIds) {
      const dish = draft.source.catalog.dishes[dishId];
      if (
        !dish ||
        draft.progression.level < (dish.unlockLevel ?? 1) ||
        draft.progression.peakReputation < (dish.unlockReputation ?? 0)
      ) {
        continue;
      }
      for (const variant of dish.nutritionVariants ?? []) {
        const profile = variant.profile;
        if (variant.unlockRank > masteryRank || !profile || profile.status !== "released") continue;
        for (const intent of NUTRITION_INTENTS) {
          if (typeof profile.intentFits[intent] === "number") eligible.add(intent);
        }
      }
    }
  }
  return NUTRITION_INTENTS.filter((intent) => eligible.has(intent));
}

/**
 * Lists the health conditions some open stall can currently rate with an unlocked variant.
 *
 * @param draft - The draft whose stalls, progression and catalog are used.
 * @returns The eligible conditions, in `HEALTH_CONDITIONS` order.
 */
function eligibleHealthConditions(draft: Draft): readonly HealthCondition[] {
  const eligible = new Set<HealthCondition>();
  for (const stall of openStalls(draft)) {
    const definitionId = stall.object.definitionId;
    const masteryRank = draft.progression.stallMastery[definitionId]?.rank ?? 1;
    const dishIds = stall.definition.stall?.allDishIds ?? stall.definition.stall?.dishIds ?? [];
    for (const dishId of dishIds) {
      const dish = draft.source.catalog.dishes[dishId];
      if (
        !dish ||
        draft.progression.level < (dish.unlockLevel ?? 1) ||
        draft.progression.peakReputation < (dish.unlockReputation ?? 0)
      ) {
        continue;
      }
      for (const variant of dish.nutritionVariants ?? []) {
        if (variant.unlockRank > masteryRank) continue;
        for (const condition of HEALTH_CONDITIONS) {
          if (healthConditionRating(variant.profile, condition) !== undefined) {
            eligible.add(condition);
          }
        }
      }
    }
  }
  return HEALTH_CONDITIONS.filter((condition) => eligible.has(condition));
}

/**
 * Counts a customer's nutrition intent request in the lifetime and today metrics.
 *
 * Starts a fresh today record when the operating day has changed.
 *
 * @param draft - The draft whose metrics are edited.
 * @param intent - The requested intent; nothing is recorded when it is absent.
 */
export function recordIntentRequest(draft: Draft, intent: NutritionIntent | undefined): void {
  if (!intent) return;
  draft.metrics = {
    ...draft.metrics,
    nutrition: record_intent_request(draft.metrics.nutrition, intent, operatingDay(draft.source.elapsedMs)),
  };
}

/**
 * Weighs how likely an archetype is to arrive at the current time and progression.
 *
 * @param archetype - The candidate archetype.
 * @param level - The centre level.
 * @param reputation - The centre's peak reputation, which every unlock gate reads.
 * @param elapsedMs - The simulated time, which sets the hour of the operating day.
 * @param unlockedDefinitionIds - The unlocked placeables the archetype may require.
 * @returns Zero while the archetype is locked, otherwise 1 for an unscheduled archetype or its scheduled or off-schedule weight.
 */
export function customerArchetypeSpawnWeight(
  archetype: CustomerArchetype,
  level: number,
  reputation: number,
  elapsedMs: number,
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

  const hour = operatingMinuteOfDay(elapsedMs) / 60;
  const isScheduled =
    hour >= archetype.visitSchedule.startHour &&
    hour < archetype.visitSchedule.endHour;
  return isScheduled
    ? archetype.visitSchedule.peakMultiplier
    : OFF_SCHEDULE_PERSONA_WEIGHT;
}

/**
 * Applies a neighbourhood day factor to a value, leaving it untouched without one.
 *
 * The factor is the last multiplication, and a missing factor skips it, so a day without a card
 * produces exactly the same floating-point values as a centre without a neighbourhood.
 *
 * @param value - The value to scale.
 * @param factor - Today's factor, if any.
 * @returns The scaled value.
 */
function apply_day_factor(value: number, factor: number | undefined): number {
  return factor === undefined ? value : value * factor;
}

/**
 * Spawns one customer at the least crowded entrance, if an archetype can arrive and a stall is open.
 *
 * Consumes the archetype roll, then the health roll, then the nutrition roll, in that order.
 *
 * @param draft - The draft that receives the customer, its RNG draws, metrics and event.
 */
export function spawnCustomer(draft: Draft): void {
  const archetypes = Object.values(draft.source.catalog.archetypes).sort((a, b) => compareIds(a.id, b.id));
  if (archetypes.length === 0 || openStalls(draft).length === 0) return;
  const weightedArchetypes = archetypes.map((archetype) => ({
    archetype,
    weight: apply_day_factor(
      customerArchetypeSpawnWeight(
        archetype,
        draft.progression.level,
        draft.progression.peakReputation,
        draft.source.elapsedMs,
        draft.progression.unlockedDefinitionIds,
      ),
      get_archetype_factor(draft.source, archetype.id),
    ),
  }));
  const totalWeight = weightedArchetypes.reduce(
    (total, candidate) => total + candidate.weight,
    0,
  );
  if (totalWeight <= 0) return;

  const roll = nextFloat(draft.rngState);
  draft.rngState = roll.state;
  let remainingWeight = roll.value * totalWeight;
  let selected = weightedArchetypes.find((candidate) => candidate.weight > 0);
  for (const candidate of weightedArchetypes) {
    if (candidate.weight <= 0) continue;
    selected = candidate;
    remainingWeight -= candidate.weight;
    if (remainingWeight < 0) break;
  }
  if (!selected) return;
  const eligibleIntents = eligibleNutritionIntents(draft);
  const eligibleConditions = eligibleHealthConditions(draft);
  let nutritionIntentId: NutritionIntent | undefined;
  let healthConditions: readonly HealthCondition[] = [];
  if (eligibleConditions.length > 0) {
    const healthRoll = nextFloat(draft.rngState);
    draft.rngState = healthRoll.state;
    const healthCondition = healthConditionFromRoll(
      draft.progression.level,
      eligibleConditions,
      healthRoll.value,
    );
    healthConditions = healthCondition ? [healthCondition] : [];
  }
  // The level guard gates RNG consumption; do not remove it.
  if (draft.progression.level >= 2 && eligibleIntents.length > 0) {
    const nutritionRoll = nextFloat(draft.rngState);
    draft.rngState = nutritionRoll.state;
    nutritionIntentId = nutritionIntentFromRoll(
      draft.progression.level,
      eligibleIntents,
      nutritionRoll.value,
    );
  }
  const id = `customer-${draft.nextCustomerSequence}`;
  const entrances = draft.source.accessPoints.filter((point) => point.kind === "entrance");
  const entrance = [...entrances].sort((a, b) => {
    const nearbyA = Object.values(draft.customers).filter((customer) => Math.abs(customer.position.x - a.position.x) + Math.abs(customer.position.y - a.position.y) <= 3).length;
    const nearbyB = Object.values(draft.customers).filter((customer) => Math.abs(customer.position.x - b.position.x) + Math.abs(customer.position.y - b.position.y) <= 3).length;
    return nearbyA - nearbyB || compareIds(a.id, b.id);
  })[0];
  if (!entrance) return;
  draft.nextCustomerSequence += 1;
  draft.customers[id] = {
    id,
    archetypeId: selected.archetype.id,
    status: "choosing-stall",
    position: { ...entrance.position },
    path: [],
    pathIndex: 0,
    movementProgress: 0,
    stateElapsedMs: 0,
    visitElapsedMs: 0,
    walkingDistanceTiles: 0,
    patienceRemainingMs: selected.archetype.patienceMs,
    satisfaction: 3,
    healthConditions,
    nutritionIntentId,
    sourceEntranceId: entrance.id,
    hasTray: false,
    served: false,
    spent: 0,
    stuckMs: 0,
  };
  draft.metrics = { ...draft.metrics, spawnedCustomers: draft.metrics.spawnedCustomers + 1 };
  event(draft, { type: "customer-spawned", entityId: id });
}

/**
 * Computes the delay until the next arrival, right after a spawn.
 *
 * Without a fixed arrival interval, the configured base interval is divided by demand
 * (reputation x stall offer x time of day) and multiplied by occupancy, queue and
 * performance backpressure. Call it after `spawnCustomer`, so the new customer counts
 * towards occupancy.
 *
 * @param draft - The draft of the current step, after the spawn.
 * @returns The interval to add to the spawn countdown, in milliseconds; at least `MIN_SPAWN_INTERVAL_MS`.
 */
export function compute_next_spawn_interval_ms(draft: Draft): number {
  const state = draft.source;
  const active = Object.keys(draft.customers).length;
  const seats = getSeatLocations(draft.objects, draft.source.catalog).length;
  const stalls = openStalls(draft);
  const serviceCapacity = stalls.reduce((sum, stall) => sum + (stall.definition.stall?.preparationCapacity ?? 1), 0);
  const queueCount = Object.values(draft.queues).reduce((sum, queue) => sum + queue.length, 0);
  const queueCapacity = stalls.reduce((sum, stall) => sum + Math.min(stall.queueCells.length, stall.definition.stall?.queueCapacity ?? 0), 0);
  const infrastructure = Math.max(
    MIN_ARRIVAL_INFRASTRUCTURE,
    seats +
      serviceCapacity * PREPARATION_SLOT_INFRASTRUCTURE +
      draft.source.accessPoints.filter((point) => point.kind === "entrance").length * ENTRANCE_INFRASTRUCTURE,
  );
  const occupancyPressure = active / infrastructure;
  const queuePressure = queueCount / Math.max(1, queueCapacity);
  const reputationDemand = BASE_REPUTATION_DEMAND + (draft.progression.reputation / MAX_REPUTATION) * REPUTATION_DEMAND_RANGE;
  const stallDemand = Math.max(
    MIN_STALL_DEMAND,
    Math.sqrt(Math.max(1, stalls.length)) *
      (stalls.reduce((sum, stall) => sum + (stall.definition.stall?.popularity ?? DEFAULT_STALL_POPULARITY), 0) /
        Math.max(1, stalls.length)),
  );
  const minute = operatingMinuteOfDay(draft.source.elapsedMs);
  const rush_windows = compute_rush_windows(draft.source);
  const timeDemand = compute_time_demand(minute, rush_windows);
  const crowd_share = active_rush_window(minute, rush_windows) ? RUSH_BACKPRESSURE_SHARE : 1;
  const backpressure =
    1 +
    occupancyPressure ** 2 * OCCUPANCY_BACKPRESSURE_WEIGHT * crowd_share +
    queuePressure ** 2 * QUEUE_BACKPRESSURE_WEIGHT * crowd_share +
    draft.source.arrivalPerformancePressure * PERFORMANCE_BACKPRESSURE_WEIGHT;
  const quality = get_quality_settings(state);
  if (quality.maxActiveCustomers !== undefined) return Math.max(MIN_SPAWN_INTERVAL_MS, state.config.spawnIntervalMs);
  const demand = apply_day_factor(reputationDemand * stallDemand * timeDemand, get_today_card(state)?.arrivalFactor);
  const interval = (state.config.spawnIntervalMs / Math.max(MIN_ARRIVAL_DEMAND, demand)) * backpressure;
  const next_arrival_ms = draft.source.elapsedMs + interval;
  const day_end_ms = draft.source.elapsedMs + ms_until_day_end(draft.source.elapsedMs);
  // An arrival that would land during last orders waits for the next day's opening instead.
  const deferred_interval = next_arrival_ms < day_end_ms && is_last_orders(next_arrival_ms)
    ? day_end_ms - draft.source.elapsedMs
    : interval;
  return Math.max(MIN_SPAWN_INTERVAL_MS, deferred_interval);
}

/**
 * Whether the adaptive arrival model is closed to new guests for the rest of the day.
 *
 * Arrivals stop at last orders. A fixed arrival interval (`maxActiveCustomers`) ignores the
 * operating clock and never closes.
 *
 * @param draft - The draft of the current step.
 * @returns True while last orders apply to the adaptive model.
 */
export function is_arrival_window_closed(draft: Draft): boolean {
  return get_quality_settings(draft.source).maxActiveCustomers === undefined && is_last_orders(draft.source.elapsedMs);
}
