/**
 * The small props that dress a stall's walls and interior: the wares hanging from the rail
 * (poached and roast chickens behind glass, roast ducks, kopi socks, noodle strainers, lanterns,
 * ketupat, woks, coconuts, steamer cloths, ladles, bunting, timber fretwork and a fishing net),
 * the goods on the shelf (plates, leaf parcels, cups, sauces, tiffin carriers, dessert jars,
 * satay pots, bowls, spice tins, teapots, claypots, herb jars and limes), the lit menu board, the
 * fluorescent tube and the stainless extractor hood on the back or side wall, and what stands in the
 * interior: a glass-door drinks fridge, a herbal drawer cabinet, a gas cylinder, sacks of rice
 * or charcoal and an ice box.
 *
 * Hanging and shelf props are drawn frontally (they stand against a wall seen face-on); the
 * interior pieces are drawn as slabs or cylinders with a lit top and a south face.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  glow,
  line,
  linear_gradient,
  radial_gradient,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  stroke_rounded_rect,
  TAU,
  tint,
  with_shadow,
} from "../canvas";
import {
  BRASS,
  CHARCOAL,
  clip_box,
  CREAM,
  edge_outline,
  fill_box,
  fill_cylinder,
  fill_rect,
  GLASS,
  LAMP,
  MUSTARD,
  PORCELAIN,
  shade_band,
  slab_face,
  slab_top,
  specular,
  STEEL,
  STEEL_DARK,
  stroke_arc,
  TIMBER,
  TIMBER_DARK,
  type Box,
  type Slab,
  type StallScene,
} from "./common";

// ---------------------------------------------------------------------------------------------
// Hanging wares.
// ---------------------------------------------------------------------------------------------

/**
 * Paints a hook hanging from the rail.
 *
 * @param scene - The stall scene.
 * @param x - Hook x.
 * @param railY - The rail y.
 * @param length - Drop from the rail to the hook's bend.
 */
function paint_hook(scene: StallScene, x: number, railY: number, length: number): void {
  const { ctx } = scene;
  line(ctx, x, railY, x, railY + length, css(STEEL_DARK), 1.1);
  stroke_arc(ctx, x + 1.4, railY + length, 1.4, Math.PI, TAU, css(STEEL_DARK), 1.1);
}

/**
 * Paints a glass display panel in front of hanging roast meats.
 *
 * @param scene - The stall scene.
 * @param box - The panel.
 */
function paint_glass_panel(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  fill_rounded_rect(ctx, box.x, box.y, box.width, box.height, 2, css(GLASS, 0.16));
  stroke_rounded_rect(ctx, box.x, box.y, box.width, box.height, 2, css(STEEL, 0.8), 1);
  fill_polygon(
    ctx,
    [
      [box.x + 3, box.y + box.height - 3],
      [box.x + box.width * 0.35, box.y + 2],
      [box.x + box.width * 0.5, box.y + 2],
      [box.x + 3 + box.width * 0.15, box.y + box.height - 3],
    ],
    css(0xffffff, 0.16),
  );
}

/**
 * Paints a hanging whole chicken, poached or roasted.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Top of the bird (the hook's bend).
 * @param isRoast - True for the glossy roast bird.
 */
function paint_hanging_chicken(scene: StallScene, x: number, y: number, isRoast: boolean): void {
  const { ctx } = scene;
  const body = isRoast ? 0xb9693f : 0xe9d3a3;
  fill_ellipse(
    ctx,
    x,
    y + 9,
    5.8,
    8,
    linear_gradient(ctx, x - 6, 0, x + 6, 0, [
      [0, tint(body, 0.3)],
      [1, shade(body, 0.3)],
    ]),
  );
  fill_circle(ctx, x - 3, y + 15.5, 2.3, css(shade(body, 0.1)));
  fill_circle(ctx, x + 3, y + 15.5, 2.3, css(shade(body, 0.1)));
  fill_ellipse(ctx, x + 5, y + 7, 1.8, 3.6, css(shade(body, 0.08)));
  fill_ellipse(ctx, x - 2, y + 4.5, 1.8, 2.8, css(0xffffff, isRoast ? 0.42 : 0.3));
}

/**
 * Paints a hanging roast duck, longer than a chicken, with its neck hooked.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Top of the bird (the hook's bend).
 */
function paint_hanging_duck(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  const body = 0x8a4524;
  line(ctx, x, y, x + 1.5, y + 6, css(shade(body, 0.1)), 2.4);
  fill_circle(ctx, x - 0.5, y + 1.5, 2.1, css(shade(body, 0.2)));
  fill_polygon(
    ctx,
    [
      [x - 2.5, y + 1.5],
      [x - 5, y + 2.5],
      [x - 2.5, y + 3],
    ],
    css(0xd6a346),
  );
  fill_ellipse(
    ctx,
    x + 1,
    y + 14,
    5.5,
    9,
    linear_gradient(ctx, x - 5, 0, x + 7, 0, [
      [0, tint(body, 0.35)],
      [0.5, body],
      [1, shade(body, 0.35)],
    ]),
  );
  fill_ellipse(ctx, x - 1, y + 9.5, 1.6, 3.2, css(0xffffff, 0.42));
}

/**
 * Paints a kopi sock: a wire ring with a stained cloth filter hanging from it.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Ring y.
 */
function paint_kopi_sock(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  fill_polygon(
    ctx,
    [
      [x - 4, y + 1],
      [x + 4, y + 1],
      [x + 1.5, y + 13],
      [x - 1, y + 13],
    ],
    linear_gradient(ctx, 0, y, 0, y + 13, [
      [0, 0xd9c3a0],
      [1, 0x7a4b2e],
    ]),
  );
  stroke_ellipse(ctx, x, y + 1, 4.3, 1.4, css(STEEL_DARK), 1.1);
  line(ctx, x + 4.3, y + 1, x + 6.5, y - 2, css(STEEL_DARK), 1.1);
}

/**
 * Paints a wire noodle strainer hanging by its handle.
 *
 * @param scene - The stall scene.
 * @param x - Centre x of the basket.
 * @param y - Top of the handle.
 */
function paint_strainer(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  line(ctx, x, y, x, y + 7, css(0x8a643b), 1.8);
  fill_ellipse(ctx, x, y + 11, 5.5, 4, css(STEEL, 0.9));
  stroke_ellipse(ctx, x, y + 11, 5.5, 4, css(STEEL_DARK), 1.1);
  for (const dx of [-2.5, 0, 2.5]) {
    line(ctx, x + dx, y + 8, x + dx, y + 14, css(STEEL_DARK, 0.6), 0.7);
  }
}

/**
 * Paints a warm paper lantern on a cord.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Cord top.
 */
function paint_lantern(scene: StallScene, x: number, y: number): void {
  const { ctx, isLowDetail, spec } = scene;
  line(ctx, x, y, x, y + 4, css(0x5f3a26), 1.1);
  if (!isLowDetail && spec.isOpen) glow(ctx, x, y + 11, 13, LAMP, 0.45);
  fill_rounded_rect(ctx, x - 3, y + 4, 6, 2, 1, css(0x5f3a26));
  fill_ellipse(
    ctx,
    x,
    y + 11,
    5.5,
    6.5,
    radial_gradient(ctx, x - 2, y + 9, 0, 8, [
      [0, spec.isOpen ? 0xffd27a : 0xe9c48a],
      [1, 0xd9822f],
    ]),
  );
  stroke_ellipse(ctx, x, y + 11, 2, 6.3, css(0xb8601f, 0.5), 0.7);
  stroke_ellipse(ctx, x, y + 11, 4.2, 6.4, css(0xb8601f, 0.5), 0.7);
  fill_rounded_rect(ctx, x - 2.5, y + 17, 5, 2, 1, css(0x5f3a26));
}

/**
 * Paints a bundle of woven ketupat hanging by a string.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - String top.
 */
function paint_ketupat(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  line(ctx, x, y, x, y + 5, css(0xa88c5a), 1);
  const offsets: readonly (readonly [number, number])[] = [
    [0, 8],
    [-4.5, 12],
    [4.5, 12],
    [0, 16],
  ];
  for (const [dx, dy] of offsets) {
    const cx = x + dx;
    const cy = y + dy;
    fill_polygon(
      ctx,
      [
        [cx, cy - 3.6],
        [cx + 3.6, cy],
        [cx, cy + 3.6],
        [cx - 3.6, cy],
      ],
      css(0xc9c27a),
    );
    line(ctx, cx - 1.8, cy - 1.8, cx + 1.8, cy + 1.8, css(0x8f8a4a, 0.7), 0.7);
    line(ctx, cx + 1.8, cy - 1.8, cx - 1.8, cy + 1.8, css(0x8f8a4a, 0.7), 0.7);
  }
}

/**
 * Paints a seasoned wok hanging by its handle loop.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Hook y.
 */
function paint_hanging_wok(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  line(ctx, x, y, x, y + 3, css(STEEL_DARK), 1.1);
  fill_circle(
    ctx,
    x,
    y + 10,
    6.8,
    radial_gradient(ctx, x - 2, y + 8, 0, 8, [
      [0, 0x4a5452],
      [1, CHARCOAL],
    ]),
  );
  stroke_ellipse(ctx, x, y + 10, 6.8, 6.8, css(STEEL_DARK), 0.9);
  fill_circle(ctx, x - 2.4, y + 7.6, 1.4, css(0xffffff, 0.3));
  fill_rounded_rect(ctx, x + 5.5, y + 8.8, 6, 2.4, 1.2, css(0x8a643b));
}

/**
 * Paints a net bag of coconuts hanging from the rail.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Rail y.
 */
function paint_coconut_net(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  line(ctx, x, y, x, y + 4, css(0xd9c39a), 1.1);
  const nuts: readonly (readonly [number, number])[] = [
    [-3.8, 9],
    [3.8, 9],
    [0, 14.5],
  ];
  for (const [dx, dy] of nuts) {
    fill_circle(
      ctx,
      x + dx,
      y + dy,
      4.2,
      radial_gradient(ctx, x + dx - 1.4, y + dy - 1.4, 0, 5, [
        [0, 0x9c7048],
        [1, 0x5a3d26],
      ]),
    );
  }
  for (let index = -2; index <= 2; index += 1) {
    line(ctx, x + index * 2.8, y + 4.5, x + index * 2, y + 19, css(0xe9dcbd, 0.7), 0.6);
  }
}

/**
 * Paints a folded steamer cloth over the rail.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Rail y.
 */
function paint_cloth(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  fill_rounded_rect(ctx, x - 5.5, y - 1, 11, 12, 1.5, css(0xf5f1e6));
  fill_rect(ctx, x - 5.5, y + 4, 11, 0.8, css(0xd9d2c2, 0.9));
  fill_rect(ctx, x + 2.5, y, 3, 11, css(SHADOW_INK, 0.08));
}

/**
 * Paints a ladle and tongs hanging from the rail.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Rail y.
 * @param metal - The utensil metal.
 */
function paint_hanging_tools(scene: StallScene, x: number, y: number, metal: number): void {
  const { ctx } = scene;
  line(ctx, x - 4.5, y, x - 4.5, y + 10, css(shade(metal, 0.3)), 1.3);
  fill_ellipse(ctx, x - 4.5, y + 12, 3, 2.2, css(metal));
  stroke_ellipse(ctx, x - 4.5, y + 12, 3, 2.2, css(shade(metal, 0.35)), 0.7);
  line(ctx, x + 3, y, x + 1.5, y + 13, css(shade(metal, 0.3)), 1.3);
  line(ctx, x + 3, y, x + 5.5, y + 13, css(shade(metal, 0.3)), 1.3);
  fill_circle(ctx, x + 3, y + 1, 1.3, css(metal));
}

/**
 * Paints a string of pennants along the rail.
 *
 * @param scene - The stall scene.
 * @param from - Left end.
 * @param to - Right end.
 * @param y - Rail y.
 */
function paint_bunting(scene: StallScene, from: number, to: number, y: number): void {
  const { ctx, spec } = scene;
  const colours = [tint(spec.primary, 0.3), spec.secondary, 0xfff1d0];
  const count = Math.max(3, Math.floor((to - from) / 8));
  const step = (to - from) / count;
  line(ctx, from, y, to, y + 1, css(0xd9c39a), 0.7);
  for (let index = 0; index < count; index += 1) {
    const x = from + index * step;
    fill_polygon(
      ctx,
      [
        [x, y + 0.5],
        [x + step, y + 0.5],
        [x + step / 2, y + 7],
      ],
      css(colours[index % colours.length] as number),
    );
  }
}

/**
 * Paints a carved timber fretwork panel under the canopy.
 *
 * @param scene - The stall scene.
 * @param from - Left end.
 * @param to - Right end.
 * @param y - Top edge.
 */
function paint_fretwork(scene: StallScene, from: number, to: number, y: number): void {
  const { ctx, spec } = scene;
  const height = 9;
  fill_rounded_rect(ctx, from, y, to - from, height, 1.5, css(TIMBER_DARK));
  fill_rect(ctx, from, y, to - from, 0.8, css(tint(TIMBER, 0.3), 0.6));
  for (let cx = from + 6; cx < to - 3; cx += 9) {
    fill_circle(ctx, cx, y + height / 2, 2.4, css(tint(spec.secondary, 0.3), 0.9));
    fill_circle(ctx, cx, y + height / 2, 1, css(TIMBER_DARK));
  }
}

/**
 * Paints a rope net with cork floats.
 *
 * @param scene - The stall scene.
 * @param from - Left end.
 * @param to - Right end.
 * @param y - Rail y.
 */
function paint_net(scene: StallScene, from: number, to: number, y: number): void {
  const { ctx } = scene;
  const width = to - from;
  const height = 16;
  const rope = css(0xd8c39a, 0.85);
  for (let offset = -height; offset < width; offset += 6) {
    line(
      ctx,
      from + Math.max(0, offset),
      y + Math.max(0, -offset),
      from + Math.min(width, offset + height),
      y + Math.min(height, width - offset),
      rope,
      0.8,
    );
    line(
      ctx,
      from + Math.min(width, offset + height),
      y + Math.max(0, offset + height - width),
      from + Math.max(0, offset),
      y + Math.min(height, offset + height),
      rope,
      0.8,
    );
  }
  fill_ellipse(ctx, from + width * 0.3, y + 5, 3.2, 2.2, css(0xd9b36a));
  fill_ellipse(ctx, from + width * 0.7, y + 11, 3.2, 2.2, css(0xd9b36a));
}

/**
 * Paints the stall's hanging wares from a rail across a span of the wall.
 *
 * @param scene - The stall scene.
 * @param from - Left end of the span.
 * @param to - Right end of the span.
 * @param railY - The rail y.
 */
export function paint_hanging_wares(
  scene: StallScene,
  from: number,
  to: number,
  railY: number,
): void {
  const { ctx, dressing } = scene;
  const width = to - from;
  if (width < 10) return;
  const count = Math.max(1, Math.min(4, Math.floor(width / 15)));
  const points = Array.from(
    { length: count },
    (_, index) => from + ((index + 0.5) * width) / count,
  );
  const needsRail = !["bunting", "fretwork", "net"].includes(dressing.hanging);
  if (needsRail) {
    line(ctx, from - 2, railY, to + 2, railY, css(STEEL_DARK), 1.4, "butt");
    line(ctx, from - 2, railY - 0.6, to + 2, railY - 0.6, css(0xffffff, 0.35), 0.6, "butt");
  }
  switch (dressing.hanging) {
    case "chickens":
      points.forEach((x, index) => {
        paint_hook(scene, x, railY, 2.5);
        paint_hanging_chicken(scene, x, railY + 3.5, index % 2 === 1);
      });
      paint_glass_panel(scene, { x: from - 3, y: railY + 1, width: width + 6, height: 21 });
      return;
    case "ducks":
      for (const x of points) {
        paint_hook(scene, x, railY, 2);
        paint_hanging_duck(scene, x, railY + 3);
      }
      paint_glass_panel(scene, { x: from - 3, y: railY + 1, width: width + 6, height: 24 });
      return;
    case "kopi-socks":
      points.forEach((x, index) => paint_kopi_sock(scene, x, railY + 2 + (index % 2) * 2));
      return;
    case "strainers":
      for (const x of points) paint_strainer(scene, x, railY);
      return;
    case "lanterns":
      for (const x of points) paint_lantern(scene, x, railY);
      return;
    case "ketupat":
      for (const x of points) paint_ketupat(scene, x, railY);
      return;
    case "woks":
      for (const x of points) paint_hanging_wok(scene, x, railY);
      return;
    case "coconuts":
      points.forEach((x, index) =>
        index % 2 === 0
          ? paint_coconut_net(scene, x, railY)
          : paint_hanging_tools(scene, x, railY, STEEL),
      );
      return;
    case "cloths":
      for (const x of points) paint_cloth(scene, x, railY);
      return;
    case "tools":
      for (const x of points) {
        paint_hanging_tools(scene, x, railY, dressing.cabinet === "timber" ? BRASS : STEEL);
      }
      return;
    case "bunting":
      paint_bunting(scene, from, to, railY);
      return;
    case "fretwork":
      paint_fretwork(scene, from, to, railY - 3);
      return;
    case "net":
      paint_net(scene, from, to, railY);
      return;
  }
}

// ---------------------------------------------------------------------------------------------
// Shelf goods.
// ---------------------------------------------------------------------------------------------

/**
 * Paints a sauce bottle with a brass cap and a paper label.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the bottle stands on.
 * @param colourValue - Bottle colour.
 * @param height - Bottle height.
 */
export function paint_bottle(
  scene: StallScene,
  cx: number,
  baseY: number,
  colourValue: number,
  height = 11,
): void {
  const { ctx } = scene;
  const width = 4.6;
  const x = cx - width / 2;
  const y = baseY - height;
  fill_rounded_rect(ctx, x, y + 3, width, height - 3, 1.4, css(colourValue));
  fill_rounded_rect(ctx, cx - 1.3, y, 2.6, 4, 1, css(shade(colourValue, 0.2)));
  fill_rounded_rect(ctx, cx - 1.5, y - 1, 3, 1.6, 0.8, css(BRASS));
  specular(ctx, x + 0.7, y + 4, height - 6);
  fill_rect(ctx, x + 0.5, y + height * 0.52, width - 1, 2.4, css(0xfff4dc, 0.9));
}

/**
 * Paints a glass jar with coloured contents and a lid.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the jar stands on.
 * @param contents - Contents colour.
 * @param height - Jar height.
 * @param width - Jar width.
 * @param lid - Lid colour.
 */
export function paint_jar(
  scene: StallScene,
  cx: number,
  baseY: number,
  contents: number,
  height = 10,
  width = 7.5,
  lid = 0xd9c39a,
): void {
  const { ctx } = scene;
  const x = cx - width / 2;
  const y = baseY - height;
  fill_rounded_rect(ctx, x, y, width, height, 2, css(GLASS, 0.9));
  fill_rounded_rect(
    ctx,
    x + 0.8,
    y + height * 0.4,
    width - 1.6,
    height * 0.6 - 0.8,
    1.5,
    css(contents),
  );
  fill_rounded_rect(ctx, x - 0.5, y - 1, width + 1, 2.4, 1, css(lid));
  specular(ctx, x + 1.1, y + 2, height - 4, 0.5);
}

/**
 * Paints a stack of bowls or cups.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the stack stands on.
 * @param count - Bowls in the stack.
 * @param width - Rim width.
 * @param colourValue - Glaze colour.
 * @param rim - Rim colour.
 */
export function paint_stack(
  scene: StallScene,
  cx: number,
  baseY: number,
  count: number,
  width: number,
  colourValue = PORCELAIN,
  rim = 0xd9d2c2,
): void {
  const { ctx } = scene;
  const step = 2.5;
  for (let index = 0; index < count; index += 1) {
    const y = baseY - index * step;
    fill_rounded_rect(ctx, cx - width / 2, y - 3, width, 3, 1, css(colourValue));
    fill_rect(ctx, cx - width / 2, y - 3, width, 0.8, css(rim));
  }
  const topY = baseY - count * step;
  fill_ellipse(ctx, cx, topY, width / 2, 1.7, css(tint(colourValue, 0.3)));
  fill_ellipse(ctx, cx, topY, width / 2 - 1.3, 0.9, css(shade(colourValue, 0.2)));
}

/**
 * Paints a stack of plates.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the stack stands on.
 * @param count - Plates in the stack.
 */
function paint_plates(scene: StallScene, cx: number, baseY: number, count: number): void {
  const { ctx } = scene;
  for (let index = 0; index < count; index += 1) {
    const y = baseY - index * 1.6;
    fill_ellipse(ctx, cx, y, 7, 1.7, css(0xf7f3ea));
    fill_ellipse(ctx, cx, y + 0.6, 7, 1.1, css(0xd9d2c2, 0.7));
  }
  fill_ellipse(ctx, cx, baseY - count * 1.6, 4.6, 0.9, css(0xd9d2c2, 0.6));
}

/**
 * Paints a steel spice tin with a coloured label.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the tin stands on.
 * @param labelColour - Label colour.
 */
function paint_tin(scene: StallScene, cx: number, baseY: number, labelColour: number): void {
  const { ctx } = scene;
  fill_cylinder(ctx, cx - 3.2, baseY - 8.5, 6.4, 8.5, 1.4, STEEL);
  fill_rect(ctx, cx - 3.2, baseY - 5.8, 6.4, 3.2, css(labelColour));
  fill_ellipse(ctx, cx, baseY - 8.5, 3.2, 1.1, css(tint(STEEL, 0.4)));
}

/**
 * Paints a stacked tiffin carrier with its handle.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the carrier stands on.
 * @param tiers - Tier count.
 */
function paint_tiffin(scene: StallScene, cx: number, baseY: number, tiers: number): void {
  const { ctx, spec } = scene;
  const tierHeight = 4;
  for (let tier = 0; tier < tiers; tier += 1) {
    const y = baseY - (tier + 1) * tierHeight;
    fill_cylinder(
      ctx,
      cx - 5.5,
      y,
      11,
      tierHeight,
      1,
      tier % 2 === 0 ? STEEL : tint(spec.accent, 0.2),
    );
    fill_rect(ctx, cx - 5.5, y, 11, 0.7, css(0xffffff, 0.4));
  }
  const top = baseY - tiers * tierHeight;
  line(ctx, cx - 4.5, top, cx - 4.5, top - 3.5, css(STEEL_DARK), 1.1);
  line(ctx, cx + 4.5, top, cx + 4.5, top - 3.5, css(STEEL_DARK), 1.1);
  stroke_arc(ctx, cx, top - 3.5, 4.5, Math.PI, TAU, css(STEEL_DARK), 1.1);
}

/**
 * Paints a lidded claypot with its wire handle.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the pot stands on.
 * @param radius - Pot radius.
 */
export function paint_claypot(scene: StallScene, cx: number, baseY: number, radius: number): void {
  const { ctx } = scene;
  const body = 0x4a3026;
  fill_ellipse(
    ctx,
    cx,
    baseY - radius * 0.75,
    radius,
    radius * 0.75,
    radial_gradient(ctx, cx - radius * 0.4, baseY - radius, 0, radius * 1.4, [
      [0, tint(body, 0.3)],
      [1, shade(body, 0.3)],
    ]),
  );
  fill_ellipse(ctx, cx, baseY - radius * 1.3, radius * 0.85, radius * 0.35, css(tint(body, 0.12)));
  fill_circle(ctx, cx, baseY - radius * 1.55, radius * 0.22, css(shade(body, 0.2)));
  stroke_arc(
    ctx,
    cx,
    baseY - radius * 1.3,
    radius * 0.95,
    Math.PI * 1.1,
    Math.PI * 1.9,
    css(STEEL_DARK),
    1,
  );
}

/**
 * Paints a stack of banana leaves.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the stack lies on.
 * @param width - Leaf length.
 */
export function paint_leaf_stack(scene: StallScene, cx: number, baseY: number, width = 20): void {
  const { ctx } = scene;
  for (let index = 0; index < 3; index += 1) {
    const y = baseY - 2 - index * 2;
    const colourValue = index % 2 === 0 ? 0x4f874f : 0x63a056;
    fill_rounded_rect(ctx, cx - width / 2 + index, y - 2, width, 4, 2, css(colourValue));
    fill_rect(
      ctx,
      cx - width / 2 + 2 + index,
      y - 0.4,
      width - 4,
      0.7,
      css(tint(colourValue, 0.35), 0.8),
    );
  }
}

/**
 * Paints a bowl of limes.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the bowl stands on.
 */
function paint_lime_bowl(scene: StallScene, cx: number, baseY: number): void {
  const { ctx } = scene;
  const limes: readonly (readonly [number, number])[] = [
    [-3.6, -5.5],
    [0, -7],
    [3.6, -5.5],
    [-1.8, -8.4],
    [2.2, -8.8],
  ];
  for (const [dx, dy] of limes) fill_circle(ctx, cx + dx, baseY + dy, 2.2, css(0x6fae4a));
  fill_polygon(
    ctx,
    [
      [cx - 7.5, baseY - 5.5],
      [cx + 7.5, baseY - 5.5],
      [cx + 5, baseY],
      [cx - 5, baseY],
    ],
    css(0xf4efe6),
  );
  fill_ellipse(ctx, cx, baseY - 5.5, 7.5, 1.5, css(0xdcd5c6));
}

/**
 * Paints a round teapot.
 *
 * @param scene - The stall scene.
 * @param cx - Centre x.
 * @param baseY - Y the pot stands on.
 * @param colourValue - Pot colour.
 */
export function paint_teapot(
  scene: StallScene,
  cx: number,
  baseY: number,
  colourValue: number,
): void {
  const { ctx } = scene;
  fill_circle(
    ctx,
    cx,
    baseY - 5,
    5,
    radial_gradient(ctx, cx - 2, baseY - 7, 0, 7, [
      [0, tint(colourValue, 0.35)],
      [1, shade(colourValue, 0.25)],
    ]),
  );
  line(ctx, cx + 4.5, baseY - 6.5, cx + 8, baseY - 10, css(colourValue), 1.8);
  stroke_arc(ctx, cx - 5.5, baseY - 5.5, 2.8, Math.PI * 0.5, Math.PI * 1.5, css(colourValue), 1.4);
  fill_circle(ctx, cx, baseY - 9.8, 1.3, css(shade(colourValue, 0.2)));
}

/**
 * Paints the stall's shelf goods spread along a span, standing on a line.
 *
 * @param scene - The stall scene.
 * @param from - Left end of the span.
 * @param to - Right end of the span.
 * @param baseY - Y the goods stand on.
 */
export function paint_shelf_goods(
  scene: StallScene,
  from: number,
  to: number,
  baseY: number,
): void {
  const { spec, dressing } = scene;
  const width = to - from;
  if (width < 12) return;
  const at = (share: number) => from + width * share;
  switch (dressing.shelf) {
    case "plates":
      paint_plates(scene, at(0.2), baseY, 5);
      paint_stack(scene, at(0.55), baseY, 3, 10);
      paint_jar(scene, at(0.86), baseY, 0xd94b3a, 8, 6);
      return;
    case "parcels":
      paint_leaf_stack(scene, at(0.28), baseY, Math.min(20, width * 0.45));
      paint_jar(scene, at(0.7), baseY, 0x6fae4a, 8, 6.5);
      paint_jar(scene, at(0.9), baseY, 0xc8452f, 8, 6.5);
      return;
    case "cups":
      paint_stack(scene, at(0.18), baseY, 4, 7.5, PORCELAIN, 0x3f8f5a);
      paint_stack(scene, at(0.46), baseY, 3, 7.5, PORCELAIN, 0x3f8f5a);
      paint_tin_row(scene, at(0.72), at(0.95), baseY);
      return;
    case "sauces":
      [0x9f2f2a, 0x3b2a22, 0xd9a13a, 0x6b3e2c].forEach((colourValue, index) => {
        paint_bottle(scene, at(0.14 + index * 0.24), baseY, colourValue, 10 + (index % 2) * 2);
      });
      return;
    case "tiffins":
      paint_tiffin(scene, at(0.25), baseY, 3);
      paint_tiffin(scene, at(0.72), baseY, 2);
      return;
    case "dessert-jars":
      [0xb23b33, 0x3f8f5a, 0x8a5b3a, 0xf2d58a].forEach((colourValue, index) => {
        paint_jar(scene, at(0.13 + index * 0.25), baseY, colourValue, 11, 7.5, GLASS);
      });
      return;
    case "satay-pots": {
      const { ctx } = scene;
      fill_cylinder(ctx, at(0.08), baseY - 10, 11, 10, 2, STEEL);
      fill_ellipse(ctx, at(0.08) + 5.5, baseY - 10, 4.8, 1.6, css(0xb0552c));
      paint_jar(scene, at(0.55), baseY, 0xc8452f, 8, 6.5);
      paint_jar(scene, at(0.8), baseY, 0xd9a13a, 8, 6.5);
      return;
    }
    case "bowls":
      paint_stack(scene, at(0.2), baseY, 5, 11);
      paint_stack(scene, at(0.55), baseY, 3, 11, PORCELAIN, spec.accent);
      paint_jar(scene, at(0.86), baseY, 0xc8452f, 8, 6.5);
      return;
    case "spice-tins":
      [MUSTARD, 0xc8452f, 0x6fae4a, 0x8a4524].forEach((colourValue, index) => {
        paint_tin(scene, at(0.12 + index * 0.25), baseY, colourValue);
      });
      return;
    case "teapots":
      paint_teapot(scene, at(0.22), baseY, 0xb8613d);
      paint_stack(scene, at(0.6), baseY, 3, 7.5, PORCELAIN, 0x3f8f5a);
      paint_jar(scene, at(0.88), baseY, 0x8a4524, 7.5, 5.5);
      return;
    case "claypots":
      paint_claypot(scene, at(0.2), baseY, 5.5);
      paint_claypot(scene, at(0.52), baseY, 4.5);
      paint_jar(scene, at(0.85), baseY, 0x9f2f2a, 8, 6.5);
      return;
    case "herb-jars":
      [0x8a5b3a, 0xc55656, 0xd9c39a, 0x5a4634, 0xb0552c].forEach((colourValue, index) => {
        paint_jar(scene, at(0.08 + index * 0.21), baseY, colourValue, 9 + (index % 2) * 2, 7);
      });
      return;
    case "limes":
      paint_lime_bowl(scene, at(0.24), baseY);
      paint_jar(scene, at(0.62), baseY, 0xc8452f, 8, 6.5);
      paint_bottle(scene, at(0.88), baseY, 0x3b2a22, 11);
      return;
  }
}

/**
 * Paints a row of condensed-milk tins, the kopi stall's shelf staple.
 *
 * @param scene - The stall scene.
 * @param from - Left end.
 * @param to - Right end.
 * @param baseY - Y the tins stand on.
 */
function paint_tin_row(scene: StallScene, from: number, to: number, baseY: number): void {
  for (let x = from; x <= to - 3; x += 6.5) paint_tin(scene, x + 3, baseY, 0x3e6f9c);
}

// ---------------------------------------------------------------------------------------------
// Wall fittings.
// ---------------------------------------------------------------------------------------------

/**
 * Paints a timber or steel shelf plank with the shadow it casts on the wall.
 *
 * @param scene - The stall scene.
 * @param from - Left end.
 * @param to - Right end.
 * @param y - Top of the plank.
 */
export function paint_shelf_plank(scene: StallScene, from: number, to: number, y: number): void {
  const { ctx, dressing } = scene;
  const plank = dressing.cabinet === "steel" ? STEEL : TIMBER;
  shade_band(ctx, from + 1, y + 2, to - from, 4, 0.22);
  fill_rect(ctx, from, y - 1.5, to - from, 1.5, css(tint(plank, 0.3)));
  fill_rect(ctx, from, y, to - from, 2.2, css(shade(plank, 0.2)));
  line(ctx, from + 4, y + 2, from + 7, y + 5, css(STEEL_DARK), 1);
  line(ctx, to - 4, y + 2, to - 7, y + 5, css(STEEL_DARK), 1);
}

/**
 * Paints the lit menu board: a dark board with a row of coloured dish photos and text strips
 * per dish, glowing when the stall is open.
 *
 * @param scene - The stall scene.
 * @param box - The board.
 */
export function paint_menu_board(scene: StallScene, box: Box): void {
  const { ctx, spec, isLowDetail, isHighContrast } = scene;
  const isLit = spec.isOpen;
  if (isLit && !isLowDetail && !isHighContrast) {
    glow(ctx, box.x + box.width / 2, box.y + box.height / 2, box.width * 0.6, LAMP, 0.18);
  }
  with_shadow(
    ctx,
    () =>
      fill_rounded_rect(
        ctx,
        box.x,
        box.y,
        box.width,
        box.height,
        1.5,
        css(shade(spec.primary, 0.55)),
      ),
    { blur: 3, offsetX: 1, offsetY: 2, alpha: 0.3 },
  );
  fill_rounded_rect(
    ctx,
    box.x + 1.2,
    box.y + 1.2,
    box.width - 2.4,
    box.height - 2.4,
    1,
    css(0x24302f),
  );
  const photos = [0xd9a13a, 0xc8452f, 0x8bb06a, 0xe9d3a3, 0x8a4524, spec.accent];
  const rows = Math.max(1, Math.floor((box.height - 3) / 4));
  const rowHeight = (box.height - 3) / rows;
  for (let row = 0; row < rows; row += 1) {
    const y = box.y + 1.8 + row * rowHeight;
    fill_rect(
      ctx,
      box.x + 2.5,
      y + 0.4,
      4.2,
      rowHeight - 1,
      css(photos[row % photos.length] as number),
    );
    fill_rect(
      ctx,
      box.x + 8,
      y + 1,
      (box.width - 18) * (0.55 + ((row * 37) % 40) / 100),
      1,
      css(CREAM, isLit ? 0.85 : 0.5),
    );
    fill_rect(ctx, box.x + box.width - 7, y + 1, 4.5, 1, css(MUSTARD, isLit ? 0.95 : 0.5));
  }
  if (isLit) fill_rect(ctx, box.x + 1.2, box.y + 1.2, box.width - 2.4, 1, css(0xffffff, 0.25));
}

/**
 * Paints a fluorescent tube in its batten, glowing when the stall is open.
 *
 * @param scene - The stall scene.
 * @param from - Left end.
 * @param to - Right end.
 * @param y - Tube y.
 */
export function paint_tube_light(scene: StallScene, from: number, to: number, y: number): void {
  const { ctx, spec, isLowDetail } = scene;
  const isLit = spec.isOpen;
  if (isLit && !isLowDetail) {
    const length = to - from;
    for (let index = 0; index < 3; index += 1) {
      glow(ctx, from + (length * (index + 0.5)) / 3, y + 2, length * 0.28, 0xf3fbff, 0.22);
    }
  }
  fill_rounded_rect(ctx, from - 1.5, y - 1, to - from + 3, 3, 1, css(STEEL_DARK));
  fill_rounded_rect(ctx, from, y - 0.2, to - from, 1.8, 0.9, css(isLit ? 0xffffff : 0xe1e6e4));
  fill_rect(ctx, from - 1.5, y - 1, 2, 3, css(shade(STEEL, 0.4)));
  fill_rect(ctx, to - 0.5, y - 1, 2, 3, css(shade(STEEL, 0.4)));
}

/**
 * Paints the stainless extractor hood over the main station: its sloping face, lit front lip,
 * dark filter underside, grease staining over smoky kitchens and the duct up to the roof.
 *
 * @param scene - The stall scene.
 * @param box - The hood.
 */
export function paint_hood(scene: StallScene, box: Box): void {
  const { ctx, dressing, spec, isLowDetail } = scene;
  const isSmoky = dressing.wall === "soot";
  const lip = 3;
  fill_rect(
    ctx,
    box.x + box.width / 2 - 4,
    box.y - 6,
    8,
    7,
    linear_gradient(ctx, box.x + box.width / 2 - 4, 0, box.x + box.width / 2 + 4, 0, [
      [0, tint(STEEL, 0.25)],
      [1, shade(STEEL, 0.3)],
    ]),
  );
  with_shadow(
    ctx,
    () =>
      fill_polygon(
        ctx,
        [
          [box.x + 5, box.y],
          [box.x + box.width - 5, box.y],
          [box.x + box.width, box.y + box.height - lip],
          [box.x, box.y + box.height - lip],
        ],
        linear_gradient(ctx, 0, box.y, 0, box.y + box.height, [
          [0, shade(STEEL, 0.38)],
          [0.7, shade(STEEL, 0.12)],
          [1, STEEL],
        ]),
      ),
    { blur: 4, offsetX: 1, offsetY: 4, alpha: 0.32 },
  );
  for (let x = box.x + 6; x < box.x + box.width - 5; x += 5) {
    fill_rect(ctx, x, box.y + 1, 0.8, box.height - lip - 2, css(SHADOW_INK, 0.08));
  }
  fill_rect(ctx, box.x, box.y + box.height - lip, box.width, lip, css(tint(STEEL, 0.35)));
  fill_rect(ctx, box.x, box.y + box.height - 0.8, box.width, 0.8, css(STEEL_DARK));
  if (isSmoky && !isLowDetail) {
    shade_band(ctx, box.x + 3, box.y, box.width - 6, box.height - lip, 0.3, false);
  }
  if (spec.isOpen && !isLowDetail) {
    glow(ctx, box.x + box.width / 2, box.y + box.height + 3, box.width * 0.3, LAMP, 0.16);
  }
  edge_outline(scene, box, 1, STEEL);
}

/**
 * Paints a stainless extractor hood mounted on a side wall over a bench that runs north to south
 * (rotations 90 and 270): its canopy seen from above with filter slats, the lit lip of its south
 * end, the darker open edge over the aisle and the duct rising up the wall into the roof.
 *
 * @param scene - The stall scene.
 * @param box - The hood as seen on screen.
 */
export function paint_side_hood(scene: StallScene, box: Box): void {
  const { ctx, geo, dressing, spec, isLowDetail } = scene;
  const isWallEast = geo.side === "west";
  const lip = 4;
  const ductX = isWallEast ? box.x + box.width - 5 : box.x;
  const ductTop = geo.header.height - 2;
  if (box.y - ductTop > 2) {
    fill_rect(
      ctx,
      ductX,
      ductTop,
      5,
      box.y - ductTop + 2,
      linear_gradient(ctx, ductX, 0, ductX + 5, 0, [
        [0, tint(STEEL, 0.25)],
        [1, shade(STEEL, 0.3)],
      ]),
    );
  }
  const canopy: Box = { x: box.x, y: box.y, width: box.width, height: box.height - lip };
  with_shadow(
    ctx,
    () =>
      fill_box(
        ctx,
        canopy,
        linear_gradient(ctx, box.x, box.y, box.x + box.width, box.y + box.height, [
          [0, tint(STEEL, 0.3)],
          [0.6, STEEL],
          [1, shade(STEEL, 0.18)],
        ]),
      ),
    { blur: 4, offsetX: 1, offsetY: 4, alpha: 0.3 },
  );
  if (!isLowDetail) {
    for (let y = canopy.y + 3; y < canopy.y + canopy.height - 1; y += 3.5) {
      fill_rect(ctx, canopy.x + 2, y, canopy.width - 4, 0.8, css(SHADOW_INK, 0.12));
    }
  }
  // The open edge over the aisle turns down, so it reads darker than the canopy.
  const edgeX = isWallEast ? box.x : box.x + box.width - 2;
  fill_rect(ctx, edgeX, box.y, 2, box.height, css(STEEL_DARK, 0.85));
  fill_rect(ctx, box.x, box.y + box.height - lip, box.width, lip, css(tint(STEEL, 0.35)));
  fill_rect(ctx, box.x, box.y + box.height - 0.8, box.width, 0.8, css(STEEL_DARK));
  if (dressing.wall === "soot" && !isLowDetail) {
    shade_band(ctx, canopy.x, canopy.y, canopy.width, canopy.height, 0.28, false);
  }
  if (spec.isOpen && !isLowDetail) {
    glow(ctx, box.x + box.width / 2, box.y + box.height + 4, box.width * 0.45, LAMP, 0.14);
  }
  edge_outline(scene, box, 1, STEEL);
}

// ---------------------------------------------------------------------------------------------
// Interior pieces.
// ---------------------------------------------------------------------------------------------

/**
 * Paints a tall cabinet standing in the interior: the kopi stall's glass-door drinks fridge or
 * the herbal stall's drawer cabinet.
 *
 * @param scene - The stall scene.
 * @param slab - The cabinet.
 */
export function paint_tall_extra(scene: StallScene, slab: Slab): void {
  const { ctx, spec, dressing, isLowDetail } = scene;
  const top = slab_top(slab);
  const face = slab_face(slab);
  const isFridge = dressing.extra === "fridge";
  const body = isFridge ? 0xe9edea : TIMBER_DARK;
  with_shadow(ctx, () => fill_box(ctx, face, css(body)), {
    blur: 5,
    offsetX: 3,
    offsetY: 3,
    alpha: 0.3,
  });
  fill_box(
    ctx,
    top,
    linear_gradient(ctx, 0, top.y, 0, top.y + top.height, [
      [0, tint(body, 0.3)],
      [1, tint(body, 0.08)],
    ]),
  );
  fill_box(
    ctx,
    face,
    linear_gradient(ctx, face.x, 0, face.x + face.width, 0, [
      [0, tint(body, 0.12)],
      [1, shade(body, 0.22)],
    ]),
  );
  if (isFridge) {
    const header: Box = { x: face.x + 1.5, y: face.y + 1.5, width: face.width - 3, height: 5 };
    fill_box(ctx, header, css(spec.primary));
    fill_rect(ctx, header.x + 3, header.y + 2, header.width - 6, 1, css(CREAM, 0.8));
    const door: Box = {
      x: face.x + 2,
      y: face.y + 8,
      width: face.width - 4,
      height: face.height - 11,
    };
    fill_box(ctx, door, css(spec.isOpen ? 0x2e4a4e : 0x3a4446));
    ctx.save();
    clip_box(ctx, door);
    const shelves = Math.max(2, Math.floor(door.height / 9));
    const colours = [0xc8452f, 0x3f8f5a, 0xd9a13a, 0xa8dadc, 0x6f4e37];
    for (let shelf = 0; shelf < shelves; shelf += 1) {
      const baseY = door.y + ((shelf + 1) * door.height) / shelves - 1;
      fill_rect(ctx, door.x, baseY, door.width, 1, css(STEEL, 0.8));
      for (let x = door.x + 2.5; x < door.x + door.width - 2; x += 3.6) {
        const colourValue = colours[(shelf * 3 + Math.round(x)) % colours.length] as number;
        fill_rounded_rect(ctx, x - 1.2, baseY - 6, 2.4, 6, 0.8, css(colourValue));
      }
    }
    if (spec.isOpen) fill_box(ctx, door, css(0xe9fbff, 0.1));
    fill_polygon(
      ctx,
      [
        [door.x + 2, door.y + door.height],
        [door.x + door.width * 0.55, door.y],
        [door.x + door.width * 0.8, door.y],
        [door.x + 4, door.y + door.height],
      ],
      css(0xffffff, 0.14),
    );
    ctx.restore();
    fill_rect(ctx, door.x + door.width - 2.5, door.y + 4, 1.2, door.height * 0.4, css(STEEL_DARK));
  } else {
    const columns = 3;
    const rows = Math.max(3, Math.floor((face.height - 4) / 6));
    const cellWidth = (face.width - 4) / columns;
    const cellHeight = (face.height - 4) / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = face.x + 2 + column * cellWidth;
        const y = face.y + 2 + row * cellHeight;
        fill_rect(
          ctx,
          x + 0.4,
          y + 0.4,
          cellWidth - 0.8,
          cellHeight - 0.8,
          css(tint(TIMBER, 0.08)),
        );
        fill_rect(ctx, x + 0.4, y + 0.4, cellWidth - 0.8, 0.7, css(0xffffff, 0.2));
        if (!isLowDetail) fill_rect(ctx, x + 1.5, y + 1.2, cellWidth - 3, 1.6, css(CREAM, 0.85));
        fill_circle(ctx, x + cellWidth / 2, y + cellHeight - 1.6, 0.8, css(BRASS));
      }
    }
  }
  edge_outline(
    scene,
    { x: slab.x, y: top.y, width: slab.width, height: top.height + face.height },
    1,
    body,
  );
}

/**
 * Paints the low clutter standing on the interior floor: a gas cylinder with its hose, a pair of
 * rice or charcoal sacks, or an ice box with the day's catch.
 *
 * @param scene - The stall scene.
 */
export function paint_low_extra(scene: StallScene): void {
  const { ctx, geo, dressing } = scene;
  if (!geo.lowExtra) return;
  const { x, y } = geo.lowExtra;
  switch (dressing.extra) {
    case "gas": {
      fill_ellipse(ctx, x + 2, y + 1, 6, 2.2, css(SHADOW_INK, 0.3));
      fill_cylinder(ctx, x - 4.5, y - 15, 9, 15, 3.5, 0xb8432f);
      fill_ellipse(ctx, x, y - 15, 4.5, 1.8, css(tint(0xb8432f, 0.3)));
      fill_rect(ctx, x - 4.5, y - 7, 9, 1.4, css(CREAM, 0.7));
      fill_rounded_rect(ctx, x - 1.5, y - 19, 3, 4, 1, css(BRASS));
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 18);
      ctx.quadraticCurveTo(x + 8, y - 24, x + 4, y - 30);
      ctx.strokeStyle = css(CHARCOAL);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      return;
    }
    case "sacks": {
      const isCharcoal = dressing.station === "charcoal-grill";
      for (const [dx, tone] of [
        [-5, 0xc8a874],
        [5, 0xb99a66],
      ] as const) {
        fill_ellipse(ctx, x + dx + 2, y + 1, 6, 2.2, css(SHADOW_INK, 0.28));
        fill_rounded_rect(
          ctx,
          x + dx - 5,
          y - 11,
          10,
          12,
          4,
          linear_gradient(ctx, x + dx - 5, 0, x + dx + 5, 0, [
            [0, tint(tone, 0.2)],
            [1, shade(tone, 0.25)],
          ]),
        );
        fill_ellipse(ctx, x + dx, y - 11, 4.5, 1.8, css(isCharcoal ? CHARCOAL : 0xf3ecdc));
        line(ctx, x + dx - 3, y - 6, x + dx + 3, y - 6, css(shade(tone, 0.4), 0.6), 0.6);
      }
      return;
    }
    case "icebox": {
      fill_ellipse(ctx, x + 2, y + 1, 10, 2.5, css(SHADOW_INK, 0.28));
      fill_rect(ctx, x - 9, y - 7, 18, 7, css(0xeef1ee));
      fill_rect(ctx, x - 9, y - 7, 18, 1, css(0xffffff));
      fill_rect(ctx, x - 9, y - 12, 18, 5, css(0xdfe8ec));
      for (let index = 0; index < 5; index += 1) {
        fill_rounded_rect(ctx, x - 8 + index * 3.4, y - 12, 3, 2.2, 0.8, css(0xffffff, 0.9));
      }
      fill_ellipse(ctx, x + 1, y - 11, 5, 1.5, css(0x8fa3ad));
      fill_polygon(
        ctx,
        [
          [x + 6, y - 11],
          [x + 9, y - 13.5],
          [x + 9, y - 8.5],
        ],
        css(0x8fa3ad),
      );
      return;
    }
    case "fridge":
    case "drawers":
    case "none":
      return;
  }
}

/** The kinds of clutter that stand about a stall's floor, picked per stall and spot. */
const CLUTTER_KINDS = ["crates", "stool", "bucket"] as const;

/**
 * Paints a stack of plastic produce crates.
 *
 * @param scene - The stall scene.
 * @param x - Centre x of the base.
 * @param y - Base y.
 */
function paint_crates(scene: StallScene, x: number, y: number): void {
  const { ctx, spec } = scene;
  fill_ellipse(ctx, x + 2, y + 1, 9, 2.4, css(SHADOW_INK, 0.28));
  [0x2f6fa8, spec.accent].forEach((colourValue, index) => {
    const top = y - 7 * (index + 1);
    const crateTop: Box = { x: x - 8, y: top - 4, width: 16, height: 5 };
    fill_box(ctx, crateTop, css(tint(colourValue, 0.2)));
    fill_box(
      ctx,
      { x: x - 8, y: top, width: 16, height: 7 },
      linear_gradient(ctx, x - 8, 0, x + 8, 0, [
        [0, tint(colourValue, 0.1)],
        [1, shade(colourValue, 0.25)],
      ]),
    );
    for (let slot = 0; slot < 3; slot += 1) {
      fill_rounded_rect(ctx, x - 6 + slot * 4.5, top + 2, 3, 3, 0.8, css(shade(colourValue, 0.45)));
    }
  });
  fill_rect(ctx, x - 7, y - 18, 14, 2.5, css(0xd9a35a));
}

/**
 * Paints a round red plastic stool, the hawker staple, tucked against a wall.
 *
 * @param scene - The stall scene.
 * @param x - Centre x of the base.
 * @param y - Base y.
 */
function paint_stool(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  const plastic = 0xc8402f;
  fill_ellipse(ctx, x + 2, y + 0.8, 7, 2.2, css(SHADOW_INK, 0.28));
  fill_polygon(
    ctx,
    [
      [x - 5.5, y - 9],
      [x + 5.5, y - 9],
      [x + 6.5, y],
      [x - 6.5, y],
    ],
    linear_gradient(ctx, x - 6, 0, x + 6, 0, [
      [0, tint(plastic, 0.15)],
      [1, shade(plastic, 0.3)],
    ]),
  );
  fill_ellipse(ctx, x, y - 4, 3, 2.4, css(shade(plastic, 0.45)));
  fill_ellipse(ctx, x, y - 9, 6, 2.4, css(tint(plastic, 0.2)));
  fill_ellipse(ctx, x - 1.5, y - 9.6, 2.5, 0.8, css(0xffffff, 0.35));
}

/**
 * Paints a plastic bucket with a ladle resting in it.
 *
 * @param scene - The stall scene.
 * @param x - Centre x of the base.
 * @param y - Base y.
 */
function paint_bucket(scene: StallScene, x: number, y: number): void {
  const { ctx } = scene;
  const plastic = 0x3f86b8;
  fill_ellipse(ctx, x + 1.5, y + 0.8, 6, 2, css(SHADOW_INK, 0.28));
  fill_polygon(
    ctx,
    [
      [x - 5, y - 9],
      [x + 5, y - 9],
      [x + 4, y],
      [x - 4, y],
    ],
    linear_gradient(ctx, x - 5, 0, x + 5, 0, [
      [0, tint(plastic, 0.2)],
      [1, shade(plastic, 0.3)],
    ]),
  );
  fill_ellipse(ctx, x, y - 9, 5, 1.9, css(shade(plastic, 0.35)));
  fill_ellipse(ctx, x, y - 8.6, 4, 1.3, css(0x9fc6d6, 0.8));
  line(ctx, x + 1, y - 9, x + 6, y - 17, css(STEEL_DARK), 1.2);
  stroke_arc(ctx, x, y - 9, 5.2, Math.PI * 1.05, Math.PI * 1.95, css(STEEL_DARK), 0.7);
}

/**
 * Paints the clutter that stands about the interior floor: crates, a stool or a bucket at each
 * spot, picked from the stall seed.
 *
 * @param scene - The stall scene.
 */
export function paint_clutter(scene: StallScene): void {
  scene.geo.clutter.forEach((spot, index) => {
    const kind = CLUTTER_KINDS[(scene.seed + index) % CLUTTER_KINDS.length];
    if (kind === "crates") paint_crates(scene, spot.x, spot.y);
    else if (kind === "stool") paint_stool(scene, spot.x, spot.y);
    else paint_bucket(scene, spot.x, spot.y);
  });
}
