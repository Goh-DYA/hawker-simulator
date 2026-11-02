/**
 * The tapered seat-rating curve: a finished meal's comfort, cleanliness and ambience factors keep
 * rising with the seat's ambience and cleanliness at a decreasing rate, match the former linear
 * rule over its first stretch, and reach 100 only far beyond the former caps.
 */
import { describe, expect, it } from "vitest";

import { compute_meal_rating_factors } from "@/src/game/core/lifecycle";
import { compute_tapered_rating_gain, RATING_TAPER_DOUBLINGS } from "@/src/game/core/utility";

/** The former linear rule, capped at 100, for comparison over the stretch that keeps it. */
function former_factors(ambience: number, cleanliness: number) {
  return {
    comfort: Math.min(100, 76 + ambience * 6),
    cleanliness: Math.min(100, 82 + cleanliness * 8),
    ambience: Math.min(100, 72 + ambience * 9),
  };
}

function factors(ambience: number, cleanliness = 0, uncleared_penalty = 0) {
  return compute_meal_rating_factors(
    { ambience, cleanliness, cleaningEfficiency: 0 },
    uncleared_penalty,
  );
}

describe("compute_tapered_rating_gain", () => {
  it("counts the full-rate stretch, zero and penalties in full", () => {
    for (const points of [-30, -1, 0, 4, 11.5, 12]) {
      expect(compute_tapered_rating_gain(points, 12, 3)).toBe(points);
    }
  });

  it("adds one step per doubling and reaches its maximum only after four doublings", () => {
    expect(RATING_TAPER_DOUBLINGS).toBe(4);
    expect(compute_tapered_rating_gain(24, 12, 3)).toBe(15);
    expect(compute_tapered_rating_gain(48, 12, 3)).toBe(18);
    expect(compute_tapered_rating_gain(96, 12, 3)).toBe(21);
    expect(compute_tapered_rating_gain(191, 12, 3)).toBeLessThan(24);
    expect(compute_tapered_rating_gain(192, 12, 3)).toBe(24);
    expect(compute_tapered_rating_gain(10_000, 12, 3)).toBe(24);
  });

  it("is continuous, rises without a plateau and slows down as the points grow", () => {
    let previous_gain = compute_tapered_rating_gain(0, 12, 3);
    let previous_slope = Number.POSITIVE_INFINITY;
    for (let points = 0.5; points < 192; points += 0.5) {
      const gain = compute_tapered_rating_gain(points, 12, 3);
      const slope = (gain - previous_gain) / 0.5;
      expect(gain).toBeGreaterThan(previous_gain);
      expect(slope).toBeLessThanOrEqual(previous_slope + 1e-9);
      expect(gain - previous_gain).toBeLessThanOrEqual(0.5);
      previous_gain = gain;
      previous_slope = slope;
    }
  });
});

describe("compute_meal_rating_factors", () => {
  it("keeps the former values for a starter seat's ambience and cleanliness", () => {
    for (const ambience of [0, 0.5, 1, 1.5, 2]) {
      const now = factors(ambience);
      const former = former_factors(ambience, 0);
      expect(now.comfort).toBeCloseTo(former.comfort, 9);
      expect(now.ambience).toBeCloseTo(former.ambience, 9);
    }
    for (const cleanliness of [0, 0.5, 1]) {
      expect(factors(0, cleanliness).cleanliness).toBeCloseTo(
        former_factors(0, cleanliness).cleanliness,
        9,
      );
    }
  });

  it("stays within 1.5 comfort points of the former rule up to ambience 2.25", () => {
    for (let ambience = 0; ambience <= 2.25; ambience += 0.25) {
      expect(
        Math.abs(factors(ambience).comfort - former_factors(ambience, 0).comfort),
      ).toBeLessThanOrEqual(1.5);
    }
  });

  it("keeps rewarding ambience past the former cap without reaching 100 before ambience 32", () => {
    let previous = factors(0);
    for (let ambience = 1; ambience <= 12; ambience += 1) {
      const current = factors(ambience);
      expect(current.comfort).toBeGreaterThan(previous.comfort);
      expect(current.ambience).toBeGreaterThan(previous.ambience);
      expect(current.comfort).toBeLessThan(100);
      expect(current.ambience).toBeLessThan(100);
      previous = current;
    }
    expect(factors(31.9).comfort).toBeLessThan(100);
    expect(factors(31.9).ambience).toBeLessThan(100);
    expect(factors(32).comfort).toBe(100);
    expect(factors(32).ambience).toBe(100);
  });

  it("keeps rewarding cleanliness past the former cap without reaching 100 before cleanliness 16", () => {
    let previous = factors(0, 0).cleanliness;
    for (let cleanliness = 1; cleanliness <= 8; cleanliness += 1) {
      const current = factors(0, cleanliness).cleanliness;
      expect(current).toBeGreaterThan(previous);
      expect(current).toBeLessThan(100);
      previous = current;
    }
    expect(factors(0, 15.9).cleanliness).toBeLessThan(100);
    expect(factors(0, 16).cleanliness).toBe(100);
  });

  it("lets a tray left nearby lower cleanliness even in a very clean area", () => {
    const clean = factors(0, 6).cleanliness;
    expect(factors(0, 6, 12).cleanliness).toBeLessThan(clean);
    expect(factors(0, 0, 30).cleanliness).toBe(52);
  });

  it("keeps the floors for negative ambience", () => {
    expect(factors(-30).comfort).toBe(45);
    expect(factors(-30).ambience).toBe(40);
    expect(factors(0, -30).cleanliness).toBe(35);
  });
});
