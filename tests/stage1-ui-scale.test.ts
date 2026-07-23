import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  panelSelectionIsVisible,
  revealScrollableControl,
  shouldRestoreManagementFocus,
} from "../app/game/HawkerSimulator";

const root = new URL("../", import.meta.url);

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex.match(/[0-9a-f]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Stage 1 responsive and scale contracts", () => {
  it("keeps every authored rem-based text size at the 0.75rem readability floor", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");
    const authoredRemSizes = Array.from(
      css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)rem/g),
      (match) => Number(match[1]),
    );

    expect(authoredRemSizes.length).toBeGreaterThan(0);
    expect(authoredRemSizes.filter((size) => size < 0.75)).toEqual([]);
    const authoredSizeTokens = Array.from(
      css.matchAll(/--[a-z-]*size:\s*(\d+(?:\.\d+)?)rem/g),
      (match) => Number(match[1]),
    );
    expect(authoredSizeTokens.filter((size) => size < 0.75)).toEqual([]);
    const authoredShorthandSizes = Array.from(
      css.matchAll(/font:\s*[^;]*?\b(\d+(?:\.\d+)?)(?:rem|em)\b/g),
      (match) => Number(match[1]),
    );
    expect(authoredShorthandSizes.filter((size) => size < 0.75)).toEqual([]);
  });

  it("uses a contrast-safe terracotta token for small labels", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");
    const textToken = css.match(/--terracotta-text:\s*(#[0-9a-f]{6})/i)?.[1];

    expect(textToken).toBeDefined();
    expect(contrastRatio(textToken!, "#f6efe1")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(textToken!, "#fffaf0")).toBeGreaterThanOrEqual(4.5);
    expect(css).not.toMatch(/^\s*color:\s*var\(--terracotta\);/m);
  });

  it("switches enlarged text to a deliberate compact composition", async () => {
    const [simulator, css] = await Promise.all([
      readFile(new URL("app/game/HawkerSimulator.tsx", root), "utf8"),
      readFile(new URL("app/globals.css", root), "utf8"),
    ]);

    expect(simulator).toContain("data-text-scale={");
    expect(simulator).toContain("settings.textScale >= 1.75");
    expect(simulator).toContain('? "large"');
    expect(css).toContain('.game-shell[data-text-scale="large"] .play-layout');
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain('.game-shell[data-text-scale="large"] .catalogue-panel');
    expect(css).toContain('data-management-open="false"');
  });

  it("keeps every simulation speed reachable on compact screens", async () => {
    const [simulator, css] = await Promise.all([
      readFile(new URL("app/game/HawkerSimulator.tsx", root), "utf8"),
      readFile(new URL("app/globals.css", root), "utf8"),
    ]);

    expect(simulator).toContain('className="speed-select"');
    expect(simulator).toContain("([0, 1, 2, 4, 10] as const).map");
    expect(css).toContain(".speed-select {");
    expect(css).toContain("min-height: 44px;");
    expect(css).not.toContain(".speed-group button:nth-child(3)");
    expect(css).not.toContain(".speed-group button:nth-child(4)");
  });

  it("gives every build tool a full-width row before the catalogue becomes an overlay", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");
    const start = css.indexOf("@media (max-width: 1040px)");
    const end = css.indexOf("@media (max-height: 780px)", start);
    const mediumViewportRules = css.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(mediumViewportRules).toContain(".world-column");
    expect(mediumViewportRules).toContain("grid-template-rows: auto minmax(0, 1fr) 50px;");
    expect(mediumViewportRules).toContain("grid-template-columns: auto minmax(0, 1fr);");
    expect(mediumViewportRules).toContain("grid-column: 1 / -1;");
    expect(mediumViewportRules).toContain("max-width: none;");
    expect(mediumViewportRules).not.toContain("max-width: 250px;");
  });

  it("does not claim a hidden overlay panel is the current section", () => {
    expect(panelSelectionIsVisible(false, false)).toBe(true);
    expect(panelSelectionIsVisible(false, true)).toBe(true);
    expect(panelSelectionIsVisible(true, false)).toBe(false);
    expect(panelSelectionIsVisible(true, true)).toBe(true);
  });

  it("restores compact sheet focus after its active tab unmounts", () => {
    expect(shouldRestoreManagementFocus(true, false, true, false)).toBe(true);
    expect(shouldRestoreManagementFocus(false, true, true, false)).toBe(true);
    expect(shouldRestoreManagementFocus(true, false, false, false)).toBe(false);
    expect(shouldRestoreManagementFocus(true, false, true, true)).toBe(false);
  });

  it("reveals focused controls without forcing vertical scrolling", () => {
    const calls: ScrollIntoViewOptions[] = [];
    const control = {
      scrollIntoView: (options?: boolean | ScrollIntoViewOptions) => {
        if (typeof options === "object") calls.push(options);
      },
    };

    revealScrollableControl(control, false);
    revealScrollableControl(control, true);

    expect(calls).toEqual([
      { behavior: "smooth", block: "nearest", inline: "nearest" },
      { behavior: "auto", block: "nearest", inline: "nearest" },
    ]);
  });

  it("keeps compact management modal, switcher, and launcher semantics consistent", async () => {
    const simulator = await readFile(
      new URL("app/game/HawkerSimulator.tsx", root),
      "utf8",
    );

    expect(simulator).toContain("const overlayManagement = compactManagement || settings.textScale >= 1.75;");
    expect(simulator).toContain("const managementBackgroundInert = interfaceInert || managementSheetOpen;");
    expect(simulator).toContain('className="management-sheet-tabs"');
    expect(simulator).toContain('id="management-panel"');
    expect(simulator).toContain('aria-controls={overlayManagement ? "management-panel" : undefined}');
    expect(simulator).toContain("aria-expanded={overlayManagement ? managementSheetOpen && panel === value : undefined}");
    expect(simulator).toContain("className={visiblePanelSelection && panel === value ? \"is-active\" : \"\"}");
    expect(simulator).toContain("inert={managementBackgroundInert}");
    expect(simulator).toContain("inert={interfaceInert}");
  });

  it("keeps overflow visible and wraps build tools at the largest text scale", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");

    expect(css).not.toContain("scrollbar-width: none;");
    expect(css).toContain("scrollbar-color: #806f57 transparent;");
    expect(css).toMatch(/data-text-scale="large"[^}]*\.tool-segment\s*\{[\s\S]*?display: grid;[\s\S]*?overflow-x: visible;/);
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr));");
  });

  it("pins the application viewport while long panels scroll internally", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");
    const rootRules = css.slice(
      css.indexOf("html,\nbody {"),
      css.indexOf("button,", css.indexOf("html,\nbody {")),
    );
    const shellRules = css.slice(
      css.indexOf(".game-shell {"),
      css.indexOf(".topbar {", css.indexOf(".game-shell {")),
    );
    const layoutRules = css.slice(
      css.indexOf(".play-layout {"),
      css.indexOf(".left-rail,", css.indexOf(".play-layout {")),
    );

    expect(rootRules).toContain("height: 100%;");
    expect(rootRules).toContain("min-height: 0;");
    expect(rootRules).toContain("overflow: hidden;");
    expect(rootRules).toContain("overscroll-behavior: none;");
    expect(css).not.toMatch(/body\s*\{\s*overflow:\s*auto;/);
    expect(shellRules).toContain("height: 100dvh;");
    expect(shellRules).toContain("min-height: 0;");
    expect(shellRules).toContain("max-height: 100dvh;");
    expect(shellRules).toContain("overflow: hidden;");
    expect(layoutRules).toContain("overflow: hidden;");
    expect(css).toMatch(/\.catalogue-grid,[\s\S]*?overflow-y:\s*auto;/);
    expect(css).toMatch(/@media \(max-height: 620px\)[\s\S]*?\.game-shell\s*\{[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior-y: contain;/);
  });

  it("allows structural rows to grow instead of clipping scaled copy", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");

    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(css).toContain('.game-shell[data-text-scale="large"] :is(.speed-group button, .icon-button)');
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain('.game-shell[data-service-phase="draining"] .edit-actions');
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(170px, max-content);");
  });

  it("presents the debrief as a modal dialog outside the inert play area", async () => {
    const simulator = await readFile(
      new URL("app/game/HawkerSimulator.tsx", root),
      "utf8",
    );

    expect(simulator).toContain('className="period-debrief"');
    expect(simulator).toContain('className="period-debrief-footer"');
    expect(simulator).toContain('className="debrief-cause-summary"');
    expect(simulator).toContain('role="dialog"');
    expect(simulator).toContain('aria-modal="true"');
    expect(simulator).toContain('snapshot.servicePeriod.phase === "debrief" ||');
    expect(simulator).toContain("first breakfast service");
    expect(simulator).not.toContain("first lunch crowd");
  });

  it("keeps the debrief continuation action outside its scrolling report", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");

    expect(css).toContain(".period-debrief-card");
    expect(css).toContain("flex-direction: column;");
    expect(css).toContain(".period-debrief-scroll");
    expect(css).toContain("min-height: 0;");
    expect(css).toContain(".period-debrief-footer");
  });

  it("keeps onboarding contained at narrow and short scaled viewports", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");

    expect(css).toContain("@media (max-width: 700px), (max-height: 620px)");
    expect(css).toContain("max-height: calc(100dvh - 16px);");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain(".tutorial-art,");
    expect(css).toContain(".nutrition-tour-art");
    expect(css).toContain('.game-shell[data-text-scale="large"] :is(.tutorial-modal, .nutrition-tour-modal)');
    expect(css).toContain('.game-shell[data-text-scale="large"] .nutrition-tour-copy');
    expect(css).toContain("overflow: visible;");
  });

  it("contains settings, help, and reset at narrow and combined scale", async () => {
    const css = await readFile(new URL("app/globals.css", root), "utf8");

    expect(css).toContain(".settings-modal,\n.help-modal,\n.confirm-modal");
    expect(css).toContain("max-height: calc(100dvh - 44px);");
    expect(css).toContain(".game-shell[data-text-scale=\"large\"] .help-grid");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain(".game-shell[data-text-scale=\"large\"] :is(.help-modal > footer, .confirm-modal > div, .button-row)");
    expect(css).toContain(".modal-backdrop:not(.nutrition-lab-backdrop)");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("width: max(44px, 1.6em);");
    expect(css).toMatch(/\.modal-backdrop\s*\{[\s\S]*?overflow: hidden;/);
    expect(css).toMatch(/\.settings-content,[\s\S]*?\.help-grid\s*\{[\s\S]*?min-height: 0;/);
    expect(css).toMatch(/\.settings-modal > header > div,[\s\S]*?\.help-modal > header > div\s*\{[\s\S]*?min-width: 0;/);
    expect(css).toMatch(/\.settings-modal h2,[\s\S]*?\.help-modal h2\s*\{[\s\S]*?overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.settings-modal header > button,[\s\S]*?\.help-modal header > button\s*\{[\s\S]*?flex: 0 0 auto;/);
  });

  it("keeps the guided decision in planning and preserves returning-player completion", async () => {
    const simulator = await readFile(
      new URL("app/game/HawkerSimulator.tsx", root),
      "utf8",
    );

    expect(simulator).toContain('"tutorial-complete"');
    expect(simulator).toContain('"nutrition-tour-v1-complete"');
    expect(simulator).toContain('"forecast-guide-v1-complete"');
    expect(simulator).toContain("guidedDecisionPreference === undefined && completedNutritionTour");
    expect(simulator).toContain("data-modal-initial-focus");
    expect(simulator).toContain("document.activeElement === initial && !available.includes(initial)");
    expect(simulator).toContain("async function finishNutritionTour()");
    expect(simulator).toContain("Prediction only: this does not change your menu, cash, objective, or service.");
    expect(simulator).toContain("Keep planning");
    expect(simulator).not.toContain("startAfterNutritionTour");
  });
});
