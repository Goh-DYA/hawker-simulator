/**
 * Draw-output tests for the nutrition variant cue renderer in `runtime/render/variants.ts`.
 *
 * Each reviewed variant is drawn into a recording graphics stub, and the digest of its calls is
 * compared with the fallback branch's digest for the same key and with its sibling variants'
 * digests, so every family's canvas branch is proven by what it draws rather than by source text.
 */
import type Phaser from "phaser";
import { describe, expect, it } from "vitest";

import { NUTRITION_CONTENT } from "@/src/content/index";
import { drawNutritionVariantCue, includes_any } from "@/src/game/runtime/render/variants";
import {
  variantVisualFamilyForKey,
  type DishVariantVisualFamily,
} from "@/src/game/runtime/visuals/dish";

import { create_recording_graphics, render_log } from "../fixtures";

/** Every visual family that a reviewed variant draws with, in content order. */
const REVIEWED_FAMILIES: readonly DishVariantVisualFamily[] = [
  "drink",
  "nasi-lemak",
  "carrot-cake",
  "prata",
  "fish-soup",
  "bak-chor",
  "murtabak",
  "briyani",
  "thosai",
  "yong-tau-foo",
  "ban-mian",
  "bak-kut-teh",
  "duck-rice",
];

/**
 * Sibling variants whose cues draw identically today, pinned as pre-refactor behaviour: the
 * yong tau foo branch picks its pieces by "fried" alone, so "mixed" draws like "boiled".
 */
const KNOWN_IDENTICAL_SIBLINGS: readonly (readonly string[])[] = [
  ["ytf-clear-boiled", "ytf-clear-mixed"],
  ["ytf-laksa-boiled", "ytf-laksa-mixed"],
];

/**
 * Draws one variant cue into a fresh recording graphics stub and digests the calls.
 *
 * @param visual_key - The variant's visual key.
 * @param family - The visual family branch to draw with.
 * @returns The sha256 of the recorded draw calls.
 */
function digest_cue(visual_key: string, family: DishVariantVisualFamily): string {
  const graphics = create_recording_graphics("cue") as Phaser.GameObjects.Graphics;
  render_log.start_recording();
  drawNutritionVariantCue(graphics, visual_key, family, 40, 30, 1.25);
  return render_log.stop_recording().sha256;
}

describe("nutrition variant cue draw output", () => {
  it("draws every reviewed family", () => {
    const families = NUTRITION_CONTENT.variantFamilies.flatMap((family) =>
      family.variants.map((variant) => variantVisualFamilyForKey(variant.visualKey)),
    );

    expect(new Set(families)).toEqual(new Set(REVIEWED_FAMILIES));
  });

  it("draws each reviewed variant differently from the fallback branch", () => {
    for (const family of NUTRITION_CONTENT.variantFamilies) {
      for (const variant of family.variants) {
        const visual_family = variantVisualFamilyForKey(variant.visualKey);

        expect(
          digest_cue(variant.visualKey, visual_family),
          `${family.dishId} ${variant.visualKey}`,
        ).not.toBe(digest_cue(variant.visualKey, "fallback"));
      }
    }
  });

  it("draws sibling variants of one dish differently, apart from the pinned pairs", () => {
    const identical_groups: string[][] = [];
    for (const family of NUTRITION_CONTENT.variantFamilies) {
      const keys_by_digest = new Map<string, string[]>();
      for (const variant of family.variants) {
        const digest = digest_cue(variant.visualKey, variantVisualFamilyForKey(variant.visualKey));
        keys_by_digest.set(digest, [...(keys_by_digest.get(digest) ?? []), variant.visualKey]);
      }
      identical_groups.push(...[...keys_by_digest.values()].filter((keys) => keys.length > 1));
    }

    expect(identical_groups).toEqual(KNOWN_IDENTICAL_SIBLINGS);
  });
});

describe("includes_any", () => {
  it("matches when any part is a substring of the value", () => {
    expect(includes_any("kopi-o-kosong", ["siew-dai", "kosong"])).toBe(true);
    expect(includes_any("kopi-o-kosong", ["teh", "one-sugar"])).toBe(false);
    expect(includes_any("kopi-o-kosong", [])).toBe(false);
  });
});
