# Changelog

All notable project changes are recorded here. The project is pre-release; semantic version numbers in package/cache metadata, such as the `1.0.0` artifact identifier, do not indicate release acceptance, certification, or compliance.

## Unreleased — release candidate

### Release notes

This is the player-facing summary of the candidate. The detailed entries follow under Added, Changed, and Security and privacy.

Hawker Balance is a complete, free, local-first browser management and nutrition-education game candidate. It is not yet production-approved because exact-artifact real-browser/offline QA and required human reviews remain open.

#### Playable launch scope

- Build and operate an original Singapore-inspired Community Courtyard using a top-down grid.
- Place, move, rotate, remove/sell, undo, and unlock 80 meaningfully distinct seating, facility, sign, greenery, lighting, cooling, tray/waste, floor, and utility definitions.
- Operate 14 fictional stalls and configure 54 dishes through per-stall menu slots, including Pick & Mix and Herbal Cauldron.
- Serve 12 customer archetypes through arrival, stall choice, queue, ordering, collection, reserved seating, dining, tray return, exit, and despawn.
- Paint saved preferred walking lanes that shift guest routes while retaining obstacle-safe fallback paths.
- Read live queue, cleanliness, seating, ambience, cash, reputation, level, objective, and diagnostic feedback.
- Expand the hall and progress through deterministic economy, XP, reputation, and unlock rules.
- Compare 104 released serving profiles through 14 recipe-variant families without changing prices, service timing, XP, reputation, or the dish family's Star rating.
- Compare the separate 1-to-5 Health and Star ratings assigned across the complete menu. Star rating represents taste and popularity; general and condition-specific Health ratings represent comparative nutrient fit within the reviewed in-game options.
- Serve customers who may be managing high cholesterol, obesity, diabetes, or hypertension. Their visit-specific condition is independent of archetype and appearance, increases preference for better-fitting options, and applies only a small bounded satisfaction effect from the ordered meal.
- Respond to fictional nutrition intents, inspect nutrient trade-offs, complete rotating nutrition objectives, and read current-day Nutrition Pulse analytics with an educational-not-medical-advice disclosure.

#### Interface and accessibility engineering

- Semantic React controls surround the Phaser world for the catalogue, menus, settings, save tools, objectives, tutorials, Nutrition Lens, Variant Lab, customer inspector, Nutrition Pulse, and status.
- Pointer and keyboard camera/build controls, focus-managed dialogs, visible focus, Escape behavior, high contrast, reduced motion, text scaling, and separate audio controls are implemented.
- Important audio events have visual equivalents; unavailable audio/storage degrades with an explicit message.
- Standard and lower-end quality modes apply separate crowd/fixed-step/frame-rate limits.

#### Saves and offline shell

- Core V3-to-V4 and runtime V1-to-V2 migrations, newest-save backup recovery, content alias/refund recovery, nutrition variant fallback, export/import, and reset are implemented.

#### Automated evidence boundary

- The content `1.3.0` working-source contract requires 14 stalls, 54 dishes, 80 placeables, 12 archetypes, and 320 English localization entries.
- The nutrition contract requires 104 released profiles, 14 variant families with 64 selectable variants, a released base profile and Star rating for every dish, complete Health/condition ratings, provenance hashes, scaling, trace values, quarantine rules, deterministic generation, and incompatible guideline comparisons.
- The retained automated report covers content `1.2.0`; the complete release gate and both production builds must be rerun before the expanded `1.3.0` contracts can be reported as passing.
- See [TEST_REPORT.md](TEST_REPORT.md), including its [performance evidence](TEST_REPORT.md#performance-evidence), for the current supported-runtime automated results, the historical payload baseline, and remaining browser-only measurements.

### Added

- Adaptive uncapped guest demand, rolling 0–100 visit ratings, three daily objectives, permanent centre milestones, and open-ended stall mastery with authored upgrades.
- Multiple movable boundary entrances/exits with atomic validation, undo, multi-route spawning, and schema-v3 save migration.
- An undoable, saved Route editor that lets players paint preferred keep-clear walking lanes; guests favour them without losing safe fallback paths.
- A 10× simulation option and an original state-aware procedural soundtrack with separate master mute, music, ambience, and effects controls.
- Complete React/Phaser Hawker Simulator interface, top-down game world, onboarding, build catalogue, stall/dish menu management, objectives/insights, expansion, settings, accessibility controls, and local save tools.
- Deterministic fixed-step customer lifecycle with queueing, ordering, collection, seat reservation, dining, tray return, exit, target recovery, economy, XP, reputation, levels, and unlock reconciliation.
- A validated launch catalogue of original stalls, dishes, meaningful placeables, customer archetypes, and English localization entries; the entries below record how it grew, and the current counts are in [design/CONTENT_CATALOGUE.md](design/CONTENT_CATALOGUE.md#roster-counts).
- Code-native illustrated rendering and procedural WebAudio cues/ambience with original project identity.
- IndexedDB current/backup envelopes, checksums, serialized writes, migrations, backup recovery, import/export, and confirmed reset flow.
- PWA manifest, offline fallback, deterministic content-derived service-worker cache version, acknowledged runtime warming, and save-gated update activation.
- Vitest coverage for content, grid/pathfinding, commands/economy, lifecycle/recovery, persistence/migrations, deterministic soak, and the 80-agent simulation budget.
- Rendered production-output checks for the release shell, security headers, PWA protocol, and absence of starter-facing copy.
- Product, game design, technical, art, content, economy, accessibility, cultural-review, test, performance, security/privacy, deployment, release, support, risk, and project-status documentation plus ADRs.

### Changed

- Reorganised the documentation under `docs/`: the changelog moved from the repository root into `docs/` and absorbed the former release notes; the privacy notice, performance budget and report, graphics verification, project status and risk register were merged into the security, test-plan, test-report and known-issues documents; the product brief joined the game design document and the post-launch backlog joined the roadmap under `docs/design/`; the decision log and ADRs moved to `docs/decisions/`; and the release-review documents moved to `docs/release/`. The third-party notices file was removed; the release checklist now carries the obligation to generate and bundle a complete license and attribution inventory from the lockfile before distribution. The [documentation index](README.md) lists the new layout.
- Restructured the codebase without changing player-visible behaviour. Behaviour-pinning goldens for the seeded simulation, saves, the runtime controller, draw calls, input, the save store, server-rendered markup, the jsdom UI, content and the nutrition importer landed first, and the test suite now mirrors the source tree (`tests/game/core`, `tests/game/runtime`, `tests/app/game`, `tests/content`, `tests/tools`, and so on). The simulation core, the runtime composition root, the visual recipes and renderer, and the simulator UI were then split into focused modules; duplicated balance rules, the launch roster and build-mode configuration each gained a single source; and a module-documentation check now covers the source tree. Unexpected console output and process warnings fail tests. Deferred engineering debt is listed in [KNOWN_ISSUES.md](KNOWN_ISSUES.md#deferred-engineering-debt).
- Expanded content `1.3.0` from 12 to 14 fictional stalls, from 46 to 54 dishes, and from 300 to 320 English localization entries, adding Pick & Mix and Herbal Cauldron with dataset-backed yong tau foo, ban mian, thunder tea rice, popiah, bak kut teh, duck rice, kway chap, and claypot chicken rice options.
- Replaced partial nutrition coverage with 104 released source profiles: every base dish is profiled, 14 reviewed variant families expose 64 selectable preparations, and every profile carries an overall Health rating plus condition-specific ratings for high cholesterol, obesity, diabetes, and hypertension.
- Added a distinct Star rating to every dish for taste and popularity, while customers with independently assigned health conditions use their relevant Health rating when choosing stalls and dishes and receive a small bounded satisfaction effect from the meal selected.
- Added a keyboard-accessible customer-status legend to Settings, covering all nine speech bubbles and the patience ring with matching shapes and text explanations.
- Expanded the customer-persona roster from 8 to 12 behavior archetypes and 300 English localization entries, adding Afternoon Treat Stopper, Plant-Forward Planner, Quiet Break Regular, and Night-Shift Recharger while reframing Senior Comfort Seeker as the neutral Comfort-Seeking Regular.
- Expanded the launch roster from 8 to 12 fictional stalls and from 30 to 46 dishes, with unique primary stall/food visual references and dedicated real-food renderer treatments for the new menu.
- Upgraded all 12 stalls with layered code-native facades, active-menu food and drink displays, cuisine-appropriate animated vendor work actions, and closed shutters that conceal the service scene; reduced motion freezes vendor action while retaining a clear static vendor pose.
- Replaced the elapsed-time-derived Walking rating with full-journey route-efficiency scoring based on actual traversed tiles, including the exit leg and safe normalization of legacy ratings.
- Replaced the starter-facing experience with the original Hawker Simulator release candidate.
- Selected orthographic top-down, shape-led illustrated 2D as the final launch perspective and visual system.
- Deferred Phaser/runtime code from the initial React shell and added standard/lower-end runtime budgets.
- Hardened worker headers, save validation/recovery, cache ownership/update behavior, responsive layout, focus handling, and production debug exclusion during integration review.

### Security and privacy

- The candidate excludes accounts, analytics, trackers, payments, advertising, chat, and cloud saves.
- Imported content is bounded/validated, player data remains local, and the host worker applies CSP, permissions, referrer, content-type, and framing headers.
- Applied patched build-tool pins and narrow transitive overrides; the current dated audit result is in [TEST_REPORT.md](TEST_REPORT.md#dependency-audit).
- Updated dependencies for security advisories without changing player-visible behaviour: `next` and `eslint-config-next` 16.2.6 → 16.3.8 (clears the critical and high Next.js advisories), `react`, `react-dom` and `react-server-dom-webpack` 19.2.6 → 19.2.8, `@cloudflare/vite-plugin` 1.44.0 → 1.62.5 and `wrangler` 4.110.0 → 4.147.0 (patched `miniflare`, `undici` and `sharp`). The exact overrides now pin `image-size` 2.0.4, `js-yaml` 4.3.2, `postcss` 8.5.23 and `sharp` 0.35.5, and the lockfile picks up patched `brace-expansion`, `browserslist`, `fast-uri`, `source-map-js`, `baseline-browser-mapping` and `fflate`. The production-only audit now passes; the all-dependencies audit still reports a `braces` advisory with no patched release, reached only through development tooling.
- CI now gates on the production-only dependency audit (`npm audit --omit=dev --audit-level=high`), because the remaining high advisory (`braces`, no patched release) reaches only development tooling; the all-dependencies result stays recorded in [TEST_REPORT.md](TEST_REPORT.md#dependency-audit).

### Known limitations and release gates

The following are not yet approved:

- Current stable Chrome critical path, Edge/Firefox smoke, viewport/zoom/console/network checks, browser FPS/memory/TTI, and the long browser soak.
- First-load/offline reload, offline restart/save, waiting-worker update, and rollback behavior on the exact production artifact and origin.
- Human Singapore cultural and accessibility/assistive-technology review.
- Independent security review and qualified legal/privacy review.
- No production approval, certification, or compliance claim is made until the release checklist is complete.
