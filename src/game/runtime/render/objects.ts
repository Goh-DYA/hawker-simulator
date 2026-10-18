/**
 * Renderers for placed objects: the `drawObjects` dispatch over every object, the non-stall
 * renderers (tables, seats, stall fixtures, tray and waste points, lighting, fans, facilities,
 * plants, signage, dividers and decor), the shadow and maker mark they share, and
 * `boundsForObject`, the footprint bounds every object renderer draws within.
 *
 * Each renderer picks its art branch through `resolve_placeable_style` (`art.ts`), which reads
 * the ID-keyed `PLACEABLE_STYLE_BY_ID` table; single-substring cues on the motif still tweak
 * sizes, colours and details within a branch.
 *
 * Each function draws only from its arguments into the Phaser graphics it is given, so it can
 * live outside the scene. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import { PLACEABLE_BY_ID, type PlaceableCategory } from "@/src/content";
import { getObjectOccupiedTiles, type PlacedObject, type SimulationCatalog } from "@/src/game/core";

import { darken, lighten, mixColour } from "../visuals/palette";
import { visualRecipeForPlaceable, type PlaceableVisualRecipe } from "../visuals/placeable";
import { TILE_SIZE } from "../world";
import { resolve_placeable_style, type SignageLabelStyle } from "./art";
import type { LabelSink, ObjectVisualBounds, RenderContext } from "./context";
import { drawStallGraphic } from "./stall";

/**
 * Phaser's `Math.DEG_TO_RAD`. `Phaser.Math.DegToRad(degrees)` is `degrees * DEG_TO_RAD`, so
 * multiplying by this constant gives the same angle to the last bit.
 */
const DEG_TO_RAD = Math.PI / 180;

/** The short label each sign label style places above the sign. */
const SIGNAGE_LABEL_TEXT: Readonly<Record<SignageLabelStyle, string>> = {
  directory: "DIRECTORY",
  menu: "MENU",
  return: "RETURN →",
  accessible: "ACCESS",
  queue: "QUEUE",
  row: "ROW",
  welcome: "WELCOME",
};

/**
 * Computes the world-space pixel bounds of an object's occupied footprint.
 *
 * @param object - The placed object.
 * @param catalog - The catalog that defines the object's footprint.
 * @returns The bounds, or undefined when the object occupies no tiles.
 */
export function boundsForObject(
  object: PlacedObject,
  catalog: SimulationCatalog,
): ObjectVisualBounds | undefined {
  const cells = getObjectOccupiedTiles(object, catalog);
  if (cells.length === 0) return undefined;
  const minX = Math.min(...cells.map((cell) => cell.x)) * TILE_SIZE;
  const minY = Math.min(...cells.map((cell) => cell.y)) * TILE_SIZE;
  const maxX = (Math.max(...cells.map((cell) => cell.x)) + 1) * TILE_SIZE;
  const maxY = (Math.max(...cells.map((cell) => cell.y)) + 1) * TILE_SIZE;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centreX: (minX + maxX) / 2,
    centreY: (minY + maxY) / 2,
  };
}

/**
 * Draws the small maker's badge in an object's bottom-right corner.
 *
 * @param graphics - The graphics object to draw into.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe; its maker mark picks a dot or a bar.
 */
export function drawMakerMark(
  graphics: Phaser.GameObjects.Graphics,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  // A restrained maker's badge keeps deterministic identity without making
  // unrelated furniture look as though it came from the same toy set.
  const badgeX = bounds.maxX - 10;
  const badgeY = bounds.maxY - 9;
  graphics.fillStyle(0xe7c66d, 0.9);
  graphics.fillRoundedRect(badgeX - 5, badgeY - 3, 10, 6, 2);
  graphics.fillStyle(darken(recipe.accent, 0.28), 1);
  if ((recipe.makerMark & 1) === 0) {
    graphics.fillCircle(badgeX, badgeY, 1.7);
  } else {
    graphics.fillRect(badgeX - 2, badgeY - 1, 4, 2);
  }
}

/**
 * Draws the two-layer soft drop shadow under an object.
 *
 * @param graphics - The graphics object to draw into.
 * @param bounds - The object's world-space footprint bounds.
 * @param round - Whether to draw an elliptical shadow instead of a rounded rectangle.
 */
export function drawObjectShadow(
  graphics: Phaser.GameObjects.Graphics,
  bounds: ObjectVisualBounds,
  round = false,
) {
  graphics.fillStyle(0x17352e, 0.08);
  if (round) {
    graphics.fillEllipse(bounds.centreX + 5, bounds.centreY + 9, bounds.width - 5, bounds.height - 7);
  } else {
    graphics.fillRoundedRect(bounds.minX + 9, bounds.minY + 12, bounds.width - 6, bounds.height - 3, 8);
  }
  graphics.fillStyle(0x17352e, 0.17);
  if (round) {
    graphics.fillEllipse(bounds.centreX + 3, bounds.centreY + 7, bounds.width - 9, bounds.height - 12);
  } else {
    graphics.fillRoundedRect(bounds.minX + 7, bounds.minY + 10, bounds.width - 8, bounds.height - 5, 7);
  }
}

/**
 * Draws a seat: a stool or perch, a bench or booth, or a chair.
 *
 * @param graphics - The graphics object to draw into.
 * @param id - The placeable's motif, matched by substring for the cues that tweak its branch.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawSeatGraphic(
  graphics: Phaser.GameObjects.Graphics,
  id: string,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  const style = resolve_placeable_style("seat", recipe);
  const isStool = style === "stool";
  const isBench = style === "bench";
  const frame = id.includes("communal") ? 0x6b462d : 0x435a55;
  drawObjectShadow(graphics, bounds, isStool);

  if (isStool) {
    const radius = Math.min(bounds.width, bounds.height) * (id.includes("high-counter") ? 0.29 : 0.34);
    graphics.fillStyle(frame, 1);
    if (id.includes("swivel")) {
      graphics.fillRect(bounds.centreX - 3, bounds.centreY + 2, 6, bounds.height * 0.34);
      graphics.fillEllipse(bounds.centreX, bounds.maxY - 8, 25, 7);
      graphics.fillStyle(recipe.accent, 1);
      graphics.fillEllipse(bounds.centreX, bounds.centreY - 4, radius * 2.3, radius * 1.35);
      graphics.fillStyle(lighten(recipe.accent, 0.26), 1);
      graphics.fillEllipse(bounds.centreX - 3, bounds.centreY - 7, radius, radius * 0.35);
    } else {
      for (let leg = 0; leg < 3; leg += 1) {
        const angle = (leg / 3) * Math.PI * 2 + Math.PI / 2;
        graphics.lineStyle(3.5, frame, 1);
        graphics.lineBetween(
          bounds.centreX + Math.cos(angle) * radius * 0.55,
          bounds.centreY + Math.sin(angle) * radius * 0.45,
          bounds.centreX + Math.cos(angle) * radius * 0.9,
          bounds.maxY - 7 + Math.sin(angle) * 2,
        );
      }
      graphics.fillStyle(recipe.accent, 1);
      if (id.includes("high-counter")) {
        graphics.fillRoundedRect(bounds.centreX - radius, bounds.centreY - radius * 0.62, radius * 2, radius * 1.25, 4);
        graphics.lineStyle(2.5, lighten(frame, 0.22), 1);
        graphics.strokeRoundedRect(bounds.centreX - radius, bounds.centreY - radius * 0.62, radius * 2, radius * 1.25, 4);
        graphics.lineBetween(bounds.centreX - 9, bounds.maxY - 13, bounds.centreX + 9, bounds.maxY - 13);
      } else {
        graphics.fillCircle(bounds.centreX, bounds.centreY - 2, radius);
        graphics.lineStyle(3, frame, 0.9);
        graphics.strokeCircle(bounds.centreX, bounds.centreY - 2, radius);
        graphics.fillStyle(lighten(recipe.accent, 0.3), 0.82);
        graphics.fillEllipse(bounds.centreX - 3, bounds.centreY - 6, radius, radius * 0.38);
      }
    }
  } else if (isBench) {
    if (id.includes("acoustic")) {
      graphics.fillStyle(darken(recipe.accent, 0.35), 1);
      graphics.fillRoundedRect(bounds.minX + 4, bounds.minY + 4, bounds.width - 8, bounds.height - 12, 13);
      graphics.fillStyle(lighten(recipe.accent, 0.16), 1);
      graphics.fillRoundedRect(bounds.minX + 10, bounds.minY + 13, bounds.width - 20, bounds.height - 25, 8);
      graphics.fillStyle(0xede3d2, 1);
      graphics.fillRoundedRect(bounds.minX + 15, bounds.centreY - 3, bounds.width - 30, 12, 5);
      graphics.fillStyle(frame, 1);
      for (let slat = 0; slat < 3; slat += 1) {
        graphics.fillRect(bounds.minX + 12, bounds.minY + 11 + slat * 8, bounds.width - 24, 2);
      }
    } else {
      graphics.fillStyle(frame, 1);
      for (const legX of [bounds.minX + 13, bounds.maxX - 13]) {
        graphics.fillRect(legX - 3, bounds.centreY, 6, bounds.height * 0.34);
      }
      graphics.fillStyle(recipe.accent, 1);
      graphics.fillRoundedRect(bounds.minX + 6, bounds.minY + 14, bounds.width - 12, bounds.height - 24, 4);
      graphics.fillStyle(id.includes("communal") ? 0x8a5b38 : darken(recipe.accent, 0.42), 1);
      graphics.fillRoundedRect(bounds.minX + 7, bounds.minY + 6, bounds.width - 14, 11, 4);
      if (id.includes("communal")) {
        graphics.lineStyle(1.5, 0xd3a86f, 0.75);
        graphics.lineBetween(bounds.minX + 11, bounds.minY + 11, bounds.maxX - 11, bounds.minY + 11);
        graphics.lineBetween(bounds.minX + 11, bounds.centreY, bounds.maxX - 11, bounds.centreY);
      }
      const places = id.includes("three-person") ? 3 : 2;
      for (let index = 1; index < places; index += 1) {
        const x = bounds.minX + (bounds.width * index) / places;
        graphics.lineStyle(2, 0xfff4d8, 0.64);
        graphics.lineBetween(x, bounds.minY + 17, x, bounds.maxY - 12);
      }
    }
  } else {
    const inset = id.includes("easy-rise") ? 7 : 10;
    graphics.fillStyle(frame, 1);
    graphics.fillRect(bounds.minX + inset + 1, bounds.centreY + 4, 5, bounds.height * 0.28);
    graphics.fillRect(bounds.maxX - inset - 6, bounds.centreY + 4, 5, bounds.height * 0.28);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillRoundedRect(bounds.minX + inset, bounds.minY + 15, bounds.width - inset * 2, bounds.height - 24, 7);
    graphics.fillStyle(darken(recipe.accent, id.includes("easy-rise") ? 0.18 : 0.42), 1);
    if (id.includes("moulded")) {
      graphics.fillRoundedRect(bounds.minX + inset - 2, bounds.minY + 5, bounds.width - inset * 2 + 4, 15, 8);
      graphics.fillStyle(0xe7ddd0, 0.88);
      graphics.fillRoundedRect(bounds.centreX - 7, bounds.minY + 9, 14, 5, 3);
    } else {
      graphics.fillRoundedRect(bounds.minX + inset, bounds.minY + 6, bounds.width - inset * 2, id.includes("easy-rise") ? 17 : 11, 5);
    }
    if (id.includes("arm-chair")) {
      graphics.fillStyle(frame, 1);
      graphics.fillRoundedRect(bounds.minX + 4, bounds.minY + 15, 8, bounds.height - 21, 3);
      graphics.fillRoundedRect(bounds.maxX - 12, bounds.minY + 15, 8, bounds.height - 21, 3);
      graphics.fillStyle(lighten(recipe.accent, 0.2), 1);
      graphics.fillRoundedRect(bounds.minX + 4, bounds.minY + 14, 11, 6, 3);
      graphics.fillRoundedRect(bounds.maxX - 15, bounds.minY + 14, 11, 6, 3);
    }
    if (id.includes("booster")) {
      graphics.fillStyle(0xf6cf68, 1);
      graphics.fillRoundedRect(bounds.centreX - 9, bounds.centreY - 5, 18, 13, 4);
      graphics.lineStyle(2, 0xc66c3c, 1);
      graphics.lineBetween(bounds.centreX - 8, bounds.centreY - 2, bounds.centreX + 7, bounds.centreY + 7);
      graphics.lineBetween(bounds.centreX + 8, bounds.centreY - 2, bounds.centreX - 7, bounds.centreY + 7);
    }
    if (id.includes("cushioned")) {
      graphics.fillStyle(lighten(recipe.accent, 0.38), 0.95);
      graphics.fillRoundedRect(bounds.minX + inset + 3, bounds.minY + 18, bounds.width - inset * 2 - 6, bounds.height - 31, 5);
      graphics.lineStyle(1.5, darken(recipe.accent, 0.18), 0.75);
      graphics.lineBetween(bounds.centreX - 7, bounds.centreY - 5, bounds.centreX + 7, bounds.centreY + 5);
      graphics.lineBetween(bounds.centreX + 7, bounds.centreY - 5, bounds.centreX - 7, bounds.centreY + 5);
      graphics.fillStyle(0xffe8cf, 0.9);
      graphics.fillCircle(bounds.centreX, bounds.centreY, 2.3);
    }
  }
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws a stall fixture such as a condiment or cutlery station, display case or pickup point.
 *
 * @param graphics - The graphics object to draw into.
 * @param id - The placeable's motif, matched by substring for the cues that tweak its branch.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawFixtureGraphic(
  graphics: Phaser.GameObjects.Graphics,
  id: string,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  drawObjectShadow(graphics, bounds);
  const x = bounds.minX + 7;
  const y = bounds.minY + 7;
  const width = bounds.width - 14;
  const height = bounds.height - 17;
  const frame = darken(recipe.accent, 0.52);
  const style = resolve_placeable_style("stall-fixture", recipe);

  if (style === "ticket") {
    graphics.fillStyle(0x4f625d, 1);
    graphics.fillRoundedRect(bounds.centreX - 12, y, 24, height - 2, 8);
    graphics.fillStyle(0x142e30, 1);
    graphics.fillRoundedRect(bounds.centreX - 8, y + 6, 16, 13, 3);
    graphics.fillStyle(0x8fd3c3, 1);
    graphics.fillCircle(bounds.centreX, y + 12, 3);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillRoundedRect(bounds.centreX - 7, y + 24, 14, 6, 2);
    graphics.fillStyle(0xfff4d8, 1);
    graphics.fillRect(bounds.centreX - 5, y + 29, 10, 10);
    graphics.fillStyle(frame, 1);
    graphics.fillRect(bounds.centreX - 2, bounds.maxY - 10, 4, 7);
  } else if (style === "condiment") {
    graphics.fillStyle(0x986642, 1);
    graphics.fillRoundedRect(x, bounds.centreY - 5, width, height * 0.55, 5);
    graphics.fillStyle(0xd4a465, 1);
    graphics.fillRoundedRect(x - 2, bounds.centreY - 8, width + 4, 8, 3);
    graphics.fillStyle(0x4b5b56, 1);
    graphics.fillRoundedRect(bounds.centreX - 19, bounds.centreY - 18, 38, 11, 3);
    const bottleColours = [0xc8624c, 0xd69a35, 0x4d8753];
    for (let index = 0; index < 3; index += 1) {
      graphics.fillStyle(bottleColours[index] as number, 1);
      graphics.fillRoundedRect(bounds.centreX - 14 + index * 11, bounds.centreY - 24, 8, 17, 3);
      graphics.fillStyle(0xe9e0c9, 1);
      graphics.fillRect(bounds.centreX - 12 + index * 11, bounds.centreY - 27, 4, 4);
    }
  } else if (style === "cutlery") {
    graphics.fillStyle(0x71837f, 1);
    graphics.fillRoundedRect(x, y + 10, width, height - 10, 5);
    graphics.fillStyle(0xdce8e4, 1);
    for (let slot = 0; slot < 3; slot += 1) {
      graphics.fillRoundedRect(bounds.centreX - 17 + slot * 12, y + 4, 9, height * 0.65, 4);
    }
    graphics.lineStyle(2, 0x61716d, 1);
    for (let index = -1; index <= 1; index += 1) {
      const utensilX = bounds.centreX + index * 12;
      graphics.lineBetween(utensilX, y + 8, utensilX, bounds.centreY + 5);
      graphics.fillCircle(utensilX, y + 7, 2.5);
    }
  } else if (style === "water") {
    graphics.fillStyle(0x5f716c, 1);
    graphics.fillRoundedRect(x, bounds.centreY - 4, width, height * 0.58, 5);
    for (const carafeX of [bounds.centreX - 11, bounds.centreX + 11]) {
      graphics.fillStyle(0xbde4e8, 0.74);
      graphics.fillRoundedRect(carafeX - 6, y + 3, 12, 23, 5);
      graphics.fillStyle(0x70bfd0, 0.9);
      graphics.fillRoundedRect(carafeX - 5, y + 12, 10, 13, 4);
      graphics.lineStyle(2, 0x5c7a7f, 1);
      graphics.strokeCircle(carafeX + 7, y + 11, 4);
    }
    graphics.fillStyle(0xf0eee1, 1);
    for (let cup = 0; cup < 3; cup += 1) {
      graphics.fillRoundedRect(bounds.centreX - 12 + cup * 9, bounds.centreY + 7, 7, 8, 2);
    }
  } else if (style === "pickup") {
    graphics.fillStyle(frame, 1);
    graphics.fillRoundedRect(x, y, width, height, 4);
    graphics.fillStyle(0xe6e0cd, 1);
    graphics.fillRoundedRect(x + 4, y + 4, width - 8, height - 10, 2);
    graphics.fillStyle(frame, 1);
    for (let row = 1; row < 3; row += 1) {
      graphics.fillRect(x + 3, y + row * (height / 3), width - 6, 4);
    }
    for (let row = 0; row < 2; row += 1) {
      graphics.fillStyle(row === 0 ? recipe.accent : 0xd49a44, 1);
      graphics.fillEllipse(bounds.centreX + (row ? 7 : -8), y + 10 + row * 13, 13, 6);
    }
  } else if (style === "display-case") {
    const chilled = id.includes("chilled");
    graphics.fillStyle(0x50615d, 1);
    graphics.fillRoundedRect(x, y + 2, width, height, 5);
    graphics.fillStyle(chilled ? 0xa9d9e2 : 0xf4b567, 0.5);
    graphics.fillRoundedRect(x + 4, y + 5, width - 8, height - 13, 3);
    graphics.lineStyle(2, chilled ? 0xe9fbff : 0xffead0, 0.92);
    graphics.strokeRoundedRect(x + 4, y + 5, width - 8, height - 13, 3);
    graphics.lineBetween(x + 6, bounds.centreY, x + width - 6, bounds.centreY);
    for (let row = 0; row < 2; row += 1) {
      graphics.fillStyle(chilled ? (row === 0 ? 0x79aeb5 : 0xe8d6b5) : row === 0 ? 0xd27b4c : 0xe6b94e, 1);
      const servingY = bounds.centreY - 7 + row * 16;
      for (let serving = 0; serving < 3; serving += 1) {
        graphics.fillEllipse(bounds.centreX - 14 + serving * 14, servingY, 10, 5);
      }
    }
    graphics.fillStyle(chilled ? 0x579ab0 : 0xd85e39, 1);
    graphics.fillRect(x + 4, bounds.maxY - 13, width - 8, 5);
  } else {
    graphics.fillStyle(0x71837f, 1);
    graphics.fillRoundedRect(x, y + 5, width, height - 4, 5);
    graphics.fillStyle(0xd8ddd7, 1);
    graphics.fillRoundedRect(x - 2, y, width + 4, 9, 3);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillRect(x + 5, y + 12, width - 10, height - 21);
    graphics.fillStyle(0x294d42, 1);
    graphics.fillCircle(x + 7, bounds.maxY - 7, 5);
    graphics.fillCircle(x + width - 7, bounds.maxY - 7, 5);
    graphics.lineStyle(2, 0xaebbb7, 1);
    graphics.lineBetween(x + 4, y + height - 7, x + width - 4, y + height - 7);
  }
  graphics.lineStyle(2.5, frame, 0.82);
  if (style !== "ticket") {
    graphics.strokeRoundedRect(x, y, width, height, 6);
  }
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws a tray-return, dish-drop, recycling or food-waste point, labelling tray points.
 *
 * @param add_label - Places the object's text label in the world.
 * @param graphics - The graphics object to draw into.
 * @param id - The placeable's motif, matched by substring for the cues that tweak its branch.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawTrayWasteGraphic(
  add_label: LabelSink,
  graphics: Phaser.GameObjects.Graphics,
  id: string,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  drawObjectShadow(graphics, bounds);
  const x = bounds.minX + 6;
  const y = bounds.minY + 5;
  const width = bounds.width - 12;
  const height = bounds.height - 11;
  const steel = 0x83938f;
  const darkSteel = 0x41534f;
  const style = resolve_placeable_style("tray-waste", recipe);

  if (style === "tray-point") {
    graphics.fillStyle(darkSteel, 1);
    graphics.fillRoundedRect(x, y, width, height, 5);
    graphics.fillStyle(0xcdd5d1, 1);
    graphics.fillRoundedRect(x + 4, y + 4, width - 8, height - 8, 3);
    const bays = id.includes("dual") ? 2 : 1;
    for (let bay = 0; bay < bays; bay += 1) {
      const bayX = x + 7 + bay * ((width - 9) / bays);
      const bayWidth = (width - 13) / bays;
      graphics.fillStyle(0x253d39, 1);
      graphics.fillRoundedRect(bayX, y + 12, bayWidth - 3, height - 21, 2);
      const shelfCount = id.includes("dish-drop") ? 2 : 3;
      for (let row = 0; row < shelfCount; row += 1) {
        const shelfY = y + 18 + row * ((height - 24) / shelfCount);
        graphics.fillStyle(steel, 1);
        graphics.fillRect(bayX + 2, shelfY, bayWidth - 7, 4);
        graphics.fillStyle(id.includes("tray-stack") ? 0xd8af68 : 0xd6dcd7, 1);
        graphics.fillRoundedRect(bayX + 4, shelfY - 3, bayWidth - 11, 4, 1);
      }
    }
    if (id.includes("dish-drop")) {
      graphics.fillStyle(0x1d312e, 1);
      graphics.fillEllipse(bounds.centreX, y + 10, Math.min(36, width - 17), 8);
      graphics.lineStyle(2, 0xe8eee9, 1);
      graphics.strokeEllipse(bounds.centreX, y + 10, Math.min(36, width - 17), 8);
    } else {
      graphics.fillStyle(recipe.accent, 1);
      graphics.fillRect(x + 5, y + 5, width - 10, 6);
    }
    add_label(bounds.centreX, bounds.minY - 2, id.includes("tray-stack") ? "CLEAN TRAYS" : id.includes("dish-drop") ? "DISH DROP" : "RETURN");
  } else if (style === "recycling") {
    graphics.fillStyle(0x5c6f6a, 1);
    graphics.fillRoundedRect(x, y + 7, width, height - 7, 5);
    const colours = [0x4d8753, 0xf2c14e, 0x4d7390] as const;
    for (let index = 0; index < 3; index += 1) {
      const openingX = bounds.minX + 15 + index * ((bounds.width - 30) / 2);
      graphics.fillStyle(colours[index] as number, 1);
      graphics.fillRoundedRect(openingX - 9, y, 18, 15, 4);
      graphics.fillStyle(0x20332f, 1);
      if (index === 0) {
        graphics.fillCircle(openingX, y + 7, 4);
      } else if (index === 1) {
        graphics.fillRoundedRect(openingX - 5, y + 4, 10, 6, 2);
      } else {
        graphics.fillEllipse(openingX, y + 7, 12, 5);
      }
      graphics.fillStyle(lighten(colours[index] as number, 0.45), 0.9);
      graphics.fillCircle(openingX, bounds.centreY + 10, 3);
    }
  } else if (style === "food-waste") {
    graphics.fillStyle(0x6f633f, 1);
    graphics.fillRoundedRect(x + 3, y + 9, width - 6, height - 11, 7);
    graphics.fillStyle(0x4c432b, 1);
    graphics.fillRoundedRect(x, y + 3, width, 13, 6);
    graphics.fillStyle(0x202f2b, 1);
    graphics.fillEllipse(bounds.centreX, y + 9, width - 16, 7);
    graphics.fillStyle(0x6c914f, 1);
    graphics.fillEllipse(bounds.centreX - 5, y + 8, 9, 4);
    graphics.fillStyle(0xc58a3f, 1);
    graphics.fillCircle(bounds.centreX + 5, y + 7, 2.5);
    graphics.fillStyle(0xc3c8bd, 1);
    graphics.fillRoundedRect(bounds.centreX - 9, bounds.maxY - 8, 18, 4, 2);
  } else if (style === "trolley") {
    graphics.fillStyle(steel, 1);
    graphics.fillRoundedRect(x + 4, bounds.centreY - 2, width - 8, height * 0.48, 4);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillRoundedRect(x + 8, bounds.centreY + 2, width - 16, height * 0.32, 3);
    graphics.lineStyle(4, darkSteel, 1);
    graphics.lineBetween(x + 5, y + 7, x + 5, bounds.maxY - 8);
    graphics.lineBetween(bounds.maxX - 11, y + 11, bounds.maxX - 11, bounds.maxY - 8);
    graphics.lineStyle(3, 0x8a6241, 1);
    graphics.lineBetween(bounds.centreX + 13, y - 3, bounds.centreX + 4, bounds.centreY + 7);
    graphics.fillStyle(0x4d8753, 1);
    graphics.fillTriangle(bounds.centreX - 16, bounds.centreY + 7, bounds.centreX - 6, y + 10, bounds.centreX + 1, bounds.centreY + 7);
    graphics.fillStyle(0x263d38, 1);
    graphics.fillCircle(x + 9, bounds.maxY - 7, 5);
    graphics.fillCircle(x + width - 9, bounds.maxY - 7, 5);
  } else {
    graphics.fillStyle(darken(recipe.accent, 0.18), 1);
    graphics.fillRoundedRect(x + 4, y + 9, width - 8, height - 10, 7);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillRoundedRect(x, y + 2, width, 14, 6);
    graphics.fillStyle(0x263d38, 1);
    graphics.fillEllipse(bounds.centreX, y + 9, width - 15, 8);
    graphics.fillStyle(0xc4cac4, 1);
    graphics.fillRoundedRect(bounds.centreX - 9, bounds.maxY - 8, 18, 4, 2);
    graphics.fillStyle(lighten(recipe.accent, 0.5), 1);
    graphics.fillRect(bounds.centreX - 2, bounds.centreY - 3, 4, 10);
  }
  graphics.lineStyle(2.5, darkSteel, 0.84);
  graphics.strokeRoundedRect(x, y, width, height, 5);
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws a plant, planter or garden bed.
 *
 * @param graphics - The graphics object to draw into.
 * @param id - The placeable's motif, matched by substring for the cues that tweak its branch.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawPlantGraphic(
  graphics: Phaser.GameObjects.Graphics,
  id: string,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  const style = resolve_placeable_style("plant", recipe);
  drawObjectShadow(graphics, bounds, id.includes("pot") || id.includes("table-herb"));
  const leafDark = id.includes("rain-garden") ? 0x33706a : 0x376f46;
  const leafLight = mixColour(recipe.accent, 0x58a55f, 0.7);
  const baseY = bounds.maxY - (id.includes("border-bed") || id.includes("trough") ? 19 : 23);

  if (id.includes("trellis")) {
    graphics.lineStyle(3, 0x8b5b4c, 1);
    for (let column = 0; column < 3; column += 1) {
      const x = bounds.minX + 10 + column * ((bounds.width - 20) / 2);
      graphics.lineBetween(x, bounds.minY + 7, x, bounds.maxY - 8);
    }
    graphics.lineBetween(bounds.minX + 8, bounds.centreY, bounds.maxX - 8, bounds.centreY);
    graphics.lineStyle(2.5, leafDark, 1);
    for (let vine = 0; vine < 3; vine += 1) {
      const vineX = bounds.minX + 12 + vine * ((bounds.width - 24) / 2);
      graphics.lineBetween(vineX, bounds.maxY - 10, vineX + (vine % 2 ? 8 : -7), bounds.minY + 10);
      for (let node = 0; node < 4; node += 1) {
        const nodeY = bounds.maxY - 17 - node * ((bounds.height - 26) / 4);
        graphics.fillStyle(node % 2 === 0 ? leafLight : leafDark, 1);
        graphics.fillEllipse(vineX + (node % 2 ? 5 : -5), nodeY, 10, 6);
      }
    }
  }
  const potHeight = id.includes("border-bed") || id.includes("trough") ? 13 : 17;
  graphics.fillStyle(id.includes("rain-garden") ? 0x477c86 : id.includes("hanging") ? 0xc68a52 : 0x9a6844, 1);
  if (id.includes("hanging")) {
    graphics.fillEllipse(bounds.centreX, bounds.centreY - 1, bounds.width * 0.48, 14);
    graphics.fillRoundedRect(bounds.centreX - bounds.width * 0.18, bounds.centreY - 2, bounds.width * 0.36, 13, 5);
  } else {
    graphics.fillRoundedRect(bounds.minX + bounds.width * 0.18, bounds.maxY - potHeight - 5, bounds.width * 0.64, potHeight, 5);
    graphics.fillStyle(lighten(id.includes("rain-garden") ? 0x477c86 : 0x9a6844, 0.24), 0.9);
    graphics.fillRect(bounds.minX + bounds.width * 0.23, bounds.maxY - potHeight - 2, bounds.width * 0.54, 3);
  }

  if (style === "banana") {
    graphics.lineStyle(4, 0x507242, 1);
    for (let leaf = 0; leaf < 6; leaf += 1) {
      const angle = -Math.PI * 0.84 + (leaf / 5) * Math.PI * 0.68;
      const length = 25 + (leaf % 2) * 5;
      const tipX = bounds.centreX + Math.cos(angle) * length;
      const tipY = baseY + Math.sin(angle) * length;
      graphics.lineBetween(bounds.centreX, baseY, tipX, tipY);
      graphics.fillStyle(leaf % 2 === 0 ? leafLight : leafDark, 1);
      graphics.fillEllipse(
        bounds.centreX + Math.cos(angle) * length * 0.62,
        baseY + Math.sin(angle) * length * 0.62,
        20,
        8,
      );
      graphics.lineStyle(2, 0xd5b154, 1);
      graphics.lineBetween(bounds.centreX, baseY, bounds.centreX, baseY - 18);
    }
  } else if (style === "areca") {
    for (let frond = 0; frond < 7; frond += 1) {
      const angle = -Math.PI * 0.9 + (frond / 6) * Math.PI * 0.8;
      const length = 24 + (frond % 3) * 4;
      const tipX = bounds.centreX + Math.cos(angle) * length;
      const tipY = baseY + Math.sin(angle) * length;
      graphics.lineStyle(2.5, 0x3b6f45, 1);
      graphics.lineBetween(bounds.centreX, baseY, tipX, tipY);
      for (let leaflet = 1; leaflet <= 3; leaflet += 1) {
        const fraction = leaflet / 4;
        const stemX = bounds.centreX + (tipX - bounds.centreX) * fraction;
        const stemY = baseY + (tipY - baseY) * fraction;
        graphics.fillStyle((frond + leaflet) % 2 ? leafLight : leafDark, 1);
        graphics.fillEllipse(stemX + (leaflet % 2 ? 4 : -4), stemY, 10, 4);
      }
    }
  } else if (style === "pandan") {
    for (let leaf = 0; leaf < 10; leaf += 1) {
      const leafX = bounds.minX + 8 + leaf * ((bounds.width - 16) / 9);
      graphics.fillStyle(leaf % 2 === 0 ? leafDark : leafLight, 1);
      graphics.fillTriangle(leafX - 3, baseY + 3, leafX + 3, baseY + 3, leafX + (leaf % 2 ? 7 : -7), bounds.minY + 7 + (leaf % 3) * 4);
    }
  } else if (style === "fern") {
    for (let frond = 0; frond < 8; frond += 1) {
      const frondX = bounds.minX + 9 + frond * ((bounds.width - 18) / 7);
      const sway = (frond % 3 - 1) * 8;
      graphics.lineStyle(2, leafDark, 1);
      graphics.lineBetween(frondX, baseY, frondX + sway, bounds.minY + 10 + (frond % 2) * 5);
      for (let leaflet = 0; leaflet < 3; leaflet += 1) {
        graphics.fillStyle((frond + leaflet) % 2 ? leafLight : leafDark, 1);
        graphics.fillEllipse(frondX + sway * (leaflet + 1) / 4 + (leaflet % 2 ? 4 : -4), baseY - 5 - leaflet * 5, 8, 4);
      }
    }
  } else if (style === "rain-garden") {
    graphics.fillStyle(0x76b5bd, 0.8);
    graphics.fillEllipse(bounds.centreX, baseY + 3, bounds.width * 0.45, 10);
    for (let reed = 0; reed < 5; reed += 1) {
      const reedX = bounds.centreX - 14 + reed * 7;
      graphics.lineStyle(2.5, reed % 2 ? leafLight : leafDark, 1);
      graphics.lineBetween(reedX, baseY + 1, reedX + (reed % 2 ? 3 : -3), bounds.minY + 9 + (reed % 3) * 4);
      graphics.fillStyle(0xb7894d, 1);
      graphics.fillEllipse(reedX + (reed % 2 ? 3 : -3), bounds.minY + 9 + (reed % 3) * 4, 4, 7);
    }
  } else if (style === "hanging") {
    for (let vine = 0; vine < 5; vine += 1) {
      const vineX = bounds.centreX - 14 + vine * 7;
      const vineLength = 14 + (vine % 3) * 7;
      graphics.lineStyle(2, leafDark, 1);
      graphics.lineBetween(vineX, bounds.centreY + 4, vineX + (vine % 2 ? 5 : -4), bounds.centreY + vineLength);
      for (let leaf = 0; leaf < 2; leaf += 1) {
        graphics.fillStyle((vine + leaf) % 2 ? leafLight : leafDark, 1);
        graphics.fillEllipse(vineX + (leaf ? 4 : -3), bounds.centreY + 10 + leaf * 7, 9, 6);
      }
    }
  } else if (style === "leafy") {
    const leafCount = id.includes("herb") ? 7 : 5;
    for (let leaf = 0; leaf < leafCount; leaf += 1) {
      const angle = -Math.PI * 0.9 + (leaf / Math.max(1, leafCount - 1)) * Math.PI * 0.8;
      const length = id.includes("herb") ? 12 : 19;
      const tipX = bounds.centreX + Math.cos(angle) * length;
      const tipY = baseY + Math.sin(angle) * length;
      graphics.lineStyle(2.5, leafDark, 1);
      graphics.lineBetween(bounds.centreX, baseY, tipX, tipY);
      graphics.fillStyle(leaf % 2 === 0 ? leafLight : leafDark, 1);
      graphics.fillEllipse(tipX, tipY, id.includes("herb") ? 8 : 12, id.includes("herb") ? 6 : 7);
    }
  }
  if (id.includes("hanging")) {
    graphics.lineStyle(2, 0x6b4c32, 1);
    graphics.lineBetween(bounds.centreX - 9, bounds.minY + 3, bounds.centreX - 5, bounds.centreY);
    graphics.lineBetween(bounds.centreX + 9, bounds.minY + 3, bounds.centreX + 5, bounds.centreY);
  }
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws a sign on a post, with its short text label.
 *
 * @param add_label - Places the object's text label in the world.
 * @param graphics - The graphics object to draw into.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawSignageGraphic(
  add_label: LabelSink,
  graphics: Phaser.GameObjects.Graphics,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  drawObjectShadow(graphics, bounds);
  graphics.fillStyle(0x6b4c32, 1);
  graphics.fillRect(bounds.centreX - 3, bounds.centreY, 6, bounds.height * 0.35);
  graphics.fillStyle(recipe.accent, 1);
  const style = resolve_placeable_style("signage", recipe);
  const isBoard = style.panel === "board";
  if (isBoard) {
    graphics.fillRoundedRect(bounds.minX + 5, bounds.minY + 5, bounds.width - 10, bounds.height * 0.58, 5);
    graphics.fillStyle(0xfff4d8, 1);
    for (let row = 0; row < 3; row += 1) graphics.fillRect(bounds.minX + 12, bounds.minY + 13 + row * 8, bounds.width - 24, 3);
  } else {
    graphics.fillRoundedRect(bounds.minX + 7, bounds.minY + 8, bounds.width - 14, bounds.height * 0.45, 5);
    graphics.fillStyle(0xfff4d8, 1);
    if (style.panel === "arrow") {
      graphics.fillTriangle(bounds.maxX - 13, bounds.minY + 18, bounds.maxX - 24, bounds.minY + 10, bounds.maxX - 24, bounds.minY + 26);
      graphics.fillRect(bounds.minX + 13, bounds.minY + 15, bounds.width - 34, 6);
    } else if (style.panel === "accessible") {
      graphics.strokeCircle(bounds.centreX, bounds.minY + 18, 7);
      graphics.lineBetween(bounds.centreX, bounds.minY + 25, bounds.centreX + 8, bounds.minY + 30);
    } else if (style.panel === "queue") {
      for (let dot = 0; dot < 3; dot += 1) graphics.fillCircle(bounds.centreX - 10 + dot * 10, bounds.minY + 19, 3);
    } else {
      graphics.fillRect(bounds.centreX - 12, bounds.minY + 14, 24, 7);
    }
  }
  add_label(bounds.centreX, bounds.minY + 5, SIGNAGE_LABEL_TEXT[style.label]);
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws a divider such as a queue rail, screen, planter or half wall.
 *
 * @param graphics - The graphics object to draw into.
 * @param id - The placeable's motif, matched by substring for the cues that tweak its branch.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawDividerGraphic(
  graphics: Phaser.GameObjects.Graphics,
  id: string,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  const style = resolve_placeable_style("divider", recipe);
  drawObjectShadow(graphics, bounds);
  if (style === "queue-rail") {
    graphics.fillStyle(0x294d42, 1);
    graphics.fillCircle(bounds.minX + 9, bounds.centreY, 6);
    graphics.fillCircle(bounds.maxX - 9, bounds.centreY, 6);
    graphics.lineStyle(5, recipe.accent, 1);
    graphics.lineBetween(bounds.minX + 10, bounds.centreY - 3, bounds.maxX - 10, bounds.centreY - 3);
  } else if (style === "clear-wind") {
    graphics.fillStyle(0xb9e2e8, 0.48);
    graphics.fillRoundedRect(bounds.minX + 5, bounds.minY + 7, bounds.width - 10, bounds.height - 14, 3);
    graphics.lineStyle(3, 0x477c86, 0.9);
    graphics.strokeRoundedRect(bounds.minX + 5, bounds.minY + 7, bounds.width - 10, bounds.height - 14, 3);
  } else if (style === "planter") {
    graphics.fillStyle(0x8b5b4c, 1);
    graphics.fillRoundedRect(bounds.minX + 5, bounds.centreY, bounds.width - 10, bounds.height * 0.35, 4);
    for (let leaf = 0; leaf < 6; leaf += 1) {
      graphics.lineStyle(5, leaf % 2 ? 0x4d8753 : recipe.accent, 1);
      const x = bounds.minX + 9 + leaf * ((bounds.width - 18) / 5);
      graphics.lineBetween(x, bounds.centreY, x + (leaf % 2 ? 6 : -6), bounds.minY + 8);
    }
  } else {
    graphics.fillStyle(id.includes("tiled") ? 0x6fa5a6 : id.includes("acoustic") ? 0x7b669b : recipe.accent, 1);
    graphics.fillRoundedRect(bounds.minX + 4, bounds.minY + (id.includes("half-wall") ? bounds.height * 0.35 : 7), bounds.width - 8, id.includes("half-wall") ? bounds.height * 0.5 : bounds.height - 14, 4);
    graphics.lineStyle(2, 0xfff4d8, 0.55);
    const divisions = 2 + recipe.detailVariant % 4;
    for (let index = 1; index < divisions; index += 1) {
      const x = bounds.minX + (bounds.width * index) / divisions;
      graphics.lineBetween(x, bounds.minY + 10, x, bounds.maxY - 10);
    }
  }
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws a facility such as a handwash basin, mop sink, water fountain or first-aid point.
 *
 * @param graphics - The graphics object to draw into.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawFacilityGraphic(
  graphics: Phaser.GameObjects.Graphics,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  drawObjectShadow(graphics, bounds);
  const x = bounds.minX + 6;
  const y = bounds.minY + 6;
  const width = bounds.width - 12;
  const height = bounds.height - 14;
  const frame = 0x40544f;
  const style = resolve_placeable_style("facility", recipe);

  if (style === "handwash") {
    graphics.fillStyle(0x647c76, 1);
    graphics.fillRoundedRect(x, y + 9, width, height - 9, 6);
    graphics.fillStyle(0xe0e7e2, 1);
    graphics.fillRoundedRect(x - 2, y + 6, width + 4, 15, 5);
    const basinCount = bounds.width > TILE_SIZE ? 2 : 1;
    for (let basin = 0; basin < basinCount; basin += 1) {
      const basinX = x + ((basin + 0.5) * width) / basinCount;
      graphics.fillStyle(0xaec5c1, 1);
      graphics.fillEllipse(basinX, y + 14, Math.min(25, width / basinCount - 7), 8);
      graphics.lineStyle(3, frame, 1);
      graphics.lineBetween(basinX, y + 4, basinX, y + 9);
      graphics.lineBetween(basinX, y + 9, basinX + 5, y + 9);
    }
    graphics.fillStyle(0x65a48e, 1);
    graphics.fillRoundedRect(bounds.maxX - 15, y + 2, 7, 12, 2);
    graphics.fillStyle(0xe9eee9, 1);
    graphics.fillRect(bounds.maxX - 13, y, 3, 4);
  } else if (style === "mop-sink") {
    graphics.fillStyle(0x8e9c98, 1);
    graphics.fillRoundedRect(x + 4, bounds.centreY - 2, width - 8, height * 0.5, 4);
    graphics.fillStyle(0xd8dfdc, 1);
    graphics.fillRoundedRect(x + 7, bounds.centreY, width - 14, height * 0.35, 3);
    graphics.fillStyle(0x7fb2bd, 0.85);
    graphics.fillEllipse(bounds.centreX, bounds.centreY + 4, width - 20, 8);
    graphics.lineStyle(3, 0x8a6241, 1);
    graphics.lineBetween(bounds.centreX + 12, y - 3, bounds.centreX + 2, bounds.maxY - 9);
    graphics.fillStyle(0x4e8a54, 1);
    for (let strand = 0; strand < 4; strand += 1) {
      graphics.lineStyle(2, 0x4e8a54, 1);
      graphics.lineBetween(bounds.centreX - 3 + strand * 2, bounds.maxY - 16, bounds.centreX - 7 + strand * 4, bounds.maxY - 7);
    }
    graphics.fillStyle(frame, 1);
    graphics.fillRoundedRect(bounds.maxX - 19, y + 3, 10, 15, 3);
    graphics.lineStyle(2, frame, 1);
    graphics.lineBetween(bounds.maxX - 14, y + 3, bounds.maxX - 14, y - 2);
  } else if (style === "accessible-basin") {
    graphics.fillStyle(0xe1e8e5, 1);
    graphics.fillRoundedRect(x + 1, y + 6, width - 2, 18, 7);
    graphics.fillStyle(0xaec5c1, 1);
    graphics.fillEllipse(bounds.centreX, y + 14, width - 16, 9);
    graphics.lineStyle(4, 0x4d7390, 1);
    graphics.lineBetween(x + 2, y + 1, x + 2, y + 27);
    graphics.lineBetween(x + 2, y + 1, x + 18, y + 1);
    graphics.lineStyle(3, frame, 1);
    graphics.lineBetween(bounds.centreX, y, bounds.centreX, y + 8);
    graphics.lineBetween(bounds.centreX, y + 8, bounds.centreX + 7, y + 8);
    graphics.lineStyle(2.5, 0x4d7390, 1);
    graphics.strokeCircle(bounds.centreX, bounds.maxY - 13, 6);
    graphics.lineBetween(bounds.centreX, bounds.maxY - 7, bounds.centreX + 7, bounds.maxY - 3);
  } else if (style === "fountain") {
    graphics.fillStyle(0x718681, 1);
    graphics.fillRoundedRect(x + 5, y + 7, width - 10, height - 8, 7);
    graphics.fillStyle(0xdce8e4, 1);
    graphics.fillEllipse(bounds.centreX, y + 12, width - 17, 12);
    graphics.fillStyle(0x9db5b0, 1);
    graphics.fillEllipse(bounds.centreX, y + 12, width - 24, 7);
    graphics.lineStyle(3, frame, 1);
    graphics.lineBetween(bounds.centreX + 6, y + 3, bounds.centreX + 6, y + 10);
    graphics.lineBetween(bounds.centreX + 6, y + 3, bounds.centreX + 12, y + 3);
    graphics.fillStyle(0x70bfd0, 1);
    graphics.fillCircle(bounds.centreX + 12, y + 6, 2.5);
  } else if (style === "first-aid") {
    graphics.fillStyle(0xf2f0e6, 1);
    graphics.fillRoundedRect(x + 3, y, width - 6, height, 5);
    graphics.lineStyle(2.5, 0x8f9e98, 1);
    graphics.strokeRoundedRect(x + 3, y, width - 6, height, 5);
    graphics.fillStyle(0xc75542, 1);
    graphics.fillRect(bounds.centreX - 4, bounds.centreY - 14, 8, 28);
    graphics.fillRect(bounds.centreX - 14, bounds.centreY - 4, 28, 8);
  } else if (style === "cupboard") {
    graphics.fillStyle(0x6e817c, 1);
    graphics.fillRoundedRect(x, y, width, height, 5);
    graphics.fillStyle(0x859792, 1);
    graphics.fillRoundedRect(x + 4, y + 4, width - 8, height - 8, 3);
    graphics.lineStyle(3, 0x294d42, 1);
    graphics.lineBetween(bounds.centreX, bounds.minY + 8, bounds.centreX, bounds.maxY - 10);
    graphics.fillStyle(0xf4c65a, 1);
    graphics.fillCircle(bounds.centreX - 5, bounds.centreY, 2.5);
    graphics.fillCircle(bounds.centreX + 5, bounds.centreY, 2.5);
    graphics.fillStyle(0xf0eee2, 1);
    graphics.fillRoundedRect(x + 7, y + 7, width - 14, 7, 2);
    graphics.fillStyle(recipe.accent, 1);
    for (let stripe = 0; stripe < 3; stripe += 1) {
      graphics.fillRect(x + 10 + stripe * ((width - 20) / 3), y + 9, 5, 2);
    }
  } else {
    graphics.fillStyle(0x667a74, 1);
    graphics.fillRoundedRect(x, y, width, height, 6);
    graphics.lineStyle(3, frame, 0.82);
    graphics.strokeRoundedRect(x, y, width, height, 6);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillRoundedRect(bounds.centreX - 11, bounds.centreY - 13, 22, 26, 4);
    graphics.fillStyle(0xf1ce55, 1);
    graphics.fillTriangle(bounds.centreX, bounds.centreY - 9, bounds.centreX - 8, bounds.centreY + 7, bounds.centreX + 8, bounds.centreY + 7);
    graphics.fillStyle(frame, 1);
    graphics.fillRect(bounds.centreX - 1.5, bounds.centreY - 3, 3, 6);
    graphics.fillCircle(bounds.centreX, bounds.centreY + 5, 1.6);
  }
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws a decor item such as bunting, a mural, a clock or a noticeboard.
 *
 * @param graphics - The graphics object to draw into.
 * @param id - The placeable's motif, matched by substring for the cues that tweak its branch.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawDecorGraphic(
  graphics: Phaser.GameObjects.Graphics,
  id: string,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  const style = resolve_placeable_style("decor", recipe);
  if (style === "bunting") {
    graphics.lineStyle(2, 0x6b4c32, 1);
    graphics.lineBetween(bounds.minX + 4, bounds.minY + 8, bounds.maxX - 4, bounds.minY + 13);
    for (let index = 0; index < 5; index += 1) {
      graphics.fillStyle(index % 2 ? recipe.accent : 0xf4c65a, 1);
      const x = bounds.minX + 7 + index * ((bounds.width - 14) / 4);
      const lineY = bounds.minY + 8 + index * 1.25;
      graphics.fillTriangle(x - 5, lineY, x + 5, lineY, x, lineY + 14 + (index % 2) * 3);
      graphics.lineStyle(1, lighten(index % 2 ? recipe.accent : 0xf4c65a, 0.38), 0.85);
      graphics.lineBetween(x - 3, lineY + 2, x, lineY + 10);
    }
  } else if (style === "flower-vase") {
    graphics.fillStyle(0x477c86, 1);
    graphics.fillEllipse(bounds.centreX, bounds.centreY + 8, 15, 18);
    graphics.fillStyle(0x73a9b0, 0.9);
    graphics.fillEllipse(bounds.centreX - 2, bounds.centreY + 4, 5, 10);
    graphics.lineStyle(1.5, 0x4d8753, 1);
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2;
      graphics.lineBetween(bounds.centreX, bounds.centreY + 1, bounds.centreX + Math.cos(angle) * 9, bounds.centreY - 7 + Math.sin(angle) * 7);
      graphics.fillStyle(index % 2 ? 0xf4c65a : recipe.accent, 1);
      const flowerX = bounds.centreX + Math.cos(angle) * 9;
      const flowerY = bounds.centreY - 7 + Math.sin(angle) * 7;
      for (let petal = 0; petal < 4; petal += 1) {
        const petalAngle = (petal / 4) * Math.PI * 2;
        graphics.fillEllipse(flowerX + Math.cos(petalAngle) * 2.6, flowerY + Math.sin(petalAngle) * 2.6, 4.5, 3);
      }
      graphics.fillStyle(0x83512f, 1);
      graphics.fillCircle(flowerX, flowerY, 1.6);
    }
  } else if (style === "clock") {
    drawObjectShadow(graphics, bounds, true);
    graphics.fillStyle(0x8c633f, 1);
    graphics.fillCircle(bounds.centreX, bounds.centreY, Math.min(bounds.width, bounds.height) * 0.38);
    graphics.fillStyle(0xfff4d8, 1);
    graphics.fillCircle(bounds.centreX, bounds.centreY, Math.min(bounds.width, bounds.height) * 0.32);
    graphics.lineStyle(3, recipe.accent, 1);
    graphics.strokeCircle(bounds.centreX, bounds.centreY, Math.min(bounds.width, bounds.height) * 0.32);
    for (let marker = 0; marker < 12; marker += 1) {
      const radians = (marker / 12) * Math.PI * 2;
      graphics.fillStyle(0x5c4737, 1);
      graphics.fillCircle(bounds.centreX + Math.cos(radians) * 11, bounds.centreY + Math.sin(radians) * 11, marker % 3 === 0 ? 1.6 : 1);
    }
    graphics.lineBetween(bounds.centreX, bounds.centreY, bounds.centreX, bounds.centreY - 10);
    graphics.lineBetween(bounds.centreX, bounds.centreY, bounds.centreX + 8, bounds.centreY + 4);
  } else {
    drawObjectShadow(graphics, bounds);
    graphics.fillStyle(id.includes("noticeboard") ? 0x8b5b4c : recipe.accent, 1);
    graphics.fillRoundedRect(bounds.minX + 5, bounds.minY + 6, bounds.width - 10, bounds.height - 15, 5);
    if (id.includes("mural")) {
      const tileColours = [0xfff4d8, 0xf4c65a, 0x4d7390, 0xc8624c] as const;
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 5; column += 1) {
          const tileX = bounds.minX + 10 + column * ((bounds.width - 20) / 5);
          const tileY = bounds.minY + 10 + row * ((bounds.height - 22) / 3);
          graphics.fillStyle(tileColours[(row + column) % tileColours.length] as number, 0.95);
          graphics.fillTriangle(tileX, tileY, tileX + 7, tileY, tileX + (column % 2 ? 0 : 7), tileY + 7);
        }
      }
    } else {
      const paperColours = [0xfff4d8, 0xf4c65a, 0xc9e0dc, 0xf2cfca] as const;
      for (let index = 0; index < 5; index += 1) {
        const paperX = bounds.minX + 10 + (index % 3) * ((bounds.width - 22) / 3);
        const paperY = bounds.minY + 11 + Math.floor(index / 3) * 14;
        graphics.fillStyle(paperColours[index % paperColours.length] as number, 1);
        graphics.fillRoundedRect(paperX, paperY, 10 + (index % 2) * 3, 9, 1);
        graphics.fillStyle(0xc75b43, 1);
        graphics.fillCircle(paperX + 4, paperY + 2, 1.2);
      }
    }
    graphics.lineStyle(2.5, 0x5f452f, 0.88);
    graphics.strokeRoundedRect(bounds.minX + 5, bounds.minY + 6, bounds.width - 10, bounds.height - 15, 5);
  }
  if (style === "board") {
    drawMakerMark(graphics, bounds, recipe);
  }
}

/**
 * Draws a table: round, timber or folding top with its legs, edge trim and speckle, in the
 * placeable's motif.
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; its quality setting sets the speckle count.
 * @param id - The placeable's motif, matched by substring for the cues that tweak its branch.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawTableGraphic(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  id: string,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  const style = resolve_placeable_style("table", recipe);
  const round = style.support === "pedestal";
  const timber = id.includes("communal") || id.includes("trestle");
  const top = timber ? 0xa86f44 : id.includes("folding") ? 0xdde8e5 : recipe.accent;
  const edge = timber ? 0x6b462d : darken(recipe.accent, 0.48);
  drawObjectShadow(graphics, bounds, round);

  // Draw supports before the tabletop so each construction reads at a glance.
  if (round) {
    graphics.fillStyle(0x50625d, 1);
    graphics.fillEllipse(bounds.centreX + 2, bounds.centreY + 9, bounds.width * 0.32, bounds.height * 0.26);
    graphics.fillRect(bounds.centreX - 4, bounds.centreY - 1, 8, bounds.height * 0.38);
  } else if (style.support === "folding") {
    graphics.lineStyle(4, 0x71827e, 1);
    graphics.lineBetween(bounds.minX + 13, bounds.minY + 15, bounds.maxX - 14, bounds.maxY - 8);
    graphics.lineBetween(bounds.maxX - 13, bounds.minY + 15, bounds.minX + 14, bounds.maxY - 8);
    graphics.fillStyle(0x384a46, 1);
    graphics.fillCircle(bounds.minX + 14, bounds.maxY - 8, 3);
    graphics.fillCircle(bounds.maxX - 14, bounds.maxY - 8, 3);
  } else if (style.support === "trestle") {
    graphics.lineStyle(5, 0x6b462d, 1);
    graphics.lineBetween(bounds.minX + 13, bounds.minY + 17, bounds.minX + 24, bounds.maxY - 8);
    graphics.lineBetween(bounds.minX + 31, bounds.minY + 17, bounds.minX + 20, bounds.maxY - 8);
    graphics.lineBetween(bounds.maxX - 31, bounds.minY + 17, bounds.maxX - 20, bounds.maxY - 8);
    graphics.lineBetween(bounds.maxX - 13, bounds.minY + 17, bounds.maxX - 24, bounds.maxY - 8);
  } else {
    graphics.fillStyle(timber ? 0x6b462d : 0x5d6b67, 1);
    for (const legX of [bounds.minX + 13, bounds.maxX - 13]) {
      graphics.fillRoundedRect(legX - 4, bounds.centreY, 8, bounds.height * 0.38, 2);
    }
  }

  graphics.fillStyle(top, 1);
  if (style.top === "terrazzo") {
    graphics.fillEllipse(bounds.centreX, bounds.centreY - 3, bounds.width - 8, bounds.height - 12);
    graphics.lineStyle(4, 0x8d8274, 0.95);
    graphics.strokeEllipse(bounds.centreX, bounds.centreY - 3, bounds.width - 8, bounds.height - 12);
  } else if (style.top === "round") {
    graphics.fillCircle(bounds.centreX, bounds.centreY - 3, Math.min(bounds.width, bounds.height) * 0.39);
    graphics.lineStyle(4, edge, 1);
    graphics.strokeCircle(bounds.centreX, bounds.centreY - 3, Math.min(bounds.width, bounds.height) * 0.39);
    graphics.fillStyle(lighten(top, 0.3), 0.8);
    graphics.fillEllipse(bounds.centreX - 5, bounds.centreY - 9, bounds.width * 0.3, bounds.height * 0.12);
    graphics.fillStyle(0xd7d8cc, 1);
    graphics.fillCircle(bounds.centreX, bounds.centreY - 3, 3.5);
  } else if (style.top === "snack-ledge") {
    graphics.fillRoundedRect(bounds.minX + 3, bounds.centreY - 10, bounds.width - 6, 19, 4);
    graphics.fillStyle(lighten(top, 0.3), 0.8);
    graphics.fillRect(bounds.minX + 8, bounds.centreY - 7, bounds.width - 16, 4);
    graphics.lineStyle(4, edge, 1);
    graphics.lineBetween(bounds.minX + 4, bounds.centreY + 9, bounds.maxX - 4, bounds.centreY + 9);
    graphics.fillStyle(0xcdd9d6, 1);
    for (let hook = 0; hook < 3; hook += 1) {
      graphics.fillCircle(bounds.centreX - 12 + hook * 12, bounds.centreY + 14, 2.5);
    }
  } else {
    const inset = timber || id.includes("family") ? 4 : id.includes("accessible") ? 6 : 9;
    const radius = id.includes("folding") ? 2 : id.includes("compact") ? 5 : 7;
    graphics.fillRoundedRect(
      bounds.minX + inset,
      bounds.minY + 6,
      bounds.width - inset * 2,
      bounds.height - 18,
      radius,
    );
    graphics.lineStyle(4, edge, 0.95);
    graphics.strokeRoundedRect(
      bounds.minX + inset,
      bounds.minY + 6,
      bounds.width - inset * 2,
      bounds.height - 18,
      radius,
    );
    graphics.fillStyle(lighten(top, 0.28), 0.72);
    graphics.fillRoundedRect(
      bounds.minX + inset + 5,
      bounds.minY + 10,
      bounds.width - inset * 2 - 10,
      4,
      2,
    );
  }

  if (timber) {
    graphics.lineStyle(1.5, lighten(0x6b462d, 0.2), 0.72);
    const plankCount = id.includes("long") ? 5 : 3;
    for (let plank = 1; plank < plankCount; plank += 1) {
      const plankY = bounds.minY + 7 + (plank * (bounds.height - 20)) / plankCount;
      graphics.lineBetween(bounds.minX + 7, plankY, bounds.maxX - 7, plankY);
    }
    graphics.fillStyle(0xd9c28d, 1);
    graphics.fillRoundedRect(bounds.centreX - 8, bounds.centreY - 6, 16, 10, 3);
    graphics.fillStyle(0xb64035, 1);
    graphics.fillCircle(bounds.centreX - 3, bounds.centreY - 3, 2);
    graphics.fillStyle(0xd9a73c, 1);
    graphics.fillCircle(bounds.centreX + 3, bounds.centreY - 3, 2);
  }
  if (id.includes("terrazzo")) {
    const speckleColours = [0xf6cf68, 0xc8624c, 0x477c86, 0xfff4d8];
    const speckleCount = context.frame.qualityMode === "standard" ? 15 : 8;
    for (let index = 0; index < speckleCount; index += 1) {
      const angle = (index / speckleCount) * Math.PI * 2;
      const radius = index % 2 === 0 ? 0.27 : 0.15;
      graphics.fillStyle(speckleColours[index % speckleColours.length] as number, 0.95);
      graphics.fillCircle(
        bounds.centreX + Math.cos(angle) * bounds.width * radius,
        bounds.centreY - 3 + Math.sin(angle) * bounds.height * radius,
        index % 3 === 0 ? 2.5 : 1.7,
      );
    }
  }
  if (id.includes("accessible")) {
    graphics.fillStyle(0xe8f4ff, 0.94);
    graphics.fillRoundedRect(bounds.maxX - 32, bounds.minY + 11, 19, 16, 4);
    graphics.lineStyle(2.5, 0x356b82, 1);
    graphics.strokeCircle(bounds.maxX - 23, bounds.minY + 17, 4.5);
    graphics.lineBetween(bounds.maxX - 23, bounds.minY + 21, bounds.maxX - 17, bounds.minY + 27);
    graphics.lineStyle(3, 0x356b82, 0.8);
    graphics.lineBetween(bounds.maxX - 7, bounds.minY + 8, bounds.maxX - 7, bounds.maxY - 15);
  }
  if (id.includes("folding")) {
    graphics.fillStyle(0x72827e, 1);
    graphics.fillCircle(bounds.centreX, bounds.minY + 8, 3);
    graphics.lineStyle(1.5, 0x9cadab, 0.85);
    graphics.lineBetween(bounds.centreX, bounds.minY + 11, bounds.centreX, bounds.maxY - 14);
  }
  if (id.includes("compact")) {
    graphics.fillStyle(lighten(recipe.accent, 0.5), 1);
    for (const corner of [
      [bounds.minX + 14, bounds.minY + 11],
      [bounds.maxX - 14, bounds.minY + 11],
      [bounds.minX + 14, bounds.maxY - 17],
      [bounds.maxX - 14, bounds.maxY - 17],
    ] as const) {
      graphics.fillCircle(corner[0], corner[1], 2.4);
    }
  }
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws a light fitting with its pulsing glow, in the placeable's motif.
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; the live tick drives the glow pulse, which reduced
 *   motion holds steady.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent, seed and maker mark.
 */
export function drawLightingGraphic(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  const pulse = context.frame.isReducedMotion ? 0.16 : 0.12 + Math.sin(context.state.tick * 0.09 + recipe.seed) * 0.04;
  const glowRadius = Math.min(bounds.width, bounds.height) * 0.48;
  graphics.fillStyle(0xffd86b, pulse * 0.45);
  graphics.fillCircle(bounds.centreX, bounds.centreY + 3, glowRadius);
  graphics.fillStyle(0xffd86b, pulse);
  graphics.fillCircle(bounds.centreX, bounds.centreY + 2, glowRadius * 0.7);
  const style = resolve_placeable_style("lighting", recipe);
  if (style === "tube") {
    graphics.fillStyle(0x63716e, 1);
    graphics.fillRoundedRect(bounds.minX + 4, bounds.centreY - 8, bounds.width - 8, 16, 5);
    graphics.fillStyle(0xfff4c3, 1);
    graphics.fillRoundedRect(bounds.minX + 9, bounds.centreY - 4, bounds.width - 18, 8, 4);
    graphics.fillStyle(0x394b47, 1);
    graphics.fillRect(bounds.minX + 6, bounds.centreY - 4, 5, 8);
    graphics.fillRect(bounds.maxX - 11, bounds.centreY - 4, 5, 8);
  } else if (style === "pendant") {
    graphics.lineStyle(3, 0x294d42, 1);
    graphics.lineBetween(bounds.centreX, bounds.minY + 4, bounds.centreX, bounds.centreY - 9);
    graphics.fillStyle(darken(recipe.accent, 0.28), 1);
    graphics.fillTriangle(bounds.centreX - 13, bounds.centreY + 5, bounds.centreX + 13, bounds.centreY + 5, bounds.centreX, bounds.centreY - 12);
    graphics.fillStyle(0xffefb0, 1);
    graphics.fillEllipse(bounds.centreX, bounds.centreY + 5, 19, 7);
    graphics.fillCircle(bounds.centreX, bounds.centreY + 2, 4);
  } else if (style === "lantern-cluster") {
    for (let index = 0; index < 3; index += 1) {
      const lanternX = bounds.centreX - 13 + index * 13;
      const lanternY = bounds.centreY - 6 + Math.abs(index - 1) * 8;
      graphics.lineStyle(1.5, 0x6b4c32, 1);
      graphics.lineBetween(lanternX, bounds.minY + 2, lanternX, lanternY - 7);
      graphics.fillStyle(index === 1 ? recipe.accent : 0xffd86b, 1);
      graphics.fillEllipse(lanternX, lanternY, 13, 17);
      graphics.lineStyle(1, 0x8a5a35, 0.85);
      graphics.lineBetween(lanternX - 5, lanternY, lanternX + 5, lanternY);
      graphics.fillStyle(0xffefb0, 1);
      graphics.fillCircle(lanternX, lanternY, 2.5);
    }
  } else if (style === "path-light") {
    graphics.fillStyle(0x425550, 1);
    graphics.fillRoundedRect(bounds.centreX - 7, bounds.centreY - 12, 14, 26, 4);
    graphics.fillStyle(0xffefb0, 1);
    graphics.fillRoundedRect(bounds.centreX - 5, bounds.centreY - 9, 10, 9, 3);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillRect(bounds.centreX - 7, bounds.centreY + 6, 14, 5);
    graphics.fillStyle(0xffd86b, pulse * 1.4);
    graphics.fillTriangle(bounds.centreX - 4, bounds.centreY - 3, bounds.centreX + 4, bounds.centreY - 3, bounds.centreX + 20, bounds.centreY + 10);
  } else if (style === "skylight") {
    graphics.fillStyle(0xb9e2e8, 1);
    graphics.fillRoundedRect(bounds.minX + 6, bounds.minY + 6, bounds.width - 12, bounds.height - 12, 5);
    graphics.lineStyle(3, 0x557c80, 0.9);
    graphics.strokeRoundedRect(bounds.minX + 6, bounds.minY + 6, bounds.width - 12, bounds.height - 12, 5);
    graphics.lineBetween(bounds.centreX, bounds.minY + 7, bounds.centreX, bounds.maxY - 7);
    graphics.lineBetween(bounds.minX + 7, bounds.centreY, bounds.maxX - 7, bounds.centreY);
    graphics.lineStyle(2, 0xffffff, 0.9);
    graphics.lineBetween(bounds.minX + 10, bounds.minY + 10, bounds.centreX - 3, bounds.centreY - 3);
  } else if (style === "string") {
    graphics.lineStyle(2, 0x6b4c32, 1);
    graphics.lineBetween(bounds.minX + 4, bounds.centreY - 5, bounds.maxX - 4, bounds.centreY + 1);
    for (let index = 0; index < 5; index += 1) {
      const bulbX = bounds.minX + 8 + index * ((bounds.width - 16) / 4);
      const bulbY = bounds.centreY - 4 + index * 1.5 + (index % 2) * 4;
      graphics.lineStyle(1.5, 0x5e4b36, 1);
      graphics.lineBetween(bulbX, bulbY - 4, bulbX, bulbY);
      graphics.fillStyle(index % 2 === 0 ? 0xf4c65a : recipe.accent, 1);
      graphics.fillCircle(bulbX, bulbY + 2, 4);
      graphics.fillStyle(0xfff5ce, 1);
      graphics.fillCircle(bulbX - 1, bulbY + 1, 1.3);
    }
  } else if (style === "task-light") {
    graphics.fillStyle(0x3f514d, 1);
    graphics.fillRoundedRect(bounds.minX + 6, bounds.maxY - 11, 18, 7, 3);
    graphics.lineStyle(4, 0x556a65, 1);
    graphics.lineBetween(bounds.minX + 16, bounds.maxY - 11, bounds.centreX + 3, bounds.centreY - 8);
    graphics.lineBetween(bounds.centreX + 3, bounds.centreY - 8, bounds.maxX - 10, bounds.minY + 10);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillTriangle(bounds.maxX - 18, bounds.minY + 13, bounds.maxX - 3, bounds.minY + 4, bounds.maxX - 5, bounds.minY + 20);
    graphics.fillStyle(0xffefb0, 1);
    graphics.fillCircle(bounds.maxX - 8, bounds.minY + 12, 3);
  } else {
    graphics.fillStyle(0xffefb0, 1);
    graphics.fillCircle(bounds.centreX, bounds.centreY, 12);
    graphics.fillStyle(recipe.accent, 1);
    graphics.fillRect(bounds.centreX - 10, bounds.centreY + 8, 20, 5);
  }
}

/**
 * Draws a fan: a column, an exhaust or a bladed wall, ceiling or floor fan, whose blades turn
 * with the tick.
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; the live tick turns the blades (reduced motion stops
 *   them) and the quality setting sets the spoke count.
 * @param id - The placeable's motif, matched by substring for the cues that tweak its branch.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe, which supplies the accent and maker mark.
 */
export function drawFanGraphic(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  id: string,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) {
  drawObjectShadow(graphics, bounds, true);
  const style = resolve_placeable_style("fan", recipe);
  const radius = Math.min(bounds.width, bounds.height) * (id.includes("high-volume") ? 0.42 : 0.35);
  if (style === "column") {
    graphics.fillStyle(0xc9d9d5, 1);
    graphics.fillRoundedRect(bounds.centreX - 8, bounds.minY + 7, 16, bounds.height - 18, 8);
    graphics.fillStyle(recipe.accent, 1);
    for (let row = 0; row < 4; row += 1) graphics.fillRect(bounds.centreX - 5, bounds.minY + 13 + row * 7, 10, 3);
  } else if (style === "exhaust") {
    graphics.fillStyle(0x57776e, 1);
    graphics.fillRoundedRect(bounds.minX + 6, bounds.minY + 6, bounds.width - 12, bounds.height - 12, 4);
    graphics.fillStyle(0x263d38, 1);
    for (let row = 0; row < 4; row += 1) graphics.fillRect(bounds.minX + 12, bounds.minY + 12 + row * 7, bounds.width - 24, 3);
  } else {
    if (style === "wall-rotor") {
      graphics.fillStyle(0x52645f, 1);
      graphics.fillRoundedRect(bounds.centreX - 16, bounds.maxY - 11, 32, 7, 3);
      graphics.fillRect(bounds.centreX - 4, bounds.centreY + radius * 0.6, 8, bounds.maxY - bounds.centreY - radius * 0.6 - 7);
    } else if (style === "ceiling-rotor") {
      graphics.lineStyle(4, 0x52645f, 1);
      graphics.lineBetween(bounds.centreX, bounds.minY + 2, bounds.centreX, bounds.centreY - radius * 0.6);
    }
    graphics.fillStyle(id.includes("quiet") ? 0xe4ece8 : 0xc9d9d5, 1);
    graphics.fillCircle(bounds.centreX, bounds.centreY - 2, radius + 5);
    graphics.lineStyle(id.includes("high-volume") ? 4 : 2, 0x476f68, 0.86);
    graphics.strokeCircle(bounds.centreX, bounds.centreY - 2, radius + 5);
    const bladeCount = id.includes("high-volume") ? 5 : id.includes("ceiling") ? 4 : 3;
    for (let blade = 0; blade < bladeCount; blade += 1) {
      const radians = (
        (blade * 360) / bladeCount + context.state.tick * (context.frame.isReducedMotion ? 0 : id.includes("quiet") ? 1.4 : 3.2)
      ) * DEG_TO_RAD;
      const bladeX = bounds.centreX + Math.cos(radians) * radius * 0.54;
      const bladeY = bounds.centreY - 2 + Math.sin(radians) * radius * 0.54;
      graphics.fillStyle(recipe.accent, 0.95);
      graphics.fillEllipse(
        bladeX,
        bladeY,
        radius * (id.includes("ceiling") ? 1.25 : 0.9),
        radius * (id.includes("quiet") ? 0.26 : 0.34),
      );
    }
    graphics.fillStyle(0x294d42, 1);
    graphics.fillCircle(bounds.centreX, bounds.centreY - 2, 5);
    if (!id.includes("ceiling")) {
      graphics.lineStyle(1.2, 0x6f817c, 0.6);
      graphics.strokeCircle(bounds.centreX, bounds.centreY - 2, radius * 0.68);
      const spokeCount = context.frame.qualityMode === "standard" ? 8 : 4;
      for (let spoke = 0; spoke < spokeCount; spoke += 1) {
        const radians = (spoke / spokeCount) * Math.PI * 2;
        graphics.lineBetween(
          bounds.centreX + Math.cos(radians) * 6,
          bounds.centreY - 2 + Math.sin(radians) * 6,
          bounds.centreX + Math.cos(radians) * (radius + 3),
          bounds.centreY - 2 + Math.sin(radians) * (radius + 3),
        );
      }
    }
  }
  drawMakerMark(graphics, bounds, recipe);
}

/**
 * Draws one non-stall placed object from its visual recipe.
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context.
 * @param bounds - The object's world-space footprint bounds.
 * @param recipe - The placeable's visual recipe; its ID picks the renderer's art style from
 *   `PLACEABLE_STYLE_BY_ID` (`art.ts`), and its motif carries the substring detail cues.
 */
type ObjectRenderer = (
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  bounds: ObjectVisualBounds,
  recipe: PlaceableVisualRecipe,
) => void;

/** The renderer for each non-stall placeable category, in the order the categories were tested. */
const OBJECT_RENDERERS: Readonly<Record<PlaceableCategory, ObjectRenderer>> = {
  table: (graphics, context, bounds, recipe) =>
    drawTableGraphic(graphics, context, recipe.motif, bounds, recipe),
  seat: (graphics, _context, bounds, recipe) =>
    drawSeatGraphic(graphics, recipe.motif, bounds, recipe),
  "stall-fixture": (graphics, _context, bounds, recipe) =>
    drawFixtureGraphic(graphics, recipe.motif, bounds, recipe),
  "tray-waste": (graphics, context, bounds, recipe) =>
    drawTrayWasteGraphic(context.addLabel, graphics, recipe.motif, bounds, recipe),
  lighting: (graphics, context, bounds, recipe) =>
    drawLightingGraphic(graphics, context, bounds, recipe),
  fan: (graphics, context, bounds, recipe) =>
    drawFanGraphic(graphics, context, recipe.motif, bounds, recipe),
  plant: (graphics, _context, bounds, recipe) =>
    drawPlantGraphic(graphics, recipe.motif, bounds, recipe),
  signage: (graphics, context, bounds, recipe) =>
    drawSignageGraphic(context.addLabel, graphics, bounds, recipe),
  divider: (graphics, _context, bounds, recipe) =>
    drawDividerGraphic(graphics, recipe.motif, bounds, recipe),
  facility: (graphics, _context, bounds, recipe) =>
    drawFacilityGraphic(graphics, bounds, recipe),
  decor: (graphics, _context, bounds, recipe) =>
    drawDecorGraphic(graphics, recipe.motif, bounds, recipe),
};

/**
 * Draws every placed object in back-to-front order (by origin row, then column), then the
 * selection outline on the selected object.
 *
 * Stalls go to the stall renderer; every other object goes to its category's renderer.
 *
 * @param graphics - The world graphics object to draw into.
 * @param context - The render context; the snapshot supplies the objects, the catalog and
 *   visuals describe them, and the selected object ID marks the outlined one.
 */
export function drawObjects(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
) {
  const { snapshot, catalog, visuals, selectedObjectId } = context;
  const ordered = [...snapshot.objects].sort(
    (a, b) => a.origin.y - b.origin.y || a.origin.x - b.origin.x,
  );
  for (const object of ordered) {
    const definition = catalog.placeables[object.definitionId];
    const visual = visuals[object.definitionId] ?? {
      category: "facility" as const,
      name: object.definitionId,
      palette: ["#7f958c"],
    };
    const bounds = boundsForObject(object, catalog);
    if (!definition || !bounds) continue;

    if (visual.category === "stall") {
      drawStallGraphic(graphics, context, object, bounds, visual);
    } else {
      const recipe = visualRecipeForPlaceable(
        object.definitionId,
        visual.category,
        PLACEABLE_BY_ID.get(object.definitionId)?.tags,
      );
      OBJECT_RENDERERS[visual.category](graphics, context, bounds, recipe);
    }

    if (selectedObjectId === object.id) {
      graphics.lineStyle(4, 0x287ec0, 1);
      graphics.strokeRoundedRect(bounds.minX + 1, bounds.minY + 1, bounds.width - 2, bounds.height - 2, 6);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(bounds.maxX - 4, bounds.minY + 4, 7);
      graphics.lineStyle(2, 0x287ec0, 1);
      graphics.strokeCircle(bounds.maxX - 4, bounds.minY + 4, 7);
    }
  }
}
