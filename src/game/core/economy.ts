import {
  addCents,
  asMoneyCents,
  centsToSgd,
  floorRate,
  multiplyByBasisPoints,
  sgdToCents,
  subtractCents,
  ZERO_CENTS,
  type MoneyCents,
} from "./money";
import type {
  EconomyState,
  GridMap,
  PeriodLedger,
  PeriodLedgerEntry,
  PeriodLedgerEntryKind,
  ProgressionState,
  SimulationCatalog,
  SimulationConfig,
} from "./types";

export const AUTHORED_LEVEL_XP_THRESHOLDS = [
  0, 120, 300, 540, 850, 1_250, 1_750, 2_360, 3_100, 3_980,
  5_020, 6_240, 7_660, 9_300, 11_180, 13_320, 15_740, 18_460,
  21_500, 24_880,
] as const;

export const RESALE_NUMERATOR = 70;
export const RESALE_DENOMINATOR = 100;
export const MAX_RECOVERY_GRANT_CENTS = sgdToCents(650);

export interface EconomyUpdate {
  readonly economy: EconomyState;
  readonly progression: ProgressionState;
  readonly levelUp: boolean;
}

export interface ProgressionXpUpdate {
  readonly progression: ProgressionState;
  readonly xpAwarded: number;
  readonly levelUp: boolean;
}

export interface ServedOrderSettlement extends EconomyUpdate {
  /** The only XP granted at handover: the one-time preparation discovery bonus. */
  readonly xpAwarded: number;
  readonly firstServeBonusAwarded: boolean;
  readonly firstServeBonusCount: number;
  readonly firstServedPreparationIds: readonly string[];
}

export interface CompletedVisitAward {
  readonly priceCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
  readonly satisfaction: number;
  readonly preparationId?: string;
  /** Legacy ids that represented this exact preparation before core V6. */
  readonly legacyPreparationIds?: readonly string[];
  readonly reputationGain?: number;
  readonly watchdogTimeout?: boolean;
}

export interface ServedComponentAward {
  readonly priceCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
  readonly preparationId?: string;
  readonly legacyPreparationIds?: readonly string[];
}

export interface ServedComponentsOptions {
  /** Increment the visit counter and apply reputation exactly once per visit. */
  readonly countVisit?: boolean;
  readonly reputationGain?: number;
}

/** Rebuilds compatibility views from canonical cents; callers never mutate aliases. */
export function economyWithCompatibilityAliases(
  value: Omit<EconomyState, "currency" | "lifetimeRevenue" | "lifetimeSpend">,
): EconomyState {
  return {
    ...value,
    currency: centsToSgd(value.cashCents),
    lifetimeRevenue: centsToSgd(value.lifetimeGrossSalesCents),
    lifetimeSpend: centsToSgd(value.lifetimePurchasesCents),
  };
}

export function createEconomyState(cashCents: MoneyCents): EconomyState {
  return economyWithCompatibilityAliases({
    cashCents,
    lifetimeGrossSalesCents: ZERO_CENTS,
    lifetimeIngredientCostsCents: ZERO_CENTS,
    lifetimePurchasesCents: ZERO_CENTS,
    lifetimeRefundsCents: ZERO_CENTS,
    lifetimeResaleCents: ZERO_CENTS,
    lifetimeUpkeepCents: ZERO_CENTS,
    lifetimeObjectiveRewardsCents: ZERO_CENTS,
    lifetimeMilestoneRewardsCents: ZERO_CENTS,
    lifetimeRecoveryCents: ZERO_CENTS,
    completedVisits: 0,
    abandonedVisits: 0,
  });
}

export function xpRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > AUTHORED_LEVEL_XP_THRESHOLDS.length) {
    throw new RangeError(`Level must be between 1 and ${AUTHORED_LEVEL_XP_THRESHOLDS.length}`);
  }
  return AUTHORED_LEVEL_XP_THRESHOLDS[level - 1]!;
}

export function calculateLevel(xp: number): number {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new RangeError("XP must be a non-negative safe integer");
  let level = 1;
  for (let index = 1; index < AUTHORED_LEVEL_XP_THRESHOLDS.length; index += 1) {
    if (xp < AUTHORED_LEVEL_XP_THRESHOLDS[index]!) break;
    level = index + 1;
  }
  return level;
}

export function visitXp(satisfaction: number, watchdogTimeout = false): number {
  if (watchdogTimeout) return 3;
  if (!Number.isFinite(satisfaction)) throw new RangeError("Satisfaction must be finite");
  return 5 + Math.floor(Math.max(0, Math.min(100, satisfaction)) / 20);
}

/**
 * Awards the visit portion of XP once the completed visit has its final rating.
 * Sale price is intentionally absent so progression cannot scale with menu price.
 */
export function awardCompletedVisitXp(
  progression: ProgressionState,
  satisfaction: number,
  watchdogTimeout = false,
): ProgressionXpUpdate {
  const xpAwarded = visitXp(satisfaction, watchdogTimeout);
  const nextXp = progression.xp + xpAwarded;
  const nextLevel = Math.max(progression.level, calculateLevel(nextXp));
  return {
    progression: { ...progression, xp: nextXp, level: nextLevel },
    xpAwarded,
    levelUp: nextLevel > progression.level,
  };
}

export function objectiveRewardCashCents(level: number): MoneyCents {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("Level must be a positive integer");
  return sgdToCents(Math.min(60, 15 + 3 * level));
}

export function objectiveRewardXp(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError("Level must be a positive integer");
  return Math.min(40, 10 + 2 * level);
}

export function canAffordCents(economy: EconomyState, costCents: MoneyCents): boolean {
  return economy.cashCents >= costCents;
}

/** @deprecated Use canAffordCents with explicit canonical cents. */
export function canAfford(economy: EconomyState, cost: number): boolean {
  return canAffordCents(economy, sgdToCents(cost, "Purchase cost"));
}

export function applyPurchaseCents(economy: EconomyState, costCents: MoneyCents): EconomyState {
  if (!canAffordCents(economy, costCents)) throw new RangeError("Insufficient cash");
  return economyWithCompatibilityAliases({
    ...economy,
    cashCents: subtractCents(economy.cashCents, costCents),
    lifetimePurchasesCents: addCents(economy.lifetimePurchasesCents, costCents),
  });
}

/** @deprecated Authored SGD compatibility boundary. */
export function applyPurchase(economy: EconomyState, cost: number): EconomyState {
  return applyPurchaseCents(economy, sgdToCents(cost, "Purchase cost"));
}

export function calculateResaleCents(purchasePriceCents: MoneyCents): MoneyCents {
  return floorRate(purchasePriceCents, RESALE_NUMERATOR, RESALE_DENOMINATOR);
}

/** @deprecated Authored SGD compatibility boundary. */
export function calculateRefund(purchasePrice: number, refundRate = 0.7): number {
  if (!Number.isFinite(refundRate) || refundRate < 0 || refundRate > 1) {
    throw new RangeError("Refund rate must be between zero and one");
  }
  return centsToSgd(floorRate(sgdToCents(purchasePrice, "Price"), Math.round(refundRate * 100), 100));
}

export function applyRefundCents(economy: EconomyState, amountCents: MoneyCents): EconomyState {
  return economyWithCompatibilityAliases({
    ...economy,
    cashCents: addCents(economy.cashCents, amountCents),
    lifetimeRefundsCents: addCents(economy.lifetimeRefundsCents, amountCents),
  });
}

export function applyResaleCents(economy: EconomyState, amountCents: MoneyCents): EconomyState {
  return economyWithCompatibilityAliases({
    ...economy,
    cashCents: addCents(economy.cashCents, amountCents),
    lifetimeResaleCents: addCents(economy.lifetimeResaleCents, amountCents),
  });
}

/** @deprecated Authored SGD compatibility boundary. */
export function applyRefund(economy: EconomyState, amount: number): EconomyState {
  return applyRefundCents(economy, sgdToCents(amount, "Refund"));
}

export function calculateExpansionCostCents(
  map: GridMap,
  progression: ProgressionState,
  config: SimulationConfig,
  addColumns: number,
  addRows: number,
): MoneyCents {
  if (!Number.isInteger(addColumns) || !Number.isInteger(addRows) || addColumns < 0 || addRows < 0) {
    throw new RangeError("Expansion dimensions must be non-negative integers");
  }
  const addedTiles = (map.width + addColumns) * (map.height + addRows) - map.width * map.height;
  if (addedTiles <= 0) throw new RangeError("Expansion must add at least one tile");
  return sgdToCents(Math.ceil(
    addedTiles * config.expansionBaseCostPerTile * config.expansionCostGrowth ** progression.expansionCount,
  ));
}

/** @deprecated Returns authored SGD for compatibility; calculations use cents. */
export function calculateExpansionCost(
  map: GridMap,
  progression: ProgressionState,
  config: SimulationConfig,
  addColumns: number,
  addRows: number,
): number {
  return centsToSgd(calculateExpansionCostCents(map, progression, config, addColumns, addRows));
}

/**
 * Settles sale cash, food cost, and the one-time preparation bonus at handover.
 * Normal visit XP is deliberately deferred until the final completed-visit rating.
 */
export function settleServedOrder(
  economy: EconomyState,
  progression: ProgressionState,
  award: CompletedVisitAward,
): ServedOrderSettlement {
  return settleServedComponents(
    economy,
    progression,
    [{
      priceCents: award.priceCents,
      ingredientCostCents: award.ingredientCostCents,
      preparationId: award.preparationId,
      legacyPreparationIds: award.legacyPreparationIds,
    }],
    { countVisit: true, reputationGain: award.reputationGain },
  );
}

/**
 * Atomically settles one or more served components. Discovery XP is evaluated
 * per exact preparation, while visit accounting is explicitly applied once.
 */
export function settleServedComponents(
  economy: EconomyState,
  progression: ProgressionState,
  components: readonly ServedComponentAward[],
  options: ServedComponentsOptions = {},
): ServedOrderSettlement {
  if (components.length === 0) throw new RangeError("At least one served component is required");
  const firstServed = new Set(progression.firstServedPreparationIds);
  const newlyServedPreparationIds: string[] = [];
  let priceCents = ZERO_CENTS;
  let ingredientCostCents = ZERO_CENTS;
  for (const component of components) {
    if (component.ingredientCostCents > component.priceCents) {
      throw new RangeError("Ingredient cost cannot exceed the settled sale price");
    }
    priceCents = addCents(priceCents, component.priceCents);
    ingredientCostCents = addCents(ingredientCostCents, component.ingredientCostCents);
    if (!component.preparationId) continue;
    const legacyIds = component.legacyPreparationIds ?? [];
    const wasAlreadyServed = firstServed.has(component.preparationId) ||
      legacyIds.some((id) => firstServed.has(id));
    if (!wasAlreadyServed) newlyServedPreparationIds.push(component.preparationId);
    firstServed.add(component.preparationId);
  }
  const xpAwarded = newlyServedPreparationIds.length * 2;
  const nextXp = progression.xp + xpAwarded;
  const nextLevel = Math.max(progression.level, calculateLevel(nextXp));
  const countVisit = options.countVisit ?? true;
  return {
    economy: economyWithCompatibilityAliases({
      ...economy,
      cashCents: asMoneyCents(economy.cashCents + priceCents - ingredientCostCents),
      lifetimeGrossSalesCents: addCents(economy.lifetimeGrossSalesCents, priceCents),
      lifetimeIngredientCostsCents: addCents(
        economy.lifetimeIngredientCostsCents,
        ingredientCostCents,
      ),
      completedVisits: economy.completedVisits + (countVisit ? 1 : 0),
    }),
    progression: {
      ...progression,
      xp: nextXp,
      level: nextLevel,
      reputation: Math.max(
        0,
        Math.min(5, progression.reputation + (countVisit ? options.reputationGain ?? 0.02 : 0)),
      ),
      firstServedPreparationIds: [...firstServed].sort(),
    },
    levelUp: nextLevel > progression.level,
    xpAwarded,
    firstServeBonusAwarded: newlyServedPreparationIds.length > 0,
    firstServeBonusCount: newlyServedPreparationIds.length,
    firstServedPreparationIds: [...newlyServedPreparationIds].sort(),
  };
}

/**
 * Compatibility transaction for callers that already have a final visit rating.
 * Live simulation uses settleServedOrder at handover and awardCompletedVisitXp on exit.
 */
export function applyCompletedVisit(
  economy: EconomyState,
  progression: ProgressionState,
  award: CompletedVisitAward,
): EconomyUpdate {
  const settlement = settleServedOrder(economy, progression, award);
  const completion = awardCompletedVisitXp(
    settlement.progression,
    award.satisfaction,
    award.watchdogTimeout,
  );
  return {
    economy: settlement.economy,
    progression: completion.progression,
    levelUp: settlement.levelUp || completion.levelUp,
  };
}

/** @deprecated Compatibility adapter for legacy sale settlement callers. */
export function applySale(
  economy: EconomyState,
  progression: ProgressionState,
  price: number,
  dishQuality: number,
  reputationGain = 0.02,
): EconomyUpdate {
  return applyCompletedVisit(economy, progression, {
    priceCents: sgdToCents(price, "Sale price"),
    ingredientCostCents: ZERO_CENTS,
    satisfaction: Math.max(0, Math.min(100, dishQuality * 20)),
    reputationGain,
  });
}

export function markAbandonedVisit(economy: EconomyState, progression: ProgressionState): EconomyUpdate {
  return {
    economy: economyWithCompatibilityAliases({
      ...economy,
      abandonedVisits: economy.abandonedVisits + 1,
    }),
    progression: {
      ...progression,
      reputation: Math.max(0, progression.reputation - 0.01),
    },
    levelUp: false,
  };
}

export interface ChargedUpkeep {
  readonly economy: EconomyState;
  readonly requestedCents: MoneyCents;
  readonly paidCents: MoneyCents;
}

/** Upkeep records only the affordable amount and never creates negative cash. */
export function chargeUpkeep(economy: EconomyState, requestedCents: MoneyCents): ChargedUpkeep {
  const paidCents = asMoneyCents(Math.min(economy.cashCents, requestedCents));
  return {
    requestedCents,
    paidCents,
    economy: economyWithCompatibilityAliases({
      ...economy,
      cashCents: subtractCents(economy.cashCents, paidCents),
      lifetimeUpkeepCents: addCents(economy.lifetimeUpkeepCents, paidCents),
    }),
  };
}

export interface RecoveryGrant {
  readonly economy: EconomyState;
  readonly grantedCents: MoneyCents;
  readonly remainingShortfallCents: MoneyCents;
}

export function grantRecovery(
  economy: EconomyState,
  validSetupCostCents: MoneyCents,
): RecoveryGrant {
  const shortfall = asMoneyCents(Math.max(0, validSetupCostCents - economy.cashCents));
  const grantedCents = asMoneyCents(Math.min(shortfall, MAX_RECOVERY_GRANT_CENTS));
  return {
    grantedCents,
    remainingShortfallCents: asMoneyCents(shortfall - grantedCents),
    economy: economyWithCompatibilityAliases({
      ...economy,
      cashCents: addCents(economy.cashCents, grantedCents),
      lifetimeRecoveryCents: addCents(economy.lifetimeRecoveryCents, grantedCents),
    }),
  };
}

export function ingredientCostFromRate(priceCents: MoneyCents, basisPoints: number): MoneyCents {
  return multiplyByBasisPoints(priceCents, basisPoints);
}

export function openStallUpkeepCents(
  objects: Readonly<Record<string, { readonly definitionId: string; readonly open: boolean }>>,
  catalog: SimulationCatalog,
): MoneyCents {
  return asMoneyCents(Object.values(objects).reduce((total, object) => {
    if (!object.open) return total;
    const definition = catalog.placeables[object.definitionId];
    if (definition?.kind !== "stall") return total;
    return total + definition.upkeepCents;
  }, 0));
}

export function createPeriodLedger(
  periodSequenceId: number,
  openingCashCents: MoneyCents = ZERO_CENTS,
): PeriodLedger {
  if (!Number.isSafeInteger(periodSequenceId) || periodSequenceId < 1) {
    throw new RangeError("Period sequence id must be a positive safe integer");
  }
  return {
    periodSequenceId,
    openingCashCents,
    grossSalesCents: ZERO_CENTS,
    ingredientCostsCents: ZERO_CENTS,
    refundsCents: ZERO_CENTS,
    purchasesCents: ZERO_CENTS,
    resaleCents: ZERO_CENTS,
    upkeepCents: ZERO_CENTS,
    objectiveRewardsCents: ZERO_CENTS,
    milestoneRewardsCents: ZERO_CENTS,
    recoveryCents: ZERO_CENTS,
    entries: [],
  };
}

export function recordLedgerEntry(
  ledger: PeriodLedger,
  entry: Omit<PeriodLedgerEntry, "periodSequenceId">,
): PeriodLedger {
  const keyByKind: Record<PeriodLedgerEntryKind, keyof Pick<
    PeriodLedger,
    | "grossSalesCents"
    | "ingredientCostsCents"
    | "refundsCents"
    | "purchasesCents"
    | "resaleCents"
    | "upkeepCents"
    | "objectiveRewardsCents"
    | "milestoneRewardsCents"
    | "recoveryCents"
  >> = {
    "gross-sale": "grossSalesCents",
    "ingredient-cost": "ingredientCostsCents",
    refund: "refundsCents",
    purchase: "purchasesCents",
    resale: "resaleCents",
    upkeep: "upkeepCents",
    "overtime-upkeep": "upkeepCents",
    objective: "objectiveRewardsCents",
    milestone: "milestoneRewardsCents",
    recovery: "recoveryCents",
  };
  const key = keyByKind[entry.kind];
  return {
    ...ledger,
    [key]: addCents(ledger[key], entry.amountCents),
    entries: [...ledger.entries, { ...entry, periodSequenceId: ledger.periodSequenceId }],
  };
}

export function ledgerContributionCents(ledger: PeriodLedger): number {
  return ledger.grossSalesCents - ledger.ingredientCostsCents - ledger.refundsCents - ledger.upkeepCents;
}

export function operatingMargin(ledger: PeriodLedger): number | undefined {
  if (ledger.grossSalesCents === 0) return undefined;
  return (ledger.grossSalesCents - ledger.ingredientCostsCents - ledger.upkeepCents) /
    ledger.grossSalesCents;
}

export function ledgerCashMovementCents(ledger: PeriodLedger): number {
  return ledger.grossSalesCents -
    ledger.ingredientCostsCents -
    ledger.refundsCents -
    ledger.purchasesCents +
    ledger.resaleCents -
    ledger.upkeepCents +
    ledger.objectiveRewardsCents +
    ledger.milestoneRewardsCents +
    ledger.recoveryCents;
}

export function ledgerReconciliationDeltaCents(
  ledger: PeriodLedger,
  currentCashCents?: MoneyCents,
): number {
  const totals = new Map<PeriodLedgerEntryKind, number>();
  for (const entry of ledger.entries) totals.set(entry.kind, (totals.get(entry.kind) ?? 0) + entry.amountCents);
  const entryNet =
    (totals.get("gross-sale") ?? 0) -
    (totals.get("ingredient-cost") ?? 0) -
    (totals.get("refund") ?? 0) -
    (totals.get("purchase") ?? 0) +
    (totals.get("resale") ?? 0) -
    (totals.get("upkeep") ?? 0) -
    (totals.get("overtime-upkeep") ?? 0) +
    (totals.get("objective") ?? 0) +
    (totals.get("milestone") ?? 0) +
    (totals.get("recovery") ?? 0);
  const recordedMovement = ledgerCashMovementCents(ledger);
  const entriesDelta = recordedMovement - entryNet;
  if (currentCashCents === undefined) return entriesDelta;
  const actualMovement = currentCashCents - ledger.openingCashCents;
  return actualMovement - recordedMovement + entriesDelta;
}

export function getUnlockedDefinitionIds(
  catalog: SimulationCatalog,
  level: number,
  explicitUnlocks: readonly string[] = [],
): readonly string[] {
  const unlocked = new Set(explicitUnlocks);
  for (const definition of Object.values(catalog.placeables)) {
    if ((definition.unlockLevel ?? 1) <= level) unlocked.add(definition.id);
  }
  return [...unlocked].filter((id) => Boolean(catalog.placeables[id])).sort();
}
