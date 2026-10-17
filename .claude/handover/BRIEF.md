# Refactor brief (binding for every remaining step)

This brief overrides any step text in [PLAN.md](PLAN.md) that conflicts with it. Read all of it before you change anything.

## Goal

Refactor and reorganise Hawker Balance so it stays maintainable and scalable, following the user's coding and commit standards (embedded below) and good engineering practice. **Player-visible behaviour must not change.** The audit, its scoring and the plan are in [TECH_DEBT_REGISTER.md](TECH_DEBT_REGISTER.md) and [PLAN.md](PLAN.md).

## User decisions (final)

- **Base.** The refactor is built on `main` as of 06ac46f. The `origin/independent-review-strategic-gameplay` branch is abandoned, so ignore it along with every mention of schema v7, runtimeEnvelope or stage5.
- **Scope.** This is a structural refactor. Do NOT do any of the following, even where a step mentions it. Skip that part and say so in your report.
  - Upgrade, or bump the version of, any existing dependency.
  - Edit `.github/workflows/*`, `.nvmrc` or the `packageManager` field.
  - Change `tools/stamp-service-worker.mjs`, `public/sw.js` or any `sw_template.js`.
  - Change the deploy smoke tool (`tools/smoke-deployment.mjs`) or the logic in `worker/index.ts`. Comments are allowed.
  - Fix behaviour bugs (TD-06, TD-36, TD-46). They are documented only.
  - Add coverage tooling, deploy-output goldens (`test:ssr:vercel`), a `CONTRIBUTING.md` or `.gitattributes`.
- **Approved devDependencies.** Phase 1 installed `jsdom` 29.1.1 (30.x drops Node 22.15), `@testing-library/react` 16.3.3 with `@testing-library/dom` 10.4.2, and `fake-indexeddb` 6.2.5, all exact-pinned. `prettier` is approved too, and step S41 adds it exact-pinned. Add nothing else.
- **Dead code.** Pre-existing dead code with no consumers may be deleted.
- **Hosting.** Keep both targets: Vinext/Cloudflare via `npm run build`, and Vercel via `npm run build:vercel`. No primary target has been chosen, so don't declare one. The placeable roster check stays `>= 80`.
- **Commits.** For this effort the user asked for the refactoring to land as **one combined commit**. Phase 1 plus this handover was committed as one commit when the work moved to the cloud. Unless the user says otherwise, make **one combined commit** for the remaining phases at the end, after the full release gate passes. Push the branch, and don't open a PR unless asked. Until then, keep the remaining work as working-tree changes, and use [snapshot.sh](snapshot.sh) to review each package's diff.

## Hard constraints

- **Determinism.** The seeded simulation must produce identical results. Do not change RNG call order, iteration order, object-spread key order in digested state, or floating-point evaluation order. `stateDigest` and `simulationDigest` must not change.
- **Save compatibility.** None of these may change: persisted field names; schema versions (`PERSISTENT_SCHEMA_VERSION` = 4, `runtimeSchemaVersion`, `saveVersion`); IndexedDB database and store names; the checksum byte format; content IDs; localisation keys.
- **Layering.** `src/game/core` stays pure. It may not import `src/content`, Phaser, React, idb or browser APIs, and may not use `Math.random` or `Date.now`.
- **Rendering and UI.** Draw calls, text, DOM output, accessibility attributes, focus behaviour, CSS and copy stay unchanged.
- **Deployment.** `npm run build` followed by `npm run test:ssr` must keep passing, and so must `npm run build:vercel`. Security headers stay centralised in `src/config/securityHeaders.ts`.
- **Pure moves.** A move is byte-identical apart from imports, exports and added JSDoc. Check with `git diff -M --color-moved=zebra`.
- **Goldens.** Goldens pin the pre-refactor behaviour (the list is in [HANDOVER.md](HANDOVER.md)). A failing golden means the refactor is wrong: fix the code, never the literal or the snapshot.

## Coding standards

The user's standards are in [`.claude/context/CODING_STYLE.md`](../context/CODING_STYLE.md) and [`.claude/context/COMMIT_STYLE.md`](../context/COMMIT_STYLE.md). `.claude/CLAUDE.md` imports both, so they load automatically. They are written with Python examples. The sections below say how they apply in this TypeScript repository, together with the rules specific to this effort.

### Naming

| Element | Convention | Example |
|---|---|---|
| New functions and methods | `snake_case`, verb-first | `compute_next_spawn_interval_ms()` |
| New variables and parameters | `snake_case`, descriptive (loop counters and idioms like `i` are fine) | `retry_count` |
| New booleans | prefix `is_`, `has_` or `should_` | `is_valid` |
| Properties of new object types | `camelCase`, to match every existing type and persisted shape | `{ menuSlots }` |
| Classes, types and interfaces | `PascalCase` | `RenderContext` |
| Module constants | `UPPER_SNAKE_CASE` | `MAX_QUEUE_CELLS` |
| Private members | leading underscore | `_cache` |
| React components and hooks | `PascalCase` and `useXxx` (JSX and lint require this) | `BuildPanel`, `useAutosave` |
| New module files | short and lowercase, a single word where possible, `snake_case` otherwise | `arrivals.ts`, `render/objects.ts` |

- Never rename existing identifiers for style. Moved identifiers keep their names, and existing exported names stay importable where they are used.
- Avoid abbreviations unless they are domain-standard. Name things for what they are, not how they are implemented.

### Docstrings

Every module (file header) and every exported function or class you create or move gets JSDoc. This is the TypeScript form of Google-style docstrings: a summary line, then the *why* when it isn't obvious, then `@param name - …`, `@returns …` and `@throws ErrorType …`. `tests/module-docs.test.ts` (added in S40) enforces module JSDoc with an allowlist that only shrinks.

### Error handling

- Never swallow exceptions silently: log them with context (`console.warn` or `console.error`) or rethrow them.
- Catch specific error types where TypeScript allows, and never use a bare catch-all that discards the error.
- Tests fail on unexpected console output (`tests/setup.ts`). A test that exercises a logging path declares it with `expect_console_warning`.

### Configuration

Access environment and build-mode values only through `src/config/env.ts`, which S63 creates. The exceptions are Node-side tools and Vite config. Keep constants centralised, and replace magic numbers with named constants without changing values or evaluation order.

### Tests

- Tests live under `tests/` and mirror the source tree: `tests/game/core/…` for `src/game/core/…`, and `tests/app/game/…` for `app/game/…`.
- Files are `*.test.ts`. Use plain `describe`/`it`, with one logical assertion focus per test.
- Import source through the `@/` alias.
- Treat warnings as errors. Never suppress a warning to make a test pass.

### Formatting and lint

- `npm run lint` uses ESLint with the Next core-web-vitals and TypeScript rules. `npm run typecheck` runs strict `tsc`.
- Once S41 lands, Prettier is used only for files you newly author: `npm run format:check -- <files>`. Moved code stays byte-identical.
- Don't add `eslint-disable`, `@ts-ignore` or `as any` to get to green. Fix the cause.

### General principles

- Choose readability over cleverness. Keep functions focused: if a function needs an "and" to describe it, split it.
- Take the minimum code that solves the problem. Nothing speculative, and no churn that doesn't pay for itself.
- Make surgical changes. Every changed line should trace back to a step in the plan.

### Commits

Follow `COMMIT_STYLE.md` exactly: `[<scope>] <Short imperative description>`, choosing the scope with its priority hierarchy. For the combined commit that spans several directories, the scope is a comma-separated list of the top-level areas it touches. Write body paragraphs without hard wraps. Do not add a `Co-Authored-By` trailer or any other attribution line; the user asked for commits without it.

Commit only when the user has told you to (see "Commits" under User decisions).

## Verification (the definition of done after every step)

1. `npm run typecheck && npm run lint && npm test`, then the step's own verification commands.
2. Run golden suites with `CI=true npx vitest run <file>`, so a missing snapshot fails instead of being written.
3. `npm run test:ssr` needs `npm run build` first. Each build restamps the tracked `public/sw.js`, so run `git checkout -- public/sw.js` after every build. The stamp hash depends on the platform, so a Linux build never matches a Windows one. That issue is descoped.
4. Mutation checks: make the change locally, confirm the named test fails, then revert exactly and confirm with `git diff -- <file>`.

## Spec caveats

- Line numbers in PLAN.md refer to 06ac46f, and Phase 1 and later packages have moved code since. Locate code by content, and follow the actual tree when an earlier package placed a file somewhere else.
- If a step is wrong, unsafe or would change behaviour, make the smallest safe deviation or skip it, and record why in your report. Never leave the tree red.
