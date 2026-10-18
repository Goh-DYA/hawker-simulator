// @vitest-environment jsdom
/**
 * Tests of `usePaintedPreviews`, the hook that asks the running controller for painted HUD
 * thumbnails and caches them.
 *
 * `requestAnimationFrame` queues callbacks until a test flushes them and `setTimeout` is fake,
 * so each test decides when a paint batch and a retry run.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePaintedPreviews } from "@/app/game/hooks";
import type { PreviewRequest } from "@/app/game/previews";
import type { RuntimeController } from "@/src/game/runtime/types";
import { expect_console_warning } from "@/tests/console";

/** The batch size and retry delay the hook uses. */
const PREVIEWS_PER_FRAME = 6;
const PREVIEW_RETRY_MS = 500;

/** Eight placeable thumbnails: more than one frame paints. */
const EIGHT_DEFINITIONS: readonly PreviewRequest[] = Array.from({ length: 8 }, (_, index) => ({
  kind: "definition",
  id: `item.test-${index}`,
}));

/** The animation-frame callbacks waiting to run, in request order. */
const queued_frames = new Map<number, FrameRequestCallback>();
let next_frame_id = 1;

/** Run every queued animation frame, including those they queue, inside `act`. */
function flush_frames(): void {
  act(() => {
    while (queued_frames.size > 0) {
      const [id, callback] = queued_frames.entries().next().value as [number, FrameRequestCallback];
      queued_frames.delete(id);
      callback(0);
    }
  });
}

/**
 * Build the controller the hook paints through.
 *
 * @param paint - Returns a definition's or dish's data URL, or undefined.
 * @returns The controller's two preview methods, recorded, as a controller ref.
 */
function create_controller_ref(paint: (key: string) => string | undefined) {
  const controller = {
    renderPreview: vi.fn((id: string) => paint(id)),
    renderDishPreview: vi.fn((id: string, variant_id?: string) =>
      paint(variant_id ? `${id}@${variant_id}` : id),
    ),
  };
  const ref = { current: controller as unknown as RuntimeController };
  return { controller, ref };
}

/**
 * @param key - A preview key.
 * @returns A fake data URL for it.
 */
function url_for(key: string): string {
  return `data:image/png;base64,${key}`;
}

beforeEach(() => {
  queued_frames.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = next_frame_id;
    next_frame_id += 1;
    queued_frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queued_frames.delete(id);
  });
});

afterEach(() => {
  cleanup();
  queued_frames.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("usePaintedPreviews", () => {
  it("asks for nothing until the runtime is ready", () => {
    const { controller, ref } = create_controller_ref(url_for);
    renderHook(() => usePaintedPreviews(ref, false, EIGHT_DEFINITIONS, "standard"));

    flush_frames();

    expect(controller.renderPreview).not.toHaveBeenCalled();
  });

  it("paints every requested thumbnail once ready, a batch per frame", () => {
    const { ref } = create_controller_ref(url_for);
    const { result } = renderHook(() =>
      usePaintedPreviews(ref, true, EIGHT_DEFINITIONS, "standard"),
    );

    act(() => {
      const [id, callback] = queued_frames.entries().next().value as [number, FrameRequestCallback];
      queued_frames.delete(id);
      callback(0);
    });
    const first_frame_count = Object.keys(result.current).length;
    flush_frames();

    expect([first_frame_count, result.current["item.test-7"]]).toEqual([
      PREVIEWS_PER_FRAME,
      url_for("item.test-7"),
    ]);
  });

  it("paints each thumbnail once while the requests stay the same", () => {
    const { controller, ref } = create_controller_ref(url_for);
    const { rerender } = renderHook(() =>
      usePaintedPreviews(ref, true, EIGHT_DEFINITIONS, "standard"),
    );

    flush_frames();
    rerender();
    flush_frames();

    expect(controller.renderPreview).toHaveBeenCalledTimes(EIGHT_DEFINITIONS.length);
  });

  it("paints a dish in the variant it is requested in", () => {
    const { controller, ref } = create_controller_ref(url_for);
    const requests: readonly PreviewRequest[] = [
      { kind: "dish", id: "dish.kopi", variantId: "kopi-c" },
    ];
    const { result } = renderHook(() => usePaintedPreviews(ref, true, requests, "standard"));

    flush_frames();

    expect([controller.renderDishPreview.mock.calls, result.current]).toEqual([
      [["dish.kopi", "kopi-c"]],
      { "dish.kopi@kopi-c": url_for("dish.kopi@kopi-c") },
    ]);
  });

  it("asks again after a delay while the scene cannot paint yet", async () => {
    let is_scene_ready = false;
    const { ref } = create_controller_ref((key) => (is_scene_ready ? url_for(key) : undefined));
    const requests = EIGHT_DEFINITIONS.slice(0, 1);
    const { result } = renderHook(() => usePaintedPreviews(ref, true, requests, "standard"));

    flush_frames();
    const before_retry = { ...result.current };
    is_scene_ready = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREVIEW_RETRY_MS);
    });
    flush_frames();

    expect([before_retry, result.current]).toEqual([{}, { "item.test-0": url_for("item.test-0") }]);
  });

  it("repaints the shown thumbnails when the scope changes", () => {
    const { controller, ref } = create_controller_ref(url_for);
    const requests = EIGHT_DEFINITIONS.slice(0, 2);
    const { rerender, result } = renderHook(
      ({ scope }) => usePaintedPreviews(ref, true, requests, scope),
      { initialProps: { scope: "standard" } },
    );

    flush_frames();
    rerender({ scope: "high-contrast" });
    const right_after_switch = { ...result.current };
    flush_frames();

    expect([right_after_switch, controller.renderPreview.mock.calls.length]).toEqual([{}, 4]);
  });

  it("keeps the fallback for good when a painter throws, and logs it", () => {
    expect_console_warning(/thumbnail "item\.test-0" could not be painted/);
    const { controller, ref } = create_controller_ref(() => {
      throw new Error("Simulated painter failure");
    });
    const requests = EIGHT_DEFINITIONS.slice(0, 1);
    const { result } = renderHook(() => usePaintedPreviews(ref, true, requests, "standard"));

    flush_frames();
    flush_frames();

    expect([result.current, controller.renderPreview.mock.calls.length]).toEqual([
      { "item.test-0": "" },
      1,
    ]);
  });
});
