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
- Placeables: $35–$1,600.
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

1. Across all dishes, the Spearman correlation between price and Health rating is at most zero. It is −0.366 today, across the 91 dishes of content `1.6.0`.
2. At least half of the dishes rated 3.5 or above cost no more than a Student Saver's mid budget ($6.50). Today 15 of 16 do; the exception is sotong panggang at $10.

Two content rules in `src/content/rules.ts` keep new stalls in line with these checks and with the unlock order:

- **Stalls are authored in unlock order** (`check_progression`). Each stall after the first must unlock at a higher level than the stall authored before it; only the two level-1 starters may share a level.
- **Every stall opens with an affordable dish** (`check_economy`). Among the dishes a stall offers when it unlocks (those whose level and reputation gates are at or below the stall's), at least one must cost no more than the Student Saver's mid budget, the mean of its `budgetRange` ($6.50; `OPENING_MENU_BUDGET_ARCHETYPE_ID`).

## Visit settlement

Gross sale equals the menu price and is the whole contribution; there is no food cost or upkeep.

Satisfaction is 0–100 and combines food quality 30%, wait 20%, value 15%, route efficiency 10%, seating comfort 10%, cleanliness 10%, and ambience 5%. Seat comfort and the ambience part rise with the ambience at the diner's seat, and the cleanliness part with its cleanliness, on a taper with no early cap (see [What late pieces are worth](#what-late-pieces-are-worth)). Route efficiency uses the full distance walked from entrance to exit: the first 20 tiles carry no penalty, an 80-tile journey scores 50, and journeys of 116 tiles or more floor at 20. Missing-seat or unserved departures use dedicated penalties rather than fabricated food scores.

Experience per sale is the price × (1 + quality/5) plus 2 service XP (`SERVICE_XP_PER_SALE`); the level curve is 100 × (level − 1)², owned by `calculateLevel` in `src/game/core/economy.ts`. Reputation is an exponentially weighted average of recent visit ratings: each rating maps to a target (0 at a score of 55, the full scale at 95) and closes 2% of the gap, so roughly the last fifty visits dominate and one bad visit is informative but not catastrophic. Live reputation drives arrival demand. Every reputation unlock gate (stalls, placeables, dishes and their menus, customer personas and nutrition intents) reads `progression.peakReputation` instead, the highest live reputation the centre has reached, so content unlocked once never locks again after a poor day. The wait component treats the first 40% of a guest's patience as free and then falls linearly to zero. Exact rounding is centralized and covered by unit tests.

## Unlock curve

| Phase | Levels | Player learning | Representative unlocks |
|---|---:|---|---|
| Starter | 1–5 | Build, service, tray return, first bottleneck | Sunrise Roost, Coconut & Lime, Kopi Canopy, Cinder Wok, Mee Pok Junction, first expansion |
| Variety | 6–15 | Menu mix, group seating, queue design | Tiffin Lantern, Sweet Monsoon, Satay Meridian, Pick & Mix, Jade Ladle |
| Optimization | 16–25 | Peak flow, ambience, upgrades, seating for reputation | Tamarind Leaf, Bamboo Basket, Longan Moon, Lesung Corner, Straits Hearth, advanced facilities |
| Mastery | 26–32 | Dense layouts and self-directed goals | Herbal Cauldron, Peppercorn Plate, Harbour Ember, the last dishes, final expansions, feature decorations |

Every required launch stall and catalogue item is earnable by level 32 (`ECONOMY.maxLevel`) without premium payment. Unlocks reveal no more than a manageable group at a time.

### Stall unlocks

The 18 stalls are authored in `src/content/stalls.ts` in this order, which is their unlock order. The first five keep levels 1, 1, 2, 3 and 4, and level 5 has no stall. Every later stall unlocks on alternate levels, from level 6 to level 30, so no two stalls share a level except the two starters, and no odd level from 5 to 29 holds a stall. Reputation is on the content scale of 0-100. The tender day is the earliest operating day the stall's licence is offered (see below). Cost is the purchase price in SGD; the opening dishes are the ones available as soon as the stall unlocks.

| # | Stall | Level | Reputation | Prerequisite | Tender day | Cost | Opening dishes |
|---:|---|---:|---:|---|---:|---:|---|
| 1 | Sunrise Roost | 1 | 0 | – | starter | 1,200 | Poached chicken rice $4 |
| 2 | Coconut & Lime | 1 | 0 | – | starter | 1,350 | Nasi lemak $5 |
| 3 | Kopi Canopy | 2 | 10 | Sunrise Roost | 2 | 1,800 | Kopi $2 |
| 4 | Cinder Wok | 3 | 16 | Sunrise Roost | 4 | 2,200 | Char kway teow $5 |
| 5 | Mee Pok Junction | 4 | 20 | Cinder Wok | 6 | 2,350 | Bak chor mee $5 |
| 6 | Tiffin Lantern | 6 | 24 | Cinder Wok | 8 | 2,600 | Roti prata set $3, mee goreng mamak $5 |
| 7 | Sweet Monsoon | 8 | 27 | Kopi Canopy | 10 | 2,300 | Chendol $3, ice kacang $3 |
| 8 | Satay Meridian | 10 | 30 | Coconut & Lime | 12 | 2,850 | Chicken satay $7, barbecued chicken wings $5 |
| 9 | Pick & Mix | 12 | 33 | Mee Pok Junction | 14 | 2,900 | Yong tau foo $6, ban mian $5 |
| 10 | Jade Ladle | 14 | 36 | Sunrise Roost | 16 | 2,950 | Century egg pork porridge $4, fish porridge $6 |
| 11 | Tamarind Leaf | 16 | 40 | Tiffin Lantern | 18 | 3,100 | Thosai $3, idli sambar $3 |
| 12 | Bamboo Basket | 18 | 43 | Jade Ladle | 20 | 3,350 | Prawn dumpling soup $4, siew mai $4 |
| 13 | Longan Moon | 20 | 46 | Sweet Monsoon | 23 | 3,050 | Cheng tng $2, orh nee $3 |
| 14 | Lesung Corner | 22 | 49 | Satay Meridian | 26 | 3,550 | Ayam penyet $7, nasi goreng $6 |
| 15 | Straits Hearth | 24 | 52 | Tamarind Leaf | 29 | 3,800 | Laksa $6, ayam pongteh $4 |
| 16 | Herbal Cauldron | 26 | 54 | Straits Hearth | 32 | 4,200 | Bak kut teh $9, duck rice $6 |
| 17 | Peppercorn Plate | 28 | 56 | Kopi Canopy | 35 | 4,450 | Chicken chop $8, mushroom aglio olio $5 |
| 18 | Harbour Ember | 30 | 58 | Straits Hearth | 38 | 4,700 | Sambal stingray $12, fish bee hoon soup $6 |

Every prerequisite unlocks no later than the stall that depends on it, and the unlock graph has no cycle. Every stall's opening dishes include one at or below the Student Saver's $6.50 mid budget.

### Dish unlocks

The first five stalls keep their authored dish gates. From stall 6 on, a stall's dishes unlock in pairs in its signature order (the dish it is known for first): dish k of that order, counting from 0, unlocks at the stall's level + ⌊k/2⌋ and the stall's reputation + 2⌊k/2⌋, so the first two dishes open with the stall and the fifth arrives two levels later. The signature order sets only the gates; the `dishIds` lists in `src/content/stalls.ts` were not reordered, and fifth dishes are appended. The highest dish gate is chilli crab at level 32 and reputation 62, which equals `ECONOMY.maxLevel`.

A stall that an older save has already unlocked keeps its opening dishes even where the new gates are higher than the save has reached: a dish whose level and reputation gates are at or below its own stall's gates is available whenever that stall is unlocked (`resolveStallMenus` and `isDishUnlockedForMenu` in `src/game/runtime/stallMenus.ts`, and the Dishes panel). Every other dish keeps its own gate, so a saved menu dish above its new gate is paused until the centre reaches it.

### Placeable unlocks

Placeables unlock by level and reputation only (no tender and no prerequisite). They are spread over levels 1 to 30 like the stalls, so every build category offers something new every few levels instead of finishing by level 12, and every level from 2 to 30 unlocks at least one piece. A placeable's reputation gate follows the stall curve: the reputation of the stall at the same level, or at an odd level the lower of its two neighbours' midpoint (rounded down), so a piece never needs more reputation than the stall unlocked at its level. The level-1 starters keep reputation 0, and within a category the price broadly rises with the level, apart from a few budget pieces (the folding overflow table, the high counter stool, the standing snack ledge, the tabletop flower vase and the low path light) that stay cheap and a few later pieces priced by what they return (see [What late pieces are worth](#what-late-pieces-are-worth)).

| Level | Reputation | Level | Reputation | Level | Reputation |
|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 11 | 31 | 21 | 47 |
| 2 | 10 | 12 | 33 | 22 | 49 |
| 3 | 16 | 13 | 34 | 23 | 50 |
| 4 | 20 | 14 | 36 | 24 | 52 |
| 5 | 22 | 15 | 38 | 25 | 53 |
| 6 | 24 | 16 | 40 | 26 | 54 |
| 7 | 25 | 17 | 41 | 27 | 55 |
| 8 | 27 | 18 | 43 | 28 | 56 |
| 9 | 28 | 19 | 44 | 29 | 57 |
| 10 | 30 | 20 | 46 | 30 | 58 |

Levels arrive quickly at first: a centre reaches level 4 by the end of day 1, level 7 by day 5 and level 9 by day 8. So the early levels hold the basics and the rest wait: 21 pieces are open by the end of day 1 (the 7 starters and 14 more), 34 by day 5, then two to five pieces arrive at each level from 8 to 28 and one each at 29 and 30. `tests/content/placeable-unlocks.test.ts` pins the curve, the coverage of every level and the day-1 and day-5 ceilings. The unlock levels by category (`src/content/placeables.ts` is authoritative):

| Category | Unlock levels |
|---|---|
| Tables | 1, 2, 3, 4, 5, 8, 13, 17, 21, 25 |
| Seats | 1, 2, 3, 4, 6, 8, 11, 12, 14, 18, 20, 24, 28 |
| Stall fixtures | 5, 6, 8, 10, 12, 15, 18, 22, 26 |
| Tray return and waste | 1, 1, 3, 7, 9, 11, 14, 19, 24 |
| Lighting | 1, 5, 5, 9, 13, 16, 21, 28 |
| Fans | 2, 6, 10, 12, 15, 19, 23, 29 |
| Plants | 2, 4, 7, 9, 11, 14, 17, 20, 23, 27 |
| Signage | 1, 3, 4, 7, 10, 13, 17, 22 |
| Dividers | 2, 3, 8, 12, 16, 21, 27 |
| Facilities | 1, 6, 8, 11, 13, 16, 18, 25 |
| Decor | 5, 7, 9, 14, 15, 23, 26, 30 |

### What late pieces are worth

A finished meal rates its seat on three parts: comfort (76 plus the seat's ambience × 6), the ambience part (72 plus ambience × 9) and cleanliness (82 plus cleanliness × 8 and cleaning efficiency × 6, less the uncleared-tray penalty). These parts used to stop at 100, which seat ambience reached at 4 for comfort and about 3.1 for the ambience part and cleanliness at about 2.25, so a hall with a few plants, a light and a sink was already at the caps and a later piece whose value was ambience alone returned nothing more. The raw points now pass through a taper (`compute_tapered_rating_gain` in `src/game/core/utility.ts`, applied by `compute_meal_rating_factors` in `src/game/core/lifecycle.ts`): the first stretch counts in full, exactly as before, and after that every doubling of the raw points adds the same step, so each part keeps rising at a decreasing rate and reaches 100 only after four doublings. The taper is piecewise linear, with no logarithm or exponential, so every engine gives the same result.

| Part | Counts in full up to | Each doubling after that adds | Reaches 100 at |
|---|---|---|---|
| Comfort | 12 points (ambience 2) | 3 | ambience 32 |
| Ambience part | 18 points (ambience 2) | 2.5 | ambience 32 |
| Cleanliness | 8 net points (cleanliness 1) | 2.5 | 128 net points (cleanliness 16) |

| Seat ambience | 0 | 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12 | 16 | 24 | 32 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Comfort | 76 | 82 | 88 | 89.5 | 91 | 92.5 | 94 | 94.75 | 95.5 | 97 | 98.5 | 100 |
| Ambience part | 72 | 81 | 90 | 91.25 | 92.5 | 93.75 | 95 | 95.63 | 96.25 | 97.5 | 98.75 | 100 |

| Seat cleanliness | 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 |
|---|---|---|---|---|---|---|---|---|---|
| Cleanliness part | 82 | 90 | 92.5 | 93.75 | 95 | 96.25 | 97.5 | 98.75 | 100 |

The uncleared-tray penalty is taken from the raw cleanliness points before the taper, so a penalty larger than the support counts in full and a very clean area softens a tray left nearby without hiding it (before, any seat with cleanliness above about 3.75 hid a 12-point penalty completely). The starter hall's seats sit at ambience 0 to 2.7 with no cleanliness support, inside or just past the full-rate stretch, so its ratings barely move: in seeded runs of the starter centre (8 seeds × 3 days after the opening day) the average visit score went from 71.4 to 71.2. A hall furnished with early pieces (seat ambience 4 to 19) now rates comfort about 94 and the ambience part about 96 instead of 99, and adding eight late decor pieces lifts them to about 97 and 98, worth about 0.6 visit-score points per seated guest where before it was worth 0.06. The decorated hall's seat parts end about 0.4 points below where the old caps put them, since the caps already gave every seat in it the maximum.

Prices and stats are set so that a later piece is not worse per dollar than the earlier pieces of its role once a hall is furnished. They were measured in two reference halls on the launch map, each with the two starter stalls and their queues: the starter centre (six seats, one tray return), and a furnished hall (sixteen seats at three tables, a single- and a dual-bay tray return, two bins, a sink and thirteen plant, light, fan, decor and sign pieces, all from level 9 or earlier). Each piece was placed at the three best of the forty nearest free tiles to the seats and queues, its seat parts were computed exactly at every existing seat, and its other effects were converted to visit-score points with the exchange rates that seeded runs of each hall give for a hall-wide probe of each effect. In the furnished hall the queues are the bottleneck (queue patience is worth about 6.5 points per unit at every queue cell, while extra seats, eating speed and walking speed are worth almost nothing), and in the starter centre seats are (a seat is worth about 1 point, eating speed about 3.6 points per unit and queue patience about 2):

- **Ambience pieces.** In the furnished hall, plants return 0.23 to 0.26 visit-score points per $1,000 at levels 2 to 7 and 0.37 to 0.39 from level 9 (the Rain Garden Pot, Dwarf Banana Planter and Pandan Border Bed now carry ambience 18 to 26 and cleanliness 3); decor pieces 0.21 to 0.26 at levels 5 and 7 and 0.29 to 0.30 from level 9; lighting 0.19 to 0.23 at levels 1 to 9 and 0.29 to 0.36 from level 13; and the Integrated Planter Divider, the Acoustic Screen (which now also keeps queues beside it patient), the Terrazzo Feature Table, the Centre Identity Sign and the two display cases 0.21 to 0.38. Before the taper none of these returned anything in a furnished hall. In the starter centre every one of them returns 1 to 2.8 points per $1,000, the cheapest small pieces the most. The Tall Areca Planter's cleanliness 1 moves into ambience (6 to 8), since on a one-tile planter it made the piece three times as good per dollar as any later plant.
- **Table-cleaning crew.** The crew is the main bottleneck of a hall with too few tray returns: in seeded runs of a 16-seat hall with one tray return (6 seeds × 3 days after the opening day), one more crew member cut no-seat departures from about 14 a day to almost none and raised the average visit score by about 8 points. A tray return brings one crew member per return opening, plus one for a station that clears itself, so the Single-Bay Tray Return brings one, the Dual-Bay Tray Return and the Dish Drop Counter (a staffed counter) two, and the Tray-Return Conveyor three.
- **Queue pieces.** Queue patience slows how fast queued guests lose patience, which also lifts the wait part of the rating. Within each role the queue pieces now rise per dollar with their level, for example the stall fixtures from the Condiment Counter (0.86 points per $1,000 in the furnished hall) through the Queue Ticket Dispenser, the Order Pickup Shelf and the Mobile Prep Cart (1.1 to 1.24) to the Self-Order Kiosk (1.72), and the fans from the Wall Circulation Fan (0.36) through the High-Volume Air Fan, the Quiet Corner Fan, the Stall Exhaust Booster and the Giant Ceiling Fan (0.62 to 0.67) to the Misting Fan (1.22).
- **Throughput pieces:** the Banquet Turntable Table (eating speed 0.25 for the twelve seats around it), the Paper Umbrella Canopy (0.15), the Giant Ceiling Fan (0.12, with queue patience), the Standing Snack Ledge, the Folding Overflow Table and the Cutlery & Napkin Station, plus the cleaning-efficiency Granite Chess Table, Heritage Lamp Post, First-Aid Cabinet and Protected Utility Point. Eating speed and cleaning efficiency pay off in a hall short of seats or crew, so they are priced against the starter centre.
- **Seats** stay one seat a tile, so late benches compete on price per seat: the Companion Transfer Bench ($70 a seat) and the Four-Person Teak Bench ($70 a seat) match the Three-Person Communal Bench, and the Rattan Lounge Chair is the single chair with the most ambience for its neighbours.

Each piece's effects are summed over the tiles in its radius with a linear falloff, and each total is clamped at a tile (ambience and cleanliness at 40, queue patience and eating speed at 0.6, cleaning efficiency at 0.7), so no one piece is sized near those clamps. Authored queue points are layout hints the simulation never reads, so no piece carries them and they no longer add queue patience; a queue interaction (the Queue Ticket Dispenser and the Self-Order Kiosk) still adds 0.025.

No placeable carries a service penalty, and no piece is strictly outdone (every effect, radius and seat count no better, at no lower price, level or footprint) by another piece of its category; the Pandan Border Bed carries two more ambience than the Dwarf Banana Planter for that reason.

Unlocked placeables never lock again, so an older save keeps every piece it has already unlocked even where the new gate is higher.

### Stall tenders

New stalls also arrive by **stall tender**, one at a time. Beyond the two starter stalls, the next stall licence is offered no earlier than operating day 2, 4, 6, 8, 10, 12, 14, 16, 18 and 20, then 23, 26, 29, 32, 35 and 38 (`STALL_TENDER_DAYS` in `src/game/runtime/rules.ts`, one entry for each of the 16 tendered stalls; `STALL_TENDER_LATE_INTERVAL_DAYS` would add one every four days after that, which 18 stalls never reach), on top of its level, reputation and prerequisite gates. Levels 2 to 4 and the first reputation gates are reached on day 1, while a day's takings are roughly a third to a half of a new stall's price, so without the tender three stalls unlocked at once and the player could not afford to open them. The round-2 review panel's seeded career runs (AI agents; see [TEST_REPORT.md](../TEST_REPORT.md)) measured how fast levels arrive: an engaged builder reached level 14 around day 11-13, level 24 around day 25-29 and level 30 around day 35-40. Against the alternate-level schedule, such a player usually waits for the tender up to Straits Hearth (level 24, tender day 29) and for the level from Herbal Cauldron on (level 26 around day 29-33, level 30 around day 35-40 against tender days 32-38), while a slower one waits for the level throughout. Those runs used an earlier, denser schedule that unlocked stalls sooner, so on the alternate-level schedule the late levels may arrive a little later; they have not been re-run. The tender is counted from how many tendered stalls are already unlocked, so it needs no saved state and never relocks a stall an older save already has. A centre that falls behind the schedule (for example one held back by reputation) catches up on each tender already due once the other gates are met, so an older save far into the game may receive several licences in one reconcile. The Stalls panel labels a stall waiting only for its tender "Tender on day N", and the Next up signpost names it with the day it opens. Placeables and dishes are not tendered.

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
- All 98 items and 18 stalls are affordable within a reasonable complete playthrough.
- The final expansion is aspirational but does not require idle real-world time.

No economy stability claim is made yet.
