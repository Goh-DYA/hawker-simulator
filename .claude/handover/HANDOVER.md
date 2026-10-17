# Structural refactor handover

This handover was written on 2026-10-17, when the work moved from a local Claude Code session to the cloud. It holds everything needed to continue: the current state, the decisions already made, the binding rules, the remaining plan, and how to verify the work. Read it in full before changing any code.

| | |
|---|---|
| Branch | `refactor/structural-tech-debt`, cut from `main` at 06ac46f |
| Done | Phase 1, the safety nets: 9 packages and 20 steps, all independently reviewed |
| Descoped | Phase 2 (dependency upgrades), plus individual steps in other phases (see [TECH_DEBT_REGISTER.md](TECH_DEBT_REGISTER.md)) |
| Pending | Phases 3–8: **31 packages, 120 steps**, in [PLAN.md](PLAN.md) |
| Gate at handover | `npm run test:release` passes: typecheck, lint, 42 test files / **348 tests**, build, and SSR 2/2. `CI=true npm test` passes on Node 24.19 (Windows) and on Node 22.15.0, the CI version. |
| Player-visible behaviour | Unchanged. Phase 1 added tests only, plus a JSDoc and an `export` on `addIntentFits` in `tools/nutrition/importer.mjs`. |

## Files in this folder

| File | Purpose |
|---|---|
| `HANDOVER.md` | This document: state, decisions, goldens, and how to resume. |
| [BRIEF.md](BRIEF.md) | **Binding rules** for every remaining step: scope, hard constraints, coding and commit standards mapped to TypeScript, and the definition of done. It overrides PLAN.md wherever they conflict. |
| [PLAN.md](PLAN.md) | The remaining packages P3-10 to P8-40. Each step lists its files, implementation detail, behaviour risk, verification, and rationale, followed by the target layout. |
| [TECH_DEBT_REGISTER.md](TECH_DEBT_REGISTER.md) | The 58 scored debt items, where priority = (impact + risk) × (6 − effort), with each item's status and the descoped follow-up work. |
| [WORKFLOW.md](WORKFLOW.md) | The package-runner workflow used for Phase 1: implement, then an independent review, then up to two fix rounds. |
| [snapshot.sh](snapshot.sh) | Records each package's diff as git tree objects, without committing or staging, so the package can be reviewed on its own. |

The user's coding and commit standards are copied in `.claude/context/`, and `.claude/CLAUDE.md` imports them.

## Resume checklist

1. Check out the branch. A cloud session may start on `main`.

   ```bash
   git fetch origin && git checkout refactor/structural-tech-debt
   ```

2. Install the dependencies (Node ≥ 22.15; CI uses 22.15.0).

   ```bash
   npm ci
   ```

   npm 11 may warn that the install scripts of esbuild, sharp, unrs-resolver and workerd are not approved. Locally the build and tests passed without approving them. If the build fails in the cloud, check this first.

3. Re-establish the baseline. Expect 42 files and 348 tests, then SSR 2/2. The build restamps the tracked `public/sw.js`, so revert that afterwards.

   ```bash
   npm run test:release
   ```

   ```bash
   git checkout -- public/sw.js
   ```

   ```bash
   CI=true npm test
   ```

4. Read [BRIEF.md](BRIEF.md), then [PLAN.md](PLAN.md).
5. Work one phase at a time, in package order: P3-10…P3-15, P4-16…P4-19, P5-20…P5-29, P6-30…P6-34, P7-35…P7-37, P8-38…P8-40. If the Workflow tool is available, use [WORKFLOW.md](WORKFLOW.md) with the golden list below. Otherwise follow the same loop by hand: implement, then review independently against the brief, then fix. After each phase, run the full gate yourself and inspect the diff.
6. As the layout changes, keep the Architecture section of `.claude/CLAUDE.md` accurate. It still describes the pre-refactor monoliths. The docs phase (P8) updates `docs/TECHNICAL_DESIGN.md`.
7. Finish:
   - Run the full release gate, and `CI=true npm test` on Node 22.15.0 (`npx -y -p node@22.15.0 -- node node_modules/vitest/vitest.mjs run --config vitest.config.ts`).
   - Update this handover, or delete `.claude/handover/` if the user agrees. The register is worth keeping, for example as `docs/TECH_DEBT.md`.
   - Make **one combined commit** for the remaining phases (see the commit rules in BRIEF.md), then push the branch. Open a PR only if the user asks.

## Decisions already made by the user (2026-10-17)

- **Standards.** Follow the user's global coding and commit standards, which are now copied into `.claude/context/`. New TypeScript functions and variables use `snake_case`, while existing identifiers are not renamed. React components stay PascalCase and hooks stay `useXxx`. Properties of new types stay camelCase, to match persisted shapes.
- **Base.** Refactor `main`. The `origin/independent-review-strategic-gameplay` branch (5 commits, +54.7k lines, schema v7) is **abandoned**, so ignore it.
- **Scope.** This is a structural refactor: safety nets, guardrails, decomposition of the core, runtime and UI monoliths, de-duplication of balance rules, mirrored tests, and docs. The following were descoped:
  - dependency upgrades and CI changes
  - Node pinning
  - the service-worker stamp and template work
  - the smoke tool and worker logic
  - behaviour-bug fixes
  - coverage
  - deploy-output goldens
  - `CONTRIBUTING.md` and `.gitattributes`

  The exact step IDs are listed in TECH_DEBT_REGISTER.md.
- **Dev dependencies.** The user approved `jsdom`, `@testing-library/react` and `fake-indexeddb`, which are installed, and `prettier`, which step S41 adds. They declined `@vitest/coverage-v8`.
- **Dead code.** Pre-existing dead code with no consumers may be deleted.
- **Commits.** The refactoring lands as **one combined commit**. Phase 1 and this handover went in as one commit, and the remaining phases go in as one more, unless the user says otherwise.
- **Undecided.** No primary hosting target has been chosen, so both stay supported. The placeable roster check stays `>= 80`.

## Phase 1: what was delivered

| Package | Steps | Delivered |
|---|---|---|
| P1-01 | S03, S04, S05, S07 | `tests/setup.ts` and `tests/console.ts`: unexpected console output or a process warning fails the test, unless declared with `expect_console_warning`. Snapshot key order is preserved. The dead `tests/core/vitest.config.mjs` and the e2e/coverage config are removed. Tests import through `@/`. |
| P1-02 | S08, S09, S10, S11 | The test tree mirrors the source tree. A core utility suite and shared stepping helpers (`shouldCheckInvariants`). **Seeded simulation goldens** in `tests/game/core/golden.test.ts`: six scenarios, including the production adaptive-arrival model across two day rollovers. |
| P1-03 | S12, S13 | Frozen **V1–V4 save fixtures**, migration and serialisation contract tests, and characterisation of the in-step customer recovery branches. |
| P1-04 | S14 | A **headless runtime harness** (`tests/game/runtime/fixtures.ts`) with a deferred-boot Phaser stub and a test-owned clock, plus controller contract tests: export, import, reset, save fallback, multi-day progression and pressure. |
| P1-05 | S15 | **Exact draw-call digests** for every render scenario, including a gallery of every placeable and all 64 recipe variants. |
| P1-06 | S16, S17, S18, S20 | Input-flow characterisation, the saveStore envelope and checksum golden, a byte-exact **SSR golden** of `HawkerSimulator`, and content and validator goldens. |
| P1-07 | S21 | Nutrition importer rating goldens from a varied fixture CSV. |
| P1-08 | S22 | A **jsdom interaction suite** for `HawkerSimulator`: panels, autosave debounce, failures, import, reset, settings clamping, focus and Escape order. |
| P1-09 | S23, S24 | `fake-indexeddb` tests for slot rotation and preference ordering. Every UI source-text grep is replaced by rendered assertions. |

Notable deviations, each justified and accepted in review:

- jsdom is pinned to 29.1.1 rather than 30.x, because 30.x drops Node 22.15.
- fake-indexeddb is pinned to 6.2.5, because 6.2.6 was one day old.
- Where a spec misdescribed current behaviour, the tests pin the actual behaviour. For example, a V1 runtime envelope loads silently, while a V2 envelope that lacks variant data shows the recipe-reset warning.
- At handover, the milestone-row test was changed to derive its number grouping from the default locale, because the component calls `toLocaleString()` with no locale.

Optional hardening left over from review (minor, not blocking):

- `createHawkerRuntime.input.test.ts` (13) and (16) could also assert events and the core hash.
- Test (14) could get a comment explaining the unmapped-key redraw.
- The SSR absence checks could match bare class tokens.
- One recovery branch, 'Queue cell became unavailable', is not covered.

## Golden files: pre-refactor behaviour, do not change

From Phase 3 onward, these must stay **byte-identical**:

- `tests/game/core/fixtures/golden-inputs.json`
- `tests/game/core/__snapshots__/golden.test.ts.snap`
- `tests/game/core/persistence/fixtures/save-v1.json`, `save-v2.json`, `save-v3.json`, `save-v4.json`
- `tests/game/runtime/fixtures/gallery-save.json`
- `tests/game/runtime/__snapshots__/createHawkerRuntime.test.ts.snap`, `createHawkerRuntime.render.test.ts.snap`, `createHawkerRuntime.input.test.ts.snap`
- `tests/app/game/__snapshots__/HawkerSimulator.ssr.html`, `HawkerSimulator.test.ts.snap`
- `tests/app/game/fixtures/snapshot.json`
- `tests/tools/nutrition/fixtures/varied.csv`

The following golden tests keep their expected literals (sha256 strings, inline goldens and expected values) **frozen**. Change them only for import specifiers or harness plumbing that a planned step explicitly requires:

- `tests/game/core/golden.test.ts`
- `tests/game/core/persistence/index.test.ts`, `migrations.test.ts`
- `tests/game/core/simulation.recovery.test.ts`
- `tests/game/runtime/createHawkerRuntime.test.ts`, `.render.test.ts`, `.input.test.ts`
- `tests/game/runtime/fixtures.ts`: S117 may adapt the harness, but never the recorded output format
- `tests/game/persistence/saveStore.test.ts`
- `tests/app/game/HawkerSimulator.ssr.test.ts`, `HawkerSimulator.test.ts`
- `tests/content/golden.test.ts`
- `tests/content/validate.test.ts`: S141 may remove only the rows for the duplicate checks it deletes
- `tests/tools/nutrition/ratings.test.ts`

A failing golden means the refactor changed behaviour. Fix the code, never the golden.

## Known issues pinned, not fixed

These are deliberately preserved, and the goldens pin them. Fixing any of them later is a behaviour change that needs an intentional golden update and a release note.

- **TD-06.** Exported saves cannot be re-imported. The checksum covers keys whose value is `undefined`, and `JSON.stringify` drops them.
- **TD-36.** Save failure paths and over-broad catches in core command and validation code.
- **TD-46.**
  - Access-point ID collisions on import.
  - Stale reset state.
  - Raw-catalog queue trim.
  - Apron wrap.
- **HUD snapshot lag.** The HUD snapshot lags one command behind move-tool selection, and adding an access point emits its snapshot before selecting it.

## Environment notes

- **CI on `main` is red** at `npm audit --audit-level=high`: 1 critical (next, fixed in 16.4.2) and 23 high as of 2026-10-17. The release gate itself passes. Fixing this was descoped and is unrelated to the refactor.
- **`public/sw.js`.** Every build rewrites the `BUILD_ID` in this tracked file. The hash depends on the platform, through path separators and sort order. Revert it with `git checkout -- public/sw.js` after builds, unless the user wants it committed.
- **Fixture generation.** Golden inputs and fixtures were generated once from 06ac46f by throwaway scripts that are not in the repo. The test files' JSDoc describes how each fixture was built.
- **Prior workflow cost.** Phase 1 used 24 agents (9 implementers, 12 reviews, 3 fixes) and took about 3.7 h of wall time. Expect the remaining 31 packages to take several times that.
