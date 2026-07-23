import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const simulator = readFileSync(
  new URL("../app/game/HawkerSimulator.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

describe("Stage 4 event-choice UI", () => {
  it("shows exact choice, resulting, and neutral forecast effects before service", () => {
    expect(simulator).toContain("Base event forecast before your choice");
    expect(simulator).toContain("choice.choiceDeltaLabels.join");
    expect(simulator).toContain("choice.resultingModifierLabels.join");
    expect(simulator).toContain("choice.resultingOutcome");
    expect(simulator).toContain(
      "snapshot.neighbourhoodEvent.neutralModifierLabels.join",
    );
    expect(simulator).toContain('aria-label="Neutral event outcome"');
  });

  it("keeps the untimed decision scroll-contained at small and enlarged scales", () => {
    expect(css).toMatch(
      /\.event-decision-content\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/,
    );
    expect(css).toContain(
      '.game-shell[data-text-scale="large"] .event-choice-list button',
    );
    expect(css).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.event-choice-list\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /\.event-choice-list button :is\(strong, span\)\s*\{[^}]*font-size:\s*0\.75rem;/,
    );
    expect(css).toMatch(
      /\.event-neutral-copy p\s*\{[^}]*font-size:\s*0\.75rem;[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(css).toMatch(
      /@media \(max-height: 620px\)[\s\S]*?data-text-scale="large"[^}]*\.event-decision-modal\s*\{[^}]*display:\s*block;[^}]*overflow-y:\s*auto;/,
    );
    expect(css).toMatch(
      /@media \(max-height: 620px\)[\s\S]*?data-text-scale="large"[^}]*\.event-decision-content\s*\{[^}]*overflow:\s*visible;/,
    );
  });
});
