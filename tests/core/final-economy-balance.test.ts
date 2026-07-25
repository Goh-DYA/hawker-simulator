import { describe, expect, it } from "vitest";

import {
  advanceSimulation,
  asMoneyCents,
  createPeriodLedger,
  dispatchCommand,
  forecastForServicePeriod,
  ledgerReconciliationDeltaCents,
  lockPeriodForecast,
  operatingMargin,
  planNextServicePeriod,
  startServicePeriod,
  type GameState,
  type PeriodLedger,
  type SimulationCatalog,
} from "@/src/game/core";
import {
  PREPARATION_GAMEPLAY_CATALOGUE,
  type PreparationGameplayDefinition,
} from "@/src/content/preparationGameplay";
import {
  buildCatalog,
  freshState,
} from "@/src/game/runtime/createHawkerRuntime";
import { isDishIdUnlockedForMenu } from "@/src/game/runtime/stallMenus";

const VALIDATION_LEVELS = [1, 5, 13, 20] as const;
const STRATEGIES = ["throughput-led", "value-led", "nutrition-led"] as const;
const TOTAL_VALIDATION_SEEDS = 30;
const CONTENT_REPUTATION = 100;
const CORE_REPUTATION = CONTENT_REPUTATION / 20;

type ValidationLevel = typeof VALIDATION_LEVELS[number];
type StrategyId = typeof STRATEGIES[number];

interface StallSelection {
  readonly definitionId: string;
  readonly dishId: string;
  readonly preparation: PreparationGameplayDefinition;
}

interface EconomyRun {
  readonly level: ValidationLevel;
  readonly strategy: StrategyId;
  readonly seed: string;
  readonly periodId: GameState["servicePeriod"]["periodId"];
  readonly marginPercent: number;
  readonly reconciliationDeltaCents: number;
  readonly grossSalesCents: number;
  readonly completedVisits: number;
  readonly abandonedVisits: number;
  readonly setupSignature: string;
  readonly ledger: PeriodLedger;
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function masteryRankForLevel(level: ValidationLevel): 1 | 2 | 4 | 7 {
  if (level >= 20) return 7;
  if (level >= 13) return 4;
  if (level >= 5) return 2;
  return 1;
}

function masteryPointsForRank(rank: 1 | 2 | 4 | 7): number {
  return (rank - 1) ** 2 * 100;
}

function nutritionFit(preparation: PreparationGameplayDefinition): number {
  const intentFit = average(Object.values(preparation.nutritionFitByIntent));
  const conditionFit = average(Object.values(preparation.conditionFitByCondition)) / 5;
  return (intentFit + conditionFit) / 2;
}

function strategyScore(
  strategy: StrategyId,
  preparation: PreparationGameplayDefinition,
): number {
  const terms = preparation.terms;
  if (strategy === "throughput-led") {
    return -(terms.preparationTimeMs + terms.servingTimeMs + terms.eatingTimeMs);
  }
  if (strategy === "value-led") {
    const contributionRate =
      (terms.priceCents - terms.ingredientCostCents) / terms.priceCents;
    // Affordability leads this strategy; contribution breaks close price ties.
    return -terms.priceCents + contributionRate;
  }
  return nutritionFit(preparation);
}

function selectPreparation(
  strategy: StrategyId,
  dishId: string,
  unlockedRank: 1 | 2 | 4 | 7,
): PreparationGameplayDefinition {
  const candidates = PREPARATION_GAMEPLAY_CATALOGUE
    .filter((preparation) => (
      preparation.dishId === dishId &&
      preparation.unlockRank <= unlockedRank
    ))
    .sort((left, right) => {
      const scoreDelta =
        strategyScore(strategy, right) - strategyScore(strategy, left);
      return scoreDelta || left.id.localeCompare(right.id);
    });
  const selected = candidates[0];
  if (!selected) {
    throw new Error(
      `No rank-${unlockedRank} preparation is available for unlocked dish ${dishId}.`,
    );
  }
  return selected;
}

function selectStallMenus(
  catalog: SimulationCatalog,
  strategy: StrategyId,
  level: ValidationLevel,
): readonly StallSelection[] {
  const rank = masteryRankForLevel(level);
  return Object.values(catalog.placeables)
    .filter((definition) => definition.kind === "stall")
    .flatMap((definition): StallSelection[] => {
      const legalDishIds = (definition.stall?.allDishIds ?? definition.stall?.dishIds ?? [])
        .filter((dishId) => isDishIdUnlockedForMenu(dishId, {
          level,
          reputation: CONTENT_REPUTATION,
        }));
      const options = legalDishIds.map((dishId) => ({
        definitionId: definition.id,
        dishId,
        preparation: selectPreparation(strategy, dishId, rank),
      }));
      options.sort((left, right) => {
        const scoreDelta =
          strategyScore(strategy, right.preparation) -
          strategyScore(strategy, left.preparation);
        return scoreDelta || left.preparation.id.localeCompare(right.preparation.id);
      });
      return options[0] ? [options[0]] : [];
    });
}

function withStrategyCatalog(
  base: SimulationCatalog,
  selections: readonly StallSelection[],
): SimulationCatalog {
  const selectionByStall = new Map(
    selections.map((selection) => [selection.definitionId, selection]),
  );
  const preparationByDish = new Map(
    selections.map((selection) => [selection.dishId, selection.preparation]),
  );
  return {
    ...base,
    dishes: Object.fromEntries(
      Object.entries(base.dishes).map(([dishId, dish]) => {
        const preparation = preparationByDish.get(dishId);
        if (!preparation) return [dishId, dish];
        return [dishId, {
          ...dish,
          price: preparation.terms.priceCents / 100,
          priceCents: asMoneyCents(preparation.terms.priceCents),
          ingredientCostCents: asMoneyCents(preparation.terms.ingredientCostCents),
          preparationMs: preparation.terms.preparationTimeMs,
          servingMs: preparation.terms.servingTimeMs,
          eatingMs: preparation.terms.eatingTimeMs,
          starRating: preparation.terms.starAppeal,
          demandModifierBasisPoints: preparation.terms.demandModifierBasisPoints,
          activePreparationId: preparation.id,
          activeNutritionVariantId:
            preparation.variantId ?? dish.defaultNutritionVariantId,
          mealRole: preparation.mealRole,
        }];
      }),
    ),
    placeables: Object.fromEntries(
      Object.entries(base.placeables).map(([definitionId, definition]) => {
        if (!definition.stall) return [definitionId, definition];
        const selection = selectionByStall.get(definitionId);
        if (!selection) return [definitionId, definition];
        return [definitionId, {
          ...definition,
          stall: {
            ...definition.stall,
            dishIds: [selection.dishId],
          },
        }];
      }),
    ),
  };
}

function periodAtIndex(
  initial: GameState["servicePeriod"],
  periodIndex: number,
): GameState["servicePeriod"] {
  let period = initial;
  for (let index = 0; index < periodIndex; index += 1) {
    period = planNextServicePeriod({ ...period, phase: "debrief" });
  }
  return period;
}

function valueStallId(selections: readonly StallSelection[]): string {
  const selected = [...selections].sort((left, right) => {
    const priceDelta =
      left.preparation.terms.priceCents - right.preparation.terms.priceCents;
    if (priceDelta !== 0) return priceDelta;
    const leftRate = (
      left.preparation.terms.priceCents -
      left.preparation.terms.ingredientCostCents
    ) / left.preparation.terms.priceCents;
    const rightRate = (
      right.preparation.terms.priceCents -
      right.preparation.terms.ingredientCostCents
    ) / right.preparation.terms.priceCents;
    return rightRate - leftRate || left.definitionId.localeCompare(right.definitionId);
  })[0];
  if (!selected) throw new Error("The value strategy requires an unlocked starter stall.");
  return selected.definitionId;
}

function initialStrategyPeriod(
  strategy: StrategyId,
  level: ValidationLevel,
  periodIndex: number,
  seed: string,
): { readonly state: GameState; readonly setupSignature: string } {
  const { catalog: authoredCatalog } = buildCatalog();
  const selections = selectStallMenus(authoredCatalog, strategy, level);
  const catalog = withStrategyCatalog(authoredCatalog, selections);
  // Generate the period's optional objective offer from the complete authored
  // catalogue, exactly as the runtime does before a player narrows a menu in
  // planning. The strategy catalogue is applied only after that planning state
  // exists, so an unaccepted offer cannot make a legal one-dish plan invalid.
  const initial = freshState(authoredCatalog, seed);
  const placedStallIds = Object.values(initial.objects)
    .filter((object) => catalog.placeables[object.definitionId]?.kind === "stall")
    .map((object) => object.definitionId)
    .sort();
  const representedSelections = selections.filter((selection) => (
    placedStallIds.includes(selection.definitionId)
  ));
  expect(representedSelections).toHaveLength(placedStallIds.length);

  const rank = masteryRankForLevel(level);
  const progression: GameState["progression"] = {
    ...initial.progression,
    level,
    reputation: CORE_REPUTATION,
    unlockedDefinitionIds: Object.values(catalog.placeables)
      .filter((definition) => (definition.unlockLevel ?? 1) <= level)
      .map((definition) => definition.id)
      .sort(),
    stallMastery: Object.fromEntries(placedStallIds.map((definitionId) => [
      definitionId,
      {
        points: masteryPointsForRank(rank),
        rank,
        upgradeLevel: 1 as const,
      },
    ])),
  };
  for (const selection of representedSelections) {
    expect(isDishIdUnlockedForMenu(selection.dishId, {
      level,
      reputation: CONTENT_REPUTATION,
    })).toBe(true);
    expect(selection.preparation.unlockRank).toBeLessThanOrEqual(rank);
  }

  const onlyOpenStall = strategy === "value-led"
    ? valueStallId(representedSelections)
    : undefined;
  const planningPeriod = periodAtIndex(initial.servicePeriod, periodIndex);
  let planningState: GameState = {
    ...initial,
    catalog,
    progression,
    objects: Object.fromEntries(
      Object.entries(initial.objects).map(([objectId, object]) => {
        const isStall = catalog.placeables[object.definitionId]?.kind === "stall";
        return [objectId, {
          ...object,
          open: isStall
            ? onlyOpenStall === undefined || object.definitionId === onlyOpenStall
            : object.open,
        }];
      }),
    ),
    servicePeriod: planningPeriod,
    forecast: lockPeriodForecast(
      forecastForServicePeriod(planningPeriod),
      catalog,
      progression,
    ),
    forecastArrivals: [],
  };

  if (strategy === "throughput-led") {
    const routed = dispatchCommand(planningState, {
      type: "configure-guest-route",
      points: Array.from({ length: 2 }, (_, index) => ({
        x: index + 1,
        y: planningState.entrance.y,
      })),
    });
    expect(routed.accepted, routed.error).toBe(true);
    planningState = routed.state;
  }

  const servicePeriod = startServicePeriod(planningState.servicePeriod);
  const state: GameState = {
    ...planningState,
    servicePeriod,
    periodLedgers: {
      [servicePeriod.sequenceId]: createPeriodLedger(
        servicePeriod.sequenceId,
        planningState.economy.cashCents,
      ),
    },
  };
  const openStalls = Object.values(state.objects)
    .filter((object) => (
      object.open &&
      catalog.placeables[object.definitionId]?.kind === "stall"
    ))
    .map((object) => object.definitionId)
    .sort();
  const preparationIds = representedSelections
    .map((selection) => selection.preparation.id)
    .sort();
  const setupSignature = JSON.stringify({
    openStalls,
    preparationIds,
    route: state.routeGuidePoints,
  });
  return { state, setupSignature };
}

function executeStrategyPeriod(
  strategy: StrategyId,
  level: ValidationLevel,
  seedIndex: number,
  periodIndex: number,
): EconomyRun {
  const seed = [
    "final-economy",
    strategy,
    `level-${level}`,
    String(seedIndex + 1).padStart(2, "0"),
  ].join(":");
  const setup = initialStrategyPeriod(strategy, level, periodIndex, seed);
  let state = setup.state;
  let guard = 0;
  while (state.servicePeriod.phase !== "debrief" && guard < 120) {
    state = advanceSimulation(state, 4_000).state;
    guard += 1;
  }
  expect(state.servicePeriod.phase, `${strategy} ${level} ${seed}`).toBe("debrief");
  const ledger = state.periodLedgers[state.servicePeriod.sequenceId];
  if (!ledger) throw new Error(`Missing completed ledger for ${strategy} ${level} ${seed}.`);
  const margin = operatingMargin(ledger);
  if (margin === undefined) {
    throw new Error(`No gross sales were produced for ${strategy} ${level} ${seed}.`);
  }
  return {
    level,
    strategy,
    seed,
    periodId: state.servicePeriod.periodId,
    marginPercent: margin * 100,
    reconciliationDeltaCents: ledgerReconciliationDeltaCents(
      ledger,
      state.economy.cashCents,
    ),
    grossSalesCents: ledger.grossSalesCents,
    completedVisits: state.economy.completedVisits,
    abandonedVisits: state.economy.abandonedVisits,
    setupSignature: setup.setupSignature,
    ledger,
  };
}

function percentile(values: readonly number[], proportion: number): number {
  if (values.length === 0) throw new Error("Cannot calculate a percentile without values.");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * proportion) - 1]!;
}

function distribution(values: readonly number[]) {
  return {
    p10: percentile(values, 0.1),
    median: percentile(values, 0.5),
    p90: percentile(values, 0.9),
  };
}

describe("final deterministic economy validation", () => {
  it("meets the 30-seed cross-level strategy margin and reconciliation contract", () => {
    const runs = Array.from({ length: TOTAL_VALIDATION_SEEDS }, (_, seedIndex) => {
      const cellIndex = seedIndex % (VALIDATION_LEVELS.length * STRATEGIES.length);
      const occurrence = Math.floor(
        seedIndex / (VALIDATION_LEVELS.length * STRATEGIES.length),
      );
      const levelIndex = cellIndex % VALIDATION_LEVELS.length;
      const strategyIndex = Math.floor(cellIndex / VALIDATION_LEVELS.length);
      return executeStrategyPeriod(
        STRATEGIES[strategyIndex]!,
        VALIDATION_LEVELS[levelIndex]!,
        seedIndex,
        (levelIndex + strategyIndex + occurrence) % 4,
      );
    });

    expect(runs).toHaveLength(TOTAL_VALIDATION_SEEDS);
    expect(new Set(runs.map((run) => run.seed)).size).toBe(runs.length);
    expect(runs.every((run) => run.reconciliationDeltaCents === 0)).toBe(true);
    expect(runs.every((run) => run.grossSalesCents > 0)).toBe(true);
    expect(runs.every((run) => (
      run.completedVisits + run.abandonedVisits > 0
    ))).toBe(true);

    for (const level of VALIDATION_LEVELS) {
      const levelRuns = runs.filter((run) => run.level === level);
      expect(new Set(levelRuns.map((run) => run.periodId))).toEqual(
        new Set(["breakfast", "lunch", "tea", "evening"]),
      );
      expect(new Set(
        STRATEGIES.map((strategy) => (
          levelRuns.find((run) => run.strategy === strategy)!.setupSignature
        )),
      ).size).toBe(STRATEGIES.length);
    }

    const overall = distribution(runs.map((run) => run.marginPercent));
    const byStrategy = Object.fromEntries(STRATEGIES.map((strategy) => [
      strategy,
      distribution(
        runs
          .filter((run) => run.strategy === strategy)
          .map((run) => run.marginPercent),
      ),
    ])) as Readonly<Record<StrategyId, ReturnType<typeof distribution>>>;
    const evidence = JSON.stringify({ overall, byStrategy }, null, 2);
    console.info(`Final economy balance evidence:\n${evidence}`);

    expect(overall.median, evidence).toBeGreaterThanOrEqual(45);
    expect(overall.median, evidence).toBeLessThanOrEqual(60);
    expect(overall.p10, evidence).toBeGreaterThanOrEqual(25);
    for (const strategy of STRATEGIES) {
      expect(byStrategy[strategy].median, evidence).toBeGreaterThanOrEqual(40);
      expect(byStrategy[strategy].median, evidence).toBeLessThanOrEqual(65);
    }
  }, 900_000);
});
