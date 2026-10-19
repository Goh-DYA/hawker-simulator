/**
 * Characterization of `validateContent` rule groups.
 *
 * Each test breaks one rule of one group (schema, stall, dish, nutrition, placeable,
 * progression, economy, customer) in a deep copy of the launch content and pins the full
 * list of issues that the validator reports, in order. A full-list assertion also pins the
 * knock-on issues that one broken record causes, and the exact wording that development
 * startup and CI print, so reorganising the validator into rule groups cannot drop,
 * reorder or reword a check unnoticed.
 */
import { describe, expect, it } from "vitest";

import {
  ContentValidationError,
  LAUNCH_CONTENT,
  validateContent,
  type LaunchContent,
} from "@/src/content";

/** A deeply writable view of the launch content, so a test can break one field. */
type Draft<T> = { -readonly [K in keyof T]: Draft<T[K]> };

/**
 * @returns A deep copy of the launch content that a test may change freely.
 */
function create_draft(): Draft<LaunchContent> {
  return structuredClone(LAUNCH_CONTENT) as unknown as Draft<LaunchContent>;
}

/**
 * Validate `candidate` and collect what the validator reports.
 *
 * @param candidate - The content to validate.
 * @returns The issues of the thrown {@link ContentValidationError}, or an empty list when
 * the content is valid.
 * @throws Error Any other error the validator throws, unchanged.
 */
function collect_issues(candidate: unknown): readonly string[] {
  try {
    validateContent(candidate);
    return [];
  } catch (error) {
    if (error instanceof ContentValidationError) return error.issues;
    throw error;
  }
}

describe("validateContent rule groups", () => {
  it("reports nothing for an unchanged copy of the launch content", () => {
    expect(collect_issues(create_draft())).toEqual([]);
  });

  it("schema: reports the path and message of a field outside its schema", () => {
    const draft = create_draft();
    draft.stalls[0].menuSlots = 0;

    expect(collect_issues(draft)).toEqual([
      "stalls.0.menuSlots: Too small: expected number to be >0",
    ]);
  });

  it("stall: reports more menu slots than dishes", () => {
    const draft = create_draft();
    draft.stalls[0].menuSlots = draft.stalls[0].dishIds.length + 1;

    expect(collect_issues(draft)).toEqual([
      "stall.sunrise-roost has more menu slots than available dishes.",
    ]);
  });

  it("dish: reports a reused food visual", () => {
    const draft = create_draft();
    draft.dishes[1].foodSprite = { ...draft.dishes[0].foodSprite };

    expect(collect_issues(draft)).toEqual([
      "dish.roast-chicken-rice reuses food visual food:poached-chicken-rice.",
    ]);
  });

  it("nutrition: reports a variant that uses another dish's profile", () => {
    const draft = create_draft();
    const [first_family, second_family] = draft.nutrition.variantFamilies;
    first_family.variants[1].profileId = second_family.variants[1].profileId;

    expect(collect_issues(draft)).toEqual([
      "kopi-siu-dai uses a nutrition profile from another dish.",
      "kopi-siu-dai is not reciprocated by its nutrition profile.",
    ]);
  });

  it("placeable: reports a resale value above the purchase price", () => {
    const draft = create_draft();
    draft.placeables[0].resaleValue = draft.placeables[0].price + 1;

    expect(collect_issues(draft)).toEqual([
      "item.compact-square-table resale value exceeds purchase price.",
    ]);
  });

  it("progression: reports a record that requires itself to unlock", () => {
    const draft = create_draft();
    draft.stalls[0].unlockRequirement.prerequisiteIds = [draft.stalls[0].id];

    expect(collect_issues(draft)).toEqual([
      "stall.sunrise-roost cannot require itself to unlock.",
      "Unlock prerequisite cycle includes stall.sunrise-roost.",
    ]);
  });

  it("economy: reports a starter stall with no dish available at the start", () => {
    const draft = create_draft();
    const starter_dish_ids = new Set(draft.stalls[0].dishIds);
    for (const dish of draft.dishes) {
      if (starter_dish_ids.has(dish.id)) dish.unlockRequirement.level = 2;
    }

    expect(collect_issues(draft)).toEqual([
      "stall.sunrise-roost has no dish available when the stall unlocks.",
      "stall.sunrise-roost is a starter stall with no dish available at level 1 and the starting reputation.",
    ]);
  });

  it("customer: reports an inverted budget range", () => {
    const draft = create_draft();
    const [low, high] = draft.customerArchetypes[0].budgetRange;
    draft.customerArchetypes[0].budgetRange = [high, low];

    expect(collect_issues(draft)).toEqual([
      "customer.early-shift-regular has an inverted budget range.",
    ]);
  });
});
