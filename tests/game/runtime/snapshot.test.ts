/**
 * Unit tests for the focused HUD snapshot helpers in `runtime/snapshot.ts` and the nutrition
 * snapshot helpers in `runtime/nutrition.ts`.
 *
 * The full snapshot output stays pinned by the runtime goldens; these tests cover each helper's
 * branches directly: the cleanliness clamps and no-tray-return penalty, queue-direction
 * inference, the milestone tier clamp, the guest route, and the nutrition projections.
 */
import { describe, expect, it } from "vitest";
import { NUTRITION_CONTENT } from "@/src/content";
import {
  advanceSimulation,
  createEmptyNutritionMetrics,
  createSnapshot,
  MILESTONE_TRACKS,
  type Customer,
  type GridPoint,
  type NutritionMetrics,
  type SimulationCatalog,
} from "@/src/game/core";
import { buildCatalog } from "@/src/game/runtime/catalog";
import {
  build_customer_nutrition,
  build_nutrition_families,
  build_nutrition_pulse,
  runtimeNutritionProfile,
} from "@/src/game/runtime/nutrition";
import {
  build_milestone_tracks,
  estimate_hall_cleanliness,
  get_main_guest_route,
  resolve_queue_direction,
} from "@/src/game/runtime/snapshot";
import { create_fresh_session } from "@/src/game/runtime/world";

const QUIET_HALL = {
  cleanlinessSupport: 0,
  trayReturnStations: 1,
  customerCount: 0,
  queueCount: 0,
};

describe("estimate_hall_cleanliness", () => {
  it("adds support and tray returns and subtracts guests and queues from the base", () => {
    const cleanliness = estimate_hall_cleanliness({
      cleanlinessSupport: 1,
      trayReturnStations: 1,
      customerCount: 4,
      queueCount: 5,
    });

    expect(cleanliness).toBe(86 + 4 + 4 - 4 * 0.5 - 5 * 1.2);
  });

  it("clamps the estimate at 100", () => {
    expect(estimate_hall_cleanliness({ ...QUIET_HALL, cleanlinessSupport: 10 })).toBe(100);
  });

  it("clamps the estimate at 25", () => {
    expect(estimate_hall_cleanliness({ ...QUIET_HALL, customerCount: 40, queueCount: 40 })).toBe(
      25,
    );
  });

  it("applies the no-tray-return penalty only while guests are present", () => {
    const empty = estimate_hall_cleanliness({ ...QUIET_HALL, trayReturnStations: 0 });
    const busy = estimate_hall_cleanliness({
      ...QUIET_HALL,
      trayReturnStations: 0,
      customerCount: 2,
    });

    expect([empty, busy]).toEqual([86, 86 - 28 - 2 * 0.5]);
  });
});

describe("resolve_queue_direction", () => {
  const origin: GridPoint = { x: 5, y: 5 };

  it("prefers the stall's explicit direction over the planned cells", () => {
    expect(resolve_queue_direction("west", [origin, { x: 6, y: 5 }])).toBe("west");
  });

  it("infers the direction from the step between the first two cells", () => {
    const directions = [
      { x: 6, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
    ].map((second) => resolve_queue_direction(undefined, [origin, second]));

    expect(directions).toEqual(["east", "west", "north", "south"]);
  });

  it("faces south when fewer than two cells are planned", () => {
    expect([
      resolve_queue_direction(undefined, []),
      resolve_queue_direction(undefined, [origin]),
    ]).toEqual(["south", "south"]);
  });
});

describe("build_milestone_tracks", () => {
  const progress = { service: 10, hospitality: 80, variety: 3, growth: 4 };

  it("reports one track per core milestone track with its tier's target", () => {
    const tracks = build_milestone_tracks(progress, ["service-1", "growth-1", "growth-2"]);

    expect(tracks).toEqual([
      { id: "service", title: "Service", tier: 1, progress: 10, target: 250 },
      { id: "hospitality", title: "Hospitality", tier: 0, progress: 80, target: 75 },
      { id: "variety", title: "Variety", tier: 0, progress: 3, target: 2 },
      { id: "growth", title: "Growth", tier: 2, progress: 4, target: 12 },
    ]);
  });

  it("clamps the target to the last tier once every tier is claimed", () => {
    const service = MILESTONE_TRACKS.find((track) => track.id === "service")!;
    const claimed = service.targets.map((_, index) => `service-${index + 1}`);
    const [track] = build_milestone_tracks(progress, claimed);

    expect([track?.tier, track?.target]).toEqual([4, service.targets[3]]);
  });
});

describe("get_main_guest_route", () => {
  it("lists distinct cells from the entrance to the exit of the launch layout", () => {
    const { state, catalog } = create_fresh_session(buildCatalog().catalog);
    const snapshot = createSnapshot(state);
    const route = get_main_guest_route(snapshot, state.objects, catalog);
    const keys = route.map((point) => `${point.x},${point.y}`);
    const entrance = snapshot.accessPoints.find((point) => point.kind === "entrance")!.position;
    const exit = snapshot.accessPoints.find((point) => point.kind === "exit")!.position;

    expect([new Set(keys).size === keys.length, route[0], route.at(-1)]).toEqual([
      true,
      entrance,
      exit,
    ]);
  });

  it("is empty when there is no exit", () => {
    const { state, catalog } = create_fresh_session(buildCatalog().catalog);
    const snapshot = createSnapshot(state);
    const entrances = snapshot.accessPoints.filter((point) => point.kind === "entrance");

    expect(
      get_main_guest_route({ ...snapshot, accessPoints: entrances }, state.objects, catalog),
    ).toEqual([]);
  });
});

describe("build_nutrition_families", () => {
  it("marks variants above the dish mastery rank as locked and selects the active variant", () => {
    const {
      state,
      catalog,
      activeDishVariants: active_dish_variants,
    } = create_fresh_session(buildCatalog().catalog);
    const families = build_nutrition_families(state.progression, catalog, active_dish_variants);
    const locked_at_rank_one = families.flatMap((family) =>
      family.variants.filter((variant) => variant.unlockRank > 1),
    );

    expect([
      families.map((family) => family.dishId),
      families.every(
        (family) => family.variants.filter((variant) => variant.selected).length === 1,
      ),
      locked_at_rank_one.length > 0 && locked_at_rank_one.every((variant) => !variant.unlocked),
    ]).toEqual([NUTRITION_CONTENT.variantFamilies.map((family) => family.dishId), true, true]);
  });

  it("falls back to each family's default variant when no active variant is given", () => {
    const { state, catalog } = create_fresh_session(buildCatalog().catalog);
    const families = build_nutrition_families(state.progression, catalog, {});

    expect(families.every((family) => family.activeVariantId === family.defaultVariantId)).toBe(
      true,
    );
  });
});

describe("build_nutrition_pulse", () => {
  function metrics_for_day(day: number): NutritionMetrics {
    const empty = createEmptyNutritionMetrics();
    return {
      ...empty,
      today: {
        ...empty.today,
        day,
        servedMeals: 3,
        nutrientTotals: { ...empty.today.nutrientTotals, energyKcal: 1_500 },
        nutrientKnownCounts: { ...empty.today.nutrientKnownCounts, energyKcal: 3 },
        dishServings: { "dish-b": 2, "dish-a": 2, "dish-c": 1 },
      },
    };
  }

  it("summarises today's metrics when they belong to the current day", () => {
    const pulse = build_nutrition_pulse(metrics_for_day(2), 2);

    expect([
      pulse.servedMeals,
      pulse.averages,
      pulse.knownCounts.energyKcal,
      pulse.mostServedDishId,
    ]).toEqual([3, { energyKcal: 500 }, 3, "dish-a"]);
  });

  it("reads as an empty day when the stored metrics belong to an earlier day", () => {
    const pulse = build_nutrition_pulse(metrics_for_day(1), 2);

    expect(pulse).toEqual({
      servedMeals: 0,
      profiledMeals: 0,
      intentRequests: 0,
      intentMatches: 0,
      intentMisses: 0,
      intentUnknowns: 0,
      averages: {},
      knownCounts: { energyKcal: 0, proteinG: 0, dietaryFibreG: 0, sodiumMg: 0 },
      mostServedDishId: undefined,
      leadingUnmetIntent: undefined,
    });
  });
});

describe("build_customer_nutrition", () => {
  function spawn_customer(): { customer: Customer; catalog: SimulationCatalog } {
    const session = create_fresh_session(buildCatalog().catalog);
    const open_objects = Object.fromEntries(
      Object.entries(session.state.objects).map(([id, object]) => [id, { ...object, open: true }]),
    );
    const { state } = advanceSimulation(
      { ...session.state, objects: open_objects, spawnCountdownMs: 0 },
      session.state.config.fixedStepMs,
    );
    return { customer: Object.values(state.customers)[0]!, catalog: session.catalog };
  }

  it("copies the spawned customer's identity and status", () => {
    const { customer, catalog } = spawn_customer();
    const summary = build_customer_nutrition(customer, catalog);

    expect([summary.customerId, summary.archetypeId, summary.status, summary.intentId]).toEqual([
      customer.id,
      customer.archetypeId,
      customer.status,
      customer.nutritionIntentId,
    ]);
  });

  it("copies the customer's health conditions and ordered profile summary", () => {
    const { customer, catalog } = spawn_customer();
    const summary = build_customer_nutrition(customer, catalog);

    expect([summary.healthConditionIds, summary.profile]).toEqual([
      customer.healthConditions,
      runtimeNutritionProfile(customer.orderedNutritionProfile),
    ]);
  });
});
