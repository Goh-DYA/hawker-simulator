/**
 * Atmosphere rules: the time-of-day tint multiplied over the hall as the operating day runs
 * from the 10:30 opening to the evening close, and the lamp-pool pulse. Pure functions of the
 * simulation clock, so the look is deterministic and never feeds back into the simulation.
 */
import { OPERATING_DAY_MS } from "@/src/game/core";

/** A tint key frame: the fraction of the operating day and the multiply colour at that time. */
interface TintStop {
  readonly at: number;
  readonly colour: readonly [number, number, number];
}

/**
 * The daylight through the day: a warm late-morning, a neutral noon, a golden late afternoon
 * and a violet dusk as the shutters come down.
 */
const TINT_STOPS: readonly TintStop[] = [
  { at: 0, colour: [255, 246, 228] },
  { at: 0.3, colour: [255, 255, 255] },
  { at: 0.62, colour: [255, 250, 236] },
  { at: 0.85, colour: [255, 220, 176] },
  { at: 1, colour: [214, 198, 232] },
];

/** The clock is quantised to this many steps per day, so the tint redraws a few times per hour. */
const TINT_STEPS_PER_DAY = 96;

/**
 * Computes the multiply tint for a simulation clock reading.
 *
 * @param elapsedMs - Simulated milliseconds since the first opening.
 * @returns The tint as `0xrrggbb`; white means no tint.
 */
export function daylight_tint(elapsedMs: number): number {
  const fraction = (Math.max(0, elapsedMs) % OPERATING_DAY_MS) / OPERATING_DAY_MS;
  const quantised = Math.floor(fraction * TINT_STEPS_PER_DAY) / TINT_STEPS_PER_DAY;
  let previous = TINT_STOPS[0] as TintStop;
  for (const stop of TINT_STOPS) {
    if (quantised <= stop.at) {
      const span = stop.at - previous.at;
      const t = span <= 0 ? 0 : (quantised - previous.at) / span;
      const channel = (index: 0 | 1 | 2) =>
        Math.round(previous.colour[index] + (stop.colour[index] - previous.colour[index]) * t);
      return (channel(0) << 16) | (channel(1) << 8) | channel(2);
    }
    previous = stop;
  }
  const last = TINT_STOPS[TINT_STOPS.length - 1] as TintStop;
  return (last.colour[0] << 16) | (last.colour[1] << 8) | last.colour[2];
}

/**
 * Computes how strongly the lamps glow at a clock reading: faint at noon, full at dusk.
 *
 * @param elapsedMs - Simulated milliseconds since the first opening.
 * @returns A multiplier from 0.35 to 1.
 */
export function lamp_strength(elapsedMs: number): number {
  const fraction = (Math.max(0, elapsedMs) % OPERATING_DAY_MS) / OPERATING_DAY_MS;
  return 0.35 + 0.65 * Math.max(0, (fraction - 0.5) / 0.5);
}

/**
 * Computes the slow pulse of a lamp pool.
 *
 * @param tick - The simulation tick.
 * @param seed - A per-lamp phase offset.
 * @param reducedMotion - True to hold the pulse at its mid value.
 * @returns A multiplier from 0.88 to 1.
 */
export function lamp_pulse(tick: number, seed: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0.94;
  return 0.94 + Math.sin(tick * 0.09 + seed) * 0.06;
}
