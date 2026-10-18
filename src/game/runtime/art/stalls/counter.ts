/**
 * The built pieces of a stall: the service counter (a stainless or laminate top with its chrome
 * lip, and a front face of colour panels, cabinet doors, a price strip, a stall number plate and
 * tiled skirting), the short return of a side counter just south of the vendor, the walls cut
 * down to counter height, the work bench under the station, the back wall cut down to a shelf
 * with the sink at rotation 180, the kerb and drain at the floor line with the contact shadow in
 * front, and the corrugated roller shutter of a closed stall with its padlock and CLOSED plates.
 *
 * Every piece is drawn as a slab in the 3/4 oblique view: its top seen from above, its south
 * face below it, and a sliver of a west or east face where a counter serves sideways.
 */
import {
  brushed_steel,
  css,
  fill_circle,
  fill_ellipse,
  fill_rounded_rect,
  label,
  line,
  linear_gradient,
  mix,
  shade,
  SHADOW_INK,
  stroke_rounded_rect,
  tint,
  wood_grain,
} from "../canvas";
import {
  BRASS,
  clip_box,
  CONCRETE,
  CREAM,
  edge_outline,
  fill_box,
  fill_rect,
  INK,
  shade_band,
  slab_face,
  slab_top,
  STEEL,
  STEEL_DARK,
  stroke_arc,
  TIMBER,
  VERMILION,
  ZINC,
  type Box,
  type Slab,
  type StallScene,
} from "./common";
import { STEP_HEIGHT } from "./geometry";
import { paint_bottle, paint_jar, paint_shelf_goods, paint_stack } from "./props";
import { paint_wall_finish } from "./walls";

/**
 * Gives the colour of the counter's top surface: stainless for steel cabinets, otherwise a pale
 * laminate mixed from the stall's secondary colour.
 *
 * @param scene - The stall scene.
 * @returns The top colour.
 */
function counter_top_colour(scene: StallScene): number {
  return scene.dressing.cabinet === "steel" ? STEEL : tint(scene.spec.secondary, 0.35);
}

/**
 * Paints a counter or bench top seen from above, with a chrome lip along its serving edge.
 *
 * @param scene - The stall scene.
 * @param box - The top surface.
 * @param lipEdge - The edge the lip runs along.
 */
function paint_top_surface(
  scene: StallScene,
  box: Box,
  lipEdge: "south" | "north" | "west" | "east",
): void {
  const { ctx, dressing } = scene;
  if (dressing.cabinet === "steel") {
    brushed_steel(ctx, box.x, box.y, box.width, box.height, 0.5);
  } else {
    const colourValue = counter_top_colour(scene);
    fill_box(
      ctx,
      box,
      linear_gradient(ctx, box.x, box.y, box.x + box.width * 0.25, box.y + box.height, [
        [0, tint(colourValue, 0.3)],
        [1, shade(colourValue, 0.06)],
      ]),
    );
    if (!scene.isLowDetail) {
      for (let x = box.x + 6; x < box.x + box.width; x += 13) {
        fill_rect(ctx, x, box.y + 1, 0.6, box.height - 2, css(0xffffff, 0.12));
      }
    }
  }
  const lip = css(0xf4f8f6);
  const lipShade = css(STEEL_DARK);
  switch (lipEdge) {
    case "south":
      fill_rect(ctx, box.x, box.y + box.height - 2, box.width, 1.2, lip);
      fill_rect(ctx, box.x, box.y + box.height - 0.8, box.width, 0.8, lipShade);
      return;
    case "north":
      fill_rect(ctx, box.x, box.y, box.width, 1.2, lip);
      fill_rect(ctx, box.x, box.y + 1.2, box.width, 0.6, lipShade);
      return;
    case "west":
      fill_rect(ctx, box.x, box.y, 1.2, box.height, lip);
      return;
    case "east":
      fill_rect(ctx, box.x + box.width - 1.2, box.y, 1.2, box.height, lipShade);
      return;
  }
}

/**
 * Paints the stall number plate: a small blue enamel plate with the unit number.
 *
 * @param scene - The stall scene.
 * @param x - Centre x.
 * @param y - Centre y.
 */
function paint_number_plate(scene: StallScene, x: number, y: number): void {
  const { ctx, seed } = scene;
  const unit = String(10 + (seed % 80)).padStart(2, "0");
  fill_rounded_rect(ctx, x - 10, y - 3.5, 20, 7, 1.5, css(0x24527f));
  stroke_rounded_rect(ctx, x - 9.2, y - 2.7, 18.4, 5.4, 1, css(0xffffff, 0.8), 0.5);
  label(ctx, `#01-${unit}`, x, y + 0.3, { maxWidth: 16, size: 5, colour: 0xffffff, weight: 700 });
}

/**
 * Paints the front face of a counter or cut-down wall in the stall's colours: panels or doors
 * in the cabinet material, a price strip along the top and tiled skirting at the floor.
 *
 * @param scene - The stall scene.
 * @param box - The face.
 * @param hasPlate - True to fix the stall number plate on this face.
 */
function paint_front_face(scene: StallScene, box: Box, hasPlate: boolean): void {
  const { ctx, spec, dressing, isLowDetail } = scene;
  const body = spec.primary;
  ctx.save();
  clip_box(ctx, box);
  if (dressing.cabinet === "steel") {
    brushed_steel(ctx, box.x, box.y, box.width, box.height, 0, tint(ZINC, 0.2));
    fill_rect(ctx, box.x, box.y + 3, box.width, 4, css(body));
  } else if (dressing.cabinet === "timber") {
    const plank = shade(mix(TIMBER, body, 0.28), 0.05);
    fill_box(ctx, box, css(plank));
    for (let y = box.y + 3; y < box.y + box.height; y += 4) {
      fill_rect(ctx, box.x, y, box.width, 0.7, css(shade(plank, 0.35), 0.8));
    }
    if (!isLowDetail)
      wood_grain(ctx, box.x, box.y, box.width, box.height, plank, scene.seed ^ 0x77);
  } else {
    fill_box(
      ctx,
      box,
      linear_gradient(ctx, 0, box.y, 0, box.y + box.height, [
        [0, tint(body, 0.14)],
        [1, shade(body, 0.12)],
      ]),
    );
  }
  // Cabinet doors with handles.
  const doorCount = Math.max(1, Math.round(box.width / 30));
  const doorWidth = box.width / doorCount;
  const doorTop = box.y + 4;
  const doorHeight = box.height - 9;
  if (doorHeight > 4) {
    for (let index = 0; index < doorCount; index += 1) {
      const x = box.x + index * doorWidth + 2;
      const width = doorWidth - 4;
      fill_rect(ctx, x, doorTop, width, 0.8, css(0xffffff, 0.22));
      fill_rect(ctx, x, doorTop, 0.8, doorHeight, css(0xffffff, 0.16));
      fill_rect(ctx, x, doorTop + doorHeight - 0.8, width, 0.8, css(SHADOW_INK, 0.28));
      fill_rect(ctx, x + width - 0.8, doorTop, 0.8, doorHeight, css(SHADOW_INK, 0.22));
      const handleX = index % 2 === 0 ? x + width - 4 : x + 2.5;
      fill_rounded_rect(
        ctx,
        handleX,
        doorTop + doorHeight / 2 - 2,
        1.6,
        4,
        0.8,
        css(dressing.cabinet === "timber" ? BRASS : 0xe9eeec),
      );
    }
  }
  // Price strip along the top of the face.
  fill_rect(ctx, box.x, box.y, box.width, 3, css(CREAM));
  if (!isLowDetail) {
    for (let x = box.x + 4; x < box.x + box.width - 4; x += 9) {
      fill_rect(
        ctx,
        x,
        box.y + 0.8,
        4,
        1.4,
        css(Math.round(x) % 2 === 0 ? VERMILION : spec.accent, 0.8),
      );
    }
  }
  fill_rect(ctx, box.x, box.y + 3, box.width, 0.7, css(SHADOW_INK, 0.25));
  // Tiled skirting.
  const skirtTop = box.y + box.height - 4;
  for (let x = box.x; x < box.x + box.width; x += 4) {
    fill_rect(
      ctx,
      x + 0.3,
      skirtTop + 0.3,
      3.4,
      3.4,
      css(((x - box.x) / 4) % 2 < 1 ? spec.secondary : tint(spec.accent, 0.2)),
    );
  }
  fill_rect(ctx, box.x, skirtTop - 0.6, box.width, 0.6, css(SHADOW_INK, 0.3));
  // Light falls from the north-west: the face darkens to the east and under the lip.
  shade_band(ctx, box.x, box.y + 3, box.width, 3, 0.18);
  ctx.restore();
  if (hasPlate && box.width > 30) paint_number_plate(scene, box.x + box.width - 16, box.y + 8);
}

/**
 * Paints the kerb, the drain grating and the counter's contact shadow in the floor strip in
 * front of a south face, inside the footprint.
 *
 * @param scene - The stall scene.
 * @param from - Left end.
 * @param to - Right end.
 */
function paint_step(scene: StallScene, from: number, to: number): void {
  const { ctx, geo } = scene;
  const y = geo.bottom - STEP_HEIGHT;
  fill_rect(ctx, from, y, to - from, 1.4, css(CONCRETE));
  fill_rect(ctx, from, y + 1.4, to - from, STEP_HEIGHT - 1.4, css(0x6f7775));
  for (let x = from + 1; x < to - 1; x += 2.4) {
    fill_rect(ctx, x, y + 1.9, 1.2, STEP_HEIGHT - 2.4, css(0x2f3534));
  }
  shade_band(ctx, from, y, to - from, STEP_HEIGHT, 0.32);
}

/**
 * Paints a few everyday counter props in the gaps between the dish slots: a chilli jar, a
 * cutlery cup and a stack of takeaway boxes or saucers.
 *
 * @param scene - The stall scene.
 * @param spots - Where the props stand, in texture pixels.
 */
function paint_counter_props(scene: StallScene, spots: readonly { x: number; y: number }[]): void {
  const { ctx } = scene;
  spots.forEach((spot, index) => {
    fill_ellipse(ctx, spot.x + 1.2, spot.y + 0.6, 4, 1.3, css(SHADOW_INK, 0.25));
    if (index % 3 === 0) {
      paint_jar(scene, spot.x, spot.y, 0xc8452f, 6, 5, VERMILION);
    } else if (index % 3 === 1) {
      fill_rounded_rect(ctx, spot.x - 2.5, spot.y - 6, 5, 6, 1, css(STEEL));
      for (const dx of [-1.2, 0, 1.2])
        line(ctx, spot.x + dx, spot.y - 6, spot.x + dx * 1.6, spot.y - 9.5, css(STEEL_DARK), 0.7);
    } else {
      paint_stack(scene, spot.x, spot.y, 3, 7);
    }
  });
}

/**
 * Paints the counter of a stall that serves south: its top with dishes' room and props, its
 * front face, and the kerb and drain.
 *
 * @param scene - The stall scene.
 */
function paint_counter_south(scene: StallScene): void {
  const { geo, ctx } = scene;
  const top = slab_top(geo.counter);
  const face = slab_face(geo.counter);
  shade_band(ctx, top.x, top.y - 3, top.width, 3, 0.2, false);
  paint_top_surface(scene, top, "south");
  paint_front_face(scene, face, true);
  paint_step(scene, 0, geo.width);
  const propY = top.y + top.height * 0.62;
  paint_counter_props(scene, [
    { x: top.x + 7, y: propY },
    { x: top.x + top.width - 7, y: propY },
  ]);
  edge_outline(
    scene,
    { x: top.x, y: top.y, width: top.width, height: top.height + face.height },
    1,
    scene.spec.primary,
  );
}

/**
 * Paints the counter of a stall that serves north, as seen from the vendor's side: its top with
 * the lip on the far edge, and its open inner shelves of bowls, sauces and stock.
 *
 * @param scene - The stall scene.
 */
export function paint_counter_from_behind(scene: StallScene): void {
  const { geo, ctx, spec } = scene;
  const top = slab_top(geo.counter);
  const face = slab_face(geo.counter);
  paint_top_surface(scene, top, "north");
  const inner = shade(scene.dressing.cabinet === "steel" ? STEEL : spec.primary, 0.55);
  fill_box(
    ctx,
    face,
    linear_gradient(ctx, 0, face.y, 0, face.y + face.height, [
      [0, shade(inner, 0.3)],
      [1, inner],
    ]),
  );
  const shelfY = face.y + face.height * 0.45;
  fill_rect(ctx, face.x, shelfY, face.width, 1.4, css(tint(inner, 0.4)));
  const segment = Math.min(56, face.width / 3);
  for (let x = face.x + 4; x + segment <= face.x + face.width - 3; x += segment + 4) {
    paint_shelf_goods(scene, x, x + segment, face.y + face.height - 1);
  }
  for (let x = face.x + 8; x < face.x + face.width - 8; x += 22) {
    paint_bottle(scene, x, shelfY, Math.round(x) % 2 === 0 ? 0x9f2f2a : 0x3b2a22, 6);
  }
  shade_band(ctx, face.x, face.y, face.width, 4, 0.35);
  edge_outline(
    scene,
    { x: top.x, y: top.y, width: top.width, height: top.height + face.height },
    1,
    spec.primary,
  );
}

/**
 * Paints the counter and the cut-down south wall of a stall that serves west or east: the
 * counter top runs along the serving edge with the stall's colour on its outer sliver, and the
 * low wall closes the front with the stall's face.
 *
 * @param scene - The stall scene.
 */
function paint_counter_side(scene: StallScene): void {
  const { geo, ctx, spec } = scene;
  const isWest = geo.side === "west";
  const counterTop = slab_top(geo.counter);
  const counterFace = slab_face(geo.counter);
  const nearWall = geo.nearWall as Slab;
  const nearTop = slab_top(nearWall);
  const nearFace = slab_face(nearWall);
  // The low wall first, then the return, so the counter's edge sits over both joins.
  paint_top_surface(scene, nearTop, "south");
  paint_front_face(scene, nearFace, true);
  if (geo.counterReturn && spec.isOpen) paint_counter_return(scene, geo.counterReturn);
  paint_top_surface(scene, counterTop, isWest ? "west" : "east");
  // The counter's serving face is seen edge-on, as a sliver of the stall's colour.
  const sliverX = isWest ? counterTop.x : counterTop.x + counterTop.width - 3;
  fill_rect(
    ctx,
    sliverX,
    counterTop.y,
    3,
    counterTop.height,
    css(isWest ? tint(spec.primary, 0.1) : shade(spec.primary, 0.25)),
  );
  paint_front_face(scene, counterFace, false);
  paint_step(scene, 0, geo.width);
  paint_counter_props(scene, [{ x: counterTop.x + counterTop.width / 2, y: counterTop.y + 4 }]);
  edge_outline(
    scene,
    {
      x: counterTop.x,
      y: counterTop.y,
      width: counterTop.width,
      height: counterTop.height + counterFace.height,
    },
    1,
    spec.primary,
  );
  edge_outline(
    scene,
    { x: nearTop.x, y: nearTop.y, width: nearTop.width, height: nearTop.height + nearFace.height },
    1,
    spec.primary,
  );
}

/**
 * Paints the short return of a side counter that stands just south of the vendor: its top with
 * the chrome lip, a front face in the stall's colours, the end of the return in shade and a
 * chilli jar at its far end, clear of the vendor.
 *
 * @param scene - The stall scene.
 * @param slab - The return.
 */
function paint_counter_return(scene: StallScene, slab: Slab): void {
  const { geo, ctx, spec } = scene;
  const isWest = geo.side === "west";
  const top = slab_top(slab);
  const face = slab_face(slab);
  paint_top_surface(scene, top, "south");
  paint_front_face(scene, face, false);
  // The return's free end faces into the kitchen: a sliver of its end panel.
  const endX = isWest ? top.x + top.width - 2 : top.x;
  fill_rect(ctx, endX, top.y, 2, top.height + face.height, css(shade(spec.primary, 0.3)));
  const jarX = isWest ? top.x + top.width - 6 : top.x + 6;
  paint_counter_props(scene, [{ x: jarX, y: top.y + top.height * 0.6 }]);
  edge_outline(
    scene,
    { x: top.x, y: top.y, width: top.width, height: top.height + face.height },
    1,
    spec.primary,
  );
}

/**
 * Paints the counter (and cut-down walls) in front of the vendor, for the front layer.
 *
 * @param scene - The stall scene.
 */
export function paint_front_counter(scene: StallScene): void {
  switch (scene.geo.side) {
    case "south":
      paint_counter_south(scene);
      return;
    case "west":
    case "east":
      paint_counter_side(scene);
      return;
    case "north":
      return;
  }
}

/**
 * Paints one bench slab: a stainless top, and a face of steel cabinet doors (`doors`), the
 * stall's wall finish where the back wall is cut down in front of the vendor (`wall`), or only an
 * inner sliver where the bench runs along a side wall and its face is edge-on (`sliver`).
 *
 * @param scene - The stall scene.
 * @param bench - The bench slab.
 * @param face_kind - How its visible face is finished.
 */
function paint_bench_slab(
  scene: StallScene,
  bench: Slab,
  face_kind: "doors" | "wall" | "sliver",
): void {
  const { geo, ctx, spec } = scene;
  const top = slab_top(bench);
  const face = slab_face(bench);
  if (face_kind === "wall") {
    paint_wall_finish(scene, face);
    fill_rect(ctx, face.x, face.y + face.height - 3, face.width, 3, css(shade(spec.primary, 0.2)));
    paint_step(scene, 0, geo.width);
  } else if (face_kind === "doors") {
    paint_bench_doors(scene, face);
  }
  brushed_steel(ctx, top.x, top.y, top.width, top.height, 0.5);
  fill_rect(ctx, top.x, top.y, top.width, 1, css(0xffffff, 0.45));
  if (face_kind === "sliver") {
    const sliverX = geo.side === "west" ? top.x : top.x + top.width - 3;
    fill_rect(ctx, sliverX, top.y + 2, 3, top.height - 2, css(STEEL_DARK));
  } else {
    fill_rect(ctx, top.x, top.y + top.height - 1, top.width, 1, css(0xf4f8f6));
  }
  edge_outline(
    scene,
    {
      x: top.x,
      y: top.y,
      width: top.width,
      height: face_kind === "sliver" ? top.height : top.height + face.height,
    },
    1,
    STEEL,
  );
}

/**
 * Paints the cabinet doors under a work bench in the stall's cabinet material: brushed steel,
 * laminate in a pale tint of the stall colour, or timber.
 *
 * @param scene - The stall scene.
 * @param face - The bench's south face.
 */
function paint_bench_doors(scene: StallScene, face: Box): void {
  const { ctx, dressing, spec } = scene;
  if (dressing.cabinet === "steel") {
    brushed_steel(ctx, face.x, face.y, face.width, face.height, 0, shade(STEEL, 0.08));
  } else {
    const panel =
      dressing.cabinet === "timber"
        ? shade(mix(TIMBER, spec.primary, 0.2), 0.1)
        : tint(spec.primary, 0.45);
    fill_box(
      ctx,
      face,
      linear_gradient(ctx, 0, face.y, 0, face.y + face.height, [
        [0, tint(panel, 0.1)],
        [1, shade(panel, 0.12)],
      ]),
    );
  }
  const doors = Math.max(1, Math.round(face.width / 26));
  for (let index = 0; index < doors; index += 1) {
    const x = face.x + (face.width * index) / doors;
    fill_rect(ctx, x, face.y + 1, 0.8, face.height - 2, css(SHADOW_INK, 0.3));
    fill_rect(
      ctx,
      x + (face.width / doors) * 0.5 - 2,
      face.y + face.height * 0.4,
      4,
      1.2,
      css(dressing.cabinet === "timber" ? BRASS : 0xe9eeec),
    );
  }
  shade_band(ctx, face.x, face.y, face.width, 4, 0.28);
}

/**
 * Paints a sink basin set into a bench top, with its gooseneck tap and a film of water.
 *
 * @param scene - The stall scene.
 * @param box - The basin.
 */
function paint_sink(scene: StallScene, box: Box): void {
  const { ctx } = scene;
  if (box.width < 8 || box.height < 5) return;
  fill_rounded_rect(ctx, box.x, box.y, box.width, box.height, 1.5, css(STEEL_DARK));
  fill_rounded_rect(
    ctx,
    box.x + 1,
    box.y + 1,
    box.width - 2,
    box.height - 2,
    1,
    linear_gradient(ctx, 0, box.y, 0, box.y + box.height, [
      [0, shade(STEEL, 0.45)],
      [1, tint(STEEL, 0.1)],
    ]),
  );
  fill_ellipse(
    ctx,
    box.x + box.width / 2,
    box.y + box.height * 0.6,
    box.width * 0.3,
    box.height * 0.18,
    css(0xbfe0e8, 0.5),
  );
  fill_circle(ctx, box.x + box.width / 2, box.y + box.height * 0.62, 0.9, css(SHADOW_INK, 0.6));
  const tapX = box.x + box.width / 2;
  line(ctx, tapX, box.y, tapX, box.y - 6, css(tint(STEEL, 0.3)), 1.4);
  line(ctx, tapX, box.y - 6, tapX + 4, box.y - 4, css(tint(STEEL, 0.3)), 1.2);
  fill_rect(ctx, tapX - 3, box.y - 1, 6, 1.4, css(STEEL));
}

/**
 * Paints the work benches: the bench under the station (doors against the back wall or behind the
 * vendor, the wall finish where it is the back wall cut down, a sliver along a side wall), the
 * second bench along the north wall and the prep island at 90 and 270, and the sink set into the
 * bench top (unless it sits in a deep stall's back shelf).
 *
 * @param scene - The stall scene.
 */
export function paint_bench(scene: StallScene): void {
  const { geo } = scene;
  if (geo.wallBench) paint_bench_slab(scene, geo.wallBench, "doors");
  if (geo.island) paint_bench_slab(scene, geo.island, "doors");
  paint_bench_slab(scene, geo.bench, geo.benchFace);
  if (!geo.backWall) paint_sink(scene, geo.sink);
}

/**
 * Paints the back wall of a deep stall that serves north, cut down to a shelf at the south edge:
 * its face in the wall finish over the kerb, the sink set into its top and the shelf goods along
 * the rest of it.
 *
 * @param scene - The stall scene.
 */
export function paint_back_wall(scene: StallScene): void {
  const { geo } = scene;
  if (!geo.backWall) return;
  paint_bench_slab(scene, geo.backWall, "wall");
  paint_sink(scene, geo.sink);
  const top = slab_top(geo.backWall);
  const baseY = top.y + top.height * 0.7;
  const sinkFrom = geo.sink.x - 3;
  const sinkTo = geo.sink.x + geo.sink.width + 3;
  if (sinkFrom - top.x > 20) paint_shelf_goods(scene, top.x + 4, sinkFrom, baseY);
  if (top.x + top.width - sinkTo > 20)
    paint_shelf_goods(scene, sinkTo, top.x + top.width - 4, baseY);
}

/**
 * Paints a closed stall's roller shutter over its opening: corrugated slats under a drum
 * housing, a bottom bar with handles, a padlock plate and a CLOSED plate.
 *
 * @param scene - The stall scene.
 */
export function paint_shutter(scene: StallScene): void {
  const { ctx, geo, spec, isHighContrast } = scene;
  const box = geo.shutter;
  const metal = 0xb7c0bd;
  fill_box(
    ctx,
    box,
    linear_gradient(ctx, box.x, 0, box.x + box.width, 0, [
      [0, tint(metal, 0.18)],
      [0.6, metal],
      [1, shade(metal, 0.18)],
    ]),
  );
  for (let y = box.y + 6; y < box.y + box.height - 3; y += 3) {
    fill_rect(ctx, box.x, y, box.width, 1.2, css(0xffffff, 0.32));
    fill_rect(ctx, box.x, y + 1.6, box.width, 0.9, css(SHADOW_INK, 0.22));
  }
  // Drum housing at the top and side guide rails.
  fill_rect(
    ctx,
    box.x,
    box.y,
    box.width,
    6,
    linear_gradient(ctx, 0, box.y, 0, box.y + 6, [
      [0, tint(STEEL_DARK, 0.2)],
      [1, shade(STEEL_DARK, 0.25)],
    ]),
  );
  fill_rect(ctx, box.x, box.y, box.width, 1, css(0xffffff, 0.3));
  fill_rect(ctx, box.x, box.y, 2, box.height, css(STEEL_DARK));
  fill_rect(ctx, box.x + box.width - 2, box.y, 2, box.height, css(STEEL_DARK));
  // Bottom bar, handles and the padlock plate.
  const barY = box.y + box.height - 4;
  fill_rect(ctx, box.x, barY, box.width, 3.5, css(shade(metal, 0.3)));
  fill_rect(ctx, box.x, barY, box.width, 0.8, css(0xffffff, 0.3));
  for (const x of [box.x + box.width * 0.25, box.x + box.width * 0.75]) {
    fill_rounded_rect(ctx, x - 3, barY - 1.5, 6, 1.6, 0.8, css(STEEL_DARK));
  }
  const lockX = box.x + box.width / 2;
  fill_rounded_rect(ctx, lockX - 4, barY - 2, 8, 5.5, 1, css(STEEL));
  stroke_arc(ctx, lockX, barY + 2, 1.8, Math.PI, Math.PI * 2, css(STEEL_DARK), 1);
  fill_rounded_rect(ctx, lockX - 2.2, barY + 2, 4.4, 3.4, 0.8, css(BRASS));
  fill_circle(ctx, lockX, barY + 3.4, 0.6, css(INK));
  // The CLOSED plate.
  const plateWidth = Math.min(40, box.width - 10);
  const plateY = box.y + Math.max(8, box.height * 0.32);
  line(ctx, lockX - plateWidth / 3, plateY - 5, lockX, plateY - 9, css(STEEL_DARK), 0.7);
  line(ctx, lockX + plateWidth / 3, plateY - 5, lockX, plateY - 9, css(STEEL_DARK), 0.7);
  fill_rounded_rect(
    ctx,
    lockX - plateWidth / 2 + 1,
    plateY - 4,
    plateWidth,
    9,
    1.5,
    css(SHADOW_INK, 0.25),
  );
  fill_rounded_rect(ctx, lockX - plateWidth / 2, plateY - 5, plateWidth, 9, 1.5, css(CREAM));
  stroke_rounded_rect(
    ctx,
    lockX - plateWidth / 2 + 1,
    plateY - 4,
    plateWidth - 2,
    7,
    1,
    css(VERMILION, 0.9),
    0.7,
  );
  label(ctx, "Closed", lockX, plateY - 0.4, {
    maxWidth: plateWidth - 6,
    size: 6,
    colour: isHighContrast ? INK : VERMILION,
    uppercase: true,
  });
  shade_band(ctx, box.x, box.y + 6, box.width, 6, 0.25);
  edge_outline(scene, box, 1, spec.primary);
}
