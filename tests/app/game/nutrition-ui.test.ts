// @vitest-environment jsdom
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { cleanup, render, within } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { nutritionProfileView } from "@/app/game/display";
import {
  customerVariantLabel,
  CustomerNutritionInspector,
  DishRatingSummary,
  dialogFocusAction,
  NutritionDisclosure,
  NutritionProfileSummary,
  NutritionPulseCard,
  VariantLabDialog,
  type NutritionProfileView,
} from "@/app/game/NutritionEducation";
import { NUTRITION_CONTENT } from "@/src/content";
import { coreNutritionProfile, runtimeNutritionProfile } from "@/src/game/runtime/nutrition";

// Under jsdom `import.meta.url` is not a file URL, so the root is the directory Vitest runs in.
const root = pathToFileURL(`${resolve(".")}/`);

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

  it("shows each variant's painted serving once the runtime has painted it", () => {
    const variant = {
      label: "Kopi",
      unlockRank: 1,
      visualKey: "kopi",
      unlocked: true,
      selected: false,
    };
    const lab = renderToStaticMarkup(createElement(VariantLabDialog, {
      dishName: "Kopi",
      family: {
        dishId: "dish.kopi",
        defaultVariantId: "kopi-default",
        activeVariantId: "kopi-default",
        variants: [
          { ...variant, id: "kopi-default", selected: true },
          { ...variant, id: "kopi-c", label: "Kopi C" },
        ],
      },
      variantPreview: (variantId: string) =>
        variantId === "kopi-c" ? "data:image/png;base64,S09QSQ==" : undefined,
      onChoose: () => undefined,
      onClose: () => undefined,
    }));

    expect([
      lab.split('<span class="variant-preview" aria-hidden="true">').length - 1,
      lab.includes(
        '<article data-locked="false" data-selected="false"><span class="variant-preview" aria-hidden="true"><img class="painted-preview" src="data:image/png;base64,S09QSQ=="',
      ),
    ]).toEqual([1, true]);
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

/**
 * A synthetic meal whose driving sodium amount is not reported, so the card must call the
 * excess an estimate. No released profile does this today (the content test keeps it so).
 */
const ESTIMATED_SODIUM_MEAL: NutritionProfileView = {
  status: "released",
  servingLabel: "1 bowl (500 g)",
  energyKcal: { status: "known", value: 500 },
  saturatedFatG: { status: "known", value: 5 },
  transFatG: { status: "unavailable", reason: "not-reported" },
  sodiumMg: { status: "unavailable", reason: "not-reported" },
  totalSugarG: { status: "known", value: 4 },
  healthRating: 2.6,
  healthParts: {
    nutrients: 3.6,
    conditions: 2.6,
    excess: 0.5,
    excessNutrient: "sodium",
    excessDayShare: 1.5,
  },
  conditionRatings: { "high-cholesterol": 3.6, obesity: 3.6, diabetes: 4, hypertension: 1.2 },
};

/** Renders a nutrition card and returns its Health rating disclosure. */
function render_health_details(
  profile: NutritionProfileView | undefined,
  options: { readonly healthLabel?: string } = {},
) {
  const { container } = render(
    createElement(NutritionProfileSummary, { profile, healthLabel: options.healthLabel }),
  );
  const details = container.querySelector<HTMLDetailsElement>("details.condition-rating-details");
  if (!details) throw new Error("The card has no Health rating disclosure");
  return details;
}

function summary_text(details: HTMLDetailsElement) {
  return details.querySelector("summary")?.textContent;
}

function line_texts(details: HTMLDetailsElement) {
  return [...details.querySelectorAll("li, p")].map((element) => element.textContent);
}

function meal_with_conditions(ratings: Readonly<Record<string, number>>): NutritionProfileView {
  return { ...ESTIMATED_SODIUM_MEAL, conditionRatings: ratings };
}

describe("meal Health rating card", () => {
  afterEach(() => {
    cleanup();
  });

  it("summarises how a meal's Health rating is built, naming the lowest condition", () => {
    const details = render_health_details(nutritionProfileView("dish.chicken-congee"));

    expect([
      summary_text(details),
      line_texts(details).includes(
        "1,434 mg sodium, 72% of the 2,000 mg daily sodium guideline",
      ),
    ]).toEqual([
      "How this Health rating is built: daily-guideline nutrients 4.3 and condition fit 3.5"
        + " · lowest: Managing hypertension 2.4",
      true,
    ]);
  });

  it("names the lowest condition only below 3.5, the first on a tie", () => {
    const summaries = [
      { "high-cholesterol": 3.6, obesity: 3.5, diabetes: 4, hypertension: 3.9 },
      { "high-cholesterol": 3.6, obesity: 3.4, diabetes: 4, hypertension: 3.9 },
      { "high-cholesterol": 3, obesity: 3.4, diabetes: 4, hypertension: 3 },
    ].map((ratings) => meal_with_conditions(ratings)).map((profile) => {
      const text = summary_text(render_health_details(profile));
      cleanup();
      return text;
    });

    expect(summaries).toEqual([
      "How this Health rating is built: daily-guideline nutrients 3.6 and condition fit 2.6",
      "How this Health rating is built: daily-guideline nutrients 3.6 and condition fit 2.6"
        + " · lowest: Managing obesity 3.4",
      "How this Health rating is built: daily-guideline nutrients 3.6 and condition fit 2.6"
        + " · lowest: Managing high cholesterol 3.0",
    ]);
  });

  it("names the general rating a guest's personal health fit card explains", () => {
    const { container } = render(createElement(CustomerNutritionInspector, {
      customer: {
        customerId: "customer-1",
        archetypeId: "regular",
        status: "eating",
        decisionReasons: [],
        dishId: "dish.chicken-congee",
        healthConditionIds: ["hypertension"],
        personalizedHealthRating: 2.4,
        profile: nutritionProfileView("dish.chicken-congee"),
      },
      dishLabel: () => "Chicken congee",
      variantLabel: () => undefined,
      personaLabel: () => "Regular",
      onClose: () => undefined,
    }));

    expect(container.querySelector("details.condition-rating-details summary")?.textContent)
      .toBe(
        "Health rating 3.9 is built from daily-guideline nutrients 4.3 and condition fit 3.5"
          + " · lowest: Managing hypertension 2.4",
      );
  });

  it("states a serving's sodium past a full day and the star it costs", () => {
    const details = render_health_details(nutritionProfileView("dish.mee-soto"));
    const excess = details.querySelector(".health-parts-excess");
    const deduction = within(details).getByRole("img", { name: "minus 1.0 star" });

    expect([excess?.textContent, deduction.textContent]).toEqual([
      "One serving holds 203% of the 2,000 mg daily sodium guideline (−1.0 star)",
      "(−1.0 star)",
    ]);
  });

  it("shows no deduction for a serving just past a full day", () => {
    const details = render_health_details(
      nutritionProfileView("dish.teochew-fish-dumpling-soup"),
    );

    expect([
      details.querySelector(".health-parts-excess")?.textContent,
      within(details).queryByRole("img"),
    ]).toEqual(["One serving holds 101% of the 2,000 mg daily sodium guideline", null]);
  });

  it("notes trans fat in the saturated fat row only when the profile reports some", () => {
    const with_trans = line_texts(render_health_details(nutritionProfileView("dish.mee-soto")));
    cleanup();
    const trace_trans = line_texts(
      render_health_details(nutritionProfileView("dish.chicken-congee")),
    );

    expect([
      with_trans.includes(
        "1.8 g saturated fat, 8% of the 22 g daily saturated fat guideline"
          + " (trans fat counted with it)",
      ),
      trace_trans.includes("3.5 g saturated fat, 16% of the 22 g daily saturated fat guideline"),
    ]).toEqual([true, true]);
  });

  it("lists the nutrients a meal is rated on per 100 g", () => {
    const plain_thosai = line_texts(
      render_health_details(nutritionProfileView("dish.masala-thosai")),
    );
    cleanup();
    const congee = line_texts(render_health_details(nutritionProfileView("dish.chicken-congee")));

    expect([
      plain_thosai.filter((line) => line?.startsWith("Also rated per 100 g")),
      congee.filter((line) => line?.startsWith("Also rated per 100 g")),
    ]).toEqual([
      ["Also rated per 100 g: 258 kcal, 2.8 g saturated fat (trans fat counted with it)"],
      [],
    ]);
  });

  it("calls an excess estimated when the driving amount is not reported", () => {
    const lines = line_texts(render_health_details(ESTIMATED_SODIUM_MEAL));

    expect([
      lines.includes("Sodium: Not available"),
      lines.includes(
        "One serving holds an estimated 150% of the 2,000 mg daily sodium guideline (−0.5 star)",
      ),
    ]).toEqual([true, true]);
  });

  it("keeps the condition disclosure for a drink", () => {
    const details = render_health_details(nutritionProfileView("dish.kopi"));

    expect([summary_text(details), details.querySelector(".health-parts-heading")]).toEqual([
      "Health rating by condition",
      null,
    ]);
  });

  it("explains in Help how a meal's Health rating is built", () => {
    const { container } = render(createElement(NutritionDisclosure));
    const heading = container.querySelector("h3");

    expect([heading?.textContent, heading?.nextElementSibling?.textContent]).toEqual([
      "How the Health rating is built",
      "For meals, the Health rating is half a score for energy, saturated fat, sodium and sugar"
        + " measured against daily guideline amounts, with credit for fibre and protein, and half"
        + " the four condition ratings, where the lowest counts as much as the other three"
        + " together. A serving holding more than a full day's amount of energy, saturated fat,"
        + " sodium or sugar (2,000 kcal, 22 g, 2,000 mg or 50 g) loses one more star for each"
        + " extra day. It describes one serving for a general adult and is not dietary advice.",
    ]);
  });

  // The copy rules: no judgement or suitability words, no "reference intake", and no "=",
  // since rebuilding the shown rating from the rounded parts can be off by 0.1.
  it("keeps every meal card within the copy rules", () => {
    const banned_words = /\b(good|bad|healthy|healthier|light|lighter|suited to|safe for)\b/i;
    const banned_terms = /\bRI\b|[Rr]eference intake|=/;
    const breaches = NUTRITION_CONTENT.profiles
      .filter((profile) => profile.healthParts)
      .flatMap((profile) => {
        const details = render_health_details(
          runtimeNutritionProfile(coreNutritionProfile(profile)),
        );
        const text = details.textContent ?? "";
        cleanup();
        const is_breach = banned_words.test(text) || banned_terms.test(text);
        return is_breach ? [`${profile.id}: ${text}`] : [];
      });

    expect(breaches).toEqual([]);
  });
});
