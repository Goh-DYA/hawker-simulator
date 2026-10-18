/**
 * Draw-output tests for the table and seat painters in `runtime/art/furniture/tables.ts` and
 * `seats.ts`, and the oblique-view kit they share (`seatingKit.ts`): every launch table and seat
 * paints at every frame and rotation, each paints differently from the rest of its category, the
 * output is deterministic, directional seats turn with the rotation, the kit's rotation maps keep
 * points inside the footprint, and the stacking stool stays small inside its tile. The table
 * tops the painters draw match the `table_top` contract the world view places meals by, the round
 * café top is a foreshortened ellipse whose pedestal stays under it, and `has_backrest` names the
 * seats whose backrest hides a sitter at 180 degrees.
 */
import { describe, expect, it } from "vitest";

import { PLACEABLES } from "@/src/content/index";
import type { Rotation } from "@/src/game/core";
import { has_backrest, paint_seat } from "@/src/game/runtime/art/furniture/seats";
import {
  fit_rotation,
  ground_rect,
  orient,
  rotated_side,
  to_ground,
} from "@/src/game/runtime/art/furniture/seatingKit";
import { footprint_box, type Box } from "@/src/game/runtime/art/furniture/shared";
import { paint_table, table_top } from "@/src/game/runtime/art/furniture/tables";
import {
  DEFAULT_PAINT_FRAME,
  OVERHANG,
  TABLE_TOP_LIFT,
  rotated_size,
  type PaintFrame,
  type PlaceablePaintSpec,
} from "@/src/game/runtime/art/specs";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";

import { create_recording_context, record_paint } from "./fixtures";

/** World pixels per tile. */
const TILE = 48;
/** The four placement rotations. */
const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
/** The default, high-contrast and low-detail frames. */
const FRAMES: readonly PaintFrame[] = [
  DEFAULT_PAINT_FRAME,
  { isHighContrast: true, isLowDetail: false },
  { isHighContrast: false, isLowDetail: true },
];

type SeatingCategory = "table" | "seat";

/**
 * Lists the launch placeables of a category.
 *
 * @param category - The category.
 * @returns The content definitions.
 */
function launch_items(category: SeatingCategory) {
  return PLACEABLES.filter((item) => item.category === category);
}

/**
 * Builds the paint spec of a launch placeable at a rotation and frame.
 *
 * @param id - The content ID.
 * @param rotation - The placement rotation.
 * @param frame - The paint frame.
 * @returns The spec, sized to the rotated footprint.
 */
function spec_for(id: string, rotation: Rotation, frame: PaintFrame): PlaceablePaintSpec {
  const item = PLACEABLES.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown placeable ${id}`);
  const size = rotated_size(item.footprint.width * TILE, item.footprint.height * TILE, rotation);
  return {
    kind: "placeable",
    definitionId: id,
    category: item.category,
    recipe: visualRecipeForPlaceable(id, item.category, item.tags),
    tags: item.tags,
    rotation,
    width: size.width,
    height: size.height,
    motion: 0,
    frame,
  };
}

/**
 * Paints a spec through the table or seat painter directly, passing the rotation.
 *
 * @param spec - The spec.
 * @returns The recording.
 */
function paint_direct(spec: PlaceablePaintSpec) {
  const recording = create_recording_context();
  const painter = spec.category === "table" ? paint_table : paint_seat;
  painter(recording.ctx, footprint_box(spec), spec.recipe, spec.frame, spec.rotation);
  return recording;
}

/**
 * Collects the points a recording traced outside any clip (path vertices, control points,
 * rectangle corners and the extremes of ellipses and arcs), following `translate` through `save`
 * and `restore`. Points traced while a clip is active are skipped, since the clip (whose own
 * path is collected) bounds what they paint.
 *
 * @param log - The recorded calls.
 * @returns The traced points in texture pixels.
 */
function traced_points(log: readonly string[]): Array<readonly [number, number]> {
  interface TraceState {
    readonly offset: readonly [number, number];
    readonly isClipped: boolean;
  }
  const points: Array<readonly [number, number]> = [];
  const stack: TraceState[] = [];
  let state: TraceState = { offset: [0, 0], isClipped: false };
  const add = (x: number, y: number) => {
    if (!state.isClipped) points.push([x + state.offset[0], y + state.offset[1]]);
  };
  for (const entry of log) {
    const [method, ...args] = JSON.parse(entry) as [string, ...number[]];
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = args;
    switch (method) {
      case "save":
        stack.push(state);
        break;
      case "restore":
        state = stack.pop() ?? { offset: [0, 0], isClipped: false };
        break;
      case "clip":
        state = { ...state, isClipped: true };
        break;
      case "translate":
        state = { ...state, offset: [state.offset[0] + a, state.offset[1] + b] };
        break;
      case "moveTo":
      case "lineTo":
        add(a, b);
        break;
      case "quadraticCurveTo":
        add(a, b);
        add(c, d);
        break;
      case "bezierCurveTo":
        add(a, b);
        add(c, d);
        add(e, f);
        break;
      case "rect":
      case "fillRect":
        add(a, b);
        add(a + c, b + d);
        break;
      case "ellipse":
        add(a - c, b - d);
        add(a + c, b + d);
        break;
      case "arc":
        add(a - c, b - c);
        add(a + c, b + c);
        break;
      default:
        break;
    }
  }
  return points;
}

/**
 * Builds a footprint box of a size, with its top at the overhang.
 *
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 * @returns The box.
 */
function box_of(width: number, height: number): Box {
  return {
    x: 0,
    y: OVERHANG,
    width,
    height,
    centreX: width / 2,
    centreY: OVERHANG + height / 2,
    right: width,
    bottom: OVERHANG + height,
  };
}

describe.each(["table", "seat"] as const)("the %s painter", (category) => {
  const items = launch_items(category);

  it("covers the launch roster", () => {
    expect(items).toHaveLength(category === "table" ? 8 : 10);
  });

  it("paints every item at every frame and rotation, directly and through the dispatcher", () => {
    for (const item of items) {
      for (const rotation of ROTATIONS) {
        for (const frame of FRAMES) {
          const spec = spec_for(item.id, rotation, frame);

          expect(paint_direct(spec).log.length, `${item.id} r${rotation}`).toBeGreaterThan(20);
          expect(record_paint(spec).log.length, `${item.id} r${rotation}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it("paints every item differently from the rest of its category", () => {
    for (const rotation of ROTATIONS) {
      const digests = items.map((item) =>
        paint_direct(spec_for(item.id, rotation, DEFAULT_PAINT_FRAME)).digest(),
      );

      expect(new Set(digests).size, `r${rotation}`).toBe(items.length);
    }
  });

  it("paints the same spec the same way twice", () => {
    for (const item of items) {
      const spec = spec_for(item.id, 90, DEFAULT_PAINT_FRAME);

      expect(paint_direct(spec).digest()).toBe(paint_direct(spec).digest());
      expect(record_paint(spec).digest()).toBe(record_paint(spec).digest());
    }
  });

  it("paints the high-contrast frame differently from the default", () => {
    for (const item of items) {
      const plain = paint_direct(spec_for(item.id, 0, DEFAULT_PAINT_FRAME)).digest();

      expect(paint_direct(spec_for(item.id, 0, FRAMES[1] as PaintFrame)).digest()).not.toBe(plain);
    }
  });

  it("paints the low-detail frame differently for every item with material detail", () => {
    // Every table has grain, chips, veins or figure; of the seats, the timber, fluted and
    // stitched ones do.
    const detailed = items.filter(
      (item) =>
        category === "table" ||
        [
          "item.booster-family-chair",
          "item.three-person-communal-bench",
          "item.acoustic-booth-seat",
          "item.high-counter-stool",
        ].includes(item.id),
    );
    expect(detailed.length).toBeGreaterThanOrEqual(4);
    for (const item of detailed) {
      const plain = paint_direct(spec_for(item.id, 0, DEFAULT_PAINT_FRAME)).digest();

      expect(
        paint_direct(spec_for(item.id, 0, FRAMES[2] as PaintFrame)).digest(),
        item.id,
      ).not.toBe(plain);
    }
  });

  it("keeps every traced point inside the texture", () => {
    for (const item of items) {
      for (const rotation of ROTATIONS) {
        const spec = spec_for(item.id, rotation, DEFAULT_PAINT_FRAME);
        const points = traced_points(paint_direct(spec).log);

        for (const [x, y] of points) {
          expect(x, `${item.id} r${rotation}`).toBeGreaterThanOrEqual(-0.5);
          expect(x, `${item.id} r${rotation}`).toBeLessThanOrEqual(spec.width + 0.5);
          expect(y, `${item.id} r${rotation}`).toBeGreaterThanOrEqual(-0.5);
          expect(y, `${item.id} r${rotation}`).toBeLessThanOrEqual(spec.height + OVERHANG + 0.5);
        }
      }
    }
  });
});

describe("seat rotation", () => {
  it("turns every chair, bench and booth with the rotation", () => {
    const directional = launch_items("seat").filter(
      (item) => !item.id.includes("stacking-stool") && !item.id.includes("high-counter-stool"),
    );
    for (const item of directional) {
      const digests = ROTATIONS.map((rotation) =>
        paint_direct(spec_for(item.id, rotation, DEFAULT_PAINT_FRAME)).digest(),
      );

      expect(new Set(digests).size, item.id).toBe(4);
    }
  });

  it("paints the round stools the same at every rotation", () => {
    for (const id of ["item.stacking-stool", "item.high-counter-stool"]) {
      const digests = ROTATIONS.map((rotation) =>
        paint_direct(spec_for(id, rotation, DEFAULT_PAINT_FRAME)).digest(),
      );

      expect(new Set(digests).size, id).toBe(1);
    }
  });

  it("turns the accessible table's approach end with the rotation", () => {
    const digests = ROTATIONS.map((rotation) =>
      paint_direct(spec_for("item.accessible-end-table", rotation, DEFAULT_PAINT_FRAME)).digest(),
    );

    expect(new Set(digests).size).toBe(4);
  });

  it("keeps the stacking stool inside the central 30 by 40 pixels of its tile", () => {
    for (const frame of FRAMES) {
      const spec = spec_for("item.stacking-stool", 0, frame);
      const points = traced_points(paint_direct(spec).log);
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      const centreY = OVERHANG + TILE / 2;

      expect(Math.min(...xs)).toBeGreaterThanOrEqual(TILE / 2 - 15);
      expect(Math.max(...xs)).toBeLessThanOrEqual(TILE / 2 + 15);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(centreY - 20);
      expect(Math.max(...ys)).toBeLessThanOrEqual(centreY + 20);
    }
  });
});

describe("the oblique-view kit", () => {
  it("maps authored points into the rotated footprint at every rotation", () => {
    for (const [width, height] of [
      [48, 48],
      [96, 48],
      [144, 96],
    ] as const) {
      for (const rotation of ROTATIONS) {
        const size = rotated_size(width, height, rotation);
        const orientation = orient(box_of(size.width, size.height), rotation);

        expect([orientation.width, orientation.height]).toEqual([width, height]);
        for (const [u, v] of [
          [0, 0],
          [width, 0],
          [0, height],
          [width, height],
          [width / 3, height / 4],
        ] as const) {
          const point = to_ground(orientation, u, v);

          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(size.width);
          expect(point.y).toBeGreaterThanOrEqual(OVERHANG);
          expect(point.y).toBeLessThanOrEqual(OVERHANG + size.height);
        }
      }
    }
  });

  it("fits a missing rotation to a long footprint and keeps one that already fits", () => {
    expect(fit_rotation(box_of(48, 96), 0)).toBe(90);
    expect(fit_rotation(box_of(48, 96), 180)).toBe(270);
    expect(fit_rotation(box_of(48, 96), 90)).toBe(90);
    expect(fit_rotation(box_of(96, 48), 0)).toBe(0);
    expect(fit_rotation(box_of(96, 48), 270)).toBe(0);
    expect(fit_rotation(box_of(48, 48), 270)).toBe(270);
  });

  it("paints a rotated bench the same through the dispatcher as with its rotation", () => {
    const spec = spec_for("item.three-person-communal-bench", 90, DEFAULT_PAINT_FRAME);
    const recording = create_recording_context();
    paint_seat(recording.ctx, footprint_box(spec), spec.recipe, spec.frame);

    expect(recording.digest()).toBe(paint_direct(spec).digest());
  });

  it("turns the authored north edge clockwise", () => {
    const orientation = orient(box_of(48, 96), 90);
    const north = ground_rect(orientation, 0, 0, 96, 4);

    expect(north).toEqual({ x0: 44, y0: OVERHANG, x1: 48, y1: OVERHANG + 96 });
    expect(ROTATIONS.map((rotation) => rotated_side(rotation, "north"))).toEqual([
      "north",
      "east",
      "south",
      "west",
    ]);
    expect(rotated_side(270, "east")).toBe("north");
  });
});

describe("the table top contract", () => {
  it("keeps every top inside its footprint at its table's height", () => {
    for (const item of launch_items("table")) {
      for (const rotation of ROTATIONS) {
        const spec = spec_for(item.id, rotation, DEFAULT_PAINT_FRAME);
        const box = footprint_box(spec);
        const top = table_top(box, spec.recipe);

        expect(top.centreX - top.halfWidth, item.id).toBeGreaterThanOrEqual(box.x);
        expect(top.centreX + top.halfWidth, item.id).toBeLessThanOrEqual(box.right);
        expect(top.centreY - top.halfDepth, item.id).toBeGreaterThanOrEqual(box.y);
        expect(top.centreY + top.halfDepth, item.id).toBeLessThanOrEqual(box.bottom);
        expect(top.lift, item.id).toBe(
          item.id === "item.standing-snack-ledge" ? TABLE_TOP_LIFT + 4 : TABLE_TOP_LIFT,
        );
      }
    }
  });

  it("paints every rectangular top where the contract puts it", () => {
    for (const item of launch_items("table")) {
      for (const rotation of ROTATIONS) {
        const spec = spec_for(item.id, rotation, DEFAULT_PAINT_FRAME);
        const top = table_top(footprint_box(spec), spec.recipe);
        if (top.shape !== "rect") continue;
        const corner = [top.centreX - top.halfWidth, top.centreY - top.halfDepth - top.lift];
        // A rounded top face starts its north-west corner curve at the face's corner.
        const hasCorner = paint_direct(spec).log.some((entry) => {
          const [method, x, y] = JSON.parse(entry) as [string, number, number];
          return method === "quadraticCurveTo" && x === corner[0] && y === corner[1];
        });

        expect(hasCorner, `${item.id} r${rotation}`).toBe(true);
      }
    }
  });

  it("paints the round café top as a foreshortened ellipse where the contract puts it", () => {
    const spec = spec_for("item.round-cafe-table", 0, DEFAULT_PAINT_FRAME);
    const top = table_top(footprint_box(spec), spec.recipe);
    const ellipses = paint_direct(spec)
      .log.map((entry) => JSON.parse(entry) as [string, ...number[]])
      .filter(([method]) => method === "ellipse");

    expect(top.shape).toBe("ellipse");
    expect(top.halfWidth).toBeGreaterThanOrEqual(38);
    expect(top.halfDepth / top.halfWidth).toBeGreaterThanOrEqual(0.6);
    expect(top.halfDepth / top.halfWidth).toBeLessThanOrEqual(0.7);
    expect(top.centreX).toBe(spec.width / 2);
    expect(
      ellipses.some(
        ([, x, y, rx, ry]) =>
          x === top.centreX &&
          y === top.centreY - top.lift &&
          rx === top.halfWidth &&
          ry === top.halfDepth,
      ),
    ).toBe(true);
  });

  it("keeps the round café table's pedestal tucked under its top", () => {
    for (const frame of FRAMES) {
      const spec = spec_for("item.round-cafe-table", 0, frame);
      const top = table_top(footprint_box(spec), spec.recipe);
      const nearEdge = top.centreY - top.lift + top.halfDepth;
      const lowest = Math.max(...traced_points(paint_direct(spec).log).map(([, y]) => y));

      // The stub and foot peek out just below the near edge; nothing hangs further south.
      expect(lowest).toBeLessThanOrEqual(nearEdge + 18);
    }
  });

  it("foreshortens the terrazzo feature top", () => {
    const spec = spec_for("item.terrazzo-feature-table", 0, DEFAULT_PAINT_FRAME);
    const top = table_top(footprint_box(spec), spec.recipe);

    expect(top.halfDepth / top.halfWidth).toBeCloseTo(0.65, 1);
  });
});

describe("has_backrest", () => {
  it("names the seats whose backrest hides their sitter when turned to 180 degrees", () => {
    const withBackrest = launch_items("seat")
      .filter((item) => has_backrest(spec_for(item.id, 0, DEFAULT_PAINT_FRAME).recipe))
      .map((item) => item.id)
      .sort();

    expect(withBackrest).toEqual([
      "item.acoustic-booth-seat",
      "item.booster-family-chair",
      "item.cushioned-dining-chair",
      "item.easy-rise-arm-chair",
      "item.moulded-back-chair",
      "item.two-person-bench",
    ]);
  });
});
