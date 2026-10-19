/**
 * The world view: the retained sprites of the hall, diffed against each render context. It
 * keeps the floor texture, one sprite per placed object (plus the back and front layers, vendor,
 * counter dishes and steam of each stall, and its Writer's Pick plaque), one sprite per guest (plus
 * their tray, meal and status bubble), the trays guests left on seats, the lamp light pools, the
 * sale sparkles and the time-of-day tint, and destroys whatever the latest snapshot no longer
 * holds.
 *
 * Textures come from the {@link TextureStudio}; the view only decides which texture, frame,
 * position, depth, tint and alpha each sprite has this render. Object textures are painted per
 * rotation and never rotated here, so their light and front faces stay consistent. Phaser is
 * imported as a type only and reached through the scene factories the view is given.
 */
import type Phaser from "phaser";

import { CUSTOMER_ARCHETYPES, DISH_BY_ID, PLACEABLE_BY_ID, STALL_BY_ID } from "@/src/content";
import {
  getSeatLocations,
  getUtilityInfluence,
  mealConsumptionFraction,
  type PlacedObject,
  type Rotation,
} from "@/src/game/core";

import { FAN_MOTION_FRAMES, is_overhead } from "../art/furniture";
import { has_backrest } from "../art/furniture/seats";
import type { Box } from "../art/furniture/shared";
import { table_top, type TableTop } from "../art/furniture/tables";
import { tray_anchor } from "../art/people";
import {
  EFFECT_SIZE,
  FLOOR_MARGIN,
  OVERHANG,
  PERSON_FEET_Y,
  PERSON_FRAME_HEIGHT,
  facing_for_direction,
  person_frame,
  rotated_size,
  type CustomerPaintSpec,
  type CustomerPose,
  type DishPaintSpec,
  type EffectKind,
  type Facing,
  type PaintFrame,
  type PlaceablePaintSpec,
  type StallLayer,
  type StallPaintSpec,
} from "../art/specs";
import { stall_layout } from "../art/stalls";
import { nutritionVisualKeyForVariant } from "../nutrition";
import {
  animationPoseForCustomer,
  customerAppearanceForId,
  customer_figure_for_id,
  visualRecipeForCustomer,
} from "../visuals/customer";
import { visualRecipeForDishVariant } from "../visuals/dish";
import { colour as parse_palette_colour, stableVisualHash } from "../visuals/palette";
import { visualRecipeForPlaceable } from "../visuals/placeable";
import { visualRecipeForStallVendor } from "../visuals/vendor";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "../world";
import { resolve_placeable_style, resolve_stall_art } from "./art";
import { daylight_tint, lamp_pulse, lamp_strength } from "./atmosphere";
import type { ObjectVisualBounds, RenderContext } from "./context";
import {
  boundsForObject,
  DEPTH_EFFECTS,
  DEPTH_FLOOR,
  DEPTH_INDICATORS,
  DEPTH_LIGHT_POOLS,
  DEPTH_OVERHEAD,
  DEPTH_TINT,
  DEPTH_WORLD,
  depth_for,
  renderedCustomerPosition,
} from "./geometry";
import type { LabelPool } from "./labels";
import { SlotMap, type ImageFactory } from "./sprites";
import { displayDishIdsForStall, stallServiceVisualState } from "./stall";
import { LOWER_END_PIXEL_RATIO, STANDARD_PIXEL_RATIO, type TextureStudio } from "./textures";

/** The scene factories the world view uses. */
export interface WorldSceneSurface {
  readonly add: {
    image: ImageFactory;
    graphics(): Phaser.GameObjects.Graphics;
  };
}

/** Walk frames advance every this many ticks (10 Hz ticks, so five frames a second). */
const WALK_TICKS_PER_FRAME = 2;
/** Vendor idle frames alternate every this many ticks. */
const VENDOR_IDLE_TICKS = 6;
/** Vendor prepare frames advance every this many ticks. */
const VENDOR_PREPARE_TICKS = 2;
/** Number of steam puffs in a stall's plume. */
const STEAM_PUFFS = 3;
/** Ticks a steam puff takes to rise and fade. */
const STEAM_CYCLE_TICKS = 18;
/** Draw scale of the Writer's Pick plaque on a stall: about 13 px wide. */
const WRITER_PLAQUE_SCALE = 0.5;
/** How far above the queue badge the plaque hangs, in world pixels. */
const WRITER_PLAQUE_LIFT = 14;
/** How far up a left tray sits on a seat without a table, in world pixels. */
const SEAT_TRAY_LIFT = 6;
/** Ticks a sale sparkle stays on screen. */
const SPARKLE_TICKS = 10;
/** Most sale sparkles tracked at once. */
const MAX_SPARKLES = 16;
/** The warm tint of lamp pools and sign glows. */
const LAMP_TINT = 0xffd98a;
/** Tray sprite scale while carried: about shoulder width, matching the tray on a table. */
const CARRIED_TRAY_SCALE = 0.42;
/** Dish sprite scale on a carried tray, the same size as on a table. */
const TRAY_DISH_SCALE = 0.48;
/** Dish sprite scale on a table: a plate about 17 px across, on a 1 m (48 px) table. */
const TABLE_DISH_SCALE = 0.48;
/** Tray sprite scale on a table: the tray is 44 px of its texture, so about 18.5 px wide. */
const TABLE_TRAY_SCALE = 0.42;
/** Status bubble scale. */
const INDICATOR_SCALE = 0.5;
/**
 * Half the width of a diner's meal on a table top (the tray at {@link TABLE_TRAY_SCALE} with the
 * plate on it), in world pixels.
 */
export const MEAL_HALF_WIDTH = 9.3;
/** Half the depth of a diner's meal on a table top, in world pixels. */
export const MEAL_HALF_DEPTH = 7.5;
/** How far inside the edge nearest the diner a meal is centred, in world pixels. */
const MEAL_INSET = 10;
/** The gap kept between a meal and the edge of its table top, in world pixels. */
const MEAL_EDGE_MARGIN = 0.5;
/**
 * How far a meal on a rectangular top sits to its diner's left, in world pixels. Every meal
 * turning the same way makes a pinwheel, so meals of diners on neighbouring sides of a small
 * table, or facing each other across a narrow ledge, stay apart.
 */
const MEAL_SIDE_STEP = 9.75;
/**
 * Shares of a round top's free width and depth a meal may slide along towards a diner sitting
 * off its middle. The narrow ends of an ellipse leave less room, so these keep the meals of up
 * to eight diners around a round table apart.
 */
const ROUND_MEAL_SLIDE = { x: 0.3, y: 0.5 } as const;
/** How far a table may be from a diner's seat for the meal to go on it, in world pixels. */
const MEAL_TABLE_REACH = TILE_SIZE * 1.6;
/**
 * Ticks a customer sheet may go unused before its texture is released (ten seconds of
 * simulation), so guests who left do not hold texture memory.
 */
const CUSTOMER_SHEET_LINGER_TICKS = 100;
/** Depth steps between the layers of one stall, all below anything standing south of it. */
const STALL_LAYER_STEP = 0.00001;

const CUSTOMER_BY_ID = new Map(CUSTOMER_ARCHETYPES.map((archetype) => [archetype.id, archetype]));
const CUSTOMER_VISUAL_BY_ID = new Map(
  CUSTOMER_ARCHETYPES.map((archetype) => [archetype.id, visualRecipeForCustomer(archetype)]),
);

/** A sale sparkle in flight. */
interface Sparkle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly tick: number;
  readonly amount: number;
}

/** Where a diner's meal is drawn and the depth band it sorts in. */
interface MealAnchor {
  /** World x of the plate's centre. */
  readonly x: number;
  /** World y of the plate's centre, lifted onto the table top. */
  readonly y: number;
  /** World y the plate sorts by: just in front of the table it sits on. */
  readonly sortY: number;
  /** World x of the point of the table nearest the diner, which the diner faces. */
  readonly faceX: number;
  /** World y of the point of the table nearest the diner, which the diner faces. */
  readonly faceY: number;
}

/**
 * Clamps a value into a range around zero.
 *
 * @param value - The value.
 * @param limit - The largest distance from zero allowed; a negative limit counts as zero.
 * @returns The clamped value.
 */
function clamp_symmetric(value: number, limit: number): number {
  const bound = Math.max(0, limit);
  return Math.max(-bound, Math.min(bound, value));
}

/**
 * Places a diner's meal on a table top, on the floor: in front of the diner, {@link MEAL_INSET}
 * inside the edge they face, and always far enough inside the top for the whole meal to sit on
 * it. Along a rectangular top's edge the meals keep the diners' spacing, scaled down when the
 * top is shorter than the footprint, and each moves {@link MEAL_SIDE_STEP} to its diner's left;
 * on a round top a meal slides only part of the way towards a diner sitting off its middle.
 *
 * @param top - The table top, in world pixels.
 * @param bounds - The table's footprint, which the diners are seated around.
 * @param dinerX - World x of the diner.
 * @param dinerY - World y of the diner.
 * @param isBeside - True when the diner sits west or east of the table and faces across it.
 * @returns The floor point under the meal's centre.
 */
function place_meal_on_top(
  top: TableTop,
  bounds: ObjectVisualBounds,
  dinerX: number,
  dinerY: number,
  isBeside: boolean,
): { x: number; y: number } {
  // `along` runs parallel to the edge the diner faces; `depth` runs from the top's centre
  // towards the diner.
  const side = isBeside
    ? Math.sign(dinerX - top.centreX) || 1
    : Math.sign(dinerY - top.centreY) || 1;
  const alongHalf = isBeside ? top.halfDepth : top.halfWidth;
  const depthHalf = isBeside ? top.halfWidth : top.halfDepth;
  const alongReach = alongHalf - (isBeside ? MEAL_HALF_DEPTH : MEAL_HALF_WIDTH) - MEAL_EDGE_MARGIN;
  const depthReach = depthHalf - (isBeside ? MEAL_HALF_WIDTH : MEAL_HALF_DEPTH) - MEAL_EDGE_MARGIN;
  const dinerAlong = isBeside ? dinerY - top.centreY : dinerX - top.centreX;
  let along: number;
  let depth: number;
  if (top.shape === "rect") {
    // A diner facing south has their left to the east; one facing west has it to the south.
    const left = (isBeside ? side : -side) * MEAL_SIDE_STEP;
    const span = (isBeside ? bounds.height : bounds.width) / 2 - TILE_SIZE / 2;
    const scale = span > 0 ? Math.min(1, Math.max(0, alongReach - MEAL_SIDE_STEP) / span) : 1;
    along = clamp_symmetric(dinerAlong * scale + left, alongReach);
    depth = clamp_symmetric(depthHalf - MEAL_INSET, depthReach);
  } else {
    along = clamp_symmetric(
      dinerAlong,
      alongReach * (isBeside ? ROUND_MEAL_SLIDE.y : ROUND_MEAL_SLIDE.x),
    );
    const edge = depthHalf * Math.sqrt(Math.max(0, 1 - (along / alongHalf) ** 2));
    depth = edge - MEAL_INSET;
    // Pull the meal in until all of it is on the ellipse.
    const spread =
      (along / Math.max(0.1, alongReach)) ** 2 + (depth / Math.max(0.1, depthReach)) ** 2;
    if (spread > 1) {
      along /= Math.sqrt(spread);
      depth /= Math.sqrt(spread);
    }
  }
  return isBeside
    ? { x: top.centreX + side * depth, y: top.centreY + along }
    : { x: top.centreX + along, y: top.centreY + side * depth };
}

/**
 * Finds where a seated customer's meal goes: on the top of the nearest table within reach, in
 * front of the diner just inside the edge they face and lifted to the top's own height, or on the
 * diner's lap when no table is close enough. The top's shape and height come from the table
 * painter's {@link table_top}, so the meal lands on the painted top.
 *
 * @param context - The render context; its snapshot objects, visuals and catalog locate tables.
 * @param customerX - World x of the customer (the seat tile's centre).
 * @param customerY - World y of the customer (the seat tile's centre).
 * @returns The plate position, its sort line and the point the diner faces.
 */
export function nearest_table_meal_anchor(
  context: Pick<RenderContext, "snapshot" | "visuals" | "catalog">,
  customerX: number,
  customerY: number,
): MealAnchor {
  const { snapshot, visuals, catalog } = context;
  let best:
    | {
        object: PlacedObject;
        bounds: ObjectVisualBounds;
        closestX: number;
        closestY: number;
        distance: number;
      }
    | undefined;
  for (const object of snapshot.objects) {
    if (visuals[object.definitionId]?.category !== "table") continue;
    const bounds = boundsForObject(object, catalog);
    if (!bounds) continue;
    // The distance from the diner to the nearest point of the table's footprint.
    const closestX = Math.max(bounds.minX, Math.min(bounds.maxX, customerX));
    const closestY = Math.max(bounds.minY, Math.min(bounds.maxY, customerY));
    const distance = Math.hypot(closestX - customerX, closestY - customerY);
    if (distance > MEAL_TABLE_REACH || (best && distance >= best.distance)) continue;
    best = { object, bounds, closestX, closestY, distance };
  }
  if (!best) {
    return {
      x: customerX,
      y: customerY - 10,
      sortY: customerY + TILE_SIZE / 2 + 1,
      faceX: customerX,
      faceY: customerY + 1,
    };
  }
  const { object, bounds, closestX, closestY } = best;
  // The diner faces the nearest point of the table along the longer axis, as the world view
  // turns them, so a diner at the end of a long side still faces across the table.
  const isBeside = Math.abs(closestX - customerX) > Math.abs(closestY - customerY);
  const box: Box = {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    centreX: bounds.centreX,
    centreY: bounds.centreY,
    right: bounds.maxX,
    bottom: bounds.maxY,
  };
  const recipe = visualRecipeForPlaceable(
    object.definitionId,
    "table",
    PLACEABLE_BY_ID.get(object.definitionId)?.tags,
  );
  const top = table_top(box, recipe);
  const meal = place_meal_on_top(top, bounds, customerX, customerY, isBeside);
  return {
    x: meal.x,
    y: meal.y - top.lift,
    sortY: bounds.maxY + 0.5,
    faceX: closestX,
    faceY: closestY,
  };
}

/**
 * Gives the depth a guest sorts at: the bottom of the tile they stand or sit on, so a seat on the
 * same tile is behind them and a table on the next row is in front of them.
 *
 * @param feetY - World y of the guest's feet (the tile centre while still).
 * @returns The depth.
 */
function person_depth(feetY: number): number {
  return depth_for(DEPTH_WORLD, feetY + TILE_SIZE / 2 + 0.5);
}

/**
 * Keeps and diffs the hall's sprites.
 */
export class WorldView {
  private readonly objects: SlotMap;
  private readonly people: SlotMap;
  private readonly effects: SlotMap;
  private readonly tint: Phaser.GameObjects.Graphics;
  private floorKey: string | undefined;
  private tintColour = -1;
  private tintBounds = "";
  private readonly facings = new Map<string, Facing>();
  private readonly sheetLastUsed = new Map<string, number>();
  private sparkles: Sparkle[] = [];
  private lastSparkleTick = -1;

  /**
   * @param scene - The scene's image and graphics factories.
   * @param studio - The texture studio of this scene.
   * @param labels - The scene's label pool, for queue badges and sale amounts.
   */
  constructor(
    scene: WorldSceneSurface,
    private readonly studio: TextureStudio,
    private readonly labels: LabelPool,
  ) {
    this.objects = new SlotMap(scene.add.image);
    this.people = new SlotMap(scene.add.image);
    this.effects = new SlotMap(scene.add.image);
    this.tint = scene.add.graphics();
    this.tint.setDepth(DEPTH_TINT);
    this.tint.setBlendMode("MULTIPLY");
  }

  /**
   * Brings every sprite in line with a render context.
   *
   * @param context - The render context.
   */
  sync(context: RenderContext): void {
    const frame: PaintFrame = {
      isHighContrast: context.frame.isHighContrast,
      isLowDetail: context.frame.qualityMode !== "standard",
    };
    this.studio.set_pixel_ratio(frame.isLowDetail ? LOWER_END_PIXEL_RATIO : STANDARD_PIXEL_RATIO);
    this.sync_floor(context, frame);
    this.sync_objects(context, frame);
    this.sync_people(context, frame);
    this.sync_left_trays(context, frame);
    this.sync_sparkles(context, frame);
    this.sync_tint(context);
    this.objects.sweep();
    this.people.sweep();
    this.effects.sweep();
    this.release_idle_sheets(context.snapshot.tick);
  }

  /** Destroys every sprite and releases the textures. */
  destroy(): void {
    this.objects.destroy();
    this.people.destroy();
    this.effects.destroy();
    this.tint.destroy();
    this.studio.release_all();
  }

  private sync_floor(context: RenderContext, frame: PaintFrame): void {
    const { snapshot } = context;
    const painted = this.studio.ensure({
      kind: "floor",
      map: snapshot.map,
      accessPoints: snapshot.accessPoints,
      routeGuidePoints: snapshot.routeGuidePoints,
      baseWidth: MAP_WIDTH,
      baseHeight: MAP_HEIGHT,
      frame,
    });
    if (this.floorKey && this.floorKey !== painted.key) this.studio.release(this.floorKey);
    this.floorKey = painted.key;
    this.objects.draw("floor", {
      key: painted.key,
      x: -FLOOR_MARGIN,
      y: -FLOOR_MARGIN,
      originX: 0,
      originY: 0,
      scale: painted.scale,
      depth: DEPTH_FLOOR,
    });
  }

  private sync_objects(context: RenderContext, frame: PaintFrame): void {
    const { snapshot, catalog, visuals } = context;
    const tick = snapshot.tick;
    const reduced = context.frame.isReducedMotion;
    const lamps = lamp_strength(snapshot.elapsedMs);
    for (const object of snapshot.objects) {
      const definition = catalog.placeables[object.definitionId];
      const visual = visuals[object.definitionId];
      const bounds = boundsForObject(object, catalog);
      if (!definition || !visual || !bounds) continue;
      if (visual.category === "stall") {
        this.sync_stall(
          context,
          frame,
          object,
          bounds,
          visual.name,
          visual.palette,
          visual.signShape,
        );
        continue;
      }
      const spec = placeable_spec(
        object.definitionId,
        visual.category,
        definition.footprint.width,
        definition.footprint.height,
        object.rotation,
        frame,
      );
      const recipe = spec.recipe;
      let motion = 0;
      if (visual.category === "fan" && !reduced) {
        const style = resolve_placeable_style("fan", recipe);
        if (style !== "column" && style !== "exhaust") {
          motion = Math.floor(tick / (recipe.motif.includes("quiet") ? 2 : 1)) % FAN_MOTION_FRAMES;
        }
      }
      const painted = this.studio.ensure({ ...spec, motion });
      const overhead = is_overhead(recipe, definition.blocksMovement);
      // A seat turned to 180 has its backrest between the camera and its diner, so it sorts
      // just after the person on its tile (people sort at their tile's bottom + 0.5).
      const isBackrestNear =
        visual.category === "seat" && object.rotation === 180 && has_backrest(recipe);
      this.objects.draw(object.id, {
        key: painted.key,
        x: bounds.minX,
        y: bounds.minY - OVERHANG,
        originX: 0,
        originY: 0,
        scale: painted.scale,
        depth: depth_for(
          overhead ? DEPTH_OVERHEAD : DEPTH_WORLD,
          isBackrestNear ? bounds.maxY + 0.75 : bounds.maxY,
        ),
      });
      if (visual.category === "lighting" && !frame.isLowDetail && !frame.isHighContrast) {
        const pool = this.studio.ensure({ kind: "effect", effect: "light-pool", frame });
        const radius =
          Math.max(bounds.width, bounds.height) * (recipe.motif.includes("skylight") ? 1.1 : 1.6);
        this.effects.draw(`${object.id}:pool`, {
          key: pool.key,
          x: bounds.centreX,
          y: bounds.centreY + 6,
          scale: (radius / EFFECT_SIZE) * 2 * pool.scale,
          depth: DEPTH_LIGHT_POOLS,
          alpha: 0.55 * lamps * lamp_pulse(tick, recipe.seed, reduced),
          tint: LAMP_TINT,
          blend: "ADD",
        });
      }
    }
  }

  private sync_stall(
    context: RenderContext,
    frame: PaintFrame,
    object: PlacedObject,
    bounds: ObjectVisualBounds,
    name: string,
    palette: readonly string[],
    signShape: StallPaintSpec["signShape"] | undefined,
  ): void {
    const { snapshot, stallMenus, activeDishVariants, catalog } = context;
    const tick = snapshot.tick;
    const reduced = context.frame.isReducedMotion;
    const footprint = catalog.placeables[object.definitionId]?.footprint;
    if (!footprint) return;
    const layerSpec = (layer: StallLayer) => ({
      ...stall_spec(
        object.definitionId,
        name,
        palette,
        signShape,
        footprint.width,
        footprint.height,
        object.rotation,
        layer,
        frame,
      ),
      isOpen: object.open,
    });
    const backSpec = layerSpec("back");
    const layout = stall_layout(backSpec);
    // Texture pixels map to the world from the texture's top-left corner.
    const place = (point: { x: number; y: number }) => ({
      x: bounds.minX + point.x,
      y: bounds.minY - OVERHANG + point.y,
    });
    const base = depth_for(DEPTH_WORLD, bounds.maxY);
    const depthBack = base - STALL_LAYER_STEP * 4;
    const depthVendor = base - STALL_LAYER_STEP * 3;
    const depthFront = base - STALL_LAYER_STEP * 2;
    const depthDishes = base - STALL_LAYER_STEP;
    for (const [layer, depth] of [
      ["back", depthBack],
      ["front", depthFront],
    ] as const) {
      const painted = this.studio.ensure(layer === "back" ? backSpec : layerSpec("front"));
      this.objects.draw(`${object.id}:${layer}`, {
        key: painted.key,
        x: bounds.minX,
        y: bounds.minY - OVERHANG,
        originX: 0,
        originY: 0,
        scale: painted.scale,
        depth,
      });
    }
    const stall = STALL_BY_ID.get(object.definitionId);
    if (!stall) return;
    const service = stallServiceVisualState(snapshot, object.id);
    if (object.open) {
      // Vendor.
      const vendor = this.studio.ensure({
        kind: "vendor",
        recipe: visualRecipeForStallVendor(stall),
        frame,
      });
      const vendorPose =
        service.activity === "prepare"
          ? `prepare${reduced ? 0 : Math.floor(tick / VENDOR_PREPARE_TICKS) % 4}`
          : service.activity === "order"
            ? `order${reduced ? 0 : Math.floor(tick / 4) % 2}`
            : `idle${reduced ? 0 : Math.floor(tick / VENDOR_IDLE_TICKS) % 2}`;
      const vendorFrame = person_frame(layout.vendor.facing, vendorPose);
      const vendorAt = place(layout.vendor);
      this.objects.draw(`${object.id}:vendor`, {
        key: vendor.key,
        frame: vendorFrame.frame,
        isFlipped: vendorFrame.isFlipped,
        x: vendorAt.x,
        y: vendorAt.y,
        originX: 0.5,
        originY: PERSON_FEET_Y / PERSON_FRAME_HEIGHT,
        scale: layout.vendor.scale * vendor.scale,
        depth: depthVendor,
      });
      // Counter dishes.
      const dishIds = displayDishIdsForStall(
        stall,
        [service.preparingDishId, ...(stallMenus[object.definitionId] ?? [])].filter(
          (dishId): dishId is string => typeof dishId === "string",
        ),
        layout.dishSlots.length,
      );
      dishIds.forEach((dishId, index) => {
        const slot = layout.dishSlots[index];
        if (!slot) return;
        const variantId =
          dishId === service.preparingDishId
            ? service.preparingVariantId
            : activeDishVariants[dishId];
        const paintedDish = this.ensure_dish(dishId, variantId, 0, frame);
        if (!paintedDish) return;
        const at = place(slot);
        this.objects.draw(`${object.id}:dish:${index}`, {
          key: paintedDish.key,
          x: at.x,
          y: at.y,
          scale: layout.dishScale * paintedDish.scale,
          depth: depthDishes,
        });
      });
      // Steam while preparing.
      if (service.activity === "prepare" && !frame.isLowDetail) {
        const steam = this.studio.ensure({ kind: "effect", effect: "steam", frame });
        const source = place(layout.steamSource);
        for (let puff = 0; puff < STEAM_PUFFS; puff += 1) {
          const phase = reduced
            ? (puff + 0.5) / STEAM_PUFFS
            : ((tick + (puff * STEAM_CYCLE_TICKS) / STEAM_PUFFS) % STEAM_CYCLE_TICKS) /
              STEAM_CYCLE_TICKS;
          const drift = Math.sin((phase + puff) * Math.PI * 2) * 4;
          this.effects.draw(`${object.id}:steam:${puff}`, {
            key: steam.key,
            x: source.x + drift,
            y: source.y - phase * 26,
            scale: (0.45 + phase * 0.6) * steam.scale,
            alpha: (1 - phase) * 0.75,
            depth: DEPTH_EFFECTS,
          });
        }
      }
      // Sign glow for lightboxes.
      if (layout.signGlow && !frame.isLowDetail && !frame.isHighContrast) {
        const pool = this.studio.ensure({ kind: "effect", effect: "light-pool", frame });
        const at = place(layout.signGlow);
        this.effects.draw(`${object.id}:sign-glow`, {
          key: pool.key,
          x: at.x,
          y: at.y,
          scale: (layout.signGlow.radius / EFFECT_SIZE) * 2 * pool.scale,
          alpha: 0.35 * lamp_strength(snapshot.elapsedMs),
          tint: LAMP_TINT,
          blend: "ADD",
          depth: DEPTH_EFFECTS,
        });
      }
    }
    // Writer's Pick plaque, beside the queue badge.
    if (context.state.neighbourhood?.writerPickStallIds.includes(object.definitionId)) {
      const plaque = this.studio.ensure({ kind: "effect", effect: "writer-plaque", frame });
      const at = place(layout.badge);
      this.objects.draw(`${object.id}:plaque`, {
        key: plaque.key,
        x: at.x,
        y: at.y - WRITER_PLAQUE_LIFT,
        scale: WRITER_PLAQUE_SCALE * plaque.scale,
        depth: depthDishes,
      });
    }
    // Queue badge.
    const queue = snapshot.queues[object.id] ?? [];
    const capacity = catalog.placeables[object.definitionId]?.stall?.queueCapacity ?? 7;
    const badge = place(layout.badge);
    this.labels.place(
      badge.x,
      badge.y,
      `${queue.length} ${queue.length === 1 ? "guest" : "guests"}`,
      queue.length >= capacity ? "#9a3e31" : "#17352e",
    );
  }

  private ensure_dish(
    dishId: string | undefined,
    variantId: string | undefined,
    eaten: DishPaintSpec["eaten"],
    frame: PaintFrame,
  ) {
    if (!dishId) return undefined;
    const dish = DISH_BY_ID.get(dishId);
    if (!dish) return undefined;
    const spec: DishPaintSpec = {
      kind: "dish",
      dishId,
      recipe: visualRecipeForDishVariant(dish, nutritionVisualKeyForVariant(dishId, variantId)),
      eaten,
      frame,
    };
    return this.studio.ensure(spec);
  }

  private sync_people(context: RenderContext, frame: PaintFrame): void {
    const { snapshot, state, catalog } = context;
    const tick = snapshot.tick;
    const reduced = context.frame.isReducedMotion;
    const seen = new Set<string>();
    for (const customer of snapshot.customers) {
      seen.add(customer.id);
      const archetype = CUSTOMER_BY_ID.get(customer.archetypeId) ?? CUSTOMER_ARCHETYPES[0];
      if (!archetype) continue;
      const visual = CUSTOMER_VISUAL_BY_ID.get(archetype.id) ?? visualRecipeForCustomer(archetype);
      const seed = stableVisualHash(customer.id);
      const appearance = customerAppearanceForId(customer.id);
      const figure = customer_figure_for_id(customer.id);
      const pose = animationPoseForCustomer(customer.status, tick, seed, reduced);
      const position = renderedCustomerPosition(customer, reduced);
      const x = (position.x + 0.5) * TILE_SIZE;
      const feetY = (position.y + 0.5) * TILE_SIZE;
      const y = feetY + pose.bob;
      const next = customer.path[customer.pathIndex];
      const hasAccessory = ((seed >>> 7) % 1_000) / 1_000 < visual.accessoryChance;
      const spec: CustomerPaintSpec = {
        kind: "customer",
        silhouette: visual.outfitSilhouette,
        pattern: visual.garmentPattern,
        accessory: hasAccessory ? visual.accessory : "none",
        skin: appearance.skin,
        clothing: appearance.clothing,
        accent: appearance.accent,
        ...figure,
        frame,
      };
      const sheet = this.studio.ensure(spec);
      this.sheetLastUsed.set(sheet.key, tick);
      const isEating = pose.pose === "eat";
      const meal = isEating ? nearest_table_meal_anchor(context, x, feetY) : undefined;
      let facing: Facing;
      if (next) {
        facing = facing_for_direction(
          Math.sign(next.x - customer.position.x),
          Math.sign(next.y - customer.position.y),
          this.facings.get(customer.id) ?? "south",
        );
      } else if (meal) {
        const dx = meal.faceX - x;
        const dy = meal.faceY - feetY;
        facing = facing_for_direction(
          Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0,
          Math.abs(dx) > Math.abs(dy) ? 0 : Math.sign(dy),
          "south",
        );
      } else {
        facing = this.facings.get(customer.id) ?? "south";
      }
      this.facings.set(customer.id, facing);
      const isMoving = pose.pose === "walk" || pose.pose === "leave";
      const carries = pose.carriesFood || (customer.hasTray && !isEating);
      const walkFrame = reduced ? 1 : Math.floor(((tick + (seed % 6)) / WALK_TICKS_PER_FRAME) % 3);
      let column: CustomerPose;
      if (isEating) column = "sit";
      else if (isMoving)
        column = carries
          ? (`carry-walk${walkFrame}` as CustomerPose)
          : (`walk${walkFrame}` as CustomerPose);
      else column = carries ? "carry" : "stand";
      const sheetFrame = person_frame(facing, column);
      const depth = person_depth(feetY);
      this.people.draw(customer.id, {
        key: sheet.key,
        frame: sheetFrame.frame,
        isFlipped: sheetFrame.isFlipped,
        x,
        y,
        originX: 0.5,
        originY: PERSON_FEET_Y / PERSON_FRAME_HEIGHT,
        scale: sheet.scale,
        depth,
      });
      // Carried tray and food.
      if (carries) {
        const anchor = tray_anchor(facing);
        const tray = this.studio.ensure({ kind: "effect", effect: "tray", frame });
        const trayDepth = depth + (anchor.isBehind ? -0.000001 : 0.000001);
        this.people.draw(`${customer.id}:tray`, {
          key: tray.key,
          x: x + anchor.x,
          y: y + anchor.y,
          scale: CARRIED_TRAY_SCALE * tray.scale,
          depth: trayDepth,
        });
        if (pose.carriesFood) {
          const dish = this.ensure_dish(
            customer.orderedDishId,
            customer.orderedNutritionVariantId,
            0,
            frame,
          );
          if (dish) {
            this.people.draw(`${customer.id}:dish`, {
              key: dish.key,
              x: x + anchor.x,
              y: y + anchor.y - 1,
              scale: TRAY_DISH_SCALE * dish.scale,
              depth: trayDepth + 0.0000001,
            });
          }
        }
      }
      // Meal on the table top.
      if (isEating && meal) {
        const dishDefinition = customer.orderedDishId
          ? catalog.dishes[customer.orderedDishId]
          : undefined;
        const influence = getUtilityInfluence(state.objects, catalog, customer.position);
        const eatenFraction = dishDefinition
          ? mealConsumptionFraction(
              customer.stateElapsedMs,
              dishDefinition.eatingMs,
              influence.eatingSpeed,
            )
          : 0;
        const eaten = (
          eatenFraction >= 0.66 ? 2 : eatenFraction >= 0.33 ? 1 : 0
        ) as DishPaintSpec["eaten"];
        const tray = this.studio.ensure({ kind: "effect", effect: "tray", frame });
        const mealDepth = depth_for(DEPTH_WORLD, meal.sortY);
        this.people.draw(`${customer.id}:tray`, {
          key: tray.key,
          x: meal.x,
          y: meal.y,
          scale: TABLE_TRAY_SCALE * tray.scale,
          depth: mealDepth,
        });
        const dish = this.ensure_dish(
          customer.orderedDishId,
          customer.orderedNutritionVariantId,
          eaten,
          frame,
        );
        if (dish) {
          this.people.draw(`${customer.id}:dish`, {
            key: dish.key,
            x: meal.x,
            y: meal.y - 1,
            scale: TABLE_DISH_SCALE * dish.scale,
            depth: mealDepth + 0.0000001,
          });
          const steams =
            (customer.orderedDishId
              ? DISH_BY_ID.get(customer.orderedDishId)?.steamEffect
              : "none") !== "none";
          if (steams && eaten === 0 && !frame.isLowDetail && !reduced) {
            const steam = this.studio.ensure({ kind: "effect", effect: "steam", frame });
            const phase =
              ((tick + (seed % STEAM_CYCLE_TICKS)) % STEAM_CYCLE_TICKS) / STEAM_CYCLE_TICKS;
            this.effects.draw(`${customer.id}:steam`, {
              key: steam.key,
              x: meal.x + Math.sin(phase * Math.PI * 2) * 2,
              y: meal.y - 8 - phase * 14,
              scale: (0.25 + phase * 0.3) * steam.scale,
              alpha: (1 - phase) * 0.5,
              depth: DEPTH_EFFECTS,
            });
          }
        }
      }
      // Status bubble.
      const indicator: EffectKind = `indicator-${pose.indicator}` as EffectKind;
      const bubble = this.studio.ensure({ kind: "effect", effect: indicator, frame });
      this.people.draw(`${customer.id}:indicator`, {
        key: bubble.key,
        x: x + 15,
        y: y - 44 - (reduced ? 0 : Math.sin((tick + seed) * 0.4) * 1.2),
        scale: INDICATOR_SCALE * bubble.scale,
        depth: DEPTH_INDICATORS,
      });
    }
    for (const id of [...this.facings.keys()]) {
      if (!seen.has(id)) this.facings.delete(id);
    }
  }

  private release_idle_sheets(tick: number): void {
    for (const [key, lastUsed] of this.sheetLastUsed) {
      // A tick earlier than the last use means the centre was reset or reloaded.
      if (Math.abs(tick - lastUsed) <= CUSTOMER_SHEET_LINGER_TICKS) continue;
      this.studio.release(key);
      this.sheetLastUsed.delete(key);
    }
  }

  /**
   * Draws each tray a guest left behind on the table top beside its seat, where a diner's meal
   * would sit, until the table-cleaning crew clears it.
   */
  private sync_left_trays(context: RenderContext, frame: PaintFrame): void {
    const keys = Object.keys(context.snapshot.unclearedTrays);
    if (keys.length === 0) return;
    const seats = new Map(getSeatLocations(context.state.objects, context.catalog).map((seat) => [seat.key, seat]));
    const tray = this.studio.ensure({ kind: "effect", effect: "left-tray", frame });
    for (const key of keys) {
      const seat = seats.get(key);
      if (!seat) continue;
      const seatX = (seat.point.x + 0.5) * TILE_SIZE;
      const seatY = (seat.point.y + 0.5) * TILE_SIZE;
      const anchor = nearest_table_meal_anchor(context, seatX, seatY);
      this.people.draw(`left-tray:${key}`, {
        key: tray.key,
        x: anchor?.x ?? seatX,
        y: anchor?.y ?? seatY - SEAT_TRAY_LIFT,
        scale: TABLE_TRAY_SCALE * tray.scale,
        depth: depth_for(DEPTH_WORLD, anchor?.sortY ?? seatY),
      });
    }
  }

  private sync_sparkles(context: RenderContext, frame: PaintFrame): void {
    const { snapshot } = context;
    const tick = snapshot.tick;
    if (tick !== this.lastSparkleTick) {
      // Each tick's sale events are read once; the snapshot repeats them until the next step.
      if (tick < this.lastSparkleTick) this.sparkles = [];
      this.lastSparkleTick = tick;
      const byId = new Map(snapshot.customers.map((customer) => [customer.id, customer] as const));
      for (const event of snapshot.events) {
        if (event.type !== "sale-completed" || !event.entityId) continue;
        const customer = byId.get(event.entityId);
        if (!customer) continue;
        const position = renderedCustomerPosition(customer, context.frame.isReducedMotion);
        this.sparkles.push({
          id: `${event.entityId}:${event.tick}`,
          x: (position.x + 0.5) * TILE_SIZE,
          y: (position.y + 0.5) * TILE_SIZE,
          tick: event.tick,
          amount: event.amount ?? 0,
        });
      }
      this.sparkles = this.sparkles
        .filter((sparkle) => tick - sparkle.tick <= SPARKLE_TICKS)
        .slice(-MAX_SPARKLES);
    }
    if (frame.isLowDetail) return;
    const sparkleTexture = this.studio.ensure({ kind: "effect", effect: "sparkle", frame });
    for (const sparkle of this.sparkles) {
      const age = Math.max(0, Math.min(1, (tick - sparkle.tick) / SPARKLE_TICKS));
      const rise = context.frame.isReducedMotion ? 10 : age * 22;
      this.effects.draw(`sparkle:${sparkle.id}`, {
        key: sparkleTexture.key,
        x: sparkle.x + 10,
        y: sparkle.y - 34 - rise,
        scale: (0.35 + age * 0.25) * sparkleTexture.scale,
        alpha: 1 - age * 0.9,
        tint: 0xffe08a,
        depth: DEPTH_EFFECTS,
      });
      if (sparkle.amount > 0) {
        this.labels.place(sparkle.x - 8, sparkle.y - 40 - rise, `+$${sparkle.amount}`, "#1f6b3a");
      }
    }
  }

  private sync_tint(context: RenderContext): void {
    const { snapshot } = context;
    const colour = context.frame.isHighContrast ? 0xffffff : daylight_tint(snapshot.elapsedMs);
    const boundsKey = `${snapshot.map.width}x${snapshot.map.height}`;
    if (colour === this.tintColour && boundsKey === this.tintBounds) return;
    this.tintColour = colour;
    this.tintBounds = boundsKey;
    this.tint.clear();
    if (colour === 0xffffff) return;
    this.tint.fillStyle(colour, 1);
    this.tint.fillRect(
      -FLOOR_MARGIN,
      -FLOOR_MARGIN,
      snapshot.map.width * TILE_SIZE + FLOOR_MARGIN * 2,
      snapshot.map.height * TILE_SIZE + FLOOR_MARGIN * 2,
    );
  }
}

/**
 * Builds the paint spec of a placeable for the world, a preview or a placement ghost.
 *
 * @param definitionId - The placeable content ID.
 * @param category - Its category.
 * @param widthTiles - Unrotated footprint width in tiles.
 * @param heightTiles - Unrotated footprint height in tiles.
 * @param rotation - The placement rotation.
 * @param frame - The paint frame.
 * @returns The spec, still (motion frame 0), sized to the rotated footprint.
 */
export function placeable_spec(
  definitionId: string,
  category: PlaceablePaintSpec["category"],
  widthTiles: number,
  heightTiles: number,
  rotation: Rotation,
  frame: PaintFrame,
): PlaceablePaintSpec {
  const content = PLACEABLE_BY_ID.get(definitionId);
  const size = rotated_size(widthTiles * TILE_SIZE, heightTiles * TILE_SIZE, rotation);
  return {
    kind: "placeable",
    definitionId,
    category,
    recipe: visualRecipeForPlaceable(definitionId, category, content?.tags),
    tags: content?.tags ?? [],
    rotation,
    width: size.width,
    height: size.height,
    motion: 0,
    frame,
  };
}

/**
 * Builds the paint spec of one stall layer for the world, a preview or a placement ghost.
 *
 * @param definitionId - The stall content ID.
 * @param name - The stall's display name.
 * @param palette - Its content palette.
 * @param signShape - Its sign shape.
 * @param widthTiles - Unrotated footprint width in tiles.
 * @param heightTiles - Unrotated footprint height in tiles.
 * @param rotation - The placement rotation.
 * @param layer - The layer to paint.
 * @param frame - The paint frame.
 * @returns The spec, painted open and sized to the rotated footprint.
 */
export function stall_spec(
  definitionId: string,
  name: string,
  palette: readonly string[],
  signShape: StallPaintSpec["signShape"] | undefined,
  widthTiles: number,
  heightTiles: number,
  rotation: Rotation,
  layer: StallLayer,
  frame: PaintFrame,
): StallPaintSpec {
  const size = rotated_size(widthTiles * TILE_SIZE, heightTiles * TILE_SIZE, rotation);
  return {
    kind: "stall",
    definitionId,
    name,
    primary: parse_palette_colour(palette[0] ?? "#6b877c", 0x6b877c),
    secondary: parse_palette_colour(palette[1] ?? "#f3e0b4", 0xf3e0b4),
    accent: parse_palette_colour(palette[2] ?? "#d56d50", 0xd56d50),
    signShape: signShape ?? "awning",
    art: resolve_stall_art(definitionId),
    rotation,
    layer,
    width: size.width,
    height: size.height,
    isOpen: true,
    frame,
  };
}
