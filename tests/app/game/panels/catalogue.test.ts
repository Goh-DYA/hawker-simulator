/**
 * Server-render tests of the catalogue panels: Build, Stalls and the selection card.
 *
 * The panels moved out of the `HawkerSimulator` shell with their markup unchanged; shared
 * formatters from `display.ts` replaced some inline expressions. The Build panel in its first state must appear
 * byte for byte in the shell's SSR golden, and the fixture-snapshot cases pin how each panel
 * reflects locks, selection, operating stalls and the selected item, so a drift fails here,
 * close to the panel, as well as in the component goldens.
 */
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuildPanel, SelectionCard, StallsPanel } from "@/app/game/panels/catalogue";
import { PLACEABLES, STALLS } from "@/src/content";
import type { RuntimeSnapshot } from "@/src/game/runtime/types";
import {
  count_occurrences,
  NEW_CENTRE,
  NO_CONTROLLER,
  SNAPSHOT_FIXTURE,
  SSR_GOLDEN_URL,
} from "./fixtures";

/** A painted thumbnail's data URL, as the runtime returns it. */
const PAINTED_URL = "data:image/png;base64,UEFJTlRFRA==";

/** The image a painted thumbnail renders as. */
const PAINTED_IMAGE = `<img class="painted-preview" src="${PAINTED_URL}" alt="" draggable="false" decoding="async"/>`;

/** A placeable the fixture has unlocked. */
const UNLOCKED_PLACEABLE = PLACEABLES.find(
  (item) => item.id === SNAPSHOT_FIXTURE.unlockedContentIds[0],
)!;

/**
 * Render the Build panel with no search, every category and nothing selected.
 *
 * @param snapshot - The unlock progress to render against.
 * @param selected_id - The selected build item's ID, if any.
 * @returns The panel's markup.
 */
function render_build_panel(
  snapshot: Pick<RuntimeSnapshot, "level" | "reputation" | "unlockedContentIds">,
  selected_id?: string,
): string {
  return renderToStaticMarkup(
    createElement(BuildPanel, {
      query: "",
      onQueryChange: () => undefined,
      buildCategory: "all",
      onBuildCategoryChange: () => undefined,
      visiblePlaceables: PLACEABLES,
      selectedId: selected_id,
      snapshot,
      onSelectBuildItem: () => undefined,
    }),
  );
}

/**
 * Render the Stalls panel against a snapshot.
 *
 * @param snapshot - The snapshot to render against.
 * @returns The panel's markup.
 */
function render_stalls_panel(snapshot: RuntimeSnapshot): string {
  return renderToStaticMarkup(
    createElement(StallsPanel, {
      snapshot,
      selectedId: undefined,
      controllerRef: NO_CONTROLLER,
      onSelectBuildItem: () => undefined,
    }),
  );
}

describe("BuildPanel", () => {
  it("renders a new centre's catalogue exactly as the shell's server render", async () => {
    const golden = await readFile(SSR_GOLDEN_URL, "utf8");

    expect(golden.includes(render_build_panel(NEW_CENTRE))).toBe(true);
  });

  it("renders one card per visible placeable and marks each locked one", () => {
    const html = render_build_panel(SNAPSHOT_FIXTURE);
    const locked = PLACEABLES.filter(
      (item) => !SNAPSHOT_FIXTURE.unlockedContentIds.includes(item.id),
    );

    expect([
      count_occurrences(html, 'class="catalogue-item '),
      count_occurrences(html, '<i aria-hidden="true">●</i>'),
    ]).toEqual([PLACEABLES.length, locked.length]);
  });

  it("presses only the selected item's card", () => {
    const html = render_build_panel(SNAPSHOT_FIXTURE, UNLOCKED_PLACEABLE.id);

    expect(count_occurrences(html, 'class="catalogue-item is-selected" aria-pressed="true"')).toBe(
      1,
    );
  });

  it("names a category chip with its first hyphen as a space", () => {
    expect(render_build_panel(NEW_CENTRE)).toContain(">stall fixture</button>");
  });

  it("shows a painted thumbnail in place of its glyph once the runtime has painted it", () => {
    const html = renderToStaticMarkup(
      createElement(BuildPanel, {
        query: "",
        onQueryChange: () => undefined,
        buildCategory: "all",
        onBuildCategoryChange: () => undefined,
        visiblePlaceables: PLACEABLES.slice(0, 2),
        selectedId: undefined,
        snapshot: NEW_CENTRE,
        previewUrls: { [PLACEABLES[0]!.id]: PAINTED_URL },
        onSelectBuildItem: () => undefined,
      }),
    );

    // The painted card drops its glyph; the other card keeps it.
    expect([
      count_occurrences(html, PAINTED_IMAGE),
      count_occurrences(html, `class="item-art item-${PLACEABLES[0]!.category} has-painting"`),
      count_occurrences(html, 'aria-hidden="true"><span>'),
    ]).toEqual([1, 1, 1]);
  });
});

describe("StallsPanel", () => {
  it("lists one queue plan per operating stall and one card per stall", () => {
    const html = render_stalls_panel(SNAPSHOT_FIXTURE);

    expect([
      count_occurrences(html, 'class="queue-manager-row"'),
      count_occurrences(html, 'class="stall-card'),
    ]).toEqual([SNAPSHOT_FIXTURE.placedStalls.length, STALLS.length]);
  });

  it("labels each operating stall's next upgrade with its required rank", () => {
    const html = render_stalls_panel(SNAPSHOT_FIXTURE);

    expect(html).toContain(
      "Upgrade to level 2<small>Requires mastery rank 2</small></span><strong>$720</strong>",
    );
  });

  it("leaves out the queue plans when no stall operates", () => {
    const html = render_stalls_panel({ ...SNAPSHOT_FIXTURE, placedStalls: [] });

    expect(html).not.toContain("Operating queue plans");
  });

  it("shows a stall's painted front in its card once the runtime has painted it", () => {
    const html = renderToStaticMarkup(
      createElement(StallsPanel, {
        snapshot: { ...SNAPSHOT_FIXTURE, placedStalls: [] },
        selectedId: undefined,
        controllerRef: NO_CONTROLLER,
        previewUrls: { [STALLS[0]!.id]: PAINTED_URL },
        onSelectBuildItem: () => undefined,
      }),
    );

    expect([
      count_occurrences(html, PAINTED_IMAGE),
      count_occurrences(html, 'class="stall-swatch has-painting"'),
      count_occurrences(html, 'class="stall-swatch"'),
    ]).toEqual([1, 1, STALLS.length - 1]);
  });
});

describe("SelectionCard", () => {
  it("describes a placeable by its category and in-game utility", () => {
    const html = renderToStaticMarkup(
      createElement(SelectionCard, {
        selectedContent: UNLOCKED_PLACEABLE,
        onClear: () => undefined,
      }),
    );

    expect([
      html.includes(`<span>${UNLOCKED_PLACEABLE.category}</span>`),
      html.includes("<strong>In-game utility</strong>"),
    ]).toEqual([true, true]);
  });

  it("shows the item's painted thumbnail once the runtime has painted it", () => {
    const html = renderToStaticMarkup(
      createElement(SelectionCard, {
        selectedContent: UNLOCKED_PLACEABLE,
        previewUrl: PAINTED_URL,
        onClear: () => undefined,
      }),
    );

    expect(html).toContain(
      `<div class="selection-card has-painting"><button type="button" aria-label="Clear selection">×</button><span class="selection-art" aria-hidden="true">${PAINTED_IMAGE}</span>`,
    );
  });

  it("describes a stall as a food stall without a utility list", () => {
    const html = renderToStaticMarkup(
      createElement(SelectionCard, { selectedContent: STALLS[0]!, onClear: () => undefined }),
    );

    expect([html.includes("<span>food stall</span>"), html.includes("In-game utility")]).toEqual([
      true,
      false,
    ]);
  });
});
