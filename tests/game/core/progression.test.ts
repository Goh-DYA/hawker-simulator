/**
 * Milestone and upgrade-rank data in `src/game/core/progression.ts`.
 *
 * The literals below are copies of the inline milestone list and rank ladder as they stood
 * before the data was exported, so any drift in IDs, tiers, targets or claim order fails here.
 */
import { describe, expect, it } from "vitest";

import { MILESTONE_TRACKS, UPGRADE_RANK_REQUIREMENTS } from "@/src/game/core";
import { MILESTONES } from "@/src/game/core/progression";

const PRE_REFACTOR_MILESTONES = [
  { id: "service-1", tier: 1 },
  { id: "service-2", tier: 2 },
  { id: "service-3", tier: 3 },
  { id: "service-4", tier: 4 },
  { id: "hospitality-1", tier: 1 },
  { id: "hospitality-2", tier: 2 },
  { id: "hospitality-3", tier: 3 },
  { id: "hospitality-4", tier: 4 },
  { id: "variety-1", tier: 1 },
  { id: "variety-2", tier: 2 },
  { id: "variety-3", tier: 3 },
  { id: "variety-4", tier: 4 },
  { id: "growth-1", tier: 1 },
  { id: "growth-2", tier: 2 },
  { id: "growth-3", tier: 3 },
  { id: "growth-4", tier: 4 },
];

describe("milestone tracks", () => {
  it("keeps every track's targets in claim order", () => {
    expect(MILESTONE_TRACKS).toEqual([
      { id: "service", targets: [50, 250, 1_000, 5_000] },
      { id: "hospitality", targets: [75, 85, 90, 95] },
      { id: "variety", targets: [2, 4, 6, 8] },
      { id: "growth", targets: [3, 7, 12, 20] },
    ]);
  });

  it("builds the milestone tiers in the pre-refactor order", () => {
    expect(MILESTONES.map(({ id, tier }) => ({ id, tier }))).toEqual(PRE_REFACTOR_MILESTONES);
  });
});

describe("upgrade rank requirements", () => {
  it("keeps the mastery rank ladder for upgrade levels 2 to 4", () => {
    expect(UPGRADE_RANK_REQUIREMENTS).toEqual({ 2: 2, 3: 4, 4: 7 });
  });
});
