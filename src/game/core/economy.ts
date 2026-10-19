/**
 * Economy formulas: the XP level curve, purchases, refunds, expansion pricing, sale
 * settlement (currency, XP, level and reputation) and level-based placeable unlocks.
 *
 * Every function is pure. Invalid XP, levels, costs, prices, refunds and expansion
 * sizes throw a `RangeError`; `canAfford` returns false instead, and `applySale`
 * clamps dish quality and reputation to their ranges.
 */
import { compareIds } from "./ordering";
import type {
  EconomyState,
  GridMap,
  ProgressionState,
  SimulationCatalog,
  SimulationConfig,
} from "./types";

/** XP scale of the level curve: level = 1 + floor(sqrt(xp / XP_LEVEL_DIVISOR)). */
const XP_LEVEL_DIVISOR = 100;
/** Upper bound of the zero-to-five reputation scale. */
export const MAX_REPUTATION = 5;
/** Upper bound of the zero-to-five dish and stall quality scale. */
export const MAX_QUALITY = 5;
/** Share of the purchase price returned when a placeable is sold back. */
const DEFAULT_REFUND_RATE = 0.5;
/** Reputation a new hawker centre starts with. */
export const STARTING_REPUTATION = 2.5;
/**
 * Flat service experience earned per completed sale, on top of the price-scaled XP, so cheap
 * drinks and snacks priced at street rates still advance the level.
 */
const SERVICE_XP_PER_SALE = 2;

/** The economy and progression after a sale, and whether the sale raised the level. */
export interface EconomyUpdate {
  readonly economy: EconomyState;
  readonly progression: ProgressionState;
  readonly levelUp: boolean;
}

/**
 * Returns the total XP needed to reach a level: 100 × (level − 1)².
 *
 * @param level - The level, starting at 1.
 * @returns The XP threshold of that level.
 * @throws RangeError When the level is not a positive integer.
 */
export function xpRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("Level must be a positive integer");
  return XP_LEVEL_DIVISOR * (level - 1) * (level - 1);
}

/**
 * Returns the level reached with an XP total: 1 + ⌊√(xp / 100)⌋.
 *
 * @param xp - The XP total.
 * @returns The level, starting at 1.
 * @throws RangeError When the XP is negative or not finite.
 */
export function calculateLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp < 0) throw new RangeError("XP cannot be negative");
  return 1 + Math.floor(Math.sqrt(xp / XP_LEVEL_DIVISOR));
}

/**
 * Tests whether the economy holds enough currency for a cost.
 *
 * @param economy - The current economy.
 * @param cost - The cost to check.
 * @returns True when the cost is a finite, non-negative amount no greater than the currency.
 */
export function canAfford(economy: EconomyState, cost: number): boolean {
  return Number.isFinite(cost) && cost >= 0 && economy.currency >= cost;
}

/**
 * Deducts a purchase from the currency and adds it to the lifetime spend.
 *
 * @param economy - The current economy.
 * @param cost - The purchase cost.
 * @returns The updated economy.
 * @throws RangeError When the cost is negative or not finite, or the currency is insufficient.
 */
export function applyPurchase(economy: EconomyState, cost: number): EconomyState {
  if (!Number.isFinite(cost) || cost < 0) throw new RangeError("Purchase cost cannot be negative");
  if (!canAfford(economy, cost)) throw new RangeError("Insufficient currency");
  return {
    ...economy,
    currency: economy.currency - cost,
    lifetimeSpend: economy.lifetimeSpend + cost,
  };
}

/**
 * Computes the refund for selling an item back, rounded down.
 *
 * @param purchasePrice - The price the item was bought for.
 * @param refundRate - The share returned, from 0 to 1; defaults to one half.
 * @returns The refund amount.
 * @throws RangeError When the price is negative or the rate is outside 0 to 1.
 */
export function calculateRefund(purchasePrice: number, refundRate = DEFAULT_REFUND_RATE): number {
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) throw new RangeError("Price cannot be negative");
  if (!Number.isFinite(refundRate) || refundRate < 0 || refundRate > 1) {
    throw new RangeError("Refund rate must be between zero and one");
  }
  return Math.floor(purchasePrice * refundRate);
}

/**
 * Adds a refund to the currency. Lifetime spend is not reduced.
 *
 * @param economy - The current economy.
 * @param amount - The refund amount.
 * @returns The updated economy.
 * @throws RangeError When the amount is negative or not finite.
 */
export function applyRefund(economy: EconomyState, amount: number): EconomyState {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Refund cannot be negative");
  return { ...economy, currency: economy.currency + amount };
}

/**
 * Prices a map expansion by the tiles it adds, growing geometrically with each earlier expansion.
 *
 * @param map - The map before expansion.
 * @param progression - The progression, which supplies the number of earlier expansions.
 * @param config - The simulation config, which supplies the base cost per tile and the growth
 *   factor.
 * @param addColumns - The columns to add.
 * @param addRows - The rows to add.
 * @returns The expansion cost, rounded up.
 * @throws RangeError When either value is not a non-negative integer, or the expansion adds no
 *   tiles.
 */
export function calculateExpansionCost(
  map: GridMap,
  progression: ProgressionState,
  config: SimulationConfig,
  addColumns: number,
  addRows: number,
): number {
  if (!Number.isInteger(addColumns) || !Number.isInteger(addRows) || addColumns < 0 || addRows < 0) {
    throw new RangeError("Expansion dimensions must be non-negative integers");
  }
  const addedTiles = (map.width + addColumns) * (map.height + addRows) - map.width * map.height;
  if (addedTiles <= 0) throw new RangeError("Expansion must add at least one tile");
  return Math.ceil(
    addedTiles * config.expansionBaseCostPerTile * config.expansionCostGrowth ** progression.expansionCount,
  );
}

/**
 * Settles a sale: adds the price to the currency and revenue, counts a completed visit, awards XP
 * scaled by dish quality plus the flat service XP, recomputes the level and raises reputation
 * within its bounds.
 *
 * @param economy - The current economy.
 * @param progression - The current progression.
 * @param price - The sale price.
 * @param dishQuality - The dish quality, clamped to 0 to 5 for the XP bonus.
 * @param reputationGain - The reputation change; defaults to 0.02.
 * @returns The updated economy and progression, and whether the level rose.
 * @throws RangeError When the price is negative or not finite.
 */
export function applySale(
  economy: EconomyState,
  progression: ProgressionState,
  price: number,
  dishQuality: number,
  reputationGain = 0.02,
): EconomyUpdate {
  if (!Number.isFinite(price) || price < 0) throw new RangeError("Sale price cannot be negative");
  const normalizedQuality = Math.max(0, Math.min(MAX_QUALITY, dishQuality));
  const xpGain = Math.max(
    1,
    Math.round(price * (1 + normalizedQuality / MAX_QUALITY) + SERVICE_XP_PER_SALE),
  );
  const nextXp = progression.xp + xpGain;
  const nextLevel = calculateLevel(nextXp);
  return {
    economy: {
      ...economy,
      currency: economy.currency + price,
      lifetimeRevenue: economy.lifetimeRevenue + price,
      completedVisits: economy.completedVisits + 1,
    },
    progression: {
      ...progression,
      xp: nextXp,
      level: nextLevel,
      reputation: Math.max(0, Math.min(MAX_REPUTATION, progression.reputation + reputationGain)),
    },
    levelUp: nextLevel > progression.level,
  };
}

/**
 * Lists the placeable definitions unlocked at a level, together with any explicit unlocks.
 *
 * @param catalog - The catalogue of placeables.
 * @param level - The current level.
 * @param explicitUnlocks - IDs unlocked by other means; unknown IDs are dropped.
 * @returns The unlocked IDs, sorted with `compareIds`.
 */
export function getUnlockedDefinitionIds(
  catalog: SimulationCatalog,
  level: number,
  explicitUnlocks: readonly string[] = [],
): readonly string[] {
  const unlocked = new Set(explicitUnlocks);
  for (const definition of Object.values(catalog.placeables)) {
    if ((definition.unlockLevel ?? 1) <= level) unlocked.add(definition.id);
  }
  return [...unlocked].filter((id) => Boolean(catalog.placeables[id])).sort(compareIds);
}
