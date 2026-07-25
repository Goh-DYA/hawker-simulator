import { DISHES } from "./dishes";
import { NUTRITION_CONTENT } from "./nutrition";
import type {
  DishDefinition,
  HealthCondition,
  NutritionIntentId,
  NutritionProfile,
  NutritionVariant,
} from "./types";
import {
  VARIANT_TRADEOFF_AXES,
  createServingTerms,
  findDominatedVariants,
  scoreVariantContext,
  type VariantContextWeights,
  type VariantTradeoff,
  type VariantWinningContext,
} from "../game/core/servingTerms";
import {
  HEALTH_PREFERENCE_MATCH_THRESHOLD,
  NUTRITION_INTENT_MATCH_THRESHOLD,
} from "../game/core/nutrition";
import type { MealRole } from "../game/core/mealComposition";

export type { MealRole } from "../game/core/mealComposition";

/** Explicit gameplay-role review for every authored dish. */
export const REVIEWED_MEAL_ROLES: Readonly<Record<string, MealRole>> = Object.freeze({
  "dish.poached-chicken-rice": "main",
  "dish.roast-chicken-rice": "main",
  "dish.soya-tofu-rice": "main",
  "dish.chicken-congee": "main",
  "dish.nasi-lemak": "main",
  "dish.mee-rebus": "main",
  "dish.soto-ayam": "main",
  "dish.lontong-sayur": "main",
  "dish.kopi": "drink",
  "dish.sugarcane-juice": "drink",
  "dish.ice-kacang": "side",
  "dish.char-kway-teow": "main",
  "dish.hokkien-prawn-mee": "main",
  "dish.fried-carrot-cake": "main",
  "dish.oyster-omelette": "side",
  "dish.roti-prata": "main",
  "dish.mee-goreng-mamak": "main",
  "dish.chicken-murtabak": "main",
  "dish.nasi-briyani": "main",
  "dish.masala-thosai": "main",
  "dish.idli-sambar": "main",
  "dish.vadai-set": "side",
  "dish.lemon-rice": "main",
  "dish.nyonya-laksa": "main",
  "dish.ayam-buah-keluak": "side",
  "dish.chap-chye": "side",
  "dish.babi-pongteh": "side",
  "dish.sambal-stingray": "main",
  "dish.sliced-fish-soup": "main",
  "dish.black-pepper-crab": "main",
  "dish.bak-chor-mee": "main",
  "dish.fishball-mee-pok": "main",
  "dish.lor-mee": "main",
  "dish.teochew-fish-dumpling-soup": "main",
  "dish.chendol": "side",
  "dish.tau-huay": "side",
  "dish.teh-tarik": "drink",
  "dish.pulut-hitam": "side",
  "dish.chicken-satay-set": "main",
  "dish.bbq-chicken-wings": "side",
  "dish.beef-satay-set": "main",
  "dish.sambal-grilled-squid": "side",
  "dish.har-gow": "side",
  "dish.siew-mai": "side",
  "dish.char-siew-bao": "main",
  "dish.lotus-leaf-rice": "main",
  "dish.yong-tau-foo": "main",
  "dish.ban-mian": "main",
  "dish.thunder-tea-rice": "main",
  "dish.popiah": "side",
  "dish.bak-kut-teh": "main",
  "dish.duck-rice": "main",
  "dish.kway-chap": "main",
  "dish.claypot-chicken-rice": "main",
});

declare const INTEGER_CENTS: unique symbol;
export type IntegerCents = number & { readonly [INTEGER_CENTS]: "IntegerCents" };

export interface PreparationGameplayTerms {
  readonly priceCents: IntegerCents;
  readonly ingredientCostCents: IntegerCents;
  readonly ingredientCostBasisPoints: number;
  readonly preparationTimeMs: number;
  readonly servingTimeMs: number;
  readonly eatingTimeMs: number;
  readonly starAppeal: number;
  readonly demandModifierBasisPoints: number;
}

export interface PreparationNutritionAudit {
  readonly profileId: string;
  readonly status: NutritionProfile["status"];
  readonly sourceFile?: string;
  readonly sourceFileSha256?: string;
  readonly sourceRowNumber?: number;
  readonly sourceFoodName?: string;
  readonly sourceRowSha256?: string;
  readonly mappingKind?: "exact" | "curated-synonym" | "scaled-exact";
  readonly servingLabel?: string;
  readonly reviewNote: string;
}

export interface PreparationGameplayDefinition {
  readonly id: string;
  readonly dishId: string;
  readonly variantId?: string;
  readonly profileId: string;
  readonly unlockRank: 1 | 2 | 4 | 7;
  readonly isDefault: boolean;
  readonly mealRole: MealRole;
  readonly terms: PreparationGameplayTerms;
  readonly nutritionFitByIntent: Readonly<Partial<Record<NutritionIntentId, number>>>;
  readonly conditionFitByCondition: Readonly<
    Partial<Record<HealthCondition, number>>
  >;
  readonly nutritionAudit: PreparationNutritionAudit;
  readonly operationalReviewNote: string;
  readonly ingredientCostException?: string;
}

export interface PreparationWinningContext extends VariantWinningContext {
  /** Stable scenario seed used to choose the represented nutrition need. */
  readonly seed: number;
  readonly preparationId: string;
}

export interface PreparationFamilyReview {
  readonly dishId: string;
  readonly preparationIds: readonly string[];
  readonly winningContexts: readonly PreparationWinningContext[];
}

export interface PreparationContentIssue {
  readonly code:
    | "dish-role-coverage"
    | "preparation-coverage"
    | "invalid-cents"
    | "invalid-terms"
    | "unfrozen-terms"
    | "base-price"
    | "ingredient-band"
    | "nutrition-provenance"
    | "operational-review"
    | "dominant-preparation"
    | "missing-winning-context"
    | "matrix-axis-coverage";
  readonly subjectId: string;
  readonly message: string;
}

const MIN_INGREDIENT_BASIS_POINTS = 2_800;
const MAX_INGREDIENT_BASIS_POINTS = 4_200;
const MIN_VARIANT_INGREDIENT_BASIS_POINTS = 3_200;
const MAX_VARIANT_INGREDIENT_BASIS_POINTS = 3_800;
export const MAX_VARIANT_PRICE_PREMIUM_BASIS_POINTS = 1_800;
export const MIN_VARIANT_PRICE_BASIS_POINTS = 5_000;
const VARIANT_PRICE_INCREMENT_CENTS = 10;
const FOOD_SOURCE_FILE = "food_nutrition_sgfoodid_combined_nutrition_subset.csv";

function integerCents(value: number): IntegerCents {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid integer cents value ${value}.`);
  }
  return value as IntegerCents;
}

/** Integer half-up basis-point multiplication; nutrition never enters this calculation. */
export function ingredientCostFromBasisPoints(
  priceCents: number,
  basisPoints: number,
): IntegerCents {
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new Error("Price must be non-negative integer cents.");
  }
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new Error("Ingredient rate must be non-negative integer basis points.");
  }
  return integerCents(Math.floor((priceCents * basisPoints + 5_000) / 10_000));
}

function preparationId(dishId: string, variantId?: string): string {
  return `${dishId}::${variantId ?? "base"}`;
}

function auditProfile(profile: NutritionProfile): PreparationNutritionAudit {
  const provenance = profile.provenance;
  return Object.freeze({
    profileId: profile.id,
    status: profile.status,
    sourceFile: provenance?.sourceFile,
    sourceFileSha256: provenance?.sourceFileSha256,
    sourceRowNumber: provenance?.sourceRowNumber,
    sourceFoodName: provenance?.sourceFoodName,
    sourceRowSha256: provenance?.sourceRowSha256,
    mappingKind: provenance?.mappingKind,
    servingLabel: profile.serving?.label,
    reviewNote: "Operational terms only; the existing reviewed nutrition mapping and serving interpretation are unchanged.",
  });
}

function variantProfilesById(): Readonly<Record<string, NutritionProfile>> {
  return Object.freeze(Object.fromEntries(NUTRITION_CONTENT.profiles.map((profile) => [
    profile.id,
    profile,
  ])));
}

const PROFILE_BY_ID = variantProfilesById();
const FAMILY_BY_DISH_ID = new Map(
  NUTRITION_CONTENT.variantFamilies.map((family) => [family.dishId, family]),
);

interface OperationalProfile {
  readonly priceBasisPoints: number;
  readonly ingredientCostBasisPoints: number;
  readonly preparationBasisPoints: number;
  readonly servingBasisPoints: number;
  readonly eatingBasisPoints: number;
  readonly starAppealDeltaTenths: number;
  readonly demandModifierBasisPoints: number;
}

const OPERATIONAL_PROFILES = {
  baseline: { priceBasisPoints: 10_000, ingredientCostBasisPoints: 3_500, preparationBasisPoints: 10_000, servingBasisPoints: 10_000, eatingBasisPoints: 10_000, starAppealDeltaTenths: 0, demandModifierBasisPoints: 10_000 },
  "practised-staple": { priceBasisPoints: 10_000, ingredientCostBasisPoints: 3_500, preparationBasisPoints: 7_500, servingBasisPoints: 7_500, eatingBasisPoints: 8_000, starAppealDeltaTenths: 0, demandModifierBasisPoints: 10_000 },
  "reduced-sugar": { priceBasisPoints: 10_000, ingredientCostBasisPoints: 3_400, preparationBasisPoints: 10_000, servingBasisPoints: 10_000, eatingBasisPoints: 10_000, starAppealDeltaTenths: -1, demandModifierBasisPoints: 9_800 },
  "simple-drink": { priceBasisPoints: 9_500, ingredientCostBasisPoints: 3_300, preparationBasisPoints: 9_000, servingBasisPoints: 9_200, eatingBasisPoints: 10_000, starAppealDeltaTenths: -1, demandModifierBasisPoints: 9_700 },
  "simple-reduced-sugar": { priceBasisPoints: 9_500, ingredientCostBasisPoints: 3_200, preparationBasisPoints: 9_000, servingBasisPoints: 9_200, eatingBasisPoints: 10_000, starAppealDeltaTenths: -2, demandModifierBasisPoints: 9_500 },
  "dairy-swap": { priceBasisPoints: 11_000, ingredientCostBasisPoints: 3_600, preparationBasisPoints: 10_500, servingBasisPoints: 10_300, eatingBasisPoints: 10_000, starAppealDeltaTenths: 1, demandModifierBasisPoints: 10_300 },
  "dairy-unsweetened": { priceBasisPoints: 10_500, ingredientCostBasisPoints: 3_500, preparationBasisPoints: 10_200, servingBasisPoints: 10_000, eatingBasisPoints: 10_000, starAppealDeltaTenths: 0, demandModifierBasisPoints: 9_900 },
  black: { priceBasisPoints: 9_000, ingredientCostBasisPoints: 3_200, preparationBasisPoints: 9_200, servingBasisPoints: 9_200, eatingBasisPoints: 9_500, starAppealDeltaTenths: -2, demandModifierBasisPoints: 9_400 },
  "black-unsweetened": { priceBasisPoints: 8_500, ingredientCostBasisPoints: 3_200, preparationBasisPoints: 9_000, servingBasisPoints: 9_000, eatingBasisPoints: 9_500, starAppealDeltaTenths: -3, demandModifierBasisPoints: 9_000 },
  enhanced: { priceBasisPoints: 10_800, ingredientCostBasisPoints: 3_600, preparationBasisPoints: 10_800, servingBasisPoints: 10_400, eatingBasisPoints: 10_500, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_400 },
  loaded: { priceBasisPoints: 11_800, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 12_500, servingBasisPoints: 11_000, eatingBasisPoints: 11_200, starAppealDeltaTenths: 4, demandModifierBasisPoints: 11_000 },
  "premium-protein": { priceBasisPoints: 11_200, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 11_200, servingBasisPoints: 10_600, eatingBasisPoints: 10_800, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_500 },
  seafood: { priceBasisPoints: 11_500, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 11_500, servingBasisPoints: 10_600, eatingBasisPoints: 11_000, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_600 },
  "value-set": { priceBasisPoints: 9_200, ingredientCostBasisPoints: 3_400, preparationBasisPoints: 10_000, servingBasisPoints: 10_000, eatingBasisPoints: 10_000, starAppealDeltaTenths: 0, demandModifierBasisPoints: 9_800 },
  vegetable: { priceBasisPoints: 9_200, ingredientCostBasisPoints: 3_300, preparationBasisPoints: 10_000, servingBasisPoints: 10_000, eatingBasisPoints: 10_000, starAppealDeltaTenths: -1, demandModifierBasisPoints: 9_600 },
  "reduced-portion": { priceBasisPoints: 5_500, ingredientCostBasisPoints: 3_200, preparationBasisPoints: 6_500, servingBasisPoints: 7_000, eatingBasisPoints: 7_500, starAppealDeltaTenths: -5, demandModifierBasisPoints: 8_200 },
  "plain-single": { priceBasisPoints: 5_000, ingredientCostBasisPoints: 3_200, preparationBasisPoints: 6_200, servingBasisPoints: 6_500, eatingBasisPoints: 6_500, starAppealDeltaTenths: -5, demandModifierBasisPoints: 8_000 },
  plain: { priceBasisPoints: 7_500, ingredientCostBasisPoints: 3_200, preparationBasisPoints: 7_800, servingBasisPoints: 8_500, eatingBasisPoints: 8_500, starAppealDeltaTenths: -3, demandModifierBasisPoints: 9_000 },
  "single-egg": { priceBasisPoints: 7_500, ingredientCostBasisPoints: 3_400, preparationBasisPoints: 8_000, servingBasisPoints: 8_000, eatingBasisPoints: 7_500, starAppealDeltaTenths: -2, demandModifierBasisPoints: 9_200 },
  "single-egg-onion": { priceBasisPoints: 8_500, ingredientCostBasisPoints: 3_500, preparationBasisPoints: 9_000, servingBasisPoints: 8_800, eatingBasisPoints: 8_500, starAppealDeltaTenths: -1, demandModifierBasisPoints: 9_600 },
  "cheese-loaded": { priceBasisPoints: 11_500, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 11_000, servingBasisPoints: 10_500, eatingBasisPoints: 10_500, starAppealDeltaTenths: 3, demandModifierBasisPoints: 10_600 },
  "sauce-rich": { priceBasisPoints: 10_500, ingredientCostBasisPoints: 3_600, preparationBasisPoints: 10_800, servingBasisPoints: 10_500, eatingBasisPoints: 10_500, starAppealDeltaTenths: 1, demandModifierBasisPoints: 10_300 },
  "milk-added": { priceBasisPoints: 10_500, ingredientCostBasisPoints: 3_600, preparationBasisPoints: 10_500, servingBasisPoints: 10_300, eatingBasisPoints: 10_000, starAppealDeltaTenths: 1, demandModifierBasisPoints: 10_200 },
  "no-noodles": { priceBasisPoints: 9_000, ingredientCostBasisPoints: 3_300, preparationBasisPoints: 8_500, servingBasisPoints: 9_000, eatingBasisPoints: 8_500, starAppealDeltaTenths: -2, demandModifierBasisPoints: 9_000 },
  "lighter-milk": { priceBasisPoints: 9_500, ingredientCostBasisPoints: 3_500, preparationBasisPoints: 9_000, servingBasisPoints: 9_500, eatingBasisPoints: 8_500, starAppealDeltaTenths: -1, demandModifierBasisPoints: 9_400 },
  "soup-value": { priceBasisPoints: 9_500, ingredientCostBasisPoints: 3_300, preparationBasisPoints: 10_300, servingBasisPoints: 10_600, eatingBasisPoints: 11_000, starAppealDeltaTenths: -1, demandModifierBasisPoints: 9_700 },
  fried: { priceBasisPoints: 10_500, ingredientCostBasisPoints: 3_700, preparationBasisPoints: 11_200, servingBasisPoints: 10_500, eatingBasisPoints: 10_500, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_400 },
  mixed: { priceBasisPoints: 10_300, ingredientCostBasisPoints: 3_600, preparationBasisPoints: 10_600, servingBasisPoints: 10_300, eatingBasisPoints: 10_300, starAppealDeltaTenths: 1, demandModifierBasisPoints: 10_200 },
  "noodle-added": { priceBasisPoints: 11_200, ingredientCostBasisPoints: 3_700, preparationBasisPoints: 11_000, servingBasisPoints: 10_600, eatingBasisPoints: 11_800, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_600 },
  laksa: { priceBasisPoints: 11_000, ingredientCostBasisPoints: 3_700, preparationBasisPoints: 11_200, servingBasisPoints: 10_800, eatingBasisPoints: 10_800, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_500 },
  "laksa-fried": { priceBasisPoints: 11_800, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 12_500, servingBasisPoints: 11_200, eatingBasisPoints: 11_200, starAppealDeltaTenths: 4, demandModifierBasisPoints: 11_000 },
  "laksa-mixed": { priceBasisPoints: 11_500, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 11_800, servingBasisPoints: 11_000, eatingBasisPoints: 11_000, starAppealDeltaTenths: 3, demandModifierBasisPoints: 10_800 },
  "laksa-noodles": { priceBasisPoints: 11_800, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 12_000, servingBasisPoints: 11_000, eatingBasisPoints: 12_000, starAppealDeltaTenths: 4, demandModifierBasisPoints: 11_000 },
  dry: { priceBasisPoints: 10_300, ingredientCostBasisPoints: 3_500, preparationBasisPoints: 9_300, servingBasisPoints: 9_200, eatingBasisPoints: 9_500, starAppealDeltaTenths: 1, demandModifierBasisPoints: 10_200 },
  spicy: { priceBasisPoints: 10_600, ingredientCostBasisPoints: 3_600, preparationBasisPoints: 10_600, servingBasisPoints: 10_400, eatingBasisPoints: 10_500, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_600 },
  dumpling: { priceBasisPoints: 11_500, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 12_000, servingBasisPoints: 10_800, eatingBasisPoints: 11_200, starAppealDeltaTenths: 3, demandModifierBasisPoints: 10_800 },
  "tom-yum": { priceBasisPoints: 11_800, ingredientCostBasisPoints: 3_800, preparationBasisPoints: 12_500, servingBasisPoints: 11_000, eatingBasisPoints: 11_200, starAppealDeltaTenths: 4, demandModifierBasisPoints: 11_000 },
  herbal: { priceBasisPoints: 10_500, ingredientCostBasisPoints: 3_600, preparationBasisPoints: 11_200, servingBasisPoints: 10_600, eatingBasisPoints: 10_800, starAppealDeltaTenths: 1, demandModifierBasisPoints: 10_300 },
  roasted: { priceBasisPoints: 10_800, ingredientCostBasisPoints: 3_700, preparationBasisPoints: 10_800, servingBasisPoints: 10_400, eatingBasisPoints: 10_500, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_500 },
  "egg-added": { priceBasisPoints: 10_800, ingredientCostBasisPoints: 3_600, preparationBasisPoints: 11_000, servingBasisPoints: 10_500, eatingBasisPoints: 10_500, starAppealDeltaTenths: 2, demandModifierBasisPoints: 10_400 },
  ghee: { priceBasisPoints: 10_500, ingredientCostBasisPoints: 3_700, preparationBasisPoints: 10_500, servingBasisPoints: 10_300, eatingBasisPoints: 10_000, starAppealDeltaTenths: 3, demandModifierBasisPoints: 10_600 },
} as const satisfies Readonly<Record<string, OperationalProfile>>;

type OperationalProfileId = keyof typeof OPERATIONAL_PROFILES;

export interface ReviewedPreparationOperation {
  readonly profile: OperationalProfileId;
  readonly rationale: string;
}

export const REVIEWED_PREPARATION_OPERATIONS: Readonly<
  Record<string, ReviewedPreparationOperation>
> = Object.freeze({
  "dish.poached-chicken-rice::base": { profile: "practised-staple", rationale: "The starter stall batches rice and broth for faster preparation and handover; its familiar single plate also shortens dwell, while price, cost share, appeal, and demand stay unchanged." },
  "dish.kopi::kopi-default": { profile: "baseline", rationale: "The listed kopi remains the family baseline for price, pace, appeal, and demand." },
  "dish.kopi::kopi-siu-dai": { profile: "reduced-sugar", rationale: "Reducing sugar keeps the same cup and preparation steps, with slightly lower broad appeal rather than an automatic premium." },
  "dish.kopi::kopi-c": { profile: "dairy-swap", rationale: "Evaporated milk adds ingredient cost and one handling step, supporting a small premium and appeal lift." },
  "dish.kopi::kopi-c-kosong": { profile: "dairy-unsweetened", rationale: "Evaporated milk retains the added handling, while no sugar tempers demand and avoids a full dairy-swap premium." },
  "dish.kopi::kopi-o": { profile: "black", rationale: "Black coffee uses fewer ingredients and is quicker, trading away some mass appeal for affordability." },
  "dish.kopi::kopi-o-kosong": { profile: "black-unsweetened", rationale: "Black unsweetened coffee is the simplest, quickest cup and the lowest-price specialist option." },

  "dish.teh-tarik::teh-tarik": { profile: "baseline", rationale: "The pulled milk tea remains the family baseline." },
  "dish.teh-tarik::teh": { profile: "simple-drink", rationale: "Standard tea removes the pulling step, lowering price and time with a modest appeal trade-off." },
  "dish.teh-tarik::teh-siu-dai": { profile: "simple-reduced-sugar", rationale: "Less-sweet tea remains simple and affordable, while serving a narrower preference than pulled milk tea." },
  "dish.teh-tarik::teh-c": { profile: "dairy-swap", rationale: "Evaporated milk adds ingredient cost and handling for a modest premium and appeal gain." },
  "dish.teh-tarik::teh-c-kosong": { profile: "dairy-unsweetened", rationale: "The dairy step remains but no sugar limits broad demand and keeps the premium smaller." },
  "dish.teh-tarik::teh-o": { profile: "black", rationale: "Black tea is cheaper and faster because it omits milk, balanced by lower general appeal." },
  "dish.teh-tarik::teh-o-kosong": { profile: "black-unsweetened", rationale: "Black unsweetened tea is the family’s leanest operational choice and its most specialised demand profile." },

  "dish.nasi-lemak::nasi-lemak-chicken-wing": { profile: "practised-staple", rationale: "The starter stall batches coconut rice and condiments for faster preparation and handover; its familiar wing plate also shortens dwell, while price, cost share, appeal, and demand stay unchanged." },
  "dish.nasi-lemak::nasi-lemak-chicken-cutlet": { profile: "enhanced", rationale: "The cutlet set adds a modest preparation and ingredient burden in exchange for appeal and contribution." },
  "dish.nasi-lemak::nasi-lemak-wing-cutlet": { profile: "loaded", rationale: "Serving both wing and cutlet is the largest set, with the highest cost and preparation time as well as stronger appeal." },
  "dish.nasi-lemak::nasi-lemak-egg-ikan-bilis-peanut": { profile: "value-set", rationale: "The accompaniment-led set is priced below the chicken set without pretending it is faster or inherently more desirable." },
  "dish.nasi-lemak::nasi-lemak-fish": { profile: "premium-protein", rationale: "The fish set carries a moderate protein premium and handling time, offset by appeal and demand." },
  "dish.nasi-lemak::nasi-lemak-rice-only": { profile: "reduced-portion", rationale: "Coconut rice alone is a materially smaller serving, so it is cheaper and quicker with lower contribution, appeal, and demand." },

  "dish.fried-carrot-cake::carrot-cake-white": { profile: "baseline", rationale: "White carrot cake remains the family baseline." },
  "dish.fried-carrot-cake::carrot-cake-black": { profile: "sauce-rich", rationale: "Sweet dark sauce adds cost and wok handling, supporting a small appeal-led premium rather than a blanket upgrade." },

  "dish.roti-prata::prata-two-plain-curry": { profile: "baseline", rationale: "Two plain prata with curry remains the full-serving baseline." },
  "dish.roti-prata::prata-plain": { profile: "plain-single", rationale: "One plain prata is a smaller portion than the two-piece curry set and is therefore substantially cheaper and faster." },
  "dish.roti-prata::prata-egg": { profile: "single-egg", rationale: "One egg prata remains below the two-piece set price; the egg adds cost and time relative to one plain prata." },
  "dish.roti-prata::prata-egg-onion": { profile: "single-egg-onion", rationale: "Egg and onion add handling and appeal while keeping the single-piece serving below the full-set price." },
  "dish.roti-prata::prata-egg-onion-cheese": { profile: "cheese-loaded", rationale: "Cheese and multiple fillings justify extra cost and preparation, balanced by higher appeal and demand." },

  "dish.sliced-fish-soup::fish-soup-beehoon-no-milk": { profile: "baseline", rationale: "Fish beehoon without milk remains the complete-bowl baseline." },
  "dish.sliced-fish-soup::fish-soup-beehoon-milk": { profile: "milk-added", rationale: "Milk adds ingredient cost and handling for a small appeal premium." },
  "dish.sliced-fish-soup::fish-soup-sliced-no-milk": { profile: "no-noodles", rationale: "Omitting beehoon makes a lighter, cheaper, quicker bowl with less broad demand." },
  "dish.sliced-fish-soup::fish-soup-sliced-milk": { profile: "lighter-milk", rationale: "Milk adds cost to the noodle-free bowl, which remains cheaper and quicker than the complete beehoon serving." },

  "dish.bak-chor-mee::bak-chor-mee-dry": { profile: "baseline", rationale: "Dry bak chor mee remains the nominal baseline." },
  "dish.bak-chor-mee::bak-chor-mee-soup": { profile: "soup-value", rationale: "The soup version is slightly cheaper but takes longer to serve and eat, creating a clear pace-for-price trade-off." },

  "dish.chicken-murtabak::murtabak-chicken": { profile: "baseline", rationale: "Chicken murtabak remains the family baseline." },
  "dish.chicken-murtabak::murtabak-chicken-mushroom-cheese": { profile: "loaded", rationale: "Chicken, mushroom, and cheese add substantial filling cost and griddle time in exchange for appeal." },
  "dish.chicken-murtabak::murtabak-mutton": { profile: "premium-protein", rationale: "Mutton carries a moderate ingredient and handling premium, offset by appeal and demand." },
  "dish.chicken-murtabak::murtabak-vegetable": { profile: "vegetable", rationale: "Vegetable murtabak is a lower-cost alternative, not an automatic late-list premium or speed upgrade." },

  "dish.nasi-briyani::briyani-chicken": { profile: "baseline", rationale: "Chicken briyani remains the family baseline." },
  "dish.nasi-briyani::briyani-fish-prawn": { profile: "seafood", rationale: "Fish or prawn adds ingredient cost and handling, supporting a bounded premium and appeal gain." },
  "dish.nasi-briyani::briyani-mutton": { profile: "premium-protein", rationale: "Mutton carries a moderate cost and preparation premium with stronger appeal." },
  "dish.nasi-briyani::briyani-vegetable": { profile: "vegetable", rationale: "Vegetable briyani is explicitly cheaper and operationally lighter, with lower broad demand rather than an index-driven premium." },

  "dish.masala-thosai::thosai-masala": { profile: "baseline", rationale: "Masala thosai remains the filled baseline." },
  "dish.masala-thosai::thosai-plain": { profile: "plain", rationale: "Plain thosai omits the masala filling, so it is cheaper and quicker with lower contribution and appeal." },
  "dish.masala-thosai::thosai-egg": { profile: "egg-added", rationale: "Egg adds ingredient cost and griddle time for a modest appeal and demand lift." },
  "dish.masala-thosai::thosai-ghee": { profile: "ghee", rationale: "Ghee adds ingredient cost while primarily lifting aroma and appeal rather than making service faster." },

  "dish.yong-tau-foo::ytf-clear-boiled": { profile: "baseline", rationale: "Clear soup with boiled pieces remains the family baseline." },
  "dish.yong-tau-foo::ytf-clear-fried": { profile: "fried", rationale: "Fried pieces add cost and handling for higher appeal." },
  "dish.yong-tau-foo::ytf-clear-mixed": { profile: "mixed", rationale: "Mixed pieces sit between boiled and fried on cost, pace, and appeal." },
  "dish.yong-tau-foo::ytf-clear-noodles": { profile: "noodle-added", rationale: "Rice or noodles add portion size, cost, service time, and eating time alongside appeal." },
  "dish.yong-tau-foo::ytf-laksa-boiled": { profile: "laksa", rationale: "Laksa broth adds ingredient and handling cost to boiled pieces for stronger appeal." },
  "dish.yong-tau-foo::ytf-laksa-fried": { profile: "laksa-fried", rationale: "Laksa with fried pieces combines both premium operations and therefore takes longer while drawing more demand." },
  "dish.yong-tau-foo::ytf-laksa-mixed": { profile: "laksa-mixed", rationale: "Laksa with mixed pieces is a high-variety option with intermediate premium time and appeal." },
  "dish.yong-tau-foo::ytf-laksa-noodles": { profile: "laksa-noodles", rationale: "Laksa plus rice or noodles is the fullest bowl, with bounded premium, longer dwell, and higher appeal." },

  "dish.ban-mian::ban-mian-soup": { profile: "baseline", rationale: "Ban mian soup remains the family baseline." },
  "dish.ban-mian::ban-mian-dry": { profile: "dry", rationale: "Dry ban mian is a little faster but slightly pricier, exchanging broth service for appeal and demand." },
  "dish.ban-mian::chilli-ban-mian": { profile: "spicy", rationale: "The chilli preparation adds handling and a narrower but stronger appeal profile." },
  "dish.ban-mian::pork-dumpling-ban-mian": { profile: "dumpling", rationale: "Pork dumplings increase ingredient cost, preparation, portion, and appeal." },
  "dish.ban-mian::seafood-tom-yum-ban-mian": { profile: "tom-yum", rationale: "Seafood and tom yum create the most involved bowl, with maximum bounded premium and stronger demand." },
  "dish.ban-mian::vegetable-ban-mian": { profile: "vegetable", rationale: "Vegetable ban mian is a cheaper, lighter alternative with lower mass demand rather than a list-order premium." },

  "dish.bak-kut-teh::bak-kut-teh-soup": { profile: "baseline", rationale: "Soup bak kut teh remains the family baseline." },
  "dish.bak-kut-teh::bak-kut-teh-dry": { profile: "premium-protein", rationale: "The dry preparation adds reduction and handling time for a moderate appeal premium." },
  "dish.bak-kut-teh::bak-kut-teh-herbal": { profile: "herbal", rationale: "Herbal broth takes longer and costs slightly more, serving a distinct aroma preference rather than dominating the baseline." },

  "dish.duck-rice::duck-rice-braised": { profile: "baseline", rationale: "Braised duck rice with egg and tau kwa remains the complete-set baseline." },
  "dish.duck-rice::duck-rice-roasted": { profile: "roasted", rationale: "Roasted duck adds handling and cost for higher appeal and demand." },
  "dish.duck-rice::duck-rice-rice-only": { profile: "reduced-portion", rationale: "Rice without the complete duck set is materially cheaper and faster, with lower contribution, appeal, and demand." },
});

function roundedBasisPointValue(value: number, basisPoints: number): number {
  return Math.floor((value * basisPoints + 5_000) / 10_000);
}

function roundedPriceCents(value: number, basisPoints: number): IntegerCents {
  const scaled = roundedBasisPointValue(value, basisPoints);
  return integerCents(
    Math.floor(scaled / VARIANT_PRICE_INCREMENT_CENTS)
      * VARIANT_PRICE_INCREMENT_CENTS,
  );
}

function createTerms(
  dish: DishDefinition,
  operation: ReviewedPreparationOperation,
): PreparationGameplayTerms {
  const profile = OPERATIONAL_PROFILES[operation.profile];
  const basePriceCents = Math.round(dish.price * 100);
  const priceCents = roundedPriceCents(basePriceCents, profile.priceBasisPoints);
  return Object.freeze({
    priceCents,
    ingredientCostCents: ingredientCostFromBasisPoints(
      priceCents,
      profile.ingredientCostBasisPoints,
    ),
    ingredientCostBasisPoints: profile.ingredientCostBasisPoints,
    preparationTimeMs: Math.max(1_000, roundedBasisPointValue(dish.preparationTimeMs, profile.preparationBasisPoints)),
    servingTimeMs: Math.max(500, roundedBasisPointValue(dish.servingTimeMs, profile.servingBasisPoints)),
    eatingTimeMs: Math.max(1_000, roundedBasisPointValue(dish.eatingTimeMs, profile.eatingBasisPoints)),
    starAppeal: Math.round(Math.min(5, Math.max(1, dish.starRating + profile.starAppealDeltaTenths / 10)) * 10) / 10,
    demandModifierBasisPoints: profile.demandModifierBasisPoints,
  });
}

function createPreparationDefinitions(): readonly PreparationGameplayDefinition[] {
  const definitions: PreparationGameplayDefinition[] = [];
  for (const dish of DISHES) {
    const family = FAMILY_BY_DISH_ID.get(dish.id);
    const variants: readonly {
      readonly id?: string;
      readonly profileId: string;
      readonly unlockRank: NutritionVariant["unlockRank"];
    }[] = family?.variants ?? [{
      id: undefined,
      profileId: dish.id,
      unlockRank: 1,
    }];
    variants.forEach((variant) => {
      const profile = PROFILE_BY_ID[variant.profileId];
      if (!profile) return;
      const isDefault = family
        ? variant.id === family.defaultVariantId
        : true;
      const id = preparationId(dish.id, variant.id);
      const operation = REVIEWED_PREPARATION_OPERATIONS[id] ?? {
        profile: "baseline" as const,
        rationale: "The sole listed preparation preserves the authored nominal operational baseline.",
      };
      definitions.push(Object.freeze({
        id,
        dishId: dish.id,
        variantId: variant.id,
        profileId: variant.profileId,
        unlockRank: variant.unlockRank,
        isDefault,
        mealRole: REVIEWED_MEAL_ROLES[dish.id]!,
        terms: createTerms(dish, operation),
        nutritionFitByIntent: Object.freeze({ ...profile.intentFits }),
        conditionFitByCondition: Object.freeze({ ...profile.conditionRatings }),
        nutritionAudit: auditProfile(profile),
        operationalReviewNote: operation.rationale,
      }));
    });
  }
  return Object.freeze(definitions);
}

export const PREPARATION_GAMEPLAY_CATALOGUE = createPreparationDefinitions();

export const PREPARATION_GAMEPLAY_BY_ID: Readonly<
  Record<string, PreparationGameplayDefinition>
> = Object.freeze(Object.fromEntries(PREPARATION_GAMEPLAY_CATALOGUE.map((entry) => [
  entry.id,
  entry,
])));

export interface PreparationForecastNeed {
  readonly id: string;
  readonly nutritionIntent?: NutritionIntentId;
  readonly healthCondition?: HealthCondition;
}

export interface PreparationForecastResponse {
  readonly responseId: string;
  readonly needId: string;
  readonly unlocked: boolean;
  readonly viable: boolean;
  readonly active: boolean;
  readonly nutritionFit?: number;
  readonly conditionFit?: number;
}

/**
 * Projects truthful real-catalogue responses for forecast coverage. Generic
 * condition-aware needs intentionally produce no response: they cannot be
 * converted into a required task without a specific, independently sampled
 * need and two unlocked preparations that actually match it.
 */
export function derivePreparationForecastResponses(
  needs: readonly PreparationForecastNeed[],
  unlockedPreparationIds: Iterable<string>,
  activePreparationIds: Iterable<string> = [],
): readonly PreparationForecastResponse[] {
  const unlocked = new Set(unlockedPreparationIds);
  const active = new Set(activePreparationIds);
  return Object.freeze(needs.flatMap((need) => {
    if (!need.nutritionIntent && !need.healthCondition) return [];
    if (need.nutritionIntent && need.healthCondition) {
      throw new Error(`Forecast need ${need.id} cannot combine nutrition intent and condition fit.`);
    }
    return PREPARATION_GAMEPLAY_CATALOGUE.map((preparation) => {
      const nutritionFit = need.nutritionIntent
        ? preparation.nutritionFitByIntent[need.nutritionIntent]
        : undefined;
      const conditionFit = need.healthCondition
        ? preparation.conditionFitByCondition[need.healthCondition]
        : undefined;
      const profile = PROFILE_BY_ID[preparation.profileId];
      return Object.freeze({
        responseId: preparation.id,
        needId: need.id,
        unlocked: unlocked.has(preparation.id),
        active: active.has(preparation.id),
        viable: profile?.status === "released" && (
          need.nutritionIntent
            ? typeof nutritionFit === "number"
              && Number.isFinite(nutritionFit)
              && nutritionFit >= NUTRITION_INTENT_MATCH_THRESHOLD
            : typeof conditionFit === "number"
              && Number.isFinite(conditionFit)
              && conditionFit >= HEALTH_PREFERENCE_MATCH_THRESHOLD
        ),
        nutritionFit,
        conditionFit,
      });
    });
  }));
}

function asVariantTradeoffs(
  preparations: readonly PreparationGameplayDefinition[],
): readonly VariantTradeoff[] {
  return Object.freeze(preparations.map((preparation) => Object.freeze({
    id: preparation.id,
    terms: createServingTerms(preparation.terms),
    nutritionFits: Object.freeze(Object.fromEntries(
      [
        ...Object.entries(preparation.nutritionFitByIntent).map(([intentId, fit]) => [
          `intent:${intentId}`,
          fit,
        ]),
        ...Object.entries(preparation.conditionFitByCondition).map(([condition, fit]) => [
          `condition:${condition}`,
          fit,
        ]),
      ],
    )),
  })));
}

function stableScenarioSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) || 1;
}

function commonNutritionNeeds(
  preparations: readonly PreparationGameplayDefinition[],
): readonly string[] {
  const candidateNeedIds = [
    ...NUTRITION_CONTENT.intents.map((intent) => `intent:${intent.id}`),
    ...Object.keys(preparations[0]?.conditionFitByCondition ?? {}).map(
      (condition) => `condition:${condition}`,
    ),
  ];
  const tradeoffs = asVariantTradeoffs(preparations);
  return Object.freeze(candidateNeedIds
    .filter((needId) => tradeoffs.every((preparation) => (
      typeof preparation.nutritionFits?.[needId] === "number"
    )))
    .sort((left, right) => left.localeCompare(right)));
}

function createWinningContexts(
  preparations: readonly PreparationGameplayDefinition[],
): readonly PreparationWinningContext[] {
  const tradeoffs = asVariantTradeoffs(preparations);
  const nutritionNeeds = commonNutritionNeeds(preparations);
  const boundedWeights = (
    primary: keyof Required<VariantContextWeights>,
    secondary: keyof Required<VariantContextWeights>,
  ): VariantContextWeights => Object.freeze(Object.fromEntries(
    VARIANT_TRADEOFF_AXES.map((axis) => [
      axis,
      axis === primary ? 2 : axis === secondary ? 1 : 0.2,
    ]),
  ));
  return Object.freeze(preparations.map((preparation, index) => {
    const baseId = `${preparation.dishId}:tradeoff-${index + 1}`;
    const seed = stableScenarioSeed(baseId);
    const rotatedNeeds = nutritionNeeds.length === 0
      ? []
      : nutritionNeeds.map((_, offset) => (
          nutritionNeeds[(seed + offset) % nutritionNeeds.length]!
        ));
    let best:
      | { readonly context: PreparationWinningContext; readonly margin: number }
      | undefined;
    for (const nutritionNeedId of rotatedNeeds) {
      for (const primary of VARIANT_TRADEOFF_AXES) {
        for (const secondary of VARIANT_TRADEOFF_AXES) {
          if (primary === secondary) continue;
          const context = Object.freeze({
            id: `${baseId}:${primary}:${secondary}:${nutritionNeedId}`,
            seed,
            preparationId: preparation.id,
            weights: boundedWeights(primary, secondary),
            nutritionNeedId,
            maximumPriceCents: preparation.terms.priceCents,
          });
          const scores = scoreVariantContext(tradeoffs, context);
          if (scores[0]?.id !== preparation.id) continue;
          const margin = scores[0].score - (scores[1]?.score ?? 0);
          if (margin <= 1e-9) continue;
          if (!best || margin > best.margin + 1e-9) best = { context, margin };
        }
      }
    }
    return best?.context ?? Object.freeze({
      id: baseId,
      seed,
      preparationId: preparation.id,
      weights: boundedWeights("nutritionFit", "affordability"),
      nutritionNeedId: nutritionNeeds[seed % Math.max(1, nutritionNeeds.length)],
      maximumPriceCents: preparation.terms.priceCents,
    });
  }));
}

function createFamilyReviews(): readonly PreparationFamilyReview[] {
  return Object.freeze(DISHES.map((dish) => {
    const preparations = PREPARATION_GAMEPLAY_CATALOGUE.filter(
      (preparation) => preparation.dishId === dish.id,
    );
    return Object.freeze({
      dishId: dish.id,
      preparationIds: Object.freeze(preparations.map((preparation) => preparation.id)),
      winningContexts: createWinningContexts(preparations),
    });
  }));
}

export const PREPARATION_FAMILY_REVIEWS = createFamilyReviews();

export function validatePreparationGameplayContent(): readonly PreparationContentIssue[] {
  const issues: PreparationContentIssue[] = [];
  const dishIds = new Set(DISHES.map((dish) => dish.id));
  const roleIds = new Set(Object.keys(REVIEWED_MEAL_ROLES));
  for (const id of new Set([...dishIds, ...roleIds])) {
    if (!dishIds.has(id) || !roleIds.has(id)) {
      issues.push({ code: "dish-role-coverage", subjectId: id, message: "Dish and meal-role ids must match exactly." });
    }
  }

  for (const dish of DISHES) {
    const family = FAMILY_BY_DISH_ID.get(dish.id);
    const expectedIds = family
      ? family.variants.map((variant) => preparationId(dish.id, variant.id))
      : [preparationId(dish.id)];
    const actual = PREPARATION_GAMEPLAY_CATALOGUE.filter((entry) => entry.dishId === dish.id);
    const actualIds = new Set(actual.map((entry) => entry.id));
    for (const id of expectedIds) {
      if (!actualIds.has(id)) {
        issues.push({ code: "preparation-coverage", subjectId: id, message: "Selectable preparation is missing gameplay terms." });
      }
      if (family && !REVIEWED_PREPARATION_OPERATIONS[id]) {
        issues.push({ code: "operational-review", subjectId: id, message: "Variant preparation is missing an explicit semantic operational review." });
      }
    }
    const defaultPreparation = actual.find((entry) => entry.isDefault);
    const nominalPriceCents = Math.round(dish.price * 100);
    if (!defaultPreparation || defaultPreparation.terms.priceCents !== nominalPriceCents) {
      issues.push({ code: "base-price", subjectId: dish.id, message: "Default preparation must preserve the nominal dish price." });
    }
    for (const entry of actual) {
      const terms = entry.terms;
      const integerValues = [
        terms.priceCents,
        terms.ingredientCostCents,
        terms.preparationTimeMs,
        terms.servingTimeMs,
        terms.eatingTimeMs,
        terms.demandModifierBasisPoints,
      ];
      if (integerValues.some((value) => !Number.isSafeInteger(value) || value < 0)) {
        issues.push({ code: "invalid-cents", subjectId: entry.id, message: "Money and timing terms must be non-negative safe integers." });
      }
      if (!Number.isFinite(terms.starAppeal) || terms.starAppeal < 1 || terms.starAppeal > 5) {
        issues.push({ code: "invalid-terms", subjectId: entry.id, message: "Star appeal must be within 1-5." });
      }
      const maximumPriceCents = nominalPriceCents + Math.floor(
        (nominalPriceCents * MAX_VARIANT_PRICE_PREMIUM_BASIS_POINTS) / 10_000,
      );
      const minimumPriceCents = Math.floor(
        (nominalPriceCents * MIN_VARIANT_PRICE_BASIS_POINTS) / 10_000,
      );
      if (terms.priceCents < minimumPriceCents || terms.priceCents > maximumPriceCents) {
        issues.push({ code: "invalid-terms", subjectId: entry.id, message: "Preparation price must stay within the reviewed 50 percent portion floor and 18 percent premium cap." });
      }
      if (
        !Object.isFrozen(entry)
        || !Object.isFrozen(terms)
        || !Object.isFrozen(entry.nutritionFitByIntent)
        || !Object.isFrozen(entry.conditionFitByCondition)
      ) {
        issues.push({ code: "unfrozen-terms", subjectId: entry.id, message: "Resolved preparation and nutrition-fit terms must be frozen." });
      }
      if (
        !entry.ingredientCostException
        && (terms.ingredientCostBasisPoints < MIN_INGREDIENT_BASIS_POINTS
          || terms.ingredientCostBasisPoints > MAX_INGREDIENT_BASIS_POINTS)
      ) {
        issues.push({ code: "ingredient-band", subjectId: entry.id, message: "Ingredient rate must remain within 28-42 percent or document an exception." });
      }
      if (
        family
        && (terms.ingredientCostBasisPoints < MIN_VARIANT_INGREDIENT_BASIS_POINTS
          || terms.ingredientCostBasisPoints > MAX_VARIANT_INGREDIENT_BASIS_POINTS)
      ) {
        issues.push({ code: "ingredient-band", subjectId: entry.id, message: "Variant ingredient rate must remain within the reviewed 32-38 percent band." });
      }
      if (!entry.operationalReviewNote.trim()) {
        issues.push({ code: "operational-review", subjectId: entry.id, message: "Preparation requires a concise operational rationale." });
      }
      const audit = entry.nutritionAudit;
      if (audit.status === "released" && (
        audit.sourceFile !== FOOD_SOURCE_FILE
        || !audit.sourceFileSha256
        || !audit.sourceRowNumber
        || !audit.sourceFoodName
        || !audit.sourceRowSha256
        || !audit.mappingKind
      )) {
        issues.push({ code: "nutrition-provenance", subjectId: entry.id, message: "Released preparation must retain complete authoritative CSV provenance." });
      }
    }

    const dominated = findDominatedVariants(asVariantTradeoffs(actual));
    for (const [preparationId, dominatorIds] of Object.entries(dominated)) {
      issues.push({ code: "dominant-preparation", subjectId: preparationId, message: `Dominated by ${dominatorIds.join(", ")}.` });
    }
  }

  for (const family of PREPARATION_FAMILY_REVIEWS) {
    const preparations = family.preparationIds.map((id) => PREPARATION_GAMEPLAY_BY_ID[id]!);
    const tradeoffs = asVariantTradeoffs(preparations);
    for (const context of family.winningContexts) {
      const coversEveryAxis = VARIANT_TRADEOFF_AXES.every((axis) => (
        (context.weights[axis] ?? 0) > 0
      ));
      if (
        !coversEveryAxis
        || !Number.isSafeInteger(context.seed)
        || context.seed <= 0
        || !context.nutritionNeedId
      ) {
        issues.push({ code: "matrix-axis-coverage", subjectId: context.id, message: "Every seeded real-catalogue context must positively weight all operational axes and one known nutrition need." });
      }
      const scores = scoreVariantContext(tradeoffs, context);
      if (
        scores[0]?.id !== context.preparationId
        || !Number.isFinite(scores[0]?.score)
        || (scores.length > 1 && scores[0]!.score <= scores[1]!.score + 1e-9)
      ) {
        issues.push({ code: "missing-winning-context", subjectId: context.preparationId, message: `Preparation does not uniquely win its seeded context ${context.id}.` });
      }
    }
    const contextPreparationIds = new Set(
      family.winningContexts.map((context) => context.preparationId),
    );
    for (const preparation of preparations) {
      if (!contextPreparationIds.has(preparation.id)) {
        issues.push({ code: "missing-winning-context", subjectId: preparation.id, message: "Preparation has no seeded real-catalogue winning context." });
      }
    }
  }
  return Object.freeze(issues.map((issue) => Object.freeze(issue)));
}
