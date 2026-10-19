/**
 * Content-to-core catalog projection for the runtime.
 *
 * Converts the authored content in `src/content` into the pure `SimulationCatalog` that core
 * consumes, and layers the player's dish variants, stall menus and stall upgrades on top. The
 * module is free of Phaser so the projection can be tested on its own.
 */
import {
  CUSTOMER_ARCHETYPES,
  DISHES,
  PLACEABLES,
  STALLS,
  getNutritionProfile,
  getNutritionVariantFamily,
  localize_key,
  type PlaceableCategory,
} from "@/src/content";
import {
  effectiveStallDefinition,
  type GameState,
  type PlaceableDefinition as CorePlaceableDefinition,
  type SimulationCatalog,
} from "@/src/game/core";
import { utilityEffectsForPlaceable } from "./contentUtility";
import { coreNutritionProfile } from "./nutrition";
import { REPUTATION_SCALE } from "./rules";

/** Queue capacity every stall gets in the core catalog. */
const STALL_QUEUE_CAPACITY = 7;
/** Share of a stall's purchase cost that is refunded when it is removed. */
const STALL_REFUND_RATE = 0.5;
/** Rotations every stall may be placed at. */
const STALL_ROTATIONS = [0, 90, 180, 270] as const;
/** Largest quality bonus a stall earns from its average dish price. */
const STALL_QUALITY_BONUS_CAP = 0.05;
/** Average dish price that earns one whole point of stall quality before the cap applies. */
const STALL_QUALITY_PRICE_DIVISOR = 300;
/** Price assumed for a menu dish that is missing from the dish catalog. */
const FALLBACK_DISH_PRICE = 5;
/** Unlock level for buildables with reputation or prerequisite rules, which only the runtime unlocks. */
const LOCKED_UNTIL_RECONCILED = Number.MAX_SAFE_INTEGER;
/** Placeholder colours cycled across a placeable's sprite references. */
const PLACEHOLDER_PALETTE = ["#8cab95", "#d6a15f", "#6f8d94"] as const;

/** Every buildable definition (placeables, then stalls) in authored order, used for unlock rules. */
export const BUILDABLE_CONTENT = [...PLACEABLES, ...STALLS] as const;

const BUILDABLE_REQUIREMENTS = new Map(
  BUILDABLE_CONTENT.map((definition) => [definition.id, definition.unlockRequirement]),
);

function usesComplexUnlock(id: string) {
  const requirement = BUILDABLE_REQUIREMENTS.get(id);
  return Boolean(
    requirement &&
      (requirement.reputation > 0 || requirement.prerequisiteIds.length > 0),
  );
}

/** Render-facing description of a buildable definition, keyed by definition ID. */
export interface VisualDefinition {
  category: PlaceableCategory | "stall";
  name: string;
  palette: readonly string[];
  signShape?: "awning" | "lightbox" | "painted-board" | "tile-panel";
}

/**
 * Resolves an English localization key, falling back to the key itself. An alias of the
 * content's `localize_key`, kept under the name the runtime uses.
 */
export const localized = localize_key;

function coreKind(category: PlaceableCategory): CorePlaceableDefinition["kind"] {
  if (category === "seat") return "seat";
  if (category === "table") return "table";
  if (category === "tray-waste") return "facility";
  if (category === "decor" || category === "plant" || category === "signage") {
    return "decoration";
  }
  return "facility";
}

/**
 * Projects authored content into the core `SimulationCatalog`, plus the render-facing visuals.
 *
 * Dishes, placeables and stalls, and archetypes are converted in authored order, so record key
 * order and the derived numbers match what the simulation and the goldens expect.
 *
 * @returns The authored catalog (default menus and variants) and the visual definitions by ID.
 */
export function buildCatalog(): {
  catalog: SimulationCatalog;
  visuals: Readonly<Record<string, VisualDefinition>>;
} {
  const dishes: SimulationCatalog["dishes"] = Object.fromEntries(
    DISHES.map((dish) => {
      const family = getNutritionVariantFamily(dish.id);
      const baseProfile = coreNutritionProfile(getNutritionProfile(dish.id));
      const nutritionVariants = family
        ? family.variants.map((variant) => ({
            id: variant.id,
            label: variant.name,
            unlockRank: variant.unlockRank,
            profileId: variant.profileId,
            visualKey: variant.visualKey,
            profile: coreNutritionProfile(getNutritionProfile(dish.id, variant.id)),
          }))
        : baseProfile
          ? [{
              id: baseProfile.id,
              label: "Listed serving",
              unlockRank: 1,
              profileId: baseProfile.id,
              visualKey: "default",
              profile: baseProfile,
            }]
          : undefined;
      const defaultNutritionVariantId = family?.defaultVariantId ?? baseProfile?.id;
      return [
        dish.id,
        {
        id: dish.id,
        price: dish.price,
        preparationMs: dish.preparationTimeMs,
        eatingMs: dish.eatingTimeMs,
        quality: dish.quality,
        starRating: dish.starRating,
        baseDemand: dish.baseDemand,
        preferenceTags: dish.preferenceTags,
        unlockLevel: dish.unlockRequirement.level,
        unlockReputation: dish.unlockRequirement.reputation / REPUTATION_SCALE,
        nutritionVariants,
        defaultNutritionVariantId,
        activeNutritionVariantId: defaultNutritionVariantId,
      },
      ];
    }),
  );

  const placeables: Record<string, CorePlaceableDefinition> = {};
  const visuals: Record<string, VisualDefinition> = {};

  for (const item of PLACEABLES) {
    const returnPoint = item.interactionPoints.find((point) => point.role === "return-tray");
    placeables[item.id] = {
      id: item.id,
      kind: returnPoint ? "tray-return" : coreKind(item.category),
      footprint: item.footprint,
      allowedRotations: item.rotations,
      blocksMovement: item.walkability === "blocked",
      price: item.price,
      refundRate: item.price > 0 ? item.resaleValue / item.price : 0,
      unlockLevel: usesComplexUnlock(item.id)
        ? LOCKED_UNTIL_RECONCILED
        : item.unlockRequirement.level,
      seatPoints: item.seatPoints.map((point) => ({ x: point.x, y: point.y })),
      trayReturnPoint: returnPoint ? { x: returnPoint.x, y: returnPoint.y } : undefined,
      utility: utilityEffectsForPlaceable(item),
    };
    visuals[item.id] = {
      category: item.category,
      name: localized(item.nameKey),
      palette: item.spriteReferences.map((_, index) =>
        PLACEHOLDER_PALETTE[index % PLACEHOLDER_PALETTE.length] as string,
      ),
    };
  }

  for (const stall of STALLS) {
    const averageDishPrice =
      stall.dishIds.reduce((total, id) => total + (dishes[id]?.price ?? FALLBACK_DISH_PRICE), 0) /
      Math.max(1, stall.dishIds.length);
    placeables[stall.id] = {
      id: stall.id,
      kind: "stall",
      footprint: stall.footprint,
      allowedRotations: STALL_ROTATIONS,
      blocksMovement: true,
      price: stall.purchaseCost,
      refundRate: STALL_REFUND_RATE,
      unlockLevel: usesComplexUnlock(stall.id)
        ? LOCKED_UNTIL_RECONCILED
        : stall.unlockRequirement.level,
      servicePoint: stall.servicePoint,
      queueAnchor: stall.queueAnchor,
      stall: {
        dishIds: stall.dishIds,
        allDishIds: stall.dishIds,
        orderMs: stall.serviceTimeMs,
        preparationCapacity: stall.preparationCapacity,
        queueCapacity: STALL_QUEUE_CAPACITY,
        popularity: stall.popularity,
        quality:
          stall.quality +
          Math.min(STALL_QUALITY_BONUS_CAP, averageDishPrice / STALL_QUALITY_PRICE_DIVISOR),
        menuSlots: stall.menuSlots,
        upgradeLevels: stall.upgradeLevels.map((upgrade) => ({ ...upgrade })),
      },
    };
    visuals[stall.id] = {
      category: "stall",
      name: localized(stall.nameKey),
      palette: stall.visual.palette,
      signShape: stall.visual.signShape,
    };
  }

  const archetypes: SimulationCatalog["archetypes"] = Object.fromEntries(
    CUSTOMER_ARCHETYPES.map((archetype) => [
      archetype.id,
      {
        id: archetype.id,
        budget: (archetype.budgetRange[0] + archetype.budgetRange[1]) / 2,
        patienceMs: archetype.patienceSeconds * 1_000,
        walkingSpeed: archetype.walkingSpeedTilesPerSecond,
        priceSensitivity: archetype.priceSensitivity,
        qualitySensitivity: archetype.qualitySensitivity,
        queueSensitivity: archetype.queueSensitivity,
        distanceSensitivity: archetype.distanceSensitivity,
        noveltyPreference: archetype.noveltyPreference,
        trayReturnChance: archetype.trayReturnChance,
        preferenceTags: archetype.dishPreferenceTags,
        unlockLevel: archetype.unlockRequirement.level,
        unlockReputation: archetype.unlockRequirement.reputation / REPUTATION_SCALE,
        unlockPrerequisiteIds: [...archetype.unlockRequirement.prerequisiteIds],
        visitSchedule: { ...archetype.visitSchedule },
      },
    ]),
  );

  return { catalog: { placeables, dishes, archetypes }, visuals };
}

/**
 * Layers the player's active nutrition variants on top of a catalog.
 *
 * @param base - Catalog to copy; it is not mutated.
 * @param activeDishVariants - Selected variant ID per dish; families fall back to their default.
 * @returns A catalog whose dishes carry the active variant IDs.
 */
export function withDishVariants(
  base: SimulationCatalog,
  activeDishVariants: Readonly<Record<string, string>>,
): SimulationCatalog {
  return {
    ...base,
    dishes: Object.fromEntries(Object.entries(base.dishes).map(([dishId, dish]) => {
      const family = getNutritionVariantFamily(dishId);
      const activeNutritionVariantId = family
        ? activeDishVariants[dishId] ?? family.defaultVariantId
        : dish.defaultNutritionVariantId;
      return [dishId, { ...dish, activeNutritionVariantId }];
    })),
  };
}

/**
 * Layers the player's stall menus on top of a catalog.
 *
 * @param base - Catalog to copy; it is not mutated.
 * @param menus - Selected dish IDs per stall ID; stalls without an entry keep their dishes.
 * @returns A catalog whose stall definitions list the selected dishes.
 */
export function withStallMenus(
  base: SimulationCatalog,
  menus: Readonly<Record<string, readonly string[]>>,
): SimulationCatalog {
  return {
    ...base,
    placeables: Object.fromEntries(
      Object.entries(base.placeables).map(([id, definition]) => [
        id,
        definition.stall
          ? {
              ...definition,
              stall: {
                ...definition.stall,
                dishIds: menus[id] ?? definition.stall.dishIds,
              },
            }
          : definition,
      ]),
    ),
  };
}

/**
 * Layers the player's dish variants and then their stall menus on top of the authored catalog.
 *
 * The composition order is fixed (`withStallMenus(withDishVariants(...))`), so every caller
 * builds the same catalog the simulation and the goldens expect.
 *
 * @param authored - The authored catalog from `buildCatalog`; it is not mutated.
 * @param activeDishVariants - Selected variant ID per dish.
 * @param stallMenus - Selected dish IDs per stall ID.
 * @returns The catalog with the player's variants and menus applied.
 */
export function layer_catalog(
  authored: SimulationCatalog,
  activeDishVariants: Readonly<Record<string, string>>,
  stallMenus: Readonly<Record<string, readonly string[]>>,
): SimulationCatalog {
  return withStallMenus(withDishVariants(authored, activeDishVariants), stallMenus);
}

/**
 * Applies each stall's purchased upgrades to the catalog's stall definitions.
 *
 * @param state - Game state whose stall mastery decides the effective upgrade level.
 * @param catalog - Catalog with the player's menus and variants already applied.
 * @returns A catalog whose stall definitions reflect the current upgrades.
 */
export function effectiveCatalog(state: GameState, catalog: SimulationCatalog): SimulationCatalog {
  return {
    ...catalog,
    placeables: Object.fromEntries(Object.entries(catalog.placeables).map(([id, definition]) => [
      id,
      definition.stall
        ? { ...definition, stall: effectiveStallDefinition(state, id, definition.stall) }
        : definition,
    ])),
  };
}
