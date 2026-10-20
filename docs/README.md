# Documentation index

Status: Index of the project documents and the facts each one owns

The essential documents sit at the top of `docs/`. Game design references are in [design/](#design), the decision log and architecture decision records are in [decisions/](#decisions), and release-readiness and human-review material is in [release/](#release). Screenshots used by the repository README are in `images/`.

## Single owners for volatile facts

Some facts change with every content update or validation run. Each of them has exactly one owning document, listed below, and other documents link to that owner instead of copying the value. When one of these facts changes, update its owner first.

The launch content counts are the one exception. These requirement and evidence documents still restate them as acceptance criteria: [TEST_PLAN.md](TEST_PLAN.md) (including its performance budget), [release/RELEASE_CHECKLIST.md](release/RELEASE_CHECKLIST.md), [design/GAME_DESIGN.md](design/GAME_DESIGN.md#product-brief) (its product brief), [CHANGELOG.md](CHANGELOG.md#release-notes) (its release notes), [release/ASSET_PROVENANCE.md](release/ASSET_PROVENANCE.md), [design/ECONOMY_AND_PROGRESSION.md](design/ECONOMY_AND_PROGRESSION.md), [release/ACCESSIBILITY.md](release/ACCESSIBILITY.md) and [design/NUTRITION_DATA.md](design/NUTRITION_DATA.md). When a roster count changes, update the owner and every listed restating document. Labelled historical mentions, such as earlier release evidence, changelog history, dated ADRs and decision rows, keep the values of their time.

| Fact | Owner | Notes |
| --- | --- | --- |
| Launch content counts (stalls, dishes, placeables and their categories, customer archetypes, nutrition profiles and variants, localization entries) | [design/CONTENT_CATALOGUE.md](design/CONTENT_CATALOGUE.md#roster-counts) | The validator reads its numbers from `LAUNCH_ROSTER` in `src/content/roster.ts`; the catalogue states them for readers. |
| Test and gate evidence (test counts, build results, rendered-output checks, service-worker build IDs, visual verification) | [TEST_REPORT.md](TEST_REPORT.md) | Dated records only. `TEST_PLAN.md` holds the matrix and the targets, not results. |
| Dependency-audit results | [TEST_REPORT.md](TEST_REPORT.md#dependency-audit) | |
| Simulation benchmark and payload measurements | [TEST_REPORT.md](TEST_REPORT.md#performance-evidence) | Budgets live in [TEST_PLAN.md](TEST_PLAN.md#performance-budget). |
| Release blockers, open issues, risks and deferred engineering debt | [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | The project status summary heads the same document. The scored tech-debt register and its follow-ups are in [TECH_DEBT.md](TECH_DEBT.md). |
| Save format and versions | [SAVE_FORMAT.md](SAVE_FORMAT.md) | |
| Dish prices and their sources | [design/DISH_PRICE_SOURCES.csv](design/DISH_PRICE_SOURCES.csv) | `tests/content/prices.test.ts` checks every price in `src/content/dishes.ts` against it; the price rule is in [design/ECONOMY_AND_PROGRESSION.md](design/ECONOMY_AND_PROGRESSION.md#dish-prices). |

## Essential documents

- [CHANGELOG.md](CHANGELOG.md): notable changes, with the player-facing release notes for the unreleased candidate.
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md): project status, release blockers, open issues, pinned behaviour defects, deferred debt and the risk register.
- [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md): source layout, layering and runtime flow.
- [SAVE_FORMAT.md](SAVE_FORMAT.md): save version nesting, history and invariants.
- [DEPLOYMENT.md](DEPLOYMENT.md): hosting targets, deployment and rollback.
- [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md): security controls and the draft privacy notice.
- [TEST_PLAN.md](TEST_PLAN.md): the test matrix and the provisional performance budget.
- [TEST_REPORT.md](TEST_REPORT.md): dated test, gate, performance and graphics verification evidence.
- [TECH_DEBT.md](TECH_DEBT.md): the scored tech-debt register, the refactor's partial steps and the remaining follow-ups.

## Design

- [design/GAME_DESIGN.md](design/GAME_DESIGN.md): the product brief (goals, audience and boundaries), then the game rules, loops and player-facing systems.
- [design/ECONOMY_AND_PROGRESSION.md](design/ECONOMY_AND_PROGRESSION.md): provisional balance specification.
- [design/CONTENT_CATALOGUE.md](design/CONTENT_CATALOGUE.md): the launch roster and its counts.
- [design/NUTRITION_DATA.md](design/NUTRITION_DATA.md): nutrition sources, scoring and educational-use policy.
- [design/DISH_PRICE_SOURCES.csv](design/DISH_PRICE_SOURCES.csv): each dish's 2025-26 street price, source tier and source.
- [design/ART_BIBLE.md](design/ART_BIBLE.md): visual direction.
- [design/VISUAL_OVERHAUL_PLAN.md](design/VISUAL_OVERHAUL_PLAN.md): the graphical-overhaul audit, direction, rendering architecture and work packages.
- [design/ROADMAP.md](design/ROADMAP.md): the long-term progression roadmap and the post-launch backlog.

## Decisions

- [decisions/README.md](decisions/README.md): the decision log, and when a reversal needs a new ADR.
- [ADR 0001](decisions/0001-browser-game-stack.md): browser game stack.
- [ADR 0002](decisions/0002-art-style-and-perspective.md): art style and perspective.
- [ADR 0003](decisions/0003-local-first-persistence-and-offline.md): local-first persistence and offline operation.
- [ADR 0004](decisions/0004-simulation-and-ui-boundaries.md): simulation and UI boundaries.
- [ADR 0005](decisions/0005-painted-sprite-rendering.md): painted sprite rendering.
- [ADR 0006](decisions/0006-seeded-neighbourhood-and-save-v5.md): seeded neighbourhood and save schema V5.
- [ADR 0007](decisions/0007-guideline-anchored-nutrition-ratings.md): guideline-anchored nutrition ratings and realistic hawker servings.
- [ADR 0008](decisions/0008-snack-basis-edible-density-and-source-plausibility.md): snack basis, edible-portion density and source plausibility rules.
- [ADR 0009](decisions/0009-whole-profile-overall-health-rating.md): whole-profile overall Health rating for meals (nutrient score, condition score and day excess).

## Release

- [release/RELEASE_CHECKLIST.md](release/RELEASE_CHECKLIST.md): release gates and the GO/NO-GO record.
- [release/ACCESSIBILITY.md](release/ACCESSIBILITY.md): accessibility target and plan.
- [release/CULTURAL_REVIEW.md](release/CULTURAL_REVIEW.md): Singapore cultural review checklist.
- [release/ASSET_PROVENANCE.md](release/ASSET_PROVENANCE.md): asset origins and the license inventory obligation.
- [release/SUPPORT.md](release/SUPPORT.md): support guide.
