/**
 * Operating hours and service admission: whether a centre keeps the closing schedule in
 * `rush.ts`, and whether a stall can still serve one more guest before the closing call.
 *
 * Internal to core; it is not re-exported from the barrel. In a centre that keeps operating
 * hours the day's guests all come in before the last entry and every guest let in can be served:
 * a guest arrives only while some open stall's estimated service would finish by the closing call
 * (`has_admissible_stall`, used by `arrivals.ts`), and picks only among the stalls whose estimate
 * fits (`is_served_by_closing_call`, used by `choices.ts`). The estimate allows for the walk to the
 * queue, every guest ahead and this guest at the counter, and the stall's mean cooking time, so a
 * guest is never let into a queue the stall cannot clear.
 */
import { openStalls, type Draft, type StallRuntime } from "./draft";
import { ms_until_closing_call } from "./rush";
import { get_quality_settings } from "./state";
import type { DishDefinition, GameState } from "./types";

/** Time allowed for a new guest to walk from the entrance to the end of a queue, in ms. */
const ADMISSION_WALK_MS = 10_000;

/**
 * Whether a centre keeps operating hours: true in the adaptive arrival model, where arrivals follow
 * the clock and the day winds down at closing. A fixed arrival interval (`maxActiveCustomers`)
 * ignores the operating clock, so it never closes and never sends guests home.
 *
 * @param state - The state whose quality settings are read.
 * @returns True when the closing schedule in `rush.ts` applies.
 */
export function follows_operating_hours(state: GameState): boolean {
  return get_quality_settings(state).maxActiveCustomers === undefined;
}

/**
 * Estimates how long a stall needs to serve a guest who joins its queue now: the walk to the queue,
 * the counter time of every guest ahead and of this one, and the mean cooking time of the dishes
 * offered. Each guest at the counter takes the longer of the ordering time and the cooking time
 * shared across the stall's preparation capacity.
 *
 * @param stall - The stall.
 * @param queue_length - How many guests are already in its queue.
 * @param dishes - The dishes the guest could order; must not be empty.
 * @returns The estimated time until the guest's food is ready, in simulated milliseconds.
 */
function estimate_service_ms(
  stall: StallRuntime,
  queue_length: number,
  dishes: readonly DishDefinition[],
): number {
  const config = stall.definition.stall;
  const mean_preparation_ms =
    dishes.reduce((total, dish) => total + dish.preparationMs, 0) / dishes.length;
  const counter_ms = Math.max(
    config?.orderMs ?? 0,
    mean_preparation_ms / Math.max(1, config?.preparationCapacity ?? 1),
  );
  return ADMISSION_WALK_MS + (queue_length + 1) * counter_ms + mean_preparation_ms;
}

/**
 * Whether a stall can serve a guest who joins its queue now before the closing call. Without
 * operating hours every stall can.
 *
 * @param draft - The draft whose clock and quality settings are read.
 * @param stall - The stall.
 * @param queue_length - How many guests are already in its queue.
 * @param dishes - The dishes the guest could order; with none, the stall cannot serve them.
 * @returns True when the estimated service ends by the closing call.
 */
export function is_served_by_closing_call(
  draft: Draft,
  stall: StallRuntime,
  queue_length: number,
  dishes: readonly DishDefinition[],
): boolean {
  if (!follows_operating_hours(draft.source)) return true;
  if (dishes.length === 0) return false;
  return (
    estimate_service_ms(stall, queue_length, dishes) <=
    ms_until_closing_call(draft.source.elapsedMs)
  );
}

/**
 * Whether a new guest could still be served: some open stall can serve one more guest from its
 * whole menu before the closing call, counting everyone already in its queue. Without operating
 * hours it is always true. A full queue does not stop arrivals here, so a crowded hall still turns
 * guests away the usual way during the day.
 *
 * @param draft - The draft of the current step.
 * @returns True when a new guest may come in.
 */
export function has_admissible_stall(draft: Draft): boolean {
  if (!follows_operating_hours(draft.source)) return true;
  return openStalls(draft).some((stall) => {
    const config = stall.definition.stall;
    const queue_length = draft.queues[stall.object.id]?.length ?? 0;
    const dishes = (config?.dishIds ?? [])
      .map((id) => draft.source.catalog.dishes[id])
      .filter((dish): dish is DishDefinition => dish !== undefined);
    return is_served_by_closing_call(draft, stall, queue_length, dishes);
  });
}
