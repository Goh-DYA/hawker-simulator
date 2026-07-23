import { getBlockedTileKeys, getObjectServicePoint, pointKey } from "./grid";
import { asMoneyCents, type MoneyCents } from "./money";
import {
  activeNutritionVariant,
  averageRankPercentiles,
  NUTRITION_METRICS,
} from "./nutrition";
import { findPath } from "./pathfinding";
import { planStallQueueLayouts } from "./queueing";
import { createServingTerms, type OrderLineSnapshot, type ServingTerms } from "./servingTerms";
import type {
  GameState,
  GridPoint,
  HealthCondition,
  NutritionIntent,
  NutritionMetric,
  NutritionProfile,
  NutritionValue,
} from "./types";

export type MealRole = "main" | "side" | "drink";

/** Exact reviewed preparation id; dish and variant labels are never fuzzy matched. */
export function exactPreparationId(dishId: string, variantId?: string): string {
  return `${dishId}::${variantId ?? "base"}`;
}

export interface MealComponent {
  readonly preparationId: string;
  readonly dishId: string;
  readonly variantId?: string;
  readonly role: MealRole;
  readonly priceCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
  readonly terms?: ServingTerms;
  readonly unlocked: boolean;
  readonly stallInstanceIds: readonly string[];
  readonly nutritionProfile?: NutritionProfile;
}

export interface ComboOffer {
  readonly id: string;
  readonly preparationIds: readonly [string, string];
}

export type ComboBoardSlots = readonly [
  ComboOffer | null,
  ComboOffer | null,
  ComboOffer | null,
];

export interface ComboBoard {
  readonly slots: ComboBoardSlots;
}

export const EMPTY_COMBO_BOARD: ComboBoard = Object.freeze({
  slots: Object.freeze([null, null, null]) as ComboBoardSlots,
});

export type ComboBoardIssueCode =
  | "slot-count"
  | "locked"
  | "invalid-offer"
  | "duplicate-offer"
  | "duplicate-component"
  | "unknown-component"
  | "locked-component"
  | "meal-role"
  | "unavailable-stall";

export interface ComboBoardIssue {
  readonly slot: number;
  readonly offerId: string;
  readonly code: ComboBoardIssueCode;
  readonly message: string;
}

export interface ResolvedComboOffer {
  readonly offerId: string;
  readonly components: readonly [MealComponent, MealComponent];
  readonly priceCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
}

export interface StallDistance {
  readonly fromStallInstanceId?: string;
  readonly stallInstanceId: string;
  readonly distance: number;
}

export interface ServingStop {
  readonly preparationIds: readonly string[];
  readonly stallInstanceId: string;
  readonly distance: number;
}

export interface ServingPlan {
  readonly stops: readonly ServingStop[];
  readonly totalDistance: number;
}

export interface MealCandidate {
  readonly id: string;
  readonly preparationIds: readonly string[];
  readonly nutrients: Readonly<Record<NutritionMetric, NutritionValue>>;
  readonly traceComponentCounts: Readonly<Partial<Record<NutritionMetric, number>>>;
  readonly explanationCodes: readonly string[];
}

export interface MealBalanceResult {
  readonly candidateId: string;
  readonly rating?: number;
  readonly availableWeight: number;
  readonly totalWeight: number;
  readonly explanationCodes: readonly string[];
}

export interface MealFitSnapshot {
  readonly mealBalance?: number;
  readonly intentId?: NutritionIntent;
  readonly intentFit?: number;
  readonly conditionIds: readonly HealthCondition[];
  readonly conditionAwareFit?: number;
  readonly explanationCodes: readonly string[];
}

export interface FrozenMealLine {
  readonly role: MealRole;
  readonly orderLine: OrderLineSnapshot;
}

export interface ServedMealComponent {
  readonly lineId?: string;
  readonly preparationId: string;
  readonly role: MealRole;
  readonly served: boolean;
  readonly priceCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
}

export type MealSettlementCause =
  | "complete"
  | "second-stall-unavailable"
  | "served-timeout"
  | "cancelled-before-service";

export interface MealSettlement {
  readonly result: "complete" | "partial" | "no-sale";
  readonly cause: MealSettlementCause;
  readonly grossSalesCents: MoneyCents;
  readonly ingredientCostCents: MoneyCents;
  readonly chargedPreparationIds: readonly string[];
  readonly cancelledPreparationIds: readonly string[];
}

export interface AggregatedNutritionProfile {
  readonly nutrients: Readonly<Record<NutritionMetric, NutritionValue>>;
  readonly traceComponentCounts: Readonly<Partial<Record<NutritionMetric, number>>>;
  readonly explanationCodes: readonly string[];
}

/** Must stay aligned with HEALTH_RATING_SCHEMES.overall in the importer. */
export const MEAL_BALANCE_SCHEME: readonly Readonly<{
  metric: NutritionMetric;
  direction: "higher" | "lower";
  weight: number;
}>[] = Object.freeze([
  Object.freeze({ metric: "energyKcal", direction: "lower", weight: 0.16 }),
  Object.freeze({ metric: "proteinG", direction: "higher", weight: 0.12 }),
  Object.freeze({ metric: "totalFatG", direction: "lower", weight: 0.08 }),
  Object.freeze({ metric: "saturatedFatG", direction: "lower", weight: 0.1 }),
  Object.freeze({ metric: "transFatG", direction: "lower", weight: 0.08 }),
  Object.freeze({ metric: "totalSugarG", direction: "lower", weight: 0.12 }),
  Object.freeze({ metric: "dietaryFibreG", direction: "higher", weight: 0.14 }),
  Object.freeze({ metric: "sodiumMg", direction: "lower", weight: 0.12 }),
  Object.freeze({ metric: "calciumMg", direction: "higher", weight: 0.04 }),
  Object.freeze({ metric: "ironMg", direction: "higher", weight: 0.04 }),
]);

function comparisonValue(value: NutritionValue): number | undefined {
  if (value.status === "known" && Number.isFinite(value.value)) return Math.max(0, value.value);
  return undefined;
}

function unavailableValue(values: readonly NutritionValue[]): NutritionValue {
  const reasons = values
    .filter((value): value is Extract<NutritionValue, { status: "unavailable" }> => (
      value.status === "unavailable"
    ))
    .map((value) => value.reason);
  const reason = reasons.includes("invalid-source")
    ? "invalid-source"
    : reasons.includes("unmapped")
      ? "unmapped"
      : "not-reported";
  return Object.freeze({ status: "unavailable", reason });
}

/** Missing data in any component remains unavailable for the combined metric. */
export function aggregateNutritionValues(values: readonly NutritionValue[]): NutritionValue {
  if (values.length === 0) return Object.freeze({ status: "unavailable", reason: "unmapped" });
  if (values.some((value) => value.status === "unavailable")) return unavailableValue(values);
  if (values.some((value) => value.status === "trace")) {
    return values.every((value) => value.status === "trace")
      ? Object.freeze({ status: "trace" })
      : Object.freeze({ status: "unavailable" });
  }
  const known = values.filter(
    (value): value is Extract<NutritionValue, { status: "known" }> => value.status === "known",
  );
  if (known.length === 0) return Object.freeze({ status: "unavailable" });
  return Object.freeze({
    status: "known",
    value: known.reduce((sum, value) => sum + Math.max(0, value.value), 0),
  });
}

export function aggregateNutritionProfiles(
  profiles: readonly (NutritionProfile | undefined)[],
): AggregatedNutritionProfile {
  const traceComponentCounts: Partial<Record<NutritionMetric, number>> = {};
  const result = Object.fromEntries(NUTRITION_METRICS.map((metric) => {
    const values: NutritionValue[] = profiles.map((profile) => {
      if (!profile || profile.status !== "released") {
        return { status: "unavailable", reason: "unmapped" };
      }
      return profile.nutrients[metric];
    });
    const traceCount = values.filter((value) => value.status === "trace").length;
    if (traceCount > 0) traceComponentCounts[metric] = traceCount;
    return [metric, aggregateNutritionValues(values)];
  })) as Record<NutritionMetric, NutritionValue>;
  const unavailableCodes = NUTRITION_METRICS
    .filter((metric) => result[metric].status === "unavailable")
    .map((metric) => `unavailable:${metric}`);
  return Object.freeze({
    nutrients: Object.freeze(result),
    traceComponentCounts: Object.freeze(traceComponentCounts),
    explanationCodes: Object.freeze([
      ...Object.keys(traceComponentCounts).sort().map((metric) => `trace-component:${metric}`),
      ...unavailableCodes,
    ]),
  });
}

function servingAssignments(
  components: readonly MealComponent[],
  stallDistances: readonly StallDistance[],
  availableStallIds?: ReadonlySet<string>,
  requiredFirstStallId?: string,
): ServingPlan[] {
  const main = components.find((component) => component.role === "main");
  const complement = components.find((component) => component.role !== "main");
  if (!main || components.length > 2 || (components.length === 2 && !complement)) return [];
  const ordered = complement ? [main, complement] as const : [main] as const;
  const plans: ServingPlan[] = [];
  const distanceFor = (fromStallInstanceId: string | undefined, stallInstanceId: string) => (
    stallDistances.find((entry) => (
      entry.fromStallInstanceId === fromStallInstanceId &&
      entry.stallInstanceId === stallInstanceId
    ))?.distance
  );
  for (const mainStallId of [...ordered[0].stallInstanceIds].sort()) {
    if (requiredFirstStallId && mainStallId !== requiredFirstStallId) continue;
    if (availableStallIds && !availableStallIds.has(mainStallId)) continue;
    const firstDistance = distanceFor(undefined, mainStallId);
    if (!Number.isFinite(firstDistance) || firstDistance! < 0) continue;
    if (ordered.length === 1) {
      plans.push({
        stops: [{ preparationIds: [main.preparationId], stallInstanceId: mainStallId, distance: firstDistance! }],
        totalDistance: firstDistance!,
      });
      continue;
    }
    for (const complementStallId of [...ordered[1].stallInstanceIds].sort()) {
      if (availableStallIds && !availableStallIds.has(complementStallId)) continue;
      if (mainStallId === complementStallId) {
        plans.push({
          stops: [{
            preparationIds: [main.preparationId, ordered[1].preparationId],
            stallInstanceId: mainStallId,
            distance: firstDistance!,
          }],
          totalDistance: firstDistance!,
        });
        continue;
      }
      const secondDistance = distanceFor(mainStallId, complementStallId);
      if (!Number.isFinite(secondDistance) || secondDistance! < 0) continue;
      plans.push({
        stops: [
          { preparationIds: [main.preparationId], stallInstanceId: mainStallId, distance: firstDistance! },
          { preparationIds: [ordered[1].preparationId], stallInstanceId: complementStallId, distance: secondDistance! },
        ],
        totalDistance: firstDistance! + secondDistance!,
      });
    }
  }
  return plans;
}

/** Chooses actual placed stall instances deterministically by distance, then ids. */
export function selectReachableServingPlan(
  components: readonly MealComponent[],
  stallDistances: readonly StallDistance[],
  availableStallIds?: ReadonlySet<string>,
  requiredFirstStallId?: string,
): ServingPlan | undefined {
  const plans = servingAssignments(
    components,
    stallDistances,
    availableStallIds,
    requiredFirstStallId,
  ).sort((left, right) => (
    left.totalDistance - right.totalDistance ||
    left.stops.map((stop) => stop.stallInstanceId).join("|")
      .localeCompare(right.stops.map((stop) => stop.stallInstanceId).join("|"))
  ));
  const plan = plans[0];
  return plan ? Object.freeze({
    totalDistance: plan.totalDistance,
    stops: Object.freeze(plan.stops.map((stop) => Object.freeze({
      ...stop,
      preparationIds: Object.freeze([...stop.preparationIds]),
    }))),
  }) : undefined;
}

export function resolveComboOffer(
  offer: ComboOffer,
  componentsById: Readonly<Record<string, MealComponent>>,
): ResolvedComboOffer | undefined {
  const first = componentsById[offer.preparationIds[0]];
  const second = componentsById[offer.preparationIds[1]];
  if (!first || !second) return undefined;
  return Object.freeze({
    offerId: offer.id,
    components: Object.freeze([first, second] as [MealComponent, MealComponent]),
    priceCents: asMoneyCents(first.priceCents + second.priceCents),
    ingredientCostCents: asMoneyCents(first.ingredientCostCents + second.ingredientCostCents),
  });
}

export function validateComboBoard(
  level: number,
  board: ComboBoard,
  components: readonly MealComponent[],
  stallDistances: readonly StallDistance[],
  availableStallIds?: ReadonlySet<string>,
): readonly ComboBoardIssue[] {
  const componentsById = Object.fromEntries(components.map((component) => [
    component.preparationId,
    component,
  ]));
  const issues: ComboBoardIssue[] = [];
  const seenOfferIds = new Set<string>();
  const seenLogicalOffers = new Set<string>();
  if (board.slots.length !== 3) {
    issues.push({
      slot: -1,
      offerId: "board",
      code: "slot-count",
      message: "The Combo Board must contain exactly three slots.",
    });
  }
  board.slots.forEach((offer, slot) => {
    if (!offer) return;
    const add = (code: ComboBoardIssueCode, message: string): void => {
      issues.push({ slot, offerId: offer.id, code, message });
    };
    if (!offer.id.trim() || offer.preparationIds.some((id) => !id.trim())) {
      add("invalid-offer", "Offer and exact preparation ids must be non-empty.");
    }
    if (level < 5) add("locked", "The Combo Board unlocks at level 5.");
    const logicalOfferId = [...offer.preparationIds].sort().join("+");
    if (seenOfferIds.has(offer.id) || seenLogicalOffers.has(logicalOfferId)) {
      add("duplicate-offer", "Offer ids and preparation pairs must be unique.");
    }
    seenOfferIds.add(offer.id);
    seenLogicalOffers.add(logicalOfferId);
    if (offer.preparationIds[0] === offer.preparationIds[1]) {
      add("duplicate-component", "An offer must contain two different components.");
    }
    const resolved = resolveComboOffer(offer, componentsById);
    if (!resolved) {
      add("unknown-component", "Every offer component must exist.");
      return;
    }
    if (resolved.components.some((component) => !component.unlocked)) {
      add("locked-component", "Every offer component must be unlocked.");
    }
    const mains = resolved.components.filter((component) => component.role === "main");
    const complements = resolved.components.filter((component) => component.role !== "main");
    if (mains.length !== 1 || complements.length !== 1) {
      add("meal-role", "An offer requires exactly one main and one side or drink.");
    }
    if (!selectReachableServingPlan(resolved.components, stallDistances, availableStallIds)) {
      add("unavailable-stall", "A serving stall is not reachable for every component.");
    }
  });
  return Object.freeze(issues.map((issue) => Object.freeze(issue)));
}

export function comboOffersReferencingComponent(
  board: ComboBoard,
  preparationId: string,
): readonly string[] {
  return Object.freeze(board.slots
    .filter((offer): offer is ComboOffer => Boolean(offer?.preparationIds.includes(preparationId)))
    .map((offer) => offer.id));
}

export function buildUnlockedMealUniverse(
  components: readonly MealComponent[],
  stallDistances: readonly StallDistance[],
  availableStallIds?: ReadonlySet<string>,
): readonly MealCandidate[] {
  const unlocked = components.filter((component) => component.unlocked);
  const mains = unlocked.filter((component) => component.role === "main");
  const complements = unlocked.filter((component) => component.role !== "main");
  const candidates: MealCandidate[] = [];
  for (const main of mains) {
    if (!selectReachableServingPlan([main], stallDistances, availableStallIds)) continue;
    const singleNutrition = aggregateNutritionProfiles([main.nutritionProfile]);
    candidates.push({
      id: `single:${main.preparationId}`,
      preparationIds: Object.freeze([main.preparationId]),
      ...singleNutrition,
    });
    for (const complement of complements) {
      if (!selectReachableServingPlan([main, complement], stallDistances, availableStallIds)) continue;
      const pairNutrition = aggregateNutritionProfiles([
        main.nutritionProfile,
        complement.nutritionProfile,
      ]);
      candidates.push({
        id: `pair:${main.preparationId}+${complement.preparationId}`,
        preparationIds: Object.freeze([main.preparationId, complement.preparationId]),
        ...pairNutrition,
      });
    }
  }
  return Object.freeze(candidates
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((candidate) => Object.freeze(candidate)));
}

export function compareMealBalanceAmongUnlockedOptions(
  candidateId: string,
  unlockedUniverse: readonly MealCandidate[],
): MealBalanceResult {
  const candidate = unlockedUniverse.find((entry) => entry.id === candidateId);
  if (!candidate) throw new Error(`Meal candidate ${candidateId} is not in the unlocked universe.`);
  const percentileByMetric = new Map<NutritionMetric, Readonly<Record<string, number>>>();
  for (const scheme of MEAL_BALANCE_SCHEME) {
    percentileByMetric.set(scheme.metric, averageRankPercentiles(
      Object.fromEntries(unlockedUniverse.map((entry) => [
        entry.id,
        comparisonValue(entry.nutrients[scheme.metric]),
      ])),
      scheme.direction,
    ));
  }
  let weightedFit = 0;
  let availableWeight = 0;
  const unavailableMetrics: string[] = [];
  for (const scheme of MEAL_BALANCE_SCHEME) {
    const fit = percentileByMetric.get(scheme.metric)?.[candidateId];
    if (fit === undefined) {
      unavailableMetrics.push(scheme.metric);
      continue;
    }
    weightedFit += fit * scheme.weight;
    availableWeight += scheme.weight;
  }
  const totalWeight = MEAL_BALANCE_SCHEME.reduce((sum, scheme) => sum + scheme.weight, 0);
  return Object.freeze({
    candidateId,
    rating: availableWeight === 0
      ? undefined
      : Math.round((1 + 4 * (weightedFit / availableWeight)) * 10) / 10,
    availableWeight,
    totalWeight,
    explanationCodes: Object.freeze(unavailableMetrics.map((metric) => `unavailable:${metric}`)),
  });
}

/** Charges only components actually served; a failed second stop is never billed. */
export function settleMealComponents(
  components: readonly ServedMealComponent[],
  cause: MealSettlementCause,
): MealSettlement {
  if (components.length !== 2) throw new Error("A combo settlement requires exactly two components.");
  if (new Set(components.map((component) => component.preparationId)).size !== 2) {
    throw new Error("A combo settlement requires two different preparations.");
  }
  const mains = components.filter((component) => component.role === "main");
  const complements = components.filter((component) => component.role !== "main");
  if (
    mains.length !== 1 || complements.length !== 1 ||
    (complements[0]!.role !== "side" && complements[0]!.role !== "drink")
  ) {
    throw new Error("A combo settlement requires one main and one side or drink.");
  }
  const main = mains[0]!;
  if (!main.served && complements[0]!.served) {
    throw new Error("A complement cannot be served before the main component.");
  }
  const served = components.filter((component) => component.served);
  const unserved = components.filter((component) => !component.served);
  const result = served.length === 0 ? "no-sale" : unserved.length === 0 ? "complete" : "partial";
  if (result === "complete" && cause !== "complete") {
    throw new Error("A completed meal must use the complete settlement cause.");
  }
  if (result === "partial" && cause !== "second-stall-unavailable" && cause !== "served-timeout") {
    throw new Error("A partial meal must identify why the second component was unavailable.");
  }
  if (result === "no-sale" && cause !== "cancelled-before-service") {
    throw new Error("A no-sale meal must be cancelled before service.");
  }
  return Object.freeze({
    result,
    cause,
    grossSalesCents: asMoneyCents(served.reduce((sum, component) => sum + component.priceCents, 0)),
    ingredientCostCents: asMoneyCents(
      served.reduce((sum, component) => sum + component.ingredientCostCents, 0),
    ),
    chargedPreparationIds: Object.freeze(served.map((component) => component.preparationId)),
    cancelledPreparationIds: Object.freeze(unserved.map((component) => component.preparationId)),
  });
}

function unlockedDish(state: GameState, dishId: string): boolean {
  const dish = state.catalog.dishes[dishId];
  return Boolean(
    dish &&
    state.progression.level >= (dish.unlockLevel ?? 1) &&
    state.progression.reputation >= (dish.unlockReputation ?? 0) &&
    (dish.unlockPrerequisiteIds ?? []).every((id) => (
      state.progression.unlockedDefinitionIds.includes(id)
    )),
  );
}

/** Builds exact active-preparation components from actual placed stall instances. */
export function mealComponentsForState(
  state: GameState,
  includeClosed = false,
): readonly MealComponent[] {
  return Object.values(state.catalog.dishes).sort((left, right) => left.id.localeCompare(right.id)).map((dish) => {
    if (!dish.mealRole) {
      throw new Error(`Dish ${dish.id} is missing its reviewed meal role.`);
    }
    const variant = activeNutritionVariant(dish);
    const stallInstanceIds = Object.values(state.objects)
      .filter((object) => includeClosed || object.open)
      .filter((object) => state.catalog.placeables[object.definitionId]?.stall?.dishIds.includes(dish.id))
      .map((object) => object.id)
      .sort();
    const preparationId = dish.activePreparationId ?? exactPreparationId(dish.id, variant?.id);
    return Object.freeze({
      preparationId,
      dishId: dish.id,
      variantId: variant?.id,
      role: dish.mealRole,
      priceCents: dish.priceCents,
      ingredientCostCents: dish.ingredientCostCents,
      terms: createServingTerms({
        priceCents: dish.priceCents,
        ingredientCostCents: dish.ingredientCostCents,
        preparationTimeMs: dish.preparationMs,
        servingTimeMs: dish.servingMs ?? 0,
        eatingTimeMs: dish.eatingMs,
        starAppeal: Math.max(1, Math.min(5, dish.starRating ?? dish.quality)),
        demandModifierBasisPoints: dish.demandModifierBasisPoints ?? 10_000,
      }),
      unlocked: unlockedDish(state, dish.id),
      stallInstanceIds: Object.freeze(stallInstanceIds),
      nutritionProfile: variant?.profile,
    });
  });
}

function pathDistance(
  state: GameState,
  objects: GameState["objects"],
  start: GridPoint,
  end: GridPoint,
): number | undefined {
  const result = findPath(state.map, start, end, {
    blocked: getBlockedTileKeys(objects, state.catalog),
    preferred: new Set(state.routeGuidePoints.map(pointKey)),
  }).path;
  return result ? Math.max(0, result.length - 1) : undefined;
}

/**
 * Resolves route distances between actual stall instances. `includeClosed` is
 * for planning validation only; live orders always use currently open stalls.
 */
export function servingDistancesForState(
  state: GameState,
  origin: GridPoint,
  includeClosed = false,
): readonly StallDistance[] {
  const objects = includeClosed
    ? Object.fromEntries(Object.entries(state.objects).map(([id, object]) => [
        id,
        state.catalog.placeables[object.definitionId]?.kind === "stall"
          ? { ...object, open: true }
          : object,
      ]))
    : state.objects;
  const queueLayouts = planStallQueueLayouts(
    state.map,
    objects,
    state.catalog,
    [...state.accessPoints.map((point) => point.position), ...state.routeGuidePoints],
  );
  const stalls = Object.values(objects)
    .filter((object) => state.catalog.placeables[object.definitionId]?.kind === "stall")
    .filter((object) => includeClosed || object.open)
    .filter((object) => (queueLayouts[object.id]?.length ?? 0) > 0)
    .sort((left, right) => left.id.localeCompare(right.id));
  const entries: StallDistance[] = [];
  for (const stall of stalls) {
    const queue = state.queues[stall.id] ?? [];
    const cells = queueLayouts[stall.id] ?? [];
    const target = cells[includeClosed
      ? 0
      : Math.min(queue.length, Math.max(0, cells.length - 1))];
    if (!target) continue;
    const distance = pathDistance(state, objects, origin, target);
    if (distance !== undefined) entries.push({ stallInstanceId: stall.id, distance });
  }
  for (const from of stalls) {
    const fromPoint = getObjectServicePoint(from, state.catalog) ?? queueLayouts[from.id]?.[0];
    if (!fromPoint) continue;
    for (const to of stalls) {
      if (from.id === to.id) continue;
      const queue = state.queues[to.id] ?? [];
      const cells = queueLayouts[to.id] ?? [];
      const target = cells[includeClosed
        ? 0
        : Math.min(queue.length, Math.max(0, cells.length - 1))];
      if (!target) continue;
      const distance = pathDistance(state, objects, fromPoint, target);
      if (distance !== undefined) {
        entries.push({ fromStallInstanceId: from.id, stallInstanceId: to.id, distance });
      }
    }
  }
  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}

export function validateComboBoardForState(
  state: GameState,
  board: ComboBoard = state.comboBoard,
  includeClosed = true,
): readonly ComboBoardIssue[] {
  if (board.slots.every((offer) => offer === null)) {
    return validateComboBoard(state.progression.level, board, [], []);
  }
  const origin = state.accessPoints.find((point) => point.kind === "entrance")?.position ?? state.entrance;
  const components = mealComponentsForState(state, includeClosed);
  return validateComboBoard(
    state.progression.level,
    board,
    components,
    servingDistancesForState(state, origin, includeClosed),
    new Set(components.flatMap((component) => component.stallInstanceIds)),
  );
}
