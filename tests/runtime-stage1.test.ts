import { describe, expect, it } from "vitest";
import {
  authoredStallUpkeepCents,
  canManuallyAdvanceServicePeriod,
  canvasLabelFontSize,
  decodeRuntimeSave,
  formatSimulationEvent,
  nextAuthoredLevelExperience,
  planValidSetupRecovery,
  rebaseDevelopmentCash,
  reviewedPreparationFor,
} from "../src/game/runtime/createHawkerRuntime";
import { NUTRITION_CONTENT, STALLS } from "../src/content";
import {
  asMoneyCents,
  ledgerReconciliationDeltaCents,
  sgdToCents,
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

  it("reserves manual period advancement for planning and debrief", () => {
    expect(canManuallyAdvanceServicePeriod("planning")).toBe(true);
    expect(canManuallyAdvanceServicePeriod("arrivals")).toBe(false);
    expect(canManuallyAdvanceServicePeriod("draining")).toBe(false);
    expect(canManuallyAdvanceServicePeriod("debrief")).toBe(true);
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
