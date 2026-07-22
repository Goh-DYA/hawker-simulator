import { cloneNutritionProfile } from "./nutrition";
import { asMoneyCents, type MoneyCents } from "./money";
import type { NutritionProfile } from "./types";

/** @deprecated Use the shared MoneyCents brand for all resolved SGD values. */
export type SgdCents = MoneyCents;

export function asSgdCents(value: number, label = "SGD cents"): SgdCents {
  return asMoneyCents(value, label);
}

export interface ServingTerms {
  readonly priceCents: SgdCents;
  readonly ingredientCostCents: SgdCents;
  readonly preparationTimeMs: number;
  readonly servingTimeMs: number;
  readonly eatingTimeMs: number;
  readonly starAppeal: number;
  /** Integer basis points, where 10,000 is neutral demand. */
  readonly demandModifierBasisPoints: number;
}

export interface ServingTermsInput {
  readonly priceCents: number;
  readonly ingredientCostCents: number;
  readonly preparationTimeMs: number;
  readonly servingTimeMs: number;
  readonly eatingTimeMs: number;
  readonly starAppeal: number;
  readonly demandModifierBasisPoints: number;
}

function nonNegativeDuration(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

export function createServingTerms(input: ServingTermsInput): ServingTerms {
  if (!Number.isFinite(input.starAppeal) || input.starAppeal < 1 || input.starAppeal > 5) {
    throw new Error("Star appeal must be between 1 and 5.");
  }
  if (!Number.isSafeInteger(input.demandModifierBasisPoints) || input.demandModifierBasisPoints < 0) {
    throw new Error("Demand modifier must be a non-negative integer basis-point value.");
  }
  return Object.freeze({
    priceCents: asSgdCents(input.priceCents, "Price"),
    ingredientCostCents: asSgdCents(input.ingredientCostCents, "Ingredient cost"),
    preparationTimeMs: nonNegativeDuration(input.preparationTimeMs, "Preparation time"),
    servingTimeMs: nonNegativeDuration(input.servingTimeMs, "Serving time"),
    eatingTimeMs: nonNegativeDuration(input.eatingTimeMs, "Eating time"),
    starAppeal: input.starAppeal,
    demandModifierBasisPoints: input.demandModifierBasisPoints,
  });
}

export interface OrderLineSnapshot {
  readonly lineId: string;
  readonly dishId: string;
  readonly variantId?: string;
  readonly arrivalPeriodSequenceId: number;
  readonly terms: ServingTerms;
  readonly nutritionProfile?: NutritionProfile;
  readonly mealBalanceRating?: number;
  readonly intentFit?: number;
  readonly explanationCodes: readonly string[];
}

export interface OrderLineSnapshotInput {
  readonly lineId: string;
  readonly dishId: string;
  readonly variantId?: string;
  readonly arrivalPeriodSequenceId: number;
  readonly terms: ServingTerms;
  readonly nutritionProfile?: NutritionProfile;
  readonly mealBalanceRating?: number;
  readonly intentFit?: number;
  readonly explanationCodes?: readonly string[];
}

/** Copies and freezes every serving-sensitive value at order acceptance time. */
export function snapshotOrderLine(input: OrderLineSnapshotInput): OrderLineSnapshot {
  const validPeriodId = Number.isSafeInteger(input.arrivalPeriodSequenceId) &&
    input.arrivalPeriodSequenceId > 0;
  if (!input.lineId.trim() || !input.dishId.trim() || !validPeriodId) {
    throw new Error("Order snapshots require line, dish, and arrival-period ids.");
  }
  const nutritionProfile = cloneNutritionProfile(input.nutritionProfile);
  if (nutritionProfile) {
    Object.values(nutritionProfile.nutrients).forEach(Object.freeze);
    Object.freeze(nutritionProfile.nutrients);
    if (nutritionProfile.serving) Object.freeze(nutritionProfile.serving);
    Object.freeze(nutritionProfile.intentFits);
    if (nutritionProfile.conditionRatings) Object.freeze(nutritionProfile.conditionRatings);
    Object.freeze(nutritionProfile);
  }
  return Object.freeze({
    lineId: input.lineId,
    dishId: input.dishId,
    variantId: input.variantId,
    arrivalPeriodSequenceId: input.arrivalPeriodSequenceId,
    terms: createServingTerms(input.terms),
    nutritionProfile,
    mealBalanceRating: input.mealBalanceRating,
    intentFit: input.intentFit,
    explanationCodes: Object.freeze([...(input.explanationCodes ?? [])]),
  });
}

export interface VariantTradeoff {
  readonly id: string;
  readonly terms: ServingTerms;
  /** Comparative fit in the inclusive 0-1 range; undefined means unavailable. */
  readonly nutritionFit?: number;
}

export interface VariantContextWeights {
  readonly contribution?: number;
  readonly affordability?: number;
  readonly timing?: number;
  readonly starAppeal?: number;
  readonly demand?: number;
  readonly nutritionFit?: number;
}

export interface VariantWinningContext {
  readonly id: string;
  readonly weights: VariantContextWeights;
}

type Axis = keyof Required<VariantContextWeights>;

const AXES: readonly Axis[] = [
  "contribution",
  "affordability",
  "timing",
  "starAppeal",
  "demand",
  "nutritionFit",
];

function axisValue(variant: VariantTradeoff, axis: Axis): number | undefined {
  switch (axis) {
    case "contribution": return variant.terms.priceCents - variant.terms.ingredientCostCents;
    case "affordability": return -variant.terms.priceCents;
    case "timing": return -(variant.terms.preparationTimeMs + variant.terms.servingTimeMs);
    case "starAppeal": return variant.terms.starAppeal;
    case "demand": return variant.terms.demandModifierBasisPoints;
    case "nutritionFit": return variant.nutritionFit;
  }
}

export function variantDominates(
  candidate: VariantTradeoff,
  other: VariantTradeoff,
): boolean {
  let strictlyBetter = false;
  for (const axis of AXES) {
    const candidateValue = axisValue(candidate, axis);
    const otherValue = axisValue(other, axis);
    if (candidateValue === undefined || otherValue === undefined) {
      if (candidateValue !== otherValue) return false;
      continue;
    }
    if (candidateValue < otherValue) return false;
    if (candidateValue > otherValue) strictlyBetter = true;
  }
  return strictlyBetter;
}

export function findDominatedVariants(
  variants: readonly VariantTradeoff[],
): Readonly<Record<string, readonly string[]>> {
  const result: Record<string, readonly string[]> = {};
  for (const variant of variants) {
    const dominators = variants
      .filter((candidate) => candidate.id !== variant.id && variantDominates(candidate, variant))
      .map((candidate) => candidate.id)
      .sort((left, right) => left.localeCompare(right));
    if (dominators.length > 0) result[variant.id] = Object.freeze(dominators);
  }
  return Object.freeze(result);
}

function normalizedAxisValues(
  variants: readonly VariantTradeoff[],
  axis: Axis,
): Readonly<Record<string, number | undefined>> {
  const values = variants.map((variant) => axisValue(variant, axis));
  const known = values.filter((value): value is number => value !== undefined);
  if (known.length === 0) {
    return Object.freeze(Object.fromEntries(variants.map((variant) => [variant.id, undefined])));
  }
  const minimum = Math.min(...known);
  const range = Math.max(...known) - minimum;
  return Object.freeze(Object.fromEntries(variants.map((variant, index) => [
    variant.id,
    values[index] === undefined ? undefined : range === 0 ? 1 : (values[index]! - minimum) / range,
  ])));
}

export function validateVariantWinningContexts(
  variants: readonly VariantTradeoff[],
  contexts: readonly VariantWinningContext[],
): readonly string[] {
  const axes = Object.fromEntries(
    AXES.map((axis) => [axis, normalizedAxisValues(variants, axis)]),
  ) as Record<Axis, Readonly<Record<string, number | undefined>>>;
  const uniqueWinners = new Set<string>();
  for (const context of contexts) {
    let totalWeight = 0;
    for (const axis of AXES) {
      const weight = context.weights[axis] ?? 0;
      if (!Number.isFinite(weight) || weight < 0) {
        throw new Error(`Context ${context.id} has an invalid ${axis} weight.`);
      }
      totalWeight += weight;
    }
    if (totalWeight <= 0) throw new Error(`Context ${context.id} must weight at least one axis.`);
    const scores = variants.map((variant) => {
      let score = 0;
      let availableWeight = 0;
      for (const axis of AXES) {
        const weight = context.weights[axis] ?? 0;
        const value = axes[axis][variant.id];
        if (weight > 0 && value !== undefined) {
          score += value * weight;
          availableWeight += weight;
        }
      }
      return { id: variant.id, score: availableWeight === 0 ? Number.NEGATIVE_INFINITY : score / availableWeight };
    }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
    if (scores.length > 0 && (scores.length === 1 || scores[0]!.score > scores[1]!.score + 1e-9)) {
      uniqueWinners.add(scores[0]!.id);
    }
  }
  return Object.freeze(variants
    .filter((variant) => !uniqueWinners.has(variant.id))
    .map((variant) => `Variant ${variant.id} has no unique winning context.`));
}
