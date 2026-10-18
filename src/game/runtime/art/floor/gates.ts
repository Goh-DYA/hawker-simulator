/**
 * The hall's entrance and exit gates: the opening in the wall with its threshold, a ribbed floor
 * mat with a painted direction arrow, a gate post at each end of the opening (a lintel too in the
 * tall north wall) and a small free-standing ENTRANCE or EXIT sign on the apron outside.
 *
 * A gate is painted for every access point, whether the map marks its tile as wall or as floor.
 */
import {
  css,
  fill_polygon,
  fill_rounded_rect,
  label,
  linear_gradient,
  shade,
  stroke_rounded_rect,
  TILE,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import {
  CONCRETE,
  COPING,
  COPING_DEPTH,
  INK,
  NORTH_WALL_HEIGHT,
  SHADOW,
  SOUTH_WALL_DROP,
  STAINLESS,
  TEAL,
  tile_left,
  tile_top,
  WALL_THICKNESS,
  type FloorGrid,
  type GateKind,
} from "./layout";

/** Mat colours: a warm coir mat at entrances, a slate rubber mat at exits. */
const MAT_COLOURS: Readonly<Record<GateKind, number>> = { entrance: 0xc8973c, exit: 0x56788a };
/** Sign board colours. */
const SIGN_COLOURS: Readonly<Record<GateKind, number>> = { entrance: 0xfff3d6, exit: 0xe6f0f1 };
/** Height of a low gate post above the floor. */
const POST_HEIGHT = 20;
/** How far outside the wall the sign stands. */
const SIGN_OFFSET = 34;
/** Sign board size. */
const SIGN_WIDTH = 58;
const SIGN_HEIGHT = 15;

/** Which wall a gate sits in. */
type GateSide = "north" | "south" | "west" | "east";

/** A block seen in 3/4: its plan rectangle and how tall it stands. */
interface Block {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

/**
 * Names the wall a gate opens through.
 *
 * @param grid - The floor grid.
 * @param x - Tile column.
 * @param y - Tile row.
 * @returns The side; a gate off the perimeter is treated as a west gate.
 */
function gate_side(grid: FloorGrid, x: number, y: number): GateSide {
  if (x === 0) return "west";
  if (x === grid.columns - 1) return "east";
  if (y === 0) return "north";
  if (y === grid.rows - 1) return "south";
  return "west";
}

/**
 * Paints a block in 3/4: its lit top surface lifted by its height and its south face below.
 *
 * @param ctx - The paint context.
 * @param block - The block.
 * @param frame - The paint frame.
 */
function paint_block(ctx: PaintContext, block: Block, frame: PaintFrame): void {
  const { x, y, width, depth, height } = block;
  const top = y - height;
  ctx.fillStyle = linear_gradient(ctx, x, 0, x + width, 0, [
    [0, tint(TEAL, 0.18)],
    [0.6, TEAL],
    [1, shade(TEAL, 0.35)],
  ]);
  ctx.fillRect(x, top + depth, width, height);
  ctx.fillStyle = linear_gradient(ctx, 0, y + depth - 6, 0, y + depth, [
    [0, SHADOW, 0],
    [1, SHADOW, 0.25],
  ]);
  ctx.fillRect(x, y + depth - 6, width, 6);
  ctx.fillStyle = css(tint(COPING, 0.2));
  ctx.fillRect(x, top, width, depth);
  ctx.fillStyle = css(0xffffff, 0.4);
  ctx.fillRect(x, top, width, 1);
  stroke_rounded_rect(
    ctx,
    x + 0.5,
    top + 0.5,
    width - 1,
    depth + height - 1,
    1,
    css(frame.isHighContrast ? SHADOW : shade(TEAL, 0.6), frame.isHighContrast ? 1 : 0.7),
    frame.isHighContrast ? 2 : 1,
  );
}

/**
 * Paints the gate posts (and, in the tall north wall, the lintel) at the ends of an opening.
 *
 * @param ctx - The paint context.
 * @param side - The wall the gate is in.
 * @param x - Tile left.
 * @param y - Tile top.
 * @param frame - The paint frame.
 */
function paint_posts(
  ctx: PaintContext,
  side: GateSide,
  x: number,
  y: number,
  frame: PaintFrame,
): void {
  if (side === "west" || side === "east") {
    const left = side === "west" ? x + TILE - WALL_THICKNESS : x;
    for (const post_y of [y, y + TILE - 7]) {
      paint_block(
        ctx,
        { x: left, y: post_y, width: WALL_THICKNESS, depth: 7, height: POST_HEIGHT },
        frame,
      );
    }
    return;
  }
  if (side === "south") {
    for (const post_x of [x, x + TILE - 8]) {
      paint_block(
        ctx,
        {
          x: post_x,
          y: y + SOUTH_WALL_DROP,
          width: 8,
          depth: WALL_THICKNESS,
          height: POST_HEIGHT + 4,
        },
        frame,
      );
    }
    return;
  }
  const floor_line = y + TILE;
  const height = NORTH_WALL_HEIGHT + 8;
  for (const post_x of [x, x + TILE - 8]) {
    paint_block(
      ctx,
      { x: post_x, y: floor_line - COPING_DEPTH, width: 8, depth: COPING_DEPTH, height },
      frame,
    );
  }
  // Lintel across the top of the opening: a beam level with the post tops.
  const beam_top = floor_line - COPING_DEPTH - height;
  ctx.fillStyle = css(tint(COPING, 0.2));
  ctx.fillRect(x + 8, beam_top, TILE - 16, COPING_DEPTH);
  ctx.fillStyle = linear_gradient(ctx, 0, beam_top + COPING_DEPTH, 0, beam_top + COPING_DEPTH + 6, [
    [0, TEAL],
    [1, shade(TEAL, 0.4)],
  ]);
  ctx.fillRect(x + 8, beam_top + COPING_DEPTH, TILE - 16, 6);
  ctx.fillStyle = css(0xffffff, 0.4);
  ctx.fillRect(x + 8, beam_top, TILE - 16, 1);
}

/**
 * Paints the mat across an opening, ribbed across the direction of travel, with its painted
 * direction arrow: into the hall at an entrance, out of it at an exit.
 *
 * @param ctx - The paint context.
 * @param kind - Entrance or exit.
 * @param side - The wall the gate is in.
 * @param x - Tile left.
 * @param y - Tile top.
 * @param frame - The paint frame.
 */
function paint_mat(
  ctx: PaintContext,
  kind: GateKind,
  side: GateSide,
  x: number,
  y: number,
  frame: PaintFrame,
): void {
  const is_across = side === "west" || side === "east";
  const mat_x = x + (is_across ? 3 : 7);
  const mat_y = y + (is_across ? 8 : 4);
  const mat_width = is_across ? TILE - 6 : TILE - 14;
  const mat_height = is_across ? TILE - 16 : TILE - 8;
  const colour = MAT_COLOURS[kind];
  fill_rounded_rect(ctx, mat_x, mat_y + 1.5, mat_width, mat_height, 3, css(shade(colour, 0.45)));
  fill_rounded_rect(ctx, mat_x, mat_y, mat_width, mat_height, 3, css(colour));
  fill_rounded_rect(
    ctx,
    mat_x + 3,
    mat_y + 3,
    mat_width - 6,
    mat_height - 6,
    2,
    css(tint(colour, 0.08)),
  );
  if (!frame.isLowDetail) {
    ctx.fillStyle = css(shade(colour, 0.3), 0.35);
    if (is_across) {
      for (let rib = mat_x + 5; rib < mat_x + mat_width - 4; rib += 3) {
        ctx.fillRect(rib, mat_y + 3, 1, mat_height - 6);
      }
    } else {
      for (let rib = mat_y + 5; rib < mat_y + mat_height - 4; rib += 3) {
        ctx.fillRect(mat_x + 3, rib, mat_width - 6, 1);
      }
    }
  }
  const inward =
    side === "west" ? [1, 0] : side === "east" ? [-1, 0] : side === "north" ? [0, 1] : [0, -1];
  const sign = kind === "entrance" ? 1 : -1;
  const dx = (inward[0] as number) * sign;
  const dy = (inward[1] as number) * sign;
  const cx = mat_x + mat_width / 2;
  const cy = mat_y + mat_height / 2;
  const point = (along: number, across: number): readonly [number, number] => [
    cx + dx * along - dy * across,
    cy + dy * along + dx * across,
  ];
  const arrow = [
    point(11, 0),
    point(1, 9),
    point(1, 4),
    point(-10, 4),
    point(-10, -4),
    point(1, -4),
    point(1, -9),
  ];
  fill_polygon(ctx, arrow, css(frame.isHighContrast ? INK : 0xfff4dc, 0.95));
  ctx.save();
  ctx.beginPath();
  arrow.forEach(([px, py], index) => (index === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.strokeStyle = css(INK, frame.isHighContrast ? 1 : 0.45);
  ctx.lineWidth = frame.isHighContrast ? 1.5 : 1;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints the small free-standing gate sign on the apron outside: a cream board with a visible
 * front edge on two short legs, with the baked label.
 *
 * @param ctx - The paint context.
 * @param kind - Entrance or exit.
 * @param centre_x - The sign's centre.
 * @param centre_y - The board's vertical centre.
 * @param frame - The paint frame.
 */
function paint_sign(
  ctx: PaintContext,
  kind: GateKind,
  centre_x: number,
  centre_y: number,
  frame: PaintFrame,
): void {
  const left = centre_x - SIGN_WIDTH / 2;
  const top = centre_y - SIGN_HEIGHT / 2;
  const accent = MAT_COLOURS[kind];
  const foot = top + SIGN_HEIGHT + 7;
  // Contact shadow of the legs and the board on the apron.
  fill_rounded_rect(ctx, left + 5, foot - 2, SIGN_WIDTH - 4, 5, 2.5, css(SHADOW, 0.2));
  for (const leg_x of [left + 8, left + SIGN_WIDTH - 10]) {
    ctx.fillStyle = css(shade(STAINLESS, 0.35));
    ctx.fillRect(leg_x, top + SIGN_HEIGHT, 2, 7);
  }
  fill_rounded_rect(ctx, left, top + 2.5, SIGN_WIDTH, SIGN_HEIGHT, 3, css(shade(accent, 0.35)));
  fill_rounded_rect(ctx, left, top, SIGN_WIDTH, SIGN_HEIGHT, 3, css(SIGN_COLOURS[kind]));
  fill_rounded_rect(ctx, left + 2, top + 2, 4, SIGN_HEIGHT - 4, 1.5, css(accent));
  stroke_rounded_rect(
    ctx,
    left,
    top,
    SIGN_WIDTH,
    SIGN_HEIGHT,
    3,
    css(frame.isHighContrast ? INK : shade(accent, 0.45), frame.isHighContrast ? 1 : 0.75),
    frame.isHighContrast ? 2 : 1,
  );
  label(ctx, kind === "entrance" ? "ENTRANCE" : "EXIT", centre_x + 3, centre_y + 0.5, {
    maxWidth: SIGN_WIDTH - 14,
    size: 8.5,
    colour: INK,
    uppercase: true,
  });
}

/**
 * Paints one gate: the opening's apron and threshold, the mat and arrow, the posts and the sign.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param point - The access point.
 * @param frame - The paint frame.
 */
function paint_gate(
  ctx: PaintContext,
  grid: FloorGrid,
  point: FloorGrid["spec"]["accessPoints"][number],
  frame: PaintFrame,
): void {
  const { x: tile_x, y: tile_y } = point.position;
  const side = gate_side(grid, tile_x, tile_y);
  const x = tile_left(tile_x);
  const y = tile_top(tile_y);
  ctx.fillStyle = css(tint(CONCRETE, 0.12));
  ctx.fillRect(x, y, TILE, TILE);
  // Stainless threshold strip along the wall line.
  ctx.fillStyle = css(STAINLESS);
  if (side === "west") ctx.fillRect(x + TILE - WALL_THICKNESS / 2 - 1.5, y, 3, TILE);
  else if (side === "east") ctx.fillRect(x + WALL_THICKNESS / 2 - 1.5, y, 3, TILE);
  else if (side === "north") ctx.fillRect(x, y + TILE - WALL_THICKNESS / 2 - 1.5, TILE, 3);
  else ctx.fillRect(x, y + SOUTH_WALL_DROP + WALL_THICKNESS / 2 - 1.5, TILE, 3);
  paint_mat(ctx, point.kind, side, x, y, frame);
  paint_posts(ctx, side, x, y, frame);
  const centre_x = x + TILE / 2;
  const centre_y = y + TILE / 2;
  if (side === "west") paint_sign(ctx, point.kind, x - SIGN_OFFSET, centre_y, frame);
  else if (side === "east") paint_sign(ctx, point.kind, x + TILE + SIGN_OFFSET, centre_y, frame);
  else if (side === "north") paint_sign(ctx, point.kind, centre_x, y - SIGN_OFFSET + 4, frame);
  else paint_sign(ctx, point.kind, centre_x, y + TILE + SIGN_OFFSET - 6, frame);
}

/**
 * Paints every access point's gate.
 *
 * @param ctx - The paint context.
 * @param grid - The floor grid.
 * @param frame - The paint frame.
 */
export function paint_gates(ctx: PaintContext, grid: FloorGrid, frame: PaintFrame): void {
  for (const point of grid.spec.accessPoints) paint_gate(ctx, grid, point, frame);
}
