# Nutrition data and educational-use policy

Status: Implemented schema-v2 content contract with guideline-anchored ratings (review revision 2); source, clinical, and cultural review remain required before release

## Purpose

Hawker Balance uses serving-level nutrition data to teach comparison and trade-offs inside a restaurant-management game. Every base dish and selectable recipe variant has its own CSV-derived profile. A dish also has two separate signals:

- `starRating` represents authored taste and popularity;
- `healthRating` and `conditionRatings` are comparative nutrition scores.

The condition ratings let fictional customers with high cholesterol, obesity, diabetes, or hypertension prefer different nutrient trade-offs. They do not diagnose a customer, prescribe a diet, certify a dish as healthy, or replace individual advice from a clinician or dietitian.

## Supplied source snapshot

Food profiles come from `food_nutrition_sgfoodid_combined_nutrition_subset.csv` (2,689 rows, SHA-256 `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`). The launch snapshot contains 67 released primary dish profiles and 14 reviewed variant families, for 116 released profiles in total.

Raw CSV files and machine-specific paths are not committed. Generated provenance stores only the source filename, file hash, row number and name, canonical row hash, mapping method, serving multiplier, source type, and review note. Mappings are exact and authored; runtime fuzzy matching is prohibited.

When only the food CSV is available, regenerate profiles while retaining the reviewed immutable guideline block:

```powershell
node tools/nutrition/importer.mjs `
  --food data/food_nutrition_sgfoodid_combined_nutrition_subset.csv `
  --preserve-guidelines-from src/content/nutrition.generated.json
```

The importer checks that the retained guideline snapshot ID matches its SHA-256 prefix and that its row count matches the 11 retained guideline records. Supply `--guidelines <path>` instead when deliberately reviewing a new guideline source.

## Value semantics

Every nutrient is represented as one of:

- `known`: a finite, non-negative measured or reported value;
- `trace`: explicitly reported as a trace amount and always displayed as `Trace` rather than a measured zero;
- `unavailable`: missing, invalid, quarantined, or not defensibly mapped.

The importer rejects or quarantines invalid servings, non-finite or negative values, fat subtypes above total fat, sugar or fibre above carbohydrate, implausible nutrient mass, and extreme values that need manual review.

## Servings

A serving is what a customer buys at a hawker stall. A mapping that starts from a per-piece or serving-spoon row scales it with an explicit multiplier and serving label: four siew mai, five chwee kueh or kueh pie tee, ten satay sticks, three chicken wing pieces, a 200 g plate for the Peranakan braises, chap chye and oyster omelette, a quarter crab (the source's alternative serving), half of the sharing-size chicken, mushroom and cheese murtabak, and teh tarik scaled from its 150 ml small cup to the 250 ml cup of every other teh and kopi serving. A row that is internally implausible is not used: the fishball soup row (44 kcal and trace carbohydrate for seven fishballs) gives way to the complete fishball tang hoon bowl, the sliced fish soup row without milk (84 kcal against about 154 kcal from its own macronutrients) to the fried fish soup bowl, and the boiled clear-soup yong tau foo row (82 kcal and 5.7 g protein for seven stuffed pieces) is dropped, so mixed pieces are that family's default.

`NUTRITION_REVIEW_REVISION` in `tools/nutrition/manifest.mjs` is part of the generated `dataVersion` (`sg-<food>-<guidelines>-r2`). Raising it when the mappings or the rating model change resets saved recipe-variant choices to the reviewed defaults through the runtime's `nutritionDataVersion` check.

## Rating methodology

All ratings use a 1.0-5.0 scale rounded to one decimal place.

`starRating` is independent of nutrition and is calculated from authored dish quality and base demand: `1 + 4 x (0.65 x quality + 0.35 x demand)`. Quality and demand are authored from Singapore popularity and taste reputation, not from nutrition.

The Health and condition ratings rate each serving on its own against fixed, guideline-based amounts, in `tools/nutrition/ratings.mjs` ([ADR 0007](../decisions/0007-guideline-anchored-nutrition-ratings.md)). A rating never depends on which other dishes are on the menu.

### Meals

Each limit nutrient gets a penalty from 0 to 1: the worse of its per-serving dose and its density per 100 g.

- **Per serving**, against one meal's share (a third) of a general adult daily reference value: no penalty up to half a meal's share, 0.5 at one meal's share, 0.9 at two and 1 at the whole day. The references are 2,000 kcal energy (HPB's 1,800-2,200 kcal adult averages), under 2,000 mg sodium (WHO, HPB), saturated plus trans fat under 10% of energy (22 g; WHO, HPB), total fat at most 35% of energy (78 g; HPB) and sugar under 10% of energy (50 g; WHO, HPB). Energy has its own curve: no penalty up to HPB's 500 kcal lower-calorie meal, 0.5 at 667 kcal and 1 at 1,000 kcal.
- **Per 100 g**, against the UK FSA front-of-pack bands (fat 3-17.5 g, saturated fat 1.5-5 g, total sugar 5-22.5 g, sodium 120-600 mg) and the WCRF/AICR energy-density band (125-275 kcal): no penalty at the low threshold and 0.75 at the high one, so density alone never takes the full penalty.

The **overall Health rating** starts at five stars and takes off one star per limit nutrient (energy, saturated plus trans fat, sodium, sugar) at its full penalty, plus the worst of the four once more, so a single nutrient at a full day's limit costs two stars instead of being averaged away. In the overall rating only, a penalty keeps rising past the full penalty, to 1.25 at one and a half times that amount. Fibre and protein add credits: fibre up to half a star (full credit at the EU "high fibre" 6 g per 100 g or 3 g per 100 kcal), and protein up to a quarter star (none at 10% of energy, full at the EU "high protein" 20%). The credits are per 100 g or per unit of energy, so a larger serving can never rate higher, and they shrink as the penalties grow.

Each **condition rating** swaps in the stricter references that clinical guidance sets for its key nutrients:

| Condition | Key terms (stars at full penalty) | Evidence |
|---|---|---|
| High cholesterol | saturated plus trans fat against 7% of energy (15.6 g a day): 3; energy 0.5; sugar 0.5; fibre credit 0.75 | ESC/EAS 2019 and AHA/ACC dietary guidance; Singapore lipid guidance on saturated fat and fibre |
| Obesity | energy 2.75; total fat 0.5; sugar 0.75; fibre 0.5 and protein 0.25 credits | HPB 500 kcal lower-calorie meals; WCRF energy density; WHO free sugars |
| Diabetes | carbohydrate per meal (none to 45 g, 0.25 at 60 g, full at 120 g, or by density): 2.5; sugar against 5% of energy (25 g a day): 2; energy 0.5; saturated fat 0.5; fibre credit 0.75 | HealthHub carbohydrate exchanges and ADA carbohydrate counting; WHO 2015 conditional 5% free-sugar limit |
| Hypertension | sodium against the 1,500 mg a day ideal (none at 500 mg a serving, 0.85 at 2,000 mg, full at 3,000 mg): 4; saturated fat 0.5; fibre credit 0.5 | AHA ideal 1,500 mg; DASH-Sodium; WHO under 2,000 mg |

A condition's credits shrink with its key penalty, so fibre cannot rescue a serving that already carries a full day of the condition's key nutrient.

### Drinks

A drink is rated on Singapore's Nutri-Grade per-100 ml bands (MOH 2022): the worse of its sugar (A up to 1 g, B up to 5 g, C up to 10 g) and saturated fat (A up to 0.7 g, B up to 1.2 g, C up to 2.8 g) grade, mapped to 0, 1/3 and 2/3 at the A, B and C boundaries and rising to 1 past D. The overall rating takes off 3.5 stars at the worst grade and up to half a star for the serving's sugar against a meal's share of 50 g. The condition ratings add per-serving terms: saturated fat against 15.6 g for high cholesterol, energy (full at 200 kcal, a tenth of the day) for obesity, sugar (none at 5 g, full at 25 g) for diabetes, and sodium against 1,500 mg for hypertension. Nutri-Grade itself grades total sugar, so total sugar is the regulatory convention for drinks.

### Missing and trace values

| Case | Rule |
|---|---|
| Sugar unavailable for a meal | A quarter of its carbohydrate, rounded up from the upper quartile (0.22) of the sugar share among meals that report sugar |
| Sugar unavailable for a drink | All of its carbohydrate |
| Sodium unavailable for a meal | 450 mg per 100 g, the upper quartile of meal sodium density |
| Sodium unavailable for a drink | No sodium penalty |
| Trans fat unavailable | Zero, since Singapore banned partially hydrogenated oils in 2021 |
| Fibre or protein unavailable | No credit |
| `trace` | Zero; the thresholds start well above a trace amount, and the profile and interface still show `Trace` |
| Energy, saturated fat or carbohydrate unavailable, or not released | Neutral 3.0 |

These weights and thresholds are an in-game educational model, not an HPB formula, a Nutri-Grade label for food, or a certification. Their rationale follows official guidance about [carbohydrate and fibre for diabetes](https://www.healthhub.sg/programmes/diabetes-hub/understanding-carbohydrates), [dietary fat and fibre for hyperlipidemia](https://www.healthhub.sg/health-conditions/hyperlipidemia), [sodium and balanced eating for blood pressure](https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/what-to-eat-to-lower-blood-pressure), [nutrition-label choices for common health concerns](https://www.healthhub.sg/programmes/nutrition-hub/tools-and-resources/), and [adult dietary guidance on energy, fat, salt, sugar, and variety](https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/dietary_guidelines_adults).

### Customer intents

Customer nutrition intents still rank servings relative to the other released servings of their class, because an intent models a guest choosing among what is offered. Intent fits are a game mechanic and are never shown as a rating.

## Guideline boundaries

The adult daily guideline block remains contextual in the interface: it is shown as general guidance and is not used as an individual target. The rating model alone divides the general daily references into one meal's share, as described above. In particular:

- total sugar is held to the free-sugar limit inside the ratings, because the source reports no added sugar; the interface still says that total sugar is not the same as added sugar;
- food water in grams is not compared with beverage-water guidance;
- cholesterol guidance is not compared directly because the food CSV has no cholesterol field;
- calcium and iron are shown but do not affect the ratings.

## Player-facing disclosure

> Hawker Balance is an educational game, not medical or dietary advice. Nutrition values describe the listed source serving; recipes and portions vary. Its 1-5 health and condition ratings compare each serving with a meal's share of general daily guidance from Singapore's Health Promotion Board and the World Health Organization, and with stricter guidance for each condition: they are not diagnoses, treatment advice, Health Promotion Board certifications, or universal judgements. Daily reference ranges are general guidance for Singaporean adults and do not represent individual needs. Total sugar is not the same as added sugar.

## Review requirements

Before release, a qualified reviewer must verify source permissions, mappings, serving multipliers, variant names, nutrient units, rating weights and thresholds (including the transcription of the Nutri-Grade bands and the clinical references above), and the contextual guideline transcription. The source rows that [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) lists as implausible need a corrected source or a reviewed replacement. Singapore cultural review must also check that recipe variants and visuals are recognisable without implying halal, vegetarian, allergy-safe, or other certification claims.
