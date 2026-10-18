# Documentation index

Status: Index of the project documents and the facts each one owns

## Single owners for volatile facts

Some facts change with every content update or validation run. Each of them has exactly one owning document, listed below, and other documents link to that owner instead of copying the value. When one of these facts changes, update its owner first.

The launch content counts are the one exception. These requirement and evidence documents still restate them as acceptance criteria: [TEST_PLAN.md](TEST_PLAN.md), [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md), [RELEASE_NOTES.md](RELEASE_NOTES.md), [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md), [ECONOMY_AND_PROGRESSION.md](ECONOMY_AND_PROGRESSION.md), [ACCESSIBILITY.md](ACCESSIBILITY.md), [PERFORMANCE_BUDGET.md](PERFORMANCE_BUDGET.md) and [NUTRITION_DATA.md](NUTRITION_DATA.md). When a roster count changes, update the owner and every listed restating document. Labelled historical mentions, such as earlier release evidence, changelog history, dated ADRs and decision rows, keep the values of their time.

| Fact | Owner | Notes |
| --- | --- | --- |
| Launch content counts (stalls, dishes, placeables and their categories, customer archetypes, nutrition profiles and variants, localization entries) | [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md) | The validator reads its numbers from `LAUNCH_ROSTER` in `src/content/roster.ts`; the catalogue states them for readers. |
| Test and gate evidence (test counts, build results, rendered-output checks, service-worker build IDs) | [TEST_REPORT.md](TEST_REPORT.md) | Dated records only. `TEST_PLAN.md` holds the matrix, not results. |
| Dependency-audit results | [TEST_REPORT.md](TEST_REPORT.md#dependency-audit) | |
| Simulation benchmark and payload measurements | [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md) | Budgets live in `PERFORMANCE_BUDGET.md`. |
| Release blockers, open issues and deferred engineering debt | [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | The scored tech-debt register and its follow-ups are in [TECH_DEBT.md](TECH_DEBT.md). |
| Save format and versions | [SAVE_FORMAT.md](SAVE_FORMAT.md) | |

## Documents

### Product and design

- [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md): product goals, audience and boundaries.
- [GAME_DESIGN_DOCUMENT.md](GAME_DESIGN_DOCUMENT.md): game rules, loops and player-facing systems.
- [ECONOMY_AND_PROGRESSION.md](ECONOMY_AND_PROGRESSION.md): provisional balance specification.
- [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md): the launch roster and its counts.
- [NUTRITION_DATA.md](NUTRITION_DATA.md): nutrition sources, scoring and educational-use policy.
- [ART_BIBLE.md](ART_BIBLE.md): visual direction.
- [CULTURAL_REVIEW.md](CULTURAL_REVIEW.md): Singapore cultural review checklist.
- [ACCESSIBILITY.md](ACCESSIBILITY.md): accessibility target and plan.
- [LONG_TERM_PROGRESSION_ROADMAP.md](LONG_TERM_PROGRESSION_ROADMAP.md) and [POST_LAUNCH_BACKLOG.md](POST_LAUNCH_BACKLOG.md): future work.

### Engineering

- [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md): source layout, layering and runtime flow.
- [SAVE_FORMAT.md](SAVE_FORMAT.md): save version nesting, history and invariants.
- [DECISIONS.md](DECISIONS.md) and [adr/](adr/): the decision log and architecture decision records.
- [DEPLOYMENT.md](DEPLOYMENT.md): hosting targets, deployment and rollback.
- [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) and [PRIVACY.md](PRIVACY.md): security controls and the draft privacy notice.
- [PERFORMANCE_BUDGET.md](PERFORMANCE_BUDGET.md): provisional performance budgets.
- [TECH_DEBT.md](TECH_DEBT.md): the scored tech-debt register, the refactor's partial steps and the remaining follow-ups.

### Verification and release

- [TEST_PLAN.md](TEST_PLAN.md): the test matrix.
- [TEST_REPORT.md](TEST_REPORT.md): dated test and gate evidence.
- [GRAPHICS_VERIFICATION.md](GRAPHICS_VERIFICATION.md): visual evidence and the remaining visual gates.
- [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md): benchmark and payload evidence.
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md): release blockers, open issues and deferred debt.
- [RISK_REGISTER.md](RISK_REGISTER.md): project risks and mitigations.
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) and [RELEASE_NOTES.md](RELEASE_NOTES.md): release gates and notes.
- [PROJECT_STATUS.md](PROJECT_STATUS.md): current position summary.
- [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md): asset origins.
- [SUPPORT.md](SUPPORT.md): support guide.
