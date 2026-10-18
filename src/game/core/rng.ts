/** Serializable, deterministic xorshift32 random-number generator helpers. */

/** A drawn value together with the generator state to pass to the next draw. */
export interface RandomResult<T> {
  readonly value: T;
  readonly state: number;
}

/**
 * Turns a seed into a non-zero xorshift32 state.
 *
 * A number seed is truncated to an unsigned 32-bit integer; a string seed is hashed with {@link
 * compute_fnv1a32}. A zero result is replaced by a fixed non-zero constant, because xorshift32
 * never leaves state zero.
 *
 * @param seed - The seed number or string.
 * @returns The initial generator state.
 */
export function hashSeed(seed: number | string): number {
  if (typeof seed === "number") {
    const normalized = seed >>> 0;
    return normalized === 0 ? 0x6d2b79f5 : normalized;
  }

  const normalized = compute_fnv1a32(seed);
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

/**
 * Computes the 32-bit FNV-1a hash of a string's UTF-16 code units.
 *
 * Seed hashing and the save checksum share this loop, so both stay bit-identical to the
 * hashes already stored in seeds and saved envelopes.
 *
 * @param text - The string to hash, read one UTF-16 code unit at a time.
 * @returns The unsigned 32-bit hash.
 */
export function compute_fnv1a32(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Advances the xorshift32 generator by one step.
 *
 * @param state - The current generator state.
 * @returns The next unsigned 32-bit value, which is also the next state.
 */
export function nextUint32(state: number): RandomResult<number> {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  if (next === 0) next = 0x6d2b79f5;
  return { value: next, state: next };
}

/**
 * Draws a float in [0, 1) from the next xorshift32 value.
 *
 * @param state - The current generator state.
 * @returns The float and the next state.
 */
export function nextFloat(state: number): RandomResult<number> {
  const next = nextUint32(state);
  return { value: next.value / 0x1_0000_0000, state: next.state };
}
