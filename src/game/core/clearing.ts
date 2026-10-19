/**
 * Table clearing: whether a guest returns their tray, the trays left on seats, and the
 * table-cleaning crew that clears them.
 *
 * A guest returns their tray when a tray return is close enough and their archetype's
 * tray-return habit says so; the habit is read from a hash of the guest's ID, so it draws nothing
 * from the simulation's random stream. Any other tray stays on the seat, which no one can use
 * until the crew has cleared it, and diners next to it rate the hall as less clean. The crew is
 * one member plus one per tray-return station, each clearing the oldest waiting tray first, so
 * extra seats without returns only lengthen the backlog.
 *
 * Internal to core; only `count_cleaning_crew` and `get_worked_tray_keys` are re-exported from
 * the barrel.
 */
import type { Draft } from "./draft";
import { getSeatLocations } from "./grid";
import { compareIds } from "./ordering";
import { compute_fnv1a32 } from "./rng";
import { getUtilityInfluence } from "./utility";
import type {
  Customer,
  GameState,
  GridPoint,
  PlacedObject,
  SimulationCatalog,
  UnclearedTray,
} from "./types";

/** Crew time to clear one tray at a seat without any cleaning utility, in simulated ms. */
export const TRAY_CLEAR_MS = 25_000;
/** Crew members who work the hall before any tray-return station is placed. */
export const BASE_CLEANING_CREW = 1;
/** Longest walk, in path tiles, that a guest will make to return a tray. */
export const TRAY_RETURN_MAX_PATH_TILES = 14;
/** How strongly cleaning efficiency near a seat speeds up clearing it. */
const CLEANING_EFFICIENCY_RATE_WEIGHT = 1.5;
/** Cleanliness points a diner loses for each uncleared tray beside their seat. */
const UNCLEARED_NEIGHBOUR_CLEANLINESS_PENALTY = 12;
/** Most cleanliness points a diner can lose to uncleared trays beside them. */
const MAX_UNCLEARED_NEIGHBOUR_PENALTY = 30;
/** Chebyshev distance, in tiles, within which an uncleared tray counts as beside a seat. */
const UNCLEARED_NEIGHBOUR_RADIUS = 1;
/** Number of distinct 32-bit hash values, which turns a hash into a share from 0 to 1. */
const HASH_RANGE = 2 ** 32;

/**
 * Whether a guest's habits lead them to return their tray, independent of the hall layout.
 *
 * @param customer - The guest.
 * @param tray_return_chance - The archetype's tray-return share; `undefined` means every guest.
 * @param world_seed - The neighbourhood's world seed, so each centre's guests have their own
 *   habits; without it the habit depends on the guest's ID alone.
 * @returns True when the hash of the guest's ID falls inside the share.
 */
export function is_tray_returner(
  customer: Customer,
  tray_return_chance: number | undefined,
  world_seed?: number,
): boolean {
  if (tray_return_chance === undefined) return true;
  const salt = world_seed === undefined ? "" : `${world_seed}:`;
  return compute_fnv1a32(`${salt}${customer.id}:tray`) / HASH_RANGE < tray_return_chance;
}

/**
 * Counts the table-cleaning crew: the base crew plus one member per tray-return station.
 *
 * @param objects - The placed objects.
 * @param catalog - The catalog that classifies them.
 * @returns The number of trays that can be cleared at once.
 */
export function count_cleaning_crew(
  objects: Readonly<Record<string, PlacedObject>>,
  catalog: SimulationCatalog,
): number {
  let crew = BASE_CLEANING_CREW;
  for (const object of Object.values(objects)) {
    if (catalog.placeables[object.definitionId]?.kind === "tray-return") crew += 1;
  }
  return crew;
}

/**
 * Leaves a guest's tray on the seat they ate at, timed by the cleaning utility around it.
 *
 * @param draft - The draft whose uncleared trays are edited.
 * @param seat_key - The seat the tray is left on.
 * @param seat_point - The seat's tile, which sets how quickly the crew clears it.
 */
export function leave_tray(draft: Draft, seat_key: string, seat_point: GridPoint): void {
  const utility = getUtilityInfluence(draft.objects, draft.source.catalog, seat_point);
  const rate = 1 + Math.max(0, utility.cleaningEfficiency) * CLEANING_EFFICIENCY_RATE_WEIGHT;
  draft.unclearedTrays[seat_key] = {
    leftAtTick: draft.tick,
    workRemainingMs: TRAY_CLEAR_MS / rate,
  };
}

/**
 * Computes the cleanliness points a diner loses for the uncleared trays beside their seat.
 *
 * @param draft - The draft whose objects and uncleared trays are read.
 * @param seat_point - The diner's seat tile.
 * @returns A penalty from 0 to `MAX_UNCLEARED_NEIGHBOUR_PENALTY`.
 */
export function compute_uncleared_neighbour_penalty(draft: Draft, seat_point: GridPoint): number {
  let count = 0;
  for (const seat of getSeatLocations(draft.objects, draft.source.catalog)) {
    if (!draft.unclearedTrays[seat.key]) continue;
    const distance = Math.max(
      Math.abs(seat.point.x - seat_point.x),
      Math.abs(seat.point.y - seat_point.y),
    );
    if (distance <= UNCLEARED_NEIGHBOUR_RADIUS) count += 1;
  }
  return Math.min(MAX_UNCLEARED_NEIGHBOUR_PENALTY, count * UNCLEARED_NEIGHBOUR_CLEANLINESS_PENALTY);
}

/**
 * Orders the waiting trays the way the crew takes them: oldest first, then by seat key.
 *
 * @param waiting - The waiting trays as seat key and tray pairs; sorted in place.
 * @returns The same array, sorted.
 */
function sort_waiting_trays(
  waiting: Array<[string, UnclearedTray]>,
): Array<[string, UnclearedTray]> {
  return waiting.sort(
    ([key_a, tray_a], [key_b, tray_b]) =>
      tray_a.leftAtTick - tray_b.leftAtTick || compareIds(key_a, key_b),
  );
}

/**
 * Names the trays the table-cleaning crew is working on: the oldest waiting trays on seats that
 * still exist, one per crew member, in the order {@link advance_table_clearing} works them. The
 * renderer reads it to send a visible crew member to each.
 *
 * @param state - The trays, objects and catalog to read.
 * @returns The seat keys of the trays being cleared.
 */
export function get_worked_tray_keys(
  state: Pick<GameState, "unclearedTrays" | "objects" | "catalog">,
): string[] {
  const seat_keys = new Set(getSeatLocations(state.objects, state.catalog).map((seat) => seat.key));
  const waiting: Array<[string, UnclearedTray]> = [];
  for (const [key, tray] of Object.entries(state.unclearedTrays)) {
    if (seat_keys.has(key)) waiting.push([key, tray]);
  }
  const crew = count_cleaning_crew(state.objects, state.catalog);
  return sort_waiting_trays(waiting)
    .slice(0, crew)
    .map(([key]) => key);
}

/**
 * Lets the table-cleaning crew work for one step.
 *
 * Trays on seats that no longer exist are dropped once no undo can restore the seat. The crew
 * then works on the oldest waiting trays, one member per tray, ordered by the tick they were left and then by seat key, and a
 * tray whose work is done is cleared.
 *
 * @param draft - The draft whose uncleared trays are edited.
 * @param delta_ms - The fixed step length.
 */
export function advance_table_clearing(draft: Draft, delta_ms: number): void {
  const keys = Object.keys(draft.unclearedTrays);
  if (keys.length === 0) return;
  const seat_keys = new Set(
    getSeatLocations(draft.objects, draft.source.catalog).map((seat) => seat.key),
  );
  const waiting: Array<[string, UnclearedTray]> = [];
  const can_undo = draft.source.undoStack.length > 0;
  for (const key of keys) {
    const tray = draft.unclearedTrays[key];
    if (!tray) continue;
    if (!seat_keys.has(key)) {
      // Keep a removed seat's tray while an undo could bring the seat back, so removing and
      // undoing cannot clear a table for free; the crew does not work on it meanwhile.
      if (!can_undo) delete draft.unclearedTrays[key];
      continue;
    }
    waiting.push([key, tray]);
  }
  sort_waiting_trays(waiting);
  const crew = count_cleaning_crew(draft.objects, draft.source.catalog);
  for (const [key, tray] of waiting.slice(0, crew)) {
    const workRemainingMs = tray.workRemainingMs - delta_ms;
    if (workRemainingMs <= 0) delete draft.unclearedTrays[key];
    else draft.unclearedTrays[key] = { ...tray, workRemainingMs };
  }
}
