import { describe, expect, it } from "vitest";

import { OPERATING_DAY_MS } from "@/src/game/core/progression";
import {
  active_rush_window,
  BASE_TIME_DEMAND,
  compute_time_demand,
  DEFAULT_RUSH_WINDOWS,
  DINNER_RUSH,
  is_last_orders,
  LUNCH_RUSH,
  ms_until_day_end,
  rush_bump_share,
} from "@/src/game/core/rush";
import { makeGame, runUntil, TEST_CATALOG } from "./fixtures";

/** Simulated milliseconds per in-game minute. */
const MS_PER_MINUTE = 1_000;
/** In-game minute at which the operating day opens (10:30). */
const OPENING_MINUTE = 10 * 60 + 30;

function elapsed_at(minute: number, day = 1): number {
  return (day - 1) * OPERATING_DAY_MS + (minute - OPENING_MINUTE) * MS_PER_MINUTE;
}

describe("rush demand curve", () => {
  it("peaks at each crowd's centre and fades to zero at its half-width", () => {
    expect(rush_bump_share(LUNCH_RUSH.centre_minute, LUNCH_RUSH)).toBe(1);
    expect(
      rush_bump_share(LUNCH_RUSH.centre_minute + LUNCH_RUSH.half_width_minutes, LUNCH_RUSH),
    ).toBe(0);
    expect(rush_bump_share(LUNCH_RUSH.centre_minute - 30, LUNCH_RUSH)).toBeCloseTo(0.5625, 12);
    expect(rush_bump_share(LUNCH_RUSH.centre_minute - 30, LUNCH_RUSH)).toBe(
      rush_bump_share(LUNCH_RUSH.centre_minute + 30, LUNCH_RUSH),
    );
  });

  it("has a lunch and a dinner peak above a calm afternoon", () => {
    const lunch = compute_time_demand(LUNCH_RUSH.centre_minute, DEFAULT_RUSH_WINDOWS);
    const afternoon = compute_time_demand(15 * 60, DEFAULT_RUSH_WINDOWS);
    const dinner = compute_time_demand(DINNER_RUSH.centre_minute, DEFAULT_RUSH_WINDOWS);
    expect(lunch).toBeCloseTo(BASE_TIME_DEMAND + LUNCH_RUSH.peak, 12);
    expect(dinner).toBeCloseTo(BASE_TIME_DEMAND + DINNER_RUSH.peak, 12);
    expect(afternoon).toBe(BASE_TIME_DEMAND);
    expect(lunch).toBeGreaterThan(dinner);
  });

  it("reports the rush core around each centre only", () => {
    expect(active_rush_window(12 * 60 + 30, DEFAULT_RUSH_WINDOWS)?.kind).toBe("lunch");
    expect(active_rush_window(17 * 60, DEFAULT_RUSH_WINDOWS)?.kind).toBe("dinner");
    expect(active_rush_window(15 * 60, DEFAULT_RUSH_WINDOWS)).toBeUndefined();
    expect(active_rush_window(11 * 60, DEFAULT_RUSH_WINDOWS)).toBeUndefined();
  });
});

describe("last orders", () => {
  it("closes from 18:10 until the day ends", () => {
    expect(is_last_orders(elapsed_at(18 * 60 + 9))).toBe(false);
    expect(is_last_orders(elapsed_at(18 * 60 + 10))).toBe(true);
    expect(is_last_orders(elapsed_at(18 * 60 + 29, 2))).toBe(true);
    expect(is_last_orders(elapsed_at(OPENING_MINUTE, 2))).toBe(false);
  });

  it("counts the milliseconds left in the operating day", () => {
    expect(ms_until_day_end(0)).toBe(OPERATING_DAY_MS);
    expect(ms_until_day_end(OPERATING_DAY_MS - 1)).toBe(1);
    expect(ms_until_day_end(OPERATING_DAY_MS)).toBe(OPERATING_DAY_MS);
  });

  it("spawns nobody in the adaptive model between last orders and the next opening", () => {
    const start = makeGame({
      catalog: TEST_CATALOG,
      config: {
        fixedStepMs: 100,
        spawnIntervalMs: 700,
        standard: { maxActiveCustomers: undefined },
      },
    });
    const before_last_orders = runUntil(
      { ...start, elapsedMs: elapsed_at(18 * 60), spawnCountdownMs: 0 },
      (state) => is_last_orders(state.elapsedMs),
      2_000,
    );
    const spawned_before = before_last_orders.metrics.spawnedCustomers;
    const at_close = runUntil(
      before_last_orders,
      (state) => !is_last_orders(state.elapsedMs),
      2_000,
    );
    expect(at_close.metrics.spawnedCustomers - spawned_before).toBe(0);
    const after_opening = runUntil(
      at_close,
      (state) => state.metrics.spawnedCustomers > at_close.metrics.spawnedCustomers,
      100,
    );
    expect(after_opening.metrics.spawnedCustomers).toBeGreaterThan(
      at_close.metrics.spawnedCustomers,
    );
  });
});
