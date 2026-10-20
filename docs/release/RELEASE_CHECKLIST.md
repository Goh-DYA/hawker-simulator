# Release Checklist

Status: Content `1.7.0` working-source gate passes; **NO-GO pending source/artifact publication, exact-production browser/offline QA, and human reviews**
Rule: check an item only with evidence in [`TEST_REPORT.md`](../TEST_REPORT.md), including its [performance evidence](../TEST_REPORT.md#performance-evidence), or the named review record. An implementation checkbox is not a browser or compliance claim.

## Product and content

- [x] Content `1.7.0` validation evidence records exactly 18 operational stalls, 91 assigned dishes, and 12 customer archetypes, at least 80 meaningful placeables, and 402 English localization entries ([roster counts](../design/CONTENT_CATALOGUE.md#roster-counts)).
- [x] The current catalogue categories, reciprocal references, unique IDs, localization, unlock bounds/prerequisites, stalls authored in unlock order, an affordable opening dish at every stall, and non-placeholder copy pass the full automated gate.
- [x] One coherent Community Courtyard theme uses original code-native illustrated visuals and fictional stall identities.
- [x] Content `1.7.0` automated visual-contract coverage accounts for 80 distinct placeables, unique primary references for 18 stall identities and 91 dishes, 91 dish/vessel recipes (including the hot plate), 12 archetype appearances, and all 11 customer states, including reduced-motion signatures.
- [x] Nutrition validation records 171 released profiles, 23 variant families with 103 selectable variants, a default in every family that rates below another option, no Borrowed row outside the allowlisted composite component, complete Health/condition ratings, and a released base profile plus Star rating for every dish.
- [x] Player-facing build catalogue, stall/menu manager, objectives/insights, tutorial, progression, settings, and save tools are integrated.
- [x] Asset provenance is present; no real brand or certification mark is intentionally used.
- [ ] Complete build/open/inspect/customer/progression loop is manually passed on the exact production artifact in a real browser.
- [ ] Final browser screenshot/visual review confirms no debug, broken, or unintended starter-facing presentation.

## Simulation and economy

- [x] Placement, rotation, movement, remove/refund, expansion, and undo pass automated command tests.
- [x] Invalid placement and required entrance/exit, service, queue, seat, and tray-return paths are protected by validation/recovery logic.
- [x] Queue/seat reservations and live stall/tray/seat target changes recover in deterministic lifecycle/soak tests.
- [x] Comparable-stall choice is balanced, preferences can outweigh modest entrance distance, and wayfinding utility reduces entrance bias in automated tests.
- [x] Per-stall queue counts, cardinal automatic directions, player-authored bends, obstacle-safe cells, path persistence, and admitted-customer walkability pass automated tests.
- [x] Expansion migrates perimeter tiles and entrance/exit endpoints; customers leaving after expansion do not despawn at the old exit in the regression test.
- [x] All signage/facility definitions apply at least one spatial or global simulation effect, with bounded falloff/satisfaction tests.
- [x] Purchases, refunds, sales, XP, levels, reputation, unlocks, and trusted expansion prices use deterministic formulas with automated coverage.
- [x] Standard/lower-end fixed-step and crowd limits are enforced by the pure simulation.
- [ ] Beginning-to-end progression and economy are manually played in the real browser build, including recovery from poor layouts and exploit checks.
- [ ] Two-hour browser soak confirms no unbounded customer, queue, reservation, or memory growth.

## Saves and offline

- [x] Versioned save round trip and representative V1-to-V2 migration pass automated core tests.
- [x] Checksummed active/backup slots, serialized writes, newest-save backup recovery, alias remapping, removed-content refund, and bounded import/export are implemented.
- [x] Confirmed reset removes the game-owned save/preferences/cache data path and has an export-first warning.
- [ ] IndexedDB active/backup writes, interruption, corruption, denied storage, quota, and private-mode behavior pass real-browser fault injection.
- [ ] Core game reloads and saves offline after first production load.
- [ ] Browser restart preserves progress offline.
- [ ] Waiting service-worker update preserves saves, warms the full runtime, avoids mixed versions, and activates only after confirmation.
- [ ] Rollback/save-forward compatibility is exercised on the deployed artifact.

## Browser and UI

- [x] Pre-expansion targeted development-browser screenshots cover starter, live service, queue routing/editing, and repeated expansion states; paths, post-capture changes, and limitations are recorded under [Graphics and gameplay verification](../TEST_REPORT.md#graphics-and-gameplay-verification).
- [ ] Every one of the 18 stall identities and 91 dish presentations is inspected in the exact production artifact, with culturally informed findings recorded.
- [ ] Current stable desktop Chrome exact version and OS are recorded.
- [ ] Edge and Firefox exact versions and limitations are recorded.
- [ ] 1280 × 720 and 1024 × 640 layouts pass.
- [ ] Required browser zoom/text scaling levels pass without clipped essential controls.
- [ ] Keyboard and pointer build/camera flows, dialog focus restoration, and responsive mode pass.
- [ ] No critical console errors or unexpected network requests occur.
- [ ] WebGL loss, tab suspension, resize, service-worker update, and unsupported storage/audio conditions recover clearly.

## Accessibility and audio

- [x] Essential DOM actions use semantic controls and the game supplies keyboard build/camera shortcuts plus a visible focus treatment.
- [x] Dialog focus is trapped/restored, Escape closes/cancels, drag actions have button/key alternatives, and typing targets suppress game shortcuts.
- [x] High contrast, reduced motion, text scaling, separate audio controls/mute, and visual equivalents/degradation messages are implemented.
- [ ] Keyboard-only critical path passes in the exact browser build.
- [ ] Text scaling/reflow, contrast, reduced motion, focus visibility, and critical non-color/non-audio state pass human inspection.
- [ ] Screen-reader smoke and human accessibility review are complete.

## Performance

- [x] The retained content `1.2.0` Node benchmark exercised 80 active agents for 1,200 fixed steps and passed its simulation budget.
- [x] The content `1.2.0` baseline `benchmark-80-agents` result is recorded under [Performance evidence](../TEST_REPORT.md#performance-evidence) from the supported Node.js `v24.14.0` run.
- [x] The content `1.5.0` Node benchmark exercised 80 active agents for 1,200 fixed steps within its simulation budget (previous record).
- [x] The content `1.7.0` Node benchmark exercises 80 active agents for 1,200 fixed steps within its simulation budget.
- [ ] The browser performance matrix is rerun on the exact production artifact.
- [ ] The content `1.7.0` production artifact raw/gzip sizes, deterministic content-manifest hash, and service-worker build ID are recorded.
- [ ] Production payload and time-to-interactive budgets are measured in a real browser.
- [ ] Standard 60 FPS and lower-end 30 FPS targets pass at documented supported caps.
- [ ] Browser simulation/render/path/save/audio/memory budgets pass.
- [ ] Full-frame redraw and per-frame text recreation are profiled and meet the browser frame-time/allocation budgets, or are optimized until they do.
- [ ] Two-hour browser soak shows no unbounded memory/agent/reservation growth.
- [ ] Hardware, browser, viewport, seed, and raw traces/results are retained.

## Security, privacy, culture, and legal

- [x] Local-first design excludes accounts, analytics, trackers, payments, advertising, chat, and cloud saves.
- [x] Save import/catalogue IDs are bounded/validated and player text is rendered without HTML evaluation.
- [x] CSP, permissions, referrer, content-type, and framing headers are applied by the worker and asserted in rendered-output tests.
- [ ] The production-only audit passes at the high threshold (the CI gate), and every remaining all-dependencies finding is development-only and recorded; the current dated result is in [TEST_REPORT.md](../TEST_REPORT.md#dependency-audit). Lockfile, overrides, and provenance files remain present.
- [x] Frozen-artifact scan found no key-like secrets, environment files, or source maps; source network APIs are limited to same-origin worker/asset requests.
- [ ] Before distribution, a complete production dependency license and attribution inventory, including transitive dependencies, is generated from the frozen `package-lock.json` and reconciled with the deployed artifact, and every required full license and attribution text is bundled or published with the build. Non-code assets are reviewed under [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md).
- [ ] CSP and hosting headers are verified on the final origin.
- [ ] Privacy notice is compared against observed browser/network/storage behavior.
- [ ] Independent security review is complete or an accountable human waiver is recorded.
- [ ] Qualified legal/privacy review is complete.
- [ ] Human Singapore cultural review is complete with findings resolved.
- [ ] Human review confirms no unsupported halal/certification/safety claim, lookalike mark, or culturally harmful presentation.

## Build and operations

- [x] The retained content `1.2.0` baseline release checks passed on bundled Node.js `v24.14.0`: typecheck, lint, 24 Vitest files / 131 tests, five-environment Vinext build, native Vercel build, and 2/2 rendered-output/offline-shell assertions.
- [x] Content `1.5.0` passed and recorded typecheck, lint, the complete test suite, the Vinext build, the native Vercel build, and the rendered-output/offline-shell assertions (previous record).
- [x] Content `1.7.0` passes and records the current typecheck, lint, complete test suite, Vinext build, native Vercel build, and rendered-output/offline-shell assertions.
- [ ] The production-only npm audit is rerun and passes for the release candidate, and the all-dependencies audit is rerun and its remaining findings reviewed; see [TEST_REPORT.md](../TEST_REPORT.md#dependency-audit) for the current dated result.
- [x] The earlier content `1.2.0` service-worker build ID `c5ed3679ba56` is recorded as historical evidence.
- [ ] The content `1.7.0` service-worker build ID, source commit, artifact path/hash, and payload sizes are recorded.
- [ ] Content `1.7.0` validated-source commit, artifact path/hash/payload sizes, and publication URL are recorded; the existing private preview record predates the expansion.
- [ ] Vercel project setup, first Preview, staged-production smoke, protected approval, promotion, and rollback rehearsal are recorded with exact deployment URLs.
- [ ] Browser critical path and offline/update tests pass on that exact artifact.
- [ ] Private deployment smoke, rollback, and save-forward compatibility are rehearsed.
- [x] Changelog and release notes, privacy notice, support, known issues and project status, and release evidence documents are present and aligned to the candidate scope.
- [ ] Version/tag is approved and the accountable production owner records GO.

## Current decision

**NO-GO.** Content `1.7.0` passes its supported-runtime working-source gate and both local production builds. Production approval remains withheld until the current commit/artifact record, exact-artifact browser/offline and performance gates, and required human cultural, accessibility, security, and qualified legal/privacy reviews are complete.
