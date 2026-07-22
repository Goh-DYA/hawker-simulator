import { describe, expect, it } from "vitest";

import {
  customerArchetypeSpawnWeight,
  sgdToCents,
  stepSimulation,
  type CustomerArchetype,
  type GameState,
} from "../../src/game/core";
import { makeGame, TEST_CATALOG } from "./fixtures";

const AFTERNOON_PERSONA: CustomerArchetype = {
  id: "afternoon",
  budget: 8,
  budgetCents: sgdToCents(8),
  patienceMs: 44_000,
  walkingSpeed: 2.25,
  priceSensitivity: 0.78,
  qualitySensitivity: 0.52,
  queueSensitivity: 0.82,
  distanceSensitivity: 0.66,
  unlockLevel: 3,
  unlockReputation: 0.6,
  visitSchedule: { startHour: 14, endHour: 18, peakMultiplier: 1.55 },
};

function runSteps(source: GameState, count: number): GameState {
  let state = source;
  for (let index = 0; index < count; index += 1) {
    state = stepSimulation(state);
  }
  return state;
}

describe("customer persona arrivals", () => {
  it("gates personas by progression and weights their authored visit window", () => {
    expect(customerArchetypeSpawnWeight(AFTERNOON_PERSONA, 2, 5, 14 * 60)).toBe(0);
    expect(customerArchetypeSpawnWeight(AFTERNOON_PERSONA, 3, 0.5, 14 * 60)).toBe(0);
    expect(customerArchetypeSpawnWeight(AFTERNOON_PERSONA, 3, 0.6, 10 * 60)).toBe(0.2);
    expect(customerArchetypeSpawnWeight(AFTERNOON_PERSONA, 3, 0.6, 14 * 60)).toBe(1.55);
  });

  it("uses the authored service-period clock instead of legacy elapsed-day time", () => {
    expect(customerArchetypeSpawnWeight(AFTERNOON_PERSONA, 3, 0.6, 13 * 60 + 59)).toBe(0.2);
    expect(customerArchetypeSpawnWeight(AFTERNOON_PERSONA, 3, 0.6, 17 * 60 + 59)).toBe(1.55);
    expect(customerArchetypeSpawnWeight(AFTERNOON_PERSONA, 3, 0.6, 18 * 60)).toBe(0.2);
  });

  it("keeps prerequisite-gated personas out until every requirement is unlocked", () => {
    const gated = {
      ...AFTERNOON_PERSONA,
      unlockPrerequisiteIds: ["stall.required"],
    };

    expect(
      customerArchetypeSpawnWeight(gated, 3, 0.6, 14 * 60, []),
    ).toBe(0);
    expect(
      customerArchetypeSpawnWeight(
        gated,
        3,
        0.6,
        14 * 60,
        ["stall.required"],
      ),
    ).toBe(1.55);
  });

  it("never spawns a locked persona", () => {
    const locked = {
      ...TEST_CATALOG.archetypes.valueSeeker,
      id: "locked",
      unlockLevel: 2,
    };
    const catalog = {
      ...TEST_CATALOG,
      archetypes: {
        regular: TEST_CATALOG.archetypes.regular,
        locked,
      },
    };
    const initial = makeGame({
      catalog,
      seed: "locked-persona",
      config: {
        fixedStepMs: 100,
        spawnIntervalMs: 1,
        maxVisitMs: 1_000_000,
        standard: { maxFixedStepsPerAdvance: 100 },
      },
    });
    const state = runSteps(initial, 30);

    expect(state.metrics.spawnedCustomers).toBeGreaterThan(0);
    expect(
      Object.values(state.customers).every(
        (customer) => customer.archetypeId === "regular",
      ),
    ).toBe(true);
  });
});
