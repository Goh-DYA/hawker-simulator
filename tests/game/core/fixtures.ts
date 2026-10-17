/**
 * Shared fixtures for the core simulation suites.
 *
 * Holds the small synthetic {@link TEST_CATALOG} that core tests use instead of the real
 * content, a ready-made {@link makeGame} start state, catalog override helpers, and the
 * {@link runSteps} / {@link runUntil} stepping helpers so each suite advances the
 * simulation the same way.
 */
import {
  assertSimulationInvariants,
  createGridMap,
  createNewGame,
  stepSimulation,
  type GameState,
  type NewGameOptions,
  type PlacedObject,
  type SimulationCatalog,
  type StallDefinition,
} from "@/src/game/core";

/** Stall behaviour of the fixture catalog's single `stall` placeable. */
export const TEST_STALL_CONFIG: StallDefinition = {
  dishIds: ["noodles", "rice"],
  orderMs: 100,
  preparationCapacity: 1,
  queueCapacity: 4,
  popularity: 1,
  quality: 3,
};

/** Small synthetic catalog for core tests, independent of the real content. */
export const TEST_CATALOG: SimulationCatalog = {
  dishes: {
    noodles: {
      id: "noodles",
      price: 8,
      preparationMs: 200,
      eatingMs: 300,
      quality: 4,
      preferenceTags: ["noodles"],
    },
    rice: {
      id: "rice",
      price: 6,
      preparationMs: 100,
      eatingMs: 200,
      quality: 3,
      preferenceTags: ["rice"],
    },
  },
  archetypes: {
    regular: {
      id: "regular",
      budget: 30,
      patienceMs: 8_000,
      walkingSpeed: 8,
      priceSensitivity: 0.1,
      qualitySensitivity: 1,
      queueSensitivity: 0.25,
      distanceSensitivity: 0.05,
      preferenceTags: ["noodles"],
    },
    valueSeeker: {
      id: "valueSeeker",
      budget: 12,
      patienceMs: 6_000,
      walkingSpeed: 6,
      priceSensitivity: 0.5,
      qualitySensitivity: 0.4,
      queueSensitivity: 0.5,
      distanceSensitivity: 0.1,
      preferenceTags: ["rice"],
    },
  },
  placeables: {
    stall: {
      id: "stall",
      kind: "stall",
      footprint: { width: 2, height: 2 },
      allowedRotations: [0, 90, 180, 270],
      blocksMovement: true,
      price: 100,
      refundRate: 0.5,
      servicePoint: { x: 1, y: 2 },
      queueAnchor: { x: 0, y: 2 },
      stall: TEST_STALL_CONFIG,
    },
    seat: {
      id: "seat",
      kind: "seat",
      footprint: { width: 1, height: 1 },
      allowedRotations: [0, 90, 180, 270],
      blocksMovement: false,
      price: 20,
      seatPoints: [{ x: 0, y: 0 }],
    },
    tray: {
      id: "tray",
      kind: "tray-return",
      footprint: { width: 1, height: 1 },
      allowedRotations: [0, 90, 180, 270],
      blocksMovement: true,
      price: 30,
      trayReturnPoint: { x: -1, y: 0 },
    },
    table: {
      id: "table",
      kind: "table",
      footprint: { width: 2, height: 1 },
      allowedRotations: [0, 90, 180, 270],
      blocksMovement: true,
      price: 40,
    },
  },
};

/** One open stall, two seats and a tray return placed on the {@link makeGame} map. */
export const INITIAL_OBJECTS: readonly PlacedObject[] = [
  { id: "stall-1", definitionId: "stall", origin: { x: 2, y: 0 }, rotation: 0, open: true },
  { id: "seat-1", definitionId: "seat", origin: { x: 6, y: 2 }, rotation: 0, open: false },
  { id: "seat-2", definitionId: "seat", origin: { x: 7, y: 4 }, rotation: 0, open: false },
  { id: "tray-1", definitionId: "tray", origin: { x: 10, y: 6 }, rotation: 0, open: false },
];

/**
 * Create a seeded 12x8 game over {@link TEST_CATALOG} with {@link INITIAL_OBJECTS} placed.
 *
 * The fixture config caps active customers in both quality modes, which switches off the
 * production adaptive arrival model.
 *
 * @param overrides - New-game options that replace the fixture defaults key by key.
 * @returns The initial game state.
 */
export function makeGame(overrides: Partial<NewGameOptions> = {}): GameState {
  return createNewGame({
    map: createGridMap(12, 8, { tileSize: 32, worldOrigin: { x: 16, y: 24 } }),
    entrance: { x: 0, y: 3 },
    exit: { x: 11, y: 3 },
    catalog: TEST_CATALOG,
    seed: "test-seed",
    startingCurrency: 500,
    initialObjects: INITIAL_OBJECTS,
    config: {
      fixedStepMs: 100,
      spawnIntervalMs: 700,
      stuckRecoveryMs: 1_000,
      maxVisitMs: 30_000,
      standard: { maxActiveCustomers: 20, maxFixedStepsPerAdvance: 100 },
      lowerEnd: { maxActiveCustomers: 8, maxFixedStepsPerAdvance: 50 },
    },
    ...overrides,
  });
}

/**
 * Build {@link TEST_CATALOG} with the `stall` placeable's stall behaviour overridden.
 *
 * Override keys replace {@link TEST_STALL_CONFIG} values in place and new keys are
 * appended, so the result has the same key order as spreading the catalog by hand.
 *
 * @param overrides - Stall behaviour fields to replace or add.
 * @returns A new catalog; {@link TEST_CATALOG} is not modified.
 */
export function build_catalog_with_stall_config(
  overrides: Partial<StallDefinition>,
): SimulationCatalog {
  return {
    ...TEST_CATALOG,
    placeables: {
      ...TEST_CATALOG.placeables,
      stall: {
        ...TEST_CATALOG.placeables.stall,
        stall: { ...TEST_STALL_CONFIG, ...overrides },
      },
    },
  };
}

/** Options for {@link runSteps}. */
export interface RunStepsOptions {
  /** Run `assertSimulationInvariants` after every step. */
  readonly shouldCheckInvariants?: boolean;
}

/**
 * Advance the simulation by a fixed number of steps.
 *
 * @param state - The state to start from.
 * @param count - How many fixed steps to run.
 * @param options - Optional per-step checks.
 * @returns The state after `count` steps.
 * @throws Error When `shouldCheckInvariants` is set and a step breaks an invariant.
 */
export function runSteps(
  state: GameState,
  count: number,
  options: RunStepsOptions = {},
): GameState {
  let current = state;
  for (let index = 0; index < count; index += 1) {
    current = stepSimulation(current);
    if (options.shouldCheckInvariants === true) assertSimulationInvariants(current);
  }
  return current;
}

/**
 * Step the simulation until `predicate` holds.
 *
 * Throwing when the condition is never reached keeps a scenario from passing on a state
 * it did not actually get to.
 *
 * @param state - The state to start from; it is returned as is if it already satisfies
 * `predicate`.
 * @param predicate - The condition to reach.
 * @param maxSteps - The most steps to run before giving up.
 * @returns The first state that satisfies `predicate`.
 * @throws Error When `predicate` still fails after `maxSteps` steps.
 */
export function runUntil(
  state: GameState,
  predicate: (value: GameState) => boolean,
  maxSteps: number,
): GameState {
  let current = state;
  for (let step = 0; step < maxSteps && !predicate(current); step += 1) {
    current = stepSimulation(current);
  }
  if (!predicate(current)) throw new Error(`Condition was not reached after ${maxSteps} steps`);
  return current;
}
