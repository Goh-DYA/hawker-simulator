/**
 * Goldens for the nutrition importer's rating passes and its serialised output.
 *
 * The re-rating suite clears every derived rating and intent fit from the checked-in
 * `src/content/nutrition.generated.json`, reruns `addIntentFits` and `addHealthRatings`
 * on the real profiles, and expects the checked-in values back exactly. That pins the
 * rating maths against real data, including trace and unreported nutrients.
 *
 * The output suite runs `buildNutritionContent` end to end on `fixtures/varied.csv` and
 * pins the sha256 of the exact text the CLI writes. The fixture has one row per mapped
 * food with distinct values, one Trace value (Kopi O kosong sugar), one quarantined row
 * (Mee rebus, saturated fat above total fat), one grouped number (Laksa sodium), one `-`
 * nutrient (Lor mee calcium), one `-` default serving label (Popiah), the manifest's
 * scaled mappings, the rows of its three composites, and component and drink-base rows
 * that make the paired-component and drink-family plausibility rules withhold values. It
 * has no `Food Subgroup` column, so the outlier fence is covered by the unit tests in
 * `plausibility.test.ts`.
 *
 * If a refactor makes either suite fail, the refactor changed importer output: fix the
 * code, never the literal or the fixture.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { nutritionContentSchema } from "@/src/content/schemas";
import type {
  NutritionClass,
  NutritionProfileStatus,
  NutritionValue,
} from "@/src/content/types";
import {
  addHealthRatings,
  addIntentFits,
  buildNutritionContent,
} from "@/tools/nutrition/importer.mjs";

/** sha256 of `${JSON.stringify(content, null, 2)}\n` for the varied fixture. */
const VARIED_OUTPUT_SHA256 = "0d9fe382d9680432861f42879cec620b1d10b0c869d9d28bd3aaba78b7707e78";

/** Guideline rows for the 11 nutrients the importer recognises, in source order. */
const GUIDELINE_ROWS = [
  ["kcal (Energy)", "1,700 kcal", "2,300 kcal", "Fixture energy reference range.", "Fixture A"],
  ["Fats", "20% of energy", "35% of energy", "Fixture total fat reference.", "Fixture B"],
  ["Saturated Fat", "0 g", "20 g", "Fixture saturated fat ceiling.", "Fixture C"],
  ["Trans Fat", "0 g", "2 g", "Fixture trans fat ceiling.", "Fixture D"],
  ["Protein", "50 g", "70 g", "Fixture protein reference range.", "Fixture E"],
  ["Carbohydrates", "45% of energy", "65% of energy", "Fixture carbohydrate range.", "Fixture F"],
  ["Sugar", "0 g", "40 g", "Fixture added sugar ceiling.", "Fixture G"],
  ["Fiber", "20 g", "30 g", "Fixture dietary fibre range.", "Fixture H"],
  ["Cholesterol", "0 mg", "300 mg", "Fixture cholesterol ceiling.", "Fixture I"],
  ["Sodium", "0 mg", "2,000 mg", "Fixture sodium ceiling.", "Fixture J"],
  ["Water", "2 L", "3 L", "Fixture drinking water range.", "Fixture K"],
] as const;

const GUIDELINE_HEADERS = [
  "Nutrient",
  "Recommended Daily Range (Lower Limit)",
  "Recommended Daily Range (Upper Limit)",
  "Remarks (if any)",
  "Source",
] as const;

/**
 * The fields that the importer's rating passes read from each profile, and the derived
 * fields that they write onto it.
 */
interface RatedProfile {
  id: string;
  status: NutritionProfileStatus;
  nutritionClass: NutritionClass;
  nutrients: Record<string, NutritionValue>;
  healthRating?: number;
  conditionRatings?: Record<string, number>;
  intentFits: Record<string, number>;
}

interface GeneratedNutrition {
  profiles: RatedProfile[];
}

function read_checked_in_nutrition(): GeneratedNutrition {
  const text = readFileSync(
    new URL("../../../src/content/nutrition.generated.json", import.meta.url),
    "utf8",
  );
  return JSON.parse(text) as GeneratedNutrition;
}

function strip_derived_ratings(profiles: readonly RatedProfile[]): RatedProfile[] {
  const stripped = structuredClone(profiles) as RatedProfile[];
  for (const profile of stripped) {
    delete profile.healthRating;
    delete profile.conditionRatings;
    profile.intentFits = {};
  }
  return stripped;
}

function quote_csv_cell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function build_guideline_text(): string {
  return [GUIDELINE_HEADERS, ...GUIDELINE_ROWS]
    .map((row) => row.map(quote_csv_cell).join(","))
    .join("\n");
}

/**
 * Reads the varied fixture with LF line endings, so the source sha256 the importer
 * embeds does not depend on how git checked the file out.
 */
function read_varied_food_text(): string {
  const text = readFileSync(new URL("./fixtures/varied.csv", import.meta.url), "utf8");
  return text.replaceAll("\r\n", "\n");
}

/** The exact text `runImporter` would write for the varied fixture. */
function serialise_varied_content(): string {
  const content = buildNutritionContent({
    foodText: read_varied_food_text(),
    guidelineText: build_guideline_text(),
  });
  return `${JSON.stringify(content, null, 2)}\n`;
}

function hash_text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("nutrition importer re-rating golden", () => {
  it("re-rates the checked-in profiles to their checked-in ratings and intent fits", () => {
    const checked_in = read_checked_in_nutrition();
    const rerated = strip_derived_ratings(checked_in.profiles);

    addIntentFits(rerated);
    addHealthRatings(rerated);

    expect(rerated).toStrictEqual(checked_in.profiles);
  });
});

describe("nutrition importer output golden", () => {
  it("pins the sha256 of the serialised output for the varied fixture", () => {
    expect(hash_text(serialise_varied_content())).toBe(VARIED_OUTPUT_SHA256);
  });

  it("produces output that the nutrition content schema accepts", () => {
    const result = nutritionContentSchema.safeParse(JSON.parse(serialise_varied_content()));

    expect(result.error).toBeUndefined();
  });

  it("covers a trace value, a quarantined row, scaled mappings, withheld values and composites", () => {
    const content = nutritionContentSchema.parse(JSON.parse(serialise_varied_content()));

    expect({
      quarantined: content.profiles
        .filter((profile) => profile.status === "quarantined")
        .map((profile) => profile.id),
      traced: content.profiles
        .filter((profile) =>
          Object.values(profile.nutrients).some((nutrient) => nutrient.status === "trace"),
        )
        .map((profile) => profile.id),
      hasScaledMapping: content.profiles.some(
        (profile) =>
          profile.provenance?.mappingKind === "scaled-exact" && profile.provenance.multiplier > 1,
      ),
      withheld: content.profiles
        .filter((profile) => profile.withheldReasons !== undefined)
        .map((profile) => profile.id),
      composites: content.profiles
        .filter((profile) => profile.components !== undefined)
        .map((profile) => profile.id),
    }).toEqual({
      withheld: [
        "dish.poached-chicken-rice",
        "dish.mee-rebus",
        "dish.kopi",
        "dish.lor-mee",
        "dish.teh-tarik",
        "dish.duck-rice",
        "dish.kway-chap",
        "dish.mee-siam",
        "dish.kopi:kopi-c",
        "dish.kopi:kopi-o",
        "dish.teh-tarik:teh-c",
      ],
      composites: ["dish.soya-tofu-rice", "dish.roti-prata", "dish.nyonya-laksa"],
      quarantined: ["dish.mee-rebus"],
      traced: ["dish.kopi:kopi-o-kosong"],
      hasScaledMapping: true,
    });
  });
});
