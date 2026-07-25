# Independent Gameplay, Healthcare, and Educational Review

Date: 2026-07-26
Status: Internal independent feature-and-risk review; not clinical, cultural, accessibility, or educational-efficacy approval

## Executive verdict

All original high-impact gameplay recommendations are implemented and supported by deterministic engineering evidence. Hawker Balance now has a coherent forecast-plan-serve-debrief loop, contextual preparation trade-offs, meal composition, social stories, isolated scenarios, mastery progression, SGD ledgers, and explicit recovery paths.

The result is a substantially stronger management game and a more active learning experience. Players predict, choose, observe consequences, and receive cause-linked feedback instead of mainly reading nutrition information after service. The five scenarios and twelve mastery contracts create a credible strategic arc without cash or experience rewards leaking into the main centre.

This review supports feature completeness and strategic coherence only. The game remains an educational prototype, not a clinically validated intervention. Clinical correctness, cultural acceptability, assistive-technology conformance, and measurable educational efficacy remain external release gates.

## Review scope and evidence

This review covered the integrated five-stage programme:

- service periods, drains, SGD economy, objectives, progression, and recovery;
- deterministic forecasts, preparation trade-offs, the guided first decision, and cause-coded debriefs;
- Combo Board meal composition, conservative nutrient aggregation, and partial-meal settlement;
- parties, recurring fictional regulars, neighbourhood events, and condition-identity separation;
- scenarios, medals, mastery contracts, meta progression, reset/import/export, and reward isolation;
- responsive captures at 1280 x 720, 1024 x 640, 800 x 720, and 390 x 844, plus 200% in-game text and combined containment evidence;
- nutrition provenance, missing/trace handling, serving interpretation, and condition-aware scoring.

The Stage 5 working-source gate passed 63 Vitest files and 546 tests, 17 content validations, two SSR assertions, typecheck, lint, both production builds, and whitespace validation. Thirty seeded economy runs reconciled to the cent and met the programme's operating-margin ranges. Real service witnesses prove every scenario medal tier and all twelve mastery targets reachable.

The reviewed Stage 5 source is commit `982a020bf0a44fddd28cacc0be6290b6b6664379`, privately published as the owner-only Hawker Balance review preview.

## Original review findings: implementation assessment

### Nutrition agency

Implemented. Planning now presents a deterministic, menu-neutral forecast; menu choices change visible coverage rather than the underlying audience. Feasible objectives, the optional predict-and-reveal guide, frozen serving terms, and debrief comparisons make nutrition part of player decisions.

### Variant dominance

Implemented. Preparations now resolve price, ingredient cost, preparation and serving time, Star appeal, demand, and nutrition fit. Orders snapshot these terms. Seeded comparison evidence gives each preparation at least one plausible winning context.

### Economy and progression

Implemented. Money is stored as integer SGD cents and displayed with explicit Singapore-dollar wording. Gross sales, ingredient costs, refunds, upkeep, contribution, objectives, and recovery are separated. Experience is decoupled from price, authored thresholds are authoritative, and legacy progression migration preserves valid advancement without retroactive rewards.

### Meal-level context

Implemented. The persisted three-slot Combo Board creates valid main-plus-side-or-drink meals, with no discount and at most two stall stops. Combined nutrition remains unavailable when a required component is unavailable, and Meal balance, intent fit, condition-aware game fit, and component changes remain separate.

### Service rhythm and drama

Implemented. Breakfast, lunch, tea, and evening have closed arrival cohorts and bounded drains. Seeded neighbourhood events, parties, regulars, forecasts, and service choices create changing operational stakes without altering chronic-condition probability.

### Customer variety and story

Implemented. Groups of up to six route as visible parties, reserve seating atomically, and split only through an explained fallback. Six recurring fictional regulars have persistent story steps. Condition-aware needs are independently resampled and never define a persona, event, appearance, neighbourhood, or regular identity.

### Feedback and onboarding

Implemented. Debriefs connect forecasts to matches, misses, waits, contribution, satisfaction causes, and unknown data. The guided first decision uses two real unlocked choices, asks for a prediction, reveals one benefit and one trade-off, and penalises neither answer.

### Replayability and endgame

Implemented. Five isolated scenarios have authored maps, seeds, starting SGD, unlocks, modifiers, save slots, and cosmetic-only medals. Twelve mastery templates rotate every seven days, freeze at acceptance, remain feasible with current unlocks, and award only titles or cosmetics.

### Readability and responsive behavior

Materially improved. The reported header, service-strip, catalogue, and bottom-action overlap is not reproduced in the reviewed captures. Challenge content owns its scroll region, confirmation dialogs contain and restore focus, and meaningful visible informational text is not below 0.75rem in the automated evidence.

Native 200% browser zoom, qualified screen-reader behavior, full keyboard review, contrast measurement, and assistive-technology testing remain unverified on the exact deployed artifact.

## Healthcare consultant assessment

### Strong safeguards

- The authoritative food CSV remains read-only, mappings are curated, and runtime fuzzy matching is prohibited.
- Exact source rows, servings, hashes, trace values, and unavailable values are preserved.
- Numeric ratings require the primary nutrient and at least 7,500 of 10,000 weighted known-data basis points.
- Missing or trace nutrients are not fabricated as zero.
- Health-related requests are separated from demographics, appearance, story identity, events, and neighbourhood themes.
- Copy repeatedly states that values are listed-serving, catalogue-relative, simplified in-game comparisons rather than treatment advice.

These are strong data-quality and harm-reduction controls. They do not clinically validate the scoring model.

### High-priority clinical interpretation risks

#### Diabetes model may imply carbohydrate avoidance

The current diabetes comparison treats lower total carbohydrate as directionally better. Singapore HealthHub guidance explains that carbohydrates are an important energy source and should remain part of a balanced eating plan; amount, type, fibre, serving context, and the rest of the meal matter. A lower-is-better total-carbohydrate score can therefore teach an unintended shortcut.

Recommendation: replace the total-carbohydrate direction with a reviewed model that considers serving context, carbohydrate amount and quality, fibre, added versus total sugar when available, and meal composition. Until qualified review approves that model, present concrete nutrient trade-offs rather than a diabetes-fit scalar.

#### Cholesterol model cannot represent fat replacement

The current comparison rewards lower total fat but cannot distinguish replacement of saturated or trans fat with mono- or polyunsaturated fat. HealthHub's hyperlipidaemia guidance emphasises this replacement and soluble fibre, not merely reducing all fat.

Recommendation: do not imply cholesterol suitability from total fat alone. Require defensible fat-composition data or present only the supported saturated-fat, trans-fat, fibre, and unavailable-data facts.

#### Completeness is not clinical validity

The 75% known-weight gate prevents unsupported precision, but it does not validate the weights, thresholds, the 3.5 match boundary, satisfaction modifiers, or relative ranking methodology.

Recommendation: require a registered dietitian or appropriately qualified Singapore nutrition professional to review every score definition, threshold, direction, explanation code, serving assumption, and player-facing effect before any clinical-accuracy claim.

### Authoritative-sounding score risk

Terms such as “Health rating,” “Meal balance,” condition-fit percentages, heart iconography, “matched,” and “missed” may imply greater medical authority than the underlying catalogue-relative heuristic warrants.

Recommendation:

- use “In-game nutrition comparison” consistently;
- prefer “request compatibility” over disease-fit percentages;
- show listed serving and data coverage before any scalar;
- lead explanations with one supported benefit, one trade-off, and any unavailable data;
- keep Star appeal and nutrition comparison visually and semantically separate;
- avoid treatment, prevention, diagnostic, or universally healthy/unhealthy wording.

### Condition representation and stigma

Independence from identity is a major improvement. However, randomly assigning named conditions to fictional people, or changing a regular's condition-aware need between visits, may still trivialise lived experience or resemble an epidemiological claim despite the disclaimer.

Recommendation: prefer anonymous visit goals such as “sodium-aware request,” “fibre-forward request,” or “smaller energy range” rather than depicting the character as having a condition. If named conditions remain, require lived-experience, sensitivity, and Singapore cultural review. Use respectful person-first language and avoid weight-blaming narratives.

## Educational-game assessment

### What the game now teaches well

- Planning before service and reading consequences afterward.
- Comparing an operational benefit with a nutrition or demand trade-off.
- Recognising that missing data should remain unknown.
- Seeing that a meal can differ from one component.
- Separating popularity from an in-game nutrition comparison.
- Revising a strategy through scenario medal explanations and mastery feedback.

The guided decision has a useful predict-reveal-reflect structure, and the debrief closes the decision loop. Scenarios provide authentic practice of management systems rather than detached quizzes.

### Remaining educational-efficacy gap

The game does not yet define measurable learning objectives or test transfer beyond its own scoring system. Recording an in-game match does not demonstrate that a learner can explain serving size, interpret missing data, compare unfamiliar foods, or retain the concept.

Recommended explicit learning objectives:

1. Interpret the listed serving used by a nutrient profile.
2. Compare two foods using one relevant nutrient and one limitation.
3. Distinguish total sugar from added sugar when the source supports that distinction.
4. Recognise trace and unavailable data without treating either as zero.
5. Explain why no dish is universally healthy or unhealthy.
6. Explain how a side, drink, portion, and preparation can change a meal comparison.
7. Transfer the comparison process to an unseen food pair.

Recommended assessment:

- optional prediction reasons rather than answer-only clicks;
- misconception checks with explanatory feedback;
- delayed recall after several service periods;
- transfer tasks using unfamiliar unlocked foods;
- representative learner testing that measures comprehension, retention, and transfer, not only engagement or completion.

The CDC's health-education framework emphasises clear objectives, developmentally appropriate learning experiences, skills practice, and assessment. WHO's digital-education review also cautions that effectiveness varies with learning objective, modality, pedagogy, population, and assessment method. The current engineering evidence does not establish those outcomes.

## Cultural, provenance, and narrative recommendations

- Add publisher, source URL, dataset version or publication date, retrieval date, licence or permission basis, guideline revision, and accountable review owner to the provenance record.
- Ask Singapore hawker-food reviewers to assess dish names, visuals, serving interpretations, preparation variants, meal roles, scenario framing, and any catalogue-relative hierarchy.
- Retain the existing cautions around halal, vegetarian, allergy-safe, and certification claims.
- Add a short post-scenario reflection that connects the operational lesson to the player's chosen strategy without presenting a moralised “correct food.”
- Give gallery keepsakes more distinctive visual presentation and optional display/equip choices; current rewards are mechanically correct but modest as long-term motivation.
- Improve discovery of horizontally off-screen mobile dock destinations and reduce the scroll cost of the challenge sheet at extreme combined scaling.

## Required external release gates

Before making healthcare, learning-outcome, accessibility, or cultural-approval claims:

1. Registered dietitian or appropriately qualified Singapore nutrition review.
2. Public-health or health-education specialist review of objectives and misconception risks.
3. Representative learner study covering comprehension, transfer, and delayed retention.
4. Lived-experience and Singapore cultural review of condition language, regulars, events, and food representation.
5. Signed-in exact-artifact critical-path browser smoke on the owner-only preview.
6. Exact-artifact screen-reader, keyboard, actual 200% browser zoom, contrast, cognitive-load, and reduced-motion testing.
7. Immutable production-artifact hash, payload-size, and archive provenance recording.
8. Dataset rights, versioning, source-refresh ownership, and guideline-review dates documented.
9. Production performance, offline restart/update, and storage-fault recovery validation.

No claim of treatment benefit, behaviour change, clinical accuracy, or educational effectiveness should be made until the relevant evaluation supports it.

## Authoritative references used for this review

- [HealthHub: Understanding carbohydrates](https://www.healthhub.sg/programmes/diabetes-hub/understanding-carbohydrates)
- [HealthHub: Healthy eating with diabetes](https://www.healthhub.sg/programmes/diabetes-hub/healthy-eating-tips)
- [HealthHub: My Healthy Plate](https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/plan-your-meals-with-my-healthy-plate)
- [HealthHub: Hyperlipidemia](https://www.healthhub.sg/health-conditions/hyperlipidemia)
- [CDC: Characteristics of an effective health education curriculum](https://www.cdc.gov/assessing-improving-school-health/health-education-curriculum/index.html)
- [CDC: Health Education Curriculum Analysis Tool overview](https://www.cdc.gov/healthy-youth/hecat/pdfs/hecat_overview.pdf)
- [WHO: Digital education for building health workforce capacity](https://www.who.int/publications/i/item/9789240000476)
- [WHO: Weight bias and obesity stigma](https://iris.who.int/bitstream/handle/10665/353613/WHO-EURO-2022-5369-45134-64401-eng.pdf?sequence=1)

## Final recommendation

Proceed with continued private gameplay review. The management-game programme is complete, coherent, and supported by strong deterministic evidence. Do not promote the build as clinically correct, educationally effective, culturally approved, or accessibility-conformant until the external gates above are completed.
