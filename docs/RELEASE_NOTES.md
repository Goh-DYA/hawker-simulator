# Release Notes

## Unreleased — release candidate

Hawker Balance is a complete, free, local-first browser management and nutrition-education game candidate. It is not yet production-approved because exact-artifact real-browser/offline QA and required human reviews remain open.

### Playable launch scope

- Build and operate an original Singapore-inspired Community Courtyard using a top-down grid.
- Place, move, rotate, remove/sell, undo, and unlock 80 meaningfully distinct seating, facility, sign, greenery, lighting, cooling, tray/waste, floor, and utility definitions.
- Operate 14 fictional stalls and configure 54 dishes through per-stall menu slots, including Pick & Mix and Herbal Cauldron.
- Serve 12 customer archetypes through arrival, stall choice, queue, ordering, collection, reserved seating, dining, tray return, exit, and despawn.
- Paint saved preferred walking lanes that shift guest routes while retaining obstacle-safe fallback paths.
- Read live queue, cleanliness, seating, ambience, cash, reputation, level, objective, and diagnostic feedback.
- Expand the hall and progress through deterministic economy, XP, reputation, and unlock rules.
- Plan and debrief Breakfast, Lunch, Tea, and Evening as separate forecast-led service periods with integer-cent SGD reconciliation.
- Compare 104 released serving profiles through 14 recipe-variant families whose frozen operational terms expose price, ingredient cost, preparation/serving/eating time, Star appeal, and demand trade-offs. Visit XP remains independent of price.
- Configure level-5 Combo Board offers containing one main plus one side or drink, with no discount and at most two stall stops.
- Compare separate in-game nutrient comparisons and Star ratings across the reviewed menu. Star rating represents taste and popularity; source-supported overall and condition-aware values are comparative game proxies and become unavailable when evidence is incomplete.
- Serve customers with fictional visit-specific nutrition requests framed around high cholesterol, obesity, diabetes, or hypertension. Each request is independent of archetype and appearance, is not a diagnosis or prevalence estimate, increases preference for available better-fitting options, and applies only a small bounded satisfaction effect from the ordered meal.
- Serve visible parties of up to six, respond to eight seeded neighbourhood events, and follow six recurring fictional regulars. Condition-aware needs remain independent of regular identity and events.
- Play five isolated level-3 scenarios for medals/cosmetics and choose from twelve level-13 mastery templates for titles/cosmetics without changing main-centre rewards.
- Respond to fictional nutrition intents, inspect nutrient trade-offs, complete rotating nutrition objectives, and read current-day Nutrition Pulse analytics with an educational-not-medical-advice disclosure.

### Interface and accessibility engineering

- Semantic React controls surround the Phaser world for the catalogue, menus, settings, save tools, objectives, tutorials, Nutrition Lens, Variant Lab, customer inspector, Nutrition Pulse, and status.
- Pointer and keyboard camera/build controls, focus-managed dialogs, visible focus, Escape behavior, high contrast, reduced motion, text scaling, and separate audio controls are implemented.
- Important audio events have visual equivalents; unavailable audio/storage degrades with an explicit message.
- Standard and lower-end quality modes apply separate crowd/fixed-step/frame-rate limits.

### Saves and offline shell

- IndexedDB V2 stores checksummed active/backup main saves, isolated scenario saves, and separate meta progression with serialized writes.
- Core V7/runtime V5 migrations, newest-save backup recovery, content alias/refund recovery, nutrition variant fallback, V3 whole-progress export/import, preserved-meta main reset, and separately confirmed erase all are implemented.
- The PWA includes a manifest, offline fallback, deterministic content-derived cache ID, acknowledged runtime warming, and an explicit save-before-update activation flow.

### Automated evidence boundary

- The content `1.3.0` working-source contract requires 14 stalls, 54 dishes, 80 placeables, 12 archetypes, and 320 English localization entries.
- The nutrition contract requires 104 released profiles, 14 variant families with 64 selectable variants, a released base profile and Star rating for every dish, consistent known/unavailable rating states, provenance hashes, scaling, trace values, quarantine rules, deterministic generation, and incompatible guideline comparisons.
- The strategic contract adds four period profiles, eight events, six regulars, five scenarios, and twelve mastery templates with deterministic feasibility, migration, and reward-isolation checks.
- Deterministic simulation, grid/pathfinding, build/economy/progression, periods/drains, forecasts, Combo Board meals, parties, events, regulars, scenarios, mastery, persistence/migration/recovery, target reconciliation, and soak behavior have automated tests.
- Production-render checks assert the release shell, security headers, PWA update protocol, and absence of starter-facing copy.
- See `TEST_REPORT.md` for current working-source results and `PERFORMANCE_REPORT.md` for the historical pre-Stage-5 performance baseline and remaining browser-only measurements.

### Not yet approved

- Current stable Chrome critical path, Edge/Firefox smoke, viewport/zoom/console/network checks, browser FPS/memory/TTI, and the long browser soak.
- First-load/offline reload, offline restart/save, waiting-worker update, and rollback behavior on the exact production artifact and origin.
- Human Singapore cultural and accessibility/assistive-technology review.
- Independent security review and qualified legal/privacy review.

The package/cache may use `1.0.0` as an artifact identifier. It does not indicate release acceptance, certification, or compliance.
