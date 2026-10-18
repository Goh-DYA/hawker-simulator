/**
 * Facility painters: the public handwash sink, the drinking-water fountain, the accessible wash
 * basin, the staff mop sink, the first-aid cabinet, the locked cleaning cupboard and the
 * protected utility point, as practical hawker-centre infrastructure in the 3/4 view.
 *
 * Each is laid out along its service edge with a {@link Run}, so it turns with the placement
 * rotation (its user stands on the rotated south side) while the north-west light and the
 * shadows stay put. The branch comes from the ID-keyed style table in `render/art.ts`.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style, type FacilityStyle } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  label,
  line,
  linear_gradient,
  radial_gradient,
  shade,
  SHADOW_INK,
  stroke_rounded_rect,
  tint,
  type PaintContext,
} from "../canvas";
import { OVERHANG, type PaintFrame } from "../specs";
import { DARK_STEEL, type Box } from "./shared";
import {
  cast_shadow,
  CREAM,
  edge_style,
  face_of,
  face_view,
  ground_bottom,
  INK,
  is_across as is_across_side,
  lifted,
  make_run,
  oriented_ground,
  paint_cylinder,
  paint_glass,
  paint_glow,
  paint_padlock,
  paint_parts,
  paint_pictogram,
  paint_prism,
  paint_service_sliver,
  paint_tube_post,
  RECESS,
  run_on,
  service_side,
  STAINLESS,
  TEAL_STEEL,
  type FaceView,
  type Ground,
  type Part,
  type Point,
  type Run,
  type ServiceSide,
} from "./steelwork";

/** Height of the handwash vanity top. */
const VANITY_LIFT = 18;
/** Height of the accessible basin's rim (lower, with knee clearance below). */
const LOW_BASIN = 15;
/** White glazed ceramic of basins. */
const CERAMIC = 0xf4f3ee;
/** Pale glazed splashback tile. */
const SPLASH_TILE = 0xd6ebe6;
/** Grout between tiles. */
const GROUT = 0xa9c4be;
/** Mirror glass. */
const MIRROR = 0x9fb9c4;
/** Water tint. */
const WATER = 0x6fb7cf;
/** Drinking-water blue of the fountain's signs. */
const DRINK_BLUE = 0x2f7fb8;
/** Red of "STAFF ONLY" lettering and warning bands. */
const STAFF_RED = 0xb8452a;
/** Accessible-facility blue of rails and signs. */
const ACCESS_BLUE = 0x2a6db5;
/** Safety green of the first-aid sign (ISO 7010 style: white cross on green). */
const FIRST_AID_GREEN = 0x1f8a4c;
/** Safety yellow of hazard signs and bollards. */
const SAFETY_YELLOW = 0xe8c03a;
/** Grey-green painted steel of the cleaning cupboard. */
const CUPBOARD_STEEL = 0x8fa19b;
/** Height of the mop sink's zinc wall panel. */
const MOP_PANEL = 29;
/** Zinc sheeting of the mop sink's wall panel. */
const ZINC = 0xa9b6b3;
/** Grey powder coat of the utility pedestal. */
const UTILITY_GREY = 0x7d8a87;

/** A facility painter: paints one branch in the rotated footprint. */
type FacilityPainter = (
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
) => void;

/** The painter of each facility branch. */
const FACILITY_PAINTERS: Readonly<Record<FacilityStyle, FacilityPainter>> = {
  handwash: paint_handwash,
  fountain: paint_fountain,
  "accessible-basin": paint_accessible_basin,
  "mop-sink": paint_mop_sink,
  "first-aid": paint_first_aid,
  cupboard: paint_cupboard,
  utility: paint_utility_point,
};

/**
 * Paints a facility (handwash sink, fountain, accessible basin, mop sink, first-aid cabinet,
 * cleaning cupboard or utility point) in its rotated orientation.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box (already rotated).
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; the service side faces the rotated south.
 */
export function paint_facility(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  FACILITY_PAINTERS[resolve_placeable_style("facility", recipe)](ctx, box, recipe, frame, rotation);
}

/**
 * Clads a face in small glazed tiles.
 *
 * @param ctx - The paint context.
 * @param face - The face rectangle.
 * @param colour - The tile colour.
 * @param frame - The paint frame.
 * @param size - The tile size.
 */
function paint_tiles(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  colour: number,
  frame: PaintFrame,
  size = 4,
): void {
  if (face.width <= 2 || face.height <= 2) return;
  fill_rounded_rect(
    ctx,
    face.x + 0.8,
    face.y + 0.8,
    face.width - 1.6,
    face.height - 1.6,
    0.6,
    css(colour),
  );
  if (frame.isLowDetail) return;
  ctx.fillStyle = css(GROUT, 0.7);
  for (let x = face.x + size; x < face.x + face.width - 1; x += size) {
    ctx.fillRect(x, face.y + 0.8, 0.5, face.height - 1.6);
  }
  for (let y = face.y + size; y < face.y + face.height - 1; y += size) {
    ctx.fillRect(face.x + 0.8, y, face.width - 1.6, 0.5);
  }
}

/**
 * Paints an oval basin sunk into a top surface: a ceramic rim, a shaded bowl and a drain.
 *
 * @param ctx - The paint context.
 * @param centre - The basin centre on screen.
 * @param radius_x - Half width.
 * @param radius_y - Half depth.
 */
function paint_basin(ctx: PaintContext, centre: Point, radius_x: number, radius_y: number): void {
  fill_ellipse(ctx, centre.x, centre.y, radius_x, radius_y, css(tint(CERAMIC, 0.3)));
  fill_ellipse(
    ctx,
    centre.x,
    centre.y + 0.4,
    radius_x - 1.4,
    radius_y - 1.1,
    linear_gradient(ctx, 0, centre.y - radius_y, 0, centre.y + radius_y, [
      [0, 0xb9c7c6],
      [1, CERAMIC],
    ]),
  );
  fill_circle(ctx, centre.x + 0.4, centre.y + 0.6, 0.9, css(DARK_STEEL));
  fill_ellipse(
    ctx,
    centre.x + radius_x * 0.3,
    centre.y + radius_y * 0.35,
    radius_x * 0.3,
    0.6,
    css(0xffffff, 0.6),
  );
}

/**
 * Paints a gooseneck tap rising from a back point and curving over a basin.
 *
 * @param ctx - The paint context.
 * @param base - The tap's screen foot.
 * @param spout - The spout tip on screen.
 * @param frame - The paint frame.
 */
function paint_gooseneck(ctx: PaintContext, base: Point, spout: Point, frame: PaintFrame): void {
  const peak = Math.min(base.y, spout.y) - 7;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(base.x, peak + 2);
  ctx.quadraticCurveTo(base.x, peak - 1, (base.x + spout.x) / 2, peak - 1);
  ctx.quadraticCurveTo(spout.x, peak - 1, spout.x, spout.y);
  ctx.strokeStyle = css(frame.isHighContrast ? INK : shade(STAINLESS, 0.35));
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.strokeStyle = css(tint(STAINLESS, 0.4));
  ctx.lineWidth = 0.8;
  ctx.stroke();
  fill_rounded_rect(ctx, base.x - 1.6, base.y - 1, 3.2, 2, 0.6, css(STAINLESS));
}

/**
 * Paints a mirror strip with two diagonal reflections and a thin steel frame.
 *
 * @param ctx - The paint context.
 * @param rect - The mirror rectangle.
 * @param frame - The paint frame.
 */
function paint_mirror(
  ctx: PaintContext,
  rect: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  fill_rounded_rect(
    ctx,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0.8,
    linear_gradient(ctx, 0, rect.y, 0, rect.y + rect.height, [
      [0, tint(MIRROR, 0.25)],
      [1, shade(MIRROR, 0.15)],
    ]),
  );
  paint_glass(ctx, rect, 0xffffff, 0.04);
  const edge = edge_style(frame, STAINLESS);
  ctx.strokeStyle = frame.isHighContrast ? edge.style : css(tint(STAINLESS, 0.2));
  ctx.lineWidth = frame.isHighContrast ? edge.width : 0.9;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

/**
 * Paints the public handwash sink: a white vanity clad in glazed tiles with a band of small
 * Peranakan-style accent tiles, two oval basins under gooseneck taps, a soap dispenser between
 * them, and a tiled splashback with a mirror strip.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_handwash(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 24, front_gap: 4, end_gap: 3, rise: 35 });
  const view = face_view(run.side);
  cast_shadow(ctx, run.ground, VANITY_LIFT);
  paint_prism(ctx, run.ground, VANITY_LIFT, CERAMIC, frame, { front: 0xe9ece6, lip: 1 });
  const face = face_of(run.ground, VANITY_LIFT);
  paint_tiles(
    ctx,
    { x: face.x, y: face.y + 1, width: face.width, height: face.height - 4 },
    0xeef2ee,
    frame,
  );
  if (view !== "end") paint_accent_band(ctx, face, recipe.accent, frame);
  ctx.fillStyle = css(DARK_STEEL);
  ctx.fillRect(face.x + 1, face.y + face.height - 3, face.width - 2, 2.6);
  paint_service_sliver(ctx, run, VANITY_LIFT, TEAL_STEEL);
  const splash = run.segment(0, 1, run.reach - 3, run.reach);
  const parts: Part[] = [
    {
      depth: ground_bottom(splash),
      draw: () => {
        paint_prism(ctx, splash, VANITY_LIFT + 15, SPLASH_TILE, frame, {
          base: VANITY_LIFT,
          radius: 0.8,
        });
        const panel = face_of(splash, VANITY_LIFT + 15, VANITY_LIFT);
        paint_tiles(ctx, panel, SPLASH_TILE, frame);
        if (view === "front") {
          paint_mirror(
            ctx,
            { x: panel.x + 4, y: panel.y + 2, width: panel.width - 8, height: 7 },
            frame,
          );
        }
      },
    },
  ];
  for (const along of [0.27, 0.73]) {
    const centre = run.at(along, 10);
    parts.push({
      depth: centre.y,
      draw: () => {
        paint_basin(
          ctx,
          lifted(centre, VANITY_LIFT),
          run.side === "south" || run.side === "north" ? 8.5 : 6,
          4.6,
        );
        const tap_base = lifted(run.at(along, run.reach - 4), VANITY_LIFT);
        paint_gooseneck(ctx, tap_base, lifted(run.at(along, 11), VANITY_LIFT + 6), frame);
      },
    });
  }
  const soap = run.at(0.5, run.reach - 4.5);
  parts.push({
    depth: soap.y,
    draw: () => {
      const ground = oriented_ground(soap, 5, 3, run.side);
      paint_prism(ctx, ground, VANITY_LIFT + 9, CERAMIC, frame, {
        base: VANITY_LIFT + 3,
        radius: 1,
      });
      const soap_face = face_of(ground, VANITY_LIFT + 9, VANITY_LIFT + 3);
      fill_rounded_rect(
        ctx,
        soap_face.x + 1,
        soap_face.y + 1.2,
        Math.max(1, soap_face.width - 2),
        2.4,
        0.6,
        css(0x6cbf8a),
      );
    },
  });
  paint_parts(parts);
}

/**
 * Paints a band of small diamond-patterned accent tiles across the top of a vanity face.
 *
 * @param ctx - The paint context.
 * @param face - The vanity face.
 * @param accent - The recipe accent, used for alternate diamonds.
 * @param frame - The paint frame.
 */
function paint_accent_band(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  accent: number,
  frame: PaintFrame,
): void {
  const y = face.y + 3;
  const size = 4;
  ctx.fillStyle = css(0xf6efe0);
  ctx.fillRect(face.x + 1, y - 0.2, face.width - 2, size + 0.4);
  if (frame.isLowDetail) return;
  const colours = [TEAL_STEEL, accent] as const;
  let index = 0;
  for (let x = face.x + 1 + size / 2; x < face.x + face.width - 1; x += size) {
    const colour = colours[index % 2] ?? TEAL_STEEL;
    fill_polygon(
      ctx,
      [
        [x, y + 0.4],
        [x + size / 2 - 0.5, y + size / 2],
        [x, y + size - 0.4],
        [x - size / 2 + 0.5, y + size / 2],
      ],
      css(colour),
    );
    index += 1;
  }
}

/**
 * Paints the drinking-water fountain: a steel bottle-refill tower with a lit niche and a blue
 * drop sign behind a pedestal bowl with a bubbler spout and push button.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_fountain(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 20, front_gap: 5, end_gap: 9, rise: 41 });
  cast_shadow(ctx, run.ground, 30);
  const tower = run.segment(0.08, 0.92, run.reach - 7, run.reach);
  const bowl = run.at(0.5, 6.5);
  const parts: Part[] = [
    {
      depth: ground_bottom(tower),
      draw: () => {
        paint_prism(ctx, tower, 40, STAINLESS, frame, {
          is_steel: true,
          seed: recipe.seed,
          radius: 2,
          lip: 1,
        });
        const face = face_of(tower, 40);
        if (face_view(run.side) === "front") paint_refill_niche(ctx, face, frame);
        else if (face_view(run.side) === "back") paint_fountain_back(ctx, face, frame);
        paint_service_sliver(ctx, run_of(tower, run), 40, WATER);
      },
    },
    {
      depth: bowl.y,
      draw: () => {
        const foot = bowl;
        paint_cylinder(ctx, foot.x, foot.y, 4, 16, STAINLESS, frame, {
          cap: shade(STAINLESS, 0.2),
        });
        paint_cylinder(ctx, foot.x, foot.y - 16, 8.5, 3, STAINLESS, frame, {
          cap: tint(STAINLESS, 0.3),
        });
        fill_ellipse(ctx, foot.x, foot.y - 19, 6.4, 3.3, css(shade(WATER, 0.25)));
        fill_ellipse(ctx, foot.x - 1.6, foot.y - 19.6, 2.4, 0.9, css(0xffffff, 0.45));
        fill_rounded_rect(ctx, foot.x - 1, foot.y - 22, 2, 3, 0.8, css(DARK_STEEL));
        ctx.beginPath();
        ctx.moveTo(foot.x, foot.y - 22);
        ctx.quadraticCurveTo(foot.x + 2.5, foot.y - 25, foot.x + 3.6, foot.y - 20);
        ctx.strokeStyle = css(0xbfe9f7, 0.9);
        ctx.lineWidth = 0.9;
        ctx.stroke();
        fill_rounded_rect(ctx, foot.x - 1.8, foot.y - 16.6, 3.6, 1.6, 0.6, css(TEAL_STEEL));
      },
    },
  ];
  paint_parts(parts);
}

/**
 * Wraps a sub-rectangle of a run as its own run facing the same side.
 *
 * @param ground - The sub-rectangle.
 * @param run - The parent run.
 * @returns A run over the sub-rectangle.
 */
function run_of(ground: Ground, run: Run): Run {
  return { ...run, ground };
}

/**
 * Details the refill tower front: a blue drop sign, a dark niche with a spout and a drip grille,
 * and a glowing sensor.
 *
 * @param ctx - The paint context.
 * @param face - The tower's south face.
 * @param frame - The paint frame.
 */
function paint_refill_niche(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  const cx = face.x + face.width / 2;
  paint_drop_sign(ctx, cx, face.y + 5.5, 3.4);
  const niche = { x: cx - 6, y: face.y + 11, width: 12, height: 13 };
  fill_rounded_rect(ctx, niche.x, niche.y, niche.width, niche.height, 2, css(RECESS));
  fill_rounded_rect(ctx, cx - 1.2, niche.y + 0.5, 2.4, 2.6, 0.6, css(STAINLESS));
  ctx.fillStyle = css(DARK_STEEL);
  for (let index = 0; index < 4; index += 1) {
    ctx.fillRect(niche.x + 1.5 + index * 2.6, niche.y + niche.height - 2.4, 1.6, 1.6);
  }
  fill_circle(ctx, cx + 4, niche.y + 3, 0.8, css(0x7fd3f5));
  paint_glow(ctx, frame, cx, niche.y + niche.height / 2, 8, 0x9fe0ff, 0.35);
}

/**
 * Details the refill tower's back, which faces the camera when the fountain serves north: a blue
 * "drinking water" band with a large white drop, so the tower still reads from behind.
 *
 * @param ctx - The paint context.
 * @param face - The tower's south face (its back).
 * @param frame - The paint frame.
 */
function paint_fountain_back(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  const band = { x: face.x + 2, y: face.y + 4, width: face.width - 4, height: 13 };
  fill_rounded_rect(
    ctx,
    band.x,
    band.y,
    band.width,
    band.height,
    1.4,
    linear_gradient(ctx, 0, band.y, 0, band.y + band.height, [
      [0, tint(DRINK_BLUE, 0.12)],
      [1, shade(DRINK_BLUE, 0.12)],
    ]),
  );
  paint_pictogram(ctx, "drop", band.x + band.width / 2, band.y + band.height / 2, 10.5, 0xffffff);
  const edge = edge_style(frame, DRINK_BLUE);
  stroke_rounded_rect(ctx, band.x, band.y, band.width, band.height, 1.4, edge.style, edge.width);
  ctx.fillStyle = css(RECESS, 0.4);
  for (let index = 0; index < 4; index += 1) {
    ctx.fillRect(face.x + face.width / 2 - 5, face.y + 22 + index * 2.4, 10, 0.9);
  }
}

/**
 * Paints a white water drop on a blue roundel.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Roundel radius.
 */
function paint_drop_sign(ctx: PaintContext, cx: number, cy: number, radius: number): void {
  fill_circle(ctx, cx, cy, radius, css(0x2f7fb8));
  fill_polygon(
    ctx,
    [
      [cx, cy - radius * 0.7],
      [cx - radius * 0.42, cy + radius * 0.05],
      [cx + radius * 0.42, cy + radius * 0.05],
    ],
    css(0xffffff),
  );
  fill_circle(ctx, cx, cy + radius * 0.15, radius * 0.42, css(0xffffff));
}

/**
 * Paints the accessible wash basin: a low wall-hung basin with open knee clearance and a chrome
 * trap below, a lever tap, a blue grab rail looping around its front, a vertical grab bar, a
 * tilted mirror and an accessibility sign on the tiled wall panel behind.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_accessible_basin(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 24, front_gap: 4, end_gap: 3, rise: 33 });
  const view = face_view(run.side);
  const wall = run.segment(0, 1, run.reach - 3, run.reach);
  cast_shadow(ctx, wall, 30);
  const basin = run.segment(0.22, 0.68, 5, run.reach - 3);
  paint_knee_shadow(ctx, basin);
  const parts: Part[] = [
    {
      depth: ground_bottom(wall),
      draw: () => {
        paint_prism(ctx, wall, 32, SPLASH_TILE, frame, { radius: 0.8, seed: recipe.seed });
        const panel = face_of(wall, 32);
        paint_tiles(ctx, panel, SPLASH_TILE, frame);
        if (view === "front") paint_accessible_wall(ctx, panel, frame);
        else if (view === "back") paint_accessible_back(ctx, panel, frame);
      },
    },
    {
      depth: ground_bottom(basin),
      draw: () => {
        paint_basin_trap(ctx, run, frame);
        paint_prism(ctx, basin, LOW_BASIN, CERAMIC, frame, {
          base: LOW_BASIN - 4,
          radius: 2,
          lip: 1,
        });
        const centre = lifted(run.at(0.45, 11), LOW_BASIN);
        paint_basin(ctx, centre, is_across(run) ? 8 : 5.5, 4.4);
        const lever = lifted(run.at(0.45, run.reach - 5), LOW_BASIN);
        fill_rounded_rect(ctx, lever.x - 1.4, lever.y - 4, 2.8, 4, 0.8, css(STAINLESS));
        line(
          ctx,
          lever.x,
          lever.y - 3.6,
          lever.x + 4,
          lever.y - 4.6,
          css(shade(STAINLESS, 0.3)),
          1.4,
        );
      },
    },
    { depth: ground_bottom(basin) + 0.5, draw: () => paint_grab_rail(ctx, run, frame) },
  ];
  paint_parts(parts);
}

/**
 * Reports whether a run's service edge runs across the screen.
 *
 * @param run - The run.
 * @returns True for south and north runs.
 */
function is_across(run: Run): boolean {
  return run.side === "south" || run.side === "north";
}

/**
 * Details the accessible basin's wall panel: a vertical grab bar, a mirror tilted forward
 * (darker at the top) and a blue accessibility sign.
 *
 * @param ctx - The paint context.
 * @param panel - The wall panel's south face.
 * @param frame - The paint frame.
 */
function paint_accessible_wall(
  ctx: PaintContext,
  panel: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  paint_mirror(
    ctx,
    { x: panel.x + panel.width * 0.25, y: panel.y + 3, width: panel.width * 0.42, height: 9 },
    frame,
  );
  fill_polygon(
    ctx,
    [
      [panel.x + panel.width * 0.25, panel.y + 3],
      [panel.x + panel.width * 0.67, panel.y + 3],
      [panel.x + panel.width * 0.65, panel.y + 5],
      [panel.x + panel.width * 0.27, panel.y + 5],
    ],
    css(shade(MIRROR, 0.35), 0.6),
  );
  const bar_x = panel.x + panel.width * 0.1;
  line(ctx, bar_x, panel.y + 6, bar_x, panel.y + 22, css(ACCESS_BLUE), 2.2);
  line(ctx, bar_x - 0.5, panel.y + 6, bar_x - 0.5, panel.y + 22, css(tint(ACCESS_BLUE, 0.4)), 0.6);
  const sign = { x: panel.x + panel.width * 0.8, y: panel.y + 4, size: 8 };
  fill_rounded_rect(ctx, sign.x, sign.y, sign.size, sign.size, 1, css(ACCESS_BLUE));
  paint_access_pictogram(ctx, sign.x + sign.size / 2, sign.y + sign.size / 2);
}

/**
 * Paints the simplified public accessibility pictogram in white: a head, a seated body and a
 * wheel.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 */
function paint_access_pictogram(ctx: PaintContext, cx: number, cy: number): void {
  const white = css(0xffffff);
  fill_circle(ctx, cx - 0.6, cy - 2.6, 0.8, white);
  line(ctx, cx - 0.8, cy - 1.4, cx - 0.6, cy + 0.6, white, 0.9);
  line(ctx, cx - 0.6, cy + 0.6, cx + 1.6, cy + 0.6, white, 0.9);
  line(ctx, cx + 1.6, cy + 0.6, cx + 2.4, cy + 2.4, white, 0.9);
  ctx.beginPath();
  ctx.arc(cx - 0.6, cy + 1.2, 2, Math.PI * 0.6, Math.PI * 1.9, false);
  ctx.strokeStyle = white;
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

/**
 * Details the accessible basin's wall panel from behind, which faces the camera when the basin
 * serves north: a blue band carrying the accessibility sign, so the panel still reads.
 *
 * @param ctx - The paint context.
 * @param panel - The wall panel's south face (its back).
 * @param frame - The paint frame.
 */
function paint_accessible_back(
  ctx: PaintContext,
  panel: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  ctx.fillStyle = css(ACCESS_BLUE, 0.85);
  ctx.fillRect(panel.x + 1, panel.y + 15, panel.width - 2, 2.2);
  const size = 11;
  const sign = { x: panel.x + panel.width / 2 - size / 2, y: panel.y + 3 };
  fill_rounded_rect(ctx, sign.x, sign.y, size, size, 1.4, css(ACCESS_BLUE));
  paint_access_pictogram(ctx, sign.x + size / 2, sign.y + size / 2);
  const edge = edge_style(frame, ACCESS_BLUE);
  stroke_rounded_rect(ctx, sign.x, sign.y, size, size, 1.4, edge.style, edge.width);
}

/**
 * Paints the soft, feathered shadow on the floor under the accessible basin's open knee space,
 * fading out instead of reading as a solid block.
 *
 * @param ctx - The paint context.
 * @param basin - The basin's ground rectangle.
 */
function paint_knee_shadow(ctx: PaintContext, basin: Ground): void {
  const cx = basin.x + basin.width / 2 + 2;
  const cy = basin.y + basin.depth / 2 + 1.5;
  const radius_x = basin.width / 2;
  const radius_y = basin.depth / 2;
  fill_ellipse(
    ctx,
    cx,
    cy,
    radius_x,
    radius_y,
    radial_gradient(ctx, cx, cy, 0, Math.max(radius_x, radius_y), [
      [0, SHADOW_INK, 0.16],
      [0.6, SHADOW_INK, 0.08],
      [1, SHADOW_INK, 0],
    ]),
  );
}

/**
 * Paints the chrome P-trap under the accessible basin: a tailpiece dropping from just behind the
 * basin's front, so it shows below the basin's south face, a U-bend and the arm running back into
 * the wall.
 *
 * @param ctx - The paint context.
 * @param run - The basin run.
 * @param frame - The paint frame.
 */
function paint_basin_trap(ctx: PaintContext, run: Run, frame: PaintFrame): void {
  const drop_at = 7;
  const top = lifted(run.at(0.45, drop_at), LOW_BASIN - 4);
  const bend = lifted(run.at(0.45, drop_at), 5.5);
  const wall = lifted(run.at(0.45, run.reach - 3), 7);
  const dark = css(frame.isHighContrast ? INK : shade(STAINLESS, 0.45));
  const chrome = css(tint(STAINLESS, 0.35));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [style, width] of [
    [dark, 2.4],
    [chrome, 1.4],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(wall.x, wall.y);
    ctx.lineTo(bend.x + 1.6, bend.y - 1.5);
    ctx.quadraticCurveTo(bend.x + 1.6, bend.y + 1.4, bend.x, bend.y + 1.4);
    ctx.quadraticCurveTo(bend.x - 1.4, bend.y + 1.4, bend.x - 1.4, bend.y);
    ctx.lineTo(top.x - 1.4, top.y);
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
  fill_rounded_rect(ctx, top.x - 2.6, top.y - 0.6, 2.4, 1.4, 0.4, chrome);
}

/**
 * Paints the blue grab rail that loops around the front of the accessible basin, with its wall
 * brackets.
 *
 * @param ctx - The paint context.
 * @param run - The basin run.
 * @param frame - The paint frame.
 */
function paint_grab_rail(ctx: PaintContext, run: Run, frame: PaintFrame): void {
  const height = LOW_BASIN - 1;
  const points = [
    run.at(0.15, run.reach - 3),
    run.at(0.15, 2.5),
    run.at(0.75, 2.5),
    run.at(0.75, run.reach - 3),
  ].map((point) => lifted(point, height));
  const trace = () => {
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
  };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  trace();
  ctx.strokeStyle = css(frame.isHighContrast ? INK : shade(ACCESS_BLUE, 0.4));
  ctx.lineWidth = frame.isHighContrast ? 3.4 : 2.6;
  ctx.stroke();
  trace();
  ctx.strokeStyle = css(ACCESS_BLUE);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  trace();
  ctx.strokeStyle = css(tint(ACCESS_BLUE, 0.5));
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints the staff mop sink: a low deep steel floor sink under a wall tap on a zinc panel with a
 * "STAFF ONLY" plate, a mop and a broom hanging in clips, and a yellow mop bucket with its
 * wringer on castors.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_mop_sink(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 24, front_gap: 4, end_gap: 3, rise: 35 });
  const view = face_view(run.side);
  const panel = run.segment(0, 1, run.reach - 2.5, run.reach);
  const sink = run.segment(0.04, 0.5, 2, run.reach - 3);
  cast_shadow(ctx, panel, 30);
  cast_shadow(ctx, sink, 9);
  const parts: Part[] = [
    {
      depth: ground_bottom(panel),
      draw: () => {
        paint_prism(ctx, panel, MOP_PANEL, ZINC, frame, { seed: recipe.seed, radius: 0.8 });
        const face = face_of(panel, MOP_PANEL);
        paint_zinc_ribs(ctx, face, frame);
        if (view === "front") paint_mop_wall(ctx, face, frame);
        else if (view === "back") paint_staff_plate(ctx, face, frame);
      },
    },
    { depth: ground_bottom(sink), draw: () => paint_floor_sink(ctx, sink, frame) },
  ];
  for (const [along, kind] of [
    [0.66, "broom"],
    [0.86, "mop"],
  ] as const) {
    const ground = run.at(along, run.reach - 4);
    parts.push({ depth: ground.y, draw: () => paint_hanging_tool(ctx, ground, kind) });
  }
  const bucket = run.at(0.72, 8);
  parts.push({ depth: bucket.y, draw: () => paint_mop_bucket(ctx, bucket, frame) });
  paint_parts(parts);
}

/**
 * Ribs a zinc panel face with the light and dark lines of corrugated sheeting.
 *
 * @param ctx - The paint context.
 * @param face - The face rectangle.
 * @param frame - The paint frame.
 */
function paint_zinc_ribs(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  if (frame.isLowDetail || face.width < 6) return;
  for (let x = face.x + 2; x < face.x + face.width - 1; x += 3) {
    ctx.fillStyle = css(0xffffff, 0.22);
    ctx.fillRect(x, face.y + 1, 0.8, face.height - 2);
    ctx.fillStyle = css(RECESS, 0.14);
    ctx.fillRect(x + 1.2, face.y + 1, 0.8, face.height - 2);
  }
}

/**
 * Details the mop sink's wall panel: a wall tap with two cross handles over the sink, a clip
 * rail and a "STAFF ONLY" plate.
 *
 * @param ctx - The paint context.
 * @param face - The panel's south face.
 * @param frame - The paint frame.
 */
function paint_mop_wall(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  const tap_x = face.x + face.width * 0.27;
  const tap_y = face.y + 12;
  line(ctx, tap_x - 5, tap_y, tap_x + 5, tap_y, css(shade(STAINLESS, 0.25)), 2);
  for (const x of [tap_x - 5, tap_x + 5]) {
    line(ctx, x - 1.6, tap_y - 1.6, x + 1.6, tap_y + 1.6, css(x < tap_x ? 0xc8372d : 0x2f7fb8), 1);
    line(ctx, x + 1.6, tap_y - 1.6, x - 1.6, tap_y + 1.6, css(x < tap_x ? 0xc8372d : 0x2f7fb8), 1);
  }
  line(ctx, tap_x, tap_y, tap_x, tap_y + 5, css(shade(STAINLESS, 0.25)), 1.8);
  ctx.fillStyle = css(DARK_STEEL);
  ctx.fillRect(face.x + face.width * 0.58, face.y + 6, face.width * 0.38, 1.4);
  paint_plate(
    ctx,
    { x: face.x + face.width * 0.08, y: face.y + 2, width: face.width * 0.36, height: 5.4 },
    frame,
  );
}

/**
 * Details the mop sink's zinc panel from behind, which faces the camera when the sink serves
 * north: a large "STAFF ONLY" plate over a red warning band, so the panel still reads.
 *
 * @param ctx - The paint context.
 * @param face - The panel's south face (its back).
 * @param frame - The paint frame.
 */
function paint_staff_plate(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  ctx.fillStyle = css(STAFF_RED, 0.85);
  ctx.fillRect(face.x + 1, face.y + 13, face.width - 2, 2);
  const width = Math.min(34, face.width * 0.5);
  paint_plate(
    ctx,
    { x: face.x + face.width / 2 - width / 2, y: face.y + 4, width, height: 7 },
    frame,
  );
}

/**
 * Paints a cream "STAFF ONLY" plate with red text.
 *
 * @param ctx - The paint context.
 * @param plate - The plate rectangle.
 * @param frame - The paint frame.
 */
function paint_plate(
  ctx: PaintContext,
  plate: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  fill_rounded_rect(ctx, plate.x, plate.y, plate.width, plate.height, 0.8, css(CREAM));
  label(ctx, "Staff only", plate.x + plate.width / 2, plate.y + plate.height / 2 + 0.2, {
    maxWidth: plate.width - 2,
    size: plate.height - 0.6,
    colour: STAFF_RED,
    uppercase: true,
  });
  const edge = edge_style(frame, CREAM);
  ctx.strokeStyle = edge.style;
  ctx.lineWidth = edge.width;
  ctx.strokeRect(plate.x, plate.y, plate.width, plate.height);
}

/**
 * Paints the low, deep floor sink with its dark basin and drain grate.
 *
 * @param ctx - The paint context.
 * @param sink - The sink's ground rectangle.
 * @param frame - The paint frame.
 */
function paint_floor_sink(ctx: PaintContext, sink: Ground, frame: PaintFrame): void {
  paint_prism(ctx, sink, 9, STAINLESS, frame, { is_steel: true, radius: 1.6, lip: 1 });
  const top = { x: sink.x + 2, y: sink.y - 9 + 2, width: sink.width - 4, height: sink.depth - 4 };
  fill_rounded_rect(
    ctx,
    top.x,
    top.y,
    top.width,
    top.height,
    1.2,
    linear_gradient(ctx, 0, top.y, 0, top.y + top.height, [
      [0, 0x2e3a3a],
      [1, 0x6f7f7c],
    ]),
  );
  fill_circle(ctx, top.x + top.width / 2, top.y + top.height * 0.6, 1.6, css(DARK_STEEL));
  for (let index = -1; index <= 1; index += 1) {
    line(
      ctx,
      top.x + top.width / 2 - 1.2,
      top.y + top.height * 0.6 + index * 0.6,
      top.x + top.width / 2 + 1.2,
      top.y + top.height * 0.6 + index * 0.6,
      css(RECESS),
      0.3,
    );
  }
}

/**
 * Paints a broom or a mop hanging from the wall clip rail, its head just above the floor.
 *
 * @param ctx - The paint context.
 * @param ground - The ground point below the clip.
 * @param kind - Which tool.
 */
function paint_hanging_tool(ctx: PaintContext, ground: Point, kind: "broom" | "mop"): void {
  const clip = lifted(ground, 26);
  const foot = lifted(ground, 3);
  line(ctx, clip.x, clip.y, foot.x, foot.y - 4, css(kind === "mop" ? 0x3d6fa8 : 0x8a6241), 1.3);
  if (kind === "broom") {
    fill_polygon(
      ctx,
      [
        [foot.x - 1.8, foot.y - 4],
        [foot.x + 1.8, foot.y - 4],
        [foot.x + 3.2, foot.y + 1],
        [foot.x - 3.2, foot.y + 1],
      ],
      css(0x4a5558),
    );
    return;
  }
  for (let strand = -3; strand <= 3; strand += 1) {
    line(
      ctx,
      foot.x + strand * 0.4,
      foot.y - 4,
      foot.x + strand * 1.1,
      foot.y + 1.5,
      css(strand % 2 ? 0xe9e4d6 : 0xcfc8b6),
      1,
    );
  }
}

/**
 * Paints the yellow mop bucket with its grey wringer and castors.
 *
 * @param ctx - The paint context.
 * @param ground - The bucket's ground centre.
 * @param frame - The paint frame.
 */
function paint_mop_bucket(ctx: PaintContext, ground: Point, frame: PaintFrame): void {
  fill_ellipse(ctx, ground.x + 1, ground.y + 1, 7, 3, css(INK, 0.22));
  for (const offset of [-4, 4]) fill_circle(ctx, ground.x + offset, ground.y, 1.3, css(0x222a2b));
  const foot = lifted(ground, 1.5);
  paint_cylinder(ctx, foot.x, foot.y, 6, 9, SAFETY_YELLOW, frame, { cap: 0x7f9fa6 });
  fill_rounded_rect(ctx, foot.x - 1, foot.y - 15, 6, 6.5, 1, css(0x5f6b6e));
  line(ctx, foot.x + 1, foot.y - 15, foot.x - 2.5, foot.y - 20, css(0x5f6b6e), 1.3);
}

/** Height of the first-aid cabinet's underside above its floor line, clear of a guest's head. */
export const FIRST_AID_UNDERSIDE = 41;
/** Height of the first-aid cabinet's top above its floor line. */
const FIRST_AID_TOP = 53;
/** Length of the visible ceiling drop rods above the first-aid cabinet. */
const FIRST_AID_RODS = 4;

/**
 * Lays out the first-aid cabinet in its tile. The cabinet hangs from the ceiling, so guests walk
 * under it and it draws above them: its underside sits {@link FIRST_AID_UNDERSIDE} pixels above
 * its floor line, which therefore lies in the south of the tile, and the drop rods above it rise
 * to the texture's top edge. Turned to serve west or east, the cabinet runs north-south and is
 * shorter, since its length then rises on screen.
 *
 * @param box - The footprint box.
 * @param rotation - The placement rotation.
 * @returns The cabinet's ground rectangle (its floor line), its service side and its heights.
 */
export function first_aid_layout(
  box: Box,
  rotation: Rotation,
): { cabinet: Ground; side: ServiceSide; underside: number; top: number } {
  const side = service_side(rotation);
  const y = box.y - OVERHANG + FIRST_AID_TOP + FIRST_AID_RODS;
  const cabinet = is_across_side(side)
    ? { x: box.centreX - 12, y, width: 24, depth: 4 }
    : { x: box.centreX - 6, y, width: 12, depth: Math.min(9, box.bottom - 1 - y) };
  return { cabinet, side, underside: FIRST_AID_UNDERSIDE, top: FIRST_AID_TOP };
}

/**
 * Paints the first-aid cabinet: a white wall-type cabinet with a green first-aid sign (white cross
 * on green) hung high from two ceiling drop rods, so guests pass beneath it, with only a faint
 * shadow on the floor far below. It has no part on the floor. Its door and handle face the
 * service side; from behind and end-on the cabinet's back and end panels carry the sign too.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_first_aid(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const { cabinet, side, underside, top } = first_aid_layout(box, rotation);
  const view = face_view(side);
  paint_hung_shadow(ctx, cabinet);
  const rod_top = box.y - OVERHANG + 0.8;
  const rod_along = is_across_side(side) ? [0.2, 0.8] : [0.5];
  for (const along of rod_along) {
    const x = is_across_side(side)
      ? cabinet.x + cabinet.width * along
      : cabinet.x + cabinet.width / 2;
    const foot_y = cabinet.y + cabinet.depth * 0.4 - top;
    paint_tube_post(ctx, x, foot_y, foot_y - rod_top, frame, 1.2, 0x9aa8a6);
    fill_rounded_rect(ctx, x - 1.6, foot_y - 0.8, 3.2, 1.2, 0.4, css(DARK_STEEL));
  }
  paint_prism(ctx, cabinet, top, CERAMIC, frame, {
    base: underside,
    radius: 1.2,
    lip: 1,
    seed: recipe.seed,
  });
  const face = face_of(cabinet, top, underside);
  if (!frame.isLowDetail) {
    ctx.fillStyle = css(SHADOW_INK, 0.18);
    ctx.fillRect(face.x + 1, face.y + face.height - 1.2, face.width - 2, 1.2);
  }
  const size = Math.min(face.width - 4, face.height - 2);
  const sign_x = view === "front" ? face.x + face.width / 2 - 1.5 : face.x + face.width / 2;
  paint_first_aid_sign(ctx, sign_x, face.y + face.height / 2, size);
  if (view === "front") {
    fill_rounded_rect(
      ctx,
      face.x + face.width - 3,
      face.y + face.height / 2 - 2.4,
      1.2,
      4.8,
      0.5,
      css(DARK_STEEL),
    );
    ctx.fillStyle = css(SHADOW_INK, 0.25);
    ctx.fillRect(face.x + 1.4, face.y + 1, 0.6, face.height - 2);
  } else if (view === "end") {
    paint_service_sliver(ctx, run_on(cabinet, side), top, tint(CERAMIC, 0.2), underside);
    const door_x = side === "west" ? cabinet.x + 0.4 : cabinet.x + cabinet.width - 1.8;
    ctx.fillStyle = css(DARK_STEEL);
    ctx.fillRect(door_x + 0.5, cabinet.y - top + cabinet.depth * 0.4, 0.9, 3);
  }
}

/**
 * Paints the faint, soft shadow a high-hung fitting casts on the floor below its floor line.
 *
 * @param ctx - The paint context.
 * @param ground - The fitting's ground rectangle.
 */
function paint_hung_shadow(ctx: PaintContext, ground: Ground): void {
  const cx = ground.x + ground.width / 2 + 2;
  const cy = ground.y + ground.depth / 2 + 1;
  const radius_x = ground.width / 2 + 1;
  const radius_y = Math.max(2, ground.depth / 2);
  fill_ellipse(
    ctx,
    cx,
    cy,
    radius_x,
    radius_y,
    radial_gradient(ctx, cx, cy, 0, radius_x, [
      [0, SHADOW_INK, 0.1],
      [1, SHADOW_INK, 0],
    ]),
  );
}

/**
 * Paints a green first-aid sign with a white cross.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param size - Side length.
 */
function paint_first_aid_sign(ctx: PaintContext, cx: number, cy: number, size: number): void {
  fill_rounded_rect(ctx, cx - size / 2, cy - size / 2, size, size, 1.2, css(FIRST_AID_GREEN));
  const arm = size * 0.22;
  const length = size * 0.68;
  fill_rounded_rect(ctx, cx - arm / 2, cy - length / 2, arm, length, 0.4, css(0xffffff));
  fill_rounded_rect(ctx, cx - length / 2, cy - arm / 2, length, arm, 0.4, css(0xffffff));
}

/**
 * Paints the locked cleaning cupboard: a tall painted-steel double-door cupboard with louvred
 * vents, recessed handles, a hasp and padlock and a "STAFF ONLY" plate.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_cupboard(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const height = 37;
  const run = make_run(box, rotation, { reach: 18, front_gap: 5, end_gap: 4, rise: height + 1 });
  cast_shadow(ctx, run.ground, height);
  paint_prism(ctx, run.ground, height, CUPBOARD_STEEL, frame, {
    radius: 1.4,
    seed: recipe.seed,
    lip: 0.9,
  });
  const face = face_of(run.ground, height);
  paint_cupboard_face(ctx, face, face_view(run.side), frame);
  paint_service_sliver(ctx, run, height, shade(CUPBOARD_STEEL, 0.4));
  paint_cupboard_top(ctx, run, height, box.y - OVERHANG, frame);
}

/**
 * Paints the stock stored on top of the cleaning cupboard: a carton and a jerrycan of floor
 * cleaner. Each is kept far enough south on the top that it stays inside the texture.
 *
 * @param ctx - The paint context.
 * @param run - The cupboard run.
 * @param height - The cupboard height.
 * @param texture_top - The texture's top edge.
 * @param frame - The paint frame.
 */
function paint_cupboard_top(
  ctx: PaintContext,
  run: Run,
  height: number,
  texture_top: number,
  frame: PaintFrame,
): void {
  const below_top = (ground: Ground, rise: number): Ground => {
    const min_y = texture_top + rise + 1.5;
    if (ground.y >= min_y) return ground;
    return { ...ground, y: min_y, depth: Math.max(2, ground_bottom(ground) - min_y) };
  };
  const carton = below_top(run.segment(0.1, 0.36, 4, run.reach - 3), height + 6);
  const can = below_top(run.segment(0.62, 0.78, 5, run.reach - 6), height + 9);
  const parts: Part[] = [
    {
      depth: ground_bottom(carton),
      draw: () => {
        paint_prism(ctx, carton, height + 6, 0xc49a6c, frame, { base: height, radius: 0.6 });
        const top_y = carton.y - height - 6;
        ctx.fillStyle = css(0x9c7448, 0.8);
        if (is_across(run)) {
          ctx.fillRect(carton.x + carton.width / 2 - 0.5, top_y, 1, carton.depth);
        } else {
          ctx.fillRect(carton.x, top_y + carton.depth / 2 - 0.5, carton.width, 1);
        }
      },
    },
    {
      depth: ground_bottom(can),
      draw: () => {
        paint_prism(ctx, can, height + 7, 0x2f7fb8, frame, { base: height, radius: 1.2 });
        const cap = lifted({ x: can.x + can.width * 0.3, y: can.y + can.depth / 2 }, height + 7);
        fill_rounded_rect(ctx, cap.x - 1, cap.y - 1.6, 2, 1.8, 0.4, css(CREAM));
      },
    },
  ];
  paint_parts(parts);
}

/**
 * Details the cupboard's visible face: the double doors with their vents, handles, hasp,
 * padlock and plate in front, or plain panels behind and at the ends.
 *
 * @param ctx - The paint context.
 * @param face - The cupboard's south face.
 * @param view - Which side of the cupboard faces the camera.
 * @param frame - The paint frame.
 */
function paint_cupboard_face(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  view: FaceView,
  frame: PaintFrame,
): void {
  ctx.fillStyle = css(RECESS, 0.5);
  ctx.fillRect(face.x + 1, face.y + face.height - 2.4, face.width - 2, 2);
  if (view !== "front") {
    ctx.fillStyle = css(shade(CUPBOARD_STEEL, 0.3), 0.6);
    ctx.fillRect(face.x + face.width / 2 - 0.4, face.y + 2, 0.8, face.height - 5);
    return;
  }
  const middle = face.x + face.width / 2;
  ctx.fillStyle = css(RECESS, 0.6);
  ctx.fillRect(middle - 0.5, face.y + 1.5, 1, face.height - 4);
  for (const door of [0, 1]) {
    const x = door === 0 ? face.x + 3 : middle + 3;
    const width = face.width / 2 - 6;
    for (const top of frame.isLowDetail ? [] : [face.y + 3, face.y + face.height - 9]) {
      for (let slat = 0; slat < 3; slat += 1) {
        ctx.fillStyle = css(shade(CUPBOARD_STEEL, 0.45));
        ctx.fillRect(x + width * 0.2, top + slat * 1.6, width * 0.6, 0.8);
      }
    }
    const handle_x = door === 0 ? middle - 3 : middle + 2;
    fill_rounded_rect(ctx, handle_x, face.y + face.height * 0.36, 1.2, 7, 0.5, css(DARK_STEEL));
  }
  fill_rounded_rect(ctx, middle - 3.4, face.y + face.height * 0.52, 6.8, 1.6, 0.5, css(0x9aa5a2));
  paint_padlock(ctx, middle, face.y + face.height * 0.52 + 3.6);
  const plate = {
    x: face.x + 4,
    y: face.y + face.height * 0.36,
    width: face.width / 2 - 10,
    height: 6,
  };
  fill_rounded_rect(ctx, plate.x, plate.y, plate.width, plate.height, 0.8, css(CREAM));
  label(ctx, "Staff only", plate.x + plate.width / 2, plate.y + plate.height / 2 + 0.2, {
    maxWidth: plate.width - 2,
    size: 5.5,
    colour: 0xb8452a,
    uppercase: true,
  });
  if (frame.isHighContrast) {
    const edge = edge_style(frame, CREAM);
    ctx.strokeStyle = edge.style;
    ctx.lineWidth = edge.width;
    ctx.strokeRect(plate.x, plate.y, plate.width, plate.height);
  }
}

/**
 * Paints the protected utility point: a grey powder-coated pedestal on a yellow-hatched safety
 * pad, with a hazard triangle on its visible face, a padlocked lid and a power lamp, guarded by
 * two short yellow bollards on its service side.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_utility_point(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const side = service_side(rotation);
  const foot: Point = { x: box.centreX, y: box.y + 26 };
  paint_safety_pad(ctx, box, frame);
  const pedestal = oriented_ground(foot, 18, 12, side);
  cast_shadow(ctx, pedestal, 24);
  paint_prism(ctx, pedestal, 24, UTILITY_GREY, frame, { radius: 1.6, seed: recipe.seed, lip: 0.8 });
  const lid_line = { x: pedestal.x + 1, y: pedestal.y - 24 + 2.5, width: pedestal.width - 2 };
  ctx.fillStyle = css(shade(UTILITY_GREY, 0.35), 0.8);
  ctx.fillRect(lid_line.x, lid_line.y, lid_line.width, 0.7);
  const face = face_of(pedestal, 24);
  const size = Math.min(face.width - 4, 10);
  paint_hazard_triangle(ctx, face.x + face.width / 2, face.y + 3 + size * 0.45, size);
  if (face_view(side) === "front") {
    paint_padlock(ctx, face.x + face.width - 3.6, face.y + 14);
    fill_circle(ctx, face.x + 3, face.y + 3, 0.9, css(0x5fdc6a));
    paint_glow(ctx, frame, face.x + 3, face.y + 3, 3, 0x5fdc6a, 0.6);
    ctx.fillStyle = css(RECESS, 0.5);
    for (let slot = 0; slot < 3; slot += 1)
      ctx.fillRect(face.x + 3, face.y + 15 + slot * 1.6, 7, 0.7);
  }
  const run = make_run(box, rotation, { reach: 40, front_gap: 4, end_gap: 5, rise: 14 });
  for (const along of [0, 1]) {
    const ground = run.at(along, 3);
    paint_cylinder(ctx, ground.x, ground.y, 2.4, 12, SAFETY_YELLOW, frame, {
      cap: tint(SAFETY_YELLOW, 0.3),
    });
    ctx.fillStyle = css(INK, 0.85);
    ctx.fillRect(ground.x - 2.4, ground.y - 8, 4.8, 1.4);
  }
}

/**
 * Paints the yellow-hatched safety pad on the floor around the utility point.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 */
function paint_safety_pad(ctx: PaintContext, box: Box, frame: PaintFrame): void {
  const pad = { x: box.x + 7, y: box.y + 13, width: box.width - 14, height: box.height - 18 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.x, pad.y, pad.width, pad.height);
  ctx.clip();
  ctx.fillStyle = css(SAFETY_YELLOW, 0.35);
  ctx.fillRect(pad.x, pad.y, pad.width, pad.height);
  if (!frame.isLowDetail) {
    for (let offset = -pad.height; offset < pad.width; offset += 5) {
      line(
        ctx,
        pad.x + offset,
        pad.y + pad.height,
        pad.x + offset + pad.height,
        pad.y,
        css(INK, 0.35),
        1.2,
        "butt",
      );
    }
  }
  ctx.restore();
  ctx.strokeStyle = css(SAFETY_YELLOW, 0.9);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(pad.x, pad.y, pad.width, pad.height);
}

/**
 * Paints a yellow hazard triangle with a dark border and a lightning bolt.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param size - Side length.
 */
function paint_hazard_triangle(ctx: PaintContext, cx: number, cy: number, size: number): void {
  const half = size / 2;
  const height = size * 0.88;
  fill_polygon(
    ctx,
    [
      [cx, cy - height / 2],
      [cx + half, cy + height / 2],
      [cx - half, cy + height / 2],
    ],
    css(INK),
  );
  fill_polygon(
    ctx,
    [
      [cx, cy - height / 2 + 1.5],
      [cx + half - 1.3, cy + height / 2 - 0.8],
      [cx - half + 1.3, cy + height / 2 - 0.8],
    ],
    css(SAFETY_YELLOW),
  );
  fill_polygon(
    ctx,
    [
      [cx + 0.6, cy - height * 0.18],
      [cx - 1, cy + height * 0.1],
      [cx + 0.2, cy + height * 0.1],
      [cx - 0.6, cy + height * 0.34],
      [cx + 1, cy + height * 0.02],
      [cx - 0.2, cy + height * 0.02],
    ],
    css(INK),
  );
}
