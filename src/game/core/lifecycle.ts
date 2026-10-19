/**
 * The customer lifecycle: one fixed step of a customer's visit state machine.
 *
 * Internal to core; it is not re-exported from the barrel. `processCustomer` moves a customer
 * through choosing a stall, queueing, ordering, waiting, finding a seat, eating, returning the
 * tray and walking to an exit, recovering when a target disappears. Its helpers edit the step
 * draft in place in a fixed order, so seeded runs stay identical.
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
  findReservedSeat,
  findSeat,
  findTargetTrayPoint,
  findTrayReturn,
} from "./choices";
import { getCustomerQueueCell } from "./queueing";
import { cloneNutritionProfile, healthPreferenceResultForRating, personalizedHealthRating } from "./nutrition";
import {
  adjustedEatingDurationMs,
  getUtilityInfluence,
  utilitySatisfactionBonus,
} from "./utility";
import { completeSale, settleVisitRating } from "./visits";
import {
  compute_uncleared_neighbour_penalty,
  is_tray_returner,
  leave_tray,
  TRAY_RETURN_MAX_PATH_TILES,
} from "./clearing";
import type { Customer, CustomerStatus } from "./types";

// Eating and tray-return factors (processCustomer).

/** Satisfaction gained for finishing a meal. */
const MEAL_SATISFACTION_BONUS = 0.25;
/** Lowest comfort rating after a meal. */
const MIN_MEAL_COMFORT = 45;
/** Comfort rating before nearby ambience utilities. */
const BASE_MEAL_COMFORT = 76;
/** Comfort rating per unit of nearby ambience. */
const MEAL_COMFORT_AMBIENCE_WEIGHT = 6;
/** Lowest cleanliness rating after a meal. */
const MIN_MEAL_CLEANLINESS = 35;
/** Comfort component of a served guest who gave up looking for a free seat. */
const NO_SEAT_COMFORT = 30;
/** Cleanliness rating before nearby cleanliness utilities. */
const BASE_MEAL_CLEANLINESS = 82;
/** Cleanliness rating per unit of nearby cleanliness. */
const MEAL_CLEANLINESS_WEIGHT = 8;
/** Cleanliness rating per unit of nearby cleaning efficiency. */
const MEAL_CLEANING_EFFICIENCY_WEIGHT = 6;
/** Lowest ambience rating after a meal. */
const MIN_MEAL_AMBIENCE = 40;
/** Ambience rating before nearby ambience utilities. */
const BASE_MEAL_AMBIENCE = 72;
/** Ambience rating per unit of nearby ambience. */
const MEAL_AMBIENCE_WEIGHT = 9;
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
  const adjustedEatingMs = dish
    ? adjustedEatingDurationMs(dish.eatingMs, diningUtility.eatingSpeed)
    : Number.POSITIVE_INFINITY;
  if (!dish || customer.stateElapsedMs < adjustedEatingMs) return customer;
  const uncleared_penalty = compute_uncleared_neighbour_penalty(draft, seat.point);
  const returns_tray = will_return_tray(draft, customer);
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
    ratingFactors: {
      ...customer.ratingFactors,
      comfort: Math.max(MIN_MEAL_COMFORT, Math.min(100, BASE_MEAL_COMFORT + diningUtility.ambience * MEAL_COMFORT_AMBIENCE_WEIGHT)),
      cleanliness: Math.max(
        MIN_MEAL_CLEANLINESS,
        Math.min(
          100,
          BASE_MEAL_CLEANLINESS +
            diningUtility.cleanliness * MEAL_CLEANLINESS_WEIGHT +
            diningUtility.cleaningEfficiency * MEAL_CLEANING_EFFICIENCY_WEIGHT -
            uncleared_penalty,
        ),
      ),
      ambience: Math.max(MIN_MEAL_AMBIENCE, Math.min(100, BASE_MEAL_AMBIENCE + diningUtility.ambience * MEAL_AMBIENCE_WEIGHT)),
    },
  };
  return returns_tray ? finished : beginExit(draft, { ...finished, hasTray: false }, false);
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
  if (!is_tray_returner(customer, archetype?.trayReturnChance)) return false;
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
  customer = settleVisitRating(
    draft,
    movement.customer,
    !movement.customer.served,
    movement.customer.departureReason ?? (movement.customer.served ? "served" : "abandoned"),
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
    message: movement.failed ? "forced-after-stuck" : customer.served ? "completed" : "abandoned",
  });
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
 * Adds the step to the visit and state timers, sends a customer past the maximum visit length
 * towards the exit, then runs the handler for its status.
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

  if (customer.visitElapsedMs >= draft.source.config.maxVisitMs && !VISIT_CAP_EXEMPT_STATUSES.has(customer.status)) {
    return beginExit(draft, { ...customer, departureReason: "visit-cap" }, !customer.served);
  }

  return CUSTOMER_STATUS_HANDLERS[customer.status](draft, customer, deltaMs);
}
