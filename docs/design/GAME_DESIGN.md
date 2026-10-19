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

### Day rhythm

Each operating day (10:30 to 18:30 on the in-game clock) follows the same readable shape, so the loop above has a daily plan-and-react cycle:

1. **Forecast.** Tomorrow's neighbourhood card is drawn at the start of today and shown as a forecast line, with a marker when the food writer is coming. It never changes once drawn.
2. **Plan.** Between rushes, or with the centre paused or in build mode, the player adjusts menus, recipe variants, seating, queues and tray returns for today's card and tomorrow's.
3. **Lunch rush.** Demand peaks around 12:30 and spreads about an hour either side; the HUD gives advance notice before each rush.
4. **Dinner rush.** A smaller crowd peaks around 17:15. Last orders fall at 18:10: no new guest arrives after that, and guests already inside finish their visit.
5. **Service Review.** When the day ends, the outgoing objectives are awarded and the day's report (grade word with a glyph, guests served and left early with the most common reason, takings, the weakest rating factor with one thing to try, the food writer's verdict, objectives completed and unlocks) becomes the Service Review, followed by the next day's card and objectives.

During a rush the arrival backpressure from crowding is halved, so a layout that cannot cope shows as visible queues and guests leaving early rather than silently fewer arrivals.

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

Arrive → Browse → Choose stall → Walk to queue → Queue → Order → Wait/collect → Choose and reserve seat → Walk to seat → Sit/eat → React → Return tray or leave it for the table-cleaning crew → Exit.

At every state, a missing or invalid target triggers bounded recovery: replan, choose an alternative, or leave with a clear reason. Reservations have owners and release on completion, cancellation, target movement, timeout, or despawn. Stuck detection retries a limited number of paths before a safe exit fallback. The visit cap ends a visit that has not reached its meal, but a seated guest always finishes eating and deals with their tray past the cap.

Stall score combines preference match, price, expected wait, Star-rated taste/popularity, stall quality/popularity, novelty, walking distance, and bounded fits for an optional nutrition intent and visit-specific health condition. Nutrition intents and conditions are assigned independently of persona, appearance, and demographics. An intent affects food choice and request reporting but not satisfaction; a condition uses its own Health rating when choosing a stall and dish, then applies a small frozen satisfaction change from the ordered meal. Neither system rewrites price, Star rating, preparation time, cash, experience, or reputation. Seat score combines path distance, group capacity, comfort preference, cleanliness, and congestion. Player-facing reason chips expose the strongest positive and negative terms; exact hidden arithmetic is not required for casual play.

### Queues, service, and seating

- Queue slots are authored from a queue anchor and direction and cannot block the service point.
- Reservations prevent overtaking and duplicate seat claims.
- Preparation is abstracted as capacity-limited service timers rather than ingredient micromanagement.
- Group members share a visit decision and require a compatible seat cluster; split seating is allowed only as a documented fallback.
- Tray return depends on the hall and on habit. A guest returns their tray only when a reachable tray return is within 14 path tiles of their seat and their persona's tray-return habit says so; the habit is read from a hash of the guest's ID, so it is stable per guest and draws no random number. It is a behavioural trait of the persona's visit goal, never framed as an ethnic or age trait, and player copy frames returning a tray positively rather than blaming guests who leave one.
- An unreturned tray stays on the seat, and no one can sit there until the table-cleaning crew clears it. The crew is one member plus one per tray-return station, each clearing the oldest waiting tray first in about 25 seconds, faster near cleaning utilities. Diners seated beside an uncleared tray rate the hall as less clean, and the HUD seating card counts the seats waiting for clearing, so the remedy (more or closer tray returns) is readable. The crew is visible in the hall: uniformed members walk from their tray-return stations to each tray being cleared, wipe the table, and carry the tray back.

### Satisfaction and diagnostics

Satisfaction is a bounded weighted score from value, wait, food quality, walking burden, comfort, cleanliness, ambience, and, only for a customer with a health condition, a -0.2 to +0.2 meal-fit adjustment. A departure records a primary reason on the visit rating: served, gave up in a long queue, no stall with room or within budget, nothing to order within budget, served but found no free seat, ran out of time before sitting down (the visit cap), or left for another reason (abandoned). The Service Review counts every reason other than served as leaving early, names the most common one, and the HUD offers corrective hints.

Nutrition is reported in a parallel daily Pulse. It tracks profiled servings, fictional request outcomes, and nutrient averages with separate known-value denominators. Each reviewed serving displays a general 1-to-5 Health rating, condition-specific 1-to-5 ratings, and the dish family's separate 1-to-5 Star rating. Health ratings are comparative game scores within the available meal or drink profiles, not a universal judgement or medical recommendation. Daily guidance is contextual only; matching uses relative comparisons among reviewed in-game servings.

At most one of high cholesterol, obesity, diabetes, or hypertension is assigned to an eligible visit. High-cholesterol fit emphasizes saturated, trans, and total fat with fibre and energy signals; obesity fit emphasizes energy, total and saturated fat, total sugar, fibre, and protein; diabetes fit emphasizes carbohydrate, total sugar, fibre, energy, and protein; and hypertension fit emphasizes sodium with supporting energy, saturated-fat, fibre, and protein signals. The customer inspector explains the nutrients considered and states that the trait is not a diagnosis.

Critical information always has text or icon/shape feedback. Customer bubbles are persistent status summaries, and the Settings icon guide provides a text equivalent.

### Neighbourhood calendar

Each centre has a seeded neighbourhood that gives every day an identity. Day 1 is a fixed opening day; every later day draws one of nine fictional, activity-based day cards (such as an office move-in week, a school sports day, a community football final, a heatwave or a monsoon shower) from a shuffle bag, so every card appears once before any repeats and no card runs on two days in a row. A card scales arrivals, the lunch and dinner peaks, which personas are out, which dish categories appeal more and how long guests linger; the rush times also shift by up to 15 minutes from day to day. The cards and their effects are listed in [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md#neighbourhood-calendar).

A director keeps a smoothed measure of recent day performance and tilts the draw by card intensity: after strong days livelier cards become more likely, after rough days calmer ones. Every draw comes from a stream seeded by the centre's world seed, the system and the day, so the same centre always gets the same calendar.

### Food writer and Writer's Pick

From day 3, a food writer from a fictional neighbourhood paper may be scheduled for tomorrow (a fixed chance, at least three days apart), and the forecast says so a day ahead. On the day, the writer reviews one placed stall (open or not, so closing stalls cannot steer the choice), preferring stalls without a plaque, over the lunch window (sales from 12:00 to 14:00, settled at 14:30). With at least three counted visits whose average score meets the threshold, the stall earns a permanent Writer's Pick plaque, which adds a small popularity bonus in stall choice and never changes arrivals. A miss, or too few visits, costs nothing, and the writer returns on a later day. Plaques form a collection with no missable entries: any stall can earn one on a later visit.

### Daily objectives

Day 1 uses fixed objectives. From day 2, the day's stream picks one service objective (serve a number of guests or earn a sum) and one quality objective (happiness, queue flow, serving guests from several stalls, or tray returns, the last two offered only when the centre can attempt them), alongside the nutrition objective. Targets follow what the centre showed it could do the day before, within fixed floors; see [ECONOMY_AND_PROGRESSION.md](ECONOMY_AND_PROGRESSION.md#objectives).

### How the day systems respect the design principles

- **Telegraphed.** Tomorrow's card and the food writer's visit are shown a day ahead and never change once drawn; rushes are announced before they start, and last orders is a fixed time.
- **No fail state.** A rough day lowers live reputation and the next day's demand but never relocks content, removes items or costs cash; a missed plaque or objective costs nothing; the director eases off after rough days.
- **No timed exclusivity.** No card or plaque is available only once. Every card returns in a later bag, every stall can earn a plaque on a later visit, and objectives are optional guidance.
- **Independent of demographics.** Cards describe activities and weather, never who people are; persona weights change by visit goal, and health conditions stay independent of personas and cards. Tray-return habit is a per-guest hash of a persona's visit habit, not an identity trait.
- **Local and offline.** The calendar is authored content drawn from a local seed. It is not a live event, needs no network or remote configuration, and is not in conflict with the live-events non-goal.

### Progression and failure policy

Cash buys placeables, stalls, upgrades, and expansions. Experience unlocks levels through ordinary play. Live reputation is a smoothed average of recent visit ratings and drives arrival demand, so it rises and falls with service. Every reputation unlock gate reads peak reputation, the highest live reputation the centre has reached, so a poor day never relocks content. New stalls beyond the starter stalls are also offered by stall tender, one every few operating days (see [ECONOMY_AND_PROGRESSION.md](ECONOMY_AND_PROGRESSION.md#unlock-curve)), so the hall grows at a pace its takings can fund. There is no premium currency and no real-time waiting.

The player cannot enter a hard fail state: starter essentials are protected from accidental sale or can be reclaimed; a recovery grant is available after an affordability check; operating costs cannot silently drive cash below zero; and objectives never require a single irreversible layout.

### Tutorial

The first-session tutorial teaches camera, place a table and seats, place a stall, inspect reachability, open, follow one customer, read one bottleneck, save, and reopen build mode. A separately persisted nutrition tour teaches Menu Planning and customer inspection without replaying the legacy tutorial. Each tour has Skip and Replay.

### Difficulty and quality modes

Difficulty comes from denser arrival patterns, varied preferences, and competing spatial goals—not punitive timers. Standard quality targets 60 FPS with normal effects and crowd animation. Lower-end quality targets 30 FPS with reduced particles, decorative motion, audio concurrency, and off-screen update frequency; game rules and rewards remain identical.

### Launch acceptance

The roster is defined in [CONTENT_CATALOGUE.md](CONTENT_CATALOGUE.md). Exact balance is provisional until seeded simulation tests and human playtests demonstrate a viable opening, midgame, and end-state. No design section should be marked final based on data presence alone.
