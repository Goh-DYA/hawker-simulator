/**
 * ID-keyed art selection for stalls and placeables.
 *
 * The stall and object renderers once picked their art by testing the content ID (or the
 * placeable motif) against chains of substrings, so a renamed or added ID could silently
 * reach a different branch. `STALL_ART_BY_ID` and `PLACEABLE_STYLE_BY_ID` record, as
 * literals, the branch each launch content ID reached through those chains when the tables
 * were written, so every current ID maps explicitly to its art. The renderers resolve an ID
 * through `resolve_stall_art` and `resolve_placeable_style`, which read the table first and
 * fall back to the original substring chains (the `classify_*` functions) for IDs the tables
 * do not list. Only the branch chains are tabled: the single-substring cues that tweak a
 * branch's sizes, colours or extra details stay in the renderers.
 *
 * The module is pure, Phaser-free and holds no content imports beyond types.
 */
import type { PlaceableCategory } from "@/src/content";

/** The roofline branch of `drawStallGraphic`; `awning` is the generic striped awning. */
export type StallRoofArt =
  | "coconut"
  | "tamarind"
  | "kopi"
  | "mee-pok"
  | "sweet-monsoon"
  | "satay"
  | "bamboo-basket"
  | "cinder"
  | "harbour"
  | "tiffin"
  | "straits"
  | "jade-ladle"
  | "longan-moon"
  | "lesung"
  | "peppercorn"
  | "awning";

/** The counter work-prop branch of `drawStallGraphic`; `generic` is the plain prop row. */
export type StallWorkspaceArt =
  | "sunrise"
  | "coconut"
  | "kopi"
  | "cinder"
  | "mee-pok"
  | "sweet-monsoon"
  | "satay"
  | "bamboo-basket"
  | "tiffin"
  | "tamarind"
  | "straits"
  | "harbour"
  | "generic";

/** The two independent art branches a stall graphic draws. */
export interface StallArt {
  readonly roof: StallRoofArt;
  readonly workspace: StallWorkspaceArt;
}

/** The form branch of `drawSeatGraphic`. */
export type SeatStyle = "stool" | "bench" | "chair";

/** The fixture branch of `drawFixtureGraphic`; `cart` is the wheeled cabinet. */
export type FixtureStyle =
  "ticket" | "condiment" | "cutlery" | "water" | "pickup" | "display-case" | "cart";

/** The branch of `drawTrayWasteGraphic`; `bin` is the lidded general bin. */
export type TrayWasteStyle = "tray-point" | "recycling" | "food-waste" | "trolley" | "bin";

/**
 * The foliage branch of `drawPlantGraphic`; `leafy` is the generic leaf fan and `trellis`
 * draws no extra foliage.
 */
export type PlantStyle =
  "banana" | "areca" | "pandan" | "fern" | "rain-garden" | "hanging" | "leafy" | "trellis";

/** The panel glyph branch of `drawSignageGraphic`; `board` is the tall information board. */
export type SignagePanelStyle = "board" | "arrow" | "accessible" | "queue" | "plain";

/** The short label branch of `drawSignageGraphic`. */
export type SignageLabelStyle =
  "directory" | "menu" | "return" | "accessible" | "queue" | "row" | "welcome";

/** The two independent art branches a sign draws. */
export interface SignageStyle {
  readonly panel: SignagePanelStyle;
  readonly label: SignageLabelStyle;
}

/** The branch of `drawDividerGraphic`; `panel` is the solid or tiled screen. */
export type DividerStyle = "queue-rail" | "clear-wind" | "planter" | "panel";

/** The branch of `drawFacilityGraphic`; `utility` is the plain service box. */
export type FacilityStyle =
  "handwash" | "mop-sink" | "accessible-basin" | "fountain" | "first-aid" | "cupboard" | "utility";

/** The branch of `drawDecorGraphic`; `board` is the wall mural or noticeboard. */
export type DecorStyle = "bunting" | "flower-vase" | "clock" | "board";

/** The support branch of `drawTableGraphic`. */
export type TableSupportStyle = "pedestal" | "folding" | "trestle" | "legs";

/** The tabletop branch of `drawTableGraphic`. */
export type TableTopStyle = "terrazzo" | "round" | "snack-ledge" | "slab";

/** The two independent art branches a table draws. */
export interface TableStyle {
  readonly support: TableSupportStyle;
  readonly top: TableTopStyle;
}

/** The fitting branch of `drawLightingGraphic`; `lamp` is the plain round lamp. */
export type LightingStyle =
  | "tube"
  | "pendant"
  | "lantern-cluster"
  | "path-light"
  | "skylight"
  | "string"
  | "task-light"
  | "lamp";

/** The housing branch of `drawFanGraphic`; the rotor styles share the bladed fan. */
export type FanStyle = "column" | "exhaust" | "wall-rotor" | "ceiling-rotor" | "floor-rotor";

/** The art style each placeable category's renderer selects by. */
export interface PlaceableStyles {
  readonly table: TableStyle;
  readonly seat: SeatStyle;
  readonly "stall-fixture": FixtureStyle;
  readonly "tray-waste": TrayWasteStyle;
  readonly lighting: LightingStyle;
  readonly fan: FanStyle;
  readonly plant: PlantStyle;
  readonly signage: SignageStyle;
  readonly divider: DividerStyle;
  readonly facility: FacilityStyle;
  readonly decor: DecorStyle;
}

/** A placeable whose style can be resolved: its content ID and its motif. */
export interface PlaceableArtKey {
  readonly id: string;
  readonly motif: string;
}

/** The art of every launch stall, keyed by stall content ID. */
export const STALL_ART_BY_ID: Readonly<Record<string, StallArt>> = {
  "stall.sunrise-roost": { roof: "awning", workspace: "sunrise" },
  "stall.coconut-lime": { roof: "coconut", workspace: "coconut" },
  "stall.kopi-canopy": { roof: "kopi", workspace: "kopi" },
  "stall.cinder-wok": { roof: "cinder", workspace: "cinder" },
  "stall.mee-pok-junction": { roof: "mee-pok", workspace: "mee-pok" },
  "stall.tiffin-lantern": { roof: "tiffin", workspace: "tiffin" },
  "stall.sweet-monsoon": { roof: "sweet-monsoon", workspace: "sweet-monsoon" },
  "stall.satay-meridian": { roof: "satay", workspace: "satay" },
  "stall.pick-and-mix": { roof: "awning", workspace: "generic" },
  "stall.jade-ladle": { roof: "jade-ladle", workspace: "generic" },
  "stall.tamarind-leaf": { roof: "tamarind", workspace: "tamarind" },
  "stall.bamboo-basket": { roof: "bamboo-basket", workspace: "bamboo-basket" },
  "stall.longan-moon": { roof: "longan-moon", workspace: "generic" },
  "stall.lesung-corner": { roof: "lesung", workspace: "generic" },
  "stall.straits-hearth": { roof: "straits", workspace: "straits" },
  "stall.herbal-cauldron": { roof: "awning", workspace: "generic" },
  "stall.peppercorn-plate": { roof: "peppercorn", workspace: "generic" },
  "stall.harbour-ember": { roof: "harbour", workspace: "harbour" },
};

/** The art style of every launch placeable, keyed by category, then by content ID. */
export const PLACEABLE_STYLE_BY_ID: {
  readonly [C in PlaceableCategory]: Readonly<Record<string, PlaceableStyles[C]>>;
} = {
  table: {
    "item.compact-square-table": { support: "legs", top: "slab" },
    "item.round-cafe-table": { support: "pedestal", top: "round" },
    "item.long-communal-table": { support: "legs", top: "slab" },
    "item.family-trestle-table": { support: "trestle", top: "slab" },
    "item.accessible-end-table": { support: "legs", top: "slab" },
    "item.standing-snack-ledge": { support: "legs", top: "snack-ledge" },
    "item.folding-overflow-table": { support: "folding", top: "slab" },
    "item.terrazzo-feature-table": { support: "pedestal", top: "terrazzo" },
  },
  seat: {
    "item.stacking-stool": "stool",
    "item.moulded-back-chair": "chair",
    "item.two-person-bench": "bench",
    "item.easy-rise-arm-chair": "chair",
    "item.high-counter-stool": "stool",
    "item.booster-family-chair": "chair",
    "item.cushioned-dining-chair": "chair",
    "item.three-person-communal-bench": "bench",
    "item.acoustic-booth-seat": "bench",
    "item.swivel-perch-seat": "stool",
  },
  "stall-fixture": {
    "item.queue-ticket-dispenser": "ticket",
    "item.condiment-counter": "condiment",
    "item.cutlery-napkin-station": "cutlery",
    "item.water-carafe-station": "water",
    "item.order-pickup-shelf": "pickup",
    "item.heated-display-case": "display-case",
    "item.chilled-display-case": "display-case",
    "item.mobile-prep-cart": "cart",
  },
  "tray-waste": {
    "item.single-bay-tray-return": "tray-point",
    "item.dual-bay-tray-return": "tray-point",
    "item.dish-drop-counter": "tray-point",
    "item.recycling-sorter": "recycling",
    "item.covered-food-waste-bin": "food-waste",
    "item.general-waste-bin": "bin",
    "item.cleaning-trolley-bay": "trolley",
    "item.clean-tray-stack-rack": "tray-point",
  },
  lighting: {
    "item.ceiling-tube-light": "tube",
    "item.pendant-dining-light": "pendant",
    "item.woven-lantern-cluster": "lantern-cluster",
    "item.counter-task-light": "task-light",
    "item.low-path-light": "path-light",
    "item.skylight-diffuser": "skylight",
    "item.festive-string-lights": "string",
  },
  fan: {
    "item.wall-circulation-fan": "wall-rotor",
    "item.ceiling-fan": "ceiling-rotor",
    "item.column-fan": "column",
    "item.high-volume-air-fan": "floor-rotor",
    "item.quiet-corner-fan": "floor-rotor",
    "item.stall-exhaust-booster": "exhaust",
  },
  plant: {
    "item.table-herb-planter": "leafy",
    "item.tall-areca-planter": "areca",
    "item.fern-trough": "fern",
    "item.vine-trellis": "trellis",
    "item.rain-garden-pot": "rain-garden",
    "item.hanging-pothos": "hanging",
    "item.dwarf-banana-planter": "banana",
    "item.pandan-border-bed": "pandan",
  },
  signage: {
    "item.entrance-directory": { panel: "board", label: "directory" },
    "item.stall-row-marker": { panel: "plain", label: "row" },
    "item.tray-return-arrow-sign": { panel: "arrow", label: "return" },
    "item.accessible-wayfinding-sign": { panel: "accessible", label: "accessible" },
    "item.queue-etiquette-sign": { panel: "queue", label: "queue" },
    "item.menu-preview-board": { panel: "board", label: "menu" },
    "item.centre-identity-sign": { panel: "board", label: "welcome" },
  },
  divider: {
    "item.low-timber-screen": "panel",
    "item.tiled-half-wall": "panel",
    "item.clear-wind-screen": "clear-wind",
    "item.integrated-planter-divider": "planter",
    "item.retractable-queue-rail": "queue-rail",
    "item.acoustic-screen": "panel",
  },
  facility: {
    "item.public-handwash-sink": "handwash",
    "item.drinking-water-fountain": "fountain",
    "item.locked-cleaning-cupboard": "cupboard",
    "item.staff-mop-sink": "mop-sink",
    "item.first-aid-cabinet": "first-aid",
    "item.accessible-wash-basin": "accessible-basin",
    "item.protected-utility-point": "utility",
  },
  decor: {
    "item.geometric-tile-mural": "board",
    "item.community-noticeboard": "board",
    "item.fabric-ceiling-bunting": "bunting",
    "item.tabletop-flower-vase": "flower-vase",
    "item.feature-centre-clock": "clock",
  },
};

/**
 * Picks a stall's art by the original substring chains, for stall IDs the table omits.
 *
 * @param id - The stall content ID.
 * @returns The roofline and work-prop branches the substrings of `id` reach.
 */
export function classify_stall_art(id: string): StallArt {
  return { roof: classify_stall_roof(id), workspace: classify_stall_workspace(id) };
}

function classify_stall_roof(id: string): StallRoofArt {
  if (id.includes("coconut")) return "coconut";
  if (id.includes("tamarind")) return "tamarind";
  if (id.includes("kopi")) return "kopi";
  if (id.includes("mee-pok")) return "mee-pok";
  if (id.includes("sweet-monsoon")) return "sweet-monsoon";
  if (id.includes("satay")) return "satay";
  if (id.includes("bamboo-basket")) return "bamboo-basket";
  if (id.includes("cinder")) return "cinder";
  if (id.includes("harbour")) return "harbour";
  if (id.includes("tiffin")) return "tiffin";
  if (id.includes("straits")) return "straits";
  if (id.includes("jade-ladle")) return "jade-ladle";
  if (id.includes("longan")) return "longan-moon";
  if (id.includes("lesung")) return "lesung";
  if (id.includes("peppercorn")) return "peppercorn";
  return "awning";
}

function classify_stall_workspace(id: string): StallWorkspaceArt {
  if (id.includes("sunrise")) return "sunrise";
  if (id.includes("coconut")) return "coconut";
  if (id.includes("kopi")) return "kopi";
  if (id.includes("cinder")) return "cinder";
  if (id.includes("mee-pok")) return "mee-pok";
  if (id.includes("sweet-monsoon")) return "sweet-monsoon";
  if (id.includes("satay")) return "satay";
  if (id.includes("bamboo-basket")) return "bamboo-basket";
  if (id.includes("tiffin")) return "tiffin";
  if (id.includes("tamarind")) return "tamarind";
  if (id.includes("straits")) return "straits";
  if (id.includes("harbour")) return "harbour";
  return "generic";
}

function classify_seat_style(motif: string): SeatStyle {
  if (motif.includes("stool") || motif.includes("perch")) return "stool";
  if (motif.includes("bench") || motif.includes("booth")) return "bench";
  return "chair";
}

function classify_fixture_style(motif: string): FixtureStyle {
  if (motif.includes("ticket")) return "ticket";
  if (motif.includes("condiment")) return "condiment";
  if (motif.includes("cutlery")) return "cutlery";
  if (motif.includes("water")) return "water";
  if (motif.includes("pickup")) return "pickup";
  if (motif.includes("display-case")) return "display-case";
  return "cart";
}

function classify_tray_waste_style(motif: string): TrayWasteStyle {
  if (
    motif.includes("tray-return") ||
    motif.includes("dish-drop") ||
    motif.includes("tray-stack")
  ) {
    return "tray-point";
  }
  if (motif.includes("recycling")) return "recycling";
  if (motif.includes("food-waste")) return "food-waste";
  if (motif.includes("trolley")) return "trolley";
  return "bin";
}

function classify_plant_style(motif: string): PlantStyle {
  if (motif.includes("banana")) return "banana";
  if (motif.includes("areca")) return "areca";
  if (motif.includes("pandan")) return "pandan";
  if (motif.includes("fern") || motif.includes("trough")) return "fern";
  if (motif.includes("rain-garden")) return "rain-garden";
  if (motif.includes("hanging")) return "hanging";
  if (!motif.includes("trellis")) return "leafy";
  return "trellis";
}

function classify_signage_style(motif: string): SignageStyle {
  return { panel: classify_signage_panel(motif), label: classify_signage_label(motif) };
}

function classify_signage_panel(motif: string): SignagePanelStyle {
  if (motif.includes("directory") || motif.includes("menu-preview") || motif.includes("identity")) {
    return "board";
  }
  if (motif.includes("arrow")) return "arrow";
  if (motif.includes("accessible")) return "accessible";
  if (motif.includes("queue")) return "queue";
  return "plain";
}

function classify_signage_label(motif: string): SignageLabelStyle {
  if (motif.includes("directory")) return "directory";
  if (motif.includes("menu")) return "menu";
  if (motif.includes("return")) return "return";
  if (motif.includes("accessible")) return "accessible";
  if (motif.includes("queue")) return "queue";
  if (motif.includes("row")) return "row";
  return "welcome";
}

function classify_divider_style(motif: string): DividerStyle {
  if (motif.includes("queue-rail")) return "queue-rail";
  if (motif.includes("clear-wind")) return "clear-wind";
  if (motif.includes("planter")) return "planter";
  return "panel";
}

function classify_facility_style(motif: string): FacilityStyle {
  if (motif.includes("handwash")) return "handwash";
  if (motif.includes("mop-sink")) return "mop-sink";
  if (motif.includes("accessible") && motif.includes("basin")) return "accessible-basin";
  if (motif.includes("fountain")) return "fountain";
  if (motif.includes("first-aid")) return "first-aid";
  if (motif.includes("cupboard")) return "cupboard";
  return "utility";
}

function classify_decor_style(motif: string): DecorStyle {
  if (motif.includes("bunting")) return "bunting";
  if (motif.includes("flower-vase")) return "flower-vase";
  if (motif.includes("clock")) return "clock";
  return "board";
}

function classify_table_style(motif: string): TableStyle {
  return { support: classify_table_support(motif), top: classify_table_top(motif) };
}

function classify_table_support(motif: string): TableSupportStyle {
  if (motif.includes("round") || motif.includes("terrazzo")) return "pedestal";
  if (motif.includes("folding")) return "folding";
  if (motif.includes("trestle")) return "trestle";
  return "legs";
}

function classify_table_top(motif: string): TableTopStyle {
  if (motif.includes("terrazzo")) return "terrazzo";
  if (motif.includes("round")) return "round";
  if (motif.includes("snack-ledge")) return "snack-ledge";
  return "slab";
}

function classify_lighting_style(motif: string): LightingStyle {
  if (motif.includes("tube")) return "tube";
  if (motif.includes("pendant")) return "pendant";
  if (motif.includes("lantern-cluster")) return "lantern-cluster";
  if (motif.includes("path-light")) return "path-light";
  if (motif.includes("skylight")) return "skylight";
  if (motif.includes("string")) return "string";
  if (motif.includes("task-light")) return "task-light";
  return "lamp";
}

function classify_fan_style(motif: string): FanStyle {
  if (motif.includes("column")) return "column";
  if (motif.includes("exhaust")) return "exhaust";
  if (motif.includes("wall")) return "wall-rotor";
  if (motif.includes("ceiling")) return "ceiling-rotor";
  return "floor-rotor";
}

/** The original substring chain of each placeable category's renderer, run on the motif. */
const PLACEABLE_STYLE_CLASSIFIERS: {
  readonly [C in PlaceableCategory]: (motif: string) => PlaceableStyles[C];
} = {
  table: classify_table_style,
  seat: classify_seat_style,
  "stall-fixture": classify_fixture_style,
  "tray-waste": classify_tray_waste_style,
  lighting: classify_lighting_style,
  fan: classify_fan_style,
  plant: classify_plant_style,
  signage: classify_signage_style,
  divider: classify_divider_style,
  facility: classify_facility_style,
  decor: classify_decor_style,
};

/**
 * Picks a placeable's art style by its renderer's original substring chain, for placeable
 * IDs the table omits.
 *
 * @param category - The renderer's placeable category.
 * @param motif - The placeable's motif (its content ID without the `item.` prefix).
 * @returns The style the substrings of `motif` reach.
 */
export function classify_placeable_style<C extends PlaceableCategory>(
  category: C,
  motif: string,
): PlaceableStyles[C] {
  return PLACEABLE_STYLE_CLASSIFIERS[category](motif);
}

/**
 * Resolves a stall's art: its table entry, or the substring fallback for an unlisted ID.
 *
 * @param id - The stall content ID.
 * @returns The roofline and work-prop branches to draw.
 */
export function resolve_stall_art(id: string): StallArt {
  return Object.hasOwn(STALL_ART_BY_ID, id) ? STALL_ART_BY_ID[id] : classify_stall_art(id);
}

/**
 * Resolves a placeable's art style: its table entry under the renderer's category, or the
 * substring fallback on its motif for an unlisted ID.
 *
 * @param category - The renderer's placeable category.
 * @param key - The placeable's content ID (the table key) and motif (the fallback input).
 * @returns The style to draw.
 */
export function resolve_placeable_style<C extends PlaceableCategory>(
  category: C,
  key: PlaceableArtKey,
): PlaceableStyles[C] {
  const table = PLACEABLE_STYLE_BY_ID[category];
  return Object.hasOwn(table, key.id)
    ? table[key.id]
    : classify_placeable_style(category, key.motif);
}
