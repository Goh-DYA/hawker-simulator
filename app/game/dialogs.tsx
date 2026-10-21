/**
 * The game screen's modal dialogs: the first-run tutorial, the nutrition tour, Settings (with
 * the customer status icon guide), Help, the reset confirmation and the end-of-day Service
 * Review.
 *
 * The dialogs are presentational and moved out of the `HawkerSimulator` shell with their
 * markup, classes and ARIA attributes unchanged; the tutorial and nutrition-tour copy has since
 * been rewritten in plain words for young players, and the tutorial's last card and Help offer
 * the guided practice day. The shell keeps which dialog is open,
 * the tutorial and tour steps, the settings state and the focus trap; it passes each dialog's
 * section ref as a React 19 `ref` prop, so the trap still installs on the same `section`, and
 * the primary buttons keep `autoFocus`. The Settings switches and sliders are `SettingSwitch`
 * and `SettingSlider`, which hand each change to the shell's `update_setting(key, value)`, and
 * Settings ends with the game version and last-update note from `src/content/release.ts`.
 * `ServiceReviewDialog` follows the same pattern: the shell decides when it opens, pauses the
 * simulation behind it and installs the modal focus trap on its section.
 */
import { type ChangeEvent, type Ref, useRef, useState } from "react";
import { CONTENT_UPDATED_ON, CONTENT_VERSION, format_release_date } from "@/src/content";
import {
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
} from "@/src/game/persistence/preferences";
import type {
  RuntimeDayCard,
  RuntimeDayReport,
  RuntimeSettings,
} from "@/src/game/runtime/types";
import {
  CUSTOMER_INDICATOR_LEGEND,
  type CustomerIndicator,
} from "@/src/game/runtime/visuals/customer";
import { NutritionDisclosure } from "./NutritionEducation";
import { GuideFlow, type GuidePoint, GuidePoints } from "./guide";
import { describe_writer_verdict, money } from "./display";
import { type NutritionTourStep, TUTORIAL_DONE_STEP, type TutorialStep } from "./focus";

type CustomerLegendSymbol = CustomerIndicator | "patience";

function CustomerIndicatorIcon({ indicator }: { indicator: CustomerLegendSymbol }) {
  if (indicator === "patience") {
    return (
      <svg
        className="customer-indicator-icon is-patience"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.28" />
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="#e8b94f"
          strokeWidth="2.5"
          strokeDasharray="30 21"
          transform="rotate(-90 12 12)"
        />
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="#c75542"
          strokeWidth="2.5"
          strokeDasharray="10 41"
          strokeDashoffset="-31"
          transform="rotate(-90 12 12)"
        />
      </svg>
    );
  }

  let glyph;
  if (indicator === "question") {
    glyph = (
      <>
        <circle cx="12" cy="9" r="3.5" />
        <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
      </>
    );
  } else if (indicator === "footsteps") {
    glyph = (
      <>
        <ellipse cx="8.5" cy="14" rx="1.8" ry="3.6" fill="currentColor" stroke="none" />
        <ellipse cx="15.5" cy="10" rx="1.8" ry="3.6" fill="currentColor" stroke="none" />
      </>
    );
  } else if (indicator === "queue") {
    glyph = [7, 12, 17].map((cx) => (
      <circle key={cx} cx={cx} cy="12" r="1.7" fill="currentColor" stroke="none" />
    ));
  } else if (indicator === "order") {
    glyph = (
      <>
        <rect x="6" y="6.5" width="12" height="8.5" rx="2" />
        <path d="M10 15 8 19 8.5 15" />
      </>
    );
  } else if (indicator === "clock") {
    glyph = (
      <>
        <circle cx="12" cy="12" r="6" />
        <path d="M12 12V8M12 12l4 2" />
      </>
    );
  } else if (indicator === "seat") {
    glyph = <path d="M7 6v11M7 13h10M17 13v5" />;
  } else if (indicator === "meal") {
    glyph = (
      <>
        <circle cx="13" cy="12" r="5.5" />
        <path d="M6 6v12" />
      </>
    );
  } else if (indicator === "return") {
    glyph = <path d="M18 12H6m0 0 4-4m-4 4 4 4" />;
  } else {
    glyph = <path d="M6 12h12m0 0-4-4m4 4-4 4" />;
  }

  return (
    <svg
      className={`customer-indicator-icon is-${indicator}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="customer-indicator-bubble" cx="12" cy="12" r="10" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </g>
    </svg>
  );
}

function CustomerStatusLegend() {
  return (
    <div className="customer-status-legend">
      <p>The bubble above each customer shows what they are doing now.</p>
      <ul data-testid="customer-status-legend">
        {CUSTOMER_INDICATOR_LEGEND.map((entry) => (
          <li key={entry.indicator}>
            <CustomerIndicatorIcon indicator={entry.indicator} />
            <span>
              <strong>{entry.label}</strong>
              <small>{entry.description}</small>
            </span>
          </li>
        ))}
        <li>
          <CustomerIndicatorIcon indicator="patience" />
          <span>
            <strong>Patience ring</strong>
            <small>
              Shows patience remaining from the queue. It turns red when low and remains visible
              while food is prepared.
            </small>
          </span>
        </li>
      </ul>
    </div>
  );
}

function CustomerStatusGuide() {
  const [open, setOpen] = useState(false);

  return (
    <section className="settings-guide" aria-label="Customer status icon guide">
      <button
        type="button"
        aria-label="Customer status bubbles"
        aria-expanded={open}
        aria-controls="customer-status-legend-content"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>Customer status bubbles</strong>
          <small>See what every on-map symbol means</small>
        </span>
      </button>
      {open ? (
        <div id="customer-status-legend-content">
          <CustomerStatusLegend />
        </div>
      ) : null}
    </section>
  );
}

/**
 * The tutorial cards, in order; there is one card per step before `TUTORIAL_DONE_STEP`. The copy
 * is written for young players who are new to management games: a short lead-in line, then a
 * few one-sentence points with an icon each and, where it helps, a row of stages.
 */
const TUTORIAL_COPY: readonly {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro?: string;
  readonly flow?: readonly string[];
  readonly points: readonly GuidePoint[];
  readonly action: string;
}[] & { readonly length: typeof TUTORIAL_DONE_STEP } = [
  {
    eyebrow: "Welcome, neighbour",
    title: "Welcome to your hawker centre!",
    intro: "A hawker centre is a big food hall full of little food stalls.",
    points: [
      { icon: "🚶", text: "Hungry guests walk in." },
      { icon: "🍜", text: "They buy food from your stalls." },
      { icon: "🪑", text: "They sit down, eat, and go home." },
      { icon: "😊", text: "Your job: keep them fed and happy!" },
    ],
    action: "Show me around",
  },
  {
    eyebrow: "Step 1 of 4",
    title: "Look around",
    points: [
      { icon: "✋", text: "Drag the floor to move around the hall." },
      { icon: "🔍", text: "Scroll, or press + and −, to zoom in and out." },
      { icon: "⌨️", text: "On a keyboard, the arrow keys work too." },
    ],
    action: "Got it",
  },
  {
    eyebrow: "Step 2 of 4",
    title: "Open your stalls",
    intro: "You already have two food stalls, some tables and some seats.",
    points: [
      { icon: "🟢", text: "When you are ready, press Open centre under the map." },
      { icon: "🚶", text: "Then guests start to arrive." },
    ],
    action: "Next",
  },
  {
    eyebrow: "Step 3 of 4",
    title: "Watch your guests",
    intro: "Every guest makes the same trip:",
    flow: ["Pick a stall", "Line up", "Get food", "Sit and eat", "Go home"],
    points: [
      { icon: "💬", text: "The bubbles over their heads show what they are doing." },
      { icon: "⏳", text: "Long lines make guests grumpy, and some go home!" },
    ],
    action: "Next",
  },
  {
    eyebrow: "Step 4 of 4",
    title: "Earn cash and grow",
    points: [
      { icon: "💵", text: "Every meal you sell earns cash." },
      { icon: "🛠️", text: "Spend it in Build on more tables, seats and fans." },
      { icon: "🎯", text: "Finish the goals on the left to level up and unlock new stalls." },
      { icon: "⏸", text: "Press pause at any time." },
    ],
    action: "Start playing",
  },
];

/** The props of {@link TutorialDialog}. */
export interface TutorialDialogProps {
  /** The dialog section, which the shell's focus trap installs on. */
  readonly ref: Ref<HTMLElement>;
  /** The card to show; below `TUTORIAL_DONE_STEP`. */
  readonly step: TutorialStep;
  /** Finish the tutorial, opening the centre when `openCentre` is set (the last card). */
  readonly onFinish: (openCentre: boolean) => void;
  /** Finish the tutorial and start the guided practice day (the last card's other choice). */
  readonly onStartPractice: () => void;
  /** Move to another card. */
  readonly onStepChange: (step: TutorialStep) => void;
}

/**
 * The first-run tutorial: one card per step, a skip button and a primary button that advances
 * and, on the last card, opens the centre. The last card swaps the skip button for a callout
 * that offers the guided practice day.
 *
 * @param props - See {@link TutorialDialogProps}.
 * @returns The tutorial's backdrop and dialog.
 */
export function TutorialDialog({
  ref,
  step,
  onFinish,
  onStartPractice,
  onStepChange,
}: TutorialDialogProps) {
  const tutorialCopy = TUTORIAL_COPY[Math.min(step, 4)]!;
  const is_last_card = step === 4;

  return (
    <div className="modal-backdrop tutorial-backdrop" role="presentation">
      <section
        ref={ref}
        className="tutorial-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        tabIndex={-1}
      >
        <div className="tutorial-art" aria-hidden="true">
          <span className="art-fan" />
          <div className="art-stall">
            <span className="art-sign">Hawker Balance</span>
            <span className="art-canopy" />
            <span className="art-interior">
              <i className="art-duck" />
              <i className="art-duck" />
              <i className="art-steam" />
            </span>
            <span className="art-counter" />
          </div>
          <span className="art-drain" />
          <span className="art-table">
            <i className="art-plate" />
          </span>
          <span className="art-stool red" />
          <span className="art-stool green" />
          <span className="art-stool blue" />
          <span className="art-planter" />
        </div>
        <div className="tutorial-copy">
          <span>{tutorialCopy.eyebrow}</span>
          <h2 id="tutorial-title">{tutorialCopy.title}</h2>
          {tutorialCopy.intro ? <p>{tutorialCopy.intro}</p> : null}
          {tutorialCopy.flow ? (
            <GuideFlow stages={tutorialCopy.flow} label="A guest's visit" />
          ) : null}
          <GuidePoints points={tutorialCopy.points} />
          {is_last_card ? (
            <aside className="tutorial-practice" aria-labelledby="tutorial-practice-title">
              <span className="tutorial-practice-icon" aria-hidden="true">
                🧭
              </span>
              <div>
                <strong id="tutorial-practice-title">New to games like this?</strong>
                <p>Play a practice day with a guide. It shows you every button, one step at a
                  time, and nothing is saved.</p>
                <button
                  type="button"
                  className="practice-button"
                  onClick={() => onStartPractice()}
                >
                  Try a practice day <span aria-hidden="true">→</span>
                </button>
              </div>
            </aside>
          ) : null}
          <div className="tutorial-dots" aria-label={`Tutorial step ${step + 1} of 5`}>
            {TUTORIAL_COPY.map((_, index) => (
              <i key={index} className={index === step ? "is-active" : ""} />
            ))}
          </div>
          <div className={is_last_card ? "tutorial-actions is-end" : "tutorial-actions"}>
            {is_last_card ? null : (
              <button type="button" className="text-button" onClick={() => onFinish(false)}>
                Skip tutorial
              </button>
            )}
            <button
              type="button"
              className="primary-button"
              autoFocus
              onClick={() => {
                if (is_last_card) onFinish(true);
                else onStepChange((step + 1) as TutorialStep);
              }}
            >
              {tutorialCopy.action} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The points of the two nutrition-tour cards, in plain words for young players. */
const NUTRITION_TOUR_POINTS: readonly [readonly GuidePoint[], readonly GuidePoint[]] = [
  [
    { icon: "⭐", text: "Stars show how tasty and popular a dish is." },
    { icon: "♥", text: "The Health rating shows how balanced one serving is in the game." },
    { icon: "🍜", text: "Open Dishes to compare them." },
    { icon: "🔁", text: "Some dishes have recipe choices that change Health but not Stars." },
  ],
  [
    { icon: "🧑", text: "Some pretend guests are looking after a health condition." },
    { icon: "👆", text: "Click a guest to see which dishes fit them best, and why." },
    { icon: "⚖️", text: "Taste, price, waiting in line and walking far still matter to every guest." },
  ],
];

/** The props of {@link NutritionTourDialog}. */
export interface NutritionTourDialogProps {
  /** The dialog section, which the shell's focus trap installs on. */
  readonly ref: Ref<HTMLElement>;
  /** The card to show; below `NUTRITION_TOUR_DONE_STEP`. */
  readonly step: NutritionTourStep;
  /** Finish the tour, from the skip button or the last card. */
  readonly onFinish: () => void;
  /** Move to another card. */
  readonly onStepChange: (step: NutritionTourStep) => void;
}

/**
 * The two-card nutrition tour shown after the tutorial: the two ratings, then guest health
 * needs.
 *
 * @param props - See {@link NutritionTourDialogProps}.
 * @returns The tour's backdrop and dialog.
 */
export function NutritionTourDialog({
  ref,
  step,
  onFinish,
  onStepChange,
}: NutritionTourDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={ref}
        className="nutrition-tour-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nutrition-tour-title"
        tabIndex={-1}
      >
        <div className="nutrition-tour-art" aria-hidden="true">
          {step === 0 ? "◉" : "☺"}
        </div>
        <div className="nutrition-tour-copy">
          <span>Nutrition tour · {step + 1} of 2</span>
          <h2 id="nutrition-tour-title">
            {step === 0 ? "Two ratings for every dish" : "Every guest is different"}
          </h2>
          <GuidePoints points={NUTRITION_TOUR_POINTS[step === 0 ? 0 : 1]} />
          <div className="tutorial-actions">
            <button type="button" className="text-button" onClick={() => onFinish()}>
              Skip tour
            </button>
            <button
              type="button"
              className="primary-button"
              autoFocus
              onClick={() => {
                if (step === 1) onFinish();
                else onStepChange(1);
              }}
            >
              {step === 1 ? "Start balancing" : "Show guest health needs"}
              <span aria-hidden="true"> →</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The settings whose value is a boolean, shown as switches. */
export type BooleanSettingKey = {
  [K in keyof RuntimeSettings]: RuntimeSettings[K] extends boolean ? K : never;
}[keyof RuntimeSettings];

/** The settings whose value is a number, shown as sliders. */
export type NumberSettingKey = {
  [K in keyof RuntimeSettings]: RuntimeSettings[K] extends number ? K : never;
}[keyof RuntimeSettings];

/** Store one setting; the shell's `update_setting`. */
export type UpdateSetting = <K extends keyof RuntimeSettings>(
  key: K,
  value: RuntimeSettings[K],
) => void;

/** The props of {@link SettingSwitch}. */
export interface SettingSwitchProps {
  /** The boolean setting the switch controls. */
  readonly settingKey: BooleanSettingKey;
  /** The current settings. */
  readonly settings: RuntimeSettings;
  /** The switch's visible name. */
  readonly label: string;
  /** The hint under the name, if any. */
  readonly description?: string;
  /** Store a changed value. */
  readonly onUpdateSetting: UpdateSetting;
}

/**
 * A Settings switch row: a checkbox bound to one boolean setting.
 *
 * @param props - See {@link SettingSwitchProps}.
 * @returns The labelled checkbox.
 */
export function SettingSwitch({
  settingKey,
  settings,
  label,
  description,
  onUpdateSetting,
}: SettingSwitchProps) {
  return (
    <label className="switch-row">
      <span><strong>{label}</strong>{description === undefined ? null : <small>{description}</small>}</span>
      <input type="checkbox" checked={settings[settingKey]} onChange={(event) => onUpdateSetting(settingKey, event.target.checked)} />
    </label>
  );
}

/** The props of {@link SettingSlider}. */
export interface SettingSliderProps {
  /** The numeric setting the slider controls, shown as a percentage. */
  readonly settingKey: NumberSettingKey;
  /** The current settings. */
  readonly settings: RuntimeSettings;
  /** The slider's visible name, before the percentage. */
  readonly label: string;
  /** The range's `min` attribute. */
  readonly min: number | string;
  /** The range's `max` attribute. */
  readonly max: number | string;
  /** The range's `step` attribute. */
  readonly step: number | string;
  /** Store a changed value. */
  readonly onUpdateSetting: UpdateSetting;
}

/**
 * A Settings slider: a range bound to one numeric setting, labelled with its percentage.
 *
 * @param props - See {@link SettingSliderProps}.
 * @returns The labelled range.
 */
export function SettingSlider({
  settingKey,
  settings,
  label,
  min,
  max,
  step,
  onUpdateSetting,
}: SettingSliderProps) {
  return (
    <label>{`${label} `}<strong>{Math.round(settings[settingKey] * 100)}%</strong><input type="range" min={min} max={max} step={step} value={settings[settingKey]} onChange={(event) => onUpdateSetting(settingKey, Number(event.target.value))} /></label>
  );
}

/** The props of {@link SettingsDialog}. */
export interface SettingsDialogProps {
  /** The dialog section, which the shell's focus trap installs on. */
  readonly ref: Ref<HTMLElement>;
  /** The current settings. */
  readonly settings: RuntimeSettings;
  /** Whether the reset confirmation is open above Settings, which makes Settings inert. */
  readonly isResetOpen: boolean;
  /** Store one changed setting. */
  readonly onUpdateSetting: UpdateSetting;
  /** Close Settings. */
  readonly onClose: () => void;
  /** Download the current save. */
  readonly onExportSave: () => void;
  /** Import the save file the player picked. */
  readonly onImportSave: (event: ChangeEvent<HTMLInputElement>) => void;
  /**
   * Whether the guided practice day runs, which turns off export, import and reset and says why
   * in the dialog itself; absent counts as false.
   */
  readonly isPractice?: boolean;
  /** Open the reset confirmation. */
  readonly onOpenReset: () => void;
}

/**
 * The Settings dialog: the customer status guide, performance, readability and audio
 * settings, the local save actions, and a closing note with the game version and the date of
 * the last update.
 *
 * @param props - See {@link SettingsDialogProps}.
 * @returns The Settings backdrop and dialog.
 */
export function SettingsDialog({
  ref,
  settings,
  isResetOpen,
  onUpdateSetting,
  onClose,
  onExportSave,
  onImportSave,
  onOpenReset,
  isPractice = false,
}: SettingsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={ref} className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} inert={isResetOpen} aria-hidden={isResetOpen}>
        <header>
          <div><span>Preferences &amp; guide</span><h2 id="settings-title">Settings</h2></div>
          <button type="button" aria-label="Close settings" onClick={onClose}>×</button>
        </header>
        <div className="settings-content">
          <CustomerStatusGuide />
          <fieldset>
            <legend>Performance</legend>
            <label>
              Quality mode
              <select
                value={settings.quality}
                onChange={(event) => onUpdateSetting("quality", event.target.value as RuntimeSettings["quality"])}
              >
                <option value="standard">Standard · target 60 FPS</option>
                <option value="lower-end">Lower-end · target 30 FPS</option>
              </select>
            </label>
            <SettingSwitch settingKey="reducedMotion" settings={settings} label="Reduced motion" description="Calmer camera and fewer ambient animations" onUpdateSetting={onUpdateSetting} />
          </fieldset>
          <fieldset>
            <legend>Readability</legend>
            <SettingSlider settingKey="textScale" settings={settings} label="Text size" min={TEXT_SCALE_MIN} max={TEXT_SCALE_MAX} step={TEXT_SCALE_STEP} onUpdateSetting={onUpdateSetting} />
            <SettingSwitch settingKey="highContrast" settings={settings} label="High contrast" description="Deeper outlines and stronger status patterns" onUpdateSetting={onUpdateSetting} />
          </fieldset>
          <fieldset>
            <legend>Audio</legend>
            <SettingSwitch settingKey="masterMuted" settings={settings} label="Mute all audio" onUpdateSetting={onUpdateSetting} />
            <SettingSlider settingKey="musicVolume" settings={settings} label="Music volume" min="0" max="1" step="0.05" onUpdateSetting={onUpdateSetting} />
            <SettingSlider settingKey="ambienceVolume" settings={settings} label="Ambience volume" min="0" max="1" step="0.05" onUpdateSetting={onUpdateSetting} />
            <SettingSlider settingKey="sfxVolume" settings={settings} label="Effects volume" min="0" max="1" step="0.05" onUpdateSetting={onUpdateSetting} />
          </fieldset>
          <fieldset>
            <legend>Local data</legend>
            {isPractice ? (
              <p className="settings-practice-note" id="settings-practice-note">
                This is a practice day, so saving, loading and resetting are turned off. Press Exit
                practice to go back to your own centre.
              </p>
            ) : null}
            <div className="button-row">
              <button type="button" disabled={isPractice} aria-describedby={isPractice ? "settings-practice-note" : undefined} onClick={onExportSave}>Export save</button>
              <button type="button" disabled={isPractice} aria-describedby={isPractice ? "settings-practice-note" : undefined} onClick={() => fileInputRef.current?.click()}>Import save</button>
              <input ref={fileInputRef} className="sr-only" type="file" accept="application/json" onChange={onImportSave} />
            </div>
            <button type="button" className="danger-button" disabled={isPractice} aria-describedby={isPractice ? "settings-practice-note" : undefined} onClick={onOpenReset}>Reset game…</button>
          </fieldset>
          <p className="settings-version">Hawker Balance version {CONTENT_VERSION} · Last updated <time dateTime={CONTENT_UPDATED_ON}>{format_release_date(CONTENT_UPDATED_ON)}</time></p>
        </div>
        <footer><button type="button" className="primary-button" onClick={onClose}>Done</button></footer>
      </section>
    </div>
  );
}

/** The props of {@link HelpDialog}. */
export interface HelpDialogProps {
  /** The dialog section, which the shell's focus trap installs on. */
  readonly ref: Ref<HTMLElement>;
  /** Close Help. */
  readonly onClose: () => void;
  /** Close Help and restart the tutorial. */
  readonly onReplayTutorial: () => void;
  /** Close Help and restart the nutrition tour. */
  readonly onReplayNutritionTour: () => void;
  /** Close Help and start the guided practice day. */
  readonly onStartPractice: () => void;
}

/**
 * The Help dialog: the controls guide, the nutrition disclosure, the replay buttons and the
 * guided practice day.
 *
 * @param props - See {@link HelpDialogProps}.
 * @returns The Help backdrop and dialog.
 */
export function HelpDialog({
  ref,
  onClose,
  onReplayTutorial,
  onReplayNutritionTour,
  onStartPractice,
}: HelpDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={ref} className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" tabIndex={-1}>
        <header><div><span>How to play</span><h2 id="help-title">Neighbourhood guide</h2></div><button type="button" aria-label="Close help" onClick={onClose}>×</button></header>
        <div className="help-grid">
          <article><kbd>Drag</kbd><strong>Pan the map</strong><p>Or use the arrow keys while the world is focused.</p></article>
          <article><kbd>Wheel</kbd><strong>Zoom</strong><p>Use + and − on the keyboard too.</p></article>
          <article><kbd>R</kbd><strong>Rotate</strong><p>Multi-tile footprints preview before purchase.</p></article>
          <article><kbd>Esc</kbd><strong>Cancel</strong><p>Leave build mode without spending anything.</p></article>
          <article><kbd>Space</kbd><strong>Pause</strong><p>The simulation clamps time after a suspended tab.</p></article>
          <article><kbd>U</kbd><strong>Undo</strong><p>Restore the most recent build change safely.</p></article>
          <article><kbd>Menu</kbd><strong>Compare two ratings</strong><p>Health reflects nutrition balance; Stars reflect taste and popularity.</p></article>
          <article><kbd>Guest</kbd><strong>Inspect a visit</strong><p>See fictional health needs, personal fit, reasons, and stat effects.</p></article>
        </div>
        <NutritionDisclosure />
        <footer>
          <button type="button" onClick={onReplayTutorial}>Replay tutorial</button>
          <button type="button" onClick={onReplayNutritionTour}>Replay nutrition tour</button>
          <button type="button" onClick={onStartPractice}>Practice day with a guide</button>
          <button type="button" className="primary-button" onClick={onClose}>Back to centre</button>
        </footer>
      </section>
    </div>
  );
}

/** The props of {@link ResetDialog}. */
export interface ResetDialogProps {
  /** The dialog section, which the shell's focus trap installs on. */
  readonly ref: Ref<HTMLElement>;
  /** Close the confirmation and keep the centre. */
  readonly onCancel: () => void;
  /** Reset the centre. */
  readonly onConfirm: () => void;
}

/**
 * The reset confirmation, nested above Settings.
 *
 * @param props - See {@link ResetDialogProps}.
 * @returns The confirmation's backdrop and alert dialog.
 */
export function ResetDialog({ ref, onCancel, onConfirm }: ResetDialogProps) {
  return (
    <div className="modal-backdrop nested" role="presentation">
      <section ref={ref} className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" tabIndex={-1}>
        <span aria-hidden="true">!</span>
        <h2 id="reset-title">Reset this centre?</h2>
        <p id="reset-description">This removes the local save and starts again. Export first if you may want it later.</p>
        <div><button type="button" onClick={onCancel}>Keep playing</button><button type="button" className="danger-button" onClick={onConfirm}>Reset game</button></div>
      </section>
    </div>
  );
}

/** How many of the reasons guests left early the Service Review lists. */
const REVIEW_REASON_LIMIT = 3;

/** The props of {@link ServiceReviewDialog}. */
export interface ServiceReviewDialogProps {
  /** The dialog section, which the shell's focus trap installs on. */
  readonly ref: Ref<HTMLElement>;
  /** The finished day's review. */
  readonly report: RuntimeDayReport;
  /**
   * The day card of the day the review opens onto. The calendar has already turned when the
   * review appears, so this is the neighbourhood's `today` card: the "tomorrow" of the day
   * under review.
   */
  readonly nextDay?: RuntimeDayCard;
  /** Close the review and carry on with the next day. */
  readonly onClose: () => void;
}

/**
 * The end-of-day Service Review: the grade, the day's figures, why guests left early, one thing
 * to try, the food writer's verdict, the objectives and unlocks, the next day's forecast and
 * one button that opens it.
 *
 * The grade pairs a glyph with a warm word and is never a fail; the copy describes what
 * happened and never labels food or guests.
 *
 * @param props - See {@link ServiceReviewDialogProps}.
 * @returns The review's backdrop and dialog.
 */
export function ServiceReviewDialog({ ref, report, nextDay, onClose }: ServiceReviewDialogProps) {
  const reasons = report.leftEarlyReasons.slice(0, REVIEW_REASON_LIMIT);
  const verdict = report.writer
    ? describe_writer_verdict(report.writer.stallName, report.writer.outcome)
    : undefined;
  const unlocks =
    report.unlockedCount === 1 ? "1 new unlock" : `${report.unlockedCount} new unlocks`;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={ref}
        className="service-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-review-title"
        aria-describedby="service-review-headline"
        tabIndex={-1}
      >
        <span className="service-review-kicker">Service review</span>
        <h2 id="service-review-title">
          Day {report.day} wrapped · {report.cardName}
        </h2>
        <p className="service-review-grade" id="service-review-headline">
          <span aria-hidden="true">{report.gradeGlyph}</span> <strong>{report.grade}</strong>
          {" — "}
          {report.headline}
        </p>
        <dl className="service-review-figures">
          <div>
            <dt>Served</dt>
            <dd>{report.served}</dd>
          </div>
          <div>
            <dt>Left early</dt>
            <dd>{report.leftEarly}</dd>
          </div>
          <div>
            <dt>Takings</dt>
            <dd>{money(report.revenue)}</dd>
          </div>
        </dl>
        {reasons.length > 0 ? (
          <div className="service-review-reasons">
            <h3>Why some guests left early</h3>
            <ul>
              {reasons.map((reason) => (
                <li key={reason.reason}>
                  {reason.label} · {reason.count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {report.focusTip ? (
          <p className="service-review-tip">
            <strong>One thing to try:</strong> {report.focusTip.label} — {report.focusTip.action}
          </p>
        ) : null}
        {report.writer && verdict ? (
          <div className="service-review-writer" data-outcome={report.writer.outcome}>
            <p>
              <span aria-hidden="true">{verdict.glyph}</span> {verdict.text}
            </p>
            <blockquote>{report.writer.quote}</blockquote>
          </div>
        ) : null}
        <p className="service-review-progress">
          Objectives completed: {report.objectivesCompleted}/{report.objectivesTotal} · {unlocks}
        </p>
        {nextDay ? (
          <p className="service-review-tomorrow">
            <strong>Tomorrow:</strong> {nextDay.name} — {nextDay.forecast}
          </p>
        ) : null}
        <div className="tutorial-actions">
          <button type="button" className="primary-button" autoFocus onClick={onClose}>
            Open for Day {report.day + 1}
            <span aria-hidden="true"> →</span>
          </button>
        </div>
      </section>
    </div>
  );
}
