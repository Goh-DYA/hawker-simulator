/**
 * Painted thumbnails for the HUD: what to ask the runtime to paint, and how to show it.
 *
 * The runtime controller paints a buildable definition or a dish serving with the world's own
 * painters and returns a PNG data URL (`renderPreview` and `renderDishPreview`); the UI never
 * imports render or art code. `collect_preview_requests` lists the thumbnails the open panel
 * shows, `preview_key` names each one in the cache that `usePaintedPreviews` (in `hooks.ts`)
 * fills, and `PaintedPreview` renders a painted data URL as a decorative image. A surface
 * keeps its former glyph or CSS preview while its thumbnail is not painted yet.
 */
import { DISHES, STALLS, type PlaceableDefinition } from "@/src/content";
import type { RuntimeNutritionFamilySummary } from "@/src/game/runtime/types";
import type { Panel } from "./display";

/** A thumbnail the runtime paints: a placeable or stall definition, or a dish in one variant. */
export type PreviewRequest =
  | { readonly kind: "definition"; readonly id: string }
  | { readonly kind: "dish"; readonly id: string; readonly variantId?: string };

/**
 * Painted thumbnails as PNG data URLs, keyed by {@link preview_key}. An empty string marks a
 * thumbnail that could not be painted, which keeps its fallback.
 */
export type PreviewUrls = Readonly<Record<string, string>>;

/** The empty thumbnail cache. */
export const NO_PREVIEWS: PreviewUrls = Object.freeze({});

/** What the open panel shows, which decides the thumbnails worth painting. */
export interface PreviewView {
  /** The open management panel. */
  readonly panel: Panel;
  /** The placeables the Build catalogue shows after its search and category filter. */
  readonly visiblePlaceables: readonly PlaceableDefinition[];
  /** The stall whose menu the Dishes panel shows. */
  readonly menuStallId: string;
  /** The dish variant families, whose active variants the Dishes panel shows. */
  readonly nutritionFamilies: readonly RuntimeNutritionFamilySummary[];
  /** The family open in the Variant Lab, if any. */
  readonly variantLabFamily: RuntimeNutritionFamilySummary | undefined;
  /** The build item the selection card describes, if any. */
  readonly selectedId: string | undefined;
}

/**
 * Name a thumbnail in the cache.
 *
 * Content IDs are namespaced (`item.`, `stall.`, `dish.`), so a definition is keyed by its ID
 * and a dish by its ID plus the variant it is painted in.
 *
 * @param request - The thumbnail.
 * @returns Its cache key.
 */
export function preview_key(request: PreviewRequest): string {
  if (request.kind === "dish" && request.variantId) return `${request.id}@${request.variantId}`;
  return request.id;
}

/**
 * List the thumbnails the open panel, the Variant Lab and the selection card show.
 *
 * Only what is on screen is requested, so opening the Build catalogue paints its cards and the
 * Dishes panel paints one stall's menu in the variants it serves.
 *
 * @param view - The open panel and the content it shows.
 * @returns The thumbnail requests, without duplicates, in display order.
 */
export function collect_preview_requests(view: PreviewView): PreviewRequest[] {
  const requests: PreviewRequest[] = [];
  if (view.panel === "build") {
    for (const item of view.visiblePlaceables) requests.push({ kind: "definition", id: item.id });
  } else if (view.panel === "stalls") {
    for (const stall of STALLS) requests.push({ kind: "definition", id: stall.id });
  } else if (view.panel === "dishes") {
    for (const dish of DISHES) {
      if (!dish.stallIds.includes(view.menuStallId)) continue;
      const family = view.nutritionFamilies.find((candidate) => candidate.dishId === dish.id);
      const active = family?.variants.find((variant) => variant.id === family.activeVariantId);
      requests.push({ kind: "dish", id: dish.id, variantId: active?.id });
    }
  }
  const lab_family = view.variantLabFamily;
  if (lab_family) {
    for (const variant of lab_family.variants) {
      requests.push({ kind: "dish", id: lab_family.dishId, variantId: variant.id });
    }
  }
  if (view.selectedId) requests.push({ kind: "definition", id: view.selectedId });
  const seen = new Set<string>();
  return requests.filter((request) => {
    const key = preview_key(request);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The props of {@link PaintedPreview}. */
export interface PaintedPreviewProps {
  /** The painted PNG data URL. */
  readonly src: string;
}

/**
 * Render a painted thumbnail as a decorative image; the surrounding control carries the name.
 *
 * @param props - See {@link PaintedPreviewProps}.
 * @returns The image.
 */
export function PaintedPreview({ src }: PaintedPreviewProps) {
  return (
    // A painted data URL is already sized for the HUD, so next/image would only add a wrapper.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="painted-preview" src={src} alt="" draggable={false} decoding="async" />
  );
}
