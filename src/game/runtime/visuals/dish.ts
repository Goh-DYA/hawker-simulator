/**
 * Code-native visual recipes for dishes and their reviewed nutrition variants.
 *
 * Each recipe names a dish's real-life serving presentation (vessel, portion shape, ingredient
 * and detail cues) plus stable hash variants, so the renderer and the menu panels draw it the
 * same way without image assets. The module is pure and free of Phaser.
 */
import type { DishDefinition } from "@/src/content";
import { ACCENTS, colour, stableVisualHash } from "./palette";

export type DishVesselProfile =
  | "ceramic-plate"
  | "deep-ceramic-bowl"
  | "kopitiam-cup-and-saucer"
  | "tall-drinking-glass"
  | "banana-leaf-lined-plate"
  | "shared-oval-platter"
  | "cast-iron-hot-plate"
  | "bamboo-steamer";

export type DishPortionShape =
  | "rice-mound"
  | "porridge"
  | "noodle-tangle"
  | "broth"
  | "liquid"
  | "shaved-ice"
  | "flatbread"
  | "cake-cubes"
  | "omelette"
  | "fritters"
  | "dumplings"
  | "skewers"
  | "grilled-pieces"
  | "pudding"
  | "whole-seafood"
  | "leaf-parcel"
  | "buns"
  | "braised-scoop"
  | "vegetable-scoop";

export interface DishPresentationProfile {
  readonly source: "catalogue" | "inferred";
  /** Recognisable plated composition rather than a palette-only variant. */
  readonly motif: string;
  readonly vessel: DishVesselProfile;
  readonly portionShape: DishPortionShape;
  /** Main real-world ingredients a renderer should depict. */
  readonly ingredientCues: readonly string[];
  /** Garnish, sauce, wrapping, or arrangement cues that distinguish similar dishes. */
  readonly detailCues: readonly string[];
  readonly semanticKey: string;
}

export interface DishVisualRecipe {
  readonly id: string;
  readonly vessel: "plate" | "bowl" | "cup" | "tray";
  readonly foodForm: "rice" | "noodles" | "broth" | "bread" | "dessert" | "seafood" | "snack" | "drink";
  readonly portionColour: number;
  readonly garnishColour: number;
  readonly garnishCount: number;
  readonly steam: DishDefinition["steamEffect"];
  readonly foodFrame: string;
  readonly containerFrame: string;
  readonly presentation: DishPresentationProfile;
  /** Variant composition key used by renderers for geometry, arrangement, and garnish cues. */
  readonly variantVisualKey?: string;
  /** Non-colour cue that must remain legible in high-contrast rendering. */
  readonly variantGeometryCue?: string;
  readonly variantVisualFamily?: DishVariantVisualFamily;
  readonly contractKey: string;
}

export type DishVariantVisualFamily =
  | "drink"
  | "nasi-lemak"
  | "carrot-cake"
  | "prata"
  | "fish-soup"
  | "bak-chor"
  | "murtabak"
  | "briyani"
  | "thosai"
  | "yong-tau-foo"
  | "ban-mian"
  | "bak-kut-teh"
  | "duck-rice"
  | "prawn-mee"
  | "economic-rice"
  | "nasi-padang"
  | "mee-siam"
  | "wanton-mee"
  | "western"
  | "porridge"
  | "fallback";

/**
 * Maps a reviewed variant's visual key to the canvas family that draws its composition cue.
 *
 * @param visualKey - The variant's visual key from the nutrition content.
 * @returns The variant family, or `fallback` for a key no family claims.
 */
export function variantVisualFamilyForKey(visualKey: string): DishVariantVisualFamily {
  if (
    visualKey.startsWith("kopi-") ||
    visualKey.startsWith("teh-") ||
    visualKey.startsWith("soy-")
  ) {
    return "drink";
  }
  if (visualKey.startsWith("nasi-")) return "nasi-lemak";
  if (visualKey.startsWith("carrot-cake-")) return "carrot-cake";
  if (visualKey.startsWith("prata-")) return "prata";
  if (visualKey.startsWith("fish-")) return "fish-soup";
  if (visualKey.startsWith("bak-chor-")) return "bak-chor";
  if (visualKey.startsWith("murtabak-")) return "murtabak";
  if (visualKey.startsWith("briyani-")) return "briyani";
  if (visualKey.startsWith("thosai-")) return "thosai";
  if (visualKey.startsWith("ytf-")) return "yong-tau-foo";
  if (visualKey.startsWith("ban-mian-")) return "ban-mian";
  if (visualKey.startsWith("bak-kut-teh-")) return "bak-kut-teh";
  if (visualKey.startsWith("duck-rice-")) return "duck-rice";
  if (visualKey.startsWith("prawn-mee-")) return "prawn-mee";
  if (visualKey.startsWith("eco-rice-")) return "economic-rice";
  if (visualKey.startsWith("padang-")) return "nasi-padang";
  if (visualKey.startsWith("mee-siam-")) return "mee-siam";
  if (visualKey.startsWith("wanton-mee-")) return "wanton-mee";
  if (visualKey.startsWith("western-")) return "western";
  if (visualKey.startsWith("porridge-")) return "porridge";
  return "fallback";
}

interface DishPresentationSeed {
  readonly motif: string;
  readonly portionShape: DishPortionShape;
  readonly ingredients: readonly string[];
  readonly details: readonly string[];
}

function dishProfile(
  motif: string,
  portionShape: DishPortionShape,
  ingredients: readonly string[],
  details: readonly string[],
): DishPresentationSeed {
  return { motif, portionShape, ingredients, details };
}

const DISH_PRESENTATIONS: Readonly<Record<string, DishPresentationSeed>> = {
  "poached-chicken-rice": dishProfile("poached-chicken-slices-beside-rice", "rice-mound", ["fragrant-rice", "poached-chicken", "cucumber"], ["dark-soy", "chilli-cup"]),
  "roast-chicken-rice": dishProfile("roast-chicken-slices-over-rice", "rice-mound", ["fragrant-rice", "roast-chicken", "cucumber"], ["crisp-skin", "dark-soy"]),
  "soya-tofu-rice": dishProfile("vegetarian-chicken-and-greens-over-rice", "rice-mound", ["rice", "plant-based-chicken", "leafy-greens"], ["soy-glaze", "spring-onion"]),
  "chicken-congee": dishProfile("silky-congee-with-chicken-shreds", "porridge", ["rice-porridge", "shredded-chicken", "ginger"], ["fried-shallot", "spring-onion"]),
  "nasi-lemak": dishProfile("coconut-rice-with-clustered-sides", "rice-mound", ["coconut-rice", "egg", "anchovy", "peanut", "cucumber"], ["banana-leaf", "sambal"]),
  "mee-rebus": dishProfile("yellow-noodles-in-thick-gravy", "noodle-tangle", ["yellow-noodles", "egg", "bean-sprout"], ["spiced-gravy", "lime"]),
  "soto-ayam": dishProfile("chicken-and-rice-cake-in-clear-broth", "broth", ["chicken", "rice-cake", "clear-broth"], ["coriander", "fried-shallot"]),
  "lontong-sayur": dishProfile("rice-cake-cubes-in-coconut-gravy", "broth", ["rice-cake", "cabbage", "tofu"], ["coconut-gravy", "sambal"]),
  kopi: dishProfile("dark-kopi-with-creamy-surface", "liquid", ["coffee", "condensed-milk"], ["kopitiam-cup", "coffee-rim"]),
  "sugarcane-juice": dishProfile("pale-sugarcane-juice-over-ice", "liquid", ["sugarcane-juice", "ice"], ["tall-glass", "citrus-wedge"]),
  "ice-kacang": dishProfile("rainbow-syrup-over-shaved-ice", "shaved-ice", ["shaved-ice", "red-bean", "jelly"], ["rainbow-syrup", "condensed-milk"]),
  "char-kway-teow": dishProfile("dark-flat-noodles-with-seafood", "noodle-tangle", ["flat-rice-noodles", "prawn", "cockle", "egg"], ["dark-soy", "garlic-chive"]),
  "hokkien-prawn-mee": dishProfile("golden-noodles-with-prawn-and-squid", "noodle-tangle", ["yellow-noodles", "prawn", "squid", "egg"], ["prawn-stock", "lime"]),
  "fried-carrot-cake": dishProfile("radish-cake-cubes-scrambled-with-egg", "cake-cubes", ["radish-cake", "egg", "preserved-radish"], ["black-style", "spring-onion"]),
  "oyster-omelette": dishProfile("crisp-omelette-with-plump-oysters", "omelette", ["egg", "oyster", "starch-crisp"], ["coriander", "chilli-sauce"]),
  "roti-prata": dishProfile("folded-prata-with-curry-side", "flatbread", ["layered-flatbread", "curry"], ["folded-quarters", "curry-cup"]),
  "mee-goreng-mamak": dishProfile("red-wok-noodles-with-egg-and-tofu", "noodle-tangle", ["yellow-noodles", "egg", "tofu"], ["chilli-tomato-sauce", "lime"]),
  "chicken-murtabak": dishProfile("stuffed-murtabak-cut-into-squares", "flatbread", ["stuffed-flatbread", "minced-chicken", "onion"], ["cut-squares", "curry-cup"]),
  "nasi-briyani": dishProfile("spiced-rice-with-large-chicken-piece", "rice-mound", ["briyani-rice", "chicken", "cucumber"], ["fried-onion", "curry-gravy"]),
  "masala-thosai": dishProfile("rolled-thosai-with-potato-filling", "flatbread", ["thosai", "masala-potato", "sambar"], ["rolled-crepe", "chutney-cups"]),
  "idli-sambar": dishProfile("three-idli-cakes-in-sambar", "dumplings", ["idli", "sambar", "coconut-chutney"], ["three-white-cakes", "curry-leaf"]),
  "vadai-set": dishProfile("two-crisp-vadai-rings-with-dips", "fritters", ["two-lentil-vadai", "sambar", "coconut-chutney"], ["ring-shape", "curry-leaf"]),
  "lemon-rice": dishProfile("yellow-lemon-rice-with-peanuts", "rice-mound", ["lemon-rice", "peanut", "mustard-seed"], ["curry-leaf", "lemon-wedge"]),
  "nyonya-laksa": dishProfile("noodles-in-orange-coconut-laksa", "broth", ["rice-noodles", "prawn", "fish-cake", "egg"], ["coconut-laksa", "laksa-leaf"]),
  "ayam-buah-keluak": dishProfile("ayam-pongteh-plated-side-portion", "braised-scoop", ["braised-chicken", "potato"], ["fermented-soy-gravy", "coriander"]),
  "chap-chye": dishProfile("nonya-vegetable-plated-side-portion", "vegetable-scoop", ["cabbage", "carrot", "baby-corn", "black-fungus"], ["tender-stir-fry", "mixed-vegetable-colours"]),
  "babi-pongteh": dishProfile("babi-pongteh-plated-side-portion", "braised-scoop", ["braised-pork", "potato", "mushroom"], ["fermented-soy-gravy", "coriander"]),
  "sambal-stingray": dishProfile("stingray-fillet-on-banana-leaf", "whole-seafood", ["stingray", "sambal"], ["banana-leaf", "lime-wedge"]),
  "sliced-fish-soup": dishProfile("fried-fish-and-bee-hoon-in-clear-soup", "broth", ["fried-fish-pieces", "thick-bee-hoon", "leafy-greens", "clear-broth"], ["tomato", "fried-shallot"]),
  "black-pepper-crab": dishProfile("quarter-crab-and-claw-in-black-pepper-sauce", "whole-seafood", ["quarter-crab", "crab-claw", "black-pepper"], ["visible-claw", "pepper-sauce"]),
  "bak-chor-mee": dishProfile("mee-pok-with-minced-pork-and-mushroom", "noodle-tangle", ["mee-pok", "minced-pork", "mushroom", "fishball"], ["chilli-vinegar", "spring-onion"]),
  "fishball-mee-pok": dishProfile("flat-noodles-with-round-fishballs", "noodle-tangle", ["mee-pok", "fishball", "leafy-greens"], ["fishball-cluster", "light-soy"]),
  "lor-mee": dishProfile("thick-noodles-in-dark-starchy-gravy", "noodle-tangle", ["thick-noodles", "braised-egg", "fish-cake"], ["dark-lor-gravy", "garlic-vinegar"]),
  "teochew-fish-dumpling-soup": dishProfile("fishballs-and-glass-noodles-in-clear-soup", "broth", ["fishball", "glass-noodles", "fish-cake", "bean-sprout"], ["clear-broth", "spring-onion"]),
  "chicken-satay-set": dishProfile("ten-chicken-satay-skewers-with-peanut-sauce", "skewers", ["ten-chicken-satay", "cucumber", "rice-cake"], ["bamboo-skewers", "peanut-sauce"]),
  "bbq-chicken-wings": dishProfile("three-charred-chicken-wings-in-a-row", "grilled-pieces", ["three-chicken-wings", "charred-glaze"], ["grill-marks", "lime-wedge"]),
  "beef-satay-set": dishProfile("ten-beef-satay-skewers-with-peanut-sauce", "skewers", ["ten-beef-satay", "cucumber", "rice-cake"], ["bamboo-skewers", "peanut-sauce"]),
  "sambal-grilled-squid": dishProfile("charcoal-grilled-squid-on-banana-leaf", "whole-seafood", ["squid", "spice-marinade"], ["char-marks", "lime-wedge"]),
  "har-gow": dishProfile("four-prawn-dumplings-with-vegetables-in-light-soup", "broth", ["four-prawn-dumplings", "bamboo-shoot", "vegetables"], ["light-soup", "pleated-wrapper", "ceramic-bowl"]),
  "siew-mai": dishProfile("four-open-topped-siew-mai-in-bamboo-basket", "dumplings", ["minced-pork", "wanton-skin"], ["open-wrapper", "crab-roe", "bamboo-steamer"]),
  "char-siew-bao": dishProfile("white-char-siew-buns-in-bamboo-basket", "buns", ["steamed-bun", "char-siew"], ["split-top", "bamboo-steamer"]),
  "lotus-leaf-rice": dishProfile("opened-lotus-leaf-rice-parcel", "leaf-parcel", ["glutinous-rice", "lap-cheong", "char-siew", "mushroom"], ["lotus-leaf-wrap", "parcel-folds"]),
  chendol: dishProfile("green-chendol-jelly-in-coconut-ice", "shaved-ice", ["chendol-jelly", "coconut-milk", "shaved-ice"], ["palm-sugar", "red-bean"]),
  "tau-huay": dishProfile("silky-beancurd-with-toppings", "pudding", ["beancurd", "syrup", "toppings"], ["silky-surface", "ceramic-bowl"]),
  "teh-tarik": dishProfile("frothy-pulled-tea-in-glass", "liquid", ["black-tea", "condensed-milk"], ["foam-cap", "pulled-tea-bubbles"]),
  "pulut-hitam": dishProfile("black-glutinous-rice-with-coconut-swirl", "pudding", ["black-glutinous-rice", "coconut-milk"], ["white-coconut-swirl", "thick-pudding"]),
  "yong-tau-foo": dishProfile("assorted-stuffed-tofu-and-vegetables-in-broth", "broth", ["stuffed-tofu", "fish-paste", "bitter-gourd", "leafy-greens", "thick-bee-hoon"], ["pick-and-mix-pieces", "clear-broth"]),
  "ban-mian": dishProfile("hand-torn-noodles-with-minced-pork-and-egg", "noodle-tangle", ["flat-noodles", "minced-pork", "egg", "leafy-greens"], ["anchovy", "spring-onion"]),
  "thunder-tea-rice": dishProfile("herbed-rice-with-green-tea-soup", "rice-mound", ["brown-rice", "chopped-greens", "tofu", "peanut"], ["green-tea-broth", "separated-toppings"]),
  popiah: dishProfile("fresh-popiah-roll-cut-in-two", "flatbread", ["thin-wrapper", "turnip", "carrot", "egg"], ["sweet-sauce", "cut-roll"]),
  "bak-kut-teh": dishProfile("pork-ribs-in-peppery-garlic-broth-with-rice-and-you-tiao", "broth", ["pork-ribs", "garlic", "peppery-broth", "white-rice", "you-tiao"], ["side-rice-bowl", "pepper-specks"]),
  "duck-rice": dishProfile("braised-duck-slices-over-dark-rice", "rice-mound", ["braised-duck", "seasoned-rice", "cucumber"], ["dark-braising-sauce", "chilli-cup"]),
  "kway-chap": dishProfile("broad-rice-sheets-in-dark-broth", "broth", ["broad-rice-sheets", "braised-pork", "tofu", "egg"], ["dark-herbal-broth", "fried-garlic"]),
  "claypot-chicken-rice": dishProfile("chicken-rice-in-charred-claypot", "rice-mound", ["rice", "chicken", "chinese-sausage", "mushroom"], ["claypot-crust", "dark-soy"]),
  "char-siew-rice": dishProfile("glazed-char-siew-fanned-over-rice", "rice-mound", ["rice", "char-siew", "cucumber"], ["sweet-sauce", "charred-edges"]),
  "nasi-padang": dishProfile("rice-with-beef-rendang-on-banana-leaf", "rice-mound", ["rice", "beef-rendang", "long-bean"], ["rendang-gravy", "red-chilli"]),
  "kaya-toast": dishProfile("kaya-butter-toast-triangles", "flatbread", ["toast", "kaya", "butter-slab"], ["crisp-crust", "cut-triangles"]),
  "barley-drink": dishProfile("cloudy-barley-water-over-ice", "liquid", ["barley-water", "pearl-barley", "ice"], ["tall-glass", "settled-barley"]),
  "beef-hor-fun": dishProfile("flat-rice-noodles-with-beef-in-egg-gravy", "noodle-tangle", ["flat-rice-noodles", "sliced-beef", "leafy-greens"], ["silky-egg-gravy", "wok-char"]),
  "chwee-kueh": dishProfile("five-rice-cakes-topped-with-preserved-radish", "dumplings", ["steamed-rice-cake", "preserved-radish"], ["five-white-discs", "chilli-dab"]),
  "roti-john": dishProfile("egg-and-mince-baguette-cut-into-strips", "flatbread", ["baguette", "egg", "minced-meat", "onion"], ["cut-strips", "chilli-sauce"]),
  "soya-bean-milk": dishProfile("chilled-soy-milk-in-glass", "liquid", ["soy-milk", "sugar-syrup"], ["tall-glass", "foam-ring"]),
  "economic-rice": dishProfile("rice-with-one-vegetable-and-one-meat", "rice-mound", ["rice", "stir-fried-cabbage", "sweet-sour-pork"], ["separate-portions", "curry-drizzle"]),
  "wanton-mee": dishProfile("dry-egg-noodles-with-wantons-and-char-siew", "noodle-tangle", ["egg-noodles", "wanton", "char-siew", "leafy-greens"], ["dark-sauce", "pickled-green-chilli"]),
  "mee-siam": dishProfile("vermicelli-in-tamarind-gravy-with-egg", "noodle-tangle", ["rice-vermicelli", "egg", "tau-pok"], ["tamarind-gravy", "lime"]),
  "kueh-pie-tee": dishProfile("five-crisp-pastry-cups-with-turnip", "fritters", ["pastry-cup", "shredded-turnip", "prawn"], ["top-hat-shape", "chilli-sauce"]),
  "prawn-noodle-soup": dishProfile("yellow-noodles-in-red-prawn-broth", "broth", ["yellow-noodles", "whole-prawn", "pork-slices", "fish-cake"], ["prawn-broth", "fried-shallot"]),
  "century-egg-porridge": dishProfile("silky-congee-with-century-egg-and-minced-pork", "porridge", ["rice-porridge", "century-egg", "minced-pork"], ["spring-onion"]),
  "fish-porridge": dishProfile("congee-with-crisp-fried-fish-pieces", "porridge", ["rice-porridge", "fried-fish-pieces"], ["spring-onion", "fried-shallot"]),
  "minced-pork-porridge": dishProfile("congee-with-minced-pork-and-dough-fritter", "porridge", ["rice-porridge", "minced-pork", "you-tiao-bits"], ["spring-onion"]),
  "chee-cheong-fun": dishProfile("steamed-rice-rolls-under-sweet-sauce", "dumplings", ["rice-rolls"], ["sweet-sauce", "sesame-oil-sheen"]),
  "you-tiao": dishProfile("twin-golden-dough-sticks", "fritters", ["dough-stick-pair"], ["crisp-ridges"]),
  "cheng-tng": dishProfile("longan-and-lotus-seeds-in-clear-syrup", "liquid", ["longan", "white-fungus", "lotus-seed"], ["clear-syrup"]),
  "orh-nee": dishProfile("purple-yam-paste-with-gingko-and-pumpkin", "pudding", ["yam-paste", "gingko", "pumpkin"], ["oil-sheen"]),
  "tau-suan": dishProfile("golden-split-mung-beans-with-dough-fritter", "pudding", ["split-mung-bean", "you-tiao"], ["glossy-syrup"]),
  "green-bean-soup": dishProfile("green-beans-in-sweet-soup", "liquid", ["green-bean"], ["sweet-soup"]),
  "black-sesame-paste": dishProfile("inky-black-sesame-paste-with-swirl", "pudding", ["black-sesame"], ["glossy-swirl"]),
  "ayam-penyet": dishProfile("smashed-fried-chicken-with-sambal-rice-and-tofu", "rice-mound", ["smashed-fried-chicken", "rice", "tofu", "vegetables"], ["sambal"]),
  "nasi-goreng": dishProfile("red-gold-fried-rice-with-egg-and-cucumber", "rice-mound", ["fried-rice-with-egg", "mixed-vegetables", "cucumber"], ["chilli"]),
  "mee-soto": dishProfile("yellow-noodles-and-chicken-in-spiced-soto-broth", "broth", ["yellow-noodles", "shredded-chicken", "spiced-broth"], ["lime", "fried-shallot"]),
  "gado-gado": dishProfile("tofu-egg-and-vegetables-under-peanut-gravy", "vegetable-scoop", ["fried-tofu", "egg-half", "rice-cake", "green-beans", "bean-sprout"], ["peanut-sauce"]),
  "ayam-panggang": dishProfile("spice-glazed-grilled-chicken-leg-over-rice", "grilled-pieces", ["grilled-chicken-leg", "rice"], ["char-marks", "spice-glaze"]),
  "chicken-chop": dishProfile("grilled-chicken-chop-with-fries-and-coleslaw", "grilled-pieces", ["chicken-chop", "fries", "coleslaw"], ["grill-marks", "sizzle-plate"]),
  "aglio-olio": dishProfile("spaghetti-in-garlic-oil-with-mushrooms", "noodle-tangle", ["spaghetti", "mushroom", "garlic"], ["chilli-flakes", "parsley"]),
  "fish-and-chips": dishProfile("battered-fish-fillet-with-fries", "fritters", ["battered-fish-fillet", "fries"], ["tartar-dollop", "lemon-wedge"]),
  "spaghetti-bolognese": dishProfile("spaghetti-under-minced-beef-tomato-sauce", "noodle-tangle", ["spaghetti", "minced-beef-sauce"], ["herb-flecks"]),
  "black-pepper-steak": dishProfile("grilled-steak-with-potato-and-pepper-sauce-cup", "grilled-pieces", ["beef-steak", "potato", "vegetables"], ["black-pepper-sauce-cup", "grill-marks"]),
  "mutton-satay-set": dishProfile("ten-mutton-satay-skewers-with-peanut-sauce", "skewers", ["ten-mutton-satay"], ["bamboo-skewers", "peanut-sauce"]),
  appam: dishProfile("two-lacy-rimmed-rice-coconut-hoppers", "flatbread", ["rice-coconut-hopper"], ["lacy-rim", "soft-centre"]),
  "watercress-pork-rib-soup": dishProfile("pork-ribs-and-watercress-in-clear-soup", "broth", ["pork-ribs", "watercress", "red-dates"], ["clear-soup", "wolfberries"]),
  "chilli-crab": dishProfile("quarter-crab-and-claw-in-red-chilli-egg-gravy", "whole-seafood", ["quarter-crab", "crab-claw", "egg-ribbons"], ["chilli-gravy"]),
};

function dishVesselProfile(frame: string): DishVesselProfile {
  // Checked before any plate rule, since "hot-plate" contains "plate".
  if (frame.includes("hot-plate")) return "cast-iron-hot-plate";
  if (frame.includes("leaf")) return "banana-leaf-lined-plate";
  if (frame.includes("platter")) return "shared-oval-platter";
  if (frame.includes("glass")) return "tall-drinking-glass";
  if (frame.includes("cup")) return "kopitiam-cup-and-saucer";
  if (frame.includes("bowl")) return "deep-ceramic-bowl";
  return "ceramic-plate";
}

function fallbackDishPresentation(dish: DishDefinition, identity: string): DishPresentationSeed {
  const portionShape: DishPortionShape =
    dish.category === "rice"
      ? "rice-mound"
      : dish.category === "noodles"
        ? "noodle-tangle"
        : dish.category === "soup"
          ? "broth"
          : dish.category === "bread"
            ? "flatbread"
            : dish.category === "drink"
              ? "liquid"
              : dish.category === "dessert"
                ? dish.preferenceTags.includes("cold") ? "shaved-ice" : "pudding"
                : dish.category === "seafood"
                  ? "whole-seafood"
                  : "grilled-pieces";
  const ingredientCues = [...new Set([dish.category, ...dish.preferenceTags])]
    .filter((cue) => !["comfort", "filling", "premium", "shareable"].includes(cue))
    .slice(0, 4);
  return dishProfile(
    `${identity}-${portionShape}`,
    portionShape,
    ingredientCues.length > 0 ? ingredientCues : [dish.category],
    dish.dietaryTags.includes("spicy") ? ["chilli-garnish"] : ["catalogue-garnish"],
  );
}

/**
 * Derives the deterministic visual recipe of a dish: vessel, food form, colours and presentation.
 *
 * Known dishes use their authored presentation; other dishes get a presentation inferred from
 * their category, sprite frames and tags.
 *
 * @param dish - The dish content definition.
 * @returns The recipe, with a contract key that is unique per launch dish.
 */
export function visualRecipeForDish(dish: DishDefinition): DishVisualRecipe {
  const seed = stableVisualHash(dish.id);
  const identity = dish.foodSprite.frame || dish.id.replace(/^dish\./, "");
  const knownPresentation = DISH_PRESENTATIONS[identity]
    ?? DISH_PRESENTATIONS[dish.id.replace(/^dish\./, "")];
  const presentationSeed = knownPresentation ?? fallbackDishPresentation(dish, identity);
  const vesselProfile = presentationSeed.details.includes("bamboo-steamer")
    ? "bamboo-steamer"
    : dishVesselProfile(dish.containerSprite.frame);
  const semanticKey = [
    presentationSeed.motif,
    vesselProfile,
    presentationSeed.portionShape,
    presentationSeed.ingredients.join("+"),
    presentationSeed.details.join("+"),
  ].join(":");
  const presentation: DishPresentationProfile = {
    source: knownPresentation ? "catalogue" : "inferred",
    motif: presentationSeed.motif,
    vessel: vesselProfile,
    portionShape: presentationSeed.portionShape,
    ingredientCues: presentationSeed.ingredients,
    detailCues: presentationSeed.details,
    semanticKey,
  };
  const vessel: DishVisualRecipe["vessel"] =
    vesselProfile === "kopitiam-cup-and-saucer" || vesselProfile === "tall-drinking-glass"
      ? "cup"
      : vesselProfile === "deep-ceramic-bowl"
        ? "bowl"
        : vesselProfile === "banana-leaf-lined-plate" ||
            vesselProfile === "shared-oval-platter" ||
            vesselProfile === "bamboo-steamer"
          ? "tray"
          : "plate";
  const foodForm: DishVisualRecipe["foodForm"] =
    dish.category === "rice"
      ? "rice"
      : dish.category === "noodles"
        ? "noodles"
        : dish.category === "soup"
          ? "broth"
          : dish.category === "bread"
            ? "bread"
            : dish.category === "dessert"
              ? "dessert"
              : dish.category === "seafood"
                ? "seafood"
                : dish.category === "drink"
                  ? "drink"
                  : "snack";
  const garnishColour = ACCENTS[(seed >>> 8) % ACCENTS.length] as number;
  return {
    id: dish.id,
    vessel,
    foodForm,
    portionColour: colour(dish.portionColour, 0xd69a35),
    garnishColour,
    garnishCount: 1 + ((seed >>> 13) % 4),
    steam: dish.steamEffect,
    foodFrame: `${dish.foodSprite.atlas}:${dish.foodSprite.frame}`,
    containerFrame: `${dish.containerSprite.atlas}:${dish.containerSprite.frame}`,
    presentation,
    contractKey: `${dish.id}:${semanticKey}:${vessel}:${foodForm}:${dish.portionColour}:${garnishColour.toString(16)}:${dish.foodSprite.frame}:${dish.containerSprite.frame}`,
  };
}

/**
 * Resolves a reviewed nutrition variant into a visual recipe. The visual key is
 * deliberately carried separately from colour so canvas, catalogue, and
 * high-contrast renderers can all express a composition change.
 */
export function visualRecipeForDishVariant(
  dish: DishDefinition,
  visualKey?: string,
): DishVisualRecipe {
  const base = visualRecipeForDish(dish);
  if (!visualKey) return base;
  const variantSeed = stableVisualHash(`${dish.id}:${visualKey}`);
  const garnishColour = ACCENTS[(variantSeed >>> 8) % ACCENTS.length] as number;
  const geometryCue = visualKey;
  const presentation: DishPresentationProfile = {
    ...base.presentation,
    motif: `${base.presentation.motif}-${geometryCue}`,
    detailCues: [...base.presentation.detailCues, geometryCue],
    semanticKey: `${base.presentation.semanticKey}:variant:${geometryCue}`,
  };
  return {
    ...base,
    garnishColour,
    garnishCount: 1 + ((variantSeed >>> 13) % 4),
    presentation,
    variantVisualKey: visualKey,
    variantGeometryCue: geometryCue,
    variantVisualFamily: variantVisualFamilyForKey(visualKey),
    contractKey: `${base.contractKey}:variant:${geometryCue}:${garnishColour.toString(16)}`,
  };
}
