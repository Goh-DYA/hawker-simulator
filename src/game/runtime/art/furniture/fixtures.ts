/**
 * Stall-fixture painters: the queue ticket dispenser, condiment counter, cutlery and napkin
 * station, water carafe station and heated order pickup pass, built as stainless hawker-centre
 * infrastructure in the 3/4 view, plus the dispatcher that also sends display cases and the prep
 * cart to `fixtureCases.ts`.
 *
 * Every fixture is laid out along its service edge with a {@link Run}, so it turns with the
 * placement rotation (its user stands on the rotated south side) while the north-west light, the
 * south faces and the shadows stay where they are. The branch comes from the ID-keyed style table
 * in `render/art.ts`; everything else is painted from the recipe seed.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style, type FixtureStyle } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  label,
  line,
  seeded,
  shade,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import { paint_display_case, paint_prep_cart } from "./fixtureCases";
import { DARK_STEEL, type Box } from "./shared";
import {
  cast_shadow,
  CREAM,
  face_of,
  face_view,
  ground_bottom,
  INK,
  LAMP_LIGHT,
  lifted,
  make_run,
  oriented_ground,
  paint_bottle,
  paint_cylinder,
  paint_end_blade,
  paint_glow,
  paint_header_board,
  paint_parts,
  paint_prism,
  paint_service_sliver,
  paint_sign_strip,
  paint_tube_post,
  RECESS,
  service_side,
  STAINLESS,
  TEAL_STEEL,
  VERMILION,
  type FaceView,
  type Ground,
  type Part,
  type Point,
  type Run,
} from "./steelwork";

/** Height of a stall-fixture counter top above the floor. */
const COUNTER_LIFT = 20;
/** Thickness of a bench's worktop. */
const WORKTOP = 3;
/** Height of the order pickup pass's lower deck. */
const PASS_LIFT = 17;
/** Height of the pickup pass's heated upper shelf. */
const PASS_SHELF = 31;
/** Dark soy sauce glass. */
const SOY = 0x2a1810;
/** Chilli sauce red. */
const CHILLI = 0xc8372d;
/** Rice vinegar amber. */
const VINEGAR = 0xc2873a;
/** White glazed porcelain. */
const PORCELAIN = 0xf3f1ea;
/** Pale bamboo of chopsticks. */
const BAMBOO = 0xd9b98a;
/** Drinking water tint. */
const WATER = 0x7cc3d6;
/** Pale teal glazed wall tile. */
const TILE_TEAL = 0xbfe0dc;
/** LED amber of number displays. */
const LED_AMBER = 0xffb454;

/** A fixture painter: paints one branch in the rotated footprint. */
type FixturePainter = (
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
) => void;

/** The painter of each fixture branch. */
const FIXTURE_PAINTERS: Readonly<Record<FixtureStyle, FixturePainter>> = {
  ticket: paint_ticket_dispenser,
  condiment: paint_condiment_counter,
  cutlery: paint_cutlery_station,
  water: paint_water_station,
  pickup: paint_pickup_pass,
  "display-case": paint_display_case,
  cart: paint_prep_cart,
};

/**
 * Paints a stall fixture (ticket dispenser, condiment counter, cutlery station, water carafes,
 * pickup pass, heated or chilled display case or prep cart) in its rotated orientation.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box (already rotated).
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; the service side faces the rotated south.
 */
export function paint_fixture(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  FIXTURE_PAINTERS[resolve_placeable_style("stall-fixture", recipe)](
    ctx,
    box,
    recipe,
    frame,
    rotation,
  );
}

/**
 * Paints a part standing on a run's top: the draw callback receives the part's screen foot.
 *
 * @param run - The run.
 * @param along - Fraction along the service edge.
 * @param from_front - Distance back from the service edge.
 * @param height - Height of the surface the part stands on.
 * @param draw - Paints the part at its screen foot.
 * @returns The part, sorted by its ground y.
 */
function prop(
  run: Run,
  along: number,
  from_front: number,
  height: number,
  draw: (foot: Point) => void,
): Part {
  const ground = run.at(along, from_front);
  return { depth: ground.y, draw: () => draw(lifted(ground, height)) };
}

/**
 * Paints vertical door seams and a dark kick plate on a cabinet face.
 *
 * @param ctx - The paint context.
 * @param face - The face rectangle.
 * @param doors - Number of door panels.
 */
function paint_cabinet_face(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  doors: number,
): void {
  ctx.fillStyle = css(RECESS, 0.55);
  ctx.fillRect(face.x + 1, face.y + face.height - 2.6, face.width - 2, 2.2);
  for (let index = 1; index < doors; index += 1) {
    const x = face.x + (face.width * index) / doors;
    ctx.fillStyle = css(RECESS, 0.4);
    ctx.fillRect(x - 0.4, face.y + 2, 0.8, face.height - 5);
    ctx.fillStyle = css(0xffffff, 0.35);
    ctx.fillRect(x + 0.4, face.y + 2, 0.6, face.height - 5);
  }
}

/**
 * Paints an open stainless bench: corner legs, a dark modesty panel at the back, an undershelf
 * with whatever the fixture stores on it and a worktop on top.
 *
 * @param ctx - The paint context.
 * @param run - The bench run.
 * @param height - Height of the worktop.
 * @param frame - The paint frame.
 * @param seed - Seed for the steel brushing.
 * @param load - Paints the stock on the undershelf, given the shelf's top height.
 */
function paint_open_bench(
  ctx: PaintContext,
  run: Run,
  height: number,
  frame: PaintFrame,
  seed: number,
  load: (shelf_top: number) => void,
): void {
  const leg = 2.6;
  const leg_along = leg / run.length;
  const parts: Part[] = [];
  const back = run.segment(0.01, 0.99, run.reach - 2, run.reach - 0.5);
  parts.push({
    depth: ground_bottom(back) - 0.5,
    draw: () =>
      paint_prism(ctx, back, height - WORKTOP, shade(STAINLESS, 0.45), frame, {
        is_bare: true,
        lip: 0.2,
      }),
  });
  for (const along of [0, 1 - leg_along]) {
    for (const front of [0.5, run.reach - leg - 0.5]) {
      const foot = run.segment(along, along + leg_along, front, front + leg);
      parts.push({
        depth: ground_bottom(foot),
        draw: () =>
          paint_prism(ctx, foot, height - WORKTOP, STAINLESS, frame, { radius: 0.8, lip: 0.3 }),
      });
    }
  }
  const shelf = run.segment(0.02, 0.98, 1.5, run.reach - 2);
  parts.push({
    depth: ground_bottom(shelf) - 0.2,
    draw: () => {
      paint_prism(ctx, shelf, 6, STAINLESS, frame, { base: 4, is_steel: true, seed });
      load(6);
    },
  });
  paint_parts(parts);
  paint_prism(ctx, run.ground, height, STAINLESS, frame, {
    base: height - WORKTOP,
    is_steel: true,
    seed,
    lip: 1,
  });
}

/**
 * Paints a closed stainless cabinet counter with door seams on its front and a service sliver
 * when it is seen end-on.
 *
 * @param ctx - The paint context.
 * @param run - The cabinet run.
 * @param height - Height of the top.
 * @param frame - The paint frame.
 * @param seed - Seed for the brushing.
 * @param decorate - Paints the visible south face, given its rectangle and which side it is.
 */
function paint_cabinet_counter(
  ctx: PaintContext,
  run: Run,
  height: number,
  frame: PaintFrame,
  seed: number,
  decorate: (face: { x: number; y: number; width: number; height: number }, view: FaceView) => void,
): void {
  paint_prism(ctx, run.ground, height, STAINLESS, frame, { is_steel: true, seed, lip: 1 });
  const face = face_of(run.ground, height);
  decorate(face, face_view(run.side));
  paint_service_sliver(ctx, run, height, TEAL_STEEL);
}

/**
 * Paints the queue ticket dispenser: a pedestal post on a round foot, a vermilion ticket head with
 * a slot and a printed ticket, and a double-sided LED number display above it.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_ticket_dispenser(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const side = service_side(rotation);
  // Seen end-on the number display runs north-south, so the stand moves south to keep its top
  // inside the overhang.
  const foot: Point = { x: box.centreX, y: box.y + (face_view(side) === "end" ? 33 : 31) };
  cast_shadow(ctx, { x: foot.x - 8, y: foot.y - 3.5, width: 16, depth: 7 }, 34, true);
  paint_cylinder(ctx, foot.x, foot.y + 0.5, 8, 2.2, DARK_STEEL, frame, { squash: 0.45 });
  paint_tube_post(ctx, foot.x, foot.y - 0.5, 31, frame, 3.2);
  const head = oriented_ground(foot, 13, 8, side);
  paint_prism(ctx, head, 25, VERMILION, frame, {
    base: 14,
    radius: 2,
    front: shade(VERMILION, 0.18),
  });
  paint_ticket_head(ctx, face_of(head, 25, 14), side, recipe.accent);
  const display = oriented_ground(foot, 17, 5, side);
  paint_prism(ctx, display, 39, 0x34474a, frame, { base: 29, radius: 1.5 });
  paint_number_display(ctx, face_of(display, 39, 29), side, frame);
}

/**
 * Details the ticket head's visible face: the slot and hanging ticket in front, vents behind, or
 * the ticket poking out sideways when the head is seen end-on.
 *
 * @param ctx - The paint context.
 * @param face - The head's south face.
 * @param side - The service side.
 * @param accent - The recipe accent, used for the call button.
 */
function paint_ticket_head(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  side: ReturnType<typeof service_side>,
  accent: number,
): void {
  const view = face_view(side);
  const cx = face.x + face.width / 2;
  if (view === "front") {
    ctx.fillStyle = css(RECESS);
    ctx.fillRect(face.x + 2.5, face.y + 3.6, face.width - 5, 1.2);
    fill_rounded_rect(ctx, cx - 2.6, face.y + 4.3, 5.2, 6, 0.6, css(CREAM));
    ctx.fillStyle = css(INK, 0.55);
    ctx.fillRect(cx - 1.6, face.y + 6.4, 3.2, 0.8);
    ctx.fillRect(cx - 1.1, face.y + 8, 2.2, 0.6);
    fill_circle(ctx, face.x + 2.4, face.y + 2, 1.1, css(tint(accent, 0.2)));
  } else if (view === "back") {
    for (let index = 0; index < 3; index += 1) {
      ctx.fillStyle = css(shade(VERMILION, 0.5), 0.6);
      ctx.fillRect(face.x + 3, face.y + 3 + index * 2.2, face.width - 6, 0.8);
    }
  } else {
    const x = side === "west" ? face.x - 3.4 : face.x + face.width - 0.6;
    fill_rounded_rect(ctx, x, face.y + 3.4, 4, 5.4, 0.6, css(CREAM));
    ctx.fillStyle = css(INK, 0.5);
    ctx.fillRect(x + 0.8, face.y + 5.4, 2.4, 0.7);
  }
}

/**
 * Details the number display: a dark screen with glowing amber digits on both broad faces, or a
 * glowing edge when it is seen end-on.
 *
 * @param ctx - The paint context.
 * @param face - The display's south face.
 * @param side - The service side.
 * @param frame - The paint frame.
 */
function paint_number_display(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  side: ReturnType<typeof service_side>,
  frame: PaintFrame,
): void {
  const cy = face.y + face.height / 2;
  if (face_view(side) !== "end") {
    const cx = face.x + face.width / 2;
    fill_rounded_rect(
      ctx,
      face.x + 1.3,
      face.y + 1.3,
      face.width - 2.6,
      face.height - 2.6,
      1,
      css(0x0d1517),
    );
    paint_glow(ctx, frame, cx, cy, 11, 0xff9f43, 0.32);
    label(ctx, "27", cx, cy + 0.3, {
      maxWidth: face.width - 4,
      size: 7.5,
      colour: LED_AMBER,
      weight: 800,
    });
    return;
  }
  const x = side === "west" ? face.x - 0.6 : face.x + face.width - 1;
  fill_rounded_rect(ctx, x, face.y + 1.4, 1.6, face.height - 2.8, 0.6, css(LED_AMBER));
  paint_glow(ctx, frame, x + 0.8, cy, 8, 0xff9f43, 0.4);
}

/**
 * Paints the condiment counter: an open stainless bench with a low splash upstand under a
 * "CONDIMENTS" header board, chilli, dark soy and vinegar bottles, covered sambal, pepper shakers,
 * saucers of cut chilli and a napkin box, with spare stock on the undershelf.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_condiment_counter(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 24, front_gap: 4, end_gap: 3, rise: 35 });
  cast_shadow(ctx, run.ground, COUNTER_LIFT);
  paint_open_bench(ctx, run, COUNTER_LIFT, frame, recipe.seed, (top) => {
    const carton = run.segment(0.08, 0.34, 3, run.reach - 4);
    paint_prism(ctx, carton, top + 6, 0xc49a6c, frame, { base: top, radius: 0.6 });
    const crate = run.segment(0.62, 0.9, 3, run.reach - 5);
    paint_prism(ctx, crate, top + 4, 0x3d6fa8, frame, { base: top, radius: 0.6 });
  });
  const parts: Part[] = condiment_props(ctx, run, frame);
  const upstand = run.segment(0.02, 0.98, run.reach - 2.4, run.reach - 0.4);
  parts.push({
    depth: ground_bottom(upstand),
    draw: () =>
      paint_prism(ctx, upstand, COUNTER_LIFT + 4, STAINLESS, frame, {
        base: COUNTER_LIFT,
        is_steel: true,
        seed: recipe.seed + 1,
      }),
  });
  paint_parts(parts);
  paint_header_board(
    ctx,
    run,
    run.reach - 2.6,
    COUNTER_LIFT + 4,
    COUNTER_LIFT + 13,
    TEAL_STEEL,
    "Condiments",
    ["bottle"],
    frame,
  );
  paint_service_sliver(ctx, run, COUNTER_LIFT, TEAL_STEEL, COUNTER_LIFT - WORKTOP);
}

/**
 * Lists the condiment counter's top props: a back row of bottles and a front row of saucers and
 * shakers.
 *
 * @param ctx - The paint context.
 * @param run - The counter run.
 * @param frame - The paint frame.
 * @returns The props as sortable parts.
 */
function condiment_props(ctx: PaintContext, run: Run, frame: PaintFrame): Part[] {
  const back = run.reach - 7.5;
  const front = 7;
  const lift = COUNTER_LIFT;
  const parts: Part[] = [
    prop(run, 0.1, back, lift, (foot) => paint_sambal_tub(ctx, foot, frame)),
    prop(run, 0.22, back, lift, (foot) =>
      paint_bottle(ctx, foot.x, foot.y, 10, CHILLI, 0xf2eee4, { is_squeeze: true }),
    ),
    prop(run, 0.29, back + 1, lift, (foot) =>
      paint_bottle(ctx, foot.x, foot.y, 10, CHILLI, 0xf2eee4, { is_squeeze: true }),
    ),
    prop(run, 0.43, back, lift, (foot) =>
      paint_bottle(ctx, foot.x, foot.y, 11, SOY, 0xc0392b, { label_colour: 0xf1e6cc }),
    ),
    prop(run, 0.5, back + 1, lift, (foot) =>
      paint_bottle(ctx, foot.x, foot.y, 11, SOY, 0xc0392b, { label_colour: 0xf1e6cc }),
    ),
    prop(run, 0.64, back, lift, (foot) =>
      paint_bottle(ctx, foot.x, foot.y, 10, VINEGAR, 0xe8e0cc, {
        alpha: 0.88,
        label_colour: 0xf6f0de,
      }),
    ),
    prop(run, 0.86, back, lift, (foot) => paint_napkin_box(ctx, run, foot, frame)),
    prop(run, 0.2, front, lift, (foot) => paint_saucer(ctx, foot, CHILLI)),
    prop(run, 0.37, front, lift, (foot) => paint_saucer(ctx, foot, SOY)),
  ];
  if (!frame.isLowDetail) {
    for (const along of [0.56, 0.6]) {
      parts.push(
        prop(run, along, front, lift, (foot) =>
          paint_cylinder(ctx, foot.x, foot.y, 1.7, 4.6, PORCELAIN, frame, {
            cap: 0xb7c2bf,
            is_bare: true,
          }),
        ),
      );
    }
    parts.push(
      prop(run, 0.74, front, lift, (foot) =>
        paint_cylinder(ctx, foot.x, foot.y, 1.8, 4, BAMBOO, frame, { is_bare: true }),
      ),
    );
  }
  return parts;
}

/**
 * Paints a covered stainless tub of sambal with a red rim showing under its lid.
 *
 * @param ctx - The paint context.
 * @param foot - The tub's screen foot.
 * @param frame - The paint frame.
 */
function paint_sambal_tub(ctx: PaintContext, foot: Point, frame: PaintFrame): void {
  paint_cylinder(ctx, foot.x, foot.y, 4.2, 4.2, STAINLESS, frame, { cap: tint(STAINLESS, 0.3) });
  fill_ellipse(ctx, foot.x, foot.y - 4.2, 4.2, 2.4, css(0xa8261c));
  fill_ellipse(ctx, foot.x, foot.y - 5.2, 4, 2.3, css(tint(STAINLESS, 0.25)));
  fill_circle(ctx, foot.x, foot.y - 6, 0.9, css(DARK_STEEL));
  line(ctx, foot.x + 1.5, foot.y - 5.5, foot.x + 4.5, foot.y - 8, css(0xe6ebe9), 0.9);
}

/**
 * Paints a small white saucer holding sliced chilli or a sauce.
 *
 * @param ctx - The paint context.
 * @param foot - The saucer's screen centre.
 * @param filling - The colour of what is in it.
 */
function paint_saucer(ctx: PaintContext, foot: Point, filling: number): void {
  fill_ellipse(ctx, foot.x + 0.6, foot.y + 0.6, 3.8, 2.1, css(INK, 0.18));
  fill_ellipse(ctx, foot.x, foot.y - 0.4, 3.7, 2.1, css(PORCELAIN));
  fill_ellipse(ctx, foot.x, foot.y - 0.3, 2.5, 1.3, css(filling));
  if (filling === CHILLI) {
    fill_circle(ctx, foot.x - 0.8, foot.y - 0.6, 0.6, css(0xf2d36b));
    fill_circle(ctx, foot.x + 0.9, foot.y - 0.2, 0.5, css(0x5d9b4c));
  }
}

/**
 * Paints a small napkin box with a tissue tuft, oriented along the run.
 *
 * @param ctx - The paint context.
 * @param run - The run it stands on, which orients it.
 * @param foot - Its screen foot.
 * @param frame - The paint frame.
 */
function paint_napkin_box(ctx: PaintContext, run: Run, foot: Point, frame: PaintFrame): void {
  const ground = oriented_ground({ x: foot.x, y: foot.y + COUNTER_LIFT }, 8, 6, run.side);
  paint_prism(ctx, ground, COUNTER_LIFT + 5, 0xe8f0ee, frame, {
    base: COUNTER_LIFT,
    radius: 1,
    front: 0x5d9b8f,
  });
  fill_ellipse(ctx, foot.x, foot.y - 5.4, 2.4, 1.3, css(0xffffff));
  fill_polygon(
    ctx,
    [
      [foot.x - 1.6, foot.y - 5.4],
      [foot.x + 0.4, foot.y - 8.2],
      [foot.x + 1.8, foot.y - 5.4],
    ],
    css(0xffffff),
  );
}

/**
 * Paints the cutlery and napkin station: a closed steel cabinet with drawers and a bowl cubby,
 * chopstick and spoon canisters, a tray of porcelain soup spoons, a napkin dispenser and a
 * "CUTLERY" header board.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_cutlery_station(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 24, front_gap: 4, end_gap: 5, rise: 36 });
  cast_shadow(ctx, run.ground, COUNTER_LIFT);
  paint_cabinet_counter(ctx, run, COUNTER_LIFT, frame, recipe.seed, (face, view) => {
    if (view === "front") paint_cutlery_front(ctx, face);
    else paint_cabinet_face(ctx, face, view === "back" ? 2 : 1);
  });
  const lift = COUNTER_LIFT;
  const parts: Part[] = [
    prop(run, 0.2, run.reach - 7, lift, (foot) =>
      paint_canister(ctx, foot, BAMBOO, recipe.seed, frame),
    ),
    prop(run, 0.45, run.reach - 7, lift, (foot) =>
      paint_canister(ctx, foot, 0xdfe6e4, recipe.seed + 3, frame),
    ),
    prop(run, 0.76, run.reach - 7, lift, (foot) => paint_napkin_dispenser(ctx, run, foot, frame)),
  ];
  const tray = run.segment(0.08, 0.6, 2.5, 10);
  parts.push({
    depth: ground_bottom(tray),
    draw: () => paint_spoon_tray(ctx, run, tray, frame),
  });
  const upstand = run.segment(0.04, 0.96, run.reach - 2.4, run.reach - 0.4);
  parts.push({
    depth: ground_bottom(upstand),
    draw: () =>
      paint_prism(ctx, upstand, lift + 4, STAINLESS, frame, { base: lift, is_steel: true }),
  });
  paint_parts(parts);
  paint_header_board(
    ctx,
    run,
    run.reach - 2.6,
    lift + 4,
    lift + 14,
    recipe.accent,
    "Cutlery",
    ["cutlery"],
    frame,
  );
}

/**
 * Details the cutlery cabinet's front: two labelled drawers over an open cubby of stacked bowls.
 *
 * @param ctx - The paint context.
 * @param face - The cabinet's south face.
 */
function paint_cutlery_front(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
): void {
  const half = face.width / 2;
  for (let index = 0; index < 2; index += 1) {
    const x = face.x + 1.5 + index * half;
    fill_rounded_rect(ctx, x, face.y + 2, half - 3, 6, 0.8, css(tint(STAINLESS, 0.15)));
    line(ctx, x + half / 2 - 4, face.y + 4, x + half / 2 + 1, face.y + 4, css(DARK_STEEL), 1);
  }
  const cubby = { x: face.x + 2, y: face.y + 9.5, width: face.width - 4, height: face.height - 12 };
  fill_rounded_rect(ctx, cubby.x, cubby.y, cubby.width, cubby.height, 1, css(RECESS));
  for (let index = 0; index < 3; index += 1) {
    const cx = cubby.x + cubby.width * (0.22 + index * 0.28);
    for (let bowl = 0; bowl < 3; bowl += 1) {
      fill_ellipse(
        ctx,
        cx,
        cubby.y + cubby.height - 1.4 - bowl * 1.5,
        3.6,
        1.3,
        css(shade(PORCELAIN, bowl * 0.06)),
      );
    }
  }
  ctx.fillStyle = css(RECESS, 0.55);
  ctx.fillRect(face.x + 1, face.y + face.height - 2, face.width - 2, 1.6);
}

/**
 * Paints a stainless canister of chopsticks or spoons with the handles fanning out of it.
 *
 * @param ctx - The paint context.
 * @param foot - The canister's screen foot.
 * @param handle - Handle colour: bamboo for chopsticks, steel for spoons.
 * @param seed - Seed for the fan of handles.
 * @param frame - The paint frame.
 */
function paint_canister(
  ctx: PaintContext,
  foot: Point,
  handle: number,
  seed: number,
  frame: PaintFrame,
): void {
  const next = seeded(seed);
  const count = frame.isLowDetail ? 4 : 8;
  for (let index = 0; index < count; index += 1) {
    const lean = (index / (count - 1) - 0.5) * 4 + (next() - 0.5);
    const top = foot.y - 7 - 5 - next() * 2.5;
    line(
      ctx,
      foot.x + lean * 0.4,
      foot.y - 6,
      foot.x + lean,
      top,
      css(shade(handle, next() * 0.2)),
      0.9,
    );
    if (handle !== BAMBOO) fill_ellipse(ctx, foot.x + lean, top, 0.9, 0.6, css(tint(handle, 0.2)));
  }
  paint_cylinder(ctx, foot.x, foot.y, 3.6, 7, STAINLESS, frame, { cap: shade(STAINLESS, 0.5) });
}

/**
 * Paints a shallow tray of porcelain soup spoons on a run's top.
 *
 * @param ctx - The paint context.
 * @param run - The run, which orients the spoons.
 * @param tray - The tray's ground rectangle.
 * @param frame - The paint frame.
 */
function paint_spoon_tray(ctx: PaintContext, run: Run, tray: Ground, frame: PaintFrame): void {
  paint_prism(ctx, tray, COUNTER_LIFT + 2, 0xdfe6e4, frame, { base: COUNTER_LIFT, radius: 1 });
  const count = frame.isLowDetail ? 3 : 5;
  for (let index = 0; index < count; index += 1) {
    const along = (index + 0.5) / count;
    const head = run.at(0.08 + along * 0.52, 5);
    const tail = run.at(0.08 + along * 0.52, 9);
    const head_screen = lifted(head, COUNTER_LIFT + 2.4);
    const tail_screen = lifted(tail, COUNTER_LIFT + 2.6);
    line(ctx, head_screen.x, head_screen.y, tail_screen.x, tail_screen.y, css(PORCELAIN), 1.1);
    fill_ellipse(ctx, head_screen.x, head_screen.y, 1.5, 1.1, css(PORCELAIN));
    fill_ellipse(ctx, head_screen.x - 0.3, head_screen.y - 0.2, 0.7, 0.4, css(0xffffff));
  }
}

/**
 * Paints an upright napkin dispenser with a napkin pulled half out of its mouth.
 *
 * @param ctx - The paint context.
 * @param run - The run, which orients the dispenser.
 * @param foot - Its screen foot.
 * @param frame - The paint frame.
 */
function paint_napkin_dispenser(ctx: PaintContext, run: Run, foot: Point, frame: PaintFrame): void {
  const ground = oriented_ground({ x: foot.x, y: foot.y + COUNTER_LIFT }, 9, 6, run.side);
  paint_prism(ctx, ground, COUNTER_LIFT + 9, STAINLESS, frame, {
    base: COUNTER_LIFT,
    radius: 1.2,
    is_steel: true,
  });
  const face = face_of(ground, COUNTER_LIFT + 9, COUNTER_LIFT);
  if (face_view(run.side) === "front") {
    fill_rounded_rect(ctx, face.x + 1.5, face.y + 1.4, face.width - 3, 2.2, 0.6, css(RECESS));
    fill_polygon(
      ctx,
      [
        [face.x + 2.2, face.y + 2.4],
        [face.x + face.width - 2.2, face.y + 2.4],
        [face.x + face.width - 3, face.y + 6.4],
        [face.x + 3, face.y + 6.8],
      ],
      css(0xffffff),
    );
  } else {
    fill_polygon(
      ctx,
      [
        [foot.x - 2.4, foot.y - 9.4],
        [foot.x + 2.4, foot.y - 9.4],
        [foot.x + 1.2, foot.y - 12.4],
        [foot.x - 1.4, foot.y - 12],
      ],
      css(0xffffff),
    );
  }
}

/**
 * Paints the water carafe station: a steel counter clad in pale glazed tiles, a drip tray with
 * three glass carafes of water, stacks of cups and a teal "WATER" panel with a drop sign, which
 * carries a camera-facing drop blade when the station is seen end-on.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_water_station(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 25, front_gap: 4, end_gap: 3, rise: 35 });
  const lift = COUNTER_LIFT;
  cast_shadow(ctx, run.ground, lift);
  paint_cabinet_counter(ctx, run, lift, frame, recipe.seed, (face) =>
    paint_tiled_face(ctx, face, frame),
  );
  const drip = run.segment(0.06, 0.52, 4, 18);
  paint_prism(ctx, drip, lift + 1.2, 0x56625f, frame, { base: lift, radius: 1 });
  if (!frame.isLowDetail) {
    for (let index = 1; index < 6; index += 1) {
      const start = lifted(run.at(0.06 + index * 0.077, 5), lift + 1.3);
      const end = lifted(run.at(0.06 + index * 0.077, 17), lift + 1.3);
      line(ctx, start.x, start.y, end.x, end.y, css(0x2e3a38, 0.8), 0.6);
    }
  }
  const parts: Part[] = [0.15, 0.29, 0.43].map((along) =>
    prop(run, along, 11, lift + 1.2, (foot) => paint_carafe(ctx, foot, frame)),
  );
  for (const along of [0.6, 0.68]) {
    parts.push(prop(run, along, 8, lift, (foot) => paint_cup_stack(ctx, foot, frame)));
  }
  const panel = run.segment(0.58, 0.97, run.reach - 2.6, run.reach - 0.4);
  parts.push({
    depth: ground_bottom(panel),
    draw: () => {
      paint_prism(ctx, panel, lift + 14, TEAL_STEEL, frame, { base: lift, radius: 1 });
      if (face_view(run.side) !== "end") {
        paint_water_sign(ctx, face_of(panel, lift + 14, lift));
        return;
      }
      const south_end = run.side === "west" ? 0.97 : 0.58;
      const anchor = lifted(run.at(south_end, run.reach - 1.5), lift + 14);
      paint_end_blade(ctx, anchor, run.side, TEAL_STEEL, ["drop"], frame);
    },
  });
  paint_parts(parts);
}

/**
 * Clads a counter face in small pale glazed tiles over a steel kick plate.
 *
 * @param ctx - The paint context.
 * @param face - The face rectangle.
 * @param frame - The paint frame.
 */
function paint_tiled_face(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  frame: PaintFrame,
): void {
  const tile_area = {
    x: face.x + 1,
    y: face.y + 2.5,
    width: face.width - 2,
    height: face.height - 6,
  };
  fill_rounded_rect(
    ctx,
    tile_area.x,
    tile_area.y,
    tile_area.width,
    tile_area.height,
    0.8,
    css(TILE_TEAL),
  );
  if (!frame.isLowDetail) {
    ctx.fillStyle = css(0x8fb8b2, 0.8);
    for (let x = tile_area.x + 4; x < tile_area.x + tile_area.width - 0.5; x += 4) {
      ctx.fillRect(x, tile_area.y, 0.5, tile_area.height);
    }
    for (let y = tile_area.y + 4; y < tile_area.y + tile_area.height - 0.5; y += 4) {
      ctx.fillRect(tile_area.x, y, tile_area.width, 0.5);
    }
  }
  ctx.fillStyle = css(0xffffff, 0.35);
  ctx.fillRect(tile_area.x, tile_area.y, tile_area.width, 0.8);
  ctx.fillStyle = css(DARK_STEEL);
  ctx.fillRect(face.x + 1, face.y + face.height - 3.2, face.width - 2, 2.6);
}

/**
 * Paints a glass carafe of water with a steel lid and a handle.
 *
 * @param ctx - The paint context.
 * @param foot - The carafe's screen foot.
 * @param frame - The paint frame.
 */
function paint_carafe(ctx: PaintContext, foot: Point, frame: PaintFrame): void {
  fill_ellipse(ctx, foot.x + 1, foot.y + 0.6, 4, 1.6, css(INK, 0.2));
  paint_cylinder(ctx, foot.x, foot.y, 3.4, 7.5, WATER, frame, { alpha: 0.8, is_bare: true });
  paint_cylinder(ctx, foot.x, foot.y, 3.7, 11.5, 0xe2f3f5, frame, { alpha: 0.3 });
  fill_ellipse(ctx, foot.x, foot.y - 11.5, 3.7, 2.1, css(STAINLESS));
  fill_ellipse(ctx, foot.x - 0.8, foot.y - 11.9, 1.6, 0.7, css(0xffffff, 0.7));
  ctx.beginPath();
  ctx.arc(foot.x + 3.9, foot.y - 7, 2.2, -Math.PI / 2, Math.PI / 2, false);
  ctx.strokeStyle = css(0xdff2f4, 0.85);
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

/**
 * Paints a stack of nested white cups.
 *
 * @param ctx - The paint context.
 * @param foot - The stack's screen foot.
 * @param frame - The paint frame.
 */
function paint_cup_stack(ctx: PaintContext, foot: Point, frame: PaintFrame): void {
  paint_cylinder(ctx, foot.x, foot.y, 2.6, 9, PORCELAIN, frame, { cap: 0xd9dcd6 });
  for (let ring = 1; ring < 5; ring += 1) {
    ctx.fillStyle = css(0xb9bfba, 0.7);
    ctx.fillRect(foot.x - 2.6, foot.y - ring * 1.8, 5.2, 0.5);
  }
}

/**
 * Paints the water station's sign panel: a white drop on teal and the word "WATER".
 *
 * @param ctx - The paint context.
 * @param face - The panel's south face.
 */
function paint_water_sign(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
): void {
  const cx = face.x + 6;
  const cy = face.y + face.height / 2;
  fill_polygon(
    ctx,
    [
      [cx, cy - 4.4],
      [cx - 2.8, cy + 0.2],
      [cx + 2.8, cy + 0.2],
    ],
    css(0xffffff),
  );
  fill_circle(ctx, cx, cy + 0.6, 2.8, css(0xffffff));
  fill_circle(ctx, cx - 0.9, cy + 0.3, 0.8, css(WATER));
  label(ctx, "Water", face.x + 6 + (face.width - 6) / 2, cy + 0.4, {
    maxWidth: face.width - 12,
    size: 7,
    colour: CREAM,
    uppercase: true,
  });
}

/**
 * Paints the order pickup pass: a steel counter with a "PICK UP" strip, four numbered bays with
 * plated orders and their tickets, and a heated upper shelf whose lamps pool warm light on them.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_pickup_pass(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 26, front_gap: 4, end_gap: 3, rise: 34 });
  cast_shadow(ctx, run.ground, PASS_LIFT);
  paint_cabinet_counter(ctx, run, PASS_LIFT, frame, recipe.seed, (face, view) => {
    paint_cabinet_face(ctx, face, 3);
    if (view === "front") {
      paint_sign_strip(
        ctx,
        { x: face.x + face.width * 0.22, y: face.y + 2.2, width: face.width * 0.56, height: 5.4 },
        VERMILION,
        "Pick up",
        frame,
      );
    }
  });
  const deck = run.segment(0, 1, 1, run.reach - 1);
  const deck_top = { x: deck.x, y: deck.y - PASS_LIFT, width: deck.width, height: deck.depth };
  ctx.fillStyle = css(LAMP_LIGHT, frame.isLowDetail ? 0.12 : 0.2);
  ctx.fillRect(deck_top.x, deck_top.y, deck_top.width, deck_top.height);
  const bays = 4;
  for (let bay = 0; bay < bays; bay += 1) {
    const centre = lifted(run.at((bay + 0.5) / bays, 11), PASS_LIFT);
    paint_glow(ctx, frame, centre.x, centre.y, 10, LAMP_LIGHT, 0.4);
  }
  paint_parts(pickup_bay_parts(ctx, run, frame, bays));
  paint_pass_shelf(ctx, run, frame, bays);
}

/**
 * Lists the pickup pass's divider fins and the plated orders in its bays.
 *
 * @param ctx - The paint context.
 * @param run - The pass run.
 * @param frame - The paint frame.
 * @param bays - Number of bays.
 * @returns The parts.
 */
function pickup_bay_parts(ctx: PaintContext, run: Run, frame: PaintFrame, bays: number): Part[] {
  const foods = [0xe2b04a, 0xc9783f, 0x9c5a2e, 0xf1e3c4] as const;
  const parts: Part[] = [];
  for (let bay = 1; bay < bays; bay += 1) {
    const fin = run.segment(bay / bays - 0.006, bay / bays + 0.006, 2, run.reach - 3);
    parts.push({
      depth: ground_bottom(fin),
      draw: () =>
        paint_prism(ctx, fin, PASS_LIFT + 4, STAINLESS, frame, { base: PASS_LIFT, radius: 0.5 }),
    });
  }
  for (let bay = 0; bay < bays; bay += 1) {
    const food = foods[bay % foods.length] ?? foods[0];
    parts.push(
      prop(run, (bay + 0.5) / bays, 9, PASS_LIFT, (foot) => {
        fill_ellipse(ctx, foot.x + 0.8, foot.y + 0.6, 5.2, 2.6, css(INK, 0.2));
        fill_ellipse(ctx, foot.x, foot.y - 0.6, 5.2, 2.8, css(PORCELAIN));
        fill_ellipse(ctx, foot.x, foot.y - 1.2, 3.4, 1.8, css(food));
        fill_ellipse(ctx, foot.x - 1, foot.y - 1.7, 1.3, 0.6, css(tint(food, 0.45)));
      }),
    );
    parts.push(
      prop(run, (bay + 0.5) / bays + 0.06, 15, PASS_LIFT, (foot) => {
        fill_rounded_rect(ctx, foot.x - 1.6, foot.y - 5, 3.2, 4.4, 0.4, css(0xffffff));
        ctx.fillStyle = css(VERMILION);
        ctx.fillRect(foot.x - 1.2, foot.y - 4.2, 2.4, 0.7);
      }),
    );
  }
  return parts;
}

/**
 * Paints the pass's heated upper shelf on two posts, with the amber lamp lenses on its front and
 * number tags hanging over each bay.
 *
 * @param ctx - The paint context.
 * @param run - The pass run.
 * @param frame - The paint frame.
 * @param bays - Number of bays.
 */
function paint_pass_shelf(ctx: PaintContext, run: Run, frame: PaintFrame, bays: number): void {
  for (const along of [0.005, 0.995]) {
    const post = lifted(run.at(along, run.reach - 2.5), PASS_LIFT);
    paint_tube_post(ctx, post.x, post.y, PASS_SHELF - PASS_LIFT, frame, 2.2);
  }
  const shelf = run.segment(0, 1, run.reach - 12, run.reach - 0.5);
  paint_prism(ctx, shelf, PASS_SHELF + 2.5, STAINLESS, frame, { base: PASS_SHELF, is_steel: true });
  if (face_view(run.side) !== "front") return;
  const face = face_of(shelf, PASS_SHELF + 2.5, PASS_SHELF);
  for (let bay = 0; bay < bays; bay += 1) {
    const x = face.x + (face.width * (bay + 0.5)) / bays;
    for (const offset of [-3.5, 3.5]) {
      fill_circle(ctx, x + offset, face.y + face.height + 0.4, 1.3, css(0xffc46b));
      paint_glow(ctx, frame, x + offset, face.y + face.height + 1, 4, 0xffb347, 0.6);
    }
    fill_rounded_rect(ctx, x - 3, face.y + face.height + 1, 6, 6, 0.8, css(0xffffff));
    label(ctx, String(bay + 1), x, face.y + face.height + 4.1, {
      maxWidth: 5,
      size: 6,
      colour: INK,
    });
  }
}
