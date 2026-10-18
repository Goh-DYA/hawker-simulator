// @vitest-environment jsdom
/**
 * Tests for the shared focus handling of the game screen's dialogs and sheet.
 *
 * Table tests pin the key decisions, the modal priority and the inert rule. The trap cases
 * run `install_focus_trap` on plain DOM, and the Variant Lab cases render the real dialog,
 * both with animation frames queued until the test flushes them, so they pin when focus moves
 * as well as where it lands. The modal dialogs and the management sheet are covered through
 * the rendered component in `HawkerSimulator.test.ts`.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dialogFocusAction,
  install_focus_trap,
  is_interface_inert,
  MODAL_FOCUSABLE_SELECTOR,
  NUTRITION_TOUR_DONE_STEP,
  resolve_active_modal,
  SHEET_FOCUSABLE_SELECTOR,
  TUTORIAL_DONE_STEP,
  VARIANT_LAB_FOCUSABLE_SELECTOR,
  type ActiveModal,
  type DialogFocusAction,
  type FocusTrapOptions,
  type ModalState,
} from "@/app/game/focus";
import {
  dialogFocusAction as reexported_dialog_focus_action,
  VariantLabDialog,
} from "@/app/game/NutritionEducation";
import type { NutritionFamilyView } from "@/app/game/NutritionEducation";

/** A Variant Lab family with one unlocked and one locked variant. */
const LAB_FAMILY: NutritionFamilyView = {
  dishId: "dish.kopi",
  defaultVariantId: "kopi-default",
  activeVariantId: "kopi-default",
  starRating: 4,
  variants: [
    {
      id: "kopi-default",
      label: "Kopi",
      unlockRank: 1,
      visualKey: "kopi-milk-sugar-standard",
      unlocked: true,
      selected: true,
      profile: { status: "released", servingLabel: "1 cup" },
    },
    {
      id: "kopi-c",
      label: "Kopi C",
      unlockRank: 3,
      visualKey: "kopi-c",
      unlocked: false,
      selected: false,
      profile: { status: "released", servingLabel: "1 cup" },
    },
  ],
};

/** Every dialog closed and both onboarding flows finished. */
const NO_MODAL: ModalState = {
  resetOpen: false,
  settingsOpen: false,
  helpOpen: false,
  tutorialStep: TUTORIAL_DONE_STEP,
  nutritionTourStep: NUTRITION_TOUR_DONE_STEP,
};

/** Animation-frame callbacks queued and not yet run or cancelled, by handle. */
let queued_frames = new Map<number, FrameRequestCallback>();
/** The handle the next queued frame gets. */
let next_frame_id = 1;

/** Run the queued animation frames inside `act`, in request order. */
function flush_frames(): void {
  act(() => {
    const callbacks = [...queued_frames.values()];
    queued_frames = new Map();
    for (const callback of callbacks) callback(0);
  });
}

/**
 * Build a container with three buttons, attached to the document.
 *
 * @returns The container and its buttons, in document order.
 */
function build_trap_container() {
  const container = document.createElement("section");
  container.tabIndex = -1;
  const buttons = ["One", "Two", "Three"].map((label) => {
    const button = document.createElement("button");
    button.textContent = label;
    container.append(button);
    return button;
  });
  document.body.append(container);
  return { container, buttons };
}

/** Options for a trap that differs from the defaults only where a test says so. */
const BASE_TRAP_OPTIONS: FocusTrapOptions = {
  selector: "button",
  shouldSkipHidden: true,
  initialFocus: (_container, focusables) => focusables()[0],
  initialFocusTiming: "frame",
  onEscape: () => undefined,
};

/**
 * @param element - The focused element, or anything else.
 * @returns The element's tag and accessible label or text, for focus assertions.
 */
function describe_focus_target(element: unknown): string {
  if (!(element instanceof HTMLElement)) return String(element);
  if (element === document.body) return "body";
  const label = element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
  return `${element.tagName.toLowerCase()}: ${label}`;
}

/**
 * Focus an opener button, then render the Variant Lab.
 *
 * @returns The opener, the close callback spy and the render's `unmount`.
 */
function open_variant_lab() {
  const opener = document.createElement("button");
  opener.textContent = "Tune recipe";
  document.body.append(opener);
  opener.focus();
  const on_close = vi.fn();
  const view = render(
    createElement(VariantLabDialog, {
      dishName: "Kopi",
      family: LAB_FAMILY,
      onChoose: () => undefined,
      onClose: on_close,
    }),
  );
  return { opener, on_close, unmount: view.unmount };
}

beforeEach(() => {
  queued_frames = new Map();
  next_frame_id = 1;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = next_frame_id;
    next_frame_id += 1;
    queued_frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queued_frames.delete(id);
  });
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("focus selectors", () => {
  it("pins the modal, sheet and Variant Lab selectors", () => {
    expect([
      MODAL_FOCUSABLE_SELECTOR,
      SHEET_FOCUSABLE_SELECTOR,
      VARIANT_LAB_FOCUSABLE_SELECTOR,
    ]).toEqual([
      "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex='-1'])",
      "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],summary,[tabindex]:not([tabindex='-1'])",
      "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ]);
  });

  it("marks the tutorial done after its five cards and the tour after its two", () => {
    expect([TUTORIAL_DONE_STEP, NUTRITION_TOUR_DONE_STEP]).toEqual([5, 2]);
  });
});

describe("dialogFocusAction", () => {
  const cases: readonly [string, boolean, number, boolean, boolean, DialogFocusAction][] = [
    ["Escape", false, 3, false, false, "close"],
    ["Escape", true, 0, true, true, "close"],
    ["Enter", false, 3, true, true, undefined],
    ["Tab", false, 0, false, false, "container"],
    ["Tab", true, 3, true, false, "last"],
    ["Tab", true, 3, false, true, undefined],
    ["Tab", false, 3, false, true, "first"],
    ["Tab", false, 3, true, false, undefined],
  ];

  it.each(cases)(
    "maps %s (shift %s, %i focusable, at first %s, at last %s) to %s",
    (key, shift_key, count, at_first, at_last, expected) => {
      expect(dialogFocusAction(key, shift_key, count, at_first, at_last)).toBe(expected);
    },
  );

  it("is re-exported unchanged from NutritionEducation", () => {
    expect(reexported_dialog_focus_action).toBe(dialogFocusAction);
  });
});

describe("resolve_active_modal", () => {
  const cases: readonly [string, Partial<ModalState>, ActiveModal | undefined][] = [
    ["nothing open", {}, undefined],
    ["reset over everything", { resetOpen: true, settingsOpen: true, tutorialStep: 0 }, "reset"],
    [
      "settings over help and the tutorial",
      { settingsOpen: true, helpOpen: true, tutorialStep: 0 },
      "settings",
    ],
    ["help over the tutorial", { helpOpen: true, tutorialStep: 2 }, "help"],
    ["the tutorial over the tour", { tutorialStep: 4, nutritionTourStep: 0 }, "tutorial"],
    ["the tour once the tutorial is done", { nutritionTourStep: 1 }, "nutrition-tour"],
  ];

  it.each(cases)("picks %s", (_name, state, expected) => {
    expect(resolve_active_modal({ ...NO_MODAL, ...state })).toBe(expected);
  });
});

describe("is_interface_inert", () => {
  const cases: readonly [string, Partial<ModalState>, boolean, boolean][] = [
    ["nothing is open", {}, false, false],
    ["only the Variant Lab is open", {}, true, true],
    ["the tutorial is showing", { tutorialStep: 0 }, false, true],
    ["the tour is showing", { nutritionTourStep: 0 }, false, true],
    ["settings is open", { settingsOpen: true }, false, true],
    ["help is open", { helpOpen: true }, false, true],
    ["reset is open", { resetOpen: true }, false, true],
  ];

  it.each(cases)(
    "decides whether the interface is inert when %s",
    (_name, state, is_lab_open, expected) => {
      expect(is_interface_inert({ ...NO_MODAL, ...state, isVariantLabOpen: is_lab_open })).toBe(
        expected,
      );
    },
  );
});

describe("install_focus_trap", () => {
  it("picks the initial element as it opens when the timing is open", () => {
    const { container, buttons } = build_trap_container();
    const initial_focus = vi.fn(() => buttons[1]);

    install_focus_trap(container, {
      ...BASE_TRAP_OPTIONS,
      initialFocus: initial_focus,
      initialFocusTiming: "open",
    });
    const calls_before_frame = initial_focus.mock.calls.length;
    flush_frames();

    expect([calls_before_frame, document.activeElement]).toEqual([1, buttons[1]]);
  });

  it("drops a cancellable initial focus when the trap closes first", () => {
    const { container, buttons } = build_trap_container();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();

    const remove = install_focus_trap(container, {
      ...BASE_TRAP_OPTIONS,
      initialFocus: () => buttons[2],
      initialFocusTiming: "cancellable-frame",
    });
    remove();
    flush_frames();

    expect(document.activeElement).toBe(outside);
  });

  it("leaves hidden elements out only when asked", () => {
    const { container, buttons } = build_trap_container();
    buttons[2]!.hidden = true;
    const remove = install_focus_trap(container, BASE_TRAP_OPTIONS);
    flush_frames();
    buttons[1]!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    const skipping_hidden = document.activeElement;
    remove();

    install_focus_trap(container, { ...BASE_TRAP_OPTIONS, shouldSkipHidden: false });
    buttons[1]!.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect([skipping_hidden, document.activeElement]).toEqual([buttons[0], buttons[1]]);
  });

  it("wraps Tab from outside the container only when outside counts as an edge", () => {
    const { container, buttons } = build_trap_container();
    const outside = document.createElement("button");
    document.body.append(outside);
    const remove = install_focus_trap(container, BASE_TRAP_OPTIONS);
    outside.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    const plain = document.activeElement;
    remove();

    install_focus_trap(container, { ...BASE_TRAP_OPTIONS, shouldTreatOutsideAsEdge: true });
    outside.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect([plain, document.activeElement]).toEqual([outside, buttons[0]]);
  });

  it("ignores keys while focus is inside another modal when asked", () => {
    const { container } = build_trap_container();
    const other_modal = document.createElement("div");
    other_modal.setAttribute("aria-modal", "true");
    const inner = document.createElement("button");
    other_modal.append(inner);
    document.body.append(other_modal);
    const on_escape = vi.fn();
    install_focus_trap(container, {
      ...BASE_TRAP_OPTIONS,
      onEscape: on_escape,
      shouldIgnoreOtherModals: true,
    });
    inner.focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(on_escape).not.toHaveBeenCalled();
  });

  it("returns focus through the ref, fills it only when empty and empties it on close", () => {
    const { container } = build_trap_container();
    const opener = document.createElement("button");
    const other = document.createElement("button");
    document.body.append(opener, other);
    other.focus();
    const return_focus_ref = { current: opener as HTMLElement | null };

    const remove = install_focus_trap(container, {
      ...BASE_TRAP_OPTIONS,
      returnFocusRef: return_focus_ref,
    });
    flush_frames();
    remove();
    const after_close = return_focus_ref.current;
    flush_frames();

    expect([after_close, document.activeElement]).toEqual([null, opener]);
  });

  it("keeps focus where it is when the trap declines to restore it", () => {
    const { container, buttons } = build_trap_container();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const remove = install_focus_trap(container, {
      ...BASE_TRAP_OPTIONS,
      shouldRestoreFocus: () => false,
    });
    flush_frames();

    remove();
    flush_frames();

    expect(document.activeElement).toBe(buttons[0]);
  });
});

describe("Variant Lab focus trap", () => {
  it("focuses the first enabled control on the next frame", () => {
    open_variant_lab();
    const before = describe_focus_target(document.activeElement);

    flush_frames();

    expect([before, describe_focus_target(document.activeElement)]).toEqual([
      "button: Tune recipe",
      "button: Close Variant Lab",
    ]);
  });

  it("wraps Tab from the last control to the first and Shift+Tab back", () => {
    open_variant_lab();
    flush_frames();
    const visited: string[] = [];

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    visited.push(describe_focus_target(document.activeElement));
    fireEvent.keyDown(document, { key: "Tab" });
    visited.push(describe_focus_target(document.activeElement));

    expect(visited).toEqual(["button: Done", "button: Close Variant Lab"]);
  });

  it("closes on Escape", () => {
    const { on_close } = open_variant_lab();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(on_close).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the opener on the frame after it unmounts", () => {
    const { unmount } = open_variant_lab();
    flush_frames();

    unmount();
    const before = describe_focus_target(document.activeElement);
    flush_frames();

    expect([before, describe_focus_target(document.activeElement)]).toEqual([
      "body",
      "button: Tune recipe",
    ]);
  });
});
