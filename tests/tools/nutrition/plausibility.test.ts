/**
 * Unit tests for the nutrition importer's source plausibility rules and serving labels.
 *
 * Each rule runs on a small synthetic row, so the tests pin the thresholds and the
 * findings without the git-ignored source CSV.
 */
import { describe, expect, it } from "vitest";

import type { NutritionValue } from "@/src/content/types";
import { format_serving_label } from "@/tools/nutrition/importer.mjs";
import {
  build_subgroup_fences,
  find_implausible_values,
  parse_edible_share,
} from "@/tools/nutrition/plausibility.mjs";

type Nutrients = Record<string, NutritionValue>;

/** Reading of a synthetic row: its nutrients and its edible amount. */
interface Reading {
  nutrients: Nutrients;
  edibleAmount: number;
}

function known(value: number): NutritionValue {
  return { status: "known", value };
}

function build_nutrients(values: Record<string, number>): Nutrients {
  return Object.fromEntries(
    Object.entries(values).map(([metric, value]) => [metric, known(value)]),
  );
}

function scale_reading(reading: Reading, multiplier: number): Reading {
  return {
    edibleAmount: reading.edibleAmount * multiplier,
    nutrients: Object.fromEntries(
      Object.entries(reading.nutrients).map(([metric, value]) => [
        metric,
        value.status === "known" ? known(value.value * multiplier) : value,
      ]),
    ),
  };
}

function build_component_of(rows: Record<string, Reading>) {
  return (food_name: string, multiplier: number): Reading =>
    scale_reading(rows[food_name], multiplier);
}

describe("parse_edible_share", () => {
  it("reads a percentage and falls back to the whole serving", () => {
    expect(parse_edible_share("93.35%")).toBeCloseTo(0.9335, 6);
    expect(parse_edible_share("100%")).toBe(1);
    expect(parse_edible_share("-")).toBe(1);
    expect(parse_edible_share(undefined)).toBe(1);
    expect(parse_edible_share("140%")).toBe(1);
    expect(parse_edible_share("0%")).toBe(1);
  });
});

describe("format_serving_label", () => {
  it("rewrites source labels and keeps curated ones", () => {
    expect(format_serving_label("1 bowl(s) = 811g")).toBe("1 bowl (811 g)");
    expect(format_serving_label("2 piece(s) = 100g")).toBe("2 pieces (100 g)");
    expect(format_serving_label("1 regular cup(s) = 250ml")).toBe("1 regular cup (250 ml)");
    expect(format_serving_label("1 whole = 191g")).toBe("1 whole (191 g)");
    expect(format_serving_label("1 plate (200 g)")).toBe("1 plate (200 g)");
    expect(format_serving_label("250 ml")).toBe("250 ml");
  });
});

describe("find_implausible_values", () => {
  const no_fences = new Map<string, Partial<Record<string, number>>>();

  it("withholds a dish value below its own component row, with the component as stand-in", () => {
    const rows = {
      "Mee siam gravy": {
        edibleAmount: 400,
        nutrients: build_nutrients({ totalSugarG: 26, sodiumMg: 2_000, dietaryFibreG: 4 }),
      },
    };
    const withheld = find_implausible_values({
      food_name: "Mee siam",
      values: {},
      nutrients: build_nutrients({ totalSugarG: 7.6, sodiumMg: 3_754, dietaryFibreG: 30.9 }),
      edible_amount: 731,
      multiplier: 1,
      component_of: build_component_of(rows),
      fences: no_fences,
    });

    expect(withheld.map((value) => [value.metric, value.standIn])).toEqual([
      ["totalSugarG", 26],
      ["dietaryFibreG", undefined],
    ]);
    expect(withheld[1].reason).toContain("exceeds 13.9");
  });

  it("keeps a shortfall within the absolute or relative tolerance", () => {
    const rows = {
      "Lor mee gravy": {
        edibleAmount: 350,
        nutrients: build_nutrients({ sodiumMg: 1_540, totalSugarG: 5.9 }),
      },
    };
    const withheld = find_implausible_values({
      food_name: "Lor mee",
      values: {},
      nutrients: build_nutrients({ sodiumMg: 1_500, totalSugarG: 5 }),
      edible_amount: 700,
      multiplier: 1,
      component_of: build_component_of(rows),
      fences: no_fences,
    });

    expect(withheld).toEqual([]);
  });

  it("withholds a drink's sugar when its non-sugar carbohydrate departs from its base", () => {
    const rows = {
      "Kopi O kosong": {
        edibleAmount: 250,
        nutrients: build_nutrients({ carbohydrateG: 7.25, totalSugarG: 0 }),
      },
    };
    const withheld = find_implausible_values({
      food_name: "Kopi",
      values: {},
      nutrients: build_nutrients({ carbohydrateG: 34.33, totalSugarG: 19.05 }),
      edible_amount: 250,
      multiplier: 1,
      component_of: build_component_of(rows),
      fences: no_fences,
    });

    expect(withheld).toHaveLength(1);
    expect(withheld[0].metric).toBe("totalSugarG");
    expect(withheld[0].standIn).toBeCloseTo(27.08, 2);
  });

  it("never checks the base row against itself", () => {
    const rows = {
      "Kopi O kosong": { edibleAmount: 250, nutrients: build_nutrients({ carbohydrateG: 7.25 }) },
    };
    const withheld = find_implausible_values({
      food_name: "Kopi O kosong",
      values: {},
      nutrients: build_nutrients({ carbohydrateG: 7.25, totalSugarG: 0 }),
      edible_amount: 250,
      multiplier: 1,
      component_of: build_component_of(rows),
      fences: no_fences,
    });

    expect(withheld).toEqual([]);
  });

  it("withholds a value over twice its subgroup's far-out fence", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      values: { "Food Subgroup": "Rice dishes", calcium: String(20 + index) },
    }));
    const fences = build_subgroup_fences(rows, (values) => ({
      edibleAmount: 100,
      nutrients: build_nutrients({ calciumMg: Number(values.calcium) }),
    }));
    const fence = fences.get("Rice dishes")?.calciumMg ?? Number.NaN;

    const withheld = find_implausible_values({
      food_name: "Claypot chicken rice",
      values: { "Food Subgroup": "Rice dishes" },
      nutrients: build_nutrients({ calciumMg: 2.5 * fence * 5 }),
      edible_amount: 500,
      multiplier: 1,
      component_of: build_component_of({}),
      fences,
    });

    expect(fence).toBeCloseTo(34.25 + 3 * (34.25 - 24.75), 6);
    expect(withheld.map((value) => value.metric)).toEqual(["calciumMg"]);
  });

  it("fences nothing for a small subgroup or a row without a subgroup", () => {
    const small = Array.from({ length: 14 }, () => ({ values: { "Food Subgroup": "Tiny" } }));
    const unlabelled = Array.from({ length: 20 }, () => ({ values: {} }));
    const read = () => ({ edibleAmount: 100, nutrients: build_nutrients({ calciumMg: 10 }) });

    expect(build_subgroup_fences(small, read).get("Tiny")).toEqual({});
    expect(build_subgroup_fences(unlabelled, read).size).toBe(0);
  });
});
