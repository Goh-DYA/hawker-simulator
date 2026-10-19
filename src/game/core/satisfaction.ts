/**
 * Visit satisfaction scoring: the weights that combine a visit's rating components, the
 * distance-based walking score and the patience-based wait score.
 */
import type { VisitRatingComponents } from "./types";

const WALKING_GRACE_TILES = 20;
const WALKING_CONCERN_TILES = 80;
const WALKING_MINIMUM_SCORE = 20;
const WALKING_PENALTY_PER_TILE = 50 / (WALKING_CONCERN_TILES - WALKING_GRACE_TILES);
/** Share of a guest's patience they spend without the wait counting against the visit. */
export const WAIT_GRACE_PATIENCE_SHARE = 0.4;

/**
 * Weight of each component in a guest's 0-100 visit rating. The weights sum to one, and the
 * simulation sums the weighted components in this key order.
 */
export const VISIT_RATING_WEIGHTS: Readonly<Record<keyof VisitRatingComponents, number>> = {
  foodQuality: 0.3,
  wait: 0.2,
  value: 0.15,
  walking: 0.1,
  comfort: 0.1,
  cleanliness: 0.1,
  ambience: 0.05,
};

/**
 * Scores the distance travelled during a guest's complete centre journey.
 * Routine trips receive generous headroom, while scores below 50 are reserved
 * for journeys longer than roughly eighty tiles.
 *
 * @param distanceTiles - The tiles walked during the visit; a non-finite distance scores the
 *   minimum.
 * @returns The walking score from 20 to 100.
 */
export function walkingSatisfactionScore(distanceTiles: number): number {
  const safeDistance = Number.isFinite(distanceTiles)
    ? Math.max(0, distanceTiles)
    : Number.POSITIVE_INFINITY;
  const distanceBeyondGrace = Math.max(0, safeDistance - WALKING_GRACE_TILES);
  const penalty = distanceBeyondGrace * WALKING_PENALTY_PER_TILE;
  return Math.max(WALKING_MINIMUM_SCORE, Math.min(100, 100 - penalty));
}

/**
 * Scores how long a guest waited, from the patience they had left when the visit was rated.
 *
 * A guest expects some wait at a busy hawker centre, so the first `WAIT_GRACE_PATIENCE_SHARE`
 * of their patience is free; after that the score falls linearly to zero when patience runs out.
 * Scoring the remaining share directly would penalise any wait at all, which kept even a
 * well-run starter layout below a neutral rating.
 *
 * @param patience_remaining_ms - The patience the guest had left; negative values count as zero.
 * @param patience_ms - The guest's full patience; non-positive values count as one millisecond.
 * @returns The wait score from 0 to 100.
 */
export function wait_satisfaction_score(patience_remaining_ms: number, patience_ms: number): number {
  const full_patience_ms = Math.max(1, patience_ms);
  const used_share = 1 - Math.max(0, Math.min(full_patience_ms, patience_remaining_ms)) / full_patience_ms;
  if (used_share <= WAIT_GRACE_PATIENCE_SHARE) return 100;
  return Math.max(0, Math.min(100, ((1 - used_share) / (1 - WAIT_GRACE_PATIENCE_SHARE)) * 100));
}
