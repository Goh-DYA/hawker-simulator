# Nutrition data and educational-use policy

Status: Implemented schema-v2 content contract with guideline-anchored ratings (review revision 3); source, clinical, and cultural review remain required before release

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

Three profiles are documented **composites**, the sum of exact rows with explicit multipliers, recorded in the profile's `components`:

- vegetarian chicken rice: the Lab flavoured chicken-rice rice (220 g) plus 70 g of the Lab mock chicken, because the Derived 'Vegetarian chicken rice' row reports 11 g of water in 290 g and fails mass balance;
- the roti prata set: two plain prata scaled to the dough of the Lab egg prata (39.87 g carbohydrate each) plus the Lab curry served with the source's two-piece set, 406 g; the single plain prata variant is scaled the same way to one egg-prata-sized piece (77 g), so one plain prata no longer outweighs one egg prata;
- laksa: the source's 'Laksa gravy' (361 g), the Derived thick beehoon bowl and one Lab fishcake (611 g), because the Lab 'Laksa' bowl held less than half the saturated fat of its own gravy.

The milky fish-soup variants use the fried-fish Lab pair ('Fried fish beehoon soup (with milk)', 'Fried fish soup (with milk)'), so each milky bowl has a like-for-like clear partner.

Serving labels read "<count> <noun> (<amount> <unit>)", such as "1 bowl (811 g)"; source labels like "1 bowl(s) = 811g" are rewritten, curated labels are kept, and every amount is rounded to one decimal place. A content test checks that each label states the rated amount.

`NUTRITION_REVIEW_REVISION` in `tools/nutrition/manifest.mjs` is part of the generated `dataVersion` (`sg-<food>-<guidelines>-r3`). Raising it when the mappings or the rating model change resets saved recipe-variant choices to the reviewed defaults through the runtime's `nutritionDataVersion` check.

## Rating methodology

All ratings use a 1.0-5.0 scale rounded to one decimal place.

`starRating` is independent of nutrition and is calculated from authored dish quality and base demand: `1 + 4 x (0.65 x quality + 0.35 x demand)`. Quality and demand are authored from Singapore popularity and taste reputation, not from nutrition.

The Health and condition ratings rate each serving on its own against fixed, guideline-based amounts, in `tools/nutrition/ratings.mjs` ([ADR 0007](../decisions/0007-guideline-anchored-nutrition-ratings.md), extended by [ADR 0008](../decisions/0008-snack-basis-edible-density-and-source-plausibility.md)). A rating never depends on which other dishes are on the menu. Each released profile carries its `ratingInputs` (the edible amount of the serving and any stand-ins for withheld values), so the ratings can be recomputed from the generated JSON alone.

### Meals

Each limit nutrient gets a penalty from 0 to 1: the worse of its per-serving dose and its density per 100 g.

- **Per serving**, against one meal's share (a third) of a general adult daily reference value: no penalty up to half a meal's share, 0.5 at one meal's share, 0.9 at two and 1 at the whole day. The references are 2,000 kcal energy (HPB's 1,800-2,200 kcal adult averages), under 2,000 mg sodium (WHO, HPB), saturated plus trans fat under 10% of energy (22 g; WHO, HPB), total fat at most 35% of energy (78 g; HPB) and sugar under 10% of energy (50 g; WHO, HPB). Energy has its own curve: no penalty up to HPB's 500 kcal lower-calorie meal, 0.5 at 667 kcal and 1 at 1,000 kcal.
- **Per 100 g of the edible portion** (the source's `Edible Portion` share of the serving, which matters for bone-in chicken and crab), against the UK FSA front-of-pack bands (fat 3-17.5 g, saturated fat 1.5-5 g, total sugar 5-22.5 g, sodium 120-600 mg) and the WCRF/AICR energy-density band (125-275 kcal): no penalty at the low threshold and 0.75 at the high one, so density alone never takes the full penalty.

The **overall Health rating** starts at five stars and takes off one star per limit nutrient (energy, saturated plus trans fat, sodium, sugar) at its full penalty, plus the worst of the four once more, so a single nutrient at a full day's limit costs two stars instead of being averaged away. In the overall rating only, a penalty keeps rising past the full penalty, to 1.25 at one and a half times that amount. Fibre and protein add credits: fibre up to half a star (full credit at the EU "high fibre" 6 g per 100 g or 3 g per 100 kcal), and protein up to a quarter star (none at 10% of energy, full at the EU "high protein" 20%). The credits are per 100 g or per unit of energy, so a larger serving can never rate higher, and they shrink as the penalties grow.

**Desserts are rated as snacks.** Ice kacang, chendol, tau huay and pulut hitam (`SNACK_RATED_DISH_IDS` in the manifest, which a test ties to the dishes in the `dessert` category) are an extra eating occasion, so their energy and sugar are held to 0.4 of a meal's share, HPB's 200 kcal snack against its 500 kcal meal: no energy penalty up to 200 kcal, half at 267 kcal and full at 400 kcal. Saturated fat, sodium, total fat and carbohydrate keep the meal curves.

Each **condition rating** swaps in the stricter references that clinical guidance sets for its key nutrients:

| Condition | Key terms (stars at full penalty) | Evidence |
|---|---|---|
| High cholesterol | saturated plus trans fat against 7% of energy (15.6 g a day): 3; energy 0.5; sugar 0.5; fibre credit 0.75 | ESC/EAS 2019 and AHA/ACC dietary guidance; Singapore lipid guidance on saturated fat and fibre |
| Obesity | energy against a 1,500 kcal energy-reduced day (none to 375 kcal, half at 500 kcal, full at 750 kcal; a snack keeps the snack curve): 2.75; total fat 0.5; sugar 0.75; fibre 0.5 and protein 0.25 credits | AHA/ACC/TOS 2013 energy-reduced intake (1,200-1,500 kcal for women, 1,500-1,800 kcal for men); HPB 500 kcal lower-calorie meals; WCRF energy density; WHO free sugars |
| Diabetes | carbohydrate per meal (none to 45 g, 0.25 at 60 g, full at 120 g, or by density): 2.5; carbohydrate quality (none at a 10:1 carbohydrate-to-fibre ratio, full at 20:1, scaled from one 15 g exchange to the 45 g budget, and shrinking as the carbohydrate penalty grows): 1; sugar against 5% of energy (25 g a day): 2; energy 0.5; saturated fat 0.5; fibre credit 0.75 | Conventional carbohydrate counting (three to four 15 g exchanges a meal, as in HealthHub and ADA practice; the 45-60 g budget is not an HPB figure); AHA 10:1 whole-grain criterion; ADA Standards of Care 2025 section 5; WHO 2015 conditional 5% free-sugar limit |
| Hypertension | sodium against the 1,500 mg a day ideal (none at 500 mg a serving, 0.4 at 1,000 mg, 0.7 at 1,500 mg, 0.85 at 2,000 mg, full at 3,000 mg): 4; saturated fat 0.5; fibre credit 0.5 | AHA ideal 1,500 mg; DASH-Sodium; WHO under 2,000 mg |

A condition's credits shrink with the largest of that rating's own penalty fractions, so fibre and protein cannot rescue a serving that is heavy in any of them.

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
| Fibre unavailable, for the carbohydrate-quality ratio only | 0.81 g per 100 g edible, the lower quartile of meal fibre density; a reported trace counts as zero |
| Value withheld by a plausibility rule | Shown as not available. The ratings use the rule's stand-in (the component row's amount, or the drink family's sugar) or, without one, the rules above |
| `trace` | Zero; the thresholds start well above a trace amount, and the profile and interface still show `Trace` |
| Energy, saturated fat or carbohydrate unavailable, or not released | Neutral 3.0 |

### Source plausibility rules

The importer (`tools/nutrition/plausibility.mjs`) withholds a source value that an objective rule marks implausible. The value is published as unavailable with the `implausible-source` reason and the rule's finding in the profile's `withheldReasons`; no rule invents a number.

- **Paired-component floor.** A dish row that the source also analysed in part ("Mee siam" and "Mee siam gravy", "Plain prata (2 pc, with curry)" and its curry, and six more pairs) cannot hold less energy, protein, fat, saturated fat, carbohydrate, sugar or sodium than its own component row. A shortfall above both 1 g (50 mg of sodium) and 10% of the component is withheld, and the component's amount is the rating stand-in. It withholds the sugar of mee rebus and mee siam.
- **Fibre ceiling.** For the same pairs, dish fibre may not exceed the component's fibre plus 3 g per 100 g (the EU "source of fibre" level) for the rest of the dish; above that it is withheld with no stand-in. It withholds the fibre of mee rebus, mee siam and lor mee.
- **Drink family base.** A kopi or teh row's non-sugar carbohydrate must stay within 4 g per 250 ml of its unsweetened, milk-free base (Kopi O kosong, Teh O kosong). Otherwise its sugar is withheld, and the rating uses the carbohydrate minus the base's non-sugar carbohydrate (27.08 g for kopi), which restores the order kopi < kopi siu dai < kopi C.
- **Extreme outlier fence.** A value above twice the far-out fence (third quartile plus three interquartile ranges, per 100 g edible) of its source `Food Subgroup`, in a subgroup with at least 15 values, is withheld with no stand-in. It withholds claypot chicken rice calcium.

These weights and thresholds are an in-game educational model, not an HPB formula, a Nutri-Grade label for food, or a certification. Their rationale follows official guidance about [carbohydrate and fibre for diabetes](https://www.healthhub.sg/programmes/diabetes-hub/understanding-carbohydrates), [dietary fat and fibre for hyperlipidemia](https://www.healthhub.sg/health-conditions/hyperlipidemia), [sodium and balanced eating for blood pressure](https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/what-to-eat-to-lower-blood-pressure), [nutrition-label choices for common health concerns](https://www.healthhub.sg/programmes/nutrition-hub/tools-and-resources/), and [adult dietary guidance on energy, fat, salt, sugar, and variety](https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/dietary_guidelines_adults), HealthHub's guidance on snacking, Nutri-Grade (HPB; MOH, 30 December 2022, extended to freshly prepared drinks from 30 December 2023), the UK front-of-pack guidance (November 2016), WCRF/AICR 2007, WHO sodium (2012), sugars (2015) and fat (2023) guidelines, ESC/EAS 2019, the 2017 ACC/AHA blood-pressure guideline, AHA/ACC/TOS 2013 and EU Regulation 1924/2006. The project's review panel of AI agents checked the thresholds against these primary sources; no qualified dietitian or the gazetted regulation text has confirmed them.

### Customer intents

Customer nutrition intents still rank servings relative to the other released servings of their class, because an intent models a guest choosing among what is offered. Intent fits are a game mechanic and are never shown as a rating.

## Guideline boundaries

The adult daily guideline block remains contextual in the interface: it is shown as general guidance and is not used as an individual target. The rating model alone divides the general daily references into one meal's share, as described above. In particular:

- total sugar is held to the free-sugar limit inside the ratings, because the source reports no added sugar; the interface still says that total sugar is not the same as added sugar;
- food water in grams is not compared with beverage-water guidance;
- cholesterol guidance is not compared directly because the food CSV has no cholesterol field;
- calcium and iron are shown but do not affect the ratings.

## Player-facing disclosure

> Hawker Balance is an educational game, not medical or dietary advice. Nutrition values describe the listed source serving; recipes and portions vary. Its 1-5 health and condition ratings compare each serving with a meal's share (for a dessert, a snack's share) of general daily guidance from Singapore's Health Promotion Board and the World Health Organization, and with stricter guidance for each condition: they are not diagnoses, treatment advice, Health Promotion Board certifications, or universal judgements. Daily reference ranges are general guidance for Singaporean adults and do not represent individual needs. Total sugar is not the same as added sugar.

## Review requirements

Before release, a qualified reviewer must verify source permissions, mappings, serving multipliers, variant names, nutrient units, rating weights and thresholds (including the transcription of the Nutri-Grade bands and the clinical references above), and the contextual guideline transcription. The data limitations that [KNOWN_ISSUES.md](../KNOWN_ISSUES.md#open-nutrition-data-and-rating-issues) keeps by decision need a corrected source or a reviewed replacement. Singapore cultural review must also check that recipe variants and visuals are recognisable without implying halal, vegetarian, allergy-safe, or other certification claims.
