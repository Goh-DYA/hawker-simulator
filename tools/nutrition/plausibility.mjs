/**
 * Source-row plausibility rules for the nutrition importer.
 *
 * Each rule withholds a nutrient value that an objective, documented test marks implausible.
 * A withheld value is published as unavailable with the `implausible-source` reason, and
 * the ratings use the rule's stand-in amount when it has one, or otherwise the missing-value
 * rules in `ratings.mjs`. No rule invents a number: a stand-in is always another source
 * row's value. The rules are the paired-component floor and fibre ceiling, the drink-family
 * base check, and the extreme-outlier fence.
 */
// @ts-check

/**
 * @import { NutritionValue } from "../../src/content/types"
 */

/**
 * A source row read at a multiplier: its nutrients and the edible part of its serving.
 *
 * @typedef {object} SourceRowReading
 * @property {Readonly<Record<string, NutritionValue>>} nutrients
 * @property {number} edibleAmount - The serving amount times the row's edible share.
 */

/**
 * One withheld value: the metric, the rule's finding, and the rating stand-in when the rule
 * has one.
 *
 * @typedef {object} ImplausibleValue
 * @property {string} metric
 * @property {string} reason
 * @property {number} [standIn]
 */

/**
 * Per-subgroup far-out fences, per 100 g edible, keyed by `Food Subgroup` and then metric.
 *
 * @typedef {Map<string, Partial<Record<string, number>>>} SubgroupFences
 */

/**
 * Paired components: source rows analysed from the same dish ("<dish> gravy", "(curry
 * only)", "(rice only)"). A whole dish cannot hold less of a nutrient than one of its own
 * components, nor much more fibre than the component plus a remainder that is no fibre
 * source.
 */
export const PAIRED_COMPONENTS = {
  Laksa: "Laksa gravy",
  "Lor mee": "Lor mee gravy",
  "Mee rebus": "Mee rebus gravy",
  "Mee siam": "Mee siam gravy",
  "Plain prata (2 pc, with curry)": "Plain prata (2 pc, with curry) (curry only)",
  "Steamed chicken rice": "Steamed chicken rice (rice only)",
  "Braised duck rice set (with egg and tau kwa)": "Braised duck rice set (rice only)",
  "Kway chap": "Kway chap (noodle slices and soup together)",
};

/** A floor shortfall must exceed both an absolute amount (1 g, or 50 mg of sodium) and a share of the component. */
export const FLOOR_TOLERANCE = { grams: 1, sodiumMg: 50, share: 0.1 };

/** The non-component remainder of a dish may average at most the EU "source of fibre" density, in g per 100 g. */
export const REMAINDER_MAX_FIBRE_G_PER_100G = 3;

/** Drink families with an unsweetened, milk-free base row whose non-sugar carbohydrate every member shares. */
export const DRINK_FAMILY_BASES = [
  { prefix: /^Kopi\b/, base: "Kopi O kosong" },
  { prefix: /^Teh\b/i, base: "Teh O kosong" },
];

/** Allowed gap, in grams per 250 ml cup, between a member's and its base's non-sugar carbohydrate. */
export const DRINK_NON_SUGAR_CARB_TOLERANCE_G = 4;

/** A value is an extreme outlier above this multiple of its source subgroup's far-out fence. */
export const EXTREME_OUTLIER_FENCE_MULTIPLE = 2;

/** The far-out fence is the third quartile plus this many interquartile ranges. */
const FAR_OUT_IQR = 3;

/** A subgroup needs at least this many values of a metric before it is fenced. */
const MIN_SUBGROUP_ROWS = 15;

/** The metrics the outlier fence checks. */
const OUTLIER_METRICS = [
  "energyKcal",
  "proteinG",
  "totalFatG",
  "saturatedFatG",
  "carbohydrateG",
  "totalSugarG",
  "dietaryFibreG",
  "sodiumMg",
  "calciumMg",
  "ironMg",
];

/** The metrics the paired-component floor checks. */
const FLOOR_METRICS = [
  "energyKcal",
  "proteinG",
  "totalFatG",
  "saturatedFatG",
  "carbohydrateG",
  "totalSugarG",
  "sodiumMg",
];

/**
 * Reads a nutrient amount, counting `trace` as zero.
 *
 * @param {NutritionValue | undefined} nutrient - The nutrient value.
 * @returns {number | undefined} The amount, or undefined when unavailable.
 */
const read_known = (nutrient) => {
  if (nutrient?.status === "known") return nutrient.value;
  if (nutrient?.status === "trace") return 0;
  return undefined;
};

/**
 * Returns the first, second and third quartiles, interpolating linearly between sorted
 * values at index `(n - 1) * p`.
 *
 * @param {readonly number[]} values - At least one value.
 * @returns {[number, number, number]} The quartiles.
 */
const compute_quartiles = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  /** @param {number} share */
  const at = (share) => {
    const position = (sorted.length - 1) * share;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, sorted.length - 1);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  };
  return [at(0.25), at(0.5), at(0.75)];
};

/**
 * Parses a source `Edible Portion` cell such as "93.35%" into a share.
 *
 * @param {string | undefined} raw - The cell.
 * @returns {number} The edible share, or 1 when the cell is missing, unparseable or outside (0, 1].
 */
export const parse_edible_share = (raw) => {
  const match = String(raw ?? "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*%$/);
  const share = match ? Number(match[1]) / 100 : 1;
  return share > 0 && share <= 1 ? share : 1;
};

/**
 * Builds the far-out fence of every outlier metric in every source subgroup, per 100 g
 * edible, from all source rows read at a multiplier of one. Rows without a subgroup are
 * skipped.
 *
 * @param {readonly { values: Readonly<Record<string, string>> }[]} rows - The source rows.
 * @param {(values: Readonly<Record<string, string>>) => SourceRowReading | undefined} read - Reads one row.
 * @returns {SubgroupFences} The fences.
 */
export const build_subgroup_fences = (rows, read) => {
  /** @type {Map<string, Record<string, number[]>>} */
  const groups = new Map();
  for (const { values } of rows) {
    const subgroup = values["Food Subgroup"]?.trim();
    if (!subgroup || subgroup === "-") continue;
    const reading = read(values);
    if (!reading || reading.edibleAmount <= 0) continue;
    let densities = groups.get(subgroup);
    if (!densities) {
      densities = Object.fromEntries(OUTLIER_METRICS.map((metric) => [metric, []]));
      groups.set(subgroup, densities);
    }
    for (const metric of OUTLIER_METRICS) {
      const amount = read_known(reading.nutrients[metric]);
      if (amount !== undefined) densities[metric].push((amount * 100) / reading.edibleAmount);
    }
  }
  /** @type {SubgroupFences} */
  const fences = new Map();
  for (const [subgroup, densities] of groups) {
    /** @type {Partial<Record<string, number>>} */
    const fenced = {};
    for (const [metric, values] of Object.entries(densities)) {
      if (values.length < MIN_SUBGROUP_ROWS) continue;
      const [first, , third] = compute_quartiles(values);
      fenced[metric] = third + FAR_OUT_IQR * (third - first);
    }
    fences.set(subgroup, fenced);
  }
  return fences;
};

/**
 * Finds the values to withhold from one mapped source row (a whole profile, or one part of
 * a composite), each with its finding and, when the rule has one, its rating stand-in.
 *
 * @param {object} options
 * @param {string} options.food_name - The row's exact `Food Name`.
 * @param {Readonly<Record<string, string>>} options.values - The row's raw cells.
 * @param {Readonly<Record<string, NutritionValue>>} options.nutrients - The row's nutrients at its multiplier.
 * @param {number} options.edible_amount - The edible part of the row's serving at its multiplier.
 * @param {number} options.multiplier - The row's multiplier.
 * @param {(food_name: string, multiplier: number) => SourceRowReading} options.component_of - Reads another row.
 * @param {SubgroupFences} options.fences - The subgroup fences.
 * @returns {ImplausibleValue[]} The withheld values, in rule order.
 */
export const find_implausible_values = ({
  food_name,
  values,
  nutrients,
  edible_amount,
  multiplier,
  component_of,
  fences,
}) => {
  /** @type {ImplausibleValue[]} */
  const withheld = [];

  const component_name =
    PAIRED_COMPONENTS[/** @type {keyof typeof PAIRED_COMPONENTS} */ (food_name)];
  if (component_name) {
    const component = component_of(component_name, multiplier);
    for (const metric of FLOOR_METRICS) {
      const dish_amount = read_known(nutrients[metric]);
      const floor = read_known(component.nutrients[metric]);
      if (dish_amount === undefined || floor === undefined) continue;
      const absolute = metric === "sodiumMg" ? FLOOR_TOLERANCE.sodiumMg : FLOOR_TOLERANCE.grams;
      if (floor - dish_amount > Math.max(absolute, FLOOR_TOLERANCE.share * floor)) {
        withheld.push({
          metric,
          standIn: floor,
          reason: `${metric} ${dish_amount} is below the ${floor} in its own component row "${component_name}".`,
        });
      }
    }
    const fibre = read_known(nutrients.dietaryFibreG);
    const component_fibre = read_known(component.nutrients.dietaryFibreG);
    if (fibre !== undefined && component_fibre !== undefined) {
      const ceiling =
        component_fibre +
        ((edible_amount - component.edibleAmount) * REMAINDER_MAX_FIBRE_G_PER_100G) / 100;
      if (fibre > ceiling) {
        withheld.push({
          metric: "dietaryFibreG",
          reason: `dietaryFibreG ${fibre} exceeds ${ceiling.toFixed(1)}: component "${component_name}" plus ${REMAINDER_MAX_FIBRE_G_PER_100G} g/100 g for the rest of the dish.`,
        });
      }
    }
  }

  const family = DRINK_FAMILY_BASES.find(
    (candidate) => candidate.prefix.test(food_name) && candidate.base !== food_name,
  );
  if (family) {
    const base = component_of(
      family.base,
      edible_amount / component_of(family.base, 1).edibleAmount,
    );
    const carbohydrate = read_known(nutrients.carbohydrateG);
    const sugar = read_known(nutrients.totalSugarG);
    const base_carbohydrate = read_known(base.nutrients.carbohydrateG);
    const base_sugar = read_known(base.nutrients.totalSugarG);
    if (
      carbohydrate !== undefined &&
      sugar !== undefined &&
      base_carbohydrate !== undefined &&
      base_sugar !== undefined
    ) {
      const base_non_sugar = base_carbohydrate - base_sugar;
      const gap = carbohydrate - sugar - base_non_sugar;
      const tolerance = (DRINK_NON_SUGAR_CARB_TOLERANCE_G * edible_amount) / 250;
      if (Math.abs(gap) > tolerance) {
        withheld.push({
          metric: "totalSugarG",
          standIn: Math.max(0, carbohydrate - base_non_sugar),
          reason: `Non-sugar carbohydrate ${(carbohydrate - sugar).toFixed(1)} g differs from the ${base_non_sugar.toFixed(1)} g of its unsweetened base "${family.base}" by more than ${tolerance.toFixed(1)} g.`,
        });
      }
    }
  }

  const subgroup_fences = fences.get(values["Food Subgroup"]?.trim() ?? "") ?? {};
  for (const [metric, fence] of Object.entries(subgroup_fences)) {
    const amount = read_known(nutrients[metric]);
    if (fence === undefined || amount === undefined || edible_amount <= 0) continue;
    if (withheld.some((value) => value.metric === metric)) continue;
    const density = (amount * 100) / edible_amount;
    if (fence > 0 && density > EXTREME_OUTLIER_FENCE_MULTIPLE * fence) {
      withheld.push({
        metric,
        reason: `${metric} ${density.toFixed(1)} per 100 g is over ${EXTREME_OUTLIER_FENCE_MULTIPLE}x its source subgroup's far-out fence (${fence.toFixed(1)}).`,
      });
    }
  }
  return withheld;
};
