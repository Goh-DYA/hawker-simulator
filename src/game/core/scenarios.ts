import { DISHES } from "../../content/dishes";
import {
  PREPARATION_GAMEPLAY_BY_ID,
  PREPARATION_GAMEPLAY_CATALOGUE,
  REVIEWED_MEAL_ROLES,
} from "../../content/preparationGameplay";
import { NUTRITION_CONTENT } from "../../content/nutrition";
import {
  SCENARIOS,
  type ScenarioDefinition,
  type ScenarioId,
  type ScenarioMedal,
  type ScenarioModifierSet,
  type ScenarioScoreUnit,
} from "../../content/strategicGameplay";
import { STALLS } from "../../content/stalls";
import { createGridMap, getTile, isInBounds } from "./grid";
import type {
  MoneyCents,
  MoneyDeltaCents,
} from "./money";
import type { MealRole } from "./mealComposition";
import { isReachable } from "./pathfinding";
import type {
  AccessPoint,
  GridMap,
  GridPoint,
  TileKind,
} from "./types";

export interface ScenarioMapZone {
  readonly id: string;
  readonly label: string;
  readonly minimum: GridPoint;
  readonly maximum: GridPoint;
}

export interface ScenarioMapDefinition {
  readonly id: string;
  readonly grid: GridMap;
  readonly accessPoints: readonly AccessPoint[];
  readonly seatingZones: readonly ScenarioMapZone[];
  readonly planningNotes: readonly string[];
}

interface TileRectangle {
  readonly minimum: GridPoint;
  readonly maximum: GridPoint;
  readonly tile: TileKind;
}

function rectangle(
  minimumX: number,
  minimumY: number,
  maximumX: number,
  maximumY: number,
  tile: TileKind = "wall",
): TileRectangle {
  return {
    minimum: { x: minimumX, y: minimumY },
    maximum: { x: maximumX, y: maximumY },
    tile,
  };
}

function createScenarioMap(input: {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly accessPoints: readonly AccessPoint[];
  readonly seatingZones: readonly ScenarioMapZone[];
  readonly internalTiles?: readonly TileRectangle[];
  readonly planningNotes: readonly string[];
}): ScenarioMapDefinition {
  const tiles = Array<TileKind>(input.width * input.height).fill("floor");
  const setTile = (point: GridPoint, tile: TileKind): void => {
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= input.width ||
      point.y >= input.height
    ) {
      throw new RangeError(`Scenario map tile ${point.x},${point.y} is outside the map.`);
    }
    tiles[point.y * input.width + point.x] = tile;
  };

  for (let x = 0; x < input.width; x += 1) {
    setTile({ x, y: 0 }, "wall");
    setTile({ x, y: input.height - 1 }, "wall");
  }
  for (let y = 0; y < input.height; y += 1) {
    setTile({ x: 0, y }, "wall");
    setTile({ x: input.width - 1, y }, "wall");
  }
  for (const patch of input.internalTiles ?? []) {
    for (let y = patch.minimum.y; y <= patch.maximum.y; y += 1) {
      for (let x = patch.minimum.x; x <= patch.maximum.x; x += 1) {
        setTile({ x, y }, patch.tile);
      }
    }
  }
  for (const accessPoint of input.accessPoints) {
    setTile(accessPoint.position, "floor");
  }

  const grid = createGridMap(input.width, input.height, {
    tileSize: 48,
    tiles,
  });
  Object.freeze(grid.tiles);
  Object.freeze(grid.worldOrigin);
  Object.freeze(grid);

  return Object.freeze({
    id: input.id,
    grid,
    accessPoints: Object.freeze(input.accessPoints.map((point) =>
      Object.freeze({ ...point, position: Object.freeze({ ...point.position }) })
    )),
    seatingZones: Object.freeze(input.seatingZones.map((zone) =>
      Object.freeze({
        ...zone,
        minimum: Object.freeze({ ...zone.minimum }),
        maximum: Object.freeze({ ...zone.maximum }),
      })
    )),
    planningNotes: Object.freeze([...input.planningNotes]),
  });
}

const SCENARIO_MAPS_BY_ID: Readonly<Record<ScenarioId, ScenarioMapDefinition>> =
  Object.freeze({
    "scenario.narrow-aisles": createScenarioMap({
      id: "map.scenario-narrow-aisles",
      width: 20,
      height: 14,
      accessPoints: [
        { id: "narrow-entrance", kind: "entrance", position: { x: 0, y: 7 } },
        { id: "narrow-exit", kind: "exit", position: { x: 19, y: 7 } },
      ],
      seatingZones: [
        {
          id: "zone.compact-hall",
          label: "Compact hall",
          minimum: { x: 1, y: 1 },
          maximum: { x: 18, y: 12 },
        },
      ],
      internalTiles: [
        rectangle(5, 1, 6, 4),
        rectangle(5, 9, 6, 12),
        rectangle(12, 1, 13, 4),
        rectangle(12, 9, 13, 12),
      ],
      planningNotes: [
        "Maintenance screens leave two-tile side aisles around the breakfast crowd.",
        "Keep the central service route open so neighbours can reach stalls, seats, tray return, and exit.",
      ],
    }),
    "scenario.split-hall": createScenarioMap({
      id: "map.scenario-split-hall",
      width: 26,
      height: 16,
      accessPoints: [
        { id: "split-entrance", kind: "entrance", position: { x: 0, y: 7 } },
        { id: "split-exit", kind: "exit", position: { x: 25, y: 8 } },
      ],
      seatingZones: [
        {
          id: "zone.west-hall",
          label: "West hall",
          minimum: { x: 1, y: 1 },
          maximum: { x: 11, y: 14 },
        },
        {
          id: "zone.east-hall",
          label: "East hall",
          minimum: { x: 14, y: 1 },
          maximum: { x: 24, y: 14 },
        },
      ],
      internalTiles: [
        rectangle(12, 1, 13, 5),
        rectangle(12, 10, 13, 14),
      ],
      planningNotes: [
        "Workshop tables occupy two seating zones joined by one central crossing.",
        "Balance stall access and seating so completed visits reach both sides.",
      ],
    }),
    "scenario.limited-cash": createScenarioMap({
      id: "map.scenario-limited-cash",
      width: 20,
      height: 14,
      accessPoints: [
        { id: "cash-entrance", kind: "entrance", position: { x: 0, y: 6 } },
        { id: "cash-exit", kind: "exit", position: { x: 19, y: 7 } },
      ],
      seatingZones: [
        {
          id: "zone.lean-hall",
          label: "Lean hall",
          minimum: { x: 1, y: 1 },
          maximum: { x: 18, y: 12 },
        },
      ],
      internalTiles: [
        rectangle(8, 1, 11, 2),
        rectangle(8, 11, 11, 12),
      ],
      planningNotes: [
        "The small starting setup still has an open service spine and enough essentials for a competent first plan.",
        "Recovery cash is disabled for medal qualification, so each purchase needs a clear service purpose.",
      ],
    }),
    "scenario.menu-diversity": createScenarioMap({
      id: "map.scenario-menu-diversity",
      width: 24,
      height: 16,
      accessPoints: [
        { id: "diversity-entrance", kind: "entrance", position: { x: 0, y: 7 } },
        { id: "diversity-exit", kind: "exit", position: { x: 23, y: 8 } },
      ],
      seatingZones: [
        {
          id: "zone.menu-hall",
          label: "Menu hall",
          minimum: { x: 1, y: 1 },
          maximum: { x: 22, y: 14 },
        },
      ],
      internalTiles: [
        rectangle(8, 1, 9, 4),
        rectangle(8, 11, 9, 14),
        rectangle(15, 1, 16, 4),
        rectangle(15, 11, 16, 14),
      ],
      planningNotes: [
        "Three stall bays support main, side, and drink roles for the open-house crowd.",
        "Medals count frozen preparations actually served, not dishes listed only for display.",
      ],
    }),
    "scenario.peak-throughput": createScenarioMap({
      id: "map.scenario-peak-throughput",
      width: 28,
      height: 16,
      accessPoints: [
        { id: "peak-entrance-north", kind: "entrance", position: { x: 0, y: 5 } },
        { id: "peak-entrance-south", kind: "entrance", position: { x: 0, y: 10 } },
        { id: "peak-exit-north", kind: "exit", position: { x: 27, y: 5 } },
        { id: "peak-exit-south", kind: "exit", position: { x: 27, y: 10 } },
      ],
      seatingZones: [
        {
          id: "zone.rush-hall",
          label: "Rush hall",
          minimum: { x: 1, y: 1 },
          maximum: { x: 26, y: 14 },
        },
      ],
      internalTiles: [
        rectangle(8, 1, 9, 3),
        rectangle(8, 12, 9, 14),
        rectangle(18, 1, 19, 3),
        rectangle(18, 12, 19, 14),
      ],
      planningNotes: [
        "Two arrival lanes support the shift-change crowd, but queues still need clear pickup and seating paths.",
        "Completed visits count only while median waits remain controlled.",
      ],
    }),
  });

export const SCENARIO_MAPS: readonly ScenarioMapDefinition[] = Object.freeze(
  SCENARIOS.map((definition) => SCENARIO_MAPS_BY_ID[definition.id]),
);

const SCENARIO_BY_ID: Readonly<Record<ScenarioId, ScenarioDefinition>> =
  Object.freeze(SCENARIOS.reduce<Record<ScenarioId, ScenarioDefinition>>(
    (byId, definition) => {
      byId[definition.id] = definition;
      return byId;
    },
    {} as Record<ScenarioId, ScenarioDefinition>,
  ));

export interface ExecutableScenarioDefinition {
  readonly definition: ScenarioDefinition;
  readonly map: ScenarioMapDefinition;
}

export function getExecutableScenario(
  scenarioId: ScenarioId,
): ExecutableScenarioDefinition {
  return {
    definition: SCENARIO_BY_ID[scenarioId],
    map: SCENARIO_MAPS_BY_ID[scenarioId],
  };
}

export interface ScenarioDefinitionIssue {
  readonly scenarioId: ScenarioId;
  readonly code:
    | "definition-kind"
    | "definition-score-unit"
    | "invalid-money"
    | "invalid-thresholds"
    | "invalid-content-reference"
    | "invalid-nutrition-profile"
    | "incompatible-stall"
    | "invalid-map"
    | "impossible-threshold"
    | "insufficient-meal-roles";
  readonly message: string;
}

const EXPECTED_KIND_BY_ID: Readonly<
  Record<ScenarioId, ScenarioModifierSet["kind"]>
> = {
  "scenario.narrow-aisles": "narrow-aisles",
  "scenario.split-hall": "split-hall",
  "scenario.limited-cash": "limited-cash",
  "scenario.menu-diversity": "menu-diversity",
  "scenario.peak-throughput": "peak-throughput",
};

const EXPECTED_SCORE_UNIT_BY_ID: Readonly<Record<ScenarioId, ScenarioScoreUnit>> =
  {
    "scenario.narrow-aisles": "points",
    "scenario.split-hall": "points",
    "scenario.limited-cash": "contribution-cents",
    "scenario.menu-diversity": "distinct-preparations",
    "scenario.peak-throughput": "completed-visits",
  };

function validateMap(
  scenarioId: ScenarioId,
  definition: ScenarioDefinition,
  map: ScenarioMapDefinition,
): readonly ScenarioDefinitionIssue[] {
  const issues: ScenarioDefinitionIssue[] = [];
  const entrances = map.accessPoints.filter((point) => point.kind === "entrance");
  const exits = map.accessPoints.filter((point) => point.kind === "exit");
  if (
    map.id !== definition.mapId ||
    entrances.length === 0 ||
    exits.length === 0 ||
    map.grid.tiles.length !== map.grid.width * map.grid.height
  ) {
    issues.push({
      scenarioId,
      code: "invalid-map",
      message: `${definition.name} does not have a complete matching map.`,
    });
    return issues;
  }
  for (const point of map.accessPoints) {
    if (
      !isInBounds(map.grid, point.position) ||
      getTile(map.grid, point.position) !== "floor"
    ) {
      issues.push({
        scenarioId,
        code: "invalid-map",
        message: `${definition.name} has a blocked or out-of-bounds access point.`,
      });
    }
  }
  for (const entrance of entrances) {
    if (!exits.some((exit) =>
      isReachable(map.grid, entrance.position, exit.position)
    )) {
      issues.push({
        scenarioId,
        code: "invalid-map",
        message: `${definition.name} has no entrance-to-exit route.`,
      });
    }
  }
  for (const zone of map.seatingZones) {
    if (
      !isInBounds(map.grid, zone.minimum) ||
      !isInBounds(map.grid, zone.maximum) ||
      zone.minimum.x > zone.maximum.x ||
      zone.minimum.y > zone.maximum.y
    ) {
      issues.push({
        scenarioId,
        code: "invalid-map",
        message: `${definition.name} has an invalid seating zone.`,
      });
    }
  }
  return issues;
}

export function validateScenarioCatalogue(): readonly ScenarioDefinitionIssue[] {
  const issues: ScenarioDefinitionIssue[] = [];
  const dishById = new Map(DISHES.map((dish) => [dish.id, dish]));
  const stallIds = new Set(STALLS.map((stall) => stall.id));
  const nutritionProfileById = new Map(
    NUTRITION_CONTENT.profiles.map((profile) => [profile.id, profile]),
  );
  const nutritionSnapshotById = new Map(
    NUTRITION_CONTENT.sourceSnapshots.map((snapshot) => [snapshot.id, snapshot]),
  );

  for (const definition of SCENARIOS) {
    const addIssue = (
      code: ScenarioDefinitionIssue["code"],
      message: string,
    ): void => {
      issues.push({ scenarioId: definition.id, code, message });
    };
    if (definition.modifiers.kind !== EXPECTED_KIND_BY_ID[definition.id]) {
      addIssue("definition-kind", `${definition.name} uses the wrong rule set.`);
    }
    if (definition.scoreUnit !== EXPECTED_SCORE_UNIT_BY_ID[definition.id]) {
      addIssue(
        "definition-score-unit",
        `${definition.name} uses the wrong score unit.`,
      );
    }
    if (
      !Number.isSafeInteger(definition.startingCashCents) ||
      definition.startingCashCents < 0
    ) {
      addIssue(
        "invalid-money",
        `${definition.name} starting SGD must be non-negative integer cents.`,
      );
    }
    const thresholds = [
      definition.medalThresholds.bronze,
      definition.medalThresholds.silver,
      definition.medalThresholds.gold,
    ];
    if (
      thresholds.some((threshold) =>
        !Number.isSafeInteger(threshold) || threshold <= 0
      ) ||
      thresholds[0]! >= thresholds[1]! ||
      thresholds[1]! >= thresholds[2]!
    ) {
      addIssue(
        "invalid-thresholds",
        `${definition.name} medal thresholds must be increasing positive integers.`,
      );
    }

    const unlockedStalls = new Set<string>(definition.unlockedStallIds);
    const unlockedDishes = new Set<string>(definition.unlockedDishIds);
    for (const stallId of unlockedStalls) {
      if (!stallIds.has(stallId)) {
        addIssue(
          "invalid-content-reference",
          `${definition.name} references unknown stall ${stallId}.`,
        );
      }
    }
    for (const dishId of definition.unlockedDishIds) {
      const dish = dishById.get(dishId);
      if (!dish) {
        addIssue(
          "invalid-content-reference",
          `${definition.name} references unknown dish ${dishId}.`,
        );
      } else if (!dish.stallIds.some((stallId) => unlockedStalls.has(stallId))) {
        addIssue(
          "incompatible-stall",
          `${definition.name} unlocks ${dishId} without one of its stalls.`,
        );
      }

      const preparations = PREPARATION_GAMEPLAY_CATALOGUE.filter(
        (preparation) => preparation.dishId === dishId,
      );
      if (preparations.length === 0) {
        addIssue(
          "invalid-nutrition-profile",
          `${definition.name} has no reviewed preparation for ${dishId}.`,
        );
      }
      for (const preparation of preparations) {
        const profile = nutritionProfileById.get(preparation.profileId);
        const audit = preparation.nutritionAudit;
        if (
          !profile ||
          profile.dishId !== dishId ||
          audit.profileId !== profile.id ||
          audit.status !== profile.status
        ) {
          addIssue(
            "invalid-nutrition-profile",
            `${definition.name} preparation ${preparation.id} does not match its generated nutrition profile.`,
          );
          continue;
        }

        if (profile.status === "released") {
          const provenance = profile.provenance;
          const snapshot = provenance
            ? nutritionSnapshotById.get(provenance.snapshotId)
            : undefined;
          if (
            !profile.serving ||
            !profile.reviewNote.trim() ||
            !provenance ||
            !provenance.reviewNote.trim() ||
            !snapshot ||
            snapshot.fileName !== provenance.sourceFile ||
            snapshot.sha256 !== provenance.sourceFileSha256 ||
            audit.sourceFile !== provenance.sourceFile ||
            audit.sourceFileSha256 !== provenance.sourceFileSha256 ||
            audit.sourceRowNumber !== provenance.sourceRowNumber ||
            audit.sourceFoodName !== provenance.sourceFoodName ||
            audit.sourceRowSha256 !== provenance.sourceRowSha256 ||
            audit.mappingKind !== provenance.mappingKind ||
            audit.servingLabel !== profile.serving.label
          ) {
            addIssue(
              "invalid-nutrition-profile",
              `${definition.name} preparation ${preparation.id} is missing consistent reviewed nutrition provenance.`,
            );
          }
          continue;
        }

        const explicitlyUnavailable =
          profile.status === "unavailable" &&
          profile.unavailableReason !== undefined &&
          Object.values(profile.nutrients).every(
            (nutrient) => nutrient.status === "unavailable",
          );
        if (!explicitlyUnavailable) {
          addIssue(
            "invalid-nutrition-profile",
            `${definition.name} preparation ${preparation.id} is neither released nor explicitly unavailable.`,
          );
        }
      }
    }
    for (const stallId of unlockedStalls) {
      const hasScenarioDish = definition.unlockedDishIds.some((dishId) =>
        dishById.get(dishId)?.stallIds.includes(stallId)
      );
      if (!hasScenarioDish) {
        addIssue(
          "incompatible-stall",
          `${definition.name} unlocks ${stallId} without a scenario dish.`,
        );
      }
    }

    if (definition.modifiers.kind === "menu-diversity") {
      const availableRoles = new Set(
        definition.unlockedDishIds
          .map((dishId) => REVIEWED_MEAL_ROLES[dishId])
          .filter((role): role is MealRole => role !== undefined),
      );
      if (availableRoles.size < definition.modifiers.requiredMealRoles) {
        addIssue(
          "insufficient-meal-roles",
          `${definition.name} cannot represent its required meal-role spread.`,
        );
      }
      const availablePreparationCount = PREPARATION_GAMEPLAY_CATALOGUE.filter(
        (preparation) => unlockedDishes.has(preparation.dishId),
      ).length;
      if (
        availablePreparationCount < definition.medalThresholds.gold ||
        definition.unlockedDishIds.length < definition.medalThresholds.gold
      ) {
        addIssue(
          "impossible-threshold",
          `${definition.name} has fewer unlocked options than its gold target.`,
        );
      }
    }
    issues.push(...validateMap(
      definition.id,
      definition,
      SCENARIO_MAPS_BY_ID[definition.id],
    ));
  }
  return issues;
}

export interface ScenarioServedPreparation {
  readonly preparationId: string;
  readonly dishId: string;
  readonly mealRole: MealRole;
}

/**
 * A scenario becomes medal-eligible only after its authored service period has
 * drained and the terminal debrief has been produced. Autosaves made during
 * planning, arrivals, or drain must report "in-progress".
 */
export const SCENARIO_TERMINAL_BOUNDARY = "terminal-period-debrief" as const;
export type ScenarioRunBoundary =
  | "in-progress"
  | typeof SCENARIO_TERMINAL_BOUNDARY;

export interface ScenarioRunReport {
  readonly scenarioId: ScenarioId;
  /** Must match the authored scenario seed; evaluation consumes no RNG. */
  readonly seed: number;
  readonly completionBoundary: ScenarioRunBoundary;
  readonly strategyId: string;
  readonly totalArrivals: number;
  readonly completedVisits: number;
  readonly completedVisitsByZone: Readonly<Record<string, number>>;
  readonly flowBasisPoints: number;
  readonly reachableVisitBasisPoints: number;
  readonly medianWaitMs: number;
  readonly grossSalesCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
  readonly paidUpkeepCents: MoneyCents;
  readonly refundsCents: MoneyCents;
  readonly contributionCents: MoneyDeltaCents;
  readonly minimumCashCents: MoneyDeltaCents;
  readonly recoveryCashCents: MoneyCents;
  readonly ledgerReconciliationDeltaCents: MoneyDeltaCents;
  /** One frozen entry per distinct preparation served in the run. */
  readonly distinctServedPreparations: readonly ScenarioServedPreparation[];
}

export type ScenarioEvaluationFailureCode =
  | "scenario-incomplete"
  | "ledger-not-reconciled"
  | "contribution-mismatch"
  | "cash-went-negative"
  | "recovery-used"
  | "score-below-bronze"
  | "route-reliability-too-low"
  | "flow-too-low"
  | "zone-coverage-missing"
  | "zone-balance-too-low"
  | "meal-role-spread-too-small"
  | "wait-too-long"
  | "completion-rate-too-low";

export interface ScenarioScoreBreakdownEntry {
  readonly id: string;
  readonly value: number;
  readonly maximum?: number;
}

export interface ScenarioNextMedalFeedback {
  readonly medal: ScenarioMedal;
  readonly threshold: number;
  readonly scoreShortfall: number;
  /**
   * Populated only after the score threshold is met. These are the exact
   * non-score constraints that still prevent the next medal.
   */
  readonly constraintFailureCodes: readonly ScenarioEvaluationFailureCode[];
}

/**
 * The reward contract intentionally has no cash, XP, reputation, objective, or
 * unlock field. Scenario completion can update meta progression only.
 */
export interface ScenarioMetaReward {
  readonly scope: "meta-progression-only";
  readonly kind: "scenario-cosmetics";
  readonly scenarioId: ScenarioId;
  readonly medal: ScenarioMedal;
  readonly cosmeticIds: readonly string[];
}

export interface ScenarioEvaluation {
  readonly scenarioId: ScenarioId;
  readonly score: number;
  readonly scoreUnit: ScenarioScoreUnit;
  readonly medal?: ScenarioMedal;
  readonly breakdown: readonly ScenarioScoreBreakdownEntry[];
  readonly failureCodes: readonly ScenarioEvaluationFailureCode[];
  readonly nextMedal?: ScenarioNextMedalFeedback;
  readonly metaReward?: ScenarioMetaReward;
}

const MEDALS_ASCENDING = ["bronze", "silver", "gold"] as const;
const MEDALS_DESCENDING = ["gold", "silver", "bronze"] as const;

const ROUTE_MEDAL_REQUIREMENTS = {
  bronze: { completionBasisPoints: 7_000, routeBasisPoints: 7_500, flowBasisPoints: 0 },
  silver: { completionBasisPoints: 8_000, routeBasisPoints: 8_500, flowBasisPoints: 5_000 },
  gold: { completionBasisPoints: 9_000, routeBasisPoints: 9_000, flowBasisPoints: 6_500 },
} as const;

const SPLIT_HALL_MEDAL_REQUIREMENTS = {
  bronze: { completionBasisPoints: 6_000, zoneBalanceBasisPoints: 5_000 },
  silver: { completionBasisPoints: 7_500, zoneBalanceBasisPoints: 7_000 },
  gold: { completionBasisPoints: 9_000, zoneBalanceBasisPoints: 8_500 },
} as const;

const DIVERSITY_MEDAL_ROLE_REQUIREMENTS = {
  bronze: 2,
  silver: 3,
  gold: 3,
} as const;

const THROUGHPUT_MEDAL_REQUIREMENTS = {
  bronze: { completionBasisPoints: 5_500, maximumWaitMs: 65_000 },
  silver: { completionBasisPoints: 6_500, maximumWaitMs: 60_000 },
  gold: { completionBasisPoints: 7_500, maximumWaitMs: 55_000 },
} as const;

function basisPointsPercentage(value: number): string {
  return `${value / 100}%`;
}

/**
 * Player-facing eligibility rules are sourced from the same exact constants
 * used by evaluation so a score threshold is never presented as sufficient on
 * its own.
 */
export function scenarioMedalEligibilityLabels(
  scenarioId: ScenarioId,
  medal: ScenarioMedal,
): readonly string[] {
  switch (scenarioId) {
    case "scenario.narrow-aisles": {
      const requirement = ROUTE_MEDAL_REQUIREMENTS[medal];
      return [
        `Complete at least ${basisPointsPercentage(
          requirement.completionBasisPoints,
        )} of arrivals`,
        `Keep at least ${basisPointsPercentage(
          requirement.routeBasisPoints,
        )} of visit routes reachable`,
        ...(requirement.flowBasisPoints > 0
          ? [`Maintain qualifying flow for at least ${basisPointsPercentage(
              requirement.flowBasisPoints,
            )} of the flow window`]
          : []),
      ];
    }
    case "scenario.split-hall": {
      const requirement = SPLIT_HALL_MEDAL_REQUIREMENTS[medal];
      return [
        `Complete at least ${basisPointsPercentage(
          requirement.completionBasisPoints,
        )} of arrivals`,
        `Serve both halls with at least a ${basisPointsPercentage(
          requirement.zoneBalanceBasisPoints,
        )} smaller-to-larger zone ratio`,
      ];
    }
    case "scenario.limited-cash":
      return ["Use no recovery grant"];
    case "scenario.menu-diversity":
      return [
        DIVERSITY_MEDAL_ROLE_REQUIREMENTS[medal] === 3
          ? "Serve preparations from all 3 meal roles"
          : `Serve preparations from at least ${
              DIVERSITY_MEDAL_ROLE_REQUIREMENTS[medal]
            } meal roles`,
      ];
    case "scenario.peak-throughput": {
      const requirement = THROUGHPUT_MEDAL_REQUIREMENTS[medal];
      return [
        `Complete at least ${basisPointsPercentage(
          requirement.completionBasisPoints,
        )} of arrivals`,
        `Keep the median wait at or below ${
          requirement.maximumWaitMs / 1_000
        } seconds`,
      ];
    }
  }
}

function assertSafeInteger(
  value: number,
  label: string,
  minimum = 0,
): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be a safe integer of at least ${minimum}.`);
  }
}

function assertBasisPoints(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value > 10_000) {
    throw new RangeError(`${label} must not exceed 10,000 basis points.`);
  }
}

function completionBasisPoints(completed: number, arrivals: number): number {
  return Math.floor((completed * 10_000) / arrivals);
}

function weightedPoints(basisPoints: number, maximum: number): number {
  return Math.floor((basisPoints * maximum + 5_000) / 10_000);
}

function waitQualityBasisPoints(
  medianWaitMs: number,
  fullScoreAtMs: number,
  zeroScoreAtMs: number,
): number {
  if (medianWaitMs <= fullScoreAtMs) return 10_000;
  if (medianWaitMs >= zeroScoreAtMs) return 0;
  return Math.floor(
    ((zeroScoreAtMs - medianWaitMs) * 10_000) /
      (zeroScoreAtMs - fullScoreAtMs),
  );
}

function assertRunReport(
  report: ScenarioRunReport,
  executable: ExecutableScenarioDefinition,
): void {
  if (report.seed !== executable.definition.seed) {
    throw new RangeError(
      `${executable.definition.name} must use its authored scenario seed.`,
    );
  }
  if (report.strategyId.trim().length === 0) {
    throw new RangeError("Scenario strategy ID must not be empty.");
  }
  if (
    report.completionBoundary !== "in-progress" &&
    report.completionBoundary !== SCENARIO_TERMINAL_BOUNDARY
  ) {
    throw new RangeError("Scenario completion boundary is invalid.");
  }
  assertSafeInteger(report.totalArrivals, "Total arrivals", 1);
  assertSafeInteger(report.completedVisits, "Completed visits");
  if (report.completedVisits > report.totalArrivals) {
    throw new RangeError("Completed visits cannot exceed total arrivals.");
  }
  assertBasisPoints(report.flowBasisPoints, "Flow");
  assertBasisPoints(report.reachableVisitBasisPoints, "Reachable visits");
  assertSafeInteger(report.medianWaitMs, "Median wait");
  assertSafeInteger(report.grossSalesCents, "Gross sales");
  assertSafeInteger(report.ingredientCostCents, "Ingredient costs");
  assertSafeInteger(report.paidUpkeepCents, "Paid upkeep");
  assertSafeInteger(report.refundsCents, "Refunds");
  assertSafeInteger(report.recoveryCashCents, "Recovery cash");
  if (
    !Number.isSafeInteger(report.contributionCents) ||
    !Number.isSafeInteger(report.minimumCashCents) ||
    !Number.isSafeInteger(report.ledgerReconciliationDeltaCents)
  ) {
    throw new RangeError("Scenario money deltas must be safe integer cents.");
  }

  const zoneIds = new Set(executable.map.seatingZones.map((zone) => zone.id));
  let zoneCompletedTotal = 0;
  for (const [zoneId, count] of Object.entries(report.completedVisitsByZone)) {
    if (!zoneIds.has(zoneId)) {
      throw new RangeError(`Unknown scenario seating zone: ${zoneId}.`);
    }
    assertSafeInteger(count, `Completed visits for ${zoneId}`);
    zoneCompletedTotal += count;
  }
  if (zoneCompletedTotal > report.completedVisits) {
    throw new RangeError("Zone completions cannot exceed total completed visits.");
  }
  if (
    executable.definition.modifiers.kind === "split-hall" &&
    zoneCompletedTotal !== report.completedVisits
  ) {
    throw new RangeError(
      "Every Split Hall completion must be attributed to a seating zone.",
    );
  }

  const preparationIds = new Set<string>();
  for (const served of report.distinctServedPreparations) {
    if (preparationIds.has(served.preparationId)) {
      throw new RangeError(
        `Distinct preparation ${served.preparationId} was reported twice.`,
      );
    }
    preparationIds.add(served.preparationId);
    const authored = PREPARATION_GAMEPLAY_BY_ID[served.preparationId];
    if (
      !authored ||
      authored.dishId !== served.dishId ||
      authored.mealRole !== served.mealRole
    ) {
      throw new RangeError(
        `Unknown or inconsistent frozen preparation ${served.preparationId}.`,
      );
    }
    if (!executable.definition.unlockedDishIds.includes(served.dishId)) {
      throw new RangeError(
        `${served.dishId} is not unlocked in ${executable.definition.name}.`,
      );
    }
  }
}

function globalFailureCodes(
  report: ScenarioRunReport,
): readonly ScenarioEvaluationFailureCode[] {
  const failures: ScenarioEvaluationFailureCode[] = [];
  if (report.completionBoundary !== SCENARIO_TERMINAL_BOUNDARY) {
    failures.push("scenario-incomplete");
  }
  // Runtime wait and flow samples are finalized from completed visit ratings.
  // A run with no completions therefore has no observed service samples; it
  // must not benefit from the optimistic empty-sample defaults (zero wait and
  // full flow) used while an in-progress report is assembled.
  if (report.completedVisits === 0) {
    failures.push("completion-rate-too-low");
  }
  const expectedContribution =
    report.grossSalesCents -
    report.ingredientCostCents -
    report.paidUpkeepCents -
    report.refundsCents;
  if (report.ledgerReconciliationDeltaCents !== 0) {
    failures.push("ledger-not-reconciled");
  }
  if (report.contributionCents !== expectedContribution) {
    failures.push("contribution-mismatch");
  }
  if (report.minimumCashCents < 0) failures.push("cash-went-negative");
  return failures;
}

function hasGlobalFailure(
  failures: readonly ScenarioEvaluationFailureCode[],
): boolean {
  return failures.some((failure) =>
    failure === "scenario-incomplete" ||
    failure === "ledger-not-reconciled" ||
    failure === "contribution-mismatch" ||
    failure === "cash-went-negative" ||
    failure === "completion-rate-too-low"
  );
}

function thresholdMet(
  definition: ScenarioDefinition,
  medal: ScenarioMedal,
  score: number,
): boolean {
  return score >= definition.medalThresholds[medal];
}

function routeMedalFailures(
  report: ScenarioRunReport,
  medal: ScenarioMedal,
): readonly ScenarioEvaluationFailureCode[] {
  const requirement = ROUTE_MEDAL_REQUIREMENTS[medal];
  // Bronze validates a workable route. Sustained qualifying flow becomes the
  // deliberate Silver/Gold optimization, measured against the one-minute
  // core flow challenge rather than against the full arrivals window.
  const failures: ScenarioEvaluationFailureCode[] = [];
  if (
    completionBasisPoints(report.completedVisits, report.totalArrivals) <
    requirement.completionBasisPoints
  ) {
    failures.push("completion-rate-too-low");
  }
  if (report.reachableVisitBasisPoints < requirement.routeBasisPoints) {
    failures.push("route-reliability-too-low");
  }
  if (report.flowBasisPoints < requirement.flowBasisPoints) {
    failures.push("flow-too-low");
  }
  return failures;
}

function splitHallMedalFailures(
  report: ScenarioRunReport,
  zoneIds: readonly string[],
  medal: ScenarioMedal,
): readonly ScenarioEvaluationFailureCode[] {
  const counts = zoneIds.map((id) => report.completedVisitsByZone[id] ?? 0);
  if (counts.some((count) => count === 0)) return ["zone-coverage-missing"];
  const minimum = Math.min(...counts);
  const maximum = Math.max(...counts);
  const balanceBasisPoints = maximum === 0
    ? 0
    : Math.floor((minimum * 10_000) / maximum);
  const requirement = SPLIT_HALL_MEDAL_REQUIREMENTS[medal];
  const failures: ScenarioEvaluationFailureCode[] = [];
  if (balanceBasisPoints < requirement.zoneBalanceBasisPoints) {
    failures.push("zone-balance-too-low");
  }
  if (
    completionBasisPoints(report.completedVisits, report.totalArrivals) <
    requirement.completionBasisPoints
  ) {
    failures.push("completion-rate-too-low");
  }
  return failures;
}

function diversityMedalFailures(
  distinctRoles: number,
  medal: ScenarioMedal,
): readonly ScenarioEvaluationFailureCode[] {
  const requiredRoles = DIVERSITY_MEDAL_ROLE_REQUIREMENTS[medal];
  return distinctRoles < requiredRoles ? ["meal-role-spread-too-small"] : [];
}

function throughputMedalFailures(
  report: ScenarioRunReport,
  medal: ScenarioMedal,
): readonly ScenarioEvaluationFailureCode[] {
  const requirement = THROUGHPUT_MEDAL_REQUIREMENTS[medal];
  const failures: ScenarioEvaluationFailureCode[] = [];
  if (report.medianWaitMs > requirement.maximumWaitMs) {
    failures.push("wait-too-long");
  }
  if (
    completionBasisPoints(report.completedVisits, report.totalArrivals) <
    requirement.completionBasisPoints
  ) {
    failures.push("completion-rate-too-low");
  }
  return failures;
}

function scoreRouteScenario(
  report: ScenarioRunReport,
): {
  readonly score: number;
  readonly breakdown: readonly ScenarioScoreBreakdownEntry[];
} {
  const completion = completionBasisPoints(
    report.completedVisits,
    report.totalArrivals,
  );
  const wait = waitQualityBasisPoints(report.medianWaitMs, 30_000, 90_000);
  const breakdown = [
    {
      id: "completion",
      value: weightedPoints(completion, 35),
      maximum: 35,
    },
    {
      id: "route-reliability",
      value: weightedPoints(report.reachableVisitBasisPoints, 25),
      maximum: 25,
    },
    {
      id: "flow",
      value: weightedPoints(report.flowBasisPoints, 25),
      maximum: 25,
    },
    {
      id: "controlled-waits",
      value: weightedPoints(wait, 15),
      maximum: 15,
    },
  ] as const;
  return {
    score: breakdown.reduce((total, entry) => total + entry.value, 0),
    breakdown,
  };
}

function scoreSplitHall(
  report: ScenarioRunReport,
  zoneIds: readonly string[],
): {
  readonly score: number;
  readonly breakdown: readonly ScenarioScoreBreakdownEntry[];
} {
  const counts = zoneIds.map((id) => report.completedVisitsByZone[id] ?? 0);
  const minimum = Math.min(...counts);
  const maximum = Math.max(...counts);
  const balance = maximum === 0
    ? 0
    : Math.floor((minimum * 10_000) / maximum);
  const coverage = counts.every((count) => count > 0) ? 15 : 0;
  const wait = waitQualityBasisPoints(report.medianWaitMs, 35_000, 95_000);
  const breakdown = [
    {
      id: "completion",
      value: weightedPoints(
        completionBasisPoints(report.completedVisits, report.totalArrivals),
        35,
      ),
      maximum: 35,
    },
    {
      id: "zone-balance",
      value: weightedPoints(balance, 35),
      maximum: 35,
    },
    { id: "both-zones-served", value: coverage, maximum: 15 },
    {
      id: "controlled-waits",
      value: weightedPoints(wait, 15),
      maximum: 15,
    },
  ] as const;
  return {
    score: breakdown.reduce((total, entry) => total + entry.value, 0),
    breakdown,
  };
}

function metaReward(
  definition: ScenarioDefinition,
  medal: ScenarioMedal,
): ScenarioMetaReward {
  const medalIndex = MEDALS_ASCENDING.indexOf(medal);
  return {
    scope: "meta-progression-only",
    kind: "scenario-cosmetics",
    scenarioId: definition.id,
    medal,
    cosmeticIds: MEDALS_ASCENDING
      .slice(0, medalIndex + 1)
      .map((earnedMedal) => definition.cosmeticRewardIds[earnedMedal]),
  };
}

export function evaluateScenarioRun(
  report: ScenarioRunReport,
): ScenarioEvaluation {
  const executable = getExecutableScenario(report.scenarioId);
  assertRunReport(report, executable);
  const { definition, map } = executable;
  const failures = [...globalFailureCodes(report)];
  let score = 0;
  let breakdown: readonly ScenarioScoreBreakdownEntry[] = [];
  let medalFailures: (
    medal: ScenarioMedal
  ) => readonly ScenarioEvaluationFailureCode[] = () => [];

  switch (definition.modifiers.kind) {
    case "narrow-aisles": {
      const scored = scoreRouteScenario(report);
      score = scored.score;
      breakdown = scored.breakdown;
      medalFailures = (medal) => routeMedalFailures(report, medal);
      break;
    }
    case "split-hall": {
      const zoneIds = map.seatingZones.map((zone) => zone.id);
      const scored = scoreSplitHall(report, zoneIds);
      score = scored.score;
      breakdown = scored.breakdown;
      medalFailures = (medal) =>
        splitHallMedalFailures(report, zoneIds, medal);
      break;
    }
    case "limited-cash":
      score = Math.max(0, report.contributionCents);
      breakdown = [
        {
          id: "contribution-cents",
          value: report.contributionCents,
        },
      ];
      if (report.recoveryCashCents > 0) failures.push("recovery-used");
      medalFailures = () =>
        report.recoveryCashCents > 0 ? ["recovery-used"] : [];
      break;
    case "menu-diversity": {
      const roles = new Set(
        report.distinctServedPreparations.map((served) => served.mealRole),
      );
      score = report.distinctServedPreparations.length;
      breakdown = [
        { id: "distinct-preparations", value: score },
        { id: "distinct-meal-roles", value: roles.size, maximum: 3 },
      ];
      medalFailures = (medal) => diversityMedalFailures(roles.size, medal);
      break;
    }
    case "peak-throughput":
      score = report.completedVisits;
      breakdown = [
        { id: "completed-visits", value: score },
        {
          id: "completion-basis-points",
          value: completionBasisPoints(
            report.completedVisits,
            report.totalArrivals,
          ),
          maximum: 10_000,
        },
        { id: "median-wait-ms", value: report.medianWaitMs },
      ];
      medalFailures = (medal) => throughputMedalFailures(report, medal);
      break;
  }

  let medal: ScenarioMedal | undefined;
  if (!hasGlobalFailure(failures)) {
    medal = MEDALS_DESCENDING.find((candidate) =>
      thresholdMet(definition, candidate, score) &&
      medalFailures(candidate).length === 0
    );
  }

  if (!medal) {
    if (score < definition.medalThresholds.bronze) {
      failures.push("score-below-bronze");
    } else {
      failures.push(...medalFailures("bronze"));
    }
  }

  const failureCodes = [...new Set(failures)];
  const nextMedalCandidate = medal
    ? MEDALS_ASCENDING[MEDALS_ASCENDING.indexOf(medal) + 1]
    : "bronze";
  const nextMedal =
    report.completionBoundary === SCENARIO_TERMINAL_BOUNDARY &&
      nextMedalCandidate
      ? {
          medal: nextMedalCandidate,
          threshold: definition.medalThresholds[nextMedalCandidate],
          scoreShortfall: Math.max(
            0,
            definition.medalThresholds[nextMedalCandidate] - score,
          ),
          constraintFailureCodes:
            score >= definition.medalThresholds[nextMedalCandidate]
              ? [
                  ...new Set([
                    ...(medal
                      ? []
                      : failureCodes.filter(
                          (failure) => failure !== "score-below-bronze",
                        )),
                    ...medalFailures(nextMedalCandidate),
                  ]),
                ]
              : [],
        }
      : undefined;

  return {
    scenarioId: definition.id,
    score,
    scoreUnit: definition.scoreUnit,
    medal,
    breakdown,
    failureCodes,
    ...(nextMedal ? { nextMedal } : {}),
    metaReward: medal ? metaReward(definition, medal) : undefined,
  };
}
