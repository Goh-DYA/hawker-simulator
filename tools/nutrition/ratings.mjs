/**
 * Relative nutrition ratings for the nutrition importer.
 *
 * Every rating compares a serving only with the other released servings of the same
 * nutrition class (meal or drink). `addIntentFits` ranks profiles per customer nutrition
 * intent, and `addHealthRatings` turns weighted per-nutrient ranks into the one-to-five
 * overall and condition ratings.
 */
// @ts-check
import { NUTRITION_INTENTS } from "./manifest.mjs";

/**
 * @import {
 *   HealthCondition,
 *   NutritionClass,
 *   NutritionIntentId,
 *   NutritionMetric,
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
 * One weighted nutrient in a rating scheme: the metric, its better direction, and its
 * weight in the scheme.
 *
 * @typedef {readonly [NutritionMetric, RatingDirection, number]} RatingTerm
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
 * A profile that `addHealthRatings` writes its overall and condition ratings onto.
 *
 * @typedef {ComparableProfile & {
 *   healthRating?: number;
 *   conditionRatings?: Record<string, number>;
 * }} HealthRatedProfile
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
 * Weighted nutrients behind the overall health rating and each condition rating. A metric
 * must use the same direction in every scheme, which `addHealthRatings` enforces.
 *
 * @type {Readonly<Record<"overall" | HealthCondition, readonly RatingTerm[]>>}
 */
export const HEALTH_RATING_SCHEMES = {
  overall: [
    ["energyKcal", "lower", 0.16],
    ["proteinG", "higher", 0.12],
    ["totalFatG", "lower", 0.08],
    ["saturatedFatG", "lower", 0.1],
    ["transFatG", "lower", 0.08],
    ["totalSugarG", "lower", 0.12],
    ["dietaryFibreG", "higher", 0.14],
    ["sodiumMg", "lower", 0.12],
    ["calciumMg", "higher", 0.04],
    ["ironMg", "higher", 0.04],
  ],
  "high-cholesterol": [
    ["saturatedFatG", "lower", 0.35],
    ["transFatG", "lower", 0.2],
    ["totalFatG", "lower", 0.2],
    ["dietaryFibreG", "higher", 0.15],
    ["energyKcal", "lower", 0.1],
  ],
  obesity: [
    ["energyKcal", "lower", 0.35],
    ["totalFatG", "lower", 0.18],
    ["saturatedFatG", "lower", 0.07],
    ["totalSugarG", "lower", 0.15],
    ["dietaryFibreG", "higher", 0.15],
    ["proteinG", "higher", 0.1],
  ],
  diabetes: [
    ["carbohydrateG", "lower", 0.3],
    ["totalSugarG", "lower", 0.3],
    ["dietaryFibreG", "higher", 0.2],
    ["energyKcal", "lower", 0.12],
    ["proteinG", "higher", 0.08],
  ],
  hypertension: [
    ["sodiumMg", "lower", 0.65],
    ["energyKcal", "lower", 0.1],
    ["saturatedFatG", "lower", 0.1],
    ["dietaryFibreG", "higher", 0.1],
    ["proteinG", "higher", 0.05],
  ],
};

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
 * Writes the overall health rating and every condition rating onto each profile, mutating
 * the profiles in place. Released profiles are rated from one to five by the weighted
 * average of their per-nutrient fits within their nutrition class; other profiles get the
 * neutral rating of 3.
 *
 * @param {HealthRatedProfile[]} profiles - The profiles to rate.
 * @throws {Error} When two rating schemes rank the same metric in opposite directions.
 */
export const addHealthRatings = (profiles) => {
  /** @type {Map<string, Partial<Record<NutritionMetric, number>>>} */
  const profileFits = new Map();
  /** @type {Map<NutritionMetric, RatingDirection>} */
  const directionsByMetric = new Map();
  for (const scheme of Object.values(HEALTH_RATING_SCHEMES)) {
    for (const [metric, direction] of scheme) {
      const previous = directionsByMetric.get(metric);
      if (previous && previous !== direction) {
        throw new Error(`Nutrition metric ${metric} has conflicting rating directions.`);
      }
      directionsByMetric.set(metric, direction);
    }
  }

  for (const nutritionClass of ["meal", "drink"]) {
    const classProfiles = profiles.filter(
      (profile) =>
        profile.status === "released" && profile.nutritionClass === nutritionClass,
    );
    for (const [metric, direction] of directionsByMetric) {
      const candidates = classProfiles
        .map((profile) => ({
          profile,
          value: nutritionValueForComparison(profile.nutrients[metric]),
        }))
        .filter(
          /**
           * @param {{ profile: HealthRatedProfile; value: number | undefined }} candidate
           * @returns {candidate is RatingCandidate<HealthRatedProfile>}
           */
          (candidate) => candidate.value !== undefined,
        );
      const fits = computeRelativeFits(
        candidates.map((candidate) => ({
          id: candidate.profile.id,
          value: candidate.value,
        })),
        direction,
      );
      for (const { profile } of candidates) {
        const existing = profileFits.get(profile.id) ?? {};
        existing[metric] = fits.get(profile.id);
        profileFits.set(profile.id, existing);
      }
    }
  }

  /**
   * @param {HealthRatedProfile} profile
   * @param {readonly RatingTerm[]} scheme
   */
  const rate = (profile, scheme) => {
    const fits = profileFits.get(profile.id) ?? {};
    let weightedFit = 0;
    let availableWeight = 0;
    for (const [metric, , weight] of scheme) {
      const fit = fits[metric];
      if (fit === undefined) continue;
      weightedFit += fit * weight;
      availableWeight += weight;
    }
    const normalizedFit = availableWeight === 0 ? 0.5 : weightedFit / availableWeight;
    return roundRating(1 + 4 * normalizedFit);
  };

  for (const profile of profiles) {
    if (profile.status !== "released") {
      profile.healthRating = 3;
      profile.conditionRatings = { ...NEUTRAL_CONDITION_RATINGS };
      continue;
    }
    profile.healthRating = rate(profile, HEALTH_RATING_SCHEMES.overall);
    profile.conditionRatings = Object.fromEntries(
      Object.entries(HEALTH_RATING_SCHEMES)
        .filter(([id]) => id !== "overall")
        .map(([id, scheme]) => [id, rate(profile, scheme)]),
    );
  }
};
