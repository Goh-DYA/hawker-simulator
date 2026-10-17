/**
 * Golden master for the seeded core simulation.
 *
 * The literals here change only in intentional behaviour or balance commits. If a
 * refactor makes one fail, the refactor changed behaviour: fix the code, never the
 * literal or the snapshot.
 *
 * Every scenario rebuilds its start state from the frozen inputs in
 * `fixtures/golden-inputs.json` and from the scenario scripts in this file. It never uses
 * `fixtures.ts`, so refactoring the shared test helpers cannot move these goldens. The
 * assertions hash the raw `simulationDigest` and `stateDigest` strings instead of
 * comparing parsed objects, so object key order (which both digests depend on) is pinned
 * too. The snapshot of each scenario's final parsed simulation digest is only a diff aid
 * for finding which field moved once a hash fails.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  advanceSimulation,
  createGridMap,
  createNewGame,
  dispatchCommand,
  simulationDigest,
  stateDigest,
  stepSimulation,
  type Customer,
  type GameCommand,
  type GameState,
  type GridPoint,
  type PlacedObject,
  type QualityMode,
  type SimulationCatalog,
  type SimulationConfigOverrides,
  type StallUpgradeDefinition,
} from "@/src/game/core";
import raw_golden_inputs from "./fixtures/golden-inputs.json";

/** The `makeGame` fixture of the core suites, captured as data. */
interface GoldenFixtureInputs {
  readonly map: {
    readonly width: number;
    readonly height: number;
    readonly tileSize: number;
    readonly worldOrigin: GridPoint;
  };
  readonly entrance: GridPoint;
  readonly exit: GridPoint;
  readonly seed: string;
  readonly startingCurrency: number;
  readonly initialObjects: readonly PlacedObject[];
  readonly config: SimulationConfigOverrides;
}

/** Start-state parameters of the 80-agent benchmark in `performance.test.ts`. */
interface EightyAgentStartInputs {
  readonly seed: string;
  readonly config: SimulationConfigOverrides;
  readonly agentCount: number;
  readonly agentIdPrefix: string;
  readonly spawnCountdownMs: number;
  readonly nextCustomerSequence: number;
}

/** Shape of `fixtures/golden-inputs.json`. */
interface GoldenInputs {
  readonly testCatalog: SimulationCatalog;
  readonly nutritionCatalog: SimulationCatalog;
  readonly fixture: GoldenFixtureInputs;
  /** The fixture config without `maxActiveCustomers`, so the adaptive arrival model runs. */
  readonly adaptiveConfig: SimulationConfigOverrides;
  readonly eightyAgentStart: EightyAgentStartInputs;
}

/** Expected hashes at the end of a scenario. */
interface ScenarioEndHashes {
  readonly stateDigestSha256: string;
  readonly stepperStateSha256: string;
}

function freeze_recursively<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze_recursively(child);
  }
  return value;
}

const GOLDEN_INPUTS: GoldenInputs = freeze_recursively(raw_golden_inputs as GoldenInputs);

/** XP that `calculateLevel` turns into level 2, so the level survives each step's recalculation. */
const LEVEL_TWO_XP = 100;

const SOAK_SEED = "soak-2026";
const SOAK_OPEN_STEPS = 600;
const SOAK_CLOSED_STEPS = 300;
const SOAK_CHECKPOINT_STEPS = 300;

const EIGHTY_AGENT_STEPS = 1_200;
const EIGHTY_AGENT_CHECKPOINT_STEPS = 600;

const LOWER_END_SEED = "golden-lower-end";
/** Frame deltas that overrun the lower-end budget of 50 fixed steps, so steps are dropped. */
const LOWER_END_FRAME_DELTAS_MS: readonly number[] = [
  16, 17, 16, 250, 6_000, 33, 1_000, 9_999, 16.5, 5_000,
];
const LOWER_END_CYCLES = 4;

const NUTRITION_SEED = "golden-nutrition-upgrade";
const NUTRITION_STEPS = 900;
const NUTRITION_CHECKPOINT_STEPS = 300;
const NUTRITION_UPGRADE_LEVELS: readonly StallUpgradeDefinition[] = [
  {
    level: 2,
    cost: 75,
    serviceTimeMultiplier: 0.9,
    capacityBonus: 1,
    qualityBonus: 0.05,
    menuSlotsBonus: 1,
  },
];

const COMMAND_SEED = "golden-commands";
const COMMAND_WARMUP_STEPS = 50;
const COMMAND_FOLLOW_UP_STEPS = 300;
const COMMAND_CHECKPOINT_STEPS = 150;
const COMMAND_SCRIPT: readonly GameCommand[] = [
  { type: "place-object", objectId: "golden-seat", definitionId: "seat", origin: { x: 8, y: 2 } },
  { type: "move-object", objectId: "golden-seat", origin: { x: 9, y: 1 } },
  { type: "remove-object", objectId: "seat-2" },
  { type: "undo" },
  { type: "set-stall-open", objectId: "stall-1", open: false },
  { type: "set-stall-open", objectId: "stall-1", open: true },
  { type: "configure-guest-route", points: [{ x: 4, y: 5 }] },
  { type: "expand-map", addColumns: 1, addRows: 0 },
];

const ADAPTIVE_SEED = "golden-adaptive";
const ADAPTIVE_ARRIVAL_PERFORMANCE_PRESSURE = 0.25;
const ADAPTIVE_TOTAL_STEPS = 10_000;

function hash_sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Serialise the fields that drive the next step but that the digests leave out or only
 * partly cover.
 */
function serialize_stepper_state(state: GameState): string {
  return JSON.stringify({
    rngState: state.rngState,
    spawnCountdownMs: state.spawnCountdownMs,
    accumulatorMs: state.accumulatorMs,
    nextCustomerSequence: state.nextCustomerSequence,
    events: state.events,
    dailyObjectives: state.progression.dailyObjectives,
    today: state.metrics.nutrition.today,
  });
}

function create_fixture_game(options: {
  readonly seed: string;
  readonly catalog?: SimulationCatalog;
  readonly config?: SimulationConfigOverrides;
  readonly qualityMode?: QualityMode;
}): GameState {
  const fixture = GOLDEN_INPUTS.fixture;
  return createNewGame({
    map: createGridMap(fixture.map.width, fixture.map.height, {
      tileSize: fixture.map.tileSize,
      worldOrigin: fixture.map.worldOrigin,
    }),
    entrance: fixture.entrance,
    exit: fixture.exit,
    catalog: options.catalog ?? GOLDEN_INPUTS.testCatalog,
    seed: options.seed,
    startingCurrency: fixture.startingCurrency,
    initialObjects: fixture.initialObjects,
    config: options.config ?? fixture.config,
    qualityMode: options.qualityMode,
  });
}

function with_level_two(state: GameState): GameState {
  return { ...state, progression: { ...state.progression, xp: LEVEL_TWO_XP, level: 2 } };
}

function run_steps(state: GameState, count: number): GameState {
  let current = state;
  for (let index = 0; index < count; index += 1) current = stepSimulation(current);
  return current;
}

// The hash assertions are soft so that one run reports every drifted checkpoint and still
// reaches the end-of-scenario snapshot diff; any mismatch still fails the test.

function expect_checkpoint(state: GameState, label: string, expected_sha256: string): void {
  expect.soft(hash_sha256(simulationDigest(state)), `${label}: simulationDigest`).toBe(
    expected_sha256,
  );
}

function expect_scenario_end(state: GameState, label: string, expected: ScenarioEndHashes): void {
  expect.soft(JSON.parse(simulationDigest(state))).toMatchSnapshot(`${label} end`);
  expect.soft(hash_sha256(stateDigest(state)), `${label}: stateDigest`).toBe(
    expected.stateDigestSha256,
  );
  expect.soft(hash_sha256(serialize_stepper_state(state)), `${label}: stepper state`).toBe(
    expected.stepperStateSha256,
  );
}

describe("core simulation golden master", () => {
  it("(a) runs seed soak-2026 for 600 steps open, then 300 steps closed", () => {
    const checkpoints = [
      {
        tick: 300,
        simulationDigestSha256: "a8e780057dcd49fb26bf9e0e26e176330949daac65d1dd209e0a1ad91a3c64b4",
      },
      {
        tick: 600,
        simulationDigestSha256: "b409b7c6be2eda6c615602b7934540e566db0923ee53a53afeca62ce1cf10db6",
      },
    ];
    let state = create_fixture_game({ seed: SOAK_SEED });
    for (const checkpoint of checkpoints) {
      state = run_steps(state, SOAK_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(a) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(SOAK_OPEN_STEPS);

    const closed = dispatchCommand(state, {
      type: "set-stall-open",
      objectId: "stall-1",
      open: false,
    });
    expect(closed.accepted).toBe(true);
    state = run_steps(closed.state, SOAK_CLOSED_STEPS);
    expect_checkpoint(
      state,
      "(a) tick 900",
      "1042c0991244e20eb85f4df5d46f217ead9a9519269d09be9f212d1c230c7ba9",
    );
    expect_scenario_end(state, "(a)", {
      stateDigestSha256: "59d1c47350119e8ceb75e9969470dc165510b37bfa091b66cb76744d939d8a09",
      stepperStateSha256: "dfb116ae1a5d6208120da9c8882baafafa6d4f6fc2b76b9768bbf016f690a2b2",
    });
  });

  it("(b) runs the 80-agent benchmark start state", () => {
    const start = GOLDEN_INPUTS.eightyAgentStart;
    let state = stepSimulation(create_fixture_game({ seed: start.seed, config: start.config }));
    const template = Object.values(state.customers)[0];
    if (template === undefined) {
      throw new Error("Expected the first step to spawn a template customer");
    }

    const customers: Record<string, Customer> = {};
    for (let index = 0; index < start.agentCount; index += 1) {
      const id = `${start.agentIdPrefix}${index + 1}`;
      customers[id] = {
        ...template,
        id,
        position: { ...state.entrance },
        path: [],
        pathIndex: 0,
        movementProgress: 0,
        stateElapsedMs: 0,
        visitElapsedMs: 0,
        walkingDistanceTiles: 0,
        targetStallId: undefined,
        orderedDishId: undefined,
        reservedSeatKey: undefined,
        targetTrayReturnId: undefined,
      };
    }
    state = {
      ...state,
      customers,
      queues: Object.fromEntries(Object.keys(state.queues).map((stallId) => [stallId, []])),
      spawnCountdownMs: start.spawnCountdownMs,
      nextCustomerSequence: start.nextCustomerSequence,
      metrics: { ...state.metrics, spawnedCustomers: start.agentCount, despawnedCustomers: 0 },
    };
    expect_checkpoint(
      state,
      "(b) tick 1",
      "070f1622a92ffef373a833e565d6c4be273d62ce39b27002c6ecc85d3498cd8c",
    );

    const checkpoints = [
      {
        tick: 601,
        simulationDigestSha256: "cf8b8068e67ec6507a184a3e5505d1cddd12a99700b1afb4a5a0dfabbc2815cc",
      },
      {
        tick: 1_201,
        simulationDigestSha256: "308fecc7a737fc71beb33c1633029c7c9dcb615a2831ed04d5720719cbaadd25",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, EIGHTY_AGENT_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(b) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(1 + EIGHTY_AGENT_STEPS);
    expect_scenario_end(state, "(b)", {
      stateDigestSha256: "5df48520fab6a6c97ff2d8c62e90a0d6e9b3e3365fbbef76df27257334a68f1d",
      stepperStateSha256: "79f84de12ae3244fbb087725f60d25390f3772e6dbd967adba7dbc3df083a17b",
    });
  });

  it("(c) advances lower-end mode with frames that drop fixed steps", () => {
    const checkpoints = [
      {
        cycle: 1,
        simulationDigestSha256: "44e1a9add6f0e44baa3b4228c6012a59115f805dd823df4e96d8558485884ac9",
      },
      {
        cycle: 2,
        simulationDigestSha256: "c36c5c25c0624b35c89345408b3f87c8562d9f190dd987628421ec89d6d1f9c5",
      },
      {
        cycle: 3,
        simulationDigestSha256: "f6f9e91313765e0f6634c1b0e8c7042ae31c411a2d0083b5eb21e06525c80032",
      },
      {
        cycle: 4,
        simulationDigestSha256: "38bccf9fe6affa11c562c39221da9de94ca41cea9e94a836f0a0d209cbeccba7",
      },
    ];
    let state = create_fixture_game({ seed: LOWER_END_SEED, qualityMode: "lower-end" });
    let total_fixed_steps = 0;
    let total_dropped_ms = 0;
    for (const checkpoint of checkpoints) {
      for (const frame_delta_ms of LOWER_END_FRAME_DELTAS_MS) {
        const result = advanceSimulation(state, frame_delta_ms);
        total_fixed_steps += result.fixedSteps;
        total_dropped_ms += result.droppedMs;
        state = result.state;
      }
      expect_checkpoint(state, `(c) cycle ${checkpoint.cycle}`, checkpoint.simulationDigestSha256);
    }
    expect(checkpoints).toHaveLength(LOWER_END_CYCLES);
    expect({ fixedSteps: total_fixed_steps, droppedMs: total_dropped_ms }).toEqual({
      fixedSteps: 653,
      droppedMs: 24000,
    });
    expect_scenario_end(state, "(c)", {
      stateDigestSha256: "85921d624334274144448c784e55f56ee6f12afe8e041b6fa52263afd355fcb4",
      stepperStateSha256: "ccc7d4e21d05f415be76669e656721083584f98cb24bb0b4850b577f92af2b72",
    });
  });

  it("(d) runs the nutrition catalog at level 2 with the stall at upgrade level 2", () => {
    const nutrition_catalog = GOLDEN_INPUTS.nutritionCatalog;
    const stall_placeable = nutrition_catalog.placeables.stall;
    const stall_definition = stall_placeable?.stall;
    if (stall_placeable === undefined || stall_definition === undefined) {
      throw new Error("Expected the nutrition catalog to define the stall placeable");
    }
    const catalog: SimulationCatalog = {
      ...nutrition_catalog,
      placeables: {
        ...nutrition_catalog.placeables,
        stall: {
          ...stall_placeable,
          stall: { ...stall_definition, upgradeLevels: NUTRITION_UPGRADE_LEVELS },
        },
      },
    };
    const initial = with_level_two(create_fixture_game({ seed: NUTRITION_SEED, catalog }));
    let state: GameState = {
      ...initial,
      progression: {
        ...initial.progression,
        stallMastery: { stall: { points: 100, rank: 2, upgradeLevel: 2 } },
      },
    };

    const checkpoints = [
      {
        tick: 300,
        simulationDigestSha256: "ef3f2b700e06598cdeafcd151fbac593192d51629e2af73f21444c514919a563",
      },
      {
        tick: 600,
        simulationDigestSha256: "12c8890fcf709801589819acf3bc072cf6621216aa1b0731e4cdb4633d461f72",
      },
      {
        tick: 900,
        simulationDigestSha256: "069f112b88e133e4aaa36f54e19b0d63b59fb1fbae3cf22dceda5423251b9eac",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, NUTRITION_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(d) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(NUTRITION_STEPS);
    expect(state.progression.level).toBeGreaterThanOrEqual(2);
    expect(state.progression.stallMastery.stall?.upgradeLevel).toBe(2);
    expect_scenario_end(state, "(d)", {
      stateDigestSha256: "f21081b83454d3542a167c0b31944f6f73de8e57ac6f947452ea174b83ece2f5",
      stepperStateSha256: "a086ba8e966c13fa6aa2635d22e6cfa27f4627cfaa57bb9fc6a466df889d273e",
    });
  });

  it("(e) applies a fixed build-command script, then runs 300 steps", () => {
    let state = run_steps(create_fixture_game({ seed: COMMAND_SEED }), COMMAND_WARMUP_STEPS);
    const accepted: boolean[] = [];
    for (const command of COMMAND_SCRIPT) {
      const result = dispatchCommand(state, command);
      accepted.push(result.accepted);
      state = result.state;
    }
    expect(accepted).toEqual(COMMAND_SCRIPT.map(() => true));
    expect_checkpoint(
      state,
      "(e) after script",
      "defe2a4e535c0b32e312961be710f0773d8a44aef0063fec795189c80c9a06f9",
    );

    const checkpoints = [
      {
        tick: 200,
        simulationDigestSha256: "7707603e522bd9ac04e633c7d86a197a987e476ddb85245e326a70a7b607a03a",
      },
      {
        tick: 350,
        simulationDigestSha256: "b55c75b939eae7133e9547d9d7f3788d2098ea5da26ebf1c17694f61250a4859",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, COMMAND_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(e) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(COMMAND_WARMUP_STEPS + COMMAND_FOLLOW_UP_STEPS);
    expect_scenario_end(state, "(e)", {
      stateDigestSha256: "e31b624be8718ab095fb52ba2a72db04f466d260eb959a37a9940dfc0271656d",
      stepperStateSha256: "b90a7bff4948346b4409bd4947c9161183a384093585619776074cb96733d76d",
    });
  });

  it("(f) runs the adaptive arrival model with nutrition and health for two day rollovers", () => {
    const initial = with_level_two(
      create_fixture_game({
        seed: ADAPTIVE_SEED,
        catalog: GOLDEN_INPUTS.nutritionCatalog,
        config: GOLDEN_INPUTS.adaptiveConfig,
      }),
    );
    let state: GameState = {
      ...initial,
      arrivalPerformancePressure: ADAPTIVE_ARRIVAL_PERFORMANCE_PRESSURE,
    };
    expect(state.config.standard.maxActiveCustomers).toBeUndefined();

    // Ticks 4,800 and 9,600 are the 480,000 ms and 960,000 ms operating-day rollovers.
    const checkpoints = [
      {
        tick: 4_799,
        focusDay: 1,
        simulationDigestSha256: "ce41f3b63f18e541692c184f728bbd30340bec0e9f1b3174a3d2feba12f2b6b0",
      },
      {
        tick: 4_801,
        focusDay: 2,
        simulationDigestSha256: "08944de62216f086f3a666f7182ff563cfcec76cdc0a12a33e8b4fda26e82b1b",
      },
      {
        tick: 9_599,
        focusDay: 2,
        simulationDigestSha256: "900d1d536147d773ffeaeccfa92958eccfcaa2bb1bdbf7b91857016920794d1a",
      },
      {
        tick: 9_601,
        focusDay: 3,
        simulationDigestSha256: "0b0248ec217dc440950dbbb9c490d4e6e1b0e1dc99816d05edfff308c202cc3b",
      },
      {
        tick: ADAPTIVE_TOTAL_STEPS,
        focusDay: 3,
        simulationDigestSha256: "5d8dc022d963f1c5eb16377671db4c1f1e4e5ed017bd598627c6c607a3e902f9",
      },
    ];
    let has_seen_health_condition = false;
    let has_seen_nutrition_intent = false;
    for (const checkpoint of checkpoints) {
      while (state.tick < checkpoint.tick) {
        state = stepSimulation(state);
        for (const customer of Object.values(state.customers)) {
          if (customer.healthConditions.length > 0) has_seen_health_condition = true;
          if (customer.nutritionIntentId !== undefined) has_seen_nutrition_intent = true;
        }
      }
      expect(state.progression.focusDay).toBe(checkpoint.focusDay);
      expect_checkpoint(state, `(f) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(has_seen_health_condition).toBe(true);
    expect(has_seen_nutrition_intent).toBe(true);
    expect(state.progression.level).toBeGreaterThanOrEqual(2);
    expect_scenario_end(state, "(f)", {
      stateDigestSha256: "dee0cfc5c79e2a68a058f614360b48ce274d5dfe67eedd5435ac56dc72792691",
      stepperStateSha256: "8b00e1724f7bc63262bf9f3b52230390e3f5b18c0f57f015cd1d397dabe4d8ca",
    });
  });
});
