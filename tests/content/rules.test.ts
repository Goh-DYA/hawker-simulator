/**
 * Tests for the order of the rule groups in `src/content/rules.ts`.
 *
 * `tests/content/validate.test.ts` breaks one rule of one group per test. This test
 * breaks one rule in several groups at once, so it also pins the order in which
 * `validateContent` runs the groups and reports their issues.
 */
import { describe, expect, it } from "vitest";

import { collect_issues, create_draft } from "./fixtures";

describe("content rule groups", () => {
  it("reports issues group by group, in the validator's order", () => {
    const draft = create_draft();
    draft.customerArchetypes[0].budgetRange = [
      draft.customerArchetypes[0].budgetRange[1],
      draft.customerArchetypes[0].budgetRange[0],
    ];
    draft.economy.levelXpThresholds[2] = draft.economy.levelXpThresholds[1];
    draft.stalls[0].unlockRequirement.prerequisiteIds = [draft.stalls[0].id];
    draft.placeables[0].resaleValue = draft.placeables[0].price + 1;
    const [first_family, second_family] = draft.nutrition.variantFamilies;
    first_family.variants[1].profileId = second_family.variants[1].profileId;
    draft.dishes[1].foodSprite = { ...draft.dishes[0].foodSprite };
    draft.stalls[0].menuSlots = draft.stalls[0].dishIds.length + 1;

    expect(collect_issues(draft)).toEqual([
      "stall.sunrise-roost has more menu slots than available dishes.",
      "dish.roast-chicken-rice reuses food visual food:poached-chicken-rice.",
      "kopi-siu-dai uses a nutrition profile from another dish.",
      "kopi-siu-dai is not reciprocated by its nutrition profile.",
      "item.compact-square-table resale value exceeds purchase price.",
      "stall.sunrise-roost cannot require itself to unlock.",
      "Unlock prerequisite cycle includes stall.sunrise-roost.",
      "XP thresholds must increase strictly at level 3.",
      "customer.early-shift-regular has an inverted budget range.",
    ]);
  });
});
