# Game Design Document

Status: Release-candidate design baseline; values remain subject to browser playtesting and human review
Related: PRODUCT_BRIEF.md, CONTENT_CATALOGUE.md, ECONOMY_AND_PROGRESSION.md

## Player fantasy and core loop

The player grows a compact community dining room into a busy, distinctive hawker centre:

1. Inspect the next period's menu-independent forecast, event modifiers, queues, seating, cleanliness, nutrition needs, and route overlays.
2. Build or rearrange stalls, tables, facilities, and decorations on a square grid.
3. Configure each stall’s active menu, reviewed preparation trade-offs, and optional Combo Board offers within its unlocks.
4. Accept or skip an optional target-frozen objective, then open the period and watch solo guests and parties complete visits.
5. Drain the original cohort, reconcile the SGD ledger, and read forecast matches, service causes, nutrition trade-offs, event/regular beats, and diagnostics.
6. Buy upgrades, unlock content, expand the floor, pursue scenarios or mastery contracts, and iterate.

A normal session supports short planning/debrief check-ins and longer optimization sessions. Pause and speed controls remain available during service. Menu, preparation, layout, and Combo Board mutations are accepted only during planning; inspection remains available during service and drain.

## Modes and controls

Play mode runs the current service period. Planning exposes build controls, footprints, and interaction cells and supports place, rotate, move, store, sell, cancel, and undo. During arrivals and drain, the catalogue remains inspectable but configuration commands are rejected; stall open/close, pause, and speed controls remain available. The Route editor is planning-only and lets the player toggle preferred walking-lane tiles with the pointer or keyboard. Inspect mode opens a stall, customer, party, seat, or facility card. Overlay controls show walkability, congestion, queues, reservations, cleanliness, and customer intent.

Required controls:

- Primary pointer: select/place; secondary pointer or Escape: cancel.
- Wheel or explicit controls: zoom; middle drag, space-drag, or arrow keys: pan.
- R: rotate; B: build mode; Z or Ctrl/Cmd+Z: undo; Space: pause.
- Tab/Shift+Tab, arrows, Enter/Space, and Escape provide complete DOM UI navigation.
- Every drag operation has select-then-move controls.

## World and placement

The map uses an orthographic top-down square grid. A placeable is valid only when its rotated footprint is in the unlocked area, does not overlap blocking cells, preserves at least one entrance-to-stall and entrance-to-exit path, and leaves required interaction points reachable. Placement previews communicate valid, occupied, locked, and unreachable states with shape plus color.

Build commands are atomic and reversible. Moving a live target releases or redirects reservations before committing. Preferred route guides bias path cost rather than becoming mandatory waypoints, so guests can still reach a valid target when a painted lane is incomplete. Guides reserve their floor tiles from blocking furniture and queues, invalidate cached paths safely, persist with the layout, and support multi-step undo.

## Customer lifecycle

State transitions are explicit:

Arrive → Browse → Choose stall → Walk to queue → Queue → Order → Wait/collect → Choose and reserve seat → Walk to seat → Sit/eat → React → Return tray or clear → Exit.

At every state, a missing or invalid target triggers bounded recovery: replan, choose an alternative, or leave with a clear reason. Reservations have owners and release on completion, cancellation, target movement, timeout, or despawn. Stuck detection retries a limited number of paths before a safe exit fallback.

Stall score combines preference match, price, expected wait, preparation-specific Star appeal/demand, stall quality/popularity, novelty, walking distance, and bounded fits for an optional nutrition intent and visit-specific health condition. Nutrition intents and conditions are assigned independently of persona, appearance, regular identity, neighbourhood event, and demographics. An intent affects food choice and request reporting but not satisfaction; a condition uses its own Health rating when choosing a stall and preparation, then applies a small frozen satisfaction change from the ordered meal. Nutrition data never derives operational price, cost, or timing. Seat score combines path distance, party capacity, member preferences, cleanliness, and congestion. Player-facing reason chips expose the strongest positive and negative terms; exact hidden arithmetic is not required for casual play.

## Queues, service, and seating

- Queue slots are authored from a queue anchor and direction and cannot block the service point.
- Reservations prevent overtaking and duplicate seat claims.
- Preparation is abstracted as capacity-limited service timers rather than ingredient micromanagement.
- A party of up to six uses one canonical routed leader and queue footprint while retaining member-level budgets, needs, orders, service, settlement, and tray decisions. Its deterministic order plan uses at most two stall stops.
- Suitable party seating is reserved atomically. After 40% of party patience is consumed, an explained deterministic split may use the nearest valid adjacent tables.
- Tray return is a member-level probabilistic action influenced by authored persona/regular terms, accessible return capacity, and walking distance, never framed as an ethnic or age trait.

## Satisfaction and diagnostics

Satisfaction is a bounded weighted score from value, wait, food quality, walking burden, comfort, cleanliness, ambience, and, only for a customer with a health condition, a -0.2 to +0.2 meal-fit adjustment. A departure records a primary reason such as served, queue too long, unaffordable, no reachable seat, stall unavailable, path blocked, or centre closed. The HUD summarizes these reasons and offers corrective hints.

Nutrition is reported in a parallel daily Pulse. It tracks profiled servings, fictional request outcomes, and nutrient averages with separate known-value denominators. Each reviewed serving displays a general and condition-aware in-game nutrient comparison only when source coverage passes the completeness gate; otherwise that comparison is unavailable. The dish family's separate 1-to-5 Star rating represents taste and popularity. The nutrition comparisons are limited game proxies within the available meal or drink profiles, not universal judgements, clinical suitability ratings, or medical recommendations. Daily guidance is contextual only; matching uses relative comparisons among reviewed in-game servings.

At most one of high cholesterol, obesity, diabetes, or hypertension is assigned to an eligible visit. High-cholesterol fit emphasizes saturated, trans, and total fat with fibre and energy signals; obesity fit emphasizes energy, total and saturated fat, total sugar, fibre, and protein; diabetes fit emphasizes carbohydrate, total sugar, fibre, energy, and protein; and hypertension fit emphasizes sodium with supporting energy, saturated-fat, fibre, and protein signals. The customer inspector explains the nutrients considered and states that the trait is not a diagnosis.

Critical information always has text or icon/shape feedback. Customer bubbles are persistent status summaries, and the Settings icon guide provides a text equivalent.

## Progression and failure policy

Cash buys placeables, stalls, upgrades, and expansions. Experience unlocks levels through ordinary play. Reputation reflects recent service and gates prestige content. There is no premium currency and no real-time waiting.

The player cannot enter a hard fail state: starter essentials are protected from accidental sale or can be reclaimed; a recovery grant is available after an affordability check; operating costs cannot silently drive cash below zero; and objectives never require a single irreversible layout.

The Combo Board unlocks at level 5. Five level-3 scenarios use isolated saves and award medals/cosmetics without changing the main centre. Twelve level-13 mastery templates rotate every seven in-game days, offer three feasible breakfast choices or Skip, freeze accepted targets, and award titles/cosmetics once. Completed templates can return only as labelled practice replays. Main reset preserves scenario saves and earned meta rewards; erase all is a separate confirmed action.

Eight seeded neighbourhood events can modify operational demand but never condition prevalence. Six recurring fictional regulars persist encounter/story progress while resampling condition-aware needs independently every visit. These light story beats remain optional and do not form a mandatory narrative campaign.

## Tutorial

The first-session tutorial teaches camera, place a table and seats, place a stall, inspect reachability, open, follow one customer, read one bottleneck, save, and return to planning. A separately persisted optional “What’s new” guide uses two real unlocked preparations and one forecast need: the player predicts a fit, then sees one benefit and one trade-off without penalty. Returning-player tutorial completion is preserved; guided material can be skipped or replayed.

## Difficulty and quality modes

Difficulty comes from denser period profiles, parties, event modifiers, scenario constraints, mastery targets, varied preferences, and competing spatial goals—not punitive real-world timers. Standard quality targets 60 FPS with normal effects and crowd animation. Lower-end quality targets 30 FPS with reduced particles, decorative motion, audio concurrency, and off-screen update frequency; game rules and rewards remain identical.

## Launch acceptance

The roster is defined in CONTENT_CATALOGUE.md. Exact balance is provisional until seeded simulation tests and human playtests demonstrate a viable opening, midgame, and end-state. No design section should be marked final based on data presence alone.
