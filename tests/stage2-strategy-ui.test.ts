import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CUSTOMER_ARCHETYPES, DISHES, PLACEABLES, STALLS } from "../src/content";
import {
  PREPARATION_GAMEPLAY_CATALOGUE,
} from "../src/content/preparationGameplay";
import {
  DEFAULT_PERIOD_DEMAND_PROFILES,
  derivePeriodForecast,
  lockForecastAudience,
} from "../src/game/core";
import { formatSgd } from "../src/game/runtime/money";
import { preparationDurationLabel } from "../app/game/NutritionEducation";
import {
  debriefTryNextCopy,
  guidedOptionAdvantageCount,
  guidedPairScore,
  guidedRevealCopy,
  HawkerSimulator,
  INITIAL_RUNTIME_FORECAST,
  meaningfulServiceAnnouncement,
  selectGuidedTradeoffPair,
  type GuidedDecisionOption,
} from "../app/game/HawkerSimulator";

const root = new URL("../", import.meta.url);

function guideOption(
  id: string,
  terms: Partial<GuidedDecisionOption["terms"]> = {},
  intentFit = 0.5,
): GuidedDecisionOption {
  return {
    dishId: `dish.${id}`,
    responseId: id,
    label: id,
    intentFit,
    terms: {
      priceCents: 1_000,
      ingredientCostCents: 500,
      preparationTimeMs: 10_000,
      servingTimeMs: 4_000,
      eatingTimeMs: 30_000,
      starAppeal: 3,
      demandModifierBasisPoints: 10_000,
      ...terms,
    },
  };
}

describe("Stage 2 player-facing strategy UI", () => {
  it("has a genuine two-option nutrition decision at the authored starting progression", () => {
    const unlockedStallIds = new Set(STALLS.filter((stall) => (
      stall.unlockRequirement.level <= 1 && stall.unlockRequirement.reputation <= 8
    )).map((stall) => stall.id));
    const unlockedDishIds = new Set(DISHES.filter((dish) => (
      dish.unlockRequirement.level <= 1
      && dish.unlockRequirement.reputation <= 8
      && dish.unlockRequirement.prerequisiteIds.every((id) => unlockedStallIds.has(id))
    )).map((dish) => dish.id));
    const unlockedPreparationIds = PREPARATION_GAMEPLAY_CATALOGUE.filter((preparation) => (
      unlockedDishIds.has(preparation.dishId)
      && preparation.unlockRank <= 1
      && preparation.nutritionAudit.status === "released"
    )).map((preparation) => preparation.id);
    const forecast = derivePeriodForecast(DEFAULT_PERIOD_DEMAND_PROFILES[0]!, 1, 1);

    expect(forecast.nutritionNeeds.some((need) => need.kind === "nutrition-intent")).toBe(true);
    expect(unlockedPreparationIds.length).toBeGreaterThanOrEqual(2);
    expect(new Set(unlockedPreparationIds).size).toBeGreaterThanOrEqual(2);
    for (const responseId of unlockedPreparationIds) {
      expect(PREPARATION_GAMEPLAY_CATALOGUE.some((entry) => entry.id === responseId)).toBe(true);
    }
  });

  it("server-renders the shared core breakfast forecast on first paint", () => {
    const html = renderToStaticMarkup(createElement(HawkerSimulator));
    const initialUnlockedContentIds = [...PLACEABLES, ...STALLS]
      .filter((definition) => definition.unlockRequirement.level <= 1)
      .map((definition) => definition.id);
    const initialPersonaIds = CUSTOMER_ARCHETYPES.filter((persona) => (
      persona.unlockRequirement.level <= 1
      && persona.unlockRequirement.reputation <= 8
      && persona.unlockRequirement.prerequisiteIds.every((id) => (
        initialUnlockedContentIds.includes(id)
      ))
    )).map((persona) => persona.id);
    const expectedForecast = lockForecastAudience(
      derivePeriodForecast(DEFAULT_PERIOD_DEMAND_PROFILES[0]!, 1, 1),
      initialPersonaIds,
    );
    const expectedRange = `${expectedForecast.demandRange[0]}–${expectedForecast.demandRange[1]} visits`;

    expect(INITIAL_RUNTIME_FORECAST.demandRange).toEqual(expectedForecast.demandRange);
    expect(INITIAL_RUNTIME_FORECAST.nutritionIntentIncidenceBasisPoints).toBe(
      expectedForecast.nutritionIntentIncidenceBasisPoints,
    );
    expect(INITIAL_RUNTIME_FORECAST.crowdProfiles).toEqual(expectedForecast.crowdProfiles);
    expect(html).toContain(expectedRange);
    expect(html).toContain("Actionable need");
  });

  it("separates forecast incidence, conditional mixes, and menu coverage", async () => {
    const simulator = await readFile(
      new URL("app/game/HawkerSimulator.tsx", root),
      "utf8",
    );

    expect(simulator).toContain("nutritionIntentIncidenceBasisPoints");
    expect(simulator).toContain("conditionAwareIncidenceBasisPoints");
    expect(simulator).toContain("of visits may carry a nutrition intent");
    expect(simulator).toContain("among those flagged visits");
    expect(simulator).toContain("Menu changes update coverage only");
    expect(simulator).toContain("For now, parties arrive individually");
    expect(simulator).toContain("Service can use one exact preparation or a validated two-item Combo Board meal");
    expect(simulator).not.toContain("Stage 2 does not yet");
    expect(simulator).toContain("events, appearance, persona, regular identity, and neighbourhood theme never set these needs");
  });

  it("uses two unlocked viable preparations for a no-penalty predict-and-reveal guide", async () => {
    const simulator = await readFile(
      new URL("app/game/HawkerSimulator.tsx", root),
      "utf8",
    );
    const finishGuide = simulator.match(
      /async function finishNutritionTour\(\)[\s\S]*?\n  }\n\n  function openGuidedDecision/,
    )?.[0] ?? "";

    expect(simulator).toContain("unlockedViableResponseIds");
    expect(simulator).toContain('type="radio"');
    expect(simulator).toContain("Reveal the trade-off");
    expect(simulator).toContain("One benefit, one trade-off");
    expect(simulator).toContain("No score, reward, cash, or configuration changed");
    expect(simulator).toContain("What’s new guide");
    expect(simulator).toContain("snapshot.activePreparations.length");
    expect(simulator).toContain("snapshot.nutritionFamilies.length");
    expect(finishGuide).not.toContain("toggleCentre");
  });

  it("resolves a strict benefit for every guide comparison axis", () => {
    const cases = [
      {
        axis: "intent fit",
        selected: guideOption("fit-selected", { priceCents: 1_100 }, 0.6),
        other: guideOption("fit-other", {}, 0.5),
        expected: "60% in-game sodium-aware fit",
      },
      {
        axis: "price",
        selected: guideOption("price-selected", { priceCents: 900 }, 0.4),
        other: guideOption("price-other", {}, 0.5),
        expected: `${formatSgd(100)} less for the guest`,
      },
      {
        axis: "ingredient cost",
        selected: guideOption("cost-selected", { ingredientCostCents: 400, priceCents: 1_100 }),
        other: guideOption("cost-other"),
        expected: `${formatSgd(100)} less ingredient cost per serving`,
      },
      {
        axis: "preparation time",
        selected: guideOption("prep-selected", { preparationTimeMs: 9_000, priceCents: 1_100 }),
        other: guideOption("prep-other"),
        expected: `${preparationDurationLabel(1_000)} faster to prepare`,
      },
      {
        axis: "Star appeal",
        selected: guideOption("star-selected", { starAppeal: 4, priceCents: 1_100 }),
        other: guideOption("star-other"),
        expected: "1.0 more Star appeal",
      },
      {
        axis: "demand",
        selected: guideOption("demand-selected", {
          demandModifierBasisPoints: 11_000,
          priceCents: 1_100,
        }),
        other: guideOption("demand-other"),
        expected: "10% more relative demand pull",
      },
    ] as const;

    for (const comparison of cases) {
      expect(
        guidedOptionAdvantageCount(comparison.selected, comparison.other),
        `${comparison.axis} selected advantage`,
      ).toBeGreaterThan(0);
      expect(
        guidedOptionAdvantageCount(comparison.other, comparison.selected),
        `${comparison.axis} reciprocal trade-off`,
      ).toBeGreaterThan(0);
      expect(selectGuidedTradeoffPair([comparison.selected, comparison.other])).toEqual([
        comparison.selected,
        comparison.other,
      ]);
      const reveal = guidedRevealCopy(comparison.selected, comparison.other, "Sodium-aware");
      expect(reveal.benefit, comparison.axis).toContain(comparison.expected);
      expect(reveal.benefit).not.toContain("A real unlocked response");
      expect(reveal.tradeoff).toBeTruthy();
    }
  });

  it("does not treat equal fit as a benefit and rejects one-sided comparisons", () => {
    const equalFitSelected = guideOption(
      "equal-fit-selected",
      { priceCents: 900, ingredientCostCents: 600 },
      0.5,
    );
    const equalFitOther = guideOption("equal-fit-other", {}, 0.5);
    const reveal = guidedRevealCopy(equalFitSelected, equalFitOther, "Sodium-aware");

    expect(reveal.benefit).toContain(`${formatSgd(100)} less for the guest`);
    expect(reveal.benefit).not.toContain("50% in-game");

    const dominant = guideOption("dominant", {
      priceCents: 900,
      ingredientCostCents: 400,
      preparationTimeMs: 9_000,
      starAppeal: 4,
      demandModifierBasisPoints: 11_000,
    }, 0.6);
    const dominated = guideOption("dominated", {}, 0.5);
    expect(guidedPairScore(dominant, dominated)).toBe(Number.NEGATIVE_INFINITY);
    expect(selectGuidedTradeoffPair([dominant, dominated])).toBeUndefined();
    expect(() => guidedRevealCopy(dominant, dominated, "Sodium-aware")).toThrow(
      "at least one strict advantage for each option",
    );
    expect(selectGuidedTradeoffPair([
      guideOption("tied-left"),
      guideOption("tied-right"),
    ])).toBeUndefined();
  });

  it("announces only stable service milestones", () => {
    const period = {
      sequenceId: 1,
      day: 1,
      label: "Breakfast",
      phase: "arrivals" as const,
      arrivalRemainingMs: 220_000,
      drainRemainingMs: 180_000,
    };

    expect(meaningfulServiceAnnouncement(period).key).toBe("1:arrivals-open");
    expect(meaningfulServiceAnnouncement({ ...period, arrivalRemainingMs: 120_000 }).key).toBe(
      "1:arrivals-open",
    );
    expect(meaningfulServiceAnnouncement({ ...period, arrivalRemainingMs: 60_000 }).key).toBe(
      "1:arrivals-60-seconds",
    );
    expect(meaningfulServiceAnnouncement({ ...period, arrivalRemainingMs: 30_000 }).key).toBe(
      "1:arrivals-30-seconds",
    );
    expect(meaningfulServiceAnnouncement({
      ...period,
      phase: "draining",
      drainRemainingMs: 120_000,
    }).key).toBe("1:draining");
    expect(meaningfulServiceAnnouncement({
      ...period,
      phase: "draining",
      drainRemainingMs: 60_000,
    }).key).toBe("1:drain-60-seconds");
    expect(meaningfulServiceAnnouncement({ ...period, phase: "debrief" }).key).toBe("1:debrief");
  });

  it("derives one evidence-backed next action for the debrief", () => {
    const gapForecast = {
      coverage: [{
        needId: "intent.sodium-aware",
        viableResponseIds: [],
        unlockedViableResponseIds: [],
        covered: false,
        eligibleForRequiredContent: false,
      }],
      nutritionIntents: [{
        id: "intent.sodium-aware",
        kind: "nutrition-intent",
        nutritionIntent: "sodium-aware",
        basisPoints: 4_000,
      }],
      conditionAwareNeeds: [],
    } as Parameters<typeof debriefTryNextCopy>[0];
    const coveredForecast = {
      ...gapForecast,
      coverage: [{ ...gapForecast.coverage[0]!, covered: true }],
    } as Parameters<typeof debriefTryNextCopy>[0];
    const waitComparison = {
      averageWaitScore: 42,
    } as Parameters<typeof debriefTryNextCopy>[1];

    expect(debriefTryNextCopy(gapForecast, waitComparison, [["value", 60]])).toContain(
      "Sodium-aware had no active viable preparation",
    );
    expect(debriefTryNextCopy(coveredForecast, waitComparison, [["value", 60]])).toContain(
      "Waiting experience was the lowest observed result at 42/100",
    );
    expect(debriefTryNextCopy(
      coveredForecast,
      { averageWaitScore: 80 } as Parameters<typeof debriefTryNextCopy>[1],
      [["value", 60]],
    )).toContain("Value for the visit budget was the lowest observed cause at 60/100");
  });

  it("keeps five primary preparation axes visible and secondary timing expandable", async () => {
    const nutrition = await readFile(
      new URL("app/game/NutritionEducation.tsx", root),
      "utf8",
    );

    for (const axis of [
      "Price",
      "Ingredient cost",
      "Preparation time",
      "Star appeal",
      "Demand",
    ]) {
      expect(nutrition).toContain(`<dt>${axis}</dt>`);
    }
    expect(nutrition).toContain("Serving, eating, and frozen-order details");
    expect(nutrition).toContain("Serving time");
    expect(nutrition).toContain("Eating time");
    expect(nutrition).toContain("terms are snapshotted");
    expect(nutrition).toContain("ledger result, and satisfaction outcome");
  });

  it("connects the debrief to demand, needs, waits, contribution, and satisfaction causes", async () => {
    const simulator = await readFile(
      new URL("app/game/HawkerSimulator.tsx", root),
      "utf8",
    );

    expect(simulator).toContain("forecastComparison");
    expect(simulator).toContain("What matched, and what did not");
    expect(simulator).toContain("Nutrition-intent results");
    expect(simulator).toContain("served intent-flagged");
    expect(simulator).toContain("Condition-aware results");
    expect(simulator).toContain("served condition-flagged");
    expect(simulator).toContain("comparison.intentMatches");
    expect(simulator).toContain("comparison.conditionMatches");
    expect(simulator).toContain("Wait experience");
    expect(simulator).toContain("Contribution");
    expect(simulator).toContain("Lowest-scoring parts of the visit");
    expect(simulator).toContain("Compare expected and observed mixes");
    expect(simulator).toContain("Parties currently arrive as individual visits");
    expect(simulator).toContain("Two-item Combo Board meals are scored once per served visit");
    expect(simulator).toContain('id="period-debrief-title" tabIndex={-1} data-modal-initial-focus');
    expect(simulator).toContain("Try next.");
    expect(simulator).not.toContain('className="period-hud" data-phase={snapshot.servicePeriod.phase} aria-live');
    expect(simulator).toContain('role="status" aria-live="polite" aria-atomic="true"');
  });

  it("provides contained responsive layouts for forecast, guide, and debrief", async () => {
    const [css, nextConfig] = await Promise.all([
      readFile(new URL("app/globals.css", root), "utf8"),
      readFile(new URL("next.config.ts", root), "utf8"),
    ]);

    expect(css).toContain(".forecast-card.is-compact");
    expect(css).toContain(".guided-decision-modal");
    expect(css).toContain(".guided-choice-list");
    expect(css).toContain(".debrief-strategy-outcomes");
    expect(nextConfig).toContain("devIndicators: false");
    expect(css).toContain('.game-shell[data-text-scale="large"] :is(.guided-choice-list, .guided-reveal, .forecast-overview, .forecast-distributions)');
    expect(css).toMatch(/@media \(max-width: 700px\), \(max-height: 620px\)[\s\S]*?\.guided-choice-list,[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  });
});
