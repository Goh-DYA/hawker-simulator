# Game Design

Status: Release-candidate product and design baseline; values remain subject to browser playtesting and human review
Product brief last updated: 2026-07-20
Release readiness: NO-GO pending exact-production browser/offline QA, publication evidence, and required human reviews
Related: [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md), [ECONOMY_AND_PROGRESSION.md](ECONOMY_AND_PROGRESSION.md)

## Product brief

### Product statement

Hawker Balance is an original, welcoming, single-player management and nutrition-education game about arranging and operating a fictional Singapore-inspired hawker centre. Players build on a square grid, choose stalls, menus, and reviewed recipe variants, observe customers move through a readable queue–order–seat–eat–return-tray lifecycle, and improve service while learning to compare nutrient trade-offs.

The game is for casual and simulation players aged 13+, launches free, requires no account, and keeps its core loop playable offline after the first successful load. There are no purchases, advertisements, loot boxes, energy systems, real-time waits, or pay-to-win systems in the launch scope.

### Experience goals

1. Creative ownership: layout and decoration create visible and systemic differences.
2. Readable simulation: every failed visit has a visible cause and useful remedy.
3. Meaningful optimization: distance, congestion, capacity, cleanliness, service, price, and ambience interact without enforcing one perfect layout.
4. Low-friction play: undo, recoverable economy, short feedback loops, and no irreversible traps.
5. Living atmosphere: purposeful movement, queues, eating, reactions, light motion, and restrained audio.
6. Respectful specificity: recognizable communal dining and food practices without copying real businesses or flattening cultures.
7. Practical nutrition literacy: compare listed servings, distinguish Health ratings from taste-and-popularity Star ratings, and understand condition-specific nutrient trade-offs without demographic assumptions or medical advice.

### Launch scope

- Desktop Chrome is the reference browser; Edge and Firefox are secondary targets.
- Mouse, trackpad, and keyboard are required. Touch is optional.
- One coherent map theme, orthographic top-down square-grid construction, pan, and zoom.
- Place, move, rotate, store, sell, remove, and undo placeable objects and stalls.
- Fourteen fictional stalls, 54 playable dishes, 80 meaningfully distinct placeables, and twelve behavior archetypes.
- A released source profile and Star rating for every dish, with 104 released nutrition profiles across 14 reviewed recipe-variant families.
- Overall Health ratings plus distinct high-cholesterol, obesity, diabetes, and hypertension ratings; optional visit conditions remain independent of customer archetype and demographics.
- Customer spawning, choice, pathfinding, queueing, ordering, preparation abstraction, seat reservation, eating, reactions, tray return where applicable, and departure.
- Cash, experience, reputation, unlocks, upgrades, objectives, and map expansion.
- Tutorial, settings, accessibility options, audio controls, local saves, and offline application shell.
- English localization. Multilingual environmental text is used only after translation review.

Content-counting rule: a catalogue entry counts only when it has a unique ID and a meaningful gameplay, footprint, interaction, unlock, or visual-construction difference. A palette-only recolour does not count.

### Explicit non-goals for 1.0

Accounts, cloud saves, multiplayer, chat, leaderboards, social visits, user-generated content, live events, analytics, payments, advertising, multiple themes, narrative campaign, medical or personalized dietary advice, ingredient-safety certification, staff scheduling, supply chains, and voice acting.

### Success and release gates

The release must pass the acceptance checklist in [RELEASE_CHECKLIST.md](../release/RELEASE_CHECKLIST.md). In particular:

- The complete customer lifecycle and build-mode recovery cases pass automated and browser tests.
- Content validators prove 14 / 54 / 80 / 12 counts, 320 English localization entries, 104 released profiles, 14 variant families, and no missing runtime references.
- IndexedDB recovery, save migrations, cache updates, and offline reload are verified.
- Measured performance meets an approved supported-customer cap in both quality tiers.
- Essential UI actions work by keyboard and do not rely on color or audio alone.
- Current stable desktop Chrome is tested and its exact version recorded.
- Human Singapore cultural review, qualified legal/privacy review, and independent security review are complete or explicitly waived by the accountable human owner.

The content `1.3.0` source contract, complete automated working-source gate, and both local production builds are recorded. Exact-production browser/offline validation, publication evidence, and all external review gates remain incomplete as of this document date.

### Product assumptions

- Solo-development sustainability takes priority over content excess.
- Art is code-native/procedural, shape-led illustrated 2D; it is not dependent on licensed sprite packs.
- Static/local-first operation is sufficient; no gameplay backend is required.
- Save format and content IDs become compatibility contracts once a public build ships.
- “Production-ready” is a measured release state, not a planning milestone.

## Game design

### Player fantasy and core loop

The player grows a compact community dining room into a busy, distinctive hawker centre:

1. Inspect demand, queues, seating, cleanliness, nutrition requests, and route overlays.
2. Build or rearrange stalls, tables, facilities, and decorations on a square grid.
3. Configure each stall’s active menu and reviewed recipe variant within its unlocks.
4. Open the centre and watch customers complete visits.
5. Read service reactions, nutrition trade-offs, and diagnostics; earn cash, experience, and reputation.
6. Buy upgrades, unlock content, expand the floor, and iterate.

A normal session supports five-minute check-ins and longer optimization sessions. Pausing and build mode stop consequential simulation changes.

### Modes and controls

Play mode runs the centre. Build mode pauses arrivals, exposes footprints and interaction cells, and supports place, rotate, move, store, sell, cancel, and undo. The Route editor pauses play and lets the player toggle preferred walking-lane tiles with the pointer or keyboard. Inspect mode opens a stall, customer, seat, or facility card. Overlay controls show walkability, congestion, queues, reservations, cleanliness, and customer intent.

Required controls:

- Primary pointer: select/place; secondary pointer or Escape: cancel.
- Wheel or explicit controls: zoom; middle drag, space-drag, or arrow keys: pan.
- R: rotate; B: build mode; Z or Ctrl/Cmd+Z: undo; Space: pause.
- Tab/Shift+Tab, arrows, Enter/Space, and Escape provide complete DOM UI navigation.
- Every drag operation has select-then-move controls.

### World and placement

The map uses an orthographic top-down square grid. A placeable is valid only when its rotated footprint is in the unlocked area, does not overlap blocking cells, preserves at least one entrance-to-stall and entrance-to-exit path, and leaves required interaction points reachable. Placement previews communicate valid, occupied, locked, and unreachable states with shape plus color.

Build commands are atomic and reversible. Moving a live target releases or redirects reservations before committing. Preferred route guides bias path cost rather than becoming mandatory waypoints, so guests can still reach a valid target when a painted lane is incomplete. Guides reserve their floor tiles from blocking furniture and queues, invalidate cached paths safely, persist with the layout, and support multi-step undo.

### Customer lifecycle

State transitions are explicit:

Arrive → Browse → Choose stall → Walk to queue → Queue → Order → Wait/collect → Choose and reserve seat → Walk to seat → Sit/eat → React → Return tray or clear → Exit.

At every state, a missing or invalid target triggers bounded recovery: replan, choose an alternative, or leave with a clear reason. Reservations have owners and release on completion, cancellation, target movement, timeout, or despawn. Stuck detection retries a limited number of paths before a safe exit fallback.

Stall score combines preference match, price, expected wait, Star-rated taste/popularity, stall quality/popularity, novelty, walking distance, and bounded fits for an optional nutrition intent and visit-specific health condition. Nutrition intents and conditions are assigned independently of persona, appearance, and demographics. An intent affects food choice and request reporting but not satisfaction; a condition uses its own Health rating when choosing a stall and dish, then applies a small frozen satisfaction change from the ordered meal. Neither system rewrites price, Star rating, preparation time, cash, experience, or reputation. Seat score combines path distance, group capacity, comfort preference, cleanliness, and congestion. Player-facing reason chips expose the strongest positive and negative terms; exact hidden arithmetic is not required for casual play.

### Queues, service, and seating

- Queue slots are authored from a queue anchor and direction and cannot block the service point.
- Reservations prevent overtaking and duplicate seat claims.
- Preparation is abstracted as capacity-limited service timers rather than ingredient micromanagement.
- Group members share a visit decision and require a compatible seat cluster; split seating is allowed only as a documented fallback.
- Tray return is a probabilistic customer action influenced by accessible return capacity and walking distance, never framed as an ethnic or age trait.

### Satisfaction and diagnostics

Satisfaction is a bounded weighted score from value, wait, food quality, walking burden, comfort, cleanliness, ambience, and, only for a customer with a health condition, a -0.2 to +0.2 meal-fit adjustment. A departure records a primary reason such as served, queue too long, unaffordable, no reachable seat, stall unavailable, path blocked, or centre closed. The HUD summarizes these reasons and offers corrective hints.

Nutrition is reported in a parallel daily Pulse. It tracks profiled servings, fictional request outcomes, and nutrient averages with separate known-value denominators. Each reviewed serving displays a general 1-to-5 Health rating, condition-specific 1-to-5 ratings, and the dish family's separate 1-to-5 Star rating. Health ratings are comparative game scores within the available meal or drink profiles, not a universal judgement or medical recommendation. Daily guidance is contextual only; matching uses relative comparisons among reviewed in-game servings.

At most one of high cholesterol, obesity, diabetes, or hypertension is assigned to an eligible visit. High-cholesterol fit emphasizes saturated, trans, and total fat with fibre and energy signals; obesity fit emphasizes energy, total and saturated fat, total sugar, fibre, and protein; diabetes fit emphasizes carbohydrate, total sugar, fibre, energy, and protein; and hypertension fit emphasizes sodium with supporting energy, saturated-fat, fibre, and protein signals. The customer inspector explains the nutrients considered and states that the trait is not a diagnosis.

Critical information always has text or icon/shape feedback. Customer bubbles are persistent status summaries, and the Settings icon guide provides a text equivalent.

### Progression and failure policy

Cash buys placeables, stalls, upgrades, and expansions. Experience unlocks levels through ordinary play. Reputation reflects recent service and gates prestige content. There is no premium currency and no real-time waiting.

The player cannot enter a hard fail state: starter essentials are protected from accidental sale or can be reclaimed; a recovery grant is available after an affordability check; operating costs cannot silently drive cash below zero; and objectives never require a single irreversible layout.

### Tutorial

The first-session tutorial teaches camera, place a table and seats, place a stall, inspect reachability, open, follow one customer, read one bottleneck, save, and reopen build mode. A separately persisted nutrition tour teaches Menu Planning and customer inspection without replaying the legacy tutorial. Each tour has Skip and Replay.

### Difficulty and quality modes

Difficulty comes from denser arrival patterns, varied preferences, and competing spatial goals—not punitive timers. Standard quality targets 60 FPS with normal effects and crowd animation. Lower-end quality targets 30 FPS with reduced particles, decorative motion, audio concurrency, and off-screen update frequency; game rules and rewards remain identical.

### Launch acceptance

The roster is defined in [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md). Exact balance is provisional until seeded simulation tests and human playtests demonstrate a viable opening, midgame, and end-state. No design section should be marked final based on data presence alone.
