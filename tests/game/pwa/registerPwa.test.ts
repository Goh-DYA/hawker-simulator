/**
 * Tests for the service-worker update protocol in `registerPwa`.
 *
 * They pin the message type strings, check that the shipped `public/sw.js` handles each
 * one, and pin the order of calls `activate_waiting_update` makes against a stubbed
 * `navigator.serviceWorker`.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activate_waiting_update,
  SW_MESSAGE,
  WARM_CACHE_TIMEOUT_MS,
} from "@/src/game/pwa/registerPwa";

const SERVICE_WORKER_SOURCE = readFileSync(
  new URL("../../../public/sw.js", import.meta.url),
  "utf8",
);

/** Stub `navigator.serviceWorker` with a registration, recording each call in order. */
function stub_service_worker(registration: { waiting?: { postMessage(message: unknown): void } }) {
  const calls: unknown[][] = [];
  const listeners: Array<() => void> = [];
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => {
        calls.push(["getRegistration"]);
        return registration;
      },
      addEventListener: (type: string, listener: () => void, options: unknown) => {
        calls.push(["addEventListener", type, options]);
        listeners.push(listener);
      },
    },
  });
  return { calls, listeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("service-worker messages", () => {
  it("pins the message type strings and the warm-cache timeout", () => {
    expect([SW_MESSAGE, WARM_CACHE_TIMEOUT_MS]).toEqual([
      { WARM_CACHE: "WARM_CACHE", ACTIVATE_UPDATE: "ACTIVATE_UPDATE" },
      20_000,
    ]);
  });

  it.each(Object.values(SW_MESSAGE))("is handled by public/sw.js: %s", (type) => {
    expect(SERVICE_WORKER_SOURCE).toContain(`event.data?.type === "${type}"`);
  });
});

describe("activate_waiting_update", () => {
  it("reloads at once when no worker is waiting", async () => {
    const { calls } = stub_service_worker({});
    const reload = vi.fn();
    await activate_waiting_update(reload);
    expect([calls, reload.mock.calls.length]).toEqual([[["getRegistration"]], 1]);
  });

  it("reloads at once when the browser has no service worker support", async () => {
    vi.stubGlobal("navigator", {});
    const reload = vi.fn();
    await activate_waiting_update(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("listens for the controller change, then asks the waiting worker to activate", async () => {
    const posted: unknown[] = [];
    const { calls } = stub_service_worker({
      waiting: { postMessage: (message) => posted.push(message) },
    });
    const reload = vi.fn();
    await activate_waiting_update(reload);
    expect([calls, posted, reload.mock.calls.length]).toEqual([
      [["getRegistration"], ["addEventListener", "controllerchange", { once: true }]],
      [{ type: "ACTIVATE_UPDATE" }],
      0,
    ]);
  });

  it("reloads once the new worker takes control", async () => {
    const { listeners } = stub_service_worker({ waiting: { postMessage: () => undefined } });
    const reload = vi.fn();
    await activate_waiting_update(reload);
    listeners[0]!();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
