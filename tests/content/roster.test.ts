/**
 * Tests for the launch roster in `src/content/roster.ts`.
 *
 * One test pins the roster literals, so a count only changes on purpose. The others
 * check that `validateContent`, not the import-time schema, reports content that
 * breaks the roster, including the intent-uniqueness and unknown-intent rules that a
 * duplicated intent trips.
 */
import { describe, expect, it } from "vitest";

import { LAUNCH_ROSTER, PLACEABLE_CATEGORY_MINIMUMS } from "@/src/content";

import { collect_issues, create_draft } from "./fixtures";

describe("LAUNCH_ROSTER", () => {
  it("pins the launch record counts", () => {
    expect(LAUNCH_ROSTER).toEqual({
      stalls: 18,
      dishes: 91,
      placeables: 80,
      customerArchetypes: 12,
      nutritionSourceSnapshots: 2,
      nutritionVariantFamilies: 23,
      nutritionIntents: 5,
      nutritionGuidelines: 11,
    });
  });

  it("pins the placeable category minimums", () => {
    expect(PLACEABLE_CATEGORY_MINIMUMS).toEqual({
      table: 8,
      seat: 10,
      "stall-fixture": 8,
      "tray-waste": 8,
      lighting: 7,
      fan: 6,
      plant: 8,
      signage: 7,
      divider: 6,
      facility: 7,
      decor: 5,
    });
  });

  it("reports a nutrition guideline list shorter than the roster", () => {
    const draft = create_draft();
    draft.nutrition.guidelines.pop();

    expect(collect_issues(draft)).toContain(
      `Expected exactly ${LAUNCH_ROSTER.nutritionGuidelines} nutrition guidelines, found ${LAUNCH_ROSTER.nutritionGuidelines - 1}.`,
    );
  });

  it("reports a nutrition source snapshot list shorter than the roster", () => {
    const draft = create_draft();
    draft.nutrition.sourceSnapshots.pop();

    expect(collect_issues(draft)).toContain(
      `Expected exactly ${LAUNCH_ROSTER.nutritionSourceSnapshots} nutrition source snapshots, found ${LAUNCH_ROSTER.nutritionSourceSnapshots - 1}.`,
    );
  });

  it("reports a nutrition variant family list shorter than the roster", () => {
    const draft = create_draft();
    draft.nutrition.variantFamilies.pop();

    expect(collect_issues(draft)).toContain(
      `Expected exactly ${LAUNCH_ROSTER.nutritionVariantFamilies} nutrition variant families, found ${LAUNCH_ROSTER.nutritionVariantFamilies - 1}.`,
    );
  });

  it("reports a nutrition intent list longer than the roster", () => {
    const draft = create_draft();
    draft.nutrition.intents.push(structuredClone(draft.nutrition.intents[0]));

    expect(collect_issues(draft)).toContain(
      `Expected exactly ${LAUNCH_ROSTER.nutritionIntents} nutrition intents, found ${LAUNCH_ROSTER.nutritionIntents + 1}.`,
    );
  });

  it("reports a duplicate nutrition intent and the profile fit it leaves unknown", () => {
    const draft = create_draft();
    const intents = draft.nutrition.intents;
    const missing_id = intents[intents.length - 1].id;
    intents[intents.length - 1] = structuredClone(intents[0]);
    const profile = draft.nutrition.profiles.find((candidate) =>
      Object.hasOwn(candidate.intentFits, missing_id),
    );

    expect(profile).toBeDefined();
    expect(collect_issues(draft)).toEqual(
      expect.arrayContaining([
        "Nutrition intent IDs must be unique.",
        `${profile?.id} exposes unknown nutrition intent ${missing_id}.`,
      ]),
    );
  });

  it("reports a nutrition profile total that does not match the dishes and variants", () => {
    const draft = create_draft();
    const profile_count = draft.nutrition.profiles.length;
    draft.nutrition.profiles.push(structuredClone(draft.nutrition.profiles[0]));

    expect(collect_issues(draft)).toContain(
      `Expected exactly ${profile_count} nutrition profiles (one per dish plus one per non-default variant), found ${profile_count + 1}.`,
    );
  });
});
