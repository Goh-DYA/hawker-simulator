/**
 * Plant painters: the glazed herb trough on its stand, the tall areca palm, the fern trough, the
 * vine trellis with bougainvillea, the rain-garden bowl, the hanging pothos basket, the dwarf
 * banana and the pandan border bed.
 *
 * Everything is drawn in the 3/4 oblique view from the south, lit from the north-west: pots
 * and troughs show their rim and soil from above and their front face below it, and the
 * foliage rises from the soil as seen from the side, the tall palms and the banana reaching up
 * into the overhang above the footprint. Floor plants get a soft contact shadow; the hanging
 * basket sits high on its cords with only a faint shadow far below; the herb trough, which
 * guests walk through and which sorts with them, stands small in a north corner of its tile,
 * clear of the tile centre. The troughs, the bed and the trellis follow their footprint's long
 * side, and the trellis keeps its lattice on the back edge of its planter as it turns. The
 * construction is chosen through the ID-keyed style tables in `render/art.ts`.
 */
import type { Rotation } from "@/src/game/core";

import { resolve_placeable_style, type PlantStyle } from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_rounded_rect,
  line,
  linear_gradient,
  mix,
  seeded,
  shade,
  SHADOW_INK,
  speckle,
  stroke_ellipse,
  stroke_rounded_rect,
  TAU,
  tint,
  wood_grain,
  type PaintContext,
} from "../canvas";
import { OVERHANG, type PaintFrame } from "../specs";
import {
  ceiling_cord,
  clip_texture,
  FITTING_STEEL,
  floor_shadow,
  ink_current_path,
  INK,
  outline_style,
  resolve_linear_rotation,
  standing_height,
  stroke_outline,
} from "./ambience";
import {
  GREENS,
  LEAF_FRESH,
  LEAF_MID,
  paint_arching_frond,
  paint_heart_leaf,
  paint_leaf_cluster,
  paint_paddle_leaf,
  paint_strap_leaf,
  paint_vine,
  type Curve,
  type Point,
} from "./foliage";
import { type Box, LEAF_DARK, LEAF_LIGHT, SOIL, TERRACOTTA, TIMBER } from "./shared";

/** How round a pot rim looks from the camera: its vertical radius over its horizontal one. */
const POT_RIM = 0.42;
/** Glazed teal of ceramic pots and boxes. */
const GLAZED_TEAL = 0x2f8b88;
/** Water in the rain-garden bowl. */
const WATER = 0x4e9fa8;
/** Bougainvillea bracts, magenta and a paler pink. */
const BRACTS = [0xd94f7a, 0xe878a0, 0xc23f6c] as const;
/** Concrete of the raised bed and its coping, the floor's grout tone. */
const CONCRETE = 0xcdbb9c;
/** Coir of the hanging basket. */
const COIR = 0xa87a4e;
/** The yellow-green of areca fronds, darkest to lightest. */
const ARECA_GREENS = [0x557f3b, 0x6f9c46, 0x8db85a] as const;
/** The golden cane of an areca stem. */
const ARECA_CANE = 0xa3a65a;
/** The bright greens of pandan, darkest to lightest. */
const PANDAN_GREENS = [0x3f7a33, 0x569a3d, 0x73b24c] as const;
/** The terrazzo chips of the bed coping. */
const TERRAZZO_CHIPS = [0xd9c7a8, 0xb9a58a, 0xe9decb] as const;
/** Width of the herb planter's trough (about 0.4 m). */
const HERB_TROUGH_WIDTH = 18;
/** Depth of the herb trough's top seen from above. */
const HERB_TROUGH_DEPTH = 6;
/** Height of the herb trough's front face. */
const HERB_TROUGH_FACE = 5;
/** Height of the herb planter's slim stand (0.4 m). */
const HERB_STAND_METRES = 0.4;
/** How far below the tile's north edge the stand's front feet stand. */
const HERB_STAND_FLOOR = 18;
/** Gap between the herb planter and the side edge of its tile. */
const HERB_CORNER_INSET = 3;

type PlantPainter = (
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  rotation: Rotation,
) => void;

/** What a round pot is made of and how it is shaped. */
interface PotOptions {
  readonly colour: number;
  /** Bottom radius as a fraction of the rim radius. */
  readonly taper: number;
  /** What fills the pot: soil, or water for the rain garden. */
  readonly inner: number;
  /** A glossy glaze streak instead of matt terracotta. */
  readonly is_glazed: boolean;
}

/**
 * Paints a round pot in 3/4 view: the tapered body below a thick rolled rim, and the soil (or
 * water) inside the rim seen from above with its back edge in shadow.
 *
 * @param ctx - The paint context.
 * @param cx - Rim centre x.
 * @param rim_y - Rim centre y.
 * @param rx - Rim horizontal radius.
 * @param depth - Height of the body below the rim.
 * @param options - Material and shape.
 * @param frame - The paint frame.
 */
function paint_round_pot(
  ctx: PaintContext,
  cx: number,
  rim_y: number,
  rx: number,
  depth: number,
  options: PotOptions,
  frame: PaintFrame,
): void {
  const { colour } = options;
  const ry = rx * POT_RIM;
  const base_rx = rx * options.taper;
  const trace_body = () => {
    ctx.beginPath();
    ctx.moveTo(cx - rx, rim_y);
    ctx.lineTo(cx - base_rx, rim_y + depth);
    ctx.ellipse(cx, rim_y + depth, base_rx, base_rx * POT_RIM, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, rim_y);
    ctx.ellipse(cx, rim_y, rx, ry, 0, 0, Math.PI);
    ctx.closePath();
  };
  trace_body();
  ctx.fillStyle = linear_gradient(ctx, cx - rx, 0, cx + rx, 0, [
    [0, tint(colour, 0.22)],
    [0.35, colour],
    [1, shade(colour, 0.42)],
  ]);
  ctx.fill();
  if (options.is_glazed) {
    line(
      ctx,
      cx - rx * 0.6,
      rim_y + ry + 2,
      cx - base_rx * 0.65,
      rim_y + depth,
      css(0xffffff, 0.35),
      1.6,
    );
  }
  fill_ellipse(
    ctx,
    cx,
    rim_y + depth + base_rx * POT_RIM * 0.4,
    base_rx * 0.9,
    1.4,
    css(SHADOW_INK, 0.2),
  );
  trace_body();
  stroke_outline(ctx, colour, frame);
  // The rolled rim and what is inside it.
  fill_ellipse(ctx, cx, rim_y, rx + 1, ry + 1, css(tint(colour, 0.18)));
  stroke_ellipse(ctx, cx, rim_y + 0.6, rx + 0.6, ry + 0.6, css(shade(colour, 0.3), 0.6), 0.8);
  const wall = Math.max(1.6, rx * 0.12);
  fill_ellipse(
    ctx,
    cx,
    rim_y + 0.3,
    rx - wall,
    ry - wall * 0.5,
    linear_gradient(ctx, 0, rim_y - ry, 0, rim_y + ry, [
      [0, shade(options.inner, 0.45)],
      [0.55, options.inner],
      [1, tint(options.inner, 0.12)],
    ]),
  );
  const edge = outline_style(colour, frame);
  stroke_ellipse(ctx, cx, rim_y, rx + 1, ry + 1, edge.colour, edge.width);
}

/** What a rectangular planter is made of. */
type PlanterFinish = "glazed" | "timber" | "concrete";

/**
 * Paints a rectangular planter in 3/4 view: its coping and soil seen from above, and its front
 * face below, finished as glazed ceramic, timber slats or speckled concrete.
 *
 * @param ctx - The paint context.
 * @param rect - The coping's top-left, width and depth, and the front face's height.
 * @param colour - The material colour.
 * @param finish - The finish.
 * @param seed - Seed for grain or speckle.
 * @param frame - The paint frame.
 */
function paint_planter_box(
  ctx: PaintContext,
  rect: { x: number; y: number; width: number; depth: number; face: number },
  colour: number,
  finish: PlanterFinish,
  seed: number,
  frame: PaintFrame,
): void {
  const { x, y, width, depth, face } = rect;
  const face_y = y + depth;
  fill_rounded_rect(
    ctx,
    x,
    face_y - 2,
    width,
    face + 2,
    2,
    linear_gradient(ctx, x, 0, x + width, 0, [
      [0, shade(colour, 0.12)],
      [1, shade(colour, 0.36)],
    ]),
  );
  if (!frame.isLowDetail) {
    if (finish === "timber") {
      const planks = Math.max(2, Math.round(face / 4));
      for (let plank = 1; plank < planks; plank += 1) {
        const plank_y = face_y + (face * plank) / planks;
        line(
          ctx,
          x + 1,
          plank_y,
          x + width - 1,
          plank_y,
          css(shade(colour, 0.5), 0.6),
          0.7,
          "butt",
        );
      }
      wood_grain(ctx, x, face_y, width, face, shade(colour, 0.15), seed);
    } else if (finish === "concrete") {
      speckle(
        ctx,
        x + 1,
        face_y,
        width - 2,
        face - 1,
        Math.round(width / 5),
        TERRAZZO_CHIPS,
        seed,
        1,
      );
    } else {
      line(ctx, x + 3, face_y + 2, x + width * 0.4, face_y + 2, css(0xffffff, 0.35), 1.2);
    }
  }
  // The coping, then the soil inside it.
  fill_rounded_rect(
    ctx,
    x,
    y,
    width,
    depth,
    2,
    linear_gradient(ctx, x, y, x + width * 0.3, y + depth, [
      [0, tint(colour, 0.25)],
      [1, tint(colour, 0.05)],
    ]),
  );
  if (finish === "concrete" && !frame.isLowDetail) {
    speckle(
      ctx,
      x + 1,
      y + 1,
      width - 2,
      depth - 2,
      Math.round((width * depth) / 60),
      TERRAZZO_CHIPS,
      seed + 1,
      0.9,
    );
  }
  const wall = 2.5;
  // The soil, in shadow under the back wall and lighter towards the front lip.
  fill_rounded_rect(
    ctx,
    x + wall,
    y + wall * 0.8,
    width - wall * 2,
    depth - wall * 1.6,
    1.5,
    linear_gradient(ctx, 0, y, 0, y + Math.min(depth, 9), [
      [0, shade(SOIL, 0.45)],
      [1, tint(SOIL, 0.06)],
    ]),
  );
  if (!frame.isLowDetail && depth > 12) {
    speckle(
      ctx,
      x + wall + 1,
      y + 4,
      width - wall * 2 - 2,
      depth - 7,
      Math.round((width * depth) / 90),
      [tint(SOIL, 0.25), shade(SOIL, 0.3)],
      seed + 2,
      1,
    );
  }
  const edge = outline_style(colour, frame);
  stroke_rounded_rect(ctx, x, y, width, depth + face, 2, edge.colour, edge.width);
}

/**
 * Paints a clump of strap leaves fanning up from one base (pandan, chives).
 *
 * @param ctx - The paint context.
 * @param base - Where the clump leaves the soil.
 * @param options - Leaf count, length and width, the greens, the seed and the frame.
 */
function paint_strap_clump(
  ctx: PaintContext,
  base: Point,
  options: {
    count: number;
    length: number;
    width: number;
    greens: readonly number[];
    seed: number;
    frame: PaintFrame;
    spread?: number;
  },
): void {
  const next = seeded(options.seed);
  const count = options.frame.isLowDetail ? Math.ceil(options.count * 0.7) : options.count;
  const spread = options.spread ?? 1;
  const leaves = Array.from({ length: count }, (_, index) => {
    const fraction = count === 1 ? 0.5 : index / (count - 1);
    const angle = -Math.PI / 2 + (fraction - 0.5) * 2.6 * spread + (next() - 0.5) * 0.25;
    const length = options.length * (0.7 + next() * 0.35);
    return { angle, length, index };
  });
  // Upright leaves are behind; the ones leaning out towards the sides come in front.
  leaves.sort(
    (a, b) => Math.abs(Math.cos(a.angle)) - Math.abs(Math.cos(b.angle)) || a.index - b.index,
  );
  for (const leaf of leaves) {
    const dx = Math.cos(leaf.angle);
    const dy = Math.sin(leaf.angle);
    const lean = Math.abs(dx);
    const curve: Curve = {
      from: [base[0] + dx * 1.5, base[1]],
      control: [base[0] + dx * leaf.length * 0.5, base[1] + dy * leaf.length * 1.0],
      to: [base[0] + dx * leaf.length * 0.95, base[1] + dy * leaf.length * (0.9 - lean * 0.55)],
    };
    const shade_index = Math.round((1 - lean) * (options.greens.length - 1) * (dx < 0 ? 1 : 0.5));
    const colour = options.greens[Math.min(options.greens.length - 1, shade_index)] ?? LEAF_MID;
    paint_strap_leaf(ctx, curve, options.width, colour, options.frame);
  }
}

/** Where the herb planter's stand and trough sit in their tile. */
export interface HerbPlanterLayout {
  /** Left edge of the trough and of the stand's shelf. */
  readonly x: number;
  /** Width of the trough and the shelf. */
  readonly width: number;
  /** Where the stand's front feet meet the floor. */
  readonly floor_y: number;
  /** The front edge of the stand's shelf, where the trough's front face ends. */
  readonly shelf_y: number;
  /** The top of the trough's rim. */
  readonly rim_y: number;
}

/**
 * Lays out the herb planter. Guests walk through its tile and it sorts with them, so it is a
 * small trough on a slim stand tucked into a north corner, clear of the tile centre where they
 * cross: the north-west corner, or the north-east one when it is turned a quarter.
 *
 * @param box - The footprint box.
 * @param rotation - The placement rotation.
 * @returns The layout.
 */
export function herb_planter_layout(box: Box, rotation: Rotation): HerbPlanterLayout {
  const width = HERB_TROUGH_WIDTH;
  const is_east = rotation === 90 || rotation === 270;
  const x = is_east ? box.right - HERB_CORNER_INSET - width : box.x + HERB_CORNER_INSET;
  const floor_y = box.y + HERB_STAND_FLOOR;
  const shelf_y = floor_y - standing_height(HERB_STAND_METRES);
  return { x, width, floor_y, shelf_y, rim_y: shelf_y - HERB_TROUGH_FACE - HERB_TROUGH_DEPTH };
}

/**
 * Paints the herb planter's slim steel stand: two back legs showing under the shelf, two front
 * legs with a low crossbar, and the shelf's thin front edge, inked in high contrast.
 *
 * @param ctx - The paint context.
 * @param layout - The planter layout.
 * @param frame - The paint frame.
 */
function paint_herb_stand(ctx: PaintContext, layout: HerbPlanterLayout, frame: PaintFrame): void {
  const { x, width, floor_y, shelf_y } = layout;
  const back_y = floor_y - HERB_TROUGH_DEPTH;
  const steel = css(frame.isHighContrast ? INK : FITTING_STEEL);
  for (const leg_x of [x + 3, x + width - 3]) {
    line(ctx, leg_x, shelf_y - 1, leg_x, back_y, css(shade(FITTING_STEEL, 0.35)), 1.1, "butt");
  }
  line(ctx, x + 2, floor_y - 3.5, x + width - 2, floor_y - 3.5, steel, 1, "butt");
  for (const leg_x of [x + 1.5, x + width - 1.5]) {
    line(ctx, leg_x, shelf_y, leg_x, floor_y, steel, 1.5, "butt");
    line(ctx, leg_x - 0.4, shelf_y + 1, leg_x - 0.4, floor_y - 1, css(0xffffff, 0.25), 0.5);
    fill_ellipse(ctx, leg_x, floor_y, 1.4, 0.7, css(shade(FITTING_STEEL, 0.4)));
  }
  fill_rounded_rect(ctx, x - 0.5, shelf_y - 1, width + 1, 2, 0.8, steel);
  line(ctx, x + 1, shelf_y - 0.6, x + width - 1, shelf_y - 0.6, css(0xffffff, 0.3), 0.5);
}

/**
 * Paints the table herb planter, also the fallback for unlisted plant IDs: a small glazed
 * teal trough on a slim steel stand in a north corner of its tile, with chives at the back,
 * round-leaf basil and a chilli plant hung with red pods.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose seed scatters the leaves.
 * @param rotation - The placement rotation, which picks the corner.
 */
function paint_herb_planter(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  rotation: Rotation,
): void {
  const layout = herb_planter_layout(box, rotation);
  const { x, width, floor_y, rim_y } = layout;
  const cx = x + width / 2;
  const top_y = rim_y + 1;
  floor_shadow(ctx, cx + 3, floor_y - 2, width * 0.6, 3.2, 0.22);
  paint_herb_stand(ctx, layout, frame);
  const rect = { x, y: rim_y, width, depth: HERB_TROUGH_DEPTH, face: HERB_TROUGH_FACE };
  paint_planter_box(ctx, rect, GLAZED_TEAL, "glazed", recipe.seed, frame);
  paint_strap_clump(ctx, [cx + 1.5, top_y + 2], {
    count: 7,
    length: 10,
    width: 1.3,
    greens: [LEAF_DARK, LEAF_MID, LEAF_FRESH],
    seed: recipe.seed,
    frame,
    spread: 0.45,
  });
  paint_leaf_cluster(ctx, cx - 4.5, top_y - 0.5, {
    count: 9,
    leaf: 2.6,
    spread_x: 4,
    spread_y: 3,
    seed: recipe.seed + 1,
    frame,
  });
  paint_leaf_cluster(ctx, cx + 5, top_y - 1, {
    count: 7,
    leaf: 2,
    spread_x: 3,
    spread_y: 2.6,
    seed: recipe.seed + 2,
    frame,
  });
  for (const [pod_x, pod_y, tilt] of [
    [cx + 3.5, top_y, 0.3],
    [cx + 6.5, top_y - 1.5, -0.2],
    [cx + 5.5, top_y + 1.5, 0.1],
  ] as const) {
    ctx.save();
    ctx.translate(pod_x, pod_y);
    ctx.rotate(Math.PI / 2 + tilt);
    fill_ellipse(ctx, 1.4, 0, 2.1, 0.8, css(0xd8382c));
    fill_ellipse(ctx, 1, -0.25, 1, 0.3, css(0xffffff, 0.5));
    ctx.restore();
  }
}

/**
 * Paints the tall areca palm: a terracotta pot with three golden canes rising into the
 * overhang, each crowned with arching yellow-green fronds whose leaflets hang down.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose seed varies the fronds and whose accent warms the pot.
 */
function paint_areca(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const next = seeded(recipe.seed);
  const cx = box.centreX;
  const rim_y = box.bottom - 19;
  const rx = 10.5;
  const top_limit = box.y - OVERHANG + 2;
  floor_shadow(ctx, cx + 4, rim_y + 13, 13, 4.2, 0.26);
  paint_round_pot(
    ctx,
    cx,
    rim_y,
    rx,
    12,
    { colour: mix(TERRACOTTA, recipe.accent, 0.25), taper: 0.74, inner: SOIL, is_glazed: false },
    frame,
  );
  const canes: readonly { base: Point; top: Point; tone: number }[] = [
    { base: [cx + 1, rim_y], top: [cx + 2, box.y - 8], tone: 0 },
    { base: [cx - 2, rim_y], top: [cx - 8, box.y + 1], tone: 1 },
    { base: [cx + 2.5, rim_y], top: [cx + 9, box.y + 6], tone: 2 },
  ];
  for (const cane of canes) {
    const curve: Curve = {
      from: cane.base,
      control: [(cane.base[0] + cane.top[0]) / 2 + 1, (cane.base[1] + cane.top[1]) / 2],
      to: cane.top,
    };
    const fronds: readonly (readonly [number, number, number, number])[] = [
      [-11, -9, -19, 7],
      [11, -9, 19, 7],
      [-4, -10, -12, -4],
      [5, -10, 12, -3],
    ];
    for (const [control_x, control_y, tip_x, tip_y] of fronds) {
      const jitter = (next() - 0.5) * 3;
      paint_arching_frond(
        ctx,
        {
          from: cane.top,
          control: [cane.top[0] + control_x + jitter, Math.max(top_limit, cane.top[1] + control_y)],
          to: [
            Math.max(box.x + 2, Math.min(box.right - 2, cane.top[0] + tip_x + jitter)),
            Math.max(top_limit, cane.top[1] + tip_y),
          ],
        },
        {
          colour: ARECA_GREENS[(cane.tone + (tip_y > 0 ? 0 : 1)) % ARECA_GREENS.length] ?? LEAF_MID,
          leaflet: 8,
          pairs: 8,
          droop: 0.55,
          frame,
        },
      );
    }
    ctx.beginPath();
    ctx.moveTo(curve.from[0], curve.from[1]);
    ctx.quadraticCurveTo(curve.control[0], curve.control[1], curve.to[0], curve.to[1]);
    ctx.strokeStyle = css(ARECA_CANE);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    if (!frame.isLowDetail) {
      for (let node = 1; node < 5; node += 1) {
        const t = node / 5;
        const node_x =
          (1 - t) * (1 - t) * curve.from[0] +
          2 * (1 - t) * t * curve.control[0] +
          t * t * curve.to[0];
        const node_y =
          (1 - t) * (1 - t) * curve.from[1] +
          2 * (1 - t) * t * curve.control[1] +
          t * t * curve.to[1];
        line(ctx, node_x - 1.2, node_y, node_x + 1.2, node_y, css(shade(ARECA_CANE, 0.35)), 0.7);
      }
    }
  }
}

/**
 * Paints one fern crown: arching fronds radiating from the soil, the upright ones behind and
 * the ones spilling forward over the planter's lip in front.
 *
 * @param ctx - The paint context.
 * @param base - The crown's centre on the soil.
 * @param length - The longest frond.
 * @param seed - Seed for the frond jitter.
 * @param frame - The paint frame.
 */
function paint_fern_crown(
  ctx: PaintContext,
  base: Point,
  length: number,
  seed: number,
  frame: PaintFrame,
): void {
  const next = seeded(seed);
  // Back fronds first (pointing up and away), the forward fronds spilling over the lip last.
  const angles = [
    -1.6, -1.2, -2.0, -0.8, -2.4, -1.45, -1.8, -0.4, -2.75, -0.05, -3.1, 2.4, 0.75, 1.7, 1.2,
  ];
  const count = frame.isLowDetail ? 9 : angles.length;
  for (let index = 0; index < count; index += 1) {
    const angle = (angles[index] ?? 0) + (next() - 0.5) * 0.2;
    const frond_length = length * (0.75 + next() * 0.3);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const is_forward = dy > 0;
    const rise = is_forward ? 0.15 : 0.65 - Math.abs(dx) * 0.3;
    const reach = is_forward ? 0.35 : 0.45;
    paint_arching_frond(
      ctx,
      {
        from: base,
        control: [
          base[0] + dx * frond_length * 0.55,
          base[1] + dy * frond_length * reach - frond_length * rise,
        ],
        to: [
          base[0] + dx * frond_length,
          base[1] + dy * frond_length * reach - frond_length * rise * 0.35,
        ],
      },
      {
        colour: GREENS[is_forward ? 1 : dx < -0.3 ? 3 : 2] ?? LEAF_MID,
        leaflet: 4.6,
        pairs: 9,
        droop: 0.3,
        frame,
        stem_width: 0.8,
      },
    );
  }
}

/**
 * Paints the fern trough: a timber-slatted trough running along its footprint, with fern
 * crowns arching over its lip.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose seed varies the fronds.
 * @param rotation - The placement rotation.
 */
function paint_fern_trough(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  rotation: Rotation,
): void {
  const resolved = resolve_linear_rotation(box, rotation);
  const is_along = resolved === 90 || resolved === 270;
  const rect = is_along
    ? { x: box.centreX - 14, y: box.y + 4, width: 28, depth: box.height - 24, face: 11 }
    : { x: box.x + 6, y: box.y + 18, width: box.width - 12, depth: 10, face: 12 };
  ctx.save();
  ctx.shadowBlur = 6;
  ctx.shadowColor = css(SHADOW_INK, 0.24);
  fill_rounded_rect(
    ctx,
    rect.x + 4,
    rect.y + 6,
    rect.width - 4,
    rect.depth + rect.face - 3,
    4,
    css(SHADOW_INK, 0.2),
  );
  ctx.restore();
  paint_planter_box(ctx, rect, shade(TIMBER, 0.15), "timber", recipe.seed, frame);
  const crowns = Math.max(2, Math.round((is_along ? box.height : box.width) / 36));
  for (let crown = 0; crown < crowns; crown += 1) {
    const fraction = (crown + 0.5) / crowns;
    const base: Point = is_along
      ? [box.centreX, rect.y + 6 + (rect.depth - 10) * fraction]
      : [rect.x + rect.width * fraction, rect.y + rect.depth / 2];
    paint_fern_crown(ctx, base, 22, recipe.seed + crown * 7, frame);
  }
}

/**
 * Paints the trellis lattice face-on: two posts, a top rail and diagonal slats.
 *
 * @param ctx - The paint context.
 * @param left - The left post's x.
 * @param right - The right post's x.
 * @param base_y - Where the posts stand.
 * @param top_y - The top rail's y.
 * @param frame - The paint frame.
 */
function paint_lattice_face(
  ctx: PaintContext,
  left: number,
  right: number,
  base_y: number,
  top_y: number,
  frame: PaintFrame,
): void {
  const slat = css(tint(TIMBER, 0.12));
  const shadow = css(shade(TIMBER, 0.45), 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top_y, right - left, base_y - top_y);
  ctx.clip();
  const pitch = 11;
  const height = base_y - top_y;
  for (let offset = -height; offset < right - left + height; offset += pitch) {
    line(
      ctx,
      left + offset + 0.8,
      top_y + 0.8,
      left + offset + height + 0.8,
      base_y + 0.8,
      shadow,
      1.4,
    );
    line(
      ctx,
      left + offset + height + 0.8,
      top_y + 0.8,
      left + offset + 0.8,
      base_y + 0.8,
      shadow,
      1.4,
    );
    line(ctx, left + offset, top_y, left + offset + height, base_y, slat, 1.4);
    line(ctx, left + offset + height, top_y, left + offset, base_y, slat, 1.4);
  }
  ctx.restore();
  for (const post_x of [left, right]) {
    fill_rounded_rect(
      ctx,
      post_x - 1.6,
      top_y - 2,
      3.2,
      base_y - top_y + 2,
      1,
      css(shade(TIMBER, 0.1)),
    );
    line(ctx, post_x - 0.8, top_y - 1, post_x - 0.8, base_y, css(tint(TIMBER, 0.3)), 0.7);
  }
  fill_rounded_rect(ctx, left - 2, top_y - 3, right - left + 4, 3, 1, css(TIMBER));
  if (frame.isHighContrast)
    stroke_rounded_rect(
      ctx,
      left - 2,
      top_y - 3,
      right - left + 4,
      base_y - top_y + 3,
      1,
      css(INK),
      1.5,
    );
}

/**
 * Paints a spray of bougainvillea bracts: small papery petals in magentas around a point.
 *
 * @param ctx - The paint context.
 * @param x - Spray centre x.
 * @param y - Spray centre y.
 * @param seed - Seed for the petal scatter.
 * @param frame - The paint frame.
 */
function paint_bracts(
  ctx: PaintContext,
  x: number,
  y: number,
  seed: number,
  frame: PaintFrame,
): void {
  const next = seeded(seed);
  const petals = frame.isLowDetail ? 3 : 6;
  for (let petal = 0; petal < petals; petal += 1) {
    const angle = next() * TAU;
    const distance = 1 + next() * 2.6;
    const colour = BRACTS[petal % BRACTS.length] ?? 0xd94f7a;
    ctx.save();
    ctx.translate(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.8);
    ctx.rotate(angle);
    fill_ellipse(ctx, 0, 0, 2.1, 1.5, css(colour));
    fill_ellipse(ctx, -0.5, -0.4, 0.8, 0.5, css(0xffffff, 0.35));
    ctx.restore();
  }
  fill_circle(ctx, x, y, 0.7, css(0xf3e3a0));
}

/**
 * Paints the vine trellis seen face-on (rotations 0 and 180): a timber planter with the lattice
 * standing along its back edge, vines and bougainvillea climbing it; at 180 the lattice stands
 * on the near edge, in front of the climbers.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param seed - The recipe seed.
 * @param is_back - True when the lattice stands on the near (south) edge.
 */
function paint_trellis_across(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  seed: number,
  is_back: boolean,
): void {
  const rect = { x: box.x + 7, y: box.y + 22, width: box.width - 14, depth: 9, face: 10 };
  const left = rect.x + 3;
  const right = rect.x + rect.width - 3;
  const base_y = is_back ? rect.y + rect.depth : rect.y + 2;
  const top_y = base_y - 38;
  floor_shadow(
    ctx,
    box.centreX + 4,
    rect.y + rect.depth + rect.face - 1,
    rect.width * 0.5,
    4,
    0.22,
  );
  paint_planter_box(ctx, rect, shade(TIMBER, 0.3), "timber", seed, frame);
  const vines = 5;
  const climb = () => {
    for (let vine = 0; vine < vines; vine += 1) {
      const start_x = left + 4 + ((right - left - 8) * vine) / (vines - 1);
      const sway = vine % 2 === 0 ? 7 : -7;
      paint_vine(
        ctx,
        [
          [start_x, rect.y + rect.depth / 2],
          [start_x + sway, rect.y - 8],
          [start_x - sway, top_y + 16],
          [start_x + sway * 0.5, top_y + 3],
        ],
        8,
        3.1,
        frame,
      );
    }
  };
  const flowers = () => {
    const next = seeded(seed + 3);
    for (let spray = 0; spray < 7; spray += 1) {
      const spray_x = left + 3 + next() * (right - left - 6);
      const spray_y = top_y + 2 + next() * 18;
      paint_bracts(ctx, spray_x, spray_y, seed + spray, frame);
    }
  };
  if (is_back) {
    climb();
    paint_lattice_face(ctx, left, right, base_y, top_y, frame);
    flowers();
  } else {
    paint_lattice_face(ctx, left, right, base_y, top_y, frame);
    climb();
    flowers();
  }
}

/**
 * Paints the vine trellis seen end-on (rotations 90 and 270): a planter running north to south
 * with the lattice standing along its east or west edge, so the camera sees it nearly edge-on
 * as a slim screen thick with climbers and bracts.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param seed - The recipe seed.
 * @param is_east - True when the lattice stands on the east edge.
 */
function paint_trellis_along(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  seed: number,
  is_east: boolean,
): void {
  const rect = { x: box.centreX - 12, y: box.y + 6, width: 24, depth: box.height - 22, face: 10 };
  floor_shadow(ctx, box.centreX + 4, rect.y + rect.depth / 2 + 6, 14, rect.depth / 2, 0.2);
  paint_planter_box(ctx, rect, shade(TIMBER, 0.3), "timber", seed, frame);
  const lattice_x = is_east ? rect.x + rect.width - 4 : rect.x + 4;
  const north_y = rect.y + 2;
  const south_y = rect.y + rect.depth;
  const rise = 38;
  const next = seeded(seed);
  paint_leaf_cluster(ctx, lattice_x, (north_y + south_y) / 2 - rise / 2, {
    count: 30,
    leaf: 3.4,
    spread_x: 9,
    spread_y: (south_y - north_y) / 2 + 4,
    seed,
    frame,
  });
  fill_rounded_rect(
    ctx,
    lattice_x - 1.6,
    north_y - rise,
    3.2,
    south_y - north_y + rise,
    1,
    css(shade(TIMBER, 0.1)),
  );
  for (let slat = north_y - rise + 6; slat < south_y - 2; slat += 7) {
    line(ctx, lattice_x - 2.5, slat, lattice_x + 2.5, slat + 3, css(tint(TIMBER, 0.15)), 1);
  }
  fill_rounded_rect(
    ctx,
    lattice_x - 2,
    north_y - rise - 2,
    4,
    south_y - north_y + 2,
    1,
    css(TIMBER, 0.85),
  );
  for (let spray = 0; spray < 8; spray += 1) {
    paint_bracts(
      ctx,
      lattice_x + (next() - 0.5) * 14,
      north_y - rise + 6 + next() * (south_y - north_y + rise - 16),
      seed + spray,
      frame,
    );
  }
  paint_leaf_cluster(ctx, lattice_x + (is_east ? -5 : 5), south_y - 8, {
    count: 10,
    leaf: 3,
    spread_x: 6,
    spread_y: 8,
    seed: seed + 9,
    frame,
  });
}

/**
 * Paints the vine trellis: a timber planter with a lattice along its back edge, climbing vines
 * and bougainvillea bracts. The lattice turns with the placement.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose seed scatters the vines and bracts.
 * @param rotation - The placement rotation (0 puts the lattice on the north edge).
 */
function paint_trellis(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  rotation: Rotation,
): void {
  const resolved = resolve_linear_rotation(box, rotation);
  if (resolved === 90 || resolved === 270) {
    paint_trellis_along(ctx, box, frame, recipe.seed, resolved === 90);
  } else {
    paint_trellis_across(ctx, box, frame, recipe.seed, resolved === 180);
  }
}

/**
 * Paints the water surface of the rain-garden bowl: reflections, ripples, lily pads and one
 * open water lily.
 *
 * @param ctx - The paint context.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param rx - Horizontal radius of the water.
 * @param ry - Vertical radius of the water.
 * @param frame - The paint frame.
 */
function paint_pond_surface(
  ctx: PaintContext,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  frame: PaintFrame,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.clip();
  line(ctx, cx - rx * 0.6, cy - ry * 0.2, cx - rx * 0.1, cy - ry * 0.45, css(0xffffff, 0.4), 1.4);
  if (!frame.isLowDetail) {
    stroke_ellipse(
      ctx,
      cx + rx * 0.2,
      cy + ry * 0.25,
      rx * 0.22,
      ry * 0.2,
      css(0xffffff, 0.3),
      0.7,
    );
    stroke_ellipse(
      ctx,
      cx + rx * 0.2,
      cy + ry * 0.25,
      rx * 0.36,
      ry * 0.32,
      css(0xffffff, 0.18),
      0.6,
    );
  }
  ctx.restore();
  for (const [pad_x, pad_y, size] of [
    [cx - rx * 0.45, cy + ry * 0.3, 5.5],
    [cx - rx * 0.12, cy + ry * 0.5, 4.2],
    [cx + rx * 0.55, cy + ry * 0.05, 4.8],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(pad_x, pad_y, size, size * 0.5, 0, 0.35, TAU - 0.1);
    ctx.lineTo(pad_x, pad_y);
    ctx.closePath();
    ctx.fillStyle = linear_gradient(ctx, pad_x - size, pad_y, pad_x + size, pad_y, [
      [0, LEAF_LIGHT],
      [1, LEAF_MID],
    ]);
    ctx.fill();
    ink_current_path(ctx, frame, 0.8);
  }
  const lily_x = cx - rx * 0.12;
  const lily_y = cy + ry * 0.38;
  for (let petal = 0; petal < 6; petal += 1) {
    const angle = Math.PI + (petal / 5) * Math.PI;
    ctx.save();
    ctx.translate(lily_x + Math.cos(angle) * 2, lily_y + Math.sin(angle) * 1.4);
    ctx.rotate(angle);
    fill_ellipse(ctx, 0, 0, 2.6, 1.1, css(petal % 2 === 0 ? 0xf6d4df : 0xeeb2c6));
    ctx.restore();
  }
  fill_circle(ctx, lily_x, lily_y - 0.6, 1.1, css(0xf3cf5a));
}

/**
 * Paints a clump of umbrella sedge: slim stems rising from the water, each topped with a
 * starburst of narrow bracts.
 *
 * @param ctx - The paint context.
 * @param base - The clump's base on the water.
 * @param height - The tallest stem.
 * @param seed - Seed for the stem lean.
 * @param frame - The paint frame.
 */
function paint_sedge(
  ctx: PaintContext,
  base: Point,
  height: number,
  seed: number,
  frame: PaintFrame,
): void {
  const next = seeded(seed);
  const stems = frame.isLowDetail ? 5 : 8;
  for (let stem = 0; stem < stems; stem += 1) {
    const lean = (stem / (stems - 1) - 0.5) * 22 + (next() - 0.5) * 4;
    const stem_height = height * (0.7 + next() * 0.3);
    const top: Point = [base[0] + lean, base[1] - stem_height];
    line(
      ctx,
      base[0] + lean * 0.1,
      base[1],
      top[0],
      top[1],
      css(stem % 2 === 0 ? LEAF_MID : LEAF_FRESH),
      1,
    );
    const rays = frame.isLowDetail ? 5 : 8;
    for (let ray = 0; ray < rays; ray += 1) {
      const angle = (ray / rays) * TAU;
      const ray_length = 5 + next() * 2;
      line(
        ctx,
        top[0],
        top[1],
        top[0] + Math.cos(angle) * ray_length,
        top[1] + Math.sin(angle) * ray_length * 0.5 + 1.5,
        css(ray % 2 === 0 ? LEAF_FRESH : LEAF_LIGHT),
        0.9,
      );
    }
  }
}

/**
 * Paints the rain-garden pot: a broad, low glazed teal bowl holding still water with lily
 * pads and a water lily, umbrella sedge at the back left and two taro leaves at the back right.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose seed varies the stems.
 */
function paint_rain_garden(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const unit = Math.min(box.width, box.height) / 96;
  const cx = box.centreX;
  const rx = 38 * unit;
  const rim_y = box.y + 56 * unit;
  const depth = 20 * unit;
  floor_shadow(ctx, cx + 4, rim_y + depth + 6 * unit, rx * 0.95, rx * 0.36, 0.26);
  paint_round_pot(
    ctx,
    cx,
    rim_y,
    rx,
    depth,
    { colour: GLAZED_TEAL, taper: 0.8, inner: WATER, is_glazed: true },
    frame,
  );
  const water_rx = rx - Math.max(1.6, rx * 0.12);
  const water_ry = rx * POT_RIM - Math.max(1.6, rx * 0.12) * 0.5;
  paint_pond_surface(ctx, cx, rim_y + 0.3, water_rx, water_ry, frame);
  paint_sedge(ctx, [cx - 14 * unit, rim_y - 6 * unit], 44 * unit, recipe.seed, frame);
  for (const [stalk_x, leaf_y, size, tilt, colour] of [
    [cx + 20 * unit, box.y + 14 * unit, 20 * unit, -0.35, LEAF_MID],
    [cx + 8 * unit, box.y + 26 * unit, 17 * unit, 0.3, LEAF_FRESH],
  ] as const) {
    line(ctx, cx + 12 * unit, rim_y - 4 * unit, stalk_x, leaf_y, css(shade(LEAF_FRESH, 0.15)), 1.6);
    paint_heart_leaf(ctx, stalk_x, leaf_y, size, tilt, colour, frame);
  }
}

/**
 * Paints the hanging pothos: a coir basket high on three cords from a ceiling hook, a crown of
 * variegated leaves and vines trailing down, with only a faint shadow on the floor far below.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose seed scatters the leaves.
 */
function paint_hanging_pothos(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const cx = box.centreX;
  const rim_y = box.y - 2;
  const rx = 10;
  // The shadow lies on the floor well below the vine tips, so the basket reads as hanging.
  floor_shadow(ctx, cx + 8, box.bottom - 6, 10, 3, 0.1);
  const hook_y = box.y - OVERHANG + 3;
  ceiling_cord(ctx, box, cx, hook_y, 1.2);
  for (const vine of [
    [
      [cx - 7, rim_y + 3],
      [cx - 13, rim_y + 9],
      [cx - 9, rim_y + 15],
      [cx - 12, rim_y + 22],
    ],
    [
      [cx + 6, rim_y + 4],
      [cx + 13, rim_y + 10],
      [cx + 8, rim_y + 18],
      [cx + 12, rim_y + 26],
    ],
    [
      [cx - 1, rim_y + 5],
      [cx - 3, rim_y + 11],
      [cx + 3, rim_y + 15],
      [cx + 1, rim_y + 19],
    ],
  ] as const) {
    paint_vine(ctx, vine, 5, 2.8, frame, true);
  }
  // The basket: coir body below its rim, three cords up to the hook.
  ctx.beginPath();
  ctx.moveTo(cx - rx, rim_y);
  ctx.quadraticCurveTo(cx - rx * 0.9, rim_y + 9, cx, rim_y + 10);
  ctx.quadraticCurveTo(cx + rx * 0.9, rim_y + 9, cx + rx, rim_y);
  ctx.closePath();
  ctx.fillStyle = linear_gradient(ctx, cx - rx, 0, cx + rx, 0, [
    [0, tint(COIR, 0.2)],
    [0.4, COIR],
    [1, shade(COIR, 0.4)],
  ]);
  ctx.fill();
  stroke_outline(ctx, COIR, frame);
  if (!frame.isLowDetail) {
    for (let fibre = 1; fibre < 4; fibre += 1) {
      line(
        ctx,
        cx - rx + fibre * 1.5,
        rim_y + fibre * 2.2,
        cx + rx - fibre * 1.5,
        rim_y + fibre * 2.2,
        css(shade(COIR, 0.4), 0.45),
        0.7,
      );
    }
  }
  fill_ellipse(ctx, cx, rim_y, rx, rx * POT_RIM, css(shade(COIR, 0.15)));
  paint_leaf_cluster(ctx, cx, rim_y - 3, {
    count: 16,
    leaf: 3.3,
    spread_x: 10,
    spread_y: 5,
    seed: recipe.seed,
    frame,
    is_variegated: true,
  });
  for (const cord_x of [cx - rx + 1, cx + rx - 1, cx + 2]) {
    line(ctx, cord_x, rim_y, cx, hook_y, css(0x6b5a44), 0.8);
  }
  fill_circle(ctx, cx, hook_y, 1.6, css(shade(COIR, 0.5)));
}

/**
 * Paints the dwarf banana planter: a big glazed pot with a sturdy pseudostem and a pup, broad
 * paddle leaves arching up into the overhang and out to the sides, split by the wind.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose accent tints the glaze and whose seed splits the leaves.
 */
function paint_banana(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
): void {
  const unit = Math.min(box.width, box.height) / 96;
  const cx = box.centreX;
  const pot_depth = 15 * unit;
  const rim_y = box.bottom - 14 * unit - pot_depth;
  const rx = 16 * unit;
  const crown_y = rim_y - 16 * unit;
  floor_shadow(ctx, cx + 4, rim_y + pot_depth + 3 * unit, rx * 1.15, rx * 0.4, 0.26);
  paint_round_pot(
    ctx,
    cx,
    rim_y,
    rx,
    pot_depth,
    {
      colour: shade(mix(recipe.accent, 0x3c5560, 0.4), 0.1),
      taper: 0.76,
      inner: SOIL,
      is_glazed: true,
    },
    frame,
  );
  // Back leaves, then the stems, then the leaves reaching out to the sides and front. The plant
  // stands about 3 m tall overall: a dwarf banana in a big pot, under two guests' height.
  const leaves: readonly (readonly [number, number, number, number])[] = [
    [-1.95, 31, 13, 0],
    [-1.2, 32, 13, 1],
    [-2.55, 30, 12, 2],
    [-0.62, 30, 12, 3],
  ];
  const front_leaves: readonly (readonly [number, number, number, number])[] = [
    [-2.95, 27, 11, 4],
    [-0.15, 27, 11, 5],
    [1.95, 17, 9, 6],
  ];
  const paint_leaves = (set: typeof leaves) => {
    for (const [angle, length, width, index] of set) {
      const colour = GREENS[(index + 1) % GREENS.length] ?? LEAF_MID;
      paint_paddle_leaf(
        ctx,
        cx + Math.cos(angle) * 3 * unit,
        crown_y,
        angle,
        length * unit,
        width * unit,
        colour,
        recipe.seed + index,
        frame,
      );
    }
  };
  paint_leaves(leaves);
  const stem = linear_gradient(ctx, cx - 5 * unit, 0, cx + 5 * unit, 0, [
    [0, 0x9cb36a],
    [1, 0x5f7d3f],
  ]);
  fill_rounded_rect(ctx, cx - 4 * unit, crown_y, 8 * unit, rim_y - crown_y, 3, stem);
  fill_rounded_rect(ctx, cx + 5 * unit, rim_y - 10 * unit, 4.5 * unit, 10 * unit, 2, stem);
  paint_strap_leaf(
    ctx,
    {
      from: [cx + 7.5 * unit, rim_y - 9 * unit],
      control: [cx + 11 * unit, rim_y - 18 * unit],
      to: [cx + 18 * unit, rim_y - 16 * unit],
    },
    4.5 * unit,
    LEAF_FRESH,
    frame,
  );
  if (!frame.isLowDetail) {
    line(ctx, cx - 2 * unit, crown_y + 4, cx - 2 * unit, rim_y - 2, css(0xffffff, 0.2), 1);
  }
  paint_leaves(front_leaves);
}

/**
 * Paints the pandan border bed: a raised concrete bed with terrazzo-chip coping running along
 * its footprint, planted with a row of bright pandan clumps whose long straps arch up and out.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param frame - The paint frame.
 * @param recipe - The recipe, whose seed varies the clumps.
 * @param rotation - The placement rotation.
 */
function paint_pandan_bed(
  ctx: PaintContext,
  box: Box,
  frame: PaintFrame,
  recipe: PlaceableVisualRecipe,
  rotation: Rotation,
): void {
  const resolved = resolve_linear_rotation(box, rotation);
  const is_along = resolved === 90 || resolved === 270;
  const rect = is_along
    ? { x: box.x + 6, y: box.y + 2, width: box.width - 12, depth: box.height - 18, face: 11 }
    : { x: box.x + 4, y: box.y + 18, width: box.width - 8, depth: 12, face: 12 };
  ctx.save();
  ctx.shadowBlur = 6;
  ctx.shadowColor = css(SHADOW_INK, 0.24);
  fill_rounded_rect(
    ctx,
    rect.x + 4,
    rect.y + 6,
    rect.width - 4,
    rect.depth + rect.face - 3,
    4,
    css(SHADOW_INK, 0.2),
  );
  ctx.restore();
  paint_planter_box(ctx, rect, CONCRETE, "concrete", recipe.seed, frame);
  const clumps = Math.max(2, Math.round((is_along ? box.height : box.width) / 34));
  for (let clump = 0; clump < clumps; clump += 1) {
    const fraction = (clump + 0.5) / clumps;
    const base: Point = is_along
      ? [box.centreX, rect.y + 8 + (rect.depth - 12) * fraction]
      : [rect.x + rect.width * fraction, rect.y + rect.depth * 0.55];
    paint_strap_clump(ctx, base, {
      count: 13,
      length: 27,
      width: 3.6,
      greens: PANDAN_GREENS,
      seed: recipe.seed + clump * 13,
      frame,
      spread: is_along ? 0.8 : 1,
    });
  }
}

/** The painter for each plant style. */
const PLANT_PAINTERS: Readonly<Record<PlantStyle, PlantPainter>> = {
  leafy: paint_herb_planter,
  areca: paint_areca,
  fern: paint_fern_trough,
  trellis: paint_trellis,
  "rain-garden": paint_rain_garden,
  hanging: paint_hanging_pothos,
  banana: paint_banana,
  pandan: paint_pandan_bed,
};

/**
 * Paints a plant: its pot, trough, bed or basket and the foliage rising from it.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; the troughs and bed follow their footprint's long
 *   side and the trellis keeps its lattice on the planter's back edge (north at 0).
 */
export function paint_plant(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  const style = resolve_placeable_style("plant", recipe);
  ctx.save();
  clip_texture(ctx, box);
  PLANT_PAINTERS[style](ctx, box, frame, recipe, rotation);
  ctx.restore();
}
