// @vitest-environment jsdom
/**
 * Interaction suite for the `HawkerSimulator` client component, run in jsdom.
 *
 * The component is server-rendered with `renderToString` and then hydrated, as the page
 * is in production, so the DOM keeps the server markup's attributes (such as the
 * tutorial button's `autofocus`). Everything outside the component is faked:
 *
 * - `createHawkerRuntime` returns a recording controller and exposes the option
 *   callbacks, so a test can push snapshots, events and persistent changes as the runtime
 *   would.
 * - `saveStore` keeps preferences in memory, records every call in issue order, and can
 *   be told to fail a method. `exportSave` and `importSave` stay real.
 * - `AudioDirector` and `registerPwa` are inert recorders, and `matchMedia` answers from
 *   a per-test list of matching queries.
 * - `requestAnimationFrame` queues callbacks until the test flushes them, so focus moves
 *   happen at a point the test chooses, in request order.
 * - `setTimeout` and `clearTimeout` are fake, so the autosave debounce and the toast
 *   timers run only when a test advances the clock.
 *
 * Every state change runs inside `act`, and an update outside it logs a React warning,
 * which fails the test. The panel snapshots and the literals here pin current behaviour.
 * If a refactor makes one fail, the refactor changed behaviour: fix the code, never the
 * literal or the snapshot.
 */
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { HawkerSimulator } from "@/app/game/HawkerSimulator";
import { exportSave } from "@/src/game/persistence/saveStore";
import type * as SaveStoreModule from "@/src/game/persistence/saveStore";
import { expect_console_warning } from "@/tests/console";
import type {
  RuntimeController,
  RuntimeCustomerNutritionSummary,
  RuntimeEvent,
  RuntimeOptions,
  RuntimeSettings,
  RuntimeSnapshot,
} from "@/src/game/runtime/types";
import SNAPSHOT_FIXTURE_JSON from "./fixtures/snapshot.json";

/** One recorded call to a fake: the method name, then its arguments. */
type FakeCall = readonly [method: string, ...args: unknown[]];

/** The `saveStore` functions that a test can make fail. */
type StoreMethod =
  | "saveGame"
  | "loadGameCandidates"
  | "clearGame"
  | "savePreference"
  | "loadPreference";

const fakes = vi.hoisted(() => {
  /** Every store, runtime and controller call of the current test, in issue order. */
  const calls: FakeCall[] = [];
  const failing_methods = new Set<StoreMethod>();
  const preferences = new Map<string, unknown>();
  /** The data URL the fake controller paints for each preview key; others are not ready. */
  const preview_urls = new Map<string, string>();

  function record_call(method: string, ...args: unknown[]): void {
    calls.push([method, ...args]);
  }

  function fail_if_requested(method: StoreMethod): void {
    if (failing_methods.has(method)) throw new Error(`Simulated ${method} failure`);
  }

  /** While set, every `saveGame` call waits for it, so a test can hold a save in flight. */
  let save_gate: Promise<void> | undefined;
  let open_save_gate: (() => void) | undefined;

  const store = {
    preferences,
    failingMethods: failing_methods,
    /** Hold every `saveGame` call, from now on, until {@link store.release_saves}. */
    hold_saves(): void {
      save_gate = new Promise((resolve) => {
        open_save_gate = resolve;
      });
    },
    /** Let the held `saveGame` calls finish, and stop holding new ones. */
    release_saves(): void {
      open_save_gate?.();
      save_gate = undefined;
      open_save_gate = undefined;
    },
    saveGame: vi.fn(async (payload: unknown): Promise<void> => {
      record_call("saveGame", payload);
      if (save_gate !== undefined) await save_gate;
      fail_if_requested("saveGame");
    }),
    loadGameCandidates: vi.fn(async (): Promise<readonly unknown[]> => {
      record_call("loadGameCandidates");
      fail_if_requested("loadGameCandidates");
      return [];
    }),
    clearGame: vi.fn(async (): Promise<void> => {
      record_call("clearGame");
      fail_if_requested("clearGame");
    }),
    savePreference: vi.fn(async (key: string, value: unknown): Promise<void> => {
      record_call("savePreference", key, value);
      fail_if_requested("savePreference");
      preferences.set(key, value);
    }),
    loadPreference: vi.fn(async <T>(key: string, fallback: T): Promise<T> => {
      record_call("loadPreference", key);
      fail_if_requested("loadPreference");
      return (preferences.get(key) as T | undefined) ?? fallback;
    }),
  };

  /** What the fake controller's `exportState()` returns. */
  const exported_state: unknown = { runtimeSchemaVersion: 2, core: { marker: "exported" } };

  function create_recorder<R>(method: string, result: R): (...args: unknown[]) => R {
    return (...args) => {
      record_call(`controller.${method}`, ...args);
      return result;
    };
  }

  const controller: RuntimeController = {
    destroy: create_recorder("destroy", undefined),
    selectBuildItem: create_recorder("selectBuildItem", undefined),
    setBuildTool: create_recorder("setBuildTool", undefined),
    rotateSelection: create_recorder("rotateSelection", undefined),
    undo: create_recorder("undo", undefined),
    toggleOpen: create_recorder("toggleOpen", true),
    setSpeed: create_recorder("setSpeed", undefined),
    setQuality: create_recorder("setQuality", undefined),
    setReducedMotion: create_recorder("setReducedMotion", undefined),
    setHighContrast: create_recorder("setHighContrast", undefined),
    setDebugOverlay: create_recorder("setDebugOverlay", undefined),
    zoomBy: create_recorder("zoomBy", undefined),
    centreCamera: create_recorder("centreCamera", undefined),
    exportState: create_recorder("exportState", exported_state),
    importState: create_recorder("importState", undefined),
    reset: create_recorder("reset", undefined),
    spawnCustomer: create_recorder("spawnCustomer", undefined),
    addCash: create_recorder("addCash", undefined),
    expandMap: create_recorder("expandMap", true),
    beginQueueEdit: create_recorder("beginQueueEdit", true),
    setQueueDirection: create_recorder("setQueueDirection", true),
    finishQueueEdit: create_recorder("finishQueueEdit", undefined),
    setDishEnabled: create_recorder("setDishEnabled", true),
    setDishVariant: create_recorder("setDishVariant", true),
    selectCustomer: create_recorder("selectCustomer", undefined),
    addAccessPoint: create_recorder("addAccessPoint", undefined),
    selectAccessPoint: create_recorder("selectAccessPoint", undefined),
    removeSelectedAccessPoint: create_recorder("removeSelectedAccessPoint", true),
    clearGuestRoute: create_recorder("clearGuestRoute", true),
    upgradeStall: create_recorder("upgradeStall", true),
    renderPreview: (definition_id: string) => preview_urls.get(definition_id),
    renderDishPreview: (dish_id: string, variant_id?: string) =>
      preview_urls.get(variant_id ? `${dish_id}@${variant_id}` : dish_id),
  };

  const runtime = {
    exportedState: exported_state,
    options: undefined as RuntimeOptions | undefined,
    createHawkerRuntime: vi.fn(async (options: RuntimeOptions): Promise<RuntimeController> => {
      record_call("createHawkerRuntime");
      runtime.options = options;
      return controller;
    }),
  };

  const pwa = {
    // No test drives PWA status, so the status handlers the component passes are ignored.
    registerPwa: vi.fn((): (() => void) => {
      record_call("registerPwa");
      return () => undefined;
    }),
  };

  /** Stand-in for the Web Audio director: every method is a no-op recorder. */
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

  /** Forget every call and failure, and empty the preference store. */
  function reset(): void {
    calls.length = 0;
    store.release_saves();
    failing_methods.clear();
    preferences.clear();
    preview_urls.clear();
    runtime.options = undefined;
    for (const mock of [
      store.saveGame,
      store.loadGameCandidates,
      store.clearGame,
      store.savePreference,
      store.loadPreference,
      runtime.createHawkerRuntime,
      pwa.registerPwa,
    ]) {
      mock.mockClear();
    }
  }

  return { calls, store, runtime, pwa, previewUrls: preview_urls, FakeAudioDirector, reset };
});

vi.mock("@/src/game/runtime/createHawkerRuntime", () => ({
  createHawkerRuntime: fakes.runtime.createHawkerRuntime,
}));

vi.mock("@/src/game/persistence/saveStore", async (import_original) => {
  const actual = await import_original<typeof SaveStoreModule>();
  return {
    ...actual,
    saveGame: fakes.store.saveGame,
    loadGameCandidates: fakes.store.loadGameCandidates,
    clearGame: fakes.store.clearGame,
    savePreference: fakes.store.savePreference,
    loadPreference: fakes.store.loadPreference,
  };
});

vi.mock("@/src/game/audio/AudioDirector", () => ({
  AudioDirector: fakes.FakeAudioDirector,
}));

vi.mock("@/src/game/pwa/registerPwa", () => ({
  registerPwa: fakes.pwa.registerPwa,
}));

/**
 * The last runtime snapshot of the S14 harness's open run: a fresh centre opened and
 * stepped for 600 frames of 100 ms at speed 1, as `createHawkerRuntime.test.ts` (10)
 * does. It was written from `runtime.snapshots.at(-1)` with `JSON.stringify`, so its
 * `undefined` fields are absent. The neighbourhood fields (day 2 with day 1's Service
 * Review, the uncleared trays, the crew, the peak reputation and the next unlock) were added
 * by hand when the HUD gained them.
 */
const SNAPSHOT_FIXTURE = SNAPSHOT_FIXTURE_JSON as RuntimeSnapshot;

/** Runtime-formatted events for the activity feed: two grouped sales and a reroute. */
const ACTIVITY_EVENTS: readonly RuntimeEvent[] = [
  {
    kind: "success",
    message: "A neighbour enjoyed their meal · +$5",
    importance: "routine",
    groupKey: "sales",
    amount: 5,
  },
  {
    kind: "success",
    message: "A neighbour enjoyed their meal · +$6",
    importance: "routine",
    groupKey: "sales",
    amount: 6,
  },
  {
    kind: "warning",
    message: "A guest rerouted after the layout changed.",
    importance: "routine",
    groupKey: "reroutes",
  },
];

/** Preferences of a returning player who has finished both onboarding flows. */
const ONBOARDED_PREFERENCES: Readonly<Record<string, unknown>> = {
  "tutorial-complete": true,
  "nutrition-tour-v1-complete": true,
};

/** The `matchMedia` query that puts the management panel into its bottom-sheet mode. */
const COMPACT_LAYOUT_QUERY = "(max-width: 899px)";

/** The component's autosave debounce, in milliseconds. */
const AUTOSAVE_DEBOUNCE_MS = 200;

/** Gap between the persistent changes of the debounce test, well inside the debounce. */
const CHANGE_GAP_MS = 80;

/** The default player settings of the `HawkerSimulator` component. */
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

/** How long a test waits, in real time, for the component to reach `registerPwa`. */
const BOOT_TIMEOUT_MS = 10_000;

/**
 * Event-loop turns that {@link settle} yields. Each turn drains every pending microtask,
 * so this covers the longest promise chain in the component (an import or a reset)
 * several times over.
 */
const SETTLE_TURNS = 10;

/** Upper bound on animation-frame callbacks in one flush, to stop a runaway loop. */
const MAX_FRAME_CALLBACKS_PER_FLUSH = 100;

/** The dock tabs, by visible label, in dock order. */
const DOCK_TABS = ["Focus", "Build", "Stalls", "Dishes", "Insights", "Activity"] as const;

/** A dock tab, by visible label. */
type DockTab = (typeof DOCK_TABS)[number];

/** A guest selected on the map, as the runtime reports it to the visit inspector. */
const SELECTED_GUEST: RuntimeCustomerNutritionSummary = {
  customerId: "customer-1",
  archetypeId: "customer.early-shift-regular",
  status: "eating",
  decisionReasons: [],
  healthConditionIds: [],
  healthDecisionReasons: [],
};

/** Queues `requestAnimationFrame` callbacks until the test flushes them. */
class FrameQueue {
  private readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 1;

  /**
   * @param callback - The frame callback.
   * @returns Its handle, for `cancelAnimationFrame`.
   */
  readonly request = (callback: FrameRequestCallback): number => {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  };

  /**
   * @param id - A handle from {@link FrameQueue.request}.
   */
  readonly cancel = (id: number): void => {
    this.callbacks.delete(id);
  };

  /**
   * Run queued callbacks in request order, including any they queue, until none remain.
   *
   * @throws Error If the callbacks keep queueing new ones past the per-flush bound.
   */
  run_all(): void {
    for (let count = 0; this.callbacks.size > 0; count += 1) {
      if (count >= MAX_FRAME_CALLBACKS_PER_FLUSH) {
        throw new Error("Animation-frame callbacks kept queueing new frames");
      }
      const [id, callback] = this.callbacks.entries().next().value as [
        number,
        FrameRequestCallback,
      ];
      this.callbacks.delete(id);
      callback(performance.now());
    }
  }

  /** Drop every queued callback. */
  clear(): void {
    this.callbacks.clear();
  }
}

const frames = new FrameQueue();

/**
 * Answer `matchMedia` from a fixed list: a query matches exactly when it is listed.
 *
 * @param matching_queries - The media queries that match in this test.
 */
function install_match_media(matching_queries: readonly string[]): void {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList => ({
      matches: matching_queries.includes(query),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  );
}

/** @returns A promise that resolves on the next macrotask turn of the real event loop. */
function wait_for_next_turn(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/** How a test boots the component. */
interface BootOptions {
  /** Preference values in the store before boot, by key. */
  readonly preferences?: Readonly<Record<string, unknown>>;
  /** Media queries that `matchMedia` reports as matching. */
  readonly matchingMedia?: readonly string[];
}

/**
 * Server-render and hydrate the component, then wait inside `act` until its startup
 * effect has loaded preferences and saves, created the runtime and registered the PWA.
 *
 * @param options - Preferences and media queries for this boot.
 * @returns The container that holds the hydrated component.
 * @throws Error If the component does not reach `registerPwa` within
 * {@link BOOT_TIMEOUT_MS}.
 */
async function boot_simulator(options: BootOptions = {}): Promise<HTMLElement> {
  for (const [key, value] of Object.entries(options.preferences ?? {})) {
    fakes.store.preferences.set(key, value);
  }
  install_match_media(options.matchingMedia ?? []);
  const container = document.createElement("div");
  container.innerHTML = renderToString(createElement(HawkerSimulator));
  document.body.append(container);
  render(createElement(HawkerSimulator), { container, hydrate: true });

  const deadline = performance.now() + BOOT_TIMEOUT_MS;
  await act(async () => {
    while (fakes.pwa.registerPwa.mock.calls.length === 0) {
      if (performance.now() > deadline) {
        throw new Error("HawkerSimulator did not reach registerPwa; its startup failed or stalled");
      }
      await wait_for_next_turn();
    }
  });
  return container;
}

/**
 * @returns The options the component passed to `createHawkerRuntime`.
 * @throws Error If the runtime has not been created.
 */
function runtime_options(): RuntimeOptions {
  const options = fakes.runtime.options;
  if (options === undefined) throw new Error("createHawkerRuntime has not been called");
  return options;
}

/** Let pending promise chains finish inside `act`, without moving the fake clock. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
      await wait_for_next_turn();
    }
  });
}

/**
 * Advance the fake clock inside `act`, then let the promise chains it started finish.
 *
 * @param ms - Milliseconds to advance.
 */
async function advance_clock(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
      await wait_for_next_turn();
    }
  });
}

/** Run every queued animation frame inside `act`. */
function flush_frames(): void {
  act(() => {
    frames.run_all();
  });
}

/**
 * @param container - The component container.
 * @param selector - A CSS selector.
 * @returns The first matching element.
 * @throws Error If nothing matches.
 */
function require_element(container: HTMLElement, selector: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`No element matches ${selector}`);
  return element;
}

/**
 * @param container - The component container.
 * @param name - The accessible name of a dock tab, or a pattern for it.
 * @returns The dock button with that name.
 */
function dock_button(container: HTMLElement, name: string | RegExp): HTMLElement {
  return within(require_element(container, "nav.bottom-dock")).getByRole("button", { name });
}

/**
 * Open the Settings dialog from the header.
 *
 * @param container - The component container.
 * @returns The Settings dialog.
 */
function open_settings(container: HTMLElement): HTMLElement {
  fireEvent.click(
    within(require_element(container, "header.topbar")).getByRole("button", {
      name: "Open settings and icon guide",
    }),
  );
  return within(container).getByRole("dialog", { name: "Settings" });
}

/**
 * Open Settings, then its reset confirmation.
 *
 * @param container - The component container.
 */
function open_reset_dialog(container: HTMLElement): void {
  fireEvent.click(within(open_settings(container)).getByRole("button", { name: "Reset game…" }));
}

/**
 * Confirm the open reset dialog.
 *
 * @param container - The component container.
 */
function confirm_reset(container: HTMLElement): void {
  const reset_dialog = within(container).getByRole("alertdialog", { name: "Reset this centre?" });
  fireEvent.click(within(reset_dialog).getByRole("button", { name: "Reset game" }));
}

/**
 * @param container - The component container.
 * @returns The `aria-labelledby` id of every open modal dialog, in document order.
 */
function open_modal_titles(container: HTMLElement): readonly (string | null)[] {
  return Array.from(container.querySelectorAll("[aria-modal='true']")).map((modal) =>
    modal.getAttribute("aria-labelledby"),
  );
}

/**
 * @param element - An element that received focus.
 * @returns `body`, or the element's tag and trimmed text, for a focus log.
 */
function describe_focus_target(element: unknown): string {
  if (!(element instanceof HTMLElement)) return String(element);
  if (element === document.body) return "body";
  return `${element.tagName.toLowerCase()}: ${element.textContent?.trim() ?? ""}`;
}

/**
 * @param element - The element to serialise.
 * @returns Its outer HTML with one tag per line, so snapshot diffs stay readable.
 */
function format_markup(element: Element): string {
  return element.outerHTML.replaceAll("><", ">\n<");
}

/**
 * Boot a returning player, then deliver a runtime snapshot and {@link ACTIVITY_EVENTS}, as
 * the running centre would.
 *
 * @param snapshot - The runtime snapshot to deliver.
 * @param matching_media - Media queries that `matchMedia` reports as matching.
 * @returns The container that holds the hydrated component.
 */
async function boot_running_centre(
  snapshot: RuntimeSnapshot = SNAPSHOT_FIXTURE,
  matching_media: readonly string[] = [],
): Promise<HTMLElement> {
  const container = await boot_simulator({
    preferences: ONBOARDED_PREFERENCES,
    matchingMedia: matching_media,
  });
  act(() => {
    runtime_options().onSnapshot(snapshot);
    for (const event of ACTIVITY_EVENTS) runtime_options().onEvent(event);
  });
  return container;
}

/**
 * Open a section from the bottom dock.
 *
 * @param container - The component container.
 * @param tab - The dock tab to click.
 * @returns The management panel, now showing that section.
 */
function open_dock_tab(container: HTMLElement, tab: DockTab): HTMLElement {
  fireEvent.click(dock_button(container, new RegExp(`^${tab}`)));
  return require_element(container, "aside.catalogue-panel");
}

beforeEach(() => {
  fakes.reset();
  frames.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", frames.request);
  vi.stubGlobal("cancelAnimationFrame", frames.cancel);
});

afterEach(() => {
  cleanup();
  frames.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HawkerSimulator panels", () => {
  it.each(DOCK_TABS)("renders the %s panel for a captured runtime snapshot", async (tab) => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    act(() => {
      runtime_options().onSnapshot(SNAPSHOT_FIXTURE);
      for (const event of ACTIVITY_EVENTS) runtime_options().onEvent(event);
    });

    fireEvent.click(dock_button(container, new RegExp(`^${tab}`)));

    expect(format_markup(require_element(container, "aside.catalogue-panel"))).toMatchSnapshot();
  });
});

describe("HawkerSimulator panel contents", () => {
  it("shows today's objectives in the Focus panel", async () => {
    const panel = open_dock_tab(await boot_running_centre(), "Focus");

    expect(panel.querySelector(".focus-panel .objective-card h2")?.textContent).toBe(
      "Three ways to grow",
    );
  });

  it("shows the Activity panel with its note that routine events stay there", async () => {
    const panel = open_dock_tab(await boot_running_centre(), "Activity");

    expect(panel.querySelector(".activity-panel .activity-toolbar > span")?.textContent).toBe(
      "Latest first · routine events stay here",
    );
  });

  it("counts unread events on the Activity dock tab", async () => {
    const activity_tab = dock_button(await boot_running_centre(), /^Activity/);

    expect({
      name: activity_tab.getAttribute("aria-label"),
      badge: activity_tab.querySelector(".dock-unread")?.textContent,
    }).toEqual({ name: "Activity, 3 unread", badge: "3" });
  });

  it("labels each stall upgrade with its next level and required rank", async () => {
    const snapshot: RuntimeSnapshot = {
      ...SNAPSHOT_FIXTURE,
      stallMastery: SNAPSHOT_FIXTURE.stallMastery.map((mastery) =>
        mastery.definitionId === "stall.coconut-lime"
          ? { ...mastery, upgradeLevel: 2, requiredRank: 4 }
          : mastery,
      ),
    };
    const panel = open_dock_tab(await boot_running_centre(snapshot), "Stalls");

    expect(
      Array.from(
        panel.querySelectorAll(".stall-upgrade-button .stall-upgrade-copy"),
        (copy) => copy.textContent,
      ),
    ).toEqual([
      "Upgrade to level 2Requires mastery rank 2",
      "Upgrade to level 3Requires mastery rank 4",
    ]);
  });

  it("lists Centre journey milestones as label/value rows in the default locale's number format", async () => {
    const snapshot: RuntimeSnapshot = {
      ...SNAPSHOT_FIXTURE,
      milestoneTracks: [{ id: "service", title: "Service", tier: 2, progress: 1234.4, target: 5000 }],
    };
    const panel = open_dock_tab(await boot_running_centre(snapshot), "Insights");
    // The component formats with the runtime's default locale, so derive the expected
    // grouping the same way rather than assuming comma separators on every machine.
    const expected_value = `${(1234).toLocaleString()} / ${(5000).toLocaleString()}`;

    expect(
      Array.from(panel.querySelectorAll("dl.milestone-progress-list > div"), (row) =>
        Array.from(row.children, (cell) => `${cell.tagName.toLowerCase()}: ${cell.textContent}`),
      ),
    ).toEqual([["dt: Service tier 2", `dd: ${expected_value}`]]);
  });

  it("offers the Nutrition Lens toggle with its comparison note", async () => {
    const panel = open_dock_tab(await boot_running_centre(), "Dishes");
    const toolbar = require_element(panel, ".nutrition-lens-toolbar");

    expect([
      within(toolbar).queryByRole("checkbox", { name: "Nutrition Lens" }) !== null,
      toolbar.querySelector("p")?.textContent,
    ]).toEqual([true, "Compare health, popularity, and every nutrient per listed serving."]);
  });

  it("labels a dish row by its title and names its rating, nutrition and recipe buttons", async () => {
    const panel = open_dock_tab(await boot_running_centre(), "Dishes");
    fireEvent.change(require_element(panel, ".menu-stall-picker select"), {
      target: { value: "stall.coconut-lime" },
    });
    const dish_row = within(panel).getByRole("article", { name: "Nasi Lemak" });

    expect(
      within(dish_row)
        .getAllByRole("button")
        .map((button) => [button.getAttribute("aria-label"), button.textContent]),
    ).toEqual([
      ["Why this health rating", "i"],
      ["View nutrition for Nasi Lemak", "View nutrition"],
      ["Tune recipe for Nasi Lemak", "Tune recipe"],
    ]);
  });
});

describe("HawkerSimulator catalogue choices", () => {
  it("selects an unlocked build item for placement and shows its card", async () => {
    const panel = open_dock_tab(await boot_running_centre(), "Build");
    fakes.calls.length = 0;

    fireEvent.click(within(panel).getByRole("button", { name: "Compact Square Table, $90" }));

    expect({
      calls: fakes.calls.filter(([method]) => method.startsWith("controller.")),
      card: panel.querySelector(".selection-card strong")?.textContent,
    }).toEqual({
      calls: [
        ["controller.selectBuildItem", "item.compact-square-table"],
        ["controller.setBuildTool", "place"],
      ],
      card: "Compact Square Table",
    });
  });

  it("clears the selected build item from its card", async () => {
    const panel = open_dock_tab(await boot_running_centre(), "Build");
    fireEvent.click(within(panel).getByRole("button", { name: "Compact Square Table, $90" }));
    fakes.calls.length = 0;

    fireEvent.click(within(panel).getByRole("button", { name: "Clear selection" }));

    expect({
      calls: fakes.calls.filter(([method]) => method.startsWith("controller.")),
      has_card: panel.querySelector(".selection-card") !== null,
    }).toEqual({ calls: [["controller.selectBuildItem", undefined]], has_card: false });
  });

  it("announces what unlocks a locked stall instead of selecting it", async () => {
    const container = await boot_running_centre();
    const panel = open_dock_tab(container, "Stalls");
    const locked_card = Array.from(panel.querySelectorAll<HTMLElement>(".stall-card")).find(
      (card) => card.querySelector("strong")?.textContent === "Kopi Canopy",
    )!;
    fakes.calls.length = 0;

    fireEvent.click(locked_card);

    expect({
      calls: fakes.calls.filter(([method]) => method.startsWith("controller.")),
      toast: container.querySelector(".toast.warning p")?.textContent,
    }).toEqual({ calls: [], toast: "Kopi Canopy unlocks with rep 10." });
  });

  it("routes an operating stall's queue from its direction buttons", async () => {
    const panel = open_dock_tab(await boot_running_centre(), "Stalls");
    fakes.calls.length = 0;

    fireEvent.click(within(panel).getByRole("button", { name: "Route Sunrise Roost queue east" }));

    expect(fakes.calls.filter(([method]) => method.startsWith("controller."))).toEqual([
      ["controller.setQueueDirection", "starter-1", "east"],
    ]);
  });
});

describe("HawkerSimulator painted thumbnails", () => {
  it("shows the runtime's painted thumbnail on a Build card, keeping its name", async () => {
    fakes.previewUrls.set("item.compact-square-table", "data:image/png;base64,VEFCTEU=");
    const panel = open_dock_tab(await boot_running_centre(), "Build");

    flush_frames();
    const card = within(panel).getByRole("button", { name: "Compact Square Table, $90" });

    expect({
      painted: card.querySelector(".item-art.has-painting img")?.getAttribute("src"),
      glyph: card.querySelector(".item-art > span")?.textContent,
      others_painted: panel.querySelectorAll(".has-painting").length,
    }).toEqual({ painted: "data:image/png;base64,VEFCTEU=", glyph: undefined, others_painted: 1 });
  });

  it("keeps the glyphs while the runtime cannot paint yet", async () => {
    const panel = open_dock_tab(await boot_running_centre(), "Build");

    flush_frames();

    expect(panel.querySelectorAll("img.painted-preview").length).toBe(0);
  });
});

describe("HawkerSimulator autosave", () => {
  it("coalesces three persistent changes within the debounce into one save of the last", async () => {
    await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    const changes = [{ marker: "change-1" }, { marker: "change-2" }, { marker: "change-3" }];

    for (const change of changes) {
      act(() => {
        runtime_options().onPersistentChange(change);
      });
      await advance_clock(CHANGE_GAP_MS);
    }
    await advance_clock(AUTOSAVE_DEBOUNCE_MS);

    expect(fakes.store.saveGame.mock.calls).toEqual([[changes[2]]]);
  });

  it("saves only once the full debounce has passed since the last change", async () => {
    await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    const change = { marker: "change" };

    act(() => {
      runtime_options().onPersistentChange(change);
    });
    await advance_clock(AUTOSAVE_DEBOUNCE_MS - 1);
    const calls_before_debounce = fakes.store.saveGame.mock.calls.length;
    await advance_clock(1);

    expect([calls_before_debounce, fakes.store.saveGame.mock.calls]).toEqual([0, [[change]]]);
  });

  it("shows the error badge and copy when a save fails", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    fakes.store.failingMethods.add("saveGame");
    expect_console_warning(/\[autosave\] write failed Error: Simulated saveGame failure/);

    act(() => {
      runtime_options().onPersistentChange({ marker: "change" });
    });
    await advance_clock(AUTOSAVE_DEBOUNCE_MS);

    expect({
      badge: require_element(container, ".save-state").outerHTML,
      toast: require_element(container, ".toast.error").textContent,
    }).toEqual({
      badge:
        '<div class="save-state" role="status"><span class="error-dot"></span>Save needs attention</div>',
      toast: "!Could not save locally. Storage may be unavailable or full.",
    });
  });

  it("flushes a pending save on pagehide without waiting for the debounce", async () => {
    await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    const change = { marker: "change" };

    act(() => {
      runtime_options().onPersistentChange(change);
    });
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await settle();
    const calls_after_pagehide = [...fakes.store.saveGame.mock.calls];
    await advance_clock(AUTOSAVE_DEBOUNCE_MS);

    expect([calls_after_pagehide, fakes.store.saveGame.mock.calls]).toEqual([
      [[change]],
      [[change]],
    ]);
  });

  it("queues a manual save behind an autosave that is still in flight", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    const change = { marker: "change" };
    fakes.store.hold_saves();
    act(() => {
      runtime_options().onPersistentChange(change);
    });
    await advance_clock(AUTOSAVE_DEBOUNCE_MS);

    fireEvent.click(dock_button(container, "Save now"));
    await settle();
    const calls_while_held = [...fakes.store.saveGame.mock.calls];
    fakes.store.release_saves();
    await settle();

    expect([calls_while_held, fakes.store.saveGame.mock.calls]).toEqual([
      [[change]],
      [[change], [fakes.runtime.exportedState]],
    ]);
  });
});

describe("HawkerSimulator local data", () => {
  it("exports the save as a file named for the current day", async () => {
    const container = await boot_running_centre({ ...SNAPSHOT_FIXTURE, day: 12 });
    const create_url_spy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:hawker-save");
    const revoke_url_spy = vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
    const click_spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue(undefined);
    onTestFinished(() => {
      create_url_spy.mockRestore();
      revoke_url_spy.mockRestore();
      click_spy.mockRestore();
    });

    fireEvent.click(within(open_settings(container)).getByRole("button", { name: "Export save" }));

    expect(click_spy.mock.contexts.map((link) => (link as HTMLAnchorElement).download)).toEqual([
      "hawker-balance-day-12.json",
    ]);
  });

  it("stores the controller's re-exported state after importing a valid save", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    const imported_payload = { runtimeSchemaVersion: 2, core: { marker: "imported" } };
    const file = new File([exportSave(imported_payload)], "valid-save.json", {
      type: "application/json",
    });

    fireEvent.change(require_element(open_settings(container), 'input[type="file"]'), {
      target: { files: [file] },
    });
    await settle();

    expect({
      importCalls: fakes.calls.filter(([method]) => method === "controller.importState"),
      saveCalls: fakes.store.saveGame.mock.calls,
    }).toEqual({
      importCalls: [["controller.importState", imported_payload]],
      saveCalls: [[fakes.runtime.exportedState]],
    });
  });

  it("announces an error for an invalid import file", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    const settings = open_settings(container);
    const file = new File(['{"saveVersion":9}'], "broken-save.json", {
      type: "application/json",
    });

    fireEvent.change(require_element(settings, 'input[type="file"]'), {
      target: { files: [file] },
    });
    await settle();

    expect({
      toast: require_element(container, ".toast.error").textContent,
      importCalls: fakes.calls.filter(([method]) => method === "controller.importState"),
    }).toEqual({
      toast: "!The save file is damaged or unsupported.",
      importCalls: [],
    });
  });

  it("resets in a fixed order of store and controller calls", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    open_reset_dialog(container);
    fakes.calls.length = 0;

    confirm_reset(container);
    await settle();

    expect(fakes.calls).toEqual([
      ["clearGame"],
      ["controller.reset"],
      ["savePreference", "tutorial-complete", false],
      ["savePreference", "nutrition-tour-v1-complete", false],
    ]);
  });

  // The pagehide after the debounce would flush a payload that the reset had only
  // un-scheduled, so it checks that the reset dropped the payload as well as the timer.
  it("drops a pending autosave when the centre is reset", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    open_reset_dialog(container);
    act(() => {
      runtime_options().onPersistentChange({ marker: "change" });
    });

    confirm_reset(container);
    await settle();
    await advance_clock(AUTOSAVE_DEBOUNCE_MS);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await settle();

    expect(fakes.store.saveGame).not.toHaveBeenCalled();
  });

  it("waits for a save in flight before it clears the stored game", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    fakes.store.hold_saves();
    act(() => {
      runtime_options().onPersistentChange({ marker: "change" });
    });
    await advance_clock(AUTOSAVE_DEBOUNCE_MS);
    open_reset_dialog(container);
    fakes.calls.length = 0;

    confirm_reset(container);
    await settle();
    const calls_while_held = [...fakes.calls];
    fakes.store.release_saves();
    await settle();

    expect([calls_while_held, fakes.calls]).toEqual([
      [],
      [
        ["clearGame"],
        ["controller.reset"],
        ["savePreference", "tutorial-complete", false],
        ["savePreference", "nutrition-tour-v1-complete", false],
      ],
    ]);
  });
});

describe("HawkerSimulator storage failures", () => {
  it("logs a failed preference read and announces that defaults are in use", async () => {
    fakes.store.failingMethods.add("loadPreference");
    expect_console_warning(
      /\[ui\] preferences load failed Error: Simulated loadPreference failure/,
    );

    const container = await boot_simulator();

    expect(require_element(container, ".toast.warning").textContent).toBe(
      "iLocal preferences are unavailable. The game will continue with defaults.",
    );
  });

  it("logs a failed save read and announces that progress may not persist", async () => {
    fakes.store.failingMethods.add("loadGameCandidates");
    expect_console_warning(/\[ui\] saves load failed Error: Simulated loadGameCandidates failure/);

    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });

    expect(require_element(container, ".toast.warning").textContent).toBe(
      "iLocal saves are unavailable in this browser session. You can still play, but progress may not persist.",
    );
  });

  it("logs every failed preference write and announces the first", async () => {
    fakes.store.failingMethods.add("savePreference");
    for (const key of ["settings", "settings", "nutrition-lens-enabled"]) {
      expect_console_warning(
        new RegExp(`\\[ui\\] preference "${key}" write failed Error: Simulated savePreference failure`),
      );
    }

    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });

    expect(require_element(container, ".toast.warning").textContent).toBe(
      "iPreferences could not be saved on this device.",
    );
  });

  it("logs a failed save removal on reset and still resets the centre", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    fakes.store.failingMethods.add("clearGame");
    expect_console_warning(/\[ui\] save clear failed Error: Simulated clearGame failure/);
    open_reset_dialog(container);
    fakes.calls.length = 0;

    confirm_reset(container);
    await settle();

    expect({
      calls: fakes.calls,
      toast: require_element(container, ".toast.warning").textContent,
    }).toEqual({
      calls: [
        ["clearGame"],
        ["controller.reset"],
        ["savePreference", "tutorial-complete", false],
        ["savePreference", "nutrition-tour-v1-complete", false],
      ],
      toast: "iThe stored save could not be removed.",
    });
  });
});

describe("HawkerSimulator settings", () => {
  it("hands out-of-range saved settings to the runtime clamped", async () => {
    await boot_simulator({
      preferences: {
        ...ONBOARDED_PREFERENCES,
        settings: {
          quality: "ultra",
          reducedMotion: true,
          highContrast: true,
          textScale: 2,
          musicVolume: 1.8,
          ambienceVolume: -0.3,
          sfxVolume: 7,
          masterMuted: true,
        },
      },
    });

    expect(runtime_options().settings).toEqual({
      quality: "standard",
      reducedMotion: true,
      highContrast: true,
      textScale: 1.35,
      musicVolume: 1,
      ambienceVolume: 0,
      sfxVolume: 1,
      masterMuted: true,
    });
  });

  it("falls back to the saved music volume, clamped, when the ambience volume is missing", async () => {
    await boot_simulator({
      preferences: { ...ONBOARDED_PREFERENCES, settings: { musicVolume: -0.5 } },
    });

    expect(runtime_options().settings).toEqual({
      ...DEFAULT_SETTINGS,
      musicVolume: 0,
      ambienceVolume: 0,
    });
  });

  it("reads saved settings before the mount writes the defaults over them", async () => {
    const saved_settings = { ...DEFAULT_SETTINGS, highContrast: true };
    await boot_simulator({
      preferences: { ...ONBOARDED_PREFERENCES, settings: saved_settings },
    });

    expect(
      fakes.calls.filter(
        ([method, key]) =>
          (method === "loadPreference" || method === "savePreference") && key === "settings",
      ),
    ).toEqual([
      ["loadPreference", "settings"],
      ["savePreference", "settings", DEFAULT_SETTINGS],
      ["savePreference", "settings", saved_settings],
    ]);
  });

  it("keeps saved settings across a remount", async () => {
    const saved_settings = { ...DEFAULT_SETTINGS, textScale: 1.35, musicVolume: 0 };
    await boot_simulator({
      preferences: { ...ONBOARDED_PREFERENCES, settings: saved_settings },
    });
    cleanup();
    fakes.pwa.registerPwa.mockClear();

    await boot_simulator();

    expect([runtime_options().settings, fakes.store.preferences.get("settings")]).toEqual([
      saved_settings,
      saved_settings,
    ]);
  });
});

describe("HawkerSimulator focus", () => {
  it("returns focus to the dock tab that opened the management sheet", async () => {
    const container = await boot_simulator({
      preferences: ONBOARDED_PREFERENCES,
      matchingMedia: [COMPACT_LAYOUT_QUERY],
    });
    const opener = dock_button(container, "Stalls");

    fireEvent.click(opener);
    flush_frames();
    fireEvent.click(
      within(require_element(container, "aside.catalogue-panel")).getByRole("button", {
        name: "Close management sheet",
      }),
    );
    flush_frames();

    expect(document.activeElement).toBe(opener);
  });

  it("opens the compact management sheet as a modal dialog", async () => {
    const container = await boot_simulator({
      preferences: ONBOARDED_PREFERENCES,
      matchingMedia: [COMPACT_LAYOUT_QUERY],
    });

    const sheet = open_dock_tab(container, "Stalls");

    expect({ role: sheet.getAttribute("role"), modal: sheet.getAttribute("aria-modal") }).toEqual({
      role: "dialog",
      modal: "true",
    });
  });

  // The Focus panel ends with the nutrition disclosure, so the sheet's last focusable
  // element is a `<summary>` and its first is the sheet's close button.
  it("wraps Tab from the sheet's last control, a disclosure summary, to its first", async () => {
    const container = await boot_running_centre(SNAPSHOT_FIXTURE, [COMPACT_LAYOUT_QUERY]);
    const sheet = open_dock_tab(container, "Focus");
    flush_frames();
    const summaries = sheet.querySelectorAll<HTMLElement>("summary");
    act(() => {
      summaries[summaries.length - 1]?.focus();
    });

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close management sheet");
  });

  it("leaves focus where it is when focus is outside the sheet as the sheet closes", async () => {
    const container = await boot_simulator({
      preferences: ONBOARDED_PREFERENCES,
      matchingMedia: [COMPACT_LAYOUT_QUERY],
    });
    const sheet = open_dock_tab(container, "Stalls");
    flush_frames();
    const game_world = require_element(container, '[data-testid="game-world"]');
    act(() => {
      game_world.focus();
    });

    fireEvent.click(within(sheet).getByRole("button", { name: "Close management sheet" }));
    flush_frames();

    expect(document.activeElement).toBe(game_world);
  });

  it("returns focus to the game world when the visit inspector holding focus closes", async () => {
    const container = await boot_running_centre({
      ...SNAPSHOT_FIXTURE,
      selectedCustomerNutrition: SELECTED_GUEST,
    });
    act(() => {
      within(container).getByRole("button", { name: "Close customer inspector" }).focus();
    });

    act(() => {
      runtime_options().onSnapshot(SNAPSHOT_FIXTURE);
    });
    flush_frames();

    expect(document.activeElement).toBe(require_element(container, '[data-testid="game-world"]'));
  });

  it("closes Reset, then Settings, on successive Escape presses", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    open_reset_dialog(container);
    const titles = [open_modal_titles(container)];

    fireEvent.keyDown(document, { key: "Escape" });
    titles.push(open_modal_titles(container));
    fireEvent.keyDown(document, { key: "Escape" });
    titles.push(open_modal_titles(container));

    expect(titles).toEqual([["settings-title", "reset-title"], ["settings-title"], []]);
  });

  // The hydrated tutorial button keeps the server markup's `autofocus` attribute, and the
  // modal effect picks `[autofocus]` before the first focusable element ("Skip tutorial").
  it("focuses the server-rendered autofocus button when the tutorial opens", async () => {
    await boot_simulator();

    flush_frames();

    expect(describe_focus_target(document.activeElement)).toBe("button: Show me around →");
  });

  // Frames stay queued through boot, so the step-0 effect recorded `body` as the focus to
  // restore. That makes the restore target differ from the step's initial element, which
  // shows the order of the two queued frames: a reversed order would leave `body` focused.
  it("restores the previous focus, then focuses the step's initial element, when the tutorial advances", async () => {
    const container = await boot_simulator();
    const focus_spy = vi.spyOn(HTMLElement.prototype, "focus");
    onTestFinished(() => {
      focus_spy.mockRestore();
    });
    flush_frames();
    focus_spy.mockClear();

    fireEvent.click(within(container).getByRole("button", { name: "Show me around" }));
    flush_frames();

    expect({
      focused: focus_spy.mock.contexts.map(describe_focus_target),
      active: describe_focus_target(document.activeElement),
    }).toEqual({
      focused: ["body", "button: Got it →"],
      active: "button: Got it →",
    });
  });

  // Replay closes Help and reopens the tutorial in one render. React's `autoFocus` focuses the
  // primary button at commit; then the Help trap's cleanup frame returns focus to the Help
  // opener, and the tutorial trap's frame focuses its first focusable element, because a
  // client-rendered button carries no `autofocus` attribute. This pins today's order.
  it("returns focus to the Help opener, then focuses the replayed tutorial, when replay starts from Help", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });
    const help_opener = within(container).getByRole("button", { name: "Open help" });
    act(() => {
      help_opener.focus();
    });
    fireEvent.click(help_opener);
    flush_frames();
    const focus_spy = vi.spyOn(HTMLElement.prototype, "focus");
    onTestFinished(() => {
      focus_spy.mockRestore();
    });

    fireEvent.click(within(container).getByRole("button", { name: "Replay tutorial" }));
    flush_frames();

    expect({
      focused: focus_spy.mock.contexts.map(describe_focus_target),
      active: describe_focus_target(document.activeElement),
    }).toEqual({
      focused: ["button: Show me around →", "button: ?", "button: Skip tutorial"],
      active: "button: Skip tutorial",
    });
  });
});

describe("HawkerSimulator Service Review", () => {
  /** The fixture's neighbourhood, whose last report is day 1's. */
  const NEIGHBOURHOOD = SNAPSHOT_FIXTURE.neighbourhood!;

  /**
   * @param speed - The simulation speed the snapshot reports.
   * @returns The fixture moved on to day 3, with day 2's report just in.
   */
  function snapshot_after_day_two(speed: RuntimeSnapshot["speed"] = 2): RuntimeSnapshot {
    return {
      ...SNAPSHOT_FIXTURE,
      day: 3,
      speed,
      neighbourhood: {
        ...NEIGHBOURHOOD,
        lastReport: { ...NEIGHBOURHOOD.lastReport!, day: 2, cardName: "Late-morning kopi crowd" },
      },
    };
  }

  /**
   * @param container - The component container.
   * @returns The open Service Review dialog, or `null`.
   */
  function find_review(container: HTMLElement): HTMLElement | null {
    return within(container).queryByRole("dialog", { name: /wrapped/ });
  }

  /**
   * @returns Every speed the component asked the controller for, in order.
   */
  function speed_calls(): unknown[] {
    return fakes.calls.filter(([method]) => method === "controller.setSpeed").map(([, speed]) => speed);
  }

  it("does not open for the report already in the first snapshot after mount", async () => {
    const container = await boot_running_centre();

    expect([find_review(container), speed_calls()]).toEqual([null, []]);
  });

  it("opens when a new report day arrives during play and pauses the simulation", async () => {
    const container = await boot_running_centre();

    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two());
    });

    expect([
      find_review(container)?.querySelector("h2")?.textContent,
      open_modal_titles(container),
      speed_calls(),
    ]).toEqual([
      "Day 2 wrapped · Late-morning kopi crowd",
      ["service-review-title"],
      [0],
    ]);
  });

  it("does not reopen for the same report day on later snapshots", async () => {
    const container = await boot_running_centre();
    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two());
    });
    fireEvent.click(within(container).getByRole("button", { name: "Open for Day 3" }));

    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two());
    });

    expect([find_review(container), speed_calls()]).toEqual([null, [0, 2]]);
  });

  it("restores the earlier speed when its button opens the next day", async () => {
    const container = await boot_running_centre();
    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two(1));
    });

    fireEvent.click(within(container).getByRole("button", { name: "Open for Day 3" }));

    expect([find_review(container), speed_calls()]).toEqual([null, [0, 1]]);
  });

  it("closes only the review on Escape, restoring the speed and leaving the tour alone", async () => {
    const container = await boot_running_centre();
    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two());
    });
    fakes.calls.length = 0;

    fireEvent.keyDown(document, { key: "Escape" });
    await settle();

    expect({
      modals: open_modal_titles(container),
      calls: fakes.calls.filter(([method]) => method !== "loadPreference"),
    }).toEqual({ modals: [], calls: [["controller.setSpeed", 2]] });
  });

  it("opens at 4× speed and faster too, pausing and then restoring that speed", async () => {
    const container = await boot_running_centre();
    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two(10));
    });
    const title = find_review(container)?.querySelector("h2")?.textContent;

    fireEvent.click(within(container).getByRole("button", { name: "Open for Day 3" }));

    expect([title, find_review(container), speed_calls()]).toEqual([
      "Day 2 wrapped · Late-morning kopi crowd",
      null,
      [0, 10],
    ]);
  });

  it("waits, unread, while another dialog is open, then opens as soon as it closes", async () => {
    const container = await boot_running_centre();
    open_settings(container);
    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two());
    });
    const blocked = open_modal_titles(container);
    const calls_while_blocked = speed_calls();

    fireEvent.keyDown(document, { key: "Escape" });
    await settle();

    expect([blocked, calls_while_blocked, open_modal_titles(container), speed_calls()]).toEqual([
      ["settings-title"],
      [],
      ["service-review-title"],
      [0],
    ]);
  });

  it("can still be reopened from the Focus panel after it closes", async () => {
    const container = await boot_running_centre();
    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two());
    });
    fireEvent.click(within(container).getByRole("button", { name: "Open for Day 3" }));
    const summary = require_element(open_dock_tab(container, "Focus"), ".service-review-summary");

    fireEvent.click(within(summary).getByRole("button", { name: "Read the full review" }));

    expect([summary.dataset.unread, open_modal_titles(container), speed_calls()]).toEqual([
      "false",
      ["service-review-title"],
      [0, 2, 0],
    ]);
  });

  it("only records the report day of an imported save, then opens for the next new day", async () => {
    const container = await boot_running_centre();
    const file = new File([exportSave(fakes.runtime.exportedState)], "save.json", {
      type: "application/json",
    });
    fireEvent.change(require_element(open_settings(container), 'input[type="file"]'), {
      target: { files: [file] },
    });
    await settle();
    fireEvent.keyDown(document, { key: "Escape" });

    act(() => {
      runtime_options().onSnapshot(snapshot_after_day_two());
    });
    const after_import = open_modal_titles(container);
    act(() => {
      const next = snapshot_after_day_two();
      runtime_options().onSnapshot({
        ...next,
        neighbourhood: {
          ...next.neighbourhood!,
          lastReport: { ...next.neighbourhood!.lastReport!, day: 3 },
        },
      });
    });

    expect([after_import, open_modal_titles(container)]).toEqual([[], ["service-review-title"]]);
  });
});

describe("HawkerSimulator toasts", () => {
  it("keeps up to three toasts, newest first, and drops a routine one before an error", async () => {
    const container = await boot_simulator({ preferences: ONBOARDED_PREFERENCES });

    act(() => {
      runtime_options().onEvent({ kind: "error", message: "Save failed" });
      runtime_options().onEvent({ kind: "warning", message: "Route blocked" });
      runtime_options().onEvent({ kind: "success", message: "Plaque", importance: "important" });
      runtime_options().onEvent({ kind: "warning", message: "Queue full" });
    });

    expect(
      Array.from(container.querySelectorAll(".toast-stack .toast p"), (toast) => toast.textContent),
    ).toEqual(["Queue full", "Plaque", "Save failed"]);
  });
});

describe("HawkerSimulator practice day", () => {
  /** The controller and store calls that move or save a centre. */
  const CENTRE_CALLS = new Set([
    "saveGame",
    "controller.exportState",
    "controller.importState",
    "controller.reset",
  ]);

  /** The notice shown when the player tries to save, load or reset during practice. */
  const NOT_SAVED =
    "This is a practice day, so nothing is saved. Press Exit practice to go back to your own centre.";

  /** How many cards the main practice day has, welcome to finish. */
  const PRACTICE_MAIN_STEP_COUNT = 24;

  /** How many cards the practice day has with its bonus steps. */
  const PRACTICE_STEP_COUNT = 27;

  /** The notice shown as practice starts. */
  const PRACTICE_STARTED = "Practice day started. Nothing here is saved.";

  /**
   * @param container - The component container.
   * @returns The text of each toast on screen, in stack order.
   */
  function toast_messages(container: HTMLElement): readonly (string | null)[] {
    return Array.from(container.querySelectorAll(".toast-stack .toast p"), (toast) => toast.textContent);
  }

  /**
   * Open Help and start the practice day from it, then let the save before it finish.
   *
   * @param container - The component container.
   */
  async function start_practice_from_help(container: HTMLElement): Promise<void> {
    fireEvent.click(within(container).getByRole("button", { name: "Open help" }));
    fireEvent.click(within(container).getByRole("button", { name: "Practice day with a guide" }));
    await settle();
  }

  /** @returns The recorded calls that move or save a centre, in issue order. */
  function centre_calls(): readonly FakeCall[] {
    return fakes.calls.filter(([method]) => CENTRE_CALLS.has(method));
  }

  /**
   * @param container - The component container.
   * @returns The practice coach's heading, or undefined while it is hidden.
   */
  function coach_title(container: HTMLElement): string | undefined {
    return container.querySelector(".practice-coach h2")?.textContent ?? undefined;
  }

  it("saves the player's centre, then swaps in a fresh one with the guide on its first step", async () => {
    const container = await boot_running_centre();
    fakes.calls.length = 0;

    await start_practice_from_help(container);

    expect({
      calls: centre_calls(),
      title: coach_title(container),
      save_state: require_element(container, ".save-state").textContent,
    }).toEqual({
      calls: [
        ["controller.exportState"],
        ["saveGame", fakes.runtime.exportedState],
        ["controller.exportState"],
        ["controller.reset"],
      ],
      title: "Welcome to your practice day!",
      save_state: "Practice day · not saved",
    });
  });

  it("swaps centres once when practice is started twice during the save before it", async () => {
    const container = await boot_running_centre();
    fakes.store.hold_saves();
    fakes.calls.length = 0;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.click(within(container).getByRole("button", { name: "Open help" }));
      fireEvent.click(within(container).getByRole("button", { name: "Practice day with a guide" }));
    }
    await settle();
    fakes.store.release_saves();
    await settle();

    expect(fakes.calls.filter(([method]) => method === "controller.reset")).toEqual([
      ["controller.reset"],
    ]);
  });

  it("saves nothing while practising, from the autosave or from Save now", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);
    fakes.calls.length = 0;

    act(() => {
      runtime_options().onPersistentChange({ marker: "practice-change" });
    });
    await advance_clock(AUTOSAVE_DEBOUNCE_MS);
    fireEvent.click(dock_button(container, "Save now"));
    await settle();

    expect({
      calls: centre_calls(),
      toasts: toast_messages(container),
    }).toEqual({ calls: [], toasts: [NOT_SAVED, PRACTICE_STARTED] });
  });

  it("turns off export, import and reset in Settings while practising, and says why there", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);

    const settings = open_settings(container);
    fireEvent.click(within(settings).getByRole("button", { name: "Reset game…" }));

    expect({
      disabled: ["Export save", "Import save", "Reset game…"].map(
        (name) => (within(settings).getByRole("button", { name }) as HTMLButtonElement).disabled,
      ),
      note: settings.querySelector(".settings-practice-note")?.textContent,
      modals: open_modal_titles(container),
    }).toEqual({
      disabled: [true, true, true],
      note: "This is a practice day, so saving, loading and resetting are turned off. Press Exit practice to go back to your own centre.",
      modals: ["settings-title"],
    });
  });

  it("loads the player's centre back on exit, at the speed they left it, and saves again", async () => {
    const container = await boot_running_centre({ ...SNAPSHOT_FIXTURE, speed: 2 });
    await start_practice_from_help(container);
    fakes.calls.length = 0;
    fakes.store.saveGame.mockClear();

    fireEvent.click(
      within(require_element(container, ".practice-coach")).getByRole("button", {
        name: "Exit practice",
      }),
    );
    const exit_calls = fakes.calls.filter(([method]) => method.startsWith("controller."));
    act(() => {
      runtime_options().onPersistentChange({ marker: "own-change" });
    });
    await advance_clock(AUTOSAVE_DEBOUNCE_MS);

    expect({
      exit_calls,
      saves: fakes.store.saveGame.mock.calls,
      title: coach_title(container),
      save_state: require_element(container, ".save-state").textContent,
      newest_toast: toast_messages(container)[0],
    }).toEqual({
      exit_calls: [
        ["controller.importState", fakes.runtime.exportedState],
        ["controller.setBuildTool", "select"],
        ["controller.selectBuildItem", undefined],
        ["controller.selectCustomer", undefined],
        ["controller.setSpeed", 2],
      ],
      saves: [[{ marker: "own-change" }]],
      title: undefined,
      save_state: "Saved on this device",
      newest_toast: "Welcome back to your own centre!",
    });
  });

  it("moves through the guide, passing over the put-down cards of skipped picks and pausing to build, on the next morning and on the finish card", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);
    fakes.calls.length = 0;

    const titles: (string | undefined)[] = [];
    for (
      let step = 0;
      step < PRACTICE_MAIN_STEP_COUNT && coach_title(container) !== "You're ready!";
      step += 1
    ) {
      press_on(container);
      titles.push(coach_title(container));
    }
    const finish_buttons = coach_buttons(container);
    fireEvent.click(within(container).getByRole("button", { name: "Bonus tools" }));
    const bonus_title = coach_title(container);
    press_on(container);
    press_on(container);

    expect({
      morning: titles.indexOf("Good morning, day 2!") >= 0,
      put_down_cards: titles.filter((title) => title === "Put it down" || title === "Find it a spot"),
      last_titles: titles.slice(-2),
      speeds: fakes.calls.filter(([method]) => method === "controller.setSpeed"),
      finish_buttons,
      bonus_title,
      end: [coach_title(container), coach_buttons(container)],
    }).toEqual({
      morning: true,
      put_down_cards: [],
      last_titles: ["Try a new recipe", "You're ready!"],
      speeds: [
        ["controller.setSpeed", 0],
        ["controller.setSpeed", 0],
        ["controller.setSpeed", 0],
      ],
      finish_buttons: ["–", "← Back", "Keep practising", "Bonus tools", "Go to my centre →"],
      bonus_title: "Add a door",
      end: [
        "Bonus tools done!",
        ["–", "← Back", "Keep practising", "Go to my centre →"],
      ],
    });
  });

  it("steps back to the previous card without pausing the game", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);
    const next = () =>
      fireEvent.click(
        within(require_element(container, ".practice-coach")).getByRole("button", {
          name: /^(Let's go|Next)$/,
        }),
      );
    next();
    next();
    fakes.calls.length = 0;

    fireEvent.click(
      within(require_element(container, ".practice-coach")).getByRole("button", { name: "Back" }),
    );

    expect({
      title: coach_title(container),
      speeds: fakes.calls.filter(([method]) => method === "controller.setSpeed"),
    }).toEqual({ title: "Your cash and your hearts", speeds: [] });
  });

  it("folds the guide away and opens it again from the action strip", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);

    fireEvent.click(within(container).getByRole("button", { name: "Hide the practice guide" }));
    const folded = coach_title(container);
    const strip = require_element(container, ".action-strip");
    fireEvent.click(within(strip).getByRole("button", { name: "Show guide" }));

    expect([folded, coach_title(container)]).toEqual([undefined, "Welcome to your practice day!"]);
  });

  it("skips the cash card where the screen hides the cash, as on a phone", async () => {
    const container = await boot_running_centre();
    // jsdom has no checkVisibility, so the coach treats every target as visible unless a test
    // supplies one; this one hides the cash, as the phone layout does.
    Object.defineProperty(HTMLElement.prototype, "checkVisibility", {
      configurable: true,
      value(this: HTMLElement) {
        return !this.matches(".hud-stats");
      },
    });
    onTestFinished(() => {
      Reflect.deleteProperty(HTMLElement.prototype, "checkVisibility");
    });
    await start_practice_from_help(container);

    fireEvent.click(within(container).getByRole("button", { name: "Let's go" }));

    expect(coach_title(container)).toBe("The clock and the speed buttons");
  });

  it("closes the phone sheet when the guide is folded, so the strip's controls show", async () => {
    const container = await boot_running_centre(SNAPSHOT_FIXTURE, [COMPACT_LAYOUT_QUERY]);
    await start_practice_from_help(container);
    open_dock_tab(container, "Insights");
    const was_open = require_element(container, "main.game-shell").dataset.managementOpen;

    fireEvent.click(within(container).getByRole("button", { name: "Hide the practice guide" }));

    expect([was_open, require_element(container, "main.game-shell").dataset.managementOpen]).toEqual([
      "true",
      "false",
    ]);
  });

  it("closes the phone sheet, letting go of the guest, when a card is played on the map", async () => {
    const container = await boot_running_centre(SNAPSHOT_FIXTURE, [COMPACT_LAYOUT_QUERY]);
    await start_practice_from_help(container);
    open_dock_tab(container, "Insights");
    const was_open = require_element(container, "main.game-shell").dataset.managementOpen;
    fakes.calls.length = 0;

    fireEvent.click(within(container).getByRole("button", { name: "Let's go" }));
    fireEvent.click(
      within(require_element(container, ".practice-coach")).getByRole("button", { name: "Next" }),
    );
    go_to_card(container, "Your hawker centre");

    expect([
      was_open,
      require_element(container, "main.game-shell").dataset.managementOpen,
      fakes.calls.filter(([method]) => method === "controller.selectCustomer"),
    ]).toEqual(["true", "false", [["controller.selectCustomer", undefined]]]);
  });

  it("keeps stepping back past a card the screen hides, instead of bouncing forward", async () => {
    const container = await boot_running_centre();
    Object.defineProperty(HTMLElement.prototype, "checkVisibility", {
      configurable: true,
      value(this: HTMLElement) {
        return !this.matches(".hud-stats");
      },
    });
    onTestFinished(() => {
      Reflect.deleteProperty(HTMLElement.prototype, "checkVisibility");
    });
    await start_practice_from_help(container);
    fireEvent.click(within(container).getByRole("button", { name: "Let's go" }));
    const forward = coach_title(container);

    fireEvent.click(
      within(require_element(container, ".practice-coach")).getByRole("button", { name: "Back" }),
    );

    expect([forward, coach_title(container)]).toEqual([
      "The clock and the speed buttons",
      "Welcome to your practice day!",
    ]);
  });

  /**
   * Move the coach on one card: Next, or Skip on an unfinished task. A task that cannot be
   * skipped, the end of the day, is finished first by a snapshot of the next day.
   *
   * @param container - The component container.
   */
  function press_on(container: HTMLElement): void {
    const find_button = () =>
      within(require_element(container, ".practice-coach")).queryByRole("button", {
        name: /^(Let's go|Next|Skip this step)$/,
      });
    if (find_button() === null) {
      // The first snapshot sets the practice baseline, if none has arrived yet.
      push_snapshot({});
      push_snapshot({ day: SNAPSHOT_FIXTURE.day + 1 });
    }
    const button = find_button();
    if (button === null) throw new Error(`No way on from "${coach_title(container)}"`);
    fireEvent.click(button);
  }

  /**
   * @param container - The component container.
   * @returns The text of each button on the coach's card.
   */
  function coach_buttons(container: HTMLElement): readonly (string | null)[] {
    return within(require_element(container, ".practice-coach"))
      .getAllByRole("button")
      .map((button) => button.textContent);
  }

  /**
   * Press on until the coach shows a card.
   *
   * @param container - The component container.
   * @param title - The card's heading.
   */
  function go_to_card(container: HTMLElement, title: string): void {
    for (let step = 0; step < PRACTICE_STEP_COUNT && coach_title(container) !== title; step += 1) {
      press_on(container);
    }
  }

  /**
   * Push a runtime snapshot of the running centre with some fields changed.
   *
   * @param changes - The snapshot fields to change.
   */
  function push_snapshot(changes: Partial<RuntimeSnapshot>): void {
    act(() => {
      runtime_options().onSnapshot({ ...SNAPSHOT_FIXTURE, ...changes });
    });
  }

  /**
   * @param container - The component container.
   * @returns Whether the coach's card shows its task as done.
   */
  function is_card_done(container: HTMLElement): boolean {
    return require_element(container, ".practice-coach").dataset.done === "true";
  }

  it("counts a move only when the Move tool puts its object down", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);
    go_to_card(container, "Move a stool");
    const toolbar = require_element(container, ".tool-segment");

    push_snapshot({ buildTool: "move", selectedObjectId: "starter-3" });
    fireEvent.click(within(toolbar).getByRole("button", { name: "Move" }));
    push_snapshot({ buildTool: "move", selectedObjectId: undefined });
    push_snapshot({ buildTool: "select" });
    const after_cancel = is_card_done(container);
    push_snapshot({ buildTool: "move", selectedObjectId: "starter-3" });
    push_snapshot({ buildTool: "move", selectedObjectId: undefined });
    push_snapshot({ buildTool: "select" });

    expect([after_cancel, is_card_done(container)]).toEqual([false, true]);
  });

  it("keeps a finished card done when the player steps back to it", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);
    go_to_card(container, "Buy a stool");
    push_snapshot({ buildTool: "place" });
    fireEvent.click(
      within(require_element(container, ".practice-coach")).getByRole("button", { name: "Next" }),
    );
    push_snapshot({ buildTool: "select" });

    fireEvent.click(
      within(require_element(container, ".practice-coach")).getByRole("button", { name: "Back" }),
    );

    expect([coach_title(container), is_card_done(container)]).toEqual(["Buy a stool", true]);
  });

  it("keeps a card done once its task is done, even when the player changes it back", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);
    go_to_card(container, "Buy a stool");

    push_snapshot({ buildTool: "place" });
    push_snapshot({ buildTool: "select" });

    expect(is_card_done(container)).toBe(true);
  });

  it("stops building after each placement during practice, but not in the player's own centre", async () => {
    const container = await boot_running_centre();
    push_snapshot({ buildTool: "place", placedObjectCount: 14 });
    push_snapshot({ buildTool: "place", placedObjectCount: 15 });
    await settle();
    const own_calls = fakes.calls.filter(([method]) => method === "controller.setBuildTool");
    await start_practice_from_help(container);
    push_snapshot({ buildTool: "place", placedObjectCount: 14 });
    fakes.calls.length = 0;

    push_snapshot({ buildTool: "place", placedObjectCount: 15 });
    await settle();

    expect([own_calls, fakes.calls]).toEqual([
      [],
      [
        ["controller.setBuildTool", "select"],
        ["controller.selectBuildItem", undefined],
      ],
    ]);
  });

  it("leaves the next morning paused when the Service Review closes during practice", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);
    push_snapshot({});
    fakes.calls.length = 0;
    const neighbourhood = SNAPSHOT_FIXTURE.neighbourhood!;
    push_snapshot({
      day: 3,
      speed: 10,
      neighbourhood: {
        ...neighbourhood,
        lastReport: { ...neighbourhood.lastReport!, day: 2 },
      },
    });

    fireEvent.click(within(container).getByRole("button", { name: "Open for Day 3" }));

    expect(fakes.calls.filter(([method]) => method === "controller.setSpeed")).toEqual([
      ["controller.setSpeed", 0],
    ]);
  });

  it("shows the not-saved notice once, however often the player tries to save", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);

    fireEvent.click(dock_button(container, "Save now"));
    fireEvent.click(dock_button(container, "Save now"));

    expect(toast_messages(container).filter((message) => message === NOT_SAVED)).toHaveLength(1);
  });

  it("clears the practice toasts when the player goes back to their centre", async () => {
    const container = await boot_running_centre();
    await start_practice_from_help(container);
    act(() => {
      runtime_options().onEvent({
        kind: "success",
        message: "Happy tables complete · +$100",
        importance: "important",
      });
    });

    fireEvent.click(
      within(require_element(container, ".practice-coach")).getByRole("button", {
        name: "Exit practice",
      }),
    );

    expect(toast_messages(container)).toEqual(["Welcome back to your own centre!"]);
  });

  it("starts from the tutorial's last card, marking both onboarding flows as seen", async () => {
    const container = await boot_simulator();
    fireEvent.click(within(container).getByRole("button", { name: "Show me around" }));
    fireEvent.click(within(container).getByRole("button", { name: "Got it" }));
    fireEvent.click(within(container).getByRole("button", { name: "Next" }));
    fireEvent.click(within(container).getByRole("button", { name: "Next" }));
    fakes.calls.length = 0;

    fireEvent.click(within(container).getByRole("button", { name: "Try a practice day" }));
    await settle();

    expect({
      preferences: fakes.calls.filter(([method]) => method === "savePreference"),
      calls: centre_calls(),
      modals: open_modal_titles(container),
      title: coach_title(container),
    }).toEqual({
      preferences: [
        ["savePreference", "tutorial-complete", true],
        ["savePreference", "nutrition-tour-v1-complete", true],
      ],
      calls: [
        ["controller.exportState"],
        ["saveGame", fakes.runtime.exportedState],
        ["controller.exportState"],
        ["controller.reset"],
      ],
      modals: [],
      title: "Welcome to your practice day!",
    });
  });
});
