/**
 * The English localization table and its lookup.
 *
 * `ENGLISH_LOCALIZATION` merges the English entries of the stalls, dishes, placeables and
 * customer archetypes, in that order, which is the key order the content golden pins. The
 * merge throws on a key that two tables share, so one record's copy cannot silently
 * replace another's.
 */
import { CUSTOMER_ENGLISH } from "./customers";
import { DISH_ENGLISH } from "./dishes";
import { PLACEABLE_ENGLISH } from "./placeables";
import { STALL_ENGLISH } from "./stalls";

/**
 * Merges localization tables in order, refusing duplicate keys.
 *
 * @param tables - The tables to merge, in key order.
 * @returns One table holding every entry, in the order the tables list them.
 * @throws Error When two tables share a key.
 */
function merge_localization_tables(
  tables: readonly Readonly<Record<string, string>>[],
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const table of tables) {
    for (const [key, text] of Object.entries(table)) {
      if (Object.hasOwn(merged, key)) {
        throw new Error(`Duplicate localization key: ${key}.`);
      }
      merged[key] = text;
    }
  }
  return merged;
}

/** Every English localization entry, frozen, in stall, dish, placeable, customer order. */
export const ENGLISH_LOCALIZATION: Readonly<Record<string, string>> = Object.freeze(
  merge_localization_tables([STALL_ENGLISH, DISH_ENGLISH, PLACEABLE_ENGLISH, CUSTOMER_ENGLISH]),
);

/**
 * Looks up the English text of a localization key.
 *
 * @param key - The localization key.
 * @returns The English text, or the key itself when it has none.
 */
export function localize_key(key: string): string {
  return ENGLISH_LOCALIZATION[key] ?? key;
}
