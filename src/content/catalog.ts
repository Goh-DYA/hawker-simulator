/**
 * The assembled launch content and its shared ID lookup maps.
 *
 * `LAUNCH_CONTENT` gathers the economy, stalls, dishes, placeables, customer archetypes,
 * nutrition data and English localization into the one bundle that `validateContent`
 * checks; the runtime projects the same content modules into core catalogs directly. The
 * lookup maps are built once at import so callers share them instead of rebuilding their own.
 */
import { CUSTOMER_ARCHETYPES } from "./customers";
import { DISHES } from "./dishes";
import { ECONOMY } from "./economy";
import { ENGLISH_LOCALIZATION } from "./localization";
import { NUTRITION_CONTENT } from "./nutrition";
import { PLACEABLES } from "./placeables";
import { CONTENT_VERSION } from "./release";
import { STALLS } from "./stalls";
import type {
  DishDefinition,
  LaunchContent,
  PlaceableDefinition,
  StallDefinition,
} from "./types";

/** The complete launch content bundle; `version` is reported by `validateContent`. */
export const LAUNCH_CONTENT = {
  version: CONTENT_VERSION,
  economy: ECONOMY,
  stalls: STALLS,
  dishes: DISHES,
  placeables: PLACEABLES,
  customerArchetypes: CUSTOMER_ARCHETYPES,
  nutrition: NUTRITION_CONTENT,
  localization: ENGLISH_LOCALIZATION,
} as const satisfies LaunchContent;

/**
 * Launch dishes keyed by content ID.
 *
 * Built once in `DISHES` array order, so iteration order matches the authored list.
 */
export const DISH_BY_ID: ReadonlyMap<string, DishDefinition> = new Map(
  DISHES.map((dish) => [dish.id, dish]),
);

/**
 * Launch stalls keyed by content ID.
 *
 * Built once in `STALLS` array order, so iteration order matches the authored list.
 */
export const STALL_BY_ID: ReadonlyMap<string, StallDefinition> = new Map(
  STALLS.map((stall) => [stall.id, stall]),
);

/**
 * Launch non-stall placeables keyed by content ID.
 *
 * Built once in `PLACEABLES` array order, so iteration order matches the authored list.
 * Stalls are not included; look them up with `STALL_BY_ID`.
 */
export const PLACEABLE_BY_ID: ReadonlyMap<string, PlaceableDefinition> = new Map(
  PLACEABLES.map((item) => [item.id, item]),
);
