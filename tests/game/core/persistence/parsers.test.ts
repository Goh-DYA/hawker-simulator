/**
 * Characterisation of how the save loader checks enumerated fields.
 *
 * Tiles, rotations, queue directions, the quality mode, objective kinds and criteria,
 * nutrition intents and unavailable-nutrient reasons are each checked against a fixed list.
 * The runtime shows a failed load's message to the player, so each message is pinned word
 * for word, together with the order of checks and the quirks the loader has always had.
 * Each case starts from the frozen V4 fixture and breaks one thing.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  deserializeGameState,
  NUTRITION_METRICS,
  PersistenceError,
  type SimulationCatalog,
} from "@/src/game/core";
import golden_inputs from "../fixtures/golden-inputs.json";

const TEST_CATALOG = golden_inputs.testCatalog as SimulationCatalog;

/** A save field bag that a test may break before loading it. */
type SaveRecord = Record<string, unknown>;

/** Parse the frozen V4 fixture afresh, so no test can see another test's changes. */
function load_v4_save(): SaveRecord {
  return JSON.parse(
    readFileSync(new URL("./fixtures/save-v4.json", import.meta.url), "utf8"),
  ) as SaveRecord;
}

/**
 * Return a copy of the V4 save with one daily objective's fields overridden.
 *
 * @param index - The position of the objective to change.
 * @param fields - The fields to set on it.
 * @returns The changed save.
 */
function with_objective(index: number, fields: SaveRecord): SaveRecord {
  const save = load_v4_save();
  const progression = save.progression as SaveRecord;
  const objectives = [...(progression.dailyObjectives as SaveRecord[])];
  objectives[index] = { ...objectives[index], ...fields };
  return { ...save, progression: { ...progression, dailyObjectives: objectives } };
}

/**
 * Return a copy of the V4 save with the last recent nutrition outcome's fields overridden.
 *
 * The loader keeps only the last 50 outcomes, so the last one is index 49 in its paths.
 *
 * @param fields - The fields to set on the outcome.
 * @returns The changed save.
 */
function with_recent_outcome(fields: SaveRecord): SaveRecord {
  const save = load_v4_save();
  const metrics = save.metrics as SaveRecord;
  const nutrition = metrics.nutrition as SaveRecord;
  const outcomes = [...(nutrition.recentOutcomes as SaveRecord[])];
  const last = outcomes.length - 1;
  outcomes[last] = { ...outcomes[last], ...fields };
  return {
    ...save,
    metrics: { ...metrics, nutrition: { ...nutrition, recentOutcomes: outcomes } },
  };
}

/**
 * Build a released meal profile whose nutrients are all unavailable.
 *
 * @param energy_reason - The reason stored on the energy value, or undefined for none.
 * @returns The profile record.
 */
function build_unavailable_profile(energy_reason: unknown): SaveRecord {
  const nutrients = Object.fromEntries(
    NUTRITION_METRICS.map((metric) => [metric, { status: "unavailable" }]),
  ) as SaveRecord;
  nutrients.energyKcal = { status: "unavailable", reason: energy_reason };
  return {
    id: "profile.test",
    dishId: "rice",
    status: "released",
    nutritionClass: "meal",
    nutrients,
    intentFits: {},
  };
}

/**
 * Load a save and return the message of the PersistenceError it throws.
 *
 * @param save - The save to load.
 * @returns The error message.
 * @throws Error If the load succeeds or throws something other than a PersistenceError.
 */
function rejection_message(save: SaveRecord): string {
  try {
    deserializeGameState(save, TEST_CATALOG);
  } catch (error) {
    if (error instanceof PersistenceError) return error.message;
    throw error;
  }
  throw new Error("Expected the load to fail");
}

describe("save loader vocabulary checks", () => {
  it("rejects an unknown tile kind", () => {
    const save = load_v4_save();
    const map = save.map as SaveRecord;
    const tiles = [...(map.tiles as string[])];
    tiles[0] = "lava";
    expect(rejection_message({ ...save, map: { ...map, tiles } })).toBe("map.tiles[0] is invalid");
  });

  it("rejects a rotation that is not a right angle", () => {
    const save = load_v4_save();
    const objects = (save.objects as SaveRecord[]).map((object, index) =>
      index === 0 ? { ...object, rotation: 45 } : object,
    );
    expect(rejection_message({ ...save, objects })).toBe("objects[0].rotation is invalid");
  });

  it("rejects an unknown queue direction", () => {
    const save = load_v4_save();
    const objects = (save.objects as SaveRecord[]).map((object, index) =>
      index === 0 ? { ...object, queueDirection: "up" } : object,
    );
    expect(rejection_message({ ...save, objects })).toBe("objects[0].queueDirection is invalid");
  });

  it("rejects an unknown quality mode", () => {
    expect(rejection_message({ ...load_v4_save(), qualityMode: "ultra" })).toBe(
      "qualityMode is invalid",
    );
  });

  it("rejects an unknown objective kind before checking the completed flag", () => {
    expect(rejection_message(with_objective(0, { kind: "dance", completed: "yes" }))).toBe(
      "progression.dailyObjectives[0].kind is invalid",
    );
  });

  it("accepts an objective kind that only matches after string coercion", () => {
    const state = deserializeGameState(with_objective(0, { kind: ["serve"] }), TEST_CATALOG);
    expect(state.progression.dailyObjectives[0]?.kind).toEqual(["serve"]);
  });

  it("rejects an unknown nutrition objective criterion", () => {
    expect(rejection_message(with_objective(2, { nutritionCriterion: "fastest" }))).toBe(
      "progression.dailyObjectives[2].nutritionCriterion is invalid",
    );
  });

  it("ignores the criterion of an objective that is not a nutrition objective", () => {
    const state = deserializeGameState(
      with_objective(0, { nutritionCriterion: "fastest" }),
      TEST_CATALOG,
    );
    expect(state.progression.dailyObjectives[0]?.nutritionCriterion).toBeUndefined();
  });

  it("rejects an unknown nutrition intent on a recent outcome", () => {
    expect(rejection_message(with_recent_outcome({ intentId: "keto" }))).toBe(
      "metrics.nutrition.recentOutcomes[49].intentId is invalid",
    );
  });

  it("rejects an unknown reason on an unavailable nutrient", () => {
    expect(
      rejection_message(with_recent_outcome({ profile: build_unavailable_profile("lost") })),
    ).toBe("metrics.nutrition.recentOutcomes[49].profile.nutrients.energyKcal.reason is invalid");
  });

  it("accepts an unavailable nutrient without a reason", () => {
    const state = deserializeGameState(
      with_recent_outcome({ profile: build_unavailable_profile(undefined) }),
      TEST_CATALOG,
    );
    expect(state.metrics.nutrition.recentOutcomes[49]?.profile?.nutrients.energyKcal).toEqual({
      status: "unavailable",
      reason: undefined,
    });
  });
});
