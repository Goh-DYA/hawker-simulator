# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## In-progress structural refactor

A behaviour-preserving structural refactor is underway on the `refactor/structural-tech-debt` branch. Phase 1 (safety-net tests) is done, and Phases 3–8 are still pending. Before changing any code, read `.claude/handover/HANDOVER.md`. It describes the current state, the binding brief, the remaining plan, and the golden files that must not change.

## Standards

Follow the coding and commit standards below. They are copies of the user's global style guides, kept in the repo so that cloud sessions have them too.

@context/CODING_STYLE.md

@context/COMMIT_STYLE.md

Commit subjects use the `[<scope>] Description` format, even though the older history uses unscoped subjects. The guide's linter, type-checker and test-runner steps map to `npm run lint` (ESLint with the Next core-web-vitals and TypeScript rules), `npm run typecheck` (strict `tsc`) and Vitest. Test files keep the `*.test.ts` suffix, because Vitest discovers them by it. Prettier will only be used on newly authored files, once it is added in refactor step S41. The global guide's "virtual environment" rule maps to installing packages locally with `npm` (never `-g`).

Name new TypeScript functions and variables in `snake_case`, as the global guide says, even though the existing code is camelCase. Don't rename existing identifiers. React has two exceptions: components must stay PascalCase, since JSX treats lowercase tags as DOM elements, and custom hooks must stay `useXxx`, since the rules-of-hooks lint only recognises that pattern.

The game is published as **Hawker Balance**. The repo, package, and IndexedDB names still say `hawker-simulator`. It requires Node.js 22.15 or newer. The `@/` import alias maps to the repo root, as in `@/src/game/core`. Don't edit the generated `.next/`, `dist/`, or `node_modules/` folders.

## Commands

```bash
npm run dev                                   # next dev on http://localhost:3000
npm run typecheck                             # tsc --noEmit
npm run lint
npm test                                      # all Vitest suites (tests/**/*.test.ts)
npx vitest run tests/game/core/lifecycle.test.ts   # single file
npx vitest run -t "partial test name"         # single test by name
npm run validate:content                      # content contract only
npm run test:release                          # full gate: typecheck, lint, test, build, test:ssr
```

- `npm run test:ssr` imports `dist/server/index.js`, so it only works after `npm run build`.
- `npm run build` uses Vinext/Vite and writes to `dist/`, with `worker/index.ts` as the Cloudflare Worker entry. `npm run build:vercel` is a separate native `next build`. CI (`.github/workflows/vercel.yml`) runs `test:release`, then `build:vercel`, then `npm audit --audit-level=high`.
- Both builds first run `tools/stamp-service-worker.mjs`. It rewrites the `BUILD_ID` in the tracked `public/sw.js` with a hash of `app/`, `src/`, `public/`, and `package-lock.json`. Any source change followed by a build therefore modifies `public/sw.js`. Commit the restamped file together with the source change that caused it.
- `npm test` includes an 80-agent Node benchmark (`tests/game/core/performance.test.ts`) that prints `BENCHMARK_RESULT`. It does not measure browser rendering.
- **Test layout.** `tests/` mirrors the source tree: `tests/game/core/`, `tests/game/runtime/`, `tests/game/persistence/`, `tests/game/audio/`, `tests/content/`, `tests/app/game/` and `tests/tools/nutrition/`. Tests import source through `@/`. Put a regression test next to the closest existing suite.
- **Test environments.** Tests run in Vitest's Node environment. Suites that need a DOM opt in with `// @vitest-environment jsdom` (React Testing Library), and IndexedDB tests use `fake-indexeddb`. `tests/rendered-html.test.mjs` uses Node's own test runner instead.
- **Console output.** `tests/setup.ts` fails a test on any unexpected `console.warn`/`console.error` or Node process warning. If a test deliberately triggers one, declare it with `expect_console_warning` from `tests/console.ts`.
- **Goldens.** Golden suites, listed in `docs/TEST_PLAN.md`, pin pre-refactor behaviour as sha256 literals and insertion-ordered snapshots. Run them with `CI=true` so a missing snapshot fails rather than being written. Change a golden only for an intentional behaviour or balance change, and say why in the commit.

## Architecture

### Layering (enforced by imports)

1. **`src/content/`** holds the authored data (stalls, dishes, placeables, customers, localization, nutrition) as plain TS constants, plus the Zod schemas (`schemas.ts`) and the cross-reference validator (`validate.ts`). `LAUNCH_CONTENT` in `catalog.ts` carries the content version (`1.3.0`).
2. **`src/game/core/`** is the pure, deterministic simulation. It imports nothing outside itself: not content, Phaser, React, or browser APIs. Instead it receives a `SimulationCatalog` through `GameState.catalog`. Core tests use the small synthetic `TEST_CATALOG` in `tests/game/core/fixtures.ts`, not the real content.
3. **`src/game/runtime/createHawkerRuntime.ts`** (~5.7k lines) is the single composition root. It converts content into a `SimulationCatalog` (`buildCatalog`). It layers the player's stall menus and active dish variants on top (`withStallMenus(withDishVariants(...))`), loads saves, lazy-imports Phaser, and defines the `HawkerScene` class along with all the procedural drawing. It returns a `RuntimeController` (`runtime/types.ts`) and pushes `RuntimeSnapshot`s and events back through callbacks. The smaller `runtime/*.ts` helpers (queue/satisfaction insights, stall menus, visual recipes, activity feed) are pure and have their own tests.
4. **`app/game/HawkerSimulator.tsx`** is a `"use client"` component of about 2.5k lines. It dynamically imports the runtime inside a `useEffect`, keeps the controller, renders every essential control as semantic DOM, and handles saving through `src/game/persistence/saveStore.ts`. Phaser never creates essential DOM controls, and React never mutates simulation entities.

`docs/TECHNICAL_DESIGN.md` lists folders such as `src/game/world` and `src/game/navigation` that don't exist. The real code lives in flat modules under `core/`.

### Core simulation model

- State is immutable. `dispatchCommand(state, command)` returns `{ state, accepted, error?, events }`. Commands validate everything before they mutate anything. A rejection returns `accepted: false` and leaves the gameplay state as it was.
- `advanceSimulation(state, realDeltaMs)` accumulates real time into fixed steps (`config.fixedStepMs`, 10 Hz). It caps the steps per call by quality mode and drops the excess. `stepSimulation` advances exactly one tick, and `updateProgressionSystems` runs at the end of every step.
- Randomness is threaded explicitly: `GameState.rngState` passes through the pure functions in `rng.ts`, which return `{ value, state }`. Never use `Math.random`, wall-clock time, or `localeCompare` in core. Use `compareIds` (`ordering.ts`) for any ID ordering that affects results.
- `simulationDigest` / `stateDigest` and `assertSimulationInvariants` exist for determinism and soak tests. Any change to core behaviour should keep the seeded runs reproducible.
- Customers, queues, and reservations exist only at runtime and are not saved. Map, objects, economy, progression, route guides, access points, visit and nutrition metrics, `rngState`, and `elapsedMs` are saved.

### Persistence has three version layers

1. `core/persistence.ts` defines `PERSISTENT_SCHEMA_VERSION` (currently 4). `migratePersistentState` performs one-way migrations, and `deserializeGameStateWithReport` validates the result against the catalog.
2. The runtime save wrapper (`decodeRuntimeSave` in `createHawkerRuntime.ts`, `runtimeSchemaVersion` 1|2) adds stall menus, dish variants, and `nutritionDataVersion`. If the saved nutrition data version doesn't match the current one, variant choices reset to reviewed defaults.
3. `persistence/saveStore.ts` stores IndexedDB envelopes (`saveVersion`, checksum) in `active` and `backup` slots. At load, the runtime tries each saved candidate in order and falls back to a new centre.

A change to saved shape needs a version bump at the right layer, a migration, a new frozen fixture in `tests/game/core/persistence/fixtures/`, and a test (see `tests/game/core/persistence/migrations.test.ts`).

### Content and nutrition contracts

- `validate.ts` enforces exact launch counts, for example 14 stalls, 54 dishes, at least 80 placeables, 12 archetypes, and 14 nutrition variant families, along with localization completeness. To add or remove content, update `EXPECTED_COUNTS`, the localization entries, and the counts quoted in `README.md` and `docs/CONTENT_CATALOGUE.md`.
- `src/content/nutrition.generated.json` is generated, so don't hand-edit it. It comes from `tools/nutrition/importer.mjs`, which uses the authored exact mappings in `tools/nutrition/manifest.mjs` and operator-supplied CSVs in the git-ignored `data/` folder (see `docs/NUTRITION_DATA.md` for the command). Raw CSVs are never committed, and CSV parsing or fuzzy matching never runs in the browser.
- Dishes have two independent ratings: the Star rating (taste and popularity, authored) and the Health and condition ratings (relative nutrient fit, generated). Health conditions must stay independent of customer personas and demographics. UI copy must not label dishes good or bad or make medical claims.

### Hosting and security

- Response headers live only in `src/config/securityHeaders.ts`, which both `next.config.ts` and `worker/index.ts` consume. The CSP is `connect-src 'self'`.
- By design there is no backend, account, analytics, telemetry, or payment, and gameplay doesn't depend on the network (ADR 0003). The service worker and its save-gated update flow live in `public/sw.js` and `src/game/pwa/registerPwa.ts`.

## Docs conventions

- `docs/DECISIONS.md` requires a new ADR in `docs/adr/` for any reversal that affects persistence, content IDs, rendering perspective, offline behaviour, the accessibility boundary, or release compatibility. Balance tweaks go in `CHANGELOG.md` instead.
- The docs deliberately avoid calling the build production-approved, and edits must keep it that way. Package and cache version numbers do not indicate release state.

## Pull requests

A PR description should explain the impact on players or operations, list the validation commands that were run, and link any relevant issues. Include screenshots for visible UI changes. Call out anything that affects deployment, persistence, accessibility, or security.
