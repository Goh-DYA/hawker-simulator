/**
 * Code-native visual recipes for placeables.
 *
 * Each recipe names a placeable's motif, physical form, material and detail cues, plus stable
 * hash variants, so the renderer and the build panel draw it the same way without image assets.
 * The module is pure and free of Phaser.
 */
import type { PlaceableCategory } from "@/src/content";
import { ACCENTS, stableVisualHash } from "./palette";

export type PlaceableMaterial =
  | "laminate"
  | "timber"
  | "terrazzo"
  | "moulded-plastic"
  | "upholstery"
  | "stainless-steel"
  | "powder-coated-metal"
  | "glass"
  | "ceramic"
  | "woven-fibre"
  | "fabric"
  | "masonry"
  | "living-foliage"
  | "painted-board"
  | "composite";

/** A deterministic, renderer-friendly contract for code-native placeable art. */
export interface PlaceableVisualRecipe {
  readonly id: string;
  readonly category: PlaceableCategory;
  /** Semantic catalogue motif, for example `round-cafe-table` or `tray-return-arrow-sign`. */
  readonly motif: string;
  /** Broad physical form that renderers can use instead of parsing the id. */
  readonly form: string;
  /** Dominant real-world material and finish. */
  readonly material: PlaceableMaterial;
  /** Drawable construction or identity cues, sourced from catalogue tags and id vocabulary. */
  readonly detailCues: readonly string[];
  /** Stable semantic identity that does not depend on colour or hash variants. */
  readonly semanticKey: string;
  readonly seed: number;
  readonly silhouetteVariant: number;
  readonly detailVariant: number;
  readonly accent: number;
  readonly makerMark: number;
  readonly contractKey: string;
}

const GENERIC_PLACEABLE_WORDS = new Set([
  "item",
  "table",
  "seat",
  "station",
  "fixture",
  "facility",
  "decor",
]);

const PLACEABLE_FORM_RULES: readonly (readonly [RegExp, string])[] = [
  [/terrazzo|round-cafe/, "round-pedestal"],
  [/compact-square/, "compact-square-top"],
  [/long-communal/, "long-communal-slab"],
  [/family-trestle/, "wide-trestle"],
  [/accessible-end/, "accessible-notched-top"],
  [/snack-ledge/, "raised-narrow-ledge"],
  [/folding-overflow/, "folding-cross-brace"],
  [/acoustic-booth/, "high-back-booth"],
  [/bench/, "multi-place-bench"],
  [/stool|perch/, "pedestal-stool"],
  [/arm-chair/, "support-arm-chair"],
  [/chair/, "backed-chair"],
  [/display-case/, "glazed-display-case"],
  [/ticket-dispenser/, "ticket-pedestal"],
  [/counter/, "service-counter"],
  [/shelf|rack|tray-return/, "open-rack"],
  [/cart|trolley/, "wheeled-cart"],
  [/sorter/, "multi-stream-receptacle"],
  [/waste-bin|general-waste/, "lidded-receptacle"],
  [/tube-light/, "linear-light"],
  [/pendant/, "suspended-shade"],
  [/lantern/, "lantern-cluster"],
  [/string-light/, "festoon-cable"],
  [/path-light/, "low-bollard"],
  [/skylight/, "glazed-ceiling-panel"],
  [/task-light/, "focused-luminaire"],
  [/column-fan/, "tower-fan"],
  [/exhaust/, "boxed-extractor"],
  [/ceiling-fan/, "suspended-rotor"],
  [/wall-circulation/, "caged-wall-rotor"],
  [/fan/, "caged-floor-rotor"],
  [/trellis/, "climbing-trellis"],
  [/hanging/, "hanging-basket"],
  [/trough|border-bed/, "linear-planter"],
  [/planter|garden-pot/, "floor-planter"],
  [/directory|preview-board|identity-sign/, "information-board"],
  [/sign|marker/, "wayfinding-sign"],
  [/queue-rail/, "post-and-belt"],
  [/wind-screen/, "transparent-screen"],
  [/half-wall/, "solid-half-wall"],
  [/divider|screen/, "freestanding-screen"],
  [/sink|basin/, "wash-basin"],
  [/fountain/, "drinking-fountain"],
  [/cupboard|cabinet/, "wall-cabinet"],
  [/utility-point/, "protected-service-box"],
  [/mural/, "wall-mural"],
  [/noticeboard/, "pin-board"],
  [/bunting/, "hanging-bunting"],
  [/flower-vase/, "tabletop-vase"],
  [/clock/, "feature-clock"],
];

function placeableForm(motif: string, category: PlaceableCategory): string {
  return PLACEABLE_FORM_RULES.find(([pattern]) => pattern.test(motif))?.[1] ?? `${category}-form`;
}

function placeableMaterial(
  motif: string,
  category: PlaceableCategory,
  tags: readonly string[],
): PlaceableMaterial {
  const context = `${motif} ${tags.join(" ")}`;
  if (category === "plant") return "living-foliage";
  if (/terrazzo/.test(context)) return "terrazzo";
  if (/laminate/.test(context)) return "laminate";
  if (/clear|glass|skylight|display-case/.test(context)) return "glass";
  if (/tile|mural/.test(context)) return "ceramic";
  if (/woven|lantern/.test(context)) return "woven-fibre";
  if (/fabric|bunting/.test(context)) return "fabric";
  if (/acoustic|cushion|upholster/.test(context)) return "upholstery";
  if (/moulded|stacking|booster/.test(context)) return "moulded-plastic";
  if (/timber|trestle|communal|bench|noticeboard/.test(context)) return "timber";
  if (/concrete|masonry/.test(context)) return "masonry";
  if (category === "stall-fixture" || category === "tray-waste" || category === "facility") {
    return "stainless-steel";
  }
  if (category === "fan" || category === "lighting" || category === "seat") {
    return "powder-coated-metal";
  }
  if (category === "signage" || category === "decor") return "painted-board";
  if (category === "table" || category === "divider") return "timber";
  return "composite";
}

function placeableDetailCues(motif: string, tags: readonly string[]): readonly string[] {
  const motifCues = motif
    .split("-")
    .filter((word) => word.length > 3 && !GENERIC_PLACEABLE_WORDS.has(word));
  return [...new Set([...tags, ...motifCues])].slice(0, 5);
}

/**
 * Derives the deterministic visual recipe of a placeable from its ID, category and tags.
 *
 * @param id - Content ID of the placeable; a leading `item.` is dropped from the motif.
 * @param category - Content category, which picks the fallback form and material.
 * @param tags - Content tags, used as material hints and detail cues.
 * @returns The recipe, with a contract key that is unique per launch placeable.
 */
export function visualRecipeForPlaceable(
  id: string,
  category: PlaceableCategory,
  tags: readonly string[] = [],
): PlaceableVisualRecipe {
  const seed = stableVisualHash(`${category}:${id}`);
  const motif = id.replace(/^item\./, "");
  const form = placeableForm(motif, category);
  const material = placeableMaterial(motif, category, tags);
  const detailCues = placeableDetailCues(motif, tags);
  const semanticKey = `${category}:${form}:${material}:${detailCues.join("+")}`;
  const silhouetteVariant = seed % 7;
  const detailVariant = Math.floor(seed / 7) % 9;
  const makerMark = Math.floor(seed / 63) & 0x7f;
  const accent = ACCENTS[Math.floor(seed / 8_001) % ACCENTS.length] as number;
  return {
    id,
    category,
    motif,
    form,
    material,
    detailCues,
    semanticKey,
    seed,
    silhouetteVariant,
    detailVariant,
    accent,
    makerMark,
    contractKey: `${semanticKey}:${silhouetteVariant}:${detailVariant}:${makerMark}:${accent.toString(16)}`,
  };
}
