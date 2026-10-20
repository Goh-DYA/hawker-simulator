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
import { NUTRITION_INTENTS, SNACK_RATED_DISH_IDS } from "./manifest.mjs";

/**
 * @import {
 *   HealthCondition,
 *   LimitNutrient,
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
 *   dishId?: string;
 *   serving?: { readonly amount: number };
 *   ratingInputs?: {
 *     readonly edibleAmount: number;
 *     readonly standIns?: Partial<Readonly<Record<string, number>>>;
 *   };
 *   healthRating?: number;
 *   conditionRatings?: Record<string, number>;
 *   healthParts?: HealthParts;
 * }} RateableProfile
 */

/**
 * The parts a meal's overall Health rating is built from, for the card that explains it
 * (ADR 0009). Each part comes from the same unrounded values as the rating, so the card
 * never explains a number the rating did not use.
 *
 * @typedef {object} HealthParts
 * @property {number} nutrients - The nutrient score, capped at five for display, to 0.1.
 * @property {number} conditions - The condition score, to 0.1.
 * @property {number} excess - The stars lost past a full day's amount, to 0.1.
 * @property {LimitNutrient} [excessNutrient] - The limit nutrient holding the largest share
 *   of a day, when one serving holds more than a full day of it.
 * @property {number} [excessDayShare] - That share of a full day, to 0.01, when above 1.
 * @property {Array<{ nutrient: LimitNutrient; per100g: number }>} [denseNutrients] - The
 *   limit nutrients whose per-100 g density, not the serving, set their penalty, with the
 *   resolved amount per 100 g of the edible part.
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
 * How a snack's energy and sugar allowance compares with a meal's: HPB's 200 kcal snack
 * ceiling over its 500 kcal lower-calorie meal, so a snack is held to 0.4 of a meal's share
 * (2/15 of the day). Saturated fat and sodium keep the meal curves.
 */
export const SNACK_SHARE_OF_MEAL = 0.4;

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
 * - Obesity: 1,500 kcal, the AHA/ACC/TOS 2013 energy-reduced intake (1,200-1,500 kcal for
 *   women, 1,500-1,800 kcal for men) and HPB's 500 kcal daily deficit from 2,000 kcal.
 * - Hypertension: sodium at most 1,500 mg, the AHA ideal and the DASH-Sodium lower arm.
 * - High cholesterol: saturated plus trans fat under 7% of energy (ESC/EAS 2019, AHA/ACC),
 *   15.6 g on 2,000 kcal.
 * - Diabetes: free sugar under 5% of energy (WHO 2015 conditional), 25 g on 2,000 kcal,
 *   and a per-meal carbohydrate budget of 45-60 g (three to four 15 g carbohydrate
 *   exchanges, as in HealthHub and ADA carbohydrate counting).
 */
export const CONDITION_REFERENCE = {
  obesityEnergyKcal: 1_500,
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
 * In the overall rating's nutrient score the four limit nutrients HPB and WHO name carry
 * equal weight and add up, as in the additive FSA/Ofcom lineage that Nutri-Score and the
 * Health Star Rating build on; no nutrient counts twice (ADR 0009, which reverses ADR
 * 0007's worst-nutrient double count). A single severe excess is carried instead by
 * {@link OVERALL_DAY_EXCESS_STARS_PER_DAY}.
 */
export const MEAL_RATING_WEIGHTS = {
  overall: { limitNutrient: 1, fibre: 0.5, protein: 0.25 },
  "high-cholesterol": { saturatedFat: 3, energy: 0.5, sugar: 0.5, fibre: 0.75 },
  obesity: { energy: 2.75, totalFat: 0.5, sugar: 0.75, fibre: 0.5, protein: 0.25 },
  diabetes: {
    carbohydrate: 2.5,
    carbohydrateQuality: 1,
    sugar: 2,
    energy: 0.5,
    saturatedFat: 0.5,
    fibre: 0.75,
  },
  hypertension: { sodium: 4, saturatedFat: 0.5, fibre: 0.5 },
};

/**
 * The summed limit-nutrient penalty at which a meal's fibre and protein credits are gone:
 * every limit nutrient at its full penalty, so credits cannot rescue a heavy serving.
 */
const MAX_OVERALL_MEAL_PENALTY = 4 * MEAL_RATING_WEIGHTS.overall.limitNutrient;

/**
 * How the condition score weighs the four unrounded condition ratings: two thirds their
 * mean and one third the lowest, so the lowest condition counts as much as the other three
 * together. Equal per condition, not weighted by prevalence, so no demographic enters. A
 * design choice tested against the variant-family, price and ordering checks (ADR 0009).
 */
export const CONDITION_SCORE_WEIGHTS = { mean: 2 / 3, lowest: 1 / 3 };

/**
 * A meal's overall rating blends its nutrient score and its condition score equally. Equal
 * weighting is a design choice (the OECD/JRC composite-indicator handbook, 2008, p. 31,
 * warns it can disguise the absence of an empirical basis); it is the lowest nutrient share
 * that keeps every variant family's default tunable (ADR 0009).
 */
export const OVERALL_BLEND = { nutrientScore: 0.5, conditionScore: 0.5 };

/**
 * Stars a meal loses for each further day's amount once one serving holds more than a full
 * day of energy, saturated plus trans fat, sodium or sugar ({@link DAILY_REFERENCE}), with no
 * cap. Past a full day the rest of the day can no longer bring intake within the limit. The
 * linear shape follows the sodium-blood pressure dose-response (Filippini et al. 2021); the
 * slope of one star a day is a design choice that continues the model's within-day rate.
 */
export const OVERALL_DAY_EXCESS_STARS_PER_DAY = 1;

/**
 * When the card lists a limit nutrient as rated per 100 g: its density penalty is at least
 * a third of the density curve's 0.75 maximum, and at least 0.1 above its per-serving
 * penalty, so the density visibly set that penalty. Design choices (ADR 0009).
 */
export const DENSITY_LINE = { minPenalty: 0.25, minLeadOverServing: 0.1 };

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
const build_meal_share_anchors = (daily_limit, share = MEAL_SHARE) => [
  [(daily_limit * share) / 2, 0],
  [daily_limit * share, 0.5],
  [daily_limit * 2 * share, 0.9],
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
 * The snack energy penalty: the meal curve scaled by {@link SNACK_SHARE_OF_MEAL}, so none up
 * to HPB's 200 kcal snack, half at 267 kcal and the full penalty at 400 kcal.
 *
 * @type {CurveAnchors}
 */
const SNACK_ENERGY_ANCHORS = ENERGY_SERVING_ANCHORS.map(([x, y]) => [x * SNACK_SHARE_OF_MEAL, y]);

/**
 * The obesity energy penalty for a meal: the meal curve on the 1,500 kcal energy-reduced
 * day, so none up to 375 kcal, half at 500 kcal (a third of the day) and full at 750 kcal.
 *
 * @type {CurveAnchors}
 */
const OBESITY_ENERGY_ANCHORS = ENERGY_SERVING_ANCHORS.map(([x, y]) => [
  (x * CONDITION_REFERENCE.obesityEnergyKcal) / DAILY_REFERENCE.energyKcal,
  y,
]);

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
 * ideal, 0.4 at two meal shares, 0.7 when one serving holds the whole 1,500 mg day, 0.85 at
 * the WHO 2,000 mg day, and full at one and a half WHO days.
 *
 * @type {CurveAnchors}
 */
const HYPERTENSION_SODIUM_ANCHORS = [
  [CONDITION_REFERENCE.hypertensionSodiumMg * MEAL_SHARE, 0],
  [CONDITION_REFERENCE.hypertensionSodiumMg * 2 * MEAL_SHARE, 0.4],
  [CONDITION_REFERENCE.hypertensionSodiumMg, 0.7],
  [DAILY_REFERENCE.sodiumMg, 0.85],
  [DAILY_REFERENCE.sodiumMg * 1.5, 1],
];

/**
 * The refined-carbohydrate fraction: none at the AHA 10:1 carbohydrate-to-fibre whole-grain
 * ratio, full at 20:1 (white bread), scaled by the carbohydrate amount from one 15 g
 * exchange (none) to the 45 g lower meal budget (full).
 */
const CARBOHYDRATE_QUALITY = {
  ratioAnchors: /** @type {CurveAnchors} */ ([
    [10, 0],
    [20, 1],
  ]),
  amountAnchors: /** @type {CurveAnchors} */ ([
    [15, 0],
    [CONDITION_REFERENCE.diabetesMealCarbohydrateG.lower, 1],
  ]),
  // Fibre that is unavailable (unreported or withheld as implausible) stands in, for the
  // ratio only, at the lower quartile of meal fibre density (g per 100 g edible); it still
  // earns no fibre credit. A reported trace counts as zero.
  unavailableFibreGPer100G: 0.81,
};

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
 * @property {number} densityAmount - The edible part of the serving, which every per-100 g
 *   density divides by.
 * @property {number} qualityFibreG - Fibre for the carbohydrate-quality ratio only: the
 *   reported fibre, or a stand-in when it is unavailable.
 * @property {boolean} isSnack - Whether the serving is rated as a snack (see
 *   `SNACK_RATED_DISH_IDS` in the manifest).
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
  const stand_ins = profile.ratingInputs?.standIns ?? {};
  const saturated_fat = read_amount(nutrients, "saturatedFatG") ?? stand_ins.saturatedFatG;
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
  const density_amount = profile.ratingInputs?.edibleAmount ?? amount;
  const is_drink = profile.nutritionClass === "drink";
  const sugar_share = is_drink
    ? IMPUTATION.drinkSugarShareOfCarbohydrate
    : IMPUTATION.mealSugarShareOfCarbohydrate;
  const sugar =
    read_amount(nutrients, "totalSugarG") ??
    stand_ins.totalSugarG ??
    carbohydrate * sugar_share;
  const sodium = read_amount(nutrients, "sodiumMg") ?? stand_ins.sodiumMg;
  return {
    amount,
    densityAmount: density_amount,
    energyKcal: energy,
    proteinG: read_amount(nutrients, "proteinG") ?? 0,
    totalFatG: read_amount(nutrients, "totalFatG") ?? stand_ins.totalFatG ?? 0,
    saturatedFatG: saturated_fat + (read_amount(nutrients, "transFatG") ?? 0),
    carbohydrateG: carbohydrate,
    totalSugarG: Math.min(sugar, carbohydrate),
    dietaryFibreG: read_amount(nutrients, "dietaryFibreG") ?? 0,
    qualityFibreG:
      read_amount(nutrients, "dietaryFibreG") ??
      (CARBOHYDRATE_QUALITY.unavailableFibreGPer100G * density_amount) / 100,
    sodiumMg:
      sodium ?? (is_drink ? undefined : (IMPUTATION.mealSodiumMgPer100G * amount) / 100),
    isSnack:
      !is_drink && profile.dishId !== undefined && SNACK_RATED_DISH_IDS.has(profile.dishId),
  };
};

/**
 * Scales a per-serving amount to its amount per 100 g or 100 ml.
 *
 * @param {number} amount - The amount per serving.
 * @param {ResolvedServing} serving - The serving.
 * @returns {number} The amount per 100 g or 100 ml.
 */
const per_100 = (amount, serving) => (amount * 100) / serving.densityAmount;

/**
 * The two readings of a limit nutrient for a meal: its per-serving dose and its per-100 g
 * density, each from 0 to 1, with the amount per 100 g that the density reading used.
 *
 * @typedef {{ serving: number; density: number; per100g: number }} LimitParts
 */

/**
 * Reads a limit nutrient's per-serving and per-100 g density penalties.
 *
 * @param {number} amount - The amount per serving.
 * @param {CurveAnchors} serving_anchors - The per-serving curve.
 * @param {{ low: number; high: number }} band - The density band.
 * @param {ResolvedServing} serving - The serving.
 * @returns {LimitParts} The two penalties and the amount per 100 g.
 */
const compute_limit_parts = (amount, serving_anchors, band, serving) => {
  const per100g = per_100(amount, serving);
  return {
    serving: read_curve(amount, serving_anchors),
    density: read_curve(per100g, build_density_anchors(band)),
    per100g,
  };
};

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
const compute_limit_penalty = (amount, serving_anchors, band, serving) => {
  const parts = compute_limit_parts(amount, serving_anchors, band, serving);
  return Math.max(parts.serving, parts.density);
};

/**
 * The penalty and credit fractions of a meal, each from 0 to 1. The credits are per
 * 100 g or per unit of energy, so a bigger serving never earns more credit.
 *
 * @param {ResolvedServing} serving - The meal serving.
 */
const compute_meal_fractions = (serving) => {
  const sodium = serving.sodiumMg ?? 0;
  const energy = serving.energyKcal;
  const sugar_share = serving.isSnack ? MEAL_SHARE * SNACK_SHARE_OF_MEAL : MEAL_SHARE;
  const carbohydrate_to_fibre =
    serving.qualityFibreG > 0 ? serving.carbohydrateG / serving.qualityFibreG : Infinity;
  /** @type {Record<LimitNutrient, LimitParts>} */
  const limit_parts = {
    energy: compute_limit_parts(
      energy,
      serving.isSnack ? SNACK_ENERGY_ANCHORS : ENERGY_SERVING_ANCHORS,
      DENSITY_BANDS.energyKcal,
      serving,
    ),
    "saturated-fat": compute_limit_parts(
      serving.saturatedFatG,
      build_meal_share_anchors(DAILY_REFERENCE.saturatedFatG),
      DENSITY_BANDS.saturatedFatG,
      serving,
    ),
    sodium: compute_limit_parts(
      sodium,
      build_meal_share_anchors(DAILY_REFERENCE.sodiumMg),
      DENSITY_BANDS.sodiumMg,
      serving,
    ),
    sugar: compute_limit_parts(
      serving.totalSugarG,
      build_meal_share_anchors(DAILY_REFERENCE.totalSugarG, sugar_share),
      DENSITY_BANDS.totalSugarG,
      serving,
    ),
  };
  const worse = (/** @type {LimitParts} */ parts) => Math.max(parts.serving, parts.density);
  return {
    limitParts: limit_parts,
    energy: worse(limit_parts.energy),
    obesityEnergy: compute_limit_penalty(
      energy,
      serving.isSnack ? SNACK_ENERGY_ANCHORS : OBESITY_ENERGY_ANCHORS,
      DENSITY_BANDS.energyKcal,
      serving,
    ),
    carbohydrateQuality:
      read_curve(carbohydrate_to_fibre, CARBOHYDRATE_QUALITY.ratioAnchors) *
      read_curve(serving.carbohydrateG, CARBOHYDRATE_QUALITY.amountAnchors),
    saturatedFat: worse(limit_parts["saturated-fat"]),
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
    sodium: worse(limit_parts.sodium),
    hypertensionSodium: Math.max(
      read_curve(sodium, HYPERTENSION_SODIUM_ANCHORS),
      read_curve(per_100(sodium, serving), [
        [DENSITY_BANDS.sodiumMg.low, 0],
        [DENSITY_BANDS.sodiumMg.high, 0.6],
      ]),
    ),
    sugar: worse(limit_parts.sugar),
    diabetesSugar: compute_limit_penalty(
      serving.totalSugarG,
      build_meal_share_anchors(CONDITION_REFERENCE.diabetesSugarG, sugar_share),
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
 * Clamps a rating to one to five stars without rounding it.
 *
 * @param {number} value - The unclamped rating.
 * @returns {number} The clamped rating.
 */
const clamp_rating = (value) => Math.min(5, Math.max(1, value));

/**
 * A meal's nutrient score: five stars less its four limit-nutrient penalties (each up to
 * 1.25 past its full amount), plus fibre and protein credits that shrink as the summed
 * penalty grows. Floored at one star but not capped at five, so credits still separate
 * lean servings inside the blend.
 *
 * @param {ResolvedServing} serving - The meal serving.
 * @param {ReturnType<typeof compute_meal_fractions>} f - The serving's fractions.
 * @returns {number} The unrounded nutrient score, at least 1.
 */
const compute_nutrient_score = (serving, f) => {
  const w = MEAL_RATING_WEIGHTS.overall;
  const limit_penalties = [
    extend_overall_penalty(
      f.energy,
      serving.energyKcal,
      (DAILY_REFERENCE.energyKcal / 2) * (serving.isSnack ? SNACK_SHARE_OF_MEAL : 1),
    ),
    extend_overall_penalty(f.saturatedFat, serving.saturatedFatG, DAILY_REFERENCE.saturatedFatG),
    extend_overall_penalty(f.sodium, serving.sodiumMg ?? 0, DAILY_REFERENCE.sodiumMg),
    extend_overall_penalty(f.sugar, serving.totalSugarG, DAILY_REFERENCE.totalSugarG),
  ];
  const penalty_sum = w.limitNutrient * limit_penalties.reduce((sum, penalty) => sum + penalty, 0);
  const credit =
    (w.fibre * f.fibre + w.protein * f.protein) *
    (1 - Math.min(1, penalty_sum / MAX_OVERALL_MEAL_PENALTY));
  return Math.max(1, 5 - penalty_sum + credit);
};

/**
 * A meal's condition score from its four unrounded condition ratings (see
 * {@link CONDITION_SCORE_WEIGHTS}).
 *
 * @param {readonly number[]} condition_ratings - The four clamped, unrounded ratings.
 * @returns {number} The condition score.
 */
const compute_condition_score = (condition_ratings) =>
  CONDITION_SCORE_WEIGHTS.mean *
    (condition_ratings.reduce((sum, rating) => sum + rating, 0) / condition_ratings.length) +
  CONDITION_SCORE_WEIGHTS.lowest * Math.min(...condition_ratings);

/**
 * The largest share of a full day's amount that one serving holds of energy, saturated
 * plus trans fat, sodium or sugar, on the resolved (imputed where unreported) amounts, and
 * the nutrient that holds it (the first in card order on a tie). Meals and snack-rated
 * desserts are both measured against the whole day.
 *
 * @param {ResolvedServing} serving - The meal serving.
 * @returns {{ share: number; nutrient: LimitNutrient }} The day share, above 1 when one
 *   serving breaches a full day, and its nutrient.
 */
const compute_day_share = (serving) => {
  /** @type {Array<[LimitNutrient, number]>} */
  const shares = [
    ["energy", serving.energyKcal / DAILY_REFERENCE.energyKcal],
    ["saturated-fat", serving.saturatedFatG / DAILY_REFERENCE.saturatedFatG],
    ["sodium", (serving.sodiumMg ?? 0) / DAILY_REFERENCE.sodiumMg],
    ["sugar", serving.totalSugarG / DAILY_REFERENCE.totalSugarG],
  ];
  const [nutrient, share] = shares.reduce((largest, entry) =>
    entry[1] > largest[1] ? entry : largest,
  );
  return { share, nutrient };
};

/**
 * Rounds an amount per 100 g for the card: whole kilocalories and milligrams, grams to 0.1.
 *
 * @param {LimitNutrient} nutrient - The limit nutrient.
 * @param {number} per100g - The amount per 100 g.
 * @returns {number} The rounded amount.
 */
const round_per_100g = (nutrient, per100g) =>
  nutrient === "energy" || nutrient === "sodium"
    ? Math.round(per100g + Number.EPSILON)
    : roundRating(per100g);

/**
 * The parts a meal's overall rating is built from, for the card (see {@link HealthParts}).
 *
 * @param {ReturnType<typeof compute_meal_fractions>} f - The serving's fractions.
 * @param {number} nutrient_score - The unrounded nutrient score.
 * @param {number} condition_score - The unrounded condition score.
 * @param {{ share: number; nutrient: LimitNutrient }} day_share - The serving's day share.
 * @param {number} day_excess - The unrounded stars lost past a full day.
 * @returns {HealthParts} The parts.
 */
const build_health_parts = (f, nutrient_score, condition_score, day_share, day_excess) => {
  /** @type {HealthParts} */
  const parts = {
    nutrients: roundRating(Math.min(5, nutrient_score)),
    conditions: roundRating(condition_score),
    excess: roundRating(day_excess),
  };
  if (day_share.share > 1) {
    parts.excessNutrient = day_share.nutrient;
    parts.excessDayShare = Math.round((day_share.share + Number.EPSILON) * 100) / 100;
  }
  const dense = /** @type {LimitNutrient[]} */ (Object.keys(f.limitParts))
    .filter((nutrient) => {
      const reading = f.limitParts[nutrient];
      return (
        reading.density >= DENSITY_LINE.minPenalty &&
        reading.density - reading.serving >= DENSITY_LINE.minLeadOverServing
      );
    })
    .map((nutrient) => ({
      nutrient,
      per100g: round_per_100g(nutrient, f.limitParts[nutrient].per100g),
    }));
  if (dense.length > 0) parts.denseNutrients = dense;
  return parts;
};

/**
 * Rates a meal serving overall and for each condition. Each condition rating starts at five
 * stars and loses its weighted penalties; its credits shrink as the key penalties grow, so
 * fibre and protein cannot rescue a heavy serving. The overall rating is half the nutrient
 * score and half the condition score, less one star per further day's amount past a full
 * day, rounded once.
 *
 * @param {ResolvedServing} serving - The meal serving.
 * @returns {{
 *   overall: number;
 *   conditions: Record<HealthCondition, number>;
 *   parts: HealthParts;
 * }} The ratings and the parts of the overall rating.
 */
const rate_meal = (serving) => {
  const f = compute_meal_fractions(serving);
  const w = MEAL_RATING_WEIGHTS;
  const cholesterol = w["high-cholesterol"];
  const obesity = w.obesity;
  const diabetes = w.diabetes;
  const hypertension = w.hypertension;
  const diabetes_key = Math.max(f.diabetesCarbohydrate, f.diabetesSugar);
  /** @type {Record<HealthCondition, number>} */
  const raw_conditions = {
    "high-cholesterol": clamp_rating(
      5 -
        cholesterol.saturatedFat * f.cholesterolSaturatedFat -
        cholesterol.energy * f.energy -
        cholesterol.sugar * f.sugar +
        cholesterol.fibre * f.fibre *
          (1 - Math.max(f.cholesterolSaturatedFat, f.energy, f.sugar)),
    ),
    obesity: clamp_rating(
      5 -
        obesity.energy * f.obesityEnergy -
        obesity.totalFat * f.totalFat -
        obesity.sugar * f.sugar +
        (obesity.fibre * f.fibre + obesity.protein * f.protein) *
          (1 - Math.max(f.obesityEnergy, f.totalFat, f.sugar)),
    ),
    diabetes: clamp_rating(
      5 -
        diabetes.carbohydrate * f.diabetesCarbohydrate -
        diabetes.carbohydrateQuality *
          f.carbohydrateQuality *
          (1 - f.diabetesCarbohydrate) -
        diabetes.sugar * f.diabetesSugar -
        diabetes.energy * f.energy -
        diabetes.saturatedFat * f.saturatedFat +
        diabetes.fibre * f.fibre *
          (1 - Math.max(diabetes_key, f.energy, f.saturatedFat)),
    ),
    hypertension: clamp_rating(
      5 -
        hypertension.sodium * f.hypertensionSodium -
        hypertension.saturatedFat * f.saturatedFat +
        hypertension.fibre * f.fibre *
          (1 - Math.max(f.hypertensionSodium, f.saturatedFat)),
    ),
  };
  const nutrient_score = compute_nutrient_score(serving, f);
  const condition_score = compute_condition_score(Object.values(raw_conditions));
  const day_share = compute_day_share(serving);
  const day_excess = OVERALL_DAY_EXCESS_STARS_PER_DAY * Math.max(0, day_share.share - 1);
  return {
    overall: finish_rating(
      OVERALL_BLEND.nutrientScore * nutrient_score +
        OVERALL_BLEND.conditionScore * condition_score -
        day_excess,
    ),
    conditions: {
      "high-cholesterol": finish_rating(raw_conditions["high-cholesterol"]),
      obesity: finish_rating(raw_conditions.obesity),
      diabetes: finish_rating(raw_conditions.diabetes),
      hypertension: finish_rating(raw_conditions.hypertension),
    },
    parts: build_health_parts(f, nutrient_score, condition_score, day_share, day_excess),
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
 * Writes the overall health rating and every condition rating onto each profile, and onto
 * each rated meal the parts its overall rating is built from, mutating the profiles in
 * place. Each released serving is rated on its own against fixed guideline amounts (see
 * {@link rate_meal} and {@link rate_drink}), so a rating never depends on the rest of the
 * catalogue. A profile that is not released, or that lacks energy, saturated fat or
 * carbohydrate, gets the neutral rating of 3.
 *
 * @param {RateableProfile[]} profiles - The profiles to rate.
 */
export const addHealthRatings = (profiles) => {
  for (const profile of profiles) {
    const serving =
      profile.status === "released" ? resolve_serving(profile) : undefined;
    delete profile.healthParts;
    if (!serving) {
      profile.healthRating = 3;
      profile.conditionRatings = { ...NEUTRAL_CONDITION_RATINGS };
      continue;
    }
    if (profile.nutritionClass === "drink") {
      const ratings = rate_drink(serving);
      profile.healthRating = ratings.overall;
      profile.conditionRatings = ratings.conditions;
      continue;
    }
    const ratings = rate_meal(serving);
    profile.healthRating = ratings.overall;
    profile.conditionRatings = ratings.conditions;
    profile.healthParts = ratings.parts;
  }
};
