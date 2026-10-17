/**
 * Headless harness for driving `createHawkerRuntime` in Node, without a browser or Phaser.
 *
 * The runtime imports Phaser dynamically, reads `performance.now()` for frame pacing and
 * for its simulation-time budget, and checks DOM element classes in its keyboard handler.
 * This module supplies a stand-in for each one, so a suite can build the real-content
 * runtime and step it frame by frame with fully deterministic timing:
 *
 * - {@link PHASER_STUB_MODULE} is what a suite returns from `vi.mock("phaser")`. Its
 *   `Game` records its config and does not boot until the test calls `boot()`, so a suite
 *   can call the controller before the scene exists, as the page can while Phaser loads.
 * - {@link test_clock} is what `performance.now()` returns: the current frame time,
 *   constant within a frame unless a per-call script is set.
 * - {@link install_runtime_stubs} and {@link restore_runtime_stubs} put the clock and the
 *   DOM stubs in place around each test.
 * - {@link create_test_runtime} builds a runtime and collects everything it reports.
 * - {@link render_log} records every Graphics and Text call of the stub scene, at full
 *   15-digit precision, between `start_recording()` and `stop_recording()`, so a suite can
 *   pin the exact draw output of a scenario.
 */
import { createHash, type Hash } from "node:crypto";

import { vi, type MockInstance } from "vitest";

import { createHawkerRuntime } from "@/src/game/runtime/createHawkerRuntime";
import type {
  RuntimeController,
  RuntimeEvent,
  RuntimeSettings,
  RuntimeSnapshot,
} from "@/src/game/runtime/types";

/** Phaser 4.2.1 `AUTO` renderer type, copied so recorded configs read like the real ones. */
const PHASER_AUTO_RENDERER = 0;
/** Phaser 4.2.1 `Scale.RESIZE` scale mode. */
const PHASER_SCALE_RESIZE = 5;
/** Phaser 4.2.1 `Scale.CENTER_BOTH` centring mode. */
const PHASER_SCALE_CENTER_BOTH = 1;
/** Phaser's `Math.DegToRad` multiplier, kept as one constant so the product rounds the same. */
const DEG_TO_RAD = Math.PI / 180;

/** Phaser's initial `loop.actualFps` before any frame has been measured. */
const INITIAL_ACTUAL_FPS = 60;

/** Size reported by {@link FakeParent}, a typical laptop game area. */
const FAKE_PARENT_WIDTH = 1280;
const FAKE_PARENT_HEIGHT = 720;

/**
 * Significant digits kept for every number in a render log. Fifteen is a double's full
 * decimal precision (DBL_DIG), so the format keeps every drawn difference and drops only
 * last-bit rounding noise.
 */
const RENDER_NUMBER_PRECISION = 15;

/** Default player settings of the `HawkerSimulator` component. */
const TEST_SETTINGS: RuntimeSettings = {
  quality: "standard",
  reducedMotion: false,
  highContrast: false,
  textScale: 1,
  musicVolume: 0.32,
  ambienceVolume: 0.24,
  sfxVolume: 0.55,
  masterMuted: false,
};

/** Test-owned replacement for `performance.now()`. */
export class TestClock {
  private frameTimeMs = 0;
  private callOffsetsMs: readonly number[] | undefined;
  private callsSinceFrameStart = 0;

  /**
   * Start a new frame at `ms`. Every `performance.now()` call returns `ms` until the next
   * frame, unless {@link TestClock.script_frame_calls} set a per-call script.
   *
   * @param ms - The frame time in milliseconds.
   */
  set_frame_time(ms: number): void {
    this.frameTimeMs = ms;
    this.callsSinceFrameStart = 0;
  }

  /**
   * @returns The time of the current frame in milliseconds.
   */
  get_frame_time(): number {
    return this.frameTimeMs;
  }

  /**
   * Switch to scripted mode: the n-th `performance.now()` call of each frame returns the
   * frame time plus `offsets_ms[n]`, and calls past the end repeat the last offset. Pass
   * `undefined` to return to the constant clock.
   *
   * @param offsets_ms - Per-call offsets from the frame time, in call order.
   */
  script_frame_calls(offsets_ms: readonly number[] | undefined): void {
    this.callOffsetsMs = offsets_ms;
  }

  /**
   * Read the clock as `performance.now()` would, counting the call for scripted mode.
   *
   * @returns The frame time, plus the scripted offset for this call when one is set.
   */
  read_now(): number {
    const call_index = this.callsSinceFrameStart;
    this.callsSinceFrameStart += 1;
    const offsets = this.callOffsetsMs;
    if (offsets === undefined || offsets.length === 0) return this.frameTimeMs;
    return this.frameTimeMs + offsets[Math.min(call_index, offsets.length - 1)];
  }

  /** Go back to frame time 0 with no script, as at the start of a test. */
  reset(): void {
    this.set_frame_time(0);
    this.callOffsetsMs = undefined;
  }
}

/** The clock behind `performance.now()` while the runtime stubs are installed. */
export const test_clock = new TestClock();

/** Base class of the DOM element stubs, so `instanceof` checks work in Node. */
export class StubElement {}

/** Stand-in for `HTMLInputElement`. */
export class StubHTMLInputElement extends StubElement {}

/** Stand-in for `HTMLTextAreaElement`. */
export class StubHTMLTextAreaElement extends StubElement {}

/** Stand-in for `HTMLSelectElement`. */
export class StubHTMLSelectElement extends StubElement {}

/**
 * The game host element. The runtime reads its size, focuses it on pointer down, and
 * checks that it contains `document.activeElement` before it handles a key.
 */
export class FakeParent extends StubElement {
  readonly clientWidth = FAKE_PARENT_WIDTH;
  readonly clientHeight = FAKE_PARENT_HEIGHT;
  /** The element that `document.activeElement` returns while the stubs are installed. */
  readonly focusedChild = new StubElement();
  focusCount = 0;

  /**
   * @param node - The node to look for.
   * @returns Whether `node` is this element or its focused child.
   */
  contains(node: unknown): boolean {
    return node === this || node === this.focusedChild;
  }

  /** Record a focus request. */
  focus(): void {
    this.focusCount += 1;
  }
}

/** A recorded call on a stub. */
export interface StubCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

/** An event handler registered on a stub emitter. */
export type StubHandler = (...args: never[]) => void;

/** Records handlers by event name, as Phaser's input plugin and keyboard plugin take them. */
export class StubEventEmitter {
  readonly handlers: Record<string, StubHandler[]> = {};

  /**
   * Register `handler` for `event`.
   *
   * @param event - The event name.
   * @param handler - The handler to record.
   * @returns This emitter, as Phaser's `on` returns.
   */
  on(event: string, handler: StubHandler): this {
    (this.handlers[event] ??= []).push(handler);
    return this;
  }

  /**
   * Call every handler registered for `event`, in registration order, as Phaser does when
   * the event fires.
   *
   * @param event - The event name.
   * @param args - The event arguments, such as a pointer.
   */
  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers[event] ?? []) {
      (handler as (...values: unknown[]) => void)(...args);
    }
  }
}

/** Stand-in for a scene's input plugin, with a keyboard plugin. */
export class StubInput extends StubEventEmitter {
  readonly keyboard = new StubEventEmitter();
}

/** A rectangle with the edge names of Phaser's `worldView`. */
export interface StubWorldView {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Stand-in for `cameras.main`: keeps zoom and scroll, and records every setter call. */
export class StubCamera {
  zoom = 1;
  scrollX = 0;
  scrollY = 0;
  readonly worldView: StubWorldView = {
    left: 0,
    right: FAKE_PARENT_WIDTH,
    top: 0,
    bottom: FAKE_PARENT_HEIGHT,
  };
  readonly calls: StubCall[] = [];

  /**
   * @param zoom - The new zoom factor.
   * @returns This camera.
   */
  setZoom(zoom: number): this {
    this.calls.push({ method: "setZoom", args: [zoom] });
    this.zoom = zoom;
    return this;
  }

  /**
   * @param x - Left edge of the bounds.
   * @param y - Top edge of the bounds.
   * @param width - Width of the bounds.
   * @param height - Height of the bounds.
   * @returns This camera.
   */
  setBounds(x: number, y: number, width: number, height: number): this {
    this.calls.push({ method: "setBounds", args: [x, y, width, height] });
    return this;
  }

  /**
   * @param x - World x to centre on.
   * @param y - World y to centre on.
   * @returns This camera.
   */
  centerOn(x: number, y: number): this {
    this.calls.push({ method: "centerOn", args: [x, y] });
    return this;
  }

  /**
   * Convert a screen point to world space from scroll and zoom only. This is simpler than
   * Phaser, which also zooms around the camera centre.
   *
   * @param x - Screen x.
   * @param y - Screen y.
   * @returns The world point.
   */
  getWorldPoint(x: number, y: number): { x: number; y: number } {
    return { x: x / this.zoom + this.scrollX, y: y / this.zoom + this.scrollY };
  }
}

/**
 * Format one draw-call argument for a render log: numbers are rounded to
 * {@link RENDER_NUMBER_PRECISION} significant digits, and arrays are formatted item by item.
 *
 * @param value - The argument as the runtime passed it.
 * @returns The value to serialise. Non-finite numbers become their names, so they stay
 * distinct from each other in the JSON log.
 */
export function format_render_value(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    return Number(value.toPrecision(RENDER_NUMBER_PRECISION));
  }
  if (Array.isArray(value)) return value.map(format_render_value);
  return value;
}

/** The digest of a finished render log. */
export interface RenderLogDigest {
  /** Number of recorded calls. */
  readonly calls: number;
  /** sha256 of the log, one JSON array per call, each followed by a newline. */
  readonly sha256: string;
}

/**
 * Records Graphics and Text calls in call order while recording is on, and hashes them
 * as they arrive so long scenarios do not hold the whole log in memory.
 *
 * Each call is logged as the JSON array `[target, method, ...arguments]`, where the target
 * is `graphics#<n>` for the n-th Graphics object of the scene or `text` for a label, and
 * every number goes through {@link format_render_value}.
 */
export class RenderLog {
  private hash: Hash | undefined;
  private callCount = 0;

  /** Start a new log, discarding any log in progress. */
  start_recording(): void {
    this.hash = createHash("sha256");
    this.callCount = 0;
  }

  /**
   * Stop recording and digest the log.
   *
   * @returns The call count and sha256 of the calls since `start_recording()`.
   * @throws Error If recording is not on.
   */
  stop_recording(): RenderLogDigest {
    if (this.hash === undefined) throw new Error("Call start_recording() before stop_recording()");
    const digest = { calls: this.callCount, sha256: this.hash.digest("hex") };
    this.reset();
    return digest;
  }

  /**
   * Log one call, or do nothing while recording is off.
   *
   * @param target - `graphics#<n>` or `text`.
   * @param method - The method name, or `create` for a new object.
   * @param args - The call arguments.
   */
  record(target: string, method: string, args: readonly unknown[]): void {
    if (this.hash === undefined) return;
    this.hash.update(`${JSON.stringify([target, method, ...args.map(format_render_value)])}\n`);
    this.callCount += 1;
  }

  /** Stop recording without a digest. */
  reset(): void {
    this.hash = undefined;
    this.callCount = 0;
  }
}

/** The log every stub scene records into while the runtime stubs are installed. */
export const render_log = new RenderLog();

/**
 * Read the colour of a Phaser text style.
 *
 * @param style - The style passed to `add.text`.
 * @returns Its `color`, or `undefined` when it has none.
 */
function read_style_colour(style: unknown): unknown {
  return typeof style === "object" && style !== null && "color" in style ? style.color : undefined;
}

/**
 * Stand-in for a text game object. It logs its creation (x, y, text and colour) and every
 * method call to {@link render_log}.
 */
export class StubText {
  readonly calls: StubCall[] = [];
  isDestroyed = false;

  /**
   * @param x - World x.
   * @param y - World y.
   * @param text - The label text.
   * @param style - The Phaser text style.
   */
  constructor(
    readonly x: number,
    readonly y: number,
    readonly text: string,
    readonly style: unknown,
  ) {
    render_log.record("text", "create", [x, y, text, read_style_colour(style)]);
  }

  /** The text colour from the style, as the label shows it. */
  get colour(): unknown {
    return read_style_colour(this.style);
  }

  /**
   * @param x - Horizontal origin.
   * @param y - Vertical origin.
   * @returns This text.
   */
  setOrigin(x: number, y: number): this {
    this.calls.push({ method: "setOrigin", args: [x, y] });
    render_log.record("text", "setOrigin", [x, y]);
    return this;
  }

  /**
   * @param depth - Render depth.
   * @returns This text.
   */
  setDepth(depth: number): this {
    this.calls.push({ method: "setDepth", args: [depth] });
    render_log.record("text", "setDepth", [depth]);
    return this;
  }

  /** Mark the text destroyed. */
  destroy(): void {
    this.isDestroyed = true;
    render_log.record("text", "destroy", []);
  }
}

/**
 * Create a Graphics stand-in that logs every method call, as `[tag, method, ...args]`, to
 * {@link render_log} and returns itself, so the runtime's drawing code runs to completion
 * without a renderer and its exact output can be digested.
 *
 * @param tag - The target name to log, such as `graphics#0`.
 * @returns The recording graphics stub.
 */
export function create_recording_graphics(tag: string): object {
  render_log.record(tag, "create", []);
  const graphics: object = new Proxy(
    {},
    {
      get(_target, property) {
        // Leave symbol lookups (inspection, iteration) unanswered so the stub prints plainly.
        if (typeof property === "symbol") return undefined;
        return (...args: unknown[]) => {
          render_log.record(tag, property, args);
          return graphics;
        };
      },
    },
  );
  return graphics;
}

/** The game-object factory of a scene. */
export interface StubGameObjectFactory {
  graphics(): object;
  text(x: number, y: number, text: string, style: unknown): StubText;
}

/** Base class that the runtime's scene extends in place of `Phaser.Scene`. */
export class StubScene {
  readonly texts: StubText[] = [];
  private graphicsCount = 0;
  readonly add: StubGameObjectFactory = {
    graphics: () => create_recording_graphics(`graphics#${this.graphicsCount++}`),
    text: (x, y, text, style) => {
      const label = new StubText(x, y, text, style);
      this.texts.push(label);
      return label;
    },
  };
  readonly cameras = { main: new StubCamera() };
  readonly input = new StubInput();

  /**
   * @param config - The scene config the runtime passes to `super`.
   */
  constructor(readonly config?: unknown) {}
}

/** The runtime's scene class as the stub game sees it: a {@link StubScene} with lifecycle hooks. */
export interface RuntimeScene extends StubScene {
  /** Called once by {@link StubGame.boot}. */
  create(): void;
  /**
   * Called once per frame by a test's `step_frame`.
   *
   * @param time - Frame time in milliseconds.
   * @param delta - Milliseconds since the previous frame.
   */
  update(time: number, delta: number): void;
}

/** Stand-in for `game.loop`. */
export class StubLoop {
  actualFps = INITIAL_ACTUAL_FPS;
  readonly fpsLimits: number[] = [];

  /**
   * @param limit - The new frame-rate cap.
   */
  setFPSLimit(limit: number): void {
    this.fpsLimits.push(limit);
  }
}

/** The part of the Phaser game config that the stub acts on. */
export interface StubGameConfig {
  readonly scene: new () => RuntimeScene;
  readonly [key: string]: unknown;
}

/** Every stub game constructed since the stubs were installed, in construction order. */
const created_games: StubGame[] = [];

/** Stand-in for `Phaser.Game`. It never boots on its own. */
export class StubGame {
  readonly loop = new StubLoop();
  bootedScene: RuntimeScene | undefined;
  /** The `removeCanvas` argument of each `destroy` call. */
  readonly destroyCalls: boolean[] = [];

  /**
   * @param config - The game config, recorded as given.
   */
  constructor(readonly config: StubGameConfig) {
    created_games.push(this);
  }

  /**
   * Instantiate the configured scene and call its `create()`, as Phaser does on boot.
   *
   * @returns The booted scene.
   * @throws Error If the game was already booted.
   */
  boot(): RuntimeScene {
    if (this.bootedScene !== undefined) throw new Error("The stub game is already booted");
    const scene = new this.config.scene();
    this.bootedScene = scene;
    scene.create();
    return scene;
  }

  /**
   * @returns The booted scene.
   * @throws Error If `boot()` has not run yet.
   */
  require_booted_scene(): RuntimeScene {
    if (this.bootedScene === undefined) throw new Error("Call boot() before stepping frames");
    return this.bootedScene;
  }

  /**
   * Record a destroy request.
   *
   * @param should_remove_canvas - Phaser's flag to remove the canvas as well.
   */
  destroy(should_remove_canvas: boolean): void {
    this.destroyCalls.push(should_remove_canvas);
  }
}

/** The members of the Phaser default export that the runtime uses. */
export const PHASER_STUB = {
  AUTO: PHASER_AUTO_RENDERER,
  Game: StubGame,
  Scene: StubScene,
  Scale: { RESIZE: PHASER_SCALE_RESIZE, CENTER_BOTH: PHASER_SCALE_CENTER_BOTH },
  Math: {
    Clamp: (value: number, min: number, max: number): number =>
      Math.max(min, Math.min(max, value)),
    DegToRad: (degrees: number): number => degrees * DEG_TO_RAD,
  },
};

/** The module shape to return from `vi.mock("phaser", ...)`. */
export const PHASER_STUB_MODULE = { default: PHASER_STUB };

let current_parent: FakeParent | undefined;
let performance_spy: MockInstance<() => number> | undefined;

/**
 * @returns The game host element of the current test.
 * @throws Error If {@link install_runtime_stubs} has not run in this test.
 */
export function fake_parent(): FakeParent {
  if (current_parent === undefined) throw new Error("Call install_runtime_stubs() first");
  return current_parent;
}

/**
 * Reset {@link test_clock} to frame 0, route `performance.now()` to it, stop
 * {@link render_log}, and install the DOM element classes and a `document` whose active
 * element is inside {@link fake_parent}. Call it in `beforeEach`.
 */
export function install_runtime_stubs(): void {
  test_clock.reset();
  render_log.reset();
  current_parent = new FakeParent();
  created_games.length = 0;
  performance_spy = vi.spyOn(performance, "now").mockImplementation(() => test_clock.read_now());
  vi.stubGlobal("HTMLInputElement", StubHTMLInputElement);
  vi.stubGlobal("HTMLTextAreaElement", StubHTMLTextAreaElement);
  vi.stubGlobal("HTMLSelectElement", StubHTMLSelectElement);
  vi.stubGlobal("document", { activeElement: current_parent.focusedChild });
}

/** Undo {@link install_runtime_stubs}. Call it in `afterEach`. */
export function restore_runtime_stubs(): void {
  performance_spy?.mockRestore();
  performance_spy = undefined;
  vi.unstubAllGlobals();
  current_parent = undefined;
  created_games.length = 0;
  test_clock.reset();
  render_log.reset();
}

/** A runtime under test with everything it has reported so far. */
export interface TestRuntime {
  readonly controller: RuntimeController;
  readonly events: RuntimeEvent[];
  readonly snapshots: RuntimeSnapshot[];
  readonly saves: unknown[];
  readonly game: StubGame;
  /** Boot the stub game, which creates the scene. */
  boot(): RuntimeScene;
  /**
   * Advance {@link test_clock} by `delta_ms` and run one scene update with that delta.
   *
   * @param delta_ms - The frame delta in milliseconds.
   */
  step_frame(delta_ms: number): void;
}

/**
 * Build the real-content runtime on the stubs, with the app's default settings.
 *
 * The game is constructed but not booted, so the controller can be called before the
 * scene exists. Call `boot()` before `step_frame()`.
 *
 * @param initial_states - Save candidates, newest first, as the page passes them.
 * @returns The runtime, its stub game, and arrays that collect its snapshots, events and saves.
 * @throws Error If {@link install_runtime_stubs} has not run in this test.
 */
export async function create_test_runtime(
  initial_states?: readonly unknown[],
): Promise<TestRuntime> {
  if (performance_spy === undefined) {
    throw new Error("Call install_runtime_stubs() before create_test_runtime()");
  }
  const events: RuntimeEvent[] = [];
  const snapshots: RuntimeSnapshot[] = [];
  const saves: unknown[] = [];
  const games_before = created_games.length;
  const controller = await createHawkerRuntime({
    // The runtime only reads size, focus and containment from its parent, which the fake
    // provides; it cannot be a real HTMLElement in Node.
    parent: fake_parent() as unknown as HTMLElement,
    settings: { ...TEST_SETTINGS },
    initialStates: initial_states,
    onSnapshot: (snapshot) => {
      snapshots.push(snapshot);
    },
    onEvent: (event) => {
      events.push(event);
    },
    onPersistentChange: (state) => {
      saves.push(state);
    },
  });
  const game = created_games[games_before];
  if (game === undefined) throw new Error("createHawkerRuntime did not construct a game");
  return {
    controller,
    events,
    snapshots,
    saves,
    game,
    boot: () => game.boot(),
    step_frame(delta_ms) {
      const scene = game.require_booted_scene();
      test_clock.set_frame_time(test_clock.get_frame_time() + delta_ms);
      scene.update(test_clock.get_frame_time(), delta_ms);
    },
  };
}
