/**
 * Tests of the painted-thumbnail helpers in `app/game/previews.tsx`: the cache key, the list of
 * thumbnails each panel asks the runtime for, and the decorative image they render as.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  collect_preview_requests,
  PaintedPreview,
  preview_key,
  type PreviewView,
} from "@/app/game/previews";
import { DISHES, PLACEABLES, STALLS } from "@/src/content";
import type { RuntimeNutritionFamilySummary } from "@/src/game/runtime/types";

/** The stall whose menu the Dishes panel cases show. */
const MENU_STALL_ID = "stall.coconut-lime";

/** A dish on that stall's menu. */
const MENU_DISH = DISHES.find((dish) => dish.stallIds.includes(MENU_STALL_ID))!;

/** A two-variant family of that dish, serving its second variant. */
const MENU_FAMILY: RuntimeNutritionFamilySummary = {
  dishId: MENU_DISH.id,
  defaultVariantId: "variant-a",
  activeVariantId: "variant-b",
  variants: [
    {
      id: "variant-a",
      label: "A",
      unlockRank: 1,
      profileId: "profile-a",
      visualKey: "a",
      unlocked: true,
      selected: false,
    },
    {
      id: "variant-b",
      label: "B",
      unlockRank: 1,
      profileId: "profile-b",
      visualKey: "b",
      unlocked: true,
      selected: true,
    },
  ],
};

/** A view of the Focus panel with nothing selected, which shows no thumbnails. */
const QUIET_VIEW: PreviewView = {
  panel: "focus",
  visiblePlaceables: PLACEABLES,
  menuStallId: MENU_STALL_ID,
  nutritionFamilies: [MENU_FAMILY],
  variantLabFamily: undefined,
  selectedId: undefined,
};

describe("preview_key", () => {
  it("keys a definition by its content ID", () => {
    expect(preview_key({ kind: "definition", id: "item.compact-square-table" })).toBe(
      "item.compact-square-table",
    );
  });

  it("keys a dish by its ID and the variant it is painted in", () => {
    expect([
      preview_key({ kind: "dish", id: "dish.kopi", variantId: "kopi-c" }),
      preview_key({ kind: "dish", id: "dish.kopi" }),
    ]).toEqual(["dish.kopi@kopi-c", "dish.kopi"]);
  });
});

describe("collect_preview_requests", () => {
  it("asks for nothing on a panel without thumbnails", () => {
    expect(collect_preview_requests(QUIET_VIEW)).toEqual([]);
  });

  it("asks for every placeable the Build catalogue shows, in order", () => {
    const visible = PLACEABLES.slice(0, 3);

    expect(
      collect_preview_requests({ ...QUIET_VIEW, panel: "build", visiblePlaceables: visible }),
    ).toEqual(visible.map((item) => ({ kind: "definition", id: item.id })));
  });

  it("asks for every stall on the Stalls panel", () => {
    expect(collect_preview_requests({ ...QUIET_VIEW, panel: "stalls" })).toEqual(
      STALLS.map((stall) => ({ kind: "definition", id: stall.id })),
    );
  });

  it("asks for the chosen stall's dishes in the variants they serve", () => {
    const requests = collect_preview_requests({ ...QUIET_VIEW, panel: "dishes" });

    expect(requests).toEqual(
      DISHES.filter((dish) => dish.stallIds.includes(MENU_STALL_ID)).map((dish) => ({
        kind: "dish",
        id: dish.id,
        variantId: dish.id === MENU_DISH.id ? "variant-b" : undefined,
      })),
    );
  });

  it("adds the Variant Lab's variants and the selected item without duplicates", () => {
    const requests = collect_preview_requests({
      ...QUIET_VIEW,
      panel: "dishes",
      variantLabFamily: MENU_FAMILY,
      selectedId: STALLS[0]!.id,
    });
    const keys = requests.map(preview_key);

    expect([
      keys.filter((key) => key === `${MENU_DISH.id}@variant-b`).length,
      keys.includes(`${MENU_DISH.id}@variant-a`),
      keys.at(-1),
    ]).toEqual([1, true, STALLS[0]!.id]);
  });
});

describe("PaintedPreview", () => {
  it("renders the data URL as a decorative image", () => {
    expect(
      renderToStaticMarkup(createElement(PaintedPreview, { src: "data:image/png;base64,AAAA" })),
    ).toBe(
      '<img class="painted-preview" src="data:image/png;base64,AAAA" alt="" draggable="false" decoding="async"/>',
    );
  });
});
