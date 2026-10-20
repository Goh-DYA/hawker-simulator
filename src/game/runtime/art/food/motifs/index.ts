/**
 * The dish motif registry: every launch dish's motif keyed by its ID without the `dish.`
 * prefix, the default variant key whose layer completes a variant family's dish when no
 * variant is active, and a generic motif per portion shape for dishes the registry does not
 * know.
 */
import type { DishPortionShape } from "../../../visuals/dish";
import { at, heap_scale, pieces_left, type Motif, type MotifPaint } from "../motif";
import {
  paint_ball,
  paint_bun,
  paint_chunk,
  paint_dumpling,
  paint_flatbread_round,
  paint_liquid,
  paint_noodles,
  paint_rice_mound,
  paint_skewer,
  paint_slice,
  RICE,
} from "../parts";
import { paint_ice_mound, paint_scallions } from "../toppings";
import { BRAISE_MOTIFS } from "./braises";
import { GRIDDLE_MOTIFS } from "./griddle";
import { GRILL_MOTIFS } from "./grill";
import { NOODLE_MOTIFS } from "./noodles";
import { RICE_MOTIFS } from "./rice";
import { SOUP_MOTIFS } from "./soups";
import { SWEET_MOTIFS } from "./sweets";

/** Every launch dish's motif, keyed by dish ID without the `dish.` prefix. */
export const DISH_MOTIFS: Readonly<Record<string, Motif>> = {
  ...RICE_MOTIFS,
  ...NOODLE_MOTIFS,
  ...SOUP_MOTIFS,
  ...SWEET_MOTIFS,
  ...GRIDDLE_MOTIFS,
  ...GRILL_MOTIFS,
  ...BRAISE_MOTIFS,
};

/**
 * The visual key of each variant family's default variant, keyed by dish ID without the
 * `dish.` prefix. A dish with a variant family paints this layer when no variant is active, so
 * its plain look is its default serving.
 */
export const DEFAULT_LAYER_KEYS: Readonly<Record<string, string>> = {
  kopi: "kopi-milk-sugar-standard",
  "teh-tarik": "teh-pulled-foam",
  "nasi-lemak": "nasi-wing",
  "fried-carrot-cake": "carrot-cake-black-sauce",
  "roti-prata": "prata-two-curry",
  "sliced-fish-soup": "fish-fried-beehoon-clear",
  "bak-chor-mee": "bak-chor-dry-sauce",
  "chicken-murtabak": "murtabak-chicken",
  "nasi-briyani": "briyani-chicken",
  "masala-thosai": "thosai-plain-roll",
  "yong-tau-foo": "ytf-clear-noodles",
  "ban-mian": "ban-mian-soup-bowl",
  "bak-kut-teh": "bak-kut-teh-rice-youtiao",
  "duck-rice": "duck-rice-braised-egg-tofu",
  "prawn-noodle-soup": "prawn-mee-soup",
  "economic-rice": "eco-rice-veg-meat",
  "nasi-padang": "padang-beef-rendang",
  "mee-siam": "mee-siam-gravy",
  "wanton-mee": "wanton-mee-dry",
  "soya-bean-milk": "soy-milk-sweet",
  "chicken-chop": "western-chop-fries-coleslaw",
  "fish-and-chips": "western-fish-chips",
  "fish-porridge": "porridge-fish-fried",
};

/**
 * Paints a generic serving in a portion shape, coloured by the dish's portion colour, for a
 * dish without its own motif.
 *
 * @param p - The motif paint.
 * @param shape - The recipe's portion shape.
 */
function paint_generic(p: MotifPaint, shape: DishPortionShape): void {
  const { ctx, area, seed, isLowDetail, portion } = p;
  const size = heap_scale(p.remaining);
  const [x, y] = at(area, 0, 0);
  switch (shape) {
    case "rice-mound":
      paint_rice_mound(
        ctx,
        x - 3,
        y,
        area.rx * 0.55 * size,
        area.ry * 0.7 * size,
        RICE,
        seed,
        isLowDetail,
      );
      paint_chunk(ctx, x + 5, y - 1, 5 * size, portion, 0.3, { gloss: 0.4 });
      break;
    case "noodle-tangle":
      paint_noodles(ctx, x, y, area.rx * 0.85 * size, portion, seed, 1.6, isLowDetail);
      break;
    case "broth":
    case "liquid":
    case "porridge":
    case "pudding":
      paint_liquid(ctx, x, y, area.rx, area.ry, portion, { sheen: 0.3 });
      if (shape === "broth") paint_ball(ctx, x + 2, y - 1, 2.4 * size, 0xf2e8d6);
      break;
    case "shaved-ice":
      paint_ice_mound(
        ctx,
        x,
        y + area.ry * 0.4,
        area.rx * 0.8 * size,
        12 * size,
        seed,
        isLowDetail,
      );
      break;
    case "flatbread":
      paint_flatbread_round(ctx, x, y, area.rx * 0.6 * size, portion, seed, true);
      break;
    case "skewers":
      for (let skewer = 0; skewer < pieces_left(4, p.remaining); skewer += 1) {
        const [x0, y0] = at(area, -0.9, -0.5 + skewer * 0.32);
        const [x1, y1] = at(area, 0.6, -0.6 + skewer * 0.32);
        paint_skewer(ctx, x0, y0, x1, y1, portion, 4, false);
      }
      break;
    case "dumplings":
    case "fritters":
      for (let piece = 0; piece < pieces_left(3, p.remaining); piece += 1) {
        const [dx, dy] = at(area, -0.45 + piece * 0.45, (piece % 2) * 0.3 - 0.1);
        paint_dumpling(ctx, dx, dy, 3.6, portion, { pleats: 3 });
      }
      break;
    case "buns":
      for (let piece = 0; piece < pieces_left(3, p.remaining); piece += 1) {
        const [bx, by] = at(area, -0.45 + piece * 0.45, (piece % 2) * 0.3 - 0.1);
        paint_bun(ctx, bx, by, 4.4, portion);
      }
      break;
    default:
      for (let piece = 0; piece < pieces_left(4, p.remaining); piece += 1) {
        const [cx, cy] = at(area, -0.4 + piece * 0.28, (piece % 2) * 0.4 - 0.2);
        paint_slice(ctx, cx, cy, 6.4, 4, 0.3 * piece, portion, { gloss: 0.4 });
      }
  }
  paint_scallions(ctx, x, y, area.rx * 0.4, isLowDetail ? 2 : 4, seed ^ 0x99);
}

/**
 * Resolves the motif that paints a dish.
 *
 * @param dishKey - The dish ID without the `dish.` prefix.
 * @param shape - The recipe's portion shape, for the generic fallback.
 * @returns The dish's own motif, or a generic motif for its portion shape.
 */
export function motif_for(dishKey: string, shape: DishPortionShape): Motif {
  const own = Object.hasOwn(DISH_MOTIFS, dishKey) ? DISH_MOTIFS[dishKey] : undefined;
  return own ?? ((p: MotifPaint) => paint_generic(p, shape));
}
