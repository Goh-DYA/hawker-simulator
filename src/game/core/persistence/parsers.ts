/**
 * Parsers for the compound sections of a persisted save.
 *
 * Each parser validates one section (map, objects, objectives, mastery, visit ratings or
 * nutrition metrics) and is shared by the per-version parsers in `migrations.ts`.
 */
import {
  NUTRITION_OBJECTIVE_CRITERIA,
  NUTRITION_UNAVAILABLE_REASONS,
  OBJECTIVE_KINDS,
  QUALITY_MODES,
  QUEUE_DIRECTIONS,
  ROTATIONS,
  TILE_KINDS,
  VISIT_RATING_COMPONENT_KEYS,
} from "../enums";
import {
  createEmptyNutritionMetrics,
  HEALTH_CONDITIONS,
  NUTRITION_INTENTS,
  NUTRITION_METRICS,
} from "../nutrition";
import type {
  GridMap,
  PlacedObject,
  QualityMode,
  DailyObjective,
  StallMasteryState,
  VisitRating,
  NutritionIntent,
  NutritionDailyMetrics,
  NutritionIntentMetrics,
  NutritionMetric,
  NutritionMetrics,
  NutritionProfile,
  NutritionRequestResult,
  NutritionValue,
  HealthCondition,
} from "../types";
import {
  PersistenceError,
  assert_one_of,
  boundedPercentage,
  finite,
  healthRating,
  isRecord,
  parsePoint,
  parseWorldPoint,
  safeInteger,
  stringValue,
} from "./fields";

/**
 * Reads the saved grid map.
 *
 * @param value - The untrusted value read from the save.
 * @returns The map with validated dimensions, origin and tiles.
 * @throws PersistenceError When a field is missing, out of range or the tile count is wrong.
 */
export function parseMap(value: unknown): GridMap {
  if (!isRecord(value)) throw new PersistenceError("map must be an object");
  const width = safeInteger(value.width, "map.width", 1);
  const height = safeInteger(value.height, "map.height", 1);
  const tileSize = finite(value.tileSize, "map.tileSize", Number.MIN_VALUE);
  const worldOrigin = parseWorldPoint(value.worldOrigin, "map.worldOrigin");
  if (!Array.isArray(value.tiles) || value.tiles.length !== width * height) {
    throw new PersistenceError("map.tiles length does not match its dimensions");
  }
  const tiles = value.tiles.map((tile, index) =>
    assert_one_of(tile, TILE_KINDS, `map.tiles[${index}] is invalid`),
  );
  return { width, height, tileSize, worldOrigin, tiles };
}

/**
 * Reads one saved placed object.
 *
 * @param value - The untrusted value read from the save.
 * @param index - The object's position in `objects`, used in error paths.
 * @returns The placed object, with optional queue fields left undefined when absent.
 * @throws PersistenceError When a field is missing or invalid.
 */
export function parseObject(value: unknown, index: number): PlacedObject {
  const path = `objects[${index}]`;
  if (!isRecord(value)) throw new PersistenceError(`${path} must be an object`);
  const rotation = assert_one_of(
    finite(value.rotation, `${path}.rotation`),
    ROTATIONS,
    `${path}.rotation is invalid`,
  );
  if (typeof value.open !== "boolean") throw new PersistenceError(`${path}.open must be boolean`);
  const queueDirection =
    value.queueDirection === undefined
      ? undefined
      : assert_one_of(value.queueDirection, QUEUE_DIRECTIONS, `${path}.queueDirection is invalid`);
  let queuePath: readonly { x: number; y: number }[] | undefined;
  if (value.queuePath !== undefined) {
    if (!Array.isArray(value.queuePath)) throw new PersistenceError(`${path}.queuePath must be an array`);
    queuePath = value.queuePath.map((point, pointIndex) => parsePoint(point, `${path}.queuePath[${pointIndex}]`));
  }
  return {
    id: stringValue(value.id, `${path}.id`),
    definitionId: stringValue(value.definitionId, `${path}.definitionId`),
    origin: parsePoint(value.origin, `${path}.origin`),
    rotation,
    open: value.open,
    queueDirection,
    queuePath,
  };
}

/**
 * Reads the saved quality mode.
 *
 * @param value - The untrusted value read from the save.
 * @returns The quality mode.
 * @throws PersistenceError When the value is not a known quality mode.
 */
export function parseQuality(value: unknown): QualityMode {
  return assert_one_of(value, QUALITY_MODES, "qualityMode is invalid");
}

/**
 * Reads the saved daily objectives.
 *
 * A missing or non-array value reads as no objectives, which is how pre-V3 saves load.
 *
 * @param value - The untrusted value read from the save.
 * @returns The objectives, in saved order.
 * @throws PersistenceError When an objective entry is malformed.
 */
export function parseDailyObjectives(value: unknown): readonly DailyObjective[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new PersistenceError(`progression.dailyObjectives[${index}] must be an object`);
    const kind = entry.kind;
    // The check coerces with String() as it always has; the raw value is what is stored.
    assert_one_of(String(kind), OBJECTIVE_KINDS, `progression.dailyObjectives[${index}].kind is invalid`);
    if (typeof entry.completed !== "boolean") throw new PersistenceError(`progression.dailyObjectives[${index}].completed must be boolean`);
    const nutritionCriterion = entry.nutritionCriterion;
    if (kind === "nutrition") {
      assert_one_of(
        nutritionCriterion,
        NUTRITION_OBJECTIVE_CRITERIA,
        `progression.dailyObjectives[${index}].nutritionCriterion is invalid`,
      );
    }
    return {
      id: stringValue(entry.id, `progression.dailyObjectives[${index}].id`),
      day: safeInteger(entry.day, `progression.dailyObjectives[${index}].day`, 1),
      kind: kind as DailyObjective["kind"],
      title: stringValue(entry.title, `progression.dailyObjectives[${index}].title`),
      description: stringValue(entry.description, `progression.dailyObjectives[${index}].description`),
      target: finite(entry.target, `progression.dailyObjectives[${index}].target`, 0),
      progress: finite(entry.progress, `progression.dailyObjectives[${index}].progress`, 0),
      startValue: finite(entry.startValue, `progression.dailyObjectives[${index}].startValue`, 0),
      rewardCash: finite(entry.rewardCash, `progression.dailyObjectives[${index}].rewardCash`, 0),
      rewardXp: safeInteger(entry.rewardXp, `progression.dailyObjectives[${index}].rewardXp`, 0),
      completed: entry.completed,
      nutritionCriterion: kind === "nutrition"
        ? nutritionCriterion as DailyObjective["nutritionCriterion"]
        : undefined,
    };
  });
}

/**
 * Reads one nutrient value (known, trace or unavailable).
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @returns The nutrient value.
 * @throws PersistenceError When the status or value is invalid.
 */
export function parseNutritionValue(value: unknown, path: string): NutritionValue {
  if (!isRecord(value)) throw new PersistenceError(`${path} must be an object`);
  if (value.status === "known") {
    return { status: "known", value: finite(value.value, `${path}.value`, 0) };
  }
  if (value.status === "trace") return { status: "trace" };
  if (value.status === "unavailable") {
    const reason =
      value.reason === undefined
        ? undefined
        : assert_one_of(value.reason, NUTRITION_UNAVAILABLE_REASONS, `${path}.reason is invalid`);
    return { status: "unavailable", reason };
  }
  throw new PersistenceError(`${path}.status is invalid`);
}

/**
 * Reads a saved dish nutrition profile.
 *
 * @param value - The untrusted value read from the save.
 * @param path - The save path used in the error message.
 * @returns The profile, with intent fits clamped to one.
 * @throws PersistenceError When a field is missing or invalid.
 */
export function parseNutritionProfile(value: unknown, path: string): NutritionProfile {
  if (!isRecord(value) || !isRecord(value.nutrients)) {
    throw new PersistenceError(`${path} must be a nutrition profile`);
  }
  const nutrientSource = value.nutrients;
  if (
    value.status !== "released" &&
    value.status !== "unavailable" &&
    value.status !== "quarantined"
  ) {
    throw new PersistenceError(`${path}.status is invalid`);
  }
  if (value.nutritionClass !== "meal" && value.nutritionClass !== "drink") {
    throw new PersistenceError(`${path}.nutritionClass is invalid`);
  }
  const servingSource = value.serving;
  if (
    servingSource !== undefined &&
    (!isRecord(servingSource) || (servingSource.unit !== "g" && servingSource.unit !== "ml"))
  ) throw new PersistenceError(`${path}.serving is invalid`);
  const intentFitsSource = isRecord(value.intentFits) ? value.intentFits : {};
  const intentFits: Partial<Record<NutritionIntent, number>> = {};
  for (const intent of NUTRITION_INTENTS) {
    const fit = intentFitsSource[intent];
    if (fit === undefined) continue;
    intentFits[intent] = Math.min(1, finite(fit, `${path}.intentFits.${intent}`, 0));
  }
  const conditionRatingsSource = isRecord(value.conditionRatings)
    ? value.conditionRatings
    : undefined;
  const conditionRatings: Partial<Record<HealthCondition, number>> = {};
  if (conditionRatingsSource) {
    for (const condition of HEALTH_CONDITIONS) {
      const rating = conditionRatingsSource[condition];
      if (rating === undefined) continue;
      conditionRatings[condition] = healthRating(
        rating,
        `${path}.conditionRatings.${condition}`,
      );
    }
  }
  return {
    id: stringValue(value.id, `${path}.id`),
    dishId: stringValue(value.dishId, `${path}.dishId`),
    status: value.status,
    serving: isRecord(servingSource)
      ? {
          amount: finite(servingSource.amount, `${path}.serving.amount`, Number.MIN_VALUE),
          unit: servingSource.unit as "g" | "ml",
          label: stringValue(servingSource.label, `${path}.serving.label`),
        }
      : undefined,
    nutrients: Object.fromEntries(
      NUTRITION_METRICS.map((metric) => [
        metric,
        parseNutritionValue(nutrientSource[metric], `${path}.nutrients.${metric}`),
      ]),
    ) as Record<NutritionMetric, NutritionValue>,
    intentFits,
    healthRating: value.healthRating === undefined
      ? undefined
      : healthRating(value.healthRating, `${path}.healthRating`),
    conditionRatings: conditionRatingsSource ? conditionRatings : undefined,
    nutritionClass: value.nutritionClass,
  };
}

/**
 * Reads the per-intent request counters of a nutrition metrics section.
 *
 * @param value - The untrusted `byIntent` value read from the save; a non-object reads as empty.
 * @param path - The save path of the `byIntent` section, used in error messages.
 * @returns The counters for every nutrition intent, with missing counters read as zero.
 * @throws PersistenceError When a present counter is not a non-negative safe integer.
 */
function parse_intent_metrics(
  value: unknown,
  path: string,
): Record<NutritionIntent, NutritionIntentMetrics> {
  const source_by_intent = isRecord(value) ? value : {};
  return Object.fromEntries(NUTRITION_INTENTS.map((intent) => {
    const source = isRecord(source_by_intent[intent]) ? source_by_intent[intent] : {};
    return [intent, {
      requests: safeInteger(source.requests ?? 0, `${path}.${intent}.requests`),
      matches: safeInteger(source.matches ?? 0, `${path}.${intent}.matches`),
      misses: safeInteger(source.misses ?? 0, `${path}.${intent}.misses`),
      unknowns: safeInteger(source.unknowns ?? 0, `${path}.${intent}.unknowns`),
    } satisfies NutritionIntentMetrics];
  })) as Record<NutritionIntent, NutritionIntentMetrics>;
}

/**
 * Reads the per-nutrient amount totals of a nutrition metrics section.
 *
 * @param value - The untrusted `nutrientTotals` value read from the save; a non-object reads as empty.
 * @param path - The save path of the section, used in error messages.
 * @returns The total for every nutrition metric, with missing totals read as zero.
 * @throws PersistenceError When a present total is not a non-negative finite number.
 */
function parse_metric_amounts(value: unknown, path: string): Record<NutritionMetric, number> {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(NUTRITION_METRICS.map((metric) => [
    metric,
    finite(source[metric] ?? 0, `${path}.${metric}`, 0),
  ])) as Record<NutritionMetric, number>;
}

/**
 * Reads the per-nutrient known-value counts of a nutrition metrics section.
 *
 * @param value - The untrusted `nutrientKnownCounts` value read from the save; a non-object reads as empty.
 * @param path - The save path of the section, used in error messages.
 * @returns The count for every nutrition metric, with missing counts read as zero.
 * @throws PersistenceError When a present count is not a non-negative safe integer.
 */
function parse_metric_counts(value: unknown, path: string): Record<NutritionMetric, number> {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(NUTRITION_METRICS.map((metric) => [
    metric,
    safeInteger(source[metric] ?? 0, `${path}.${metric}`),
  ])) as Record<NutritionMetric, number>;
}

/**
 * Reads the per-dish serving counts of a nutrition metrics section.
 *
 * @param value - The untrusted `dishServings` value read from the save; a non-object reads as empty.
 * @param path - The save path of the section, used in error messages.
 * @returns The serving count keyed by dish ID, in saved key order.
 * @throws PersistenceError When a count is not a non-negative safe integer.
 */
function parse_dish_servings(value: unknown, path: string): Record<string, number> {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(Object.entries(source).map(([dishId, count]) => [
    dishId,
    safeInteger(count, `${path}.${dishId}`),
  ]));
}

/**
 * Reads one day's nutrition metrics, filling missing counters with zero.
 *
 * Fields are read in a fixed order, so the first invalid field is the one reported.
 *
 * @param value - The untrusted day section read from the save; a non-object reads as empty.
 * @param prefix - The save path prefix of the section, ending in a dot, used in error messages.
 * @returns The day's nutrition metrics.
 * @throws PersistenceError When a present counter or total is invalid.
 */
function parse_day_metrics(value: unknown, prefix: string): NutritionDailyMetrics {
  const source = isRecord(value) ? value : {};
  return {
    day: safeInteger(source.day ?? 0, `${prefix}day`),
    servedMeals: safeInteger(source.servedMeals ?? 0, `${prefix}servedMeals`),
    profiledServings: safeInteger(source.profiledServings ?? 0, `${prefix}profiledServings`),
    intentRequests: safeInteger(source.intentRequests ?? 0, `${prefix}intentRequests`),
    intentMatches: safeInteger(source.intentMatches ?? 0, `${prefix}intentMatches`),
    intentMisses: safeInteger(source.intentMisses ?? 0, `${prefix}intentMisses`),
    intentUnknowns: safeInteger(source.intentUnknowns ?? 0, `${prefix}intentUnknowns`),
    byIntent: parse_intent_metrics(source.byIntent, `${prefix}byIntent`),
    nutrientTotals: parse_metric_amounts(source.nutrientTotals, `${prefix}nutrientTotals`),
    nutrientKnownCounts: parse_metric_counts(source.nutrientKnownCounts, `${prefix}nutrientKnownCounts`),
    dishServings: parse_dish_servings(source.dishServings, `${prefix}dishServings`),
  };
}

/**
 * Reads the saved nutrition metrics, filling missing counters with zero.
 *
 * Only the latest 50 recent outcomes are kept. The lifetime per-intent counters are read
 * before the recent outcomes and the lifetime totals, so the reported error stays the same
 * when a save has more than one invalid field.
 *
 * @param value - The untrusted value read from the save.
 * @returns The nutrition metrics.
 * @throws PersistenceError When a present counter or outcome is invalid.
 */
export function parseNutritionMetrics(value: unknown): NutritionMetrics {
  if (!isRecord(value)) return createEmptyNutritionMetrics();
  const empty = createEmptyNutritionMetrics();
  const byIntent = parse_intent_metrics(value.byIntent, "metrics.nutrition.byIntent");
  const recentSource = Array.isArray(value.recentOutcomes) ? value.recentOutcomes : [];
  const recentOutcomes = recentSource.slice(-50).map((entry, index) => {
    const path = `metrics.nutrition.recentOutcomes[${index}]`;
    if (!isRecord(entry)) throw new PersistenceError(`${path} must be an object`);
    const intentId =
      entry.intentId === undefined
        ? undefined
        : assert_one_of(entry.intentId, NUTRITION_INTENTS, `${path}.intentId is invalid`);
    const result = entry.result;
    if (result !== "matched" && result !== "missed" && result !== "unknown") {
      throw new PersistenceError(`${path}.result is invalid`);
    }
    return {
      customerId: stringValue(entry.customerId, `${path}.customerId`),
      day: safeInteger(entry.day, `${path}.day`, 1),
      intentId,
      dishId: stringValue(entry.dishId, `${path}.dishId`),
      variantId: typeof entry.variantId === "string" ? entry.variantId : undefined,
      result: result as NutritionRequestResult,
      profile: entry.profile === undefined
        ? undefined
        : parseNutritionProfile(entry.profile, `${path}.profile`),
    };
  });
  return {
    ...empty,
    servedMeals: safeInteger(value.servedMeals ?? 0, "metrics.nutrition.servedMeals"),
    profiledServings: safeInteger(value.profiledServings ?? 0, "metrics.nutrition.profiledServings"),
    nonDefaultVariantServings: safeInteger(
      value.nonDefaultVariantServings ?? 0,
      "metrics.nutrition.nonDefaultVariantServings",
    ),
    intentRequests: safeInteger(value.intentRequests ?? 0, "metrics.nutrition.intentRequests"),
    intentMatches: safeInteger(value.intentMatches ?? 0, "metrics.nutrition.intentMatches"),
    intentMisses: safeInteger(value.intentMisses ?? 0, "metrics.nutrition.intentMisses"),
    intentUnknowns: safeInteger(value.intentUnknowns ?? 0, "metrics.nutrition.intentUnknowns"),
    byIntent,
    nutrientTotals: parse_metric_amounts(value.nutrientTotals, "metrics.nutrition.nutrientTotals"),
    nutrientKnownCounts: parse_metric_counts(
      value.nutrientKnownCounts,
      "metrics.nutrition.nutrientKnownCounts",
    ),
    dishServings: parse_dish_servings(value.dishServings, "metrics.nutrition.dishServings"),
    recentOutcomes,
    today: parse_day_metrics(value.today, "metrics.nutrition.today."),
  };
}

/**
 * Reads the saved per-stall mastery records.
 *
 * @param value - The untrusted value read from the save.
 * @returns The mastery records keyed by stall ID; empty when the value is absent.
 * @throws PersistenceError When a mastery entry is malformed.
 */
export function parseMastery(value: unknown): Readonly<Record<string, StallMasteryState>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([id, entry]) => {
    if (!isRecord(entry)) throw new PersistenceError(`progression.stallMastery.${id} must be an object`);
    const upgradeLevel = safeInteger(entry.upgradeLevel, `progression.stallMastery.${id}.upgradeLevel`, 1, 4);
    return [id, {
      points: safeInteger(entry.points, `progression.stallMastery.${id}.points`, 0),
      rank: safeInteger(entry.rank, `progression.stallMastery.${id}.rank`, 1),
      upgradeLevel: upgradeLevel as 1 | 2 | 3 | 4,
    }];
  }));
}

/**
 * Reads the saved visit ratings, upgrading legacy walking scores.
 *
 * Only the latest 50 ratings are kept. Ratings saved before walking metric version 2 get
 * their walking component floored at 70 and their score adjusted to match.
 *
 * @param value - The untrusted value read from the save.
 * @returns The visit ratings, each tagged as walking metric version 2.
 * @throws PersistenceError When a rating entry is malformed.
 */
export function parseVisitRatings(value: unknown): readonly VisitRating[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-50).map((entry, index) => {
    if (!isRecord(entry) || !isRecord(entry.components)) throw new PersistenceError(`metrics.visitRatings[${index}] must be an object`);
    const componentsRecord = entry.components;
    const parsedComponents = Object.fromEntries(
      VISIT_RATING_COMPONENT_KEYS.map((key) => [
        key,
        boundedPercentage(componentsRecord[key], `metrics.visitRatings[${index}].components.${key}`),
      ]),
    ) as unknown as VisitRating["components"];
    const usesDistanceMetric = entry.walkingMetricVersion === 2;
    const legacyWalking = parsedComponents.walking;
    const components = usesDistanceMetric
      ? parsedComponents
      : { ...parsedComponents, walking: Math.max(70, legacyWalking) };
    if (typeof entry.served !== "boolean" || typeof entry.abandoned !== "boolean") {
      throw new PersistenceError(`metrics.visitRatings[${index}] outcome flags must be boolean`);
    }
    const legacyScore = boundedPercentage(entry.score, `metrics.visitRatings[${index}].score`);
    const score = usesDistanceMetric
      ? legacyScore
      : Math.round(Math.max(0, Math.min(100, legacyScore + (components.walking - legacyWalking) * 0.1)));
    return {
      customerId: stringValue(entry.customerId, `metrics.visitRatings[${index}].customerId`),
      walkingMetricVersion: 2,
      score,
      served: entry.served,
      abandoned: entry.abandoned,
      reason: stringValue(entry.reason, `metrics.visitRatings[${index}].reason`),
      stallDefinitionId: typeof entry.stallDefinitionId === "string" ? entry.stallDefinitionId : undefined,
      components,
      day: safeInteger(entry.day, `metrics.visitRatings[${index}].day`, 1),
    };
  });
}
