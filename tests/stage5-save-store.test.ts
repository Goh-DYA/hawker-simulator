import { beforeEach, describe, expect, it, vi } from "vitest";

const idbHarness = vi.hoisted(() => ({
  version: 1,
  stores: new Map<string, Map<string, unknown>>(),
  openCount: 0,
  transactionCount: 0,
  failNextTransactionOnDone: false,
}));

vi.mock("idb", () => {
  class MemoryStore {
    constructor(private readonly values: Map<string, unknown>) {}

    async get(key: string): Promise<unknown> {
      const value = this.values.get(key);
      return value === undefined ? undefined : structuredClone(value);
    }

    async put(value: unknown, key: string): Promise<string> {
      this.values.set(key, structuredClone(value));
      return key;
    }

    async delete(key: string): Promise<void> {
      this.values.delete(key);
    }

    async clear(): Promise<void> {
      this.values.clear();
    }
  }

  class MemoryTransaction {
    readonly store: MemoryStore;
    private readonly transactionStores = new Map<
      string,
      Map<string, unknown>
    >();

    constructor(private readonly storeNames: readonly string[]) {
      for (const name of storeNames) {
        const values = idbHarness.stores.get(name);
        if (!values) throw new Error(`Missing object store ${name}`);
        this.transactionStores.set(
          name,
          new Map(
            [...values].map(([key, value]) => [
              key,
              structuredClone(value),
            ]),
          ),
        );
      }
      this.store = this.objectStore(storeNames[0]!);
    }

    objectStore(name: string): MemoryStore {
      if (!this.storeNames.includes(name)) {
        throw new Error(`Store ${name} is outside this transaction`);
      }
      const values = this.transactionStores.get(name);
      if (!values) throw new Error(`Missing object store ${name}`);
      return new MemoryStore(values);
    }

    get done(): Promise<void> {
      if (idbHarness.failNextTransactionOnDone) {
        idbHarness.failNextTransactionOnDone = false;
        return Promise.reject(new Error("Simulated transaction interruption"));
      }
      for (const [name, values] of this.transactionStores) {
        idbHarness.stores.set(name, values);
      }
      return Promise.resolve();
    }
  }

  class MemoryDatabase {
    readonly objectStoreNames = {
      contains: (name: string) => idbHarness.stores.has(name),
    };

    createObjectStore(name: string): MemoryStore {
      const values = new Map<string, unknown>();
      idbHarness.stores.set(name, values);
      return new MemoryStore(values);
    }

    transaction(names: string | readonly string[]): MemoryTransaction {
      idbHarness.transactionCount += 1;
      return new MemoryTransaction(
        typeof names === "string" ? [names] : names,
      );
    }

    async get(storeName: string, key: string): Promise<unknown> {
      return new MemoryStore(idbHarness.stores.get(storeName)!).get(key);
    }

    async put(
      storeName: string,
      value: unknown,
      key: string,
    ): Promise<string> {
      return new MemoryStore(idbHarness.stores.get(storeName)!).put(value, key);
    }
  }

  return {
    openDB: vi.fn(
      async (
        _name: string,
        version: number,
        options?: {
          upgrade?: (
            database: MemoryDatabase,
            oldVersion: number,
            newVersion: number,
          ) => void;
        },
      ) => {
        idbHarness.openCount += 1;
        const database = new MemoryDatabase();
        if (idbHarness.version < version) {
          options?.upgrade?.(database, idbHarness.version, version);
          idbHarness.version = version;
        }
        return database;
      },
    ),
  };
});

type SaveStoreModule = typeof import("../src/game/persistence/saveStore");

let saveStore: SaveStoreModule;

const metaWithRewards = {
  schemaVersion: 1 as const,
  scenarioMedals: {
    "scenario.narrow-aisles": "silver" as const,
  },
  unlockedCosmeticIds: ["cosmetic.route-pin", "cosmetic.aisle-sign"],
  unlockedTitleIds: ["title.queue-keeper"],
  completedContractIds: ["contract.short-waits"],
  mastery: { schemaVersion: 1 as const },
};

beforeEach(async () => {
  vi.resetModules();
  idbHarness.version = 1;
  idbHarness.stores.clear();
  idbHarness.stores.set("saves", new Map());
  idbHarness.stores.set("preferences", new Map());
  idbHarness.openCount = 0;
  idbHarness.transactionCount = 0;
  idbHarness.failNextTransactionOnDone = false;
  saveStore = await import("../src/game/persistence/saveStore");
});

describe("IndexedDB V2 progress isolation", () => {
  it("upgrades V1 in place and keeps the preceding preview main save readable", async () => {
    const legacyPayload = {
      runtimeSchemaVersion: 5,
      core: { schemaVersion: 7, economy: { cashCents: 42_075 } },
    };
    const legacyEnvelope = JSON.parse(
      saveStore.exportSave(legacyPayload),
    ) as Record<string, unknown>;
    legacyEnvelope.saveVersion = 1;
    idbHarness.stores.get("saves")!.set("active", legacyEnvelope);
    idbHarness.stores.get("preferences")!.set("settings", { textScale: 1.2 });

    await expect(saveStore.loadGameCandidates()).resolves.toEqual([
      legacyPayload,
    ]);

    expect(idbHarness.version).toBe(saveStore.INDEXED_DB_SCHEMA_VERSION);
    expect([...idbHarness.stores.keys()].sort()).toEqual([
      "metaProgression",
      "preferences",
      "saves",
      "scenarioSaves",
    ]);
    await expect(
      saveStore.loadPreference("settings", undefined),
    ).resolves.toEqual({ textScale: 1.2 });
  });

  it("keeps main, scenario, and meta progress in independent typed scopes", async () => {
    await saveStore.saveScopedGame(
      saveStore.MAIN_GAME_SCOPE,
      { centre: "main", cashCents: 10_000 },
    );
    const narrowScope = saveStore.scenarioGameScope(
      "scenario.narrow-aisles",
    );
    await saveStore.saveScopedGame(
      narrowScope,
      { scenarioId: "scenario.narrow-aisles", score: 72 },
    );
    await saveStore.saveMetaProgression(metaWithRewards);
    await saveStore.savePreference("settings", { textScale: 1.4 });
    await saveStore.savePreference("tutorial-complete", true);
    await saveStore.savePreference("nutrition-tour-v1-complete", true);
    await saveStore.savePreference("forecast-guide-v1-complete", true);
    await saveStore.savePreference("nutrition-lens-enabled", false);

    await expect(saveStore.loadScopedGame(narrowScope)).resolves.toEqual({
      scenarioId: "scenario.narrow-aisles",
      score: 72,
    });

    await saveStore.clearGame();

    await expect(saveStore.loadGame()).resolves.toBeUndefined();
    await expect(saveStore.loadScenarioGame(
      "scenario.narrow-aisles",
    )).resolves.toMatchObject({ score: 72 });
    await expect(saveStore.loadMetaProgression()).resolves.toEqual(
      metaWithRewards,
    );

    await saveStore.eraseAllProgress();

    await expect(saveStore.loadGame()).resolves.toBeUndefined();
    await expect(saveStore.loadScenarioGame(
      "scenario.narrow-aisles",
    )).resolves.toBeUndefined();
    await expect(saveStore.loadMetaProgression()).resolves.toEqual({
      schemaVersion: 1,
      scenarioMedals: {},
      unlockedCosmeticIds: [],
      unlockedTitleIds: [],
      completedContractIds: [],
      mastery: { schemaVersion: 1 },
    });
    await expect(
      saveStore.loadPreference("settings", undefined),
    ).resolves.toEqual({ textScale: 1.4 });
    await expect(
      saveStore.loadPreference("tutorial-complete", undefined),
    ).resolves.toBeUndefined();
    await expect(
      saveStore.loadPreference("nutrition-tour-v1-complete", undefined),
    ).resolves.toBeUndefined();
    await expect(
      saveStore.loadPreference("forecast-guide-v1-complete", undefined),
    ).resolves.toBeUndefined();
    await expect(
      saveStore.loadPreference("nutrition-lens-enabled", undefined),
    ).resolves.toBe(false);
  });

  it("atomically clears main candidates and stale mastery while preserving rewards and scenarios", async () => {
    await saveStore.saveGame({ centre: "main-backup" });
    await saveStore.saveGame({ centre: "main-active" });
    await saveStore.saveScenarioGame(
      "scenario.split-hall",
      { score: 72 },
    );
    await saveStore.saveMetaProgression({
      ...metaWithRewards,
      mastery: {
        schemaVersion: 1,
        decidedRotation: 0,
        decision: "accepted",
        activeContract: {
          schemaVersion: 1,
          contract: {
            templateId: "contract.short-waits",
            acceptedDay: 1,
            acceptedPeriodSequence: 1,
            durationPeriods: 3,
            expiresAfterPeriod: 4,
            target: {
              metric: "maximum-median-wait-seconds",
              value: 45,
            },
            qualification: {
              minimumCompletedVisitsPerPeriod: 3,
            },
            reward: {
              kind: "title",
              titleId: "title.queue-keeper",
            },
          },
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
      },
    });
    const cleanedMeta = {
      ...metaWithRewards,
      mastery: { schemaVersion: 1 as const },
    };
    const transactionsBeforeReset = idbHarness.transactionCount;

    await saveStore.resetMainProgress(cleanedMeta);

    expect(idbHarness.transactionCount).toBe(transactionsBeforeReset + 1);
    await expect(saveStore.loadGameCandidates()).resolves.toEqual([]);
    await expect(saveStore.loadScenarioGame(
      "scenario.split-hall",
    )).resolves.toEqual({ score: 72 });
    await expect(saveStore.loadMetaProgressionCandidates()).resolves.toEqual([
      cleanedMeta,
    ]);
  });

  it("keeps the old main and mastery together when the reset transaction is interrupted", async () => {
    await saveStore.saveGame({ centre: "main-before-reset" });
    const metaBeforeReset = {
      ...metaWithRewards,
      mastery: {
        schemaVersion: 1 as const,
        decidedRotation: 0,
        decision: "accepted" as const,
        activeContract: {
          schemaVersion: 1 as const,
          contract: {
            templateId: "contract.short-waits",
            acceptedDay: 1,
            acceptedPeriodSequence: 1,
            durationPeriods: 3,
            expiresAfterPeriod: 4,
            target: {
              metric: "maximum-median-wait-seconds" as const,
              value: 45,
            },
            qualification: {
              minimumCompletedVisitsPerPeriod: 3,
            },
            reward: {
              kind: "title" as const,
              titleId: "title.queue-keeper",
            },
          },
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
      },
    };
    await saveStore.saveMetaProgression(metaBeforeReset);
    idbHarness.failNextTransactionOnDone = true;

    await expect(saveStore.resetMainProgress({
      ...metaWithRewards,
      mastery: { schemaVersion: 1 },
    })).rejects.toThrow(/transaction interruption/);

    await expect(saveStore.loadGameCandidates()).resolves.toEqual([
      { centre: "main-before-reset" },
    ]);
    await expect(saveStore.loadMetaProgression()).resolves.toEqual(
      metaBeforeReset,
    );
  });

  it("migrates Stage 4 meta records and rejects malformed mastery state", async () => {
    const stage4Meta = {
      schemaVersion: 1 as const,
      scenarioMedals: {},
      unlockedCosmeticIds: [],
      unlockedTitleIds: [],
      completedContractIds: [],
    };
    await saveStore.saveMetaProgression(stage4Meta);
    await expect(saveStore.loadMetaProgression()).resolves.toEqual({
      ...stage4Meta,
      mastery: { schemaVersion: 1 },
    });
    await expect(
      saveStore.saveMetaProgression({
        ...stage4Meta,
        mastery: {
          schemaVersion: 1,
          decidedRotation: -1,
        },
      }),
    ).rejects.toThrow(/decidedRotation/);
  });

  it("adds conservative participation defaults to preceding-preview mastery saves", async () => {
    const legacyMeta = {
      schemaVersion: 1,
      scenarioMedals: {},
      unlockedCosmeticIds: [],
      unlockedTitleIds: [],
      completedContractIds: [],
      mastery: {
        schemaVersion: 1,
        decidedRotation: 0,
        decision: "accepted",
        activeContract: {
          schemaVersion: 1,
          contract: {
            templateId: "contract.short-waits",
            acceptedDay: 1,
            acceptedPeriodSequence: 10,
            durationPeriods: 3,
            expiresAfterPeriod: 13,
            target: {
              metric: "maximum-median-wait-seconds",
              value: 55,
            },
            reward: {
              kind: "title",
              titleId: "title.queue-keeper",
            },
          },
          progress: {
            completedVisits: 3,
            grossSalesCents: 0,
            contributionCents: 0,
            maximumMedianWaitSeconds: 40,
            flowSeconds: 0,
            distinctPreparationIds: [],
            partyVisits: 0,
            trayReturns: 0,
            trayReturnOpportunities: 0,
            forecastNeedsMet: 0,
            periodsWithoutRefund: 0,
            comboVisits: 0,
            processedPeriodSequenceIds: [10],
          },
        },
      },
    };

    await saveStore.saveMetaProgression(
      legacyMeta as unknown as Parameters<
        typeof saveStore.saveMetaProgression
      >[0],
    );

    await expect(saveStore.loadMetaProgression()).resolves.toMatchObject({
      mastery: {
        activeContract: {
          contract: {
            qualification: {
              minimumCompletedVisitsPerPeriod: 3,
            },
          },
          progress: {
            qualifiedPeriodSequenceIds: [],
          },
        },
      },
    });
  });

  it("rejects contradictory or out-of-window mastery imports", async () => {
    const contract = {
      templateId: "contract.short-waits",
      acceptedDay: 1,
      acceptedPeriodSequence: 10,
      durationPeriods: 3,
      expiresAfterPeriod: 13,
      target: {
        metric: "maximum-median-wait-seconds" as const,
        value: 45,
      },
      qualification: {
        minimumCompletedVisitsPerPeriod: 3,
      },
      reward: {
        kind: "title" as const,
        titleId: "title.queue-keeper",
      },
    };
    const progress = {
      completedVisits: 8,
      grossSalesCents: 24_000,
      contributionCents: 12_000,
      maximumMedianWaitSeconds: 38,
      flowSeconds: 60,
      distinctPreparationIds: ["prep.a"],
      partyVisits: 1,
      trayReturns: 2,
      trayReturnOpportunities: 3,
      forecastNeedsMet: 2,
      periodsWithoutRefund: 2,
      comboVisits: 1,
      processedPeriodSequenceIds: [10, 11],
      qualifiedPeriodSequenceIds: [10, 11],
    };
    const activeContract = {
      schemaVersion: 1 as const,
      contract,
      progress,
    };
    const base = {
      schemaVersion: 1 as const,
      scenarioMedals: {},
      unlockedCosmeticIds: [],
      unlockedTitleIds: [],
      completedContractIds: [],
    };

    await expect(saveStore.saveMetaProgression({
      ...base,
      mastery: {
        schemaVersion: 1,
        decidedRotation: 0,
        decision: "accepted",
        activeContract,
      },
    })).resolves.toBeUndefined();

    await expect(saveStore.saveMetaProgression({
      ...base,
      mastery: {
        schemaVersion: 1,
        decidedRotation: 0,
        decision: "skipped",
        activeContract,
      },
    })).rejects.toThrow(/Skipped mastery rotations/);
    await expect(saveStore.saveMetaProgression({
      ...base,
      mastery: {
        schemaVersion: 1,
        decision: "accepted",
        activeContract,
      },
    })).rejects.toThrow(/rotation and decision/);
    await expect(saveStore.saveMetaProgression({
      ...base,
      mastery: {
        schemaVersion: 1,
        decidedRotation: 0,
        decision: "accepted",
        activeContract: {
          ...activeContract,
          progress: {
            ...progress,
            processedPeriodSequenceIds: [10, 12],
          },
        },
      },
    })).rejects.toThrow(/sorted and contiguous/);
    await expect(saveStore.saveMetaProgression({
      ...base,
      mastery: {
        schemaVersion: 1,
        decidedRotation: 0,
        decision: "accepted",
        activeContract: {
          ...activeContract,
          contract: {
            ...contract,
            expiresAfterPeriod: 14,
          },
        },
      },
    })).rejects.toThrow(/frozen acceptance window/);
  });

  it("rejects mastery outcomes that contradict their frozen result or rewards", async () => {
    const contract = {
      templateId: "contract.short-waits",
      acceptedDay: 1,
      acceptedPeriodSequence: 10,
      durationPeriods: 3,
      expiresAfterPeriod: 13,
      target: {
        metric: "maximum-median-wait-seconds" as const,
        value: 45,
      },
      qualification: {
        minimumCompletedVisitsPerPeriod: 3,
      },
      reward: {
        kind: "title" as const,
        titleId: "title.queue-keeper",
      },
    };
    const progress = {
      completedVisits: 12,
      grossSalesCents: 24_000,
      contributionCents: 12_000,
      maximumMedianWaitSeconds: 38,
      flowSeconds: 180,
      distinctPreparationIds: ["prep.a"],
      partyVisits: 1,
      trayReturns: 3,
      trayReturnOpportunities: 4,
      forecastNeedsMet: 2,
      periodsWithoutRefund: 3,
      comboVisits: 1,
      processedPeriodSequenceIds: [10, 11, 12],
      qualifiedPeriodSequenceIds: [10, 11, 12],
    };
    const completedMeta = {
      schemaVersion: 1 as const,
      scenarioMedals: {},
      unlockedCosmeticIds: [],
      unlockedTitleIds: ["title.queue-keeper"],
      completedContractIds: ["contract.short-waits"],
      mastery: {
        schemaVersion: 1 as const,
        decidedRotation: 0,
        decision: "accepted" as const,
        lastOutcome: {
          schemaVersion: 1 as const,
          contract,
          status: "completed" as const,
          endedAtPeriodSequence: 12,
          progress,
          rewardGranted: true,
        },
      },
    };

    await expect(
      saveStore.saveMetaProgression(completedMeta),
    ).resolves.toBeUndefined();
    await expect(saveStore.saveMetaProgression({
      ...completedMeta,
      mastery: {
        ...completedMeta.mastery,
        lastOutcome: {
          ...completedMeta.mastery.lastOutcome,
          progress: {
            ...progress,
            maximumMedianWaitSeconds: 60,
          },
        },
      },
    })).rejects.toThrow(/frozen target and qualification/);
    await expect(saveStore.saveMetaProgression({
      ...completedMeta,
      mastery: {
        ...completedMeta.mastery,
        decidedRotation: 1,
      },
    })).rejects.toThrow(/outcome acceptance.*decided rotation/);
    await expect(saveStore.saveMetaProgression({
      ...completedMeta,
      unlockedTitleIds: [],
    })).rejects.toThrow(/missing its reward/);
    await expect(saveStore.saveMetaProgression({
      ...completedMeta,
      completedContractIds: [],
    })).rejects.toThrow(/completed contract and unlocked reward/);
  });

  it("rejects scenario medals without every cumulative cosmetic reward", async () => {
    await expect(saveStore.saveMetaProgression({
      schemaVersion: 1,
      scenarioMedals: {
        "scenario.narrow-aisles": "gold",
      },
      unlockedCosmeticIds: ["cosmetic.gold-wayfinder"],
      unlockedTitleIds: [],
      completedContractIds: [],
      mastery: { schemaVersion: 1 },
    })).rejects.toThrow(/missing cumulative cosmetic/);
  });

  it("retains active and backup candidates separately per scenario", async () => {
    await saveStore.saveScenarioGame(
      "scenario.split-hall",
      { score: 40 },
    );
    await saveStore.saveScenarioGame(
      "scenario.split-hall",
      { score: 70 },
    );
    await saveStore.saveScenarioGame(
      "scenario.narrow-aisles",
      { score: 55 },
    );

    await expect(saveStore.loadScenarioGameCandidates(
      "scenario.split-hall",
    )).resolves.toEqual([{ score: 70 }, { score: 40 }]);
    await expect(saveStore.loadScenarioGameCandidates(
      "scenario.narrow-aisles",
    )).resolves.toEqual([{ score: 55 }]);
  });
});

describe("progress export bundle V3", () => {
  it("round-trips the whole bundle and rejects tampering or unknown slots", () => {
    const snapshot = {
      main: { runtimeSchemaVersion: 5, core: { schemaVersion: 7 } },
      scenarios: {
        "scenario.narrow-aisles": {
          scenarioId: "scenario.narrow-aisles",
          score: 86,
        },
      },
      metaProgression: metaWithRewards,
    };
    const source = saveStore.serializeProgressBundle(snapshot);
    const exported = JSON.parse(source) as {
      exportVersion: number;
      payload: typeof snapshot;
    };

    expect(exported.exportVersion).toBe(3);
    expect(saveStore.deserializeProgressBundle(source)).toEqual(snapshot);

    (exported.payload as { main: unknown }).main = { forged: true };
    expect(() =>
      saveStore.deserializeProgressBundle(JSON.stringify(exported)),
    ).toThrow(/damaged or unsupported/);

    const unknownScenario = structuredClone(snapshot) as typeof snapshot & {
      scenarios: Record<string, unknown>;
    };
    unknownScenario.scenarios["scenario.unknown"] = { score: 999 };
    // Re-serializing through the public writer is also strict and rejects an
    // unsupported key before it can manufacture a matching checksum.
    expect(() =>
      saveStore.serializeProgressBundle(unknownScenario),
    ).toThrow(/not a supported scenario/);
  });

  it("validates every payload before the atomic multi-store import writes", async () => {
    await saveStore.saveGame({ centre: "before-import" });
    await saveStore.saveScenarioGame(
      "scenario.split-hall",
      { score: 70 },
    );
    await saveStore.saveMetaProgression(metaWithRewards);

    const replacement = {
      main: { centre: "after-import" },
      scenarios: {
        "scenario.limited-cash": {
          scenarioId: "scenario.limited-cash",
          score: 20_000,
        },
      },
      metaProgression: {
        schemaVersion: 1 as const,
        scenarioMedals: {
          "scenario.limited-cash": "gold" as const,
        },
        unlockedCosmeticIds: [
          "cosmetic.savings-jar",
          "cosmetic.ledger-board",
          "cosmetic.gold-abacus",
        ],
        unlockedTitleIds: [],
        completedContractIds: [],
        mastery: { schemaVersion: 1 as const },
      },
    };
    const source = saveStore.serializeProgressBundle(replacement);
    const transactionsBeforeRejectedImport = idbHarness.transactionCount;

    await expect(saveStore.importProgressBundle(source, {
      validateMain: (payload) => {
        expect(payload).toEqual(replacement.main);
      },
      validateScenario: () => {
        throw new Error("Scenario runtime payload is invalid");
      },
    })).rejects.toThrow(/Scenario runtime payload is invalid/);
    expect(idbHarness.transactionCount).toBe(
      transactionsBeforeRejectedImport,
    );
    await expect(saveStore.loadGame()).resolves.toEqual({
      centre: "before-import",
    });
    await expect(saveStore.loadScenarioGame(
      "scenario.split-hall",
    )).resolves.toEqual({ score: 70 });
    await expect(saveStore.loadMetaProgression()).resolves.toEqual(
      metaWithRewards,
    );

    await expect(saveStore.importProgressBundle(source)).resolves.toEqual(
      replacement,
    );
    await expect(saveStore.loadGameCandidates()).resolves.toEqual([
      { centre: "after-import" },
      { centre: "before-import" },
    ]);
    await expect(saveStore.loadScenarioGame(
      "scenario.split-hall",
    )).resolves.toBeUndefined();
    await expect(saveStore.loadScenarioGame(
      "scenario.limited-cash",
    )).resolves.toMatchObject({ score: 20_000 });
    await expect(saveStore.loadMetaProgression()).resolves.toEqual(
      replacement.metaProgression,
    );
  });

  it("exports a fresh main snapshot with stored scenario and meta progress", async () => {
    await saveStore.saveGame({ tick: 10 });
    await saveStore.saveScenarioGame(
      "scenario.peak-throughput",
      { score: 40 },
    );
    await saveStore.saveMetaProgression(metaWithRewards);

    const source = await saveStore.exportProgressBundle({ tick: 11 });
    expect(saveStore.deserializeProgressBundle(source)).toEqual({
      main: { tick: 11 },
      scenarios: {
        "scenario.peak-throughput": { score: 40 },
      },
      metaProgression: metaWithRewards,
    });
  });

  it("exports semantically valid backups when active save payloads are invalid", async () => {
    await saveStore.saveGame({ state: "valid-main-backup" });
    await saveStore.saveGame({ state: "invalid-main-active" });
    await saveStore.saveScenarioGame(
      "scenario.split-hall",
      { state: "valid-scenario-backup" },
    );
    await saveStore.saveScenarioGame(
      "scenario.split-hall",
      { state: "invalid-scenario-active" },
    );

    const source = await saveStore.exportProgressBundle(undefined, {
      validateMain(payload) {
        if (
          (payload as { state?: unknown }).state !== "valid-main-backup"
        ) {
          throw new Error("invalid main runtime payload");
        }
      },
      validateScenario(_scenarioId, payload) {
        if (
          (payload as { state?: unknown }).state !==
          "valid-scenario-backup"
        ) {
          throw new Error("invalid scenario runtime payload");
        }
      },
    });

    expect(saveStore.deserializeProgressBundle(source)).toMatchObject({
      main: { state: "valid-main-backup" },
      scenarios: {
        "scenario.split-hall": { state: "valid-scenario-backup" },
      },
    });
  });

  it("falls back from an invalid fresh main payload to a valid stored backup", async () => {
    await saveStore.saveGame({ state: "valid-main-backup" });
    await saveStore.saveGame({ state: "invalid-main-active" });

    const source = await saveStore.exportProgressBundle(
      { state: "invalid-fresh-main" },
      {
        validateMain(payload) {
          if (
            (payload as { state?: unknown }).state !==
            "valid-main-backup"
          ) {
            throw new Error("invalid main runtime payload");
          }
        },
      },
    );

    expect(saveStore.deserializeProgressBundle(source).main).toEqual({
      state: "valid-main-backup",
    });
  });

  it("fails export rather than silently omitting an invalid scenario slot", async () => {
    await saveStore.saveGame({ state: "valid-main" });
    await saveStore.saveScenarioGame(
      "scenario.split-hall",
      { state: "invalid-backup" },
    );
    await saveStore.saveScenarioGame(
      "scenario.split-hall",
      { state: "invalid-active" },
    );

    await expect(saveStore.exportProgressBundle(undefined, {
      validateMain() {},
      validateScenario() {
        throw new Error("invalid scenario runtime payload");
      },
    })).rejects.toThrow(/Split Hall scenario save/);
  });

  it("fails export rather than silently replacing invalid meta progress", async () => {
    await saveStore.saveGame({ state: "valid-main" });
    const invalidMetaEnvelope = JSON.parse(saveStore.exportSave({
      schemaVersion: 1,
      scenarioMedals: "not-an-object",
      unlockedCosmeticIds: [],
      unlockedTitleIds: [],
      completedContractIds: [],
    })) as Record<string, unknown>;
    idbHarness.stores.get("metaProgression")!.set(
      "meta-progression::active",
      invalidMetaEnvelope,
    );

    await expect(
      saveStore.exportProgressBundle(),
    ).rejects.toThrow(/medal and mastery progress/);
  });

  it("migrates legacy main files without erasing newer isolated progress", async () => {
    await saveStore.saveScenarioGame(
      "scenario.narrow-aisles",
      { score: 72 },
    );
    await saveStore.saveMetaProgression(metaWithRewards);
    const payload = { runtimeSchemaVersion: 4, core: { schemaVersion: 6 } };
    const source = saveStore.exportSave(payload);
    expect(saveStore.importSave(source)).toEqual(payload);
    expect(saveStore.deserializeProgressBundle(source)).toEqual({
      main: payload,
      scenarios: {},
      metaProgression: {
        schemaVersion: 1,
        scenarioMedals: {},
        unlockedCosmeticIds: [],
        unlockedTitleIds: [],
        completedContractIds: [],
        mastery: { schemaVersion: 1 },
      },
    });
    await saveStore.importProgressBundle(source);
    await expect(saveStore.loadGame()).resolves.toEqual(payload);
    await expect(saveStore.loadScenarioGame(
      "scenario.narrow-aisles",
    )).resolves.toEqual({ score: 72 });
    await expect(saveStore.loadMetaProgression()).resolves.toEqual(
      metaWithRewards,
    );
    expect(() => saveStore.importSave("not json")).toThrow(/not valid JSON/);
  });
});
