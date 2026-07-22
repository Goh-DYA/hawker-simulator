import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

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
  });

  it("finishes the nutrition guide before starting a new player's breakfast", async () => {
    const simulator = await readFile(
      new URL("app/game/HawkerSimulator.tsx", root),
      "utf8",
    );

    expect(simulator).toContain("startAfterNutritionTour");
    expect(simulator).toContain("data-modal-initial-focus");
    expect(simulator).toContain("document.activeElement === initial && !available.includes(initial)");
    expect(simulator).toContain("void finishNutritionTour(startAfterNutritionTour)");
    expect(simulator).toContain('? "Start breakfast"');
    expect(simulator).toContain('"Skip and keep planning"');
  });
});
