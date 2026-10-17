# Remaining refactor plan (Phases 3–8)

Generated from the vetted audit plan. Phase 1 (safety nets) is complete. Phase 2 and some individual steps were descoped by the user (see TECH_DEBT_REGISTER.md, "Descoped"). Work through the packages **in order**; steps inside a package run in the listed order. Read [BRIEF.md](BRIEF.md) first. It overrides any step text it conflicts with.

Line numbers in step descriptions refer to commit 06ac46f (the pre-refactor `main`). Code has moved since, so locate it by content.

## Package index

| Package | Phase | Steps |
|---|---|---|
| [P3-10](#p3-10) | 3 | S32, S33, S34, S35, S36, S37 |
| [P3-11](#p3-11) | 3 | S40, S41, S42, S43, S44 |
| [P3-12](#p3-12) | 3 | S45, S46, S47, S48, S49 |
| [P3-13](#p3-13) | 3 | S50, S51, S52, S53, S54, S55 |
| [P3-14](#p3-14) | 3 | S56, S57, S58, S59, S60 |
| [P3-15](#p3-15) | 3 | S61, S62, S63, S70 |
| [P4-16](#p4-16) | 4 | S71, S72, S73, S74 |
| [P4-17](#p4-17) | 4 | S75, S76, S77, S78 |
| [P4-18](#p4-18) | 4 | S79, S80, S81 |
| [P4-19](#p4-19) | 4 | S82, S83, S84 |
| [P5-20](#p5-20) | 5 | S85, S86, S87, S88, S89 |
| [P5-21](#p5-21) | 5 | S90, S91, S92, S93, S94 |
| [P5-22](#p5-22) | 5 | S95, S96, S97 |
| [P5-23](#p5-23) | 5 | S98, S99, S100, S101, S102 |
| [P5-24](#p5-24) | 5 | S103, S104, S105, S106, S107 |
| [P5-25](#p5-25) | 5 | S108, S109, S110, S111 |
| [P5-26](#p5-26) | 5 | S112, S113, S114 |
| [P5-27](#p5-27) | 5 | S115, S116, S117 |
| [P5-28](#p5-28) | 5 | S118, S119, S120 |
| [P5-29](#p5-29) | 5 | S121 |
| [P6-30](#p6-30) | 6 | S122, S123, S124, S125, S126 |
| [P6-31](#p6-31) | 6 | S127, S128, S129, S130 |
| [P6-32](#p6-32) | 6 | S131, S132, S133 |
| [P6-33](#p6-33) | 6 | S134, S135, S136 |
| [P6-34](#p6-34) | 6 | S137 |
| [P7-35](#p7-35) | 7 | S138, S139, S141, S142 |
| [P7-36](#p7-36) | 7 | S143, S144, S145, S146, S147 |
| [P7-37](#p7-37) | 7 | S148, S150 |
| [P8-38](#p8-38) | 8 | S158, S159, S160, S161 |
| [P8-39](#p8-39) | 8 | S162, S164, S165, S166 |
| [P8-40](#p8-40) | 8 | S167, S168, S169 |

---

# Phase 3: Guardrails and mechanical tidy-up

Lint, tsc and doc guardrails, an explicit core barrel, named constants, shared helpers and vocabularies, env centralisation, service-worker generation, and logging for the swallowed promises.

## P3-10

### S32: Enforce core layering and determinism rules

- **Size:** S. **Register:** TD-03. **Depends on:** S31 (descoped)
- **Files:**
  - `modify eslint.config.mjs`

Add a flat-config block for files ['src/game/core/**/*.ts'] with three rules:
- no-restricted-imports: paths phaser, react, react-dom, idb and zod; patterns '@/src/content*', '**/content/**', '@/src/game/runtime*', '@/src/game/persistence*', '@/app/*' and 'next/*'.
- no-restricted-globals: window, document, navigator, location, localStorage, sessionStorage, indexedDB, performance and fetch.
- no-restricted-properties: Math.random and Date.now.

**Behaviour risk.** None; the current code passes.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `temporarily import '@/src/content' in core/rng.ts; lint fails; revert`

**Why.** Makes the src/game/core purity rule from ADR 0004 a lint error.

### S33: Enforce type-only Phaser in render code and app import bans

- **Size:** S. **Register:** TD-30, TD-03. **Depends on:** S32
- **Files:**
  - `modify eslint.config.mjs`

Add a block for ['src/game/runtime/render/**/*.ts', 'src/game/runtime/visuals/**/*.ts', 'src/game/runtime/{catalog,world,saves,nutrition,snapshot}.ts'] with @typescript-eslint/no-restricted-imports banning 'phaser' and allowTypeImports: true. Add a block for ['app/**/*.{ts,tsx}'] with no-restricted-imports banning '@/src/game/runtime/createHawkerRuntime' (allowTypeImports, because the dynamic import() is not affected), '@/src/game/runtime/render/*' and '@/src/game/runtime/visuals/vendor'. The globs for files that do not exist yet are inert until those files are created.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `temporarily add a static value import of createHawkerRuntime in app/game/HawkerSimulator.tsx; lint fails; revert`

**Why.** The render and visuals modules may import Phaser types only, and app/ may not statically import the runtime root, render code or vendor visuals. Either mistake would pull Phaser into the eager chunk or SSR.

### S34: Move lint ignores into config and fail on warnings

- **Size:** S. **Register:** TD-30. **Depends on:** S33
- **Files:**
  - `modify eslint.config.mjs`
  - `modify package.json`

Add dist/**, .wrangler/**, .vinext/**, .vercel/** and coverage/** to globalIgnores, and remove the nonexistent build/**. Change the lint script to `eslint . --max-warnings=0` without the CLI ignore flags (package.json:20).

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npx eslint . reports 0 problems`
- `npx vitest run tests/hosting-config.test.ts`

**Why.** Plain `npx eslint .` and `npm run lint` now agree, and warnings fail the gate.

### S35: Enforce import order

- **Size:** S. **Register:** TD-30. **Depends on:** S34
- **Files:**
  - `modify eslint.config.mjs`
  - `modify src/game/runtime/<file with the single violation>`

Enable import/order as an error with groups [builtin, external, internal ('@/**' via pathGroups), parent, sibling, index], newlines-between 'never' and alphabetize false, matching the current dominant style. Run `npx eslint . --fix --rule ...` and confirm that only the single known violation changes. If the fix touches more than that file, stop and set the scope from the actual file list.

**Behaviour risk.** Import reordering of side-effect-free modules only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `git diff --stat shows one source file`

**Why.** Maps the global import-order rule (stdlib, third-party, first-party) onto eslint-plugin-import, which eslint-config-next already installs.

### S36: Enable zero-cost strict compiler flags

- **Size:** S. **Register:** TD-30. **Depends on:** S34
- **Files:**
  - `modify tsconfig.json`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Enable noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch, noImplicitReturns and noImplicitOverride. Add `override` to HawkerScene.update at createHawkerRuntime.ts:1618 (type-only). Remove the nonexistent 'examples' and 'build' excludes.

**Behaviour risk.** Type-only; no emitted change.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Turns on flags that currently report no errors, plus noImplicitOverride with its single override keyword.

### S37: Anchor data ignore and document optional environment

- **Size:** S. **Register:** TD-21, TD-44. **Depends on:** S34
- **Files:**
  - `modify .gitignore`
  - `create .env.example`

Change `data/` to `/data/`, add `!.env.example` and a trailing newline. Move `_notes.md`, `/outputs/` and `/work/` into .git/info/exclude (local, not committed). Create .env.example with: the optional VERCEL_AUTOMATION_BYPASS_SECRET (smoke test) and PORT (vinext start), with no values; and a comment listing the Node-side exceptions that read process.env directly (next.config.ts via src/config/env.ts, vite.config.ts:12-14, tools/smoke-deployment.mjs:11).

**Behaviour risk.** None; git status --ignored shows the same set.

**Verification.**
- `git check-ignore -v --no-index src/game/data/x.ts returns nothing`
- `git status --ignored unchanged apart from .env.example`
- `npm run typecheck && npm run lint && npm test`

**Why.** Stops nested data/ folders being silently ignored and allows the documented .env.example.

## P3-11

### S40: Require module JSDoc with a shrink-only allowlist

- **Size:** S. **Register:** TD-55. **Depends on:** S34
- **Files:**
  - `create tests/module-docs.test.ts`

The test globs src/**/*.ts, app/**/*.{ts,tsx}, tools/**/*.mjs and worker/**/*.ts (excluding *.generated.json and sw_template.js) and asserts that the first non-blank token of each file is `/**`, with `'use client'` or `"use client";` allowed before it. A literal UNDOCUMENTED_BASELINE array lists every file that fails today. The test fails if a file not in the baseline lacks the doc, and also if a baseline file now has the doc but is still listed, so the list only shrinks. Every later step that creates or moves a module adds module JSDoc and JSDoc on the exported symbols it creates or moves. Comments are allowed in pure moves.

Override: src/game/pwa/sw_template.js does not exist in this effort (the service-worker template step was descoped); ignore that exclusion. public/ is not globbed.

**Behaviour risk.** Test-only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Every new module must start with a JSDoc block. Existing undocumented files are listed and the list may only shrink.

### S41: Add Prettier configured to the current code style

- **Size:** S. **Register:** TD-56. **Depends on:** S34
- **Files:**
  - `modify package.json`
  - `modify package-lock.json`
  - `create .prettierrc.json`
  - `create .prettierignore`

Gated by D6. Add exact-pinned prettier and .prettierrc.json with { semi: true, singleQuote: false, trailingComma: 'all', tabWidth: 2, printWidth: 100 } (tune printWidth to the value that reformats the fewest existing lines), plus a .prettierignore listing everything except src, app, tools, worker and tests. Add the script `format:check: prettier --check`, taking file arguments. Working rule: steps that author new code (not pure moves) run `npm run format:check -- <files authored in the step>`. Moved code stays byte-identical.

**Behaviour risk.** None; no existing file is reformatted.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run format:check -- tests/setup.ts tests/console.ts`

**Why.** Newly authored files are formatted at creation. The full-repo sweep stays deferred (TD-56).

### S42: Replace export-all with explicit public exports

- **Size:** M. **Register:** TD-28. **Depends on:** S40
- **Files:**
  - `modify src/game/core/index.ts`
  - `modify tests/game/core/*.test.ts`
  - `modify tests/game/runtime/*.test.ts`

Keep `export type * from "./types"`. For every other module, list the names consumed outside core (runtime, app, tests) as explicit named re-exports grouped per module, each group under a JSDoc header. Names used only inside core stay exported from their own module but leave the barrel. Tests that need internals deep-import the module. Compare `Object.keys(await import('@/src/game/core'))` before and after in a scratch script; only intentional removals may differ, and they are listed in the body.

**Behaviour risk.** Compile-time only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Defines the core public API before modules are split, so internals stop leaking.

### S43: Correct misleading config docs and mark dead exports deprecated

- **Size:** S. **Register:** TD-10. **Depends on:** S42
- **Files:**
  - `modify src/game/core/types.ts`
  - `modify src/game/core/state.ts`
  - `modify src/game/core/economy.ts`
  - `modify src/game/core/rng.ts`
  - `modify src/game/core/queueing.ts`
  - `modify src/game/core/pathfinding.ts`
  - `modify src/game/core/nutrition.ts`

Rewrite the maxActiveCustomers JSDoc at types.ts:427: its presence selects the fixed spawnIntervalMs and switches off the adaptive model, and the value is not a cap. Mark reputationGainPerVisit `@deprecated Not read; visit reputation comes from settleVisitRating`. Add @deprecated JSDoc to markAbandonedVisit, choose, nextInt, QUEUE_CARDINAL_DIRECTIONS, validateWorldNavigation and averageRankPercentiles, and a JSDoc note on the never-emitted 'stall-upgraded' event. Delete nothing (D9).

Override: the user approved deleting the pre-existing dead code. In addition to correcting the misleading docs, DELETE the dead exports listed in this step (instead of only marking them @deprecated), provided tsc, lint and tests confirm no consumers. Persisted shapes must not change.

**Behaviour risk.** Comments only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** maxActiveCustomers selects a fixed spawn interval, and reputationGainPerVisit is never read. This documents both and flags the dead helpers for later removal.

### S44: Name economy, progression and nutrition scalar constants

- **Size:** S. **Register:** TD-24. **Depends on:** S42, S12
- **Files:**
  - `modify src/game/core/economy.ts`
  - `modify src/game/core/progression.ts`
  - `modify src/game/core/nutrition.ts`
  - `modify src/game/core/state.ts`

economy.ts: XP_LEVEL_DIVISOR, MAX_REPUTATION, MAX_QUALITY, DEFAULT_REFUND_RATE, STARTING_REPUTATION.
progression.ts: MILESTONE_CASH_PER_TIER, MILESTONE_XP_PER_TIER, HAPPINESS_MIN_NEW_RATINGS, DAILY_OBJECTIVE_COUNT, MIN_ORDER_MS.
nutrition.ts: NUTRITION_ROLL_CHANCE, NUTRITION_INTENT_UNLOCK_LEVEL, NUTRITION_INTENT_MATCH_THRESHOLD, HEALTH_MATCH_THRESHOLD.
state.ts: VISIT_HISTORY_LIMIT.
Keep expression shapes, e.g. Math.sqrt(xp / XP_LEVEL_DIVISOR). Leave persistence.ts:665 (the V1-to-V2 level formula) literal; it is part of a frozen migration. Copy strings stay literal. Each constant gets one-line JSDoc.

**Behaviour risk.** A transcription error would alter digests; the raw-string goldens catch it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core (goldens unchanged)`

**Why.** Literal swaps only; values and expression shapes are identical.

## P3-12

### S45: Share one roll picker for health conditions and intents

- **Size:** S. **Register:** TD-24, TD-23. **Depends on:** S44
- **Files:**
  - `modify src/game/core/nutrition.ts`

Add private `pick_from_roll<T>(roll, options: readonly T[], chance)` with the existing guard and index arithmetic copied verbatim from healthConditionFromRoll, and call it from both functions. Exported names are unchanged.

**Behaviour risk.** Roll mapping must be identical; scenario (f) catches drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core/golden.test.ts`

**Why.** healthConditionFromRoll and nutritionIntentFromRoll now use one private helper with the guard and arithmetic verbatim.

### S46: Export milestone tracks and upgrade rank requirements as data

- **Size:** S. **Register:** TD-07, TD-24. **Depends on:** S44
- **Files:**
  - `modify src/game/core/progression.ts`
  - `modify src/game/core/commands.ts`
  - `modify src/game/core/index.ts`
  - `create tests/game/core/progression.test.ts`

progression.ts: `export const MILESTONE_TRACKS` (id plus targets, in today's order). Build MILESTONES from it in the identical order and assert deep-equality in a new tests/game/core/progression.test.ts against a literal copy of today's MILESTONES. `export const UPGRADE_RANK_REQUIREMENTS = { 2: 2, 3: 4, 4: 7 } as const`, used at commands.ts:366. Export distinctOpenStallTypes. Add the new names to the barrel.

**Behaviour risk.** Order and values; the test and goldens catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** Gives the milestone targets and rank ladder one home in core so the runtime can stop copying them.

### S47: Name arrival, choice and rating tuning constants

- **Size:** M. **Register:** TD-24. **Depends on:** S46
- **Files:**
  - `modify src/game/core/simulation.ts`
  - `modify src/game/core/satisfaction.ts`
  - `modify src/game/core/index.ts`

In simulation.ts, add module constants with JSDoc for:
- the spawn-interval model (1215-1225), with OPERATING_DAY_SECONDS = OPERATING_DAY_MS / 1_000 and the expression shape kept
- the chooseStall and chooseDish weights (STALL_MENU_PREFERENCE_WEIGHT 2.25, DISH_PREFERENCE_WEIGHT 2, ...)
- the settleVisitRating defaults, REPUTATION_NEUTRAL_SCORE and REPUTATION_SCORE_DIVISOR (keep `(score - REPUTATION_NEUTRAL_SCORE) / REPUTATION_SCORE_DIVISOR`)
- the eating and tray factors
In satisfaction.ts, export VISIT_RATING_WEIGHTS (same term order) and use it inside core. Move OFF_SCHEDULE_PERSONA_WEIGHT to the top. Add a comment on the level >= 2 guard: 'gates RNG consumption; do not remove'.

**Behaviour risk.** High if the arithmetic shape changes; scenario (f) now covers the adaptive model.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core/golden.test.ts`

**Why.** About 50 inline literals become UPPER_SNAKE constants of identical value; arithmetic is never folded.

### S48: Read visit rating weights from core

- **Size:** S. **Register:** TD-24, TD-07. **Depends on:** S47
- **Files:**
  - `modify src/game/runtime/satisfactionInsight.ts`

Replace the literal weights in satisfactionInsight.ts with VISIT_RATING_WEIGHTS from '@/src/game/core', keeping the term order of every sum.

**Behaviour risk.** Float order; satisfaction-insight tests and S14 snapshot catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** The HUD insight and the simulation now share one weight table.

### S49: Share progression, metrics and access-point clone helpers

- **Size:** S. **Register:** TD-23. **Depends on:** S47, S12
- **Files:**
  - `modify src/game/core/state.ts`
  - `modify src/game/core/simulation.ts`
  - `modify src/game/core/commands.ts`
  - `modify src/game/core/persistence.ts`

In state.ts add clone_progression, clone_metrics (spread-first, same key order as simulation.ts:146-153 and state.ts:317-324), clone_access_points and clone_visit_ratings, each with JSDoc. Use clone_progression, clone_metrics and clone_access_points in createDraft, createSnapshot and captureUndoSnapshot. In persistentStateFromGame (persistence.ts:713-731), use only clone_visit_ratings and cloneNutritionMetrics inside the existing explicit {trayReturns, visitRatings, nutrition} literal.

**Behaviour risk.** Key order; the S11 literals and the S12 metrics-keys test catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** Deduplicates clone code in the draft, snapshot and undo paths. persistentStateFromGame keeps its explicit three-field metrics literal so no runtime-only metric is persisted.

## P3-13

### S50: Share quality-settings and undo-window accessors

- **Size:** S. **Register:** TD-23. **Depends on:** S49
- **Files:**
  - `modify src/game/core/state.ts`
  - `modify src/game/core/simulation.ts`
  - `modify src/game/core/commands.ts`

In state.ts add get_quality_settings(state) and compute_undo_window_ticks(config), with bodies copied from the existing inline expressions. Replace only the identical sites in simulation.ts and commands.ts.

**Behaviour risk.** None if bodies are identical; goldens catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** Replaces repeated config lookups with two named helpers.

### S51: Share boundary, distance and neighbour-offset geometry helpers

- **Size:** S. **Register:** TD-23. **Depends on:** S50
- **Files:**
  - `modify src/game/core/grid.ts`
  - `modify src/game/core/pathfinding.ts`
  - `modify src/game/core/queueing.ts`
  - `modify src/game/core/commands.ts`

In grid.ts add is_boundary_point(map, point), compute_manhattan_distance(a, b) and CARDINAL_OFFSETS (order N, W, E, S, matching today's neighbour order). Replace the five boundary-predicate copies and the identical distance and offset sites in grid.ts, pathfinding.ts, queueing.ts and commands.ts. Keep neighbour iteration order.

**Behaviour risk.** Neighbour order affects A*; grid-pathfinding tests and goldens catch it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** One boundary predicate, one Manhattan distance and one ordered neighbour list replace their copies.

### S52: Share navigation reserved-point computation

- **Size:** S. **Register:** TD-23. **Depends on:** S51
- **Files:**
  - `modify src/game/core/queueing.ts`
  - `modify src/game/core/index.ts`
  - `modify src/game/core/commands.ts`
  - `modify src/game/core/pathfinding.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

In queueing.ts add get_navigation_reserved_points(state) and export it from the barrel. Use it at the four core sites and at createHawkerRuntime.ts:1040 and :5107. Keep the point order.

**Behaviour risk.** Set and order identical; S11 and S14-S16 catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game`

**Why.** Six copies of the reserved navigation points become one core helper used by core and runtime.

### S53: Share the effective-catalog computation in simulation

- **Size:** S. **Register:** TD-23. **Depends on:** S52
- **Files:**
  - `modify src/game/core/progression.ts`
  - `modify src/game/core/simulation.ts`
  - `modify src/game/core/state.ts`
  - `modify src/game/core/commands.ts`

In progression.ts add get_effective_catalog(state), with its body taken from simulation.ts:106-114. Use it there and at 1288-1294 only. Leave state.ts:141 and the commands.ts raw-catalog sites unchanged, with a `// Raw catalog on purpose; see TD-46` comment.

**Behaviour risk.** None for identical bodies.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** The two identical effective-catalog blocks in simulation.ts use one helper; the raw-catalog command sites are untouched (TD-46).

### S54: Replace locale-dependent sorting with compareIds

- **Size:** S. **Register:** TD-23. **Depends on:** S53
- **Files:**
  - `modify src/game/core/grid.ts`
  - `modify src/game/core/nutrition.ts`
  - `modify src/game/core/economy.ts`

Replace the localeCompare calls at grid.ts:293 and nutrition.ts:410, and the default .sort() at economy.ts:118, with compareIds. If any golden changes, the orders were not equivalent for current data: revert, and record the case under TD-46 as a deferred behaviour change.

**Behaviour risk.** Order could differ for mixed-case IDs; the goldens decide.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game tests/content`

**Why.** Removes locale-dependent comparisons from the deterministic core.

### S55: Move the customer-order comparator into ordering

- **Size:** S. **Register:** TD-23. **Depends on:** S54
- **Files:**
  - `modify src/game/core/ordering.ts`
  - `modify src/game/core/simulation.ts`

Move the comparator body at simulation.ts:1230-1234 verbatim into ordering.ts as `export function compare_customer_ids(a, b)`, with JSDoc, and call it from simulation.ts.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core/golden.test.ts`

**Why.** Pure move of the comparator beside compareIds.

## P3-14

### S56: Share one FNV-1a hash implementation

- **Size:** S. **Register:** TD-23. **Depends on:** S55, S17
- **Files:**
  - `modify src/game/core/rng.ts`
  - `modify src/game/core/index.ts`
  - `modify src/game/persistence/saveStore.ts`

Add `export function compute_fnv1a32(text: string): number` to rng.ts, with the loop copied from hashSeed, and export it from the barrel. Use it in hashSeed and in the saveStore checksum, keeping `.toString(16).padStart(8, "0")` at the call site.

**Behaviour risk.** A hash change would invalidate saves; the S17 golden envelope and the S11 seeds catch it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game`

**Why.** The seed hash and the save checksum use one bit-identical loop.

### S57: Use the core pointKey helper

- **Size:** S. **Register:** TD-23. **Depends on:** S56
- **Files:**
  - `modify src/game/runtime/queueInsight.ts`

Replace the local key template in queueInsight.ts with pointKey from '@/src/game/core' (same `${x},${y}` format; verify before changing).

**Behaviour risk.** None if the formats match.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Removes a local copy of the point key format.

### S58: Derive core unions from ordered vocabulary tuples

- **Size:** M. **Register:** TD-13. **Depends on:** S57
- **Files:**
  - `create src/game/core/enums.ts`
  - `modify src/game/core/types.ts`
  - `modify src/game/core/nutrition.ts`
  - `modify src/game/core/index.ts`
  - `create tests/content/schemas.test.ts`

Create src/game/core/enums.ts, a leaf module with no imports and module JSDoc. It holds as-const ROTATIONS, TILE_KINDS, QUALITY_MODES, QUEUE_DIRECTIONS, OBJECTIVE_KINDS, NUTRITION_OBJECTIVE_CRITERIA, VISIT_RATING_COMPONENT_KEYS and NUTRITION_UNAVAILABLE_REASONS, in today's order. Make HEALTH_CONDITIONS, NUTRITION_INTENTS and NUTRITION_METRICS as-const (same order). Derive the unions in types.ts via import type. Export the tuples from the barrel. Create tests/content/schemas.test.ts comparing the Zod enum options and nutrient keys with the core tuples.

**Behaviour risk.** Tuple order is load-bearing; the goldens catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core tests/content`

**Why.** Makes the vocabulary lists exhaustive by construction, with a contract test against the content Zod enums.

### S59: Validate persisted vocabularies against the shared tuples

- **Size:** S. **Register:** TD-13. **Depends on:** S58, S12
- **Files:**
  - `modify src/game/core/persistence.ts`
  - `modify src/game/core/validation.ts`

In persistence.ts add `assert_one_of<T>(value, allowed: readonly T[], message): T`, which throws `new PersistenceError(message)` with the same text. Replace the literal chains in persistence.ts and validation.ts with it, keeping the order in which fields are checked.

**Behaviour risk.** Messages are player-visible; the S12 message table catches drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core/persistence`

**Why.** Literal comparison chains in persistence and validation become one assert_one_of check with the identical error text and check order.

### S60: Remove duplicated bridge types and stale casts

- **Size:** S. **Register:** TD-22. **Depends on:** S58, S24
- **Files:**
  - `modify src/game/runtime/types.ts`
  - `modify app/game/HawkerSimulator.tsx`

types.ts: `export type { QualityMode } from "@/src/game/core"`; `export type HealthConditionId = HealthCondition` (names kept); readonly on the RuntimeEvent fields.
HawkerSimulator.tsx: delete the casts at 1183-1190 (use snapshot.nutritionFamilies, nutritionPulse and selectedCustomerNutrition directly), delete EMPTY_NUTRITION_PULSE (orphaned by this change), remove the casts at 487-490 and 518-520, and capture `const selected_object_id = snapshot.selectedObjectId` before the closure at 1475-1478.

**Behaviour risk.** Type-only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/app/game`

**Why.** Restores compile-time checking across the runtime-to-UI contract. Type-only.

## P3-15

### S61: Type the visit-component averaging

- **Size:** S. **Register:** TD-22. **Depends on:** S60
- **Files:**
  - `modify src/game/runtime/createHawkerRuntime.ts`

Replace the double cast at createHawkerRuntime.ts:1026-1034 with a local typed `compute_average_visit_components(ratings)` that iterates VISIT_RATING_COMPONENT_KEYS. The tuple order equals today's Object.keys order, and the reduce order is the same.

**Behaviour risk.** Float summation order; the S14 snapshot catches drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Replaces a double cast with the core component-key tuple; the summation order is unchanged.

### S62: Export shared content lookup maps from the content catalog

- **Size:** S. **Register:** TD-11. **Depends on:** S61, S20
- **Files:**
  - `modify src/content/catalog.ts`
  - `modify src/content/index.ts`
  - `modify src/game/runtime/stallMenus.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

In src/content/catalog.ts, export DISH_BY_ID, STALL_BY_ID and PLACEABLE_BY_ID as ReadonlyMaps built in array order, with JSDoc, and re-export them from index.ts. Replace the local maps at stallMenus.ts:17 and createHawkerRuntime.ts:96-106 with these.

**Behaviour risk.** None; same entries.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** The runtime stops building its own DISH_BY_ID-style maps.

### S63: Centralise build-mode and dev query flag access

- **Size:** S. **Register:** TD-44. **Depends on:** S62, S19 (descoped)
- **Files:**
  - `create src/config/env.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify src/game/pwa/registerPwa.ts`
  - `modify next.config.ts`
  - `create tests/config/env.test.ts`

Create src/config/env.ts with module JSDoc listing the exceptions: vite.config.ts and tools/*.mjs, which run in Node outside the app. It exports:
- `IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production"` (keep this literal expression)
- `IS_DEVELOPMENT_BUILD = process.env.NODE_ENV === "development"`
- `has_dev_query_flag(name: "debug" | "visualQa"): boolean`, which returns false in production or when location is undefined
Use them at HawkerSimulator.tsx:211-215, createHawkerRuntime.ts:903-907, registerPwa.ts:39 and next.config.ts:4. next.config.ts keeps its object shape. Add tests/config/env.test.ts.

Override: the deploy-output goldens (test:ssr:vercel) were descoped. Instead: npm run build && npm run test:ssr, npm run build:vercel must succeed, tests/hosting-config.test.ts must pass, and a scratch (uncommitted) script must show next.config.ts headers() output is identical before and after for NODE_ENV=development and production. Restore public/sw.js after each build.

**Behaviour risk.** If folding failed, dev branches would ship; checked by bundle grep and the deploy goldens.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build && npm run test:ssr (vinext golden byte-identical) && git checkout public/sw.js`
- `npm run build:vercel && npm run test:ssr:vercel (next golden byte-identical) && git checkout public/sw.js`
- `grep -c visualQa in dist/client/assets/HawkerSimulator-*.js and .next/static chunks is 0`

**Why.** Gives NODE_ENV and the ?debug and ?visualQa flags one audited reader that bundlers can still inline. Node-side tool reads are documented exceptions.

### S70: Log rejected AudioContext lifecycle promises

- **Size:** S. **Register:** TD-29. **Depends on:** S03
- **Files:**
  - `modify src/game/audio/AudioDirector.ts`
  - `modify tests/game/audio/audio-director.test.ts`

Replace `void this.context?.close()` (:81) and `void this.context.suspend()/resume()` (:91-92) with `.catch((error) => console.warn("[audio] <op> failed", error))` and keep them fire-and-forget. Add tests with a fake AudioContext whose methods reject, asserting expect_console_warning.

**Behaviour risk.** Logging only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** close, suspend and resume rejections were discarded with void; they are now logged without changing control flow.

---

# Phase 4: Core decomposition

Split persistence, simulation and commands into cohesive modules. Then make the state machine and the command router exhaustive.

## P4-16

### S71: Split persistence.ts into a folder module

- **Size:** M. **Register:** TD-27. **Depends on:** S59
- **Files:**
  - `delete src/game/core/persistence.ts`
  - `create src/game/core/persistence/index.ts`
  - `create src/game/core/persistence/fields.ts`
  - `create src/game/core/persistence/parsers.ts`
  - `create src/game/core/persistence/migrations.ts`
  - `create src/game/core/persistence/recovery.ts`

Move code verbatim, adding only imports and module JSDoc:
- fields.ts: PersistenceError, isRecord, finite, boundedPercentage, healthRating, safeInteger, stringValue, parsePoint, parseWorldPoint, assert_one_of.
- parsers.ts: parseMap, parseObject, parseQuality, parseDailyObjectives, parseMastery, parseVisitRatings, parseNutritionValue/Profile/Metrics.
- migrations.ts: parseV1 to parseV4 and migratePersistentState.
- recovery.ts: normalizeObjects, normalizeUnlocks.
- index.ts: PERSISTENT_SCHEMA_VERSION, DeserializeOptions/Result, PersistenceRecoveryReport, persistentStateFromGame, canonicalize, serializeGameState, deserializeGameState(WithReport), and re-exports of PersistenceError and migratePersistentState.
fields.ts must not import index.ts.

**Behaviour risk.** None for a pure move.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`
- `git diff -M --color-moved=zebra shows only moved blocks, imports and JSDoc`

**Why.** Pure move; ./persistence now resolves to persistence/index.ts.

### S72: Move the persisted schema version to a leaf module and use it for literal versions

- **Size:** S. **Register:** TD-27. **Depends on:** S71
- **Files:**
  - `modify src/game/core/enums.ts`
  - `modify src/game/core/persistence/index.ts`
  - `modify src/game/core/types.ts`
  - `modify src/game/core/state.ts`

Move `PERSISTENT_SCHEMA_VERSION = 4` into enums.ts (no imports) and re-export it from persistence/index.ts under the same name. Type schemaVersion as `typeof PERSISTENT_SCHEMA_VERSION` in types.ts. Replace the literal current-version 4s at state.ts:196/296 and in persistence/index.ts with the constant. Literal versions inside migrations.ts that name historical versions stay literal.

**Behaviour risk.** None; same value.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** Removes nine literal 4s and avoids a state-to-persistence import cycle.

### S73: Replace ad-hoc migration recursion with an upgrade chain

- **Size:** M. **Register:** TD-27. **Depends on:** S72
- **Files:**
  - `modify src/game/core/persistence/migrations.ts`

Keep the parseV1 to parseV4 bodies byte-identical. Add:
- upgrade_v1_to_v2: returns today's V2 literal from persistence.ts:664-695 byte-identical, including level = 1 + Math.floor(Math.sqrt(old.xp / 100)) and the extra V3-only fields. Do not drop any field.
- upgrade_v2_to_v3: accessPoints entrance-1/exit-1, routeGuidePoints [] and metrics {trayReturns 0, visitRatings []}, copied from today's branch.
- upgrade_v3_to_v4: metrics.nutrition = createEmptyNutritionMetrics().
migratePersistentState parses the input version, then loops over an UPGRADES table until it reaches PERSISTENT_SCHEMA_VERSION, re-parsing after each step exactly as the current recursion does. The unsupported-version message is unchanged.

**Behaviour risk.** Key order and messages are load-bearing; the S12 fixture hashes (V1 through the full chain) catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core/persistence`

**Why.** Each schema version has one parse and one upgrade step. Parser bodies, check order and the V1-to-V2 literal (including the validated level field) are unchanged.

### S74: Share nutrition metric record builders and cloners

- **Size:** S. **Register:** TD-27. **Depends on:** S73
- **Files:**
  - `modify src/game/core/nutrition.ts`

Add build_intent_metrics_record, build_metric_record and clone_day_metrics, used by createEmptyNutritionMetrics, createEmptyNutritionDayMetrics and cloneNutritionMetrics. Keep the literal key order exactly (servedMeals ... today). Leave the redundant `...empty` spread in place.

**Behaviour risk.** Key order affects digests; the S11 and S12 literals catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** Adding a nutrition counter now touches one builder and one cloner.

## P4-17

### S75: Share lifetime and daily nutrition metric parsers

- **Size:** S. **Register:** TD-27. **Depends on:** S74
- **Files:**
  - `modify src/game/core/persistence/parsers.ts`
  - `modify tests/game/core/persistence/index.test.ts`

Add parse_intent_metrics, parse_metric_amounts, parse_metric_counts, parse_dish_servings and parse_day_metrics(source, prefix), with prefixes 'metrics.nutrition.' and 'metrics.nutrition.today.'. Keep the safeInteger versus finite reader per field and the field order. Extend the S12 message table with one malformed today field and one malformed lifetime field.

**Behaviour risk.** Messages and key order; the tests catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** The lifetime and today metrics now share parsers with prefix-built messages that are identical to today's.

### S76: Move world-navigation validation out of pathfinding

- **Size:** S. **Register:** TD-40. **Depends on:** S71
- **Files:**
  - `create src/game/core/navigation.ts`
  - `modify src/game/core/pathfinding.ts`
  - `modify src/game/core/state.ts`
  - `modify src/game/core/commands.ts`
  - `modify src/game/core/index.ts`

Move validateWorldNavigationAccess and validateWorldNavigation (pathfinding.ts:171-262) verbatim into src/game/core/navigation.ts, with module JSDoc. Update the imports in state.ts and commands.ts and the barrel re-exports.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `git diff -M --color-moved=zebra`

**Why.** Pure move; pathfinding.ts keeps only A* and no longer depends on queueing.

### S77: Move step draft and diagnostics out of simulation.ts

- **Size:** M. **Register:** TD-53. **Depends on:** S76, S13
- **Files:**
  - `create src/game/core/draft.ts`
  - `create src/game/core/diagnostics.ts`
  - `modify src/game/core/simulation.ts`
  - `modify src/game/core/state.ts`
  - `modify src/game/core/index.ts`

draft.ts (internal, not in the barrel): Draft/StallRuntime/MoveResult, createDraft, event, transition, getArchetype, getStall, openStalls, activePreparationCount, removeFromAllQueues, releaseSeat, markRecovery, blockedTiles, requestPath, preparePath, pathNeedsRefresh, moveToward and chooseExit (simulation.ts:74-338, 405-410, 765-769).
diagnostics.ts (public names unchanged): assertSimulationInvariants, simulationDigest, and stateDigest moved from state.ts:330-337.
Constants stay in leaf modules to avoid circular initialisation. Add module JSDoc.

**Behaviour risk.** None for a verbatim move.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`
- `git diff -M --color-moved=zebra`

**Why.** Pure move of draft primitives, movement, and the digest and invariant functions.

### S78: Move arrivals and choice logic out of simulation.ts

- **Size:** M. **Register:** TD-53. **Depends on:** S77
- **Files:**
  - `create src/game/core/arrivals.ts`
  - `create src/game/core/choices.ts`
  - `modify src/game/core/simulation.ts`
  - `modify src/game/core/index.ts`

arrivals.ts: OFF_SCHEDULE_PERSONA_WEIGHT, eligibleNutritionIntents, eligibleHealthConditions, recordIntentRequest, customerArchetypeSpawnWeight (public), spawnCustomer and the arrival constants, plus compute_next_spawn_interval_ms with its body verbatim from 1209-1227.
choices.ts: affordableDishes, boundedDishDemandAppeal (public), chooseStall, chooseDish, findSeat, findReservedSeat, findTrayReturn, findTargetTrayPoint and the choice constants.
Add module JSDoc.

**Behaviour risk.** Spawn must happen before the interval computation; scenario (f) catches reordering.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** Pure move; RNG call sites keep their position within each function and stepSimulation still spawns before computing the next interval.

## P4-18

### S79: Move visit settlement and customer lifecycle out of simulation.ts

- **Size:** M. **Register:** TD-53. **Depends on:** S78
- **Files:**
  - `create src/game/core/visits.ts`
  - `create src/game/core/lifecycle.ts`
  - `modify src/game/core/simulation.ts`

visits.ts: normalizeQuality, settleVisitRating, beginExit, completeSale and the rating constants. lifecycle.ts (internal): processCustomer verbatim. simulation.ts keeps stepSimulation and advanceSimulation (about 90 lines), with module JSDoc documenting the RNG order and the 'undefined = despawned' contract.

**Behaviour risk.** None for a verbatim move.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core (performance within budget)`

**Why.** Pure move; simulation.ts now holds only stepSimulation and advanceSimulation.

### S80: Extract nutrition bookkeeping from completeSale and intent requests

- **Size:** M. **Register:** TD-53. **Depends on:** S79, S75
- **Files:**
  - `modify src/game/core/nutrition.ts`
  - `modify src/game/core/visits.ts`
  - `modify src/game/core/arrivals.ts`

In nutrition.ts add record_intent_request(metrics, intent, ...), record_nutrition_sale(metrics, dish, profile, customer, ...) and count_request_result(...), with bodies lifted from completeSale (visits.ts, formerly simulation.ts:771-943) and recordIntentRequest (arrivals.ts). Call them at the same points; the request is recorded before the sale. Lifetime and today counters are updated in today's statement order.

**Behaviour risk.** Statement order inside the metrics objects affects key order; the raw-string goldens (d) and (f) catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** The about 105 lines of nutrition-metric updates in completeSale, and their duplicate in recordIntentRequest, become named functions in core nutrition.ts, keeping call order and key order.

### S81: Dispatch customer statuses through an exhaustive handler table

- **Size:** M. **Register:** TD-26. **Depends on:** S80
- **Files:**
  - `modify src/game/core/lifecycle.ts`

Define `type StatusHandler = (draft, customer, delta_ms) => Customer | undefined`, one handler per status (handle_choosing_stall, ...), and `CUSTOMER_STATUS_HANDLERS = {...} satisfies Record<CustomerStatus, StatusHandler>`. processCustomer keeps the elapsed-time update and the max-visit check, then dispatches. Add recover_to_stall_choice(draft, customer, message, should_clear_order) and recover_to_seat_search(draft, customer, message), each running removeFromAllQueues, markRecovery and transition in today's order. should_clear_order is true only for the paths at old simulation.ts:965 and :1057. The 977-979 path passes movement.customer.

**Behaviour risk.** Event order is part of the digest; S13 and the goldens catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core/simulation.recovery.test.ts tests/game/core/golden.test.ts`
- `temporarily add a dummy status to the union; tsc fails; revert`

**Why.** A new CustomerStatus without a handler is now a compile error, and the duplicated recovery sequences share helpers.

## P4-19

### S82: Move command handlers out of commands.ts

- **Size:** M. **Register:** TD-40. **Depends on:** S76
- **Files:**
  - `create src/game/core/build.ts`
  - `create src/game/core/reconcile.ts`
  - `create src/game/core/undo.ts`
  - `modify src/game/core/commands.ts`
  - `modify src/game/core/index.ts`

reconcile.ts: reconcileWorldTargets (public), reconcileWorldGeometryChange and clearNavigation (commands.ts:118-274).
undo.ts: restoreUndoSnapshot, plus the undo branch as apply_undo.
build.ts: each build branch of dispatchCommand (401-704) lifted verbatim into handle_add_access_point, handle_move_access_point, handle_remove_access_point, handle_configure_guest_route, handle_place_object, handle_expand_map, handle_configure_queue, handle_set_queue_direction, handle_remove_object and handle_transform_object, each taking (state, command, before).
Add module JSDoc.

**Behaviour risk.** Validation order decides messages; the bodies move unchanged.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`
- `git diff -M --color-moved=zebra`

**Why.** Pure move of reconciliation, undo restore and the build-command branches into named functions with unchanged bodies, still called in the same if-chain order.

### S83: Route commands through a mapped-type handler table

- **Size:** M. **Register:** TD-40. **Depends on:** S82
- **Files:**
  - `modify src/game/core/commands.ts`
  - `modify src/game/core/build.ts`
  - `create tests/game/core/commands.test.ts`

Add `COMMAND_HANDLERS: { [K in GameCommand["type"]]: (state, command: Extract<GameCommand, { type: K }>) => CommandResult }` and `BUILD_COMMAND_TYPES = {...} satisfies Record<BuildCommand["type"], true>`. isBuildCommand uses `Object.hasOwn(BUILD_COMMAND_TYPES, command.type)`. dispatchCommand returns `reject(state, "Unsupported command")` when `!Object.hasOwn(COMMAND_HANDLERS, command.type)`. Keep the shared pre-steps in today's order (captureUndoSnapshot before validation; set-stall-open clearing undoStack). Leave the catch blocks unchanged. Add tests in tests/game/core/commands.test.ts for an unknown type and for 'toString' as a type.

**Behaviour risk.** The order of rejection messages must be kept; command-economy, guest-routing and golden (e) catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/core`

**Why.** Every GameCommand type must have a handler, the build-command guard is derived, and unknown command types still get the deterministic 'Unsupported command' rejection.

### S84: Split catalog validation into record-type rule groups

- **Size:** S. **Register:** TD-49. **Depends on:** S71
- **Files:**
  - `modify src/game/core/validation.ts`
  - `create tests/game/core/validation.test.ts`

Add validate_placeables, validate_dishes and validate_archetypes(catalog, issues), called in today's order, plus check_record_identity and check_range with the exact message strings. First write tests/game/core/validation.test.ts pinning the full issue list for one mutation per record type, then refactor.

**Behaviour risk.** Issue order and text; the test catches drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Same issues in the same order; the 235-line function becomes three focused validators. The catch is unchanged.

---

# Phase 5: Runtime decomposition

Shrink createHawkerRuntime.ts into catalog, world, saves, nutrition, snapshot, visuals, render, interaction and session modules, and add ID-keyed art tables.

## P5-20

### S85: Move content-to-core catalog projection out of the runtime root

- **Size:** M. **Register:** TD-11. **Depends on:** S15, S16, S61
- **Files:**
  - `create src/game/runtime/catalog.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move verbatim from createHawkerRuntime.ts into src/game/runtime/catalog.ts:
- BUILDABLE_CONTENT (95)
- BUILDABLE_REQUIREMENTS and usesComplexUnlock (107-117)
- VisualDefinition and localized (148-157)
- coreKind (183-191)
- coreNutritionProfile (239-258)
- buildCatalog (353-491)
- withDishVariants (652-666)
- withStallMenus (722-743)
- effectiveCatalog, as effectiveCatalog(state, catalog)
Keep `import type Phaser` and the dynamic import in the root. catalog.ts imports no phaser value. Add module JSDoc.

**Behaviour risk.** None for a pure move.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime (createHawkerRuntime suites unchanged)`
- `git diff -M --color-moved=zebra`

**Why.** Pure move of pure helpers so they can be tested without Phaser.

### S86: Move map constants, starter layout and unlock reconciliation

- **Size:** S. **Register:** TD-11. **Depends on:** S85
- **Files:**
  - `create src/game/runtime/world.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move TILE_SIZE, MAP_WIDTH and MAP_HEIGHT (92-94), reconcileRuntimeUnlocks (119-146), starterObjects (493-544), freshState (546-583) and assertRuntimeMap (585-596) into world.ts. world.ts imports catalog only for types. Add JSDoc on reconcileRuntimeUnlocks explaining the between-frames contract and why it stays out of core.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** Pure move of new-game setup and map rules.

### S87: Move nutrition projections and variant resolution

- **Size:** S. **Register:** TD-11. **Depends on:** S86
- **Files:**
  - `create src/game/runtime/nutrition.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify src/game/runtime/catalog.ts`
  - `modify tests/game/runtime/runtime-nutrition.test.ts`
  - `modify tests/game/runtime/visual-recipes.test.ts`

Move nutritionVisualKeyForVariant (228-237), runtimeNutritionProfile (260-285), HEALTH_CONDITION_LABELS/NUTRIENTS, customerHealthDecisionReasons and customerDecisionReasons (287-351), defaultDishVariants (643-650) and resolveDishVariants (668-702) into src/game/runtime/nutrition.ts. Move coreNutritionProfile here from catalog.ts and have catalog import it, to avoid a cycle. Update the imports in tests/game/runtime/runtime-nutrition.test.ts and visual-recipes.test.ts. No phaser import.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** Pure move; the moved tests import the new module and stop loading the runtime root.

### S88: Move the runtime save envelope helpers

- **Size:** S. **Register:** TD-11. **Depends on:** S87
- **Files:**
  - `create src/game/runtime/saves.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify tests/game/runtime/runtime-nutrition.test.ts`

Move RuntimePersistentState (635-641), resolvePersistedDishVariants (704-720) and decodeRuntimeSave (745-772) verbatim into src/game/runtime/saves.ts, with module JSDoc. Update the test imports.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** Pure move of the runtime save shape and its decoders.

### S89: Type the runtime persistence bridge

- **Size:** S. **Register:** TD-22. **Depends on:** S88
- **Files:**
  - `modify src/game/runtime/saves.ts`
  - `modify src/game/runtime/types.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify app/game/HawkerSimulator.tsx`

In saves.ts add `export const RUNTIME_SCHEMA_VERSION = 2 as const` and use it where the literal 2 is written and checked. Re-export RuntimePersistentState from types.ts. Type `onPersistentChange(state: RuntimePersistentState)` and `exportState(): RuntimePersistentState`, and remove the resulting unknown-casts in HawkerSimulator.tsx. Field names are unchanged.

**Behaviour risk.** None; the S14 export literal proves it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime tests/app/game`

**Why.** The runtime save shape and version become a compile-time contract shared by the runtime and the UI. Payload bytes are unchanged.

## P5-21

### S90: Move menu and event-copy helpers beside their siblings

- **Size:** S. **Register:** TD-11. **Depends on:** S89
- **Files:**
  - `modify src/game/runtime/stallMenus.ts`
  - `modify src/game/runtime/activityFeed.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move stallMenuProgression, stallMenuSlotBonuses and stallMenusMatch (774-805) into stallMenus.ts, and formatSimulationEvent (607-633) into activityFeed.ts. Bodies are unchanged.

**Behaviour risk.** About 30 lines move into the eager chunk; compare chunk sizes.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build && npm run test:ssr (compare chunk sizes with docs/PERFORMANCE_REPORT.md)`

**Why.** Pure move.

### S91: Name runtime projection, world and cadence constants

- **Size:** S. **Register:** TD-24. **Depends on:** S90
- **Files:**
  - `modify src/game/runtime/catalog.ts`
  - `modify src/game/runtime/world.ts`
  - `modify src/game/runtime/activityFeed.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

catalog.ts: REPUTATION_SCALE = 20 (replace `* 20` and `/ 20`, never with `* 0.05`), STALL_QUEUE_CAPACITY, STALL_REFUND_RATE, STALL_ROTATIONS, STALL_QUALITY_BONUS_CAP, STALL_QUALITY_PRICE_DIVISOR, FALLBACK_DISH_PRICE, LOCKED_UNTIL_RECONCILED and PLACEHOLDER_PALETTE.
world.ts: ACCESS_ROW, LAUNCH_SEED and STARTER_LAYOUT.
activityFeed.ts: SALES_GROUP_KEY = "sales", used at both sites.
Root: HUD_INTERVAL_MS, PERIODIC_SAVE_INTERVAL_MS, MAX_FRAME_DELTA_MS, and CAMERA_MIN_ZOOM/CAMERA_MAX_ZOOM shared by the wheel and zoomBy.
Each constant gets one-line JSDoc.

**Behaviour risk.** A typo in the seed or a value; the S14 to S16 literals catch it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** Simulation-relevant runtime numbers get named owners, with identical expressions.

### S92: Read milestone targets and rank ladder from core

- **Size:** S. **Register:** TD-07. **Depends on:** S91, S46
- **Files:**
  - `modify src/game/runtime/createHawkerRuntime.ts`

Build the snapshot milestone tracks at 1106-1109 from MILESTONE_TRACKS and distinctOpenStallTypes. requiredRank reads UPGRADE_RANK_REQUIREMENTS (undefined for level 5, as today).

**Behaviour risk.** Snapshot target and requiredRank must be identical; the S14 snapshot catches drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** The HUD snapshot stops copying core's milestone targets and upgrade rank requirements.

### S93: Share menu-slot, mastery and expansion rules between runtime and UI

- **Size:** M. **Register:** TD-07. **Depends on:** S92
- **Files:**
  - `modify src/game/runtime/stallMenus.ts`
  - `modify src/game/runtime/nutrition.ts`
  - `modify src/game/runtime/world.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify tests/game/runtime/stall-menus.test.ts`

stallMenus.ts: compute_menu_slots(stall, upgradeLevel), used at createHawkerRuntime.ts:781-791 and 5549-5551 and HawkerSimulator.tsx:1861-1863.
nutrition.ts: compute_dish_mastery_rank(progression, dishId), used at the three sites.
world.ts: `export const MAP_EXPANSION = { addColumns: 4, addRows: 2, minimumLevel: 3 } as const` (camelCase properties mirror the expand-map command), used at createHawkerRuntime.ts:1311-1312, 5469 and 5476 and at HawkerSimulator.tsx:2129/2136/2138.
Add a unit test in tests/game/runtime/stall-menus.test.ts that compute_menu_slots equals the old formula for every stall and level.

**Behaviour risk.** Values must be identical; S14, S18 and S22 catch drift. world.ts must not pull Phaser into the eager chunk (S33 lint).

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build (Phaser stays in its own chunk) && npm run test:ssr`

**Why.** Menu slots, dish mastery rank and the map-expansion rule each have one owner used by the runtime and the HUD; copy strings are unchanged.

### S94: Replace repeated catalog layering with one helper

- **Size:** S. **Register:** TD-12. **Depends on:** S93
- **Files:**
  - `modify src/game/runtime/catalog.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Add layer_catalog(authored, activeDishVariants, stallMenus) to catalog.ts, keeping the composition order withStallMenus(withDishVariants(...)). Add a root closure apply_catalog_layers() that sets `catalog = layer_catalog(...)` and then `state = { ...state, catalog }`. Use apply_catalog_layers only at 872, 888, 967, 5431, 5570 and 5602. At 850 (`loaded = { ...loadedCore, catalog }`) and 5407 (`state = { ...imported, catalog }`), replace only the composition expression with layer_catalog(...) and keep the spreads. 817 calls layer_catalog directly.

**Behaviour risk.** Using the helper at 850 or 5407 would turn import into a no-op; the S14 case (6) catches it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** catalog and state.catalog are updated together in one place. The load and import sites keep their loadedCore and imported spreads.

## P5-22

### S95: Share save loading and fresh-session setup between startup, import and reset

- **Size:** M. **Register:** TD-12. **Depends on:** S94
- **Files:**
  - `modify src/game/runtime/saves.ts`
  - `modify src/game/runtime/world.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `create tests/game/runtime/saves.test.ts`

saves.ts: load_runtime_save(value, authored) returns { state, catalog, stallMenus, activeDishVariants, isRecovered }. It runs the exact startup sequence: decode, deserialize, assertRuntimeMap, reconcile, resolveStallMenus, resolvePersistedDishVariants, the incomplete-V2 check, and layering via the loaded core spread.
world.ts: create_fresh_session(authored).
Startup keeps its candidate loop, the index > 0 warning, the 'saved recipe choices' copy and synchronizeStallMenus(). importState keeps the 'imported recipe choices' copy and its post-steps. Do not align the objectSequence or accessSequence seeding.
Create tests/game/runtime/saves.test.ts covering load_runtime_save on the S14 fixtures.

**Behaviour risk.** Save path; messages and decode order must be byte-identical. The S14 warning cases and saves tests catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime tests/game/core/persistence`

**Why.** One load pipeline for startup and importState, and one fresh-session builder. Per-path messages and the existing asymmetries are kept, and no logging is added here.

### S96: Log discarded save-load errors

- **Size:** S. **Register:** TD-29. **Depends on:** S95
- **Files:**
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify tests/game/runtime/createHawkerRuntime.test.ts`
  - `modify tests/game/runtime/saves.test.ts`

In the per-candidate catch (formerly 862-864), add `console.warn("[runtime] discarded save candidate", index, error)`. In the outer catch (formerly 878), add `console.warn("[runtime] save recovered as new centre", error)`. Update createHawkerRuntime.test.ts cases (7) and (8) and saves.test.ts to declare expect_console_warning for these paths.

**Behaviour risk.** Logging only; the recorded-not-thrown warning collector keeps control flow unchanged in tests.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Each discarded save candidate and the final recovery error are logged with console.warn; the warnings and control flow players see are unchanged.

### S97: Extract the HUD snapshot projection as a pure function

- **Size:** M. **Register:** TD-38. **Depends on:** S96
- **Files:**
  - `create src/game/runtime/snapshot.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Create snapshot.ts with SnapshotInput { state, catalog, visuals, stallMenus, activeDishVariants, interaction: { buildTool, selectedBuildId, selectedObjectId, selectedCustomerId, selectedAccessPointId, speed }, fps, simulationMs } and build_runtime_snapshot(input): RuntimeSnapshot, with the body from 1011-1318 verbatim. Move timeLabel (598-605) and isCentreOpen as isCentreOpen(state, catalog). emitHud assembles the input at each call, keeping `runtime.game?.loop.actualFps || 60`.

**Behaviour risk.** Stale reads if the input is cached; it is built per call.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`
- `git diff --color-moved=zebra`

**Why.** Verbatim move of currentSnapshot into build_runtime_snapshot(input); the input is assembled per call.

## P5-23

### S98: Split snapshot projection into focused helpers

- **Size:** M. **Register:** TD-38. **Depends on:** S97
- **Files:**
  - `modify src/game/runtime/snapshot.ts`
  - `modify src/game/runtime/nutrition.ts`
  - `create tests/game/runtime/snapshot.test.ts`

In snapshot.ts add:
- resolve_queue_direction (1084-1094)
- build_milestone_tracks
- estimate_hall_cleanliness (1213-1224), with named coefficients and JSDoc saying it is a HUD heuristic, not the rating input
- get_main_guest_route (1045-1058)
In nutrition.ts add build_nutrition_families (1116-1147), build_nutrition_pulse (1148-1187) and build_customer_nutrition (1253-1274).
Create tests/game/runtime/snapshot.test.ts with unit tests per helper: the cleanliness clamp at 25 and 100, the no-trays branch, and the milestone tier clamp.

**Behaviour risk.** Keep operator order for identical floats.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** Named helpers for queue direction, milestones, cleanliness estimate, guest route and nutrition projections, with expressions unchanged.

### S99: Move colour helpers and shared palettes into visuals/palette.ts

- **Size:** S. **Register:** TD-48. **Depends on:** S98
- **Files:**
  - `create src/game/runtime/visuals/palette.ts`
  - `modify src/game/runtime/visualRecipes.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Create visuals/palette.ts with colour, mixColour, lighten and darken (from createHawkerRuntime.ts:159-181), plus stableVisualHash, ACCENTS, SKIN_TONES and CLOTHING from visualRecipes.ts. visualRecipes.ts and the root import them.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** Pure move.

### S100: Replace duplicate hex parsers with the shared colour helper

- **Size:** S. **Register:** TD-48. **Depends on:** S99
- **Files:**
  - `modify src/game/runtime/visualRecipes.ts`

Confirm the three bodies are identical, then delete parseHexColour and parseVendorColour and call colour() from visuals/palette.ts.

**Behaviour risk.** None if the bodies are identical; the render digests prove it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** parseHexColour and parseVendorColour were character-for-character copies of colour().

### S101: Move placeable visual recipes into visuals/placeable.ts

- **Size:** S. **Register:** TD-48. **Depends on:** S100
- **Files:**
  - `create src/game/runtime/visuals/placeable.ts`
  - `modify src/game/runtime/visualRecipes.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `create tests/game/runtime/visuals/placeable.test.ts`
  - `modify tests/game/runtime/visual-recipes.test.ts`

Move visualRecipes.ts:9-202 into visuals/placeable.ts and the matching cases from visual-recipes.test.ts into tests/game/runtime/visuals/placeable.test.ts. Update the HawkerSimulator.tsx and root imports.

**Behaviour risk.** Import churn only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Pure move of visualRecipes.ts:9-202 and its tests.

### S102: Move dish visual recipes into visuals/dish.ts

- **Size:** S. **Register:** TD-48. **Depends on:** S101
- **Files:**
  - `create src/game/runtime/visuals/dish.ts`
  - `modify src/game/runtime/visualRecipes.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `create tests/game/runtime/visuals/dish.test.ts`
  - `modify tests/game/runtime/visual-recipes.test.ts`

As in S101, for the dish recipes, into visuals/dish.ts and tests/game/runtime/visuals/dish.test.ts. Keep the source-text block (visual-recipes.test.ts:233-262) in visual-recipes.test.ts until S110.

**Behaviour risk.** Import churn only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Pure move of visualRecipes.ts:204-511 and its tests.

## P5-24

### S103: Move customer visual recipes into visuals/customer.ts

- **Size:** S. **Register:** TD-48. **Depends on:** S102
- **Files:**
  - `create src/game/runtime/visuals/customer.ts`
  - `modify src/game/runtime/visualRecipes.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `create tests/game/runtime/visuals/customer.test.ts`
  - `modify tests/game/runtime/visual-recipes.test.ts`

As in S101, for the customer recipes, into visuals/customer.ts and tests/game/runtime/visuals/customer.test.ts.

**Behaviour risk.** Import churn only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Pure move of visualRecipes.ts:513-676 and its tests.

### S104: Move vendor visual recipes into visuals/vendor.ts and retire visualRecipes.ts

- **Size:** S. **Register:** TD-48. **Depends on:** S103
- **Files:**
  - `create src/game/runtime/visuals/vendor.ts`
  - `delete src/game/runtime/visualRecipes.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `move tests/game/runtime/visual-recipes.test.ts -> tests/game/runtime/visuals/vendor.test.ts`

Move visualRecipes.ts:678-1171 into visuals/vendor.ts and delete the now-empty visualRecipes.ts. Rename the remaining visual-recipes.test.ts to tests/game/runtime/visuals/vendor.test.ts, keeping the source-text block, which now reads createHawkerRuntime.ts, until S110. app/ must not import visuals/vendor (S33 lint).

**Behaviour risk.** Import churn; the initial chunk must not grow.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build (initial chunk not larger) && npm run test:ssr`

**Why.** Pure move of the remaining vendor recipes; app/ no longer loads vendor code in the eager chunk.

### S105: Extract object, furniture and fitting leaf renderers into render/objects.ts

- **Size:** M. **Register:** TD-39. **Depends on:** S104
- **Files:**
  - `create src/game/runtime/render/context.ts`
  - `create src/game/runtime/render/objects.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Create render/context.ts with LabelSink and ObjectVisualBounds, and module JSDoc. Create render/objects.ts with drawMakerMark, drawObjectShadow, drawSeatGraphic, drawFixtureGraphic, drawTrayWasteGraphic, drawFacilityGraphic, drawPlantGraphic, drawSignageGraphic, drawDividerGraphic and drawDecorGraphic. Use `import type Phaser` only, and replace the ReturnType<typeof ...> parameter types with exported types. Any label user takes `add_label: LabelSink`.

**Behaviour risk.** A hidden capture surfaces as a tsc error; the render digests prove the output.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** Verbatim move of argument-only draw functions with type-only Phaser imports.

### S106: Extract vendor leaf renderers into render/vendor.ts

- **Size:** S. **Register:** TD-39. **Depends on:** S105
- **Files:**
  - `create src/game/runtime/render/vendor.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move drawStallVendorHeadwear, drawStallVendorHair and drawStallVendorTool into render/vendor.ts, with type-only Phaser imports.

**Behaviour risk.** As in S105.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** Verbatim move.

### S107: Extract stall leaf renderers into render/stall.ts

- **Size:** S. **Register:** TD-39. **Depends on:** S106
- **Files:**
  - `create src/game/runtime/render/stall.ts`
  - `delete src/game/runtime/stallVisuals.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `move tests/game/runtime/stall-visuals.test.ts -> tests/game/runtime/render/stall.test.ts`

Move drawStallEmblem and stallServiceVisualState (typed with StallVendorActivity) into render/stall.ts, plus displayDishIdsForStall from stallVisuals.ts. Delete stallVisuals.ts. Move tests/game/runtime/stall-visuals.test.ts to tests/game/runtime/render/stall.test.ts. The label user takes add_label: LabelSink.

**Behaviour risk.** As in S105.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** Verbatim move, absorbing stallVisuals.ts.

## P5-25

### S108: Extract the nutrition variant cue renderer into render/variants.ts

- **Size:** M. **Register:** TD-39. **Depends on:** S107
- **Files:**
  - `create src/game/runtime/render/variants.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move drawNutritionVariantCue (4328-4710) into render/variants.ts, along with `export function includes_any(value, parts)`, whose body is copied from the `has` closure at 4338. Use it in that function; the dishes copy at 3964 switches in S115.

**Behaviour risk.** As in S105.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** Verbatim move; the two identical substring closures become one includes_any helper.

### S109: Extract customer leaf renderers into render/customers.ts

- **Size:** S. **Register:** TD-39. **Depends on:** S108
- **Files:**
  - `create src/game/runtime/render/customers.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move drawCustomerIndicator, drawCustomerAccessory, customerOutfitDimensions and drawCustomerGarmentPattern into render/customers.ts.

**Behaviour risk.** As in S105.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** Verbatim move.

### S110: Test nutrition variant families by draw output instead of source text

- **Size:** S. **Register:** TD-04, TD-39. **Depends on:** S109
- **Files:**
  - `create tests/game/runtime/render/variants.test.ts`
  - `modify tests/game/runtime/visuals/vendor.test.ts`

Create tests/game/runtime/render/variants.test.ts. For each of the 13 families and every reviewed visualKey, call drawNutritionVariantCue on create_recording_graphics() and assert that the log differs from the fallback branch's log and that sibling variants differ from each other. Delete the source-text block from tests/game/runtime/visuals/vendor.test.ts.

**Behaviour risk.** Test-only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `git grep -n "createHawkerRuntime.ts" tests returns nothing`

**Why.** Replaces the last runtime source-text grep with recorded draw-call assertions.

### S111: Build an explicit render context once per render

- **Size:** S. **Register:** TD-39. **Depends on:** S110
- **Files:**
  - `modify src/game/runtime/render/context.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

In render/context.ts define:
- RenderFrame { tick, qualityMode, isReducedMotion, isHighContrast }
- RenderContext { frame, snapshot, state, catalog, visuals, stallMenus, activeDishVariants, selectedObjectId, selectedCustomerId, isDebugOverlay, addLabel }
- OverlayContext, which adds { effectiveCatalog, buildTool, hoverTile, placementCandidate }
Use camelCase properties per S01. In the root render(), build the context from snapshot.tick for tick, the closure qualityMode (not snapshot.qualityMode), and the live state.objects for core queries. Pass it nowhere yet except as an unused-free local consumed by drawMap via an added parameter that is still ignored? No: simply construct it and pass it to the existing in-closure drawMap(ctx). drawMap reads ctx.frame and ctx.state in place of the closure reads, so the change compiles and is exercised.

**Behaviour risk.** Mixing state.tick and snapshot.tick, or the quality source; the render digests catch it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** Introduces RenderFrame, RenderContext and OverlayContext built in render() from the same sources the closures read today. No renderer moves yet.

## P5-26

### S112: Move map and overlay renderers onto the render context

- **Size:** M. **Register:** TD-39. **Depends on:** S111
- **Files:**
  - `create src/game/runtime/render/map.ts`
  - `create src/game/runtime/render/overlay.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move drawMap (1702-1815) into render/map.ts and drawOverlay (5098-5241) into render/overlay.ts. Each takes (graphics, ctx: RenderContext | OverlayContext). Replace each closure read with the matching context field, one to one; do not add or remove reads.

**Behaviour risk.** Capture swaps; the render digests (including hover scenarios) catch them.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** drawMap and drawOverlay leave the closure and read only their context.

### S113: Move stall and vendor renderers onto the render context

- **Size:** M. **Register:** TD-39. **Depends on:** S112
- **Files:**
  - `modify src/game/runtime/render/stall.ts`
  - `modify src/game/runtime/render/vendor.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move drawStallGraphic (2307-2788) into render/stall.ts and drawStallVendor into render/vendor.ts, taking ctx. Map the closure reads one to one.

**Behaviour risk.** As in S112.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** drawStallGraphic and drawStallVendor leave the closure.

### S114: Move object dispatch, table, lighting and fan renderers onto the render context

- **Size:** M. **Register:** TD-39. **Depends on:** S113
- **Files:**
  - `modify src/game/runtime/render/objects.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move drawObjects (with a Record<category, renderer> in the same mapping and iteration order), boundsForObject(object, catalog), and the table, lighting and fan renderers into render/objects.ts. Replace PhaserRuntime.Math.DegToRad(x) at 3408-3426 with `x * DEG_TO_RAD`, where DEG_TO_RAD = Math.PI / 180, matching Phaser's implementation form. Verify this against node_modules/phaser before changing; if the forms differ, pass the function in through the context instead.

**Behaviour risk.** Float identity of angles; the exact-precision digests catch it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** drawObjects uses a category-to-renderer table with today's mapping; DegToRad becomes a multiplication of the same form.

## P5-27

### S115: Move dish renderers onto the render context

- **Size:** M. **Register:** TD-39. **Depends on:** S114
- **Files:**
  - `create src/game/runtime/render/dishes.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move the dish renderers (3910-4326 and 4712-4815) into render/dishes.ts, taking ctx. Replace the `has` closure at 3964 with includes_any.

**Behaviour risk.** As in S112.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** The dish renderers leave the closure and share includes_any.

### S116: Move customer renderers onto the render context

- **Size:** M. **Register:** TD-39. **Depends on:** S115
- **Files:**
  - `modify src/game/runtime/render/customers.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Move drawCustomers (4817-5096) and nearestTableMealAnchor into render/customers.ts, taking ctx.

**Behaviour risk.** As in S112.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`
- `manual /?visualQa screenshot comparison in npm run dev`

**Why.** drawCustomers and nearestTableMealAnchor leave the closure.

### S117: Extract HawkerScene and game construction behind scene bindings

- **Size:** M. **Register:** TD-39. **Depends on:** S116
- **Files:**
  - `create src/game/runtime/render/scene.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`
  - `modify tests/game/runtime/fixtures.ts`

Create render/scene.ts:
- `create_scene_class(phaser: typeof Phaser, bindings: SceneBindings)` returns HawkerScene (scene key 'hawker-centre').
- `create_game(phaser, parent, settings, scene_class)` comes from 5288-5316.
- SceneBindings = { parent, getMap(), getHoverTile(), setHoverTile, handleTile, handleKey, advanceFrame(frameDeltaMs, now), getRenderContext(), emitHud, onCreated }.
The update() body (1622-1665) becomes the root advance_frame with statement order unchanged. The 'selected guest finished their visit' onEvent stays between reconcile and synchronizeStallMenus, inside the measured span. The key switch (1572-1589) becomes the root handle_key. dragged, dragOrigin, cameraOrigin, lastFrameAt and lastRenderTick become private scene fields. The camera and FPS constants live here. Update the fixtures' stub only if a constructor signature changed.

**Behaviour risk.** update() order feeds arrivalPerformancePressure; S14 case (5), S15 and the S16 event order catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`
- `manual npm run dev: arrows, Enter, R, Escape, U, Space, +/-, wheel zoom, drag-pan`

**Why.** The scene receives the dynamically imported Phaser namespace, owns its drag and frame fields, and delegates stepping and keys to the root. update() statement order and performance.now call positions are unchanged.

## P5-28

### S118: Extract hit-testing and id-sequence helpers into interaction.ts

- **Size:** M. **Register:** TD-54. **Depends on:** S117
- **Files:**
  - `create src/game/runtime/interaction.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Create interaction.ts with renderedCustomerPosition and customerAtRenderedGridPoint (193-226), objectAt, customerAt, placementCandidate, nextObjectId and recomputeObjectSequence (1327-1371). Each takes explicit arguments (state, catalog, sequences) in place of closure reads, and the root passes the live values at each call.

**Behaviour risk.** Stale reads; S16 must stay identical, including the documented bugs.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** Pure functions that the tile handler uses move out first.

### S119: Move tile handling and tool setters behind an explicit interaction state

- **Size:** M. **Register:** TD-54. **Depends on:** S118
- **Files:**
  - `modify src/game/runtime/interaction.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Define InteractionState { buildTool, selectedBuildId, selectedObjectId, selectedCustomerId, pendingMoveId, queueEditingStallId, queueDraft, selectedAccessPointId, pendingAccessKind, selectedRotation, hoverTile, speed, speedBeforeLayoutEdit, accessSequence, objectSequence } and create_interaction_state(state). Move handleTile (1373-1495) and setBuildTool, rotateSelection and setSpeed (5243-5279). Each takes ctx = { getSessionState(), getCatalog(), interaction, runCommand, refresh, emitEvent }. Always read state through ctx at use time and never destructure it. Keep the initial sequence seeding and the reset behaviour exactly as they are.

**Behaviour risk.** Stale reads; S16 must stay identical.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`
- `manual smoke of every BuildTool in npm run dev`

**Why.** Selection, pending move, queue draft and access-point state become an InteractionState read through a context at use time.

### S120: Extract the runtime session holder and domain stepping

- **Size:** M. **Register:** TD-54. **Depends on:** S119
- **Files:**
  - `create src/game/runtime/session.ts`
  - `modify src/game/runtime/createHawkerRuntime.ts`

Define RuntimeSession { authoredCatalog, visuals, catalog, state, stallMenus, activeDishVariants, lastPersistentRevenue, lastPeriodicSaveAt, lastSimulationMs }. Move into session.ts: synchronize_stall_menus(session) (960-973), apply_catalog_layers(session), build_persistent_payload(session) (921-927) and dispatch_session_command(session, command), which returns { accepted, events, hasMenusChanged } (`accepted` mirrors CommandResult). The domain stepping moves only if the guest-cleanup event and the performance.now reads can stay in their current positions. Otherwise advance_frame stays in the root, and this is recorded in the commit body. The root keeps runCommand (dispatch, then sync menus, then onEvent, then persist, then render, then emitHud), emitHud and the controller.

**Behaviour risk.** Side-effect order affects toast order and save timing; the S14 and S16 event sequences catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime`

**Why.** The root becomes a thin composition layer; runCommand keeps its exact side-effect order and advance_frame keeps its performance.now positions.

## P5-29

### S121: Select stall and placeable art through ID-keyed tables

- **Size:** M. **Register:** TD-47. **Depends on:** S120
- **Files:**
  - `create src/game/runtime/render/art.ts`
  - `modify src/game/runtime/render/stall.ts`
  - `modify src/game/runtime/render/objects.ts`
  - `create tests/game/runtime/render/art.test.ts`

Create render/art.ts. With a scratch script, run every STALLS and PLACEABLES id through today's substring chains and record which branch it reaches. Commit the result as STALL_ART_BY_ID and PLACEABLE_STYLE_BY_ID, with literal values and the same branch keys the renderers switch on. The renderers look up the table first and fall back to the existing substring logic for unknown IDs. tests/game/runtime/render/art.test.ts asserts that every content ID has an explicit entry and that the gallery render digest is unchanged. New art for the two generic stalls is out of scope.

**Behaviour risk.** A wrong table entry changes art; the gallery digest covers every ID.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/runtime/createHawkerRuntime.render.test.ts`

**Why.** Each current content ID now maps explicitly to the art branch it reaches today; unknown IDs keep the substring fallback. A completeness test forces an explicit art decision when content is added.

---

# Phase 6: UI decomposition

Move persistence and PWA logic out of HawkerSimulator.tsx, then extract hooks, focus, display helpers, panels, hud and dialogs.

## P6-30

### S122: Centralise preference keys, settings defaults and normalisation

- **Size:** S. **Register:** TD-25. **Depends on:** S22, S120
- **Files:**
  - `create src/game/persistence/preferences.ts`
  - `modify src/game/persistence/saveStore.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify src/game/audio/AudioDirector.ts`
  - `create tests/game/persistence/preferences.test.ts`

Create src/game/persistence/preferences.ts exporting:
- PREFERENCE_KEYS { SETTINGS: "settings", TUTORIAL_COMPLETE: "tutorial-complete", NUTRITION_TOUR_COMPLETE: "nutrition-tour-v1-complete", NUTRITION_LENS_ENABLED: "nutrition-lens-enabled" } as const, and PreferenceKey
- DEFAULT_SETTINGS and normalizeSettings, moved from HawkerSimulator.tsx:142-179 with the literal fallbacks kept
- TEXT_SCALE_MIN, TEXT_SCALE_MAX, TEXT_SCALE_STEP and DEFAULT_MIX
- get_voice_limit_for_quality
Use them at the 12 literal sites and the slider. The AudioDirector field initialisers read DEFAULT_MIX and the voice limit. Narrow the savePreference and loadPreference key type. Create tests/game/persistence/preferences.test.ts pinning the key strings and covering normalisation edge cases (including ambience falling back to music).

**Behaviour risk.** A key typo would orphan preferences; the test pins the strings.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/persistence tests/app/game`

**Why.** The four persisted keys become typed constants; normalizeSettings moves unchanged and its legacy fallback is documented.

### S123: Extract the debounced serialised autosave queue

- **Size:** M. **Register:** TD-25. **Depends on:** S122
- **Files:**
  - `create src/game/persistence/autosave.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `create tests/game/persistence/autosave.test.ts`

Export create_autosave({ write, onStatus, onError, delayMs = 200, setTimer, clearTimer }), returning { schedule, flush, save, cancel, settle }. Reproduce HawkerSimulator.tsx:646-649, 723-759 and 829-836 exactly: 'saving' on schedule and on write start; the status is set only for the latest sequence; a previous failure does not block the next write; save() rethrows after onError; flush() swallows, as it does today. Wire it from the component through refs and replace the triple clearTimeout pattern with cancel(). Create tests/game/persistence/autosave.test.ts with fake timers.

**Behaviour risk.** Ordering and timer semantics; the S22 debounce and pagehide cases must pass.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/game/persistence tests/app/game`

**Why.** The save queue semantics are now testable in Node; the component keeps its announcements and copy. No logging is added here.

### S124: Log autosave failures with their cause

- **Size:** S. **Register:** TD-29. **Depends on:** S123
- **Files:**
  - `modify src/game/persistence/autosave.ts`
  - `modify tests/game/persistence/autosave.test.ts`
  - `modify tests/app/game/HawkerSimulator.test.ts`

In the write catch, add `console.warn("[autosave] write failed", error)`. Where save() rethrows, wrap the error as `new Error("Autosave failed", { cause: error })` only if no caller inspects the message; otherwise rethrow the original. Update autosave.test.ts and the S22 failed-save case to use expect_console_warning.

**Behaviour risk.** Logging only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Failed writes now log and rethrow with { cause }; the status, copy and control flow players see are unchanged.

### S125: Own the service-worker update protocol in the PWA module

- **Size:** S. **Register:** TD-44. **Depends on:** S124, S68 (descoped)
- **Files:**
  - `modify src/game/pwa/registerPwa.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `create tests/game/pwa/registerPwa.test.ts`
  - `modify tests/game/pwa/sw.test.ts`

Export SW_MESSAGE { WARM_CACHE, ACTIVATE_UPDATE }, is_warm_cache_reply(value), WARM_CACHE_TIMEOUT_MS = 20_000 and activate_waiting_update(reload = () => location.reload()), with the body from HawkerSimulator.tsx:1116-1126. The component keeps `if (!(await saveNow())) return;`. Create tests/game/pwa/registerPwa.test.ts (vi.stubGlobal), and add to tests/game/pwa/sw.test.ts a check that sw_template.js handles each SW_MESSAGE value.

Override: src/game/pwa/sw_template.js and tests/game/pwa/sw.test.ts do not exist (descoped). Do not create them. Instead, in tests/game/pwa/registerPwa.test.ts, assert that public/sw.js (read as text) handles each SW_MESSAGE value. Do not modify public/sw.js.

**Behaviour risk.** Same calls in the same order.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build && npm run test:ssr`

**Why.** Message names and update activation move out of the component; the save-first gate stays in the UI.

### S126: Move export file naming into the save store

- **Size:** S. **Register:** TD-25. **Depends on:** S125
- **Files:**
  - `modify src/game/persistence/saveStore.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify tests/game/persistence/saveStore.test.ts`

Add build_save_file_name(day) to saveStore.ts, with the template copied from the component, and use it in the export handler. Add a case to saveStore.test.ts pinning the string.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** The exported file name format has one owner.

## P6-31

### S127: Extract runtime lifecycle, announcer and autosave hooks

- **Size:** M. **Register:** TD-08, TD-25. **Depends on:** S126, S23
- **Files:**
  - `create app/game/hooks.ts`
  - `modify src/game/persistence/preferences.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify tests/game/persistence/preferences.test.ts`
  - `modify tests/app/game/HawkerSimulator.test.ts`

Create app/game/hooks.ts with:
- useAnnouncer (695-721; announce stays stable)
- useAutosave (wraps create_autosave)
- useHawkerRuntime({ hostRef, onSnapshot, onEvent, onPersistentChange }): the 761-878 effect with an empty dependency list, callbacks read through refs, and the disposed flag kept
- report_failure(context, error) and persist_preference(key, value, failureMessage), not yet used at the catch sites
In preferences.ts add load_player_preferences(load). It issues loadPreference(SETTINGS) synchronously as its first statement, with no await before it, then the remaining reads sequentially, and returns { values, error }, keeping every value read before a rejection. useHawkerRuntime calls it as the first statement of the effect body. The component calls useHawkerRuntime before the settings effect, with a comment explaining why.
Tests: in tests/game/persistence/preferences.test.ts, run load_player_preferences against the real saveStore on fake-indexeddb, with a case where the second read rejects and the saved settings are still returned. In HawkerSimulator.test.ts, add a case where saved settings survive a remount.

**Behaviour risk.** Effect order. Settings must not be overwritten, and StrictMode must still produce one game.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build && npm start: set 135% text and 0% music, reload twice, settings persist (dev mode resets them on baseline too because StrictMode double-invokes effects; that is known current behaviour, do not gate the write)`
- `npm run build:vercel && npm run start:vercel: same check`

**Why.** The startup effect becomes useHawkerRuntime with latest-value callback refs. Hook order, the synchronous first preference read, the partial-failure semantics and the ungated boot-time settings write are unchanged.

### S128: Report swallowed UI failures through report_failure

- **Size:** S. **Register:** TD-29. **Depends on:** S127
- **Files:**
  - `modify app/game/HawkerSimulator.tsx`
  - `modify app/game/hooks.ts`
  - `modify tests/app/game/HawkerSimulator.test.ts`

Call report_failure(context, error) inside the existing catch blocks at (06ac46f lines, located by content after the moves) HawkerSimulator.tsx:789, 796, 1012, 1109, 1165 and 1166, and route the six preference writes through persist_preference. Autosave sites are already covered by S124. Update the affected S22 cases (invalid import, preference failure) to use expect_console_warning.

**Behaviour risk.** Logging only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Every UI catch that discarded an error now logs it; announcements, copy and control flow are unchanged.

### S129: Use the runtime nutrition projection and labels in the UI

- **Size:** S. **Register:** TD-35. **Depends on:** S128
- **Files:**
  - `modify app/game/HawkerSimulator.tsx`
  - `modify app/game/NutritionEducation.tsx`
  - `modify src/game/runtime/nutrition.ts`
  - `modify tests/game/runtime/runtime-nutrition.test.ts`

nutritionProfileView becomes `runtimeNutritionProfile(coreNutritionProfile(getNutritionProfile(dishId, variantId)))`. NutritionEducation.tsx imports HEALTH_CONDITION_LABELS from src/game/runtime/nutrition.ts. INTENT_LABELS stays as UI copy. runtime/nutrition.ts must not import phaser or createHawkerRuntime (S33 lint). Add a unit test that every metric in the content profile appears in the runtime summary.

**Behaviour risk.** Render-identical; S18 and S22 catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build (Phaser stays in its own chunk) && npm run test:ssr`

**Why.** Removes the UI's copies of the nutrition flattener and condition labels.

### S130: Move pure view helpers out of HawkerSimulator

- **Size:** M. **Register:** TD-19. **Depends on:** S129
- **Files:**
  - `create app/game/display.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `create tests/app/game/display.test.ts`

Create app/game/display.ts and move into it money, unlockLabel, utilityEffects, primaryUtility, catalogueIcon, getContentPrice, placeablePreview, dishPreview, dishLabel, dishStarRating, personaLabel, nutritionProfileView, PANEL_COPY (185-192, 221-223, 386-607) and the buildCategories constant. Hoist SGD_FORMATTER (same options), which is output-identical. Create tests/app/game/display.test.ts.

**Behaviour risk.** Output-identical; the S18 golden proves it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/app/game`

**Why.** Pure move of formatting and catalogue-preview helpers, plus hoisting the currency formatter with the same options.

## P6-32

### S131: Share UI requirement, progress and label helpers

- **Size:** S. **Register:** TD-19, TD-07. **Depends on:** S130
- **Files:**
  - `modify app/game/display.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify tests/app/game/display.test.ts`

In display.ts add:
- is_requirement_met(requirement, snapshot), from HawkerSimulator.tsx:1274-1281, used there and at 1872-1877 and 2098-2103
- format_progress_percent, format_hex_colour and humanize_id (keep replace vs replaceAll per call site by passing a flag only if both forms exist)
- KIND_GLYPHS split per surface (toast vs activity)
Derive INITIAL_SNAPSHOT cash and reputation from ECONOMY. Assert in display.test.ts that the derived values equal the literals they replace.

**Behaviour risk.** Output-identical; S18 and S22 catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** The unlock-requirement predicate repeated three times, the progress, hex and id-label formatting, and the initial cash and reputation now each have one definition.

### S132: Consolidate focus traps and the modal stack

- **Size:** M. **Register:** TD-37. **Depends on:** S131
- **Files:**
  - `create app/game/focus.ts`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify app/game/NutritionEducation.tsx`
  - `create tests/app/game/focus.test.ts`
  - `modify tests/app/game/HawkerSimulator.test.ts`

Create app/game/focus.ts exporting:
- MODAL_FOCUSABLE_SELECTOR, SHEET_FOCUSABLE_SELECTOR and VARIANT_LAB_FOCUSABLE_SELECTOR (exact current strings)
- dialogFocusAction, moved from NutritionEducation.tsx:166-181 and re-exported there
- useFocusTrap(ref, { selector, initialFocus, onEscape, shouldRestoreFocus, shouldTreatOutsideAsEdge, deps }). The caller passes today's dependency array, e.g. [helpOpen, nutritionTourStep, reportStorageIssue, resetOpen, settingsOpen, tutorialStep] at 985. Cleanup queues the restore rAF before the new run queues the initial-focus rAF, and the `[autofocus]` query is kept.
- resolve_active_modal(...) and is_interface_inert(...), in today's priority order (the Variant Lab is inert-only)
- TUTORIAL_DONE_STEP = TUTORIAL_COPY.length and NUTRITION_TOUR_DONE_STEP = 2
Create tests/app/game/focus.test.ts (a table test), and add a tutorial-step re-focus case to HawkerSimulator.test.ts. Record the manual keyboard matrix before and after.

**Behaviour risk.** A changed selector or dependency set changes Tab wrap or re-focus timing.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `manual keyboard matrix (tutorial first load and replay, tour, settings+reset, help, Variant Lab, mobile sheet)`

**Why.** One focus-trap hook driven by the exact current selectors, dependency set and rAF ordering, with modal priority encoded once.

### S133: Extract build, stalls and selection panels

- **Size:** M. **Register:** TD-19. **Depends on:** S132
- **Files:**
  - `create app/game/panels/catalogue.tsx`
  - `modify app/game/HawkerSimulator.tsx`
  - `create tests/app/game/panels.test.ts`

Move BuildPanel (1683-1743), StallsPanel (1745-1830) and SelectionCard (2198-2235) into app/game/panels/catalogue.tsx. Props are the snapshot fields read, controllerRef, and callbacks such as onSelectBuildItem. Create tests/app/game/panels.test.ts with renderToStaticMarkup tests of each panel using the fixture snapshot.

**Behaviour risk.** Stale closures in handlers; the S22 panel tour catches them.

**Verification.**
- `npm run typecheck && npm run lint && npm test (S18 and S22 snapshots unchanged)`
- `npm run build && npm run test:ssr`

**Why.** Presentational components with narrow props; classes, ids, aria and copy are verbatim.

## P6-33

### S134: Extract the dish menu panel and its row model

- **Size:** M. **Register:** TD-19. **Depends on:** S133
- **Files:**
  - `create app/game/panels/menu.tsx`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify tests/app/game/panels.test.ts`

Move the dishes panel (1832-1989) into MenuPanel in app/game/panels/menu.tsx, and the 1859-1899 computation into build_menu_rows(stall, snapshot, nutritionFamilies). Keep the 'dish-menu-reason-' and 'dish-menu-title-' id prefixes. Add rendered assertions on the aria-labelledby ids.

**Behaviour risk.** Generated ids must be unchanged.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Moves the menu JSX and the per-dish view model into a pure build_menu_rows function.

### S135: Extract focus, insights and activity panels with a shared objective card

- **Size:** M. **Register:** TD-19. **Depends on:** S134
- **Files:**
  - `create app/game/panels/overview.tsx`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify tests/app/game/panels.test.ts`

Move into app/game/panels/overview.tsx: ObjectiveCard (from 1371-1388 and 1645-1664; if the two differ today, add a `variant` prop so both render exactly as before, asserted in panels.test.ts), FocusPanel, InsightsPanel with the persona roster (1991-2141) and ActivityPanel (2143-2183).

**Behaviour risk.** Card divergence; the variant prop and the test preserve it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** The duplicated objective card becomes one component used by the left rail and the Focus panel, rendering exactly as each did before.

### S136: Extract top bar, toolbar, action strip, dock, toasts and debug panel

- **Size:** M. **Register:** TD-19. **Depends on:** S135
- **Files:**
  - `create app/game/hud.tsx`
  - `modify app/game/HawkerSimulator.tsx`
  - `create tests/app/game/hud.test.ts`

Move into app/game/hud.tsx: TopBar (1291-1367); WorldToolbar (1407-1484) with get_toolbar_mode_label and get_toolbar_message; ActionStrip (1547-1604); BottomDock with DOCK_ITEMS (2239-2272); ToastStack (2279-2293); DebugPanel (2496-2508). Keep each inert/aria-hidden pair. Create tests/app/game/hud.test.ts with unit tests of the toolbar functions for all 7 BuildTool values.

**Behaviour risk.** Strings must match exactly; S18 catches drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Replaces the five-level toolbar ternaries with lookup functions that return identical strings.

## P6-34

### S137: Extract tutorial, tour, settings, help and reset dialogs

- **Size:** M. **Register:** TD-19. **Depends on:** S136
- **Files:**
  - `create app/game/dialogs.tsx`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify app/game/focus.ts`
  - `create tests/app/game/dialogs.test.ts`

Move into app/game/dialogs.tsx: CustomerIndicatorIcon, CustomerStatusLegend and CustomerStatusGuide (225-384), TUTORIAL_COPY (609-640) and the dialogs (2295-2494). Add SettingSwitch and SettingSlider calling update_setting(key, value). Pass dialog refs as React 19 ref props, keep autoFocus on the primary buttons, and keep `inert={resetOpen}`. Create tests/app/game/dialogs.test.ts with render tests for SettingsDialog, HelpDialog and ResetDialog.

**Behaviour risk.** Focus targets must still be the same sections.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build && npm run test:ssr`
- `manual keyboard pass per docs/ACCESSIBILITY.md`

**Why.** Dialogs move with TUTORIAL_COPY and the status legend; settings switches share one update_setting.

---

# Phase 7: Content, tools and CI

A single roster source, inferred content types, localisation helpers, a testable importer and deploy tools, worker cleanup and CI hardening.

## P7-35

### S138: Centralise launch roster counts

- **Size:** M. **Register:** TD-14. **Depends on:** S20, S21
- **Files:**
  - `create src/content/roster.ts`
  - `modify src/content/schemas.ts`
  - `modify src/content/validate.ts`
  - `modify src/content/placeables.ts`
  - `modify src/content/index.ts`
  - `modify tests/content/content.test.ts`
  - `modify tests/content/nutrition-content.test.ts`

Create src/content/roster.ts with LAUNCH_ROSTER {stalls 14, dishes 54, placeables 80, customerArchetypes 12, nutritionSourceSnapshots 2, nutritionVariantFamilies 14, nutritionIntents 5, nutritionGuidelines 11}, and move PLACEABLE_CATEGORY_MINIMUMS there from placeables.ts:1337-1349 (index.ts still exports the name). Change the schemas.ts:435-439 .length(n) calls to .min(1). validateContent checks the roster: placeables stay '>=' per D10, and the profile total is derived as dishes + sum(variants - 1). Tests read LAUNCH_ROSTER, and one test pins the literals.

**Behaviour risk.** Only diagnostics for invalid content change.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run validate:content`
- `CI=true npx vitest run tests/content tests/tools (goldens unchanged)`

**Why.** Counts move out of import-time schemas into one roster checked by validateContent. Valid content gives an identical report.

### S139: Read the guideline count from the manifest

- **Size:** S. **Register:** TD-14. **Depends on:** S138
- **Files:**
  - `modify tools/nutrition/manifest.mjs`
  - `modify tools/nutrition/importer.mjs`

Export NUTRITION_GUIDELINE_COUNT from tools/nutrition/manifest.mjs and use it at importer.mjs:568.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** The importer's hard-coded guideline count becomes a manifest export.

### S141: Remove unreachable and duplicate content checks

- **Size:** S. **Register:** TD-14, TD-10. **Depends on:** S140 (descoped)
- **Files:**
  - `modify src/content/validate.ts`
  - `modify tests/content/validate.test.ts`

Gated by D9. Delete validate.ts:211-214, 273-276 and 340-349, and one check of each duplicate pair (265-268 vs 296, 269-272 vs 282-289). Update only the validate.test.ts rows that asserted a duplicated issue.

Override: dead-code deletion is approved by the user.

**Behaviour risk.** A live check could be dropped; the rule tests catch it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run validate:content`

**Why.** These checks can never fire or repeat a later check; the issue list for every reachable case is unchanged.

### S142: Move content validation rules into rule groups

- **Size:** M. **Register:** TD-14. **Depends on:** S141
- **Files:**
  - `create src/content/rules.ts`
  - `modify src/content/validate.ts`

Move the rule bodies verbatim from validate.ts:69-677 into src/content/rules.ts as check_identity_and_copy, check_stalls, check_dishes, check_nutrition, check_placeables, check_progression, check_economy and check_customers(content, check). validateContent calls them in today's order.

**Behaviour risk.** Issue order; the S20 tests catch drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `git diff -M --color-moved=zebra`

**Why.** Verbatim move; validateContent orchestrates the groups in the same order.

## P7-36

### S143: Name content validation thresholds and reference lists

- **Size:** S. **Register:** TD-14, TD-24. **Depends on:** S142
- **Files:**
  - `modify src/content/rules.ts`
  - `modify src/content/roster.ts`
  - `modify src/content/nutrition.ts`

Add MIN_NAME_LENGTH, MIN_DESCRIPTION_LENGTH, MIN_DISHES_PER_STALL and similar to rules.ts. Move VARIANT_UNLOCK_RANKS and NOT_COMPARABLE_GUIDELINE_IDS into roster.ts. Add is_primary_profile to nutrition.ts. Messages are unchanged.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Minimum lengths and counts become named constants; reference lists move into the roster.

### S144: Give the shared-message validator check its own message

- **Size:** S. **Register:** TD-14. **Depends on:** S143
- **Files:**
  - `modify src/content/rules.ts`
  - `modify tests/content/validate.test.ts`

Replace the reused message with a specific one and update the corresponding validate.test.ts row.

**Behaviour risk.** Developer-facing text only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** The check at the former validate.ts:557 reused another rule's message; content authors now see which rule failed. Diagnostics only.

### S145: Assert content types equal their Zod schema outputs

- **Size:** S. **Register:** TD-41. **Depends on:** S144
- **Files:**
  - `create tests/content/types.test.ts`

For each of the 11 schema and interface pairs, assert `expectTypeOf<ReadonlyDeep<z.output<typeof xSchema>>>().toEqualTypeOf<XDefinition>()`, using a local ReadonlyDeep helper.

**Behaviour risk.** None.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** A type-level safety net before the hand-written interfaces are replaced.

### S146: Derive content types from Zod schemas

- **Size:** M. **Register:** TD-41, TD-22. **Depends on:** S145
- **Files:**
  - `modify src/content/types.ts`
  - `modify src/content/schemas.ts`
  - `modify src/content/nutrition.ts`
  - `modify tests/content/types.test.ts`

In schemas.ts, extract the inline enums into named schemas. Add `export type ReadonlyDeep<T>` to types.ts, moved from the test, and replace each interface with `export type X = ReadonlyDeep<z.output<typeof xSchema>>`. Keep LocalizedSeed, ContentId and every name. Move the field comments onto the schema keys. Do not change the order of the nutrients keys. Remove the `as NutritionContent` cast at nutrition.ts:14.

**Behaviour risk.** Type-only; the satisfies clauses re-check every literal.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/content (golden unchanged)`

**Why.** Every exported content type name is kept, about 300 lines of parallel interfaces are removed, and the now-redundant NutritionContent cast goes.

### S147: Share localisation key and entry helpers

- **Size:** S. **Register:** TD-45, TD-35. **Depends on:** S146, S131
- **Files:**
  - `modify src/content/localization.ts`
  - `modify src/content/stalls.ts`
  - `modify src/content/dishes.ts`
  - `modify src/content/placeables.ts`
  - `modify src/content/customers.ts`
  - `modify src/content/index.ts`
  - `modify src/game/runtime/catalog.ts`
  - `modify app/game/display.ts`

In localization.ts add build_localization_keys(id), build_english_entries(seeds) and localize_key(key), the last with the '?? key' fallback. Build ENGLISH_LOCALIZATION with a merge that throws on duplicates, in the order stalls, dishes, placeables, customers. Each data file spreads build_localization_keys at the same key position as before: last for stalls, dishes and customers, and after id for placeables. The runtime localized and the UI localize become aliases of localize_key.

**Behaviour risk.** Key strings and order; the S20 golden catches drift.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/content`

**Why.** One key derivation, a collision-checked merge, and no void workarounds; key strings and order are unchanged.

## P7-37

### S148: Name content balancing constants

- **Size:** S. **Register:** TD-24. **Depends on:** S147
- **Files:**
  - `modify src/content/dishes.ts`
  - `modify src/content/placeables.ts`
  - `modify src/content/stalls.ts`

dishes.ts: STAR_QUALITY_WEIGHT 0.65, STAR_DEMAND_WEIGHT 0.35, SERVING_MS_PER_PREP_SECOND 70, MIN_SERVING_MS 1_200. placeables.ts: RESALE_RATIO 0.6, DEFAULT_ROTATIONS. stalls.ts: the upgrade service multipliers and cost factors. Expression shapes are identical.

**Behaviour risk.** Rounding; the S20 golden catches it.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `CI=true npx vitest run tests/content tests/game`

**Why.** Star-rating weights, serving time, resale ratio, rotations and the upgrade ladder become documented constants.

### S150: Split and type-check the nutrition importer

- **Size:** M. **Register:** TD-16, TD-30. **Depends on:** S139
- **Files:**
  - `create tools/nutrition/csv.mjs`
  - `create tools/nutrition/ratings.mjs`
  - `modify tools/nutrition/importer.mjs`
  - `modify tools/nutrition/manifest.mjs`
  - `modify tsconfig.json`

Create csv.mjs (parseCsv, canonicalRowHash) and ratings.mjs (HEALTH_RATING_SCHEMES, computeRelativeFits, nutritionValueForComparison, addIntentFits, addHealthRatings). importer.mjs re-exports them. Add `// @ts-check` and JSDoc typedefs importing src/content/types to the three files and manifest.mjs. Add these four files to the tsconfig include; do not enable checkJs globally. Fix the reported types. Name the quarantine thresholds.

**Behaviour risk.** Output bytes are sha-pinned by S21.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** CSV parsing and the rating algorithm get their own modules. The output bytes are unchanged.

---

# Phase 8: Documentation

Make the docs match the code, record the decisions, expand the contributor guide, and empty the JSDoc allowlist.

## P8-38

### S158: Correct dependency audit claims in release evidence

- **Size:** S. **Register:** TD-31. **Depends on:** S157 (descoped)
- **Files:**
  - `modify docs/RELEASE_CHECKLIST.md`
  - `modify docs/KNOWN_ISSUES.md`
  - `modify docs/PROJECT_STATUS.md`
  - `modify docs/TEST_REPORT.md`
  - `modify docs/ASSET_PROVENANCE.md`
  - `modify CHANGELOG.md`

Untick RELEASE_CHECKLIST.md:83 and :96 unless the audit now passes under the S31 policy. In CHANGELOG.md:42, KNOWN_ISSUES.md:11, PROJECT_STATUS.md:34, ASSET_PROVENANCE.md:22 and TEST_REPORT.md:43, keep the dated audit result only in TEST_REPORT.md (production audit and full audit separately) and link to it from the others.

Override: the CI audit-policy step was descoped, and `npm audit --audit-level=high` currently fails on main (2026-10-17: 1 critical, 23 high, 6 moderate). Untick checklist items that claim a clean audit, keep the dated audit result only in docs/TEST_REPORT.md (state the current failing result and date 2026-10-17), and link to it from the other docs.

**Behaviour risk.** Docs only.

**Verification.**
- `grep -rn "0 vulnerabilities" docs CHANGELOG.md shows only dated, accurate entries`

**Why.** Replaces stale '0 vulnerabilities' statements with the dated current result, kept in one place.

### S159: Document the real architecture

- **Size:** M. **Register:** TD-31. **Depends on:** S158
- **Files:**
  - `modify docs/TECHNICAL_DESIGN.md`

Rewrite the domain layout to match the target tree. Describe: the real save sequence (one transaction, active to backup); the debug and visualQa flags via src/config/env.ts; Tailwind as the CSS reset; client-side update gating; and the layering rules and their lint enforcement. Remove the error-boundary, staging-write, cache and staggering claims.

**Behaviour risk.** Docs only.

**Verification.**
- `every src/ and app/ path named in TECHNICAL_DESIGN.md exists (scripted grep)`

**Why.** The design doc now matches the code.

### S160: Document the save format and its invariants

- **Size:** S. **Register:** TD-31. **Depends on:** S159
- **Files:**
  - `create docs/SAVE_FORMAT.md`
  - `modify docs/adr/0003-local-first-persistence-and-offline.md`
  - `modify docs/RISK_REGISTER.md`

Create docs/SAVE_FORMAT.md covering:
- the version nesting: envelope saveVersion, then RUNTIME_SCHEMA_VERSION, then PERSISTENT_SCHEMA_VERSION
- a V1-V4 table (V1 to V2 keeps the validated level)
- a checklist for adding V5 and for adding a persisted field
- the invariants: player-visible PersistenceError messages, load-bearing tuple order, frozen stableStringify and the TD-06 caveat, the content alias tables, the explicit persisted metrics fields, preference key strings, and IndexedDB names
Add a dated amendment to ADR 0003 and reword the RISK_REGISTER R-03 mitigation.

**Behaviour risk.** Docs only.

**Verification.**
- `reviewer cross-check against src/game/core/persistence/ and saveStore.ts`

**Why.** The save-version nesting, the V1-V4 history and the load-bearing invariants are written down, with a checklist for adding V5.

### S161: Record hosting targets and their verification matrix

- **Size:** S. **Register:** TD-42, TD-31. **Depends on:** S160
- **Files:**
  - `create docs/adr/0005-hosting-targets.md`
  - `modify docs/DEPLOYMENT.md`
  - `modify docs/SECURITY_AND_PRIVACY.md`
  - `modify docs/DECISIONS.md`

Create ADR 0005 covering Vercel (native Next, primary per D11) and Cloudflare (Vinext): owner, verification (test:ssr and test:ssr:vercel goldens, smoke), retirement criteria, and the deferred header-parity gap. In DEPLOYMENT.md, add a target matrix, remove the personal path and npx.cmd, de-duplicate the CLI blocks, add a Cloudflare section stating what exists, and document the workflow_dispatch dry run. Record the 'unsafe-inline' exception and its removal task in SECURITY_AND_PRIVACY.md. Add a DECISIONS.md entry.

Override: the user has NOT chosen a primary hosting target, and test:ssr:vercel and the workflow_dispatch dry run were descoped. Do not create an ADR, do not declare a primary target, and do not add a DECISIONS.md entry. In docs/DEPLOYMENT.md add a target matrix describing both targets exactly as they exist today (Vinext/Cloudflare via npm run build + test:ssr; Vercel via npm run build:vercel and CI), remove personal paths and npx.cmd, and de-duplicate CLI blocks. In docs/SECURITY_AND_PRIVACY.md record the existing script/style unsafe-inline CSP exception as current state.

**Behaviour risk.** Docs only.

**Verification.**
- `grep -rn "C:\\Users" docs is empty`

**Why.** Documents which target is primary, what each build is verified by, and the Cloudflare gaps.

## P8-39

### S162: Give each volatile fact one owning document and record deferred debt

- **Size:** M. **Register:** TD-31. **Depends on:** S161
- **Files:**
  - `create docs/README.md`
  - `modify README.md`
  - `modify docs/PROJECT_STATUS.md`
  - `modify docs/KNOWN_ISSUES.md`
  - `modify docs/TEST_REPORT.md`
  - `modify docs/DECISIONS.md`
  - `modify docs/CONTENT_CATALOGUE.md`
  - `modify docs/GRAPHICS_VERIFICATION.md`
  - `modify docs/PERFORMANCE_REPORT.md`
  - `modify CHANGELOG.md`

Create docs/README.md as an index: counts are owned by CONTENT_CATALOGUE.md, evidence by TEST_REPORT.md and blockers by KNOWN_ISSUES.md. Replace copied counts elsewhere with links. Mark D-010 and D-016 superseded. Fix the CHANGELOG Unreleased section and the CONTENT_CATALOGUE.md:246 placeable wording per D10. Reconcile KNOWN_ISSUES with TEST_REPORT. Add to KNOWN_ISSUES: TD-06, TD-36 (including catch narrowing in commands.ts and validation.ts, and the sw.js cache.put override), TD-46, TD-47 new art for the generic stalls, TD-50 and TD-52. Update the test paths in TEST_REPORT, GRAPHICS_VERIFICATION and PERFORMANCE_REPORT to the mirrored tree.

Override: in addition to the listed items, record in docs/KNOWN_ISSUES.md (or the deferred-debt section) the debt deliberately descoped from this refactor: dependency security upgrades (next 16.4.2 critical, wrangler/@cloudflare/vite-plugin, eslint-config-next, vinext 1.x major), the CI audit gate policy, Node/npm version pinning, the service-worker stamp tool (platform-dependent hash: path separators and sort order feed the hash; build rewrites tracked public/sw.js; hard-coded 1.0.0 prefix; swallowed fs error) and generating sw.js from a template, the deployment smoke-tool refactor, the unused worker image-optimisation branch, CI secret scoping, Dependabot, and the behaviour bugs TD-06/TD-36/TD-46 (fix later with intentional golden re-baselines). Placeable roster stays `>= 80`: fix the CONTENT_CATALOGUE wording to match.

**Behaviour risk.** Docs only.

**Verification.**
- `no contradictory counts across docs (grep for 14/54/80/12/104)`
- `every tests/ path named in docs exists`

**Why.** Counts, test evidence and blockers each live in one place, and the deferred refactor items are recorded as known issues.

### S164: Add module and exported-API JSDoc where still missing

- **Size:** M. **Register:** TD-55. **Depends on:** S163 (descoped)
- **Files:**
  - `modify src/game/core/*.ts`
  - `modify tests/module-docs.test.ts`

Add module JSDoc and @param/@returns/@throws JSDoc to the exported symbols in core files still on the S40 allowlist (grid, queueing, utility, economy, progression, state, rng, commands dispatchCommand, pathfinding, satisfaction, validation, nutrition, types). Remove those files from UNDOCUMENTED_BASELINE. Comments only.

**Behaviour risk.** Comments only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Closes the docstring gap in core and shrinks the module-doc allowlist.

### S165: Add module and exported-API JSDoc where still missing

- **Size:** S. **Register:** TD-55. **Depends on:** S164
- **Files:**
  - `modify src/game/runtime/*.ts`
  - `modify tests/module-docs.test.ts`

Cover activityFeed, queueInsight, satisfactionInsight, stallMenus, contentUtility, types (RuntimeController method semantics and the pre-boot guarantees) and createHawkerRuntime. Shrink the allowlist.

**Behaviour risk.** Comments only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Closes the docstring gap in the runtime, including RuntimeController semantics.

### S166: Add module and exported-API JSDoc where still missing

- **Size:** S. **Register:** TD-55. **Depends on:** S165
- **Files:**
  - `modify src/game/persistence/saveStore.ts`
  - `modify src/game/pwa/registerPwa.ts`
  - `modify src/game/pwa/sw_template.js`
  - `modify src/game/audio/AudioDirector.ts`
  - `modify src/config/securityHeaders.ts`
  - `modify tests/module-docs.test.ts`

Cover saveStore, registerPwa, sw_template.js (a header comment documenting the message protocol; this changes the deployed sw.js bytes, so re-baseline the deploy goldens with UPDATE_GOLDEN=1 if they include /sw.js and note it), the public methods of AudioDirector, and securityHeaders.ts. Shrink the allowlist.

Override: src/game/pwa/sw_template.js does not exist (descoped); skip it and leave public/sw.js unchanged.

**Behaviour risk.** Comments only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build && npm run test:ssr`

**Why.** Covers the persistence, PWA, audio and config modules, and the worker template's message protocol header.

## P8-40

### S167: Add module and exported-API JSDoc where still missing

- **Size:** S. **Register:** TD-55. **Depends on:** S166
- **Files:**
  - `modify src/content/*.ts`
  - `modify tests/module-docs.test.ts`

Cover catalog.ts:10, localization.ts:6, nutrition.ts:31-56, placeables.ts:1337 and the remaining src/content/*.ts on the allowlist. Shrink the allowlist.

**Behaviour risk.** Comments only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Covers the content catalog, localisation, nutrition and placeable modules.

### S168: Add module and exported-API JSDoc where still missing

- **Size:** S. **Register:** TD-55. **Depends on:** S167
- **Files:**
  - `modify app/layout.tsx`
  - `modify app/page.tsx`
  - `modify app/game/HawkerSimulator.tsx`
  - `modify app/game/NutritionEducation.tsx`
  - `modify tests/module-docs.test.ts`

Cover layout.tsx, page.tsx, HawkerSimulator.tsx and the NutritionEducation exports. Shrink the allowlist.

**Behaviour risk.** Comments only; S18 golden unchanged.

**Verification.**
- `npm run typecheck && npm run lint && npm test`

**Why.** Covers the app shell, simulator and nutrition components.

### S169: Add module JSDoc to tools, worker and config and empty the allowlist

- **Size:** S. **Register:** TD-55. **Depends on:** S168
- **Files:**
  - `modify tools/**/*.mjs`
  - `modify worker/index.ts`
  - `modify next.config.ts`
  - `modify tests/module-docs.test.ts`

Cover the remaining tools/*.mjs, worker/index.ts (including withSecurityHeaders) and next.config.ts. Remove UNDOCUMENTED_BASELINE, so the test now requires docs everywhere.

**Behaviour risk.** Comments only.

**Verification.**
- `npm run typecheck && npm run lint && npm test`
- `npm run build && npm run test:ssr`

**Why.** The module-doc allowlist is now empty, so every module in the repo carries a doc block.

---

# Target layout

This is the layout after every planned step. Entries that belong to descoped work do not apply: `.gitattributes`, `.nvmrc`, `CONTRIBUTING.md`, `dependabot`, `vercel.yml` changes, `sw_template.js`, the generated `sw.js`, coverage, and the `vite.config.ts` Worker pins.

```text
.gitattributes            LF normalisation, binary images
.nvmrc                    Single Node version for CI and local (D8)
.env.example              Optional VERCEL_AUTOMATION_BYPASS_SECRET, PORT; documents the Node-side env exceptions
.gitignore                /data/ anchored; !.env.example; /public/sw.js generated
.prettierrc.json          (only if D6 approved) current style, used for newly authored files
CONTRIBUTING.md           Conventions (S01), then commands, layering, golden rules, add-a-stall/dish/panel/save-field checklists
.github/dependabot.yml    Grouped npm and actions updates
.github/workflows/vercel.yml  Same names and job ids; verify via npm run verify; prod-dependency audit gate; step-scoped secrets incl. validate steps
eslint.config.mjs         All ignores; core purity; render/visuals type-only Phaser; app/ import bans; import/order; --max-warnings=0
tsconfig.json             Extra zero-cost strict flags; per-file @ts-check tools listed in include
vite.config.ts            Pinned Worker name and compatibility_date
vitest.config.ts          setupFiles tests/setup.ts; snapshotFormat.compareKeys null; opt-in v8 coverage (D5)
next.config.ts            Unchanged shape; reads IS_DEVELOPMENT_BUILD from src/config/env.ts
app/
  layout.tsx, page.tsx, globals.css (unchanged; split deferred, TD-52)
  game/
    HawkerSimulator.tsx   Shell (~450 lines): UI state, composes hooks, panels, hud, dialogs
    NutritionEducation.tsx  Nutrition components (exports unchanged; re-exports dialogFocusAction)
    hooks.ts              useHawkerRuntime, useAnnouncer, useAutosave, report_failure, persist_preference
    focus.ts              Focus selectors, dialogFocusAction, useFocusTrap, resolve_active_modal, is_interface_inert
    display.ts            Pure view helpers (money, labels, previews, format_progress_percent, format_hex_colour, humanize_id, is_requirement_met)
    hud.tsx               TopBar, WorldToolbar, ActionStrip, BottomDock, ToastStack, DebugPanel
    dialogs.tsx           Tutorial, NutritionTour, Settings (+legend), Help, Reset dialogs
    panels/catalogue.tsx  BuildPanel, StallsPanel, SelectionCard
    panels/menu.tsx       MenuPanel + build_menu_rows
    panels/overview.tsx   ObjectiveCard, FocusPanel, InsightsPanel, ActivityPanel
src/config/
  securityHeaders.ts      Unchanged single header source
  env.ts                  IS_PRODUCTION_BUILD, IS_DEVELOPMENT_BUILD, has_dev_query_flag
src/content/
  index.ts                Same public names (+ lookup maps, migrations tables)
  catalog.ts              + DISH_BY_ID, STALL_BY_ID, PLACEABLE_BY_ID shared lookup maps
  schemas.ts              Single source of truth (named enum schemas, .min(1) instead of exact lengths)
  types.ts                ReadonlyDeep<z.output<...>> aliases with the same exported names
  roster.ts               LAUNCH_ROSTER, PLACEABLE_CATEGORY_MINIMUMS, VARIANT_UNLOCK_RANKS, NOT_COMPARABLE_GUIDELINE_IDS
  rules.ts                Validation rule groups
  validate.ts             ContentValidationError, validateContent orchestration
  localization.ts         ENGLISH_LOCALIZATION + build_localization_keys, build_english_entries, localize_key
  migrations.ts           Frozen empty CONTENT_ID_ALIASES, REMOVED_CONTENT_REFUNDS
  economy.ts, stalls.ts, dishes.ts, placeables.ts, customers.ts, nutrition.ts, nutrition.generated.json (byte-identical)
src/game/core/            Pure; lint-enforced; explicit barrel
  index.ts                Explicit named re-exports (today's public names)
  enums.ts                as-const vocabulary tuples in today's order + PERSISTENT_SCHEMA_VERSION (leaf, no imports)
  types.ts                Unions derived from enums.ts
  rng.ts (+compute_fnv1a32), ordering.ts (+compare_customer_ids), grid.ts (+is_boundary_point, compute_manhattan_distance, CARDINAL_OFFSETS), pathfinding.ts (A* only), navigation.ts (world-navigation validation)
  queueing.ts (+get_navigation_reserved_points), utility.ts, satisfaction.ts (+VISIT_RATING_WEIGHTS), economy.ts, progression.ts (+MILESTONE_TRACKS, UPGRADE_RANK_REQUIREMENTS, get_effective_catalog)
  nutrition.ts (+metric record builders, pick_from_roll, record_intent_request, record_nutrition_sale), validation.ts (rule groups), state.ts (+clone helpers, get_quality_settings, compute_undo_window_ticks)
  simulation.ts           stepSimulation, advanceSimulation
  draft.ts                Step-scoped Draft, lookups, queue/seat primitives, movement/pathing
  arrivals.ts             Spawn eligibility, spawnCustomer, compute_next_spawn_interval_ms
  choices.ts              Stall/dish/seat/tray choice
  visits.ts               Rating settlement, exit, completeSale
  lifecycle.ts            processCustomer + CUSTOMER_STATUS_HANDLERS
  diagnostics.ts          assertSimulationInvariants, simulationDigest, stateDigest
  commands.ts             Mapped-type router with hasOwn fallback, accept/reject/withUndo, non-build handlers
  build.ts, reconcile.ts, undo.ts  Build handlers, target reconciliation, undo restore
  persistence/{index,fields,parsers,migrations,recovery}.ts  Save schema API, primitives, record parsers, V1-V4 upgrade chain, content recovery
src/game/persistence/
  saveStore.ts            Unchanged IndexedDB adapter and envelope (+build_save_file_name, shared FNV)
  preferences.ts          PREFERENCE_KEYS, DEFAULT_SETTINGS, normalizeSettings, load_player_preferences
  autosave.ts             create_autosave debounced serialised queue
src/game/pwa/
  registerPwa.ts          + SW_MESSAGE, is_warm_cache_reply, activate_waiting_update
  sw_template.js          Tracked worker source (BUILD_ID placeholder)
src/game/audio/AudioDirector.ts  Preference defaults; logged lifecycle promises
src/game/runtime/
  createHawkerRuntime.ts  Composition root (~300 lines): dynamic Phaser import, session/interaction wiring, runCommand, emitHud, controller
  types.ts                Bridge types; RuntimePersistentState re-export; core type aliases
  catalog.ts              Content-to-core catalog projection, layer_catalog, REPUTATION_SCALE, projection constants
  world.ts                Map constants, starter layout, freshState, reconcileRuntimeUnlocks, create_fresh_session, MAP_EXPANSION
  saves.ts                RuntimePersistentState, RUNTIME_SCHEMA_VERSION, decodeRuntimeSave, resolvePersistedDishVariants, load_runtime_save
  nutrition.ts            Nutrition projections, labels, decision reasons, variant resolution, compute_dish_mastery_rank, snapshot nutrition builders
  snapshot.ts             build_runtime_snapshot + projection helpers
  session.ts              RuntimeSession + domain stepping
  interaction.ts          InteractionState + handleTile, tools, hit-testing
  stallMenus.ts (+compute_menu_slots), activityFeed.ts (+formatSimulationEvent), contentUtility.ts, queueInsight.ts, satisfactionInsight.ts
  visuals/{palette,placeable,dish,customer,vendor}.ts  Pure recipes (replace visualRecipes.ts)
  render/{context,art,scene,map,objects,stall,vendor,dishes,variants,customers,overlay}.ts  Phaser draw code; type-only Phaser imports; art.ts holds ID-keyed art tables
public/sw.js              GENERATED at build (URL unchanged)
tools/
  stamp-service-worker.mjs  Template to public/sw.js; POSIX hashing; post-stamp assertion; exported functions
  shell.mjs               Dependency-free shell/header-invariant/manifest/sw assertions (node:* only)
  smoke-deployment.mjs    Uses shell.mjs; exported functions behind main guard
  nutrition/{importer,csv,ratings,manifest}.mjs  Importer CLI, CSV parsing, rating algorithm, manifest data
worker/index.ts           Security-header wrapping (image branch removed only if D9 approves)
tests/
  setup.ts, console.ts    Warning collector (fails in afterEach) and expect_console_warning helper
  module-docs.test.ts     Module-JSDoc check with shrink-only allowlist
  hosting-config.test.ts, rendered-html.test.mjs, next-html.test.mjs, __golden__/  Root-config and post-build gates for both targets
  game/core/              fixtures.ts, fixtures/golden-inputs.json, golden.test.ts, simulation.recovery.test.ts, utility.test.ts, persistence/{index,migrations}.test.ts + fixtures/, moved core suites
  game/runtime/           fixtures.ts (phaser stub, clock, DOM stubs), createHawkerRuntime{,.render,.input}.test.ts, saves/snapshot tests, moved runtime suites, visuals/, render/
  game/persistence/       saveStore, preferences, autosave tests
  game/pwa/, game/audio/  registerPwa, sw (node:vm) and AudioDirector tests
  content/                content, nutrition-content, golden, validate, schemas, types tests
  app/                    globals.test.ts (CSS contracts via read_styles); game/ HawkerSimulator.ssr.test.ts, HawkerSimulator.test.ts (jsdom), panels, hud, dialogs, focus, display, nutrition-ui tests
  tools/                  nutrition/{nutrition-importer,ratings}.test.ts, stamp, smoke tests
  config/                 env tests
docs/
  README.md (index), TECHNICAL_DESIGN.md (real tree), SAVE_FORMAT.md, adr/0005-hosting-targets.md, existing docs with single owners per fact
```
