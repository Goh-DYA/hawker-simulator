/**
 * Seat painters: the ten launch seats (the stacking stool, high counter stool and swivel perch;
 * the moulded, easy-rise arm, booster and cushioned chairs; the two- and three-person benches and
 * the acoustic booth), painted in the 3/4 view from the south at real-world scale.
 *
 * A tile is about a metre, so a seat is small inside it: a stool seat is about 18 px across, a
 * chair about 22 px wide and a bench about 16 px deep, and the rest of the tile is left as floor.
 * Every sitting surface is centred {@link SEAT_HEIGHT} above its tile centre, where the people
 * painters put a sitter's hips. Seats are built from parts (legs, seat, backrest, arms) laid out
 * in the authored orientation (backrest to the north, sitter facing south) and turned clockwise
 * into the rotated footprint, then painted back to front, so a chair at 90 degrees shows its
 * backrest to the east and its profile to the viewer, and at 180 degrees shows its back. Round
 * stools ignore the rotation; the swivel perch turns its slim wrap-around back rail. The stacking
 * stool is the classic hawker stool: a flat moulded top with a raised lip and a lifting hole in
 * red, green or blue, on four legs that flare wide. {@link has_backrest} names the seats whose
 * solid backrest hides their sitter when turned to 180 degrees, which the world view sorts after
 * the sitter.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  line,
  linear_gradient,
  mix,
  radial_gradient,
  shade,
  SHADOW_INK,
  stroke_ellipse,
  stroke_rounded_rect,
  TAU,
  tint,
  wood_grain,
  type PaintContext,
} from "../canvas";
import { SEAT_HEIGHT, type PaintFrame } from "../specs";
import {
  fit_rotation,
  floor_shadow,
  ground_rect,
  orient,
  outline_style,
  paint_block,
  paint_parts,
  paint_post,
  paint_strut,
  rotated_side,
  to_ground,
  type BlockFaces,
  type GroundRect,
  type Orientation,
  type Part,
  type Side,
} from "./seatingKit";
import { type Box, DARK_STEEL, STEEL, STOOL_COLOURS, TIMBER } from "./shared";

/** Grey tubular steel of chair legs. */
const TUBE_STEEL = 0x8c9794;
/** Dark walnut of the dining and arm chairs' frames. */
const WALNUT = 0x6b462d;
/** Mustard plastic of the child booster. */
const BOOSTER = 0xf0bf4a;
/** Charcoal of the booster buckle and strap. */
const STRAP = 0x4a4f4e;
/** Dark charcoal vinyl of the swivel perch's back pad. */
const PERCH_PAD = 0x353b3a;
/** Vertical squash of round seats seen from above. */
const ROUND_SQUASH = 0.82;
/** Radius of the stacking stool's seat (18 px across). */
const STOOL_RADIUS = 9;
/** Radius of the counter stool's smaller seat. */
const COUNTER_RADIUS = 7.5;
/** Radius of the swivel perch's seat. */
const PERCH_RADIUS = 8;
/** Half the width of a chair seat (22 px wide). */
const CHAIR_HALF_WIDTH = 11;
/** Half the depth of a chair or bench seat (16 px deep). */
const SEAT_HALF_DEPTH = 8;
/** Thickness of a seat board or shell. */
const SEAT_THICKNESS = 2.5;
/** Height of a chair's backrest above its seat. */
const BACK_RISE = 14;
/** Height of the two-person bench's low back above its seat. */
const BENCH_BACK_RISE = 10;

/** A chair's construction, as the chair painter reads it. */
interface ChairDesign {
  /** Colour of the seat's top. */
  readonly seat: number;
  /** Colour of the backrest. */
  readonly back: number;
  /** Colour of the legs. */
  readonly legs: number;
  /** Leg width. */
  readonly legWidth: number;
  /** Seat thickness. */
  readonly thickness: number;
  /** Backrest height above the seat. */
  readonly backRise: number;
  /** Backrest thickness. */
  readonly backThickness: number;
  /** Half the backrest's width; backrests taper narrower than their seats. */
  readonly backHalfWidth: number;
  /** Dresses the seat's top face. */
  readonly dressSeat: (faces: BlockFaces) => void;
  /** Dresses the backrest's south face, given the side the backrest stands on. */
  readonly dressBack: (faces: BlockFaces, side: Side) => void;
}

/**
 * Builds the parts of a set of legs: posts from the floor to the seat's underside.
 *
 * @param ctx - The paint context.
 * @param orientation - The seat's orientation.
 * @param points - Authored floor positions of the legs.
 * @param height - Leg height.
 * @param width - Leg width.
 * @param colour - Leg material.
 * @param frame - The paint frame.
 * @returns One part per leg.
 */
function leg_parts(
  ctx: PaintContext,
  orientation: Orientation,
  points: ReadonlyArray<readonly [number, number]>,
  height: number,
  width: number,
  colour: number,
  frame: PaintFrame,
): Part[] {
  return points.map(([u, v]) => {
    const foot = to_ground(orientation, u, v);
    const rect: GroundRect = {
      x0: foot.x - width / 2,
      y0: foot.y - width / 2,
      x1: foot.x + width / 2,
      y1: foot.y + width / 2,
    };
    return {
      rect,
      z0: 0,
      draw: () => paint_post(ctx, foot.x, rect.y1, 0, height, width, colour, frame),
    };
  });
}

/**
 * Paints the far legs peeking out between the two nearest legs: darker, a little inward and
 * higher, so a seat seen from the south still reads as standing on four legs.
 *
 * @param ctx - The paint context.
 * @param orientation - The seat's orientation.
 * @param points - Authored floor positions of all the legs.
 * @param height - Leg height.
 * @param width - Leg width.
 * @param colour - Leg material.
 * @param frame - The paint frame.
 */
function paint_peek_legs(
  ctx: PaintContext,
  orientation: Orientation,
  points: ReadonlyArray<readonly [number, number]>,
  height: number,
  width: number,
  colour: number,
  frame: PaintFrame,
): void {
  const feet = points.map(([u, v]) => to_ground(orientation, u, v));
  const frontY = Math.max(...feet.map((foot) => foot.y));
  const front = feet.filter((foot) => Math.abs(foot.y - frontY) < 0.5);
  if (front.length < 2) return;
  const west = Math.min(...front.map((foot) => foot.x));
  const east = Math.max(...front.map((foot) => foot.x));
  if (east - west < 10) return;
  for (const legX of [west + 3.5, east - 3.5]) {
    paint_post(ctx, legX, frontY - 2.5, 0, height - 1.5, width * 0.85, shade(colour, 0.42), frame);
  }
}

/**
 * Paints a shallow sitting scoop on a seat's top: shaded on the lit side and lit on the far side,
 * so it reads as a hollow rather than a bump.
 *
 * @param ctx - The paint context.
 * @param faces - The seat's faces.
 * @param inset - Inset of the scoop from the seat's edges.
 */
function paint_scoop(ctx: PaintContext, faces: BlockFaces, inset: number): void {
  const { x, y, width, height } = faces.top;
  fill_rounded_rect(
    ctx,
    x + inset,
    y + inset,
    width - inset * 2,
    height - inset * 2,
    Math.max(1.5, Math.min(width, height) / 2 - inset),
    linear_gradient(ctx, x, y, x + width, y + height, [
      [0, SHADOW_INK, 0.18],
      [0.55, SHADOW_INK, 0.03],
      [1, 0xffffff, 0.2],
    ]),
  );
}

/**
 * Paints the lit inner face of a backrest seen from the side: a sliver on the seat side of the
 * edge-on backrest, from its top down to the seat, so the backrest reads as a panel rather than
 * a post.
 *
 * @param ctx - The paint context.
 * @param faces - The backrest's faces.
 * @param side - The side the backrest stands on (east or west).
 * @param colour - The backrest material.
 */
function paint_back_edge(ctx: PaintContext, faces: BlockFaces, side: Side, colour: number): void {
  const { top, front } = faces;
  const sliver = 1.6;
  const x = side === "east" ? top.x - sliver : top.x + top.width;
  fill_rounded_rect(
    ctx,
    x,
    top.y + 1,
    sliver,
    front.y + front.height - top.y - 2,
    0.8,
    linear_gradient(ctx, 0, top.y, 0, front.y + front.height, [
      [0, tint(colour, 0.35)],
      [1, shade(colour, 0.1)],
    ]),
  );
}

/**
 * Paints a chair from its design: the shadow, the legs with the far pair peeking, then the seat
 * and the backrest (and any extra parts) back to front.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param rotation - The placement rotation.
 * @param design - The chair's construction.
 * @param frame - The paint frame.
 * @param extras - Builds extra parts (arms, a booster) from the seat's floor rectangle.
 */
function paint_chair_design(
  ctx: PaintContext,
  box: Box,
  rotation: Rotation,
  design: ChairDesign,
  frame: PaintFrame,
  extras: (orientation: Orientation, seat: GroundRect) => Part[] = () => [],
): void {
  const orientation = orient(box, rotation);
  const cu = orientation.width / 2;
  const cv = orientation.height / 2;
  const legInset = design.legWidth / 2 + 1;
  const legPoints: Array<readonly [number, number]> = [
    [cu - CHAIR_HALF_WIDTH + legInset, cv - SEAT_HALF_DEPTH + legInset],
    [cu + CHAIR_HALF_WIDTH - legInset, cv - SEAT_HALF_DEPTH + legInset],
    [cu - CHAIR_HALF_WIDTH + legInset, cv + SEAT_HALF_DEPTH - legInset],
    [cu + CHAIR_HALF_WIDTH - legInset, cv + SEAT_HALF_DEPTH - legInset],
  ];
  const legHeight = SEAT_HEIGHT - design.thickness;
  const seat = ground_rect(
    orientation,
    cu - CHAIR_HALF_WIDTH,
    cv - SEAT_HALF_DEPTH,
    cu + CHAIR_HALF_WIDTH,
    cv + SEAT_HALF_DEPTH,
  );
  const back = ground_rect(
    orientation,
    cu - design.backHalfWidth,
    cv - SEAT_HALF_DEPTH - design.backThickness + 0.5,
    cu + design.backHalfWidth,
    cv - SEAT_HALF_DEPTH + 0.5,
  );
  const backSide = rotated_side(rotation, "north");
  floor_shadow(ctx, ground_rect(orientation, cu - 10, cv - 10, cu + 10, cv + 8), { alpha: 0.2 });
  paint_peek_legs(ctx, orientation, legPoints, legHeight, design.legWidth, design.legs, frame);
  for (const leg of leg_parts(
    ctx,
    orientation,
    legPoints,
    legHeight,
    design.legWidth,
    design.legs,
    frame,
  )) {
    leg.draw();
  }
  paint_parts([
    {
      rect: seat,
      z0: legHeight,
      draw: () =>
        paint_block(
          ctx,
          seat,
          legHeight,
          SEAT_HEIGHT,
          { top: design.seat, radius: 3.5 },
          frame,
          design.dressSeat,
        ),
    },
    {
      rect: back,
      z0: SEAT_HEIGHT - 1,
      draw: () => {
        const faces = paint_block(
          ctx,
          back,
          SEAT_HEIGHT - 1,
          SEAT_HEIGHT + design.backRise,
          { top: design.back, radius: 1.5, gloss: 0.35 },
          frame,
        );
        if (backSide === "east" || backSide === "west")
          paint_back_edge(ctx, faces, backSide, design.back);
        design.dressBack(faces, backSide);
      },
    },
    ...extras(orientation, seat),
  ]);
}

/**
 * Paints the moulded back chair: a one-piece polypropylene shell in the recipe accent, its seat
 * scooped and its backrest pierced by a hand slot, on slim tubular steel legs.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_moulded_chair(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const shell = recipe.accent;
  paint_chair_design(
    ctx,
    box,
    rotation,
    {
      seat: tint(shell, 0.06),
      back: shell,
      legs: TUBE_STEEL,
      legWidth: 2,
      thickness: SEAT_THICKNESS,
      backRise: BACK_RISE,
      backThickness: 3,
      backHalfWidth: CHAIR_HALF_WIDTH - 1.5,
      dressSeat: (faces) => paint_scoop(ctx, faces, 3),
      dressBack: (faces, side) => {
        if (side !== "north" && side !== "south") return;
        const { front } = faces;
        const slotX = front.x + front.width / 2 - 4.5;
        fill_rounded_rect(ctx, slotX, front.y + 2.5, 9, 2.4, 1.2, css(shade(shell, 0.6)));
        line(ctx, slotX + 1, front.y + 5.3, slotX + 8, front.y + 5.3, css(0xffffff, 0.22), 0.8);
        if (side === "north") {
          // The lumbar curve of the shell catches the light across its middle.
          fill_rounded_rect(
            ctx,
            front.x + 3,
            front.y + 8,
            front.width - 6,
            2,
            1,
            css(0xffffff, 0.16),
          );
        }
      },
    },
    frame,
  );
}

/**
 * Builds the arm rests of the easy-rise chair: a walnut rail along each side of the seat on a
 * front post, set at a firm height to push up from.
 *
 * @param ctx - The paint context.
 * @param orientation - The chair's orientation.
 * @param frame - The paint frame.
 * @returns The arm parts.
 */
function arm_parts(ctx: PaintContext, orientation: Orientation, frame: PaintFrame): Part[] {
  const cu = orientation.width / 2;
  const cv = orientation.height / 2;
  const armTop = SEAT_HEIGHT + 6;
  return [-1, 1].flatMap((side) => {
    const inner = cu + side * CHAIR_HALF_WIDTH;
    const outer = inner + side * 3;
    const rail = ground_rect(
      orientation,
      Math.min(inner, outer),
      cv - SEAT_HALF_DEPTH - 2,
      Math.max(inner, outer),
      cv + SEAT_HALF_DEPTH - 1,
    );
    const post = to_ground(orientation, (inner + outer) / 2, cv + SEAT_HALF_DEPTH - 2.5);
    return [
      {
        rect: { x0: post.x - 1.2, y0: post.y - 1.2, x1: post.x + 1.2, y1: post.y + 1.2 },
        z0: 0,
        draw: () => paint_post(ctx, post.x, post.y + 1.2, 0, armTop - 1, 2.4, WALNUT, frame),
      },
      {
        rect: rail,
        z0: armTop - 2,
        draw: () => {
          paint_block(
            ctx,
            rail,
            armTop - 2,
            armTop,
            { top: tint(TIMBER, 0.08), front: WALNUT, radius: 1.4, gloss: 0.4 },
            frame,
          );
        },
      },
    ];
  });
}

/**
 * Paints the easy-rise arm chair: a firm upholstered seat and back in a walnut frame, with arm
 * rests on both sides to push up from.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_arm_chair(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const fabric = tint(recipe.accent, 0.08);
  paint_chair_design(
    ctx,
    box,
    rotation,
    {
      seat: fabric,
      back: WALNUT,
      legs: WALNUT,
      legWidth: 2.8,
      thickness: 3,
      backRise: BACK_RISE - 1,
      backThickness: 3,
      backHalfWidth: CHAIR_HALF_WIDTH,
      dressSeat: (faces) => {
        const { x, y, width, height } = faces.top;
        stroke_rounded_rect(
          ctx,
          x + 1.6,
          y + 1.6,
          width - 3.2,
          height - 3.2,
          2.5,
          css(shade(fabric, 0.3), 0.6),
          0.9,
        );
      },
      dressBack: (faces, side) => {
        if (side !== "north" && side !== "south") return;
        const { front } = faces;
        const panel = side === "north" ? fabric : shade(WALNUT, 0.1);
        fill_rounded_rect(
          ctx,
          front.x + 2.5,
          front.y + 2,
          front.width - 5,
          front.height - 3.5,
          2,
          css(panel),
        );
        if (side === "north") {
          fill_rounded_rect(
            ctx,
            front.x + 3.5,
            front.y + 2.6,
            front.width - 7,
            2,
            1,
            css(0xffffff, 0.22),
          );
        }
      },
    },
    frame,
    (orientation) => arm_parts(ctx, orientation, frame),
  );
}

/**
 * Builds the child booster strapped to the family chair: a mustard seat with its own small back,
 * a front lip and the T-strap and buckle that secure the child.
 *
 * @param ctx - The paint context.
 * @param orientation - The chair's orientation.
 * @param seat - The chair seat's floor rectangle.
 * @param frame - The paint frame.
 * @returns The booster parts, sorted after the chair seat they rest on.
 */
function booster_parts(
  ctx: PaintContext,
  orientation: Orientation,
  seat: GroundRect,
  frame: PaintFrame,
): Part[] {
  const cu = orientation.width / 2;
  const cv = orientation.height / 2;
  const base = ground_rect(orientation, cu - 7, cv - 5.5, cu + 7, cv + 6);
  const back = ground_rect(orientation, cu - 7, cv - 7.5, cu + 7, cv - 5.5);
  const strapFrom = to_ground(orientation, cu, cv - 4.5);
  const strapTo = to_ground(orientation, cu, cv + 4.5);
  const top = SEAT_HEIGHT + 3.5;
  return [
    {
      rect: base,
      z0: SEAT_HEIGHT,
      sortY: seat.y1 + 0.5,
      draw: () => {
        paint_block(
          ctx,
          base,
          SEAT_HEIGHT,
          top,
          { top: BOOSTER, radius: 3, gloss: 0.45 },
          frame,
          (faces) => paint_scoop(ctx, faces, 2.5),
        );
        line(
          ctx,
          strapFrom.x,
          strapFrom.y - top,
          strapTo.x,
          strapTo.y - top,
          css(STRAP, 0.85),
          1.3,
        );
        fill_circle(
          ctx,
          (strapFrom.x + strapTo.x) / 2,
          (strapFrom.y + strapTo.y) / 2 - top,
          1.5,
          css(shade(STRAP, 0.2)),
        );
      },
    },
    {
      rect: back,
      z0: SEAT_HEIGHT + 1,
      sortY: seat.y1 + 0.6,
      draw: () => {
        paint_block(
          ctx,
          back,
          SEAT_HEIGHT + 1,
          SEAT_HEIGHT + 9,
          { top: tint(BOOSTER, 0.1), radius: 1.5, gloss: 0.4 },
          frame,
        );
      },
    },
  ];
}

/**
 * Paints the booster family chair: a sturdy timber ladder-back chair with a mustard child
 * booster secured to its seat.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_booster_chair(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  paint_chair_design(
    ctx,
    box,
    rotation,
    {
      seat: TIMBER,
      back: shade(TIMBER, 0.08),
      legs: shade(TIMBER, 0.25),
      legWidth: 2.6,
      thickness: SEAT_THICKNESS,
      backRise: BACK_RISE,
      backThickness: 3,
      backHalfWidth: CHAIR_HALF_WIDTH - 1,
      dressSeat: (faces) => {
        if (!frame.isLowDetail) {
          const { x, y, width, height } = faces.top;
          wood_grain(ctx, x, y, width, height, TIMBER, recipe.seed);
        }
      },
      dressBack: (faces, side) => {
        if (side !== "north" && side !== "south") return;
        // Ladder back: two rails between the stiles, the floor showing through the gaps.
        const { front } = faces;
        const gap = css(shade(TIMBER, 0.6), side === "north" ? 0.85 : 0.7);
        fill_rounded_rect(ctx, front.x + 3, front.y + 4, front.width - 6, 2.6, 0.8, gap);
        fill_rounded_rect(ctx, front.x + 3, front.y + 9, front.width - 6, 3, 0.8, gap);
      },
    },
    frame,
    (orientation, seat) => booster_parts(ctx, orientation, seat, frame),
  );
}

/**
 * Paints the cushioned dining chair: a thick upholstered seat with piping and a tall button-
 * tufted back in a walnut frame.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_cushioned_chair(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const fabric = tint(recipe.accent, 0.12);
  paint_chair_design(
    ctx,
    box,
    rotation,
    {
      seat: fabric,
      back: fabric,
      legs: WALNUT,
      legWidth: 2.6,
      thickness: 4,
      backRise: BACK_RISE + 2,
      backThickness: 3.5,
      backHalfWidth: CHAIR_HALF_WIDTH - 1,
      dressSeat: (faces) => {
        const { x, y, width, height } = faces.top;
        fill_ellipse(
          ctx,
          x + width * 0.45,
          y + height * 0.45,
          width * 0.4,
          height * 0.36,
          radial_gradient(ctx, x + width * 0.4, y + height * 0.4, 0, width * 0.45, [
            [0, 0xffffff, 0.2],
            [1, 0xffffff, 0],
          ]),
        );
        stroke_rounded_rect(
          ctx,
          x + 1.4,
          y + 1.4,
          width - 2.8,
          height - 2.8,
          2.5,
          css(tint(fabric, 0.45), 0.8),
          0.9,
        );
      },
      dressBack: (faces, side) => {
        const { front } = faces;
        if (side === "south") {
          fill_rounded_rect(
            ctx,
            front.x + 2,
            front.y + 1.5,
            front.width - 4,
            front.height - 2.5,
            1.5,
            css(shade(fabric, 0.2)),
          );
          stroke_rounded_rect(
            ctx,
            front.x,
            front.y,
            front.width,
            front.height,
            1.5,
            css(WALNUT),
            1.6,
          );
          return;
        }
        if (side !== "north") return;
        fill_rounded_rect(
          ctx,
          front.x + 1.5,
          front.y + 1,
          front.width - 3,
          front.height - 2,
          2.5,
          linear_gradient(ctx, 0, front.y, 0, front.y + front.height, [
            [0, tint(fabric, 0.25)],
            [0.6, fabric],
            [1, shade(fabric, 0.2)],
          ]),
        );
        for (const [buttonX, buttonY] of [
          [0.3, 0.35],
          [0.7, 0.35],
          [0.5, 0.65],
        ] as const) {
          fill_circle(
            ctx,
            front.x + front.width * buttonX,
            front.y + front.height * buttonY,
            0.9,
            css(shade(fabric, 0.5)),
          );
        }
        stroke_rounded_rect(
          ctx,
          front.x,
          front.y,
          front.width,
          front.height,
          1.5,
          css(WALNUT),
          1.4,
        );
      },
    },
    frame,
  );
}

/**
 * Paints the two-person moulded bench: a two-place seat in the recipe accent, each place
 * scooped, with a low back moulded in one piece with it, on dark steel legs.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_moulded_bench(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const orientation = orient(box, rotation);
  const { width } = orientation;
  const cv = orientation.height / 2;
  const legHeight = SEAT_HEIGHT - 3;
  const shell = recipe.accent;
  const seat = ground_rect(orientation, 5, cv - SEAT_HALF_DEPTH, width - 5, cv + SEAT_HALF_DEPTH);
  const back = ground_rect(
    orientation,
    6,
    cv - SEAT_HALF_DEPTH - 3,
    width - 6,
    cv - SEAT_HALF_DEPTH + 0.5,
  );
  const legPoints: Array<readonly [number, number]> = [
    [10, cv - 6],
    [10, cv + 6.5],
    [width - 10, cv - 6],
    [width - 10, cv + 6.5],
  ];
  const backSide = rotated_side(rotation, "north");
  floor_shadow(ctx, ground_rect(orientation, 8, cv - 9, width - 8, cv + 8), { alpha: 0.2 });
  paint_peek_legs(ctx, orientation, legPoints, legHeight, 2.6, DARK_STEEL, frame);
  paint_parts([
    ...leg_parts(ctx, orientation, legPoints, legHeight, 2.6, DARK_STEEL, frame),
    {
      rect: seat,
      z0: legHeight,
      draw: () =>
        paint_block(
          ctx,
          seat,
          legHeight,
          SEAT_HEIGHT,
          { top: tint(shell, 0.06), radius: 4 },
          frame,
          (faces) => {
            const { x, y, width: faceWidth, height } = faces.top;
            const isLong = faceWidth >= height;
            const halves = isLong
              ? [
                  { ...faces.top, width: faceWidth / 2 },
                  { ...faces.top, x: x + faceWidth / 2, width: faceWidth / 2 },
                ]
              : [
                  { ...faces.top, height: height / 2 },
                  { ...faces.top, y: y + height / 2, height: height / 2 },
                ];
            for (const half of halves) paint_scoop(ctx, { top: half, front: faces.front }, 3);
          },
        ),
    },
    {
      rect: back,
      z0: SEAT_HEIGHT - 1,
      draw: () => {
        // The back is moulded in one piece with the seat, so no gap shows between them.
        const faces = paint_block(
          ctx,
          back,
          SEAT_HEIGHT - 1,
          SEAT_HEIGHT + BENCH_BACK_RISE,
          { top: shade(shell, 0.04), radius: 1.5, gloss: 0.4 },
          frame,
        );
        if (backSide === "east" || backSide === "west") {
          paint_back_edge(ctx, faces, backSide, shell);
          return;
        }
        const { front } = faces;
        // The seam between the two places, and the lumbar curve catching the light.
        line(
          ctx,
          front.x + front.width / 2,
          front.y + 1.5,
          front.x + front.width / 2,
          front.y + front.height - 1.5,
          css(shade(shell, 0.4), 0.6),
          0.9,
        );
        if (backSide === "north") {
          fill_rounded_rect(
            ctx,
            front.x + 3,
            front.y + 3,
            front.width - 6,
            1.8,
            0.9,
            css(0xffffff, 0.18),
          );
        }
      },
    },
  ]);
}

/**
 * Paints the three-person communal bench: three timber slats on dark steel U-frames, backless,
 * so diners can step over it from either side.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_slatted_bench(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const orientation = orient(box, rotation);
  const { width } = orientation;
  const cv = orientation.height / 2;
  const slatTop = SEAT_HEIGHT;
  const slatBottom = SEAT_HEIGHT - 2.5;
  const railBottom = slatBottom - 1.5;
  const frames = [14, width / 2, width - 14];
  const legPoints: Array<readonly [number, number]> = frames.flatMap((u) => [
    [u, cv - 5.5] as const,
    [u, cv + 5.5] as const,
  ]);
  const slats = [
    [cv - 7, cv - 2.6],
    [cv - 2.2, cv + 2.2],
    [cv + 2.6, cv + 7],
  ] as const;
  floor_shadow(ctx, ground_rect(orientation, 6, cv - 8, width - 6, cv + 7), { alpha: 0.2 });
  paint_peek_legs(ctx, orientation, legPoints, railBottom, 2.8, DARK_STEEL, frame);
  paint_parts([
    ...leg_parts(ctx, orientation, legPoints, railBottom, 2.8, DARK_STEEL, frame),
    ...frames.map((u): Part => {
      const rect = ground_rect(orientation, u - 1.5, cv - 7, u + 1.5, cv + 7);
      return {
        rect,
        z0: railBottom,
        // The cross rails sit under the slats, so they always paint before them.
        sortY: rect.y0,
        draw: () => {
          paint_block(
            ctx,
            rect,
            railBottom,
            slatBottom,
            { top: DARK_STEEL, radius: 0.5, gloss: 0.2 },
            frame,
          );
        },
      };
    }),
    ...slats.map(([v0, v1], index): Part => {
      const rect = ground_rect(orientation, 5, v0, width - 5, v1);
      const tone = index === 1 ? shade(TIMBER, 0.04) : tint(TIMBER, 0.04);
      return {
        rect,
        z0: slatBottom,
        draw: () => {
          paint_block(
            ctx,
            rect,
            slatBottom,
            slatTop,
            { top: tone, radius: 1.2, gloss: 0.25 },
            frame,
            (faces) => {
              if (frame.isLowDetail) return;
              const { x, y, width: faceWidth, height } = faces.top;
              wood_grain(
                ctx,
                x,
                y,
                faceWidth,
                height,
                tone,
                recipe.seed + index * 977,
                height > faceWidth,
              );
            },
          );
        },
      };
    }),
  ]);
}

/**
 * Paints vertical fluting over a padded panel: alternating shaded and lit channel seams.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the panel.
 * @param top - Top of the fluted area.
 * @param width - Panel width.
 * @param bottom - Bottom of the fluted area.
 * @param colour - The panel colour the seams are shaded from.
 */
function paint_fluting(
  ctx: PaintContext,
  x: number,
  top: number,
  width: number,
  bottom: number,
  colour: number,
): void {
  for (let fluteX = x + 7; fluteX < x + width - 3; fluteX += 7) {
    line(ctx, fluteX, top, fluteX, bottom, css(shade(colour, 0.45), 0.55), 0.9, "butt");
    line(ctx, fluteX + 1.2, top, fluteX + 1.2, bottom, css(0xffffff, 0.16), 0.9, "butt");
  }
}

/**
 * Paints the acoustic booth seat: a two-place cushion on an upholstered plinth, backed by a tall
 * fluted panel with a wing at each end, which together form a quiet pocket.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_booth(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const orientation = orient(box, rotation);
  const { width } = orientation;
  const cv = orientation.height / 2;
  const fabric = shade(recipe.accent, 0.05);
  const cushion = tint(recipe.accent, 0.28);
  const backTop = SEAT_HEIGHT + 13;
  const backSide = rotated_side(rotation, "north");
  const plinth = ground_rect(
    orientation,
    9,
    cv - SEAT_HALF_DEPTH + 1,
    width - 9,
    cv + SEAT_HALF_DEPTH,
  );
  const seat = ground_rect(orientation, 8, cv - SEAT_HALF_DEPTH, width - 8, cv + SEAT_HALF_DEPTH);
  const back = ground_rect(
    orientation,
    8,
    cv - SEAT_HALF_DEPTH - 7,
    width - 8,
    cv - SEAT_HALF_DEPTH,
  );
  const wings = [
    ground_rect(orientation, 4, cv - SEAT_HALF_DEPTH - 8, 8, cv + SEAT_HALF_DEPTH + 2),
    ground_rect(
      orientation,
      width - 8,
      cv - SEAT_HALF_DEPTH - 8,
      width - 4,
      cv + SEAT_HALF_DEPTH + 2,
    ),
  ];
  floor_shadow(ctx, ground_rect(orientation, 5, cv - 14, width - 5, cv + 9), { alpha: 0.26 });
  paint_parts([
    {
      rect: plinth,
      z0: 0,
      draw: () => {
        paint_block(
          ctx,
          plinth,
          0,
          SEAT_HEIGHT - 3,
          { top: shade(fabric, 0.4), radius: 1.5, gloss: 0 },
          frame,
        );
      },
    },
    {
      rect: seat,
      z0: SEAT_HEIGHT - 3,
      draw: () =>
        paint_block(
          ctx,
          seat,
          SEAT_HEIGHT - 3,
          SEAT_HEIGHT,
          { top: cushion, radius: 3, gloss: 0.2 },
          frame,
          (faces) => {
            const { x, y, width: faceWidth, height } = faces.top;
            if (faceWidth >= height)
              line(
                ctx,
                x + faceWidth / 2,
                y + 2,
                x + faceWidth / 2,
                y + height - 2,
                css(shade(cushion, 0.35), 0.7),
                1,
              );
            else
              line(
                ctx,
                x + 2,
                y + height / 2,
                x + faceWidth - 2,
                y + height / 2,
                css(shade(cushion, 0.35), 0.7),
                1,
              );
            stroke_rounded_rect(
              ctx,
              x + 1.4,
              y + 1.4,
              faceWidth - 2.8,
              height - 2.8,
              2,
              css(tint(cushion, 0.45), 0.75),
              0.9,
            );
          },
        ),
    },
    {
      rect: back,
      z0: SEAT_HEIGHT - 3,
      draw: () => {
        const faces = paint_block(
          ctx,
          back,
          SEAT_HEIGHT - 3,
          backTop,
          { top: tint(fabric, 0.1), radius: 2.5, gloss: 0.3 },
          frame,
        );
        const { front } = faces;
        if (backSide === "north" && !frame.isLowDetail) {
          paint_fluting(ctx, front.x, front.y + 2, front.width, front.y + front.height - 1, fabric);
        } else if (backSide === "south") {
          fill_rounded_rect(
            ctx,
            front.x + 3,
            front.y + 3,
            front.width - 6,
            front.height - 6,
            1.5,
            css(shade(fabric, 0.18)),
          );
        }
      },
    },
    ...wings.map((wing): Part => ({
      rect: wing,
      z0: 0,
      draw: () => {
        paint_block(
          ctx,
          wing,
          0,
          backTop - 1,
          { top: tint(fabric, 0.14), front: shade(fabric, 0.12), radius: 2, gloss: 0.3 },
          frame,
        );
      },
    })),
  ]);
}

/**
 * Paints a round seat: the side band (lit on its west side), the top lit from the north-west
 * (a padded dome with a sheen, or a flat moulded top with a lit lip) and the outline. Details are
 * added by the caller.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y of the top, on the texture.
 * @param radius - Seat radius.
 * @param thickness - Height of the side band.
 * @param colour - The seat material.
 * @param frame - The paint frame.
 * @param isDomed - True for a padded, domed top; false for a flat one.
 */
function paint_round_seat(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  colour: number,
  frame: PaintFrame,
  isDomed = true,
): void {
  const ry = radius * ROUND_SQUASH;
  const side = linear_gradient(ctx, cx - radius, 0, cx + radius, 0, [
    [0, tint(colour, 0.12)],
    [0.45, shade(colour, 0.12)],
    [1, shade(colour, 0.42)],
  ]);
  fill_ellipse(ctx, cx, cy + thickness, radius, ry, side);
  ctx.fillStyle = side;
  ctx.fillRect(cx - radius, cy, radius * 2, thickness);
  if (isDomed) {
    fill_ellipse(
      ctx,
      cx,
      cy,
      radius,
      ry,
      radial_gradient(ctx, cx - radius * 0.35, cy - ry * 0.45, 0.5, radius * 1.5, [
        [0, tint(colour, 0.45)],
        [0.5, colour],
        [1, shade(colour, 0.28)],
      ]),
    );
    ctx.save();
    ctx.translate(cx - radius * 0.38, cy - ry * 0.45);
    ctx.rotate(-Math.PI / 7);
    fill_ellipse(ctx, 0, 0, radius * 0.34, ry * 0.15, css(0xffffff, 0.5));
    ctx.restore();
  } else {
    fill_ellipse(
      ctx,
      cx,
      cy,
      radius,
      ry,
      linear_gradient(ctx, cx - radius, cy - ry, cx + radius * 0.5, cy + ry, [
        [0, tint(colour, 0.2)],
        [1, shade(colour, 0.08)],
      ]),
    );
    stroke_ellipse(ctx, cx, cy, radius - 0.9, ry - 0.9, css(tint(colour, 0.32)), 1.1);
  }
  const stroke = outline_style(frame, colour);
  ctx.beginPath();
  ctx.ellipse(cx, cy + thickness, radius, ry, 0, 0, Math.PI);
  ctx.ellipse(cx, cy, radius, ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.strokeStyle = stroke.style;
  ctx.lineWidth = stroke.width;
  ctx.stroke();
}

/**
 * Paints one moulded plastic stool leg: a flat leg that tapers from the seat to a rounded foot,
 * lit on its west edge.
 *
 * @param ctx - The paint context.
 * @param x0 - Centre x where the leg leaves the seat.
 * @param y0 - Y where the leg leaves the seat.
 * @param x1 - Centre x of the foot.
 * @param y1 - Y of the foot.
 * @param width - Width of the leg at the seat.
 * @param colour - The plastic.
 * @param frame - The paint frame.
 */
function paint_moulded_leg(
  ctx: PaintContext,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  colour: number,
  frame: PaintFrame,
): void {
  const foot = width * 0.6;
  const outline: Array<readonly [number, number]> = [
    [x0 - width / 2, y0],
    [x0 + width / 2, y0],
    [x1 + foot / 2, y1],
    [x1 - foot / 2, y1],
  ];
  if (frame.isHighContrast) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.beginPath();
    outline.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.strokeStyle = css(SHADOW_INK);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
  fill_polygon(
    ctx,
    outline,
    linear_gradient(ctx, Math.min(x0, x1) - width / 2, 0, Math.max(x0, x1) + width / 2, 0, [
      [0, tint(colour, 0.3)],
      [0.5, colour],
      [1, shade(colour, 0.35)],
    ]),
  );
  fill_ellipse(ctx, x1, y1, foot / 2 + 0.6, 0.9, css(shade(colour, 0.5)));
}

/**
 * Paints the stacking stool: the classic moulded hawker stool in red, green or blue (by the
 * recipe's detail variant): a flat round top with a raised lip and a small lifting hole, over a
 * deep skirt, on four legs of the same plastic that flare wide to the floor.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_stacking_stool(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const colour = STOOL_COLOURS[recipe.detailVariant % STOOL_COLOURS.length] as number;
  const cx = box.centreX;
  const groundY = box.centreY;
  const cy = groundY - SEAT_HEIGHT;
  const skirt = 3.75;
  const ry = STOOL_RADIUS * ROUND_SQUASH;
  const rimY = cy + skirt + ry * 0.55;
  floor_shadow(
    ctx,
    { x0: cx - 10.5, y0: groundY - 6, x1: cx + 10.5, y1: groundY + 6 },
    { round: true, alpha: 0.24 },
  );
  const legColour = shade(colour, 0.08);
  for (const side of [-1, 1] as const) {
    paint_moulded_leg(
      ctx,
      cx + side * 2.5,
      rimY + 1,
      cx + side * 5.5,
      groundY + 4,
      3,
      shade(legColour, 0.4),
      frame,
    );
  }
  for (const side of [-1, 1] as const) {
    paint_moulded_leg(
      ctx,
      cx + side * 5.8,
      rimY,
      cx + side * 10.2,
      groundY + 6.6,
      4.4,
      legColour,
      frame,
    );
  }
  // The stretcher ring that braces the legs, seen across the front.
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 1, 8, 3.2, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.strokeStyle = css(shade(colour, 0.25));
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // The skirt: lit along its upper lip, shaded towards its bottom edge and its east side.
  const skirtStyle = linear_gradient(ctx, cx - STOOL_RADIUS, 0, cx + STOOL_RADIUS, 0, [
    [0, tint(colour, 0.08)],
    [0.45, shade(colour, 0.14)],
    [1, shade(colour, 0.4)],
  ]);
  fill_ellipse(ctx, cx, cy + skirt, STOOL_RADIUS, ry, skirtStyle);
  ctx.fillStyle = skirtStyle;
  ctx.fillRect(cx - STOOL_RADIUS, cy, STOOL_RADIUS * 2, skirt);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1.1, STOOL_RADIUS - 0.4, ry - 0.2, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.strokeStyle = css(tint(colour, 0.32), 0.85);
  ctx.lineWidth = 1;
  ctx.stroke();
  // The flat top, with the raised lip around it.
  fill_ellipse(
    ctx,
    cx,
    cy,
    STOOL_RADIUS,
    ry,
    linear_gradient(ctx, cx - STOOL_RADIUS, cy - ry, cx + STOOL_RADIUS * 0.5, cy + ry, [
      [0, tint(colour, 0.2)],
      [1, shade(colour, 0.06)],
    ]),
  );
  stroke_ellipse(ctx, cx, cy, STOOL_RADIUS - 1, ry - 1, css(tint(colour, 0.35)), 1.4);
  stroke_ellipse(
    ctx,
    cx,
    cy + 0.3,
    STOOL_RADIUS - 2.3,
    ry - 2.1,
    css(shade(colour, 0.3), 0.45),
    0.7,
  );
  const stroke = outline_style(frame, colour);
  ctx.beginPath();
  ctx.ellipse(cx, cy + skirt, STOOL_RADIUS, ry, 0, 0, Math.PI);
  ctx.ellipse(cx, cy, STOOL_RADIUS, ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.strokeStyle = stroke.style;
  ctx.lineWidth = stroke.width;
  ctx.stroke();
  // The lifting hole in the middle of the top.
  fill_ellipse(ctx, cx, cy + 0.2, 1.7, 1.1, css(shade(colour, 0.6)));
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.2, 1.7, 1.1, 0, Math.PI * 0.1, Math.PI * 0.9);
  ctx.strokeStyle = css(tint(colour, 0.3), 0.8);
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

/**
 * Paints the high counter stool: a small padded vinyl seat with a chrome rim on four thin chrome
 * legs that splay wide to the floor, braced by a footring.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 */
function paint_counter_stool(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
): void {
  const cx = box.centreX;
  const groundY = box.centreY;
  const cy = groundY - SEAT_HEIGHT;
  const thickness = 2;
  const ry = COUNTER_RADIUS * ROUND_SQUASH;
  const underY = cy + thickness + ry * 0.5;
  const footY = groundY + 9;
  const ringY = groundY + 2.5;
  floor_shadow(
    ctx,
    { x0: cx - 11, y0: groundY - 4, x1: cx + 11, y1: groundY + 9 },
    { round: true, alpha: 0.18 },
  );
  // Far legs, the footring, then the near legs over it.
  for (const side of [-1, 1] as const) {
    paint_strut(
      ctx,
      cx + side * 2.5,
      underY,
      cx + side * 6.5,
      footY - 4,
      1.6,
      shade(STEEL, 0.45),
      frame,
    );
  }
  stroke_ellipse(ctx, cx, ringY, 9.5, 3.4, css(shade(STEEL, 0.3)), 1.8);
  ctx.beginPath();
  ctx.ellipse(cx, ringY, 9.5, 3.4, 0, Math.PI * 0.1, Math.PI * 0.9);
  ctx.strokeStyle = css(tint(STEEL, 0.4));
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for (const side of [-1, 1] as const) {
    paint_strut(ctx, cx + side * 4.5, underY, cx + side * 11, footY, 2, STEEL, frame);
    fill_ellipse(ctx, cx + side * 11, footY + 0.2, 1.6, 0.8, css(shade(DARK_STEEL, 0.4)));
  }
  paint_round_seat(ctx, cx, cy, COUNTER_RADIUS, thickness, recipe.accent, frame);
  stroke_ellipse(ctx, cx, cy, COUNTER_RADIUS - 0.7, ry - 0.7, css(tint(STEEL, 0.3)), 1.2);
  if (!frame.isLowDetail) {
    stroke_ellipse(
      ctx,
      cx,
      cy,
      COUNTER_RADIUS * 0.55,
      ry * 0.55,
      css(shade(recipe.accent, 0.3), 0.5),
      0.8,
    );
  }
}

/**
 * Paints the wrap-around back of the swivel perch: a slim, dark padded rail that curves around the
 * seat's rim on the side the backrest faces, held on two chrome stems with a clear gap above the
 * seat, so the round seat stays the dominant shape.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the seat.
 * @param cy - Centre y of the seat's top.
 * @param side - The side the backrest stands on.
 * @param colour - The backrest pad's material.
 * @param frame - The paint frame.
 */
function paint_wrap_back(
  ctx: PaintContext,
  cx: number,
  cy: number,
  side: Side,
  colour: number,
  frame: PaintFrame,
): void {
  const centre = { north: -Math.PI / 2, east: 0, south: Math.PI / 2, west: Math.PI }[side];
  const span = Math.PI * 0.36;
  const gap = 3;
  const padHeight = 3;
  const radius = PERCH_RADIUS - 0.5;
  const ry = radius * ROUND_SQUASH;
  const steps = 12;
  const rim: Array<readonly [number, number]> = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = centre - span + (step / steps) * span * 2;
    rim.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * ry]);
  }
  // The two chrome stems from the seat's rim up to the pad.
  for (const index of [2, steps - 2]) {
    const [stemX, stemY] = rim[index] as readonly [number, number];
    if (frame.isHighContrast) line(ctx, stemX, stemY, stemX, stemY - gap - 1, css(SHADOW_INK), 2.4);
    line(ctx, stemX, stemY + 0.5, stemX, stemY - gap - 1, css(shade(STEEL, 0.15)), 1.3);
    line(ctx, stemX - 0.3, stemY, stemX - 0.3, stemY - gap - 1, css(tint(STEEL, 0.4)), 0.5);
  }
  const lift = (offset: number) => rim.map(([x, y]) => [x, y - offset] as const);
  const band: Array<readonly [number, number]> = [...lift(gap + padHeight), ...lift(gap).reverse()];
  if (frame.isHighContrast) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.beginPath();
    band.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.strokeStyle = css(SHADOW_INK);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  const pad = side === "north" ? colour : shade(colour, 0.2);
  fill_polygon(
    ctx,
    band,
    linear_gradient(ctx, 0, cy - gap - padHeight - ry, 0, cy + ry - gap, [
      [0, tint(pad, 0.2)],
      [1, shade(pad, 0.2)],
    ]),
  );
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  lift(gap + padHeight).forEach(([x, y], index) =>
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
  );
  ctx.strokeStyle = css(tint(pad, 0.45), 0.9);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints the swivel perch: a floor-fixed round seat with a wrap-around back that turns with the
 * placement, on a chrome column and base plate.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation, which turns the back.
 */
function paint_swivel_perch(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const cx = box.centreX;
  const groundY = box.centreY;
  const cy = groundY - SEAT_HEIGHT;
  const thickness = 2.5;
  const backSide = rotated_side(rotation, "north");
  const seatColour = recipe.accent;
  floor_shadow(
    ctx,
    { x0: cx - 9, y0: groundY - 5, x1: cx + 9, y1: groundY + 6 },
    { round: true, alpha: 0.22 },
  );
  const plateY = groundY + 5;
  fill_ellipse(ctx, cx, plateY + 0.6, 7.5, 2.8, css(shade(DARK_STEEL, 0.35)));
  fill_ellipse(
    ctx,
    cx,
    plateY,
    7,
    2.4,
    linear_gradient(ctx, cx - 7, 0, cx + 7, 0, [
      [0, tint(STEEL, 0.2)],
      [1, shade(STEEL, 0.35)],
    ]),
  );
  // The footring around the column: its far half behind the column, its near half in front.
  const ringY = groundY - 1;
  ctx.beginPath();
  ctx.ellipse(cx, ringY, 6.5, 2.2, 0, Math.PI, TAU);
  ctx.strokeStyle = css(shade(STEEL, 0.35));
  ctx.lineWidth = 1.3;
  ctx.stroke();
  paint_post(ctx, cx, plateY - 0.5, 0, plateY - 0.5 - (cy + thickness + 3), 3.4, STEEL, frame);
  ctx.beginPath();
  ctx.ellipse(cx, ringY, 6.5, 2.2, 0, 0, Math.PI);
  ctx.strokeStyle = css(tint(STEEL, 0.25));
  ctx.lineWidth = 1.4;
  ctx.stroke();
  const pad = mix(shade(seatColour, 0.5), PERCH_PAD, 0.6);
  if (backSide === "north") paint_wrap_back(ctx, cx, cy, backSide, pad, frame);
  paint_round_seat(ctx, cx, cy, PERCH_RADIUS, thickness, seatColour, frame, false);
  stroke_ellipse(
    ctx,
    cx,
    cy,
    PERCH_RADIUS - 0.7,
    PERCH_RADIUS * ROUND_SQUASH - 0.7,
    css(tint(STEEL, 0.3), 0.9),
    1,
  );
  if (backSide !== "north") paint_wrap_back(ctx, cx, cy, backSide, pad, frame);
}

/**
 * Reports whether a seat has a solid backrest that rises from its seat (the chairs, the
 * two-person bench's moulded back and the booth's back). Turned to 180 degrees, such a backrest
 * stands between the camera and the diner and hides the seat behind it, so the world view sorts
 * the seat just after its sitter. The swivel perch's slim back rail stands clear of its seat, so
 * it sorts like the backless stools: drawn after the sitter, its seat would cover their hips.
 *
 * @param recipe - The seat's recipe.
 * @returns True for seats with a solid backrest; false for stools and the slatted bench.
 */
export function has_backrest(recipe: PlaceableVisualRecipe): boolean {
  const style = resolve_placeable_style("seat", recipe);
  if (style === "stool") return false;
  if (style === "bench") return !recipe.motif.includes("three-person");
  return true;
}

/**
 * Paints a seat in the 3/4 view, turned to its placement rotation.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box (the rotated footprint, top at the overhang).
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation: 0 puts a backrest to the north with the sitter
 *   facing south, and each quarter turn turns it clockwise. Defaults to the authored orientation.
 */
export function paint_seat(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  const style = resolve_placeable_style("seat", recipe);
  const motif = recipe.motif;
  if (style === "stool") {
    if (motif.includes("high-counter")) paint_counter_stool(ctx, box, recipe, frame);
    else if (motif.includes("swivel")) paint_swivel_perch(ctx, box, recipe, frame, rotation);
    else paint_stacking_stool(ctx, box, recipe, frame);
    return;
  }
  if (style === "bench") {
    const turned = fit_rotation(box, rotation);
    if (motif.includes("acoustic")) paint_booth(ctx, box, recipe, frame, turned);
    else if (motif.includes("three-person")) paint_slatted_bench(ctx, box, recipe, frame, turned);
    else paint_moulded_bench(ctx, box, recipe, frame, turned);
    return;
  }
  if (motif.includes("cushioned")) paint_cushioned_chair(ctx, box, recipe, frame, rotation);
  else if (motif.includes("easy-rise") || motif.includes("arm-chair")) {
    paint_arm_chair(ctx, box, recipe, frame, rotation);
  } else if (motif.includes("booster")) paint_booster_chair(ctx, box, recipe, frame, rotation);
  else paint_moulded_chair(ctx, box, recipe, frame, rotation);
}
