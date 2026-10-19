/**
 * The fixed-step simulation loop: `stepSimulation` advances one tick and `advanceSimulation`
 * turns real elapsed time into fixed steps.
 *
 * Each step runs in a fixed order, which is part of the determinism contract. It first counts
 * down the spawn timer and, when it expires, spawns a customer (unless the adaptive model is at
 * last orders) and then computes the next adaptive spawn interval, which uses no randomness. It then processes every customer once, in
 * `compare_customer_ids` order, and finally runs `updateProgressionSystems`. Random numbers are
 * drawn from the draft's `rngState` only by `spawnCustomer` (the arrival, health and nutrition
 * rolls) and then by each processed customer's choices (stall and dish), in
 * `compare_customer_ids` order; `updateProgressionSystems` draws none. `processCustomer` returns
 * `undefined` for a customer who has despawned at an exit, and the step deletes that customer
 * from the state.
 */
import { createDraft } from "./draft";
import { compute_next_spawn_interval_ms, is_arrival_window_closed, spawnCustomer } from "./arrivals";
import { processCustomer } from "./lifecycle";
import { compare_customer_ids } from "./ordering";
import { compute_undo_window_ticks, get_quality_settings } from "./state";
import { updateProgressionSystems } from "./progression";
import type { AdvanceResult, GameState, SimulationEvent } from "./types";

/**
 * Advances the simulation by exactly one fixed step, in the order described in the module header.
 *
 * @param state - The state to advance; it is not mutated.
 * @returns The next state, one tick later, carrying only the events this step produced.
 */
export function stepSimulation(state: GameState): GameState {
  const deltaMs = state.config.fixedStepMs;
  const tick = state.tick + 1;
  const draft = createDraft(state, tick);
  draft.spawnCountdownMs -= deltaMs;

  if (draft.spawnCountdownMs <= 0) {
    if (!is_arrival_window_closed(draft)) spawnCustomer(draft);
    draft.spawnCountdownMs += compute_next_spawn_interval_ms(draft);
  }

  const ids = Object.keys(draft.customers).sort(compare_customer_ids);
  for (const id of ids) {
    const customer = draft.customers[id];
    if (!customer) continue;
    const processed = processCustomer(draft, customer, deltaMs);
    if (processed) draft.customers[id] = processed;
    else delete draft.customers[id];
  }

  const next = {
    ...state,
    customers: draft.customers,
    queues: draft.queues,
    seatReservations: draft.seatReservations,
    economy: draft.economy,
    progression: draft.progression,
    rngState: draft.rngState,
    nextCustomerSequence: draft.nextCustomerSequence,
    spawnCountdownMs: draft.spawnCountdownMs,
    metrics: draft.metrics,
    tick,
    elapsedMs: state.elapsedMs + deltaMs,
    undoStack: state.undoStack.filter(
      (entry) => tick - entry.createdAtTick <= compute_undo_window_ticks(state.config),
    ),
    events: draft.events,
  };
  return updateProgressionSystems(next);
}

/**
 * Turns real elapsed time into whole fixed steps, carrying the remainder in the accumulator.
 *
 * Steps beyond the quality setting's per-advance cap are dropped rather than queued, so a long
 * stall in the host cannot trigger a catch-up burst.
 *
 * @param state - The state to advance; it is not mutated.
 * @param realDeltaMs - Real time elapsed since the previous advance, in milliseconds.
 * @returns The advanced state, the number of steps run, the dropped time and every step's events.
 * @throws RangeError When `realDeltaMs` is not a finite, non-negative number.
 */
export function advanceSimulation(state: GameState, realDeltaMs: number): AdvanceResult {
  if (!Number.isFinite(realDeltaMs) || realDeltaMs < 0) throw new RangeError("Delta time must be a non-negative number");
  const fixedStepMs = state.config.fixedStepMs;
  let accumulator = state.accumulatorMs + realDeltaMs;
  const availableSteps = Math.floor(accumulator / fixedStepMs);
  const quality = get_quality_settings(state);
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
