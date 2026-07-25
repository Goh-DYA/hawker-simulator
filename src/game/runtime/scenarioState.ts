import {
  PREPARATION_GAMEPLAY_CATALOGUE,
} from "../../content/preparationGameplay";
import { NUTRITION_CONTENT } from "../../content/nutrition";
import {
  type ScenarioId,
} from "../../content/strategicGameplay";
import {
  createNewGame,
  deserializeGameStateWithReport,
  forecastForServicePeriod,
  getExecutableScenario,
  type GameState,
  type MoneyCents,
  type PlacedObject,
  type SimulationCatalog,
} from "../core";
import { asMoneyCents } from "../core/money";
import { xpRequiredForLevel } from "../core/economy";
import { decodeRuntimeSaveEnvelope } from "../persistence/runtimeEnvelope";
import {
  parseScenarioRunTelemetry,
  type ScenarioRunTelemetryV1,
} from "./scenarioTelemetry";

const SCENARIO_PLAY_LEVEL = 3;
const MENU_DIVERSITY_PLAY_LEVEL = 5;
const SCENARIO_PERIOD_SEQUENCE_ID = 1;
const LOCKED_OUTSIDE_SCENARIO_LEVEL = Number.MAX_SAFE_INTEGER;
const FIXTURE_DEFINITION_IDS = [
  "item.compact-square-table",
  "item.stacking-stool",
  "item.single-bay-tray-return",
] as const;

export interface ScenarioRuntimeUnlockSet {
  readonly stallDefinitionIds: readonly string[];
  readonly dishIds: readonly string[];
  readonly fixtureDefinitionIds: readonly string[];
  readonly placeableDefinitionIds: readonly string[];
}

export interface ScenarioRuntimeSetup {
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly startingCashCents: MoneyCents;
  readonly unlocks: ScenarioRuntimeUnlockSet;
  readonly stallMenus: Readonly<Record<string, readonly string[]>>;
  readonly activeDishVariants: Readonly<Record<string, string>>;
  readonly activePreparationIds: Readonly<Record<string, string>>;
  readonly initialObjects: readonly PlacedObject[];
}

export interface RestoredScenarioRuntimeEnvelope {
  readonly scenarioId: ScenarioId;
  readonly state: GameState;
  readonly catalog: SimulationCatalog;
  readonly stallMenus: Readonly<Record<string, readonly string[]>>;
  readonly activeDishVariants: Readonly<Record<string, string>>;
  readonly activePreparationIds: Readonly<Record<string, string>>;
  readonly nutritionDataVersion: string;
  readonly periodOutcomes: unknown;
  readonly scenarioTelemetry?: ScenarioRunTelemetryV1;
  readonly coreRecoveryWarnings: readonly string[];
  readonly recoveredLegacySelections: boolean;
}

interface ScenarioFixtureSeed {
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly rotation?: PlacedObject["rotation"];
}

const SCENARIO_FIXTURE_SEEDS: Readonly<
  Record<ScenarioId, readonly ScenarioFixtureSeed[]>
> = {
  "scenario.narrow-aisles": [
    { definitionId: "stall.sunrise-roost", x: 1, y: 1 },
    { definitionId: "stall.coconut-lime", x: 14, y: 1 },
    { definitionId: "item.compact-square-table", x: 8, y: 8 },
    { definitionId: "item.stacking-stool", x: 7, y: 8 },
    { definitionId: "item.stacking-stool", x: 9, y: 8 },
    { definitionId: "item.single-bay-tray-return", x: 15, y: 11 },
  ],
  "scenario.split-hall": [
    { definitionId: "stall.sunrise-roost", x: 1, y: 1 },
    { definitionId: "stall.kopi-canopy", x: 15, y: 1 },
    { definitionId: "stall.cinder-wok", x: 20, y: 1 },
    { definitionId: "item.compact-square-table", x: 6, y: 9 },
    { definitionId: "item.stacking-stool", x: 5, y: 9 },
    { definitionId: "item.stacking-stool", x: 7, y: 9 },
    { definitionId: "item.compact-square-table", x: 18, y: 9 },
    { definitionId: "item.stacking-stool", x: 17, y: 9 },
    { definitionId: "item.stacking-stool", x: 19, y: 9 },
    { definitionId: "item.single-bay-tray-return", x: 3, y: 13 },
    { definitionId: "item.single-bay-tray-return", x: 21, y: 13 },
  ],
  "scenario.limited-cash": [
    { definitionId: "stall.sunrise-roost", x: 1, y: 1 },
    { definitionId: "stall.kopi-canopy", x: 13, y: 1 },
    { definitionId: "item.stacking-stool", x: 7, y: 7 },
    { definitionId: "item.single-bay-tray-return", x: 15, y: 11 },
  ],
  "scenario.menu-diversity": [
    { definitionId: "stall.coconut-lime", x: 1, y: 1 },
    { definitionId: "stall.kopi-canopy", x: 11, y: 1 },
    { definitionId: "stall.tamarind-leaf", x: 18, y: 1 },
    { definitionId: "item.compact-square-table", x: 6, y: 8 },
    { definitionId: "item.stacking-stool", x: 5, y: 8 },
    { definitionId: "item.stacking-stool", x: 7, y: 8 },
    { definitionId: "item.compact-square-table", x: 18, y: 9 },
    { definitionId: "item.stacking-stool", x: 17, y: 9 },
    { definitionId: "item.stacking-stool", x: 19, y: 9 },
    { definitionId: "item.single-bay-tray-return", x: 20, y: 13 },
  ],
  "scenario.peak-throughput": [
    { definitionId: "stall.sunrise-roost", x: 1, y: 1 },
    { definitionId: "stall.cinder-wok", x: 11, y: 1 },
    { definitionId: "stall.mee-pok-junction", x: 21, y: 1 },
    { definitionId: "item.compact-square-table", x: 7, y: 8 },
    { definitionId: "item.stacking-stool", x: 6, y: 8 },
    { definitionId: "item.stacking-stool", x: 8, y: 8 },
    { definitionId: "item.compact-square-table", x: 20, y: 8 },
    { definitionId: "item.stacking-stool", x: 19, y: 8 },
    { definitionId: "item.stacking-stool", x: 21, y: 8 },
    { definitionId: "item.single-bay-tray-return", x: 4, y: 13 },
    { definitionId: "item.single-bay-tray-return", x: 23, y: 13 },
  ],
};

const DEFAULT_PREPARATION_BY_DISH_ID = new Map(
  PREPARATION_GAMEPLAY_CATALOGUE
    .filter((preparation) => preparation.isDefault)
    .map((preparation) => [preparation.dishId, preparation]),
);
const PREPARATION_BY_DISH_AND_VARIANT = new Map(
  PREPARATION_GAMEPLAY_CATALOGUE.map((preparation) => [
    `${preparation.dishId}:${preparation.variantId ?? "default"}`,
    preparation,
  ]),
);

function reviewedPreparationFor(dishId: string, variantId?: string) {
  return PREPARATION_BY_DISH_AND_VARIANT.get(
    `${dishId}:${variantId ?? "default"}`,
  );
}

function scenarioStallMenus(
  scenarioId: ScenarioId,
  catalog: SimulationCatalog,
): Readonly<Record<string, readonly string[]>> {
  const { definition } = getExecutableScenario(scenarioId);
  const unlockedDishes = new Set(definition.unlockedDishIds);
  return Object.fromEntries(definition.unlockedStallIds.map((stallId) => {
    const stall = catalog.placeables[stallId]?.stall;
    if (!stall) {
      throw new Error(`${definition.name} references missing runtime stall ${stallId}.`);
    }
    const dishIds = (stall.allDishIds ?? stall.dishIds).filter((dishId) =>
      unlockedDishes.has(dishId)
    );
    if (dishIds.length === 0) {
      throw new Error(`${definition.name} has no reviewed dishes for ${stallId}.`);
    }
    return [stallId, Object.freeze(dishIds)];
  }));
}

function resolveScenarioPreparations(
  catalog: SimulationCatalog,
): {
  readonly dishes: SimulationCatalog["dishes"];
  readonly activePreparationIds: Readonly<Record<string, string>>;
} {
  const activePreparationIds: Record<string, string> = {};
  const dishes = Object.fromEntries(
    Object.entries(catalog.dishes).map(([dishId, dish]) => {
      const preparation = reviewedPreparationFor(
        dishId,
        dish.defaultNutritionVariantId,
      ) ?? DEFAULT_PREPARATION_BY_DISH_ID.get(dishId);
      if (!preparation) {
        throw new Error(`Dish ${dishId} has no reviewed default preparation.`);
      }
      activePreparationIds[dishId] = preparation.id;
      return [
        dishId,
        {
          ...dish,
          activePreparationId: preparation.id,
          activeNutritionVariantId: dish.defaultNutritionVariantId,
          mealRole: preparation.mealRole,
          priceCents: asMoneyCents(preparation.terms.priceCents),
          ingredientCostCents: asMoneyCents(
            preparation.terms.ingredientCostCents,
          ),
          preparationMs: preparation.terms.preparationTimeMs,
          servingMs: preparation.terms.servingTimeMs,
          eatingMs: preparation.terms.eatingTimeMs,
          starRating: preparation.terms.starAppeal,
          demandModifierBasisPoints:
            preparation.terms.demandModifierBasisPoints,
        },
      ];
    }),
  );
  return {
    dishes,
    activePreparationIds: Object.freeze(activePreparationIds),
  };
}

function scenarioUnlockSet(
  scenarioId: ScenarioId,
): ScenarioRuntimeUnlockSet {
  const { definition } = getExecutableScenario(scenarioId);
  const fixtureDefinitionIds = [...FIXTURE_DEFINITION_IDS];
  const placeableDefinitionIds = [
    ...new Set([
      ...definition.unlockedStallIds,
      ...fixtureDefinitionIds,
    ]),
  ].sort();
  return Object.freeze({
    stallDefinitionIds: Object.freeze([...definition.unlockedStallIds]),
    dishIds: Object.freeze([...definition.unlockedDishIds]),
    fixtureDefinitionIds: Object.freeze(fixtureDefinitionIds),
    placeableDefinitionIds: Object.freeze(placeableDefinitionIds),
  });
}

function activeScenarioDishVariants(): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(
    NUTRITION_CONTENT.variantFamilies.map((family) => [
      family.dishId,
      family.defaultVariantId,
    ]),
  ));
}

function initialScenarioObjects(
  scenarioId: ScenarioId,
): readonly PlacedObject[] {
  return Object.freeze(SCENARIO_FIXTURE_SEEDS[scenarioId].map((fixture, index) =>
    Object.freeze({
      id: `scenario-fixture-${index + 1}`,
      definitionId: fixture.definitionId,
      origin: Object.freeze({ x: fixture.x, y: fixture.y }),
      rotation: fixture.rotation ?? 0,
      open: false,
    })
  ));
}

/**
 * Builds a scenario-owned catalogue from existing authored content. Scenario
 * stalls expose only the fixed reviewed menu, and every other buildable entry
 * remains hard-locked even if scenario XP changes.
 */
export function createScenarioRuntimeCatalog(
  scenarioId: ScenarioId,
  authoredCatalog: SimulationCatalog,
): SimulationCatalog {
  const { definition } = getExecutableScenario(scenarioId);
  const unlocks = scenarioUnlockSet(scenarioId);
  const unlockedPlaceables = new Set(unlocks.placeableDefinitionIds);
  const unlockedDishes = new Set(unlocks.dishIds);
  const stallMenus = scenarioStallMenus(scenarioId, authoredCatalog);
  const preparations = resolveScenarioPreparations(authoredCatalog);

  const placeables = Object.fromEntries(
    Object.entries(authoredCatalog.placeables).map(([id, placeable]) => {
      const menu = stallMenus[id];
      return [
        id,
        {
          ...placeable,
          unlockLevel: unlockedPlaceables.has(id)
            ? 1
            : LOCKED_OUTSIDE_SCENARIO_LEVEL,
          stall: placeable.stall
            ? {
                ...placeable.stall,
                dishIds: menu ?? placeable.stall.dishIds,
                allDishIds: menu ?? placeable.stall.allDishIds,
              }
            : undefined,
        },
      ];
    }),
  );
  const dishes = Object.fromEntries(
    Object.entries(preparations.dishes).map(([id, dish]) => [
      id,
      {
        ...dish,
        unlockLevel: unlockedDishes.has(id)
          ? 1
          : LOCKED_OUTSIDE_SCENARIO_LEVEL,
        unlockReputation: unlockedDishes.has(id) ? 0 : dish.unlockReputation,
        unlockPrerequisiteIds: unlockedDishes.has(id)
          ? []
          : dish.unlockPrerequisiteIds,
      },
    ]),
  );

  for (const stallId of definition.unlockedStallIds) {
    if (!placeables[stallId]) {
      throw new Error(`${definition.name} cannot unlock missing stall ${stallId}.`);
    }
  }
  for (const dishId of definition.unlockedDishIds) {
    if (!dishes[dishId]) {
      throw new Error(`${definition.name} cannot unlock missing dish ${dishId}.`);
    }
  }
  return {
    placeables,
    dishes,
    archetypes: authoredCatalog.archetypes,
  };
}

export function getScenarioRuntimeSetup(
  scenarioId: ScenarioId,
  authoredCatalog: SimulationCatalog,
): ScenarioRuntimeSetup {
  const { definition } = getExecutableScenario(scenarioId);
  const catalog = createScenarioRuntimeCatalog(scenarioId, authoredCatalog);
  const activePreparationIds = Object.fromEntries(
    definition.unlockedDishIds.map((dishId) => {
      const preparationId = catalog.dishes[dishId]?.activePreparationId;
      if (!preparationId) {
        throw new Error(
          `${definition.name} dish ${dishId} has no reviewed active preparation.`,
        );
      }
      return [dishId, preparationId];
    }),
  );
  return Object.freeze({
    scenarioId,
    seed: definition.seed,
    startingCashCents: asMoneyCents(definition.startingCashCents),
    unlocks: scenarioUnlockSet(scenarioId),
    stallMenus: scenarioStallMenus(scenarioId, catalog),
    activeDishVariants: activeScenarioDishVariants(),
    activePreparationIds: Object.freeze(activePreparationIds),
    initialObjects: initialScenarioObjects(scenarioId),
  });
}

/**
 * Creates a fresh isolated Core V7 game state using the authored scenario map,
 * access points, seed, integer-cent starting cash, fixed menus, and fixtures.
 */
export function createScenarioGameState(
  scenarioId: ScenarioId,
  authoredCatalog: SimulationCatalog,
): GameState {
  const executable = getExecutableScenario(scenarioId);
  const catalog = createScenarioRuntimeCatalog(scenarioId, authoredCatalog);
  const setup = getScenarioRuntimeSetup(scenarioId, authoredCatalog);
  const created = createNewGame({
    map: executable.map.grid,
    accessPoints: executable.map.accessPoints,
    catalog,
    seed: setup.seed,
    startingCashCents: setup.startingCashCents,
    initialObjects: setup.initialObjects,
    initiallyUnlockedDefinitionIds: setup.unlocks.placeableDefinitionIds,
  });
  const playLevel = scenarioId === "scenario.menu-diversity"
    ? MENU_DIVERSITY_PLAY_LEVEL
    : SCENARIO_PLAY_LEVEL;
  return constrainScenarioGameState(
    scenarioId,
    {
      ...created,
      progression: {
        ...created.progression,
        xp: xpRequiredForLevel(playLevel),
        level: playLevel,
      },
    },
    authoredCatalog,
  );
}

/**
 * Re-applies the authored scenario catalogue and exact placeable unlock set
 * after a progression transition. Cash, XP, objectives, and run state are not
 * copied from or written to the main centre.
 */
export function constrainScenarioGameState(
  scenarioId: ScenarioId,
  state: GameState,
  authoredCatalog: SimulationCatalog,
): GameState {
  const unlocks = scenarioUnlockSet(scenarioId);
  const catalog = createScenarioRuntimeCatalog(scenarioId, authoredCatalog);
  const { definition } = getExecutableScenario(scenarioId);
  const demandBasisPoints =
    definition.modifiers.kind === "narrow-aisles" ||
      definition.modifiers.kind === "peak-throughput"
      ? definition.modifiers.arrivalBasisPoints
      : 10_000;
  const authoredForecast = forecastForServicePeriod(state.servicePeriod, undefined, {
    demandBasisPoints,
  });
  const mealMix = scenarioId === "scenario.menu-diversity"
    ? Object.freeze([
        Object.freeze({ id: "main-only", basisPoints: 3_000 }),
        Object.freeze({ id: "main-and-drink", basisPoints: 3_000 }),
        Object.freeze({ id: "main-and-side", basisPoints: 4_000 }),
      ])
    : state.forecast.mealMix;
  return {
    ...state,
    // Rebuild from authored content rather than from the potentially mutated
    // live catalogue; otherwise a menu edit could become its own new baseline.
    catalog,
    forecast: Object.freeze({
      ...state.forecast,
      demandRange: authoredForecast.demandRange,
      mealMix,
    }),
    progression: {
      ...state.progression,
      unlockedDefinitionIds: [...unlocks.placeableDefinitionIds],
    },
  };
}

/** A scenario run ends at the first period debrief; it never advances a day. */
export function isScenarioRunComplete(state: GameState): boolean {
  return (
    state.servicePeriod.sequenceId === SCENARIO_PERIOD_SEQUENCE_ID &&
    state.servicePeriod.phase === "debrief"
  );
}

function sameAccessPoints(
  left: GameState["accessPoints"],
  right: GameState["accessPoints"],
): boolean {
  return (
    left.length === right.length &&
    left.every((point, index) => {
      const expected = right[index];
      return (
        expected !== undefined &&
        point.id === expected.id &&
        point.kind === expected.kind &&
        point.position.x === expected.position.x &&
        point.position.y === expected.position.y
      );
    })
  );
}

function assertScenarioMap(
  scenarioId: ScenarioId,
  state: GameState,
): void {
  const { definition, map } = getExecutableScenario(scenarioId);
  if (
    state.map.width !== map.grid.width ||
    state.map.height !== map.grid.height ||
    state.map.tileSize !== map.grid.tileSize ||
    state.map.tiles.length !== map.grid.tiles.length ||
    state.map.tiles.some((tile, index) => tile !== map.grid.tiles[index]) ||
    !sameAccessPoints(state.accessPoints, map.accessPoints)
  ) {
    throw new Error(
      `${definition.name} save does not use its fixed authored map and access points.`,
    );
  }
  if (state.servicePeriod.sequenceId !== SCENARIO_PERIOD_SEQUENCE_ID) {
    throw new Error(`${definition.name} is limited to one service period.`);
  }
}

function assertScenarioObjects(
  scenarioId: ScenarioId,
  state: GameState,
): void {
  const setup = scenarioUnlockSet(scenarioId);
  const allowed = new Set(setup.placeableDefinitionIds);
  const invalid = Object.values(state.objects).find(
    (object) => !allowed.has(object.definitionId),
  );
  if (invalid) {
    throw new Error(
      `Scenario save object ${invalid.id} uses locked definition ${invalid.definitionId}.`,
    );
  }
}

function assertScenarioMealConfiguration(
  scenarioId: ScenarioId,
  state: GameState,
): void {
  const { definition } = getExecutableScenario(scenarioId);
  const allowedDishes = new Set(definition.unlockedDishIds);
  for (const offer of state.comboBoard.slots) {
    if (!offer) continue;
    const invalidPreparationId = offer.preparationIds.find(
      (preparationId) => {
        const preparation = PREPARATION_GAMEPLAY_CATALOGUE.find(
          (candidate) => candidate.id === preparationId,
        );
        return !preparation || !allowedDishes.has(preparation.dishId);
      },
    );
    if (invalidPreparationId) {
      throw new Error(
        `Scenario Combo Board references locked preparation ${invalidPreparationId}.`,
      );
    }
  }
}

function assertCompletedScenarioTelemetry(
  scenarioId: ScenarioId,
  state: GameState,
  telemetry: ScenarioRunTelemetryV1 | undefined,
  periodOutcomes: unknown,
): asserts telemetry is ScenarioRunTelemetryV1 {
  const { definition } = getExecutableScenario(scenarioId);
  if (!telemetry) {
    throw new Error(
      `${definition.name} completed save is missing valid scenario telemetry.`,
    );
  }
  const completedRatingIds = state.metrics.visitRatings
    .filter(
      (rating) =>
        rating.arrivalPeriodSequenceId === state.servicePeriod.sequenceId &&
        rating.served &&
        rating.reason !== "served-timeout",
    )
    .map((rating) => rating.customerId)
    .sort();
  const retainedServedTimeouts = state.metrics.visitRatings.filter(
    (rating) =>
      rating.arrivalPeriodSequenceId === state.servicePeriod.sequenceId &&
      rating.served &&
      rating.reason === "served-timeout",
  ).length;
  const periodOutcome = (
    typeof periodOutcomes === "object" &&
    periodOutcomes !== null &&
    !Array.isArray(periodOutcomes)
  )
    ? (periodOutcomes as Record<string, unknown>)[
        String(state.servicePeriod.sequenceId)
      ]
    : undefined;
  const persistedServedTimeouts = (
    typeof periodOutcome === "object" &&
    periodOutcome !== null &&
    !Array.isArray(periodOutcome) &&
    Number.isSafeInteger(
      (periodOutcome as Record<string, unknown>).timedOutServedVisits,
    ) &&
    (
      (periodOutcome as Record<string, unknown>).timedOutServedVisits as number
    ) >= 0
  )
    ? (
        periodOutcome as Record<string, unknown>
      ).timedOutServedVisits as number
    : retainedServedTimeouts;
  const expectedCompletedVisits =
    state.metrics.completedCustomers - persistedServedTimeouts;
  if (
    expectedCompletedVisits < 0 ||
    telemetry.flowObservedMs === 0 ||
    telemetry.lastArrivalElapsedMs !==
      state.servicePeriod.arrivalElapsedMs ||
    telemetry.lastQualifyingFlowMs !== state.metrics.qualifyingFlowMs ||
    telemetry.lastSpawnedCustomers !== state.metrics.spawnedCustomers ||
    telemetry.lastPathRequests !== state.metrics.pathRequests ||
    telemetry.lastPathFailures !== state.metrics.pathFailures ||
    telemetry.totalArrivals !== state.metrics.spawnedCustomers ||
    telemetry.pathRequests !== state.metrics.pathRequests ||
    telemetry.pathFailures !== state.metrics.pathFailures ||
    telemetry.flowQualifyingMs !== state.metrics.qualifyingFlowMs ||
    telemetry.flowObservedMs !== state.servicePeriod.arrivalElapsedMs ||
    telemetry.completedVisitIds.length !== expectedCompletedVisits ||
    completedRatingIds.some(
      (customerId) =>
        !telemetry.completedVisitIds.includes(customerId),
    ) ||
    (scenarioId === "scenario.split-hall" &&
      telemetry.completedVisitIds.some(
        (customerId) =>
          telemetry.completedVisitZoneById[customerId] === undefined,
      ))
  ) {
    throw new Error(
      `${definition.name} completed save has incomplete or stale scenario telemetry.`,
    );
  }
}

function menusMatch(
  left: readonly string[] | undefined,
  right: readonly string[],
): boolean {
  return (
    left !== undefined &&
    left.length === right.length &&
    left.every((dishId, index) => dishId === right[index])
  );
}

/**
 * Restores and semantically validates a scenario runtime envelope before it is
 * accepted by a scenario save slot. The trusted catalogue is supplied by the
 * runtime, which keeps this module free of createHawkerRuntime import cycles.
 */
export function restoreScenarioRuntimeEnvelope(
  scenarioId: ScenarioId,
  payload: unknown,
  authoredCatalog: SimulationCatalog,
): RestoredScenarioRuntimeEnvelope {
  const catalog = createScenarioRuntimeCatalog(scenarioId, authoredCatalog);
  const setup = getScenarioRuntimeSetup(scenarioId, authoredCatalog);
  const decoded = decodeRuntimeSaveEnvelope(payload);
  if (decoded.menus) {
    for (const [stallId, dishIds] of Object.entries(setup.stallMenus)) {
      if (!menusMatch(decoded.menus[stallId], dishIds)) {
        throw new Error(
          `Scenario save menu for ${stallId} does not match its fixed reviewed menu.`,
        );
      }
    }
  }
  if (decoded.variants) {
    for (const [dishId, variantId] of Object.entries(
      setup.activeDishVariants,
    )) {
      if (decoded.variants[dishId] !== variantId) {
        throw new Error(
          `Scenario save preparation for ${dishId} is not the reviewed default.`,
        );
      }
    }
  }
  const restored = deserializeGameStateWithReport(decoded.core, catalog);
  assertScenarioMap(scenarioId, restored.state);
  assertScenarioObjects(scenarioId, restored.state);
  assertScenarioMealConfiguration(scenarioId, restored.state);
  const state = constrainScenarioGameState(
    scenarioId,
    restored.state,
    authoredCatalog,
  );
  const scenarioTelemetry = parseScenarioRunTelemetry(
    decoded.scenarioTelemetry,
    {
      scenarioId,
      periodSequenceId: state.servicePeriod.sequenceId,
    },
  );
  if (isScenarioRunComplete(state)) {
    assertCompletedScenarioTelemetry(
      scenarioId,
      state,
      scenarioTelemetry,
      decoded.periodOutcomes,
    );
  }
  return Object.freeze({
    scenarioId,
    state,
    catalog: state.catalog,
    stallMenus: setup.stallMenus,
    activeDishVariants: setup.activeDishVariants,
    activePreparationIds: setup.activePreparationIds,
    nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
    periodOutcomes: decoded.periodOutcomes,
    ...(scenarioTelemetry ? { scenarioTelemetry } : {}),
    coreRecoveryWarnings: Object.freeze([...restored.recovery.warnings]),
    recoveredLegacySelections:
      decoded.runtimeSchemaVersion !== 5 ||
      decoded.incompleteLegacyRuntime ||
      decoded.nutritionDataVersion !== NUTRITION_CONTENT.dataVersion,
  });
}
