/**
 * Everything outside the hall: the concrete apron with its saw-cut expansion joints and
 * aggregate, the grated drain channel that rings the walls, the kerb, and the raised planter
 * beds along the edge of the texture with bougainvillea, ixora and pandan.
 *
 * The planters are seen in 3/4 like everything else: a lit rim around the soil, a south face
 * below the bed, and plants that rise upwards from their roots.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_rounded_rect,
  linear_gradient,
  radial_gradient,
  seeded,
  shade,
  speckle,
  TILE,
  tint,
  type PaintContext,
} from "../canvas";
import { FLOOR_MARGIN, type PaintFrame } from "../specs";
import { BLOOMS, CONCRETE, DRAIN_WIDTH, LEAF, SHADOW, SOIL, ZINC, type FloorGrid } from "./layout";

/** Spacing of the apron's saw-cut joints: every two tiles. */
const JOINT_SPACING = TILE * 2;
/** Depth of a planter bed's soil-and-rim top. */
const BED_DEPTH = 16;
/** Height of a planter's south face. */
const BED_FACE = 7;
/** Inset of the planter beds from the texture edge. */
const BED_INSET = 6;
/** Distance between plants along a bed. */
const PLANT_PITCH = 15;

/** A rectangle in texture pixels. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Paints the concrete apron over the whole texture: base, aggregate, faint stains and the
 * saw-cut joints aligned with the hall grid.
 *
 * @param ctx - The paint context.
 * @param width - Texture width.
 * @param height - Texture height.
 * @param frame - The paint frame.
 * @param seed - Seed for the aggregate and stains.
 */
export function paint_apron(
  ctx: PaintContext,
  width: number,
  height: number,
  frame: PaintFrame,
  seed: number,
): void {
  const base = frame.isHighContrast ? shade(CONCRETE, 0.12) : CONCRETE;
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, width, height);
  const area = width * height;
  speckle(
    ctx,
    0,
    0,
    width,
    height,
    Math.round(area / (frame.isLowDetail ? 1800 : 480)),
    [shade(base, 0.14), tint(base, 0.2), shade(base, 0.06)],
    seed,
    1.3,
  );
  if (!frame.isLowDetail) {
    const next = seeded(seed ^ 0x2f1d);
    const stains = Math.max(4, Math.round(area / 60000));
    for (let index = 0; index < stains; index += 1) {
      const stain_x = next() * width;
      const stain_y = next() * height;
      const radius = 18 + next() * 30;
      fill_circle(
        ctx,
        stain_x,
        stain_y,
        radius,
        radial_gradient(ctx, stain_x, stain_y, 0, radius, [
          [0, SHADOW, 0.06],
          [1, SHADOW, 0],
        ]),
      );
    }
  }
  const joint = css(shade(base, 0.32), 0.55);
  const lip = css(tint(base, 0.3), 0.5);
  const offset = FLOOR_MARGIN % JOINT_SPACING;
  for (let x = offset; x < width; x += JOINT_SPACING) {
    ctx.fillStyle = joint;
    ctx.fillRect(x - 0.5, 0, 1, height);
    ctx.fillStyle = lip;
    ctx.fillRect(x + 0.5, 0, 1, height);
  }
  for (let y = offset; y < height; y += JOINT_SPACING) {
    ctx.fillStyle = joint;
    ctx.fillRect(0, y - 0.5, width, 1);
    ctx.fillStyle = lip;
    ctx.fillRect(0, y + 0.5, width, 1);
  }
}

/**
 * Paints one straight run of the drain channel: concrete lips, a dark channel and a zinc grating
 * whose bars run across the channel.
 *
 * @param ctx - The paint context.
 * @param box - The run.
 * @param frame - The paint frame.
 */
function paint_drain_run(ctx: PaintContext, box: Box, frame: PaintFrame): void {
  const { x, y, width, height } = box;
  const is_horizontal = width > height;
  ctx.fillStyle = css(tint(CONCRETE, 0.16));
  ctx.fillRect(x, y, width, height);
  const inner: Box = { x: x + 2, y: y + 2, width: width - 4, height: height - 4 };
  ctx.fillStyle = css(frame.isHighContrast ? 0x1d2a2c : 0x3a4648);
  ctx.fillRect(inner.x, inner.y, inner.width, inner.height);
  if (frame.isLowDetail) {
    ctx.fillStyle = css(ZINC, 0.55);
    ctx.fillRect(inner.x, inner.y, inner.width, inner.height);
    return;
  }
  // The channel's north (or west) inner wall catches the light.
  ctx.fillStyle = css(shade(CONCRETE, 0.2));
  if (is_horizontal) ctx.fillRect(inner.x, inner.y, inner.width, 1.5);
  else ctx.fillRect(inner.x, inner.y, 1.5, inner.height);
  ctx.fillStyle = css(ZINC);
  if (is_horizontal) {
    for (let bar = inner.x + 1; bar < inner.x + inner.width - 1; bar += 3.5) {
      ctx.fillRect(bar, inner.y + 0.5, 1.4, inner.height - 1);
    }
  } else {
    for (let bar = inner.y + 1; bar < inner.y + inner.height - 1; bar += 3.5) {
      ctx.fillRect(inner.x + 0.5, bar, inner.width - 1, 1.4);
    }
  }
  ctx.fillStyle = css(tint(ZINC, 0.5), 0.8);
  if (is_horizontal) ctx.fillRect(inner.x, inner.y + 1.5, inner.width, 1);
  else ctx.fillRect(inner.x + 1.5, inner.y, 1, inner.height);
}

/**
 * Paints the drain channel that rings the hall just outside its walls (behind the north wall,
 * in the outer half of the side walls' tiles, and below the low south wall).
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param frame - The paint frame.
 */
export function paint_drain_channel(ctx: PaintContext, grid: FloorGrid, frame: PaintFrame): void {
  const left = FLOOR_MARGIN + 8;
  const top = FLOOR_MARGIN - 20;
  const right = FLOOR_MARGIN + grid.columns * TILE - 8;
  const bottom = FLOOR_MARGIN + grid.rows * TILE - 4;
  paint_drain_run(ctx, { x: left, y: top, width: right - left, height: DRAIN_WIDTH }, frame);
  paint_drain_run(
    ctx,
    { x: left, y: bottom - DRAIN_WIDTH, width: right - left, height: DRAIN_WIDTH },
    frame,
  );
  paint_drain_run(
    ctx,
    { x: left, y: top + DRAIN_WIDTH, width: DRAIN_WIDTH, height: bottom - top - DRAIN_WIDTH * 2 },
    frame,
  );
  paint_drain_run(
    ctx,
    {
      x: right - DRAIN_WIDTH,
      y: top + DRAIN_WIDTH,
      width: DRAIN_WIDTH,
      height: bottom - top - DRAIN_WIDTH * 2,
    },
    frame,
  );
}

/**
 * Paints a raised kerb line: a lit top and a short shaded face on its south side (or a shaded
 * east edge on a north-south run).
 *
 * @param ctx - The paint context.
 * @param box - The kerb's top surface.
 */
function paint_kerb(ctx: PaintContext, box: Box): void {
  const { x, y, width, height } = box;
  const is_horizontal = width > height;
  ctx.fillStyle = css(tint(CONCRETE, 0.28));
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = css(shade(CONCRETE, 0.25));
  if (is_horizontal) ctx.fillRect(x, y + height, width, 2.5);
  else ctx.fillRect(x + width, y, 1.5, height);
}

/**
 * Paints a leafy shrub rising from its root point: dark masses below, lit masses towards the
 * north-west, leaf flecks and, on a flowering shrub, a scatter of blooms.
 *
 * @param ctx - The paint context.
 * @param root_x - The root's x.
 * @param root_y - The root's y (the soil line).
 * @param size - The shrub's radius.
 * @param next - The seeded sequence.
 * @param frame - The paint frame.
 */
function paint_shrub(
  ctx: PaintContext,
  root_x: number,
  root_y: number,
  size: number,
  next: () => number,
  frame: PaintFrame,
): void {
  fill_ellipse(ctx, root_x + 2, root_y + 1, size * 0.95, size * 0.35, css(SHADOW, 0.3));
  const centre_y = root_y - size * 0.75;
  const masses = frame.isLowDetail ? 2 : 5;
  for (let index = 0; index < masses; index += 1) {
    const angle = (index / masses) * Math.PI * 2 + next();
    const mass_x = root_x + Math.cos(angle) * size * 0.45;
    const mass_y = centre_y + Math.sin(angle) * size * 0.3;
    fill_circle(ctx, mass_x, mass_y, size * (0.5 + next() * 0.15), css(LEAF[1] as number));
  }
  fill_circle(
    ctx,
    root_x - size * 0.15,
    centre_y - size * 0.2,
    size * 0.55,
    css(LEAF[2] as number),
  );
  fill_circle(
    ctx,
    root_x - size * 0.3,
    centre_y - size * 0.35,
    size * 0.32,
    css(LEAF[3] as number),
  );
  if (!frame.isLowDetail) {
    for (let index = 0; index < 6; index += 1) {
      const fleck_x = root_x + (next() - 0.6) * size * 1.2;
      const fleck_y = centre_y + (next() - 0.65) * size;
      ctx.save();
      ctx.translate(fleck_x, fleck_y);
      ctx.rotate(next() * Math.PI);
      fill_ellipse(ctx, 0, 0, 1.9, 0.9, css(LEAF[4] as number, 0.8));
      ctx.restore();
    }
  }
  if (next() > 0.45) {
    const bloom = BLOOMS[Math.floor(next() * BLOOMS.length) % BLOOMS.length] as number;
    const blooms = frame.isLowDetail ? 2 : 5;
    for (let index = 0; index < blooms; index += 1) {
      const bloom_x = root_x + (next() - 0.5) * size * 1.4;
      const bloom_y = centre_y + (next() - 0.75) * size;
      fill_circle(ctx, bloom_x, bloom_y, 1.7, css(bloom));
      fill_circle(ctx, bloom_x - 0.5, bloom_y - 0.5, 0.7, css(tint(bloom, 0.55)));
    }
  }
}

/**
 * Paints a pandan clump: long strap leaves arching out from one root, each with a lit midrib.
 *
 * @param ctx - The paint context.
 * @param root_x - The root's x.
 * @param root_y - The root's y.
 * @param size - The clump's height.
 * @param next - The seeded sequence.
 * @param frame - The paint frame.
 */
function paint_pandan(
  ctx: PaintContext,
  root_x: number,
  root_y: number,
  size: number,
  next: () => number,
  frame: PaintFrame,
): void {
  fill_ellipse(ctx, root_x + 2, root_y + 1, size * 0.6, size * 0.22, css(SHADOW, 0.3));
  const leaves = frame.isLowDetail ? 5 : 8;
  ctx.save();
  ctx.lineCap = "round";
  for (let index = 0; index < leaves; index += 1) {
    const spread = (index / (leaves - 1) - 0.5) * 2;
    const tip_x = root_x + spread * size * 0.8 + (next() - 0.5) * 3;
    const tip_y = root_y - size * (0.55 + (1 - Math.abs(spread)) * 0.5);
    const bend_x = root_x + spread * size * 0.3;
    const bend_y = root_y - size * 0.95;
    ctx.beginPath();
    ctx.moveTo(root_x, root_y);
    ctx.quadraticCurveTo(bend_x, bend_y, tip_x, tip_y);
    ctx.strokeStyle = css(LEAF[index % 2 === 0 ? 2 : 1] as number);
    ctx.lineWidth = 3;
    ctx.stroke();
    if (!frame.isLowDetail) {
      ctx.strokeStyle = css(LEAF[4] as number, 0.55);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Paints a slender areca palm: a few ringed stems with arching fronds.
 *
 * @param ctx - The paint context.
 * @param root_x - The root's x.
 * @param root_y - The root's y.
 * @param size - The palm's height.
 * @param next - The seeded sequence.
 */
function paint_areca(
  ctx: PaintContext,
  root_x: number,
  root_y: number,
  size: number,
  next: () => number,
): void {
  fill_ellipse(ctx, root_x + 3, root_y + 1, size * 0.35, size * 0.12, css(SHADOW, 0.3));
  ctx.save();
  ctx.lineCap = "round";
  for (const lean of [-0.22, 0.05, 0.25]) {
    const top_x = root_x + lean * size;
    const top_y = root_y - size * (0.75 + next() * 0.15);
    ctx.beginPath();
    ctx.moveTo(root_x, root_y);
    ctx.quadraticCurveTo(root_x + lean * size * 0.3, root_y - size * 0.5, top_x, top_y);
    ctx.strokeStyle = css(0x8b9a4b);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(top_x, top_y);
      ctx.quadraticCurveTo(
        top_x + side * size * 0.3,
        top_y - size * 0.18,
        top_x + side * size * 0.42,
        top_y + size * 0.12,
      );
      ctx.strokeStyle = css(LEAF[side < 0 ? 3 : 2] as number);
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.strokeStyle = css(LEAF[4] as number, 0.5);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Paints one raised planter bed: concrete rim, soil, the south face and its planting.
 *
 * @param ctx - The paint context.
 * @param box - The bed's top (rim and soil), in texture pixels.
 * @param seed - Seed for the planting.
 * @param frame - The paint frame.
 */
function paint_bed(ctx: PaintContext, box: Box, seed: number, frame: PaintFrame): void {
  const { x, y, width, height } = box;
  const is_horizontal = width > height;
  fill_rounded_rect(ctx, x + 2, y + 3, width, height + BED_FACE, 3, css(SHADOW, 0.18));
  ctx.fillStyle = linear_gradient(ctx, 0, y + height, 0, y + height + BED_FACE, [
    [0, shade(CONCRETE, 0.1)],
    [1, shade(CONCRETE, 0.32)],
  ]);
  ctx.fillRect(x, y + height, width, BED_FACE);
  fill_rounded_rect(ctx, x, y, width, height, 2, css(tint(CONCRETE, 0.3)));
  fill_rounded_rect(ctx, x + 3, y + 3, width - 6, height - 6, 1.5, css(SOIL));
  ctx.fillStyle = css(shade(SOIL, 0.4));
  ctx.fillRect(x + 3, y + 3, width - 6, 1.5);
  const next = seeded(seed);
  const length = is_horizontal ? width : height;
  const count = Math.max(1, Math.floor((length - 8) / PLANT_PITCH));
  for (let index = 0; index < count; index += 1) {
    const along = (index + 0.5 + (next() - 0.5) * 0.3) / count;
    const root_x = is_horizontal ? x + along * width : x + width / 2 + (next() - 0.5) * 3;
    const root_y = is_horizontal ? y + height * 0.6 + (next() - 0.5) * 3 : y + along * height;
    const pick = next();
    if (!frame.isLowDetail && (index === 0 || index === count - 1 || pick > 0.93)) {
      paint_areca(ctx, root_x, root_y, 26 + next() * 6, next);
    } else if (pick > 0.72) {
      paint_pandan(ctx, root_x, root_y, 14 + next() * 4, next, frame);
    } else {
      paint_shrub(ctx, root_x, root_y, 8 + next() * 3, next, frame);
    }
  }
}

/**
 * Paints the kerbs and the planter beds around the edge of the texture.
 *
 * @param ctx - The paint context.
 * @param width - Texture width.
 * @param height - Texture height.
 * @param frame - The paint frame.
 * @param seed - Seed for the planting.
 */
export function paint_planters(
  ctx: PaintContext,
  width: number,
  height: number,
  frame: PaintFrame,
  seed: number,
): void {
  const north: Box = { x: BED_INSET, y: 24, width: width - BED_INSET * 2, height: BED_DEPTH };
  const south: Box = {
    x: BED_INSET,
    y: height - BED_DEPTH - BED_FACE - 6,
    width: width - BED_INSET * 2,
    height: BED_DEPTH,
  };
  const side_top = north.y + BED_DEPTH + BED_FACE + 4;
  const side_height = south.y - side_top - 4;
  paint_kerb(ctx, {
    x: BED_INSET,
    y: north.y + BED_DEPTH + BED_FACE + 6,
    width: width - BED_INSET * 2,
    height: 4,
  });
  paint_kerb(ctx, { x: BED_DEPTH + BED_INSET + 6, y: side_top, width: 4, height: side_height });
  paint_kerb(ctx, {
    x: width - BED_DEPTH - BED_INSET - 12,
    y: side_top,
    width: 4,
    height: side_height,
  });
  paint_kerb(ctx, { x: BED_INSET, y: south.y - 10, width: width - BED_INSET * 2, height: 4 });
  // Back to front: the north bed, the side beds, then the south bed nearest the camera.
  paint_bed(ctx, north, seed ^ 0x33, frame);
  paint_bed(
    ctx,
    { x: BED_INSET, y: side_top, width: BED_DEPTH, height: side_height },
    seed ^ 0x11,
    frame,
  );
  paint_bed(
    ctx,
    { x: width - BED_INSET - BED_DEPTH, y: side_top, width: BED_DEPTH, height: side_height },
    seed ^ 0x22,
    frame,
  );
  paint_bed(ctx, south, seed ^ 0x44, frame);
}
