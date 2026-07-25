import { describe, expect, it } from "vitest";
import {
  MASTERY_CONTRACT_TEMPLATES,
  type MasteryContractTemplate,
} from "../../src/content/strategicGameplay";
import {
  acceptMasteryContract,
  acceptMasteryOffer,
  acceptMasteryOfferInMeta,
  applyMasteryPeriodDebrief,
  applyMasteryPeriodDebriefToMeta,
  createEmptyMasteryProgression,
  createEmptyMetaProgression,
  deriveMasteryContractView,
  deriveMasteryOffer,
  expireMasteryContract,
  isMasteryContractFeasible,
  masteryProgressionFromMeta,
  offerMasteryContracts,
  recordMasteryCompletion,
  skipMasteryOffer,
  skipMasteryOfferInMeta,
  withMasteryProgression,
  type ActiveMasteryContractV1,
  type MasteryFeasibilityContext,
  type MasteryPeriodDebrief,
  type MasteryProgressionV1,
} from "../../src/game/core/strategicProgression";

const FULL_CONTEXT: MasteryFeasibilityContext = {
  level: 13,
  openStallCount: 3,
  availableSeatCount: 20,
  comboBoardUnlocked: true,
  validComboOfferCount: 3,
  trayReturnStationCount: 1,
  partyDemandAvailable: true,
  forecastNutritionIntentAvailable: true,
  unlockedPreparationCount: 8,
};

function masteryOffer(
  overrides: Partial<Parameters<typeof deriveMasteryOffer>[0]> = {},
) {
  return deriveMasteryOffer({
    seed: "mastery-contract-test",
    day: 1,
    periodId: "breakfast",
    context: FULL_CONTEXT,
    progression: createEmptyMasteryProgression(),
    meta: createEmptyMetaProgression(),
    ...overrides,
  });
}

function emptyProgress(): ActiveMasteryContractV1["progress"] {
  return {
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
  };
}

function activeProgression(
  template: MasteryContractTemplate,
  acceptedPeriodSequence = 10,
): MasteryProgressionV1 {
  return {
    schemaVersion: 1,
    decidedRotation: 0,
    decision: "accepted",
    activeContract: {
      schemaVersion: 1,
      contract: acceptMasteryContract(
        template,
        1,
        acceptedPeriodSequence,
      ),
      progress: emptyProgress(),
    },
  };
}

function debrief(
  periodSequenceId: number,
  overrides: Partial<MasteryPeriodDebrief> = {},
): MasteryPeriodDebrief {
  return {
    periodSequenceId,
    completedVisits: 0,
    grossSalesCents: 0,
    contributionCents: 0,
    flowSeconds: 0,
    distinctPreparationIds: [],
    partyVisits: 0,
    trayReturns: 0,
    trayReturnOpportunities: 0,
    forecastNeedsMet: 0,
    refundCents: 0,
    comboVisits: 0,
    ...overrides,
  };
}

function templateByMetric(
  metric: MasteryContractTemplate["target"]["metric"],
): MasteryContractTemplate {
  const template = MASTERY_CONTRACT_TEMPLATES.find(
    (candidate) => candidate.target.metric === metric,
  );
  if (!template) throw new Error(`Missing mastery template for ${metric}`);
  return template;
}

describe("mastery contract offer decisions", () => {
  it("offers exactly three feasible contracts at level 13 breakfast", () => {
    const offer = masteryOffer();
    expect(offer.status).toBe("available");
    if (offer.status !== "available") return;
    expect(offer.choices).toHaveLength(3);
    expect(new Set(offer.choices.map((choice) => choice.id)).size).toBe(3);
    expect(offer.availableFromDay).toBe(1);
    expect(offer.availableThroughDay).toBe(7);
  });

  it("returns explicit unavailable reasons instead of partial offers", () => {
    expect(
      masteryOffer({
        context: { ...FULL_CONTEXT, level: 12 },
      }),
    ).toMatchObject({
      status: "unavailable",
      reason: "mastery-locked",
      choices: [],
    });
    expect(
      masteryOffer({ periodId: "lunch" }),
    ).toMatchObject({
      status: "unavailable",
      reason: "breakfast-only",
      choices: [],
    });
    const tooSmall = {
      ...FULL_CONTEXT,
      availableSeatCount: 0,
    };
    expect(masteryOffer({ context: tooSmall })).toMatchObject({
      status: "unavailable",
      reason: "fewer-than-three-feasible-contracts",
      feasibleChoiceCount: 0,
      choices: [],
    });
    expect(offerMasteryContracts("legacy", 1, tooSmall)).toEqual([]);
  });

  it("keeps one deterministic offer for days one to seven and rotates on day eight", () => {
    const dayOne = masteryOffer();
    const daySeven = masteryOffer({ day: 7 });
    const dayEight = masteryOffer({ day: 8 });
    expect(daySeven).toEqual(dayOne);
    expect(dayEight.rotation).toBe(1);
    expect(dayEight).toEqual(masteryOffer({ day: 8 }));
    expect(dayEight.status).toBe("available");
    if (
      dayOne.status !== "available" ||
      dayEight.status !== "available"
    ) return;
    expect(dayEight.choices.map((choice) => choice.id)).not.toEqual(
      dayOne.choices.map((choice) => choice.id),
    );
  });

  it("allows one accepted choice or Skip per rotation", () => {
    const offer = masteryOffer();
    expect(offer.status).toBe("available");
    if (offer.status !== "available") return;
    const skipped = skipMasteryOffer(createEmptyMasteryProgression(), offer);
    expect(masteryOffer({ progression: skipped })).toMatchObject({
      status: "unavailable",
      reason: "rotation-decided",
    });
    expect(masteryOffer({ day: 8, progression: skipped }).status).toBe(
      "available",
    );
    expect(() => skipMasteryOffer(skipped, offer)).toThrow(
      "already decided",
    );

    const selected = offer.choices[0];
    const accepted = acceptMasteryOffer(
      createEmptyMasteryProgression(),
      offer,
      selected.id,
      1,
      20,
    );
    expect(accepted.activeContract?.contract).toMatchObject({
      templateId: selected.id,
      acceptedDay: 1,
      acceptedPeriodSequence: 20,
      durationPeriods: selected.durationPeriods,
      expiresAfterPeriod: 20 + selected.durationPeriods,
      target: selected.target,
      reward: selected.reward,
    });
    expect(accepted.activeContract?.contract.target).not.toBe(selected.target);
    expect(accepted.activeContract?.contract.reward).not.toBe(selected.reward);
    expect(
      masteryOffer({ progression: accepted }),
    ).toMatchObject({
      status: "unavailable",
      reason: "active-contract",
    });
    expect(() =>
      acceptMasteryOffer(
        createEmptyMasteryProgression(),
        offer,
        "contract.not-offered",
        1,
        20,
      ),
    ).toThrow("not in this offer");
  });

  it("fills three-choice offers with deterministic completed replays", () => {
    const completedContractIds = MASTERY_CONTRACT_TEMPLATES
      .slice(0, 10)
      .map((template) => template.id);
    const offer = masteryOffer({
      meta: {
        ...createEmptyMetaProgression(),
        completedContractIds,
      },
    });
    expect(offer.status).toBe("available");
    if (offer.status !== "available") return;
    expect(offer.choices).toHaveLength(3);
    expect(new Set(offer.choices.map((choice) => choice.id)).size).toBe(3);
    expect(
      offer.choices.slice(0, 2).map((choice) => choice.id).sort(),
    ).toEqual(
      MASTERY_CONTRACT_TEMPLATES
        .slice(10)
        .map((template) => template.id)
        .sort(),
    );
    expect(completedContractIds).toContain(offer.choices[2].id);
    expect(masteryOffer({
      meta: {
        ...createEmptyMetaProgression(),
        completedContractIds,
      },
    })).toEqual(offer);

    const allCompletedOffer = masteryOffer({
      meta: {
        ...createEmptyMetaProgression(),
        completedContractIds: MASTERY_CONTRACT_TEMPLATES.map(
          (template) => template.id,
        ),
      },
    });
    expect(allCompletedOffer.status).toBe("available");
    if (allCompletedOffer.status !== "available") return;
    expect(allCompletedOffer.choices).toHaveLength(3);
    expect(
      allCompletedOffer.choices.every((choice) =>
        MASTERY_CONTRACT_TEMPLATES.some(
          (template) => template.id === choice.id,
        )
      ),
    ).toBe(true);
  });

  it("treats a preparation target above the current unlock set as infeasible", () => {
    const menuCraft = templateByMetric("distinct-preparations");
    expect(
      isMasteryContractFeasible(menuCraft, {
        ...FULL_CONTEXT,
        unlockedPreparationCount: menuCraft.target.value - 1,
      }),
    ).toBe(false);
    expect(
      isMasteryContractFeasible(menuCraft, {
        ...FULL_CONTEXT,
        unlockedPreparationCount: menuCraft.target.value,
      }),
    ).toBe(true);
  });

  it.each([
    [
      "party demand",
      "party-visits",
      { partyDemandAvailable: false },
    ],
    [
      "tray-return capacity",
      "tray-return-rate-percent",
      { trayReturnStationCount: 0 },
    ],
    [
      "forecast nutrition-intent demand",
      "forecast-needs-met",
      { forecastNutritionIntentAvailable: false },
    ],
    [
      "a valid Combo Board offer",
      "combo-visits",
      { validComboOfferCount: 0 },
    ],
  ] as const)(
    "does not offer a metric requiring unavailable current %s",
    (_label, metric, contextOverride) => {
      expect(
        isMasteryContractFeasible(templateByMetric(metric), {
          ...FULL_CONTEXT,
          ...contextOverride,
        }),
      ).toBe(false);
    },
  );

  it("migrates preceding V1 meta records to an empty persisted mastery state", () => {
    const legacyMeta = {
      schemaVersion: 1,
      scenarioMedals: {},
      unlockedCosmeticIds: [],
      unlockedTitleIds: [],
      completedContractIds: [],
    } as const;
    expect(masteryProgressionFromMeta(legacyMeta)).toEqual(
      createEmptyMasteryProgression(),
    );
    expect(
      withMasteryProgression(
        legacyMeta,
        { schemaVersion: 1, decidedRotation: 2, decision: "skipped" },
      ).mastery,
    ).toEqual({
      schemaVersion: 1,
      decidedRotation: 2,
      decision: "skipped",
    });
  });

  it("embeds accepted and skipped decisions in the meta record", () => {
    const offer = masteryOffer();
    expect(offer.status).toBe("available");
    if (offer.status !== "available") return;
    const acceptedMeta = acceptMasteryOfferInMeta(
      createEmptyMetaProgression(),
      offer,
      offer.choices[0].id,
      1,
      10,
    );
    expect(acceptedMeta.mastery).toMatchObject({
      schemaVersion: 1,
      decidedRotation: 0,
      decision: "accepted",
    });
    const skippedMeta = skipMasteryOfferInMeta(
      createEmptyMetaProgression(),
      offer,
    );
    expect(skippedMeta.mastery).toMatchObject({
      schemaVersion: 1,
      decidedRotation: 0,
      decision: "skipped",
    });
  });
});

describe("mastery debrief progression", () => {
  const successfulDebriefs: Readonly<
    Record<
      MasteryContractTemplate["target"]["metric"],
      (
        template: MasteryContractTemplate,
        firstPeriodSequence: number,
      ) => readonly MasteryPeriodDebrief[]
    >
  > = {
    "completed-visits": (template, sequence) => [
      debrief(sequence, { completedVisits: template.target.value }),
    ],
    "gross-sales-cents": (template, sequence) => [
      debrief(sequence, { grossSalesCents: template.target.value }),
    ],
    "contribution-cents": (template, sequence) => [
      debrief(sequence, { contributionCents: template.target.value }),
    ],
    "minimum-satisfaction": (template, sequence) => [
      debrief(sequence, {
        completedVisits: 3,
        minimumSatisfaction: template.target.value,
      }),
      debrief(sequence + 1, {
        completedVisits: 3,
        minimumSatisfaction: template.target.value,
      }),
      debrief(sequence + template.durationPeriods - 1, {
        completedVisits: 3,
        minimumSatisfaction: template.target.value,
      }),
    ],
    "maximum-median-wait-seconds": (template, sequence) => [
      debrief(sequence, {
        completedVisits: 3,
        medianWaitSeconds: template.target.value,
      }),
      debrief(sequence + 1, {
        completedVisits: 3,
        medianWaitSeconds: template.target.value,
      }),
      debrief(sequence + template.durationPeriods - 1, {
        completedVisits: 3,
        medianWaitSeconds: template.target.value,
      }),
    ],
    "flow-seconds": (template, sequence) => [
      debrief(sequence, { flowSeconds: template.target.value }),
    ],
    "distinct-preparations": (template, sequence) => [
      debrief(sequence, {
        distinctPreparationIds: Array.from(
          { length: template.target.value },
          (_, index) => `preparation-${index}`,
        ),
      }),
    ],
    "party-visits": (template, sequence) => [
      debrief(sequence, { partyVisits: template.target.value }),
    ],
    "tray-return-rate-percent": (template, sequence) => [
      ...Array.from(
        { length: template.durationPeriods },
        (_, index) => debrief(sequence + index, {
          trayReturns: 4,
          trayReturnOpportunities: 5,
        }),
      ),
    ],
    "forecast-needs-met": (template, sequence) => [
      debrief(sequence, { forecastNeedsMet: template.target.value }),
    ],
    "periods-without-refund": (template, sequence) =>
      Array.from(
        { length: template.target.value },
        (_, index) => debrief(sequence + index, { completedVisits: 1 }),
      ),
    "combo-visits": (template, sequence) => [
      debrief(sequence, { comboVisits: template.target.value }),
    ],
  };

  it("accumulates and completes all twelve supported metrics from debriefs", () => {
    expect(Object.keys(successfulDebriefs)).toHaveLength(12);
    expect(new Set(
      MASTERY_CONTRACT_TEMPLATES.map((template) => template.target.metric),
    )).toEqual(new Set(Object.keys(successfulDebriefs)));

    for (const template of MASTERY_CONTRACT_TEMPLATES) {
      let progression = activeProgression(template);
      let meta = createEmptyMetaProgression();
      let result:
        | ReturnType<typeof applyMasteryPeriodDebrief>
        | undefined;
      for (const report of successfulDebriefs[template.target.metric](
        template,
        10,
      )) {
        result = applyMasteryPeriodDebrief(progression, meta, report);
        progression = result.progression;
        meta = result.meta;
      }
      expect(
        result?.outcome?.status,
        `${template.target.metric} should complete`,
      ).toBe("completed");
      expect(meta.completedContractIds).toContain(template.id);
      expect(result?.rewardGranted).toBe(true);
      expect(progression.activeContract).toBeUndefined();
    }
  });

  it("is idempotent by debrief sequence and fails unmet targets at expiry", () => {
    const template = templateByMetric("completed-visits");
    const first = applyMasteryPeriodDebrief(
      activeProgression(template),
      createEmptyMetaProgression(),
      debrief(10, { completedVisits: 5 }),
    );
    const repeated = applyMasteryPeriodDebrief(
      first.progression,
      first.meta,
      debrief(10, { completedVisits: 5 }),
    );
    expect(repeated.progression).toBe(first.progression);
    expect(
      repeated.progression.activeContract?.progress.completedVisits,
    ).toBe(5);

    let beforeLast = repeated;
    for (let sequence = 11; sequence < 10 + template.durationPeriods - 1; sequence += 1) {
      beforeLast = applyMasteryPeriodDebrief(
        beforeLast.progression,
        beforeLast.meta,
        debrief(sequence),
      );
    }
    const lastSequence = 10 + template.durationPeriods - 1;
    const failed = applyMasteryPeriodDebrief(
      beforeLast.progression,
      beforeLast.meta,
      debrief(lastSequence),
    );
    expect(failed.outcome).toMatchObject({
      status: "failed",
      endedAtPeriodSequence: lastSequence,
      rewardGranted: false,
    });
    expect(failed.progression.activeContract).toBeUndefined();

    const expired = expireMasteryContract(
      activeProgression(template),
      10 + template.durationPeriods,
    );
    expect(expired.lastOutcome?.status).toBe("failed");
  });

  it("counts Clean Ledger only for active refund-free periods", () => {
    const template = templateByMetric("periods-without-refund");
    const emptyPeriod = applyMasteryPeriodDebrief(
      activeProgression(template),
      createEmptyMetaProgression(),
      debrief(10),
    );
    expect(
      emptyPeriod.progression.activeContract?.progress.periodsWithoutRefund,
    ).toBe(0);

    const completedVisitPeriod = applyMasteryPeriodDebrief(
      emptyPeriod.progression,
      emptyPeriod.meta,
      debrief(11, { completedVisits: 1 }),
    );
    expect(
      completedVisitPeriod.progression.activeContract?.progress
        .periodsWithoutRefund,
    ).toBe(1);

    const positiveSalesPeriod = applyMasteryPeriodDebrief(
      completedVisitPeriod.progression,
      completedVisitPeriod.meta,
      debrief(12, { grossSalesCents: 100 }),
    );
    expect(
      positiveSalesPeriod.outcome?.progress.periodsWithoutRefund,
    ).toBe(2);
    expect(positiveSalesPeriod.outcome?.status).toBe("failed");
  });

  it("evaluates degradable guardrails only after the final eligible debrief", () => {
    const satisfaction = templateByMetric("minimum-satisfaction");
    const early = applyMasteryPeriodDebrief(
      activeProgression(satisfaction),
      createEmptyMetaProgression(),
      debrief(10, { completedVisits: 3, minimumSatisfaction: 90 }),
    );
    expect(early.outcome).toBeUndefined();
    const middle = applyMasteryPeriodDebrief(
      early.progression,
      early.meta,
      debrief(11, { completedVisits: 3, minimumSatisfaction: 82 }),
    );
    const degraded = applyMasteryPeriodDebrief(
      middle.progression,
      middle.meta,
      debrief(10 + satisfaction.durationPeriods - 1, {
        completedVisits: 3,
        minimumSatisfaction: 70,
      }),
    );
    expect(degraded.outcome?.status).toBe("failed");
    expect(degraded.outcome?.progress.minimumSatisfaction).toBe(70);

    const trayRate = templateByMetric("tray-return-rate-percent");
    const strongStart = applyMasteryPeriodDebrief(
      activeProgression(trayRate),
      createEmptyMetaProgression(),
      debrief(10, {
        trayReturns: 9,
        trayReturnOpportunities: 10,
      }),
    );
    const neutralMiddle = applyMasteryPeriodDebrief(
      strongStart.progression,
      strongStart.meta,
      debrief(11, {
        trayReturns: 4,
        trayReturnOpportunities: 5,
      }),
    );
    const weightedFailure = applyMasteryPeriodDebrief(
      neutralMiddle.progression,
      neutralMiddle.meta,
      debrief(10 + trayRate.durationPeriods - 1, {
        trayReturns: 0,
        trayReturnOpportunities: 10,
      }),
    );
    expect(weightedFailure.outcome?.status).toBe("failed");
    expect(
      deriveMasteryContractView(weightedFailure.outcome!).value,
    ).toBe(52);
  });

  it("requires every guardrail period to meet its frozen participation floor", () => {
    const cases = [
      {
        metric: "minimum-satisfaction" as const,
        lowSample: { completedVisits: 1, minimumSatisfaction: 100 },
        qualified: { completedVisits: 3, minimumSatisfaction: 90 },
      },
      {
        metric: "maximum-median-wait-seconds" as const,
        lowSample: { completedVisits: 1, medianWaitSeconds: 10 },
        qualified: { completedVisits: 3, medianWaitSeconds: 40 },
      },
      {
        metric: "tray-return-rate-percent" as const,
        lowSample: { trayReturns: 1, trayReturnOpportunities: 1 },
        qualified: { trayReturns: 4, trayReturnOpportunities: 4 },
      },
    ];

    for (const testCase of cases) {
      const template = templateByMetric(testCase.metric);
      const accepted = acceptMasteryContract(template, 1, 10);
      expect(accepted.qualification).toEqual(template.qualification);
      expect(accepted.qualification).not.toBe(template.qualification);

      let result = applyMasteryPeriodDebrief(
        activeProgression(template),
        createEmptyMetaProgression(),
        debrief(10, testCase.lowSample),
      );
      result = applyMasteryPeriodDebrief(
        result.progression,
        result.meta,
        debrief(11, testCase.qualified),
      );
      result = applyMasteryPeriodDebrief(
        result.progression,
        result.meta,
        debrief(12, testCase.qualified),
      );

      expect(result.outcome?.status, testCase.metric).toBe("failed");
      expect(
        result.outcome?.progress.qualifiedPeriodSequenceIds,
        testCase.metric,
      ).toEqual([11, 12]);
      expect(deriveMasteryContractView(result.outcome!)).toMatchObject({
        qualifiedPeriods: 2,
        requiredQualifiedPeriods: 3,
        qualificationSatisfied: false,
      });
    }
  });

  it("grants each frozen meta reward at most once", () => {
    const template = templateByMetric("completed-visits");
    const accepted = acceptMasteryContract(template, 1, 10);
    const previouslyCompleted = {
      ...createEmptyMetaProgression(),
      completedContractIds: [template.id],
    };
    const duplicate = recordMasteryCompletion(
      previouslyCompleted,
      {
        ...accepted,
        reward: {
          kind: "cosmetic",
          cosmeticId: "cosmetic.forged-second-reward",
        },
      },
    );
    expect(duplicate).toBe(previouslyCompleted);
    expect(duplicate.unlockedCosmeticIds).not.toContain(
      "cosmetic.forged-second-reward",
    );

    const result = applyMasteryPeriodDebrief(
      activeProgression(template),
      previouslyCompleted,
      debrief(10, { completedVisits: template.target.value }),
    );
    expect(result.outcome?.status).toBe("completed");
    expect(result.rewardGranted).toBe(false);
    expect(result.meta).toBe(previouslyCompleted);
  });

  it("atomically embeds debrief progress and its meta-only reward", () => {
    const template = templateByMetric("completed-visits");
    const meta = withMasteryProgression(
      createEmptyMetaProgression(),
      activeProgression(template),
    );
    const result = applyMasteryPeriodDebriefToMeta(
      meta,
      debrief(10, { completedVisits: template.target.value }),
    );
    expect(result.rewardGranted).toBe(true);
    expect(result.meta.mastery?.activeContract).toBeUndefined();
    expect(result.meta.mastery?.lastOutcome?.status).toBe("completed");
    expect(result.meta.completedContractIds).toContain(template.id);
    expect([
      ...result.meta.unlockedCosmeticIds,
      ...result.meta.unlockedTitleIds,
    ]).toHaveLength(1);
  });

  it("derives deterministic progress views from frozen state", () => {
    const template = templateByMetric("maximum-median-wait-seconds");
    const first = applyMasteryPeriodDebrief(
      activeProgression(template),
      createEmptyMetaProgression(),
      debrief(10, { completedVisits: 3, medianWaitSeconds: 65 }),
    );
    const active = first.progression.activeContract!;
    const firstView = deriveMasteryContractView(active);
    expect(deriveMasteryContractView(active)).toEqual(firstView);
    expect(firstView).toMatchObject({
      status: "active",
      templateId: template.id,
      metric: "maximum-median-wait-seconds",
      value: 65,
      target: 55,
      direction: "at-most",
      observed: true,
      satisfied: false,
      completedPeriods: 1,
      totalPeriods: template.durationPeriods,
      remainingPeriods: template.durationPeriods - 1,
      qualifiedPeriods: 1,
      requiredQualifiedPeriods: template.durationPeriods,
      qualificationSatisfied: false,
    });
    expect(firstView.progressBasisPoints).toBe(
      Math.floor((55 / 65) * 10_000),
    );
  });

  it("rejects malformed debrief metrics before state changes", () => {
    const progression = activeProgression(
      templateByMetric("completed-visits"),
    );
    expect(() =>
      applyMasteryPeriodDebrief(
        progression,
        createEmptyMetaProgression(),
        debrief(10, {
          trayReturns: 2,
          trayReturnOpportunities: 1,
        }),
      ),
    ).toThrow("cannot exceed");
    expect(progression.activeContract?.progress.completedVisits).toBe(0);
  });
});
