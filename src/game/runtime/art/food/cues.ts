/**
 * The nutrition variant cue: the part of a served dish that shows which reviewed variant the
 * stall is serving. Each of the thirteen reviewed families has a layer painter that changes the
 * dish itself (the drink's colour and sugar, the protein beside the rice, the broth and pieces
 * in a bowl, the shape of the bread); an unreviewed key falls back to one to three outlined
 * triangles, counted from a stable hash of the key, so an active variant always shows.
 */
import type { DishVariantVisualFamily } from "../../visuals/dish";
import { stableVisualHash } from "../../visuals/palette";
import { css, fill_polygon, type PaintContext } from "../canvas";
import { includes_any, INK } from "./parts";
import {
  paint_bak_chor_layer,
  paint_bak_kut_teh_layer,
  paint_ban_mian_layer,
  paint_fish_soup_layer,
  paint_yong_tau_foo_layer,
} from "./variants/bowls";
import { paint_murtabak_layer, paint_prata_layer, paint_thosai_layer } from "./variants/breads";
import { paint_drink_layer } from "./variants/drinks";
import type { LayerPainter } from "./variants/layer";
import {
  paint_briyani_layer,
  paint_carrot_cake_layer,
  paint_duck_rice_layer,
  paint_nasi_lemak_layer,
} from "./variants/plates";

/** The families with their own reviewed composition. */
type ReviewedFamily = Exclude<DishVariantVisualFamily, "fallback">;

/** The layer painter of each reviewed family. */
const LAYER_PAINTERS: Readonly<Record<ReviewedFamily, LayerPainter>> = {
  drink: paint_drink_layer,
  "nasi-lemak": paint_nasi_lemak_layer,
  "carrot-cake": paint_carrot_cake_layer,
  prata: paint_prata_layer,
  "fish-soup": paint_fish_soup_layer,
  "bak-chor": paint_bak_chor_layer,
  murtabak: paint_murtabak_layer,
  briyani: paint_briyani_layer,
  thosai: paint_thosai_layer,
  "yong-tau-foo": paint_yong_tau_foo_layer,
  "ban-mian": paint_ban_mian_layer,
  "bak-kut-teh": paint_bak_kut_teh_layer,
  "duck-rice": paint_duck_rice_layer,
};

/** How much of the serving is left and how much detail to paint. */
export interface VariantLayerOptions {
  /** The uneaten share: 1, 2/3 or 1/3. */
  readonly remaining: number;
  /** True for the lower-end frame. */
  readonly isLowDetail: boolean;
  /**
   * Overrides the layer's seed, which is otherwise a stable hash of the visual key. Tests hold
   * it fixed so two keys can only paint differently through the branches their parts select.
   */
  readonly seed?: number;
}

/** Options for a variant cue painted on its own. */
export interface VariantCueOptions {
  /** Overrides the cue's seed (by default a stable hash of the visual key). */
  readonly seed?: number;
}

/**
 * Paints the fallback cue: one to three cream triangles outlined in ink at the dish centre.
 *
 * @param ctx - The paint context, translated to the dish centre.
 * @param visualKey - The variant's visual key, which sets the count.
 */
function paint_fallback_cue(ctx: PaintContext, visualKey: string): void {
  const count = 1 + (stableVisualHash(visualKey) % 3);
  ctx.save();
  ctx.lineJoin = "round";
  for (let index = 0; index < count; index += 1) {
    const tx = (index - (count - 1) / 2) * 6;
    const points: ReadonlyArray<readonly [number, number]> = [
      [tx, -4],
      [tx - 3, 2],
      [tx + 3, 2],
    ];
    fill_polygon(ctx, points, css(0xfff7e5, 0.95));
    ctx.beginPath();
    ctx.moveTo(tx, -4);
    ctx.lineTo(tx - 3, 2);
    ctx.lineTo(tx + 3, 2);
    ctx.closePath();
    ctx.strokeStyle = css(INK, 0.9);
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Paints a variant's layer around a dish centre, for a given share of the serving left.
 *
 * @param ctx - The paint context.
 * @param visualKey - The active variant's visual key.
 * @param family - The variant's visual family.
 * @param x - Dish centre x.
 * @param y - Dish centre y.
 * @param scale - Draw scale (1 at the dish texture size).
 * @param options - The uneaten share and the detail level.
 */
export function paint_variant_layer(
  ctx: PaintContext,
  visualKey: string,
  family: DishVariantVisualFamily,
  x: number,
  y: number,
  scale: number,
  options: VariantLayerOptions,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (family === "fallback") {
    paint_fallback_cue(ctx, visualKey);
  } else {
    LAYER_PAINTERS[family]({
      ctx,
      key: visualKey,
      remaining: options.remaining,
      isLowDetail: options.isLowDetail,
      seed: options.seed ?? stableVisualHash(visualKey),
      has: (...parts) => includes_any(visualKey, parts),
    });
  }
  ctx.restore();
}

/**
 * Paints the cue for a dish's active nutrition variant on top of the served dish: the family
 * picks the composition and substrings of the visual key pick the details within it, and a
 * `fallback` family draws one to three outlined triangles counted from a stable hash of the key.
 *
 * @param ctx - The paint context.
 * @param visualKey - The active variant's visual key.
 * @param family - The variant's visual family.
 * @param x - Dish centre x.
 * @param y - Dish centre y.
 * @param scale - The cue's draw scale (1 at the dish texture size).
 * @param options - An optional seed override; the fallback cue ignores it.
 */
export function paint_variant_cue(
  ctx: PaintContext,
  visualKey: string,
  family: DishVariantVisualFamily,
  x: number,
  y: number,
  scale: number,
  options: VariantCueOptions = {},
): void {
  paint_variant_layer(ctx, visualKey, family, x, y, scale, {
    remaining: 1,
    isLowDetail: false,
    seed: options.seed,
  });
}
