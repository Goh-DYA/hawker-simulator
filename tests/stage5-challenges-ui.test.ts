import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  restartDialogFocusAction,
  StrategicChallenges,
  type MasteryContractOfferTuple,
  type StrategicChallengesProps,
} from "../app/game/StrategicChallenges";

const masteryChoices = [
  {
    id: "contract.steady-takings",
    title: "Steady Takings",
    description: "Record S$240 in gross sales.",
    durationPeriods: 4,
    targetLabel: "S$240 gross sales",
    targetAccessibleLabel:
      "240 Singapore dollars and 0 cents gross sales",
    rewardLabel: "Ledger Stamp cosmetic",
    previouslyCompleted: true,
  },
  {
    id: "contract.short-waits",
    title: "Short Waits",
    description: "Keep the median service wait controlled.",
    durationPeriods: 3,
    targetLabel: "Median wait at or below 55 seconds",
    qualificationLabel:
      "At least 3 completed visits in each of 3 periods.",
    rewardLabel: "Queue Keeper title",
    previouslyCompleted: false,
  },
  {
    id: "contract.forecast-listener",
    title: "Forecast Listener",
    description: "Record forecast nutrition-intent matches.",
    durationPeriods: 4,
    targetLabel: "12 forecast nutrition-intent matches",
    rewardLabel: "Forecast pennant cosmetic",
    previouslyCompleted: false,
  },
] as const satisfies MasteryContractOfferTuple;

function baseProps(
  overrides: Partial<StrategicChallengesProps> = {},
): StrategicChallengesProps {
  return {
    level: 13,
    scenarioProgress: {
      "scenario.narrow-aisles": {
        hasSave: true,
        bestMedal: "silver",
        latestScoreLabel: "Latest score: 74 points",
      },
      "scenario.limited-cash": {
        hasSave: false,
        bestMedal: "bronze",
      },
    },
    mastery: {
      kind: "offer",
      rotationLabel: "Days 1–7",
      choices: masteryChoices,
    },
    gallery: {
      titles: [
        {
          id: "title.warm-welcome",
          label: "Warm Welcome",
          description: "Complete its mastery contract to unlock.",
          unlocked: true,
        },
      ],
      cosmetics: [
        {
          id: "cosmetic.route-pin",
          label: "Route pin",
          description: "Earn a Narrow Aisles medal to unlock.",
          unlocked: false,
        },
      ],
    },
    onStartScenario: vi.fn(),
    onResumeScenario: vi.fn(),
    onLeaveScenario: vi.fn(),
    onRestartScenario: vi.fn(async () => true),
    onAcceptMasteryContract: vi.fn(),
    onSkipMasteryContracts: vi.fn(),
    ...overrides,
  };
}

describe("Stage 5 strategic challenge UI", () => {
  it("renders five isolated scenario choices and exactly three mastery offers", () => {
    const html = renderToStaticMarkup(
      createElement(StrategicChallenges, baseProps()),
    );

    expect(html.match(/class="strategic-scenario-card"/g)).toHaveLength(5);
    expect(html.match(/class="strategic-contract-accept"/g)).toHaveLength(3);
    expect(html).toContain("Skip this rotation");
    expect(html).toContain("Resume Narrow Aisles");
    expect(html).toContain("Play Limited Cash again");
    expect(html).toContain("Compact two-aisle plan");
    expect(html).toContain("90% arrival volume");
    expect(html).toContain(
      "Keep the central service route open so neighbours can reach stalls, seats, tray return, and exit.",
    );
    expect(html).toContain("S$900");
    expect(html).toContain("900 Singapore dollars and 0 cents");
    expect(html).toContain("S$80");
    expect(html).toContain("80 Singapore dollars and 0 cents");
    expect(html).toContain("3 meal roles available");
    expect(html).toContain("At least 3 preparations available");
    expect(html).not.toContain("3 required meal roles");
    expect(html).toContain("Practice replay");
    expect(html).toContain(
      "At least 3 completed visits in each of 3 periods.",
    );
    expect(html).toContain("Replay contract");
    expect(html).toContain("reward already earned");
    expect(html).toContain("240 Singapore dollars and 0 cents gross sales");
    expect(html).toContain("A separate scenario save protects your main centre.");
    expect(html.toLowerCase()).not.toContain("credits");
    expect(html.toLowerCase()).not.toContain("universal health");
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(
      (match) => match[0],
    );
    expect(buttons).toHaveLength(9);
    expect(buttons.every((button) => button.includes("aria-label="))).toBe(
      true,
    );
  });

  it("locks scenarios before level 3 and mastery before level 13", () => {
    const html = renderToStaticMarkup(
      createElement(
        StrategicChallenges,
        baseProps({
          level: 2,
        }),
      ),
    );

    expect(html.match(/disabled=""/g)).toHaveLength(5);
    expect(html).toContain("Narrow Aisles unlocks at level 3");
    expect(html).toContain("Unlocks at level 13");
    expect(html).not.toContain("Accept contract");
    expect(html).not.toContain("Skip this rotation");
  });

  it("disables every mastery decision while one choice is being saved", () => {
    const html = renderToStaticMarkup(
      createElement(
        StrategicChallenges,
        baseProps({
          masteryDecisionBusy: true,
        }),
      ),
    );

    expect(
      html.match(/class="strategic-contract-accept"[^>]*disabled=""/g),
    ).toHaveLength(3);
    expect(
      html.match(/class="strategic-contract-skip"[^>]*disabled=""/g),
    ).toHaveLength(1);
    expect(html).toContain("Saving your mastery decision");
    expect(html).toContain('role="status"');
  });

  it("summarizes an active scenario and a frozen accepted contract", () => {
    const html = renderToStaticMarkup(
      createElement(
        StrategicChallenges,
        baseProps({
          activeScenario: {
            scenarioId: "scenario.split-hall",
            cashCents: 78_450,
            periodLabel: "Day 2 · Lunch planning",
            scoreLabel: "68 balanced-service points",
            objectiveLabel: "Keep both seating zones served",
            projectedMedal: "silver",
            saveStatusLabel: "Scenario progress saved on this device.",
          },
          mastery: {
            kind: "active",
            contract: {
              id: "contract.short-waits",
              title: "Short Waits",
              targetLabel: "Median wait at or below 55 seconds",
              qualificationLabel:
                "At least 3 completed visits in each of 3 periods.",
              qualificationProgressLabel: "2 of 3 periods qualified",
              rewardLabel: "Queue Keeper title",
              progressLabel: "2 of 3 qualifying periods",
              progressPercent: 67,
              periodsRemaining: 1,
            },
          },
        }),
      ),
    );

    expect(html).toContain("Isolated scenario");
    expect(html).toContain("Split Hall");
    expect(html).toContain("S$784.50");
    expect(html).toContain("784 Singapore dollars and 50 cents");
    expect(html).toContain("Save Split Hall and return to the main centre");
    expect(html).toContain("Restart Split Hall from its authored setup");
    expect(html).toContain("Restart scenario");
    expect(html.match(/>Active<\/button>/g)).toHaveLength(1);
    expect(html.match(/>Return first<\/button>/g)).toHaveLength(4);
    expect(html).toContain("Split Hall is the active scenario");
    expect(html).toContain(
      "Save and return from Split Hall before opening Narrow Aisles",
    );
    expect(html).toContain("Frozen target");
    expect(html).toContain("Frozen qualification");
    expect(html).toContain("Qualification progress");
    expect(html).toContain("Frozen reward");
    expect(html).toContain("Paused during scenario play");
    expect(html).toContain(
      "Only main-centre period debriefs advance this contract.",
    );
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="67"');
    expect(html).toContain("2 of 3 qualifying periods");
    expect(html).toContain("2 of 3 periods qualified");
  });

  it("reports a failed participation floor separately from the target result", () => {
    const html = renderToStaticMarkup(
      createElement(
        StrategicChallenges,
        baseProps({
          mastery: {
            kind: "outcome",
            outcome: {
              status: "failed",
              title: "Short Waits",
              targetLabel: "Median wait at or below 55 seconds",
              qualificationLabel:
                "At least 3 completed visits in each of 3 periods.",
              qualificationProgressLabel: "2 of 3 periods qualified",
              resultLabel: "40 seconds",
              shortfallLabel:
                "The target value was reached, but only 2 of 3 periods qualified.",
              rewardLabel: "Queue Keeper title",
              rewardGranted: false,
              nextOfferLabel: "The next rotation begins on day 8.",
            },
          },
        }),
      ),
    );

    expect(html).toContain("Contract result");
    expect(html).toContain("Target not met");
    expect(html).toContain("Frozen qualification");
    expect(html).toContain("Qualification result");
    expect(html).toContain("2 of 3 periods qualified");
    expect(html).toContain(
      "The target value was reached, but only 2 of 3 periods qualified.",
    );
  });

  it("contains restart confirmation focus and dismissal inside the alert dialog", () => {
    expect(restartDialogFocusAction("Escape", false, 2, false, false)).toBe(
      "dismiss",
    );
    expect(restartDialogFocusAction("Tab", true, 2, true, false)).toBe("last");
    expect(restartDialogFocusAction("Tab", false, 2, false, true)).toBe(
      "first",
    );
    expect(restartDialogFocusAction("Tab", false, 0, false, false)).toBe(
      "container",
    );
    expect(restartDialogFocusAction("Enter", false, 2, false, false)).toBe(
      undefined,
    );

    const source = readFileSync(
      new URL("../app/game/StrategicChallenges.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('role="alertdialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("data-restart-cancel");
    expect(source).toContain("await onRestart(scenario.scenarioId)");
    expect(source).toContain("activeScenarioRef.current?.focus()");
  });

  it("keeps every interactive path wired to a typed callback", () => {
    const source = readFileSync(
      new URL("../app/game/StrategicChallenges.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("onResume(scenario.id)");
    expect(source).toContain("onStart(scenario.id)");
    expect(source).toContain("onLeave(scenario.scenarioId)");
    expect(source).toContain("onRestart(scenario.scenarioId)");
    expect(source).toContain("onAccept(choice.id)");
    expect(source).toContain("onClick={onSkip}");
    expect(source).toContain(
      "readonly choices: MasteryContractOfferTuple",
    );
    expect(source).not.toMatch(/onClick=\{\(\) => \{\}\}/);
  });

  it("contains narrow and enlarged-scale collision safeguards", () => {
    const css = readFileSync(
      new URL("../app/globals.css", import.meta.url),
      "utf8",
    );

    expect(css).toMatch(
      /\.strategic-challenges\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/,
    );
    expect(css).toMatch(
      /\.strategic-challenges :is\(p, li, dt, dd, span, strong, em, button\)\s*\{[^}]*overflow-wrap:\s*break-word;[^}]*word-break:\s*normal;[^}]*font-size:\s*0\.75rem;/,
    );
    expect(css).toMatch(
      /\.strategic-challenges :is\(button, \[role="button"\]\)\s*\{[^}]*min-height:\s*44px;[^}]*white-space:\s*normal;/,
    );
    expect(css).toContain(
      '.game-shell[data-text-scale="large"] :is(',
    );
    expect(css).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.strategic-active-contract dl\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    expect(css).not.toMatch(
      /\.strategic-challenges\s*\{[^}]*max-height:\s*(?:100%|100dvh)/,
    );
    expect(css).toMatch(
      /@media \(max-height: 620px\)[\s\S]*?grid-template-rows:\s*max-content max-content max-content;[\s\S]*?\.game-shell\[data-text-scale="large"\] \.play-layout\s*\{\s*min-height:\s*520px;/,
    );
    expect(css).toMatch(
      /\.strategic-scenario-card > footer\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;/,
    );
    expect(css).toMatch(
      /\.strategic-active-scenario-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/,
    );
    expect(css).toMatch(
      /\.strategic-restart-confirmation\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*overflow-y:\s*auto;/,
    );
    expect(css).toMatch(
      /\.strategic-restart-confirmation-card\s*\{[^}]*max-height:\s*calc\(100dvh - 24px\);[^}]*overflow-y:\s*auto;[^}]*border:\s*2px solid/,
    );
    expect(css).toContain("minmax(min(100%, 340px), 1fr)");
    expect(css).toContain("minmax(min(100%, 250px), 1fr)");
  });
});
