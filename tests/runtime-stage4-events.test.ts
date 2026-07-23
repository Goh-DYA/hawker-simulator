import { describe, expect, it } from "vitest";
import { NUTRITION_CONTENT } from "@/src/content";
import {
  asMoneyCents,
  forecastForServicePeriod,
  lockPeriodForecast,
  startServicePeriod,
  type GameState,
  type NeighbourhoodEventOccurrenceState,
  type ServicePeriodState,
} from "@/src/game/core";
import { selectNeighbourhoodEvent } from "@/src/game/core/strategicProgression";
import {
  buildCatalog,
  decodeRuntimeSave,
  deduplicatedPartialPartyOutcomeIds,
  defaultDishVariants,
  freshState,
  prepareRuntimeNeighbourhoodEvent,
  prepareRuntimeVisualQaEventState,
  resolvePeriodOutcomes,
  resolveRuntimeNeighbourhoodEvent,
  runtimeEventRequiresDecision,
  runtimeNeighbourhoodEventSummary,
  runtimePartySummaries,
  runtimeRegularProgressSummaries,
} from "@/src/game/runtime/createHawkerRuntime";

function period(
  periodIndex: 0 | 1 | 2 | 3,
  periodId: ServicePeriodState["periodId"],
  sequenceId: number,
  day = 1,
): ServicePeriodState {
  const startMinutes = [360, 600, 840, 1_080] as const;
  return {
    day,
    periodIndex,
    periodId,
    sequenceId,
    phase: "planning",
    arrivalElapsedMs: 0,
    drainElapsedMs: 0,
    displayedMinute: startMinutes[periodIndex],
    cohortCustomerIds: [],
    overtimeUpkeepCharged: false,
    stallOpenElapsedMs: {},
  };
}

function stateForPeriod(
  servicePeriod: ServicePeriodState,
  arrivalSamplingSeed = 1,
): GameState {
  const { catalog } = buildCatalog();
  const base = freshState(catalog, "runtime-stage4-event-test");
  return {
    ...base,
    servicePeriod,
    arrivalSamplingSeed,
    forecast: lockPeriodForecast(
      forecastForServicePeriod(servicePeriod),
      base.catalog,
      base.progression,
    ),
    strategicGameplay: {
      ...base.strategicGameplay,
      neighbourhoodEvents: {
        history: [],
        eventCountByDay: {},
      },
    },
  };
}

function seedSelecting(
  eventId: string | undefined,
  servicePeriod: ServicePeriodState,
): number {
  for (let seed = 1; seed < 50_000; seed += 1) {
    const selected = selectNeighbourhoodEvent({
      seed,
      day: servicePeriod.day,
      periodId: servicePeriod.periodId,
      periodSequenceId: servicePeriod.sequenceId,
      history: [],
    });
    if (selected?.id === eventId) return seed;
  }
  throw new Error(`Could not find deterministic seed for ${eventId ?? "no event"}`);
}

describe("Stage 4 runtime neighbourhood events", () => {
  it("uses the V5 runtime envelope without changing core money cents", () => {
    const core = {
      schemaVersion: 7,
      economy: { cashCents: 42_075 },
    };
    const decoded = decodeRuntimeSave({
      runtimeSchemaVersion: 5,
      core,
      stallMenus: {},
      activeDishVariants: defaultDishVariants(),
      nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
      periodOutcomes: {},
    });

    expect(decoded.runtimeSchemaVersion).toBe(5);
    expect(decoded.core).toBe(core);
    expect((decoded.core as typeof core).economy.cashCents).toBe(42_075);
  });

  it("selects once, exposes an untimed choice, and freezes its resolution", () => {
    const lunch = period(1, "lunch", 2);
    const seed = seedSelecting("event.office-lunch-wave", lunch);
    const source = stateForPeriod(lunch, seed);
    const originalConditionIncidence =
      source.forecast.conditionAwareIncidenceBasisPoints;

    const prepared = prepareRuntimeNeighbourhoodEvent(source);
    const repeated = prepareRuntimeNeighbourhoodEvent(prepared);
    const summary = runtimeNeighbourhoodEventSummary(prepared);

    expect(prepared.strategicGameplay.neighbourhoodEvents.history).toHaveLength(1);
    expect(repeated.strategicGameplay.neighbourhoodEvents.history).toHaveLength(1);
    expect(summary?.eventId).toBe("event.office-lunch-wave");
    expect(summary?.requiresDecision).toBe(true);
    expect(summary?.baseModifierLabels).toEqual([
      "Arrival volume +22%",
      "Fast service interest +24 percentage points",
    ]);
    expect(summary?.neutralModifierLabels).toEqual([
      "Arrival volume +22%",
      "Fast service interest +24 percentage points",
    ]);
    expect(summary?.resolvedOutcome).toBeUndefined();
    expect(summary?.choices).toEqual([
      expect.objectContaining({
        id: "event-choice.steady-queues",
        resultingOutcome:
          "Retain the published forecast without favouring a menu category.",
        choiceDeltaLabels: ["No additional operational change (0%)"],
        resultingModifierLabels: [
          "Arrival volume +22%",
          "Fast service interest +24 percentage points",
        ],
      }),
      expect.objectContaining({
        id: "event-choice.highlight-quick-meals",
        resultingOutcome:
          "Increase interest in preparations already tagged for fast service.",
        choiceDeltaLabels: [
          "Fast service interest +10 percentage points",
        ],
        resultingModifierLabels: [
          "Arrival volume +22%",
          "Fast service interest +34 percentage points",
        ],
      }),
    ]);
    expect(runtimeEventRequiresDecision(prepared)).toBe(true);
    expect(prepared.forecast.conditionAwareIncidenceBasisPoints).toBe(
      originalConditionIncidence,
    );

    const resolved = resolveRuntimeNeighbourhoodEvent(prepared, {
      kind: "choose",
      choiceId: "event-choice.highlight-quick-meals",
    });
    expect(resolved).toBeDefined();
    expect(runtimeEventRequiresDecision(resolved!)).toBe(false);
    expect(
      resolved!.strategicGameplay.neighbourhoodEvents.current?.selectedChoiceId,
    ).toBe("event-choice.highlight-quick-meals");
    expect(
      runtimeNeighbourhoodEventSummary(resolved!)
        ?.preferenceTagBasisPointDeltas["fast-service"],
    ).toBe(3_400);
    expect(runtimeNeighbourhoodEventSummary(resolved!)?.modifierLabels).toEqual([
      "Arrival volume +22%",
      "Fast service interest +34 percentage points",
    ]);
    expect(runtimeNeighbourhoodEventSummary(resolved!)?.resolvedOutcome).toBe(
      "Increase interest in preparations already tagged for fast service.",
    );
    expect(resolveRuntimeNeighbourhoodEvent(resolved!, { kind: "dismiss" })).toBeUndefined();
    expect(resolveRuntimeNeighbourhoodEvent({
      ...prepared,
      servicePeriod: startServicePeriod(prepared.servicePeriod),
    }, { kind: "dismiss" })).toBeUndefined();
  });

  it("builds a coherent non-persisting lunch state for event visual QA", () => {
    const source = stateForPeriod(period(0, "breakfast", 1));
    const prepared = prepareRuntimeVisualQaEventState(
      source,
      "office-lunch-wave",
    );
    const summary = runtimeNeighbourhoodEventSummary(prepared);

    expect(prepared.servicePeriod).toMatchObject({
      day: 1,
      periodIndex: 1,
      periodId: "lunch",
      sequenceId: 2,
      phase: "planning",
      displayedMinute: 600,
    });
    expect(prepared.progression.focusDay).toBe(2);
    expect(prepared.progression.dailyObjectives).toHaveLength(3);
    expect(prepared.periodLedgers[2]?.openingCashCents).toBe(
      source.economy.cashCents,
    );
    expect(summary).toMatchObject({
      eventId: "event.office-lunch-wave",
      requiresDecision: true,
      dismissed: false,
    });
    expect(
      prepareRuntimeVisualQaEventState(source, "unknown-fixture"),
    ).toBe(source);
  });

  it("uses the documented neutral result on dismissal and preserves pause intent", () => {
    const lunch = period(1, "lunch", 2);
    const prepared = prepareRuntimeNeighbourhoodEvent(
      stateForPeriod(lunch, seedSelecting("event.office-lunch-wave", lunch)),
    );
    const dismissed = resolveRuntimeNeighbourhoodEvent(prepared, { kind: "dismiss" });

    expect(dismissed?.strategicGameplay.neighbourhoodEvents.current).toMatchObject({
      eventId: "event.office-lunch-wave",
      selectedChoiceId: undefined,
      dismissed: true,
    });
    expect(runtimeNeighbourhoodEventSummary(dismissed!)?.requiresDecision).toBe(false);
    expect(
      runtimeNeighbourhoodEventSummary(dismissed!)
        ?.preferenceTagBasisPointDeltas["fast-service"],
    ).toBe(2_400);
    expect(runtimeNeighbourhoodEventSummary(dismissed!)).toMatchObject({
      neutralModifierLabels: [
        "Arrival volume +22%",
        "Fast service interest +24 percentage points",
      ],
      resolvedOutcome:
        "The lunch wave arrives as forecast and chooses from the full menu.",
    });
  });

  it("deduplicates terminal partial parties and excludes zero-served departures", () => {
    const partialEvent = {
      type: "party-partial" as const,
      tick: 8,
      entityId: "party-mixed",
      message: "second-stall-unavailable",
    };
    const parties = {
      "party-mixed": {
        members: [{ served: true }, { served: false }],
      },
      "party-unserved": {
        members: [{ served: false }, { served: false }],
      },
    } as unknown as Parameters<typeof deduplicatedPartialPartyOutcomeIds>[1];
    const events = [
      partialEvent,
      { ...partialEvent, message: "drain-watchdog-partial" },
      {
        ...partialEvent,
        entityId: "party-unserved",
        message: "no-feasible-two-stop-plan",
      },
      { ...partialEvent, entityId: undefined },
    ];

    expect(
      deduplicatedPartialPartyOutcomeIds(events, parties, {}, []),
    ).toEqual(["party-mixed"]);
    expect(
      deduplicatedPartialPartyOutcomeIds(
        events,
        parties,
        {},
        ["party-mixed"],
      ),
    ).toEqual([]);

    const restored = resolvePeriodOutcomes({
      2: {
        periodSequenceId: 2,
        unservedDepartures: 1,
        timedOutServedVisits: 0,
        partialPartyVisits: 1,
        partialPartyOutcomeIds: ["party-mixed", "party-mixed", 42],
      },
    }, 2);
    expect(restored[2]).toMatchObject({
      partialPartyVisits: 1,
      partialPartyOutcomeIds: ["party-mixed"],
    });
  });

  it("honours deterministic no-event periods and the two-event daily cap", () => {
    const breakfast = period(0, "breakfast", 1);
    const noEventSeed = seedSelecting(undefined, breakfast);
    const first = prepareRuntimeNeighbourhoodEvent(
      stateForPeriod(breakfast, noEventSeed),
    );
    const second = prepareRuntimeNeighbourhoodEvent(
      stateForPeriod(breakfast, noEventSeed),
    );
    expect(first.strategicGameplay.neighbourhoodEvents.current).toBeUndefined();
    expect(second.forecast).toEqual(first.forecast);

    const occurrences: readonly NeighbourhoodEventOccurrenceState[] = [
      {
        day: 1,
        periodSequenceId: 1,
        periodId: "breakfast",
        eventId: "event.community-garden-morning",
        dismissed: true,
      },
      {
        day: 1,
        periodSequenceId: 2,
        periodId: "lunch",
        eventId: "event.office-lunch-wave",
        dismissed: true,
      },
    ];
    const tea = stateForPeriod(period(2, "tea", 3), 42);
    const capped = prepareRuntimeNeighbourhoodEvent({
      ...tea,
      strategicGameplay: {
        ...tea.strategicGameplay,
        neighbourhoodEvents: {
          history: occurrences,
          eventCountByDay: { 1: 2 },
          current: occurrences[1],
        },
      },
    });
    expect(capped.strategicGameplay.neighbourhoodEvents.history).toHaveLength(2);
    expect(capped.strategicGameplay.neighbourhoodEvents.current).toBeUndefined();
  });

  it("projects canonical party and regular summaries for the UI boundary", () => {
    const source = stateForPeriod(period(0, "breakfast", 1));
    const withStrategy: GameState = {
      ...source,
      strategicGameplay: {
        ...source.strategicGameplay,
        regularProgress: {
          "regular.mei-lin": {
            encounterCount: 3,
            storyStep: 2,
            lastVisitDay: 1,
          },
        },
        parties: {
          "party-1": {
            partyId: "party-1",
            leaderCustomerId: "customer-1",
            memberCustomerIds: ["party-1:member-1", "party-1:member-2"],
            members: [
              {
                memberId: "party-1:member-1",
                archetypeId: "customer.student",
                budgetCents: asMoneyCents(1_000),
                healthConditions: [],
                plannedStallId: "stall-1",
                plannedDishId: "dish-1",
                trayReturnPlanned: true,
                served: true,
              },
              {
                memberId: "party-1:member-2",
                archetypeId: "customer.student",
                budgetCents: asMoneyCents(1_000),
                healthConditions: [],
                plannedStallId: "stall-1",
                plannedDishId: "dish-1",
                trayReturnPlanned: false,
                served: false,
              },
            ],
            phase: "queueing",
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

    expect(runtimePartySummaries(withStrategy)).toEqual([
      expect.objectContaining({
        partyId: "party-1",
        guestCount: 2,
        servedGuestCount: 1,
        servingStopCount: 1,
      }),
    ]);
    expect(
      runtimeRegularProgressSummaries(withStrategy).find(
        (regular) => regular.regularId === "regular.mei-lin",
      ),
    ).toMatchObject({
      encounterCount: 3,
      storyStep: 2,
      lastVisitDay: 1,
      currentStoryBeat:
        "She shares a book recommendation from the library display.",
    });
  });
});
