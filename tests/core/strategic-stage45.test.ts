import { describe, expect, it } from "vitest";

import { DISHES } from "../../src/content/dishes";
import { STALLS } from "../../src/content/stalls";
import {
  MASTERY_CONTRACT_TEMPLATES,
  MAX_NEIGHBOURHOOD_EVENTS_PER_DAY,
  MAX_NEIGHBOURHOOD_EVENTS_PER_PERIOD,
  NEIGHBOURHOOD_EVENTS,
  PERIOD_DEMAND_PROFILES,
  REGULARS,
  SCENARIOS,
  projectEventModifiers,
  type EventModifier,
} from "../../src/content/strategicGameplay";
import { derivePeriodForecast } from "../../src/game/core/forecast";
import { samplePreferenceTagAdjustments } from "../../src/game/core/simulation";
import {
  findPartySeatAssignment,
  planPartyOrders,
  reservePartySeatsAtomically,
  shouldAllowPartySplit,
  type PartyMemberRequest,
  type SeatCluster,
} from "../../src/game/core/parties";

const MEMBERS = [
  {
    memberId: "member-a",
    budgetCents: 900,
    visitNeedIds: ["need.value"],
    preferredDishIds: [
      "dish.poached-chicken-rice",
      "dish.common-meal",
    ],
  },
  {
    memberId: "member-b",
    budgetCents: 800,
    visitNeedIds: ["intent.fibre-forward", "need.short-wait"],
    preferredDishIds: ["dish.nasi-lemak", "dish.common-meal"],
  },
] as const satisfies readonly PartyMemberRequest[];

describe("atomic party order planning", () => {
  it("uses two stops only when they produce the stronger whole-party plan", () => {
    const options = [
      {
        dishId: "dish.poached-chicken-rice",
        stallId: "stall.sunrise-roost",
        priceCents: 700,
        available: true,
      },
      {
        dishId: "dish.nasi-lemak",
        stallId: "stall.coconut-lime",
        priceCents: 800,
        available: true,
      },
      {
        dishId: "dish.common-meal",
        stallId: "stall.shared",
        priceCents: 600,
        available: true,
      },
    ] as const;

    const plan = planPartyOrders(MEMBERS, options);
    const reordered = planPartyOrders(
      [...MEMBERS].reverse(),
      [...options].reverse(),
    );

    expect(plan).toEqual(reordered);
    expect(plan.accepted).toBe(true);
    if (!plan.accepted) throw new Error("Expected an accepted party plan.");
    expect(plan.strategy).toBe("joint-two-stop");
    expect(plan.stallIds).toEqual([
      "stall.coconut-lime",
      "stall.sunrise-roost",
    ]);
    expect(plan.orders).toHaveLength(MEMBERS.length);
    expect(plan.orders[1]?.visitNeedIds).toEqual([
      "intent.fibre-forward",
      "need.short-wait",
    ]);
  });

  it("preserves combo main-to-complement order when stall ids sort the other way", () => {
    const members = [
      {
        memberId: "member-a",
        budgetCents: 900,
        visitNeedIds: ["need-a"],
        preferredDishIds: ["dish.main"],
      },
      {
        memberId: "member-b",
        budgetCents: 900,
        visitNeedIds: ["need-b"],
        preferredDishIds: ["dish.main"],
      },
    ] as const satisfies readonly PartyMemberRequest[];
    const options = members.map((member) => ({
      memberId: member.memberId,
      dishId: "dish.main",
      stallId: "stall.z-main",
      stallIds: ["stall.z-main", "stall.a-side"] as const,
      priceCents: 800,
      available: true,
      mealOfferId: "offer.main-side",
      preparationIds: ["prep.main", "prep.side"] as const,
      preferencePriority: 1,
    }));

    const plan = planPartyOrders(members, options);
    const reordered = planPartyOrders(
      [...members].reverse(),
      [...options].reverse(),
    );

    expect(plan).toEqual(reordered);
    expect(plan).toMatchObject({
      accepted: true,
      strategy: "joint-two-stop",
      stallIds: ["stall.z-main", "stall.a-side"],
    });
    if (!plan.accepted) throw new Error("Expected an accepted combo plan.");
    expect(plan.orders.every(
      (order) =>
        order.stallIds?.join("|") === "stall.z-main|stall.a-side",
    )).toBe(true);
  });

  it("rejects mutually incompatible ordered combo stops deterministically", () => {
    const members = [
      {
        memberId: "member-a",
        budgetCents: 900,
        visitNeedIds: ["need-a"],
        preferredDishIds: ["dish.main-a"],
      },
      {
        memberId: "member-b",
        budgetCents: 900,
        visitNeedIds: ["need-b"],
        preferredDishIds: ["dish.main-b"],
      },
    ] as const satisfies readonly PartyMemberRequest[];
    const options = [
      {
        memberId: "member-a",
        dishId: "dish.main-a",
        stallId: "stall.alpha",
        stallIds: ["stall.alpha", "stall.beta"],
        priceCents: 800,
        available: true,
        mealOfferId: "offer.alpha-beta",
        preparationIds: ["prep.alpha-main", "prep.beta-side"],
        preferencePriority: 1,
      },
      {
        memberId: "member-b",
        dishId: "dish.main-b",
        stallId: "stall.beta",
        stallIds: ["stall.beta", "stall.alpha"],
        priceCents: 800,
        available: true,
        mealOfferId: "offer.beta-alpha",
        preparationIds: ["prep.beta-main", "prep.alpha-side"],
        preferencePriority: 1,
      },
    ] as const;

    expect(planPartyOrders(members, options)).toEqual(
      planPartyOrders([...members].reverse(), [...options].reverse()),
    );
    expect(planPartyOrders(members, options)).toMatchObject({
      accepted: false,
      reason: "no-atomic-plan",
      stallIds: [],
      orders: [],
    });
  });

  it("does not manufacture an inferior second stop", () => {
    const plan = planPartyOrders(MEMBERS, [
      {
        dishId: "dish.poached-chicken-rice",
        stallId: "stall.shared",
        priceCents: 700,
        available: true,
      },
      {
        dishId: "dish.nasi-lemak",
        stallId: "stall.shared",
        priceCents: 800,
        available: true,
      },
      {
        dishId: "dish.common-meal",
        stallId: "stall.other",
        priceCents: 500,
        available: true,
      },
    ]);

    expect(plan.accepted).toBe(true);
    if (!plan.accepted) throw new Error("Expected an accepted party plan.");
    expect(plan.strategy).toBe("single-stall-fallback");
    expect(plan.stallIds).toEqual(["stall.shared"]);
  });

  it("accepts six members but rejects oversized, partial, and ambiguous plans", () => {
    const sixMembers = Array.from({ length: 6 }, (_, index) => ({
      memberId: `member-${index}`,
      budgetCents: 700,
      visitNeedIds: [`need-${index}`],
      preferredDishIds: ["dish.common-meal"],
    }));
    const commonOption = {
      dishId: "dish.common-meal",
      stallId: "stall.shared",
      priceCents: 600,
      available: true,
    } as const;

    expect(planPartyOrders(sixMembers, [commonOption])).toMatchObject({
      accepted: true,
      orders: expect.arrayContaining([
        expect.objectContaining({ memberId: "member-5" }),
      ]),
    });
    expect(
      planPartyOrders(
        [
          ...sixMembers,
          {
            memberId: "member-6",
            budgetCents: 700,
            visitNeedIds: [],
            preferredDishIds: ["dish.common-meal"],
          },
        ],
        [commonOption],
      ),
    ).toMatchObject({ accepted: false, reason: "invalid-party", orders: [] });
    expect(
      planPartyOrders(MEMBERS, [
        {
          dishId: "dish.poached-chicken-rice",
          stallId: "stall.sunrise-roost",
          priceCents: 850,
          available: true,
        },
      ]),
    ).toMatchObject({
      accepted: false,
      reason: "no-atomic-plan",
      orders: [],
    });
    expect(
      planPartyOrders(MEMBERS, [
        commonOption,
        { ...commonOption, priceCents: 650 },
      ]),
    ).toMatchObject({
      accepted: false,
      reason: "invalid-options",
      orders: [],
    });
  });
});

describe("atomic party seating", () => {
  const clusters = [
    {
      clusterId: "a",
      tableId: "table-a",
      availableSeatIds: ["a2", "a1"],
      centre: { x: 0, y: 0 },
    },
    {
      clusterId: "b",
      tableId: "table-b",
      availableSeatIds: ["b2", "b1"],
      centre: { x: 2, y: 0 },
    },
    {
      clusterId: "c",
      tableId: "table-c",
      availableSeatIds: ["c4", "c2", "c3", "c1"],
      centre: { x: 8, y: 0 },
    },
  ] as const satisfies readonly SeatCluster[];

  it("reserves a suitable cluster together before considering a split", () => {
    const expected = {
      kind: "atomic",
      explanationCode: "party-seated-together",
      clusterIds: ["c"],
      tableIds: ["table-c"],
      seatIds: ["c1", "c2", "c3", "c4"],
    };
    expect(findPartySeatAssignment(4, clusters, 0, 100_000)).toEqual(
      expected,
    );
    expect(
      findPartySeatAssignment(
        4,
        [...clusters].reverse(),
        0,
        100_000,
      ),
    ).toEqual(expected);
  });

  it("permits only the nearest adjacent-table split at forty percent patience", () => {
    const splitOnly = clusters.slice(0, 2);
    expect(shouldAllowPartySplit(39_999, 100_000)).toBe(false);
    expect(
      findPartySeatAssignment(4, splitOnly, 39_999, 100_000),
    ).toBeUndefined();
    expect(findPartySeatAssignment(4, splitOnly, 40_000, 100_000)).toEqual({
      kind: "adjacent-split",
      explanationCode: "party-split-after-patience-threshold",
      clusterIds: ["a", "b"],
      tableIds: ["table-a", "table-b"],
      seatIds: ["a1", "a2", "b1", "b2"],
    });
    expect(shouldAllowPartySplit(Number.NaN, 100_000)).toBe(false);
    expect(shouldAllowPartySplit(40_000, Number.POSITIVE_INFINITY)).toBe(
      false,
    );
  });

  it("honours path-validated adjacency when production supplies it", () => {
    const pathValidated = [
      {
        ...clusters[0],
        adjacentClusterIds: [],
      },
      {
        ...clusters[1],
        adjacentClusterIds: [],
      },
    ] satisfies readonly SeatCluster[];
    expect(
      findPartySeatAssignment(4, pathValidated, 40_000, 100_000),
    ).toBeUndefined();
    expect(
      findPartySeatAssignment(
        4,
        [
          { ...clusters[0], adjacentClusterIds: ["b"] },
          { ...clusters[1], adjacentClusterIds: ["a"] },
        ],
        40_000,
        100_000,
      ),
    ).toMatchObject({
      kind: "adjacent-split",
      clusterIds: ["a", "b"],
    });
  });

  it("chooses the closest valid pair and ignores clusters with no free seats", () => {
    const splitCandidates = [
      {
        clusterId: "full",
        tableId: "table-full",
        availableSeatIds: [],
        centre: { x: 0, y: 0 },
      },
      {
        clusterId: "far",
        tableId: "table-far",
        availableSeatIds: ["f1", "f2"],
        centre: { x: 2, y: 0 },
      },
      {
        clusterId: "near-a",
        tableId: "table-near-a",
        availableSeatIds: ["n1", "n2"],
        centre: { x: 6, y: 0 },
      },
      {
        clusterId: "near-b",
        tableId: "table-near-b",
        availableSeatIds: ["n3", "n4"],
        centre: { x: 7, y: 0 },
      },
    ] as const satisfies readonly SeatCluster[];
    expect(
      findPartySeatAssignment(
        4,
        [...splitCandidates].reverse(),
        40_000,
        100_000,
        4,
      ),
    ).toEqual({
      kind: "adjacent-split",
      explanationCode: "party-split-after-patience-threshold",
      clusterIds: ["near-a", "near-b"],
      tableIds: ["table-near-a", "table-near-b"],
      seatIds: ["n1", "n2", "n3", "n4"],
    });
  });

  it("honours upstream reachability and accessible-seat requirements", () => {
    const candidates = [
      {
        clusterId: "blocked",
        tableId: "table-blocked",
        availableSeatIds: ["b1", "b2"],
        reachable: false,
        accessibleSeatIds: ["b1"],
        centre: { x: 0, y: 0 },
      },
      {
        clusterId: "reachable",
        tableId: "table-reachable",
        availableSeatIds: ["a-standard", "z-accessible"],
        reachable: true,
        accessibleSeatIds: ["z-accessible"],
        centre: { x: 8, y: 0 },
      },
    ] as const satisfies readonly SeatCluster[];
    expect(
      findPartySeatAssignment(
        2,
        candidates,
        0,
        100_000,
        4,
        { x: 0, y: 0 },
        1,
      ),
    ).toEqual({
      kind: "atomic",
      explanationCode: "party-seated-together",
      clusterIds: ["reachable"],
      tableIds: ["table-reachable"],
      seatIds: ["z-accessible", "a-standard"],
    });
  });

  it("uses the party's aggregate non-accessibility preferences as a deterministic tie-break", () => {
    const candidates = [
      {
        clusterId: "near-mismatch",
        tableId: "table-near-mismatch",
        availableSeatIds: ["n1", "n2"],
        preferenceScore: 4,
        centre: { x: 1, y: 0 },
      },
      {
        clusterId: "far-match",
        tableId: "table-far-match",
        availableSeatIds: ["f1", "f2"],
        preferenceScore: 0,
        centre: { x: 5, y: 0 },
      },
    ] as const satisfies readonly SeatCluster[];

    expect(
      findPartySeatAssignment(
        2,
        candidates,
        0,
        100_000,
        4,
        { x: 0, y: 0 },
      ),
    ).toMatchObject({
      kind: "atomic",
      clusterIds: ["far-match"],
      seatIds: ["f1", "f2"],
    });
  });

  it("writes every party seat or leaves the reservation map untouched", () => {
    const assignment = findPartySeatAssignment(
      4,
      clusters.slice(0, 2),
      40_000,
      100_000,
    );
    if (!assignment) throw new Error("Expected an adjacent split.");
    const current = { occupied: "party.existing" };
    const reserved = reservePartySeatsAtomically(
      current,
      "party.arrival-12",
      assignment,
    );
    expect(reserved.accepted).toBe(true);
    expect(reserved.reservations).toMatchObject({
      occupied: "party.existing",
      a1: "party.arrival-12",
      a2: "party.arrival-12",
      b1: "party.arrival-12",
      b2: "party.arrival-12",
    });

    const conflict = reservePartySeatsAtomically(
      { ...current, b2: "party.other" },
      "party.arrival-12",
      assignment,
    );
    expect(conflict).toMatchObject({
      accepted: false,
      reason: "seat-unavailable",
    });
    expect(conflict.reservations).toEqual({
      occupied: "party.existing",
      b2: "party.other",
    });
  });

  it("fails closed when cluster data aliases one physical seat", () => {
    const invalid = [
      clusters[0],
      {
        ...clusters[1],
        availableSeatIds: ["a1", "b2"],
      },
    ] as const;
    expect(
      findPartySeatAssignment(4, invalid, 40_000, 100_000),
    ).toBeUndefined();
  });
});

describe("period demand and neighbourhood events", () => {
  it("uses the four normalized canonical forecast profiles", () => {
    expect(PERIOD_DEMAND_PROFILES.map((profile) => profile.periodId)).toEqual([
      "breakfast",
      "lunch",
      "tea",
      "evening",
    ]);
    for (const profile of PERIOD_DEMAND_PROFILES) {
      expect(
        profile.groupSizeMix.reduce(
          (sum, entry) => sum + entry.basisPoints,
          0,
        ),
      ).toBe(10_000);
      expect(new Set(profile.groupSizeMix.map((entry) => entry.size))).toEqual(
        new Set([1, 2, 3, 4, 5, 6]),
      );
      expect(
        profile.mealMix.reduce(
          (sum, entry) => sum + entry.basisPoints,
          0,
        ),
      ).toBe(10_000);
    }
  });

  it("authors eight seeded operational events without a condition modifier", () => {
    expect(MAX_NEIGHBOURHOOD_EVENTS_PER_PERIOD).toBe(1);
    expect(MAX_NEIGHBOURHOOD_EVENTS_PER_DAY).toBe(2);
    expect(NEIGHBOURHOOD_EVENTS).toHaveLength(8);
    expect(new Set(NEIGHBOURHOOD_EVENTS.map((event) => event.id)).size).toBe(8);
    expect(
      new Set(NEIGHBOURHOOD_EVENTS.map((event) => event.seedSalt)).size,
    ).toBe(8);
    for (const event of NEIGHBOURHOOD_EVENTS) {
      const choiceModifiers: readonly EventModifier[] = event.choices
        ? event.choices.flatMap((choice) => [...choice.modifiers])
        : [];
      const modifiers: readonly EventModifier[] = [
        ...event.forecastModifiers,
        ...choiceModifiers,
      ];
      expect(event.eligiblePeriods.length).toBeGreaterThan(0);
      expect(event.neutralOutcome.length).toBeGreaterThan(20);
      expect(
        modifiers.some((modifier) =>
          Object.keys(modifier).some((key) => key.includes("condition")),
        ),
      ).toBe(false);
    }
  });

  it("projects party-size deltas onto the canonical forecast share IDs", () => {
    const event = NEIGHBOURHOOD_EVENTS.find(
      (candidate) => candidate.id === "event.after-school-meetup",
    );
    if (!event) throw new Error("Missing after-school event.");
    const profile = PERIOD_DEMAND_PROFILES.find(
      (candidate) => candidate.periodId === "tea",
    );
    if (!profile) throw new Error("Missing tea profile.");
    const projection = projectEventModifiers(event);
    expect(projection.forecast.groupSizeBasisPointDeltas).toMatchObject({
      "small-group": 900,
      "group-four": 700,
    });

    const baseline = derivePeriodForecast(profile, 1, 3);
    const modified = derivePeriodForecast(profile, 1, 3, projection.forecast);
    const baselineSizeThree = baseline.groupSizeMix.find(
      (entry) => entry.size === 3,
    )?.basisPoints;
    const modifiedSizeThree = modified.groupSizeMix.find(
      (entry) => entry.size === 3,
    )?.basisPoints;
    expect(modifiedSizeThree).toBeGreaterThan(baselineSizeThree ?? 0);
    expect(modified.nutritionNeeds).toEqual(baseline.nutritionNeeds);
    expect(modified.conditionAwareIncidenceBasisPoints).toBe(
      baseline.conditionAwareIncidenceBasisPoints,
    );
  });

  it("combines an event choice without changing the arrival RNG contract", () => {
    const event = NEIGHBOURHOOD_EVENTS.find(
      (candidate) => candidate.id === "event.office-lunch-wave",
    );
    if (!event) throw new Error("Missing office lunch event.");
    const projection = projectEventModifiers(
      event,
      "event-choice.highlight-quick-meals",
    );
    expect(projection.forecast.demandBasisPoints).toBe(12_200);
    expect(projection.preferenceTagBasisPointDeltas).toEqual({
      "fast-service": 3_400,
    });
    expect(() =>
      projectEventModifiers(event, "event-choice.not-authored"),
    ).toThrow(RangeError);
  });

  it("samples authored preference deltas as nested keyed visit audiences", () => {
    let baseAudience = 0;
    let highlightedAudience = 0;
    let choiceOnlyAudience = 0;

    for (let index = 0; index < 10_000; index += 1) {
      const key = `office-lunch-visit-${index}`;
      const base = samplePreferenceTagAdjustments(
        { "fast-service": 2_400 },
        key,
      ).addedTags.includes("fast-service");
      const highlighted = samplePreferenceTagAdjustments(
        { "fast-service": 3_400 },
        key,
      ).addedTags.includes("fast-service");

      if (base) baseAudience += 1;
      if (highlighted) highlightedAudience += 1;
      if (highlighted && !base) choiceOnlyAudience += 1;
      expect(base && !highlighted).toBe(false);
    }

    expect(baseAudience).toBeGreaterThanOrEqual(2_200);
    expect(baseAudience).toBeLessThanOrEqual(2_600);
    expect(highlightedAudience).toBeGreaterThanOrEqual(3_200);
    expect(highlightedAudience).toBeLessThanOrEqual(3_600);
    expect(choiceOnlyAudience).toBeGreaterThanOrEqual(800);
    expect(choiceOnlyAudience).toBeLessThanOrEqual(1_200);

    expect(
      samplePreferenceTagAdjustments(
        { "fast-service": -10_000 },
        "suppressed-visit",
      ),
    ).toEqual({
      addedTags: [],
      suppressedTags: ["fast-service"],
    });
    expect(() =>
      samplePreferenceTagAdjustments(
        { "fast-service": 10_001 },
        "invalid-visit",
      )
    ).toThrow(RangeError);
  });
});

describe("fictional regular profiles", () => {
  it("defines six operational identities with independent four-step stories", () => {
    expect(REGULARS).toHaveLength(6);
    expect(new Set(REGULARS.map((regular) => regular.id)).size).toBe(6);
    expect(new Set(REGULARS.map((regular) => regular.seedSalt)).size).toBe(6);
    for (const regular of REGULARS) {
      expect(regular.storyBeats).toHaveLength(4);
      expect(
        Object.values(regular.groupSizeWeightsBasisPoints).reduce<number>(
          (sum, weight) => sum + weight,
          0,
        ),
      ).toBe(10_000);
      expect(regular.budgetBandCents[0]).toBeGreaterThan(0);
      expect(regular.budgetBandCents[1]).toBeGreaterThanOrEqual(
        regular.budgetBandCents[0],
      );
      expect(regular.spendMultiplierBasisPoints).toBeGreaterThan(0);
      expect(regular.trayReturnProbabilityBasisPoints).toBeGreaterThanOrEqual(
        0,
      );
      expect(regular.trayReturnProbabilityBasisPoints).toBeLessThanOrEqual(
        10_000,
      );
      expect(JSON.stringify(regular).toLowerCase()).not.toContain("condition");
      expect(JSON.stringify(regular).toLowerCase()).not.toContain("diagnos");
    }
  });
});

describe("preserved Stage 5 authored foundations", () => {
  it("keeps five isolated scenarios on existing food and stall content", () => {
    const dishIds = new Set(DISHES.map((dish) => dish.id));
    const stallIds = new Set(STALLS.map((stall) => stall.id));
    expect(SCENARIOS).toHaveLength(5);
    for (const scenario of SCENARIOS) {
      expect(scenario.isolation).toBe("scenario-save-only");
      expect(scenario.unlockedDishIds.every((id) => dishIds.has(id))).toBe(
        true,
      );
      expect(scenario.unlockedStallIds.every((id) => stallIds.has(id))).toBe(
        true,
      );
    }
  });

  it("keeps twelve meta-only mastery templates for later integration", () => {
    expect(MASTERY_CONTRACT_TEMPLATES).toHaveLength(12);
    for (const template of MASTERY_CONTRACT_TEMPLATES) {
      expect(template.unlockLevel).toBe(13);
      expect(["cosmetic", "title"]).toContain(template.reward.kind);
      expect(template.reward).not.toHaveProperty("cashCents");
      expect(template.reward).not.toHaveProperty("xp");
    }
  });
});
