import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  customerVariantLabel,
  CustomerNutritionInspector,
  DishRatingSummary,
  dialogFocusAction,
  NutritionDisclosure,
  NutritionProfileSummary,
  NutritionPulseCard,
  VariantLabDialog,
} from "@/app/game/NutritionEducation";

const root = new URL("../../../", import.meta.url);

describe("Hawker Balance nutrition education UI", () => {
  it("traps Variant Lab Tab focus and exposes an Escape close action", () => {
    expect(dialogFocusAction("Escape", false, 3, false, false)).toBe("close");
    expect(dialogFocusAction("Tab", true, 3, true, false)).toBe("last");
    expect(dialogFocusAction("Tab", false, 3, false, true)).toBe("first");
    expect(dialogFocusAction("Tab", false, 0, false, false)).toBe("container");
    expect(dialogFocusAction("Enter", false, 3, false, false)).toBeUndefined();
  });

  it("renders explicit profile states and every educational nutrient label", () => {
    const unavailable = renderToStaticMarkup(createElement(NutritionProfileSummary, {
      profile: { status: "unavailable" },
    }));
    expect(unavailable).toContain("Serving · Not available");
    for (const label of [
      "Energy",
      "Protein",
      "Total fat",
      "Saturated fat",
      "Trans fat",
      "Carbohydrate",
      "Total sugar",
      "Fibre",
      "Sodium",
      "Calcium",
      "Iron",
      "Water",
    ]) {
      expect(unavailable).toContain(label);
    }
    expect(unavailable).toContain("More nutrition details");

    const quarantined = renderToStaticMarkup(createElement(NutritionProfileSummary, {
      profile: { status: "quarantined" },
    }));
    expect(quarantined).toContain("Data under review");
  });

  it("renders Pulse empty states and separates health from popularity", () => {
    const empty = renderToStaticMarkup(createElement(NutritionPulseCard, {
      pulse: {
        servedMeals: 0,
        profiledMeals: 0,
        intentRequests: 0,
        intentMatches: 0,
        intentMisses: 0,
        intentUnknowns: 0,
        averages: {},
        knownCounts: { energyKcal: 0, proteinG: 0, dietaryFibreG: 0, sodiumMg: 0 },
      },
      dishLabel: (dishId: string) => dishId,
    }));
    expect(empty).toContain("No servings yet today");
    expect(empty).toContain("Health ≠ popularity");

    const populated = renderToStaticMarkup(createElement(NutritionPulseCard, {
      pulse: {
        servedMeals: 5,
        profiledMeals: 3,
        intentRequests: 4,
        intentMatches: 2,
        intentMisses: 1,
        intentUnknowns: 1,
        averages: { energyKcal: 500, proteinG: 18.25, dietaryFibreG: 4.5, sodiumMg: 720 },
        knownCounts: { energyKcal: 3, proteinG: 2, dietaryFibreG: 1, sodiumMg: 3 },
        mostServedDishId: "dish.kopi",
        leadingUnmetIntent: "sodium-aware",
      },
      dishLabel: () => "Kopi",
    }));
    expect(populated).toContain("3/5");
    expect(populated).toContain("2/4");
    expect(populated).toContain("500 kcal");
    expect(populated).toContain("2 known");
    expect(populated).toContain("Kopi is today");
    expect(populated).toContain("Sodium-aware is the leading unmet visit intent");
  });

  it("renders distinct accessible Health and Star ratings with condition detail", () => {
    const ratings = renderToStaticMarkup(createElement(DishRatingSummary, {
      healthRating: 4.2,
      starRating: 4.7,
    }));
    expect(ratings).toContain("Health rating: 4.2/5");
    expect(ratings).toContain("Star rating for taste and popularity: 4.7/5");

    const profile = renderToStaticMarkup(createElement(NutritionProfileSummary, {
      profile: {
        status: "released",
        servingLabel: "1 plate",
        healthRating: 4.2,
        conditionRatings: {
          diabetes: 4.4,
          hypertension: 3.8,
        },
      },
      starRating: 4.7,
    }));
    expect(profile).toContain("Health rating by condition");
    expect(profile).toContain("Managing diabetes");
    expect(profile).toContain("Managing hypertension");
  });

  it("renders rank locks, decision reasons, and neutral outcome wording", () => {
    const lab = renderToStaticMarkup(createElement(VariantLabDialog, {
      dishName: "Kopi",
      family: {
        dishId: "dish.kopi",
        defaultVariantId: "kopi-default",
        activeVariantId: "kopi-default",
        variants: [
          {
            id: "kopi-default",
            label: "Kopi",
            unlockRank: 1,
            visualKey: "kopi-milk-sugar-standard",
            unlocked: true,
            selected: true,
            profile: { status: "released", servingLabel: "1 cup" },
          },
          {
            id: "kopi-c",
            label: "Kopi C",
            unlockRank: 4,
            visualKey: "kopi-evaporated-milk-two-sugar",
            unlocked: false,
            selected: false,
            profile: { status: "released", servingLabel: "1 cup" },
          },
        ],
      },
      onChoose: () => undefined,
      onClose: () => undefined,
    }));
    expect(lab).toContain('role="radiogroup"');
    expect(lab).toContain("Unlocks at mastery rank 4");
    expect(lab).toContain("Changes apply to future orders only");

    const inspector = renderToStaticMarkup(createElement(CustomerNutritionInspector, {
      customer: {
        customerId: "customer-1",
        archetypeId: "regular",
        status: "eating",
        decisionReasons: ["Visit intent fit", "Price within visit budget", "Ignored"],
        intentId: "sodium-aware",
        dishId: "dish.kopi",
        variantId: "kopi-default",
        requestResult: "missed",
        healthConditionIds: ["hypertension"],
        personalizedHealthRating: 2.8,
        healthImpact: -0.02,
        healthPreferenceResult: "missed",
        healthDecisionReasons: [
          "Managing hypertension fit 2.8/5 is led by sodium and other nutrients",
        ],
      },
      dishLabel: () => "Kopi",
      starRating: () => 4.5,
      variantLabel: () => "Kopi",
      personaLabel: () => "Regular",
      onClose: () => undefined,
    }));
    expect(inspector).toContain("Trade-off · More sodium");
    expect(inspector).toContain("Why this choice");
    expect(inspector).toContain("Managing hypertension");
    expect(inspector).toContain("Personal health fit");
    expect(inspector).toContain("Star rating for taste and popularity: 4.5/5");
    expect(inspector).toContain("Customer stat effect");
    expect(inspector).toContain("-0.02 satisfaction");
    expect(inspector).toContain("Why this personal health fit");
    expect(inspector).not.toContain("Ignored");
  });

  it("uses player-facing labels for frozen serving selections", () => {
    expect(customerVariantLabel(
      [],
      "dish.poached-chicken-rice",
      "dish.poached-chicken-rice",
    )).toBe("Listed serving");
    expect(customerVariantLabel(
      [],
      "dish.poached-chicken-rice",
      "removed-internal-variant",
    )).toBeUndefined();
    expect(customerVariantLabel(
      [{
        dishId: "dish.kopi",
        defaultVariantId: "kopi-default",
        activeVariantId: "kopi-default",
        variants: [{
          id: "kopi-default",
          label: "Kopi",
          unlockRank: 1,
          visualKey: "kopi-milk-sugar-standard",
          unlocked: true,
          selected: true,
          profile: { status: "released", servingLabel: "1 cup" },
        }],
      }],
      "dish.kopi",
      "kopi-default",
    )).toBe("Kopi");
  });

  it("rebrands visible surfaces while preserving compatibility identifiers", async () => {
    const [layout, manifestSource, packageSource, serviceWorker] = await Promise.all([
      readFile(new URL("app/layout.tsx", root), "utf8"),
      readFile(new URL("public/manifest.webmanifest", root), "utf8"),
      readFile(new URL("package.json", root), "utf8"),
      readFile(new URL("public/sw.js", root), "utf8"),
    ]);
    const manifest = JSON.parse(manifestSource);
    const packageJson = JSON.parse(packageSource);

    expect(layout).toContain("Hawker Balance — Run the centre. Read the plate.");
    expect(manifest.name).toBe("Hawker Balance");
    expect(packageJson.name).toBe("hawker-simulator");
    expect(serviceWorker).toContain('const CACHE_PREFIX = "hawker-simulator-"');
  });

  it("titles the Pulse card above its kicker and neutral badge", () => {
    const pulse = renderToStaticMarkup(createElement(NutritionPulseCard, {
      pulse: {
        servedMeals: 0,
        profiledMeals: 0,
        intentRequests: 0,
        intentMatches: 0,
        intentMisses: 0,
        intentUnknowns: 0,
        averages: {},
        knownCounts: { energyKcal: 0, proteinG: 0, dietaryFibreG: 0, sodiumMg: 0 },
      },
      dishLabel: (dishId: string) => dishId,
    }));

    expect(pulse).toContain(
      '<div class="nutrition-pulse-heading"><div class="nutrition-pulse-heading-meta">'
        + '<span class="nutrition-pulse-kicker">Today&#x27;s menu read</span>'
        + '<span class="nutrition-neutral-badge">Health ≠ popularity</span></div>'
        + "<h2>Nutrition pulse</h2></div>",
    );
  });

  it("titles the Variant Lab dialog", () => {
    const lab = renderToStaticMarkup(createElement(VariantLabDialog, {
      dishName: "Kopi",
      family: {
        dishId: "dish.kopi",
        defaultVariantId: "kopi-default",
        activeVariantId: "kopi-default",
        variants: [],
      },
      onChoose: () => undefined,
      onClose: () => undefined,
    }));

    expect(lab).toContain(
      '<div><span>Variant Lab</span><h2 id="nutrition-lab-title">Tune Kopi</h2></div>',
    );
  });

  it("shows a trace nutrient as a trace amount", () => {
    const profile = renderToStaticMarkup(createElement(NutritionProfileSummary, {
      profile: { status: "released", servingLabel: "1 cup", transFatG: { status: "trace" } },
    }));

    expect(profile).toContain("<dt>Trans fat</dt><dd>Trace amount</dd>");
  });

  it("notes in the visit inspector that health traits are fictional", () => {
    const inspector = renderToStaticMarkup(createElement(CustomerNutritionInspector, {
      customer: {
        customerId: "customer-1",
        archetypeId: "regular",
        status: "eating",
        decisionReasons: [],
      },
      dishLabel: () => "Kopi",
      variantLabel: () => undefined,
      personaLabel: () => "Regular",
      onClose: () => undefined,
    }));

    expect(inspector).toContain(
      '<p class="nutrition-fiction-note">Health conditions and stat effects are simplified game traits, not a diagnosis or advice.</p>',
    );
  });

  it("discloses that health and star ratings are separate game scores, not a diagnosis", () => {
    const disclosure = renderToStaticMarkup(createElement(NutritionDisclosure));

    expect([
      disclosure.includes("The Star rating separately represents taste and popularity."),
      disclosure.includes("These scores are game mechanics—not a diagnosis"),
    ]).toEqual([true, true]);
  });
});
