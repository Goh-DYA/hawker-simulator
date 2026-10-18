/**
 * Server-render tests of the overview panels: Focus, Insights and Activity, and the objective
 * card the left rail shares with Focus.
 *
 * The panels moved out of the `HawkerSimulator` shell with their markup unchanged; shared
 * formatters from `display.ts` replaced some inline expressions. The objective card for a new centre must appear
 * byte for byte in the shell's SSR golden, and the fixture-snapshot cases pin the objectives,
 * the persona roster and the empty feed, so a drift fails here, close to the panel, as well as
 * in the component goldens.
 */
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ActivityPanel,
  FocusPanel,
  InsightsPanel,
  ObjectiveCard,
} from "@/app/game/panels/overview";
import { CUSTOMER_ARCHETYPES } from "@/src/content";
import { count_occurrences, SNAPSHOT_FIXTURE, SSR_GOLDEN_URL } from "./fixtures";

/** The fixture snapshot with a new centre's progress, below every persona's unlock. */
const NEW_CENTRE_INSIGHTS = {
  ...SNAPSHOT_FIXTURE,
  level: 0,
  reputation: 0,
  unlockedContentIds: [],
};

describe("ObjectiveCard", () => {
  it("renders a new centre's card exactly as the left rail's server render", async () => {
    const golden = await readFile(SSR_GOLDEN_URL, "utf8");
    const html = renderToStaticMarkup(
      createElement(ObjectiveCard, {
        snapshot: { objectives: [], objectiveRefreshLabel: "8h 0m" },
      }),
    );

    expect(golden.includes(html)).toBe(true);
  });

  it("renders one article per objective with its progress and reward", () => {
    const html = renderToStaticMarkup(createElement(ObjectiveCard, { snapshot: SNAPSHOT_FIXTURE }));
    const [objective] = SNAPSHOT_FIXTURE.objectives;

    expect([
      count_occurrences(html, "<article "),
      html.includes(
        `${Math.round(objective!.progress)} / ${objective!.target} · $${objective!.rewardCash} + ${objective!.rewardXp} XP`,
      ),
    ]).toEqual([SNAPSHOT_FIXTURE.objectives.length, true]);
  });

  it("keeps each objective's progress and reward as separate text nodes", () => {
    const html = renderToString(createElement(ObjectiveCard, { snapshot: SNAPSHOT_FIXTURE }));
    const [objective] = SNAPSHOT_FIXTURE.objectives;

    expect(html).toContain(
      `<small>${Math.round(objective!.progress)}<!-- --> / <!-- -->${objective!.target}<!-- --> · $<!-- -->${objective!.rewardCash}<!-- --> + <!-- -->${objective!.rewardXp}<!-- --> XP</small>`,
    );
  });
});

describe("FocusPanel", () => {
  it("opens with the same objective card the left rail shows", () => {
    const card = renderToStaticMarkup(createElement(ObjectiveCard, { snapshot: SNAPSHOT_FIXTURE }));
    const html = renderToStaticMarkup(
      createElement(FocusPanel, { snapshot: SNAPSHOT_FIXTURE, onReviewDishes: () => undefined }),
    );

    expect(html.startsWith(`<div class="focus-panel">${card}`)).toBe(true);
  });
});

describe("InsightsPanel", () => {
  it("counts the personas that can visit against the whole roster", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsPanel, { snapshot: NEW_CENTRE_INSIGHTS, onExpandMap: () => undefined }),
    );

    expect([
      html.includes(`<em>0/${CUSTOMER_ARCHETYPES.length}</em>`),
      count_occurrences(html, '<li data-locked="true">'),
    ]).toEqual([true, CUSTOMER_ARCHETYPES.length]);
  });

  it("disables the expansion below its minimum level", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsPanel, { snapshot: NEW_CENTRE_INSIGHTS, onExpandMap: () => undefined }),
    );

    expect(html).toContain('<button type="button" class="expansion-button" disabled="">');
  });
});

describe("ActivityPanel", () => {
  it("shows the empty state with a disabled Clear button when the feed is empty", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityPanel, { activityEntries: [], onClear: () => undefined }),
    );

    expect([
      html.includes('<button type="button" disabled="">Clear</button>'),
      html.includes("No activity yet"),
    ]).toEqual([true, true]);
  });
});
