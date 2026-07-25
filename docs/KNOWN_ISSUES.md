# Known Issues

Status: Release-candidate verification list; not a customer-facing production issue list

## Remaining release blockers

1. **The completed independent-review programme is not production approval.** Stage 1-5 working-source automation and responsive development-browser evidence cover the new period, forecast, preparation, Combo Board, party/event/regular, scenario, mastery, and persistence surfaces. The final source commit and immutable production artifact still require a recorded current-stable-Chrome critical path, console/network review, viewport/zoom and assistive-technology checks, save/reload, resize/suspension/WebGL-loss behavior, and measured browser performance. Edge/Firefox smoke results are also absent.
2. **Real offline/PWA behavior is unverified on the replacement artifact.** First-load cache population, offline reload, browser restart, offline saving, waiting-worker update, mixed-version avoidance, and rollback must be exercised on the final origin.
3. **Human Singapore cultural review is pending.** Internal research and safeguards do not substitute for Singapore-informed review.
4. **Human accessibility and assistive-technology review is pending.** Keyboard, screen-reader, zoom/reflow, contrast, reduced-motion, focus, and audio-equivalence behavior needs human verification in the exact browser build.
5. **Independent security and qualified legal/privacy review are pending.** Internal controls, tests, notices, and zero-vulnerability dependency-audit results are evidence inputs, not an approval or compliance claim.

## Open gameplay balance issues

- **Period-drain and party throughput still need human balance review.** The per-visit cap no longer interrupts already-served cleanup, and the 180-second period watchdog now records explicit served-timeout or unserved-period-close outcomes. Automated seeded evidence does not establish that preparation/eating durations, parties of two through six, split seating, overtime upkeep, and dense rushes feel fair across a complete playthrough.
- **Scenario medals and mastery contracts still need human difficulty calibration.** Deterministic fixtures cover feasibility, reward isolation, bronze competence, and multiple seeded gold strategies, but they do not prove that the five scenarios or twelve contract templates communicate goals well or remain engaging at every unlock state and player skill level.

## Implemented but awaiting exact-production evidence

- The working source defines code-native contracts for 80 placeables, 14 stalls, 54 dishes, 12 archetypes, and 11 customer states, plus four period profiles, eight neighbourhood events, six regulars, five scenarios, and twelve mastery templates. Automated contracts do not replace an exact-production gallery or final human visual/cultural review.
- Per-stall queue counts, automatic direction, editable bends, obstacle-safe reserved queue cells, and customer movement through the resulting cells are implemented and covered by core tests. Long-running browser crowd behavior and extreme player-authored layouts still require soak/playtest evidence.
- Expansion migrates the former right/bottom perimeter outward, projects entrance/exit points to the new boundary, refreshes exiting paths, and restores endpoints on undo. Core regressions and development-browser expansion screenshots pass; exact-production save/reload and repeated-expansion play remain open.
- Signage/facilities now apply visible, documented effects such as wayfinding, patience, movement, turnover, cleanliness, ambience, satisfaction, and tray-return support. Balance tuning across a complete progression playthrough is not yet accepted.
- IndexedDB, service-worker, accessibility, audio-degradation, and security-header implementations retain automated coverage, but final browser/fault-injection evidence must target the replacement artifact.
- Parties, event choices, regular stories, isolated scenario slots, medal/cosmetic rewards, mastery rotations, the meta gallery, preserved-meta main reset, erase-all flow, and V3 progress bundles have automated coverage. Full lifecycle observation with assistive technology, long-session narrative review, and destructive-flow testing on the exact production artifact remain open.
- The current Node benchmark passes with 80 active agents over 1,200 fixed steps, but it cannot establish Phaser FPS, TTI, memory stability, or a supported browser customer cap.
- The renderer still uses full-frame redraw and recreates text during frame rendering. This browser CPU/allocation path is outside the Node benchmark and requires profiling and, if budgets are missed, optimization before performance approval.

## Previously listed concerns closed by implementation or current automated evidence

- Entrance-nearest-stall crowding is mitigated by a deterministic score that accounts for preference, quality, price, wait, novelty, scaled distance, and global wayfinding; comparable stalls and preference-over-distance behavior have regression tests.
- Straight queues through furniture are replaced with obstacle-aware automatic paths and validated custom routes; every admitted customer is asserted to receive walkable route cells.
- Expansion no longer leaves the old right/bottom boundary as an internal seam, and customers do not despawn at the old exit after expansion.
- Furniture and facilities are no longer represented only by category-identical graphics: all 80 placeable IDs have distinct visual contracts/motifs and catalogue previews.
- Customers visibly carry and consume dish-specific food/vessel graphics; all authored dish metadata is consumed by the visual recipe layer.
- Signage and facility utility is no longer presentation-only: every authored signage/facility item maps to at least one simulation effect.
- The old persona-hook issue is closed: seat preference, group range, satisfaction modifiers, spend multiplier, and tray-return probability now affect member-level party simulation.
- Served guests are no longer removed merely for crossing the legacy per-visit cap; final period cleanup is attributed through the explicit drain/watchdog outcome contract.
- Validators and regressions remain present for launch counts, lifecycle recovery, cross-preview save migration, economy/progression, strategic reward isolation, undo, and deterministic soak behavior. Their current results are recorded separately from production-artifact and human-review evidence.

## Reporting rule

Do not remove a remaining blocker without a dated evidence record. Development-browser screenshots demonstrate targeted visual behavior; they do not replace an exact-production critical-path, offline, performance, accessibility, cultural, legal, or security review.
