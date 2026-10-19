/**
 * Dish prices against their sources in `docs/design/DISH_PRICE_SOURCES.csv`.
 *
 * Every dish costs its 2025-26 heartland street price for the served portion, rounded half
 * up to whole dollars with a $2 floor. The suite checks that rule, the recorded source tier,
 * the parity orderings the price review recorded, and the price-health acceptance checks: a
 * menu's prices must not rise with its Health ratings, and most dishes rated 3.5 or above
 * must be affordable on a Student Saver's mid budget.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CUSTOMER_ARCHETYPES, DISHES, getNutritionProfile } from "@/src/content";
import { parseCsv } from "@/tools/nutrition/csv.mjs";

/** The lowest price of any dish, in whole dollars. */
const PRICE_FLOOR = 2;

/** The Health rating at or above which a dish counts as a higher-rated choice. */
const HIGHER_RATED_HEALTH = 3.5;

const SOURCE_TIERS = new Set(["SS25", "DATED", "EST"]);

const price_rows = parseCsv(
  readFileSync(new URL("../../docs/design/DISH_PRICE_SOURCES.csv", import.meta.url), "utf8"),
).rows.map((row) => row.values);

const price_by_id = new Map(DISHES.map((dish) => [dish.id, dish.price]));

function price_of(dish_id: string): number {
  const price = price_by_id.get(dish_id);
  if (price === undefined) throw new Error(`Unknown dish ${dish_id}`);
  return price;
}

function round_half_up(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Ranks values from one, giving tied values their average rank.
 *
 * @param values - The values to rank.
 * @returns The rank of each value, in input order.
 */
function compute_average_ranks(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks: number[] = Array.from({ length: values.length }, () => 0);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1].value === order[start].value) end += 1;
    for (let position = start; position <= end; position += 1) {
      ranks[order[position].index] = (start + end) / 2 + 1;
    }
    start = end + 1;
  }
  return ranks;
}

function compute_spearman(left: readonly number[], right: readonly number[]): number {
  const left_ranks = compute_average_ranks(left);
  const right_ranks = compute_average_ranks(right);
  const mean = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const left_mean = mean(left_ranks);
  const right_mean = mean(right_ranks);
  let covariance = 0;
  let left_spread = 0;
  let right_spread = 0;
  for (let index = 0; index < left_ranks.length; index += 1) {
    covariance += (left_ranks[index] - left_mean) * (right_ranks[index] - right_mean);
    left_spread += (left_ranks[index] - left_mean) ** 2;
    right_spread += (right_ranks[index] - right_mean) ** 2;
  }
  return covariance / Math.sqrt(left_spread * right_spread);
}

describe("dish prices", () => {
  it("lists every dish exactly once", () => {
    expect(price_rows).toHaveLength(DISHES.length);
    expect(new Set(price_rows.map((row) => row.dishId))).toEqual(
      new Set(DISHES.map((dish) => dish.id)),
    );
  });

  it("prices every dish at its rounded street price, with a $2 floor", () => {
    for (const row of price_rows) {
      const rule = Math.max(PRICE_FLOOR, round_half_up(Number(row.streetTypical)));
      expect(Number(row.price), row.dishId).toBe(rule);
      expect(price_of(row.dishId), row.dishId).toBe(rule);
    }
  });

  it("records a source tier and source for every price", () => {
    for (const row of price_rows) {
      expect(SOURCE_TIERS.has(row.tier), row.dishId).toBe(true);
      expect(row.source.trim().length, row.dishId).toBeGreaterThan(0);
    }
  });

  it("notes an exception only where the floor binds", () => {
    for (const row of price_rows) {
      const is_floored = round_half_up(Number(row.streetTypical)) < PRICE_FLOOR;
      expect(row.exception.trim().length > 0, row.dishId).toBe(is_floored);
    }
  });

  it("keeps the recorded parity orderings", () => {
    expect(price_of("dish.roast-chicken-rice")).toBe(price_of("dish.poached-chicken-rice"));
    expect(price_of("dish.char-siew-rice")).toBe(price_of("dish.poached-chicken-rice"));
    expect(price_of("dish.kopi")).toBe(price_of("dish.teh-tarik"));
    expect(price_of("dish.sugarcane-juice")).toBeGreaterThan(price_of("dish.kopi"));
    expect(price_of("dish.bak-chor-mee")).toBe(price_of("dish.fishball-mee-pok") + 1);
    expect(price_of("dish.babi-pongteh")).toBeGreaterThan(price_of("dish.ayam-buah-keluak"));
    expect(price_of("dish.ayam-buah-keluak")).toBeGreaterThan(price_of("dish.chap-chye"));
    for (const side of ["dish.babi-pongteh", "dish.ayam-buah-keluak", "dish.chap-chye"]) {
      expect(price_of("dish.nyonya-laksa")).toBeGreaterThanOrEqual(price_of(side));
    }
    const cheapest_noodles = Math.min(
      ...DISHES.filter((dish) => dish.category === "noodles").map((dish) => dish.price),
    );
    for (const dessert of DISHES.filter((dish) => dish.category === "dessert")) {
      expect(dessert.price, dessert.id).toBeLessThan(cheapest_noodles);
    }
    expect(price_of("dish.black-pepper-crab")).toBe(Math.max(...DISHES.map((dish) => dish.price)));
  });

  it("does not charge more for higher Health ratings, and keeps them affordable", () => {
    const rated = DISHES.map((dish) => ({
      price: dish.price,
      health: getNutritionProfile(dish.id)?.healthRating ?? Number.NaN,
    }));
    expect(
      compute_spearman(
        rated.map((dish) => dish.price),
        rated.map((dish) => dish.health),
      ),
    ).toBeLessThanOrEqual(0);

    const student = CUSTOMER_ARCHETYPES.find(
      (archetype) => archetype.id === "customer.student-saver",
    );
    expect(student).toBeDefined();
    const mid_budget = ((student?.budgetRange[0] ?? 0) + (student?.budgetRange[1] ?? 0)) / 2;
    const higher_rated = rated.filter((dish) => dish.health >= HIGHER_RATED_HEALTH);
    const affordable = higher_rated.filter((dish) => dish.price <= mid_budget);
    expect(affordable.length * 2).toBeGreaterThanOrEqual(higher_rated.length);
  });
});
