# ADR 0006: Seeded Neighbourhood and Save Schema V5

Date: 2026-10-19
Status: Accepted

## Context

Play stalled after about twenty minutes. Reputation drained to zero on the first day, every day ran the same smooth arrival curve, the daily objectives cycled through six fixed templates, and nothing marked the end of a day. The roadmap's Phase 1 (seeded demand events with notice and a post-event explanation) and Phase 5 (targets scaled from demonstrated play) describe the fix, under firm constraints: no gambling-like mechanics, no timed exclusivity, no live events or remote configuration, no hard fail state, and a pure, deterministic core whose seeded runs are pinned by goldens.

## Decision

Add a seeded **neighbourhood** to the core (`src/game/core/neighbourhood.ts`) and bump the core save to **schema V5**.

- Each centre has a `worldSeed`. Every neighbourhood draw comes from a short xorshift stream seeded by `hashSeed(worldSeed:system:day)`, a pure function of the seed, a system name and the day. The simulation's `rngState` is never read or advanced by it, so a centre without a neighbourhood (`GameState.neighbourhood` undefined, as in the core golden scenarios) runs exactly as before.
- A calendar of authored, activity-based day cards (`src/content/calendar.ts`) changes arrival demand, the lunch and dinner peaks, persona weights, dish-category appeal and how long guests linger. Day 1 is a fixed opening day; every later day is drawn from a shuffle bag by a weighted roulette without replacement, so each card appears once per bag and never on two days in a row. Tomorrow's card is drawn at the start of today, so the forecast never changes.
- A director keeps `tension`, an exponentially weighted average of daily performance, and tilts card weights by card intensity: busier days after strong days, calmer days after rough ones.
- A food writer is scheduled for tomorrow with a fixed chance from day 3, at least three days apart. They review one open stall over the lunch window; meeting a threshold (68, plus 3 per plaque held, capped at 82) earns a permanent Writer's Pick plaque with a small stall-choice popularity bonus. Missing it costs nothing.
- A day ledger records the day's ratings, departure reasons and served stalls; at the rollover the outgoing objectives are awarded, the ledger becomes `lastReport` (the Service Review), a `day-ended` event is emitted and the calendar turns.
- Unlock gates read a new monotone `progression.peakReputation`, so content never locks again after a poor day, while live reputation still drives demand.
- V5 adds `progression.peakReputation` and a top-level `neighbourhood` (or `null`). V4 saves migrate with the peak at their reputation and no neighbourhood; the runtime then creates one seeded from the saved `rngState`. New centres get a random world seed from the app; imports keep the saved seed.

## Rationale

Seeded, telegraphed variety gives each day an identity and a reason to plan, which is the ethical form of variable reward: the player sees tomorrow's card and the writer's visit in advance, every card has more than one good response, and nothing is lost by ignoring one. Deriving every draw from the seed and the day keeps the simulation reproducible and testable without threading a second stream through the step. The shuffle bag guarantees variety that a plain random draw does not, and the director makes the variety adapt to the player instead of punishing them.

## Consequences

- A V5 save cannot be loaded by an earlier build, so rolling back a deployment after players have saved loses their saves unless the earlier build is patched to accept V5. The release checklist's rollback step must note this.
- Customers, queues, reservations and uncleared trays remain runtime-only; reloading mid-day empties the hall, as before.
- The golden suites were re-baselined once for the version bump and the peak reputation; the neighbourhood itself is covered by `tests/game/core/neighbourhood.test.ts` and the V5 fixture.
