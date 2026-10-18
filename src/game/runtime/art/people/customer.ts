/**
 * The customer sprite sheet: {@link SHEET_FACINGS} rows by {@link CUSTOMER_POSES} columns of one
 * guest's appearance, and the hand anchor the renderer hangs a carried tray from.
 *
 * Poses: a relaxed stand; a three-frame walk sampled at even phases of one gait cycle (right heel
 * strike, left leg passing with the body at its highest, left heel strike as the right foot
 * pushes off), so every step between frames is the same size and the planted foot stays put,
 * with the arms swinging against the legs; a seated pose with the hips at
 * `PERSON_FEET_Y - SEAT_HEIGHT`, the thighs running forward off the seat, the shins down to the
 * floor and the forearms forward at table height; and the stand and walk holding a tray level at
 * the waist, the hands gripping its rims where the renderer draws it. Body, clothes, hair and
 * props come only from the spec.
 */
import type { PaintContext } from "../canvas";
import {
  CUSTOMER_POSES,
  PERSON_FRAME_HEIGHT,
  PERSON_FRAME_WIDTH,
  person_frame_name,
  SEAT_HEIGHT,
  SHEET_FACINGS,
  TABLE_TOP_LIFT,
  type CustomerPaintSpec,
  type CustomerPose,
  type Facing,
  type PaintPlan,
  type SheetFacing,
  type SheetFrame,
} from "../specs";
import { paint_figure, type FigureLook } from "./figure";
import { CUSTOMER_HAIR_STYLES, type HairStyle } from "./head";
import { accessory_layers, is_hand_held } from "./props";
import {
  body_metrics,
  build_rig,
  reach_for,
  type ArmIntent,
  type BodyMetrics,
  type LegIntent,
  type PoseIntent,
  type Side,
} from "./rig";
import { sleeve_for } from "./top";

/** A planted, straight leg. */
const STILL_LEG: LegIntent = { stride: 0, lift: 0, isHeelUp: false };

/** Share of a gait cycle each foot spends on the floor. */
const GAIT_STANCE = 0.6;

/** Hip drop of each walk frame: low at heel strike, high as a leg passes the other. */
const WALK_HIP_DROPS = [0.6, -0.4, 0.2] as const;

/** How far ahead of its shoulder a swinging hand travels, at most. */
const ARM_SWING = 2.8;

/**
 * Where a carried tray's centre sits relative to the feet, per facing (west mirrors east). The
 * tray is held level at the waist: in front of the body from the south, ahead of it in profile,
 * and beyond it (so behind the body) from the north.
 */
const TRAY_ANCHORS: Readonly<Record<Facing, { x: number; y: number; isBehind: boolean }>> = {
  south: { x: 0, y: -15, isBehind: false },
  north: { x: 0, y: -22, isBehind: true },
  east: { x: 13, y: -20, isBehind: false },
  west: { x: -13, y: -20, isBehind: false },
};

/**
 * Half the width of a carried tray as the renderer draws it, which is where the hands grip its
 * rims. It matches a tray texture drawn at about 0.42 scale, a little wider than the shoulders.
 */
const TRAY_GRIP_HALF = 8.4;

/** How far in front of the body the tray's rims are gripped (south and north views). */
const TRAY_GRIP_FORWARD = 7;

/** How far the tray's front rim sits below its centre in the side view, in frame pixels. */
const TRAY_FRONT_RIM = 5;

/**
 * Gives a hanging arm swinging forward (positive) or back (negative).
 *
 * @param metrics - The body metrics.
 * @param swing - Forward offset of the hand.
 * @returns The arm intent.
 */
function hanging_arm(metrics: BodyMetrics, swing: number): ArmIntent {
  return {
    forward: swing + 0.4,
    out: 0.7,
    drop: metrics.upperArm + metrics.forearm - 0.8 - Math.abs(swing) * 0.22,
    bend: "back",
  };
}

/**
 * Gives one leg at a phase of the gait cycle: on the floor and sliding back under the hips for
 * the stance share of the cycle (the heel lifting as it pushes off), then lifted and swung
 * forward.
 *
 * @param metrics - The body metrics.
 * @param phase - The gait phase, 0 at this foot's heel strike.
 * @returns The leg intent.
 */
function gait_leg(metrics: BodyMetrics, phase: number): LegIntent {
  const stride = metrics.hipHeight * 0.32;
  const lift = metrics.hipHeight * 0.2;
  const p = ((phase % 1) + 1) % 1;
  if (p < GAIT_STANCE) {
    return { stride: stride * (1 - (2 * p) / GAIT_STANCE), lift: 0, isHeelUp: p > 0.42 };
  }
  const t = (p - GAIT_STANCE) / (1 - GAIT_STANCE);
  return { stride: stride * (2 * t - 1), lift: lift * Math.sin(Math.PI * t), isHeelUp: t < 0.3 };
}

/**
 * Gives the legs, hip drop and right-arm swing of one walk frame. The three frames sit a third
 * of a cycle apart, so the walk loops 0, 1, 2, 0 with steps of equal size.
 *
 * @param metrics - The body metrics.
 * @param step - The walk frame: 0, 1 or 2.
 * @returns The legs, the hip drop and the swing of the right hand (the left swings opposite).
 */
function walk_step(
  metrics: BodyMetrics,
  step: 0 | 1 | 2,
): { legs: Record<Side, LegIntent>; hipDrop: number; swing: number } {
  const phase = step / 3;
  return {
    legs: { right: gait_leg(metrics, phase), left: gait_leg(metrics, phase + 0.5) },
    hipDrop: WALK_HIP_DROPS[step],
    // The arms lag the legs a little and swing against them: right arm back as the right heel
    // strikes.
    swing: -ARM_SWING * Math.cos(2 * Math.PI * (phase - 0.08)),
  };
}

/**
 * Gives the right arm of a guest who holds a walking stick or a briefcase in it.
 *
 * @param metrics - The body metrics.
 * @param spec - The customer spec.
 * @param swing - The swing the arm would have had.
 * @returns The arm intent.
 */
function holding_arm(metrics: BodyMetrics, spec: CustomerPaintSpec, swing: number): ArmIntent {
  if (spec.accessory === "walking-aid") {
    return {
      forward: 2.6 + swing * 0.35,
      out: 1.4,
      drop: metrics.upperArm + metrics.forearm * 0.55,
      bend: "back",
    };
  }
  return hanging_arm(metrics, swing * 0.35);
}

/**
 * Gives both arms holding a tray by its rims at the waist, placed where the renderer draws the
 * tray for the facing ({@link tray_anchor}).
 *
 * @param metrics - The body metrics.
 * @param hipUp - Height of the hips in the pose.
 * @param lean - The pose's forward lean.
 * @param facing - The sheet row.
 * @returns The two arm intents.
 */
function tray_arms(
  metrics: BodyMetrics,
  hipUp: number,
  lean: number,
  facing: SheetFacing,
): Record<Side, ArmIntent> {
  if (facing === "east") {
    // In profile the near hand grips the tray's front rim close to the body; the far hand is
    // hidden behind the tray.
    const anchor = TRAY_ANCHORS.east;
    const forward = anchor.x - TRAY_GRIP_HALF + 1.8;
    const grip = { forward, x: 1.4, up: 0 };
    const nearUp = -(anchor.y + TRAY_FRONT_RIM) + (metrics.shoulderHalf + 1.4) * 0.3;
    return {
      right: reach_for(metrics, hipUp, lean, { ...grip, up: nearUp }, "down"),
      left: reach_for(metrics, hipUp, lean, { ...grip, up: nearUp + 2 }, "down"),
    };
  }
  // From the front the hands meet the rims at the tray's mid-height; from behind they hold the
  // same height, hidden beyond the body with the elbows showing.
  const up = -TRAY_ANCHORS.south.y - 0.5 + TRAY_GRIP_FORWARD * 0.55;
  const grip = { forward: TRAY_GRIP_FORWARD, x: TRAY_GRIP_HALF, up };
  return {
    right: reach_for(metrics, hipUp, lean, grip, "down"),
    left: reach_for(metrics, hipUp, lean, grip, "down"),
  };
}

/**
 * Describes the seated pose: hips on the seat, thighs forward off it and shins down to the
 * floor, sitting up with a slight lean towards the table, the forearms forward at table height
 * and the hands together in front as if eating.
 *
 * @param metrics - The body metrics.
 * @returns The pose intent.
 */
function seated_pose(metrics: BodyMetrics): PoseIntent {
  const lean = 1.4;
  const tableUp = TABLE_TOP_LIFT + 0.6;
  return {
    hipDrop: 0,
    isSeated: true,
    lean,
    sway: 0,
    legs: { right: STILL_LEG, left: { stride: 0.7, lift: 0, isHeelUp: false } },
    arms: {
      right: reach_for(metrics, SEAT_HEIGHT, lean, { forward: 10.4, x: 4, up: tableUp }, "down"),
      left: reach_for(metrics, SEAT_HEIGHT, lean, { forward: 9.6, x: 3.3, up: tableUp }, "down"),
    },
  };
}

/**
 * Describes a customer pose.
 *
 * @param pose - The sheet column.
 * @param metrics - The body metrics.
 * @param spec - The customer spec (its accessory changes how the right hand is held).
 * @param facing - The sheet row; only the carry poses depend on it, so the hands meet the tray
 *   where the renderer draws it.
 * @returns The pose intent.
 */
export function customer_pose(
  pose: CustomerPose,
  metrics: BodyMetrics,
  spec: CustomerPaintSpec,
  facing: SheetFacing = "south",
): PoseIntent {
  if (pose === "sit") return seated_pose(metrics);
  const holds = is_hand_held(spec.accessory);
  const isCarry = pose.startsWith("carry");
  const isWalk = pose.includes("walk");
  const step = isWalk ? (Number(pose.slice(-1)) as 0 | 1 | 2) : undefined;
  const walk = step === undefined ? undefined : walk_step(metrics, step);
  const swing = walk?.swing ?? 0;
  const hipDrop = walk?.hipDrop ?? 0.2;
  const lean = isCarry ? -0.2 : isWalk ? 0.6 : 0;
  const arms: Record<Side, ArmIntent> = isCarry
    ? tray_arms(metrics, metrics.hipHeight - hipDrop, lean, facing)
    : {
        right: holds ? holding_arm(metrics, spec, swing) : hanging_arm(metrics, swing),
        left: hanging_arm(metrics, -swing),
      };
  return {
    hipDrop,
    isSeated: false,
    lean,
    sway: 0,
    legs: walk?.legs ?? {
      right: STILL_LEG,
      left: { stride: 0.5, lift: 0, isHeelUp: false },
    },
    arms,
  };
}

/**
 * Tells whether a hair colour is grey or white (similar channels, light enough).
 *
 * @param hair - The hair colour.
 * @returns True for grey hair.
 */
function is_grey_hair(hair: number): boolean {
  const channels = [(hair >>> 16) & 0xff, (hair >>> 8) & 0xff, hair & 0xff];
  return Math.max(...channels) - Math.min(...channels) < 24 && Math.min(...channels) > 0x60;
}

/**
 * Picks a guest's hair style. Each of the six `hairStyle` indices has two cuts, chosen from the
 * rest of the figure so the same index still varies between guests; grey hair takes the cuts
 * older guests often wear (a short perm, combed back, a buzz, a low bun).
 *
 * @param spec - The customer spec.
 * @returns The hair style.
 */
export function customer_hair_style(spec: CustomerPaintSpec): HairStyle {
  const count = CUSTOMER_HAIR_STYLES.length;
  const pair = CUSTOMER_HAIR_STYLES[((spec.hairStyle % count) + count) % count] ?? ["crop", "buzz"];
  if (is_grey_hair(spec.hair)) return pair[0] === "ponytail" ? "low-bun" : pair[1];
  return pair[(spec.stature + spec.build * 2 + ((spec.hair >>> 4) & 1)) % 2] ?? pair[0];
}

/**
 * Builds the look of a customer from the spec.
 *
 * @param spec - The customer spec.
 * @returns The figure look.
 */
function customer_look(spec: CustomerPaintSpec): FigureLook {
  const top = {
    silhouette: spec.silhouette,
    colour: spec.clothing,
    accent: spec.accent,
    pattern: spec.pattern,
    skin: spec.skin,
    frame: spec.frame,
  };
  return {
    head: {
      skin: spec.skin,
      hair: spec.hair,
      hairStyle: customer_hair_style(spec),
      frame: spec.frame,
    },
    top,
    sleeve: sleeve_for(top),
    lower: {
      skin: spec.skin,
      legwear: spec.legwear,
      legwearColour: spec.legwearColour,
      shoeColour: spec.shoeColour,
      frame: spec.frame,
    },
  };
}

/**
 * Paints one customer frame.
 *
 * @param ctx - The paint context, translated to the frame's corner.
 * @param spec - The customer spec.
 * @param facing - The sheet row.
 * @param pose - The sheet column.
 */
export function paint_customer_frame(
  ctx: PaintContext,
  spec: CustomerPaintSpec,
  facing: SheetFacing,
  pose: CustomerPose,
): void {
  const metrics = body_metrics(spec.stature, spec.build);
  const rig = build_rig(facing, metrics, customer_pose(pose, metrics, spec, facing));
  const isHandFree = !pose.startsWith("carry") && pose !== "sit";
  paint_figure(
    ctx,
    rig,
    customer_look(spec),
    accessory_layers(spec.accessory, spec.accent, spec.frame, isHandFree),
  );
}

/**
 * Plans a customer sprite sheet: {@link SHEET_FACINGS} rows by {@link CUSTOMER_POSES} columns.
 *
 * @param spec - The customer appearance.
 * @returns The sheet plan with one frame per facing and pose, named `facing/pose`.
 */
export function plan_customer_sheet(spec: CustomerPaintSpec): PaintPlan {
  const frames: SheetFrame[] = SHEET_FACINGS.flatMap((facing, row) =>
    CUSTOMER_POSES.map((pose, column) => ({
      name: person_frame_name(facing, pose),
      x: column * PERSON_FRAME_WIDTH,
      y: row * PERSON_FRAME_HEIGHT,
      width: PERSON_FRAME_WIDTH,
      height: PERSON_FRAME_HEIGHT,
    })),
  );
  return {
    width: CUSTOMER_POSES.length * PERSON_FRAME_WIDTH,
    height: SHEET_FACINGS.length * PERSON_FRAME_HEIGHT,
    frames,
    paint: (ctx) => {
      for (const [row, facing] of SHEET_FACINGS.entries()) {
        for (const [column, pose] of CUSTOMER_POSES.entries()) {
          ctx.save();
          ctx.translate(column * PERSON_FRAME_WIDTH, row * PERSON_FRAME_HEIGHT);
          // Each frame paints only inside its own cell of the sheet.
          ctx.beginPath();
          ctx.rect(0, 0, PERSON_FRAME_WIDTH, PERSON_FRAME_HEIGHT);
          ctx.clip();
          paint_customer_frame(ctx, spec, facing, pose);
          ctx.restore();
        }
      }
    },
  };
}

/**
 * Gives where a carried tray's centre sits relative to the feet (in world pixels) for a facing,
 * and whether the tray draws behind the body. The tray is held level at the waist: in front of
 * the body from the south, ahead of it in profile, and beyond it (so behind the body) from the
 * north. West mirrors east. The carry poses put the hands on the tray's rims at these points.
 *
 * @param facing - The facing.
 * @returns The tray offset and layering.
 */
export function tray_anchor(facing: Facing): { x: number; y: number; isBehind: boolean } {
  return { ...TRAY_ANCHORS[facing] };
}
