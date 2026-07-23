import {
  DEFAULT_PERIOD_DEMAND_PROFILES,
  type ForecastModifier,
  type PeriodDemandProfile,
} from "../game/core/forecast";
import type { SeatPreference } from "./types";

export type ServicePeriodId = "breakfast" | "lunch" | "tea" | "evening";
export type PartySize = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Stage 2 already established the menu-neutral period forecast. Stage 4 keeps
 * that collection as the one source of truth instead of maintaining a second,
 * subtly different set of budget and group-size distributions.
 */
export const PERIOD_DEMAND_PROFILES: readonly PeriodDemandProfile[] =
  DEFAULT_PERIOD_DEMAND_PROFILES;

export const MAX_NEIGHBOURHOOD_EVENTS_PER_PERIOD = 1;
export const MAX_NEIGHBOURHOOD_EVENTS_PER_DAY = 2;

export type EventModifier =
  | {
      readonly kind: "arrival-volume";
      /** 10,000 basis points is neutral. */
      readonly basisPoints: number;
    }
  | {
      readonly kind: "budget";
      /** 10,000 basis points is neutral. */
      readonly basisPoints: number;
    }
  | {
      readonly kind: "crowd-profile";
      readonly profileId: string;
      readonly basisPointDelta: number;
    }
  | {
      readonly kind: "preference-tag";
      readonly tag: string;
      readonly basisPointDelta: number;
    }
  | {
      readonly kind: "party-size";
      readonly size: PartySize;
      readonly basisPointDelta: number;
    }
  | {
      readonly kind: "meal-mix";
      readonly mealMixId: string;
      readonly basisPointDelta: number;
    };

export interface NeighbourhoodEventChoice {
  readonly id: `event-choice.${string}`;
  readonly label: string;
  readonly description: string;
  readonly modifiers: readonly EventModifier[];
}

export interface NeighbourhoodEventDefinition {
  readonly id: `event.${string}`;
  readonly name: string;
  readonly description: string;
  /** Stable authored salt; event selection must not consume the arrival RNG. */
  readonly seedSalt: number;
  readonly eligiblePeriods: readonly ServicePeriodId[];
  readonly forecastModifiers: readonly EventModifier[];
  /** Dismissal always applies this documented, non-punitive outcome. */
  readonly neutralOutcome: string;
  /** At most one untimed service prompt can be attached to an event. */
  readonly choicePrompt?: string;
  readonly choices?: readonly NeighbourhoodEventChoice[];
}

export const NEIGHBOURHOOD_EVENTS: readonly NeighbourhoodEventDefinition[] = [
  {
    id: "event.community-garden-morning",
    name: "Community Garden Morning",
    description:
      "Garden volunteers stop by together after their morning session.",
    seedSalt: 0x4a11_0001,
    eligiblePeriods: ["breakfast"],
    forecastModifiers: [
      { kind: "arrival-volume", basisPoints: 11_400 },
      {
        kind: "preference-tag",
        tag: "vegetable-forward",
        basisPointDelta: 1_800,
      },
    ],
    neutralOutcome:
      "The volunteers browse the available menu without extra promotion.",
  },
  {
    id: "event.office-lunch-wave",
    name: "Office Lunch Wave",
    description: "Nearby teams have aligned their lunch breaks today.",
    seedSalt: 0x4a11_0002,
    eligiblePeriods: ["lunch"],
    forecastModifiers: [
      { kind: "arrival-volume", basisPoints: 12_200 },
      {
        kind: "preference-tag",
        tag: "fast-service",
        basisPointDelta: 2_400,
      },
    ],
    neutralOutcome:
      "The lunch wave arrives as forecast and chooses from the full menu.",
    choicePrompt: "How will the team prepare for the short lunch wave?",
    choices: [
      {
        id: "event-choice.steady-queues",
        label: "Keep every queue steady",
        description:
          "Retain the published forecast without favouring a menu category.",
        modifiers: [],
      },
      {
        id: "event-choice.highlight-quick-meals",
        label: "Highlight quick meals",
        description:
          "Increase interest in preparations already tagged for fast service.",
        modifiers: [
          {
            kind: "preference-tag",
            tag: "fast-service",
            basisPointDelta: 1_000,
          },
        ],
      },
    ],
  },
  {
    id: "event.after-school-meetup",
    name: "After-school Meetup",
    description:
      "Small groups meet for affordable afternoon refreshments.",
    seedSalt: 0x4a11_0003,
    eligiblePeriods: ["tea"],
    forecastModifiers: [
      { kind: "budget", basisPoints: 9_000 },
      { kind: "party-size", size: 3, basisPointDelta: 900 },
      { kind: "party-size", size: 4, basisPointDelta: 700 },
      { kind: "meal-mix", mealMixId: "drink-led", basisPointDelta: 1_200 },
    ],
    neutralOutcome:
      "The groups keep their forecast budgets and choose independently.",
  },
  {
    id: "event.evening-music-rehearsal",
    name: "Evening Music Rehearsal",
    description:
      "A neighbourhood music group gathers after rehearsal.",
    seedSalt: 0x4a11_0004,
    eligiblePeriods: ["evening"],
    forecastModifiers: [
      { kind: "arrival-volume", basisPoints: 11_200 },
      { kind: "party-size", size: 4, basisPointDelta: 1_000 },
      { kind: "party-size", size: 5, basisPointDelta: 700 },
      { kind: "party-size", size: 6, basisPointDelta: 300 },
    ],
    neutralOutcome:
      "The group arrives together and follows the published service plan.",
  },
  {
    id: "event.rain-shelter-crowd",
    name: "Passing Shower",
    description:
      "A passing shower brings a short wave of sheltered visitors.",
    seedSalt: 0x4a11_0005,
    eligiblePeriods: ["breakfast", "lunch", "tea", "evening"],
    forecastModifiers: [
      { kind: "arrival-volume", basisPoints: 11_600 },
      { kind: "preference-tag", tag: "warm", basisPointDelta: 1_400 },
    ],
    neutralOutcome:
      "Visitors settle in without an additional service instruction.",
  },
  {
    id: "event.market-day-visitors",
    name: "Market Day Visitors",
    description:
      "Market-goers pause for meals before continuing their errands.",
    seedSalt: 0x4a11_0006,
    eligiblePeriods: ["breakfast", "lunch"],
    forecastModifiers: [
      { kind: "arrival-volume", basisPoints: 11_800 },
      { kind: "budget", basisPoints: 9_600 },
    ],
    neutralOutcome:
      "Market-day traffic follows the published forecast.",
  },
  {
    id: "event.family-table-evening",
    name: "Family Table Evening",
    description:
      "More families and chosen-family groups plan to dine together.",
    seedSalt: 0x4a11_0007,
    eligiblePeriods: ["lunch", "evening"],
    forecastModifiers: [
      { kind: "party-size", size: 4, basisPointDelta: 1_200 },
      { kind: "party-size", size: 5, basisPointDelta: 900 },
      { kind: "party-size", size: 6, basisPointDelta: 700 },
      {
        kind: "meal-mix",
        mealMixId: "main-and-side",
        basisPointDelta: 1_000,
      },
    ],
    neutralOutcome:
      "Each party keeps its own seating and meal preferences.",
  },
  {
    id: "event.neighbourhood-walk-stop",
    name: "Neighbourhood Walk Stop",
    description:
      "A local walking group schedules a rest at the centre.",
    seedSalt: 0x4a11_0008,
    eligiblePeriods: ["tea", "evening"],
    forecastModifiers: [
      { kind: "arrival-volume", basisPoints: 11_000 },
      {
        kind: "crowd-profile",
        profileId: "customer.curious-food-explorer",
        basisPointDelta: 1_200,
      },
    ],
    neutralOutcome:
      "The walking group browses the centre independently.",
  },
];

export interface RegularSatisfactionModifiers {
  readonly value: number;
  readonly speed: number;
  readonly comfort: number;
  readonly variety: number;
  readonly cleanliness: number;
}

export interface RegularDefinition {
  readonly id: `regular.${string}`;
  readonly name: string;
  readonly description: string;
  /** Stable salt for independent regular-arrival sampling. */
  readonly seedSalt: number;
  readonly preferredPeriods: readonly ServicePeriodId[];
  readonly preferenceTags: readonly string[];
  readonly budgetBandCents: readonly [number, number];
  readonly groupSizeWeightsBasisPoints: Readonly<
    Record<PartySize, number>
  >;
  readonly seatPreference: SeatPreference;
  readonly satisfactionModifiers: RegularSatisfactionModifiers;
  readonly spendMultiplierBasisPoints: number;
  readonly trayReturnProbabilityBasisPoints: number;
  readonly storyBeats: readonly [string, string, string, string];
}

export const REGULARS: readonly RegularDefinition[] = [
  {
    id: "regular.mei-lin",
    name: "Mei Lin",
    description:
      "A library assistant who enjoys a quiet break and a familiar hello.",
    seedSalt: 0x5b22_0001,
    preferredPeriods: ["breakfast", "tea"],
    preferenceTags: ["light", "coffee", "quiet"],
    budgetBandCents: [700, 1_500],
    groupSizeWeightsBasisPoints: {
      1: 7_300,
      2: 2_200,
      3: 400,
      4: 100,
      5: 0,
      6: 0,
    },
    seatPreference: "quiet",
    satisfactionModifiers: {
      value: 0.05,
      speed: 0,
      comfort: 0.12,
      variety: 0.02,
      cleanliness: 0.08,
    },
    spendMultiplierBasisPoints: 10_000,
    trayReturnProbabilityBasisPoints: 8_800,
    storyBeats: [
      "Mei Lin introduces herself while looking for a quiet table.",
      "She shares a book recommendation from the library display.",
      "She brings a colleague and asks whether they can sit together.",
      "The pair invite the team to a neighbourhood reading day.",
    ],
  },
  {
    id: "regular.farid",
    name: "Farid",
    description:
      "A bicycle mechanic who stops between repair appointments.",
    seedSalt: 0x5b22_0002,
    preferredPeriods: ["lunch", "tea"],
    preferenceTags: ["filling", "fast-service", "drink"],
    budgetBandCents: [800, 1_800],
    groupSizeWeightsBasisPoints: {
      1: 6_400,
      2: 2_700,
      3: 700,
      4: 200,
      5: 0,
      6: 0,
    },
    seatPreference: "near-stall",
    satisfactionModifiers: {
      value: 0.08,
      speed: 0.14,
      comfort: 0,
      variety: 0.02,
      cleanliness: 0.04,
    },
    spendMultiplierBasisPoints: 10_200,
    trayReturnProbabilityBasisPoints: 8_200,
    storyBeats: [
      "Farid stops in between repair bookings and introduces himself.",
      "He describes a tricky restoration that has kept the workshop busy.",
      "He shares a safer cycling route through the neighbourhood.",
      "He invites the team to mark the workshop's anniversary.",
    ],
  },
  {
    id: "regular.devi",
    name: "Devi",
    description:
      "A community theatre volunteer who often arrives after rehearsals.",
    seedSalt: 0x5b22_0003,
    preferredPeriods: ["tea", "evening"],
    preferenceTags: ["shareable", "aromatic", "group"],
    budgetBandCents: [900, 2_200],
    groupSizeWeightsBasisPoints: {
      1: 2_000,
      2: 3_000,
      3: 2_300,
      4: 1_600,
      5: 800,
      6: 300,
    },
    seatPreference: "group-table",
    satisfactionModifiers: {
      value: 0.02,
      speed: 0,
      comfort: 0.1,
      variety: 0.12,
      cleanliness: 0.04,
    },
    spendMultiplierBasisPoints: 10_500,
    trayReturnProbabilityBasisPoints: 8_600,
    storyBeats: [
      "Devi unwinds after rehearsal and introduces the community production.",
      "She recounts a set change the volunteers solved together.",
      "She arrives with two stage-crew friends for a shared break.",
      "The group celebrates opening night at their familiar table.",
    ],
  },
  {
    id: "regular.mr-wee",
    name: "Mr Wee",
    description:
      "A retired surveyor who sketches changing neighbourhood routes.",
    seedSalt: 0x5b22_0004,
    preferredPeriods: ["breakfast", "lunch"],
    preferenceTags: ["comfort", "mild", "near-stall"],
    budgetBandCents: [700, 1_600],
    groupSizeWeightsBasisPoints: {
      1: 7_000,
      2: 2_400,
      3: 500,
      4: 100,
      5: 0,
      6: 0,
    },
    seatPreference: "near-stall",
    satisfactionModifiers: {
      value: 0.06,
      speed: 0.02,
      comfort: 0.14,
      variety: 0,
      cleanliness: 0.06,
    },
    spendMultiplierBasisPoints: 9_800,
    trayReturnProbabilityBasisPoints: 9_200,
    storyBeats: [
      "Mr Wee sketches the route between the entrance and his table.",
      "He compares his drawing with an older neighbourhood map.",
      "He shares a memory about how the surrounding streets changed.",
      "He adds the renewed hawker centre to his latest map.",
    ],
  },
  {
    id: "regular.nadia",
    name: "Nadia",
    description:
      "A youth sports coach who visits with different teammates.",
    seedSalt: 0x5b22_0005,
    preferredPeriods: ["lunch", "evening"],
    preferenceTags: ["group-table", "value", "variety"],
    budgetBandCents: [800, 2_000],
    groupSizeWeightsBasisPoints: {
      1: 1_400,
      2: 2_400,
      3: 2_300,
      4: 1_900,
      5: 1_300,
      6: 700,
    },
    seatPreference: "group-table",
    satisfactionModifiers: {
      value: 0.12,
      speed: 0.06,
      comfort: 0.08,
      variety: 0.08,
      cleanliness: 0.04,
    },
    spendMultiplierBasisPoints: 9_700,
    trayReturnProbabilityBasisPoints: 9_000,
    storyBeats: [
      "Nadia introduces herself while organising seats for the team.",
      "She describes how the group is preparing for a friendly match.",
      "New players join the table and trade neighbourhood tips.",
      "The team returns to celebrate a well-played match together.",
    ],
  },
  {
    id: "regular.jonathan",
    name: "Jonathan",
    description:
      "A night-shift technician who values a dependable closing-time meal.",
    seedSalt: 0x5b22_0006,
    preferredPeriods: ["evening"],
    preferenceTags: ["warm", "comfort", "fast-service"],
    budgetBandCents: [900, 2_200],
    groupSizeWeightsBasisPoints: {
      1: 6_600,
      2: 2_700,
      3: 600,
      4: 100,
      5: 0,
      6: 0,
    },
    seatPreference: "any",
    satisfactionModifiers: {
      value: 0.04,
      speed: 0.12,
      comfort: 0.06,
      variety: 0.02,
      cleanliness: 0.04,
    },
    spendMultiplierBasisPoints: 10_300,
    trayReturnProbabilityBasisPoints: 8_500,
    storyBeats: [
      "Jonathan introduces himself before starting another night shift.",
      "He shares a light-hearted story about an unusual repair call.",
      "He brings a teammate who has heard about his reliable dinner stop.",
      "They mark the completion of a long-running neighbourhood project.",
    ],
  },
];

function addDelta(
  source: Readonly<Record<string, number>>,
  id: string,
  delta: number,
): Readonly<Record<string, number>> {
  return { ...source, [id]: (source[id] ?? 0) + delta };
}

function multiplyBasisPoints(left: number, right: number): number {
  return Math.floor((left * right + 5_000) / 10_000);
}

const GROUP_SIZE_MIX_IDS: Readonly<Record<PartySize, string>> = {
  1: "solo",
  2: "pair",
  3: "small-group",
  4: "group-four",
  5: "group-five",
  6: "group-six",
};

export interface ProjectedEventModifiers {
  readonly forecast: ForecastModifier;
  readonly preferenceTagBasisPointDeltas: Readonly<Record<string, number>>;
}

/**
 * Projects only operational modifiers. There is deliberately no route for an
 * event, choice, persona, regular, or neighbourhood theme to alter condition
 * prevalence.
 */
export function projectEventModifiers(
  event: NeighbourhoodEventDefinition,
  choiceId?: string,
): ProjectedEventModifiers {
  const choice = choiceId === undefined
    ? undefined
    : event.choices?.find((candidate) => candidate.id === choiceId);
  if (choiceId !== undefined && choice === undefined) {
    throw new RangeError(`Unknown choice ${choiceId} for ${event.id}.`);
  }
  let demandBasisPoints = 10_000;
  let budgetBasisPoints = 10_000;
  let crowdProfileBasisPointDeltas: Readonly<Record<string, number>> = {};
  let groupSizeBasisPointDeltas: Readonly<Record<string, number>> = {};
  let mealMixBasisPointDeltas: Readonly<Record<string, number>> = {};
  let preferenceTagBasisPointDeltas: Readonly<Record<string, number>> = {};
  for (const modifier of [
    ...event.forecastModifiers,
    ...(choice?.modifiers ?? []),
  ]) {
    switch (modifier.kind) {
      case "arrival-volume":
        demandBasisPoints = multiplyBasisPoints(
          demandBasisPoints,
          modifier.basisPoints,
        );
        break;
      case "budget":
        budgetBasisPoints = multiplyBasisPoints(
          budgetBasisPoints,
          modifier.basisPoints,
        );
        break;
      case "crowd-profile":
        crowdProfileBasisPointDeltas = addDelta(
          crowdProfileBasisPointDeltas,
          modifier.profileId,
          modifier.basisPointDelta,
        );
        break;
      case "party-size":
        groupSizeBasisPointDeltas = addDelta(
          groupSizeBasisPointDeltas,
          GROUP_SIZE_MIX_IDS[modifier.size],
          modifier.basisPointDelta,
        );
        break;
      case "meal-mix":
        mealMixBasisPointDeltas = addDelta(
          mealMixBasisPointDeltas,
          modifier.mealMixId,
          modifier.basisPointDelta,
        );
        break;
      case "preference-tag":
        preferenceTagBasisPointDeltas = addDelta(
          preferenceTagBasisPointDeltas,
          modifier.tag,
          modifier.basisPointDelta,
        );
        break;
    }
  }
  return {
    forecast: {
      demandBasisPoints,
      budgetBasisPoints,
      crowdProfileBasisPointDeltas,
      groupSizeBasisPointDeltas,
      mealMixBasisPointDeltas,
    },
    preferenceTagBasisPointDeltas,
  };
}

export type ScenarioId =
  | "scenario.narrow-aisles"
  | "scenario.split-hall"
  | "scenario.limited-cash"
  | "scenario.menu-diversity"
  | "scenario.peak-throughput";

export type ScenarioMedal = "bronze" | "silver" | "gold";

export type ScenarioScoreUnit =
  | "points"
  | "contribution-cents"
  | "distinct-preparations"
  | "completed-visits";

export type ScenarioModifierSet =
  | {
      readonly kind: "narrow-aisles";
      readonly aisleWidthTiles: 2;
      readonly arrivalBasisPoints: 9_000;
    }
  | {
      readonly kind: "split-hall";
      readonly seatingZones: 2;
      readonly crossHallDistanceTiles: 16;
    }
  | {
      readonly kind: "limited-cash";
      readonly purchaseCostBasisPoints: 10_000;
      readonly startingFixtures: 4;
    }
  | {
      readonly kind: "menu-diversity";
      readonly requiredMealRoles: 3;
      readonly minimumDistinctPreparations: 3;
    }
  | {
      readonly kind: "peak-throughput";
      readonly arrivalBasisPoints: 15_500;
      readonly maximumMedianWaitMs: 65_000;
    };

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly name: string;
  readonly description: string;
  readonly unlockLevel: 3;
  readonly isolation: "scenario-save-only";
  readonly mapId: string;
  readonly seed: number;
  readonly startingCashCents: number;
  readonly unlockedStallIds: readonly string[];
  readonly unlockedDishIds: readonly string[];
  readonly modifiers: ScenarioModifierSet;
  readonly scoreUnit: ScenarioScoreUnit;
  readonly medalThresholds: Readonly<Record<ScenarioMedal, number>>;
  readonly cosmeticRewardIds: Readonly<Record<ScenarioMedal, string>>;
}

export const SCENARIOS = [
  {
    id: "scenario.narrow-aisles",
    name: "Narrow Aisles",
    description: "Maintain reliable routes in a compact centre.",
    unlockLevel: 3,
    isolation: "scenario-save-only",
    mapId: "map.scenario-narrow-aisles",
    seed: 4_101,
    startingCashCents: 90_000,
    unlockedStallIds: ["stall.sunrise-roost", "stall.coconut-lime"],
    unlockedDishIds: [
      "dish.poached-chicken-rice",
      "dish.nasi-lemak",
      "dish.mee-rebus",
    ],
    modifiers: {
      kind: "narrow-aisles",
      aisleWidthTiles: 2,
      arrivalBasisPoints: 9_000,
    },
    scoreUnit: "points",
    medalThresholds: { bronze: 55, silver: 72, gold: 86 },
    cosmeticRewardIds: {
      bronze: "cosmetic.route-pin",
      silver: "cosmetic.aisle-sign",
      gold: "cosmetic.gold-wayfinder",
    },
  },
  {
    id: "scenario.split-hall",
    name: "Split Hall",
    description: "Serve both seating zones without leaving one behind.",
    unlockLevel: 3,
    isolation: "scenario-save-only",
    mapId: "map.scenario-split-hall",
    seed: 4_202,
    startingCashCents: 115_000,
    unlockedStallIds: [
      "stall.sunrise-roost",
      "stall.kopi-canopy",
      "stall.cinder-wok",
    ],
    unlockedDishIds: [
      "dish.poached-chicken-rice",
      "dish.kopi",
      "dish.char-kway-teow",
    ],
    modifiers: {
      kind: "split-hall",
      seatingZones: 2,
      crossHallDistanceTiles: 16,
    },
    scoreUnit: "points",
    medalThresholds: { bronze: 50, silver: 70, gold: 85 },
    cosmeticRewardIds: {
      bronze: "cosmetic.zone-marker",
      silver: "cosmetic.split-banner",
      gold: "cosmetic.gold-centrepiece",
    },
  },
  {
    id: "scenario.limited-cash",
    name: "Limited Cash",
    description:
      "Finish with positive contribution from a lean starting setup.",
    unlockLevel: 3,
    isolation: "scenario-save-only",
    mapId: "map.scenario-limited-cash",
    seed: 4_303,
    startingCashCents: 45_000,
    unlockedStallIds: ["stall.sunrise-roost", "stall.kopi-canopy"],
    unlockedDishIds: [
      "dish.poached-chicken-rice",
      "dish.chicken-congee",
      "dish.kopi",
    ],
    modifiers: {
      kind: "limited-cash",
      purchaseCostBasisPoints: 10_000,
      startingFixtures: 4,
    },
    scoreUnit: "contribution-cents",
    medalThresholds: { bronze: 8_000, silver: 14_000, gold: 20_000 },
    cosmeticRewardIds: {
      bronze: "cosmetic.savings-jar",
      silver: "cosmetic.ledger-board",
      gold: "cosmetic.gold-abacus",
    },
  },
  {
    id: "scenario.menu-diversity",
    name: "Menu Diversity",
    description:
      "Serve a deliberate spread of existing meal roles and preparations.",
    unlockLevel: 3,
    isolation: "scenario-save-only",
    mapId: "map.scenario-menu-diversity",
    seed: 4_404,
    startingCashCents: 135_000,
    unlockedStallIds: [
      "stall.coconut-lime",
      "stall.kopi-canopy",
      "stall.tiffin-lantern",
    ],
    unlockedDishIds: [
      "dish.nasi-lemak",
      "dish.soto-ayam",
      "dish.kopi",
      "dish.sugarcane-juice",
      "dish.ice-kacang",
    ],
    modifiers: {
      kind: "menu-diversity",
      requiredMealRoles: 3,
      minimumDistinctPreparations: 3,
    },
    scoreUnit: "distinct-preparations",
    medalThresholds: { bronze: 3, silver: 4, gold: 5 },
    cosmeticRewardIds: {
      bronze: "cosmetic.menu-tabs",
      silver: "cosmetic.colourful-board",
      gold: "cosmetic.gold-menu-frame",
    },
  },
  {
    id: "scenario.peak-throughput",
    name: "Peak Throughput",
    description: "Handle a dense rush while keeping waits controlled.",
    unlockLevel: 3,
    isolation: "scenario-save-only",
    mapId: "map.scenario-peak-throughput",
    seed: 4_505,
    startingCashCents: 155_000,
    unlockedStallIds: [
      "stall.sunrise-roost",
      "stall.cinder-wok",
      "stall.mee-pok-junction",
    ],
    unlockedDishIds: [
      "dish.poached-chicken-rice",
      "dish.char-kway-teow",
      "dish.bak-chor-mee",
    ],
    modifiers: {
      kind: "peak-throughput",
      arrivalBasisPoints: 15_500,
      maximumMedianWaitMs: 65_000,
    },
    scoreUnit: "completed-visits",
    medalThresholds: { bronze: 28, silver: 40, gold: 52 },
    cosmeticRewardIds: {
      bronze: "cosmetic.queue-flag",
      silver: "cosmetic.service-bell",
      gold: "cosmetic.gold-timer",
    },
  },
] as const satisfies readonly ScenarioDefinition[];

export type MasteryMetric =
  | "completed-visits"
  | "gross-sales-cents"
  | "contribution-cents"
  | "minimum-satisfaction"
  | "maximum-median-wait-seconds"
  | "flow-seconds"
  | "distinct-preparations"
  | "party-visits"
  | "tray-return-rate-percent"
  | "forecast-needs-met"
  | "periods-without-refund"
  | "combo-visits";

export interface MasteryContractTemplate {
  readonly id: `contract.${string}`;
  readonly title: string;
  readonly description: string;
  readonly unlockLevel: 13;
  readonly durationPeriods: number;
  readonly target: {
    readonly metric: MasteryMetric;
    readonly value: number;
  };
  readonly feasibility: {
    readonly minimumOpenStalls: number;
    readonly minimumSeats: number;
    readonly requiresComboBoard: boolean;
  };
  readonly reward:
    | { readonly kind: "cosmetic"; readonly cosmeticId: string }
    | { readonly kind: "title"; readonly titleId: string };
}

export const MASTERY_CONTRACT_TEMPLATES = [
  {
    id: "contract.warm-welcome",
    title: "Warm Welcome",
    description: "Complete 36 visits across the contract.",
    unlockLevel: 13,
    durationPeriods: 4,
    target: { metric: "completed-visits", value: 36 },
    feasibility: {
      minimumOpenStalls: 1,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "title", titleId: "title.warm-welcome" },
  },
  {
    id: "contract.steady-takings",
    title: "Steady Takings",
    description: "Record SGD 240 in gross sales.",
    unlockLevel: 13,
    durationPeriods: 4,
    target: { metric: "gross-sales-cents", value: 24_000 },
    feasibility: {
      minimumOpenStalls: 1,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "cosmetic", cosmeticId: "cosmetic.ledger-stamp" },
  },
  {
    id: "contract.sound-footing",
    title: "Sound Footing",
    description: "Record SGD 120 in contribution.",
    unlockLevel: 13,
    durationPeriods: 4,
    target: { metric: "contribution-cents", value: 12_000 },
    feasibility: {
      minimumOpenStalls: 1,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "title", titleId: "title.sound-footing" },
  },
  {
    id: "contract.careful-service",
    title: "Careful Service",
    description: "Maintain at least 78 satisfaction for the contract.",
    unlockLevel: 13,
    durationPeriods: 3,
    target: { metric: "minimum-satisfaction", value: 78 },
    feasibility: {
      minimumOpenStalls: 1,
      minimumSeats: 10,
      requiresComboBoard: false,
    },
    reward: { kind: "cosmetic", cosmeticId: "cosmetic.service-ribbon" },
  },
  {
    id: "contract.short-waits",
    title: "Short Waits",
    description: "Keep median waits at or below 55 seconds.",
    unlockLevel: 13,
    durationPeriods: 3,
    target: { metric: "maximum-median-wait-seconds", value: 55 },
    feasibility: {
      minimumOpenStalls: 2,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "title", titleId: "title.queue-keeper" },
  },
  {
    id: "contract.clear-ways",
    title: "Clear Ways",
    description: "Maintain qualifying flow for 180 seconds.",
    unlockLevel: 13,
    durationPeriods: 3,
    target: { metric: "flow-seconds", value: 180 },
    feasibility: {
      minimumOpenStalls: 1,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "cosmetic", cosmeticId: "cosmetic.wayfinding-tile" },
  },
  {
    id: "contract.menu-craft",
    title: "Menu Craft",
    description: "Serve 8 distinct unlocked preparations.",
    unlockLevel: 13,
    durationPeriods: 4,
    target: { metric: "distinct-preparations", value: 8 },
    feasibility: {
      minimumOpenStalls: 2,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "title", titleId: "title.menu-crafter" },
  },
  {
    id: "contract.tables-together",
    title: "Tables Together",
    description: "Complete 10 party visits.",
    unlockLevel: 13,
    durationPeriods: 4,
    target: { metric: "party-visits", value: 10 },
    feasibility: {
      minimumOpenStalls: 1,
      minimumSeats: 12,
      requiresComboBoard: false,
    },
    reward: { kind: "cosmetic", cosmeticId: "cosmetic.table-marker" },
  },
  {
    id: "contract.tray-team",
    title: "Tray Team",
    description: "Reach an 80 percent tray-return rate.",
    unlockLevel: 13,
    durationPeriods: 3,
    target: { metric: "tray-return-rate-percent", value: 80 },
    feasibility: {
      minimumOpenStalls: 1,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "title", titleId: "title.tray-team" },
  },
  {
    id: "contract.forecast-listener",
    title: "Forecast Listener",
    description: "Meet 12 forecast needs.",
    unlockLevel: 13,
    durationPeriods: 4,
    target: { metric: "forecast-needs-met", value: 12 },
    feasibility: {
      minimumOpenStalls: 2,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "cosmetic", cosmeticId: "cosmetic.forecast-pennant" },
  },
  {
    id: "contract.clean-ledger",
    title: "Clean Ledger",
    description: "Finish 3 periods without a refund.",
    unlockLevel: 13,
    durationPeriods: 3,
    target: { metric: "periods-without-refund", value: 3 },
    feasibility: {
      minimumOpenStalls: 1,
      minimumSeats: 8,
      requiresComboBoard: false,
    },
    reward: { kind: "title", titleId: "title.clean-ledger" },
  },
  {
    id: "contract.combo-coordinator",
    title: "Combo Coordinator",
    description: "Complete 18 combo visits.",
    unlockLevel: 13,
    durationPeriods: 4,
    target: { metric: "combo-visits", value: 18 },
    feasibility: {
      minimumOpenStalls: 2,
      minimumSeats: 8,
      requiresComboBoard: true,
    },
    reward: {
      kind: "cosmetic",
      cosmeticId: "cosmetic.combo-board-trim",
    },
  },
] as const satisfies readonly MasteryContractTemplate[];
