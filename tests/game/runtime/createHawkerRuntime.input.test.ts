/**
 * Characterization of the pointer and keyboard input of `createHawkerRuntime`, run headless.
 *
 * The stub scene of `fixtures.ts` records the handlers that the runtime registers on its
 * input and keyboard plugins. This suite calls those recorded handlers directly, as Phaser
 * would, with `document.activeElement` inside the game host, and pins what each tool and
 * key does today: the place, remove, two-step move and rotate tools, queue extension,
 * shortening and the adjacency warning, the route toggle, access-point select, add and
 * move, camera drag, and the Escape, U, Space, arrow, Enter, plus, minus and wheel
 * controls.
 *
 * Each flow asserts the exact `onEvent` payload sequence and the sha256 of the raw
 * `JSON.stringify(exportState().core)` at its end, so the key order of the save is pinned
 * along with its values. Before the keyboard flow is snapshotted, it checks that every key
 * it drives changed something the player can see (the hover tile, speed, tool, zoom,
 * selection, the save or an event), so a handler that returns early cannot pass silently.
 *
 * Two tests record latent bugs (TD-46) as current behaviour: the access-point id counter
 * is not recomputed on import, so a new exit can collide with an imported `exit-3`, and
 * `reset()` keeps a pending move, so the first move-tool click after a reset moves an
 * object without the selection step.
 *
 * The literals change only in intentional behaviour commits. If a refactor makes one fail,
 * the refactor changed how input is handled: fix the code, never the literal or the
 * snapshot.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import type { GridPoint, PersistentGameStateV4, PlacedObject } from "@/src/game/core";
import type { RuntimeEvent, RuntimeSnapshot } from "@/src/game/runtime/types";
import {
  create_test_runtime,
  fake_parent,
  install_runtime_stubs,
  render_log,
  restore_runtime_stubs,
  StubElement,
  StubHTMLInputElement,
  type RuntimeScene,
  type TestRuntime,
} from "./fixtures";

vi.mock("phaser", async () => (await import("./fixtures")).PHASER_STUB_MODULE);

/** Frame delta of every stepped frame, as in `createHawkerRuntime.test.ts`. */
const FRAME_MS = 100;
/** Tile size of the runtime map, copied from `createHawkerRuntime.ts`. */
const TILE_SIZE_PX = 48;
/** Inset of the hover outline inside its tile, copied from `drawOverlay`. */
const HOVER_OUTLINE_INSET_PX = 3;
/** The overlay Graphics object, the second one the scene's `create()` adds. */
const OVERLAY_GRAPHICS_TAG = "graphics#1";
/** `lineStyle` arguments of the plain hover outline, drawn outside the place and route tools. */
const HOVER_OUTLINE_STYLE: readonly unknown[] = [2, 0xffffff, 0.9];
/** A pointer move further than the runtime's 6 px drag threshold. */
const DRAG_DISTANCE_PX = 40;
/** A pointer move within the runtime's 6 px drag threshold. */
const JITTER_DISTANCE_PX = 4;
/** Mouse-wheel delta of one notch; positive scrolls down, which zooms out. */
const WHEEL_NOTCH_DELTA = 100;
/** Wheel notches that are enough to reach either zoom limit from the initial zoom. */
const WHEEL_NOTCHES_TO_LIMIT = 15;
/** The camera zoom limits, copied from `createHawkerRuntime.ts`. */
const MIN_ZOOM = 0.48;
const MAX_ZOOM = 1.55;
/** Camera scroll after a {@link DRAG_DISTANCE_PX} drag to the right at the initial zoom. */
const DRAGGED_SCROLL_X = -51.28205128205128;

/** The cheapest starter table, unlocked in a fresh centre. */
const PLACE_ITEM_ID = "item.compact-square-table";
/** Ids that `starterObjects` gives the first stall and the first starter table. */
const FIRST_STALL_ID = "starter-1";
const STARTER_TABLE_ID = "starter-3";
const STARTER_TABLE_TILE: GridPoint = { x: 5, y: 8 };
/** A tile of the starter round table. */
const ROUND_TABLE_TILE: GridPoint = { x: 12, y: 9 };
/** Clear floor tiles of the fresh centre, away from stalls, queues and access points. */
const OPEN_FLOOR_TILE: GridPoint = { x: 17, y: 13 };
const SECOND_FLOOR_TILE: GridPoint = { x: 17, y: 11 };
/** Where two right arrows and a down arrow take the cursor from its initial tile (6, 6). */
const KEYBOARD_PLACE_TILE: GridPoint = { x: 8, y: 7 };
/** A corner wall tile, never a valid route tile. */
const CORNER_WALL_TILE: GridPoint = { x: 0, y: 0 };
/** The fresh centre's entrance and exit, and clear boundary tiles to move or add them to. */
const ENTRANCE_TILE: GridPoint = { x: 0, y: 7 };
const EXIT_TILE: GridPoint = { x: 23, y: 7 };
const ENTRANCE_DESTINATION_TILE: GridPoint = { x: 0, y: 10 };
const NEW_EXIT_TILE: GridPoint = { x: 23, y: 10 };
const SECOND_EXIT_TILE: GridPoint = { x: 23, y: 4 };

/** The first stall's queue anchor, and a queue path that bends away from it. */
const QUEUE_ANCHOR_TILE: GridPoint = { x: 3, y: 4 };
const QUEUE_EXTENSION_TILES: readonly GridPoint[] = [
  { x: 3, y: 5 },
  { x: 3, y: 6 },
  { x: 2, y: 6 },
];
const QUEUE_TAIL_TILE: GridPoint = { x: 2, y: 6 };
const QUEUE_SECOND_TILE: GridPoint = { x: 3, y: 5 };
const QUEUE_NON_ADJACENT_TILE: GridPoint = { x: 4, y: 7 };

/** The guest that the Escape key deselects, the first one a run spawns. */
const FIRST_GUEST_ID = "customer-1";
/** Guests spawned for the departure-order flow, and the guest that is selected. */
const DEPARTURE_SPAWN_COUNT = 8;
const DEPARTURE_GUEST_ID = "customer-3";
/** The frame in which the selected guest leaves, and a ceiling for the search. */
const DEPARTURE_FRAME = 1_019;
const DEPARTURE_FRAME_LIMIT = 1_500;
/** Every event of the departure run, from opening to the departure frame. */
const DEPARTURE_RUN_EVENT_COUNT = 20;
const DEPARTURE_RUN_EVENTS_SHA256 =
  "2e18177d7a3a8cfe6f51f631797af6d6efb1d6fd0cca8349577ac15c0c30843e";
/** The departure run steps about 1,200 frames, so it gets the multi-day run's allowance. */
const DEPARTURE_TIMEOUT_MS = 60_000;
const DEPARTURE_MESSAGE = "The selected guest finished their visit.";

/** The keys of the keyboard flow, in order. Each one must change something visible. */
const KEYBOARD_FLOW_KEYS: readonly string[] = [
  "Escape",
  "ArrowLeft",
  "ArrowDown",
  "ArrowDown",
  "Enter",
  "R",
  "u",
  "U",
  "Escape",
  " ",
  " ",
  "+",
  "=",
  "-",
  "_",
  "ArrowRight",
  "ArrowUp",
  "ArrowUp",
  "ArrowUp",
  "ArrowUp",
  "ArrowUp",
  "ArrowUp",
  "ArrowUp",
  "ArrowUp",
];
/** Up-arrow presses that take the cursor from its initial row 6 to the top row. */
const ARROW_PRESSES_TO_TOP_ROW = 6;
/** Further up-arrow presses that the edge test expects the cursor to clamp. */
const EDGE_EXTRA_PRESSES = 2;

/** sha256 of `JSON.stringify(exportState().core)` at the end of each flow. */
const FLOW_CORE_SHA256 = {
  fresh: "d33ede22bd0e100ab932a34d4f9e49918840989713da8067ce88b5d9a40c239f",
  place: "847b517b67ec481032833fbc06aaaab142fc690bb6215df789decd1a54e33b16",
  remove: "6c08688dbd890924174a19bfdcfdaa30d2cb2e8ea77d30457608ad336606fdd2",
  move: "da07fc5121268ba073ce7e27ac5e7936e628be8ddbc807f49429a79220393c80",
  queue: "f9692502aca1e3b63a3033657662c58cf7ab389863e2b3cf48032d3d352ccbe3",
  access: "ee6ea40e1ad467f302f22ae99dca59fd4d3c47695c2cea269b0943593e9ee8f9",
  accessCollision: "75f4e52be08db52637bff54681b1c153737c91c525239eedcfc0947eab78eaba",
  departure: "40ea4a905671238f2581257235dbe3e99f6b5a5450cc1d3f3e80d3879844abf0",
  keyboard: "f5eb1edc9563a606e64f334a8542d483febf0dd1819777ea6c877162ca10d890",
  keyboardPlace: "30de23f2943cb40c5e9a7003ee7b2e6fdd72198075185aba6a5ea26543dc1237",
} as const;

/** The event every accepted placement reports. */
const PLACED_EVENT: RuntimeEvent = {
  kind: "info",
  message: "Placed. You can undo or keep building.",
};

/**
 * @param message - The core's rejection message.
 * @returns The event the runtime reports for a rejected command.
 */
function error_event(message: string): RuntimeEvent {
  return { kind: "error", message, importance: "important" };
}

/** A pointer as the runtime's input handlers read it. */
interface StubPointer {
  readonly x: number;
  readonly y: number;
  readonly isDown: boolean;
}

/** A keydown event as the runtime's keyboard handler reads it. */
interface StubKeyboardEvent {
  readonly key: string;
  readonly target: unknown;
  preventDefault(): void;
}

/** The player-visible state that the keyboard flow compares between keys. */
interface VisibleState {
  readonly hoverTile: GridPoint | undefined;
  readonly buildTool: string;
  readonly speed: number;
  readonly zoom: number;
  readonly selectedObjectId: string | undefined;
  readonly selectedCustomerId: string | undefined;
  readonly cameraCentreCount: number;
  readonly coreSha256: string;
}

/** What one key press did, as the keyboard flow records it. */
interface KeyObservation extends VisibleState {
  readonly key: string;
  readonly isDefaultPrevented: boolean;
  readonly renderCount: number;
  readonly newEvents: readonly RuntimeEvent[];
}

function hash_sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function export_core(runtime: TestRuntime): PersistentGameStateV4 {
  return (runtime.controller.exportState() as { core: PersistentGameStateV4 }).core;
}

function hash_core(runtime: TestRuntime): string {
  return hash_sha256(JSON.stringify(export_core(runtime)));
}

/**
 * @param runtime - The runtime under test.
 * @param object_id - A placed object id.
 * @returns That object in the exported core, or `undefined` once it is gone.
 */
function find_object(runtime: TestRuntime, object_id: string): PlacedObject | undefined {
  return export_core(runtime).objects.find((object) => object.id === object_id);
}

/**
 * @param runtime - The runtime under test.
 * @returns The runtime's latest snapshot.
 * @throws Error If it has not emitted one yet.
 */
function last_snapshot(runtime: TestRuntime): RuntimeSnapshot {
  const snapshot = runtime.snapshots.at(-1);
  if (snapshot === undefined) throw new Error("The runtime has not emitted a snapshot");
  return snapshot;
}

/**
 * Build a pointer over the centre of `tile`, inverting the stub camera's world mapping.
 *
 * @param scene - The booted scene.
 * @param tile - The tile to point at.
 * @param is_down - Whether the primary button is held.
 * @returns The pointer.
 */
function pointer_at_tile(scene: RuntimeScene, tile: GridPoint, is_down: boolean): StubPointer {
  const camera = scene.cameras.main;
  return {
    x: ((tile.x + 0.5) * TILE_SIZE_PX - camera.scrollX) * camera.zoom,
    y: ((tile.y + 0.5) * TILE_SIZE_PX - camera.scrollY) * camera.zoom,
    isDown: is_down,
  };
}

/**
 * Press and release the primary button over `tile` without moving, which the runtime
 * treats as a tile click.
 *
 * @param scene - The booted scene.
 * @param tile - The tile to click.
 */
function click_tile(scene: RuntimeScene, tile: GridPoint): void {
  scene.input.emit("pointerdown", pointer_at_tile(scene, tile, true));
  scene.input.emit("pointerup", pointer_at_tile(scene, tile, false));
}

/**
 * Fire the recorded keydown handler.
 *
 * @param scene - The booted scene.
 * @param key - The `KeyboardEvent.key` value.
 * @param target - The event target; the game host by default.
 * @returns Whether the handler called `preventDefault()`.
 */
function press_key(scene: RuntimeScene, key: string, target: unknown = fake_parent()): boolean {
  let is_default_prevented = false;
  const event: StubKeyboardEvent = {
    key,
    target,
    preventDefault() {
      is_default_prevented = true;
    },
  };
  scene.input.keyboard.emit("keydown", event);
  return is_default_prevented;
}

/**
 * Fire the recorded wheel handler with a vertical delta.
 *
 * @param scene - The booted scene.
 * @param delta_y - The wheel's vertical delta.
 */
function spin_wheel(scene: RuntimeScene, delta_y: number): void {
  scene.input.emit("wheel", pointer_at_tile(scene, OPEN_FLOOR_TILE, false), [], 0, delta_y);
}

/**
 * Reads the hover tile from the overlay draw calls. Outside the place and route tools,
 * The overlay outlines the hover tile with a white `strokeRoundedRect`, so the tile is the
 * last such outline drawn. The probe replaces `render_log.record` while it is installed,
 * so nothing is hashed meanwhile; this suite records no render digests.
 */
class HoverProbe {
  private readonly spy: MockInstance<typeof render_log.record>;
  private isAfterHoverStyle = false;
  private hoverTile: GridPoint | undefined;
  private renderCount = 0;

  constructor() {
    this.spy = vi.spyOn(render_log, "record").mockImplementation((target, method, args) => {
      this.observe_call(target, method, args);
    });
  }

  /**
   * @returns The hover tile of the latest overlay render since {@link HoverProbe.forget},
   * or `undefined` if none has outlined one.
   */
  read_hover_tile(): GridPoint | undefined {
    return this.hoverTile;
  }

  /**
   * @returns How many renders cleared the overlay since {@link HoverProbe.forget}.
   */
  read_render_count(): number {
    return this.renderCount;
  }

  /** Forget the hover tile, the render count and the spy's recorded calls. */
  forget(): void {
    this.hoverTile = undefined;
    this.renderCount = 0;
    this.spy.mockClear();
  }

  /** Put the real `render_log.record` back. */
  restore(): void {
    this.spy.mockRestore();
  }

  private observe_call(target: string, method: string, args: readonly unknown[]): void {
    if (target !== OVERLAY_GRAPHICS_TAG) return;
    if (method === "clear") this.renderCount += 1;
    if (method === "strokeRoundedRect" && this.isAfterHoverStyle) {
      const [x, y] = args as readonly number[];
      this.hoverTile = {
        x: (x - HOVER_OUTLINE_INSET_PX) / TILE_SIZE_PX,
        y: (y - HOVER_OUTLINE_INSET_PX) / TILE_SIZE_PX,
      };
    }
    this.isAfterHoverStyle =
      method === "lineStyle" &&
      args.length === HOVER_OUTLINE_STYLE.length &&
      args.every((value, index) => value === HOVER_OUTLINE_STYLE[index]);
  }
}

/**
 * @param runtime - A booted runtime.
 * @param hover_tile - The hover tile last drawn.
 * @returns The player-visible state now.
 */
function read_visible_state(runtime: TestRuntime, hover_tile: GridPoint | undefined): VisibleState {
  const camera = runtime.game.require_booted_scene().cameras.main;
  const snapshot = last_snapshot(runtime);
  return {
    hoverTile: hover_tile,
    buildTool: snapshot.buildTool,
    speed: snapshot.speed,
    zoom: camera.zoom,
    selectedObjectId: snapshot.selectedObjectId,
    selectedCustomerId: snapshot.selectedCustomerId,
    cameraCentreCount: camera.calls.filter((call) => call.method === "centerOn").length,
    coreSha256: hash_core(runtime),
  };
}

/**
 * Press `key` and record what it did.
 *
 * @param runtime - A booted runtime.
 * @param probe - The hover probe of the test.
 * @param key - The `KeyboardEvent.key` value.
 * @returns The observation after the key.
 */
function observe_key(runtime: TestRuntime, probe: HoverProbe, key: string): KeyObservation {
  const scene = runtime.game.require_booted_scene();
  const events_before = runtime.events.length;
  probe.forget();
  const is_default_prevented = press_key(scene, key);
  return {
    key,
    isDefaultPrevented: is_default_prevented,
    renderCount: probe.read_render_count(),
    ...read_visible_state(runtime, probe.read_hover_tile()),
    newEvents: runtime.events.slice(events_before),
  };
}

/**
 * @param previous - The visible state before a key.
 * @param observation - What the key did.
 * @returns Whether the key changed the visible state or reported an event.
 */
function has_visible_change(previous: VisibleState, observation: KeyObservation): boolean {
  const next: VisibleState = {
    hoverTile: observation.hoverTile,
    buildTool: observation.buildTool,
    speed: observation.speed,
    zoom: observation.zoom,
    selectedObjectId: observation.selectedObjectId,
    selectedCustomerId: observation.selectedCustomerId,
    cameraCentreCount: observation.cameraCentreCount,
    coreSha256: observation.coreSha256,
  };
  return observation.newEvents.length > 0 || JSON.stringify(previous) !== JSON.stringify(next);
}

/**
 * @returns A booted fresh centre and its scene.
 */
async function create_booted_runtime(): Promise<{ runtime: TestRuntime; scene: RuntimeScene }> {
  const runtime = await create_test_runtime();
  const scene = runtime.boot();
  return { runtime, scene };
}

beforeEach(() => {
  install_runtime_stubs();
});

afterEach(() => {
  restore_runtime_stubs();
});

describe("createHawkerRuntime pointer input", () => {
  it("(1) boots the fresh centre that every flow starts from", async () => {
    const { runtime } = await create_booted_runtime();

    expect({ events: runtime.events, core: hash_core(runtime) }).toEqual({
      events: [],
      core: FLOW_CORE_SHA256.fresh,
    });
  });

  it("(2) places with the place tool, rotates the next placement with R and rejects an occupied tile", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.selectBuildItem(PLACE_ITEM_ID);

    click_tile(scene, OPEN_FLOOR_TILE);
    press_key(scene, "r");
    click_tile(scene, SECOND_FLOOR_TILE);
    click_tile(scene, STARTER_TABLE_TILE);

    expect({
      events: runtime.events,
      placed: export_core(runtime)
        .objects.filter((object) => object.id.startsWith("placed-"))
        .map((object) => [object.id, object.origin, object.rotation]),
      core: hash_core(runtime),
    }).toEqual({
      events: [PLACED_EVENT, PLACED_EVENT, error_event("Tile 5,8 overlaps another object")],
      placed: [
        ["placed-15", OPEN_FLOOR_TILE, 0],
        ["placed-16", SECOND_FLOOR_TILE, 90],
      ],
      core: FLOW_CORE_SHA256.place,
    });
  });

  it("(3) removes the clicked object with the remove tool and ignores empty floor", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.setBuildTool("remove");

    click_tile(scene, OPEN_FLOOR_TILE);
    click_tile(scene, STARTER_TABLE_TILE);

    expect({
      events: runtime.events,
      table: find_object(runtime, STARTER_TABLE_ID),
      core: hash_core(runtime),
    }).toEqual({
      events: [],
      table: undefined,
      core: FLOW_CORE_SHA256.remove,
    });
  });

  // The HUD snapshot trails the move tool by one command: picking the object up emits no
  // snapshot, and a successful move emits its snapshot before the selection is cleared.
  it("(4) moves in two steps and keeps the pending object after a rejected destination", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.setBuildTool("move");
    const selected_ids: (string | undefined)[] = [];

    for (const tile of [OPEN_FLOOR_TILE, STARTER_TABLE_TILE, ROUND_TABLE_TILE, OPEN_FLOOR_TILE]) {
      click_tile(scene, tile);
      selected_ids.push(last_snapshot(runtime).selectedObjectId);
    }

    expect({
      events: runtime.events,
      selectedIds: selected_ids,
      table: find_object(runtime, STARTER_TABLE_ID)?.origin,
      core: hash_core(runtime),
    }).toEqual({
      events: [
        { kind: "info", message: "Choose a clear destination tile." },
        error_event("Tile 12,9 overlaps another object"),
      ],
      selectedIds: [undefined, undefined, STARTER_TABLE_ID, STARTER_TABLE_ID],
      table: OPEN_FLOOR_TILE,
      core: FLOW_CORE_SHA256.move,
    });
  });

  it("(5) rotates the clicked object with R, undoes it with U, then reports nothing to undo", async () => {
    const { runtime, scene } = await create_booted_runtime();

    click_tile(scene, STARTER_TABLE_TILE);
    const selected_id = last_snapshot(runtime).selectedObjectId;
    press_key(scene, "r");
    const rotated = find_object(runtime, STARTER_TABLE_ID)?.rotation;
    press_key(scene, "u");
    const undone = find_object(runtime, STARTER_TABLE_ID)?.rotation;
    press_key(scene, "u");

    expect({
      events: runtime.events,
      selectedId: selected_id,
      rotations: [rotated, undone],
      core: hash_core(runtime),
    }).toEqual({
      events: [error_event("There is no build action to undo")],
      selectedId: STARTER_TABLE_ID,
      rotations: [90, 0],
      core: FLOW_CORE_SHA256.fresh,
    });
  });

  it("(6) extends, warns about a gap, ignores the tail and shortens in the queue tool", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.beginQueueEdit(FIRST_STALL_ID);

    click_tile(scene, QUEUE_NON_ADJACENT_TILE);
    for (const tile of QUEUE_EXTENSION_TILES) click_tile(scene, tile);
    const extended_path = find_object(runtime, FIRST_STALL_ID)?.queuePath;
    click_tile(scene, QUEUE_TAIL_TILE);
    click_tile(scene, QUEUE_SECOND_TILE);
    click_tile(scene, QUEUE_ANCHOR_TILE);

    expect({
      events: runtime.events,
      extendedPath: extended_path,
      finalPath: find_object(runtime, FIRST_STALL_ID)?.queuePath,
      tool: last_snapshot(runtime).buildTool,
      core: hash_core(runtime),
    }).toEqual({
      events: [
        { kind: "info", message: "Choose adjacent clear tiles to shape this stall's queue." },
        { kind: "warning", message: "Add queue spaces one adjacent tile at a time." },
        { kind: "info", message: "Queue now bends through 2 spaces." },
        { kind: "info", message: "Queue now bends through 3 spaces." },
        { kind: "info", message: "Queue now bends through 4 spaces." },
        { kind: "info", message: "Queue shortened to 2 spaces." },
        { kind: "info", message: "Queue shortened to 1 spaces." },
      ],
      extendedPath: [QUEUE_ANCHOR_TILE, ...QUEUE_EXTENSION_TILES],
      finalPath: [QUEUE_ANCHOR_TILE],
      tool: "queue",
      core: FLOW_CORE_SHA256.queue,
    });
  });

  it("(7) toggles a route tile, rejects a wall and restores the speed after the route tool", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.setBuildTool("route");
    const paused_speed = last_snapshot(runtime).speed;

    click_tile(scene, OPEN_FLOOR_TILE);
    const added_points = last_snapshot(runtime).routeGuidePoints;
    click_tile(scene, OPEN_FLOOR_TILE);
    click_tile(scene, CORNER_WALL_TILE);
    runtime.controller.setBuildTool("select");

    expect({
      events: runtime.events,
      pausedSpeed: paused_speed,
      addedPoints: added_points,
      finalPoints: last_snapshot(runtime).routeGuidePoints,
      restoredSpeed: last_snapshot(runtime).speed,
      core: hash_core(runtime),
    }).toEqual({
      events: [
        {
          kind: "info",
          message: "Added preferred route tile 17,13. Guests will favour this aisle.",
        },
        { kind: "info", message: "Removed preferred route tile 17,13." },
        error_event("Preferred route tile 0,0 must be a floor tile inside the map"),
      ],
      pausedSpeed: 0,
      addedPoints: [OPEN_FLOOR_TILE],
      finalPoints: [],
      restoredSpeed: 1,
      core: FLOW_CORE_SHA256.fresh,
    });
  });

  // Adding an exit emits its HUD snapshot before the new exit is selected, so the last
  // snapshot shows no selected access point although `exit-3` is selected.
  it("(8) selects and moves the entrance, then adds an exit, with the access tool", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.setBuildTool("access");

    click_tile(scene, OPEN_FLOOR_TILE);
    click_tile(scene, ENTRANCE_TILE);
    const selected_id = last_snapshot(runtime).selectedAccessPointId;
    click_tile(scene, ENTRANCE_DESTINATION_TILE);
    runtime.controller.addAccessPoint("exit");
    click_tile(scene, NEW_EXIT_TILE);

    expect({
      events: runtime.events,
      selectedIds: [selected_id, last_snapshot(runtime).selectedAccessPointId],
      accessPoints: last_snapshot(runtime).accessPoints,
      core: hash_core(runtime),
    }).toEqual({
      events: [
        {
          kind: "info",
          message: "Choose Add entrance or Add exit, or select an existing access point.",
        },
        { kind: "info", message: "Entrance selected. Choose a boundary tile to move it." },
        { kind: "info", message: "Choose a clear boundary tile for the new exit." },
      ],
      selectedIds: ["entrance-1", undefined],
      accessPoints: [
        { id: "entrance-1", kind: "entrance", position: ENTRANCE_DESTINATION_TILE },
        { id: "exit-1", kind: "exit", position: EXIT_TILE },
        { id: "exit-3", kind: "exit", position: NEW_EXIT_TILE },
      ],
      core: FLOW_CORE_SHA256.access,
    });
  });

  // The access id counter starts at the loaded access-point count plus one, and
  // importState does not recompute it, so after importing a save that holds `exit-3` the
  // next exit is also given `exit-3` and the core rejects it.
  it("(9) known behaviour (TD-46): rejects a new exit whose id collides with an imported exit-3", async () => {
    const source = await create_booted_runtime();
    source.runtime.controller.addAccessPoint("exit");
    click_tile(source.scene, NEW_EXIT_TILE);
    const save = JSON.parse(JSON.stringify(source.runtime.controller.exportState())) as unknown;
    const { runtime, scene } = await create_booted_runtime();

    runtime.controller.importState(save);
    runtime.controller.addAccessPoint("exit");
    click_tile(scene, SECOND_EXIT_TILE);

    expect({
      events: runtime.events,
      accessIds: last_snapshot(runtime).accessPoints.map((point) => point.id),
      core: hash_core(runtime),
    }).toEqual({
      events: [
        { kind: "info", message: "Choose a clear boundary tile for the new exit." },
        error_event("Access point id already exists"),
      ],
      accessIds: ["entrance-1", "exit-1", "exit-3"],
      core: FLOW_CORE_SHA256.accessCollision,
    });
  });

  // reset() returns to the select tool without clearing the pending move, and choosing the
  // move tool again keeps it, so the first click after a reset moves the fresh centre's
  // object with the same id straight away, without "Choose a clear destination tile."
  it("(10) known behaviour (TD-46): keeps a pending move across reset()", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.setBuildTool("move");
    click_tile(scene, STARTER_TABLE_TILE);

    runtime.controller.reset();
    const events_before_click = runtime.events.length;
    runtime.controller.setBuildTool("move");
    click_tile(scene, OPEN_FLOOR_TILE);

    expect({
      events: runtime.events,
      eventsAfterReset: runtime.events.slice(events_before_click),
      table: find_object(runtime, STARTER_TABLE_ID)?.origin,
      core: hash_core(runtime),
    }).toEqual({
      events: [{ kind: "info", message: "Choose a clear destination tile." }],
      eventsAfterReset: [],
      table: OPEN_FLOOR_TILE,
      core: FLOW_CORE_SHA256.move,
    });
  });

  it(
    "(11) reports the selected guest's departure before the frame's simulation events",
    async () => {
      const { runtime } = await create_booted_runtime();
      runtime.controller.toggleOpen();
      for (let spawn = 0; spawn < DEPARTURE_SPAWN_COUNT; spawn += 1) {
        runtime.controller.spawnCustomer();
      }
      runtime.controller.selectCustomer(DEPARTURE_GUEST_ID);
      const selected_id = last_snapshot(runtime).selectedCustomerId;

      let departure_frame: number | undefined;
      let departure_events: readonly RuntimeEvent[] = [];
      for (let frame = 1; frame <= DEPARTURE_FRAME_LIMIT; frame += 1) {
        const events_before = runtime.events.length;
        runtime.step_frame(FRAME_MS);
        const frame_events = runtime.events.slice(events_before);
        if (frame_events.some((event) => event.message === DEPARTURE_MESSAGE)) {
          departure_frame = frame;
          departure_events = frame_events;
          break;
        }
      }

      expect({
        selectedId: selected_id,
        departureFrame: departure_frame,
        departureEvents: departure_events,
        eventCount: runtime.events.length,
        eventsSha256: hash_sha256(JSON.stringify(runtime.events)),
        core: hash_core(runtime),
      }).toEqual({
        selectedId: DEPARTURE_GUEST_ID,
        departureFrame: DEPARTURE_FRAME,
        departureEvents: [
          { kind: "info", message: DEPARTURE_MESSAGE },
          {
            kind: "success",
            message: "New catalogue choices are now available.",
            importance: "important",
          },
        ],
        eventCount: DEPARTURE_RUN_EVENT_COUNT,
        eventsSha256: DEPARTURE_RUN_EVENTS_SHA256,
        core: FLOW_CORE_SHA256.departure,
      });
    },
    DEPARTURE_TIMEOUT_MS,
  );

  it("(12) pans on a drag past the threshold without a click, and clicks after a small jitter", async () => {
    const { runtime, scene } = await create_booted_runtime();
    const camera = scene.cameras.main;
    const drag_start = pointer_at_tile(scene, STARTER_TABLE_TILE, true);

    scene.input.emit("pointerdown", drag_start);
    scene.input.emit("pointermove", { ...drag_start, x: drag_start.x + DRAG_DISTANCE_PX });
    scene.input.emit("pointerup", {
      ...drag_start,
      x: drag_start.x + DRAG_DISTANCE_PX,
      isDown: false,
    });
    const after_drag = {
      scroll: [camera.scrollX, camera.scrollY],
      selectedObjectId: last_snapshot(runtime).selectedObjectId,
    };
    const jitter_start = pointer_at_tile(scene, STARTER_TABLE_TILE, true);
    scene.input.emit("pointerdown", jitter_start);
    scene.input.emit("pointermove", { ...jitter_start, x: jitter_start.x + JITTER_DISTANCE_PX });
    scene.input.emit("pointerup", { ...jitter_start, isDown: false });

    expect({
      afterDrag: after_drag,
      afterJitter: {
        scroll: [camera.scrollX, camera.scrollY],
        selectedObjectId: last_snapshot(runtime).selectedObjectId,
      },
      focusCount: fake_parent().focusCount,
      events: runtime.events,
      core: hash_core(runtime),
    }).toEqual({
      afterDrag: { scroll: [DRAGGED_SCROLL_X, 0], selectedObjectId: undefined },
      afterJitter: { scroll: [DRAGGED_SCROLL_X, 0], selectedObjectId: STARTER_TABLE_ID },
      focusCount: 2,
      events: [],
      core: FLOW_CORE_SHA256.fresh,
    });
  });

  it("(13) zooms by 0.08 per wheel notch between the zoom limits", async () => {
    const { scene } = await create_booted_runtime();
    const camera = scene.cameras.main;
    const zooms: number[] = [];

    for (const delta of [WHEEL_NOTCH_DELTA, -WHEEL_NOTCH_DELTA, -WHEEL_NOTCH_DELTA, 0]) {
      spin_wheel(scene, delta);
      zooms.push(camera.zoom);
    }
    for (let notch = 0; notch < WHEEL_NOTCHES_TO_LIMIT; notch += 1) {
      spin_wheel(scene, -WHEEL_NOTCH_DELTA);
    }
    const zoomed_in = camera.zoom;
    for (let notch = 0; notch < 2 * WHEEL_NOTCHES_TO_LIMIT; notch += 1) {
      spin_wheel(scene, WHEEL_NOTCH_DELTA);
    }

    expect({ zooms, limits: [zoomed_in, camera.zoom] }).toEqual({
      zooms: [0.7000000000000001, 0.78, 0.86, 0.86],
      limits: [MAX_ZOOM, MIN_ZOOM],
    });
  });
});

describe("createHawkerRuntime keyboard input", () => {
  let probe: HoverProbe | undefined;

  afterEach(() => {
    probe?.restore();
    probe = undefined;
  });

  it("(14) changes something visible on every key of the select-tool flow", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.toggleOpen();
    runtime.controller.spawnCustomer();
    runtime.controller.selectCustomer(FIRST_GUEST_ID);
    probe = new HoverProbe();
    press_key(scene, "x");
    let previous = read_visible_state(runtime, probe.read_hover_tile());
    const start_customer_id = previous.selectedCustomerId;
    const flow_events_start = runtime.events.length;

    const observations: KeyObservation[] = [];
    const unchanged_keys: string[] = [];
    for (const [index, key] of KEYBOARD_FLOW_KEYS.entries()) {
      const observation = observe_key(runtime, probe, key);
      if (!has_visible_change(previous, observation)) unchanged_keys.push(`${index}:${key}`);
      observations.push(observation);
      previous = observation;
    }

    expect(unchanged_keys).toEqual([]);
    expect(observations).toMatchSnapshot();
    expect({
      startCustomerId: start_customer_id,
      events: runtime.events,
      flowEvents: runtime.events.slice(flow_events_start),
      core: hash_core(runtime),
    }).toEqual({
      startCustomerId: FIRST_GUEST_ID,
      events: [
        { kind: "info", message: "Shutters up — the lunch crowd is arriving." },
        error_event("There is no build action to undo"),
      ],
      flowEvents: [error_event("There is no build action to undo")],
      core: FLOW_CORE_SHA256.keyboard,
    });
  });

  it("(15) places at the keyboard cursor with Enter in the place tool", async () => {
    const { runtime, scene } = await create_booted_runtime();
    runtime.controller.selectBuildItem(PLACE_ITEM_ID);

    for (const key of ["ArrowRight", "ArrowRight", "ArrowDown", "r", "Enter"]) {
      press_key(scene, key);
    }

    expect({
      events: runtime.events,
      placed: export_core(runtime)
        .objects.filter((object) => object.id.startsWith("placed-"))
        .map((object) => [object.id, object.origin, object.rotation]),
      core: hash_core(runtime),
    }).toEqual({
      events: [PLACED_EVENT],
      placed: [["placed-15", KEYBOARD_PLACE_TILE, 90]],
      core: FLOW_CORE_SHA256.keyboardPlace,
    });
  });

  it("(16) clamps the cursor at the map edge but still prevents scrolling and redraws", async () => {
    const { runtime, scene } = await create_booted_runtime();
    const edge_probe = new HoverProbe();
    probe = edge_probe;
    for (let press = 0; press < ARROW_PRESSES_TO_TOP_ROW; press += 1) {
      press_key(scene, "ArrowUp");
    }

    const extra = Array.from({ length: EDGE_EXTRA_PRESSES }, () =>
      observe_key(runtime, edge_probe, "ArrowUp"),
    );

    expect(
      extra.map((observation) => [
        observation.isDefaultPrevented,
        observation.renderCount,
        observation.hoverTile,
      ]),
    ).toEqual([
      [true, 1, { x: 6, y: 0 }],
      [true, 1, { x: 6, y: 0 }],
    ]);
  });

  it("(17) ignores keys from a form field or while focus is outside the game", async () => {
    const { runtime, scene } = await create_booted_runtime();
    probe = new HoverProbe();
    const before = read_visible_state(runtime, undefined);

    const from_field = press_key(scene, "ArrowLeft", new StubHTMLInputElement());
    vi.stubGlobal("document", { activeElement: new StubElement() });
    const from_outside = press_key(scene, " ");

    expect({
      prevented: [from_field, from_outside],
      renderCount: probe.read_render_count(),
      state: read_visible_state(runtime, undefined),
    }).toEqual({
      prevented: [false, false],
      renderCount: 0,
      state: before,
    });
  });
});
