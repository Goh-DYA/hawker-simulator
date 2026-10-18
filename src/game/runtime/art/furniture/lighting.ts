/**
 * Lighting painters: the slim ceiling batten, the enamel dining pendant, the woven rattan
 * lantern cluster, the articulated counter task light, the low path bollard, the suspended
 * skylight diffuser and the festoon string lights.
 *
 * Everything is drawn in the 3/4 oblique view from the south, lit from the north-west. The
 * ceiling-hung fittings sit high in their texture with their cords running up out of frame to
 * the ceiling, show the glowing underside of their shade or diffuser, and cast only a faint
 * shadow on the floor well to the south-east; the bollard stands on the floor with a contact
 * shadow, and the task light, which guests walk through and which sorts with them, is tucked
 * against one edge of its footprint. Each painter adds just a modest local glow, because the
 * renderer lays the live light pool on the floor as a separate additive sprite. Linear fittings
 * follow their rotated footprint, and the task light faces the way it is turned. The
 * construction is chosen through the ID-keyed style tables in `render/art.ts`.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style, type LightingStyle } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_rounded_rect,
  glow,
  line,
  linear_gradient,
  mix,
  radial_gradient,
  rounded_rect_path,
  seeded,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  stroke_rounded_rect,
  TAU,
  tint,
  type PaintContext,
} from "../canvas";
import { type PaintFrame } from "../specs";
import {
  arc_path,
  ceiling_cord,
  clip_texture,
  FITTING_STEEL,
  floor_shadow,
  ink_current_path,
  INK,
  LAMP_LIGHT,
  LIT_INTERIOR,
  outline_style,
  paint_bulb,
  resolve_linear_rotation,
  soft_glow,
  standing_height,
  stroke_outline,
} from "./ambience";
import { type Box } from "./shared";

/** The near-white of a lit opal diffuser. */
const DIFFUSER_WHITE = 0xfff4d6;
/** Pale powder-coated white of batten housings. */
const HOUSING_WHITE = 0xdfe5e2;
/** Brass of pendant caps. */
const BRASS = 0xc9a24a;
/** Natural rattan of the woven lanterns. */
const RATTAN = 0xc99558;
/** The warm amber a lantern's weave glows with. */
const LANTERN_GLOW = 0xffb45a;
/** Charcoal powder coat of the path bollard. */
const BOLLARD_CHARCOAL = 0x3f4b4a;
/** Aluminium of the skylight frame. */
const ALUMINIUM = 0xb4bfbd;
/** Cable of the festoon string. */
const CABLE = 0x2f3a37;
/** The festive bulb colours, cycled along the string: amber, vermilion, teal and leaf. */
const BULB_COLOURS = [0xffc857, 0xe8694a, 0x5fb8b0, 0x9ccf6a] as const;
/** Bulbs hung along each swag of the festoon string. */
const BULBS_PER_SWAG = 7;
/** The fraction of a linear footprint's long side a batten spans (a 1.5 m batten in 2 m). */
const BATTEN_SPAN = 0.78;
/** The skylight panel's depth on screen as a fraction of its width (a flat, hung slab). */
const SKYLIGHT_DEPTH_RATIO = 0.45;
/** Opacity of the skylight's frosted glass, low enough that guests show through it. */
const SKYLIGHT_GLASS_ALPHA = 0.34;
/** Pane columns across the skylight panel. */
const SKYLIGHT_COLUMNS = 3;
/** Thickness of the skylight's south edge, the light box's side facing the camera. */
const SKYLIGHT_EDGE = 7;
/** Width of the skylight's slim aluminium frame rail. */
const SKYLIGHT_RAIL = 3;
/** The path bollard's height (0.7 m). */
const BOLLARD_METRES = 0.7;
/** How far in from its edge a north-south task light's clamps stand (its arms stay within 16). */
const TASK_LIGHT_CLAMP_INSET = 11;

type LightingPainter = (
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  rotation: Rotation,
) => void;

/**
 * Paints a blurred rounded bar of shadow on the floor, the shadow a long fitting casts from
 * high above.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height.
 * @param alpha - Darkness of the shadow.
 */
function bar_shadow(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
): void {
  ctx.save();
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = css(SHADOW_INK, alpha);
  fill_rounded_rect(ctx, x, y, width, height, Math.min(width, height) / 2, css(SHADOW_INK, alpha));
  ctx.restore();
}

/**
 * Paints the ceiling batten running east to west: a pale housing seen from above with its opal
 * diffuser glowing along the south side, on two wire hangers.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 */
function paint_tube_across(ctx: PaintContext, box: Box, frame: PaintFrame): void {
  const length = Math.round(box.width * BATTEN_SPAN);
  const x0 = box.centreX - length / 2;
  const top_y = box.y - 2;
  bar_shadow(ctx, x0 + 9, box.bottom - 18, length, 5, 0.12);
  if (!frame.isLowDetail) {
    soft_glow(ctx, box.centreX, top_y + 9, length * 0.62, 14, LAMP_LIGHT, 0.32);
  }
  for (const hanger_x of [x0 + 9, x0 + length - 9]) ceiling_cord(ctx, box, hanger_x, top_y + 1, 1);
  // The diffuser: a long opal lens wrapping under the housing, brightest at its core.
  fill_rounded_rect(
    ctx,
    x0 + 1,
    top_y + 3,
    length - 2,
    8,
    4,
    linear_gradient(ctx, 0, top_y + 3, 0, top_y + 11, [
      [0, DIFFUSER_WHITE],
      [0.5, 0xffffff],
      [1, 0xf3d58f],
    ]),
  );
  fill_rounded_rect(ctx, x0 + 6, top_y + 6, length - 12, 2, 1, css(0xffffff, 0.9));
  // The housing's top face, lit from the north-west.
  fill_rounded_rect(
    ctx,
    x0,
    top_y,
    length,
    5,
    2.5,
    linear_gradient(ctx, x0, top_y, x0 + length, top_y + 5, [
      [0, tint(HOUSING_WHITE, 0.4)],
      [1, shade(HOUSING_WHITE, 0.18)],
    ]),
  );
  line(ctx, x0 + 4, top_y + 1.2, x0 + length - 6, top_y + 1.2, css(0xffffff, 0.6), 0.8);
  for (const cap_x of [x0, x0 + length - 4]) {
    fill_rounded_rect(ctx, cap_x, top_y, 4, 11, 2, css(shade(HOUSING_WHITE, 0.3)));
  }
  const edge = outline_style(HOUSING_WHITE, frame);
  stroke_rounded_rect(ctx, x0, top_y, length, 11, 3, edge.colour, edge.width);
}

/**
 * Paints the ceiling batten running north to south: the housing's spine seen from above, the
 * diffuser glowing out on both sides, and its south end cap facing the camera.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 */
function paint_tube_along(ctx: PaintContext, box: Box, frame: PaintFrame): void {
  const length = Math.round(box.height * BATTEN_SPAN);
  const cx = box.centreX;
  const y0 = box.y - 6;
  bar_shadow(ctx, cx + 7, y0 + 22, 6, Math.min(length, box.bottom - y0 - 26), 0.1);
  if (!frame.isLowDetail) soft_glow(ctx, cx, y0 + length / 2, 14, length * 0.6, LAMP_LIGHT, 0.3);
  ceiling_cord(ctx, box, cx, y0 + 4, 1);
  fill_rounded_rect(
    ctx,
    cx - 5,
    y0,
    10,
    length,
    4,
    linear_gradient(ctx, cx - 5, 0, cx + 5, 0, [
      [0, 0xffffff],
      [0.5, DIFFUSER_WHITE],
      [1, 0xf3d58f],
    ]),
  );
  fill_rounded_rect(
    ctx,
    cx - 3,
    y0,
    6,
    length - 5,
    2.5,
    linear_gradient(ctx, cx - 3, 0, cx + 3, 0, [
      [0, tint(HOUSING_WHITE, 0.4)],
      [1, shade(HOUSING_WHITE, 0.2)],
    ]),
  );
  line(ctx, cx - 1.6, y0 + 3, cx - 1.6, y0 + length - 8, css(0xffffff, 0.6), 0.8);
  fill_rounded_rect(ctx, cx - 5, y0 + length - 6, 10, 6, 2, css(shade(HOUSING_WHITE, 0.32)));
  fill_rounded_rect(ctx, cx - 3.5, y0 + length - 3, 7, 2, 1, css(0xffffff, 0.7));
  const edge = outline_style(HOUSING_WHITE, frame);
  stroke_rounded_rect(ctx, cx - 5, y0, 10, length, 4, edge.colour, edge.width);
  // The south hanger: its wire rises from the south end cap, in front of the batten, up past
  // its north end to the ceiling.
  ctx.save();
  ctx.globalAlpha = 0.7;
  ceiling_cord(ctx, box, cx + 2.5, y0 + length - 5, 1);
  ctx.restore();
  fill_circle(ctx, cx + 2.5, y0 + length - 5, 1.2, css(FITTING_STEEL));
}

/**
 * Paints the ceiling tube light: a slim batten on wire hangers, along its footprint's long side.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param _recipe - Unused; the batten is the same everywhere.
 * @param rotation - The placement rotation.
 */
function paint_tube(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  _recipe: PlaceableVisualRecipe,
  rotation: Rotation,
): void {
  const resolved = resolve_linear_rotation(box, rotation);
  if (resolved === 90 || resolved === 270) {
    paint_tube_along(ctx, box, frame);
  } else {
    paint_tube_across(ctx, box, frame);
  }
}

/**
 * Traces the outer surface of a pendant shade: a dome from a narrow cap flaring out to the rim,
 * closed along the far half of the rim.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param top_y - The cap's y.
 * @param rim_y - The rim's centre y.
 * @param rx - The rim's horizontal radius.
 * @param ry - The rim's vertical radius.
 */
function shade_path(
  ctx: PaintContext,
  cx: number,
  top_y: number,
  rim_y: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, top_y);
  ctx.bezierCurveTo(cx - rx * 0.45, top_y + 1, cx - rx * 0.92, rim_y - ry * 2.4, cx - rx, rim_y);
  ctx.ellipse(cx, rim_y, rx, ry, 0, Math.PI, TAU);
  ctx.bezierCurveTo(cx + rx * 0.92, rim_y - ry * 2.4, cx + rx * 0.45, top_y + 1, cx + 3.5, top_y);
  ctx.closePath();
}

/**
 * Paints the pendant dining light: an enamel dome on a cord, seen from the south a little
 * below its rim, so its glowing opening shows under the shade; its shadow lies on the floor far
 * to the south-east.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent is the enamel colour.
 */
function paint_pendant(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const enamel = recipe.accent;
  const cx = box.centreX;
  const rx = Math.min(box.width, box.height) * 0.28;
  const ry = rx * 0.32;
  const top_y = box.y - 5;
  const rim_y = box.y + 12;
  floor_shadow(ctx, cx + 7, box.bottom - 12, rx * 0.85, rx * 0.32, 0.12);
  if (!frame.isLowDetail) soft_glow(ctx, cx, rim_y + 4, rx * 2, rx * 1.15, LAMP_LIGHT, 0.45);
  ceiling_cord(ctx, box, cx, top_y, 1.3);
  shade_path(ctx, cx, top_y, rim_y, rx, ry);
  ctx.fillStyle = linear_gradient(ctx, cx - rx, top_y, cx + rx, rim_y, [
    [0, tint(enamel, 0.42)],
    [0.45, enamel],
    [1, shade(enamel, 0.4)],
  ]);
  ctx.fill();
  stroke_outline(ctx, enamel, frame);
  // The specular streak down the lit shoulder.
  ctx.beginPath();
  ctx.moveTo(cx - 4, top_y + 2.5);
  ctx.quadraticCurveTo(cx - rx * 0.62, top_y + 5, cx - rx * 0.78, rim_y - 2);
  ctx.strokeStyle = css(0xffffff, 0.5);
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.stroke();
  // The glowing opening, its bulb and the rolled rim.
  fill_ellipse(
    ctx,
    cx,
    rim_y,
    rx - 0.5,
    ry + 1.2,
    radial_gradient(ctx, cx, rim_y, 0, rx, [
      [0, 0xffffff],
      [0.45, LIT_INTERIOR],
      [1, 0xf4c46a],
    ]),
  );
  paint_bulb(ctx, cx, rim_y - 0.5, 2.6, LAMP_LIGHT);
  stroke_ellipse(ctx, cx, rim_y, rx - 0.5, ry + 1.2, css(tint(enamel, 0.2)), 1.2);
  fill_rounded_rect(ctx, cx - 3.5, top_y - 2, 7, 3.5, 1.5, css(BRASS));
  fill_rounded_rect(ctx, cx - 2.5, top_y - 1.5, 2.5, 1.2, 0.6, css(0xffffff, 0.5));
  if (frame.isHighContrast) stroke_ellipse(ctx, cx, rim_y, rx, ry + 1.2, css(INK), 1.5);
}

/** One lantern of the cluster: its centre and radii in world pixels. */
interface Lantern {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

/**
 * Paints the weave of a lantern: meridian ribs and horizontal hoops, the hoops curving down
 * because the camera looks at them from a little above.
 *
 * @param ctx - The paint context.
 * @param lantern - The lantern's geometry.
 * @param rattan - The rattan tone.
 * @param frame - The paint frame.
 */
function paint_weave(ctx: PaintContext, lantern: Lantern, rattan: number, frame: PaintFrame): void {
  const { x, y, rx, ry } = lantern;
  const strand = css(shade(rattan, 0.5), 0.55);
  ctx.save();
  arc_path(ctx, x, y, rx, ry);
  ctx.clip();
  const ribs = frame.isLowDetail ? 2 : 4;
  for (let rib = 1; rib <= ribs; rib += 1) {
    stroke_ellipse(ctx, x, y, (rib / (ribs + 0.6)) * rx, ry, strand, 0.8);
  }
  const hoops = frame.isLowDetail ? 2 : 4;
  for (let hoop = 1; hoop <= hoops; hoop += 1) {
    const hoop_y = y - ry + (hoop / (hoops + 1)) * ry * 2;
    const half = rx * Math.sqrt(Math.max(0, 1 - ((hoop_y - y) / ry) ** 2));
    arc_path(ctx, x, hoop_y, half, 2.2, 0, Math.PI);
    ctx.strokeStyle = strand;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  fill_ellipse(ctx, x - rx * 0.4, y - ry * 0.35, rx * 0.22, ry * 0.32, css(0xffffff, 0.24));
  ctx.restore();
}

/**
 * Paints one woven lantern lit from within: a warm core seen through a rattan weave, with caps
 * top and bottom and a short tassel.
 *
 * @param ctx - The paint context.
 * @param lantern - The lantern's geometry.
 * @param rattan - The rattan tone of this lantern.
 * @param tassel - The tassel colour.
 * @param frame - The paint frame.
 */
function paint_lantern(
  ctx: PaintContext,
  lantern: Lantern,
  rattan: number,
  tassel: number,
  frame: PaintFrame,
): void {
  const { x, y, rx, ry } = lantern;
  if (!frame.isLowDetail) glow(ctx, x, y, rx * 2.2, LANTERN_GLOW, 0.38);
  fill_ellipse(
    ctx,
    x,
    y,
    rx,
    ry,
    radial_gradient(ctx, x - rx * 0.15, y + ry * 0.1, 0, rx * 1.2, [
      [0, 0xffe7a6],
      [0.5, mix(rattan, 0xffd27a, 0.5)],
      [1, shade(rattan, 0.3)],
    ]),
  );
  paint_weave(ctx, lantern, rattan, frame);
  for (let strand = -1; strand <= 1; strand += 1) {
    line(ctx, x + strand * 1.2, y + ry + 1, x + strand * 1.6, y + ry + 6, css(tassel), 1, "round");
  }
  fill_rounded_rect(ctx, x - rx * 0.38, y - ry - 1.5, rx * 0.76, 3.5, 1.6, css(shade(rattan, 0.5)));
  fill_rounded_rect(ctx, x - rx * 0.3, y + ry - 2, rx * 0.6, 3.5, 1.6, css(shade(rattan, 0.55)));
  const edge = outline_style(rattan, frame);
  stroke_ellipse(ctx, x, y, rx, ry, edge.colour, edge.width);
}

/**
 * Paints the woven lantern cluster: three rattan lanterns hung at different heights on their
 * own cords, with their faint shadows scattered on the floor below.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose seed varies the rattan tones and whose accent is the tassels.
 */
function paint_lantern_cluster(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const next = seeded(recipe.seed);
  const unit = Math.min(box.width, box.height) / 96;
  const lanterns: readonly Lantern[] = [
    { x: box.centreX + 20 * unit, y: box.y + 2 * unit, rx: 10 * unit, ry: 12.5 * unit },
    { x: box.centreX - 22 * unit, y: box.y + 16 * unit, rx: 11 * unit, ry: 14 * unit },
    { x: box.centreX + 2 * unit, y: box.y + 38 * unit, rx: 12 * unit, ry: 15 * unit },
  ];
  for (const lantern of lanterns) {
    floor_shadow(
      ctx,
      lantern.x + 10 * unit,
      Math.min(box.bottom - 8, lantern.y + 52 * unit),
      lantern.rx * 0.9,
      lantern.rx * 0.36,
      0.1,
    );
  }
  for (const lantern of lanterns) {
    ceiling_cord(ctx, box, lantern.x, lantern.y - lantern.ry, 1.1);
    paint_lantern(ctx, lantern, shade(RATTAN, next() * 0.16), recipe.accent, frame);
  }
}

/** Where the parts of the task light sit for one facing. */
export interface TaskLightLayout {
  /** The two clamp bases on the floor. */
  readonly bases: readonly (readonly [number, number])[];
  /** The elbow joint above each base. */
  readonly elbows: readonly (readonly [number, number])[];
  /** Where each arm meets the bar. */
  readonly heads: readonly (readonly [number, number])[];
  /** The bar's bounding rectangle on screen. */
  readonly bar: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** Centre and radii of the warm pool the bar throws. */
  readonly pool: {
    readonly x: number;
    readonly y: number;
    readonly rx: number;
    readonly ry: number;
  };
}

/**
 * Lays out the task light for a facing. Guests walk through its tiles and it sorts with them,
 * so it is tucked against one edge, clear of the tile centres where they cross: along the north
 * edge when it runs east to west (the bar reaching south over its clamps, or north behind them),
 * and along the west or east edge, whichever it lights, when it runs north to south.
 *
 * @param box - The footprint box.
 * @param rotation - The resolved rotation (0 lights the south, 90 the west, 180 the north,
 *   270 the east).
 * @returns The layout.
 */
export function task_light_layout(box: Box, rotation: Rotation): TaskLightLayout {
  if (rotation === 0 || rotation === 180) {
    const lights_south = rotation === 0;
    const half = Math.min(34, box.width * 0.36);
    const base_y = box.y + 8;
    const bar_y = lights_south ? box.y : box.y - 9;
    const xs = [box.centreX - half * 0.76, box.centreX + half * 0.76];
    return {
      bases: xs.map((x) => [x, base_y] as const),
      elbows: xs.map((x) => [x + (lights_south ? -3 : 3), base_y - 19] as const),
      heads: xs.map((x) => [x, bar_y + 3] as const),
      bar: { x: box.centreX - half, y: bar_y, width: half * 2, height: lights_south ? 8 : 6 },
      pool: {
        x: box.centreX,
        y: lights_south ? box.y + 15 : box.y + 1,
        rx: half * 1.15,
        ry: 7,
      },
    };
  }
  const lights_west = rotation === 90;
  const inward = lights_west ? 1 : -1;
  const edge_x = lights_west ? box.x : box.right;
  const half = Math.min(34, box.height * 0.36);
  const base_x = edge_x + inward * TASK_LIGHT_CLAMP_INSET;
  const bar_x = lights_west ? box.x + 1 : box.right - 9;
  const ys = [box.centreY - half * 0.76, box.centreY + half * 0.76];
  return {
    bases: ys.map((y) => [base_x, y] as const),
    elbows: ys.map((y) => [base_x + inward * 1.5, y - 20] as const),
    heads: ys.map((y) => [bar_x + 4, y - 12] as const),
    bar: { x: bar_x, y: box.centreY - 12 - half, width: 8, height: half * 2 },
    pool: {
      x: edge_x + inward * 5,
      y: box.centreY - 8,
      rx: 7,
      ry: half * 1.1,
    },
  };
}

/**
 * Paints one sprung arm segment: a dark steel bar with a highlight and its tension spring.
 *
 * @param ctx - The paint context.
 * @param from - Start point.
 * @param to - End point.
 */
function paint_arm(
  ctx: PaintContext,
  from: readonly [number, number],
  to: readonly [number, number],
): void {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const length = Math.hypot(x1 - x0, y1 - y0) || 1;
  const normal_x = -(y1 - y0) / length;
  const normal_y = (x1 - x0) / length;
  line(ctx, x0, y0, x1, y1, css(shade(FITTING_STEEL, 0.15)), 2.8);
  line(ctx, x0 - 0.6, y0 - 0.4, x1 - 0.6, y1 - 0.4, css(0xffffff, 0.3), 0.8);
  line(
    ctx,
    x0 + normal_x * 2.2,
    y0 + normal_y * 2.2,
    x1 + normal_x * 2.2,
    y1 + normal_y * 2.2,
    css(tint(FITTING_STEEL, 0.4), 0.8),
    0.8,
  );
}

/**
 * Paints a clamp base standing on the floor: a small steel block with a lit top and a shaded
 * front face.
 *
 * @param ctx - The paint context.
 * @param x - Centre x.
 * @param y - Centre y of its top face.
 */
function paint_clamp(ctx: PaintContext, x: number, y: number): void {
  floor_shadow(ctx, x + 2, y + 4, 7, 2.6, 0.24);
  fill_rounded_rect(ctx, x - 5, y + 1, 10, 4, 1.5, css(shade(FITTING_STEEL, 0.4)));
  fill_rounded_rect(
    ctx,
    x - 5,
    y - 2.5,
    10,
    5,
    1.8,
    linear_gradient(ctx, x - 5, y - 2.5, x + 5, y + 2.5, [
      [0, tint(FITTING_STEEL, 0.35)],
      [1, shade(FITTING_STEEL, 0.15)],
    ]),
  );
  fill_circle(ctx, x + 2.5, y, 1.2, css(shade(FITTING_STEEL, 0.5)));
}

/**
 * Paints the task light's bar for its facing: the enamel housing's top face, plus the glowing
 * louvred diffuser on the side facing the camera when it lights the south, west or east.
 *
 * @param ctx - The paint context.
 * @param layout - The task light layout.
 * @param rotation - The resolved rotation.
 * @param enamel - The housing colour.
 * @param frame - The paint frame.
 */
function paint_task_bar(
  ctx: PaintContext,
  layout: TaskLightLayout,
  rotation: Rotation,
  enamel: number,
  frame: PaintFrame,
): void {
  const { x, y, width, height } = layout.bar;
  const housing = linear_gradient(ctx, x, y, x + width, y + height, [
    [0, tint(enamel, 0.32)],
    [1, shade(enamel, 0.3)],
  ]);
  const lit = linear_gradient(ctx, x, y, x + width, y + height, [
    [0, 0xffffff],
    [1, LIT_INTERIOR],
  ]);
  if (rotation === 0) {
    fill_rounded_rect(ctx, x, y + 2.5, width, height - 2.5, 2, lit);
    fill_rounded_rect(ctx, x, y, width, 3, 1.5, housing);
  } else if (rotation === 180) {
    fill_rounded_rect(ctx, x, y + 2.5, width, height - 2.5, 2, css(shade(enamel, 0.42)));
    fill_rounded_rect(ctx, x, y, width, 3, 1.5, housing);
  } else {
    const lit_x = rotation === 90 ? x : x + width / 2;
    const housing_x = rotation === 90 ? x + width / 2 - 0.5 : x;
    fill_rounded_rect(ctx, lit_x, y, width / 2 + 0.5, height, 2, lit);
    fill_rounded_rect(ctx, housing_x, y, width / 2 + 0.5, height - 2, 1.5, housing);
    fill_rounded_rect(ctx, x, y + height - 3, width, 3, 1, css(shade(enamel, 0.35)));
  }
  if (!frame.isLowDetail && rotation !== 180) {
    const is_across = rotation === 0;
    const louvres = 6;
    for (let louvre = 1; louvre < louvres; louvre += 1) {
      const along = louvre / louvres;
      if (is_across) {
        const louvre_x = x + width * along;
        line(ctx, louvre_x, y + 3, louvre_x, y + height, css(shade(enamel, 0.2), 0.45), 0.7);
      } else {
        const louvre_y = y + height * along;
        const lit_x = rotation === 90 ? x : x + width / 2;
        line(ctx, lit_x, louvre_y, lit_x + width / 2, louvre_y, css(shade(enamel, 0.2), 0.45), 0.7);
      }
    }
  }
  const edge = outline_style(enamel, frame);
  stroke_rounded_rect(ctx, x, y, width, height, 2, edge.colour, edge.width);
}

/**
 * Paints the counter task light: two clamp bases, sprung arms rising and reaching over, and a
 * slim glare-controlled bar throwing a warm pool on the side it faces, all tucked against one
 * edge of the footprint (see `task_light_layout`).
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent is the enamel colour.
 * @param rotation - The placement rotation.
 */
function paint_task_light(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  rotation: Rotation,
): void {
  const resolved = resolve_linear_rotation(box, rotation);
  const layout = task_light_layout(box, resolved);
  const { pool, bar } = layout;
  if (!frame.isLowDetail) soft_glow(ctx, pool.x, pool.y, pool.rx, pool.ry, LAMP_LIGHT, 0.6);
  // The bar's faint shadow falls on the floor just south-east of it, on the same edge.
  if (resolved === 0 || resolved === 180) {
    bar_shadow(ctx, bar.x + 4, bar.y + bar.height + 8, bar.width, 3, 0.08);
  } else {
    bar_shadow(ctx, bar.x + 5, bar.y + 14, 3, bar.height - 4, 0.08);
  }
  const paint_supports = () => {
    layout.bases.forEach((base, index) => {
      const elbow = layout.elbows[index] ?? base;
      const head = layout.heads[index] ?? elbow;
      paint_clamp(ctx, base[0], base[1]);
      paint_arm(ctx, base, elbow);
      paint_arm(ctx, elbow, head);
      fill_circle(ctx, elbow[0], elbow[1], 2.2, css(shade(FITTING_STEEL, 0.3)));
      fill_circle(ctx, elbow[0] - 0.6, elbow[1] - 0.6, 0.8, css(0xffffff, 0.45));
    });
  };
  // The bar is behind its arms when it lights the north, in front of them otherwise.
  if (resolved === 180) {
    paint_task_bar(ctx, layout, resolved, recipe.accent, frame);
    paint_supports();
  } else {
    paint_supports();
    paint_task_bar(ctx, layout, resolved, recipe.accent, frame);
  }
}

/**
 * Paints the low path light: a squat charcoal bollard with a domed cap, an accent trim ring and
 * a louvred window on its south face spilling light onto the floor in front of it.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent is the trim ring.
 */
function paint_path_light(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const cx = box.centreX;
  const base_y = box.y + box.height * 0.75;
  const top_y = base_y - standing_height(BOLLARD_METRES);
  const half = 6;
  const body = BOLLARD_CHARCOAL;
  if (!frame.isLowDetail) soft_glow(ctx, cx, base_y + 5, 17, 6.5, LAMP_LIGHT, 0.55);
  floor_shadow(ctx, cx + 3, base_y + 1.5, half + 3, 3, 0.26);
  fill_ellipse(ctx, cx, base_y, half + 2, 2.8, css(shade(body, 0.35)));
  const side = linear_gradient(ctx, cx - half, 0, cx + half, 0, [
    [0, tint(body, 0.3)],
    [0.4, body],
    [1, shade(body, 0.45)],
  ]);
  fill_rounded_rect(ctx, cx - half, top_y + 1, half * 2, base_y - top_y - 1, 0, side);
  fill_ellipse(ctx, cx, base_y, half, 2.2, side);
  fill_rounded_rect(ctx, cx - half, base_y - 4.5, half * 2, 1.6, 0.8, css(recipe.accent));
  // The louvred window, glowing.
  const window_y = top_y + 3;
  fill_rounded_rect(
    ctx,
    cx - half + 1.5,
    window_y,
    half * 2 - 3,
    5.5,
    1.5,
    linear_gradient(ctx, 0, window_y, 0, window_y + 5.5, [
      [0, 0xffffff],
      [1, 0xffc766],
    ]),
  );
  const louvre_y = window_y + 2.7;
  line(ctx, cx - half + 1.5, louvre_y, cx + half - 1.5, louvre_y, css(shade(body, 0.1)), 1, "butt");
  if (!frame.isLowDetail) soft_glow(ctx, cx, window_y + 3, 9, 5, LAMP_LIGHT, 0.4);
  // The domed cap seen from above, with its front lip.
  fill_rounded_rect(ctx, cx - half - 1.5, top_y - 0.5, half * 2 + 3, 3, 1.2, css(shade(body, 0.2)));
  fill_ellipse(
    ctx,
    cx,
    top_y - 0.5,
    half + 1.5,
    3,
    radial_gradient(ctx, cx - 3, top_y - 2, 0, half * 1.8, [
      [0, tint(body, 0.45)],
      [0.6, body],
      [1, shade(body, 0.3)],
    ]),
  );
  fill_ellipse(ctx, cx - 2.5, top_y - 1.2, 2.2, 0.9, css(0xffffff, 0.35));
  const edge = outline_style(body, frame);
  ctx.beginPath();
  ctx.moveTo(cx - half, top_y + 2);
  ctx.lineTo(cx - half, base_y);
  ctx.ellipse(cx, base_y, half, 2.2, 0, Math.PI, 0, true);
  ctx.lineTo(cx + half, top_y + 2);
  ctx.strokeStyle = edge.colour;
  ctx.lineWidth = edge.width;
  ctx.stroke();
  stroke_ellipse(ctx, cx, top_y - 0.5, half + 1.5, 3, edge.colour, edge.width);
}

/**
 * Paints the frosted glass of the skylight panel: an even, translucent frosted glow (guests
 * walking under the panel show through it), brightest at its centre, with one soft sheen.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the glass.
 * @param y - Top edge of the glass.
 * @param width - Width of the glass.
 * @param height - Height of the glass.
 * @param frame - The paint frame.
 */
function paint_skylight_glass(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  frame: PaintFrame,
): void {
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    2,
    linear_gradient(ctx, x, y, x + width, y + height, [
      [0, 0xffffff, SKYLIGHT_GLASS_ALPHA + 0.06],
      [0.5, 0xeef8fa, SKYLIGHT_GLASS_ALPHA],
      [1, 0xd6ecf0, SKYLIGHT_GLASS_ALPHA - 0.04],
    ]),
  );
  if (frame.isLowDetail) return;
  ctx.save();
  rounded_rect_path(ctx, x, y, width, height, 2);
  ctx.clip();
  soft_glow(ctx, x + width / 2, y + height / 2, width * 0.55, height * 0.7, 0xffffff, 0.2);
  line(ctx, x + width * 0.08, y + 2.5, x + width * 0.46, y + 2.5, css(0xffffff, 0.45), 1.2);
  ctx.restore();
}

/**
 * Paints faint shafts of daylight falling from the skylight panel's south edge to the floor,
 * one per pane column, slanting to the south-east away from the key light.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param x - Left edge of the panel.
 * @param top_y - The panel's bottom edge, where the shafts start.
 * @param width - Width of the panel.
 */
function paint_daylight_shafts(
  ctx: PaintContext,
  box: Box,
  x: number,
  top_y: number,
  width: number,
): void {
  const bottom_y = box.bottom - 10;
  const slant = 12;
  const column = (width - 12) / SKYLIGHT_COLUMNS;
  for (let shaft = 0; shaft < SKYLIGHT_COLUMNS; shaft += 1) {
    const left = x + 6 + shaft * column + 4;
    const right = left + column - 8;
    ctx.beginPath();
    ctx.moveTo(left, top_y);
    ctx.lineTo(right, top_y);
    ctx.lineTo(right + slant, bottom_y);
    ctx.lineTo(left + slant, bottom_y);
    ctx.closePath();
    ctx.fillStyle = linear_gradient(ctx, 0, top_y, 0, bottom_y, [
      [0, 0xf4fbff, 0.13],
      [1, 0xf4fbff, 0],
    ]);
    ctx.fill();
  }
}

/**
 * Paints the skylight panel's south edge: the thickness of the light box facing the camera, an
 * aluminium lip over a strip of frosted acrylic glowing with the daylight inside.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the panel.
 * @param y - The panel's south edge, where the band starts.
 * @param width - Width of the panel.
 */
function paint_skylight_edge(ctx: PaintContext, x: number, y: number, width: number): void {
  fill_rounded_rect(
    ctx,
    x,
    y - 1,
    width,
    SKYLIGHT_EDGE + 1,
    2,
    linear_gradient(ctx, 0, y, 0, y + SKYLIGHT_EDGE, [
      [0, tint(ALUMINIUM, 0.3)],
      [1, shade(ALUMINIUM, 0.3)],
    ]),
  );
  fill_rounded_rect(
    ctx,
    x + 3,
    y + 2,
    width - 6,
    SKYLIGHT_EDGE - 4,
    1.5,
    linear_gradient(ctx, x, 0, x + width, 0, [
      [0, 0xffffff],
      [0.5, 0xf2fbff],
      [1, 0xd8ecf0],
    ]),
  );
  line(ctx, x + 2, y + 0.2, x + width - 2, y + 0.2, css(0xffffff, 0.6), 0.8, "butt");
}

/**
 * Paints the skylight diffuser: a broad, shallow frosted light box hung flat from the ceiling
 * high in its texture, seen from above as a translucent slab in a slim aluminium frame (so
 * guests walking under it stay visible), with its glowing south edge facing the camera and a
 * few faint shafts of daylight below it.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 */
function paint_skylight(ctx: PaintContext, box: Box, frame: PaintFrame): void {
  const inset = Math.round(box.width * 0.085);
  const x = box.x + inset;
  const width = box.width - inset * 2;
  const depth = Math.round(width * SKYLIGHT_DEPTH_RATIO);
  const y = box.y - 10;
  if (!frame.isLowDetail) {
    soft_glow(ctx, box.centreX, y + depth / 2, width * 0.6, depth * 0.8, 0xe6f6ff, 0.2);
    paint_daylight_shafts(ctx, box, x, y + depth + SKYLIGHT_EDGE, width);
  }
  for (const wire_x of [x + 6, x + width - 6]) ceiling_cord(ctx, box, wire_x, y + 2, 1);
  const rail = SKYLIGHT_RAIL;
  paint_skylight_glass(ctx, x + rail, y + rail, width - rail * 2, depth - rail * 2, frame);
  // The slim frame: a lit rail on the north and west, a shaded one on the south and east. The
  // opening is traced the other way round, so the non-zero fill leaves the glass uncovered.
  const inner_right = x + width - rail;
  const inner_bottom = y + depth - rail;
  ctx.beginPath();
  ctx.rect(x, y, width, depth);
  ctx.moveTo(x + rail, y + rail);
  ctx.lineTo(x + rail, inner_bottom);
  ctx.lineTo(inner_right, inner_bottom);
  ctx.lineTo(inner_right, y + rail);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, x, y, x + width, y + depth, [
    [0, tint(ALUMINIUM, 0.45)],
    [0.5, ALUMINIUM],
    [1, shade(ALUMINIUM, 0.25)],
  ]);
  ctx.fill();
  for (let division = 1; division < SKYLIGHT_COLUMNS; division += 1) {
    const mullion_x = x + (width * division) / SKYLIGHT_COLUMNS;
    line(ctx, mullion_x, y + rail, mullion_x, y + depth - rail, css(ALUMINIUM, 0.85), 1.4, "butt");
  }
  line(ctx, x + rail, y + depth / 2, x + width - rail, y + depth / 2, css(ALUMINIUM, 0.85), 1.2);
  paint_skylight_edge(ctx, x, y + depth, width);
  const edge = outline_style(ALUMINIUM, frame);
  stroke_rounded_rect(ctx, x, y, width, depth + SKYLIGHT_EDGE, 2, edge.colour, edge.width);
}

/**
 * Paints one festoon bulb hanging under its cable on a short drop.
 *
 * @param ctx - The paint context.
 * @param x - The drop's x on the cable.
 * @param y - The drop's y on the cable.
 * @param colour - The bulb colour.
 * @param frame - The paint frame.
 */
function paint_festoon_bulb(
  ctx: PaintContext,
  x: number,
  y: number,
  colour: number,
  frame: PaintFrame,
): void {
  const bulb_y = y + 6.5;
  fill_rounded_rect(ctx, x - 1.4, y, 2.8, 3.4, 0.8, css(CABLE));
  if (!frame.isLowDetail) glow(ctx, x, bulb_y, 8.5, colour, 0.48);
  fill_ellipse(
    ctx,
    x,
    bulb_y,
    3.1,
    3.7,
    radial_gradient(ctx, x - 1, bulb_y - 1.2, 0, 5, [
      [0, tint(colour, 0.75)],
      [0.55, colour],
      [1, shade(colour, 0.28)],
    ]),
  );
  fill_circle(ctx, x - 1, bulb_y - 1.4, 0.9, css(0xffffff, 0.8));
  if (frame.isHighContrast) stroke_ellipse(ctx, x, bulb_y, 3.1, 3.7, css(INK), 1);
}

/** A swag of the festoon cable: a quadratic curve between two hooks. */
interface Swag {
  readonly from: readonly [number, number];
  readonly control: readonly [number, number];
  readonly to: readonly [number, number];
}

/**
 * Evaluates a point along a swag.
 *
 * @param swag - The swag.
 * @param t - Position along it, 0 to 1.
 * @returns The point.
 */
function swag_point(swag: Swag, t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * swag.from[0] + 2 * u * t * swag.control[0] + t * t * swag.to[0],
    y: u * u * swag.from[1] + 2 * u * t * swag.control[1] + t * t * swag.to[1],
  };
}

/**
 * Strokes a swag of cable.
 *
 * @param ctx - The paint context.
 * @param swag - The swag.
 * @param style - The stroke style.
 * @param width - The stroke width.
 * @param offset_x - Shift along x (for a shadow).
 * @param offset_y - Shift along y.
 */
function stroke_swag(
  ctx: PaintContext,
  swag: Swag,
  style: string,
  width: number,
  offset_x = 0,
  offset_y = 0,
): void {
  ctx.beginPath();
  ctx.moveTo(swag.from[0] + offset_x, swag.from[1] + offset_y);
  ctx.quadraticCurveTo(
    swag.control[0] + offset_x,
    swag.control[1] + offset_y,
    swag.to[0] + offset_x,
    swag.to[1] + offset_y,
  );
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Lays out the festoon's two swags along its footprint's long side.
 *
 * @param box - The footprint box.
 * @param is_along - True when the string runs north to south.
 * @returns The swags, north or west first.
 */
function festoon_swags(box: Box, is_along: boolean): readonly Swag[] {
  if (!is_along) {
    const hook_y = box.y - 4;
    const sag_y = box.y + 22;
    const xs = [box.x + 6, box.centreX, box.right - 6] as const;
    return [
      { from: [xs[0], hook_y], control: [(xs[0] + xs[1]) / 2, sag_y], to: [xs[1], hook_y] },
      { from: [xs[1], hook_y], control: [(xs[1] + xs[2]) / 2, sag_y], to: [xs[2], hook_y] },
    ];
  }
  const ys = [box.y - 10, box.centreY - 14, box.bottom - 20] as const;
  return [
    {
      from: [box.centreX, ys[0]],
      control: [box.centreX + 9, (ys[0] + ys[1]) / 2],
      to: [box.centreX, ys[1]],
    },
    {
      from: [box.centreX, ys[1]],
      control: [box.centreX - 9, (ys[1] + ys[2]) / 2],
      to: [box.centreX, ys[2]],
    },
  ];
}

/**
 * Paints the festive string lights: two swags of cable between ceiling hooks, with warm
 * festoon bulbs in alternating colours hanging from them and a faint shadow of the line on the
 * floor below.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe; unused beyond the style.
 * @param rotation - The placement rotation.
 */
function paint_string_lights(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  _recipe: PlaceableVisualRecipe,
  rotation: Rotation,
): void {
  const resolved = resolve_linear_rotation(box, rotation);
  const is_along = resolved === 90 || resolved === 270;
  const swags = festoon_swags(box, is_along);
  const shadow_y = is_along ? 20 : 26;
  ctx.save();
  ctx.shadowBlur = 4;
  ctx.shadowColor = css(SHADOW_INK, 0.12);
  for (const swag of swags) stroke_swag(ctx, swag, css(SHADOW_INK, 0.1), 2.5, 8, shadow_y);
  ctx.restore();
  const first = swags[0];
  if (first) ceiling_cord(ctx, box, first.from[0], first.from[1], 1);
  if (!is_along) {
    for (const swag of swags) ceiling_cord(ctx, box, swag.to[0], swag.to[1], 1);
  }
  for (const swag of swags) {
    stroke_swag(ctx, swag, css(CABLE), 1.6);
    stroke_swag(ctx, swag, css(0xffffff, 0.18), 0.6, -0.4, -0.5);
  }
  for (const swag of swags) {
    for (const end of [swag.from, swag.to]) {
      fill_circle(ctx, end[0], end[1], 1.8, css(FITTING_STEEL));
    }
  }
  swags.forEach((swag, swag_index) => {
    for (let index = 0; index < BULBS_PER_SWAG; index += 1) {
      const point = swag_point(swag, (index + 0.5) / BULBS_PER_SWAG);
      const colour = BULB_COLOURS[(swag_index * BULBS_PER_SWAG + index) % BULB_COLOURS.length];
      paint_festoon_bulb(ctx, point.x, point.y, colour ?? LAMP_LIGHT, frame);
    }
  });
}

/**
 * Paints the plain drum lamp, the fallback for unlisted lighting IDs: a fabric drum shade on a
 * cord, its glowing underside showing below the shade.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent is the drum's trim.
 */
function paint_drum_lamp(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const cx = box.centreX;
  const rx = Math.min(box.width, box.height) * 0.24;
  const ry = rx * 0.3;
  const top_y = box.y - 4;
  const bottom_y = box.y + 10;
  floor_shadow(ctx, cx + 7, box.bottom - 12, rx * 0.85, rx * 0.32, 0.12);
  if (!frame.isLowDetail) soft_glow(ctx, cx, bottom_y + 3, rx * 2, rx * 1.1, LAMP_LIGHT, 0.45);
  ceiling_cord(ctx, box, cx, top_y, 1.3);
  const fabric = linear_gradient(ctx, cx - rx, 0, cx + rx, 0, [
    [0, 0xfffaf0],
    [0.5, DIFFUSER_WHITE],
    [1, shade(DIFFUSER_WHITE, 0.25)],
  ]);
  fill_rounded_rect(ctx, cx - rx, top_y, rx * 2, bottom_y - top_y, 0, fabric);
  fill_ellipse(ctx, cx, top_y, rx, ry, css(tint(DIFFUSER_WHITE, 0.3)));
  fill_ellipse(ctx, cx, bottom_y, rx, ry + 1, css(LIT_INTERIOR));
  paint_bulb(ctx, cx, bottom_y, 2.4, LAMP_LIGHT);
  line(ctx, cx - rx, bottom_y - 2, cx + rx, bottom_y - 2, css(recipe.accent), 1.6, "butt");
  ctx.beginPath();
  ctx.moveTo(cx - rx, top_y);
  ctx.lineTo(cx - rx, bottom_y);
  ctx.ellipse(cx, bottom_y, rx, ry + 1, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, top_y);
  ctx.ellipse(cx, top_y, rx, ry, 0, 0, Math.PI, true);
  stroke_outline(ctx, DIFFUSER_WHITE, frame);
  ink_current_path(ctx, frame, 1.5);
}

/** The painter for each lighting style. */
const LIGHTING_PAINTERS: Readonly<Record<LightingStyle, LightingPainter>> = {
  tube: paint_tube,
  pendant: paint_pendant,
  "lantern-cluster": paint_lantern_cluster,
  "task-light": paint_task_light,
  "path-light": paint_path_light,
  skylight: paint_skylight,
  string: paint_string_lights,
  lamp: paint_drum_lamp,
};

/**
 * Paints a light fitting: the fixture and a modest local glow (the renderer adds the live
 * light pool on the floor).
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; the batten and string follow the footprint's long
 *   side and the task light faces the way it is turned (0 lights the south).
 */
export function paint_lighting(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  const style = resolve_placeable_style("lighting", recipe);
  ctx.save();
  clip_texture(ctx, box);
  LIGHTING_PAINTERS[style](ctx, box, frame, recipe, rotation);
  ctx.restore();
}
