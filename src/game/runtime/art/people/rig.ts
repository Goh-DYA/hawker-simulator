/**
 * The people rig: body measurements per stature and build, facing-independent pose intents, and
 * the oblique projection that turns a posed body into frame points for one sheet row.
 *
 * A figure is posed in its own body space: `right` towards the person's right hand, `forward`
 * along the way they face and `up` from the floor, in world pixels. Two-bone inverse kinematics
 * places the knees and elbows, so a stride bends the knees and a reach bends the elbows the way
 * real joints do. The projection then maps body space onto the 48 x 60 frame with the feet at
 * {@link PERSON_FEET_Y} on the centre line: height rises up the frame, and the person's own depth
 * shows as a small vertical shift, so a forward foot sits lower in the south view and higher in
 * the north view, and the near limbs of the side view sit a little lower than the far ones.
 */
import { PERSON_FEET_Y, PERSON_FRAME_WIDTH, SEAT_HEIGHT, type SheetFacing } from "../specs";

/** Frame x of the body's centre line (the renderer puts it on the tile centre). */
export const FRAME_CENTRE_X = PERSON_FRAME_WIDTH / 2;

/**
 * How much of a forward or backward offset shows on screen in the south and north views. The
 * hall itself is drawn with floor depth at full size, so this stays fairly high: a seated lap
 * and a stride read clearly, while a figure keeps its billboard depth.
 */
export const DEPTH_SQUASH = 0.72;

/** How much of a sideways offset shows on screen in the side view (near side lower). */
export const SIDE_SQUASH = 0.3;

/** Total height from the soles to the crown, per stature class. */
const STATURE_HEIGHTS = [34, 39, 44] as const;

/**
 * How many head heights tall a figure is, per stature class. About three and a half heads keeps
 * a face readable at play zoom while the body keeps adult proportions: legs about two fifths of
 * the height and hands hanging at mid-thigh.
 */
const STATURE_HEADS = [3.3, 3.55, 3.8] as const;

/** Share of the height below the neck that the legs take (hip joint to soles). */
const LEG_SHARE = 0.62;

/** Half shoulder width per build class (slim, average, broad). */
const BUILD_SHOULDER_HALF = [5.3, 6.1, 7.5] as const;
/** Half waist width per build class. */
const BUILD_WAIST_HALF = [3.9, 4.6, 6.4] as const;
/** Half hip width per build class. */
const BUILD_HIP_HALF = [4.4, 5, 6.5] as const;
/** Half torso depth (front to back, seen in the side view) per build class. */
const BUILD_DEPTH_HALF = [3.4, 4, 5.3] as const;
/** Leg thickness per build class. */
const BUILD_LEG_WIDTH = [3.2, 3.6, 4.5] as const;
/** Arm thickness per build class. */
const BUILD_ARM_WIDTH = [2.3, 2.6, 3.3] as const;

/** Height of the foot (ankle joint above the sole). */
const ANKLE_HEIGHT = 1.7;

/** A person's left or right side. */
export type Side = "right" | "left";

/** Both sides, right first. */
export const SIDES: readonly Side[] = ["right", "left"];

/**
 * Gives the sign of a side in body space.
 *
 * @param side - The side.
 * @returns +1 for the right side, -1 for the left.
 */
export function side_sign(side: Side): number {
  return side === "right" ? 1 : -1;
}

/** A point in body space, in world pixels. */
export interface Vec3 {
  readonly right: number;
  readonly forward: number;
  readonly up: number;
}

/** A point in frame pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The measurements of one body, in world pixels. */
export interface BodyMetrics {
  readonly height: number;
  readonly headHeight: number;
  readonly headWidth: number;
  readonly neck: number;
  /** Shoulder line to hip joints. */
  readonly torso: number;
  /** Hip joints to the soles, standing straight. */
  readonly hipHeight: number;
  readonly thigh: number;
  readonly shin: number;
  readonly ankle: number;
  readonly upperArm: number;
  readonly forearm: number;
  readonly shoulderHalf: number;
  readonly waistHalf: number;
  readonly hipHalf: number;
  readonly depthHalf: number;
  readonly legWidth: number;
  readonly armWidth: number;
  /** Sideways offset of each hip joint from the centre line. */
  readonly legSpread: number;
}

/**
 * Gives the measurements of a body: a figure 34, 39 or 44 px tall, about three and a half heads
 * high, whose width follows its build.
 *
 * @param stature - Height class: 0 short, 1 average, 2 tall.
 * @param build - Build class: 0 slim, 1 average, 2 broad.
 * @returns The body metrics.
 */
export function body_metrics(stature: 0 | 1 | 2, build: 0 | 1 | 2): BodyMetrics {
  const height = STATURE_HEIGHTS[stature];
  const headHeight = height / STATURE_HEADS[stature];
  const neck = 1.6 + stature * 0.25;
  const rest = height - headHeight - neck;
  const hipHeight = rest * LEG_SHARE;
  const torso = rest - hipHeight;
  const thigh = (hipHeight - ANKLE_HEIGHT) / 2 + 0.3;
  const grow = stature * 0.25;
  const hipHalf = BUILD_HIP_HALF[build] + grow * 0.6;
  const legWidth = BUILD_LEG_WIDTH[build] + grow * 0.4;
  return {
    height,
    headHeight,
    headWidth: headHeight * 0.86,
    neck,
    torso,
    hipHeight,
    thigh,
    shin: hipHeight - ANKLE_HEIGHT - thigh,
    ankle: ANKLE_HEIGHT,
    upperArm: torso * 0.64,
    forearm: torso * 0.57,
    shoulderHalf: BUILD_SHOULDER_HALF[build] + grow,
    waistHalf: BUILD_WAIST_HALF[build] + grow * 0.6,
    hipHalf,
    depthHalf: BUILD_DEPTH_HALF[build] + grow * 0.4,
    legWidth,
    armWidth: BUILD_ARM_WIDTH[build] + grow * 0.3,
    legSpread: hipHalf - legWidth / 2 - 0.1,
  };
}

/** What one leg does in a pose. */
export interface LegIntent {
  /** Forward offset of the ankle from the hip joint (negative is behind). */
  readonly stride: number;
  /** Height the foot is lifted off the floor. */
  readonly lift: number;
  /** True when the heel is raised and the foot pivots on its toe (the back foot pushing off). */
  readonly isHeelUp: boolean;
}

/** Which way an elbow bends while the hand reaches. */
export type ElbowBend = "back" | "down";

/** What one arm does in a pose: where the hand goes, relative to the shoulder joint. */
export interface ArmIntent {
  /** Forward offset of the hand from the shoulder. */
  readonly forward: number;
  /** Sideways offset of the hand away from the body. */
  readonly out: number;
  /** How far the hand sits below the shoulder (negative is above). */
  readonly drop: number;
  readonly bend: ElbowBend;
}

/** A whole pose, independent of the facing it is seen from. */
export interface PoseIntent {
  /** How far the hips sink below standing height (negative raises them, for the walk bob). */
  readonly hipDrop: number;
  /** True for the seated pose: the hips rest at {@link SEAT_HEIGHT}. */
  readonly isSeated: boolean;
  /** Forward lean of the shoulders in pixels. */
  readonly lean: number;
  /** Sideways sway of the shoulders and head in pixels (towards the right hand). */
  readonly sway: number;
  readonly legs: Readonly<Record<Side, LegIntent>>;
  readonly arms: Readonly<Record<Side, ArmIntent>>;
}

/** A hand position in body space, measured from the floor and the body's centre line. */
export interface HandTarget {
  /** Forward of the body's centre (the hips). */
  readonly forward: number;
  /** Out from the centre line, towards the hand's own side. */
  readonly x: number;
  /** Height above the floor. */
  readonly up: number;
}

/**
 * Gives an arm reaching for a point measured from the floor and the body's centre rather than
 * from the shoulder, so a hand can meet a tray, a table or a counter at a fixed height whatever
 * the figure's size.
 *
 * @param metrics - The body metrics.
 * @param hipUp - Height of the hips above the floor in the pose.
 * @param lean - The pose's forward lean.
 * @param target - Where the hand goes.
 * @param bend - Which way the elbow bends.
 * @returns The arm intent.
 */
export function reach_for(
  metrics: BodyMetrics,
  hipUp: number,
  lean: number,
  target: HandTarget,
  bend: ElbowBend,
): ArmIntent {
  const shoulderUp = hipUp + metrics.torso - metrics.armWidth * 0.35;
  const shoulderX = metrics.shoulderHalf - metrics.armWidth * 0.45;
  return {
    forward: target.forward - lean,
    out: target.x - shoulderX,
    drop: shoulderUp - target.up,
    bend,
  };
}

/** A two-bone limb after posing: shoulder or hip, elbow or knee, and hand or ankle. */
export interface Chain {
  readonly side: Side;
  readonly root: Point;
  readonly joint: Point;
  readonly end: Point;
  /** Body-space end point, for props hung from the hand. */
  readonly endBody: Vec3;
  /** Depth of the end towards the camera; larger is nearer. */
  readonly depth: number;
}

/** A posed leg: the chain plus what its foot is doing. */
export interface LegChain extends Chain {
  readonly isHeelUp: boolean;
  readonly lift: number;
}

/** A body posed and projected for one facing. */
export interface Rig {
  readonly facing: SheetFacing;
  readonly metrics: BodyMetrics;
  readonly isSeated: boolean;
  /** Centre of the hip joint line. */
  readonly hip: Point;
  /** Centre of the waist (belt line). */
  readonly waist: Point;
  /** Centre of the shoulder line. */
  readonly shoulder: Point;
  /** Centre of the head. */
  readonly head: Point;
  readonly legs: Readonly<Record<Side, LegChain>>;
  readonly arms: Readonly<Record<Side, Chain>>;
}

/**
 * Projects a body-space point onto the frame for a facing.
 *
 * @param facing - The sheet row.
 * @param point - The body-space point.
 * @returns The frame point.
 */
export function project(facing: SheetFacing, point: Vec3): Point {
  switch (facing) {
    case "south":
      return {
        x: FRAME_CENTRE_X - point.right,
        y: PERSON_FEET_Y - point.up + point.forward * DEPTH_SQUASH,
      };
    case "north":
      return {
        x: FRAME_CENTRE_X + point.right,
        y: PERSON_FEET_Y - point.up - point.forward * DEPTH_SQUASH,
      };
    case "east":
      return {
        x: FRAME_CENTRE_X + point.forward,
        y: PERSON_FEET_Y - point.up + point.right * SIDE_SQUASH,
      };
  }
}

/**
 * Gives how near a body-space point is to the camera for a facing; larger is nearer.
 *
 * @param facing - The sheet row.
 * @param point - The body-space point.
 * @returns The depth.
 */
export function depth_of(facing: SheetFacing, point: Vec3): number {
  switch (facing) {
    case "south":
      return point.forward;
    case "north":
      return -point.forward;
    case "east":
      return point.right;
  }
}

/** Adds two vectors. */
function add(a: Vec3, b: Vec3): Vec3 {
  return { right: a.right + b.right, forward: a.forward + b.forward, up: a.up + b.up };
}

/** Subtracts `b` from `a`. */
function subtract(a: Vec3, b: Vec3): Vec3 {
  return { right: a.right - b.right, forward: a.forward - b.forward, up: a.up - b.up };
}

/** Scales a vector. */
function scaled(a: Vec3, amount: number): Vec3 {
  return { right: a.right * amount, forward: a.forward * amount, up: a.up * amount };
}

/** Dot product. */
function dot(a: Vec3, b: Vec3): number {
  return a.right * b.right + a.forward * b.forward + a.up * b.up;
}

/** Vector length. */
function length_of(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

/**
 * Places the middle joint of a two-bone limb reaching for a target (inverse kinematics).
 *
 * @param root - The shoulder or hip.
 * @param target - Where the hand or ankle should go; clamped to the limb's reach.
 * @param upper - Upper bone length.
 * @param lower - Lower bone length.
 * @param pole - The direction the middle joint bends towards.
 * @returns The joint and the reached end point.
 */
export function solve_limb(
  root: Vec3,
  target: Vec3,
  upper: number,
  lower: number,
  pole: Vec3,
): { joint: Vec3; end: Vec3 } {
  const delta = subtract(target, root);
  const span = length_of(delta);
  const direction = span > 1e-6 ? scaled(delta, 1 / span) : { right: 0, forward: 0, up: -1 };
  const distance = Math.max(Math.abs(upper - lower) + 0.01, Math.min(span, upper + lower - 0.01));
  const end = add(root, scaled(direction, distance));
  const along = (upper * upper + distance * distance - lower * lower) / (2 * distance);
  const offset = Math.sqrt(Math.max(0, upper * upper - along * along));
  let bend = subtract(pole, scaled(direction, dot(pole, direction)));
  if (length_of(bend) < 1e-6) bend = { right: 0, forward: 1, up: 0 };
  bend = scaled(bend, 1 / length_of(bend));
  return { joint: add(add(root, scaled(direction, along)), scaled(bend, offset)), end };
}

/**
 * Poses a body and projects it for one facing.
 *
 * @param facing - The sheet row.
 * @param metrics - The body measurements.
 * @param intent - The pose.
 * @returns The projected rig.
 */
export function build_rig(facing: SheetFacing, metrics: BodyMetrics, intent: PoseIntent): Rig {
  const reach = metrics.thigh + metrics.shin;
  const longest = Math.max(...SIDES.map((side) => Math.abs(intent.legs[side].stride)));
  // Long strides lower the hips just enough for both feet to stay planted.
  const planted = metrics.ankle + Math.sqrt(Math.max(0, reach * reach - longest * longest)) - 0.05;
  const hipUp = intent.isSeated
    ? SEAT_HEIGHT
    : Math.min(metrics.hipHeight - intent.hipDrop, planted);
  const shoulderUp = hipUp + metrics.torso;
  const at = (point: Vec3) => project(facing, point);
  const legs = {} as Record<Side, LegChain>;
  const arms = {} as Record<Side, Chain>;
  for (const side of SIDES) {
    const sign = side_sign(side);
    const leg = intent.legs[side];
    const hip: Vec3 = { right: sign * metrics.legSpread, forward: 0, up: hipUp };
    // Seated, the thigh runs forward off the seat and the shin drops to the floor below the knee.
    const ankleTarget: Vec3 = intent.isSeated
      ? {
          right: sign * (metrics.legSpread + 0.5),
          forward: metrics.thigh * 0.92 + leg.stride,
          up: metrics.ankle + leg.lift,
        }
      : { right: sign * metrics.legSpread, forward: leg.stride, up: metrics.ankle + leg.lift };
    const solved = solve_limb(hip, ankleTarget, metrics.thigh, metrics.shin, {
      right: 0,
      forward: 1,
      up: 0,
    });
    legs[side] = {
      side,
      root: at(hip),
      joint: at(solved.joint),
      end: at(solved.end),
      endBody: solved.end,
      depth: depth_of(facing, solved.end),
      isHeelUp: leg.isHeelUp,
      lift: leg.lift,
    };
    const arm = intent.arms[side];
    const shoulder: Vec3 = {
      right: intent.sway + sign * (metrics.shoulderHalf - metrics.armWidth * 0.45),
      forward: intent.lean,
      up: shoulderUp - metrics.armWidth * 0.35,
    };
    const handTarget = add(shoulder, {
      right: sign * arm.out,
      forward: arm.forward,
      up: -arm.drop,
    });
    const pole: Vec3 =
      arm.bend === "down"
        ? { right: sign * 0.6, forward: -0.3, up: -1 }
        : { right: sign * 0.35, forward: -1, up: 0 };
    const solvedArm = solve_limb(shoulder, handTarget, metrics.upperArm, metrics.forearm, pole);
    arms[side] = {
      side,
      root: at(shoulder),
      joint: at(solvedArm.joint),
      end: at(solvedArm.end),
      endBody: solvedArm.end,
      depth: depth_of(facing, solvedArm.end),
    };
  }
  return {
    facing,
    metrics,
    isSeated: intent.isSeated,
    hip: at({ right: 0, forward: 0, up: hipUp }),
    waist: at({
      right: intent.sway * 0.3,
      forward: intent.lean * 0.3,
      up: hipUp + metrics.torso * 0.3,
    }),
    shoulder: at({ right: intent.sway, forward: intent.lean, up: shoulderUp }),
    head: at({
      right: intent.sway * 1.2,
      forward: intent.lean * 1.15 + (facing === "east" ? 0.6 : 0),
      up: shoulderUp + metrics.neck + metrics.headHeight / 2 - 0.5,
    }),
    legs,
    arms,
  };
}
