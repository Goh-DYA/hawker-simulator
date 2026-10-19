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
        simulationDigestSha256: "315744cdd775013144fdb0b50820788bc043cabf30a884e43ad76d4fd31f5646",
      },
      {
        tick: 600,
        simulationDigestSha256: "baf36cac967e3aa9db521a56e4e69b4e748384d5d7fe67acb8278557c214a421",
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
      "5ef7bc0ff311d1ef356581b96d28f28c9fbc891c482ac2bdde8d7983fb32b72f",
    );
    expect_scenario_end(state, "(a)", {
      stateDigestSha256: "cbfe6b95cb8f9e79d3203a7c9839df9825f34179f4ccfa1686c083d8318689c2",
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
      "3d1661f4b9b29eb369f7bdf3906aef22fabcd5f208cdfd239de7d2443d938a66",
    );

    const checkpoints = [
      {
        tick: 601,
        simulationDigestSha256: "86b7681f94e3e542e9b132b00b62ffe48fd5aed9df30ad5d4154fee70bf3ec10",
      },
      {
        tick: 1_201,
        simulationDigestSha256: "513ea0ab28d885077448839497d967aa51da1490d07015e043aa4ee03dbd70ba",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, EIGHTY_AGENT_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(b) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(1 + EIGHTY_AGENT_STEPS);
    expect_scenario_end(state, "(b)", {
      stateDigestSha256: "bdf4f53c1be853ee9e4b726179b92085edd024b528a5ed9050b0dce9b256dfff",
      stepperStateSha256: "2c45c82c6eef139e45f463df092b9b258b236e9781a20e6f8978ebf38be0976e",
    });
  });

  it("(c) advances lower-end mode with frames that drop fixed steps", () => {
    const checkpoints = [
      {
        cycle: 1,
        simulationDigestSha256: "b7dfbd7890280e61054fd139e97fb1d4dac2e4a58a0155c53dcf6a9ccee69557",
      },
      {
        cycle: 2,
        simulationDigestSha256: "d5b5c56efa6db7e3e2208d419110eba89e8fc267097a05df232677291335bfdd",
      },
      {
        cycle: 3,
        simulationDigestSha256: "d739bb7a655709238bb98f2e6e16b676cf21913e5ab01a04bd88abefbf7116a1",
      },
      {
        cycle: 4,
        simulationDigestSha256: "c9085bd0ae89ac891b8db67d32849019e1ce0a2b472d9b7b624b4a3524f59556",
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
      stateDigestSha256: "a82051d3887d2251a14560dabafa0c892d8f24f8c848f8248d95f20c6b62e767",
      stepperStateSha256: "b359badf24a4597d9b295f51e30f2638fdbe5b35a97131211cd6e56af1fb3dcf",
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
        simulationDigestSha256: "833b72b50537c3bf481857ff8cc8930c40a715fb801204e172e5950edc9c9ecb",
      },
      {
        tick: 600,
        simulationDigestSha256: "f555c2cc2ba293972bf34f7a5aa615935a8f2f2393bfbd8bce0392f9f6320054",
      },
      {
        tick: 900,
        simulationDigestSha256: "ca672c03a58b0addfbd4f1eb230e3e0d9b840a96e4e8d0fe24bab02ce9dca801",
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
      stateDigestSha256: "1d8c1022c0228a63b0e4f44d335a09ecfeaf269eec5d9a99680c0d74dea3dc15",
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
      "cd181d97b33e2eb809ac8a7aafee4b4fd5fed608169775429d2b0ba0baa94383",
    );

    const checkpoints = [
      {
        tick: 200,
        simulationDigestSha256: "f46b436eff4e7eb9663cbe558b3bbd83ae1a487810e02732ee43d44bdd80c5a8",
      },
      {
        tick: 350,
        simulationDigestSha256: "c6a132d5f2b4033e49a1da7d8e24b7b52157ddded5f1b8e28b62ca77d64f734d",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, COMMAND_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(e) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(COMMAND_WARMUP_STEPS + COMMAND_FOLLOW_UP_STEPS);
    expect_scenario_end(state, "(e)", {
      stateDigestSha256: "fd05759de43778afa722fd734ac86bcc8d3986271ae9ca94d03f94d8cf42e406",
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
        simulationDigestSha256: "4db3dc9108487815107ee6a159a3296098574ff4b2f50542b8aaf8ceaf726977",
      },
      {
        tick: 4_801,
        focusDay: 2,
        simulationDigestSha256: "45642d6408ab7db131992f2c6b88a52029fa5d54ab5ee6fc2b130638a9db8f84",
      },
      {
        tick: 9_599,
        focusDay: 2,
        simulationDigestSha256: "916a7a26610e8485d4eb01f0a4ab502f300be22e34543387c290434734f9e761",
      },
      {
        tick: 9_601,
        focusDay: 3,
        simulationDigestSha256: "62c81fa78773737217e82d271626f0ea7c1d86a71741bd661803304403ff4129",
      },
      {
        tick: ADAPTIVE_TOTAL_STEPS,
        focusDay: 3,
        simulationDigestSha256: "609301d0a30b2738d43af6abb6050da2cc49b694c703b0c18accbf7440141fbf",
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
      stateDigestSha256: "11b64b53f253f916dbda77ddc151d26f4ae9eebe5f3802ab468b85d9e72a7c08",
      stepperStateSha256: "d4635272dfc715102ecd49a5611c998c1091981a15b65303d744fb8bc2c296a2",
    });
  });
});
