/**
 * The table-cleaning crew sprite sheet: {@link SHEET_FACINGS} rows by {@link CREW_POSES} columns
 * of one crew member.
 *
 * The crew shares the guests' figure, walk and tray carry (`customer_pose`), dressed in the crew
 * uniform from `visuals/crew.ts`: a work shirt under a utility apron, work trousers and a service
 * cap. Two extra frames lean over a table top and sweep a cloth across it, the right hand moving
 * from the centre line outwards while the left hand steadies the table.
 */
import { css, fill_rounded_rect, shade, type PaintContext } from "../canvas";
import {
  CREW_POSES,
  PERSON_FRAME_HEIGHT,
  PERSON_FRAME_WIDTH,
  person_frame_name,
  SHEET_FACINGS,
  TABLE_TOP_LIFT,
  type CrewPaintSpec,
  type CrewPose,
  type CustomerPaintSpec,
  type PaintPlan,
  type SheetFacing,
  type SheetFrame,
} from "../specs";
import {
  CREW_CLOTH,
  CREW_SHIRT,
  CREW_SHOES,
  CREW_TROUSERS,
  CREW_WORKWEAR,
} from "../../visuals/crew";
import { paint_apron, paint_headwear } from "./apparel";
import { customer_look, customer_pose } from "./customer";
import { paint_figure } from "./figure";
import {
  body_metrics,
  build_rig,
  reach_for,
  type BodyMetrics,
  type PoseIntent,
  type Rig,
} from "./rig";

/** Forward lean of the shoulders while wiping a table. */
const WIPE_LEAN = 2.2;
/** How far the hips sink while leaning over a table. */
const WIPE_HIP_DROP = 0.6;
/** How far in front of the body the cloth sweeps. */
const WIPE_REACH = 11;
/** Where the cloth hand sits out from the centre line in each wipe frame. */
const WIPE_SWEEP = [1.5, 6.5] as const;
/** Half the width and height of the wiping cloth, in frame pixels. */
const CLOTH_HALF_WIDTH = 2.3;
const CLOTH_HALF_HEIGHT = 1.4;

/**
 * Dresses a crew member as a customer spec, so the guest figure, look and poses apply.
 *
 * @param spec - The crew spec.
 * @returns The equivalent customer spec in the crew uniform.
 */
function as_customer_spec(spec: CrewPaintSpec): CustomerPaintSpec {
  return {
    kind: "customer",
    silhouette: "structured",
    pattern: "plain",
    accessory: "none",
    skin: spec.skin,
    clothing: CREW_SHIRT,
    accent: CREW_WORKWEAR.apronTrim,
    hair: spec.hair,
    hairStyle: spec.hairStyle,
    stature: spec.stature,
    build: spec.build,
    legwear: "trousers",
    legwearColour: CREW_TROUSERS,
    shoeColour: CREW_SHOES,
    frame: spec.frame,
  };
}

/**
 * Describes a wipe frame: leaning over the table top, the right hand sweeping the cloth and the
 * left hand resting on the table.
 *
 * @param metrics - The body metrics.
 * @param step - The wipe frame: 0 with the cloth near the centre line, 1 swept outwards.
 * @returns The pose intent.
 */
function wipe_pose(metrics: BodyMetrics, step: 0 | 1): PoseIntent {
  const hipUp = metrics.hipHeight - WIPE_HIP_DROP;
  const tableUp = TABLE_TOP_LIFT + 1;
  return {
    hipDrop: WIPE_HIP_DROP,
    isSeated: false,
    lean: WIPE_LEAN,
    sway: step === 0 ? 0 : 0.4,
    legs: {
      right: { stride: 0, lift: 0, isHeelUp: false },
      left: { stride: 0.8, lift: 0, isHeelUp: false },
    },
    arms: {
      right: reach_for(
        metrics,
        hipUp,
        WIPE_LEAN,
        { forward: WIPE_REACH, x: WIPE_SWEEP[step], up: tableUp },
        "down",
      ),
      left: reach_for(metrics, hipUp, WIPE_LEAN, { forward: 8, x: 4, up: tableUp + 1 }, "down"),
    },
  };
}

/**
 * Paints the cloth in the right hand.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 */
function paint_cloth(ctx: PaintContext, rig: Rig): void {
  const hand = rig.arms.right.end;
  fill_rounded_rect(
    ctx,
    hand.x - CLOTH_HALF_WIDTH,
    hand.y - CLOTH_HALF_HEIGHT,
    CLOTH_HALF_WIDTH * 2,
    CLOTH_HALF_HEIGHT * 2,
    0.8,
    css(CREW_CLOTH),
  );
  fill_rounded_rect(
    ctx,
    hand.x - CLOTH_HALF_WIDTH,
    hand.y + CLOTH_HALF_HEIGHT - 0.7,
    CLOTH_HALF_WIDTH * 2,
    0.7,
    0.3,
    css(shade(CREW_CLOTH, 0.25)),
  );
}

/**
 * Paints one crew frame.
 *
 * @param ctx - The paint context, translated to the frame's corner.
 * @param spec - The crew spec.
 * @param facing - The sheet row.
 * @param pose - The sheet column.
 */
export function paint_crew_frame(
  ctx: PaintContext,
  spec: CrewPaintSpec,
  facing: SheetFacing,
  pose: CrewPose,
): void {
  const dressed = as_customer_spec(spec);
  const metrics = body_metrics(spec.stature, spec.build);
  const isWipe = pose === "wipe0" || pose === "wipe1";
  const intent = isWipe
    ? wipe_pose(metrics, pose === "wipe0" ? 0 : 1)
    : customer_pose(pose, metrics, dressed, facing);
  const rig = build_rig(facing, metrics, intent);
  // Seen from behind, the cloth hand is beyond the body, so the cloth goes with the arm.
  const isBehind = facing === "north";
  paint_figure(ctx, rig, customer_look(dressed), {
    overTorso: (layer, posed) => paint_apron(layer, posed, CREW_WORKWEAR, spec.frame),
    hand: (layer, posed, arm) => {
      if (isWipe && isBehind && arm.side === "right") paint_cloth(layer, posed);
    },
    front: (layer, posed) => {
      paint_headwear(layer, posed, CREW_WORKWEAR, spec.frame);
      if (isWipe && !isBehind) paint_cloth(layer, posed);
    },
  });
}

/**
 * Plans a crew sprite sheet: {@link SHEET_FACINGS} rows by {@link CREW_POSES} columns.
 *
 * @param spec - The crew member's figure.
 * @returns The sheet plan with one frame per facing and pose, named `facing/pose`.
 */
export function plan_crew_sheet(spec: CrewPaintSpec): PaintPlan {
  const frames: SheetFrame[] = SHEET_FACINGS.flatMap((facing, row) =>
    CREW_POSES.map((pose, column) => ({
      name: person_frame_name(facing, pose),
      x: column * PERSON_FRAME_WIDTH,
      y: row * PERSON_FRAME_HEIGHT,
      width: PERSON_FRAME_WIDTH,
      height: PERSON_FRAME_HEIGHT,
    })),
  );
  return {
    width: CREW_POSES.length * PERSON_FRAME_WIDTH,
    height: SHEET_FACINGS.length * PERSON_FRAME_HEIGHT,
    frames,
    paint: (ctx) => {
      for (const [row, facing] of SHEET_FACINGS.entries()) {
        for (const [column, pose] of CREW_POSES.entries()) {
          ctx.save();
          ctx.translate(column * PERSON_FRAME_WIDTH, row * PERSON_FRAME_HEIGHT);
          // Each frame paints only inside its own cell of the sheet.
          ctx.beginPath();
          ctx.rect(0, 0, PERSON_FRAME_WIDTH, PERSON_FRAME_HEIGHT);
          ctx.clip();
          paint_crew_frame(ctx, spec, facing, pose);
          ctx.restore();
        }
      }
    },
  };
}
