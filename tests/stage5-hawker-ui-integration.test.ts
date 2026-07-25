import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  claimLocalDataOperation,
  dishMenuUsesMainProgressionGate,
  ensureMasteryDebriefSaved,
  masteryDebriefContinuePresentation,
  masteryPeriodDebriefFromSnapshot,
  parseActiveGameScope,
  recordScenarioResultInMeta,
  remainingScenarioFailureCodes,
  releaseLocalDataOperation,
  resetMetaForFreshMain,
  runSerializedProgressExport,
  scenarioBreakdownLabel,
  scenarioFailureGuidance,
} from "../app/game/HawkerSimulator";
import { createEmptyMetaProgression } from "../src/game/core/strategicProgression";
import {
  asMoneyCents,
  asMoneyDeltaCents,
} from "../src/game/core/money";
import type { RuntimeSnapshot } from "../src/game/runtime/types";

describe("Stage 5 Hawker UI integration", () => {
  it("admits only one user-triggered local-data operation at a time", () => {
    const gate = { current: false };
    expect(claimLocalDataOperation(gate)).toBe(true);
    expect(claimLocalDataOperation(gate)).toBe(false);
    expect(gate.current).toBe(true);

    releaseLocalDataOperation(gate);

    expect(gate.current).toBe(false);
    expect(claimLocalDataOperation(gate)).toBe(true);
  });

  it("pauses export, drains core before meta, and restores speed after success or failure", async () => {
    const events: string[] = [];
    const controller = {
      setSpeed(speed: 0 | 1 | 2 | 4 | 10) {
        events.push(`speed:${speed}`);
      },
    };
    await expect(runSerializedProgressExport({
      controller,
      previousSpeed: 4,
      async flushCore() {
        events.push("core");
      },
      async flushMeta() {
        events.push("meta");
      },
      async exportBundle() {
        events.push("export");
        return "bundle";
      },
    })).resolves.toBe("bundle");
    expect(events).toEqual([
      "speed:0",
      "core",
      "meta",
      "export",
      "speed:4",
    ]);

    events.length = 0;
    await expect(runSerializedProgressExport({
      controller,
      previousSpeed: 2,
      async flushCore() {
        events.push("core");
      },
      async flushMeta() {
        events.push("meta");
      },
      async exportBundle() {
        events.push("export");
        throw new Error("export failed");
      },
    })).rejects.toThrow(/export failed/);
    expect(events).toEqual([
      "speed:0",
      "core",
      "meta",
      "export",
      "speed:2",
    ]);
  });

  it("restores only a known scenario scope preference", () => {
    expect(parseActiveGameScope({
      kind: "scenario",
      scenarioId: "scenario.split-hall",
    })).toEqual({
      kind: "scenario",
      scenarioId: "scenario.split-hall",
    });
    expect(parseActiveGameScope({
      kind: "scenario",
      scenarioId: "scenario.not-authored",
    })).toEqual({ kind: "main" });
    expect(parseActiveGameScope({ kind: "main" })).toEqual({ kind: "main" });
  });

  it("uses a truthful, retry-safe mastery debrief continuation state", () => {
    expect(
      masteryDebriefContinuePresentation("idle", "Plan lunch"),
    ).toEqual({
      disabled: false,
      label: "Plan lunch",
    });
    expect(
      masteryDebriefContinuePresentation("saving", "Plan lunch"),
    ).toEqual({
      disabled: true,
      label: "Saving mastery progress\u2026",
      statusMessage:
        "Mastery progress is being saved before the next period opens.",
    });
    expect(
      masteryDebriefContinuePresentation("error", "Plan lunch"),
    ).toEqual({
      disabled: false,
      label: "Retry save and continue",
      statusMessage:
        "Mastery progress was not saved. Retry before opening the next period.",
    });
  });

  it("retries the matching mastery debrief and never treats failure as saved", async () => {
    const pendingDebrief = {
      periodSequenceId: 9,
    } as Parameters<typeof ensureMasteryDebriefSaved>[1];
    let retries = 0;
    const retry = async () => {
      retries += 1;
      return false;
    };

    await expect(
      ensureMasteryDebriefSaved(
        Promise.resolve(false),
        pendingDebrief,
        9,
        retry,
      ),
    ).resolves.toBe("failed");
    expect(retries).toBe(1);
    await expect(
      ensureMasteryDebriefSaved(
        Promise.resolve(false),
        pendingDebrief,
        10,
        retry,
      ),
    ).resolves.toBe("missing");
    expect(retries).toBe(1);
    await expect(
      ensureMasteryDebriefSaved(
        Promise.resolve(true),
        pendingDebrief,
        9,
        retry,
      ),
    ).resolves.toBe("saved");
    expect(retries).toBe(1);
  });

  it("does not apply main progression locks to an authored scenario menu", () => {
    const requirement = {
      level: 7,
      reputation: 20,
      prerequisiteIds: ["dish.prerequisite"],
    };
    const scenarioProgression = {
      level: 3,
      reputation: 0,
      unlockedContentIds: ["dish.masala-thosai"],
    };

    expect(
      dishMenuUsesMainProgressionGate(
        true,
        requirement,
        scenarioProgression,
      ),
    ).toBe(false);
    expect(
      dishMenuUsesMainProgressionGate(
        false,
        requirement,
        scenarioProgression,
      ),
    ).toBe(true);
  });

  it("records the validated best medal and exact cosmetic reward IDs", () => {
    const existing = {
      ...createEmptyMetaProgression(),
      scenarioMedals: {
        "scenario.narrow-aisles": "gold" as const,
      },
      unlockedCosmeticIds: ["cosmetic.existing"],
    };
    const result = recordScenarioResultInMeta(existing, {
      scenarioId: "scenario.narrow-aisles",
      score: 80,
      scoreUnit: "points",
      runComplete: true,
      medal: "bronze",
      breakdown: [
        { id: "completion", value: 28, maximum: 35 },
      ],
      failureCodes: [],
      nextMedal: {
        medal: "silver",
        threshold: 72,
        scoreShortfall: 4,
        constraintFailureCodes: [],
      },
      cosmeticRewardIds: [
        "cosmetic.validated-bronze",
        "cosmetic.validated-bronze",
      ],
    });
    expect(result.scenarioMedals["scenario.narrow-aisles"]).toBe("gold");
    expect(result.unlockedCosmeticIds).toEqual([
      "cosmetic.existing",
      "cosmetic.validated-bronze",
    ]);
  });

  it("adapts only finalized, exact runtime mastery metrics", () => {
    const snapshot = {
      periodDebrief: {
        periodSequenceId: 9,
        servedVisits: 12,
        timedOutServedVisits: 2,
        partyVisits: 3,
        completedComboVisits: 4,
        masteryMetrics: {
          minimumSatisfaction: 78,
          medianWaitSeconds: 42,
          flowSeconds: 120,
          distinctPreparationIds: ["prep.a", "prep.b"],
          trayReturns: 8,
          trayReturnOpportunities: 10,
        },
        forecastComparison: {
          nutritionMatches: 6,
        },
      },
      periodLedger: {
        grossSalesCents: asMoneyCents(35_000),
        contributionCents: asMoneyDeltaCents(18_000),
        refundsCents: asMoneyCents(1_000),
      },
    } as unknown as RuntimeSnapshot;
    expect(masteryPeriodDebriefFromSnapshot(snapshot)).toEqual({
      periodSequenceId: 9,
      completedVisits: 10,
      grossSalesCents: 35_000,
      contributionCents: 18_000,
      minimumSatisfaction: 78,
      medianWaitSeconds: 42,
      flowSeconds: 120,
      distinctPreparationIds: ["prep.a", "prep.b"],
      partyVisits: 3,
      trayReturns: 8,
      trayReturnOpportunities: 10,
      forecastNeedsMet: 6,
      refundCents: 1_000,
      comboVisits: 4,
    });
    expect(masteryPeriodDebriefFromSnapshot({
      periodDebrief: undefined,
    } as unknown as RuntimeSnapshot)).toBeUndefined();
  });

  it("turns scenario failure codes into actionable debrief guidance", () => {
    expect(scenarioFailureGuidance("wait-too-long")).toMatch(/Shorten queues/);
    expect(scenarioFailureGuidance("zone-balance-too-low")).toMatch(
      /both hall zones/,
    );
  });

  it("deduplicates next-medal constraints from the remaining debrief guidance", () => {
    expect(remainingScenarioFailureCodes(
      [
        "completion-rate-too-low",
        "wait-too-long",
        "completion-rate-too-low",
      ],
      ["completion-rate-too-low"],
    )).toEqual(["wait-too-long"]);
    expect(remainingScenarioFailureCodes(
      ["flow-too-low"],
      ["flow-too-low"],
    )).toEqual([]);
  });

  it("labels every authored scenario score component for the debrief", () => {
    expect(scenarioBreakdownLabel("contribution-cents")).toBe("Contribution");
    expect(scenarioBreakdownLabel("median-wait-ms")).toBe(
      "Median service wait",
    );
    expect(scenarioBreakdownLabel("completion-basis-points")).toBe(
      "Completion rate",
    );
  });

  it("keeps earned meta rewards but clears a stale active contract on main reset", () => {
    const meta = {
      ...createEmptyMetaProgression(),
      scenarioMedals: { "scenario.split-hall": "silver" as const },
      unlockedCosmeticIds: ["cosmetic.split-banner"],
      unlockedTitleIds: ["title.queue-keeper"],
      completedContractIds: ["contract.short-waits"],
      mastery: {
        schemaVersion: 1 as const,
        decidedRotation: 4,
        decision: "accepted" as const,
        activeContract: {
          schemaVersion: 1 as const,
          contract: {
            templateId: "contract.clear-ways",
            acceptedDay: 29,
            acceptedPeriodSequence: 113,
            durationPeriods: 4,
            expiresAfterPeriod: 117,
            target: { metric: "flow-seconds" as const, value: 180 },
            reward: {
              kind: "cosmetic" as const,
              cosmeticId: "cosmetic.clear-path-marker",
            },
          },
          progress: {
            completedVisits: 0,
            grossSalesCents: 0,
            contributionCents: 0,
            flowSeconds: 60,
            distinctPreparationIds: [],
            partyVisits: 0,
            trayReturns: 0,
            trayReturnOpportunities: 0,
            forecastNeedsMet: 0,
            periodsWithoutRefund: 0,
            comboVisits: 0,
            processedPeriodSequenceIds: [113],
            qualifiedPeriodSequenceIds: [],
          },
        },
      },
    };

    expect(resetMetaForFreshMain(meta)).toEqual({
      ...meta,
      mastery: { schemaVersion: 1 },
    });
  });

  it("wires scoped persistence, bundle validation, reset isolation, and challenge navigation", async () => {
    const source = await readFile(
      new URL("../app/game/HawkerSimulator.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("saveScopedGame(scope, payload)");
    expect(source).toContain("restoreScenarioRuntimeEnvelope");
    expect(source).toContain(
      "exportProgressBundle(freshMain, validators)",
    );
    expect(source).toContain("eraseAllProgress");
    expect(source).toContain("flushPendingSave(true, false)");
    expect(source).toContain("scenarioRewardSaveRef.current");
    expect(source).toContain("deserializeProgressBundle(source, validators)");
    expect(source.indexOf("deserializeProgressBundle(source, validators)")).toBeLessThan(
      source.indexOf("importProgressBundle(source, validators)"),
    );
    expect(source).toMatch(
      /controllerRef\.current\?\.setSpeed\(0\);[\s\S]*runtimeGenerationRef\.current \+= 1;[\s\S]*eraseAllProgress\(\)/,
    );
    expect(source).toContain('panel === "challenges"');
    expect(source).toContain("Record result and return to main centre");
    expect(source).toContain("scenario.breakdown.map");
    expect(source).toContain("scenario.nextMedal.scoreShortfall");
    expect(source).toContain("remainingScenarioFailureCodes(");
    expect(source).toContain("<SgdAmount cents={entry.value} />");
    expect(source).toContain("masteryDebriefSaveRef.current");
    expect(source).toContain("await ensureMasteryDebriefSaved(");
    expect(source).toContain("masteryDebriefContinuePendingRef.current");
    expect(source).toContain("masteryDecisionPendingRef.current");
    expect(source).toContain(
      "masteryDecisionBusy={masteryDecisionBusy}",
    );
    expect(source).toContain(
      "The debrief remains open; retry when local storage is available.",
    );
    expect(source).toContain(
      "Scenario menu and preparations are fixed for comparable scoring",
    );
    expect(source).toContain(
      "disabled={configurationLocked || scenarioMenuFixed}",
    );
    expect(source).toMatch(
      /snapshot\.servicePeriod\.phase === "planning"[\s\S]*\? "Scoring starts with service"/,
    );
    expect(
      source.match(/The scenario restarted from its authored setup/g),
    ).toHaveLength(1);
    expect(source).toContain("return restartScenario(scenarioId)");
  });

  it("guards local-data controls and treats committed recovery states truthfully", async () => {
    const source = await readFile(
      new URL("../app/game/HawkerSimulator.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("scopeSwitchRef");
    expect(source).toContain("claimLocalDataOperation(localDataOperationRef)");
    expect(source).toContain(
      "<fieldset disabled={localDataBusy} aria-busy={localDataBusy}>",
    );
    expect(source).toMatch(/const interfaceInert =\s*localDataBusy \|\|/);
    expect(source).toContain('aria-busy={loading || localDataBusy}');
    expect(source).toContain("await metaSaveQueueRef.current;");
    expect(source).toMatch(
      /committedImport = imported;[\s\S]*if \(committedImport\) \{[\s\S]*Progress was imported and replaced the previous local progress/,
    );
    expect(source).toMatch(
      /eraseCommitted = true;[\s\S]*if \(eraseCommitted\) \{[\s\S]*All previous progress was erased/,
    );
    expect(source).toContain("await resetMainProgress(resetMeta);");
    expect(source).toContain("The main reset was committed");
  });
});
