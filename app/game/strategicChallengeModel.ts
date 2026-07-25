import {
  MASTERY_CONTRACT_TEMPLATES,
  SCENARIOS,
  type MasteryContractQualification,
  type MasteryContractTemplate,
  type MasteryMetric,
  type ScenarioId,
} from "@/src/content/strategicGameplay";
import {
  deriveMasteryContractView,
  deriveMasteryOffer,
  type MasteryFeasibilityContext,
  type MasteryProgressionV1,
  type MetaProgressionV1,
} from "@/src/game/core/strategicProgression";
import { describeSgd, formatSgd } from "@/src/game/runtime/money";
import type { RuntimeSnapshot } from "@/src/game/runtime/types";
import type {
  ActiveMasteryContractView,
  MasteryContractChoiceView,
  MasteryContractOutcomeView,
  MasteryPanelView,
  ScenarioProgressById,
  StrategicMetaGalleryView,
} from "./StrategicChallenges";

const MASTERY_SEED = "hawker-balance-mastery-v1";

type MasterySnapshot = Pick<
  RuntimeSnapshot,
  | "level"
  | "day"
  | "servicePeriod"
  | "forecast"
  | "placedStalls"
  | "totalSeats"
  | "trayReturnStations"
  | "comboBoard"
  | "unlockedPreparationCount"
>;

export function masteryFeasibilityContext(
  snapshot: MasterySnapshot,
): MasteryFeasibilityContext {
  return {
    level: snapshot.level,
    openStallCount:
      snapshot.placedStalls.filter((stall) => stall.open).length,
    availableSeatCount: snapshot.totalSeats,
    comboBoardUnlocked: snapshot.comboBoard.unlocked,
    validComboOfferCount: snapshot.comboBoard.valid
      ? snapshot.comboBoard.configuredOfferCount
      : 0,
    trayReturnStationCount: snapshot.trayReturnStations,
    partyDemandAvailable: snapshot.forecast.groupSizeMix.some(
      (group) => group.size > 1 && group.basisPoints > 0,
    ),
    forecastNutritionIntentAvailable:
      snapshot.forecast.nutritionIntentIncidenceBasisPoints > 0 &&
      snapshot.forecast.nutritionIntents.length > 0,
    unlockedPreparationCount: snapshot.unlockedPreparationCount,
  };
}

function wordsFromId(id: string): string {
  const words = id
    .replace(/^[^.]+\./, "")
    .split(/[-.]/)
    .filter(Boolean)
    .join(" ");
  return words.replace(/\b\w/g, (character) => character.toUpperCase());
}

function metricValueLabel(metric: MasteryMetric, value: number): string {
  switch (metric) {
    case "gross-sales-cents":
    case "contribution-cents":
      return formatSgd(value);
    case "minimum-satisfaction":
      return `${value}% satisfaction`;
    case "maximum-median-wait-seconds":
      return `${value} seconds`;
    case "flow-seconds":
      return `${value} seconds`;
    case "tray-return-rate-percent":
      return `${value}%`;
    default:
      return new Intl.NumberFormat("en-SG").format(value);
  }
}

export function masteryTargetLabel(
  target: MasteryContractTemplate["target"],
): string {
  const value = metricValueLabel(target.metric, target.value);
  switch (target.metric) {
    case "completed-visits":
      return `${value} completed visits`;
    case "gross-sales-cents":
      return `${value} gross sales`;
    case "contribution-cents":
      return `${value} contribution`;
    case "minimum-satisfaction":
      return `At least ${value}`;
    case "maximum-median-wait-seconds":
      return `Median wait at most ${value}`;
    case "flow-seconds":
      return `${value} qualifying flow`;
    case "distinct-preparations":
      return `${value} distinct preparations`;
    case "party-visits":
      return `${value} completed party visits`;
    case "tray-return-rate-percent":
      return `At least ${value} tray-return rate`;
    case "forecast-needs-met":
      return `${value} forecast nutrition-intent matches`;
    case "periods-without-refund":
      return `${value} periods without a refund`;
    case "combo-visits":
      return `${value} completed Combo Board visits`;
  }
}

export function masteryTargetAccessibleLabel(
  target: MasteryContractTemplate["target"],
): string | undefined {
  switch (target.metric) {
    case "gross-sales-cents":
      return `${describeSgd(target.value)} gross sales`;
    case "contribution-cents":
      return `${describeSgd(target.value)} contribution`;
    default:
      return undefined;
  }
}

export function masteryQualificationLabel(
  qualification: MasteryContractQualification | undefined,
  durationPeriods: number,
): string | undefined {
  if (!qualification) return undefined;
  const requirements: string[] = [];
  if (qualification.minimumCompletedVisitsPerPeriod !== undefined) {
    requirements.push(
      `at least ${qualification.minimumCompletedVisitsPerPeriod} completed visits`,
    );
  }
  if (
    qualification.minimumTrayReturnOpportunitiesPerPeriod !== undefined
  ) {
    requirements.push(
      `at least ${qualification.minimumTrayReturnOpportunitiesPerPeriod} tray-return opportunities`,
    );
  }
  if (requirements.length === 0) return undefined;
  return `${
    requirements.join(" and ").replace(/^./, (letter) => letter.toUpperCase())
  } in each of ${durationPeriods} periods.`;
}

function masteryQualificationProgressLabel(
  qualifiedPeriods: number,
  requiredQualifiedPeriods: number,
): string {
  return `${qualifiedPeriods} of ${requiredQualifiedPeriods} periods qualified`;
}

export function masteryRewardLabel(
  reward: MasteryContractTemplate["reward"],
): string {
  return reward.kind === "title"
    ? `${wordsFromId(reward.titleId)} title`
    : `${wordsFromId(reward.cosmeticId)} cosmetic`;
}

function masteryChoice(
  template: MasteryContractTemplate,
  completedContractIds: readonly string[],
): MasteryContractChoiceView {
  const targetAccessibleLabel = masteryTargetAccessibleLabel(template.target);
  const qualificationLabel = masteryQualificationLabel(
    template.qualification,
    template.durationPeriods,
  );
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    durationPeriods: template.durationPeriods,
    targetLabel: masteryTargetLabel(template.target),
    ...(targetAccessibleLabel === undefined ? {} : { targetAccessibleLabel }),
    ...(qualificationLabel === undefined ? {} : { qualificationLabel }),
    rewardLabel: masteryRewardLabel(template.reward),
    previouslyCompleted: completedContractIds.includes(template.id),
  };
}

function activeMasteryView(
  progression: MasteryProgressionV1,
): ActiveMasteryContractView | undefined {
  const active = progression.activeContract;
  if (!active) return undefined;
  const template = MASTERY_CONTRACT_TEMPLATES.find(
    (candidate) => candidate.id === active.contract.templateId,
  );
  if (!template) return undefined;
  const view = deriveMasteryContractView(active);
  const targetAccessibleLabel = masteryTargetAccessibleLabel(
    active.contract.target,
  );
  const currentValue = view.value === undefined
    ? "No qualifying result yet"
    : `${metricValueLabel(view.metric, view.value)} of ${
      metricValueLabel(view.metric, view.target)
    }`;
  const qualificationLabel = masteryQualificationLabel(
    active.contract.qualification,
    active.contract.durationPeriods ?? view.totalPeriods,
  );
  return {
    id: template.id,
    title: template.title,
    targetLabel: masteryTargetLabel(active.contract.target),
    ...(targetAccessibleLabel === undefined ? {} : { targetAccessibleLabel }),
    ...(qualificationLabel === undefined
      ? {}
      : {
          qualificationLabel,
          qualificationProgressLabel: masteryQualificationProgressLabel(
            view.qualifiedPeriods,
            view.requiredQualifiedPeriods,
          ),
        }),
    rewardLabel: masteryRewardLabel(active.contract.reward),
    progressLabel: currentValue,
    progressPercent: view.progressBasisPoints / 100,
    periodsRemaining: view.remainingPeriods,
  };
}

function masteryMetricAccessibleValue(
  metric: MasteryMetric,
  value: number,
): string | undefined {
  return metric === "gross-sales-cents" || metric === "contribution-cents"
    ? describeSgd(value)
    : undefined;
}

function masteryOutcomeView(
  progression: MasteryProgressionV1,
  currentRotation: number,
): MasteryContractOutcomeView | undefined {
  const outcome = progression.lastOutcome;
  if (
    !outcome ||
    progression.decidedRotation !== currentRotation ||
    progression.decision !== "accepted"
  ) {
    return undefined;
  }
  const template = MASTERY_CONTRACT_TEMPLATES.find(
    (candidate) => candidate.id === outcome.contract.templateId,
  );
  const view = deriveMasteryContractView(outcome);
  const value = view.value;
  const resultLabel = value === undefined
    ? "No qualifying result recorded"
    : metricValueLabel(view.metric, value);
  const targetLabel = masteryTargetLabel(outcome.contract.target);
  const targetAccessibleLabel = masteryTargetAccessibleLabel(
    outcome.contract.target,
  );
  const qualificationLabel = masteryQualificationLabel(
    outcome.contract.qualification,
    outcome.contract.durationPeriods ?? view.totalPeriods,
  );
  const resultAccessibleLabel = value === undefined
    ? undefined
    : masteryMetricAccessibleValue(view.metric, value);
  const shortfall = value === undefined
    ? undefined
    : view.direction === "at-most"
      ? Math.max(0, value - view.target)
      : Math.max(0, view.target - value);
  const shortfallLabel = outcome.status === "failed"
    ? value === undefined
      ? "No qualifying result was recorded before the contract ended."
      : shortfall && shortfall > 0
        ? view.direction === "at-most"
          ? `${metricValueLabel(view.metric, shortfall)} over the limit`
          : `${metricValueLabel(view.metric, shortfall)} short of the target`
        : view.qualificationSatisfied
          ? "The target value was reached, but a required qualifying result was not sustained."
          : `The target value was reached, but only ${view.qualifiedPeriods} of ${view.requiredQualifiedPeriods} periods qualified.`
    : undefined;
  const shortfallAccessibleLabel =
    outcome.status === "failed" && shortfall && shortfall > 0
      ? masteryMetricAccessibleValue(view.metric, shortfall) === undefined
        ? undefined
        : view.direction === "at-most"
          ? `${masteryMetricAccessibleValue(
              view.metric,
              shortfall,
            )} over the limit`
          : `${masteryMetricAccessibleValue(
              view.metric,
              shortfall,
            )} short of the target`
      : undefined;
  return {
    status: outcome.status,
    title: template?.title ?? wordsFromId(outcome.contract.templateId),
    targetLabel,
    ...(targetAccessibleLabel === undefined ? {} : { targetAccessibleLabel }),
    ...(qualificationLabel === undefined
      ? {}
      : {
          qualificationLabel,
          qualificationProgressLabel: masteryQualificationProgressLabel(
            view.qualifiedPeriods,
            view.requiredQualifiedPeriods,
          ),
        }),
    resultLabel,
    ...(resultAccessibleLabel === undefined ? {} : { resultAccessibleLabel }),
    ...(shortfallLabel === undefined ? {} : { shortfallLabel }),
    ...(shortfallAccessibleLabel === undefined
      ? {}
      : { shortfallAccessibleLabel }),
    rewardLabel: masteryRewardLabel(outcome.contract.reward),
    rewardGranted: outcome.rewardGranted,
    nextOfferLabel:
      `The next rotation begins on day ${(currentRotation + 1) * 7 + 1}.`,
  };
}

export function buildMasteryPanelView(
  snapshot: MasterySnapshot,
  progression: MasteryProgressionV1,
  meta: MetaProgressionV1,
): MasteryPanelView {
  if (snapshot.level < 13) return { kind: "locked" };
  const active = activeMasteryView(progression);
  if (active) return { kind: "active", contract: active };

  const offer = deriveMasteryOffer({
    seed: MASTERY_SEED,
    day: snapshot.day,
    periodId: snapshot.servicePeriod.id,
    context: masteryFeasibilityContext(snapshot),
    progression,
    meta,
  });
  if (offer.status === "available") {
    return {
      kind: "offer",
      rotationLabel:
        `Days ${offer.availableFromDay}–${offer.availableThroughDay}`,
      choices: [
        masteryChoice(offer.choices[0], meta.completedContractIds),
        masteryChoice(offer.choices[1], meta.completedContractIds),
        masteryChoice(offer.choices[2], meta.completedContractIds),
      ],
    };
  }
  if (
    offer.reason === "rotation-decided" &&
    progression.decision === "skipped"
  ) {
    return {
      kind: "skipped",
      nextOfferLabel: `The next rotation begins on day ${
        (offer.rotation + 1) * 7 + 1
      }.`,
    };
  }
  if (offer.reason === "rotation-decided") {
    const outcome = masteryOutcomeView(progression, offer.rotation);
    if (outcome) return { kind: "outcome", outcome };
  }
  const explanation = {
    "mastery-locked": "Reach level 13 to unlock mastery contracts.",
    "breakfast-only":
      "New choices appear during breakfast planning. An active contract continues across periods.",
    "active-contract": "Finish the accepted contract before choosing another.",
    "rotation-decided":
      "This rotation is settled. The next set arrives after seven in-game days.",
    "fewer-than-three-feasible-contracts":
      `Only ${offer.feasibleChoiceCount} contract${
        offer.feasibleChoiceCount === 1 ? " is" : "s are"
      } feasible with the current centre. Add service capacity before the next breakfast.`,
  }[offer.reason];
  return { kind: "unavailable", explanation };
}

export function buildScenarioProgress(
  hasSaveById: Readonly<Partial<Record<ScenarioId, boolean>>>,
  meta: MetaProgressionV1,
): ScenarioProgressById {
  return Object.fromEntries(SCENARIOS.map((scenario) => [
    scenario.id,
    {
      hasSave: hasSaveById[scenario.id] === true,
      bestMedal: meta.scenarioMedals[scenario.id],
    },
  ]));
}

export function buildMetaGallery(
  meta: MetaProgressionV1,
): StrategicMetaGalleryView {
  const titleIds = MASTERY_CONTRACT_TEMPLATES.flatMap((template) =>
    template.reward.kind === "title" ? [template.reward.titleId] : []
  );
  const cosmeticIds = [
    ...SCENARIOS.flatMap((scenario) =>
      Object.values(scenario.cosmeticRewardIds)
    ),
    ...MASTERY_CONTRACT_TEMPLATES.flatMap((template) =>
      template.reward.kind === "cosmetic"
        ? [template.reward.cosmeticId]
        : []
    ),
  ];
  return {
    titles: [...new Set(titleIds)].sort().map((id) => ({
      id,
      label: wordsFromId(id),
      description: "Earned from a completed mastery contract.",
      unlocked: meta.unlockedTitleIds.includes(id),
    })),
    cosmetics: [...new Set(cosmeticIds)].sort().map((id) => ({
      id,
      label: wordsFromId(id),
      description: "A visual keepsake from a scenario medal or mastery contract.",
      unlocked: meta.unlockedCosmeticIds.includes(id),
    })),
  };
}
