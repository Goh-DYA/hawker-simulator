# ADR 0007: Guideline-anchored nutrition ratings and realistic hawker servings

Status: Accepted; qualified nutrition review and Singapore cultural review pending. The overall meal formula is superseded by [ADR 0009](0009-whole-profile-overall-health-rating.md)

## Context

Content `1.3.0` rated each serving by its percentile rank, nutrient by nutrient, among the other released servings of its class, and averaged ten weighted ranks into the 1-5 Health rating. Review of the generated ratings found structural problems:

- Averaging ten percentiles pulled almost every meal towards 3.0: meals spanned only 2.0-4.0, and most sat between 2.6 and 3.6.
- Protein, calcium and iron were "higher is better" per serving, so a larger portion earned credit just for being larger, and a 100 g side could never win them.
- Unreported nutrients were dropped and the remaining weights renormalised, so a missing sugar value counted as average; `trace` counted as the best possible value.
- A rating depended on the rest of the menu: adding, removing or rescaling any one dish moved the ratings of about 26 others.
- Servings were not comparable: some dishes were 100 g serving-spoon scoops or a single 30 g dumpling, others 900 g bowls.

Nonya chap chye and babi pongteh, for example, both rated 3.3 overall, although babi pongteh carries about 2.6 times the saturated fat and 2.3 times the energy per 100 g. The data also mapped some dishes to implausible or mismatched rows: a 629 g fishball soup at 44 kcal, seven boiled yong tau foo pieces at 82 kcal, and the salted egg squid row standing in for grilled squid.

## Decision

1. **Rate each serving on its own against fixed guideline amounts**, in `tools/nutrition/ratings.mjs`.
   - A meal is compared with one meal's share (a third) of general adult daily reference values from HPB and WHO, and with UK FSA per-100 g density bands. The worse of the two views sets each limit nutrient's penalty.
   - The overall rating takes off a star per limit nutrient (energy, saturated plus trans fat, sodium, sugar) at its full penalty, and the worst of them once more. Credits for fibre and for protein's share of energy are measured per 100 g or per unit of energy, so a larger serving can never rate higher, and they shrink as the penalties grow.
   - Each condition rating swaps in stricter clinical references for its key nutrients: sodium 1,500 mg a day for hypertension (AHA and DASH), saturated fat under 7% of energy for high cholesterol (ESC/EAS and AHA/ACC), free sugar under 5% of energy and a 45-60 g carbohydrate budget per meal for diabetes (WHO, HealthHub and ADA carbohydrate counting), and energy-led terms for obesity (HPB's 500 kcal lower-calorie meal and WCRF energy density).
   - A drink is rated on Singapore's Nutri-Grade per-100 ml bands for sugar and saturated fat, plus its per-serving sugar and energy.
   - Missing values follow explicit, conservative rules: a meal's missing sugar is a quarter of its carbohydrate, a drink's is all of its carbohydrate, a meal's missing sodium is 450 mg per 100 g, missing trans fat is zero, and missing fibre or protein earns no credit.
2. **Serve what a customer buys.** Mappings scale per-piece or per-scoop rows to a hawker portion (a basket of four siew mai, 200 g Peranakan side plates, a quarter crab, five chwee kueh, a 250 ml teh tarik), remap implausible rows to complete-dish rows, and drop the yong tau foo boiled clear-soup variant, whose only source row is implausible. Mixed pieces become that family's default.
3. **Tighten the importer's energy cross-check** so that a row whose stated energy is below 75% of its macronutrient estimate is quarantined, rather than below 50%.
4. **Version the review.** `NUTRITION_REVIEW_REVISION` in the manifest is part of `dataVersion` (`sg-<food>-<guidelines>-r2`), so a mapping or method change resets saved recipe-variant choices to the reviewed defaults through the existing `nutritionDataVersion` check.

Customer intent fits stay relative, because an intent models a guest choosing among what the stall offers. They are a game mechanic, not a displayed rating.

## Consequences

- Ratings use the full 1.0-5.0 range. A dish's rating no longer changes when the menu changes, and a rating can be explained from the serving's own nutrients.
- Most hawker meals rate below 3.0 overall (the meal mean is about 2.5), because many exceed a meal's share of the sodium and saturated-fat guidance. That is the intended reading, not a defect.
- This reverses the earlier guideline boundary that daily guidance "is not divided into meal allowances". The daily guideline block remains contextual in the interface; the meal share is used only inside the rating model, and the disclosure says so.
- Saved recipe-variant choices reset once to the defaults when a save from an earlier data version loads, and a saved yong tau foo boiled-variant choice falls back to the mixed default. No core save shape changes.
- The ratings remain an educational model. They are not an HPB formula, a Nutri-Grade label for food, or medical advice. The thresholds and the transcription of the Nutri-Grade bands need qualified review before release.
