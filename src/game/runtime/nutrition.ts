/**
 * Nutrition projections and dish-variant resolution for the runtime.
 *
 * Converts authored nutrition profiles into the core shape and into HUD summaries, explains a
 * customer's dish choice in plain language, and resolves the player's nutrition variant choices
 * against the variants their stall ranks unlock. It also builds the nutrition parts of the HUD
 * snapshot: the variant families, today's nutrition pulse and the selected customer's summary.
 * Only the HUD summary carries a meal's generated Health rating parts, so they never enter the
 * core profile or a save. The module is free of Phaser.
 */
import {
  NUTRITION_CONTENT,
  STALLS,
  getNutritionProfile,
  getNutritionVariantFamily,
  type NutritionHealthParts,
} from "@/src/content";
import type {
  Customer,
  GameState,
  NutritionIntent,
  NutritionMetric,
  NutritionMetrics,
  NutritionProfile as CoreNutritionProfile,
  NutritionValue as CoreNutritionValue,
  SimulationCatalog,
} from "@/src/game/core";
import type {
  HealthConditionId,
  RuntimeCustomerNutritionSummary,
  RuntimeNutritionFamilySummary,
  RuntimeNutritionProfileSummary,
  RuntimeNutritionPulse,
} from "./types";

/**
 * Copies an authored nutrition profile into the core profile shape.
 *
 * @param source - Authored profile from `getNutritionProfile`, or `undefined`.
 * @returns A core profile with copied nested records, or `undefined` when there is no source.
 */
export function coreNutritionProfile(
  source: ReturnType<typeof getNutritionProfile>,
): CoreNutritionProfile | undefined {
  if (!source) return undefined;
  return {
    id: source.id,
    dishId: source.dishId,
    status: source.status,
    serving: source.serving ? { ...source.serving } : undefined,
    nutrients: Object.fromEntries(
      Object.entries(source.nutrients).map(([metric, value]) => [metric, { ...value }]),
    ) as Readonly<Record<NutritionMetric, CoreNutritionValue>>,
    intentFits: { ...source.intentFits } as Partial<Record<NutritionIntent, number>>,
    nutritionClass: source.nutritionClass,
    healthRating: source.healthRating,
    conditionRatings: source.conditionRatings
      ? { ...source.conditionRatings }
      : undefined,
  };
}

/**
 * The generated parts of each meal profile's Health rating, by profile ID. The HUD summary reads
 * them here rather than from the core profile, so they never enter the simulation or a save.
 */
const HEALTH_PARTS_BY_PROFILE_ID: ReadonlyMap<string, NutritionHealthParts> = new Map(
  NUTRITION_CONTENT.profiles.flatMap((profile) =>
    profile.healthParts ? [[profile.id, profile.healthParts] as const] : [],
  ),
);

/**
 * Returns a visual key only for a reviewed member of a real variant family.
 *
 * @param dishId - Dish whose variant family is searched, if any.
 * @param variantId - Variant ID to look up, if any.
 * @returns The variant's visual key, or undefined when either ID is missing or the variant is not in the dish's family.
 */
export function nutritionVisualKeyForVariant(
  dishId: string | undefined,
  variantId: string | undefined,
): string | undefined {
  if (!dishId || !variantId) return undefined;
  return getNutritionVariantFamily(dishId)?.variants.find(
    (variant) => variant.id === variantId,
  )?.visualKey;
}

/**
 * Summarises a core nutrition profile for the HUD and inspector snapshots.
 *
 * @param profile - Core profile, or `undefined` when the dish has none.
 * @returns The runtime summary, with the meal's Health rating parts looked up by profile ID, or
 *   `undefined` when there is no profile.
 */
export function runtimeNutritionProfile(
  profile: CoreNutritionProfile | undefined,
): RuntimeNutritionProfileSummary | undefined {
  if (!profile) return undefined;
  return {
    status: profile.status,
    servingLabel: profile.serving?.label,
    energyKcal: profile.nutrients.energyKcal,
    proteinG: profile.nutrients.proteinG,
    totalFatG: profile.nutrients.totalFatG,
    saturatedFatG: profile.nutrients.saturatedFatG,
    transFatG: profile.nutrients.transFatG,
    carbohydrateG: profile.nutrients.carbohydrateG,
    dietaryFibreG: profile.nutrients.dietaryFibreG,
    sodiumMg: profile.nutrients.sodiumMg,
    totalSugarG: profile.nutrients.totalSugarG,
    calciumMg: profile.nutrients.calciumMg,
    ironMg: profile.nutrients.ironMg,
    waterG: profile.nutrients.waterG,
    healthRating: profile.healthRating,
    healthParts: HEALTH_PARTS_BY_PROFILE_ID.get(profile.id),
    conditionRatings: profile.conditionRatings
      ? { ...profile.conditionRatings }
      : undefined,
    intentFits: { ...profile.intentFits },
  };
}

/** The player-facing label of each simulated health condition, shared with the UI. */
export const HEALTH_CONDITION_LABELS: Readonly<Record<HealthConditionId, string>> = {
  "high-cholesterol": "Managing high cholesterol",
  obesity: "Managing obesity",
  diabetes: "Managing diabetes",
  hypertension: "Managing hypertension",
};

const HEALTH_CONDITION_NUTRIENTS: Readonly<Record<HealthConditionId, string>> = {
  "high-cholesterol": "total, saturated and trans fat, fibre, and energy",
  obesity: "energy, total and saturated fat, sugar, fibre, and protein",
  diabetes: "carbohydrate, total sugar, fibre, energy, and protein",
  hypertension: "sodium, energy, saturated fat, fibre, and protein",
};

interface CustomerHealthDecisionSource {
  readonly healthConditions?: readonly HealthConditionId[];
  readonly orderedNutritionProfile?: CoreNutritionProfile;
}

/**
 * Explains the condition-specific score without turning it into medical advice.
 *
 * @param customer - Customer with health conditions and the nutrition profile of the dish they ordered.
 * @returns One reason per distinct condition with a finite rating on a released profile, otherwise none.
 */
export function customerHealthDecisionReasons(
  customer: CustomerHealthDecisionSource,
): readonly string[] {
  const profile = customer.orderedNutritionProfile;
  if (!profile || profile.status !== "released") return [];

  return [...new Set(customer.healthConditions ?? [])].flatMap((condition) => {
    const rating = profile.conditionRatings?.[condition];
    if (typeof rating !== "number" || !Number.isFinite(rating)) return [];
    return [
      `${HEALTH_CONDITION_LABELS[condition]} fit ${rating.toFixed(1)}/5 is led by ${HEALTH_CONDITION_NUTRIENTS[condition]}`,
    ];
  });
}

/**
 * Lists up to two plain-language reasons a customer chose their ordered dish.
 *
 * @param customer - Customer with an ordered dish and, optionally, a nutrition intent.
 * @param catalog - Catalog that defines the dish and the customer's archetype.
 * @returns At most two distinct reasons, or none when the dish or archetype is unknown.
 */
export function customerDecisionReasons(
  customer: Pick<
    Customer,
    "archetypeId" | "nutritionIntentId" | "orderedDishId" | "orderedNutritionProfile"
  >,
  catalog: SimulationCatalog,
): readonly string[] {
  const dish = customer.orderedDishId
    ? catalog.dishes[customer.orderedDishId]
    : undefined;
  const archetype = catalog.archetypes[customer.archetypeId];
  if (!dish || !archetype) return [];

  const reasons: string[] = [];
  const preferred = new Set(archetype.preferenceTags ?? []);
  if ((dish.preferenceTags ?? []).some((tag) => preferred.has(tag))) {
    reasons.push("Familiar flavour preference");
  }

  if (customer.nutritionIntentId) {
    const fit = customer.orderedNutritionProfile?.intentFits[customer.nutritionIntentId];
    if (typeof fit === "number" && Number.isFinite(fit)) {
      reasons.push(fit >= 0.67 ? "Visit intent fit" : "Nutrition trade-off");
    }
  }

  if (dish.price <= archetype.budget) reasons.push("Price within visit budget");
  if (dish.quality * archetype.qualitySensitivity > 0) reasons.push("Menu quality");
  return [...new Set(reasons)].slice(0, 2);
}

/**
 * Returns the reviewed default variant for every nutrition variant family.
 *
 * @returns The default variant ID keyed by dish ID, in variant-family order.
 */
export function defaultDishVariants(): Readonly<Record<string, string>> {
  return Object.fromEntries(
    NUTRITION_CONTENT.variantFamilies.map((family) => [
      family.dishId,
      family.defaultVariantId,
    ]),
  );
}

/**
 * Finds the highest stall mastery rank among the stalls that serve a dish.
 *
 * @param progression - Progression whose stall mastery holds each stall's rank.
 * @param dishId - The dish whose serving stalls are checked.
 * @returns The best rank of any stall that lists the dish, and at least 1.
 */
export function compute_dish_mastery_rank(
  progression: Pick<GameState["progression"], "stallMastery">,
  dishId: string,
): number {
  const stallRanks = STALLS
    .filter((stall) => stall.dishIds.includes(dishId))
    .map((stall) => progression.stallMastery[stall.id]?.rank ?? 1);
  return Math.max(1, ...stallRanks);
}

/**
 * Resolves the player's variant choices against the variants their stall ranks unlock.
 *
 * Unknown dishes, missing families, unknown variants and variants above the unlocked rank fall
 * back to the family default and mark the result as recovered.
 *
 * @param value - Persisted variant map, or `undefined` for a save without one.
 * @param state - Progression whose stall mastery ranks gate each variant.
 * @returns The resolved selection per family and whether any choice had to be reset.
 */
export function resolveDishVariants(
  value: unknown,
  state: Pick<GameState, "progression">,
): {
  readonly selections: Readonly<Record<string, string>>;
  readonly recovered: boolean;
} {
  const isVariantMap = value !== null && typeof value === "object" && !Array.isArray(value);
  const source = isVariantMap
    ? value as Readonly<Record<string, unknown>>
    : {};
  const familyIds = new Set(
    NUTRITION_CONTENT.variantFamilies.map((family) => family.dishId),
  );
  let recovered =
    (value !== undefined && !isVariantMap) ||
    Object.keys(source).some((dishId) => !familyIds.has(dishId)) ||
    (value !== undefined && [...familyIds].some((dishId) => !Object.hasOwn(source, dishId)));
  const selections = Object.fromEntries(NUTRITION_CONTENT.variantFamilies.map((family) => {
    const rank = compute_dish_mastery_rank(state.progression, family.dishId);
    const requested = source[family.dishId];
    const variant = typeof requested === "string"
      ? family.variants.find((candidate) => candidate.id === requested)
      : undefined;
    if (requested !== undefined && (!variant || variant.unlockRank > rank)) recovered = true;
    return [
      family.dishId,
      variant && variant.unlockRank <= rank ? variant.id : family.defaultVariantId,
    ];
  }));
  return { selections, recovered };
}

/**
 * Summarises every nutrition variant family for the HUD, with unlock and selection state.
 *
 * @param progression - Progression whose stall mastery ranks gate each variant.
 * @param catalog - Layered catalog that holds each dish's star rating and core variant profiles.
 * @param active_dish_variants - The active variant of each dish family; a missing family uses its default.
 * @returns One summary per variant family, in variant-family order.
 */
export function build_nutrition_families(
  progression: Pick<GameState["progression"], "stallMastery">,
  catalog: SimulationCatalog,
  active_dish_variants: Readonly<Record<string, string>>,
): readonly RuntimeNutritionFamilySummary[] {
  return NUTRITION_CONTENT.variantFamilies.map((family) => {
    const rank = compute_dish_mastery_rank(progression, family.dishId);
    const dish = catalog.dishes[family.dishId];
    const starRating = dish?.starRating;
    const activeVariantId = active_dish_variants[family.dishId] ?? family.defaultVariantId;
    return {
      dishId: family.dishId,
      starRating,
      defaultVariantId: family.defaultVariantId,
      activeVariantId,
      variants: family.variants.map((variant) => {
        const coreVariant = dish?.nutritionVariants?.find(
          (candidate) => candidate.id === variant.id,
        );
        return {
          id: variant.id,
          label: variant.name,
          unlockRank: variant.unlockRank,
          profileId: variant.profileId,
          visualKey: variant.visualKey,
          unlocked: variant.unlockRank <= rank,
          selected: variant.id === activeVariantId,
          profile: runtimeNutritionProfile(coreVariant?.profile),
        };
      }),
    };
  });
}

/**
 * Summarises today's nutrition metrics for the HUD pulse.
 *
 * When the stored daily metrics belong to an earlier day, the pulse reads as an empty day, so the
 * HUD resets at the day rollover before the simulation records the new day's first sale.
 *
 * @param nutrition - Nutrition metrics of the current state.
 * @param day - The current one-based operating day.
 * @returns Today's counts, the averages of the compact nutrients with known values, the most
 *   served dish and the intent with the most misses and unknowns, ties broken by ID.
 */
export function build_nutrition_pulse(
  nutrition: NutritionMetrics,
  day: number,
): RuntimeNutritionPulse {
  const emptyToday = {
    day,
    servedMeals: 0,
    profiledServings: 0,
    intentRequests: 0,
    intentMatches: 0,
    intentMisses: 0,
    intentUnknowns: 0,
    byIntent: Object.fromEntries(
      Object.keys(nutrition.byIntent).map((intent) => [
        intent,
        { requests: 0, matches: 0, misses: 0, unknowns: 0 },
      ]),
    ) as NutritionMetrics["byIntent"],
    nutrientTotals: {} as Readonly<Record<NutritionMetric, number>>,
    nutrientKnownCounts: {} as Readonly<Record<NutritionMetric, number>>,
    dishServings: {} as Readonly<Record<string, number>>,
  };
  const nutritionToday = nutrition.today.day === day
    ? nutrition.today
    : emptyToday;
  const compactMetrics = [
    "energyKcal",
    "proteinG",
    "dietaryFibreG",
    "sodiumMg",
  ] as const;
  const nutritionAverages = Object.fromEntries(compactMetrics.flatMap((metric) => {
    const count = nutritionToday.nutrientKnownCounts[metric] ?? 0;
    return count > 0 ? [[metric, nutritionToday.nutrientTotals[metric] / count]] : [];
  }));
  const mostServedDishId = Object.entries(nutritionToday.dishServings)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
  const leadingUnmetIntent = Object.entries(nutritionToday.byIntent)
    .map(([intent, metrics]) => [
      intent as NutritionIntent,
      metrics.misses + metrics.unknowns,
    ] as const)
    .filter((entry) => entry[1] > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
  return {
    servedMeals: nutritionToday.servedMeals,
    profiledMeals: nutritionToday.profiledServings,
    intentRequests: nutritionToday.intentRequests,
    intentMatches: nutritionToday.intentMatches,
    intentMisses: nutritionToday.intentMisses,
    intentUnknowns: nutritionToday.intentUnknowns,
    averages: nutritionAverages,
    knownCounts: {
      energyKcal: nutritionToday.nutrientKnownCounts.energyKcal ?? 0,
      proteinG: nutritionToday.nutrientKnownCounts.proteinG ?? 0,
      dietaryFibreG: nutritionToday.nutrientKnownCounts.dietaryFibreG ?? 0,
      sodiumMg: nutritionToday.nutrientKnownCounts.sodiumMg ?? 0,
    },
    mostServedDishId,
    leadingUnmetIntent,
  };
}

/**
 * Summarises a customer's order, nutrition request and health fit for the HUD inspector.
 *
 * @param customer - The selected customer.
 * @param catalog - Layered catalog that defines the customer's dish and archetype.
 * @returns The inspector summary, with decision reasons and the ordered profile.
 */
export function build_customer_nutrition(
  customer: Customer,
  catalog: SimulationCatalog,
): RuntimeCustomerNutritionSummary {
  return {
    customerId: customer.id,
    archetypeId: customer.archetypeId,
    status: customer.status,
    decisionReasons: customerDecisionReasons(customer, catalog),
    intentId: customer.nutritionIntentId,
    dishId: customer.orderedDishId,
    variantId: customer.orderedNutritionVariantId,
    requestResult: customer.nutritionRequestResult,
    healthConditionIds: customer.healthConditions ?? [],
    personalizedHealthRating: customer.personalizedHealthRating,
    healthImpact: customer.healthImpact,
    healthPreferenceResult: customer.healthPreferenceResult,
    healthDecisionReasons: customerHealthDecisionReasons({
      healthConditions: customer.healthConditions,
      orderedNutritionProfile: customer.orderedNutritionProfile,
    }),
    profile: runtimeNutritionProfile(customer.orderedNutritionProfile),
  };
}
