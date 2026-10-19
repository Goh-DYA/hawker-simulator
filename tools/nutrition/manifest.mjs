/**
 * The reviewed nutrition import manifest: source file hashes, the dish and variant
 * mappings to source food rows, the customer nutrition intents and the disclosure text.
 *
 * Changing a mapping or a hash here changes `src/content/nutrition.generated.json` the
 * next time the importer runs, so every entry carries its review note.
 */
// @ts-check

/**
 * @import {
 *   NutritionClass,
 *   NutritionIntentDefinition,
 *   NutritionProvenance,
 *   NutritionVariant,
 * } from "../../src/content/types"
 */

/** Reviewed SHA-256 of the Singapore food nutrition source CSV. */
export const EXPECTED_FOOD_FILE_SHA256 =
  "1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e";

/** Reviewed SHA-256 of the adult daily nutrition guideline source CSV. */
export const EXPECTED_GUIDELINE_FILE_SHA256 =
  "c87987b4281c8557f75b61fefa96d95d13e9ff60c2c41e38fe4a428219064ab4";

/**
 * The review revision of the mappings and the rating model. It is part of the generated
 * `dataVersion`, so raising it when either changes resets saved dish-variant choices to
 * the reviewed defaults, even though the source files are unchanged. Revision 2 adopted
 * the guideline-anchored ratings and realistic hawker servings.
 */
export const NUTRITION_REVIEW_REVISION = 3;

/**
 * The number of adult daily guideline rows the reviewed guideline file holds. It matches
 * `LAUNCH_ROSTER.nutritionGuidelines` in `src/content/roster.ts`.
 */
export const NUTRITION_GUIDELINE_COUNT = 11;

/**
 * Maps a dish to its reviewed source food row.
 *
 * @param {string} dishId - The dish content id.
 * @param {string} foodName - The exact, case-sensitive source `Food Name`.
 * @param {NutritionClass} nutritionClass - Whether the dish is rated as a meal or a drink.
 * @param {string} reviewNote - Why the source row represents the dish.
 * @param {NutritionProvenance["mappingKind"]} [mappingKind] - How the name was matched.
 * @param {number} [multiplier] - Scale from the source serving to the game serving.
 * @param {string} [servingLabel] - Serving label to use instead of the source's.
 */
const released = (
  dishId,
  foodName,
  nutritionClass,
  reviewNote,
  mappingKind = "exact",
  multiplier = 1,
  servingLabel,
) => ({
  dishId,
  foodName,
  nutritionClass,
  reviewNote,
  mappingKind,
  multiplier,
  ...(servingLabel === undefined ? {} : { servingLabel }),
});

/**
 * Dishes rated as a snack rather than a main meal: desserts eaten in addition to the day's
 * meals, whose energy and sugar are held to HPB's 200 kcal snack share instead of a third
 * of the day (see `SNACK_SHARE_OF_MEAL` in ratings.mjs).
 */
export const SNACK_RATED_DISH_IDS = new Set([
  "dish.ice-kacang",
  "dish.chendol",
  "dish.tau-huay",
  "dish.pulut-hitam",
]);

/** The primary profile mapping of every dish, in generated profile order. */
export const PRIMARY_PROFILE_MAPPINGS = [
  released(
    "dish.poached-chicken-rice",
    "Steamed chicken rice",
    "meal",
    "The reviewed steamed-chicken serving is the closest source match for the game's poached chicken rice.",
    "curated-synonym",
  ),
  released(
    "dish.roast-chicken-rice",
    "Roasted chicken rice",
    "meal",
    "The source uses roasted rather than roast in the food name.",
    "curated-synonym",
  ),
  {
    ...released(
      "dish.soya-tofu-rice",
      "Steamed chicken rice (rice only)",
      "meal",
      "Composite: the Derived 'Vegetarian chicken rice' row reports 11 g water in 290 g and 261 mg sodium, which back-calculates to 200 g plain rice plus about 70 g mock chicken, not the flavoured rice its description names; the Lab flavoured chicken-rice rice (220 g) plus 70 g of the Lab 'Mock chicken' keeps the source plate's 290 g.",
      "curated-synonym",
      1,
      "1 plate (290 g)",
    ),
    components: [
      { foodName: "Steamed chicken rice (rice only)", multiplier: 1 },
      { foodName: "Mock chicken", multiplier: 0.7 },
    ],
  },
  released(
    "dish.chicken-congee",
    "Chicken porridge",
    "meal",
    "Singapore source terminology uses porridge for the game's chicken congee.",
    "curated-synonym",
  ),
  released(
    "dish.nasi-lemak",
    "Nasi lemak (chicken wing set)",
    "meal",
    "The chicken-wing set matches the default plated game recipe.",
    "curated-synonym",
  ),
  released("dish.mee-rebus", "Mee rebus", "meal", "Exact named dish match."),
  released("dish.soto-ayam", "Soto ayam", "meal", "Exact named dish match."),
  released(
    "dish.lontong-sayur",
    "Sayur lodeh with lontong",
    "meal",
    "The game name and recipe were refined to the source's complete sayur lodeh with lontong bowl.",
  ),
  released("dish.kopi", "Kopi", "drink", "Exact hot kopi serving match."),
  released(
    "dish.sugarcane-juice",
    "Fresh sugarcane juice",
    "drink",
    "The source adds the preparation descriptor fresh.",
    "curated-synonym",
  ),
  released("dish.ice-kacang", "Ice kacang", "meal", "Exact named dessert match."),
  released(
    "dish.char-kway-teow",
    "Char kway teow",
    "meal",
    "Exact named dish match.",
  ),
  released(
    "dish.hokkien-prawn-mee",
    "Hokkien mee",
    "meal",
    "Singapore Hokkien mee is the source's complete plate corresponding to the game's refined noodle dish.",
  ),
  released(
    "dish.fried-carrot-cake",
    "Fried carrot cake (white)",
    "meal",
    "White carrot cake is the game's default recipe; black is available as a reviewed variant.",
    "curated-synonym",
  ),
  released(
    "dish.oyster-omelette",
    "Oyster omelette",
    "meal",
    "The source reports a 100 g serving-spoon scoop; values are scaled to the game's hawker plate.",
    "scaled-exact",
    2,
    "1 plate (200 g)",
  ),
  {
    ...released(
      "dish.roti-prata",
      "Plain prata",
      "meal",
      "Composite: two plain prata scaled to the dough of the Lab egg prata (39.87 g carbohydrate each, x0.5433 of the 141 g Lab plain prata) plus the Lab curry served with the source's two-piece set.",
      "scaled-exact",
      1,
      "2 pieces with curry (406 g)",
    ),
    components: [
      { foodName: "Plain prata", multiplier: (2 * 39.87) / 73.39 },
      { foodName: "Plain prata (2 pc, with curry) (curry only)", multiplier: 1 },
    ],
  },
  released(
    "dish.mee-goreng-mamak",
    "Mee goreng",
    "meal",
    "The source row is the reviewed local mee goreng preparation.",
    "curated-synonym",
  ),
  released(
    "dish.chicken-murtabak",
    "Murtabak (chicken)",
    "meal",
    "The source expresses the protein as a parenthetical variant.",
    "curated-synonym",
  ),
  released(
    "dish.nasi-briyani",
    "Nasi briyani (chicken)",
    "meal",
    "Chicken is the game's default briyani protein.",
    "curated-synonym",
  ),
  released(
    "dish.masala-thosai",
    "Masala thosai",
    "meal",
    "Exact named dish match.",
  ),
  released(
    "dish.idli-sambar",
    "Idli",
    "meal",
    "The reviewed source serving description includes the accompaniments represented by the game; the source labels the whole set as one piece.",
    "curated-synonym",
    1,
    "1 set with sambar and chutney (269 g)",
  ),
  released(
    "dish.vadai-set",
    "Vadai",
    "meal",
    "The source reports one vadai; values are scaled to the game's two-piece serving.",
    "scaled-exact",
    2,
    "2 pieces (120 g)",
  ),
  released(
    "dish.lemon-rice",
    "Lemon rice",
    "meal",
    "The game recipe was refined to the source's complete lemon-rice bowl without unreported sides.",
  ),
  {
    ...released(
      "dish.nyonya-laksa",
      "Laksa gravy",
      "meal",
      "Composite: the Lab 'Laksa' bowl (604 g) reports 8.6 g saturated fat, less than half the 20.8 g of the source's own 'Laksa gravy' row (361 g) analysed from laksa, so the bowl is rebuilt from that gravy, the Derived thick beehoon bowl and one Lab fishcake (611 g).",
      "curated-synonym",
      1,
      "1 bowl (611 g)",
    ),
    components: [
      { foodName: "Laksa gravy", multiplier: 1 },
      { foodName: "Thick beehoon", multiplier: 1 },
      { foodName: "Fishcake", multiplier: 1 },
    ],
  },
  released(
    "dish.ayam-buah-keluak",
    "Ayam pongteh",
    "meal",
    "The source has no buah keluak row, so the stable dish ID serves the source-backed Nonya ayam pongteh; the 100 g scoop is scaled to a side plate.",
    "scaled-exact",
    2,
    "1 plate (200 g)",
  ),
  released(
    "dish.chap-chye",
    "Nonya chap chye",
    "meal",
    "The source reports a 100 g scoop; values are scaled to the game's side plate without unreported rice.",
    "scaled-exact",
    2,
    "1 plate (200 g)",
  ),
  released(
    "dish.babi-pongteh",
    "Babi pongteh",
    "meal",
    "The source reports a 100 g scoop; values are scaled to the game's side plate without unreported rice.",
    "scaled-exact",
    2,
    "1 plate (200 g)",
  ),
  released(
    "dish.sambal-stingray",
    "Sambal stingray",
    "meal",
    "Exact named dish match.",
  ),
  released(
    "dish.sliced-fish-soup",
    "Sliced fish beehoon soup (no milk)",
    "meal",
    "The no-milk beehoon preparation matches the default game bowl.",
    "curated-synonym",
  ),
  released(
    "dish.black-pepper-crab",
    "Black pepper crab",
    "meal",
    "The source reports one pincer; values are scaled to the source's alternative quarter-crab serving.",
    "scaled-exact",
    384 / 177,
    "1 quarter crab (384 g)",
  ),
  released(
    "dish.bak-chor-mee",
    "Bak chor mee (dry)",
    "meal",
    "Dry is the game's default noodle preparation.",
    "curated-synonym",
  ),
  released(
    "dish.fishball-mee-pok",
    "Fishball noodles (dry)",
    "meal",
    "The reviewed dry fishball-noodle serving matches the game's mee pok presentation.",
    "curated-synonym",
  ),
  released("dish.lor-mee", "Lor mee", "meal", "Exact named dish match."),
  released(
    "dish.teochew-fish-dumpling-soup",
    "Fish ball tunghoon (soup)",
    "meal",
    "The fishball soup row without noodles reports 44 kcal and trace carbohydrate for seven fishballs, so the stable dish ID serves the source's complete fishball tang hoon bowl.",
    "curated-synonym",
  ),
  released("dish.chendol", "Chendol", "meal", "Exact named dessert match."),
  released(
    "dish.tau-huay",
    "Beancurd with toppings",
    "meal",
    "The game dessert was refined to the source's complete soybean-pudding bowl with assorted toppings.",
  ),
  released(
    "dish.teh-tarik",
    "Teh Tarik",
    "drink",
    "Exact named drink match with source capitalization retained in provenance; the 150 ml small cup is scaled to the 250 ml cup of the other teh and kopi servings.",
    "scaled-exact",
    250 / 150,
    "1 regular cup (250 ml)",
  ),
  released(
    "dish.pulut-hitam",
    "Pulut hitam",
    "meal",
    "Exact named dessert match.",
  ),
  released(
    "dish.chicken-satay-set",
    "Chicken satay with sauce",
    "meal",
    "The source reports one skewer with sauce; values are scaled to the game's ten-skewer serving.",
    "scaled-exact",
    10,
    "10 sticks (270 g)",
  ),
  released(
    "dish.bbq-chicken-wings",
    "Barbecued chicken wing",
    "meal",
    "The source reports one wing; values are scaled to the game's three-wing serving.",
    "scaled-exact",
    3,
    "3 pieces (114 g)",
  ),
  released(
    "dish.beef-satay-set",
    "Beef satay with sauce",
    "meal",
    "The source reports one skewer with sauce; values are scaled to the game's ten-skewer serving.",
    "scaled-exact",
    10,
    "10 sticks (210 g)",
  ),
  released(
    "dish.sambal-grilled-squid",
    "Sotong panggang",
    "meal",
    "Sotong panggang is the source's grilled squid with spices; the 100 g scoop is scaled to the game's grill plate.",
    "scaled-exact",
    2,
    "1 plate (200 g)",
  ),
  released(
    "dish.har-gow",
    "Prawn dumpling",
    "meal",
    "The source reports one prawn dumpling; values are scaled to the game's four-piece bowl with vegetables in light soup.",
    "scaled-exact",
    4,
    "4 pieces (196 g)",
  ),
  released(
    "dish.siew-mai",
    "Siew mai",
    "meal",
    "The source reports one piece; values are scaled to the game's four-piece basket.",
    "scaled-exact",
    4,
    "4 pieces (120 g)",
  ),
  released(
    "dish.char-siew-bao",
    "Char siew pau",
    "meal",
    "The source reports one pau; values are scaled to the game's three-piece basket.",
    "scaled-exact",
    3,
    "3 pieces (168 g)",
  ),
  released(
    "dish.lotus-leaf-rice",
    "Glutinous rice in lotus leaf",
    "meal",
    "The source uses a descriptive food name for the game's complete lotus-leaf rice parcel and labels the whole parcel as one scoop.",
    "curated-synonym",
    1,
    "1 parcel (317 g)",
  ),
  released(
    "dish.yong-tau-foo",
    "Yong tau foo (clear soup, 7 pieces, mixed)",
    "meal",
    "The clear-soup bowl with seven mixed pieces is the game's default yong tau foo serving; the boiled row reports 82 kcal and 5.7 g protein for seven stuffed pieces and is not used.",
  ),
  released(
    "dish.ban-mian",
    "Ban mian (soup)",
    "meal",
    "The soup preparation is the game's default ban mian bowl.",
  ),
  released(
    "dish.thunder-tea-rice",
    "Thunder tea rice",
    "meal",
    "Exact named complete dish match.",
  ),
  released(
    "dish.popiah",
    "Popiah",
    "meal",
    "Exact named complete snack match.",
    "exact",
    1,
    "1 roll (191 g)",
  ),
  released(
    "dish.bak-kut-teh",
    "Bak kut teh (soup)",
    "meal",
    "The soup preparation is the game's default bak kut teh serving.",
  ),
  released(
    "dish.duck-rice",
    "Braised duck rice set (with egg and tau kwa)",
    "meal",
    "The complete braised duck set with egg and tau kwa is the game's default duck-rice plate.",
  ),
  released("dish.kway-chap", "Kway chap", "meal", "Exact named complete dish match."),
  released(
    "dish.claypot-chicken-rice",
    "Claypot chicken rice",
    "meal",
    "Exact named complete dish match.",
  ),
  released(
    "dish.char-siew-rice",
    "Char siew rice",
    "meal",
    "Exact named complete dish match.",
  ),
  released(
    "dish.nasi-padang",
    "Nasi padang (beef set)",
    "meal",
    "The beef set is the game's default nasi padang plate.",
    "curated-synonym",
  ),
  released(
    "dish.kaya-toast",
    "Kaya and butter toast",
    "meal",
    "Exact named kopitiam toast match.",
  ),
  released(
    "dish.barley-drink",
    "Barley drink",
    "drink",
    "Exact named drink match.",
  ),
  released(
    "dish.beef-hor-fun",
    "Beef hor fun",
    "meal",
    "Exact named complete dish match.",
  ),
  released(
    "dish.chwee-kueh",
    "Chwee kueh",
    "meal",
    "The source reports one piece; values are scaled to the game's five-piece serving.",
    "scaled-exact",
    5,
    "5 pieces (175 g)",
  ),
  released(
    "dish.roti-john",
    "Roti john",
    "meal",
    "Exact named complete dish match.",
    "exact",
    1,
    "1 roll (253 g)",
  ),
  released(
    "dish.soya-bean-milk",
    "Soy milk (no topping)",
    "drink",
    "The source's plain soybean milk cup is the game's default soya bean milk.",
    "curated-synonym",
  ),
  released(
    "dish.economic-rice",
    "Economic rice (1 vegetable, 1 meat)",
    "meal",
    "The one-vegetable, one-meat plate is the game's default economic rice order.",
    "curated-synonym",
  ),
  released(
    "dish.wanton-mee",
    "Wanton noodles (dry)",
    "meal",
    "Dry is the game's default wanton mee preparation.",
    "curated-synonym",
  ),
  released(
    "dish.mee-siam",
    "Mee siam",
    "meal",
    "Exact named complete dish match.",
  ),
  released(
    "dish.kueh-pie-tee",
    "Kueh pie tee",
    "meal",
    "The source reports one cup; values are scaled to the game's five-piece serving.",
    "scaled-exact",
    5,
    "5 pieces (185 g)",
  ),
  released(
    "dish.prawn-noodle-soup",
    "Prawn noodles (soup)",
    "meal",
    "The soup preparation is the game's default prawn noodle bowl.",
    "curated-synonym",
  ),
];

/**
 * Maps one recipe variant of a dish to its reviewed source food row.
 *
 * @param {string} id - The variant id.
 * @param {string} name - The variant's display name.
 * @param {string} foodName - The exact, case-sensitive source `Food Name`.
 * @param {NutritionVariant["unlockRank"]} unlockRank - The stall rank that unlocks it.
 * @param {string} visualKey - The variant's portion visual.
 * @param {string} reviewNote - Why the source row represents the variant.
 * @param {NutritionProvenance["mappingKind"]} [mappingKind] - How the name was matched.
 * @param {number} [multiplier] - Scale from the source serving to the game serving.
 * @param {string} [servingLabel] - Serving label to use instead of the source's.
 */
const variant = (
  id,
  name,
  foodName,
  unlockRank,
  visualKey,
  reviewNote,
  mappingKind = "exact",
  multiplier = 1,
  servingLabel = undefined,
) => ({
  id,
  name,
  foodName,
  unlockRank,
  visualKey,
  reviewNote,
  mappingKind,
  multiplier,
  ...(servingLabel === undefined ? {} : { servingLabel }),
});

/** The recipe variant families, each listing its default variant first. */
export const VARIANT_FAMILY_MAPPINGS = [
  {
    dishId: "dish.kopi",
    defaultVariantId: "kopi-default",
    variants: [
      variant("kopi-default", "Kopi", "Kopi", 1, "kopi-milk-sugar-standard", "Default hot kopi serving."),
      variant("kopi-siu-dai", "Kopi siu dai", "Kopi siu dai", 2, "kopi-milk-one-sugar", "Reduced-sugar kopi variant."),
      variant("kopi-c", "Kopi C", "Kopi C", 4, "kopi-evaporated-milk-two-sugar", "Kopi with evaporated milk."),
      variant("kopi-c-kosong", "Kopi C kosong", "Kopi C kosong", 7, "kopi-evaporated-milk-no-sugar", "Kopi C without added sugar."),
      variant("kopi-o", "Kopi O", "Kopi O", 7, "kopi-black-two-sugar", "Black kopi with sugar."),
      variant("kopi-o-kosong", "Kopi O kosong", "Kopi O kosong", 7, "kopi-black-no-sugar", "Black kopi without added sugar."),
    ],
  },
  {
    dishId: "dish.teh-tarik",
    defaultVariantId: "teh-tarik",
    variants: [
      variant("teh-tarik", "Teh Tarik", "Teh Tarik", 1, "teh-pulled-foam", "Default pulled tea serving."),
      variant("teh", "Teh", "Teh", 2, "teh-milk-sugar-standard", "Standard hot milk tea."),
      variant("teh-siu-dai", "Teh siu dai", "Teh siu dai", 4, "teh-milk-one-sugar", "Reduced-sugar tea variant."),
      variant("teh-c", "Teh C", "Teh C", 7, "teh-evaporated-milk-two-sugar", "Tea with evaporated milk."),
      variant("teh-c-kosong", "Teh C kosong", "Teh C kosong", 7, "teh-evaporated-milk-no-sugar", "Teh C without added sugar."),
      variant("teh-o", "Teh O", "Teh O", 7, "teh-black-two-sugar", "Black tea with sugar."),
      variant("teh-o-kosong", "Teh O kosong", "Teh O kosong", 7, "teh-black-no-sugar", "Black tea without added sugar."),
    ],
  },
  {
    dishId: "dish.nasi-lemak",
    defaultVariantId: "nasi-lemak-chicken-wing",
    variants: [
      variant("nasi-lemak-chicken-wing", "Chicken wing set", "Nasi lemak (chicken wing set)", 1, "nasi-wing", "Default chicken-wing set."),
      variant("nasi-lemak-chicken-cutlet", "Chicken cutlet set", "Nasi lemak (chicken cutlet set)", 2, "nasi-cutlet", "Chicken-cutlet set."),
      variant("nasi-lemak-wing-cutlet", "Wing and cutlet set", "Nasi lemak (chicken wing and chicken cutlet set)", 4, "nasi-wing-cutlet", "Larger set with both chicken preparations."),
      variant("nasi-lemak-egg-ikan-bilis-peanut", "Egg, ikan bilis and peanut set", "Nasi lemak (egg, ikan bilis, peanut set)", 7, "nasi-egg-ikan-bilis-peanut", "Set centred on egg, ikan bilis and peanuts."),
      variant("nasi-lemak-fish", "Fish set", "Nasi lemak (fish set)", 7, "nasi-fish", "Fish set."),
      variant("nasi-lemak-rice-only", "Coconut rice only", "Nasi lemak (rice only)", 7, "nasi-rice-only", "Rice-only source serving; presented as a portion-size trade-off, not a complete-meal recommendation."),
    ],
  },
  {
    dishId: "dish.fried-carrot-cake",
    defaultVariantId: "carrot-cake-white",
    variants: [
      variant("carrot-cake-white", "White carrot cake", "Fried carrot cake (white)", 1, "carrot-cake-white-egg", "Default white preparation."),
      variant("carrot-cake-black", "Black carrot cake", "Fried carrot cake (black)", 2, "carrot-cake-black-sauce", "Sweet dark-soy preparation."),
    ],
  },
  {
    dishId: "dish.roti-prata",
    defaultVariantId: "prata-two-plain-curry",
    variants: [
      variant("prata-two-plain-curry", "Two plain prata with curry", "Plain prata", 1, "prata-two-curry", "Default two-piece plate with curry."),
      variant("prata-plain", "Plain prata", "Plain prata", 2, "prata-single-plain", "The 141 g Lab plain prata holds 73.39 g carbohydrate, the dough of almost two egg prata (39.87 g); scaled to one egg-prata-sized piece.", "scaled-exact", 39.87 / 73.39, "1 piece (77 g)"),
      variant("prata-egg", "Egg prata", "Prata (egg)", 4, "prata-egg-centre", "Egg-filled prata."),
      variant("prata-egg-onion", "Egg and onion prata", "Prata (egg, onion)", 7, "prata-egg-onion", "Egg-and-onion prata."),
      variant("prata-egg-onion-cheese", "Egg, onion and cheese prata", "Prata (egg, onion, cheese)", 7, "prata-egg-onion-cheese", "Egg, onion and cheese prata."),
    ],
  },
  {
    dishId: "dish.sliced-fish-soup",
    defaultVariantId: "fish-soup-beehoon-no-milk",
    variants: [
      variant("fish-soup-beehoon-no-milk", "Fish beehoon, no milk", "Sliced fish beehoon soup (no milk)", 1, "fish-beehoon-clear", "Default clear soup with beehoon."),
      variant("fish-soup-beehoon-milk", "Fried fish beehoon with milk", "Fried fish beehoon soup (with milk)", 2, "fish-beehoon-milky", "Milky soup with the default bowl's 250 g of thick beehoon: the Derived row is the Lab milky fried-fish soup plus 1.25 thick beehoon, built the same way as the clear default; the milky sliced-fish Lab soup is not a like-for-like partner of the clear sliced-fish Lab soup (1,405 vs 2,407 mg sodium).", "curated-synonym"),
      variant("fish-soup-sliced-no-milk", "Fried fish soup, no milk", "Fried fish soup (no milk)", 4, "fish-slices-clear", "Clear fried-fish soup without noodles; the sliced-fish row states 84 kcal against about 154 kcal from its own macronutrients, so the reviewed fried-fish bowl stands in.", "curated-synonym"),
      variant("fish-soup-sliced-milk", "Fried fish soup with milk", "Fried fish soup (with milk)", 7, "fish-slices-milky", "Milky fried-fish soup without noodles, the Lab pair of the clear fried-fish variant.", "curated-synonym"),
    ],
  },
  {
    dishId: "dish.bak-chor-mee",
    defaultVariantId: "bak-chor-mee-dry",
    variants: [
      variant("bak-chor-mee-dry", "Bak chor mee, dry", "Bak chor mee (dry)", 1, "bak-chor-dry-sauce", "Default dry preparation."),
      variant("bak-chor-mee-soup", "Bak chor mee soup", "Bak chor mee (soup)", 2, "bak-chor-broth", "Soup preparation."),
    ],
  },
  {
    dishId: "dish.chicken-murtabak",
    defaultVariantId: "murtabak-chicken",
    variants: [
      variant("murtabak-chicken", "Chicken murtabak", "Murtabak (chicken)", 1, "murtabak-chicken", "Default chicken filling."),
      variant("murtabak-chicken-mushroom-cheese", "Chicken, mushroom and cheese murtabak", "Murtabak (chicken, mushroom, cheese)", 2, "murtabak-chicken-mushroom-cheese", "The source's 611 g murtabak is a sharing size; values are halved to one diner's portion.", "scaled-exact", 0.5, "1/2 murtabak (306 g)"),
      variant("murtabak-mutton", "Mutton murtabak", "Murtabak (mutton)", 4, "murtabak-mutton", "Mutton filling."),
      variant("murtabak-vegetable", "Vegetable murtabak", "Murtabak (vegetable)", 7, "murtabak-vegetable", "Vegetable filling; the label does not imply dietary certification."),
    ],
  },
  {
    dishId: "dish.nasi-briyani",
    defaultVariantId: "briyani-chicken",
    variants: [
      variant("briyani-chicken", "Chicken briyani", "Nasi briyani (chicken)", 1, "briyani-chicken", "Default chicken serving."),
      variant("briyani-fish-prawn", "Fish or prawn briyani", "Nasi briyani (fish or prawn)", 2, "briyani-fish-prawn", "Seafood serving; the source groups fish and prawn together."),
      variant("briyani-mutton", "Mutton briyani", "Nasi briyani (mutton)", 4, "briyani-mutton", "Mutton serving."),
      variant("briyani-vegetable", "Vegetable briyani", "Nasi briyani (vegetable)", 7, "briyani-vegetable", "Vegetable serving; the label does not imply dietary certification."),
    ],
  },
  {
    dishId: "dish.masala-thosai",
    defaultVariantId: "thosai-masala",
    variants: [
      variant("thosai-masala", "Masala thosai", "Masala thosai", 1, "thosai-masala-fold", "Default masala-filled serving."),
      variant("thosai-plain", "Plain thosai", "Thosai", 2, "thosai-plain-roll", "Plain thosai serving."),
      variant("thosai-egg", "Egg thosai", "Thosai (egg)", 4, "thosai-egg-centre", "Egg thosai serving."),
      variant("thosai-ghee", "Ghee thosai", "Thosai (ghee)", 7, "thosai-ghee-gloss", "Ghee thosai serving."),
    ],
  },
  {
    dishId: "dish.yong-tau-foo",
    defaultVariantId: "ytf-clear-mixed",
    variants: [
      variant("ytf-clear-mixed", "Clear soup, mixed pieces", "Yong tau foo (clear soup, 7 pieces, mixed)", 1, "ytf-clear-mixed", "Default clear-soup bowl with a mixture of boiled and fried pieces; the boiled clear-soup row is implausible and not used."),
      variant("ytf-clear-fried", "Clear soup, fried pieces", "Yong tau foo (clear soup, 7 pieces, fried)", 2, "ytf-clear-fried", "Clear-soup bowl with seven fried pieces."),
      variant("ytf-laksa-boiled", "Laksa, boiled pieces", "Yong tau foo (laksa, 7 pieces, boiled)", 4, "ytf-laksa-boiled", "Laksa bowl with seven boiled pieces."),
      variant("ytf-clear-noodles", "Clear soup with rice or noodles", "Yong tau foo (clear soup, with rice/noodles)", 7, "ytf-clear-noodles", "Clear-soup serving with the source's grouped rice-or-noodle accompaniment."),
      variant("ytf-laksa-fried", "Laksa, fried pieces", "Yong tau foo (laksa, 7 pieces, fried)", 7, "ytf-laksa-fried", "Laksa bowl with seven fried pieces."),
      variant("ytf-laksa-mixed", "Laksa, mixed pieces", "Yong tau foo (laksa, 7 pieces, mixed)", 7, "ytf-laksa-mixed", "Laksa bowl with a mixture of boiled and fried pieces."),
      variant("ytf-laksa-noodles", "Laksa with rice or noodles", "Yong tau foo (laksa, with rice/noodles)", 7, "ytf-laksa-noodles", "Laksa serving with the source's grouped rice-or-noodle accompaniment."),
    ],
  },
  {
    dishId: "dish.ban-mian",
    defaultVariantId: "ban-mian-soup",
    variants: [
      variant("ban-mian-soup", "Ban mian soup", "Ban mian (soup)", 1, "ban-mian-soup-bowl", "Default soup preparation."),
      variant("ban-mian-dry", "Dry ban mian", "Ban mian (dry)", 2, "ban-mian-dry-toss", "Dry preparation."),
      variant("chilli-ban-mian", "Chilli ban mian", "Chilli ban mian", 4, "ban-mian-chilli-toss", "Chilli-tossed preparation."),
      variant("pork-dumpling-ban-mian", "Pork dumpling ban mian", "Pork dumpling ban mian (soup)", 7, "ban-mian-pork-dumpling", "Soup preparation with pork dumplings."),
      variant("seafood-tom-yum-ban-mian", "Seafood tom yum ban mian", "Seafood tom yum ban mian (soup)", 7, "ban-mian-tom-yum", "Seafood tom yum soup preparation."),
      variant("vegetable-ban-mian", "Vegetable ban mian", "Vegetable ban mian (soup)", 7, "ban-mian-vegetable", "Vegetable soup preparation; the label does not imply dietary certification."),
    ],
  },
  {
    dishId: "dish.bak-kut-teh",
    defaultVariantId: "bak-kut-teh-soup",
    variants: [
      variant("bak-kut-teh-soup", "Bak kut teh soup", "Bak kut teh (soup)", 1, "bak-kut-teh-pepper-soup", "Default peppery soup preparation."),
      variant("bak-kut-teh-dry", "Dry bak kut teh", "Bak kut teh (dry)", 2, "bak-kut-teh-dry-claypot", "Dry braised preparation."),
      variant("bak-kut-teh-herbal", "Herbal bak kut teh", "Herbal bak kut teh (Malaysian)", 4, "bak-kut-teh-herbal-broth", "Herbal Malaysian-style preparation as named by the source."),
    ],
  },
  {
    dishId: "dish.duck-rice",
    defaultVariantId: "duck-rice-braised",
    variants: [
      variant("duck-rice-braised", "Braised duck rice with egg and tau kwa", "Braised duck rice set (with egg and tau kwa)", 1, "duck-rice-braised-egg-tofu", "Default complete braised duck rice set."),
      variant("duck-rice-roasted", "Roasted duck rice", "Roasted duck rice", 2, "duck-rice-roasted", "Roasted duck rice preparation."),
      variant("duck-rice-rice-only", "Braised duck rice, rice only", "Braised duck rice set (rice only)", 4, "duck-rice-rice-only", "Rice-only source serving presented as a portion comparison, not a complete-meal recommendation."),
    ],
  },
];

/**
 * Customer nutrition intents, each ranking one metric within one nutrition class.
 *
 * @type {readonly NutritionIntentDefinition[]}
 */
export const NUTRITION_INTENTS = [
  {
    id: "lighter-energy",
    name: "Lighter energy",
    description: "Prefers a lower-energy meal among reviewed in-game options.",
    metric: "energyKcal",
    direction: "lower",
    nutritionClass: "meal",
  },
  {
    id: "protein-forward",
    name: "Protein-forward",
    description: "Prefers a higher-protein meal among reviewed in-game options.",
    metric: "proteinG",
    direction: "higher",
    nutritionClass: "meal",
  },
  {
    id: "fibre-forward",
    name: "Fibre-forward",
    description: "Prefers a higher-fibre meal among reviewed in-game options.",
    metric: "dietaryFibreG",
    direction: "higher",
    nutritionClass: "meal",
  },
  {
    id: "sodium-aware",
    name: "Sodium-aware",
    description: "Prefers a lower-sodium meal among reviewed in-game options.",
    metric: "sodiumMg",
    direction: "lower",
    nutritionClass: "meal",
  },
  {
    id: "lower-total-sugar-drink",
    name: "Lower-total-sugar drink",
    description: "Prefers a lower-total-sugar drink among reviewed in-game options.",
    metric: "totalSugarG",
    direction: "lower",
    nutritionClass: "drink",
  },
];

/** The educational disclosure shown with nutrition information. */
export const NUTRITION_DISCLOSURE =
  "Hawker Balance is an educational game, not medical or dietary advice. Nutrition values describe the listed source serving; recipes and portions vary. Its 1-5 health and condition ratings compare each serving with a meal's share (for a dessert, a snack's share) of general daily guidance from Singapore's Health Promotion Board and the World Health Organization, and with stricter guidance for each condition: they are not diagnoses, treatment advice, Health Promotion Board certifications, or universal judgements. Daily reference ranges are general guidance for Singaporean adults and do not represent individual needs. Total sugar is not the same as added sugar.";
