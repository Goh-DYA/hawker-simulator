"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Award, Medal } from "lucide-react";
import {
  SCENARIOS,
  type MasteryContractTemplate,
  type ScenarioDefinition,
  type ScenarioId,
  type ScenarioMedal,
} from "@/src/content/strategicGameplay";
import { scenarioMedalEligibilityLabels } from "@/src/game/core/scenarios";
import { describeSgd, formatSgd } from "@/src/game/runtime/money";

const SCENARIO_UNLOCK_LEVEL = 3;
const MASTERY_UNLOCK_LEVEL = 13;

const SCENARIO_MAP_LABELS: Readonly<Record<ScenarioId, string>> = {
  "scenario.narrow-aisles": "Compact two-aisle plan",
  "scenario.split-hall": "East and west seating zones",
  "scenario.limited-cash": "Lean starter plan",
  "scenario.menu-diversity": "Three-role showcase plan",
  "scenario.peak-throughput": "Rush-service plan",
};

const MEDAL_LABELS: Readonly<Record<ScenarioMedal, string>> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

function keepsakeLabel(id: string): string {
  return id
    .replace(/^cosmetic\./, "")
    .split("-")
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

export interface ScenarioCardProgressView {
  readonly hasSave: boolean;
  readonly bestMedal?: ScenarioMedal;
  readonly latestScoreLabel?: string;
}

export type ScenarioProgressById = Readonly<
  Partial<Record<ScenarioId, ScenarioCardProgressView>>
>;

export interface ActiveScenarioView {
  readonly scenarioId: ScenarioId;
  readonly cashCents: number;
  readonly periodLabel: string;
  readonly scoreLabel: string;
  readonly objectiveLabel: string;
  readonly projectedMedal?: ScenarioMedal;
  readonly saveStatusLabel: string;
}

export interface MasteryContractChoiceView {
  readonly id: MasteryContractTemplate["id"];
  readonly title: string;
  readonly description: string;
  readonly durationPeriods: number;
  readonly targetLabel: string;
  readonly targetAccessibleLabel?: string;
  readonly qualificationLabel?: string;
  readonly rewardLabel: string;
  readonly previouslyCompleted: boolean;
}

export type MasteryContractOfferTuple = readonly [
  MasteryContractChoiceView,
  MasteryContractChoiceView,
  MasteryContractChoiceView,
];

export interface ActiveMasteryContractView {
  readonly id: MasteryContractTemplate["id"];
  readonly title: string;
  readonly targetLabel: string;
  readonly targetAccessibleLabel?: string;
  readonly qualificationLabel?: string;
  readonly qualificationProgressLabel?: string;
  readonly rewardLabel: string;
  readonly progressLabel: string;
  readonly progressPercent: number;
  readonly periodsRemaining: number;
}

export interface MasteryContractOutcomeView {
  readonly status: "completed" | "failed";
  readonly title: string;
  readonly targetLabel: string;
  readonly targetAccessibleLabel?: string;
  readonly qualificationLabel?: string;
  readonly qualificationProgressLabel?: string;
  readonly resultLabel: string;
  readonly resultAccessibleLabel?: string;
  readonly shortfallLabel?: string;
  readonly shortfallAccessibleLabel?: string;
  readonly rewardLabel: string;
  readonly rewardGranted: boolean;
  readonly nextOfferLabel: string;
}

export type MasteryPanelView =
  | {
      readonly kind: "locked";
    }
  | {
      readonly kind: "offer";
      readonly rotationLabel: string;
      readonly choices: MasteryContractOfferTuple;
    }
  | {
      readonly kind: "active";
      readonly contract: ActiveMasteryContractView;
    }
  | {
      readonly kind: "outcome";
      readonly outcome: MasteryContractOutcomeView;
    }
  | {
      readonly kind: "skipped";
      readonly nextOfferLabel: string;
    }
  | {
      readonly kind: "unavailable";
      readonly explanation: string;
    };

export interface MetaGalleryItemView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly unlocked: boolean;
}

export interface StrategicMetaGalleryView {
  readonly titles: readonly MetaGalleryItemView[];
  readonly cosmetics: readonly MetaGalleryItemView[];
}

export interface StrategicChallengesProps {
  readonly level: number;
  readonly scenarioProgress: ScenarioProgressById;
  readonly activeScenario?: ActiveScenarioView;
  readonly mastery: MasteryPanelView;
  readonly masteryDecisionBusy?: boolean;
  readonly gallery: StrategicMetaGalleryView;
  readonly onStartScenario: (scenarioId: ScenarioId) => void;
  readonly onResumeScenario: (scenarioId: ScenarioId) => void;
  readonly onLeaveScenario: (scenarioId: ScenarioId) => void;
  readonly onRestartScenario: (scenarioId: ScenarioId) => Promise<boolean>;
  readonly onAcceptMasteryContract: (
    contractId: MasteryContractTemplate["id"],
  ) => void;
  readonly onSkipMasteryContracts: () => void;
}

function SgdAmount({ cents }: { readonly cents: number }) {
  return (
    <span className="strategic-sgd-amount">
      <span aria-hidden="true">{formatSgd(cents)}</span>
      <span className="sr-only">{describeSgd(cents)}</span>
    </span>
  );
}

function AccessibleText({
  visible,
  accessible,
}: {
  readonly visible: string;
  readonly accessible?: string;
}) {
  if (!accessible) return visible;
  return (
    <>
      <span aria-hidden="true">{visible}</span>
      <span className="sr-only">{accessible}</span>
    </>
  );
}

function scenarioModifierLabels(
  scenario: ScenarioDefinition,
): readonly string[] {
  switch (scenario.modifiers.kind) {
    case "narrow-aisles":
      return [
        `${scenario.modifiers.aisleWidthTiles}-tile aisles`,
        `${scenario.modifiers.arrivalBasisPoints / 100}% arrival volume`,
      ];
    case "split-hall":
      return [
        `${scenario.modifiers.seatingZones} seating zones`,
        `${scenario.modifiers.crossHallDistanceTiles}-tile cross-hall route`,
      ];
    case "limited-cash":
      return [
        `${scenario.modifiers.startingFixtures} starter fixtures`,
        scenario.modifiers.purchaseCostBasisPoints === 10_000
          ? "Standard purchase costs"
          : `${scenario.modifiers.purchaseCostBasisPoints / 100}% purchase costs`,
      ];
    case "menu-diversity":
      return [
        `${scenario.modifiers.requiredMealRoles} meal roles available`,
        `At least ${scenario.modifiers.minimumDistinctPreparations} preparations available`,
      ];
    case "peak-throughput":
      return [
        `${scenario.modifiers.arrivalBasisPoints / 100}% arrival volume`,
        `Median wait cap ${scenario.modifiers.maximumMedianWaitMs / 1_000} seconds`,
      ];
  }
}

function scenarioScoreLabel(scenario: ScenarioDefinition): string {
  switch (scenario.scoreUnit) {
    case "points":
      return "Balanced service score";
    case "contribution-cents":
      return "Positive contribution";
    case "distinct-preparations":
      return "Distinct preparations served";
    case "completed-visits":
      return "Completed visits";
  }
}

function scenarioThresholdLabel(
  scenario: ScenarioDefinition,
  medal: ScenarioMedal,
): string {
  const threshold = scenario.medalThresholds[medal];
  switch (scenario.scoreUnit) {
    case "contribution-cents":
      return formatSgd(threshold);
    case "points":
      return `${threshold} points`;
    case "distinct-preparations":
      return `${threshold} preparations`;
    case "completed-visits":
      return `${threshold} visits`;
  }
}

function ScenarioThreshold({
  scenario,
  medal,
}: {
  readonly scenario: ScenarioDefinition;
  readonly medal: ScenarioMedal;
}) {
  const threshold = scenario.medalThresholds[medal];
  return scenario.scoreUnit === "contribution-cents"
    ? <SgdAmount cents={threshold} />
    : scenarioThresholdLabel(scenario, medal);
}

function scenarioActionLabel(
  scenario: ScenarioDefinition,
  progress: ScenarioCardProgressView | undefined,
): string {
  if (progress?.hasSave) return `Resume ${scenario.name}`;
  if (progress?.bestMedal) return `Play ${scenario.name} again`;
  return `Start ${scenario.name}`;
}

function clampPercentage(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

export function restartDialogFocusAction(
  key: string,
  shiftKey: boolean,
  focusableCount: number,
  atFirst: boolean,
  atLast: boolean,
): "dismiss" | "container" | "first" | "last" | undefined {
  if (key === "Escape") return "dismiss";
  if (key !== "Tab") return undefined;
  if (focusableCount === 0) return "container";
  if (shiftKey && atFirst) return "last";
  if (!shiftKey && atLast) return "first";
  return undefined;
}

function ScenarioCard({
  scenario,
  level,
  progress,
  activeScenarioId,
  onStart,
  onResume,
}: {
  readonly scenario: ScenarioDefinition;
  readonly level: number;
  readonly progress?: ScenarioCardProgressView;
  readonly activeScenarioId?: ScenarioId;
  readonly onStart: (scenarioId: ScenarioId) => void;
  readonly onResume: (scenarioId: ScenarioId) => void;
}) {
  const unlocked = level >= scenario.unlockLevel;
  const isActive = activeScenarioId === scenario.id;
  const anotherScenarioActive =
    activeScenarioId !== undefined && !isActive;
  const activeScenarioName = SCENARIOS.find(
    (candidate) => candidate.id === activeScenarioId,
  )?.name;
  const actionLabel = scenarioActionLabel(scenario, progress);
  return (
    <article
      className="strategic-scenario-card"
      data-locked={!unlocked}
      data-scenario-id={scenario.id}
      aria-labelledby={`${scenario.id}-title`}
    >
      <header>
        <span className="strategic-scenario-number" aria-hidden="true">
          {String(
            SCENARIOS.findIndex((candidate) => candidate.id === scenario.id) + 1,
          ).padStart(2, "0")}
        </span>
        <div>
          <h4 id={`${scenario.id}-title`}>{scenario.name}</h4>
          <p>{scenario.description}</p>
        </div>
        <span
          className="strategic-medal-chip"
          data-medal={progress?.bestMedal ?? "none"}
        >
          {progress?.bestMedal
            ? `${MEDAL_LABELS[progress.bestMedal]} best`
            : "No medal yet"}
        </span>
      </header>

      <dl className="strategic-scenario-facts">
        <div>
          <dt>Starting balance</dt>
          <dd>
            <SgdAmount cents={scenario.startingCashCents} />
          </dd>
        </div>
        <div>
          <dt>Map</dt>
          <dd>{SCENARIO_MAP_LABELS[scenario.id]}</dd>
        </div>
        <div>
          <dt>Scoring focus</dt>
          <dd>{scenarioScoreLabel(scenario)}</dd>
        </div>
        <div>
          <dt>Medal keepsakes</dt>
          <dd>
            {(["bronze", "silver", "gold"] as const)
              .map((medal) => keepsakeLabel(
                scenario.cosmeticRewardIds[medal],
              ))
              .join(" · ")}
          </dd>
        </div>
      </dl>

      <ul className="strategic-modifier-list" aria-label="Scenario modifiers">
        {scenarioModifierLabels(scenario).map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>

      <div className="strategic-planning-notes">
        <strong>Planning notes</strong>
        <ul aria-label={`${scenario.name} planning notes`}>
          {scenario.planningNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <dl className="strategic-medal-thresholds" aria-label="Medal thresholds">
        {(["bronze", "silver", "gold"] as const).map((medal) => (
          <div key={medal}>
            <dt>{MEDAL_LABELS[medal]}</dt>
            <dd>
              <ScenarioThreshold scenario={scenario} medal={medal} />
              <ul aria-label={`${MEDAL_LABELS[medal]} eligibility`}>
                {scenarioMedalEligibilityLabels(scenario.id, medal).map(
                  (label) => <li key={label}>{label}</li>,
                )}
              </ul>
            </dd>
          </div>
        ))}
      </dl>

      <footer>
        <span>
          {isActive
            ? "This isolated scenario is currently open."
            : anotherScenarioActive
            ? `Save and return from ${
              activeScenarioName ?? "the active scenario"
            } before switching.`
            : unlocked
            ? progress?.latestScoreLabel ?? "A separate scenario save protects your main centre."
            : `Unlocks at level ${SCENARIO_UNLOCK_LEVEL}`}
        </span>
        <button
          type="button"
          disabled={!unlocked || activeScenarioId !== undefined}
          aria-label={
            isActive
              ? `${scenario.name} is the active scenario`
              : anotherScenarioActive
              ? `Save and return from ${
                activeScenarioName ?? "the active scenario"
              } before opening ${scenario.name}`
              : unlocked
                ? actionLabel
                : `${scenario.name} unlocks at level 3`
          }
          onClick={() => {
            if (!unlocked || activeScenarioId !== undefined) return;
            if (progress?.hasSave) {
              onResume(scenario.id);
            } else {
              onStart(scenario.id);
            }
          }}
        >
          {isActive
            ? "Active"
            : anotherScenarioActive
            ? "Return first"
            : unlocked
            ? progress?.hasSave
              ? "Resume"
              : progress?.bestMedal
                ? "Play again"
                : "Start"
            : "Level 3"}
        </button>
      </footer>
    </article>
  );
}

function ActiveScenarioHud({
  scenario,
  onLeave,
  onRestart,
}: {
  readonly scenario: ActiveScenarioView;
  readonly onLeave: (scenarioId: ScenarioId) => void;
  readonly onRestart: (scenarioId: ScenarioId) => Promise<boolean>;
}) {
  const [restartConfirmationOpen, setRestartConfirmationOpen] = useState(false);
  const [restartBusy, setRestartBusy] = useState(false);
  const activeScenarioRef = useRef<HTMLElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  const restartDialogRef = useRef<HTMLDivElement>(null);
  const definition = SCENARIOS.find(
    (candidate) => candidate.id === scenario.scenarioId,
  );
  useEffect(() => {
    if (!restartConfirmationOpen) return;
    const dialog = restartDialogRef.current;
    if (!dialog) return;
    const background = activeScenarioRef.current?.closest<HTMLElement>(
      ".catalogue-panel",
    );
    const backgroundWasInert = background?.inert ?? false;
    if (background) background.inert = true;
    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) =>
          !element.hidden && element.getAttribute("aria-hidden") !== "true",
      );
    const initialFocusFrame = window.requestAnimationFrame(() => {
      dialog
        .querySelector<HTMLButtonElement>("[data-restart-cancel]")
        ?.focus();
    });
    const handleDialogKeys = (event: KeyboardEvent) => {
      const available = focusables();
      const first = available[0];
      const last = available.at(-1);
      const action = restartDialogFocusAction(
        event.key,
        event.shiftKey,
        available.length,
        document.activeElement === first || !dialog.contains(document.activeElement),
        document.activeElement === last || !dialog.contains(document.activeElement),
      );
      if (action === "dismiss") {
        event.preventDefault();
        setRestartConfirmationOpen(false);
        window.requestAnimationFrame(() => restartButtonRef.current?.focus());
      } else if (action === "container") {
        event.preventDefault();
        dialog.focus();
      } else if (action === "last") {
        event.preventDefault();
        last?.focus();
      } else if (action === "first") {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(initialFocusFrame);
      dialog.removeEventListener("keydown", handleDialogKeys);
      if (background) background.inert = backgroundWasInert;
    };
  }, [restartConfirmationOpen]);
  if (!definition) return null;
  const closeRestartConfirmation = () => {
    setRestartConfirmationOpen(false);
    window.requestAnimationFrame(() => restartButtonRef.current?.focus());
  };
  const confirmRestart = async () => {
    if (restartBusy) return;
    setRestartBusy(true);
    setRestartConfirmationOpen(false);
    const restarted = await onRestart(scenario.scenarioId);
    setRestartBusy(false);
    if (restarted) {
      // The parent clears its inert local-data state when the asynchronous
      // scope replacement resolves. Wait through that committed paint before
      // restoring focus to the refreshed scenario summary.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => activeScenarioRef.current?.focus());
      });
    } else {
      setRestartConfirmationOpen(true);
    }
  };
  return (
    <section
      ref={activeScenarioRef}
      className="strategic-active-scenario"
      aria-labelledby="strategic-active-scenario-title"
      tabIndex={-1}
    >
      <header>
        <div>
          <span>Isolated scenario</span>
          <h3 id="strategic-active-scenario-title">{definition.name}</h3>
        </div>
        {scenario.projectedMedal ? (
          <strong data-medal={scenario.projectedMedal}>
            {MEDAL_LABELS[scenario.projectedMedal]} confirmed at debrief
          </strong>
        ) : (
          <strong>Medal confirmed at debrief</strong>
        )}
      </header>
      <dl>
        <div>
          <dt>Scenario cash</dt>
          <dd>
            <SgdAmount cents={scenario.cashCents} />
          </dd>
        </div>
        <div>
          <dt>Now serving</dt>
          <dd>{scenario.periodLabel}</dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{scenario.scoreLabel}</dd>
        </div>
        <div>
          <dt>Objective</dt>
          <dd>{scenario.objectiveLabel}</dd>
        </div>
      </dl>
      <footer>
        <span>{scenario.saveStatusLabel}</span>
        <div className="strategic-active-scenario-actions">
          <button
            ref={restartButtonRef}
            type="button"
            className="secondary-button"
            aria-label={`Restart ${definition.name} from its authored setup`}
            onClick={() => setRestartConfirmationOpen(true)}
          >
            Restart scenario
          </button>
          <button
            type="button"
            aria-label={`Save ${definition.name} and return to the main centre`}
            onClick={() => onLeave(scenario.scenarioId)}
          >
            Save and return
          </button>
        </div>
      </footer>
      {restartConfirmationOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={restartDialogRef}
              className="strategic-restart-confirmation"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="strategic-restart-title"
              aria-describedby="strategic-restart-description"
              tabIndex={-1}
            >
              <div className="strategic-restart-confirmation-card">
                <strong id="strategic-restart-title">
                  Restart {definition.name}?
                </strong>
                <p id="strategic-restart-description">
                  This replaces only this scenario&apos;s in-progress save with
                  its authored map, seed, starting Singapore dollars, and unlock
                  set. Main-centre progress and earned gallery rewards stay
                  unchanged.
                </p>
                <div>
                  <button
                    type="button"
                    data-restart-cancel
                    onClick={closeRestartConfirmation}
                  >
                    Keep this run
                  </button>
                  <button
                    type="button"
                    data-restart-confirm
                    disabled={restartBusy}
                    onClick={() => {
                      void confirmRestart();
                    }}
                  >
                    {restartBusy ? "Restarting…" : "Restart this scenario"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function MasteryPanel({
  level,
  mastery,
  decisionBusy,
  scenarioActive,
  onAccept,
  onSkip,
}: {
  readonly level: number;
  readonly mastery: MasteryPanelView;
  readonly decisionBusy: boolean;
  readonly scenarioActive: boolean;
  readonly onAccept: (contractId: MasteryContractTemplate["id"]) => void;
  readonly onSkip: () => void;
}) {
  const effectiveMastery: MasteryPanelView =
    level < MASTERY_UNLOCK_LEVEL ? { kind: "locked" } : mastery;
  return (
    <section
      className="strategic-mastery-panel"
      aria-labelledby="strategic-mastery-title"
      tabIndex={-1}
    >
      <header>
        <div>
          <span>Long-form mastery</span>
          <h3 id="strategic-mastery-title">Mastery contracts</h3>
        </div>
        <em>Cosmetics and titles only</em>
      </header>

      {effectiveMastery.kind === "locked" ? (
        <div className="strategic-locked-copy">
          <strong>Unlocks at level 13</strong>
          <p>
            Contracts build on service, layout, forecast, and Combo Board
            decisions. They never change main-centre cash or XP.
          </p>
        </div>
      ) : null}

      {effectiveMastery.kind === "offer" ? (
        <>
          <div className="strategic-mastery-offer-heading">
            <p>
              Choose one breakfast offer, or skip without penalty. Its target
              and reward freeze when accepted.
            </p>
            <span>{effectiveMastery.rotationLabel}</span>
          </div>
          <div
            className="strategic-contract-grid"
            aria-label="Three mastery contract choices"
          >
            {effectiveMastery.choices.map((choice) => (
              <article key={choice.id}>
                <header>
                  <h4>{choice.title}</h4>
                  <span>{choice.durationPeriods} periods</span>
                </header>
                <p>{choice.description}</p>
                {choice.previouslyCompleted ? (
                  <p className="strategic-contract-repeat">
                    Practice replay · this reward is already in your gallery and
                    will not be awarded twice.
                  </p>
                ) : null}
                <dl>
                  <div>
                    <dt>Target</dt>
                    <dd>
                      <AccessibleText
                        visible={choice.targetLabel}
                        accessible={choice.targetAccessibleLabel}
                      />
                    </dd>
                  </div>
                  {choice.qualificationLabel ? (
                    <div>
                      <dt>Qualification</dt>
                      <dd>{choice.qualificationLabel}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Reward</dt>
                    <dd>{choice.rewardLabel}</dd>
                  </div>
                </dl>
                <button
                  className="strategic-contract-accept"
                  type="button"
                  aria-label={`${
                    choice.previouslyCompleted ? "Replay" : "Accept"
                  } ${choice.title}; target ${
                   choice.targetAccessibleLabel ?? choice.targetLabel
                  }${
                    choice.qualificationLabel
                      ? `; qualification ${choice.qualificationLabel}`
                      : ""
                  }; ${
                    choice.previouslyCompleted
                      ? "reward already earned"
                      : `reward ${choice.rewardLabel}`
                  }`}
                  disabled={decisionBusy}
                  onClick={() => onAccept(choice.id)}
                >
                  {choice.previouslyCompleted
                    ? "Replay contract"
                    : "Accept contract"}
                </button>
              </article>
            ))}
          </div>
          <button
            className="strategic-contract-skip"
            type="button"
            aria-label="Skip this mastery contract rotation without penalty"
            disabled={decisionBusy}
            onClick={onSkip}
          >
            Skip this rotation
          </button>
          {decisionBusy ? (
            <p className="strategic-contract-decision-status" role="status">
              Saving your mastery decision\u2026
            </p>
          ) : null}
        </>
      ) : null}

      {effectiveMastery.kind === "active" ? (
        <article className="strategic-active-contract" tabIndex={-1}>
          <header>
            <div>
              <span>Accepted contract</span>
              <h4>{effectiveMastery.contract.title}</h4>
            </div>
            <strong>
              {effectiveMastery.contract.periodsRemaining} periods left
            </strong>
          </header>
          {scenarioActive ? (
            <p className="strategic-contract-pause-note" role="status">
              Paused during scenario play. Only main-centre period debriefs
              advance this contract.
            </p>
          ) : null}
          <dl>
            <div>
              <dt>Frozen target</dt>
              <dd>
                <AccessibleText
                  visible={effectiveMastery.contract.targetLabel}
                  accessible={
                    effectiveMastery.contract.targetAccessibleLabel
                  }
                />
              </dd>
            </div>
            <div>
              <dt>Frozen reward</dt>
              <dd>{effectiveMastery.contract.rewardLabel}</dd>
            </div>
            {effectiveMastery.contract.qualificationLabel ? (
              <div>
                <dt>Frozen qualification</dt>
                <dd>{effectiveMastery.contract.qualificationLabel}</dd>
              </div>
            ) : null}
            {effectiveMastery.contract.qualificationProgressLabel ? (
              <div>
                <dt>Qualification progress</dt>
                <dd>{effectiveMastery.contract.qualificationProgressLabel}</dd>
              </div>
            ) : null}
          </dl>
          <div
            className="strategic-contract-progress"
            role="progressbar"
            aria-label={`${effectiveMastery.contract.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clampPercentage(
              effectiveMastery.contract.progressPercent,
            )}
            aria-valuetext={effectiveMastery.contract.progressLabel}
          >
            <span>{effectiveMastery.contract.progressLabel}</span>
            <i
              aria-hidden="true"
              style={{
                width: `${clampPercentage(
                  effectiveMastery.contract.progressPercent,
                )}%`,
              }}
            />
          </div>
        </article>
      ) : null}

      {effectiveMastery.kind === "outcome" ? (
        <article
          className="strategic-active-contract"
          data-outcome={effectiveMastery.outcome.status}
          tabIndex={-1}
        >
          <header>
            <div>
              <span>Contract result</span>
              <h4>{effectiveMastery.outcome.title}</h4>
            </div>
            <strong>
              {effectiveMastery.outcome.status === "completed"
                ? "Completed"
                : "Target not met"}
            </strong>
          </header>
          <dl>
            <div>
              <dt>Frozen target</dt>
              <dd>
                <AccessibleText
                  visible={effectiveMastery.outcome.targetLabel}
                  accessible={effectiveMastery.outcome.targetAccessibleLabel}
                />
              </dd>
            </div>
            <div>
              <dt>Final result</dt>
              <dd>
                <AccessibleText
                  visible={effectiveMastery.outcome.resultLabel}
                  accessible={effectiveMastery.outcome.resultAccessibleLabel}
                />
              </dd>
            </div>
            {effectiveMastery.outcome.qualificationLabel ? (
              <div>
                <dt>Frozen qualification</dt>
                <dd>{effectiveMastery.outcome.qualificationLabel}</dd>
              </div>
            ) : null}
            {effectiveMastery.outcome.qualificationProgressLabel ? (
              <div>
                <dt>Qualification result</dt>
                <dd>{effectiveMastery.outcome.qualificationProgressLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>Outcome</dt>
              <dd>
                {effectiveMastery.outcome.shortfallLabel ? (
                  <AccessibleText
                    visible={effectiveMastery.outcome.shortfallLabel}
                    accessible={
                      effectiveMastery.outcome.shortfallAccessibleLabel
                    }
                  />
                ) : (
                  "The frozen target was met."
                )}
              </dd>
            </div>
            <div>
              <dt>Gallery reward</dt>
              <dd>
                {effectiveMastery.outcome.rewardGranted
                  ? `${effectiveMastery.outcome.rewardLabel} earned`
                  : effectiveMastery.outcome.status === "completed"
                    ? `${effectiveMastery.outcome.rewardLabel} was already earned`
                    : `${effectiveMastery.outcome.rewardLabel} was not awarded`}
              </dd>
            </div>
          </dl>
          <p>{effectiveMastery.outcome.nextOfferLabel}</p>
        </article>
      ) : null}

      {effectiveMastery.kind === "skipped" ? (
        <div className="strategic-neutral-copy">
          <strong>Rotation skipped</strong>
          <p>No penalty was applied. {effectiveMastery.nextOfferLabel}</p>
        </div>
      ) : null}

      {effectiveMastery.kind === "unavailable" ? (
        <div className="strategic-neutral-copy">
          <strong>No feasible contract offer yet</strong>
          <p>{effectiveMastery.explanation}</p>
        </div>
      ) : null}
    </section>
  );
}

function GalleryItems({
  heading,
  items,
}: {
  readonly heading: string;
  readonly items: readonly MetaGalleryItemView[];
}) {
  return (
    <section>
      <h4>{heading}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item.id} data-unlocked={item.unlocked}>
              <span>
                <Award aria-hidden="true" size={16} strokeWidth={2.4} />
                {item.unlocked ? "Earned" : "Locked"}
              </span>
              <div>
                <strong>{item.unlocked ? item.label : "Locked"}</strong>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="strategic-gallery-empty">
          Rewards earned from scenarios and contracts will appear here.
        </p>
      )}
    </section>
  );
}

function MetaGallery({
  scenarioProgress,
  gallery,
}: {
  readonly scenarioProgress: ScenarioProgressById;
  readonly gallery: StrategicMetaGalleryView;
}) {
  return (
    <section
      className="strategic-meta-gallery"
      aria-labelledby="strategic-meta-gallery-title"
    >
      <header>
        <div>
          <span>Preserved progression</span>
          <h3 id="strategic-meta-gallery-title">Neighbourhood gallery</h3>
        </div>
        <p>Main reset keeps these medals, titles, and cosmetics.</p>
      </header>
      <section className="strategic-medal-gallery">
        <h4>Scenario medals</h4>
        <ul>
          {SCENARIOS.map((scenario) => {
            const medal = scenarioProgress[scenario.id]?.bestMedal;
            return (
              <li key={scenario.id} data-medal={medal ?? "none"}>
                <span>
                  <Medal aria-hidden="true" size={16} strokeWidth={2.4} />
                  {medal ? MEDAL_LABELS[medal] : "Open"}
                </span>
                <div>
                  <strong>{scenario.name}</strong>
                  <p>{medal ? MEDAL_LABELS[medal] : "Not earned yet"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="strategic-reward-galleries">
        <GalleryItems heading="Titles" items={gallery.titles} />
        <GalleryItems heading="Cosmetics" items={gallery.cosmetics} />
      </div>
    </section>
  );
}

export function StrategicChallenges({
  level,
  scenarioProgress,
  activeScenario,
  mastery,
  masteryDecisionBusy = false,
  gallery,
  onStartScenario,
  onResumeScenario,
  onLeaveScenario,
  onRestartScenario,
  onAcceptMasteryContract,
  onSkipMasteryContracts,
}: StrategicChallengesProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousScenarioIdRef = useRef<ScenarioId | undefined>(
    activeScenario?.scenarioId,
  );
  const previousMasteryKindRef = useRef(mastery.kind);

  useEffect(() => {
    const previousScenarioId = previousScenarioIdRef.current;
    const previousMasteryKind = previousMasteryKindRef.current;
    previousScenarioIdRef.current = activeScenario?.scenarioId;
    previousMasteryKindRef.current = mastery.kind;
    const selector = activeScenario &&
        previousScenarioId !== activeScenario.scenarioId
      ? ".strategic-active-scenario"
      : !activeScenario && previousScenarioId
        ? `[data-scenario-id="${previousScenarioId}"] button`
      : mastery.kind === "active" && previousMasteryKind === "offer"
        ? ".strategic-active-contract"
        : mastery.kind === "skipped" && previousMasteryKind === "offer"
          ? ".strategic-mastery-panel"
        : undefined;
    if (!selector) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target = panel?.querySelector<HTMLElement>(selector);
      if (!panel || !target) return;
      const panelBounds = panel.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      panel.scrollTo({
        top: Math.max(
          0,
          panel.scrollTop + targetBounds.top - panelBounds.top - 12,
        ),
        behavior: "auto",
      });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeScenario, mastery.kind]);

  return (
    <div ref={panelRef} className="strategic-challenges">
      <header className="strategic-challenges-heading">
        <div>
          <span>Challenge programme</span>
          <h2>Test a plan. Build mastery.</h2>
        </div>
        <p>
          Scenario results stay separate from your main centre. Rewards are
          visual keepsakes and titles, never cash or XP.
        </p>
      </header>

      {activeScenario ? (
        <ActiveScenarioHud
          scenario={activeScenario}
          onLeave={onLeaveScenario}
          onRestart={onRestartScenario}
        />
      ) : null}

      <section
        className="strategic-scenario-section"
        aria-labelledby="strategic-scenario-section-title"
      >
        <header>
          <div>
            <span>Five focused tests</span>
            <h3 id="strategic-scenario-section-title">Scenarios</h3>
          </div>
          <p>
            Each map has its own seed, starting balance, unlock set, medal
            thresholds, and save slot.
          </p>
        </header>
        <div className="strategic-scenario-grid">
          {SCENARIOS.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              level={level}
              progress={scenarioProgress[scenario.id]}
              activeScenarioId={activeScenario?.scenarioId}
              onStart={onStartScenario}
              onResume={onResumeScenario}
            />
          ))}
        </div>
      </section>

      <MasteryPanel
        level={level}
        mastery={mastery}
        decisionBusy={masteryDecisionBusy}
        scenarioActive={Boolean(activeScenario)}
        onAccept={onAcceptMasteryContract}
        onSkip={onSkipMasteryContracts}
      />

      <MetaGallery
        scenarioProgress={scenarioProgress}
        gallery={gallery}
      />
    </div>
  );
}
