import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "vitest";

import {
  DISHES,
  LAUNCH_CONTENT,
  LAUNCH_ROSTER,
  NUTRITION_CONTENT,
  getNutritionIntent,
  getNutritionProfile,
  getNutritionVariant,
  getNutritionVariantFamily,
  validateContent,
} from "@/src/content/index";
import { BORROWED_COMPONENT_ALLOWLIST, SNACK_RATED_DISH_IDS } from "@/tools/nutrition/manifest.mjs";

const VARIANT_FAMILY_DISHES = [
  "dish.kopi",
  "dish.teh-tarik",
  "dish.nasi-lemak",
  "dish.fried-carrot-cake",
  "dish.roti-prata",
  "dish.sliced-fish-soup",
  "dish.bak-chor-mee",
  "dish.chicken-murtabak",
  "dish.nasi-briyani",
  "dish.masala-thosai",
  "dish.yong-tau-foo",
  "dish.ban-mian",
  "dish.bak-kut-teh",
  "dish.duck-rice",
  "dish.prawn-noodle-soup",
  "dish.economic-rice",
  "dish.nasi-padang",
  "dish.mee-siam",
  "dish.wanton-mee",
  "dish.soya-bean-milk",
  "dish.chicken-chop",
  "dish.fish-and-chips",
  "dish.fish-porridge",
];

const VARIANT_IDS: Readonly<Record<string, readonly string[]>> = {
  "dish.kopi": ["kopi-default", "kopi-siu-dai", "kopi-c", "kopi-c-kosong", "kopi-o", "kopi-o-kosong", "kopi-c-siu-dai", "kopi-o-siu-dai"],
  "dish.teh-tarik": ["teh-tarik", "teh", "teh-siu-dai", "teh-c", "teh-c-kosong", "teh-o", "teh-o-kosong", "teh-c-siu-dai", "teh-o-siu-dai", "teh-halia"],
  "dish.nasi-lemak": ["nasi-lemak-chicken-wing", "nasi-lemak-chicken-cutlet", "nasi-lemak-wing-cutlet", "nasi-lemak-egg-ikan-bilis-peanut", "nasi-lemak-fish", "nasi-lemak-rice-only"],
  "dish.fried-carrot-cake": ["carrot-cake-black", "carrot-cake-white"],
  "dish.roti-prata": ["prata-two-plain-curry", "prata-plain", "prata-egg", "prata-egg-onion", "prata-egg-onion-cheese"],
  "dish.sliced-fish-soup": ["fish-soup-fried-beehoon-no-milk", "fish-soup-beehoon-no-milk", "fish-soup-beehoon-milk", "fish-soup-sliced-no-milk", "fish-soup-sliced-milk"],
  "dish.bak-chor-mee": ["bak-chor-mee-dry", "bak-chor-mee-soup"],
  "dish.chicken-murtabak": ["murtabak-chicken", "murtabak-chicken-half", "murtabak-chicken-mushroom-cheese", "murtabak-mutton", "murtabak-vegetable"],
  "dish.nasi-briyani": ["briyani-chicken", "briyani-fish-prawn", "briyani-mutton", "briyani-vegetable"],
  "dish.masala-thosai": ["thosai-plain", "thosai-masala", "thosai-egg", "thosai-ghee", "thosai-rawa", "thosai-paper", "thosai-cheese"],
  "dish.yong-tau-foo": ["ytf-clear-noodles", "ytf-clear-mixed", "ytf-clear-fried", "ytf-laksa-boiled", "ytf-laksa-fried", "ytf-laksa-mixed", "ytf-laksa-noodles"],
  "dish.ban-mian": ["ban-mian-soup", "ban-mian-dry", "chilli-ban-mian", "pork-dumpling-ban-mian", "seafood-tom-yum-ban-mian", "vegetable-ban-mian", "mee-hoon-kway-dry", "mee-hoon-kway-soup"],
  "dish.bak-kut-teh": ["bak-kut-teh-rice-you-tiao", "bak-kut-teh-soup", "bak-kut-teh-herbal", "bak-kut-teh-dry"],
  "dish.duck-rice": ["duck-rice-braised", "duck-rice-roasted", "duck-rice-rice-only", "duck-noodles-dry"],
  "dish.prawn-noodle-soup": ["prawn-noodles-soup", "prawn-noodles-dry"],
  "dish.economic-rice": ["economic-rice-veg-meat", "economic-rice-veg-fish", "economic-rice-two-veg", "economic-rice-veg-fried-meat"],
  "dish.nasi-padang": ["nasi-padang-beef", "nasi-padang-sambal-goreng", "nasi-padang-chicken", "nasi-padang-assam-pedas"],
  "dish.mee-siam": ["mee-siam-gravy", "mee-siam-fried"],
  "dish.wanton-mee": ["wanton-mee-dry", "sui-kow-mee-soup", "wanton-mee-soup"],
  "dish.soya-bean-milk": ["soy-milk-regular", "soy-milk-less-sugar", "soy-milk-grass-jelly", "soy-milk-no-sugar"],
  "dish.chicken-chop": ["chicken-chop-fries-coleslaw", "chicken-chop-spaghetti", "chicken-chop-fries-mash"],
  "dish.fish-and-chips": ["fish-and-chips", "grilled-fish-set"],
  "dish.fish-porridge": ["fish-porridge-fried", "fish-porridge-sliced"],
};

describe("nutrition content", () => {
  it("keeps the reviewed generated snapshot byte-for-byte deterministic", async () => {
    const bytes = await readFile(
      new URL("../../src/content/nutrition.generated.json", import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      "c4dce8eb58dbae5d02aa70ee28a2504ff13ae1c34326b421b0fcbcb3ad963f4e",
    );
  });

  it("mounts deterministic schema-v2 nutrition content", () => {
    const report = validateContent();

    assert.equal(LAUNCH_CONTENT.version, "1.7.0");
    assert.equal(LAUNCH_CONTENT.nutrition, NUTRITION_CONTENT);
    assert.equal(NUTRITION_CONTENT.schemaVersion, 2);
    assert.equal(report.counts.nutritionProfiles, 171);
    assert.equal(
      report.counts.nutritionVariantFamilies,
      LAUNCH_ROSTER.nutritionVariantFamilies,
    );
    assert.equal(NUTRITION_CONTENT.dataVersion, "sg-1bc212db6eda-c87987b4281c-r5");
    assert.deepEqual(
      NUTRITION_CONTENT.sourceSnapshots.map((snapshot) => snapshot.rowCount),
      [2_689, 11],
    );
    assert.deepEqual(
      NUTRITION_CONTENT.sourceSnapshots.map((snapshot) => snapshot.sha256),
      [
        "1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e",
        "c87987b4281c8557f75b61fefa96d95d13e9ff60c2c41e38fe4a428219064ab4",
      ],
    );
    assert.doesNotMatch(JSON.stringify(NUTRITION_CONTENT), /H:\\\\|My Drive/i);
  });

  it("gives all 67 dishes and every variant a released source profile", () => {
    const primary = NUTRITION_CONTENT.profiles.filter(
      (profile) => profile.id === profile.dishId,
    );
    assert.equal(primary.length, LAUNCH_ROSTER.dishes);
    assert.deepEqual(
      primary.map((profile) => profile.dishId).sort(),
      DISHES.map((dish) => dish.id).sort(),
    );
    assert.ok(primary.every((profile) => profile.status === "released"));
    assert.ok(
      NUTRITION_CONTENT.profiles.every(
        (profile) => profile.status === "released",
      ),
    );
  });

  it("ships twenty-three approved variant families with deterministic mastery ranks", () => {
    assert.deepEqual(
      NUTRITION_CONTENT.variantFamilies.map((family) => family.dishId),
      VARIANT_FAMILY_DISHES,
    );

    for (const family of NUTRITION_CONTENT.variantFamilies) {
      assert.deepEqual(
        family.variants.map((variant) => variant.id),
        VARIANT_IDS[family.dishId],
      );
      assert.equal(family.variants[0].id, family.defaultVariantId);
      family.variants.forEach((variant, index) => {
        assert.equal(
          variant.unlockRank,
          index === 0 ? 1 : index === 1 ? 2 : index === 2 ? 4 : 7,
        );
        const profile = NUTRITION_CONTENT.profiles.find(
          (candidate) => candidate.id === variant.profileId,
        );
        assert.equal(profile?.dishId, family.dishId);
        assert.equal(profile?.variantId, variant.id);
      });
    }
    assert.equal(
      new Set(
        NUTRITION_CONTENT.variantFamilies.flatMap((family) =>
          family.variants.map((variant) => variant.visualKey),
        ),
      ).size,
      103,
    );
  });

  it("assigns bounded ratings and condition-sensitive variant trade-offs", () => {
    for (const dish of DISHES) {
      assert.ok(dish.starRating >= 1 && dish.starRating <= 5);
      assert.equal(dish.starRating * 10, Math.round(dish.starRating * 10));
    }
    for (const profile of NUTRITION_CONTENT.profiles) {
      assert.ok(profile.healthRating >= 1 && profile.healthRating <= 5);
      assert.deepEqual(Object.keys(profile.conditionRatings).sort(), [
        "diabetes",
        "high-cholesterol",
        "hypertension",
        "obesity",
      ]);
      for (const rating of Object.values(profile.conditionRatings)) {
        assert.ok(rating >= 1 && rating <= 5);
      }
    }

    const kopi = getNutritionProfile("dish.kopi");
    const kopiSiuDai = getNutritionProfile("dish.kopi", "kopi-siu-dai");
    const kopiKosong = getNutritionProfile("dish.kopi", "kopi-o-kosong");
    assert.deepEqual(kopi?.nutrients.totalSugarG, {
      status: "unavailable",
      reason: "implausible-source",
    });
    assert.equal(kopi?.withheldReasons?.length, 1);
    assert.equal(kopiSiuDai?.nutrients.totalSugarG.status, "known");
    assert.equal(kopiKosong?.nutrients.totalSugarG.status, "known");
    assert.ok(
      (kopiKosong?.nutrients.totalSugarG.value ?? Infinity) <
        (kopiSiuDai?.nutrients.totalSugarG.value ?? -Infinity),
    );
    assert.ok(
      (kopiKosong?.conditionRatings.diabetes ?? 0) >
        (kopi?.conditionRatings.diabetes ?? 5),
    );
    assert.deepEqual(
      ["kopi-default", "kopi-siu-dai", "kopi-c", "kopi-o", "kopi-c-kosong", "kopi-o-kosong"].map(
        (variantId) => getNutritionProfile("dish.kopi", variantId)?.healthRating,
      ),
      [2.1, 2.8, 3.4, 3.8, 4.7, 5],
    );
  });

  it("rates each serving against guideline amounts rather than the rest of the menu", () => {
    const rating = (dishId: string, variantId?: string) => {
      const profile = getNutritionProfile(dishId, variantId);
      assert.ok(profile, `${dishId} ${variantId ?? ""} must have a profile`);
      return profile;
    };
    const chapChye = rating("dish.chap-chye");
    const babiPongteh = rating("dish.babi-pongteh");
    assert.ok(chapChye.healthRating > babiPongteh.healthRating);
    assert.ok(
      chapChye.conditionRatings["high-cholesterol"] >
        babiPongteh.conditionRatings["high-cholesterol"],
    );
    assert.ok(chapChye.conditionRatings.obesity > babiPongteh.conditionRatings.obesity);

    for (const [dishId, sugared, kosong] of [
      ["dish.kopi", "kopi-c", "kopi-c-kosong"],
      ["dish.kopi", "kopi-o", "kopi-o-kosong"],
      ["dish.teh-tarik", "teh-c", "teh-c-kosong"],
      ["dish.teh-tarik", "teh-o", "teh-o-kosong"],
    ] as const) {
      assert.ok(rating(dishId, kosong).healthRating > rating(dishId, sugared).healthRating);
      assert.ok(
        rating(dishId, kosong).conditionRatings.diabetes >
          rating(dishId, sugared).conditionRatings.diabetes,
      );
    }

    assert.ok(rating("dish.sugarcane-juice").conditionRatings.diabetes <= 1.5);
    for (const variantId of ["ytf-clear-fried", "ytf-laksa-fried"]) {
      assert.ok(
        rating("dish.yong-tau-foo", variantId).healthRating <
          rating("dish.yong-tau-foo").healthRating,
      );
    }
    for (const profile of NUTRITION_CONTENT.profiles) {
      const sodium = profile.nutrients.sodiumMg;
      if (sodium.status === "known" && sodium.value >= 2_000) {
        assert.ok(profile.conditionRatings.hypertension <= 2, profile.id);
      }
    }
    const meals = NUTRITION_CONTENT.profiles
      .filter((profile) => profile.nutritionClass === "meal")
      .map((profile) => profile.healthRating);
    assert.equal(Math.min(...meals), 1);
    assert.ok(Math.max(...meals) >= 4);
  });

  it("rates desserts as snacks and keeps the reviewed orderings", () => {
    assert.deepEqual(
      [...SNACK_RATED_DISH_IDS].sort(),
      DISHES.filter((dish) => dish.category === "dessert")
        .map((dish) => dish.id)
        .sort(),
    );
    const rating = (dishId: string, variantId?: string) => {
      const profile = getNutritionProfile(dishId, variantId);
      assert.ok(profile, `${dishId} ${variantId ?? ""} must have a profile`);
      return profile;
    };
    for (const dishId of SNACK_RATED_DISH_IDS) {
      assert.ok(rating(dishId).conditionRatings.obesity < 5, dishId);
    }
    assert.ok(
      rating("dish.tau-huay").healthRating > rating("dish.ice-kacang").healthRating &&
        rating("dish.ice-kacang").healthRating > rating("dish.chendol").healthRating,
    );
    assert.ok(
      rating("dish.sliced-fish-soup").healthRating >
        rating("dish.sliced-fish-soup", "fish-soup-beehoon-milk").healthRating,
    );
    assert.ok(
      rating("dish.sliced-fish-soup", "fish-soup-sliced-no-milk").healthRating >
        rating("dish.sliced-fish-soup", "fish-soup-sliced-milk").healthRating,
    );
    const energy = (dishId: string, variantId?: string) => {
      const value = rating(dishId, variantId).nutrients.energyKcal;
      assert.equal(value.status, "known");
      return value.status === "known" ? value.value : Number.NaN;
    };
    assert.ok(
      energy("dish.roti-prata", "prata-plain") < energy("dish.roti-prata", "prata-egg"),
    );
    assert.ok(
      rating("dish.poached-chicken-rice").healthRating >=
        rating("dish.roast-chicken-rice").healthRating,
    );
  });

  it("publishes composites, withheld values and readable serving labels", () => {
    assert.deepEqual(
      NUTRITION_CONTENT.profiles
        .filter((profile) => (profile.components?.length ?? 0) >= 2)
        .map((profile) => profile.id),
      [
        "dish.soya-tofu-rice",
        "dish.roti-prata",
        "dish.nyonya-laksa",
        "dish.bak-kut-teh",
        "dish.bak-kut-teh:bak-kut-teh-soup",
        "dish.bak-kut-teh:bak-kut-teh-herbal",
        "dish.bak-kut-teh:bak-kut-teh-dry",
      ],
    );
    assert.deepEqual(
      NUTRITION_CONTENT.profiles
        .filter((profile) => profile.withheldReasons !== undefined)
        .map((profile) => profile.id)
        .sort(),
      [
        "dish.black-sesame-paste",
        "dish.claypot-chicken-rice",
        "dish.kopi",
        "dish.lor-mee",
        "dish.mee-rebus",
        "dish.mee-siam",
      ],
    );
    for (const profile of NUTRITION_CONTENT.profiles) {
      if (profile.withheldReasons === undefined) continue;
      assert.ok(
        Object.values(profile.nutrients).some(
          (value) => value.status === "unavailable" && value.reason === "implausible-source",
        ),
        profile.id,
      );
    }
    const laksaSaturatedFat = getNutritionProfile("dish.nyonya-laksa")?.nutrients.saturatedFatG;
    assert.ok(laksaSaturatedFat?.status === "known" && laksaSaturatedFat.value >= 20.83);
    for (const profile of NUTRITION_CONTENT.profiles) {
      const match = profile.serving?.label.match(/\((\d+(?:\.\d+)?) (g|ml)\)$/);
      assert.ok(match, `${profile.id} label "${profile.serving?.label}"`);
      assert.equal(Number(match[1]), Math.round(profile.serving?.amount ?? Number.NaN), profile.id);
      assert.equal(match[2], profile.serving?.unit, profile.id);
    }
  });

  it("preserves trace, unavailable, scaled, and provenance semantics", () => {
    const chickenRice = getNutritionProfile("dish.poached-chicken-rice");
    assert.equal(chickenRice?.nutrients.totalSugarG.status, "trace");

    const sugarcane = getNutritionProfile("dish.sugarcane-juice");
    assert.deepEqual(sugarcane?.nutrients.dietaryFibreG, {
      status: "unavailable",
      reason: "not-reported",
    });

    const charSiewBao = getNutritionProfile("dish.char-siew-bao");
    assert.equal(charSiewBao?.serving?.amount, 168);
    assert.equal(charSiewBao?.serving?.label, "3 pieces (168 g)");
    assert.deepEqual(charSiewBao?.nutrients.energyKcal, {
      status: "known",
      value: 441,
    });
    assert.equal(charSiewBao?.provenance?.multiplier, 3);
    assert.equal(charSiewBao?.provenance?.mappingKind, "scaled-exact");

    for (const profile of NUTRITION_CONTENT.profiles.filter(
      (candidate) => candidate.status === "released",
    )) {
      assert.ok(profile.serving);
      assert.match(profile.provenance?.sourceRowSha256 ?? "", /^[a-f0-9]{64}$/);
      assert.doesNotMatch(profile.provenance?.sourceFile ?? "", /[\\/]/);
    }
  });

  it("precomputes only compatible relative intent fits", () => {
    const intentById = new Map(
      NUTRITION_CONTENT.intents.map((intent) => [intent.id, intent]),
    );
    for (const profile of NUTRITION_CONTENT.profiles) {
      for (const [intentId, fit] of Object.entries(profile.intentFits)) {
        const intent = intentById.get(intentId as never);
        assert.ok(intent);
        assert.equal(intent.nutritionClass, profile.nutritionClass);
        assert.ok(
          profile.nutrients[intent.metric].status === "known" ||
            profile.nutrients[intent.metric].status === "trace",
        );
        assert.ok(fit >= 0 && fit <= 1);
      }
      if (profile.status !== "released") assert.deepEqual(profile.intentFits, {});
    }

    assert.equal(getNutritionIntent("lower-total-sugar-drink")?.metric, "totalSugarG");
    assert.equal(
      getNutritionProfile("dish.kopi", "kopi-o-kosong")?.intentFits[
        "lower-total-sugar-drink"
      ],
      1,
    );
  });

  it("resolves default and selected variant profiles through public helpers", () => {
    const family = getNutritionVariantFamily("dish.fried-carrot-cake");
    assert.equal(family?.defaultVariantId, "carrot-cake-black");
    assert.equal(
      getNutritionVariant("dish.fried-carrot-cake")?.id,
      "carrot-cake-black",
    );
    assert.equal(
      getNutritionProfile("dish.fried-carrot-cake", "carrot-cake-white")
        ?.provenance?.sourceFoodName,
      "Fried carrot cake (white)",
    );
    assert.equal(
      getNutritionProfile("dish.fried-carrot-cake", "invalid-variant")?.id,
      "dish.fried-carrot-cake",
    );
    assert.equal(getNutritionVariantFamily("dish.mee-rebus"), undefined);
  });

  it("keeps adult guidelines contextual and excludes incompatible comparisons", () => {
    assert.equal(NUTRITION_CONTENT.guidelines.length, LAUNCH_ROSTER.nutritionGuidelines);
    for (const id of ["added-sugar", "cholesterol", "drinking-water"]) {
      const guideline = NUTRITION_CONTENT.guidelines.find(
        (candidate) => candidate.id === id,
      );
      assert.equal(guideline?.comparison, "not-comparable");
      assert.ok(guideline?.notComparableReason);
    }
    assert.match(NUTRITION_CONTENT.disclosure, /not medical or dietary advice/i);
    assert.match(NUTRITION_CONTENT.disclosure, /Total sugar is not the same as added sugar/);
  });
});

describe("variant family defaults", () => {
  const profile_of = (profile_id: string) => {
    const profile = NUTRITION_CONTENT.profiles.find((candidate) => candidate.id === profile_id);
    assert.ok(profile, `missing profile ${profile_id}`);
    return profile;
  };

  it.each(NUTRITION_CONTENT.variantFamilies.map((family) => [family.dishId, family] as const))(
    "%s: the default rates strictly below another option and leaves a real tuning move",
    (_dish_id, family) => {
      const default_variant = family.variants.find(
        (variant) => variant.id === family.defaultVariantId,
      );
      assert.ok(default_variant);
      const default_profile = profile_of(default_variant.profileId);
      const other_variants = family.variants.filter(
        (variant) => variant.id !== family.defaultVariantId,
      );
      const others = other_variants.map((variant) => profile_of(variant.profileId));
      const best_other = Math.max(...others.map((profile) => profile.healthRating));
      assert.ok(default_profile.healthRating < best_other, "default ties or tops its family");
      const has_tuning_move = others.some((profile) => {
        if (profile.healthRating - default_profile.healthRating >= 0.3 - 1e-9) return true;
        if (profile.healthRating < default_profile.healthRating) return false;
        return Object.entries(profile.conditionRatings).some(
          ([condition, rating]) =>
            rating -
              default_profile.conditionRatings[
                condition as keyof typeof default_profile.conditionRatings
              ] >=
            0.5 - 1e-9,
        );
      });
      assert.ok(has_tuning_move, "no option is 0.3 higher or 0.5 higher on a condition");
    },
  );

  it("maps no source row at the same multiplier and components twice", () => {
    const keys = NUTRITION_CONTENT.profiles.map((profile) =>
      JSON.stringify([
        profile.provenance?.sourceFoodName,
        profile.provenance?.multiplier,
        profile.components ?? [],
      ]),
    );
    assert.equal(new Set(keys).size, keys.length);
  });

  it("withholds no limit nutrient without a stand-in and leaves none unreported in a new meal", () => {
    const limit_metrics = ["energyKcal", "saturatedFatG", "totalSugarG", "sodiumMg"] as const;
    // Meal profiles whose source leaves a limit nutrient unreported: four kept from 1.5.0
    // and gado gado's sugar, KNOWN_ISSUES (o).
    const unreported_allowed = new Set([
      "dish.oyster-omelette:totalSugarG",
      "dish.chap-chye:totalSugarG",
      "dish.roti-john:totalSugarG",
      "dish.kueh-pie-tee:totalSugarG",
      "dish.gado-gado:totalSugarG",
    ]);
    for (const profile of NUTRITION_CONTENT.profiles) {
      for (const metric of limit_metrics) {
        const value = profile.nutrients[metric];
        if (value.status !== "unavailable") continue;
        if (value.reason === "implausible-source") {
          const fence_reason = (profile.withheldReasons ?? []).find(
            (reason) => reason.includes(metric) && reason.includes("far-out fence"),
          );
          assert.equal(fence_reason, undefined, `${profile.id} ${metric} has no stand-in`);
        }
        if (value.reason === "not-reported" && profile.nutritionClass === "meal") {
          assert.ok(unreported_allowed.has(`${profile.id}:${metric}`), `${profile.id} ${metric}`);
        }
      }
    }
  });

  it("uses a Borrowed row only as an allowlisted later component of a composite", () => {
    for (const profile of NUTRITION_CONTENT.profiles) {
      assert.notEqual(profile.provenance?.sourceDataType, "Borrowed", profile.id);
      for (const [index, component] of (profile.components ?? []).entries()) {
        if (!BORROWED_COMPONENT_ALLOWLIST.has(component.foodName)) continue;
        assert.ok(index > 0, `${profile.id} leads with ${component.foodName}`);
      }
    }
    assert.deepEqual([...BORROWED_COMPONENT_ALLOWLIST], ["Cooked white rice"]);
  });
});

/**
 * The orderings and bounds the overall meal rating must keep (ADR 0009). They fix orderings
 * and bounds on displayed ratings, not the model's constants.
 */
describe("overall meal Health rating", () => {
  const profile_of = (dish_id: string, variant_id?: string) => {
    const profile = getNutritionProfile(dish_id, variant_id);
    assert.ok(profile, `${dish_id} ${variant_id ?? ""} must have a profile`);
    return profile;
  };
  const meals = NUTRITION_CONTENT.profiles.filter((profile) => profile.nutritionClass === "meal");
  type LimitMetric = "energyKcal" | "saturatedFatG" | "transFatG" | "sodiumMg" | "totalSugarG";
  const known_amount = (profile: (typeof meals)[number], metric: LimitMetric) => {
    const value = profile.nutrients[metric];
    if (value.status === "known") return value.value;
    return value.status === "trace" ? 0 : undefined;
  };
  const congee = profile_of("dish.chicken-congee");

  it("rates the owner's congee and char siew rice pair close together, both at 3.5 or above", () => {
    const char_siew_rice = profile_of("dish.char-siew-rice");
    assert.ok(congee.healthRating >= 3.5);
    assert.ok(char_siew_rice.healthRating >= 3.5);
    assert.ok(Math.abs(congee.healthRating - char_siew_rice.healthRating) <= 0.3 + 1e-9);
  });

  it("rates no meal holding a day's sodium above congee, and one holding 2,500 mg below it", () => {
    for (const profile of meals) {
      const sodium = known_amount(profile, "sodiumMg") ?? 0;
      if (sodium >= 2_000) assert.ok(profile.healthRating <= congee.healthRating, profile.id);
      if (sodium >= 2_500) assert.ok(profile.healthRating < congee.healthRating, profile.id);
    }
  });

  it("rates a meal holding two limit nutrients at two thirds of a day or more at 2.5 or below", () => {
    for (const profile of meals) {
      const shares = [
        (known_amount(profile, "energyKcal") ?? 0) / 2_000,
        ((known_amount(profile, "saturatedFatG") ?? 0) +
          (known_amount(profile, "transFatG") ?? 0)) /
          22,
        (known_amount(profile, "sodiumMg") ?? 0) / 2_000,
        (known_amount(profile, "totalSugarG") ?? 0) / 50,
      ];
      if (shares.filter((share) => share >= 2 / 3).length >= 2) {
        assert.ok(profile.healthRating <= 2.5, profile.id);
      }
    }
  });

  it("rates every meal at or above its lowest condition and at most 2.5 above it", () => {
    for (const profile of meals) {
      const lowest = Math.min(...Object.values(profile.conditionRatings));
      assert.ok(profile.healthRating >= lowest, profile.id);
      assert.ok(profile.healthRating <= lowest + 2.5, profile.id);
    }
  });

  // Swaps from "Healthy hawker eats" (OneHealth, JurongHealth, hosted by HealthHub): local
  // precedent, not an HPB guideline. The dessert pairs are the panel's inference (the source
  // names cheng tng and soya bean curd "with less sugar syrup" and no comparator), and the
  // last two pairs rest on profile data: the first option is lower on all four limit nutrients.
  const FRIED_NOODLES = [
    "dish.char-kway-teow",
    "dish.hokkien-prawn-mee",
    "dish.mee-goreng-mamak",
    "dish.beef-hor-fun",
  ];
  const SYRUP_DESSERTS = [
    "dish.ice-kacang",
    "dish.chendol",
    "dish.orh-nee",
    "dish.pulut-hitam",
    "dish.tau-suan",
    "dish.black-sesame-paste",
    "dish.green-bean-soup",
  ];
  const LOCAL_SWAPS: ReadonlyArray<readonly [string, string]> = [
    ["dish.mee-soto", "dish.mee-rebus"],
    ["dish.mee-soto", "dish.mee-goreng-mamak"],
    ...FRIED_NOODLES.map((dish_id) => ["dish.chicken-congee", dish_id] as const),
    ["dish.masala-thosai", "dish.roti-prata"],
    ["dish.masala-thosai:thosai-masala", "dish.roti-prata"],
    ["dish.yong-tau-foo:ytf-clear-mixed", "dish.yong-tau-foo:ytf-clear-fried"],
    ["dish.yong-tau-foo:ytf-clear-mixed", "dish.yong-tau-foo:ytf-laksa-mixed"],
    ...["dish.char-kway-teow", "dish.hokkien-prawn-mee", "dish.lor-mee", "dish.nyonya-laksa"].map(
      (dish_id) => ["dish.sliced-fish-soup:fish-soup-beehoon-no-milk", dish_id] as const,
    ),
    ...SYRUP_DESSERTS.flatMap((dish_id) => [
      ["dish.tau-huay", dish_id] as const,
      ["dish.cheng-tng", dish_id] as const,
    ]),
    ["dish.fish-porridge:fish-porridge-sliced", "dish.fish-porridge"],
    ["dish.fried-carrot-cake:carrot-cake-white", "dish.fried-carrot-cake"],
  ];
  const by_profile_id = (profile_id: string) => {
    const [dish_id, variant_id] = profile_id.split(":");
    return profile_of(dish_id, variant_id);
  };

  it("explains each meal's rating with parts built from the same values", () => {
    const limit_metric_of = {
      energy: "energyKcal",
      "saturated-fat": "saturatedFatG",
      sodium: "sodiumMg",
      sugar: "totalSugarG",
    } as const;
    for (const profile of NUTRITION_CONTENT.profiles) {
      const parts = profile.healthParts;
      if (profile.nutritionClass === "drink") {
        assert.equal(parts, undefined, profile.id);
        continue;
      }
      assert.ok(parts, profile.id);
      const blend = 0.5 * parts.nutrients + 0.5 * parts.conditions - parts.excess;
      const expected = Math.min(5, Math.max(1, blend));
      assert.ok(Math.abs(profile.healthRating - expected) <= 0.15 + 1e-9, profile.id);
      assert.equal(parts.excessNutrient === undefined, parts.excessDayShare === undefined);
      if (parts.excessNutrient === undefined || parts.excessDayShare === undefined) {
        assert.equal(parts.excess, 0, profile.id);
        continue;
      }
      assert.ok(Math.abs(parts.excess - (parts.excessDayShare - 1)) <= 0.06, profile.id);
      // An excess line quotes a precise share of a day, so the amount driving it must be
      // reported, not imputed; a future exception needs the card's "estimated" wording.
      const driving = profile.nutrients[limit_metric_of[parts.excessNutrient]];
      assert.equal(driving.status, "known", `${profile.id} ${parts.excessNutrient}`);
    }
    assert.deepEqual(NUTRITION_CONTENT.dailyReference, {
      energyKcal: 2_000,
      saturatedFatG: 22,
      sodiumMg: 2_000,
      totalSugarG: 50,
    });
  });

  it("keeps thirty local swap orderings", () => {
    assert.equal(LOCAL_SWAPS.length, 30);
  });

  it.each(LOCAL_SWAPS)("rates %s above %s", (lighter_id, heavier_id) => {
    assert.ok(by_profile_id(lighter_id).healthRating > by_profile_id(heavier_id).healthRating);
  });
});
