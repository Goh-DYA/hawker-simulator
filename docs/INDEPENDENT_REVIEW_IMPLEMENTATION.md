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

Status: implementation, exact-source validation, and critical stage review complete; private preview pending.

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

Private preview: pending.
