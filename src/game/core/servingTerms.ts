import { cloneNutritionProfile } from "./nutrition";
import { asMoneyCents, type MoneyCents } from "./money";
import type { NutritionProfile } from "./types";
import type {
  AggregatedNutritionProfile,
  MealFitSnapshot,
  MealRole,
  ServingPlan,
} from "./mealComposition";

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
  /** Exact reviewed preparation id. Optional only on V5 compatibility input. */
  readonly preparationId?: string;
  readonly mealRole?: MealRole;
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
  readonly preparationId?: string;
  readonly mealRole?: MealRole;
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
  if (input.preparationId !== undefined && !input.preparationId.trim()) {
    throw new Error("Exact preparation ids must be non-empty when provided.");
  }
  if (
    input.mealBalanceRating !== undefined &&
    (!Number.isFinite(input.mealBalanceRating) || input.mealBalanceRating < 1 || input.mealBalanceRating > 5)
  ) {
    throw new Error("Meal balance rating must be between 1 and 5 when available.");
  }
  if (
    input.intentFit !== undefined &&
    (!Number.isFinite(input.intentFit) || input.intentFit < 0 || input.intentFit > 1)
  ) {
    throw new Error("Intent fit must be between 0 and 1 when available.");
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
    preparationId: input.preparationId ?? `${input.dishId}::${input.variantId ?? "base"}`,
    mealRole: input.mealRole,
    arrivalPeriodSequenceId: input.arrivalPeriodSequenceId,
    terms: createServingTerms(input.terms),
    nutritionProfile,
    mealBalanceRating: input.mealBalanceRating,
    intentFit: input.intentFit,
    explanationCodes: Object.freeze([...(input.explanationCodes ?? [])]),
  });
}

export interface FrozenMealOrderLine {
  readonly role: MealRole;
  readonly orderLine: OrderLineSnapshot;
}

export interface MealOrderSnapshot {
  readonly orderId: string;
  readonly offerId: string;
  readonly arrivalPeriodSequenceId: number;
  readonly lines: readonly [FrozenMealOrderLine, FrozenMealOrderLine];
  readonly servingPlan: ServingPlan;
  readonly nutrition: AggregatedNutritionProfile;
  readonly fit: MealFitSnapshot;
  readonly explanationCodes: readonly string[];
}

export interface MealOrderSnapshotInput {
  readonly orderId: string;
  readonly offerId: string;
  readonly arrivalPeriodSequenceId: number;
  readonly lines: readonly [FrozenMealOrderLine, FrozenMealOrderLine];
  readonly servingPlan: ServingPlan;
  readonly nutrition: AggregatedNutritionProfile;
  readonly fit: MealFitSnapshot;
  readonly explanationCodes?: readonly string[];
}

/** Deep-copies every two-line serving and comparison term at order acceptance. */
export function snapshotMealOrder(input: MealOrderSnapshotInput): MealOrderSnapshot {
  if (
    !input.orderId.trim() ||
    !input.offerId.trim() ||
    !Number.isSafeInteger(input.arrivalPeriodSequenceId) ||
    input.arrivalPeriodSequenceId < 1
  ) {
    throw new Error("Meal snapshots require order, offer, and arrival-period ids.");
  }
  if (input.servingPlan.stops.length < 1 || input.servingPlan.stops.length > 2) {
    throw new Error("A meal serving plan requires one or two stops.");
  }
  if (input.lines.some((line) => (
    line.orderLine.mealRole !== undefined && line.orderLine.mealRole !== line.role
  ))) {
    throw new Error("A frozen order line role must match its meal role.");
  }
  const lines = input.lines.map((line) => Object.freeze({
    role: line.role,
    orderLine: snapshotOrderLine({
      ...line.orderLine,
      mealRole: line.role,
    }),
  })) as unknown as [FrozenMealOrderLine, FrozenMealOrderLine];
  if (
    lines.filter((line) => line.role === "main").length !== 1 ||
    lines.filter((line) => line.role === "side" || line.role === "drink").length !== 1 ||
    lines[0].role !== "main" ||
    new Set(lines.map((line) => line.orderLine.lineId)).size !== 2 ||
    new Set(lines.map((line) => line.orderLine.preparationId)).size !== 2 ||
    lines.some((line) => (
      line.orderLine.arrivalPeriodSequenceId !== input.arrivalPeriodSequenceId ||
      !line.orderLine.preparationId
    ))
  ) {
    throw new Error("A meal snapshot requires a unique main line followed by a side or drink line.");
  }
  const mainPreparationId = lines[0].orderLine.preparationId!;
  const complementPreparationId = lines[1].orderLine.preparationId!;
  const stops = input.servingPlan.stops;
  if (
    !Number.isFinite(input.servingPlan.totalDistance) ||
    input.servingPlan.totalDistance < 0 ||
    stops.some((stop) => (
      !stop.stallInstanceId.trim() ||
      !Number.isFinite(stop.distance) ||
      stop.distance < 0 ||
      stop.preparationIds.length < 1 ||
      stop.preparationIds.some((preparationId) => !preparationId.trim())
    ))
  ) {
    throw new Error("A meal serving plan requires finite distances, stall ids, and non-empty stops.");
  }
  const plannedPreparationIds = stops.flatMap((stop) => stop.preparationIds);
  if (
    plannedPreparationIds.length !== 2 ||
    new Set(plannedPreparationIds).size !== 2 ||
    plannedPreparationIds[0] !== mainPreparationId ||
    !plannedPreparationIds.includes(complementPreparationId) ||
    plannedPreparationIds.some((id) => id !== mainPreparationId && id !== complementPreparationId) ||
    (stops.length === 2 && (
      stops[0]!.preparationIds.length !== 1 ||
      stops[1]!.preparationIds.length !== 1 ||
      stops[1]!.preparationIds[0] !== complementPreparationId ||
      stops[0]!.stallInstanceId === stops[1]!.stallInstanceId
    )) ||
    (stops.length === 1 && (
      stops[0]!.preparationIds[1] !== complementPreparationId
    ))
  ) {
    throw new Error("A meal serving plan must contain the frozen main then complement exactly once.");
  }
  const summedDistance = stops.reduce((sum, stop) => sum + stop.distance, 0);
  if (Math.abs(summedDistance - input.servingPlan.totalDistance) > 1e-9) {
    throw new Error("A meal serving plan total must equal its stop distances.");
  }
  if (
    input.fit.mealBalance !== undefined &&
    (!Number.isFinite(input.fit.mealBalance) || input.fit.mealBalance < 1 || input.fit.mealBalance > 5)
  ) {
    throw new Error("Meal balance fit must be between 1 and 5 when available.");
  }
  if (
    input.fit.intentFit !== undefined &&
    (!Number.isFinite(input.fit.intentFit) || input.fit.intentFit < 0 || input.fit.intentFit > 1)
  ) {
    throw new Error("Meal intent fit must be between 0 and 1 when available.");
  }
  if (
    input.fit.conditionAwareFit !== undefined &&
    (!Number.isFinite(input.fit.conditionAwareFit) ||
      input.fit.conditionAwareFit < 0 ||
      input.fit.conditionAwareFit > 1)
  ) {
    throw new Error("Condition-aware fit must be between 0 and 1 when available.");
  }
  if (new Set(input.fit.conditionIds).size !== input.fit.conditionIds.length) {
    throw new Error("Condition-aware fit ids must be unique.");
  }
  if (Object.values(input.nutrition.traceComponentCounts).some(
    (count) => count !== undefined && (!Number.isSafeInteger(count) || count < 1 || count > 2),
  )) {
    throw new Error("Trace component counts must be safe integers between 1 and 2.");
  }
  const nutrients = Object.fromEntries(Object.entries(input.nutrition.nutrients).map(
    ([metric, value]) => [metric, Object.freeze({ ...value })],
  )) as AggregatedNutritionProfile["nutrients"];
  const servingPlan = Object.freeze({
    totalDistance: input.servingPlan.totalDistance,
    stops: Object.freeze(input.servingPlan.stops.map((stop) => Object.freeze({
      stallInstanceId: stop.stallInstanceId,
      distance: stop.distance,
      preparationIds: Object.freeze([...stop.preparationIds]),
    }))),
  });
  return Object.freeze({
    orderId: input.orderId,
    offerId: input.offerId,
    arrivalPeriodSequenceId: input.arrivalPeriodSequenceId,
    lines: Object.freeze(lines),
    servingPlan,
    nutrition: Object.freeze({
      nutrients: Object.freeze(nutrients),
      traceComponentCounts: Object.freeze({ ...input.nutrition.traceComponentCounts }),
      explanationCodes: Object.freeze([...input.nutrition.explanationCodes]),
    }),
    fit: Object.freeze({
      ...input.fit,
      conditionIds: Object.freeze([...input.fit.conditionIds]),
      explanationCodes: Object.freeze([...input.fit.explanationCodes]),
    }),
    explanationCodes: Object.freeze([...(input.explanationCodes ?? [])]),
  });
}

export interface VariantTradeoff {
  readonly id: string;
  readonly terms: ServingTerms;
  /** Comparative fit in the inclusive 0-1 range; undefined means unavailable. */
  readonly nutritionFit?: number;
  /** Need-specific comparable ratings; missing keys remain unavailable. */
  readonly nutritionFits?: Readonly<Record<string, number | undefined>>;
}

export interface VariantContextWeights {
  readonly contribution?: number;
  readonly affordability?: number;
  readonly preparationTime?: number;
  readonly servingTime?: number;
  readonly eatingTime?: number;
  readonly starAppeal?: number;
  readonly demand?: number;
  readonly nutritionFit?: number;
}

export interface VariantWinningContext {
  readonly id: string;
  readonly weights: VariantContextWeights;
  /** Required when the context weights need-specific nutrition fit. */
  readonly nutritionNeedId?: string;
  /** Optional hard visit budget; preparations above it cannot win. */
  readonly maximumPriceCents?: number;
}

export type VariantTradeoffAxis = keyof Required<VariantContextWeights>;

export const VARIANT_TRADEOFF_AXES: readonly VariantTradeoffAxis[] = Object.freeze([
  "contribution",
  "affordability",
  "preparationTime",
  "servingTime",
  "eatingTime",
  "starAppeal",
  "demand",
  "nutritionFit",
]);

function axisValue(
  variant: VariantTradeoff,
  axis: VariantTradeoffAxis,
  nutritionNeedId?: string,
): number | undefined {
  switch (axis) {
    case "contribution": return variant.terms.priceCents - variant.terms.ingredientCostCents;
    case "affordability": return -variant.terms.priceCents;
    case "preparationTime": return -variant.terms.preparationTimeMs;
    case "servingTime": return -variant.terms.servingTimeMs;
    case "eatingTime": return -variant.terms.eatingTimeMs;
    case "starAppeal": return variant.terms.starAppeal;
    case "demand": return variant.terms.demandModifierBasisPoints;
    case "nutritionFit": return nutritionNeedId === undefined
      ? variant.nutritionFit
      : variant.nutritionFits?.[nutritionNeedId];
  }
}

function compareDimension(
  candidateValue: number | undefined,
  otherValue: number | undefined,
): "better" | "equal" | "worse" | "incomparable" {
  if (candidateValue === undefined || otherValue === undefined) {
    return candidateValue === otherValue ? "equal" : "incomparable";
  }
  if (!Number.isFinite(candidateValue) || !Number.isFinite(otherValue)) {
    return "incomparable";
  }
  if (candidateValue < otherValue) return "worse";
  if (candidateValue > otherValue) return "better";
  return "equal";
}

export function variantDominates(
  candidate: VariantTradeoff,
  other: VariantTradeoff,
): boolean {
  let strictlyBetter = false;
  for (const axis of VARIANT_TRADEOFF_AXES.filter((entry) => entry !== "nutritionFit")) {
    const comparison = compareDimension(
      axisValue(candidate, axis),
      axisValue(other, axis),
    );
    if (comparison === "worse" || comparison === "incomparable") return false;
    if (comparison === "better") strictlyBetter = true;
  }

  const nutritionIntentIds = new Set([
    ...Object.keys(candidate.nutritionFits ?? {}),
    ...Object.keys(other.nutritionFits ?? {}),
  ]);
  if (nutritionIntentIds.size === 0) {
    const comparison = compareDimension(candidate.nutritionFit, other.nutritionFit);
    if (comparison === "worse" || comparison === "incomparable") return false;
    if (comparison === "better") strictlyBetter = true;
  } else {
    for (const intentId of [...nutritionIntentIds].sort((left, right) => left.localeCompare(right))) {
      const comparison = compareDimension(
        candidate.nutritionFits?.[intentId],
        other.nutritionFits?.[intentId],
      );
      if (comparison === "worse" || comparison === "incomparable") return false;
      if (comparison === "better") strictlyBetter = true;
    }
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
  axis: VariantTradeoffAxis,
  nutritionNeedId?: string,
): Readonly<Record<string, number | undefined>> {
  const values = variants.map((variant) => axisValue(variant, axis, nutritionNeedId));
  const known = values.filter((value): value is number => (
    typeof value === "number" && Number.isFinite(value)
  ));
  if (known.length === 0) {
    return Object.freeze(Object.fromEntries(variants.map((variant) => [variant.id, undefined])));
  }
  const minimum = Math.min(...known);
  const range = Math.max(...known) - minimum;
  return Object.freeze(Object.fromEntries(variants.map((variant, index) => [
    variant.id,
    !Number.isFinite(values[index])
      ? undefined
      : range === 0
        ? 1
        : (values[index]! - minimum) / range,
  ])));
}

export interface VariantContextScore {
  readonly id: string;
  /** Negative infinity means a positively weighted axis was unavailable. */
  readonly score: number;
}

function contextTotalWeight(context: VariantWinningContext): number {
  if (!context.id.trim()) throw new Error("Variant contexts require a non-empty id.");
  if (
    context.maximumPriceCents !== undefined
    && (!Number.isSafeInteger(context.maximumPriceCents) || context.maximumPriceCents < 0)
  ) {
    throw new Error(`Context ${context.id} has an invalid maximum price.`);
  }
  let totalWeight = 0;
  for (const axis of VARIANT_TRADEOFF_AXES) {
    const weight = context.weights[axis] ?? 0;
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`Context ${context.id} has an invalid ${axis} weight.`);
    }
    totalWeight += weight;
  }
  if (totalWeight <= 0) throw new Error(`Context ${context.id} must weight at least one axis.`);
  return totalWeight;
}

/** Scores a deterministic context without imputing any unavailable axis. */
export function scoreVariantContext(
  variants: readonly VariantTradeoff[],
  context: VariantWinningContext,
): readonly VariantContextScore[] {
  const ids = variants.map((variant) => variant.id);
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error("Variant ids must be non-empty and unique within a trade-off matrix.");
  }
  const totalWeight = contextTotalWeight(context);
  const axes = Object.fromEntries(
    VARIANT_TRADEOFF_AXES.map((axis) => [
      axis,
      normalizedAxisValues(variants, axis, context.nutritionNeedId),
    ]),
  ) as Record<VariantTradeoffAxis, Readonly<Record<string, number | undefined>>>;
  return Object.freeze(variants.map((variant) => {
    if (
      context.maximumPriceCents !== undefined
      && variant.terms.priceCents > context.maximumPriceCents
    ) {
      return Object.freeze({ id: variant.id, score: Number.NEGATIVE_INFINITY });
    }
    let score = 0;
    for (const axis of VARIANT_TRADEOFF_AXES) {
      const weight = context.weights[axis] ?? 0;
      if (weight === 0) continue;
      const value = axes[axis][variant.id];
      if (value === undefined) {
        return Object.freeze({ id: variant.id, score: Number.NEGATIVE_INFINITY });
      }
      score += value * weight;
    }
    return Object.freeze({ id: variant.id, score: score / totalWeight });
  }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id)));
}

export function validateVariantWinningContexts(
  variants: readonly VariantTradeoff[],
  contexts: readonly VariantWinningContext[],
): readonly string[] {
  const uniqueWinners = new Set<string>();
  for (const context of contexts) {
    const scores = scoreVariantContext(variants, context);
    if (
      scores.length > 0
      && Number.isFinite(scores[0]!.score)
      && (scores.length === 1 || scores[0]!.score > scores[1]!.score + 1e-9)
    ) {
      uniqueWinners.add(scores[0]!.id);
    }
  }
  return Object.freeze(variants
    .filter((variant) => !uniqueWinners.has(variant.id))
    .map((variant) => `Variant ${variant.id} has no unique winning context.`));
}
