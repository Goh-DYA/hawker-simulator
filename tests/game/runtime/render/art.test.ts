/**
 * Tests for the ID-keyed art tables in `runtime/render/art.ts`.
 *
 * Every launch stall and placeable must have an explicit art entry, so adding content forces
 * an explicit art decision. The entries were generated from the substring chains the
 * renderers used before the tables existed; the equality tests pin that mapping, and the
 * gallery digest of `createHawkerRuntime.render.test.ts` (scenario 9a, every STALLS and
 * PLACEABLES entry placed) pins the drawn output.
 */
import { describe, expect, it } from "vitest";

import { PLACEABLES, STALLS } from "@/src/content";
import {
  classify_placeable_style,
  classify_stall_art,
  PLACEABLE_STYLE_BY_ID,
  resolve_placeable_style,
  resolve_stall_art,
  STALL_ART_BY_ID,
} from "@/src/game/runtime/render/art";

/**
 * Strips the content prefix from a placeable ID, as `visualRecipeForPlaceable` does.
 *
 * @param id - The placeable content ID.
 * @returns The placeable's motif.
 */
function motif_for(id: string): string {
  return id.replace(/^item\./, "");
}

describe("stall art table", () => {
  it("lists exactly the launch stall IDs", () => {
    expect(Object.keys(STALL_ART_BY_ID).sort()).toEqual(STALLS.map((stall) => stall.id).sort());
  });

  it("records the branch each stall reached through the substring chains", () => {
    for (const stall of STALLS) {
      expect(STALL_ART_BY_ID[stall.id], stall.id).toEqual(classify_stall_art(stall.id));
    }
  });

  it("falls back to the substring chains for an unlisted stall ID", () => {
    expect(resolve_stall_art("stall.new-coconut-kopi")).toEqual({
      roof: "coconut",
      workspace: "coconut",
    });
    expect(resolve_stall_art("toString")).toEqual({ roof: "awning", workspace: "generic" });
  });
});

describe("placeable style table", () => {
  it("lists exactly the launch placeable IDs under their categories", () => {
    const listed = Object.entries(PLACEABLE_STYLE_BY_ID).flatMap(([category, styles]) =>
      Object.keys(styles).map((id) => `${category}:${id}`),
    );

    expect(listed.sort()).toEqual(
      PLACEABLES.map((placeable) => `${placeable.category}:${placeable.id}`).sort(),
    );
  });

  it("records the branch each placeable reached through the substring chains", () => {
    for (const placeable of PLACEABLES) {
      expect(PLACEABLE_STYLE_BY_ID[placeable.category][placeable.id], placeable.id).toEqual(
        classify_placeable_style(placeable.category, motif_for(placeable.id)),
      );
    }
  });

  it("reads a listed ID from the table before its motif", () => {
    expect(
      resolve_placeable_style("table", { id: "item.round-cafe-table", motif: "folding-trestle" }),
    ).toEqual({ support: "pedestal", top: "round" });
  });

  it("falls back to the substring chains on the motif for an unlisted ID", () => {
    expect(
      resolve_placeable_style("fan", { id: "item.new-ceiling-fan", motif: "new-ceiling-fan" }),
    ).toBe("ceiling-rotor");
    expect(resolve_placeable_style("seat", { id: "toString", motif: "toString" })).toBe("chair");
  });
});
