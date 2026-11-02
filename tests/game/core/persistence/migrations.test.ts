/**
 * Golden master for save migration and the save/load round trip.
 *
 * The fixtures are saves frozen one per schema version, all taken from the seed `soak-2026`
 * run over the golden fixture inputs (V1 to V4 from the unrefactored source):
 *
 * - `save-v1.json`: map, access points and objects at step 600, plus money, xp and seed
 *   only. It has no level and no reputation, so it runs the whole V1 to V2 to V5 chain.
 * - `save-v2.json`: step 300 in the V2 shape, with entrance/exit and the five V2
 *   progression fields.
 * - `save-v3.json`: step 450 in the first V3 shape, without route guide points, nutrition
 *   objectives, `walkingMetricVersion` or nutrition metrics.
 * - `save-v4.json`: `persistentStateFromGame` at step 600, except that `recentOutcomes`
 *   holds every outcome the run recorded (more than 50), so the trim to the newest 50 on
 *   load is pinned too.
 * - `save-v5.json`: `persistentStateFromGame` at step 5,400 of the adaptive run with world
 *   seed 2026 and four synthetic calendar cards, so it holds a neighbourhood on day 2 with a
 *   finished day-1 report, a peak reputation and a scheduled food writer. Its `elapsedMs`
 *   (540,000) counts eight-minute operating days: 11:30 on day 2.
 * - `save-v6.json`: the V5 fixture loaded and written back as V6, so its `elapsedMs`
 *   (660,000) counts ten-minute operating days and still reads 11:30 on day 2.
 *
 * Each fixture is checked three ways: the migrated V6 save, the `stateDigest` of the
 * loaded game, and the save string written back from it. The V1 to V4 digests moved once
 * when V5 was added, because the current save and snapshot carry the new fields, and every
 * earlier digest moved once when V6 was added, because the schema version and the re-counted
 * `elapsedMs` are part of the save; the fixtures themselves are unchanged. The assertions hash raw
 * strings, so field order is pinned as well as values. If a refactor makes one fail, the
 * refactor changed save handling: fix the code, never the literal or the fixture.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  deserializeGameState,
  migratePersistentState,
  operatingDay,
  operatingMinuteOfDay,
  serializeGameState,
  stateDigest,
  type SimulationCatalog,
} from "@/src/game/core";
import golden_inputs from "../fixtures/golden-inputs.json";

const TEST_CATALOG = golden_inputs.testCatalog as SimulationCatalog;

/** Number of nutrition outcomes a loaded save keeps. */
const KEPT_RECENT_OUTCOMES = 50;

/** Expected hashes for one frozen save fixture. */
interface SaveFixtureHashes {
  readonly fileName: string;
  readonly migratedSaveSha256: string;
  readonly stateDigestSha256: string;
  readonly serializedSaveSha256: string;
}

const SAVE_FIXTURE_HASHES: readonly SaveFixtureHashes[] = [
  {
    fileName: "save-v1.json",
    migratedSaveSha256: "64a660d9a400d54fdea4eee4fb817298a57b285a4c133d0f00b4d324032c56c8",
    stateDigestSha256: "de3253d890937083940e62dfbbbc97eaaa94752ac0536f11cd42aced1c47f6ac",
    serializedSaveSha256: "1c33118cd5dab42c17609852f3bf0ebe65f025f1d3236aa1dc0670978484c16b",
  },
  {
    fileName: "save-v2.json",
    migratedSaveSha256: "7f8cdc225e6d3a2e7354496ef0b0ba5c1e114e5e16c3c7ffc6ff3c4612bc3257",
    stateDigestSha256: "65f35175af1b50764c2cdc8d79601fd1da9f80348314bb4f3a856865e3fc4eb0",
    serializedSaveSha256: "93c5fa1e8df4be8fa128aabf9bd6acb287615c4a1d9d84517090ec6ac316a9f9",
  },
  {
    fileName: "save-v3.json",
    migratedSaveSha256: "cd1ced58c2e5dad99deeee0f136ac896c5d378de38f17dba96a088c9433c0858",
    stateDigestSha256: "251617b57962c5e606d7f194bfbdf9b8f2574b53cd4b7aaf0aa9ccc4207c78c9",
    serializedSaveSha256: "b6d439629b72e9a3d5e6858c6f09a1678c3774cf8bbc5b02ce37408739ca21dd",
  },
  {
    fileName: "save-v4.json",
    migratedSaveSha256: "df42b373391d1859c2100d3fabb26b6d4aa8476581456238ba14ea71b88c2fd8",
    stateDigestSha256: "d12a748cf55e070b10f7f292982e31438ad834ff8c00f99b3c09ce86dff09675",
    serializedSaveSha256: "ce80ab1528a4fb866da8945646aca2e9533355dd7fc824fe9dcb14727cb12b88",
  },
  {
    fileName: "save-v5.json",
    migratedSaveSha256: "46a5ebf8e7d67ba53ae79057edf8080aaf471f380e8aa86c35df5952eb5157e8",
    stateDigestSha256: "24ca23968102258d61ae36ad141c5e0edebbaf2893cf1f3a61c8d59bbfae1711",
    serializedSaveSha256: "99a1433e1af6c0825627d031a2d1a0a519f0eba2d5213bf272b8faad0edfe4aa",
  },
  {
    fileName: "save-v6.json",
    migratedSaveSha256: "46a5ebf8e7d67ba53ae79057edf8080aaf471f380e8aa86c35df5952eb5157e8",
    stateDigestSha256: "24ca23968102258d61ae36ad141c5e0edebbaf2893cf1f3a61c8d59bbfae1711",
    serializedSaveSha256: "99a1433e1af6c0825627d031a2d1a0a519f0eba2d5213bf272b8faad0edfe4aa",
  },
];

function hash_sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Parse a frozen save fixture afresh, so no test can see another test's changes. */
function load_save_fixture(file_name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${file_name}`, import.meta.url), "utf8"));
}

describe("frozen save fixtures", () => {
  it("keeps the V1 fixture to money, xp and seed, with no level", () => {
    const save = load_save_fixture("save-v1.json") as Record<string, unknown>;
    expect(Object.keys(save)).toEqual([
      "schemaVersion",
      "map",
      "entrance",
      "exit",
      "objects",
      "money",
      "xp",
      "seed",
    ]);
  });

  it("keeps more than 50 recent nutrition outcomes in the V4 fixture", () => {
    const save = load_save_fixture("save-v4.json") as {
      readonly metrics: { readonly nutrition: { readonly recentOutcomes: readonly unknown[] } };
    };
    expect(save.metrics.nutrition.recentOutcomes.length).toBeGreaterThan(KEPT_RECENT_OUTCOMES);
  });
});

describe("schema V5", () => {
  it("starts a migrated V4 save at its reputation peak and without a neighbourhood", () => {
    const v4 = load_save_fixture("save-v4.json") as { readonly progression: { readonly reputation: number } };
    const migrated = migratePersistentState(load_save_fixture("save-v4.json"));
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.progression.peakReputation).toBe(v4.progression.reputation);
    expect(migrated.neighbourhood).toBeNull();
  });

  it("keeps the V5 fixture's neighbourhood through a load and a save", () => {
    const fixture = load_save_fixture("save-v5.json") as { readonly neighbourhood: unknown };
    const loaded = deserializeGameState(load_save_fixture("save-v5.json"), TEST_CATALOG);
    expect(loaded.neighbourhood?.lastReport?.day).toBe(1);
    expect(loaded.neighbourhood?.calendar.day).toBe(2);
    expect(JSON.parse(JSON.stringify(loaded.neighbourhood))).toEqual(fixture.neighbourhood);
  });

  it("rejects a neighbourhood with an out-of-range tension", () => {
    const fixture = load_save_fixture("save-v5.json") as { neighbourhood: { tension: number } };
    fixture.neighbourhood.tension = 2;
    expect(() => migratePersistentState(fixture)).toThrow("neighbourhood.tension must be at most 1");
  });
});

describe("schema V6", () => {
  it("re-counts a V5 save's elapsed time on the ten-minute day, keeping its day and time of day", () => {
    const v5 = load_save_fixture("save-v5.json") as { readonly elapsedMs: number };
    const migrated = migratePersistentState(load_save_fixture("save-v5.json"));
    const v5_day_ms = 8 * 60 * 1_000;
    expect({
      schemaVersion: migrated.schemaVersion,
      day: operatingDay(migrated.elapsedMs),
      minute: operatingMinuteOfDay(migrated.elapsedMs),
    }).toEqual({
      schemaVersion: 6,
      day: 1 + Math.floor(v5.elapsedMs / v5_day_ms),
      minute: 10 * 60 + 30 + Math.floor((v5.elapsedMs % v5_day_ms) / 1_000),
    });
  });

  it("loads the V5 save on the day its neighbourhood calendar shows", () => {
    const loaded = deserializeGameState(load_save_fixture("save-v5.json"), TEST_CATALOG);
    expect([operatingDay(loaded.elapsedMs), loaded.neighbourhood?.calendar.day]).toEqual([2, 2]);
  });

  it("keeps a V6 save's elapsed time as it is", () => {
    const v6 = load_save_fixture("save-v6.json") as { readonly elapsedMs: number };
    expect(migratePersistentState(load_save_fixture("save-v6.json")).elapsedMs).toBe(v6.elapsedMs);
  });
});

describe.each(SAVE_FIXTURE_HASHES)("$fileName", (expected) => {
  it("migrates to the pinned V6 save", () => {
    const migrated = migratePersistentState(load_save_fixture(expected.fileName));
    expect(hash_sha256(JSON.stringify(migrated))).toBe(expected.migratedSaveSha256);
  });

  it("loads into the pinned game state", () => {
    const loaded = deserializeGameState(load_save_fixture(expected.fileName), TEST_CATALOG);
    expect(hash_sha256(stateDigest(loaded))).toBe(expected.stateDigestSha256);
  });

  it("writes the pinned save string after loading", () => {
    const loaded = deserializeGameState(load_save_fixture(expected.fileName), TEST_CATALOG);
    expect(hash_sha256(serializeGameState(loaded))).toBe(expected.serializedSaveSha256);
  });
});
