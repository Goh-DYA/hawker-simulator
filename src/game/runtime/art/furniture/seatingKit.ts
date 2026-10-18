/**
 * The oblique-view kit the table and seat painters share: turning an authored (rotation 0)
 * furniture layout into the rotated footprint, and painting blocks, posts and struts the way the
 * 3/4 view sees them.
 *
 * The view looks down from the south: a point on the floor at texture `(x, y)` that stands `z`
 * pixels above the floor is drawn at `(x, y - z)`. A block therefore shows its top face (its
 * floor rectangle moved up by its height) and its south face below it; north faces are hidden and
 * east and west faces are seen edge-on. Furniture is authored in a local frame (`u` east, `v`
 * south, the unrotated footprint's top-left at the origin) and turned clockwise into the rotated
 * footprint, so light, shadows and front faces stay put whichever way an object faces.
 */
import type { Rotation } from "@/src/game/core";

import {
  contact_shadow,
  css,
  fill_ellipse,
  fill_rounded_rect,
  line,
  linear_gradient,
  rounded_rect_path,
  shade,
  SHADOW_INK,
  stroke_rounded_rect,
  tint,
  type PaintContext,
  type PaintStyle,
} from "../canvas";
import type { PaintFrame } from "../specs";
import type { Box } from "./shared";

/** A resolved outline stroke. */
export interface Outline {
  readonly style: string;
  readonly width: number;
}

/** A rectangle on the floor, in texture pixels, before any height lifts it. */
export interface GroundRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** A rectangle on the texture, after the view has lifted it. */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The two visible faces of a block: the top and the south face below it. */
export interface BlockFaces {
  readonly top: ScreenRect;
  readonly front: ScreenRect;
}

/** How a piece of furniture is turned inside its footprint. */
export interface Orientation {
  readonly box: Box;
  readonly rotation: Rotation;
  /** Width of the unrotated (authored) footprint. */
  readonly width: number;
  /** Height of the unrotated (authored) footprint. */
  readonly height: number;
}

/** The compass side an authored north edge ends up on after each rotation. */
const NORTH_AFTER_ROTATION: Readonly<Record<Rotation, Side>> = {
  0: "north",
  90: "east",
  180: "south",
  270: "west",
};

/** A compass side of a footprint. */
export type Side = "north" | "east" | "south" | "west";

/** A part of a piece of furniture, painted in back-to-front order. */
export interface Part {
  /** The part's floor rectangle. */
  readonly rect: GroundRect;
  /** Height of the part's underside. */
  readonly z0: number;
  /** Optional sort line overriding the rectangle's south edge (for parts resting on others). */
  readonly sortY?: number;
  /** Paints the part. */
  readonly draw: () => void;
}

/** Material settings of a block. */
export interface BlockMaterial {
  /** Colour of the top face. */
  readonly top: number;
  /** Colour of the south face; a shade of the top by default. */
  readonly front?: number;
  /** Corner radius of the top face. */
  readonly radius?: number;
  /** Strength of the lit arris along the top's south edge. */
  readonly gloss?: number;
  /** A custom fill for the south face, replacing the default gradient. */
  readonly frontStyle?: PaintStyle;
}

/**
 * Picks the outline stroke: thin and tinted, or thick ink in the high-contrast frame.
 *
 * @param frame - The paint frame.
 * @param base - The colour a tinted outline is shaded from.
 * @returns The stroke style and width.
 */
export function outline_style(frame: PaintFrame, base: number): Outline {
  return frame.isHighContrast
    ? { style: css(SHADOW_INK), width: 2 }
    : { style: css(shade(base, 0.55), 0.7), width: 0.9 };
}

/**
 * Builds the orientation of a piece of furniture from its footprint box and rotation.
 *
 * @param box - The rotated footprint box.
 * @param rotation - The placement rotation, clockwise.
 * @returns The orientation, with the authored footprint size.
 */
export function orient(box: Box, rotation: Rotation): Orientation {
  const isQuarterTurn = rotation === 90 || rotation === 270;
  return {
    box,
    rotation,
    width: isQuarterTurn ? box.height : box.width,
    height: isQuarterTurn ? box.width : box.height,
  };
}

/**
 * Makes a rotation agree with a long footprint's shape: a long object whose box runs north-south
 * is turned a quarter, so it still runs along its footprint when a caller passes no rotation.
 * A rotation that already agrees, and any square footprint, is returned unchanged.
 *
 * @param box - The rotated footprint box.
 * @param rotation - The placement rotation.
 * @returns The rotation to paint with.
 */
export function fit_rotation(box: Box, rotation: Rotation): Rotation {
  const isQuarterTurn = rotation === 90 || rotation === 270;
  if (box.width === box.height || box.height > box.width === isQuarterTurn) return rotation;
  return ((rotation + 90) % 360) as Rotation;
}

/**
 * Turns an authored floor point into the rotated footprint.
 *
 * @param orientation - The orientation.
 * @param u - Authored x, from the unrotated footprint's west edge.
 * @param v - Authored y, from the unrotated footprint's north edge.
 * @returns The texture floor point.
 */
export function to_ground(
  orientation: Orientation,
  u: number,
  v: number,
): { x: number; y: number } {
  const { box, width, height } = orientation;
  switch (orientation.rotation) {
    case 90:
      return { x: box.x + height - v, y: box.y + u };
    case 180:
      return { x: box.x + width - u, y: box.y + height - v };
    case 270:
      return { x: box.x + v, y: box.y + width - u };
    default:
      return { x: box.x + u, y: box.y + v };
  }
}

/**
 * Turns an authored floor rectangle into the rotated footprint.
 *
 * @param orientation - The orientation.
 * @param u0 - Authored west edge.
 * @param v0 - Authored north edge.
 * @param u1 - Authored east edge.
 * @param v1 - Authored south edge.
 * @returns The texture floor rectangle.
 */
export function ground_rect(
  orientation: Orientation,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): GroundRect {
  const first = to_ground(orientation, u0, v0);
  const second = to_ground(orientation, u1, v1);
  return {
    x0: Math.min(first.x, second.x),
    y0: Math.min(first.y, second.y),
    x1: Math.max(first.x, second.x),
    y1: Math.max(first.y, second.y),
  };
}

/**
 * Reports which side an authored side ends up on after the rotation.
 *
 * @param rotation - The placement rotation.
 * @param side - The authored side.
 * @returns The rotated side.
 */
export function rotated_side(rotation: Rotation, side: Side): Side {
  const order: readonly Side[] = ["north", "east", "south", "west"];
  const turns = order.indexOf(NORTH_AFTER_ROTATION[rotation]);
  return order[(order.indexOf(side) + turns) % 4] as Side;
}

/**
 * Gives the faces a block shows: its floor rectangle lifted to its top, and its south face.
 *
 * @param rect - The floor rectangle.
 * @param z0 - Height of the underside.
 * @param z1 - Height of the top.
 * @returns The top and south faces in texture pixels.
 */
export function block_faces(rect: GroundRect, z0: number, z1: number): BlockFaces {
  const width = rect.x1 - rect.x0;
  return {
    top: { x: rect.x0, y: rect.y0 - z1, width, height: rect.y1 - rect.y0 },
    front: { x: rect.x0, y: rect.y1 - z1, width, height: Math.max(0, z1 - z0) },
  };
}

/**
 * Paints parts back to front: by the south edge (or sort line) of each part, then from the floor up.
 *
 * @param parts - The parts.
 */
export function paint_parts(parts: readonly Part[]): void {
  const ordered = [...parts].sort(
    (first, second) =>
      (first.sortY ?? first.rect.y1) - (second.sortY ?? second.rect.y1) || first.z0 - second.z0,
  );
  for (const part of ordered) part.draw();
}

/**
 * Paints a block: the shaded south face, the lit top face, an optional dressing of the top (the
 * context is clipped to it), the lit arris along the top's south edge and the outline.
 *
 * @param ctx - The paint context.
 * @param rect - The floor rectangle.
 * @param z0 - Height of the underside.
 * @param z1 - Height of the top.
 * @param material - The block's colours and corner radius.
 * @param frame - The paint frame.
 * @param dress - Paints material detail over the top face, clipped to it.
 * @returns The faces that were painted.
 */
export function paint_block(
  ctx: PaintContext,
  rect: GroundRect,
  z0: number,
  z1: number,
  material: BlockMaterial,
  frame: PaintFrame,
  dress?: (faces: BlockFaces) => void,
): BlockFaces {
  const faces = block_faces(rect, z0, z1);
  const { top, front } = faces;
  const radius = Math.max(0, Math.min(material.radius ?? 1.5, top.width / 2, top.height / 2));
  const frontColour = material.front ?? shade(material.top, 0.3);
  if (front.height > 0) {
    fill_rounded_rect(
      ctx,
      front.x,
      front.y - radius,
      front.width,
      front.height + radius,
      Math.min(radius, (front.height + radius) / 2),
      material.frontStyle ??
        linear_gradient(ctx, 0, front.y, 0, front.y + front.height, [
          [0, tint(frontColour, 0.1)],
          [1, shade(frontColour, 0.18)],
        ]),
    );
  }
  fill_rounded_rect(
    ctx,
    top.x,
    top.y,
    top.width,
    top.height,
    radius,
    linear_gradient(ctx, top.x, top.y, top.x + top.width * 0.35, top.y + top.height, [
      [0, tint(material.top, 0.16)],
      [1, shade(material.top, 0.07)],
    ]),
  );
  if (dress) {
    ctx.save();
    rounded_rect_path(ctx, top.x, top.y, top.width, top.height, radius);
    ctx.clip();
    dress(faces);
    ctx.restore();
  }
  const gloss = material.gloss ?? 0.28;
  if (gloss > 0 && top.width > radius * 2 + 2) {
    line(
      ctx,
      top.x + radius + 0.5,
      top.y + top.height - 0.6,
      top.x + top.width - radius - 0.5,
      top.y + top.height - 0.6,
      css(0xffffff, gloss),
      0.9,
      "butt",
    );
  }
  const stroke = outline_style(frame, material.top);
  stroke_rounded_rect(
    ctx,
    top.x,
    top.y,
    top.width,
    top.height + front.height,
    radius,
    stroke.style,
    stroke.width,
  );
  return faces;
}

/**
 * Paints an upright post (a leg, a column or a backrest stile) seen from the south: a rounded
 * bar lit on its west side, with a darker foot cap where it meets the floor.
 *
 * @param ctx - The paint context.
 * @param x - Centre x of the post.
 * @param groundY - Floor y of the post's south face.
 * @param z0 - Height of the post's foot.
 * @param z1 - Height of the post's top.
 * @param width - Width of the post.
 * @param colour - The post material.
 * @param frame - The paint frame.
 */
export function paint_post(
  ctx: PaintContext,
  x: number,
  groundY: number,
  z0: number,
  z1: number,
  width: number,
  colour: number,
  frame: PaintFrame,
): void {
  const top = groundY - z1;
  const height = Math.max(0.5, z1 - z0);
  const left = x - width / 2;
  fill_rounded_rect(
    ctx,
    left,
    top,
    width,
    height,
    Math.min(width / 2, 1.2),
    linear_gradient(ctx, left, 0, left + width, 0, [
      [0, tint(colour, 0.32)],
      [0.45, colour],
      [1, shade(colour, 0.38)],
    ]),
  );
  if (frame.isHighContrast) {
    stroke_rounded_rect(
      ctx,
      left,
      top,
      width,
      height,
      Math.min(width / 2, 1.2),
      css(SHADOW_INK),
      1,
    );
  }
  if (z0 <= 0.01) {
    fill_ellipse(ctx, x, groundY - 0.3, width / 2 + 0.5, 0.9, css(shade(colour, 0.5)));
  }
}

/**
 * Paints a slanted strut (a splayed leg or a brace) as a lit tube.
 *
 * @param ctx - The paint context.
 * @param x0 - Start x.
 * @param y0 - Start y.
 * @param x1 - End x.
 * @param y1 - End y.
 * @param width - Tube width.
 * @param colour - The tube material.
 * @param frame - The paint frame.
 */
export function paint_strut(
  ctx: PaintContext,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  colour: number,
  frame: PaintFrame,
): void {
  if (frame.isHighContrast) line(ctx, x0, y0, x1, y1, css(SHADOW_INK), width + 1.6);
  line(ctx, x0, y0, x1, y1, css(shade(colour, 0.18)), width);
  line(
    ctx,
    x0 - width * 0.22,
    y0,
    x1 - width * 0.22,
    y1,
    css(tint(colour, 0.35), 0.75),
    Math.max(0.6, width * 0.35),
  );
}

/**
 * Paints the soft shadow a piece of furniture casts on the floor, offset to the south-east.
 *
 * @param ctx - The paint context.
 * @param rect - The floor rectangle the shadow is cast from.
 * @param options - `round` for an elliptical shadow and `alpha` for its darkness.
 */
export function floor_shadow(
  ctx: PaintContext,
  rect: GroundRect,
  options: { round?: boolean; alpha?: number } = {},
): void {
  contact_shadow(ctx, rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0, {
    round: options.round,
    inset: 0,
    offsetX: 2,
    offsetY: 3,
    alpha: options.alpha ?? 0.22,
  });
}
