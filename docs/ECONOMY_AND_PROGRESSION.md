# Economy and Progression

Status: Provisional balance specification; not playtest-validated

## Principles

- One earnable cash currency; no premium currency, purchases, advertisements, or real-time waits.
- Ordinary service always advances experience.
- Reputation communicates recent operational quality and cannot permanently lock the player out.
- Experimentation is cheap: full refund during placement preview, predictable resale, undo, and no hidden upkeep.
- A weak economy slows expansion but cannot end the game.

Amounts are simplified in-game Singapore dollar values. They support game balance and are not claims about real hawker prices, ingredient costs, or business performance. Canonical monetary state uses integer cents; player-facing summaries use `S$` and detailed ledgers use `SGD`.

## Starting state and bands

- Starting cash: S$4,200.
- Starting reputation: 8 / 100.
- Starter setup must include or make immediately affordable at least one level-1 stall, four seats, necessary tables/facilities, and an earning menu; granted items are not double-charged.
- Dish prices: S$3–S$24.
- Placeables: S$20–S$650.
- Stall purchases: S$1,200–S$4,700.
- Stall upgrades use authored level costs and service/capacity/quality/menu effects.
- Expansion bays: S$1,000, S$2,500, S$5,000, then S$9,000, each also reputation-gated.

These are tuning bands. Runtime data is authoritative after validation.

## Service periods and settlement

Each in-game day has four authored service periods: Breakfast (06:00-10:00), Lunch
(10:00-14:00), Tea (14:00-18:00), and Evening (18:00-22:00). Each period has
exactly 240 seconds of arrivals. Closing stops new arrivals, freezes the displayed
clock, and drains that period's cohort for at most 180 seconds. A drain outcome is
always attributed to the arrival period's immutable sequence ID.

Gross sale equals the menu price. Abstracted food cost is a data-defined percentage, initially 28–42% by dish. Contribution is:

gross sales − ingredient costs − refunds − paid upkeep

Upkeep is charged once per 60 seconds that a stall is open during arrivals. A drain
lasting more than 60 seconds can add one clearly labelled overtime-upkeep charge,
never more. Cash cannot become negative from upkeep. Purchases, resale, objective
rewards, recovery grants, scenarios, and cosmetics remain separate ledger lines and
do not change operating margin.

Operating margin is `(gross sales - ingredient costs - paid upkeep) / gross sales`.
It is unavailable when gross sales are zero. Every debrief must reconcile all cash
movements to the cent.

Satisfaction is 0–100 and combines food quality 30%, wait 20%, value 15%, route efficiency 10%, seating comfort 10%, cleanliness 10%, and ambience 5%. Route efficiency uses the full distance walked from entrance to exit: the first 20 tiles carry no penalty, an 80-tile journey scores 50, and journeys of 116 tiles or more floor at 20. Missing-seat or unserved departures use dedicated penalties rather than fabricated food scores.

Experience is independent of menu price. A completed served visit awards
`5 + floor(satisfaction / 20)` XP, plus 2 XP the first time a preparation is served
in the programme. A served visit ended by the drain watchdog awards 3 XP; an
unserved departure awards none. Multi-component meals award visit XP once.
Reputation uses a rolling sample so one bad visit is informative but not
catastrophic. Exact rounding is centralized and covered by unit tests.

## Unlock curve

| Phase | Levels | Player learning | Representative unlocks |
|---|---:|---|---|
| Starter | 1–3 | Build, service, tray return, first bottleneck | Sunrise Roost, Coconut & Lime, Kopi Canopy, Cinder Wok, isolated scenarios at level 3 |
| Variety | 4–7 | Menu mix, group seating, queue design | Mee Pok Junction, Combo Board at level 5, Tiffin Lantern, Sweet Monsoon, Satay Meridian, Tamarind Leaf, first expansion |
| Optimization | 8–12 | Peak flow, ambience, upgrades | Bamboo Basket, Straits Hearth, Harbour Ember, advanced facilities |
| Mastery | 13–20 | Dense layouts and self-directed goals | rotating mastery contracts at level 13, premium families, final expansions, feature decorations |

Every required launch stall and catalogue item is earnable by level 20 without premium payment. Unlocks reveal no more than a manageable group at a time.

## Objectives

Each planning period offers three feasible, target-frozen objectives and a Skip
choice. At most one offer is accepted. Objectives are optional guidance, not
blockers. Flow objectives require at least 80% flow continuously for 60 seconds
with at least three active guests from that period. A reward is capped at
`min(S$60, S$15 + S$3 x level)` and `min(40, 10 + 2 x level)` XP. Templates avoid
requiring a specific cultural dish as a novelty stunt.

## Recovery safeguards

- Essential starter objects may be reclaimed for free if none remain.
- If cash is below the cheapest valid earning setup and no openable stall exists, grant only the setup shortfall up to S$650 once per unresolved recovery condition and explain why.
- Selling returns 70% of base price; the confirmation shows resulting capability.
- A stall can always run at least one owned starter menu.
- Progress-bundle export/import is a player-controlled local backup feature. Main reset requires confirmation and preserves scenario/meta rewards; separately confirmed erase all removes main, scenario, and meta progression.
- No debt, bankruptcy timer, forced restart, or paid rescue.

## Scenario and mastery reward isolation

The five scenario save slots have authored starting S$ and cannot modify main-centre cash, XP, reputation, objectives, or unlocks. Scenario completion awards medals and cosmetics only.

Mastery contracts unlock at level 13 and award titles or cosmetics only. Rewards are granted once even when a completed template later appears as a labelled practice replay. Medals, titles, and cosmetics survive main-centre reset and have no operating-margin or economy effect.

## Balance acceptance

Before release, seeded simulation plus human playtests must demonstrate:

- A novice can reach level 3 without grinding or an unrecoverable placement.
- At least three materially different viable layout/menu strategies exist.
- No catalogue item creates infinite cash, reputation, or reservation loops.
- All 80 items and 14 stalls are affordable within a reasonable complete playthrough.
- The final expansion is aspirational but does not require idle real-world time.

No economy stability claim is made yet.
