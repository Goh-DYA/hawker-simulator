import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  authoredStallUpkeepCents,
  canManuallyAdvanceServicePeriod,
  canvasLabelFontSize,
  canvasLabelFullyInsideView,
  collisionFreeCanvasLabelY,
  comboOutcomeObservations,
  buildCatalog,
  decodeRuntimeSave,
  defaultDishVariants,
  formatSimulationEvent,
  freshState,
  freezeRuntimePeriodForecastCoverage,
  liveComboBoardAvailabilityMessage,
  nextAuthoredLevelExperience,
  planValidSetupRecovery,
  rebaseDevelopmentCash,
  reviewedPreparationFor,
  restoreRuntimeEnvelope,
  resolvePeriodOutcomes,
  savedLayoutCapacityWarning,
  servedVisitCount,
} from "../src/game/runtime/createHawkerRuntime";
import { NUTRITION_CONTENT, STALLS } from "../src/content";
import {
  asMoneyCents,
  ledgerReconciliationDeltaCents,
  mealComponentsForState,
  persistentStateFromGame,
  sgdToCents,
  validatePlacement,
} from "../src/game/core";
import { makeGame } from "./core/fixtures";
import {
  activityEntryMessage,
  appendActivityEvent,
} from "../src/game/runtime/activityFeed";

describe("Stage 1 runtime boundaries", () => {
  it("converts every authored per-stall upkeep rate exactly once into cents", () => {
    for (const stall of STALLS) {
      expect(authoredStallUpkeepCents(stall.operatingCostPerMinute)).toBe(
        stall.operatingCostPerMinute * 100,
      );
    }
    expect(new Set(STALLS.map((stall) => authoredStallUpkeepCents(
      stall.operatingCostPerMinute,
    ))).size).toBeGreaterThan(1);
  });

  it("keeps canvas labels at a 0.75rem-equivalent minimum and follows text scale", () => {
    expect(canvasLabelFontSize(1, 1)).toBe(12);
    expect(canvasLabelFontSize(2, 1)).toBe(24);
    expect(canvasLabelFontSize(1, 0.5)).toBe(24);
    expect(canvasLabelFontSize(2, 0.5) * 0.5).toBeGreaterThanOrEqual(24);
  });

  it("hides informational labels unless their full bounds remain inside the camera", () => {
    const view = { left: 0, top: 0, right: 320, bottom: 180 };
    expect(canvasLabelFullyInsideView(
      { left: 8, top: 8, right: 120, bottom: 36 },
      view,
      4,
    )).toBe(true);
    expect(canvasLabelFullyInsideView(
      { left: -72, top: 8, right: 8, bottom: 36 },
      view,
      4,
    )).toBe(false);
    expect(canvasLabelFullyInsideView(
      { left: 8, top: 8, right: 319, bottom: 36 },
      view,
      4,
    )).toBe(false);
  });

  it("stacks enlarged canvas labels away from earlier portal labels", () => {
    const portal = { left: 100, top: 80, right: 180, bottom: 110 };
    const resolvedY = collisionFreeCanvasLabelY(
      140,
      95,
      96,
      30,
      [portal],
    );

    expect(resolvedY).not.toBe(95);
    expect(resolvedY).toBeDefined();
    const top = (resolvedY as number) - 15;
    const bottom = (resolvedY as number) + 15;
    expect(bottom + 4 <= portal.top || top - 4 >= portal.bottom).toBe(true);
  });

  it("omits a later enlarged label when every safe stack position is occupied", () => {
    const occupied = [0, -34, 34, -68, 68].map((centreY) => ({
      left: -48,
      top: centreY - 15,
      right: 48,
      bottom: centreY + 15,
    }));

    expect(collisionFreeCanvasLabelY(0, 0, 96, 30, occupied)).toBeUndefined();
  });

  it("reserves manual period advancement for planning and debrief", () => {
    expect(canManuallyAdvanceServicePeriod("planning")).toBe(true);
    expect(canManuallyAdvanceServicePeriod("arrivals")).toBe(false);
    expect(canManuallyAdvanceServicePeriod("draining")).toBe(false);
    expect(canManuallyAdvanceServicePeriod("debrief")).toBe(true);
  });

  it("explains temporary Combo Board shutter impact without deleting saved offers", () => {
    expect(liveComboBoardAvailabilityMessage("planning", 1)).toBeUndefined();
    expect(liveComboBoardAvailabilityMessage("arrivals", 1)).toContain(
      "1 Combo Board offer is temporarily unavailable",
    );
    expect(liveComboBoardAvailabilityMessage("arrivals", 1)).toContain(
      "Saved offers stay configured",
    );
    expect(liveComboBoardAvailabilityMessage("draining", 2)).toContain(
      "future matching guests use a feasible single meal",
    );
  });

  it("emits the authored arrivals-started activity message from one runtime call site", () => {
    const source = readFileSync(
      new URL("../src/game/runtime/createHawkerRuntime.ts", import.meta.url),
      "utf8",
    );
    expect(source.match(/arrivals have started\./g)).toHaveLength(1);
  });

  it("warns about preserved lower-capacity saves without implying furniture was injected", () => {
    expect(savedLayoutCapacityWarning({
      currentSeatCount: 6,
      reviewedSeatCount: 9,
      demandRange: [48, 60],
    })).toBe(
      "Saved layout preserved with 6 usable seats. The reviewed fresh-centre layout has 9 for the current 48–60 visit forecast. Consider adding 3 seats during the next planning period; no furniture was added automatically.",
    );
    expect(savedLayoutCapacityWarning({
      currentSeatCount: 9,
      reviewedSeatCount: 9,
      demandRange: [48, 60],
    })).toBeUndefined();
  });

  it("uses an explicit MAX sentinel instead of asking for a level-21 threshold", () => {
    expect(nextAuthoredLevelExperience(19)).toBeGreaterThan(0);
    expect(nextAuthoredLevelExperience(20)).toBeNull();
  });

  it("resolves every reviewed preparation by exact dish and variant ids", () => {
    for (const family of NUTRITION_CONTENT.variantFamilies) {
      for (const variant of family.variants) {
        const preparation = reviewedPreparationFor(family.dishId, variant.id);
        expect(preparation).toMatchObject({
          dishId: family.dishId,
          variantId: variant.id,
          profileId: variant.profileId,
        });
        expect(Number.isSafeInteger(preparation?.terms.priceCents)).toBe(true);
        expect(Number.isSafeInteger(preparation?.terms.ingredientCostCents)).toBe(true);
      }
    }
  });

  it("plans only the zero-resale essentials needed beyond the recovery cap", () => {
    expect(planValidSetupRecovery({
      cashCents: 0,
      missingStallCostCents: 120_000,
      missingSeatCount: 4,
      seatCostCents: 3_500,
      maximumGrantCents: 65_000,
    })).toEqual({
      reclaimStarterStall: true,
      reclaimedSeatCount: 0,
      remainingSetupCostCents: 14_000,
    });
    expect(planValidSetupRecovery({
      cashCents: 70_000,
      missingStallCostCents: 120_000,
      missingSeatCount: 4,
      seatCostCents: 3_500,
      maximumGrantCents: 65_000,
    })).toEqual({
      reclaimStarterStall: false,
      reclaimedSeatCount: 0,
      remainingSetupCostCents: 134_000,
    });
  });

  it("decodes the V3 runtime envelope without changing persisted cents", () => {
    const core = { schemaVersion: 5, economy: { cashCents: 42_075 } };
    const periodOutcomes = {
      3: {
        periodSequenceId: 3,
        unservedDepartures: 2,
        timedOutServedVisits: 1,
      },
    };
    const decoded = decodeRuntimeSave({
      runtimeSchemaVersion: 3,
      core,
      stallMenus: {},
      activeDishVariants: {},
      nutritionDataVersion: "test",
      periodOutcomes,
    });

    expect(decoded.runtimeSchemaVersion).toBe(3);
    expect(decoded.core).toBe(core);
    expect(decoded.periodOutcomes).toBe(periodOutcomes);
    expect((decoded.core as typeof core).economy.cashCents).toBe(42_075);
  });

  it("decodes the V4 runtime envelope around core V6 without changing cents", () => {
    const core = {
      schemaVersion: 6,
      economy: { cashCents: 42_075 },
      comboBoard: { slots: [null, null, null] },
    };
    const decoded = decodeRuntimeSave({
      runtimeSchemaVersion: 4,
      core,
      stallMenus: {},
      activeDishVariants: {},
      nutritionDataVersion: "test",
      periodOutcomes: {},
    });

    expect(decoded.runtimeSchemaVersion).toBe(4);
    expect(decoded.core).toBe(core);
    expect((decoded.core as typeof core).economy.cashCents).toBe(42_075);
    expect((decoded.core as typeof core).comboBoard.slots).toHaveLength(3);
  });

  it("restores a non-default exact Combo Board preparation before core validation", () => {
    const { catalog } = buildCatalog();
    const base = freshState(catalog, "runtime-variant-combo-restore");
    const kopiDefinitionId = "stall.kopi-canopy";
    let kopiStall: {
      id: string;
      definitionId: string;
      origin: { x: number; y: number };
      rotation: 0;
      open: boolean;
    } | undefined;
    for (let y = 1; y < base.map.height - 1 && !kopiStall; y += 1) {
      for (let x = 1; x < base.map.width - 1; x += 1) {
        const candidate = {
          id: "restore-kopi-stall",
          definitionId: kopiDefinitionId,
          origin: { x, y },
          rotation: 0 as const,
          open: false,
        };
        if (validatePlacement(base.map, base.objects, catalog, candidate, {
          reservedPoints: base.accessPoints.map((point) => point.position),
        }).valid) {
          kopiStall = candidate;
          break;
        }
      }
    }
    expect(kopiStall).toBeDefined();

    const state = {
      ...base,
      objects: {
        ...base.objects,
        [kopiStall!.id]: kopiStall!,
      },
      queues: {
        ...base.queues,
        [kopiStall!.id]: [],
      },
      progression: {
        ...base.progression,
        level: 5,
        reputation: 5,
        unlockedDefinitionIds: Object.keys(catalog.placeables).sort(),
        stallMastery: {
          ...base.progression.stallMastery,
          "stall.coconut-lime": { points: 100, rank: 2, upgradeLevel: 1 as const },
        },
      },
    };
    const core = persistentStateFromGame(state) as ReturnType<typeof persistentStateFromGame> & {
      comboBoard: { slots: unknown[] };
    };
    const main = reviewedPreparationFor(
      "dish.nasi-lemak",
      "nasi-lemak-chicken-cutlet",
    );
    const drink = reviewedPreparationFor("dish.kopi", "kopi-default");
    expect(main?.mealRole).toBe("main");
    expect(drink?.mealRole).toBe("drink");
    core.comboBoard = {
      slots: [{
        id: "combo-slot-1",
        preparationIds: [main!.id, drink!.id],
      }, null, null],
    };
    const envelope = {
      runtimeSchemaVersion: 4 as const,
      core,
      stallMenus: {
        ...Object.fromEntries(Object.values(catalog.placeables).flatMap((definition) => (
          definition.stall ? [[definition.id, [...definition.stall.dishIds]]] : []
        ))),
        "stall.coconut-lime": ["dish.nasi-lemak"],
        [kopiDefinitionId]: ["dish.kopi"],
      },
      activeDishVariants: {
        ...defaultDishVariants(),
        "dish.nasi-lemak": "nasi-lemak-chicken-cutlet",
      },
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      periodOutcomes: {},
    };
    const expectedCashCents = core.economy.cashCents;

    const emptyEnvelope = structuredClone(envelope);
    emptyEnvelope.core.comboBoard = { slots: [null, null, null] };
    const emptyRestore = restoreRuntimeEnvelope(emptyEnvelope, catalog);
    expect(emptyRestore.state.progression).toMatchObject({ level: 5, reputation: 5 });
    expect(emptyRestore.state.progression.unlockedDefinitionIds).toContain(kopiDefinitionId);
    expect(mealComponentsForState(emptyRestore.state, true)
      .filter((component) => component.preparationId === main!.id || component.preparationId === drink!.id)
      .map((component) => ({ id: component.preparationId, unlocked: component.unlocked })))
      .toEqual([
        { id: drink!.id, unlocked: true },
        { id: main!.id, unlocked: true },
      ]);

    // Startup restoration and manual import share this exact envelope boundary.
    const startup = restoreRuntimeEnvelope(envelope, catalog);
    const imported = restoreRuntimeEnvelope(structuredClone(envelope), catalog);
    for (const restored of [startup, imported]) {
      expect(restored.activeDishVariants["dish.nasi-lemak"]).toBe(
        "nasi-lemak-chicken-cutlet",
      );
      expect(restored.state.comboBoard.slots[0]?.preparationIds).toEqual([
        main!.id,
        drink!.id,
      ]);
      expect(restored.state.economy.cashCents).toBe(expectedCashCents);
    }
    const source = readFileSync(
      new URL("../src/game/runtime/createHawkerRuntime.ts", import.meta.url),
      "utf8",
    );
    expect(source.match(/restoreRuntimeEnvelope\(/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("migrates preceding runtime outcomes with zero explicit partial-meal causes", () => {
    const outcomes = resolvePeriodOutcomes({
      3: {
        periodSequenceId: 3,
        unservedDepartures: 2,
        timedOutServedVisits: 1,
      },
    }, 3);

    expect(outcomes[3]).toMatchObject({
      partialMealSecondStallUnavailable: 0,
      partialMealServedTimeout: 0,
      comboOfferOutcomes: {},
    });
  });

  it("attributes completed and partial combo visits once to their saved offer", () => {
    const mealOrderSnapshot = {
      offerId: "combo-slot-2",
      lines: [
        { orderLine: { lineId: "line-main", preparationId: "prep-main" } },
        { orderLine: { lineId: "line-drink", preparationId: "prep-drink" } },
      ],
    };
    const customersBefore = {
      guest: {
        arrivalPeriodSequenceId: 7,
        settledMealLineIds: ["line-main"],
        mealOrderSnapshot,
      },
    } as unknown as Parameters<typeof comboOutcomeObservations>[1];

    expect(comboOutcomeObservations([{
      type: "sale-completed",
      tick: 20,
      entityId: "guest",
      message: "prep-drink",
      amountCents: asMoneyCents(180),
    }], customersBefore)).toEqual([{
      periodSequenceId: 7,
      offerId: "combo-slot-2",
      result: "complete",
    }]);
    expect(comboOutcomeObservations([{
      type: "meal-partial",
      tick: 21,
      entityId: "guest",
      message: "second-stall-unavailable",
    }], customersBefore)).toEqual([{
      periodSequenceId: 7,
      offerId: "combo-slot-2",
      result: "partial",
      cause: "second-stall-unavailable",
    }]);
  });

  it("counts a two-line combo as one visit without collapsing same-dish legacy visits", () => {
    expect(servedVisitCount([
      { id: "gross:visit-1:main", kind: "gross-sale", visitId: "visit-1" },
      { id: "gross:visit-1:drink", kind: "gross-sale", visitId: "visit-1" },
      { id: "gross:visit-2", kind: "gross-sale", visitId: "visit-2" },
    ])).toBe(2);
    expect(servedVisitCount([
      { id: "legacy-sale-1", kind: "gross-sale" },
      { id: "legacy-sale-2", kind: "gross-sale" },
    ])).toBe(2);
  });

  it("announces explicit partial-meal causes without charging the cancelled component", () => {
    expect(formatSimulationEvent({
      type: "meal-partial",
      tick: 9,
      message: "second-stall-unavailable",
      amountCents: asMoneyCents(725),
    })).toMatchObject({
      kind: "warning",
      amountCents: 725,
      groupKey: "partial-meal:second-stall-unavailable",
      message: expect.stringContaining("cancelled without charge"),
    });
    expect(formatSimulationEvent({
      type: "meal-partial",
      tick: 10,
      message: "served-timeout",
    })?.message).toContain("timed out");
  });

  it("freezes preceding-preview drain coverage once and preserves it across reload", () => {
    const legacy = resolvePeriodOutcomes({
      4: {
        periodSequenceId: 4,
        unservedDepartures: 1,
        timedOutServedVisits: 0,
      },
    }, 4);
    const restoredCoverage = [{
      needId: "intent.protein-forward",
      viableResponseIds: [],
      unlockedViableResponseIds: ["dish.poached-chicken-rice:base"],
      covered: false,
      eligibleForRequiredContent: false,
    }];
    const normalized = freezeRuntimePeriodForecastCoverage(
      legacy,
      4,
      restoredCoverage,
    );
    expect(normalized.changed).toBe(true);
    expect(normalized.outcomes[4]?.forecastCoverage).toEqual(restoredCoverage);

    const afterShutterChange = freezeRuntimePeriodForecastCoverage(
      normalized.outcomes,
      4,
      [{
        ...restoredCoverage[0]!,
        viableResponseIds: ["dish.poached-chicken-rice:base"],
        covered: true,
      }],
    );
    expect(afterShutterChange.changed).toBe(false);
    expect(afterShutterChange.outcomes[4]?.forecastCoverage).toEqual(restoredCoverage);

    const reloaded = resolvePeriodOutcomes(
      JSON.parse(JSON.stringify(afterShutterChange.outcomes)),
      4,
    );
    expect(reloaded[4]?.forecastCoverage).toEqual(restoredCoverage);
  });

  it("wires explicit import through coverage normalization and capacity disclosure", () => {
    const source = readFileSync(
      new URL("../src/game/runtime/createHawkerRuntime.ts", import.meta.url),
      "utf8",
    );
    const start = source.indexOf("    importState(value) {");
    const end = source.indexOf("\n    reset() {", start);
    const importPath = source.slice(start, end);
    const resolveIndex = importPath.indexOf("periodOutcomes = resolvePeriodOutcomes(");
    const freezeIndex = importPath.indexOf("freezePeriodForecastCoverage(");
    const warningIndex = importPath.indexOf("emitPreservedLayoutCapacityWarning(state, catalog)");
    const persistIndex = importPath.indexOf("options.onPersistentChange(persistentPayload())");
    const hudIndex = importPath.indexOf("emitHud(true)");

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(resolveIndex).toBeGreaterThanOrEqual(0);
    expect(freezeIndex).toBeGreaterThan(resolveIndex);
    expect(warningIndex).toBeGreaterThan(freezeIndex);
    expect(persistIndex).toBeGreaterThan(warningIndex);
    expect(hudIndex).toBeGreaterThan(persistIndex);
  });

  it("passes canonical cents from simulation events into the activity feed", () => {
    const sale = formatSimulationEvent({
      type: "sale-completed",
      tick: 1,
      amountCents: asMoneyCents(725),
    });

    expect(sale).toMatchObject({
      groupKey: "sales",
      amountCents: 725,
    });
    expect(sale?.message).not.toContain("$");
    const [entry] = appendActivityEvent([], sale!, 1);
    expect(activityEntryMessage(entry!)).toBe(
      "A neighbour enjoyed their meal · S$7.25 gross sale",
    );
  });

  it("turns the level-five event into an actionable Combo Board reveal", () => {
    expect(formatSimulationEvent({
      type: "level-up",
      tick: 12,
      message: "5",
    })).toMatchObject({
      kind: "success",
      importance: "important",
      message: expect.stringContaining("Combo Board unlocked in Dishes"),
    });
    expect(formatSimulationEvent({
      type: "level-up",
      tick: 13,
      message: "6",
    })?.message).toContain("level 6");
  });

  it("keeps objective rewards as integer cents", () => {
    expect(formatSimulationEvent({
      type: "objective-completed",
      tick: 4,
      amountCents: asMoneyCents(1_800),
      message: "Warm welcome",
    })).toMatchObject({
      message: "Warm welcome complete.",
      amountCents: 1_800,
    });
  });

  it("rebases development cash without corrupting the active period ledger", () => {
    const state = rebaseDevelopmentCash(makeGame(), sgdToCents(100_000));
    const ledger = state.periodLedgers[state.servicePeriod.sequenceId]!;

    expect(state.economy.cashCents).toBe(10_000_000);
    expect(ledger.openingCashCents).toBe(10_000_000);
    expect(ledgerReconciliationDeltaCents(ledger, state.economy.cashCents)).toBe(0);
  });

  it("does not fabricate a zero-SGD amount for a malformed monetary event", () => {
    expect(formatSimulationEvent({
      type: "sale-completed",
      tick: 5,
    })?.amountCents).toBeUndefined();
  });
});
