# Test Report

Report date: 2026-07-24
Build/commit: Independent-review Stage 4 working source has passed the comprehensive automated, build, and responsive-browser gate; commit and owner-only publication evidence remain pending
Release verdict: **Stage 4 gate PASS; production remains NO-GO pending exact-production offline/performance QA and required human reviews**

Scope note: this report adds the comprehensive Stage 4 people-and-events validation and retains the content `1.3.0` working-source gate and earlier content `1.2.0` evidence below as labelled historical baselines. Working-source builds and development-browser passes are not exact-production, offline, performance, clinical, cultural, assistive-technology, or human-review evidence.

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
