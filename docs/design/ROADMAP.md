# Roadmap

Status: The roadmap is tracked future work; the backlog holds deferred ideas only, none of which may delay or silently enter 1.0

## Long-term progression roadmap

The daily focus, centre milestones, stall mastery, adaptive demand, and procedural soundtrack are the progression foundation.

This roadmap deliberately avoids premium currency, real-time waits, timed exclusivity, forced resets, accounts, analytics, and social pressure. Each phase should ship independently and preserve existing local saves.

### Phase 1 — Neighbourhood demand events and peak periods

- [x] Add seeded demand profiles with readable advance notice: a lunch and a dinner rush with last orders at 18:10, shifted and scaled by the day's card, with tomorrow's card forecast a day ahead and each rush announced before it starts.
- [x] Add local, fictional events: nine activity-based day cards plus a fixed opening day, drawn from a seeded shuffle bag ([catalogue](CONTENT_CATALOGUE.md#neighbourhood-calendar)).
- [ ] Let events change preference mix and group size, never customer identity stereotypes. Cards change persona weights, dish-category appeal and eating time; group size changes remain open.
- [ ] Add a calendar preview and post-event explanation of demand, throughput, and satisfaction. The post-event explanation is done (the end-of-day Service Review); the preview reaches only tomorrow, and a calendar preview further ahead remains open.

Progress: mostly delivered by the seeded neighbourhood ([ADR 0006](../decisions/0006-seeded-neighbourhood-and-save-v5.md)); the open items are group size changes and a calendar preview beyond tomorrow.

Dependencies: adaptive arrival model, objective eligibility, multi-entrance routing.

Acceptance: the same seed produces the same event sequence; every event has at least two viable responses; ignoring an event slows rewards but cannot create a hard fail state.

### Phase 2 — Seeded scenarios and constrained layouts

- [ ] Author scenario definitions with map, starting inventory, operating constraints, and optional medals.
- [ ] Add scenarios for narrow aisles, split halls, limited cash, menu variety, and peak throughput.
- [ ] Keep timers simulation-based and pause-aware; do not use real-world countdowns.
- [ ] Store best local results and allow replay without affecting the main centre.

Dependencies: Phase 1 demand profiles, access-point validation, deterministic objective metrics.

Acceptance: scenarios are reproducible, completable without one exact layout, and fully usable offline.

### Phase 3 — Dish discovery, collections, and centre identity

- [ ] Add dish mastery based on service quality and customer preference matches.
- [ ] Unlock recipe presentation variants and centre decorations through play, not random drops.
- [ ] Add locally stored collection pages with clear gameplay sources for every item. Partial: Writer's Pick plaques are a first collection with no missable entries (any stall can earn one on a later food-writer visit, and a miss costs nothing); collection pages are not built.
- [ ] Add centre colour and signage themes that preserve contrast and cultural-review requirements.

Dependencies: stall mastery, content validation, save-schema extension policy.

Acceptance: collection completion has no missable entries or timed exclusivity; cosmetic choices never become dominant economic bonuses.

### Phase 4 — Customer groups and community stories

- [ ] Add deterministic group arrivals, shared seating needs, and readable group satisfaction.
- [ ] Add short fictional neighbourhood story arcs driven by centre milestones.
- [ ] Keep behavioural traits independent of ethnicity, age, or other protected characteristics.
- [ ] Provide a story log and replayable summaries without voice or external content.

Dependencies: group reservation model, Phase 1 events, accessibility and cultural review.

Acceptance: group routing cannot orphan reservations; stories remain optional and never block core progression.

### Phase 5 — Endgame mastery contracts

- [ ] Add rotating mastery contracts for high-level layout, service, menu, and hospitality play.
- [ ] Scale targets from demonstrated throughput rather than fixed endgame crowd counts. Partial: from day 2 the daily objectives scale their targets from the previous day's Service Review, within fixed floors; mastery contracts do not exist yet.
- [ ] Reward centre titles, visual flourishes, and optional challenge modifiers.
- [ ] Continue stall mastery ranks without requiring a progression reset.

Dependencies: all earlier progression metrics and scenario validation.

Acceptance: contracts remain achievable after arbitrary layout changes, rewards are granted once, and no reset or endless grind is required to retain earned content.

### Implementation checklist for every phase

- [ ] Add typed content/schema definitions and migration coverage.
- [ ] Add deterministic unit fixtures and long-soak invariant tests.
- [ ] Add accessible UI text and non-audio/non-colour feedback.
- [ ] Update economy, design, provenance, risk, and release documentation.
- [ ] Complete browser performance, cultural, accessibility, and save-compatibility review.

## Next: engagement backlog

Ideas raised while designing the seeded neighbourhood and deferred or cut. None is scheduled; each needs its own design pass against the principles above.

- **Named regulars with hearts.** Recurring named guests whose affection grows with good visits, reading the authored `seatPreference` and `groupSizeRange` persona fields that the simulation does not use yet. Deferred.
- **Hawker Almanac collection log.** A local log of dishes served, cards seen and plaques earned, with a gameplay source for every entry. Deferred; it would build on the Writer's Pick plaques (Phase 3).
- **Choose one of three contracts.** Cut for now: it duplicated the daily objectives, one stretch tier dominated, and it inflated cash.
- **Chope seat holding with tissue packets.** Cut: holding a seat while queueing risked orphaned reservations, queue reconciliation wiping queue places and starving the six-seat starter layout. Tissue packets may return later as a cosmetic touch only.
- **Streak counter.** Cut: it risks notification fatigue and highlights failure when a streak breaks.
- **Markov weather.** Weather that follows from the day before, rather than independent weather cards. Deferred.
- **Upkeep or food-cost sink.** A recurring cost to balance late-game cash. Deferred until cash at day 5 has been measured.

## Post-launch backlog

### Priority A — quality after release

- More save export/import support for player-controlled backups.
- Additional accessibility options based on human audit.
- More diagnostic overlays and layout analytics computed locally.
- Browser/GPU compatibility fixes discovered from support.
- Additional English tutorial and objective variants.
- Optional install/update UX improvements.

### Priority B — sustainable content

- Additional dishes within existing stalls after cultural and balance review.
- Additional meaningful placeables that extend current visual families.
- Seasonal-looking decorations without timed exclusivity or real-world holiday tokenism.
- A second map theme only after the complete first theme remains maintainable.
- More customer visual components; behavior remains independent of ethnicity.

### Priority C — deeper simulation

- Lightweight cleaner routing if measurement shows it adds readable decisions.
- Reservations for larger groups and shared-table etiquette refinements.
- Advanced stall specialization and menu synergy.
- Optional scenario challenges with no punitive real-time timers.
- More robust local replay/benchmark tooling.

### Separate approval required

The following require new product, privacy, legal, security, moderation, operations, and possibly financial review before any implementation:

- analytics or telemetry;
- accounts, cloud saves, cross-device sync;
- payments, advertising, or any monetization;
- social visits, leaderboards, sharing, chat, or user-generated content;
- remote configuration or live events;
- collection of support diagnostics;
- mobile-first or app-store distribution.

### Rejected for foreseeable scope

Loot boxes, pay-to-win, energy systems, coercive timers, gambling-like mechanics, competitive economies, guilds, voice chat, detailed supply chains, staff morale/scheduling, franchise management, and always-online dependencies.
