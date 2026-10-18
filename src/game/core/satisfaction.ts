/**
 * Visit satisfaction scoring: the weights that combine a visit's rating components and the
 * distance-based walking score.
 */
import type { VisitRatingComponents } from "./types";

const WALKING_GRACE_TILES = 20;
const WALKING_CONCERN_TILES = 80;
const WALKING_MINIMUM_SCORE = 20;
const WALKING_PENALTY_PER_TILE = 50 / (WALKING_CONCERN_TILES - WALKING_GRACE_TILES);

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
