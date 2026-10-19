/**
 * The painter contracts: what each kind of texture is painted from, the texture geometry every
 * kind shares (world pixels per tile, the overhang above a footprint, sprite-sheet frame names)
 * and the deterministic texture keys the renderer caches by.
 *
 * A spec carries everything a painter needs and nothing else, so a painter is a pure function
 * of its spec and two specs with the same key paint the same pixels. The module is a leaf: it
 * imports only types from content, core and the visual recipes.
 */
import type { PlaceableCategory } from "@/src/content";
import type { AccessPoint, GridMap, GridPoint, Rotation } from "@/src/game/core";

import type { CustomerVisualRecipe, LEGWEAR_KINDS } from "../visuals/customer";
import type { DishVisualRecipe } from "../visuals/dish";
import type { PlaceableVisualRecipe } from "../visuals/placeable";
import type { StallVendorRecipe } from "../visuals/vendor";
import type { StallArt } from "../render/art";
import type { Painter } from "./canvas";

/** Presentation settings that change what a painter draws. */
export interface PaintFrame {
  /** Thicker, darker outlines and stronger value separation. */
  readonly isHighContrast: boolean;
  /** Fewer speckles, grain strokes and detail passes (the lower-end quality mode). */
  readonly isLowDetail: boolean;
}

/** The still, high-detail frame most previews paint with. */
export const DEFAULT_PAINT_FRAME: PaintFrame = { isHighContrast: false, isLowDetail: false };

/**
 * World pixels above the footprint's top edge that an object texture may paint into, for roofs,
 * sign posts and lamp shades that rise above the footprint. Object textures are
 * `width × (height + OVERHANG)` with the footprint's top at `y = OVERHANG`.
 */
export const OVERHANG = 16;

/** Side length of one dish texture in world pixels; the sprite is scaled per placement. */
export const DISH_SIZE = 36;

/**
 * World pixels a seat's sitting surface is drawn above its tile centre. Seat painters centre the
 * sitting surface at `(tile centre x, tile centre y - SEAT_HEIGHT)`, and the people painters put a
 * sitter's hips at `PERSON_FEET_Y - SEAT_HEIGHT` in the sit frames, so a seated guest drawn at the
 * tile centre sits on the seat.
 */
export const SEAT_HEIGHT = 8;

/**
 * World pixels a table's top surface is lifted above its footprint: the top surface is the
 * footprint rectangle moved up by this much, and the table's front face and legs fill the strip
 * below it. The world view lifts plates on a table by the same amount.
 */
export const TABLE_TOP_LIFT = 12;

/** Width of one person frame in world pixels. */
export const PERSON_FRAME_WIDTH = 48;
/** Height of one person frame in world pixels (room for hats above the tile). */
export const PERSON_FRAME_HEIGHT = 60;
/** World y of a person's feet inside a frame (the tile centre maps here). */
export const PERSON_FEET_Y = 46;

/** The four cardinal facings a person can have. */
export const FACINGS = ["south", "north", "east", "west"] as const;
export type Facing = (typeof FACINGS)[number];

/**
 * The person sheet rows, in order. West is not painted: the renderer draws the east frame
 * mirrored, which keeps a sheet at three rows of texture memory.
 */
export const SHEET_FACINGS = ["south", "north", "east"] as const;
export type SheetFacing = (typeof SHEET_FACINGS)[number];

/** The customer sheet columns, in sheet column order. */
export const CUSTOMER_POSES = [
  "stand",
  "walk0",
  "walk1",
  "walk2",
  "sit",
  "carry",
  "carry-walk0",
  "carry-walk1",
  "carry-walk2",
] as const;
export type CustomerPose = (typeof CUSTOMER_POSES)[number];

/** The vendor sheet columns, in column order; the rows are {@link SHEET_FACINGS}. */
export const VENDOR_POSES = [
  "idle0",
  "idle1",
  "order0",
  "order1",
  "prepare0",
  "prepare1",
  "prepare2",
  "prepare3",
] as const;
export type VendorPose = (typeof VENDOR_POSES)[number];

/**
 * The table-cleaning crew sheet columns, in column order: the guest's stand, walk and tray
 * carries, plus two frames of wiping a table top.
 */
export const CREW_POSES = [
  "stand",
  "walk0",
  "walk1",
  "walk2",
  "carry",
  "carry-walk0",
  "carry-walk1",
  "carry-walk2",
  "wipe0",
  "wipe1",
] as const;
export type CrewPose = (typeof CREW_POSES)[number];

/** Side length of one effect texture in world pixels. */
export const EFFECT_SIZE = 64;

/** The effect textures, each painted once and tinted or scaled by the renderer. */
export const EFFECT_KINDS = [
  "steam",
  "light-pool",
  "sparkle",
  "selection-ring",
  "queue-marker",
  "seat-marker",
  "tray",
  "indicator-question",
  "indicator-footsteps",
  "indicator-queue",
  "indicator-order",
  "indicator-clock",
  "indicator-seat",
  "indicator-meal",
  "indicator-return",
  "indicator-exit",
  "patience-arc",
  "left-tray",
  "writer-plaque",
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

/**
 * A non-stall placed object: one texture per definition, rotation, detail frame and motion frame.
 *
 * Textures are painted per rotation and the sprite is never rotated, so the key light stays in
 * the north-west and front faces stay to the south whichever way an object is turned. A painter
 * either treats the object as rotationally symmetric or paints it in its rotated orientation.
 */
export interface PlaceablePaintSpec {
  readonly kind: "placeable";
  readonly definitionId: string;
  readonly category: PlaceableCategory;
  readonly recipe: PlaceableVisualRecipe;
  readonly tags: readonly string[];
  /** The placement rotation, clockwise; 0 is the content's authored orientation. */
  readonly rotation: Rotation;
  /** Footprint width in world pixels, after rotation. */
  readonly width: number;
  /** Footprint height in world pixels, after rotation. */
  readonly height: number;
  /** Motion frame for objects that move, such as fan blades; 0 for still objects. */
  readonly motion: number;
  readonly frame: PaintFrame;
}

/**
 * One layer of a stall: everything behind the vendor (`back`), everything in front of the vendor
 * (`front`: the counter, its front face and whatever else must hide the vendor's legs), or both
 * composited (`full`, for previews and the placement ghost).
 */
export type StallLayer = "back" | "front" | "full";

/** A stall: one texture per stall, rotation, layer, open state and detail frame. */
export interface StallPaintSpec {
  readonly kind: "stall";
  readonly definitionId: string;
  /** The stall's display name, baked into its signboard. */
  readonly name: string;
  readonly primary: number;
  readonly secondary: number;
  readonly accent: number;
  readonly signShape: "awning" | "lightbox" | "painted-board" | "tile-panel";
  readonly art: StallArt;
  /**
   * The placement rotation, clockwise. The authored stalls serve to the south at 0, so 90 serves
   * to the west, 180 to the north and 270 to the east.
   */
  readonly rotation: Rotation;
  /** Which layer this texture holds. */
  readonly layer: StallLayer;
  /** Footprint width in world pixels, after rotation. */
  readonly width: number;
  /** Footprint height in world pixels, after rotation. */
  readonly height: number;
  readonly isOpen: boolean;
  readonly frame: PaintFrame;
}

/** Where a stall's live children sit, in texture pixels (footprint top at `OVERHANG`). */
export interface StallLayout {
  /** Centre of the vendor's feet, the vendor's draw scale and the way the vendor faces. */
  readonly vendor: {
    readonly x: number;
    readonly y: number;
    readonly scale: number;
    readonly facing: Facing;
  };
  /** Centres of the counter slots dishes are displayed in, left to right. */
  readonly dishSlots: readonly { readonly x: number; readonly y: number }[];
  /** Draw scale of a dish on the counter. */
  readonly dishScale: number;
  /** Where steam rises from while the vendor prepares food. */
  readonly steamSource: { readonly x: number; readonly y: number };
  /** Centre of the queue-count badge. */
  readonly badge: { readonly x: number; readonly y: number };
  /** Centre of the sign's warm glow; absent when the sign is not lit. */
  readonly signGlow?: { readonly x: number; readonly y: number; readonly radius: number };
}

/** A customer sprite sheet: one texture per appearance, not per customer. */
export interface CustomerPaintSpec {
  readonly kind: "customer";
  readonly silhouette: CustomerVisualRecipe["outfitSilhouette"];
  readonly pattern: CustomerVisualRecipe["garmentPattern"];
  /** The carried prop, or `none` when this customer rolled no accessory. */
  readonly accessory: CustomerVisualRecipe["accessory"] | "none";
  readonly skin: number;
  readonly clothing: number;
  readonly accent: number;
  readonly hair: number;
  /** Hair shape index, 0 to 5. */
  readonly hairStyle: number;
  /** Height class: 0 short, 1 average, 2 tall. */
  readonly stature: 0 | 1 | 2;
  /** Build class: 0 slim, 1 average, 2 broad. */
  readonly build: 0 | 1 | 2;
  /** What the guest wears below the waist. */
  readonly legwear: Legwear;
  readonly legwearColour: number;
  readonly shoeColour: number;
  readonly frame: PaintFrame;
}

/** The lower garments a guest can wear (`LEGWEAR_KINDS` in the customer recipes). */
export type Legwear = (typeof LEGWEAR_KINDS)[number];

/** A stall vendor sprite sheet: one texture per stall. */
export interface VendorPaintSpec {
  readonly kind: "vendor";
  readonly recipe: StallVendorRecipe;
  readonly frame: PaintFrame;
}

/**
 * A table-cleaning crew sprite sheet: one texture per crew figure. Every member wears the same
 * uniform; only the body, skin and hair vary.
 */
export interface CrewPaintSpec {
  readonly kind: "crew";
  readonly skin: number;
  readonly hair: number;
  /** Hair shape index, 0 to 5. */
  readonly hairStyle: number;
  /** Height class: 0 short, 1 average, 2 tall. */
  readonly stature: 0 | 1 | 2;
  /** Build class: 0 slim, 1 average, 2 broad. */
  readonly build: 0 | 1 | 2;
  readonly frame: PaintFrame;
}

/** A dish serving: one texture per dish, variant, eaten third and detail frame. */
export interface DishPaintSpec {
  readonly kind: "dish";
  readonly dishId: string;
  /** The variant-aware recipe (`visualRecipeForDishVariant`). */
  readonly recipe: DishVisualRecipe;
  /** How much of the serving is gone: 0 full, 1 a third eaten, 2 two-thirds eaten. */
  readonly eaten: 0 | 1 | 2;
  readonly frame: PaintFrame;
}

/** The hall floor: one texture per map, access-point set, route-guide set and detail frame. */
export interface FloorPaintSpec {
  readonly kind: "floor";
  readonly map: GridMap;
  readonly accessPoints: readonly AccessPoint[];
  readonly routeGuidePoints: readonly GridPoint[];
  /** Width of the launch map in tiles; tiles beyond are expansion bays. */
  readonly baseWidth: number;
  /** Height of the launch map in tiles. */
  readonly baseHeight: number;
  readonly frame: PaintFrame;
}

/** A tintable effect sprite. */
export interface EffectPaintSpec {
  readonly kind: "effect";
  readonly effect: EffectKind;
  readonly frame: PaintFrame;
}

export type PaintSpec =
  | PlaceablePaintSpec
  | StallPaintSpec
  | CustomerPaintSpec
  | VendorPaintSpec
  | CrewPaintSpec
  | DishPaintSpec
  | FloorPaintSpec
  | EffectPaintSpec;

/** A named frame inside a painted sheet, in texture pixels (unscaled). */
export interface SheetFrame {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What a painter returns for a spec: the texture size, the painter and any sheet frames. */
export interface PaintPlan {
  readonly width: number;
  readonly height: number;
  readonly paint: Painter;
  readonly frames?: readonly SheetFrame[];
}

/** Margin of floor painted around the map, in world pixels. */
export const FLOOR_MARGIN = 96;

/**
 * Encodes a paint frame for a texture key.
 *
 * @param frame - The paint frame.
 * @returns A short suffix such as `hc1d0`.
 */
function frame_key(frame: PaintFrame): string {
  return `hc${frame.isHighContrast ? 1 : 0}d${frame.isLowDetail ? 1 : 0}`;
}

/**
 * Builds the cache key of a spec. Two specs with the same key paint the same texture.
 *
 * @param spec - The paint spec.
 * @returns The key.
 */
export function texture_key(spec: PaintSpec): string {
  switch (spec.kind) {
    case "placeable":
      return `placeable:${spec.definitionId}:r${spec.rotation}:${spec.width}x${spec.height}:m${spec.motion}:${frame_key(spec.frame)}`;
    case "stall":
      return `stall:${spec.definitionId}:r${spec.rotation}:${spec.layer}:${spec.width}x${spec.height}:${spec.isOpen ? "open" : "closed"}:${frame_key(spec.frame)}`;
    case "customer":
      return [
        "customer",
        spec.silhouette,
        spec.pattern,
        spec.accessory,
        spec.skin.toString(16),
        spec.clothing.toString(16),
        spec.accent.toString(16),
        spec.hair.toString(16),
        spec.hairStyle,
        `s${spec.stature}b${spec.build}`,
        spec.legwear,
        spec.legwearColour.toString(16),
        spec.shoeColour.toString(16),
        frame_key(spec.frame),
      ].join(":");
    case "vendor":
      return `vendor:${spec.recipe.stallId}:${frame_key(spec.frame)}`;
    case "crew":
      return [
        "crew",
        spec.skin.toString(16),
        spec.hair.toString(16),
        spec.hairStyle,
        `s${spec.stature}b${spec.build}`,
        frame_key(spec.frame),
      ].join(":");
    case "dish":
      return `dish:${spec.dishId}:${spec.recipe.variantVisualKey ?? "base"}:e${spec.eaten}:${frame_key(spec.frame)}`;
    case "floor": {
      const access = spec.accessPoints
        .map((point) => `${point.kind[0]}${point.position.x},${point.position.y}`)
        .join("|");
      const guides = spec.routeGuidePoints.map((point) => `${point.x},${point.y}`).join("|");
      return `floor:${spec.map.width}x${spec.map.height}:${access}:${guides}:${frame_key(spec.frame)}`;
    }
    case "effect":
      return `effect:${spec.effect}:${frame_key(spec.frame)}`;
  }
}

/**
 * Names a frame of a person sheet.
 *
 * @param facing - The sheet row.
 * @param pose - The pose column.
 * @returns The frame name, such as `south/walk1`.
 */
export function person_frame_name(facing: SheetFacing, pose: string): string {
  return `${facing}/${pose}`;
}

/**
 * Resolves the sheet frame a person is drawn with: west uses the east frame mirrored.
 *
 * @param facing - The facing.
 * @param pose - The pose column.
 * @returns The frame name and whether the sprite is flipped horizontally.
 */
export function person_frame(facing: Facing, pose: string): { frame: string; isFlipped: boolean } {
  return facing === "west"
    ? { frame: person_frame_name("east", pose), isFlipped: true }
    : { frame: person_frame_name(facing, pose), isFlipped: false };
}

/**
 * Resolves the facing a mover is drawn with from its step direction.
 *
 * @param directionX - Sign of the horizontal step, or 0.
 * @param directionY - Sign of the vertical step, or 0.
 * @param fallback - The facing kept when the mover is still.
 * @returns The facing.
 */
export function facing_for_direction(
  directionX: number,
  directionY: number,
  fallback: Facing = "south",
): Facing {
  if (directionX > 0) return "east";
  if (directionX < 0) return "west";
  if (directionY < 0) return "north";
  if (directionY > 0) return "south";
  return fallback;
}

/**
 * Gives the footprint size after a rotation.
 *
 * @param width - Unrotated footprint width.
 * @param height - Unrotated footprint height.
 * @param rotation - The placement rotation.
 * @returns The rotated width and height.
 */
export function rotated_size(
  width: number,
  height: number,
  rotation: Rotation,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}
