# Save Format

Status: Reference for the current save format (core schema 4, runtime envelope 2, store envelope 2)
Related: [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md#persistence), [adr/0003](adr/0003-local-first-persistence-and-offline.md)

A stored save is three versioned layers, one inside the other. Each layer has its own version number and changes independently of the others.

## Version nesting

| Layer | Field and current value | Owner | What it adds |
|---|---|---|---|
| Store envelope (outermost) | `saveVersion`: 2 written; 1 and 2 accepted | `src/game/persistence/saveStore.ts` | `appVersion`, `writtenAt`, `checksum` and the `payload` below. The same envelope is used for the IndexedDB slots and for exported files. |
| Runtime envelope | `runtimeSchemaVersion`: `RUNTIME_SCHEMA_VERSION` = 2 written; 1 and 2 accepted | `src/game/runtime/saves.ts` | `stallMenus`, `activeDishVariants`, `nutritionDataVersion` and the `core` save below. A payload without a recognised `runtimeSchemaVersion` is read as a bare core save. |
| Core save (innermost) | `schemaVersion`: `PERSISTENT_SCHEMA_VERSION` = 4 written; 1 to 4 accepted | `src/game/core/persistence/` (the constant lives in `src/game/core/enums.ts`) | Map, access points, route guides, objects, economy, progression, metrics, `rngState`, `nextCustomerSequence`, `elapsedMs` and `savedAtTick`. |

A version 1 runtime envelope loads without a message. A version 2 envelope that lacks `activeDishVariants` or `nutritionDataVersion`, or whose `nutritionDataVersion` differs from the current nutrition data, resets the recipe choices to reviewed defaults and shows the recipe-reset warning.

## Core schema history

`migratePersistentState` parses a save at its own version, upgrades it one version, and parses it again at the new version, until it reaches version 4. Each version has one `parseVN` and one `upgrade_vN_to_vN+1` in `src/game/core/persistence/migrations.ts`.

| Version | Shape | Upgrade to the next version |
|---|---|---|
| V1 | `map`, a single `entrance` and `exit`, `objects`, `money`, `xp`, an optional `reputation` and `seed` | V1 to V2 moves `money` to `economy.currency` and `seed` to `rngState`, clamps `reputation` to 0-5 (default 2.5), starts the counters, unlocks and progression lists empty, and sets `qualityMode` to `standard`. It writes a level computed from XP that only has to pass `parseV2`'s check; `parseV2` then recomputes the level from XP with `calculateLevel`. |
| V2 | `savedAtTick`, `map`, `entrance`, `exit`, `qualityMode`, `objects`, `economy` (currency, lifetime revenue and spend, completed and abandoned visits), `progression` (XP, level, reputation, unlocked definition IDs, expansion count), `rngState`, `nextCustomerSequence`, `elapsedMs` | V2 to V3 turns the entrance and exit into the access points `entrance-1` and `exit-1`, and starts the route guides and metrics empty. |
| V3 | Replaces `entrance` and `exit` with `accessPoints`; adds `routeGuidePoints`, the progression fields `focusDay`, `dailyObjectives`, `claimedMilestoneIds` and `stallMastery`, and `metrics` (`trayReturns`, `visitRatings`) | V3 to V4 adds empty nutrition metrics. |
| V4 (current) | Adds `metrics.nutrition`: lifetime and today nutrition metrics per intent, per nutrient and per dish | None. |

Frozen fixtures for every version are in `tests/game/core/persistence/fixtures/` (`save-v1.json` to `save-v4.json`), and `tests/game/core/persistence/migrations.test.ts` pins their migrated output.

## Invariants

These are load-bearing. Changing any of them breaks existing saves or changes player-visible behaviour, so each needs a deliberate migration or release note.

- **Player-visible error messages.** A failed import shows the error's message to the player, so `PersistenceError` messages (in `src/game/core/persistence/`) and the store's "The save file is damaged or unsupported." are player copy. They name the offending save path, such as `progression.unlockedDefinitionIds must be a string array`.
- **Tuple order.** The ordered vocabularies in `src/game/core/enums.ts` (for example `NUTRITION_INTENTS`, `NUTRITION_METRICS`, `HEALTH_CONDITIONS` and `VISIT_RATING_COMPONENT_KEYS`) decide the key order of the records the parsers rebuild, which feeds save output and the state digests. Never reorder them; append only, with a migration.
- **Checksum serialisation.** The store checksum is a 32-bit FNV-1a hash (`compute_fnv1a32` in `src/game/core/rng.ts`) of `stableStringify(payload)`, which sorts keys recursively. Both are frozen, and `tests/game/persistence/saveStore.test.ts` pins the envelope and checksum. Known issue TD-06: `stableStringify` writes keys whose value is `undefined`, while the `JSON.stringify` in `exportSave` drops them, so a payload with an `undefined` field (such as an object without a `queuePath`) fails the checksum on re-import. This is pinned, not fixed; see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
- **Canonical core output.** `serializeGameState` writes `persistentStateFromGame` with recursively sorted keys, and objects are sorted by ID with `compareIds`.
- **Content alias tables.** `deserializeGameStateWithReport` accepts `definitionIdAliases` (renamed placeable IDs) and `removedDefinitionRefunds` (removed placeables, refunded in cash). The runtime currently passes neither, so a save that references a placeable ID missing from the catalog fails to load with a `PersistenceError`. Removing or renaming a content ID therefore needs an entry in one of these tables, passed from `load_runtime_save`.
- **Explicit persisted metrics.** Only `metrics.trayReturns`, `metrics.visitRatings` and `metrics.nutrition` are saved; `persistentStateFromGame` lists them by name. Other metrics are runtime-only, and a new persisted metric must be added there, in the parser and in a migration.
- **Runtime-only state.** Customers, queues, seat reservations, the spawn countdown, the accumulator, the undo stack and events are never saved; a loaded centre starts with no guests.
- **Preference keys.** The preference store keys are `settings`, `tutorial-complete`, `nutrition-tour-v1-complete` and `nutrition-lens-enabled` (`PREFERENCE_KEYS` in `src/game/persistence/preferences.ts`).
- **IndexedDB names.** Database `hawker-simulator`, version 1, with the object stores `saves` (keys `active` and `backup`) and `preferences`.

## Checklist: adding core schema V5

1. Add the `PersistentGameStateV5` type in `src/game/core/types.ts` and include it in `AnyPersistentGameState`.
2. Set `PERSISTENT_SCHEMA_VERSION` to 5 in `src/game/core/enums.ts`.
3. Add `parseV5` (building on `parseV4`, as each parser builds on the previous one) and `upgrade_v4_to_v5` in `src/game/core/persistence/migrations.ts`, register the upgrade in `UPGRADES` under key 4, and make `migratePersistentState` end with `parseV5`.
4. Update `persistentStateFromGame` and `deserializeGameStateWithReport` in `src/game/core/persistence/index.ts`.
5. Freeze a new `save-v5.json` fixture next to the existing ones; never edit `save-v1.json` to `save-v4.json`.
6. Add migration tests from every earlier fixture to V5 and a V5 round-trip test.
7. Record the change in `CHANGELOG.md` and, if it affects compatibility or rollback, add an ADR as `DECISIONS.md` requires.

## Checklist: adding a persisted field

1. Decide the layer: core gameplay state belongs in the core save (and needs a schema bump), stall menus and recipe choices in the runtime envelope (bump `RUNTIME_SCHEMA_VERSION` if older envelopes must be told apart), and player preferences in the preference store under a new key.
2. Give the field a default for older saves in the upgrade step, not in the parser of the older version.
3. Validate the field with the readers in `src/game/core/persistence/fields.ts`, naming its save path in the error message.
4. Copy it explicitly in `persistentStateFromGame` and restore it in `deserializeGameStateWithReport`.
5. Keep `camelCase` property names, and never rename an existing persisted field.
6. Add a fixture and tests as in the V5 checklist.
