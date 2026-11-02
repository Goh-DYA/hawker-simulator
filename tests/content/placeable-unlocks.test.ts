/**
 * Placeable unlock pacing and service modifiers: every piece's reputation gate sits on the stall
 * curve, the unlocks are spread so that each level from 2 to the last stall's (30) adds
 * something and day 1 does not open a large share of the catalogue, and no piece carries a
 * service penalty.
 */
import { describe, expect, it } from "vitest";

import { PLACEABLES, STALLS } from "@/src/content";

/** The level of the last stall to unlock, which ends the unlock ladder. */
const LAST_STALL_LEVEL = Math.max(...STALLS.map((stall) => stall.unlockRequirement.level));
/** The highest level a centre reaches on day 1 in the review panel's measured runs. */
const DAY_ONE_LEVEL = 4;
/** The highest level a centre reaches by day 5 in the same runs. */
const DAY_FIVE_LEVEL = 7;
/** The most placeables that may unlock by the end of day 1. */
const MAX_DAY_ONE_UNLOCKS = 21;
/** The most placeables that may unlock by day 5. */
const MAX_DAY_FIVE_UNLOCKS = 34;

/**
 * Gives the stall curve's reputation at a level: the reputation of the stall unlocked at that
 * level, or else the rounded-down midpoint of the stalls at the levels either side.
 *
 * @param level - The unlock level.
 * @returns The reputation gate a placeable at that level must have.
 */
function stall_curve_reputation(level: number): number {
  const at_level = (target: number) =>
    STALLS.find((stall) => stall.unlockRequirement.level === target)?.unlockRequirement.reputation;
  const exact = at_level(level);
  if (exact !== undefined) return exact;
  const below = at_level(level - 1);
  const above = at_level(level + 1);
  if (below === undefined || above === undefined) {
    throw new Error(`No stall curve around level ${level}`);
  }
  return Math.floor((below + above) / 2);
}

/**
 * Counts the placeables that unlock at or below a level.
 *
 * @param level - The level reached.
 * @returns The number of placeables unlocked by then.
 */
function count_unlocked_by(level: number): number {
  return PLACEABLES.filter((item) => item.unlockRequirement.level <= level).length;
}

describe("placeable unlocks", () => {
  it("gates every placeable at the stall curve's reputation for its level", () => {
    const off_curve = PLACEABLES.filter(
      (item) =>
        item.unlockRequirement.reputation !== stall_curve_reputation(item.unlockRequirement.level),
    ).map((item) => item.id);
    expect(off_curve).toEqual([]);
  });

  it("adds at least one placeable at every level from 2 to the last stall's level", () => {
    const empty_levels = Array.from(
      { length: LAST_STALL_LEVEL - 1 },
      (_, index) => index + 2,
    ).filter((level) => !PLACEABLES.some((item) => item.unlockRequirement.level === level));
    expect(empty_levels).toEqual([]);
  });

  it("keeps day 1 and the first five days from opening most of the catalogue", () => {
    expect(count_unlocked_by(DAY_ONE_LEVEL)).toBeLessThanOrEqual(MAX_DAY_ONE_UNLOCKS);
    expect(count_unlocked_by(DAY_FIVE_LEVEL)).toBeLessThanOrEqual(MAX_DAY_FIVE_UNLOCKS);
  });

  it("gives no placeable a service penalty", () => {
    const penalised = PLACEABLES.filter((item) =>
      Object.values(item.serviceModifiers).some((value) => value < 0),
    ).map((item) => item.id);
    expect(penalised).toEqual([]);
  });
});
