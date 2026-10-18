/**
 * Fan painters: the caged wall fan on its bracket, the broad three-bladed ceiling fan, the slim
 * tower fan, the big drum fan on its wheeled yoke, the bladeless quiet fan and the duct-hung
 * stall exhaust booster.
 *
 * Everything is drawn in the 3/4 oblique view from the south, lit from the north-west. Floor
 * fans stand on bases with a contact shadow and turn their caged face to the camera; the
 * ceiling fan's rotor is a horizontal disc foreshortened by the camera, high in its texture on
 * a downrod, with its blade shadow lying faintly on the floor far to the south-east; the wall
 * fan sits on a bracket at the edge it is turned to. Rotors turn with the motion frame: each
 * frame advances the blades by `60 / bladeCount` degrees, so the six frames of
 * `FAN_MOTION_FRAMES` cover exactly one blade pitch and the renderer's cycle loops smoothly.
 * The construction is chosen through the ID-keyed style tables in `render/art.ts`.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style, type FanStyle } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_rounded_rect,
  line,
  linear_gradient,
  radial_gradient,
  rounded_rect_path,
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
  floor_shadow,
  FORESHORTEN,
  INK,
  outline_style,
  resolve_linear_rotation,
  soft_glow,
  standing_height,
  stroke_outline,
} from "./ambience";
import { type Box, DARK_STEEL, STEEL } from "./shared";

/** Degrees the whole motion cycle turns a rotor; divided by the blade count per frame. */
const CYCLE_DEGREES = 60;
/** Zinc-grey of the exhaust housing and duct. */
const ZINC = 0x9aa8a6;
/** Pale enamel of the ceiling fan's blades and motor. */
const ENAMEL_WHITE = 0xe9edea;
/** Pale moulded plastic of the tower and bladeless fans. */
const SHELL = 0xe2e9e6;
/** Mustard of the drum fan's hub badge. */
const MUSTARD = 0xd5a021;
/** Black rubber of castors and feet. */
const RUBBER = 0x2c3533;
/** Horizontal radius of the drum fan's front rim (a drum about 0.7 m across). */
const DRUM_RX = 17;
/** Vertical radius of the drum's front rim, foreshortened a little because it faces south. */
const DRUM_RY = 14;
/** How much of the drum's casing shows above its front rim, seen from above: a deep drum. */
const DRUM_DEPTH = 9;
/** Height of the drum's lowest point above the floor. */
const DRUM_LIFT = 5;
/** Horizontal radius of the quiet fan's air loop. */
const LOOP_RX = 8;
/** Vertical radius of the quiet fan's air loop. */
const LOOP_RY = 9.5;

type FanPainter = (
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  motion: number,
  rotation: Rotation,
) => void;

/** How a set of rotor blades is drawn. */
interface BladeOptions {
  readonly count: number;
  readonly colour: number;
  readonly motion: number;
  readonly frame: PaintFrame;
  /** Distance from the hub centre where a blade starts. */
  readonly root: number;
  /** Widest extent of a blade across its axis. */
  readonly width: number;
  /** Horizontal squash of the rotor disc (1 face-on, small when seen edge-on). */
  readonly squash_x: number;
  /** Vertical squash of the rotor disc (the foreshortening of a horizontal rotor). */
  readonly squash_y: number;
}

/**
 * Gives the angle of one blade at a motion frame.
 *
 * @param blade - The blade index.
 * @param blade_count - Blades on the rotor.
 * @param motion - The motion frame, 0 to 5.
 * @returns The blade's angle in radians, clockwise from east.
 */
function rotor_angle(blade: number, blade_count: number, motion: number): number {
  const step_degrees = CYCLE_DEGREES / blade_count;
  return (blade / blade_count) * TAU + (motion * step_degrees * Math.PI) / 180;
}

/**
 * Traces a tapered rotor blade along +x from the hub, widest past its middle, with a rounded tip.
 *
 * @param ctx - The paint context.
 * @param root - Where the blade starts along +x.
 * @param length - The blade's length from its root.
 * @param width - The blade's widest extent.
 */
function blade_path(ctx: PaintContext, root: number, length: number, width: number): void {
  const tip = root + length;
  ctx.beginPath();
  ctx.moveTo(root, -width * 0.22);
  ctx.quadraticCurveTo(root + length * 0.55, -width * 0.62, tip, -width * 0.2);
  ctx.quadraticCurveTo(tip + width * 0.22, 0, tip, width * 0.2);
  ctx.quadraticCurveTo(root + length * 0.55, width * 0.5, root, width * 0.22);
  ctx.closePath();
}

/**
 * Paints a rotor's blades turned to a motion frame, inside a disc squashed to the view.
 *
 * @param ctx - The paint context.
 * @param cx - Hub centre x.
 * @param cy - Hub centre y.
 * @param radius - Blade tip radius before squashing.
 * @param options - Blade count, colour, motion frame, shape and squash.
 */
function paint_blades(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  options: BladeOptions,
): void {
  const { count, colour, root, width } = options;
  const length = radius - root;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(options.squash_x, options.squash_y);
  for (let blade = 0; blade < count; blade += 1) {
    ctx.save();
    ctx.rotate(rotor_angle(blade, count, options.motion));
    blade_path(ctx, root, length, width);
    ctx.fillStyle = linear_gradient(ctx, root, -width / 2, radius, width / 2, [
      [0, tint(colour, 0.28)],
      [0.55, colour],
      [1, shade(colour, 0.3)],
    ]);
    ctx.fill();
    if (!options.frame.isLowDetail) {
      ctx.beginPath();
      ctx.moveTo(root + 2, -width * 0.2);
      ctx.quadraticCurveTo(root + length * 0.55, -width * 0.5, radius - 2, -width * 0.16);
      ctx.strokeStyle = css(0xffffff, 0.4);
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    blade_path(ctx, root, length, width);
    ctx.strokeStyle = options.frame.isHighContrast ? css(INK) : css(shade(colour, 0.55), 0.6);
    ctx.lineWidth = options.frame.isHighContrast ? 1.4 : 0.8;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Paints a domed hub cap lit from the north-west.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - The cap radius.
 * @param colour - The cap colour.
 */
function paint_hub(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  colour: number,
): void {
  fill_circle(
    ctx,
    cx,
    cy,
    radius,
    radial_gradient(ctx, cx - radius * 0.35, cy - radius * 0.35, 0, radius * 1.6, [
      [0, tint(colour, 0.45)],
      [0.6, colour],
      [1, shade(colour, 0.45)],
    ]),
  );
  fill_circle(ctx, cx - radius * 0.3, cy - radius * 0.3, radius * 0.3, css(0xffffff, 0.45));
}

/** The shape of a fan cage: its disc squash, ring and spoke counts, steel and rim weight. */
interface CageOptions {
  readonly squash_x: number;
  readonly squash_y: number;
  readonly rings: number;
  readonly spokes: number;
  readonly steel: number;
  readonly is_heavy?: boolean;
}

/**
 * Paints the view through a cage to the motor behind: a disc darker at the centre.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - The cage radius.
 * @param options - The cage shape.
 */
function paint_cage_back(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  options: CageOptions,
): void {
  const { steel } = options;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(options.squash_x, options.squash_y);
  fill_circle(
    ctx,
    0,
    0,
    radius + 0.5,
    radial_gradient(ctx, 0, 0, 0, radius + 0.5, [
      [0, shade(steel, 0.5)],
      [0.75, shade(steel, 0.2)],
      [1, shade(steel, 0.05)],
    ]),
  );
  ctx.restore();
}

/**
 * Paints a wire cage over a rotor: spokes, concentric rings and a thick rim with a north-west
 * highlight, squashed to the view.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - The rim radius before squashing.
 * @param frame - The paint frame.
 * @param options - The cage shape.
 */
function paint_cage(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  frame: PaintFrame,
  options: CageOptions,
): void {
  const { steel, squash_x, squash_y } = options;
  const wire = css(shade(steel, 0.3), 0.8);
  const spokes = frame.isLowDetail ? Math.ceil(options.spokes / 2) : options.spokes;
  for (let spoke = 0; spoke < spokes; spoke += 1) {
    const radians = (spoke / spokes) * TAU;
    line(
      ctx,
      cx + Math.cos(radians) * radius * 0.22 * squash_x,
      cy + Math.sin(radians) * radius * 0.22 * squash_y,
      cx + Math.cos(radians) * radius * squash_x,
      cy + Math.sin(radians) * radius * squash_y,
      wire,
      0.7,
      "butt",
    );
  }
  for (let ring = 1; ring <= options.rings; ring += 1) {
    const ring_radius = radius * (ring / (options.rings + 1));
    stroke_ellipse(ctx, cx, cy, ring_radius * squash_x, ring_radius * squash_y, wire, 0.7);
  }
  const rim_width = options.is_heavy ? 2.6 : 1.8;
  stroke_ellipse(
    ctx,
    cx,
    cy,
    radius * squash_x,
    radius * squash_y,
    css(frame.isHighContrast ? INK : shade(steel, 0.35), 0.95),
    frame.isHighContrast ? rim_width + 0.8 : rim_width,
  );
  arc_path(ctx, cx, cy, radius * squash_x, radius * squash_y, Math.PI * 1.1, Math.PI * 1.55);
  ctx.strokeStyle = css(0xffffff, 0.55);
  ctx.lineWidth = options.is_heavy ? 1.4 : 1;
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Paints a small wall plate with two screws, the fixing the wall fan's bracket leaves from.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height.
 */
function paint_wall_plate(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    height,
    1.5,
    linear_gradient(ctx, x, y, x + width, y + height, [
      [0, tint(DARK_STEEL, 0.3)],
      [1, shade(DARK_STEEL, 0.2)],
    ]),
  );
  if (width > 6) {
    fill_circle(ctx, x + 2.5, y + height / 2, 0.9, css(SHADOW_INK, 0.6));
    fill_circle(ctx, x + width - 2.5, y + height / 2, 0.9, css(SHADOW_INK, 0.6));
  }
}

/**
 * Paints a wall fan head's rotor and cage at a squash, front grille towards the camera.
 *
 * @param ctx - The paint context.
 * @param cx - Head centre x.
 * @param cy - Head centre y.
 * @param radius - The cage radius.
 * @param squash_x - Horizontal squash (1 face-on).
 * @param recipe - The recipe, whose accent colours the blades.
 * @param motion - The motion frame.
 * @param frame - The paint frame.
 */
function paint_wall_fan_face(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  squash_x: number,
  recipe: PlaceableVisualRecipe,
  motion: number,
  frame: PaintFrame,
): void {
  const cage: CageOptions = { squash_x, squash_y: 1, rings: 2, spokes: 14, steel: STEEL };
  paint_cage_back(ctx, cx, cy, radius, cage);
  paint_blades(ctx, cx, cy, radius - 1.5, {
    count: 3,
    colour: recipe.accent,
    motion,
    frame,
    root: 2.5,
    width: radius * 0.66,
    squash_x,
    squash_y: 1,
  });
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squash_x, 1);
  paint_hub(ctx, 0, 0, 3.4, DARK_STEEL);
  ctx.restore();
  paint_cage(ctx, cx, cy, radius, frame, cage);
}

/**
 * Paints the wall circulation fan on its bracket, mounted high: at rotation 0 the bracket leaves
 * a wall plate on the north edge and the caged head faces the camera; at 180 the camera sees the
 * motor's back; at 90 and 270 the head is seen side-on, facing west or east. Nothing stands on
 * the floor, and its shadow there is a faint, soft smudge, because it draws above the guests
 * walking under it.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent colours the blades.
 * @param motion - The motion frame.
 * @param rotation - The placement rotation.
 */
function paint_wall_fan(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  motion: number,
  rotation: Rotation,
): void {
  const radius = Math.min(box.width, box.height) * 0.28;
  const cx = box.centreX;
  if (rotation === 90 || rotation === 270) {
    const direction = rotation === 90 ? -1 : 1;
    const head_x = cx + direction * 4;
    const head_y = box.y + 5;
    const plate_x = direction < 0 ? box.right - 6 : box.x + 3;
    soft_glow(ctx, head_x + 5, box.bottom - 11, radius * 0.7, radius * 0.3, SHADOW_INK, 0.08);
    paint_wall_plate(ctx, plate_x, head_y - 12, 3, 13);
    line(ctx, plate_x + 1.5, head_y - 6, head_x - direction * 9, head_y - 2, css(DARK_STEEL), 2.6);
    const motor_x = head_x - direction * 7;
    fill_rounded_rect(
      ctx,
      motor_x - 5,
      head_y - 5.5,
      10,
      11,
      4.5,
      linear_gradient(ctx, 0, head_y - 5.5, 0, head_y + 5.5, [
        [0, tint(DARK_STEEL, 0.35)],
        [1, shade(DARK_STEEL, 0.3)],
      ]),
    );
    fill_circle(ctx, motor_x, head_y - 6.5, 1.6, css(shade(DARK_STEEL, 0.3)));
    paint_wall_fan_face(ctx, head_x, head_y, radius, 0.36, recipe, motion, frame);
    return;
  }
  if (rotation === 180) {
    const head_y = box.y + 6;
    soft_glow(ctx, cx + 6, box.bottom - 11, radius, radius * 0.3, SHADOW_INK, 0.08);
    const cage: CageOptions = { squash_x: 1, squash_y: 1, rings: 3, spokes: 14, steel: STEEL };
    paint_cage_back(ctx, cx, head_y, radius, cage);
    paint_blades(ctx, cx, head_y, radius - 1.5, {
      count: 3,
      colour: shade(recipe.accent, 0.35),
      motion,
      frame,
      root: 2.5,
      width: radius * 0.66,
      squash_x: 1,
      squash_y: 1,
    });
    paint_cage(ctx, cx, head_y, radius, frame, cage);
    fill_circle(
      ctx,
      cx,
      head_y,
      radius * 0.42,
      radial_gradient(ctx, cx - 2, head_y - 2, 0, radius * 0.6, [
        [0, tint(DARK_STEEL, 0.35)],
        [1, shade(DARK_STEEL, 0.3)],
      ]),
    );
    for (let vent = -1; vent <= 1; vent += 1) {
      line(ctx, cx - 3, head_y + vent * 2, cx + 3, head_y + vent * 2, css(SHADOW_INK, 0.5), 0.8);
    }
    fill_rounded_rect(ctx, cx - 2.5, head_y + radius * 0.4, 5, 14, 2, css(DARK_STEEL));
    paint_wall_plate(ctx, cx - 7, head_y + radius * 0.4 + 11, 14, 8);
    return;
  }
  const head_y = box.y + 9;
  soft_glow(ctx, cx + 6, box.bottom - 10, radius, radius * 0.3, SHADOW_INK, 0.08);
  paint_wall_plate(ctx, cx - 7, box.y - 14, 14, 8);
  fill_rounded_rect(ctx, cx - 2.5, box.y - 8, 5, 8, 2, css(DARK_STEEL));
  fill_ellipse(ctx, cx, head_y - radius + 1, 7, 5, css(shade(DARK_STEEL, 0.15)));
  fill_ellipse(ctx, cx - 2, head_y - radius - 1, 3, 1.5, css(0xffffff, 0.3));
  paint_wall_fan_face(ctx, cx, head_y, radius, 1, recipe, motion, frame);
}

/**
 * Paints the ceiling fan's motor housing: a short enamel drum in elevation with a lit top, an
 * accent band and a rounded bottom cap.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - The rotor plane's y.
 * @param radius - The drum's radius.
 * @param accent - The band colour.
 * @param frame - The paint frame.
 */
function paint_ceiling_motor(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius: number,
  accent: number,
  frame: PaintFrame,
): void {
  const top = cy - 7;
  const bottom = cy + 3;
  const side = linear_gradient(ctx, cx - radius, 0, cx + radius, 0, [
    [0, tint(ENAMEL_WHITE, 0.4)],
    [0.45, ENAMEL_WHITE],
    [1, shade(ENAMEL_WHITE, 0.35)],
  ]);
  fill_ellipse(ctx, cx, bottom + 2, radius * 0.55, radius * 0.3, css(shade(ENAMEL_WHITE, 0.3)));
  fill_rounded_rect(ctx, cx - radius, top, radius * 2, bottom - top, 0, side);
  fill_ellipse(ctx, cx, bottom, radius, radius * FORESHORTEN * 0.5, side);
  fill_rounded_rect(ctx, cx - radius, cy - 2.5, radius * 2, 2.2, 0, css(accent));
  fill_ellipse(
    ctx,
    cx,
    top,
    radius,
    radius * FORESHORTEN * 0.5,
    radial_gradient(ctx, cx - radius * 0.4, top - 1, 0, radius * 1.4, [
      [0, tint(ENAMEL_WHITE, 0.5)],
      [1, shade(ENAMEL_WHITE, 0.15)],
    ]),
  );
  const edge = outline_style(ENAMEL_WHITE, frame);
  ctx.beginPath();
  ctx.moveTo(cx - radius, top);
  ctx.lineTo(cx - radius, bottom);
  ctx.ellipse(cx, bottom, radius, radius * FORESHORTEN * 0.5, 0, Math.PI, 0, true);
  ctx.lineTo(cx + radius, top);
  ctx.ellipse(cx, top, radius, radius * FORESHORTEN * 0.5, 0, 0, TAU);
  ctx.strokeStyle = edge.colour;
  ctx.lineWidth = edge.width;
  ctx.stroke();
}

/**
 * Paints the broad ceiling fan: three long enamel blades on a horizontal rotor foreshortened by
 * the camera, a motor drum on a downrod from the ceiling, and one soft, faint shadow disc on the
 * floor far below and to the south-east.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent is the motor band.
 * @param motion - The motion frame.
 */
function paint_ceiling_fan(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  motion: number,
): void {
  const cx = box.centreX;
  const cy = box.y + box.height * 0.28;
  const radius = Math.min(box.width, box.height) * 0.4;
  const blade_width = radius * 0.34;
  const root = radius * 0.16;
  const squash_y = FORESHORTEN;
  // One soft, faint disc far below and to the south-east: the fan hangs high above the floor.
  const shadow_radius = radius * 0.5;
  soft_glow(
    ctx,
    cx + 14,
    Math.min(box.bottom - shadow_radius * squash_y - 6, cy + 54),
    shadow_radius,
    shadow_radius * squash_y,
    SHADOW_INK,
    0.09,
  );
  ceiling_cord(ctx, box, cx, cy - 7, 3);
  paint_blades(ctx, cx, cy, radius, {
    count: 3,
    colour: ENAMEL_WHITE,
    motion,
    frame,
    root,
    width: blade_width,
    squash_x: 1,
    squash_y,
  });
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, squash_y);
  for (let blade = 0; blade < 3; blade += 1) {
    ctx.save();
    ctx.rotate(rotor_angle(blade, 3, motion));
    fill_rounded_rect(ctx, root - 6, -2.5, radius * 0.22, 5, 2, css(DARK_STEEL));
    fill_rounded_rect(ctx, root - 5, -2, radius * 0.16, 1.4, 0.7, css(0xffffff, 0.35));
    ctx.restore();
  }
  ctx.restore();
  paint_ceiling_motor(ctx, cx, cy, radius * 0.2, recipe.accent, frame);
}

/**
 * Paints the column fan: a slim moulded tower on a round foot, its tall grille on the south
 * face, an accent band and a control cap seen from above.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent is the trim band.
 */
function paint_column_fan(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const cx = box.centreX;
  const foot_y = box.y + box.height * 0.76;
  const top = foot_y - standing_height(1.1);
  const half = 6.5;
  floor_shadow(ctx, cx + 3, foot_y + 1.5, 12, 4, 0.24);
  fill_ellipse(ctx, cx, foot_y + 1.2, 11, 4.2, css(shade(DARK_STEEL, 0.25)));
  fill_ellipse(
    ctx,
    cx,
    foot_y,
    11,
    4,
    radial_gradient(ctx, cx - 4, foot_y - 2, 0, 14, [
      [0, tint(DARK_STEEL, 0.4)],
      [1, DARK_STEEL],
    ]),
  );
  const side = linear_gradient(ctx, cx - half, 0, cx + half, 0, [
    [0, tint(SHELL, 0.45)],
    [0.4, SHELL],
    [1, shade(SHELL, 0.4)],
  ]);
  fill_rounded_rect(ctx, cx - half, top, half * 2, foot_y - top - 1, 3, side);
  const grille_y = top + 6.5;
  const grille_height = foot_y - grille_y - 5;
  fill_rounded_rect(ctx, cx - 4, grille_y, 8, grille_height, 2.5, css(shade(SHELL, 0.6)));
  const slots = frame.isLowDetail ? 2 : 4;
  for (let slot = 0; slot < slots; slot += 1) {
    const slot_x = cx - 2.6 + (slot / (slots - 1)) * 5.2;
    line(ctx, slot_x, grille_y + 2, slot_x, grille_y + grille_height - 2, css(SHELL, 0.4), 0.8);
  }
  fill_rounded_rect(ctx, cx - half, top + 3.5, half * 2, 1.8, 0.9, css(recipe.accent));
  fill_ellipse(
    ctx,
    cx,
    top + 0.5,
    half,
    2.6,
    radial_gradient(ctx, cx - 2, top - 0.5, 0, half * 1.6, [
      [0, tint(SHELL, 0.6)],
      [1, shade(SHELL, 0.12)],
    ]),
  );
  fill_circle(ctx, cx + 2.2, top + 0.5, 0.9, css(recipe.accent));
  fill_circle(ctx, cx - 1.2, top + 0.5, 0.7, css(shade(SHELL, 0.5)));
  rounded_rect_path(ctx, cx - half, top - 2, half * 2, foot_y - top + 1, 3);
  stroke_outline(ctx, SHELL, frame);
}

/**
 * Paints the drum fan's wheeled base: a tubular frame seen from above with four castors, and
 * the yoke rising from it to the drum's pivots.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param floor_y - The frame's front edge on the floor.
 * @param half - Half the frame's width.
 * @param pivot_y - The y of the drum's pivots.
 * @param pivot_half - Half the distance between the pivots.
 */
function paint_drum_stand(
  ctx: PaintContext,
  cx: number,
  floor_y: number,
  half: number,
  pivot_y: number,
  pivot_half: number,
): void {
  const back_y = floor_y - 10;
  floor_shadow(ctx, cx + 3, floor_y - 3, half + 6, 7, 0.24);
  for (const castor_x of [cx - half, cx + half]) {
    for (const castor_y of [back_y, floor_y]) {
      fill_ellipse(ctx, castor_x, castor_y + 1.2, 2.2, 1.3, css(RUBBER));
    }
  }
  const tube = css(shade(DARK_STEEL, 0.1));
  line(ctx, cx - half, back_y, cx + half, back_y, tube, 2.6);
  line(ctx, cx - half, back_y, cx - half, floor_y, tube, 2.6);
  line(ctx, cx + half, back_y, cx + half, floor_y, tube, 2.6);
  line(ctx, cx - half, floor_y, cx + half, floor_y, css(DARK_STEEL), 2.8);
  line(ctx, cx - half + 2, floor_y - 0.9, cx + half - 2, floor_y - 0.9, css(0xffffff, 0.25), 0.8);
  for (const side of [-1, 1] as const) {
    const foot_x = cx + side * half;
    const pivot_x = cx + side * pivot_half;
    line(ctx, foot_x, floor_y - 4, pivot_x, pivot_y, css(DARK_STEEL), 2.4);
    line(ctx, foot_x - 0.7, floor_y - 4, pivot_x - 0.7, pivot_y, css(0xffffff, 0.2), 0.7);
    fill_circle(ctx, pivot_x, pivot_y, 2.4, css(shade(DARK_STEEL, 0.3)));
    fill_circle(ctx, pivot_x - 0.6, pivot_y - 0.6, 0.9, css(MUSTARD));
  }
}

/**
 * Traces the drum casing's silhouette: the top half of the back rim, then down the east side to
 * the front rim and around its bottom half, closed up the west side.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - The front rim's centre y.
 */
function drum_silhouette_path(ctx: PaintContext, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy - DRUM_DEPTH, DRUM_RX, DRUM_RY, 0, Math.PI, TAU);
  ctx.lineTo(cx + DRUM_RX, cy);
  ctx.ellipse(cx, cy, DRUM_RX, DRUM_RY, 0, 0, Math.PI);
  ctx.closePath();
}

/**
 * Paints the drum fan's casing as a deep cylinder facing south: its sides, and the band of its
 * top seen from above between the back rim and the front rim, lit on its north-west.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - The front rim's centre y.
 */
function paint_drum_casing(ctx: PaintContext, cx: number, cy: number): void {
  const back_y = cy - DRUM_DEPTH;
  drum_silhouette_path(ctx, cx, cy);
  ctx.fillStyle = linear_gradient(ctx, cx - DRUM_RX, 0, cx + DRUM_RX, 0, [
    [0, tint(DARK_STEEL, 0.3)],
    [0.45, DARK_STEEL],
    [1, shade(DARK_STEEL, 0.42)],
  ]);
  ctx.fill();
  // The top band: from the back rim's top arc down to the front rim's top arc.
  ctx.beginPath();
  ctx.ellipse(cx, back_y, DRUM_RX, DRUM_RY, 0, Math.PI, TAU);
  ctx.lineTo(cx + DRUM_RX, cy);
  ctx.ellipse(cx, cy, DRUM_RX, DRUM_RY, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, cx - DRUM_RX, back_y - DRUM_RY, cx + DRUM_RX, cy, [
    [0, tint(DARK_STEEL, 0.6)],
    [0.45, tint(DARK_STEEL, 0.28)],
    [1, shade(DARK_STEEL, 0.2)],
  ]);
  ctx.fill();
  arc_path(ctx, cx, back_y, DRUM_RX - 0.8, DRUM_RY - 0.8, Math.PI * 1.08, Math.PI * 1.5);
  ctx.strokeStyle = css(0xffffff, 0.5);
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.stroke();
  // Ambient occlusion where the casing meets the front rim.
  arc_path(ctx, cx, cy - 1, DRUM_RX - 0.5, DRUM_RY, Math.PI * 1.05, Math.PI * 1.95);
  ctx.strokeStyle = css(SHADOW_INK, 0.28);
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

/** Where the drum fan sits in its footprint. */
export interface DrumFanLayout {
  /** The wheeled frame's front edge on the floor. */
  readonly floor_y: number;
  /** The centre of the drum's front rim. */
  readonly cy: number;
  /** The top of the casing, the highest point of the fan. */
  readonly top_y: number;
}

/**
 * Lays out the drum fan at real-world scale: the drum's front rim lifted a little off its frame
 * and the deep casing showing above it, so the whole fan is no taller than a tall guest.
 *
 * @param box - The footprint box.
 * @returns The layout.
 */
export function drum_fan_layout(box: Box): DrumFanLayout {
  const floor_y = box.centreY + 16;
  const cy = floor_y - DRUM_LIFT - DRUM_RY;
  return { floor_y, cy, top_y: cy - DRUM_DEPTH - DRUM_RY - 1 };
}

/**
 * Paints the high-volume air fan at real-world scale (about as tall as a guest): a deep steel
 * drum facing the camera on a tilting yoke over a small wheeled frame, five blades turning
 * behind a heavy cage, and a carry handle lying across the top of the casing. The rest of its
 * footprint is clear floor for the air it throws.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent colours the blades.
 * @param motion - The motion frame.
 */
function paint_drum_fan(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  motion: number,
): void {
  const cx = box.centreX;
  const { floor_y, cy } = drum_fan_layout(box);
  const squash_y = DRUM_RY / DRUM_RX;
  paint_drum_stand(ctx, cx, floor_y, DRUM_RX * 0.82, cy + 1, DRUM_RX + 2);
  paint_drum_casing(ctx, cx, cy);
  const cage: CageOptions = {
    squash_x: 1,
    squash_y,
    rings: 2,
    spokes: 16,
    steel: STEEL,
    is_heavy: true,
  };
  paint_cage_back(ctx, cx, cy, DRUM_RX, cage);
  paint_blades(ctx, cx, cy, DRUM_RX - 2, {
    count: 5,
    colour: recipe.accent,
    motion,
    frame,
    root: 3,
    width: DRUM_RX * 0.55,
    squash_x: 1,
    squash_y,
  });
  paint_hub(ctx, cx, cy, 3.6, DARK_STEEL);
  fill_circle(ctx, cx, cy, 1.4, css(MUSTARD));
  paint_cage(ctx, cx, cy, DRUM_RX, frame, cage);
  // The carry handle, lying across the top of the casing.
  const handle_y = cy - DRUM_DEPTH - DRUM_RY + 3.5;
  arc_path(ctx, cx, handle_y, 6, 2.5, Math.PI, TAU);
  ctx.strokeStyle = css(shade(DARK_STEEL, 0.4));
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();
  arc_path(ctx, cx, handle_y - 0.6, 5.5, 2, Math.PI * 1.1, Math.PI * 1.5);
  ctx.strokeStyle = css(0xffffff, 0.35);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  drum_silhouette_path(ctx, cx, cy);
  stroke_outline(ctx, DARK_STEEL, frame);
}

/**
 * Paints the quiet bladeless fan's loop: an oval ring facing the camera, its inner top surface
 * showing its depth, with streaks of air inside turning with the motion frame.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param motion - The motion frame.
 * @param frame - The paint frame.
 */
function paint_air_loop(
  ctx: PaintContext,
  cx: number,
  cy: number,
  motion: number,
  frame: PaintFrame,
): void {
  const rx = LOOP_RX;
  const ry = LOOP_RY;
  const thickness = 3.2;
  fill_ellipse(ctx, cx, cy, rx - thickness / 2, ry - thickness / 2, css(0xd8e6e8, 0.3));
  arc_path(ctx, cx, cy - 0.6, rx - thickness, ry - thickness, Math.PI, TAU);
  ctx.strokeStyle = css(shade(SHELL, 0.4));
  ctx.lineWidth = 1.6;
  ctx.stroke();
  if (!frame.isLowDetail) {
    for (let vane = 0; vane < 3; vane += 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.rotate(rotor_angle(vane, 3, motion));
      ctx.beginPath();
      ctx.arc(0, 0, rx * 0.42, -0.6, 0.6);
      ctx.strokeStyle = css(0xffffff, 0.55);
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }
  }
  stroke_ellipse(
    ctx,
    cx,
    cy,
    rx - thickness / 2,
    ry - thickness / 2,
    linear_gradient(ctx, cx - rx, cy - ry, cx + rx, cy + ry, [
      [0, tint(SHELL, 0.55)],
      [0.5, SHELL],
      [1, shade(SHELL, 0.32)],
    ]),
    thickness,
  );
  arc_path(ctx, cx, cy, rx - thickness / 2, ry - thickness / 2, Math.PI * 1.1, Math.PI * 1.5);
  ctx.strokeStyle = css(0xffffff, 0.65);
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Paints the quiet corner fan: a bladeless loop on a slim moulded pedestal with an intake
 * grille and an accent band, standing on a round foot.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent is the trim band.
 * @param motion - The motion frame.
 */
function paint_bladeless_fan(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  motion: number,
): void {
  const cx = box.centreX;
  const foot_y = box.y + box.height * 0.76;
  const pedestal_top = foot_y - 10;
  const loop_y = foot_y - standing_height(1.2) + LOOP_RY;
  floor_shadow(ctx, cx + 3, foot_y + 1.5, 10, 3.6, 0.24);
  fill_ellipse(ctx, cx, foot_y + 0.8, 8.5, 3.4, css(shade(SHELL, 0.42)));
  fill_ellipse(ctx, cx, foot_y, 8.5, 3.2, css(tint(SHELL, 0.1)));
  const side = linear_gradient(ctx, cx - 5.5, 0, cx + 5.5, 0, [
    [0, tint(SHELL, 0.4)],
    [0.45, SHELL],
    [1, shade(SHELL, 0.38)],
  ]);
  fill_rounded_rect(ctx, cx - 5.5, pedestal_top, 11, foot_y - pedestal_top, 3, side);
  const slits = frame.isLowDetail ? 1 : 2;
  for (let slit = 0; slit < slits; slit += 1) {
    const slit_y = pedestal_top + 6.3 + slit * 1.4;
    line(ctx, cx - 3.5, slit_y, cx + 3.5, slit_y, css(shade(SHELL, 0.5), 0.8), 0.8, "butt");
  }
  fill_rounded_rect(ctx, cx - 5.5, pedestal_top + 3.6, 11, 1.4, 0.7, css(recipe.accent));
  rounded_rect_path(ctx, cx - 5.5, pedestal_top, 11, foot_y - pedestal_top, 3);
  stroke_outline(ctx, SHELL, frame);
  paint_air_loop(ctx, cx, loop_y, motion, frame);
  const edge = outline_style(SHELL, frame);
  stroke_ellipse(ctx, cx, loop_y, LOOP_RX, LOOP_RY, edge.colour, edge.width);
}

/**
 * Paints a caged floor fan: the drum fan, or the bladeless quiet fan for the quiet motif.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose motif tells the two apart.
 * @param motion - The motion frame.
 */
function paint_floor_fan(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  motion: number,
): void {
  if (recipe.motif.includes("quiet")) {
    paint_bladeless_fan(ctx, box, frame, recipe, motion);
  } else {
    paint_drum_fan(ctx, box, frame, recipe, motion);
  }
}

/**
 * Paints a row of louvre slats across a rectangle: lit upper lips over dark gaps.
 *
 * @param ctx - The paint context.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - Width.
 * @param height - Height.
 * @param slats - Number of slats.
 */
function paint_louvres(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
  slats: number,
): void {
  fill_rounded_rect(ctx, x, y, width, height, 1.5, css(shade(ZINC, 0.7)));
  const pitch = height / slats;
  for (let slat = 0; slat < slats; slat += 1) {
    const slat_y = y + slat * pitch;
    fill_rounded_rect(
      ctx,
      x + 0.5,
      slat_y + 0.4,
      width - 1,
      pitch * 0.55,
      0.8,
      css(tint(ZINC, 0.25)),
    );
  }
}

/**
 * Paints the stall exhaust booster: a zinc extractor box hung high on straps, its round duct
 * rising out of frame to the ceiling, a louvred intake on the face towards the camera, and a
 * faint shadow on the floor far below. It runs along its footprint's long side.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent is the inspection tag.
 * @param _motion - Unused; the booster's fan is hidden inside the box.
 * @param rotation - The placement rotation.
 */
function paint_exhaust(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  _motion: number,
  rotation: Rotation,
): void {
  const resolved = resolve_linear_rotation(box, rotation);
  const is_along = resolved === 90 || resolved === 270;
  const top_x = is_along ? box.centreX - 12 : box.x + 14;
  const top_w = is_along ? 24 : box.width - 28;
  const top_y = box.y - 10;
  const top_h = is_along ? box.height - 40 : 12;
  const face_h = is_along ? 12 : 15;
  const face_y = top_y + top_h;
  // A slim, soft bar of shadow far below and to the south-east, the same weight either way.
  ctx.save();
  ctx.shadowBlur = 5;
  ctx.shadowColor = css(SHADOW_INK, 0.12);
  if (is_along) {
    const shadow_top = top_y + 26;
    const shadow_bottom = Math.min(box.bottom - 6, face_y + face_h + 18);
    fill_rounded_rect(
      ctx,
      top_x + top_w / 2 + 9,
      shadow_top,
      6,
      shadow_bottom - shadow_top,
      3,
      css(SHADOW_INK, 0.1),
    );
  } else {
    const shadow_y = Math.min(box.bottom - 8, face_y + face_h + 20);
    fill_rounded_rect(ctx, top_x + 10, shadow_y, top_w, 6, 3, css(SHADOW_INK, 0.1));
  }
  ctx.restore();
  // The hanging straps and the duct up to the ceiling.
  for (const strap_x of [top_x + 4, top_x + top_w - 4])
    ceiling_cord(ctx, box, strap_x, top_y + 2, 1.4);
  const duct_x = is_along ? box.centreX : top_x + top_w * 0.72;
  const duct_y = is_along ? top_y + 10 : top_y + top_h / 2;
  const duct = linear_gradient(ctx, duct_x - 7, 0, duct_x + 7, 0, [
    [0, tint(ZINC, 0.35)],
    [0.45, ZINC],
    [1, shade(ZINC, 0.35)],
  ]);
  fill_rounded_rect(ctx, duct_x - 7, box.y - 16, 14, duct_y - box.y + 16, 0, duct);
  for (let seam = box.y - 12; seam < duct_y - 2; seam += 5) {
    line(ctx, duct_x - 7, seam, duct_x + 7, seam + 1.5, css(shade(ZINC, 0.4), 0.5), 0.7, "butt");
  }
  // The box: its ribbed top, then the louvred face towards the camera.
  fill_rounded_rect(ctx, top_x, face_y - 1, top_w, face_h + 1, 2, css(shade(ZINC, 0.3)));
  fill_rounded_rect(
    ctx,
    top_x,
    top_y,
    top_w,
    top_h,
    2,
    linear_gradient(ctx, top_x, top_y, top_x + top_w, top_y + top_h, [
      [0, tint(ZINC, 0.35)],
      [1, shade(ZINC, 0.1)],
    ]),
  );
  const ribs = is_along ? Math.floor(top_h / 6) : Math.floor(top_w / 7);
  for (let rib = 1; rib < ribs; rib += 1) {
    if (is_along) {
      const rib_y = top_y + (top_h * rib) / ribs;
      line(
        ctx,
        top_x + 2,
        rib_y,
        top_x + top_w - 2,
        rib_y,
        css(shade(ZINC, 0.25), 0.5),
        0.8,
        "butt",
      );
    } else {
      const rib_x = top_x + (top_w * rib) / ribs;
      line(
        ctx,
        rib_x,
        top_y + 2,
        rib_x,
        top_y + top_h - 2,
        css(shade(ZINC, 0.25), 0.5),
        0.8,
        "butt",
      );
    }
  }
  fill_circle(ctx, duct_x, duct_y, 7.5, css(shade(ZINC, 0.2)));
  fill_ellipse(ctx, duct_x, duct_y - 0.5, 7, 4.5, duct);
  paint_louvres(
    ctx,
    top_x + 4,
    face_y + 2.5,
    top_w - (is_along ? 8 : 22),
    face_h - 5,
    is_along ? 3 : 4,
  );
  if (!is_along) {
    fill_circle(ctx, top_x + top_w - 9, face_y + face_h / 2, 4, css(shade(ZINC, 0.45)));
    fill_circle(ctx, top_x + top_w - 9.8, face_y + face_h / 2 - 0.8, 1.4, css(0xffffff, 0.35));
  }
  fill_rounded_rect(ctx, top_x + 5, face_y + face_h - 3, 7, 2.6, 0.8, css(recipe.accent));
  const edge = outline_style(ZINC, frame);
  stroke_rounded_rect(ctx, top_x, top_y, top_w, top_h + face_h, 2, edge.colour, edge.width);
}

/** The painter for each fan style. */
const FAN_PAINTERS: Readonly<Record<FanStyle, FanPainter>> = {
  column: paint_column_fan,
  exhaust: paint_exhaust,
  "wall-rotor": paint_wall_fan,
  "ceiling-rotor": paint_ceiling_fan,
  "floor-rotor": paint_floor_fan,
};

/**
 * Paints a fan at a motion frame (the rotor turns with the frame).
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param motion - The motion frame, 0 to 5.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; the wall fan's bracket sits on the edge it is turned
 *   to and the exhaust booster follows its footprint's long side.
 */
export function paint_fan(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  motion: number,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  const style = resolve_placeable_style("fan", recipe);
  ctx.save();
  clip_texture(ctx, box);
  FAN_PAINTERS[style](ctx, box, frame, recipe, motion, rotation);
  ctx.restore();
}
