// @vitest-environment jsdom
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
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

/** Renders a nutrition card and returns its Health rating badge. */
function render_health_badge(
  profile: NutritionProfileView | undefined,
  options: { readonly healthLabel?: string; readonly healthRating?: number } = {},
) {
  const { container } = render(createElement(NutritionProfileSummary, { profile, ...options }));
  const badge = container.querySelector<HTMLElement>(".dish-rating-badge.is-health");
  if (!badge) throw new Error("The card has no Health rating badge");
  return badge;
}

/** Reads a badge's tooltip lines and their tones. */
function tip_lines(badge: HTMLElement) {
  return [...badge.querySelectorAll('[role="tooltip"] li')].map(
    (line) => `${line.getAttribute("data-tone") ?? "none"}: ${line.textContent}`,
  );
}

describe("Health rating reasons tooltip", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists a meal's main reasons in plain words, concerns first", () => {
    const badge = render_health_badge(nutritionProfileView("dish.chicken-congee"));
    const trigger = within(badge).getByRole("button", { name: "Why this health rating" });

    expect([trigger.getAttribute("aria-describedby"), tip_lines(badge)]).toEqual([
      badge.querySelector('[role="tooltip"]')?.id,
      ["concern: High in sodium", "strength: High in protein", "strength: Low in sugar"],
    ]);
  });

  it("explains a drink and a dessert the same way as a meal", () => {
    const drinks = tip_lines(render_health_badge(nutritionProfileView("dish.kopi")));
    cleanup();
    const dessert = tip_lines(render_health_badge(nutritionProfileView("dish.ice-kacang")));

    expect([drinks, dessert]).toEqual([
      ["concern: Likely high in sugar", "concern: Moderate saturated fat"],
      ["concern: High in sugar", "concern: High in energy", "strength: High in fibre"],
    ]);
  });

  it("names a guest's personal health fit in the button and keeps the dish's reasons", () => {
    const badge = render_health_badge(nutritionProfileView("dish.chicken-congee"), {
      healthLabel: "Personal health fit",
      healthRating: 2.4,
    });

    expect([
      within(badge).getByRole("button", { name: "Why this personal health fit" }) !== null,
      tip_lines(badge)[0],
    ]).toEqual([true, "concern: High in sodium"]);
  });

  it("says a rating without reviewed data has no reasons, and an unrated badge has no button", () => {
    const quarantined = render_health_badge({ status: "quarantined", healthRating: 3 });
    const quarantined_lines = tip_lines(quarantined);
    cleanup();
    const unrated = render_health_badge(undefined);

    expect([quarantined_lines, within(unrated).queryByRole("button")]).toEqual([
      ["none: No reviewed nutrition data yet"],
      null,
    ]);
  });

  it("hides on Escape without passing the key on, and shows again after focus leaves", () => {
    const outer_keys: string[] = [];
    const record_key = (event: globalThis.KeyboardEvent) => outer_keys.push(event.key);
    document.addEventListener("keydown", record_key);
    const badge = render_health_badge(nutritionProfileView("dish.chicken-congee"));
    const trigger = within(badge).getByRole("button");
    const wrapper = trigger.parentElement;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Escape" });
    const dismissed = wrapper?.getAttribute("data-dismissed");
    fireEvent.keyDown(trigger, { key: "Escape" });
    fireEvent.blur(trigger);
    document.removeEventListener("keydown", record_key);

    expect([dismissed, wrapper?.getAttribute("data-dismissed"), outer_keys]).toEqual([
      "true",
      null,
      ["Escape"],
    ]);
  });

  it("keeps the per-condition disclosure for meals and drinks alike", () => {
    const summaries = ["dish.chicken-congee", "dish.kopi"].map((dish_id) => {
      const { container } = render(
        createElement(NutritionProfileSummary, { profile: nutritionProfileView(dish_id) }),
      );
      const details = container.querySelector("details.condition-rating-details");
      const text = [details?.querySelector("summary")?.textContent, details?.querySelectorAll("p").length];
      cleanup();
      return text;
    });

    expect(summaries).toEqual([
      ["Health rating by condition", 0],
      ["Health rating by condition", 0],
    ]);
  });

  it("says in Help what the Health rating reflects, without its scoring", () => {
    const { container } = render(createElement(NutritionDisclosure));
    const heading = container.querySelector("h3");

    expect([heading?.textContent, heading?.nextElementSibling?.textContent]).toEqual([
      "What the Health rating reflects",
      "A meal's Health rating weighs one serving's energy, saturated fat, sodium and sugar"
        + " against daily guideline amounts (2,000 kcal, 22 g, 2,000 mg and 50 g), counts its"
        + " fibre and protein, and reflects how it suits each health condition. A drink's follows"
        + " its sugar and saturated fat bands. The i beside a Health rating lists its main"
        + " reasons. It describes one serving for a general adult and is not dietary advice.",
    ]);
  });

  // The copy rules: no judgement or suitability words, and nothing that gives away the scoring.
  it("keeps every tooltip within the copy rules", () => {
    const banned_words = /\b(good|bad|healthy|healthier|light|lighter|suited to|safe for)\b/i;
    const scoring_words = /\b(score|weight|stars?|lowest|built|points?|half|third)\b|[=%]/i;
    const breaches = NUTRITION_CONTENT.profiles.flatMap((profile) => {
      const badge = render_health_badge(runtimeNutritionProfile(coreNutritionProfile(profile)));
      const text = badge.querySelector('[role="tooltip"]')?.textContent ?? "";
      cleanup();
      const is_breach = text === "" || banned_words.test(text) || scoring_words.test(text);
      return is_breach ? [`${profile.id}: ${text}`] : [];
    });

    expect(breaches).toEqual([]);
  });
});
