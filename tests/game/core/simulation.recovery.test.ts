/**
 * Characterisation of the customer recovery branches inside one simulation step.
 *
 * Each case builds its start state straight from `fixtures/golden-inputs.json`: one
 * customer in a given status, with its target already gone from the state (a stall
 * closed, a seat or tray return deleted, or the guest walled into a pocket so its path
 * fails). No command runs first, so the case reaches the in-step recovery code rather
 * than the command reconciliation. One step later the test pins the customer's status,
 * the step's events in order, the recovered-target count, the stall queue and whether
 * `orderedDishId` survived.
 *
 * Guests that have not ordered yet still carry an `orderedDishId`, so every branch shows
 * whether it clears that field or keeps it. The values here are today's behaviour, not a
 * statement that it is right: fix the code, never the literal, if a refactor moves one.
 */
import { describe, expect, it } from "vitest";

import {
  createGridMap,
  createNewGame,
  dispatchCommand,
  stepSimulation,
  type Customer,
  type CustomerStatus,
  type GameState,
  type GridPoint,
  type PlacedObject,
  type SimulationCatalog,
  type SimulationConfigOverrides,
  type SimulationEvent,
  type StallUpgradeDefinition,
  type TileKind,
} from "@/src/game/core";
import raw_golden_inputs from "./fixtures/golden-inputs.json";

/** The parts of `fixtures/golden-inputs.json` that these cases start from. */
interface RecoveryInputs {
  readonly testCatalog: SimulationCatalog;
  readonly fixture: {
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
  };
}

/** What one recovery step left behind, gathered so each case makes one comparison. */
interface RecoveryOutcome {
  readonly status: CustomerStatus | "despawned";
  readonly events: readonly Pick<SimulationEvent, "type" | "entityId" | "message">[];
  readonly recoveredTargets: number;
  readonly despawnedCustomers: number;
  readonly stallQueue: readonly string[];
  readonly seatReservations: Readonly<Record<string, string>>;
  readonly targetStallId: string | undefined;
  readonly orderedDishId: string | undefined;
  readonly reservedSeatKey: string | undefined;
  readonly targetTrayReturnId: string | undefined;
}

/** One in-step recovery branch: how to build its start state and what one step does. */
interface RecoveryCase {
  readonly name: string;
  readonly buildState: () => GameState;
  readonly expected: RecoveryOutcome;
}

const GOLDEN_INPUTS = raw_golden_inputs as RecoveryInputs;

const CUSTOMER_ID = "customer-1";
const STALL_ID = "stall-1";
const SEAT_ID = "seat-1";
const SEAT_KEY = "seat-1:0";
const TRAY_ID = "tray-1";
const EXIT_ID = "exit-1";
const ORDERED_DISH_ID = "noodles";
const ORDERED_DISH_PRICE = 8;

/** Countdown that keeps the step from spawning a guest, so only the case's guest acts. */
const NO_SPAWN_COUNTDOWN_MS = 1_000_000;

/**
 * Stuck time one fixed step short of the fixture's `stuckRecoveryMs` of 1,000, so a
 * failed path request in the step counts as a failed move.
 */
const ONE_STEP_FROM_STUCK_MS = 900;

/** The bottom-left floor tile, walled in by {@link POCKET_WALLS} so no path leaves it. */
const POCKET_TILE: GridPoint = { x: 0, y: 7 };
const POCKET_WALLS: readonly GridPoint[] = [
  { x: 1, y: 7 },
  { x: 0, y: 6 },
];

/** Upgrade level 2 adds one queue slot, so the upgraded stall queues five guests. */
const QUEUE_UPGRADE_LEVELS: readonly StallUpgradeDefinition[] = [
  {
    level: 2,
    cost: 75,
    serviceTimeMultiplier: 0.9,
    capacityBonus: 1,
    qualityBonus: 0.05,
    menuSlotsBonus: 1,
  },
];
const UPGRADED_QUEUE_GUEST_COUNT = 5;
const UNRELATED_SEAT_ORIGIN: GridPoint = { x: 8, y: 2 };

function create_recovery_game(catalog: SimulationCatalog = GOLDEN_INPUTS.testCatalog): GameState {
  const fixture = GOLDEN_INPUTS.fixture;
  const state = createNewGame({
    map: createGridMap(fixture.map.width, fixture.map.height, {
      tileSize: fixture.map.tileSize,
      worldOrigin: fixture.map.worldOrigin,
    }),
    entrance: fixture.entrance,
    exit: fixture.exit,
    catalog,
    seed: fixture.seed,
    startingCurrency: fixture.startingCurrency,
    initialObjects: fixture.initialObjects,
    config: fixture.config,
  });
  return { ...state, spawnCountdownMs: NO_SPAWN_COUNTDOWN_MS };
}

/** A guest of the `regular` archetype standing on the entrance, with no target set. */
function build_customer(id: string, overrides: Partial<Customer>): Customer {
  const archetype = GOLDEN_INPUTS.testCatalog.archetypes.regular;
  if (archetype === undefined) {
    throw new Error("Expected the test catalog to define the regular archetype");
  }
  return {
    id,
    archetypeId: archetype.id,
    status: "choosing-stall",
    position: { ...GOLDEN_INPUTS.fixture.entrance },
    path: [],
    pathIndex: 0,
    movementProgress: 0,
    stateElapsedMs: 0,
    visitElapsedMs: 0,
    walkingDistanceTiles: 0,
    patienceRemainingMs: archetype.patienceMs,
    satisfaction: 3,
    healthConditions: [],
    sourceEntranceId: "entrance-1",
    hasTray: false,
    served: false,
    spent: 0,
    stuckMs: 0,
    ...overrides,
  };
}

/** A guest heading for stall-1 who has not ordered, but carries a stale ordered dish. */
function build_unserved_customer(
  status: CustomerStatus,
  overrides: Partial<Customer> = {},
): Customer {
  return build_customer(CUSTOMER_ID, {
    status,
    targetStallId: STALL_ID,
    orderedDishId: ORDERED_DISH_ID,
    ...overrides,
  });
}

/** A guest who has bought noodles at stall-1 and is carrying the tray. */
function build_served_customer(
  status: CustomerStatus,
  overrides: Partial<Customer> = {},
): Customer {
  return build_customer(CUSTOMER_ID, {
    status,
    servedStallDefinitionId: "stall",
    orderedDishId: ORDERED_DISH_ID,
    hasTray: true,
    served: true,
    spent: ORDERED_DISH_PRICE,
    ...overrides,
  });
}

function with_customer(
  state: GameState,
  customer: Customer,
  world: {
    readonly stallQueue?: readonly string[];
    readonly seatReservations?: Readonly<Record<string, string>>;
  } = {},
): GameState {
  return {
    ...state,
    customers: { [customer.id]: customer },
    queues: { ...state.queues, [STALL_ID]: world.stallQueue ?? [] },
    seatReservations: world.seatReservations ?? {},
    nextCustomerSequence: 2,
  };
}

function with_stall_closed(state: GameState): GameState {
  const stall = state.objects[STALL_ID];
  if (stall === undefined) throw new Error("Expected the fixture to place stall-1");
  return { ...state, objects: { ...state.objects, [STALL_ID]: { ...stall, open: false } } };
}

function without_object(state: GameState, object_id: string): GameState {
  const objects = { ...state.objects };
  delete objects[object_id];
  return { ...state, objects };
}

function with_walled_pocket(state: GameState): GameState {
  const tiles: TileKind[] = [...state.map.tiles];
  for (const wall of POCKET_WALLS) tiles[wall.y * state.map.width + wall.x] = "wall";
  return { ...state, map: { ...state.map, tiles } };
}

function summarize_step(state: GameState): RecoveryOutcome {
  const customer = state.customers[CUSTOMER_ID];
  return {
    status: customer?.status ?? "despawned",
    events: state.events.map((step_event) => ({
      type: step_event.type,
      entityId: step_event.entityId,
      message: step_event.message,
    })),
    recoveredTargets: state.metrics.recoveredTargets,
    despawnedCustomers: state.metrics.despawnedCustomers,
    stallQueue: state.queues[STALL_ID] ?? [],
    seatReservations: state.seatReservations,
    targetStallId: customer?.targetStallId,
    orderedDishId: customer?.orderedDishId,
    reservedSeatKey: customer?.reservedSeatKey,
    targetTrayReturnId: customer?.targetTrayReturnId,
  };
}

function recovered_event(message: string): Pick<SimulationEvent, "type" | "entityId" | "message"> {
  return { type: "target-recovered", entityId: CUSTOMER_ID, message };
}

function state_changed_event(
  from: CustomerStatus,
  to: CustomerStatus,
): Pick<SimulationEvent, "type" | "entityId" | "message"> {
  return { type: "customer-state-changed", entityId: CUSTOMER_ID, message: `${from} -> ${to}` };
}

/**
 * The fixture game with stall-1 at upgrade level 2 and five guests walking to its queue.
 *
 * Level 2 lifts the queue capacity from four to five, so the queue is full only by the
 * upgraded capacity.
 */
function create_upgraded_queue_game(): GameState {
  const placeables = GOLDEN_INPUTS.testCatalog.placeables;
  const stall_placeable = placeables.stall;
  const stall_definition = stall_placeable?.stall;
  if (stall_placeable === undefined || stall_definition === undefined) {
    throw new Error("Expected the test catalog to define the stall placeable");
  }
  const catalog: SimulationCatalog = {
    ...GOLDEN_INPUTS.testCatalog,
    placeables: {
      ...placeables,
      stall: {
        ...stall_placeable,
        stall: { ...stall_definition, upgradeLevels: QUEUE_UPGRADE_LEVELS },
      },
    },
  };
  const initial = create_recovery_game(catalog);
  const guest_ids = Array.from(
    { length: UPGRADED_QUEUE_GUEST_COUNT },
    (_, index) => `customer-${index + 1}`,
  );
  const customers = Object.fromEntries(
    guest_ids.map((id) => [
      id,
      build_customer(id, { status: "walking-to-queue", targetStallId: STALL_ID }),
    ]),
  );
  return {
    ...initial,
    progression: {
      ...initial.progression,
      stallMastery: { stall: { points: 100, rank: 2, upgradeLevel: 2 } },
    },
    customers,
    queues: { ...initial.queues, [STALL_ID]: guest_ids },
    nextCustomerSequence: UPGRADED_QUEUE_GUEST_COUNT + 1,
  };
}

const RECOVERY_CASES: readonly RecoveryCase[] = [
  {
    name: "walking-to-queue towards a closed stall",
    buildState: () =>
      with_customer(
        with_stall_closed(create_recovery_game()),
        build_unserved_customer("walking-to-queue"),
        { stallQueue: [CUSTOMER_ID] },
      ),
    expected: {
      status: "choosing-stall",
      events: [
        recovered_event("Stall unavailable while walking to queue"),
        state_changed_event("walking-to-queue", "choosing-stall"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: undefined,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "walking-to-queue without a place in the queue",
    buildState: () =>
      with_customer(create_recovery_game(), build_unserved_customer("walking-to-queue")),
    expected: {
      status: "choosing-stall",
      events: [
        recovered_event("Queue assignment disappeared"),
        state_changed_event("walking-to-queue", "choosing-stall"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "walking-to-queue from a walled-in tile",
    buildState: () =>
      with_customer(
        with_walled_pocket(create_recovery_game()),
        build_unserved_customer("walking-to-queue", {
          position: { ...POCKET_TILE },
          stuckMs: ONE_STEP_FROM_STUCK_MS,
        }),
        { stallQueue: [CUSTOMER_ID] },
      ),
    expected: {
      status: "choosing-stall",
      events: [
        recovered_event("Queue path became unreachable"),
        state_changed_event("walking-to-queue", "choosing-stall"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "queued at a closed stall",
    buildState: () =>
      with_customer(
        with_stall_closed(create_recovery_game()),
        build_unserved_customer("queued"),
        { stallQueue: [CUSTOMER_ID] },
      ),
    expected: {
      status: "choosing-stall",
      events: [
        recovered_event("Queue target was removed"),
        state_changed_event("queued", "choosing-stall"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "ordering at a closed stall",
    buildState: () =>
      with_customer(
        with_stall_closed(create_recovery_game()),
        build_unserved_customer("ordering"),
        { stallQueue: [CUSTOMER_ID] },
      ),
    expected: {
      status: "choosing-stall",
      events: [
        recovered_event("Stall closed during ordering"),
        state_changed_event("ordering", "choosing-stall"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "waiting-for-food at a closed stall",
    buildState: () =>
      with_customer(
        with_stall_closed(create_recovery_game()),
        build_unserved_customer("waiting-for-food"),
      ),
    expected: {
      status: "choosing-stall",
      events: [
        recovered_event("Order target disappeared during preparation"),
        state_changed_event("waiting-for-food", "choosing-stall"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: undefined,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "walking-to-seat after the seat was removed",
    buildState: () =>
      with_customer(
        without_object(create_recovery_game(), SEAT_ID),
        build_served_customer("walking-to-seat", { reservedSeatKey: SEAT_KEY }),
        { seatReservations: { [SEAT_KEY]: CUSTOMER_ID } },
      ),
    expected: {
      status: "seeking-seat",
      events: [
        recovered_event("Reserved seat was removed"),
        state_changed_event("walking-to-seat", "seeking-seat"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "walking-to-seat from a walled-in tile",
    buildState: () =>
      with_customer(
        with_walled_pocket(create_recovery_game()),
        build_served_customer("walking-to-seat", {
          position: { ...POCKET_TILE },
          reservedSeatKey: SEAT_KEY,
          stuckMs: ONE_STEP_FROM_STUCK_MS,
        }),
        { seatReservations: { [SEAT_KEY]: CUSTOMER_ID } },
      ),
    expected: {
      status: "seeking-seat",
      events: [
        recovered_event("Reserved seat became unreachable"),
        state_changed_event("walking-to-seat", "seeking-seat"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "eating after the seat was removed",
    buildState: () =>
      with_customer(
        without_object(create_recovery_game(), SEAT_ID),
        build_served_customer("eating", { reservedSeatKey: SEAT_KEY }),
        { seatReservations: { [SEAT_KEY]: CUSTOMER_ID } },
      ),
    expected: {
      status: "seeking-seat",
      events: [
        recovered_event("Seat was removed while eating"),
        state_changed_event("eating", "seeking-seat"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "walking-to-tray-return after the tray return was removed",
    buildState: () =>
      with_customer(
        without_object(create_recovery_game(), TRAY_ID),
        build_served_customer("walking-to-tray-return", { targetTrayReturnId: TRAY_ID }),
      ),
    expected: {
      status: "seeking-tray-return",
      events: [
        recovered_event("Tray-return target was removed"),
        state_changed_event("walking-to-tray-return", "seeking-tray-return"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "walking-to-tray-return from a walled-in tile",
    buildState: () =>
      with_customer(
        with_walled_pocket(create_recovery_game()),
        build_served_customer("walking-to-tray-return", {
          position: { ...POCKET_TILE },
          targetTrayReturnId: TRAY_ID,
          stuckMs: ONE_STEP_FROM_STUCK_MS,
        }),
      ),
    expected: {
      status: "walking-to-exit",
      events: [
        recovered_event("Tray-return target became unreachable"),
        state_changed_event("walking-to-tray-return", "walking-to-exit"),
      ],
      recoveredTargets: 1,
      despawnedCustomers: 0,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: ORDERED_DISH_ID,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
  {
    name: "walking-to-exit from a walled-in tile",
    buildState: () =>
      with_customer(
        with_walled_pocket(create_recovery_game()),
        build_served_customer("walking-to-exit", {
          position: { ...POCKET_TILE },
          hasTray: false,
          targetExitId: EXIT_ID,
          stuckMs: ONE_STEP_FROM_STUCK_MS,
        }),
      ),
    expected: {
      status: "despawned",
      events: [
        { type: "customer-despawned", entityId: CUSTOMER_ID, message: "forced-after-stuck" },
      ],
      recoveredTargets: 0,
      despawnedCustomers: 1,
      stallQueue: [],
      seatReservations: {},
      targetStallId: undefined,
      orderedDishId: undefined,
      reservedSeatKey: undefined,
      targetTrayReturnId: undefined,
    },
  },
];

describe("in-step customer recovery", () => {
  it.each(RECOVERY_CASES)("recovers a guest $name", ({ buildState, expected }) => {
    expect(summarize_step(stepSimulation(buildState()))).toEqual(expected);
  });
});

describe("upgraded stall queue after an unrelated build", () => {
  it("keeps all five guests queued while the layout is unchanged", () => {
    const stepped = stepSimulation(create_upgraded_queue_game());
    expect(stepped.queues[STALL_ID]).toEqual([
      "customer-1",
      "customer-2",
      "customer-3",
      "customer-4",
      "customer-5",
    ]);
  });

  it("known behaviour (TD-46): placing a seat trims the upgraded queue to base capacity", () => {
    const placed = dispatchCommand(create_upgraded_queue_game(), {
      type: "place-object",
      objectId: "unrelated-seat",
      definitionId: "seat",
      origin: UNRELATED_SEAT_ORIGIN,
    });
    const released = placed.state.customers["customer-5"];
    expect({
      isAccepted: placed.accepted,
      stallQueue: placed.state.queues[STALL_ID],
      releasedStatus: released?.status,
      releasedTargetStallId: released?.targetStallId,
      recoveredTargets: placed.state.metrics.recoveredTargets,
    }).toEqual({
      isAccepted: true,
      stallQueue: ["customer-1", "customer-2", "customer-3", "customer-4"],
      releasedStatus: "choosing-stall",
      releasedTargetStallId: undefined,
      recoveredTargets: 1,
    });
  });
});
