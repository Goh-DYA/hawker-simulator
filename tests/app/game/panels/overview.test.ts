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
  describe_uncleared_trays,
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

describe("FocusPanel Service Review", () => {
  it("shows the latest review after the objectives, with a New mark while unread", () => {
    const html = renderToStaticMarkup(
      createElement(FocusPanel, {
        snapshot: SNAPSHOT_FIXTURE,
        isReviewUnread: true,
        onReviewDishes: () => undefined,
        onOpenReview: () => undefined,
      }),
    );

    expect([
      html.indexOf('class="objective-card"') < html.indexOf('class="service-review-summary"'),
      html.includes('<span class="service-review-new">New</span>'),
      html.includes("Day 1 · Opening day"),
      html.includes('<button type="button">Read the full review</button>'),
    ]).toEqual([true, true, true, true]);
  });

  it("leaves the review out before the first day has ended", () => {
    const html = renderToStaticMarkup(
      createElement(FocusPanel, {
        snapshot: { ...SNAPSHOT_FIXTURE, neighbourhood: undefined },
        onReviewDishes: () => undefined,
      }),
    );

    expect(html.includes("service-review-summary")).toBe(false);
  });

  it("names the seats waiting for the table-cleaning crew in the service pulse", () => {
    const html = renderToStaticMarkup(
      createElement(FocusPanel, {
        snapshot: { ...SNAPSHOT_FIXTURE, unclearedTrays: 3, cleaningCrew: 2 },
        onReviewDishes: () => undefined,
      }),
    );

    expect(html).toContain(
      '<p class="service-pulse-note">3 seats waiting for the table-cleaning crew (crew of 2).</p>',
    );
  });
});

describe("describe_uncleared_trays", () => {
  it("counts one seat or many, and says nothing when every seat is clear", () => {
    expect([
      describe_uncleared_trays(0, 1),
      describe_uncleared_trays(1, 1),
      describe_uncleared_trays(4, 3),
    ]).toEqual([
      undefined,
      "1 seat waiting for the table-cleaning crew (crew of 1).",
      "4 seats waiting for the table-cleaning crew (crew of 3).",
    ]);
  });
});

describe("InsightsPanel", () => {
  it("adds the trays waiting for the crew to the seating card", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsPanel, { snapshot: SNAPSHOT_FIXTURE, onExpandMap: () => undefined }),
    );

    expect(html).toContain(
      '<p class="seating-clearing-note">1 seat waiting for the table-cleaning crew (crew of 1).</p>',
    );
  });

  it("shows the best reputation reached, which unlocks read", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsPanel, {
        snapshot: { ...SNAPSHOT_FIXTURE, reputation: 11.6, peakReputation: 24.2 },
        onExpandMap: () => undefined,
      }),
    );

    expect([
      html.includes("Reputation now 12. Best reputation reached: 24 — unlocks use this"),
      html.includes("<em>24</em>"),
    ]).toEqual([true, true]);
  });

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
