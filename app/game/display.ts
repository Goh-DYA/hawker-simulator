/**
 * Pure display helpers for the `HawkerSimulator` game screen.
 *
 * Formatting, labels and catalogue previews that read only their arguments and the
 * authored content: money, content names and unlock requirements, placeable utility
 * effects, dish and placeable previews, the nutrition view of a dish, and the panel copy.
 * It also holds the small formatters and predicates more than one surface shares (progress
 * bar widths, hex colours, readable IDs, unlock checks and event glyphs), so each has one
 * definition. They hold no React state, so they are tested directly in Node.
 */
import type { CSSProperties } from "react";
import {
  CUSTOMER_ARCHETYPES,
  DISHES,
  getNutritionProfile,
  localize_key,
  PLACEABLES,
  STALLS,
  type DishDefinition,
  type PlaceableDefinition,
  type StallDefinition,
} from "@/src/content";
import { utilityEffectsForPlaceable } from "@/src/game/runtime/contentUtility";
import { coreNutritionProfile, runtimeNutritionProfile } from "@/src/game/runtime/nutrition";
import { visualRecipeForDish } from "@/src/game/runtime/visuals/dish";
import { visualRecipeForPlaceable } from "@/src/game/runtime/visuals/placeable";
import type { RuntimeEvent, RuntimeSnapshot } from "@/src/game/runtime/types";
import type { NutritionProfileView } from "./NutritionEducation";

/** A section of the management panel. */
export type Panel = "focus" | "build" | "stalls" | "dishes" | "insights" | "activity";

/** The kicker and title of each management panel section. */
export const PANEL_COPY: Readonly<Record<Panel, { kicker: string; title: string }>> = {
  focus: { kicker: "Today at a glance", title: "Focus" },
  build: { kicker: "Build catalogue", title: "Make it yours" },
  stalls: { kicker: "Food & drink", title: "Stalls" },
  dishes: { kicker: "Dishes & nutrition", title: "Menu planning" },
  insights: { kicker: "Service review", title: "Centre insights" },
  activity: { kicker: "Recent events", title: "Activity" },
};

/**
 * Look up the English text of a localisation key, or the key itself when it has none. An
 * alias of the content's `localize_key`, kept under the name the UI uses.
 */
export const localize = localize_key;

/** Formats whole Singapore dollars. Created once, with the options `money` always used. */
const SGD_FORMATTER = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
  maximumFractionDigits: 0,
});

/**
 * Format an amount of cash as whole Singapore dollars.
 *
 * @param value - The amount, in dollars.
 * @returns The amount in the `en-SG` currency format, such as `$4,200`.
 */
export function money(value: number) {
  return SGD_FORMATTER.format(value);
}

/**
 * Format how far a progress bar is filled, as a CSS width.
 *
 * @param progress - The progress made so far.
 * @param target - The progress needed; a target below 1 counts as 1.
 * @returns The filled share as a percentage capped at 100, such as `"40%"`.
 */
export function format_progress_percent(progress: number, target: number) {
  return `${Math.min(100, (progress / Math.max(1, target)) * 100)}%`;
}

/**
 * Format a packed RGB colour as a CSS hex colour.
 *
 * @param value - The colour as a `0xRRGGBB` number.
 * @returns The six-digit lowercase hex colour, such as `"#0a1b2c"`.
 */
export function format_hex_colour(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

/**
 * Turn a content ID or category into readable text.
 *
 * Content labels replace every hyphen, while the category chips and dish rows replace only
 * the first one, so the caller chooses.
 *
 * @param id - The ID or category, such as `dish.char-kway-teow` or `stall-fixture`.
 * @param options - `prefix` is removed when the ID starts with it; `shouldReplaceAll` says
 *   whether every hyphen becomes a space (the default) or only the first.
 * @returns The readable text, such as `char kway teow` or `stall fixture`.
 */
export function humanize_id(
  id: string,
  { prefix = "", shouldReplaceAll = true }: { prefix?: string; shouldReplaceAll?: boolean } = {},
) {
  const unprefixed = prefix && id.startsWith(prefix) ? id.slice(prefix.length) : id;
  return shouldReplaceAll ? unprefixed.replaceAll("-", " ") : unprefixed.replace("-", " ");
}

/** What a piece of content needs before it unlocks. */
interface UnlockRequirement {
  readonly level: number;
  readonly reputation: number;
  readonly prerequisiteIds: readonly string[];
}

/**
 * Check whether the centre meets a content unlock requirement.
 *
 * @param requirement - The level, reputation and prerequisite content needed.
 * @param snapshot - The centre's level, reputation and unlocked content.
 * @returns Whether every part of the requirement is met.
 */
export function is_requirement_met(
  requirement: UnlockRequirement,
  snapshot: Pick<RuntimeSnapshot, "level" | "reputation" | "unlockedContentIds">,
) {
  return (
    requirement.level <= snapshot.level &&
    requirement.reputation <= snapshot.reputation &&
    requirement.prerequisiteIds.every((id) => snapshot.unlockedContentIds.includes(id))
  );
}

/** The glyph a toast shows for each event kind. */
export const TOAST_KIND_GLYPHS: Readonly<Record<RuntimeEvent["kind"], string>> = {
  success: "✓",
  error: "!",
  warning: "i",
  info: "i",
};

/** The glyph an activity feed entry shows for each event kind. */
export const ACTIVITY_KIND_GLYPHS: Readonly<Record<RuntimeEvent["kind"], string>> = {
  success: "✓",
  warning: "!",
  error: "×",
  info: "i",
};

/**
 * Pick the catalogue glyph of a placeable category, or of stalls.
 *
 * @param category - The placeable category, or `"stall"`.
 * @returns The glyph shown on the catalogue card; `◇` for an unknown category.
 */
export function catalogueIcon(category: PlaceableDefinition["category"] | "stall") {
  const icons: Record<string, string> = {
    table: "▦",
    seat: "◒",
    "stall-fixture": "▤",
    "tray-waste": "↺",
    lighting: "✦",
    fan: "✣",
    plant: "♧",
    signage: "▱",
    divider: "╫",
    facility: "⬡",
    decor: "◆",
    stall: "▰",
  };
  return icons[category] ?? "◇";
}

/**
 * Read the purchase price of a placeable or a stall.
 *
 * @param item - The placeable or stall definition.
 * @returns Its purchase cost, in dollars.
 */
export function getContentPrice(item: PlaceableDefinition | StallDefinition) {
  return "purchaseCost" in item ? item.purchaseCost : item.price;
}

/** The inline style of a placeable preview: its accent colour. */
type PreviewStyle = CSSProperties & {
  "--preview-accent": string;
};

/** The inline style of a dish preview: its portion and garnish colours. */
type DishPreviewStyle = CSSProperties & {
  "--dish-portion": string;
  "--dish-garnish": string;
};

/**
 * Build the catalogue preview of a placeable.
 *
 * @param item - The placeable definition.
 * @returns Its procedural visual recipe and the preview's accent style.
 */
export function placeablePreview(item: PlaceableDefinition): {
  recipe: ReturnType<typeof visualRecipeForPlaceable>;
  style: PreviewStyle;
} {
  const recipe = visualRecipeForPlaceable(item.id, item.category, item.tags);
  return {
    recipe,
    style: {
      "--preview-accent": format_hex_colour(recipe.accent),
    },
  };
}

/**
 * Map a dish recipe to the CSS presentation class of its preview.
 *
 * @param recipe - The dish's procedural visual recipe.
 * @returns The presentation name, chosen by vessel first and then by portion shape.
 */
function dishPresentation(recipe: ReturnType<typeof visualRecipeForDish>) {
  const presentation = recipe.presentation;
  if (presentation.vessel === "tall-drinking-glass") return "tall-drink";
  if (presentation.vessel === "kopitiam-cup-and-saucer") return "mug";
  return {
    "rice-mound": "composed-rice",
    porridge: "porridge",
    "noodle-tangle": "noodles",
    broth: "soup",
    liquid: "mug",
    "shaved-ice": "shaved-dessert",
    flatbread: presentation.motif.includes("thosai") ? "rolled-bread" : "flatbread",
    "cake-cubes": "fried-plate",
    omelette: "fried-plate",
    fritters: "small-cakes",
    dumplings: "dumplings",
    skewers: "skewers",
    "grilled-pieces": "grilled",
    pudding: "porridge",
    "whole-seafood": "seafood",
    "leaf-parcel": "leaf-parcel",
    buns: "dumplings",
    "braised-scoop": "braised-scoop",
    "vegetable-scoop": "vegetable-scoop",
  }[presentation.portionShape];
}

/**
 * Build the menu preview of a dish.
 *
 * @param dish - The dish definition.
 * @returns Its visual recipe, presentation class and colour style.
 */
export function dishPreview(dish: (typeof DISHES)[number]): {
  recipe: ReturnType<typeof visualRecipeForDish>;
  presentation: string;
  style: DishPreviewStyle;
} {
  const recipe = visualRecipeForDish(dish);
  return {
    recipe,
    presentation: dishPresentation(recipe),
    style: {
      "--dish-portion": format_hex_colour(recipe.portionColour),
      "--dish-garnish": format_hex_colour(recipe.garnishColour),
    },
  };
}

/**
 * Project a dish's authored nutrition profile into the view the nutrition panels read.
 *
 * @param dishId - The dish.
 * @param variantId - The nutrition variant, if one is chosen.
 * @returns The runtime nutrition summary, or `undefined` when the dish has no profile.
 */
export function nutritionProfileView(
  dishId: string,
  variantId?: string,
): NutritionProfileView | undefined {
  return runtimeNutritionProfile(coreNutritionProfile(getNutritionProfile(dishId, variantId)));
}

/**
 * Name a dish for the player.
 *
 * @param dishId - The dish ID.
 * @returns The localised dish name, or a readable form of an unknown ID.
 */
export function dishLabel(dishId: string) {
  const dish = DISHES.find((candidate) => candidate.id === dishId);
  return dish ? localize(dish.nameKey) : humanize_id(dishId, { prefix: "dish." });
}

/**
 * Read a dish's authored Star rating.
 *
 * @param dishId - The dish ID.
 * @returns The Star rating, or `undefined` for an unknown dish.
 */
export function dishStarRating(dishId: string) {
  const dish = DISHES.find((candidate) => candidate.id === dishId);
  return dish?.starRating;
}

/**
 * Name a customer persona for the player.
 *
 * @param archetypeId - The customer archetype ID.
 * @returns The localised persona name, or a readable form of an unknown ID.
 */
export function personaLabel(archetypeId: string) {
  const archetype = CUSTOMER_ARCHETYPES.find((candidate) => candidate.id === archetypeId);
  return archetype
    ? localize(archetype.nameKey)
    : humanize_id(archetypeId, { prefix: "customer." });
}

/**
 * Format a rounded effect with an explicit plus sign when positive.
 *
 * @param value - The effect size.
 * @param suffix - Appended after the number, such as `"%"`.
 * @returns The signed text, such as `+12%`.
 */
function signedEffect(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${Math.round(value)}${suffix}`;
}

/**
 * List what a placeable does for the centre, in catalogue order.
 *
 * @param item - The placeable definition.
 * @returns The distinct effect descriptions, such as `Ambience +4`.
 */
export function utilityEffects(item: PlaceableDefinition): readonly string[] {
  const effects: string[] = [];
  const resolved = utilityEffectsForPlaceable(item);
  if (resolved.ambience !== 0) effects.push(`Ambience ${signedEffect(resolved.ambience)}`);
  if (resolved.cleanliness !== 0) {
    effects.push(`Cleanliness ${signedEffect(resolved.cleanliness)}`);
  }
  if (resolved.queuePatience !== 0) {
    effects.push(`Queue patience ${signedEffect(resolved.queuePatience * 100, "%")}`);
  }
  if (resolved.eatingSpeed !== 0) {
    effects.push(`Eating speed ${signedEffect(resolved.eatingSpeed * 100, "%")}`);
  }
  if (resolved.cleaningEfficiency !== 0) {
    effects.push(`Cleaning efficiency ${signedEffect(resolved.cleaningEfficiency * 100, "%")}`);
  }
  if (resolved.movementSpeed !== 0) {
    effects.push(`Walking speed ${signedEffect(resolved.movementSpeed * 100, "%")}`);
  }
  if (resolved.wayfinding > 0) {
    effects.push(`Wayfinding ${signedEffect(resolved.wayfinding * 100, "%")}`);
  }
  if (item.lightRadius > 0) effects.push(`Lights ${item.lightRadius}-tile radius`);
  for (const role of new Set(item.interactionPoints.map((point) => point.role))) {
    effects.push(
      {
        "return-tray": "Enables tray return",
        "dispose-waste": "Supports cleaner waste handling",
        "wash-hands": "Improves hygiene and dining comfort",
        "collect-water": "Improves refreshment and dining comfort",
        "inspect-menu": "Improves stall discovery",
        queue: "Improves queue patience and flow",
        sit: "Provides usable seating",
        use: "Provides passive facility support",
      }[role],
    );
  }
  if (item.queuePoints.length > 0) effects.push(`${item.queuePoints.length} queue guide points`);
  return [...new Set(effects)];
}

/**
 * Describe the main thing a placeable does.
 *
 * @param item - The placeable definition.
 * @returns Its first utility effect, or how it affects guest routes when it has none.
 */
export function primaryUtility(item: PlaceableDefinition) {
  return utilityEffects(item)[0] ??
    (item.walkability === "blocked" ? "Shapes guest routes" : "Walk-through decor");
}

/** Every placeable and stall, which is everything an unlock prerequisite can name. */
const UNLOCKABLE_CONTENT = [...PLACEABLES, ...STALLS] as const;
/** {@link UNLOCKABLE_CONTENT} by ID. */
const UNLOCKABLE_BY_ID = new Map(UNLOCKABLE_CONTENT.map((item) => [item.id, item]));
/** The customer archetypes in unlock order: level, then reputation, then ID. */
export const CUSTOMER_PERSONAS_BY_UNLOCK = [...CUSTOMER_ARCHETYPES].sort(
  (left, right) =>
    left.unlockRequirement.level - right.unlockRequirement.level ||
    left.unlockRequirement.reputation - right.unlockRequirement.reputation ||
    left.id.localeCompare(right.id, "en-SG"),
);

/**
 * Say what still locks a piece of content.
 *
 * @param item - The locked placeable, stall or dish.
 * @param level - The centre's level.
 * @param reputation - The centre's reputation.
 * @param unlockedContentIds - The content already unlocked.
 * @returns The first unmet requirement, such as `Level 3`, `Rep 20` or `After Fan`, else `Locked`.
 */
export function unlockLabel(
  item: Pick<PlaceableDefinition | StallDefinition | DishDefinition, "nameKey" | "unlockRequirement">,
  level: number,
  reputation: number,
  unlockedContentIds: readonly string[],
) {
  if (item.unlockRequirement.level > level) {
    return `Level ${item.unlockRequirement.level}`;
  }
  if (item.unlockRequirement.reputation > reputation) {
    return `Rep ${item.unlockRequirement.reputation}`;
  }
  const prerequisiteId = item.unlockRequirement.prerequisiteIds.find(
    (id) => !unlockedContentIds.includes(id),
  );
  const prerequisite = prerequisiteId ? UNLOCKABLE_BY_ID.get(prerequisiteId) : undefined;
  return prerequisite ? `After ${localize(prerequisite.nameKey)}` : "Locked";
}

/** The Build catalogue's category filters: `all`, then each placeable category in catalogue order. */
export const BUILD_CATEGORIES = ["all", ...new Set(PLACEABLES.map((item) => item.category))];
