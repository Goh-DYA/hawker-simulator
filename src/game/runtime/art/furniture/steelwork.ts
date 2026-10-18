/**
 * The construction kit the service-furniture painters (stall fixtures, tray and waste points and
 * facilities) share: the rotation-aware "run" that lays a fixture out along its service edge,
 * upright prisms with a lit top and a shaded south face, vertical cylinders, glass, small standing
 * props, baked sign strips and the pictograms and blade signs that identify a fixture seen
 * end-on, all in the 3/4 oblique view lit from the north-west.
 *
 * Positions are in texture pixels on the ground plane; a height `h` above the ground draws `h`
 * pixels higher on screen. A fixture's service side (where its user stands) faces the footprint's
 * south edge at rotation 0 and turns clockwise with the rotation, so the textures are painted per
 * rotation and never rotated as a whole, which keeps the light and the shadows consistent.
 */
import type { Rotation } from "@/src/game/core";

import {
  css,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  glow,
  label,
  line,
  linear_gradient,
  rounded_rect_path,
  seeded,
  shade,
  SHADOW_INK,
  stroke_rounded_rect,
  TAU,
  tint,
  type PaintContext,
} from "../canvas";
import { OVERHANG, type PaintFrame } from "../specs";
import type { Box } from "./shared";

/** Brushed stainless steel, the Art Bible tone. */
export const STAINLESS = 0xc9d3d0;
/** The shaded end of the stainless ramp. */
export const STAINLESS_DEEP = 0x7e8b88;
/** Zinc of panels and hoods. */
export const ZINC = 0x9aa8a6;
/** Teal structural steel. */
export const TEAL_STEEL = 0x167d7f;
/** Ink for text and pictograms. */
export const INK = 0x263238;
/** Warm lamp light. */
export const LAMP_LIGHT = 0xffd98a;
/** Vermilion accent. */
export const VERMILION = 0xd95d39;
/** Mustard accent. */
export const MUSTARD = 0xd5a021;
/** Leaf green accent. */
export const LEAF = 0x4f7d4a;
/** Warm cream of sign text. */
export const CREAM = 0xfff4dc;
/** The brown melamine of hawker-centre trays. */
export const TRAY_BROWN = 0x8b5a3c;
/** Dark recess inside openings and cubbies. */
export const RECESS = 0x1f2c2b;
/** Vertical squash of a circle seen from above in the 3/4 view. */
export const ROUND_SQUASH = 0.58;

/** The direction a fixture's service side faces in its texture. */
export type ServiceSide = "south" | "west" | "north" | "east";

/** A point in texture pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle on the ground plane: `y` is its north edge and `depth` its north-south extent. */
export interface Ground {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
}

/**
 * A fixture body laid out along its service edge. `at` and `segment` take a fraction along the
 * edge (0 at the left end as the user stands facing the fixture) and distances measured back from
 * the service edge, and return ground-plane texture positions for any rotation.
 */
export interface Run {
  readonly ground: Ground;
  readonly side: ServiceSide;
  /** Length of the service edge in pixels. */
  readonly length: number;
  /** Depth from the service edge to the back, in pixels. */
  readonly reach: number;
  at(along: number, from_front: number): Point;
  segment(along_start: number, along_end: number, front_start: number, front_end: number): Ground;
}

/** How a run sits in its footprint. */
export interface RunOptions {
  /** Depth of the body from the service edge to its back. */
  readonly reach: number;
  /** Gap between the footprint's service edge and the body. */
  readonly front_gap: number;
  /** Gap at each end of the body. */
  readonly end_gap: number;
  /** The tallest height anything on the run reaches, which keeps it inside the overhang. */
  readonly rise: number;
}

/** A drawable part, sorted back to front by the ground y of its south edge. */
export interface Part {
  readonly depth: number;
  readonly draw: () => void;
}

/** How a prism is finished. */
export interface PrismOptions {
  /** Height of the prism's underside above the ground. */
  readonly base?: number;
  /** Colour of the south face; shaded from the top colour by default. */
  readonly front?: number;
  /** Corner radius. */
  readonly radius?: number;
  /** Brushed-steel sheen on the top and streaks on the face. */
  readonly is_steel?: boolean;
  /** Strength of the bright lip along the top's south edge, 0 to 1. */
  readonly lip?: number;
  /** Seed for brushing streaks. */
  readonly seed?: number;
  /** Skips the outline (for parts that sit flush inside another). */
  readonly is_bare?: boolean;
}

/** How a cylinder is finished. */
export interface CylinderOptions {
  /** Colour of the top cap; a lighter body tone by default. */
  readonly cap?: number;
  /** Opacity of the body, for glass. */
  readonly alpha?: number;
  /** Vertical squash of the round ends. */
  readonly squash?: number;
  /** Skips the outline. */
  readonly is_bare?: boolean;
}

/**
 * Gives the side a fixture's service edge faces at a rotation.
 *
 * @param rotation - The placement rotation, clockwise.
 * @returns South at 0, west at 90, north at 180 and east at 270.
 */
export function service_side(rotation: Rotation): ServiceSide {
  if (rotation === 90) return "west";
  if (rotation === 180) return "north";
  if (rotation === 270) return "east";
  return "south";
}

/**
 * Reports whether a service side runs across the screen (south or north) rather than up it.
 *
 * @param side - The service side.
 * @returns True for south and north.
 */
export function is_across(side: ServiceSide): boolean {
  return side === "south" || side === "north";
}

/** Which side of a fixture its visible south face shows. */
export type FaceView = "front" | "back" | "end";

/**
 * Gives which side of a fixture faces the camera: its service front, its back or an end.
 *
 * @param side - The service side.
 * @returns `front` when serving south, `back` when serving north and `end` otherwise.
 */
export function face_view(side: ServiceSide): FaceView {
  if (side === "south") return "front";
  if (side === "north") return "back";
  return "end";
}

/**
 * Lifts a ground point by a height, giving its screen position.
 *
 * @param point - The ground point.
 * @param height - The height above the ground.
 * @returns The screen point.
 */
export function lifted(point: Point, height: number): Point {
  return { x: point.x, y: point.y - height };
}

/**
 * Gives the south edge of a ground rectangle.
 *
 * @param ground - The rectangle.
 * @returns Its south edge y.
 */
export function ground_bottom(ground: Ground): number {
  return ground.y + ground.depth;
}

/**
 * Builds a ground rectangle centred on a point, with its long side along the service edge.
 *
 * @param centre - The centre on the ground plane.
 * @param along - Size along the service edge.
 * @param across - Size from the service edge to the back.
 * @param side - The service side.
 * @returns The rectangle.
 */
export function oriented_ground(
  centre: Point,
  along: number,
  across: number,
  side: ServiceSide,
): Ground {
  const width = is_across(side) ? along : across;
  const depth = is_across(side) ? across : along;
  return { x: centre.x - width / 2, y: centre.y - depth / 2, width, depth };
}

/**
 * Lays a fixture body along its service edge inside the rotated footprint. The body's north edge
 * is pushed south (or trimmed) far enough that nothing rising `rise` pixels above it leaves the
 * texture's overhang.
 *
 * @param box - The footprint box.
 * @param rotation - The placement rotation.
 * @param options - Depth, gaps and rise.
 * @returns The run.
 */
export function make_run(box: Box, rotation: Rotation, options: RunOptions): Run {
  const side = service_side(rotation);
  const { reach, front_gap, end_gap, rise } = options;
  const min_y = box.y - OVERHANG + rise + 1;
  const max_bottom = box.bottom - 3;
  let ground: Ground;
  if (side === "south") {
    const bottom = box.bottom - front_gap;
    const y = Math.max(bottom - reach, min_y);
    ground = { x: box.x + end_gap, y, width: box.width - end_gap * 2, depth: bottom - y };
  } else if (side === "north") {
    const y = Math.max(box.y + front_gap, min_y);
    ground = {
      x: box.x + end_gap,
      y,
      width: box.width - end_gap * 2,
      depth: Math.min(reach, max_bottom - y),
    };
  } else {
    const y = Math.max(box.y + end_gap, min_y);
    const x = side === "west" ? box.x + front_gap : box.right - front_gap - reach;
    ground = { x, y, width: reach, depth: box.bottom - end_gap - y };
  }
  return run_on(ground, side);
}

/**
 * Wraps an existing ground rectangle as a run facing a side.
 *
 * @param ground - The body rectangle.
 * @param side - The service side.
 * @returns The run.
 */
export function run_on(ground: Ground, side: ServiceSide): Run {
  const across = is_across(side);
  const length = across ? ground.width : ground.depth;
  const reach = across ? ground.depth : ground.width;
  const right = ground.x + ground.width;
  const bottom = ground_bottom(ground);
  const at = (along: number, from_front: number): Point => {
    const distance = along * length;
    if (side === "south") return { x: ground.x + distance, y: bottom - from_front };
    if (side === "north") return { x: right - distance, y: ground.y + from_front };
    if (side === "west") return { x: ground.x + from_front, y: ground.y + distance };
    return { x: right - from_front, y: bottom - distance };
  };
  const segment = (
    along_start: number,
    along_end: number,
    front_start: number,
    front_end: number,
  ): Ground => {
    const first = at(along_start, front_start);
    const second = at(along_end, front_end);
    const x = Math.min(first.x, second.x);
    const y = Math.min(first.y, second.y);
    return { x, y, width: Math.abs(second.x - first.x), depth: Math.abs(second.y - first.y) };
  };
  return { ground, side, length, reach, at, segment };
}

/**
 * Paints parts back to front: the part whose south edge is further north draws first.
 *
 * @param parts - The parts, in any order; ties keep their order.
 */
export function paint_parts(parts: readonly Part[]): void {
  for (const part of [...parts].sort((first, second) => first.depth - second.depth)) part.draw();
}

/**
 * Resolves an outline stroke: thin and tinted, or thick ink in the high-contrast frame.
 *
 * @param frame - The paint frame.
 * @param colour - The colour a tinted outline is shaded from.
 * @returns The stroke style and width.
 */
export function edge_style(frame: PaintFrame, colour: number): { style: string; width: number } {
  return frame.isHighContrast
    ? { style: css(SHADOW_INK), width: 2.2 }
    : { style: css(shade(colour, 0.55), 0.72), width: 0.9 };
}

/**
 * Paints the soft shadow an upright object casts on the floor, offset to the south-east and
 * longer for taller objects.
 *
 * @param ctx - The paint context.
 * @param ground - The object's ground rectangle.
 * @param height - The object's height.
 * @param is_round - True for a round object.
 */
export function cast_shadow(
  ctx: PaintContext,
  ground: Ground,
  height: number,
  is_round = false,
): void {
  const reach = Math.min(5, 1.5 + height * 0.08);
  ctx.save();
  ctx.shadowBlur = 5;
  ctx.shadowColor = css(SHADOW_INK, 0.24);
  ctx.fillStyle = css(SHADOW_INK, 0.2);
  if (is_round) {
    ctx.beginPath();
    ctx.ellipse(
      ground.x + ground.width / 2 + reach * 0.6,
      ground.y + ground.depth / 2 + reach * 0.5,
      ground.width / 2 + 0.5,
      ground.depth / 2 + 0.5,
      0,
      0,
      TAU,
    );
    ctx.fill();
  } else {
    rounded_rect_path(
      ctx,
      ground.x + reach * 0.6,
      ground.y + reach * 0.5,
      ground.width + 0.5,
      ground.depth + 0.5,
      3,
    );
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Gives the screen rectangle of a prism's south face.
 *
 * @param ground - The prism's ground rectangle.
 * @param height - The prism's top height.
 * @param base - The prism's underside height.
 * @returns The face rectangle.
 */
export function face_of(
  ground: Ground,
  height: number,
  base = 0,
): { x: number; y: number; width: number; height: number } {
  return {
    x: ground.x,
    y: ground_bottom(ground) - height,
    width: ground.width,
    height: Math.max(0, height - base),
  };
}

/**
 * Paints an upright box: a lit top surface lifted `height` pixels above its ground rectangle and a
 * shaded south face below it, with a bright lip between them, ambient occlusion at its foot and a
 * thin tinted outline.
 *
 * @param ctx - The paint context.
 * @param ground - The ground rectangle.
 * @param height - Height of the top surface above the ground.
 * @param colour - The top surface colour.
 * @param frame - The paint frame.
 * @param options - Base height, face colour, radius, steel finish and lip.
 */
export function paint_prism(
  ctx: PaintContext,
  ground: Ground,
  height: number,
  colour: number,
  frame: PaintFrame,
  options: PrismOptions = {},
): void {
  const base = options.base ?? 0;
  const radius = Math.min(options.radius ?? 1.5, ground.width / 2, ground.depth / 2);
  const front = options.front ?? shade(colour, 0.24);
  const face = face_of(ground, height, base);
  const top_y = ground.y - height;
  if (face.height > 0) {
    fill_rounded_rect(
      ctx,
      face.x,
      face.y - radius,
      face.width,
      face.height + radius,
      radius,
      linear_gradient(ctx, 0, face.y, 0, face.y + face.height, [
        [0, tint(front, 0.1)],
        [0.55, front],
        [1, shade(front, 0.2)],
      ]),
    );
    if (options.is_steel && !frame.isLowDetail) steel_streaks(ctx, face, options.seed ?? 7);
    if (base === 0 && face.height > 4) {
      ctx.fillStyle = linear_gradient(ctx, 0, face.y + face.height - 4, 0, face.y + face.height, [
        [0, SHADOW_INK, 0],
        [1, SHADOW_INK, 0.28],
      ]);
      ctx.fillRect(face.x, face.y + face.height - 4, face.width, 4);
    }
    ctx.fillStyle = css(tint(front, 0.35), 0.5);
    ctx.fillRect(face.x, face.y, 1, face.height);
    ctx.fillStyle = css(shade(front, 0.35), 0.45);
    ctx.fillRect(face.x + face.width - 1.4, face.y, 1.4, face.height);
  }
  fill_rounded_rect(
    ctx,
    ground.x,
    top_y,
    ground.width,
    ground.depth,
    radius,
    linear_gradient(ctx, ground.x, top_y, ground.x + ground.width * 0.45, top_y + ground.depth, [
      [0, tint(colour, 0.24)],
      [1, shade(colour, 0.06)],
    ]),
  );
  if (options.is_steel && ground.depth > 3) {
    ctx.save();
    rounded_rect_path(ctx, ground.x, top_y, ground.width, ground.depth, radius);
    ctx.clip();
    const sheen_x = ground.x + ground.width * 0.22;
    fill_polygon(
      ctx,
      [
        [sheen_x, top_y],
        [sheen_x + 7, top_y],
        [sheen_x + 7 - ground.depth * 0.5, top_y + ground.depth],
        [sheen_x - ground.depth * 0.5, top_y + ground.depth],
      ],
      css(0xffffff, 0.2),
    );
    ctx.restore();
  }
  if (face.height > 0) {
    line(
      ctx,
      ground.x + radius,
      face.y + 0.4,
      ground.x + ground.width - radius,
      face.y + 0.4,
      css(tint(colour, 0.6), options.lip ?? 0.85),
      0.9,
      "butt",
    );
  }
  if (!options.is_bare) {
    const edge = edge_style(frame, colour);
    stroke_rounded_rect(
      ctx,
      ground.x,
      top_y,
      ground.width,
      ground.depth + face.height,
      radius,
      edge.style,
      edge.width,
    );
  }
}

/**
 * Lays faint vertical brushing streaks over a steel face.
 *
 * @param ctx - The paint context.
 * @param face - The face rectangle.
 * @param seed - Seed for the streak positions.
 */
function steel_streaks(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  seed: number,
): void {
  const next = seeded(seed);
  const count = Math.max(2, Math.round(face.width / 6));
  for (let index = 0; index < count; index += 1) {
    const x = face.x + 1.5 + next() * (face.width - 3);
    ctx.fillStyle = css(next() > 0.5 ? 0xffffff : SHADOW_INK, 0.07);
    ctx.fillRect(x, face.y + 1, 0.8, face.height - 2);
  }
}

/**
 * Paints an upright cylinder standing on a point: a body shaded from the lit west side to the
 * shaded east side, a squashed top cap and a narrow specular streak.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param base_y - Screen y of the centre of the bottom.
 * @param radius - The radius.
 * @param height - The body height.
 * @param colour - The body colour.
 * @param frame - The paint frame.
 * @param options - Cap colour, opacity and squash.
 */
export function paint_cylinder(
  ctx: PaintContext,
  cx: number,
  base_y: number,
  radius: number,
  height: number,
  colour: number,
  frame: PaintFrame,
  options: CylinderOptions = {},
): void {
  const squash = options.squash ?? ROUND_SQUASH;
  const radius_y = radius * squash;
  const alpha = options.alpha ?? 1;
  const top_y = base_y - height;
  ctx.beginPath();
  ctx.moveTo(cx + radius, top_y);
  ctx.lineTo(cx + radius, base_y);
  ctx.ellipse(cx, base_y, radius, radius_y, 0, 0, Math.PI, false);
  ctx.lineTo(cx - radius, top_y);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, cx - radius, 0, cx + radius, 0, [
    [0, tint(colour, 0.22), alpha],
    [0.35, tint(colour, 0.08), alpha],
    [0.75, colour, alpha],
    [1, shade(colour, 0.32), alpha],
  ]);
  ctx.fill();
  if (radius >= 2 && height >= 3) {
    ctx.fillStyle = css(0xffffff, 0.3 * Math.max(alpha, 0.6));
    ctx.fillRect(cx - radius * 0.55, top_y + radius_y, Math.max(0.6, radius * 0.18), height * 0.8);
  }
  fill_ellipse(ctx, cx, top_y, radius, radius_y, css(options.cap ?? tint(colour, 0.2), alpha));
  if (!options.is_bare) {
    const edge = edge_style(frame, colour);
    ctx.beginPath();
    ctx.moveTo(cx + radius, top_y);
    ctx.lineTo(cx + radius, base_y);
    ctx.ellipse(cx, base_y, radius, radius_y, 0, 0, Math.PI, false);
    ctx.lineTo(cx - radius, top_y);
    ctx.ellipse(cx, top_y, radius, radius_y, 0, Math.PI, Math.PI * 3, false);
    ctx.strokeStyle = edge.style;
    ctx.lineWidth = frame.isHighContrast ? 1.6 : 0.7;
    ctx.stroke();
  }
}

/**
 * Paints a sauce or water bottle standing on a surface: a rounded body, shoulder, neck and cap.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param base_y - Screen y of the bottle's foot.
 * @param height - Overall height.
 * @param colour - Body colour.
 * @param cap - Cap colour.
 * @param options - `is_squeeze` draws a conical nozzle; `label_colour` adds a paper label band;
 *   `alpha` makes the body translucent.
 */
export function paint_bottle(
  ctx: PaintContext,
  cx: number,
  base_y: number,
  height: number,
  colour: number,
  cap: number,
  options: { is_squeeze?: boolean; label_colour?: number; alpha?: number } = {},
): void {
  const width = Math.max(3, height * 0.42);
  const body_height = height * 0.66;
  const alpha = options.alpha ?? 1;
  fill_ellipse(ctx, cx + 0.8, base_y + 0.4, width * 0.55, 1.1, css(SHADOW_INK, 0.25));
  fill_rounded_rect(
    ctx,
    cx - width / 2,
    base_y - body_height,
    width,
    body_height,
    Math.min(1.6, width / 2),
    linear_gradient(ctx, cx - width / 2, 0, cx + width / 2, 0, [
      [0, tint(colour, 0.3), alpha],
      [0.5, colour, alpha],
      [1, shade(colour, 0.35), alpha],
    ]),
  );
  if (options.label_colour !== undefined) {
    ctx.fillStyle = css(options.label_colour, 0.95);
    ctx.fillRect(cx - width / 2, base_y - body_height * 0.62, width, body_height * 0.32);
  }
  const neck_top = base_y - height;
  if (options.is_squeeze) {
    fill_polygon(
      ctx,
      [
        [cx - width * 0.32, base_y - body_height],
        [cx + width * 0.32, base_y - body_height],
        [cx + 0.4, neck_top],
        [cx - 0.4, neck_top],
      ],
      css(cap),
    );
  } else {
    fill_polygon(
      ctx,
      [
        [cx - width / 2, base_y - body_height + 0.5],
        [cx + width / 2, base_y - body_height + 0.5],
        [cx + width * 0.2, base_y - body_height - height * 0.12],
        [cx - width * 0.2, base_y - body_height - height * 0.12],
      ],
      css(shade(colour, 0.1), alpha),
    );
    ctx.fillStyle = css(shade(colour, 0.05), alpha);
    ctx.fillRect(cx - width * 0.2, neck_top + height * 0.08, width * 0.4, height * 0.16);
    fill_rounded_rect(ctx, cx - width * 0.26, neck_top, width * 0.52, height * 0.1, 0.5, css(cap));
  }
  ctx.fillStyle = css(0xffffff, 0.45);
  ctx.fillRect(cx - width * 0.3, base_y - body_height + 1, 0.7, body_height - 2);
}

/**
 * Paints a stack of trays seen from the south: thin slabs with a lit rim, slightly offset.
 *
 * @param ctx - The paint context.
 * @param x - Left of the stack.
 * @param base_y - Screen y of the stack's bottom.
 * @param width - Tray width.
 * @param count - Number of trays.
 * @param colour - Tray colour.
 * @param seed - Seed for the small offsets.
 */
export function paint_tray_stack(
  ctx: PaintContext,
  x: number,
  base_y: number,
  width: number,
  count: number,
  colour: number,
  seed: number,
): void {
  const next = seeded(seed);
  for (let index = 0; index < count; index += 1) {
    const offset = (next() - 0.5) * 1.6;
    const y = base_y - (index + 1) * 2.2;
    fill_rounded_rect(
      ctx,
      x + offset,
      y,
      width,
      2.1,
      0.7,
      css(shade(colour, index % 2 ? 0.12 : 0)),
    );
    ctx.fillStyle = css(tint(colour, 0.4), 0.85);
    ctx.fillRect(x + offset + 0.7, y + 0.1, width - 1.4, 0.6);
  }
}

/**
 * Paints a sign strip: a rounded colour panel with baked uppercase text and a soft top sheen.
 *
 * @param ctx - The paint context.
 * @param rect - The strip rectangle.
 * @param colour - Panel colour.
 * @param text - The text.
 * @param frame - The paint frame.
 * @param text_colour - Text colour.
 */
export function paint_sign_strip(
  ctx: PaintContext,
  rect: { x: number; y: number; width: number; height: number },
  colour: number,
  text: string,
  frame: PaintFrame,
  text_colour = CREAM,
): void {
  fill_rounded_rect(
    ctx,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    1.2,
    linear_gradient(ctx, 0, rect.y, 0, rect.y + rect.height, [
      [0, tint(colour, 0.18)],
      [1, shade(colour, 0.12)],
    ]),
  );
  if (rect.height >= 4 && rect.width >= 8) {
    label(ctx, text, rect.x + rect.width / 2, rect.y + rect.height / 2 + 0.2, {
      maxWidth: rect.width - 2,
      size: Math.min(7, rect.height - 1),
      colour: text_colour,
      uppercase: true,
      weight: 800,
    });
  }
  const edge = edge_style(frame, colour);
  stroke_rounded_rect(ctx, rect.x, rect.y, rect.width, rect.height, 1.2, edge.style, edge.width);
}

/**
 * Paints a pane of glass over whatever is behind it: a faint tinted body, a bright frame edge and
 * two diagonal reflections.
 *
 * @param ctx - The paint context.
 * @param rect - The pane rectangle.
 * @param colour - The glass tint.
 * @param alpha - Body opacity.
 */
export function paint_glass(
  ctx: PaintContext,
  rect: { x: number; y: number; width: number; height: number },
  colour: number,
  alpha: number,
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.fillStyle = linear_gradient(ctx, rect.x, rect.y, rect.x, rect.y + rect.height, [
    [0, tint(colour, 0.4), alpha * 1.3],
    [1, colour, alpha],
  ]);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  for (const [offset, width] of [
    [0.18, 5],
    [0.32, 2],
  ] as const) {
    const x = rect.x + rect.width * offset;
    fill_polygon(
      ctx,
      [
        [x, rect.y],
        [x + width, rect.y],
        [x + width - rect.height * 0.6, rect.y + rect.height],
        [x - rect.height * 0.6, rect.y + rect.height],
      ],
      css(0xffffff, 0.26),
    );
  }
  ctx.restore();
}

/**
 * Paints a small padlock hanging from a hasp.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y of the lock body.
 * @param colour - Lock body colour (brass by default).
 */
export function paint_padlock(ctx: PaintContext, cx: number, cy: number, colour = 0xc9a24a): void {
  ctx.beginPath();
  ctx.arc(cx, cy - 1.6, 1.5, Math.PI, 0, false);
  ctx.strokeStyle = css(0x9aa5a2);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  fill_rounded_rect(ctx, cx - 2, cy - 1.6, 4, 3.6, 0.8, css(colour));
  ctx.fillStyle = css(tint(colour, 0.4));
  ctx.fillRect(cx - 1.6, cy - 1.3, 3.2, 0.6);
  fill_ellipse(ctx, cx, cy + 0.4, 0.5, 0.7, css(shade(colour, 0.6)));
}

/**
 * Paints an upright tube or post: a narrow bar shaded from its lit west edge, with a small cap.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param base_y - Screen y of the post's foot.
 * @param height - The post height.
 * @param frame - The paint frame.
 * @param width - The post width.
 * @param colour - The post colour.
 */
export function paint_tube_post(
  ctx: PaintContext,
  cx: number,
  base_y: number,
  height: number,
  frame: PaintFrame,
  width = 2.4,
  colour = STAINLESS,
): void {
  fill_rounded_rect(
    ctx,
    cx - width / 2,
    base_y - height,
    width,
    height,
    width / 2,
    linear_gradient(ctx, cx - width / 2, 0, cx + width / 2, 0, [
      [0, tint(colour, 0.4)],
      [0.45, colour],
      [1, shade(colour, 0.4)],
    ]),
  );
  if (frame.isHighContrast) {
    stroke_rounded_rect(
      ctx,
      cx - width / 2,
      base_y - height,
      width,
      height,
      width / 2,
      css(SHADOW_INK),
      1.2,
    );
  }
}

/**
 * The pictograms a sign can carry, so a sign seen end-on (where its text cannot be read) still
 * tells its fixture apart: a tray sliding into a slot, a bowl with chopsticks, a plate under a
 * drop arrow, a stack of clean trays, a sauce bottle, a spoon with chopsticks and a water drop.
 */
export type Pictogram =
  "tray-return" | "bowl" | "dish-drop" | "tray-stack" | "bottle" | "cutlery" | "drop";

/**
 * Paints a pictogram in one flat colour, centred on a point and fitted to a square.
 *
 * @param ctx - The paint context.
 * @param kind - Which pictogram.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param size - Side of the square it fits.
 * @param colour - The pictogram colour (cream on a coloured sign by default).
 */
export function paint_pictogram(
  ctx: PaintContext,
  kind: Pictogram,
  cx: number,
  cy: number,
  size: number,
  colour = CREAM,
): void {
  const unit = size / 10;
  const ink = css(colour);
  if (kind === "tray-return") {
    line(ctx, cx - 4.6 * unit, cy - 1.2 * unit, cx + 1.4 * unit, cy - 1.2 * unit, ink, 1.4 * unit);
    fill_polygon(
      ctx,
      [
        [cx + 0.6 * unit, cy - 3.6 * unit],
        [cx + 3.6 * unit, cy - 1.2 * unit],
        [cx + 0.6 * unit, cy + 1.2 * unit],
      ],
      ink,
    );
    fill_rounded_rect(ctx, cx + 4 * unit, cy - 4.6 * unit, 1.2 * unit, 9.2 * unit, 0.3, ink);
    fill_rounded_rect(ctx, cx - 5 * unit, cy + 2.6 * unit, 8 * unit, 1.8 * unit, 0.5, ink);
  } else if (kind === "bowl") {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.6 * unit, 4.8 * unit, 3.6 * unit, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.fill();
    fill_rounded_rect(ctx, cx - 1.6 * unit, cy + 3.8 * unit, 3.2 * unit, 1 * unit, 0.3, ink);
    line(ctx, cx - 1.2 * unit, cy - 0.4 * unit, cx + 3 * unit, cy - 4.8 * unit, ink, 0.8 * unit);
    line(ctx, cx + 0.4 * unit, cy - 0.4 * unit, cx + 4.4 * unit, cy - 4 * unit, ink, 0.8 * unit);
  } else if (kind === "dish-drop") {
    fill_ellipse(ctx, cx, cy + 3 * unit, 5 * unit, 1.8 * unit, ink);
    line(ctx, cx, cy - 4.8 * unit, cx, cy - 1 * unit, ink, 1.4 * unit);
    fill_polygon(
      ctx,
      [
        [cx - 2.4 * unit, cy - 1.8 * unit],
        [cx + 2.4 * unit, cy - 1.8 * unit],
        [cx, cy + 0.8 * unit],
      ],
      ink,
    );
  } else if (kind === "tray-stack") {
    for (const [offset, row] of [
      [-0.6, -3.4],
      [0.4, -0.6],
      [-0.2, 2.2],
    ] as const) {
      fill_rounded_rect(
        ctx,
        cx + (offset - 4.6) * unit,
        cy + row * unit,
        7.6 * unit,
        1.8 * unit,
        0.5,
        ink,
      );
    }
    paint_sparkle(ctx, cx + 4.1 * unit, cy - 3.6 * unit, 1.8 * unit, ink);
  } else if (kind === "bottle") {
    fill_rounded_rect(ctx, cx - 2.2 * unit, cy - 1.2 * unit, 4.4 * unit, 6.2 * unit, 0.6, ink);
    fill_polygon(
      ctx,
      [
        [cx - 2.2 * unit, cy - 1 * unit],
        [cx + 2.2 * unit, cy - 1 * unit],
        [cx + 0.6 * unit, cy - 3.4 * unit],
        [cx - 0.6 * unit, cy - 3.4 * unit],
      ],
      ink,
    );
    fill_rounded_rect(ctx, cx - 0.4 * unit, cy - 5 * unit, 0.8 * unit, 1.8 * unit, 0.2, ink);
  } else if (kind === "cutlery") {
    fill_ellipse(ctx, cx - 2 * unit, cy - 2.6 * unit, 1.7 * unit, 2.3 * unit, ink);
    line(ctx, cx - 2 * unit, cy - 0.8 * unit, cx - 2 * unit, cy + 4.6 * unit, ink, 1.1 * unit);
    line(ctx, cx + 1.2 * unit, cy - 4.8 * unit, cx + 1.8 * unit, cy + 4.6 * unit, ink, 0.8 * unit);
    line(ctx, cx + 3.4 * unit, cy - 4.8 * unit, cx + 2.9 * unit, cy + 4.6 * unit, ink, 0.8 * unit);
  } else {
    fill_polygon(
      ctx,
      [
        [cx, cy - 4.8 * unit],
        [cx - 3 * unit, cy + 0.2 * unit],
        [cx + 3 * unit, cy + 0.2 * unit],
      ],
      ink,
    );
    fill_ellipse(ctx, cx, cy + 1.2 * unit, 3.2 * unit, 3.2 * unit, ink);
  }
}

/**
 * Paints a small four-point sparkle, the "clean" mark of the tray-stack pictogram.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Tip radius.
 * @param style - The fill style.
 */
function paint_sparkle(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  style: string,
): void {
  const waist = radius * 0.3;
  fill_polygon(
    ctx,
    [
      [cx, cy - radius],
      [cx + waist, cy - waist],
      [cx + radius, cy],
      [cx + waist, cy + waist],
      [cx, cy + radius],
      [cx - waist, cy + waist],
      [cx - radius, cy],
      [cx - waist, cy - waist],
    ],
    style,
  );
}

/**
 * Paints a blade sign that faces the camera at the south end of a fixture seen end-on: a small
 * coloured plate hung from a sign or panel and projecting towards the service side, carrying one
 * pictogram per bay. It replaces the unreadable edge-on text.
 *
 * @param ctx - The paint context.
 * @param anchor - Screen point of the blade's top where it meets the sign or panel.
 * @param side - The service side (west or east), which the blade projects towards.
 * @param colour - Plate colour.
 * @param pictograms - The pictograms, left to right.
 * @param frame - The paint frame.
 */
export function paint_end_blade(
  ctx: PaintContext,
  anchor: Point,
  side: ServiceSide,
  colour: number,
  pictograms: readonly Pictogram[],
  frame: PaintFrame,
): void {
  const height = 8.6;
  const cell = 7.4;
  const width = 2.4 + pictograms.length * cell;
  const x = side === "east" ? anchor.x - 1.5 : anchor.x + 1.5 - width;
  const y = anchor.y + 0.4;
  fill_rounded_rect(ctx, x + 0.8, y + 0.8, width, height, 1.2, css(SHADOW_INK, 0.2));
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    1.2,
    linear_gradient(ctx, 0, y, 0, y + height, [
      [0, tint(colour, 0.16)],
      [1, shade(colour, 0.14)],
    ]),
  );
  pictograms.forEach((kind, index) => {
    paint_pictogram(ctx, kind, x + 1.2 + cell * (index + 0.5), y + height / 2, 6.6);
  });
  const edge = edge_style(frame, colour);
  stroke_rounded_rect(ctx, x, y, width, height, 1.2, edge.style, edge.width);
}

/**
 * Paints a header sign board standing on two slim posts above a run, with baked uppercase text on
 * its broad faces. The gap under the board keeps whatever stands behind it visible. Seen end-on,
 * where the text is edge-on, a blade at its south end carries the fixture's pictograms instead.
 *
 * @param ctx - The paint context.
 * @param run - The run the board stands on.
 * @param from_front - Distance of the board back from the service edge.
 * @param base - Height of the surface the posts stand on.
 * @param top - Height of the board's top edge.
 * @param colour - Board colour.
 * @param text - The sign text.
 * @param pictograms - The pictograms of the end-on blade, one per bay.
 * @param frame - The paint frame.
 */
export function paint_header_board(
  ctx: PaintContext,
  run: Run,
  from_front: number,
  base: number,
  top: number,
  colour: number,
  text: string,
  pictograms: readonly Pictogram[],
  frame: PaintFrame,
): void {
  const board_height = 6;
  for (const along of [0.04, 0.96]) {
    const foot = lifted(run.at(along, from_front + 1), base);
    paint_tube_post(ctx, foot.x, foot.y, top - base - 1, frame, 1.5, STAINLESS_DEEP);
  }
  const board = run.segment(0.02, 0.98, from_front, from_front + 2);
  paint_prism(ctx, board, top, colour, frame, { base: top - board_height, radius: 0.8 });
  if (face_view(run.side) === "end") {
    const corner = lifted(run.at(run.side === "west" ? 0.98 : 0.02, from_front + 1), top);
    paint_end_blade(ctx, corner, run.side, colour, pictograms, frame);
    return;
  }
  const face = face_of(board, top, top - board_height);
  label(ctx, text, face.x + face.width / 2, face.y + face.height / 2 + 0.2, {
    maxWidth: face.width - 4,
    size: 6,
    colour: CREAM,
    uppercase: true,
  });
}

/**
 * Marks the service edge of a fixture seen end-on: a coloured strip down the side of its
 * silhouette that faces its user, so a fixture turned to serve west or east still shows its front.
 *
 * @param ctx - The paint context.
 * @param run - The fixture run (only west and east runs are marked).
 * @param height - Height of the fixture's top.
 * @param colour - The strip colour.
 * @param base - Height of the strip's foot.
 */
export function paint_service_sliver(
  ctx: PaintContext,
  run: Run,
  height: number,
  colour: number,
  base = 0,
): void {
  if (is_across(run.side)) return;
  const { ground } = run;
  const width = 1.8;
  const x = run.side === "west" ? ground.x : ground.x + ground.width - width;
  ctx.fillStyle = linear_gradient(ctx, 0, ground.y - height, 0, ground_bottom(ground) - base, [
    [0, tint(colour, 0.3)],
    [1, shade(colour, 0.2)],
  ]);
  ctx.fillRect(x, ground.y - height + 1, width, ground.depth + height - base - 1);
}

/**
 * Paints a soft lamp glow, skipped in the low-detail frame.
 *
 * @param ctx - The paint context.
 * @param frame - The paint frame.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Glow radius.
 * @param colour - Glow colour.
 * @param alpha - Peak opacity.
 */
export function paint_glow(
  ctx: PaintContext,
  frame: PaintFrame,
  cx: number,
  cy: number,
  radius: number,
  colour: number,
  alpha: number,
): void {
  if (frame.isLowDetail) return;
  glow(ctx, cx, cy, radius, colour, alpha);
}
