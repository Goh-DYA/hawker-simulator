import { DISHES } from "./dishes";
import { NUTRITION_CONTENT } from "./nutrition";
import type { DishDefinition, NutritionProfile } from "./types";

export type MealRole = "main" | "side" | "drink";

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
  "dish.fried-carrot-cake": "side",
  "dish.oyster-omelette": "side",
  "dish.roti-prata": "main",
  "dish.mee-goreng-mamak": "main",
  "dish.chicken-murtabak": "main",
  "dish.nasi-briyani": "main",
  "dish.masala-thosai": "main",
  "dish.idli-sambar": "side",
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
  "dish.chicken-satay-set": "side",
  "dish.bbq-chicken-wings": "side",
  "dish.beef-satay-set": "side",
  "dish.sambal-grilled-squid": "side",
  "dish.har-gow": "side",
  "dish.siew-mai": "side",
  "dish.char-siew-bao": "side",
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
  readonly isDefault: boolean;
  readonly mealRole: MealRole;
  readonly terms: PreparationGameplayTerms;
  readonly nutritionAudit: PreparationNutritionAudit;
  readonly operationalReviewNote: string;
  readonly ingredientCostException?: string;
}

export interface PreparationWinningContext {
  readonly id: string;
  readonly preparationId: string;
  readonly contributionWeight: number;
  readonly affordabilityWeight: number;
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
    | "base-price"
    | "ingredient-band"
    | "nutrition-provenance"
    | "dominant-preparation"
    | "missing-winning-context";
  readonly subjectId: string;
  readonly message: string;
}

const MIN_INGREDIENT_BASIS_POINTS = 2_800;
const MAX_INGREDIENT_BASIS_POINTS = 4_200;
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

function createTerms(
  dish: DishDefinition,
  rank: number,
  familySize: number,
): PreparationGameplayTerms {
  const basePriceCents = Math.round(dish.price * 100);
  const priceStepCents = familySize <= 1
    ? 0
    : Math.max(10, Math.ceil((basePriceCents * 0.5) / (familySize - 1) / 10) * 10);
  const priceCents = integerCents(basePriceCents + priceStepCents * rank);
  const ingredientCostBasisPoints = familySize <= 1
    ? 3_500
    : Math.round(
      MIN_INGREDIENT_BASIS_POINTS
      + ((MAX_INGREDIENT_BASIS_POINTS - MIN_INGREDIENT_BASIS_POINTS) * rank)
        / (familySize - 1),
    );
  const progress = familySize <= 1 ? 0 : rank / (familySize - 1);
  return Object.freeze({
    priceCents,
    ingredientCostCents: ingredientCostFromBasisPoints(
      priceCents,
      ingredientCostBasisPoints,
    ),
    ingredientCostBasisPoints,
    preparationTimeMs: Math.max(1_000, Math.round(dish.preparationTimeMs * (1 - 0.2 * progress))),
    servingTimeMs: Math.max(500, Math.round(dish.servingTimeMs * (1 - 0.15 * progress))),
    eatingTimeMs: dish.eatingTimeMs,
    starAppeal: Math.round(Math.min(5, dish.starRating + 0.5 * progress) * 10) / 10,
    demandModifierBasisPoints: Math.round(10_000 + 1_000 * progress),
  });
}

function createPreparationDefinitions(): readonly PreparationGameplayDefinition[] {
  const definitions: PreparationGameplayDefinition[] = [];
  for (const dish of DISHES) {
    const family = FAMILY_BY_DISH_ID.get(dish.id);
    const variants = family?.variants ?? [{
      id: undefined,
      profileId: dish.id,
    }];
    variants.forEach((variant, rank) => {
      const profile = PROFILE_BY_ID[variant.profileId];
      if (!profile) return;
      const isDefault = family
        ? variant.id === family.defaultVariantId
        : true;
      definitions.push(Object.freeze({
        id: preparationId(dish.id, variant.id),
        dishId: dish.id,
        variantId: variant.id,
        profileId: variant.profileId,
        isDefault,
        mealRole: REVIEWED_MEAL_ROLES[dish.id]!,
        terms: createTerms(dish, rank, variants.length),
        nutritionAudit: auditProfile(profile),
        operationalReviewNote: isDefault
          ? "Baseline preparation preserves the authored nominal dish price."
          : "Alternative exchanges a higher price and ingredient share for faster preparation, stronger Star appeal, demand, and absolute contribution.",
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

function createWinningContexts(
  preparations: readonly PreparationGameplayDefinition[],
): readonly PreparationWinningContext[] {
  if (preparations.length === 1) {
    return Object.freeze([Object.freeze({
      id: `${preparations[0]!.dishId}:baseline`,
      preparationId: preparations[0]!.id,
      contributionWeight: 1,
      affordabilityWeight: 1,
    })]);
  }
  const contributions = preparations.map((preparation) => (
    preparation.terms.priceCents - preparation.terms.ingredientCostCents
  ));
  const marginalContributions = preparations.slice(1).map((preparation, index) => (
    (contributions[index + 1]! - contributions[index]!)
    / (preparation.terms.priceCents - preparations[index]!.terms.priceCents)
  ));
  return Object.freeze(preparations.map((preparation, index) => {
    let affordabilityWeight: number;
    if (index === 0) affordabilityWeight = marginalContributions[0]! + 0.1;
    else if (index === preparations.length - 1) affordabilityWeight = Math.max(0, marginalContributions[index - 1]! - 0.1);
    else affordabilityWeight = (
      marginalContributions[index - 1]! + marginalContributions[index]!
    ) / 2;
    return Object.freeze({
      id: `${preparation.dishId}:tradeoff-${index + 1}`,
      preparationId: preparation.id,
      contributionWeight: 1,
      affordabilityWeight,
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

function preparationDominates(
  candidate: PreparationGameplayDefinition,
  other: PreparationGameplayDefinition,
): boolean {
  const candidateValues = [
    candidate.terms.priceCents - candidate.terms.ingredientCostCents,
    -candidate.terms.priceCents,
    -(candidate.terms.preparationTimeMs + candidate.terms.servingTimeMs),
    candidate.terms.starAppeal,
    candidate.terms.demandModifierBasisPoints,
    PROFILE_BY_ID[candidate.profileId]?.healthRating,
  ];
  const otherValues = [
    other.terms.priceCents - other.terms.ingredientCostCents,
    -other.terms.priceCents,
    -(other.terms.preparationTimeMs + other.terms.servingTimeMs),
    other.terms.starAppeal,
    other.terms.demandModifierBasisPoints,
    PROFILE_BY_ID[other.profileId]?.healthRating,
  ];
  let strictlyBetter = false;
  for (let index = 0; index < candidateValues.length; index += 1) {
    const candidateValue = candidateValues[index];
    const otherValue = otherValues[index];
    if (candidateValue === undefined || otherValue === undefined) {
      if (candidateValue !== otherValue) return false;
      continue;
    }
    if (candidateValue < otherValue) return false;
    if (candidateValue > otherValue) strictlyBetter = true;
  }
  return strictlyBetter;
}

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
    }
    const defaultPreparation = actual.find((entry) => entry.isDefault);
    if (!defaultPreparation || defaultPreparation.terms.priceCents !== Math.round(dish.price * 100)) {
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
      if (
        !entry.ingredientCostException
        && (terms.ingredientCostBasisPoints < MIN_INGREDIENT_BASIS_POINTS
          || terms.ingredientCostBasisPoints > MAX_INGREDIENT_BASIS_POINTS)
      ) {
        issues.push({ code: "ingredient-band", subjectId: entry.id, message: "Ingredient rate must remain within 28-42 percent or document an exception." });
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

    for (const preparation of actual) {
      const dominators = actual.filter((candidate) => (
        candidate.id !== preparation.id && preparationDominates(candidate, preparation)
      ));
      if (dominators.length > 0) {
        issues.push({ code: "dominant-preparation", subjectId: preparation.id, message: `Dominated by ${dominators.map((entry) => entry.id).join(", ")}.` });
      }
    }
  }

  for (const family of PREPARATION_FAMILY_REVIEWS) {
    const preparations = family.preparationIds.map((id) => PREPARATION_GAMEPLAY_BY_ID[id]!);
    for (const preparation of preparations) {
      const winningContext = family.winningContexts.find((context) => {
        const scores = preparations.map((candidate) => ({
          id: candidate.id,
          score: context.contributionWeight
            * (candidate.terms.priceCents - candidate.terms.ingredientCostCents)
            - context.affordabilityWeight * candidate.terms.priceCents,
        })).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
        return scores[0]?.id === preparation.id
          && (scores.length === 1 || scores[0]!.score > scores[1]!.score + 1e-9);
      });
      if (!winningContext) {
        issues.push({ code: "missing-winning-context", subjectId: preparation.id, message: "Preparation has no unique contribution-affordability context." });
      }
    }
  }
  return Object.freeze(issues.map((issue) => Object.freeze(issue)));
}
