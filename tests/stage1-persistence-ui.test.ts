import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  canCaptureLifecycleSave,
  latestRuntimeSavePayload,
} from "../app/game/HawkerSimulator";

describe("Stage 1 browser persistence wiring", () => {
  it("prefers a fresh runtime export over a stale debounced payload", () => {
    const exportState = vi.fn(() => ({ tick: 42, cashCents: 12_345 }));
    expect(latestRuntimeSavePayload(
      { exportState },
      { tick: 41, cashCents: 12_000 },
    )).toEqual({ tick: 42, cashCents: 12_345 });
    expect(exportState).toHaveBeenCalledOnce();
  });

  it("captures lifecycle saves only outside an exclusive local-data operation", async () => {
    expect(canCaptureLifecycleSave({ current: false })).toBe(true);
    expect(canCaptureLifecycleSave({ current: true })).toBe(false);

    const source = await readFile(
      new URL("../app/game/HawkerSimulator.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(
      /const flushOnPageHide = \(\) => \{[\s\S]*canCaptureLifecycleSave\(localDataOperationRef\)[\s\S]*flushPendingSave\(true\)/,
    );
    expect(source).toMatch(
      /return \(\) => \{[\s\S]*canCaptureLifecycleSave\(localDataOperationRef\)[\s\S]*flushPendingSave\(true\)/,
    );
  });

  it("detaches the stale runtime immediately after destructive commits", async () => {
    const source = await readFile(
      new URL("../app/game/HawkerSimulator.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(
      /committedImport = imported;[\s\S]*controllerRef\.current = undefined;[\s\S]*replacedController\?\.destroy\(\)/,
    );
    expect(source).toMatch(
      /resetCommitted = true;[\s\S]*controllerRef\.current = undefined;[\s\S]*replacedController\?\.destroy\(\)/,
    );
    expect(source).toMatch(
      /eraseCommitted = true;[\s\S]*controllerRef\.current = undefined;[\s\S]*replacedController\?\.destroy\(\)/,
    );
  });
});
