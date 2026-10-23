/**
 * The practice coach: the floating card and the glowing ring that walk a new player through a
 * practice day, one step at a time.
 *
 * The coach is not a modal. The player has to click the game while it shows, so it never makes
 * the interface inert and never takes focus; its step text sits in a polite live region
 * instead. It rings the step's target element and places its card beside it, measuring both a
 * few times a second, because panels open, scroll and resize under it. The shell owns the
 * practice progress and hides the coach while a modal dialog is open. The step copy, the checks
 * and the card placement live in the pure `practice.ts`.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  get_practice_position,
  is_practice_step_done,
  place_coach_card,
  PRACTICE_FINISH_STEP,
  PRACTICE_LAST_STEP,
  PRACTICE_STEPS,
  type PracticeContext,
  type PracticeProgress,
  type ScreenRect,
} from "./practice";
import { GuideFlow, GuidePoints } from "./guide";

/** How often the coach measures its target and itself, in milliseconds. */
const COACH_MEASURE_INTERVAL_MS = 250;

/** The space between the ringed element and the ring, in CSS pixels. */
const RING_PADDING_PX = 6;

/** Where the coach draws its ring and card. */
interface CoachLayout {
  /** The ringed element's box, or undefined when the step rings nothing or it is off screen. */
  readonly ring: ScreenRect | undefined;
  /** The card's top-left corner. */
  readonly card: { readonly top: number; readonly left: number };
}

/**
 * Decide whether two layouts draw the same thing, so measuring does not re-render needlessly.
 *
 * @param first - One layout.
 * @param second - The other.
 * @returns Whether every edge matches.
 */
function is_same_layout(first: CoachLayout | undefined, second: CoachLayout): boolean {
  if (first === undefined) return false;
  const same_ring =
    first.ring === second.ring ||
    (first.ring !== undefined &&
      second.ring !== undefined &&
      first.ring.top === second.ring.top &&
      first.ring.left === second.ring.left &&
      first.ring.width === second.ring.width &&
      first.ring.height === second.ring.height);
  return same_ring && first.card.top === second.card.top && first.card.left === second.card.left;
}

/** The props of {@link PracticeCoach}. */
export interface PracticeCoachProps {
  /** Where the player is in the practice day. */
  readonly progress: PracticeProgress;
  /** What the step checks read. */
  readonly context: PracticeContext;
  /** Move to the next step; from the finish card, that starts the bonus steps. */
  readonly onNext: () => void;
  /** Move back to the previous step. */
  readonly onBack: () => void;
  /** Skip a step whose target the screen hides, in the direction the player is moving. */
  readonly onSkipHidden: () => void;
  /** Fold the coach away (the action strip then offers Show guide), or open it again. */
  readonly onCollapsedChange: (isCollapsed: boolean) => void;
  /** Leave practice and load the player's own centre back. */
  readonly onExit: () => void;
}

/**
 * Decide whether the browser hides an element, such as a HUD part that phones leave out.
 *
 * @param element - The element.
 * @returns Whether it is hidden; false where the browser cannot tell (as in jsdom).
 */
function is_hidden(element: HTMLElement): boolean {
  return typeof element.checkVisibility === "function" && !element.checkVisibility();
}

/**
 * Render the practice coach: nothing while folded (the action strip holds its controls then),
 * otherwise the ring and the step card, which can step back as well as on. When the player moves
 * on or back from inside the card, focus goes to the new step's heading, so a key press never lands on a button that changed under it.
 * On phones a task step folds its tip points behind a toggle, so the card covers less of the map;
 * its how-to stages stay in view.
 *
 * @param props - See {@link PracticeCoachProps}.
 * @returns The coach.
 */
export function PracticeCoach({
  progress,
  context,
  onNext,
  onBack,
  onSkipHidden,
  onCollapsedChange,
  onExit,
}: PracticeCoachProps) {
  const card_ref = useRef<HTMLElement>(null);
  const heading_ref = useRef<HTMLHeadingElement>(null);
  const should_focus_heading_ref = useRef(false);
  const on_skip_hidden_ref = useRef(onSkipHidden);
  const [layout, set_layout] = useState<CoachLayout>();
  const [tips_step, set_tips_step] = useState<number>();
  const step = PRACTICE_STEPS[progress.stepIndex] ?? PRACTICE_STEPS[PRACTICE_LAST_STEP]!;
  const target_selector = step.target?.(context);
  const is_done = is_practice_step_done(step, context);
  const is_finish = progress.stepIndex === PRACTICE_FINISH_STEP;
  const is_end = is_finish || progress.stepIndex >= PRACTICE_LAST_STEP;
  const position = get_practice_position(progress.stepIndex);
  const progress_line = step.progress?.(context);
  const note = step.note?.(context);
  const has_tips = step.task !== undefined && Boolean(step.points);
  const are_tips_open = tips_step === progress.stepIndex;
  const is_skipped_when_hidden = step.isSkippedWhenHidden === true;
  const cover_edge = step.coverEdge ?? "bottom";

  // A layout effect, declared before the measuring one, so a skip made while measuring calls
  // this render's callback rather than the last render's.
  useLayoutEffect(() => {
    on_skip_hidden_ref.current = onSkipHidden;
  }, [onSkipHidden]);

  // Show guide sits in the action strip and disappears as the card comes back, which would leave
  // focus on the page itself; the card's heading takes it instead.
  const was_collapsed_ref = useRef(progress.isCollapsed);
  useEffect(() => {
    const was_collapsed = was_collapsed_ref.current;
    was_collapsed_ref.current = progress.isCollapsed;
    if (!was_collapsed || progress.isCollapsed) return;
    if (document.activeElement === null || document.activeElement === document.body) {
      heading_ref.current?.focus();
    }
  }, [progress.isCollapsed]);

  useEffect(() => {
    if (!should_focus_heading_ref.current) return;
    should_focus_heading_ref.current = false;
    heading_ref.current?.focus();
  }, [progress.stepIndex]);

  /**
   * Move forward or back, sending focus to the new step's heading when it was inside the card.
   *
   * @param move - The step change to make.
   */
  const go = (move: () => void) => {
    should_focus_heading_ref.current = Boolean(card_ref.current?.contains(document.activeElement));
    move();
  };

  useLayoutEffect(() => {
    if (progress.isCollapsed) return;
    // Each showing of a step skips it at most once, however often it is measured; a later
    // visit, such as stepping back onto it, may skip it again.
    let has_skipped = false;
    const measure = () => {
      const card = card_ref.current;
      if (!card) return;
      const target = target_selector ? document.querySelector<HTMLElement>(target_selector) : null;
      if (is_skipped_when_hidden && target && is_hidden(target) && !has_skipped) {
        has_skipped = true;
        on_skip_hidden_ref.current();
        return;
      }
      const box = target?.getBoundingClientRect();
      const ring =
        box && box.width > 0 && box.height > 0
          ? {
              top: box.top - RING_PADDING_PX,
              left: box.left - RING_PADDING_PX,
              width: box.width + RING_PADDING_PX * 2,
              height: box.height + RING_PADDING_PX * 2,
            }
          : undefined;
      const next_layout: CoachLayout = {
        ring,
        card: place_coach_card(
          ring,
          { width: card.offsetWidth, height: card.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
          cover_edge,
        ),
      };
      set_layout((current) => (is_same_layout(current, next_layout) ? current : next_layout));
    };
    measure();
    const interval = window.setInterval(measure, COACH_MEASURE_INTERVAL_MS);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", measure);
    };
  }, [
    cover_edge,
    is_skipped_when_hidden,
    progress.isCollapsed,
    progress.stepIndex,
    target_selector,
  ]);

  if (progress.isCollapsed) return null;

  return (
    <>
      {layout?.ring ? (
        <div
          className="practice-ring"
          aria-hidden="true"
          style={{
            top: layout.ring.top,
            left: layout.ring.left,
            width: layout.ring.width,
            height: layout.ring.height,
          }}
        />
      ) : null}
      <aside
        ref={card_ref}
        className="practice-coach"
        aria-label="Practice guide"
        data-done={step.task !== undefined && is_done}
        data-tips={has_tips ? (are_tips_open ? "open" : "closed") : undefined}
        style={layout ? { top: layout.card.top, left: layout.card.left } : { visibility: "hidden" }}
      >
        <header>
          <span className="practice-badge">Practice day</span>
          <span className="practice-count">
            {position.label} {position.number} of {position.total}
          </span>
          <button
            type="button"
            className="practice-hide"
            aria-label="Hide the practice guide"
            onClick={() => onCollapsedChange(true)}
          >
            –
          </button>
        </header>
        <div
          className="practice-track"
          role="progressbar"
          aria-label="Practice progress"
          aria-valuemin={1}
          aria-valuemax={position.total}
          aria-valuenow={position.number}
        >
          <i style={{ width: `${(position.number / position.total) * 100}%` }} />
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h2 ref={heading_ref} tabIndex={-1}>
            {step.title}
          </h2>
          {step.intro ? <p>{step.intro}</p> : null}
          {note ? <p className="practice-note">{note}</p> : null}
          {step.flow ? <GuideFlow stages={step.flow.stages} label={step.flow.label} /> : null}
          {step.points ? <GuidePoints points={step.points} /> : null}
          {step.task ? (
            <p className="practice-task">
              {is_done ? (
                <>
                  <span aria-hidden="true">✓ </span>
                  {step.doneMessage ?? "Done!"}
                </>
              ) : (
                <>
                  <strong>Your turn: </strong>
                  {step.task}
                </>
              )}
            </p>
          ) : null}
          {progress_line && !is_done ? <p className="practice-progress">{progress_line}</p> : null}
        </div>
        {has_tips ? (
          <button
            type="button"
            className="practice-tips-toggle"
            aria-expanded={are_tips_open}
            onClick={() => set_tips_step(are_tips_open ? undefined : progress.stepIndex)}
          >
            {are_tips_open ? "Hide tips" : "Show tips"}
          </button>
        ) : null}
        <footer>
          {progress.stepIndex > 0 ? (
            <button type="button" className="text-button practice-back" onClick={() => go(onBack)}>
              <span aria-hidden="true">← </span>Back
            </button>
          ) : null}
          {is_end ? (
            <>
              <button type="button" className="text-button" onClick={() => onCollapsedChange(true)}>
                Keep practising
              </button>
              {is_finish ? (
                <button
                  type="button"
                  className="text-button practice-bonus"
                  onClick={() => go(onNext)}
                >
                  Bonus tools
                </button>
              ) : null}
              <button type="button" className="primary-button" onClick={onExit}>
                Go to my centre <span aria-hidden="true">→</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="text-button practice-exit" onClick={onExit}>
                Exit practice
              </button>
              {is_done ? (
                <button type="button" className="primary-button" onClick={() => go(onNext)}>
                  {progress.stepIndex === 0 ? "Let's go" : "Next"} <span aria-hidden="true">→</span>
                </button>
              ) : step.isRequired ? null : (
                <button type="button" className="text-button" onClick={() => go(onNext)}>
                  Skip this step
                </button>
              )}
            </>
          )}
        </footer>
      </aside>
    </>
  );
}
