/**
 * Tests for the retained sprite bookkeeping in `runtime/render/sprites.ts`: a slot only calls the
 * setters whose values changed, and a slot map destroys what a render did not claim.
 */
import { describe, expect, it } from "vitest";

import { SlotMap, SpriteSlot, type SlotImage } from "@/src/game/runtime/render/sprites";

/** An image stand-in that records every call. */
function create_image(calls: string[]): SlotImage {
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.join(",")})`);
      return undefined;
    };
  return {
    setTexture: record("setTexture"),
    setFrame: record("setFrame"),
    setPosition: record("setPosition"),
    setOrigin: record("setOrigin"),
    setScale: record("setScale"),
    setAngle: record("setAngle"),
    setDepth: record("setDepth"),
    setAlpha: record("setAlpha"),
    setTint: record("setTint"),
    clearTint: record("clearTint"),
    setBlendMode: record("setBlendMode"),
    setVisible: record("setVisible"),
    setFlipX: record("setFlipX"),
    destroy: () => {
      calls.push("destroy()");
    },
  };
}

describe("SpriteSlot", () => {
  it("applies a full state on first use and only the differences afterwards", () => {
    const calls: string[] = [];
    const slot = new SpriteSlot(create_image(calls));

    slot.apply({ key: "a", frame: "south/stand", x: 10, y: 20, depth: 5 });
    expect(calls).toEqual(["setTexture(a,south/stand)", "setPosition(10,20)", "setDepth(5)"]);

    calls.length = 0;
    slot.apply({
      key: "a",
      frame: "south/walk1",
      x: 10,
      y: 20,
      depth: 5,
      tint: 0xff0000,
      blend: "ADD",
    });
    expect(calls).toEqual(["setFrame(south/walk1)", "setTint(16711680)", "setBlendMode(ADD)"]);

    calls.length = 0;
    slot.apply({ key: "a", frame: "south/walk1", x: 10, y: 20, depth: 5, isFlipped: true });
    expect(calls).toEqual(["clearTint()", "setBlendMode(NORMAL)", "setFlipX(true)"]);

    calls.length = 0;
    slot.apply({ key: "b", x: 10, y: 20, depth: 5, scale: 0.5, originY: 0.75 });
    expect(calls).toEqual([
      "setTexture(b,)",
      "setOrigin(0.5,0.75)",
      "setScale(0.5,0.5)",
      "setFlipX(false)",
    ]);
  });

  it("hides once and shows again on the next apply", () => {
    const calls: string[] = [];
    const slot = new SpriteSlot(create_image(calls));
    slot.apply({ key: "a", x: 0, y: 0, depth: 1 });
    calls.length = 0;

    slot.hide();
    slot.hide();
    slot.apply({ key: "a", x: 0, y: 0, depth: 1 });

    expect(calls).toEqual(["setVisible(false)", "setVisible(true)"]);
  });
});

describe("SlotMap", () => {
  it("creates an image per id, reuses it, and destroys unclaimed slots on sweep", () => {
    const calls: string[] = [];
    const created: string[] = [];
    const map = new SlotMap((x, y, key) => {
      created.push(`${key}@${x},${y}`);
      return create_image(calls);
    });

    map.draw("one", { key: "a", x: 1, y: 2, depth: 1 });
    map.draw("two", { key: "b", x: 3, y: 4, depth: 1 });
    map.sweep();
    map.draw("one", { key: "a", x: 1, y: 2, depth: 1 });
    map.sweep();

    expect(created).toEqual(["a@1,2", "b@3,4"]);
    expect(calls.filter((call) => call === "destroy()")).toHaveLength(1);

    map.destroy();
    expect(calls.filter((call) => call === "destroy()")).toHaveLength(2);
  });
});
