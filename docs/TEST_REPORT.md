# Test Report

Report date: 2026-07-26
Build/commit: Independent-review Stage 5 commit `982a020bf0a44fddd28cacc0be6290b6b6664379`; owner-only preview version 7
Release verdict: **Stage 5 engineering, balance, build, commit, and owner-only publication gates PASS; production remains NO-GO pending exact-production and required human reviews**

Scope note: this report adds the Stage 5 scenarios, mastery, meta-progression, persistence, economy, nutrition-completeness, and responsive-engineering evidence. The Stage 4 people-and-events gate, content `1.3.0` working-source gate, and content `1.2.0` evidence remain below as labelled historical baselines. Working-source tests and development-browser passes are not exact-production, offline, performance, clinical, cultural, assistive-technology, educational-efficacy, or human-review evidence.

## Independent-review Stage 5 focused validation

The Stage 5 working source introduces five executable isolated scenarios, twelve mastery templates, IndexedDB V2 scoped storage, `MetaProgressionV1`, export bundle V3, a Challenges/meta-gallery interface, and conservative source-coverage requirements for nutrition ratings. Canonical gameplay money remains integer SGD cents, and scenario/mastery rewards contain no cash, experience, reputation, premium currency, advertising, payment, or monetization field.

Completed evidence:

- Typecheck, lint, all 63 Vitest files and 546 tests, 17 content validations, two SSR assertions, targeted UI/save tests, focused persistence tests, scenario/state/telemetry tests, and the 30-seed economy test passed on the integrated Stage 5 source.
- The focused scenario/state/telemetry run passed 4 files and 61 tests. The UI/save focused run passed 3 files and 23 tests, and the Stage 5 persistence group passed 20 tests.
- `tests/core/scenario-simulation-evidence.test.ts` executes real commands, simulation state, service, drain, cent ledgers, run telemetry, and medal evaluation. For each of Narrow Aisles, Split Hall, Limited Cash, Menu Diversity, and Peak Throughput, a competent first strategy earns exactly Bronze, a deliberate optimization earns exactly Silver, and two materially different legal layouts earn Gold. Seeded replay is exact.
- Scenario setup exposes only its authored unlocked stalls and dishes, freezes the real active preparation identifier for base and selected variants, and reapplies exact menus/unlocks on restore. A substituted scenario menu is rejected.
- Scenario telemetry is idempotent across reload, bound to scenario/run/period, requires exact wait observations, survives the retained core rating-history window, and rejects a completed save when terminal telemetry is missing or stale. Terminal reports reconcile sales, costs, upkeep, refunds, contribution, minimum cash, and final cash to the cent.
- Scenario result tests preserve the better previously earned medal, expose exact score breakdown and next-medal shortfall/constraints, and award only validated cosmetic identifiers. In-progress runs receive no medal or reward.
- Persistence coverage upgrades IndexedDB V1 in place, keeps the Stage 4 main save readable, isolates main/scenario/meta scopes, validates an entire V3 import bundle before mutation, preserves meta on main reset, removes every game/meta scope on confirmed erase-all, and leaves preferences intact.
- The interface uses one exclusive local-data operation gate and one queued meta-write chain. Import, erase, reset, scenario restart, reward recording, scope changes, and export await the writes they depend on. Tests cover truthful post-commit import/erase recovery and retry-required reset-meta persistence.
- Mastery tests cover all twelve metrics, frozen acceptance, deterministic three-choice breakfast offers, seven-day rotation, Skip, expiry, guardrails, debrief idempotency, meta-only rewards, repeat labels when needed to retain three choices, Clean Ledger active-period eligibility, and fully served normally completed party counting.
- Careful Service and Short Waits freeze a requirement for at least three completed visits in each of their three periods; Tray Team freezes at least four tray-return opportunities in each period. All three periods must qualify, and the requirements, progress, and outcome remain visible. This prevents a single favourable sample plus empty periods from earning a mastery reward.
- A production-catalogue level-13 reachability witness proves all twelve mastery targets using real service periods, ledger/event/forecast/rating telemetry, valid placement and Combo Board commands, and legal stall controls. Its evidence reaches 294 completed visits, S$1,741 gross sales, S$971.65 contribution, 79 minimum satisfaction, 23.4-second maximum median wait, 301 qualifying-flow seconds, ten distinct preparations, 75 party visits, 84.6% tray returns with every sample floor met, 45 forecast matches, three refund-free periods, and 33 completed combos.
- Adversarial persistence and scenario checks bind terminal telemetry to exact core arrivals, completions, watchdog timeouts, path and flow aggregates; detach stale runtime controllers before import/reset/erase; and reject semantically contradictory completed outcomes, rotations, rewards, medals, and gallery keepsakes.
- Nutrition completeness now requires every rating's primary metric and at least 7,500 of 10,000 weighted known-data basis points. Insufficiently supported overall or condition-aware ratings become unavailable rather than a fabricated neutral value; trace and missing nutrients remain non-numeric for scoring.
- The authoritative read-only food CSV still hashes to `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`. Tuning the isolated Menu Diversity scenario removes Soto ayam from that scenario's unlock set so Bronze, Silver, and Gold have distinct feasible preparation spreads. The curated `dish.soto-ayam` mapping was re-checked against one unique, case-sensitive `Food Name` row (`Soto ayam`, default serving `1 bowl(s) = 569g`, Lab Analysis); its existing mapping and serving remain appropriate. No global food, source row, serving interpretation, curated mapping, or generated nutrient value changes, and `tools/nutrition/manifest.mjs` is unchanged. The derived `src/content/nutrition.generated.json` intentionally changes only rating-state/value fields to enforce source completeness; its SHA-256 is `0fa3e4fae448449fb2c6292df6960d3bf6e53d573a348bdc4192d982404defe7`.

Deterministic 30-seed economy evidence:

| Strategy scope | p10 operating margin | Median | p90 |
|---|---:|---:|---:|
| Overall | 46.9755% | 56.3295% | 58.7500% |
| Throughput-led | 46.5385% | 56.6677% | 58.7337% |
| Value-led | 46.9755% | 54.9160% | 58.7500% |
| Nutrition-led | 50.2217% | 55.5063% | 57.7492% |

The 30 runs are distributed across levels 1, 5, 13, and 20, include every period at every level, use legally distinct throughput/value/nutrition setups, produce positive sales and resolved visits, and reconcile every ledger with an exact zero-cent delta. The results satisfy the programme's 45–60% overall median, 40–65% per-strategy median, and at-least-25% tenth-percentile contracts without production-balance retuning.

Responsive and graphical evidence:

- `docs/images/independent-review-stage5-challenges-1280x720.png`
- `docs/images/independent-review-stage5-challenges-1024x640.png`
- `docs/images/independent-review-stage5-challenges-800x720.png`
- `docs/images/independent-review-stage5-challenges-390x844.png`
- `docs/images/independent-review-stage5-text-200-1280x720.png`
- `docs/images/independent-review-stage5-combined-scale-640x360.png`
- `docs/images/independent-review-stage5-build-1909x1072.png`
- `docs/images/independent-review-stage5-reference-comparison.png`

The four required viewport captures, 200% in-game-text capture, effective 200% browser-zoom viewport, and combined containment capture show the Challenges sheet, gallery, scenario cards, wrapped actions, dock separation, and scroll ownership. DOM checks reported no root/body horizontal overflow and no visible meaningful informational text below 0.75rem. The same-input comparison does not reproduce the supplied header, action-strip, catalogue, or dock overlap.

Restart uses a focus-contained confirmation dialog with Escape and invoking-control focus restoration. Leaving a scenario and skipping a mastery offer also restore focus. The Challenges sheet owns its vertical scroll, its flex children may shrink, and fixed confirmations remain internally scrollable at short/enlarged viewports.

The refreshed social-preview card is registered in `docs/ASSET_PROVENANCE.md`: `public/og.png`, 1730×909, SHA-256 `47EF7F3217FC23844222806E1236E18F3A7D4D8938263520CB47EC0175D556B9`. Exact title, tagline, safe composition, and absence of prohibited marks were inspected; qualified human similarity, brand, and cultural review is not claimed.

Stage 5 publication record:

- Commit `982a020bf0a44fddd28cacc0be6290b6b6664379` contains the validated Stage 5 source and evidence.
- The private preview records that exact commit and deployed successfully.
- Access was re-verified as custom owner-only: one allowed account, no allowed groups, no workspace groups, and no tenant groups.
- The unauthenticated development browser reached the expected “Sign in required” gate with no console errors. A signed-in exact-artifact content smoke remains open because the development browser had no authenticated session.

Final working-source build record:

- `npm run build` passed through Vinext/Vite with bundled Node 24.14.0.
- `npm run build:vercel` passed through native Next.js with bundled Node 24.14.0.
- Both builds stamped service-worker ID `d863122d476a`.
- `git diff --check` passed; Windows line-ending notices do not represent whitespace errors.

Known external gates:

- Actual-browser 200% zoom, exact-production critical-path browsing, offline first load/reload/restart/update, storage-fault recovery, and long-session production performance/soak.
- Qualified screen-reader and other assistive-technology review.
- Qualified clinical-language, Singapore cultural, sensitivity, narrative, human-balance, educational-efficacy, security, and legal review.

## Independent-review Stage 4 comprehensive validation

The Stage 4 working source introduces Core V7/runtime V5 persistence, canonical parties of up to six, deterministic neighbourhood events, and recurring fictional regulars. It preserves the integer-cent SGD economy and migrates the immediately preceding Core V6/runtime V4 preview without inventing companion, event, or regular history.

Completed evidence:

- `npm run typecheck` passed for the integrated working source.
- `npm run lint` passed without warnings.
- `npm test` passed 51 files and 407 tests, covering the focused Stage 4 strategic, event, persistence, live-party, responsive, and compatibility contracts together with every prior-stage regression.
- Live-party simulation covers deterministic member identities and needs, one visible leader and one queue footprint, Combo Board participation, at-most-two-stop settlement, in-flight save/reload equivalence, temporary capacity waiting, per-guest cent/watchdog settlement, and atomic cleanup of unserved companions.
- Core persistence coverage verifies additive V6-to-V7 migration, unchanged money cents, canonical leader-only party round trips, regular story/event-counter persistence, and rejection of forged counters, aliased state, and serialized companion actors.
- Runtime coverage verifies V1–V4 decoding into exact V5 writes, once-per-period and twice-per-day event caps, documented neutral dismissal, preserved pause intent, frozen resolution, and canonical party/regular UI summaries.
- Deterministic rule coverage verifies six-member limits, no more than two stall stops, main-first Combo Board service when placed instance identifiers sort side-first, deterministic rejection of contradictory stop orders, accessible atomic seating, the exact 40% patience split threshold, path-validated table adjacency, four normalized period profiles, eight condition-neutral events, exact keyed event preference deltas, and six recurring four-step stories. Authored `+24` and `+34` preference effects remain materially distinct, consume no gameplay RNG, and never alter condition-aware incidence.
- `npm run validate:content` passed 17 content checks.
- `npm run test:ssr` passed 2 SSR checks.
- `npm run build` passed with the bundled Node.js 24 runtime. The existing client chunk larger than 500 kB remains a known performance warning. Both production targets used service-worker source stamp `2e6e7bc52161`.
- `npm run build:vercel` passed with the bundled Node.js 24 runtime.
- `git diff --check` passed.
- The authoritative food-source snapshot still hashes to `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`. Stage 4 changes no food, preparation, serving, manifest mapping, generated nutrient value, missing-value state, or trace state.
- `tools/nutrition/manifest.mjs` and `src/content/nutrition.generated.json` remain unchanged.

Responsive-browser evidence:

- Clean planning layouts were inspected at 1280×720, 1024×640, 800×720, and 390×844.
- The unresolved event modal was inspected at 1280×720, 1024×640, 390×844, and combined scale.
- Separate checks covered 200% in-game text, effective 200% browser zoom through a 640×360 same-origin iframe scaled to a 1280×720 physical frame, and combined 200% text plus effective 200% zoom. No application-root horizontal overflow, product-UI collision, or meaningful informational text below 0.75rem was observed.
- A same-input comparison with the supplied 1908×1072 reference confirmed that its header, action-strip, catalogue, and dock overlap is absent in the reviewed planning layout. Dynamic gameplay state differs between the reference and current capture.
- Deterministic `visualQa` planning and `visualQaEvent` Lunch fixtures do not persist fixture state. Same-origin framing is enabled only by development response headers; production retains `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- The private preview records the exact Stage 4 commit and deployed successfully with one explicitly allowed account and no allowed groups. Unauthenticated smoke correctly receives `401`; signed-in remote content smoke remains pending, while the exact committed archive passed the full local test, SSR, Vinext, and native Vercel gates before upload.

Pending before the Stage 4 publication record is complete:

- Owner-only publication and deployed-artifact smoke check.

The effective zoom pass is engineering emulation; actual browser-control 200% zoom remains part of the final cross-stage review. No exact-production offline, screen-reader, clinical, cultural, sensitivity, human-balance, or production-performance pass is claimed.

## Content `1.3.0` working-source validation

On 2026-07-20, the supported bundled Node.js `v24.14.0` runtime passed typecheck, lint, 29 Vitest files / 181 tests, the five-environment Vinext build, 2/2 rendered-output/offline-shell assertions, and the native Next.js Vercel build. The deterministic generated nutrition snapshot contains 104 released profiles across 14 variant families, and the generated service-worker build ID is `7d3da6d67b11`.

A targeted 1280 x 720 development-browser pass inspected the Nutrition Lens, separate Health and Star badges, all 12 nutrient fields including `Trace`, four condition-specific ratings, six Nasi Lemak variants and their trade-off summaries, and a selected high-cholesterol guest with personalized fit and a `+0.06` satisfaction effect. The browser recorded no warning or error console messages. This pass did not cover every stall or dish presentation, 1024 x 640, secondary browsers, offline restart/update, storage faults, accessibility assistive technology, performance profiling, or human cultural review.

## Evidence status

The content `1.2.0` source snapshot integrated the queue, preferred-route editor, expansion, graphics, food, animation, and utility changes alongside 12 stalls, 46 dishes, 80 placeables, 12 archetypes, and 300 English localization entries. Every stall and dish in that snapshot had a unique primary visual reference. Its local-browser passes inspected the expandable 12-persona roster, seven live mixed visitors, and the route editor at 1024 × 640 with no client-console errors. A 1280 × 720 stall pass also inspected compact and 5 × 3 facades, four simultaneously operating vendors, closed shutters, active-menu food changes, reduced motion, high contrast, and standard/lower-end quality without game console warnings or errors. These are targeted development-runtime checks, not exhaustive human or exact-production review.

The route-efficiency correction was also checked in a deterministic 360-second production starter-layout run. The retained 50 ratings averaged 88.2, ranged from 75.83 to 95.83, and contained no score below 50; average travelled distance was 34.16 tiles. This run separately exposed that the 120-second visit cap can interrupt served guests during eating or tray return, which remains an open balance issue rather than part of the route score.

Recorded content `1.2.0` supported-runtime evidence: the complete release-equivalent gate passed on bundled Node.js `v24.14.0`, including typecheck, lint, 24 Vitest files / 131 tests, the five-environment Vinext build, and 2/2 rendered-output/offline-shell tests. The native Next.js Vercel build also passed. The generated service-worker build ID was `c5ed3679ba56`. These automated results do not validate content `1.3.0` or establish exact-production browser/offline behavior or human visual, accessibility, cultural, security, or legal approval.

## Gate record

| Gate | Recorded `1.2.0` result | Evidence / required update |
|---|---|---|
| Typecheck | **Pass** | `npm run test:release` on bundled Node.js `v24.14.0`, exit 0 |
| Vitest unit/integration/content/performance/hosting | **Pass** | 24 files / 131 tests passed |
| Content validator | **Pass** | Exact 12 stalls / 46 dishes / 80 placeables / 12 archetypes / 300 localization entries, reciprocal references, opening menus, unique primary stall/food visuals, unlock graph, categories, and copy checks |
| Visual-recipe validator | **Pass, automated scope** | 80 unique placeable semantic contracts, 46 distinct dish profiles, and 12 unique vendor identities/tools/actions passed alongside 12 archetypes, all 11 lifecycle states, reduced-motion invariants, and the exact indicator legend; active-menu prop selection is reciprocal, ordered, deduplicated, bounded, and deterministic |
| Queue selection/routing/expansion | **Pass** | Balanced selection, furniture avoidance, globally unique cells/anchors, custom-route conflicts, closed stalls, live-order preservation, geometry/undo reflow, persistence, admitted-customer walkability, perimeter migration, and old-exit continuity are covered |
| Preferred guest routes | **Pass** | Weighted deterministic corridor shifts, fallback paths, canonical validation, live rerouting, blocking-placement protection, undo, and schema-v3 round-trip/backward defaults are covered |
| Utility mechanics | **Pass** | All 14 signage/facility definitions expose nonzero utility; spatial falloff, global wayfinding, and bounded satisfaction effects are covered |
| Deterministic lifecycle and target recovery | **Pass** | Full visit lifecycle, fixed-step chunking, low-end cap, stall/tray/seat target removal, route-efficiency scoring, and invariant checks are covered |
| Build/economy/progression | **Pass** | Place/move/rotate/remove/refund/undo/expansion, operated-stall undo safety, path blocking, thresholds, sales, XP, and reputation are covered |
| Seeded simulation benchmark | **Pass, automated scope** | `benchmark-80-agents` completed 1,200 fixed steps with a peak of 80 active agents within budget; this does not establish Phaser FPS or the required two-hour browser soak |
| Development-browser visual pass | **Content `1.2.0` targeted pass** | The persona inspector, Settings guide, and route editor passed targeted checks; the stall upgrade was checked at 1280 × 720 with compact and large stalls, live menu changes, full/open and opaque-closed scenes, reduced motion, high contrast, and both quality modes. This evidence predates the 14-stall / 54-dish `1.3.0` gallery; see `GRAPHICS_VERIFICATION.md` |
| Lint | **Pass** | `npm run test:release` on bundled Node.js `v24.14.0`, exit 0 |
| Production build | **Pass** | Vinext completed all five environments; generated service-worker build ID `c5ed3679ba56` |
| Vercel build | **Pass** | `npm run build:vercel` completed the native Next.js 16 build |
| Vercel Preview/stage/promotion | **Not run** | Requires the documented Vercel project, GitHub secrets, protected `production` Environment, and user approval |
| Rendered production output/PWA | **Pass, automated scope** | 2/2 Node assertions passed; real-browser offline restart/update remains open |
| Dependency audit | **Recorded pass; not rerun in this update** | The previously recorded production-only and all-dependencies audits both reported 0 vulnerabilities |
| Active/backup IndexedDB and quota/private mode | Implementation present; browser not verified | Requires exact-production storage fault injection, reload, and recovery evidence |
| Chrome exact-production critical path | **Not complete** | Exact stable browser/OS, viewport/zoom, console, network, save/reload, and responsive evidence required |
| Offline first load/reload/restart/save/update | **Not run on replacement artifact** | Static worker assertions from the earlier build are not sufficient |
| Edge and Firefox smoke | **Not run** | Exact versions and limitations required |
| Accessibility matrix | **Not run in an exact production browser** | Keyboard, focus, zoom/reflow, contrast, reduced motion, audio equivalents, screen reader, and human audit required |
| Cultural/legal/security review | **Not performed** | Required external review records remain release blockers |

## Automated suites in recorded source snapshot

The content `1.2.0` source snapshot contained the suites below. Content, spawn weighting, and visual-recipe coverage included the complete 12-persona roster in the recorded full-gate execution.

- `tests/content.test.ts`: exact expanded launch counts, category minimums, reciprocal links, opening-dish availability, unique primary stall/food references, localization completeness, duplicate IDs, missing references, unreachable unlocks, and prerequisite cycles.
- `tests/core/grid-pathfinding.test.ts`: grid conversion, rotations/footprints, invalid placement, deterministic A*, and unreachable routes.
- `tests/core/guest-routing.test.ts`: weighted preferred corridors and fallback, canonical/atomic route commands, live rerouting, placement protection, undo, and save compatibility.
- `tests/core/commands-economy.test.ts`: build commands, undo safety/expiry, trusted expansion price, service-after-undo behavior, route protection, and economy/progression formulas.
- `tests/core/lifecycle.test.ts`: end-to-end simulated visit, fixed-step determinism, low-end budgets, and live target/reservation recovery.
- `tests/core/persistence-soak.test.ts`: save round trip, migration/recovery, catalogue validation, deterministic soak, and leak checks.
- `tests/core/walking-satisfaction.test.ts`: distance-based score anchors, preparation/eating independence, exit-leg inclusion, and open-versus-serpentine route scoring.
- `tests/core/customer-personas.test.ts`: progression gates, visit-window weighting, and locked-persona spawn exclusion.
- `tests/core/queue-selection-expansion.test.ts`: stall-choice balancing, queue-direction/custom-path behavior, obstacle avoidance, persistence, perimeter migration, and exit-path continuity.
- `tests/core/queue-layout-overlap.test.ts`: insertion-order-independent global planning, unique cells, protected foreign anchors, crossing custom paths, closed stalls, and custom-first automatic rerouting.
- `tests/utility-effects.test.ts`: meaningful signage/facility mappings and bounded spatial/global effects.
- `tests/stall-visuals.test.ts`: active-menu food-prop reciprocity, order, deduplication, caps, tamper rejection, fallback, and deterministic menu-change behavior.
- `tests/visual-recipes.test.ts`: exhaustive 80-placeable semantic contracts, 46 distinct dish profiles, 12 unique vendor recipes/actions, archetype, animation-state, tick, reduced-motion, and customer-status legend visual contracts.
- `tests/performance.test.ts`: repeatable 80-agent Node simulation budget with queue reservations active.
- `tests/queue-insight.test.ts`: geometry-aware queue-flow messaging, route-capacity warnings, demand imbalance, and calm-state recovery.

## Recorded supported-runtime execution

Executed from the content `1.2.0` source snapshot with the bundled Node.js `v24.14.0` binary using the release-script equivalents:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next
node node_modules/vitest/vitest.mjs run --config vitest.config.ts
node tools/stamp-service-worker.mjs; node node_modules/vinext/dist/cli.js build
node --test tests/rendered-html.test.mjs
node tools/stamp-service-worker.mjs; node node_modules/next/dist/bin/next build
```

Both release targets exited 0. Typecheck and lint passed; Vitest reported 24 files / 131 tests; the five-environment Vinext build and native Vercel build completed; 2/2 rendered-output/offline-shell tests passed; and the service worker was stamped `c5ed3679ba56`. Dependency audits were not part of this validation update. The benchmark details are recorded in `PERFORMANCE_REPORT.md`.

For the exact-production browser tests, record browser/OS version, viewport, DPR/zoom, production URL, scenario results, screenshots, console/network findings, save/reload, and offline/update steps.

See `TEST_PLAN.md` for the current matrix, `GRAPHICS_VERIFICATION.md` for the retained visual evidence and current target, `PERFORMANCE_REPORT.md` for benchmark evidence, and `KNOWN_ISSUES.md` for the remaining gates.
