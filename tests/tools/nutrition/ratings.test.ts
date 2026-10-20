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
 * food with distinct values (the rows added for content 1.6.0 are their source rows scaled
 * by 0.90-1.02, keeping the source's Trace cells), a Trace sugar in Kopi O kosong, one
 * quarantined row (Mee rebus, saturated fat above total fat), one grouped number (Laksa
 * sodium), one `-` nutrient (Lor mee calcium), one `-` default serving label (Popiah),
 * the manifest's scaled mappings, the rows of its seven composites, and component and
 * drink-base rows that make the paired-component and drink-family plausibility rules
 * withhold values. It has no `Food Subgroup` column, so the outlier fence is covered by the
 * unit tests in `plausibility.test.ts`.
 *
 * The anchor suite rates frozen synthetic meal servings (ADR 0009): a lean serving with
 * every limit nutrient at half a meal's share, an on-budget serving at one meal share, and
 * the lean serving with more sodium or saturated fat. Each saturated-fat case adds 9 kcal
 * and 1 g of total fat per extra gram. It fixes orderings and bounds, not constants. The
 * property suite raises one nutrient of every released meal at a time and expects the
 * overall rating never to move the wrong way.
 *
 * If a refactor makes either golden suite fail, the refactor changed importer output: fix
 * the code, never the literal or the fixture.
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
const VARIED_OUTPUT_SHA256 = "cee6903938095b8647481578b1b7de3c32d8b8bce4af621238f00375fcd39d1f";

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

/** The per-serving amounts of a frozen synthetic meal serving, every field set. */
interface SyntheticServing {
  grams: number;
  energyKcal: number;
  proteinG: number;
  totalFatG: number;
  saturatedFatG: number;
  carbohydrateG: number;
  totalSugarG: number;
  dietaryFibreG: number;
  sodiumMg: number;
}

/** Every limit nutrient at half a meal's share of the day. */
const LEAN_SERVING: SyntheticServing = {
  grams: 350,
  energyKcal: 500,
  proteinG: 25,
  totalFatG: 15,
  saturatedFatG: 3.67,
  carbohydrateG: 65,
  totalSugarG: 8.3,
  dietaryFibreG: 6,
  sodiumMg: 333,
};

/** Every limit nutrient at one meal's share (a third of the day). */
const ON_BUDGET_SERVING: SyntheticServing = {
  grams: 400,
  energyKcal: 667,
  proteinG: 25,
  totalFatG: 26,
  saturatedFatG: 7.33,
  carbohydrateG: 85,
  totalSugarG: 16.7,
  dietaryFibreG: 6,
  sodiumMg: 667,
};

/** The lean serving with a full day (22 g) of saturated fat. */
const LEAN_SATURATED_FAT_ONE_DAY: SyntheticServing = {
  ...LEAN_SERVING,
  energyKcal: 664.97,
  totalFatG: 33.33,
  saturatedFatG: 22,
};

/** The lean serving with two days (44 g) of saturated fat. */
const LEAN_SATURATED_FAT_TWO_DAYS: SyntheticServing = {
  ...LEAN_SERVING,
  energyKcal: 862.97,
  totalFatG: 55.33,
  saturatedFatG: 44,
};

function build_synthetic_profile(serving: SyntheticServing): RatedProfile & {
  dishId: string;
  serving: { amount: number };
} {
  const known = (value: number): NutritionValue => ({ status: "known", value });
  return {
    id: "dish.synthetic",
    dishId: "dish.synthetic",
    status: "released",
    nutritionClass: "meal",
    serving: { amount: serving.grams },
    nutrients: {
      energyKcal: known(serving.energyKcal),
      proteinG: known(serving.proteinG),
      totalFatG: known(serving.totalFatG),
      saturatedFatG: known(serving.saturatedFatG),
      transFatG: known(0),
      carbohydrateG: known(serving.carbohydrateG),
      totalSugarG: known(serving.totalSugarG),
      dietaryFibreG: known(serving.dietaryFibreG),
      sodiumMg: known(serving.sodiumMg),
      calciumMg: known(0),
      ironMg: known(0),
      waterG: known(0),
    },
    intentFits: {},
  };
}

function rate_synthetic(serving: SyntheticServing): number {
  const profile = build_synthetic_profile(serving);
  addHealthRatings([profile]);
  return profile.healthRating ?? Number.NaN;
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

describe("overall meal rating anchors", () => {
  const lean_with_sodium = (sodium_mg: number) =>
    rate_synthetic({ ...LEAN_SERVING, sodiumMg: sodium_mg });
  const lean = rate_synthetic(LEAN_SERVING);
  const on_budget = rate_synthetic(ON_BUDGET_SERVING);

  it("rates the lean serving at least 4.5 and the on-budget serving at most 2.8", () => {
    expect(lean).toBeGreaterThanOrEqual(4.5);
    expect(on_budget).toBeLessThanOrEqual(2.8);
    expect(on_budget).toBeLessThan(lean);
  });

  it("keeps lowering the rating for each further day of sodium, with no plateau", () => {
    const by_days = [2_000, 3_000, 4_000, 6_000].map(lean_with_sodium);
    expect(by_days[0]).toBeLessThanOrEqual(3.6);
    for (let index = 1; index < by_days.length; index += 1) {
      expect(by_days[index]).toBeLessThan(by_days[index - 1]);
    }
    const [one_day, , two_days, three_days] = by_days;
    expect(one_day - two_days).toBeGreaterThanOrEqual(0.9);
    expect(two_days - three_days).toBeGreaterThanOrEqual(0.9);
    expect(two_days).toBeLessThanOrEqual(on_budget);
  });

  it("rates two days of saturated fat no higher than the on-budget serving", () => {
    expect(rate_synthetic(LEAN_SATURATED_FAT_ONE_DAY)).toBeGreaterThan(
      rate_synthetic(LEAN_SATURATED_FAT_TWO_DAYS),
    );
    expect(rate_synthetic(LEAN_SATURATED_FAT_TWO_DAYS)).toBeLessThanOrEqual(on_budget);
  });

  it("still counts the rest of the serving past a day of sodium", () => {
    expect(rate_synthetic({ ...ON_BUDGET_SERVING, sodiumMg: 4_000 })).toBeLessThanOrEqual(
      lean_with_sodium(4_000) - 0.5,
    );
  });

  it("pins the anchor ratings", () => {
    expect({
      lean,
      onBudget: on_budget,
      leanSodiumDays: [1_333, 2_000, 3_000, 4_000, 6_000].map(lean_with_sodium),
      leanSaturatedFatDays: [LEAN_SATURATED_FAT_ONE_DAY, LEAN_SATURATED_FAT_TWO_DAYS].map(
        rate_synthetic,
      ),
      onBudgetTwoDaysSodium: rate_synthetic({ ...ON_BUDGET_SERVING, sodiumMg: 4_000 }),
    }).toEqual({
      lean: 4.6,
      onBudget: 2.6,
      leanSodiumDays: [3.8, 3.5, 2.7, 2.2, 1.2],
      leanSaturatedFatDays: [3.1, 1.6],
      onBudgetTwoDaysSodium: 1,
    });
  });
});

describe("overall meal rating properties", () => {
  const LIMIT_METRICS = [
    "energyKcal",
    "saturatedFatG",
    "sodiumMg",
    "totalSugarG",
    "totalFatG",
    "carbohydrateG",
  ] as const;
  const CREDIT_METRICS = ["dietaryFibreG", "proteinG"] as const;
  const meals = read_checked_in_nutrition().profiles.filter(
    (profile) => profile.status === "released" && profile.nutritionClass === "meal",
  );
  const rate_with = (profile: RatedProfile, metric: string, factor: number) => {
    const changed = strip_derived_ratings([profile])[0];
    const value = changed.nutrients[metric];
    if (value.status !== "known") return undefined;
    changed.nutrients[metric] = { status: "known", value: value.value * factor };
    const sugar = changed.nutrients.totalSugarG;
    const carbohydrate = changed.nutrients.carbohydrateG;
    if (
      metric === "totalSugarG" &&
      sugar.status === "known" &&
      carbohydrate.status === "known" &&
      carbohydrate.value < sugar.value
    ) {
      changed.nutrients.carbohydrateG = { status: "known", value: sugar.value };
    }
    addHealthRatings([changed]);
    return changed.healthRating;
  };

  it("never raises the rating when a meal holds more of a limit nutrient", () => {
    for (const profile of meals) {
      for (const metric of LIMIT_METRICS) {
        for (const factor of [1.05, 1.2, 1.5, 2, 3]) {
          const rating = rate_with(profile, metric, factor);
          if (rating === undefined) continue;
          expect(rating, `${profile.id} ${metric} x${factor}`).toBeLessThanOrEqual(
            profile.healthRating ?? Number.NaN,
          );
        }
      }
    }
  });

  it("never lowers the rating when a meal holds more fibre or protein", () => {
    for (const profile of meals) {
      for (const metric of CREDIT_METRICS) {
        for (const factor of [1.2, 2, 4]) {
          const rating = rate_with(profile, metric, factor);
          if (rating === undefined) continue;
          expect(rating, `${profile.id} ${metric} x${factor}`).toBeGreaterThanOrEqual(
            profile.healthRating ?? Number.NaN,
          );
        }
      }
    }
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
        "dish.kopi:kopi-c-siu-dai",
        "dish.kopi:kopi-o-siu-dai",
        "dish.teh-tarik:teh-c",
      ],
      composites: [
        "dish.soya-tofu-rice",
        "dish.roti-prata",
        "dish.nyonya-laksa",
        "dish.bak-kut-teh",
        "dish.bak-kut-teh:bak-kut-teh-soup",
        "dish.bak-kut-teh:bak-kut-teh-herbal",
        "dish.bak-kut-teh:bak-kut-teh-dry",
      ],
      quarantined: ["dish.mee-rebus"],
      traced: [
        "dish.century-egg-porridge",
        "dish.minced-pork-porridge",
        "dish.chee-cheong-fun",
        "dish.cheng-tng",
        "dish.green-bean-soup",
        "dish.nasi-goreng",
        "dish.mee-soto",
        "dish.ayam-panggang",
        "dish.kopi:kopi-o-kosong",
        "dish.kopi:kopi-c-siu-dai",
        "dish.teh-tarik:teh-c-siu-dai",
        "dish.duck-rice:duck-noodles-dry",
        "dish.prawn-noodle-soup:prawn-noodles-dry",
        "dish.wanton-mee:wanton-mee-soup",
        "dish.fish-porridge:fish-porridge-sliced",
      ],
      hasScaledMapping: true,
    });
  });
});
