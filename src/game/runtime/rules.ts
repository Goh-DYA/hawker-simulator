/**
 * Game-rule constants shared by the runtime and the HUD.
 *
 * The module imports nothing, so the eagerly loaded HUD can read these rules without pulling
 * the runtime's catalog projection or new-game setup into its chunk.
 */

/**
 * Ratio of content reputation points to core reputation; divide content values by it for core
 * and multiply core values by it for display.
 */
export const REPUTATION_SCALE = 20;

/**
 * The hall-expansion rule: each expansion adds these columns and rows, and needs this level.
 * The property names mirror the `expand-map` command.
 */
export const MAP_EXPANSION = { addColumns: 4, addRows: 2, minimumLevel: 3 } as const;

/**
 * Stall tenders: the operating day from which each new stall licence is offered, in order.
 * Entry `k` is the earliest day the (k + 1)-th stall beyond the starter stalls can unlock, on top
 * of its level, reputation and prerequisite gates, so new stalls arrive one at a time and the
 * player's takings can keep up with their prices. Tenders past the end of the list follow every
 * `STALL_TENDER_LATE_INTERVAL_DAYS` days.
 */
export const STALL_TENDER_DAYS: readonly number[] = [
  2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 23, 26, 29, 32, 35, 38,
];

/** Days between stall tenders after the scheduled list runs out. */
export const STALL_TENDER_LATE_INTERVAL_DAYS = 4;

/**
 * Returns the first operating day on which the next stall licence is offered.
 *
 * @param tendered_count - Stalls beyond the starter stalls that have already unlocked.
 * @returns The operating day, from 1.
 */
export function get_stall_tender_day(tendered_count: number): number {
  const scheduled = STALL_TENDER_DAYS[tendered_count];
  if (scheduled !== undefined) return scheduled;
  const last = STALL_TENDER_DAYS[STALL_TENDER_DAYS.length - 1] ?? 1;
  return last + (tendered_count - STALL_TENDER_DAYS.length + 1) * STALL_TENDER_LATE_INTERVAL_DAYS;
}
