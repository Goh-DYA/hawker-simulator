import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { describeSgd, formatSgd } from "../src/game/runtime/money";

describe("SGD formatting", () => {
  it("uses an explicit Singapore-dollar marker", () => {
    expect(formatSgd(420_000)).toBe("S$4,200");
    expect(formatSgd(750)).toBe("S$7.50");
    expect(formatSgd(750, "ledger")).toBe("SGD 7.50");
  });

  it("provides unambiguous accessible labels", () => {
    expect(describeSgd(101)).toBe("1 Singapore dollar and 1 cent");
    expect(describeSgd(-250)).toBe("minus 2 Singapore dollars and 50 cents");
  });

  it("rejects fractional and unsafe cent values", () => {
    expect(() => formatSgd(1.5)).toThrow(RangeError);
    expect(() => describeSgd(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("routes player-facing SGD copy through the shared formatter", async () => {
    const sources = await Promise.all([
      readFile(new URL("../app/game/HawkerSimulator.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/game/core/progression.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/game/runtime/activityFeed.ts", import.meta.url), "utf8"),
    ]);
    expect(sources.join("\n")).not.toContain("S$");
  });
});
