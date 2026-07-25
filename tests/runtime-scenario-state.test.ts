import { describe, expect, it } from "vitest";

import {
  SCENARIOS,
  type ScenarioId,
} from "../src/content/strategicGameplay";
import {
  forecastForServicePeriod,
  getExecutableScenario,
  serializeGameState,
  type GameState,
  type VisitRating,
  validateWorldNavigationAccess,
} from "../src/game/core";
import {
  constrainScenarioGameState,
  createScenarioGameState,
  getScenarioRuntimeSetup,
  isScenarioRunComplete,
  restoreScenarioRuntimeEnvelope,
} from "../src/game/runtime/scenarioState";
import { buildCatalog } from "../src/game/runtime/createHawkerRuntime";
import {
  createRuntimeSaveEnvelopeV5,
} from "../src/game/persistence/runtimeEnvelope";
import { NUTRITION_CONTENT } from "../src/content/nutrition";
import {
  createScenarioRunTelemetry,
} from "../src/game/runtime/scenarioTelemetry";

describe("Stage 5 scenario runtime state", () => {
  const authoredCatalog = buildCatalog().catalog;

  it.each(SCENARIOS)(
    "creates executable isolated state for $name",
    (definition) => {
      const state = createScenarioGameState(definition.id, authoredCatalog);
      const setup = getScenarioRuntimeSetup(definition.id, authoredCatalog);
      const executable = getExecutableScenario(definition.id);

      expect(state.schemaVersion).toBe(7);
      expect(state.rngState).toBe(definition.seed);
      expect(state.arrivalSamplingSeed).toBeTypeOf("number");
      expect(state.economy.cashCents).toBe(definition.startingCashCents);
      expect(Number.isSafeInteger(state.economy.cashCents)).toBe(true);
      expect(state.map).toEqual(executable.map.grid);
      expect(state.map.tileSize).toBe(48);
      expect(state.accessPoints).toEqual(executable.map.accessPoints);
      expect(isScenarioRunComplete(state)).toBe(false);
      expect(Object.values(state.objects)).toEqual(setup.initialObjects);
      expect(
        validateWorldNavigationAccess(
          state.map,
          state.accessPoints,
          state.objects,
          state.catalog,
        ),
      ).toBeUndefined();

      expect(state.progression.unlockedDefinitionIds).toEqual(
        setup.unlocks.placeableDefinitionIds,
      );
      expect(
        Object.values(state.catalog.placeables)
          .filter((placeable) => placeable.kind === "stall")
          .filter((placeable) =>
            state.progression.unlockedDefinitionIds.includes(placeable.id)
          )
          .map((placeable) => placeable.id)
          .sort(),
      ).toEqual([...definition.unlockedStallIds].sort());

      const scenarioMenuDishes = new Set(
        definition.unlockedStallIds.flatMap((stallId) =>
          state.catalog.placeables[stallId]?.stall?.dishIds ?? []
        ),
      );
      expect([...scenarioMenuDishes].sort()).toEqual(
        [...definition.unlockedDishIds].sort(),
      );
      for (const dishId of definition.unlockedDishIds) {
        const dish = state.catalog.dishes[dishId];
        expect(dish?.activePreparationId).toBe(setup.activePreparationIds[dishId]);
        expect(dish?.mealRole).toMatch(/^(main|side|drink)$/);
        expect(Number.isSafeInteger(dish?.priceCents)).toBe(true);
        expect(Number.isSafeInteger(dish?.ingredientCostCents)).toBe(true);
      }
      const allowedDishes = new Set<string>(definition.unlockedDishIds);
      for (const dish of Object.values(state.catalog.dishes)) {
        expect(dish.unlockLevel).toBe(
          allowedDishes.has(dish.id) ? 1 : Number.MAX_SAFE_INTEGER,
        );
      }

      const demandBasisPoints =
        definition.modifiers.kind === "narrow-aisles" ||
          definition.modifiers.kind === "peak-throughput"
          ? definition.modifiers.arrivalBasisPoints
          : 10_000;
      const authoredDemand = forecastForServicePeriod(
        state.servicePeriod,
      ).demandRange;
      expect(state.forecast.demandRange).toEqual(
        authoredDemand.map((value) =>
          Math.floor((value * demandBasisPoints + 5_000) / 10_000)
        ),
      );
    },
  );

  it("uses exactly the authored four-fixture Limited Cash setup", () => {
    const scenarioId: ScenarioId = "scenario.limited-cash";
    const state = createScenarioGameState(scenarioId, authoredCatalog);
    const fixtureCount = getExecutableScenario(scenarioId).definition.modifiers;

    expect(fixtureCount.kind).toBe("limited-cash");
    if (fixtureCount.kind !== "limited-cash") {
      throw new Error("Expected Limited Cash modifiers.");
    }
    expect(Object.keys(state.objects)).toHaveLength(
      fixtureCount.startingFixtures,
    );
    expect(Object.values(state.objects).filter((object) =>
      state.catalog.placeables[object.definitionId]?.kind === "stall"
    )).toHaveLength(2);
  });

  it("ends a scenario at the first completed-period debrief", () => {
    const state = createScenarioGameState(
      "scenario.limited-cash",
      authoredCatalog,
    );
    expect(isScenarioRunComplete({
      ...state,
      servicePeriod: {
        ...state.servicePeriod,
        phase: "debrief",
      },
    })).toBe(true);
    expect(isScenarioRunComplete({
      ...state,
      servicePeriod: {
        ...state.servicePeriod,
        sequenceId: 2,
        phase: "debrief",
      },
    })).toBe(false);
  });

  it.each(SCENARIOS)(
    "restores $name fixed menus and unlocks after progression changes",
    (definition) => {
      const state = createScenarioGameState(definition.id, authoredCatalog);
      const scenarioStallIds = new Set<string>(definition.unlockedStallIds);
      const foreignStallId = Object.values(state.catalog.placeables).find(
        (placeable) =>
          placeable.kind === "stall" &&
          !scenarioStallIds.has(placeable.id),
      )?.id;
      expect(foreignStallId).toBeDefined();
      const scenarioStallId = definition.unlockedStallIds[0]!;
      const tampered = {
        ...state,
        catalog: {
          ...state.catalog,
          placeables: {
            ...state.catalog.placeables,
            [scenarioStallId]: {
              ...state.catalog.placeables[scenarioStallId]!,
              stall: {
                ...state.catalog.placeables[scenarioStallId]!.stall!,
                dishIds: ["dish.black-pepper-crab"],
                allDishIds: ["dish.black-pepper-crab"],
              },
            },
          },
        },
        progression: {
          ...state.progression,
          level: 20,
          xp: 999_999,
          unlockedDefinitionIds: [
            ...state.progression.unlockedDefinitionIds,
            foreignStallId!,
          ],
        },
      };

      const constrained = constrainScenarioGameState(
        definition.id,
        tampered,
        authoredCatalog,
      );
      const setup = getScenarioRuntimeSetup(definition.id, authoredCatalog);
      expect(constrained.progression.level).toBe(20);
      expect(constrained.progression.xp).toBe(999_999);
      expect(constrained.progression.unlockedDefinitionIds).toEqual(
        setup.unlocks.placeableDefinitionIds,
      );
      expect(
        constrained.catalog.placeables[scenarioStallId]?.stall?.dishIds,
      ).toEqual(setup.stallMenus[scenarioStallId]);
      expect(
        constrained.catalog.placeables[foreignStallId!]?.unlockLevel,
      ).toBe(Number.MAX_SAFE_INTEGER);
      expect(
        constrainScenarioGameState(
          definition.id,
          constrained,
          authoredCatalog,
        ).forecast.demandRange,
      ).toEqual(constrained.forecast.demandRange);
    },
  );

  it.each(SCENARIOS)(
    "round-trips $name through a validated Runtime V5 scenario envelope",
    (definition) => {
      const state = createScenarioGameState(definition.id, authoredCatalog);
      const setup = getScenarioRuntimeSetup(definition.id, authoredCatalog);
      const scenarioTelemetry = createScenarioRunTelemetry(
        definition.id,
        state.servicePeriod.sequenceId,
        `test-${definition.id}`,
        state,
      );
      const payload = createRuntimeSaveEnvelopeV5({
        core: serializeGameState(state),
        stallMenus: setup.stallMenus,
        nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
        activeDishVariants: setup.activeDishVariants,
        periodOutcomes: { scenarioId: definition.id, score: 0 },
        scenarioTelemetry,
      });

      const restored = restoreScenarioRuntimeEnvelope(
        definition.id,
        payload,
        authoredCatalog,
      );
      expect(restored.state).toEqual(state);
      expect(restored.catalog).toBe(restored.state.catalog);
      expect(restored.stallMenus).toEqual(setup.stallMenus);
      expect(restored.activeDishVariants).toEqual(
        setup.activeDishVariants,
      );
      expect(restored.recoveredLegacySelections).toBe(false);
      expect(restored.periodOutcomes).toEqual({
        scenarioId: definition.id,
        score: 0,
      });
      expect(restored.scenarioTelemetry).toEqual(scenarioTelemetry);
    },
  );

  it("rejects a completed save whose required telemetry is missing or stale", () => {
    const scenarioId: ScenarioId = "scenario.split-hall";
    const initial = createScenarioGameState(scenarioId, authoredCatalog);
    const setup = getScenarioRuntimeSetup(scenarioId, authoredCatalog);
    const completed = {
      ...initial,
      servicePeriod: {
        ...initial.servicePeriod,
        phase: "debrief" as const,
        arrivalElapsedMs: 240_000,
      },
    };
    const withoutTelemetry = createRuntimeSaveEnvelopeV5({
      core: serializeGameState(completed),
      stallMenus: setup.stallMenus,
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      activeDishVariants: setup.activeDishVariants,
      periodOutcomes: {},
    });
    expect(() =>
      restoreScenarioRuntimeEnvelope(
        scenarioId,
        withoutTelemetry,
        authoredCatalog,
      )
    ).toThrow(/missing valid scenario telemetry/);

    const staleTelemetry = createScenarioRunTelemetry(
      scenarioId,
      completed.servicePeriod.sequenceId,
      "stale-completed-run",
      initial,
    );
    const withStaleTelemetry = createRuntimeSaveEnvelopeV5({
      core: serializeGameState(completed),
      stallMenus: setup.stallMenus,
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      activeDishVariants: setup.activeDishVariants,
      periodOutcomes: {},
      scenarioTelemetry: staleTelemetry,
    });
    expect(() =>
      restoreScenarioRuntimeEnvelope(
        scenarioId,
        withStaleTelemetry,
        authoredCatalog,
      )
    ).toThrow(/incomplete or stale scenario telemetry/);
  });

  it("restores a completed save only with current bound telemetry", () => {
    const scenarioId: ScenarioId = "scenario.split-hall";
    const initial = createScenarioGameState(scenarioId, authoredCatalog);
    const setup = getScenarioRuntimeSetup(scenarioId, authoredCatalog);
    const completed = {
      ...initial,
      servicePeriod: {
        ...initial.servicePeriod,
        phase: "debrief" as const,
        arrivalElapsedMs: 240_000,
      },
    };
    const telemetry = createScenarioRunTelemetry(
      scenarioId,
      completed.servicePeriod.sequenceId,
      "completed-run",
      completed,
    );
    const payload = createRuntimeSaveEnvelopeV5({
      core: serializeGameState(completed),
      stallMenus: setup.stallMenus,
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      activeDishVariants: setup.activeDishVariants,
      periodOutcomes: {},
      scenarioTelemetry: telemetry,
    });

    expect(
      restoreScenarioRuntimeEnvelope(
        scenarioId,
        payload,
        authoredCatalog,
      ).scenarioTelemetry,
    ).toEqual(telemetry);
  });

  it("accepts complete telemetry that outlives the core rating history window", () => {
    const scenarioId: ScenarioId = "scenario.limited-cash";
    const initial = createScenarioGameState(scenarioId, authoredCatalog);
    const setup = getScenarioRuntimeSetup(scenarioId, authoredCatalog);
    const retainedRatings: VisitRating[] = Array.from(
      { length: 50 },
      (_, index) => ({
        customerId: `guest-${index + 2}`,
        walkingMetricVersion: 2,
        score: 80,
        served: true,
        abandoned: false,
        reason: "served",
        components: {
          foodQuality: 80,
          wait: 80,
          value: 80,
          walking: 80,
          comfort: 80,
          cleanliness: 80,
          ambience: 80,
        },
        waitMs: 20_000 + index,
        day: 1,
        arrivalPeriodSequenceId: 1,
      }),
    );
    const completed: GameState = {
      ...initial,
      servicePeriod: {
        ...initial.servicePeriod,
        phase: "debrief",
        arrivalElapsedMs: 240_000,
      },
      metrics: {
        ...initial.metrics,
        spawnedCustomers: 51,
        despawnedCustomers: 51,
        completedCustomers: 51,
        visitRatings: retainedRatings,
      },
    };
    const observed = createScenarioRunTelemetry(
      scenarioId,
      completed.servicePeriod.sequenceId,
      "history-window-run",
      completed,
    );
    const telemetry = {
      ...observed,
      processedRatingKeys: [
        ...observed.processedRatingKeys,
        "1:guest-1",
      ].sort(),
      completedVisitIds: [
        ...observed.completedVisitIds,
        "guest-1",
      ].sort(),
      waitSamplesMs: [...observed.waitSamplesMs, 19_999],
    };
    const payload = createRuntimeSaveEnvelopeV5({
      core: serializeGameState(completed),
      stallMenus: setup.stallMenus,
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      activeDishVariants: setup.activeDishVariants,
      periodOutcomes: {},
      scenarioTelemetry: telemetry,
    });

    expect(
      restoreScenarioRuntimeEnvelope(
        scenarioId,
        payload,
        authoredCatalog,
      ).scenarioTelemetry?.completedVisitIds,
    ).toHaveLength(51);

    const phantomCompletionPayload = createRuntimeSaveEnvelopeV5({
      core: serializeGameState(completed),
      stallMenus: setup.stallMenus,
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      activeDishVariants: setup.activeDishVariants,
      periodOutcomes: {},
      scenarioTelemetry: {
        ...telemetry,
        completedVisitIds: [
          ...telemetry.completedVisitIds,
          "phantom-guest",
        ],
        waitSamplesMs: [...telemetry.waitSamplesMs, 18_000],
      },
    });
    expect(() =>
      restoreScenarioRuntimeEnvelope(
        scenarioId,
        phantomCompletionPayload,
        authoredCatalog,
      )
    ).toThrow(/incomplete or stale scenario telemetry/);

    const inflatedAggregatePayload = createRuntimeSaveEnvelopeV5({
      core: serializeGameState(completed),
      stallMenus: setup.stallMenus,
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      activeDishVariants: setup.activeDishVariants,
      periodOutcomes: {},
      scenarioTelemetry: {
        ...telemetry,
        totalArrivals: telemetry.totalArrivals + 1,
        pathRequests: telemetry.pathRequests + 1,
      },
    });
    expect(() =>
      restoreScenarioRuntimeEnvelope(
        scenarioId,
        inflatedAggregatePayload,
        authoredCatalog,
      )
    ).toThrow(/incomplete or stale scenario telemetry/);

    const completedWithTimeout: GameState = {
      ...completed,
      metrics: {
        ...completed.metrics,
        visitRatings: retainedRatings.map((rating, index) =>
          index === retainedRatings.length - 1
            ? { ...rating, reason: "served-timeout" }
            : rating
        ),
      },
    };
    const observedWithTimeout = createScenarioRunTelemetry(
      scenarioId,
      completedWithTimeout.servicePeriod.sequenceId,
      "history-window-timeout-run",
      completedWithTimeout,
    );
    const timeoutTelemetry = {
      ...observedWithTimeout,
      processedRatingKeys: [
        ...observedWithTimeout.processedRatingKeys,
        "1:guest-1",
      ].sort(),
      completedVisitIds: [
        ...observedWithTimeout.completedVisitIds,
        "guest-1",
      ].sort(),
      waitSamplesMs: [...observedWithTimeout.waitSamplesMs, 19_999],
    };
    const completedTimeoutPayload = createRuntimeSaveEnvelopeV5({
      core: serializeGameState(completedWithTimeout),
      stallMenus: setup.stallMenus,
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      activeDishVariants: setup.activeDishVariants,
      periodOutcomes: {
        [completedWithTimeout.servicePeriod.sequenceId]: {
          timedOutServedVisits: 1,
        },
      },
      scenarioTelemetry: timeoutTelemetry,
    });
    expect(
      restoreScenarioRuntimeEnvelope(
        scenarioId,
        completedTimeoutPayload,
        authoredCatalog,
      ).scenarioTelemetry?.completedVisitIds,
    ).toHaveLength(50);
  });

  it("rejects a V5 envelope whose scenario menu was substituted", () => {
    const scenarioId: ScenarioId = "scenario.narrow-aisles";
    const state = createScenarioGameState(scenarioId, authoredCatalog);
    const setup = getScenarioRuntimeSetup(scenarioId, authoredCatalog);
    const payload = createRuntimeSaveEnvelopeV5({
      core: serializeGameState(state),
      stallMenus: {
        ...setup.stallMenus,
        "stall.sunrise-roost": ["dish.black-pepper-crab"],
      },
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      activeDishVariants: setup.activeDishVariants,
      periodOutcomes: {},
    });

    expect(() =>
      restoreScenarioRuntimeEnvelope(scenarioId, payload, authoredCatalog)
    ).toThrow(/fixed reviewed menu/);
  });
});
