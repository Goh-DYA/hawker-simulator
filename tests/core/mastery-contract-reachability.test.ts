import { describe, expect, it } from "vitest";

import {
  MASTERY_CONTRACT_TEMPLATES,
  type MasteryContractTemplate,
  type MasteryMetric,
} from "../../src/content/strategicGameplay";
import { PREPARATION_GAMEPLAY_CATALOGUE } from "../../src/content/preparationGameplay";
import {
  advanceSimulation,
  compareForecastToArrivals,
  createPeriodLedger,
  dispatchCommand,
  forecastForServicePeriod,
  lockPeriodForecast,
  mealComponentsForState,
  planNextServicePeriod,
  asMoneyCents,
  startServicePeriod,
  type GameState,
  type SimulationEvent,
} from "../../src/game/core";
import {
  buildCatalog,
  completedPartyDepartureCounts,
  freshState,
} from "../../src/game/runtime/createHawkerRuntime";

const LEVEL = 13;
const CONTENT_REPUTATION = 100;
const CORE_REPUTATION = CONTENT_REPUTATION / 20;
const MASTERY_RANK = 4;
const PERIOD_COUNT = 4;

interface PeriodWitness {
  readonly periodSequenceId: number;
  readonly completedVisits: number;
  readonly grossSalesCents: number;
  readonly contributionCents: number;
  readonly minimumSatisfaction?: number;
  readonly medianWaitSeconds?: number;
  readonly flowSeconds: number;
  readonly distinctPreparationIds: readonly string[];
  readonly partyVisits: number;
  readonly trayReturns: number;
  readonly trayReturnOpportunities: number;
  readonly forecastNeedsMet: number;
  readonly refundCents: number;
  readonly comboVisits: number;
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

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function countCompletedComboVisits(
  state: GameState,
  periodSequenceId: number,
): number {
  const ledger = state.periodLedgers[periodSequenceId];
  if (!ledger) return 0;
  const lineCountByVisit = new Map<string, number>();
  for (const entry of ledger.entries) {
    if (entry.kind !== "gross-sale" || !entry.visitId) continue;
    lineCountByVisit.set(
      entry.visitId,
      (lineCountByVisit.get(entry.visitId) ?? 0) + 1,
    );
  }
  return [...lineCountByVisit.values()].filter((count) => count >= 2).length;
}

function levelThirteenPlanningState(
  periodIndex: number,
  seed: string,
  configureComboBoard = true,
): GameState {
  const baseCatalog = buildCatalog().catalog;
  const defaultPreparationByDish = new Map(
    Object.keys(baseCatalog.dishes).flatMap((dishId) => {
      const dish = baseCatalog.dishes[dishId]!;
      const candidates = PREPARATION_GAMEPLAY_CATALOGUE
        .filter((preparation) => preparation.dishId === dishId)
        .sort((left, right) =>
          Number(right.variantId === dish.defaultNutritionVariantId) -
            Number(left.variantId === dish.defaultNutritionVariantId) ||
          left.unlockRank - right.unlockRank ||
          left.id.localeCompare(right.id)
        );
      return candidates[0] ? [[dishId, candidates[0]] as const] : [];
    }),
  );
  const catalog = {
    ...baseCatalog,
    dishes: Object.fromEntries(
      Object.entries(baseCatalog.dishes).map(([dishId, dish]) => {
        const preparation = defaultPreparationByDish.get(dishId);
        if (!preparation) return [dishId, dish];
        return [dishId, {
          ...dish,
          activePreparationId: preparation.id,
          activeNutritionVariantId:
            preparation.variantId ?? dish.defaultNutritionVariantId,
          mealRole: preparation.mealRole,
          priceCents: asMoneyCents(preparation.terms.priceCents),
          ingredientCostCents: asMoneyCents(
            preparation.terms.ingredientCostCents,
          ),
          preparationMs: preparation.terms.preparationTimeMs,
          servingMs: preparation.terms.servingTimeMs,
          eatingMs: preparation.terms.eatingTimeMs,
          starRating: preparation.terms.starAppeal,
          demandModifierBasisPoints:
            preparation.terms.demandModifierBasisPoints,
        }];
      }),
    ),
  };
  const initial = freshState(catalog, seed);
  const stallDefinitionIds = Object.values(initial.objects)
    .filter((object) => catalog.placeables[object.definitionId]?.kind === "stall")
    .map((object) => object.definitionId);
  const progression: GameState["progression"] = {
    ...initial.progression,
    level: LEVEL,
    reputation: CORE_REPUTATION,
    unlockedDefinitionIds: [
      ...new Set([
        ...Object.values(catalog.placeables)
          .filter((definition) => (definition.unlockLevel ?? 1) <= LEVEL)
          .map((definition) => definition.id),
        "stall.kopi-canopy",
      ]),
    ].sort(),
    stallMastery: Object.fromEntries(stallDefinitionIds.map((definitionId) => [
      definitionId,
      {
        points: 900,
        rank: MASTERY_RANK,
        upgradeLevel: 1 as const,
      },
    ])),
  };
  const servicePeriod = periodAtIndex(initial.servicePeriod, periodIndex);
  let state: GameState = {
    ...initial,
    progression,
    servicePeriod,
    forecast: lockPeriodForecast(
      forecastForServicePeriod(servicePeriod),
      catalog,
      progression,
    ),
    forecastArrivals: [],
    economy: {
      ...initial.economy,
      cashCents: asMoneyCents(1_000_000),
      currency: 10_000,
    },
  };
  if (
    !Object.values(state.objects).some(
      (object) => object.definitionId === "stall.kopi-canopy",
    )
  ) {
    let placed = false;
    for (let y = 1; y < state.map.height - 3 && !placed; y += 1) {
      for (let x = 1; x < state.map.width - 4 && !placed; x += 1) {
        const result = dispatchCommand(state, {
          type: "place-object",
          objectId: "mastery-witness-kopi",
          definitionId: "stall.kopi-canopy",
          origin: { x, y },
        });
        if (!result.accepted) continue;
        state = result.state;
        placed = true;
      }
    }
    expect(placed).toBe(true);
  }
  for (const stall of Object.values(state.objects).filter(
    (object) => state.catalog.placeables[object.definitionId]?.kind === "stall",
  )) {
    if (stall.open) continue;
    const opened = dispatchCommand(state, {
      type: "set-stall-open",
      objectId: stall.id,
      open: true,
    });
    expect(opened.accepted, opened.error).toBe(true);
    state = opened.state;
  }
  const placedComponents = mealComponentsForState(state, true).filter(
    (component) =>
      component.unlocked &&
      component.stallInstanceIds.length > 0,
  );
  if (configureComboBoard) {
    const mains = placedComponents.filter(
      (component) => component.role === "main",
    );
    const complements = placedComponents.filter(
      (component) => component.role !== "main",
    );
    const offers = mains.flatMap((main) =>
      complements.map((complement) => ({
        id: `mastery-witness-${main.preparationId}-${complement.preparationId}`,
        preparationIds: [
          main.preparationId,
          complement.preparationId,
        ] as const,
      }))
    ).slice(0, 3);
    if (offers.length < 3) {
      throw new Error("The reviewed level-13 layout needs three combo pairs");
    }
    const configured = dispatchCommand(state, {
      type: "set-combo-board",
      board: {
        slots: [offers[0]!, offers[1]!, offers[2]!],
      },
    });
    expect(configured.accepted, configured.error).toBe(true);
    state = configured.state;
  }
  const startedPeriod = startServicePeriod(state.servicePeriod);
  return {
    ...state,
    servicePeriod: startedPeriod,
    periodLedgers: {
      [startedPeriod.sequenceId]: createPeriodLedger(
        startedPeriod.sequenceId,
        state.economy.cashCents,
      ),
    },
  };
}

function executePeriod(
  periodIndex: number,
  options: {
    readonly seed?: string;
    readonly closeAfterSales?: number;
  } = {},
): PeriodWitness {
  let state = levelThirteenPlanningState(
    periodIndex,
    options.seed ?? `mastery-reachability:period-${periodIndex + 1}`,
    options.closeAfterSales === undefined,
  );
  const periodSequenceId = state.servicePeriod.sequenceId;
  const completedBefore = state.economy.completedVisits;
  const flowBefore = state.metrics.qualifyingFlowMs;
  const trayReturnsBefore = state.metrics.trayReturns;
  const trayOpportunitiesBefore = state.metrics.trayReturnOpportunities;
  const events: SimulationEvent[] = [];
  let serviceLimited = false;
  for (let step = 0; step < 2_000; step += 1) {
    if (state.servicePeriod.phase === "debrief") break;
    if (
      !serviceLimited &&
      options.closeAfterSales !== undefined &&
      (
        state.periodLedgers[periodSequenceId]?.entries.filter(
          (entry) => entry.kind === "gross-sale",
        ).length ?? 0
      ) >= options.closeAfterSales
    ) {
      for (const stall of Object.values(state.objects).filter(
        (object) =>
          object.open &&
          state.catalog.placeables[object.definitionId]?.kind === "stall",
      )) {
        const closed = dispatchCommand(state, {
          type: "set-stall-open",
          objectId: stall.id,
          open: false,
        });
        expect(closed.accepted, closed.error).toBe(true);
        state = closed.state;
      }
      serviceLimited = true;
    }
    const result = advanceSimulation(
      state,
      options.closeAfterSales === undefined ? 1_000 : 250,
    );
    state = result.state;
    events.push(...result.events);
  }
  expect(state.servicePeriod.phase).toBe("debrief");
  const ledger = state.periodLedgers[periodSequenceId];
  if (!ledger) throw new Error(`Missing period ${periodSequenceId} ledger`);
  const ratings = state.metrics.visitRatings.filter(
    (rating) =>
      rating.arrivalPeriodSequenceId === periodSequenceId &&
      rating.served &&
      rating.reason !== "served-timeout",
  );
  const waits = ratings.flatMap((rating) =>
    rating.waitMs === undefined ? [] : [rating.waitMs / 1_000]
  );
  const preparationIds = ledger.entries
    .filter((entry) => entry.kind === "gross-sale")
    .flatMap((entry) => entry.preparationId ? [entry.preparationId] : []);
  const comparison = compareForecastToArrivals(
    state.forecast!,
    state.forecastArrivals,
  );
  return {
    periodSequenceId,
    completedVisits: state.economy.completedVisits - completedBefore,
    grossSalesCents: ledger.grossSalesCents,
    contributionCents:
      ledger.grossSalesCents -
      ledger.ingredientCostsCents -
      ledger.upkeepCents,
    ...(ratings.length === 0
      ? {}
      : { minimumSatisfaction: Math.min(...ratings.map((rating) => rating.score)) }),
    ...(median(waits) === undefined ? {} : { medianWaitSeconds: median(waits) }),
    flowSeconds: Math.floor(
      (state.metrics.qualifyingFlowMs - flowBefore) / 1_000,
    ),
    distinctPreparationIds: [...new Set(preparationIds)].sort(),
    partyVisits: completedPartyDepartureCounts(events).partyVisits,
    trayReturns: state.metrics.trayReturns - trayReturnsBefore,
    trayReturnOpportunities:
      state.metrics.trayReturnOpportunities - trayOpportunitiesBefore,
    forecastNeedsMet: comparison.nutritionMatches,
    refundCents: ledger.refundsCents,
    comboVisits: countCompletedComboVisits(state, periodSequenceId),
  };
}

function sum(
  witnesses: readonly PeriodWitness[],
  field:
    | "completedVisits"
    | "grossSalesCents"
    | "contributionCents"
    | "flowSeconds"
    | "partyVisits"
    | "forecastNeedsMet"
    | "comboVisits",
): number {
  return witnesses.reduce((total, witness) => total + witness[field], 0);
}

function masteryWitnessValue(
  metric: MasteryMetric,
  durationPeriods: number,
  serviceWitnesses: readonly PeriodWitness[],
  guardrailWitnesses: readonly PeriodWitness[],
): number {
  const periods = serviceWitnesses.slice(0, durationPeriods);
  switch (metric) {
    case "completed-visits":
      return sum(periods, "completedVisits");
    case "gross-sales-cents":
      return sum(periods, "grossSalesCents");
    case "contribution-cents":
      return sum(periods, "contributionCents");
    case "minimum-satisfaction":
      return Math.min(
        ...guardrailWitnesses.map(
          (witness) => witness.minimumSatisfaction ?? 0,
        ),
      );
    case "maximum-median-wait-seconds":
      return Math.max(
        ...guardrailWitnesses.map(
          (witness) => witness.medianWaitSeconds ?? Number.POSITIVE_INFINITY,
        ),
      );
    case "flow-seconds":
      return sum(periods, "flowSeconds");
    case "distinct-preparations":
      return new Set(
        periods.flatMap((witness) => witness.distinctPreparationIds),
      ).size;
    case "party-visits":
      return sum(periods, "partyVisits");
    case "tray-return-rate-percent": {
      const returns = guardrailWitnesses.reduce(
        (total, witness) => total + witness.trayReturns,
        0,
      );
      const opportunities = guardrailWitnesses.reduce(
        (total, witness) => total + witness.trayReturnOpportunities,
        0,
      );
      return opportunities === 0 ? 0 : (returns * 100) / opportunities;
    }
    case "forecast-needs-met":
      return sum(periods, "forecastNeedsMet");
    case "periods-without-refund":
      return periods.filter(
        (witness) =>
          witness.refundCents === 0 &&
          (witness.completedVisits > 0 || witness.grossSalesCents > 0),
      ).length;
    case "combo-visits":
      return sum(periods, "comboVisits");
  }
}

describe("level-13 mastery contract reachability", () => {
  it("grounds all twelve templates in production service telemetry or authored capacity", () => {
    const witnesses = Array.from(
      { length: PERIOD_COUNT },
      (_, index) => executePeriod(index),
    );
    const guardrailWitnesses = Array.from(
      { length: 3 },
      (_, index) => executePeriod(index, {
        seed: `mastery-guardrail:period-${index + 1}`,
        closeAfterSales: 4,
      }),
    );
    const actualBounds = Object.fromEntries(
      MASTERY_CONTRACT_TEMPLATES.map((template) => [
        template.target.metric,
        masteryWitnessValue(
          template.target.metric,
          template.durationPeriods,
          witnesses,
          guardrailWitnesses,
        ),
      ]),
    ) as Readonly<Record<MasteryMetric, number>>;

    console.info(JSON.stringify({
      witnesses,
      guardrailWitnesses,
      actualBounds,
    }, null, 2));
    expect(MASTERY_CONTRACT_TEMPLATES).toHaveLength(12);
    expect(Object.keys(actualBounds)).toHaveLength(12);
    expect(new Set(
      MASTERY_CONTRACT_TEMPLATES.map((template) => template.target.metric),
    ).size).toBe(12);

    for (
      const template of MASTERY_CONTRACT_TEMPLATES as
        readonly MasteryContractTemplate[]
    ) {
      const metric = template.target.metric;
      const value = actualBounds[metric];
      if (metric === "maximum-median-wait-seconds") {
        expect(
          value,
          `${template.title} witness ${value} must not exceed ${template.target.value}`,
        ).toBeLessThanOrEqual(template.target.value);
      } else {
        expect(
          value,
          `${template.title} witness ${value} must reach ${template.target.value}`,
        ).toBeGreaterThanOrEqual(template.target.value);
      }
      if (template.qualification?.minimumCompletedVisitsPerPeriod) {
        expect(
          guardrailWitnesses.every(
            (witness) =>
              witness.completedVisits >=
                template.qualification!.minimumCompletedVisitsPerPeriod!,
          ),
          `${template.title} must meet its completed-visit floor every period`,
        ).toBe(true);
      }
      if (
        template.qualification
          ?.minimumTrayReturnOpportunitiesPerPeriod
      ) {
        expect(
          guardrailWitnesses.every(
            (witness) =>
              witness.trayReturnOpportunities >=
                template.qualification!
                  .minimumTrayReturnOpportunitiesPerPeriod!,
          ),
          `${template.title} must meet its tray sample floor every period`,
        ).toBe(true);
      }
    }
  }, 30_000);
});
