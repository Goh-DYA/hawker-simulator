/**
 * Renderers for customers: `drawCustomers`, which draws every guest in the snapshot, the position
 * its avatar is drawn at, and the leaf renderers for the parts drawn over the body (the status
 * indicator bubble, the carried accessory, the outfit dimensions and the garment pattern).
 *
 * Each function draws only from its arguments into the Phaser graphics it is given, so it can
 * live outside the scene. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import { CUSTOMER_ARCHETYPES } from "@/src/content";
import {
  getUtilityInfluence,
  mealConsumptionFraction,
  tileToWorld,
  type Customer,
} from "@/src/game/core";

import { nutritionVisualKeyForVariant } from "../nutrition";
import {
  animationPoseForCustomer,
  customerAppearanceForId,
  visualRecipeForCustomer,
  type CustomerIndicator,
  type CustomerVisualRecipe,
} from "../visuals/customer";
import { stableVisualHash } from "../visuals/palette";
import { TILE_SIZE } from "../world";
import type { RenderContext } from "./context";
import { drawDishServing } from "./dishes";
import { boundsForObject } from "./objects";

const CUSTOMER_BY_ID = new Map(CUSTOMER_ARCHETYPES.map((archetype) => [archetype.id, archetype]));
const CUSTOMER_VISUAL_BY_ID = new Map(
  CUSTOMER_ARCHETYPES.map((archetype) => [archetype.id, visualRecipeForCustomer(archetype)]),
);

/** The customer fields that decide where a customer's avatar is drawn. */
export type CustomerMovementState = Pick<
  Customer,
  "id" | "position" | "path" | "pathIndex" | "movementProgress"
>;

/**
 * Computes where a customer's avatar is drawn: part way to the next path tile by their movement
 * progress, or on their tile when they are not moving or reduced motion is on.
 *
 * @param customer - The customer's movement fields.
 * @param reducedMotion - Whether reduced motion is on, which snaps the avatar to its tile.
 * @returns The grid position of the avatar, possibly between tiles.
 */
export function renderedCustomerPosition(
  customer: CustomerMovementState,
  reducedMotion: boolean,
) {
  const next = customer.path[customer.pathIndex];
  if (!next || reducedMotion) return customer.position;
  const progress = Math.max(0, Math.min(1, customer.movementProgress));
  return {
    x: customer.position.x + (next.x - customer.position.x) * progress,
    y: customer.position.y + (next.y - customer.position.y) * progress,
  };
}

/**
 * Draws the status indicator bubble above a customer, with the icon for its current status.
 *
 * @param graphics - The graphics object to draw into.
 * @param indicator - The status indicator to draw; any unlisted value draws the exit arrow.
 * @param x - World x of the bubble's centre.
 * @param y - World y of the bubble's centre.
 * @param accent - The customer's accent colour, used for the icon.
 */
export function drawCustomerIndicator(
  graphics: Phaser.GameObjects.Graphics,
  indicator: CustomerIndicator,
  x: number,
  y: number,
  accent: number,
) {
  graphics.fillStyle(0xfff8e8, 0.96);
  graphics.fillCircle(x, y, 8);
  graphics.lineStyle(2, accent, 1);
  if (indicator === "question") {
    graphics.strokeCircle(x, y - 2, 3.5);
    graphics.fillStyle(accent, 1);
    graphics.fillCircle(x, y + 5, 1.5);
  } else if (indicator === "footsteps") {
    graphics.fillStyle(accent, 1);
    graphics.fillEllipse(x - 3, y + 2, 3, 6);
    graphics.fillEllipse(x + 3, y - 2, 3, 6);
  } else if (indicator === "queue") {
    graphics.fillStyle(accent, 1);
    for (let index = -1; index <= 1; index += 1) graphics.fillCircle(x + index * 4, y, 1.6);
  } else if (indicator === "order") {
    graphics.strokeRoundedRect(x - 5, y - 4, 10, 7, 2);
    graphics.lineBetween(x - 2, y + 3, x - 4, y + 6);
  } else if (indicator === "clock") {
    graphics.strokeCircle(x, y, 5);
    graphics.lineBetween(x, y, x, y - 3);
    graphics.lineBetween(x, y, x + 3, y + 2);
  } else if (indicator === "seat") {
    graphics.lineBetween(x - 4, y - 4, x - 4, y + 4);
    graphics.lineBetween(x - 4, y + 1, x + 4, y + 1);
    graphics.lineBetween(x + 4, y + 1, x + 4, y + 5);
  } else if (indicator === "meal") {
    graphics.strokeCircle(x, y, 5);
    graphics.lineBetween(x - 6, y - 5, x - 6, y + 5);
  } else if (indicator === "return") {
    graphics.lineBetween(x - 5, y, x + 4, y);
    graphics.lineBetween(x - 5, y, x - 1, y - 4);
    graphics.lineBetween(x - 5, y, x - 1, y + 4);
  } else {
    graphics.lineBetween(x - 4, y, x + 5, y);
    graphics.lineBetween(x + 5, y, x + 1, y - 4);
    graphics.lineBetween(x + 5, y, x + 1, y + 4);
  }
}

/**
 * Draws the prop a customer carries, such as a tote, briefcase, backpack or walking aid.
 *
 * @param graphics - The graphics object to draw into.
 * @param accessory - The archetype's carry prop; other values draw nothing.
 * @param x - World x of the customer's body centre.
 * @param y - World y of the customer's body centre.
 * @param accent - The customer's accent colour, used for the prop.
 */
export function drawCustomerAccessory(
  graphics: Phaser.GameObjects.Graphics,
  accessory: CustomerVisualRecipe["accessory"],
  x: number,
  y: number,
  accent: number,
) {
  graphics.fillStyle(accent, 1);
  if (accessory === "tote") {
    graphics.fillRoundedRect(x + 8, y - 1, 8, 11, 2);
    graphics.lineStyle(1.5, accent, 1);
    graphics.strokeCircle(x + 12, y - 2, 4);
  } else if (accessory === "briefcase") {
    graphics.fillRoundedRect(x + 8, y + 1, 11, 8, 2);
    graphics.lineStyle(1.5, accent, 1);
    graphics.strokeRoundedRect(x + 11, y - 2, 5, 4, 1);
  } else if (accessory === "backpack") {
    graphics.fillRoundedRect(x - 14, y - 6, 8, 15, 3);
  } else if (accessory === "walking-aid") {
    graphics.lineStyle(2.5, accent, 1);
    graphics.lineBetween(x + 10, y - 2, x + 13, y + 13);
    graphics.lineBetween(x + 13, y + 13, x + 17, y + 13);
  }
}

/**
 * Gives the body size for an outfit silhouette, shortened while the customer is seated eating.
 *
 * @param silhouette - The archetype's outfit silhouette.
 * @param isEating - Whether the customer is in the eating pose, which lowers the body by 3 px.
 * @returns The outfit's width, height and corner radius in pixels.
 */
export function customerOutfitDimensions(
  silhouette: CustomerVisualRecipe["outfitSilhouette"],
  isEating: boolean,
) {
  const dimensions = {
    compact: { width: 18, height: 20, radius: 5 },
    relaxed: { width: 23, height: 21, radius: 8 },
    structured: { width: 20, height: 23, radius: 4 },
    layered: { width: 24, height: 23, radius: 7 },
    sporty: { width: 19, height: 20, radius: 9 },
    classic: { width: 21, height: 22, radius: 6 },
  }[silhouette];
  return {
    ...dimensions,
    height: isEating ? dimensions.height - 3 : dimensions.height,
  };
}

/**
 * Draws the garment pattern over a customer's outfit, such as a band, panel, sash, piping or
 * pocket.
 *
 * @param graphics - The graphics object to draw into.
 * @param pattern - The archetype's garment pattern; other values draw nothing.
 * @param x - World x of the outfit's centre.
 * @param y - World y of the outfit's centre.
 * @param width - The outfit's width in pixels.
 * @param height - The outfit's height in pixels.
 * @param radius - The outfit's corner radius in pixels.
 * @param accent - The customer's accent colour, used for the pattern.
 */
export function drawCustomerGarmentPattern(
  graphics: Phaser.GameObjects.Graphics,
  pattern: CustomerVisualRecipe["garmentPattern"],
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  accent: number,
) {
  graphics.fillStyle(accent, 1);
  if (pattern === "banded") {
    graphics.fillRect(x - width / 2, y + 3, width, 4);
  } else if (pattern === "panelled") {
    graphics.fillRoundedRect(x - 3, y - 4, 6, height - 2, 2);
  } else if (pattern === "sashed") {
    graphics.lineStyle(3, accent, 1);
    graphics.lineBetween(x - width / 2 + 3, y - 3, x + width / 2 - 3, y + 10);
  } else if (pattern === "piped") {
    graphics.lineStyle(1.5, accent, 1);
    graphics.strokeRoundedRect(x - width / 2 + 1, y - 4, width - 2, height - 2, radius);
  } else if (pattern === "pocketed") {
    graphics.fillRoundedRect(x + 1, y + 1, 7, 6, 1.5);
    graphics.lineStyle(1, 0xffffff, 0.45);
    graphics.lineBetween(x + 2, y + 3, x + 7, y + 3);
  }
}

/**
 * Finds where a seated customer's meal tray goes: towards the centre of the nearest table within
 * reach, or just above the customer when no table is close enough.
 *
 * @param context - The render context; its snapshot objects, visuals and catalog locate tables.
 * @param customerX - World x of the customer.
 * @param customerY - World y of the customer.
 * @returns The world point for the tray's centre.
 */
function nearestTableMealAnchor(
  context: RenderContext,
  customerX: number,
  customerY: number,
) {
  const { snapshot, visuals, catalog } = context;
  let best: { x: number; y: number; distance: number } | undefined;
  for (const object of snapshot.objects) {
    if (visuals[object.definitionId]?.category !== "table") continue;
    const bounds = boundsForObject(object, catalog);
    if (!bounds) continue;
    const distance = Math.hypot(bounds.centreX - customerX, bounds.centreY - customerY);
    if (distance > TILE_SIZE * 2.2 || (best && distance >= best.distance)) continue;
    best = { x: bounds.centreX, y: bounds.centreY, distance };
  }
  if (!best || best.distance < 1) return { x: customerX, y: customerY - 17 };
  const reach = Math.min(20, best.distance * 0.48);
  return {
    x: customerX + ((best.x - customerX) / best.distance) * reach,
    y: customerY + ((best.y - customerY) / best.distance) * reach,
  };
}

/**
 * Draws every customer in the snapshot: the selection ring, shadow, legs, body and garment
 * pattern, head and arms, accessory, carried tray or meal at the table, status indicator,
 * patience arc while queued or waiting, and, with the debug overlay, the remaining path.
 *
 * @param graphics - The world graphics object to draw into.
 * @param context - The render context; the snapshot supplies the customers, the live state and
 *   layered catalog give dining speed and patience, and the frame gives reduced motion and high
 *   contrast.
 */
export function drawCustomers(graphics: Phaser.GameObjects.Graphics, context: RenderContext) {
  const { snapshot, state, catalog, selectedCustomerId, isDebugOverlay } = context;
  const { isReducedMotion, isHighContrast } = context.frame;
  for (const customer of snapshot.customers) {
    const archetype = CUSTOMER_BY_ID.get(customer.archetypeId) ?? CUSTOMER_ARCHETYPES[0];
    if (!archetype) continue;
    const visual = CUSTOMER_VISUAL_BY_ID.get(archetype.id) ?? visualRecipeForCustomer(archetype);
    const customerSeed = stableVisualHash(customer.id);
    const appearance = customerAppearanceForId(customer.id);
    const pose = animationPoseForCustomer(customer.status, snapshot.tick, customerSeed, isReducedMotion);
    const position = renderedCustomerPosition(customer, isReducedMotion);
    const next = customer.path[customer.pathIndex];
    const directionX = next ? Math.sign(next.x - customer.position.x) : 0;
    const directionY = next ? Math.sign(next.y - customer.position.y) : 1;
    const x = (position.x + 0.5) * TILE_SIZE;
    const y = (position.y + 0.5) * TILE_SIZE + pose.bob;
    const outfit = customerOutfitDimensions(visual.outfitSilhouette, pose.pose === "eat");
    const bodyWidth = outfit.width;
    const bodyHeight = outfit.height;

    if (customer.id === selectedCustomerId) {
      graphics.lineStyle(4, isHighContrast ? 0xffffff : 0x2d6ea8, 1);
      graphics.strokeCircle(x, y + 1, 24);
      graphics.lineStyle(2, isHighContrast ? 0x17352e : 0xfff7e5, 1);
      graphics.strokeCircle(x, y + 1, 19);
    }
    graphics.fillStyle(0x17352e, 0.16);
    graphics.fillEllipse(x, y + 13, bodyWidth + 9, 9);
    if (pose.stride !== 0) {
      graphics.lineStyle(4, appearance.clothing, 1);
      graphics.lineBetween(x - 4, y + 7, x - 5 + pose.stride, y + 14);
      graphics.lineBetween(x + 4, y + 7, x + 5 - pose.stride, y + 14);
    }
    graphics.fillStyle(appearance.clothing, 1);
    graphics.fillRoundedRect(
      x - bodyWidth / 2,
      y - 5,
      bodyWidth,
      bodyHeight,
      outfit.radius,
    );
    drawCustomerGarmentPattern(
      graphics,
      visual.garmentPattern,
      x,
      y,
      bodyWidth,
      bodyHeight,
      outfit.radius,
      appearance.accent,
    );
    graphics.fillStyle(appearance.skin, 1);
    graphics.fillCircle(x + directionX * 2, y - 10 + directionY * 0.5, 7.5);
    graphics.lineStyle(2, 0x17352e, 0.7);
    graphics.strokeCircle(x + directionX * 2, y - 10 + directionY * 0.5, 7.5);
    graphics.lineStyle(3.5, appearance.skin, 1);
    graphics.lineBetween(x - bodyWidth / 2 + 2, y, x - bodyWidth / 2 - 3 + pose.armSwing, y + 8);
    graphics.lineBetween(x + bodyWidth / 2 - 2, y, x + bodyWidth / 2 + 3 - pose.armSwing, y + 8);

    if (((customerSeed >>> 7) % 1_000) / 1_000 < visual.accessoryChance) {
      drawCustomerAccessory(graphics, visual.accessory, x, y, appearance.accent);
    }

    if (pose.carriesFood || (customer.hasTray && customer.status !== "eating")) {
      graphics.fillStyle(0xb7864d, 1);
      graphics.fillRoundedRect(x - 16, y + 7, 32, 10, 3);
      graphics.fillStyle(0xd8b772, 1);
      graphics.fillRoundedRect(x - 13, y + 9, 26, 6, 2);
      graphics.lineStyle(1.5, 0x7a5a35, 0.9);
      graphics.strokeRoundedRect(x - 16, y + 7, 32, 10, 3);
      graphics.fillStyle(appearance.skin, 1);
      graphics.fillCircle(x - 14, y + 9, 2.6);
      graphics.fillCircle(x + 14, y + 9, 2.6);
      if (pose.carriesFood) {
        drawDishServing(
          graphics,
          context,
          customer.orderedDishId,
          x,
          y + 6,
          0.66,
          0,
          nutritionVisualKeyForVariant(
            customer.orderedDishId,
            customer.orderedNutritionVariantId,
          ),
        );
      }
    }

    if (pose.showsMeal) {
      const anchor = nearestTableMealAnchor(context, x, y);
      const dish = customer.orderedDishId ? catalog.dishes[customer.orderedDishId] : undefined;
      const diningUtility = getUtilityInfluence(state.objects, catalog, customer.position);
      const eatenFraction = dish
        ? mealConsumptionFraction(
            customer.stateElapsedMs,
            dish.eatingMs,
            diningUtility.eatingSpeed,
          )
        : 0;
      graphics.fillStyle(0xb7864d, 1);
      graphics.fillRoundedRect(anchor.x - 17, anchor.y - 11, 34, 22, 4);
      graphics.fillStyle(0xd8b772, 1);
      graphics.fillRoundedRect(anchor.x - 14, anchor.y - 8, 28, 16, 3);
      drawDishServing(
        graphics,
        context,
        customer.orderedDishId,
        anchor.x,
        anchor.y,
        0.82,
        eatenFraction,
        nutritionVisualKeyForVariant(
          customer.orderedDishId,
          customer.orderedNutritionVariantId,
        ),
      );
      graphics.lineStyle(2.5, appearance.skin, 1);
      graphics.lineBetween(x + 5, y + 2, anchor.x + pose.armSwing * 0.35, anchor.y - 2);
      graphics.lineStyle(1.5, 0x5f5142, 1);
      graphics.lineBetween(anchor.x + 9, anchor.y - 7, anchor.x + 13, anchor.y + 7);
    }

    drawCustomerIndicator(graphics, pose.indicator, x + 15, y - 19, appearance.accent);

    if (customer.status === "queued" || customer.status === "waiting-for-food") {
      const patience = catalog.archetypes[customer.archetypeId]?.patienceMs ?? 1;
      const fraction = Math.max(0, Math.min(1, customer.patienceRemainingMs / patience));
      graphics.lineStyle(2.5, fraction > 0.35 ? 0xe8b94f : 0xc75542, 1);
      graphics.beginPath();
      graphics.arc(x, y + 2, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
      graphics.strokePath();
    }
    if (isDebugOverlay) {
      graphics.lineStyle(2, 0x287ec0, 0.55);
      let previous = { x, y };
      for (const step of customer.path.slice(customer.pathIndex)) {
        const pathPoint = tileToWorld(snapshot.map, step);
        graphics.lineBetween(previous.x, previous.y, pathPoint.x, pathPoint.y);
        previous = pathPoint;
      }
    }
  }
}
