/**
 * Draw-output tests for the food painters in `runtime/art/food.ts` and `runtime/art/food/`.
 *
 * Every launch dish and every reviewed nutrition variant is painted into a recording context,
 * and the digest of its calls is compared: dishes against each other, eaten thirds against the
 * full serving, each variant's cue against the fallback branch and against its siblings (also at
 * one fixed seed, so a sibling cannot pass on seed jitter alone). So each composition is proven
 * by what it paints rather than by source text. Every launch dish has its own explicit motif,
 * the variant side pass paints only for a key that orders a side, and the hot plate is painted
 * from an in-test dish as well as under the chicken chop.
 *
 * The geometry is checked on real pixels, painted with `@napi-rs/canvas` (the gallery tool's
 * canvas) into a texture with a transparent margin round it: nothing may paint outside the dish
 * texture in any frame, eaten third, variant or pixel ratio, each vessel keeps its real size
 * against the dinner plate, and the eaten thirds of the dishes that eat away visibly change.
 */
import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";

import { DISHES, NUTRITION_CONTENT, getNutritionVariantFamily } from "@/src/content/index";
import type { PaintContext } from "@/src/game/runtime/art/canvas";
import { includes_any, paint_variant_cue, plan_dish } from "@/src/game/runtime/art/food";
import { paint_variant_sides } from "@/src/game/runtime/art/food/cues";
import { DEFAULT_LAYER_KEYS, DISH_MOTIFS } from "@/src/game/runtime/art/food/motifs";
import { food_area, vessel_scale, type VesselKind } from "@/src/game/runtime/art/food/vessels";
import { DISH_SIZE, type DishPaintSpec, type PaintFrame } from "@/src/game/runtime/art/specs";
import {
  variantVisualFamilyForKey,
  visualRecipeForDish,
  visualRecipeForDishVariant,
  type DishVariantVisualFamily,
} from "@/src/game/runtime/visuals/dish";

import { create_recording_context, record_paint } from "./fixtures";

/** The transparent margin painted round a dish texture, where stray paint is caught. */
const MARGIN = 12;

/** The texture pixel ratios of the standard and lower-end quality modes. */
const PIXEL_RATIOS: readonly number[] = [2, 1];

/** Alpha above which a pixel counts as part of a vessel's solid body, not its soft shadow. */
const SOLID_ALPHA = 200;

/**
 * The fewest pixels (at pixel ratio 2) an eaten third must change on the dishes that are eaten
 * away rather than piece by piece. The art review measured 182 and 317 on the earlier lotus leaf
 * rice and sambal stingray, which did not read as eaten.
 */
const MIN_EATEN_CHANGE = 260;

/** A dish painted onto real pixels, with the margin round it. */
interface DishRaster {
  /** Side of the raster in pixels. */
  readonly side: number;
  /** Raster pixels per world pixel. */
  readonly ratio: number;
  /** The RGBA bytes. */
  readonly data: Uint8ClampedArray;
}

/**
 * Paints a dish onto a canvas with a transparent margin round the texture.
 *
 * @param spec - The dish spec.
 * @param ratio - Raster pixels per world pixel.
 * @returns The raster.
 */
function rasterise_dish(spec: DishPaintSpec, ratio = 2): DishRaster {
  const side = (DISH_SIZE + MARGIN * 2) * ratio;
  const canvas = createCanvas(side, side);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.translate(MARGIN, MARGIN);
  plan_dish(spec).paint(ctx as unknown as PaintContext);
  return { side, ratio, data: ctx.getImageData(0, 0, side, side).data };
}

/**
 * Counts the painted pixels that fall outside the dish texture.
 *
 * @param raster - The painted dish.
 * @returns The number of pixels with any alpha outside the texture.
 */
function count_paint_outside(raster: DishRaster): number {
  const inner_start = MARGIN * raster.ratio;
  const inner_end = (MARGIN + DISH_SIZE) * raster.ratio;
  let count = 0;
  for (let y = 0; y < raster.side; y += 1) {
    for (let x = 0; x < raster.side; x += 1) {
      const is_inside = x >= inner_start && x < inner_end && y >= inner_start && y < inner_end;
      if (!is_inside && (raster.data[(y * raster.side + x) * 4 + 3] ?? 0) > 0) count += 1;
    }
  }
  return count;
}

/**
 * Measures the solid (near-opaque) part of a painted dish, leaving out the soft shadows.
 *
 * @param raster - The painted dish.
 * @returns Its width and height in world pixels.
 */
function measure_solid(raster: DishRaster): { width: number; height: number } {
  let [min_x, min_y, max_x, max_y] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < raster.side; y += 1) {
    for (let x = 0; x < raster.side; x += 1) {
      if ((raster.data[(y * raster.side + x) * 4 + 3] ?? 0) < SOLID_ALPHA) continue;
      [min_x, min_y] = [Math.min(min_x, x), Math.min(min_y, y)];
      [max_x, max_y] = [Math.max(max_x, x + 1), Math.max(max_y, y + 1)];
    }
  }
  return { width: (max_x - min_x) / raster.ratio, height: (max_y - min_y) / raster.ratio };
}

/**
 * Counts the pixels whose colour or alpha differs clearly between two rasters of one size.
 *
 * @param first - One painted dish.
 * @param second - The other.
 * @returns The number of pixels where any channel differs by more than 24.
 */
function count_changed_pixels(first: DishRaster, second: DishRaster): number {
  let count = 0;
  for (let index = 0; index < first.data.length; index += 4) {
    for (let channel = 0; channel < 4; channel += 1) {
      const a = first.data[index + channel] ?? 0;
      const b = second.data[index + channel] ?? 0;
      if (Math.abs(a - b) > 24) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

/**
 * Finds a launch dish by its ID.
 *
 * @param id - The dish ID.
 * @returns The dish definition.
 */
function launch_dish(id: string): (typeof DISHES)[number] {
  const dish = DISHES.find((candidate) => candidate.id === id);
  if (!dish) throw new Error(`No launch dish ${id}`);
  return dish;
}

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
  "prawn-mee",
  "economic-rice",
  "nasi-padang",
  "mee-siam",
  "wanton-mee",
  "western",
  "porridge",
];

/**
 * Sibling variants whose cues draw identically, with their own seeds or at
 * {@link FIXED_CUE_SEED}. Empty: the yong tau foo "mixed" variants float both boiled and fried
 * pieces, so they differ from the all-fried and laksa "boiled" variants.
 */
const KNOWN_IDENTICAL_SIBLINGS: readonly (readonly string[])[] = [];

/**
 * The seed every cue is painted with in the fixed-seed sibling test. A cue's own seed is a hash
 * of its key, so two keys that select the same painter branches still digest differently; held
 * fixed, only the branches the key's parts select can tell siblings apart.
 */
const FIXED_CUE_SEED = 7;

/** The frames every dish must paint in. */
const FRAMES: readonly PaintFrame[] = [
  { isHighContrast: false, isLowDetail: false },
  { isHighContrast: true, isLowDetail: false },
  { isHighContrast: false, isLowDetail: true },
];

/** Every vessel shape the food painters use. */
const VESSEL_KINDS: readonly VesselKind[] = [
  "plate",
  "leaf-plate",
  "steel-leaf-plate",
  "platter",
  "hot-plate",
  "bowl",
  "claypot",
  "steamer",
  "cup",
  "glass",
];

/**
 * Paints one variant cue into a fresh recording context and digests the calls.
 *
 * @param visual_key - The variant's visual key.
 * @param family - The visual family branch to paint with.
 * @param seed - A seed override, or undefined for the key's own seed.
 * @returns The sha256 of the recorded paint calls.
 */
function digest_cue(visual_key: string, family: DishVariantVisualFamily, seed?: number): string {
  const recording = create_recording_context();
  paint_variant_cue(recording.ctx, visual_key, family, 18, 18, 1, { seed });
  return recording.digest();
}

/**
 * Groups the sibling variants of each variant family whose cues paint identically.
 *
 * @param seed - A seed override for every cue, or undefined for each key's own seed.
 * @returns The groups of two or more identical sibling keys, family by family.
 */
function find_identical_siblings(seed?: number): string[][] {
  const identical_groups: string[][] = [];
  for (const family of NUTRITION_CONTENT.variantFamilies) {
    const keys_by_digest = new Map<string, string[]>();
    for (const variant of family.variants) {
      const digest = digest_cue(
        variant.visualKey,
        variantVisualFamilyForKey(variant.visualKey),
        seed,
      );
      keys_by_digest.set(digest, [...(keys_by_digest.get(digest) ?? []), variant.visualKey]);
    }
    identical_groups.push(...[...keys_by_digest.values()].filter((keys) => keys.length > 1));
  }
  return identical_groups;
}

/**
 * Paints a variant's side pass alone into a fresh recording context, at the full serving and
 * at {@link FIXED_CUE_SEED}.
 *
 * @param visual_key - The variant's visual key.
 * @returns The recorded paint calls.
 */
function record_sides(visual_key: string): string[] {
  const recording = create_recording_context();
  paint_variant_sides(recording.ctx, visual_key, variantVisualFamilyForKey(visual_key), 18, 18, {
    remaining: 1,
    isLowDetail: false,
    seed: FIXED_CUE_SEED,
  });
  return recording.log;
}

/**
 * Counts the pixels painted in one raster where another of the same size is transparent.
 *
 * @param base - The raster painted without the extra parts.
 * @param extended - The raster painted with them.
 * @returns The number of pixels with alpha in `extended` and none in `base`.
 */
function count_new_coverage(base: DishRaster, extended: DishRaster): number {
  let count = 0;
  for (let index = 3; index < base.data.length; index += 4) {
    if ((base.data[index] ?? 0) === 0 && (extended.data[index] ?? 0) > 0) count += 1;
  }
  return count;
}

/**
 * Builds the spec of a launch dish's plain serving.
 *
 * @param dish - The dish definition.
 * @param eaten - The eaten thirds.
 * @param frame - The paint frame.
 * @returns The dish spec.
 */
function dish_spec(
  dish: (typeof DISHES)[number],
  eaten: DishPaintSpec["eaten"] = 0,
  frame: PaintFrame = FRAMES[0] as PaintFrame,
): DishPaintSpec {
  return { kind: "dish", dishId: dish.id, recipe: visualRecipeForDish(dish), eaten, frame };
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
    expect(find_identical_siblings()).toEqual(KNOWN_IDENTICAL_SIBLINGS);
  });

  it("draws sibling variants of one dish differently at one fixed seed", () => {
    expect(find_identical_siblings(FIXED_CUE_SEED)).toEqual(KNOWN_IDENTICAL_SIBLINGS);
  });

  it("paints the same cue identically twice", () => {
    expect(digest_cue("teh-pulled-foam", "drink")).toBe(digest_cue("teh-pulled-foam", "drink"));
  });

  it("paints a cue with its key's own seed unless a seed is given", () => {
    const key = "bak-chor-dry-sauce";

    expect(digest_cue(key, "bak-chor", FIXED_CUE_SEED)).toBe(
      digest_cue(key, "bak-chor", FIXED_CUE_SEED),
    );
    expect(digest_cue(key, "bak-chor", FIXED_CUE_SEED)).not.toBe(digest_cue(key, "bak-chor"));
  });
});

describe("dish serving draw output", () => {
  it("paints a dish-sized texture", () => {
    const dish = DISHES[0];
    if (!dish) throw new Error("No launch dishes");
    const plan = plan_dish(dish_spec(dish));

    expect([plan.width, plan.height]).toEqual([DISH_SIZE, DISH_SIZE]);
  });

  it("paints every launch dish in the default, high-contrast and low-detail frames", () => {
    for (const dish of DISHES) {
      for (const frame of FRAMES) {
        expect(() => record_paint(dish_spec(dish, 0, frame)), dish.id).not.toThrow();
        expect(record_paint(dish_spec(dish, 0, frame)).log.length, dish.id).toBeGreaterThan(20);
      }
    }
  });

  it("paints every launch dish differently from every other", () => {
    const ids_by_digest = new Map<string, string[]>();
    for (const dish of DISHES) {
      const digest = record_paint(dish_spec(dish)).digest();
      ids_by_digest.set(digest, [...(ids_by_digest.get(digest) ?? []), dish.id]);
    }
    const duplicates = [...ids_by_digest.values()].filter((ids) => ids.length > 1);

    expect(DISHES.length).toBe(91);
    expect(duplicates).toEqual([]);
  });

  it("paints the three eaten thirds of every dish differently", () => {
    for (const dish of DISHES) {
      const digests = ([0, 1, 2] as const).map((eaten) =>
        record_paint(dish_spec(dish, eaten)).digest(),
      );

      expect(new Set(digests).size, dish.id).toBe(3);
    }
  });

  it("paints the same spec identically twice", () => {
    for (const dish of DISHES) {
      expect(record_paint(dish_spec(dish, 1)).digest(), dish.id).toBe(
        record_paint(dish_spec(dish, 1)).digest(),
      );
    }
  });

  it("paints every reviewed variant of a dish, each differently from its siblings", () => {
    for (const dish of DISHES) {
      const family = getNutritionVariantFamily(dish.id);
      if (!family) continue;
      const digests = family.variants.map((variant) => {
        const spec: DishPaintSpec = {
          kind: "dish",
          dishId: dish.id,
          recipe: visualRecipeForDishVariant(dish, variant.visualKey),
          eaten: 0,
          frame: FRAMES[0] as PaintFrame,
        };
        return record_paint(spec).digest();
      });

      expect(new Set(digests).size, dish.id).toBe(family.variants.length);
    }
  });
});

describe("vessel food areas", () => {
  it("keep every food area inside the dish texture", () => {
    const centre = DISH_SIZE / 2;
    for (const kind of VESSEL_KINDS) {
      for (const remaining of [1, 2 / 3, 1 / 3]) {
        const area = food_area(kind, centre, centre, 1, remaining);

        expect(area.x - area.rx, `${kind} ${remaining}`).toBeGreaterThanOrEqual(0);
        expect(area.x + area.rx, `${kind} ${remaining}`).toBeLessThanOrEqual(DISH_SIZE);
        expect(area.y - area.ry, `${kind} ${remaining}`).toBeGreaterThanOrEqual(0);
        expect(area.y + area.ry, `${kind} ${remaining}`).toBeLessThanOrEqual(DISH_SIZE);
      }
    }
  });
});

describe("dish serving painted pixels", () => {
  it("paints nothing outside the dish texture in any frame, eaten third, variant or ratio", () => {
    const spills: string[] = [];
    for (const dish of DISHES) {
      const keys = [
        undefined,
        ...(getNutritionVariantFamily(dish.id)?.variants.map((variant) => variant.visualKey) ?? []),
      ];
      for (const key of keys) {
        const recipe = key ? visualRecipeForDishVariant(dish, key) : visualRecipeForDish(dish);
        for (const [frame_index, frame] of FRAMES.entries()) {
          for (const eaten of [0, 1, 2] as const) {
            for (const ratio of PIXEL_RATIOS) {
              const spec: DishPaintSpec = { kind: "dish", dishId: dish.id, recipe, eaten, frame };
              if (count_paint_outside(rasterise_dish(spec, ratio)) > 0) {
                spills.push(`${dish.id} ${key ?? "base"} f${frame_index} e${eaten} x${ratio}`);
              }
            }
          }
        }
      }
    }

    expect(spills).toEqual([]);
  });

  it("sizes each vessel against the dinner plate as real crockery is", () => {
    const plate = measure_solid(
      rasterise_dish(dish_spec(launch_dish("dish.poached-chicken-rice"))),
    );
    const relative_width = (id: string) =>
      measure_solid(rasterise_dish(dish_spec(launch_dish(id)))).width / plate.width;

    expect(plate.width).toBeGreaterThan(DISH_SIZE * 0.85);
    expect(relative_width("dish.chicken-congee")).toBeCloseTo(0.75, 1);
    expect(relative_width("dish.siew-mai")).toBeCloseTo(0.6, 1);
    expect(relative_width("dish.kopi")).toBeCloseTo(0.55, 1);
    expect(relative_width("dish.chicken-satay-set")).toBeGreaterThanOrEqual(1);
    expect(relative_width("dish.chicken-chop")).toBeGreaterThanOrEqual(1);
  });

  it("keeps a tall glass at its full height", () => {
    const glass = measure_solid(rasterise_dish(dish_spec(launch_dish("dish.teh-tarik"))));

    expect(vessel_scale("glass")).toBe(1);
    expect(glass.height).toBeGreaterThan(DISH_SIZE * 0.65);
  });

  it("visibly eats away the sambal stingray and the lotus leaf rice third by third", () => {
    for (const id of ["dish.sambal-stingray", "dish.lotus-leaf-rice"]) {
      const [full, third, two_thirds] = ([0, 1, 2] as const).map((eaten) =>
        rasterise_dish(dish_spec(launch_dish(id), eaten)),
      ) as [DishRaster, DishRaster, DishRaster];

      expect(count_changed_pixels(full, third), `${id} 0 to 1`).toBeGreaterThan(MIN_EATEN_CHANGE);
      expect(count_changed_pixels(third, two_thirds), `${id} 1 to 2`).toBeGreaterThan(
        MIN_EATEN_CHANGE,
      );
    }
  });
});

describe("variant side pass", () => {
  const dish = launch_dish("dish.bak-kut-teh");
  const sides_key = "bak-kut-teh-rice-youtiao";
  const variant_spec = (key: string, eaten: DishPaintSpec["eaten"] = 0): DishPaintSpec => ({
    kind: "dish",
    dishId: dish.id,
    recipe: visualRecipeForDishVariant(dish, key),
    eaten,
    frame: FRAMES[0] as PaintFrame,
  });

  it("paints sides only for the bak kut teh keys that order them", () => {
    const keys = [
      ...NUTRITION_CONTENT.variantFamilies.flatMap((family) =>
        family.variants.map((variant) => variant.visualKey),
      ),
      ...Object.values(DEFAULT_LAYER_KEYS),
    ];

    for (const key of keys) {
      const orders_sides =
        variantVisualFamilyForKey(key) === "bak-kut-teh" && includes_any(key, ["rice", "youtiao"]);

      if (orders_sides) expect(record_sides(key).length, key).toBeGreaterThan(0);
      else expect(record_sides(key), key).toEqual([]);
    }
    expect(record_sides("bak-kut-teh-pepper-soup")).toEqual([]);
  });

  it("paints a side bowl of rice and a you tiao stick for a key that orders both", () => {
    const rice = record_sides("bak-kut-teh-rice");
    const youtiao = record_sides("bak-kut-teh-youtiao");
    const both = record_sides(sides_key);

    expect(rice.length).toBeGreaterThan(0);
    expect(youtiao.length).toBeGreaterThan(0);
    // The rice bowl's calls, then the stick's, inside one save, translate and line style.
    expect(both).toEqual([...rice.slice(0, -1), ...youtiao.slice(4)]);
  });

  it("paints the sides outside the soup bowl's clip and inside the dish texture", () => {
    const soup = rasterise_dish(variant_spec("bak-kut-teh-pepper-soup"));
    const served = rasterise_dish(variant_spec(sides_key));

    expect(count_new_coverage(soup, served)).toBeGreaterThan(40);
    for (const [frame_index, frame] of FRAMES.entries()) {
      for (const eaten of [0, 1, 2] as const) {
        for (const ratio of PIXEL_RATIOS) {
          const spec: DishPaintSpec = { ...variant_spec(sides_key, eaten), frame };

          expect(
            count_paint_outside(rasterise_dish(spec, ratio)),
            `f${frame_index} e${eaten} x${ratio}`,
          ).toBe(0);
        }
      }
    }
  });

  it("eats the sides away with the serving", () => {
    const digests = ([0, 1, 2] as const).map((eaten) =>
      record_paint(variant_spec(sides_key, eaten)).digest(),
    );

    expect(new Set(digests).size).toBe(3);
  });
});

describe("hot plate vessel", () => {
  const plate_dish = launch_dish("dish.poached-chicken-rice");
  const hot_plate_dish: (typeof DISHES)[number] = {
    ...plate_dish,
    containerSprite: { ...plate_dish.containerSprite, frame: "hot-plate" },
  };
  const hot_plate_spec = (
    eaten: DishPaintSpec["eaten"] = 0,
    frame: PaintFrame = FRAMES[0] as PaintFrame,
  ): DishPaintSpec => dish_spec(hot_plate_dish, eaten, frame);

  it("serves a hot-plate container on the cast-iron hot plate", () => {
    expect(visualRecipeForDish(hot_plate_dish).presentation.vessel).toBe("cast-iron-hot-plate");
    expect(vessel_scale("hot-plate")).toBe(1);
  });

  it("paints in every frame, differently from the dinner plate, inside the dish texture", () => {
    expect(record_paint(hot_plate_spec()).digest()).not.toBe(
      record_paint(dish_spec(plate_dish)).digest(),
    );
    for (const [frame_index, frame] of FRAMES.entries()) {
      for (const eaten of [0, 1, 2] as const) {
        for (const ratio of PIXEL_RATIOS) {
          const raster = rasterise_dish(hot_plate_spec(eaten, frame), ratio);

          expect(count_paint_outside(raster), `f${frame_index} e${eaten} x${ratio}`).toBe(0);
        }
      }
    }
  });

  it("is at least as wide as the dinner plate", () => {
    const plate = measure_solid(rasterise_dish(dish_spec(plate_dish)));
    const hot_plate = measure_solid(rasterise_dish(hot_plate_spec()));

    expect(hot_plate.width / plate.width).toBeGreaterThanOrEqual(1);
  });
});

describe("dish motifs", () => {
  it("give every launch dish its own explicit motif", () => {
    const missing = DISHES.map((dish) => dish.id.replace(/^dish\./, "")).filter(
      (key) => !Object.hasOwn(DISH_MOTIFS, key),
    );

    expect(missing).toEqual([]);
  });
});

describe("default variant layers", () => {
  it("paint each variant family's content default when no variant is active", () => {
    const defaults = Object.fromEntries(
      NUTRITION_CONTENT.variantFamilies.map((family) => {
        const variant = family.variants.find((entry) => entry.id === family.defaultVariantId);
        return [family.dishId.replace(/^dish\./, ""), variant?.visualKey];
      }),
    );

    expect(DEFAULT_LAYER_KEYS).toEqual(defaults);
  });
});

describe("includes_any", () => {
  it("matches when any part is a substring of the value", () => {
    expect(includes_any("kopi-o-kosong", ["siew-dai", "kosong"])).toBe(true);
    expect(includes_any("kopi-o-kosong", ["teh", "one-sugar"])).toBe(false);
    expect(includes_any("kopi-o-kosong", [])).toBe(false);
  });
});
