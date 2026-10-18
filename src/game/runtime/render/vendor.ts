/**
 * Renderers for the vendor drawn behind each stall counter: the figure itself, plus its hair,
 * headwear and the tool in the vendor's working hand.
 *
 * Each function draws only from its arguments into the Phaser graphics it is given, so it can
 * live outside the scene. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import { darken, lighten } from "../visuals/palette";
import type { StallVendorAnimationPose, StallVendorRecipe } from "../visuals/vendor";
import type { ObjectVisualBounds, RenderContext } from "./context";

/**
 * Draws the vendor's headwear on top of the head, in the recipe's apron colour.
 *
 * @param graphics - The graphics object to draw into.
 * @param recipe - The vendor's visual recipe, whose headwear picks the shape.
 * @param headX - World x of the head's centre.
 * @param headY - World y of the head's centre.
 * @param scale - The vendor's draw scale.
 */
export function drawStallVendorHeadwear(
  graphics: Phaser.GameObjects.Graphics,
  recipe: StallVendorRecipe,
  headX: number,
  headY: number,
  scale: number,
) {
  const brimY = headY - 6.2 * scale;
  graphics.fillStyle(recipe.apron, 1);
  if (recipe.headwear === "service-cap") {
    graphics.fillEllipse(headX - scale, brimY - 2 * scale, 15 * scale, 8 * scale);
    graphics.fillRoundedRect(headX - 7 * scale, brimY - 3 * scale, 13 * scale, 5 * scale, 2 * scale);
    graphics.fillStyle(recipe.apronTrim, 1);
    graphics.fillRoundedRect(headX + 2 * scale, brimY, 8 * scale, 2.5 * scale, scale);
  } else if (recipe.headwear === "visor") {
    graphics.fillRoundedRect(headX - 8 * scale, brimY - 2 * scale, 16 * scale, 3.5 * scale, scale);
    graphics.fillStyle(recipe.apronTrim, 1);
    graphics.fillRoundedRect(headX + 2 * scale, brimY, 9 * scale, 2.4 * scale, scale);
  } else if (recipe.headwear === "headband") {
    graphics.fillStyle(recipe.apronTrim, 1);
    graphics.fillRoundedRect(headX - 7.5 * scale, brimY - 1.5 * scale, 15 * scale, 3 * scale, scale);
    graphics.fillTriangle(
      headX + 6 * scale,
      brimY,
      headX + 11 * scale,
      brimY + 5 * scale,
      headX + 7 * scale,
      brimY + 3 * scale,
    );
  } else if (recipe.headwear === "hair-wrap") {
    graphics.fillEllipse(headX, brimY - 2.5 * scale, 17 * scale, 10 * scale);
    graphics.fillStyle(recipe.apronTrim, 1);
    graphics.fillRoundedRect(headX - 8 * scale, brimY - 1.5 * scale, 16 * scale, 3 * scale, scale);
    graphics.fillCircle(headX + 7 * scale, brimY - 5 * scale, 3 * scale);
  } else if (recipe.headwear === "chef-cap") {
    graphics.fillStyle(0xf4efe4, 1);
    for (let lobe = -1; lobe <= 1; lobe += 1) {
      graphics.fillCircle(headX + lobe * 4 * scale, brimY - 5 * scale, 4.7 * scale);
    }
    graphics.fillRoundedRect(headX - 8 * scale, brimY - 5 * scale, 16 * scale, 7 * scale, 2 * scale);
    graphics.fillStyle(recipe.apronTrim, 0.9);
    graphics.fillRect(headX - 7 * scale, brimY, 14 * scale, 1.6 * scale);
  } else {
    graphics.fillStyle(lighten(recipe.apron, 0.45), 0.82);
    graphics.fillEllipse(headX, brimY - 2 * scale, 16 * scale, 9 * scale);
    graphics.lineStyle(Math.max(0.8, scale), recipe.apronTrim, 0.68);
    for (let band = -2; band <= 2; band += 1) {
      graphics.lineBetween(
        headX + band * 3 * scale,
        brimY - 6 * scale,
        headX + band * 2.2 * scale,
        brimY + scale,
      );
    }
  }
}

/**
 * Draws the vendor's hair around the head, in the recipe's hair colour and style.
 *
 * @param graphics - The graphics object to draw into.
 * @param recipe - The vendor's visual recipe, whose hair style picks the shape.
 * @param headX - World x of the head's centre.
 * @param headY - World y of the head's centre.
 * @param scale - The vendor's draw scale.
 */
export function drawStallVendorHair(
  graphics: Phaser.GameObjects.Graphics,
  recipe: StallVendorRecipe,
  headX: number,
  headY: number,
  scale: number,
) {
  graphics.fillStyle(recipe.hair, 1);
  if (recipe.hairStyle === "tied-back") {
    graphics.fillCircle(headX - 7 * scale, headY - 2 * scale, 4.5 * scale);
    graphics.fillEllipse(headX, headY - 6 * scale, 16 * scale, 10 * scale);
  } else if (recipe.hairStyle === "coiled") {
    for (let curl = -2; curl <= 2; curl += 1) {
      graphics.fillCircle(headX + curl * 3.2 * scale, headY - (6 + Math.abs(curl)) * scale, 3.2 * scale);
    }
  } else if (recipe.hairStyle === "wavy") {
    graphics.fillEllipse(headX, headY - 5.5 * scale, 17 * scale, 11 * scale);
    graphics.fillCircle(headX - 7 * scale, headY - 1.5 * scale, 3.5 * scale);
    graphics.fillCircle(headX + 7 * scale, headY - 1.5 * scale, 3.5 * scale);
  } else if (recipe.hairStyle === "side-part") {
    graphics.fillEllipse(headX, headY - 6 * scale, 16 * scale, 9 * scale);
    graphics.lineStyle(Math.max(0.8, scale), lighten(recipe.hair, 0.28), 0.72);
    graphics.lineBetween(headX - scale, headY - 9 * scale, headX + 5 * scale, headY - 5 * scale);
  } else {
    graphics.fillEllipse(
      headX,
      headY - 5.5 * scale,
      recipe.hairStyle === "close-cut" ? 15 * scale : 16 * scale,
      recipe.hairStyle === "close-cut" ? 7 * scale : 9 * scale,
    );
  }
}

/**
 * Draws the tool in the vendor's working hand, angled by the current pose.
 *
 * @param graphics - The graphics object to draw into.
 * @param recipe - The vendor's visual recipe, whose tool picks the shape and whose seed picks
 *   the working hand.
 * @param pose - The vendor's current animation pose, which supplies the tool angle.
 * @param handX - World x of the working hand.
 * @param handY - World y of the working hand.
 * @param scale - The vendor's draw scale.
 */
export function drawStallVendorTool(
  graphics: Phaser.GameObjects.Graphics,
  recipe: StallVendorRecipe,
  pose: StallVendorAnimationPose,
  handX: number,
  handY: number,
  scale: number,
) {
  const handedness = (recipe.seed & 1) === 0 ? 1 : -1;
  const angle = handedness === 1
    ? -0.55 + pose.toolAngle
    : Math.PI + 0.55 - pose.toolAngle;
  const endX = handX + Math.cos(angle) * 13 * scale;
  const endY = handY + Math.sin(angle) * 13 * scale;
  graphics.lineStyle(Math.max(1.2, 2 * scale), 0x66503b, 1);

  if (recipe.tool === "long-spout-kettle") {
    graphics.fillStyle(0xaebfba, 1);
    graphics.fillEllipse(endX, endY, 13 * scale, 10 * scale);
    graphics.lineStyle(Math.max(1, 1.6 * scale), 0x586c67, 1);
    graphics.strokeCircle(endX - 5 * scale, endY - 4 * scale, 4 * scale);
    graphics.fillTriangle(
      endX + handedness * 5 * scale,
      endY - 3 * scale,
      endX + handedness * 16 * scale,
      endY - 8 * scale,
      endX + handedness * 6 * scale,
      endY + scale,
    );
    return;
  }

  graphics.lineBetween(handX, handY, endX, endY);
  if (recipe.tool === "cleaver") {
    graphics.fillStyle(0xbcc9c6, 1);
    graphics.fillRoundedRect(endX - scale, endY - 6 * scale, 9 * scale, 8 * scale, scale);
    graphics.fillStyle(0x71827e, 1);
    graphics.fillCircle(endX + 5 * scale, endY - 3 * scale, scale);
  } else if (recipe.tool === "ladle" || recipe.tool === "braising-ladle") {
    graphics.fillStyle(0xaebfba, 1);
    graphics.fillCircle(endX, endY, (recipe.tool === "braising-ladle" ? 4.2 : 3.5) * scale);
    graphics.fillStyle(0x596d68, 1);
    graphics.fillCircle(endX - scale, endY - scale, scale);
  } else if (recipe.tool === "wok-spatula") {
    graphics.fillStyle(0xaebfba, 1);
    graphics.fillEllipse(endX + 2 * scale, endY, 8 * scale, 5 * scale);
    graphics.lineStyle(Math.max(0.8, scale), 0x596d68, 0.9);
    graphics.lineBetween(endX - scale, endY, endX + 5 * scale, endY);
  } else if (recipe.tool === "noodle-basket") {
    graphics.fillStyle(0xd3ddd9, 0.74);
    graphics.fillEllipse(endX + 2 * scale, endY, 11 * scale, 7 * scale);
    graphics.lineStyle(Math.max(0.7, scale), 0x657772, 0.9);
    graphics.strokeEllipse(endX + 2 * scale, endY, 11 * scale, 7 * scale);
    for (let wire = -1; wire <= 1; wire += 1) {
      graphics.lineBetween(endX - 2 * scale, endY + wire * 2 * scale, endX + 6 * scale, endY + wire * 2 * scale);
    }
  } else if (recipe.tool === "griddle-spatula" || recipe.tool === "fish-turner") {
    graphics.fillStyle(0xb7c5c1, 1);
    graphics.fillRoundedRect(endX - scale, endY - 3 * scale, 10 * scale, 7 * scale, scale);
    graphics.lineStyle(Math.max(0.7, scale), 0x687a75, 0.9);
    const slots = recipe.tool === "fish-turner" ? 3 : 2;
    for (let slot = 0; slot < slots; slot += 1) {
      graphics.lineBetween(endX + (2 + slot * 2.5) * scale, endY - 2 * scale, endX + (2 + slot * 2.5) * scale, endY + 2 * scale);
    }
  } else if (recipe.tool === "measuring-cup" || recipe.tool === "batter-cup") {
    graphics.fillStyle(recipe.tool === "batter-cup" ? 0xd9ad5d : 0xcfe3dd, 0.96);
    graphics.fillRoundedRect(endX - 3 * scale, endY - 4 * scale, 8 * scale, 8 * scale, 2 * scale);
    graphics.lineStyle(Math.max(0.8, scale), 0x667a75, 0.88);
    graphics.strokeCircle(endX + 5 * scale, endY, 3 * scale);
  } else if (recipe.tool === "grill-tongs") {
    graphics.lineStyle(Math.max(1, 1.4 * scale), 0xaebfba, 1);
    graphics.lineBetween(handX, handY, endX + 5 * scale, endY - 2 * scale);
    graphics.lineBetween(handX, handY, endX + 5 * scale, endY + 3 * scale);
    graphics.fillCircle(endX + 6 * scale, endY - 2 * scale, 1.3 * scale);
    graphics.fillCircle(endX + 6 * scale, endY + 3 * scale, 1.3 * scale);
  } else if (recipe.tool === "ingredient-tongs") {
    graphics.lineStyle(Math.max(1, 1.4 * scale), 0xaebfba, 1);
    graphics.lineBetween(handX, handY, endX + 6 * scale, endY - 3 * scale);
    graphics.lineBetween(handX, handY, endX + 6 * scale, endY + 3 * scale);
    graphics.fillStyle(0x668079, 1);
    graphics.fillRoundedRect(endX + 4 * scale, endY - 5 * scale, 4 * scale, 3 * scale, scale);
    graphics.fillRoundedRect(endX + 4 * scale, endY + 2 * scale, 4 * scale, 3 * scale, scale);
  } else if (recipe.tool === "claypot-ladle") {
    graphics.fillStyle(0x8f6848, 1);
    graphics.fillCircle(endX, endY, 4.8 * scale);
    graphics.lineStyle(Math.max(1, 1.3 * scale), 0x4f382a, 1);
    graphics.strokeCircle(endX, endY, 4.8 * scale);
    graphics.fillStyle(0xc4a36d, 1);
    graphics.fillCircle(endX - scale, endY - scale, 2.2 * scale);
  } else {
    graphics.fillStyle(lighten(recipe.apron, 0.54), 0.94);
    graphics.fillTriangle(
      endX - 3 * scale,
      endY - 4 * scale,
      endX + 7 * scale,
      endY - 2 * scale,
      endX + 2 * scale,
      endY + 6 * scale,
    );
    graphics.lineStyle(Math.max(0.8, scale), recipe.apronTrim, 0.74);
    graphics.lineBetween(endX - scale, endY - 2 * scale, endX + 4 * scale, endY + 3 * scale);
  }
}

/**
 * Draws the vendor standing behind a stall counter: arms, torso and apron, head, hair,
 * headwear, hands and the working tool, with a light halo in high contrast.
 *
 * @param graphics - The graphics object to draw into.
 * @param context - The render context; only its high-contrast setting is read.
 * @param bounds - The stall's world-space footprint bounds.
 * @param windowHeight - The height of the stall's service window, which sets the vendor's scale.
 * @param counterY - World y of the counter top the vendor stands behind.
 * @param recipe - The vendor's visual recipe.
 * @param pose - The vendor's animation pose for this frame.
 */
export function drawStallVendor(
  graphics: Phaser.GameObjects.Graphics,
  context: RenderContext,
  bounds: ObjectVisualBounds,
  windowHeight: number,
  counterY: number,
  recipe: StallVendorRecipe,
  pose: StallVendorAnimationPose,
) {
  const scale = Math.max(0.72, Math.min(1, windowHeight / 72));
  const handedness = (recipe.seed & 1) === 0 ? 1 : -1;
  const centreOffset = ((recipe.seed >>> 4) % 5 - 2) * 1.15;
  const torsoX = bounds.centreX + centreOffset + pose.lean * scale;
  const headX = torsoX + pose.headTurn * scale;
  const headY = counterY - 37 * scale + pose.bob * scale;
  const shoulderY = headY + 10 * scale;
  const torsoBottom = counterY + 3;
  const workingShoulderX = torsoX + handedness * 7 * scale;
  const supportShoulderX = torsoX - handedness * 7 * scale;
  const workingHandX = workingShoulderX + handedness * (8 + pose.reach) * scale;
  const workingHandY = shoulderY + (7 + pose.workingArm * 6 - pose.toolLift) * scale;
  const supportHandX = supportShoulderX - handedness * (6 + Math.abs(pose.reach) * 0.35) * scale;
  const supportHandY = shoulderY + (8 + pose.supportArm * 5) * scale;

  if (context.frame.isHighContrast) {
    graphics.lineStyle(Math.max(6, 9 * scale), 0xfff9e8, 0.96);
    graphics.lineBetween(workingShoulderX, shoulderY, workingHandX, workingHandY);
    graphics.lineBetween(supportShoulderX, shoulderY, supportHandX, supportHandY);
    graphics.fillStyle(0xfff9e8, 0.96);
    graphics.fillRoundedRect(
      torsoX - 12 * scale,
      shoulderY - 4 * scale,
      24 * scale,
      torsoBottom - shoulderY + 8 * scale,
      7 * scale,
    );
    graphics.fillCircle(headX, headY, 9.5 * scale);
  }

  graphics.fillStyle(0x17352e, 0.14);
  graphics.fillEllipse(torsoX + 2 * scale, counterY - scale, 30 * scale, 9 * scale);

  graphics.lineStyle(Math.max(3.5, 6 * scale), recipe.skin, 1);
  graphics.lineBetween(workingShoulderX, shoulderY, workingHandX, workingHandY);
  graphics.lineBetween(supportShoulderX, shoulderY, supportHandX, supportHandY);
  graphics.fillStyle(recipe.shirt, 1);
  graphics.fillCircle(workingShoulderX, shoulderY, 4.2 * scale);
  graphics.fillCircle(supportShoulderX, shoulderY, 4.2 * scale);

  graphics.fillStyle(recipe.shirt, 1);
  graphics.fillRoundedRect(
    torsoX - 10 * scale,
    shoulderY - 2 * scale,
    20 * scale,
    torsoBottom - shoulderY + 4 * scale,
    5 * scale,
  );
  graphics.fillStyle(recipe.apron, 1);
  if (recipe.apronStyle === "waist") {
    graphics.fillRoundedRect(torsoX - 10 * scale, shoulderY + 9 * scale, 20 * scale, torsoBottom - shoulderY - 5 * scale, 3 * scale);
    graphics.fillStyle(recipe.apronTrim, 1);
    graphics.fillRect(torsoX - 10 * scale, shoulderY + 9 * scale, 20 * scale, 2 * scale);
  } else {
    graphics.fillRoundedRect(torsoX - 7 * scale, shoulderY + 2 * scale, 14 * scale, torsoBottom - shoulderY + scale, 3 * scale);
    graphics.lineStyle(Math.max(1, 1.7 * scale), recipe.apronTrim, 0.95);
    if (recipe.apronStyle === "cross-back") {
      graphics.lineBetween(torsoX - 7 * scale, shoulderY + 3 * scale, torsoX + 6 * scale, shoulderY + 15 * scale);
      graphics.lineBetween(torsoX + 7 * scale, shoulderY + 3 * scale, torsoX - 6 * scale, shoulderY + 15 * scale);
    } else {
      graphics.lineBetween(torsoX - 7 * scale, shoulderY + 3 * scale, torsoX - 4 * scale, shoulderY - scale);
      graphics.lineBetween(torsoX + 7 * scale, shoulderY + 3 * scale, torsoX + 4 * scale, shoulderY - scale);
    }
    if (recipe.apronStyle === "utility") {
      graphics.fillStyle(lighten(recipe.apron, 0.22), 1);
      graphics.fillRoundedRect(torsoX - 5 * scale, shoulderY + 12 * scale, 10 * scale, 6 * scale, scale);
      graphics.lineStyle(Math.max(0.8, scale), recipe.apronTrim, 0.86);
      graphics.lineBetween(torsoX, shoulderY + 13 * scale, torsoX, shoulderY + 17 * scale);
    }
  }

  drawStallVendorHair(graphics, recipe, headX, headY, scale);
  graphics.fillStyle(recipe.skin, 1);
  graphics.fillCircle(headX, headY, 7.5 * scale);
  graphics.fillCircle(headX - 7.2 * scale, headY + scale, 1.7 * scale);
  graphics.fillCircle(headX + 7.2 * scale, headY + scale, 1.7 * scale);
  graphics.fillStyle(0x24332f, 1);
  graphics.fillCircle(headX - 2.5 * scale, headY - scale, 0.9 * scale);
  graphics.fillCircle(headX + 2.5 * scale, headY - scale, 0.9 * scale);
  graphics.lineStyle(Math.max(0.8, scale), darken(recipe.skin, 0.36), 0.82);
  graphics.lineBetween(headX - 2 * scale, headY + 4 * scale, headX + 2 * scale, headY + 4 * scale);
  drawStallVendorHeadwear(graphics, recipe, headX, headY, scale);

  graphics.fillStyle(recipe.skin, 1);
  graphics.fillCircle(workingHandX, workingHandY, 2.7 * scale);
  graphics.fillCircle(supportHandX, supportHandY, 2.7 * scale);
  drawStallVendorTool(graphics, recipe, pose, workingHandX, workingHandY, scale);
}
