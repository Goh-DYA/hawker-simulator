/**
 * Tests for the label pool in `runtime/render/labels.ts`: text objects are reused between
 * renders, retyped only when they change, and hidden when a render does not place them.
 */
import { describe, expect, it } from "vitest";

import { LabelPool, type PoolText } from "@/src/game/runtime/render/labels";

/** A text stand-in that records every call. */
function create_text(calls: string[], index: number): PoolText {
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`#${index}.${name}(${args.join(",")})`);
      return undefined;
    };
  return {
    setPosition: record("setPosition"),
    setText: record("setText"),
    setColor: record("setColor"),
    setVisible: record("setVisible"),
    setOrigin: record("setOrigin"),
    setDepth: record("setDepth"),
    destroy: () => {
      calls.push(`#${index}.destroy()`);
    },
  };
}

describe("LabelPool", () => {
  it("reuses text objects across renders and hides the ones not placed", () => {
    const calls: string[] = [];
    let count = 0;
    const pool = new LabelPool(() => create_text(calls, count++));

    pool.begin();
    pool.place(10, 20, "3 guests");
    pool.place(30, 40, "+$12", "#1f6b3a");
    pool.end();
    expect(count).toBe(2);
    expect(calls).toEqual([
      "#0.setOrigin(0.5,0.5)",
      "#0.setDepth(90)",
      "#1.setOrigin(0.5,0.5)",
      "#1.setDepth(90)",
    ]);

    calls.length = 0;
    pool.begin();
    pool.place(10, 20, "4 guests");
    pool.end();
    expect(count).toBe(2);
    expect(calls).toEqual(["#0.setText(4 guests)", "#1.setVisible(false)"]);

    calls.length = 0;
    pool.begin();
    pool.place(10, 20, "4 guests");
    pool.place(31, 40, "+$12", "#9a3e31");
    pool.end();
    expect(calls).toEqual(["#1.setPosition(31,40)", "#1.setColor(#9a3e31)", "#1.setVisible(true)"]);

    pool.destroy();
    expect(calls.filter((call) => call.endsWith("destroy()"))).toHaveLength(2);
  });
});
