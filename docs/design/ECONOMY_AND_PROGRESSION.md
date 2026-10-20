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
- Hall expansions: each adds four columns and two rows and costs the added tiles × $5 × 1.35^n, where n is the number of earlier expansions (`calculateExpansionCost` in `src/game/core/economy.ts`, with `MAP_EXPANSION` in `src/game/runtime/rules.ts`). From the 24 × 16 launch map the first seven cost $600, $919, $1,386, $2,067, $3,056, $4,485 and $6,538. Expansion is gated only by level 3; it has no reputation gate.

These are tuning bands. Runtime data is authoritative after validation.

## Dish prices

Every dish costs its 2025-26 heartland street price for the served portion, in whole dollars: `max(2, round_half_up(street typical))`. The typical comes, in order of preference, from the Department of Statistics' 2025 annual average price for the item (tier `SS25`), then a dated stall menu or food guide (`DATED`), then an estimate derived from those, for example by portion or by parity with a priced sibling (`EST`). The $2 floor is the only exception to the rule: the $2 floor binds for kopi and you tiao, whose street prices round below it, and for no other dish. [DISH_PRICE_SOURCES.csv](DISH_PRICE_SOURCES.csv) records each dish's typical, tier, source and any exception, and `tests/content/prices.test.ts` checks every price against it.

The review also fixed these parity rules, which the test asserts:

- Roast chicken rice and char siew rice cost the same as poached chicken rice.
- Kopi and teh tarik cost the same, and sugarcane juice costs more.
- Bak chor mee costs a dollar more than fishball mee pok.
- Babi pongteh costs more than ayam buah keluak, which costs more than chap chye, and nyonya laksa costs at least as much as each of those sides.
- Every dessert costs less than the cheapest noodle dish, and no dish costs more than black pepper crab (chilli crab ties it at $20).

Two price-health acceptance checks guard against charging for health. Re-check them whenever prices or the rating model change:

1. Across all dishes, the Spearman correlation between price and Health rating is at most zero. It is −0.421 today, across the 91 dishes of content `1.6.0`.
2. At least half of the dishes rated 3.5 or above cost no more than a Student Saver's mid budget ($6.50). Today 15 of 16 do; the exception is sotong panggang at $10.

Two content rules in `src/content/rules.ts` keep new stalls in line with these checks and with the unlock order:

- **Stalls are authored in unlock order** (`check_progression`). Each stall after the first must unlock at a higher level than the stall authored before it; only the two level-1 starters may share a level.
- **Every stall opens with an affordable dish** (`check_economy`). Among the dishes a stall offers when it unlocks (those whose level and reputation gates are at or below the stall's), at least one must cost no more than the Student Saver's mid budget, the mean of its `budgetRange` ($6.50; `OPENING_MENU_BUDGET_ARCHETYPE_ID`).

## Visit settlement

Gross sale equals the menu price and is the whole contribution; there is no food cost or upkeep.

Satisfaction is 0–100 and combines food quality 30%, wait 20%, value 15%, route efficiency 10%, seating comfort 10%, cleanliness 10%, and ambience 5%. Route efficiency uses the full distance walked from entrance to exit: the first 20 tiles carry no penalty, an 80-tile journey scores 50, and journeys of 116 tiles or more floor at 20. Missing-seat or unserved departures use dedicated penalties rather than fabricated food scores.

Experience per sale is the price × (1 + quality/5) plus 2 service XP (`SERVICE_XP_PER_SALE`); the level curve is 100 × (level − 1)², owned by `calculateLevel` in `src/game/core/economy.ts`. Reputation is an exponentially weighted average of recent visit ratings: each rating maps to a target (0 at a score of 55, the full scale at 95) and closes 2% of the gap, so roughly the last fifty visits dominate and one bad visit is informative but not catastrophic. Live reputation drives arrival demand. Every reputation unlock gate (stalls, placeables, dishes and their menus, customer personas and nutrition intents) reads `progression.peakReputation` instead, the highest live reputation the centre has reached, so content unlocked once never locks again after a poor day. The wait component treats the first 40% of a guest's patience as free and then falls linearly to zero. Exact rounding is centralized and covered by unit tests.

## Unlock curve

| Phase | Levels | Player learning | Representative unlocks |
|---|---:|---|---|
| Starter | 1–5 | Build, service, tray return, first bottleneck | Sunrise Roost, Coconut & Lime, Kopi Canopy, Cinder Wok, Mee Pok Junction, first expansion |
| Variety | 6–13 | Menu mix, group seating, queue design | Tiffin Lantern, Sweet Monsoon, Satay Meridian, Pick & Mix, Jade Ladle, Tamarind Leaf, Bamboo Basket |
| Optimization | 14–21 | Peak flow, ambience, upgrades, seating for reputation | Longan Moon, Lesung Corner, Straits Hearth, Herbal Cauldron, advanced facilities |
| Mastery | 22–26 | Dense layouts and self-directed goals | Peppercorn Plate, Harbour Ember, the last dishes, final expansions, feature decorations |

Every required launch stall and catalogue item is earnable by level 26 (`ECONOMY.maxLevel`) without premium payment. Unlocks reveal no more than a manageable group at a time.

### Stall unlocks

The 18 stalls are authored in `src/content/stalls.ts` in this order, which is their unlock order. The first five keep levels 1, 1, 2, 3 and 4, and level 5 has no stall. Stalls 6-12 take one level each, from 6 to 12. The six late stalls unlock on alternate levels, 14, 16, 18, 20, 22 and 24, so no two stalls share a level except the two starters, and the odd levels from 13 to 23 hold no stall. Reputation is on the content scale of 0-100. The tender day is the earliest operating day the stall's licence is offered (see below). Cost is the purchase price in SGD; the opening dishes are the ones available as soon as the stall unlocks.

| # | Stall | Level | Reputation | Prerequisite | Tender day | Cost | Opening dishes |
|---:|---|---:|---:|---|---:|---:|---|
| 1 | Sunrise Roost | 1 | 0 | – | starter | 1,200 | Poached chicken rice $4 |
| 2 | Coconut & Lime | 1 | 0 | – | starter | 1,350 | Nasi lemak $5 |
| 3 | Kopi Canopy | 2 | 10 | Sunrise Roost | 2 | 1,800 | Kopi $2 |
| 4 | Cinder Wok | 3 | 16 | Sunrise Roost | 4 | 2,200 | Char kway teow $5 |
| 5 | Mee Pok Junction | 4 | 20 | Cinder Wok | 6 | 2,350 | Bak chor mee $5 |
| 6 | Tiffin Lantern | 6 | 24 | Cinder Wok | 8 | 2,600 | Roti prata set $3, mee goreng mamak $5 |
| 7 | Sweet Monsoon | 7 | 27 | Kopi Canopy | 10 | 2,300 | Chendol $3, ice kacang $3 |
| 8 | Satay Meridian | 8 | 30 | Coconut & Lime | 12 | 2,850 | Chicken satay $7, barbecued chicken wings $5 |
| 9 | Pick & Mix | 9 | 33 | Mee Pok Junction | 14 | 2,900 | Yong tau foo $6, ban mian $5 |
| 10 | Jade Ladle | 10 | 36 | Sunrise Roost | 16 | 2,950 | Century egg pork porridge $4, fish porridge $6 |
| 11 | Tamarind Leaf | 11 | 40 | Tiffin Lantern | 18 | 3,100 | Masala thosai $4, idli sambar $3 |
| 12 | Bamboo Basket | 12 | 43 | Jade Ladle | 20 | 3,350 | Prawn dumpling soup $4, siew mai $4 |
| 13 | Longan Moon | 14 | 46 | Sweet Monsoon | 23 | 3,050 | Cheng tng $2, orh nee $3 |
| 14 | Lesung Corner | 16 | 49 | Satay Meridian | 26 | 3,550 | Ayam penyet $7, nasi goreng $6 |
| 15 | Straits Hearth | 18 | 52 | Tamarind Leaf | 29 | 3,800 | Laksa $6, ayam pongteh $4 |
| 16 | Herbal Cauldron | 20 | 54 | Straits Hearth | 32 | 4,200 | Bak kut teh $9, duck rice $6 |
| 17 | Peppercorn Plate | 22 | 56 | Kopi Canopy | 35 | 4,450 | Chicken chop $8, mushroom aglio olio $5 |
| 18 | Harbour Ember | 24 | 58 | Straits Hearth | 38 | 4,700 | Sambal stingray $12, fish bee hoon soup $6 |

Every prerequisite unlocks no later than the stall that depends on it, and the unlock graph has no cycle. Every stall's opening dishes include one at or below the Student Saver's $6.50 mid budget.

### Dish unlocks

The first five stalls keep their authored dish gates. From stall 6 on, a stall's dishes unlock in pairs in its signature order (the dish it is known for first): dish k of that order, counting from 0, unlocks at the stall's level + ⌊k/2⌋ and the stall's reputation + 2⌊k/2⌋, so the first two dishes open with the stall and the fifth arrives two levels later. The signature order sets only the gates; the `dishIds` lists in `src/content/stalls.ts` were not reordered, and fifth dishes are appended. The highest dish gate is chilli crab at level 26 and reputation 62, which equals `ECONOMY.maxLevel`.

A stall that an older save has already unlocked keeps its opening dishes even where the new gates are higher than the save has reached: a dish whose level and reputation gates are at or below its own stall's gates is available whenever that stall is unlocked (`resolveStallMenus` and `isDishUnlockedForMenu` in `src/game/runtime/stallMenus.ts`, and the Dishes panel). Every other dish keeps its own gate, so a saved menu dish above its new gate is paused until the centre reaches it.

### Stall tenders

New stalls also arrive by **stall tender**, one at a time. Beyond the two starter stalls, the next stall licence is offered no earlier than operating day 2, 4, 6, 8, 10, 12, 14, 16, 18 and 20, then 23, 26, 29, 32, 35 and 38 (`STALL_TENDER_DAYS` in `src/game/runtime/rules.ts`, one entry for each of the 16 tendered stalls; `STALL_TENDER_LATE_INTERVAL_DAYS` would add one every four days after that, which 18 stalls never reach), on top of its level, reputation and prerequisite gates. Levels 2 to 4 and the first reputation gates are reached on day 1, while a day's takings are roughly a third to a half of a new stall's price, so without the tender three stalls unlocked at once and the player could not afford to open them. In the round-2 review panel's seeded career runs (AI agents; see [TEST_REPORT.md](../TEST_REPORT.md)), an engaged builder reached each late level gate a few days before its tender (level 14 around day 11-12, level 24 around day 25-27), so such a player usually waits for the tender, while a slower one waits for the level. The tender is counted from how many tendered stalls are already unlocked, so it needs no saved state and never relocks a stall an older save already has. A centre that falls behind the schedule (for example one held back by reputation) catches up on each tender already due once the other gates are met, so an older save far into the game may receive several licences in one reconcile. The Stalls panel labels a stall waiting only for its tender "Tender on day N", and the Next up signpost names it with the day it opens. Placeables and dishes are not tendered.

A hall with about two seats per stall caps visit ratings, so its peak reputation can sit on the 52-58 band of the late gates: the Straits Hearth chain may then wait on reputation, and the last stall may arrive only after day 40. More seating is the remedy, and the Stalls panel shows the shortfall.

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
- All 80 items and 18 stalls are affordable within a reasonable complete playthrough.
- The final expansion is aspirational but does not require idle real-world time.

No economy stability claim is made yet.
