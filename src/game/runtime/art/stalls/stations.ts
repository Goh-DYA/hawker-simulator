/**
 * The cooking stations on a stall's work bench, painted in the 3/4 oblique view: every pot, wok,
 * mortar and steamer shows its rim and contents from above and its body below, and flat equipment
 * (griddles, grills, boilers, ingredient trays, a hot plate) shows its top and a short south face.
 *
 * A station paints inside a footprint box on the bench top and may rise above it. Wide boxes
 * (benches along the back or front wall) lay their pieces out west to east; tall boxes (benches
 * along a side wall) lay them out north to south, painted back to front, so each station reads
 * at every rotation.
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
  seeded,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  tint,
} from "../canvas";
import {
  BRASS,
  CHARCOAL,
  clip_box,
  CLAY,
  EMBER,
  fill_box,
  fill_cylinder,
  fill_rect,
  FLAME,
  PORCELAIN,
  specular,
  STEEL,
  STEEL_DARK,
  TIMBER,
  TIMBER_DARK,
  VERMILION,
  type Box,
  type StallScene,
} from "./common";
import { paint_bottle, paint_claypot, paint_leaf_stack, paint_stack, paint_teapot } from "./props";

/** A point a piece stands on. */
interface Spot {
  readonly x: number;
  readonly y: number;
}

/**
 * Spreads standing spots along a box's long axis, back to front for tall boxes.
 *
 * @param box - The footprint on the bench top.
 * @param count - Number of spots.
 * @returns The spots, in paint order.
 */
function spots(box: Box, count: number): Spot[] {
  if (box.width >= box.height) {
    return Array.from({ length: count }, (_, index) => ({
      x: box.x + ((index + 0.5) * box.width) / count,
      y: box.y + box.height * 0.66,
    }));
  }
  return Array.from({ length: count }, (_, index) => ({
    x: box.x + box.width / 2,
    y: box.y + ((index + 0.75) * box.height) / count,
  }));
}

/**
 * Paints the soft shadow a piece casts on the bench top, offset to the south-east.
 *
 * @param scene - The stall scene.
 * @param x - Centre x of the piece's base.
 * @param y - Base y.
 * @param radius - Half the piece's width.
 */
function base_shadow(scene: StallScene, x: number, y: number, radius: number): void {
  fill_ellipse(
    scene.ctx,
    x + 1.5,
    y + 0.8,
    radius + 1,
    Math.max(1.2, radius * 0.35),
    css(SHADOW_INK, 0.28),
  );
}

/**
 * Paints a pot in 3/4 view: a lit cylinder body, its rim seen from above, the contents inside
 * and two side handles.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param baseY - Y the pot stands on.
 * @param radius - Half the pot's width.
 * @param height - Body height.
 * @param body - Body colour.
 * @param contents - Contents colour, or undefined for a lidded pot.
 */
function paint_pot(
  scene: StallScene,
  x: number,
  baseY: number,
  radius: number,
  height: number,
  body: number,
  contents?: number,
): void {
  const { ctx } = scene;
  const rimY = baseY - height;
  const squash = radius * 0.42;
  base_shadow(scene, x, baseY, radius);
  fill_rounded_rect(ctx, x - radius - 1.6, rimY + height * 0.3, 2.4, 2.4, 1, css(shade(body, 0.4)));
  fill_rounded_rect(ctx, x + radius - 0.8, rimY + height * 0.3, 2.4, 2.4, 1, css(shade(body, 0.4)));
  fill_ellipse(ctx, x, baseY, radius, squash, css(shade(body, 0.35)));
  fill_cylinder(ctx, x - radius, rimY, radius * 2, height, 0.5, body);
  fill_ellipse(ctx, x, rimY, radius, squash, css(tint(body, 0.35)));
  if (contents === undefined) {
    fill_ellipse(ctx, x, rimY - 0.6, radius - 0.6, squash - 0.3, css(tint(body, 0.12)));
    fill_circle(ctx, x, rimY - 1.6, 1.4, css(shade(body, 0.4)));
  } else {
    fill_ellipse(ctx, x, rimY + 0.3, radius - 1.1, squash - 0.6, css(contents));
    fill_ellipse(ctx, x - radius * 0.3, rimY, radius * 0.3, squash * 0.3, css(0xffffff, 0.22));
  }
  specular(ctx, x - radius + 1.2, rimY + 1, height - 2, 0.4);
}

/**
 * Paints a gas ring seen from above with blue-and-orange flames.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Centre y.
 * @param radius - Ring radius.
 */
function paint_burner(scene: StallScene, x: number, y: number, radius: number): void {
  const { ctx, isLowDetail, spec } = scene;
  fill_ellipse(ctx, x, y, radius + 1.5, (radius + 1.5) * 0.45, css(CHARCOAL));
  stroke_ellipse(ctx, x, y, radius, radius * 0.45, css(STEEL_DARK), 1);
  if (!spec.isOpen) return;
  if (!isLowDetail) glow(ctx, x, y, radius * 1.8, FLAME, 0.45);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const fx = x + Math.cos(angle) * radius;
    const fy = y + Math.sin(angle) * radius * 0.45;
    fill_polygon(
      ctx,
      [
        [fx - 1.2, fy],
        [fx, fy - 3 - (index % 2) * 1.5],
        [fx + 1.2, fy],
      ],
      css(index % 2 === 0 ? 0x6ea8ff : FLAME, 0.9),
    );
  }
}

/**
 * Paints a wok seen from above: a dark seasoned bowl, its sheen, the food tossed in it and the
 * long handle.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Centre y of the rim.
 * @param radius - Rim radius.
 * @param food - Colour of the food in the wok.
 */
function paint_wok(scene: StallScene, x: number, y: number, radius: number, food: number): void {
  const { ctx } = scene;
  fill_rounded_rect(ctx, x + radius - 1, y - 1.4, 9, 2.6, 1.2, css(TIMBER_DARK));
  fill_ellipse(
    ctx,
    x,
    y,
    radius,
    radius * 0.55,
    radial_gradient(ctx, x - radius * 0.3, y - radius * 0.2, 0, radius * 1.1, [
      [0, 0x56605e],
      [1, CHARCOAL],
    ]),
  );
  stroke_ellipse(ctx, x, y, radius, radius * 0.55, css(0x8b9592), 0.8);
  const next = seeded(Math.round(x * 13 + y * 7));
  for (let index = 0; index < 7; index += 1) {
    const fx = x + (next() - 0.5) * radius;
    const fy = y + (next() - 0.4) * radius * 0.45;
    fill_ellipse(ctx, fx, fy, 1.8 + next(), 1, css(index % 3 === 0 ? 0x8bb06a : food));
  }
  fill_ellipse(
    ctx,
    x - radius * 0.45,
    y - radius * 0.25,
    radius * 0.25,
    radius * 0.1,
    css(0xffffff, 0.3),
  );
}

/**
 * Paints a flat slab of equipment on the bench: its top seen from above and a short south face.
 *
 * @param scene - The stall scene.
 * @param box - The slab's top surface.
 * @param face - Height of its south face.
 * @param top - Top colour.
 * @param side - Face colour.
 */
function paint_block(scene: StallScene, box: Box, face: number, top: number, side: number): void {
  const { ctx } = scene;
  fill_rect(ctx, box.x + 2, box.y + box.height + face - 1, box.width, 2, css(SHADOW_INK, 0.25));
  fill_rect(
    ctx,
    box.x,
    box.y + box.height,
    box.width,
    face,
    linear_gradient(ctx, box.x, 0, box.x + box.width, 0, [
      [0, tint(side, 0.1)],
      [1, shade(side, 0.2)],
    ]),
  );
  fill_box(
    ctx,
    box,
    linear_gradient(ctx, box.x, box.y, box.x + box.width * 0.4, box.y + box.height, [
      [0, tint(top, 0.15)],
      [1, shade(top, 0.08)],
    ]),
  );
  fill_rect(ctx, box.x, box.y, box.width, 0.8, css(0xffffff, 0.3));
}

/**
 * Insets a box on every side.
 *
 * @param box - The box.
 * @param amount - Inset in pixels.
 * @returns The smaller box.
 */
function inset(box: Box, amount: number): Box {
  return {
    x: box.x + amount,
    y: box.y + amount,
    width: Math.max(2, box.width - amount * 2),
    height: Math.max(2, box.height - amount * 2),
  };
}

/**
 * Lifts a footprint box so the equipment standing on it shows a south face below its top.
 *
 * @param box - The footprint on the bench top.
 * @param lift - How far the top is raised.
 * @returns The top surface box.
 */
function lifted(box: Box, lift: number): Box {
  return { x: box.x, y: box.y - lift, width: box.width, height: box.height };
}

/**
 * Chopping block with poached chicken, cleaver and dipping sauces (the chicken rice stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_chopping_block(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const isWide = box.width >= box.height;
  const block: Box = isWide
    ? { x: box.x, y: box.y + 1, width: Math.min(26, box.width * 0.55), height: box.height - 2 }
    : { x: box.x + 1, y: box.y, width: box.width - 2, height: Math.min(22, box.height * 0.55) };
  const top = lifted(block, 4);
  paint_block(scene, top, 4, 0xc49a62, 0x8a5b33);
  stroke_ellipse(
    ctx,
    top.x + top.width / 2,
    top.y + top.height / 2,
    top.width * 0.3,
    top.height * 0.3,
    css(0x8a5b33, 0.4),
    0.6,
  );
  // Sliced chicken fanned on the board and the cleaver beside it.
  for (let index = 0; index < 4; index += 1) {
    fill_ellipse(ctx, top.x + 5 + index * 2.6, top.y + top.height * 0.5, 2.2, 1.4, css(0xf1e0b5));
  }
  fill_rect(ctx, top.x + top.width - 9, top.y + 1.5, 6, 3.4, css(STEEL));
  fill_rect(ctx, top.x + top.width - 9, top.y + 1.5, 6, 0.8, css(0xffffff, 0.6));
  fill_rect(ctx, top.x + top.width - 3, top.y + 2.4, 3, 1.6, css(TIMBER_DARK));
  // Dips: chilli, ginger and dark soy.
  const rest = isWide
    ? {
        x: block.x + block.width + 3,
        y: box.y,
        width: box.width - block.width - 3,
        height: box.height,
      }
    : {
        x: box.x,
        y: block.y + block.height + 3,
        width: box.width,
        height: box.height - block.height - 3,
      };
  spots(rest, 3).forEach((spot, index) => {
    paint_pot(scene, spot.x, spot.y, 3.6, 2.6, PORCELAIN, [0xd9452f, 0xe9d36a, 0x3b2a22][index]);
  });
}

/**
 * A row of gravy pots with red, yellow, green and rendang curries (the Malay rice stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_gravy_pots(scene: StallScene, box: Box): void {
  const gravies = [0xc0452f, 0xd9a13a, 0x7a9a4a, 0x6b3a22];
  const count = box.width >= box.height ? Math.max(2, Math.min(4, Math.floor(box.width / 14))) : 3;
  spots(box, count).forEach((spot, index) => {
    paint_pot(scene, spot.x, spot.y, 5.6, 6, STEEL, gravies[index % gravies.length]);
    line(scene.ctx, spot.x + 1, spot.y - 6, spot.x + 4, spot.y - 13, css(STEEL_DARK), 1);
  });
}

/**
 * Two long-spout kettles on a gas ring (the kopi stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_kettles(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  spots(box, 2).forEach((spot, index) => {
    paint_burner(scene, spot.x, spot.y - 1, 4.5);
    const body = index === 0 ? STEEL : 0xd8c9a3;
    paint_pot(scene, spot.x, spot.y - 1, 4.6, 7, body);
    ctx.beginPath();
    ctx.moveTo(spot.x - 4, spot.y - 4);
    ctx.quadraticCurveTo(spot.x - 10, spot.y - 6, spot.x - 11, spot.y - 14);
    ctx.strokeStyle = css(shade(body, 0.3));
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.stroke();
    line(ctx, spot.x - 3, spot.y - 10, spot.x + 3, spot.y - 10, css(0x3b2a22), 1.4);
  });
}

/**
 * A wok on a roaring burner with a ladle and sauce cups (the zi char stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_wok_station(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const isWide = box.width >= box.height;
  const x = isWide ? box.x + Math.min(16, box.width * 0.32) : box.x + box.width / 2;
  const y = isWide ? box.y + box.height * 0.5 : box.y + Math.min(14, box.height * 0.32);
  paint_burner(scene, x, y + 1.5, 8);
  paint_wok(scene, x, y - 1.5, 9, 0xd9a35a);
  line(ctx, x + 2, y - 2, x + 9, y - 12, css(STEEL_DARK), 1.4);
  fill_ellipse(ctx, x + 2, y - 2, 2.4, 1.2, css(STEEL));
  const rest = isWide
    ? { x: x + 14, y: box.y, width: box.x + box.width - x - 14, height: box.height }
    : { x: box.x, y: y + 12, width: box.width, height: box.y + box.height - y - 12 };
  if (rest.width > 6 && rest.height > 4) {
    spots(rest, 3).forEach((spot, index) => {
      paint_pot(scene, spot.x, spot.y, 3.4, 2.6, PORCELAIN, [0x3b2a22, 0xc8452f, 0xe9d36a][index]);
    });
  }
}

/**
 * A steel noodle boiler with a steaming well and wire baskets (the mee pok stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_noodle_boiler(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const top = lifted(inset(box, 1), 6);
  paint_block(scene, top, 6, STEEL, STEEL_DARK);
  const well = inset(top, 2);
  fill_box(
    ctx,
    well,
    linear_gradient(ctx, 0, well.y, 0, well.y + well.height, [
      [0, 0x7fa8b0],
      [1, 0xbfdde0],
    ]),
  );
  const isWide = box.width >= box.height;
  spots(well, isWide ? 3 : 2).forEach((spot) => {
    stroke_ellipse(ctx, spot.x, spot.y - 1, 3, 1.6, css(STEEL_DARK), 0.9);
    fill_ellipse(ctx, spot.x, spot.y - 1, 2.4, 1.1, css(0xe9cf7a, 0.9));
    line(ctx, spot.x + 2.5, spot.y - 1.5, spot.x + 3, spot.y - 9, css(TIMBER), 1.3);
  });
}

/**
 * A flat griddle with prata frying on it and an oil cup (the Indian-Muslim stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_griddle(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const top = lifted(inset(box, 0.5), 5);
  paint_block(scene, top, 5, 0x3a3f3d, 0x2a2e2d);
  if (scene.spec.isOpen && !scene.isLowDetail) {
    glow(ctx, top.x + top.width / 2, top.y + top.height + 4, top.width * 0.4, FLAME, 0.3);
  }
  spots(inset(top, 1), box.width >= box.height ? 3 : 2).forEach((spot, index) => {
    fill_ellipse(ctx, spot.x, spot.y - 1.5, 4.6, 2.4, css(index === 1 ? 0xe2b664 : 0xd59f4a));
    stroke_ellipse(ctx, spot.x, spot.y - 1.5, 3, 1.4, css(0xa86f2c, 0.6), 0.6);
  });
  paint_pot(scene, top.x + top.width - 3, top.y + 2, 2.4, 3, STEEL, 0xe8c55a);
}

/**
 * An ice shaver with its hopper and a bowl of shaved ice under coloured syrups (the dessert
 * stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_ice_shaver(scene: StallScene, box: Box): void {
  const { ctx, spec } = scene;
  const [machine, bowl] = spots(box, 2) as [Spot, Spot];
  base_shadow(scene, machine.x, machine.y, 6);
  fill_rounded_rect(ctx, machine.x - 6, machine.y - 5, 12, 5, 1.5, css(shade(spec.primary, 0.1)));
  fill_rect(ctx, machine.x + 3, machine.y - 20, 3, 16, css(STEEL));
  fill_cylinder(ctx, machine.x - 5, machine.y - 21, 10, 7, 2, STEEL);
  fill_ellipse(ctx, machine.x, machine.y - 21, 5, 1.8, css(0xe9f6fb));
  fill_rect(ctx, machine.x - 3, machine.y - 24, 6, 3, css(0xdff2f8, 0.9));
  fill_ellipse(ctx, machine.x, machine.y - 7, 3.5, 1.3, css(PORCELAIN));
  base_shadow(scene, bowl.x, bowl.y, 5);
  fill_ellipse(ctx, bowl.x, bowl.y - 1.5, 5, 2.2, css(PORCELAIN));
  fill_ellipse(ctx, bowl.x, bowl.y - 4, 4.2, 4, css(0xf6fbfd));
  fill_ellipse(ctx, bowl.x - 1.5, bowl.y - 6, 2.2, 1.5, css(0xd94b6a));
  fill_ellipse(ctx, bowl.x + 1.6, bowl.y - 5, 2, 1.4, css(0x8bc26a));
  fill_ellipse(ctx, bowl.x, bowl.y - 3.2, 2, 1, css(0x8a5b3a));
}

/**
 * A charcoal trough grill with glowing embers and rows of satay skewers (the satay stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_charcoal_grill(scene: StallScene, box: Box): void {
  const { ctx, spec, isLowDetail } = scene;
  const top = lifted(inset(box, 0.5), 5);
  paint_block(scene, top, 5, 0x3c3330, 0x4a4542);
  const bed = inset(top, 1.5);
  const next = seeded(scene.seed ^ 0x5a7e);
  fill_box(ctx, bed, css(0x2a2220));
  for (let index = 0; index < Math.round((bed.width * bed.height) / 6); index += 1) {
    fill_circle(
      ctx,
      bed.x + next() * bed.width,
      bed.y + next() * bed.height,
      0.9 + next() * 0.8,
      css(spec.isOpen ? EMBER : 0x5a4a44, 0.6 + next() * 0.4),
    );
  }
  if (spec.isOpen && !isLowDetail)
    glow(
      ctx,
      bed.x + bed.width / 2,
      bed.y + bed.height / 2,
      Math.max(bed.width, bed.height) * 0.5,
      EMBER,
      0.32,
    );
  const isWide = box.width >= box.height;
  ctx.save();
  clip_box(ctx, { x: top.x - 3, y: top.y - 3, width: top.width + 6, height: top.height + 6 });
  if (isWide) {
    for (let x = bed.x + 1.5; x < bed.x + bed.width; x += 3) {
      line(ctx, x, top.y - 2, x, top.y + top.height + 1, css(0xd9c49a), 0.6);
      fill_rounded_rect(ctx, x - 1.1, bed.y + 0.5, 2.2, bed.height * 0.6, 1, css(0x9a4a22));
    }
  } else {
    for (let y = bed.y + 1.5; y < bed.y + bed.height; y += 3) {
      line(ctx, top.x - 2, y, top.x + top.width + 1, y, css(0xd9c49a), 0.6);
      fill_rounded_rect(ctx, bed.x + 0.5, y - 1.1, bed.width * 0.6, 2.2, 1, css(0x9a4a22));
    }
  }
  ctx.restore();
}

/**
 * Trays of yong tau foo pieces to pick from: tofu, fishballs, greens, chillies and fried
 * beancurd (the pick-and-mix stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_ingredient_trays(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const items = [0xf3ead2, 0xe9c06a, 0x6f9e4f, 0xd94b3a, 0xb07a3a, 0xf6f2ea];
  const isWide = box.width >= box.height;
  const columns = isWide ? Math.max(2, Math.floor(box.width / 9)) : 2;
  const rows = isWide ? 1 : Math.max(2, Math.floor(box.height / 9));
  const cellWidth = box.width / columns;
  const cellHeight = box.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cell: Box = {
        x: box.x + column * cellWidth + 0.5,
        y: box.y + row * cellHeight - 3,
        width: cellWidth - 1,
        height: cellHeight - 0.5,
      };
      paint_block(scene, cell, 2, STEEL, STEEL_DARK);
      const colourValue = items[(row * columns + column) % items.length] as number;
      for (let piece = 0; piece < 3; piece += 1) {
        fill_ellipse(
          ctx,
          cell.x + cell.width * (0.3 + piece * 0.2),
          cell.y + cell.height * (0.4 + (piece % 2) * 0.25),
          Math.min(2.2, cell.width * 0.22),
          1.4,
          css(colourValue),
        );
      }
    }
  }
}

/**
 * A large round dosa griddle with a crisp dosa and a pot of sambar (the South Indian stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_dosa_griddle(scene: StallScene, box: Box): void {
  const { ctx, spec, isLowDetail } = scene;
  const isWide = box.width >= box.height;
  const radius = Math.min(12, (isWide ? box.width * 0.32 : box.width * 0.5) - 0.5);
  const x = isWide ? box.x + radius + 1 : box.x + box.width / 2;
  const y = isWide ? box.y + box.height * 0.55 : box.y + radius * 0.6 + 2;
  base_shadow(scene, x, y + 2, radius);
  fill_ellipse(ctx, x, y + 1.5, radius, radius * 0.45, css(0x252a29));
  fill_ellipse(
    ctx,
    x,
    y,
    radius,
    radius * 0.45,
    radial_gradient(ctx, x - radius * 0.3, y - 1, 0, radius, [
      [0, 0x5a615f],
      [1, 0x2b302f],
    ]),
  );
  if (spec.isOpen && !isLowDetail) glow(ctx, x, y + 3, radius * 1.1, FLAME, 0.25);
  // A thin golden dosa rolled across the griddle.
  fill_ellipse(ctx, x, y, radius * 0.75, radius * 0.3, css(0xd9a04a));
  fill_rounded_rect(ctx, x - radius * 0.7, y - 1.6, radius * 1.4, 3.2, 1.6, css(0xc4862f));
  fill_rect(ctx, x - radius * 0.6, y - 1.4, radius * 1.2, 0.8, css(0xffffff, 0.3));
  const potSpot = isWide
    ? { x: x + radius + 7, y: box.y + box.height * 0.66 }
    : { x, y: y + radius * 0.6 + 9 };
  paint_pot(scene, potSpot.x, potSpot.y, 5, 5.5, BRASS, 0xc0672f);
}

/**
 * Stacks of bamboo steamers over a steamer pot (the dim sum stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_steamer_tower(scene: StallScene, box: Box): void {
  const isWide = box.width >= box.height;
  spots(box, isWide ? 2 : 2).forEach((spot, index) => {
    paint_pot(scene, spot.x, spot.y, 7.5, 4, STEEL);
    paint_steamer_stack(scene, spot.x, spot.y - 4, 7, scene.geo.isDeep ? 4 - index : 3 - index);
  });
}

/**
 * Paints a stack of bamboo steamers with a woven lid.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param baseY - Y the stack stands on.
 * @param radius - Steamer radius.
 * @param tiers - Steamers in the stack.
 */
function paint_steamer_stack(
  scene: StallScene,
  x: number,
  baseY: number,
  radius: number,
  tiers: number,
): void {
  const { ctx } = scene;
  const tierHeight = 3.6;
  for (let tier = 0; tier < tiers; tier += 1) {
    const y = baseY - (tier + 1) * tierHeight;
    const colourValue = tier % 2 === 0 ? 0xc89b58 : 0xdaaf68;
    fill_rect(
      ctx,
      x - radius,
      y,
      radius * 2,
      tierHeight,
      linear_gradient(ctx, x - radius, 0, x + radius, 0, [
        [0, tint(colourValue, 0.25)],
        [1, shade(colourValue, 0.28)],
      ]),
    );
    fill_rect(ctx, x - radius, y + tierHeight - 0.8, radius * 2, 0.8, css(0x815f36, 0.8));
  }
  const top = baseY - tiers * tierHeight;
  fill_ellipse(ctx, x, top, radius, radius * 0.42, css(0xdaaf68));
  stroke_ellipse(ctx, x, top, radius * 0.7, radius * 0.28, css(0x815f36, 0.4), 0.7);
  stroke_ellipse(ctx, x, top, radius * 0.4, radius * 0.16, css(0x815f36, 0.4), 0.7);
}

/**
 * A brick charcoal hearth with claypots simmering on it (the Peranakan stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_claypot_hearth(scene: StallScene, box: Box): void {
  const { ctx, spec, isLowDetail } = scene;
  const top = lifted(inset(box, 0.5), 6);
  paint_block(scene, top, 6, 0x6a5148, CLAY);
  // Brick coursing on the hearth's face and the fire mouths.
  const faceY = top.y + top.height;
  for (let y = faceY + 2; y < faceY + 6; y += 2)
    fill_rect(ctx, top.x, y, top.width, 0.5, css(0xe9dcc4, 0.4));
  spots(inset(top, 1), box.width >= box.height ? 2 : 2).forEach((spot) => {
    fill_rounded_rect(
      ctx,
      spot.x - 2.5,
      faceY + 1.5,
      5,
      3.5,
      1.5,
      css(spec.isOpen ? EMBER : CHARCOAL),
    );
    if (spec.isOpen && !isLowDetail) glow(ctx, spot.x, faceY + 3, 6, EMBER, 0.4);
    paint_claypot(scene, spot.x, spot.y + 1, 5);
  });
}

/**
 * A great black cauldron of herbal soup on a brick stove (the herbal stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_cauldron(scene: StallScene, box: Box): void {
  const { ctx, spec, isLowDetail } = scene;
  const isWide = box.width >= box.height;
  const radius = Math.min(11, (isWide ? box.width * 0.3 : box.width * 0.5) - 0.5);
  const x = isWide ? box.x + radius + 2 : box.x + box.width / 2;
  const baseY = isWide ? box.y + box.height * 0.8 : box.y + radius + 6;
  const stove: Box = { x: x - radius - 1, y: baseY - 6, width: radius * 2 + 2, height: 4 };
  paint_block(scene, stove, 4, 0x7a4e36, 0x8c5a3c);
  if (spec.isOpen) {
    fill_rounded_rect(ctx, x - 3, stove.y + 4.8, 6, 2.6, 1, css(EMBER));
    if (!isLowDetail) glow(ctx, x, stove.y + 6, 7, EMBER, 0.4);
  }
  paint_pot(scene, x, stove.y + 1, radius, 7, 0x2f3332, 0x3d2418);
  line(ctx, x + 2, stove.y - 6, x + radius, stove.y - 14, css(TIMBER_DARK), 1.4);
  const rest = isWide
    ? { x: x + radius + 4, y: box.y, width: box.x + box.width - x - radius - 4, height: box.height }
    : { x: box.x, y: baseY + 4, width: box.width, height: box.y + box.height - baseY - 4 };
  if (rest.width > 6 && rest.height > 4) {
    spots(rest, 2).forEach((spot) => paint_pot(scene, spot.x, spot.y, 3, 2.6, PORCELAIN, 0x5a3a26));
  }
}

/**
 * A grill grate with whole fish and lime halves (the seafood stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_fish_grill(scene: StallScene, box: Box): void {
  const { ctx, spec, isLowDetail } = scene;
  const top = lifted(inset(box, 0.5), 5);
  paint_block(scene, top, 5, 0x3a3f3d, 0x4c5250);
  if (spec.isOpen && !isLowDetail)
    glow(
      ctx,
      top.x + top.width / 2,
      top.y + top.height / 2,
      Math.max(top.width, top.height) * 0.45,
      EMBER,
      0.25,
    );
  const isWide = box.width >= box.height;
  ctx.save();
  clip_box(ctx, top);
  if (isWide) {
    for (let y = top.y + 1.5; y < top.y + top.height; y += 2)
      fill_rect(ctx, top.x, y, top.width, 0.6, css(0x8b9592));
  } else {
    for (let x = top.x + 1.5; x < top.x + top.width; x += 2)
      fill_rect(ctx, x, top.y, 0.6, top.height, css(0x8b9592));
  }
  ctx.restore();
  spots(inset(top, 1), 2).forEach((spot) => {
    const length = isWide ? Math.min(9, box.width * 0.18) : Math.min(8, box.width * 0.38);
    fill_ellipse(ctx, spot.x, spot.y - 2, length, 2.2, css(0xb98a52));
    fill_polygon(
      ctx,
      [
        [spot.x + length - 1, spot.y - 2],
        [spot.x + length + 3, spot.y - 4.5],
        [spot.x + length + 3, spot.y + 0.5],
      ],
      css(0x9a6e3e),
    );
    for (let mark = -1; mark <= 1; mark += 1) {
      line(
        ctx,
        spot.x + mark * 3 - 1,
        spot.y - 3.5,
        spot.x + mark * 3 + 1,
        spot.y - 0.5,
        css(0x5a3a22, 0.7),
        0.7,
      );
    }
    fill_circle(ctx, spot.x - length + 1.5, spot.y - 2.5, 0.6, css(CHARCOAL));
  });
  fill_circle(ctx, top.x + top.width - 3, top.y + 2, 1.6, css(0x8bc34a));
}

/**
 * Paints the stall's cooking station inside its footprint on the bench top.
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
export function paint_station(scene: StallScene, box: Box): void {
  switch (scene.dressing.station) {
    case "chopping-block":
      paint_chopping_block(scene, box);
      return;
    case "gravy-pots":
      paint_gravy_pots(scene, box);
      return;
    case "kettles":
      paint_kettles(scene, box);
      return;
    case "wok":
      paint_wok_station(scene, box);
      return;
    case "noodle-boiler":
      paint_noodle_boiler(scene, box);
      return;
    case "griddle":
      paint_griddle(scene, box);
      return;
    case "ice-shaver":
      paint_ice_shaver(scene, box);
      return;
    case "charcoal-grill":
      paint_charcoal_grill(scene, box);
      return;
    case "ingredient-trays":
      paint_ingredient_trays(scene, box);
      return;
    case "dosa-griddle":
      paint_dosa_griddle(scene, box);
      return;
    case "steamer-tower":
      paint_steamer_tower(scene, box);
      return;
    case "claypot-hearth":
      paint_claypot_hearth(scene, box);
      return;
    case "cauldron":
      paint_cauldron(scene, box);
      return;
    case "fish-grill":
      paint_fish_grill(scene, box);
      return;
    case "congee-pot":
      paint_congee_pot(scene, box);
      return;
    case "dessert-pots":
      paint_dessert_pots(scene, box);
      return;
    case "sambal-mortar":
      paint_sambal_mortar(scene, box);
      return;
    case "hot-plate":
      paint_hot_plate(scene, box);
      return;
  }
}

/**
 * A tall pot of white rice porridge on a gas ring with a long wooden paddle (the porridge stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_congee_pot(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const isWide = box.width >= box.height;
  const radius = Math.min(10, (isWide ? box.width * 0.28 : box.width * 0.48) - 0.5);
  const x = isWide ? box.x + radius + 2 : box.x + box.width / 2;
  const baseY = isWide ? box.y + box.height * 0.85 : box.y + radius + 8;
  paint_burner(scene, x, baseY - 1, radius - 2);
  paint_pot(scene, x, baseY - 1, radius, 10, 0xc9cfcd, 0xf1e9d6);
  line(ctx, x - 2, baseY - 12, x + radius + 3, baseY - 24, css(TIMBER), 1.8);
  const rest = isWide
    ? { x: x + radius + 4, y: box.y, width: box.x + box.width - x - radius - 4, height: box.height }
    : { x: box.x, y: baseY + 4, width: box.width, height: box.y + box.height - baseY - 4 };
  if (rest.width > 6 && rest.height > 4) {
    spots(rest, 2).forEach((spot) => paint_pot(scene, spot.x, spot.y, 3.4, 3, PORCELAIN, 0xf1e9d6));
  }
}

/**
 * Three lidded pots of hot sweet soup (two on a side bench) in a steel water bath, the first one
 * open (the dessert soup stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_dessert_pots(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const bath = lifted(inset(box, 0.5), 2);
  paint_block(scene, bath, 3, STEEL, STEEL_DARK);
  const soups = [0x8e6a9b, 0xe9dcb2, 0x2e2a28];
  const count = box.width >= box.height ? 3 : 2;
  spots(inset(bath, 1), count).forEach((spot, index) => {
    paint_pot(scene, spot.x, spot.y + 1, 5, 6, 0xc9cfcd, index === 0 ? soups[0] : undefined);
    if (index === 0) {
      fill_ellipse(ctx, spot.x + 5, spot.y - 6.5, 3.4, 1.4, css(tint(0xc9cfcd, 0.2)));
    }
    if (index > 0) {
      fill_ellipse(ctx, spot.x - 2, spot.y - 5.5, 1.2, 0.6, css(soups[index] as number, 0.8));
    }
  });
}

/**
 * A granite mortar of red sambal with its pestle beside a kuali of frying chicken (the warung).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_sambal_mortar(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const [mortar, kuali] = spots(box, 2) as [Spot, Spot];
  base_shadow(scene, mortar.x, mortar.y, 6);
  fill_ellipse(ctx, mortar.x, mortar.y - 1.5, 6.5, 3.4, css(0x6f6e6a));
  fill_ellipse(ctx, mortar.x, mortar.y - 3, 6.5, 3.2, css(0x8d8b85));
  fill_ellipse(ctx, mortar.x, mortar.y - 3, 4.6, 2.2, css(0xb5342a));
  line(ctx, mortar.x + 1, mortar.y - 3.5, mortar.x + 6, mortar.y - 11, css(0x5f5e5a), 2.6);
  paint_burner(scene, kuali.x, kuali.y, 5);
  paint_wok(scene, kuali.x, kuali.y - 1, 7, 0xc98a3c);
}

/**
 * A steel flat-top with chops searing and two cast-iron sizzle plates on timber boards (the hawker
 * Western stall).
 *
 * @param scene - The stall scene.
 * @param box - The station footprint.
 */
function paint_hot_plate(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const top = lifted(inset(box, 0.5), 5);
  paint_block(scene, top, 5, 0x9aa3a1, 0x5d6563);
  if (scene.spec.isOpen && !scene.isLowDetail) {
    glow(ctx, top.x + top.width / 2, top.y + top.height + 4, top.width * 0.4, FLAME, 0.25);
  }
  spots(inset(top, 1), 2).forEach((spot, index) => {
    fill_ellipse(ctx, spot.x, spot.y, 6.2, 3.4, css(TIMBER));
    fill_ellipse(ctx, spot.x, spot.y - 0.8, 5.2, 2.7, css(CHARCOAL));
    fill_ellipse(ctx, spot.x - 1, spot.y - 1.2, 3, 1.6, css(index === 0 ? 0x8a5a2b : 0xd9a441));
    fill_ellipse(ctx, spot.x + 2.2, spot.y - 0.8, 1.6, 1, css(0xe8c46a));
  });
}

/**
 * Paints the side piece beside the station: a rice warmer, a stock pot, bowls, sauces, a
 * teapot, a tea urn, banana leaves, noodle portions, syrups, a claypot, peanut sauce, a small
 * steamer stack, a tray of fried dough sticks or a deep fryer.
 *
 * @param scene - The stall scene.
 * @param box - The side piece's footprint on the bench top.
 */
export function paint_side_piece(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  const isWide = box.width >= box.height;
  const centre = {
    x: box.x + box.width / 2,
    y: isWide ? box.y + box.height * 0.7 : box.y + box.height * 0.7,
  };
  switch (scene.dressing.side) {
    case "rice-pot":
      paint_pot(scene, centre.x, centre.y, 7, 8, 0xe7e2d6);
      fill_rect(ctx, centre.x - 7, centre.y - 5, 14, 1.4, css(VERMILION, 0.8));
      return;
    case "stock-pot":
      paint_pot(scene, centre.x, centre.y, 7, 8, STEEL, 0xe6d3a3);
      return;
    case "bowls":
      spots(box, 2).forEach((spot) => paint_stack(scene, spot.x, spot.y, 4, 9));
      return;
    case "bottles":
      spots(box, 3).forEach((spot, index) => {
        paint_bottle(
          scene,
          spot.x,
          spot.y,
          [0x9f2f2a, 0x3b2a22, 0xd9a13a][index] as number,
          10 + index,
        );
      });
      return;
    case "teapot":
      paint_teapot(scene, centre.x - 3, centre.y, 0x2a9d8f);
      paint_stack(scene, centre.x + 7, centre.y, 3, 6, PORCELAIN, 0x2a9d8f);
      return;
    case "urn":
      base_shadow(scene, centre.x, centre.y, 6);
      fill_cylinder(ctx, centre.x - 6, centre.y - 18, 12, 18, 3, STEEL);
      fill_ellipse(ctx, centre.x, centre.y - 18, 6, 2.2, css(tint(STEEL, 0.4)));
      fill_circle(ctx, centre.x, centre.y - 19.5, 1.4, css(CHARCOAL));
      fill_rounded_rect(ctx, centre.x - 1.5, centre.y - 6, 3, 3, 1, css(BRASS));
      specular(ctx, centre.x - 4.5, centre.y - 16, 13, 0.5);
      return;
    case "leaf-stack":
      paint_leaf_stack(scene, centre.x, centre.y, Math.min(18, box.width - 2));
      return;
    case "noodles":
      paint_block(scene, lifted(inset(box, 1), 2), 2, STEEL, STEEL_DARK);
      spots(inset(box, 2), 3).forEach((spot) => {
        fill_ellipse(ctx, spot.x, spot.y - 3, 3.2, 1.8, css(0xe9cf7a));
        stroke_ellipse(ctx, spot.x, spot.y - 3, 2, 1, css(0xc9a94a), 0.6);
      });
      return;
    case "syrups":
      spots(box, 3).forEach((spot, index) => {
        paint_bottle(scene, spot.x, spot.y, [0xd94b6a, 0x6fae4a, 0x8a5b3a][index] as number, 11);
      });
      return;
    case "claypot":
      paint_claypot(scene, centre.x, centre.y, 5.5);
      return;
    case "peanut-pot":
      paint_pot(scene, centre.x, centre.y, 6.5, 6, STEEL, 0xb0602c);
      fill_circle(ctx, centre.x - 1.5, centre.y - 6, 0.8, css(0xd9a35a));
      fill_circle(ctx, centre.x + 2, centre.y - 5.6, 0.8, css(0xd9a35a));
      return;
    case "steamers":
      paint_steamer_stack(scene, centre.x, centre.y, 6, 2);
      return;
    case "dough-sticks":
      fill_rounded_rect(ctx, centre.x - 7, centre.y - 4, 14, 5, 1, css(STEEL));
      for (const dy of [-3.2, -1.6]) {
        fill_rounded_rect(ctx, centre.x - 6, centre.y + dy - 1, 12, 1.6, 0.8, css(0xc98a3c));
        line(
          ctx,
          centre.x - 5,
          centre.y + dy - 0.3,
          centre.x + 5,
          centre.y + dy - 0.3,
          css(0xe6b868),
          0.5,
        );
      }
      return;
    case "fryer":
      paint_block(scene, lifted(inset(box, 1), 3), 4, STEEL, STEEL_DARK);
      fill_rounded_rect(ctx, centre.x - 5, centre.y - 6, 10, 4, 1, css(0xc7922f));
      for (let dx = -4; dx <= 3; dx += 1.6) {
        line(
          ctx,
          centre.x + dx,
          centre.y - 6,
          centre.x + dx + 0.6,
          centre.y - 3,
          css(0xf0cf6e),
          0.8,
        );
      }
      line(ctx, centre.x + 5, centre.y - 5, centre.x + 9, centre.y - 9, css(CHARCOAL), 1.2);
      return;
  }
}
