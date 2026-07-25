import { describe, expect, it } from "vitest";
import {
  acceptMasteryContract,
  acceptMasteryOffer,
  applyMasteryPeriodDebrief,
  createEmptyMasteryProgression,
  createEmptyMetaProgression,
  deriveMasteryOffer,
  skipMasteryOffer,
} from "../src/game/core/strategicProgression";
import {
  buildMasteryPanelView,
  buildMetaGallery,
  buildScenarioProgress,
  masteryFeasibilityContext,
  masteryRewardLabel,
  masteryQualificationLabel,
  masteryTargetAccessibleLabel,
  masteryTargetLabel,
} from "../app/game/strategicChallengeModel";
import {
  asMoneyCents,
  asMoneyDeltaCents,
} from "../src/game/core/money";
import { MASTERY_CONTRACT_TEMPLATES } from "../src/content/strategicGameplay";
import type { RuntimeSnapshot } from "../src/game/runtime/types";

function snapshot(
  overrides: Partial<RuntimeSnapshot> = {},
): RuntimeSnapshot {
  return {
    cashCents: asMoneyCents(100_000),
    cash: 1_000,
    reputation: 100,
    level: 13,
    experience: 10_000,
    nextLevelExperience: 20_000,
    day: 1,
    timeLabel: "06:00",
    servicePeriod: {
      sequenceId: 1,
      day: 1,
      id: "breakfast",
      label: "Breakfast",
      phase: "planning",
      startMinute: 360,
      endMinute: 600,
      clockLabel: "06:00",
      arrivalElapsedMs: 0,
      drainElapsedMs: 0,
      arrivalRemainingMs: 240_000,
      drainRemainingMs: 180_000,
      configurationLocked: false,
      canAdvance: true,
      actionLabel: "Start breakfast",
    },
    forecast: {
      periodSequenceId: 1,
      periodId: "breakfast",
      day: 1,
      demandRange: [1, 2],
      crowdProfiles: [],
      budgetBands: [],
      groupSizeMix: [],
      mealMix: [],
      nutritionIntents: [],
      conditionAwareNeeds: [],
      nutritionIntentIncidenceBasisPoints: 0,
      conditionAwareIncidenceBasisPoints: 0,
      needShareBasis: "among-flagged-needs",
      coverage: [],
      menuIndependent: true,
      explanation: "Test",
    },
    periodLedger: {
      periodSequenceId: 1,
      openingCashCents: asMoneyCents(100_000),
      grossSalesCents: asMoneyCents(0),
      ingredientCostsCents: asMoneyCents(0),
      refundsCents: asMoneyCents(0),
      purchasesCents: asMoneyCents(0),
      resaleCents: asMoneyCents(0),
      upkeepCents: asMoneyCents(0),
      objectiveRewardsCents: asMoneyCents(0),
      milestoneRewardsCents: asMoneyCents(0),
      recoveryCents: asMoneyCents(0),
      contributionCents: asMoneyDeltaCents(0),
      recordedCashMovementCents: asMoneyDeltaCents(0),
      actualCashMovementCents: asMoneyDeltaCents(0),
      reconciliationDeltaCents: asMoneyDeltaCents(0),
      reconcilesToCash: true,
      entries: [],
    },
    isOpen: false,
    speed: 1,
    quality: "standard",
    activeCustomers: 0,
    servedCustomers: 0,
    averageSatisfaction: 0,
    hasSatisfactionRatings: false,
    satisfactionTips: [],
    queuePressure: 0,
    queueFlowState: "good",
    queueFlowMessage: "Clear",
    freeSeats: 12,
    totalSeats: 12,
    cleanliness: 100,
    trayReturnStations: 1,
    buildTool: "select",
    unlockedContentIds: [],
    stallMenus: {},
    activeDishVariants: {},
    unlockedPreparationCount: 0,
    activePreparations: [],
    comboBoard: {
      unlockLevel: 5,
      unlocked: true,
      slots: [null, null, null],
      candidates: [],
      valid: true,
      issues: [],
      configuredOfferCount: 0,
    },
    nutritionFamilies: [],
    nutritionPulse: {
      servedMeals: 0,
      profiledMeals: 0,
      intentRequests: 0,
      intentMatches: 0,
      intentMisses: 0,
      intentUnknowns: 0,
      averages: {},
      knownCounts: {
        energyKcal: 0,
        proteinG: 0,
        dietaryFibreG: 0,
        sodiumMg: 0,
      },
    },
    placedStalls: [
      {
        objectId: "stall-1",
        definitionId: "stall.sunrise-roost",
        name: "Sunrise Roost",
        queueCount: 0,
        queueDirection: "south",
        customQueue: false,
        open: true,
      },
      {
        objectId: "stall-2",
        definitionId: "stall.kopi-canopy",
        name: "Kopi Canopy",
        queueCount: 0,
        queueDirection: "south",
        customQueue: false,
        open: true,
      },
    ],
    canUndo: false,
    objectiveProgress: 0,
    objectiveTarget: 0,
    objectives: [],
    objectiveRefreshLabel: "Choose now",
    claimedMilestoneCount: 0,
    milestoneTracks: [],
    stallMastery: [],
    accessPoints: [],
    routeGuidePoints: [],
    expansionCount: 0,
    nextExpansionCost: 0,
    fps: 60,
    simulationMs: 0,
    autosaveState: "saved",
    ...overrides,
  };
}

describe("Stage 5 challenge view model", () => {
  it("uses the runtime-authored unlocked preparation count for feasibility", () => {
    expect(
      masteryFeasibilityContext(snapshot({
        unlockedPreparationCount: 7,
        activePreparations: [],
      })).unlockedPreparationCount,
    ).toBe(7);
  });

  it("returns exactly three deterministic breakfast choices", () => {
    const view = buildMasteryPanelView(
      snapshot(),
      createEmptyMasteryProgression(),
      createEmptyMetaProgression(),
    );
    expect(view.kind).toBe("offer");
    if (view.kind !== "offer") return;
    expect(view.choices).toHaveLength(3);
    expect(new Set(view.choices.map((choice) => choice.id)).size).toBe(3);
    expect(view.choices.every((choice) => !choice.previouslyCompleted)).toBe(
      true,
    );
  });

  it("marks deterministic completed choices used to preserve three offers", () => {
    const completedContractIds = MASTERY_CONTRACT_TEMPLATES
      .slice(0, 10)
      .map((template) => template.id);
    const view = buildMasteryPanelView(
      snapshot(),
      createEmptyMasteryProgression(),
      {
        ...createEmptyMetaProgression(),
        completedContractIds,
      },
    );
    expect(view.kind).toBe("offer");
    if (view.kind !== "offer") return;
    const completedContractIdSet = new Set<string>(completedContractIds);
    expect(view.choices).toHaveLength(3);
    expect(
      view.choices.every(
        (choice) =>
          choice.previouslyCompleted === completedContractIdSet.has(choice.id),
      ),
    ).toBe(true);
    expect(view.choices.some((choice) => choice.previouslyCompleted)).toBe(
      true,
    );
  });

  it("reports current centre capacity without manufacturing an offer", () => {
    const view = buildMasteryPanelView(
      snapshot({
        placedStalls: [],
        totalSeats: 0,
        freeSeats: 0,
      }),
      createEmptyMasteryProgression(),
      createEmptyMetaProgression(),
    );
    expect(view).toEqual({
      kind: "unavailable",
      explanation:
        "Only 0 contracts are feasible with the current centre. Add service capacity before the next breakfast.",
    });
  });

  it("shows accepted progress and a neutral skipped rotation", () => {
    const base = createEmptyMasteryProgression();
    const meta = createEmptyMetaProgression();
    const context = {
      level: 13,
      openStallCount: 2,
      availableSeatCount: 12,
      comboBoardUnlocked: true,
      validComboOfferCount: 1,
      trayReturnStationCount: 1,
      partyDemandAvailable: true,
      forecastNutritionIntentAvailable: true,
      unlockedPreparationCount: 8,
    };
    const offer = deriveMasteryOffer({
      seed: "hawker-balance-mastery-v1",
      day: 1,
      periodId: "breakfast",
      context,
      progression: base,
      meta,
    });
    expect(offer.status).toBe("available");
    if (offer.status !== "available") return;
    const accepted = acceptMasteryOffer(
      base,
      offer,
      offer.choices[0].id,
      1,
      1,
    );
    expect(buildMasteryPanelView(snapshot(), accepted, meta).kind).toBe(
      "active",
    );
    expect(
      buildMasteryPanelView(
        snapshot(),
        skipMasteryOffer(base, offer),
        meta,
      ).kind,
    ).toBe("skipped");
  });

  it("explains frozen guardrail participation in active and outcome views", () => {
    const template = MASTERY_CONTRACT_TEMPLATES.find(
      (candidate) => candidate.id === "contract.short-waits",
    );
    if (!template) throw new Error("Missing Short Waits contract");
    const progression = {
      schemaVersion: 1 as const,
      decidedRotation: 0,
      decision: "accepted" as const,
      activeContract: {
        schemaVersion: 1 as const,
        contract: acceptMasteryContract(template, 1, 1),
        progress: {
          completedVisits: 0,
          grossSalesCents: 0,
          contributionCents: 0,
          flowSeconds: 0,
          distinctPreparationIds: [],
          partyVisits: 0,
          trayReturns: 0,
          trayReturnOpportunities: 0,
          forecastNeedsMet: 0,
          periodsWithoutRefund: 0,
          comboVisits: 0,
          processedPeriodSequenceIds: [],
          qualifiedPeriodSequenceIds: [],
        },
      },
    };
    const meta = createEmptyMetaProgression();
    const first = applyMasteryPeriodDebrief(progression, meta, {
      periodSequenceId: 1,
      completedVisits: 3,
      grossSalesCents: 0,
      contributionCents: 0,
      medianWaitSeconds: 40,
      flowSeconds: 0,
      distinctPreparationIds: [],
      partyVisits: 0,
      trayReturns: 0,
      trayReturnOpportunities: 0,
      forecastNeedsMet: 0,
      refundCents: 0,
      comboVisits: 0,
    });
    expect(buildMasteryPanelView(snapshot(), first.progression, first.meta))
      .toMatchObject({
        kind: "active",
        contract: {
          qualificationLabel:
            "At least 3 completed visits in each of 3 periods.",
          qualificationProgressLabel: "1 of 3 periods qualified",
        },
      });

    const second = applyMasteryPeriodDebrief(
      first.progression,
      first.meta,
      {
        periodSequenceId: 2,
        completedVisits: 3,
        grossSalesCents: 0,
        contributionCents: 0,
        medianWaitSeconds: 40,
        flowSeconds: 0,
        distinctPreparationIds: [],
        partyVisits: 0,
        trayReturns: 0,
        trayReturnOpportunities: 0,
        forecastNeedsMet: 0,
        refundCents: 0,
        comboVisits: 0,
      },
    );
    const failed = applyMasteryPeriodDebrief(
      second.progression,
      second.meta,
      {
        periodSequenceId: 3,
        completedVisits: 1,
        grossSalesCents: 0,
        contributionCents: 0,
        medianWaitSeconds: 40,
        flowSeconds: 0,
        distinctPreparationIds: [],
        partyVisits: 0,
        trayReturns: 0,
        trayReturnOpportunities: 0,
        forecastNeedsMet: 0,
        refundCents: 0,
        comboVisits: 0,
      },
    );
    expect(buildMasteryPanelView(snapshot(), failed.progression, failed.meta))
      .toMatchObject({
        kind: "outcome",
        outcome: {
          qualificationLabel:
            "At least 3 completed visits in each of 3 periods.",
          qualificationProgressLabel: "2 of 3 periods qualified",
          shortfallLabel:
            "The target value was reached, but only 2 of 3 periods qualified.",
        },
      });
  });

  it("builds preserved medals and reward galleries without gameplay currency", () => {
    const meta = {
      ...createEmptyMetaProgression(),
      scenarioMedals: { "scenario.narrow-aisles": "gold" as const },
      unlockedCosmeticIds: ["cosmetic.gold-wayfinder"],
      unlockedTitleIds: ["title.warm-welcome"],
    };
    const progress = buildScenarioProgress(
      { "scenario.narrow-aisles": true },
      meta,
    );
    const gallery = buildMetaGallery(meta);
    expect(progress["scenario.narrow-aisles"]).toEqual({
      hasSave: true,
      bestMedal: "gold",
    });
    expect(gallery.titles.some((item) => item.unlocked)).toBe(true);
    expect(gallery.cosmetics.some((item) => item.unlocked)).toBe(true);
    expect(JSON.stringify(gallery)).not.toMatch(/cash|credits|premium/i);
  });

  it("formats SGD and guardrail targets explicitly", () => {
    expect(
      masteryTargetLabel({
        metric: "gross-sales-cents",
        value: 24_000,
      }),
    ).toContain("S$240");
    expect(
      masteryTargetAccessibleLabel({
        metric: "gross-sales-cents",
        value: 24_000,
      }),
    ).toBe("240 Singapore dollars and 0 cents gross sales");
    expect(
      masteryTargetLabel({
        metric: "maximum-median-wait-seconds",
        value: 55,
      }),
    ).toBe("Median wait at most 55 seconds");
    expect(
      masteryTargetLabel({
        metric: "tray-return-rate-percent",
        value: 80,
      }),
    ).toBe("At least 80% tray-return rate");
    expect(
      masteryQualificationLabel(
        { minimumTrayReturnOpportunitiesPerPeriod: 4 },
        3,
      ),
    ).toBe("At least 4 tray-return opportunities in each of 3 periods.");
    expect(
      masteryRewardLabel({
        kind: "title",
        titleId: "title.queue-keeper",
      }),
    ).toBe("Queue Keeper title");
  });
});
