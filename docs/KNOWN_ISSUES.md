# Known Issues

Status: Release-candidate verification list; not a customer-facing production issue list

This document owns the release blockers, the open issues and the deferred engineering debt. Gate evidence lives in [TEST_REPORT.md](TEST_REPORT.md) and content counts in [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md#roster-counts); see the [documentation index](README.md).

## Remaining release blockers

1. **Content `1.3.0` release and browser QA is incomplete.** The working source defines the expanded content `1.3.0` roster ([counts](CONTENT_CATALOGUE.md#roster-counts)), but the retained supported-runtime release gate, production builds, and development-browser screenshots apply to earlier content. The complete gate and both builds must be rerun, then current stable Chrome critical-path evidence, console/network review, viewports/zoom, save/reload, resize/suspension/WebGL-loss behavior, and measured browser performance must be recorded on the exact artifact. Edge/Firefox smoke results are also absent.
2. **Real offline/PWA behavior is unverified on the replacement artifact.** First-load cache population, offline reload, browser restart, offline saving, waiting-worker update, mixed-version avoidance, and rollback must be exercised on the final origin.
3. **Human Singapore cultural review is pending.** Internal research and safeguards do not substitute for Singapore-informed review.
4. **Human accessibility and assistive-technology review is pending.** Keyboard, screen-reader, zoom/reflow, contrast, reduced-motion, focus, and audio-equivalence behavior needs human verification in the exact browser build.
5. **Independent security and qualified legal/privacy review are pending.** Internal controls, tests, notices, and dependency-audit results (see [TEST_REPORT.md](TEST_REPORT.md#dependency-audit)) are evidence inputs, not an approval or compliance claim.
6. **No Vercel Preview, staged deployment or promotion has been recorded for the current source.** The pipeline needs the documented Vercel project, GitHub secrets, protected `production` Environment and user approval; see [DEPLOYMENT.md](DEPLOYMENT.md) and the gate record in [TEST_REPORT.md](TEST_REPORT.md#gate-record).

## Open gameplay balance issues

- **The 120-second visit cap can interrupt already-served guests.** In a deterministic 360-second starter-layout run, 33 served guests reached the cap while eating or walking to a tray return. Their route-efficiency ratings now remain valid because only walked distance contributes, but meal completion and tray-return timing need a separate balance pass against the authored preparation and eating durations.
- **Some authored persona fields remain future hooks.** Budgets, patience, walking speed, stall-choice sensitivities, novelty, dish preferences, progression gates, and visit schedules are active. Seat preference, group range, satisfaction modifiers, spend multiplier, and tray-return chance are validated content metadata but do not yet alter the simulation.

## Implemented but awaiting exact-production evidence

- The working source defines code-native contracts for every placeable, stall, dish, customer archetype, and customer state in the [launch roster](CONTENT_CATALOGUE.md#roster-counts). The two new stall and eight new dish treatments still need the current automated recipe pass and exact-production gallery; automated contracts will not replace final human visual/cultural review.
- Per-stall queue counts, automatic direction, editable bends, obstacle-safe reserved queue cells, and customer movement through the resulting cells are implemented and covered by core tests. Long-running browser crowd behavior and extreme player-authored layouts still require soak/playtest evidence.
- Expansion migrates the former right/bottom perimeter outward, projects entrance/exit points to the new boundary, refreshes exiting paths, and restores endpoints on undo. Core regressions and development-browser expansion screenshots pass; exact-production save/reload and repeated-expansion play remain open.
- Signage/facilities now apply visible, documented effects such as wayfinding, patience, movement, turnover, cleanliness, ambience, satisfaction, and tray-return support. Balance tuning across a complete progression playthrough is not yet accepted.
- IndexedDB, service-worker, accessibility, audio-degradation, and security-header implementations retain automated coverage, but final browser/fault-injection evidence (including active/backup IndexedDB recovery under quota and private-mode limits) must target the replacement artifact.
- The current Node benchmark passes with 80 active agents over 1,200 fixed steps, but it cannot establish Phaser FPS, TTI, memory stability, or a supported browser customer cap.
- The renderer still uses full-frame redraw and recreates text during frame rendering. This browser CPU/allocation path is outside the Node benchmark and requires profiling and, if budgets are missed, optimization before performance approval (see TD-50 under [Deferred engineering debt](#deferred-engineering-debt)).

## Previously listed concerns closed by implementation or current automated evidence

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

- **TD-47: generic art for the two newest stalls.** The renderer's ID-keyed art tables reproduce the previous substring matching, so Pick & Mix and Herbal Cauldron still use the generic awning roof and plain counter props. New art for them waits on an art-direction decision.
- **TD-50: per-frame and per-tick recomputation of layout-only data.** The HUD runs a path search for every entrance-exit pair each frame, text objects are recreated on every render, and number formatters are rebuilt per call. This is within budget today; caching it needs a browser benchmark first, because a wrong cache key causes visible regressions.
- **TD-52: `app/globals.css` is a single append-only stylesheet of about 4,700 lines**, with the same selectors defined far apart. A feature-grouped split needs a cascade-order plan, because a contiguous split does not fix the scattered selectors.
- **Remaining development-dependency advisories.** CI gates on the production-only audit (`npm audit --omit=dev --audit-level=high`), which passes. The all-dependencies audit still reports high findings from the `braces` advisory GHSA-vfj7-8cjw-p6xm, which has no patched release and reaches the tree only through the development tools `eslint-config-next` and `vinext`; it clears once `braces` publishes a fix or `@next/eslint-plugin-next` and `vite-plugin-dynamic-import` (through `vinext`) stop depending on `fast-glob`. The moderate `vitest` advisory needs 4.1.11, which npm 10.9 currently fails to resolve. See [TEST_REPORT.md](TEST_REPORT.md#dependency-audit) for the current result.
- **Node and npm version pinning.** There is no single pinned Node version shared by CI and local work, and the npm version that produced the lockfile is not declared.
- **Service-worker stamp tool (`tools/stamp-service-worker.mjs`).** The build hash depends on the platform, because native path separators and the file sort order feed it, so Linux and Windows builds stamp different IDs. Every build rewrites the tracked `public/sw.js`. The `1.0.0` version prefix is hard-coded, and filesystem errors while collecting files are swallowed. Generating `public/sw.js` from a tracked template is also deferred.
- **Deployment smoke tool (`tools/smoke-deployment.mjs`).** It runs at import time, and its assertions repeat the rendered-output checks instead of sharing them.
- **Unused image-optimisation branch.** `worker/index.ts` still handles `/_vinext/image`, which the app does not use.
- **CI secret scoping and Dependabot.** The deploy secrets are scoped to whole jobs, so the `npm ci` lifecycle scripts can see them, and there are no automated dependency-update pull requests.

## Reporting rule

Do not remove a remaining blocker without a dated evidence record. Development-browser screenshots demonstrate targeted visual behavior; they do not replace an exact-production critical-path, offline, performance, accessibility, cultural, legal, or security review.
