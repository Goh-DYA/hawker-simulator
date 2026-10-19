/**
 * Nutrition ratings for the nutrition importer.
 *
 * `addHealthRatings` rates each released serving on its own against fixed, guideline-based
 * amounts: a meal against one meal's share of HPB and WHO daily reference values and
 * against FSA per-100 g density bands, and a drink against Singapore's Nutri-Grade bands.
 * The condition ratings swap in the stricter references that clinical guidance sets for
 * each condition. `addIntentFits` still ranks profiles per customer nutrition intent
 * within their class, because an intent models a customer choosing among what is offered.
 */
// @ts-check
import { NUTRITION_INTENTS } from "./manifest.mjs";

/**
 * @import {
 *   HealthCondition,
 *   NutritionClass,
 *   NutritionIntentId,
 *   NutritionProfileStatus,
 *   NutritionValue,
 * } from "../../src/content/types"
 */

/**
 * Whether a lower or a higher amount of a nutrient is the better fit.
 *
 * @typedef {"lower" | "higher"} RatingDirection
 */

/**
 * The fields every rating pass reads from a profile.
 *
 * @typedef {object} ComparableProfile
 * @property {string} id
 * @property {NutritionProfileStatus} status
 * @property {NutritionClass} nutritionClass
 * @property {Readonly<Record<string, NutritionValue>>} nutrients
 */

/**
 * A profile that `addIntentFits` writes intent fits onto.
 *
 * @typedef {ComparableProfile & {
 *   intentFits: Partial<Record<NutritionIntentId, number>>;
 * }} IntentFitProfile
 */

/**
 * A profile that `addHealthRatings` rates from its serving and writes its overall and
 * condition ratings onto.
 *
 * @typedef {ComparableProfile & {
 *   serving?: { readonly amount: number };
 *   healthRating?: number;
 *   conditionRatings?: Record<string, number>;
 * }} RateableProfile
 */

/**
 * A ranking candidate: a profile and its comparable amount of one nutrient.
 *
 * @template {ComparableProfile} TProfile
 * @typedef {{ profile: TProfile; value: number }} RatingCandidate
 */

/**
 * Rounds to four decimal places, the precision of generated nutrient amounts and fits.
 *
 * @param {number} value - The value to round.
 * @returns {number} The rounded value.
 */
export const round = (value) => Math.round((value + Number.EPSILON) * 10_000) / 10_000;
/**
 * Rounds a one-to-five rating to one decimal place.
 *
 * @param {number} value - The unrounded rating.
 * @returns {number} The rounded rating.
 */
const roundRating = (value) => Math.round((value + Number.EPSILON) * 10) / 10;

/**
 * The condition ratings of a profile that is not released, and the placeholder every
 * profile starts with before `addHealthRatings` runs.
 *
 * @type {Readonly<Record<HealthCondition, number>>}
 */
export const NEUTRAL_CONDITION_RATINGS = {
  "high-cholesterol": 3,
  obesity: 3,
  diabetes: 3,
  hypertension: 3,
};

/**
 * Ranks entries by value and returns each entry's percentile fit, from 0 (worst) to 1
 * (best) in the given direction. Tied values share their average rank, and a sole entry
 * fits perfectly in either direction.
 *
 * @param {readonly { id: string; value: number }[]} entries - The comparable amounts.
 * @param {RatingDirection} direction - Whether lower or higher amounts fit better.
 * @returns {Map<string, number>} Each entry's fit keyed by id, rounded to four places.
 */
export const computeRelativeFits = (entries, direction) => {
  /** @type {Map<string, number>} */
  const fits = new Map();
  if (entries.length === 0) return fits;
  const sorted = [...entries].sort(
    (left, right) => left.value - right.value || left.id.localeCompare(right.id, "en"),
  );
  let index = 0;
  while (index < sorted.length) {
    const value = sorted[index].value;
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1].value === value) end += 1;
    const averageIndex = (index + end) / 2;
    const ascendingPercentile =
      sorted.length === 1 ? 1 : averageIndex / (sorted.length - 1);
    const fit =
      direction === "higher"
        ? ascendingPercentile
        : sorted.length === 1
          ? 1
          : 1 - ascendingPercentile;
    for (let candidateIndex = index; candidateIndex <= end; candidateIndex += 1) {
      fits.set(sorted[candidateIndex].id, round(fit));
    }
    index = end + 1;
  }
  return fits;
};

/**
 * Keeps the source-facing `trace` state intact while giving it the lowest
 * numeric amount for relative comparisons. Unavailable values stay excluded.
 *
 * @param {NutritionValue} nutrient - The source value of one nutrient.
 * @returns {number | undefined} The amount to rank by, or undefined to leave it unranked.
 */
export const nutritionValueForComparison = (nutrient) => {
  if (nutrient.status === "known") return nutrient.value;
  if (nutrient.status === "trace") return 0;
  return undefined;
};

/**
 * Writes each released profile's relative fit for every nutrition intent of its
 * class into `profile.intentFits`, mutating the profiles in place. Profiles
 * without a comparable value for an intent's metric get no entry for it.
 *
 * @param {IntentFitProfile[]} profiles - Profiles whose `intentFits` objects already exist.
 */
export const addIntentFits = (profiles) => {
  for (const intent of NUTRITION_INTENTS) {
    const candidates = profiles
      .filter(
        (profile) =>
          profile.status === "released" &&
          profile.nutritionClass === intent.nutritionClass,
      )
      .map((profile) => ({
        profile,
        value: nutritionValueForComparison(profile.nutrients[intent.metric]),
      }))
      .filter(
        /**
         * @param {{ profile: IntentFitProfile; value: number | undefined }} candidate
         * @returns {candidate is RatingCandidate<IntentFitProfile>}
         */
        (candidate) => candidate.value !== undefined,
      );
    if (candidates.length === 0) continue;

    const fits = computeRelativeFits(
      candidates.map((candidate) => ({
        id: candidate.profile.id,
        value: candidate.value,
      })),
      intent.direction,
    );
    for (const { profile } of candidates) {
      profile.intentFits[intent.id] = fits.get(profile.id);
    }
  }
};

/**
 * One main meal's share of the day's intake, for an eating pattern of three main meals.
 * A meal serving is compared with this share of each daily reference value.
 */
export const MEAL_SHARE = 1 / 3;

/**
 * General adult daily reference values for the limit nutrients.
 *
 * - Energy: 2,000 kcal, the midpoint of HPB's 1,800-2,200 kcal adult averages and the
 *   Codex reference.
 * - Sodium: under 2,000 mg (5 g of salt), WHO 2012 and HPB.
 * - Saturated plus trans fat: under 10% of energy (WHO 2023, HPB), 22 g on 2,000 kcal.
 * - Total fat: at most 35% of energy (HPB), 78 g on 2,000 kcal.
 * - Sugar: under 10% of energy as free sugar (WHO 2015, HPB), 50 g on 2,000 kcal. The
 *   source reports total sugar, so total sugar is held to the free-sugar limit.
 */
export const DAILY_REFERENCE = {
  energyKcal: 2_000,
  sodiumMg: 2_000,
  saturatedFatG: 22,
  totalFatG: 78,
  totalSugarG: 50,
};

/**
 * Daily reference values that the condition ratings use in place of the general ones.
 *
 * - Hypertension: sodium at most 1,500 mg, the AHA ideal and the DASH-Sodium lower arm.
 * - High cholesterol: saturated plus trans fat under 7% of energy (ESC/EAS 2019, AHA/ACC),
 *   15.6 g on 2,000 kcal.
 * - Diabetes: free sugar under 5% of energy (WHO 2015 conditional), 25 g on 2,000 kcal,
 *   and a per-meal carbohydrate budget of 45-60 g (three to four 15 g carbohydrate
 *   exchanges, as in HealthHub and ADA carbohydrate counting).
 */
export const CONDITION_REFERENCE = {
  hypertensionSodiumMg: 1_500,
  cholesterolSaturatedFatG: 15.6,
  diabetesSugarG: 25,
  diabetesMealCarbohydrateG: { lower: 45, upper: 60 },
};

/**
 * Per-100 g density bands: UK FSA front-of-pack "low" and "high" thresholds for fat,
 * saturated fat, total sugar and sodium (salt x 0.4), the WCRF/AICR energy-density
 * bands, and the EU "high fibre" claim threshold.
 */
export const DENSITY_BANDS = {
  energyKcal: { low: 125, high: 275 },
  saturatedFatG: { low: 1.5, high: 5 },
  totalFatG: { low: 3, high: 17.5 },
  totalSugarG: { low: 5, high: 22.5 },
  sodiumMg: { low: 120, high: 600 },
  highFibreG: 6,
};

/** Singapore Nutri-Grade (MOH 2022) per-100 ml grade boundaries for A, B and C drinks. */
export const NUTRI_GRADE_BANDS = {
  totalSugarG: [1, 5, 10],
  saturatedFatG: [0.7, 1.2, 2.8],
};

/**
 * Conservative stand-ins for unreported nutrients, so a missing value is neither dropped
 * nor read as zero.
 *
 * - A meal's missing sugar is a quarter of its carbohydrate, rounded up from the upper
 *   quartile (0.22) of the sugar share among meals that report sugar.
 * - A drink's missing sugar is all of its carbohydrate.
 * - A meal's missing sodium is 450 mg per 100 g, the upper quartile of meal sodium
 *   density. A drink's missing sodium carries no penalty.
 */
export const IMPUTATION = {
  mealSugarShareOfCarbohydrate: 0.25,
  drinkSugarShareOfCarbohydrate: 1,
  mealSodiumMgPer100G: 450,
};

/**
 * Stars each meal term removes at its full penalty, or adds back at its full credit.
 * In the overall rating the four limit nutrients HPB and WHO name carry equal weight, and
 * the worst of them counts once more, so one nutrient at a full day's limit costs two
 * stars rather than being averaged away by the others.
 */
export const MEAL_RATING_WEIGHTS = {
  overall: { limitNutrient: 1, worstLimitNutrient: 1, fibre: 0.5, protein: 0.25 },
  "high-cholesterol": { saturatedFat: 3, energy: 0.5, sugar: 0.5, fibre: 0.75 },
  obesity: { energy: 2.75, totalFat: 0.5, sugar: 0.75, fibre: 0.5, protein: 0.25 },
  diabetes: { carbohydrate: 2.5, sugar: 2, energy: 0.5, saturatedFat: 0.5, fibre: 0.75 },
  hypertension: { sodium: 4, saturatedFat: 0.5, fibre: 0.5 },
};

/**
 * The overall limit-nutrient penalty at which a meal's fibre and protein credits are gone:
 * every limit nutrient at its full penalty, the worst counted once more.
 */
const MAX_OVERALL_MEAL_PENALTY =
  4 * MEAL_RATING_WEIGHTS.overall.limitNutrient + MEAL_RATING_WEIGHTS.overall.worstLimitNutrient;

/**
 * How far past its full penalty a limit nutrient's overall penalty keeps rising: to 1.25 at
 * one and a half times the amount that takes the full penalty, so a serving with one and a
 * half days of sodium rates below one with a single day's.
 */
const OVERALL_EXCESS_PENALTY = { amountRatio: 1.5, penalty: 1.25 };

/**
 * An ascending list of `[x, y]` anchors for a piecewise-linear curve.
 *
 * @typedef {readonly (readonly [number, number])[]} CurveAnchors
 */

/**
 * Reads a piecewise-linear curve through ascending anchors, flat beyond the ends.
 *
 * @param {number} x - The input amount.
 * @param {CurveAnchors} anchors - The `[x, y]` anchors, in ascending `x`.
 * @returns {number} The interpolated value.
 */
export const read_curve = (x, anchors) => {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [x1, y1] = anchors[index];
    if (x <= x1) {
      const [x0, y0] = anchors[index - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return anchors[anchors.length - 1][1];
};

/**
 * The per-serving penalty curve of a limit nutrient: none up to half a meal's share of the
 * daily limit, half at one meal's share, 0.9 at two meal shares, and the full penalty when
 * one serving holds the whole day's limit.
 *
 * @param {number} daily_limit - The nutrient's daily reference value.
 * @returns {CurveAnchors} The anchors.
 */
const build_meal_share_anchors = (daily_limit) => [
  [(daily_limit * MEAL_SHARE) / 2, 0],
  [daily_limit * MEAL_SHARE, 0.5],
  [daily_limit * 2 * MEAL_SHARE, 0.9],
  [daily_limit, 1],
];

/**
 * The per-serving energy penalty: none up to HPB's 500 kcal lower-calorie meal, half at
 * one meal's share of the day and the full penalty at half the day.
 *
 * @type {CurveAnchors}
 */
const ENERGY_SERVING_ANCHORS = [
  [500, 0],
  [DAILY_REFERENCE.energyKcal * MEAL_SHARE, 0.5],
  [DAILY_REFERENCE.energyKcal / 2, 1],
];

/**
 * The per-100 g penalty curve of a density band: none at its low threshold and 0.75 at
 * its high one, so density alone never takes a nutrient's full penalty.
 *
 * @param {{ low: number; high: number }} band - The density band.
 * @returns {CurveAnchors} The anchors.
 */
const build_density_anchors = (band) => [
  [band.low, 0],
  [band.high, 0.75],
];

/**
 * The hypertension sodium penalty per serving: none at one meal's share of the 1,500 mg
 * ideal, 0.85 when one serving holds the WHO 2,000 mg day, and full at one and a half
 * days.
 *
 * @type {CurveAnchors}
 */
const HYPERTENSION_SODIUM_ANCHORS = [
  [CONDITION_REFERENCE.hypertensionSodiumMg * MEAL_SHARE, 0],
  [DAILY_REFERENCE.sodiumMg, 0.85],
  [DAILY_REFERENCE.sodiumMg * 1.5, 1],
];

/**
 * The diabetes carbohydrate penalty per serving: none within the lower meal budget, a
 * quarter at the upper budget and the full penalty at two meals' budget.
 *
 * @type {CurveAnchors}
 */
const DIABETES_CARBOHYDRATE_ANCHORS = [
  [CONDITION_REFERENCE.diabetesMealCarbohydrateG.lower, 0],
  [CONDITION_REFERENCE.diabetesMealCarbohydrateG.upper, 0.25],
  [75, 0.6],
  [90, 0.85],
  [CONDITION_REFERENCE.diabetesMealCarbohydrateG.upper * 2, 1],
];

/**
 * Resolved amounts per serving for one profile, after the missing-data rules.
 *
 * @typedef {object} ResolvedServing
 * @property {number} amount - The serving size in grams or millilitres.
 * @property {number} energyKcal
 * @property {number} proteinG - Zero when unreported, so it earns no credit.
 * @property {number} totalFatG
 * @property {number} saturatedFatG - Saturated plus trans fat.
 * @property {number} carbohydrateG
 * @property {number} totalSugarG
 * @property {number} dietaryFibreG - Zero when unreported, so it earns no credit.
 * @property {number | undefined} sodiumMg - Undefined only for a drink that reports none.
 */

/**
 * Reads a nutrient amount, counting `trace` as zero: the absolute thresholds start well
 * above a trace amount.
 *
 * @param {Readonly<Record<string, NutritionValue>>} nutrients - The profile's nutrients.
 * @param {string} metric - The metric to read.
 * @returns {number | undefined} The amount, or undefined when unavailable.
 */
const read_amount = (nutrients, metric) => {
  const nutrient = nutrients[metric];
  if (nutrient?.status === "known") return nutrient.value;
  if (nutrient?.status === "trace") return 0;
  return undefined;
};

/**
 * Resolves a profile's amounts per serving, applying the {@link IMPUTATION} rules. Trans
 * fat that is unreported counts as zero, since Singapore banned partially hydrogenated
 * oils in 2021.
 *
 * @param {RateableProfile} profile - A released profile.
 * @returns {ResolvedServing | undefined} The amounts, or undefined when energy, saturated
 *   fat or carbohydrate is unavailable, which leaves the profile unrated.
 */
const resolve_serving = (profile) => {
  const { nutrients } = profile;
  const amount = profile.serving?.amount;
  const energy = read_amount(nutrients, "energyKcal");
  const saturated_fat = read_amount(nutrients, "saturatedFatG");
  const carbohydrate = read_amount(nutrients, "carbohydrateG");
  if (
    amount === undefined ||
    amount <= 0 ||
    energy === undefined ||
    saturated_fat === undefined ||
    carbohydrate === undefined
  ) {
    return undefined;
  }
  const is_drink = profile.nutritionClass === "drink";
  const sugar_share = is_drink
    ? IMPUTATION.drinkSugarShareOfCarbohydrate
    : IMPUTATION.mealSugarShareOfCarbohydrate;
  const sugar = read_amount(nutrients, "totalSugarG") ?? carbohydrate * sugar_share;
  const sodium = read_amount(nutrients, "sodiumMg");
  return {
    amount,
    energyKcal: energy,
    proteinG: read_amount(nutrients, "proteinG") ?? 0,
    totalFatG: read_amount(nutrients, "totalFatG") ?? 0,
    saturatedFatG: saturated_fat + (read_amount(nutrients, "transFatG") ?? 0),
    carbohydrateG: carbohydrate,
    totalSugarG: Math.min(sugar, carbohydrate),
    dietaryFibreG: read_amount(nutrients, "dietaryFibreG") ?? 0,
    sodiumMg:
      sodium ?? (is_drink ? undefined : (IMPUTATION.mealSodiumMgPer100G * amount) / 100),
  };
};

/**
 * Scales a per-serving amount to its amount per 100 g or 100 ml.
 *
 * @param {number} amount - The amount per serving.
 * @param {ResolvedServing} serving - The serving.
 * @returns {number} The amount per 100 g or 100 ml.
 */
const per_100 = (amount, serving) => (amount * 100) / serving.amount;

/**
 * The penalty of a limit nutrient for a meal: the worse of its per-serving dose and its
 * per-100 g density.
 *
 * @param {number} amount - The amount per serving.
 * @param {CurveAnchors} serving_anchors - The per-serving curve.
 * @param {{ low: number; high: number }} band - The density band.
 * @param {ResolvedServing} serving - The serving.
 * @returns {number} The penalty, from 0 to 1.
 */
const compute_limit_penalty = (amount, serving_anchors, band, serving) =>
  Math.max(
    read_curve(amount, serving_anchors),
    read_curve(per_100(amount, serving), build_density_anchors(band)),
  );

/**
 * The penalty and credit fractions of a meal, each from 0 to 1. The credits are per
 * 100 g or per unit of energy, so a bigger serving never earns more credit.
 *
 * @param {ResolvedServing} serving - The meal serving.
 */
const compute_meal_fractions = (serving) => {
  const sodium = serving.sodiumMg ?? 0;
  const energy = serving.energyKcal;
  return {
    energy: compute_limit_penalty(
      energy,
      ENERGY_SERVING_ANCHORS,
      DENSITY_BANDS.energyKcal,
      serving,
    ),
    saturatedFat: compute_limit_penalty(
      serving.saturatedFatG,
      build_meal_share_anchors(DAILY_REFERENCE.saturatedFatG),
      DENSITY_BANDS.saturatedFatG,
      serving,
    ),
    cholesterolSaturatedFat: compute_limit_penalty(
      serving.saturatedFatG,
      build_meal_share_anchors(CONDITION_REFERENCE.cholesterolSaturatedFatG),
      DENSITY_BANDS.saturatedFatG,
      serving,
    ),
    totalFat: compute_limit_penalty(
      serving.totalFatG,
      build_meal_share_anchors(DAILY_REFERENCE.totalFatG),
      DENSITY_BANDS.totalFatG,
      serving,
    ),
    sodium: compute_limit_penalty(
      sodium,
      build_meal_share_anchors(DAILY_REFERENCE.sodiumMg),
      DENSITY_BANDS.sodiumMg,
      serving,
    ),
    hypertensionSodium: Math.max(
      read_curve(sodium, HYPERTENSION_SODIUM_ANCHORS),
      read_curve(per_100(sodium, serving), [
        [DENSITY_BANDS.sodiumMg.low, 0],
        [DENSITY_BANDS.sodiumMg.high, 0.6],
      ]),
    ),
    sugar: compute_limit_penalty(
      serving.totalSugarG,
      build_meal_share_anchors(DAILY_REFERENCE.totalSugarG),
      DENSITY_BANDS.totalSugarG,
      serving,
    ),
    diabetesSugar: compute_limit_penalty(
      serving.totalSugarG,
      build_meal_share_anchors(CONDITION_REFERENCE.diabetesSugarG),
      DENSITY_BANDS.totalSugarG,
      serving,
    ),
    diabetesCarbohydrate: Math.max(
      read_curve(serving.carbohydrateG, DIABETES_CARBOHYDRATE_ANCHORS),
      read_curve(per_100(serving.carbohydrateG, serving), [
        [25, 0],
        [50, 0.5],
      ]),
    ),
    // Fibre: EU "source of fibre" (3 g/100 g) earns half and "high fibre" (6 g/100 g) the
    // full credit, or by energy, 1.4 g/100 kcal (14 g per 1,000 kcal adequacy) half and
    // 3 g/100 kcal the full credit.
    fibre:
      energy <= 0
        ? 0
        : Math.max(
            read_curve(per_100(serving.dietaryFibreG, serving), [
              [0, 0],
              [DENSITY_BANDS.highFibreG / 2, 0.5],
              [DENSITY_BANDS.highFibreG, 1],
            ]),
            read_curve((serving.dietaryFibreG * 100) / energy, [
              [0, 0],
              [1.4, 0.5],
              [3, 1],
            ]),
          ),
    // Protein's share of energy: none at HPB's 10% lower bound, full at the EU "high
    // protein" 20%.
    protein:
      energy <= 0
        ? 0
        : read_curve((4 * serving.proteinG) / energy, [
            [0.1, 0],
            [0.2, 1],
          ]),
  };
};

/**
 * Extends a limit nutrient's penalty past the amount that takes its full penalty, for the
 * overall rating only (see {@link OVERALL_EXCESS_PENALTY}).
 *
 * @param {number} penalty - The nutrient's penalty, from 0 to 1.
 * @param {number} amount - The amount per serving.
 * @param {number} full_penalty_amount - The amount per serving that takes the full penalty.
 * @returns {number} The penalty, from 0 to 1.25.
 */
const extend_overall_penalty = (penalty, amount, full_penalty_amount) =>
  amount <= full_penalty_amount
    ? penalty
    : Math.max(
        penalty,
        read_curve(amount, [
          [full_penalty_amount, 1],
          [full_penalty_amount * OVERALL_EXCESS_PENALTY.amountRatio, OVERALL_EXCESS_PENALTY.penalty],
        ]),
      );

/**
 * Clamps a rating to one to five stars and rounds it to one decimal place.
 *
 * @param {number} value - The unclamped rating.
 * @returns {number} The rating.
 */
const finish_rating = (value) => roundRating(Math.min(5, Math.max(1, value)));

/**
 * Rates a meal serving overall and for each condition. Each rating starts at five stars
 * and loses its weighted penalties. Its credits shrink as the key penalties grow, so
 * fibre and protein cannot rescue a heavy serving.
 *
 * @param {ResolvedServing} serving - The meal serving.
 * @returns {{ overall: number; conditions: Record<HealthCondition, number> }} The ratings.
 */
const rate_meal = (serving) => {
  const f = compute_meal_fractions(serving);
  const w = MEAL_RATING_WEIGHTS;
  const limit_penalties = [
    extend_overall_penalty(f.energy, serving.energyKcal, DAILY_REFERENCE.energyKcal / 2),
    extend_overall_penalty(f.saturatedFat, serving.saturatedFatG, DAILY_REFERENCE.saturatedFatG),
    extend_overall_penalty(f.sodium, serving.sodiumMg ?? 0, DAILY_REFERENCE.sodiumMg),
    extend_overall_penalty(f.sugar, serving.totalSugarG, DAILY_REFERENCE.totalSugarG),
  ];
  const overall_penalty =
    w.overall.limitNutrient * limit_penalties.reduce((sum, penalty) => sum + penalty, 0) +
    w.overall.worstLimitNutrient * Math.max(...limit_penalties);
  const overall_credit =
    (w.overall.fibre * f.fibre + w.overall.protein * f.protein) *
    (1 - Math.min(1, overall_penalty / MAX_OVERALL_MEAL_PENALTY));
  const cholesterol = w["high-cholesterol"];
  const obesity = w.obesity;
  const diabetes = w.diabetes;
  const hypertension = w.hypertension;
  const diabetes_key = Math.max(f.diabetesCarbohydrate, f.diabetesSugar);
  return {
    overall: finish_rating(5 - overall_penalty + overall_credit),
    conditions: {
      "high-cholesterol": finish_rating(
        5 -
          cholesterol.saturatedFat * f.cholesterolSaturatedFat -
          cholesterol.energy * f.energy -
          cholesterol.sugar * f.sugar +
          cholesterol.fibre * f.fibre * (1 - f.cholesterolSaturatedFat),
      ),
      obesity: finish_rating(
        5 -
          obesity.energy * f.energy -
          obesity.totalFat * f.totalFat -
          obesity.sugar * f.sugar +
          (obesity.fibre * f.fibre + obesity.protein * f.protein) * (1 - f.energy),
      ),
      diabetes: finish_rating(
        5 -
          diabetes.carbohydrate * f.diabetesCarbohydrate -
          diabetes.sugar * f.diabetesSugar -
          diabetes.energy * f.energy -
          diabetes.saturatedFat * f.saturatedFat +
          diabetes.fibre * f.fibre * (1 - diabetes_key),
      ),
      hypertension: finish_rating(
        5 -
          hypertension.sodium * f.hypertensionSodium -
          hypertension.saturatedFat * f.saturatedFat +
          hypertension.fibre * f.fibre * (1 - f.hypertensionSodium),
      ),
    },
  };
};

/**
 * Rates a drink serving overall and for each condition. A drink's grade follows
 * Nutri-Grade: the worse of its sugar and saturated fat per 100 ml, mapped to 0, 1/3 and
 * 2/3 at the A, B and C boundaries and rising to 1 past the D boundary. Per-serving sugar,
 * energy and sodium add their dose on top.
 *
 * @param {ResolvedServing} serving - The drink serving, in millilitres.
 * @returns {{ overall: number; conditions: Record<HealthCondition, number> }} The ratings.
 */
const rate_drink = (serving) => {
  const [sugar_a, sugar_b, sugar_c] = NUTRI_GRADE_BANDS.totalSugarG;
  const [fat_a, fat_b, fat_c] = NUTRI_GRADE_BANDS.saturatedFatG;
  const sugar_grade = read_curve(per_100(serving.totalSugarG, serving), [
    [sugar_a, 0],
    [sugar_b, 1 / 3],
    [sugar_c, 2 / 3],
    [sugar_c * 1.5, 1],
  ]);
  const fat_grade = read_curve(per_100(serving.saturatedFatG, serving), [
    [fat_a, 0],
    [fat_b, 1 / 3],
    [fat_c, 2 / 3],
    [fat_c * 1.8, 1],
  ]);
  const grade = Math.max(sugar_grade, fat_grade);
  const sugar_dose = read_curve(
    serving.totalSugarG,
    build_meal_share_anchors(DAILY_REFERENCE.totalSugarG),
  );
  // A drink holding a tenth of the day's energy takes the full energy penalty.
  const energy_dose = read_curve(serving.energyKcal, [
    [20, 0],
    [DAILY_REFERENCE.energyKcal * 0.1, 1],
  ]);
  const diabetes_sugar_dose = read_curve(serving.totalSugarG, [
    [5, 0],
    [CONDITION_REFERENCE.diabetesSugarG, 1],
  ]);
  const cholesterol_fat_dose = read_curve(
    serving.saturatedFatG,
    build_meal_share_anchors(CONDITION_REFERENCE.cholesterolSaturatedFatG),
  );
  const sodium_dose =
    serving.sodiumMg === undefined
      ? 0
      : read_curve(
          serving.sodiumMg,
          build_meal_share_anchors(CONDITION_REFERENCE.hypertensionSodiumMg),
        );
  return {
    overall: finish_rating(5 - 3.5 * grade - 0.5 * sugar_dose),
    conditions: {
      "high-cholesterol": finish_rating(
        5 - 2.5 * Math.max(fat_grade, cholesterol_fat_dose) - sugar_grade - 0.25 * energy_dose,
      ),
      obesity: finish_rating(5 - 2 * grade - 2 * energy_dose),
      diabetes: finish_rating(5 - 2.5 * sugar_grade - 1.5 * diabetes_sugar_dose),
      hypertension: finish_rating(
        5 - 3 * sodium_dose - 0.75 * sugar_grade - 0.25 * sugar_dose,
      ),
    },
  };
};

/**
 * Writes the overall health rating and every condition rating onto each profile, mutating
 * the profiles in place. Each released serving is rated on its own against fixed
 * guideline amounts (see {@link rate_meal} and {@link rate_drink}), so a rating never
 * depends on the rest of the catalogue. A profile that is not released, or that lacks
 * energy, saturated fat or carbohydrate, gets the neutral rating of 3.
 *
 * @param {RateableProfile[]} profiles - The profiles to rate.
 */
export const addHealthRatings = (profiles) => {
  for (const profile of profiles) {
    const serving =
      profile.status === "released" ? resolve_serving(profile) : undefined;
    if (!serving) {
      profile.healthRating = 3;
      profile.conditionRatings = { ...NEUTRAL_CONDITION_RATINGS };
      continue;
    }
    const ratings =
      profile.nutritionClass === "drink" ? rate_drink(serving) : rate_meal(serving);
    profile.healthRating = ratings.overall;
    profile.conditionRatings = ratings.conditions;
  }
};
