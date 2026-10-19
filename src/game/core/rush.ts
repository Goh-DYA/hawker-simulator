/**
 * Rush hours: the time-of-day demand curve that shapes arrivals across an operating day.
 *
 * A neighbourhood centre fills twice: a lunch crowd around midday and a smaller dinner crowd
 * before closing. Each crowd is a smooth bump (a biweight polynomial, so no transcendental
 * functions whose last bits may differ between engines) added to a base demand, and arrivals
 * stop for last orders shortly before the day ends. The windows are plain data, so the HUD can
 * draw the same bands the simulation uses.
 */
import { OPERATING_DAY_MS, operatingMinuteOfDay } from "./progression";

/** The two daily crowds. */
export type RushKind = "lunch" | "dinner";

/** One crowd: the in-game minute it peaks at, how far it spreads, and how much it adds. */
export interface RushWindow {
  readonly kind: RushKind;
  /** In-game minute of the day (minutes since midnight) at which demand peaks. */
  readonly centre_minute: number;
  /** Minutes either side of the centre at which the bump reaches zero. */
  readonly half_width_minutes: number;
  /** Demand added at the centre, on top of `BASE_TIME_DEMAND`. */
  readonly peak: number;
}

/** Time-of-day demand outside both crowds. */
export const BASE_TIME_DEMAND = 0.7;
/** The lunch crowd: peaking at 12:30 and spreading an hour either side. */
export const LUNCH_RUSH: RushWindow = {
  kind: "lunch",
  centre_minute: 12 * 60 + 30,
  half_width_minutes: 60,
  peak: 0.9,
};
/** The dinner crowd: peaking at 17:15 and spreading forty minutes either side. */
export const DINNER_RUSH: RushWindow = {
  kind: "dinner",
  centre_minute: 17 * 60 + 15,
  half_width_minutes: 40,
  peak: 0.6,
};
/** The default crowds of a day without a neighbourhood plan, in time order. */
export const DEFAULT_RUSH_WINDOWS: readonly RushWindow[] = [LUNCH_RUSH, DINNER_RUSH];
/** In-game minute after which no new guest arrives (18:10, twenty minutes before closing). */
export const LAST_ORDERS_MINUTE = 18 * 60 + 10;
/**
 * Share of a crowd's half-width, either side of its centre, that counts as the rush itself.
 * At this distance the bump still adds about 40% of its peak.
 */
export const RUSH_CORE_SHARE = 0.6;

/**
 * Returns how much of a crowd's peak applies at a minute: one at the centre, falling smoothly
 * to zero at the half-width.
 *
 * @param minute - The in-game minute of the day.
 * @param window - The crowd.
 * @returns A share from 0 to 1.
 */
export function rush_bump_share(minute: number, window: RushWindow): number {
  const distance = Math.abs(minute - window.centre_minute) / Math.max(1, window.half_width_minutes);
  if (distance >= 1) return 0;
  const falloff = 1 - distance * distance;
  return falloff * falloff;
}

/**
 * Computes the time-of-day demand multiplier at an in-game minute.
 *
 * @param minute - The in-game minute of the day.
 * @param windows - The day's crowds, summed in array order.
 * @returns The base demand plus every crowd's contribution.
 */
export function compute_time_demand(minute: number, windows: readonly RushWindow[]): number {
  let demand = BASE_TIME_DEMAND;
  for (const window of windows) demand += window.peak * rush_bump_share(minute, window);
  return demand;
}

/**
 * Finds the crowd whose rush core covers a minute.
 *
 * @param minute - The in-game minute of the day.
 * @param windows - The day's crowds.
 * @returns The first crowd within `RUSH_CORE_SHARE` of its half-width, or `undefined`.
 */
export function active_rush_window(
  minute: number,
  windows: readonly RushWindow[],
): RushWindow | undefined {
  return windows.find(
    (window) =>
      Math.abs(minute - window.centre_minute) <= window.half_width_minutes * RUSH_CORE_SHARE,
  );
}

/**
 * Whether new guests have stopped arriving for the day.
 *
 * @param elapsed_ms - The simulated time.
 * @returns True from `LAST_ORDERS_MINUTE` until the day ends.
 */
export function is_last_orders(elapsed_ms: number): boolean {
  return operatingMinuteOfDay(elapsed_ms) >= LAST_ORDERS_MINUTE;
}

/**
 * Returns the simulated milliseconds left until the current operating day ends.
 *
 * @param elapsed_ms - The simulated time; negative values count as zero.
 * @returns A value from 1 to `OPERATING_DAY_MS`.
 */
export function ms_until_day_end(elapsed_ms: number): number {
  return OPERATING_DAY_MS - (Math.max(0, elapsed_ms) % OPERATING_DAY_MS);
}
