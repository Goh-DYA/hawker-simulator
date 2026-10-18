/**
 * Draw-output tests for the stall painters in `runtime/art/stalls.ts` and `runtime/art/stalls/`.
 *
 * Every launch stall is painted into a recording context at every rotation, layer and open
 * state, and in the high-contrast and low-detail frames; the digests prove the stalls paint
 * distinct, deterministic art. The live layout is checked to stay inside the texture, to face
 * the vendor across the serving edge opposite the rotated service tile, to keep the vendor's
 * legs behind the front layer, and to keep the counter dishes on the counter top, clear of the
 * roof's valance and of the vendor's torso, within reach of the vendor.
 */
import { describe, expect, it } from "vitest";

import { STALLS, localize_key } from "@/src/content";
import { rotatePoint, type Rotation } from "@/src/game/core";
import {
  DEFAULT_PAINT_FRAME,
  DISH_SIZE,
  OVERHANG,
  rotated_size,
  type Facing,
  type PaintFrame,
  type StallLayer,
  type StallPaintSpec,
} from "@/src/game/runtime/art/specs";
import { stall_layout } from "@/src/game/runtime/art/stalls";
import { slab_face, slab_top } from "@/src/game/runtime/art/stalls/common";
import { stall_geometry } from "@/src/game/runtime/art/stalls/geometry";
import { resolve_dressing } from "@/src/game/runtime/art/stalls/identity";
import { resolve_stall_art } from "@/src/game/runtime/render/art";
import { colour } from "@/src/game/runtime/visuals/palette";
import { TILE_SIZE } from "@/src/game/runtime/world";

import { record_paint } from "./fixtures";

/** The four placement rotations. */
const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

/** The three stall layers. */
const LAYERS: readonly StallLayer[] = ["back", "front", "full"];

/** The way the vendor faces at each rotation: across the serving edge. */
const FACING_BY_ROTATION: Readonly<Record<Rotation, Facing>> = {
  0: "south",
  90: "west",
  180: "north",
  270: "east",
};

/** How far above the vendor's feet the front layer must reach to hide the legs. */
const LEG_COVER = 16;

/** Clear space a plate keeps from the vendor's centre beyond its own half width. */
const TORSO_CLEARANCE = 6;

/** How far from the vendor, along the counter, the two nearest dishes may sit: half a tile. */
const NEAR_DISH_REACH = TILE_SIZE / 2 + 2;

/** How far from the vendor, along the counter, any dish may sit. */
const FAR_DISH_REACH = TILE_SIZE + 2;

/** Where a side counter's dishes cluster: at the vendor's hands, above the feet. */
const SIDE_DISH_LIFT = 20;

/** The most open floor a deep stall may leave between its bench and its back shelf at 180. */
const MAX_OPEN_STRIP = 26;

/**
 * Builds the paint spec of a launch stall.
 *
 * @param stall - The stall definition.
 * @param rotation - The placement rotation.
 * @param layer - The layer to paint.
 * @param is_open - Whether the stall is open.
 * @param frame - The paint frame.
 * @returns The spec.
 */
function stall_spec(
  stall: (typeof STALLS)[number],
  rotation: Rotation,
  layer: StallLayer,
  is_open: boolean,
  frame: PaintFrame = DEFAULT_PAINT_FRAME,
): StallPaintSpec {
  const size = rotated_size(
    stall.footprint.width * TILE_SIZE,
    stall.footprint.height * TILE_SIZE,
    rotation,
  );
  return {
    kind: "stall",
    definitionId: stall.id,
    name: localize_key(stall.nameKey),
    primary: colour(stall.visual.palette[0] ?? "#6b877c", 0x6b877c),
    secondary: colour(stall.visual.palette[1] ?? "#f3e0b4", 0xf3e0b4),
    accent: colour(stall.visual.palette[2] ?? "#d56d50", 0xd56d50),
    signShape: stall.visual.signShape,
    art: resolve_stall_art(stall.id),
    rotation,
    layer,
    width: size.width,
    height: size.height,
    isOpen: is_open,
    frame,
  };
}

/**
 * Checks that a point lies inside a stall texture.
 *
 * @param spec - The stall spec.
 * @param point - The point in texture pixels.
 * @param what - What the point is, for the failure message.
 */
function expect_inside(spec: StallPaintSpec, point: { x: number; y: number }, what: string): void {
  const where = `${spec.definitionId} r${spec.rotation} ${what}`;
  expect(point.x, where).toBeGreaterThanOrEqual(0);
  expect(point.x, where).toBeLessThanOrEqual(spec.width);
  expect(point.y, where).toBeGreaterThanOrEqual(0);
  expect(point.y, where).toBeLessThanOrEqual(spec.height + OVERHANG);
}

/**
 * Gives the centre of a stall's service tile along its counter in texture pixels, from core's own
 * `rotatePoint`: the x at 0 and 180, the y at 90 and 270.
 *
 * @param stall - The stall definition.
 * @param rotation - The placement rotation.
 * @returns The texture coordinate of the service tile's centre.
 */
function service_centre(stall: (typeof STALLS)[number], rotation: Rotation): number {
  const tile = rotatePoint(stall.servicePoint, stall.footprint, rotation);
  return rotation === 0 || rotation === 180
    ? (tile.x + 0.5) * TILE_SIZE
    : OVERHANG + (tile.y + 0.5) * TILE_SIZE;
}

describe("stall painters", () => {
  it("paint every stall at every rotation, layer and open state", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        for (const layer of LAYERS) {
          for (const is_open of [true, false]) {
            const spec = stall_spec(stall, rotation, layer, is_open);
            const painted = record_paint(spec);

            expect(painted.width).toBe(spec.width);
            expect(painted.height).toBe(spec.height + OVERHANG);
            expect(painted.log.length, `${stall.id} r${rotation} ${layer}`).toBeGreaterThan(50);
          }
        }
      }
    }
  });

  it("paint every stall in the high-contrast and low-detail frames", () => {
    const frames: readonly PaintFrame[] = [
      { isHighContrast: true, isLowDetail: false },
      { isHighContrast: false, isLowDetail: true },
    ];
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const plain = record_paint(stall_spec(stall, rotation, "full", true)).digest();
        for (const frame of frames) {
          const painted = record_paint(stall_spec(stall, rotation, "full", true, frame)).digest();

          expect(painted, `${stall.id} r${rotation}`).not.toBe(plain);
        }
      }
    }
  });

  it("paint each stall differently from every other stall at every rotation", () => {
    for (const rotation of ROTATIONS) {
      const digests = STALLS.map((stall) =>
        record_paint(stall_spec(stall, rotation, "full", true)).digest(),
      );

      expect(new Set(digests).size, `r${rotation}`).toBe(STALLS.length);
    }
  });

  it("paint the same spec to the same digest", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const spec = stall_spec(stall, rotation, "full", rotation % 180 === 0);

        expect(record_paint(spec).digest()).toBe(record_paint(spec).digest());
      }
    }
  });

  it("paint the shutter on the front layer only when closed", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const open_front = record_paint(stall_spec(stall, rotation, "front", true));
        const closed_front = record_paint(stall_spec(stall, rotation, "front", false));

        expect(closed_front.digest(), `${stall.id} r${rotation}`).not.toBe(open_front.digest());
      }
    }
  });

  it("lay out some stalls mirrored, so the kitchens do not share one template", () => {
    const mirrored = STALLS.filter(
      (stall) => resolve_dressing(stall_spec(stall, 0, "back", true)).isMirrored,
    );

    expect(mirrored.length).toBeGreaterThanOrEqual(4);
    expect(mirrored.length).toBeLessThanOrEqual(STALLS.length - 4);
  });
});

describe("stall_layout", () => {
  it("keeps every anchor inside the texture at every rotation", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const spec = stall_spec(stall, rotation, "back", true);
        const layout = stall_layout(spec);

        expect_inside(spec, layout.vendor, "vendor");
        expect_inside(spec, layout.steamSource, "steam");
        expect_inside(spec, layout.badge, "badge");
        expect(layout.dishSlots.length).toBeGreaterThanOrEqual(2);
        for (const slot of layout.dishSlots) expect_inside(spec, slot, "dish slot");
        if (layout.signGlow) expect_inside(spec, layout.signGlow, "sign glow");
        expect(layout.signGlow !== undefined).toBe(stall.visual.signShape === "lightbox");
      }
    }
  });

  it("faces the vendor across the serving edge", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const layout = stall_layout(stall_spec(stall, rotation, "back", true));

        expect(layout.vendor.facing, `${stall.id} r${rotation}`).toBe(FACING_BY_ROTATION[rotation]);
      }
    }
  });

  it("stands the vendor opposite the rotated service tile", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const layout = stall_layout(stall_spec(stall, rotation, "back", true));
        const along = rotation === 0 || rotation === 180 ? layout.vendor.x : layout.vendor.y;

        expect(
          Math.abs(along - service_centre(stall, rotation)),
          `${stall.id} r${rotation}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("draws the vendor at the guests' scale", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const layout = stall_layout(stall_spec(stall, rotation, "back", true));

        expect(layout.vendor.scale, `${stall.id} r${rotation}`).toBeGreaterThanOrEqual(0.95);
      }
    }
  });

  it("stands the vendor just behind a front-layer slab that hides the legs", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const geo = stall_geometry(stall_spec(stall, rotation, "back", true));
        const front = geo.legCover;
        const expected =
          rotation === 0 ? geo.counter : rotation === 180 ? geo.bench : geo.counterReturn;
        const where = `${stall.id} r${rotation}`;

        expect(front, where).toBe(expected);
        const top = slab_top(front);
        // Feet just north of the slab's footprint, legs covered by its lifted top.
        expect(geo.vendor.y, where).toBeLessThan(front.y);
        expect(front.y - geo.vendor.y, where).toBeLessThanOrEqual(2);
        expect(top.y, where).toBeLessThanOrEqual(geo.vendor.y - LEG_COVER);
        expect(geo.vendor.x - 8, where).toBeGreaterThan(top.x);
        expect(geo.vendor.x + 8, where).toBeLessThan(top.x + top.width);
      }
    }
  });

  it("lays every dish fully on the counter top, below the roof's valance", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const geo = stall_geometry(stall_spec(stall, rotation, "back", true));
        const top = slab_top(geo.counter);
        const half = (DISH_SIZE * geo.dishScale) / 2;
        const where = `${stall.id} r${rotation}`;

        // A plate needs a counter top at least as deep as itself.
        expect(Math.min(top.width, top.height), where).toBeGreaterThanOrEqual(half * 2);
        for (const slot of geo.dishSlots) {
          expect(slot.x - half, where).toBeGreaterThanOrEqual(top.x);
          expect(slot.x + half, where).toBeLessThanOrEqual(top.x + top.width);
          expect(slot.y - half, where).toBeGreaterThanOrEqual(top.y - 1);
          expect(slot.y + half, where).toBeLessThanOrEqual(top.y + top.height + 1);
          expect(slot.y - half, where).toBeGreaterThanOrEqual(geo.header.height);
        }
      }
    }
  });

  it("keeps the vendor's torso clear of plates", () => {
    for (const stall of STALLS) {
      for (const rotation of [0, 180] as const) {
        const geo = stall_geometry(stall_spec(stall, rotation, "back", true));
        const clearance = (DISH_SIZE * geo.dishScale) / 2 + TORSO_CLEARANCE;
        for (const slot of geo.dishSlots) {
          expect(
            Math.abs(slot.x - geo.vendor.x),
            `${stall.id} r${rotation}`,
          ).toBeGreaterThanOrEqual(clearance);
        }
      }
    }
  });

  it("clusters the dishes within reach of the vendor", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const geo = stall_geometry(stall_spec(stall, rotation, "back", true));
        const is_across = rotation === 0 || rotation === 180;
        const distances = geo.dishSlots
          .map((slot) =>
            Math.abs(is_across ? slot.x - geo.vendor.x : slot.y - (geo.vendor.y - SIDE_DISH_LIFT)),
          )
          .sort((a, b) => a - b);
        const where = `${stall.id} r${rotation}`;

        expect(distances[1], where).toBeLessThanOrEqual(NEAR_DISH_REACH);
        expect(distances[distances.length - 1], where).toBeLessThanOrEqual(FAR_DISH_REACH);
      }
    }
  });

  it("keeps the work station right behind the vendor at 180, with no empty strip of floor", () => {
    for (const stall of STALLS) {
      const spec = stall_spec(stall, 180, "back", true);
      const geo = stall_geometry(spec);
      const bench_back = geo.bench.y + geo.bench.depth;
      const next_wall = geo.backWall ? slab_top(geo.backWall).y : spec.height + OVERHANG;
      const main = geo.stations[0];
      const is_beside = main.x + main.width <= geo.vendor.x - 10 || main.x >= geo.vendor.x + 10;

      expect(geo.isBenchInFront, stall.id).toBe(true);
      expect(next_wall - bench_back, stall.id).toBeLessThanOrEqual(MAX_OPEN_STRIP);
      // The station stands beside the vendor on that bench, not in front of their torso.
      expect(is_beside, stall.id).toBe(true);
    }
  });

  it("never sets a sink tap over the vendor's torso", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const geo = stall_geometry(stall_spec(stall, rotation, "back", true));
        const overlaps =
          geo.sink.x < geo.vendor.x + 10 && geo.sink.x + geo.sink.width > geo.vendor.x - 10;
        if (!overlaps || !geo.isBenchInFront) continue;
        // A tap on a bench in front of the vendor stays on that bench's top, below the waist.
        expect(geo.sink.y - 6, `${stall.id} r${rotation}`).toBeGreaterThanOrEqual(
          slab_top(geo.legCover).y,
        );
      }
    }
  });

  it("hangs the hood over the station at every rotation", () => {
    for (const stall of STALLS) {
      for (const rotation of ROTATIONS) {
        const spec = stall_spec(stall, rotation, "back", true);
        const geo = stall_geometry(spec);
        const where = `${stall.id} r${rotation}`;

        expect(geo.hood !== undefined, where).toBe(resolve_dressing(spec).hasHood);
        if (!geo.hood) continue;
        const main = geo.stations[0];
        const centre = main.x + main.width / 2;
        expect(centre, where).toBeGreaterThan(geo.hood.x);
        expect(centre, where).toBeLessThan(geo.hood.x + geo.hood.width);
      }
    }
  });

  it("brings a closed stall's shutter down over the bench at 180", () => {
    for (const stall of STALLS) {
      const geo = stall_geometry(stall_spec(stall, 180, "back", false));
      const face = slab_face(geo.bench);

      expect(geo.shutter.y + geo.shutter.height, stall.id).toBeGreaterThanOrEqual(
        face.y + face.height,
      );
    }
  });
});
