/**
 * Draw-output tests for the service-furniture painters in `runtime/art/furniture/` (stall
 * fixtures, tray and waste points, facilities) and their shared construction kit
 * `steelwork.ts`: every launch item paints at every frame and rotation, through the painters and
 * through the furniture dispatcher, each item paints differently from the others in its
 * category and from itself at another rotation, the output is deterministic, nothing is drawn
 * outside the texture, and the run layout keeps every anchor inside the footprint and overhang.
 */
import { describe, expect, it } from "vitest";

import { PLACEABLES } from "@/src/content";
import type { Rotation } from "@/src/game/core";
import { glow, label as bake_label, type PaintContext } from "@/src/game/runtime/art/canvas";
import {
  first_aid_layout,
  FIRST_AID_UNDERSIDE,
  paint_facility,
} from "@/src/game/runtime/art/furniture/facilities";
import { paint_fixture } from "@/src/game/runtime/art/furniture/fixtures";
import { footprint_box, type Box } from "@/src/game/runtime/art/furniture/shared";
import {
  ground_bottom,
  make_run,
  oriented_ground,
  service_side,
} from "@/src/game/runtime/art/furniture/steelwork";
import { paint_tray_waste, trolley_parts } from "@/src/game/runtime/art/furniture/trayWaste";
import {
  DEFAULT_PAINT_FRAME,
  OVERHANG,
  rotated_size,
  type PaintFrame,
  type PlaceablePaintSpec,
} from "@/src/game/runtime/art/specs";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";
import type { PlaceableVisualRecipe } from "@/src/game/runtime/visuals/placeable";

import { create_recording_context, record_paint } from "../fixtures";

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

/** A painter under test. */
type ServicePainter = (
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation?: Rotation,
) => void;

/** The three categories this suite covers, with their painters and launch counts. */
const CATEGORIES = [
  { category: "stall-fixture", painter: paint_fixture, count: 8 },
  { category: "tray-waste", painter: paint_tray_waste, count: 8 },
  { category: "facility", painter: paint_facility, count: 7 },
] as const satisfies readonly {
  category: PlaceablePaintSpec["category"];
  painter: ServicePainter;
  count: number;
}[];

/** One launch placeable definition. */
type Item = (typeof PLACEABLES)[number];

/**
 * Builds the placeable spec of a launch item.
 *
 * @param item - The content definition.
 * @param rotation - The placement rotation.
 * @param frame - The paint frame.
 * @returns The spec.
 */
function spec_for(
  item: Item,
  rotation: Rotation = 0,
  frame = DEFAULT_PAINT_FRAME,
): PlaceablePaintSpec {
  const size = rotated_size(item.footprint.width * TILE, item.footprint.height * TILE, rotation);
  return {
    kind: "placeable",
    definitionId: item.id,
    category: item.category,
    recipe: visualRecipeForPlaceable(item.id, item.category, item.tags),
    tags: item.tags,
    rotation,
    width: size.width,
    height: size.height,
    motion: 0,
    frame,
  };
}

/**
 * Paints a spec through a painter with its rotation into a fresh recording context.
 *
 * @param painter - The painter.
 * @param spec - The spec.
 * @returns The recorded log and its digest.
 */
function paint_direct(painter: ServicePainter, spec: PlaceablePaintSpec) {
  const recording = create_recording_context();
  painter(recording.ctx, footprint_box(spec), spec.recipe, spec.frame, spec.rotation);
  return { log: recording.log, digest: recording.digest() };
}

/** Sub-pixel slack for anti-aliasing at the texture edge. */
const EDGE_SLACK = 0.5;

/** An axis-aligned extent in texture pixels. */
interface Extent {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
}

/** The drawing state the extent tracker follows through `save` and `restore`. */
interface TrackedState {
  line_width: number;
  shadow_blur: number;
  shadow_x: number;
  shadow_y: number;
  font_size: number;
  align: string;
  clip: Extent | undefined;
  is_transformed: boolean;
}

/** An extent that contains nothing yet. */
const EMPTY_EXTENT: Extent = {
  min_x: Infinity,
  min_y: Infinity,
  max_x: -Infinity,
  max_y: -Infinity,
};

/**
 * Grows an extent to include a rectangle around a point.
 *
 * @param extent - The extent so far.
 * @param x - Centre x.
 * @param y - Centre y.
 * @param reach_x - Half width included around the point.
 * @param reach_y - Half height included around the point.
 * @returns The grown extent.
 */
function include(extent: Extent, x: number, y: number, reach_x = 0, reach_y = 0): Extent {
  return {
    min_x: Math.min(extent.min_x, x - reach_x),
    min_y: Math.min(extent.min_y, y - reach_y),
    max_x: Math.max(extent.max_x, x + reach_x),
    max_y: Math.max(extent.max_y, y + reach_y),
  };
}

/**
 * Finds every painted fill, stroke and text whose extent leaves the texture. Unlike a point check
 * it measures what is actually painted: arcs and ellipses by their radii (so radial glows count),
 * curves by their control points, strokes by half their line width, text by its fitted width and
 * font size, and drop shadows by their offset. A soft shadow's blur is not counted: only its faint
 * outer tail can reach past its fill, and a rasterised check finds no visible pixel of it outside
 * the texture. Fills under a clip are cut to the clip's extent; calls under a transform are
 * skipped, because their coordinates are not texture pixels.
 *
 * @param log - The recorded calls.
 * @param width - Texture width.
 * @param height - Texture height.
 * @returns The offending calls with their extents.
 */
function paint_outside(log: readonly string[], width: number, height: number): string[] {
  const outside: string[] = [];
  const stack: TrackedState[] = [];
  let state: TrackedState = {
    line_width: 1,
    shadow_blur: 0,
    shadow_x: 0,
    shadow_y: 0,
    font_size: 10,
    align: "start",
    clip: undefined,
    is_transformed: false,
  };
  let path = EMPTY_EXTENT;
  const check = (entry: string, extent: Extent, stroke: number) => {
    if (state.is_transformed || !Number.isFinite(extent.min_x)) return;
    const has_shadow = state.shadow_blur > 0;
    const shadow_x = has_shadow ? state.shadow_x : 0;
    const shadow_y = has_shadow ? state.shadow_y : 0;
    let painted: Extent = {
      min_x: extent.min_x - stroke + Math.min(0, shadow_x),
      min_y: extent.min_y - stroke + Math.min(0, shadow_y),
      max_x: extent.max_x + stroke + Math.max(0, shadow_x),
      max_y: extent.max_y + stroke + Math.max(0, shadow_y),
    };
    if (state.clip) {
      painted = {
        min_x: Math.max(painted.min_x, state.clip.min_x),
        min_y: Math.max(painted.min_y, state.clip.min_y),
        max_x: Math.min(painted.max_x, state.clip.max_x),
        max_y: Math.min(painted.max_y, state.clip.max_y),
      };
    }
    if (
      painted.min_x < -EDGE_SLACK ||
      painted.min_y < -EDGE_SLACK ||
      painted.max_x > width + EDGE_SLACK ||
      painted.max_y > height + EDGE_SLACK
    ) {
      const bounds = [painted.min_x, painted.min_y, painted.max_x, painted.max_y];
      outside.push(`${entry} paints ${bounds.map((value) => value.toFixed(1)).join(",")}`);
    }
  };
  for (const entry of log) {
    const call = JSON.parse(entry) as unknown[];
    const method = String(call[0]);
    const numbers = call.slice(1).map((value) => (typeof value === "number" ? value : 0));
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = numbers;
    if (method === "set") {
      const value = call[2];
      if (call[1] === "lineWidth" && typeof value === "number") state.line_width = value;
      else if (call[1] === "shadowBlur" && typeof value === "number") state.shadow_blur = value;
      else if (call[1] === "shadowOffsetX" && typeof value === "number") state.shadow_x = value;
      else if (call[1] === "shadowOffsetY" && typeof value === "number") state.shadow_y = value;
      else if (call[1] === "textAlign") state.align = String(value);
      else if (call[1] === "font") state.font_size = Number(/([\d.]+)px/.exec(String(value))?.[1]);
    } else if (method === "save") stack.push({ ...state });
    else if (method === "restore") state = stack.pop() ?? state;
    else if (["translate", "rotate", "scale"].includes(method)) state.is_transformed = true;
    else if (method === "beginPath") path = EMPTY_EXTENT;
    else if (method === "moveTo" || method === "lineTo") path = include(path, a, b);
    else if (method === "quadraticCurveTo") path = include(include(path, a, b), c, d);
    else if (method === "bezierCurveTo") path = include(include(include(path, a, b), c, d), e, f);
    else if (method === "arc") path = include(path, a, b, c, c);
    else if (method === "ellipse") {
      const radius = Math.max(c, d);
      path = e === 0 ? include(path, a, b, c, d) : include(path, a, b, radius, radius);
    } else if (method === "rect") path = include(include(path, a, b), a + c, b + d);
    else if (method === "fill") check(entry, path, 0);
    else if (method === "stroke") check(entry, path, state.line_width / 2);
    else if (method === "clip") {
      const clip = state.clip;
      state.clip = clip
        ? {
            min_x: Math.max(clip.min_x, path.min_x),
            min_y: Math.max(clip.min_y, path.min_y),
            max_x: Math.min(clip.max_x, path.max_x),
            max_y: Math.min(clip.max_y, path.max_y),
          }
        : path;
    } else if (method === "fillRect" || method === "strokeRect") {
      const extent = include(include(EMPTY_EXTENT, a, b), a + c, b + d);
      check(entry, extent, method === "strokeRect" ? state.line_width / 2 : 0);
    } else if (method === "fillText" || method === "strokeText") {
      const text = String(call[1]);
      const text_width = Math.min(
        typeof call[4] === "number" ? call[4] : Infinity,
        text.length * state.font_size * 0.62,
      );
      const left =
        state.align === "center"
          ? b - text_width / 2
          : state.align === "right" || state.align === "end"
            ? b - text_width
            : b;
      const extent = include(
        include(EMPTY_EXTENT, left, c - state.font_size * 0.6),
        left + text_width,
        c + state.font_size * 0.6,
      );
      check(entry, extent, method === "strokeText" ? state.line_width / 2 : 0);
    }
  }
  return outside;
}

describe.each(CATEGORIES)("$category painters", ({ category, painter, count }) => {
  const items = PLACEABLES.filter((item) => item.category === category);

  it("covers every launch item of the category", () => {
    expect(items).toHaveLength(count);
  });

  it("paints every item at every frame and rotation", () => {
    for (const item of items) {
      for (const frame of FRAMES) {
        for (const rotation of ROTATIONS) {
          const { log } = paint_direct(painter, spec_for(item, rotation, frame));

          expect(log.length, `${item.id} r${rotation}`).toBeGreaterThan(40);
        }
      }
    }
  });

  it("paints through the furniture dispatcher", () => {
    for (const item of items) {
      for (const rotation of ROTATIONS) {
        expect(record_paint(spec_for(item, rotation)).log.length, item.id).toBeGreaterThan(40);
      }
    }
  });

  it("paints each item differently from every other item", () => {
    const digests = items.map((item) => paint_direct(painter, spec_for(item)).digest);

    expect(new Set(digests).size).toBe(items.length);
  });

  it("paints each item differently at each rotation", () => {
    for (const item of items) {
      const digests = ROTATIONS.map(
        (rotation) => paint_direct(painter, spec_for(item, rotation)).digest,
      );

      expect(new Set(digests).size, item.id).toBe(ROTATIONS.length);
    }
  });

  it("paints the same spec the same way twice", () => {
    for (const item of items) {
      for (const frame of FRAMES) {
        const spec = spec_for(item, 270, frame);

        expect(paint_direct(painter, spec).digest, item.id).toBe(
          paint_direct(painter, spec).digest,
        );
      }
    }
  });

  it("paints nothing outside the texture", () => {
    for (const item of items) {
      for (const frame of FRAMES) {
        for (const rotation of ROTATIONS) {
          const spec = spec_for(item, rotation, frame);
          const { log } = paint_direct(painter, spec);

          expect(
            paint_outside(log, spec.width, spec.height + OVERHANG),
            `${item.id} r${rotation}`,
          ).toEqual([]);
        }
      }
    }
  });

  it("paints the high-contrast and low-detail frames differently from the default", () => {
    for (const item of items) {
      const base = paint_direct(painter, spec_for(item)).digest;
      for (const frame of FRAMES.slice(1)) {
        expect(paint_direct(painter, spec_for(item, 0, frame)).digest, item.id).not.toBe(base);
      }
    }
  });
});

describe("service furniture layout", () => {
  const FOOTPRINTS = [
    [1, 1],
    [2, 1],
    [3, 1],
  ] as const;

  it("turns the service side clockwise with the rotation", () => {
    expect(ROTATIONS.map(service_side)).toEqual(["south", "west", "north", "east"]);
  });

  it("keeps every run inside its footprint and every anchor inside the texture", () => {
    for (const [width, height] of FOOTPRINTS) {
      for (const rotation of ROTATIONS) {
        const size = rotated_size(width * TILE, height * TILE, rotation);
        const box = footprint_box({
          ...spec_for(PLACEABLES[0] as Item),
          width: size.width,
          height: size.height,
        });
        for (const rise of [20, 34, 40]) {
          const run = make_run(box, rotation, { reach: 24, front_gap: 4, end_gap: 3, rise });
          const label = `${width}x${height} r${rotation} rise ${rise}`;

          expect(run.ground.x, label).toBeGreaterThanOrEqual(box.x);
          expect(run.ground.x + run.ground.width, label).toBeLessThanOrEqual(box.right);
          expect(ground_bottom(run.ground), label).toBeLessThanOrEqual(box.bottom);
          expect(run.ground.y - rise, label).toBeGreaterThanOrEqual(0);
          for (const along of [0, 0.5, 1]) {
            for (const from_front of [0, run.reach / 2, run.reach]) {
              const point = run.at(along, from_front);

              expect(point.x, label).toBeGreaterThanOrEqual(box.x);
              expect(point.x, label).toBeLessThanOrEqual(box.right);
              expect(point.y - rise, label).toBeGreaterThanOrEqual(0);
              expect(point.y, label).toBeLessThanOrEqual(box.bottom);
            }
          }
        }
      }
    }
  });

  it("puts the service edge of a run on the rotated south side", () => {
    const box = footprint_box({ ...spec_for(PLACEABLES[0] as Item), width: 96, height: 96 });
    const front = (rotation: Rotation) => {
      const run = make_run(box, rotation, { reach: 20, front_gap: 4, end_gap: 4, rise: 20 });
      return run.at(0.5, 0);
    };

    expect(front(0).y).toBeGreaterThan(box.centreY);
    expect(front(90).x).toBeLessThan(box.centreX);
    expect(front(180).y).toBeLessThan(box.centreY);
    expect(front(270).x).toBeGreaterThan(box.centreX);
  });

  it("flags a glow or a label that spreads past the texture edge", () => {
    const glowing = create_recording_context();
    glow(glowing.ctx, 24, 4, 8, 0xffffff, 0.5);
    const labelled = create_recording_context();
    bake_label(labelled.ctx, "Return trays", 4, 30, { maxWidth: 20, size: 6 });

    expect(paint_outside(glowing.log, 48, 64)).toHaveLength(1);
    expect(paint_outside(labelled.log, 48, 64)).toHaveLength(1);
  });

  it("hangs the first-aid cabinet above head height and inside its texture", () => {
    for (const rotation of ROTATIONS) {
      const box = footprint_box({ ...spec_for(PLACEABLES[0] as Item), width: TILE, height: TILE });
      const { cabinet, underside, top } = first_aid_layout(box, rotation);
      const label = `r${rotation}`;

      expect(underside, label).toBeGreaterThanOrEqual(FIRST_AID_UNDERSIDE);
      expect(FIRST_AID_UNDERSIDE, label).toBeGreaterThanOrEqual(40);
      expect(cabinet.y - top, label).toBeGreaterThanOrEqual(box.y - OVERHANG + 2);
      expect(cabinet.x, label).toBeGreaterThanOrEqual(box.x);
      expect(cabinet.x + cabinet.width, label).toBeLessThanOrEqual(box.right);
      expect(ground_bottom(cabinet), label).toBeLessThanOrEqual(box.bottom);
    }
  });

  it("sorts the trolley's chassis before everything standing on it", () => {
    const item = PLACEABLES.find((entry) => entry.id === "item.cleaning-trolley-bay") as Item;
    for (const rotation of ROTATIONS) {
      const spec = spec_for(item, rotation);
      const run = make_run(footprint_box(spec), rotation, {
        reach: 26,
        front_gap: 3,
        end_gap: 3,
        rise: 35,
      });
      const { chassis, riders } = trolley_parts(
        create_recording_context().ctx,
        run,
        DEFAULT_PAINT_FRAME,
      );

      expect(riders.length, `r${rotation}`).toBeGreaterThan(0);
      for (const rider of riders) expect(chassis.depth, `r${rotation}`).toBeLessThan(rider.depth);
    }
  });

  it("orients a ground rectangle along the service edge", () => {
    const centre = { x: 24, y: 40 };

    expect(oriented_ground(centre, 12, 6, "south")).toEqual({ x: 18, y: 37, width: 12, depth: 6 });
    expect(oriented_ground(centre, 12, 6, "west")).toEqual({ x: 21, y: 34, width: 6, depth: 12 });
  });
});
