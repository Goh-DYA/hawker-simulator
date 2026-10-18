/**
 * The IndexedDB save store: checksummed save envelopes in an `active` and a `backup` slot,
 * player preferences, and the save-file export and import format.
 *
 * The database name (`hawker-simulator`), its version, the store names, the slot keys, the
 * envelope fields and the checksum byte format are persisted contracts; changing any of them
 * breaks existing saves (see `docs/SAVE_FORMAT.md`). The checksum covers `undefined`-valued
 * keys that `JSON.stringify` drops, so exported saves fail re-import (TD-06 in
 * `docs/KNOWN_ISSUES.md`).
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { compute_fnv1a32 } from "@/src/game/core/rng";
import type { PreferenceKey } from "@/src/game/persistence/preferences";

const DATABASE_NAME = "hawker-simulator";
const DATABASE_VERSION = 1;
const ACTIVE_SLOT = "active";
const BACKUP_SLOT = "backup";

interface SaveEnvelope {
  appVersion: string;
  saveVersion: 1 | 2;
  writtenAt: string;
  checksum: string;
  payload: unknown;
}

interface HawkerDatabase extends DBSchema {
  saves: {
    key: string;
    value: SaveEnvelope;
  };
  preferences: {
    key: string;
    value: unknown;
  };
}

let databasePromise: Promise<IDBPDatabase<HawkerDatabase>> | undefined;

function database() {
  databasePromise ??= openDB<HawkerDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("saves")) db.createObjectStore("saves");
      if (!db.objectStoreNames.contains("preferences")) {
        db.createObjectStore("preferences");
      }
    },
  });
  return databasePromise;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function checksum(value: unknown): string {
  return compute_fnv1a32(stableStringify(value)).toString(16).padStart(8, "0");
}

function envelope(payload: unknown): SaveEnvelope {
  return {
    appVersion: "1.0.0",
    saveVersion: 2,
    writtenAt: new Date().toISOString(),
    checksum: checksum(payload),
    payload,
  };
}

function isValidEnvelope(value: SaveEnvelope | undefined): value is SaveEnvelope {
  return Boolean(
    value &&
      (value.saveVersion === 1 || value.saveVersion === 2) &&
      typeof value.appVersion === "string" &&
      value.checksum === checksum(value.payload),
  );
}

/**
 * Writes a save to the active slot, first moving a still-valid active save to the backup slot, in
 * one transaction.
 *
 * @param payload - The runtime save payload.
 * @returns A promise that settles when the transaction completes.
 */
export async function saveGame(payload: unknown): Promise<void> {
  const db = await database();
  const transaction = db.transaction("saves", "readwrite");
  const current = await transaction.store.get(ACTIVE_SLOT);
  if (isValidEnvelope(current)) await transaction.store.put(current, BACKUP_SLOT);
  await transaction.store.put(envelope(payload), ACTIVE_SLOT);
  await transaction.done;
}

/**
 * Loads the newest valid save.
 *
 * @returns The active payload, else the backup payload, else undefined.
 */
export async function loadGame(): Promise<unknown | undefined> {
  return (await loadGameCandidates())[0];
}

/**
 * Loads every save whose envelope is valid, for the runtime to try in order.
 *
 * @returns The active and backup payloads that passed the envelope and checksum check, active
 *   first.
 */
export async function loadGameCandidates(): Promise<readonly unknown[]> {
  const db = await database();
  const active = await db.get("saves", ACTIVE_SLOT);
  const backup = await db.get("saves", BACKUP_SLOT);
  return [active, backup]
    .filter((candidate): candidate is SaveEnvelope => isValidEnvelope(candidate))
    .map((candidate) => candidate.payload);
}

/**
 * Deletes the active and backup saves in one transaction.
 *
 * @returns A promise that settles when the transaction completes.
 */
export async function clearGame(): Promise<void> {
  const db = await database();
  const transaction = db.transaction("saves", "readwrite");
  await Promise.all([
    transaction.store.delete(ACTIVE_SLOT),
    transaction.store.delete(BACKUP_SLOT),
  ]);
  await transaction.done;
}

/**
 * Stores one player preference.
 *
 * @param key - The preference key.
 * @param value - The value to store.
 * @returns A promise that settles when the write completes.
 */
export async function savePreference(key: PreferenceKey, value: unknown): Promise<void> {
  const db = await database();
  await db.put("preferences", value, key);
}

/**
 * Reads one player preference.
 *
 * @param key - The preference key.
 * @param fallback - The value returned when nothing, or a nullish value, is stored.
 * @returns The stored value, unvalidated, or the fallback.
 */
export async function loadPreference<T>(
  key: PreferenceKey,
  fallback: T,
): Promise<T> {
  const db = await database();
  const value = await db.get("preferences", key);
  return (value as T | undefined) ?? fallback;
}

/**
 * Name the file an exported save is downloaded as.
 *
 * @param day - The centre's current day.
 * @returns The file name, such as `hawker-balance-day-3.json`.
 */
export function build_save_file_name(day: number): string {
  return `hawker-balance-day-${day}.json`;
}

/**
 * Wraps a save payload in a fresh envelope and serialises it for download.
 *
 * @param payload - The runtime save payload.
 * @returns The envelope as indented JSON.
 */
export function exportSave(payload: unknown): string {
  return JSON.stringify(envelope(payload), null, 2);
}

/**
 * Parses an exported save file and checks its envelope.
 *
 * @param source - The file contents.
 * @returns The payload inside the envelope.
 * @throws SyntaxError When the contents are not JSON.
 * @throws Error When the envelope is invalid or its checksum does not match.
 */
export function importSave(source: string): unknown {
  const value = JSON.parse(source) as SaveEnvelope;
  if (!isValidEnvelope(value)) throw new Error("The save file is damaged or unsupported.");
  return value.payload;
}
