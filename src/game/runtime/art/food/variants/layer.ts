/**
 * The shared shape of a nutrition variant layer: the painter that lays the part of a dish that
 * changes with its reviewed variant (the drink in the cup, the protein beside the rice, the
 * broth and toppings in a bowl) on top of the dish's shared base.
 *
 * Layers paint around the dish centre at the origin and at unit scale; the cue entry point
 * translates and scales the context for them.
 */
import { css, fill_rounded_rect, SHADOW_INK, shade, tint, type PaintContext } from "../../canvas";

/** Everything a variant layer painter needs. */
export interface LayerPaint {
  /** The paint context, translated so the dish centre is the origin. */
  readonly ctx: PaintContext;
  /** The variant's visual key. */
  readonly key: string;
  /** The uneaten share of the serving: 1, 2/3 or 1/3. */
  readonly remaining: number;
  /** True for the lower-end frame. */
  readonly isLowDetail: boolean;
  /** A stable seed derived from the key. */
  readonly seed: number;
  /**
   * Reports whether the key contains any of the given parts.
   *
   * @param parts - Substrings of the kebab-case key.
   * @returns True when one occurs.
   */
  has(...parts: readonly string[]): boolean;
}

/** A variant layer painter. */
export type LayerPainter = (q: LayerPaint) => void;

/**
 * Paints a sugar cube sitting on a saucer or the table: a lit top face over a shaded front.
 *
 * @param ctx - The paint context.
 * @param x - Cube centre x.
 * @param y - Cube top-face centre y.
 * @param size - Cube width.
 */
export function paint_sugar_cube(ctx: PaintContext, x: number, y: number, size = 2.8): void {
  const half = size / 2;
  fill_rounded_rect(
    ctx,
    x - half + 0.6,
    y - half * 0.6 + 1,
    size,
    size,
    0.4,
    css(SHADOW_INK, 0.28),
  );
  fill_rounded_rect(ctx, x - half, y, size, size * 0.6, 0.3, css(shade(0xfbf6ea, 0.2)));
  fill_rounded_rect(ctx, x - half, y - half * 0.7, size, size * 0.7, 0.3, css(tint(0xfbf6ea, 0.5)));
  fill_rounded_rect(
    ctx,
    x - half + 0.3,
    y - half * 0.6,
    size * 0.4,
    size * 0.2,
    0.2,
    css(0xffffff, 0.9),
  );
}
