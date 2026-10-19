/**
 * Builds `src/content/nutrition.generated.json` from the reviewed Singapore food and
 * adult daily guideline CSV files, and runs as the `node tools/nutrition/importer.mjs` CLI.
 *
 * It verifies the source hashes against the manifest, maps each dish (and each variant)
 * to its reviewed source row, quarantines implausible rows, and then rates every profile.
 * CSV parsing lives in `csv.mjs` and the rating passes in `ratings.mjs`; both are
 * re-exported here so callers keep one entry point.
 */
// @ts-check
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_FOOD_FILE_SHA256,
  EXPECTED_GUIDELINE_FILE_SHA256,
  NUTRITION_DISCLOSURE,
  NUTRITION_GUIDELINE_COUNT,
  NUTRITION_INTENTS,
  NUTRITION_REVIEW_REVISION,
  PRIMARY_PROFILE_MAPPINGS,
  VARIANT_FAMILY_MAPPINGS,
} from "./manifest.mjs";
import { canonicalRowHash, parseCsv, sha256 } from "./csv.mjs";
import {
  addHealthRatings,
  addIntentFits,
  NEUTRAL_CONDITION_RATINGS,
  round,
} from "./ratings.mjs";

export { canonicalRowHash, parseCsv } from "./csv.mjs";
export {
  addHealthRatings,
  addIntentFits,
  computeRelativeFits,
  MEAL_RATING_WEIGHTS,
  nutritionValueForComparison,
} from "./ratings.mjs";

/**
 * @import {
 *   NutritionClass,
 *   NutritionIntentId,
 *   NutritionProfileStatus,
 *   NutritionProvenance,
 *   NutritionUnavailableReason,
 *   NutritionValue,
 * } from "../../src/content/types"
 * @import { CsvRow, ParsedCsv } from "./csv.mjs"
 */

/**
 * A parsed per-serving size. `unit` is the lowercased source unit, `g` or `ml`.
 *
 * @typedef {object} Serving
 * @property {number} amount
 * @property {string} unit
 * @property {string} label
 */

/**
 * A manifest mapping from a dish (or one of its variants) to a reviewed source food row.
 *
 * @typedef {object} SourceMapping
 * @property {string} dishId
 * @property {string} foodName - The exact, case-sensitive `Food Name` of the source row.
 * @property {NutritionClass} nutritionClass
 * @property {string} reviewNote
 * @property {NutritionProvenance["mappingKind"]} mappingKind
 * @property {number} [multiplier] - Scale from the source serving to the game serving.
 * @property {string} [servingLabel] - Serving label to use instead of the source's.
 */

/**
 * A source file's identity as recorded in the generated content.
 *
 * @typedef {object} SourceSnapshot
 * @property {string} id
 * @property {string} fileName
 * @property {string} sha256
 * @property {number} rowCount
 */

/**
 * A nutrition profile while the importer builds and rates it. It becomes one
 * `NutritionProfile` in the generated content.
 *
 * @typedef {object} DraftProfile
 * @property {string} id
 * @property {string} dishId
 * @property {string} [variantId]
 * @property {NutritionProfileStatus} status
 * @property {NutritionClass} nutritionClass
 * @property {Serving} [serving]
 * @property {Record<string, NutritionValue>} nutrients
 * @property {number} healthRating
 * @property {Record<string, number>} conditionRatings
 * @property {Partial<Record<NutritionIntentId, number>>} intentFits
 * @property {NutritionProvenance} [provenance]
 * @property {NutritionUnavailableReason} [unavailableReason]
 * @property {string} reviewNote
 * @property {string[]} [quarantineReasons]
 */

/**
 * Validated command-line options. `parseArguments` guarantees that exactly one of
 * `guidelinePath` and `preservedGuidelinesPath` is set.
 *
 * @typedef {object} ImporterOptions
 * @property {boolean} acceptSourceUpdate
 * @property {string} outputPath
 * @property {string} foodPath
 * @property {string} [guidelinePath]
 * @property {string} [preservedGuidelinesPath]
 */

const TOOL_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUTPUT_PATH = path.resolve(
  TOOL_DIRECTORY,
  "../../src/content/nutrition.generated.json",
);

/** The food source's per-serving column for each nutrient metric, in output order. */
export const NUTRIENT_COLUMNS = {
  energyKcal: "Energy (kcal) - Per Serving",
  proteinG: "Protein (g) - Per Serving",
  totalFatG: "Total Fat (g) - Per Serving",
  saturatedFatG: "Saturated Fat (g) - Per Serving",
  transFatG: "Trans Fat (g) - Per Serving",
  carbohydrateG: "Carbohydrate (g) - Per Serving",
  totalSugarG: "Sugar (g) - Per Serving",
  dietaryFibreG: "Dietary Fibre (g) - Per Serving",
  sodiumMg: "Sodium (mg) - Per Serving",
  calciumMg: "Calcium (mg) - Per Serving",
  ironMg: "Iron (mg) - Per Serving",
  waterG: "Water (g) - Per Serving",
};

/**
 * Stable guideline ids keyed by the guideline source's `Nutrient` cell.
 *
 * @type {Readonly<Record<string, string>>}
 */
const GUIDELINE_IDS = {
  "kcal (Energy)": "energy",
  Fats: "fats",
  "Saturated Fat": "saturated-fat",
  "Trans Fat": "trans-fat",
  Protein: "protein",
  Carbohydrates: "carbohydrates",
  Sugar: "added-sugar",
  Fiber: "fibre",
  Cholesterol: "cholesterol",
  Sodium: "sodium",
  Water: "drinking-water",
};

const UNGROUPED_NUMERIC_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const GROUPED_NUMERIC_PATTERN = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/;

/**
 * Grams by which a component (saturated or trans fat, sugar, fibre) may exceed its parent
 * (total fat or carbohydrate) before the row is quarantined, to allow for source rounding.
 */
const COMPONENT_TOLERANCE_G = 0.1;
/** How far the protein, fat and carbohydrate mass may exceed the serving mass, as a ratio. */
const MAX_MACRONUTRIENT_SERVING_RATIO = 1.05;
/** The Atwater energy factor for protein, in kcal per gram, for the energy cross-check. */
const PROTEIN_KCAL_PER_G = 4;
/** The Atwater energy factor for fat, in kcal per gram, for the energy cross-check. */
const FAT_KCAL_PER_G = 9;
/** The Atwater energy factor for carbohydrate, in kcal per gram, for the energy cross-check. */
const CARBOHYDRATE_KCAL_PER_G = 4;
/** Lowest permitted ratio of reported energy to the macronutrient energy estimate. */
const MIN_ENERGY_ESTIMATE_RATIO = 0.5;
/** Highest permitted ratio of reported energy to the macronutrient energy estimate. */
const MAX_ENERGY_ESTIMATE_RATIO = 2;
/** Energy per serving, in kcal, above which a row needs manual review. */
const MANUAL_REVIEW_ENERGY_KCAL = 5_000;
/** Dietary fibre per serving, in grams, above which a row needs manual review. */
const MANUAL_REVIEW_DIETARY_FIBRE_G = 50;

/**
 * Parses one nutrient cell. Blank and `-` cells are unreported, `Trace` is kept as trace,
 * and anything that is not a non-negative plain or comma-grouped number is invalid.
 *
 * @param {string} rawValue - The raw cell text.
 * @param {number} [multiplier] - Scale from the source serving to the game serving.
 * @returns {NutritionValue} The parsed value, rounded to four decimal places when known.
 */
export const parseNutritionValue = (rawValue, multiplier = 1) => {
  const value = rawValue.trim();
  if (value === "" || value === "-") {
    return { status: "unavailable", reason: "not-reported" };
  }
  if (/^trace$/i.test(value)) return { status: "trace" };

  if (
    !UNGROUPED_NUMERIC_PATTERN.test(value) &&
    !GROUPED_NUMERIC_PATTERN.test(value)
  ) {
    return { status: "unavailable", reason: "invalid-source" };
  }

  const normalized = value.replaceAll(",", "");
  const numericValue = Number(normalized) * multiplier;
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { status: "unavailable", reason: "invalid-source" };
  }
  return { status: "known", value: round(numericValue) };
};

/**
 * Parses a `Per Serving (<amount> g|ml)` cell.
 *
 * @param {string} rawValue - The raw `Per Serving Size` cell.
 * @param {number} [multiplier] - Scale from the source serving to the game serving.
 * @param {string} [labelOverride] - Label to use instead of `<amount> <unit>`.
 * @returns {Serving | undefined} The scaled serving, or undefined when the cell does not
 *   match the expected form.
 */
export const parseServing = (rawValue, multiplier = 1, labelOverride) => {
  const match = rawValue
    .trim()
    .match(/^Per Serving\s*\(\s*(\d+(?:\.\d+)?)\s*(g|ml)\s*\)$/i);
  if (!match) return undefined;
  const amount = round(Number(match[1]) * multiplier);
  return {
    amount,
    unit: match[2].toLocaleLowerCase("en"),
    label: labelOverride ?? `${amount} ${match[2].toLocaleLowerCase("en")}`,
  };
};

/**
 * @param {Readonly<Record<string, NutritionValue>>} nutrients
 * @param {string} metric
 * @returns {number | undefined} The metric's amount when known.
 */
const knownValue = (nutrients, metric) => {
  const value = nutrients[metric];
  return value.status === "known" ? value.value : undefined;
};

/**
 * Lists every reason a source row is implausible and must be quarantined for review.
 *
 * @param {Serving | undefined} serving - The parsed serving, if any.
 * @param {Readonly<Record<string, NutritionValue>>} nutrients - The parsed nutrients.
 * @returns {string[]} Distinct reasons in check order; empty when the row is plausible.
 */
export const findQuarantineReasons = (serving, nutrients) => {
  /** @type {string[]} */
  const reasons = [];
  if (!serving || !Number.isFinite(serving.amount) || serving.amount <= 0) {
    reasons.push("Serving amount is missing or invalid.");
  }

  for (const [metric, value] of Object.entries(nutrients)) {
    if (value.status === "unavailable" && value.reason === "invalid-source") {
      reasons.push(`${metric} contains an invalid source value.`);
    }
    if (value.status === "known" && (!Number.isFinite(value.value) || value.value < 0)) {
      reasons.push(`${metric} must be finite and non-negative.`);
    }
  }

  const totalFat = knownValue(nutrients, "totalFatG");
  const saturatedFat = knownValue(nutrients, "saturatedFatG");
  const transFat = knownValue(nutrients, "transFatG");
  const carbohydrate = knownValue(nutrients, "carbohydrateG");
  const totalSugar = knownValue(nutrients, "totalSugarG");
  const dietaryFibre = knownValue(nutrients, "dietaryFibreG");
  const protein = knownValue(nutrients, "proteinG");
  const energy = knownValue(nutrients, "energyKcal");

  if (totalFat !== undefined && saturatedFat !== undefined && saturatedFat > totalFat + COMPONENT_TOLERANCE_G) {
    reasons.push("Saturated fat exceeds total fat.");
  }
  if (totalFat !== undefined && transFat !== undefined && transFat > totalFat + COMPONENT_TOLERANCE_G) {
    reasons.push("Trans fat exceeds total fat.");
  }
  if (carbohydrate !== undefined && totalSugar !== undefined && totalSugar > carbohydrate + COMPONENT_TOLERANCE_G) {
    reasons.push("Total sugar exceeds carbohydrate.");
  }
  if (carbohydrate !== undefined && dietaryFibre !== undefined && dietaryFibre > carbohydrate + COMPONENT_TOLERANCE_G) {
    reasons.push("Dietary fibre exceeds carbohydrate.");
  }

  if (
    serving &&
    protein !== undefined &&
    totalFat !== undefined &&
    carbohydrate !== undefined &&
    protein + totalFat + carbohydrate > serving.amount * MAX_MACRONUTRIENT_SERVING_RATIO
  ) {
    reasons.push("Macronutrient mass exceeds the listed serving mass.");
  }

  if (
    energy !== undefined &&
    protein !== undefined &&
    totalFat !== undefined &&
    carbohydrate !== undefined
  ) {
    const estimatedEnergy =
      protein * PROTEIN_KCAL_PER_G +
      totalFat * FAT_KCAL_PER_G +
      carbohydrate * CARBOHYDRATE_KCAL_PER_G;
    if (
      estimatedEnergy > 0 &&
      (energy < estimatedEnergy * MIN_ENERGY_ESTIMATE_RATIO ||
        energy > estimatedEnergy * MAX_ENERGY_ESTIMATE_RATIO)
    ) {
      reasons.push("Energy falls outside the permitted macronutrient cross-check range.");
    }
  }

  if (energy !== undefined && energy > MANUAL_REVIEW_ENERGY_KCAL) {
    reasons.push("Energy exceeds the manual-review threshold.");
  }
  if (dietaryFibre !== undefined && dietaryFibre > MANUAL_REVIEW_DIETARY_FIBRE_G) {
    reasons.push("Dietary fibre exceeds the manual-review threshold.");
  }

  return [...new Set(reasons)];
};

/**
 * @param {NutritionUnavailableReason} reason
 * @returns {Record<string, NutritionValue>} Every metric unavailable for the same reason.
 */
const unavailableNutrients = (reason) =>
  Object.fromEntries(
    Object.keys(NUTRIENT_COLUMNS).map((metric) => [
      metric,
      { status: "unavailable", reason },
    ]),
  );

/**
 * Finds the one food row whose `Food Name` matches exactly, case included.
 *
 * @param {ParsedCsv} parsedFood - The parsed food source.
 * @param {string} foodName - The reviewed food name.
 * @returns {CsvRow} The matching row.
 * @throws {Error} When no row or more than one row matches.
 */
export const findUniqueFoodRow = (parsedFood, foodName) => {
  const matches = parsedFood.rows.filter(
    ({ values }) => values["Food Name"] === foodName,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one case-sensitive Food Name match for "${foodName}"; found ${matches.length}.`,
    );
  }
  return matches[0];
};

/**
 * Builds the profile for a mapped food row: released when the row is plausible and
 * quarantined otherwise, with placeholder ratings until the rating passes run.
 *
 * @param {{
 *   mapping: SourceMapping;
 *   profileId: string;
 *   variantId?: string;
 *   parsedFood: ParsedCsv;
 *   foodSnapshot: SourceSnapshot;
 * }} options
 * @returns {DraftProfile}
 */
const buildReleasedProfile = ({
  mapping,
  profileId,
  variantId,
  parsedFood,
  foodSnapshot,
}) => {
  const source = findUniqueFoodRow(parsedFood, mapping.foodName);
  const multiplier = mapping.multiplier ?? 1;
  const nutrients = Object.fromEntries(
    Object.entries(NUTRIENT_COLUMNS).map(([metric, column]) => [
      metric,
      parseNutritionValue(source.values[column] ?? "", multiplier),
    ]),
  );
  const defaultServingLabel = source.values["Default Serving Size"]?.trim();
  const serving = parseServing(
    source.values["Per Serving Size"] ?? "",
    multiplier,
    mapping.servingLabel ??
      (multiplier === 1 && defaultServingLabel && defaultServingLabel !== "-"
        ? defaultServingLabel
        : undefined),
  );
  const quarantineReasons = findQuarantineReasons(serving, nutrients);
  const provenance = {
    snapshotId: foodSnapshot.id,
    sourceFile: foodSnapshot.fileName,
    sourceFileSha256: foodSnapshot.sha256,
    sourceRowNumber: source.sourceRowNumber,
    sourceFoodName: source.values["Food Name"],
    sourceRowSha256: canonicalRowHash(parsedFood.headers, source.values),
    sourceDataType: source.values["Source of Data"],
    mappingKind: mapping.mappingKind,
    multiplier,
    reviewNote: mapping.reviewNote,
  };

  return {
    id: profileId,
    dishId: mapping.dishId,
    ...(variantId === undefined ? {} : { variantId }),
    status: quarantineReasons.length > 0 ? "quarantined" : "released",
    nutritionClass: mapping.nutritionClass,
    ...(serving === undefined ? {} : { serving }),
    nutrients,
    healthRating: 3,
    conditionRatings: { ...NEUTRAL_CONDITION_RATINGS },
    intentFits: {},
    provenance,
    reviewNote: mapping.reviewNote,
    ...(quarantineReasons.length === 0 ? {} : { quarantineReasons }),
  };
};

/**
 * @param {Pick<SourceMapping, "dishId" | "nutritionClass" | "reviewNote">} mapping
 * @returns {DraftProfile} An unavailable profile for a dish with no reviewed source row.
 */
const buildUnavailableProfile = (mapping) => ({
  id: mapping.dishId,
  dishId: mapping.dishId,
  status: "unavailable",
  nutritionClass: mapping.nutritionClass,
  nutrients: unavailableNutrients("unmapped"),
  healthRating: 3,
  conditionRatings: { ...NEUTRAL_CONDITION_RATINGS },
  intentFits: {},
  unavailableReason: "unmapped",
  reviewNote: mapping.reviewNote,
});

/**
 * @param {ParsedCsv} parsedGuidelines - The parsed adult daily guideline source.
 * @throws {Error} When a row names a nutrient with no known guideline id.
 */
const buildGuidelines = (parsedGuidelines) =>
  parsedGuidelines.rows.map(({ values }) => {
    const nutrient = values.Nutrient;
    const id = GUIDELINE_IDS[nutrient];
    if (!id) throw new Error(`Unknown guideline nutrient "${nutrient}".`);

    const notComparableReason =
      nutrient === "Sugar"
        ? "The food dataset reports total sugar, while this guideline refers to added sugar."
        : nutrient === "Cholesterol"
          ? "The food dataset does not report cholesterol."
          : nutrient === "Water"
            ? "Food water in grams is not comparable with drinking-water guidance in millilitres."
            : undefined;

    return {
      id,
      nutrient,
      lowerLimit: values["Recommended Daily Range (Lower Limit)"],
      upperLimit: values["Recommended Daily Range (Upper Limit)"],
      remarks: values["Remarks (if any)"],
      source: values.Source,
      comparison: notComparableReason === undefined ? "context-only" : "not-comparable",
      ...(notComparableReason === undefined ? {} : { notComparableReason }),
    };
  });

/**
 * Stops the import when a source file's hash differs from the reviewed one, unless the
 * update was explicitly accepted.
 *
 * @param {string} label - The source's name in the error message.
 * @param {string} actual - The hash of the file being imported.
 * @param {string} expected - The reviewed hash from the manifest.
 * @param {boolean} acceptSourceUpdate - Whether `--accept-source-update` was passed.
 * @throws {Error} When the hashes differ and the update was not accepted.
 */
export const verifySourceHash = (label, actual, expected, acceptSourceUpdate) => {
  if (actual === expected) return;
  if (!acceptSourceUpdate) {
    throw new Error(
      `${label} SHA-256 changed from ${expected} to ${actual}. Review the source diff and rerun with --accept-source-update only after approval.`,
    );
  }
};

/**
 * Reads the guideline snapshot and rows from previously generated content, so a food-only
 * refresh can keep them without the guideline CSV.
 *
 * @param {{ sourceSnapshots?: unknown; guidelines?: unknown }} content - Parsed generated
 *   nutrition JSON.
 * @returns {{ snapshot: SourceSnapshot; guidelines: Array<Record<string, unknown>> }}
 *   Deep copies of the guideline snapshot and rows.
 * @throws {Error} When the content, the snapshot metadata or any row is malformed.
 */
export const extractPreservedGuidelines = (content) => {
  if (!content || typeof content !== "object") {
    throw new Error("Preserved guideline content must be a generated nutrition object.");
  }
  const snapshots = Array.isArray(content.sourceSnapshots)
    ? content.sourceSnapshots
    : [];
  const snapshot = snapshots.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      typeof candidate.id === "string" &&
      candidate.id.startsWith("guidelines-"),
  );
  if (
    !Array.isArray(content.guidelines) ||
    content.guidelines.length !== NUTRITION_GUIDELINE_COUNT
  ) {
    throw new Error(
      `Preserved guideline content must contain exactly ${NUTRITION_GUIDELINE_COUNT} rows.`,
    );
  }
  if (
    !snapshot ||
    typeof snapshot.fileName !== "string" ||
    /[\\/]/.test(snapshot.fileName) ||
    typeof snapshot.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(snapshot.sha256) ||
    snapshot.id !== `guidelines-${snapshot.sha256.slice(0, 12)}` ||
    !Number.isInteger(snapshot.rowCount) ||
    snapshot.rowCount !== content.guidelines.length
  ) {
    throw new Error("Preserved guideline snapshot metadata is invalid.");
  }
  const guidelines = structuredClone(content.guidelines);
  for (const guideline of guidelines) {
    if (
      !guideline ||
      typeof guideline !== "object" ||
      typeof guideline.id !== "string" ||
      typeof guideline.nutrient !== "string" ||
      typeof guideline.lowerLimit !== "string" ||
      typeof guideline.upperLimit !== "string" ||
      typeof guideline.remarks !== "string" ||
      typeof guideline.source !== "string" ||
      !["context-only", "not-comparable"].includes(guideline.comparison)
    ) {
      throw new Error("Preserved guideline row structure is invalid.");
    }
  }
  return { snapshot: structuredClone(snapshot), guidelines };
};

/**
 * Builds the generated nutrition content from the source texts.
 *
 * @param {{
 *   foodText: string;
 *   guidelineText?: string;
 *   preservedGuidelines?: {
 *     snapshot: {
 *       id: string;
 *       fileName: string;
 *       sha256: string;
 *       rowCount: number;
 *     };
 *     guidelines: Array<Record<string, unknown>>;
 *   };
 *   foodFileName?: string;
 *   guidelineFileName?: string;
 *   expectedFoodSha256?: string;
 *   expectedGuidelineSha256?: string;
 *   acceptSourceUpdate?: boolean;
 * }} options
 * @throws {Error} When the guideline inputs are not exactly one of text and preserved rows,
 *   a source hash differs without approval, a required column is missing, or a mapping
 *   does not resolve.
 */
export const buildNutritionContent = ({
  foodText,
  guidelineText = undefined,
  preservedGuidelines = undefined,
  foodFileName = "food_nutrition_sgfoodid_combined_nutrition_subset.csv",
  guidelineFileName = "daily_nutrition_sgadults.csv",
  expectedFoodSha256,
  expectedGuidelineSha256,
  acceptSourceUpdate = false,
}) => {
  const foodSha256 = sha256(foodText);
  if ((guidelineText === undefined) === (preservedGuidelines === undefined)) {
    throw new Error(
      "Provide either guidelineText or preservedGuidelines, but not both.",
    );
  }
  const guidelineSha256 =
    guidelineText === undefined
      ? /** @type {NonNullable<typeof preservedGuidelines>} */ (preservedGuidelines).snapshot.sha256
      : sha256(guidelineText);
  if (expectedFoodSha256) {
    verifySourceHash("Food source", foodSha256, expectedFoodSha256, acceptSourceUpdate);
  }
  if (expectedGuidelineSha256) {
    verifySourceHash(
      "Guideline source",
      guidelineSha256,
      expectedGuidelineSha256,
      acceptSourceUpdate,
    );
  }

  const parsedFood = parseCsv(foodText);
  const parsedGuidelines =
    guidelineText === undefined ? undefined : parseCsv(guidelineText);
  const requiredFoodHeaders = [
    "Food Name",
    "Default Serving Size",
    "Source of Data",
    "Per Serving Size",
    ...Object.values(NUTRIENT_COLUMNS),
  ];
  for (const header of requiredFoodHeaders) {
    if (!parsedFood.headers.includes(header)) {
      throw new Error(`Food source is missing required column "${header}".`);
    }
  }
  if (parsedGuidelines) {
    for (const header of [
      "Nutrient",
      "Recommended Daily Range (Lower Limit)",
      "Recommended Daily Range (Upper Limit)",
      "Remarks (if any)",
      "Source",
    ]) {
      if (!parsedGuidelines.headers.includes(header)) {
        throw new Error(`Guideline source is missing required column "${header}".`);
      }
    }
  }

  const foodSnapshot = {
    id: `food-${foodSha256.slice(0, 12)}`,
    fileName: path.basename(foodFileName),
    sha256: foodSha256,
    rowCount: parsedFood.rows.length,
  };
  const guidelineSnapshot = parsedGuidelines
    ? {
        id: `guidelines-${guidelineSha256.slice(0, 12)}`,
        fileName: path.basename(guidelineFileName),
        sha256: guidelineSha256,
        rowCount: parsedGuidelines.rows.length,
      }
    : structuredClone(/** @type {NonNullable<typeof preservedGuidelines>} */ (preservedGuidelines).snapshot);

  const profiles = PRIMARY_PROFILE_MAPPINGS.map((mapping) =>
    mapping.foodName
      ? buildReleasedProfile({
          mapping,
          profileId: mapping.dishId,
          parsedFood,
          foodSnapshot,
        })
      : buildUnavailableProfile(mapping),
  );
  const primaryByDishId = new Map(profiles.map((profile) => [profile.dishId, profile]));

  const variantFamilies = VARIANT_FAMILY_MAPPINGS.map((family) => {
    const primary = primaryByDishId.get(family.dishId);
    if (!primary) throw new Error(`Variant family has no primary profile: ${family.dishId}.`);
    const variants = family.variants.map((mapping) => {
      const isDefault = mapping.id === family.defaultVariantId;
      let profile;
      if (isDefault) {
        const primarySourceName = primary.provenance?.sourceFoodName;
        if (primarySourceName !== mapping.foodName) {
          throw new Error(
            `Default variant ${mapping.id} uses ${mapping.foodName}, but the primary profile uses ${primarySourceName}.`,
          );
        }
        primary.variantId = mapping.id;
        profile = primary;
      } else {
        profile = buildReleasedProfile({
          mapping: {
            ...mapping,
            dishId: family.dishId,
            nutritionClass: primary.nutritionClass,
          },
          profileId: `${family.dishId}:${mapping.id}`,
          variantId: mapping.id,
          parsedFood,
          foodSnapshot,
        });
        profiles.push(profile);
      }

      return {
        id: mapping.id,
        name: mapping.name,
        profileId: profile.id,
        unlockRank: mapping.unlockRank,
        visualKey: mapping.visualKey,
      };
    });
    return {
      dishId: family.dishId,
      defaultVariantId: family.defaultVariantId,
      variants,
    };
  });

  addIntentFits(profiles);
  addHealthRatings(profiles);

  return {
    schemaVersion: 2,
    dataVersion: `sg-${foodSha256.slice(0, 12)}-${guidelineSha256.slice(0, 12)}-r${NUTRITION_REVIEW_REVISION}`,
    sourceSnapshots: [foodSnapshot, guidelineSnapshot],
    profiles,
    variantFamilies,
    intents: NUTRITION_INTENTS,
    guidelines: parsedGuidelines
      ? buildGuidelines(parsedGuidelines)
      : structuredClone(/** @type {NonNullable<typeof preservedGuidelines>} */ (preservedGuidelines).guidelines),
    disclosure: NUTRITION_DISCLOSURE,
  };
};

/**
 * @param {readonly string[]} argumentsList - The CLI arguments after the script path.
 * @returns {ImporterOptions}
 * @throws {Error} On an unknown argument, or when `--food` or exactly one guideline
 *   source is missing.
 */
const parseArguments = (argumentsList) => {
  /** @type {Partial<ImporterOptions> & Pick<ImporterOptions, "acceptSourceUpdate" | "outputPath">} */
  const options = { acceptSourceUpdate: false, outputPath: DEFAULT_OUTPUT_PATH };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--food") options.foodPath = argumentsList[++index];
    else if (argument === "--guidelines") options.guidelinePath = argumentsList[++index];
    else if (argument === "--preserve-guidelines-from") {
      options.preservedGuidelinesPath = argumentsList[++index];
    }
    else if (argument === "--output") options.outputPath = path.resolve(argumentsList[++index]);
    else if (argument === "--accept-source-update") options.acceptSourceUpdate = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (
    !options.foodPath ||
    (options.guidelinePath === undefined) ===
      (options.preservedGuidelinesPath === undefined)
  ) {
    throw new Error(
      "Usage: node tools/nutrition/importer.mjs --food <food.csv> (--guidelines <guidelines.csv> | --preserve-guidelines-from <generated.json>) [--output <json>] [--accept-source-update]",
    );
  }
  return /** @type {ImporterOptions} */ (options);
};

/**
 * Runs the importer CLI: reads the sources, builds the content and writes it as JSON.
 *
 * @param {readonly string[]} argumentsList - The CLI arguments after the script path.
 * @returns {Promise<ReturnType<typeof buildNutritionContent>>} The written content.
 */
export const runImporter = async (argumentsList) => {
  const options = parseArguments(argumentsList);
  const [foodText, guidelineSourceText] = await Promise.all([
    readFile(options.foodPath, "utf8"),
    readFile(
      /** @type {string} */ (options.guidelinePath ?? options.preservedGuidelinesPath),
      "utf8",
    ),
  ]);
  const guidelineText = options.guidelinePath ? guidelineSourceText : undefined;
  const preservedGuidelines = options.preservedGuidelinesPath
    ? extractPreservedGuidelines(JSON.parse(guidelineSourceText))
    : undefined;
  const content = buildNutritionContent({
    foodText,
    guidelineText,
    preservedGuidelines,
    foodFileName: options.foodPath,
    guidelineFileName: options.guidelinePath,
    expectedFoodSha256: EXPECTED_FOOD_FILE_SHA256,
    expectedGuidelineSha256: EXPECTED_GUIDELINE_FILE_SHA256,
    acceptSourceUpdate: options.acceptSourceUpdate,
  });
  await writeFile(options.outputPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return content;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runImporter(process.argv.slice(2))
    .then((content) => {
      process.stdout.write(
        `Generated ${content.profiles.length} nutrition profiles at ${DEFAULT_OUTPUT_PATH}.\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
