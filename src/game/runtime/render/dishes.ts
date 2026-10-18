/**
 * Renderers for dish servings: the vessel, the dish-specific food motif, the nutrition variant
 * cue and the steam, used for the dishes on stall counters, on carried trays and on tables.
 *
 * Each function draws only from its arguments into the Phaser graphics it is given, so it can
 * live outside the scene. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import { DISH_BY_ID, DISHES } from "@/src/content";

import { visualRecipeForDish, visualRecipeForDishVariant } from "../visuals/dish";
import { darken, lighten } from "../visuals/palette";
import type { RenderContext } from "./context";
import { drawNutritionVariantCue, includes_any } from "./variants";

const DISH_VISUAL_BY_ID = new Map(DISHES.map((dish) => [dish.id, visualRecipeForDish(dish)]));

/**
 * Draws a mound of rice with a few highlighted grains (fewer on the lower-end quality mode).
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; the frame's quality mode sets the grain count.
 * @param x - World x of the mound's centre.
 * @param y - World y of the mound's centre.
 * @param scale - The serving's draw scale.
 * @param colourValue - The rice colour.
 * @param remaining - The uneaten share of the serving, which shrinks the mound.
 */
function drawRiceMound(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  x: number,
  y: number,
  scale: number,
  colourValue: number,
  remaining: number,
) {
  const { qualityMode } = context.frame;
  graphics.fillStyle(colourValue, 1);
  graphics.fillEllipse(x, y, 12 * scale * remaining, 9 * scale * remaining);
  graphics.fillStyle(lighten(colourValue, 0.35), 0.9);
  const grainCount = qualityMode === "standard" ? 4 : 2;
  for (let grain = 0; grain < grainCount; grain += 1) {
    const grainX = x + (grain - (grainCount - 1) / 2) * 2.2 * scale * remaining;
    graphics.fillEllipse(grainX, y - (grain % 2) * 2 * scale, 2.4 * scale, 1.1 * scale);
  }
}

/**
 * Draws a nest of noodles with highlighted strands (fewer on the lower-end quality mode).
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; the frame's quality mode sets the strand count.
 * @param x - World x of the nest's centre.
 * @param y - World y of the nest's centre.
 * @param scale - The serving's draw scale.
 * @param colourValue - The noodle colour.
 * @param remaining - The uneaten share of the serving, which shrinks the nest.
 * @param dark - Whether the noodles are dark-fried, which darkens the base and the strands.
 */
function drawNoodleStrands(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  x: number,
  y: number,
  scale: number,
  colourValue: number,
  remaining: number,
  dark = false,
) {
  const { qualityMode } = context.frame;
  graphics.fillStyle(dark ? darken(colourValue, 0.28) : colourValue, 0.88);
  graphics.fillEllipse(x, y, 18 * scale * remaining, 10 * scale * remaining);
  graphics.lineStyle(Math.max(1, 1.35 * scale), lighten(colourValue, dark ? 0.28 : 0.42), 1);
  const strandCount = qualityMode === "standard" ? 5 : 3;
  for (let strand = 0; strand < strandCount; strand += 1) {
    const offset = (strand - (strandCount - 1) / 2) * 2.7 * scale * remaining;
    graphics.lineBetween(
      x - 7 * scale * remaining,
      y + offset * 0.35,
      x + 7 * scale * remaining,
      y - offset * 0.28,
    );
  }
}

/**
 * Draws the food itself on top of the vessel: a dish-specific motif chosen by substrings of the
 * dish ID, falling back to the recipe's food form, then the garnish dots.
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; the frame's quality mode sets the detail counts.
 * @param dishId - The dish being drawn.
 * @param recipe - The dish's (or its variant's) visual recipe.
 * @param x - World x of the food's centre.
 * @param y - World y of the food's centre.
 * @param scale - The serving's draw scale.
 * @param remaining - The uneaten share of the serving, which shrinks the portion.
 */
function drawDishMotif(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  dishId: string,
  recipe: ReturnType<typeof visualRecipeForDish>,
  x: number,
  y: number,
  scale: number,
  remaining: number,
) {
  const { qualityMode } = context.frame;
  const portion = recipe.portionColour;
  const garnish = recipe.garnishColour;
  const small = Math.max(1.1, 1.7 * scale);
  const has = (...parts: readonly string[]) => includes_any(dishId, parts);

  if (has("poached-chicken-rice", "roast-chicken-rice", "soya-tofu-rice")) {
    drawRiceMound(graphics, context, x - 4 * scale, y, scale, 0xf0e2be, remaining);
    if (has("soya-tofu")) {
      graphics.fillStyle(0xd7a468, 1);
      for (let cube = 0; cube < 3; cube += 1) {
        graphics.fillRoundedRect(x + (2 + cube * 3) * scale, y + (cube % 2 ? -4 : 0) * scale, 4 * scale * remaining, 4 * scale * remaining, scale);
      }
    } else {
      const chicken = has("roast") ? 0xa95736 : 0xe5c8a0;
      graphics.fillStyle(chicken, 1);
      for (let slice = 0; slice < 3; slice += 1) {
        graphics.fillEllipse(x + (2 + slice * 3) * scale, y + (slice - 1) * 2 * scale, 6 * scale * remaining, 3 * scale * remaining);
      }
    }
    graphics.fillStyle(0x61a05a, 1);
    graphics.fillCircle(x + 7 * scale, y - 5 * scale, 2.4 * scale);
    graphics.fillCircle(x + 10 * scale, y - 2 * scale, 2.4 * scale);
  } else if (has("nasi-lemak")) {
    drawRiceMound(graphics, context, x - 4 * scale, y - scale, scale, 0xf2e8ce, remaining);
    graphics.fillStyle(0xb73d2f, 1);
    graphics.fillEllipse(x + 5 * scale, y + 3 * scale, 7 * scale, 4 * scale);
    graphics.fillStyle(0xf8f1d4, 1);
    graphics.fillEllipse(x + 4 * scale, y - 4 * scale, 8 * scale, 6 * scale);
    graphics.fillStyle(0xe5a92e, 1);
    graphics.fillCircle(x + 4 * scale, y - 4 * scale, 2.2 * scale);
    graphics.lineStyle(Math.max(1, scale), 0x4d7e4f, 1);
    graphics.lineBetween(x - 10 * scale, y + 4 * scale, x - 5 * scale, y - 6 * scale);
  } else if (has("nasi-briyani", "lemon-rice")) {
    drawRiceMound(graphics, context, x - 2 * scale, y, scale, has("lemon") ? 0xe4bf4d : portion, remaining);
    if (has("briyani")) {
      graphics.fillStyle(0x985039, 1);
      graphics.fillEllipse(x + 6 * scale, y - 2 * scale, 8 * scale, 5 * scale);
      graphics.fillCircle(x + 10 * scale, y + scale, 2.5 * scale);
    } else {
      graphics.fillStyle(0x3f804b, 1);
      graphics.fillEllipse(x + 5 * scale, y - 3 * scale, 5 * scale, 2.5 * scale);
      graphics.fillCircle(x + 8 * scale, y + 3 * scale, 1.7 * scale);
    }
  } else if (has("lotus-leaf-rice")) {
    graphics.fillStyle(0x466d46, 1);
    graphics.fillEllipse(x, y, 21 * scale, 14 * scale);
    graphics.lineStyle(Math.max(1, 1.2 * scale), 0x93ab68, 1);
    graphics.lineBetween(x - 9 * scale, y, x + 9 * scale, y);
    graphics.lineBetween(x, y - 6 * scale, x, y + 6 * scale);
    graphics.fillStyle(0xc99658, 1);
    graphics.fillEllipse(x, y, 8 * scale * remaining, 6 * scale * remaining);
  } else if (has("chicken-congee", "tau-huay", "pulut-hitam")) {
    const base = has("pulut") ? 0x493044 : has("tau-huay") ? 0xf3e2b7 : 0xeee2c6;
    graphics.fillStyle(base, 1);
    graphics.fillEllipse(x, y, 17 * scale * remaining, 9 * scale * remaining);
    if (has("tau-huay")) {
      graphics.lineStyle(Math.max(1, scale), 0xc69a52, 0.9);
      graphics.lineBetween(x - 6 * scale, y - scale, x + 6 * scale, y + scale);
    } else {
      graphics.fillStyle(has("pulut") ? 0xe5d1c0 : 0x4c8d50, 1);
      for (let dot = 0; dot < 4; dot += 1) {
        graphics.fillCircle(x - 5 * scale + dot * 3.2 * scale, y + (dot % 2 ? 2 : -2) * scale, small * 0.65);
      }
    }
  } else if (has("mee-rebus", "char-kway-teow", "hokkien-prawn-mee", "mee-goreng", "nyonya-laksa", "bak-chor-mee", "fishball-mee-pok", "lor-mee")) {
    const darkNoodles = has("char-kway", "bak-chor");
    const noodleColour = has("mee-goreng")
      ? 0xc75b35
      : has("laksa")
        ? 0xd8753a
        : has("lor-mee")
          ? 0xc79a58
          : portion;
    if (has("lor-mee")) {
      graphics.fillStyle(0x65402f, 1);
      graphics.fillEllipse(x, y, 20 * scale * remaining, 12 * scale * remaining);
    }
    drawNoodleStrands(graphics, context, x, y, scale, noodleColour, remaining, darkNoodles);
    if (has("hokkien", "laksa")) {
      graphics.fillStyle(0xe47c62, 1);
      graphics.fillEllipse(x - 5 * scale, y - 3 * scale, 6 * scale, 3 * scale);
      graphics.lineStyle(Math.max(1, scale), 0xe47c62, 1);
      graphics.lineBetween(x - 8 * scale, y - 5 * scale, x - 4 * scale, y - 3 * scale);
    }
    if (has("fishball")) {
      graphics.fillStyle(0xf2e3c7, 1);
      graphics.fillCircle(x - 5 * scale, y - 3 * scale, 2.7 * scale);
      graphics.fillCircle(x + 4 * scale, y + 2 * scale, 2.7 * scale);
    }
    if (has("bak-chor")) {
      graphics.fillStyle(0x8e5239, 1);
      for (let mince = 0; mince < 4; mince += 1) {
        graphics.fillCircle(x - 5 * scale + mince * 3.2 * scale, y - 3 * scale + (mince % 2) * 5 * scale, 1.6 * scale);
      }
    }
    if (has("lor-mee")) {
      graphics.fillStyle(0xf3ead4, 1);
      graphics.fillEllipse(x - 5 * scale, y - 3 * scale, 7 * scale, 6 * scale);
      graphics.fillStyle(0xd79d32, 1);
      graphics.fillCircle(x - 5 * scale, y - 3 * scale, 1.8 * scale);
      graphics.fillStyle(0xe7c0a4, 1);
      graphics.fillRoundedRect(x + 2 * scale, y - 5 * scale, 6 * scale, 3 * scale, scale);
      graphics.fillRoundedRect(x + 4 * scale, y + scale, 6 * scale, 3 * scale, scale);
    }
    graphics.fillStyle(0x4e9252, 1);
    graphics.fillEllipse(x + 6 * scale, y - 4 * scale, 5 * scale, 2.5 * scale);
  } else if (has("soto-ayam", "lontong-sayur", "sliced-fish-soup", "teochew-fish-dumpling")) {
    graphics.fillStyle(has("soto", "fish-dumpling") ? 0xd6b16b : portion, 1);
    graphics.fillEllipse(x, y, 17 * scale * remaining, 9 * scale * remaining);
    if (has("lontong")) {
      for (let cube = 0; cube < 3; cube += 1) {
        graphics.fillStyle(cube % 2 === 0 ? 0xeee3c4 : 0x83a55d, 1);
        graphics.fillRoundedRect(x - 7 * scale + cube * 5 * scale, y - (cube % 2) * 3 * scale, 4 * scale, 4 * scale, scale);
      }
    } else if (has("sliced-fish")) {
      graphics.fillStyle(0xf1e5d0, 1);
      for (let slice = 0; slice < 3; slice += 1) {
        graphics.fillEllipse(x - 6 * scale + slice * 6 * scale, y + (slice % 2 ? -2 : 2) * scale, 7 * scale, 3 * scale);
      }
    } else if (has("dumpling")) {
      graphics.fillStyle(0xf0ddd0, 1);
      for (let dumpling = 0; dumpling < 3; dumpling += 1) {
        graphics.fillCircle(x - 6 * scale + dumpling * 6 * scale, y + (dumpling % 2) * 2 * scale, 3 * scale);
      }
    } else {
      graphics.fillStyle(0xe8d0a4, 1);
      for (let shred = 0; shred < 4; shred += 1) {
        graphics.fillEllipse(x - 6 * scale + shred * 4 * scale, y + (shred % 2 ? -2 : 2) * scale, 5 * scale, 2 * scale);
      }
    }
    graphics.fillStyle(0x4d8e52, 1);
    graphics.fillCircle(x + 3 * scale, y - 3 * scale, small);
  } else if (has("ice-kacang")) {
    graphics.fillStyle(0xf4eee3, 1);
    graphics.fillTriangle(x - 9 * scale, y + 6 * scale, x + 9 * scale, y + 6 * scale, x, y - 9 * scale * remaining);
    const syrupColours = [0xd94848, 0x55a05d, 0xe5a738] as const;
    for (let stripe = 0; stripe < 3; stripe += 1) {
      graphics.lineStyle(Math.max(1, 2.5 * scale), syrupColours[stripe] as number, 0.95);
      graphics.lineBetween(x - (5 - stripe * 2) * scale, y + 3 * scale, x + (stripe - 1) * 2 * scale, y - (6 - stripe * 2) * scale);
    }
  } else if (has("chendol")) {
    graphics.fillStyle(0xd8c59b, 1);
    graphics.fillEllipse(x, y, 17 * scale, 10 * scale);
    graphics.lineStyle(Math.max(1, 1.6 * scale), 0x3b8a4d, 1);
    for (let strand = 0; strand < 5; strand += 1) {
      graphics.lineBetween(x - 7 * scale + strand * 3.5 * scale, y - 4 * scale, x - 4 * scale + strand * 2.8 * scale, y + 4 * scale);
    }
    graphics.fillStyle(0x7d4b2f, 1);
    graphics.fillCircle(x + 6 * scale, y - 2 * scale, 2.5 * scale);
  } else if (has("kopi", "sugarcane", "teh-tarik")) {
    const drinkColour = has("sugarcane") ? 0xa8c75e : has("teh-tarik") ? 0xc48443 : 0x6b3e2a;
    graphics.fillStyle(drinkColour, 1);
    graphics.fillEllipse(x - 0.5 * scale, y - 5 * scale, 10 * scale, 4 * scale);
    if (has("sugarcane")) {
      graphics.fillStyle(0xe8f4d0, 0.8);
      graphics.fillCircle(x - 3 * scale, y - 5 * scale, 1.8 * scale);
      graphics.lineStyle(Math.max(1, 1.4 * scale), 0x4c8753, 1);
      graphics.lineBetween(x + 2 * scale, y - 6 * scale, x + 6 * scale, y - 14 * scale);
    } else if (has("teh-tarik")) {
      graphics.fillStyle(0xf0ddba, 1);
      graphics.fillEllipse(x - 0.5 * scale, y - 6 * scale, 9 * scale, 2.7 * scale);
    } else {
      graphics.fillStyle(0xe8d1a7, 0.9);
      graphics.fillCircle(x - 2 * scale, y - 6 * scale, 1.4 * scale);
    }
  } else if (has("roti-prata", "chicken-murtabak", "masala-thosai")) {
    if (has("thosai")) {
      graphics.fillStyle(0xd69a3d, 1);
      graphics.fillTriangle(x - 10 * scale, y + 5 * scale, x + 10 * scale, y + 4 * scale, x + 6 * scale, y - 5 * scale);
      graphics.fillStyle(0xf1c35a, 1);
      graphics.fillEllipse(x, y, 18 * scale, 5 * scale);
    } else {
      const filled = has("murtabak");
      graphics.fillStyle(filled ? 0xb9783b : 0xdca94d, 1);
      for (let piece = 0; piece < (filled ? 4 : 2); piece += 1) {
        const pieceX = x - (filled ? 6 : 5) * scale + (piece % 2) * 8 * scale;
        const pieceY = y - (piece > 1 ? -2 : 2) * scale;
        graphics.fillRoundedRect(pieceX, pieceY, 8 * scale, 6 * scale, scale);
        graphics.lineStyle(Math.max(1, scale), 0xf1d584, 0.9);
        graphics.lineBetween(pieceX + scale, pieceY + 2 * scale, pieceX + 7 * scale, pieceY + 2 * scale);
      }
    }
    graphics.fillStyle(0xb84b35, 1);
    graphics.fillCircle(x + 9 * scale, y - 5 * scale, 3.2 * scale);
  } else if (has("idli-sambar", "vadai-set")) {
    for (let piece = 0; piece < 3; piece += 1) {
      const pieceX = x - 6 * scale + piece * 6 * scale;
      const pieceY = y + (piece % 2 ? -3 : 2) * scale;
      graphics.fillStyle(has("idli") ? 0xf1ead7 : 0xa76a37, 1);
      graphics.fillCircle(pieceX, pieceY, 3.6 * scale);
      if (has("vadai")) {
        graphics.fillStyle(0x69452d, 1);
        graphics.fillCircle(pieceX, pieceY, 1.4 * scale);
      }
    }
    graphics.fillStyle(has("idli") ? 0xb95936 : 0x77a34e, 1);
    graphics.fillCircle(x + 8 * scale, y - 5 * scale, 3 * scale);
  } else if (has("fried-carrot-cake")) {
    for (let cube = 0; cube < 6; cube += 1) {
      graphics.fillStyle(cube % 3 === 0 ? 0x6a4030 : 0xe8d7ae, 1);
      graphics.fillRoundedRect(x - 8 * scale + (cube % 3) * 6 * scale, y - 5 * scale + Math.floor(cube / 3) * 6 * scale, 5 * scale * remaining, 5 * scale * remaining, scale);
    }
    graphics.fillStyle(0x4e8b4d, 1);
    graphics.fillCircle(x + 6 * scale, y - 4 * scale, small);
  } else if (has("oyster-omelette")) {
    graphics.fillStyle(0xe0a43f, 1);
    for (let fold = 0; fold < 4; fold += 1) {
      graphics.fillEllipse(x - 5 * scale + fold * 3.5 * scale, y + (fold % 2 ? -3 : 2) * scale, 9 * scale, 6 * scale);
    }
    graphics.fillStyle(0xb9b2a3, 1);
    graphics.fillEllipse(x - 4 * scale, y - 3 * scale, 5 * scale, 3 * scale);
    graphics.fillEllipse(x + 6 * scale, y + 2 * scale, 5 * scale, 3 * scale);
  } else if (has("chicken-satay", "beef-satay")) {
    const beef = has("beef");
    const meat = beef ? 0x63362b : 0xb85e34;
    for (let skewer = 0; skewer < 3; skewer += 1) {
      const skewerY = y - 4 * scale + skewer * 4 * scale;
      graphics.lineStyle(Math.max(1, scale), 0xcda66a, 1);
      graphics.lineBetween(x - 10 * scale, skewerY, x + 8 * scale, skewerY + 2 * scale);
      graphics.fillStyle(meat, 1);
      for (let piece = 0; piece < 3; piece += 1) {
        const pieceX = x - 5 * scale + piece * 5 * scale;
        const pieceY = skewerY + piece * 0.5 * scale;
        if (beef) {
          graphics.fillRoundedRect(pieceX - 2.4 * scale, pieceY - 2 * scale, 4.8 * scale, 4 * scale, 0.7 * scale);
          graphics.lineStyle(Math.max(0.8, scale), 0x38251f, 0.78);
          graphics.lineBetween(pieceX - 1.6 * scale, pieceY - 1.4 * scale, pieceX + 1.6 * scale, pieceY + 1.4 * scale);
        } else {
          graphics.fillEllipse(pieceX, pieceY, 5.2 * scale, 4 * scale);
          graphics.fillStyle(0xd78c4d, 0.82);
          graphics.fillCircle(pieceX - scale, pieceY - scale, scale);
          graphics.fillStyle(meat, 1);
        }
      }
    }
    graphics.fillStyle(0x9b642f, 1);
    graphics.fillCircle(x + 9 * scale, y - 5 * scale, 3 * scale);
  } else if (has("bbq-chicken-wings")) {
    graphics.fillStyle(0xa74f32, 1);
    for (let wing = 0; wing < 3; wing += 1) {
      const wingX = x - 6 * scale + wing * 6 * scale;
      graphics.fillEllipse(wingX, y + (wing % 2 ? -3 : 2) * scale, 8 * scale, 5 * scale);
      graphics.fillCircle(wingX + 3 * scale, y + (wing % 2 ? -1 : 4) * scale, 2.4 * scale);
    }
  } else if (has("sambal-grilled-squid")) {
    graphics.fillStyle(0xc75b43, 1);
    graphics.fillEllipse(x - 2 * scale, y - scale, 14 * scale, 8 * scale);
    graphics.lineStyle(Math.max(1, 1.4 * scale), 0xe2a060, 1);
    for (let tentacle = 0; tentacle < 4; tentacle += 1) {
      graphics.lineBetween(x + 3 * scale, y + (tentacle - 1.5) * 1.5 * scale, x + (8 + tentacle) * scale, y + (tentacle - 1.5) * 3 * scale);
    }
    graphics.fillStyle(0x4d874f, 1);
    graphics.fillEllipse(x - 8 * scale, y - 5 * scale, 6 * scale, 3 * scale);
  } else if (has("har-gow")) {
    const positions = [
      [-5, -3],
      [3, -3],
      [-4, 3],
      [4, 3],
    ] as const;
    for (const [offsetX, offsetY] of positions) {
      const dumplingX = x + offsetX * scale;
      const dumplingY = y + offsetY * scale;
      graphics.fillStyle(0xf2e5dc, 0.82);
      graphics.fillEllipse(dumplingX, dumplingY, 7 * scale, 6 * scale);
      graphics.lineStyle(Math.max(0.7, 0.8 * scale), 0xb99f92, 0.65);
      for (let pleat = -1; pleat <= 1; pleat += 1) {
        graphics.lineBetween(
          dumplingX + pleat * 1.4 * scale,
          dumplingY - 2.5 * scale,
          dumplingX + pleat * 0.7 * scale,
          dumplingY + scale,
        );
      }
    }
  } else if (has("siew-mai")) {
    for (let dumpling = 0; dumpling < 3; dumpling += 1) {
      const dumplingX = x - 6 * scale + dumpling * 6 * scale;
      const dumplingY = y + (dumpling % 2 ? -3 : 2) * scale;
      graphics.fillStyle(0xe4b94f, 1);
      graphics.fillRoundedRect(dumplingX - 3 * scale, dumplingY - 3 * scale, 6 * scale, 7 * scale, 1.4 * scale);
      graphics.fillStyle(0x9a5a3e, 1);
      graphics.fillEllipse(dumplingX, dumplingY - 2.5 * scale, 4.5 * scale, 2.5 * scale);
      graphics.fillStyle(0xd76b3d, 1);
      graphics.fillCircle(dumplingX, dumplingY - 3 * scale, 1.2 * scale);
    }
  } else if (has("char-siew-bao")) {
    for (let bun = 0; bun < 3; bun += 1) {
      const bunX = x - 6 * scale + bun * 6 * scale;
      const bunY = y + (bun % 2 ? -3 : 2) * scale;
      graphics.fillStyle(0xf3e7d5, 1);
      graphics.fillCircle(bunX, bunY, 4.4 * scale);
      graphics.fillStyle(0xa84f38, 1);
      graphics.fillTriangle(
        bunX - 2.2 * scale,
        bunY - 2.6 * scale,
        bunX + 2.2 * scale,
        bunY - 2.6 * scale,
        bunX,
        bunY + 0.5 * scale,
      );
    }
  } else if (has("sambal-stingray")) {
    graphics.fillStyle(0x3e7749, 1);
    graphics.fillEllipse(x, y, 22 * scale, 13 * scale);
    graphics.fillStyle(0x9c5d46, 1);
    graphics.fillTriangle(x - 8 * scale, y - 4 * scale, x + 8 * scale, y - 5 * scale, x + 4 * scale, y + 5 * scale);
    graphics.fillStyle(0xd44332, 1);
    graphics.fillEllipse(x, y - scale, 12 * scale, 5 * scale);
  } else if (has("black-pepper-crab")) {
    graphics.fillStyle(0x8f3e2f, 1);
    graphics.fillCircle(x, y, 6 * scale * remaining);
    graphics.fillCircle(x - 8 * scale, y - 3 * scale, 4 * scale);
    graphics.fillCircle(x + 8 * scale, y - 3 * scale, 4 * scale);
    graphics.lineStyle(Math.max(1, 1.6 * scale), 0x713328, 1);
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 3; leg += 1) {
        graphics.lineBetween(x + side * 5 * scale, y + (leg - 1) * 3 * scale, x + side * (10 + leg) * scale, y + (leg - 1.5) * 5 * scale);
      }
    }
    graphics.fillStyle(0x312b28, 1);
    graphics.fillCircle(x - 2 * scale, y - 2 * scale, small * 0.55);
    graphics.fillCircle(x + 2 * scale, y - 2 * scale, small * 0.55);
  } else if (has("ayam-buah-keluak", "chap-chye", "babi-pongteh")) {
    graphics.fillStyle(has("ayam") ? 0x493a33 : portion, 1);
    graphics.fillEllipse(x, y, 17 * scale * remaining, 10 * scale * remaining);
    const stewColours = has("chap-chye")
      ? [0x76a056, 0xd49a49, 0xc9d0b4]
      : [0x7b4932, 0xc18a50, 0xe0c08b];
    for (let piece = 0; piece < 4; piece += 1) {
      graphics.fillStyle(stewColours[piece % stewColours.length] as number, 1);
      graphics.fillRoundedRect(x - 7 * scale + piece * 4.5 * scale, y - (piece % 2) * 4 * scale, 4 * scale, 4 * scale, scale);
    }
  } else if (recipe.foodForm === "rice") {
    drawRiceMound(graphics, context, x, y, scale, portion, remaining);
  } else if (recipe.foodForm === "noodles") {
    drawNoodleStrands(graphics, context, x, y, scale, portion, remaining);
  } else if (recipe.foodForm === "bread") {
    graphics.fillStyle(portion, 1);
    graphics.fillRoundedRect(x - 9 * scale, y - 5 * scale, 18 * scale * remaining, 10 * scale * remaining, 3 * scale);
    graphics.lineStyle(Math.max(1, scale), lighten(portion, 0.35), 1);
    graphics.lineBetween(x - 6 * scale, y, x + 6 * scale, y);
  } else if (recipe.foodForm === "seafood") {
    graphics.fillStyle(portion, 1);
    graphics.fillEllipse(x, y, 18 * scale * remaining, 8 * scale * remaining);
    graphics.fillTriangle(x - 11 * scale, y, x - 6 * scale, y - 5 * scale, x - 6 * scale, y + 5 * scale);
    graphics.fillStyle(0x1c302d, 1);
    graphics.fillCircle(x + 5 * scale, y - scale, small * 0.5);
  } else {
    graphics.fillStyle(portion, 1);
    graphics.fillEllipse(x, y, 16 * scale * remaining, 9 * scale * remaining);
  }

  if (!has("kopi", "sugarcane", "teh-tarik", "ice-kacang", "black-pepper-crab")) {
    graphics.fillStyle(garnish, 1);
    const garnishCount = Math.min(qualityMode === "standard" ? 3 : 1, recipe.garnishCount);
    for (let index = 0; index < garnishCount; index += 1) {
      const angle = (index / Math.max(1, garnishCount)) * Math.PI * 2 + recipe.garnishCount;
      graphics.fillCircle(
        x + Math.cos(angle) * 5 * scale * remaining,
        y + Math.sin(angle) * 3 * scale * remaining,
        small * 0.62,
      );
    }
  }
}

/**
 * Draws one dish serving at a point: its shadow and vessel, the food, the nutrition variant cue
 * and the steam, optionally part eaten and in a nutrition variant's look.
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; the frame gives quality and reduced motion, and the live
 *   state's tick animates the steam.
 * @param dishId - The dish to draw; nothing is drawn for an unknown or missing ID.
 * @param x - World x of the serving's centre.
 * @param y - World y of the serving's centre.
 * @param scale - The serving's draw scale.
 * @param eatenFraction - How much of the serving has been eaten, from 0 to 1.
 * @param variantVisualKey - The nutrition variant's visual key, when one applies.
 */
export function drawDishServing(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  dishId: string | undefined,
  x: number,
  y: number,
  scale: number,
  eatenFraction = 0,
  variantVisualKey?: string,
) {
  const { qualityMode, isReducedMotion } = context.frame;
  const dish = dishId ? DISH_BY_ID.get(dishId) : undefined;
  if (!dish) return;
  const recipe = variantVisualKey
    ? visualRecipeForDishVariant(dish, variantVisualKey)
    : DISH_VISUAL_BY_ID.get(dish.id) ?? visualRecipeForDish(dish);
  const remaining = Math.max(0.22, 1 - eatenFraction);
  const vessel = recipe.presentation.vessel;

  graphics.fillStyle(0x17352e, 0.16);
  graphics.fillEllipse(x + 1, y + 4 * scale, 27 * scale, 10 * scale);
  if (vessel === "tall-drinking-glass") {
    graphics.fillStyle(0xcfe5df, 0.72);
    graphics.fillRoundedRect(x - 7 * scale, y - 10 * scale, 13 * scale, 20 * scale, 3 * scale);
    graphics.lineStyle(Math.max(1, 1.7 * scale), 0x789c98, 0.9);
    graphics.strokeRoundedRect(x - 7 * scale, y - 10 * scale, 13 * scale, 20 * scale, 3 * scale);
    graphics.lineStyle(Math.max(0.8, scale), 0xffffff, 0.5);
    graphics.lineBetween(x - 4 * scale, y - 8 * scale, x - 4 * scale, y + 7 * scale);
  } else if (vessel === "kopitiam-cup-and-saucer") {
    graphics.fillStyle(0xe5ddcf, 1);
    graphics.fillEllipse(x, y + 7 * scale, 23 * scale, 7 * scale);
    graphics.fillStyle(0xf5efe1, 1);
    graphics.fillRoundedRect(x - 7 * scale, y - 7 * scale, 13 * scale, 16 * scale, 3 * scale);
    graphics.lineStyle(Math.max(1, 1.7 * scale), 0x7a6650, 0.88);
    graphics.strokeCircle(x + 7 * scale, y, 5 * scale);
    graphics.strokeRoundedRect(x - 7 * scale, y - 7 * scale, 13 * scale, 16 * scale, 3 * scale);
  } else if (vessel === "deep-ceramic-bowl") {
    graphics.fillStyle(0xd8d0c2, 1);
    graphics.fillRoundedRect(x - 10 * scale, y - scale, 20 * scale, 8 * scale, 5 * scale);
    graphics.fillStyle(0xf5efe1, 1);
    graphics.fillEllipse(x, y - scale, 24 * scale, 16 * scale);
    graphics.lineStyle(Math.max(1, 1.8 * scale), 0x7a6650, 0.84);
    graphics.strokeEllipse(x, y - scale, 24 * scale, 16 * scale);
    graphics.fillStyle(lighten(recipe.portionColour, 0.12), 1);
    graphics.fillEllipse(x, y - scale, 18 * scale * remaining, 10 * scale * remaining);
  } else if (vessel === "bamboo-steamer") {
    graphics.fillStyle(0xd1a45f, 1);
    graphics.fillEllipse(x, y, 29 * scale, 21 * scale);
    graphics.fillStyle(0xe5c989, 1);
    graphics.fillEllipse(x, y - scale, 23 * scale, 15 * scale);
    graphics.lineStyle(Math.max(1, 1.5 * scale), 0x7a5a35, 0.86);
    graphics.strokeEllipse(x, y, 29 * scale, 21 * scale);
    graphics.strokeEllipse(x, y - scale, 23 * scale, 15 * scale);
    if (qualityMode === "standard") {
      graphics.lineStyle(Math.max(0.7, scale), 0xb88446, 0.72);
      for (let slat = -2; slat <= 2; slat += 1) {
        graphics.lineBetween(x + slat * 4 * scale, y - 6 * scale, x + slat * 4 * scale, y + 5 * scale);
      }
    }
  } else if (vessel === "banana-leaf-lined-plate") {
    graphics.fillStyle(0xf5efe1, 1);
    graphics.fillEllipse(x, y, 30 * scale, 20 * scale);
    graphics.fillStyle(0x4e7447, 1);
    graphics.fillEllipse(x, y - scale, 26 * scale, 16 * scale);
    graphics.lineStyle(Math.max(0.8, scale), 0x9caf6d, 0.92);
    graphics.lineBetween(x - 11 * scale, y + 3 * scale, x + 11 * scale, y - 5 * scale);
  } else if (vessel === "shared-oval-platter") {
    graphics.fillStyle(0xf5efe1, 1);
    graphics.fillEllipse(x, y, 31 * scale, 20 * scale);
    graphics.lineStyle(Math.max(1, 1.5 * scale), 0xc9bba4, 0.9);
    graphics.strokeEllipse(x, y, 31 * scale, 20 * scale);
    graphics.strokeEllipse(x, y, 26 * scale, 15 * scale);
  } else {
    graphics.fillStyle(0xf5efe1, 1);
    graphics.fillCircle(x, y, 13 * scale);
    graphics.lineStyle(Math.max(1, 1.8 * scale), 0x7a6650, 0.72);
    graphics.strokeCircle(x, y, 13 * scale);
    graphics.lineStyle(Math.max(0.8, scale), 0xd6c8ae, 0.82);
    graphics.strokeCircle(x, y, 10 * scale);
  }

  const isDrinkVessel =
    vessel === "kopitiam-cup-and-saucer" || vessel === "tall-drinking-glass";
  drawDishMotif(graphics, context, dish.id, recipe, x, y - (isDrinkVessel ? 0 : scale), scale, remaining);

  if (recipe.variantVisualKey && recipe.variantVisualFamily) {
    drawNutritionVariantCue(
      graphics,
      recipe.variantVisualKey,
      recipe.variantVisualFamily,
      x,
      y - (isDrinkVessel ? 0 : scale),
      scale,
    );
  }

  if (recipe.steam !== "none" && !isReducedMotion && eatenFraction < 0.82) {
    const wisps = recipe.steam === "full" ? 3 : 1;
    graphics.lineStyle(Math.max(1, 1.35 * scale), 0xffffff, 0.64);
    for (let index = 0; index < wisps; index += 1) {
      const phase = Math.sin(context.state.tick * 0.14 + index) * 2 * scale;
      const steamX = x + (index - (wisps - 1) / 2) * 5 * scale;
      graphics.lineBetween(steamX, y - 8 * scale, steamX + phase, y - 15 * scale);
    }
  }
}
