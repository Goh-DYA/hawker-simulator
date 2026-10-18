/**
 * What the furniture painters share: the footprint box of an object inside its texture and the
 * material colours the categories draw with (the classic stool plastics, timber, steel, foliage,
 * soil and terracotta).
 */
import { OVERHANG, type PlaceablePaintSpec } from "../specs";

/** The classic hawker-centre stool colours: red, green and blue moulded plastic. */
export const STOOL_COLOURS = [0xd84a3a, 0x3f8f5a, 0x3d6fa8] as const;
/** Timber tone of benches, trestles and communal tables. */
export const TIMBER = 0xb07a47;
/** Stainless steel tone. */
export const STEEL = 0xc9d3d0;
/** Dark powder-coated steel of legs and frames. */
export const DARK_STEEL = 0x5e6d6b;
/** Dark foliage tone. */
export const LEAF_DARK = 0x3d6b3f;
/** Light foliage tone. */
export const LEAF_LIGHT = 0x7fb069;
/** Potting soil tone. */
export const SOIL = 0x5a4634;
/** Terracotta pot tone. */
export const TERRACOTTA = 0xb8613d;

/** The footprint box of an object inside its texture. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly centreX: number;
  readonly centreY: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Builds the footprint box for a spec.
 *
 * @param spec - The placeable spec.
 * @returns The box, with the footprint top at `OVERHANG`.
 */
export function footprint_box(spec: PlaceablePaintSpec): Box {
  const x = 0;
  const y = OVERHANG;
  return {
    x,
    y,
    width: spec.width,
    height: spec.height,
    centreX: x + spec.width / 2,
    centreY: y + spec.height / 2,
    right: x + spec.width,
    bottom: y + spec.height,
  };
}
