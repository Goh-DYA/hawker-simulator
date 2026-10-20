/**
 * The drink variant layer: kopi poured into its cup and teh into its glass, coloured by how it
 * is made (black, condensed milk or evaporated milk, which swirls), with the pulled tea's foam
 * head and teh halia's ginger slivers; soy milk poured chilled into its glass with a ring of
 * fine bubbles, a straw and, for one variant, black grass jelly cubes; and the sugar shown as
 * one or two cubes on the saucer or beside the glass.
 */
import {
  css,
  fill_ellipse,
  fill_rounded_rect,
  radial_gradient,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  tint,
  type PaintContext,
} from "../../canvas";
import { paint_dots, paint_foam, paint_gloss, paint_straw, type FoodArea } from "../parts";
import { paint_shreds } from "../toppings";
import { cup_inner, food_area, paint_glass_drink } from "../vessels";
import { paint_sugar_cube, type LayerPaint } from "./layer";

/** Chilled soy milk: creamy, opaque and faintly gold. */
const SOY_MILK = 0xefe3c4;
/** Black grass jelly cubes. */
const GRASS_JELLY = 0x2e2620;
/** Teh halia's sliced ginger. */
const GINGER = 0xe9d9a6;
/** Where a glass's straw tip rests, relative to the dish centre: just above the right rim. */
const STRAW_TIP = { x: 9.5, y: -15.5 } as const;
/** Where the sugar cubes sit beside a glass, relative to the dish centre. */
const GLASS_CUBE_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [9.5, 10.5],
  [12.2, 12.4],
];

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
  if (q.key.startsWith("soy-")) {
    paint_soy_milk(q);
    GLASS_CUBE_SPOTS.slice(0, sugar_count(q)).forEach(([x, y]) => paint_sugar_cube(ctx, x, y));
    return;
  }
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
    if (q.has("ginger")) {
      paint_shreds(ctx, surface.x, surface.y, surface.rx * 0.5, 3, GINGER, q.seed ^ 0x61, 3.4, 1.3);
    }
    cubeSpots = GLASS_CUBE_SPOTS;
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

/**
 * Paints chilled soy milk in its tall glass: the creamy column with a thin ring of fine
 * bubbles round its surface, condensation on the glass and a red straw, plus black grass jelly
 * cubes sunk in the milk for that variant.
 *
 * @param q - The layer paint.
 */
function paint_soy_milk(q: LayerPaint): void {
  const { ctx } = q;
  const surface = paint_glass_drink(ctx, 0, 0, 1, q.remaining, SOY_MILK);
  if (q.has("grass-jelly")) {
    // The cubes sit low in the glass, so they stay under the surface as it drops.
    for (let cube = 0; cube < 4; cube += 1) {
      const x = surface.x - 3 + (cube % 2) * 3.4 + (cube > 1 ? 1 : 0);
      const y = 4.2 + Math.floor(cube / 2) * 3.2;
      fill_rounded_rect(ctx, x - 1.2 + 0.3, y - 1.2 + 0.5, 2.6, 2.6, 0.5, css(SHADOW_INK, 0.2));
      fill_rounded_rect(ctx, x - 1.3, y - 1.3, 2.6, 2.6, 0.5, css(GRASS_JELLY, 0.92));
      fill_rounded_rect(ctx, x - 0.9, y - 0.9, 1, 0.5, 0.2, css(0xffffff, 0.35));
    }
  }
  stroke_ellipse(
    ctx,
    surface.x,
    surface.y,
    surface.rx - 0.8,
    surface.ry - 0.4,
    css(0xfffaf0, 0.95),
    1.1,
  );
  const bubbles = q.isLowDetail ? 6 : 12;
  for (let bubble = 0; bubble < bubbles; bubble += 1) {
    const angle = (bubble / bubbles) * Math.PI * 2 + 0.3;
    fill_ellipse(
      ctx,
      surface.x + Math.cos(angle) * (surface.rx - 1.2),
      surface.y + Math.sin(angle) * (surface.ry - 0.5),
      0.55,
      0.4,
      css(0xffffff, 0.9),
    );
  }
  // Condensation beading on the cold glass.
  ctx.save();
  ctx.globalAlpha = 0.7;
  paint_dots(ctx, surface.x - 2, surface.y + 9, 3.4, q.isLowDetail ? 3 : 6, 0.45, 0xffffff, q.seed);
  ctx.restore();
  const straw_x = surface.x + 1.5;
  paint_straw(
    ctx,
    straw_x,
    surface.y,
    Math.hypot(STRAW_TIP.x - straw_x, STRAW_TIP.y - surface.y),
    Math.atan2(STRAW_TIP.y - surface.y, STRAW_TIP.x - straw_x),
    0xd8423a,
  );
}
