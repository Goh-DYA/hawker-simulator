# ADR 0008: Snack basis, edible-portion density and source plausibility rules

Status: Accepted; qualified nutrition review and Singapore cultural review pending

Extends [ADR 0007](0007-guideline-anchored-nutrition-ratings.md). The guideline-anchored model stands; this record changes its bases, references and source checks.

## Context

A four-member review panel of AI agents, each taking one perspective (clinical dietetics, nutrient-profiling methodology and data audit, Singapore food culture and consumers, and game economy), re-examined every rating, source row and price of content `1.4.0`. A chair agent ruled on each proposal. No qualified person sat on the panel. The panel found that the ADR 0007 model still let some readings through that its own references contradict:

- Desserts were rated as meals, so a 268 kcal ice kacang scored the obesity 5.0 of a light lunch, and dessert fibre offset dessert sugar.
- Density bands were read per 100 g of the whole serving, inedible bone and shell included, which flattered crab, wings and other bone-in dishes.
- The hypertension curve put no penalty on a serving below 1,000 mg of sodium, laxer than its own 1,500 mg daily reference.
- The obesity terms used the general 2,000 kcal day, unlike the other conditions, which use a stricter clinical reference.
- Refined starch earned no diabetes penalty while the carbohydrate stayed inside the meal budget.
- Fibre and protein credits could lift a heavy serving's condition rating.
- Some source rows held values that their own component rows disprove: a mee siam with less sugar than its gravy alone, kopi whose non-sugar carbohydrate departs from black coffee by 20 g, and a claypot rice with several times the calcium of any other rice dish.
- Three profiles summed or substituted rows that did not describe the dish (a Derived vegetarian chicken rice with a mass balance of 0.35, a 535 g roti prata set, and a laksa row whose energy fails its own gravy).

## Decision

1. **Rate desserts as snacks.** The dishes in `SNACK_RATED_DISH_IDS` (the manifest's eating-occasion list, tied by test to category `dessert`) compare their energy and sugar with 0.4 of a meal's share (`SNACK_SHARE_OF_MEAL`, from HPB's 200 kcal snack against its 500 kcal meal). Saturated fat, sodium, total fat and carbohydrate keep the meal curves. Desserts stay in the `meal` nutrition class, so intent fits are unchanged.
2. **Read density per 100 g of edible portion.** Each source row's serving is multiplied by its `Edible Portion` share, summed over a composite's parts. The edible amount is recorded in the profile's `ratingInputs`, which only the importer reads.
3. **Use stricter condition references.**
   - **Obesity:** 1,500 kcal a day (AHA/ACC/TOS 2013), so the penalty starts at 375 kcal and is full at 750 kcal.
   - **Hypertension:** the curve runs from none at 500 mg of sodium through 0.4 at 1,000 mg, 0.7 at 1,500 mg and 0.85 at 2,000 mg to full at 3,000 mg.
   - **Diabetes:** adds a carbohydrate-quality term, from none at a 10:1 carbohydrate-to-fibre ratio to full at 20:1, scaled from one 15 g exchange to the 45 g lower meal budget. Unavailable fibre stands in at 0.81 g per 100 g edible, the lower quartile of meal fibre density, for this ratio only, and earns no credit.
4. **Gate the credits.** A condition's credits shrink with the largest of that rating's own penalty fractions, so a credit can never rescue a heavy serving.
5. **Withhold implausible source values** in `tools/nutrition/plausibility.mjs`. Each rule is objective and documented, and no rule invents a number:
   - **Paired-component floor and fibre ceiling.** A dish cannot hold less of a nutrient than its own component row ("<dish> gravy", "(curry only)", "(rice only)"), nor more fibre than the component plus 3 g per 100 g (the EU "source of fibre" density) for the rest of the bowl.
   - **Drink-family base.** A kopi or teh order's non-sugar carbohydrate must stay within 4 g per 250 ml of its unsweetened, milk-free base.
   - **Extreme outlier.** A value above twice its source subgroup's far-out fence (Q3 + 3·IQR, per 100 g edible, for subgroups of at least 15 rows) is withheld.

   A withheld value is published as unavailable with the new reason `implausible-source`, with the finding in `withheldReasons`. The ratings use the rule's stand-in (the component floor, or the drink's carbohydrate less its base's non-sugar carbohydrate) when it has one, and otherwise the missing-value rules.
6. **Build composite profiles from exact rows.** Vegetarian chicken rice, the default roti prata set and nyonya laksa sum exact source rows with recorded multipliers in a new `components` field. Plain prata is scaled by the source's own dough ratio, and the milky fish soup variants map to their like-for-like fried-fish rows.
7. **Version the review.** `NUTRITION_REVIEW_REVISION` rises to 3, so saved recipe-variant choices reset once to the reviewed defaults.

## Consequences

- 88 of 116 profiles change rating. The overall mean moves from 2.56 to 2.47, and no dessert rates 5.0 for obesity. The top meal is popiah at 4.5 overall.
- The orderings the culture reviewer asked for now hold and are tested: tau huay above ice kacang above chendol, plain prata below egg prata in energy, kopi below kopi siu dai below kopi C, clear fish soup above milky, and poached chicken rice at or above roast.
- Five profiles show a withheld value as "not available" with the reason: mee rebus, mee siam, lor mee, kopi and claypot chicken rice.
- The new unavailable reason widens the set a save may carry without a schema version bump, because the save parser reads reasons through the same enumeration. The profile fields `withheldReasons`, `components` and `ratingInputs` are optional content fields, not saved state.
- Kept data limitations that no objective rule reaches are listed in [KNOWN_ISSUES.md](../KNOWN_ISSUES.md#open-nutrition-data-and-rating-issues).
- The thresholds were checked against their primary sources by the project's review panel, not by a qualified dietitian or against the gazetted regulation text. Qualified nutrition and cultural review remain release gates.
