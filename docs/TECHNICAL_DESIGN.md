# Technical Design

Status: Accepted architecture implemented in the release candidate; browser verification pending
Decision records: [ADR 0001](decisions/0001-browser-game-stack.md), [ADR 0002](decisions/0002-art-style-and-perspective.md), [ADR 0003](decisions/0003-local-first-persistence-and-offline.md), [ADR 0004](decisions/0004-simulation-and-ui-boundaries.md), [ADR 0005](decisions/0005-painted-sprite-rendering.md), [ADR 0006](decisions/0006-seeded-neighbourhood-and-save-v5.md)

## Stack

- TypeScript 5.9 with strict project settings.
- Phaser 4.2.1 for the game canvas, input, camera, and rendering.
- React 19 inside the existing Vinext 0.0.50 / Vite 8 application for accessible shell UI, panels, settings, and lifecycle.
- Zod 4 for runtime content and save validation.
- IndexedDB through idb 8 for local-first persistence.
- Vitest 4 for unit, integration, content, save, and simulation tests; browser QA remains a separate release gate.
- Tailwind CSS 4 through PostCSS, used only as the CSS reset: `app/globals.css` starts with `@import "tailwindcss"` for its base layer, and every component style is hand-written CSS in that file rather than utility classes.
- A versioned service worker and web manifest for the production offline shell.

Versions are lockfile-pinned. Version selection does not imply that compatibility or vulnerability review is complete.

## Runtime boundary

React owns semantic UI, routing, settings, modals, focus, announcements, and the canvas container. A client-only game host creates exactly one Phaser game after mount and destroys it on unmount. Phaser owns the world scene and visual input. A typed bridge exchanges commands and read-only view snapshots; React never mutates simulation entities and Phaser never creates essential DOM controls.

## Domain layout

- `src/content/`: authored launch data (stalls, dishes, placeables, customers, localization), the neighbourhood day cards in `src/content/calendar.ts` (with their own English copy, parsed with `calendarCardSchema` at import), the Zod schemas and derived types, the launch roster counts, the generated nutrition snapshot (`src/content/nutrition.generated.json`), the shared ID lookup maps in `src/content/catalog.ts`, and `validateContent` in `src/content/validate.ts`, which runs the rule groups in `src/content/rules.ts`.
- `src/game/core/`: the pure, deterministic simulation in flat modules. `src/game/core/index.ts` is the public API. Grid, footprints and A* live in `grid.ts`, `pathfinding.ts` and `navigation.ts`; commands in `commands.ts` with the build handlers, undo, reconciliation and results in `build.ts`, `undo.ts`, `reconcile.ts` and `results.ts`; the fixed step in `simulation.ts`, with the customer lifecycle, arrivals, choices, visits, queueing and ordering in their own modules; economy, progression, nutrition, utility and satisfaction rules in their own modules; the lunch and dinner rush curve and last orders in `rush.ts`; the tray-return decision, uncleared trays and the table-cleaning crew in `clearing.ts`; the seeded neighbourhood (day-card calendar, director, food writer, day ledger and Service Review report) in `neighbourhood.ts`; seeded randomness and the shared FNV-1a hash in `rng.ts`; the enumerated vocabularies in `enums.ts`; and determinism checks in `diagnostics.ts`. Save serialisation, field readers, section parsers, the V1-V5 migration chain and alias recovery live in the folder module `src/game/core/persistence/`.
- `src/game/runtime/`: the composition root `src/game/runtime/createHawkerRuntime.ts` and the Phaser-free helpers it composes: the content-to-core catalog projection (`catalog.ts`), the launch map and new-game setup (`world.ts`), the live session (`session.ts`), interaction state and hit tests (`interaction.ts`), the runtime save envelope and load pipeline (`saves.ts`), the HUD snapshot projection (`snapshot.ts`), stall menus, nutrition views, the HUD projections of the neighbourhood (`neighbourhood.ts`: today's and tomorrow's cards, the rush timeline and its notice, the food-writer visit, the Service Review and the next-unlock signpost), the activity feed and queue and satisfaction insights. The procedural-art recipes live in `src/game/runtime/visuals/`, the Phaser-free Canvas 2D painters that turn a recipe into a texture in `src/game/runtime/art/`, and the Phaser scene with its texture studio, retained world and overlay views in `src/game/runtime/render/` (see [ADR 0005](decisions/0005-painted-sprite-rendering.md)).
- `src/game/persistence/`: the browser storage adapters. `src/game/persistence/saveStore.ts` owns the IndexedDB database, save envelopes, checksum, import and export; `src/game/persistence/preferences.ts` the preference keys and settings normalisation; and `src/game/persistence/autosave.ts` the debounced, serialised save queue.
- `src/game/pwa/registerPwa.ts`: service-worker registration, offline-cache warming and the update protocol.
- `src/game/audio/AudioDirector.ts`: the procedural Web Audio soundtrack and cues.
- `src/config/`: `src/config/env.ts`, the single reader of build mode and developer query flags, and `src/config/securityHeaders.ts`, the one definition of the response headers.
- `app/`: the React shell. `app/game/HawkerSimulator.tsx` owns the UI state and composes the HUD (`hud.tsx`), the panels (`app/game/panels/`) and the dialogs (`dialogs.tsx`); `app/game/hooks.ts` holds the runtime, autosave, preference and announcement wiring; `display.ts` and `focus.ts` hold the pure view and focus helpers.
- `worker/index.ts`: the Cloudflare worker that serves the Vinext build and applies the security headers.
- `public/`: manifest, icons, offline page and the service worker `public/sw.js`.
- `tools/`: Node-side build tools, including the nutrition importer `tools/nutrition/importer.mjs`, the service-worker stamp and the painter contact-sheet renderer `tools/paint-gallery.ts`.

## Layering rules

Dependencies point one way: `app/` uses the runtime, persistence, content and config modules; the runtime composes core and content; core depends on nothing outside itself.

- `src/game/core/` stays pure. It may not import content, Phaser, React, idb, Zod, the runtime, persistence, `app/` or Next modules, may not use browser globals such as `window`, `document`, `indexedDB` or `performance`, and may not call `Math.random` or `Date.now`. It receives a `SimulationCatalog` through its state instead of reading content, and randomness is threaded through `rng.ts`.
- The renderers, the painters, the visual recipes and the pure runtime helpers (`catalog.ts`, `world.ts`, `saves.ts`, `nutrition.ts`, `snapshot.ts`) may import Phaser as a type only; the scene receives the engine namespace from a dynamic import in the composition root. The painters import nothing from Phaser at all and take no randomness or time, so the same spec always paints the same texture.
- `app/` loads the runtime with a dynamic `import()`, so it may not statically import `createHawkerRuntime` (type imports are allowed), the vendor visuals or anything under `src/game/runtime/render/` or `src/game/runtime/art/`. This keeps Phaser and the painters out of the eager chunk and out of server rendering; the HUD's catalogue and dish thumbnails come from `RuntimeController.renderPreview` and `renderDishPreview` once the scene exists.
- Build mode and the developer query flags are read only through `src/config/env.ts`; `vite.config.ts` and the `tools/*.mjs` scripts run in Node and are the documented exceptions.

ESLint enforces the import, global and property rules above in `eslint.config.mjs`, and `npm run lint` runs with `--max-warnings=0`, so a layering violation fails the gate. The core rule and the `app/` ban on render code and vendor visuals resolve every specifier, relative paths included (`import/no-restricted-paths`); the `app/` ban on a static `createHawkerRuntime` import matches the `@/` alias only.

## Simulation model

Rendering is variable-rate; gameplay advances on a fixed 10 Hz simulation step (`fixedStepMs` = 100). Each call accumulates real time, runs at most the quality mode's `maxFixedStepsPerAdvance` steps and drops the excess, and the scene clamps each frame delta to 250 ms. Every customer is processed on every step. Randomness comes from the seeded state in `rng.ts`, threaded through `GameState.rngState`. Customer state transitions are pure or command-driven and produce typed events.

Each step runs in a fixed order: the spawn countdown and any spawn (skipped from last orders at 18:10 in the adaptive arrival model), every customer once in ID order, the table-cleaning crew (`advance_table_clearing` in `clearing.ts`), and finally `updateProgressionSystems`. On the first step of a new day, `updateProgressionSystems` first closes the finished day (awards the outgoing objectives, then, with a neighbourhood, builds the day report, emits `day-ended` and turns the calendar), then regenerates the daily objectives, then awards objectives and milestones, and last settles the food writer's review.

The neighbourhood never reads or advances `rngState`. Every neighbourhood draw comes from a short stream seeded by ``hashSeed(`${worldSeed}:${system}:${day}`)`` (`day_stream` in `neighbourhood.ts`), a pure function of the centre's world seed, a system name such as `calendar`, `writer` or `objectives`, and the day. `GameState.neighbourhood` is optional: the core golden scenarios run without one and are unaffected by it, and the runtime always creates one. The tray-return habit is likewise a hash of the guest's ID, so no system added for the day rhythm draws from the main stream.

Grid coordinates are integers. World conversion is centralized. Navigation uses four-way A-star with deterministic tie-breaking, computed on demand without a path cache. After a layout change, the reconciliation pass repairs or reroutes affected guests, queues and seat reservations.

## State ownership

Persistent state:

- Player: cash, experience, reputation, level, settings-safe preferences.
- Map: unlocked cells and placed object instances with stable instance IDs.
- Progression: unlocks, objectives, tutorial state, stall upgrades, active menus, and `progression.peakReputation`, the highest live reputation, which every unlock gate reads.
- Neighbourhood: `GameState.neighbourhood` (saved from core schema V5): the world seed, the calendar (today's and tomorrow's cards, the shuffle bag, the food-writer visit), the director tension, the current day's ledger, the last day's report and the Writer's Pick plaques.
- Nutrition: active reviewed variants plus aggregate and bounded recent-serving metrics; order-time profiles, Health/condition ratings, and a customer's personalized result are snapshotted for historical stability.

Runtime-only state:

- Customers, paths, queue and seat reservations, uncleared trays (`GameState.unclearedTrays`, keyed by seat), timers, effects, derived counters, UI selection, and debug overlays.

Commands validate before mutation and commit all related changes atomically. Events inform presentation and derived-stat systems. Save snapshots never serialize transient Phaser objects.

## Content contracts

Content definitions include stable IDs, localization keys, footprints, rotations, interaction points, depth anchors, visual/audio references, economy values, unlock requirements, dish Star ratings, and explicit nutrition profile/variant status. The validator checks the record counts in `LAUNCH_ROSTER` (`src/content/roster.ts`): every count is exact except placeables, which are a minimum. The current counts are in [CONTENT_CATALOGUE.md](design/CONTENT_CATALOGUE.md#roster-counts). Nutrition schema version 2 requires every profile to be released; each profile carries an overall Health rating and ratings for high cholesterol, obesity, diabetes, and hypertension.

Nutrition source rows are joined only by authored exact, curated-synonym, or explicitly scaled mappings during a deterministic build-time import; raw CSV parsing and fuzzy matching never run in the browser. Health ratings are generated from within-class relative nutrient fits and stored in the reviewed artifact, while Star ratings remain authored content derived from dish quality and demand. Startup (in every build) and tests perform Zod parsing, cross-reference checks, uniqueness checks, nutrition plausibility and provenance checks, localization completeness, rating bounds, and exact launch counts. A malformed production definition fails to a readable safe screen, never a partially loaded simulation.

## Persistence

IndexedDB database `hawker-simulator` holds a `saves` store with two slots, `active` and `backup`, and a `preferences` store. Each save is an envelope with `appVersion`, `saveVersion`, `writtenAt`, a checksum and the runtime payload; the checksum is an FNV-1a hash of a key-sorted serialisation of the payload.

A save runs in one read-write transaction: read the current `active` envelope, copy it to `backup` if its version and checksum are valid, write the new envelope to `active`, then commit. There is no separate staging record or read-back step. The autosave queue in `src/game/persistence/autosave.ts` debounces writes by 200 ms and serialises them; the runtime requests a write after accepted commands, when new catalogue choices unlock or menus or lifetime revenue change, and otherwise every 15 seconds of wall-clock time while the centre is open and running, and the shell flushes any pending write on `pagehide` and unmount. Storage failures are logged and surfaced to the player as a storage warning.

At load, the store returns the `active` and `backup` payloads whose envelopes are valid, in that order. The runtime tries each through `load_runtime_save` (envelope decode, core migration and catalog validation, map check, `ensure_neighbourhood`, unlock reconciliation and menu and variant resolution) and starts a new centre when none loads. `ensure_neighbourhood` (`src/game/runtime/world.ts`) gives a save without a neighbourhood (every migrated V1-V4 save) one seeded from its `rngState`, so the same save always gains the same calendar. A new centre takes its world seed from `RuntimeOptions.createWorldSeed`, which `app/game/hooks.ts` supplies from `crypto.getRandomValues`; without it the runtime uses the deterministic `LAUNCH_WORLD_SEED`, which the tests rely on. An import keeps the seed in the save. Core migrations are one-way pure functions with frozen fixtures. Core supports ID alias and refund tables for renamed or removed placeables (the `definitionIdAliases` and `removedDefinitionRefunds` options of `deserializeGameStateWithReport`), but the runtime currently passes neither, so a save that references a removed or renamed ID fails to load until `load_runtime_save` passes a table entry for it (see [SAVE_FORMAT.md](SAVE_FORMAT.md#invariants)). Runtime customers and uncleared trays are not saved, so a loaded centre starts empty, with every seat clear, while player, map, progression and neighbourhood state is preserved.

Reset requires confirmation, cancels and settles the autosave queue, deletes both save slots and resets the tutorial and nutrition-tour preferences. It does not touch the service-worker caches.

The guided practice day (`app/game/practice.ts` for the steps and checks, `app/game/coach.tsx` for the coach) swaps centres without touching the save format. Starting it cancels the autosave queue, saves the player's centre, keeps a second `exportState()` payload and the current speed in memory, sets a shell ref that makes `onPersistentChange` drop every write, and then calls the runtime's `reset()`, whose own persistent change is dropped too. While the ref is set, Save now only shows a notice, and Settings turns off export, import and reset (its `isPractice` prop) with a note that says why; the handlers keep the same guard. Exiting calls `importState()` with the kept payload, returns to the select tool at the kept speed and clears the ref; if the import fails, practice stays on so the practice centre is never saved over the player's. A reload during practice therefore loads the player's centre from its last save. The coach's checks compare the latest snapshot with baselines that `observe_practice_snapshot` records in the practice progress (one as practice began and one as each step is first shown) and with a count of objects the Move tool has put down, because a move changes no snapshot total. `move_practice` steps forward or back and remembers the direction, so a card whose target the screen hides is skipped the way the player is going, and passes over a card whose required card was skipped; moving forward onto the building card, the next morning or the finish card pauses the game. During practice the shell also returns to the select tool after each placement, so one click buys one item, and on a phone a card played on the map closes the panel sheet.

## Offline and update model

The service worker `public/sw.js` names its shell and runtime caches after a build ID stamped by `tools/stamp-service-worker.mjs`. Installation precaches the core shell (`/`, the offline page, the manifest and the icon). Runtime caching is same-origin only; navigations go to the network and fall back to the cached shell or the offline page. Activation deletes the application caches of other build IDs and claims open clients.

Update gating happens in the page. `registerPwa` asks the active worker, and any newly installed waiting worker, to warm its runtime cache with the page's same-origin resources, and reports the update as ready only when that warming succeeds. The UI then offers a save-and-reload action: it saves first and calls `activate_waiting_update` only if the save succeeds, which tells the waiting worker to skip waiting and reloads once it takes control. Service-worker registration runs only in production builds.

Development output, source maps not intended for release, environment files, and secrets are excluded.

## Failure handling

- Content is validated with `validateContent` at startup; a failure, or any other startup error, replaces the game with a readable loading-error message.
- Long frames and suspended tabs cannot simulate an unbounded interval: frame deltas are clamped and the steps per advance are capped.
- Resize and zoom recalculate viewport/UI without changing grid state.
- Storage, audio, and service-worker failures degrade independently and visibly: preference and save load failures show a storage warning and the game continues with defaults or a new centre.

## Debug and observability

Developer tooling is gated by `src/config/env.ts`. `has_dev_query_flag` returns true only outside production builds, and call sites test `!IS_PRODUCTION_BUILD` first so Vite drops the developer-only branches from production bundles. The `?debug` flag shows the developer panel (frame and simulation timings, a grid-data overlay of footprints and customer paths, a spawn-customer action and a cash grant). The `?visualQa` flag starts the centre at level 12 with every placeable unlocked and extra cash, for visual checks. Production builds cannot enable either flag.

No analytics or telemetry ships in 1.0. Handled failures are logged to the browser console with their context.

## Verification

Required commands are documented in TEST_PLAN.md and DEPLOYMENT.md. The architecture is not accepted for release until production build, offline reload, save recovery, current stable Chrome, secondary browsers, and performance budgets are verified with recorded evidence.
