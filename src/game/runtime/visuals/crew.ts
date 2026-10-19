/**
 * Code-native visual recipe for the table-cleaning crew: the shared uniform and each member's
 * stable figure.
 *
 * Every crew member wears the same teal shirt, amber utility apron and amber service cap, so the
 * crew reads as staff at a glance and never as a guest. Only the body, skin and hair vary, from
 * the member's index alone. The module is pure and free of Phaser.
 */
import type { Workwear } from "../art/people/apparel";
import { HAIR_COLOURS, HAIR_STYLE_COUNT } from "./customer";
import { SKIN_TONES, stableVisualHash } from "./palette";

/** The crew's uniform workwear: an amber utility apron with dark trim and a matching cap. */
export const CREW_WORKWEAR: Workwear = {
  apron: 0xf0b429,
  apronTrim: 0x24343a,
  apronStyle: "utility",
  headwear: "service-cap",
};
/** The crew's shirt under the apron. */
export const CREW_SHIRT = 0x2e7f86;
/** The crew's work trousers. */
export const CREW_TROUSERS = 0x2f3a4a;
/** The crew's work shoes. */
export const CREW_SHOES = 0x2b2b2b;
/** The cloth a crew member wipes tables with. */
export const CREW_CLOTH = 0xe8f1f2;

/** A crew member's body and hair, independent of the uniform. */
export interface CrewFigure {
  readonly skin: number;
  readonly hair: number;
  readonly hairStyle: number;
  /** Height class: 0 short, 1 average, 2 tall. */
  readonly stature: 0 | 1 | 2;
  /** Build class: 0 slim, 1 average, 2 broad. */
  readonly build: 0 | 1 | 2;
}

/**
 * Derives a crew member's figure from their index, so each member keeps the same look while the
 * crew grows or shrinks.
 *
 * @param index - The member's index in the crew, from 0.
 * @returns The figure.
 */
export function crew_figure_for_index(index: number): CrewFigure {
  const seed = stableVisualHash(`crew:${index}`);
  return {
    skin: SKIN_TONES[seed % SKIN_TONES.length] as number,
    hair: HAIR_COLOURS[(seed >>> 5) % HAIR_COLOURS.length] as number,
    hairStyle: (seed >>> 9) % HAIR_STYLE_COUNT,
    stature: ((seed >>> 13) % 3) as 0 | 1 | 2,
    build: ((seed >>> 16) % 3) as 0 | 1 | 2,
  };
}
