import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { latestRuntimeSavePayload } from "../app/game/HawkerSimulator";

describe("Stage 1 browser persistence wiring", () => {
  it("prefers a fresh runtime export over a stale debounced payload", () => {
    const exportState = vi.fn(() => ({ tick: 42, cashCents: 12_345 }));
    expect(latestRuntimeSavePayload(
      { exportState },
      { tick: 41, cashCents: 12_000 },
    )).toEqual({ tick: 42, cashCents: 12_345 });
    expect(exportState).toHaveBeenCalledOnce();
  });

  it("captures fresh state before both pagehide and unmount flushes", async () => {
    const source = await readFile(
      new URL("../app/game/HawkerSimulator.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      "const flushOnPageHide = () => void flushPendingSave(true);",
    );
    expect(source).toMatch(/return \(\) => \{[\s\S]*void flushPendingSave\(true\);/);
  });
});
