import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { PLACEABLES } from "@/src/content";
import {
  hasMeaningfulUtility,
  utilityEffectsForPlaceable,
} from "@/src/game/runtime/contentUtility";

describe("placeable gameplay utility", () => {
  it("gives every sign and facility a discoverable, non-zero simulation effect", () => {
    const managed = PLACEABLES.filter(
      (item) => item.category === "signage" || item.category === "facility",
    );
    assert.equal(managed.length, 14);
    assert.ok(managed.every(hasMeaningfulUtility));
    assert.ok(
      managed
        .filter((item) => item.category === "signage")
        .every((item) => utilityEffectsForPlaceable(item).wayfinding > 0),
    );
  });
});
