import { describe, expect, it } from "vitest";
import {
  deserializeGameState,
  serializeGameState,
  type SimulationEvent,
  type VisitRating,
} from "../../src/game/core";
import {
  completedPartyDepartureCounts,
} from "../../src/game/runtime/createHawkerRuntime";
import { makeGame, TEST_CATALOG } from "./fixtures";

const exactRating: VisitRating = {
  customerId: "customer-exact-wait",
  walkingMetricVersion: 2,
  score: 84,
  served: true,
  abandoned: false,
  reason: "served",
  components: {
    foodQuality: 84,
    wait: 78,
    value: 80,
    walking: 86,
    comfort: 82,
    cleanliness: 90,
    ambience: 84,
  },
  waitMs: 42_500,
  day: 1,
  arrivalPeriodSequenceId: 1,
};

describe("Stage 5 mastery metric persistence", () => {
  it("round-trips exact wait and qualifying-flow measurements", () => {
    const base = makeGame({ seed: "stage5-mastery-metrics" });
    const state = {
      ...base,
      metrics: {
        ...base.metrics,
        qualifyingFlowMs: 183_400,
        visitRatings: [exactRating],
      },
    };

    const restored = deserializeGameState(
      serializeGameState(state),
      TEST_CATALOG,
      { config: state.config },
    );

    expect(restored.metrics.qualifyingFlowMs).toBe(183_400);
    expect(restored.metrics.visitRatings).toEqual([exactRating]);
  });

  it("defaults the additive flow counter when migrating a Stage 4 V7 save", () => {
    const base = makeGame({ seed: "stage4-v7-flow-migration" });
    const saved = JSON.parse(serializeGameState(base)) as {
      metrics: Record<string, unknown>;
    };
    delete saved.metrics.qualifyingFlowMs;

    const restored = deserializeGameState(saved, TEST_CATALOG, {
      config: base.config,
    });

    expect(restored.metrics.qualifyingFlowMs).toBe(0);
  });

  it("counts only fully served, normally completed party visits", () => {
    const events = [
      {
        type: "party-created",
        tick: 1,
        entityId: "party-a",
        message: "3",
      },
      {
        type: "customer-despawned",
        tick: 2,
        entityId: "party-a",
        message: "party-completed:3/3",
      },
      {
        type: "customer-despawned",
        tick: 3,
        entityId: "party-b",
        message: "party-completed:2/4",
      },
      {
        type: "customer-despawned",
        tick: 4,
        entityId: "party-c",
        message: "party-forced-after-stuck:4/4",
      },
      {
        type: "customer-despawned",
        tick: 5,
        entityId: "not-a-party",
        message: "party-completed:1/1",
      },
    ] satisfies readonly SimulationEvent[];

    expect(completedPartyDepartureCounts(events)).toEqual({
      partyVisits: 1,
      partyGuests: 3,
    });
  });
});
