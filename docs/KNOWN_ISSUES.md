# Known Issues

Status: Release-candidate verification list; not a customer-facing production issue list

This document owns the release blockers, the open issues and the deferred engineering debt. Gate evidence lives in [TEST_REPORT.md](TEST_REPORT.md) and content counts in [CONTENT_CATALOGUE.md](design/CONTENT_CATALOGUE.md#roster-counts); see the [documentation index](README.md).

## Project status

Last updated: 2026-10-17
Phase: Content `1.3.0` nutrition and stall expansion passes working-source automation and targeted nutrition browser QA; exact-production and human verification pending
Release status: **NO-GO for production approval**

This section is a summary of the current position; the blockers, issues and debt follow it.

### Current position

Hawker Balance is implemented as a deployable, local-first browser game. The React interface mounts a Phaser world backed by a deterministic TypeScript simulation, the complete launch catalogue and reviewed nutrition snapshot are runtime-integrated, and production build, save, offline-shell, accessibility, and release-gate code paths are present.

The working source includes layered stall facades, active-menu food displays, a vendor identity for every stall, per-item and per-variant visual recipes, visible meals and lifecycle animation, progression- and schedule-aware customer personas, balanced stall selection, globally unique obstacle-safe configurable queues, a saved preferred-route editor, geometry-aware queue-flow guidance, distance-based route-efficiency ratings, coherent expansion-boundary migration, functional signage/facility effects, nutrition-aware customer decisions and objectives, the Nutrition Lens, Variant Lab, customer inspector, Nutrition Pulse, and an approval-gated Vercel delivery pipeline. Content `1.3.0` expands the stall, dish, and nutrition roster ([counts](design/CONTENT_CATALOGUE.md#roster-counts)). All of its source nutrition profiles are released, the reviewed variant families expose selectable preparations, every dish has a distinct Star rating, and every profile has overall and condition-specific Health ratings.

The content `1.3.0` working source passes typecheck, lint, Vitest, the five-environment Vinext build, the rendered-output/offline-shell assertions, and the native Next.js Vercel build; the dated results and service-worker build ID are in [TEST_REPORT.md](TEST_REPORT.md). A targeted 1280 x 720 development-browser pass covered the expanded nutrition menu, variant comparison, and condition-aware customer inspector without browser warning or error messages. Commit/artifact hashes, payload totals, exact-production browser/offline evidence, exhaustive galleries, and human reviews remain pending.

Package version `1.0.0` remains an internal artifact identifier until the exact-production browser/offline gates and required human reviews close.

### Release-candidate summary

| Area | State | Current evidence / remaining gate |
|---|---|---|
| Product/game/technical/art plans | Implemented and documented | Product brief, GDD, technical design, art bible, economy, content, accessibility, testing, security, deployment, and ADRs are present |
| Stack and architecture | Implemented | TypeScript + React/Vinext/Vite with Phaser 4.2.1; deterministic simulation is separated from rendering |
| Perspective/style | Implemented | Orthographic top-down square grid with code-native, shape-led illustrated 2D rendering |
| Launch content | Content `1.3.0` typed roster passes automated validation | The roster and its counts are in [CONTENT_CATALOGUE.md](design/CONTENT_CATALOGUE.md#roster-counts); every nutrition profile is released, and every profile has overall and condition-specific Health ratings |
| Core simulation | Automated coverage present | Placement/path validation, deterministic lifecycle, balanced stall selection, weighted preferred guest routes, obstacle-safe queue reservations, custom queue routes, target recovery, economy, progression, moving expansion boundaries/entry/exit, and undo |
| Game/UI integration | Implemented | Build catalogue, camera/input, menus, separate legacy and nutrition tutorials, objectives/insights, Nutrition Lens, Variant Lab, selectable customer inspector, responsive Focus access, Nutrition Pulse, settings, save tools, coherent expansion, preferred-route and per-stall queue editors, utility descriptions, visible food, and live status UI |
| Persistence | Implemented with automated core coverage | IndexedDB active/backup envelopes, checksums, serialized writes, core V3-to-V4 and runtime V1-to-V2 migrations, nutrition history and active-variant recovery, import/export, and reset; real-browser storage fault injection remains open |
| Offline/PWA | Implemented; replacement static assertions pass | Real offline restart/update verification must still be exercised on the replacement production artifact |
| Automated QA | Current working-source gate passes | Typecheck, lint, Vitest, both production builds, and the rendered-output/offline-shell assertions pass; see [TEST_REPORT.md](TEST_REPORT.md) |
| Browser QA | Current targeted nutrition pass plus retained earlier evidence | At 1280 x 720, the development browser passed nutrition badges, 12-field details, condition ratings, variant comparison, and a condition-aware customer inspector with no warning/error console messages. Exact-production, all-stall / all-dish, 1024 x 640, offline, storage, accessibility, and secondary-browser gates remain open |
| Performance | Node budget passed; browser evidence open | `benchmark-80-agents` exercised 80 active agents for 1,200 fixed steps within its simulation budget; browser FPS/frame time, memory, TTI, and supported caps remain unclaimed, especially because the renderer still performs full-frame redraws and recreates text during frame rendering |
| Accessibility | Engineering support implemented; human audit pending | Semantic DOM controls, keyboard actions, focus-managed dialogs, text scaling, high contrast, reduced motion, visual audio equivalents, a text-paired customer-status legend, and degradation messages are present; assistive-technology and human review remain open |
| Cultural review | Research-informed internal review only | Fictional names/marks and original presentation are used; Singapore-informed human review remains a release blocker |
| Security/privacy/legal | Engineering controls implemented; independent reviews pending | Local-only data posture, bounded save import, no analytics/accounts/payments, CSP/security headers, and notices are present; the production-only npm audit passes but the all-dependencies audit currently fails (see [TEST_REPORT.md](TEST_REPORT.md#dependency-audit)), and independent reviews remain open |
| Deployment | Content `1.3.0` local builds pass; publication pending | Vinext and native Vercel builds pass locally (see [TEST_REPORT.md](TEST_REPORT.md)). The recorded private preview commit and URL predate the expansion; current commit/publication, Vercel project setup, protected environment, Preview, and staged deployment evidence remain open |

### Implemented launch scope

- Complete customer lifecycle: arrive, choose a stall, queue, order, collect food, reserve a seat, eat a visibly rendered meal, return a tray when possible, exit, and despawn.
- Balanced customer choice: preferences, quality, price, wait, novelty, distance, and wayfinding influence stall selection instead of entrance proximity dominating.
- Dynamic queue management: per-stall counts, automatic direction, player-authored bends, reserved positions, and obstacle-safe movement.
- Operational build mode: place, inspect, move, rotate, remove/sell, undo, paint preferred guest lanes, edit queues, and expand while protecting navigation and migrating the live perimeter, entrance, and exit.
- Code-native visual system: the working source defines and automatically validates a distinct contract for every placeable, a layered identity with vendor workwear/tools/actions for every stall, active-menu food displays, a food/vessel recipe for every dish, an appearance for every customer archetype, every lifecycle pose, carried/seated meals, queue overlays, high-contrast separation, and reduced-motion-safe animation. The complete browser gallery and human visual/cultural review remain open; no source contract constitutes human approval.
- Meaningful facilities and signage: spatial/global wayfinding, patience, movement, turnover, cleanliness, ambience, satisfaction, tray-return, and facility effects are surfaced and applied by the simulation.
- Economy/progression, onboarding, objectives, diagnostics, accessibility settings, procedural audio, local saves, PWA manifest, offline fallback, and update-ready flow.
- Reviewed nutrition variants, separate Health and Star ratings, independently assigned condition-aware customer choices and bounded satisfaction effects, fictional nutrition intents, order-time variant snapshots, serving feedback, daily nutrition objectives, contextual Singapore-adult reference data, and an explicit educational-not-medical-advice disclosure.

### Remaining NO-GO gates

The remaining release blockers are listed, with what closes each one, under [Remaining release blockers](#remaining-release-blockers). They cover exact-production browser and offline evidence (including profiling the full-frame redraw and text-recreation path), the failing all-dependencies audit, deployment publication, and the human cultural, accessibility, security, and legal/privacy reviews.

### Evidence rule

Do not translate "implemented," "compiled," or "unit-tested" into an exact-production browser, accessibility, cultural, legal, security, or compliance claim. Before approval, add the outstanding build, browser/offline, and human-review records to the release evidence.

## Remaining release blockers

1. **Content `1.3.0` release and browser QA is incomplete.** The working source defines the expanded content `1.3.0` roster ([counts](design/CONTENT_CATALOGUE.md#roster-counts)), but the retained supported-runtime release gate, production builds, and development-browser screenshots apply to earlier content. The complete gate and both builds must be rerun, then current stable Chrome critical-path evidence, console/network review, viewports/zoom, save/reload, resize/suspension/WebGL-loss behavior, and measured browser performance must be recorded on the exact artifact. Edge/Firefox smoke results are also absent.
2. **Real offline/PWA behavior is unverified on the replacement artifact.** First-load cache population, offline reload, browser restart, offline saving, waiting-worker update, mixed-version avoidance, and rollback must be exercised on the final origin.
3. **Human Singapore cultural review is pending.** Internal research and safeguards do not substitute for Singapore-informed review. The review now covers the painted-sprite art of [ADR 0005](decisions/0005-painted-sprite-rendering.md); the painter contact sheets from `tools/paint-gallery.ts` are the review material.
4. **Human accessibility and assistive-technology review is pending.** Keyboard, screen-reader, zoom/reflow, contrast, reduced-motion, focus, and audio-equivalence behavior needs human verification in the exact browser build.
5. **Independent security and qualified legal/privacy review are pending.** Internal controls, tests, notices, and dependency-audit results (see [TEST_REPORT.md](TEST_REPORT.md#dependency-audit)) are evidence inputs, not an approval or compliance claim.
6. **No Vercel Preview, staged deployment or promotion has been recorded for the current source.** The pipeline needs the documented Vercel project, GitHub secrets, protected `production` Environment and user approval; see [DEPLOYMENT.md](DEPLOYMENT.md) and the gate record in [TEST_REPORT.md](TEST_REPORT.md#gate-record).

## Open gameplay balance issues

- **The 120-second visit cap can still end a visit before the meal.** Seated guests now finish their meal and clear their tray past the cap, but a served guest still walking to a seat or searching for one leaves when the cap is reached. Preparation and eating durations still need a balance pass against the cap.
- **Some authored persona fields remain future hooks.** Budgets, patience, walking speed, stall-choice sensitivities, novelty, dish preferences, progression gates, visit schedules, and tray-return chance are active. Seat preference, group range, satisfaction modifiers, and spend multiplier are validated content metadata but do not yet alter the simulation.
- **Reloading mid-day empties the hall.** Customers, queues, seat reservations and uncleared trays are runtime-only, so a reload during a rush removes the waiting guests (they count as neither served nor left early) and clears every tray.

## Implemented but awaiting exact-production evidence

- The working source defines code-native contracts for every placeable, stall, dish, customer archetype, and customer state in the [launch roster](design/CONTENT_CATALOGUE.md#roster-counts). The two new stall and eight new dish treatments still need the current automated recipe pass and exact-production gallery; automated contracts will not replace final human visual/cultural review.
- Per-stall queue counts, automatic direction, editable bends, obstacle-safe reserved queue cells, and customer movement through the resulting cells are implemented and covered by core tests. Long-running browser crowd behavior and extreme player-authored layouts still require soak/playtest evidence.
- Expansion migrates the former right/bottom perimeter outward, projects entrance/exit points to the new boundary, refreshes exiting paths, and restores endpoints on undo. Core regressions and development-browser expansion screenshots pass; exact-production save/reload and repeated-expansion play remain open.
- Signage/facilities now apply visible, documented effects such as wayfinding, patience, movement, turnover, cleanliness, ambience, satisfaction, and tray-return support. Balance tuning across a complete progression playthrough is not yet accepted.
- IndexedDB, service-worker, accessibility, audio-degradation, and security-header implementations retain automated coverage, but final browser/fault-injection evidence (including active/backup IndexedDB recovery under quota and private-mode limits) must target the replacement artifact.
- The current Node benchmark passes with 80 active agents over 1,200 fixed steps, but it cannot establish Phaser FPS, TTI, memory stability, or a supported browser customer cap.
- The renderer paints each texture once and keeps retained sprites and pooled labels ([ADR 0005](decisions/0005-painted-sprite-rendering.md)), but browser FPS, texture memory and the one-off painting cost (for example the floor repaint after a route-guide edit, about 147,000 canvas calls at full detail on the expanded map) are outside the Node benchmark and still require profiling before performance approval (see TD-50 under [Deferred engineering debt](#deferred-engineering-debt)).

## Previously listed concerns closed by implementation or current automated evidence

- Pick & Mix and Herbal Cauldron no longer use the generic stall art (TD-47): every stall is painted as its own cutaway kitchen, and `tests/game/runtime/art/stalls.test.ts` requires each stall to paint differently from the others at every rotation.
- Entrance-nearest-stall crowding is mitigated by a deterministic score that accounts for preference, quality, price, wait, novelty, scaled distance, and global wayfinding; comparable stalls and preference-over-distance behavior have regression tests.
- Straight queues through furniture are replaced with obstacle-aware automatic paths and validated custom routes; every admitted customer is asserted to receive walkable route cells.
- Expansion no longer leaves the old right/bottom boundary as an internal seam, and customers do not despawn at the old exit after expansion.
- Furniture and facilities are no longer represented only by category-identical graphics: every placeable ID has a distinct visual contract/motif and catalogue preview.
- Customers visibly carry and consume dish-specific food/vessel graphics; all authored dish metadata is consumed by the visual recipe layer.
- Signage and facility utility is no longer presentation-only: every authored signage/facility item maps to at least one simulation effect.
- Validators and regressions remain present for launch counts, lifecycle recovery, save migration, economy/progression, undo, and deterministic soak behavior; the content `1.3.0` full run still needs to be recorded.

## Known behaviour defects (pinned, not fixed)

These defects were confirmed during the 2026-10 structural refactor and deliberately left unchanged, because that refactor preserves player-visible behaviour. Golden tests pin the current behaviour, so each fix is a behaviour change that needs an intentional golden re-baseline, a changelog entry and a release note. The IDs refer to the refactor's technical-debt register.

- **TD-06: exported saves cannot be re-imported.** The save checksum is computed over a stable serialisation that includes keys whose value is `undefined` (for example an absent `queuePath`), while the exported JSON drops those keys, so importing any real export fails the checksum check (pinned in `tests/game/persistence/saveStore.test.ts`).
- **TD-36: save and offline failure paths, and over-broad catches.**
  - The startup catch-all can turn a code bug into a wiped save after two autosaves.
  - An active save that fails its checksum falls back to the backup without telling the player.
  - A rejected IndexedDB open is cached, so later attempts do not retry.
  - In `public/sw.js`, a failing `cache.put` of a fresh navigation response throws into the offline branch, so a good network response is replaced by the cached shell.
  - The catches around rotation normalisation and map expansion in the core build commands (`src/game/core/build.ts`, formerly part of `commands.ts`) and the catch-all in `validateCatalog` (`src/game/core/validation.ts`) turn any thrown error into a rejection or validation issue. Narrowing them to the expected error types changes which failures surface.
- **TD-46: latent gameplay defects.**
  - Importing a save does not recompute the access-point ID counter, so a new entrance or exit can get an ID that collides with an imported one and is rejected (pinned in `tests/game/runtime/createHawkerRuntime.input.test.ts`).
  - A pending move survives a reset, so after the move tool is chosen again the first click moves the fresh centre's object with the same ID (pinned in `tests/game/runtime/createHawkerRuntime.input.test.ts`).
  - Some build commands and target reconciliation read the raw catalogue instead of the upgrade-adjusted one, so, for example, placing a seat trims an upgraded stall's queue to its base capacity (pinned in `tests/game/core/simulation.recovery.test.ts`).
  - There are 12 vendor apron colours for 14 stalls, so the apron index wraps and the two newest stalls reuse the first two colours.
  - The HUD computes its cleanliness reading with its own formula (`src/game/runtime/snapshot.ts`), which diverges from the simulation's.
  - The HUD snapshot lags one command behind move-tool selection, and adding an access point emits its snapshot before selecting the new point.

## Deferred engineering debt

These items were recorded during the 2026-10 structural refactor and left for separate changes.

- **TD-50: per-frame and per-tick recomputation of layout-only data.** The HUD runs a path search for every entrance-exit pair each frame, and number formatters are rebuilt per call. This is within budget today; caching it needs a browser benchmark first, because a wrong cache key causes visible regressions.
- **Painted-art follow-ups ([ADR 0005](decisions/0005-painted-sprite-rendering.md)).**
  - A diner always faces the table, so a chair the player left facing away from its table seats its diner backwards; auto-orienting chairs or showing the facing more clearly in the placement ghost is undecided.
  - Hung signs, panels and lights draw above guests, so a guest standing under one is partly covered by it; the 16 px overhang leaves no room to hang them higher.
  - Cups, steamers and bowls are painted at their size relative to a plate, so their HUD dish thumbnails are smaller than plate dishes.
  - On the 3 × 2 stalls turned 90 or 270 degrees, the kitchen is cramped and the signboard text is small, and a vendor's arm reaching over the side counter is drawn under it.
  - At the short ends of the standing snack ledge, meals can overlap the meals of side diners.
- **TD-52: `app/globals.css` is a single append-only stylesheet of about 4,700 lines**, with the same selectors defined far apart. A feature-grouped split needs a cascade-order plan, because a contiguous split does not fix the scattered selectors.
- **Remaining development-dependency advisories.** CI gates on the production-only audit (`npm audit --omit=dev --audit-level=high`), which passes. The all-dependencies audit still reports high findings from the `braces` advisory GHSA-vfj7-8cjw-p6xm, which has no patched release and reaches the tree only through the development tools `eslint-config-next` and `vinext`; it clears once `braces` publishes a fix or `@next/eslint-plugin-next` and `vite-plugin-dynamic-import` (through `vinext`) stop depending on `fast-glob`. The moderate `vitest` advisory needs 4.1.11, which npm 10.9 currently fails to resolve. See [TEST_REPORT.md](TEST_REPORT.md#dependency-audit) for the current result.
- **Node and npm version pinning.** There is no single pinned Node version shared by CI and local work, and the npm version that produced the lockfile is not declared.
- **Service-worker stamp tool (`tools/stamp-service-worker.mjs`).** The build hash depends on the platform, because native path separators and the file sort order feed it, so Linux and Windows builds stamp different IDs. Every build rewrites the tracked `public/sw.js`. The `1.0.0` version prefix is hard-coded, and filesystem errors while collecting files are swallowed. Generating `public/sw.js` from a tracked template is also deferred.
- **Deployment smoke tool (`tools/smoke-deployment.mjs`).** It runs at import time, and its assertions repeat the rendered-output checks instead of sharing them.
- **Unused image-optimisation branch.** `worker/index.ts` still handles `/_vinext/image`, which the app does not use.
- **CI secret scoping and Dependabot.** The deploy secrets are scoped to whole jobs, so the `npm ci` lifecycle scripts can see them, and there are no automated dependency-update pull requests.

## Reporting rule

Do not remove a remaining blocker without a dated evidence record. Development-browser screenshots demonstrate targeted visual behavior; they do not replace an exact-production critical-path, offline, performance, accessibility, cultural, legal, or security review.

## Risks

Scale: probability and impact are Low / Medium / High. Owner is the solo developer unless marked Human review.

| ID | Risk | P | I | Mitigation / trigger | Status |
|---|---|---|---|---|---|
| R-01 | Scope exceeds solo capacity | H | H | Lock 1.0 non-goals; data-driven reuse; phase gates; cut optional polish first | Open |
| R-02 | Customer reservation/path deadlock | H | H | Explicit ownership/release, map revisions, stuck recovery, seeded soak assertions | Open |
| R-03 | Save corruption or migration loss | M | H | Single-transaction active/backup slots, envelope checksum, frozen V1-V4 fixtures and migration tests, documented invariants in [SAVE_FORMAT.md](SAVE_FORMAT.md#invariants), non-destructive failure UI | Open |
| R-04 | Service-worker mixed versions or stale shell | M | H | Atomic precache, version manifest, waiting-worker save/reload, update E2E | Open |
| R-05 | Cultural flattening, misattribution, or certification misuse | M | H | [CULTURAL_REVIEW](release/CULTURAL_REVIEW.md) checklist, no marks/claims, compensated human review | Open; release blocker |
| R-06 | Canvas blocks keyboard/screen-reader access | H | H | DOM command layer, grid cursor, reason summaries, human AT audit | Open |
| R-07 | 120/60 proposed customer caps miss frame budget | H | M | Benchmark sweep, stagger AI, revision-safe path cache, lower documented cap | Open |
| R-08 | Phaser/React lifecycle leak on navigation/HMR | M | M | One host instance, destroy on unmount, mount/unmount regression test | Open |
| R-09 | Procedural art reads as placeholder or culturally generic | M | H | Art bible, silhouette/scale QA, final screenshot review, human art/culture review | Open |
| R-10 | Required 80 items are shallow recolours | M | H | Meaningful-difference rule and duplicate/content validator | Open |
| R-11 | Dependency vulnerability/license issue | M | H | Locked versions, audit triage, notices/license inventory, remove unused packages | Open |
| R-12 | Existing starter assets/code leak into production | M | M | Built-output asset/route scan; remove unused template UI/assets | Open |
| R-13 | PWA install/cache fails on preview origin | M | H | Preview-origin HTTPS/offline/update test before promotion | Open |
| R-14 | Browser feature differences break saves/audio/WebGL | M | M | Chrome primary plus Edge/Firefox matrix, visible degradation | Open |
| R-15 | Economy has grind, exploit, or unrecoverable state | M | H | Pure formulas, seeded simulations, novice playtest, recovery grant | Open |
| R-16 | Data definitions and docs diverge | H | M | Runtime validators, generated count report, doc reconciliation per phase | Open |
| R-17 | False compliance or release-readiness claim | M | H | Checklist evidence; explicit external gates; human go/no-go | Mitigated, monitor |
| R-18 | Imported save causes XSS/resource exhaustion | L | H | Size/count/range validation; text-only rendering; no evaluation/HTML | Open |
| R-19 | Audio cannot be sourced license-cleanly in scope | M | M | Prefer synthesized/code-authored cues; provenance row per file; allow silent beta | Open |
| R-20 | Exact stable Chrome changes before release | H | M | Record exact version only during final RC test and retest if updated | Open |
| R-21 | Health ratings or chronic-condition traits are mistaken for medical advice, stigmatize customers, or moralize a cuisine | M | H | Separate Health from Star ratings; assign conditions independently of archetype/demographics; explain nutrients considered; bound gameplay effects; retain educational disclosure; require cultural/accessibility/content review | Open; release blocker |
| R-22 | Nutrition source drift, serving mismatch, or incorrect dish/variant mapping produces misleading values | M | H | Pin source and row hashes; require curated mappings and provenance; validate serving scaling/ranges; quarantine malformed rows; rerun deterministic importer and review source changes | Open |

Review at each phase boundary and whenever a trigger occurs. Closed risks retain evidence and date; they are not deleted.
