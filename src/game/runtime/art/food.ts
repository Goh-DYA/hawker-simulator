/**
 * Food painters: a dish serving in the 3/4 view, painted into a {@link DISH_SIZE} square that
 * the renderer scales for counters, trays and table tops.
 *
 * A serving is its vessel (a plate, platter or sizzling hot plate showing the sliver of its
 * edge, a bowl, claypot or steamer showing its rim and outer side, a kopitiam cup on its saucer
 * or a tall glass showing its side), the dish's own motif (two or three bold ingredients in
 * their true colours, garnish and a glaze highlight) and, for the dishes with reviewed nutrition
 * variants, the variant's layer, plus any sides the variant orders, painted over the rim. The eaten thirds take pieces away and lower the level while the vessel stays.
 * Each vessel is drawn at its real size against the dinner plate (`vessel_scale`), so a kopi or
 * a dim sum steamer is smaller than a plate of chicken rice wherever the texture is placed.
 *
 * The modules under `food/` hold the parts: `vessels.ts`, the motif registry in `motifs/`, the
 * variant layers in `variants/` behind `cues.ts`, and the ingredient primitives in `parts.ts`
 * and `toppings.ts`. This module keeps the public entry points.
 */
import {
  variantVisualFamilyForKey,
  type DishVesselProfile,
  type DishVisualRecipe,
} from "../visuals/dish";
import { stableVisualHash } from "../visuals/palette";
import type { PaintContext } from "./canvas";
import { paint_variant_layer, paint_variant_sides } from "./food/cues";
import { DEFAULT_LAYER_KEYS, motif_for } from "./food/motifs";
import { includes_any } from "./food/parts";
import { paint_vessel, vessel_scale, type VesselKind, type VesselStyle } from "./food/vessels";
import { DISH_SIZE, type DishPaintSpec, type PaintPlan } from "./specs";

export { paint_variant_cue } from "./food/cues";
export { includes_any, paint_noodles, paint_rice_mound } from "./food/parts";

/** The centre of a dish texture. */
const CENTRE = DISH_SIZE / 2;

/** The vessel shape each authored presentation profile is painted as. */
const VESSEL_BY_PROFILE: Readonly<Record<DishVesselProfile, VesselKind>> = {
  "ceramic-plate": "plate",
  "deep-ceramic-bowl": "bowl",
  "kopitiam-cup-and-saucer": "cup",
  "tall-drinking-glass": "glass",
  "banana-leaf-lined-plate": "leaf-plate",
  "shared-oval-platter": "platter",
  "cast-iron-hot-plate": "hot-plate",
  "bamboo-steamer": "steamer",
};

/** South Indian dishes served on banana leaf over a stainless steel plate. */
const STEEL_PLATE_DISHES: ReadonlySet<string> = new Set([
  "masala-thosai",
  "idli-sambar",
  "vadai-set",
  "lemon-rice",
  "appam",
]);

/** The painted band on plates and bowls, by food form, so dish families share their crockery. */
const BAND_BY_FORM: Readonly<Record<DishVisualRecipe["foodForm"], number>> = {
  rice: 0x3d6fa8,
  noodles: 0xc0503a,
  broth: 0x2e7f86,
  bread: 0xb8862a,
  dessert: 0x4f8f5a,
  seafood: 0xd95d39,
  snack: 0x5b8ea1,
  drink: 0x3f8a54,
};

/**
 * Chooses the vessel a dish is painted in: the recipe's profile, with the claypot for claypot
 * dishes, a bowl for the soup variant of a dish plated dry (wanton mee), stainless steel under
 * the banana leaf for South Indian sets, and a plain plate under the lotus leaf parcel (the
 * parcel is its own leaf).
 *
 * @param dishKey - The dish ID without the `dish.` prefix.
 * @param recipe - The dish recipe.
 * @param layerKey - The variant layer's key, if any.
 * @returns The vessel style.
 */
function choose_vessel(
  dishKey: string,
  recipe: DishVisualRecipe,
  layerKey: string | undefined,
): VesselStyle {
  let kind = VESSEL_BY_PROFILE[recipe.presentation.vessel];
  if (dishKey === "claypot-chicken-rice" || includes_any(layerKey ?? "", ["dry-claypot"])) {
    kind = "claypot";
  } else if (kind === "plate" && layerKey?.endsWith("-soup")) {
    kind = "bowl";
  } else if (kind === "leaf-plate" && STEEL_PLATE_DISHES.has(dishKey)) {
    kind = "steel-leaf-plate";
  } else if (dishKey === "lotus-leaf-rice") {
    kind = "plate";
  }
  return { kind, band: BAND_BY_FORM[recipe.foodForm] };
}

/**
 * Resolves the variant layer a serving is painted with: the active variant's, or for a dish
 * with a variant family and no active variant, its default variant's.
 *
 * @param dishKey - The dish ID without the `dish.` prefix.
 * @param recipe - The dish recipe.
 * @returns The layer key and family, or undefined for a dish without variants.
 */
function resolve_layer(dishKey: string, recipe: DishVisualRecipe) {
  if (recipe.variantVisualKey) {
    return {
      key: recipe.variantVisualKey,
      family: recipe.variantVisualFamily ?? variantVisualFamilyForKey(recipe.variantVisualKey),
    };
  }
  if (!Object.hasOwn(DEFAULT_LAYER_KEYS, dishKey)) return undefined;
  const key = DEFAULT_LAYER_KEYS[dishKey] as string;
  return { key, family: variantVisualFamilyForKey(key) };
}

/**
 * Paints one serving.
 *
 * @param ctx - The paint context.
 * @param spec - The dish spec.
 */
function paint_dish(ctx: PaintContext, spec: DishPaintSpec): void {
  const dishKey = spec.dishId.replace(/^dish\./, "");
  const { recipe, frame } = spec;
  const remaining = 1 - spec.eaten / 3;
  const layer = resolve_layer(dishKey, recipe);
  const style = choose_vessel(dishKey, recipe, layer?.key);
  const scale = vessel_scale(style.kind);
  ctx.save();
  if (scale !== 1) {
    ctx.translate(CENTRE, CENTRE);
    ctx.scale(scale, scale);
    ctx.translate(-CENTRE, -CENTRE);
  }
  const vessel = paint_vessel(ctx, style, CENTRE, CENTRE, remaining, frame.isLowDetail);
  ctx.save();
  vessel.clip(ctx);
  motif_for(
    dishKey,
    recipe.presentation.portionShape,
  )({
    ctx,
    cx: CENTRE,
    cy: CENTRE,
    area: vessel.area,
    remaining,
    seed: stableVisualHash(`${spec.dishId}:${recipe.variantVisualKey ?? ""}`),
    isLowDetail: frame.isLowDetail,
    portion: recipe.portionColour,
  });
  if (layer) {
    paint_variant_layer(ctx, layer.key, layer.family, CENTRE, CENTRE, 1, {
      remaining,
      isLowDetail: frame.isLowDetail,
    });
  }
  ctx.restore();
  vessel.finish(ctx);
  if (layer) {
    paint_variant_sides(ctx, layer.key, layer.family, CENTRE, CENTRE, {
      remaining,
      isLowDetail: frame.isLowDetail,
    });
  }
  if (frame.isHighContrast) vessel.ink(ctx, 1 / scale);
  ctx.restore();
}

/**
 * Plans a dish serving texture.
 *
 * @param spec - The dish spec.
 * @returns The square plan.
 */
export function plan_dish(spec: DishPaintSpec): PaintPlan {
  return {
    width: DISH_SIZE,
    height: DISH_SIZE,
    paint: (ctx) => paint_dish(ctx, spec),
  };
}
