import { describe, expect, it } from "vitest";

import {
  asMoneyCents,
  assertSimulationInvariants,
  createPeriodLedger,
  deserializeGameState,
  finalizeDrainWatchdogState,
  ledgerReconciliationDeltaCents,
  samplePreferenceTagAdjustments,
  sampleForecastShare,
  serializeGameState,
  simulationDigest,
  stepSimulation,
  visitXp,
  type GameState,
  type PartyLifecycleState,
  type PlacedObject,
  type SimulationCatalog,
} from "../../src/game/core";
import { REGULARS } from "../../src/content/strategicGameplay";
import { selectRegularForVisit } from "../../src/game/core/strategicProgression";
import { makeGame, TEST_CATALOG } from "./fixtures";

function partyCatalog(): SimulationCatalog {
  return {
    ...TEST_CATALOG,
    dishes: {
      noodles: {
        ...TEST_CATALOG.dishes.noodles!,
        ingredientCostCents: asMoneyCents(280),
      },
      rice: {
        ...TEST_CATALOG.dishes.rice!,
        ingredientCostCents: asMoneyCents(190),
      },
    },
    archetypes: {
      regular: {
        ...TEST_CATALOG.archetypes.regular!,
        groupSizeRange: [2, 2],
        trayReturnChance: 0.35,
      },
      valueSeeker: {
        ...TEST_CATALOG.archetypes.valueSeeker!,
        groupSizeRange: [2, 2],
        trayReturnChance: 0.75,
      },
    },
  };
}

function partyGame(seed: string): GameState {
  const state = makeGame({
    seed,
    catalog: partyCatalog(),
    config: {
      fixedStepMs: 100,
      spawnIntervalMs: 1_000_000,
      stuckRecoveryMs: 1_000,
      maxVisitMs: 30_000,
      standard: { maxActiveCustomers: 20, maxFixedStepsPerAdvance: 100 },
      lowerEnd: { maxActiveCustomers: 8, maxFixedStepsPerAdvance: 50 },
    },
  });
  return {
    ...state,
    forecast: {
      ...state.forecast,
      demandRange: [2, 2],
      groupSizeMix: [{ id: "pair", size: 2, basisPoints: 10_000 }],
      nutritionNeeds: [
        {
          id: "intent.fibre-forward",
          kind: "nutrition-intent",
          nutritionIntent: "fibre-forward",
          basisPoints: 10_000,
        },
        {
          id: "condition.hypertension",
          kind: "condition-aware",
          healthCondition: "hypertension",
          basisPoints: 10_000,
        },
      ],
      nutritionIntentIncidenceBasisPoints: 10_000,
      conditionAwareIncidenceBasisPoints: 10_000,
    },
  };
}

function eventPreferenceCatalog(): SimulationCatalog {
  const catalog = partyCatalog();
  return {
    ...catalog,
    dishes: {
      noodles: {
        ...catalog.dishes.noodles!,
        quality: 1,
        preferenceTags: ["fast-service"],
      },
      rice: {
        ...catalog.dishes.rice!,
        quality: 5,
        preferenceTags: [],
      },
    },
    archetypes: Object.fromEntries(
      Object.entries(catalog.archetypes).map(([id, archetype]) => [
        id,
        { ...archetype, preferenceTags: [] },
      ]),
    ),
  };
}

function eventPreferenceGame(
  seed: string,
  choiceId:
    | "event-choice.steady-queues"
    | "event-choice.highlight-quick-meals",
): GameState {
  const catalog = eventPreferenceCatalog();
  const source = makeGame({
    seed,
    catalog,
    config: {
      fixedStepMs: 100,
      spawnIntervalMs: 1_000_000,
      stuckRecoveryMs: 1_000,
      maxVisitMs: 30_000,
      standard: { maxActiveCustomers: 20, maxFixedStepsPerAdvance: 100 },
      lowerEnd: { maxActiveCustomers: 8, maxFixedStepsPerAdvance: 50 },
    },
  });
  const occurrence = {
    day: 1,
    periodSequenceId: 2,
    periodId: "lunch" as const,
    eventId: "event.office-lunch-wave",
    selectedChoiceId: choiceId,
    dismissed: false,
  };
  return {
    ...source,
    progression: {
      ...source.progression,
      focusDay: 2,
    },
    servicePeriod: {
      ...source.servicePeriod,
      periodIndex: 1,
      periodId: "lunch",
      sequenceId: 2,
      displayedMinute: 600,
    },
    periodLedgers: {
      ...source.periodLedgers,
      2: createPeriodLedger(2, source.economy.cashCents),
    },
    forecast: {
      ...source.forecast,
      periodId: "lunch",
      periodSequenceId: 2,
      demandRange: [2, 2],
      groupSizeMix: [{ id: "pair", size: 2, basisPoints: 10_000 }],
      nutritionNeeds: [
        {
          id: "intent.fibre-forward",
          kind: "nutrition-intent",
          nutritionIntent: "fibre-forward",
          basisPoints: 10_000,
        },
        {
          id: "condition.hypertension",
          kind: "condition-aware",
          healthCondition: "hypertension",
          basisPoints: 10_000,
        },
      ],
      nutritionIntentIncidenceBasisPoints: 10_000,
      conditionAwareIncidenceBasisPoints: 10_000,
    },
    strategicGameplay: {
      ...source.strategicGameplay,
      neighbourhoodEvents: {
        history: [occurrence],
        eventCountByDay: { 1: 1 },
        current: occurrence,
      },
    },
  };
}

function seedInOfficeLunchChoiceDelta(): string {
  for (let index = 0; index < 10_000; index += 1) {
    const seed = `stage4-event-preference-${index}`;
    const source = eventPreferenceGame(
      seed,
      "event-choice.steady-queues",
    );
    const samplingKey =
      `${source.arrivalSamplingSeed}:2:customer-1:event.office-lunch-wave`;
    const base = samplePreferenceTagAdjustments(
      { "fast-service": 2_400 },
      samplingKey,
    ).addedTags.includes("fast-service");
    const highlighted = samplePreferenceTagAdjustments(
      { "fast-service": 3_400 },
      samplingKey,
    ).addedTags.includes("fast-service");
    if (!base && highlighted) return seed;
  }
  throw new Error("Could not find a keyed visit inside the +10pp choice delta.");
}

function comboPartyGame(
  seed: string,
  stallInstanceIds = {
    main: "stall-main-1",
    side: "stall-side-1",
  },
): GameState {
  const catalog = partyCatalog();
  const comboCatalog: SimulationCatalog = {
    ...catalog,
    dishes: {
      noodles: {
        ...catalog.dishes.noodles!,
        priceCents: asMoneyCents(300),
        ingredientCostCents: asMoneyCents(100),
        mealRole: "main",
        activePreparationId: "noodles::base",
      },
      rice: {
        ...catalog.dishes.rice!,
        priceCents: asMoneyCents(200),
        ingredientCostCents: asMoneyCents(60),
        mealRole: "side",
        activePreparationId: "rice::base",
      },
    },
    placeables: {
      ...catalog.placeables,
      "stall-main": {
        ...catalog.placeables.stall!,
        id: "stall-main",
        stall: {
          ...catalog.placeables.stall!.stall!,
          dishIds: ["noodles"],
          allDishIds: ["noodles"],
        },
      },
      "stall-side": {
        ...catalog.placeables.stall!,
        id: "stall-side",
        stall: {
          ...catalog.placeables.stall!.stall!,
          dishIds: ["rice"],
          allDishIds: ["rice"],
        },
      },
    },
  };
  const initialObjects: readonly PlacedObject[] = [
    {
      id: stallInstanceIds.main,
      definitionId: "stall-main",
      origin: { x: 2, y: 0 },
      rotation: 0,
      open: true,
    },
    {
      id: stallInstanceIds.side,
      definitionId: "stall-side",
      origin: { x: 7, y: 0 },
      rotation: 0,
      open: true,
    },
    {
      id: "seat-1",
      definitionId: "seat",
      origin: { x: 6, y: 4 },
      rotation: 0,
      open: false,
    },
    {
      id: "seat-2",
      definitionId: "seat",
      origin: { x: 7, y: 4 },
      rotation: 0,
      open: false,
    },
  ];
  const state = makeGame({
    seed,
    catalog: comboCatalog,
    initialObjects,
    config: {
      fixedStepMs: 100,
      spawnIntervalMs: 1_000_000,
      stuckRecoveryMs: 1_000,
      maxVisitMs: 30_000,
      standard: { maxActiveCustomers: 20, maxFixedStepsPerAdvance: 100 },
      lowerEnd: { maxActiveCustomers: 8, maxFixedStepsPerAdvance: 50 },
    },
  });
  return {
    ...state,
    progression: { ...state.progression, level: 5 },
    comboBoard: {
      slots: [{
        id: "main-side",
        preparationIds: ["noodles::base", "rice::base"],
      }, null, null],
    },
    forecast: {
      ...state.forecast,
      demandRange: [2, 2],
      groupSizeMix: [{ id: "pair", size: 2, basisPoints: 10_000 }],
      mealMix: [{
        id: "main-and-side",
        basisPoints: 10_000,
      }],
    },
  };
}

function seedForRegular(regularId: string, periodId: GameState["servicePeriod"]["periodId"]) {
  for (let seed = 1; seed < 100_000; seed += 1) {
    if (selectRegularForVisit({
      seed,
      day: 1,
      periodId,
      arrivalSequenceId: 1,
      progress: {},
    })?.id === regularId) {
      return seed;
    }
  }
  throw new Error(`Could not find deterministic visit seed for ${regularId}`);
}

function activeParty(state: GameState): PartyLifecycleState {
  const parties = Object.values(state.strategicGameplay.parties);
  expect(parties).toHaveLength(1);
  return parties[0]!;
}

function spawnPair(seed: string): GameState {
  const state = stepSimulation(partyGame(seed));
  expect(() => assertSimulationInvariants(state)).not.toThrow();
  expect(Object.keys(state.customers)).toHaveLength(1);
  expect(activeParty(state).members).toHaveLength(2);
  return state;
}

function runUntil(
  source: GameState,
  predicate: (state: GameState) => boolean,
  maximumSteps = 500,
): GameState {
  let state = source;
  for (let step = 0; step <= maximumSteps; step += 1) {
    if (predicate(state)) return state;
    state = stepSimulation(state);
    expect(() => assertSimulationInvariants(state)).not.toThrow();
  }
  throw new Error(`Condition not reached after ${maximumSteps} simulation steps`);
}

function memberIdentity(party: PartyLifecycleState) {
  return party.members.map((member) => ({
    memberId: member.memberId,
    archetypeId: member.archetypeId,
    budgetCents: member.budgetCents,
    nutritionIntentId: member.nutritionIntentId,
    healthConditions: member.healthConditions,
    plannedStallId: member.plannedStallId,
    plannedDishId: member.plannedDishId,
    trayReturnPlanned: member.trayReturnPlanned,
  }));
}

describe("Stage 4 live party simulation", () => {
  it("samples the same party identities, independent needs, and tray plans for the same seed", () => {
    const first = spawnPair("stage4-party-determinism");
    const second = spawnPair("stage4-party-determinism");
    const firstParty = activeParty(first);
    const secondParty = activeParty(second);

    expect(memberIdentity(firstParty)).toEqual(memberIdentity(secondParty));
    expect(first.forecastArrivals).toEqual(second.forecastArrivals);
    expect(first.strategicGameplay.regularProgress).toEqual(
      second.strategicGameplay.regularProgress,
    );
    expect(first.metrics).toEqual(second.metrics);

    expect(firstParty.memberCustomerIds).toEqual(
      firstParty.members.map((member) => member.memberId),
    );
    expect(firstParty.members.every(
      (member) =>
        member.nutritionIntentId === "fibre-forward" &&
        member.healthConditions.join(",") === "hypertension" &&
        typeof member.trayReturnPlanned === "boolean",
    )).toBe(true);
  });

  it("turns the Office Lunch Wave +24pp and +34pp audiences into distinct orders without consuming RNG", () => {
    const seed = seedInOfficeLunchChoiceDelta();
    const steady = stepSimulation(
      eventPreferenceGame(seed, "event-choice.steady-queues"),
    );
    const highlighted = stepSimulation(
      eventPreferenceGame(seed, "event-choice.highlight-quick-meals"),
    );
    const steadyLeader = activeParty(steady).members.find(
      (member) => member.memberId === "customer-1",
    );
    const highlightedLeader = activeParty(highlighted).members.find(
      (member) => member.memberId === "customer-1",
    );

    expect(steadyLeader?.plannedDishId).toBe("rice");
    expect(highlightedLeader?.plannedDishId).toBe("noodles");
    expect(steady.customers["customer-1"]?.visitPreferenceTags).not.toContain(
      "fast-service",
    );
    expect(
      highlighted.customers["customer-1"]?.visitPreferenceTags,
    ).toContain("fast-service");
    expect(highlighted.rngState).toBe(steady.rngState);
    expect(highlighted.arrivalSamplingSeed).toBe(steady.arrivalSamplingSeed);
    expect(
      highlighted.forecastArrivals.map((arrival) => ({
        customerId: arrival.customerId,
        nutritionIntent: arrival.nutritionIntent,
        healthConditions: arrival.healthConditions,
      })),
    ).toEqual(
      steady.forecastArrivals.map((arrival) => ({
        customerId: arrival.customerId,
        nutritionIntent: arrival.nutritionIntent,
        healthConditions: arrival.healthConditions,
      })),
    );
  });

  it("uses one visible leader and one queue footprint while counting every guest", () => {
    const spawned = spawnPair("stage4-party-queue");
    const party = activeParty(spawned);
    const leader = spawned.customers[party.leaderCustomerId]!;

    expect(Object.keys(spawned.customers)).toEqual([leader.id]);
    expect(spawned.metrics.spawnedCustomers).toBe(2);
    expect(spawned.metrics.despawnedCustomers).toBe(0);
    expect(spawned.forecastArrivals.map((arrival) => arrival.customerId)).toEqual(
      party.memberCustomerIds,
    );

    const queued = runUntil(
      spawned,
      (state) => Object.values(state.queues).some(
        (queue) => queue.includes(leader.id),
      ),
    );
    const queuedIds = Object.values(queued.queues).flat();
    expect(queuedIds.filter((customerId) => customerId === leader.id)).toHaveLength(1);
    expect(queuedIds.filter(
      (customerId) =>
        customerId !== leader.id &&
        party.memberCustomerIds.includes(customerId),
    )).toEqual([]);
    expect(Object.keys(queued.customers)).toEqual([leader.id]);
    expect(queued.metrics.spawnedCustomers).toBe(2);
  });

  it("round-trips an in-flight party without changing identity or future simulation", () => {
    const spawned = spawnPair("stage4-party-reload");
    const frozen = runUntil(
      spawned,
      (state) => activeParty(state).members.every(
        (member) => member.orderLineSnapshot !== undefined,
      ),
    );
    const loaded = deserializeGameState(
      serializeGameState(frozen),
      frozen.catalog,
      { config: frozen.config },
    );

    expect(loaded.strategicGameplay.parties).toEqual(
      frozen.strategicGameplay.parties,
    );
    expect(loaded.customers).toEqual(frozen.customers);
    expect(loaded.queues).toEqual(frozen.queues);
    expect(loaded.forecastArrivals).toEqual(frozen.forecastArrivals);
    expect(loaded.metrics).toEqual(frozen.metrics);
    expect(() => assertSimulationInvariants(loaded)).not.toThrow();

    let uninterrupted = frozen;
    let reloaded = loaded;
    for (let step = 0; step < 20; step += 1) {
      uninterrupted = stepSimulation(uninterrupted);
      reloaded = stepSimulation(reloaded);
    }
    expect(JSON.parse(simulationDigest(reloaded))).toEqual(
      JSON.parse(simulationDigest(uninterrupted)),
    );
  });

  it("round-trips a pending authored order after the dish leaves the active menu", () => {
    const spawned = spawnPair("stage4-party-pending-authored");
    const original = activeParty(spawned);
    const leader = spawned.customers[original.leaderCustomerId]!;
    const catalog: SimulationCatalog = {
      ...spawned.catalog,
      placeables: {
        ...spawned.catalog.placeables,
        stall: {
          ...spawned.catalog.placeables.stall!,
          stall: {
            ...spawned.catalog.placeables.stall!.stall!,
            dishIds: ["noodles"],
            allDishIds: ["noodles", "rice"],
          },
        },
      },
    };
    const pending: GameState = {
      ...spawned,
      catalog,
      customers: {
        [leader.id]: {
          ...leader,
          status: "choosing-stall",
          targetStallId: undefined,
          orderedDishId: undefined,
          orderLineSnapshot: undefined,
        },
      },
      queues: Object.fromEntries(
        Object.keys(spawned.queues).map((stallId) => [stallId, []]),
      ),
      strategicGameplay: {
        ...spawned.strategicGameplay,
        parties: {
          [original.partyId]: {
            ...original,
            phase: "forming",
            orderStrategy: "pending",
            stallIds: [],
            nextStopIndex: 0,
            members: original.members.map((member) => ({
              ...member,
              plannedStallId: "stall-1",
              plannedStallIds: ["stall-1"],
              plannedDishId: "rice",
              orderLineSnapshot: undefined,
              served: false,
            })),
          },
        },
      },
    };
    const loaded = deserializeGameState(
      serializeGameState(pending),
      catalog,
      { config: pending.config },
    );

    expect(activeParty(loaded).members.every(
      (member) =>
        member.plannedDishId === "rice" &&
        member.plannedStallIds?.join(",") === "stall-1",
    )).toBe(true);
    expect(() => assertSimulationInvariants(loaded)).not.toThrow();
    const leaving = stepSimulation(loaded);
    expect(activeParty(leaving).terminalServiceOutcome).toBe(
      "zero-served-unavailable",
    );
    expect(leaving.events.some((entry) => entry.type === "party-partial")).toBe(
      false,
    );
  });

  it("settles cents per guest and applies exact per-guest timeout XP before party cleanup", () => {
    const initial = partyGame("stage4-party-settlement");
    const baselineXp = initial.progression.xp;
    const baselineGross = initial.economy.lifetimeGrossSalesCents;
    const baselineCosts = initial.economy.lifetimeIngredientCostsCents;
    const served = runUntil(
      stepSimulation(initial),
      (state) => activeParty(state).members.every((member) => member.served),
    );
    const party = activeParty(served);
    const leader = served.customers[party.leaderCustomerId]!;
    const memberLines = party.members.map((member) => member.orderLineSnapshot!);
    const expectedGross = memberLines.reduce(
      (total, line) => total + line.terms.priceCents,
      0,
    );
    const expectedCosts = memberLines.reduce(
      (total, line) => total + line.terms.ingredientCostCents,
      0,
    );
    const ledger = served.periodLedgers[served.servicePeriod.sequenceId]!;
    const saleEntries = ledger.entries.filter((entry) => entry.kind === "gross-sale");
    const costEntries = ledger.entries.filter(
      (entry) => entry.kind === "ingredient-cost",
    );

    expect(saleEntries).toHaveLength(2);
    expect(costEntries).toHaveLength(2);
    expect(new Set(saleEntries.map((entry) => entry.visitId))).toEqual(
      new Set(party.memberCustomerIds),
    );
    expect(new Set(costEntries.map((entry) => entry.visitId))).toEqual(
      new Set(party.memberCustomerIds),
    );
    expect(served.economy.lifetimeGrossSalesCents - baselineGross).toBe(
      expectedGross,
    );
    expect(served.economy.lifetimeIngredientCostsCents - baselineCosts).toBe(
      expectedCosts,
    );
    expect(served.economy.completedVisits).toBe(2);
    expect(served.metrics.trayReturnOpportunities).toBe(2);
    expect(ledgerReconciliationDeltaCents(ledger, served.economy.cashCents)).toBe(0);

    const result = finalizeDrainWatchdogState({
      ...served,
      servicePeriod: {
        ...served.servicePeriod,
        phase: "draining",
        drainElapsedMs: 180_000,
        cohortCustomerIds: [leader.id],
      },
    });
    const ratingXp = result.state.metrics.visitRatings
      .filter((rating) => party.memberCustomerIds.includes(rating.customerId))
      .reduce((total, rating) => total + visitXp(rating.score, true), 0);
    const discoveryXp = new Set(
      memberLines.map((line) => line.preparationId).filter(Boolean),
    ).size * 2;

    expect(result.servedTimeoutIds).toEqual(party.memberCustomerIds);
    expect(result.unservedDepartureIds).toEqual([]);
    expect(result.state.progression.xp - baselineXp).toBe(
      discoveryXp + ratingXp,
    );
    expect(result.state.customers).toEqual({});
    expect(result.state.strategicGameplay.parties).toEqual({});
    expect(result.state.metrics.completedCustomers).toBe(2);
    expect(result.state.metrics.despawnedCustomers).toBe(2);
    expect(result.state.economy.abandonedVisits).toBe(0);
    expect(result.state.servicePeriod.phase).toBe("debrief");
    expect(() => assertSimulationInvariants(result.state)).not.toThrow();
  });

  it("accounts for every unserved companion and removes the whole party at watchdog", () => {
    const spawned = spawnPair("stage4-party-unserved-watchdog");
    const party = activeParty(spawned);
    const leader = spawned.customers[party.leaderCustomerId]!;
    const result = finalizeDrainWatchdogState({
      ...spawned,
      servicePeriod: {
        ...spawned.servicePeriod,
        phase: "draining",
        drainElapsedMs: 180_000,
        cohortCustomerIds: [leader.id],
      },
    });

    expect(result.servedTimeoutIds).toEqual([]);
    expect(result.unservedDepartureIds).toEqual(party.memberCustomerIds);
    expect(result.state.customers).toEqual({});
    expect(result.state.strategicGameplay.parties).toEqual({});
    expect(Object.values(result.state.queues).flat()).toEqual([]);
    expect(result.state.metrics.spawnedCustomers).toBe(2);
    expect(result.state.metrics.despawnedCustomers).toBe(2);
    expect(result.state.metrics.completedCustomers).toBe(0);
    expect(result.state.economy.completedVisits).toBe(0);
    expect(result.state.economy.abandonedVisits).toBe(2);
    expect(result.state.progression.xp).toBe(0);
    expect(result.state.metrics.visitRatings.map((rating) => rating.customerId)).toEqual(
      party.memberCustomerIds,
    );
    expect(() => assertSimulationInvariants(result.state)).not.toThrow();
  });

  it("freezes and settles a two-stop Combo Board order per party member", () => {
    const initial = comboPartyGame("stage4-party-combo-complete");
    const baselineGross = initial.economy.lifetimeGrossSalesCents;
    const baselineCost = initial.economy.lifetimeIngredientCostsCents;
    const spawned = stepSimulation(initial);
    const planned = activeParty(spawned);
    expect(planned.stallIds).toEqual(["stall-main-1", "stall-side-1"]);
    expect(planned.members.every(
      (member) => member.plannedPreparationIds?.length === 2,
    )).toBe(true);

    const completed = runUntil(
      spawned,
      (state) => activeParty(state).members.every(
        (member) => member.mealSettlementCause === "complete",
      ),
    );
    const party = activeParty(completed);
    const ledger = completed.periodLedgers[completed.servicePeriod.sequenceId]!;
    const sales = ledger.entries.filter((entry) => entry.kind === "gross-sale");
    const costs = ledger.entries.filter(
      (entry) => entry.kind === "ingredient-cost",
    );

    expect(sales).toHaveLength(4);
    expect(costs).toHaveLength(4);
    expect(completed.economy.lifetimeGrossSalesCents - baselineGross).toBe(
      1_000,
    );
    expect(completed.economy.lifetimeIngredientCostsCents - baselineCost).toBe(
      320,
    );
    expect(completed.economy.completedVisits).toBe(2);
    expect(new Set(sales.map((entry) => entry.visitId))).toEqual(
      new Set(party.memberCustomerIds),
    );
    expect(ledgerReconciliationDeltaCents(
      ledger,
      completed.economy.cashCents,
    )).toBe(0);
  });

  it("serves party combo mains first when instance ids sort side-first", () => {
    const initial = comboPartyGame(
      "stage4-party-combo-complete",
      {
        main: "placed-2",
        side: "placed-1",
      },
    );
    const spawned = stepSimulation(initial);
    const planned = activeParty(spawned);

    expect(planned.stallIds).toEqual(["placed-2", "placed-1"]);
    expect(planned.members.every(
      (member) =>
        member.plannedStallIds?.join("|") === "placed-2|placed-1",
    )).toBe(true);

    const completed = runUntil(
      spawned,
      (state) => activeParty(state).members.every(
        (member) => member.mealSettlementCause === "complete",
      ),
    );
    expect(activeParty(completed).members.every(
      (member) => member.settledMealLineIds?.length === 2,
    )).toBe(true);
    expect(() => assertSimulationInvariants(completed)).not.toThrow();
  });

  it("charges only served mains and records one terminal partial when the second stop closes", () => {
    const initial = comboPartyGame("stage4-party-combo-partial");
    const baselineGross = initial.economy.lifetimeGrossSalesCents;
    const firstStop = runUntil(
      stepSimulation(initial),
      (state) => activeParty(state).members.every(
        (member) => member.settledMealLineIds?.length === 1,
      ),
    );
    const interrupted: GameState = {
      ...firstStop,
      objects: {
        ...firstStop.objects,
        "stall-side-1": {
          ...firstStop.objects["stall-side-1"]!,
          open: false,
        },
      },
    };
    const partial = runUntil(
      interrupted,
      (state) =>
        activeParty(state).terminalServiceOutcome === "partial-second-stop",
      20,
    );
    const party = activeParty(partial);
    const ledger = partial.periodLedgers[partial.servicePeriod.sequenceId]!;
    const sales = ledger.entries.filter((entry) => entry.kind === "gross-sale");

    expect(party.members.every(
      (member) =>
        member.mealSettlementCause === "second-stall-unavailable" &&
        member.settledMealLineIds?.length === 1 &&
        member.served,
    )).toBe(true);
    expect(sales).toHaveLength(2);
    expect(sales.every((entry) => entry.referenceId === "noodles")).toBe(true);
    expect(partial.economy.lifetimeGrossSalesCents - baselineGross).toBe(600);
    expect(ledgerReconciliationDeltaCents(
      ledger,
      partial.economy.cashCents,
    )).toBe(0);
    expect(partial.events.filter(
      (entry) =>
        entry.type === "party-partial" &&
        entry.entityId === party.partyId,
    )).toHaveLength(1);
  });

  it("applies every regular's authored budget, group, seat, and satisfaction profile", () => {
    const signatures: string[] = [];
    const periodIndexes = {
      breakfast: 0,
      lunch: 1,
      tea: 2,
      evening: 3,
    } as const;
    for (const regular of REGULARS) {
      const periodId = regular.preferredPeriods[0]!;
      const arrivalSamplingSeed = seedForRegular(regular.id, periodId);
      const base = partyGame(`regular-authoring-${regular.id}`);
      const source: GameState = {
        ...base,
        arrivalSamplingSeed,
        progression: {
          ...base.progression,
          level: 3,
        },
        servicePeriod: {
          ...base.servicePeriod,
          periodId,
          periodIndex: periodIndexes[periodId],
        },
        forecast: {
          ...base.forecast,
          periodId,
          demandRange: [6, 6],
        },
      };
      const spawned = stepSimulation(source);
      const leader = Object.values(spawned.customers)[0]!;
      const expectedGroupSize = sampleForecastShare(
        Object.entries(regular.groupSizeWeightsBasisPoints).map(
          ([size, basisPoints]) => ({
            id: `regular-group-${size}`,
            size: Number(size),
            basisPoints,
          }),
        ),
        `${arrivalSamplingSeed}:${source.forecast.periodSequenceId}:customer-1:regular-group-size`,
      ).size;

      expect(leader.regularId).toBe(regular.id);
      expect(leader.forecastGroupSize).toBe(expectedGroupSize);
      expect(leader.forecastBudgetCents).toBeGreaterThanOrEqual(
        regular.budgetBandCents[0],
      );
      expect(leader.forecastBudgetCents).toBeLessThanOrEqual(
        regular.budgetBandCents[1],
      );
      expect(leader.seatPreference).toBe(regular.seatPreference);
      expect(leader.satisfactionModifiers).toEqual(
        regular.satisfactionModifiers,
      );
      signatures.push(JSON.stringify({
        groupSize: leader.forecastGroupSize,
        seatPreference: leader.seatPreference,
        satisfactionModifiers: leader.satisfactionModifiers,
        budgetBandCents: regular.budgetBandCents,
      }));
    }
    expect(new Set(signatures).size).toBe(6);
  });
});
