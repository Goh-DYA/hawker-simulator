/**
 * The surfaces of a stall's shell: the wall face seen frontally (white or subway tile, kopitiam
 * mosaic, sooty kitchen tile, Peranakan tile or timber planks, with its own light falloff), the
 * interior floor seen from above (quarry tile, rubber mat, checker or slate, with a wet sheen and
 * the canopy's cast shadow) and the full-height side posts that frame the stall, with their lit
 * edges, inner faces, tiled skirting and caps.
 */
import {
  css,
  fill_ellipse,
  linear_gradient,
  mix,
  seeded,
  shade,
  SHADOW_INK,
  tint,
  wood_grain,
} from "../canvas";
import {
  clip_box,
  edge_outline,
  fill_box,
  fill_rect,
  paint_rosette,
  shade_band,
  shade_band_x,
  TIMBER,
  type Box,
  type StallScene,
} from "./common";

/**
 * Lays a grid of tiles with grout over a box.
 *
 * @param scene - The stall scene.
 * @param box - The area.
 * @param tileWidth - Tile width.
 * @param tileHeight - Tile height.
 * @param pick - Picks the colour of the tile at a column and row.
 * @param grout - The grout colour.
 * @param isBrickBond - True to offset every other row by half a tile.
 */
function paint_tiles(
  scene: StallScene,
  box: Box,
  tileWidth: number,
  tileHeight: number,
  pick: (column: number, row: number) => number,
  grout: number,
  isBrickBond = false,
): void {
  const { ctx } = scene;
  fill_box(ctx, box, css(grout));
  const rows = Math.ceil(box.height / tileHeight) + 1;
  const columns = Math.ceil(box.width / tileWidth) + 2;
  for (let row = 0; row < rows; row += 1) {
    const offset = isBrickBond && row % 2 === 1 ? -tileWidth / 2 : 0;
    for (let column = 0; column < columns; column += 1) {
      fill_rect(
        ctx,
        box.x + offset + column * tileWidth + 0.5,
        box.y + row * tileHeight + 0.5,
        tileWidth - 1,
        tileHeight - 1,
        css(pick(column, row)),
      );
    }
  }
}

/**
 * Fills a wall face with the stall's wall finish, clipped to the box.
 *
 * @param scene - The stall scene.
 * @param box - The wall face.
 */
export function paint_wall_finish(scene: StallScene, box: Box): void {
  const { ctx, spec, seed, dressing, isLowDetail } = scene;
  const next = seeded(seed ^ 0x3a11);
  ctx.save();
  clip_box(ctx, box);
  switch (dressing.wall) {
    case "tile": {
      const band = Math.floor(box.height / 7) - 2;
      paint_tiles(
        scene,
        box,
        7,
        7,
        (_, row) => (row >= band ? tint(spec.accent, 0.62) : row % 2 === 0 ? 0xf3efe4 : 0xeee8db),
        0xcfc8b8,
      );
      break;
    }
    case "subway":
      paint_tiles(scene, box, 9, 4.5, () => (next() > 0.85 ? 0xe9eeec : 0xf7f8f4), 0xc9cfcb, true);
      break;
    case "mosaic": {
      const greens = [0x5f9a83, 0x7fb3a0, 0xe9efe6, 0x3f7a66, 0xc9ddd2];
      paint_tiles(
        scene,
        box,
        3.4,
        3.4,
        () => greens[Math.floor(next() * greens.length)] as number,
        0xdfe6df,
      );
      break;
    }
    case "soot":
      paint_tiles(scene, box, 7, 7, () => (next() > 0.7 ? 0x7d8784 : 0x8d9693), 0x5e6764);
      break;
    case "peranakan":
      paint_tiles(scene, box, 8, 8, () => 0xf5eedc, 0xd9cfb8);
      if (!isLowDetail) {
        for (let y = box.y + 4; y < box.y + box.height; y += 8) {
          for (let x = box.x + 4; x < box.x + box.width; x += 8) {
            paint_rosette(ctx, x, y, 3.2, spec.primary, spec.secondary);
          }
        }
      }
      break;
    case "timber": {
      const plank = mix(TIMBER, spec.secondary, 0.22);
      fill_box(ctx, box, css(plank));
      for (let x = box.x; x < box.x + box.width; x += 7) {
        fill_rect(
          ctx,
          x,
          box.y,
          7,
          box.height,
          css(next() > 0.5 ? tint(plank, 0.06) : shade(plank, 0.06)),
        );
        fill_rect(ctx, x + 6.2, box.y, 0.8, box.height, css(shade(plank, 0.4), 0.7));
      }
      if (!isLowDetail) wood_grain(ctx, box.x, box.y, box.width, box.height, plank, seed, true);
      break;
    }
  }
  if (dressing.wall === "soot") {
    shade_band(ctx, box.x, box.y, box.width, box.height * 0.8, 0.45);
  }
  // Light falls from above the canopy: the wall is in shade under it and darkens where the
  // bench meets it.
  shade_band(ctx, box.x, box.y, box.width, Math.min(12, box.height * 0.4), 0.22);
  shade_band(ctx, box.x, box.y + box.height - 6, box.width, 6, 0.18, false);
  ctx.restore();
}

/**
 * Paints the interior floor the vendor stands on, seen from above: the floor finish, a wet
 * sheen, the shade of the canopy and the occlusion along the walls.
 *
 * @param scene - The stall scene.
 */
export function paint_interior_floor(scene: StallScene): void {
  const { ctx, geo, seed, dressing, isLowDetail } = scene;
  const box = geo.floor;
  const next = seeded(seed ^ 0xf100);
  ctx.save();
  clip_box(ctx, box);
  switch (dressing.floor) {
    case "quarry":
      paint_tiles(scene, box, 9, 7, () => (next() > 0.5 ? 0xae7760 : 0xa46c56), 0x7f5646);
      break;
    case "rubber": {
      fill_box(ctx, box, css(0x6d7774));
      for (let y = box.y + 2; y < box.y + box.height; y += 4) {
        for (
          let x = box.x + (Math.round(y - box.y) % 8 < 4 ? 1 : 3);
          x < box.x + box.width;
          x += 4
        ) {
          fill_rect(ctx, x, y, 1.6, 1, css(0x848e8b));
        }
      }
      break;
    }
    case "checker":
      paint_tiles(
        scene,
        box,
        8,
        6,
        (column, row) => ((column + row) % 2 === 0 ? 0xe6dcc6 : 0x6f9482),
        0xb9ad94,
      );
      break;
    case "slate":
      paint_tiles(scene, box, 11, 7, () => (next() > 0.5 ? 0x7d8a8e : 0x737f87), 0x56616a, true);
      break;
  }
  if (!isLowDetail) {
    // Wet sheen from mopping.
    for (let index = 0; index < 4; index += 1) {
      fill_ellipse(
        ctx,
        box.x + next() * box.width,
        box.y + box.height * (0.3 + next() * 0.6),
        5 + next() * 8,
        1.2 + next(),
        css(0xffffff, 0.12),
      );
    }
  }
  // The canopy's cast shadow falls across the back of the floor; walls occlude its edges.
  fill_box(
    ctx,
    box,
    linear_gradient(ctx, 0, box.y, 0, box.y + box.height, [
      [0, SHADOW_INK, 0.32],
      [0.5, SHADOW_INK, 0.1],
      [1, SHADOW_INK, 0.04],
    ]),
  );
  shade_band_x(ctx, box.x, box.y, 6, box.height, 0.3);
  shade_band_x(ctx, box.x + box.width - 5, box.y, 5, box.height, 0.18, false);
  ctx.restore();
}

/**
 * Paints one full-height post: a column in the stall's colour, lit on its west edge, shaded on
 * its east edge, with an inner face towards the interior, a tiled skirting and a cap.
 *
 * @param scene - The stall scene.
 * @param box - The post.
 * @param isInteriorEast - True when the interior lies east of the post.
 */
function paint_post(scene: StallScene, box: Box, isInteriorEast: boolean): void {
  const { ctx, spec } = scene;
  const body = shade(spec.primary, 0.08);
  fill_box(
    ctx,
    box,
    linear_gradient(ctx, box.x, 0, box.x + box.width, 0, [
      [0, tint(body, 0.28)],
      [0.35, body],
      [1, shade(body, 0.3)],
    ]),
  );
  // Inner face towards the interior, a little darker.
  const innerX = isInteriorEast ? box.x + box.width - 2 : box.x;
  fill_rect(ctx, innerX, box.y, 2, box.height, css(shade(body, 0.4), 0.8));
  // Cap and skirting.
  fill_rect(ctx, box.x, box.y, box.width, 3, css(tint(body, 0.4)));
  const skirtTop = box.y + box.height - 9;
  for (let y = skirtTop; y < box.y + box.height; y += 3) {
    for (let x = box.x; x < box.x + box.width; x += 3) {
      fill_rect(
        ctx,
        x + 0.3,
        y + 0.3,
        2.4,
        2.4,
        css(
          ((x - box.x) / 3 + (y - skirtTop) / 3) % 2 < 1 ? tint(spec.accent, 0.3) : spec.secondary,
        ),
      );
    }
  }
  fill_rect(ctx, box.x, skirtTop - 1, box.width, 1, css(shade(body, 0.45)));
  fill_rect(ctx, box.x + 1, box.y + 3, 1, box.height - 12, css(0xffffff, 0.3));
  edge_outline(scene, box, 1, body);
}

/**
 * Paints the stall's full-height posts, with the shadow the west post casts into the interior.
 *
 * @param scene - The stall scene.
 */
export function paint_posts(scene: StallScene): void {
  const { ctx, geo } = scene;
  for (const post of geo.posts) {
    const isInteriorEast = post.x < geo.width / 2;
    if (isInteriorEast) {
      shade_band_x(ctx, post.x + post.width, post.y + 8, 7, post.height - 12, 0.26);
    }
    paint_post(scene, post, isInteriorEast);
  }
}

/**
 * Paints the fittings set into the interior floor: the drain channel with its grating and the
 * rubber anti-fatigue mat the vendor stands on.
 *
 * @param scene - The stall scene.
 */
export function paint_floor_fittings(scene: StallScene): void {
  const { ctx, geo } = scene;
  ctx.save();
  clip_box(ctx, geo.floor);
  const drain = geo.drain;
  fill_box(ctx, drain, css(0x3a4140));
  const isAcross = drain.width >= drain.height;
  if (isAcross) {
    for (let x = drain.x + 1; x < drain.x + drain.width; x += 2.2) {
      fill_rect(ctx, x, drain.y + 0.6, 1.1, drain.height - 1.2, css(0x9aa5a2));
    }
  } else {
    for (let y = drain.y + 1; y < drain.y + drain.height; y += 2.2) {
      fill_rect(ctx, drain.x + 0.6, y, drain.width - 1.2, 1.1, css(0x9aa5a2));
    }
  }
  const mat = geo.mat;
  fill_box(
    ctx,
    { x: mat.x + 1.5, y: mat.y + 1.5, width: mat.width, height: mat.height },
    css(SHADOW_INK, 0.2),
  );
  fill_box(ctx, mat, css(0x3f4847));
  for (let y = mat.y + 2; y < mat.y + mat.height - 1; y += 3) {
    for (let x = mat.x + 2 + ((y - mat.y) % 6 === 2 ? 0 : 1.5); x < mat.x + mat.width - 1; x += 3) {
      fill_rect(ctx, x, y, 1.2, 1.2, css(0x58625f));
    }
  }
  fill_rect(ctx, mat.x, mat.y, mat.width, 0.8, css(0xffffff, 0.12));
  ctx.restore();
}
