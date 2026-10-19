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
 *   finished day-1 report, a peak reputation and a scheduled food writer.
 *
 * Each fixture is checked three ways: the migrated V5 save, the `stateDigest` of the
 * loaded game, and the save string written back from it. The V1 to V4 digests moved once
 * when V5 was added, because the current save and snapshot carry the new fields; the
 * fixtures themselves are unchanged. The assertions hash raw
 * strings, so field order is pinned as well as values. If a refactor makes one fail, the
 * refactor changed save handling: fix the code, never the literal or the fixture.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  deserializeGameState,
  migratePersistentState,
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
    migratedSaveSha256: "4527c2d5273293d47ae399f05c101a4964d8c5bd0eee2747cbf421e3d81d2416",
    stateDigestSha256: "e15efa271e5db406aebe5419504419674264a5e5f4ab2d01168b2507130dc24a",
    serializedSaveSha256: "1a4dcd9048d98675dab8bd2cab85f498a1aed103187a6aa2eda27ed372ee2dde",
  },
  {
    fileName: "save-v2.json",
    migratedSaveSha256: "2a358048b3166a30610306f4f358531950102d917e5257817abfd74360efb8fc",
    stateDigestSha256: "a51d8e426aec96c2ae570b95d1410aa83d36962572fcc970fbbbbd1397d7f6df",
    serializedSaveSha256: "3a93257b79b509841012980b024400955ccc7650a400b1bfb52c3da70ae8f8ee",
  },
  {
    fileName: "save-v3.json",
    migratedSaveSha256: "ba12f8341105da4f385319f9123ca15fa8fad90e55dea63f562895a704ba842c",
    stateDigestSha256: "d3f9dd8bc5169a2dcd3561f3529bc880200e5289cbae41a9ad4c9ba0430ec843",
    serializedSaveSha256: "e35e5d28717f88b91266b5f2de9b3b98617f94232397b3f2f3979cbce6e9bda5",
  },
  {
    fileName: "save-v4.json",
    migratedSaveSha256: "1a94014c72c2f7cc526bf5524e523c67d7264165d50f34afd87254587d08194f",
    stateDigestSha256: "3cb47752df4110e8cdcd3273cc4933e7299957ada3d6357ef0e5a110fc76bded",
    serializedSaveSha256: "4816edea55303a849151b2c891c6396901f9c5d7c36d68eadf786dc9d3e16745",
  },
  {
    fileName: "save-v5.json",
    migratedSaveSha256: "a3a2fae71a499a05ab4c17a23bf394935ba4fd5dceaf1778b8e3e49fdb3ea29d",
    stateDigestSha256: "0f77b0361f302ee3c1c3cfffcff3edbfb3ae965217c95bb0639137e88652db38",
    serializedSaveSha256: "536bc2c48c4b064cdf533eed384fe8b9cefd4ae695b9e838de24a9f83f507b38",
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
    expect(migrated.schemaVersion).toBe(5);
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

describe.each(SAVE_FIXTURE_HASHES)("$fileName", (expected) => {
  it("migrates to the pinned V5 save", () => {
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
