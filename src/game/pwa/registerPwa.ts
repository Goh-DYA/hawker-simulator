/**
 * Service-worker registration, offline-cache warming and the update protocol.
 *
 * This module owns the messages the page sends to `public/sw.js` and the activation of a
 * waiting update. Saving before an update stays with the UI, which calls
 * {@link activate_waiting_update} only once the save has succeeded.
 */
import { IS_PRODUCTION_BUILD } from "@/src/config/env";

/** The message types `public/sw.js` handles. */
export const SW_MESSAGE = {
  WARM_CACHE: "WARM_CACHE",
  ACTIVATE_UPDATE: "ACTIVATE_UPDATE",
} as const;

/** How long the page waits for the worker to answer a cache-warming request. */
export const WARM_CACHE_TIMEOUT_MS = 20_000;

/**
 * Callbacks for the offline status the UI shows: the offline cache is ready, an update is ready,
 * connectivity changed, or caching failed.
 */
export interface PwaStatusHandlers {
  onOfflineReady(): void;
  onUpdateReady(): void;
  onConnectivityChange(online: boolean): void;
  onOfflineError(message: string): void;
}

async function warmRuntimeCache(
  registration: ServiceWorkerRegistration,
  worker = registration.active,
): Promise<void> {
  if (!worker) throw new Error("The offline worker is not active yet.");
  const resourceUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => url.startsWith(location.origin));
  const urls = [...new Set([location.origin + "/", ...resourceUrls])];
  const channel = new MessageChannel();
  const result = await new Promise<{ ok: boolean; failed: number }>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Offline caching timed out.")),
      WARM_CACHE_TIMEOUT_MS,
    );
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(event.data as { ok: boolean; failed: number });
    };
    worker.postMessage({ type: SW_MESSAGE.WARM_CACHE, urls }, [channel.port2]);
  });
  if (!result.ok) throw new Error(`${result.failed} game files could not be cached.`);
}

/**
 * Tracks connectivity and, in production builds with service-worker support, registers `/sw.js`,
 * warms the offline cache and reports a waiting update once its cache is warm.
 *
 * Registration and caching failures are reported through `onOfflineError` rather than thrown.
 *
 * @param handlers - The status callbacks.
 * @returns A function that removes the connectivity listeners.
 */
export function registerPwa(handlers: PwaStatusHandlers): () => void {
  const updateConnectivity = () => handlers.onConnectivityChange(navigator.onLine);
  window.addEventListener("online", updateConnectivity);
  window.addEventListener("offline", updateConnectivity);
  updateConnectivity();

  if (!("serviceWorker" in navigator) || !IS_PRODUCTION_BUILD) {
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }

  void navigator.serviceWorker
    .register("/sw.js")
    .then(async (registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            void warmRuntimeCache(registration, worker)
              .then(() => handlers.onUpdateReady())
              .catch((error) =>
                handlers.onOfflineError(
                  error instanceof Error
                    ? `Update cache: ${error.message}`
                    : "The update cache could not be verified.",
                ),
              );
          }
        });
      });
      const ready = await navigator.serviceWorker.ready;
      await warmRuntimeCache(ready);
      handlers.onOfflineReady();
      if (registration.waiting) {
        await warmRuntimeCache(registration, registration.waiting);
        handlers.onUpdateReady();
      }
    })
    .catch((error) =>
      handlers.onOfflineError(
        error instanceof Error ? error.message : "Offline caching is unavailable.",
      ),
    );

  return () => {
    window.removeEventListener("online", updateConnectivity);
    window.removeEventListener("offline", updateConnectivity);
  };
}

/**
 * Activate the waiting service worker, then reload once it takes control.
 *
 * When no worker is waiting, it reloads at once. Callers save the game first.
 *
 * @param reload - Reloads the page; replaced in tests.
 * @returns A promise that resolves once the activation message is sent, or the reload is
 * requested.
 */
export async function activate_waiting_update(reload = () => location.reload()): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration?.waiting) {
    reload();
    return;
  }
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => reload(),
    { once: true },
  );
  registration.waiting.postMessage({ type: SW_MESSAGE.ACTIVATE_UPDATE });
}
