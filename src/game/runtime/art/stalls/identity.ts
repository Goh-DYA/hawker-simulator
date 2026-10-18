/**
 * What makes each stall recognisable beyond its roofline, palette and sign: the finish of its
 * back wall and interior floor, the wares hanging from its rail, the goods on its shelf, the
 * cooking station on its work bench and the piece beside it, the tall cabinet or floor clutter
 * standing in its interior, its counter cabinet material, the valance of a generic awning and
 * whether an extractor hood hangs over the station, and which way round the kitchen is laid out.
 *
 * `DRESSING_BY_ID` lists every launch stall by content ID; an unlisted ID borrows the dressing of
 * the launch stall that shares its workspace art branch, so a new stall still paints a complete
 * kitchen.
 */
import type { StallWorkspaceArt } from "../../render/art";
import type { StallPaintSpec } from "../specs";

/** How the back wall is finished. */
export type WallFinish = "tile" | "subway" | "mosaic" | "soot" | "peranakan" | "timber";

/** How the interior floor the vendor stands on is finished. */
export type FloorFinish = "quarry" | "rubber" | "checker" | "slate";

/** What hangs from the rail on the back wall. */
export type HangingWares =
  | "chickens"
  | "ducks"
  | "kopi-socks"
  | "strainers"
  | "lanterns"
  | "ketupat"
  | "woks"
  | "coconuts"
  | "cloths"
  | "tools"
  | "bunting"
  | "fretwork"
  | "net";

/** What stands on the back shelf (and on the inner shelves of a counter seen from behind). */
export type ShelfGoods =
  | "plates"
  | "parcels"
  | "cups"
  | "sauces"
  | "tiffins"
  | "dessert-jars"
  | "satay-pots"
  | "bowls"
  | "spice-tins"
  | "teapots"
  | "claypots"
  | "herb-jars"
  | "limes";

/** The cooking station on the work bench. */
export type Station =
  | "chopping-block"
  | "gravy-pots"
  | "kettles"
  | "wok"
  | "noodle-boiler"
  | "griddle"
  | "ice-shaver"
  | "charcoal-grill"
  | "ingredient-trays"
  | "dosa-griddle"
  | "steamer-tower"
  | "claypot-hearth"
  | "cauldron"
  | "fish-grill";

/** The second piece on the work bench, beside the station. */
export type SidePiece =
  | "rice-pot"
  | "stock-pot"
  | "bowls"
  | "bottles"
  | "teapot"
  | "urn"
  | "leaf-stack"
  | "noodles"
  | "syrups"
  | "claypot"
  | "peanut-pot"
  | "steamers";

/** A tall cabinet or low clutter standing in the interior. */
export type InteriorExtra = "fridge" | "drawers" | "gas" | "sacks" | "icebox" | "none";

/** The counter cabinet material. */
export type CabinetMaterial = "laminate" | "steel" | "timber";

/** The shape of an awning's valance. */
export type ValanceStyle = "round" | "point" | "straight";

/** Everything a stall is dressed with beyond its roofline, palette and sign. */
export interface StallDressing {
  readonly wall: WallFinish;
  readonly floor: FloorFinish;
  readonly hanging: HangingWares;
  readonly shelf: ShelfGoods;
  readonly station: Station;
  readonly side: SidePiece;
  readonly extra: InteriorExtra;
  readonly cabinet: CabinetMaterial;
  /** Valance shape, for stalls on the generic `awning` roof branch. */
  readonly valance: ValanceStyle;
  /** True when a stainless extractor hood hangs over the station. */
  readonly hasHood: boolean;
  /**
   * True when the kitchen is laid out mirrored: the station, hood and tall cabinet on the right
   * of the back wall (and at the south end of a side bench), the menu board on the left.
   */
  readonly isMirrored: boolean;
}

/** The dressing of every launch stall, keyed by content ID. */
const DRESSING_BY_ID: Readonly<Record<string, StallDressing>> = {
  "stall.sunrise-roost": {
    wall: "tile",
    floor: "quarry",
    hanging: "chickens",
    shelf: "plates",
    station: "chopping-block",
    side: "rice-pot",
    extra: "none",
    cabinet: "laminate",
    valance: "round",
    hasHood: false,
    isMirrored: false,
  },
  "stall.coconut-lime": {
    wall: "timber",
    floor: "quarry",
    hanging: "coconuts",
    shelf: "parcels",
    station: "gravy-pots",
    side: "leaf-stack",
    extra: "sacks",
    cabinet: "timber",
    valance: "round",
    hasHood: false,
    isMirrored: true,
  },
  "stall.kopi-canopy": {
    wall: "mosaic",
    floor: "checker",
    hanging: "kopi-socks",
    shelf: "cups",
    station: "kettles",
    side: "urn",
    extra: "fridge",
    cabinet: "laminate",
    valance: "round",
    hasHood: false,
    isMirrored: false,
  },
  "stall.cinder-wok": {
    wall: "soot",
    floor: "rubber",
    hanging: "woks",
    shelf: "sauces",
    station: "wok",
    side: "bottles",
    extra: "gas",
    cabinet: "steel",
    valance: "round",
    hasHood: true,
    isMirrored: true,
  },
  "stall.mee-pok-junction": {
    wall: "subway",
    floor: "rubber",
    hanging: "strainers",
    shelf: "sauces",
    station: "noodle-boiler",
    side: "noodles",
    extra: "none",
    cabinet: "laminate",
    valance: "straight",
    hasHood: false,
    isMirrored: false,
  },
  "stall.tiffin-lantern": {
    wall: "tile",
    floor: "quarry",
    hanging: "lanterns",
    shelf: "tiffins",
    station: "griddle",
    side: "stock-pot",
    extra: "gas",
    cabinet: "laminate",
    valance: "point",
    hasHood: true,
    isMirrored: false,
  },
  "stall.sweet-monsoon": {
    wall: "mosaic",
    floor: "checker",
    hanging: "bunting",
    shelf: "dessert-jars",
    station: "ice-shaver",
    side: "syrups",
    extra: "none",
    cabinet: "laminate",
    valance: "round",
    hasHood: false,
    isMirrored: true,
  },
  "stall.satay-meridian": {
    wall: "soot",
    floor: "quarry",
    hanging: "ketupat",
    shelf: "satay-pots",
    station: "charcoal-grill",
    side: "peanut-pot",
    extra: "sacks",
    cabinet: "steel",
    valance: "round",
    hasHood: true,
    isMirrored: false,
  },
  "stall.pick-and-mix": {
    wall: "tile",
    floor: "rubber",
    hanging: "tools",
    shelf: "bowls",
    station: "ingredient-trays",
    side: "stock-pot",
    extra: "none",
    cabinet: "laminate",
    valance: "point",
    hasHood: false,
    isMirrored: true,
  },
  "stall.tamarind-leaf": {
    wall: "timber",
    floor: "quarry",
    hanging: "tools",
    shelf: "spice-tins",
    station: "dosa-griddle",
    side: "leaf-stack",
    extra: "sacks",
    cabinet: "timber",
    valance: "round",
    hasHood: true,
    isMirrored: true,
  },
  "stall.bamboo-basket": {
    wall: "subway",
    floor: "slate",
    hanging: "cloths",
    shelf: "teapots",
    station: "steamer-tower",
    side: "steamers",
    extra: "gas",
    cabinet: "laminate",
    valance: "round",
    hasHood: false,
    isMirrored: false,
  },
  "stall.straits-hearth": {
    wall: "peranakan",
    floor: "checker",
    hanging: "fretwork",
    shelf: "claypots",
    station: "claypot-hearth",
    side: "teapot",
    extra: "none",
    cabinet: "timber",
    valance: "round",
    hasHood: true,
    isMirrored: false,
  },
  "stall.herbal-cauldron": {
    wall: "tile",
    floor: "slate",
    hanging: "ducks",
    shelf: "herb-jars",
    station: "cauldron",
    side: "claypot",
    extra: "drawers",
    cabinet: "timber",
    valance: "straight",
    hasHood: true,
    isMirrored: true,
  },
  "stall.harbour-ember": {
    wall: "subway",
    floor: "rubber",
    hanging: "net",
    shelf: "limes",
    station: "fish-grill",
    side: "stock-pot",
    extra: "icebox",
    cabinet: "steel",
    valance: "round",
    hasHood: true,
    isMirrored: true,
  },
};

/** The launch stall each workspace art branch belongs to, for dressing unlisted stall IDs. */
const STALL_ID_BY_WORKSPACE: Readonly<Record<StallWorkspaceArt, string>> = {
  sunrise: "stall.sunrise-roost",
  coconut: "stall.coconut-lime",
  kopi: "stall.kopi-canopy",
  cinder: "stall.cinder-wok",
  "mee-pok": "stall.mee-pok-junction",
  "sweet-monsoon": "stall.sweet-monsoon",
  satay: "stall.satay-meridian",
  "bamboo-basket": "stall.bamboo-basket",
  tiffin: "stall.tiffin-lantern",
  tamarind: "stall.tamarind-leaf",
  straits: "stall.straits-hearth",
  harbour: "stall.harbour-ember",
  generic: "stall.pick-and-mix",
};

/**
 * Resolves a stall's dressing: its table entry, or the entry of the launch stall that shares
 * its workspace art branch.
 *
 * @param spec - The stall spec.
 * @returns The dressing to paint.
 */
export function resolve_dressing(spec: StallPaintSpec): StallDressing {
  if (Object.hasOwn(DRESSING_BY_ID, spec.definitionId)) {
    return DRESSING_BY_ID[spec.definitionId] as StallDressing;
  }
  return DRESSING_BY_ID[STALL_ID_BY_WORKSPACE[spec.art.workspace]] as StallDressing;
}
