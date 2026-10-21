# Nutrition data and educational-use policy

Status: Implemented schema-v2 content contract with guideline-anchored ratings and a whole-profile overall meal rating (review revision 5); source, clinical, and cultural review remain required before release

## Purpose

Hawker Balance uses serving-level nutrition data to teach comparison and trade-offs inside a restaurant-management game. Every base dish and selectable recipe variant has its own CSV-derived profile. A dish also has two separate signals:

- `starRating` represents authored taste and popularity;
- `healthRating` and `conditionRatings` are comparative nutrition scores.

The condition ratings let fictional customers with high cholesterol, obesity, diabetes, or hypertension prefer different nutrient trade-offs. They do not diagnose a customer, prescribe a diet, certify a dish as healthy, or replace individual advice from a clinician or dietitian.

## Supplied source snapshot

Food profiles come from `food_nutrition_sgfoodid_combined_nutrition_subset.csv` (2,689 rows, SHA-256 `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`). The launch snapshot contains 91 released primary dish profiles and 23 reviewed variant families with 80 non-default variants, for 171 released profiles in total. Of the 171 primary source rows, 124 are Lab and 47 Derived. Counting every row a profile uses, composite parts included, the profiles use 128 Lab, 48 Derived and 4 Borrowed rows; the four Borrowed uses are the same plain rice (see the composites below).

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

A serving is what a customer buys at a hawker stall. A mapping that starts from a per-piece or serving-spoon row scales it with an explicit multiplier and serving label: four siew mai, five chwee kueh or kueh pie tee, ten satay sticks, three chicken wing pieces, a 200 g plate for the Peranakan braises, chap chye and oyster omelette, a quarter crab for black pepper crab and chilli crab (the source's alternative serving; chilli crab is scaled from its 177 g row to the CSV's own 384 g quarter), half of the sharing-size chicken, mushroom and cheese murtabak, half a chicken murtabak for the shared option (×0.5, 165 g), two appam (×2), ten mutton satay sticks (×10), and teh tarik scaled from its 150 ml small cup to the 250 ml cup of every other teh and kopi serving. A row that is internally implausible is not used: the fishball soup row (44 kcal and trace carbohydrate for seven fishballs) gives way to the complete fishball tang hoon bowl, the sliced fish soup row without milk (84 kcal against about 154 kcal from its own macronutrients) to the fried fish soup bowl, and the boiled clear-soup yong tau foo row (82 kcal and 5.7 g protein for seven stuffed pieces) is dropped. The appam, mutton satay and half-murtabak multipliers have no alternative serving in the CSV, so each mapping note gives the dated menu or plating evidence for its count.

Seven profiles are documented **composites**, the sum of exact rows with explicit multipliers, recorded in the profile's `components`:

- vegetarian chicken rice: the Lab flavoured chicken-rice rice (220 g) plus 70 g of the Lab mock chicken, because the Derived 'Vegetarian chicken rice' row reports 11 g of water in 290 g and fails mass balance;
- the roti prata set: two plain prata scaled to the dough of the Lab egg prata (39.87 g carbohydrate each) plus the Lab curry served with the source's two-piece set, 406 g; the single plain prata variant is scaled the same way to one egg-prata-sized piece (77 g), so one plain prata no longer outweighs one egg prata;
- laksa: the source's 'Laksa gravy' (361 g), the Derived thick beehoon bowl and one Lab fishcake (611 g), because the Lab 'Laksa' bowl held less than half the saturated fat of its own gravy;
- the four bak kut teh bowls, each served with rice as the usual hawker meal: the default is the Lab peppery 'Bak kut teh (soup)' bowl (row 1765, 574 g) plus 'Cooked white rice' (row 1422, Borrowed, the CSV's own 200 g bowl, no multiplier) plus half of the Lab 117 g 'You tiao' stick (833 g); "with rice, no you tiao" drops the you tiao (774 g; it keeps the old `bak-kut-teh-soup` variant ID, which now means soup with rice); and the herbal (row 1780) and dry (row 1764) bowls each add the same rice (702 g and 482 g).

**Borrowed rows.** No Borrowed row is used as a primary, as a single-row variant or as the main (first) component of a composite. A Borrowed single-ingredient component is allowed only when the CSV has no Lab, NIP or Derived row for that ingredient, the mapping note names it with its row, and [KNOWN_ISSUES.md](../KNOWN_ISSUES.md#data-limitations-kept-by-decision) lists it with its values (entry (q)). Plain cooked rice is the only such ingredient: row 1422 is the CSV's only plain cooked rice. The importer enforces the rule: `assert_borrowed_parts_allowed` in `tools/nutrition/importer.mjs` rejects a Borrowed row that is a profile's only part, its first part, or not in `BORROWED_COMPONENT_ALLOWLIST` in `tools/nutrition/manifest.mjs`, and `tests/content/nutrition-content.test.ts` checks that no released profile's primary row is Borrowed and that an allowlisted component is never first.

The milky fish-soup variants use the fried-fish Lab pair ('Fried fish beehoon soup (with milk)', 'Fried fish soup (with milk)'), so each milky bowl has a like-for-like clear partner.

Serving labels read "<count> <noun> (<amount> <unit>)", such as "1 bowl (811 g)"; source labels like "1 bowl(s) = 811g" are rewritten, curated labels are kept, and every amount is rounded to one decimal place. A content test checks that each label states the rated amount.

`NUTRITION_REVIEW_REVISION` in `tools/nutrition/manifest.mjs` is part of the generated `dataVersion` (`sg-<food>-<guidelines>-r<revision>`). It is 5 from content `1.7.0`, so `dataVersion` is `sg-1bc212db6eda-c87987b4281c-r5`. Raising it when the mappings or the rating model change resets saved recipe-variant choices to the reviewed defaults through the runtime's `nutritionDataVersion` check.

## Rating methodology

All ratings use a 1.0-5.0 scale rounded to one decimal place.

`starRating` is independent of nutrition and is calculated from authored dish quality and base demand: `1 + 4 x (0.65 x quality + 0.35 x demand)`. Quality and demand are authored from Singapore popularity and taste reputation, not from nutrition.

The Health and condition ratings rate each serving on its own against fixed, guideline-based amounts, in `tools/nutrition/ratings.mjs` ([ADR 0007](../decisions/0007-guideline-anchored-nutrition-ratings.md), extended by [ADR 0008](../decisions/0008-snack-basis-edible-density-and-source-plausibility.md) and [ADR 0009](../decisions/0009-whole-profile-overall-health-rating.md)). A rating never depends on which other dishes are on the menu. Each released profile carries its `ratingInputs` (the edible amount of the serving and any stand-ins for withheld values), so the ratings can be recomputed from the generated JSON alone.

### Meals

Each limit nutrient gets a penalty from 0 to 1: the worse of its per-serving dose and its density per 100 g.

- **Per serving**, against one meal's share (a third) of a general adult daily reference value: no penalty up to half a meal's share, 0.5 at one meal's share, 0.9 at two and 1 at the whole day. The references are 2,000 kcal energy (HPB's 1,800-2,200 kcal adult averages), under 2,000 mg sodium (WHO, HPB), saturated plus trans fat under 10% of energy (22 g; WHO, HPB), total fat at most 35% of energy (78 g; HPB) and sugar under 10% of energy (50 g; WHO, HPB). Energy has its own curve: no penalty up to HPB's 500 kcal lower-calorie meal, 0.5 at 667 kcal and 1 at 1,000 kcal.
- **Per 100 g of the edible portion** (the source's `Edible Portion` share of the serving, which matters for bone-in chicken and crab), against the UK FSA front-of-pack bands (fat 3-17.5 g, saturated fat 1.5-5 g, total sugar 5-22.5 g, sodium 120-600 mg) and the WCRF/AICR energy-density band (125-275 kcal): no penalty at the low threshold and 0.75 at the high one, so density alone never takes the full penalty.

The **overall Health rating** of a meal is half a nutrient score and half a condition score, less a day excess ([ADR 0009](../decisions/0009-whole-profile-overall-health-rating.md)). The nutrient score starts at five stars and takes off each limit nutrient's penalty (energy, saturated plus trans fat, sodium, sugar), each up to one star, and in this score only rising past its full penalty to 1.25 at one and a half times that amount; no nutrient counts twice. Fibre and protein add credits: fibre up to half a star (full credit at the EU "high fibre" 6 g per 100 g or 3 g per 100 kcal), and protein up to a quarter star (none at 10% of energy, full at the EU "high protein" 20%). The credits are per 100 g or per unit of energy, so a larger serving can never rate higher, and they shrink as the summed penalty grows, to none when all four are at their full penalty. The nutrient score is floored at one star. The condition score is two thirds the mean of the four unrounded condition ratings and one third the lowest, so the lowest condition counts as much as the other three together. A serving that holds more than a full day's amount of energy (2,000 kcal), saturated plus trans fat (22 g), sodium (2,000 mg) or sugar (50 g) loses one more star for each further day of its largest share, with no cap. The result is clamped to 1-5 and rounded once. Each meal profile carries the parts (`healthParts`) the card shows.

**Desserts are rated as snacks.** Ice kacang, chendol, tau huay and pulut hitam, and the five tong sui desserts (cheng tng, orh nee, tau suan, green bean soup and black sesame paste) (`SNACK_RATED_DISH_IDS` in the manifest, which a test ties to the dishes in the `dessert` category) are an extra eating occasion, so their energy and sugar are held to 0.4 of a meal's share, HPB's 200 kcal snack against its 500 kcal meal: no energy penalty up to 200 kcal, half at 267 kcal and full at 400 kcal. Saturated fat, sodium, total fat and carbohydrate keep the meal curves.

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

### Health reasons

The importer writes each released profile's main health reasons into its profile, from the same penalties and credits as its ratings (`select_health_reasons` in `tools/nutrition/ratings.mjs`), so the interface never recomputes them. A tooltip beside the Health rating lists them, and a top-level `dailyReference` (2,000 kcal, 22 g saturated fat, 2,000 mg sodium and 50 g total sugar, from `DAILY_REFERENCE`) gives the Help text its daily amounts. Unrated profiles carry no reasons, and their tooltip says "No reviewed nutrition data yet".

Each reason is a nutrient and a level:

- **A meal's limit nutrients** (energy, saturated plus trans fat, sodium, sugar): "More than a day's {nutrient}" when one serving holds more than the daily amount; "High in {nutrient}" from a penalty of 0.5 (a meal's share of the day per serving, or two thirds of the way from the FSA low to the FSA high band per 100 g edible); "Moderate {nutrient}" from 0.25; and "Low in {nutrient}" at no penalty (at most a sixth of the day per serving and in the FSA green band per 100 g). Desserts read energy and sugar on the snack basis.
- **A meal's carbohydrate**: "High in carbohydrate" from half the diabetes carbohydrate penalty (about 70 g in one serving, or 50 g per 100 g).
- **A meal's fibre and protein**: "Source of" and "High in" at the EU claim amounts (fibre 3 and 6 g per 100 g, or 1.4 and 3 g per 100 kcal; protein 12% and 20% of energy).
- **A drink's sugar and saturated fat**, the two nutrients that set its rating: "High in" in Nutri-Grade band D or with a meal's share of the day in one serving; "Low in" at most the EU low claim for a liquid (2.5 g sugar or 0.75 g saturated fat per 100 ml) with at most a sixth of the day in one serving; otherwise "Moderate".

A profile lists at most three reasons, concerns first: the gravest concerns (a full day first, then high, then moderate; a limit nutrient before carbohydrate), keeping one slot for a strength when it has one and two when it has only one concern. Strengths list fibre and protein claims first, then low sodium, sugar, saturated fat and energy. "Low" needs a reported amount (a trace counts); any other reason resting on a stand-in amount reads "Likely …" (kopi's withheld sugar: "Likely high in sugar").

Every rated profile carries two or three reasons (146 three, 25 two). The commonest first reason is sodium: high for 54 profiles and more than a day for 46. Examples: chicken congee "High in sodium, High in protein, Low in sugar"; char siew rice "High in sodium, High in carbohydrate, High in protein"; kopi-O kosong "Low in sugar, Low in saturated fat".

The tooltip's copy follows these rules: it names no score, weight, star, part or percentage; no "good", "bad", "healthy", "healthier", "light", "suited to" or "safe for"; no medical claim. The "Health rating by condition" disclosure lists the four condition ratings for meals and drinks alike. The Help text reads: "A meal's Health rating weighs one serving's energy, saturated fat, sodium and sugar against daily guideline amounts (2,000 kcal, 22 g, 2,000 mg and 50 g), counts its fibre and protein, and reflects how it suits each health condition. A drink's follows its sugar and saturated fat bands. The i beside a Health rating lists its main reasons. It describes one serving for a general adult and is not dietary advice."

The tooltip opens on hover or keyboard focus, stays open while the pointer is over it, and Escape hides it without closing the panel or dialog around it (WCAG 1.4.13). The button is named "Why this health rating" ("Why this personal health fit" on a guest's card) and described by the list.

### Customer intents

Customer nutrition intents still rank servings relative to the other released servings of their class, because an intent models a guest choosing among what is offered. Intent fits are a game mechanic and are never shown as a rating. Because they are relative, adding profiles re-ranks them: the 55 profiles added in content `1.6.0` re-ranked the intent fits of the existing profiles without changing a Health or condition rating, and the seeded starter probe's XP moved by −0.9% to +2.2% (still level 7 on day 5 and level 8 on day 7).

## Recipe variants and defaults

Content `1.7.0` has 23 reviewed variant families: kopi, teh tarik, nasi lemak, fried carrot cake, roti prata, fish bee hoon soup (`dish.sliced-fish-soup`), bak chor mee, chicken murtabak, chicken nasi briyani, thosai (`dish.masala-thosai`), yong tau foo, ban mian, bak kut teh, duck rice, prawn noodle soup, economic rice, nasi padang, mee siam, wanton mee, soya bean milk, chicken chop, fish and chips and fish porridge. Each option maps to its own source row (or, for bak kut teh, its own composite), and each is an order hawker diners actually place.

**Ranks are positional.** A variant unlocks at the stall-mastery rank given by its position in the family (`VARIANT_UNLOCK_RANKS` in `src/content/roster.ts`): the default (first) at rank 1, the second option at rank 2, the third at rank 4, and the fourth and later at rank 7. Adding or reordering an option therefore moves the ranks of the options after it.

**Star cannot separate variants, so "best" is the Health rating.** Every variant inherits its dish's quality, demand, price, preparation time and XP, so all options of a family share one Star rating and one price. A family's best option is the one with the highest overall Health rating.

**Every default can be tuned.** The default is the usual order, and in every family it rates strictly below another option, so a player always has a healthier choice to unlock. `tests/content/nutrition-content.test.ts` checks two parts on the displayed (rounded) ratings for every generated family:

1. The default's overall Health rating is strictly below some other option's.
2. Some option either rates at least 0.3 higher overall, or rates no lower overall and at least 0.5 higher on one condition rating.

All 23 families pass both parts under the whole-profile rating of review revision 5, with no exception. Four defaults moved to the usual order in content `1.6.0`; under revision 5 they rate: black carrot cake 2.2 (white carrot cake 3.2), fried fish bee hoon in clear soup 2.7 (sliced fish bee hoon in clear soup 3.4), yong tau foo in clear soup with bee hoon or rice 1.4 (pieces only 2.1) and bak kut teh with rice and half a you tiao 2.2 (with rice and no you tiao 3.3). In content `1.7.0` the thosai family's default became plain thosai (3.7), with masala thosai (3.8) as its rank-2 option: under revision 5 masala thosai, the earlier default, rated above every other option, and the owner chose plain thosai, the most common basic order, as the default rather than record a test exception ([ADR 0009](../decisions/0009-whole-profile-overall-health-rating.md#the-thosai-default-owner-decision)). Plain thosai rates higher for hypertension and high cholesterol, and masala thosai for obesity and diabetes, so neither order is presented as the lighter one. A default may also tie an option that is not the best one (teh tarik and chicken murtabak do).

Five families pass on a small overall margin. They are kept, because each is a real order and the dataset has no third row that separates them more clearly, but no copy or document may present their overall difference as meaningful; the difference by condition is:

| Family | Default | Best other option | Raw margin | Condition differences (displayed) |
|---|---|---|---:|---|
| Thosai | Plain, 3.7 | Masala, 3.8 | 0.083 | Masala: obesity +1.3, diabetes +0.7. Plain: hypertension +0.8, high cholesterol +0.4. The default since content `1.7.0` (owner decision, [ADR 0009](../decisions/0009-whole-profile-overall-health-rating.md#the-thosai-default-owner-decision)) |
| Chicken chop | Fries and coleslaw, 2.1 | Spaghetti, 2.2 | 0.089 | Spaghetti: high cholesterol +0.6, obesity +0.2. Default: diabetes +0.8, hypertension +0.4. Rests on 0 g sugar reports ([limitation (o)](../KNOWN_ISSUES.md#data-limitations-kept-by-decision)) |
| Ban mian | Soup, 2.7 | Vegetable, 2.8 | 0.110 | Vegetable: obesity +0.6. Soup: diabetes +0.3 |
| Bak chor mee | Dry, 3.3 | Soup, 3.5 | 0.152 | Soup: high cholesterol +1.4, diabetes +0.7. Dry: hypertension +0.4 |
| Economic rice | 1 veg, 1 meat, 2.7 | 1 veg, 1 fish, 3.1 | 0.388 | 1 veg, 1 fish: obesity +0.6, diabetes +0.6, hypertension +0.4, high cholesterol +0.3. Portion-sensitive: 0.015 with the default's energy, fat, saturated fat, carbohydrate, sugar and sodium scaled to 0.9× |

Other values near a test threshold or a display edge, which no copy, objective, document or test may quote as their rounded neighbour:

| Kind | Values (unrounded) |
|---|---|
| The owner's pair | chicken congee 3.871, char siew rice 3.758 |
| Sodium order against congee | Teochew fish dumpling soup 3.831 against congee 3.871 (margin 0.040) |
| Thinnest local swaps | cheng tng above green bean soup 0.349; mee soto above mee rebus 0.491 (the bound on the excess slope) |
| Synthetic anchors | the lean serving 4.5887 (the test requires at least 4.5); the lean serving with a day's sodium 3.4960 (shown 3.5; the test uses at most 3.6) |
| Within 0.005 of a display edge | aglio olio 4.2498; spaghetti bolognese 2.7500; gado gado 2.6492; you tiao 2.5501; duck rice 2.9467; duck noodles dry 3.3541; bak kut teh 2.1540; ban mian dry 2.6466; thosai with cheese 2.7486; yong tau foo clear mixed 2.0501; murtabak vegetable 1.9549; nasi lemak with chicken cutlet 1.8524; grilled fish set 2.7459; chwee kueh 4.5472; tau huay 4.4460; chap chye 4.2534 |

**No rounding-edge picks.** A displayed rating is rounded to one decimal place, so a dish shown at 3.5 may sit just below it. Ice kacang shows 3.5 from a raw 3.464, bak chor mee soup from 3.477 and rawa thosai from 3.485; none may be cited as a 3.5 pick in copy, objectives or documentation.

## Guideline boundaries

The adult daily guideline block remains contextual in the interface: it is shown as general guidance and is not used as an individual target. The rating model alone divides the general daily references into one meal's share, as described above. In particular:

- total sugar is held to the free-sugar limit inside the ratings, because the source reports no added sugar; the interface still says that total sugar is not the same as added sugar;
- food water in grams is not compared with beverage-water guidance;
- cholesterol guidance is not compared directly because the food CSV has no cholesterol field;
- calcium and iron are shown but do not affect the ratings;
- the day excess compares total sugar with the 50 g free-sugar limit, and saturated plus trans fat with the 22 g saturated-fat limit; WHO sets trans fat (at most 1% of energy) separately.

## Player-facing disclosure

> Hawker Balance is an educational game, not medical or dietary advice. Nutrition values describe the listed source serving; recipes and portions vary. Its 1-5 health and condition ratings compare each serving with a meal's share (for a dessert, a snack's share) of general daily guidance from Singapore's Health Promotion Board and the World Health Organization, and with stricter guidance for each condition: they are not diagnoses, treatment advice, Health Promotion Board certifications, or universal judgements. Daily reference ranges are general guidance for Singaporean adults and do not represent individual needs. Total sugar is not the same as added sugar.

## Review requirements

For content `1.6.0`, a five-member review panel of AI agents (a clinical dietitian, a methodologist and data auditor, a Singapore food culture reviewer, a game economist and an art and integration lead) re-scrutinised every new and changed mapping, serving, variant option and default, and a chair ruled on 140 proposals. Like the earlier panel, it is internal review by AI agents, not a qualified dietitian's or a Singapore cultural reviewer's sign-off.

For content `1.7.0`, a third panel of five AI agents (a clinical dietitian, a nutrient-profiling methodologist, a Singapore food culture and consumer reviewer, a public-health evidence reviewer and a game economist) and a chair ruled on 76 proposals for the whole-profile overall rating of [ADR 0009](../decisions/0009-whole-profile-overall-health-rating.md). It is not a qualified sign-off either.

Before release, a qualified reviewer must verify source permissions, mappings, serving multipliers, variant names, nutrient units, rating weights and thresholds (including the transcription of the Nutri-Grade bands and the clinical references above), and the contextual guideline transcription. The data limitations that [KNOWN_ISSUES.md](../KNOWN_ISSUES.md#open-nutrition-data-and-rating-issues) keeps by decision need a corrected source or a reviewed replacement. Singapore cultural review must also check that recipe variants and visuals are recognisable without implying halal, vegetarian, allergy-safe, or other certification claims.
