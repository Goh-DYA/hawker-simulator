/**
 * The Zod schemas of the launch content.
 *
 * `validateContent` parses the content with `launchContentSchema` before it runs the
 * semantic rules in `rules.ts`, and `nutrition.ts` parses the generated nutrition data
 * with `nutritionContentSchema` at import. The content types in `types.ts` are derived
 * from these schemas, so a field is described once, here. The enumerated values each
 * have a named schema, so `types.ts` can name their union types.
 */
import { z } from "zod";

export const contentIdSchema = z
  .string()
  .min(3)
  .regex(/^(stall|dish|item|customer)\.[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const cardinalDirectionSchema = z.enum([
  "north",
  "east",
  "south",
  "west",
]);

export const rotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export const gridPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const footprintSchema = z.object({
  width: z.number().int().positive().max(8),
  height: z.number().int().positive().max(8),
});

export const unlockRequirementSchema = z.object({
  level: z.number().int().positive(),
  reputation: z.number().int().nonnegative(),
  prerequisiteIds: z.array(contentIdSchema),
});

export const spriteReferenceSchema = z.object({
  atlas: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  frame: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const audioReferenceSchema = z.object({
  event: z.string().min(3).regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
  volume: z.number().min(0).max(1),
});

const localizationKeySchema = z
  .string()
  .regex(/^(stall|dish|item|customer)\.[a-z0-9]+(?:-[a-z0-9]+)*\.(name|description)$/);

const qualitySchema = z.number().min(0).max(1);
const fivePointRatingSchema = z
  .number()
  .min(1)
  .max(5)
  .refine(
    (value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9,
    "Rating must use one decimal place.",
  );

export const signShapeSchema = z.enum(["awning", "lightbox", "painted-board", "tile-panel"]);

export const stallUpgradeSchema = z.object({
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  cost: z.number().int().positive(),
  serviceTimeMultiplier: z.number().positive().max(1),
  capacityBonus: z.number().int().nonnegative(),
  qualityBonus: z.number().min(0).max(0.5),
  menuSlotsBonus: z.number().int().nonnegative().max(4),
});

export const stallSchema = z.object({
  id: contentIdSchema.refine((id) => id.startsWith("stall.")),
  nameKey: localizationKeySchema,
  descriptionKey: localizationKeySchema,
  cuisineTags: z.array(z.string().min(2)).min(2),
  footprint: footprintSchema,
  servicePoint: gridPointSchema,
  queueAnchor: gridPointSchema,
  queueDirection: cardinalDirectionSchema,
  menuSlots: z.number().int().positive().max(8),
  dishIds: z.array(contentIdSchema).min(1),
  serviceTimeMs: z.number().int().positive(),
  preparationCapacity: z.number().int().positive().max(12),
  quality: qualitySchema,
  popularity: qualitySchema,
  purchaseCost: z.number().int().positive(),
  operatingCostPerMinute: z.number().int().nonnegative(),
  upgradeLevels: z.array(stallUpgradeSchema).length(3),
  unlockRequirement: unlockRequirementSchema,
  visual: z.object({
    sprite: spriteReferenceSchema,
    palette: z.tuple([
      z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    ]),
    signShape: signShapeSchema,
    counterFacing: cardinalDirectionSchema,
    depthSortAnchor: gridPointSchema,
  }),
  animationReferences: z.array(z.string().min(3)).min(1),
  audioReferences: z.array(audioReferenceSchema).min(1),
  tags: z.array(z.string().min(2)).min(2),
});

export const dishCategorySchema = z.enum([
  "rice",
  "noodles",
  "bread",
  "soup",
  "small-plate",
  "seafood",
  "drink",
  "dessert",
]);

export const dietaryTagSchema = z.enum([
  "contains-egg",
  "contains-pork",
  "contains-seafood",
  "contains-dairy",
  "contains-peanuts",
  "plant-based-recipe",
  "spicy",
]);

export const steamEffectSchema = z.enum(["none", "light", "full"]);

export const dishSchema = z.object({
  id: contentIdSchema.refine((id) => id.startsWith("dish.")),
  nameKey: localizationKeySchema,
  descriptionKey: localizationKeySchema,
  stallIds: z.array(contentIdSchema).length(1),
  category: dishCategorySchema,
  price: z.number().int().positive(),
  baseDemand: qualitySchema,
  preparationTimeMs: z.number().int().positive(),
  servingTimeMs: z.number().int().positive(),
  eatingTimeMs: z.number().int().positive(),
  quality: qualitySchema,
  /** Taste and popularity rating, independent from nutritional suitability. */
  starRating: fivePointRatingSchema,
  preferenceTags: z.array(z.string().min(2)).min(2),
  dietaryTags: z.array(dietaryTagSchema),
  unlockRequirement: unlockRequirementSchema,
  foodSprite: spriteReferenceSchema,
  containerSprite: spriteReferenceSchema,
  portionColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  steamEffect: steamEffectSchema,
});

export const placeableCategorySchema = z.enum([
  "table",
  "seat",
  "stall-fixture",
  "tray-waste",
  "lighting",
  "fan",
  "plant",
  "signage",
  "divider",
  "facility",
  "decor",
]);

export const interactionRoleSchema = z.enum([
  "use",
  "sit",
  "queue",
  "return-tray",
  "dispose-waste",
  "wash-hands",
  "collect-water",
  "inspect-menu",
]);

export const interactionPointSchema = gridPointSchema.extend({
  role: interactionRoleSchema,
  facing: cardinalDirectionSchema,
});

export const seatPointSchema = gridPointSchema.extend({
  facing: cardinalDirectionSchema,
  comfort: qualitySchema,
  accessible: z.boolean(),
});

export const walkabilitySchema = z.enum(["blocked", "pass-through", "underpass"]);

export const placeableSchema = z.object({
  id: contentIdSchema.refine((id) => id.startsWith("item.")),
  nameKey: localizationKeySchema,
  descriptionKey: localizationKeySchema,
  category: placeableCategorySchema,
  footprint: footprintSchema,
  rotations: z.array(rotationSchema).min(1),
  price: z.number().int().positive(),
  resaleValue: z.number().int().nonnegative(),
  upkeepPerMinute: z.number().int().nonnegative(),
  unlockRequirement: unlockRequirementSchema,
  walkability: walkabilitySchema,
  collision: z.array(gridPointSchema),
  interactionPoints: z.array(interactionPointSchema),
  seatPoints: z.array(seatPointSchema),
  queuePoints: z.array(gridPointSchema),
  pivot: gridPointSchema,
  depthSortAnchor: gridPointSchema,
  spriteReferences: z.array(spriteReferenceSchema).min(1),
  animationReferences: z.array(z.string().min(3)),
  audioReferences: z.array(audioReferenceSchema),
  ambienceValue: z.number().int().min(-20).max(30),
  cleanlinessModifier: z.number().int().min(-20).max(30),
  serviceModifiers: z.object({
    queuePatience: z.number().min(-1).max(1),
    eatingSpeed: z.number().min(-1).max(1),
    cleaningEfficiency: z.number().min(-1).max(1),
    movementSpeed: z.number().min(-1).max(1),
  }),
  lightRadius: z.number().int().nonnegative().max(12),
  tags: z.array(z.string().min(2)).min(2),
});

export const seatPreferenceSchema = z.enum([
  "any",
  "quiet",
  "near-stall",
  "group-table",
  "accessible",
  "breezy",
  "bright",
]);

export const outfitSilhouetteSchema = z.enum([
  "compact",
  "relaxed",
  "structured",
  "layered",
  "sporty",
  "classic",
]);

export const garmentPatternSchema = z.enum([
  "plain",
  "banded",
  "panelled",
  "sashed",
  "piped",
  "pocketed",
]);

export const carryPropSchema = z.enum(["none", "tote", "briefcase", "backpack", "walking-aid"]);

export const customerArchetypeSchema = z.object({
  id: contentIdSchema.refine((id) => id.startsWith("customer.")),
  nameKey: localizationKeySchema,
  descriptionKey: localizationKeySchema,
  gameplayRole: z.string().min(8),
  budgetRange: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  patienceSeconds: z.number().positive(),
  walkingSpeedTilesPerSecond: z.number().positive().max(5),
  priceSensitivity: qualitySchema,
  qualitySensitivity: qualitySchema,
  queueSensitivity: qualitySchema,
  distanceSensitivity: qualitySchema,
  noveltyPreference: qualitySchema,
  seatPreference: seatPreferenceSchema,
  dishPreferenceTags: z.array(z.string().min(2)).min(2),
  groupSizeRange: z.tuple([
    z.number().int().positive().max(8),
    z.number().int().positive().max(8),
  ]),
  visualRules: z.object({
    outfitSilhouette: outfitSilhouetteSchema,
    garmentPattern: garmentPatternSchema,
    accessoryChance: qualitySchema,
    carryProp: carryPropSchema,
  }),
  visitSchedule: z.object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    peakMultiplier: z.number().positive().max(5),
  }),
  satisfactionModifiers: z.object({
    value: z.number().min(-1).max(1),
    speed: z.number().min(-1).max(1),
    comfort: z.number().min(-1).max(1),
    variety: z.number().min(-1).max(1),
    cleanliness: z.number().min(-1).max(1),
  }),
  spendMultiplier: z.number().positive().max(4),
  trayReturnChance: qualitySchema,
  unlockRequirement: unlockRequirementSchema,
  tags: z.array(z.string().min(2)).min(2),
});

export const economySchema = z.object({
  startingCash: z.number().int().positive(),
  startingReputation: z.number().int().nonnegative(),
  maxLevel: z.number().int().positive(),
  maxReputation: z.number().int().positive(),
  minimumVisitEarnings: z.number().int().positive(),
  starterRequiredSeats: z.number().int().positive(),
  recoveryGrant: z.number().int().positive(),
  levelXpThresholds: z.array(z.number().int().nonnegative()).min(2),
});

export const nutritionMetricSchema = z.enum([
  "energyKcal",
  "proteinG",
  "totalFatG",
  "saturatedFatG",
  "transFatG",
  "carbohydrateG",
  "totalSugarG",
  "dietaryFibreG",
  "sodiumMg",
  "calciumMg",
  "ironMg",
  "waterG",
]);

export const nutritionIntentIdSchema = z.enum([
  "lighter-energy",
  "protein-forward",
  "fibre-forward",
  "sodium-aware",
  "lower-total-sugar-drink",
]);

export const healthConditionSchema = z.enum([
  "high-cholesterol",
  "obesity",
  "diabetes",
  "hypertension",
]);

export const nutritionUnavailableReasonSchema = z.enum([
  "not-reported",
  "invalid-source",
  "unmapped",
]);

export const nutritionProfileStatusSchema = z.enum(["released", "unavailable", "quarantined"]);

export const nutritionClassSchema = z.enum(["meal", "drink"]);

export const nutritionServingUnitSchema = z.enum(["g", "ml"]);

export const nutritionMappingKindSchema = z.enum(["exact", "curated-synonym", "scaled-exact"]);

export const nutritionIntentDirectionSchema = z.enum(["lower", "higher"]);

export const nutritionGuidelineComparisonSchema = z.enum(["context-only", "not-comparable"]);

export const nutritionValueSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("known"), value: z.number().finite().nonnegative() }),
  z.object({ status: z.literal("trace") }),
  z.object({
    status: z.literal("unavailable"),
    reason: nutritionUnavailableReasonSchema,
  }),
]);

export const nutritionNutrientsSchema = z.object({
  energyKcal: nutritionValueSchema,
  proteinG: nutritionValueSchema,
  totalFatG: nutritionValueSchema,
  saturatedFatG: nutritionValueSchema,
  transFatG: nutritionValueSchema,
  carbohydrateG: nutritionValueSchema,
  totalSugarG: nutritionValueSchema,
  dietaryFibreG: nutritionValueSchema,
  sodiumMg: nutritionValueSchema,
  calciumMg: nutritionValueSchema,
  ironMg: nutritionValueSchema,
  waterG: nutritionValueSchema,
});

export const nutritionServingSchema = z.object({
  amount: z.number().finite().positive(),
  unit: nutritionServingUnitSchema,
  label: z.string().min(2),
});

export const nutritionProvenanceSchema = z.object({
  snapshotId: z.string().min(3),
  sourceFile: z.string().min(3).refine(
    (fileName) => !/[\\/]/.test(fileName),
    "Source provenance must store a file name, not a path.",
  ),
  sourceFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceRowNumber: z.number().int().min(2),
  sourceFoodName: z.string().min(2),
  sourceRowSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceDataType: z.string().min(1),
  mappingKind: nutritionMappingKindSchema,
  multiplier: z.number().positive(),
  reviewNote: z.string().min(8),
});

export const nutritionProfileSchema = z.object({
  id: z.string().min(3),
  dishId: contentIdSchema.refine((id) => id.startsWith("dish.")),
  variantId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  status: nutritionProfileStatusSchema,
  nutritionClass: nutritionClassSchema,
  serving: nutritionServingSchema.optional(),
  nutrients: nutritionNutrientsSchema,
  /** Comparative, per-serving game rating within the same nutrition class. */
  healthRating: fivePointRatingSchema,
  /** Comparative game ratings using condition-specific nutrient weightings. */
  conditionRatings: z.record(healthConditionSchema, fivePointRatingSchema),
  intentFits: z.partialRecord(
    nutritionIntentIdSchema,
    z.number().min(0).max(1),
  ),
  provenance: nutritionProvenanceSchema.optional(),
  unavailableReason: nutritionUnavailableReasonSchema.optional(),
  reviewNote: z.string().min(8),
  quarantineReasons: z.array(z.string().min(8)).min(1).optional(),
});

export const nutritionVariantSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  profileId: z.string().min(3),
  unlockRank: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(7)]),
  visualKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const nutritionVariantFamilySchema = z.object({
  dishId: contentIdSchema.refine((id) => id.startsWith("dish.")),
  defaultVariantId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  variants: z.array(nutritionVariantSchema).min(2),
});

export const nutritionIntentSchema = z.object({
  id: nutritionIntentIdSchema,
  name: z.string().min(3),
  description: z.string().min(16),
  metric: nutritionMetricSchema,
  direction: nutritionIntentDirectionSchema,
  nutritionClass: nutritionClassSchema,
});

export const nutritionSourceSnapshotSchema = z.object({
  id: z.string().min(3),
  fileName: z.string().min(3).refine(
    (fileName) => !/[\\/]/.test(fileName),
    "Source snapshots must store a file name, not a path.",
  ),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  rowCount: z.number().int().positive(),
});

export const nutritionGuidelineSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nutrient: z.string().min(2),
  lowerLimit: z.string().min(1),
  upperLimit: z.string().min(1),
  remarks: z.string().min(8),
  source: z.string().min(2),
  comparison: nutritionGuidelineComparisonSchema,
  notComparableReason: z.string().min(8).optional(),
});

export const nutritionContentSchema = z.object({
  schemaVersion: z.literal(2),
  dataVersion: z.string().regex(/^sg-[a-f0-9]{12}-[a-f0-9]{12}$/),
  sourceSnapshots: z.array(nutritionSourceSnapshotSchema).min(1),
  profiles: z.array(nutritionProfileSchema).min(1),
  variantFamilies: z.array(nutritionVariantFamilySchema).min(1),
  intents: z.array(nutritionIntentSchema).min(1),
  guidelines: z.array(nutritionGuidelineSchema).min(1),
  disclosure: z.string().min(100),
});

export const launchContentSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  economy: economySchema,
  stalls: z.array(stallSchema),
  dishes: z.array(dishSchema),
  placeables: z.array(placeableSchema),
  customerArchetypes: z.array(customerArchetypeSchema),
  nutrition: nutritionContentSchema,
  localization: z.record(z.string(), z.string().min(1)),
});

/** A neighbourhood day-card ID, such as `calendar.monsoon-shower`. */
export const calendarCardIdSchema = z.string().regex(/^calendar\.[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** A multiplier a day card applies, where 1 changes nothing. */
const calendarFactorSchema = z.number().min(0.25).max(3);

export const calendarCardSchema = z.object({
  id: calendarCardIdSchema,
  /** The fixed card of day 1; exactly one card is the opening day, and it is never drawn. */
  isOpeningDay: z.boolean(),
  /** How demanding the day is, from 0 (calm) to 1 (busy); the director weighs cards by it. */
  intensity: z.number().min(0).max(1),
  /** Multiplies the whole day's arrival demand. */
  arrivalFactor: calendarFactorSchema,
  /** Multiplies the lunch crowd's peak. */
  lunchPeakFactor: calendarFactorSchema,
  /** Multiplies the dinner crowd's peak. */
  dinnerPeakFactor: calendarFactorSchema,
  /** Multiplies how long guests take to eat, so values above 1 mean guests linger. */
  eatingTimeFactor: calendarFactorSchema,
  /** Arrival-weight multipliers for named customer archetypes. */
  archetypeFactors: z.array(z.object({ archetypeId: contentIdSchema, factor: calendarFactorSchema })),
  /** Appeal added to dishes of a category when guests choose a stall and a dish. */
  categoryAppeal: z.array(z.object({ category: dishCategorySchema, bonus: z.number().min(-2).max(2) })),
  /** The card's English copy, shown in the HUD and the Service Review. */
  copy: z.object({
    name: z.string().min(3),
    /** One short line naming the day's effect, for the Today strip. */
    summary: z.string().min(10).max(90),
    /** The forecast line shown the day before. */
    forecast: z.string().min(20).max(160),
  }),
});
