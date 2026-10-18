/**
 * Draw-output tests for the people painters in `runtime/art/people/`: the customer and vendor
 * sprite sheets, the posed rig behind them and the carried-tray anchor.
 *
 * Sheets are painted into recording contexts and digested, so the tests prove that every body,
 * outfit, hair cut and prop combination paints, that the sheet frames follow the person-frame
 * contract, that height, build and lower garments change the figure, and that painting is
 * deterministic. The rig tests pin the geometry the renderer relies on: a seated guest's hips on
 * the seat with the thighs forward, the shins to the floor and the hands at table height; the
 * hands on the rims of a carried tray where the renderer draws it; a walk whose three frames are
 * even phases of one gait with the arms swinging against the legs; and vendors at the guests'
 * size whose hands work above the stall counter.
 */
import { describe, expect, it } from "vitest";

import { CUSTOMER_ARCHETYPES, STALLS } from "@/src/content";
import type { PaintContext } from "@/src/game/runtime/art/canvas";
import { plan_customer_sheet, plan_vendor_sheet, tray_anchor } from "@/src/game/runtime/art/people";
import { customer_hair_style, customer_pose } from "@/src/game/runtime/art/people/customer";
import {
  CUSTOMER_HAIR_STYLES,
  paint_hair,
  paint_hair_behind,
} from "@/src/game/runtime/art/people/head";
import {
  body_metrics,
  build_rig,
  DEPTH_SQUASH,
  FRAME_CENTRE_X,
} from "@/src/game/runtime/art/people/rig";
import { vendor_frame, vendor_metrics } from "@/src/game/runtime/art/people/vendor";
import {
  CUSTOMER_POSES,
  FACINGS,
  PERSON_FEET_Y,
  PERSON_FRAME_HEIGHT,
  PERSON_FRAME_WIDTH,
  SEAT_HEIGHT,
  SHEET_FACINGS,
  TABLE_TOP_LIFT,
  VENDOR_POSES,
  type CustomerPaintSpec,
  type PaintFrame,
  type VendorPaintSpec,
} from "@/src/game/runtime/art/specs";
import { LEGWEAR_KINDS, visualRecipeForCustomer } from "@/src/game/runtime/visuals/customer";
import { visualRecipeForStallVendor } from "@/src/game/runtime/visuals/vendor";

import { create_recording_context, record_paint } from "./fixtures";

/** The default, high-contrast and low-detail frames. */
const FRAMES: readonly PaintFrame[] = [
  { isHighContrast: false, isLowDetail: false },
  { isHighContrast: true, isLowDetail: false },
  { isHighContrast: false, isLowDetail: true },
];

/** Every outfit silhouette. */
const SILHOUETTES: readonly CustomerPaintSpec["silhouette"][] = [
  "compact",
  "relaxed",
  "structured",
  "layered",
  "sporty",
  "classic",
];

/** Every garment pattern. */
const PATTERNS: readonly CustomerPaintSpec["pattern"][] = [
  "plain",
  "banded",
  "panelled",
  "sashed",
  "piped",
  "pocketed",
];

/** Every carried prop. */
const ACCESSORIES: readonly CustomerPaintSpec["accessory"][] = [
  "none",
  "tote",
  "briefcase",
  "backpack",
  "walking-aid",
];

/** Time allowed for the exhaustive sweeps, which paint hundreds of sheets. */
const SWEEP_TIMEOUT = { timeout: 60_000 };

/** The three height and build classes. */
const CLASSES = [0, 1, 2] as const;

/** A dark brown and a grey hair colour. */
const DARK_HAIR = 0x3a281f;
const GREY_HAIR = 0x8a8f94;

/** How far above a vendor's feet the stall counters cover the vendor. */
const COUNTER_COVER = 19;

/** A guest with an average body in a compact tee. */
const BASE_SPEC: CustomerPaintSpec = {
  kind: "customer",
  silhouette: "compact",
  pattern: "plain",
  accessory: "none",
  skin: 0xc98e68,
  clothing: 0x355e78,
  accent: 0xd69a35,
  hair: DARK_HAIR,
  hairStyle: 0,
  stature: 1,
  build: 1,
  legwear: "trousers",
  legwearColour: 0x2f3a4a,
  shoeColour: 0x2b2b2b,
  frame: FRAMES[0] as PaintFrame,
};

/**
 * Creates a paint context that accepts every call and records nothing, for the exhaustive
 * "paints without throwing" sweep where digests are not needed.
 *
 * @returns The context.
 */
function create_silent_context(): PaintContext {
  const proxy: PaintContext = new Proxy(
    {},
    {
      get: (_object, property) => (typeof property === "symbol" ? undefined : () => proxy),
      set: () => true,
    },
  ) as unknown as PaintContext;
  return proxy;
}

/**
 * Builds a customer spec from the base with some fields replaced.
 *
 * @param overrides - The fields to replace.
 * @returns The spec.
 */
function customer(overrides: Partial<CustomerPaintSpec>): CustomerPaintSpec {
  return { ...BASE_SPEC, ...overrides };
}

/**
 * Builds the vendor spec of a launch stall.
 *
 * @param stall - The stall.
 * @param frame - The paint frame.
 * @returns The spec.
 */
function vendor(
  stall: (typeof STALLS)[number],
  frame: PaintFrame = FRAMES[0] as PaintFrame,
): VendorPaintSpec {
  return { kind: "vendor", recipe: visualRecipeForStallVendor(stall), frame };
}

describe("customer sheets", () => {
  it("paints every silhouette, pattern, lower garment, stature and build", SWEEP_TIMEOUT, () => {
    const ctx = create_silent_context();
    let painted = 0;
    for (const silhouette of SILHOUETTES) {
      for (const pattern of PATTERNS) {
        for (const legwear of LEGWEAR_KINDS) {
          for (const stature of CLASSES) {
            for (const build of CLASSES) {
              const plan = plan_customer_sheet(
                customer({ silhouette, pattern, legwear, stature, build }),
              );
              expect(() => plan.paint(ctx)).not.toThrow();
              painted += 1;
            }
          }
        }
      }
    }

    expect(painted).toBe(SILHOUETTES.length * PATTERNS.length * LEGWEAR_KINDS.length * 9);
  });

  it("paints every prop and hair cut in every paint frame", SWEEP_TIMEOUT, () => {
    for (const frame of FRAMES) {
      for (const accessory of ACCESSORIES) {
        for (let hairStyle = 0; hairStyle < 6; hairStyle += 1) {
          for (const stature of [0, 1] as const) {
            for (const hair of [DARK_HAIR, GREY_HAIR]) {
              const { log } = record_paint(
                customer({ accessory, hairStyle, stature, hair, frame }),
              );

              expect(log.length, `${accessory} hair ${hairStyle} s${stature}`).toBeGreaterThan(500);
            }
          }
        }
      }
    }
  });

  it("names and places every frame per the person-frame contract", () => {
    const plan = plan_customer_sheet(BASE_SPEC);

    expect(plan.width).toBe(CUSTOMER_POSES.length * PERSON_FRAME_WIDTH);
    expect(plan.height).toBe(SHEET_FACINGS.length * PERSON_FRAME_HEIGHT);
    expect(plan.frames?.map((frame) => frame.name)).toEqual(
      SHEET_FACINGS.flatMap((facing) => CUSTOMER_POSES.map((pose) => `${facing}/${pose}`)),
    );
    for (const [index, frame] of (plan.frames ?? []).entries()) {
      expect(frame.width).toBe(PERSON_FRAME_WIDTH);
      expect(frame.height).toBe(PERSON_FRAME_HEIGHT);
      expect(frame.x).toBe((index % CUSTOMER_POSES.length) * PERSON_FRAME_WIDTH);
      expect(frame.y).toBe(Math.floor(index / CUSTOMER_POSES.length) * PERSON_FRAME_HEIGHT);
    }
  });

  it("paints each launch archetype differently from the others", SWEEP_TIMEOUT, () => {
    for (const frame of FRAMES) {
      const digests = CUSTOMER_ARCHETYPES.map((archetype) => {
        const recipe = visualRecipeForCustomer(archetype);
        return record_paint(
          customer({
            silhouette: recipe.outfitSilhouette,
            pattern: recipe.garmentPattern,
            accessory: recipe.accessory,
            frame,
          }),
        ).digest();
      });

      expect(new Set(digests).size).toBe(CUSTOMER_ARCHETYPES.length);
    }
  });

  it("paints a different figure for each stature, build and lower garment", () => {
    const statures = CLASSES.map((stature) => record_paint(customer({ stature })).digest());
    const builds = CLASSES.map((build) => record_paint(customer({ build })).digest());
    const legwear = LEGWEAR_KINDS.map((kind) => record_paint(customer({ legwear: kind })).digest());

    expect(new Set(statures).size).toBe(3);
    expect(new Set(builds).size).toBe(3);
    expect(new Set(legwear).size).toBe(LEGWEAR_KINDS.length);
  });

  it("paints every silhouette and pattern differently", () => {
    const silhouettes = SILHOUETTES.map((silhouette) =>
      record_paint(customer({ silhouette })).digest(),
    );
    const patterns = PATTERNS.map((pattern) => record_paint(customer({ pattern })).digest());

    expect(new Set(silhouettes).size).toBe(SILHOUETTES.length);
    expect(new Set(patterns).size).toBe(PATTERNS.length);
  });

  it("paints the same spec identically twice", () => {
    for (const frame of FRAMES) {
      const spec = customer({ silhouette: "layered", pattern: "sashed", accessory: "tote", frame });

      expect(record_paint(spec).digest()).toBe(record_paint(spec).digest());
    }
  });
});

describe("customer hair", () => {
  it("reaches both cuts of every hair style index for dark hair", () => {
    for (let hairStyle = 0; hairStyle < 6; hairStyle += 1) {
      const cuts = new Set(
        CLASSES.flatMap((stature) =>
          CLASSES.map((build) => customer_hair_style(customer({ hairStyle, stature, build }))),
        ),
      );

      expect([...cuts].sort(), `hair ${hairStyle}`).toEqual(
        [...(CUSTOMER_HAIR_STYLES[hairStyle] ?? [])].sort(),
      );
    }
  });

  it("gives grey hair the older cuts and never the chin-length bob", () => {
    const cuts = Array.from({ length: 6 }, (_, hairStyle) =>
      customer_hair_style(customer({ hairStyle, hair: GREY_HAIR })),
    );

    expect(cuts).not.toContain("bob");
    expect(cuts).toContain("short-perm");
    expect(cuts).toContain("low-bun");
  });

  it("paints each of the twelve cuts differently in every view", () => {
    const metrics = body_metrics(1, 1);
    const cuts = CUSTOMER_HAIR_STYLES.flat();
    for (const facing of SHEET_FACINGS) {
      const rig = build_rig(facing, metrics, customer_pose("stand", metrics, BASE_SPEC));
      const digests = cuts.map((hairStyle) => {
        const recording = create_recording_context();
        const look = { skin: BASE_SPEC.skin, hair: DARK_HAIR, hairStyle, frame: BASE_SPEC.frame };
        paint_hair_behind(recording.ctx, rig, look);
        paint_hair(recording.ctx, rig, look);
        return recording.digest();
      });

      expect(new Set(digests).size, facing).toBe(cuts.length);
    }
  });
});

describe("customer rig", () => {
  it("puts a seated guest's hips on the seat, on the frame's centre line", () => {
    for (const stature of CLASSES) {
      const metrics = body_metrics(stature, 1);
      for (const facing of SHEET_FACINGS) {
        const rig = build_rig(
          facing,
          metrics,
          customer_pose("sit", metrics, customer({ stature })),
        );

        expect(rig.hip.x, `${facing} s${stature}`).toBeCloseTo(PERSON_FRAME_WIDTH / 2, 5);
        expect(rig.hip.y, `${facing} s${stature}`).toBeCloseTo(PERSON_FEET_Y - SEAT_HEIGHT, 5);
      }
    }
  });

  it("runs a seated guest's thighs forward off the seat and the shins down to the floor", () => {
    for (const stature of CLASSES) {
      const metrics = body_metrics(stature, 1);
      const intent = customer_pose("sit", metrics, customer({ stature }));
      const side = build_rig("east", metrics, intent);
      const front = build_rig("south", metrics, intent);
      for (const leg of [side.legs.right, side.legs.left]) {
        // Profile: the knee well ahead of the hip at about seat height, the ankle on the floor
        // below the knee.
        expect(leg.joint.x - side.hip.x, `s${stature}`).toBeGreaterThan(metrics.thigh * 0.8);
        expect(Math.abs(leg.endBody.up - metrics.ankle), `s${stature}`).toBeLessThan(0.1);
        expect(Math.abs(leg.end.x - leg.joint.x), `s${stature}`).toBeLessThan(metrics.shin * 0.4);
      }
      for (const leg of [front.legs.right, front.legs.left]) {
        // From the front the lap shows between the hips and the knees (a tall guest's knees
        // rise a little above the seat), and the shins below.
        expect(leg.joint.y - front.hip.y, `s${stature}`).toBeGreaterThan(metrics.thigh * 0.4);
        expect(leg.end.y - leg.joint.y, `s${stature}`).toBeGreaterThan(metrics.shin * 0.6);
      }
    }
  });

  it("reaches a seated guest's hands forward to table height", () => {
    for (const stature of CLASSES) {
      const metrics = body_metrics(stature, 1);
      const rig = build_rig("east", metrics, customer_pose("sit", metrics, customer({ stature })));
      for (const arm of [rig.arms.right, rig.arms.left]) {
        expect(arm.endBody.up, `s${stature}`).toBeCloseTo(TABLE_TOP_LIFT + 0.6, 0);
        expect(arm.endBody.forward, `s${stature}`).toBeGreaterThan(8);
      }
    }
  });

  it("stands each stature 34, 39 or 44 px tall from the feet", () => {
    const heights = CLASSES.map((stature) => body_metrics(stature, 1).height);

    expect(heights).toEqual([34, 39, 44]);
  });

  it("gives every body adult proportions: about three and a half heads, legs two fifths", () => {
    for (const stature of CLASSES) {
      const metrics = body_metrics(stature, 1);

      expect(metrics.height / metrics.headHeight).toBeGreaterThan(3.2);
      expect(metrics.height / metrics.headHeight).toBeLessThan(4);
      expect(metrics.hipHeight / metrics.height).toBeGreaterThan(0.38);
    }
  });

  it("alternates the leading foot through the walk cycle", () => {
    const metrics = body_metrics(1, 1);
    const spec = customer({});
    const lead = (pose: "walk0" | "walk2") => {
      const rig = build_rig("east", metrics, customer_pose(pose, metrics, spec));
      return rig.legs.right.end.x - rig.legs.left.end.x;
    };

    expect(lead("walk0")).toBeGreaterThan(3);
    expect(lead("walk2")).toBeLessThan(-3);
  });

  it("lifts the passing foot and raises the body on the passing frame", () => {
    const metrics = body_metrics(1, 1);
    const spec = customer({});
    const contact = build_rig("south", metrics, customer_pose("walk0", metrics, spec));
    const passing = build_rig("south", metrics, customer_pose("walk1", metrics, spec));

    expect(passing.hip.y).toBeLessThan(contact.hip.y);
    expect(passing.legs.left.end.y).toBeLessThan(passing.legs.right.end.y - 1);
  });

  it("samples the walk at even gait phases: each leg swings in exactly one frame", () => {
    const metrics = body_metrics(1, 1);
    const spec = customer({});
    const lifted = (["walk0", "walk1", "walk2"] as const).map((pose) => {
      const intent = customer_pose(pose, metrics, spec);
      return { right: intent.legs.right.lift > 0, left: intent.legs.left.lift > 0 };
    });

    expect(lifted.filter((frame) => frame.right)).toHaveLength(1);
    expect(lifted.filter((frame) => frame.left)).toHaveLength(1);
    expect(lifted[0]).toEqual({ right: false, left: false });
  });

  it("swings each arm against its leg", () => {
    const metrics = body_metrics(1, 1);
    const spec = customer({});
    const hands = (pose: "walk0" | "walk2") => {
      const rig = build_rig("east", metrics, customer_pose(pose, metrics, spec));
      return rig.arms.right.endBody.forward - rig.arms.left.endBody.forward;
    };

    // Right foot forward at walk0, so the right hand is back; the reverse at walk2.
    expect(hands("walk0")).toBeLessThan(-1.5);
    expect(hands("walk2")).toBeGreaterThan(1.5);
  });

  it("keeps every posed joint inside the frame", () => {
    for (const stature of CLASSES) {
      for (const build of CLASSES) {
        const metrics = body_metrics(stature, build);
        for (const facing of SHEET_FACINGS) {
          for (const pose of CUSTOMER_POSES) {
            const rig = build_rig(
              facing,
              metrics,
              customer_pose(pose, metrics, customer({}), facing),
            );
            const points = [
              rig.head,
              rig.shoulder,
              rig.hip,
              ...Object.values(rig.legs).flatMap((leg) => [leg.root, leg.joint, leg.end]),
              ...Object.values(rig.arms).flatMap((arm) => [arm.root, arm.joint, arm.end]),
            ];
            for (const point of points) {
              expect(point.x, `${facing}/${pose}`).toBeGreaterThan(0);
              expect(point.x, `${facing}/${pose}`).toBeLessThan(PERSON_FRAME_WIDTH);
              expect(point.y, `${facing}/${pose}`).toBeGreaterThan(0);
              expect(point.y, `${facing}/${pose}`).toBeLessThan(PERSON_FRAME_HEIGHT);
            }
          }
        }
      }
    }
  });
});

describe("tray anchor", () => {
  it("mirrors east for west", () => {
    const east = tray_anchor("east");
    const west = tray_anchor("west");

    expect(west.x).toBe(-east.x);
    expect(west.y).toBe(east.y);
    expect(west.isBehind).toBe(east.isBehind);
  });

  it("holds the tray in front of the body, and behind it seen from the north", () => {
    expect(tray_anchor("south").isBehind).toBe(false);
    expect(tray_anchor("north").isBehind).toBe(true);
    expect(tray_anchor("east").x).toBeGreaterThan(0);
  });

  it("anchors every facing inside the person frame", () => {
    for (const facing of FACINGS) {
      const anchor = tray_anchor(facing);

      expect(PERSON_FRAME_WIDTH / 2 + anchor.x, facing).toBeGreaterThan(0);
      expect(PERSON_FRAME_WIDTH / 2 + anchor.x, facing).toBeLessThan(PERSON_FRAME_WIDTH);
      expect(PERSON_FEET_Y + anchor.y, facing).toBeGreaterThan(0);
      expect(PERSON_FEET_Y + anchor.y, facing).toBeLessThan(PERSON_FEET_Y);
    }
  });

  it("carries the tray at the waist, below every guest's shoulders", () => {
    for (const stature of CLASSES) {
      const metrics = body_metrics(stature, 1);
      const shoulderY = PERSON_FEET_Y - metrics.hipHeight - metrics.torso;

      expect(PERSON_FEET_Y + tray_anchor("south").y, `s${stature}`).toBeGreaterThan(shoulderY);
    }
  });

  it("puts both hands on the tray's side rims from the front, for every body", () => {
    const anchor = tray_anchor("south");
    for (const stature of CLASSES) {
      for (const build of CLASSES) {
        const metrics = body_metrics(stature, build);
        const rig = build_rig(
          "south",
          metrics,
          customer_pose("carry", metrics, customer({ stature, build }), "south"),
        );
        for (const arm of [rig.arms.right, rig.arms.left]) {
          expect(Math.abs(arm.end.x - FRAME_CENTRE_X), `s${stature}b${build}`).toBeCloseTo(8.4, 0);
          expect(
            Math.abs(arm.end.y - (PERSON_FEET_Y + anchor.y)),
            `s${stature}b${build}`,
          ).toBeLessThan(2);
        }
      }
    }
  });

  it("puts the near hand under the tray's front rim in profile", () => {
    const anchor = tray_anchor("east");
    const metrics = body_metrics(1, 1);
    const rig = build_rig("east", metrics, customer_pose("carry", metrics, customer({}), "east"));
    const hand = rig.arms.right.end;

    expect(hand.x).toBeGreaterThan(FRAME_CENTRE_X + anchor.x - 9);
    expect(hand.x).toBeLessThan(FRAME_CENTRE_X + anchor.x);
    expect(hand.y).toBeGreaterThan(PERSON_FEET_Y + anchor.y + 2);
  });
});

describe("vendor sheets", () => {
  it("paints every launch stall's vendor in every paint frame", SWEEP_TIMEOUT, () => {
    for (const stall of STALLS) {
      for (const frame of FRAMES) {
        const { log } = record_paint(vendor(stall, frame));

        expect(log.length, stall.id).toBeGreaterThan(1000);
      }
    }
  });

  it("names and places every frame per the person-frame contract", () => {
    const plan = plan_vendor_sheet(vendor(STALLS[0] as (typeof STALLS)[number]));

    expect(plan.width).toBe(VENDOR_POSES.length * PERSON_FRAME_WIDTH);
    expect(plan.height).toBe(SHEET_FACINGS.length * PERSON_FRAME_HEIGHT);
    expect(plan.frames?.map((frame) => frame.name)).toEqual(
      SHEET_FACINGS.flatMap((facing) => VENDOR_POSES.map((pose) => `${facing}/${pose}`)),
    );
    for (const frame of plan.frames ?? []) {
      expect(frame.width).toBe(PERSON_FRAME_WIDTH);
      expect(frame.height).toBe(PERSON_FRAME_HEIGHT);
    }
  });

  it("paints each stall's vendor differently from the others", SWEEP_TIMEOUT, () => {
    for (const frame of FRAMES) {
      const digests = STALLS.map((stall) => record_paint(vendor(stall, frame)).digest());

      expect(new Set(digests).size).toBe(STALLS.length);
    }
  });

  it("paints the same vendor identically twice", SWEEP_TIMEOUT, () => {
    for (const stall of STALLS) {
      expect(record_paint(vendor(stall)).digest(), stall.id).toBe(
        record_paint(vendor(stall)).digest(),
      );
    }
  });

  it("draws every vendor at the guests' average height", () => {
    for (const stall of STALLS) {
      expect(vendor_metrics(visualRecipeForStallVendor(stall)).height, stall.id).toBe(39);
    }
  });

  it("works with both hands above the counter in every pose", () => {
    for (const stall of STALLS) {
      const recipe = visualRecipeForStallVendor(stall);
      const metrics = vendor_metrics(recipe);
      for (const pose of VENDOR_POSES) {
        const intent = vendor_frame(pose, metrics, recipe.workAction).intent;
        const rig = build_rig("south", metrics, intent);
        for (const arm of [rig.arms.right, rig.arms.left]) {
          // Seen from the front, a hand forward of the body shows lower by the depth squash.
          const shown = arm.endBody.up - arm.endBody.forward * DEPTH_SQUASH;

          expect(shown, `${stall.id} ${pose} ${arm.side}`).toBeGreaterThan(COUNTER_COVER - 1);
        }
      }
    }
  });

  it("moves the working hand through all four prepare frames", () => {
    for (const stall of STALLS) {
      const recipe = visualRecipeForStallVendor(stall);
      const metrics = vendor_metrics(recipe);
      const hands = (["prepare0", "prepare1", "prepare2", "prepare3"] as const).map((pose) => {
        const end = build_rig(
          "east",
          metrics,
          vendor_frame(pose, metrics, recipe.workAction).intent,
        ).arms.right.end;
        return `${end.x.toFixed(2)},${end.y.toFixed(2)}`;
      });

      expect(new Set(hands).size, stall.id).toBe(4);
    }
  });
});
