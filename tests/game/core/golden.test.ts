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
        simulationDigestSha256: "60fa48bac81393028109b882370b2ad62e6b3e601e1605b4c76c939fb0b32156",
      },
      {
        tick: 600,
        simulationDigestSha256: "56fe777ccd34e3def77ff8e6d59e2343138160eb25f1f7efe4c02672551e7e40",
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
      "e5a6d57c2b5817e7c193a48994c9a4cec761dbe5021caa1ff2672176c634cf43",
    );
    expect_scenario_end(state, "(a)", {
      stateDigestSha256: "782cffb0af3535ee9294892bb00132cbc182099649528fe68b3de3ba74643227",
      stepperStateSha256: "ecb2d075af4e0a0213967f291df170bf8c9232db9b7afcf411be901a0b11b4a9",
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
        simulationDigestSha256: "523de05a0eefa3b3810cc71c23a37ba3c278ffe08bc41cca1a0d9cd5df4aca84",
      },
      {
        tick: 1_201,
        simulationDigestSha256: "9b15c1feba5b9ccd0c3c875b58c636b651cfd0a1cf7ade50d5ec9ec527698503",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, EIGHTY_AGENT_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(b) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(1 + EIGHTY_AGENT_STEPS);
    expect_scenario_end(state, "(b)", {
      stateDigestSha256: "63d500688a5805a4caa9533e775f622ae719adb3e6ed37100ee36f88e9e3469e",
      stepperStateSha256: "2c45c82c6eef139e45f463df092b9b258b236e9781a20e6f8978ebf38be0976e",
    });
  });

  it("(c) advances lower-end mode with frames that drop fixed steps", () => {
    const checkpoints = [
      {
        cycle: 1,
        simulationDigestSha256: "a0306427badd3574045770ac340170e1e6804dc41a699968acc8c3b09a98a378",
      },
      {
        cycle: 2,
        simulationDigestSha256: "c0a86a19fc8e0eb886ad168f5b606900a8df5ed4ee16b90e3e21c41a1ab352e7",
      },
      {
        cycle: 3,
        simulationDigestSha256: "994be322181090682f1dc57e5f601382b840fd4881d780450c59c541bc3fa43d",
      },
      {
        cycle: 4,
        simulationDigestSha256: "07a9f067ebff14d2cdea46ff44b226a7c1884dc70d6cb353d1c5238265a71ef4",
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
      stateDigestSha256: "17c83fdd4c1b39e1e20d6c95ffed0b940bc8d6d0b8715ed627adc3a8aae6b76e",
      stepperStateSha256: "8819b23ed0746ecb0ffbcf4e25a8c7b83128af52ec566766db22cd5ddcab2bf0",
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
        simulationDigestSha256: "dee07fe6cfb9975423aacf0c6d28bb5e08e839592ca2748601863609adc8d122",
      },
      {
        tick: 600,
        simulationDigestSha256: "fe44a4fafc50e3bac5d46b9fc858254625a002fdd5a91774b93332d2ef8c94a4",
      },
      {
        tick: 900,
        simulationDigestSha256: "81750326ab559b48a54b694f0aea19fcda68204eee9842c63d8f4f3d1ad8ad28",
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
      stateDigestSha256: "44af94ff2a4411c96de0aa357cfccfb20c0f41a4771cc53537c5c71473fb1a96",
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
      "b75e0ca3935b317f73f58fe046775293a0d866b86caeb7b641d4cf20f83786d6",
    );

    const checkpoints = [
      {
        tick: 200,
        simulationDigestSha256: "5404fe899347819d5eefa14ce8fe065cb5ea1a4467f229974f638df4e8e1e852",
      },
      {
        tick: 350,
        simulationDigestSha256: "37adfcd86f6d9d20585eb7e7d4c276bc065bd237b06f64ac35a74123d80f25cc",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, COMMAND_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(e) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(COMMAND_WARMUP_STEPS + COMMAND_FOLLOW_UP_STEPS);
    expect_scenario_end(state, "(e)", {
      stateDigestSha256: "4e3be0c73df419ce6d28f16cadd18dda4b93d65087a02ad91bdb8c30ec9fc9bc",
      stepperStateSha256: "6c859945fa1cb267754351b6b879de27447ad3a649f02483908b16ff74dd04b3",
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
        simulationDigestSha256: "0fc6f493ffd2380d855cd44dbbf933722dc6d0431f5c3e54b41348a23b0b38e7",
      },
      {
        tick: 4_801,
        focusDay: 2,
        simulationDigestSha256: "a5c20319e254a824601591044b975e1e2a849433ee7fbb0c7f0a5e71e5b23741",
      },
      {
        tick: 9_599,
        focusDay: 2,
        simulationDigestSha256: "0e7b49335033af7e1b8539b0ce0b66b83400b9602a679bebbca357c43b1cd1df",
      },
      {
        tick: 9_601,
        focusDay: 3,
        simulationDigestSha256: "754f94bfa50c5a4c27209c5ae92b2b872443abe313c7f1cc3c30b25b88a783a6",
      },
      {
        tick: ADAPTIVE_TOTAL_STEPS,
        focusDay: 3,
        simulationDigestSha256: "73236fed71cd08fc44ea4e39c0613b0ddd716779e7f2b022c4d25575fe4668e4",
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
      stateDigestSha256: "7137e0584f0f83f07c46275d1d759c9dbdc016eb3fb39d847fdd04d54e0ab1bc",
      stepperStateSha256: "cc9453a5c3402a6755bb15420fd5262ce454aa5ce4a8f961be16bdeafd18770b",
    });
  });
});
