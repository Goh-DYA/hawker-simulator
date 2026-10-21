// @vitest-environment jsdom
/**
 * Render tests of the tutorial, Settings, Help, reset and Service Review dialogs from
 * `app/game/dialogs.tsx`.
 *
 * Each dialog renders on its own with recorded callbacks, so these cases pin which callback a
 * control calls and with what, that the section receives the `ref` the shell's focus trap
 * installs on, and that Settings stays inert under the reset confirmation. The dialogs'
 * markup inside the running component, and their focus order, are covered through the
 * rendered shell in `HawkerSimulator.test.ts`.
 */
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HelpDialog,
  ResetDialog,
  ServiceReviewDialog,
  SettingsDialog,
  SettingSlider,
  SettingSwitch,
  TutorialDialog,
  type BooleanSettingKey,
  type NumberSettingKey,
} from "@/app/game/dialogs";
import { CONTENT_UPDATED_ON, CONTENT_VERSION, format_release_date } from "@/src/content";
import { DEFAULT_SETTINGS } from "@/src/game/persistence/preferences";
import type { TutorialStep } from "@/app/game/focus";
import type { RuntimeDayReport, RuntimeSettings } from "@/src/game/runtime/types";
import { SNAPSHOT_FIXTURE } from "./panels/fixtures";

/** Settings that differ from the defaults in every field, so each control shows its own value. */
const CUSTOM_SETTINGS: RuntimeSettings = {
  ...DEFAULT_SETTINGS,
  quality: "lower-end",
  reducedMotion: true,
  textScale: 1.35,
  musicVolume: 0.5,
  ambienceVolume: 0.25,
  sfxVolume: 0.75,
};

/**
 * Render the Settings dialog with recorded callbacks.
 *
 * @param is_reset_open - Whether the reset confirmation is open above it.
 * @returns The dialog element, the section ref and the callbacks.
 */
function render_settings(is_reset_open = false) {
  const ref = createRef<HTMLElement>();
  const callbacks = {
    onUpdateSetting: vi.fn(),
    onClose: vi.fn(),
    onExportSave: vi.fn(),
    onImportSave: vi.fn(),
    onOpenReset: vi.fn(),
  };
  const { container } = render(
    createElement(SettingsDialog, {
      ref,
      settings: CUSTOM_SETTINGS,
      isResetOpen: is_reset_open,
      ...callbacks,
    }),
  );
  const dialog = container.querySelector<HTMLElement>("section.settings-modal")!;
  return { dialog, ref, callbacks };
}

afterEach(() => {
  cleanup();
});

describe("TutorialDialog", () => {
  /**
   * Render the tutorial on one card with recorded callbacks.
   *
   * @param step - The card to show.
   * @returns The dialog element, its section ref and the callbacks.
   */
  function render_tutorial(step: TutorialStep) {
    const ref = createRef<HTMLElement>();
    const callbacks = { onFinish: vi.fn(), onStartPractice: vi.fn(), onStepChange: vi.fn() };
    render(createElement(TutorialDialog, { ref, step, ...callbacks }));
    const dialog = within(document.body).getByRole("dialog");
    return { dialog, ref, callbacks };
  }

  it("hands the shell's focus trap its section through the ref", () => {
    const { dialog, ref } = render_tutorial(0);
    expect(ref.current).toBe(dialog);
  });

  it("welcomes a new player in plain words", () => {
    const { dialog } = render_tutorial(0);
    expect(within(dialog).getByRole("heading").textContent).toBe("Welcome to your hawker centre!");
    expect(
      Array.from(dialog.querySelectorAll(".guide-points li"), (item) => item.textContent),
    ).toEqual([
      "🚶Hungry guests walk in.",
      "🍜They buy food from your stalls.",
      "🪑They sit down, eat, and go home.",
      "😊Your job: keep them fed and happy!",
    ]);
    expect(dialog.querySelectorAll(".guide-icon[aria-hidden='true']")).toHaveLength(4);
  });

  it("shows a guest's visit as stages on the guests card", () => {
    const { dialog } = render_tutorial(3);
    const flow = within(dialog).getByRole("list", { name: "A guest's visit" });
    expect(Array.from(flow.children, (stage) => stage.textContent)).toEqual([
      "Pick a stall",
      "Line up",
      "Get food",
      "Sit and eat",
      "Go home",
    ]);
  });

  it.each<[TutorialStep, string]>([
    [1, "Look around"],
    [2, "Open your stalls"],
    [3, "Watch your guests"],
    [4, "Earn cash and grow"],
  ])("titles card %i %s", (step, title) => {
    const { dialog } = render_tutorial(step);
    expect(within(dialog).getByRole("heading").textContent).toBe(title);
  });

  it("skips from an early card and advances with the primary button", () => {
    const { dialog, callbacks } = render_tutorial(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Got it" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Skip tutorial" }));
    expect(callbacks.onStepChange).toHaveBeenCalledWith(2);
    expect(callbacks.onFinish).toHaveBeenCalledWith(false);
    expect(within(dialog).queryByRole("button", { name: "Try a practice day" })).toBeNull();
  });

  it("offers a practice day in place of the skip on the last card", () => {
    const { dialog, callbacks } = render_tutorial(4);
    expect(within(dialog).queryByRole("button", { name: "Skip tutorial" })).toBeNull();
    const callout = within(dialog).getByRole("complementary", { name: "New to games like this?" });
    expect(within(callout).getByRole("button", { name: "Try a practice day" }).className).toBe(
      "practice-button",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Try a practice day" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Start playing" }));
    expect(callbacks.onStartPractice).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinish).toHaveBeenCalledWith(true);
  });
});

describe("SettingsDialog", () => {
  it("leaves the save buttons on, with no practice note, outside practice", () => {
    const { dialog } = render_settings();
    expect([
      ["Export save", "Import save", "Reset game…"].map(
        (name) => (within(dialog).getByRole("button", { name }) as HTMLButtonElement).disabled,
      ),
      dialog.querySelector(".settings-practice-note"),
    ]).toEqual([[false, false, false], null]);
  });

  it("turns the save buttons off and describes them with the note during practice", () => {
    const callbacks = {
      onUpdateSetting: vi.fn(),
      onClose: vi.fn(),
      onExportSave: vi.fn(),
      onImportSave: vi.fn(),
      onOpenReset: vi.fn(),
    };
    const { container } = render(
      createElement(SettingsDialog, {
        ref: createRef<HTMLElement>(),
        settings: CUSTOM_SETTINGS,
        isResetOpen: false,
        isPractice: true,
        ...callbacks,
      }),
    );
    const reset = within(container).getByRole("button", { name: "Reset game…" });
    fireEvent.click(reset);
    expect({
      disabled: (reset as HTMLButtonElement).disabled,
      description: reset.getAttribute("aria-describedby"),
      note: container.querySelector("#settings-practice-note")?.textContent?.startsWith(
        "This is a practice day",
      ),
      calls: callbacks.onOpenReset.mock.calls.length,
    }).toEqual({ disabled: true, description: "settings-practice-note", note: true, calls: 0 });
  });

  it("hands the shell's focus trap its section through the ref", () => {
    const { dialog, ref } = render_settings();
    expect(ref.current).toBe(dialog);
  });

  it("ends with the game version and the date of the last update", () => {
    const { dialog } = render_settings();
    const content = dialog.querySelector(".settings-content")!;
    const note = content.lastElementChild!;
    expect([note.className, note.textContent, note.querySelector("time")?.dateTime]).toEqual([
      "settings-version",
      `Hawker Balance version ${CONTENT_VERSION} · Last updated ${format_release_date(CONTENT_UPDATED_ON)}`,
      CONTENT_UPDATED_ON,
    ]);
  });

  it("names the dialog Settings", () => {
    const { dialog } = render_settings();
    expect(within(document.body).getByRole("dialog", { name: "Settings" })).toBe(dialog);
  });

  it("is not inert while the reset confirmation is closed", () => {
    const { dialog } = render_settings(false);
    expect([dialog.hasAttribute("inert"), dialog.getAttribute("aria-hidden")]).toEqual([
      false,
      "false",
    ]);
  });

  it("is inert and hidden while the reset confirmation is open", () => {
    const { dialog } = render_settings(true);
    expect([dialog.hasAttribute("inert"), dialog.getAttribute("aria-hidden")]).toEqual([
      true,
      "true",
    ]);
  });

  it("shows each slider's value as a whole percentage", () => {
    const { dialog } = render_settings();
    const percentages = Array.from(dialog.querySelectorAll("label > strong")).map(
      (strong) => strong.textContent,
    );
    expect(percentages).toEqual(["135%", "50%", "25%", "75%"]);
  });

  it.each<[string, BooleanSettingKey, boolean]>([
    ["Reduced motion", "reducedMotion", false],
    ["High contrast", "highContrast", true],
    ["Mute all audio", "masterMuted", true],
  ])("stores the %s switch as %s = %s", (label, key, value) => {
    const { dialog, callbacks } = render_settings();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: new RegExp(`^${label}`) }));
    expect(callbacks.onUpdateSetting.mock.calls).toEqual([[key, value]]);
  });

  it.each<[string, NumberSettingKey, string, number]>([
    ["Text size", "textScale", "1.2", 1.2],
    ["Music volume", "musicVolume", "0.4", 0.4],
    ["Ambience volume", "ambienceVolume", "0.1", 0.1],
    ["Effects volume", "sfxVolume", "0.9", 0.9],
  ])("stores the %s slider as %s, as a number", (label, key, raw, value) => {
    const { dialog, callbacks } = render_settings();
    fireEvent.change(within(dialog).getByRole("slider", { name: new RegExp(`^${label}`) }), {
      target: { value: raw },
    });
    expect(callbacks.onUpdateSetting.mock.calls).toEqual([[key, value]]);
  });

  it("stores the quality mode", () => {
    const { dialog, callbacks } = render_settings();
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Quality mode" }), {
      target: { value: "standard" },
    });
    expect(callbacks.onUpdateSetting.mock.calls).toEqual([["quality", "standard"]]);
  });

  it.each<[string, "onClose" | "onExportSave" | "onOpenReset"]>([
    ["Close settings", "onClose"],
    ["Done", "onClose"],
    ["Export save", "onExportSave"],
    ["Reset game…", "onOpenReset"],
  ])("calls %s's callback, %s", (name, callback) => {
    const { dialog, callbacks } = render_settings();
    fireEvent.click(within(dialog).getByRole("button", { name }));
    expect(callbacks[callback]).toHaveBeenCalledTimes(1);
  });

  it("opens the file picker from Import save", () => {
    const { dialog } = render_settings();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
    fireEvent.click(within(dialog).getByRole("button", { name: "Import save" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("hands the picked file's change event to onImportSave", () => {
    const { dialog, callbacks } = render_settings();
    fireEvent.change(dialog.querySelector('input[type="file"]')!);
    expect(callbacks.onImportSave).toHaveBeenCalledTimes(1);
  });
});

describe("SettingSwitch and SettingSlider", () => {
  it("renders a switch without a hint as a name only", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingSwitch, {
        settingKey: "masterMuted",
        settings: DEFAULT_SETTINGS,
        label: "Mute all audio",
        onUpdateSetting: () => undefined,
      }),
    );
    expect(markup).toBe(
      '<label class="switch-row"><span><strong>Mute all audio</strong></span><input type="checkbox"/></label>',
    );
  });

  it("renders a slider's name and percentage", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingSlider, {
        settingKey: "musicVolume",
        settings: DEFAULT_SETTINGS,
        label: "Music volume",
        min: "0",
        max: "1",
        step: "0.05",
        onUpdateSetting: () => undefined,
      }),
    );
    expect(markup).toBe(
      '<label>Music volume <strong>32%</strong><input type="range" min="0" max="1" step="0.05" value="0.32"/></label>',
    );
  });
});

describe("HelpDialog", () => {
  /**
   * @returns The Help dialog element, its section ref and the callbacks.
   */
  function render_help() {
    const ref = createRef<HTMLElement>();
    const callbacks = {
      onClose: vi.fn(),
      onReplayTutorial: vi.fn(),
      onStartPractice: vi.fn(),
      onReplayNutritionTour: vi.fn(),
    };
    render(createElement(HelpDialog, { ref, ...callbacks }));
    const dialog = within(document.body).getByRole("dialog", { name: "Neighbourhood guide" });
    return { dialog, ref, callbacks };
  }

  it("hands the shell's focus trap its section through the ref", () => {
    const { dialog, ref } = render_help();
    expect(ref.current).toBe(dialog);
  });

  it("lists the eight controls in order", () => {
    const { dialog } = render_help();
    const keys = Array.from(dialog.querySelectorAll(".help-grid kbd")).map(
      (kbd) => kbd.textContent,
    );
    expect(keys).toEqual(["Drag", "Wheel", "R", "Esc", "Space", "U", "Menu", "Guest"]);
  });

  it.each<
    [string, "onClose" | "onReplayTutorial" | "onReplayNutritionTour" | "onStartPractice"]
  >([
    ["Close help", "onClose"],
    ["Back to centre", "onClose"],
    ["Replay tutorial", "onReplayTutorial"],
    ["Replay nutrition tour", "onReplayNutritionTour"],
    ["Practice day with a guide", "onStartPractice"],
  ])("calls %s's callback, %s", (name, callback) => {
    const { dialog, callbacks } = render_help();
    fireEvent.click(within(dialog).getByRole("button", { name }));
    expect(callbacks[callback]).toHaveBeenCalledTimes(1);
  });
});

describe("ResetDialog", () => {
  /**
   * @returns The reset alert dialog element, its section ref and the callbacks.
   */
  function render_reset() {
    const ref = createRef<HTMLElement>();
    const callbacks = { onCancel: vi.fn(), onConfirm: vi.fn() };
    const { container } = render(createElement(ResetDialog, { ref, ...callbacks }));
    const dialog = within(document.body).getByRole("alertdialog", { name: "Reset this centre?" });
    return { container, dialog, ref, callbacks };
  }

  it("hands the shell's focus trap its section through the ref", () => {
    const { dialog, ref } = render_reset();
    expect(ref.current).toBe(dialog);
  });

  it("sits on the nested backdrop above Settings", () => {
    const { container } = render_reset();
    expect(container.firstElementChild?.className).toBe("modal-backdrop nested");
  });

  it("describes what a reset removes", () => {
    const { dialog } = render_reset();
    expect(dialog.getAttribute("aria-describedby")).toBe("reset-description");
  });

  it.each<[string, "onCancel" | "onConfirm"]>([
    ["Keep playing", "onCancel"],
    ["Reset game", "onConfirm"],
  ])("calls %s's callback, %s", (name, callback) => {
    const { dialog, callbacks } = render_reset();
    fireEvent.click(within(dialog).getByRole("button", { name }));
    expect(callbacks[callback]).toHaveBeenCalledTimes(1);
  });
});

describe("ServiceReviewDialog", () => {
  /** The fixture's day 1 review with four departure reasons and a food writer's plaque. */
  const REPORT: RuntimeDayReport = {
    ...SNAPSHOT_FIXTURE.neighbourhood!.lastReport!,
    leftEarlyReasons: [
      ...SNAPSHOT_FIXTURE.neighbourhood!.lastReport!.leftEarlyReasons,
      { reason: "visit-cap", label: "Ran out of time before sitting down", count: 1 },
    ],
    writer: {
      stallName: "Sunrise Roost",
      outcome: "plaque",
      averageScore: 74,
      threshold: 68,
      quote: "“Food worth crossing town for, though seats that were hard to find.” — The Lane Weekly",
    },
  };

  /**
   * @param report - The review to show.
   * @returns The review dialog element, its section ref and the close callback.
   */
  function render_review(report: RuntimeDayReport = REPORT) {
    const ref = createRef<HTMLElement>();
    const onClose = vi.fn();
    render(
      createElement(ServiceReviewDialog, {
        ref,
        report,
        nextDay: SNAPSHOT_FIXTURE.neighbourhood!.today,
        onClose,
      }),
    );
    const dialog = within(document.body).getByRole("dialog", {
      name: "Day 1 wrapped · Opening day",
    });
    return { dialog, ref, onClose };
  }

  it("hands the shell's focus trap its section through the ref", () => {
    const { dialog, ref } = render_review();
    expect([ref.current, dialog.getAttribute("aria-modal")]).toEqual([dialog, "true"]);
  });

  it("orders the grade, figures, reasons, tip, writer, progress, forecast and button", () => {
    const { dialog } = render_review();
    expect(Array.from(dialog.children, (child) => child.className || child.tagName)).toEqual([
      "service-review-kicker",
      "H2",
      "service-review-grade",
      "service-review-figures",
      "service-review-reasons",
      "service-review-tip",
      "service-review-writer",
      "service-review-progress",
      "service-review-tomorrow",
      "tutorial-actions",
    ]);
  });

  it("pairs the grade glyph with the grade word and headline", () => {
    const { dialog } = render_review();
    expect(dialog.querySelector(".service-review-grade")?.textContent).toBe(
      "■ Steady — The hall kept going; the busy hours showed where it strains.",
    );
  });

  it("shows served, left early and takings", () => {
    const { dialog } = render_review();
    expect(
      Array.from(dialog.querySelectorAll(".service-review-figures > div"), (row) => row.textContent),
    ).toEqual(["Served31", "Left early6", "Takings$214"]);
  });

  it("lists only the top three reasons guests left early", () => {
    const { dialog } = render_review();
    expect(
      Array.from(dialog.querySelectorAll(".service-review-reasons li"), (item) => item.textContent),
    ).toEqual([
      "Had food but found no free seat · 3",
      "Gave up waiting in a queue · 2",
      "Found nothing to order within budget · 1",
    ]);
  });

  it("offers one thing to try, the writer's verdict, progress and the next day", () => {
    const { dialog } = render_review();
    expect(
      [
        ".service-review-tip",
        ".service-review-writer p",
        ".service-review-writer blockquote",
        ".service-review-progress",
        ".service-review-tomorrow",
      ].map((selector) => dialog.querySelector(selector)?.textContent),
    ).toEqual([
      "One thing to try: Comfort — Add enough seating and place fans, lighting or décor near dining tables.",
      "★ Sunrise Roost earned a Writer's Pick plaque!",
      "“Food worth crossing town for, though seats that were hard to find.” — The Lane Weekly",
      "Objectives completed: 2/3 · 1 new unlock",
      "Tomorrow: Late-morning kopi crowd — Expect an early wave of kopi and toast orders before the lunch crowd arrives.",
    ]);
  });

  it("leaves out the reasons and writer blocks on a day without them", () => {
    const { dialog } = render_review({ ...REPORT, leftEarlyReasons: [], writer: undefined });
    expect([
      dialog.querySelector(".service-review-reasons"),
      dialog.querySelector(".service-review-writer"),
    ]).toEqual([null, null]);
  });

  it("closes from its single primary button, which opens the next day", () => {
    const { dialog, onClose } = render_review();
    const buttons = within(dialog).getAllByRole("button");
    fireEvent.click(within(dialog).getByRole("button", { name: "Open for Day 2" }));
    expect([buttons.length, onClose.mock.calls.length]).toEqual([1, 1]);
  });

  it("never labels food or the day as healthy or unhealthy", () => {
    const { dialog } = render_review();
    expect(dialog.textContent?.toLowerCase()).not.toMatch(/healthy|unhealthy/);
  });
});
