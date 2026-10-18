/**
 * Upright construction shared by the signage, divider and decor painters, in the 3/4 oblique
 * view: weighted base plates and posts, framed boards with a lit top edge, soft floor shadows
 * cast to the south-east, direction arrows for wayfinding faces, and the face geometry of a
 * straight wall-like piece seen along its length (east-west) or end-on (north-south).
 *
 * A wall-like piece stands on a ground band inside its footprint. Running east-west, its top
 * surface is the ground band lifted by its height and its south face hangs below that top.
 * Running north-south, it shows its top surface as a long strip, its south end face, and a thin
 * sliver of the long side its front was turned towards (west at rotation 90, east at 270).
 *
 * Pieces that guests walk under (the hung signs and panels) hang from the ceiling: their rods
 * rise out of the texture's top edge, and they throw only a faint, diffuse shadow on the floor
 * far below them.
 */
import type { Rotation } from "@/src/game/core";

import {
  css,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  line,
  linear_gradient,
  radial_gradient,
  SHADOW_INK,
  shade,
  slab,
  stroke_ellipse,
  stroke_rounded_rect,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import { type Box, DARK_STEEL } from "./shared";

/** Ink for sign text, pictograms and clock hands. */
export const INK = 0x263238;
/** The warm cream of printed sign faces, pennants and paper. */
export const CREAM = 0xfbf0dc;
/** Teal structural steel. */
export const TEAL_STEEL = 0x167d7f;
/** The deep end of the teal steel ramp, for skirtings and frames. */
export const DEEP_TEAL = 0x0f5f61;
/** Zinc of caps and rails. */
export const ZINC = 0x9aa8a6;
/** Vermilion accent. */
export const VERMILION = 0xd95d39;
/** Mustard accent. */
export const MUSTARD = 0xd5a021;
/** Leaf green. */
export const LEAF = 0x4f7d4a;
/** Warm lamp light, for backlit signs. */
export const LAMP_LIGHT = 0xffd98a;
/** The light terrazzo of copings and plinths. */
export const TERRAZZO = 0xe9decb;
/** Terrazzo chips scattered over copings and plinths. */
export const TERRAZZO_CHIPS = [0xd9c7a8, 0xb9a58a] as const;
/** Grout between tiles. */
export const GROUT = 0xcdbb9c;
/** Hall plaster. */
export const PLASTER = 0xf4e7d3;

/** Width of the side sliver a north-south piece shows of its long face. */
export const SIDE_SLIVER = 4;

/** A rectangle in texture pixels. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A compass heading on the floor plan; screen up is north. */
export type Heading = "east" | "south" | "west" | "north";

/** The long side of a north-south piece that shows as a sliver. */
export type Side = "west" | "east";

/** Where an authored east-pointing arrow points after each clockwise quarter turn. */
const HEADING_BY_ROTATION: Readonly<Record<Rotation, Heading>> = {
  0: "east",
  90: "south",
  180: "west",
  270: "north",
};

/** The screen angle of each heading, for turning a right-pointing glyph. */
const HEADING_ANGLE: Readonly<Record<Heading, number>> = {
  east: 0,
  south: Math.PI / 2,
  west: Math.PI,
  north: -Math.PI / 2,
};

/**
 * Gives the heading an authored east-pointing arrow has after a placement rotation.
 *
 * @param rotation - The placement rotation, clockwise.
 * @returns The heading.
 */
export function heading_for_rotation(rotation: Rotation): Heading {
  return HEADING_BY_ROTATION[rotation];
}

/**
 * Reports whether a rotation turns an east-west piece to run north-south.
 *
 * @param rotation - The placement rotation.
 * @returns True at 90 and 270 degrees.
 */
export function is_north_south(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}

/**
 * Gives the long side a north-south piece shows: its front (authored south) face turns west at
 * 90 degrees and east at 270.
 *
 * @param rotation - The placement rotation.
 * @returns The visible side.
 */
export function side_for_rotation(rotation: Rotation): Side {
  return rotation === 270 ? "east" : "west";
}

/** Which way a floor shadow fades: away from what casts it, or not at all. */
export type ShadowFade = "south" | "east" | "none";

/**
 * Paints a soft shadow on the floor, darkest where it meets what casts it and fading away from
 * it, clipped to the footprint's left, right and bottom edges so it never spills outside.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box the shadow is clipped to.
 * @param x - Left edge of the shadow shape.
 * @param y - Top edge of the shadow shape.
 * @param width - Width of the shadow shape.
 * @param height - Height of the shadow shape.
 * @param alpha - Darkness of the shadow at its darkest.
 * @param fade - `south` fades it downwards, `east` to the right, `none` keeps it even.
 */
export function floor_shadow(
  ctx: PaintContext,
  box: Box,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.2,
  fade: ShadowFade = "south",
): void {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const stops = [
    [0, SHADOW_INK, alpha],
    [0.55, SHADOW_INK, alpha * 0.55],
    [1, SHADOW_INK, 0],
  ] as const;
  const style =
    fade === "south"
      ? linear_gradient(ctx, 0, y, 0, y + h, stops)
      : fade === "east"
        ? linear_gradient(ctx, x, 0, x + w, 0, stops)
        : css(SHADOW_INK, alpha * 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, 0, box.width, box.bottom);
  ctx.clip();
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = css(SHADOW_INK, alpha * 0.6);
  fill_rounded_rect(ctx, x, y, w, h, Math.min(4, h / 2, w / 2), style);
  ctx.restore();
}

/**
 * Paints a hanger rod dropping from the ceiling, out of the texture's top edge, to the piece it
 * holds, with a small clamp where it meets the piece.
 *
 * @param ctx - The paint context.
 * @param x - Centre x of the rod.
 * @param bottom - Texture y where the rod meets the piece.
 * @param frame - The paint frame; high contrast inks the rod.
 */
export function paint_hanger(
  ctx: PaintContext,
  x: number,
  bottom: number,
  frame: PaintFrame,
): void {
  const rod = frame.isHighContrast ? SHADOW_INK : shade(DARK_STEEL, 0.15);
  line(ctx, x, 0, x, bottom, css(rod), frame.isHighContrast ? 1.6 : 1.1, "butt");
  if (!frame.isLowDetail) {
    line(ctx, x - 0.3, 0, x - 0.3, bottom - 1, css(0xffffff, 0.3), 0.4, "butt");
  }
  fill_rounded_rect(ctx, x - 1.7, bottom - 1.8, 3.4, 2.4, 0.7, css(shade(DARK_STEEL, 0.1)));
}

/**
 * Paints the faint, diffuse shadow a ceiling-hung piece throws on the floor far below it.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box the shadow is clipped to.
 * @param x - Left edge of the shadow.
 * @param y - Top edge of the shadow.
 * @param width - Width of the shadow.
 * @param alpha - Darkness of the shadow.
 */
export function hung_shadow(
  ctx: PaintContext,
  box: Box,
  x: number,
  y: number,
  width: number,
  alpha = 0.1,
): void {
  const radius_x = Math.max(1, width / 2);
  const radius_y = 3.5;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, 0, box.width, box.bottom);
  ctx.clip();
  ctx.translate(x + radius_x, y + radius_y);
  ctx.scale(1, radius_y / radius_x);
  fill_ellipse(
    ctx,
    0,
    0,
    radius_x,
    radius_x,
    radial_gradient(ctx, 0, 0, 0, radius_x, [
      [0, SHADOW_INK, alpha],
      [0.6, SHADOW_INK, alpha * 0.55],
      [1, SHADOW_INK, 0],
    ]),
  );
  ctx.restore();
}

/**
 * Gives the floor line under a hung piece: a little below the piece, so its shadow reads as
 * cast from high up, and inside the footprint.
 *
 * @param box - The footprint box.
 * @param bottom - Texture y of the piece's bottom edge.
 * @returns The texture y of the top of the piece's floor shadow.
 */
export function hung_floor_line(box: Box, bottom: number): number {
  return Math.min(box.bottom - 10, bottom + 13);
}

/**
 * Paints a round weighted base plate seen from above: its soft shadow, a shaded front rim and a
 * lit top with a specular.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the plate.
 * @param cy - Centre y of the plate's top.
 * @param radius - Horizontal radius of the plate.
 * @param colour_value - The plate's material colour.
 * @param frame - The paint frame; high contrast adds an ink rim.
 */
export function paint_weighted_base(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  colour_value: number,
  frame: PaintFrame,
): void {
  const radius_y = radius * 0.42;
  fill_ellipse(ctx, cx + 2, cy + 3, radius + 1, radius_y + 1.2, css(SHADOW_INK, 0.16));
  fill_ellipse(ctx, cx, cy + 2, radius, radius_y, css(shade(colour_value, 0.45)));
  fill_ellipse(
    ctx,
    cx,
    cy,
    radius,
    radius_y,
    radial_gradient(ctx, cx - radius * 0.3, cy - radius_y * 0.4, 0, radius, [
      [0, tint(colour_value, 0.3)],
      [1, shade(colour_value, 0.16)],
    ]),
  );
  fill_ellipse(
    ctx,
    cx - radius * 0.35,
    cy - radius_y * 0.3,
    radius * 0.28,
    radius_y * 0.3,
    css(0xffffff, 0.22),
  );
  if (frame.isHighContrast) {
    stroke_ellipse(ctx, cx, cy + 1, radius, radius_y + 1, css(SHADOW_INK), 1.5);
  }
}

/**
 * Paints a vertical post: a cylinder lit on its left side, a collar at its top and ambient
 * occlusion where it meets whatever it stands on.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the post.
 * @param top - Texture y of the post's top.
 * @param bottom - Texture y where the post meets its base.
 * @param colour_value - The post's material colour.
 * @param width - Post width in pixels.
 * @param frame - The paint frame; high contrast adds an ink edge.
 */
export function paint_post(
  ctx: PaintContext,
  cx: number,
  top: number,
  bottom: number,
  colour_value: number,
  width: number,
  frame: PaintFrame,
): void {
  const left = cx - width / 2;
  fill_ellipse(ctx, cx, bottom, width * 0.9, 1.6, css(SHADOW_INK, 0.28));
  fill_rounded_rect(
    ctx,
    left,
    top,
    width,
    bottom - top,
    width / 2,
    linear_gradient(ctx, left, 0, left + width, 0, [
      [0, tint(colour_value, 0.35)],
      [0.45, colour_value],
      [1, shade(colour_value, 0.45)],
    ]),
  );
  fill_rounded_rect(ctx, left - 0.6, top, width + 1.2, 2.4, 1, css(shade(colour_value, 0.3)));
  if (frame.isHighContrast) {
    stroke_rounded_rect(ctx, left, top, width, bottom - top, width / 2, css(SHADOW_INK), 1.2);
  }
}

/**
 * Paints a small foot plate seen from above: a lit top and a shaded front lip.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x of the plate.
 * @param y - Top edge of the plate's top surface.
 * @param width - Plate width.
 * @param depth - Depth of the top surface.
 * @param colour_value - Plate colour.
 */
export function paint_foot_plate(
  ctx: PaintContext,
  cx: number,
  y: number,
  width: number,
  depth: number,
  colour_value: number,
): void {
  slab(ctx, cx - width / 2, y, width, depth, 1.6, 1.2, colour_value, { gloss: 0.15 });
}

/**
 * Paints a framed board that faces the camera: the frame's lit top edge seen from above, the
 * frame lit on the left and shaded on the right, and the face recessed inside it with the
 * frame's lip shading its top edge.
 *
 * @param ctx - The paint context.
 * @param rect - The board's front face, frame included.
 * @param frame_colour - The frame material.
 * @param face_colour - The face colour.
 * @param frame - The paint frame.
 * @param border - Width of the frame around the face.
 * @returns The face rectangle inside the frame.
 */
export function paint_board(
  ctx: PaintContext,
  rect: Rect,
  frame_colour: number,
  face_colour: number,
  frame: PaintFrame,
  border = 3,
): Rect {
  const edge = 2.5;
  fill_rounded_rect(
    ctx,
    rect.x + 0.6,
    rect.y - edge,
    rect.width - 1.2,
    edge + 2,
    1.2,
    linear_gradient(ctx, 0, rect.y - edge, 0, rect.y + 1, [
      [0, tint(frame_colour, 0.45)],
      [1, tint(frame_colour, 0.18)],
    ]),
  );
  fill_rounded_rect(
    ctx,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    2.5,
    linear_gradient(ctx, rect.x, 0, rect.x + rect.width, 0, [
      [0, tint(frame_colour, 0.14)],
      [0.5, frame_colour],
      [1, shade(frame_colour, 0.24)],
    ]),
  );
  fill_rounded_rect(
    ctx,
    rect.x + rect.width - 1.6,
    rect.y,
    1.6,
    rect.height,
    0.8,
    css(shade(frame_colour, 0.42)),
  );
  fill_rounded_rect(
    ctx,
    rect.x + 1,
    rect.y + rect.height - 1.2,
    rect.width - 2,
    1.2,
    0.6,
    css(shade(frame_colour, 0.35)),
  );
  const face: Rect = {
    x: rect.x + border,
    y: rect.y + border,
    width: rect.width - border * 2,
    height: rect.height - border * 2,
  };
  fill_rounded_rect(
    ctx,
    face.x,
    face.y,
    face.width,
    face.height,
    1.8,
    linear_gradient(ctx, face.x, face.y, face.x + face.width * 0.4, face.y + face.height, [
      [0, tint(face_colour, 0.1)],
      [1, shade(face_colour, 0.07)],
    ]),
  );
  fill_rounded_rect(ctx, face.x, face.y, face.width, 1.6, 0.8, css(SHADOW_INK, 0.2));
  fill_rounded_rect(ctx, face.x, face.y, 1, face.height, 0.5, css(SHADOW_INK, 0.1));
  if (!frame.isLowDetail) {
    fill_rounded_rect(
      ctx,
      face.x + 1,
      face.y + face.height - 0.9,
      face.width - 2,
      0.9,
      0.45,
      css(0xffffff, 0.22),
    );
  }
  stroke_rounded_rect(
    ctx,
    rect.x,
    rect.y - edge,
    rect.width,
    rect.height + edge,
    2.5,
    frame.isHighContrast ? css(SHADOW_INK) : css(shade(frame_colour, 0.55), 0.7),
    frame.isHighContrast ? 2 : 0.9,
  );
  return face;
}

/**
 * Paints a bold arrow centred on a point and pointing along a heading.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param length - Total length, shaft and head.
 * @param heading - Where the arrow points.
 * @param colour_value - Arrow colour.
 */
export function paint_arrow(
  ctx: PaintContext,
  cx: number,
  cy: number,
  length: number,
  heading: Heading,
  colour_value: number,
): void {
  const head = length * 0.45;
  const half = length / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(HEADING_ANGLE[heading]);
  fill_rounded_rect(ctx, -half, -1.4, length - head + 1, 2.8, 1.2, css(colour_value));
  fill_polygon(
    ctx,
    [
      [half - head, -head * 0.95],
      [half, 0],
      [half - head, head * 0.95],
    ],
    css(colour_value),
  );
  ctx.restore();
}

/**
 * Strokes a chevron centred on a point and pointing along a heading.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param size - Half the chevron's height.
 * @param heading - Where the chevron points.
 * @param colour_value - Stroke colour.
 * @param width - Stroke width.
 */
export function paint_chevron(
  ctx: PaintContext,
  cx: number,
  cy: number,
  size: number,
  heading: Heading,
  colour_value: number,
  width = 2,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(HEADING_ANGLE[heading]);
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, -size);
  ctx.lineTo(size * 0.4, 0);
  ctx.lineTo(-size * 0.4, size);
  ctx.strokeStyle = css(colour_value);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

/** The faces of a wall-like piece that the camera sees. */
export interface WallFaces {
  /** The top surface seen from above. */
  readonly top: Rect;
  /** The south-facing face: the long face east-west, the end face north-south. */
  readonly front: Rect;
}

/** The faces of a north-south piece, adding the sliver of its long side. */
export interface NorthSouthFaces extends WallFaces {
  readonly side: Rect;
}

/** An east-west wall-like piece: its ends, ground line, thickness and height. */
export interface EastWestWall {
  readonly x0: number;
  readonly x1: number;
  /** Texture y of the south edge of the ground band the piece stands on. */
  readonly ground: number;
  readonly thickness: number;
  readonly height: number;
}

/** A north-south wall-like piece: its centre line, the ground y of its ends, size and side. */
export interface NorthSouthWall {
  readonly cx: number;
  /** Texture y of the north end of the ground band. */
  readonly north: number;
  /** Texture y of the south end of the ground band. */
  readonly south: number;
  readonly thickness: number;
  readonly height: number;
  readonly side: Side;
}

/**
 * Places an east-west piece along the middle of its footprint, its ground band just south of
 * the footprint's centre line, with its top kept inside the texture.
 *
 * @param box - The footprint box.
 * @param thickness - Depth of the piece from north to south.
 * @param height - Height of the piece.
 * @param inset - Gap left at the footprint's east and west edges.
 * @returns The wall geometry.
 */
export function east_west_wall(
  box: Box,
  thickness: number,
  height: number,
  inset = 3,
): EastWestWall {
  const centred = box.centreY + thickness / 2 + 2;
  const ground = Math.min(box.bottom - 6, Math.max(centred, thickness + height + 2));
  return { x0: box.x + inset, x1: box.right - inset, ground, thickness, height };
}

/**
 * Places a north-south piece down the middle of its footprint, its north end pulled in far
 * enough that its lifted top stays inside the texture.
 *
 * @param box - The footprint box.
 * @param thickness - Width of the piece from west to east.
 * @param height - Height of the piece.
 * @param rotation - The placement rotation, which picks the visible side.
 * @param inset - Gap left at the footprint's north and south edges.
 * @returns The wall geometry.
 */
export function north_south_wall(
  box: Box,
  thickness: number,
  height: number,
  rotation: Rotation,
  inset = 6,
): NorthSouthWall {
  return {
    cx: box.centreX,
    north: Math.max(box.y + inset, height + 2),
    south: box.bottom - inset,
    thickness,
    height,
    side: side_for_rotation(rotation),
  };
}

/**
 * Gives the faces of an east-west piece.
 *
 * @param wall - The wall geometry.
 * @returns The top surface and the south face.
 */
export function east_west_faces(wall: EastWestWall): WallFaces {
  const width = wall.x1 - wall.x0;
  return {
    top: {
      x: wall.x0,
      y: wall.ground - wall.thickness - wall.height,
      width,
      height: wall.thickness,
    },
    front: { x: wall.x0, y: wall.ground - wall.height, width, height: wall.height },
  };
}

/**
 * Gives the faces of a north-south piece.
 *
 * @param wall - The wall geometry.
 * @returns The top strip, the south end face and the side sliver.
 */
export function north_south_faces(wall: NorthSouthWall): NorthSouthFaces {
  const left = wall.cx - wall.thickness / 2;
  const length = wall.south - wall.north;
  return {
    top: { x: left, y: wall.north - wall.height, width: wall.thickness, height: length },
    front: { x: left, y: wall.south - wall.height, width: wall.thickness, height: wall.height },
    side: {
      x: wall.side === "west" ? left - SIDE_SLIVER : left + wall.thickness,
      y: wall.north - wall.height + 1,
      width: SIDE_SLIVER,
      height: length + wall.height - 1,
    },
  };
}

/**
 * Paints the shadow an east-west piece casts on the floor to its south-east.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param wall - The wall geometry.
 * @param alpha - Darkness of the shadow.
 */
export function east_west_shadow(
  ctx: PaintContext,
  box: Box,
  wall: EastWestWall,
  alpha = 0.2,
): void {
  const reach = Math.min(10, 3 + wall.height * 0.25);
  floor_shadow(ctx, box, wall.x0 + 4, wall.ground - 3, wall.x1 - wall.x0, reach + 3, alpha);
}

/**
 * Paints the shadow a north-south piece casts on the floor to its east and south.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param wall - The wall geometry.
 * @param alpha - Darkness of the shadow.
 */
export function north_south_shadow(
  ctx: PaintContext,
  box: Box,
  wall: NorthSouthWall,
  alpha = 0.2,
): void {
  const reach = Math.min(10, 3 + wall.height * 0.22);
  const left = wall.cx + wall.thickness / 2 - 1;
  floor_shadow(
    ctx,
    box,
    left,
    wall.north + 2,
    reach + 2,
    wall.south - wall.north + 3,
    alpha,
    "east",
  );
}

/**
 * Fills a face with a material ramp lit from the north-west: lighter at its left, darker at its
 * right.
 *
 * @param ctx - The paint context.
 * @param rect - The face.
 * @param colour_value - The material colour.
 * @param radius - Corner radius.
 * @param spread - How far the ramp runs either side of the base colour.
 */
export function fill_lit_face(
  ctx: PaintContext,
  rect: Rect,
  colour_value: number,
  radius = 1,
  spread = 0.18,
): void {
  fill_rounded_rect(
    ctx,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    radius,
    linear_gradient(ctx, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height * 0.3, [
      [0, tint(colour_value, spread * 0.8)],
      [0.55, colour_value],
      [1, shade(colour_value, spread)],
    ]),
  );
}

/**
 * Fills a top surface seen from above with a light ramp, brightest on its north-west edge.
 *
 * @param ctx - The paint context.
 * @param rect - The top surface.
 * @param colour_value - The material colour.
 * @param radius - Corner radius.
 */
export function fill_top_surface(
  ctx: PaintContext,
  rect: Rect,
  colour_value: number,
  radius = 1,
): void {
  fill_rounded_rect(
    ctx,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    radius,
    linear_gradient(ctx, rect.x, rect.y, rect.x + rect.width * 0.25, rect.y + rect.height, [
      [0, tint(colour_value, 0.3)],
      [1, tint(colour_value, 0.08)],
    ]),
  );
}
