# Economy and Progression

Status: Provisional balance specification; not playtest-validated

## Principles

- One earnable cash currency; no premium currency, purchases, advertisements, or real-time waits.
- Ordinary service always advances experience.
- Reputation communicates recent operational quality and cannot permanently lock the player out: unlocks read peak reputation, which never falls.
- Experimentation is cheap: full refund during placement preview, predictable resale, undo, and no hidden upkeep.
- A weak economy slows expansion but cannot end the game.

Amounts are Singapore dollars (SGD); dish prices follow 2025-26 heartland street prices (see [DISH_PRICE_SOURCES.csv](DISH_PRICE_SOURCES.csv)).

## Starting state and bands

- Starting cash: $4,200.
- Starting reputation: 8 / 100.
- Starter setup must include or make immediately affordable at least one level-1 stall, four seats, necessary tables/facilities, and an earning menu; granted items are not double-charged.
- Dish prices: $2–$20.
- Placeables: $35–$880.
- Stall purchases: $1,200–$4,700.
- Stall upgrades use authored level costs and service/capacity/quality/menu effects.
- Expansion bays: $1,000, $2,500, $5,000, then $9,000, each also reputation-gated.

These are tuning bands. Runtime data is authoritative after validation.

## Dish prices

Every dish costs its 2025-26 heartland street price for the served portion, in whole dollars: `max(2, round_half_up(street typical))`. The typical comes, in order of preference, from the Department of Statistics' 2025 annual average price for the item (tier `SS25`), then a dated stall menu or food guide (`DATED`), then an estimate derived from those, for example by portion or by parity with a priced sibling (`EST`). The $2 floor is the only exception to the rule, and it binds only where the street price rounds below it (kopi). [DISH_PRICE_SOURCES.csv](DISH_PRICE_SOURCES.csv) records each dish's typical, tier, source and any exception, and `tests/content/prices.test.ts` checks every price against it.

The review also fixed these parity rules, which the test asserts:

- Roast chicken rice and char siew rice cost the same as poached chicken rice.
- Kopi and teh tarik cost the same, and sugarcane juice costs more.
- Bak chor mee costs a dollar more than fishball mee pok.
- Babi pongteh costs more than ayam buah keluak, which costs more than chap chye, and nyonya laksa costs at least as much as each of those sides.
- Every dessert costs less than the cheapest noodle dish, and black pepper crab is the dearest dish.

Two price-health acceptance checks guard against charging for health. Re-check them whenever prices or the rating model change:

1. Across all dishes, the Spearman correlation between price and Health rating is at most zero. It is −0.33 today.
2. At least half of the dishes rated 3.5 or above cost no more than a Student Saver's mid budget ($6.50). Today 10 of 11 do.

## Visit settlement

Gross sale equals the menu price and is the whole contribution; there is no food cost or upkeep.

Satisfaction is 0–100 and combines food quality 30%, wait 20%, value 15%, route efficiency 10%, seating comfort 10%, cleanliness 10%, and ambience 5%. Route efficiency uses the full distance walked from entrance to exit: the first 20 tiles carry no penalty, an 80-tile journey scores 50, and journeys of 116 tiles or more floor at 20. Missing-seat or unserved departures use dedicated penalties rather than fabricated food scores.

Experience per sale is the price × (1 + quality/5) plus 2 service XP (`SERVICE_XP_PER_SALE`); the level curve is 100 × (level − 1)², owned by `calculateLevel` in `src/game/core/economy.ts`. Reputation is an exponentially weighted average of recent visit ratings: each rating maps to a target (0 at a score of 55, the full scale at 95) and closes 2% of the gap, so roughly the last fifty visits dominate and one bad visit is informative but not catastrophic. Live reputation drives arrival demand. Every reputation unlock gate (stalls, placeables, dishes and their menus, customer personas and nutrition intents) reads `progression.peakReputation` instead, the highest live reputation the centre has reached, so content unlocked once never locks again after a poor day. The wait component treats the first 40% of a guest's patience as free and then falls linearly to zero. Exact rounding is centralized and covered by unit tests.

## Unlock curve

| Phase | Levels | Player learning | Representative unlocks |
|---|---:|---|---|
| Starter | 1–3 | Build, service, tray return, first bottleneck | Sunrise Roost, Coconut & Lime, Kopi Canopy, Cinder Wok |
| Variety | 4–7 | Menu mix, group seating, queue design | Mee Pok Junction, Tiffin Lantern, Sweet Monsoon, Satay Meridian, Tamarind Leaf, first expansion |
| Optimization | 8–12 | Peak flow, ambience, upgrades | Bamboo Basket, Straits Hearth, Harbour Ember, advanced facilities |
| Mastery | 13–20 | Dense layouts and self-directed goals | premium families, final expansions, feature decorations |

Every required launch stall and catalogue item is earnable by level 20 without premium payment. Unlocks reveal no more than a manageable group at a time.

New stalls also arrive by **stall tender**, one at a time. Beyond the two starter stalls, the next stall licence is offered no earlier than operating day 2, 4, 6, 8, 10, 12, 14, 17, 20, 23, 26 and then 30, and every four days after that (`STALL_TENDER_DAYS` in `src/game/runtime/rules.ts`), on top of its level, reputation and prerequisite gates. Levels 2 to 4 and the first reputation gates are reached on day 1, while a day's takings are roughly a third to a half of a new stall's price, so without the tender three stalls unlocked at once and the player could not afford to open them. The tender is counted from how many tendered stalls are already unlocked, so it needs no saved state and never relocks a stall an older save already has. A centre that falls behind the schedule (for example one held back by reputation) catches up on each tender already due once the other gates are met. The Stalls panel labels a stall waiting only for its tender "Tender on day N", and the Next up signpost names it with the day it opens. Placeables and dishes are not tendered.

## Objectives

Objectives are optional guidance, not blockers. Each day has three: a service objective, a quality objective and a nutrition objective, each rewarding $80 plus $20 per level and 25 XP plus 5 per level. Day 1 (and any centre without a neighbourhood) uses the fixed templates, whose formulas are also the floors below. From day 2 the seeded neighbourhood's objective stream for the day picks the service objective (serve a count or earn a sum) and the quality objective (happiness, queue flow, variety or tray returns; variety needs at least three open stall types and tray returns at least one tray-return station), and draws one stretch factor from 95% to 115% that scales the previous day's Service Review:

| Objective | Seeded target | Floor |
|---|---|---|
| Serve | yesterday's guests served × stretch | 5 + 2 per level |
| Revenue | yesterday's takings × stretch | 35 + 8 per level, rounded |
| Happiness | yesterday's average visit score + 4 | clamped to 60–92 |
| Queue flow | 80% (fixed), measured only during a lunch or dinner rush | — |
| Variety | stalls that made a sale yesterday + 1, at most the open stall types | 3 |
| Tray returns | yesterday's tray returns × stretch | 4 |

Variety counts the stalls that made a sale today, recorded at the sale, so placing a stall and undoing it does not complete it and guests still finishing yesterday's meals do not count. Templates include serve a count, keep wait below a threshold, sustain satisfaction, offer a category mix, improve tray return, maintain clear paths, and complete a reversible build task. Each has seeded test fixtures and avoids requiring a specific cultural dish as a novelty stunt.

## Writer's Pick plaques

A food-writer visit reviews one placed stall's sales from 12:00 to 14:00 and settles at 14:30. With at least three counted visits, an average visit score at or above the threshold earns that stall a permanent Writer's Pick plaque. The threshold ladder is 68 for the first plaque plus 3 for each plaque already held, capped at 82 (68, 71, 74, 77, 80, then 82). A plaque adds 0.04 to the stall's popularity in stall choice only; it never changes arrivals, prices, cash or XP. A miss, or too few visits, costs nothing and leaves the threshold unchanged.

## Recovery safeguards

- Essential starter objects may be reclaimed for free if none remain.
- If cash is below the cheapest valid earning setup and no openable stall exists, grant $650 once per recovery condition and explain why.
- Selling returns 70% of base price; the confirmation shows resulting capability.
- A stall can always run at least one owned starter menu.
- Reset and new game require confirmation; import/export is a debug/support feature.
- No debt, bankruptcy timer, forced restart, or paid rescue.

## Balance acceptance

Before release, seeded simulation plus human playtests must demonstrate:

- A novice can reach level 3 without grinding or an unrecoverable placement.
- At least three materially different viable layout/menu strategies exist.
- No catalogue item creates infinite cash, reputation, or reservation loops.
- All 80 items and 14 stalls are affordable within a reasonable complete playthrough.
- The final expansion is aspirational but does not require idle real-world time.

No economy stability claim is made yet.
