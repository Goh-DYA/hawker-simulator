/**
 * React hooks behind the `HawkerSimulator` game screen.
 *
 * They hold the screen's wiring to everything outside React: the announcer that feeds
 * the toasts and the activity feed, the lazily created autosave queue, the preference
 * writes, the runtime lifecycle (preference and save loading, the lazy runtime
 * import, the audio director, PWA registration and teardown), and the painted HUD
 * thumbnails the running controller returns. Callbacks handed to
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
import { NO_PREVIEWS, preview_key, type PreviewRequest, type PreviewUrls } from "./previews";

/** The most thumbnails one animation frame paints, so a long catalogue never stalls a frame. */
const PREVIEWS_PER_FRAME = 6;

/** How long to wait before asking again for thumbnails the runtime could not paint yet, in ms. */
const PREVIEW_RETRY_MS = 500;

/** How many times to ask again; the scene normally boots within the first few tries. */
const MAX_PREVIEW_RETRIES = 40;

/** How long an error toast stays up, in milliseconds. */
const ERROR_TOAST_MS = 6_000;

/** How long every other toast stays up, in milliseconds. */
const TOAST_MS = 3_400;

/** The most toasts on screen at once. */
export const MAX_VISIBLE_TOASTS = 3;

/** The most unread events the Activity dock tab counts. */
const MAX_UNREAD_ACTIVITY = 99;

/** A popup toast: an announced event with its own sequence number. */
export interface Toast extends RuntimeEvent {
  id: number;
}

/**
 * Rank a toast for the queue: errors first, then important events, then warnings, then the rest.
 *
 * @param toast - The toast.
 * @returns A higher number for a toast that must stay on screen longer.
 */
function get_toast_priority(toast: RuntimeEvent): number {
  if (toast.kind === "error") return 3;
  if (toast.importance === "important") return 2;
  if (toast.kind === "warning") return 1;
  return 0;
}

/**
 * Add a toast to the front of the visible toasts, keeping at most `limit`.
 *
 * When there are too many, the oldest toast of the lowest priority goes, so an error or an
 * important event is never pushed off screen by a routine one; a new toast that ranks below
 * every visible one is the one dropped.
 *
 * @param current - The visible toasts, newest first.
 * @param toast - The new toast.
 * @param limit - The most toasts kept; defaults to {@link MAX_VISIBLE_TOASTS}.
 * @returns The visible toasts, newest first.
 */
export function queue_toast(
  current: readonly Toast[],
  toast: Toast,
  limit = MAX_VISIBLE_TOASTS,
): Toast[] {
  const next = [toast, ...current];
  while (next.length > Math.max(1, limit)) {
    let drop_index = next.length - 1;
    for (let index = next.length - 1; index >= 0; index -= 1) {
      if (get_toast_priority(next[index]!) < get_toast_priority(next[drop_index]!)) {
        drop_index = index;
      }
    }
    next.splice(drop_index, 1);
  }
  return next;
}

/**
 * Draws a random world seed for a new centre, so each new centre gets its own neighbourhood
 * calendar. The seed is saved with the centre, so a reload or an import keeps the same days.
 *
 * @returns A non-zero unsigned 32-bit seed.
 */
function create_random_world_seed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
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
  /** The toasts on screen, newest first: up to three popup events, while their timers run. */
  toasts: Toast[];
  /** The activity feed, newest first. */
  activityEntries: readonly ActivityEntry[];
  /** Replaces the activity feed. */
  setActivityEntries(entries: readonly ActivityEntry[]): void;
  /** The unread count on the Activity dock tab. */
  activityUnread: number;
  /** Replaces the unread count. */
  setActivityUnread(count: number): void;
  /** Removes every toast on screen, as when the practice day swaps centres. */
  clearToasts(): void;
}

/**
 * Own the toasts, the activity feed and its unread count, and the storage warning latch.
 *
 * Toasts queue through {@link queue_toast}: up to three stay on screen, newest first, each
 * until its own timer ends.
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
    setToasts((current) => queue_toast(current, { ...event, id }));
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      event.kind === "error" ? ERROR_TOAST_MS : TOAST_MS,
    );
  }, []);

  useEffect(() => {
    isActivityPanelOpenRef.current = is_activity_panel_open;
  }, [is_activity_panel_open]);

  const clearToasts = useCallback(() => setToasts([]), []);

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
    clearToasts,
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
          createWorldSeed: create_random_world_seed,
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

/** The painted thumbnails and the scope they were painted in. */
interface PreviewCache {
  /** The scope the thumbnails belong to; a new scope starts an empty cache. */
  readonly scope: string;
  /** The painted thumbnails. */
  readonly urls: PreviewUrls;
}

/**
 * Paint the next batch of thumbnails through the controller.
 *
 * A thumbnail the runtime cannot paint yet (`undefined`, before its scene exists) is skipped,
 * so it is asked for again later. One whose painter throws is logged once and stored as an
 * empty string, so the surface keeps its fallback for good.
 *
 * @param controller - The running controller.
 * @param requests - The thumbnails not painted yet, in display order.
 * @returns The thumbnails painted in this batch, by cache key; at most
 *   {@link PREVIEWS_PER_FRAME}.
 */
function paint_preview_batch(
  controller: RuntimeController,
  requests: readonly PreviewRequest[],
): Record<string, string> {
  const painted: Record<string, string> = {};
  let painted_count = 0;
  for (const request of requests) {
    if (painted_count >= PREVIEWS_PER_FRAME) break;
    const key = preview_key(request);
    try {
      const url =
        request.kind === "dish"
          ? controller.renderDishPreview(request.id, request.variantId)
          : controller.renderPreview(request.id);
      if (url === undefined) continue;
      painted[key] = url;
    } catch (error) {
      report_failure(`thumbnail "${key}" could not be painted`, error);
      painted[key] = "";
    }
    painted_count += 1;
  }
  return painted;
}

/**
 * Ask the running controller for painted thumbnails and cache them for the component's life.
 *
 * Once the runtime is ready, each animation frame paints up to {@link PREVIEWS_PER_FRAME} of the
 * requested thumbnails that are not cached yet, until all are. While the controller returns
 * nothing (its scene is still booting), the hook asks again every {@link PREVIEW_RETRY_MS}, up
 * to {@link MAX_PREVIEW_RETRIES} times for the same requests. A thumbnail is requested once per
 * scope; changing `scope` (for example on a high-contrast switch) repaints what is shown.
 *
 * @param controllerRef - The running controller, once the runtime has started.
 * @param is_runtime_ready - Whether the runtime has started.
 * @param requests - The thumbnails the screen shows now.
 * @param scope - Names the look the thumbnails are painted in.
 * @returns The painted thumbnails of the current scope, keyed by `preview_key`; a surface shows
 *   its fallback while its key is missing or empty.
 */
export function usePaintedPreviews(
  controllerRef: RefObject<RuntimeController | undefined>,
  is_runtime_ready: boolean,
  requests: readonly PreviewRequest[],
  scope: string,
): PreviewUrls {
  const [cache, setCache] = useState<PreviewCache>({ scope, urls: NO_PREVIEWS });
  const urls = cache.scope === scope ? cache.urls : NO_PREVIEWS;
  const pending = requests.filter((request) => !Object.hasOwn(urls, preview_key(request)));
  const pending_signature = pending.map(preview_key).join("\n");
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  });

  useEffect(() => {
    if (!is_runtime_ready || pending_signature === "") return;
    let frame: number | undefined;
    let timer: number | undefined;
    let retries = 0;
    const paint_next_batch = () => {
      frame = undefined;
      const controller = controllerRef.current;
      const painted = controller ? paint_preview_batch(controller, pendingRef.current) : {};
      if (Object.keys(painted).length > 0) {
        // The new cache shrinks the pending list, which reruns this effect for the next batch.
        setCache((previous) => ({
          scope,
          urls: { ...(previous.scope === scope ? previous.urls : NO_PREVIEWS), ...painted },
        }));
        return;
      }
      if (retries >= MAX_PREVIEW_RETRIES) return;
      retries += 1;
      timer = window.setTimeout(() => {
        timer = undefined;
        frame = window.requestAnimationFrame(paint_next_batch);
      }, PREVIEW_RETRY_MS);
    };
    frame = window.requestAnimationFrame(paint_next_batch);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [controllerRef, is_runtime_ready, pending_signature, scope]);

  return urls;
}
