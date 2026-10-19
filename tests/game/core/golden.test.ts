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
        simulationDigestSha256: "ad2d0d02f44df1561a74c8bff6556666e798c5392c456911340e3d62eb19f4dd",
      },
      {
        tick: 600,
        simulationDigestSha256: "c2ed27ca5b69c7e3e05cb3993233b4ff097fcf5df546e39b9cd4f9f97909ac20",
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
      "b4ba75887f51befbfcd66945e6b4ea8b9e39c54ff9a863eeb56f2a85edaf3ca5",
    );
    expect_scenario_end(state, "(a)", {
      stateDigestSha256: "9d8b8f7fc5518d4de1f818bce83d5fc25406aae0349bc24d23c4ae0ddd4bf82e",
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
        simulationDigestSha256: "2c43b0068c7b1fecdef5db97bda6c5782792d1e3544c53dc4a7bd4f2b8eb2644",
      },
      {
        tick: 1_201,
        simulationDigestSha256: "eabd42eb6942cc2d29b0cf8d9f94b7d6729cb4f8f04ce55190e0841ebcb6aefc",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, EIGHTY_AGENT_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(b) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(1 + EIGHTY_AGENT_STEPS);
    expect_scenario_end(state, "(b)", {
      stateDigestSha256: "bacdb552954e76eb61322461de4420178fa730393cbc0fa576c83738047b99be",
      stepperStateSha256: "2c45c82c6eef139e45f463df092b9b258b236e9781a20e6f8978ebf38be0976e",
    });
  });

  it("(c) advances lower-end mode with frames that drop fixed steps", () => {
    const checkpoints = [
      {
        cycle: 1,
        simulationDigestSha256: "80a58bbab983f31f022625bff1547bc5647d290bcdc57cc25e62ba96f15a9ba4",
      },
      {
        cycle: 2,
        simulationDigestSha256: "8a8b32d242cd392ca178d8fddc4172f554b8a3489068ba34e3c1403b1cc63071",
      },
      {
        cycle: 3,
        simulationDigestSha256: "130e82d75f402dac7923e4ec64e55ebfa01696afc4d9830cbc3aa46006550886",
      },
      {
        cycle: 4,
        simulationDigestSha256: "d544a3f050c1377ec5cf58a9b2e97f897d7b47be40e855b7b4bafcc1dfbebf80",
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
      stateDigestSha256: "1736183e8eb25f783fdeb888837adc286f2ecd4e22ad8c9384a1ed3b99ebf350",
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
        simulationDigestSha256: "9e8a936fe05026273a3f5dbe2046f2a4a59d033accc12d87a0100055098b6b68",
      },
      {
        tick: 600,
        simulationDigestSha256: "47ea4cbfa89c7af59e7bd9093b5ba2f0c1f3b256ed895081b8c2f08720aab5a1",
      },
      {
        tick: 900,
        simulationDigestSha256: "5d4b5726f09b1879abca759368756076b01af4fc0fad5e6bf34bacf0a6d8ec63",
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
      stateDigestSha256: "8c6ca6a3f56175eb1d3f3d2f6bbf57c0369748a507bc49c333521ac924659d48",
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
      "af1f74765cd1b7b0929a0047fbac63c785f1f31ae9faef09d0177b7e16e2705f",
    );

    const checkpoints = [
      {
        tick: 200,
        simulationDigestSha256: "0787fadc75537efe5234b65e1e18fbc7b2112bedb97ab3cf2c35ee57b61ae7eb",
      },
      {
        tick: 350,
        simulationDigestSha256: "9afaf14c6f92effaa7ee9eb59bae3ebd39a289aaecd12e6cd9ccab832dfbdab2",
      },
    ];
    for (const checkpoint of checkpoints) {
      state = run_steps(state, COMMAND_CHECKPOINT_STEPS);
      expect(state.tick).toBe(checkpoint.tick);
      expect_checkpoint(state, `(e) tick ${checkpoint.tick}`, checkpoint.simulationDigestSha256);
    }
    expect(state.tick).toBe(COMMAND_WARMUP_STEPS + COMMAND_FOLLOW_UP_STEPS);
    expect_scenario_end(state, "(e)", {
      stateDigestSha256: "391d5398eed62875bec940a114c9650552245b4db61e639b8bae942f77c5b187",
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
        simulationDigestSha256: "aaf1556a6b46e0143d43c58b3508f854617cb27ddb8555970cefca86b8c94c95",
      },
      {
        tick: 4_801,
        focusDay: 2,
        simulationDigestSha256: "15608303e8bb131f1fce88931ddca168b393257b9d161d2320671e6512539285",
      },
      {
        tick: 9_599,
        focusDay: 2,
        simulationDigestSha256: "6eccdd77c595aa180d042cfefcf443ebc41761aec1a041215f3a70d54c8d573a",
      },
      {
        tick: 9_601,
        focusDay: 3,
        simulationDigestSha256: "10c2e4c2abc210eb86bc067975a513bad5f87049f71d87dfae0770a910586d1d",
      },
      {
        tick: ADAPTIVE_TOTAL_STEPS,
        focusDay: 3,
        simulationDigestSha256: "001ed6c5cb93a65796b70a343cad2e7bee6e40f68aaf97417bfcd6fca2a15250",
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
      stateDigestSha256: "01797d754bc1c9eadbede964b3fceb4c28c0a638bf62fd1bc72e3b2ad3e8e21e",
      stepperStateSha256: "cc9453a5c3402a6755bb15420fd5262ce454aa5ce4a8f961be16bdeafd18770b",
    });
  });
});
