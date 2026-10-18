/**
 * Renderers and helpers for stalls: the stall graphic itself, the dishes shown as counter props,
 * the vendor's service activity and the stall emblem badge.
 *
 * Each function works only from its arguments, drawing into the Phaser graphics it is given,
 * so it can live outside the scene. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import { STALL_BY_ID, STALLS, type StallDefinition } from "@/src/content";
import type { GameSnapshot, PlacedObject } from "@/src/game/core";
import type { VisualDefinition } from "../catalog";
import { nutritionVisualKeyForVariant } from "../nutrition";
import { colour, darken, lighten } from "../visuals/palette";
import {
  vendorAnimationPoseForStall,
  visualRecipeForStallVendor,
  type StallVendorActivity,
  type StallVendorEmblem,
} from "../visuals/vendor";
import { TILE_SIZE } from "../world";
import { resolve_stall_art } from "./art";
import type { ObjectVisualBounds, RenderContext } from "./context";
import { drawDishServing } from "./dishes";
import { drawObjectShadow } from "./objects";
import { drawStallVendor } from "./vendor";

const DEFAULT_DISPLAY_DISH_LIMIT = 4;

const STALL_VENDOR_VISUAL_BY_ID = new Map(
  STALLS.map((stall) => [stall.id, visualRecipeForStallVendor(stall)]),
);

/**
 * Selects the active dishes that may be represented as props on a stall.
 * The catalogue order is used only as a safe fallback when no active ID is valid.
 *
 * @param stall - The stall content definition, whose dish IDs are the permitted props.
 * @param activeIds - Dish IDs in display priority order; IDs the stall does not sell and
 *   repeats are skipped.
 * @param limit - The most props to return.
 * @returns Up to `limit` permitted dish IDs, or the stall's first dish when none is active.
 * @throws RangeError When `limit` is not a positive safe integer.
 */
export function displayDishIdsForStall(
  stall: StallDefinition,
  activeIds: readonly string[],
  limit = DEFAULT_DISPLAY_DISH_LIMIT,
): readonly string[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("Stall display dish limit must be a positive integer.");
  }

  const permittedIds = new Set(stall.dishIds);
  const selectedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const dishId of activeIds) {
    if (!permittedIds.has(dishId) || seenIds.has(dishId)) continue;
    selectedIds.push(dishId);
    seenIds.add(dishId);
    if (selectedIds.length === limit) return selectedIds;
  }

  if (selectedIds.length > 0) return selectedIds;
  const fallbackId = stall.dishIds[0];
  return fallbackId ? [fallbackId] : [];
}

/**
 * Works out what a stall's vendor is doing from the customers it is serving.
 *
 * A customer waiting for food at the stall means the vendor is preparing that order; otherwise
 * a customer ordering means the vendor is taking an order, and the vendor idles when neither
 * applies.
 *
 * @param snapshot - The game snapshot being rendered.
 * @param objectId - The placed stall's object ID.
 * @returns The vendor activity, plus the dish and variant being prepared when there is one.
 */
export function stallServiceVisualState(
  snapshot: GameSnapshot,
  objectId: string,
): {
  readonly activity: StallVendorActivity;
  readonly preparingDishId?: string;
  readonly preparingVariantId?: string;
} {
  const preparing = snapshot.customers.find(
    (customer) =>
      customer.targetStallId === objectId &&
      customer.status === "waiting-for-food" &&
      customer.orderedDishId,
  );
  if (preparing) {
    return {
      activity: "prepare",
      preparingDishId: preparing.orderedDishId,
      preparingVariantId: preparing.orderedNutritionVariantId,
    };
  }
  const ordering = snapshot.customers.some(
    (customer) => customer.targetStallId === objectId && customer.status === "ordering",
  );
  return { activity: ordering ? "order" : "idle" };
}

/**
 * Draws a stall's round emblem badge.
 *
 * @param graphics - The graphics object to draw into.
 * @param emblem - The emblem motif to draw inside the badge.
 * @param x - World x of the badge's centre.
 * @param y - World y of the badge's centre.
 * @param scale - The badge's draw scale.
 * @param primary - The stall's primary colour, darkened for the badge rim.
 * @param accent - The colour of the emblem motif.
 */
export function drawStallEmblem(
  graphics: Phaser.GameObjects.Graphics,
  emblem: StallVendorEmblem,
  x: number,
  y: number,
  scale: number,
  primary: number,
  accent: number,
) {
  graphics.fillStyle(0xfff5dc, 0.94);
  graphics.fillCircle(x, y, 11 * scale);
  graphics.lineStyle(Math.max(1, 1.8 * scale), darken(primary, 0.3), 0.9);
  graphics.strokeCircle(x, y, 11 * scale);
  graphics.fillStyle(accent, 1);
  graphics.lineStyle(Math.max(1, 1.8 * scale), accent, 1);

  if (emblem === "sunburst") {
    graphics.fillCircle(x, y, 4 * scale);
    for (let ray = 0; ray < 8; ray += 1) {
      const angle = (ray / 8) * Math.PI * 2;
      graphics.lineBetween(
        x + Math.cos(angle) * 5 * scale,
        y + Math.sin(angle) * 5 * scale,
        x + Math.cos(angle) * 8 * scale,
        y + Math.sin(angle) * 8 * scale,
      );
    }
  } else if (emblem === "lime-leaf" || emblem === "tamarind-leaf") {
    const leafCount = emblem === "tamarind-leaf" ? 3 : 2;
    for (let leaf = 0; leaf < leafCount; leaf += 1) {
      graphics.fillEllipse(
        x + (leaf - (leafCount - 1) / 2) * 4 * scale,
        y + (leaf % 2 === 0 ? -1 : 2) * scale,
        7 * scale,
        11 * scale,
      );
    }
    graphics.lineStyle(Math.max(1, scale), darken(accent, 0.3), 0.9);
    graphics.lineBetween(x - 5 * scale, y + 6 * scale, x + 6 * scale, y - 6 * scale);
  } else if (emblem === "coffee-cup") {
    graphics.fillRoundedRect(x - 6 * scale, y - 2 * scale, 10 * scale, 7 * scale, 2 * scale);
    graphics.strokeCircle(x + 5 * scale, y + scale, 3 * scale);
    graphics.lineBetween(x - 3 * scale, y - 4 * scale, x - 2 * scale, y - 8 * scale);
    graphics.lineBetween(x + scale, y - 4 * scale, x + 2 * scale, y - 8 * scale);
  } else if (emblem === "flame") {
    graphics.fillTriangle(x - 6 * scale, y + 7 * scale, x + 6 * scale, y + 7 * scale, x + 2 * scale, y - 8 * scale);
    graphics.fillStyle(lighten(accent, 0.45), 1);
    graphics.fillTriangle(x - 2 * scale, y + 5 * scale, x + 3 * scale, y + 5 * scale, x, y - 3 * scale);
  } else if (emblem === "noodle-ribbon") {
    for (let ribbon = -1; ribbon <= 1; ribbon += 1) {
      graphics.lineBetween(x - 7 * scale, y + ribbon * 4 * scale, x - scale, y - ribbon * 2 * scale);
      graphics.lineBetween(x - scale, y - ribbon * 2 * scale, x + 7 * scale, y + ribbon * 3 * scale);
    }
  } else if (emblem === "lantern") {
    graphics.fillRoundedRect(x - 5 * scale, y - 6 * scale, 10 * scale, 13 * scale, 4 * scale);
    graphics.lineBetween(x - 3 * scale, y - 8 * scale, x + 3 * scale, y - 8 * scale);
    graphics.lineBetween(x, y + 7 * scale, x, y + 9 * scale);
  } else if (emblem === "raindrop") {
    graphics.fillCircle(x, y + 3 * scale, 5 * scale);
    graphics.fillTriangle(x - 5 * scale, y + scale, x + 5 * scale, y + scale, x, y - 8 * scale);
  } else if (emblem === "compass") {
    graphics.strokeCircle(x, y, 7 * scale);
    graphics.fillTriangle(x, y - 8 * scale, x - 3 * scale, y + 2 * scale, x + 2 * scale, y);
    graphics.fillTriangle(x, y + 8 * scale, x + 3 * scale, y - 2 * scale, x - 2 * scale, y);
  } else if (emblem === "bamboo-knot") {
    graphics.lineStyle(Math.max(2, 3 * scale), accent, 1);
    graphics.lineBetween(x - 6 * scale, y + 7 * scale, x + 5 * scale, y - 7 * scale);
    graphics.lineBetween(x - 7 * scale, y - 3 * scale, x + 6 * scale, y + 5 * scale);
    graphics.fillCircle(x, y, 2.5 * scale);
  } else if (emblem === "hearth-tile") {
    graphics.fillTriangle(x, y - 8 * scale, x + 8 * scale, y, x, y + 8 * scale);
    graphics.fillTriangle(x, y - 8 * scale, x - 8 * scale, y, x, y + 8 * scale);
    graphics.fillStyle(0xfff5dc, 0.92);
    graphics.fillCircle(x, y, 3 * scale);
  } else if (emblem === "ingredient-grid") {
    for (let cell = 0; cell < 4; cell += 1) {
      graphics.fillRoundedRect(
        x - 7 * scale + (cell % 2) * 8 * scale,
        y - 7 * scale + Math.floor(cell / 2) * 8 * scale,
        6 * scale,
        6 * scale,
        scale,
      );
    }
  } else if (emblem === "claypot-steam") {
    graphics.fillRoundedRect(x - 7 * scale, y - scale, 14 * scale, 8 * scale, 3 * scale);
    graphics.lineStyle(Math.max(1, scale), accent, 1);
    graphics.lineBetween(x - 8 * scale, y + scale, x - 11 * scale, y - scale);
    graphics.lineBetween(x + 8 * scale, y + scale, x + 11 * scale, y - scale);
    for (let plume = -1; plume <= 1; plume += 1) {
      graphics.beginPath();
      graphics.arc(x + plume * 4 * scale, y - 4 * scale, 2.4 * scale, 0.3, Math.PI * 1.6);
      graphics.strokePath();
    }
  } else {
    for (let wave = -1; wave <= 1; wave += 1) {
      const waveY = y + wave * 4 * scale;
      graphics.lineBetween(x - 7 * scale, waveY, x - 2 * scale, waveY - 2 * scale);
      graphics.lineBetween(x - 2 * scale, waveY - 2 * scale, x + 3 * scale, waveY + 2 * scale);
      graphics.lineBetween(x + 3 * scale, waveY + 2 * scale, x + 7 * scale, waveY);
    }
  }
}

/**
 * Draws a stall: its body, cuisine-specific roofline and sign, service window and counter,
 * cooking props, the vendor and emblem, the dishes displayed on the counter, the name label and
 * the closed shutter.
 *
 * The roofline and the cooking props come from the stall's `STALL_ART_BY_ID` entry
 * (`art.ts`), with the substring fallback for unlisted stall IDs.
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; the snapshot gives the tick and service state, the frame
 *   gives reduced motion and quality, and the menus and variants pick the displayed dishes.
 * @param object - The placed stall.
 * @param bounds - The stall's world-space footprint bounds.
 * @param visual - The stall's visual definition (name, palette and sign shape).
 */
export function drawStallGraphic(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  object: PlacedObject,
  bounds: ObjectVisualBounds,
  visual: VisualDefinition,
) {
  const { snapshot, stallMenus, activeDishVariants } = context;
  const primary = colour(visual.palette[0] ?? "#6b877c", 0x6b877c);
  const secondary = colour(visual.palette[1] ?? "#f3e0b4", 0xf3e0b4);
  const accent = colour(visual.palette[2] ?? "#d56d50", 0xd56d50);
  const id = object.definitionId;
  const art = resolve_stall_art(id);
  const stallVariant = Math.max(0, STALLS.findIndex((stall) => stall.id === id));
  const serviceVisual = stallServiceVisualState(snapshot, object.id);
  const frame = darken(primary, 0.52);
  const metal = 0x7b8f8a;
  const windowX = bounds.minX + 13;
  const windowY = bounds.minY + 28;
  const windowWidth = bounds.width - 26;
  const windowHeight = Math.max(28, bounds.height - 47);

  drawObjectShadow(graphics, bounds);
  graphics.fillStyle(frame, 1);
  graphics.fillRoundedRect(bounds.minX + 3, bounds.minY + 7, bounds.width - 6, bounds.height - 10, 8);
  graphics.fillStyle(primary, 1);
  graphics.fillRoundedRect(bounds.minX + 7, bounds.minY + 10, bounds.width - 14, bounds.height - 15, 6);
  graphics.fillStyle(lighten(primary, 0.26), 0.72);
  graphics.fillRoundedRect(bounds.minX + 10, bounds.minY + 12, bounds.width - 20, 5, 3);
  graphics.fillStyle(darken(primary, 0.34), 1);
  graphics.fillRect(bounds.minX + 8, bounds.maxY - 14, bounds.width - 16, 7);
  graphics.fillStyle(0x263b37, 0.42);
  graphics.fillRoundedRect(bounds.minX + 13, bounds.maxY - 9, bounds.width - 26, 4, 2);

  // Each cuisine gets a different roofline before colour is considered.
  if (art.roof === "coconut" || art.roof === "tamarind") {
    graphics.fillStyle(art.roof === "coconut" ? 0xb9864c : 0x4f7650, 1);
    graphics.fillTriangle(
      bounds.minX + 2,
      bounds.minY + 25,
      bounds.centreX,
      bounds.minY - 2,
      bounds.maxX - 2,
      bounds.minY + 25,
    );
    graphics.lineStyle(2, lighten(primary, 0.38), 0.78);
    for (let rib = -2; rib <= 2; rib += 1) {
      graphics.lineBetween(
        bounds.centreX,
        bounds.minY + 1,
        bounds.centreX + rib * (bounds.width * 0.19),
        bounds.minY + 23,
      );
    }
  } else if (art.roof === "kopi") {
    graphics.fillStyle(secondary, 1);
    graphics.fillRect(bounds.minX + 2, bounds.minY + 3, bounds.width - 4, 18);
    const scallopWidth = Math.max(12, (bounds.width - 8) / 7);
    for (let index = 0; index < 7; index += 1) {
      graphics.fillStyle(index % 2 === 0 ? accent : primary, 1);
      graphics.fillCircle(
        bounds.minX + 4 + scallopWidth * (index + 0.5),
        bounds.minY + 20,
        scallopWidth * 0.52,
      );
      graphics.fillRect(
        bounds.minX + 4 + scallopWidth * index,
        bounds.minY + 3,
        scallopWidth,
        17,
      );
    }
  } else if (art.roof === "mee-pok") {
    graphics.fillStyle(0xe8dfca, 1);
    graphics.fillRoundedRect(bounds.minX + 2, bounds.minY + 2, bounds.width - 4, 23, 4);
    graphics.fillStyle(accent, 1);
    graphics.fillRect(bounds.minX + 7, bounds.minY + 6, bounds.width - 14, 7);
    graphics.fillStyle(frame, 1);
    for (const basketX of [bounds.centreX - 22, bounds.centreX, bounds.centreX + 22]) {
      graphics.lineStyle(1.5, frame, 1);
      graphics.lineBetween(basketX, bounds.minY + 13, basketX, bounds.minY + 21);
      graphics.strokeCircle(basketX, bounds.minY + 23, 5);
    }
  } else if (art.roof === "sweet-monsoon") {
    graphics.fillStyle(lighten(primary, 0.24), 1);
    graphics.fillRoundedRect(bounds.minX + 2, bounds.minY + 2, bounds.width - 4, 20, 9);
    const scallopWidth = (bounds.width - 8) / 6;
    for (let scallop = 0; scallop < 6; scallop += 1) {
      graphics.fillStyle(scallop % 2 === 0 ? accent : secondary, 1);
      graphics.fillCircle(bounds.minX + 4 + scallopWidth * (scallop + 0.5), bounds.minY + 21, scallopWidth * 0.55);
    }
    graphics.fillStyle(0xeef1e8, 1);
    graphics.fillTriangle(bounds.centreX - 9, bounds.minY + 14, bounds.centreX + 9, bounds.minY + 14, bounds.centreX, bounds.minY - 2);
    graphics.lineStyle(2, accent, 1);
    graphics.lineBetween(bounds.centreX - 6, bounds.minY + 10, bounds.centreX + 5, bounds.minY + 3);
  } else if (art.roof === "satay") {
    graphics.fillStyle(0x363c39, 1);
    graphics.fillTriangle(bounds.minX + 5, bounds.minY + 25, bounds.maxX - 5, bounds.minY + 25, bounds.maxX - 20, bounds.minY + 5);
    graphics.fillTriangle(bounds.minX + 5, bounds.minY + 25, bounds.minX + 20, bounds.minY + 5, bounds.maxX - 20, bounds.minY + 5);
    graphics.fillStyle(0x606d68, 1);
    graphics.fillRect(bounds.centreX - 8, bounds.minY - 3, 16, 10);
    graphics.fillStyle(accent, 1);
    graphics.fillRect(bounds.minX + 9, bounds.minY + 21, bounds.width - 18, 5);
  } else if (art.roof === "bamboo-basket") {
    graphics.fillStyle(0xb98d55, 1);
    graphics.fillRect(bounds.minX + 3, bounds.minY + 4, bounds.width - 6, 18);
    graphics.fillStyle(0x8a643b, 1);
    for (let slat = 0; slat < 9; slat += 1) {
      graphics.fillRect(bounds.minX + 5 + slat * ((bounds.width - 10) / 9), bounds.minY + 4, 3, 19);
    }
    graphics.fillStyle(0xd4ad6f, 1);
    graphics.fillTriangle(bounds.minX, bounds.minY + 5, bounds.centreX, bounds.minY - 4, bounds.maxX, bounds.minY + 5);
    graphics.fillTriangle(bounds.minX + 6, bounds.minY + 19, bounds.centreX, bounds.minY + 10, bounds.maxX - 6, bounds.minY + 19);
  } else if (art.roof === "cinder" || art.roof === "harbour") {
    graphics.fillStyle(art.roof === "cinder" ? 0x303c3b : 0x284f62, 1);
    graphics.fillRoundedRect(bounds.minX + 1, bounds.minY + 1, bounds.width - 2, 24, 3);
    graphics.fillStyle(metal, 1);
    for (let slot = 0; slot < 5; slot += 1) {
      graphics.fillRect(bounds.centreX - 32 + slot * 16, bounds.minY + 7, 9, 3);
    }
    graphics.fillStyle(accent, 1);
    graphics.fillRect(bounds.minX + 8, bounds.minY + 20, bounds.width - 16, 5);
  } else if (art.roof === "tiffin") {
    graphics.fillStyle(0x7f3028, 1);
    graphics.fillRoundedRect(bounds.minX + 3, bounds.minY + 2, bounds.width - 6, 22, 11);
    graphics.fillStyle(0xe0a348, 1);
    graphics.fillRect(bounds.minX + 12, bounds.minY + 7, bounds.width - 24, 4);
    for (const lanternX of [bounds.minX + 14, bounds.maxX - 14]) {
      graphics.lineStyle(2, 0x5f3a26, 1);
      graphics.lineBetween(lanternX, bounds.minY + 8, lanternX, bounds.minY + 19);
      graphics.fillStyle(0xf0a33a, 1);
      graphics.fillEllipse(lanternX, bounds.minY + 21, 10, 13);
    }
  } else if (art.roof === "straits") {
    graphics.fillStyle(0xe9d7b5, 1);
    graphics.fillRect(bounds.minX + 3, bounds.minY + 2, bounds.width - 6, 24);
    const tileSize = 12;
    for (let tileX = bounds.minX + 6, index = 0; tileX < bounds.maxX - 8; tileX += tileSize, index += 1) {
      graphics.fillStyle(index % 2 === 0 ? primary : accent, 1);
      graphics.fillRect(tileX, bounds.minY + 5, 8, 8);
      graphics.fillStyle(index % 2 === 0 ? accent : primary, 1);
      graphics.fillCircle(tileX + 4, bounds.minY + 9, 2);
    }
    graphics.fillStyle(darken(primary, 0.3), 1);
    graphics.fillRect(bounds.minX + 8, bounds.minY + 17, bounds.width - 16, 7);
  } else {
    const awningCount = 6 + (stallVariant % 3);
    const panelWidth = (bounds.width - 8) / awningCount;
    for (let index = 0; index < awningCount; index += 1) {
      graphics.fillStyle(index % 2 === 0 ? accent : secondary, 1);
      graphics.fillRect(bounds.minX + 4 + index * panelWidth, bounds.minY + 2, panelWidth + 1, 20);
      graphics.fillTriangle(
        bounds.minX + 4 + index * panelWidth,
        bounds.minY + 20,
        bounds.minX + 4 + (index + 1) * panelWidth,
        bounds.minY + 20,
        bounds.minX + 4 + (index + 0.5) * panelWidth,
        bounds.minY + 26,
      );
    }
  }

  const signWidth = Math.min(bounds.width - 34, Math.max(74, visual.name.length * 6.2));
  const signX = bounds.centreX - signWidth / 2;
  const signY = bounds.minY + 6;
  if (visual.signShape === "lightbox") {
    graphics.fillStyle(0xfff2c7, 0.24);
    graphics.fillRoundedRect(signX - 4, signY - 4, signWidth + 8, 25, 7);
    graphics.fillStyle(0xfff7dc, 0.98);
    graphics.fillRoundedRect(signX, signY, signWidth, 17, 4);
    graphics.lineStyle(2.5, accent, 0.94);
    graphics.strokeRoundedRect(signX, signY, signWidth, 17, 4);
  } else if (visual.signShape === "painted-board") {
    graphics.fillStyle(0x6f4a2e, 1);
    graphics.fillRoundedRect(signX, signY - 1, signWidth, 19, 2);
    graphics.fillStyle(lighten(primary, 0.18), 1);
    graphics.fillRoundedRect(signX + 3, signY + 2, signWidth - 6, 13, 1);
    graphics.lineStyle(1.5, 0xe7c66d, 0.82);
    graphics.strokeRoundedRect(signX + 3, signY + 2, signWidth - 6, 13, 1);
  } else if (visual.signShape === "tile-panel") {
    graphics.fillStyle(0xf2e6ce, 1);
    graphics.fillRoundedRect(signX, signY - 1, signWidth, 19, 3);
    const signTiles = Math.max(4, Math.floor(signWidth / 18));
    for (let tile = 0; tile < signTiles; tile += 1) {
      graphics.fillStyle(tile % 2 === 0 ? primary : accent, 0.92);
      graphics.fillRect(signX + 3 + (tile * (signWidth - 6)) / signTiles, signY + 2, (signWidth - 7) / signTiles, 13);
    }
  } else {
    graphics.fillStyle(darken(primary, 0.22), 0.94);
    graphics.fillRoundedRect(signX, signY, signWidth, 17, 8);
    graphics.lineStyle(2, lighten(accent, 0.24), 0.9);
    graphics.strokeRoundedRect(signX, signY, signWidth, 17, 8);
  }

  graphics.fillStyle(0x203832, 0.94);
  graphics.fillRoundedRect(windowX, windowY, windowWidth, windowHeight, 4);
  graphics.fillStyle(lighten(secondary, 0.18), 0.92);
  graphics.fillRect(windowX + 4, windowY + 4, windowWidth - 8, Math.max(12, windowHeight - 16));
  const interiorTop = windowY + 7;
  const interiorBottom = windowY + Math.max(16, windowHeight - 14);
  const tileRows = bounds.height >= TILE_SIZE * 3 ? 3 : 2;
  const tileColumns = Math.max(4, Math.floor(windowWidth / 25));
  graphics.lineStyle(1, darken(secondary, 0.08), 0.24);
  for (let column = 1; column < tileColumns; column += 1) {
    const tileX = windowX + 4 + (column * (windowWidth - 8)) / tileColumns;
    graphics.lineBetween(tileX, interiorTop, tileX, interiorBottom);
  }
  for (let row = 1; row < tileRows; row += 1) {
    const tileY = interiorTop + (row * (interiorBottom - interiorTop)) / tileRows;
    graphics.lineBetween(windowX + 4, tileY, windowX + windowWidth - 4, tileY);
  }
  graphics.fillStyle(0x2a403b, 0.86);
  graphics.fillRoundedRect(windowX + 7, windowY + 11, Math.min(38, windowWidth * 0.24), 15, 3);
  graphics.fillStyle(lighten(accent, 0.26), 0.96);
  for (let menuLine = 0; menuLine < 3; menuLine += 1) {
    graphics.fillRoundedRect(windowX + 12, windowY + 15 + menuLine * 4, Math.min(27, windowWidth * 0.17) - menuLine * 2, 1.5, 1);
  }
  const shelfY = windowY + Math.max(27, windowHeight * 0.42);
  graphics.fillStyle(frame, 0.92);
  graphics.fillRoundedRect(windowX + 7, shelfY, windowWidth - 14, 4, 2);
  graphics.fillStyle(lighten(metal, 0.18), 0.74);
  graphics.fillRect(windowX + 11, shelfY - 2, windowWidth - 22, 2);
  for (const lampX of [windowX + windowWidth * 0.38, windowX + windowWidth * 0.7]) {
    graphics.fillStyle(0xffe0a1, 0.12);
    graphics.fillTriangle(lampX - 12, windowY + 8, lampX + 12, windowY + 8, lampX, shelfY + 20);
    graphics.fillStyle(0xf8d487, 0.96);
    graphics.fillRoundedRect(lampX - 5, windowY + 6, 10, 4, 2);
  }
  graphics.lineStyle(3, frame, 1);
  graphics.lineBetween(bounds.minX + 10, bounds.minY + 24, bounds.minX + 10, bounds.maxY - 8);
  graphics.lineBetween(bounds.maxX - 10, bounds.minY + 24, bounds.maxX - 10, bounds.maxY - 8);

  const counterY = bounds.maxY - 21;
  graphics.fillStyle(0xa76d3c, 1);
  graphics.fillRoundedRect(bounds.minX + 8, counterY - 3, bounds.width - 16, 10, 3);
  graphics.fillStyle(lighten(0xa76d3c, 0.28), 1);
  graphics.fillRect(bounds.minX + 12, counterY - 2, bounds.width - 24, 3);
  graphics.fillStyle(frame, 1);
  graphics.fillRect(bounds.minX + 10, counterY + 7, bounds.width - 20, 11);
  graphics.fillStyle(lighten(frame, 0.16), 1);
  const cabinetWidth = (bounds.width - 28) / 3;
  for (let cabinet = 0; cabinet < 3; cabinet += 1) {
    const cabinetX = bounds.minX + 14 + cabinet * cabinetWidth;
    graphics.fillRoundedRect(cabinetX, counterY + 9, cabinetWidth - 3, 7, 1.5);
    graphics.fillStyle(lighten(metal, 0.3), 0.92);
    graphics.fillCircle(cabinetX + cabinetWidth - 8, counterY + 12, 1.3);
    graphics.fillStyle(lighten(frame, 0.16), 1);
  }

  const workY = counterY - 7;
  if (art.workspace === "sunrise") {
    for (const chickenX of [bounds.centreX - 13, bounds.centreX + 4]) {
      graphics.lineStyle(1.5, 0x76512d, 1);
      graphics.lineBetween(chickenX, windowY + 3, chickenX, workY - 12);
      graphics.fillStyle(chickenX < bounds.centreX ? 0xe6c694 : 0xb9693f, 1);
      graphics.fillEllipse(chickenX, workY - 7, 12, 17);
      graphics.fillCircle(chickenX + 5, workY - 2, 3);
    }
    graphics.fillStyle(0x8b5736, 1);
    graphics.fillRoundedRect(bounds.centreX + 20, workY - 6, 22, 10, 2);
    graphics.fillStyle(0xd7e1db, 1);
    graphics.fillRect(bounds.centreX + 29, workY - 15, 3, 12);
  } else if (art.workspace === "coconut") {
    for (const potX of [bounds.centreX - 18, bounds.centreX + 14]) {
      graphics.fillStyle(0x6c7773, 1);
      graphics.fillRoundedRect(potX - 10, workY - 9, 20, 12, 4);
      graphics.fillStyle(0xd6d7cf, 1);
      graphics.fillEllipse(potX, workY - 9, 20, 6);
      graphics.fillCircle(potX, workY - 13, 3);
    }
    graphics.fillStyle(0x4f874f, 1);
    graphics.fillEllipse(bounds.centreX + 38, workY - 8, 18, 8);
    graphics.fillEllipse(bounds.centreX + 34, workY - 13, 7, 16);
  } else if (art.workspace === "kopi") {
    graphics.fillStyle(0xa86f44, 1);
    graphics.fillEllipse(bounds.centreX - 17, workY - 5, 20, 15);
    graphics.fillStyle(0xead8b5, 1);
    graphics.fillEllipse(bounds.centreX - 17, workY - 8, 15, 5);
    graphics.lineStyle(2, 0x6b4c32, 1);
    graphics.strokeCircle(bounds.centreX - 5, workY - 3, 6);
    graphics.fillStyle(0xc5d4cf, 1);
    graphics.fillTriangle(bounds.centreX + 7, workY + 2, bounds.centreX + 20, workY - 14, bounds.centreX + 28, workY + 2);
    graphics.lineStyle(2, 0x5c6b67, 1);
    graphics.strokeCircle(bounds.centreX + 29, workY - 4, 6);
  } else if (art.workspace === "cinder") {
    graphics.fillStyle(0x272f2e, 1);
    graphics.fillEllipse(bounds.centreX, workY - 4, 43, 17);
    graphics.lineStyle(3, 0x84908d, 1);
    graphics.strokeEllipse(bounds.centreX, workY - 4, 43, 17);
    graphics.fillStyle(0xf0a13b, 1);
    graphics.fillTriangle(bounds.centreX - 12, workY + 2, bounds.centreX - 4, workY - 12, bounds.centreX + 1, workY + 3);
    graphics.fillStyle(0xd95438, 1);
    graphics.fillTriangle(bounds.centreX - 2, workY + 2, bounds.centreX + 7, workY - 10, bounds.centreX + 12, workY + 3);
    graphics.lineStyle(3, 0x615248, 1);
    graphics.lineBetween(bounds.centreX + 17, workY - 9, bounds.centreX + 38, workY - 18);
  } else if (art.workspace === "mee-pok") {
    for (const basketX of [bounds.centreX - 21, bounds.centreX - 2]) {
      graphics.fillStyle(0xbfc9c4, 1);
      graphics.fillEllipse(basketX, workY - 6, 15, 8);
      graphics.lineStyle(1.5, 0x596965, 1);
      graphics.strokeEllipse(basketX, workY - 6, 15, 8);
      graphics.lineBetween(basketX - 5, workY - 10, basketX - 5, workY - 3);
      graphics.lineBetween(basketX, workY - 10, basketX, workY - 3);
      graphics.lineBetween(basketX + 5, workY - 10, basketX + 5, workY - 3);
    }
    const bottleColours = [0x9f4d36, 0x6b3e2c, 0xe5b342] as const;
    for (let bottle = 0; bottle < 3; bottle += 1) {
      graphics.fillStyle(bottleColours[bottle] as number, 1);
      graphics.fillRoundedRect(bounds.centreX + 17 + bottle * 8, workY - 12 + (bottle % 2) * 3, 6, 13, 2);
    }
    graphics.fillStyle(0xd8aa52, 1);
    graphics.fillEllipse(bounds.centreX + 5, workY - 3, 19, 7);
  } else if (art.workspace === "sweet-monsoon") {
    graphics.fillStyle(0xcfd8d5, 1);
    graphics.fillRoundedRect(bounds.centreX - 31, workY - 17, 23, 19, 4);
    graphics.fillStyle(0xf0f2ed, 1);
    graphics.fillTriangle(bounds.centreX - 28, workY - 1, bounds.centreX - 11, workY - 1, bounds.centreX - 19, workY - 14);
    const jarColours = [0x8b5a38, 0x4d9252, 0xc55656] as const;
    for (let jar = 0; jar < 3; jar += 1) {
      const jarX = bounds.centreX + 2 + jar * 13;
      graphics.fillStyle(0xe8f0eb, 0.88);
      graphics.fillRoundedRect(jarX - 5, workY - 14, 10, 15, 3);
      graphics.fillStyle(jarColours[jar] as number, 1);
      graphics.fillRoundedRect(jarX - 4, workY - 7, 8, 7, 2);
    }
    graphics.lineStyle(2, 0xd9e4df, 1);
    graphics.lineBetween(bounds.maxX - 14, workY - 19, bounds.maxX - 28, workY - 2);
    graphics.fillStyle(0xc88745, 1);
    graphics.fillEllipse(bounds.maxX - 14, workY - 18, 8, 5);
    graphics.fillEllipse(bounds.maxX - 28, workY - 1, 8, 5);
  } else if (art.workspace === "satay") {
    graphics.fillStyle(0x2e3431, 1);
    graphics.fillRoundedRect(bounds.centreX - 34, workY - 9, 68, 13, 3);
    graphics.fillStyle(0xd65034, 1);
    for (let ember = 0; ember < 6; ember += 1) {
      graphics.fillCircle(bounds.centreX - 26 + ember * 10, workY, 2.5);
    }
    for (let skewer = 0; skewer < 5; skewer += 1) {
      const skewerX = bounds.centreX - 25 + skewer * 12;
      graphics.lineStyle(1.5, 0xd6b477, 1);
      graphics.lineBetween(skewerX, workY - 14, skewerX + 5, workY + 2);
      graphics.fillStyle(skewer % 2 === 0 ? 0x9c4b33 : 0x6f392d, 1);
      graphics.fillCircle(skewerX + 2, workY - 8, 3);
      graphics.fillCircle(skewerX + 3, workY - 3, 3);
    }
  } else if (art.workspace === "bamboo-basket") {
    for (let stack = 0; stack < 3; stack += 1) {
      const stackX = bounds.centreX - 25 + stack * 25;
      const tierCount = 2 + (stack % 2);
      for (let tier = 0; tier < tierCount; tier += 1) {
        const tierY = workY - tier * 8;
        graphics.fillStyle(tier % 2 === 0 ? 0xc89b58 : 0xdaaF68, 1);
        graphics.fillRoundedRect(stackX - 10, tierY - 5, 20, 7, 3);
        graphics.lineStyle(1, 0x815f36, 1);
        graphics.lineBetween(stackX - 8, tierY - 2, stackX + 8, tierY - 2);
      }
    }
    graphics.fillStyle(0xf1e0c5, 1);
    graphics.fillCircle(bounds.centreX + 39, workY - 5, 4);
    graphics.fillCircle(bounds.centreX + 34, workY, 4);
  } else if (art.workspace === "tiffin") {
    for (let stack = 0; stack < 2; stack += 1) {
      const stackX = bounds.centreX - 18 + stack * 31;
      for (let tier = 0; tier < 3 + stack; tier += 1) {
        graphics.fillStyle(tier % 2 === 0 ? 0xd8d7ca : accent, 1);
        graphics.fillRoundedRect(stackX - 8, workY - tier * 7 - 3, 16, 7, 2);
      }
      graphics.lineStyle(1.5, 0x5f625d, 1);
      graphics.strokeRoundedRect(stackX - 10, workY - (3 + stack) * 7 + 2, 20, (3 + stack) * 7, 5);
    }
  } else if (art.workspace === "tamarind") {
    graphics.fillStyle(0x4f874f, 1);
    graphics.fillEllipse(bounds.centreX, workY - 3, 58, 18);
    graphics.fillStyle(0xdfa841, 1);
    graphics.fillTriangle(bounds.centreX - 23, workY - 3, bounds.centreX + 19, workY - 9, bounds.centreX + 23, workY + 2);
    graphics.fillStyle(0xb96139, 1);
    graphics.fillCircle(bounds.centreX + 31, workY - 2, 5);
  } else if (art.workspace === "straits") {
    graphics.fillStyle(0xc15e43, 1);
    graphics.fillEllipse(bounds.centreX - 13, workY - 3, 26, 12);
    graphics.fillStyle(0xe7d2a8, 1);
    graphics.fillEllipse(bounds.centreX - 13, workY - 6, 20, 7);
    graphics.fillStyle(0x445d58, 1);
    for (let jar = 0; jar < 3; jar += 1) {
      graphics.fillRoundedRect(bounds.centreX + 11 + jar * 10, workY - 10 + (jar % 2) * 3, 7, 12, 3);
    }
  } else if (art.workspace === "harbour") {
    graphics.fillStyle(0x47765d, 1);
    graphics.fillEllipse(bounds.centreX - 8, workY - 4, 39, 14);
    graphics.fillStyle(0xd85c3e, 1);
    graphics.fillEllipse(bounds.centreX - 7, workY - 5, 27, 8);
    graphics.fillTriangle(bounds.centreX - 28, workY - 4, bounds.centreX - 17, workY - 13, bounds.centreX - 17, workY + 4);
    graphics.lineStyle(2, 0x283d3b, 1);
    for (let grate = 0; grate < 4; grate += 1) {
      graphics.lineBetween(bounds.centreX + 17 + grate * 5, workY - 12, bounds.centreX + 17 + grate * 5, workY + 2);
    }
  } else {
    const propCount = 2 + (stallVariant % 3);
    for (let prop = 0; prop < propCount; prop += 1) {
      const propX = bounds.centreX + (prop - (propCount - 1) / 2) * 20;
      graphics.fillStyle(prop % 2 === 0 ? accent : primary, 1);
      graphics.fillEllipse(propX, workY - (prop % 2) * 4, 16, 9);
      graphics.fillStyle(secondary, 1);
      graphics.fillEllipse(propX, workY - 2 - (prop % 2) * 4, 11, 5);
    }
  }

  const stallDefinition = STALL_BY_ID.get(id);
  const vendorRecipe = STALL_VENDOR_VISUAL_BY_ID.get(id);
  if (stallDefinition && vendorRecipe) {
    const pose = vendorAnimationPoseForStall(
      vendorRecipe,
      snapshot.tick,
      context.frame.isReducedMotion,
      serviceVisual.activity,
    );
    drawStallVendor(graphics, context, bounds, windowHeight, counterY, vendorRecipe, pose);
    drawStallEmblem(
      graphics,
      vendorRecipe.emblem,
      windowX + windowWidth - 17,
      windowY + 18,
      bounds.height < TILE_SIZE * 3 ? 0.64 : 0.78,
      primary,
      accent,
    );

    // Redraw the foreground lip after the worker so the character remains
    // convincingly inside the stall rather than floating over the counter.
    graphics.fillStyle(darken(0xa76d3c, 0.18), 1);
    graphics.fillRoundedRect(bounds.minX + 8, counterY + 1, bounds.width - 16, 7, 2);
    graphics.fillStyle(lighten(0xa76d3c, 0.34), 0.94);
    graphics.fillRect(bounds.minX + 13, counterY + 1, bounds.width - 26, 2);

    const displayLimit = context.frame.qualityMode === "standard"
      ? bounds.width >= TILE_SIZE * 4 ? 3 : 2
      : 2;
    const displayDishIds = displayDishIdsForStall(
      stallDefinition,
      [
        serviceVisual.preparingDishId,
        ...(stallMenus[id] ?? []),
      ].filter((dishId): dishId is string => typeof dishId === "string"),
      displayLimit,
    );
    const displaySpan = Math.min(bounds.width - 52, 116);
    const servingScale = bounds.height < TILE_SIZE * 3 ? 0.4 : 0.46;
    for (const [index, dishId] of displayDishIds.entries()) {
      const fraction = displayDishIds.length === 1
        ? 0.5
        : index / (displayDishIds.length - 1);
      const dishX = bounds.centreX - displaySpan / 2 + displaySpan * fraction;
      const dishY = counterY - 2 - (index % 2) * 1.5;
      graphics.fillStyle(0x18332d, 0.13);
      graphics.fillEllipse(dishX + 1, counterY + 4, 28 * servingScale, 8 * servingScale);
      const variantId = dishId === serviceVisual.preparingDishId
        ? serviceVisual.preparingVariantId
        : activeDishVariants[dishId];
      drawDishServing(
        graphics,
        context,
        dishId,
        dishX,
        dishY,
        servingScale,
        0,
        nutritionVisualKeyForVariant(dishId, variantId),
      );
    }
  }

  graphics.lineStyle(3, 0x17352e, 0.82);
  graphics.strokeRoundedRect(bounds.minX + 3, bounds.minY + 7, bounds.width - 6, bounds.height - 10, 8);
  context.addLabel(bounds.centreX, bounds.minY + 15, visual.name);
  if (!object.open) {
    graphics.fillStyle(0x44544f, 0.94);
    graphics.fillRect(windowX, windowY, windowWidth, windowHeight + 7);
    graphics.lineStyle(2, 0x9aa8a2, 0.72);
    for (let slatY = windowY + 5; slatY < counterY + 8; slatY += 7) {
      graphics.lineBetween(windowX + 3, slatY, windowX + windowWidth - 3, slatY);
    }
    context.addLabel(bounds.centreX, bounds.centreY + 16, "CLOSED", "#9a3e31");
  }
}
