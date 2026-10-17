/**
 * Golden master for save migration and the save/load round trip.
 *
 * The four fixtures are saves frozen from the unrefactored source, one per schema
 * version, all taken from the seed `soak-2026` run over the golden fixture inputs:
 *
 * - `save-v1.json`: map, access points and objects at step 600, plus money, xp and seed
 *   only. It has no level and no reputation, so it runs the whole V1 to V2 to V4 chain.
 * - `save-v2.json`: step 300 in the V2 shape, with entrance/exit and the five V2
 *   progression fields.
 * - `save-v3.json`: step 450 in the first V3 shape, without route guide points, nutrition
 *   objectives, `walkingMetricVersion` or nutrition metrics.
 * - `save-v4.json`: `persistentStateFromGame` at step 600, except that `recentOutcomes`
 *   holds every outcome the run recorded (more than 50), so the trim to the newest 50 on
 *   load is pinned too.
 *
 * Each fixture is checked three ways: the migrated V4 save, the `stateDigest` of the
 * loaded game, and the save string written back from it. The assertions hash raw
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
    migratedSaveSha256: "e3c5839b5ac3cc0be1856d62af68dc3102f6e4dff1be3c2642b4ac8011a8788c",
    stateDigestSha256: "eed0a00eabc995e3b76df4fde5e185279c60c939577a16bddb903978028e4981",
    serializedSaveSha256: "04a8849712bbf8d385d24eec5d9ae3eb1cebd1f746df5580a3bbab58ec606a9c",
  },
  {
    fileName: "save-v2.json",
    migratedSaveSha256: "6b77e90978e70d34d5ea64bddb3f10d94a82042e7cc0b2d325d28b319cfc15ea",
    stateDigestSha256: "e3d5f4852cad6bc1ae37827ce21be8054c689a06fde5e53fc62b1d6b1c6b2a74",
    serializedSaveSha256: "116f37fa577b17fd4f9bc14e7c61aaf33f76712fde8ef83cd836c336205c0d87",
  },
  {
    fileName: "save-v3.json",
    migratedSaveSha256: "9b5e02e400c6d1db8137b1b8f0c21060ff30c3c3957aee5926092039a62bff7c",
    stateDigestSha256: "b125f7956f4d6fe5728423666269b12c856c4f755e77f8faf8b42e2fabd2a526",
    serializedSaveSha256: "301beac9702f9eb75602621236fe74bfb2d80954541b41ac387c2e6407fa1a01",
  },
  {
    fileName: "save-v4.json",
    migratedSaveSha256: "7aaefd580d140377cafe1952f58839c7773132847b3f28678b8a34d22d3c533e",
    stateDigestSha256: "7fb033f92c289e956bf5ce5e6840daf30ea3a3c68e305cd36e300768720fd918",
    serializedSaveSha256: "5a3fca1f0a003dadf8733198e93a552e10bc4f92fdc1d86c37baf12605fb2e53",
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

describe.each(SAVE_FIXTURE_HASHES)("$fileName", (expected) => {
  it("migrates to the pinned V4 save", () => {
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
