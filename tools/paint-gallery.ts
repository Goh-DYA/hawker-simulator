/**
 * Renders the procedural painters to PNG contact sheets with `@napi-rs/canvas`, so the art can
 * be reviewed outside the browser.
 *
 * Usage (from the repo root):
 *
 *   npx tsx tools/paint-gallery.ts --kind stalls --out scratch/stalls.png
 *   npx tsx tools/paint-gallery.ts --kind placeables --category seat --out scratch/seats.png
 *   npx tsx tools/paint-gallery.ts --kind dishes --out scratch/dishes.png
 *   npx tsx tools/paint-gallery.ts --kind customers --out scratch/customers.png
 *   npx tsx tools/paint-gallery.ts --kind vendors --out scratch/vendors.png
 *   npx tsx tools/paint-gallery.ts --kind crew --out scratch/crew.png
 *   npx tsx tools/paint-gallery.ts --kind floor --out scratch/floor.png
 *   npx tsx tools/paint-gallery.ts --kind effects --out scratch/effects.png
 *
 * Options: `--id <contentId>` paints one item at 4x (stalls: open, closed, and the back and
 * front layers apart); `--scale <n>` sets the pixel ratio (default 2); `--hc` paints the
 * high-contrast frame; `--low` the low-detail frame; `--variants` paints every nutrition variant
 * of each dish (dishes only); `--rotation <0|90|180|270>` paints stalls and placeables at one
 * rotation, and `--rotations` paints all four side by side; `--layer <back|front|full>` picks the
 * stall layer (default `full`); `--count <n>` paints n figures per customer archetype (default 2).
 *
 * The tool is a developer aid: it never runs in the browser or the tests.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createCanvas } from "@napi-rs/canvas";

import {
  CUSTOMER_ARCHETYPES,
  DISHES,
  PLACEABLES,
  STALLS,
  getNutritionVariantFamily,
  localize_key,
} from "@/src/content";
import { createGridMap } from "@/src/game/core";
import type { PaintContext } from "@/src/game/runtime/art/canvas";
import { plan_texture } from "@/src/game/runtime/art/index";
import type { Rotation } from "@/src/game/core";
import {
  EFFECT_KINDS,
  rotated_size,
  type PaintFrame,
  type PaintSpec,
  type StallLayer,
  type StallPaintSpec,
} from "@/src/game/runtime/art/specs";
import { resolve_stall_art } from "@/src/game/runtime/render/art";
import {
  customerAppearanceForId,
  customer_figure_for_id,
  visualRecipeForCustomer,
} from "@/src/game/runtime/visuals/customer";
import { visualRecipeForDish, visualRecipeForDishVariant } from "@/src/game/runtime/visuals/dish";
import { colour } from "@/src/game/runtime/visuals/palette";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";
import { crew_figure_for_index } from "@/src/game/runtime/visuals/crew";
import { visualRecipeForStallVendor } from "@/src/game/runtime/visuals/vendor";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "@/src/game/runtime/world";

interface Options {
  readonly kind: string;
  readonly out: string;
  readonly id?: string;
  readonly category?: string;
  readonly scale: number;
  readonly frame: PaintFrame;
  readonly variants: boolean;
  readonly rotations: readonly Rotation[];
  readonly layer: StallLayer;
  readonly count: number;
}

/** A labelled item of a contact sheet. */
interface SheetItem {
  readonly label: string;
  readonly spec: PaintSpec;
}

/**
 * Parses the command line.
 *
 * @param argv - The arguments after the script path.
 * @returns The options.
 */
function parse_options(argv: readonly string[]): Options {
  const read = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    kind: read("--kind") ?? "stalls",
    out: read("--out") ?? "scratch/gallery.png",
    id: read("--id"),
    category: read("--category"),
    scale: Number(read("--scale") ?? 2),
    frame: { isHighContrast: argv.includes("--hc"), isLowDetail: argv.includes("--low") },
    variants: argv.includes("--variants"),
    rotations: argv.includes("--rotations")
      ? [0, 90, 180, 270]
      : [Number(read("--rotation") ?? 0) as Rotation],
    layer: (read("--layer") ?? "full") as StallLayer,
    count: Number(read("--count") ?? 2),
  };
}

/**
 * Builds the stall spec of a stall content definition.
 *
 * @param stall - The stall definition.
 * @param frame - The paint frame.
 * @param isOpen - Whether to paint the open or the shuttered state.
 * @param rotation - The placement rotation.
 * @param layer - The layer to paint.
 * @returns The spec.
 */
function stall_spec(
  stall: (typeof STALLS)[number],
  frame: PaintFrame,
  isOpen: boolean,
  rotation: Rotation,
  layer: StallLayer,
): StallPaintSpec {
  const size = rotated_size(
    stall.footprint.width * TILE_SIZE,
    stall.footprint.height * TILE_SIZE,
    rotation,
  );
  return {
    kind: "stall",
    definitionId: stall.id,
    name: localize_key(stall.nameKey),
    primary: colour(stall.visual.palette[0] ?? "#6b877c", 0x6b877c),
    secondary: colour(stall.visual.palette[1] ?? "#f3e0b4", 0xf3e0b4),
    accent: colour(stall.visual.palette[2] ?? "#d56d50", 0xd56d50),
    signShape: stall.visual.signShape,
    art: resolve_stall_art(stall.id),
    rotation,
    layer,
    width: size.width,
    height: size.height,
    isOpen,
    frame,
  };
}

/**
 * Lists the items of a sheet for the requested kind.
 *
 * @param options - The parsed options.
 * @returns The labelled specs.
 */
function list_items(options: Options): SheetItem[] {
  const { frame } = options;
  const matches = (id: string) => !options.id || id === options.id;
  switch (options.kind) {
    case "stalls":
      return STALLS.filter((stall) => matches(stall.id)).flatMap((stall) =>
        options.rotations.flatMap((rotation) => {
          const suffix = options.rotations.length > 1 ? ` r${rotation}` : "";
          const name = `${localize_key(stall.nameKey)}${suffix}`;
          const detail = options.id
            ? [
                {
                  label: `${name} closed`,
                  spec: stall_spec(stall, frame, false, rotation, "full"),
                },
                { label: `${name} back`, spec: stall_spec(stall, frame, true, rotation, "back") },
                { label: `${name} front`, spec: stall_spec(stall, frame, true, rotation, "front") },
              ]
            : [];
          return [
            { label: name, spec: stall_spec(stall, frame, true, rotation, options.layer) },
            ...detail,
          ];
        }),
      );
    case "placeables":
      return PLACEABLES.filter(
        (item) => matches(item.id) && (!options.category || item.category === options.category),
      ).flatMap((item) =>
        options.rotations.map((rotation) => {
          const size = rotated_size(
            item.footprint.width * TILE_SIZE,
            item.footprint.height * TILE_SIZE,
            rotation,
          );
          const suffix = options.rotations.length > 1 ? ` r${rotation}` : "";
          return {
            label: `${localize_key(item.nameKey)}${suffix}`,
            spec: {
              kind: "placeable" as const,
              definitionId: item.id,
              category: item.category,
              recipe: visualRecipeForPlaceable(item.id, item.category, item.tags),
              tags: item.tags,
              rotation,
              width: size.width,
              height: size.height,
              motion: 0,
              frame,
            },
          };
        }),
      );
    case "dishes":
      return DISHES.filter((dish) => matches(dish.id)).flatMap((dish) => {
        const base: SheetItem = {
          label: localize_key(dish.nameKey),
          spec: {
            kind: "dish",
            dishId: dish.id,
            recipe: visualRecipeForDish(dish),
            eaten: 0,
            frame,
          },
        };
        if (!options.variants) return [base];
        const family = getNutritionVariantFamily(dish.id);
        return [
          base,
          ...(family?.variants ?? []).map((variant) => ({
            label: `${localize_key(dish.nameKey)} · ${variant.name}`,
            spec: {
              kind: "dish" as const,
              dishId: dish.id,
              recipe: visualRecipeForDishVariant(dish, variant.visualKey),
              eaten: 0 as const,
              frame,
            },
          })),
        ];
      });
    case "customers":
      return CUSTOMER_ARCHETYPES.filter((archetype) => matches(archetype.id)).flatMap(
        (archetype, index) =>
          Array.from({ length: options.count }, (_, copy) => {
            const recipe = visualRecipeForCustomer(archetype);
            const guestId = `gallery-${archetype.id}-${copy}`;
            const appearance = customerAppearanceForId(guestId);
            const figure = customer_figure_for_id(guestId);
            const body = `s${figure.stature} b${figure.build} ${figure.legwear}`;
            return {
              label: `${archetype.id.replace("customer.", "")} #${copy + 1} (${body})`,
              spec: {
                kind: "customer" as const,
                silhouette: recipe.outfitSilhouette,
                pattern: recipe.garmentPattern,
                accessory: (index + copy) % 3 === 2 ? ("none" as const) : recipe.accessory,
                skin: appearance.skin,
                clothing: appearance.clothing,
                accent: appearance.accent,
                ...figure,
                frame,
              },
            };
          }),
      );
    case "vendors":
      return STALLS.filter((stall) => matches(stall.id)).map((stall) => ({
        label: localize_key(stall.nameKey),
        spec: { kind: "vendor", recipe: visualRecipeForStallVendor(stall), frame },
      }));
    case "crew":
      return Array.from({ length: options.count }, (_, index) => ({
        label: `crew #${index + 1}`,
        spec: { kind: "crew", ...crew_figure_for_index(index), frame },
      }));
    case "effects":
      return EFFECT_KINDS.map((effect) => ({
        label: effect,
        spec: { kind: "effect", effect, frame },
      }));
    case "floor": {
      const map = createGridMap(MAP_WIDTH + 4, MAP_HEIGHT + 2, { tileSize: TILE_SIZE });
      const tiles = [...map.tiles];
      for (let x = 0; x < map.width; x += 1) {
        tiles[x] = "wall";
        tiles[(map.height - 1) * map.width + x] = "wall";
      }
      for (let y = 0; y < map.height; y += 1) {
        tiles[y * map.width] = "wall";
        tiles[y * map.width + map.width - 1] = "wall";
      }
      return [
        {
          label: "floor",
          spec: {
            kind: "floor",
            map: { ...map, tiles },
            accessPoints: [
              { id: "entrance-1", kind: "entrance", position: { x: 0, y: 7 } },
              { id: "exit-1", kind: "exit", position: { x: map.width - 1, y: 7 } },
              { id: "entrance-2", kind: "entrance", position: { x: 10, y: map.height - 1 } },
            ],
            routeGuidePoints: [
              { x: 3, y: 7 },
              { x: 4, y: 7 },
              { x: 5, y: 7 },
            ],
            baseWidth: MAP_WIDTH,
            baseHeight: MAP_HEIGHT,
            frame,
          },
        },
      ];
    }
    default:
      throw new Error(`Unknown kind ${options.kind}`);
  }
}

/**
 * Paints the items into one contact sheet and writes it as a PNG.
 *
 * @param items - The labelled specs.
 * @param options - The parsed options.
 */
function write_sheet(items: readonly SheetItem[], options: Options): void {
  const plans = items.map((item) => ({ item, plan: plan_texture(item.spec) }));
  const scale = options.id ? Math.max(options.scale, 4) : options.scale;
  const padding = 12;
  const labelHeight = 16;
  const columns =
    options.kind === "floor" || options.id
      ? 1
      : Math.min(plans.length, ["customers", "vendors", "crew"].includes(options.kind) ? 2 : 6);
  const cellWidth = Math.max(...plans.map(({ plan }) => plan.width)) + padding * 2;
  const cellHeight = Math.max(...plans.map(({ plan }) => plan.height)) + padding * 2 + labelHeight;
  const rows = Math.ceil(plans.length / columns);
  const canvas = createCanvas(
    Math.ceil(columns * cellWidth * scale),
    Math.ceil(rows * cellHeight * scale),
  );
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  // A neutral checker shows transparency and the footprint edge.
  for (let y = 0; y < rows * cellHeight; y += 12) {
    for (let x = 0; x < columns * cellWidth; x += 12) {
      ctx.fillStyle = ((x + y) / 12) % 2 === 0 ? "#d9d4c8" : "#cfc9bc";
      ctx.fillRect(x, y, 12, 12);
    }
  }
  plans.forEach(({ item, plan }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const originX = column * cellWidth + padding;
    const originY = row * cellHeight + padding;
    ctx.save();
    ctx.translate(originX, originY);
    // Footprint guide for objects: the texture's overhang strip is left unmarked.
    plan.paint(ctx as unknown as PaintContext);
    ctx.restore();
    ctx.fillStyle = "#263238";
    ctx.font = "600 9px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(item.label, originX, originY + plan.height + 3, cellWidth - padding * 2);
    for (const frame of plan.frames ?? []) {
      ctx.strokeStyle = "rgba(38, 50, 56, 0.25)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(originX + frame.x, originY + frame.y, frame.width, frame.height);
    }
  });
  const target = resolve(options.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, canvas.toBuffer("image/png"));
  process.stdout.write(`${target} (${plans.length} items, ${canvas.width}×${canvas.height})\n`);
}

write_sheet(list_items(parse_options(process.argv.slice(2))), parse_options(process.argv.slice(2)));
