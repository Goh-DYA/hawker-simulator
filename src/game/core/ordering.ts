/**
 * Deterministic ID ordering for the core simulation.
 *
 * Core never uses `localeCompare`, so these comparators give the same order on every
 * platform and locale wherever an ID order affects results.
 */
/** Locale-independent UTF-16 code-unit ordering for deterministic entity/content IDs. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Orders customer IDs by their numeric sequence suffix, falling back to `compareIds`.
 *
 * Customers step in this order each tick, so it must stay stable across saves and platforms.
 *
 * @param a - The first customer ID, such as `customer-12`.
 * @param b - The second customer ID.
 * @returns A negative number, zero or a positive number, as `Array.prototype.sort` expects.
 */
export function compare_customer_ids(a: string, b: string): number {
  const aNumber = Number(a.slice(a.lastIndexOf("-") + 1));
  const bNumber = Number(b.slice(b.lastIndexOf("-") + 1));
  return aNumber - bNumber || compareIds(a, b);
}
