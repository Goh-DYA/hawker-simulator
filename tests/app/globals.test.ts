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

  it("turns the management panel into a full-width sheet on compact screens", async () => {
    const styles = await read_styles();

    expect(styles).toContain("@media (max-width: 899px)");
    expect(styles).toContain("width: 100vw");
    expect(styles).toContain('.game-shell[data-management-open="false"] .catalogue-panel');
    expect(styles).toContain(".sheet-close-button { display: grid; }");
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
