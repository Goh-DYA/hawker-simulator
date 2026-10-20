/**
 * The game's release identity: the content version and the date of the last update.
 *
 * `LAUNCH_CONTENT` reports the version through `validateContent`, and the Settings dialog
 * shows both as a note. Raise the version and the date together, in the commit that changes
 * the content version.
 */

/** The content version, as `major.minor.patch`. */
export const CONTENT_VERSION = "1.7.0";

/** The date of the last update, as an ISO 8601 calendar date (`YYYY-MM-DD`). */
export const CONTENT_UPDATED_ON = "2026-10-20";

/** English month names, so the date reads the same on the server and in every browser locale. */
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Formats an ISO calendar date as a day, month name and year, such as "20 October 2026".
 *
 * The date is formatted by hand rather than with `Intl` so the server-rendered markup and
 * the browser agree whatever the player's locale or time zone.
 *
 * @param iso_date - A calendar date as `YYYY-MM-DD`.
 * @returns The date as "D Month YYYY".
 * @throws RangeError If the value is not a real calendar date in that form.
 */
export function format_release_date(iso_date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso_date);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const days_in_month = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!match || month < 1 || month > 12 || day < 1 || day > days_in_month) {
    throw new RangeError(`Not an ISO calendar date: ${iso_date}`);
  }
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
