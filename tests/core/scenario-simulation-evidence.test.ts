import { describe, expect, it } from "vitest";

import {
  SCENARIOS,
  type ScenarioId,
} from "../../src/content/strategicGameplay";
import {
  PREPARATION_GAMEPLAY_BY_ID,
  PREPARATION_GAMEPLAY_CATALOGUE,
} from "../../src/content/preparationGameplay";
import {
  advanceSimulation,
  asMoneyCents,
  dispatchCommand,
  startServicePeriod,
  type GameState,
  type GridPoint,
} from "../../src/game/core";
import {
  evaluateScenarioRun,
  type ScenarioEvaluation,
  type ScenarioRunReport,
} from "../../src/game/core/scenarios";
import {
  buildCatalog,
} from "../../src/game/runtime/createHawkerRuntime";
import {
  createScenarioGameState,
} from "../../src/game/runtime/scenarioState";
import {
  buildScenarioRunReport,
  createScenarioRunTelemetry,
  observeScenarioAdvance,
} from "../../src/game/runtime/scenarioTelemetry";

type StrategyKind =
  | "competent-starter"
  | "deliberate-expansion"
  | "service-banks"
  | "perimeter-pods";

interface ExecutedScenarioStrategy {
  readonly scenarioId: ScenarioId;
  readonly strategyId: string;
  readonly layoutSignature: string;
  readonly report: ScenarioRunReport;
  readonly evaluation: ScenarioEvaluation;
}

const AUTHORED_CATALOG = buildCatalog().catalog;
const SEAT_DEFINITION_ID = "item.stacking-stool";
const EXPECTED_SIMULATION_SUMMARIES = {
  "scenario.narrow-aisles": [
    {
      strategyId: "scenario.narrow-aisles:competent-starter",
      arrivals: 46,
      completed: 41,
      zones: { "zone.compact-hall": 34 },
      flow: 0,
      waitMs: 49_900,
      contribution: 17_155,
      preparations: 1,
      score: 66,
      medal: "bronze",
    },
    {
      strategyId: "scenario.narrow-aisles:deliberate-expansion",
      arrivals: 46,
      completed: 46,
      zones: { "zone.compact-hall": 46 },
      flow: 5_633,
      waitMs: 35_150,
      contribution: 18_830,
      preparations: 2,
      score: 88,
      medal: "silver",
    },
    {
      strategyId: "scenario.narrow-aisles:service-banks",
      arrivals: 46,
      completed: 46,
      zones: { "zone.compact-hall": 46 },
      flow: 9_116,
      waitMs: 35_150,
      contribution: 18_530,
      preparations: 2,
      score: 97,
      medal: "gold",
    },
    {
      strategyId: "scenario.narrow-aisles:perimeter-pods",
      arrivals: 46,
      completed: 46,
      zones: { "zone.compact-hall": 46 },
      flow: 8_266,
      waitMs: 36_900,
      contribution: 18_530,
      preparations: 2,
      score: 94,
      medal: "gold",
    },
  ],
  "scenario.split-hall": [
    {
      strategyId: "scenario.split-hall:competent-starter",
      arrivals: 55,
      completed: 55,
      zones: { "zone.west-hall": 34, "zone.east-hall": 21 },
      flow: 10_000,
      waitMs: 22_100,
      contribution: 14_785,
      preparations: 2,
      score: 87,
      medal: "bronze",
    },
    {
      strategyId: "scenario.split-hall:deliberate-expansion",
      arrivals: 55,
      completed: 55,
      zones: { "zone.west-hall": 31, "zone.east-hall": 24 },
      flow: 10_000,
      waitMs: 22_100,
      contribution: 14_785,
      preparations: 2,
      score: 92,
      medal: "silver",
    },
    {
      strategyId: "scenario.split-hall:service-banks",
      arrivals: 55,
      completed: 55,
      zones: { "zone.west-hall": 26, "zone.east-hall": 29 },
      flow: 10_000,
      waitMs: 22_800,
      contribution: 14_785,
      preparations: 2,
      score: 96,
      medal: "gold",
    },
    {
      strategyId: "scenario.split-hall:perimeter-pods",
      arrivals: 55,
      completed: 55,
      zones: { "zone.west-hall": 26, "zone.east-hall": 29 },
      flow: 10_000,
      waitMs: 22_500,
      contribution: 14_785,
      preparations: 2,
      score: 96,
      medal: "gold",
    },
  ],
  "scenario.limited-cash": [
    {
      strategyId: "scenario.limited-cash:competent-starter",
      arrivals: 52,
      completed: 52,
      zones: { "zone.lean-hall": 18 },
      flow: 2_466,
      waitMs: 34_800,
      contribution: 9_140,
      preparations: 1,
      score: 9_140,
      medal: "bronze",
    },
    {
      strategyId: "scenario.limited-cash:deliberate-expansion",
      arrivals: 52,
      completed: 52,
      zones: { "zone.lean-hall": 33 },
      flow: 10_000,
      waitMs: 24_500,
      contribution: 12_705,
      preparations: 3,
      score: 12_705,
      medal: "silver",
    },
    {
      strategyId: "scenario.limited-cash:service-banks",
      arrivals: 52,
      completed: 52,
      zones: { "zone.lean-hall": 52 },
      flow: 10_000,
      waitMs: 20_800,
      contribution: 15_225,
      preparations: 3,
      score: 15_225,
      medal: "gold",
    },
    {
      strategyId: "scenario.limited-cash:perimeter-pods",
      arrivals: 52,
      completed: 52,
      zones: { "zone.lean-hall": 50 },
      flow: 10_000,
      waitMs: 21_300,
      contribution: 15_485,
      preparations: 3,
      score: 15_485,
      medal: "gold",
    },
  ],
  "scenario.menu-diversity": [
    {
      strategyId: "scenario.menu-diversity:competent-starter",
      arrivals: 50,
      completed: 50,
      zones: { "zone.menu-hall": 47 },
      flow: 10_000,
      waitMs: 26_200,
      contribution: 9_075,
      preparations: 2,
      score: 2,
      medal: "bronze",
    },
    {
      strategyId: "scenario.menu-diversity:deliberate-expansion",
      arrivals: 50,
      completed: 50,
      zones: { "zone.menu-hall": 47 },
      flow: 10_000,
      waitMs: 30_350,
      contribution: 12_430,
      preparations: 3,
      score: 3,
      medal: "silver",
    },
    {
      strategyId: "scenario.menu-diversity:service-banks",
      arrivals: 50,
      completed: 50,
      zones: { "zone.menu-hall": 47 },
      flow: 10_000,
      waitMs: 29_200,
      contribution: 11_155,
      preparations: 4,
      score: 4,
      medal: "gold",
    },
    {
      strategyId: "scenario.menu-diversity:perimeter-pods",
      arrivals: 50,
      completed: 50,
      zones: { "zone.menu-hall": 50 },
      flow: 10_000,
      waitMs: 30_350,
      contribution: 11_155,
      preparations: 4,
      score: 4,
      medal: "gold",
    },
  ],
  "scenario.peak-throughput": [
    {
      strategyId: "scenario.peak-throughput:competent-starter",
      arrivals: 89,
      completed: 52,
      zones: { "zone.rush-hall": 38 },
      flow: 650,
      waitMs: 46_700,
      contribution: 20_700,
      preparations: 2,
      score: 52,
      medal: "bronze",
    },
    {
      strategyId: "scenario.peak-throughput:deliberate-expansion",
      arrivals: 89,
      completed: 62,
      zones: { "zone.rush-hall": 48 },
      flow: 2_883,
      waitMs: 49_700,
      contribution: 25_025,
      preparations: 3,
      score: 62,
      medal: "silver",
    },
    {
      strategyId: "scenario.peak-throughput:service-banks",
      arrivals: 89,
      completed: 67,
      zones: { "zone.rush-hall": 59 },
      flow: 4_100,
      waitMs: 49_600,
      contribution: 26_955,
      preparations: 3,
      score: 67,
      medal: "gold",
    },
    {
      strategyId: "scenario.peak-throughput:perimeter-pods",
      arrivals: 89,
      completed: 67,
      zones: { "zone.rush-hall": 47 },
      flow: 3_383,
      waitMs: 47_800,
      contribution: 26_825,
      preparations: 3,
      score: 67,
      medal: "gold",
    },
  ],
} as const satisfies Readonly<Record<ScenarioId, readonly object[]>>;

function candidateSeatPoints(
  state: GameState,
  strategy: StrategyKind,
): readonly GridPoint[] {
  const points: GridPoint[] = [];
  if (strategy !== "perimeter-pods") {
    for (const y of [
      4,
      5,
      6,
      state.map.height - 4,
      state.map.height - 3,
      state.map.height - 2,
    ]) {
      for (let x = 2; x <= state.map.width - 3; x += 1) {
        points.push({ x, y });
      }
    }
  } else {
    for (let y = 4; y <= state.map.height - 3; y += 1) {
      for (const x of [
        2,
        state.map.width - 3,
        3,
        state.map.width - 4,
      ]) {
        points.push({ x, y });
      }
    }
    for (let x = 5; x <= state.map.width - 6; x += 1) {
      points.push({ x, y: state.map.height - 3 });
    }
  }
  return points;
}

function targetSeatCount(
  scenarioId: ScenarioId,
  strategy: StrategyKind,
): number {
  const byStrategy = {
    "competent-starter": {
      "scenario.narrow-aisles": 4,
      "scenario.split-hall": 12,
      "scenario.limited-cash": 2,
      "scenario.menu-diversity": 12,
      "scenario.peak-throughput": 16,
    },
    "deliberate-expansion": {
      "scenario.narrow-aisles": 8,
      "scenario.split-hall": 13,
      "scenario.limited-cash": 6,
      "scenario.menu-diversity": 18,
      "scenario.peak-throughput": 20,
    },
    "service-banks": {
      "scenario.narrow-aisles": 22,
      "scenario.split-hall": 22,
      "scenario.limited-cash": 12,
      "scenario.menu-diversity": 22,
      "scenario.peak-throughput": 40,
    },
    "perimeter-pods": {
      "scenario.narrow-aisles": 22,
      "scenario.split-hall": 22,
      "scenario.limited-cash": 12,
      "scenario.menu-diversity": 22,
      "scenario.peak-throughput": 40,
    },
  } as const;
  return byStrategy[strategy][scenarioId];
}

function configureMenuDiversityBoard(
  state: GameState,
  strategy: StrategyKind,
): GameState {
  const preparationId = (dishId: string): string => {
    const id = state.catalog.dishes[dishId]?.activePreparationId;
    if (!id) throw new Error(`${dishId} has no active preparation.`);
    return id;
  };
  const configured = dispatchCommand(state, {
    type: "set-combo-board",
    board: {
      slots: strategy === "service-banks"
        ? [
            {
              id: "thosai-ice-kacang",
              preparationIds: [
                preparationId("dish.masala-thosai"),
                preparationId("dish.ice-kacang"),
              ],
            },
            {
              id: "thosai-kopi",
              preparationIds: [
                preparationId("dish.masala-thosai"),
                preparationId("dish.kopi"),
              ],
            },
            {
              id: "nasi-ice-kacang",
              preparationIds: [
                preparationId("dish.nasi-lemak"),
                preparationId("dish.ice-kacang"),
              ],
            },
          ]
        : [
        {
          id: "nasi-ice-kacang",
          preparationIds: [
            preparationId("dish.nasi-lemak"),
            preparationId("dish.ice-kacang"),
          ],
        },
        {
          id: "nasi-kopi",
          preparationIds: [
            preparationId("dish.nasi-lemak"),
            preparationId("dish.kopi"),
          ],
        },
        {
          id: "thosai-ice-kacang",
          preparationIds: [
            preparationId("dish.masala-thosai"),
            preparationId("dish.ice-kacang"),
          ],
        },
          ],
    },
  });
  expect(configured.accepted, configured.error).toBe(true);
  return configured.state;
}

function applyStrategy(
  scenarioId: ScenarioId,
  strategy: StrategyKind,
): {
  readonly state: GameState;
  readonly strategyId: string;
  readonly layoutSignature: string;
} {
  let state = createScenarioGameState(scenarioId, AUTHORED_CATALOG);
  const targetSeats = targetSeatCount(scenarioId, strategy);
  let placedSeats = 0;
  for (const point of candidateSeatPoints(state, strategy)) {
    if (placedSeats >= targetSeats) break;
    const result = dispatchCommand(state, {
      type: "place-object",
      objectId: `${strategy}-seat-${placedSeats + 1}`,
      definitionId: SEAT_DEFINITION_ID,
      origin: point,
    });
    if (!result.accepted) continue;
    state = result.state;
    placedSeats += 1;
  }
  expect(placedSeats).toBe(targetSeats);

  const stallObjects = Object.values(state.objects).filter(
    (object) =>
      state.catalog.placeables[object.definitionId]?.kind === "stall",
  );
  for (const [index, object] of stallObjects.entries()) {
    const shouldOpen =
      strategy === "competent-starter" &&
        scenarioId === "scenario.limited-cash"
        ? index === stallObjects.length - 1
        : strategy === "competent-starter" &&
            scenarioId === "scenario.narrow-aisles"
          ? index === 0
        : strategy === "deliberate-expansion" &&
            scenarioId === "scenario.limited-cash"
          ? index === stallObjects.length - 1
        : strategy === "deliberate-expansion" &&
            scenarioId === "scenario.peak-throughput"
          ? index < Math.max(1, stallObjects.length - 1)
        : strategy === "deliberate-expansion" &&
            scenarioId === "scenario.menu-diversity"
          ? object.definitionId !== "stall.tamarind-leaf"
        : strategy === "competent-starter" &&
            scenarioId === "scenario.peak-throughput"
          ? index < Math.max(1, stallObjects.length - 1)
          : true;
    const opened = dispatchCommand(state, {
      type: "set-stall-open",
      objectId: object.id,
      open: shouldOpen,
    });
    expect(opened.accepted).toBe(true);
    state = opened.state;
  }
  if (
    scenarioId === "scenario.menu-diversity" &&
    strategy !== "competent-starter"
  ) {
    state = configureMenuDiversityBoard(state, strategy);
  }
  const routeY = strategy !== "perimeter-pods"
    ? Math.floor(state.map.height / 2)
    : Math.floor(state.map.height / 2) + 1;
  const route = Array.from(
    { length: state.map.width - 2 },
    (_, index) => ({ x: index + 1, y: routeY }),
  );
  const routed = dispatchCommand(state, {
    type: "configure-guest-route",
    points: route,
  });
  if (routed.accepted) state = routed.state;

  const layoutSignature = Object.values(state.objects)
    .filter((object) => object.definitionId === SEAT_DEFINITION_ID)
    .map((object) => `${object.origin.x},${object.origin.y}`)
    .sort()
    .join("|");
  return {
    state,
    strategyId: `${scenarioId}:${strategy}`,
    layoutSignature,
  };
}

function executeScenarioStrategy(
  scenarioId: ScenarioId,
  strategy: StrategyKind,
): ExecutedScenarioStrategy {
  const planned = applyStrategy(scenarioId, strategy);
  let state: GameState = {
    ...planned.state,
    servicePeriod: startServicePeriod(planned.state.servicePeriod),
  };
  let telemetry = createScenarioRunTelemetry(
    scenarioId,
    state.servicePeriod.sequenceId,
    planned.strategyId,
    state,
  );
  for (let elapsedSteps = 0; elapsedSteps < 500; elapsedSteps += 1) {
    if (state.servicePeriod.phase === "debrief") break;
    if (
      strategy === "deliberate-expansion" &&
      scenarioId === "scenario.narrow-aisles" &&
      elapsedSteps === 198
    ) {
      const stalls = Object.values(state.objects).filter(
        (object) =>
          state.catalog.placeables[object.definitionId]?.kind === "stall",
      );
      const closed = dispatchCommand(state, {
        type: "set-stall-open",
        objectId: stalls.at(-1)!.id,
        open: false,
      });
      expect(closed.accepted, closed.error).toBe(true);
      state = closed.state;
    }
    if (
      strategy === "deliberate-expansion" &&
      scenarioId === "scenario.peak-throughput" &&
      elapsedSteps === 100
    ) {
      const stalls = Object.values(state.objects).filter(
        (object) =>
          state.catalog.placeables[object.definitionId]?.kind === "stall",
      );
      const opened = dispatchCommand(state, {
        type: "set-stall-open",
        objectId: stalls.at(-1)!.id,
        open: true,
      });
      expect(opened.accepted, opened.error).toBe(true);
      state = opened.state;
    }
    if (
      strategy === "deliberate-expansion" &&
      scenarioId === "scenario.limited-cash" &&
      elapsedSteps === 80
    ) {
      const stalls = Object.values(state.objects).filter(
        (object) =>
          state.catalog.placeables[object.definitionId]?.kind === "stall",
      );
      const opened = dispatchCommand(state, {
        type: "set-stall-open",
        objectId: stalls[0]!.id,
        open: true,
      });
      expect(opened.accepted, opened.error).toBe(true);
      state = opened.state;
    }
    const before = state;
    state = advanceSimulation(state, 1_000).state;
    telemetry = observeScenarioAdvance(telemetry, before, state);
  }
  expect(state.servicePeriod.phase).toBe("debrief");
  const ratings = state.metrics.visitRatings.filter(
    (rating) =>
      rating.arrivalPeriodSequenceId === state.servicePeriod.sequenceId,
  );
  const report = buildScenarioRunReport({
    scenarioId,
    telemetry,
    state,
    outcome: {
      kind: "terminal-debrief",
      periodSequenceId: state.servicePeriod.sequenceId,
      servedTimeoutIds: ratings
        .filter((rating) => rating.reason === "served-timeout")
        .map((rating) => rating.customerId),
      unservedDepartureIds: ratings
        .filter((rating) => !rating.served)
        .map((rating) => rating.customerId),
    },
  });
  return {
    scenarioId,
    strategyId: planned.strategyId,
    layoutSignature: planned.layoutSignature,
    report,
    evaluation: evaluateScenarioRun(report),
  };
}

function firstScenarioSalePreparation(
  useSelectedVariants: boolean,
): string {
  const scenarioId: ScenarioId = "scenario.narrow-aisles";
  const targetDishId = "dish.nasi-lemak";
  const targetStallId = "stall.coconut-lime";
  let state = createScenarioGameState(scenarioId, AUTHORED_CATALOG);
  const selected = PREPARATION_GAMEPLAY_CATALOGUE.find(
    (preparation) =>
      preparation.dishId === targetDishId &&
      preparation.isDefault !== useSelectedVariants,
  );
  if (!selected) {
    throw new Error(
      `Missing ${useSelectedVariants ? "selected" : "default"} preparation for ${targetDishId}.`,
    );
  }
  const targetDish = state.catalog.dishes[targetDishId];
  const targetStall = state.catalog.placeables[targetStallId];
  if (!targetDish || !targetStall?.stall) {
    throw new Error("Scenario evidence fixture is missing its reviewed menu.");
  }
  state = {
    ...state,
    catalog: {
      ...state.catalog,
      dishes: {
        ...state.catalog.dishes,
        [targetDishId]: {
          ...targetDish,
          activePreparationId: selected.id,
          activeNutritionVariantId: selected.variantId,
          priceCents: asMoneyCents(selected.terms.priceCents),
          ingredientCostCents: asMoneyCents(
            selected.terms.ingredientCostCents,
          ),
          preparationMs: selected.terms.preparationTimeMs,
          servingMs: selected.terms.servingTimeMs,
          eatingMs: selected.terms.eatingTimeMs,
          starRating: selected.terms.starAppeal,
          demandModifierBasisPoints:
            selected.terms.demandModifierBasisPoints,
        },
      },
      placeables: {
        ...state.catalog.placeables,
        [targetStallId]: {
          ...targetStall,
          stall: {
            ...targetStall.stall,
            dishIds: [targetDishId],
            allDishIds: [targetDishId],
          },
        },
      },
    },
  };
  for (const object of Object.values(state.objects)) {
    if (state.catalog.placeables[object.definitionId]?.kind !== "stall") {
      continue;
    }
    state = dispatchCommand(state, {
      type: "set-stall-open",
      objectId: object.id,
      open: object.definitionId === targetStallId,
    }).state;
  }
  state = {
    ...state,
    servicePeriod: startServicePeriod(state.servicePeriod),
  };
  for (let index = 0; index < 120; index += 1) {
    const grossSale = state.periodLedgers[1]?.entries.find(
      (entry) => entry.kind === "gross-sale",
    );
    if (grossSale?.preparationId) return grossSale.preparationId;
    state = advanceSimulation(state, 1_000).state;
  }
  throw new Error("Scenario did not settle a sale inside 120 seconds.");
}

describe("executable scenario balance evidence", () => {
  it.each([
    ["reviewed base", false],
    ["selected variant", true],
  ] as const)(
    "freezes a valid %s preparation ID on normal scenario orders",
    (_label, useSelectedVariants) => {
      const preparationId = firstScenarioSalePreparation(
        useSelectedVariants,
      );
      const preparation = PREPARATION_GAMEPLAY_BY_ID[preparationId];
      expect(preparation).toBeDefined();
      expect(preparation?.isDefault).toBe(!useSelectedVariants);
    },
  );

  it.each(SCENARIOS)(
    "reaches gold with two deterministic layouts in $name",
    (scenario) => {
      const competent = executeScenarioStrategy(
        scenario.id,
        "competent-starter",
      );
      const optimized = executeScenarioStrategy(
        scenario.id,
        "deliberate-expansion",
      );
      const first = executeScenarioStrategy(
        scenario.id,
        "service-banks",
      );
      const second = executeScenarioStrategy(
        scenario.id,
        "perimeter-pods",
      );

      const summaries = [competent, optimized, first, second].map((run) => ({
        strategyId: run.strategyId,
        arrivals: run.report.totalArrivals,
        completed: run.report.completedVisits,
        zones: run.report.completedVisitsByZone,
        flow: run.report.flowBasisPoints,
        waitMs: run.report.medianWaitMs,
        contribution: run.report.contributionCents,
        preparations: run.report.distinctServedPreparations.length,
        score: run.evaluation.score,
        medal: run.evaluation.medal,
      }));
      expect(summaries).toEqual(
        EXPECTED_SIMULATION_SUMMARIES[scenario.id],
      );
      expect(
        competent.evaluation.medal,
        JSON.stringify(competent, null, 2),
      ).toBe("bronze");
      expect(
        optimized.evaluation.medal,
        JSON.stringify(optimized, null, 2),
      ).toBe("silver");
      expect(first.layoutSignature).not.toBe(second.layoutSignature);
      expect(first.evaluation.medal, JSON.stringify(first, null, 2)).toBe(
        "gold",
      );
      expect(second.evaluation.medal, JSON.stringify(second, null, 2)).toBe(
        "gold",
      );
      expect(executeScenarioStrategy(
        scenario.id,
        "service-banks",
      )).toEqual(first);
    },
    120_000,
  );
});
