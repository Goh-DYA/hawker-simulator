/**
 * Stall-menu selection rules shared by the runtime and the HUD.
 *
 * Normalises saved menu selections, resolves each stall's menu against the dishes the player
 * has unlocked and the stall's slot capacity, and derives the menu progression and slot
 * bonuses from a game state.
 */
import type { GameState } from "@/src/game/core";
import {
  DISH_BY_ID,
  STALLS,
  type DishDefinition,
  type StallDefinition,
} from "../../content";
import { REPUTATION_SCALE } from "./rules";

/** The progression that gates which dishes a menu may offer. */
export interface StallMenuProgression {
  readonly level: number;
  /** Content reputation points, as displayed in the UI. */
  readonly reputation: number;
}

/** The menu progression plus extra menu slots per stall, such as those from mastery upgrades. */
export interface ResolveStallMenusOptions extends StallMenuProgression {
  readonly slotBonuses?: Readonly<Record<string, number>>;
}

/**
 * Tests whether a dish's level and reputation requirements are met.
 *
 * @param dish - The dish.
 * @param progression - The level and content-scale reputation.
 * @returns True when the dish can appear on a menu.
 */
export function isDishUnlockedForMenu(
  dish: DishDefinition,
  progression: StallMenuProgression,
) {
  return (
    dish.unlockRequirement.level <= progression.level &&
    dish.unlockRequirement.reputation <= progression.reputation
  );
}

/**
 * Cleans a saved menu selection: one entry per launch stall, keeping only that stall's own dish
 * IDs, without duplicates, in their saved order.
 *
 * @param value - The saved selection, which may be malformed.
 * @returns The selection keyed by stall ID.
 */
export function normalizeStallMenuSelection(
  value: unknown,
): Readonly<Record<string, readonly string[]>> {
  const source = value && typeof value === "object"
    ? value as Readonly<Record<string, unknown>>
    : {};
  return Object.fromEntries(
    STALLS.map((stall) => {
      const rawCandidate = source[stall.id];
      const candidate: readonly unknown[] = Array.isArray(rawCandidate)
        ? rawCandidate
        : [];
      const permitted = new Set<string>(stall.dishIds);
      return [
        stall.id,
        [...new Set(
          candidate.filter(
            (id): id is string => typeof id === "string" && permitted.has(id),
          ),
        )],
      ];
    }),
  );
}

/**
 * Resolves each stall's operating menu: the saved unlocked dishes up to the stall's slot capacity,
 * or, when none remain, the first unlocked dishes up to capacity.
 *
 * @param value - The saved selection, which may be malformed.
 * @param options - The progression and extra slots per stall.
 * @returns The operating menu of every launch stall, keyed by stall ID.
 */
export function resolveStallMenus(
  value: unknown,
  options: ResolveStallMenusOptions,
): Readonly<Record<string, readonly string[]>> {
  const normalized = normalizeStallMenuSelection(value);
  return Object.fromEntries(
    STALLS.map((stall) => {
      const unlocked = stall.dishIds.filter((dishId) => {
        const dish = DISH_BY_ID.get(dishId);
        return dish ? isDishUnlockedForMenu(dish, options) : false;
      });
      const capacity = Math.max(
        1,
        stall.menuSlots + Math.max(0, options.slotBonuses?.[stall.id] ?? 0),
      );
      const unlockedSet = new Set(unlocked);
      const selected = (normalized[stall.id] ?? [])
        .filter((dishId) => unlockedSet.has(dishId))
        .slice(0, capacity);
      return [
        stall.id,
        selected.length > 0 ? selected : unlocked.slice(0, capacity),
      ];
    }),
  );
}

/**
 * Resolves the menus a new selection would get: the first unlocked dishes of each stall.
 *
 * @param progression - The level and content-scale reputation.
 * @returns The default menu of every launch stall, keyed by stall ID.
 */
export function defaultStallMenusForProgression(
  progression: StallMenuProgression,
) {
  return resolveStallMenus({}, progression);
}

/**
 * Tests whether a dish, looked up by ID, is unlocked for menus.
 *
 * @param dishId - The dish ID.
 * @param progression - The level and content-scale reputation.
 * @returns True when the dish exists and is unlocked.
 */
export function isDishIdUnlockedForMenu(
  dishId: string,
  progression: StallMenuProgression,
) {
  const dish = DISH_BY_ID.get(dishId);
  return dish ? isDishUnlockedForMenu(dish, progression) : false;
}

/**
 * Reads the menu-unlock progression from a game state.
 *
 * Unlocks read the peak reputation, so a dish never leaves the menu choices after a poor day.
 * Core stores reputation divided by `REPUTATION_SCALE`, while dish unlock requirements use the
 * content's displayed reputation points, so the core value is scaled up here.
 *
 * @param state - The game state to read the level and peak reputation from.
 * @returns The level and content-scale peak reputation that gate dish unlocks.
 */
export function stallMenuProgression(state: GameState) {
  return {
    level: state.progression.level,
    reputation: state.progression.peakReputation * REPUTATION_SCALE,
  };
}

function compute_menu_slot_bonus(stall: StallDefinition, upgradeLevel: number | undefined) {
  const upgrade = stall.upgradeLevels.find(
    (candidate) => candidate.level === upgradeLevel,
  );
  return upgrade?.menuSlotsBonus ?? 0;
}

/**
 * Counts the menu slots a stall has at an upgrade level: its authored slots plus that level's bonus.
 *
 * @param stall - The authored stall definition.
 * @param upgradeLevel - The stall's current upgrade level, or `undefined` when it has no mastery yet.
 * @returns The number of dishes the stall may have on its menu.
 */
export function compute_menu_slots(stall: StallDefinition, upgradeLevel: number | undefined) {
  return stall.menuSlots + compute_menu_slot_bonus(stall, upgradeLevel);
}

/**
 * Looks up the menu-slot bonus each stall earns from its current upgrade level.
 *
 * @param state - The game state whose stall mastery holds each stall's upgrade level.
 * @returns A record from stall ID to extra menu slots, zero for stalls without an upgrade.
 */
export function stallMenuSlotBonuses(state: GameState) {
  return Object.fromEntries(
    STALLS.map((stall) => {
      const mastery = state.progression.stallMastery[stall.id];
      return [stall.id, compute_menu_slot_bonus(stall, mastery?.upgradeLevel)];
    }),
  );
}

/**
 * Compares two stall-menu selections dish by dish, in order, for every launch stall.
 *
 * @param left - The first stall-menu selection.
 * @param right - The second stall-menu selection.
 * @returns Whether every stall lists the same dish IDs in the same order in both selections.
 */
export function stallMenusMatch(
  left: Readonly<Record<string, readonly string[]>>,
  right: Readonly<Record<string, readonly string[]>>,
) {
  return STALLS.every((stall) => {
    const leftIds = left[stall.id] ?? [];
    const rightIds = right[stall.id] ?? [];
    return (
      leftIds.length === rightIds.length &&
      leftIds.every((dishId, index) => dishId === rightIds[index])
    );
  });
}
