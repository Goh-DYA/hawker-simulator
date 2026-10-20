/**
 * Core nutrition rules: the choice bonuses from nutrition intents and health conditions,
 * condition and personalised health ratings, seeded intent and condition assignment, request
 * results, and the nutrition metrics with their builders, copies and sale bookkeeping.
 *
 * Health conditions and ratings are simplified game traits, not medical advice. The metric
 * records are keyed in the `enums.ts` tuple order, which the digests depend on.
 */
import { HEALTH_CONDITIONS, NUTRITION_INTENTS, NUTRITION_METRICS } from "./enums";
import type {
  Customer,
  DishDefinition,
  HealthCondition,
  HealthPreferenceResult,
  NutritionIntent,
  NutritionIntentMetrics,
  NutritionDailyMetrics,
  NutritionMetric,
  NutritionMetrics,
  NutritionProfile,
  NutritionRequestResult,
  NutritionValue,
  NutritionVariant,
} from "./types";

export { HEALTH_CONDITIONS, NUTRITION_INTENTS, NUTRITION_METRICS };

/** Weight of a stall's best intent fit in a customer's stall-choice score. */
export const NUTRITION_STALL_CHOICE_WEIGHT = 2;
/** Weight of a dish's intent fit in a customer's dish-choice score. */
export const NUTRITION_DISH_CHOICE_WEIGHT = 1.75;
/**
 * Weight of a stall's best personalised health rating in the stall-choice score of a customer with
 * a health condition.
 */
export const HEALTH_STALL_CHOICE_WEIGHT = 2.5;
/**
 * Weight of a dish's personalised health rating in the dish-choice score of a customer with a
 * health condition.
 */
export const HEALTH_DISH_CHOICE_WEIGHT = 2.25;
/** Chance that a customer's seeded roll assigns a nutrition intent or a health condition. */
const NUTRITION_ROLL_CHANCE = 0.4;
/** Player level from which customers can arrive with a nutrition intent. */
const NUTRITION_INTENT_UNLOCK_LEVEL = 2;
/** Intent fit at or above which a served variant counts as matching the request. */
const NUTRITION_INTENT_MATCH_THRESHOLD = 0.67;
/** Personalised health rating at or above which a served dish counts as a health match. */
export const HEALTH_MATCH_THRESHOLD = 3.5;

function weightedIntentFit(fit: number | undefined, weight: number): number {
  if (typeof fit !== "number" || !Number.isFinite(fit)) return 0;
  return Math.max(0, Math.min(1, fit)) * weight;
}

/**
 * Converts a stall's intent fit into its stall-choice bonus.
 *
 * @param fit - The fit from 0 to 1, or undefined when unknown.
 * @returns The fit clamped to 0 to 1 and weighted, or 0 when the fit is unknown.
 */
export function nutritionStallChoiceBonus(fit: number | undefined): number {
  return weightedIntentFit(fit, NUTRITION_STALL_CHOICE_WEIGHT);
}

/**
 * Converts a dish's intent fit into its dish-choice bonus.
 *
 * @param fit - The fit from 0 to 1, or undefined when unknown.
 * @returns The fit clamped to 0 to 1 and weighted, or 0 when the fit is unknown.
 */
export function nutritionDishChoiceBonus(fit: number | undefined): number {
  return weightedIntentFit(fit, NUTRITION_DISH_CHOICE_WEIGHT);
}

function boundedHealthRating(rating: number | undefined): number | undefined {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return undefined;
  return Math.max(1, Math.min(5, rating));
}

function healthChoiceBonus(
  rating: number | undefined,
  conditions: readonly HealthCondition[],
  weight: number,
): number {
  const bounded = boundedHealthRating(rating);
  if (conditions.length === 0 || bounded === undefined) return 0;
  return ((bounded - 1) / 4) * weight;
}

/**
 * Converts a stall's personalised health rating into its stall-choice bonus.
 *
 * @param rating - The rating from 1 to 5, or undefined when unknown.
 * @param conditions - The customer's health conditions.
 * @returns The rating rescaled to 0 to 1 and weighted, or 0 when the customer has no condition or
 *   the rating is unknown.
 */
export function healthStallChoiceBonus(
  rating: number | undefined,
  conditions: readonly HealthCondition[],
): number {
  return healthChoiceBonus(rating, conditions, HEALTH_STALL_CHOICE_WEIGHT);
}

/**
 * Converts a dish's personalised health rating into its dish-choice bonus.
 *
 * @param rating - The rating from 1 to 5, or undefined when unknown.
 * @param conditions - The customer's health conditions.
 * @returns The rating rescaled to 0 to 1 and weighted, or 0 when the customer has no condition or
 *   the rating is unknown.
 */
export function healthDishChoiceBonus(
  rating: number | undefined,
  conditions: readonly HealthCondition[],
): number {
  return healthChoiceBonus(rating, conditions, HEALTH_DISH_CHOICE_WEIGHT);
}

/**
 * Uses authored stars when available and preserves legacy quality-based appeal otherwise.
 *
 * @param dish - The dish.
 * @returns The authored Star rating clamped to 1 to 5, or the dish quality when no finite rating is
 *   authored.
 */
export function dishStarRating(dish: DishDefinition): number {
  return boundedHealthRating(dish.starRating) ?? dish.quality;
}

function emptyIntentMetric(): NutritionIntentMetrics {
  return { requests: 0, matches: 0, misses: 0, unknowns: 0 };
}

/**
 * Builds zeroed per-intent request counters, keyed in `NUTRITION_INTENTS` order.
 *
 * @returns A fresh record with one zeroed counter object per intent.
 */
function build_intent_metrics_record(): Record<NutritionIntent, NutritionIntentMetrics> {
  return Object.fromEntries(
    NUTRITION_INTENTS.map((intent) => [intent, emptyIntentMetric()]),
  ) as Record<NutritionIntent, NutritionIntentMetrics>;
}

/**
 * Builds a zeroed per-nutrient number record, keyed in `NUTRITION_METRICS` order.
 *
 * @returns A fresh record with every nutrient set to zero.
 */
function build_metric_record(): Record<NutritionMetric, number> {
  return Object.fromEntries(
    NUTRITION_METRICS.map((metric) => [metric, 0]),
  ) as Record<NutritionMetric, number>;
}

/**
 * Deep-copies one day of nutrition metrics, keeping its key order.
 *
 * @param day - The day metrics to copy.
 * @returns A copy that shares no nested objects with `day`.
 */
function clone_day_metrics(day: NutritionDailyMetrics): NutritionDailyMetrics {
  return {
    ...day,
    byIntent: Object.fromEntries(
      Object.entries(day.byIntent).map(([intent, value]) => [intent, { ...value }]),
    ) as Readonly<Record<NutritionIntent, NutritionIntentMetrics>>,
    nutrientTotals: { ...day.nutrientTotals },
    nutrientKnownCounts: { ...day.nutrientKnownCounts },
    dishServings: { ...day.dishServings },
  };
}

/**
 * Creates zeroed lifetime nutrition metrics with an empty day-0 record.
 *
 * @returns The new metrics.
 */
export function createEmptyNutritionMetrics(): NutritionMetrics {
  const emptyDay = createEmptyNutritionDayMetrics(0);
  return {
    servedMeals: 0,
    profiledServings: 0,
    nonDefaultVariantServings: 0,
    intentRequests: 0,
    intentMatches: 0,
    intentMisses: 0,
    intentUnknowns: 0,
    byIntent: build_intent_metrics_record(),
    nutrientTotals: build_metric_record(),
    nutrientKnownCounts: build_metric_record(),
    dishServings: {},
    recentOutcomes: [],
    today: emptyDay,
  };
}

/**
 * Creates zeroed nutrition metrics for one operating day.
 *
 * @param day - The operating day.
 * @returns The new day metrics.
 */
export function createEmptyNutritionDayMetrics(day: number): NutritionDailyMetrics {
  return {
    day,
    servedMeals: 0,
    profiledServings: 0,
    intentRequests: 0,
    intentMatches: 0,
    intentMisses: 0,
    intentUnknowns: 0,
    byIntent: build_intent_metrics_record(),
    nutrientTotals: build_metric_record(),
    nutrientKnownCounts: build_metric_record(),
    dishServings: {},
  };
}

/**
 * Deep-copies a nutrition profile, keeping its key order.
 *
 * @param profile - The profile to copy, if any.
 * @returns The copy, or undefined when there is no profile.
 */
export function cloneNutritionProfile(
  profile: NutritionProfile | undefined,
): NutritionProfile | undefined {
  if (!profile) return undefined;
  return {
    ...profile,
    serving: profile.serving ? { ...profile.serving } : undefined,
    nutrients: Object.fromEntries(
      Object.entries(profile.nutrients).map(([metric, value]) => [metric, { ...value }]),
    ) as Readonly<Record<NutritionMetric, NutritionValue>>,
    intentFits: { ...profile.intentFits },
    conditionRatings: profile.conditionRatings
      ? { ...profile.conditionRatings }
      : undefined,
  };
}

/**
 * Deep-copies the nutrition metrics, including recent outcomes and today's record, keeping their
 * key order.
 *
 * @param metrics - The metrics to copy.
 * @returns The copy.
 */
export function cloneNutritionMetrics(metrics: NutritionMetrics): NutritionMetrics {
  return {
    ...metrics,
    byIntent: Object.fromEntries(
      Object.entries(metrics.byIntent).map(([intent, value]) => [intent, { ...value }]),
    ) as Readonly<Record<NutritionIntent, NutritionIntentMetrics>>,
    nutrientTotals: { ...metrics.nutrientTotals },
    nutrientKnownCounts: { ...metrics.nutrientKnownCounts },
    dishServings: { ...metrics.dishServings },
    recentOutcomes: metrics.recentOutcomes.map((outcome) => ({
      ...outcome,
      profile: cloneNutritionProfile(outcome.profile),
    })),
    today: clone_day_metrics(metrics.today),
  };
}

/**
 * Resolves the nutrition variant a dish currently serves: the active variant, else the default,
 * else the first.
 *
 * @param dish - The dish, if any.
 * @returns The variant, or undefined when the dish has no variants.
 */
export function activeNutritionVariant(
  dish: DishDefinition | undefined,
): NutritionVariant | undefined {
  if (!dish?.nutritionVariants?.length) return undefined;
  return dish.nutritionVariants.find(
    (variant) => variant.id === dish.activeNutritionVariantId,
  ) ?? dish.nutritionVariants.find(
    (variant) => variant.id === dish.defaultNutritionVariantId,
  ) ?? dish.nutritionVariants[0];
}

/**
 * Reads how well a dish's active variant fits a nutrition intent.
 *
 * @param dish - The dish, if any.
 * @param intent - The intent, if any.
 * @returns The fit clamped to 0 to 1, or undefined when there is no intent, no released profile or
 *   no finite fit.
 */
export function nutritionIntentFit(
  dish: DishDefinition | undefined,
  intent: NutritionIntent | undefined,
): number | undefined {
  if (!intent) return undefined;
  const profile = activeNutritionVariant(dish)?.profile;
  if (!profile || profile.status !== "released") return undefined;
  const fit = profile.intentFits[intent];
  return typeof fit === "number" && Number.isFinite(fit)
    ? Math.max(0, Math.min(1, fit))
    : undefined;
}

/**
 * Finds the best intent fit among a stall's enabled dishes.
 *
 * @param dishes - The enabled dishes.
 * @param intent - The intent, if any.
 * @returns The highest known fit, or undefined when none is known.
 */
export function bestEnabledNutritionIntentFit(
  dishes: readonly DishDefinition[],
  intent: NutritionIntent | undefined,
): number | undefined {
  let best: number | undefined;
  for (const dish of dishes) {
    const fit = nutritionIntentFit(dish, intent);
    if (fit === undefined) continue;
    best = best === undefined ? fit : Math.max(best, fit);
  }
  return best;
}

function nutrientAmount(
  profile: NutritionProfile,
  metric: NutritionMetric,
): number | undefined {
  const nutrient = profile.nutrients[metric];
  if (nutrient?.status === "trace") return 0;
  return nutrient?.status === "known" && Number.isFinite(nutrient.value)
    ? Math.max(0, nutrient.value)
    : undefined;
}

function lowerIsBetterRating(
  value: number | undefined,
  preferredMaximum: number,
  highThreshold: number,
): number | undefined {
  if (value === undefined) return undefined;
  const proportion = Math.max(
    0,
    Math.min(1, (value - preferredMaximum) / (highThreshold - preferredMaximum)),
  );
  return 5 - proportion * 4;
}

function higherIsBetterRating(
  value: number | undefined,
  lowThreshold: number,
  preferredMinimum: number,
): number | undefined {
  if (value === undefined) return undefined;
  const proportion = Math.max(
    0,
    Math.min(1, (value - lowThreshold) / (preferredMinimum - lowThreshold)),
  );
  return 1 + proportion * 4;
}

function averageKnownRatings(ratings: readonly (number | undefined)[]): number | undefined {
  const known = ratings.filter((rating): rating is number => rating !== undefined);
  if (known.length === 0) return undefined;
  return known.reduce((total, rating) => total + rating, 0) / known.length;
}

/**
 * Resolves an authored condition rating, with a nutrient-derived fallback for
 * legacy profiles. Thresholds are gameplay bands per serving, not diagnoses.
 *
 * @param profile - The profile, if any.
 * @param condition - The health condition to rate for.
 * @returns The authored rating clamped to 1 to 5; otherwise a blend of the overall rating and the
 *   nutrient bands; or undefined when the profile is not released or nothing is known.
 */
export function healthConditionRating(
  profile: NutritionProfile | undefined,
  condition: HealthCondition,
): number | undefined {
  if (!profile || profile.status !== "released") return undefined;
  const authored = boundedHealthRating(profile.conditionRatings?.[condition]);
  if (authored !== undefined) return authored;

  let nutrientRating: number | undefined;
  switch (condition) {
    case "high-cholesterol":
      nutrientRating = averageKnownRatings([
        lowerIsBetterRating(nutrientAmount(profile, "totalFatG"), 15, 40),
        lowerIsBetterRating(nutrientAmount(profile, "saturatedFatG"), 5, 15),
        lowerIsBetterRating(nutrientAmount(profile, "transFatG"), 0, 2),
      ]);
      break;
    case "obesity":
      nutrientRating = averageKnownRatings([
        lowerIsBetterRating(nutrientAmount(profile, "energyKcal"), 450, 900),
        lowerIsBetterRating(nutrientAmount(profile, "totalFatG"), 15, 40),
        lowerIsBetterRating(nutrientAmount(profile, "totalSugarG"), 10, 30),
      ]);
      break;
    case "diabetes":
      nutrientRating = averageKnownRatings([
        lowerIsBetterRating(nutrientAmount(profile, "carbohydrateG"), 45, 100),
        lowerIsBetterRating(nutrientAmount(profile, "totalSugarG"), 8, 30),
        higherIsBetterRating(nutrientAmount(profile, "dietaryFibreG"), 2, 8),
      ]);
      break;
    case "hypertension":
      nutrientRating = lowerIsBetterRating(
        nutrientAmount(profile, "sodiumMg"),
        600,
        1_800,
      );
      break;
  }

  const generalRating = boundedHealthRating(profile.healthRating);
  if (nutrientRating === undefined) return generalRating;
  if (generalRating === undefined) return nutrientRating;
  return generalRating * 0.35 + nutrientRating * 0.65;
}

/**
 * Averages the condition ratings of a profile for a customer's conditions.
 *
 * @param profile - The served profile, if any.
 * @param conditions - The customer's health conditions.
 * @returns The mean of the known ratings, or undefined when the customer has no condition or no
 *   rating is known.
 */
export function personalizedHealthRating(
  profile: NutritionProfile | undefined,
  conditions: readonly HealthCondition[],
): number | undefined {
  if (conditions.length === 0) return undefined;
  const ratings = conditions.map((condition) => healthConditionRating(profile, condition));
  return averageKnownRatings(ratings);
}

/**
 * Finds the best personalised health rating among a stall's enabled dishes, using each dish's
 * active variant.
 *
 * @param dishes - The enabled dishes.
 * @param conditions - The customer's health conditions.
 * @returns The highest known rating, or undefined when none is known.
 */
export function bestEnabledPersonalizedHealthRating(
  dishes: readonly DishDefinition[],
  conditions: readonly HealthCondition[],
): number | undefined {
  let best: number | undefined;
  for (const dish of dishes) {
    const rating = personalizedHealthRating(
      activeNutritionVariant(dish)?.profile,
      conditions,
    );
    if (rating === undefined) continue;
    best = best === undefined ? rating : Math.max(best, rating);
  }
  return best;
}

/**
 * Classifies a personalised health rating as a health match or miss.
 *
 * @param rating - The rating, if known.
 * @returns `"matched"` at 3.5 or above, `"missed"` below it, or `"unknown"` when the rating is
 *   unknown.
 */
export function healthPreferenceResultForRating(
  rating: number | undefined,
): HealthPreferenceResult {
  const bounded = boundedHealthRating(rating);
  if (bounded === undefined) return "unknown";
  return bounded >= HEALTH_MATCH_THRESHOLD ? "matched" : "missed";
}

/**
 * Signed satisfaction delta on the core zero-to-five satisfaction scale.
 *
 * @param rating - The personalised health rating, if known.
 * @returns The delta from -0.2 to +0.2, or undefined when the rating is unknown.
 */
export function healthImpactFromRating(rating: number | undefined): number | undefined {
  const bounded = boundedHealthRating(rating);
  return bounded === undefined ? undefined : (bounded - 3) / 10;
}

/**
 * Maps one seeded roll in `[0, chance)` onto an evenly sized slot of `options`.
 *
 * The roll both decides whether anything is picked (rolls outside the range pick nothing) and
 * which option is used, so callers consume exactly one RNG value per decision.
 *
 * @param roll - The seeded roll to map.
 * @param options - The canonical, already-filtered options, in catalogue order.
 * @param chance - The exclusive upper bound of rolls that pick an option.
 * @returns The option for the roll, or `undefined` when the roll is out of range or there are no options.
 */
function pick_from_roll<T>(roll: number, options: readonly T[], chance: number): T | undefined {
  if (options.length === 0 || !Number.isFinite(roll) || roll < 0 || roll >= chance) return undefined;
  return options[Math.min(options.length - 1, Math.floor((roll / chance) * options.length))];
}

/**
 * One seeded roll assigns zero or one condition independently of archetype.
 *
 * @param level - The player level; no condition is assigned below level 1.
 * @param eligible - The archetype's eligible conditions.
 * @param roll - The seeded roll from 0 to 1.
 * @returns The assigned condition, or undefined when the roll picks none.
 */
export function healthConditionFromRoll(
  level: number,
  eligible: readonly HealthCondition[],
  roll: number,
): HealthCondition | undefined {
  if (level < 1 || eligible.length === 0) return undefined;
  const canonical = HEALTH_CONDITIONS.filter((condition) => eligible.includes(condition));
  return pick_from_roll(roll, canonical, NUTRITION_ROLL_CHANCE);
}

/**
 * One seeded roll decides both whether an intent exists and which intent is used.
 *
 * @param level - The player level; no intent is assigned below level 2.
 * @param eligible - The archetype's eligible intents.
 * @param roll - The seeded roll from 0 to 1.
 * @returns The assigned intent, or undefined when the roll picks none.
 */
export function nutritionIntentFromRoll(
  level: number,
  eligible: readonly NutritionIntent[],
  roll: number,
): NutritionIntent | undefined {
  if (level < NUTRITION_INTENT_UNLOCK_LEVEL || eligible.length === 0) return undefined;
  const canonical = NUTRITION_INTENTS.filter((intent) => eligible.includes(intent));
  return pick_from_roll(roll, canonical, NUTRITION_ROLL_CHANCE);
}

/**
 * Classifies a served profile against a customer's nutrition intent.
 *
 * @param intent - The requested intent, if any.
 * @param profile - The served profile, if any.
 * @returns `"matched"` when the fit is at least 0.67, `"missed"` below it, or `"unknown"` when
 *   there is no intent, no released profile or no finite fit.
 */
export function nutritionRequestResult(
  intent: NutritionIntent | undefined,
  profile: NutritionProfile | undefined,
): NutritionRequestResult {
  if (!intent || !profile || profile.status !== "released") return "unknown";
  const fit = profile.intentFits[intent];
  if (typeof fit !== "number" || !Number.isFinite(fit)) return "unknown";
  return fit >= NUTRITION_INTENT_MATCH_THRESHOLD ? "matched" : "missed";
}

/**
 * Counts a customer's nutrition intent request in the lifetime and today metrics.
 *
 * Starts a fresh today record when the operating day has changed.
 *
 * @param nutrition - The nutrition metrics before the request; they are not mutated.
 * @param intent - The requested intent.
 * @param day - The operating day the request falls on.
 * @returns The nutrition metrics with the request counted.
 */
export function record_intent_request(
  nutrition: NutritionMetrics,
  intent: NutritionIntent,
  day: number,
): NutritionMetrics {
  const today = nutrition.today.day === day
    ? nutrition.today
    : createEmptyNutritionDayMetrics(day);
  return {
    ...nutrition,
    intentRequests: nutrition.intentRequests + 1,
    byIntent: {
      ...nutrition.byIntent,
      [intent]: {
        ...nutrition.byIntent[intent],
        requests: nutrition.byIntent[intent].requests + 1,
      },
    },
    today: {
      ...today,
      intentRequests: today.intentRequests + 1,
      byIntent: {
        ...today.byIntent,
        [intent]: {
          ...today.byIntent[intent],
          requests: today.byIntent[intent].requests + 1,
        },
      },
    },
  };
}

/**
 * Adds one request result to an intent's match, miss and unknown counters.
 *
 * @param counts - The intent counters before the sale.
 * @param request_result - The result of the sale against the requested intent.
 * @returns The counters with the matching one incremented.
 */
function count_request_result(
  counts: NutritionIntentMetrics,
  request_result: NutritionRequestResult,
): NutritionIntentMetrics {
  return {
    ...counts,
    matches: counts.matches + (request_result === "matched" ? 1 : 0),
    misses: counts.misses + (request_result === "missed" ? 1 : 0),
    unknowns: counts.unknowns + (request_result === "unknown" ? 1 : 0),
  };
}

/**
 * Counts a served meal in the lifetime and today nutrition metrics.
 *
 * Updates the served and profiled servings, non-default variant use, intent results, known
 * nutrient totals, dish servings and the recent outcomes. Starts a fresh today record when the
 * operating day has changed. The statement order matches the pre-refactor sale code, because it
 * fixes the floating-point totals.
 *
 * @param nutrition - The nutrition metrics after the intent request; they are not mutated.
 * @param dish - The dish that was served.
 * @param profile - The served variant's nutrition profile, if it has one.
 * @param customer - The served customer, for its ID, intent and ordered variant.
 * @param request_result - The result against the customer's intent, when it requested one.
 * @param day - The operating day the sale falls on.
 * @returns The nutrition metrics with the sale counted.
 */
export function record_nutrition_sale(
  nutrition: NutritionMetrics,
  dish: DishDefinition,
  profile: NutritionProfile | undefined,
  customer: Customer,
  request_result: NutritionRequestResult | undefined,
  day: number,
): NutritionMetrics {
  const today = nutrition.today.day === day
    ? nutrition.today
    : createEmptyNutritionDayMetrics(day);
  const nutrientTotals = { ...nutrition.nutrientTotals };
  const nutrientKnownCounts = { ...nutrition.nutrientKnownCounts };
  const dailyNutrientTotals = { ...today.nutrientTotals };
  const dailyNutrientKnownCounts = { ...today.nutrientKnownCounts };
  if (profile?.status === "released") {
    for (const metric of NUTRITION_METRICS) {
      const value = profile.nutrients[metric];
      if (value?.status !== "known") continue;
      nutrientTotals[metric] += value.value;
      nutrientKnownCounts[metric] += 1;
      dailyNutrientTotals[metric] += value.value;
      dailyNutrientKnownCounts[metric] += 1;
    }
  }
  const defaultVariantId = dish.defaultNutritionVariantId;
  const usedNonDefaultVariant = Boolean(
    customer.orderedNutritionVariantId &&
      defaultVariantId &&
      customer.orderedNutritionVariantId !== defaultVariantId,
  );
  const byIntent = { ...nutrition.byIntent };
  const dailyByIntent = { ...today.byIntent };
  let intentMatches = nutrition.intentMatches;
  let intentMisses = nutrition.intentMisses;
  let intentUnknowns = nutrition.intentUnknowns;
  if (customer.nutritionIntentId && request_result) {
    const intent = customer.nutritionIntentId;
    byIntent[intent] = count_request_result(byIntent[intent], request_result);
    dailyByIntent[intent] = count_request_result(dailyByIntent[intent], request_result);
    intentMatches += request_result === "matched" ? 1 : 0;
    intentMisses += request_result === "missed" ? 1 : 0;
    intentUnknowns += request_result === "unknown" ? 1 : 0;
  }
  return {
    ...nutrition,
    servedMeals: nutrition.servedMeals + 1,
    profiledServings: nutrition.profiledServings + (profile?.status === "released" ? 1 : 0),
    nonDefaultVariantServings:
      nutrition.nonDefaultVariantServings + (usedNonDefaultVariant ? 1 : 0),
    intentMatches,
    intentMisses,
    intentUnknowns,
    byIntent,
    nutrientTotals,
    nutrientKnownCounts,
    dishServings: profile?.status === "released"
      ? {
          ...nutrition.dishServings,
          [dish.id]: (nutrition.dishServings[dish.id] ?? 0) + 1,
        }
      : nutrition.dishServings,
    recentOutcomes: [
      ...nutrition.recentOutcomes,
      {
        customerId: customer.id,
        day,
        intentId: customer.nutritionIntentId,
        dishId: dish.id,
        variantId: customer.orderedNutritionVariantId,
        result: request_result ?? "unknown",
        profile,
      },
    ].slice(-50),
    today: {
      ...today,
      servedMeals: today.servedMeals + 1,
      profiledServings: today.profiledServings + (profile?.status === "released" ? 1 : 0),
      intentMatches: today.intentMatches + (request_result === "matched" ? 1 : 0),
      intentMisses: today.intentMisses + (request_result === "missed" ? 1 : 0),
      intentUnknowns: today.intentUnknowns + (request_result === "unknown" ? 1 : 0),
      byIntent: dailyByIntent,
      nutrientTotals: dailyNutrientTotals,
      nutrientKnownCounts: dailyNutrientKnownCounts,
      dishServings: profile?.status === "released"
        ? {
            ...today.dishServings,
            [dish.id]: (today.dishServings[dish.id] ?? 0) + 1,
          }
        : today.dishServings,
    },
  };
}
