/**
 * The launch economy: starting balances, level and reputation caps and the recovery grant;
 * the level curve is owned by `calculateLevel` in `src/game/core/economy.ts`.
 */
import type { EconomyDefinition } from "./types";

/** The launch economy constants. */
export const ECONOMY = {
  startingCash: 4_200,
  startingReputation: 8,
  maxLevel: 20,
  maxReputation: 100,
  minimumVisitEarnings: 2,
  starterRequiredSeats: 4,
  recoveryGrant: 650,
} as const satisfies EconomyDefinition;
