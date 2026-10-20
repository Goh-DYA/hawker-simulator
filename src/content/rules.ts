/**
 * The semantic rule groups of `validateContent`.
 *
 * Each group takes the schema-parsed launch content and the validator's `check`
 * callback, and reports every broken rule through `check` in a fixed order. The groups
 * run in the order they appear here, which is the order of the issues the validator
 * reports, so moving a rule between or within groups changes the reported order.
 */
import type { z } from "zod";

import { is_primary_profile } from "./nutrition";
import {
  LAUNCH_ROSTER,
  NOT_COMPARABLE_GUIDELINE_IDS,
  PLACEABLE_CATEGORY_MINIMUMS,
  VARIANT_UNLOCK_RANKS,
} from "./roster";
import type { launchContentSchema } from "./schemas";
import type { PlaceableCategory } from "./types";

/** The launch content as `launchContentSchema` parses it. */
export type ParsedLaunchContent = z.output<typeof launchContentSchema>;

/** Records `message` as an issue when `condition` is false. */
export type ContentCheck = (condition: boolean, message: string) => void;

const PLACEHOLDER_PATTERN =
  /(?:\b(?:todo|tbd|placeholder|unnamed|lorem ipsum|coming soon)\b|^test(?: item)?$)/i;
const PEANUT_PATTERN = /\bpeanuts?\b/i;

/** The shortest trimmed display name a record may have. */
export const MIN_NAME_LENGTH = 3;

/** The shortest trimmed description that still counts as meaningful copy. */
export const MIN_DESCRIPTION_LENGTH = 36;

/** The fewest launch dishes each stall must offer. */
export const MIN_DISHES_PER_STALL = 3;

/** The fewest stalls that must be available when a new centre starts. */
export const MIN_STARTER_STALLS = 2;

/**
 * The visits per level used to estimate the cash a player plausibly holds when a stall
 * unlocks, so a stall's purchase cost can be checked against it.
 */
export const PLAUSIBLE_VISITS_PER_LEVEL = 120;

/**
 * The archetype whose mid budget every stall's opening menu must reach: each stall opens
 * with at least one dish a Student Saver can afford.
 */
export const OPENING_MENU_BUDGET_ARCHETYPE_ID = "customer.student-saver";

const increment = <T extends string>(record: Record<T, number>, key: T): void => {
  record[key] += 1;
};

/**
 * Checks the record counts against {@link LAUNCH_ROSTER}. Placeables are a minimum; the
 * nutrition profile total is one per dish plus one per non-default variant.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 */
export const check_roster = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): void => {
  check(
    content.stalls.length === LAUNCH_ROSTER.stalls,
    `Expected exactly ${LAUNCH_ROSTER.stalls} stalls, found ${content.stalls.length}.`,
  );
  check(
    content.dishes.length === LAUNCH_ROSTER.dishes,
    `Expected exactly ${LAUNCH_ROSTER.dishes} dishes, found ${content.dishes.length}.`,
  );
  check(
    content.placeables.length >= LAUNCH_ROSTER.placeables,
    `Expected at least ${LAUNCH_ROSTER.placeables} placeables, found ${content.placeables.length}.`,
  );
  check(
    content.customerArchetypes.length === LAUNCH_ROSTER.customerArchetypes,
    `Expected exactly ${LAUNCH_ROSTER.customerArchetypes} customer archetypes, found ${content.customerArchetypes.length}.`,
  );
  check(
    content.nutrition.sourceSnapshots.length === LAUNCH_ROSTER.nutritionSourceSnapshots,
    `Expected exactly ${LAUNCH_ROSTER.nutritionSourceSnapshots} nutrition source snapshots, found ${content.nutrition.sourceSnapshots.length}.`,
  );
  const expected_profile_count = content.nutrition.variantFamilies.reduce(
    (total, family) => total + family.variants.length - 1,
    content.dishes.length,
  );
  check(
    content.nutrition.profiles.length === expected_profile_count,
    `Expected exactly ${expected_profile_count} nutrition profiles (one per dish plus one per non-default variant), found ${content.nutrition.profiles.length}.`,
  );
  check(
    content.nutrition.variantFamilies.length === LAUNCH_ROSTER.nutritionVariantFamilies,
    `Expected exactly ${LAUNCH_ROSTER.nutritionVariantFamilies} nutrition variant families, found ${content.nutrition.variantFamilies.length}.`,
  );
  check(
    content.nutrition.intents.length === LAUNCH_ROSTER.nutritionIntents,
    `Expected exactly ${LAUNCH_ROSTER.nutritionIntents} nutrition intents, found ${content.nutrition.intents.length}.`,
  );
  check(
    content.nutrition.guidelines.length === LAUNCH_ROSTER.nutritionGuidelines,
    `Expected exactly ${LAUNCH_ROSTER.nutritionGuidelines} nutrition guidelines, found ${content.nutrition.guidelines.length}.`,
  );
};

/**
 * Checks that stall, dish, placeable and archetype IDs are unique, within and across
 * groups, and that each record's name and description are localized, meaningful and
 * distinct within its group.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 */
export const check_identity_and_copy = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): void => {
  const groups = [
    ["stall", content.stalls],
    ["dish", content.dishes],
    ["placeable", content.placeables],
    ["customer archetype", content.customerArchetypes],
  ] as const;

  const allIds = new Set<string>();
  for (const [label, records] of groups) {
    const ids = new Set<string>();
    const names = new Set<string>();
    const descriptions = new Set<string>();

    for (const record of records) {
      check(!ids.has(record.id), `Duplicate ${label} ID: ${record.id}.`);
      check(!allIds.has(record.id), `Content ID is reused across groups: ${record.id}.`);
      ids.add(record.id);
      allIds.add(record.id);

      const name = content.localization[record.nameKey];
      const description = content.localization[record.descriptionKey];
      check(
        typeof name === "string",
        `${record.id} is missing localization key ${record.nameKey}.`,
      );
      check(
        typeof description === "string",
        `${record.id} is missing localization key ${record.descriptionKey}.`,
      );

      if (typeof name === "string") {
        const normalizedName = name.trim().toLocaleLowerCase("en");
        check(name.trim().length >= MIN_NAME_LENGTH, `${record.id} has an empty or trivial name.`);
        check(
          !PLACEHOLDER_PATTERN.test(name),
          `${record.id} has a placeholder-like name: ${name}.`,
        );
        check(
          normalizedName !== record.nameKey.toLocaleLowerCase("en"),
          `${record.id} exposes its localization key as its name.`,
        );
        check(
          !names.has(normalizedName),
          `${label} name is not unique: ${name}.`,
        );
        names.add(normalizedName);
      }

      if (typeof description === "string") {
        const normalizedDescription = description
          .trim()
          .replace(/\s+/g, " ")
          .toLocaleLowerCase("en");
        check(
          description.trim().length >= MIN_DESCRIPTION_LENGTH,
          `${record.id} description is too short to be meaningful.`,
        );
        check(
          !PLACEHOLDER_PATTERN.test(description),
          `${record.id} has placeholder-like descriptive copy.`,
        );
        check(
          !descriptions.has(normalizedDescription),
          `${label} descriptions must be meaningfully distinct (${record.id}).`,
        );
        descriptions.add(normalizedDescription);
      }
    }
  }
};

/**
 * Checks each stall's menu, its dish links and that its visual and palette are unique.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 */
export const check_stalls = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): void => {
  const dishById = new Map(content.dishes.map((dish) => [dish.id, dish]));
  const stallVisualReferences = new Set<string>();
  const stallPaletteSignatures = new Set<string>();

  for (const stall of content.stalls) {
    check(
      stall.dishIds.length >= MIN_DISHES_PER_STALL,
      `${stall.id} must offer at least three launch dishes.`,
    );
    check(
      stall.menuSlots <= stall.dishIds.length,
      `${stall.id} has more menu slots than available dishes.`,
    );
    check(
      new Set(stall.dishIds).size === stall.dishIds.length,
      `${stall.id} lists the same dish more than once.`,
    );
    const stallVisualReference = `${stall.visual.sprite.atlas}:${stall.visual.sprite.frame}`;
    check(
      !stallVisualReferences.has(stallVisualReference),
      `${stall.id} reuses stall visual ${stallVisualReference}.`,
    );
    stallVisualReferences.add(stallVisualReference);

    const stallPaletteSignature = stall.visual.palette.join(":").toUpperCase();
    check(
      !stallPaletteSignatures.has(stallPaletteSignature),
      `${stall.id} reuses another stall's complete colour palette.`,
    );
    stallPaletteSignatures.add(stallPaletteSignature);

    for (const dishId of stall.dishIds) {
      const dish = dishById.get(dishId);
      check(Boolean(dish), `${stall.id} links to missing dish ${dishId}.`);
      check(
        Boolean(dish?.stallIds.includes(stall.id)),
        `${stall.id} -> ${dishId} is not reciprocated by the dish.`,
      );
    }
    check(
      stall.dishIds.some((dishId) => {
        const dish = dishById.get(dishId);
        return (
          dish !== undefined &&
          dish.unlockRequirement.level <= stall.unlockRequirement.level &&
          dish.unlockRequirement.reputation <= stall.unlockRequirement.reputation
        );
      }),
      `${stall.id} has no dish available when the stall unlocks.`,
    );
  }
};

/**
 * Checks each dish's stall links and unlocks, its food visual and its peanut tag.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 */
export const check_dishes = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): void => {
  const stallById = new Map(content.stalls.map((stall) => [stall.id, stall]));
  const dishVisualReferences = new Set<string>();
  for (const dish of content.dishes) {
    for (const stallId of dish.stallIds) {
      const stall = stallById.get(stallId);
      check(Boolean(stall), `${dish.id} links to missing stall ${stallId}.`);
      check(
        Boolean(stall?.dishIds.includes(dish.id)),
        `${dish.id} -> ${stallId} is not reciprocated by the stall menu.`,
      );
      if (stall) {
        check(
          dish.unlockRequirement.level >= stall.unlockRequirement.level,
          `${dish.id} unlocks before its stall ${stall.id}.`,
        );
        check(
          dish.unlockRequirement.reputation >= stall.unlockRequirement.reputation,
          `${dish.id} reputation requirement is below its stall ${stall.id}.`,
        );
      }
    }
    const dishVisualReference = `${dish.foodSprite.atlas}:${dish.foodSprite.frame}`;
    check(
      !dishVisualReferences.has(dishVisualReference),
      `${dish.id} reuses food visual ${dishVisualReference}.`,
    );
    dishVisualReferences.add(dishVisualReference);

    const description = content.localization[dish.descriptionKey];
    if (typeof description === "string" && PEANUT_PATTERN.test(description)) {
      check(
        dish.dietaryTags.includes("contains-peanuts"),
        `${dish.id} mentions peanuts but is missing the contains-peanuts dietary tag.`,
      );
    }
  }
};

/**
 * Checks the nutrition profiles, the variant families and the excluded guidelines.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 */
export const check_nutrition = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): void => {
  const dishById = new Map(content.dishes.map((dish) => [dish.id, dish]));
  const nutritionProfileById = new Map(
    content.nutrition.profiles.map((profile) => [profile.id, profile]),
  );
  const nutritionProfileIds = new Set<string>();
  const primaryNutritionProfileByDishId = new Map(
    content.nutrition.profiles
      .filter(is_primary_profile)
      .map((profile) => [profile.dishId, profile]),
  );
  const sourceSnapshotIds = new Set(
    content.nutrition.sourceSnapshots.map((snapshot) => snapshot.id),
  );
  const nutritionIntentIds = new Set(
    content.nutrition.intents.map((intent) => intent.id),
  );

  check(
    primaryNutritionProfileByDishId.size === content.dishes.length,
    `Every dish requires one primary nutrition profile; found ${primaryNutritionProfileByDishId.size}.`,
  );
  check(
    nutritionIntentIds.size === content.nutrition.intents.length,
    "Nutrition intent IDs must be unique.",
  );

  check(
    content.nutrition.profiles.every((profile) => profile.status === "released"),
    "Every selectable nutrition profile must be released.",
  );

  for (const profile of content.nutrition.profiles) {
    check(!nutritionProfileIds.has(profile.id), `Duplicate nutrition profile ID: ${profile.id}.`);
    nutritionProfileIds.add(profile.id);
    check(
      dishById.has(profile.dishId),
      `${profile.id} references missing dish ${profile.dishId}.`,
    );
    if (profile.status === "released") {
      check(Boolean(profile.serving), `${profile.id} is released without a serving basis.`);
      check(Boolean(profile.provenance), `${profile.id} is released without provenance.`);
      check(
        profile.quarantineReasons === undefined,
        `${profile.id} is released but still has quarantine reasons.`,
      );
    } else if (profile.status === "unavailable") {
      check(
        profile.unavailableReason !== undefined,
        `${profile.id} is unavailable without a reason.`,
      );
      check(
        Object.values(profile.nutrients).every(
          (value) => value.status === "unavailable",
        ),
        `${profile.id} is unavailable but exposes numeric nutrition values.`,
      );
      check(
        Object.keys(profile.intentFits).length === 0,
        `${profile.id} is unavailable but exposes intent fit scores.`,
      );
    } else {
      check(
        (profile.quarantineReasons?.length ?? 0) > 0,
        `${profile.id} is quarantined without an actionable reason.`,
      );
      check(
        Object.keys(profile.intentFits).length === 0,
        `${profile.id} is quarantined but exposes intent fit scores.`,
      );
    }
    if (profile.provenance) {
      check(
        sourceSnapshotIds.has(profile.provenance.snapshotId),
        `${profile.id} references missing source snapshot ${profile.provenance.snapshotId}.`,
      );
    }
    for (const intentId of Object.keys(profile.intentFits)) {
      check(
        nutritionIntentIds.has(intentId as never),
        `${profile.id} exposes unknown nutrition intent ${intentId}.`,
      );
    }
  }

  const variantFamilyDishIds = new Set<string>();
  const variantVisualKeys = new Set<string>();
  for (const family of content.nutrition.variantFamilies) {
    check(
      !variantFamilyDishIds.has(family.dishId),
      `Dish ${family.dishId} has more than one nutrition variant family.`,
    );
    variantFamilyDishIds.add(family.dishId);
    check(dishById.has(family.dishId), `Nutrition variants reference missing dish ${family.dishId}.`);
    check(
      family.variants[0]?.id === family.defaultVariantId,
      `${family.dishId} must list its default nutrition variant first.`,
    );
    const variantIds = new Set<string>();
    family.variants.forEach((variant, index) => {
      check(
        !variantIds.has(variant.id),
        `${family.dishId} repeats nutrition variant ${variant.id}.`,
      );
      variantIds.add(variant.id);
      const expectedRank =
        VARIANT_UNLOCK_RANKS[Math.min(index, VARIANT_UNLOCK_RANKS.length - 1)];
      check(
        variant.unlockRank === expectedRank,
        `${family.dishId} variant ${variant.id} must unlock at rank ${expectedRank}.`,
      );
      const profile = nutritionProfileById.get(variant.profileId);
      check(Boolean(profile), `${variant.id} references missing profile ${variant.profileId}.`);
      check(
        profile?.dishId === family.dishId,
        `${variant.id} uses a nutrition profile from another dish.`,
      );
      check(
        profile?.variantId === variant.id,
        `${variant.id} is not reciprocated by its nutrition profile.`,
      );
      check(
        !variantVisualKeys.has(variant.visualKey),
        `Nutrition variants must not reuse visual key ${variant.visualKey}.`,
      );
      variantVisualKeys.add(variant.visualKey);
    });
  }

  for (const guidelineId of NOT_COMPARABLE_GUIDELINE_IDS) {
    const guideline = content.nutrition.guidelines.find(
      (candidate) => candidate.id === guidelineId,
    );
    check(
      guideline?.comparison === "not-comparable" &&
        Boolean(guideline.notComparableReason),
      `${guidelineId} guidance must be explicitly excluded from direct comparison.`,
    );
  }
};

/**
 * Checks each placeable's prices, rotations, collision and seating, then the category
 * minimums.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 * @returns The number of placeables in each category.
 */
export const check_placeables = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): Record<PlaceableCategory, number> => {
  const categoryCounts = Object.fromEntries(
    Object.keys(PLACEABLE_CATEGORY_MINIMUMS).map((category) => [category, 0]),
  ) as Record<PlaceableCategory, number>;

  for (const item of content.placeables) {
    increment(categoryCounts, item.category);
    check(
      item.resaleValue <= item.price,
      `${item.id} resale value exceeds purchase price.`,
    );
    check(
      new Set(item.rotations).size === item.rotations.length,
      `${item.id} contains duplicate rotations.`,
    );
    check(item.rotations.includes(0), `${item.id} must include its base 0° rotation.`);
    check(
      item.spriteReferences.length === item.rotations.length,
      `${item.id} needs one sprite reference per supported rotation.`,
    );
    check(
      item.walkability === "blocked" || item.collision.length === 0,
      `${item.id} is walkable but still declares collision tiles.`,
    );
    check(
      item.walkability !== "blocked" || item.collision.length > 0,
      `${item.id} blocks movement but has no collision tiles.`,
    );
    for (const point of item.collision) {
      check(
        Number.isInteger(point.x) &&
          Number.isInteger(point.y) &&
          point.x >= 0 &&
          point.y >= 0 &&
          point.x < item.footprint.width &&
          point.y < item.footprint.height,
        `${item.id} has collision outside its footprint at (${point.x}, ${point.y}).`,
      );
    }
    if (item.category === "seat") {
      check(item.seatPoints.length > 0, `${item.id} is a seat with no seat point.`);
      check(
        item.interactionPoints.some((point) => point.role === "sit"),
        `${item.id} is a seat with no sit interaction.`,
      );
    }
  }

  for (const [category, minimum] of Object.entries(
    PLACEABLE_CATEGORY_MINIMUMS,
  ) as [PlaceableCategory, number][]) {
    check(
      categoryCounts[category] >= minimum,
      `Placeable category ${category} requires ${minimum}, found ${categoryCounts[category]}.`,
    );
  }
  return categoryCounts;
};

/**
 * Checks every unlock requirement against the economy caps and its prerequisites, and
 * reports prerequisite cycles.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 */
export const check_progression = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): void => {
  const progressionRecords = [
    ...content.stalls,
    ...content.dishes,
    ...content.placeables,
    ...content.customerArchetypes,
  ];
  const unlockById = new Map(
    progressionRecords.map((record) => [record.id, record.unlockRequirement]),
  );

  for (const record of progressionRecords) {
    const unlock = record.unlockRequirement;
    check(
      unlock.level <= content.economy.maxLevel,
      `${record.id} unlock level ${unlock.level} exceeds max level ${content.economy.maxLevel}.`,
    );
    check(
      unlock.reputation <= content.economy.maxReputation,
      `${record.id} reputation ${unlock.reputation} exceeds the attainable maximum.`,
    );
    check(
      new Set(unlock.prerequisiteIds).size === unlock.prerequisiteIds.length,
      `${record.id} repeats an unlock prerequisite.`,
    );

    for (const prerequisiteId of unlock.prerequisiteIds) {
      const prerequisite = unlockById.get(prerequisiteId);
      check(
        prerequisiteId !== record.id,
        `${record.id} cannot require itself to unlock.`,
      );
      check(
        Boolean(prerequisite),
        `${record.id} has missing unlock prerequisite ${prerequisiteId}.`,
      );
      if (prerequisite) {
        check(
          prerequisite.level <= unlock.level &&
            prerequisite.reputation <= unlock.reputation,
          `${record.id} requires ${prerequisiteId}, which unlocks later.`,
        );
      }
    }
  }

  content.stalls.forEach((stall, index) => {
    const previous = content.stalls[index - 1];
    if (!previous) return;
    const level = stall.unlockRequirement.level;
    const previous_level = previous.unlockRequirement.level;
    check(
      previous_level < level || (previous_level === 1 && level === 1),
      `${stall.id} must unlock at a later level than ${previous.id}, the stall authored before it.`,
    );
  });

  const visitedUnlocks = new Set<string>();
  const activeUnlockPath = new Set<string>();
  const visitUnlock = (id: string): void => {
    if (visitedUnlocks.has(id)) return;
    if (activeUnlockPath.has(id)) {
      check(false, `Unlock prerequisite cycle includes ${id}.`);
      return;
    }

    activeUnlockPath.add(id);
    const requirement = unlockById.get(id);
    for (const prerequisiteId of requirement?.prerequisiteIds ?? []) {
      if (unlockById.has(prerequisiteId)) visitUnlock(prerequisiteId);
    }
    activeUnlockPath.delete(id);
    visitedUnlocks.add(id);
  };
  for (const id of unlockById.keys()) visitUnlock(id);
};

/**
 * Checks the XP thresholds, the starter stalls and bundle, the recovery grant and that
 * every stall is plausibly affordable when it unlocks.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 * @returns The cost of the cheapest starter bundle.
 */
export const check_economy = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): number => {
  const dishById = new Map(content.dishes.map((dish) => [dish.id, dish]));
  const starterStalls = content.stalls.filter(
    (stall) =>
      stall.unlockRequirement.level === 1 &&
      stall.unlockRequirement.reputation <= content.economy.startingReputation,
  );
  check(starterStalls.length >= MIN_STARTER_STALLS, "At least two stalls must be available at launch.");
  for (const stall of starterStalls) {
    check(
      stall.dishIds.some((dishId) => {
        const dish = dishById.get(dishId);
        return (
          dish?.unlockRequirement.level === 1 &&
          dish.unlockRequirement.reputation <= content.economy.startingReputation
        );
      }),
      `${stall.id} is a starter stall with no dish available at level 1 and the starting reputation.`,
    );
  }

  const cheapestStarter = (
    category: PlaceableCategory,
    requiredTag?: string,
  ): number => {
    const prices = content.placeables
      .filter(
        (item) =>
          item.category === category &&
          item.unlockRequirement.level === 1 &&
          item.unlockRequirement.reputation <= content.economy.startingReputation &&
          (requiredTag === undefined || item.tags.includes(requiredTag)),
      )
      .map((item) => item.price);
    check(
      prices.length > 0,
      `No starter ${requiredTag ?? category} is available.`,
    );
    return prices.length > 0 ? Math.min(...prices) : Number.POSITIVE_INFINITY;
  };

  const cheapestStarterStall =
    starterStalls.length > 0
      ? Math.min(...starterStalls.map((stall) => stall.purchaseCost))
      : Number.POSITIVE_INFINITY;
  const cheapestTable = cheapestStarter("table");
  const cheapestSeat = cheapestStarter("seat");
  const cheapestTrayReturn = cheapestStarter("tray-waste", "tray-return");
  const cheapestFacility = cheapestStarter("facility");
  const starterBundleCost =
    cheapestStarterStall +
    cheapestTable +
    cheapestSeat * content.economy.starterRequiredSeats +
    cheapestTrayReturn +
    cheapestFacility;

  check(
    starterBundleCost <= content.economy.startingCash,
    `Starter bundle costs ${starterBundleCost}, above starting cash ${content.economy.startingCash}.`,
  );
  check(
    content.economy.recoveryGrant >=
      cheapestTable +
        cheapestSeat * content.economy.starterRequiredSeats +
        cheapestTrayReturn,
    "Recovery grant cannot restore a minimum table, seats, and waste facility.",
  );

  const budget_archetype = content.customerArchetypes.find(
    (archetype) => archetype.id === OPENING_MENU_BUDGET_ARCHETYPE_ID,
  );
  check(Boolean(budget_archetype), `${OPENING_MENU_BUDGET_ARCHETYPE_ID} is missing.`);
  if (budget_archetype) {
    const [low, high] = budget_archetype.budgetRange;
    const mid_budget = (low + high) / 2;
    for (const stall of content.stalls) {
      const opening_prices = stall.dishIds
        .map((dishId) => dishById.get(dishId))
        .filter(
          (dish) =>
            dish !== undefined &&
            dish.unlockRequirement.level <= stall.unlockRequirement.level &&
            dish.unlockRequirement.reputation <= stall.unlockRequirement.reputation,
        )
        .map((dish) => dish?.price ?? Number.POSITIVE_INFINITY);
      if (opening_prices.length === 0) continue;
      check(
        Math.min(...opening_prices) <= mid_budget,
        `${stall.id} opens with no dish at or below the Student Saver budget ($${mid_budget.toFixed(2)}).`,
      );
    }
  }

  for (const stall of content.stalls) {
    const plausibleCashAtUnlock =
      content.economy.startingCash +
      (stall.unlockRequirement.level - 1) *
        content.economy.minimumVisitEarnings *
        PLAUSIBLE_VISITS_PER_LEVEL;
    check(
      stall.purchaseCost <= plausibleCashAtUnlock,
      `${stall.id} is not plausibly affordable at its unlock level.`,
    );
  }
  return starterBundleCost;
};

/**
 * Checks each customer archetype's ranges and schedule, and that its role, behaviour and
 * visual treatment are distinct.
 *
 * @param content - The schema-parsed launch content.
 * @param check - Records an issue when its condition is false.
 */
export const check_customers = (
  content: ParsedLaunchContent,
  check: ContentCheck,
): void => {
  const roles = new Set<string>();
  const behaviorSignatures = new Set<string>();
  const visualSignatures = new Set<string>();
  for (const customer of content.customerArchetypes) {
    check(
      customer.budgetRange[0] <= customer.budgetRange[1],
      `${customer.id} has an inverted budget range.`,
    );
    check(
      customer.groupSizeRange[0] <= customer.groupSizeRange[1],
      `${customer.id} has an inverted group-size range.`,
    );
    check(
      customer.visitSchedule.startHour < customer.visitSchedule.endHour,
      `${customer.id} has an empty visit schedule.`,
    );
    check(
      !roles.has(customer.gameplayRole.toLocaleLowerCase("en")),
      `${customer.id} duplicates another customer gameplay role.`,
    );
    roles.add(customer.gameplayRole.toLocaleLowerCase("en"));

    const signature = [
      customer.budgetRange.join("-"),
      customer.patienceSeconds,
      customer.walkingSpeedTilesPerSecond,
      customer.priceSensitivity,
      customer.qualitySensitivity,
      customer.queueSensitivity,
      customer.distanceSensitivity,
      customer.noveltyPreference,
      [...customer.dishPreferenceTags].sort().join(","),
      customer.seatPreference,
      customer.groupSizeRange.join("-"),
      customer.visitSchedule.startHour,
      customer.visitSchedule.endHour,
      customer.visitSchedule.peakMultiplier,
      customer.unlockRequirement.level,
      customer.unlockRequirement.reputation,
      [...customer.unlockRequirement.prerequisiteIds].sort().join(","),
    ].join("|");
    check(
      !behaviorSignatures.has(signature),
      `${customer.id} is not behaviorally distinct.`,
    );
    behaviorSignatures.add(signature);

    const visualSignature = [
      customer.visualRules.outfitSilhouette,
      customer.visualRules.garmentPattern,
      customer.visualRules.carryProp,
    ].join("|");
    check(
      !visualSignatures.has(visualSignature),
      `${customer.id} reuses another customer visual treatment.`,
    );
    visualSignatures.add(visualSignature);
  }
};
