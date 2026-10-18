/**
 * The drink variant layer: kopi poured into its cup and teh into its glass, coloured by how it
 * is made (black, condensed milk or evaporated milk, which swirls), with the pulled tea's foam
 * head, and the sugar shown as one or two cubes on the saucer or beside the glass.
 */
import {
  css,
  fill_ellipse,
  radial_gradient,
  shade,
  stroke_ellipse,
  tint,
  type PaintContext,
} from "../../canvas";
import { paint_foam, paint_gloss, type FoodArea } from "../parts";
import { cup_inner, food_area, paint_glass_drink } from "../vessels";
import { paint_sugar_cube, type LayerPaint } from "./layer";

/**
 * Picks the drink's colour from how it is made.
 *
 * @param q - The layer paint.
 * @param isTeh - True for tea, false for coffee.
 * @returns The drink colour.
 */
function drink_colour(q: LayerPaint, isTeh: boolean): number {
  if (q.has("black-")) return isTeh ? 0x9a4a1a : 0x3a2216;
  if (q.has("evaporated")) return isTeh ? 0xcf9a68 : 0xae8058;
  if (q.has("pulled-foam")) return 0xc98a4c;
  return isTeh ? 0xbf7e46 : 0x93633e;
}

/**
 * Counts the sugar cubes a key asks for.
 *
 * @param q - The layer paint.
 * @returns Zero for kosong, one for less sweet and two otherwise.
 */
function sugar_count(q: LayerPaint): number {
  if (q.has("no-sugar", "kosong")) return 0;
  if (q.has("one-sugar")) return 1;
  return 2;
}

/**
 * Paints the swirl of evaporated milk on a drink's surface.
 *
 * @param ctx - The paint context.
 * @param surface - The drink's surface.
 */
function paint_milk_swirl(ctx: PaintContext, surface: FoodArea): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(
    surface.x - surface.rx * 0.15,
    surface.y,
    surface.rx * 0.5,
    surface.ry * 0.5,
    0,
    0.2,
    Math.PI * 1.6,
  );
  ctx.strokeStyle = css(0xfbf1dc, 0.95);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(
    surface.x + surface.rx * 0.3,
    surface.y + surface.ry * 0.1,
    surface.rx * 0.28,
    surface.ry * 0.3,
    0,
    Math.PI * 0.3,
    Math.PI * 1.8,
  );
  ctx.strokeStyle = css(0xfbf1dc, 0.8);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints a drink's surface in its cup: the liquid with a darker rim, a crema ring for milky
 * drinks and the reflection of the key light.
 *
 * @param ctx - The paint context.
 * @param surface - The surface area.
 * @param colourValue - The drink colour.
 * @param isMilky - True to paint the pale crema ring.
 */
function paint_cup_surface(
  ctx: PaintContext,
  surface: FoodArea,
  colourValue: number,
  isMilky: boolean,
): void {
  fill_ellipse(
    ctx,
    surface.x,
    surface.y,
    surface.rx,
    surface.ry,
    radial_gradient(
      ctx,
      surface.x - surface.rx * 0.2,
      surface.y - surface.ry * 0.2,
      0.3,
      surface.rx,
      [
        [0, tint(colourValue, 0.18)],
        [0.75, colourValue],
        [1, shade(colourValue, 0.35)],
      ],
    ),
  );
  if (isMilky) {
    stroke_ellipse(
      ctx,
      surface.x,
      surface.y,
      surface.rx * 0.82,
      surface.ry * 0.78,
      css(tint(colourValue, 0.45), 0.6),
      0.8,
    );
  }
  paint_gloss(
    ctx,
    surface.x - surface.rx * 0.35,
    surface.y - surface.ry * 0.35,
    surface.rx * 0.28,
    surface.ry * 0.18,
    0.55,
  );
}

/**
 * The kopi or teh layer.
 *
 * @param q - The layer paint.
 */
export function paint_drink_layer(q: LayerPaint): void {
  const { ctx } = q;
  const isTeh = q.key.startsWith("teh-");
  const colourValue = drink_colour(q, isTeh);
  const isMilky = !q.has("black-");
  let cubeSpots: ReadonlyArray<readonly [number, number]>;
  if (isTeh) {
    const surface = paint_glass_drink(ctx, 0, 0, 1, q.remaining, colourValue);
    if (q.has("pulled-foam")) {
      paint_foam_head(ctx, surface, q);
    } else if (isMilky) {
      stroke_ellipse(
        ctx,
        surface.x,
        surface.y,
        surface.rx * 0.8,
        surface.ry * 0.7,
        css(tint(colourValue, 0.5), 0.8),
        0.7,
      );
    }
    if (q.has("evaporated")) paint_milk_swirl(ctx, surface);
    cubeSpots = [
      [9.5, 10.5],
      [12.2, 12.4],
    ];
  } else {
    const surface = food_area("cup", 0, 0, 1, q.remaining);
    const inner = cup_inner(0, 0, 1);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(inner.x, inner.y, inner.rx, inner.ry, 0, 0, Math.PI * 2);
    ctx.clip();
    paint_cup_surface(ctx, surface, colourValue, isMilky);
    if (q.has("evaporated")) paint_milk_swirl(ctx, surface);
    ctx.restore();
    cubeSpots = [
      [-10.5, 9.8],
      [-7.4, 11.6],
    ];
  }
  cubeSpots.slice(0, sugar_count(q)).forEach(([x, y]) => paint_sugar_cube(ctx, x, y));
}

/**
 * Paints the thick foam head of pulled tea: a creamy collar inside the top of the glass and a
 * bubbly dome above the tea.
 *
 * @param ctx - The paint context.
 * @param surface - The tea's surface in the glass.
 * @param q - The layer paint.
 */
function paint_foam_head(ctx: PaintContext, surface: FoodArea, q: LayerPaint): void {
  const collar = 2.6;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(surface.x - surface.rx, surface.y);
  ctx.lineTo(surface.x - surface.rx + 0.2, surface.y + collar);
  ctx.ellipse(surface.x, surface.y + collar, surface.rx - 0.2, surface.ry, 0, Math.PI, 0, true);
  ctx.lineTo(surface.x + surface.rx, surface.y);
  ctx.closePath();
  ctx.fillStyle = css(0xf2dcb4, 0.95);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(surface.x, surface.y - 0.9);
  ctx.scale(1, 0.55);
  paint_foam(ctx, 0, 0, surface.rx + 0.2, q.seed, q.isLowDetail);
  ctx.restore();
}
