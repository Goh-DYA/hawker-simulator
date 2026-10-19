import { describe, expect, it } from "vitest";

import { MAX_REPUTATION } from "@/src/game/core/economy";
import { WAIT_GRACE_PATIENCE_SHARE, wait_satisfaction_score } from "@/src/game/core/satisfaction";
import { next_reputation, REPUTATION_SMOOTHING } from "@/src/game/core/visits";

/** Visits after which an average has closed nearly all of the gap to a steady score. */
const SETTLING_VISITS = 400;

function settle(reputation: number, score: number, visits = SETTLING_VISITS): number {
  let current = reputation;
  for (let visit = 0; visit < visits; visit += 1) current = next_reputation(current, score);
  return current;
}

describe("wait satisfaction", () => {
  it("scores a wait inside the grace share of patience as a full 100", () => {
    expect(wait_satisfaction_score(60_000, 60_000)).toBe(100);
    expect(wait_satisfaction_score(60_000 * (1 - WAIT_GRACE_PATIENCE_SHARE), 60_000)).toBe(100);
  });

  it("falls linearly to zero once patience runs out", () => {
    expect(wait_satisfaction_score(30_000, 60_000)).toBeCloseTo(83.33, 2);
    expect(wait_satisfaction_score(18_000, 60_000)).toBeCloseTo(50, 6);
    expect(wait_satisfaction_score(0, 60_000)).toBe(0);
    expect(wait_satisfaction_score(-5_000, 60_000)).toBe(0);
  });

  it("clamps patience above the full amount and a non-positive full patience", () => {
    expect(wait_satisfaction_score(90_000, 60_000)).toBe(100);
    expect(wait_satisfaction_score(0, 0)).toBe(0);
  });
});

describe("reputation average", () => {
  it("closes the smoothing share of the gap to the visit's target", () => {
    const start = 1;
    const target = MAX_REPUTATION;
    expect(next_reputation(start, 95)).toBeCloseTo(
      start + REPUTATION_SMOOTHING * (target - start),
      12,
    );
  });

  it("settles at the level a steady score reflects instead of draining to zero", () => {
    expect(settle(0.4, 63)).toBeCloseTo(1, 2);
    expect(settle(5, 63)).toBeCloseTo(1, 2);
    expect(settle(0.4, 40)).toBeCloseTo(0, 2);
    expect(settle(0.4, 100)).toBeCloseTo(MAX_REPUTATION, 2);
  });

  it("recovers after a run of poor visits once service improves", () => {
    const after_bad_day = settle(2, 30, 80);
    const after_good_day = settle(after_bad_day, 80, 80);
    expect(after_bad_day).toBeLessThan(0.5);
    expect(after_good_day).toBeGreaterThan(2.5);
  });

  it("never rises on a lower score than a higher one from the same start", () => {
    for (let score = 0; score < 100; score += 5) {
      expect(next_reputation(2, score)).toBeLessThanOrEqual(next_reputation(2, score + 5));
    }
  });

  it("stays within zero and the maximum", () => {
    expect(next_reputation(0, 0)).toBe(0);
    expect(next_reputation(MAX_REPUTATION, 100)).toBe(MAX_REPUTATION);
  });
});
