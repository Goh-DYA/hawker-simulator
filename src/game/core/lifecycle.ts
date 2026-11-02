/**
 * The customer lifecycle: one fixed step of a customer's visit state machine.
 *
 * Internal to core; it is not re-exported from the barrel. `processCustomer` moves a customer
 * through choosing a stall, queueing, ordering, waiting, finding a seat, eating, returning the
 * tray and walking to an exit, recovering when a target disappears. Its helpers edit the step
 * draft in place in a fixed order, so seeded runs stay identical.
 *
 * In a centre that keeps operating hours (`follows_operating_hours`) the visit also follows the
 * closing schedule in `rush.ts`, and admission in `closing.ts` lets in only guests who can be
 * served: a guest whom the closing leaves nothing to order goes home without a rating; from last
 * orders a guest still choosing a stall goes home without a rating, while a guest already in a
 * queue may still order while the kitchen can cook in time; from the closing call a guest who never
 * reached a counter goes home unrated, diners finish their meals (leaving their trays for the night
 * crew) and a served guest still looking for a seat takes the meal away, rated with
 * `CLOSING_TAKEAWAY_COMFORT`; and `clear_hall_at_closing` ends every visit still running when the
 * day ends, so each day opens with an empty hall.
 */
import { samePoint } from "./grid";
import {
  activePreparationCount,
  beginExit,
  chooseExit,
  event,
  getStall,
  markRecovery,
  moveToward,
  preparePath,
  releaseSeat,
  removeFromAllQueues,
  transition,
  type Draft,
} from "./draft";
import {
  chooseDish,
  chooseStall,
  is_kitchen_closed_for,
  findReservedSeat,
  findSeat,
  findTargetTrayPoint,
  findTrayReturn,
} from "./choices";
import { getCustomerQueueCell } from "./queueing";
import { cloneNutritionProfile, healthPreferenceResultForRating, personalizedHealthRating } from "./nutrition";
import {
  adjustedEatingDurationMs,
  compute_tapered_rating_gain,
  getUtilityInfluence,
  utilitySatisfactionBonus,
  type UtilityInfluence,
} from "./utility";
import { completeSale, settleVisitRating } from "./visits";
import { get_today_card } from "./neighbourhood";
import {
  compute_uncleared_neighbour_penalty,
  is_tray_returner,
  leave_tray,
  TRAY_RETURN_MAX_PATH_TILES,
} from "./clearing";
import { follows_operating_hours } from "./closing";
import { compare_customer_ids } from "./ordering";
import { is_closing_call, is_last_orders } from "./rush";
import type { Customer, CustomerStatus } from "./types";

// Eating and tray-return factors (processCustomer).

/** Satisfaction gained for finishing a meal. */
const MEAL_SATISFACTION_BONUS = 0.25;
/** Lowest comfort rating after a meal. */
const MIN_MEAL_COMFORT = 45;
/** Comfort rating before nearby ambience utilities. */
const BASE_MEAL_COMFORT = 76;
/** Raw comfort points per unit of nearby ambience, before the taper. */
const MEAL_COMFORT_AMBIENCE_WEIGHT = 6;
/**
 * Comfort points that count in full (ambience 2); each doubling of the raw points after that adds
 * `MEAL_COMFORT_STEP_PER_DOUBLING`, so comfort reaches 100 at ambience 32.
 */
const MEAL_COMFORT_FULL_RATE_POINTS = 12;
/** Comfort points each doubling of the raw comfort points adds past the full-rate stretch. */
const MEAL_COMFORT_STEP_PER_DOUBLING = 3;
/** Lowest cleanliness rating after a meal. */
const MIN_MEAL_CLEANLINESS = 35;
/** Comfort component of a served guest who gave up looking for a free seat. */
const NO_SEAT_COMFORT = 30;
/**
 * Comfort component of a served guest who never sat down because the centre closed: between a
 * guest who gave up on finding a seat and the default of a served guest, since closing cut the
 * search short.
 */
const CLOSING_TAKEAWAY_COMFORT = 45;
/** Cleanliness rating before nearby cleanliness utilities. */
const BASE_MEAL_CLEANLINESS = 82;
/** Raw cleanliness points per unit of nearby cleanliness, before the taper. */
const MEAL_CLEANLINESS_WEIGHT = 8;
/** Raw cleanliness points per unit of nearby cleaning efficiency, before the taper. */
const MEAL_CLEANING_EFFICIENCY_WEIGHT = 6;
/**
 * Net cleanliness points (after the uncleared-tray penalty) that count in full (cleanliness 1);
 * each doubling after that adds `MEAL_CLEANLINESS_STEP_PER_DOUBLING`, so cleanliness reaches 100
 * at 128 net points (cleanliness 16).
 */
const MEAL_CLEANLINESS_FULL_RATE_POINTS = 8;
/** Cleanliness points each doubling of the net points adds past the full-rate stretch. */
const MEAL_CLEANLINESS_STEP_PER_DOUBLING = 2.5;
/** Lowest ambience rating after a meal. */
const MIN_MEAL_AMBIENCE = 40;
/** Ambience rating before nearby ambience utilities. */
const BASE_MEAL_AMBIENCE = 72;
/** Raw ambience points per unit of nearby ambience, before the taper. */
const MEAL_AMBIENCE_WEIGHT = 9;
/**
 * Ambience points that count in full (ambience 2); each doubling of the raw points after that adds
 * `MEAL_AMBIENCE_STEP_PER_DOUBLING`, so the ambience part reaches 100 at ambience 32.
 */
const MEAL_AMBIENCE_FULL_RATE_POINTS = 18;
/** Ambience points each doubling of the raw ambience points adds past the full-rate stretch. */
const MEAL_AMBIENCE_STEP_PER_DOUBLING = 2.5;
/** Satisfaction gained for returning a tray. */
const TRAY_RETURN_SATISFACTION_BONUS = 0.1;
/** Extra tray-return satisfaction per unit of nearby cleaning efficiency. */
const TRAY_RETURN_CLEANING_WEIGHT = 0.25;

/**
 * Sends a customer back to choosing a stall after its stall, queue place or order was lost.
 *
 * Leaves every queue, counts the recovery and clears the stall target, in that order.
 *
 * @param draft - The draft whose queues, metrics and events are edited.
 * @param customer - The customer whose target was lost.
 * @param message - Why the target had to be recovered.
 * @param should_clear_order - Whether the ordered dish is cleared as well.
 * @returns The customer choosing a stall again.
 */
function recover_to_stall_choice(
  draft: Draft,
  customer: Customer,
  message: string,
  should_clear_order: boolean,
): Customer {
  removeFromAllQueues(draft, customer.id);
  markRecovery(draft, customer, message);
  const recovered: Customer = { ...transition(draft, customer, "choosing-stall"), targetStallId: undefined };
  return should_clear_order ? { ...recovered, orderedDishId: undefined } : recovered;
}

/**
 * Sends a customer back to seeking a seat after its reserved seat was lost.
 *
 * Releases the seat, counts the recovery and changes status, in that order.
 *
 * @param draft - The draft whose seats, metrics and events are edited.
 * @param customer - The customer whose seat was lost.
 * @param message - Why the seat had to be recovered.
 * @returns The customer seeking a seat again.
 */
function recover_to_seat_search(draft: Draft, customer: Customer, message: string): Customer {
  const released = releaseSeat(draft, customer);
  markRecovery(draft, released, message);
  return transition(draft, released, "seeking-seat");
}

/**
 * Advances a customer in one status by one fixed step.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @param delta_ms - The fixed step length.
 * @returns The updated customer, or `undefined` once it has despawned.
 */
type StatusHandler = (draft: Draft, customer: Customer, delta_ms: number) => Customer | undefined;

/**
 * Picks a stall for a customer who has just arrived or lost its target.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @returns The updated customer.
 */
function handle_choosing_stall(draft: Draft, customer: Customer): Customer {
  return chooseStall(draft, customer);
}

/**
 * Walks a customer to its queue cell, recovering when the stall, queue place or path is lost.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @param delta_ms - The fixed step length.
 * @returns The updated customer.
 */
function handle_walking_to_queue(draft: Draft, customer: Customer, delta_ms: number): Customer {
  const stall = getStall(draft, customer.targetStallId);
  if (!stall) {
    return recover_to_stall_choice(draft, customer, "Stall unavailable while walking to queue", true);
  }
  const queue = draft.queues[stall.object.id] ?? [];
  const queueCell = getCustomerQueueCell(queue, customer.id, stall.queueCells);
  if (!queueCell) {
    return recover_to_stall_choice(draft, customer, "Queue assignment disappeared", false);
  }
  const movement = moveToward(draft, customer, queueCell, delta_ms);
  customer = movement.customer;
  if (movement.failed) {
    return recover_to_stall_choice(draft, customer, "Queue path became unreachable", false);
  }
  if (!movement.arrived) return customer;
  return transition(draft, customer, "queued");
}

/**
 * Holds a customer in its queue, draining patience, until it reaches the head and the stall has capacity.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @param delta_ms - The fixed step length.
 * @returns The updated customer.
 */
function handle_queued(draft: Draft, customer: Customer, delta_ms: number): Customer {
  const stall = getStall(draft, customer.targetStallId);
  const queue = customer.targetStallId ? draft.queues[customer.targetStallId] ?? [] : [];
  if (!stall || !queue.includes(customer.id)) {
    return recover_to_stall_choice(draft, customer, "Queue target was removed", false);
  }
  const queueCell = getCustomerQueueCell(queue, customer.id, stall.queueCells);
  if (!queueCell) {
    return recover_to_stall_choice(draft, customer, "Queue cell became unavailable", false);
  }
  if (!samePoint(customer.position, queueCell)) return transition(draft, customer, "walking-to-queue");
  const queueUtility = getUtilityInfluence(
    draft.objects,
    draft.source.catalog,
    customer.position,
  );
  customer = {
    ...customer,
    patienceRemainingMs:
      customer.patienceRemainingMs - delta_ms * (1 - queueUtility.queuePatience),
  };
  if (customer.patienceRemainingMs <= 0) {
    return beginExit(draft, { ...customer, departureReason: "long-queue" }, true);
  }
  if (
    queue[0] === customer.id &&
    activePreparationCount(draft, stall.object.id) < (stall.definition.stall?.preparationCapacity ?? 1)
  ) {
    return transition(draft, customer, "ordering");
  }
  return customer;
}

/**
 * Takes a customer's order once the stall's ordering time has passed, then frees its queue place.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @returns The updated customer.
 */
function handle_ordering(draft: Draft, customer: Customer): Customer {
  const stall = getStall(draft, customer.targetStallId);
  if (!stall) {
    return recover_to_stall_choice(draft, customer, "Stall closed during ordering", false);
  }
  if (customer.stateElapsedMs < (stall.definition.stall?.orderMs ?? 0)) return customer;
  const choice = chooseDish(draft, stall, customer);
  if (!choice && is_kitchen_closed_for(draft, stall, customer)) {
    return beginExit(draft, { ...customer, isSentHome: true }, false);
  }
  if (!choice) return beginExit(draft, { ...customer, departureReason: "no-dish" }, true);
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
    nutritionRequestResult: undefined,
    personalizedHealthRating: healthRating,
    healthImpact: undefined,
    healthPreferenceResult: customer.healthConditions.length > 0
      ? healthPreferenceResultForRating(healthRating)
      : undefined,
  };
}

/**
 * Waits for the ordered dish to be prepared, then completes the sale.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @returns The updated customer.
 */
function handle_waiting_for_food(draft: Draft, customer: Customer): Customer {
  const stall = getStall(draft, customer.targetStallId);
  const dish = customer.orderedDishId ? draft.source.catalog.dishes[customer.orderedDishId] : undefined;
  if (!stall || !dish) {
    return recover_to_stall_choice(draft, customer, "Order target disappeared during preparation", true);
  }
  if (customer.stateElapsedMs < dish.preparationMs) return customer;
  return completeSale(draft, customer, dish);
}

/**
 * Reserves the nearest free seat, draining patience while none is available.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @param delta_ms - The fixed step length.
 * @returns The updated customer.
 */
function handle_seeking_seat(draft: Draft, customer: Customer, delta_ms: number): Customer {
  const selected = findSeat(draft, customer);
  if (!selected) {
    customer = { ...customer, patienceRemainingMs: customer.patienceRemainingMs - delta_ms };
    if (customer.patienceRemainingMs <= 0) {
      return beginExit(
        draft,
        {
          ...customer,
          departureReason: "no-seat",
          ratingFactors: { ...customer.ratingFactors, comfort: NO_SEAT_COMFORT },
        },
        false,
      );
    }
    return customer;
  }
  draft.seatReservations[selected.seat.key] = customer.id;
  return {
    ...preparePath(transition(draft, customer, "walking-to-seat"), selected.path),
    reservedSeatKey: selected.seat.key,
  };
}

/**
 * Walks a customer to its reserved seat, finding another when the seat is lost.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @param delta_ms - The fixed step length.
 * @returns The updated customer.
 */
function handle_walking_to_seat(draft: Draft, customer: Customer, delta_ms: number): Customer {
  const seat = findReservedSeat(draft, customer);
  if (!seat) {
    return recover_to_seat_search(draft, customer, "Reserved seat was removed");
  }
  const movement = moveToward(draft, customer, seat.point, delta_ms);
  if (movement.failed) {
    return recover_to_seat_search(draft, movement.customer, "Reserved seat became unreachable");
  }
  return movement.arrived ? transition(draft, movement.customer, "eating") : movement.customer;
}

/**
 * Lets a customer eat at its seat, then sets its comfort, cleanliness and ambience factors.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @returns The updated customer.
 */
function handle_eating(draft: Draft, customer: Customer): Customer {
  const seat = findReservedSeat(draft, customer);
  const dish = customer.orderedDishId ? draft.source.catalog.dishes[customer.orderedDishId] : undefined;
  if (!seat) {
    return recover_to_seat_search(draft, customer, "Seat was removed while eating");
  }
  const diningUtility = getUtilityInfluence(
    draft.objects,
    draft.source.catalog,
    seat.point,
  );
  const linger = get_today_card(draft.source)?.eatingTimeFactor;
  const baseEatingMs = dish
    ? adjustedEatingDurationMs(dish.eatingMs, diningUtility.eatingSpeed)
    : Number.POSITIVE_INFINITY;
  const adjustedEatingMs = linger === undefined ? baseEatingMs : baseEatingMs * linger;
  if (!dish) {
    // Without a dish the meal never ends, and eating is exempt from the visit cap.
    return beginExit(draft, releaseSeat(draft, customer), false);
  }
  // At the closing call every diner finishes up, with the meal counted in full.
  const is_finishing_up = follows_operating_hours(draft.source) && is_closing_call(draft.source.elapsedMs);
  if (customer.stateElapsedMs < adjustedEatingMs && !is_finishing_up) return customer;
  const uncleared_penalty = compute_uncleared_neighbour_penalty(draft, seat.point);
  // After the closing call diners leave their trays for the night crew, so they are out in time.
  const returns_tray = !is_finishing_up && will_return_tray(draft, customer);
  customer = releaseSeat(draft, customer);
  if (!returns_tray) leave_tray(draft, seat.key, seat.point);
  const finished: Customer = {
    ...(returns_tray ? transition(draft, customer, "seeking-tray-return") : customer),
    satisfaction: Math.max(
      0,
      Math.min(
        5,
        customer.satisfaction + MEAL_SATISFACTION_BONUS + utilitySatisfactionBonus(diningUtility),
      ),
    ),
    ratingFactors: { ...customer.ratingFactors, ...compute_meal_rating_factors(diningUtility, uncleared_penalty) },
  };
  return returns_tray ? finished : beginExit(draft, { ...finished, hasTray: false }, false);
}

/**
 * Rates a finished meal's seat: its comfort, cleanliness and ambience factors.
 *
 * Each factor starts from its base and adds the seat's raw points (the utility times its weight)
 * through `compute_tapered_rating_gain`, so the first points count in full and later ones keep
 * paying at a decreasing rate until the factor reaches 100. The uncleared-tray penalty is taken
 * from the raw cleanliness points before the taper, so a very clean area still softens a tray
 * left nearby, and a penalty larger than the support counts in full.
 *
 * @param dining_utility - The utility influence at the seat.
 * @param uncleared_penalty - The cleanliness penalty for trays left on neighbouring seats.
 * @returns The three seat factors, each within its floor and 100.
 */
export function compute_meal_rating_factors(
  dining_utility: Pick<UtilityInfluence, "ambience" | "cleanliness" | "cleaningEfficiency">,
  uncleared_penalty = 0,
): { readonly comfort: number; readonly cleanliness: number; readonly ambience: number } {
  const comfort_gain = compute_tapered_rating_gain(
    dining_utility.ambience * MEAL_COMFORT_AMBIENCE_WEIGHT,
    MEAL_COMFORT_FULL_RATE_POINTS,
    MEAL_COMFORT_STEP_PER_DOUBLING,
  );
  const cleanliness_gain = compute_tapered_rating_gain(
    dining_utility.cleanliness * MEAL_CLEANLINESS_WEIGHT +
      dining_utility.cleaningEfficiency * MEAL_CLEANING_EFFICIENCY_WEIGHT -
      uncleared_penalty,
    MEAL_CLEANLINESS_FULL_RATE_POINTS,
    MEAL_CLEANLINESS_STEP_PER_DOUBLING,
  );
  const ambience_gain = compute_tapered_rating_gain(
    dining_utility.ambience * MEAL_AMBIENCE_WEIGHT,
    MEAL_AMBIENCE_FULL_RATE_POINTS,
    MEAL_AMBIENCE_STEP_PER_DOUBLING,
  );
  return {
    comfort: Math.max(MIN_MEAL_COMFORT, Math.min(100, BASE_MEAL_COMFORT + comfort_gain)),
    cleanliness: Math.max(MIN_MEAL_CLEANLINESS, Math.min(100, BASE_MEAL_CLEANLINESS + cleanliness_gain)),
    ambience: Math.max(MIN_MEAL_AMBIENCE, Math.min(100, BASE_MEAL_AMBIENCE + ambience_gain)),
  };
}

/**
 * Decides, at the end of a meal, whether a guest takes their tray to a tray return.
 *
 * The guest must be a tray returner by habit, and a reachable tray return must be within
 * `TRAY_RETURN_MAX_PATH_TILES` of their seat.
 *
 * @param draft - The draft whose objects and archetypes are read.
 * @param customer - The guest finishing their meal, still at their seat.
 * @returns True when the guest returns their tray; otherwise they leave it on the seat.
 */
function will_return_tray(draft: Draft, customer: Customer): boolean {
  const archetype = draft.source.catalog.archetypes[customer.archetypeId];
  if (!is_tray_returner(customer, archetype?.trayReturnChance, draft.neighbourhood?.worldSeed)) return false;
  const tray_return = findTrayReturn(draft, customer);
  return tray_return !== undefined && tray_return.path.length - 1 <= TRAY_RETURN_MAX_PATH_TILES;
}

/**
 * Picks a tray return, or sends the customer to the exit when none is reachable.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @returns The updated customer.
 */
function handle_seeking_tray_return(draft: Draft, customer: Customer): Customer {
  const selected = findTrayReturn(draft, customer);
  if (!selected) return beginExit(draft, customer, false);
  return {
    ...preparePath(transition(draft, customer, "walking-to-tray-return"), selected.path),
    targetTrayReturnId: selected.object.id,
  };
}

/**
 * Walks a customer to its tray return, then sends it to the exit without its tray.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @param delta_ms - The fixed step length.
 * @returns The updated customer.
 */
function handle_walking_to_tray_return(draft: Draft, customer: Customer, delta_ms: number): Customer {
  const point = findTargetTrayPoint(draft, customer.targetTrayReturnId);
  if (!point) {
    markRecovery(draft, customer, "Tray-return target was removed");
    return { ...transition(draft, customer, "seeking-tray-return"), targetTrayReturnId: undefined };
  }
  const movement = moveToward(draft, customer, point, delta_ms);
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
  draft.metrics = { ...draft.metrics, trayReturns: draft.metrics.trayReturns + 1 };
  return beginExit(
    draft,
    {
      ...movement.customer,
      hasTray: false,
      satisfaction: Math.min(
        5,
        movement.customer.satisfaction +
          TRAY_RETURN_SATISFACTION_BONUS +
          returnUtility.cleaningEfficiency * TRAY_RETURN_CLEANING_WEIGHT,
      ),
    },
    false,
  );
}

/**
 * Walks a customer to its exit, then settles its visit rating and despawns it.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @param delta_ms - The fixed step length.
 * @returns The updated customer, or `undefined` once it has despawned.
 */
function handle_walking_to_exit(draft: Draft, customer: Customer, delta_ms: number): Customer | undefined {
  const targetExit = draft.source.accessPoints.find((point) => point.id === customer.targetExitId && point.kind === "exit")
    ?? chooseExit(draft, customer);
  if (!targetExit) return undefined;
  const movement = moveToward(draft, customer, targetExit.position, delta_ms);
  if (!movement.arrived && !movement.failed) return movement.customer;
  despawn_customer(draft, movement.customer, movement.failed ? "forced-after-stuck" : undefined);
  return undefined;
}

/**
 * Settles a leaving guest's visit rating, frees their queue place and seat, counts them and
 * emits their despawn event. A guest sent home at last orders leaves no rating.
 *
 * @param draft - The draft the step edits.
 * @param source - The leaving guest.
 * @param message - The despawn event's message, when it is not the one their visit implies.
 */
function despawn_customer(draft: Draft, source: Customer, message?: string): void {
  const is_unrated = source.isSentHome === true && !source.served;
  const customer = is_unrated
    ? source
    : settleVisitRating(
        draft,
        source,
        !source.served,
        source.departureReason ?? (source.served ? "served" : "abandoned"),
      );
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
    message: message ?? (is_unrated ? "sent-home" : customer.served ? "completed" : "abandoned"),
  });
}

/**
 * Ends every visit still running when the operating day ends, so the next day opens with an
 * empty hall: each guest left inside is settled as if they had walked out, in
 * `compare_customer_ids` order. A served guest is rated as served (with
 * `CLOSING_TAKEAWAY_COMFORT` if they never sat down); an unserved guest still waiting on the
 * centre leaves no rating; an unserved guest already leaving for another reason keeps that
 * reason's rating. The queues and seat reservations are emptied, and the night clears every tray
 * left on a table.
 *
 * @param draft - The draft of the step that ends the day.
 */
export function clear_hall_at_closing(draft: Draft): void {
  for (const id of Object.keys(draft.customers).sort(compare_customer_ids)) {
    const customer = draft.customers[id]!;
    const is_waiting_on_centre = !customer.served && CLOSING_UNRATED_STATUSES.has(customer.status);
    const settled = customer.served && SEATLESS_STATUSES.has(customer.status)
      ? with_takeaway_comfort(customer)
      : is_waiting_on_centre
        ? { ...customer, isSentHome: true }
        : customer;
    despawn_customer(draft, settled, "closing");
  }
  draft.customers = {};
  draft.queues = Object.fromEntries(Object.keys(draft.queues).map((stall_id) => [stall_id, []]));
  draft.seatReservations = {};
  draft.unclearedTrays = {};
}

/**
 * Statuses of a guest who has not yet reached a stall's counter, whom the closing call sends home.
 * A guest already ordering or waiting for food is still served.
 */
const PRE_ORDER_STATUSES: ReadonlySet<CustomerStatus> = new Set([
  "choosing-stall",
  "walking-to-queue",
  "queued",
]);

/** Statuses of an unserved guest still waiting on the centre, who leaves unrated at closing. */
const CLOSING_UNRATED_STATUSES: ReadonlySet<CustomerStatus> = new Set([
  ...PRE_ORDER_STATUSES,
  "ordering",
  "waiting-for-food",
]);

/** Statuses of a served guest who has not sat down to eat. */
const SEATLESS_STATUSES: ReadonlySet<CustomerStatus> = new Set(["seeking-seat", "walking-to-seat"]);

/**
 * Gives a served guest who never sat down because the centre closed the closing takeaway comfort.
 *
 * @param customer - The served guest.
 * @returns The guest with their comfort factor set.
 */
function with_takeaway_comfort(customer: Customer): Customer {
  return {
    ...customer,
    hasTray: false,
    ratingFactors: { ...customer.ratingFactors, comfort: CLOSING_TAKEAWAY_COMFORT },
  };
}

/**
 * Applies the closing schedule to one guest: from last orders a guest still choosing a stall goes
 * home unrated, from the closing call so does a guest who never reached a counter, and from the
 * closing call a served guest still looking for a seat takes their meal away with the closing
 * takeaway comfort. Diners finishing up is handled in
 * `handle_eating`.
 *
 * @param draft - The draft the step edits.
 * @param customer - The customer, with this step's time already added.
 * @returns The guest heading home, or `undefined` when the schedule does not move them.
 */
function apply_closing_schedule(draft: Draft, customer: Customer): Customer | undefined {
  if (!follows_operating_hours(draft.source)) return undefined;
  const elapsed_ms = draft.source.elapsedMs;
  const is_choosing_late = customer.status === "choosing-stall" && is_last_orders(elapsed_ms);
  const is_still_waiting = PRE_ORDER_STATUSES.has(customer.status) && is_closing_call(elapsed_ms);
  if (!customer.served && (is_choosing_late || is_still_waiting)) {
    return beginExit(draft, { ...customer, isSentHome: true }, false);
  }
  if (customer.served && SEATLESS_STATUSES.has(customer.status) && is_closing_call(elapsed_ms)) {
    return beginExit(draft, with_takeaway_comfort(customer), false);
  }
  return undefined;
}

/**
 * Statuses the visit cap never interrupts: leaving, and a seated guest finishing their meal and
 * clearing their tray. Movement failures still end those visits through stuck recovery.
 */
const VISIT_CAP_EXEMPT_STATUSES: ReadonlySet<CustomerStatus> = new Set([
  "eating",
  "seeking-tray-return",
  "walking-to-tray-return",
  "walking-to-exit",
]);

/** The handler for every customer status; a status without one fails to compile. */
const CUSTOMER_STATUS_HANDLERS = {
  "choosing-stall": handle_choosing_stall,
  "walking-to-queue": handle_walking_to_queue,
  "queued": handle_queued,
  "ordering": handle_ordering,
  "waiting-for-food": handle_waiting_for_food,
  "seeking-seat": handle_seeking_seat,
  "walking-to-seat": handle_walking_to_seat,
  "eating": handle_eating,
  "seeking-tray-return": handle_seeking_tray_return,
  "walking-to-tray-return": handle_walking_to_tray_return,
  "walking-to-exit": handle_walking_to_exit,
} satisfies Record<CustomerStatus, StatusHandler>;

/**
 * Advances one customer through one fixed step of its visit state machine.
 *
 * Adds the step to the visit and state timers, applies the closing schedule, sends a customer past
 * the maximum visit length towards the exit, then runs the handler for its status.
 *
 * @param draft - The draft the step edits; queues, seats, metrics and events may change.
 * @param source - The customer at the start of the step.
 * @param deltaMs - The fixed step length.
 * @returns The updated customer, or `undefined` once it has despawned at an exit.
 */
export function processCustomer(draft: Draft, source: Customer, deltaMs: number): Customer | undefined {
  const customer: Customer = {
    ...source,
    visitElapsedMs: source.visitElapsedMs + deltaMs,
    stateElapsedMs: source.stateElapsedMs + deltaMs,
  };

  // The closing schedule goes first, so a guest whose visit cap falls due after last orders goes
  // home unrated like the guests around them.
  const sent_home = apply_closing_schedule(draft, customer);
  if (sent_home) return sent_home;

  if (customer.visitElapsedMs >= draft.source.config.maxVisitMs && !VISIT_CAP_EXEMPT_STATUSES.has(customer.status)) {
    return beginExit(draft, { ...customer, departureReason: "visit-cap" }, !customer.served);
  }

  return CUSTOMER_STATUS_HANDLERS[customer.status](draft, customer, deltaMs);
}
