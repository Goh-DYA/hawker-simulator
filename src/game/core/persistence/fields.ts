/**
 * Primitive field readers shared by every persisted-save parser.
 *
 * Each reader validates one untrusted value and throws a `PersistenceError` that names its
 * save path. This module is a leaf of the persistence folder: it must not import
 * `./index` or any other persistence module.
 */

/**
 * Raised when save data is malformed, unsupported or cannot be normalised.
 *
 * The message is shown to the player when a load fails, so it names the offending path.
 */
export class PersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PersistenceError";
  }
}

/**
 * Reports whether a value is a plain object record (not null and not an array).
 *
 * @param value - The untrusted value read from the save.
 * @returns True when the value can be read as a string-keyed record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a finite number that is at least `minimum`.
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @param minimum - The smallest accepted value; unbounded by default.
 * @returns The number, unchanged.
 * @throws PersistenceError When the value is not a finite number at or above `minimum`.
 */
export function finite(value: unknown, path: string, minimum = Number.NEGATIVE_INFINITY): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    throw new PersistenceError(`${path} must be a finite number${minimum > Number.NEGATIVE_INFINITY ? ` >= ${minimum}` : ""}`);
  }
  return value;
}

/**
 * Reads a non-negative number and caps it at 100.
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @returns The value, capped at 100.
 * @throws PersistenceError When the value is not a finite non-negative number.
 */
export function boundedPercentage(value: unknown, path: string): number {
  return Math.min(100, finite(value, path, 0));
}

/**
 * Reads a health rating between one and five.
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @returns The rating, unchanged.
 * @throws PersistenceError When the value is not a finite number from one to five.
 */
export function healthRating(value: unknown, path: string): number {
  const parsed = finite(value, path, 1);
  if (parsed > 5) throw new PersistenceError(`${path} must be between one and five`);
  return parsed;
}

/**
 * Reads a safe integer within `[minimum, maximum]`.
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @param minimum - The smallest accepted value; zero by default.
 * @param maximum - The largest accepted value; `Number.MAX_SAFE_INTEGER` by default.
 * @returns The integer, unchanged.
 * @throws PersistenceError When the value is not a safe integer in range.
 */
export function safeInteger(
  value: unknown,
  path: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = finite(value, path, minimum);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new PersistenceError(`${path} must be a safe integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

/**
 * Checks that a persisted value is one entry of a vocabulary tuple.
 *
 * @param value - The untrusted value read from the save.
 * @param allowed - The allowed values, usually a tuple from `enums.ts`.
 * @param message - The error text, which is shown to the player when a load fails.
 * @returns The value, narrowed to the tuple's element type.
 * @throws PersistenceError When the value is not one of the allowed values.
 */
export function assert_one_of<T>(value: unknown, allowed: readonly T[], message: string): T {
  if (!allowed.includes(value as T)) throw new PersistenceError(message);
  return value as T;
}

/**
 * Reads a non-empty string.
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @returns The string, unchanged.
 * @throws PersistenceError When the value is not a non-empty string.
 */
export function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new PersistenceError(`${path} must be a non-empty string`);
  return value;
}

/**
 * Reads an integer grid point.
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @returns A fresh `{ x, y }` point.
 * @throws PersistenceError When the value is not an object with safe-integer coordinates.
 */
export function parsePoint(value: unknown, path: string): { x: number; y: number } {
  if (!isRecord(value)) throw new PersistenceError(`${path} must be an object`);
  const x = safeInteger(value.x, `${path}.x`, -Number.MAX_SAFE_INTEGER);
  const y = safeInteger(value.y, `${path}.y`, -Number.MAX_SAFE_INTEGER);
  return { x, y };
}

/**
 * Reads a world-space point with finite coordinates.
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @returns A fresh `{ x, y }` point.
 * @throws PersistenceError When the value is not an object with finite coordinates.
 */
export function parseWorldPoint(value: unknown, path: string): { x: number; y: number } {
  if (!isRecord(value)) throw new PersistenceError(`${path} must be an object`);
  return { x: finite(value.x, `${path}.x`), y: finite(value.y, `${path}.y`) };
}
