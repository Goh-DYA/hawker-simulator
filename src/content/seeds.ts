/**
 * Helpers that turn authored, localized content seeds into records and English entries.
 *
 * Each data file authors its records with their English `name` and `description` inline.
 * These helpers derive the localization keys from a record's ID, strip the English copy
 * from the record and collect it as English entries, so the key derivation lives in one
 * place. The module is a leaf (it imports only types), so the data files can use it
 * without an import cycle through `localization.ts`, which imports them.
 */
import type { ContentId, LocalizedSeed } from "./types";

/** The localization keys of one content record. */
export interface LocalizationKeys {
  readonly nameKey: string;
  readonly descriptionKey: string;
}

/**
 * Derives the localization keys of a content record from its ID.
 *
 * @param id - The record's content ID, such as `stall.sunrise-roost`.
 * @returns The `<id>.name` and `<id>.description` keys, in that order.
 */
export function build_localization_keys(id: ContentId): LocalizationKeys {
  return { nameKey: `${id}.name`, descriptionKey: `${id}.description` };
}

/**
 * Removes the English copy from a localized seed, keeping its other keys in order.
 *
 * @param seed - The authored seed.
 * @returns A shallow copy of the seed without `name` and `description`.
 */
export function strip_localized_copy<T extends LocalizedSeed>(
  seed: T,
): Omit<T, keyof LocalizedSeed> {
  const record: { -readonly [K in keyof T]?: T[K] } = { ...seed };
  delete record.name;
  delete record.description;
  return record as Omit<T, keyof LocalizedSeed>;
}

/**
 * Collects the English entries of localized seeds, keyed by their localization keys.
 *
 * @param seeds - The authored seeds, in the order their entries are listed.
 * @returns Each seed's name entry, then its description entry, seed by seed.
 */
export function build_english_entries(
  seeds: readonly (LocalizedSeed & { readonly id: ContentId })[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    seeds.flatMap((seed) => {
      const keys = build_localization_keys(seed.id);
      return [
        [keys.nameKey, seed.name],
        [keys.descriptionKey, seed.description],
      ];
    }),
  );
}
