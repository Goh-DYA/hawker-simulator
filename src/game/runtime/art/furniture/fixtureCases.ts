/**
 * The glazed and wheeled stall fixtures: the heated display case (a sloped-front warmer glowing
 * amber over trays of fried snacks), the chilled display case (an upright white-framed chiller
 * with drinks and dessert cups behind cold glass) and the mobile prep cart (a two-shelf stainless
 * trolley on castors with a push handle, a padlocked cabinet and prep on its top).
 *
 * Like the other fixtures they are laid out along their service edge with a {@link Run}, so they
 * turn with the placement rotation without the light or the shadows turning with them.
 */
import type { Rotation } from "@/src/game/core";

import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  line,
  linear_gradient,
  seeded,
  shade,
  tint,
  type PaintContext,
} from "../canvas";
import { OVERHANG, type PaintFrame } from "../specs";
import { DARK_STEEL, type Box } from "./shared";
import {
  cast_shadow,
  edge_style,
  face_of,
  face_view,
  ground_bottom,
  INK,
  lifted,
  make_run,
  paint_bottle,
  paint_cylinder,
  paint_glass,
  paint_glow,
  paint_padlock,
  paint_parts,
  paint_prism,
  paint_service_sliver,
  RECESS,
  STAINLESS,
  TEAL_STEEL,
  VERMILION,
  type Ground,
  type Part,
  type Point,
  type Run,
} from "./steelwork";

/** Height of the warmer's base cabinet. */
const WARMER_BASE = 13;
/** Height of the warmer's glass roof. */
const WARMER_TOP = 31;
/** How far the warmer's sloped front glass leans back at the top. */
const WARMER_SLOPE = 6;
/** Height of the chiller's base cabinet. */
const CHILLER_BASE = 11;
/** Height of the chiller's glass roof. */
const CHILLER_GLASS = 30;
/** Height of the chiller's lit canopy along its back. */
const CHILLER_TOP = 34;
/** White enamel of the chiller cabinet. */
const ENAMEL = 0xe9eeec;
/** Cold glass tint. */
const COLD_GLASS = 0xbfe9f7;
/** Golden fried pastry. */
const PASTRY = 0xd9a24a;
/** Glazed wing brown. */
const GLAZE = 0xb8612d;
/** Height of the prep cart's worktop. */
const CART_TOP = 19;

/**
 * Paints a heated or chilled display case, chosen by the recipe motif.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
export function paint_display_case(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  if (recipe.motif.includes("chilled")) paint_chiller(ctx, box, recipe, frame, rotation);
  else paint_warmer(ctx, box, recipe, frame, rotation);
}

/**
 * Paints the heated display case: a steel base with a control strip, then a glass warmer whose
 * front leans back, lit amber inside, with two tiers of trays of curry puffs, wings and spring
 * rolls.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_warmer(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, {
    reach: 24,
    front_gap: 4,
    end_gap: 3,
    rise: WARMER_TOP + 2,
  });
  cast_shadow(ctx, run.ground, WARMER_TOP);
  paint_prism(ctx, run.ground, WARMER_BASE, STAINLESS, frame, {
    is_steel: true,
    seed: recipe.seed,
  });
  const base_face = face_of(run.ground, WARMER_BASE);
  paint_case_controls(ctx, base_face, face_view(run.side), VERMILION, frame);
  const roof = run.segment(0, 1, WARMER_SLOPE, run.reach);
  const silhouette = case_silhouette(run, roof, WARMER_BASE, WARMER_TOP);
  fill_polygon(ctx, silhouette, css(0xffc46b, 0.2));
  const glow_radius = Math.min(26, run.ground.width / 2 + 4, run.ground.depth / 2 + 8);
  paint_glow(
    ctx,
    frame,
    run.ground.x + run.ground.width / 2,
    ground_bottom(run.ground) - run.ground.depth / 2 - 20,
    glow_radius,
    0xffb347,
    0.28,
  );
  const trays: Part[] = [];
  const kinds = ["puff", "wing", "roll"] as const;
  kinds.forEach((kind, index) => {
    const lower = run.segment(0.04 + index * 0.32, 0.32 + index * 0.32, 2.5, run.reach - 9);
    trays.push({
      depth: ground_bottom(lower),
      draw: () => paint_food_tray(ctx, lower, WARMER_BASE, kind, frame, recipe.seed + index),
    });
    const upper = run.segment(
      0.04 + index * 0.32,
      0.32 + index * 0.32,
      run.reach - 9,
      run.reach - 2,
    );
    trays.push({
      depth: ground_bottom(upper),
      draw: () =>
        paint_food_tray(
          ctx,
          upper,
          WARMER_BASE + 8,
          kinds[(index + 1) % 3] ?? kind,
          frame,
          recipe.seed + 7 + index,
        ),
    });
  });
  paint_parts(trays);
  paint_case_glass(ctx, run, roof, WARMER_BASE, WARMER_TOP, 0xffe2b0, frame, true);
  const lamp_start = lifted(run.at(0.02, WARMER_SLOPE + 1), WARMER_TOP - 1);
  const lamp_end = lifted(run.at(0.98, WARMER_SLOPE + 1), WARMER_TOP - 1);
  line(ctx, lamp_start.x, lamp_start.y, lamp_end.x, lamp_end.y, css(0xffe6a8), 1.2);
  paint_service_sliver(ctx, run, WARMER_BASE, VERMILION);
}

/**
 * Builds the screen outline of a glass case: its roof and the visible south side below it.
 *
 * @param run - The case run.
 * @param roof - The roof's ground rectangle.
 * @param base - Height of the case floor.
 * @param top - Height of the roof.
 * @returns The polygon points.
 */
function case_silhouette(run: Run, roof: Ground, base: number, top: number): [number, number][] {
  const ground = run.ground;
  const bottom = ground_bottom(ground);
  return [
    [roof.x, roof.y - top],
    [roof.x + roof.width, roof.y - top],
    [ground.x + ground.width, Math.max(ground_bottom(roof), bottom) - top],
    [ground.x + ground.width, bottom - base],
    [ground.x, bottom - base],
    [ground.x, Math.max(ground_bottom(roof), bottom) - top],
  ];
}

/**
 * Paints the glass of a case over its contents: the visible south pane (the sloped front, the
 * rear doors or the end panel), the roof glass, the steel frame and, for a sloped front seen
 * end-on, the leaning front pane.
 *
 * @param ctx - The paint context.
 * @param run - The case run.
 * @param roof - The roof's ground rectangle.
 * @param base - Height of the case floor.
 * @param top - Height of the roof.
 * @param glass - The glass tint.
 * @param frame - The paint frame.
 * @param is_sloped - True when the front leans back by {@link WARMER_SLOPE}.
 */
function paint_case_glass(
  ctx: PaintContext,
  run: Run,
  roof: Ground,
  base: number,
  top: number,
  glass: number,
  frame: PaintFrame,
  is_sloped: boolean,
): void {
  const slope = is_sloped ? WARMER_SLOPE : 0;
  const front = [
    lifted(run.at(0, 0), base),
    lifted(run.at(0, slope), top),
    lifted(run.at(1, slope), top),
    lifted(run.at(1, 0), base),
  ];
  const ground = run.ground;
  const bottom = ground_bottom(ground);
  const view = face_view(run.side);
  if (view === "end") {
    fill_polygon(
      ctx,
      front.map((point) => [point.x, point.y] as [number, number]),
      css(glass, 0.16),
    );
    const near = run.side === "west" ? ground.x : ground.x + ground.width;
    const far = run.side === "west" ? ground.x + ground.width : ground.x;
    const lean = run.side === "west" ? slope : -slope;
    fill_polygon(
      ctx,
      [
        [near, bottom - base],
        [near + lean, bottom - top],
        [far, bottom - top],
        [far, bottom - base],
      ],
      css(glass, 0.24),
    );
  } else {
    const pane = {
      x: ground.x,
      y: bottom - (view === "front" ? slope : 0) - top,
      width: ground.width,
      height: top - base + (view === "front" ? slope : 0),
    };
    paint_glass(ctx, pane, glass, 0.18);
    if (view === "back") {
      const middle = ground.x + ground.width / 2;
      line(ctx, middle, pane.y + 1, middle, pane.y + pane.height - 1, css(STAINLESS), 1.2);
      for (const x of [middle - 5, middle + 5])
        fill_circle(ctx, x, pane.y + pane.height / 2, 1, css(DARK_STEEL));
    }
  }
  paint_glass_roof(ctx, roof, top, glass);
  const edge = edge_style(frame, STAINLESS);
  const rail = frame.isHighContrast ? edge.style : css(tint(STAINLESS, 0.3));
  ctx.strokeStyle = rail;
  ctx.lineWidth = frame.isHighContrast ? 2 : 1.2;
  ctx.beginPath();
  ctx.rect(roof.x, roof.y - top, roof.width, roof.depth);
  ctx.stroke();
  for (const x of [ground.x + 0.6, ground.x + ground.width - 0.6]) {
    line(ctx, x, bottom - base, x, Math.max(ground_bottom(roof), bottom) - top, rail, 1.2);
  }
  line(ctx, ground.x, bottom - base, ground.x + ground.width, bottom - base, rail, 1);
}

/**
 * Paints the roof glass of a case.
 *
 * @param ctx - The paint context.
 * @param roof - The roof's ground rectangle.
 * @param top - The roof height.
 * @param glass - The glass tint.
 */
function paint_glass_roof(ctx: PaintContext, roof: Ground, top: number, glass: number): void {
  paint_glass(
    ctx,
    { x: roof.x, y: roof.y - top, width: roof.width, height: roof.depth },
    glass,
    0.14,
  );
}

/**
 * Paints a gastronorm tray of food on a case shelf.
 *
 * @param ctx - The paint context.
 * @param tray - The tray's ground rectangle.
 * @param height - Height of the shelf it sits on.
 * @param kind - What is in the tray.
 * @param frame - The paint frame.
 * @param seed - Seed for the arrangement.
 */
function paint_food_tray(
  ctx: PaintContext,
  tray: Ground,
  height: number,
  kind: "puff" | "wing" | "roll" | "ball",
  frame: PaintFrame,
  seed: number,
): void {
  paint_prism(ctx, tray, height + 1.6, STAINLESS, frame, {
    base: height,
    radius: 0.8,
    is_bare: true,
  });
  const next = seeded(seed);
  const top = tray.y - height - 1.6;
  const count = frame.isLowDetail ? 3 : Math.max(3, Math.round(tray.width / 4));
  for (let index = 0; index < count; index += 1) {
    const x = tray.x + 2 + ((index + 0.5) / count) * (tray.width - 4);
    const y = top + 1.5 + next() * Math.max(0.5, tray.depth - 3);
    if (kind === "puff") {
      ctx.beginPath();
      ctx.ellipse(x, y, 2.4, 1.6, 0, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle = css(PASTRY);
      ctx.fill();
      line(ctx, x - 2, y, x + 2, y, css(shade(PASTRY, 0.35)), 0.6);
    } else if (kind === "wing") {
      fill_ellipse(ctx, x, y, 2.2, 1.4, css(GLAZE));
      fill_ellipse(ctx, x - 0.6, y - 0.5, 0.9, 0.5, css(tint(GLAZE, 0.5)));
    } else if (kind === "roll") {
      fill_rounded_rect(ctx, x - 2.6, y - 0.9, 5.2, 1.9, 0.9, css(0xd6a04f));
      line(ctx, x - 1.8, y - 0.4, x + 1.8, y - 0.4, css(tint(0xd6a04f, 0.45)), 0.5);
    } else {
      fill_circle(ctx, x, y, 1.5, css(0xe2b25a));
      fill_circle(ctx, x - 0.5, y - 0.5, 0.4, css(0xfff4dc));
    }
  }
}

/**
 * Details a case's base cabinet face: a coloured control strip with a dial and a pilot light on
 * the front, vent slots behind or at an end.
 *
 * @param ctx - The paint context.
 * @param face - The base cabinet's south face.
 * @param view - Which side of the case faces the camera.
 * @param accent - The control strip colour.
 * @param frame - The paint frame.
 */
function paint_case_controls(
  ctx: PaintContext,
  face: { x: number; y: number; width: number; height: number },
  view: "front" | "back" | "end",
  accent: number,
  frame: PaintFrame,
): void {
  if (view === "front") {
    fill_rounded_rect(ctx, face.x + 2, face.y + 2, face.width - 4, 3.2, 0.8, css(accent));
    fill_circle(ctx, face.x + face.width - 8, face.y + 8, 1.8, css(INK));
    fill_circle(ctx, face.x + face.width - 8.5, face.y + 7.5, 0.6, css(0xffffff, 0.6));
    fill_circle(ctx, face.x + face.width - 13, face.y + 8, 0.9, css(0xff5a3a));
    paint_glow(ctx, frame, face.x + face.width - 13, face.y + 8, 3, 0xff5a3a, 0.5);
  }
  const slots = view === "end" ? 2 : 5;
  for (let index = 0; index < slots; index += 1) {
    const x = face.x + 4 + index * 4;
    ctx.fillStyle = css(RECESS, 0.55);
    ctx.fillRect(x, face.y + face.height - 5, 2.4, 2);
  }
}

/**
 * Paints the chilled display case: a white enamel base with a vent grille, a cold-lit glass box
 * with a glass roof showing a shelf of bottled drinks and cans over a deck of dessert cups, a
 * blue-lit light canopy along its back and an opaque enamel back panel.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
function paint_chiller(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, {
    reach: 23,
    front_gap: 4,
    end_gap: 3,
    rise: CHILLER_TOP + 1,
  });
  const view = face_view(run.side);
  cast_shadow(ctx, run.ground, CHILLER_TOP);
  paint_prism(ctx, run.ground, CHILLER_BASE, ENAMEL, frame, { radius: 2 });
  const base_face = face_of(run.ground, CHILLER_BASE);
  for (let index = 0; index < 5; index += 1) {
    ctx.fillStyle = css(RECESS, 0.5);
    ctx.fillRect(base_face.x + 4, base_face.y + 2 + index * 1.5, base_face.width - 8, 0.7);
  }
  const back = run.segment(0, 1, run.reach - 2, run.reach);
  fill_polygon(
    ctx,
    case_silhouette(run, run.ground, CHILLER_BASE, CHILLER_GLASS),
    css(COLD_GLASS, 0.3),
  );
  const parts: Part[] = chiller_contents(ctx, run, frame, recipe.seed);
  parts.push({
    depth: ground_bottom(back) + (view === "back" ? 1 : -60),
    draw: () => {
      paint_prism(ctx, back, CHILLER_GLASS, ENAMEL, frame, { base: CHILLER_BASE, radius: 0.5 });
      if (view !== "back") return;
      const face = face_of(back, CHILLER_GLASS, CHILLER_BASE);
      for (let index = 0; index < 5; index += 1) {
        ctx.fillStyle = css(RECESS, 0.4);
        ctx.fillRect(face.x + face.width * 0.3, face.y + 4 + index * 2.5, face.width * 0.4, 1);
      }
    },
  });
  paint_parts(parts);
  const roof = run.segment(0, 1, 0, run.reach - 5);
  if (view !== "back") {
    paint_case_glass(ctx, run, roof, CHILLER_BASE, CHILLER_GLASS, COLD_GLASS, frame, false);
  } else {
    paint_glass_roof(ctx, roof, CHILLER_GLASS, COLD_GLASS);
  }
  if (view === "front" && !frame.isLowDetail) paint_condensation(ctx, run, recipe.seed);
  const canopy = run.segment(0, 1, run.reach - 5, run.reach);
  paint_prism(ctx, canopy, CHILLER_TOP, ENAMEL, frame, { base: CHILLER_GLASS, radius: 1 });
  const glow_at = lifted(run.at(0.5, run.reach - 6), CHILLER_GLASS);
  // The glow stays inside the texture, so the overhang never cuts it off flat.
  const radius = Math.min(
    18,
    run.ground.width / 2,
    run.ground.depth / 2 + 6,
    glow_at.y - (box.y - OVERHANG),
    glow_at.x - box.x,
    box.right - glow_at.x,
  );
  paint_glow(ctx, frame, glow_at.x, glow_at.y, radius, 0xbfeaff, 0.45);
  const strip_start = lifted(run.at(0.02, run.reach - 5), CHILLER_GLASS);
  const strip_end = lifted(run.at(0.98, run.reach - 5), CHILLER_GLASS);
  line(ctx, strip_start.x, strip_start.y, strip_end.x, strip_end.y, css(0x7fd3f5), 1.4);
  paint_service_sliver(ctx, run, CHILLER_GLASS, TEAL_STEEL, CHILLER_BASE);
}

/**
 * Lists the chiller's contents: dessert cups on the deck and bottles and cans on the glass shelf.
 *
 * @param ctx - The paint context.
 * @param run - The case run.
 * @param frame - The paint frame.
 * @param seed - Seed for the colours.
 * @returns The parts.
 */
function chiller_contents(ctx: PaintContext, run: Run, frame: PaintFrame, seed: number): Part[] {
  const desserts = [0x7fb069, 0xf2a03d, 0x3b2a26, 0xe7c7d8] as const;
  const drinks = [0x2f8f6a, 0xd95d39, 0xf2c14e, 0x3d6fa8, 0xc8372d] as const;
  const parts: Part[] = [];
  const next = seeded(seed);
  const cups = frame.isLowDetail ? 4 : 7;
  for (let index = 0; index < cups; index += 1) {
    const along = 0.07 + (index / (cups - 1)) * 0.86;
    const ground = run.at(along, 7);
    const colour = desserts[index % desserts.length] ?? desserts[0];
    parts.push({
      depth: ground.y,
      draw: () => {
        const foot = lifted(ground, CHILLER_BASE);
        paint_cylinder(ctx, foot.x, foot.y, 2.1, 4, 0xf4f8f8, frame, { alpha: 0.7, is_bare: true });
        fill_ellipse(ctx, foot.x, foot.y - 3.6, 1.9, 1.1, css(colour));
      },
    });
  }
  const shelf = run.segment(0, 1, 3, run.reach - 2);
  parts.push({
    depth: ground_bottom(shelf) - 0.1,
    draw: () =>
      paint_prism(ctx, shelf, CHILLER_BASE + 11, COLD_GLASS, frame, {
        base: CHILLER_BASE + 10,
        is_bare: true,
        lip: 1,
      }),
  });
  const bottles = frame.isLowDetail ? 5 : 9;
  for (let index = 0; index < bottles; index += 1) {
    const along = 0.06 + (index / (bottles - 1)) * 0.88;
    const ground = run.at(along, 10 + next() * 4);
    const colour = drinks[index % drinks.length] ?? drinks[0];
    parts.push({
      depth: ground_bottom(shelf) + ground.y / 1000,
      draw: () => {
        const foot = lifted(ground, CHILLER_BASE + 11);
        if (index % 3 === 1) {
          paint_cylinder(ctx, foot.x, foot.y, 1.8, 5, colour, frame, {
            cap: STAINLESS,
            is_bare: true,
          });
        } else {
          paint_bottle(ctx, foot.x, foot.y, 8.5, colour, 0xf2eee4, { alpha: 0.92 });
        }
      },
    });
  }
  return parts;
}

/**
 * Speckles a chiller's front glass with condensation beads.
 *
 * @param ctx - The paint context.
 * @param run - The case run.
 * @param seed - Seed for the bead positions.
 */
function paint_condensation(ctx: PaintContext, run: Run, seed: number): void {
  const next = seeded(seed + 11);
  const ground = run.ground;
  const bottom = ground_bottom(ground);
  for (let index = 0; index < 14; index += 1) {
    const x = ground.x + 2 + next() * (ground.width - 4);
    const y = bottom - CHILLER_BASE - 2 - next() * (CHILLER_GLASS - CHILLER_BASE - 4);
    fill_circle(ctx, x, y, 0.35 + next() * 0.4, css(0xffffff, 0.55));
  }
}

/**
 * Paints the mobile prep cart: a stainless trolley on four castors with a lower shelf, a
 * padlocked cabinet between the shelves, a push handle at one end and a worktop with a cutting
 * board of spring onion and pans of bean sprouts, chilli and fish balls.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation.
 */
export function paint_prep_cart(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation,
): void {
  const run = make_run(box, rotation, { reach: 22, front_gap: 6, end_gap: 7, rise: CART_TOP + 12 });
  cast_shadow(ctx, run.segment(0.02, 0.98, 1, run.reach - 1), 8);
  const parts: Part[] = [];
  for (const along of [0.04, 0.96]) {
    for (const front of [2, run.reach - 2]) {
      const ground = run.at(along, front);
      parts.push({ depth: ground.y, draw: () => paint_castor(ctx, ground, frame) });
    }
  }
  const shelf = run.segment(0, 1, 0, run.reach);
  parts.push({
    depth: ground_bottom(shelf) - 0.5,
    draw: () =>
      paint_prism(ctx, shelf, 6, STAINLESS, frame, { base: 4, is_steel: true, seed: recipe.seed }),
  });
  const cabinet = run.segment(0.28, 0.72, 1.5, run.reach - 1.5);
  parts.push({
    depth: ground_bottom(cabinet) - 0.4,
    draw: () => paint_cart_cabinet(ctx, run, cabinet, frame),
  });
  for (const along of [0.0, 0.97]) {
    for (const front of [0, run.reach - 1.6]) {
      const leg = run.segment(along, along + 0.03, front, front + 1.6);
      parts.push({
        depth: ground_bottom(leg) + 0.1,
        draw: () =>
          paint_prism(ctx, leg, CART_TOP - 2, STAINLESS, frame, { base: 6, radius: 0.6, lip: 0.3 }),
      });
    }
  }
  paint_parts(parts);
  paint_prism(ctx, run.ground, CART_TOP, STAINLESS, frame, {
    base: CART_TOP - 2.5,
    is_steel: true,
    seed: recipe.seed + 1,
    lip: 1,
  });
  paint_cart_top(ctx, run, frame, recipe.seed);
  paint_cart_handle(ctx, run, frame);
}

/**
 * Paints one swivel castor: a dark rubber wheel in a steel fork.
 *
 * @param ctx - The paint context.
 * @param ground - The castor's ground point.
 * @param frame - The paint frame.
 */
function paint_castor(ctx: PaintContext, ground: Point, frame: PaintFrame): void {
  fill_ellipse(ctx, ground.x + 0.8, ground.y + 0.6, 2.6, 1.2, css(INK, 0.3));
  fill_rounded_rect(ctx, ground.x - 1.2, ground.y - 5, 2.4, 2.6, 0.5, css(STAINLESS));
  fill_circle(ctx, ground.x, ground.y - 2.1, 2.1, css(0x2b3335));
  fill_circle(ctx, ground.x, ground.y - 2.1, 0.8, css(0x9aa5a2));
  if (frame.isHighContrast) {
    ctx.beginPath();
    ctx.arc(ground.x, ground.y - 2.1, 2.1, 0, Math.PI * 2);
    ctx.strokeStyle = css(INK);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Paints the cart's lockable cabinet between its shelves, with a hasp and padlock on its front.
 *
 * @param ctx - The paint context.
 * @param run - The cart run.
 * @param cabinet - The cabinet's ground rectangle.
 * @param frame - The paint frame.
 */
function paint_cart_cabinet(ctx: PaintContext, run: Run, cabinet: Ground, frame: PaintFrame): void {
  const top = CART_TOP - 2.5;
  paint_prism(ctx, cabinet, top, shade(STAINLESS, 0.08), frame, {
    base: 6,
    is_steel: true,
    lip: 0.4,
  });
  const view = face_view(run.side);
  const face = face_of(cabinet, top, 6);
  if (view === "front") {
    line(
      ctx,
      face.x + face.width / 2,
      face.y + 1,
      face.x + face.width / 2,
      face.y + face.height - 1,
      css(RECESS, 0.5),
      0.8,
    );
    paint_padlock(ctx, face.x + face.width / 2, face.y + face.height / 2 + 1);
  } else {
    fill_rounded_rect(
      ctx,
      face.x + 2,
      face.y + 2,
      face.width - 4,
      face.height - 4,
      0.6,
      css(shade(STAINLESS, 0.2)),
    );
  }
}

/**
 * Paints the prep on the cart's worktop: a timber board with chopped spring onion and a cleaver,
 * and three pans of bean sprouts, sliced chilli and fish balls.
 *
 * @param ctx - The paint context.
 * @param run - The cart run.
 * @param frame - The paint frame.
 * @param seed - Seed for the scatter.
 */
function paint_cart_top(ctx: PaintContext, run: Run, frame: PaintFrame, seed: number): void {
  const parts: Part[] = [];
  const board = run.segment(0.06, 0.38, 3, run.reach - 4);
  parts.push({
    depth: ground_bottom(board),
    draw: () => {
      paint_prism(ctx, board, CART_TOP + 1.6, 0xc89a62, frame, { base: CART_TOP, radius: 1 });
      const next = seeded(seed);
      const count = frame.isLowDetail ? 4 : 10;
      for (let index = 0; index < count; index += 1) {
        const x = board.x + 2 + next() * (board.width - 6);
        const y = board.y - CART_TOP - 1.6 + 1.5 + next() * (board.depth - 4);
        fill_circle(ctx, x, y, 0.8, css(index % 3 ? 0x5d9b4c : 0xa9cf7a));
      }
      const blade = lifted(run.at(0.3, run.reach / 2), CART_TOP + 1.8);
      fill_rounded_rect(ctx, blade.x - 3, blade.y - 2.2, 6, 3.4, 0.6, css(tint(STAINLESS, 0.25)));
      fill_rounded_rect(ctx, blade.x + 2.6, blade.y - 1.4, 3.4, 1.6, 0.6, css(0x3a2a20));
    },
  });
  const fillings = [0xf1e8c8, 0xc8372d, 0xf4f1e6] as const;
  fillings.forEach((filling, index) => {
    const pan = run.segment(0.44 + index * 0.18, 0.6 + index * 0.18, 3, run.reach - 3);
    parts.push({
      depth: ground_bottom(pan),
      draw: () => paint_pan(ctx, pan, filling, frame, seed + index),
    });
  });
  paint_parts(parts);
}

/**
 * Paints a stainless pan of prepared ingredients sunk into the cart's worktop.
 *
 * @param ctx - The paint context.
 * @param pan - The pan's ground rectangle.
 * @param filling - The ingredient colour.
 * @param frame - The paint frame.
 * @param seed - Seed for the scatter.
 */
function paint_pan(
  ctx: PaintContext,
  pan: Ground,
  filling: number,
  frame: PaintFrame,
  seed: number,
): void {
  const top_y = pan.y - CART_TOP - 1.2;
  fill_rounded_rect(ctx, pan.x, top_y, pan.width, pan.depth, 1, css(tint(STAINLESS, 0.2)));
  fill_rounded_rect(
    ctx,
    pan.x + 1,
    top_y + 1,
    pan.width - 2,
    pan.depth - 2,
    0.8,
    linear_gradient(ctx, 0, top_y, 0, top_y + pan.depth, [
      [0, shade(filling, 0.25)],
      [1, filling],
    ]),
  );
  const next = seeded(seed);
  const count = frame.isLowDetail ? 3 : 7;
  for (let index = 0; index < count; index += 1) {
    const x = pan.x + 2 + next() * (pan.width - 4);
    const y = top_y + 2 + next() * (pan.depth - 4);
    fill_circle(ctx, x, y, 0.7, css(tint(filling, 0.4)));
  }
  const edge = edge_style(frame, STAINLESS);
  ctx.strokeStyle = edge.style;
  ctx.lineWidth = edge.width;
  ctx.strokeRect(pan.x, top_y, pan.width, pan.depth);
}

/**
 * Paints the push handle at the cart's right-hand end: two uprights leaning outwards and a grip
 * bar across them.
 *
 * @param ctx - The paint context.
 * @param run - The cart run.
 * @param frame - The paint frame.
 */
function paint_cart_handle(ctx: PaintContext, run: Run, frame: PaintFrame): void {
  const lean = run.side === "south" || run.side === "east" ? 1 : -1;
  const outward =
    run.side === "south" || run.side === "north"
      ? { x: 3 * lean, y: 0 }
      : { x: 0, y: 3 * (run.side === "west" ? 1 : -1) };
  const feet = [run.at(1, 2), run.at(1, run.reach - 2)].map((ground) => lifted(ground, CART_TOP));
  const tops = feet.map((foot) => ({ x: foot.x + outward.x, y: foot.y - 8 + outward.y }));
  const colour = css(TEAL_STEEL);
  feet.forEach((foot, index) => {
    const top = tops[index] ?? foot;
    line(ctx, foot.x, foot.y, top.x, top.y, colour, 1.6);
  });
  const [first, second] = tops;
  if (first && second) {
    line(ctx, first.x, first.y, second.x, second.y, css(0x2b3335), 2.4);
    line(ctx, first.x, first.y - 0.6, second.x, second.y - 0.6, css(0xffffff, 0.3), 0.6);
  }
  if (frame.isHighContrast && first && second)
    line(ctx, first.x, first.y, second.x, second.y, css(INK), 3);
}
