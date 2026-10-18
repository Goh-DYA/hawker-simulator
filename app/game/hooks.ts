/**
 * React hooks behind the `HawkerSimulator` game screen.
 *
 * They hold the screen's wiring to everything outside React: the announcer that feeds
 * the toasts and the activity feed, the lazily created autosave queue, the preference
 * writes, and the runtime lifecycle (preference and save loading, the lazy runtime
 * import, the audio director, PWA registration and teardown). Callbacks handed to
 * {@link useAutosave} and {@link useHawkerRuntime} are read through refs at each use, so
 * the effects never restart when the component passes new closures.
 */
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

import { validateContent } from "@/src/content";
import { AudioDirector } from "@/src/game/audio/AudioDirector";
import {
  create_autosave,
  type Autosave,
  type AutosaveStatus,
} from "@/src/game/persistence/autosave";
import {
  DEFAULT_SETTINGS,
  load_player_preferences,
  type PlayerPreferences,
  type PreferenceKey,
} from "@/src/game/persistence/preferences";
import {
  loadGameCandidates,
  loadPreference,
  saveGame,
  savePreference,
} from "@/src/game/persistence/saveStore";
import { registerPwa, type PwaStatusHandlers } from "@/src/game/pwa/registerPwa";
import {
  appendActivityEvent,
  shouldShowPopup,
  type ActivityEntry,
} from "@/src/game/runtime/activityFeed";
import type { RuntimeController, RuntimeEvent, RuntimeSnapshot } from "@/src/game/runtime/types";

/** How long an error toast stays up, in milliseconds. */
const ERROR_TOAST_MS = 6_000;

/** How long every other toast stays up, in milliseconds. */
const TOAST_MS = 3_400;

/** The most unread events the Activity dock tab counts. */
const MAX_UNREAD_ACTIVITY = 99;

/** A popup toast: an announced event with its own sequence number. */
export interface Toast extends RuntimeEvent {
  id: number;
}

/**
 * Log a failure that the screen handles without rethrowing.
 *
 * @param context - What failed, such as `"preferences load failed"`.
 * @param error - The error that was caught.
 */
export function report_failure(context: string, error: unknown): void {
  console.warn(`[ui] ${context}`, error);
}

/** What {@link useAnnouncer} returns. */
export interface Announcer {
  /** Adds an event to the activity feed, counts it as unread and pops it up if it should. */
  announce(event: RuntimeEvent): void;
  /** Announces a storage warning, but only the first one of the component's life. */
  reportStorageIssue(message: string): void;
  /** The toasts on screen: the latest popup event, while its timer runs. */
  toasts: Toast[];
  /** The activity feed, newest first. */
  activityEntries: readonly ActivityEntry[];
  /** Replaces the activity feed. */
  setActivityEntries(entries: readonly ActivityEntry[]): void;
  /** The unread count on the Activity dock tab. */
  activityUnread: number;
  /** Replaces the unread count. */
  setActivityUnread(count: number): void;
}

/**
 * Own the toasts, the activity feed and its unread count, and the storage warning latch.
 *
 * `announce` and `reportStorageIssue` are stable for the component's life, so effects
 * that depend on them never restart.
 *
 * @param is_activity_panel_open - Whether the Activity panel is showing; events announced
 * while it shows are not counted as unread.
 * @returns The announcer's callbacks and state.
 */
export function useAnnouncer(is_activity_panel_open: boolean): Announcer {
  const storageWarningRef = useRef(false);
  const toastSequenceRef = useRef(0);
  const activitySequenceRef = useRef(0);
  const isActivityPanelOpenRef = useRef(is_activity_panel_open);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activityEntries, setActivityEntries] = useState<readonly ActivityEntry[]>([]);
  const [activityUnread, setActivityUnread] = useState(0);

  const announce = useCallback((event: RuntimeEvent) => {
    const activityId = ++activitySequenceRef.current;
    setActivityEntries((current) => appendActivityEvent(current, event, activityId));
    if (!isActivityPanelOpenRef.current) {
      setActivityUnread((current) => Math.min(MAX_UNREAD_ACTIVITY, current + 1));
    }
    if (!shouldShowPopup(event)) return;
    const id = ++toastSequenceRef.current;
    setToasts([{ ...event, id }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      event.kind === "error" ? ERROR_TOAST_MS : TOAST_MS,
    );
  }, []);

  useEffect(() => {
    isActivityPanelOpenRef.current = is_activity_panel_open;
  }, [is_activity_panel_open]);

  const reportStorageIssue = useCallback(
    (message: string) => {
      if (storageWarningRef.current) return;
      storageWarningRef.current = true;
      announce({ kind: "warning", message });
    },
    [announce],
  );

  return {
    announce,
    reportStorageIssue,
    toasts,
    activityEntries,
    setActivityEntries,
    activityUnread,
    setActivityUnread,
  };
}

/**
 * Return a stable writer for one player preference.
 *
 * A failed write is logged with {@link report_failure} and reported to the player through
 * `report_storage_issue`, and the returned promise still resolves.
 *
 * @param report_storage_issue - Announces a storage warning to the player.
 * @returns `persist_preference(key, value, failure_message)`, which writes `value` under
 * `key` and resolves once the write has settled.
 */
export function usePreferenceWriter(
  report_storage_issue: (message: string) => void,
): (key: PreferenceKey, value: unknown, failure_message: string) => Promise<void> {
  return useCallback(
    (key: PreferenceKey, value: unknown, failure_message: string) =>
      savePreference(key, value).catch((error: unknown) => {
        report_failure(`preference "${key}" write failed`, error);
        report_storage_issue(failure_message);
      }),
    [report_storage_issue],
  );
}

/** The callbacks of the autosave queue that {@link useAutosave} creates. */
export interface AutosaveCallbacks {
  /** Receives every autosave status change. */
  onStatus(status: AutosaveStatus): void;
  /** Receives every failed write. */
  onError(error: unknown): void;
}

/**
 * Create the component's autosave queue on first use, outside render, and keep it for the
 * component's life.
 *
 * @param callbacks - The status and error callbacks; the latest ones are called.
 * @returns A stable getter for the queue, which writes through `saveGame` with the
 * default debounce on window timers.
 */
export function useAutosave(callbacks: AutosaveCallbacks): () => Autosave {
  const autosaveRef = useRef<Autosave | undefined>(undefined);
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });
  return useCallback((): Autosave => {
    autosaveRef.current ??= create_autosave({
      write: saveGame,
      onStatus(status) {
        callbacksRef.current.onStatus(status);
      },
      onError(error) {
        callbacksRef.current.onError(error);
      },
      setTimer: (callback, delay_ms) => window.setTimeout(callback, delay_ms),
      clearTimer: (handle) => window.clearTimeout(handle),
    });
    return autosaveRef.current;
  }, []);
}

/** What {@link useHawkerRuntime} needs from the component. */
export interface HawkerRuntimeOptions {
  /** The element the runtime mounts its canvas in. */
  hostRef: RefObject<HTMLDivElement | null>;
  /** Receives the preferences read at startup, before the runtime is created. */
  onPreferences(preferences: PlayerPreferences): void;
  /** Announces a storage warning to the player. */
  onStorageIssue(message: string): void;
  /** Receives every runtime snapshot, before the audio mix follows it. */
  onSnapshot(snapshot: RuntimeSnapshot): void;
  /** Receives every runtime event, before its sound plays. */
  onEvent(event: RuntimeEvent): void;
  /** Receives every persistent state change. */
  onPersistentChange(state: unknown): void;
  /** Writes any pending save now; called on `pagehide` and on unmount. */
  onFlush(): void;
  /** The PWA status handlers, registered once the runtime is running. */
  pwa: PwaStatusHandlers;
}

/** What {@link useHawkerRuntime} returns. */
export interface HawkerRuntime {
  /** The running controller, once the runtime has started. */
  controllerRef: RefObject<RuntimeController | undefined>;
  /** The audio director, created when the effect first runs. */
  audioRef: RefObject<AudioDirector | undefined>;
  /** Whether the runtime is still starting. */
  isLoading: boolean;
  /** Why the runtime could not start, if it could not. */
  loadingError: string | undefined;
}

/**
 * Start the game runtime once the component mounts, and tear it down on unmount.
 *
 * The effect has an empty dependency list, so it runs once per mount (twice under
 * StrictMode, whose first run is disposed before its runtime is kept). Its first
 * statement issues the settings read, so a component that calls this hook before its
 * settings effect has the read queued ahead of that effect's write of the default
 * settings, and the stored settings survive. It then validates the content, reads the
 * remaining preferences and the save candidates, imports and creates the runtime, and
 * registers the PWA. A storage failure is announced and play continues with defaults; any
 * other startup failure becomes `loadingError`.
 *
 * @param options - The host element and the callbacks; the latest callbacks are called.
 * @returns The controller and audio refs and the loading state.
 */
export function useHawkerRuntime(options: HawkerRuntimeOptions): HawkerRuntime {
  const controllerRef = useRef<RuntimeController | undefined>(undefined);
  const audioRef = useRef<AudioDirector | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string>();
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const preferences_read = load_player_preferences(loadPreference, () => ({
      ...DEFAULT_SETTINGS,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    }));
    const { hostRef } = optionsRef.current;
    let disposed = false;
    let unregisterPwa: () => void = () => {};
    audioRef.current = new AudioDirector();

    async function start() {
      try {
        validateContent();
        let initialStates: readonly unknown[] = [];
        const preferences = await preferences_read;
        if ("error" in preferences) {
          report_failure("preferences load failed", preferences.error);
          optionsRef.current.onStorageIssue(
            "Local preferences are unavailable. The game will continue with defaults.",
          );
        }
        try {
          initialStates = await loadGameCandidates();
        } catch (error) {
          report_failure("saves load failed", error);
          optionsRef.current.onStorageIssue(
            "Local saves are unavailable in this browser session. You can still play, but progress may not persist.",
          );
        }
        if (disposed || !hostRef.current) return;
        optionsRef.current.onPreferences(preferences.values);
        const { createHawkerRuntime } = await import("@/src/game/runtime/createHawkerRuntime");
        const controller = await createHawkerRuntime({
          parent: hostRef.current,
          settings: preferences.values.settings,
          initialStates,
          onSnapshot(nextSnapshot) {
            optionsRef.current.onSnapshot(nextSnapshot);
            audioRef.current?.setGameplayState(
              nextSnapshot.isOpen,
              nextSnapshot.activeCustomers,
              nextSnapshot.queuePressure,
            );
          },
          onEvent(event) {
            optionsRef.current.onEvent(event);
            if (event.kind === "success") audioRef.current?.play("sale");
            if (event.kind === "error") audioRef.current?.play("invalid");
          },
          onPersistentChange(state) {
            optionsRef.current.onPersistentChange(state);
          },
        });
        if (disposed) controller.destroy();
        else {
          controllerRef.current = controller;
          unregisterPwa = registerPwa({
            onOfflineReady() {
              optionsRef.current.pwa.onOfflineReady();
            },
            onUpdateReady() {
              optionsRef.current.pwa.onUpdateReady();
            },
            onConnectivityChange(isOnline) {
              optionsRef.current.pwa.onConnectivityChange(isOnline);
            },
            onOfflineError(message) {
              optionsRef.current.pwa.onOfflineError(message);
            },
          });
        }
      } catch (error) {
        setLoadingError(error instanceof Error ? error.message : "The game could not start.");
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void start();
    const flushOnPageHide = () => optionsRef.current.onFlush();
    window.addEventListener("pagehide", flushOnPageHide);

    return () => {
      disposed = true;
      optionsRef.current.onFlush();
      window.removeEventListener("pagehide", flushOnPageHide);
      controllerRef.current?.destroy();
      audioRef.current?.destroy();
      unregisterPwa();
    };
  }, []);

  return { controllerRef, audioRef, isLoading: loading, loadingError };
}
