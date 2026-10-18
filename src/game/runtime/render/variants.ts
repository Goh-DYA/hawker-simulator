/**
 * Leaf renderer for the nutrition variant cue: the composition mark drawn on a served dish that
 * shows which reviewed nutrition variant the stall is serving, plus the shared `includes_any`
 * substring helper the dish renderers use to pick cues from kebab-case keys.
 *
 * Each function draws only from its arguments into the Phaser graphics it is given, so it can
 * live outside the scene. Phaser is imported as a type only.
 */
import type Phaser from "phaser";

import type { DishVariantVisualFamily } from "../visuals/dish";
import { stableVisualHash } from "../visuals/palette";

/**
 * Reports whether a string contains any of the given substrings.
 *
 * Variant visual keys and dish IDs are kebab-case compounds, so renderers pick their cues by
 * substring rather than by exact match.
 *
 * @param value - The string to search, such as a variant visual key or a dish ID.
 * @param parts - The substrings to look for.
 * @returns True when at least one part occurs in the value.
 */
export function includes_any(value: string, parts: readonly string[]): boolean {
  return parts.some((part) => value.includes(part));
}

/**
 * Draws the cue for a dish's active nutrition variant on top of the served dish.
 *
 * The family picks which composition is drawn, and substrings of the visual key pick the
 * details within it. A `fallback` family draws one to three outlined triangles, counted from a
 * stable hash of the key.
 *
 * @param graphics - The graphics object to draw into.
 * @param visualKey - The active variant's visual key.
 * @param family - The variant's visual family.
 * @param x - World x of the dish's centre.
 * @param y - World y of the dish's centre.
 * @param scale - The dish's draw scale.
 */
export function drawNutritionVariantCue(
  graphics: Phaser.GameObjects.Graphics,
  visualKey: string,
  family: DishVariantVisualFamily,
  x: number,
  y: number,
  scale: number,
) {
  const outline = 0x17352e;
  const lineWidth = Math.max(0.9, 1.15 * scale);
  const has = (...parts: readonly string[]) => includes_any(visualKey, parts);
  graphics.lineStyle(lineWidth, outline, 0.9);

  if (family === "drink") {
    const sugarCount = has("no-sugar", "kosong") ? 0 : has("one-sugar") ? 1 : 2;
    if (has("black-")) {
      graphics.fillStyle(0x4b2d22, 0.86);
      graphics.fillEllipse(x, y - 5 * scale, 9 * scale, 3 * scale);
    }
    if (has("evaporated")) {
      graphics.lineStyle(lineWidth, 0xf3e2c5, 0.96);
      graphics.beginPath();
      graphics.arc(x - 1.3 * scale, y - 5 * scale, 3.4 * scale, 0.2, Math.PI * 1.55);
      graphics.strokePath();
      graphics.beginPath();
      graphics.arc(x + 2.4 * scale, y - 5 * scale, 2.2 * scale, Math.PI * 0.25, Math.PI * 1.8);
      graphics.strokePath();
    } else if (has("milk")) {
      graphics.lineStyle(lineWidth, 0xf3e2c5, 0.96);
      graphics.beginPath();
      graphics.arc(x, y - 5 * scale, 3.4 * scale, 0.2, Math.PI * 1.55);
      graphics.strokePath();
    }
    if (has("pulled-foam")) {
      graphics.fillStyle(0xfff0d0, 1);
      graphics.fillEllipse(x, y - 7 * scale, 10 * scale, 3.5 * scale);
      graphics.fillCircle(x - 3 * scale, y - 8 * scale, 1.2 * scale);
      graphics.fillCircle(x + 2 * scale, y - 8.5 * scale, 1.4 * scale);
    }
    graphics.fillStyle(0xfffbef, 1);
    for (let cube = 0; cube < sugarCount; cube += 1) {
      const cubeX = x + (cube - (sugarCount - 1) / 2) * 4.3 * scale;
      graphics.fillRect(cubeX - 1.5 * scale, y + 2 * scale, 3 * scale, 3 * scale);
      graphics.strokeRect(cubeX - 1.5 * scale, y + 2 * scale, 3 * scale, 3 * scale);
    }
    return;
  }

  if (family === "nasi-lemak") {
    if (has("rice-only")) {
      graphics.lineStyle(lineWidth, outline, 0.9);
      graphics.strokeCircle(x - 4 * scale, y, 7 * scale);
    } else if (has("egg-ikan")) {
      graphics.fillStyle(0xf7edcf, 1);
      graphics.fillCircle(x + 4 * scale, y - 4 * scale, 4 * scale);
      graphics.fillStyle(0xe2a92e, 1);
      graphics.fillCircle(x + 4 * scale, y - 4 * scale, 1.8 * scale);
      graphics.fillStyle(0x76513b, 1);
      for (let dot = 0; dot < 4; dot += 1) {
        graphics.fillCircle(x + (dot - 1.5) * 2.2 * scale, y + 4 * scale, scale);
      }
    } else if (has("fish")) {
      graphics.fillStyle(0xc98a54, 1);
      graphics.fillEllipse(x + 5 * scale, y, 11 * scale, 5 * scale);
      graphics.fillTriangle(x + 9 * scale, y, x + 13 * scale, y - 3 * scale, x + 13 * scale, y + 3 * scale);
    } else {
      if (has("wing")) {
        graphics.fillStyle(0xb96c3d, 1);
        graphics.fillEllipse(x + 5 * scale, y + 2 * scale, 8 * scale, 5 * scale);
        graphics.fillCircle(x + 9 * scale, y + 3 * scale, 2 * scale);
      }
      if (has("cutlet")) {
        graphics.fillStyle(0x955231, 1);
        graphics.fillRoundedRect(x - 1 * scale, y - 6 * scale, 12 * scale, 5 * scale, scale);
        graphics.lineStyle(lineWidth, 0xe1ae66, 1);
        graphics.lineBetween(x, y - 4 * scale, x + 9 * scale, y - 4 * scale);
      }
    }
    return;
  }

  if (family === "carrot-cake") {
    if (has("black-sauce")) {
      graphics.fillStyle(0x5c3a2c, 0.92);
      for (let cube = 0; cube < 4; cube += 1) {
        graphics.fillRoundedRect(
          x - 7 * scale + (cube % 2) * 7 * scale,
          y - 5 * scale + Math.floor(cube / 2) * 6 * scale,
          6 * scale,
          5 * scale,
          scale,
        );
      }
    } else {
      graphics.fillStyle(0xf5edcf, 1);
      graphics.fillEllipse(x + 2 * scale, y - 2 * scale, 13 * scale, 9 * scale);
      graphics.fillStyle(0xe0a936, 1);
      graphics.fillCircle(x + 2 * scale, y - 2 * scale, 2.2 * scale);
    }
    return;
  }

  if (family === "prata") {
    const pieceCount = has("two-curry") ? 2 : 1;
    graphics.fillStyle(0xdca94d, 1);
    for (let piece = 0; piece < pieceCount; piece += 1) {
      graphics.fillRoundedRect(
        x - 8 * scale + piece * 7 * scale,
        y - 4 * scale + piece * 3 * scale,
        11 * scale,
        8 * scale,
        1.5 * scale,
      );
    }
    if (has("egg")) {
      graphics.fillStyle(0xf6e9c4, 1);
      graphics.fillCircle(x, y - scale, 3.6 * scale);
      graphics.fillStyle(0xdda331, 1);
      graphics.fillCircle(x, y - scale, 1.6 * scale);
    }
    if (has("onion")) {
      graphics.fillStyle(0xaa7899, 1);
      graphics.fillCircle(x - 5 * scale, y + 3 * scale, scale);
      graphics.fillCircle(x + 5 * scale, y - 3 * scale, scale);
    }
    if (has("cheese")) {
      graphics.fillStyle(0xf1c84f, 1);
      graphics.fillRoundedRect(x - 7 * scale, y + 3 * scale, 14 * scale, 2.2 * scale, scale);
    }
    return;
  }

  if (family === "fish-soup") {
    if (has("milky")) {
      graphics.fillStyle(0xeadfc5, 0.92);
      graphics.fillEllipse(x, y, 18 * scale, 9 * scale);
    }
    if (has("beehoon")) {
      graphics.lineStyle(lineWidth, 0xe2c679, 1);
      for (let strand = -2; strand <= 2; strand += 1) {
        graphics.lineBetween(x - 7 * scale, y + strand * scale, x + 7 * scale, y - strand * 0.7 * scale);
      }
    } else {
      graphics.fillStyle(0xf0e2ce, 1);
      for (let slice = -1; slice <= 1; slice += 1) {
        graphics.fillEllipse(x + slice * 5 * scale, y + (slice % 2) * 2 * scale, 7 * scale, 3 * scale);
      }
    }
    return;
  }

  if (family === "bak-chor") {
    if (has("broth")) {
      graphics.fillStyle(0xb99762, 0.88);
      graphics.fillEllipse(x, y, 19 * scale, 10 * scale);
      graphics.lineStyle(lineWidth, 0xf0d58c, 0.9);
      graphics.lineBetween(x - 6 * scale, y - 2 * scale, x + 6 * scale, y + 2 * scale);
    } else {
      graphics.lineStyle(lineWidth, 0x70402f, 1);
      for (let strand = -2; strand <= 2; strand += 1) {
        graphics.lineBetween(x - 7 * scale, y + strand * scale, x + 7 * scale, y - strand * scale);
      }
    }
    return;
  }

  if (family === "murtabak") {
    graphics.fillStyle(0xba7a3e, 1);
    for (let piece = 0; piece < 4; piece += 1) {
      graphics.fillRoundedRect(
        x - 8 * scale + (piece % 2) * 8 * scale,
        y - 6 * scale + Math.floor(piece / 2) * 7 * scale,
        7 * scale,
        6 * scale,
        scale,
      );
    }
    const filling = has("vegetable") ? 0x4f8b51 : has("mutton") ? 0x694034 : 0xb7653e;
    graphics.fillStyle(filling, 1);
    if (has("vegetable")) {
      graphics.fillRoundedRect(x - 6 * scale, y - 3 * scale, 3 * scale, 5 * scale, scale);
      graphics.fillTriangle(
        x,
        y + 3 * scale,
        x + 3 * scale,
        y - 3 * scale,
        x + 6 * scale,
        y + 3 * scale,
      );
    } else if (has("mutton")) {
      for (let piece = -1; piece <= 1; piece += 1) {
        const pieceX = x + piece * 5 * scale;
        graphics.fillTriangle(
          pieceX,
          y - 3 * scale,
          pieceX + 3 * scale,
          y,
          pieceX,
          y + 3 * scale,
        );
        graphics.fillTriangle(
          pieceX,
          y - 3 * scale,
          pieceX - 3 * scale,
          y,
          pieceX,
          y + 3 * scale,
        );
      }
    } else {
      graphics.fillCircle(x - 3 * scale, y - 2 * scale, 1.5 * scale);
      graphics.fillCircle(x + 4 * scale, y + 2 * scale, 1.5 * scale);
    }
    if (has("mushroom-cheese")) {
      graphics.fillStyle(0x76543d, 1);
      graphics.fillEllipse(x - 5 * scale, y - 3 * scale, 4 * scale, 2.5 * scale);
      graphics.fillRect(x - 5.5 * scale, y - 2 * scale, scale, 3 * scale);
      graphics.fillStyle(0xf0c84d, 1);
      graphics.fillRoundedRect(x - 7 * scale, y + 5 * scale, 14 * scale, 2 * scale, scale);
    }
    return;
  }

  if (family === "briyani") {
    const protein = has("vegetable") ? 0x57915a : has("mutton") ? 0x6e4032 : has("fish-prawn") ? 0xd9785c : 0x9b5238;
    graphics.fillStyle(protein, 1);
    if (has("vegetable")) {
      graphics.fillCircle(x + 5 * scale, y - 3 * scale, 2.4 * scale);
      graphics.fillRoundedRect(x + 1 * scale, y + 1 * scale, 5 * scale, 4 * scale, scale);
    } else if (has("fish-prawn")) {
      graphics.fillEllipse(x + 5 * scale, y - scale, 9 * scale, 4 * scale);
      graphics.lineStyle(lineWidth, protein, 1);
      graphics.lineBetween(x + 8 * scale, y - 2 * scale, x + 12 * scale, y - 6 * scale);
    } else if (has("mutton")) {
      for (let piece = 0; piece < 3; piece += 1) {
        graphics.fillRoundedRect(
          x + (piece - 1) * 4.5 * scale,
          y - (piece % 2) * 3 * scale,
          4 * scale,
          4 * scale,
          0.8 * scale,
        );
      }
    } else {
      graphics.fillEllipse(x + 5 * scale, y - 2 * scale, 9 * scale, 6 * scale);
      graphics.fillCircle(x + 9 * scale, y + scale, 2.2 * scale);
    }
    return;
  }

  if (family === "thosai") {
    graphics.fillStyle(0xd69a3d, 1);
    if (has("plain-roll")) {
      graphics.fillRoundedRect(x - 10 * scale, y - 3 * scale, 20 * scale, 6 * scale, 3 * scale);
    } else {
      graphics.fillTriangle(x - 10 * scale, y + 5 * scale, x + 10 * scale, y + 4 * scale, x + 6 * scale, y - 5 * scale);
    }
    if (has("egg-centre")) {
      graphics.fillStyle(0xf6e9c4, 1);
      graphics.fillCircle(x, y, 4 * scale);
      graphics.fillStyle(0xdda331, 1);
      graphics.fillCircle(x, y, 1.7 * scale);
    }
    if (has("ghee-gloss")) {
      graphics.lineStyle(Math.max(1, 2 * scale), 0xffe69a, 0.95);
      graphics.lineBetween(x - 7 * scale, y - 2 * scale, x + 7 * scale, y + scale);
    }
    return;
  }

  if (family === "yong-tau-foo") {
    graphics.fillStyle(has("laksa") ? 0xd26f32 : 0xc8b477, 0.82);
    graphics.fillEllipse(x, y, 20 * scale, 10 * scale);
    const pieceColour = has("fried") ? 0xb87435 : 0xe2c275;
    graphics.fillStyle(pieceColour, 1);
    graphics.fillRoundedRect(x - 8 * scale, y - 4 * scale, 6 * scale, 5 * scale, scale);
    graphics.fillTriangle(
      x,
      y - 5 * scale,
      x + 5 * scale,
      y - scale,
      x - scale,
      y + 2 * scale,
    );
    graphics.fillStyle(0x5d9957, 1);
    graphics.fillEllipse(x + 6 * scale, y + 2 * scale, 6 * scale, 4 * scale);
    if (has("noodles")) {
      graphics.lineStyle(lineWidth, 0xe6cf82, 1);
      for (let strand = -1; strand <= 1; strand += 1) {
        graphics.lineBetween(
          x - 7 * scale,
          y + strand * 2 * scale,
          x + 7 * scale,
          y - strand * scale,
        );
      }
    }
    return;
  }

  if (family === "ban-mian") {
    if (has("soup", "tom-yum")) {
      graphics.fillStyle(has("tom-yum") ? 0xd36d3f : 0xc8b477, 0.84);
      graphics.fillEllipse(x, y, 20 * scale, 10 * scale);
    }
    graphics.lineStyle(lineWidth, has("chilli") ? 0xb94c32 : 0xe5c775, 1);
    for (let strand = -2; strand <= 2; strand += 1) {
      graphics.lineBetween(
        x - 8 * scale,
        y + strand * 1.5 * scale,
        x + 8 * scale,
        y - strand * 1.2 * scale,
      );
    }
    graphics.fillStyle(has("vegetable") ? 0x559351 : 0xb96d4b, 1);
    const toppingCount = has("pork-dumpling") ? 3 : 2;
    for (let topping = 0; topping < toppingCount; topping += 1) {
      graphics.fillCircle(
        x + (topping - (toppingCount - 1) / 2) * 5 * scale,
        y - 3 * scale,
        1.8 * scale,
      );
    }
    return;
  }

  if (family === "bak-kut-teh") {
    if (has("dry-claypot")) {
      graphics.fillStyle(0x6f4431, 0.96);
      graphics.fillRoundedRect(x - 10 * scale, y - 6 * scale, 20 * scale, 12 * scale, 3 * scale);
    } else {
      graphics.fillStyle(has("herbal") ? 0x76543b : 0xb89b70, 0.88);
      graphics.fillEllipse(x, y, 20 * scale, 10 * scale);
    }
    graphics.fillStyle(0x9b6546, 1);
    for (let rib = -1; rib <= 1; rib += 1) {
      graphics.fillRoundedRect(
        x + rib * 5 * scale - 2 * scale,
        y - 4 * scale + Math.abs(rib) * 2 * scale,
        5 * scale,
        7 * scale,
        scale,
      );
    }
    return;
  }

  if (family === "duck-rice") {
    graphics.fillStyle(0xb87b43, 1);
    for (let slice = -2; slice <= 2; slice += 1) {
      graphics.fillRoundedRect(
        x + slice * 3 * scale - 2 * scale,
        y - 5 * scale + Math.abs(slice) * scale,
        5 * scale,
        8 * scale,
        scale,
      );
    }
    if (has("braised-egg-tofu")) {
      graphics.fillStyle(0xf0dfb8, 1);
      graphics.fillCircle(x + 8 * scale, y + 3 * scale, 3 * scale);
      graphics.fillStyle(0xc79455, 1);
      graphics.fillRect(x - 10 * scale, y + scale, 5 * scale, 5 * scale);
    } else if (has("roasted")) {
      graphics.lineStyle(Math.max(1, 1.8 * scale), 0x6e3628, 1);
      graphics.lineBetween(x - 7 * scale, y - 4 * scale, x + 7 * scale, y + 2 * scale);
    }
    return;
  }

  const cueCount = 1 + (stableVisualHash(visualKey) % 3);
  for (let index = 0; index < cueCount; index += 1) {
    const cueX = x + (index - (cueCount - 1) / 2) * 5 * scale;
    graphics.strokeTriangle(
      cueX - 2.5 * scale,
      y - 3 * scale,
      cueX + 2.5 * scale,
      y - 3 * scale,
      cueX,
      y + 2 * scale,
    );
  }
}
