/**
 * Visit settlement: completing a sale and scoring a visit when the guest leaves.
 *
 * Internal to core; it is not re-exported from the barrel. `completeSale` books the purchase
 * and its nutrition metrics, and `settleVisitRating` turns a visit's rating factors into a score
 * that moves reputation and stall mastery. Both edit the step draft in place in a fixed order, so
 * seeded runs stay identical.
 */
import { applySale, getUnlockedDefinitionIds, MAX_REPUTATION } from "./economy";
import { event, getArchetype, removeFromAllQueues, transition, type Draft } from "./draft";
import { recordIntentRequest } from "./arrivals";
import { VISIT_RATING_WEIGHTS, wait_satisfaction_score, walkingSatisfactionScore } from "./satisfaction";
import {
  cloneNutritionProfile,
  dishStarRating,
  healthImpactFromRating,
  healthPreferenceResultForRating,
  nutritionRequestResult,
  personalizedHealthRating,
  record_nutrition_sale,
} from "./nutrition";
import { awardStallMastery, operatingDay, VISIT_HISTORY_LIMIT } from "./progression";
import type { Customer, DishDefinition } from "./types";

// Visit rating (settleVisitRating). Defaults apply to components no earlier step supplied.

/** Default food-quality component for a served guest. */
const SERVED_FOOD_QUALITY_DEFAULT = 70;
/** Default food-quality component for a guest who was never served. */
const UNSERVED_FOOD_QUALITY_DEFAULT = 0;
/** Default value component for a served guest. */
const SERVED_VALUE_DEFAULT = 70;
/** Default value component for a guest who was never served. */
const UNSERVED_VALUE_DEFAULT = 20;
/** Default comfort component for a served guest. */
const SERVED_COMFORT_DEFAULT = 65;
/** Default comfort component for a guest who was never served. */
const UNSERVED_COMFORT_DEFAULT = 20;
/** Default cleanliness component. */
const CLEANLINESS_DEFAULT = 70;
/** Default ambience component. */
const AMBIENCE_DEFAULT = 65;
/** Highest rating an abandoned visit can score after the guest was served. */
const ABANDONED_SERVED_SCORE_CAP = 62;
/** Highest rating an abandoned visit can score when the guest was never served. */
const ABANDONED_UNSERVED_SCORE_CAP = 45;
/** Rating penalty for abandoning a visit after being served. */
const ABANDONED_SERVED_PENALTY = 12;
/** Rating penalty for abandoning a visit without being served. */
const ABANDONED_UNSERVED_PENALTY = 28;
/** Share of the gap to a visit's reputation target that one rating closes (an EWMA weight). */
export const REPUTATION_SMOOTHING = 0.02;
/** Visit rating whose reputation target is zero. */
const REPUTATION_FLOOR_SCORE = 55;
/** Rating points above the floor that map to the full reputation scale. */
const REPUTATION_SCORE_SPAN = 40;
/** Visit rating points per point on the zero-to-five satisfaction scale. */
const RATING_POINTS_PER_SATISFACTION = 20;

/**
 * Moves reputation one rating towards the level that rating reflects.
 *
 * Reputation is an exponentially weighted moving average of recent visits: each rating maps to
 * a target on the zero-to-five scale and closes `REPUTATION_SMOOTHING` of the gap, so roughly the
 * last fifty visits dominate. A running sum would keep falling for any centre rated below a fixed
 * neutral score, however much it improved; the average instead settles at the quality the centre
 * delivers and recovers when service does.
 *
 * @param reputation - The reputation before the visit.
 * @param score - The visit rating, from 0 to 100.
 * @returns The reputation after the visit, within zero and `MAX_REPUTATION`.
 */
export function next_reputation(reputation: number, score: number): number {
  const target = Math.max(
    0,
    Math.min(MAX_REPUTATION, ((score - REPUTATION_FLOOR_SCORE) / REPUTATION_SCORE_SPAN) * MAX_REPUTATION),
  );
  return Math.max(0, Math.min(MAX_REPUTATION, reputation + REPUTATION_SMOOTHING * (target - reputation)));
}

function normalizeQuality(value: number): number {
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value * 20));
}

/**
 * Scores a finished or abandoned visit once and applies it to metrics, economy and progression.
 *
 * Appends the visit rating, counts an abandoned visit, nudges reputation towards the score and
 * awards stall mastery for a served guest. A customer whose rating is already settled is returned
 * unchanged, so a visit is never scored twice.
 *
 * @param draft - The draft whose metrics, economy and progression are edited.
 * @param source - The customer whose visit is scored.
 * @param abandoned - Whether the guest gave up, which caps and penalises the score.
 * @param reason - The reason recorded on the rating.
 * @returns The customer with its satisfaction set from the score and the rating marked settled.
 */
export function settleVisitRating(draft: Draft, source: Customer, abandoned: boolean, reason: string): Customer {
  if (source.ratingSettled) return source;
  const archetype = getArchetype(draft, source);
  const supplied = source.ratingFactors ?? {};
  const components = {
    foodQuality: supplied.foodQuality ?? (source.served ? SERVED_FOOD_QUALITY_DEFAULT : UNSERVED_FOOD_QUALITY_DEFAULT),
    wait: supplied.wait ?? wait_satisfaction_score(source.patienceRemainingMs, archetype.patienceMs),
    value: supplied.value ?? (source.served ? SERVED_VALUE_DEFAULT : UNSERVED_VALUE_DEFAULT),
    walking: supplied.walking ?? walkingSatisfactionScore(source.walkingDistanceTiles),
    comfort: supplied.comfort ?? (source.served ? SERVED_COMFORT_DEFAULT : UNSERVED_COMFORT_DEFAULT),
    cleanliness: supplied.cleanliness ?? CLEANLINESS_DEFAULT,
    ambience: supplied.ambience ?? AMBIENCE_DEFAULT,
  };
  let score =
    components.foodQuality * VISIT_RATING_WEIGHTS.foodQuality +
    components.wait * VISIT_RATING_WEIGHTS.wait +
    components.value * VISIT_RATING_WEIGHTS.value +
    components.walking * VISIT_RATING_WEIGHTS.walking +
    components.comfort * VISIT_RATING_WEIGHTS.comfort +
    components.cleanliness * VISIT_RATING_WEIGHTS.cleanliness +
    components.ambience * VISIT_RATING_WEIGHTS.ambience;
  if (abandoned) {
    score = Math.min(
      source.served ? ABANDONED_SERVED_SCORE_CAP : ABANDONED_UNSERVED_SCORE_CAP,
      score - (source.served ? ABANDONED_SERVED_PENALTY : ABANDONED_UNSERVED_PENALTY),
    );
  }
  score = Math.round(Math.max(0, Math.min(100, score)));
  const rating = {
    customerId: source.id,
    walkingMetricVersion: 2 as const,
    score,
    served: source.served,
    abandoned,
    reason,
    stallDefinitionId: source.servedStallDefinitionId,
    components,
    day: operatingDay(draft.source.elapsedMs),
  };
  draft.metrics = { ...draft.metrics, visitRatings: [...draft.metrics.visitRatings, rating].slice(-VISIT_HISTORY_LIMIT) };
  if (abandoned) draft.economy = { ...draft.economy, abandonedVisits: draft.economy.abandonedVisits + 1 };
  const reputation = next_reputation(draft.progression.reputation, score);
  draft.progression = { ...draft.progression, reputation };
  if (source.served && source.servedStallDefinitionId) {
    draft.progression = awardStallMastery(
      { progression: draft.progression },
      source.servedStallDefinitionId,
      score,
    );
  }
  return { ...source, satisfaction: score / RATING_POINTS_PER_SATISFACTION, ratingSettled: true };
}

/**
 * Completes a customer's purchase: books the sale, counts nutrition metrics and hands over the tray.
 *
 * The intent request is recorded before the sale's nutrition outcome, and the customer leaves
 * every queue before the sale events are emitted.
 *
 * @param draft - The draft whose economy, progression, queues, metrics and events are edited.
 * @param source - The customer being served.
 * @param dish - The dish the customer ordered.
 * @returns The served customer, now seeking a seat with its food-quality and value factors set.
 */
export function completeSale(draft: Draft, source: Customer, dish: DishDefinition): Customer {
  const servedStall = source.targetStallId ? draft.objects[source.targetStallId] : undefined;
  const stallDefinition = servedStall ? draft.source.catalog.placeables[servedStall.definitionId]?.stall : undefined;
  const tasteRating = dishStarRating(dish);
  const healthRating = source.personalizedHealthRating ?? personalizedHealthRating(
    source.orderedNutritionProfile,
    source.healthConditions,
  );
  const healthImpact = source.healthConditions.length > 0
    ? healthImpactFromRating(healthRating)
    : undefined;
  const healthPreferenceResult = source.healthConditions.length > 0
    ? healthPreferenceResultForRating(healthRating)
    : undefined;
  const update = applySale(
    draft.economy,
    draft.progression,
    dish.price,
    dish.quality,
    0,
  );
  draft.economy = update.economy;
  draft.progression = {
    ...update.progression,
    unlockedDefinitionIds: getUnlockedDefinitionIds(
      draft.source.catalog,
      update.progression.level,
      update.progression.unlockedDefinitionIds,
    ),
  };
  removeFromAllQueues(draft, source.id);
  event(draft, { type: "sale-completed", entityId: source.id, amount: dish.price, message: dish.id });
  if (update.levelUp) event(draft, { type: "level-up", entityId: source.id, message: String(update.progression.level) });
  const profile = cloneNutritionProfile(source.orderedNutritionProfile);
  const requestResult = source.nutritionIntentId
    ? nutritionRequestResult(source.nutritionIntentId, profile)
    : undefined;
  recordIntentRequest(draft, source.nutritionIntentId);
  draft.metrics = {
    ...draft.metrics,
    nutrition: record_nutrition_sale(
      draft.metrics.nutrition,
      dish,
      profile,
      source,
      requestResult,
      operatingDay(draft.source.elapsedMs),
    ),
  };
  return {
    ...transition(draft, source, "seeking-seat"),
    targetStallId: undefined,
    servedStallDefinitionId: servedStall?.definitionId,
    orderedDishId: dish.id,
    nutritionRequestResult: requestResult,
    hasTray: true,
    served: true,
    spent: source.spent + dish.price,
    personalizedHealthRating: healthRating,
    healthImpact,
    healthPreferenceResult,
    satisfaction: Math.max(
      0,
      Math.min(
        5,
        source.satisfaction + normalizeQuality(tasteRating) / 100 + (healthImpact ?? 0),
      ),
    ),
    ratingFactors: {
      ...source.ratingFactors,
      foodQuality: Math.max(
        0,
        Math.min(
          100,
          normalizeQuality(tasteRating) * 0.7 +
            normalizeQuality(stallDefinition?.quality ?? dish.quality) * 0.3 +
            (healthImpact ?? 0) * 20,
        ),
      ),
      value: Math.max(25, Math.min(100, 120 - (dish.price / Math.max(1, getArchetype(draft, source).budget)) * 70)),
    },
  };
}
