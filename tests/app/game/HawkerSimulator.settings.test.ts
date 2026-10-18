// @vitest-environment jsdom
/**
 * End-to-end test of the Settings controls in the rendered `HawkerSimulator` shell.
 *
 * `tests/app/game/dialogs.test.ts` only checks that each control calls a mocked
 * `onUpdateSetting`. This suite renders the whole shell, changes a switch and a slider in
 * the Settings dialog, and checks that the shell's `update_setting` merges each change
 * into the settings it hands to the runtime and persists under the `settings` preference,
 * with the default key order. The fakes are a minimal copy of the harness in
 * `tests/app/game/HawkerSimulator.test.ts`, which is frozen and exports nothing:
 * `createHawkerRuntime` returns a recording controller, `saveStore` keeps preferences in
 * memory, `AudioDirector` and `registerPwa` are inert, and `matchMedia` matches nothing.
 */
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HawkerSimulator } from "@/app/game/HawkerSimulator";
import type * as SaveStoreModule from "@/src/game/persistence/saveStore";
import type { RuntimeController, RuntimeOptions, RuntimeSettings } from "@/src/game/runtime/types";

const fakes = vi.hoisted(() => {
  /** Every `savePreference` call and controller setting call, in issue order. */
  const calls: Array<readonly [method: string, ...args: unknown[]]> = [];
  const preferences = new Map<string, unknown>();

  const store = {
    saveGame: vi.fn(async (): Promise<void> => undefined),
    loadGameCandidates: vi.fn(async (): Promise<readonly unknown[]> => []),
    clearGame: vi.fn(async (): Promise<void> => undefined),
    savePreference: vi.fn(async (key: string, value: unknown): Promise<void> => {
      calls.push(["savePreference", key, value]);
      preferences.set(key, value);
    }),
    loadPreference: vi.fn(
      async <T>(key: string, fallback: T): Promise<T> =>
        (preferences.get(key) as T | undefined) ?? fallback,
    ),
  };

  /** Records each settings call the shell makes; every other method is a no-op. */
  function create_recorder(method: string): (value?: unknown) => undefined {
    return (value) => {
      calls.push([`controller.${method}`, value]);
      return undefined;
    };
  }

  const controller: RuntimeController = {
    destroy: () => undefined,
    selectBuildItem: () => undefined,
    setBuildTool: () => undefined,
    rotateSelection: () => undefined,
    undo: () => undefined,
    toggleOpen: () => true,
    setSpeed: () => undefined,
    setQuality: create_recorder("setQuality"),
    setReducedMotion: create_recorder("setReducedMotion"),
    setHighContrast: create_recorder("setHighContrast"),
    setDebugOverlay: () => undefined,
    zoomBy: () => undefined,
    centreCamera: () => undefined,
    exportState: () => ({}),
    importState: () => undefined,
    reset: () => undefined,
    spawnCustomer: () => undefined,
    addCash: () => undefined,
    expandMap: () => true,
    beginQueueEdit: () => true,
    setQueueDirection: () => true,
    finishQueueEdit: () => undefined,
    setDishEnabled: () => true,
    setDishVariant: () => true,
    selectCustomer: () => undefined,
    addAccessPoint: () => undefined,
    selectAccessPoint: () => undefined,
    removeSelectedAccessPoint: () => true,
    clearGuestRoute: () => true,
    upgradeStall: () => true,
  };

  const runtime = {
    options: undefined as RuntimeOptions | undefined,
    createHawkerRuntime: vi.fn(async (options: RuntimeOptions): Promise<RuntimeController> => {
      runtime.options = options;
      return controller;
    }),
  };

  const registerPwa = vi.fn((): (() => void) => () => undefined);

  /** Stand-in for the Web Audio director: every method is a no-op. */
  class FakeAudioDirector {
    readonly setVolumes = vi.fn();
    readonly setGameplayState = vi.fn();
    readonly setVoiceLimit = vi.fn();
    readonly unlock = vi.fn(async (): Promise<void> => undefined);
    readonly startAmbience = vi.fn();
    readonly stopAmbience = vi.fn();
    readonly play = vi.fn();
    readonly destroy = vi.fn();
  }

  /** Forget every call and empty the preference store. */
  function reset(): void {
    calls.length = 0;
    preferences.clear();
    runtime.options = undefined;
    registerPwa.mockClear();
  }

  return { calls, preferences, store, runtime, registerPwa, FakeAudioDirector, reset };
});

vi.mock("@/src/game/runtime/createHawkerRuntime", () => ({
  createHawkerRuntime: fakes.runtime.createHawkerRuntime,
}));

vi.mock("@/src/game/persistence/saveStore", async (import_original) => {
  const actual = await import_original<typeof SaveStoreModule>();
  return { ...actual, ...fakes.store };
});

vi.mock("@/src/game/audio/AudioDirector", () => ({
  AudioDirector: fakes.FakeAudioDirector,
}));

vi.mock("@/src/game/pwa/registerPwa", () => ({
  registerPwa: fakes.registerPwa,
}));

/** The shell's default settings, in their declared key order. */
const DEFAULT_SETTINGS: RuntimeSettings = {
  quality: "standard",
  reducedMotion: false,
  highContrast: false,
  textScale: 1,
  musicVolume: 0.32,
  ambienceVolume: 0.24,
  sfxVolume: 0.55,
  masterMuted: false,
};

/** Preferences of a returning player who has finished both onboarding flows. */
const ONBOARDED_PREFERENCES: Readonly<Record<string, unknown>> = {
  "tutorial-complete": true,
  "nutrition-tour-v1-complete": true,
};

/** The music volume the test sets with the slider. */
const NEW_MUSIC_VOLUME = 0.5;

/** How long the test waits, in real time, for the shell to reach `registerPwa`. */
const BOOT_TIMEOUT_MS = 10_000;

/** Event-loop turns that {@link settle} yields, enough for the preference writes. */
const SETTLE_TURNS = 10;

/** @returns A promise that resolves on the next macrotask turn of the real event loop. */
function wait_for_next_turn(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/** Let pending promise chains finish inside `act`. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
      await wait_for_next_turn();
    }
  });
}

/**
 * Render the shell for an onboarded player and wait until its startup effect has created
 * the runtime and registered the PWA.
 *
 * @returns The container that holds the component.
 * @throws Error If the shell does not reach `registerPwa` within {@link BOOT_TIMEOUT_MS}.
 */
async function boot_simulator(): Promise<HTMLElement> {
  for (const [key, value] of Object.entries(ONBOARDED_PREFERENCES)) {
    fakes.preferences.set(key, value);
  }
  const { container } = render(createElement(HawkerSimulator));
  const deadline = performance.now() + BOOT_TIMEOUT_MS;
  await act(async () => {
    while (fakes.registerPwa.mock.calls.length === 0) {
      if (performance.now() > deadline) {
        throw new Error("HawkerSimulator did not reach registerPwa; its startup failed or stalled");
      }
      await wait_for_next_turn();
    }
  });
  await settle();
  return container;
}

/**
 * Open Settings, turn on High contrast and move the music volume slider.
 *
 * @param container - The component container.
 */
async function change_settings(container: HTMLElement): Promise<void> {
  fireEvent.click(within(container).getByRole("button", { name: "Open settings and icon guide" }));
  const dialog = within(container).getByRole("dialog", { name: "Settings" });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: /^High contrast/ }));
  fireEvent.change(within(dialog).getByRole("slider", { name: /^Music volume/ }), {
    target: { value: String(NEW_MUSIC_VOLUME) },
  });
  await settle();
}

beforeEach(() => {
  fakes.reset();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HawkerSimulator settings controls", () => {
  it("persists a switch and a slider change, keeping the default key order", async () => {
    const container = await boot_simulator();
    fakes.calls.length = 0;

    await change_settings(container);

    const settings_writes = fakes.calls
      .filter(([method, key]) => method === "savePreference" && key === "settings")
      .map(([, , value]) => value as RuntimeSettings);
    const last_write = settings_writes.at(-1);
    expect([last_write, Object.keys(last_write ?? {})]).toEqual([
      { ...DEFAULT_SETTINGS, highContrast: true, musicVolume: NEW_MUSIC_VOLUME },
      Object.keys(DEFAULT_SETTINGS),
    ]);
  });

  it("hands the switch change to the runtime", async () => {
    const container = await boot_simulator();
    fakes.calls.length = 0;

    await change_settings(container);

    expect(fakes.calls.filter(([method]) => method === "controller.setHighContrast")).toEqual([
      ["controller.setHighContrast", true],
      ["controller.setHighContrast", true],
    ]);
  });
});
