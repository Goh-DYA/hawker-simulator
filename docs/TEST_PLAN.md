# Test Plan

Status: Release-candidate test matrix; execution evidence belongs in `TEST_REPORT.md`
Primary browser: current stable desktop Google Chrome, exact version recorded at execution

## Quality gates

A release candidate requires a clean install, lint/type checks, production build, unit/integration/content suites, browser critical path, offline and save recovery, accessibility checks, performance benchmark, and a regression pass with no open critical/high defects.

Commands are expected to converge on:

    npm ci
    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm run dev

Only scripts present in package.json may be reported as run. Missing scripts are implementation tasks, not implicit passes.

## Test layout and behaviour-pinning goldens

The Vitest suites under `tests/` mirror the source tree:

| Source | Tests |
|---|---|
| `src/game/core/` | `tests/game/core/` |
| `src/game/runtime/` | `tests/game/runtime/` |
| `src/game/persistence/` | `tests/game/persistence/` |
| `src/game/audio/` | `tests/game/audio/` |
| `src/game/pwa/` | `tests/game/pwa/` |
| `src/config/` | `tests/config/` |
| `src/content/` | `tests/content/` |
| `app/game/` | `tests/app/game/` |
| `tools/nutrition/` | `tests/tools/nutrition/` |

Three suites stay at the root: `tests/hosting-config.test.ts`, `tests/module-docs.test.ts` (every `src/`, `app/`, `tools/` and `worker/` module has a module JSDoc header), and the Node-runner check `tests/rendered-html.test.mjs`.

`tests/setup.ts` fails any test that writes unexpected `console.warn` or `console.error` output, or that raises a Node process warning. A test that deliberately exercises a logging path declares it with `expect_console_warning`, from `tests/console.ts`. `npm run test:ssr` runs with `--throw-deprecation`.

Before the structural refactor, the following suites were written to pin the behaviour of the time. They mostly assert sha256 literals of raw digest strings. Snapshots keep key insertion order (`snapshotFormat.compareKeys: null`), so key-order drift is caught too.

| Suite | What it pins |
|---|---|
| `tests/game/core/golden.test.ts` | Seeded simulation and state digests for six scenarios. One of them runs the production adaptive-arrival model across two operating-day rollovers. All six run without a neighbourhood (`GameState.neighbourhood` undefined), so the neighbourhood's own streams do not move them. |
| `tests/game/core/persistence/index.test.ts`, `migrations.test.ts` | Frozen V1–V5 save fixtures (`save-v1.json` to `save-v5.json` in `tests/game/core/persistence/fixtures/`; `save-v5.json` holds a neighbourhood on day 2 with a finished day-1 report), migration output and the serialisation contract. |
| `tests/game/core/simulation.recovery.test.ts` | In-step customer recovery branches. |
| `tests/game/runtime/createHawkerRuntime.test.ts` | The headless runtime controller, using a deferred Phaser boot and a test-owned clock: export, import and reset, save fallback, and progression across several days. |
| `tests/game/runtime/createHawkerRuntime.render.test.ts` | Exact canvas-paint and sprite-call logs for each render scenario, including every placeable and every recipe variant. |
| `tests/game/runtime/art/*.test.ts` | Every launch stall, placeable, dish and archetype paints without error, deterministically, and differently from its neighbours; every reviewed nutrition variant paints a cue distinct from the fallback. |
| `tests/game/runtime/createHawkerRuntime.input.test.ts` | Build-tool, keyboard, pointer and wheel input flows. |
| `tests/game/persistence/saveStore.test.ts` | The save envelope format, the checksum, active/backup slot rotation and preference ordering, tested on `fake-indexeddb`. |
| `tests/app/game/HawkerSimulator.ssr.test.ts` | Byte-exact server-rendered markup of the game component. |
| `tests/app/game/HawkerSimulator.test.ts` | A jsdom interaction suite: panels, autosave debounce, failures, import, reset, settings clamping, and focus and Escape order. |
| `tests/content/golden.test.ts`, `tests/content/validate.test.ts` | Derived content data, localisation order and validator issues. |
| `tests/tools/nutrition/ratings.test.ts` | Nutrition importer ratings and serialised output from a varied fixture CSV; pins the anchor ratings of the synthetic servings rated through `addHealthRatings` ([ADR 0009](decisions/0009-whole-profile-overall-health-rating.md#documented-properties)). |

The day-rhythm systems have their own suites:

| Suite | What it covers |
|---|---|
| `tests/game/core/rush.test.ts` | The lunch and dinner demand bumps, the rush cores, last orders from 18:10 and no adaptive spawns until the next opening. |
| `tests/game/core/table-clearing.test.ts` | The hash-based tray-return habit, the crew size, trays left when no return is reachable and their clearing, seats with trays skipped, crew capacity, trays dropped with their seat, seated guests finishing past the visit cap, and departure reasons on visit ratings. |
| `tests/game/core/neighbourhood.test.ts` | Day streams seeded only from the world seed, system and day; the shuffle bag (opening day, no consecutive repeats, every card before a repeat); the director's tilt and day performance; card effects on the crowds; the day-end report, `day-ended` event and fresh ledger; seeded reproducibility; peak reputation; the food writer's threshold ladder, plaque, no-plaque and too-few-visits verdicts, review window and schedule; and the seeded daily objectives and their targets. |
| `tests/game/core/reputation.test.ts` | The wait component's patience grace and linear fall, and the reputation moving average: its smoothing, settling, recovery, monotonicity and bounds. |
| `tests/content/calendar.test.ts` | The authored day cards: unique IDs, one opening day, enough bag cards, launch personas and dish categories only, calm and busy cards, an ordinary opening day, and copy that labels neither food nor people. |

Run the suites with `CI=true npm test`, so that a missing snapshot fails instead of being written. A golden literal or snapshot should change only in a commit that intentionally changes behaviour or balance, and that commit should state the reason.

## Automated test inventory

### World and build

- Grid/world conversion round trips at edges and zoom-independent coordinates.
- Rotated footprints and collision cells for every allowed rotation.
- Bounds, overlap, locked-area, entrance, exit, and interaction-point validation.
- Place, move, rotate, store, sell, expansion, cancel, and multi-step undo.
- Atomic rejection leaves cash, map revision, reservations, and selection unchanged.
- Entrance and every active stall/service/seat/return interaction remain reachable.

### Navigation and reservations

- Four-way A-star shortest/valid path, deterministic tie-breaking, no-path result.
- Preferred-route weighting changes a practical path deterministically without creating a hard waypoint; distant/incomplete guides retain safe fallback routing.
- Route-guide validation, canonicalization, live-path invalidation, placement/queue reservation, persistence, clearing, and multi-step undo.
- Map revision invalidates cache and active affected paths.
- Queue slot reservation/order/advance/release; no duplicate owners.
- Seat selection, group capacity, reservation release, and abandoned visit cleanup.
- Stuck detection bounded retries and safe departure.
- Stall closure/move, seat move/removal, destination deletion, and map edit during walking.

### Customer simulation

- Every legal lifecycle transition and every illegal transition rejection.
- Stall choice term sensitivity: preference, price, queue, quality, novelty, distance.
- Seat choice term sensitivity: path, group, comfort, cleanliness, congestion.
- No available stall, unaffordable dish, no seat, all exits stressed, and centre close.
- Deterministic seeded results and agent despawn.
- Rush demand peaks at lunch and dinner, backpressure halves inside a rush core, and the adaptive model spawns nobody from last orders until the next opening.
- Tray return requires a reachable return within 14 path tiles and the persona's hashed habit; an unreturned tray blocks its seat until the crew (one plus one per tray-return station) clears it, oldest first; seated guests finish past the visit cap.
- The neighbourhood draws only from its day streams, never `rngState`; the same world seed reproduces the same calendar, writer schedule and objectives.
- Nutrition-intent assignment is seed-reproducible, independent of persona, limited to one intent from level 2, and consumes one roll only under its documented conditions.
- Health-condition assignment is seed-reproducible, independent of persona and appearance, limited to at most one eligible condition, and covers high cholesterol, obesity, diabetes, and hypertension without changing archetype data.
- Star ratings affect taste/popularity appeal independently from general and condition-specific Health ratings; condition-aware customers prefer stalls and dishes using their personalized Health fit.
- Only the configured order-time variant contributes nutrition choice weight and outcome; changing a variant during preparation cannot rewrite the order.
- Nutrition-intent matched, missed, and unknown outcomes update once at sale without changing satisfaction. Condition-aware meal fit is frozen at order time, produces only the documented -0.2 to +0.2 satisfaction effect, and does not rewrite price, Star rating, cash, XP, or reputation.

### Economy and progression

- Sale/cost/upkeep rounding, satisfaction bounds, XP/reputation, upgrade effects.
- Unlock graph, exact prerequisites, objective completion idempotency.
- Unlock gates read peak reputation, which never falls below live reputation; live reputation settles at the level steady service reflects and recovers after poor visits.
- Seeded objectives keep the fixed day-1 set, then scale from the previous day's report and never fall below the fixed floors; Writer's Pick thresholds rise by 3 per plaque up to 82, and a miss costs nothing.
- Resale/undo accounting and recovery grant eligibility.
- No negative cash from passive upkeep and no infinite reward loop.

### Content

- Zod parse and safe error for malformed definitions.
- Unique IDs/keys and valid cross-references.
- The [roster counts](design/CONTENT_CATALOGUE.md#roster-counts): exactly 18 stalls, 91 dishes, and 12 archetypes, at least 80 placeables, and 402 English localization entries.
- Every dish assigned, every stall has a menu item available at its unlock and at least one opening dish at or below the Student Saver's $6.50 mid budget, stalls authored in unlock order (each at a later level than the one before, apart from the two level-1 starters), every required English key present, no unlock cycles.
- Footprint/interaction/depth anchors valid, every referenced visual/audio/animation known, and every stall/dish primary visual reference unique.
- Catalogue duplicate policy check.
- Exact 171 released nutrition profiles, 23 reviewed variant families with 103 selectable variants (80 beyond the defaults), and one released base profile plus Star rating for all 91 dishes.
- In every variant family the default rates strictly below another option, and some option is at least 0.3 higher overall or no lower overall and at least 0.5 higher on one condition, on displayed ratings; no two profiles share a source row, multiplier and component list; no Borrowed source row is a primary, a single-row variant or a composite's first component, and only `BORROWED_COMPONENT_ALLOWLIST` rows are accepted as later components; no limit nutrient is withheld by the outlier fence.
- Overall Health and all four condition ratings are finite and bounded from 1 to 5; high-cholesterol, obesity, diabetes, and hypertension schemes use their documented nutrient families and remain distinct from Star ratings.
- The overall meal Health rating keeps its locked checks ([ADR 0009](decisions/0009-whole-profile-overall-health-rating.md)): chicken congee and char siew rice both rate 3.5 or above and within 0.3 of each other; no meal holding 2,000 mg of sodium or more rates above congee, and every meal holding 2,500 mg or more rates below it; a meal holding two limit nutrients at two thirds of a day or more rates 2.5 or below; every meal rates at or above its lowest condition rating and at most 2.5 above it; and the 30 local swap orderings from "Healthy hawker eats" hold.
- Every released profile, meal or drink, carries two or three `healthReasons` and no unreleased profile does; concerns come before strengths, each nutrient appears once, a "low" reason rests on a reported amount and only a reason on a stand-in amount is marked estimated; `dailyReference` holds the four daily amounts. The tooltip lists them for every profile within the copy rules (no judgement word and no score, weight, star, part or percentage), names its button for the badge it explains, and hides on Escape without closing the panel or dialog around it.
- Deterministic CSV generation, source and row hash drift, serving scaling, malformed booleans, `Trace`, unavailable values, quarantine rules, intent-fit percentile ties, the guideline-anchored rating curves and missing-value rules, the overall meal rating anchors (lean and on-budget servings, sodium falling with no plateau, saturated fat by the day) and its monotonicity over every released meal (more of a limit nutrient never raises it; more fibre or protein never lowers it), and incompatible daily-guideline comparisons.

### Stall graphics and animation

- All 18 stall visual recipes are deterministic and materially distinct in facade layers, equipment, counter treatment, food/drink display, and vendor treatment rather than palette alone.
- Every displayed food or drink prop resolves to a dish in that stall's active menu; enabling or disabling a dish updates the display deterministically and never leaks another stall's menu item.
- Vendor animation recipes consume each stall's authored idle, preparation/cooking, and serving references; full-motion poses vary by tick while reduced-motion poses have zero body, arm, utensil, prop, and steam offsets and remain tick-invariant.
- Closed stalls render an opaque shutter state that hides the vendor and service props; open/closed changes do not alter simulation state beyond the existing operational command.
- Stall drawing geometry remains inside both compact and large rotated footprints and preserves the vendor-behind-counter, props-in-front, shutter-on-top layer order.

### Persistence

- Serialize/deserialize round trip and checksum rejection.
- Atomic current/backup promotion and failed-write recovery.
- Version fixtures migrate one step and end-to-end.
- Renamed/removed objects and dishes, added required fields, changed map size/upgrades.
- Unsafe runtime customers normalize without losing map/economy/progression.
- Quota error, denied/private storage, refresh during save, reset isolation.
- Core V4-to-V5 migration (peak reputation at the saved reputation, a `null` neighbourhood that the runtime seeds from `rngState`). Core V3-to-V4 and runtime V1-to-V2 nutrition migrations, default/locked/tampered variant repair, data-version recovery notice, and 50-record outcome cap.

### Offline shell and UI

- Manifest and required service-worker assets are build outputs.
- Precache manifest has no development paths, secrets, or cross-origin core assets.
- Offline navigation shell responds after first successful load.
- Waiting-worker update does not activate before a safe reload.
- React error/loading states, modal focus, settings persistence, and reset confirmation.
- Nutrition Lens value semantics, distinct text-labelled Health and Star ratings, condition-specific explanations, Variant Lab focus return, customer inspector departure, responsive Focus route, per-nutrient Pulse denominators, disclosure, and no color-only rating or delta.

## Browser end-to-end scenarios

1. Clear site data; load the production build and start a new game.
2. Complete or deliberately skip/replay the tutorial.
3. Keyboard-place a table, seats, tray return, and stall; verify invalid placement feedback.
4. Paint a preferred guest lane with pointer and keyboard controls; verify predicted-path shift, clear, undo, save/reload, and Escape speed restoration.
5. Configure a menu, compare a reviewed variant, and open the centre.
6. Observe one customer complete order, seat, eat, tray/clear, and exit. Without a nearby tray return, verify the tray stays on the seat, the seating card counts it and the crew clears it.
7. Confirm cash/XP/reputation change, inspect the reason breakdown, fictional nutrition intent, optional health condition, Health/Star ratings, and Nutrition Pulse. Verify nutrition intents do not change satisfaction and any condition-aware meal effect stays within the documented bound.
8. Move an active target and verify recovery.
9. Save, reload, and compare persistent map/progression/economy state.
10. Change text scale, reduced motion, audio, and quality mode; reload.
11. Install/cache once, go offline, reload, continue, save, and reload again.
12. Trigger update flow with a second build; preserve save.
13. Reset with cancel first, then confirm; verify only game-owned data is cleared.
14. Play through a full day: verify the forecast for tomorrow, the rush notice before lunch and dinner, last orders, the Service Review at day end and the next day's card matching the forecast; with a food-writer day, verify the review window and verdict.

Run at 1280 × 720 and 1024 × 640, plus zoom levels in [ACCESSIBILITY.md](release/ACCESSIBILITY.md).

### Stall graphics browser matrix

1. Place all 18 stall identities in a deterministic gallery and capture each open facade at useful game zoom. Verify roof, fascia, sign, wall, window, counter, equipment, trim, props, and vendor form a readable layered scene and no two stalls are distinguishable by palette alone.
2. For every stall, compare the visible display with its active menu, disable at least one displayed dish, enable another valid dish, and verify the food/drink props update without showing an unavailable or cross-stall item.
3. Close and reopen the centre. Verify every closed shutter completely masks the vendor and work props, every reopened scene returns, and labels/queue overlays remain readable in both states.
4. Cover compact 3 x 2 and large 5 x 3 stalls, including representative 0-, 90-, 180-, and 270-degree placements. Check clipping, counter-facing placement, service-point clarity, vendor containment, and prop overlap.
5. At full motion, observe deterministic idle, preparation/cooking, and serving actions long enough to see each cycle. Pause and resume without a phase jump that clips the vendor through the counter or equipment.
6. Enable reduced motion through both the OS preference and in-game setting while open and while paused. Verify vendor body, arm, utensil, prop, and steam offsets freeze immediately in a stable pose, with no gameplay timing or textual state change.
7. Compare normal and high contrast at 100% and 200% zoom. Verify stall silhouettes, food vessels, vendors, counters, shutters, names, and open/closed state remain distinguishable without colour alone.
8. Repeat the all-stall scene in lower quality at 1024 x 640 and standard quality at 1280 x 720, then run it with a representative 80-guest crowd. Record console output, frame-time, allocation, memory trend, clipping, flicker, and any missing vendor or menu prop; do not infer renderer performance from the headless simulation benchmark.

## Soak and adversarial simulations

Use seeded headless/fixed-step runs for 30 simulated in-game days and at least one two-hour real browser soak. Sweep customer caps and layout density. Assert bounded agents, queues, reservations, path requests, event history, memory trend, cash, and objective progress.

Required edge cases:

- all entrances blocked (placement must reject);
- all seats/stalls removed or closed;
- stall moved during queue and seat moved while reserved;
- hundreds attempt to leave;
- WebGL context loss and restoration;
- tab hidden/suspended and long wall-clock gap;
- resize/zoom during placement;
- service-worker update during active play;
- old save with missing content;
- storage quota exceeded.

## Manual QA areas

Build/camera, stalls/menus, customer lifecycle, queues/seating, diagnostics, economy/progression, tutorial, audio, keyboard/focus, reduced motion, zoom/reflow, save/recovery, offline/update, Chrome/Edge/Firefox, performance tiers, and long play.

Defects record ID, build, browser/OS, severity, preconditions, exact steps, expected, actual, evidence path, owner, fix, and regression status.

Severity:

- Critical: data loss, security/privacy exposure, app cannot launch, unrecoverable core progression.
- High: core loop blocked, common save/offline failure, essential accessibility failure.
- Medium: incorrect recoverable behavior or major presentation issue.
- Low: polish, rare cosmetic defect, documentation mismatch.

## Evidence policy

Retain command output, exact browser versions, screenshots, benchmark JSON, test seed, build identifier, and pass/fail totals. A planned test is not a passed test. Human cultural, legal, security, and accessibility review are tracked separately from automated QA.

## Performance budget

These budgets are provisional; supported limits require measurement. Measured results belong in the [performance evidence](TEST_REPORT.md#performance-evidence) of `TEST_REPORT.md`.

### Reference conditions

- Desktop Chrome stable, 1280 × 720, device pixel ratio recorded.
- Mid-range reference hardware and one lower-end reference device must be described in the [performance evidence](TEST_REPORT.md#performance-evidence) of `TEST_REPORT.md`.
- Standard mode targets 60 FPS; lower-end mode targets 30 FPS.
- Benchmark scene: late-game unlocked map, mixed furniture, all 18 stalls, visible queues, normal audio, and seeded arrivals.

### Budgets

| Metric | Standard target | Lower-end target | Measurement |
|---|---:|---:|---|
| Initial compressed JS/CSS | ≤ 1.5 MB | same | build manifest / transfer |
| Initial art + fonts | ≤ 2 MB | ≤ 1.5 MB | cold transfer |
| Deferred runtime assets | ≤ 8 MB | ≤ 5 MB | manifest |
| Time to interactive | ≤ 4 s cold, ≤ 2 s warm | ≤ 6 s cold | browser trace |
| Texture memory | ≤ 128 MB | ≤ 64 MB | renderer estimate |
| Total tab memory | ≤ 350 MB | ≤ 220 MB | browser task manager/measure |
| Draw calls | ≤ 150/frame | ≤ 100/frame | renderer counter |
| Visible active sprites | ≤ 600 | ≤ 350 | debug counter |
| Simulation p95 | ≤ 4 ms/tick | ≤ 8 ms/tick | internal timer |
| Render p95 | ≤ 12 ms/frame | ≤ 25 ms/frame | frame instrumentation |
| Path requests | ≤ 20/tick burst, 5 average | ≤ 10/tick burst, 3 average | counter |
| Save snapshot + write p95 | ≤ 100 ms | ≤ 150 ms | performance marks |
| Simultaneous audio voices | ≤ 16 | ≤ 8 | mixer counter |
| Long-task count during normal minute | 0 over 100 ms | ≤ 1 over 100 ms | PerformanceObserver |

Initial customer design caps are 120 standard and 60 lower-end. These are test inputs, not supported claims. The supported active-customer maximum must be lowered to the largest count that passes frame, simulation, memory, queue/recovery, and two-hour soak gates on the reference devices.

### Quality-tier behavior

Lower-end mode reduces particles, decorative animation, off-screen animation updates, reaction frequency, audio voices, light/effect density, and high-DPI render scale. It staggers decisions more aggressively while preserving customer choices, economy, reservation correctness, and save results.

Automatic mode may recommend a tier after a short local sample but must not oscillate. The player can override it. Quality choice is persisted locally.

### Measurement protocol

1. Production build only; close unrelated high-load tabs.
2. Record build hash, browser/OS, CPU, RAM, GPU, viewport, DPR, power mode, and quality.
3. Use the same seed and benchmark snapshot for each run.
4. Warm up 60 seconds; record at least five minutes at 30, 60, 90, 120, and 150 attempted customers.
5. Capture FPS p50/p95 low, simulation/render p95, paths, draw calls, sprites, memory start/end, and stalls/queues completed.
6. Run a two-hour soak at the proposed supported cap and investigate trend, not just final memory.
7. Repeat three times; publish raw results and medians. Do not average away a failed recovery or data-integrity event.

### Optimization order

Measure first, then reduce unnecessary allocations and redraws; stagger AI; cache revision-safe paths; pool frequently churned objects; simplify off-screen animation; atlas stable images; defer noncritical assets. Web workers or texture compression require measured benefit that outweighs complexity and compatibility cost.

No benchmark has yet established that these budgets or customer caps are met.
