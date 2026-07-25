import { describe, expect, it } from "vitest";

import {
  PREPARATION_GAMEPLAY_CATALOGUE,
  type PreparationGameplayDefinition,
} from "../../src/content/preparationGameplay";
import {
  SCENARIOS,
  type ScenarioId,
  type ScenarioMedal,
} from "../../src/content/strategicGameplay";
import { getTile } from "../../src/game/core/grid";
import {
  asMoneyCents,
  asMoneyDeltaCents,
} from "../../src/game/core/money";
import { isReachable } from "../../src/game/core/pathfinding";
import {
  NUTRITION_CONTENT,
} from "../../src/content/nutrition";
import {
  SCENARIO_MAPS,
  SCENARIO_TERMINAL_BOUNDARY,
  evaluateScenarioRun,
  getExecutableScenario,
  validateScenarioCatalogue,
  type ScenarioRunReport,
  type ScenarioServedPreparation,
} from "../../src/game/core/scenarios";
import {
  createEmptyMetaProgression,
  createScenarioSession,
  recordScenarioCompletion,
} from "../../src/game/core/strategicProgression";

function servedPreparation(
  preparation: PreparationGameplayDefinition,
): ScenarioServedPreparation {
  return {
    preparationId: preparation.id,
    dishId: preparation.dishId,
    mealRole: preparation.mealRole,
  };
}

function preparationForDish(
  dishId: string,
  preference: "default" | "alternative" = "default",
): ScenarioServedPreparation {
  const family = PREPARATION_GAMEPLAY_CATALOGUE.filter(
    (preparation) => preparation.dishId === dishId,
  );
  const selected = preference === "default"
    ? family.find((preparation) => preparation.isDefault)
    : [...family].reverse().find((preparation) => !preparation.isDefault);
  if (!selected) {
    throw new Error(`Missing ${preference} preparation for ${dishId}.`);
  }
  return servedPreparation(selected);
}

const DIVERSITY_DEFAULTS = [
  "dish.nasi-lemak",
  "dish.kopi",
  "dish.ice-kacang",
  "dish.masala-thosai",
].map((dishId) => preparationForDish(dishId));

function report(input: {
  readonly scenarioId: ScenarioId;
  readonly strategyId: string;
  readonly totalArrivals?: number;
  readonly completedVisits?: number;
  readonly zones?: Readonly<Record<string, number>>;
  readonly flowBasisPoints?: number;
  readonly reachableVisitBasisPoints?: number;
  readonly medianWaitMs?: number;
  readonly grossSalesCents?: number;
  readonly ingredientCostCents?: number;
  readonly paidUpkeepCents?: number;
  readonly refundsCents?: number;
  readonly minimumCashCents?: number;
  readonly recoveryCashCents?: number;
  readonly ledgerReconciliationDeltaCents?: number;
  readonly preparations?: readonly ScenarioServedPreparation[];
}): ScenarioRunReport {
  const grossSalesCents = input.grossSalesCents ?? 30_000;
  const ingredientCostCents = input.ingredientCostCents ?? 9_000;
  const paidUpkeepCents = input.paidUpkeepCents ?? 2_000;
  const refundsCents = input.refundsCents ?? 0;
  return {
    scenarioId: input.scenarioId,
    seed: getExecutableScenario(input.scenarioId).definition.seed,
    completionBoundary: SCENARIO_TERMINAL_BOUNDARY,
    strategyId: input.strategyId,
    totalArrivals: input.totalArrivals ?? 50,
    completedVisits: input.completedVisits ?? 40,
    completedVisitsByZone: input.zones ?? {},
    flowBasisPoints: input.flowBasisPoints ?? 8_000,
    reachableVisitBasisPoints: input.reachableVisitBasisPoints ?? 8_500,
    medianWaitMs: input.medianWaitMs ?? 55_000,
    grossSalesCents: asMoneyCents(grossSalesCents),
    ingredientCostCents: asMoneyCents(ingredientCostCents),
    paidUpkeepCents: asMoneyCents(paidUpkeepCents),
    refundsCents: asMoneyCents(refundsCents),
    contributionCents: asMoneyDeltaCents(
      grossSalesCents -
        ingredientCostCents -
        paidUpkeepCents -
        refundsCents,
    ),
    minimumCashCents: asMoneyDeltaCents(input.minimumCashCents ?? 1_000),
    recoveryCashCents: asMoneyCents(input.recoveryCashCents ?? 0),
    ledgerReconciliationDeltaCents: asMoneyDeltaCents(
      input.ledgerReconciliationDeltaCents ?? 0,
    ),
    distinctServedPreparations: input.preparations ?? [],
  };
}

const BRONZE_RUNS: Readonly<Record<ScenarioId, ScenarioRunReport>> = {
  "scenario.narrow-aisles": report({
    scenarioId: "scenario.narrow-aisles",
    strategyId: "competent-open-spine",
    totalArrivals: 50,
    completedVisits: 36,
    flowBasisPoints: 7_000,
    reachableVisitBasisPoints: 7_500,
    medianWaitMs: 65_000,
  }),
  "scenario.split-hall": report({
    scenarioId: "scenario.split-hall",
    strategyId: "competent-two-zone-service",
    totalArrivals: 50,
    completedVisits: 32,
    zones: {
      "zone.west-hall": 20,
      "zone.east-hall": 12,
    },
    medianWaitMs: 70_000,
  }),
  "scenario.limited-cash": report({
    scenarioId: "scenario.limited-cash",
    strategyId: "competent-lean-setup",
    grossSalesCents: 16_000,
    ingredientCostCents: 5_000,
    paidUpkeepCents: 2_000,
  }),
  "scenario.menu-diversity": report({
    scenarioId: "scenario.menu-diversity",
    strategyId: "competent-three-preparation-menu",
    preparations: [
      DIVERSITY_DEFAULTS[0]!,
      DIVERSITY_DEFAULTS[1]!,
      DIVERSITY_DEFAULTS[3]!,
    ],
  }),
  "scenario.peak-throughput": report({
    scenarioId: "scenario.peak-throughput",
    strategyId: "competent-controlled-rush",
    totalArrivals: 40,
    completedVisits: 30,
    medianWaitMs: 65_000,
  }),
};

const GOLD_RUNS: Readonly<
  Record<ScenarioId, readonly [ScenarioRunReport, ScenarioRunReport]>
> = {
  "scenario.narrow-aisles": [
    report({
      scenarioId: "scenario.narrow-aisles",
      strategyId: "central-spine",
      totalArrivals: 50,
      completedVisits: 49,
      flowBasisPoints: 9_000,
      reachableVisitBasisPoints: 9_500,
      medianWaitMs: 35_000,
    }),
    report({
      scenarioId: "scenario.narrow-aisles",
      strategyId: "paired-side-aisles",
      totalArrivals: 50,
      completedVisits: 48,
      flowBasisPoints: 8_800,
      reachableVisitBasisPoints: 9_200,
      medianWaitMs: 45_000,
    }),
  ],
  "scenario.split-hall": [
    report({
      scenarioId: "scenario.split-hall",
      strategyId: "mirrored-zone-service",
      totalArrivals: 50,
      completedVisits: 48,
      zones: {
        "zone.west-hall": 24,
        "zone.east-hall": 24,
      },
      medianWaitMs: 40_000,
    }),
    report({
      scenarioId: "scenario.split-hall",
      strategyId: "shared-crossing-service",
      totalArrivals: 50,
      completedVisits: 46,
      zones: {
        "zone.west-hall": 22,
        "zone.east-hall": 24,
      },
      medianWaitMs: 50_000,
    }),
  ],
  "scenario.limited-cash": [
    report({
      scenarioId: "scenario.limited-cash",
      strategyId: "value-volume",
      grossSalesCents: 36_000,
      ingredientCostCents: 11_000,
      paidUpkeepCents: 3_000,
      minimumCashCents: 500,
    }),
    report({
      scenarioId: "scenario.limited-cash",
      strategyId: "measured-expansion",
      grossSalesCents: 42_000,
      ingredientCostCents: 13_000,
      paidUpkeepCents: 3_000,
      minimumCashCents: 1_200,
    }),
  ],
  "scenario.menu-diversity": [
    report({
      scenarioId: "scenario.menu-diversity",
      strategyId: "one-from-each-family",
      preparations: DIVERSITY_DEFAULTS,
    }),
    report({
      scenarioId: "scenario.menu-diversity",
      strategyId: "variant-led-spread",
      preparations: [
        preparationForDish("dish.nasi-lemak", "alternative"),
        preparationForDish("dish.kopi", "alternative"),
        preparationForDish("dish.ice-kacang"),
        preparationForDish("dish.masala-thosai"),
      ],
    }),
  ],
  "scenario.peak-throughput": [
    report({
      scenarioId: "scenario.peak-throughput",
      strategyId: "parallel-fast-lines",
      totalArrivals: 60,
      completedVisits: 54,
      medianWaitMs: 50_000,
    }),
    report({
      scenarioId: "scenario.peak-throughput",
      strategyId: "capacity-buffer",
      totalArrivals: 62,
      completedVisits: 56,
      medianWaitMs: 54_000,
    }),
  ],
};

describe("executable scenario catalogue", () => {
  it("has five valid, independently seeded maps and feasible content", () => {
    expect(validateScenarioCatalogue()).toEqual([]);
    expect(SCENARIO_MAPS).toHaveLength(5);
    expect(new Set(SCENARIOS.map((scenario) => scenario.seed)).size).toBe(5);
    expect(
      new Set(SCENARIO_MAPS.map((scenarioMap) => scenarioMap.id)).size,
    ).toBe(5);

    for (const scenario of SCENARIOS) {
      const executable = getExecutableScenario(scenario.id);
      expect(executable.map.id).toBe(scenario.mapId);
      expect(executable.map.planningNotes).toEqual(scenario.planningNotes);
      expect(Number.isSafeInteger(scenario.startingCashCents)).toBe(true);
      expect(scenario.startingCashCents).toBeGreaterThan(0);
      const entrances = executable.map.accessPoints.filter(
        (point) => point.kind === "entrance",
      );
      const exits = executable.map.accessPoints.filter(
        (point) => point.kind === "exit",
      );
      for (const entrance of entrances) {
        expect(getTile(executable.map.grid, entrance.position)).toBe("floor");
        expect(
          exits.some((exit) =>
            isReachable(
              executable.map.grid,
              entrance.position,
              exit.position,
            )
          ),
        ).toBe(true);
      }
    }
  });

  it("keeps Menu Diversity feasible across all three reviewed meal roles", () => {
    const scenario = getExecutableScenario("scenario.menu-diversity").definition;
    expect(scenario.unlockedDishIds).toEqual([
      "dish.nasi-lemak",
      "dish.kopi",
      "dish.ice-kacang",
      "dish.masala-thosai",
    ]);
    expect(new Set(DIVERSITY_DEFAULTS.map((entry) => entry.mealRole))).toEqual(
      new Set(["main", "drink", "side"]),
    );
    expect(scenario.medalThresholds).toEqual({
      bronze: 2,
      silver: 3,
      gold: 4,
    });
  });

  it("keeps every scenario food on reviewed generated nutrition data", () => {
    const profileById = new Map(
      NUTRITION_CONTENT.profiles.map((profile) => [profile.id, profile]),
    );
    const snapshotById = new Map(
      NUTRITION_CONTENT.sourceSnapshots.map((snapshot) => [
        snapshot.id,
        snapshot,
      ]),
    );

    for (const scenario of SCENARIOS) {
      for (const dishId of scenario.unlockedDishIds) {
        const preparations = PREPARATION_GAMEPLAY_CATALOGUE.filter(
          (preparation) => preparation.dishId === dishId,
        );
        expect(preparations.length).toBeGreaterThan(0);
        for (const preparation of preparations) {
          const profile = profileById.get(preparation.profileId);
          expect(profile?.dishId).toBe(dishId);
          expect(preparation.nutritionAudit.status).toBe(profile?.status);
          expect(["released", "unavailable"]).toContain(profile?.status);

          if (profile?.status === "released") {
            const provenance = profile.provenance;
            const snapshot = provenance
              ? snapshotById.get(provenance.snapshotId)
              : undefined;
            expect(provenance).toBeDefined();
            expect(profile.serving).toBeDefined();
            expect(snapshot?.fileName).toBe(provenance?.sourceFile);
            expect(snapshot?.sha256).toBe(provenance?.sourceFileSha256);
            expect(preparation.nutritionAudit).toMatchObject({
              profileId: profile.id,
              status: "released",
              sourceFile: provenance?.sourceFile,
              sourceFileSha256: provenance?.sourceFileSha256,
              sourceRowNumber: provenance?.sourceRowNumber,
              sourceFoodName: provenance?.sourceFoodName,
              sourceRowSha256: provenance?.sourceRowSha256,
              mappingKind: provenance?.mappingKind,
              servingLabel: profile.serving?.label,
            });
          } else if (profile?.status === "unavailable") {
            expect(profile.unavailableReason).toBeDefined();
            expect(
              Object.values(profile.nutrients).every(
                (nutrient) => nutrient.status === "unavailable",
              ),
            ).toBe(true);
          }
        }
      }
    }
  });
});

describe("scenario scoring and medal balance", () => {
  it.each(SCENARIOS.map((scenario) => [scenario.id] as const))(
    "makes bronze attainable with a competent first strategy in %s",
    (scenarioId) => {
      const evaluation = evaluateScenarioRun(BRONZE_RUNS[scenarioId]);
      expect(evaluation.medal).toBe("bronze");
      expect(evaluation.failureCodes).toEqual([]);
      expect(evaluation.metaReward).toMatchObject({
        scope: "meta-progression-only",
        kind: "scenario-cosmetics",
        scenarioId,
        medal: "bronze",
      });
      expect(evaluation.metaReward).not.toHaveProperty("cashCents");
      expect(evaluation.metaReward).not.toHaveProperty("xp");
      expect(evaluation.metaReward).not.toHaveProperty("reputation");
    },
  );

  it.each(SCENARIOS.map((scenario) => [scenario.id] as const))(
    "supports two distinct seeded gold strategies in %s",
    (scenarioId) => {
      const runs = GOLD_RUNS[scenarioId];
      expect(new Set(runs.map((run) => run.strategyId)).size).toBe(2);
      for (const run of runs) {
        const first = evaluateScenarioRun(run);
        const second = evaluateScenarioRun({
          ...run,
          completedVisitsByZone: Object.fromEntries(
            Object.entries(run.completedVisitsByZone).reverse(),
          ),
          distinctServedPreparations: [
            ...run.distinctServedPreparations,
          ].reverse(),
        });
        expect(first).toEqual(second);
        expect(first.medal).toBe("gold");
        expect(first.failureCodes).toEqual([]);
        expect(first.metaReward?.cosmeticIds).toHaveLength(3);
      }
    },
  );

  it("downgrades to the highest medal whose controlled-wait gate is met", () => {
    const evaluation = evaluateScenarioRun(report({
      scenarioId: "scenario.peak-throughput",
      strategyId: "silver-wait-profile",
      totalArrivals: 60,
      completedVisits: 54,
      medianWaitMs: 58_000,
    }));
    expect(evaluation.score).toBeGreaterThanOrEqual(
      getExecutableScenario("scenario.peak-throughput").definition
        .medalThresholds.gold,
    );
    expect(evaluation.medal).toBe("silver");
  });

  it("reports the next medal threshold without inventing unmet constraints", () => {
    const evaluation = evaluateScenarioRun(
      BRONZE_RUNS["scenario.narrow-aisles"],
    );

    expect(evaluation.medal).toBe("bronze");
    expect(evaluation.nextMedal).toEqual({
      medal: "silver",
      threshold: 72,
      scoreShortfall: Math.max(0, 72 - evaluation.score),
      constraintFailureCodes: [],
    });
  });

  it("explains the exact next-medal constraint after its score is met", () => {
    const evaluation = evaluateScenarioRun(report({
      scenarioId: "scenario.narrow-aisles",
      strategyId: "silver-with-gold-score",
      totalArrivals: 50,
      completedVisits: 44,
      flowBasisPoints: 10_000,
      reachableVisitBasisPoints: 10_000,
      medianWaitMs: 0,
    }));

    expect(evaluation.score).toBeGreaterThanOrEqual(86);
    expect(evaluation.medal).toBe("silver");
    expect(evaluation.nextMedal).toEqual({
      medal: "gold",
      threshold: 86,
      scoreShortfall: 0,
      constraintFailureCodes: ["completion-rate-too-low"],
    });
  });

  it("requires progressively stronger completion rates in Narrow Aisles", () => {
    const narrowRun = (completedVisits: number) => report({
      scenarioId: "scenario.narrow-aisles",
      strategyId: `completion-rate-${completedVisits}`,
      totalArrivals: 50,
      completedVisits,
      flowBasisPoints: 10_000,
      reachableVisitBasisPoints: 10_000,
      medianWaitMs: 0,
    });

    const belowBronze = evaluateScenarioRun(narrowRun(34));
    expect(belowBronze.score).toBeGreaterThanOrEqual(
      getExecutableScenario("scenario.narrow-aisles").definition
        .medalThresholds.gold,
    );
    expect(belowBronze).toMatchObject({
      medal: undefined,
      failureCodes: ["completion-rate-too-low"],
      metaReward: undefined,
    });
    expect(evaluateScenarioRun(narrowRun(39)).medal).toBe("bronze");
    expect(evaluateScenarioRun(narrowRun(44)).medal).toBe("silver");
    expect(evaluateScenarioRun(narrowRun(45)).medal).toBe("gold");
  });

  it("does not let balanced but nearly empty Split Hall service earn a medal", () => {
    const evaluation = evaluateScenarioRun(report({
      scenarioId: "scenario.split-hall",
      strategyId: "two-observed-zones-only",
      totalArrivals: 100,
      completedVisits: 2,
      zones: {
        "zone.west-hall": 1,
        "zone.east-hall": 1,
      },
      medianWaitMs: 0,
    }));

    expect(evaluation.score).toBeGreaterThanOrEqual(
      getExecutableScenario("scenario.split-hall").definition
        .medalThresholds.bronze,
    );
    expect(evaluation).toMatchObject({
      medal: undefined,
      failureCodes: ["completion-rate-too-low"],
      metaReward: undefined,
    });
  });

  it.each(SCENARIOS.map((scenario) => [scenario.id] as const))(
    "fails closed when %s has no completed visits or observed service samples",
    (scenarioId) => {
      const evaluation = evaluateScenarioRun({
        ...GOLD_RUNS[scenarioId][0],
        completedVisits: 0,
        completedVisitsByZone: {},
      });

      expect(evaluation.medal).toBeUndefined();
      expect(evaluation.failureCodes).toContain("completion-rate-too-low");
      expect(evaluation.metaReward).toBeUndefined();
    },
  );

  it("fails closed on ledger drift, recovery, and unsupported frozen content", () => {
    const drifted = {
      ...GOLD_RUNS["scenario.limited-cash"][0],
      ledgerReconciliationDeltaCents: asMoneyDeltaCents(1),
    };
    expect(evaluateScenarioRun(drifted)).toMatchObject({
      medal: undefined,
      failureCodes: ["ledger-not-reconciled"],
      metaReward: undefined,
    });

    const recovered = {
      ...GOLD_RUNS["scenario.limited-cash"][0],
      recoveryCashCents: asMoneyCents(100),
    };
    expect(evaluateScenarioRun(recovered)).toMatchObject({
      medal: undefined,
      failureCodes: ["recovery-used"],
      metaReward: undefined,
    });

    expect(() => evaluateScenarioRun({
      ...GOLD_RUNS["scenario.menu-diversity"][0],
      distinctServedPreparations: [
        ...DIVERSITY_DEFAULTS,
        preparationForDish("dish.poached-chicken-rice"),
      ],
    })).toThrow(/not unlocked/);
  });

  it("does not award medals or meta rewards to an in-progress save", () => {
    const partial = {
      ...GOLD_RUNS["scenario.peak-throughput"][0],
      completionBoundary: "in-progress" as const,
    };

    expect(evaluateScenarioRun(partial)).toMatchObject({
      medal: undefined,
      failureCodes: ["scenario-incomplete"],
      metaReward: undefined,
    });
    expect(evaluateScenarioRun(partial).nextMedal).toBeUndefined();
  });

  it("requires the fixed scenario seed", () => {
    expect(() => evaluateScenarioRun({
      ...BRONZE_RUNS["scenario.narrow-aisles"],
      seed: 999,
    })).toThrow(/authored scenario seed/);
  });

  it("never exposes a non-meta reward field for any medal", () => {
    const medals: readonly ScenarioMedal[] = ["bronze", "silver", "gold"];
    for (const scenario of SCENARIOS) {
      const evaluation = evaluateScenarioRun(GOLD_RUNS[scenario.id][0]);
      expect(medals).toContain(evaluation.medal);
      expect(Object.keys(evaluation.metaReward ?? {}).sort()).toEqual([
        "cosmeticIds",
        "kind",
        "medal",
        "scenarioId",
        "scope",
      ]);
    }
  });

  it("records only validated cumulative rewards and preserves a better medal", () => {
    const definition = getExecutableScenario(
      "scenario.narrow-aisles",
    ).definition;
    const session = createScenarioSession(definition);
    const base = {
      main: { cashCents: 123_400, xp: 900 },
      scenarios: {},
      meta: createEmptyMetaProgression(),
    };
    const goldEvaluation = evaluateScenarioRun(
      GOLD_RUNS["scenario.narrow-aisles"][0],
    );
    const gold = recordScenarioCompletion(
      base,
      definition,
      session,
      goldEvaluation,
    );
    expect(gold.main).toBe(base.main);
    expect(gold.meta.scenarioMedals[definition.id]).toBe("gold");
    expect(gold.meta.unlockedCosmeticIds).toEqual(
      [...(goldEvaluation.metaReward?.cosmeticIds ?? [])].sort(),
    );
    expect(gold.scenarios[definition.id]).toMatchObject({
      score: goldEvaluation.score,
      completed: true,
      xp: 0,
    });

    const bronzeEvaluation = evaluateScenarioRun(
      BRONZE_RUNS["scenario.narrow-aisles"],
    );
    const replay = recordScenarioCompletion(
      gold,
      definition,
      session,
      bronzeEvaluation,
    );
    expect(replay.meta.scenarioMedals[definition.id]).toBe("gold");
    expect(replay.meta.unlockedCosmeticIds).toEqual(
      gold.meta.unlockedCosmeticIds,
    );
    expect(() =>
      recordScenarioCompletion(
        base,
        getExecutableScenario("scenario.split-hall").definition,
        session,
        goldEvaluation,
      )
    ).toThrow(/must match/);
  });
});
