/**
 * Shared colour helpers and palettes for the runtime's procedural art.
 *
 * The visual recipes and the Phaser renderer both draw from these, so a recipe's colours and the
 * drawn colours come from one place. Everything here is pure and free of Phaser.
 */

/** Accent colours that recipes pick from by a stable hash, in a fixed order. */
export const ACCENTS = [
  0x287f75,
  0xc8624c,
  0xd69a35,
  0x4d7390,
  0x7b669b,
  0x56875c,
  0xb8667a,
  0x477c86,
  0xa56c3f,
  0x6e7e42,
] as const;

/**
 * Hashes a string to a stable unsigned 32-bit seed (FNV-1a) for picking visual variants.
 *
 * @param value - The string to hash, usually an ID with a namespace prefix.
 * @returns The unsigned 32-bit hash.
 */
export function stableVisualHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Skin tones that customer and vendor recipes pick from, in a fixed order. */
export const SKIN_TONES = [0xe2b08a, 0xc98e68, 0xaa7256, 0x845642, 0x6f4737] as const;
/** Clothing colours that customer and vendor recipes pick from, in a fixed order. */
export const CLOTHING = [0x355e78, 0xc8624c, 0x6d8e5d, 0x9a5e77, 0xd69a35, 0x4d7390, 0x287f75, 0x7b669b] as const;

/**
 * Parses a `#rrggbb` (or bare hex) colour string into a number.
 *
 * @param value - The colour string; a leading `#` is optional.
 * @param fallback - Colour returned when the string does not parse.
 * @returns The parsed colour, or `fallback`.
 */
export function colour(value: string, fallback: number) {
  const normalized = value.replace("#", "");
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Blends two RGB colours channel by channel.
 *
 * @param base - The starting colour.
 * @param blend - The colour blended in.
 * @param amount - Weight of `blend`, clamped to the range 0 to 1.
 * @returns The blended colour, each channel rounded to an integer.
 */
export function mixColour(base: number, blend: number, amount: number) {
  const weight = Math.max(0, Math.min(1, amount));
  const channel = (shift: number) =>
    Math.round(
      ((base >>> shift) & 0xff) * (1 - weight) +
        ((blend >>> shift) & 0xff) * weight,
    );
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * Blends a colour towards white.
 *
 * @param base - The starting colour.
 * @param amount - Weight of white, clamped to the range 0 to 1.
 * @returns The lightened colour.
 */
export function lighten(base: number, amount: number) {
  return mixColour(base, 0xffffff, amount);
}

/**
 * Blends a colour towards the scene's deep green-black shadow tone.
 *
 * @param base - The starting colour.
 * @param amount - Weight of the shadow tone, clamped to the range 0 to 1.
 * @returns The darkened colour.
 */
export function darken(base: number, amount: number) {
  return mixColour(base, 0x102923, amount);
}
