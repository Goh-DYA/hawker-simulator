/**
 * Tray and waste painters: the single- and dual-bay tray return stations, the dish-drop counter,
 * the recycling sorter, the covered food-waste and general-waste bins, the cleaning trolley bay
 * and the clean tray stack rack, as stainless hawker-centre infrastructure in the 3/4 view.
 *
 * Directional stations are laid out along their service edge with a {@link Run}, so they turn
 * with the placement rotation (their openings face the rotated south) while the light and the
 * shadows stay put; the round bins are symmetric apart from the pedal or push flap, which turns
 * to the service side. The branch comes from the ID-keyed style table in `render/art.ts` and the
 * tray-point variants from the motif.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style, type TrayWasteStyle } from "../../render/art";
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
  seeded,
  shade,
  stroke_rounded_rect,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import { DARK_STEEL, type Box } from "./shared";
import {
  cast_shadow,
  CREAM,
  edge_style,
  face_of,
  face_view,
  ground_bottom,
  INK,
  LEAF,
  lifted,
  make_run,
  MUSTARD,
  oriented_ground,
  paint_bottle,
  paint_cylinder,
  paint_header_board,
  paint_parts,
  paint_pictogram,
  paint_prism,
  paint_service_sliver,
  paint_tray_stack,
  paint_tube_post,
  RECESS,
  ROUND_SQUASH,
  service_side,
  STAINLESS,
  TEAL_STEEL,
  TRAY_BROWN,
  ZINC,
  type FaceView,
  type Ground,
  type Part,
  type Pictogram,
  type Point,
  type Run,
  type ServiceSide,
} from "./steelwork";

/** Height of a tray return cabinet. */
const RETURN_HEIGHT = 28;
/** Height of the dish-drop counter. */
const DROP_LIFT = 20;
/** Height of a recycling sorter cabinet. */
const SORTER_HEIGHT = 25;
/** Sanitised, lighter tray tone on the clean rack. */
const CLEAN_TRAY = 0xd2a878;
/** Grey-blue plastic of crockery tubs. */
const TUB = 0x5b7f9a;
/** White glazed crockery. */
const CROCKERY = 0xf3f1ea;
/** Safety yellow of floor markings, buckets and caution signs. */
const SAFETY_YELLOW = 0xe8c03a;
/** Charcoal plastic of bin bags and trolley frames. */
const CHARCOAL = 0x3c4446;
/** Blue-grey moulded plastic of the janitor trolley. */
const TROLLEY_GREY = 0x6d7c80;
/** Height of the janitor trolley's deck. */
const TROLLEY_DECK = 4.5;
/** Paper-stream blue of the recycling sorter. */
const PAPER_BLUE = 0x2f6fa3;

/** A tray-waste painter: paints one branch in the rotated footprint. */
type TrayWastePainter = (
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
) => void;

/** The painter of each tray-waste branch. */
const TRAY_WASTE_PAINTERS: Readonly<Record<TrayWasteStyle, TrayWastePainter>> = {
  "tray-point": paint_tray_point,
  recycling: paint_recycling_sorter,
  "food-waste": (ctx, box, _recipe, frame, rotation) => paint_bin(ctx, box, frame, rotation, true),
  bin: (ctx, box, _recipe, frame, rotation) => paint_bin(ctx, box, frame, rotation, false),
  trolley: paint_trolley_bay,
};

/**
 * Paints a tray return, dish drop, recycling sorter, waste bin, trolley bay or tray rack in its
 * rotated orientation.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box (already rotated).
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; openings face the rotated south.
 */
export function paint_tray_waste(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  TRAY_WASTE_PAINTERS[resolve_placeable_style("tray-waste", recipe)](
    ctx,
    box,
    recipe,
    frame,
    rotation,
  );
}

/**
 * Sends a tray point to its variant: the dish-drop counter, the clean tray rack or a one- or
 * two-bay return station.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_tray_point(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  if (recipe.motif.includes("dish-drop")) paint_dish_drop(ctx, box, recipe, frame, rotation);
  else if (recipe.motif.includes("tray-stack")) paint_clean_rack(ctx, box, recipe, frame, rotation);
  else paint_tray_return(ctx, box, recipe, frame, rotation, recipe.motif.includes("dual") ? 2 : 1);
}

/**
 * Paints a tray return station: a tall stainless cabinet whose front opens into one or two bays
 * of racked brown trays (the second bay takes bowls in tubs), under a green "RETURN TRAYS"
 * header board. Seen end-on, the racked trays and tubs show as edges sticking out of its service
 * side, a steel mullion splits the two bays, a pictogram plate marks the end and a blade on the
 * header board faces the camera.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 * @param bays - Number of return bays.
 */
function paint_tray_return(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
  bays: number,
): void {
  const run = make_run(box, rotation, {
    reach: 17,
    front_gap: 5,
    end_gap: 4,
    rise: RETURN_HEIGHT + 12,
  });
  const bay_icons: readonly Pictogram[] = bays > 1 ? ["tray-return", "bowl"] : ["tray-return"];
  cast_shadow(ctx, run.ground, RETURN_HEIGHT);
  paint_prism(ctx, run.ground, RETURN_HEIGHT, STAINLESS, frame, {
    is_steel: true,
    seed: recipe.seed,
    lip: 1,
  });
  const face = face_of(run.ground, RETURN_HEIGHT);
  const view = face_view(run.side);
  if (view === "front") paint_return_front(ctx, face, bays, frame, recipe.seed);
  else paint_plain_back(ctx, face, view);
  if (view === "end") paint_return_end(ctx, run, face, bay_icons, frame, recipe.seed);
  if (!frame.isLowDetail) {
    for (let bay = 0; bay < bays; bay += 1) {
      const slot = run.segment(bay / bays + 0.04, (bay + 1) / bays - 0.04, 2.5, 4.2);
      fill_rounded_rect(
        ctx,
        slot.x,
        slot.y - RETURN_HEIGHT,
        slot.width,
        slot.depth,
        0.6,
        css(RECESS, 0.35),
      );
    }
  }
  paint_header_board(
    ctx,
    run,
    run.reach - 2.6,
    RETURN_HEIGHT,
    RETURN_HEIGHT + 10,
    LEAF,
    "Return trays",
    bay_icons,
    frame,
  );
}

/**
 * Details a return station seen end-on: a pictogram plate on its end face, a dark opening and
 * what is racked in it along the service side of each bay (brown tray edges, or grey tubs of
 * white bowls), and a steel mullion between two bays.
 *
 * @param ctx - The paint context.
 * @param run - The station run (west or east).
 * @param face - The cabinet's visible end face.
 * @param bay_icons - The pictogram of each bay, in order along the run.
 * @param frame - The paint frame.
 * @param seed - Seed for the tray offsets.
 */
function paint_return_end(
  ctx: PaintContext,
  run: Run,
  face: { x: number; y: number; width: number; height: number },
  bay_icons: readonly Pictogram[],
  frame: PaintFrame,
  seed: number,
): void {
  const bays = bay_icons.length;
  const end_icon = (run.side === "west" ? bay_icons[bays - 1] : bay_icons[0]) ?? "tray-return";
  const plate = { x: face.x + face.width / 2 - 6, y: face.y + 3, width: 12, height: 9 };
  fill_rounded_rect(ctx, plate.x, plate.y, plate.width, plate.height, 1.2, css(LEAF));
  paint_pictogram(ctx, end_icon, plate.x + plate.width / 2, plate.y + plate.height / 2, 7.2);
  const plate_edge = edge_style(frame, LEAF);
  stroke_rounded_rect(
    ctx,
    plate.x,
    plate.y,
    plate.width,
    plate.height,
    1.2,
    plate_edge.style,
    plate_edge.width,
  );
  const edge_x = run.side === "west" ? run.ground.x : run.ground.x + run.ground.width;
  const outward = run.side === "west" ? -1 : 1;
  for (let bay = 0; bay < bays; bay += 1) {
    const opening = run.segment(bay / bays + 0.03, (bay + 1) / bays - 0.03, 0, 1.8);
    ctx.fillStyle = css(RECESS, 0.9);
    ctx.fillRect(
      outward < 0 ? edge_x : edge_x - 1.8,
      opening.y - RETURN_HEIGHT + 3,
      1.8,
      opening.depth + RETURN_HEIGHT - 5.5,
    );
  }
  const next = seeded(seed);
  const north_first = bay_icons.map((_icon, bay) => bay);
  if (run.side === "east") north_first.reverse();
  north_first.forEach((bay, order) => {
    if (order > 0) {
      const split = run.at((run.side === "east" ? bay + 1 : bay) / bays, 0);
      const fin = {
        x: outward < 0 ? edge_x - 4.2 : edge_x,
        y: split.y - 0.9,
        width: 4.2,
        depth: 1.8,
      };
      paint_prism(ctx, fin, RETURN_HEIGHT - 1, STAINLESS, frame, { radius: 0.5, lip: 1 });
    }
    const start = run.at(bay / bays + 0.05, 0).y;
    const end = run.at((bay + 1) / bays - 0.05, 0).y;
    const top = Math.min(start, end);
    const span = Math.abs(end - start);
    const parts: Part[] = [];
    if (bay_icons[bay] === "bowl") {
      for (const height of [3, 13]) {
        const width = 3.6;
        const ground = {
          x: outward < 0 ? edge_x - width : edge_x,
          y: top + 1,
          width,
          depth: span - 2,
        };
        parts.push({
          depth: ground_bottom(ground) + height,
          draw: () => paint_tub_edge(ctx, ground, height, frame),
        });
      }
    } else {
      const count = Math.max(1, Math.round(span / 15));
      const slot = span / count;
      for (const height of [4, 10, 16, 22]) {
        for (let index = 0; index < count; index += 1) {
          const reach = 2.4 + next() * 2;
          const ground = {
            x: outward < 0 ? edge_x - reach : edge_x,
            y: top + index * slot + 1.5,
            width: reach,
            depth: slot - 3,
          };
          parts.push({
            depth: ground_bottom(ground) + height,
            draw: () => paint_tray_edge(ctx, ground, height, outward),
          });
        }
      }
    }
    paint_parts(parts);
  });
}

/**
 * Paints the end of a racked tray sticking out of a return opening: a thin brown slab with a lit
 * outer rim and a shaded front lip.
 *
 * @param ctx - The paint context.
 * @param ground - The protruding part's ground rectangle.
 * @param height - Height of the runner it rests on.
 * @param outward - -1 when it sticks out to the west, 1 to the east.
 */
function paint_tray_edge(ctx: PaintContext, ground: Ground, height: number, outward: number): void {
  const thickness = 1.5;
  const top_y = ground.y - height - thickness;
  fill_rounded_rect(
    ctx,
    ground.x,
    top_y,
    ground.width,
    ground.depth,
    0.5,
    css(tint(TRAY_BROWN, 0.12)),
  );
  ctx.fillStyle = css(shade(TRAY_BROWN, 0.35));
  ctx.fillRect(ground.x, top_y + ground.depth, ground.width, thickness);
  const rim_x = outward < 0 ? ground.x : ground.x + ground.width - 0.7;
  ctx.fillStyle = css(tint(TRAY_BROWN, 0.45));
  ctx.fillRect(rim_x, top_y, 0.7, ground.depth);
  ctx.fillStyle = css(shade(TRAY_BROWN, 0.5), 0.8);
  ctx.fillRect(ground.x, top_y, ground.width, 0.6);
}

/**
 * Paints the end of a grey crockery tub sticking out of a return opening, with the white rims of
 * the bowls stacked in it.
 *
 * @param ctx - The paint context.
 * @param ground - The protruding part's ground rectangle.
 * @param height - Height of the shelf it rests on.
 * @param frame - The paint frame.
 */
function paint_tub_edge(
  ctx: PaintContext,
  ground: Ground,
  height: number,
  frame: PaintFrame,
): void {
  const top = height + 6;
  paint_prism(ctx, ground, top, TUB, frame, { base: height, radius: 0.8, lip: 0.4 });
  const cx = ground.x + ground.width / 2;
  for (let y = ground.y + 2.4; y < ground_bottom(ground) - 1.6; y += 3.4) {
    fill_ellipse(ctx, cx, y - top, ground.width / 2 + 0.2, 1.2, css(CROCKERY));
    fill_ellipse(ctx, cx, y - top + 0.3, ground.width / 2 - 0.6, 0.5, css(shade(CROCKERY, 0.25)));
  }
}

/**
 * Details a return station's front: a label plate and an opening per bay, trays on runners in
 * the first bay and tubs of bowls in a second.
 *
 * @param ctx - The paint context.
 * @param face - The cabinet's south face.
 * @param bays - Number of bays.
 * @param frame - The paint frame.
 * @param seed - Seed for the stack offsets.
 */
function paint_return_front(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  bays: number,
  frame: PaintFrame,
  seed: number,
): void {
  const gap = 4;
  const bay_width = (face.width - gap * (bays + 1)) / bays;
  for (let bay = 0; bay < bays; bay += 1) {
    const x = face.x + gap + bay * (bay_width + gap);
    const opening = { x, y: face.y + 7.5, width: bay_width, height: face.height - 10.5 };
    if (bays > 1) {
      fill_rounded_rect(
        ctx,
        x + bay_width * 0.25,
        face.y + 2,
        bay_width * 0.5,
        4.6,
        0.8,
        css(CREAM),
      );
      label(ctx, bay === 0 ? "Trays" : "Bowls", x + bay_width / 2, face.y + 4.4, {
        maxWidth: bay_width * 0.5 - 1,
        size: 5,
        colour: INK,
        uppercase: true,
      });
    } else {
      paint_tray_arrow(ctx, x + bay_width / 2, face.y + 4.2);
    }
    fill_rounded_rect(
      ctx,
      opening.x,
      opening.y,
      opening.width,
      opening.height,
      1.4,
      linear_gradient(ctx, 0, opening.y, 0, opening.y + opening.height, [
        [0, 0x0f1817],
        [1, RECESS],
      ]),
    );
    if (bay === 1) paint_bowl_tubs(ctx, opening);
    else paint_tray_runners(ctx, opening, frame, seed + bay);
    const edge = edge_style(frame, STAINLESS);
    fill_rounded_rect(
      ctx,
      opening.x - 0.6,
      opening.y + opening.height - 1.2,
      opening.width + 1.2,
      1.8,
      0.6,
      css(tint(STAINLESS, 0.3)),
    );
    ctx.strokeStyle = edge.style;
    ctx.lineWidth = edge.width;
    ctx.strokeRect(opening.x, opening.y, opening.width, opening.height);
  }
}

/**
 * Paints the arrow-into-slot pictogram above a single return bay.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 */
function paint_tray_arrow(ctx: PaintContext, cx: number, cy: number): void {
  fill_rounded_rect(ctx, cx - 8, cy - 2.6, 16, 5.2, 1, css(LEAF));
  line(ctx, cx - 4.5, cy, cx + 2.5, cy, css(CREAM), 1.2);
  fill_polygon(
    ctx,
    [
      [cx + 2, cy - 2],
      [cx + 5, cy],
      [cx + 2, cy + 2],
    ],
    css(CREAM),
  );
}

/**
 * Paints racked brown trays on steel runners inside a return opening, their front edges lit.
 *
 * @param ctx - The paint context.
 * @param opening - The opening rectangle.
 * @param frame - The paint frame.
 * @param seed - Seed for the stack offsets.
 */
function paint_tray_runners(
  ctx: PaintContext,
  opening: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
  seed: number,
): void {
  const shelves = 3;
  const step = opening.height / shelves;
  for (let shelf = 0; shelf < shelves; shelf += 1) {
    const base_y = opening.y + step * (shelf + 1) - 0.6;
    ctx.fillStyle = css(DARK_STEEL);
    ctx.fillRect(opening.x + 0.5, base_y, opening.width - 1, 0.8);
    const count = frame.isLowDetail ? 1 : shelf === 0 ? 1 : 2;
    paint_tray_stack(
      ctx,
      opening.x + 2,
      base_y,
      opening.width - 4,
      count,
      TRAY_BROWN,
      seed + shelf,
    );
    if (shelf === 0 && !frame.isLowDetail) {
      const bowl_x = opening.x + opening.width * 0.3;
      fill_ellipse(ctx, bowl_x, base_y - 3.2, 3.2, 1.3, css(CROCKERY));
      fill_rounded_rect(ctx, bowl_x - 3, base_y - 3.2, 6, 1.2, 0.5, css(shade(CROCKERY, 0.15)));
      fill_ellipse(ctx, opening.x + opening.width * 0.62, base_y - 2.6, 2, 0.8, css(CROCKERY));
    }
  }
}

/**
 * Paints grey crockery tubs of stacked white bowls inside a return opening.
 *
 * @param ctx - The paint context.
 * @param opening - The opening rectangle.
 */
function paint_bowl_tubs(
  ctx: PaintContext,
  opening: { x: number; y: number; width: number; height: number },
): void {
  const tub_height = opening.height * 0.42;
  for (let row = 0; row < 2; row += 1) {
    const y = opening.y + opening.height - (row + 1) * (tub_height + 1);
    fill_rounded_rect(ctx, opening.x + 2, y, opening.width - 4, tub_height, 1, css(TUB));
    for (let index = 0; index < 3; index += 1) {
      const cx = opening.x + 2 + ((index + 0.5) * (opening.width - 4)) / 3;
      fill_ellipse(ctx, cx, y + 0.4, (opening.width - 4) / 7, 1.2, css(CROCKERY));
      fill_ellipse(ctx, cx, y + 0.2, (opening.width - 4) / 10, 0.6, css(shade(CROCKERY, 0.2)));
    }
    ctx.fillStyle = css(tint(TUB, 0.3));
    ctx.fillRect(opening.x + 2, y + 1.4, opening.width - 4, 0.6);
  }
}

/**
 * Details a cabinet's plain back or end: two panel seams and a row of rivets.
 *
 * @param ctx - The paint context.
 * @param face - The face rectangle.
 * @param view - Which side of the cabinet faces the camera.
 */
function paint_plain_back(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  view: FaceView,
): void {
  const seams = view === "back" ? 3 : 1;
  for (let index = 1; index <= seams; index += 1) {
    const x = face.x + (face.width * index) / (seams + 1);
    ctx.fillStyle = css(RECESS, 0.35);
    ctx.fillRect(x - 0.4, face.y + 2, 0.8, face.height - 4);
  }
  ctx.fillStyle = css(RECESS, 0.45);
  ctx.fillRect(face.x + 1, face.y + face.height - 2.6, face.width - 2, 2.2);
}

/**
 * Paints the dish-drop counter: a staffed-height steel counter with cupboard doors, a sunken
 * rinse basin with a coiled pre-rinse spray, three crockery tubs for bowls, plates and cutlery,
 * and a vermilion "DISH DROP" header board.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_dish_drop(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 24, front_gap: 4, end_gap: 3, rise: 36 });
  cast_shadow(ctx, run.ground, DROP_LIFT);
  paint_prism(ctx, run.ground, DROP_LIFT, STAINLESS, frame, {
    is_steel: true,
    seed: recipe.seed,
    lip: 1,
  });
  paint_plain_back(
    ctx,
    face_of(run.ground, DROP_LIFT),
    face_view(run.side) === "end" ? "end" : "back",
  );
  paint_service_sliver(ctx, run, DROP_LIFT, TEAL_STEEL);
  paint_rinse_basin(ctx, run, frame);
  const parts: Part[] = [];
  const kinds = ["bowls", "plates", "cutlery"] as const;
  kinds.forEach((kind, index) => {
    const tub = run.segment(0.36 + index * 0.21, 0.54 + index * 0.21, 3, run.reach - 6);
    parts.push({
      depth: ground_bottom(tub),
      draw: () => paint_crockery_tub(ctx, tub, kind, frame, recipe.seed + index),
    });
  });
  const upstand = run.segment(0.02, 0.98, run.reach - 2.4, run.reach - 0.4);
  parts.push({
    depth: ground_bottom(upstand),
    draw: () =>
      paint_prism(ctx, upstand, DROP_LIFT + 4, STAINLESS, frame, {
        base: DROP_LIFT,
        is_steel: true,
      }),
  });
  parts.push({
    depth: run.at(0.17, run.reach - 4).y,
    draw: () => paint_spray_tap(ctx, run, frame),
  });
  paint_parts(parts);
  paint_header_board(
    ctx,
    run,
    run.reach - 2.6,
    DROP_LIFT + 4,
    DROP_LIFT + 14,
    0xb8452a,
    "Dish drop",
    ["dish-drop"],
    frame,
  );
}

/**
 * Paints the dish-drop's sunken rinse basin with a film of grey water.
 *
 * @param ctx - The paint context.
 * @param run - The counter run.
 * @param frame - The paint frame.
 */
function paint_rinse_basin(ctx: PaintContext, run: Run, frame: PaintFrame): void {
  const basin = run.segment(0.04, 0.32, 3, run.reach - 5);
  const top_y = basin.y - DROP_LIFT;
  fill_rounded_rect(ctx, basin.x, top_y, basin.width, basin.depth, 1.6, css(shade(STAINLESS, 0.3)));
  fill_rounded_rect(
    ctx,
    basin.x + 1.2,
    top_y + 1.2,
    basin.width - 2.4,
    basin.depth - 2.4,
    1.2,
    linear_gradient(ctx, 0, top_y, 0, top_y + basin.depth, [
      [0, 0x3d5a63],
      [1, 0x7f9fa6],
    ]),
  );
  if (!frame.isLowDetail) {
    fill_ellipse(
      ctx,
      basin.x + basin.width * 0.35,
      top_y + basin.depth * 0.45,
      basin.width * 0.18,
      0.8,
      css(0xffffff, 0.35),
    );
  }
  fill_circle(ctx, basin.x + basin.width / 2, top_y + basin.depth / 2 + 1, 1, css(RECESS));
}

/**
 * Paints the coiled pre-rinse spray tap rising behind the basin.
 *
 * @param ctx - The paint context.
 * @param run - The counter run.
 * @param frame - The paint frame.
 */
function paint_spray_tap(ctx: PaintContext, run: Run, frame: PaintFrame): void {
  const foot = lifted(run.at(0.17, run.reach - 4), DROP_LIFT);
  paint_tube_post(ctx, foot.x, foot.y, 15, frame, 1.6);
  if (!frame.isLowDetail) {
    for (let coil = 0; coil < 5; coil += 1) {
      fill_ellipse(ctx, foot.x, foot.y - 5 - coil * 1.6, 1.8, 0.6, css(tint(STAINLESS, 0.2)));
    }
  }
  const head = lifted(run.at(0.17, 9), DROP_LIFT + 9);
  line(ctx, foot.x, foot.y - 15, head.x, head.y, css(STAINLESS), 1.2);
  fill_rounded_rect(ctx, head.x - 1.2, head.y - 1, 2.4, 3.4, 0.6, css(DARK_STEEL));
}

/**
 * Paints a grey crockery tub holding stacked bowls, plates on edge or loose cutlery.
 *
 * @param ctx - The paint context.
 * @param tub - The tub's ground rectangle.
 * @param kind - What the tub holds.
 * @param frame - The paint frame.
 * @param seed - Seed for the cutlery jumble.
 */
function paint_crockery_tub(
  ctx: PaintContext,
  tub: Ground,
  kind: "bowls" | "plates" | "cutlery",
  frame: PaintFrame,
  seed: number,
): void {
  const top = DROP_LIFT + 5;
  paint_prism(ctx, tub, top, TUB, frame, { base: DROP_LIFT, radius: 1.2 });
  const inner = {
    x: tub.x + 1.2,
    y: tub.y - top + 1.2,
    width: tub.width - 2.4,
    height: tub.depth - 2.4,
  };
  fill_rounded_rect(ctx, inner.x, inner.y, inner.width, inner.height, 0.8, css(shade(TUB, 0.35)));
  const cx = inner.x + inner.width / 2;
  const cy = inner.y + inner.height / 2;
  if (kind === "bowls") {
    for (const [dx, dy] of [
      [-0.25, -0.15],
      [0.22, 0.1],
      [-0.05, 0.25],
    ] as const) {
      for (let stack = 0; stack < 3; stack += 1) {
        fill_ellipse(
          ctx,
          cx + dx * inner.width,
          cy + dy * inner.height - stack * 1.3,
          3.6,
          2,
          css(shade(CROCKERY, stack * 0.05)),
        );
      }
      fill_ellipse(
        ctx,
        cx + dx * inner.width,
        cy + dy * inner.height - 2.6,
        2.2,
        1.1,
        css(shade(CROCKERY, 0.22)),
      );
    }
  } else if (kind === "plates") {
    for (let index = 0; index < 6; index += 1) {
      const x = inner.x + 2 + (index / 5) * (inner.width - 4);
      fill_ellipse(ctx, x, cy - 2, 1.2, 3.6, css(shade(CROCKERY, (index % 2) * 0.08)));
    }
  } else {
    const next = seeded(seed);
    const count = frame.isLowDetail ? 5 : 11;
    for (let index = 0; index < count; index += 1) {
      const x = inner.x + 1.5 + next() * (inner.width - 3);
      const y = inner.y + 1.5 + next() * (inner.height - 3);
      const angle = next() * Math.PI;
      line(
        ctx,
        x,
        y,
        x + Math.cos(angle) * 4,
        y + Math.sin(angle) * 2.2,
        css(tint(STAINLESS, next() * 0.4)),
        0.8,
      );
    }
  }
}

/**
 * Paints the recycling sorter: three colour-coded cabinets side by side for cans, paper and
 * general waste, each with its own opening on top (a round hole, a slot and a push flap), a
 * labelled band and a pictogram on its front.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_recycling_sorter(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, {
    reach: 22,
    front_gap: 4,
    end_gap: 4,
    rise: SORTER_HEIGHT + 2,
  });
  cast_shadow(ctx, run.ground, SORTER_HEIGHT);
  const streams = [
    { colour: MUSTARD, text: "Cans", opening: "hole" },
    { colour: PAPER_BLUE, text: "Paper", opening: "slot" },
    { colour: 0x6b7774, text: "Waste", opening: "flap" },
  ] as const;
  const parts: Part[] = streams.map((stream, index) => {
    const cabinet = run.segment(index / 3 + 0.005, (index + 1) / 3 - 0.005, 0, run.reach);
    return {
      depth: ground_bottom(cabinet),
      draw: () => {
        paint_prism(ctx, cabinet, SORTER_HEIGHT, stream.colour, frame, {
          radius: 2,
          lip: 0.7,
          seed: recipe.seed + index,
        });
        paint_sorter_opening(ctx, run, index, stream.opening);
        const face = face_of(cabinet, SORTER_HEIGHT);
        if (face_view(run.side) === "front") {
          paint_sorter_front(
            ctx,
            face,
            stream.text,
            frame.isLowDetail ? undefined : stream.opening,
          );
        } else paint_plain_back(ctx, face, "end");
      },
    };
  });
  paint_parts(parts);
  paint_service_sliver(ctx, run, SORTER_HEIGHT, CREAM);
}

/**
 * Paints a sorter cabinet's opening on its top, centred in its third of the run.
 *
 * @param ctx - The paint context.
 * @param run - The sorter run.
 * @param index - Which third of the run.
 * @param opening - The opening shape.
 */
function paint_sorter_opening(
  ctx: PaintContext,
  run: Run,
  index: number,
  opening: "hole" | "slot" | "flap",
): void {
  const centre = lifted(run.at((index + 0.5) / 3, run.reach * 0.45), SORTER_HEIGHT);
  if (opening === "hole") {
    fill_ellipse(ctx, centre.x, centre.y, 5, 3, css(tint(STAINLESS, 0.1)));
    fill_ellipse(ctx, centre.x, centre.y + 0.3, 3.8, 2.2, css(RECESS));
    return;
  }
  const slot = run.segment(
    (index + 0.18) / 3,
    (index + 0.82) / 3,
    run.reach * 0.45 - 1.4,
    run.reach * 0.45 + 1.4,
  );
  if (opening === "slot") {
    fill_rounded_rect(ctx, slot.x, slot.y - SORTER_HEIGHT, slot.width, slot.depth, 1, css(RECESS));
    return;
  }
  const flap = run.segment((index + 0.25) / 3, (index + 0.75) / 3, 4, run.reach - 5);
  fill_rounded_rect(
    ctx,
    flap.x,
    flap.y - SORTER_HEIGHT,
    flap.width,
    flap.depth,
    1.2,
    css(shade(0x6b7774, 0.35)),
  );
  fill_rounded_rect(
    ctx,
    flap.x + 1,
    flap.y - SORTER_HEIGHT + 1,
    flap.width - 2,
    flap.depth - 2,
    1,
    css(tint(0x6b7774, 0.15)),
  );
}

/**
 * Details a sorter cabinet's front: a white label band with the stream name and a pictogram.
 *
 * @param ctx - The paint context.
 * @param face - The cabinet's south face.
 * @param text - The stream name.
 * @param opening - The opening shape, which picks the pictogram; none in the low-detail frame.
 */
function paint_sorter_front(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  text: string,
  opening: "hole" | "slot" | "flap" | undefined,
): void {
  fill_rounded_rect(ctx, face.x + 2, face.y + 2, face.width - 4, 6, 1, css(CREAM));
  label(ctx, text, face.x + face.width / 2, face.y + 5.1, {
    maxWidth: face.width - 8,
    size: 6,
    colour: INK,
    uppercase: true,
  });
  const cx = face.x + face.width / 2;
  const cy = face.y + 14;
  const ink = css(CREAM, 0.95);
  if (opening === "hole") {
    fill_rounded_rect(ctx, cx - 2.6, cy - 4, 5.2, 8, 1.2, ink);
    ctx.fillStyle = css(MUSTARD);
    ctx.fillRect(cx - 2.6, cy - 1, 5.2, 2);
  } else if (opening === "slot") {
    fill_rounded_rect(ctx, cx - 3.4, cy - 4, 6.8, 8, 0.6, ink);
    for (let row = 0; row < 3; row += 1) {
      ctx.fillStyle = css(PAPER_BLUE);
      ctx.fillRect(cx - 2.2, cy - 2.4 + row * 2, 4.4, 0.7);
    }
  } else if (opening === "flap") {
    fill_polygon(
      ctx,
      [
        [cx - 3.2, cy - 3],
        [cx + 3.2, cy - 3],
        [cx + 2.4, cy + 4],
        [cx - 2.4, cy + 4],
      ],
      ink,
    );
    ctx.fillStyle = css(CREAM);
    ctx.fillRect(cx - 4, cy - 4.6, 8, 1);
  }
  ctx.fillStyle = css(RECESS, 0.4);
  ctx.fillRect(face.x + 1, face.y + face.height - 2.4, face.width - 2, 2);
}

/**
 * Paints a covered round bin: the food-waste bin is deep green with a sealed flat lid, a leaf
 * label and a foot pedal; the general-waste bin is brushed steel with a teal push-flap dome. The
 * pedal and the flap turn to the service side.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 * @param is_food - True for the food-waste bin.
 */
function paint_bin(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  rotation: Rotation,
  is_food: boolean,
): void {
  const side = service_side(rotation);
  const radius = is_food ? 10.5 : 11;
  const height = is_food ? 21 : 22;
  const foot: Point = { x: box.centreX, y: box.y + 31 };
  const radius_y = radius * ROUND_SQUASH;
  cast_shadow(
    ctx,
    { x: foot.x - radius, y: foot.y - radius_y, width: radius * 2, depth: radius_y * 2 },
    height,
    true,
  );
  if (is_food && side === "north") paint_pedal(ctx, foot, radius, side);
  const body = is_food ? 0x3e6b4a : STAINLESS;
  paint_cylinder(ctx, foot.x, foot.y, radius, height, body, frame, { cap: shade(body, 0.3) });
  if (!frame.isLowDetail) paint_bin_ribs(ctx, foot, radius, height, body);
  paint_bin_label(ctx, foot, radius, height, is_food);
  if (is_food) {
    paint_cylinder(ctx, foot.x, foot.y - height, radius + 0.8, 2.6, 0x2f5238, frame, {
      cap: 0x3a6344,
    });
    line(
      ctx,
      foot.x - 3.5,
      foot.y - height - 3.6,
      foot.x + 3.5,
      foot.y - height - 3.6,
      css(0x203a28),
      1.6,
    );
    fill_ellipse(ctx, foot.x - 2, foot.y - height - 4.4, 3, 1, css(0xffffff, 0.18));
    if (side !== "north") paint_pedal(ctx, foot, radius, side);
  } else {
    paint_push_dome(ctx, foot, radius, height, side, frame);
  }
}

/**
 * Paints faint vertical ribs on a bin body.
 *
 * @param ctx - The paint context.
 * @param foot - The bin's ground centre.
 * @param radius - The bin radius.
 * @param height - The body height.
 * @param body - The body colour.
 */
function paint_bin_ribs(
  ctx: PaintContext,
  foot: Point,
  radius: number,
  height: number,
  body: number,
): void {
  for (const offset of [-0.7, -0.35, 0.35, 0.7]) {
    ctx.fillStyle = css(shade(body, 0.3), 0.25);
    ctx.fillRect(foot.x + offset * radius - 0.3, foot.y - height + 2, 0.6, height - 3);
  }
}

/**
 * Paints the label band around a bin: "FOOD" with a leaf on cream, or "WASTE" on teal.
 *
 * @param ctx - The paint context.
 * @param foot - The bin's ground centre.
 * @param radius - The bin radius.
 * @param height - The body height.
 * @param is_food - True for the food-waste label.
 */
function paint_bin_label(
  ctx: PaintContext,
  foot: Point,
  radius: number,
  height: number,
  is_food: boolean,
): void {
  const y = foot.y - height * 0.55;
  const width = radius * 1.7;
  fill_rounded_rect(
    ctx,
    foot.x - width / 2,
    y - 3.6,
    width,
    7.2,
    1.2,
    css(is_food ? CREAM : TEAL_STEEL),
  );
  if (is_food) {
    fill_ellipse(ctx, foot.x, y - 5.6, 2.2, 1.2, css(0x7fb069));
    label(ctx, "Food", foot.x, y + 0.2, {
      maxWidth: width - 2,
      size: 6.5,
      colour: 0x2f5238,
      uppercase: true,
    });
  } else {
    label(ctx, "Waste", foot.x, y + 0.2, {
      maxWidth: width - 2,
      size: 6.5,
      colour: CREAM,
      uppercase: true,
    });
  }
}

/**
 * Paints the steel foot pedal of the food-waste bin on its service side.
 *
 * @param ctx - The paint context.
 * @param foot - The bin's ground centre.
 * @param radius - The bin radius.
 * @param side - The service side.
 */
function paint_pedal(ctx: PaintContext, foot: Point, radius: number, side: ServiceSide): void {
  const pedal = css(tint(STAINLESS, 0.1));
  if (side === "south") {
    fill_rounded_rect(ctx, foot.x - 4, foot.y + radius * ROUND_SQUASH - 1.4, 8, 2.6, 0.8, pedal);
  } else if (side === "north") {
    fill_rounded_rect(ctx, foot.x - 3, foot.y - radius * ROUND_SQUASH - 1.4, 6, 2, 0.8, pedal);
  } else {
    const x = side === "west" ? foot.x - radius - 3.2 : foot.x + radius - 0.6;
    fill_rounded_rect(ctx, x, foot.y - 1.6, 3.8, 2.4, 0.8, pedal);
  }
}

/**
 * Paints the general-waste bin's teal push dome with its swing flap facing the service side.
 *
 * @param ctx - The paint context.
 * @param foot - The bin's ground centre.
 * @param radius - The bin radius.
 * @param height - The body height.
 * @param side - The service side.
 * @param frame - The paint frame.
 */
function paint_push_dome(
  ctx: PaintContext,
  foot: Point,
  radius: number,
  height: number,
  side: ServiceSide,
  frame: PaintFrame,
): void {
  const top = foot.y - height;
  const radius_y = radius * ROUND_SQUASH;
  ctx.beginPath();
  ctx.ellipse(foot.x, top, radius + 0.6, radius_y + 0.4, 0, 0, Math.PI, false);
  ctx.ellipse(foot.x, top, radius + 0.6, radius * 0.95, 0, Math.PI, Math.PI * 2, false);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(
    ctx,
    foot.x - radius,
    top - radius,
    foot.x + radius,
    top + radius_y,
    [
      [0, tint(TEAL_STEEL, 0.35)],
      [0.5, TEAL_STEEL],
      [1, shade(TEAL_STEEL, 0.35)],
    ],
  );
  ctx.fill();
  const edge = edge_style(frame, TEAL_STEEL);
  ctx.strokeStyle = edge.style;
  ctx.lineWidth = edge.width;
  ctx.stroke();
  fill_ellipse(
    ctx,
    foot.x - radius * 0.35,
    top - radius * 0.55,
    radius * 0.3,
    radius * 0.14,
    css(0xffffff, 0.3),
  );
  if (side === "south") {
    fill_rounded_rect(
      ctx,
      foot.x - radius * 0.5,
      top - radius * 0.3,
      radius,
      radius * 0.42,
      1.6,
      css(RECESS),
    );
    fill_rounded_rect(
      ctx,
      foot.x - radius * 0.5,
      top - radius * 0.3,
      radius,
      1,
      0.5,
      css(tint(TEAL_STEEL, 0.4)),
    );
  } else if (side === "north") {
    line(
      ctx,
      foot.x - radius * 0.5,
      top - radius * 0.75,
      foot.x + radius * 0.5,
      top - radius * 0.75,
      css(shade(TEAL_STEEL, 0.4)),
      0.8,
    );
  } else {
    const x = side === "west" ? foot.x - radius * 0.95 : foot.x + radius * 0.55;
    fill_rounded_rect(ctx, x, top - radius * 0.45, radius * 0.4, radius * 0.5, 1.2, css(RECESS));
  }
}

/**
 * Paints the cleaning trolley bay: a yellow-lined floor bay against an open zinc tool rail hung
 * with a broom, a dustpan and a squeegee, holding a grey janitor trolley (a bin bag in its hoop,
 * a caddy with spray bottles and refills, and a yellow mop bucket with its wringer and mop),
 * beside a folded caution sign.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_trolley_bay(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 26, front_gap: 3, end_gap: 3, rise: 35 });
  paint_bay_marking(ctx, run, frame);
  const rail = run.segment(0, 1, run.reach - 2, run.reach - 0.5);
  const trolley = trolley_parts(ctx, run, frame);
  paint_parts([
    { depth: ground_bottom(rail), draw: () => paint_tool_rail(ctx, run, rail, frame, recipe.seed) },
    trolley.chassis,
    ...trolley.riders,
    { depth: run.at(0.87, 8).y, draw: () => paint_caution_sign(ctx, run, frame) },
  ]);
}

/**
 * Paints the yellow bay lines on the floor around the trolley bay.
 *
 * @param ctx - The paint context.
 * @param run - The bay run.
 * @param frame - The paint frame.
 */
function paint_bay_marking(ctx: PaintContext, run: Run, frame: PaintFrame): void {
  const bay = run.segment(0, 1, 0, run.reach);
  ctx.save();
  ctx.strokeStyle = css(SAFETY_YELLOW, frame.isHighContrast ? 1 : 0.85);
  ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 2]);
  ctx.strokeRect(bay.x + 1, bay.y + 1, bay.width - 2, bay.depth - 2);
  ctx.restore();
}

/**
 * Paints the trolley bay's open tool rail along its back: two posts, a kick rail and a top rail
 * hung with a broom, a dustpan and a squeegee, open enough to see the trolley through.
 *
 * @param ctx - The paint context.
 * @param run - The bay run.
 * @param rail - The rail's ground rectangle.
 * @param frame - The paint frame.
 * @param seed - Seed for the steel brushing.
 */
function paint_tool_rail(
  ctx: PaintContext,
  run: Run,
  rail: Ground,
  frame: PaintFrame,
  seed: number,
): void {
  for (const along of [0.01, 0.99]) {
    const foot = run.at(along, run.reach - 1.2);
    paint_tube_post(ctx, foot.x, foot.y, 30, frame, 2.4, ZINC);
  }
  paint_prism(ctx, rail, 6, ZINC, frame, { radius: 0.8, is_steel: true, seed });
  paint_prism(ctx, rail, 29, ZINC, frame, { base: 26, radius: 0.8, is_steel: true });
  const hooks = [
    { along: 0.12, kind: "broom" },
    { along: 0.24, kind: "pan" },
    { along: 0.84, kind: "squeegee" },
  ] as const;
  for (const hook of hooks) {
    const top = lifted(run.at(hook.along, run.reach - 3), 26);
    if (hook.kind === "pan") {
      line(ctx, top.x, top.y, top.x, top.y + 2, css(0x3d6fa8), 1);
      fill_rounded_rect(ctx, top.x - 3.4, top.y + 2, 6.8, 6, 1.2, css(0x3d6fa8));
      continue;
    }
    line(ctx, top.x, top.y, top.x, top.y + 17, css(0x8a6241), 1.3);
    const head = hook.kind === "broom" ? 0x4a5558 : 0x2b3133;
    const spread = hook.kind === "broom" ? 3.4 : 4.6;
    fill_polygon(
      ctx,
      [
        [top.x - 2, top.y + 17],
        [top.x + 2, top.y + 17],
        [top.x + spread, top.y + 22],
        [top.x - spread, top.y + 22],
      ],
      css(head),
    );
  }
}

/** The janitor trolley's sortable parts: the chassis and everything that stands on it. */
export interface TrolleyParts {
  /** Castors and the moulded deck, sorted by the deck's north edge so it paints first. */
  readonly chassis: Part;
  /** The handle, bin bag, caddy and mop bucket standing on the deck. */
  readonly riders: readonly Part[];
}

/**
 * Lists the janitor trolley's parts. The chassis sorts by its north edge, ahead of everything that
 * stands on it, so the deck never paints over the bucket, the bag or the caddy; the riders sort
 * by their own ground positions.
 *
 * @param ctx - The paint context.
 * @param run - The bay run.
 * @param frame - The paint frame.
 * @returns The chassis and its riders.
 */
export function trolley_parts(ctx: PaintContext, run: Run, frame: PaintFrame): TrolleyParts {
  const front = 4;
  const back = run.reach - 6;
  const middle = (front + back) / 2;
  const deck = run.segment(0.06, 0.7, front, back);
  const bag = run.segment(0.08, 0.27, front + 1.2, back - 1.2);
  const caddy = run.segment(0.29, 0.47, front + 0.5, back - 0.5);
  const bucket = run.at(0.59, middle);
  const handle_feet = [run.at(0.065, front + 0.8), run.at(0.065, back - 0.8)] as const;
  return {
    chassis: { depth: deck.y - 0.5, draw: () => paint_trolley_chassis(ctx, run, deck, frame) },
    riders: [
      {
        depth: Math.min(handle_feet[0].y, handle_feet[1].y) - 0.3,
        draw: () => paint_trolley_handle(ctx, handle_feet, frame),
      },
      { depth: ground_bottom(bag), draw: () => paint_trolley_bag(ctx, bag, frame) },
      { depth: ground_bottom(caddy), draw: () => paint_trolley_caddy(ctx, run, caddy, frame) },
      { depth: bucket.y + 4, draw: () => paint_trolley_bucket(ctx, run, bucket, frame) },
    ],
  };
}

/**
 * Paints the trolley's chassis: four castors under a moulded grey deck with a raised rim and a
 * dark bumper band.
 *
 * @param ctx - The paint context.
 * @param run - The bay run.
 * @param deck - The deck's ground rectangle.
 * @param frame - The paint frame.
 */
function paint_trolley_chassis(ctx: PaintContext, run: Run, deck: Ground, frame: PaintFrame): void {
  for (const along of [0.085, 0.675]) {
    for (const from_front of [5.5, run.reach - 7.5]) {
      const wheel = lifted(run.at(along, from_front), 1.7);
      fill_circle(ctx, wheel.x, wheel.y, 1.8, css(0x1f2627));
      fill_circle(ctx, wheel.x - 0.3, wheel.y - 0.3, 0.6, css(0x9aa5a2));
    }
  }
  paint_prism(ctx, deck, TROLLEY_DECK, TROLLEY_GREY, frame, { base: 1.8, radius: 2, lip: 0.6 });
  stroke_rounded_rect(
    ctx,
    deck.x + 1.3,
    deck.y - TROLLEY_DECK + 1.3,
    deck.width - 2.6,
    deck.depth - 2.6,
    1.4,
    css(shade(TROLLEY_GREY, 0.3), 0.7),
    0.8,
  );
  const face = face_of(deck, TROLLEY_DECK, 1.8);
  ctx.fillStyle = css(0x2b3133);
  ctx.fillRect(face.x + 0.6, face.y + 0.9, face.width - 1.2, 1.2);
}

/**
 * Paints the push handle at the trolley's bag end: two dark tubes rising from the deck and a grip
 * bar across them.
 *
 * @param ctx - The paint context.
 * @param feet - The ground points of the two tubes.
 * @param frame - The paint frame.
 */
function paint_trolley_handle(
  ctx: PaintContext,
  feet: readonly [Point, Point],
  frame: PaintFrame,
): void {
  const height = 26;
  for (const foot of feet) {
    const base = lifted(foot, TROLLEY_DECK);
    paint_tube_post(ctx, base.x, base.y, height - TROLLEY_DECK, frame, 1.6, 0x39423f);
  }
  const [first, second] = feet.map((foot) => lifted(foot, height));
  if (!first || !second) return;
  line(ctx, first.x, first.y, second.x, second.y, css(0x222829), 2.2);
  line(ctx, first.x - 0.4, first.y - 0.5, second.x - 0.4, second.y - 0.5, css(0xffffff, 0.25), 0.6);
}

/**
 * Paints the bin bag hanging in its hoop: a soft charcoal bag with creases, its hem folded over a
 * grey frame and its dark mouth open at the top.
 *
 * @param ctx - The paint context.
 * @param bag - The bag's ground rectangle.
 * @param frame - The paint frame.
 */
function paint_trolley_bag(ctx: PaintContext, bag: Ground, frame: PaintFrame): void {
  const top = 21;
  paint_prism(ctx, bag, top, CHARCOAL, frame, {
    base: TROLLEY_DECK,
    radius: 3,
    lip: 0.15,
    front: 0x30383a,
  });
  const face = face_of(bag, top, TROLLEY_DECK);
  for (const offset of [0.28, 0.52, 0.76]) {
    line(
      ctx,
      face.x + face.width * offset,
      face.y + 4,
      face.x + face.width * offset + 0.6,
      face.y + face.height - 1.5,
      css(0x15191a, 0.55),
      0.7,
    );
  }
  ctx.fillStyle = css(0xffffff, 0.12);
  ctx.fillRect(face.x + 1.2, face.y + 4, 1, face.height - 6);
  const hem: [number, number][] = [
    [face.x, face.y],
    [face.x + face.width, face.y],
  ];
  const scallops = 3;
  for (let index = scallops; index >= 0; index -= 1) {
    const x = face.x + (face.width * index) / scallops;
    hem.push([x, face.y + (index % 2 === 0 ? 3 : 4.4)]);
  }
  fill_polygon(ctx, hem, css(0x4a5457));
  const mouth_y = bag.y - top;
  fill_rounded_rect(
    ctx,
    bag.x + 1,
    mouth_y + 1,
    bag.width - 2,
    bag.depth - 2,
    2,
    linear_gradient(ctx, 0, mouth_y, 0, mouth_y + bag.depth, [
      [0, 0x0e1213],
      [0.7, 0x23292b],
      [1, 0x3a4346],
    ]),
  );
  if (!frame.isLowDetail) {
    for (const [offset, alpha] of [
      [0.3, 0.16],
      [0.62, 0.1],
    ] as const) {
      line(
        ctx,
        bag.x + bag.width * offset,
        mouth_y + 2,
        bag.x + bag.width * offset + 1.5,
        mouth_y + bag.depth - 2,
        css(0xffffff, alpha),
        0.8,
      );
    }
  }
  stroke_rounded_rect(
    ctx,
    bag.x + 0.5,
    mouth_y + 0.5,
    bag.width - 1,
    bag.depth - 1,
    2.2,
    css(TROLLEY_GREY),
    1.2,
  );
}

/**
 * Paints the trolley's central caddy: a moulded grey body with an open shelf of refills (a paper
 * roll and a bottle) and a recessed top tray holding two spray bottles and a roll of towels.
 *
 * @param ctx - The paint context.
 * @param run - The bay run.
 * @param caddy - The caddy's ground rectangle.
 * @param frame - The paint frame.
 */
function paint_trolley_caddy(ctx: PaintContext, run: Run, caddy: Ground, frame: PaintFrame): void {
  const top = 20;
  paint_prism(ctx, caddy, top, TROLLEY_GREY, frame, { base: TROLLEY_DECK, radius: 1.6, lip: 0.8 });
  const face = face_of(caddy, top, TROLLEY_DECK);
  ctx.fillStyle = css(shade(TROLLEY_GREY, 0.3), 0.7);
  ctx.fillRect(face.x + 2, face.y + 2.6, face.width - 4, 0.7);
  const shelf = { x: face.x + 1.5, y: face.y + 5, width: face.width - 3, height: face.height - 7 };
  fill_rounded_rect(
    ctx,
    shelf.x,
    shelf.y,
    shelf.width,
    shelf.height,
    1,
    linear_gradient(ctx, 0, shelf.y, 0, shelf.y + shelf.height, [
      [0, 0x101718],
      [1, RECESS],
    ]),
  );
  const roll_x = shelf.x + 1;
  const floor_y = shelf.y + shelf.height;
  fill_rounded_rect(ctx, roll_x, floor_y - 5.4, 4.6, 5.4, 1.6, css(0xf2efe6));
  fill_ellipse(ctx, roll_x + 2.3, floor_y - 2.7, 0.9, 1.4, css(0x8a7b66));
  if (shelf.width > 10) {
    paint_bottle(ctx, shelf.x + shelf.width - 3, floor_y - 0.2, 6.5, 0x3d8fc8, CREAM, {
      label_colour: 0xf2efe6,
    });
  }
  const tray_y = caddy.y - top;
  fill_rounded_rect(
    ctx,
    caddy.x + 1.3,
    tray_y + 1.3,
    caddy.width - 2.6,
    caddy.depth - 2.6,
    1,
    css(shade(TROLLEY_GREY, 0.3)),
  );
  const middle = run.reach / 2 - 1;
  const stock: Part[] = [
    { along: 0.33, colour: 0x3d8fc8 },
    { along: 0.38, colour: 0x5fae5a },
  ].map(({ along, colour }) => {
    const ground = run.at(along, middle);
    return {
      depth: ground.y,
      draw: () => paint_spray_bottle(ctx, lifted(ground, top - 0.6), colour),
    };
  });
  const roll = run.at(0.435, middle);
  stock.push({
    depth: roll.y,
    draw: () => {
      const foot = lifted(roll, top - 0.6);
      paint_cylinder(ctx, foot.x, foot.y, 2.3, 5.5, 0xf2efe6, frame, { cap: 0xffffff });
      fill_ellipse(ctx, foot.x, foot.y - 5.5, 0.8, 0.5, css(0x8a7b66));
    },
  });
  paint_parts(stock);
}

/**
 * Paints a trigger spray bottle: a coloured body, a white trigger head with its nozzle and a
 * highlight.
 *
 * @param ctx - The paint context.
 * @param foot - The bottle's screen foot.
 * @param colour - The body colour.
 */
function paint_spray_bottle(ctx: PaintContext, foot: Point, colour: number): void {
  const white = css(0xf4f4f0);
  fill_ellipse(ctx, foot.x + 0.6, foot.y + 0.3, 1.9, 0.8, css(INK, 0.25));
  fill_rounded_rect(
    ctx,
    foot.x - 1.6,
    foot.y - 6,
    3.2,
    6,
    0.9,
    linear_gradient(ctx, foot.x - 1.6, 0, foot.x + 1.6, 0, [
      [0, tint(colour, 0.3)],
      [1, shade(colour, 0.3)],
    ]),
  );
  fill_rounded_rect(ctx, foot.x - 0.7, foot.y - 7.2, 1.4, 1.4, 0.3, white);
  fill_polygon(
    ctx,
    [
      [foot.x - 1.2, foot.y - 7.1],
      [foot.x + 2.3, foot.y - 8.1],
      [foot.x + 2.3, foot.y - 9.2],
      [foot.x - 1.2, foot.y - 9.2],
    ],
    white,
  );
  line(ctx, foot.x + 0.6, foot.y - 7.2, foot.x + 1.3, foot.y - 5.8, white, 0.8);
  ctx.fillStyle = css(0xffffff, 0.4);
  ctx.fillRect(foot.x - 1.1, foot.y - 5.4, 0.6, 4.2);
}

/**
 * Paints the yellow mop bucket on the trolley's deck: the bucket with its rim band and grey water,
 * the grey wringer clamped on its back rim with a press lever, and a mop standing in it with its
 * strands draped over the front rim.
 *
 * @param ctx - The paint context.
 * @param run - The bay run.
 * @param centre - The bucket's ground centre.
 * @param frame - The paint frame.
 */
function paint_trolley_bucket(ctx: PaintContext, run: Run, centre: Point, frame: PaintFrame): void {
  const radius = 6.2;
  const height = 10;
  const foot = lifted(centre, TROLLEY_DECK);
  paint_cylinder(ctx, foot.x, foot.y, radius, height, SAFETY_YELLOW, frame, { cap: 0x7f9fa6 });
  const rim_y = foot.y - height;
  ctx.fillStyle = css(shade(SAFETY_YELLOW, 0.22));
  ctx.fillRect(foot.x - radius, rim_y + 0.8, radius * 2, 1.4);
  stroke_ellipse_ring(ctx, foot.x, rim_y, radius, radius * ROUND_SQUASH, tint(SAFETY_YELLOW, 0.35));
  const wringer = oriented_ground(run.at(0.6, run.reach / 2 + 1.8), 7, 4.4, run.side);
  paint_prism(ctx, wringer, TROLLEY_DECK + height + 6, 0x5f6b6e, frame, {
    base: TROLLEY_DECK + height - 1.5,
    radius: 1,
    lip: 0.5,
  });
  const pivot = lifted(run.at(0.64, run.reach / 2 + 2), TROLLEY_DECK + height + 6);
  const grip = lifted(run.at(0.68, run.reach / 2 + 4), TROLLEY_DECK + 26);
  line(ctx, pivot.x, pivot.y, grip.x, grip.y, css(0x3c4446), 1.4);
  fill_rounded_rect(ctx, grip.x - 1.4, grip.y - 1, 2.8, 2.4, 0.8, css(0x1f2627));
  const mop_foot = { x: foot.x - 1.6, y: rim_y + 0.8 };
  const mop_top = lifted(run.at(0.55, run.reach / 2 + 3), TROLLEY_DECK + 32);
  line(ctx, mop_foot.x, mop_foot.y, mop_top.x, mop_top.y, css(0x3d6fa8), 1.4);
  line(ctx, mop_foot.x - 0.4, mop_foot.y, mop_top.x - 0.4, mop_top.y, css(0xffffff, 0.3), 0.4);
  if (frame.isLowDetail) return;
  for (let strand = 0; strand < 5; strand += 1) {
    const x = foot.x - 4 + strand * 1.3;
    const front_y = rim_y + radius * ROUND_SQUASH * 0.8;
    line(ctx, x, front_y - 1, x + 0.3, front_y + 2.6, css(strand % 2 ? 0xe9e4d6 : 0xcfc8b6), 1);
  }
}

/**
 * Strokes a thin lit ring, the rolled rim of a round bucket.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius_x - Horizontal radius.
 * @param radius_y - Vertical radius.
 * @param colour - The ring colour.
 */
function stroke_ellipse_ring(
  ctx: PaintContext,
  cx: number,
  cy: number,
  radius_x: number,
  radius_y: number,
  colour: number,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius_x, radius_y, 0, 0, Math.PI * 2);
  ctx.strokeStyle = css(colour);
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

/**
 * Paints the folded yellow caution sign parked in the trolley bay.
 *
 * @param ctx - The paint context.
 * @param run - The bay run.
 * @param frame - The paint frame.
 */
function paint_caution_sign(ctx: PaintContext, run: Run, frame: PaintFrame): void {
  const foot = run.at(0.87, 8);
  fill_ellipse(ctx, foot.x + 1, foot.y + 0.5, 4, 1.4, css(INK, 0.22));
  fill_polygon(
    ctx,
    [
      [foot.x - 3.6, foot.y],
      [foot.x + 3.6, foot.y],
      [foot.x + 2, foot.y - 15],
      [foot.x - 2, foot.y - 15],
    ],
    css(SAFETY_YELLOW),
  );
  fill_polygon(
    ctx,
    [
      [foot.x, foot.y - 12.5],
      [foot.x - 1.8, foot.y - 9.2],
      [foot.x + 1.8, foot.y - 9.2],
    ],
    css(INK),
  );
  ctx.fillStyle = css(INK);
  ctx.fillRect(foot.x - 2.6, foot.y - 6.4, 5.2, 1);
  const edge = edge_style(frame, SAFETY_YELLOW);
  line(ctx, foot.x - 2, foot.y - 15, foot.x + 2, foot.y - 15, edge.style, edge.width);
}

/**
 * Paints the clean tray stack rack: an open stainless rack on four posts with three wire shelves,
 * each stacked high with light sanitised trays, under a green "CLEAN TRAYS" board.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_clean_rack(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const top = 30;
  const run = make_run(box, rotation, { reach: 21, front_gap: 5, end_gap: 6, rise: top + 9 });
  cast_shadow(ctx, run.ground, top);
  const corners: Ground[] = [];
  for (const along of [0, 0.95]) {
    for (const front of [0, run.reach - 1.6])
      corners.push(run.segment(along, along + 0.05, front, front + 1.6));
  }
  const by_depth = [...corners].sort(
    (first, second) => ground_bottom(first) - ground_bottom(second),
  );
  const back_posts = by_depth.slice(0, 2);
  const front_posts = by_depth.slice(2);
  for (const post of back_posts)
    paint_prism(ctx, post, top, STAINLESS, frame, { radius: 0.5, lip: 0.2 });
  [2, 12, 22].forEach((shelf_height, index) => {
    const shelf = run.segment(0, 1, 0, run.reach);
    paint_prism(ctx, shelf, shelf_height + 1.2, STAINLESS, frame, { base: shelf_height, lip: 0.6 });
    const stack = run.segment(0.08, 0.92, 2, run.reach - 2);
    paint_tray_block(
      ctx,
      stack,
      shelf_height + 1.2,
      index === 2 ? 4 : 5,
      frame,
      recipe.seed + index,
    );
  });
  for (const post of front_posts)
    paint_prism(ctx, post, top, STAINLESS, frame, { radius: 0.5, lip: 0.2 });
  paint_header_board(
    ctx,
    run,
    run.reach - 2.6,
    top,
    top + 7,
    LEAF,
    "Clean trays",
    ["tray-stack"],
    frame,
  );
}

/**
 * Paints a block of stacked trays as one prism with a ridge line per tray on its south face.
 *
 * @param ctx - The paint context.
 * @param ground - The stack's ground rectangle.
 * @param base - Height of the shelf it sits on.
 * @param count - Number of trays.
 * @param frame - The paint frame.
 * @param seed - Seed for the brushing.
 */
function paint_tray_block(
  ctx: PaintContext,
  ground: Ground,
  base: number,
  count: number,
  frame: PaintFrame,
  seed: number,
): void {
  const height = base + count * 1.5;
  paint_prism(ctx, ground, height, CLEAN_TRAY, frame, {
    base,
    radius: 1.2,
    seed,
    front: shade(CLEAN_TRAY, 0.2),
  });
  const face = face_of(ground, height, base);
  for (let tray = 1; tray < (frame.isLowDetail ? 0 : count); tray += 1) {
    ctx.fillStyle = css(shade(CLEAN_TRAY, 0.45), 0.7);
    ctx.fillRect(face.x + 0.6, face.y + tray * 1.5, face.width - 1.2, 0.5);
  }
  const top_y = ground.y - height;
  fill_rounded_rect(
    ctx,
    ground.x + 1.6,
    top_y + 1.4,
    ground.width - 3.2,
    ground.depth - 2.8,
    1,
    linear_gradient(ctx, 0, top_y, 0, top_y + ground.depth, [
      [0, shade(CLEAN_TRAY, 0.22)],
      [1, shade(CLEAN_TRAY, 0.06)],
    ]),
  );
  ctx.fillStyle = css(0xffffff, 0.4);
  ctx.fillRect(ground.x + 1.5, top_y + 0.6, ground.width - 3, 0.6);
}
