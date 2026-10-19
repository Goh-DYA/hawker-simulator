// @vitest-environment jsdom
/**
 * Render tests of the left rail's "Today" strip and the next-unlock signpost.
 *
 * The strip renders against the fixture snapshot's neighbourhood, and variations of it with a
 * food writer, so these cases pin the rush bands, the timeline's text description, the polite
 * rush notice, tomorrow's forecast and the writer lines. Without a neighbourhood the strip must
 * keep the layout tip byte for byte, which the shell's server-render golden also holds.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cleanup, render, within } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  describe_writer_status,
  get_timeline_share,
  NextUnlockSignpost,
  TodayStrip,
} from "@/app/game/panels/today";
import type { RuntimeNeighbourhood, RuntimeWriterVisit } from "@/src/game/runtime/types";
import { SNAPSHOT_FIXTURE } from "./fixtures";

/**
 * The shell's server-render golden. Under jsdom `import.meta.url` is not a file URL, so the
 * path is resolved from the repository root that Vitest runs in.
 */
const SSR_GOLDEN_PATH = resolve("tests/app/game/__snapshots__/HawkerSimulator.ssr.html");

/** The fixture's neighbourhood: day 2, before the lunch crowd, with a writer due tomorrow. */
const NEIGHBOURHOOD = SNAPSHOT_FIXTURE.neighbourhood!;

/** A food writer visit under way at the fixture's stall. */
const WRITER: RuntimeWriterVisit = {
  stallDefinitionId: "stall.sunrise-roost",
  stallName: "Sunrise Roost",
  threshold: 68,
  windowStartMinute: 12 * 60,
  windowEndMinute: 14 * 60,
  status: "reviewing",
  outcome: "pending",
  visitCount: 2,
  averageScore: 71.4,
};

/**
 * Render the strip into the document.
 *
 * @param neighbourhood - The neighbourhood view, if any.
 * @returns The strip's container.
 */
function render_strip(neighbourhood?: RuntimeNeighbourhood): HTMLElement {
  return render(createElement(TodayStrip, { neighbourhood })).container;
}

afterEach(() => {
  cleanup();
});

describe("TodayStrip", () => {
  it("keeps the layout tip, exactly as the shell's server render, without a neighbourhood", async () => {
    const golden = await readFile(SSR_GOLDEN_PATH, "utf8");
    const html = renderToStaticMarkup(createElement(TodayStrip, {}));

    expect([html.includes("Layout tip"), golden.includes(html)]).toEqual([true, true]);
  });

  it("names today's card and its summary", () => {
    const strip = within(render_strip(NEIGHBOURHOOD));

    expect([
      strip.getByRole("heading", { level: 2 }).textContent,
      strip.getByText("An early wave wanting kopi and toast.").tagName,
    ]).toEqual(["Late-morning kopi crowd", "P"]);
  });

  it("draws a labelled band for each rush window, placed along opening hours", () => {
    const container = render_strip(NEIGHBOURHOOD);

    expect(
      Array.from(container.querySelectorAll<HTMLElement>(".today-band"), (band) => [
        band.dataset.kind,
        band.textContent,
        band.style.left,
      ]),
    ).toEqual([
      ["lunch", "Lunch", `${get_timeline_share(714, 630, 1110) * 100}%`],
      ["dinner", "Dinner", `${get_timeline_share(1011, 630, 1110) * 100}%`],
    ]);
  });

  it("describes the whole timeline in its image label", () => {
    const strip = within(render_strip({ ...NEIGHBOURHOOD, writer: WRITER }));

    expect(strip.getByRole("img").getAttribute("aria-label")).toBe(
      "Opening hours 10:30 AM to 6:30 PM. Lunch crowd 11:54 AM–1:06 PM. Dinner crowd 4:51–5:39 PM. Last orders 6:10 PM. Food writer reviewing 12:00–2:00 PM. Now 11:30 AM.",
    );
  });

  it("marks the clock and last orders on the timeline", () => {
    const container = render_strip(NEIGHBOURHOOD);

    expect([
      container.querySelector<HTMLElement>(".today-now")?.style.left,
      container.querySelector<HTMLElement>(".today-last-orders")?.style.left,
      container.querySelector(".today-writer-mark"),
    ]).toEqual([
      `${get_timeline_share(690, 630, 1110) * 100}%`,
      `${get_timeline_share(1090, 630, 1110) * 100}%`,
      null,
    ]);
  });

  it("shows the rush notice in a polite live region", () => {
    const notice = render_strip(NEIGHBOURHOOD).querySelector(".today-notice");

    expect([notice?.getAttribute("aria-live"), notice?.textContent]).toEqual([
      "polite",
      "Lunch crowd from about 11:54 AM. Ready the queues and seats.",
    ]);
  });

  it("keeps the live region, empty, when no rush is near", () => {
    const notice = render_strip({ ...NEIGHBOURHOOD, rushNotice: undefined }).querySelector(
      ".today-notice",
    );

    expect([notice?.getAttribute("aria-live"), notice?.textContent]).toEqual(["polite", ""]);
  });

  it("forecasts tomorrow and the writer's visit tomorrow", () => {
    const container = render_strip(NEIGHBOURHOOD);

    expect(
      Array.from(container.querySelectorAll(".today-tomorrow"), (line) => line.textContent),
    ).toEqual([
      "Tomorrow: Quiet weekday — A gentle weekday is coming: smaller crowds and a good chance to rearrange or try a new recipe.",
      "✎ A food writer plans to visit tomorrow.",
    ]);
  });

  it("leaves the writer line out when no writer is due tomorrow", () => {
    const container = render_strip({ ...NEIGHBOURHOOD, isWriterTomorrow: false });

    expect(container.querySelectorAll(".today-tomorrow")).toHaveLength(1);
  });

  it("names today's food writer visit, its threshold and progress", () => {
    const container = render_strip({ ...NEIGHBOURHOOD, writer: WRITER });

    expect([
      container.querySelector(".today-writer")?.textContent,
      container.querySelector(".today-writer-mark")?.textContent,
    ]).toEqual([
      "✎ Food writer reviewing Sunrise Roost 12:00–2:00 PM · needs an average of 68Reviewing now · 2 meals so far, averaging 71.",
      "✎",
    ]);
  });
});

describe("describe_writer_status", () => {
  it.each<[string, Partial<RuntimeWriterVisit>, string]>([
    ["upcoming", { status: "upcoming", visitCount: 0 }, "Arrives at 12:00 PM."],
    ["reviewing with no meals", { visitCount: 0 }, "Reviewing now · no meals counted yet."],
    ["reviewing with one meal", { visitCount: 1 }, "Reviewing now · 1 meal so far, averaging 71."],
    [
      "a plaque",
      { status: "done", outcome: "plaque" },
      "Sunrise Roost earned a Writer's Pick plaque!",
    ],
    [
      "no plaque",
      { status: "done", outcome: "no-plaque" },
      "The food writer enjoyed their visit to Sunrise Roost and will be back another day.",
    ],
    [
      "too few visits",
      { status: "done", outcome: "too-few-visits" },
      "The food writer saw too few meals at Sunrise Roost to write a review. They will be back another day.",
    ],
  ])("describes %s", (_, change, expected) => {
    expect(describe_writer_status({ ...WRITER, ...change })).toBe(expected);
  });
});

describe("NextUnlockSignpost", () => {
  it("names the next unlock with its progress and hint", () => {
    const { container } = render(
      createElement(NextUnlockSignpost, { nextUnlock: SNAPSHOT_FIXTURE.nextUnlock }),
    );
    const card = within(container).getByRole("region", { name: "Kopi Canopy" });

    expect([
      card.querySelector(".card-kicker")?.textContent,
      card.querySelector<HTMLElement>(".objective-progress span")?.style.width,
      card.querySelector("p")?.textContent,
    ]).toEqual(["Next up80%", "80%", "Keep visits averaging about 59 so reputation climbs to 10."]);
  });

  it("renders nothing once everything is unlocked", () => {
    expect(renderToStaticMarkup(createElement(NextUnlockSignpost, {}))).toBe("");
  });
});
