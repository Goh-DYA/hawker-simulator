import { describe, expect, it } from "vitest";
import {
  deserializeGameState,
  migratePersistentState,
  persistentStateFromGame,
  serializeGameState,
  stepSimulation,
  type GameState,
  type NeighbourhoodEventOccurrenceState,
  type PartyLifecycleState,
} from "../../src/game/core";
import {
  createRuntimeSaveEnvelopeV5,
  decodeRuntimeSaveEnvelope,
} from "../../src/game/persistence/runtimeEnvelope";
import { makeGame, TEST_CATALOG } from "./fixtures";

function gameWithActiveCustomer(): GameState {
  let state = makeGame({ seed: "stage4-persistence" });
  for (
    let step = 0;
    step < 50 && Object.keys(state.customers).length === 0;
    step += 1
  ) {
    state = stepSimulation(state);
  }
  expect(Object.keys(state.customers).length).toBeGreaterThan(0);
  return state;
}

function occurrence(
  overrides: Partial<NeighbourhoodEventOccurrenceState> = {},
): NeighbourhoodEventOccurrenceState {
  return {
    day: 1,
    periodSequenceId: 1,
    periodId: "breakfast",
    eventId: "event.community-garden-morning",
    dismissed: true,
    ...overrides,
  };
}

describe("Stage 4 core V7 persistence", () => {
  it("migrates the immediately preceding V6 preview without changing Stage 1-3 state", () => {
    const v7 = persistentStateFromGame(makeGame({ seed: "v6-preview" }));
    const withoutStrategic = Object.fromEntries(
      Object.entries(v7).filter(([key]) => key !== "strategicGameplay"),
    );
    const v6Metrics = Object.fromEntries(
      Object.entries(v7.metrics).filter(
        ([key]) => key !== "trayReturnOpportunities",
      ),
    );
    const v6 = {
      ...withoutStrategic,
      schemaVersion: 6,
      metrics: { ...v6Metrics, trayReturns: 3 },
    };

    const migrated = migratePersistentState(v6);

    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.economy).toEqual(v7.economy);
    expect(migrated.progression).toEqual(v7.progression);
    expect(migrated.servicePeriod).toEqual(v7.servicePeriod);
    expect(migrated.periodLedgers).toEqual(v7.periodLedgers);
    expect(migrated.forecast).toEqual(v7.forecast);
    expect(migrated.comboBoard).toEqual(v7.comboBoard);
    expect(migrated.metrics.trayReturns).toBe(3);
    expect(migrated.metrics.trayReturnOpportunities).toBe(3);
    expect(migrated.strategicGameplay).toEqual({
      regularProgress: {},
      neighbourhoodEvents: { history: [], eventCountByDay: {} },
      parties: {},
    });

    expect(() => migratePersistentState({
      ...v7,
      metrics: v6Metrics,
    })).toThrow(/trayReturnOpportunities/);
  });

  it("keeps V6 active visits singleton and does not invent companion state", () => {
    const active = persistentStateFromGame(gameWithActiveCustomer());
    const v6 = Object.fromEntries(
      Object.entries(active)
        .filter(([key]) => key !== "strategicGameplay")
        .map(([key, value]) => [
          key,
          key === "metrics"
            ? Object.fromEntries(
                Object.entries(active.metrics).filter(
                  ([metricKey]) => metricKey !== "trayReturnOpportunities",
                ),
              )
            : value,
        ]),
    );

    const migrated = migratePersistentState({ ...v6, schemaVersion: 6 });

    expect(migrated.strategicGameplay.parties).toEqual({});
    expect(migrated.customers.every(
      (customer) =>
        customer.partyId === undefined &&
        customer.regularId === undefined &&
        customer.trayReturnPlanned === undefined,
    )).toBe(true);
  });

  it("round-trips regular stories, event counters and a canonical leader-only party", () => {
    const base = gameWithActiveCustomer();
    const leader = Object.values(base.customers)[0]!;
    const leaderSequence = Number(leader.id.slice("customer-".length));
    const companionId = `customer-${leaderSequence + 1}`;
    const leaderObservation = base.forecastArrivals.find(
      (arrival) => arrival.customerId === leader.id,
    )!;
    const partyId = "party.breakfast-1";
    const party: PartyLifecycleState = {
      partyId,
      leaderCustomerId: leader.id,
      memberCustomerIds: [leader.id, companionId],
      members: [
        {
          memberId: leader.id,
          archetypeId: leader.archetypeId,
          budgetCents: leader.forecastBudgetCents ?? TEST_CATALOG.archetypes.regular!.budgetCents,
          nutritionIntentId: "fibre-forward",
          healthConditions: [],
          plannedStallId: "stall-1",
          plannedDishId: "rice",
          trayReturnPlanned: true,
          served: false,
        },
        {
          memberId: companionId,
          archetypeId: "valueSeeker",
          budgetCents: TEST_CATALOG.archetypes.valueSeeker!.budgetCents,
          nutritionIntentId: "sodium-aware",
          healthConditions: ["hypertension"],
          plannedStallId: "stall-1",
          plannedDishId: "rice",
          trayReturnPlanned: false,
          served: false,
        },
      ],
      phase: "routing",
      orderStrategy: "single-stall-fallback",
      stallIds: ["stall-1"],
      nextStopIndex: 0,
      seatKeys: [],
      seatWaitElapsedMs: 0,
      splitExplained: false,
    };
    const currentEvent = occurrence();
    const state: GameState = {
      ...base,
      customers: {
        ...base.customers,
        [leader.id]: {
          ...leader,
          partyId,
          regularId: "regular.mei-lin",
          regularStoryStep: 1,
          visitPreferenceTags: ["quiet", "coffee"],
          trayReturnPlanned: true,
        },
      },
      forecastArrivals: [
        { ...leaderObservation, groupSize: 2 },
        {
          ...leaderObservation,
          customerId: companionId,
          archetypeId: "valueSeeker",
          budgetCents: TEST_CATALOG.archetypes.valueSeeker!.budgetCents,
          groupSize: 2,
          nutritionIntent: "sodium-aware",
          healthConditions: ["hypertension"],
        },
      ],
      nextCustomerSequence: leaderSequence + 2,
      metrics: {
        ...base.metrics,
        spawnedCustomers: base.metrics.despawnedCustomers + 2,
      },
      strategicGameplay: {
        regularProgress: {
          "regular.mei-lin": {
            encounterCount: 1,
            storyStep: 1,
            lastVisitDay: 1,
          },
        },
        neighbourhoodEvents: {
          history: [currentEvent],
          eventCountByDay: { 1: 1 },
          current: currentEvent,
        },
        parties: { [partyId]: party },
      },
    };

    const loaded = deserializeGameState(
      serializeGameState(state),
      TEST_CATALOG,
      { config: state.config },
    );

    expect(loaded.schemaVersion).toBe(7);
    expect(loaded.customers[leader.id]).toMatchObject({
      partyId,
      regularId: "regular.mei-lin",
      regularStoryStep: 1,
      visitPreferenceTags: ["quiet", "coffee"],
      trayReturnPlanned: true,
    });
    expect(loaded.strategicGameplay).toEqual(state.strategicGameplay);
    expect(Object.keys(loaded.customers)).not.toContain(
      companionId,
    );
  });

  it("rejects forged event counters and non-canonical companion customers", () => {
    const active = gameWithActiveCustomer();
    const leader = Object.values(active.customers)[0]!;
    const save = persistentStateFromGame(active);
    const malformedCounters = {
      ...save,
      strategicGameplay: {
        ...save.strategicGameplay,
        neighbourhoodEvents: {
          history: [occurrence()],
          eventCountByDay: { 1: 2 },
        },
      },
    };
    expect(() => migratePersistentState(malformedCounters)).toThrow(
      /eventCountByDay does not match history/,
    );

    const companionId = "customer-forged-companion";
    const partyId = "party.forged";
    const malformedParty = {
      ...save,
      customers: [
        ...save.customers.map((customer) =>
          customer.id === leader.id ? { ...customer, partyId } : customer),
        {
          ...save.customers.find((customer) => customer.id === leader.id)!,
          id: companionId,
          partyId: undefined,
        },
      ],
      strategicGameplay: {
        ...save.strategicGameplay,
        parties: {
          [partyId]: {
            partyId,
            leaderCustomerId: leader.id,
            memberCustomerIds: [leader.id, companionId],
            members: [
              {
                memberId: leader.id,
                archetypeId: leader.archetypeId,
                budgetCents: 1_000,
                healthConditions: [],
                plannedStallId: "stall-1",
                plannedDishId: "rice",
                trayReturnPlanned: true,
                served: false,
              },
              {
                memberId: companionId,
                archetypeId: "valueSeeker",
                budgetCents: 1_000,
                healthConditions: [],
                plannedStallId: "stall-1",
                plannedDishId: "rice",
                trayReturnPlanned: false,
                served: false,
              },
            ],
            phase: "routing",
            orderStrategy: "single-stall-fallback",
            stallIds: ["stall-1"],
            nextStopIndex: 0,
            seatKeys: [],
            seatWaitElapsedMs: 0,
            splitExplained: false,
          },
        },
      },
    };
    expect(() => migratePersistentState(malformedParty)).toThrow(
      /companions inside the canonical party/,
    );
  });
});

describe("Stage 4 runtime V5 envelope", () => {
  it("decodes V1-V4 payloads without touching core cents", () => {
    const core = {
      schemaVersion: 6,
      economy: { cashCents: 42_075 },
      comboBoard: { slots: [null, null, null] },
    };
    const decoded = decodeRuntimeSaveEnvelope({
      runtimeSchemaVersion: 4,
      core,
      stallMenus: { stall: ["rice"] },
      activeDishVariants: { rice: "rice-default" },
      nutritionDataVersion: "test",
      periodOutcomes: {},
    });

    expect(decoded.runtimeSchemaVersion).toBe(4);
    expect(decoded.core).toBe(core);
    expect((decoded.core as typeof core).economy.cashCents).toBe(42_075);
    expect(decoded.incompleteLegacyRuntime).toBe(false);
  });

  it("marks incomplete legacy wrappers and emits exact V5 writes", () => {
    const decoded = decodeRuntimeSaveEnvelope({
      runtimeSchemaVersion: 3,
      core: { schemaVersion: 5 },
      stallMenus: {},
    });
    expect(decoded.incompleteLegacyRuntime).toBe(true);

    const envelope = createRuntimeSaveEnvelopeV5({
      core: { schemaVersion: 7, economy: { cashCents: 12_345 } },
      stallMenus: { "stall-1": ["rice"] },
      nutritionDataVersion: "nutrition-v2",
      activeDishVariants: { rice: "rice-default" },
      periodOutcomes: { 1: { unservedDepartures: 0 } },
    });
    expect(envelope.runtimeSchemaVersion).toBe(5);
    expect((envelope.core as { economy: { cashCents: number } }).economy.cashCents)
      .toBe(12_345);
    expect(() => decodeRuntimeSaveEnvelope({
      runtimeSchemaVersion: 99,
      core: {},
    })).toThrow(/Unsupported runtime save version/);
    expect(() => decodeRuntimeSaveEnvelope({
      runtimeSchemaVersion: 5,
      core: {},
      stallMenus: {},
      activeDishVariants: {},
      nutritionDataVersion: "",
      periodOutcomes: {},
    })).toThrow(/V5 save envelope is missing required/);
  });
});
