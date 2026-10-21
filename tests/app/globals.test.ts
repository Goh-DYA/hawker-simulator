/**
 * Contract checks on the app's global stylesheet.
 *
 * The component tests assert rendered markup, so the stylesheet is the one UI source still
 * read as text. Every such check lives here and reads the stylesheet only through
 * {@link read_styles}, so splitting or moving the stylesheet changes that one function
 * instead of every UI test. The assertions pin the custom properties, selectors and rules
 * that the rendered class names rely on.
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/** The stylesheet that `app/layout.tsx` loads for every page. */
const STYLES_URL = new URL("../../app/globals.css", import.meta.url);

/**
 * @returns The text of the app's global stylesheet.
 */
function read_styles(): Promise<string> {
  return readFile(STYLES_URL, "utf8");
}

/**
 * @param styles - The stylesheet text.
 * @param selector - The exact selector line that opens a top-level rule, without the brace.
 * @returns The declarations of that rule.
 * @throws Error If no top-level rule opens with that selector.
 */
function read_rule(styles: string, selector: string): string {
  const start = styles.indexOf(`\n${selector} {\n`);
  if (start === -1) throw new Error(`No rule opens with ${selector}`);
  return styles.slice(start, styles.indexOf("\n}", start));
}

describe("global stylesheet", () => {
  it("styles stall upgrade actions on the same scale as the queue manager", async () => {
    const styles = await read_styles();

    expect(styles).toContain("--stall-action-size: 0.56rem");
    expect(styles).toContain(".stall-upgrade-button {");
    expect(styles).toContain("font-size: var(--stall-action-size)");
  });

  it("lays out Centre journey milestones as aligned label/value rows", async () => {
    const styles = await read_styles();

    expect(styles).toContain(".milestone-progress-list > div");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(styles).toContain("font-variant-numeric: tabular-nums");
  });

  it("keeps insight typography on one shared scale", async () => {
    const styles = await read_styles();

    expect(styles).toContain("--insight-title-size: 0.69rem");
    expect(styles).toContain("--insight-body-size: 0.61rem");
    expect(styles).toContain("--insight-status-size: 0.63rem");
    expect(styles).toContain("--insight-detail-size: 0.58rem");
    expect(styles).toContain("font-size: var(--insight-detail-size)");
    expect(styles).toContain("font-size: var(--insight-status-size)");
  });

  it("styles the Activity list and the dock's unread indicator", async () => {
    const styles = await read_styles();

    expect(styles).toContain(".activity-list article");
    expect(styles).toContain(".dock-unread");
  });

  // A selected guest's inspector shares the management panel with the open section. The
  // section's wrappers must scroll rather than spill, or their rows paint over the inspector
  // (the Dishes panel's rows did, until the stall picker was changed).
  it("keeps every management section clear of the guest inspector below it", async () => {
    const styles = await read_styles();
    const inspector = read_rule(styles, ".customer-nutrition-inspector");

    expect({
      inspector: [
        inspector.includes("flex: 0 1 auto;"),
        inspector.includes("max-height: 50%;"),
        inspector.includes("overflow-y: auto;"),
      ],
      menu: ["overflow-y: auto;", "flex: 1 1 0;"].every((declaration) =>
        read_rule(styles, ".menu-manager").includes(declaration),
      ),
      activity: read_rule(styles, ".activity-panel").includes("flex: 1 1 0;"),
      focus: read_rule(styles, ".focus-panel").includes("flex: 1 1 0;"),
      lists: read_rule(
        styles,
        ".catalogue-grid,\n.stall-list,\n.dish-list,\n.insights-list,\n.activity-list",
      ).includes("flex: 1 1 0;"),
    }).toEqual({
      inspector: [true, true, true],
      menu: true,
      activity: true,
      focus: true,
      lists: true,
    });
  });

  // With the inspector open, the Dishes panel scrolls its stall picker and dish rows as one, and
  // the lists drop the bottom room the inspector already fills, so a whole dish row can show.
  it("gives the Dishes menu one scroller beside the guest inspector", async () => {
    const styles = await read_styles();
    const beside_inspector = ".catalogue-panel:has(.customer-nutrition-inspector)";

    expect([
      read_rule(styles, `${beside_inspector} .menu-manager .dish-list`).includes("overflow: visible;"),
      styles.includes(`${beside_inspector} :is(`),
    ]).toEqual([true, true]);
  });

  it("turns the management panel into a full-width sheet on compact screens", async () => {
    const styles = await read_styles();

    expect(styles).toContain("@media (max-width: 899px)");
    expect(styles).toContain("width: 100vw");
    expect(styles).toContain('.game-shell[data-management-open="false"] .catalogue-panel');
    expect(styles).toContain(".sheet-close-button { display: grid; }");
  });

  it("fits painted thumbnails to their tile and hides the CSS art behind them", async () => {
    const styles = await read_styles();

    expect([
      /\.painted-preview\s*\{[^}]*object-fit:\s*contain/.test(styles),
      /\.catalogue-item \.item-art\.has-painting::before,[\s\S]*?content:\s*none/.test(styles),
      /\.dish-row \.dish-preview\.has-painting::after\s*\{[^}]*content:\s*none/.test(styles),
    ]).toEqual([true, true, true]);
  });

  it("rests the loading bar instead of sweeping it when motion is reduced", async () => {
    const styles = await read_styles();

    expect(styles).toMatch(/\[data-motion="reduced"\] \.loading-bar i\s*\{[^}]*animation:\s*none/);
  });

  it("contains the compact desktop Pulse within the left rail", async () => {
    const styles = await read_styles();

    expect(styles).toMatch(/\.left-rail\s*\{[^}]*overflow-y:\s*auto/);
    expect(styles).toContain(".nutrition-pulse-card.is-compact");
    expect(styles).toMatch(
      /\.nutrition-pulse-card\.is-compact \.nutrition-pulse-kicker\s*\{[^}]*white-space:\s*nowrap/,
    );
    expect(styles).toMatch(
      /\.nutrition-pulse-card\.is-compact \.nutrition-average-list,[\s\S]*?display:\s*none/,
    );
  });
});
