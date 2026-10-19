// @vitest-environment jsdom
/**
 * Tests of the toast queue behind `useAnnouncer`: `queue_toast`, which keeps up to three toasts
 * newest first and drops the oldest of the lowest priority, and the hook's own timers, which
 * take each toast down on its own schedule.
 *
 * `setTimeout` is fake, so each test decides when a toast's timer ends.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_VISIBLE_TOASTS, queue_toast, type Toast, useAnnouncer } from "@/app/game/hooks";

/** How long the hook keeps a non-error toast up, in milliseconds. */
const TOAST_MS = 3_400;

/**
 * @param id - The toast's sequence number.
 * @param change - The fields that differ from a plain warning.
 * @returns A toast.
 */
function make_toast(id: number, change: Partial<Toast> = {}): Toast {
  return { id, kind: "warning", message: `Toast ${id}`, ...change };
}

/**
 * @param toasts - Visible toasts.
 * @returns Their IDs, in order.
 */
function ids(toasts: readonly Toast[]): number[] {
  return toasts.map((toast) => toast.id);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("queue_toast", () => {
  it("keeps three toasts at most, newest first", () => {
    let toasts: Toast[] = [];
    for (const id of [1, 2, 3, 4]) toasts = queue_toast(toasts, make_toast(id));

    expect([MAX_VISIBLE_TOASTS, ids(toasts)]).toEqual([3, [4, 3, 2]]);
  });

  it("drops the oldest lowest-priority toast, never an error or an important one", () => {
    let toasts: Toast[] = [];
    toasts = queue_toast(toasts, make_toast(1, { kind: "error" }));
    toasts = queue_toast(toasts, make_toast(2));
    toasts = queue_toast(toasts, make_toast(3, { kind: "success", importance: "important" }));
    toasts = queue_toast(toasts, make_toast(4));

    expect(ids(toasts)).toEqual([4, 3, 1]);
  });

  it("drops a new toast that ranks below every visible one", () => {
    let toasts: Toast[] = [];
    for (const id of [1, 2, 3]) toasts = queue_toast(toasts, make_toast(id, { kind: "error" }));
    toasts = queue_toast(toasts, make_toast(4, { kind: "info", importance: "important" }));

    expect(ids(toasts)).toEqual([3, 2, 1]);
  });

  it("ranks errors above important events", () => {
    let toasts: Toast[] = [];
    toasts = queue_toast(toasts, make_toast(1, { kind: "success", importance: "important" }));
    toasts = queue_toast(toasts, make_toast(2, { kind: "error" }));
    toasts = queue_toast(toasts, make_toast(3, { kind: "error" }));
    toasts = queue_toast(toasts, make_toast(4, { kind: "error" }));

    expect(ids(toasts)).toEqual([4, 3, 2]);
  });
});

describe("useAnnouncer toasts", () => {
  it("shows each popup event until its own timer ends", () => {
    const { result } = renderHook(() => useAnnouncer(false));

    act(() => {
      result.current.announce({ kind: "warning", message: "First" });
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_MS / 2);
      result.current.announce({ kind: "warning", message: "Second" });
    });
    const both = result.current.toasts.map((toast) => toast.message);
    act(() => {
      vi.advanceTimersByTime(TOAST_MS / 2);
    });

    expect([both, result.current.toasts.map((toast) => toast.message)]).toEqual([
      ["Second", "First"],
      ["Second"],
    ]);
  });

  it("never pops up a routine event", () => {
    const { result } = renderHook(() => useAnnouncer(false));

    act(() => {
      result.current.announce({ kind: "info", message: "Sold", importance: "routine" });
    });

    expect(result.current.toasts).toEqual([]);
  });
});
