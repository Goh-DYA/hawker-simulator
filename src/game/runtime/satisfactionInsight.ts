/**
 * Satisfaction tips for the HUD: ranks the visit-rating components by how much each one,
 * weighted as in the core rating, holds the average back, and pairs the weakest with advice.
 */
import { VISIT_RATING_WEIGHTS, type VisitRatingComponents } from "@/src/game/core";

/** A visit-rating component that a tip can address. */
export type SatisfactionFactor = keyof VisitRatingComponents;

/** Advice for one weak rating component: its label, its 0-100 score and the suggested action. */
export interface SatisfactionTip {
  readonly factor: SatisfactionFactor;
  readonly label: string;
  readonly score: number;
  readonly action: string;
}

const FACTOR_GUIDANCE: Readonly<Record<SatisfactionFactor, {
  readonly label: string;
  readonly weight: number;
  readonly action: string;
}>> = {
  foodQuality: {
    label: "Food quality",
    weight: VISIT_RATING_WEIGHTS.foodQuality,
    action: "Choose higher-quality dishes and buy stall mastery upgrades that raise quality.",
  },
  wait: {
    label: "Wait times",
    weight: VISIT_RATING_WEIGHTS.wait,
    action: "Open more stalls, spread popular queues apart, or upgrade service speed and capacity.",
  },
  value: {
    label: "Value",
    weight: VISIT_RATING_WEIGHTS.value,
    action: "Add a lower-cost menu option and choose dishes whose prices better suit visitor budgets.",
  },
  walking: {
    label: "Route efficiency",
    weight: VISIT_RATING_WEIGHTS.walking,
    action: "Clear direct routes between entrances, stalls, seats, tray returns and exits to keep journeys short.",
  },
  comfort: {
    label: "Comfort",
    weight: VISIT_RATING_WEIGHTS.comfort,
    action: "Add enough seating and place fans, lighting or décor near dining tables.",
  },
  cleanliness: {
    label: "Cleanliness",
    weight: VISIT_RATING_WEIGHTS.cleanliness,
    action: "Add visible tray returns and cleaning facilities near dining and exit routes.",
  },
  ambience: {
    label: "Ambience",
    weight: VISIT_RATING_WEIGHTS.ambience,
    action: "Add plants, lighting, fans and décor without narrowing important walking paths.",
  },
};

/**
 * Picks the components with the largest weighted gap to a perfect score.
 *
 * Ties are broken by the lower score and then by label.
 *
 * @param breakdown - The averaged rating components, if any visit has been rated.
 * @param limit - The most tips returned; defaults to 2.
 * @returns The tips, most impactful first, or an empty list when there is no breakdown or the limit
 *   is not positive.
 */
export function deriveSatisfactionTips(
  breakdown: VisitRatingComponents | undefined,
  limit = 2,
): readonly SatisfactionTip[] {
  if (!breakdown || limit <= 0) return [];

  return (Object.keys(FACTOR_GUIDANCE) as SatisfactionFactor[])
    .map((factor) => {
      const guidance = FACTOR_GUIDANCE[factor];
      const score = Math.max(0, Math.min(100, breakdown[factor]));
      return {
        factor,
        label: guidance.label,
        score,
        action: guidance.action,
        impactGap: (100 - score) * guidance.weight,
      };
    })
    .sort((left, right) => right.impactGap - left.impactGap || left.score - right.score || left.label.localeCompare(right.label))
    .slice(0, limit)
    .map((tip) => ({
      factor: tip.factor,
      label: tip.label,
      score: tip.score,
      action: tip.action,
    }));
}
