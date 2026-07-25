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

Status: implementation, critical remediation, integrated validation, and owner-only private preview publication complete.

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

Private preview: owner-only, successfully deployed from combined Stage 2/3 commit `7b83560040b1efa389325ad9b8942e51ecea4f8a`.

## Stage 3 — Combo Board and meal composition

Status: implementation, independent remediation, integrated validation, and owner-only private preview publication complete.

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

Private preview: owner-only, successfully deployed from combined Stage 2/3 commit `7b83560040b1efa389325ad9b8942e51ecea4f8a`.

## Stage 4 — parties, regulars, and neighbourhood events

Status: implementation, comprehensive validation, critical review, responsive browser review, and owner-only private preview publication complete.

### Implemented contracts

- Core V7/runtime V5 persists the people-and-events layer without changing canonical integer-cent SGD money. The immediately preceding Core V6/runtime V4 preview migrates additively: existing active visits remain single guests, existing periods, ledgers, objectives, forecasts, variants, and Combo Board state are retained, and no companion or regular history is invented.
- Authored demand uses the four established period profiles, eight deterministic neighbourhood events, and six recurring fictional regulars. At most one event may occur in a period and two in a day. Event selection and resolution are seed-stable, and event modifiers may affect volume, SGD budgets, preferences, party mix, or meal composition but never condition-aware incidence.
- An event with a service choice pauses planning, exposes the complete forecast modifier in plain language, accepts one untimed response, and freezes that response for the period. Dismissing the choice applies its documented neutral result and preserves the player’s prior speed intent.
- Parties of up to six are represented by one canonical visible leader with rendered companions, one route, and one queue footprint. Each member retains an independently sampled SGD budget, visit needs, order, frozen serving terms, nutrition result, service state, and tray-return decision; preparation load, sale, ingredient cost, nutrition, experience, and service outcomes remain per guest.
- Whole-party order planning is deterministic, atomic, and limited to two stall stops. An invalid joint plan falls back deterministically to feasible single meals. If a later stop becomes unreachable, already served members settle normally while unserved components create no sale or experience and the debrief records an explicit partial-party cause.
- Seating first reserves a suitable cluster atomically. Accessibility requirements are hard constraints. Only after exactly 40% of party patience has elapsed may the nearest valid adjacent-table split be used, and production adjacency is path-validated so a wall cannot make geometrically close tables a valid split.
- Regular encounter count and four-step story progress persist independently from each visit’s resampled condition-aware needs. Regular identity, story, appearance, persona, event, and neighbourhood theme never assign a health condition.
- The player-facing layer adds a focus-contained event dialog with an explicit neutral action, full event modifiers in the forecast, party member budgets and orders in Focus, a regular story gallery in Insights, companion rendering in the world, and party/event/regular causes in the debrief.

### Critical code, gameplay, and experience review

The Stage 4 implementation review corrected several high-risk integration details before the comprehensive gate:

- Canonical party persistence stores one live customer entity plus the party lifecycle rather than serializing companion customers as duplicate simulation actors. Strict V7 parsing rejects forged event counters, aliased seats, contradictory party states, and non-canonical companion entities.
- A party that cannot yet form a valid current-menu plan remains a deterministic pending party and exits through an explicit unserved path; save/reload cannot silently remove it or award money or experience.
- Party watchdog settlement expands the leader outcome across every member. Each served guest receives the documented timeout result and cents settlement, every unserved guest receives no sale or experience, and the entire party is then cleaned up atomically.
- Table splitting now consumes path-validated mutual adjacency supplied by production seating geometry. This closes the visual-versus-routing mismatch in which two tables could appear nearby in coordinates while being separated by an obstacle.
- Active-guest totals count party members rather than only visible leaders, while route and queue occupancy remain atomic. This keeps forecast, debrief, and capacity explanations aligned with the player’s visible party.
- Event UI uses a semantic modal, contains keyboard focus, makes the game background inert, offers Escape as the documented neutral resolution, and presents operational effects without linking a story or identity to health status.
- Authored event preference changes previously risked collapsing into the same broad scoring tier. The reviewed implementation applies exact keyed deltas, so `+24` and `+34` produce materially distinct deterministic choice pressure. The calculation consumes no gameplay random-number draws and never changes condition-aware incidence.
- Party Combo Board routing previously sorted placed stall-instance identifiers instead of preserving the frozen main-to-complement sequence. The planner now evaluates both two-stop orientations, accepts only orders compatible with one shared sequence, preserves main-first service even when instance identifiers sort side-first, and deterministically rejects mutually contradictory two-stop plans.
- The responsive cascade could allow header, clock, dock, catalogue, and modal layers to compete for the same short-viewport space. Breakpoint-specific containment, wrapping, stacking, and internal scrolling now keep those regions distinct at desktop, tablet, phone, enlarged-text, and combined-scale layouts.
- Browser fixtures are deterministic and non-persisting. `visualQa` establishes a stable planning view, while `visualQaEvent` establishes a stable Lunch event-decision view without writing fixture state into a player save.
- Same-origin framing is permitted only by the development response headers used for exact viewport and zoom emulation. Production retains `frame-ancestors 'none'` and `X-Frame-Options: DENY`.

The reviewed interaction arc remains legible: planning first explains the event and its operational consequence, service shows a party as one social group while retaining member-level decisions, recurring guests reveal story progress without turning health needs into identity, and the debrief connects those outcomes to service causes. The responsive review found no remaining shell overlap or containment blocker. Qualified human review of narrative tone, cultural detail, assistive-technology behavior, and long-session engagement remains an external release gate.

### Comprehensive validation completed

- `npm run typecheck`: passed for the integrated Stage 4 working source.
- `npm run lint`: passed with no warnings.
- `npm test`: 51 files and 407 tests passed, including the focused strategic, event, persistence, live-party, responsive, compatibility, and all prior-stage regressions.
- Live-party simulation coverage includes seed stability, one-leader/one-queue representation, Combo Board participation, two-stop settlement, in-flight save/reload equivalence, per-guest cent and watchdog settlement, temporarily full-queue waiting, and complete cleanup of unserved companions.
- Persistence coverage verifies Core V6 to V7 and runtime V1–V4 to V5 migration, unchanged SGD cents, exact V5 writes, canonical regular/event/party round trips, and rejection of forged states.
- Deterministic coverage verifies six-member limits, at-most-two-stop order plans, reversed-ID main-first Combo Board service, rejection of contradictory stop orders, atomic accessible seating, the exact 40% split threshold, path-validated adjacency, four normalized period profiles, eight condition-neutral events, exact keyed preference deltas, and six independent recurring stories.
- `npm run validate:content`: 17 content checks passed.
- `npm run test:ssr`: 2 SSR checks passed.
- `npm run build`: passed under the supported bundled Node.js 24 runtime. The recorded client chunk larger than 500 kB remains a known performance warning rather than a build failure. Both production targets used service-worker source stamp `2e6e7bc52161`.
- `npm run build:vercel`: passed under the supported bundled Node.js 24 runtime.
- `git diff --check`: passed.

### Responsive, graphical, and accessibility evidence

The DOM and renderer contracts for the event decision, visible companions, party-service detail, regular gallery, and expanded debrief are implemented. Focus containment, inert-background semantics, explicit neutral dismissal, and human-readable modifier labels received both source/test review and browser inspection.

The reviewed planning interface is clean at 1280×720, 1024×640, 800×720, and 390×844. The event modal was inspected at 1280×720, 1024×640, 390×844, and combined scale. Separate passes covered 200% in-game text, effective 200% browser zoom through a 640×360 same-origin iframe scaled to a 1280×720 physical frame, and combined 200% text plus effective 200% zoom. Across these checks there was no application-root horizontal overflow, no observed product-UI collision, and no meaningful informational text below 0.75rem.

The effective zoom technique is deterministic engineering emulation, not a substitute for the final actual-browser 200% zoom pass. A same-input comparison with the user’s 1908×1072 overlap reference confirmed that the prior header, action-strip, catalogue, and dock collision is absent in the reviewed planning layout; dynamic simulation state necessarily differs between captures. The development-only frame allowance used for these checks is not shipped: production continues to deny framing.

### Food and nutrition provenance

Stage 4 adds, removes, renames, substitutes, or materially changes no food or preparation, and no event or regular story requires a new dish. The working diff leaves `tools/nutrition/manifest.mjs` and `src/content/nutrition.generated.json` unchanged. The authoritative read-only CSV remains unchanged at SHA-256 `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`; all existing serving mappings, missing values, and trace values retain their Stage 3 interpretation.

### Publication and remaining external gates

- The private preview was built from and records source commit `796c1a731d932f90a804ccdc097d4f606cbaee04`, then deployed successfully to the owner-only site.
- Preview access was re-verified immediately before deployment: the current user is the sole allowed account, no groups are allowed, and unauthenticated requests correctly receive `401`. The exact committed source passed the complete local release gate and both production builds; content-level remote smoke requires a signed-in browser session and is not overstated here.
- Repeat zoom with an actual browser 200% control during the final cross-stage review; the Stage 4 pass used a precisely sized same-origin emulation.
- Retain qualified screen-reader, clinical-language, Singapore cultural, sensitivity, human-balance, and production-performance review as external release gates.

Private preview: owner-only, successfully deployed from `796c1a731d932f90a804ccdc097d4f606cbaee04`.

## Stage 5 — scenarios, mastery, and meta progression

Status: implementation, adversarial code/gameplay review, deterministic balance evidence, responsive engineering review, and the complete working-source gate are complete. The Stage 5 commit and owner-only preview version remain pending.

### Implemented contracts

- Five level-three scenarios are isolated from the main centre: Narrow Aisles, Split Hall, Limited Cash, Menu Diversity, and Peak Throughput. Each has an authored map, deterministic seed, starting SGD cents, exact unlock set, fixed reviewed menu, operational modifiers, medal thresholds, and its own scenario save scope.
- A scenario ends only at its first authored period debrief. The executable state projects the scenario's exact dishes and selected preparation identifiers as available while locking every non-scenario dish, then reapplies those constraints on restore so main-centre progression cannot leak into or out of the run.
- Scenario telemetry is bound to the scenario identifier, run identifier, and period sequence. It records exact waits, satisfaction, flow time, zone completion, preparation roles, minimum cash, contribution, refunds, recovery, and cent reconciliation without reading mutable post-order menu state. A completed scenario save is rejected if its required telemetry is missing, stale, or bound to another run.
- Medal evaluation exposes the complete score breakdown, exact next-medal score shortfall, and any remaining controlled-wait, completion, flow, zone-balance, contribution, or menu-diversity constraint. It awards only validated cumulative medals and cosmetics; no scenario result can change main cash, experience, reputation, objectives, or unlocks.
- IndexedDB V2 separates the main save, scenario slots, `MetaProgressionV1`, and preferences. Export bundle V3 validates every contained save and meta record before any import mutation. Main reset preserves medals, titles, and cosmetics while clearing stale active-contract state; the separately confirmed erase-all path clears main, scenario, and meta progress but preserves settings.
- One exclusive local-data operation gate serializes save, scope switch, import, export, reset, erase, scenario restart, and return-to-main work. Meta writes use a single promise queue that is drained before dependent scope changes, exports, resets, and erasure, so a late autosave or reward write cannot resurrect stale progress.
- Twelve mastery templates unlock at level 13. Breakfast derives three deterministic feasible choices, one may be accepted or skipped, and choices rotate every seven in-game days. Targets and duration freeze at acceptance, every period debrief is processed idempotently once, and rewards remain titles or cosmetics. When the uncompleted pool cannot supply three offers, completed choices are retained but clearly labelled as repeats.
- Mastery progress uses finalized debrief values rather than approximated live counters. Party targets count only fully served, normally completed party visits; Clean Ledger excludes inactive periods; distinct-preparation, forecast-fit, Combo Board, tray-return, flow, wait, satisfaction, sales, contribution, and completion targets all preserve their authored guardrails.
- The Challenges experience presents scenario cards, current saves, best medals, mastery offers and progress, a meta gallery, scoped import/export, restart, preserved-meta reset, and erase-all. Restart is an explicit focus-contained confirmation; returning from a scenario or skipping a contract restores focus to the invoking control.
- The refreshed social-preview card is registered in `docs/ASSET_PROVENANCE.md` and shipped as `public/og.png`. It uses exact Hawker Balance title/tagline copy, contains no real brands or medical/currency marks, and has documented generation, dimensions, hash, and outstanding human review.

### Critical code, gameplay, learning, and experience review

The Stage 5 adversarial review found and corrected material persistence, scoring, content, and interface risks before the final gate:

- Independent save, switch, reset, and import handlers could previously overlap. A single operation gate now disables the affected interface, awaits pending core and meta writes, and restores controls only after a truthful durable outcome is known.
- A successful import or erase could be followed by a recovery error that implied the committed mutation had failed. Post-commit recovery is now reported separately: the player is told that the previous local progress was replaced or erased, while any reload/reinitialization problem receives its own retry guidance.
- Main reset could clear the centre before its preserved-meta cleanup was durably written. The UI now enters a retry-required state and never claims complete reset until that final meta write succeeds.
- Scenario medal persistence raced the debrief-to-main transition and could be duplicated by repeated renders. Reward recording is idempotent, queued once, awaited before the scope switch, and preserves a previously earned better medal.
- Scenario service initially froze a base dish identifier even after a selected preparation changed. Scenario setup and restored orders now keep the exact active preparation identifier, and executable evidence covers both reviewed-base and selected-variant sales.
- Scenario menu construction once inherited main-centre dish availability, leaving an authored scenario dish unusable despite appearing in the briefing. Scenario state now exposes exactly the fixed reviewed scenario dishes at scenario level one and rejects substituted menus on restore.
- Partial or stale telemetry could be mistaken for a finished result at debrief. The terminal boundary, telemetry completeness, ledger reconciliation, and period binding are now validated together before scoring or reward mutation.
- Medal feedback originally showed only a score and medal. The debrief now explains every score component, the exact next threshold and shortfall, deduplicated blocker guidance, and a truthful “record result and return” action only after completion.
- Restart originally acted immediately and could strand keyboard focus. It now requires an alert-dialog confirmation with contained Tab/Shift+Tab/Escape behavior, preserves earned meta rewards, and restores focus to the active scenario card on dismissal or completion.
- The Challenges sheet could compete with the dock and page scroll at short or enlarged viewports. Its flex items now allow shrinkage, the sheet owns one contained vertical scroller, fixed confirmations scroll within the viewport, and action rows wrap without covering content.
- Repeated mastery choices were visually indistinguishable from new learning opportunities, party counters included incomplete party visits, and an inactive period could count toward Clean Ledger. Repeat labels, finalized full-party counting, and active-period ledger eligibility now match the player-facing contract.
- Careful Service, Short Waits, and Tray Team initially allowed one favourable observation plus empty periods to satisfy an end-of-contract guardrail. Their frozen contracts now require modest participation in every eligible period, persist the qualifying period sequence IDs, reject low-sample completion, and explain the requirement in offer, active, and outcome views.
- Terminal scenario telemetry originally accepted aggregates that could exceed the retained core outcomes, making forged extra visits or inflated path/flow totals scoreable after import. Scenario restore now binds arrivals, completed visits including served watchdog timeouts, path metrics, and qualifying flow back to the exact core period state.
- Page-hide capture could race a committed import, reset, or erase and write the detached pre-operation runtime back into storage. Destructive operations now invalidate the old controller before committing and suppress lifecycle capture throughout the exclusive operation.
- Structurally valid but contradictory meta bundles could claim completed mastery, rewards, medals, or keepsakes that did not agree. Whole-bundle semantic validation now rejects unsatisfied completion, rotation mismatch, completion/reward mismatch, and missing cumulative scenario cosmetics before any mutation.
- Menu Craft feasibility counted authored but locked preparations. The runtime now supplies the exact reachable unlocked preparation set to the offer filter.
- Health and condition-aware ratings could remain numeric even when too much source data was missing. The importer and runtime now require the rating's primary nutrient fields and at least 7,500 of 10,000 weighted known-data basis points; otherwise the rating is explicitly unavailable. Trace and missing values are never converted to zero or neutral scores. This is a conservative engineering completeness rule, not clinical validation.

The resulting engagement arc is coherent: scenarios turn the established service systems into focused strategy problems, debriefs explain why a strategy earned its outcome and what to try next, mastery contracts extend the main-centre loop without currency inflation, and the gallery preserves recognition across resets. This remains an internal expert review rather than proof of educational efficacy or clinical correctness.

### Executable scenario and economy evidence

- `tests/core/scenario-simulation-evidence.test.ts` drives real scenario commands, state transitions, service, drain, ledgers, telemetry, and evaluation. For all five scenarios, a competent first strategy earns exactly Bronze, a deliberate optimization earns exactly Silver, and two materially different legal layouts earn Gold. Repeating the same seeded strategy produces the same state, report, score, and medal.
- The focused scenario/state/telemetry gate passed 4 files and 61 tests. A separate UI/save focused gate passed 3 files and 23 tests, the Stage 5 persistence group passed 20 tests, the mastery qualification/UI/save gate passed 5 files and 66 tests, and the final adversarial code gate passed 6 files and 85 tests. These are additive focused results.
- `tests/core/mastery-contract-reachability.test.ts` uses the production catalogue and real level-13 service telemetry to prove all twelve authored templates reachable without retuning: 294 completed visits, S$1,741 gross, S$971.65 contribution, 79 minimum satisfaction, 23.4-second maximum median wait, 301 flow seconds, ten distinct preparations, 75 party visits, 84.6% tray returns, 45 forecast matches, three refund-free periods, and 33 Combo Board visits.
- `tests/core/final-economy-balance.test.ts` executes 30 unique deterministic service periods distributed across throughput-led, value-led, and nutrition-led strategies at levels 1, 5, 13, and 20. Every strategy/level cell is represented, every service period appears at every level, each setup is legally distinct, and all 30 ledgers reconcile with a zero-cent delta.
- Overall operating-margin distribution: p10 `46.9755%`, median `56.3295%`, p90 `58.7500%`.
- Throughput-led distribution: p10 `46.5385%`, median `56.6677%`, p90 `58.7337%`.
- Value-led distribution: p10 `46.9755%`, median `54.9160%`, p90 `58.7500%`.
- Nutrition-led distribution: p10 `50.2217%`, median `55.5063%`, p90 `57.7492%`.
- These results satisfy the programme's overall 45–60% median, per-strategy 40–65% median, and at-least-25% tenth-percentile contracts without changing production balance values to fit the fixture.

### Responsive, graphical, and accessibility evidence

Deterministic Stage 5 evidence is committed under `docs/images/`:

- `independent-review-stage5-challenges-1280x720.png`
- `independent-review-stage5-challenges-1024x640.png`
- `independent-review-stage5-challenges-800x720.png`
- `independent-review-stage5-challenges-390x844.png`
- `independent-review-stage5-text-200-1280x720.png`
- `independent-review-stage5-combined-scale-640x360.png`
- `independent-review-stage5-build-1909x1072.png`
- `independent-review-stage5-reference-comparison.png`

The deterministic Challenges view, meta gallery, wrapped action rows, contained restart confirmation, and dock separation were reviewed across the four required viewports. The root/body geometry reported zero horizontal overflow, and visible meaningful text was not below 0.75rem. The 200% in-game-text capture, effective 200% browser-zoom viewport, and combined containment capture remained usable with internal vertical scrolling instead of text or controls overlapping. The same-input comparison confirms that the header, map action strip, management sheet, catalogue, and dock no longer reproduce the supplied overlap reference.

These are engineering screenshots and DOM checks. The final full gate must still record the exact post-build browser result and must not treat effective viewport emulation as qualified assistive-technology or actual-browser zoom approval.

### Food, nutrition, and asset provenance

Stage 5 uses existing reviewed dishes only. Final tier tuning removes Soto ayam from the isolated Menu Diversity scenario's unlock set so the executable Bronze, Silver, and Gold strategies have distinct feasible preparation spreads; it does not remove or alter Soto ayam in the main centre. The authoritative read-only CSV remains unchanged at SHA-256 `1bc212db6eda06c29a5f8a1ddfe8a0ca82b02a71ffc34c07ced45d8b2f9b273e`. The curated `dish.soto-ayam` mapping was re-checked against one unique, case-sensitive `Food Name` row (`Soto ayam`, default serving `1 bowl(s) = 569g`, Lab Analysis), and its mapping and serving remain appropriate. `tools/nutrition/manifest.mjs` is unchanged. The derived `src/content/nutrition.generated.json` intentionally changes only rating-state/value fields to enforce source completeness; nutrient values, trace values, unavailable values, and other profile content are unchanged. The regenerated artifact SHA-256 is `0fa3e4fae448449fb2c6292df6960d3bf6e53d573a348bdc4192d982404defe7`.

The social-preview provenance row records `public/og.png` at 1730×909 with SHA-256 `47EF7F3217FC23844222806E1236E18F3A7D4D8938263520CB47EC0175D556B9`. The generated image received one text/composition inspection and required no retry; human brand-similarity and cultural review remain pending.

### Remaining final and external gates

- Final full-suite file/test totals: 63 files and 546 tests passed.
- Final content/SSR results: 17 content validations and two SSR assertions passed.
- Final Vinext and native Vercel builds passed with bundled Node 24.14.0 and shared service-worker stamp `d863122d476a`.
- Stage 5 commit and owner-only preview version/source record: pending.
- Final exact-production signed-in smoke, offline restart/update, storage-fault recovery, long-session performance/soak, and actual-browser 200% zoom remain release gates.
- Qualified screen-reader, clinical-language, Singapore cultural, sensitivity, narrative, human-balance, educational-efficacy, security, legal, and production-performance reviews remain external release gates.

Private preview: pending Stage 5 commit, saved preview version, owner-only deployment, and access verification.
