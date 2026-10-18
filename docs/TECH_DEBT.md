# Tech-debt register

This register came from a nine-area audit of 161 findings, which were deduplicated into 58 items. Each item is scored with the engineering:tech-debt framework, where **priority = (impact + risk) × (6 − effort)** and impact, risk and effort each run from 1 to 5. Status reflects the state after the 2026 structural refactor: **resolved** means every in-scope step landed, **partially resolved** means some steps were descoped or partial, **done (Phase 1)** means the safety-net tests delivered it, and **deferred**, **descoped** and **rejected** items remain open or were declined. The step IDs (S01–S169) name the steps of the refactor plan; the plan itself is retired, and the steps still worth doing are listed under [Partial steps and open follow-ups](#partial-steps-and-open-follow-ups) and [Descoped by the user](#descoped-by-the-user-future-work).

| ID | Priority | I | R | E | Category | Title | Status | Steps |
|---|---|---|---|---|---|---|---|---|
| TD-01 | 36 | 4 | 5 | 2 | test | No pinned golden simulation digests or frozen save fixtures | done (Phase 1) | S04✓ S11✓ S12✓ |
| TD-02 | 36 | 5 | 4 | 2 | infrastructure | Unmerged branch heavily edits and supersedes the files this effort splits | descoped |  |
| TD-03 | 35 | 3 | 4 | 1 | architecture | Core purity and determinism enforced only by convention | resolved | S32✓ S33✓ |
| TD-04 | 32 | 4 | 4 | 2 | test | UI and runtime tests assert source text at fixed paths; no SSR or deploy-output golden | partially resolved | S18✓ ~~S19~~ S24✓ S110✓ |
| TD-05 | 32 | 3 | 5 | 2 | test | saveStore envelope, checksum and slot rotation are untested | done (Phase 1) | S17✓ S23✓ |
| TD-06 | 32 | 3 | 5 | 2 | code | Exported saves can never be re-imported (checksum covers undefined keys) | deferred | S17✓ |
| TD-07 | 32 | 4 | 4 | 2 | code | Progression and balance rules duplicated across core, runtime and UI | resolved | S46✓ S48✓ S92✓ S93✓ S131✓ |
| TD-08 | 32 | 3 | 5 | 2 | code | Startup and settings effects rely on declaration order and IndexedDB request order | resolved | S22✓ S23✓ S127◐ |
| TD-09 | 30 | 5 | 5 | 3 | test | Runtime factory, real-content bootstrap and RuntimeController untested | done (Phase 1) | S14✓ |
| TD-10 | 30 | 3 | 3 | 1 | documentation | Misleading config contracts and dead code | partially resolved | S05✓ S43✓ S141◐ ~~S154~~ |
| TD-11 | 28 | 4 | 3 | 2 | architecture | About 700 lines of pure helpers trapped in the createHawkerRuntime root | resolved | S62✓ S85✓ S86✓ S87✓ S88✓ S90✓ |
| TD-12 | 28 | 3 | 4 | 2 | code | Catalog layering repeated 9x; load and new-game pipelines duplicated | resolved | S94✓ S95✓ |
| TD-13 | 28 | 3 | 4 | 2 | code | Shared vocabularies copied across types, arrays, persistence checks and Zod schemas | resolved | S58✓ S59✓ |
| TD-14 | 28 | 4 | 3 | 2 | code | Launch roster counts hard-coded in 6+ places; dead and duplicate validator checks | partially resolved | S20✓ S138✓ S139✓ ~~S140~~ S141◐ S142✓ S143✓ S144✓ |
| TD-15 | 28 | 4 | 3 | 2 | infrastructure | Build rewrites tracked public/sw.js; OS-dependent hash; swallowed fs errors | descoped | ~~S64~~ ~~S65~~ ~~S66~~ ~~S67~~ ~~S68~~ |
| TD-16 | 28 | 3 | 4 | 2 | test | Nutrition importer has no real golden; untyped 835-line tool with CLI bugs | partially resolved | S21✓ S150✓ ~~S151~~ |
| TD-17 | 27 | 4 | 5 | 3 | dependency | npm audit gate fails (critical in next 16.2.6); overrides pin vulnerable versions | descoped | ~~S25~~ ~~S26~~ ~~S27~~ ~~S28~~ ~~S29~~ ~~S30~~ ~~S31~~ |
| TD-18 | 27 | 4 | 5 | 3 | test | About 3,500 lines of Phaser draw code have no executable check | done (Phase 1) | S15✓ |
| TD-19 | 27 | 5 | 4 | 3 | architecture | HawkerSimulator.tsx is a 2,515-line single component | resolved | S22✓ S130✓ S131✓ S133✓ S134✓ S135✓ S136✓ S137✓ |
| TD-20 | 25 | 2 | 3 | 1 | test | Test infra: no warnings-as-errors, orphan config, no coverage provider, key-sorting snapshots | done (Phase 1) | S03✓ S04✓ S05✓ ~~S06~~ |
| TD-21 | 25 | 2 | 3 | 1 | infrastructure | No .gitattributes or .nvmrc; unanchored data/ ignore; .env.example ignored | partially resolved | ~~S02~~ S37✓ ~~S38~~ ~~S39~~ |
| TD-22 | 25 | 2 | 3 | 1 | code | Runtime and UI type duplication and stale casts across the bridge | partially resolved | S60✓ S61✓ S89◐ S146✓ |
| TD-23 | 25 | 2 | 3 | 1 | code | Core helper duplication: clones, geometry, effective catalog, ordering, hash | resolved | S45✓ S49✓ S50✓ S51✓ S52✓ S53✓ S54✓ S55✓ S56✓ S57✓ |
| TD-24 | 24 | 3 | 3 | 2 | code | About 50 unnamed tuning numbers in core, runtime and content | resolved | S44✓ S45✓ S46✓ S47✓ S48✓ S91✓ S143✓ S148✓ |
| TD-25 | 24 | 4 | 4 | 3 | architecture | Autosave queue, preference keys and settings normalisation live in the React component | resolved | S22✓ S122✓ S123✓ S126✓ S127◐ |
| TD-26 | 24 | 4 | 4 | 3 | architecture | Customer state machine: 255-line switch, no exhaustiveness, recovery blocks copied 10x | resolved | S13✓ S81✓ |
| TD-27 | 24 | 4 | 4 | 3 | architecture | persistence.ts monolith with ad-hoc migrations and duplicated nutrition parsing | resolved | S12✓ S71✓ S72✓ S73✓ S74✓ S75✓ |
| TD-28 | 24 | 3 | 3 | 2 | architecture | Core barrel export * publishes every internal helper | resolved | S42✓ |
| TD-29 | 24 | 2 | 4 | 2 | code | Swallowed or over-broad catches discard error causes | partially resolved | ~~S65~~ ~~S67~~ ~~S69~~ S70✓ S96✓ S124✓ S128✓ |
| TD-30 | 24 | 3 | 3 | 2 | infrastructure | Lint and type guardrail gaps | partially resolved | S33✓ S34✓ S35✓ S36✓ ~~S64~~ S150✓ |
| TD-31 | 24 | 3 | 3 | 2 | documentation | Docs describe nonexistent modules and guarantees; conflicting agent guidance | partially resolved | ~~S01~~ S158✓ S159✓ S160✓ S161✓ S162✓ ~~S163~~ |
| TD-32 | 24 | 3 | 3 | 2 | infrastructure | CI supply chain and gate parity | descoped | ~~S31~~ ~~S38~~ ~~S155~~ ~~S156~~ ~~S157~~ |
| TD-33 | 24 | 3 | 3 | 2 | test | Deployment tools run at import and are tested by grepping their source | descoped | ~~S152~~ ~~S153~~ |
| TD-34 | 24 | 2 | 4 | 2 | architecture | Content-ID alias and refund recovery hook never wired | descoped | ~~S149~~ |
| TD-35 | 24 | 3 | 3 | 2 | code | Nutrition flattener, condition labels and localize duplicated between UI and runtime | resolved | S129✓ S147✓ |
| TD-36 | 24 | 2 | 4 | 2 | code | Save and offline failure-path defects; over-broad catches | deferred |  |
| TD-37 | 21 | 3 | 4 | 3 | code | Three hand-rolled focus traps; modal stack encoded four times | resolved | S22✓ S132◐ |
| TD-38 | 21 | 4 | 3 | 3 | architecture | currentSnapshot is a 300-line closure projection | resolved | S97✓ S98✓ |
| TD-39 | 21 | 4 | 3 | 3 | architecture | Render code, HawkerScene and Game construction trapped in the root | resolved | S105✓ S106✓ S107✓ S108✓ S109✓ S110✓ S111✓ S112✓ S113✓ S114✓ S115✓ S116✓ S117✓ |
| TD-40 | 21 | 4 | 3 | 3 | architecture | dispatchCommand is a 370-line if-chain with a hand-maintained build guard | resolved | S76✓ S82✓ S83✓ |
| TD-41 | 21 | 4 | 3 | 3 | architecture | Hand-written content types duplicate every Zod schema | resolved | S20✓ S145✓ S146✓ |
| TD-42 | 21 | 4 | 3 | 3 | architecture | Two production targets with no decision record; worker dead scaffold | partially resolved | ~~S19~~ ~~S25~~ ~~S154~~ S161✓ |
| TD-43 | 20 | 3 | 2 | 2 | test | Test tree does not mirror source; relative imports; duplicated step helpers | done (Phase 1) | S07✓ S08✓ S09✓ S10✓ |
| TD-44 | 20 | 3 | 2 | 2 | code | Env and dev-flag reads scattered; service-worker protocol split across UI and integration | partially resolved | S37✓ S63◐ S125✓ |
| TD-45 | 20 | 3 | 2 | 2 | code | Localisation assembly copied four times; merge without collision guard | resolved | S20✓ S147✓ |
| TD-46 | 20 | 2 | 3 | 2 | code | Latent gameplay bugs: access-ID collisions, stale interaction after reset, raw-catalog queue trim, apron wrap, HUD cleanliness divergence | deferred | S13✓ S16✓ |
| TD-47 | 18 | 3 | 3 | 3 | code | Renderers choose art by substring-matching content IDs; tables have drifted | resolved | S121✓ |
| TD-48 | 16 | 2 | 2 | 2 | architecture | visualRecipes.ts is a 1,171-line four-domain module; three hex parsers | resolved | S99✓ S100✓ S101✓ S102✓ S103✓ S104✓ |
| TD-49 | 16 | 2 | 2 | 2 | code | validateCatalogInternal is a 235-line function | resolved | S84✓ |
| TD-50 | 16 | 2 | 2 | 2 | code | Per-frame and per-tick recomputation of layout-only data | deferred |  |
| TD-51 | 16 | 2 | 2 | 2 | dependency | Audit-only nutrition data ships in the client bundle | deferred |  |
| TD-52 | 15 | 3 | 2 | 3 | infrastructure | 4,717-line append-only globals.css | deferred |  |
| TD-53 | 14 | 4 | 3 | 4 | architecture | simulation.ts is a 1,409-line, eight-concern hotspot; completeSale carries ~105 lines of nutrition bookkeeping | resolved | S77✓ S78✓ S79✓ S80✓ |
| TD-54 | 14 | 4 | 3 | 4 | architecture | 28 mutable closure variables shared implicitly by runCommand, handleTile, scene and controller | resolved | S16✓ S118✓ S119✓ S120✓ |
| TD-55 | 12 | 2 | 1 | 2 | documentation | Missing module and exported-function JSDoc across repo | partially resolved | S40✓ S164✓ S165✓ S166✓ S167✓ S168✓ S169◐ |
| TD-56 | 9 | 2 | 1 | 3 | infrastructure | No formatter configured | partially resolved | S41✓ |
| TD-57 | 8 | 1 | 1 | 2 | dependency | Unused Tailwind utilities and a 3 MB og.png | rejected |  |
| TD-58 | 6 | 1 | 1 | 3 | architecture | Proposed churn that does not pay for itself | rejected |  |

Key: ✓ means the step is done, ◐ means it is partial (see [Partial steps and open follow-ups](#partial-steps-and-open-follow-ups)), and a struck-through step was descoped by the user.

## Item details

### TD-01: No pinned golden simulation digests or frozen save fixtures

- **Score:** impact 4, risk 5, effort 2, giving priority **36**. **Category:** test. **Status:** done (Phase 1).
- **Justification:** The hard constraint is an unchanged stateDigest/simulationDigest plus save compatibility. Today stateDigest is never called in tests, and simulationDigest is only compared run-to-run (persistence-soak.test.ts:182). There are no snapshots anywhere in tests/ (verified). Verified in review: Vitest pretty-format sorts object keys by default (node_modules/@vitest/pretty-format/dist/index.js:20, compareKeys undefined at :959), so a parsed-object snapshot cannot detect key-order drift. Every existing fixture sets maxActiveCustomers (tests/core/fixtures.ts:123-124, tests/performance.test.ts:24-25), which switches off the production adaptive arrival model, and no test crosses OPERATING_DAY_MS (480,000 ms).
- **Disposition:** planned. Prerequisite for every core, runtime and dependency step. The goldens assert sha256 literals of the raw digest strings, build from frozen JSON inputs, and include an adaptive-model scenario that runs for two days.
- **Sources:** core-sim-01, core-rules-persistence-01, tests-01, build-deploy-deps-docs-21, runtime-helpers-integrations-10

### TD-02: Unmerged branch heavily edits and supersedes the files this effort splits

- **Score:** impact 5, risk 4, effort 2, giving priority **36**. **Category:** infrastructure. **Status:** descoped.
- **Justification:** Verified: origin/independent-review-strategic-gameplay is 5 ahead and 0 behind. It sets PERSISTENT_SCHEMA_VERSION = 7 (main has 4), adds src/game/persistence/runtimeEnvelope.ts, src/game/core/strategicProgression.ts, src/content/strategicGameplay.ts and tests/stage5-save-store.test.ts, and adds about 5,200 lines to HawkerSimulator.tsx and about 4,362 to createHawkerRuntime.ts.
- **Disposition:** planned. Hard Phase 0 gate (D1) with two exits. If the branch is frozen, this plan applies as written against 06ac46f. If it is merged, the area audits are re-run on the merged main and the plan is regenerated before S02, because the schema version, the save stores and the extraction targets all change.
- **Sources:** build-deploy-deps-docs-05

### TD-03: Core purity and determinism enforced only by convention

- **Score:** impact 3, risk 4, effort 1, giving priority **35**. **Category:** architecture. **Status:** resolved.
- **Justification:** eslint.config.mjs has no restricted-imports or restricted-globals rule for src/game/core. One stray content, Phaser or Math.random use during the split would break layering and determinism.
- **Disposition:** planned. Lint-only change; the current code already passes. It is extended to the new render/, visuals/ and app/ layering rules.
- **Outcome:** S32 and S33 added the lint rules. The review-fix pass added `import/no-restricted-paths` zones, so core and the app render/vendor bans also catch relative imports. The app ban on a static `createHawkerRuntime` import still matches only the `@/` alias (documented in docs/TECHNICAL_DESIGN.md).
- **Sources:** core-sim-21, core-rules-persistence-15, tests-07, build-deploy-deps-docs-09

### TD-04: UI and runtime tests assert source text at fixed paths; no SSR or deploy-output golden

- **Score:** impact 4, risk 4, effort 2, giving priority **32**. **Category:** test. **Status:** partially resolved.
- **Justification:** About 35 toContain/regex checks read HawkerSimulator.tsx, NutritionEducation.tsx, globals.css and createHawkerRuntime.ts as text. Verified examples: nutrition-ui.test.ts:233-234, :254, :279 and activity-feed.test.ts:54-63. Any file move breaks them, while broken behaviour still passes. The Next (Vercel) HTML output has no pre-deploy check.
- **Disposition:** planned. Add a component SSR golden and full-document goldens for both deploy targets. Then retire every UI and CSS grep in one test-only step (S24) before any UI extraction.
- **Outcome:** Every source-text grep is gone (S24, S110) and the component SSR golden exists (S18). The deploy-output goldens (S19) were descoped.
- **Sources:** react-ui-01, tests-04, runtime-root-b-02, runtime-root-a-11, runtime-helpers-integrations-09

### TD-05: saveStore envelope, checksum and slot rotation are untested

- **Score:** impact 3, risk 5, effort 2, giving priority **32**. **Category:** test. **Status:** done (Phase 1).
- **Justification:** The checksum byte format is a persisted contract (stableStringify, saveStore.ts:41-49). Nothing pins it, and the docs claim coverage that does not exist.
- **Disposition:** planned. The pure envelope tests need no new dependency. The IndexedDB tests need fake-indexeddb, which depends on user decision D5.
- **Sources:** runtime-helpers-integrations-02, tests-05, core-rules-persistence-10

### TD-06: Exported saves can never be re-imported (checksum covers undefined keys)

- **Score:** impact 3, risk 5, effort 2, giving priority **32**. **Category:** code. **Status:** deferred.
- **Justification:** Verified: stableStringify emits "key":undefined, persistence.ts:715 always writes queuePath (undefined when absent), and the JSON.stringify inside exportSave drops it, so importSave rejects every real export.
- **Disposition:** deferred. The fix changes player-visible behaviour, so it is out of scope for a behaviour-preserving refactor. Recommended as a separate approved hotfix after S17 pins the current checksum (D7). Recorded in KNOWN_ISSUES (S162).
- **Sources:** runtime-helpers-integrations-01

### TD-07: Progression and balance rules duplicated across core, runtime and UI

- **Score:** impact 4, risk 4, effort 2, giving priority **32**. **Category:** code. **Status:** resolved.
- **Justification:** Milestone targets are repeated at createHawkerRuntime.ts:1106-1109 and in progression.ts. The rank ladder, menu slots, mastery rank, reputation x20, the 4x2 expansion and the level-3 gate each appear in 2-3 layers.
- **Disposition:** planned. Export plain data from core and from small runtime modules, keeping values and order identical.
- **Sources:** runtime-root-a-02, core-sim-07, react-ui-11, runtime-root-b-07, runtime-helpers-integrations-13

### TD-08: Startup and settings effects rely on declaration order and IndexedDB request order

- **Score:** impact 3, risk 5, effort 2, giving priority **32**. **Category:** code. **Status:** resolved.
- **Justification:** The settings effect writes DEFAULT_SETTINGS to the key the startup effect is still reading. Saved settings survive only because loadPreference('settings') is issued synchronously in the effect body before the settings effect's savePreference (both chain on database(), saveStore.ts:29-39). Reads are sequential, and partial results are kept on failure (HawkerSimulator.tsx:776-793).
- **Disposition:** planned. Extract the hooks but keep call order, the synchronous first read, partial-failure semantics and the ungated write. Pin all of these with fake-indexeddb tests.
- **Outcome:** `useHawkerRuntime` keeps the synchronous first settings read through `load_player_preferences`, pinned by fake-indexeddb order tests and a remount test. The manual reload check (S127) was not run for lack of a browser.
- **Sources:** react-ui-02

### TD-09: Runtime factory, real-content bootstrap and RuntimeController untested

- **Score:** impact 5, risk 5, effort 3, giving priority **30**. **Category:** test. **Status:** done (Phase 1).
- **Justification:** buildCatalog, starterObjects, freshState, the save-candidate fallback, import/export/reset and pre-boot controller calls have no tests. Core tests use TEST_CATALOG only.
- **Disposition:** planned. Safety net for the whole runtime decomposition. It uses a test-owned clock and a deferred-boot Phaser stub, and imports a different save rather than a round-trip.
- **Sources:** runtime-root-a-01, tests-02, runtime-root-b-13, runtime-root-a-16

### TD-10: Misleading config contracts and dead code

- **Score:** impact 3, risk 3, effort 1, giving priority **30**. **Category:** documentation. **Status:** partially resolved.
- **Justification:** maxActiveCustomers is documented as 'Ignored' but switches the arrival model, and reputationGainPerVisit is never read. The dead code is markAbandonedVisit, choose/nextInt, QUEUE_CARDINAL_DIRECTIONS, loadGame, averageRankPercentiles, NEXT_SECURITY_HEADERS, the snapshot fields objectiveProgress/pausedReason, the orphan tests/core/vitest.config.mjs, the unreachable validator blocks and the worker image branch.
- **Disposition:** planned. Correct the JSDoc and add @deprecated now. Every deletion of pre-existing dead code waits for user approval (D9), per CLAUDE.md section 3, and lands as its own commit.
- **Outcome:** JSDoc corrected and the dead core code deleted (S43); unreachable validator checks removed (S141). The worker image branch (S154) was descoped, and NEXT_SECURITY_HEADERS is documented as unused rather than deleted.
- **Sources:** core-sim-10, core-rules-persistence-07, runtime-root-a-20, build-deploy-deps-docs-17, content-tools-08

### TD-11: About 700 lines of pure helpers trapped in the createHawkerRuntime root

- **Score:** impact 4, risk 3, effort 2, giving priority **28**. **Category:** architecture. **Status:** resolved.
- **Justification:** All 7 recent commits touched the 5,663-line file. The catalog, world, save and nutrition helpers can be moved verbatim and become testable without Phaser.
- **Disposition:** planned. Pure moves, one destination module per commit.
- **Sources:** runtime-root-a-04, runtime-root-a-12, runtime-helpers-integrations-14

### TD-12: Catalog layering repeated 9x; load and new-game pipelines duplicated

- **Score:** impact 3, risk 4, effort 2, giving priority **28**. **Category:** code. **Status:** resolved.
- **Justification:** catalog and state.catalog are synced by hand at 9 sites, and importState re-implements startup load. Verified: at 849-853 and 5407-5411 the state comes from loadedCore/imported, not from the current state.
- **Disposition:** planned. Use shared helpers but keep per-path messages, the loaded/imported spreads and the existing asymmetries.
- **Sources:** runtime-root-a-03, runtime-root-a-05, runtime-root-b-13

### TD-13: Shared vocabularies copied across types, arrays, persistence checks and Zod schemas

- **Score:** impact 3, risk 4, effort 2, giving priority **28**. **Category:** code. **Status:** resolved.
- **Justification:** NutritionMetric, HealthCondition, NutritionIntent, Rotation and others are each spelled out 3-5 times with no sync test. Tuple order drives seeded rolls and digest key order.
- **Disposition:** planned. Add as-const tuples in today's order, derive the unions, and add a contract test against the Zod enums.
- **Sources:** core-rules-persistence-05, runtime-root-a-15

### TD-14: Launch roster counts hard-coded in 6+ places; dead and duplicate validator checks

- **Score:** impact 4, risk 3, effort 2, giving priority **28**. **Category:** code. **Status:** partially resolved.
- **Justification:** 14/54/80/12/104 appear in schemas.ts (parsed at import), validate.ts, the importer and the tests. Three validator blocks can never fire.
- **Disposition:** planned. A roster.ts single source and validator rule groups. Removing dead or duplicate checks is gated by D9.
- **Outcome:** `src/content/roster.ts` is the single source and the validator runs as rule groups. S140 was descoped, and S141 kept the reachable "exposes unknown nutrition intent" check, now pinned by a test.
- **Sources:** content-tools-02, content-tools-08, tests-15

### TD-15: Build rewrites tracked public/sw.js; OS-dependent hash; swallowed fs errors

- **Score:** impact 4, risk 3, effort 2, giving priority **28**. **Category:** infrastructure. **Status:** descoped.
- **Justification:** 8 of 10 commits carry a BUILD_ID diff. Verified at tools/stamp-service-worker.mjs: .catch(() => []) at :34, native relative paths hashed at :36, version 1.0.0 hard-coded at :43-45.
- **Disposition:** planned. Harden the tool, then generate public/sw.js from a tracked template. The fail-fast check lives in the stamp tool, not next.config.ts, and the /sw.js URL is unchanged.
- **Sources:** runtime-helpers-integrations-03, content-tools-03, build-deploy-deps-docs-04

### TD-16: Nutrition importer has no real golden; untyped 835-line tool with CLI bugs

- **Score:** impact 3, risk 4, effort 2, giving priority **28**. **Category:** test. **Status:** partially resolved.
- **Justification:** The synthetic CSV gives every food the same values. Re-rating the checked-in profiles reproduces them exactly, which makes a cheap golden possible.
- **Disposition:** planned. Golden first, then the split and per-file @ts-check. The CLI fixes go in a separate commit flagged as a tool behaviour change.
- **Outcome:** Rating goldens (S21), and the importer split into `csv.mjs` and `ratings.mjs` with `// @ts-check` (S150). The CLI fixes (S151) were descoped.
- **Sources:** content-tools-01, content-tools-09

### TD-17: npm audit gate fails (critical in next 16.2.6); overrides pin vulnerable versions

- **Score:** impact 4, risk 5, effort 3, giving priority **27**. **Category:** dependency. **Status:** descoped.
- **Justification:** npm audit reports 1 critical, 23 high and 6 moderate. vercel.yml:46-47 runs --audit-level=high on every PR, so the required check is red. Verified: the overrides pin postcss 8.5.14 (package.json:52).
- **Disposition:** planned. Forced by the high and critical advisories. The upgrades run immediately after the Phase 1 goldens, and the audit-policy change (D4) lands right after them in S31, so CI is green for Phases 3-8. The vinext 1.x major is deferred.
- **Sources:** build-deploy-deps-docs-01, build-deploy-deps-docs-03

### TD-18: About 3,500 lines of Phaser draw code have no executable check

- **Score:** impact 4, risk 5, effort 3, giving priority **27**. **Category:** test. **Status:** done (Phase 1).
- **Justification:** Moving draw code out of the closure can silently swap captured variables or change float arithmetic.
- **Disposition:** planned. A recording-canvas digest with exact (toPrecision(15)) arguments must land before any render move.
- **Sources:** runtime-root-b-01, tests-03

### TD-19: HawkerSimulator.tsx is a 2,515-line single component

- **Score:** impact 5, risk 4, effort 3, giving priority **27**. **Category:** architecture. **Status:** resolved.
- **Justification:** It has 25 useState calls and re-renders the whole tree every 220 ms. Its ternary chains and the duplicated objective card have already drifted.
- **Disposition:** planned. One presentational module per commit, after the SSR golden, the jsdom suite and the grep-retirement step.
- **Outcome:** The shell is about 930 lines, composing `hooks.ts`, `display.ts`, `focus.ts`, `hud.tsx`, `dialogs.tsx` and `panels/*`.
- **Sources:** react-ui-03, react-ui-04, react-ui-12, react-ui-13, react-ui-11

### TD-20: Test infra: no warnings-as-errors, orphan config, no coverage provider, key-sorting snapshots

- **Score:** impact 2, risk 3, effort 1, giving priority **25**. **Category:** test. **Status:** done (Phase 1).
- **Justification:** This violates the global standard. tests/core/vitest.config.mjs is orphaned and the tests/e2e exclude is dead.
- **Disposition:** planned. Warnings are collected and fail in afterEach, never thrown in place. Snapshots keep key order. Deleting the dead config is gated by D9, and coverage by D5.
- **Sources:** tests-08, tests-11, tests-14, core-sim-13

### TD-21: No .gitattributes or .nvmrc; unanchored data/ ignore; .env.example ignored

- **Score:** impact 2, risk 3, effort 1, giving priority **25**. **Category:** infrastructure. **Status:** partially resolved.
- **Justification:** A byte-exact sha test depends on line endings, data/ swallows any nested data folder, and the global standard requires a committed .env.example.
- **Disposition:** planned. No content change. The Node version is decision D8.
- **Outcome:** `/data/` is anchored and `.env.example` is committed (S37). `.gitattributes`, `.nvmrc` and the npm version (S02, S38, S39) were descoped.
- **Sources:** tests-12, build-deploy-deps-docs-10, build-deploy-deps-docs-13

### TD-22: Runtime and UI type duplication and stale casts across the bridge

- **Score:** impact 2, risk 3, effort 1, giving priority **25**. **Category:** code. **Status:** partially resolved.
- **Justification:** Intersection casts at HawkerSimulator.tsx:1183-1190, 487, 518 and 1477; a double cast at createHawkerRuntime.ts:1033; duplicated QualityMode and HealthConditionId; onPersistentChange typed as unknown.
- **Disposition:** planned. Type-only changes, except one helper that keeps the summation order.
- **Outcome:** Casts and duplicate types removed (S60, S61, S146). S89 is partial: `exportState()` and `onPersistentChange` stay `unknown`, because typing them breaks the frozen HawkerSimulator.test.ts harness.
- **Sources:** react-ui-08, runtime-root-a-07, runtime-root-a-08, runtime-helpers-integrations-12

### TD-23: Core helper duplication: clones, geometry, effective catalog, ordering, hash

- **Score:** impact 2, risk 3, effort 1, giving priority **25**. **Category:** code. **Status:** resolved.
- **Justification:** Progression and metrics clones are written 3 times, the boundary predicate 5 times, the reserved points 6 times and the FNV-1a loop twice. localeCompare is used in the deterministic core.
- **Disposition:** planned. Replace only sites with the same semantics. persistentStateFromGame keeps its explicit three-field metrics literal, and the raw-catalog command sites stay as they are (TD-46).
- **Sources:** core-sim-06, core-sim-07, core-sim-15, core-sim-19, core-rules-persistence-09, core-rules-persistence-16, runtime-helpers-integrations-11

### TD-24: About 50 unnamed tuning numbers in core, runtime and content

- **Score:** impact 3, risk 3, effort 2, giving priority **24**. **Category:** code. **Status:** resolved.
- **Justification:** These cover the arrival model, choice weights, rating weights, queueCapacity 7, refund 0.5 and the star-rating weights.
- **Disposition:** planned. Swap literals without changing the expression's shape, behind an adaptive-model golden. The objective-template table is deferred because it is copy-sensitive.
- **Sources:** core-sim-05, core-sim-12, core-rules-persistence-08, core-rules-persistence-18, runtime-root-a-06, content-tools-11

### TD-25: Autosave queue, preference keys and settings normalisation live in the React component

- **Score:** impact 4, risk 4, effort 3, giving priority **24**. **Category:** architecture. **Status:** resolved.
- **Justification:** The 4 preference key literals (12 sites) are a save contract, the debounced and serialised queue semantics are untested, and the default volumes are repeated 3 times.
- **Disposition:** planned. src/game/persistence/preferences.ts and autosave.ts with exact semantics.
- **Sources:** react-ui-05, react-ui-10, runtime-helpers-integrations-04, runtime-helpers-integrations-17

### TD-26: Customer state machine: 255-line switch, no exhaustiveness, recovery blocks copied 10x

- **Score:** impact 4, risk 4, effort 3, giving priority **24**. **Category:** architecture. **Status:** resolved.
- **Justification:** A new status without a case silently deletes customers. The recovery copies have drifted (orderedDishId is cleared in 2 of 7).
- **Disposition:** planned. Recovery characterisation first, then a handler table.
- **Sources:** core-sim-02, core-sim-13

### TD-27: persistence.ts monolith with ad-hoc migrations and duplicated nutrition parsing

- **Score:** impact 4, risk 4, effort 3, giving priority **24**. **Category:** architecture. **Status:** resolved.
- **Justification:** Six commits touched it, the literal schema version 4 appears in 9 places, and the today/lifetime metrics are parsed twice. Verified: parseV2 validates progression.level (persistence.ts:189), so the V1-to-V2 literal must keep level (:665, :683).
- **Disposition:** planned. Folder move, a leaf version constant, an upgrade chain that keeps the V1 literal byte-identical, then helpers, all against frozen fixtures.
- **Sources:** core-rules-persistence-02, core-rules-persistence-03, core-rules-persistence-04

### TD-28: Core barrel export * publishes every internal helper

- **Score:** impact 3, risk 3, effort 2, giving priority **24**. **Category:** architecture. **Status:** resolved.
- **Justification:** index.ts is 16 export * lines.
- **Disposition:** planned. Before the core split.
- **Sources:** core-sim-20, core-rules-persistence-12

### TD-29: Swallowed or over-broad catches discard error causes

- **Score:** impact 2, risk 4, effort 2, giving priority **24**. **Category:** code. **Status:** partially resolved.
- **Justification:** createHawkerRuntime.ts:862/878; HawkerSimulator.tsx:728/739/758/789/796/1012/1109/1165/1166 plus the preference writes; AudioDirector.ts:81 and :91-92 void promises; public/sw.js:35 and :74 bare catches; catch narrowing in commands.ts and validation.ts.
- **Disposition:** planned. Logging-only steps for every listed site (S69, S70, S96, S124, S128), with no control-flow or copy change. Narrowing the catches changes behaviour and is deferred (TD-36), and recorded in KNOWN_ISSUES (S162).
- **Outcome:** Logging added at the runtime, UI, autosave and audio sites (S70, S96, S124, S128). The service-worker and stamp-tool sites (S65, S67, S69) were descoped.
- **Sources:** runtime-root-a-10, runtime-helpers-integrations-16, react-ui-14, core-sim-08, core-rules-persistence-11

### TD-30: Lint and type guardrail gaps

- **Score:** impact 3, risk 3, effort 2, giving priority **24**. **Category:** infrastructure. **Status:** partially resolved.
- **Justification:** The ignores exist only as CLI flags, four strict flags with zero errors are unused, tools/*.mjs are not type-checked, there is no --max-warnings=0, import/order is not enforced and the new layering rules are not enforced.
- **Disposition:** planned. No change to emitted code. Per-file @ts-check for tools, not a global checkJs. noUncheckedIndexedAccess (75 errors) is deferred.
- **Outcome:** Lint and tsc guardrails and per-file `@ts-check` for the nutrition tools are in. The stamp tool (S64) was descoped; noUncheckedIndexedAccess stays deferred.
- **Sources:** build-deploy-deps-docs-09

### TD-31: Docs describe nonexistent modules and guarantees; conflicting agent guidance

- **Score:** impact 3, risk 3, effort 2, giving priority **24**. **Category:** documentation. **Status:** partially resolved.
- **Justification:** TECHNICAL_DESIGN lists src/game/world, src/ui, a staging write and an error boundary, none of which exist. The release evidence makes false '0 vulnerabilities' claims. The untracked AGENTS.md prescribes camelCase and unscoped commit subjects, which conflicts with the global standard.
- **Disposition:** planned. A conventions-only CONTRIBUTING.md lands first (S01) so executors see one rule. Everything else is in the final docs phase.
- **Outcome:** TECHNICAL_DESIGN, SAVE_FORMAT, DEPLOYMENT, the docs index and the release evidence are corrected (S158-S162). S01 and S163 were descoped.
- **Sources:** build-deploy-deps-docs-02, build-deploy-deps-docs-07, build-deploy-deps-docs-08, build-deploy-deps-docs-16, runtime-helpers-integrations-15, core-sim-16, core-rules-persistence-14, runtime-root-a-18, react-ui-18

### TD-32: CI supply chain and gate parity

- **Score:** impact 3, risk 3, effort 2, giving priority **24**. **Category:** infrastructure. **Status:** descoped.
- **Justification:** There is no Dependabot, the deploy secrets are job-scoped (visible to npm ci lifecycle scripts), and test:release is not the CI gate.
- **Disposition:** planned. Workflow and job names stay unchanged. Secret scoping includes the validate steps and is verified by a workflow_dispatch dry run. SHA-pinning actions is deferred.
- **Sources:** build-deploy-deps-docs-11, build-deploy-deps-docs-15

### TD-33: Deployment tools run at import and are tested by grepping their source

- **Score:** impact 3, risk 3, effort 2, giving priority **24**. **Category:** test. **Status:** descoped.
- **Justification:** smoke-deployment.mjs and rendered-html.test.mjs repeat the same assertions, and hosting-config.test.ts:62-75 checks source text.
- **Disposition:** planned. Exported functions behind a main guard, plus a dependency-free tools/shell.mjs.
- **Sources:** content-tools-04, build-deploy-deps-docs-14

### TD-34: Content-ID alias and refund recovery hook never wired

- **Score:** impact 2, risk 4, effort 2, giving priority **24**. **Category:** architecture. **Status:** descoped.
- **Justification:** The runtime calls deserializeGameState without options, so a future content ID rename would wipe saves.
- **Disposition:** planned. Empty frozen tables give identical behaviour.
- **Sources:** core-rules-persistence-06

### TD-35: Nutrition flattener, condition labels and localize duplicated between UI and runtime

- **Score:** impact 3, risk 3, effort 2, giving priority **24**. **Category:** code. **Status:** resolved.
- **Justification:** nutritionProfileView duplicates runtimeNutritionProfile; HEALTH_CONDITION_LABELS and localize are duplicated.
- **Disposition:** planned. The UI imports the Phaser-free runtime/nutrition.ts.
- **Sources:** react-ui-09, content-tools-06

### TD-36: Save and offline failure-path defects; over-broad catches

- **Score:** impact 2, risk 4, effort 2, giving priority **24**. **Category:** code. **Status:** deferred.
- **Justification:** The startup catch-all can turn a code bug into a wiped save after two autosaves. A checksum-failed active save falls back silently. A rejected IndexedDB open is cached. sw.js cache.put failures override good responses. Narrowing the catches in commands.ts and validation.ts changes behaviour.
- **Disposition:** deferred. Each fix changes failure-path or player-visible behaviour. They ship as opt-in fixes after the refactor (D7) and are recorded in KNOWN_ISSUES in S162.
- **Sources:** runtime-root-a-10, runtime-helpers-integrations-05, runtime-helpers-integrations-06, runtime-helpers-integrations-08

### TD-37: Three hand-rolled focus traps; modal stack encoded four times

- **Score:** impact 3, risk 4, effort 3, giving priority **21**. **Category:** code. **Status:** resolved.
- **Justification:** The selectors diverge, and adding a dialog takes four coordinated edits. The modal effect re-runs on every tutorial step (deps at HawkerSimulator.tsx:985) with restore-then-focus rAF ordering (942, 982).
- **Disposition:** planned. Consolidate behind the exact selectors, dependency set and rAF order. The autofocus fix is deferred.
- **Outcome:** `app/game/focus.ts` holds the selectors, `resolve_active_modal`, `is_interface_inert` and `install_focus_trap`. S132 used a plain function called from each caller's effect instead of a `useFocusTrap` hook, because a caller-supplied deps array fails exhaustive-deps; the manual keyboard matrix was not run.
- **Sources:** react-ui-06, react-ui-07

### TD-38: currentSnapshot is a 300-line closure projection

- **Score:** impact 4, risk 3, effort 3, giving priority **21**. **Category:** architecture. **Status:** resolved.
- **Justification:** The RuntimeSnapshot contract grows with every feature and cannot be tested without Phaser.
- **Disposition:** planned. Verbatim extraction, then helpers.
- **Sources:** runtime-root-a-09, runtime-root-a-13

### TD-39: Render code, HawkerScene and Game construction trapped in the root

- **Score:** impact 4, risk 3, effort 3, giving priority **21**. **Category:** architecture. **Status:** resolved.
- **Justification:** There are 18 pure renderers, hidden closure reads of the accessibility settings, and a scene that mixes input, stepping and save policy.
- **Disposition:** planned. Leaves first (one module per commit), then the context types, then one stateful renderer group per commit, then the scene.
- **Sources:** runtime-root-b-03, runtime-root-b-04, runtime-root-b-05, runtime-root-b-14

### TD-40: dispatchCommand is a 370-line if-chain with a hand-maintained build guard

- **Score:** impact 4, risk 3, effort 3, giving priority **21**. **Category:** architecture. **Status:** resolved.
- **Justification:** A build command missing from isBuildCommand is rejected at runtime with no compile error. Unknown types are rejected at commands.ts:400.
- **Disposition:** planned. Moves, then a mapped-type router that keeps the 'Unsupported command' fallback via Object.hasOwn.
- **Sources:** core-sim-08, core-sim-09

### TD-41: Hand-written content types duplicate every Zod schema

- **Score:** impact 4, risk 3, effort 3, giving priority **21**. **Category:** architecture. **Status:** resolved.
- **Justification:** All 11 pairs are identical today and changed together in 4 of 4 content commits.
- **Disposition:** planned. Type-equality tests, then inferred types.
- **Sources:** content-tools-05, content-tools-07

### TD-42: Two production targets with no decision record; worker dead scaffold

- **Score:** impact 4, risk 3, effort 3, giving priority **21**. **Category:** architecture. **Status:** partially resolved.
- **Justification:** next dev, vinext build and next build run with no ADR. The worker's image branch uses an unconfigured binding.
- **Disposition:** planned. Pinned Worker config, both-target goldens and ADR 0005. The worker deletion is gated by D9, and header parity is deferred.
- **Outcome:** docs/DEPLOYMENT.md describes both targets as they exist, with no primary declared (S161). The goldens (S19), Worker pinning (S25) and the image-branch removal (S154) were descoped.
- **Sources:** build-deploy-deps-docs-06, build-deploy-deps-docs-17

### TD-43: Test tree does not mirror source; relative imports; duplicated step helpers

- **Score:** impact 3, risk 2, effort 2, giving priority **20**. **Category:** test. **Status:** done (Phase 1).
- **Justification:** 18 files sit flat in tests/, with 39 relative imports. runSteps is written 4 times and runUntil twice.
- **Disposition:** planned. Done first in Phase 1, so every new suite is created at its final path.
- **Sources:** tests-09, tests-10, tests-13, core-sim-14, core-rules-persistence-13, runtime-helpers-integrations-19, content-tools-12

### TD-44: Env and dev-flag reads scattered; service-worker protocol split across UI and integration

- **Score:** impact 3, risk 2, effort 2, giving priority **20**. **Category:** code. **Status:** partially resolved.
- **Justification:** NODE_ENV is read at HawkerSimulator.tsx:212, createHawkerRuntime.ts:904, registerPwa.ts:39 and next.config.ts:4.
- **Disposition:** planned. One module keeps the literal process.env.NODE_ENV so bundlers still inline it. The Node-side tool reads are documented exceptions.
- **Outcome:** `src/config/env.ts` centralises build mode and dev flags, and `registerPwa.ts` owns the worker protocol. S63 is partial: the Vercel (Turbopack) bundle still ships the unreachable dev-flag branches as dead text.
- **Sources:** runtime-root-a-14, react-ui-15, react-ui-16, runtime-helpers-integrations-07, build-deploy-deps-docs-12

### TD-45: Localisation assembly copied four times; merge without collision guard

- **Score:** impact 3, risk 2, effort 2, giving priority **20**. **Category:** code. **Status:** resolved.
- **Justification:** The strip-and-derive block is copied with void workarounds.
- **Disposition:** planned. Key strings and order are pinned by a golden.
- **Sources:** content-tools-06

### TD-46: Latent gameplay bugs: access-ID collisions, stale interaction after reset, raw-catalog queue trim, apron wrap, HUD cleanliness divergence

- **Score:** impact 2, risk 3, effort 2, giving priority **20**. **Category:** code. **Status:** deferred.
- **Justification:** Player-visible errors confirmed by probes.
- **Disposition:** deferred. Each fix alters digests or visuals. Characterisation (S13, S16) captures the current behaviour, and the fixes ship separately with an intentional re-baseline (D7).
- **Sources:** runtime-root-a-17, core-sim-06, runtime-root-b-11, runtime-root-a-13

### TD-47: Renderers choose art by substring-matching content IDs; tables have drifted

- **Score:** impact 3, risk 3, effort 3, giving priority **18**. **Category:** code. **Status:** resolved.
- **Justification:** There are 264 includes/has checks, and the two newest stalls fall back to generic art. Adding content silently gets generic art.
- **Disposition:** planned. Step 1 only (S121): ID-keyed tables that reproduce today's branch for every current ID, the substring fallback kept for unknown IDs, and a completeness test. New art for the generic stalls is deferred to an art-direction decision.
- **Outcome:** S121 added the ID-keyed tables with a completeness test. New art for Pick & Mix and Herbal Cauldron remains an art-direction decision.
- **Sources:** runtime-root-b-10

### TD-48: visualRecipes.ts is a 1,171-line four-domain module; three hex parsers

- **Score:** impact 2, risk 2, effort 2, giving priority **16**. **Category:** architecture. **Status:** resolved.
- **Justification:** About 500 lines of vendor code ship in the eager React chunk, and the colour parsers are copies.
- **Disposition:** planned. One destination module per commit. The parser dedupe is its own commit.
- **Sources:** runtime-root-b-06, runtime-root-b-12

### TD-49: validateCatalogInternal is a 235-line function

- **Score:** impact 2, risk 2, effort 2, giving priority **16**. **Category:** code. **Status:** resolved.
- **Justification:** It contains repeated identity and range checks.
- **Disposition:** planned. Rule groups in the same issue order. Catch narrowing is deferred and recorded.
- **Sources:** core-rules-persistence-11

### TD-50: Per-frame and per-tick recomputation of layout-only data

- **Score:** impact 2, risk 2, effort 2, giving priority **16**. **Category:** code. **Status:** deferred.
- **Justification:** findPath runs for every entrance-exit pair per HUD frame, Text objects are recreated per render, and a new Intl formatter is built per call.
- **Disposition:** deferred. Within budget today. Wrong cache keys risk visible regressions. Revisit with a benchmark (the SGD_FORMATTER hoist is kept in S130 because it is output-identical).
- **Sources:** runtime-root-a-19, runtime-root-b-08, runtime-root-b-09, core-sim-17, react-ui-13

### TD-51: Audit-only nutrition data ships in the client bundle

- **Score:** impact 2, risk 2, effort 2, giving priority **16**. **Category:** dependency. **Status:** deferred.
- **Justification:** It is 45% of the gzipped JSON.
- **Disposition:** deferred. It changes the NUTRITION_CONTENT shape and the sha-pin workflow.
- **Sources:** content-tools-07

### TD-52: 4,717-line append-only globals.css

- **Score:** impact 3, risk 2, effort 3, giving priority **15**. **Category:** infrastructure. **Status:** deferred.
- **Justification:** It is the second-largest merge hotspot, with the same selectors defined far apart (.catalogue-panel at 336 and 865).
- **Disposition:** deferred. A contiguous line split does not fix the scattered selectors and makes cascade order a cross-file concern. Only the CSS test consolidation (S24) is planned. A feature-grouped split with a cascade-order note can follow once the open branch is resolved.
- **Sources:** react-ui-17

### TD-53: simulation.ts is a 1,409-line, eight-concern hotspot; completeSale carries ~105 lines of nutrition bookkeeping

- **Score:** impact 4, risk 3, effort 4, giving priority **14**. **Category:** architecture. **Status:** resolved.
- **Justification:** It has the highest churn in core and clean seams. completeSale (771-943) duplicates recordIntentRequest bookkeeping.
- **Disposition:** planned. Verbatim moves, then the nutrition bookkeeping is extracted into core nutrition.ts, gated by the raw-string goldens.
- **Sources:** core-sim-03, core-sim-04, core-sim-11

### TD-54: 28 mutable closure variables shared implicitly by runCommand, handleTile, scene and controller

- **Score:** impact 4, risk 3, effort 4, giving priority **14**. **Category:** architecture. **Status:** resolved.
- **Justification:** Ownership is unclear, which blocks shrinking the root.
- **Disposition:** planned. The last runtime steps, split into hit-testing, handleTile and session. Side-effect order and the performance.now call positions are kept.
- **Sources:** runtime-root-a-16

### TD-55: Missing module and exported-function JSDoc across repo

- **Score:** impact 2, risk 1, effort 2, giving priority **12**. **Category:** documentation. **Status:** partially resolved.
- **Justification:** The global standard requires docstrings, and almost none exist.
- **Disposition:** planned. A scripted module-doc check with a shrink-only allowlist (S40) makes every new module documented at creation. A per-scope sweep empties the allowlist.
- **Outcome:** Every module and exported function in scope has JSDoc. The module-doc baseline holds one entry, `tools/stamp-service-worker.mjs`, which is out of scope (S169).
- **Sources:** runtime-root-a-18, runtime-root-b-14, runtime-helpers-integrations-18, core-sim-16, core-rules-persistence-14, content-tools-13, react-ui-18

### TD-56: No formatter configured

- **Score:** impact 2, risk 1, effort 3, giving priority **9**. **Category:** infrastructure. **Status:** partially resolved.
- **Justification:** The format-before-done rule has no TypeScript equivalent.
- **Disposition:** deferred. The full-repo sweep stays deferred (branch conflict, source-text tests), with .git-blame-ignore-revs when it happens. Conditional S41 (D6) adds Prettier, matched to the current style, for newly authored code only.
- **Outcome:** Prettier 3.9.9 is configured for newly authored files (S41). The full-repo sweep stays deferred.
- **Sources:** build-deploy-deps-docs-19

### TD-57: Unused Tailwind utilities and a 3 MB og.png

- **Score:** impact 1, risk 1, effort 2, giving priority **8**. **Category:** dependency. **Status:** rejected.
- **Justification:** Tailwind acts only as a CSS reset.
- **Disposition:** rejected. Removing preflight changes rendering. Asset recompression is not code debt.
- **Sources:** build-deploy-deps-docs-18, build-deploy-deps-docs-20

### TD-58: Proposed churn that does not pay for itself

- **Score:** impact 1, risk 1, effort 3, giving priority **6**. **Category:** architecture. **Status:** rejected.
- **Justification:** Proposals were to rename persistence to storage, split saveStore, name about 450 one-off art literals, move utility tuning into content, give each tool its own file, and rename the moved kebab-case tests.
- **Disposition:** rejected. Little maintenance gain for the churn. A separate render/furniture.ts and render/fittings.ts are also rejected in favour of a single render/objects.ts.
- **Sources:** runtime-helpers-integrations-14, runtime-helpers-integrations-02, runtime-root-b-07, runtime-helpers-integrations-13

## Partial steps and open follow-ups

These parts of the refactor were left partial on purpose. Each is worth its own change.

| Step | What is missing | Why |
|---|---|---|
| S63 | The Vercel bundle (`.next/static`) still ships the unreachable `visualQa` and `debug` branches as dead text. The Vinext bundle drops them. | Turbopack does not inline constants across modules. Removing them needs either a literal `process.env.NODE_ENV` at each call site (against the rule that build mode is read only through `src/config/env.ts`) or Turbopack define config in `next.config.ts`. The branches cannot run. |
| S89 | `RuntimeController.exportState()` and `RuntimeOptions.onPersistentChange` are still typed `unknown`, not `RuntimePersistentState`. | Typing them breaks typecheck in the golden `tests/app/game/HawkerSimulator.test.ts`, whose fake controller passes `unknown` and `{ marker }` values, so its harness types would need adapting. |
| S132 | There is no `useFocusTrap(ref, { deps })` hook: callers use `install_focus_trap(container, options)` from their own `useEffect`. | A hook taking caller-supplied deps fails `react-hooks/exhaustive-deps` under `--max-warnings=0`; keeping the effect at the call site also preserves the animation-frame order. |
| S141 | The "exposes unknown nutrition intent" content check was kept. | It is reachable (a duplicated intent makes it fire), so a test pins it instead. |
| S169 | The module-doc baseline in `tests/module-docs.test.ts` still lists `tools/stamp-service-worker.mjs`. | That tool was out of scope for the refactor; give it a module header when it is next changed, then delete the baseline. |

Other follow-ups:

- The `app/` ban on a static `createHawkerRuntime` import matches only the `@/` alias. `import/no-restricted-paths` would also flag type imports and the legitimate dynamic import in `app/game/hooks.ts`, so the gap is documented in `docs/TECHNICAL_DESIGN.md` instead.
- Pin the `finite` versus `safeInteger` reader choice in `parse_metric_amounts` with a fractional-total fixture.
- Export `DEFAULT_REFUND_RATE` and use it at the two `?? 0.5` refund defaults in `src/game/core/build.ts` and `undo.ts`, which were kept byte-identical when they moved out of `commands.ts`.
- Use `clone_progression` and `clone_access_points` in `persistentStateFromGame` too.
- Several modules that are mostly moved code (`preferences.ts`, `catalogue.tsx`, `dialogs.tsx`, `content/rules.ts`, `tools/nutrition/csv.mjs`, `tools/nutrition/ratings.mjs`) do not pass `format:check`, because moved code was never reformatted.
- The pinned behaviour defects (TD-06, TD-36, TD-46, identical yong tau foo variant cues, generic art for the two newest stalls) are recorded in [KNOWN_ISSUES.md](KNOWN_ISSUES.md). Fixing any of them changes a golden on purpose.

## Descoped by the user (future work)

On 2026-10-17 the user limited this effort to a structural refactor. The following steps from the audit plan are not part of it, and each one is worth a separate change:

- **S01**: Add contributor conventions for naming, layering and commits (register: TD-31)
- **S02**: Normalise text files to LF (register: TD-21)
- **S06**: Add opt-in v8 coverage reporting (register: TD-20)
- **S19**: Add normalised full-document and header goldens for both build outputs (register: TD-04, TD-42)
- **S25**: Pin Worker name and compatibility date (register: TD-17, TD-42)
- **S26**: Raise vulnerable postcss and js-yaml overrides to patched exact versions (register: TD-17)
- **S27**: Upgrade next and eslint-config-next to 16.4.2 (register: TD-17)
- **S28**: Upgrade React and react-server-dom-webpack to 19.3.1 (register: TD-17)
- **S29**: Upgrade vitest to 4.1.12 (register: TD-17)
- **S30**: Upgrade wrangler and @cloudflare/vite-plugin (register: TD-17)
- **S31**: Gate CI on the production-dependency audit (register: TD-17, TD-32)
- **S38**: Pin one Node version for CI and local work (register: TD-21, TD-32)
- **S39**: Declare the npm version used to produce the lockfile (register: TD-21)
- **S64**: Expose the stamp tool as type-checked functions behind a main guard (register: TD-15, TD-30)
- **S65**: Hash POSIX paths and fail on unexpected filesystem errors (register: TD-15, TD-29)
- **S66**: Read the BUILD_ID version prefix from package.json (register: TD-15)
- **S67**: Characterize service-worker fetch and message handling (register: TD-15, TD-29)
- **S68**: Generate public/sw.js from a tracked template (register: TD-15)
- **S69**: Log errors swallowed by the service worker (register: TD-29)
- **S140**: Report nutrition profiles that belong to no dish variant (register: TD-14)
- **S149**: Wire empty content-ID alias and refund tables into save loading (register: TD-34)
- **S151**: Report the real output path and reject flags without values (register: TD-16)
- **S152**: Make the smoke tool importable and test it by behaviour (register: TD-33)
- **S153**: Share the deployed shell invariants between smoke and SSR checks (register: TD-33)
- **S154**: Remove the unused image optimisation branch (register: TD-42, TD-10)
- **S155**: Add a verify script matching the CI gate (register: TD-32)
- **S156**: Add grouped weekly dependency updates (register: TD-32)
- **S157**: Scope deploy secrets to the steps that need them (register: TD-32)
- **S163**: Add commands, golden workflow and feature checklists (register: TD-31)

The largest of these is that CI on `main` is red at the `npm audit --audit-level=high` step: as of 2026-10-17 there is 1 critical advisory (next, fixed in 16.4.2) and 23 high ones. Some of them need major-version upgrades, such as vinext 1.x and eslint-config-next. Handle this as its own dependency change, separately from the refactor.
