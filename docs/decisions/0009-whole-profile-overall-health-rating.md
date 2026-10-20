# ADR 0009: Whole-profile overall Health rating for meals

Status: Accepted; qualified nutrition review and Singapore cultural review pending

Partly supersedes [ADR 0007](0007-guideline-anchored-nutrition-ratings.md) (the worst-nutrient double count); ADR 0007's guideline anchoring and [ADR 0008](0008-snack-basis-edible-density-and-source-plausibility.md)'s bases stand.

## Context

Under ADR 0007, a meal's overall Health rating started at five stars, took off one star per limit nutrient (energy, saturated plus trans fat, sodium, sugar) at its full penalty, and took off the worst of the four once more, "so a single nutrient at a full day's limit costs two stars instead of being averaged away". It read only those four nutrients and the fibre and protein credits, and ignored the four condition ratings the same profile carries.

The owner found the result over-strict and hard to explain, and asked for an overall rating that reads the whole nutrition profile, uses both the nutrient data and the condition ratings, drops the worst-nutrient double count and rests on evidence. The example: chicken congee rated 3.3 and char siew rice 3.7, although congee rates higher on three of the four conditions (high cholesterol 4.5 against 4.1, obesity 5.0 against 3.1, diabetes 4.2 against 2.6; hypertension 2.4 against 4.1). Across content `1.6.0`, 16 of the 147 meals rated below all four of their own condition ratings.

A five-member review panel of AI agents (a clinical dietitian, a nutrient-profiling methodologist, a Singapore food culture and consumer reviewer, a public-health evidence reviewer, and a game economist and player-experience lead) proposed, critiqued and voted on replacement models over four rounds, and a chair agent ruled on 76 proposals. No qualified dietitian, nutrition scientist or Singapore cultural reviewer sat on the panel.

## Decision

1. **Rate a meal (and a snack-rated dessert) overall as half a nutrient score and half a condition score, less a day excess**, in `tools/nutrition/ratings.mjs`. Every amount is the resolved serving amount, after the existing missing-value rules.

   ```
   // 1. Limit penalties: the existing ADR 0007/0008 curves, unchanged
   p_E, p_SF, p_Na, p_Sug = the worse of the per-serving and per-100 g-edible readings, each 0 to 1,
                            rising past the full penalty to 1.25 at 1.5 times that amount (overall only)
   Σ      = p_E + p_SF + p_Na + p_Sug                                      // 0 to 5

   // 2. Nutrient score: each limit nutrient counted once
   credit = (0.5·fibre + 0.25·protein) · (1 − min(1, Σ / 4))
   NS     = max(1, 5 − Σ + credit)                                         // floored at 1, not capped

   // 3. Condition score: the four condition ratings, unrounded
   CS     = (2/3)·mean(c) + (1/3)·min(c)                                   // = ½·lowest + ½·mean of the other three

   // 4. Day excess
   D      = max(kcal / 2,000, satTrans / 22, Na / 2,000, sugar / 50)
   X      = 1 · max(0, D − 1)                                              // no cap

   // 5. Health, clamped and rounded once
   Health = round1(clamp(0.5·NS + 0.5·CS − X, 1, 5))
   ```

   The displayed condition ratings stay as they were, each rounded on its own. Drinks, every condition rating, every intent fit, every curve, reference and imputation rule, and the snack basis are unchanged.

2. **Each constant has a stated basis.** Types: **G**, a guideline amount; **O**, outcome or dose-response evidence, for direction or shape only; **L**, local precedent; **D**, a design choice tested against the locked checks.

   | # | Constant (`tools/nutrition/ratings.mjs`) | Value | Status | Basis |
   |---|---|---|---|---|
   | 1 | `DAILY_REFERENCE` | energy 2,000 kcal; saturated plus trans fat 22 g; sodium 2,000 mg; total sugar 50 g (total fat 78 g, used only by obesity) | Unchanged | G. WHO 2012 sodium under 2,000 mg a day; WHO 2015 free sugars under 10% of energy, about 50 g at 2,000 kcal (total sugar stands in, because the source has no added sugar); WHO 2023 saturated fat at most 10% of energy (news release; the full guideline was not opened); 2,000 kcal energy reference (HPB; Codex NRV-NCD, partly verified, for energy only) |
   | 2 | `MEAL_SHARE`, `SNACK_SHARE_OF_MEAL` | ⅓; 0.4 (energy and sugar of snack-rated desserts) | Unchanged | D (ADR 0007); G: HPB's 200 kcal snack against its 500 kcal meal (ADR 0008) |
   | 3 | Serving curves | energy [500, 0], [667, 0.5], [1,000, 1]; the others from `build_meal_share_anchors` | Unchanged | G for the anchors (HPB's 500 kcal lower-calorie meal; a third of the day); D for the shape |
   | 4 | `DENSITY_BANDS` and the density curve | FSA low and high per 100 g edible, 0 to 0.75; energy 125 to 275 kcal | Unchanged | G: UK DH/FSA front-of-pack guide 2016, Table 2. WCRF/AICR energy density (secondary only). D: the 0.75 anchor |
   | 5 | `OVERALL_EXCESS_PENALTY` | amount ratio 1.5, penalty 1.25 | Kept | D |
   | 6 | `MEAL_RATING_WEIGHTS.overall.limitNutrient` | 1 each | Kept | O: the additive structure of the FSA/Ofcom model (Scarborough 2007; Arambepola 2008), FSAm-NPS/Nutri-Score (Deschasaux 2018, 2020; Merz 2024) and the HSR (Barrett 2024; Montericcio 2024). D: equal weights for the four nutrients HPB and WHO name |
   | 7 | `worstLimitNutrient` | removed (was 1) | Changed | The owner's request. No criterion-validated profiling system counts a nutrient twice (Barrett 2024). Reverses ADR 0007's rationale |
   | 8 | `MEAL_RATING_WEIGHTS.overall.fibre` | 0.5 × the fibre credit (per 100 g edible: 3 g → 0.5, 6 g → 1; per 100 kcal: 1.4 g → 0.5, 3 g → 1) | Unchanged | G: EU 1924/2006 "source of" and "high" fibre; 14 g per 1,000 kcal. O: direction (Reynolds 2019, moderate certainty). D: weight |
   | 9 | `MEAL_RATING_WEIGHTS.overall.protein` | 0.25 × the protein energy share (10% → 0, 20% → 1) | Unchanged | G: EU 1924/2006 "high protein" 20%. The 10% lower bound is an existing constant (HPB; not verified in this review). D: weight. Protein is the FSA lineage's stand-in for calcium and iron (Nutri-Score Scientific Committee 2022, §1.6) |
   | 10 | `MAX_OVERALL_MEAL_PENALTY` (the credit gate) | 4 (= 4 × `limitNutrient`; was 5) | Changed (derived) | D: the credits are gone once the four penalties together reach a full set, so credit cannot rescue a heavy serving |
   | 11 | Calcium and iron credit | 0 (the first proposal had 0.25) | Dropped | D: protein stands in for them (Nutri-Score Scientific Committee 2022); NRF performance fell as minerals were added (Fulgoni 2009); NRF9.3's diet-level association (Streppel 2014) is for a nine-nutrient index, not a two-mineral subset; 36 to 38 of 147 meals do not report them |
   | 12 | Nutrient-score bounds | floored at 1 in the blend; capped at 5 for display only | New | D: credits may still separate lean servings, as Nutri-Score's negative scores do. No released meal's nutrient score exceeds 5 (the highest is popiah at 4.994) |
   | 13 | `CONDITION_SCORE_WEIGHTS` | mean ⅔, lowest ⅓ | New | D only, tested over the weight grid below. It is not prevalence-weighted, which keeps demographics out. *Context, not basis:* the lowest condition is hypertension for 77 of 147 meals, consistent with sodium being the leading dietary risk (GBD 2017); the game spawns the four condition groups as equal quarters |
   | 14 | `OVERALL_BLEND` | nutrient score 0.5, condition score 0.5 | New | D. Equal weighting is common in composite indicators; the OECD/JRC handbook (2008, p. 31) warns that it "could disguise the absence of a statistical or an empirical basis", so it is recorded as a choice. 0.5 is the lowest nutrient share that keeps every family's default tunable at a lowest-condition share of ⅓ (0.45 fails chicken chop) |
   | 15 | Day share `D` | the largest of kcal/2,000, satTrans/22, Na/2,000 and sugar/50, on resolved amounts, for meals and snack-rated desserts alike | New | G: the day references in row 1. Below a full day, the rest of the day can still bring intake within the limit |
   | 16 | `OVERALL_DAY_EXCESS_STARS_PER_DAY` | 1, from D = 1.0, no cap | New | Shape (O): for sodium, which drives 46 of the 48 meals with an excess, the blood-pressure dose-response is linear with no flattening over 0.4 to 7.6 g a day (Filippini 2021; He 2013; Sacks 2001). Saturated fat (2 of 48), and sugar and energy (none today), rest on the guideline amount and the direction of effect only (Mensink, WHO 2016; no coefficient quoted). Start (G/D): the WHO/HPB day, and the earliest start that keeps every default tunable. Slope (D): continues the model's within-day rate, and is bounded above by the local mee soto swap (L; margin 0.491 at slope 1, about 0.1 at 1.5, inverted at 2) and by the condition-dominance inversion count, which rose from 11 to 20 at a slope of 1.5 in the panel's runs. The non-saturating LIM comparator below cannot set it |
   | 17 | `DENSITY_LINE` (card only) | density penalty at least 0.25 and at least 0.1 above the serving penalty | New | D: a third of the density curve's 0.75 maximum, and a visible lead over the serving reading. It fires on 29 meals |
   | 18 | Rounding | clamp to 1-5 and round to 0.1 once, at the end | Kept | D. Rounding the parts first would be off by 0.1 for 33 meals, so the card shows no "=" |
   | 19 | Drinks | Nutri-Grade bands | Unchanged | G: MOH Nutri-Grade |
   | 20 | `NUTRITION_REVIEW_REVISION` | 4 → 5 | Changed | Every meal re-rates, so saved recipe-variant choices reset once |

3. **The card explains the number.** The importer writes a `healthParts` object on every released meal profile (the nutrient score, the condition score and the excess to 0.1; the excess nutrient and its day share when a serving holds more than a full day of one; and the limit nutrients whose density set their penalty, with their amounts per 100 g), computed from the same unrounded values as the rating, and a top-level `dailyReference` with the four daily amounts, so `ratings.mjs` stays their single owner. The parts reach the interface through the runtime and never enter the core simulation or a save. The card and Help copy are in [NUTRITION_DATA.md](../design/NUTRITION_DATA.md#how-the-card-explains-the-rating).

4. **Plain thosai is the thosai family's default** (owner decision; see below).

5. **Version the review.** `NUTRITION_REVIEW_REVISION` rises to 5, so `dataVersion` becomes `sg-1bc212db6eda-c87987b4281c-r5` and saved recipe-variant choices reset once to the reviewed defaults. The content version rises to `1.7.0`. `PERSISTENT_SCHEMA_VERSION` (5) and `RUNTIME_SCHEMA_VERSION` (2) are unchanged.

## Documented properties

Synthetic anchors, frozen fixtures rated through the real `addHealthRatings` (`tests/tools/nutrition/ratings.test.ts` pins them). The lean serving is 350 g, 500 kcal, 25 g protein, 15 g fat, 3.67 g saturated fat, 65 g carbohydrate, 8.3 g sugar, 6 g fibre and 333 mg sodium; the on-budget serving holds one meal's share of each limit nutrient (400 g, 667 kcal, 7.33 g saturated fat, 16.7 g sugar, 667 mg sodium); each extra gram of saturated fat adds 9 kcal and 1 g of fat.

| Serving | Shown (unrounded) |
|---|---|
| Lean | 4.6 (4.5887) |
| On budget | 2.6 (2.5719) |
| Lean with ⅔, 1, 1.5, 2 and 3 days of sodium | 3.8, 3.5 (3.4960), 2.7, 2.2, 1.2 |
| Lean with 1 and 2 days of saturated fat | 3.1, 1.6 |
| On budget with 2 days of sodium | 1.0 (0.8956), against 2.2 for the lean serving with 2 days |

The rating keeps falling with each further day of sodium, with no plateau, but not at a constant slope. Measured on the lean serving, in stars per day of sodium:

| Sodium (mg) | 667-1,000 | 1,000-1,333 | 1,333-1,667 | 1,667-2,000 | 2,000-3,000 | 3,000-6,000 |
|---|---|---|---|---|---|---|
| Stars per day | 1.23 | 1.56 | 1.12 | 0.80 | 1.59 | 1.00 |

Between one and one and a half days, three terms stack: the 1.25 in-score excess, the hypertension rating reaching its floor at 3,000 mg, and the day excess.

**Robustness of the weights.** The cells name the families whose default would fail the tunable-default rule (the default rates strictly below another option, and some option is 0.3 higher overall or no lower and 0.5 higher on a condition). Nutrient share w runs down; lowest-condition share a runs across. The grid was re-run after the thosai decision below.

| w \ a | 0 | 0.25 | ⅓ | 0.5 |
|---|---|---|---|---|
| 0.40 | pass | chicken chop | ban mian, chicken chop | bak chor mee, chicken chop |
| 0.45 | pass | pass | chicken chop | bak chor mee |
| **0.50** | pass (but congee falls below Teochew fish dumpling soup) | pass | **pass (this model)** | thosai, chicken chop |
| 0.55 | pass | thosai | pass | pass |
| 0.60 | pass | thosai | thosai | pass |

Starting the day excess at ⅔ or 0.85 of a day fails bak chor mee, and at 0.9 fails chicken chop; 1.0 and 1.1 pass. The model sits on the lower edge of the safe region in w. w = 0.55 also passes at a = ⅓, but it gains no check, breaks the plain "half and half" Help sentence and moves 52 meals by 0.1, so 0.5 is kept and the default test guards the edge.

The lowest unrounded condition rating is hypertension for 77 meals, diabetes for 42, high cholesterol for 26 and obesity for 2.

## Validation

The nutrient half of the overall rating follows the additive structure of nutrient profiling systems that have criterion-validation evidence (Nutri-Score/FSAm-NPS, HSR, FSANZ NPSC; Barrett et al. 2024), anchored to WHO and HPB daily amounts. The condition half gives the lowest condition rating half its weight, a stated design choice with no front-of-pack precedent. The excess past a full day rests on dose-response physiology for sodium (Filippini et al. 2021), not on front-of-pack validation, because validated front-of-pack systems saturate. For saturated fat, sugar and energy, it rests on the daily guideline amount and the direction of effect only. The rating itself has not been validated against health outcomes, and its blend weights and slope are stated design choices. It describes one serving against daily guideline amounts for a general adult and is not dietary advice.

## Precedent

Outcome evidence is for additive scores: eight FSAm-NPS cohorts, against one each for the Chilean warning-label score and the HSR (Montericcio 2024). Non-compensatory designs (Singapore's Nutri-Grade worse-of grade for drinks, Chile's warning labels) rest on policy precedent, not on outcome studies.

## Calibration

Reported, not tuned to and not a validation claim. Spearman correlations over the 147 meals, before (content `1.6.0`) and after:

| Comparator | Before | After |
|---|---|---|
| FSA traffic lights (per 100 g; portion criteria only above 100 g) | 0.783 | 0.728 |
| FSA per-portion reds | 0.788 | 0.752 |
| Nutri-Score 2023 points (per 100 g; fruit, vegetable and legume share unknown, so 0 points) | 0.341 | 0.291 |
| LIM per serving (saturated fat/22 + sugar/50 + sodium/2,000, uncapped) | 0.832 | 0.877 |
| LIM plus energy/2,000 | 0.855 | 0.899 |
| Mean of the condition ratings | 0.958 | 0.964 |

The mean rating falls monotonically across the Nutri-Score grades (A 4.30, B 3.32, C 2.64, D 2.52, E 2.17) and across the FSA per-portion red counts (none 3.71, one 3.40, two 2.89, three 2.04). Both front-of-pack systems saturate by construction (a per-100 g grade; at most three reds), while this rating keeps penalising past their ceilings through portion size and the day excess, so its rank agreement with them is slightly lower and its agreement with the non-saturating per-serving LIM higher.

## Residuals

1. The slope is uneven between one and one and a half days (1.59 stars a day).
2. Carbohydrate weighs more through diabetes when diabetes is the lowest condition: an isocaloric rise from 45 to 105 g of carbohydrate costs 0.53 star. HPB's quarter-plate grains message was not re-verified.
3. The on-budget meal sits at 2.6, because the condition ratings use therapeutic references.
4. The rating describes one serving for a general adult; it is not dietary advice and is not validated as a whole.

## The thosai default (owner decision)

Under this model the family that then defaulted to masala thosai was the only one to break the tunable-default rule: masala thosai rated 3.8 (3.794 unrounded) and plain thosai, its rank-2 option, 3.7 (3.711). Plain thosai is lower on all four limit nutrients per serving (402 against 439 kcal, 4.4 against 6.3 g saturated plus trans fat, 501 against 1,070 mg sodium, 1.1 against 1.2 g sugar), but masala thosai rates higher overall through its sambar fibre (8.1 against 4.9 g) and its lower energy density (162 against 258 kcal per 100 g). No aggregation the panel tried and no third source row separates the two.

The panel proposed recording masala thosai as a closed exception in the default test. The owner chose instead to make plain thosai, the most common basic order, the default. The dish keeps its ID (`dish.masala-thosai`) but is named Thosai, maps to the plain 'Thosai' row (Lab, 1 piece, 156 g, served with chutney and sambar), lists masala thosai as the rank-2 option, and costs $3 under the street-price rule (plain thosai $2.50 at Rajarani, Daniel Food Diary, April 2026). All 23 families now pass the rule, and the test has no exception mechanism.

The two orders remain a trade, not a dominance: masala thosai lifts the obesity rating from 3.2 to 4.5 and the diabetes rating from 3.6 to 4.3, while plain thosai rates higher for hypertension (4.0 against 3.2) and high cholesterol (3.8 against 3.4). The overall margin, 0.083 unrounded, is the thinnest of the 23 families, so no copy may present either order as the lighter one.

## Local swap orderings

Thirty orderings are locked in `tests/content/nutrition-content.test.ts`, classed as **L**: they come from a dietitian article in JurongHealth's *OneHealth* ("Healthy hawker eats"), hosted by HealthHub, which is local precedent, not an HPB guideline. Two qualifiers: the 14 dessert pairs (tau huay and cheng tng above each of seven syrup desserts) are the panel's inference, because the source names cheng tng and soya bean curd "with less sugar syrup" and no comparator; and the last two pairs (sliced above fried fish porridge, white above black carrot cake) rest on profile data, because the first option is lower on all four limit nutrients. None failed under the previous model either; the thinnest margins are cheng tng above green bean soup (0.349) and mee soto above mee rebus (0.491).

## Alternatives rejected

- **The first whole-profile proposal as submitted**: a 0.25 calcium and iron credit, a nutrient score clamped at 5, a lowest-condition share of 0.25 and no excess term. Without the excess, a serving plateaued at 3.3 from one and a half days of sodium.
- **The mean of the condition ratings alone.** It doubled the meals rated 3.5 or above with a condition below 2.
- **A ceiling at the lowest condition plus two stars.**
- **A single-excess ceiling**, which left 24 condition-dominance inversions, against 9 under the adopted model, and inverted the local mee soto swap.
- **An excess on full-penalty amounts, or on energy over 1,000 kcal.** The rest of the day can still balance a serving below a full day's amount.
- **w = 0.55**, for the reasons above.

## Consequences

- Only the overall rating moves, on 136 of 147 meals. The meal mean rises from 2.32 to 2.74 and the range from 1.0-4.5 to 1.0-4.8. 43 meals rise by more than 0.5 (the largest by 0.8), 90 by 0.1 to 0.5, 11 are unchanged and 3 fall, all soups holding more than 1.6 days of sodium: mee soto 2.9 → 2.5, prawn noodle soup 2.7 → 2.6 and seafood tom yum ban mian 2.0 → 1.4. 88 meals rate below 3.0 (107 before) and 36 at 3.5 or above (17 before). The owner's pair rates 3.9 (congee) and 3.8 (char siew rice).
- Every meal now rates at or above its lowest condition rating and at most 2.5 above it, and no meal rates below all four.
- Drinks, every condition rating and intent fit, guest choices, satisfaction, objectives, XP and the core goldens are unchanged; guests read the condition ratings, not the overall.
- Saved recipe-variant choices reset once through the revision-5 `dataVersion`. No save schema changes; `healthParts` and `dailyReference` are content fields, not saved state.
- The content tests lock the owner's pair, the sodium order against congee, two limit nutrients at two thirds of a day, the bound against the lowest condition, the 30 local swaps and the consistency of `healthParts`; the kept data limitations are re-stated in [KNOWN_ISSUES.md](../KNOWN_ISSUES.md#open-nutrition-data-and-rating-issues).
- The panel's checks were made by AI agents. Qualified nutrition review and Singapore cultural review remain release gates.

## References

- Barrett EM, et al. Criterion validation of nutrient profiling systems: a systematic review and meta-analysis. *Am J Clin Nutr* 2024;119(1):145-63. PMID 37863430.
- Montericcio A, et al. Dietary indices underpinning front-of-pack nutrition labels and health outcomes: a systematic review and meta-analysis. *Am J Clin Nutr* 2024;119(3):756-68. PMID 38145705.
- Deschasaux M, et al. *BMJ* 2020;370:m3173. PMID 32938660. Deschasaux M, et al. *PLoS Med* 2018;15(9):e1002651. PMID 30226842.
- Scarborough P, et al. *Public Health Nutr* 2007;10(4):337-45. PMID 17362529. Arambepola C, et al. Validating a nutrient profile model. *Public Health Nutr* 2008;11(4):371-8. PMID 17605841.
- Merz B, et al. Nutri-Score 2023 update. *Nat Food* 2024;5(2):102-10. PMID 38356074. Nutri-Score Scientific Committee. Update report on the Nutri-Score algorithm, 2022.
- Fulgoni VL 3rd, Keast DR, Drewnowski A. *J Nutr* 2009;139(8):1549-54. PMID 19549759. Streppel MT, et al. *Eur J Clin Nutr* 2014;68(6):741-7. PMID 24642783. Drewnowski A. *J Am Coll Nutr* 2009;28(4):421S-6S. PMID 20368382.
- Liese AD, et al. The Dietary Patterns Methods Project. *J Nutr* 2015;145(3):393-402. PMID 25733454.
- Filippini T, et al. Blood pressure effects of sodium reduction: dose-response meta-analysis of experimental studies. *Circulation* 2021;143(16):1542-67. PMID 33586450. He FJ, Li J, MacGregor GA. *BMJ* 2013;346:f1325. PMID 23558162. Sacks FM, et al. DASH-Sodium. *N Engl J Med* 2001;344(1):3-10. PMID 11136953.
- GBD 2017 Diet Collaborators. *Lancet* 2019;393(10184):1958-72. PMID 30954305.
- Reynolds A, et al. Carbohydrate quality and human health. *Lancet* 2019;393(10170):434-45. PMID 30638909. Atkinson FS, et al. International tables of glycemic index and glycemic load values 2021. *Am J Clin Nutr* 2021;114(5):1625-32. PMID 34258626.
- WHO. Guideline: sodium intake for adults and children, 2012. WHO. Guideline: sugars intake for adults and children, 2015. WHO. Saturated fatty acid and trans-fatty acid intake for adults and children, 2023 (news release of 17 July 2023; the full guideline was not opened).
- Mensink RP. Effects of saturated fatty acids on serum lipids and lipoproteins. WHO, 2016 (direction only; coefficients not verified).
- OECD/JRC. Handbook on Constructing Composite Indicators, 2008, p. 31.
- UK DH/FSA. Guide to creating a front of pack nutrition label, 2016, Table 2. EU Regulation 1169/2011 Annex XIII Part A (claim levels only) and EU Regulation 1924/2006 Annex. FSANZ Standard 1.2.7 Schedule 5.
- MOH. National Nutrition Survey 2022 and National Population Health Survey 2022 (newsroom release; the full survey report was not opened).
- Foo L, with Mak E (dietitian, JurongHealth). "Healthy hawker eats". *OneHealth*, pp. 44-45, hosted by HealthHub (local precedent, not a guideline).
- Corvalán C, et al. *Obes Rev* 2019;20(3):367-74. PMID 30549191 (Chile's warning labels, as non-compensatory precedent only).

Unverified or secondary, and cited only as such: the HPB 10% protein lower bound, the WCRF/AICR energy-density bands, the Mensink coefficients, the full WHO 2023 guideline text, Codex NRV-NCD (energy only) and HPB's quarter-plate grains message.
