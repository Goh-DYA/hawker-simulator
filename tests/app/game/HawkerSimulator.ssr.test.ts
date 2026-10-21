/**
 * Server-render golden of the `HawkerSimulator` client shell.
 *
 * `renderToStaticMarkup` renders the component in Node exactly as its first server pass:
 * no effects run, so the markup is the initial shell before any save, preference or
 * runtime loads. The full markup is pinned in `__snapshots__/HawkerSimulator.ssr.html`,
 * and the contract assertions name the parts that the page, the tests and assistive
 * technology rely on, so a regression in markup, copy or ARIA fails without a build.
 *
 * The golden changes only in an intentional UI commit. If a refactor makes it fail, the
 * refactor changed the rendered shell: fix the code, never the snapshot.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HawkerSimulator } from "@/app/game/HawkerSimulator";

/** Where the golden markup lives, relative to this file. */
const SSR_GOLDEN_PATH = "__snapshots__/HawkerSimulator.ssr.html";

/** The title of the first tutorial step, which the shell opens on. */
const FIRST_TUTORIAL_TITLE = "Welcome to your hawker centre!";

/** Matches the bottom dock's markup; group 1 is its content. */
const BOTTOM_DOCK_PATTERN = /<nav class="bottom-dock"[^>]*>([\s\S]*?)<\/nav>/;

/** Matches one dock button's hidden icon (group 1) and visible label (group 2). */
const DOCK_BUTTON_PATTERN = /<span aria-hidden="true">([^<]*)<\/span>([^<]+)<\/button>/g;

/**
 * @returns The component's initial server markup.
 */
function render_shell(): string {
  return renderToStaticMarkup(createElement(HawkerSimulator));
}

/**
 * @param html - Server markup of the shell.
 * @returns The icon and label of each bottom dock button, in dock order.
 * @throws Error If the markup has no bottom dock.
 */
function read_dock_buttons(html: string): string[][] {
  const dock = BOTTOM_DOCK_PATTERN.exec(html);
  if (dock === null) throw new Error("The shell markup has no bottom dock");
  return Array.from(dock[1].matchAll(DOCK_BUTTON_PATTERN), ([, icon, label]) => [icon, label]);
}

describe("HawkerSimulator server render", () => {
  it("matches the golden markup", async () => {
    await expect(render_shell()).toMatchFileSnapshot(SSR_GOLDEN_PATH);
  });

  it("labels the brand lockup and edition", () => {
    const html = render_shell();

    expect([
      html.includes('aria-label="Hawker Balance"'),
      html.includes("<p>Nutrition edition</p>"),
    ]).toEqual([true, true]);
  });

  it("renders the game world and build catalogue test hooks", () => {
    const html = render_shell();

    expect([
      html.includes('data-testid="game-world"'),
      html.includes('data-testid="build-catalogue"'),
    ]).toEqual([true, true]);
  });

  it("shows the starting cash", () => {
    expect(render_shell()).toContain("$4,200");
  });

  it("opens on the first tutorial step", () => {
    expect(render_shell()).toContain(`<h2 id="tutorial-title">${FIRST_TUTORIAL_TITLE}</h2>`);
  });

  it("lists the dock sections with their icons, Focus first, then Save now", () => {
    expect(read_dock_buttons(render_shell())).toEqual([
      ["◎", "Focus"],
      ["▦", "Build"],
      ["▰", "Stalls"],
      ["◉", "Dishes"],
      ["⌁", "Insights"],
      ["◷", "Activity"],
      ["▣", "Save now"],
    ]);
  });

  it("labels the management sheet's close button", () => {
    expect(render_shell()).toContain(
      '<button type="button" class="sheet-close-button" aria-label="Close management sheet">×</button>',
    );
  });

  it("starts on the build panel with no unread activity", () => {
    const html = render_shell();

    expect([html.includes('class="focus-panel"'), html.includes('class="dock-unread"')]).toEqual([
      false,
      false,
    ]);
  });
});
