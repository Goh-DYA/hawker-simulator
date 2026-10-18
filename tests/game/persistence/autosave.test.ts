/**
 * Tests for the debounced, serialised autosave queue.
 *
 * They pin the semantics the game screen relies on: coalescing within the debounce,
 * "saving" on schedule and on each write, status updates for the latest write only,
 * one write at a time, recovery after a failed write, `save` rejecting after `onError`,
 * and `flush` never rejecting. Every failed write logs `[autosave] write failed` with its
 * error. Timers are Vitest fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { create_autosave, type AutosaveStatus } from "@/src/game/persistence/autosave";
import { expect_console_warning } from "@/tests/console";

/** A write held open until the test settles it. */
interface HeldWrite {
  payload: unknown;
  resolve(): void;
  reject(error: unknown): void;
}

/** Build an autosave queue whose writes are held, with recorded statuses and errors. */
function create_harness(delay_ms?: number) {
  const writes: HeldWrite[] = [];
  const statuses: AutosaveStatus[] = [];
  const errors: unknown[] = [];
  const autosave = create_autosave({
    write: (payload) =>
      new Promise<void>((resolve, reject) => {
        writes.push({ payload, resolve, reject });
      }),
    onStatus: (status) => statuses.push(status),
    onError: (error) => errors.push(error),
    delayMs: delay_ms,
    setTimer: (callback, ms) => setTimeout(callback, ms),
    clearTimer: (handle) => clearTimeout(handle),
  });
  return { autosave, writes, statuses, errors };
}

/** Let pending promise callbacks run. */
async function drain_microtasks(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("create_autosave schedule", () => {
  it("writes only the last payload once the 200 ms debounce has passed", async () => {
    const { autosave, writes } = create_harness();
    autosave.schedule("a");
    await vi.advanceTimersByTimeAsync(150);
    autosave.schedule("b");
    await vi.advanceTimersByTimeAsync(199);
    const writes_before_debounce = writes.length;
    await vi.advanceTimersByTimeAsync(1);
    expect([writes_before_debounce, writes.map((write) => write.payload)]).toEqual([0, ["b"]]);
  });

  it("honours a custom debounce", async () => {
    const { autosave, writes } = create_harness(50);
    autosave.schedule("a");
    await vi.advanceTimersByTimeAsync(50);
    expect(writes.map((write) => write.payload)).toEqual(["a"]);
  });

  it("reports saving on schedule and again when the write starts, then saved", async () => {
    const { autosave, writes, statuses } = create_harness();
    autosave.schedule("a");
    const statuses_on_schedule = [...statuses];
    await vi.advanceTimersByTimeAsync(200);
    writes[0]!.resolve();
    await drain_microtasks();
    expect([statuses_on_schedule, statuses]).toEqual([["saving"], ["saving", "saving", "saved"]]);
  });
});

describe("create_autosave flush and cancel", () => {
  it("writes the pending payload at once on flush, without waiting for the debounce", async () => {
    const { autosave, writes } = create_harness();
    autosave.schedule("a");
    void autosave.flush();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(writes.map((write) => write.payload)).toEqual(["a"]);
  });

  it("does nothing on flush when no payload is pending", async () => {
    const { autosave, writes, statuses } = create_harness();
    await autosave.flush();
    expect([writes, statuses]).toEqual([[], []]);
  });

  it("drops the pending payload on cancel", async () => {
    const { autosave, writes } = create_harness();
    autosave.schedule("a");
    autosave.cancel();
    await vi.advanceTimersByTimeAsync(1_000);
    await autosave.flush();
    expect(writes).toEqual([]);
  });

  it("resolves flush even when its write fails", async () => {
    expect_console_warning(/\[autosave\] write failed Error: quota/);
    const { autosave, writes, errors } = create_harness();
    autosave.schedule("a");
    const flushed = autosave.flush();
    await drain_microtasks();
    writes[0]!.reject(new Error("quota"));
    await expect(flushed).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });
});

describe("create_autosave save", () => {
  it("runs writes one at a time, in call order", async () => {
    const { autosave, writes } = create_harness();
    void autosave.save("a");
    void autosave.save("b");
    await drain_microtasks();
    const writes_while_first_held = writes.map((write) => write.payload);
    writes[0]!.resolve();
    await drain_microtasks();
    expect([writes_while_first_held, writes.map((write) => write.payload)]).toEqual([
      ["a"],
      ["a", "b"],
    ]);
  });

  it("reports the outcome of the latest write only", async () => {
    expect_console_warning(/\[autosave\] write failed Error: quota/);
    const { autosave, writes, statuses } = create_harness();
    const first = autosave.save("a").catch(() => undefined);
    void autosave.save("b");
    await drain_microtasks();
    writes[0]!.reject(new Error("quota"));
    await first;
    const statuses_after_first = [...statuses];
    await drain_microtasks();
    writes[1]!.resolve();
    await drain_microtasks();
    expect([statuses_after_first, statuses]).toEqual([
      ["saving", "saving"],
      ["saving", "saving", "saved"],
    ]);
  });

  it("keeps reporting saving when an older write succeeds while a newer one is queued", async () => {
    const { autosave, writes, statuses } = create_harness();
    const first = autosave.save("a");
    void autosave.save("b");
    await drain_microtasks();
    writes[0]!.resolve();
    await first;
    expect(statuses).toEqual(["saving", "saving"]);
  });

  it("writes the next payload after a failed write", async () => {
    expect_console_warning(/\[autosave\] write failed Error: quota/);
    const { autosave, writes } = create_harness();
    const first = autosave.save("a").catch(() => undefined);
    await drain_microtasks();
    writes[0]!.reject(new Error("quota"));
    await first;
    void autosave.save("b");
    await drain_microtasks();
    expect(writes.map((write) => write.payload)).toEqual(["a", "b"]);
  });

  it("reports error and calls onError with the write's error", async () => {
    expect_console_warning(/\[autosave\] write failed Error: quota/);
    const { autosave, writes, statuses, errors } = create_harness();
    const cause = new Error("quota");
    const saved = autosave.save("a").catch(() => undefined);
    await drain_microtasks();
    writes[0]!.reject(cause);
    await saved;
    expect([statuses, errors]).toEqual([["saving", "error"], [cause]]);
  });

  it("rejects with the message the import flow shows, keeping the write's error as cause", async () => {
    expect_console_warning(/\[autosave\] write failed Error: quota/);
    const { autosave, writes } = create_harness();
    const cause = new Error("quota");
    const saved = autosave.save("a");
    await drain_microtasks();
    writes[0]!.reject(cause);
    await expect(saved).rejects.toMatchObject({ message: "Local save failed", cause });
  });
});

describe("create_autosave settle", () => {
  it("resolves once every queued write has settled, failed or not", async () => {
    expect_console_warning(/\[autosave\] write failed Error: quota/);
    const { autosave, writes } = create_harness();
    void autosave.save("a").catch(() => undefined);
    let is_settled = false;
    void autosave.settle().then(() => {
      is_settled = true;
    });
    await drain_microtasks();
    const settled_while_held = is_settled;
    writes[0]!.reject(new Error("quota"));
    await drain_microtasks();
    expect([settled_while_held, is_settled]).toEqual([false, true]);
  });
});
