# Independent review implementation record

Status: In progress on `independent-review-strategic-gameplay`

This record tracks implementation of the independent gameplay review without changing the review document itself. Work proceeds continuously through five reviewed private-preview stages: service/economy, forecast/variants, meal composition, people/events, and scenarios/mastery.

## Locked implementation rules

- Use SGD everywhere; canonical game money is integer cents and no premium or purchasable currency exists.
- Treat `data/food_nutrition_sgfoodid_combined_nutrition_subset.csv` as the read-only authoritative candidate-selection source for every added or materially changed food or preparation.
- Preserve exact authored mappings, serving provenance, `Trace`, and unavailable values. Runtime fuzzy matching and invented nutrient values remain prohibited.
- Publish a private preview after each comprehensive stage review and continue immediately. Concurrent feedback must be resolved before final completion.
- Before each preview, critically review the integrated code and gameplay, all UI and graphical components at the required scales, and the continuity, pacing, clarity, and engagement of the player-facing story flow; fix material issues before proceeding.
- Preserve local-first saves, unrelated untracked data, and `docs/INDEPENDENT_GAME_REVIEW.md` outside implementation commits.

## Baseline at tracked `origin/main`

Baseline commit: `06ac46f577d6c665453fda3aeca071b68458448c`

- TypeScript, content validation, SSR, Vinext build, and native Next.js/Vercel build passed.
- The full suite passed 180 of 181 tests. The only failure was the pre-existing byte-hash expectation for `src/content/nutrition.generated.json`: tracked bytes hash to `3e240bed0da30acaf35f60aa24e28176820d90b68d464d13b54fe3813e8a7f6e`, while the test expected `f733b693e44a7767074bd84d263e357fcfd2ac7212e30ad388afc4cc7c5e580c`.
- The initial lint invocation exceeded the two-minute baseline window without reporting a lint diagnostic; later stage reviews must rerun it with an adequate timeout.
- Both production builds reported the existing large-client-chunk warning. This is recorded as a performance review item, not treated as a build failure.

## Evidence policy

Each stage must record automated validation, save migration coverage, deterministic fixtures, responsive browser evidence, accessibility checks, nutrition provenance results, known limits, and the private preview URL. Automated evidence is not a claim of clinical, cultural, screen-reader, or production approval.

## Stage 1 — service rhythm, SGD economy, progression, and objectives

Status: complete and published as an owner-only private preview.

### Implemented contracts

- Four authored service periods now use 240 seconds of arrivals, cohort-preserving drain, a 180-second watchdog, a frozen closing clock, and a debrief before the next planning period.
- Canonical money, customer budgets, purchases, resale, ingredient costs, upkeep, objectives, milestones, recovery, and ledger movement use integer SGD cents. Player-facing amounts use `S$`; detailed reconciliation uses `SGD`.
- Period ledgers preserve opening cash and separately report gross sales, ingredient costs, refunds, regular and overtime upkeep, purchases, resale, objective rewards, milestone rewards, recovery, contribution, actual cash movement, and reconciliation delta.
- Orders persist immutable arrival-period attribution and frozen serving terms. Active visits, including a draining cohort, survive save/reload and retain their original settlement terms.
- Runtime V3/core V5 migration treats each legacy unit as SGD 1.00 exactly once, retains overflow experience and valid unlocks, preserves the greater saved/authored level, and prevents retroactive milestone claims.
- Objective offers provide three feasible choices and one board-wide Skip. Targets and rewards freeze on acceptance; Skip remains available after acceptance. Flow capacity counts open stalls only.
- Configuration commands, including undo, reject layout, menu, variant, route, and placement mutations during arrivals and drain. Pause, speed, inspection, and stall shutter controls remain available.
- Per-stall upkeep uses authored rates and actual open time. One labelled overtime charge is possible after 60 seconds of drain. Recovery is episode-bounded, capped at S$650, and can restore zero-resale starter essentials without creating a resale exploit.
- The debrief is a modal, focus-contained semantic dialog with outcomes and a cause summary before the ledger and a persistently visible next-period action. Enlarged text switches to a compact map-plus-sheet layout; structural rows grow with copy and horizontal scrolling is deliberate for narrow tool/dock strips.
- First-run guidance finishes before breakfast begins: the nutrition guide cannot run over an active arrival cohort, large-text tutorials reflow to a one-column scrollable composition, and title-first focus remains contained in both tab directions.
- Compact layouts expose every authored speed (Pause, 1×, 2×, 4×, and 10×) through a 44-pixel-minimum select control instead of removing moderate pacing choices.

### Automated and deterministic validation

- `npm run typecheck`: passed.
- `npm run lint`: passed with no warnings.
- `npm test`: 36 files and 251 tests passed in the isolated Stage 1 tree, including dedicated Stage 1 audit regressions.
- `npm run validate:content`: 17 content checks passed.
- Core audit coverage includes authored-level migration, accepted-objective Skip, cents-first affordability, frozen order settlement after reload/content changes, drain-cohort reload/watchdog finalisation, cash-to-ledger reconciliation, recovery episode/zero-resale guards, and per-stall open-time upkeep.
- A fixed 30-seed standard-service fixture records a deterministic drain p95 of 3.8 seconds, below the 120-second target; the 180-second watchdog remains a separate hard limit.
- `npm run test:ssr`: 2 SSR checks passed.
- Native Next.js/Vercel and Vinext builds passed. Both retain the baseline large-client-chunk warning; no build failed.
- `git diff --check` passed. The service-worker source stamp is `6c9f072bd9b2` for both build targets.

### Critical code, gameplay, and experience review

The independent end-of-stage review found and resolved every material Stage 1 issue before preview:

- Core service could previously enter drain early through a public helper; it now rejects drain until exactly 240,000 milliseconds of arrivals have elapsed.
- Removed-content migration compensation could desynchronise the active ledger; the migration boundary now rebases opening cash and round-trips with a zero-cent reconciliation delta.
- First breakfast could begin behind the nutrition guide; onboarding now completes its decision context before service starts, while replays return safely to the centre.
- The 720-pixel debrief hid causes and its only continuation action below the fold; the cause summary now appears before the ledger and the action remains outside the scrolling report.
- The tutorial clipped at 200% text and opened mid-copy under combined scale; its large-text composition now begins at the focused title, scrolls vertically, hides nonessential art, and keeps Shift+Tab inside the modal.
- Small terracotta labels failed normal-text contrast. Text now uses `#b34534`, automatically verified at 4.5:1 or better on both cream and paper, while the brighter token remains available for decorative fills.
- Phone layouts removed 2× and 4× speed. A compact selector now preserves all speeds without recreating the header overlap shown in the original review screenshot.

The final independent code/gameplay and player-experience audits reported no remaining Stage 1 blockers. The service loop, explanatory progression, first-run story order, and period-to-debrief pacing are coherent for this stage; Stage 2 must deepen cause explanations by connecting forecast expectations with actual results.

### Responsive and scale evidence

Browser geometry and screenshots were checked at 1280×720, 1024×640, 800×720, and 390×844 at both 100% and 200% in-game text. Required views reported no product-UI collisions, no application horizontal overflow, and no meaningful text below 0.75rem. The narrow tool row and bottom dock deliberately scroll within their own containers. Evidence includes planning, live service, title-first onboarding, and a debrief with a persistent continuation action under `work/evidence/stage1/`; it is intentionally not committed as application source.

An effective 200% browser-zoom check used a 640×360 CSS viewport representing a 1280×720 physical viewport, with a separate combined 200% text plus effective 200% browser-zoom check. Both reported zero control-group collisions and no application horizontal overflow; the application remains vertically scrollable at that extreme and the tutorial begins at its title. This emulation is engineering evidence only and does not replace the actual-browser zoom pass in the final cross-stage review. The black `N` badge in local captures is the Next.js development overlay, not game UI; private-preview evidence must confirm that it is absent.

### Food and nutrition provenance

Stage 1 adds no food, preparation name, serving, or nutrient value. Operational preparation terms revalidate every existing nutrition profile and provenance record without deriving ingredient costs from nutrition. The authoritative source remains the read-only `data/food_nutrition_sgfoodid_combined_nutrition_subset.csv` snapshot with SHA-256 `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`; the source file is unchanged, and missing/trace states remain preserved.

### Known external gates

Automated browser and accessibility evidence is not qualified screen-reader, clinical-language, cultural, sensitivity, human balance, or production-performance approval. Those reviews remain external release gates.

Private preview: Hawker Simulator — Stage 1. The access gate is restricted to the configured owner; the preview was built from reviewed commit `4b2e56574d970b2486ad2fe66a5f001bb039cc9e`.

## Stage 2 — forecast, preparation trade-offs, and guided learning

Status: implementation, critical remediation, and integrated validation complete; private preview packaging pending.

### Implemented contracts

- Every period now receives an immutable deterministic forecast with a sampled arrival target, crowd mix, SGD budget bands, group-size mix, latent meal mix, nutrition-intent incidence, independently sampled condition-aware incidence, and menu-dependent coverage. Forecast generation is pure and does not consume or perturb gameplay random-number state.
- The audience is frozen by arrival-period sequence and persists through save/reload. Menu edits and stall shutters change only the displayed coverage calculation; they cannot rewrite the expected crowd, budgets, latent needs, or sampled target. Planning coverage counts preparations on currently open placed stalls, while the closing snapshot is frozen through drain and debrief. A preceding-preview save already in drain or debrief freezes its best reconstructable saved open-stall coverage once on load and immediately checkpoints that additive normalization.
- Arrival tuples use persisted sequence keys and the forecast budget bands. The live Breakfast starter profile is 48–60 visits with every sampled budget able to afford at least one unlocked active starter preparation.
- Fresh centres use the reviewed nine-seat starter layout. Earlier saves preserve their exact six-seat or customized layouts; no furniture is injected during migration. When a restored layout has fewer seats than the reviewed starter, a load-time warning reports its actual seat count, the current forecast range, and the precise planning shortfall.
- Required need references are guarded by two distinct unlocked, released, viable responses. Progression, placement, and prerequisite checks prevent inaccessible preparations from making an objective or guide appear feasible.
- Every preparation has immutable SGD price, ingredient cost, preparation time, handover time, eating time, Star appeal, demand modifier, nutrition fit, and an explicit operational rationale. In-flight order snapshots preserve those terms and outcome explanations across later content or menu changes.
- All 64 preparations in nutrition variant families use explicit semantic operational mappings instead of list-position arithmetic. Price premiums are bounded, ingredient rates remain within the reviewed band, and the deterministic context matrix gives every preparation at least one plausible winning context across the full comparison axes.
- The optional What’s new guide presents two real unlocked preparations against one forecast need, records a no-penalty prediction, and reveals one strict benefit and one strict trade-off for either choice. Existing tutorial completion remains preserved.
- The debrief follows forecast → result → causes → ledger, separating nutrition-intent and condition-aware denominators and reporting unknown data without imputation. It gives one deterministic next-period action from the leading menu gap, wait issue, or satisfaction cause.
- Compact and expanded forecast language distinguishes actionable current signals from future meal composition. Continuously changing HUD values are not live regions; a single atomic announcer is reserved for meaningful period transitions and objective outcomes.

### Critical code, balance, and experience review

The end-of-stage review rejected two superficially green implementations before preview:

- The first balance fixture overrode its own demand and budgets while production still used an unaffordable 84–100-visit Breakfast. The test now exercises production defaults directly and proves each arrival has an affordable active response.
- Drain tuning initially shortened food timings without explaining the actual tail. State-duration instrumentation showed late visits spent up to 48.8 seconds seeking one of only six seats. Three reachable starter stools were added around the existing table clusters; no hidden pre-closing blackout or weakened target was used.
- The legacy 120-second visit cap interrupted already served guests while eating or returning trays, even though the programme assigns served incomplete outcomes to the 180-second drain watchdog. The cap now applies only while unserved; served visits finish normally or receive the explicit watchdog result.
- Index-derived preparation terms had made later-listed dishes automatically pricier, faster, and more attractive, including implausible rice-only, prata, and vegetable comparisons. A reviewed semantic mapping replaced that pattern, with bounded terms and authored rationales.
- The guided reveal could call an equal fit a benefit and lacked benefit explanations for ingredient cost and demand. Pair selection and copy now require strict, explainable advantages for both choices.
- Continuously changing service clocks, guest totals, seats, and cash were exposed as polite live regions. They are now ordinary status data so screen-reader users receive deliberate transition announcements rather than a stream of competing updates.
- Forecast coverage initially treated every placed stall as active even while its shutter was closed. Planning coverage now distinguishes unlocked viability from currently open responses, and closing coverage freezes once for drain and debrief. The same one-time normalization runs for both startup restoration and explicit import of preceding-preview drain/debrief saves.
- The first 1024-pixel production capture clipped Access and hid Route. The map toolbar now grows to two rows at that breakpoint, while narrow and enlarged interfaces retain all five controls with visible overflow or a wrapped large-text grid.
- Camera-edge labels could leave a single clipped letter at 800 and 390 pixels. Informational canvas labels are now drawn only when their complete measured bounds remain inside the camera with a scale-aware gap.
- Compact management originally looked selected while its sheet was closed and declared itself modal while background controls remained operable. It is now a true focus-contained dialog with an internal six-section switcher, inert background chrome, explicit launcher state, Escape/close focus restoration, and no hidden current selection.
- Production browser review exposed root and backdrop scroll ranges derived from nested catalogue and settings scrollers. The viewport, game shell, and modal layers now contain overflow at the correct boundary; Help and Settings each have one intended internal scroller, short viewports scroll inside the game shell, and large-text headers keep their close controls fully inside.

On the 30 fixed production Breakfast seeds, the reviewed starter setup records a median 53 arrivals and 53 completions, median peak 20 active guests, median peak queue depth 3, all ledgers reconciled to the cent, and drain p95 117.1 seconds with a maximum of 118.1 seconds. This is below the 120-second target without watchdog completions.

### Food and nutrition provenance

Stage 2 changes operational serving terms but adds, removes, renames, substitutes, or remaps no food and changes no nutrient value or serving interpretation. Every existing mapping was rechecked against the exact case-sensitive authoritative CSV row. The source CSV, `tools/nutrition/manifest.mjs`, and `src/content/nutrition.generated.json` remain byte-for-byte unchanged; the authoritative snapshot SHA-256 remains `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`. Missing and trace values remain distinct.

### Validation, responsive evidence, and known limits

- `npm run typecheck`: passed.
- `npm run lint`: passed with no warnings.
- `npm test`: 42 files and 316 tests passed, including deterministic forecast purity, production-default balance, frozen order terms and coverage, preceding-preview import parity, watchdog progression, responsive modal behavior, and canvas label containment.
- `npm run validate:content`: 17 content checks passed.
- `npm run test:ssr`: 2 SSR checks passed.
- Vinext and native Next.js/Vercel production builds passed. The Cloudflare Worker build retains the recorded large-client-chunk warning; no build failed. The final service-worker source stamp is `cbd69370265e`.
- `git diff --check` passed. The authoritative CSV hash remained `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`, and the CSV, curated manifest, and generated nutrition artifact have zero diff.

Production-browser review covered 1280×720, 1024×640, 800×720, and 390×844 planning; predict and reveal guidance; compact management; true 200% in-game text in Settings, Help, and Reset; and an effective combined 200% browser/text-scale viewport. It found the toolbar clipping, camera-edge fragment, hidden-sheet semantics, focus-return failure, root overflow, double modal scrollbars, and clipped large-text Help close control described above; each was corrected with a focused regression before the release gate passed. Evidence is stored under `work/evidence/stage2/` and is intentionally not committed as application source.

The development browser security layer refused the final fresh localhost origin after those last containment changes, so the exact post-remediation multi-viewport recapture could not be repeated in that browser session. The final CSS/interaction contracts are covered by 38 focused responsive tests and the full suite, and the private preview render will be inspected after publication. This is recorded as an evidence limitation rather than presented as qualified visual or accessibility approval. Actual browser zoom at 200% remains part of the final cross-stage review; Stage 2 used the 640×360 effective-viewport check in addition to true 200% in-game text.

Canvas portal and fixture labels use collision-aware placement at enlarged text, and the Next.js development badge is disabled so it cannot obscure the compact dock or contaminate evidence.

Automated accessibility and browser evidence remains engineering validation rather than qualified screen-reader, clinical-language, cultural, sensitivity, human-balance, or production-performance approval.

Private preview: pending.

## Stage 3 — Combo Board and meal composition

Status: implementation, independent remediation, and integrated validation complete; private preview packaging pending.

### Implemented contracts

- Core V6/runtime V4 introduces a persisted three-slot Combo Board at level 5. Each valid offer freezes exactly one reviewed main and one reviewed drink, dessert, or add-on, with no discount and no more than two reachable stall stops.
- Offer validation rejects missing releases, incompatible meal roles, duplicate components, unavailable stalls, unreachable stops, and service-time edits. A referenced dish cannot be removed from its menu, while losing a compatible stall leaves an explicit repairable warning instead of silently deleting the offer.
- Frozen combo orders preserve each component's preparation, service, price, ingredient cost, nutrition snapshot, meal-balance score, intent fit, and explanation codes. Later menu, variant, content, or board changes cannot rewrite an in-flight order or its ledger result.
- Two-stall service selects reachable stall instances deterministically. A temporarily full second queue is retried; a genuinely unavailable second stall settles the served main only, cancels the unserved component without charge, and records a cause-coded partial meal.
- Combined nutrients are conservative. A component with unavailable data makes the combined metric unavailable, and trace values remain trace rather than becoming fabricated zeroes. Meal balance compares against the fixed universe of unlocked feasible singles and valid pairs, using the same reviewed directions and weights as the generated Health-rating pipeline.
- The planner keeps Meal balance, component change, intent fit, and condition-aware game fit as separate concepts. Copy explicitly avoids universal-health or treatment claims, and every component keeps its own listed-serving context.
- One visit awards visit XP and reputation once, while every distinct serving stall receives its valid mastery credit. Same-stall offers do not duplicate stall mastery.
- Planning, service inspection, customer detail, partial-meal causes, and debrief summaries expose the frozen composition without allowing service-time mutation.

### Critical code, gameplay, and experience review

The independent Stage 3 review found and corrected the following material issues before preview:

- A valid Combo Board could persist but never participate in ordinary meal selection. Deterministic order selection now considers eligible offers and is covered through the real spawned-customer path.
- A full second queue was incorrectly treated as a missing stall and immediately produced a partial meal. Capacity pressure now defers and retries; only an actual reachability or availability loss cancels the second component.
- Nutrition comparison code converted trace measurements to numeric zero. The importer and meal-composition pipeline now rank only known values and preserve trace/unavailable states through generated content.
- Runtime restoration applied the saved Combo Board before restoring saved preparation variants, so a valid non-default combination could fail startup or import validation. Runtime envelopes now restore and validate variants and menus before the board, with startup/import parity regressions.
- Empty saved stall menus could invalidate the authored core catalogue. Runtime catalogue projection now falls back to the stall's authored dish set when a saved menu is absent or empty, without inventing unlocks.
- Two-stall offers credited mastery only to the main stall. The frozen visit now records unique served stall-definition identifiers and awards each exactly once while preserving one visit-level XP result.
- Persisted combo lifecycles accepted contradictory served/cancelled states and duplicate mastery identifiers. V6 parsing now rejects impossible lifecycle, spend, and duplicate-set combinations.
- Debrief completion initially counted partial offers as completed. Full and partial combo outcomes now use separate frozen causes and totals.
- Live shutter warnings did not explain that a configured second stop had become unavailable. The planner and debrief now report the affected offer and repair action explicitly.
- The phone header retained a one-pixel-clipped brand title after the wider layout collision was removed. The 480-pixel breakpoint now hides secondary brand copy and fits the complete primary title beside compact speed and help controls.

The resulting planning story is coherent: forecast need leads to an exact two-item offer, the player sees cost, fit, and route consequences before service, the visit preserves those terms, and the debrief explains full or partial fulfilment without turning nutrition into a universal score.

### Food and nutrition provenance

Stage 3 reviews every meal-role assignment and changes one serving interpretation: `Siew Mai` is presented as `Three Siew Mai` and maps to the unique case-sensitive authoritative row `Siew mai` (row 1803) using a documented three-serving, 90 g curated multiplier. Its game visual now renders three recognisable pieces. No nutrient value is invented.

The read-only authoritative CSV is unchanged at SHA-256 `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`. The curated manifest records the source name, mapping kind, serving multiplier/label, and review rationale. Regenerated `src/content/nutrition.generated.json` hashes to `d69662acf1e462abd9b7db4f96a1977a3cdc7c4f87daed072fc23dd8809a046b`; unique-row, serving, quarantine, provenance, trace, unavailable, and generated-diff checks pass.

### Validation, responsive evidence, and known limits

- `npm run typecheck`: passed.
- `npm run lint`: passed with no warnings.
- `npm test`: 46 files and 358 tests passed sequentially. Focused Stage 3 coverage passed 76 tests across meal composition, selection, settlement, persistence, responsive UI, and runtime-envelope restoration.
- The production-default level-one balance fixture and forecast-integration matrix passed in isolation after their deliberate long-running timeouts were raised to match the measured deterministic workload; no gameplay threshold was weakened.
- `npm run validate:content`: 17 content checks passed.
- `npm run test:ssr`: 2 SSR checks passed.
- Vinext and native Next.js/Vercel builds passed. The recorded large-client-chunk warning remains a known production-performance review item, not a build failure. The service-worker source stamp is `98420145d6c1`.
- `git diff --check` passed, and the authoritative source CSV remained byte-for-byte unchanged.

Fresh browser evidence covered the unlocked Combo Board at 1280×720, 1024×640, 800×720, and 390×844. The original and current 1280×720 views were reviewed side by side: the current header, period state, map tools, objectives, management sheet, action strip, and dock no longer collide. All four current viewports reported no application horizontal overflow and no visible informational text below 0.75rem; the compact sheet owns its vertical scroll and the narrow dock deliberately exposes horizontal scrolling. The browser console reported no warnings or errors.

The Stage 3 large-text Combo Board layout is covered by focused 200% regression tests and reuses the Stage 2 shell that received a true 200% browser pass. During this final Stage 3 recapture, the browser automation layer focused the native range control but did not change its value, so this pass does not falsely claim a second successful native-slider interaction. True 200% in-game text, true 200% browser zoom, and the combined containment spot-check remain mandatory in the final cross-stage browser gate.

Automated accessibility and browser evidence remains engineering validation rather than qualified screen-reader, clinical-language, cultural, sensitivity, human-balance, or production-performance approval.

Private preview: pending.
