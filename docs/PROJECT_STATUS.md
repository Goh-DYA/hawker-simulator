# Project Status

Last updated: 2026-10-17
Phase: Content `1.3.0` nutrition and stall expansion passes working-source automation and targeted nutrition browser QA; exact-production and human verification pending
Release status: **NO-GO for production approval**

This is a summary. Content counts are owned by [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md#roster-counts), test and gate evidence by [TEST_REPORT.md](TEST_REPORT.md), and release blockers by [KNOWN_ISSUES.md](KNOWN_ISSUES.md); see the [documentation index](README.md).

## Current position

Hawker Balance is implemented as a deployable, local-first browser game. The React interface mounts a Phaser world backed by a deterministic TypeScript simulation, the complete launch catalogue and reviewed nutrition snapshot are runtime-integrated, and production build, save, offline-shell, accessibility, and release-gate code paths are present.

The working source includes layered stall facades, active-menu food displays, a vendor identity for every stall, per-item and per-variant visual recipes, visible meals and lifecycle animation, progression- and schedule-aware customer personas, balanced stall selection, globally unique obstacle-safe configurable queues, a saved preferred-route editor, geometry-aware queue-flow guidance, distance-based route-efficiency ratings, coherent expansion-boundary migration, functional signage/facility effects, nutrition-aware customer decisions and objectives, the Nutrition Lens, Variant Lab, customer inspector, Nutrition Pulse, and an approval-gated Vercel delivery pipeline. Content `1.3.0` expands the stall, dish, and nutrition roster ([counts](CONTENT_CATALOGUE.md#roster-counts)). All of its source nutrition profiles are released, the reviewed variant families expose selectable preparations, every dish has a distinct Star rating, and every profile has overall and condition-specific Health ratings.

The content `1.3.0` working source passes typecheck, lint, Vitest, the five-environment Vinext build, the rendered-output/offline-shell assertions, and the native Next.js Vercel build; the dated results and service-worker build ID are in [TEST_REPORT.md](TEST_REPORT.md). A targeted 1280 x 720 development-browser pass covered the expanded nutrition menu, variant comparison, and condition-aware customer inspector without browser warning or error messages. Commit/artifact hashes, payload totals, exact-production browser/offline evidence, exhaustive galleries, and human reviews remain pending.

Package version `1.0.0` remains an internal artifact identifier until the exact-production browser/offline gates and required human reviews close.

## Release-candidate summary

| Area | State | Current evidence / remaining gate |
|---|---|---|
| Product/game/technical/art plans | Implemented and documented | Product brief, GDD, technical design, art bible, economy, content, accessibility, testing, security, deployment, and ADRs are present |
| Stack and architecture | Implemented | TypeScript + React/Vinext/Vite with Phaser 4.2.1; deterministic simulation is separated from rendering |
| Perspective/style | Implemented | Orthographic top-down square grid with code-native, shape-led illustrated 2D rendering |
| Launch content | Content `1.3.0` typed roster passes automated validation | The roster and its counts are in [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md#roster-counts); every nutrition profile is released, and every profile has overall and condition-specific Health ratings |
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

## Implemented launch scope

- Complete customer lifecycle: arrive, choose a stall, queue, order, collect food, reserve a seat, eat a visibly rendered meal, return a tray when possible, exit, and despawn.
- Balanced customer choice: preferences, quality, price, wait, novelty, distance, and wayfinding influence stall selection instead of entrance proximity dominating.
- Dynamic queue management: per-stall counts, automatic direction, player-authored bends, reserved positions, and obstacle-safe movement.
- Operational build mode: place, inspect, move, rotate, remove/sell, undo, paint preferred guest lanes, edit queues, and expand while protecting navigation and migrating the live perimeter, entrance, and exit.
- Code-native visual system: the working source defines and automatically validates a distinct contract for every placeable, a layered identity with vendor workwear/tools/actions for every stall, active-menu food displays, a food/vessel recipe for every dish, an appearance for every customer archetype, every lifecycle pose, carried/seated meals, queue overlays, high-contrast separation, and reduced-motion-safe animation. The complete browser gallery and human visual/cultural review remain open; no source contract constitutes human approval.
- Meaningful facilities and signage: spatial/global wayfinding, patience, movement, turnover, cleanliness, ambience, satisfaction, tray-return, and facility effects are surfaced and applied by the simulation.
- Economy/progression, onboarding, objectives, diagnostics, accessibility settings, procedural audio, local saves, PWA manifest, offline fallback, and update-ready flow.
- Reviewed nutrition variants, separate Health and Star ratings, independently assigned condition-aware customer choices and bounded satisfaction effects, fictional nutrition intents, order-time variant snapshots, serving feedback, daily nutrition objectives, contextual Singapore-adult reference data, and an explicit educational-not-medical-advice disclosure.

## Remaining NO-GO gates

The remaining release blockers are listed, with what closes each one, in [KNOWN_ISSUES.md](KNOWN_ISSUES.md#remaining-release-blockers). They cover exact-production browser and offline evidence (including profiling the full-frame redraw and text-recreation path), the failing all-dependencies audit, deployment publication, and the human cultural, accessibility, security, and legal/privacy reviews.

## Evidence rule

Do not translate "implemented," "compiled," or "unit-tested" into an exact-production browser, accessibility, cultural, legal, security, or compliance claim. Before approval, add the outstanding build, browser/offline, and human-review records to the release evidence.
