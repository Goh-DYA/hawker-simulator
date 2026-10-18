/**
 * Draw-output tests for the effect painters in `runtime/art/effects.ts` and the status bubbles in
 * `runtime/art/effects/indicators.ts`.
 *
 * Every effect kind is painted into a recording context for the default, high-contrast and
 * low-detail frames; the digests prove each kind paints something of its own, that painting is
 * deterministic, and that the bubbles thicken their outline in high contrast.
 */
import { describe, expect, it } from "vitest";

import { EFFECT_KINDS, EFFECT_SIZE, type PaintFrame } from "@/src/game/runtime/art/specs";

import { record_paint } from "./fixtures";

/** The three paint frames every effect is checked in. */
const FRAMES: Readonly<Record<string, PaintFrame>> = {
  default: { isHighContrast: false, isLowDetail: false },
  "high contrast": { isHighContrast: true, isLowDetail: false },
  "low detail": { isHighContrast: false, isLowDetail: true },
};

describe("effect painters", () => {
  it("paints every effect in every frame into an effect-sized square", () => {
    for (const [name, frame] of Object.entries(FRAMES)) {
      for (const effect of EFFECT_KINDS) {
        const painted = record_paint({ kind: "effect", effect, frame });

        expect(painted.width, `${effect} ${name}`).toBe(EFFECT_SIZE);
        expect(painted.height, `${effect} ${name}`).toBe(EFFECT_SIZE);
        expect(painted.log.length, `${effect} ${name}`).toBeGreaterThan(0);
      }
    }
  });

  it("paints every effect differently from every other effect", () => {
    for (const [name, frame] of Object.entries(FRAMES)) {
      const digests = EFFECT_KINDS.map((effect) =>
        record_paint({ kind: "effect", effect, frame }).digest(),
      );

      expect(new Set(digests).size, name).toBe(EFFECT_KINDS.length);
    }
  });

  it("paints the same effect twice to the same calls", () => {
    for (const effect of EFFECT_KINDS) {
      const spec = { kind: "effect", effect, frame: FRAMES.default as PaintFrame } as const;

      expect(record_paint(spec).digest(), effect).toBe(record_paint(spec).digest());
    }
  });

  it("paints the status bubbles differently in high contrast", () => {
    for (const effect of EFFECT_KINDS.filter((kind) => kind.startsWith("indicator-"))) {
      const standard = record_paint({
        kind: "effect",
        effect,
        frame: FRAMES.default as PaintFrame,
      });
      const contrast = record_paint({
        kind: "effect",
        effect,
        frame: FRAMES["high contrast"] as PaintFrame,
      });

      expect(contrast.digest(), effect).not.toBe(standard.digest());
    }
  });
});
