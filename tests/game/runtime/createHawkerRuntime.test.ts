/**
 * Contract tests for `createHawkerRuntime` and its `RuntimeController`, run headless.
 *
 * Phaser is replaced by the deferred-boot stub of `fixtures.ts`, and `performance.now()`
 * by the test-owned clock, so the real-content runtime runs in Node with deterministic
 * frame timing. The suite pins the real-content bootstrap, the save envelope, the
 * save-candidate fallback, import, export and reset, controller calls made before the
 * scene exists, and multi-day frame stepping.
 *
 * The sha256 literals hash the raw `JSON.stringify` output of `exportState()`, so the key
 * order of the save is pinned along with its values. They change only in intentional
 * behaviour or balance commits. If a refactor makes one fail, the refactor changed
 * behaviour: fix the code, never the literal or the snapshot.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PLACEABLES, STALLS } from "@/src/content";
import type { PersistentGameStateV4 } from "@/src/game/core";
import type { RuntimePersistentState } from "@/src/game/runtime/createHawkerRuntime";
import { expect_console_warning } from "@/tests/console";
import {
  create_test_runtime,
  install_runtime_stubs,
  restore_runtime_stubs,
  test_clock,
  type TestRuntime,
} from "./fixtures";

vi.mock("phaser", async () => (await import("./fixtures")).PHASER_STUB_MODULE);

/** Frame delta of every stepped frame: ten frames per simulated second at speed 1. */
const FRAME_MS = 100;

/** sha256 of `JSON.stringify(exportState())` for a fresh centre. */
const FRESH_EXPORT_SHA256 = "7cca83c996b543bb91acc47d32ce57fc75a8e2581dd15d2e184e84f581db003f";
/**
 * sha256 of `JSON.stringify(exportState())` after importing the fresh centre's save. It
 * differs from {@link FRESH_EXPORT_SHA256} only in key order: loading a save rebuilds each
 * daily objective, which moves `progress` and `completed` (and `nutritionCriterion`) to
 * later positions.
 */
const REIMPORTED_FRESH_EXPORT_SHA256 =
  "16f2ef10773e9e3abf6bab4a064d0c26a833f02d1e941cef3f9d6c6ced128497";

const OPEN_RUN_FRAMES = 600;
/** sha256 of `JSON.stringify(exportState().core)` after each frame count, at speed 1. */
const OPEN_RUN_CORE_SHA256: Readonly<Record<number, string>> = {
  100: "5abeabfe8a19544dd0cbea9a015a84f762292a27bdac1527761c293152907f2d",
  300: "fd2d793ff9b2d9eb6e8454fe53f38d045be607640ea627514bbf8883d04bef63",
  600: "3302e66b20dd928d2e8df281f86bf712838ec8b4d666f9d1a7c96ed5680951db",
};

/** Speed 10 turns each 100 ms frame into one simulated second, so a day is 480 frames. */
const MULTI_DAY_SPEED = 10;
const MULTI_DAY_FRAMES = 1_100;
/**
 * The multi-day run renders and simulates 11,000 steps, about 6 s on a laptop, so it gets
 * more than the suite's 15 s default to stay green on a slower or busier machine.
 */
const MULTI_DAY_TIMEOUT_MS = 60_000;
/** Checkpoints around the end of the first and second operating days. */
const MULTI_DAY_CORE_SHA256: Readonly<Record<number, string>> = {
  480: "22f87203712d408f97f374b7a82439c4fa9a0a9ae5f6756dba205c35405964e4",
  500: "b536c93688eb96404820f27b9ef1439e6dfbfc8e870123f4bf3b757d2e2fac67",
  960: "ec209f40cfb2cd84aac9e30b330f854a9234375e8887f6df935922ab854f6de7",
  1_000: "cbaf2b65bae71f10c1ec5f0ef63a7ed4827798ae7b13447bda7e0054c2c8489e",
};

/**
 * Per-call clock offsets for the pressure run. While the centre is open, each scene update
 * reads `performance.now()` four times, in this order (createHawkerRuntime.ts at 06ac46f):
 *
 * 1. line 1619, the frame time (`now`);
 * 2. line 1623, the start of the simulation span (`startedAt`);
 * 3. line 1639, the end of the span, so `lastSimulationMs` is call 3 minus call 2;
 * 4. line 1321, the HUD throttle in `emitHud`.
 *
 * The offsets make the span read {@link PRESSURE_SIMULATION_SPAN_MS}, and the next update
 * turns that into an arrival performance pressure of (12 - 8) / 16 = 0.25. This call order
 * is part of the contract: a refactor that moves these reads changes the pressure run.
 */
const PRESSURE_SIMULATION_SPAN_MS = 12;
const PRESSURE_CALL_OFFSETS_MS: readonly number[] = [0, 0, PRESSURE_SIMULATION_SPAN_MS];
/** sha256 of `JSON.stringify(exportState().core)` after the pressure run. */
const PRESSURE_RUN_CORE_SHA256 = "268470fbac7b2a7c9b04db1bca35d1336446ad43ecda0d163d36deb38bf393f0";

const IMPORT_RUN_FRAMES = 300;
const RESET_RUN_FRAMES = 50;
const VALID_SAVE_CASH_BONUS = 250;
/** Length of the truncated JSON string that stands in for a damaged core save. */
const DAMAGED_CORE_LENGTH = 64;

/** The fields of the runtime save envelope, in written order. */
const PERSISTED_FIELDS: readonly string[] = [
  "runtimeSchemaVersion",
  "core",
  "stallMenus",
  "nutritionDataVersion",
  "activeDishVariants",
];

const LEVEL_UP_MESSAGE = "Centre level increased — new catalogue entries unlocked.";
const CATALOGUE_UNLOCK_MESSAGE = "New catalogue choices are now available.";
const BACKUP_RESTORED_MESSAGE = "The newest save was damaged; the automatic backup was restored.";
const NEW_CENTRE_MESSAGE =
  "The previous save was recovered as a new centre: Save data is not valid JSON";
const RECIPE_RESET_MESSAGE = "One or more saved recipe choices were reset to reviewed defaults.";
/** Console log of the discarded first save candidate, with the core error that rejected it. */
const DISCARDED_CANDIDATE_LOG_FIRST =
  /^\[runtime\] discarded save candidate 0 .*Save data is not valid JSON/;
/** Console log of the final load error when no save candidate could be loaded. */
const NEW_CENTRE_LOG = /^\[runtime\] save recovered as new centre .*Save data is not valid JSON/;

/**
 * Definitions that only the runtime's unlock reconcile can unlock: the catalog gives them
 * an unreachable core unlock level because they need reputation or prerequisites.
 */
const RECONCILE_ONLY_IDS: ReadonlySet<string> = new Set(
  [...PLACEABLES, ...STALLS]
    .filter(
      (definition) =>
        definition.unlockRequirement.reputation > 0 ||
        definition.unlockRequirement.prerequisiteIds.length > 0,
    )
    .map((definition) => definition.id),
);

function hash_sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function export_payload(runtime: TestRuntime): RuntimePersistentState {
  return runtime.controller.exportState() as RuntimePersistentState;
}

/**
 * Export the save as storage would hand it back: through JSON, so `undefined` fields are
 * dropped. Compare these with `toEqual`, which ignores key order; the raw-string hashes
 * pin the order.
 */
function export_stored(runtime: TestRuntime): unknown {
  return JSON.parse(JSON.stringify(runtime.controller.exportState())) as unknown;
}

function export_core(runtime: TestRuntime): PersistentGameStateV4 {
  return export_payload(runtime).core as PersistentGameStateV4;
}

function hash_core(runtime: TestRuntime): string {
  return hash_sha256(JSON.stringify(export_payload(runtime).core));
}

/**
 * Step `frame_count` frames and hash the exported core after each checkpoint frame.
 *
 * @param runtime - A booted runtime.
 * @param frame_count - Frames to step.
 * @param checkpoint_frames - Frame numbers, counted from 1, after which to hash.
 * @returns The core hash at each checkpoint frame.
 */
function run_frames(
  runtime: TestRuntime,
  frame_count: number,
  checkpoint_frames: readonly number[] = [],
): Record<number, string> {
  const hashes: Record<number, string> = {};
  for (let frame = 1; frame <= frame_count; frame += 1) {
    runtime.step_frame(FRAME_MS);
    if (checkpoint_frames.includes(frame)) hashes[frame] = hash_core(runtime);
  }
  return hashes;
}

/**
 * @returns A booted fresh centre with its starter stalls open.
 */
async function create_open_runtime(): Promise<TestRuntime> {
  const runtime = await create_test_runtime();
  runtime.boot();
  runtime.controller.toggleOpen();
  return runtime;
}

/**
 * @returns A valid save that differs from a fresh centre only in cash.
 */
async function create_valid_save(): Promise<RuntimePersistentState> {
  const runtime = await create_test_runtime();
  runtime.controller.addCash(VALID_SAVE_CASH_BONUS);
  return export_stored(runtime) as RuntimePersistentState;
}

function collect_event_messages(runtime: TestRuntime): readonly string[] {
  return runtime.events.map((event) => event.message);
}

beforeEach(() => {
  install_runtime_stubs();
});

afterEach(() => {
  restore_runtime_stubs();
});

describe("createHawkerRuntime", () => {
  it("(1) exports a fresh centre built from the real content", async () => {
    const runtime = await create_test_runtime();
    const raw_export = JSON.stringify(runtime.controller.exportState());

    expect(hash_sha256(raw_export)).toBe(FRESH_EXPORT_SHA256);
    expect(JSON.parse(raw_export)).toMatchSnapshot();
  });

  it("(2) accepts controller calls before boot and shows the imported state after boot", async () => {
    const runtime = await create_test_runtime();
    const fresh_save = export_stored(runtime);

    let is_opened: boolean | undefined;
    expect(() => {
      runtime.controller.setQuality("lower-end");
      runtime.controller.zoomBy(1);
      is_opened = runtime.controller.toggleOpen();
      runtime.controller.importState(fresh_save);
    }).not.toThrow();
    const scene = runtime.boot();

    // The import replaces the opened, lower-end state, the pre-boot zoom is dropped
    // because no scene exists yet, and the frame-rate cap reaches the game loop.
    expect({
      opened: is_opened,
      save: export_stored(runtime),
      fpsLimits: runtime.game.loop.fpsLimits,
      zoom: scene.cameras.main.zoom,
      isOpen: runtime.snapshots.at(-1)?.isOpen,
      quality: runtime.snapshots.at(-1)?.quality,
    }).toEqual({
      opened: true,
      save: fresh_save,
      fpsLimits: [30],
      zoom: 0.78,
      isOpen: false,
      quality: "standard",
    });
  });

  it("(3) steps an open centre for 600 frames of 100 ms", async () => {
    const runtime = await create_open_runtime();

    const hashes = run_frames(runtime, OPEN_RUN_FRAMES, [100, 300, 600]);

    expect(hashes).toEqual(OPEN_RUN_CORE_SHA256);
  });

  it("(4) steps at speed 10 past two operating days, levelling up and reconciling unlocks", async () => {
    const runtime = await create_open_runtime();
    const fresh_unlocks = new Set(export_core(runtime).progression.unlockedDefinitionIds);
    runtime.controller.setSpeed(MULTI_DAY_SPEED);

    const hashes = run_frames(runtime, MULTI_DAY_FRAMES, [480, 500, 960, 1_000]);
    const reconciled_ids = export_core(runtime).progression.unlockedDefinitionIds.filter(
      (id) => RECONCILE_ONLY_IDS.has(id) && !fresh_unlocks.has(id),
    );

    expect(hashes).toEqual(MULTI_DAY_CORE_SHA256);
    expect(collect_event_messages(runtime)).toContain(LEVEL_UP_MESSAGE);
    expect(collect_event_messages(runtime)).toContain(CATALOGUE_UNLOCK_MESSAGE);
    expect(reconciled_ids.length).toBeGreaterThan(0);
  }, MULTI_DAY_TIMEOUT_MS);

  it("(5) diverges from the 0 ms run when the simulation span reads 12 ms", async () => {
    const runtime = await create_open_runtime();
    test_clock.script_frame_calls(PRESSURE_CALL_OFFSETS_MS);

    run_frames(runtime, OPEN_RUN_FRAMES);
    const pressure_hash = hash_core(runtime);

    expect(runtime.snapshots.at(-1)?.simulationMs).toBe(PRESSURE_SIMULATION_SPAN_MS);
    expect(pressure_hash).not.toBe(OPEN_RUN_CORE_SHA256[OPEN_RUN_FRAMES]);
    expect(pressure_hash).toBe(PRESSURE_RUN_CORE_SHA256);
  });

  it("(6a) imports a different save in place of the current state", async () => {
    const runtime = await create_open_runtime();
    run_frames(runtime, IMPORT_RUN_FRAMES);
    const save_a = export_stored(runtime);
    runtime.controller.reset();
    const save_b = export_stored(runtime);

    runtime.controller.importState(save_a);
    const after_import = export_stored(runtime);

    expect(save_a).not.toEqual(save_b);
    expect(after_import).toEqual(save_a);
    expect(after_import).not.toEqual(save_b);
  });

  it("(6b) re-exports an imported save in the loader's key order", async () => {
    const runtime = await create_test_runtime();

    runtime.controller.importState(export_stored(runtime));

    expect(hash_sha256(JSON.stringify(runtime.controller.exportState()))).toBe(
      REIMPORTED_FRESH_EXPORT_SHA256,
    );
  });

  it("(7a) restores the backup when the newest save candidate is damaged", async () => {
    const valid_save = await create_valid_save();
    const damaged_save = {
      ...valid_save,
      core: JSON.stringify(valid_save.core).slice(0, DAMAGED_CORE_LENGTH),
    };

    expect_console_warning(DISCARDED_CANDIDATE_LOG_FIRST);

    const runtime = await create_test_runtime([damaged_save, valid_save]);

    expect(collect_event_messages(runtime)).toEqual([BACKUP_RESTORED_MESSAGE]);
    expect(export_stored(runtime)).toEqual(valid_save);
  });

  it("(7b) starts a new centre when the only save candidate is damaged", async () => {
    const valid_save = await create_valid_save();
    const damaged_save = {
      ...valid_save,
      core: JSON.stringify(valid_save.core).slice(0, DAMAGED_CORE_LENGTH),
    };

    expect_console_warning(DISCARDED_CANDIDATE_LOG_FIRST);
    expect_console_warning(NEW_CENTRE_LOG);

    const runtime = await create_test_runtime([damaged_save]);

    expect(collect_event_messages(runtime)).toEqual([NEW_CENTRE_MESSAGE]);
    expect(hash_sha256(JSON.stringify(runtime.controller.exportState()))).toBe(
      FRESH_EXPORT_SHA256,
    );
  });

  // A runtime V1 envelope predates recipe choices, so it carries none to reset and loads
  // silently. The recipe-reset warning comes from a V2 envelope that lacks
  // `activeDishVariants` or `nutritionDataVersion`, or whose data version is outdated.
  it("(8a) loads a runtime V1 envelope without a recipe reset", async () => {
    const valid_save = await create_valid_save();
    const v1_envelope = {
      runtimeSchemaVersion: 1,
      core: valid_save.core,
      stallMenus: valid_save.stallMenus,
    };

    const runtime = await create_test_runtime([v1_envelope]);

    expect(collect_event_messages(runtime)).toEqual([]);
  });

  it("(8b) resets recipe choices from a runtime V2 envelope without nutrition fields", async () => {
    const valid_save = await create_valid_save();
    const incomplete_v2_envelope = {
      runtimeSchemaVersion: 2,
      core: valid_save.core,
      stallMenus: valid_save.stallMenus,
    };

    const runtime = await create_test_runtime([incomplete_v2_envelope]);

    expect(collect_event_messages(runtime)).toEqual([RECIPE_RESET_MESSAGE]);
  });

  it("(9) emits the fresh payload on reset", async () => {
    const runtime = await create_open_runtime();
    run_frames(runtime, RESET_RUN_FRAMES);

    runtime.controller.reset();

    expect(hash_sha256(JSON.stringify(runtime.saves.at(-1)))).toBe(FRESH_EXPORT_SHA256);
  });

  it("(10) reports the last runtime snapshot of an open run", async () => {
    const runtime = await create_open_runtime();
    run_frames(runtime, OPEN_RUN_FRAMES);

    expect(runtime.snapshots.at(-1)).toMatchSnapshot({
      fps: expect.any(Number),
      simulationMs: expect.any(Number),
    });
  });

  it("(11) persists exactly the five runtime envelope fields", async () => {
    const runtime = await create_test_runtime();

    expect(Object.keys(export_payload(runtime))).toEqual(PERSISTED_FIELDS);
  });
});
