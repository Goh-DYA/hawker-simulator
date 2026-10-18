/**
 * Head painters for people: the head with its ears, a face on the front and side views (eyes
 * with a highlight, brows, a nose shaded from the north-west and drawn in profile on the side
 * view, a mouth and a faint cheek warmth), and twelve hair cuts.
 *
 * Hair is drawn as a mass of hair rather than a shell: an uneven outline that stands off the
 * skull by the cut's volume, a parting or a combed-back hairline, a fringe broken into locks or
 * curls, strands that follow the way the hair falls, matte shading with a few lit strands on the
 * north-west side instead of a glossy sheen, and long hair, buns and ponytails that fall behind
 * the head and body. The north view shows the back of the head: hair, ears and the nape, never a
 * face. Features stay small and even; nothing is exaggerated, and skin tone comes only from the
 * spec, never from a persona.
 */
import {
  css,
  fill_circle,
  fill_ellipse,
  mix,
  radial_gradient,
  shade,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import { outline_style, outline_width, polyline } from "./draw";
import type { Point, Rig } from "./rig";

/** The hair cuts a figure can have. */
export type HairStyle =
  | "crop"
  | "buzz"
  | "side-part"
  | "swept-back"
  | "bob"
  | "short-perm"
  | "bun"
  | "low-bun"
  | "curly"
  | "wavy"
  | "ponytail"
  | "long";

/**
 * The customer hair cuts, two per `hairStyle` index 0 to 5; the customer painter picks one of
 * each pair from the rest of the figure.
 */
export const CUSTOMER_HAIR_STYLES: readonly (readonly [HairStyle, HairStyle])[] = [
  ["crop", "buzz"],
  ["side-part", "swept-back"],
  ["bob", "short-perm"],
  ["bun", "low-bun"],
  ["curly", "wavy"],
  ["ponytail", "long"],
];

/** What a figure's head looks like. */
export interface HeadLook {
  readonly skin: number;
  readonly hair: number;
  readonly hairStyle: HairStyle;
  readonly frame: PaintFrame;
}

/** How the hair meets the forehead. */
type Fringe = "locks" | "swept" | "parted" | "combed" | "curls" | "pulled" | "buzz";

/** How the hair falls. */
type Texture = "straight" | "wavy" | "curly";

/** What gathers the hair, if anything. */
type Tie = "none" | "top-bun" | "low-bun" | "ponytail";

/** The shape of a hair cut. */
interface HairCut {
  /** How far the hair stands off the skull at the crown, in pixels. */
  readonly volume: number;
  /** How far it stands off the skull at the sides (short back and sides stay close). */
  readonly sideVolume: number;
  /** How far down the sides of the face the hair reaches, in head half-heights below centre. */
  readonly side: number;
  /** How far down the back of the head it reaches, in head half-heights below centre. */
  readonly back: number;
  readonly fringe: Fringe;
  /** Parting position as a share of the head's half-width (viewer's right is positive). */
  readonly parting: number;
  readonly texture: Texture;
  readonly tie: Tie;
  readonly coversEars: boolean;
}

/** Every hair cut. */
const CUTS: Readonly<Record<HairStyle, HairCut>> = {
  crop: {
    volume: 0.9,
    sideVolume: 0.3,
    side: 0.12,
    back: 0.5,
    fringe: "locks",
    parting: 0,
    texture: "straight",
    tie: "none",
    coversEars: false,
  },
  buzz: {
    volume: 0.3,
    sideVolume: 0.15,
    side: 0.08,
    back: 0.42,
    fringe: "buzz",
    parting: 0,
    texture: "straight",
    tie: "none",
    coversEars: false,
  },
  "side-part": {
    volume: 1,
    sideVolume: 0.35,
    side: 0.16,
    back: 0.55,
    fringe: "swept",
    parting: 0.42,
    texture: "straight",
    tie: "none",
    coversEars: false,
  },
  "swept-back": {
    volume: 1.1,
    sideVolume: 0.3,
    side: 0.12,
    back: 0.55,
    fringe: "combed",
    parting: 0,
    texture: "straight",
    tie: "none",
    coversEars: false,
  },
  bob: {
    volume: 1.15,
    sideVolume: 1.0,
    side: 0.9,
    back: 0.92,
    fringe: "parted",
    parting: 0.32,
    texture: "straight",
    tie: "none",
    coversEars: true,
  },
  "short-perm": {
    volume: 1.7,
    sideVolume: 1.3,
    side: 0.4,
    back: 0.62,
    fringe: "curls",
    parting: 0,
    texture: "curly",
    tie: "none",
    coversEars: false,
  },
  bun: {
    volume: 0.7,
    sideVolume: 0.25,
    side: 0.1,
    back: 0.45,
    fringe: "pulled",
    parting: 0,
    texture: "straight",
    tie: "top-bun",
    coversEars: false,
  },
  "low-bun": {
    volume: 0.7,
    sideVolume: 0.25,
    side: 0.14,
    back: 0.55,
    fringe: "pulled",
    parting: 0.28,
    texture: "straight",
    tie: "low-bun",
    coversEars: false,
  },
  curly: {
    volume: 2.2,
    sideVolume: 1.9,
    side: 0.55,
    back: 0.78,
    fringe: "curls",
    parting: 0,
    texture: "curly",
    tie: "none",
    coversEars: true,
  },
  wavy: {
    volume: 1.4,
    sideVolume: 1.0,
    side: 1.35,
    back: 1.9,
    fringe: "parted",
    parting: -0.3,
    texture: "wavy",
    tie: "none",
    coversEars: true,
  },
  ponytail: {
    volume: 0.8,
    sideVolume: 0.25,
    side: 0.1,
    back: 0.45,
    fringe: "pulled",
    parting: -0.22,
    texture: "straight",
    tie: "ponytail",
    coversEars: false,
  },
  long: {
    volume: 1.1,
    sideVolume: 0.6,
    side: 1.7,
    back: 2.5,
    fringe: "parted",
    parting: 0,
    texture: "straight",
    tie: "none",
    coversEars: true,
  },
};

/** Small, fixed irregularities in a hair outline, so it never reads as a smooth shell. */
const LUMPS = [0, 0.55, -0.15, 0.7, 0.1, 0.6, -0.25, 0.45, 0.2, 0.75, -0.1, 0.5, 0.05] as const;

/** The eye colour (a warm near-black). */
const EYE = 0x2b2320;
/** The warm tint mixed over the cheeks. */
const BLUSH = 0xd9735f;
/** The lip tint mixed into the skin for the mouth. */
const LIP = 0x8a3b32;

/** Head geometry: centre and half sizes. */
interface HeadBox {
  readonly x: number;
  readonly y: number;
  readonly a: number;
  readonly b: number;
}

/**
 * Gives the head box of a rig.
 *
 * @param rig - The posed rig.
 * @returns The head centre and half sizes.
 */
function head_box(rig: Rig): HeadBox {
  return {
    x: rig.head.x,
    y: rig.head.y,
    a: rig.metrics.headWidth / 2,
    b: rig.metrics.headHeight / 2,
  };
}

/**
 * Gives the eye line of a head: a little below its centre, as on a real head.
 *
 * @param head - The head box.
 * @returns The eye line's y.
 */
function eye_line(head: HeadBox): number {
  return head.y + head.b * 0.12;
}

/**
 * Tells whether a hair colour is light (grey, white or fair), which takes a flatter sheen so it
 * never looks metallic.
 *
 * @param hair - The hair colour.
 * @returns True for light hair.
 */
function is_light_hair(hair: number): boolean {
  const r = (hair >>> 16) & 0xff;
  const g = (hair >>> 8) & 0xff;
  const b = hair & 0xff;
  return r * 0.3 + g * 0.59 + b * 0.11 > 0x6a;
}

/**
 * Fills the current path as hair: matte shading lit from the north-west crown and a thin tinted
 * edge (solid ink in high contrast).
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param hair - The hair colour.
 * @param frame - The paint frame.
 */
function fill_hair(ctx: PaintContext, head: HeadBox, hair: number, frame: PaintFrame): void {
  const isLight = is_light_hair(hair);
  ctx.fillStyle = radial_gradient(
    ctx,
    head.x - head.a * 0.45,
    head.y - head.b * 0.8,
    0,
    head.b * 2.6,
    [
      [0, tint(hair, isLight ? 0.08 : 0.16)],
      [0.5, hair],
      [1, shade(hair, isLight ? 0.3 : 0.24)],
    ],
  );
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = outline_width(frame);
  ctx.strokeStyle = outline_style(hair, frame);
  ctx.stroke();
}

/**
 * Gives points along the crown of a hair mass, an ellipse grown by the cut's volume with small
 * fixed lumps.
 *
 * @param head - The head box.
 * @param cut - The hair cut.
 * @param from - Start angle in radians (PI is the viewer's left, 1.5 PI the top).
 * @param to - End angle in radians.
 * @param shift - Horizontal shift of the crown (the side view moves it back).
 * @returns The points, `from` to `to`.
 */
function crown_points(head: HeadBox, cut: HairCut, from: number, to: number, shift = 0): Point[] {
  const count = 10;
  const lump = cut.texture === "curly" ? 0 : 0.32;
  const points: Point[] = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = from + ((to - from) * index) / count;
    const bump = (LUMPS[index % LUMPS.length] ?? 0) * lump;
    // Full volume over the top, the side volume over the ears.
    const rise = Math.sin(angle) ** 2;
    const volume = cut.sideVolume + (cut.volume - cut.sideVolume) * rise;
    points.push({
      x: head.x + shift + Math.cos(angle) * (head.a + volume * 0.8 + bump),
      y: head.y - 0.3 + Math.sin(angle) * (head.b + volume * 0.55 + bump),
    });
  }
  return points;
}

/**
 * Continues the current path through points: smoothly through their midpoints, or as a row of
 * outward bumps for curly hair.
 *
 * @param ctx - The paint context (the path already at the first point).
 * @param points - The points; the first is where the path already is.
 * @param centre - The centre the bumps push away from.
 * @param bump - Bump size for curls; 0 for smooth hair.
 */
function trace_through(
  ctx: PaintContext,
  points: readonly Point[],
  centre: Point,
  bump: number,
): void {
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1] as Point;
    const to = points[index] as Point;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    if (bump > 0) {
      const dx = mid.x - centre.x;
      const dy = mid.y - centre.y;
      const length = Math.hypot(dx, dy) || 1;
      ctx.quadraticCurveTo(mid.x + (dx / length) * bump, mid.y + (dy / length) * bump, to.x, to.y);
    } else if (index < points.length - 1) {
      ctx.quadraticCurveTo(from.x, from.y, mid.x, mid.y);
    } else {
      ctx.quadraticCurveTo(from.x, from.y, to.x, to.y);
    }
  }
}

/**
 * Strokes hair strands from a root along curves, for texture: dark strands between locks and a
 * few lit ones on the north-west side.
 *
 * @param ctx - The paint context (clipped to the hair).
 * @param strands - Each strand's start, bend and end.
 * @param hair - The hair colour.
 * @param frame - The paint frame.
 */
function paint_strands(
  ctx: PaintContext,
  strands: readonly (readonly [Point, Point, Point])[],
  hair: number,
  frame: PaintFrame,
): void {
  if (frame.isLowDetail) return;
  const isLight = is_light_hair(hair);
  for (const [index, [start, bend, end]] of strands.entries()) {
    const isLit = index % 3 === 1 && end.x < start.x + 1.5;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(bend.x, bend.y, end.x, end.y);
    ctx.lineCap = "round";
    ctx.lineWidth = isLit ? 0.55 : 0.45;
    ctx.strokeStyle = isLit
      ? css(tint(hair, isLight ? 0.28 : 0.4), isLight ? 0.38 : 0.45)
      : css(shade(hair, isLight ? 0.3 : 0.4), 0.45);
    ctx.stroke();
  }
}

/**
 * Paints tight curls over a hair mass: small lit rings on a grid, clipped to the mass.
 *
 * @param ctx - The paint context (clipped to the hair).
 * @param head - The head box.
 * @param hair - The hair colour.
 * @param frame - The paint frame.
 * @param spread - How far beyond the head the curls go.
 */
function paint_curl_texture(
  ctx: PaintContext,
  head: HeadBox,
  hair: number,
  frame: PaintFrame,
  spread: number,
): void {
  if (frame.isLowDetail) return;
  const step = 1.9;
  let row = 0;
  for (let y = head.y - head.b - spread; y < head.y + head.b * 1.4; y += step * 0.8) {
    const offset = row % 2 === 0 ? 0 : step / 2;
    for (let x = head.x - head.a - spread + offset; x < head.x + head.a + spread; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 0.75, Math.PI * 0.9, Math.PI * 2.1);
      ctx.lineWidth = 0.45;
      ctx.strokeStyle = css(shade(hair, 0.4), 0.55);
      ctx.stroke();
      if (x < head.x && y < head.y) {
        ctx.beginPath();
        ctx.arc(x - 0.2, y - 0.25, 0.45, Math.PI * 1.1, Math.PI * 1.7);
        ctx.lineWidth = 0.4;
        ctx.strokeStyle = css(tint(hair, 0.35), 0.5);
        ctx.stroke();
      }
    }
    row += 1;
  }
}

/**
 * Paints a ball of gathered hair (a bun) with wound strands. It is kept below the frame's top
 * edge so a tall figure's bun is never cut off.
 *
 * @param ctx - The paint context.
 * @param centre - The ball's centre.
 * @param radius - The ball's radius.
 * @param hair - The hair colour.
 * @param frame - The paint frame.
 */
function paint_bun(
  ctx: PaintContext,
  centre: Point,
  radius: number,
  hair: number,
  frame: PaintFrame,
): void {
  const y = Math.max(centre.y, radius + 0.3);
  ctx.beginPath();
  ctx.ellipse(centre.x, y, radius, radius * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = radial_gradient(
    ctx,
    centre.x - radius * 0.4,
    y - radius * 0.45,
    0,
    radius * 1.7,
    [
      [0, tint(hair, is_light_hair(hair) ? 0.08 : 0.2)],
      [0.5, hair],
      [1, shade(hair, 0.3)],
    ],
  );
  ctx.fill();
  ctx.lineWidth = outline_width(frame);
  ctx.strokeStyle = outline_style(hair, frame);
  ctx.stroke();
  if (frame.isLowDetail) return;
  for (const turn of [0.45, 0.75]) {
    ctx.beginPath();
    ctx.ellipse(centre.x, y, radius * turn, radius * turn * 0.8, -0.4, Math.PI * 0.9, Math.PI * 2);
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = css(shade(hair, 0.38), 0.55);
    ctx.stroke();
  }
}

/**
 * Paints a hair tie (an elastic) as a short dark band.
 *
 * @param ctx - The paint context.
 * @param from - One end of the band.
 * @param to - The other end.
 * @param hair - The hair colour.
 */
function paint_tie(ctx: PaintContext, from: Point, to: Point, hair: number): void {
  polyline(ctx, [from, to], 0.9, css(mix(shade(hair, 0.5), 0x8a3b32, 0.35)));
}

/**
 * Traces a ponytail: from its tie down in a soft curve to a tapered tip.
 *
 * @param ctx - The paint context.
 * @param root - The tie.
 * @param tip - The tip.
 * @param width - Width at the tie.
 * @param sway - Sideways bulge of the tail.
 */
function trace_tail(ctx: PaintContext, root: Point, tip: Point, width: number, sway: number): void {
  const midY = (root.y + tip.y) / 2;
  ctx.beginPath();
  ctx.moveTo(root.x - width / 2, root.y);
  ctx.quadraticCurveTo(root.x - width / 2 + sway - 0.6, midY, tip.x, tip.y);
  ctx.quadraticCurveTo(root.x + width / 2 + sway + 0.6, midY, root.x + width / 2, root.y);
  ctx.closePath();
}

/**
 * Traces the hair that hangs behind the head in the front view, for long cuts: a curtain from
 * the crown down to the cut's back length, a little wider than the head.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param cut - The hair cut.
 */
function trace_back_curtain(ctx: PaintContext, head: HeadBox, cut: HairCut): void {
  const { x, y, a, b } = head;
  const width = a + cut.sideVolume * 0.8 + (cut.back > 1.5 ? 0.8 : 0.2);
  const bottom = y + b * Math.min(cut.back, cut.back > 1.5 ? 2.9 : 1);
  ctx.beginPath();
  ctx.ellipse(x, y - 0.3, width, b + cut.volume * 0.55, 0, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(x + width + 0.5, (y + bottom) / 2, x + width - 0.4, bottom);
  ctx.quadraticCurveTo(x, bottom + 1.2, x - width + 0.4, bottom);
  ctx.quadraticCurveTo(x - width - 0.5, (y + bottom) / 2, x - width, y - 0.3);
  ctx.closePath();
}

/**
 * Paints the hair that falls behind the head and body in the front view: the back of long and
 * chin-length cuts, curly volume, a top bun and a ponytail swinging beside the neck.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param look - The head look.
 */
export function paint_hair_behind(ctx: PaintContext, rig: Rig, look: HeadLook): void {
  if (rig.facing !== "south") return;
  const head = head_box(rig);
  const cut = CUTS[look.hairStyle];
  const { hair, frame } = look;
  const back = shade(hair, 0.16);
  if (cut.coversEars && cut.texture !== "curly") {
    trace_back_curtain(ctx, head, cut);
    fill_hair(ctx, head, back, frame);
    if (!frame.isLowDetail && cut.back > 1.5) {
      ctx.save();
      trace_back_curtain(ctx, head, cut);
      ctx.clip();
      const bottom = head.y + head.b * Math.min(cut.back, 2.9);
      const strands: [Point, Point, Point][] = [-1, -0.6, 0.6, 1].map((side) => [
        { x: head.x + side * head.a, y: head.y },
        { x: head.x + side * (head.a + 1.6), y: (head.y + bottom) / 2 },
        { x: head.x + side * (head.a + 0.6), y: bottom },
      ]);
      paint_strands(ctx, strands, back, frame);
      ctx.restore();
    }
  }
  switch (cut.tie) {
    case "top-bun":
      paint_bun(
        ctx,
        { x: head.x + head.a * 0.1, y: head.y - head.b - cut.volume * 0.4 - 0.6 },
        head.a * 0.5,
        hair,
        frame,
      );
      break;
    case "ponytail": {
      // The tail swings out beside the neck on the viewer's right.
      const root = { x: head.x + head.a * 0.75, y: head.y + head.b * 0.35 };
      trace_tail(ctx, root, { x: root.x + 1.6, y: head.y + head.b * 1.9 }, 2.4, 1.2);
      fill_hair(ctx, head, back, frame);
      break;
    }
    default:
      break;
  }
}

/**
 * Traces the head outline: a round cranium, cheeks and a soft chin from the front; in profile,
 * the brow, a nose that stands out from the face, the lips and the chin.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param isSide - True for the side (east) view.
 */
function trace_head(ctx: PaintContext, head: HeadBox, isSide: boolean): void {
  const { x, y, a, b } = head;
  const eye = eye_line(head);
  ctx.beginPath();
  ctx.ellipse(x, y, a, b, 0, Math.PI, Math.PI * 2);
  if (isSide) {
    // Brow, nose, lips and chin down the front of the face.
    ctx.quadraticCurveTo(x + a * 1.02, eye - b * 0.18, x + a * 0.98, eye + 0.2);
    ctx.quadraticCurveTo(x + a + 1.1, eye + 1.3, x + a + 0.9, eye + 1.9);
    ctx.quadraticCurveTo(x + a + 0.3, eye + 2.2, x + a * 0.96, eye + 2.5);
    ctx.quadraticCurveTo(x + a * 1.02, eye + 3.1, x + a * 0.9, eye + 3.6);
    ctx.quadraticCurveTo(x + a * 0.96, y + b * 0.88, x + a * 0.55, y + b * 0.98);
    ctx.quadraticCurveTo(x - a * 0.05, y + b * 1.02, x - a * 0.4, y + b * 0.7);
    ctx.quadraticCurveTo(x - a * 1.02, y + b * 0.45, x - a, y);
  } else {
    ctx.quadraticCurveTo(x + a * 1.0, y + b * 0.62, x + a * 0.45, y + b * 0.93);
    ctx.quadraticCurveTo(x, y + b * 1.06, x - a * 0.45, y + b * 0.93);
    ctx.quadraticCurveTo(x - a * 1.0, y + b * 0.62, x - a, y);
  }
  ctx.closePath();
}

/**
 * Paints one ear: a small skin-toned shell with a soft inner fold.
 *
 * @param ctx - The paint context.
 * @param centre - The ear's centre.
 * @param skin - The skin colour.
 * @param frame - The paint frame.
 * @param facing - Which way the ear's opening faces: -1 left, 1 right.
 */
function paint_ear(
  ctx: PaintContext,
  centre: Point,
  skin: number,
  frame: PaintFrame,
  facing: number,
): void {
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, 1.05, 1.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = css(shade(skin, 0.04));
  ctx.fill();
  // Ears keep a thin tinted edge even in high contrast, so they never read as rings.
  ctx.lineWidth = 0.55;
  ctx.strokeStyle = css(shade(skin, 0.45), 0.7);
  ctx.stroke();
  if (frame.isLowDetail) return;
  ctx.beginPath();
  ctx.arc(
    centre.x - facing * 0.15,
    centre.y + 0.1,
    0.6,
    facing > 0 ? -1.3 : 1.84,
    facing > 0 ? 1.3 : 4.44,
  );
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = css(shade(skin, 0.3), 0.7);
  ctx.stroke();
}

/**
 * Paints an eye (a dark iris with a highlight under a soft upper lid) and the brow above it.
 *
 * @param ctx - The paint context.
 * @param centre - The eye's centre.
 * @param look - The head look.
 * @param browTilt - How much the brow's outer end drops.
 * @param outward - Which way the brow's outer end points: -1 left, 1 right.
 */
function paint_eye(
  ctx: PaintContext,
  centre: Point,
  look: HeadLook,
  browTilt: number,
  outward: number,
): void {
  const { x, y } = centre;
  fill_ellipse(ctx, x, y, 0.62, 0.74, css(EYE));
  if (!look.frame.isLowDetail) {
    fill_circle(ctx, x - 0.2, y - 0.28, 0.24, css(0xffffff, 0.9));
    polyline(
      ctx,
      [
        { x: x - 0.75, y: y - 0.45 },
        { x, y: y - 0.85 },
        { x: x + 0.75, y: y - 0.45 },
      ],
      0.4,
      css(shade(look.skin, 0.45), 0.6),
    );
  }
  const brow = mix(shade(look.hair, 0.15), look.skin, is_light_hair(look.hair) ? 0.25 : 0);
  polyline(
    ctx,
    [
      { x: x - outward * 0.7, y: y - 1.55 },
      { x: x + outward * 0.15, y: y - 1.85 },
      { x: x + outward * 0.85, y: y - 1.6 + browTilt },
    ],
    0.55,
    css(brow, look.frame.isHighContrast ? 1 : 0.85),
  );
}

/**
 * Paints the face on the front view: eyes and brows, a nose shaded on its south-east side, the
 * mouth with a lit lower lip, and faint cheek warmth.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param look - The head look.
 */
function paint_front_face(ctx: PaintContext, head: HeadBox, look: HeadLook): void {
  const eye = eye_line(head);
  const spacing = head.a * 0.4;
  for (const sign of [-1, 1]) {
    paint_eye(ctx, { x: head.x + sign * spacing, y: eye }, look, 0.15, sign);
  }
  const { skin } = look;
  if (!look.frame.isLowDetail) {
    for (const sign of [-1, 1]) {
      fill_ellipse(ctx, head.x + sign * head.a * 0.58, eye + 1.7, 0.95, 0.55, css(BLUSH, 0.13));
    }
    // The bridge of the nose, shaded on the side away from the light.
    polyline(
      ctx,
      [
        { x: head.x + 0.45, y: eye - 0.3 },
        { x: head.x + 0.6, y: eye + 1.3 },
      ],
      0.45,
      css(shade(skin, 0.25), 0.35),
    );
  }
  fill_ellipse(ctx, head.x + 0.35, eye + 1.75, 0.7, 0.36, css(shade(skin, 0.28), 0.7));
  fill_circle(ctx, head.x - 0.25, eye + 1.45, 0.28, css(tint(skin, 0.3), 0.6));
  ctx.beginPath();
  ctx.moveTo(head.x - 0.95, eye + 3);
  ctx.quadraticCurveTo(head.x, eye + 3.55, head.x + 0.95, eye + 3);
  ctx.lineCap = "round";
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = css(mix(skin, LIP, 0.55));
  ctx.stroke();
  if (!look.frame.isLowDetail) {
    fill_ellipse(ctx, head.x, eye + 3.75, 0.55, 0.22, css(tint(skin, 0.2), 0.55));
  }
}

/**
 * Paints the face on the side view: one eye and brow set back from the profile, the nostril,
 * the corner of the mouth and faint cheek warmth.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param look - The head look.
 */
function paint_side_face(ctx: PaintContext, head: HeadBox, look: HeadLook): void {
  const eye = eye_line(head);
  paint_eye(ctx, { x: head.x + head.a * 0.58, y: eye }, look, 0.25, 1);
  const { skin } = look;
  if (!look.frame.isLowDetail) {
    fill_ellipse(ctx, head.x + head.a * 0.35, eye + 1.7, 1.05, 0.6, css(BLUSH, 0.13));
  }
  fill_ellipse(ctx, head.x + head.a + 0.2, eye + 1.95, 0.4, 0.25, css(shade(skin, 0.35), 0.6));
  polyline(
    ctx,
    [
      { x: head.x + head.a * 0.68, y: eye + 3.05 },
      { x: head.x + head.a * 0.94, y: eye + 2.95 },
    ],
    0.55,
    css(mix(skin, LIP, 0.55)),
  );
}

/**
 * Paints the head: ears, the lit head shape and the face for the facing (none from the north).
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param look - The head look.
 */
export function paint_head(ctx: PaintContext, rig: Rig, look: HeadLook): void {
  const head = head_box(rig);
  const isSide = rig.facing === "east";
  const { skin, frame } = look;
  if (!isSide) {
    for (const sign of [-1, 1]) {
      paint_ear(
        ctx,
        { x: head.x + sign * (head.a - 0.05), y: eye_line(head) + 0.6 },
        skin,
        frame,
        -sign,
      );
    }
  }
  trace_head(ctx, head, isSide);
  ctx.fillStyle = radial_gradient(
    ctx,
    head.x - head.a * 0.35,
    head.y - head.b * 0.35,
    0,
    head.b * 1.6,
    [
      [0, tint(skin, 0.14)],
      [0.6, skin],
      [1, shade(skin, 0.18)],
    ],
  );
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = outline_width(frame);
  ctx.strokeStyle = outline_style(skin, frame);
  ctx.stroke();
  if (rig.facing === "south") paint_front_face(ctx, head, look);
  else if (isSide) paint_side_face(ctx, head, look);
}

/**
 * Paints the neck, shaded under the chin; the collar of the upper garment covers its base.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param skin - The skin colour.
 */
export function paint_neck(ctx: PaintContext, rig: Rig, skin: number): void {
  const head = head_box(rig);
  const isSide = rig.facing === "east";
  const top = head.y + head.b * 0.45;
  const width = head.a * (isSide ? 0.8 : 0.7);
  ctx.beginPath();
  ctx.rect(head.x - width / 2 - (isSide ? 0.7 : 0), top, width, rig.shoulder.y - top + 1.2);
  ctx.fillStyle = css(shade(skin, rig.facing === "north" ? 0.06 : 0.2));
  ctx.fill();
}

/**
 * Traces the front view's fringe, from the viewer's right temple to the left one.
 *
 * @param ctx - The paint context (the path at the right temple).
 * @param head - The head box.
 * @param cut - The hair cut.
 */
function trace_fringe(ctx: PaintContext, head: HeadBox, cut: HairCut): void {
  const { x, y, a, b } = head;
  const parting = x + cut.parting * a;
  const left = { x: x - a * 0.86, y: y - b * 0.08 };
  switch (cut.fringe) {
    case "locks": {
      // Short locks falling over the forehead, uneven at the tips.
      const tips = [
        [0.62, -0.3],
        [0.3, -0.2],
        [0, -0.32],
        [-0.32, -0.22],
        [-0.62, -0.3],
      ] as const;
      let from = { x: x + a * 0.86, y: y - b * 0.08 };
      for (const [tx, ty] of tips) {
        const tip = { x: x + tx * a, y: y + ty * b };
        ctx.quadraticCurveTo(from.x - a * 0.05, tip.y - b * 0.22, tip.x, tip.y);
        from = tip;
      }
      ctx.quadraticCurveTo(left.x + a * 0.1, y - b * 0.3, left.x, left.y);
      break;
    }
    case "swept":
      // From a parting on the viewer's right, swept across and down to the left temple.
      ctx.quadraticCurveTo(x + a * 0.82, y - b * 0.45, parting, y - b * 0.58);
      ctx.quadraticCurveTo(x - a * 0.1, y - b * 0.46, x - a * 0.55, y - b * 0.12);
      ctx.quadraticCurveTo(x - a * 0.72, y + b * 0.02, left.x, left.y + b * 0.06);
      break;
    case "parted":
    case "pulled": {
      // Two sides parted at the parting, framing the forehead; pulled-back hair sits higher.
      const top = cut.fringe === "pulled" ? y - b * 0.66 : y - b * 0.6;
      const sideY = cut.fringe === "pulled" ? y - b * 0.2 : y - b * 0.02;
      ctx.quadraticCurveTo(x + a * 0.7, y - b * 0.42, parting + a * 0.08, top + b * 0.06);
      ctx.lineTo(parting, top);
      ctx.lineTo(parting - a * 0.08, top + b * 0.06);
      ctx.quadraticCurveTo(x - a * 0.7, y - b * 0.42, left.x, sideY);
      break;
    }
    case "combed":
      // Combed straight back from a high, even hairline.
      ctx.quadraticCurveTo(x + a * 0.7, y - b * 0.66, x, y - b * 0.66);
      ctx.quadraticCurveTo(x - a * 0.7, y - b * 0.66, left.x, y - b * 0.18);
      break;
    case "curls": {
      // A row of small curls along the hairline.
      const count = 5;
      let from = { x: x + a * 0.86, y: y - b * 0.12 };
      for (let index = 1; index <= count; index += 1) {
        const t = index / count;
        const to = {
          x: x + a * 0.86 - t * a * 1.72,
          y: y - b * (0.38 + Math.sin(t * Math.PI) * 0.06) + (index === count ? b * 0.26 : 0),
        };
        ctx.quadraticCurveTo((from.x + to.x) / 2, Math.max(from.y, to.y) + 1.1, to.x, to.y);
        from = to;
      }
      break;
    }
    case "buzz":
      ctx.quadraticCurveTo(x + a * 0.62, y - b * 0.62, x, y - b * 0.6);
      ctx.quadraticCurveTo(x - a * 0.62, y - b * 0.62, left.x, y - b * 0.12);
      break;
  }
}

/**
 * Traces the front view's hair mass: the crown, the sides down to the cut's length and the
 * fringe across the forehead.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param cut - The hair cut.
 */
function trace_front_hair(ctx: PaintContext, head: HeadBox, cut: HairCut): void {
  const { x, y, a, b } = head;
  const side = Math.min(cut.side, 1.9);
  const sideY = y + b * side;
  const isCurly = cut.texture === "curly";
  const crown = crown_points(head, cut, Math.PI * 0.94, Math.PI * 2.06);
  const outer = a + cut.sideVolume * 0.8;
  const first = crown[0] as Point;
  const last = crown[crown.length - 1] as Point;
  ctx.beginPath();
  // Up the viewer's left side, over the crown and down the right side.
  ctx.moveTo(x - outer + (side > 0.6 ? 0.3 : 1.1), sideY);
  ctx.quadraticCurveTo(x - outer - (side > 1 ? 0.6 : 0.1), (sideY + first.y) / 2, first.x, first.y);
  trace_through(ctx, crown, { x, y }, isCurly ? 1 : 0);
  ctx.quadraticCurveTo(
    x + outer + (side > 1 ? 0.6 : 0.1),
    (sideY + last.y) / 2,
    x + outer - (side > 0.6 ? 0.3 : 1.1),
    sideY,
  );
  if (side > 0.6) {
    // Long sides: the hair frames the cheeks, its ends turned in under the jaw.
    ctx.quadraticCurveTo(x + a * 0.85, sideY + 0.9, x + a * 0.66, sideY - 0.4);
    ctx.quadraticCurveTo(x + a * 0.92, y + b * 0.2, x + a * 0.84, y - b * 0.05);
  } else {
    // A short sideburn in front of the ear.
    ctx.lineTo(x + a * 0.92, sideY);
    ctx.lineTo(x + a * 0.86, y - b * 0.08);
  }
  trace_fringe(ctx, head, cut);
  if (side > 0.6) {
    ctx.quadraticCurveTo(x - a * 0.92, y + b * 0.2, x - a * 0.66, sideY - 0.4);
    ctx.quadraticCurveTo(x - a * 0.85, sideY + 0.9, x - outer + 0.3, sideY);
  } else {
    ctx.lineTo(x - a * 0.92, sideY);
  }
  ctx.closePath();
}

/**
 * Gives the strands of the front view: from the parting (or the crown) over the head and down
 * the sides, following the cut.
 *
 * @param head - The head box.
 * @param cut - The hair cut.
 * @returns The strands.
 */
function front_strands(head: HeadBox, cut: HairCut): [Point, Point, Point][] {
  const { x, y, a, b } = head;
  const root = { x: x + cut.parting * a, y: y - b * 0.62 };
  const crownY = y - b - cut.volume * 0.4;
  const ends = Math.min(cut.side, 1.9);
  const strands: [Point, Point, Point][] = [];
  for (const share of [-1, -0.7, -0.4, -0.15, 0.15, 0.4, 0.7, 1]) {
    const isSide = Math.abs(share) > 0.6;
    const endX = x + share * (a + cut.volume * 0.5);
    const endY = isSide
      ? y + b * Math.max(ends, 0.15) - 0.4
      : y - b * (cut.fringe === "locks" ? 0.3 : 0.55);
    const start =
      cut.fringe === "combed" || cut.fringe === "buzz" ? { x: endX, y: y - b * 0.6 } : root;
    const bendX = (start.x + endX) / 2 + share * a * 0.4;
    strands.push([
      cut.fringe === "combed" || cut.fringe === "buzz" ? start : { x: start.x, y: crownY + 0.8 },
      { x: bendX, y: isSide ? y - b * 0.3 : crownY + b * 0.3 },
      { x: endX, y: endY },
    ]);
  }
  if (cut.texture === "wavy") {
    // Waves: a kink part way down each side.
    for (const sign of [-1, 1]) {
      strands.push([
        { x: x + sign * (a + 0.4), y: y },
        { x: x + sign * (a + 1.6), y: y + b * 0.6 },
        { x: x + sign * (a + 0.2), y: y + b * Math.min(ends, 1.9) - 0.6 },
      ]);
    }
  }
  return strands;
}

/**
 * Paints the front view's hair over the head: the mass with its fringe, then curls or strands,
 * the parting line and the ties that show from the front.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param look - The head look.
 */
function paint_front_hair(ctx: PaintContext, head: HeadBox, look: HeadLook): void {
  const cut = CUTS[look.hairStyle];
  const { hair, frame } = look;
  const colour = cut.fringe === "buzz" ? mix(hair, look.skin, 0.25) : hair;
  trace_front_hair(ctx, head, cut);
  fill_hair(ctx, head, colour, frame);
  ctx.save();
  trace_front_hair(ctx, head, cut);
  ctx.clip();
  if (cut.texture === "curly") paint_curl_texture(ctx, head, colour, frame, cut.volume);
  else paint_strands(ctx, front_strands(head, cut), colour, frame);
  ctx.restore();
  if (
    !frame.isLowDetail &&
    (cut.fringe === "parted" || cut.fringe === "pulled" || cut.fringe === "swept")
  ) {
    // The parting: a thin line of scalp running back from the hairline.
    const px = head.x + cut.parting * head.a;
    polyline(
      ctx,
      [
        { x: px, y: head.y - head.b * 0.6 },
        { x: px - cut.parting * 0.6, y: head.y - head.b - cut.volume * 0.3 },
      ],
      0.45,
      css(mix(look.skin, hair, 0.45), 0.8),
    );
  }
  if (cut.tie === "low-bun" || cut.tie === "ponytail") {
    // Pulled-back hair: the tie shows as a slight bulge at the back of the crown on one side.
    fill_ellipse(
      ctx,
      head.x + head.a * 0.95 + cut.volume * 0.4,
      head.y + head.b * 0.15,
      0.7,
      1.2,
      css(shade(hair, 0.15)),
    );
  }
}

/**
 * Traces the back view's hair mass: the crown, the sides and the nape or the long hair down the
 * back.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param cut - The hair cut.
 * @returns The hair's bottom edge y.
 */
function trace_back_hair(ctx: PaintContext, head: HeadBox, cut: HairCut): number {
  const { x, y, a, b } = head;
  const bottom = y + b * cut.back;
  const isCurly = cut.texture === "curly";
  const crown = crown_points(head, cut, Math.PI * 0.94, Math.PI * 2.06);
  const outer = a + cut.sideVolume * 0.8;
  const spread = cut.back > 1.5 ? 0.9 : cut.back > 0.8 ? 0.4 : -0.6;
  const first = crown[0] as Point;
  const last = crown[crown.length - 1] as Point;
  ctx.beginPath();
  ctx.moveTo(x - outer - spread, bottom - 0.8);
  ctx.quadraticCurveTo(x - outer - spread * 0.6, (bottom + first.y) / 2, first.x, first.y);
  trace_through(ctx, crown, { x, y }, isCurly ? 1 : 0);
  ctx.quadraticCurveTo(
    x + outer + spread * 0.6,
    (bottom + last.y) / 2,
    x + outer + spread,
    bottom - 0.8,
  );
  if (cut.back > 0.8) {
    // A soft, slightly uneven hem.
    ctx.quadraticCurveTo(x + a * 0.4, bottom + 0.9, x, bottom + 0.3);
    ctx.quadraticCurveTo(x - a * 0.4, bottom + 0.9, x - outer - spread, bottom - 0.8);
  } else {
    // A short nape, tapered into the neck.
    ctx.quadraticCurveTo(x + a * 0.55, bottom + 0.2, x + a * 0.3, bottom + 0.9);
    ctx.quadraticCurveTo(x, bottom + 1.3, x - a * 0.3, bottom + 0.9);
    ctx.quadraticCurveTo(x - a * 0.55, bottom + 0.2, x - outer - spread, bottom - 0.8);
  }
  ctx.closePath();
  return bottom;
}

/**
 * Paints the back view's hair: the mass with strands falling from the crown, curls, and the bun,
 * low bun or ponytail.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param look - The head look.
 */
function paint_back_hair(ctx: PaintContext, head: HeadBox, look: HeadLook): void {
  const cut = CUTS[look.hairStyle];
  const { x, y, a, b } = head;
  const { hair, frame } = look;
  const colour = cut.fringe === "buzz" ? mix(hair, look.skin, 0.25) : hair;
  const bottom = trace_back_hair(ctx, head, cut);
  fill_hair(ctx, head, colour, frame);
  ctx.save();
  trace_back_hair(ctx, head, cut);
  ctx.clip();
  if (cut.texture === "curly") {
    paint_curl_texture(ctx, head, colour, frame, cut.volume);
  } else {
    // Strands fall from a whorl at the crown, or run straight down to a tie.
    const whorl = cut.tie === "none" ? { x: x + a * 0.15, y: y - b * 0.55 } : { x, y: y - b * 0.9 };
    const target =
      cut.tie === "low-bun" || cut.tie === "ponytail" ? { x, y: y + b * 0.3 } : undefined;
    const strands: [Point, Point, Point][] = [-1, -0.65, -0.3, 0, 0.3, 0.65, 1].map((share) => {
      const end = target ?? { x: x + share * (a + cut.sideVolume * 0.5), y: bottom - 0.6 };
      // Each strand starts a little way out from the whorl, so they never meet in a star.
      const start = {
        x: whorl.x + share * a * 0.4,
        y: whorl.y + Math.abs(share) * b * 0.3 + (target ? 0 : b * 0.12),
      };
      return [
        start,
        { x: x + share * (a + cut.sideVolume * 0.7), y: (start.y + end.y) / 2 - b * 0.1 },
        end,
      ];
    });
    paint_strands(ctx, strands, colour, frame);
  }
  ctx.restore();
  switch (cut.tie) {
    case "top-bun":
      paint_bun(ctx, { x, y: y - b * 0.62 - cut.volume * 0.3 }, a * 0.52, hair, frame);
      break;
    case "low-bun":
      paint_bun(ctx, { x, y: y + b * 0.42 }, a * 0.5, hair, frame);
      break;
    case "ponytail": {
      const root = { x, y: y + b * 0.22 };
      trace_tail(ctx, root, { x: x + 0.6, y: y + b * 1.75 }, 2.8, 0.8);
      fill_hair(ctx, head, shade(hair, 0.06), frame);
      paint_tie(
        ctx,
        { x: root.x - 1.2, y: root.y + 0.3 },
        { x: root.x + 1.2, y: root.y + 0.3 },
        hair,
      );
      break;
    }
    default:
      break;
  }
}

/**
 * Traces the side view's hair mass: from the hairline over the crown, down the back of the head
 * to the cut's length, and up the side of the face around (or over) the ear.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param cut - The hair cut.
 */
function trace_side_hair(ctx: PaintContext, head: HeadBox, cut: HairCut): void {
  const { x, y, a, b } = head;
  const isCurly = cut.texture === "curly";
  const volume = cut.volume;
  // The hairline at the forehead, per fringe.
  const front =
    cut.fringe === "locks"
      ? { x: x + a * 0.82, y: y - b * 0.22 }
      : cut.fringe === "swept"
        ? { x: x + a * 0.92, y: y - b * 0.2 }
        : cut.fringe === "combed"
          ? { x: x + a * 0.58, y: y - b * 0.66 }
          : cut.fringe === "curls"
            ? { x: x + a * 0.8, y: y - b * 0.32 }
            : { x: x + a * 0.68, y: y - b * 0.5 };
  const crown = crown_points(head, cut, Math.PI * 1.62, Math.PI * 0.98, -volume * 0.35);
  const backX = x - a - (volume + cut.sideVolume) * 0.4;
  const length = cut.back;
  const bottom = y + b * length;
  ctx.beginPath();
  ctx.moveTo(front.x, front.y);
  ctx.quadraticCurveTo(
    x + a * 0.75,
    y - b - volume * 0.5,
    (crown[0] as Point).x,
    (crown[0] as Point).y,
  );
  trace_through(ctx, crown, { x, y }, isCurly ? 1 : 0);
  if (length > 1.2) {
    // Long hair falls down the back of the neck and over the shoulders.
    ctx.quadraticCurveTo(backX - 0.8, (y + bottom) / 2, backX + 0.2, bottom);
    ctx.quadraticCurveTo(x - a * 0.4, bottom + 0.8, x - a * 0.05, bottom - 0.6);
    ctx.quadraticCurveTo(x - a * 0.1, y + b * 1.1, x + a * 0.2, y + b * Math.min(cut.side, 1));
  } else {
    ctx.quadraticCurveTo(backX - 0.2, y + b * 0.4, x - a * 0.5, bottom);
    if (cut.coversEars) {
      // Over the ear to the jaw line.
      ctx.quadraticCurveTo(
        x - a * 0.05,
        bottom + 0.6,
        x + a * 0.25,
        y + b * Math.min(cut.side, 0.85),
      );
    } else {
      // Around the back of the ear.
      ctx.quadraticCurveTo(x - a * 0.38, y + b * 0.42, x - a * 0.36, y + b * 0.08);
      ctx.quadraticCurveTo(x - a * 0.05, y - b * 0.28, x + a * 0.22, y - b * 0.05);
    }
  }
  // Up the temple to the hairline.
  ctx.quadraticCurveTo(x + a * 0.3, y - b * 0.25, front.x - a * 0.15, front.y + b * 0.08);
  ctx.closePath();
}

/**
 * Paints the side view's hair: the mass, strands swept back from the forehead, curls, the ear
 * where the cut leaves it clear, and the bun or ponytail.
 *
 * @param ctx - The paint context.
 * @param head - The head box.
 * @param look - The head look.
 */
function paint_side_hair(ctx: PaintContext, head: HeadBox, look: HeadLook): void {
  const cut = CUTS[look.hairStyle];
  const { x, y, a, b } = head;
  const { hair, frame } = look;
  const colour = cut.fringe === "buzz" ? mix(hair, look.skin, 0.25) : hair;
  if (cut.tie === "ponytail") {
    const root = { x: x - a * 0.85, y: y - b * 0.05 };
    trace_tail(ctx, root, { x: x - a - 2.6, y: y + b * 1.75 }, 2.6, -1.4);
    fill_hair(ctx, head, shade(hair, 0.08), frame);
  }
  trace_side_hair(ctx, head, cut);
  fill_hair(ctx, head, colour, frame);
  ctx.save();
  trace_side_hair(ctx, head, cut);
  ctx.clip();
  if (cut.texture === "curly") {
    paint_curl_texture(ctx, head, colour, frame, cut.volume);
  } else {
    const bottom = y + b * Math.min(cut.back, 2.9);
    const strands: [Point, Point, Point][] = [0.1, 0.35, 0.6, 0.85].map((share) => [
      { x: x + a * 0.7, y: y - b * (0.35 + share * 0.3) },
      { x: x - a * 0.2, y: y - b - cut.volume * 0.5 + share * b * 0.5 },
      {
        x: x - a - cut.volume * 0.4 + share * a * 0.5,
        y: Math.min(bottom, y + b * (0.2 + share * 0.5)),
      },
    ]);
    paint_strands(ctx, strands, colour, frame);
  }
  ctx.restore();
  switch (cut.tie) {
    case "top-bun":
      paint_bun(ctx, { x: x - a * 0.5, y: y - b * 0.95 - cut.volume * 0.3 }, a * 0.5, hair, frame);
      break;
    case "low-bun":
      paint_bun(ctx, { x: x - a - 0.4, y: y + b * 0.35 }, a * 0.48, hair, frame);
      break;
    case "ponytail":
      paint_tie(ctx, { x: x - a * 0.92, y: y - b * 0.3 }, { x: x - a * 0.8, y: y + b * 0.2 }, hair);
      break;
    default:
      break;
  }
  if (!cut.coversEars) {
    paint_ear(ctx, { x: x - a * 0.1, y: eye_line(head) + 0.6 }, look.skin, frame, 1);
  }
}

/**
 * Paints the hair over the head for the rig's facing.
 *
 * @param ctx - The paint context.
 * @param rig - The posed rig.
 * @param look - The head look.
 */
export function paint_hair(ctx: PaintContext, rig: Rig, look: HeadLook): void {
  const head = head_box(rig);
  if (rig.facing === "south") paint_front_hair(ctx, head, look);
  else if (rig.facing === "north") paint_back_hair(ctx, head, look);
  else paint_side_hair(ctx, head, look);
}
