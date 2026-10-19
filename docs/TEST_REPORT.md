# Test Report

Report date: 2026-10-19
Build/commit: Content `1.4.0` working source validated with Node.js `v22.22.0`; commit/publication record pending
Release verdict: **NO-GO pending exact-production browser/offline QA and required human reviews**

This document owns the dated test and gate evidence; other documents link here instead of restating results (see the [documentation index](README.md)). Release blockers are listed in [KNOWN_ISSUES.md](KNOWN_ISSUES.md), and content counts in [CONTENT_CATALOGUE.md](design/CONTENT_CATALOGUE.md#roster-counts).

Scope note: this report records the content `1.4.0` working-source gate, retains the content `1.3.0` gate as the previous record, and retains the earlier content `1.2.0` evidence below as a labelled historical baseline. Working-source builds and a targeted development-browser pass are not exact-production, offline, performance, or human-review evidence.

## Content `1.4.0` working-source validation

On 2026-10-19, Node.js `v22.22.0` passed `npm run test:release` (typecheck, lint, 105 Vitest files / 1,183 tests with `CI=true`, the Vinext build, and 2/2 rendered-output/offline-shell assertions) and the native Next.js Vercel build. The deterministic generated nutrition snapshot (review revision 2, `dataVersion` `sg-1bc212db6eda-c87987b4281c-r2`) contains 116 released profiles across 14 variant families for 67 dishes, rated by the guideline-anchored model ([ADR 0007](decisions/0007-guideline-anchored-nutrition-ratings.md)); the generated service-worker build ID is `878719bdd051`. The `benchmark-80-agents` Node run reported a mean of 0.069 ms and a p95 of 0.076 ms per fixed step.

Seeded runtime runs at speed 10 compared the content with the base commit: five operating days earned 2,786 revenue (2,764 before) and reached level 7 in both, so the content change leaves the economy's pace in place. Two independent internal reviews (clinical-style and Singapore cultural) checked the final ratings and roster; their remaining findings are in [KNOWN_ISSUES.md](KNOWN_ISSUES.md#open-nutrition-data-and-rating-issues). No browser pass was run for this change.

## Content `1.3.0` working-source validation

On 2026-07-20, the supported bundled Node.js `v24.14.0` runtime passed typecheck, lint, 29 Vitest files / 181 tests, the five-environment Vinext build, 2/2 rendered-output/offline-shell assertions, and the native Next.js Vercel build. The deterministic generated nutrition snapshot contains 104 released profiles across 14 variant families, and the generated service-worker build ID is `7d3da6d67b11`.

A targeted 1280 x 720 development-browser pass inspected the Nutrition Lens, separate Health and Star badges, all 12 nutrient fields including `Trace`, four condition-specific ratings, six Nasi Lemak variants and their trade-off summaries, and a selected high-cholesterol guest with personalized fit and a `+0.06` satisfaction effect. The browser recorded no warning or error console messages. This pass did not cover every stall or dish presentation, 1024 x 640, secondary browsers, offline restart/update, storage faults, accessibility assistive technology, performance profiling, or human cultural review.

## Structural refactor validation

On 2026-10-17, the behaviour-preserving structural refactor (branch `refactor/structural-tech-debt`) passed on Node.js `v22.22.0` (Linux): typecheck, lint, 70 Vitest files / 764 tests including the seeded-simulation, save, runtime, draw-call, input, save-store, server-rendered markup, content and nutrition-importer goldens, the five-environment Vinext build, 2/2 rendered-output/offline-shell tests, and the native Next.js Vercel build. The goldens, which pin the pre-refactor behaviour, pass unchanged. The Linux build stamps a different service-worker build ID from a Windows build, because the stamp hash depends on the platform (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md#deferred-engineering-debt)), so no build ID is recorded here. This is automated working-source evidence only; it is not exact-production, browser, offline or human-review evidence.

## Painted-sprite overhaul validation

On 2026-10-18, the graphical overhaul of [ADR 0005](decisions/0005-painted-sprite-rendering.md) passed `npm run test:release` on Node.js `v24.19.0` (Windows): typecheck, lint with no warnings, 95 Vitest files / 1,019 tests, the five-environment Vinext build and 2/2 rendered-output/offline-shell tests; the native `npm run build:vercel` build also passed. The draw-call goldens in `tests/game/runtime/createHawkerRuntime.render.test.ts` were re-baselined once, intentionally, because every texture is now painted by the new painters and stall names, gate labels and the closed sign are painted into textures instead of drawn as labels; all other goldens, including the seeded-simulation and save goldens, pass unchanged, so no game rule or save changed. The painter suites under `tests/game/runtime/art/` check that every stall, placeable, dish, variant and person paints at every rotation and frame, deterministically and distinctly, inside its texture, with meals inside each table's top, vendors opposite the service tile and seats smaller than tables. A 1440 x 900 development-browser pass covered the planning and open centre, a custom L-shaped queue, seated diners with meals on the table tops, the painted catalogue thumbnails and the tutorial; the README screenshots were refreshed from it. The Windows build stamps service-worker build ID `9e01025680f8` (platform-dependent, see [KNOWN_ISSUES.md](KNOWN_ISSUES.md#deferred-engineering-debt)). This is working-source and development-browser evidence only; browser performance profiling, exact-production checks and the human visual and cultural review remain open.

## Dependency audit

This section is the single record of dependency-audit results; other documents link here instead of restating them.

On 2026-10-18, after the security dependency updates recorded in [CHANGELOG.md](CHANGELOG.md), the production-only audit passed and the all-dependencies audit still failed at the `--audit-level=high` threshold:

| Audit | Command | Result on 2026-10-18 |
|---|---|---|
| All dependencies | `npm audit --audit-level=high` | **Fail** (exit 1): 10 vulnerabilities (8 high, 2 moderate, 0 critical) |
| Production only | `npm audit --omit=dev --audit-level=high` | **Pass** (exit 0): 0 vulnerabilities |

All eight high findings come from one advisory, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in `braces` (stack exhaustion on deeply nested brace patterns), which affects every published version up to the latest, 3.0.3, so no patched release exists. It reaches the tree only through development tooling: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`, and `vinext` → `vite-plugin-commonjs` → `vite-plugin-dynamic-import` → `fast-glob`. No released version of `eslint-config-next` 16.x or `vinext` drops `fast-glob`, and `npm audit fix --force` would downgrade `eslint-config-next` to 14.x, which does not support this setup. The two moderate findings are `vitest` and `@vitest/mocker` 4.1.10 (GHSA-82fw-gwwq-j7x9, fixed in 4.1.11), left open because npm 10.9 fails to resolve the 4.1.11 upgrade (an Arborist peer-set error). Because these findings reach only development tooling, CI gates on the production-only audit (`npm audit --omit=dev --audit-level=high` in `.github/workflows/vercel.yml`), which passes; the all-dependencies result is recorded here until `braces` publishes a fix or the two dependents stop using it.

The refactor with the updated lockfile passed `CI=true npm run test:release` on Node.js `v22.22.0` (typecheck, lint with no warnings, 73 Vitest files / 771 tests with all goldens unchanged, the Vinext build, and 2/2 rendered-output/offline-shell tests), the native `npm run build:vercel` build, and the full Vitest suite (73 files / 771 tests) on Node.js `v22.15.0`. The built Vinext stylesheet keeps the same content-hash file name and size as before the updates (`index-DQ7IifU3.css`, 91,261 bytes). Earlier audit records, including the 2026-10-17 result of 30 vulnerabilities (1 critical, 23 high, 6 moderate) for all dependencies and 6 (1 critical, 4 high, 1 moderate) for production only, are superseded by this result.

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
| Development-browser visual pass | **Content `1.2.0` targeted pass** | The persona inspector, Settings guide, and route editor passed targeted checks; the stall upgrade was checked at 1280 × 720 with compact and large stalls, live menu changes, full/open and opaque-closed scenes, reduced motion, high contrast, and both quality modes. This evidence predates the 14-stall / 54-dish `1.3.0` gallery; see [Graphics and gameplay verification](#graphics-and-gameplay-verification) |
| Lint | **Pass** | `npm run test:release` on bundled Node.js `v24.14.0`, exit 0 |
| Production build | **Pass** | Vinext completed all five environments; generated service-worker build ID `c5ed3679ba56` |
| Vercel build | **Pass** | `npm run build:vercel` completed the native Next.js 16 build |
| Vercel Preview/stage/promotion | **Not run** | Requires the documented Vercel project, GitHub secrets, protected `production` Environment, and user approval |
| Rendered production output/PWA | **Pass, automated scope** | 2/2 Node assertions passed; real-browser offline restart/update remains open |
| Dependency audit | **Production pass (CI gate), all-dependencies fail (2026-10-18)** | The production-only audit, which CI gates on, reports no findings; the all-dependencies audit reports 8 high findings from one unpatched `braces` advisory reached only through development tooling, and 2 moderate; see [Dependency audit](#dependency-audit) |
| Active/backup IndexedDB and quota/private mode | Implementation present; browser not verified | Requires exact-production storage fault injection, reload, and recovery evidence |
| Chrome exact-production critical path | **Not complete** | Exact stable browser/OS, viewport/zoom, console, network, save/reload, and responsive evidence required |
| Offline first load/reload/restart/save/update | **Not run on replacement artifact** | Static worker assertions from the earlier build are not sufficient |
| Edge and Firefox smoke | **Not run** | Exact versions and limitations required |
| Accessibility matrix | **Not run in an exact production browser** | Keyboard, focus, zoom/reflow, contrast, reduced motion, audio equivalents, screen reader, and human audit required |
| Cultural/legal/security review | **Not performed** | Required external review records remain release blockers |

## Automated suites in recorded source snapshot

The content `1.2.0` source snapshot contained the suites below. Content, spawn weighting, and visual-recipe coverage included the complete 12-persona roster in the recorded full-gate execution. The paths are those of the current tree, which mirrors the source layout; the stall-visual suite now lives under `render/`, and the single visual-recipe suite is split by recipe domain under `visuals/`.

- `tests/content/content.test.ts`: exact expanded launch counts, category minimums, reciprocal links, opening-dish availability, unique primary stall/food references, localization completeness, duplicate IDs, missing references, unreachable unlocks, and prerequisite cycles.
- `tests/game/core/grid-pathfinding.test.ts`: grid conversion, rotations/footprints, invalid placement, deterministic A*, and unreachable routes.
- `tests/game/core/guest-routing.test.ts`: weighted preferred corridors and fallback, canonical/atomic route commands, live rerouting, placement protection, undo, and save compatibility.
- `tests/game/core/commands-economy.test.ts`: build commands, undo safety/expiry, trusted expansion price, service-after-undo behavior, route protection, and economy/progression formulas.
- `tests/game/core/lifecycle.test.ts`: end-to-end simulated visit, fixed-step determinism, low-end budgets, and live target/reservation recovery.
- `tests/game/core/persistence-soak.test.ts`: save round trip, migration/recovery, catalogue validation, deterministic soak, and leak checks.
- `tests/game/core/walking-satisfaction.test.ts`: distance-based score anchors, preparation/eating independence, exit-leg inclusion, and open-versus-serpentine route scoring.
- `tests/game/core/customer-personas.test.ts`: progression gates, visit-window weighting, and locked-persona spawn exclusion.
- `tests/game/core/queue-selection-expansion.test.ts`: stall-choice balancing, queue-direction/custom-path behavior, obstacle avoidance, persistence, perimeter migration, and exit-path continuity.
- `tests/game/core/queue-layout-overlap.test.ts`: insertion-order-independent global planning, unique cells, protected foreign anchors, crossing custom paths, closed stalls, and custom-first automatic rerouting.
- `tests/game/runtime/utility-effects.test.ts`: meaningful signage/facility mappings and bounded spatial/global effects.
- `tests/game/runtime/render/stall.test.ts`: active-menu food-prop reciprocity, order, deduplication, caps, tamper rejection, fallback, and deterministic menu-change behavior.
- `tests/game/runtime/visuals/placeable.test.ts`, `tests/game/runtime/visuals/dish.test.ts`, `tests/game/runtime/visuals/vendor.test.ts`, and `tests/game/runtime/visuals/customer.test.ts`: exhaustive 80-placeable semantic contracts, 46 distinct dish profiles, 12 unique vendor recipes/actions, archetype, animation-state, tick, reduced-motion, and customer-status legend visual contracts.
- `tests/game/core/performance.test.ts`: repeatable 80-agent Node simulation budget with queue reservations active.
- `tests/game/runtime/queue-insight.test.ts`: geometry-aware queue-flow messaging, route-capacity warnings, demand imbalance, and calm-state recovery.

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

Both release targets exited 0. Typecheck and lint passed; Vitest reported 24 files / 131 tests; the five-environment Vinext build and native Vercel build completed; 2/2 rendered-output/offline-shell tests passed; and the service worker was stamped `c5ed3679ba56`. Dependency audits were not part of this validation update. The benchmark details are recorded under [Performance evidence](#performance-evidence).

For the exact-production browser tests, record browser/OS version, viewport, DPR/zoom, production URL, scenario results, screenshots, console/network findings, save/reload, and offline/update steps.

See [TEST_PLAN.md](TEST_PLAN.md) for the current matrix, [Graphics and gameplay verification](#graphics-and-gameplay-verification) for the retained visual evidence and current target, [Performance evidence](#performance-evidence) for benchmark evidence, and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for the remaining gates.

## Performance evidence

Section date: 2026-07-20
Verdict: **The content `1.3.0` Node simulation budget and both local production builds pass; browser rendering performance remains unverified**

The budgets these results are measured against are in the [performance budget](TEST_PLAN.md#performance-budget) of `TEST_PLAN.md`.

Scope note: the current working-source evidence below is not an exact-production browser performance result. The retained content `1.2.0` measurements remain labelled as historical baselines.

### Automated simulation evidence

The Vitest benchmark (`tests/game/core/performance.test.ts`) starts 80 active customers and advances 1,200 deterministic fixed steps with periodic invariant checks. The recorded baseline includes queue-reservation and obstacle-safe route behavior. It is useful for regression detection in the pure simulation core; it does not include Phaser rendering, browser scheduling, expanded stall/food drawing, audio, IndexedDB, service workers, or DOM work.

Current content `1.3.0` result from the passing working-source Vitest run on bundled Node.js `v24.14.0` (the gate record is under [Content `1.3.0` working-source validation](#content-130-working-source-validation)):

| Metric | Recorded value |
|---|---:|
| Seed | `benchmark-80-agents` |
| Fixed steps | 1,200 |
| Peak active customers | 80 |
| Mean simulation step | 0.12040941666666943 ms |
| p95 simulation step | 0.18669999999974607 ms |
| Maximum simulation step | 21.50839999999971 ms |
| Total measured duration | 150.4032000000002 ms |
| Heap delta during sample | 2,526,152 bytes |
| Test budget | mean < 4 ms; p95 < 10 ms |
| Result | Pass in content `1.3.0` supported-runtime run |

Sub-millisecond timing is noisy and machine-dependent; do not compare a single Node run to a browser frame budget.

#### Retained content `1.2.0` baseline

Retained result from the passing content `1.2.0` Vitest run on bundled Node.js `v24.14.0` (recorded under [Evidence status](#evidence-status)):

| Metric | Recorded value |
|---|---:|
| Seed | `benchmark-80-agents` |
| Fixed steps | 1,200 |
| Peak active customers | 80 |
| Mean simulation step | 0.07882491666666842 ms |
| p95 simulation step | 0.12440000000003693 ms |
| Maximum simulation step | 10.32120000000009 ms |
| Total measured duration | 98.13689999999997 ms |
| Heap delta during sample | 6,044,872 bytes |
| Test budget | mean < 4 ms; p95 < 10 ms |
| Result | Pass in recorded content `1.2.0` supported-runtime run |

### Production-build evidence

The content `1.3.0` working-source gate completed the five-environment Vinext build and generated service-worker build ID `7d3da6d67b11`. The native Next.js Vercel build also passed. Raw/gzip payload totals, file count, and deterministic artifact-manifest hash were not retained in this validation output.

The recorded content `1.2.0` release-equivalent gate also completed both builds and generated service-worker build ID `c5ed3679ba56`. That older result is retained only as a baseline.

The following payload snapshot is retained only as a pre-expansion transport baseline. Gzip values are per-file gzip sums, not current payload or browser TTI evidence:

| Payload group | Raw | Gzip |
|---|---:|---:|
| Initial client JS/CSS, excluding dynamically loaded Phaser/runtime/visual recipes | 358,302 B | 107,914 B |
| Deferred Phaser/runtime/visual recipes | 1,627,126 B | 425,765 B |
| Total client JS/CSS | 1,985,428 B | 533,679 B |

Pre-expansion `dist/`: 13,772,093 bytes across 35 files, including the 2,897,161-byte social-share PNG. Historical service-worker build ID: `3e25823ed59c`. Historical deterministic SHA-256 of the sorted `relative-path<TAB>file-sha256` manifest: `3fbd941195ed69d51198940b64ce8007aa5d8133d8f9777fa4174c24d067d2db`. These are historical artifact/transport measurements only; time to interactive was not measured.

### Browser metrics still required

| Metric | Standard | Lower-end | Status |
|---|---:|---:|---|
| Time to interactive | Budget in [`TEST_PLAN.md`](TEST_PLAN.md#performance-budget) | Budget in [`TEST_PLAN.md`](TEST_PLAN.md#performance-budget) | Not measured |
| FPS and frame-time distribution | 60 FPS target | 30 FPS target | Not measured |
| Simulation/render p95 | Budgeted | Budgeted | Node simulation only; render unmeasured |
| Draw calls / active sprites | Budgeted | Budgeted | Not measured |
| Path requests | Budgeted | Budgeted | Not measured in browser |
| Texture / total memory | Budgeted | Budgeted | Not measured |
| Save duration | Budgeted | Budgeted | Not measured in browser |
| Audio voices | Budgeted | Budgeted | Not measured |
| Two-hour soak trend | Required | Required | Not run |
| Supported active customers | Unknown | Unknown | Must not be claimed before browser sweep |

The 120 standard / 60 lower-end figures in the [performance budget](TEST_PLAN.md#performance-budget) remain provisional sweep values, not support claims. The runtime currently applies separate quality/FPS limits, but that implementation fact is not proof of delivered frame rate.

The current renderer still performs a full-frame redraw and recreates text objects during frame rendering. The Node benchmark does not exercise that path. Browser profiling must measure its CPU, allocation, frame-time, and memory impact before any supported FPS or customer-cap claim; optimization remains required if the documented budgets are missed.

### Required production measurement

Use the frozen production artifact and record:

- commit, service-worker build ID, artifact hash, raw/gzip payloads;
- exact browser/OS version, CPU/RAM/GPU, power mode, viewport, DPR, and quality setting;
- benchmark seed/snapshot, warm-up, sample length, and run count;
- late-game unlocked layout with every stall plus representative placeable and complete dish renderer coverage (the current roster is in [CONTENT_CATALOGUE.md](design/CONTENT_CATALOGUE.md#roster-counts));
- FPS distribution, simulation/render p95, path work, save duration, audio voices, and memory trend;
- customer count sweep, completed visits, failures/throttling, and the final supported cap;
- retained trace, JSON, and screenshot paths.

Development-server impressions and the Node benchmark are not substitutes for this browser evidence.

## Graphics and gameplay verification

Retained evidence date: 2026-07-16 (content `1.2.0`)
Current scope aligned: 2026-07-20 (content `1.3.0`)

Status: **The content `1.3.0` layered-stall and food contracts pass automated coverage, and its nutrition surfaces pass a targeted 1280 x 720 development-browser inspection. The exact-production all-stall/all-dish gallery and human review remain open.**

### Evidence boundary

- Content `1.3.0` defines a stall identity for every stall and a presentation for every dish, alongside a contract for every placeable and every customer archetype ([current counts](design/CONTENT_CATALOGUE.md#roster-counts)). Source contracts do not establish realism, cultural accuracy, successful rendering, or human approval.
- The stall upgrade targets layered code-native roof, fascia, sign, wall, service-window, counter, equipment, and trim treatments; food and drink props must come from each placed stall's active menu rather than a generic cuisine-colour substitute.
- Every open stall is intended to contain a code-native vendor whose deterministic idle and cuisine-appropriate preparation/serving actions remain behind the counter. Closing the centre must replace the service scene with an opaque shutter, and reduced motion must freeze the vendor in a readable static work pose without changing service timing.
- Content `1.3.0` automated coverage verifies a vendor identity, tools and emblem for every stall, deterministic idle/order/preparation poses, reduced-motion invariants, active-menu prop selection, and a food/vessel recipe for every dish ([current counts](design/CONTENT_CATALOGUE.md#roster-counts)). Its retained `1.2.0` 1280 × 720 development-browser pass inspected Sunrise Roost, Coconut & Lime, compact Kopi Canopy, and 5 × 3 Harbour Ember together, including a one-to-three dish live menu change, open and opaque-closed states, standard/lower-end quality, normal/high contrast, and full/reduced motion.
- The content `1.3.0` working source passes the automated gate (typecheck, lint, Vitest, both production builds, and the rendered-output/offline-shell tests); the dated results are under [Content `1.3.0` working-source validation](#content-130-working-source-validation).
- The retained local-browser passes inspected the expanded persona roster, seven live mixed visitors, the Settings customer-status guide, and the preferred-route editor with no client-console errors. At 1024 × 640, the route editor exposed its legend and controls, paused and resumed correctly, accepted keyboard painting, cleared and undid the guide, and restored it after reload. Eight retained screenshots sample earlier queue and expansion behavior but do not cover every current stall or dish.
- A content `1.3.0` 1280 x 720 development-browser pass inspected separate Health and Star badges, all 12 nutrient fields, condition-specific ratings, the six-option Nasi Lemak Variant Lab, and a high-cholesterol customer's personalized fit and satisfaction effect. No browser warning or error messages were recorded. This targeted pass is not the complete stall/dish gallery or an exact-production review.
- The screenshots also predate the final audit fixes for globally unique queue anchors, live-order-preserving reroutes, utility-adjusted meal depletion, and the restored route overlay. They are targeted evidence, not performance, accessibility, cultural, or exhaustive graphics approval.
- The content `1.3.0` local builds generated service-worker build ID `7d3da6d67b11`. Payload totals and a deterministic artifact-manifest hash still need to be recorded; older measurements remain explicitly historical under [Performance evidence](#performance-evidence).
- Since the painted-sprite overhaul ([ADR 0005](decisions/0005-painted-sprite-rendering.md)), textures are painted once and drawn as retained sprites with pooled labels; see [Painted-sprite overhaul validation](#painted-sprite-overhaul-validation). Automated painter tests and the Node simulation benchmark do not measure browser FPS, texture memory or the one-off painting cost.

### Verification matrix

| Artifact or behavior | Implementation or target contract | Current evidence | Status / remaining visual gate |
|---|---|---|---|
| Every placeable and furniture variety | Per-ID semantic recipe, motif, form, real-world material, multiple detail cues, accent, maker mark, silhouette treatment, world renderer, and catalogue preview | `tests/game/runtime/visuals/placeable.test.ts` passes one unique deterministic contract/motif per placeable plus populated forms, materials, and at least two detail cues; the pre-expansion starter capture shows varied previews | **Pass automated contracts;** exhaustive human inspection of every placed item on the expanded artifact remains open |
| Layered stall identities and active-menu displays | Each fictional stall uses a materially distinct layered facade and workstation. Its visible food/drink vessels and ingredients are selected from the current active menu, update after menu changes, stay inside compact and large footprints, and remain legible without relying on colour alone | Current automated tests cover every vendor/stall contract and reciprocal menu-prop selection; retained development-browser evidence samples four stalls | **Pass automated contracts;** exact-production all-stall gallery and human visual/cultural review remain open |
| Animated stall vendors | Every open stall shows a deterministic vendor with cuisine-appropriate idle, preparation, utensil, and serving cues. The vendor stays behind the counter, the closed shutter fully hides the work scene, and reduced motion removes bob/arm/prop offsets while preserving a static pose | Current tests cover a unique profile for every stall and retained development-browser evidence covers four simultaneous vendors | **Pass automated contracts;** exact-production motion comparison and all-stall inspection remain open |
| Dishes, vessels, and food while eating | Dish recipes consume unique authored food references plus container, portion colour, garnish/steam, carried tray, seated meal, tableware, and depletion states; renderer rules use dish-specific or closely related real-food forms with a semantic fallback | Current content and visual-recipe tests cover every dish, including the eight new recipes; the complete browser gallery remains open | **Pass automated contracts;** exhaustive human visual/cultural review of every rendered dish remains open |
| Customer archetypes | Archetype visual rules vary outfit silhouette, garment pattern, and optional carry prop; skin and clothing colours vary independently per customer | Retained visual-recipe tests assert a unique ID-free render signature per archetype and independent appearance variation; the retained local-browser pass sampled seven live visitors and the roster inspector | **Pass in retained automated and sampled visual evidence** |
| 11 lifecycle states and animation | `choosing-stall`, `walking-to-queue`, `queued`, `ordering`, `waiting-for-food`, `seeking-seat`, `walking-to-seat`, `eating`, `seeking-tray-return`, `walking-to-tray-return`, and `walking-to-exit` map to distinct poses/cues; tick changes motion and reduced-motion freezes it | Visual-recipe test asserts all 11 signatures, tick variation, and reduced-motion determinism; live captures sample movement, queueing, seating, and eating | **Pass automated and sampled visually;** recorded exact-production reduced-motion comparison remains open |
| Balanced stall choice | Preference, quality, price, queue load/preparation, novelty, scaled distance, and wayfinding contribute to deterministic selection | Core regression balances comparable stalls and confirms preferences can beat modest distance | **Pass automated;** long crowd-distribution playtest remains open |
| Queue overlay and count | Renderer uses the exact core queue cells and draws connected lines, reserved cells, direction, and per-stall count badges including zero | Queue-routing/live captures plus queue core tests | **Pass automated and visually sampled** |
| Queue editor and bends | Stall panel exposes cardinal automatic directions and `Bend line`; world edit mode appends/trims adjacent custom cells and persists them | Custom-path acceptance/rejection/persistence tests; queue-editing and custom-queue captures | **Pass automated and visually sampled** |
| Queue and customer obstacle avoidance | Automatic queue routes self-avoid around blocked/reserved tiles; customers reserve a queue position before walking and advance cell by cell | Core test places furniture in the nominal line and asserts the bend; every admitted customer's queue route is asserted walkable | **Pass automated;** extreme player-layout soak remains open |
| Cross-stall queue ownership | Global planning protects every open stall anchor, validates custom paths first, allocates automatic tails by stable ID, ignores closed stalls, and reconciles all live queues after any geometry mutation | Reversed insertion, crossing custom routes, foreign-anchor claims, closed stalls, custom-first reroutes, live queue shortening, active orders, undo, and placement-driven reflow have regressions | **Pass automated** |
| Expansion seams, walls, entry, and exit | Expansion removes the former right/bottom seam, moves the perimeter outward, projects entrance/exit to the live boundary, refreshes leaving routes, and restores endpoints on undo | Core tests cover perimeter/endpoint migration and old-exit non-despawn; first/wide/repeated expansion captures show the live enlarged hall | **Pass automated and visually sampled;** exact-production save/reload and repeated-expansion play remain open |
| Signage/facility utility | Authored modifiers/roles/tags map to spatial/global wayfinding, patience, movement, turnover, cleanliness, ambience, satisfaction, tray-return, water/waste, first-aid, power, and cleaning effects; catalogue surfaces the primary effect | `tests/game/runtime/utility-effects.test.ts` asserts every signage/facility definition has nonzero utility, all signs provide wayfinding, spatial falloff works, and satisfaction remains bounded | **Pass automated;** full-progression balance tuning remains open |
| Game-state UI and movement cues | Planning/open state, queue edit state, stall queue panel, expansion action, customer pose/status cues, carried food, table meals, and a Settings guide for all customer bubbles and the patience ring are connected to the simulation snapshot | Starter, live-service, custom-queue, queue-editing, and expansion captures; exact indicator-mapping regression; retained local-browser guide inspection; lifecycle/core invariant tests | **Pass retained targeted review;** exact-production responsive/accessibility review remains open |
| Preferred guest routes and prediction | Route editor paints patterned teal, saved, undoable keep-clear tiles; weighted A* applies the same preference to actual guests, exit choice, queue insight, and the dashed predicted path while retaining obstacle-safe fallback | Seven focused core regressions plus the 1024 × 640 local-browser keyboard/clear/undo/reload pass | **Pass automated and targeted development-browser review;** fresh exact-production capture remains open |

### Screenshot evidence

All captures are stored outside the shipped repository in a local archive.

| Capture | Evidence focus |
|---|---|
| `hawker-starter.png` | Planning state, starter hall, two distinct stall identities, varied furniture/catalogue previews, queue overlay legend |
| `hawker-live-service.png` | Open-centre state, 24 active visitors, both stall queues, mixed customer poses, occupied seating, meal/service graphics |
| `hawker-queue-routing.png` | Automatic queue-cell routing and live movement around the furnished hall |
| `hawker-queue-editing.png` | In-world queue edit mode and connected editable cells |
| `hawker-custom-queue.png` | Per-stall queue counts, cardinal controls, custom-path status, and bend controls |
| `hawker-expanded.png` | First expansion with updated floor/perimeter composition |
| `hawker-expanded-wide.png` | Enlarged hall framing and projected boundary after further expansion |
| `hawker-expanded-twice.png` | Repeated expansion state, live customers, and expansion control/insight context |

### Exact-production checks still required

1. Record the validated source commit plus current payload/hash, then repeat the visual smoke on that artifact at 1280 x 720 and 1024 x 640, plus required zoom/text-scaling levels.
2. Record browser/OS/GPU, DPR, console errors/warnings, unexpected network activity, resize/suspension/WebGL recovery, and save/reload results.
3. Build an in-world gallery containing every stall ([current counts](design/CONTENT_CATALOGUE.md#roster-counts)). Capture every facade open and closed, with labels readable and shutters fully covering vendors, props, utensils, and service-window activity.
4. For each stall, record the active menu, capture its food/drink display, change at least one enabled dish, and verify the display updates only to dishes that stall actually sells. Include the compact 3 x 2 Kopi Canopy and Sweet Monsoon footprints and the large 5 x 3 Satay Meridian, Straits Hearth, Herbal Cauldron, and Harbour Ember footprints, plus representative rotated placements.
5. Observe vendor idle, preparation, and serving cycles at full motion, then enable reduced motion while the centre is open and while paused. Verify body, arm, utensil, prop, and steam offsets freeze immediately in a stable pose, no information depends on motion, and no flashing exceeds three changes per second.
6. Repeat the stall gallery at standard and lower quality, normal and high contrast, 1280 x 720 and 1024 x 640, and the required zoom/text-scaling levels. Check silhouette separation, counter/vendor layering, menu-prop recognition, name readability, clipping, and non-colour differentiation.
7. Run the all-stall gallery with a representative 80-guest crowd while profiling frame-time, allocation, and memory. The renderer's full-frame redraw and text recreation require browser evidence; visual completeness alone is not a performance pass.
8. Run repeated expansion plus queue edits through save/reload and a long crowd soak; verify customers leave only at the live exit and never traverse furniture.
9. Complete the human visual, accessibility, and Singapore cultural reviews before production approval.
