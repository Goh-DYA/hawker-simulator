/**
 * Draw-call characterization of `createHawkerRuntime`, run headless.
 *
 * The stub scene of `fixtures.ts` records every Graphics, Image, Text, texture and painter
 * canvas-context call in order, with each number at 15 significant digits, into `render_log`.
 * Retained sprites record only the setters that change, and a texture is painted once, so a
 * scenario's count covers what it newly paints and moves. Each scenario records one stretch of
 * calls and pins it with a call count and a sha256 literal, and snapshots the labels left
 * on screen at the end (x, y, colour and text). Together they prove that moving draw code
 * out of the runtime closure keeps the drawn output identical: a swapped captured
 * variable, a reordered call or changed float arithmetic moves the digest.
 *
 * `fixtures/gallery-save.json` was generated once from 06ac46f with this harness: a fresh
 * export raised to level 14 with 5 reputation, every definition unlocked and every stall
 * at mastery rank 7, then four map expansions and one of each STALLS and PLACEABLES entry
 * placed through the place tool, scanning rows for the first tile with a clear one-tile
 * margin. Each stall's menu lists its variant-family dishes first, so every reviewed
 * nutrition variant can show on a counter. A save holds one active variant per dish, so
 * scenario (9b) selects every variant in turn.
 *
 * The literals change only in intentional visual commits. If a refactor makes one fail,
 * the refactor changed what is drawn: fix the code, never the literal or the snapshot.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NUTRITION_CONTENT } from "@/src/content";
import type { GridPoint } from "@/src/game/core";
import {
  create_test_runtime,
  format_render_value,
  install_runtime_stubs,
  render_log,
  restore_runtime_stubs,
  type RenderLogDigest,
  type RuntimeScene,
  type TestRuntime,
} from "./fixtures";

vi.mock("phaser", async () => (await import("./fixtures")).PHASER_STUB_MODULE);

/** Frame delta of every stepped frame, as in `createHawkerRuntime.test.ts`. */
const FRAME_MS = 100;
/** Tile size of the runtime map, copied from `createHawkerRuntime.ts`. */
const TILE_SIZE_PX = 48;

const BUSY_SPAWN_COUNT = 20;
const BUSY_FRAME_COUNT = 50;
/** The first guest of a run; customer ids count up from 1. */
const FIRST_GUEST_ID = "customer-1";

/** Scenario (4) of `createHawkerRuntime.test.ts`: speed 10 turns a day into 480 frames. */
const MULTI_DAY_SPEED = 10;
const MULTI_DAY_RECORDED_FRAMES: readonly number[] = [480, 960];
/** The multi-day run steps 960 frames, so it gets the same allowance as the S14 suite. */
const MULTI_DAY_TIMEOUT_MS = 60_000;
/** Cycling the gallery through every variant draws the full gallery 50 times. */
const GALLERY_VARIANT_TIMEOUT_MS = 60_000;

/** The cheapest starter table, unlocked in a fresh centre. */
const PLACE_PREVIEW_ID = "item.compact-square-table";
/** A clear floor tile of the fresh centre, away from stalls, queues and access points. */
const OPEN_FLOOR_TILE: GridPoint = { x: 17, y: 13 };
/** The tile of the fresh centre's first starter table. */
const STARTER_TABLE_TILE: GridPoint = { x: 5, y: 8 };

/** Call count and sha256 of each scenario's draw-call log. */
const RENDER_DIGESTS = {
  fresh: {
    calls: 154_949,
    sha256: "c16c44f9d7b4a2b7f2a5f0d3d37babdf57b78d6e5c696fe1ad5046769b585b07",
  },
  busy: {
    calls: 416_425,
    sha256: "274c9aaab4ddd8edb1a82ffd683040a0305779298260a2d56d504738894f19b1",
  },
  highContrast: {
    calls: 527_650,
    sha256: "7f786a87b3b8d8625b9cf447f8df92646367655346d3ab69740d6e244fb42c8d",
  },
  reducedMotion: {
    calls: 205,
    sha256: "a06e05c43935620c66f50db0f4c836a609542fc4de26fe5aa004f89baa8fee63",
  },
  lowerEnd: {
    calls: 335_585,
    sha256: "790d5c0429bbcfce207bd181eba44df92e65714185a971dc3bba3e31b89648f1",
  },
  debugOverlay: {
    calls: 372,
    sha256: "bad4474ea5a7a292979b534749fb4cd37d123ef329ba982692206edf91302e5f",
  },
  placeValid: {
    calls: 6,
    sha256: "79d873aef759da89ac0ca1e01f8d44ebe30f2727f206d076f2f422f593307e0f",
  },
  placeInvalid: {
    calls: 11,
    sha256: "a3eb7c3606f73997919795ec58b55bc377a82ed8eb21efabbbe0fb3b9f26b698",
  },
  routeValid: {
    calls: 5,
    sha256: "19ea99a7b9dc148bc3ed1caab5e32b52e7f44651630a7743e50730f8881120e5",
  },
  routeInvalid: {
    calls: 5,
    sha256: "918f2bd8a8e7bdd0a3479fc441f66ef3c970dcffd1e8fa5570b9c50bbcba7806",
  },
  gallery: {
    calls: 768_269,
    sha256: "8c7ac2c1b974aea891e37f523fa27158cec786a319d9bb635e288e7bb38497ee",
  },
  galleryVariants: {
    calls: 60_314,
    sha256: "260ec5214d29b54e2cee3f407aa8c9539a9e5d09a1c3e9e04f2181405aa1a045",
  },
  multiDayFrame480: {
    calls: 180,
    sha256: "384aece87b30e8e37a0f1652b96437f7cb9fc4015833f105f8719d072b371ce8",
  },
  multiDayFrame960: {
    calls: 199,
    sha256: "3830566c7826b30b318a9bc03c0cd9cf020eb9f76779db9a7ab80f4adc62eb75",
  },
} satisfies Record<string, RenderLogDigest>;

/** A pointer as the runtime's input handlers read it. */
interface StubPointer {
  readonly x: number;
  readonly y: number;
  readonly isDown: boolean;
}

/**
 * Record the draw calls that `action` causes.
 *
 * @param action - The controller calls or frames to record.
 * @returns The call count and sha256 of the recorded log.
 */
function record_render(action: () => void): RenderLogDigest {
  render_log.start_recording();
  action();
  return render_log.stop_recording();
}

/**
 * @param scene - The booted scene.
 * @returns The labels still on screen, as `x y colour text`.
 */
function list_live_labels(scene: RuntimeScene): readonly string[] {
  return scene.texts
    .filter((label) => !label.isDestroyed && label.isVisible)
    .map((label) => {
      const fields = [format_render_value(label.x), format_render_value(label.y), label.colour];
      return `${fields.map(String).join(" ")} ${label.text}`;
    });
}

/**
 * Move the pointer over the centre of `tile`, which sets the hover tile and redraws.
 *
 * @param scene - The booted scene.
 * @param tile - The tile to hover.
 */
function hover_tile(scene: RuntimeScene, tile: GridPoint): void {
  const camera = scene.cameras.main;
  const pointer: StubPointer = {
    x: ((tile.x + 0.5) * TILE_SIZE_PX - camera.scrollX) * camera.zoom,
    y: ((tile.y + 0.5) * TILE_SIZE_PX - camera.scrollY) * camera.zoom,
    isDown: false,
  };
  scene.input.emit("pointermove", pointer);
}

/**
 * Open the centre, spawn {@link BUSY_SPAWN_COUNT} guests and step {@link BUSY_FRAME_COUNT}
 * frames.
 *
 * @param runtime - A booted fresh centre.
 */
function run_busy_centre(runtime: TestRuntime): void {
  runtime.controller.toggleOpen();
  for (let spawn = 0; spawn < BUSY_SPAWN_COUNT; spawn += 1) {
    runtime.controller.spawnCustomer();
  }
  for (let frame = 0; frame < BUSY_FRAME_COUNT; frame += 1) {
    runtime.step_frame(FRAME_MS);
  }
}

/**
 * @returns A booted busy centre with its first guest selected, so the settings scenarios
 * draw guests, queues and the selection ring.
 * @throws Error If the first guest has already left.
 */
async function create_busy_runtime(): Promise<TestRuntime> {
  const runtime = await create_test_runtime();
  runtime.boot();
  run_busy_centre(runtime);
  runtime.controller.selectCustomer(FIRST_GUEST_ID);
  if (runtime.snapshots.at(-1)?.selectedCustomerId !== FIRST_GUEST_ID) {
    throw new Error(`${FIRST_GUEST_ID} is not in the busy centre`);
  }
  return runtime;
}

/**
 * Parse the frozen gallery save afresh, so no test can see another test's changes.
 *
 * @returns The gallery save envelope.
 */
function load_gallery_save(): unknown {
  return JSON.parse(
    readFileSync(new URL("./fixtures/gallery-save.json", import.meta.url), "utf8"),
  ) as unknown;
}

/**
 * Select every reviewed variant of every family, in content order.
 *
 * @param runtime - A booted gallery.
 * @throws Error If the gallery has not unlocked a variant.
 */
function select_every_variant(runtime: TestRuntime): void {
  for (const family of NUTRITION_CONTENT.variantFamilies) {
    for (const variant of family.variants) {
      if (!runtime.controller.setDishVariant(family.dishId, variant.id)) {
        throw new Error(`The gallery cannot select ${family.dishId} ${variant.id}`);
      }
    }
  }
}

beforeEach(() => {
  install_runtime_stubs();
});

afterEach(() => {
  restore_runtime_stubs();
});

describe("createHawkerRuntime rendering", () => {
  it("(1) draws a fresh centre on boot", async () => {
    const runtime = await create_test_runtime();

    const digest = record_render(() => {
      runtime.boot();
    });

    expect(digest).toEqual(RENDER_DIGESTS.fresh);
    expect(list_live_labels(runtime.game.require_booted_scene())).toMatchSnapshot();
  });

  it("(2) draws an open centre through 20 spawns and 50 frames", async () => {
    const runtime = await create_test_runtime();
    const scene = runtime.boot();

    const digest = record_render(() => {
      run_busy_centre(runtime);
    });

    expect(digest).toEqual(RENDER_DIGESTS.busy);
    expect(list_live_labels(scene)).toMatchSnapshot();
  });

  it("(3) redraws the busy centre in high contrast", async () => {
    const runtime = await create_busy_runtime();

    const digest = record_render(() => {
      runtime.controller.setHighContrast(true);
    });

    expect(digest).toEqual(RENDER_DIGESTS.highContrast);
    expect(list_live_labels(runtime.game.require_booted_scene())).toMatchSnapshot();
  });

  it("(4) redraws the busy centre with reduced motion", async () => {
    const runtime = await create_busy_runtime();

    const digest = record_render(() => {
      runtime.controller.setReducedMotion(true);
    });

    expect(digest).toEqual(RENDER_DIGESTS.reducedMotion);
    expect(list_live_labels(runtime.game.require_booted_scene())).toMatchSnapshot();
  });

  it("(5) redraws the busy centre at lower-end quality", async () => {
    const runtime = await create_busy_runtime();

    const digest = record_render(() => {
      runtime.controller.setQuality("lower-end");
    });

    expect(digest).toEqual(RENDER_DIGESTS.lowerEnd);
    expect(list_live_labels(runtime.game.require_booted_scene())).toMatchSnapshot();
  });

  it("(6) redraws the busy centre with the debug overlay", async () => {
    const runtime = await create_busy_runtime();

    const digest = record_render(() => {
      runtime.controller.setDebugOverlay(true);
    });

    expect(digest).toEqual(RENDER_DIGESTS.debugOverlay);
    expect(list_live_labels(runtime.game.require_booted_scene())).toMatchSnapshot();
  });

  it("(7a) previews a placement on a clear tile", async () => {
    const runtime = await create_test_runtime();
    const scene = runtime.boot();
    runtime.controller.selectBuildItem(PLACE_PREVIEW_ID);

    const digest = record_render(() => {
      hover_tile(scene, OPEN_FLOOR_TILE);
    });

    expect(digest).toEqual(RENDER_DIGESTS.placeValid);
    expect(list_live_labels(scene)).toMatchSnapshot();
  });

  it("(7b) previews a placement over an existing table", async () => {
    const runtime = await create_test_runtime();
    const scene = runtime.boot();
    runtime.controller.selectBuildItem(PLACE_PREVIEW_ID);

    const digest = record_render(() => {
      hover_tile(scene, STARTER_TABLE_TILE);
    });

    expect(digest).toEqual(RENDER_DIGESTS.placeInvalid);
    expect(list_live_labels(scene)).toMatchSnapshot();
  });

  it("(8a) previews a route tile on a clear tile", async () => {
    const runtime = await create_test_runtime();
    const scene = runtime.boot();
    runtime.controller.setBuildTool("route");

    const digest = record_render(() => {
      hover_tile(scene, OPEN_FLOOR_TILE);
    });

    expect(digest).toEqual(RENDER_DIGESTS.routeValid);
    expect(list_live_labels(scene)).toMatchSnapshot();
  });

  it("(8b) previews a route tile over an existing table", async () => {
    const runtime = await create_test_runtime();
    const scene = runtime.boot();
    runtime.controller.setBuildTool("route");

    const digest = record_render(() => {
      hover_tile(scene, STARTER_TABLE_TILE);
    });

    expect(digest).toEqual(RENDER_DIGESTS.routeInvalid);
    expect(list_live_labels(scene)).toMatchSnapshot();
  });

  it("(9a) draws the gallery save on boot", async () => {
    const runtime = await create_test_runtime([load_gallery_save()]);

    const digest = record_render(() => {
      runtime.boot();
    });

    expect(digest).toEqual(RENDER_DIGESTS.gallery);
    expect(list_live_labels(runtime.game.require_booted_scene())).toMatchSnapshot();
  });

  it(
    "(9b) draws every reviewed variant on the gallery counters",
    async () => {
      const runtime = await create_test_runtime([load_gallery_save()]);
      const scene = runtime.boot();

      const digest = record_render(() => {
        select_every_variant(runtime);
      });

      expect(digest).toEqual(RENDER_DIGESTS.galleryVariants);
      expect(list_live_labels(scene)).toMatchSnapshot();
    },
    GALLERY_VARIANT_TIMEOUT_MS,
  );

  it(
    "(10) draws frames 480 and 960 of the two-day run at speed 10",
    async () => {
      const runtime = await create_test_runtime();
      const scene = runtime.boot();
      runtime.controller.toggleOpen();
      runtime.controller.setSpeed(MULTI_DAY_SPEED);

      const digests: Record<number, RenderLogDigest> = {};
      const labels: Record<number, readonly string[]> = {};
      const last_frame = Math.max(...MULTI_DAY_RECORDED_FRAMES);
      for (let frame = 1; frame <= last_frame; frame += 1) {
        if (MULTI_DAY_RECORDED_FRAMES.includes(frame)) {
          digests[frame] = record_render(() => {
            runtime.step_frame(FRAME_MS);
          });
          labels[frame] = list_live_labels(scene);
        } else {
          runtime.step_frame(FRAME_MS);
        }
      }

      expect(digests).toEqual({
        480: RENDER_DIGESTS.multiDayFrame480,
        960: RENDER_DIGESTS.multiDayFrame960,
      });
      expect(labels).toMatchSnapshot();
    },
    MULTI_DAY_TIMEOUT_MS,
  );
});
