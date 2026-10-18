/**
 * Tests for the atmosphere rules in `runtime/render/atmosphere.ts`: the daylight tint over the
 * operating day, the lamp strength and the lamp pulse.
 */
import { describe, expect, it } from "vitest";

import { OPERATING_DAY_MS } from "@/src/game/core";
import { daylight_tint, lamp_pulse, lamp_strength } from "@/src/game/runtime/render/atmosphere";

describe("daylight_tint", () => {
  it("opens warm, is neutral by late morning and ends in dusk", () => {
    expect(daylight_tint(0)).toBe(0xfff6e4);
    expect(daylight_tint(OPERATING_DAY_MS * 0.3)).toBeGreaterThanOrEqual(0xfffdfd);
    expect(daylight_tint(OPERATING_DAY_MS * 0.999)).toBe(daylight_tint(OPERATING_DAY_MS * 0.99));
    const dusk = daylight_tint(OPERATING_DAY_MS * 0.99);
    expect(dusk >>> 16).toBeLessThan(0xff);
    expect(dusk & 0xff).toBeGreaterThan((dusk >>> 8) & 0xff);
  });

  it("is quantised so neighbouring clock readings share a tint and wraps at the next day", () => {
    expect(daylight_tint(1_000)).toBe(daylight_tint(0));
    expect(daylight_tint(OPERATING_DAY_MS)).toBe(daylight_tint(0));
    expect(daylight_tint(-5)).toBe(daylight_tint(0));
  });
});

describe("lamps", () => {
  it("glow faintly at noon and fully at close", () => {
    expect(lamp_strength(0)).toBeCloseTo(0.35);
    expect(lamp_strength(OPERATING_DAY_MS * 0.5)).toBeCloseTo(0.35);
    expect(lamp_strength(OPERATING_DAY_MS * 0.999)).toBeCloseTo(1, 1);
  });

  it("pulse within a narrow band and hold still under reduced motion", () => {
    for (let tick = 0; tick < 100; tick += 7) {
      const pulse = lamp_pulse(tick, 3, false);
      expect(pulse).toBeGreaterThanOrEqual(0.88);
      expect(pulse).toBeLessThanOrEqual(1);
    }
    expect(lamp_pulse(5, 3, true)).toBe(lamp_pulse(99, 11, true));
  });
});
