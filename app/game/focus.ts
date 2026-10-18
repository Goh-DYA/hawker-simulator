/**
 * Focus handling shared by the game screen's dialogs and its compact management sheet.
 *
 * The modal dialogs, the management sheet and the Variant Lab each trap Tab focus, close on
 * Escape and hand focus back when they close. They differ in small ways that players can feel
 * (which elements count as focusable, where focus starts, when that first focus is resolved,
 * and whether focus is handed back), so `install_focus_trap` takes each difference as an
 * option and every caller keeps its own `useEffect` with its exact dependency list. Keeping the
 * effect at the call site lets the hooks lint check those dependencies, and keeps the rAF order
 * unchanged: an effect's cleanup queues its restore frame before the next run queues its
 * initial-focus frame. The modal priority and the inert rule are encoded once here.
 */

/** The focusable elements of a modal dialog (tutorial, nutrition tour, settings, help, reset). */
export const MODAL_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** The focusable elements of the compact management sheet, which also holds disclosures. */
export const SHEET_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** The focusable elements of the Variant Lab dialog. */
export const VARIANT_LAB_FOCUSABLE_SELECTOR =
  "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * The tutorial step that means the tutorial is finished; one past its last card.
 * `TUTORIAL_COPY` in `dialogs.tsx` is checked to have this many cards.
 */
export const TUTORIAL_DONE_STEP = 5;

/** The nutrition tour step that means the tour is finished; one past its last card. */
export const NUTRITION_TOUR_DONE_STEP = 2;

/** A tutorial step: a card index, or `TUTORIAL_DONE_STEP` once the tutorial is finished. */
export type TutorialStep = 0 | 1 | 2 | 3 | 4 | 5;

/** A nutrition tour step: a card index, or `NUTRITION_TOUR_DONE_STEP` once the tour is finished. */
export type NutritionTourStep = 0 | 1 | 2;

/** What a key press asks a focus trap to do, or `undefined` to let the browser handle it. */
export type DialogFocusAction = "close" | "container" | "first" | "last" | undefined;

/**
 * Decide what a focus trap does with a key press.
 *
 * @param key - The pressed key, as `KeyboardEvent.key`.
 * @param shiftKey - Whether Shift is held.
 * @param focusableCount - How many focusable elements the trap holds.
 * @param activeAtFirst - Whether focus counts as being on the first focusable element.
 * @param activeAtLast - Whether focus counts as being on the last focusable element.
 * @returns `close` on Escape; on Tab, `container` when nothing is focusable, `last` or
 *   `first` when focus must wrap, and `undefined` otherwise.
 */
export function dialogFocusAction(
  key: string,
  shiftKey: boolean,
  focusableCount: number,
  activeAtFirst: boolean,
  activeAtLast: boolean,
): DialogFocusAction {
  if (key === "Escape") return "close";
  if (key !== "Tab") return undefined;
  if (focusableCount === 0) return "container";
  if (shiftKey && activeAtFirst) return "last";
  if (!shiftKey && activeAtLast) return "first";
  return undefined;
}

/** A modal dialog that traps focus, in priority order. */
export type ActiveModal = "reset" | "settings" | "help" | "tutorial" | "nutrition-tour";

/** The UI state that decides which modal dialog holds focus. */
export interface ModalState {
  readonly resetOpen: boolean;
  readonly settingsOpen: boolean;
  readonly helpOpen: boolean;
  readonly tutorialStep: number;
  readonly nutritionTourStep: number;
}

/**
 * Pick the modal dialog that holds focus.
 *
 * Reset sits above Settings, which sits above Help; the tutorial and then the nutrition tour
 * hold focus only when none of those is open. The Variant Lab traps its own focus, so it is not
 * one of these.
 *
 * @param state - Which dialogs are open and how far the tutorial and tour have got.
 * @returns The modal that holds focus, or `undefined` when none is open.
 */
export function resolve_active_modal(state: ModalState): ActiveModal | undefined {
  if (state.resetOpen) return "reset";
  if (state.settingsOpen) return "settings";
  if (state.helpOpen) return "help";
  if (state.tutorialStep < TUTORIAL_DONE_STEP) return "tutorial";
  if (state.nutritionTourStep < NUTRITION_TOUR_DONE_STEP) return "nutrition-tour";
  return undefined;
}

/**
 * Decide whether the game interface behind the dialogs is inert.
 *
 * @param state - Which dialogs are open, how far the tutorial and tour have got, and whether
 *   the Variant Lab is open.
 * @returns Whether a modal dialog or the Variant Lab is open.
 */
export function is_interface_inert(
  state: ModalState & { readonly isVariantLabOpen: boolean },
): boolean {
  return resolve_active_modal(state) !== undefined || state.isVariantLabOpen;
}

/** How one focus trap behaves; each option records a difference between today's traps. */
export interface FocusTrapOptions {
  /** The CSS selector of the trap's focusable elements. */
  readonly selector: string;
  /** Whether `hidden` and `aria-hidden="true"` elements are left out of the focusables. */
  readonly shouldSkipHidden: boolean;
  /**
   * Pick the element focused when the trap opens.
   *
   * @param container - The trap's container.
   * @param focusables - Reads the trap's focusable elements now.
   * @returns The element to focus, or nothing to leave focus where it is.
   */
  readonly initialFocus: (
    container: HTMLElement,
    focusables: () => HTMLElement[],
  ) => HTMLElement | null | undefined;
  /**
   * When the initial element is picked: `open` picks it as the trap opens and focuses it on
   * the next frame; `frame` picks and focuses it on the next frame; `cancellable-frame` does
   * the same but drops that frame if the trap closes first.
   */
  readonly initialFocusTiming: "open" | "frame" | "cancellable-frame";
  /** Called after `preventDefault` when Escape is pressed. */
  readonly onEscape: () => void;
  /** Whether focus outside the container counts as being on the first and last elements. */
  readonly shouldTreatOutsideAsEdge?: boolean;
  /** Whether key presses are ignored while focus is inside a different `aria-modal` element. */
  readonly shouldIgnoreOtherModals?: boolean;
  /**
   * Holds the element focus returns to. The trap fills it with the focused element as it opens
   * when it is empty, and empties it as it closes. Without it, the trap returns focus to the
   * element focused as it opened.
   */
  readonly returnFocusRef?: { current: HTMLElement | null };
  /**
   * Decide, as the trap closes, whether focus is handed back.
   *
   * @param container - The trap's container.
   * @returns Whether to return focus; focus is always returned when this is omitted.
   */
  readonly shouldRestoreFocus?: (container: HTMLElement) => boolean;
}

/**
 * Trap keyboard focus inside a container until the returned cleanup runs.
 *
 * Call it from a `useEffect` and return its result, so the cleanup's restore frame is queued
 * before the next run's initial-focus frame.
 *
 * @param container - The dialog or sheet that holds focus.
 * @param options - How this trap differs from the others.
 * @returns The cleanup, which removes the key handler and queues the return of focus.
 */
export function install_focus_trap(container: HTMLElement, options: FocusTrapOptions): () => void {
  const return_focus_ref = options.returnFocusRef ?? { current: null };
  if (!return_focus_ref.current) {
    return_focus_ref.current = document.activeElement as HTMLElement | null;
  }
  const focusables = () => {
    const elements = Array.from(container.querySelectorAll<HTMLElement>(options.selector));
    return options.shouldSkipHidden
      ? elements.filter(
          (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
        )
      : elements;
  };
  let initial_focus_frame: number | undefined;
  if (options.initialFocusTiming === "open") {
    const initial = options.initialFocus(container, focusables);
    window.requestAnimationFrame(() => initial?.focus());
  } else {
    const frame = window.requestAnimationFrame(() =>
      options.initialFocus(container, focusables)?.focus(),
    );
    if (options.initialFocusTiming === "cancellable-frame") initial_focus_frame = frame;
  }

  const handle_keys = (event: KeyboardEvent) => {
    if (options.shouldIgnoreOtherModals) {
      const active_modal = (document.activeElement as HTMLElement | null)?.closest(
        "[aria-modal='true']",
      );
      if (active_modal && active_modal !== container) return;
    }
    const available = focusables();
    const first = available[0];
    const last = available.at(-1);
    const active_element = document.activeElement;
    const is_outside =
      Boolean(options.shouldTreatOutsideAsEdge) && !container.contains(active_element);
    const action = dialogFocusAction(
      event.key,
      event.shiftKey,
      available.length,
      active_element === first || is_outside,
      active_element === last || is_outside,
    );
    if (action === "close") {
      event.preventDefault();
      options.onEscape();
    } else if (action === "container") {
      event.preventDefault();
      container.focus();
    } else if (action === "last") {
      event.preventDefault();
      last?.focus();
    } else if (action === "first") {
      event.preventDefault();
      first?.focus();
    }
  };
  document.addEventListener("keydown", handle_keys);

  return () => {
    if (initial_focus_frame !== undefined) window.cancelAnimationFrame(initial_focus_frame);
    document.removeEventListener("keydown", handle_keys);
    const should_restore = options.shouldRestoreFocus?.(container) ?? true;
    const return_focus = return_focus_ref.current;
    return_focus_ref.current = null;
    if (should_restore) {
      window.requestAnimationFrame(() => return_focus?.focus());
    }
  };
}
