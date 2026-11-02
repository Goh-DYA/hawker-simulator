# ADR 0010: Ten-Hour Operating Day, Closing Wind-Down and Save Schema V6

Date: 2026-11-02
Status: Accepted

## Context

An operating day ran from 10:30 to 18:30 on the in-game clock (eight real minutes at 1×, one in-game minute per simulated second). Nothing ended the day: guests still in the hall at 18:30 simply carried on into the next morning, which players read as guests being teleported to the next day. A first closing wind-down (doors, last orders, a closing call and a clear-out at the rollover) fixed that, but an independent review on the real content found its times shorter than real service, so some late guests were let in and then turned away, and a hawker centre that shuts at 18:30 also misses the real dinner trade. The owner asked for a day from 10:30 to 20:30, exactly ten hours and ten real minutes at 1×, with every guest of the day arriving before the last entry and none turned away at closing.

## Decision

- `OPERATING_DAY_MS` is ten minutes, keeping one in-game minute per simulated second, so the day runs from 10:30 to 20:30. The dinner crowd peaks at 18:40.
- In the adaptive arrival model (`follows_operating_hours` in `src/game/core/closing.ts`) the day winds down in steps: the last entry at 19:20, when the doors close; from then on a stall only takes orders it can cook by the closing call; last orders at 20:00 stops guests who have not chosen a stall, while guests already in a queue still order; the closing call at 20:12 has diners finish up and seatless guests take their meal away; and the step that ends the day clears anyone left, the queues, the seat reservations and the trays.
- Admission: before the doors close, a guest arrives only while some open stall's estimated service (the walk, everyone ahead and this guest at the counter, and the mean cooking time) would finish by the closing call, and stall choice applies the same estimate. A guest the closing still leaves without a choice goes home without a visit rating. A fixed arrival interval (tests and benchmarks) ignores the clock.
- The core save moves to schema V6. The shape is unchanged, but `elapsedMs` now counts ten-minute days, so `upgrade_v5_to_v6` re-counts a V5 save's elapsed time (the same day index and the same time of day) and every earlier save migrates through it.

## Rationale

Keeping one minute per second keeps every authored time (preparation, eating, patience, visit cap and the writer's lunch window) meaning what it meant, and makes a day longer rather than its clock faster, which the owner chose. Re-counting saved time instead of reinterpreting it keeps each save's day number, which the focus day, the neighbourhood calendar, the day ledger and every visit rating record. Admitting only guests who can be served is the honest form of a closing time: the centre stops letting people in when it can no longer serve them, so the Service Review never needs a separate count of guests turned away, and no guest's rating depends on when the centre chose to close.

## Consequences

- A V6 save cannot be loaded by an earlier build, so rolling back a deployment after players have saved loses their saves unless the earlier build is patched to accept V6 (and to re-count its time back). The release checklist's rollback step must note this.
- A day is a quarter longer in real time, with about a fifth more guests and takings (about 451 a day against 371 in seeded runs of the starter centre), so day-based pacing (stall tenders, seeded objective targets and the career estimates in the economy design) runs faster per real minute than before; the career estimates predate this change and need a re-run.
- The core goldens, the runtime multi-day digests and the save fixtures were re-baselined once. `tests/game/core/closing.test.ts` covers the wind-down and admission, and `save-v6.json` with the schema V6 tests covers the migration.
