import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ComboBoardPlanner,
  FrozenMealInspector,
} from "../app/game/HawkerSimulator";
import { asMoneyCents } from "../src/game/core";
import type {
  RuntimeComboBoardSummary,
  RuntimeComboComponentSummary,
  RuntimeFrozenMealSummary,
} from "../src/game/runtime/types";

const root = new URL("../", import.meta.url);

const main: RuntimeComboComponentSummary = {
  preparationId: "dish.poached-chicken-rice::base",
  dishId: "dish.poached-chicken-rice",
  label: "Poached chicken rice",
  variantLabel: "Poached chicken with rice",
  servingLabel: "1 plate (350 g)",
  role: "main",
  componentLabel: "Main",
  availableStallCount: 1,
  terms: {
    priceCents: asMoneyCents(650),
    ingredientCostCents: asMoneyCents(240),
    preparationTimeMs: 15_000,
    servingTimeMs: 4_000,
    eatingTimeMs: 42_000,
    starAppeal: 4,
    demandModifierBasisPoints: 10_100,
  },
};

const drink: RuntimeComboComponentSummary = {
  preparationId: "dish.kopi::kopi-black-no-sugar",
  dishId: "dish.kopi",
  variantId: "kopi-black-no-sugar",
  label: "Kopi",
  variantLabel: "Kopi O kosong",
  servingLabel: "1 cup (240 ml)",
  role: "drink",
  componentLabel: "Drink",
  availableStallCount: 1,
  terms: {
    priceCents: asMoneyCents(180),
    ingredientCostCents: asMoneyCents(55),
    preparationTimeMs: 5_000,
    servingTimeMs: 2_000,
    eatingTimeMs: 20_000,
    starAppeal: 3,
    demandModifierBasisPoints: 10_500,
  },
};

const board: RuntimeComboBoardSummary = {
  unlockLevel: 5,
  unlocked: true,
  configuredOfferCount: 1,
  valid: true,
  issues: [],
  candidates: [main, drink],
  slots: [{
    id: "combo-slot-1",
    slot: 0,
    preparationIds: [main.preparationId, drink.preparationId],
    components: [main, drink],
    priceCents: asMoneyCents(830),
    ingredientCostCents: asMoneyCents(295),
    servingStopCount: 2,
    routeDistanceTiles: 11,
    valid: true,
    issues: [],
    mealBalance: {
      value: 3.8,
      dataState: "known",
      knownWeightBasisPoints: 8_200,
      explanation: "Comparative in-game balance among unlocked feasible options.",
    },
    intentFit: {
      value: 0.72,
      needId: "protein-forward",
      dataState: "known",
      explanation: "Leading forecast intent fit.",
    },
    conditionAwareFit: {
      dataState: "unavailable",
      explanation: "Frozen at order time.",
    },
    dataExplanation: "Both components have comparable released data.",
  }, null, null],
};

describe("Stage 3 Combo Board UI", () => {
  it("introduces the level-five cross-stall idea in the locked planner", () => {
    const html = renderToStaticMarkup(createElement(ComboBoardPlanner, {
      board: {
        ...board,
        unlocked: false,
        configuredOfferCount: 0,
        slots: [null, null, null],
      },
      locked: false,
      onSave: () => false,
      onClear: () => false,
    }));

    expect(html).toContain("Combo Board");
    expect(html).toContain("Build trust across the centre");
    expect(html).toContain("at most two reachable stall stops");
  });

  it("renders three labelled slots with full serving labels and additive SGD trade-offs", () => {
    const html = renderToStaticMarkup(createElement(ComboBoardPlanner, {
      board,
      locked: false,
      onSave: () => true,
      onClear: () => true,
    }));

    expect(html).toContain("Offer 1");
    expect(html).toContain("Offer 2");
    expect(html).toContain("Offer 3");
    expect(html).toContain("Board slot 1");
    expect(html).not.toContain("Board slot 2");
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("1 plate (350 g)");
    expect(html).toContain("1 cup (240 ml)");
    expect(html).toContain("Drink · Kopi");
    expect(html).toMatch(/aria-hidden="true">S\$8\.30<\/span>[\s\S]*? total · no discount/);
    expect(html).toMatch(/Ingredient cost [\s\S]*?aria-hidden="true">S\$2\.95<\/span>[\s\S]*?contribution [\s\S]*?aria-hidden="true">S\$5\.35<\/span>/);
    expect(html).toContain("8 Singapore dollars and 30 cents");
    expect(html).toContain("2 Singapore dollars and 95 cents");
    expect(html).toContain("5 Singapore dollars and 35 cents");
    expect(html.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("Meal balance");
    expect(html).toContain("Among unlocked feasible options");
    expect(html).toContain("82% source coverage");
    expect(html).toContain("Forecast intent fit");
    expect(html).toContain("Condition-aware game fit");
    expect(html).toContain("not treatment advice");
    expect(html).toContain("Compare component timing, Star appeal, and demand");
    expect(html).toContain('for="combo-main-0"');
    expect(html).toContain('for="combo-complement-0"');
  });

  it("never renders a numeric Combo Board rating when its data state is unavailable", () => {
    const unavailableBoard: RuntimeComboBoardSummary = {
      ...board,
      slots: [{
        ...board.slots[0]!,
        mealBalance: {
          value: 4.9,
          dataState: "unavailable",
          knownWeightBasisPoints: 6_900,
          explanation: "Not enough reported source data.",
        },
      }, null, null],
    };
    const html = renderToStaticMarkup(createElement(ComboBoardPlanner, {
      board: unavailableBoard,
      locked: false,
      onSave: () => true,
      onClear: () => true,
    }));

    expect(html).toContain("Unavailable");
    expect(html).toContain("69% source coverage");
    expect(html).not.toContain("4.9/5");

    const frozenHtml = renderToStaticMarkup(createElement(FrozenMealInspector, {
      meal: {
        offerId: "legacy-unavailable",
        components: [main, drink],
        priceCents: asMoneyCents(830),
        ingredientCostCents: asMoneyCents(295),
        chargedPriceCents: asMoneyCents(830),
        chargedIngredientCostCents: asMoneyCents(295),
        servingStopCount: 2,
        mealBalance: unavailableBoard.slots[0]!.mealBalance,
        intentFit: board.slots[0]!.intentFit,
        conditionAwareFit: board.slots[0]!.conditionAwareFit,
        explanationCodes: ["unavailable:insufficient-source-coverage"],
        settlementCause: "complete",
        servedPreparationIds: [main.preparationId, drink.preparationId],
        cancelledPreparationIds: [],
      },
    }));
    expect(frozenHtml).toContain("Unavailable");
    expect(frozenHtml).toContain("69% source coverage");
    expect(frozenHtml).not.toContain("4.9/5");
  });

  it("shows the charged subtotal and explicit uncharged cancellation for a partial meal", () => {
    const meal: RuntimeFrozenMealSummary = {
      offerId: "combo-slot-1",
      components: [main, drink],
      priceCents: asMoneyCents(830),
      ingredientCostCents: asMoneyCents(295),
      chargedPriceCents: asMoneyCents(650),
      chargedIngredientCostCents: asMoneyCents(240),
      servingStopCount: 2,
      mealBalance: board.slots[0]!.mealBalance,
      intentFit: board.slots[0]!.intentFit,
      conditionAwareFit: board.slots[0]!.conditionAwareFit,
      explanationCodes: ["trace-component:sodiumMg"],
      settlementCause: "second-stall-unavailable",
      servedPreparationIds: [main.preparationId],
      cancelledPreparationIds: [drink.preparationId],
    };
    const html = renderToStaticMarkup(createElement(FrozenMealInspector, { meal }));

    expect(html).toMatch(/Charged subtotal: [\s\S]*?aria-hidden="true">S\$6\.50<\/span>/);
    expect(html).toMatch(/Full two-item price: [\s\S]*?aria-hidden="true">S\$8\.30<\/span>/);
    expect(html).toContain("6 Singapore dollars and 50 cents");
    expect(html).toContain("8 Singapore dollars and 30 cents");
    expect(html).toContain("Cancelled · no charge");
    expect(html).toContain("second stall became unavailable");
    expect(html).toContain('data-state="trace"');
    expect(html).toContain("source-reported trace value");

    const pendingHtml = renderToStaticMarkup(createElement(FrozenMealInspector, {
      meal: {
        ...meal,
        settlementCause: undefined,
        cancelledPreparationIds: [],
      },
    }));
    expect(pendingHtml).toContain("waiting for temporary queue space");
    expect(pendingHtml).toContain("second component remains pending and uncharged");
  });

  it("keeps one bounded Dishes scroll owner and collapses comparisons at phone and 200% scale", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");
    const comboRules = css.slice(css.indexOf("/* Stage 3 Combo Board"));

    expect(comboRules).toMatch(/\.menu-manager\s*\{[\s\S]*?overflow-y:\s*auto;/);
    expect(comboRules).toMatch(/\.menu-manager > \.dish-list\s*\{[\s\S]*?overflow:\s*visible;/);
    expect(comboRules).toMatch(/\.combo-offer-fields select\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
    expect(comboRules).toMatch(/@media \(max-width: 480px\)[\s\S]*?\.combo-fit-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(comboRules).toMatch(/data-text-scale="large"[^}]*\.combo-fit-grid[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(comboRules).not.toMatch(/\.combo-board\s*\{[^}]*\bheight:\s*\d/);
  });

  it("keeps invalid exact preparations visible and blocks referenced menu or variant edits", async () => {
    const [simulator, runtime] = await Promise.all([
      readFile(new URL("app/game/HawkerSimulator.tsx", root), "utf8"),
      readFile(new URL("src/game/runtime/createHawkerRuntime.ts", root), "utf8"),
    ]);

    expect(simulator).toContain("Saved offer needs attention");
    expect(runtime).toContain("Restore the exact preparation or clear this retained offer");
    expect(runtime).toContain("comboOffersReferencingComponent(state.comboBoard");
    expect(runtime).toContain("before removing this exact preparation from the menu");
    expect(runtime).toContain("before changing this preparation");
    expect(runtime).toContain("validateComboBoardForState(\n          state,\n          state.comboBoard,\n          false");
    expect(runtime).toContain("newlyUnavailableComboOfferIds");
    expect(simulator).toContain("Live availability");
    expect(simulator).toContain("board.liveAvailabilityWarning");
  });

  it("replaces the latent composition disclaimer with visit-level and partial-meal truth", async () => {
    const simulator = await readFile(
      new URL("app/game/HawkerSimulator.tsx", root),
      "utf8",
    );

    expect(simulator).toContain("Partial two-item meals");
    expect(simulator).toContain("Completed two-item meals");
    expect(simulator).toContain("Combo Board results");
    expect(simulator).toContain("Each two-item meal counts once here");
    expect(simulator).toContain("Only served components were charged");
    expect(simulator).toContain("Each served visit scores once");
    expect(simulator).not.toContain("composed meals are not scored");
    expect(simulator).not.toContain("next programme stage");
  });
});
