import { describe, expect, it } from "vitest";
import { DISHES, STALLS } from "@/src/content";
import {
  compute_menu_slots,
  defaultStallMenusForProgression,
  isDishIdUnlockedForMenu,
  isDishUnlockedForMenu,
  resolveStallMenus,
  type StallMenuProgression,
} from "@/src/game/runtime/stallMenus";

const DISH_BY_ID = new Map(DISHES.map((dish) => [dish.id, dish]));
const STALL_BY_ID = new Map(STALLS.map((stall) => [stall.id, stall]));

/**
 * Check that every dish on the resolved menus is unlocked for its stall's menu.
 *
 * @param menus - The resolved menus, keyed by stall ID.
 * @param progression - The progression the menus were resolved against.
 * @returns Whether every menu dish is unlocked for its stall.
 */
function are_menus_unlocked(
  menus: Readonly<Record<string, readonly string[]>>,
  progression: StallMenuProgression,
) {
  return Object.entries(menus).every(([stall_id, dish_ids]) => {
    const stall = STALL_BY_ID.get(stall_id);
    return dish_ids.every((dish_id) => {
      const dish = DISH_BY_ID.get(dish_id);
      return dish && stall ? isDishUnlockedForMenu(dish, progression, stall) : false;
    });
  });
}

describe("stall menu progression", () => {
  it("starts with only dishes unlocked by the initial level and reputation", () => {
    const progression = { level: 1, reputation: 8, unlockedDefinitionIds: [] };
    const menus = defaultStallMenusForProgression(progression);
    const activeDishIds = Object.values(menus).flat();

    expect(activeDishIds.length).toBeGreaterThan(0);
    expect(are_menus_unlocked(menus, progression)).toBe(true);
  });

  it("repairs legacy or tampered selections without admitting locked dishes", () => {
    const progression = { level: 1, reputation: 8, unlockedDefinitionIds: [] };
    const lockedDish = DISHES.find((dish) =>
      dish.stallIds.some((stall_id) => {
        const owner = STALL_BY_ID.get(stall_id);
        return owner ? !isDishUnlockedForMenu(dish, progression, owner) : false;
      }),
    );
    const stall = STALLS.find((candidate) =>
      candidate.dishIds.includes(lockedDish?.id ?? ""),
    );

    expect(lockedDish).toBeDefined();
    expect(stall).toBeDefined();
    const menus = resolveStallMenus(
      stall && lockedDish
        ? { [stall.id]: [lockedDish.id, "dish.not-real"] }
        : {},
      progression,
    );

    expect(Object.values(menus).flat()).not.toContain(lockedDish?.id);
    expect(are_menus_unlocked(menus, progression)).toBe(true);
  });

  it("preserves a fourth selected dish when an upgraded stall adds a slot", () => {
    const stall = STALLS.find((candidate) => candidate.dishIds.length >= 4);

    expect(stall).toBeDefined();
    if (!stall) return;
    const selected = stall.dishIds.slice(0, 4);
    const menus = resolveStallMenus(
      { [stall.id]: selected },
      {
        level: 99,
        reputation: 100,
        unlockedDefinitionIds: [],
        slotBonuses: { [stall.id]: 1 },
      },
    );

    expect(menus[stall.id]).toEqual(selected);
  });
});

describe("an unlocked stall's opening dishes", () => {
  /** A stall with two opening dishes, gated at its own level and reputation, and later ones. */
  const stall = STALL_BY_ID.get("stall.sweet-monsoon")!;
  /** Level 1 at the starting reputation, below every opening dish of the stall. */
  const owned: StallMenuProgression = {
    level: 1,
    reputation: 8,
    unlockedDefinitionIds: [stall.id],
  };
  /**
   * @param dish_id - The dish ID.
   * @returns Whether the dish is gated no later than the stall.
   */
  function is_opening_dish(dish_id: string) {
    const requirement = DISH_BY_ID.get(dish_id)!.unlockRequirement;
    return (
      requirement.level <= stall.unlockRequirement.level &&
      requirement.reputation <= stall.unlockRequirement.reputation
    );
  }
  const opening_dish_ids = stall.dishIds.filter(is_opening_dish);
  const later_dish_ids = stall.dishIds.filter((dish_id) => !is_opening_dish(dish_id));

  it("has opening and later dishes, all above the progression's own level", () => {
    expect([
      opening_dish_ids.length,
      later_dish_ids.length > 0,
      stall.dishIds.some((dish_id) => DISH_BY_ID.get(dish_id)!.unlockRequirement.level <= 1),
    ]).toEqual([2, true, false]);
  });

  it("keeps them on the stall's resolved menu below their own level and reputation", () => {
    const menus = resolveStallMenus({ [stall.id]: stall.dishIds }, owned);

    expect(menus[stall.id]).toEqual(opening_dish_ids);
  });

  it("keeps the stall's dishes gated above its own requirement locked", () => {
    expect(later_dish_ids.map((dish_id) => isDishIdUnlockedForMenu(dish_id, owned, stall))).toEqual(
      later_dish_ids.map(() => false),
    );
  });

  it("does not offer them while the stall is still locked", () => {
    const locked = { ...owned, unlockedDefinitionIds: [] };

    expect([
      resolveStallMenus({ [stall.id]: stall.dishIds }, locked)[stall.id],
      opening_dish_ids.map((dish_id) => isDishIdUnlockedForMenu(dish_id, locked, stall)),
    ]).toEqual([[], opening_dish_ids.map(() => false)]);
  });

  it("does not offer its opening dish on another unlocked stall's menu", () => {
    /** A stall gated later than every Sweet Monsoon dish. */
    const other = STALL_BY_ID.get("stall.harbour-ember")!;
    const both_owned = { ...owned, unlockedDefinitionIds: [stall.id, other.id] };

    expect(isDishIdUnlockedForMenu(opening_dish_ids[0]!, both_owned, other)).toBe(false);
  });
});

describe("compute_menu_slots", () => {
  it("matches the authored slots plus the upgrade bonus for every stall and level", () => {
    const upgrade_levels = [undefined, 1, 2, 3, 4, 5];
    for (const stall of STALLS) {
      for (const upgrade_level of upgrade_levels) {
        const upgrade = stall.upgradeLevels.find((candidate) => candidate.level === upgrade_level);
        const expected_slots = stall.menuSlots + (upgrade?.menuSlotsBonus ?? 0);
        expect(compute_menu_slots(stall, upgrade_level), `${stall.id} at ${upgrade_level}`).toBe(
          expected_slots,
        );
      }
    }
  });
});
