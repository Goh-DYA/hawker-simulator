/**
 * Server-render tests of the Dishes panel and its per-dish view model, `build_menu_rows`.
 *
 * The panels moved out of the `HawkerSimulator` shell with their markup unchanged; shared
 * formatters from `display.ts` replaced some inline expressions. The fixture-snapshot cases pin the menu rows'
 * order, IDs, offer state and reasons, so a drift fails here, close to the panel, as well as
 * in the component goldens.
 */
import { createElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { humanize_id, money } from "@/app/game/display";
import { build_menu_rows, MenuPanel } from "@/app/game/panels/menu";
import { DISHES, STALLS } from "@/src/content";
import type { RuntimeSnapshot } from "@/src/game/runtime/types";
import { count_occurrences, NO_CONTROLLER, SNAPSHOT_FIXTURE } from "./fixtures";

/** The stall whose menu the fixture has started planning. */
const MENU_STALL = STALLS.find((stall) => stall.id === "stall.sunrise-roost")!;

/**
 * Render the Dishes panel for one stall against a snapshot.
 *
 * @param snapshot - The snapshot to render against.
 * @param menu_stall_id - The ID of the stall whose menu is shown.
 * @returns The panel's markup.
 */
function render_menu_panel(snapshot: RuntimeSnapshot, menu_stall_id: string): string {
  return renderToStaticMarkup(
    createElement(MenuPanel, {
      menuStallId: menu_stall_id,
      onMenuStallChange: () => undefined,
      nutritionLens: true,
      onNutritionLensChange: () => undefined,
      snapshot,
      controllerRef: NO_CONTROLLER,
      onTuneRecipe: () => undefined,
    }),
  );
}

describe("build_menu_rows", () => {
  it("lists the stall's dishes in catalogue order with their generated IDs", () => {
    const { rows } = build_menu_rows(
      MENU_STALL,
      SNAPSHOT_FIXTURE,
      SNAPSHOT_FIXTURE.nutritionFamilies,
    );

    expect(rows.map((row) => [row.dish.id, row.titleId, row.reasonId])).toEqual(
      DISHES.filter((dish) => dish.stallIds.includes(MENU_STALL.id)).map((dish) => [
        dish.id,
        `dish-menu-title-${dish.id.slice("dish.".length)}`,
        `dish-menu-reason-${dish.id.slice("dish.".length)}`,
      ]),
    );
  });

  it("counts the active menu against the stall's slots and checks only offered dishes", () => {
    const view = build_menu_rows(MENU_STALL, SNAPSHOT_FIXTURE, SNAPSHOT_FIXTURE.nutritionFamilies);

    expect([
      view.activeCount,
      view.menuSlots,
      view.rows.filter((row) => row.isChecked).map((row) => row.dish.id),
    ]).toEqual([1, MENU_STALL.menuSlots, ["dish.poached-chicken-rice"]]);
  });

  it("gives every unchecked dish the full-menu reason once every slot is active", () => {
    const full_menu = build_menu_rows(
      MENU_STALL,
      SNAPSHOT_FIXTURE,
      SNAPSHOT_FIXTURE.nutritionFamilies,
    )
      .rows.slice(0, MENU_STALL.menuSlots)
      .map((row) => row.dish.id);
    const snapshot = {
      ...SNAPSHOT_FIXTURE,
      level: 99,
      reputation: 999,
      stallMenus: { ...SNAPSHOT_FIXTURE.stallMenus, [MENU_STALL.id]: full_menu },
    };
    const { rows } = build_menu_rows(MENU_STALL, snapshot, snapshot.nutritionFamilies);

    expect(rows.map((row) => row.unavailableReason)).toEqual(
      rows.map((row) =>
        row.isChecked ? undefined : `All ${MENU_STALL.menuSlots} menu slots are active`,
      ),
    );
  });
});

describe("MenuPanel", () => {
  it("labels each dish row by its title's ID", () => {
    const html = render_menu_panel(SNAPSHOT_FIXTURE, MENU_STALL.id);
    const { rows } = build_menu_rows(
      MENU_STALL,
      SNAPSHOT_FIXTURE,
      SNAPSHOT_FIXTURE.nutritionFamilies,
    );

    expect(
      rows.map(
        (row) =>
          html.includes(`aria-labelledby="${row.titleId}"`) &&
          html.includes(`<h3 id="${row.titleId}">`),
      ),
    ).toEqual(rows.map(() => true));
  });

  it("describes each unavailable dish's offer box by its reason's ID", () => {
    const html = render_menu_panel(SNAPSHOT_FIXTURE, MENU_STALL.id);
    const unavailable = build_menu_rows(
      MENU_STALL,
      SNAPSHOT_FIXTURE,
      SNAPSHOT_FIXTURE.nutritionFamilies,
    ).rows.filter((row) => row.unavailableReason);

    expect([
      unavailable.length > 0,
      count_occurrences(html, 'aria-describedby="dish-menu-reason-'),
      unavailable.every(
        (row) =>
          html.includes(`aria-describedby="${row.reasonId}"`) &&
          html.includes(`<em id="${row.reasonId}">${row.unavailableReason}</em>`),
      ),
    ]).toEqual([true, unavailable.length, true]);
  });

  it("keeps each dish row's category, price and demand as separate text nodes", () => {
    const html = renderToString(
      createElement(MenuPanel, {
        menuStallId: MENU_STALL.id,
        onMenuStallChange: () => undefined,
        nutritionLens: true,
        onNutritionLensChange: () => undefined,
        snapshot: SNAPSHOT_FIXTURE,
        controllerRef: NO_CONTROLLER,
        onTuneRecipe: () => undefined,
      }),
    );
    const [row] = build_menu_rows(
      MENU_STALL,
      SNAPSHOT_FIXTURE,
      SNAPSHOT_FIXTURE.nutritionFamilies,
    ).rows;
    const category = humanize_id(row!.dish.category, { shouldReplaceAll: false });
    const demand = Math.round(row!.dish.baseDemand * 100);

    expect(html).toContain(
      `<small>${category}<!-- --> · <!-- -->${money(row!.dish.price)}<!-- --> · demand <!-- -->${demand}<!-- -->%</small>`,
    );
  });

  it("shows a dish's painted serving in its active variant once the runtime has painted it", () => {
    const { rows } = build_menu_rows(MENU_STALL, SNAPSHOT_FIXTURE, SNAPSHOT_FIXTURE.nutritionFamilies);
    const row = rows[0]!;
    const key = row.activeVariant ? `${row.dish.id}@${row.activeVariant.id}` : row.dish.id;
    const html = renderToStaticMarkup(
      createElement(MenuPanel, {
        menuStallId: MENU_STALL.id,
        onMenuStallChange: () => undefined,
        nutritionLens: false,
        onNutritionLensChange: () => undefined,
        snapshot: SNAPSHOT_FIXTURE,
        controllerRef: NO_CONTROLLER,
        previewUrls: { [key]: "data:image/png;base64,UEFJTlRFRA==" },
        onTuneRecipe: () => undefined,
      }),
    );

    expect([
      count_occurrences(html, 'class="dish-preview has-painting"'),
      count_occurrences(html, '<img class="painted-preview" src="data:image/png;base64,UEFJTlRFRA=="'),
      count_occurrences(html, '<i class="dish-preview-portion">'),
    ]).toEqual([1, 1, rows.length - 1]);
  });

  it("shows no menu when the chosen stall ID matches no stall", () => {
    const html = render_menu_panel(SNAPSHOT_FIXTURE, "stall.missing");

    expect(html).not.toContain('class="dish-list"');
  });
});
