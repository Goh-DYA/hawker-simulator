/**
 * The heads-up display around the game world: the top bar, the world toolbar, the action
 * strip, the bottom dock, the toast stack and the developer debug panel.
 *
 * The world toolbar's mode label and message come from `get_toolbar_mode_label` and
 * `get_toolbar_message`, lookups that return the strings the shell's former nested ternaries
 * chose. The components are presentational: the `HawkerSimulator` shell keeps the state, the
 * audio and the runtime calls behind their callbacks, and passes `isInert` while a modal is
 * open so each surface keeps its `inert` and `aria-hidden` pair. Their classes, ARIA
 * attributes and copy are the shell's former inline markup.
 */
import type { RefObject } from "react";
import type {
  BuildTool,
  GameSpeed,
  RuntimeController,
  RuntimeSnapshot,
} from "@/src/game/runtime/types";
import { format_progress_percent, money, type Panel, TOAST_KIND_GLYPHS } from "./display";
import type { Toast } from "./hooks";

/** The world toolbar's mode label for each editing tool; the other tools show the centre state. */
export const TOOLBAR_MODE_LABELS: Readonly<Partial<Record<BuildTool, string>>> = {
  place: "Build mode",
  queue: "Queue editor",
  access: "Access editor",
  route: "Route editor",
};

/** The world toolbar's fixed instruction for each editor tool. */
const TOOLBAR_EDITOR_MESSAGES: Readonly<Partial<Record<BuildTool, string>>> = {
  queue: "Queue editor: choose adjacent clear tiles to bend the line; Escape finishes",
  access: "Access editor: choose an entry or exit, then choose a boundary tile",
  route:
    "Route editor: choose clear floor tiles to guide guests; choose a guide again to remove it; Escape finishes",
};

/** The bottom dock's panel tabs, in order: the panel, its icon and its label. */
export const DOCK_ITEMS = [
  ["focus", "◎", "Focus"],
  ["build", "▦", "Build"],
  ["stalls", "▰", "Stalls"],
  ["dishes", "◉", "Dishes"],
  ["insights", "⌁", "Insights"],
  ["activity", "◷", "Activity"],
] as const satisfies readonly (readonly [Panel, string, string])[];

/**
 * Name the world toolbar's mode.
 *
 * @param tool - The active build tool.
 * @param is_open - Whether the centre is open.
 * @returns The editing tool's label, else "Centre open" or "Planning mode".
 */
export function get_toolbar_mode_label(tool: BuildTool, is_open: boolean): string {
  const label = Object.hasOwn(TOOLBAR_MODE_LABELS, tool) ? TOOLBAR_MODE_LABELS[tool] : undefined;
  if (label !== undefined) return label;
  return is_open ? "Centre open" : "Planning mode";
}

/**
 * Choose the world toolbar's message.
 *
 * @param tool - The active build tool.
 * @param snapshot - Whether the centre is open and how many guests are inside.
 * @param selected_name - The selected build item's name, if an item is selected.
 * @returns The editor tool's instruction, else the placement prompt for the selected item,
 *   else the visitor count while open or the planning prompt while closed.
 */
export function get_toolbar_message(
  tool: BuildTool,
  snapshot: Pick<RuntimeSnapshot, "isOpen" | "activeCustomers">,
  selected_name: string | undefined,
): string {
  const editor_message = Object.hasOwn(TOOLBAR_EDITOR_MESSAGES, tool)
    ? TOOLBAR_EDITOR_MESSAGES[tool]
    : undefined;
  if (editor_message !== undefined) return editor_message;
  if (selected_name !== undefined) return `${selected_name} selected — choose a clear tile`;
  return snapshot.isOpen
    ? `${snapshot.activeCustomers} neighbours are visiting`
    : "Arrange your centre, then open the shutters";
}

/** The props of {@link TopBar}. */
export interface TopBarProps {
  /** The centre's cash, reputation, level, experience, day, clock and speed. */
  readonly snapshot: Pick<
    RuntimeSnapshot,
    | "cash"
    | "reputation"
    | "level"
    | "experience"
    | "nextLevelExperience"
    | "day"
    | "timeLabel"
    | "speed"
  >;
  /** Whether a modal is open, which makes the bar inert and hidden from assistive technology. */
  readonly isInert: boolean;
  /** Called with the speed the player chooses. */
  onSetSpeed(speed: GameSpeed): void;
  /** Called when the player opens Settings. */
  onOpenSettings(): void;
  /** Called when the player opens Help. */
  onOpenHelp(): void;
}

/**
 * Render the top bar: the brand, the centre status and the day, speed, settings and help controls.
 *
 * @param props - See {@link TopBarProps}.
 * @returns The top bar header.
 */
export function TopBar({ snapshot, isInert, onSetSpeed, onOpenSettings, onOpenHelp }: TopBarProps) {
  return (
    <header className="topbar" inert={isInert} aria-hidden={isInert}>
      <div className="brand-lockup" aria-label="Hawker Balance">
        <span className="brand-mark" aria-hidden="true">
          <span />
        </span>
        <div>
          <p>Nutrition edition</p>
          <h1>Hawker Balance</h1>
          <span className="brand-tagline">Run the centre. Read the plate.</span>
        </div>
      </div>

      <dl className="hud-stats" aria-label="Centre status">
        <div>
          <dt>Cash</dt>
          <dd data-testid="cash-value">{money(snapshot.cash)}</dd>
        </div>
        <div>
          <dt>Reputation</dt>
          <dd>
            <span aria-hidden="true">♥</span> {Math.round(snapshot.reputation)}
          </dd>
        </div>
        <div className="level-stat">
          <dt>Level {snapshot.level}</dt>
          <dd>
            <span className="progress-track" aria-hidden="true">
              <span
                style={{
                  width: format_progress_percent(snapshot.experience, snapshot.nextLevelExperience),
                }}
              />
            </span>
            <span className="sr-only">
              {snapshot.experience} of {snapshot.nextLevelExperience} experience
            </span>
          </dd>
        </div>
      </dl>

      <div className="day-controls">
        <div className="clock-card">
          <span>Day {snapshot.day}</span>
          <strong>{snapshot.timeLabel}</strong>
        </div>
        <div className="speed-group" aria-label="Simulation speed">
          {([0, 1, 2, 4, 10] as const).map((speed) => (
            <button
              type="button"
              key={speed}
              className={snapshot.speed === speed ? "is-active" : ""}
              aria-pressed={snapshot.speed === speed}
              aria-label={speed === 0 ? "Pause" : `${speed} times speed`}
              onClick={() => onSetSpeed(speed)}
            >
              {speed === 0 ? "Ⅱ" : `${speed}×`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Open settings and icon guide"
          onClick={() => onOpenSettings()}
        >
          ⚙
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Open help"
          onClick={() => onOpenHelp()}
        >
          ?
        </button>
      </div>
    </header>
  );
}

/** The props of {@link WorldToolbar}. */
export interface WorldToolbarProps {
  /** The active tool, the centre state and the selected object and access point. */
  readonly snapshot: Pick<
    RuntimeSnapshot,
    | "buildTool"
    | "isOpen"
    | "activeCustomers"
    | "selectedAccessPointId"
    | "selectedObjectId"
    | "selectedObjectDefinitionId"
  >;
  /** The selected build item's name, if an item is selected. */
  readonly selectedName: string | undefined;
  /** The runtime controller that edits access points and queues. */
  readonly controllerRef: RefObject<RuntimeController | undefined>;
  /** Called with the build tool the player chooses. */
  onChooseTool(tool: BuildTool): void;
  /** Called when the player starts or finishes the route editor. */
  onChooseRouteTool(): void;
}

/**
 * Render the world toolbar: the mode pill, the live message and the build tool buttons.
 *
 * @param props - See {@link WorldToolbarProps}.
 * @returns The world toolbar.
 */
export function WorldToolbar({
  snapshot,
  selectedName,
  controllerRef,
  onChooseTool,
  onChooseRouteTool,
}: WorldToolbarProps) {
  const selected_object_id = snapshot.selectedObjectId;
  return (
    <div className="world-toolbar">
      <div className="mode-pill">
        <span
          className={
            Object.hasOwn(TOOLBAR_MODE_LABELS, snapshot.buildTool) ? "amber-dot" : "green-dot"
          }
        />
        {get_toolbar_mode_label(snapshot.buildTool, snapshot.isOpen)}
      </div>
      <div className="world-message" aria-live="polite">
        {get_toolbar_message(snapshot.buildTool, snapshot, selectedName)}
      </div>
      <div className="tool-segment" aria-label="Build tools">
        {(["select", "move", "remove"] as const).map((tool) => (
          <button
            type="button"
            key={tool}
            aria-pressed={snapshot.buildTool === tool}
            className={snapshot.buildTool === tool ? "is-active" : ""}
            onClick={() => onChooseTool(tool)}
          >
            {tool === "select" ? "Select" : tool === "move" ? "Move" : "Remove"}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={snapshot.buildTool === "access"}
          className={snapshot.buildTool === "access" ? "is-active" : ""}
          onClick={() => onChooseTool(snapshot.buildTool === "access" ? "select" : "access")}
        >
          {snapshot.buildTool === "access" ? "Finish access" : "Access"}
        </button>
        <button
          type="button"
          aria-pressed={snapshot.buildTool === "route"}
          className={snapshot.buildTool === "route" ? "is-active" : ""}
          onClick={() => onChooseRouteTool()}
        >
          {snapshot.buildTool === "route" ? "Finish route" : "Route"}
        </button>
        {snapshot.buildTool === "access" ? (
          <>
            <button type="button" onClick={() => controllerRef.current?.addAccessPoint("entrance")}>
              + Entry
            </button>
            <button type="button" onClick={() => controllerRef.current?.addAccessPoint("exit")}>
              + Exit
            </button>
            <button
              type="button"
              disabled={!snapshot.selectedAccessPointId}
              onClick={() => controllerRef.current?.removeSelectedAccessPoint()}
            >
              Remove access
            </button>
          </>
        ) : null}
        {selected_object_id && snapshot.selectedObjectDefinitionId?.startsWith("stall.") ? (
          <button
            type="button"
            aria-pressed={snapshot.buildTool === "queue"}
            className={snapshot.buildTool === "queue" ? "is-active" : ""}
            onClick={() => {
              if (snapshot.buildTool === "queue") controllerRef.current?.finishQueueEdit();
              else controllerRef.current?.beginQueueEdit(selected_object_id);
            }}
          >
            {snapshot.buildTool === "queue" ? "Finish queue" : "Edit queue"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The props of {@link ActionStrip}. */
export interface ActionStripProps {
  /** The save state, the active tool, the undo and route state and whether the centre is open. */
  readonly snapshot: Pick<
    RuntimeSnapshot,
    "autosaveState" | "buildTool" | "canUndo" | "routeGuidePoints" | "isOpen"
  >;
  /** The runtime controller that undoes, rotates and clears the route. */
  readonly controllerRef: RefObject<RuntimeController | undefined>;
  /** Called with the build tool the player returns to. */
  onChooseTool(tool: BuildTool): void;
  /** Called when the player opens or closes the centre. */
  onToggleCentre(): void;
}

/**
 * Render the action strip: the save state, the edit actions and the centre toggle.
 *
 * @param props - See {@link ActionStripProps}.
 * @returns The action strip.
 */
export function ActionStrip({
  snapshot,
  controllerRef,
  onChooseTool,
  onToggleCentre,
}: ActionStripProps) {
  return (
    <div className="action-strip">
      <div className="save-state" role="status">
        <span className={snapshot.autosaveState === "error" ? "error-dot" : "green-dot"} />
        {snapshot.autosaveState === "saving"
          ? "Saving…"
          : snapshot.autosaveState === "error"
            ? "Save needs attention"
            : "Saved on this device"}
      </div>
      <div className="edit-actions">
        {snapshot.buildTool === "route" ? (
          <>
            <button
              type="button"
              disabled={!snapshot.canUndo}
              onClick={() => controllerRef.current?.undo()}
            >
              ↶ Undo
            </button>
            <button
              type="button"
              disabled={snapshot.routeGuidePoints.length === 0}
              onClick={() => controllerRef.current?.clearGuestRoute()}
            >
              Clear route
            </button>
            <button type="button" onClick={() => onChooseTool("select")}>
              Finish <kbd>Esc</kbd>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={!snapshot.canUndo}
              onClick={() => controllerRef.current?.undo()}
            >
              ↶ Undo
            </button>
            <button type="button" onClick={() => controllerRef.current?.rotateSelection()}>
              ↻ Rotate <kbd>R</kbd>
            </button>
            <button type="button" onClick={() => onChooseTool("select")}>
              Cancel <kbd>Esc</kbd>
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        className={snapshot.isOpen ? "centre-toggle close" : "centre-toggle"}
        data-testid="toggle-centre"
        onClick={() => onToggleCentre()}
      >
        <span aria-hidden="true">{snapshot.isOpen ? "▥" : "▤"}</span>
        {snapshot.isOpen ? "Close centre" : "Open centre"}
      </button>
    </div>
  );
}

/** The props of {@link BottomDock}. */
export interface BottomDockProps {
  /** The open panel. */
  readonly panel: Panel;
  /** How many activity events arrived while the Activity panel was closed. */
  readonly activityUnread: number;
  /** Whether a modal is open, which makes the dock inert and hidden from assistive technology. */
  readonly isInert: boolean;
  /** Called with the panel a tab opens and the tab, which gets focus back when the sheet closes. */
  onOpenPanel(panel: Panel, returnFocus: HTMLElement): void;
  /** Called when the player saves now. */
  onSaveNow(): void;
}

/**
 * Render the bottom dock: one tab per panel and the Save now button.
 *
 * @param props - See {@link BottomDockProps}.
 * @returns The dock navigation.
 */
export function BottomDock({
  panel,
  activityUnread,
  isInert,
  onOpenPanel,
  onSaveNow,
}: BottomDockProps) {
  return (
    <nav className="bottom-dock" aria-label="Game sections" inert={isInert} aria-hidden={isInert}>
      {DOCK_ITEMS.map(([value, icon, label]) => (
        <button
          type="button"
          key={value}
          className={panel === value ? "is-active" : ""}
          aria-current={panel === value ? "page" : undefined}
          aria-label={
            value === "activity" && activityUnread > 0
              ? `Activity, ${activityUnread} unread`
              : label
          }
          onClick={(event) => {
            onOpenPanel(value, event.currentTarget);
          }}
        >
          <span aria-hidden="true">{icon}</span>
          {label}
          {value === "activity" && activityUnread > 0 ? (
            <i className="dock-unread" aria-hidden="true">
              {activityUnread}
            </i>
          ) : null}
        </button>
      ))}
      <span className="dock-divider" />
      <button type="button" onClick={() => onSaveNow()}>
        <span aria-hidden="true">▣</span>
        Save now
      </button>
    </nav>
  );
}

/** The props of {@link ToastStack}. */
export interface ToastStackProps {
  /** Whether a service-worker update is waiting. */
  readonly isUpdateReady: boolean;
  /** The toasts on screen. */
  readonly toasts: readonly Toast[];
  /** Whether a modal is open, which makes the stack inert and hidden from assistive technology. */
  readonly isInert: boolean;
  /** Called when the player saves and applies the waiting update. */
  onApplyUpdate(): void;
}

/**
 * Render the toast stack: the update notice, if any, then the toasts.
 *
 * @param props - See {@link ToastStackProps}.
 * @returns The live toast region.
 */
export function ToastStack({ isUpdateReady, toasts, isInert, onApplyUpdate }: ToastStackProps) {
  return (
    <div
      className="toast-stack"
      aria-live="polite"
      aria-atomic="false"
      inert={isInert}
      aria-hidden={isInert}
    >
      {isUpdateReady ? (
        <div className="toast info">
          <span>↻</span>
          <p>A safe update is ready. Save, then reload when convenient.</p>
          <button type="button" onClick={() => onApplyUpdate()}>
            Save &amp; update
          </button>
        </div>
      ) : null}
      {toasts.map((toast) => (
        <div className={`toast ${toast.kind}`} key={toast.id}>
          <span aria-hidden="true">{TOAST_KIND_GLYPHS[toast.kind]}</span>
          <p>{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

/** The props of {@link DebugPanel}. */
export interface DebugPanelProps {
  /** Whether the panel is expanded. */
  readonly isOpen: boolean;
  /** Called when the player expands or collapses the panel. */
  onToggle(): void;
  /** The frame rate and simulation time the panel shows. */
  readonly snapshot: Pick<RuntimeSnapshot, "fps" | "simulationMs">;
  /** The runtime controller the developer tools drive. */
  readonly controllerRef: RefObject<RuntimeController | undefined>;
  /** Whether a modal is open, which makes the panel inert and hidden from assistive technology. */
  readonly isInert: boolean;
}

/**
 * Render the developer tools panel: its toggle and, when expanded, the timings and actions.
 *
 * @param props - See {@link DebugPanelProps}.
 * @returns The debug panel.
 */
export function DebugPanel({
  isOpen,
  onToggle,
  snapshot,
  controllerRef,
  isInert,
}: DebugPanelProps) {
  return (
    <section
      className={isOpen ? "debug-panel is-open" : "debug-panel"}
      aria-label="Developer tools"
      inert={isInert}
      aria-hidden={isInert}
    >
      <button type="button" onClick={() => onToggle()}>
        Debug {isOpen ? "×" : "+"}
      </button>
      {isOpen ? (
        <div>
          <code>
            {snapshot.fps.toFixed(0)} FPS · {snapshot.simulationMs.toFixed(2)} ms sim
          </code>
          <button type="button" onClick={() => controllerRef.current?.setDebugOverlay(true)}>
            Show grid data
          </button>
          <button type="button" onClick={() => controllerRef.current?.spawnCustomer()}>
            Spawn customer
          </button>
          <button type="button" onClick={() => controllerRef.current?.addCash(1_000)}>
            + $1,000
          </button>
        </div>
      ) : null}
    </section>
  );
}
