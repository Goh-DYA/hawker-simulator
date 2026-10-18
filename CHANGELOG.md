# Changelog

All notable project changes are recorded here. The project is pre-release; semantic version numbers in package/cache metadata do not imply release acceptance.

## Unreleased — release candidate

### Added

- Adaptive uncapped guest demand, rolling 0–100 visit ratings, three daily objectives, permanent centre milestones, and open-ended stall mastery with authored upgrades.
- Multiple movable boundary entrances/exits with atomic validation, undo, multi-route spawning, and schema-v3 save migration.
- An undoable, saved Route editor that lets players paint preferred keep-clear walking lanes; guests favour them without losing safe fallback paths.
- A 10× simulation option and an original state-aware procedural soundtrack with separate master mute, music, ambience, and effects controls.
- Complete React/Phaser Hawker Simulator interface, top-down game world, onboarding, build catalogue, stall/dish menu management, objectives/insights, expansion, settings, accessibility controls, and local save tools.
- Deterministic fixed-step customer lifecycle with queueing, ordering, collection, seat reservation, dining, tray return, exit, target recovery, economy, XP, reputation, levels, and unlock reconciliation.
- A validated launch catalogue of original stalls, dishes, meaningful placeables, customer archetypes, and English localization entries; the entries below record how it grew, and the current counts are in [docs/CONTENT_CATALOGUE.md](docs/CONTENT_CATALOGUE.md#roster-counts).
- Code-native illustrated rendering and procedural WebAudio cues/ambience with original project identity.
- IndexedDB current/backup envelopes, checksums, serialized writes, migrations, backup recovery, import/export, and confirmed reset flow.
- PWA manifest, offline fallback, deterministic content-derived service-worker cache version, acknowledged runtime warming, and save-gated update activation.
- Vitest coverage for content, grid/pathfinding, commands/economy, lifecycle/recovery, persistence/migrations, deterministic soak, and the 80-agent simulation budget.
- Rendered production-output checks for the release shell, security headers, PWA protocol, and absence of starter-facing copy.
- Product, game design, technical, art, content, economy, accessibility, cultural-review, test, performance, security/privacy, deployment, release, support, risk, and project-status documentation plus ADRs.

### Changed

- Restructured the codebase without changing player-visible behaviour. Behaviour-pinning goldens for the seeded simulation, saves, the runtime controller, draw calls, input, the save store, server-rendered markup, the jsdom UI, content and the nutrition importer landed first, and the test suite now mirrors the source tree (`tests/game/core`, `tests/game/runtime`, `tests/app/game`, `tests/content`, `tests/tools`, and so on). The simulation core, the runtime composition root, the visual recipes and renderer, and the simulator UI were then split into focused modules; duplicated balance rules, the launch roster and build-mode configuration each gained a single source; and a module-documentation check now covers the source tree. Unexpected console output and process warnings fail tests. Deferred engineering debt is listed in [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md#deferred-engineering-debt).
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
- Applied patched build-tool pins and narrow transitive overrides; the current dated audit result is in [docs/TEST_REPORT.md](docs/TEST_REPORT.md#dependency-audit).
- Updated dependencies for security advisories without changing player-visible behaviour: `next` and `eslint-config-next` 16.2.6 → 16.3.8 (clears the critical and high Next.js advisories), `react`, `react-dom` and `react-server-dom-webpack` 19.2.6 → 19.2.8, `@cloudflare/vite-plugin` 1.44.0 → 1.62.5 and `wrangler` 4.110.0 → 4.147.0 (patched `miniflare`, `undici` and `sharp`). The exact overrides now pin `image-size` 2.0.4, `js-yaml` 4.3.2, `postcss` 8.5.23 and `sharp` 0.35.5, and the lockfile picks up patched `brace-expansion`, `browserslist`, `fast-uri`, `source-map-js`, `baseline-browser-mapping` and `fflate`. The production-only audit now passes; the all-dependencies audit still reports a `braces` advisory with no patched release, reached only through development tooling.
- CI now gates on the production-only dependency audit (`npm audit --omit=dev --audit-level=high`), because the remaining high advisory (`braces`, no patched release) reaches only development tooling; the all-dependencies result stays recorded in [docs/TEST_REPORT.md](docs/TEST_REPORT.md#dependency-audit).

### Known limitations and release gates

- Real-browser critical-path, offline/update, browser performance, long-soak, and secondary-browser evidence is unavailable for the exact candidate.
- Human Singapore cultural and accessibility review, independent security review, and qualified legal/privacy review are pending.
- No production approval, certification, or compliance claim is made until the release checklist is complete.
