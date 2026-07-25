# Project Status

Last updated: 2026-07-26
Phase: Independent-review Stages 1-5 are source-integrated; final commit/artifact evidence, exact-production verification, and human review remain pending
Release status: **NO-GO for production approval**

## Current position

Hawker Balance is implemented as a deployable, local-first browser game. The React interface mounts a Phaser world backed by a deterministic TypeScript simulation, the complete launch catalogue and reviewed nutrition snapshot are runtime-integrated, and production build, save, offline-shell, accessibility, and release-gate code paths are present.

The working source includes layered stall facades, active-menu food displays, 14 vendor identities, per-item and per-variant visual recipes, visible meals and lifecycle animation, progression- and schedule-aware customer personas, balanced stall selection, globally unique obstacle-safe configurable queues, a saved preferred-route editor, geometry-aware queue-flow guidance, distance-based route-efficiency ratings, coherent expansion-boundary migration, functional signage/facility effects, nutrition-aware customer decisions and objectives, the Nutrition Lens, Variant Lab, customer inspector, Nutrition Pulse, and an approval-gated Vercel delivery pipeline. The independent-review programme adds four service periods and cause-coded ledgers, deterministic planning forecasts, frozen operational preparation trade-offs, a three-slot Combo Board, parties of up to six, eight neighbourhood events, six recurring regulars, five isolated scenarios, twelve rotating mastery contracts, and separate main/scenario/meta persistence. Content `1.3.0` still defines 14 stalls, 54 dishes, 80 placeables, 12 customer archetypes, and 320 English localization entries. Its 104 source profiles are released; 14 variant families expose 64 selectable preparations.

Current working-source stage gates cover typecheck, lint, the complete automated suite, content validation, SSR, Vinext and native Vercel builds, diff checks, migrations, and responsive development-browser evidence. Exact commands and results belong in `TEST_REPORT.md`; older content `1.3.0` counts and service-worker IDs are retained only as historical evidence. Final source/artifact hashes, payload totals, exact-production browser/offline evidence, exhaustive galleries, performance measurements, and required human reviews remain pending.

Package version `1.0.0` remains an internal artifact identifier until the exact-production browser/offline gates and required human reviews close.

## Release-candidate summary

| Area | State | Current evidence / remaining gate |
|---|---|---|
| Product/game/technical/art plans | Implemented and documented | Product brief, GDD, technical design, art bible, economy, content, accessibility, testing, security, deployment, and ADRs are present |
| Stack and architecture | Implemented | TypeScript + React/Vinext/Vite with Phaser 4.2.1; deterministic simulation is separated from rendering |
| Perspective/style | Implemented | Orthographic top-down square grid with code-native, shape-led illustrated 2D rendering |
| Launch content | Content `1.3.0` and strategic typed rosters pass automated validation | Exactly 14 stalls, 54 dishes, 80 placeables, 12 archetypes, 11 customer states, 104 nutrition profiles, 14 variant families, four period profiles, eight events, six regulars, five scenarios, and twelve mastery templates |
| Core simulation | Automated coverage present | Placement/path validation, periods/drains, ledgers, forecasts, frozen order terms, Combo Board settlement, parties, events, regular progression, scenario evaluation, mastery contracts, reward isolation, economy/progression, expansion, and undo |
| Game/UI integration | Implemented | Existing build/nutrition interfaces plus period HUD/debriefs, forecast and preparation comparisons, Combo Board, party summaries, event choices, regular gallery, scenario cards, mastery offers/progress, meta gallery, and separate reset/erase-all flows |
| Persistence | Implemented with automated migration coverage | Core V7/runtime V5, IndexedDB V2 active/backup main slots, isolated scenario slots, separate meta progression, checksums, serialized writes, V3 progress-bundle import/export, preserved-meta main reset, and erase all; real-browser fault injection remains open |
| Offline/PWA | Implemented; replacement static assertions pass | Real offline restart/update verification must still be exercised on the replacement production artifact |
| Automated QA | Current stage gates are recorded separately | See `TEST_REPORT.md`; automation remains engineering evidence rather than production or human approval |
| Browser QA | Responsive working-source evidence present | Stage evidence covers representative 1280 x 720, 1024 x 640, 800 x 720, and 390 x 844 states plus scale checks. Exact-production critical path, offline/storage, assistive technology, complete content gallery, and secondary-browser gates remain open |
| Performance | Node budget passed; browser evidence open | `benchmark-80-agents` exercised 80 active agents for 1,200 fixed steps within its simulation budget; browser FPS/frame time, memory, TTI, and supported caps remain unclaimed, especially because the renderer still performs full-frame redraws and recreates text during frame rendering |
| Accessibility | Engineering support implemented; human audit pending | Semantic DOM controls, keyboard actions, focus-managed dialogs, text scaling, high contrast, reduced motion, visual audio equivalents, a text-paired customer-status legend, and degradation messages are present; assistive-technology and human review remain open |
| Cultural review | Research-informed internal review only | Fictional names/marks and original presentation are used; Singapore-informed human review remains a release blocker |
| Security/privacy/legal | Engineering controls implemented; independent reviews pending | Local-only data posture, bounded save import, no analytics/accounts/payments, CSP/security headers, and notices are present; both previously recorded npm audits report 0 vulnerabilities but were not rerun in this validation update, while independent reviews remain open |
| Deployment | Private review previews do not constitute release | Public deployment, production promotion, exact-artifact smoke, protected approval, and rollback evidence remain outside the programme unless separately requested |

## Implemented launch scope

- Complete customer lifecycle: arrive, choose a stall, queue, order, collect food, reserve a seat, eat a visibly rendered meal, return a tray when possible, exit, and despawn.
- Balanced customer choice: preferences, quality, price, wait, novelty, distance, and wayfinding influence stall selection instead of entrance proximity dominating.
- Dynamic queue management: per-stall counts, automatic direction, player-authored bends, reserved positions, and obstacle-safe movement.
- Operational build mode: place, inspect, move, rotate, remove/sell, undo, paint preferred guest lanes, edit queues, and expand while protecting navigation and migrating the live perimeter, entrance, and exit.
- Code-native visual system: the working source defines and automatically validates 80 distinct placeable contracts, 14 layered stall identities with vendor workwear/tools/actions, active-menu food displays, 54 food/vessel recipes, twelve archetype appearances, all 11 lifecycle poses, carried/seated meals, queue overlays, high-contrast separation, and reduced-motion-safe animation. The complete browser gallery and human visual/cultural review remain open; no source contract constitutes human approval.
- Meaningful facilities and signage: spatial/global wayfinding, patience, movement, turnover, cleanliness, ambience, satisfaction, tray-return, and facility effects are surfaced and applied by the simulation.
- Economy/progression, onboarding, objectives, diagnostics, accessibility settings, procedural audio, local saves, PWA manifest, offline fallback, and update-ready flow.
- Four daily service periods with closed-cohort draining, integer-cent SGD reconciliation, planning objectives, deterministic menu-neutral forecasts, operational preparation trade-offs, and frozen order-line terms.
- A level-5 Combo Board for one-main-plus-side-or-drink offers, conservative nutrient aggregation, order-time meal-balance/fit explanations, and explicit partial-meal settlement.
- Member-level parties of up to six, deterministic seating/split behavior, neighbourhood events, recurring regular stories, and condition-aware needs kept independent from identity.
- Five isolated level-3 scenarios with medal/cosmetic rewards, twelve level-13 mastery templates with title/cosmetic rewards, and a persistent meta gallery.
- Reviewed nutrition variants, separate Health and Star ratings, independently assigned condition-aware customer choices and bounded satisfaction effects, fictional nutrition intents, order-time snapshots, serving feedback, contextual Singapore-adult reference data, and an explicit educational-not-medical-advice disclosure.

## Remaining NO-GO gates

1. Record the validated source commit plus current artifact payload/hash, then run the artifact's critical path in current stable Chrome and record browser/OS version, viewport/zoom, screenshots, console/network state, save/reload, responsive behavior, and measured performance. Include the full-frame redraw/text-recreation path in profiling. Record Edge and Firefox smoke results or explicit limitations.
2. Verify first-load caching, reload, browser restart, saving while offline, and service-worker update/rollback behavior on the exact production artifact and origin.
3. Complete and record human Singapore cultural review.
4. Complete and record human accessibility/assistive-technology review.
5. Complete and record independent security review (or accountable written waiver) and qualified legal/privacy review.

## Evidence rule

Do not translate "implemented," "compiled," or "unit-tested" into an exact-production browser, accessibility, cultural, legal, security, or compliance claim. Before approval, add the outstanding build, browser/offline, and human-review records to the release evidence.
