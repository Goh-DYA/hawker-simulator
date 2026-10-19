/**
 * Customer choices: which stall to queue at, which dish to order, and which seat and tray
 * return to walk to.
 *
 * Every random draw keeps its position, so seeded runs stay identical.
 */
import { getObjectTrayReturnPoint, getSeatLocations, type SeatLocation } from "./grid";
import {
  activePreparationCount,
  beginExit,
  getArchetype,
  openStalls,
  preparePath,
  requestPath,
  transition,
  type Draft,
  type StallRuntime,
} from "./draft";
import { nextFloat } from "./rng";
import { compareIds } from "./ordering";
import {
  activeNutritionVariant,
  bestEnabledNutritionIntentFit,
  bestEnabledPersonalizedHealthRating,
  dishStarRating,
  healthDishChoiceBonus,
  healthStallChoiceBonus,
  nutritionDishChoiceBonus,
  nutritionIntentFit,
  nutritionStallChoiceBonus,
  personalizedHealthRating,
} from "./nutrition";
import { getGlobalWayfinding } from "./utility";
import type {
  Customer,
  DishDefinition,
  GridPoint,
  NutritionVariant,
  PlaceableDefinition,
  PlacedObject,
} from "./types";

// Stall and dish choice weights (chooseStall, chooseDish, boundedDishDemandAppeal).

/** Base demand assumed for a dish that does not author one. */
const DEFAULT_DISH_DEMAND = 0.5;
/** Appeal per unit of dish demand above or below the neutral demand. */
const DISH_DEMAND_APPEAL_WEIGHT = 0.8;
/** Stall menu appeal per dish preference tag the guest shares. */
const STALL_MENU_PREFERENCE_WEIGHT = 2.25;
/** Novelty preference assumed for an archetype that does not author one. */
const DEFAULT_NOVELTY_PREFERENCE = 0.35;
/** Scale of the seeded novelty term in a stall score. */
const STALL_NOVELTY_WEIGHT = 2.5;
/** Committed wait counted for each order already being prepared. */
const PREPARING_ORDER_WAIT_WEIGHT = 0.5;
/** Stall score per unit of authored stall popularity. */
const STALL_POPULARITY_WEIGHT = 1.25;
/** Stall score penalty per committed wait unit, scaled by queue sensitivity. */
const COMMITTED_WAIT_WEIGHT = 1.5;
/** Stall score penalty for a completely full queue. */
const QUEUE_LOAD_WEIGHT = 2.25;
/** Stall score penalty per path step, scaled by distance sensitivity and wayfinding. */
const STALL_DISTANCE_WEIGHT = 0.18;
/** Dish score per dish preference tag the guest shares. */
const DISH_PREFERENCE_WEIGHT = 2;
/** Scale of the seeded dish tie-breaker, small enough never to outweigh a real preference. */
const DISH_CHOICE_JITTER = 0.001;

/**
 * Lists the dishes on a stall's menu that the customer can still afford.
 *
 * @param draft - The draft whose catalog is used.
 * @param stall - The stall whose menu is checked.
 * @param customer - The customer whose budget and spending apply.
 * @returns The affordable dishes, in menu order.
 */
function affordableDishes(draft: Draft, stall: StallRuntime, customer: Customer): readonly DishDefinition[] {
  const archetype = getArchetype(draft, customer);
  return (stall.definition.stall?.dishIds ?? [])
    .map((id) => draft.source.catalog.dishes[id])
    .filter((dish): dish is DishDefinition => Boolean(dish && dish.price + customer.spent <= archetype.budget));
}

/**
 * Converts a dish's authored base demand into a bounded appeal term around neutral demand.
 *
 * @param dish - The dish to score.
 * @returns The appeal, positive above neutral demand and negative below it.
 */
export function boundedDishDemandAppeal(dish: DishDefinition) {
  const demand = Math.max(0, Math.min(1, dish.baseDemand ?? DEFAULT_DISH_DEMAND));
  return (demand - DEFAULT_DISH_DEMAND) * DISH_DEMAND_APPEAL_WEIGHT;
}

/**
 * Picks the best-scoring open stall with room in its queue and sends the customer to join it.
 *
 * Draws one novelty roll per candidate stall, in stall ID order.
 *
 * @param draft - The draft whose queues, metrics and RNG are edited.
 * @param source - The customer choosing a stall.
 * @returns The customer walking to the queue, or leaving when no stall fits.
 */
export function chooseStall(draft: Draft, source: Customer): Customer {
  const archetype = getArchetype(draft, source);
  const wayfinding = getGlobalWayfinding(draft.objects, draft.source.catalog);
  let best: { stall: StallRuntime; path: readonly GridPoint[]; score: number } | undefined;
  for (const stall of openStalls(draft)) {
    const config = stall.definition.stall as NonNullable<PlaceableDefinition["stall"]>;
    const queue = draft.queues[stall.object.id] ?? [];
    const dishes = affordableDishes(draft, stall, source);
    const effectiveCapacity = Math.min(config.queueCapacity, stall.queueCells.length);
    const targetQueueCell = stall.queueCells[queue.length];
    if (queue.length >= effectiveCapacity || !targetQueueCell || dishes.length === 0) continue;
    const path = requestPath(draft, source.position, targetQueueCell);
    if (!path) continue;
    const preferredTags = new Set(archetype.preferenceTags ?? []);
    const menuAppeal = Math.max(
      ...dishes.map((dish) => {
        const preferenceMatches = (dish.preferenceTags ?? []).filter((tag) => preferredTags.has(tag)).length;
        return (
          dishStarRating(dish) * archetype.qualitySensitivity +
          boundedDishDemandAppeal(dish) +
          preferenceMatches * STALL_MENU_PREFERENCE_WEIGHT -
          dish.price * archetype.priceSensitivity
        );
      }),
    );
    const nutritionBonus = nutritionStallChoiceBonus(
      bestEnabledNutritionIntentFit(dishes, source.nutritionIntentId),
    );
    const healthBonus = healthStallChoiceBonus(
      bestEnabledPersonalizedHealthRating(dishes, source.healthConditions),
      source.healthConditions,
    );
    const random = nextFloat(draft.rngState);
    draft.rngState = random.state;
    const novelty = random.value * (archetype.noveltyPreference ?? DEFAULT_NOVELTY_PREFERENCE) * STALL_NOVELTY_WEIGHT;
    const queueLoad = queue.length / Math.max(1, effectiveCapacity);
    const committedWait = queue.length + activePreparationCount(draft, stall.object.id) * PREPARING_ORDER_WAIT_WEIGHT;
    const score =
      menuAppeal +
      nutritionBonus +
      healthBonus +
      config.popularity * STALL_POPULARITY_WEIGHT +
      config.quality * archetype.qualitySensitivity +
      novelty -
      committedWait * archetype.queueSensitivity * COMMITTED_WAIT_WEIGHT -
      queueLoad * QUEUE_LOAD_WEIGHT -
      (path.length - 1) * archetype.distanceSensitivity * STALL_DISTANCE_WEIGHT * (1 - wayfinding);
    if (!best || score > best.score || (score === best.score && stall.object.id < best.stall.object.id)) {
      best = { stall, path, score };
    }
  }
  if (!best) return beginExit(draft, { ...source, departureReason: "no-stall" }, true);
  draft.queues[best.stall.object.id] = [...(draft.queues[best.stall.object.id] ?? []), source.id];
  const customer = preparePath(transition(draft, source, "walking-to-queue"), best.path);
  return { ...customer, targetStallId: best.stall.object.id };
}

/** The dish a customer orders and its active nutrition variant. */
export interface DishChoice {
  readonly dish: DishDefinition;
  readonly variant?: NutritionVariant;
}

/**
 * Picks the best-scoring affordable dish at a stall.
 *
 * Draws one tie-break roll per affordable dish, in dish ID order.
 *
 * @param draft - The draft whose catalog and RNG are used.
 * @param stall - The stall the customer is ordering at.
 * @param customer - The ordering customer.
 * @returns The chosen dish and variant, or `undefined` when nothing is affordable.
 */
export function chooseDish(draft: Draft, stall: StallRuntime, customer: Customer): DishChoice | undefined {
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
      matches * DISH_PREFERENCE_WEIGHT -
      dish.price * archetype.priceSensitivity +
      nutritionBonus +
      healthBonus +
      random.value * DISH_CHOICE_JITTER;
    if (!best || score > best.score || (score === best.score && dish.id < best.dish.id)) {
      best = { dish, variant, score };
    }
  }
  return best ? { dish: best.dish, variant: best.variant } : undefined;
}

/**
 * Finds the nearest free, reachable seat, breaking ties by seat key.
 *
 * @param draft - The draft whose objects, reservations and metrics are used.
 * @param customer - The customer looking for a seat.
 * @returns The seat and the path to it, or `undefined` when none is reachable.
 */
export function findSeat(draft: Draft, customer: Customer): { seat: SeatLocation; path: readonly GridPoint[] } | undefined {
  let best: { seat: SeatLocation; path: readonly GridPoint[] } | undefined;
  for (const seat of getSeatLocations(draft.objects, draft.source.catalog)) {
    if (draft.seatReservations[seat.key] || draft.unclearedTrays[seat.key]) continue;
    const path = requestPath(draft, customer.position, seat.point);
    if (!path) continue;
    if (!best || path.length < best.path.length || (path.length === best.path.length && seat.key < best.seat.key)) {
      best = { seat, path };
    }
  }
  return best;
}

/**
 * Looks up the seat a customer still holds a reservation for.
 *
 * @param draft - The draft whose objects and reservations are used.
 * @param customer - The seated or seating customer.
 * @returns The reserved seat, or `undefined` when the reservation is gone.
 */
export function findReservedSeat(draft: Draft, customer: Customer): SeatLocation | undefined {
  if (!customer.reservedSeatKey || draft.seatReservations[customer.reservedSeatKey] !== customer.id) return undefined;
  return getSeatLocations(draft.objects, draft.source.catalog).find((seat) => seat.key === customer.reservedSeatKey);
}

/**
 * Finds the nearest reachable tray return, breaking ties by object ID.
 *
 * @param draft - The draft whose objects and metrics are used.
 * @param customer - The customer carrying a tray.
 * @returns The tray return, its drop-off point and the path to it, or `undefined` when none is reachable.
 */
export function findTrayReturn(
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

/**
 * Resolves the drop-off point of the tray return a customer is heading to.
 *
 * @param draft - The draft whose objects are used.
 * @param id - The targeted tray return, if any.
 * @returns The drop-off point, or `undefined` when the target is missing or no longer a tray return.
 */
export function findTargetTrayPoint(draft: Draft, id: string | undefined): GridPoint | undefined {
  if (!id) return undefined;
  const object = draft.objects[id];
  if (!object || draft.source.catalog.placeables[object.definitionId]?.kind !== "tray-return") return undefined;
  return getObjectTrayReturnPoint(object, draft.source.catalog);
}
