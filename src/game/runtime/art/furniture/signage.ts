/**
 * Signage painters: the entrance directory, stall row marker, tray-return and accessible-route
 * pictogram signs, queue courtesy sign, chalk menu board and the centre's identity sign, in the
 * 3/4 oblique view.
 *
 * Every sign's framed panel faces the camera (south) at every rotation, so it stays readable;
 * the rotation turns only what the sign points at, so a rotated sign's arrow or chevrons point
 * the rotated way. Guests walk across the tiles of the row marker, the three pictogram signs and
 * the identity sign, and the world view draws those above people, so they hang from the ceiling:
 * the panel sits high in the texture, in the overhang, on rods rising out of the texture's top
 * edge, with empty floor and only a faint shadow below. The two signs that block movement (the
 * directory and the menu board) stand on posts just south of their footprint's centre line.
 * Every panel keeps its height at every rotation: turned to run north-south, a hung sign becomes
 * a narrower panel at the same height over the north tile, and the directory a narrower board on
 * the same posts. The key light from the north-west lights each panel's top edge and the
 * left side of every post, and standing signs cast a soft shadow to the south-east. The
 * construction is chosen through the ID-keyed style tables in `render/art.ts`; the label branch
 * tells the seven launch signs apart.
 */
import type { Rotation } from "@/src/game/core";

import {
  resolve_placeable_style,
  type SignageLabelStyle,
  type SignageStyle,
} from "../../render/art";
import type { PlaceableVisualRecipe } from "../../visuals/placeable";
import {
  css,
  fill_circle,
  fill_ellipse,
  fill_polygon,
  fill_rounded_rect,
  glow,
  label,
  line,
  linear_gradient,
  radial_gradient,
  shade,
  stroke_rounded_rect,
  TILE,
  tint,
  type PaintContext,
} from "../canvas";
import type { PaintFrame } from "../specs";
import { type Box, DARK_STEEL, TIMBER } from "./shared";
import {
  CREAM,
  DEEP_TEAL,
  floor_shadow,
  heading_for_rotation,
  type Heading,
  hung_floor_line,
  hung_shadow,
  INK,
  LAMP_LIGHT,
  LEAF,
  MUSTARD,
  paint_arrow,
  paint_board,
  paint_chevron,
  paint_hanger,
  paint_post,
  paint_weighted_base,
  type Rect,
  TEAL_STEEL,
  VERMILION,
  ZINC,
} from "./uprights";

/** Powder-coated dark steel of wayfinding sign frames. */
const FRAME_STEEL = 0x3e4f52;
/** The international access symbol's blue field. */
const ACCESS_BLUE = 0x2b67b5;
/** The slate of a chalkboard. */
const CHALK_SLATE = 0x2f3b39;
/** The muted colours the directory map blocks and legend cycle through. */
const MAP_BLOCK_COLOURS = [TEAL_STEEL, MUSTARD, VERMILION, LEAF, 0x4d7390, 0xb8667a] as const;
/** The dish strip colours of the chalk menu board. */
const MENU_STRIP_COLOURS = [VERMILION, MUSTARD, LEAF] as const;
/** Height of the zinc cap the identity sign wears above its panel. */
const ZINC_CAP_HEIGHT = 5;
/** How far a board's lit top edge rises above its front face (see `paint_board`). */
const BOARD_EDGE = 2.5;

/** The signs that hang from the ceiling, because guests walk across their tiles. */
type HungLabel = Extract<SignageLabelStyle, "row" | "return" | "accessible" | "queue" | "welcome">;

/** The signs that stand on the floor, because they block movement. */
type StandingLabel = Exclude<SignageLabelStyle, HungLabel>;

/**
 * The panel of each hung sign: its top edge, its height (kept at every rotation) and how far it
 * is inset from the footprint's sides running east-west and north-south.
 */
const HUNG_SIGN_PANELS: Readonly<
  Record<
    HungLabel,
    {
      readonly top: number;
      readonly height: number;
      readonly inset: number;
      readonly endInset: number;
    }
  >
> = {
  row: { top: 8, height: 21, inset: 13, endInset: 5 },
  return: { top: 8, height: 27, inset: 5, endInset: 5 },
  accessible: { top: 8, height: 27, inset: 5, endInset: 5 },
  queue: { top: 8, height: 27, inset: 5, endInset: 5 },
  welcome: { top: 10, height: 28, inset: 8, endInset: 4 },
};

/** The board of each standing sign: its height and the gap of post between board and floor. */
const STANDING_SIGN_BOARDS: Readonly<
  Record<StandingLabel, { readonly height: number; readonly gap: number }>
> = {
  directory: { height: 32, gap: 9 },
  menu: { height: 30, gap: 12 },
};

/** Where a sign's panel and its supports sit inside its texture. */
export interface SignageLayout {
  /** The framed panel's front face; its lit top edge sits just above it. */
  readonly panel: Rect;
  /** Centre x of each floor post; empty for a hung sign. */
  readonly posts: readonly number[];
  /** Centre x of each hanger rod; empty for a standing sign. */
  readonly hangers: readonly number[];
  /** Texture y where the posts start (the hanger rods start at the texture top). */
  readonly postTop: number;
  /** Texture y of the floor line: where posts meet their bases, or a hung sign's shadow. */
  readonly ground: number;
  /** Horizontal radius of each weighted base plate; 0 when there are none. */
  readonly baseRadius: number;
  /** Where the sign's arrow or chevrons point. */
  readonly heading: Heading;
  /** True when the sign runs north-south and shows its narrower panel. */
  readonly isPortrait: boolean;
  /** True when the panel hangs from the ceiling instead of standing on posts. */
  readonly isHanging: boolean;
}

/** What a face painter draws into. */
interface SignFace {
  /** The face inside the frame. */
  readonly rect: Rect;
  /** The whole board, frame included. */
  readonly panel: Rect;
  readonly recipe: PlaceableVisualRecipe;
  readonly frame: PaintFrame;
  readonly heading: Heading;
  readonly isPortrait: boolean;
}

/** Paints the content of one sign face inside its frame. */
type FacePainter = (ctx: PaintContext, face: SignFace) => void;

/**
 * Reports whether a sign hangs from the ceiling.
 *
 * @param label - The sign's label style.
 * @returns True for the walk-under signs.
 */
function is_hung_label(label: SignageLabelStyle): label is HungLabel {
  return label in HUNG_SIGN_PANELS;
}

/**
 * Lays out a sign: its panel and its posts or hanger rods, all inside the texture.
 *
 * @param box - The footprint box (already the rotated size).
 * @param style - The sign's resolved style.
 * @param rotation - The placement rotation, which sets the arrow heading.
 * @returns The layout.
 */
export function signage_layout(
  box: Box,
  style: SignageStyle,
  rotation: Rotation = 0,
): SignageLayout {
  const heading = heading_for_rotation(rotation);
  return is_hung_label(style.label)
    ? hung_layout(box, style.label, heading)
    : standing_layout(box, style.label, heading);
}

/**
 * Lays out a sign hung from the ceiling: its panel high in the texture, centred on the
 * footprint's width, with a rod near each end.
 *
 * @param box - The footprint box.
 * @param hung_label - The sign's label style.
 * @param heading - The arrow heading.
 * @returns The layout.
 */
function hung_layout(box: Box, hung_label: HungLabel, heading: Heading): SignageLayout {
  const size = HUNG_SIGN_PANELS[hung_label];
  const is_portrait = box.height > box.width;
  const width = box.width - 2 * (is_portrait ? size.endInset : size.inset);
  const panel: Rect = { x: box.centreX - width / 2, y: size.top, width, height: size.height };
  const hanger_inset = Math.min(14, width / 5);
  return {
    panel,
    posts: [],
    hangers: [panel.x + hanger_inset, panel.x + width - hanger_inset],
    postTop: 0,
    ground: hung_floor_line(box, panel.y + panel.height),
    baseRadius: 0,
    heading,
    isPortrait: is_portrait,
    isHanging: true,
  };
}

/**
 * Lays out a sign standing on posts with weighted bases just south of the footprint's centre
 * line. Running north-south, the board keeps its height and narrows to the tile's width, standing
 * where the footprint's two tiles meet.
 *
 * @param box - The footprint box.
 * @param standing_label - The sign's label style.
 * @param heading - The arrow heading.
 * @returns The layout.
 */
function standing_layout(box: Box, standing_label: StandingLabel, heading: Heading): SignageLayout {
  const { height, gap } = STANDING_SIGN_BOARDS[standing_label];
  const ground = box.centreY + 7;
  const panel: Rect = { x: box.x + 4, y: ground - gap - height, width: box.width - 8, height };
  const common = {
    panel,
    hangers: [],
    postTop: panel.y + panel.height - 2,
    ground,
    heading,
    isHanging: false,
  };
  if (box.height > box.width) {
    return {
      ...common,
      posts: [box.centreX - 11, box.centreX + 11],
      baseRadius: 7,
      isPortrait: true,
    };
  }
  if (box.width < TILE * 2) {
    return { ...common, posts: [box.centreX], baseRadius: 9, isPortrait: false };
  }
  return { ...common, posts: spread_posts(box), baseRadius: 8, isPortrait: false };
}

/**
 * Spreads posts evenly along a wide sign: two on a two-tile board, three on a four-tile one.
 *
 * @param box - The footprint box.
 * @returns The post centre x positions.
 */
function spread_posts(box: Box): number[] {
  const count = Math.max(2, Math.round(box.width / TILE) - 1);
  const margin = 20;
  const span = box.width - margin * 2;
  return Array.from({ length: count }, (_, index) => box.x + margin + (span * index) / (count - 1));
}

/**
 * Paints a sign in its rotated orientation.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box (already the rotated size).
 * @param recipe - The recipe.
 * @param frame - The paint frame.
 * @param rotation - The placement rotation; the panel always faces south, its arrows turn.
 */
export function paint_signage(
  ctx: PaintContext,
  box: Box,
  recipe: PlaceableVisualRecipe,
  frame: PaintFrame,
  rotation: Rotation = 0,
): void {
  const style = resolve_placeable_style("signage", recipe);
  const layout = signage_layout(box, style, rotation);
  const colours = SIGN_COLOURS[style.label](recipe.accent);
  paint_sign_shadow(ctx, box, layout);
  if (style.label === "welcome" && !frame.isLowDetail) paint_backlight(ctx, box, layout.panel);
  if (layout.isHanging) {
    const cap = style.label === "welcome" ? ZINC_CAP_HEIGHT : BOARD_EDGE;
    for (const hanger of layout.hangers) {
      paint_hanger(ctx, hanger, layout.panel.y - cap + 1, frame);
    }
  } else {
    paint_supports(ctx, layout, colours.post, frame);
  }
  const face = paint_board(ctx, layout.panel, colours.frame, colours.face, frame);
  FACE_PAINTERS[style.label](ctx, {
    rect: face,
    panel: layout.panel,
    recipe,
    frame,
    heading: layout.heading,
    isPortrait: layout.isPortrait,
  });
}

/** The frame, face and post colours of each sign, given the recipe accent. */
const SIGN_COLOURS: Record<
  SignageLabelStyle,
  (accent: number) => { frame: number; face: number; post: number }
> = {
  directory: () => ({ frame: DEEP_TEAL, face: 0xf6efe1, post: DARK_STEEL }),
  menu: () => ({ frame: TIMBER, face: CHALK_SLATE, post: TIMBER }),
  return: (accent) => ({ frame: FRAME_STEEL, face: accent, post: DARK_STEEL }),
  accessible: () => ({ frame: FRAME_STEEL, face: ACCESS_BLUE, post: DARK_STEEL }),
  queue: (accent) => ({ frame: accent, face: CREAM, post: DARK_STEEL }),
  row: (accent) => ({ frame: DARK_STEEL, face: accent, post: DARK_STEEL }),
  welcome: () => ({ frame: DEEP_TEAL, face: CREAM, post: DARK_STEEL }),
};

/**
 * Paints the shadow a sign throws on the floor: a soft one to the south-east of a standing
 * sign's posts, or a faint, diffuse one well below a hung sign.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param layout - The sign's layout.
 */
function paint_sign_shadow(ctx: PaintContext, box: Box, layout: SignageLayout): void {
  const { panel, ground } = layout;
  if (layout.isHanging) {
    hung_shadow(ctx, box, panel.x + 8, ground, panel.width - 6);
    return;
  }
  floor_shadow(ctx, box, panel.x + 6, ground - 2, panel.width - 4, 9, 0.14);
}

/**
 * Paints the posts a standing sign stands on, with their weighted bases.
 *
 * @param ctx - The paint context.
 * @param layout - The sign's layout.
 * @param colour_value - The post material.
 * @param frame - The paint frame.
 */
function paint_supports(
  ctx: PaintContext,
  layout: SignageLayout,
  colour_value: number,
  frame: PaintFrame,
): void {
  for (const post of layout.posts) {
    paint_weighted_base(ctx, post, layout.ground, layout.baseRadius, DARK_STEEL, frame);
  }
  const width = layout.posts.length > 1 ? 4.2 : 5;
  for (const post of layout.posts) {
    paint_post(ctx, post, layout.postTop, layout.ground, colour_value, width, frame);
  }
}

/**
 * Paints the soft glow a backlit identity sign throws, kept inside the footprint's sides.
 *
 * @param ctx - The paint context.
 * @param box - The footprint box.
 * @param panel - The lit panel.
 */
function paint_backlight(ctx: PaintContext, box: Box, panel: Rect): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, 0, box.width, box.bottom);
  ctx.clip();
  ctx.translate(panel.x + panel.width / 2, panel.y + panel.height / 2);
  ctx.scale(
    panel.width / Math.max(panel.width, panel.height),
    panel.height / Math.max(panel.width, panel.height),
  );
  glow(ctx, 0, 0, Math.max(panel.width, panel.height) * 0.62, LAMP_LIGHT, 0.24);
  ctx.restore();
}

/**
 * Fills a band across the top of a face with square bottom corners, for headers.
 *
 * @param ctx - The paint context.
 * @param face - The face rectangle.
 * @param height - Band height.
 * @param colour_value - Band colour.
 */
function paint_header_band(
  ctx: PaintContext,
  face: Rect,
  height: number,
  colour_value: number,
): void {
  fill_rounded_rect(ctx, face.x, face.y, face.width, height, 1.8, css(colour_value));
  fill_rounded_rect(ctx, face.x, face.y + height - 2, face.width, 2, 0, css(colour_value));
}

/**
 * Fills a caption band across the bottom of a face with square top corners and bakes its text.
 *
 * @param ctx - The paint context.
 * @param face - The face rectangle.
 * @param text - The caption.
 * @param colour_value - Band colour.
 */
function paint_caption_band(
  ctx: PaintContext,
  face: Rect,
  text: string,
  colour_value: number,
): void {
  const height = 7.5;
  const top = face.y + face.height - height;
  fill_rounded_rect(ctx, face.x, top, face.width, height, 1.8, css(colour_value));
  fill_rounded_rect(ctx, face.x, top, face.width, 2, 0, css(colour_value));
  label(ctx, text, face.x + face.width / 2, top + height / 2 + 0.3, {
    maxWidth: face.width - 6,
    size: 6,
    colour: CREAM,
    uppercase: true,
  });
}

/**
 * Paints a small map of stall blocks around two aisles with a "you are here" marker.
 *
 * @param ctx - The paint context.
 * @param map - The map area.
 * @param columns - Number of stall blocks along each row.
 */
function paint_directory_map(ctx: PaintContext, map: Rect, columns: number): void {
  fill_rounded_rect(ctx, map.x, map.y, map.width, map.height, 1.5, css(0xe3eae2));
  const step = (map.width - 4) / columns;
  const block = Math.max(3, Math.min(5, map.height * 0.22));
  for (let column = 0; column < columns; column += 1) {
    const block_x = map.x + 2 + column * step;
    const colour_value = MAP_BLOCK_COLOURS[column % MAP_BLOCK_COLOURS.length] as number;
    fill_rounded_rect(ctx, block_x, map.y + 2, step - 1.6, block, 0.8, css(colour_value));
    fill_rounded_rect(
      ctx,
      block_x,
      map.y + map.height - 2 - block,
      step - 1.6,
      block,
      0.8,
      css(shade(colour_value, 0.15)),
    );
  }
  const aisle = css(0xfbf6ea);
  fill_rounded_rect(ctx, map.x + 2, map.y + map.height / 2 - 1.5, map.width - 4, 3, 1.5, aisle);
  fill_rounded_rect(ctx, map.x + map.width / 2 - 1.5, map.y + 2, 3, map.height - 4, 1.5, aisle);
  fill_circle(ctx, map.x + map.width / 2, map.y + map.height / 2, 2.4, css(0xffffff));
  fill_circle(ctx, map.x + map.width / 2, map.y + map.height / 2, 1.5, css(VERMILION));
}

/**
 * Paints a colour legend: a swatch and a text bar per row.
 *
 * @param ctx - The paint context.
 * @param area - The legend area.
 * @param rows - Number of rows.
 * @param frame - The paint frame; low detail drops the text bars.
 */
function paint_legend(ctx: PaintContext, area: Rect, rows: number, frame: PaintFrame): void {
  const step = area.height / rows;
  for (let row = 0; row < rows; row += 1) {
    const row_y = area.y + row * step + (step - 3.5) / 2;
    fill_rounded_rect(ctx, area.x, row_y, 4, 3.5, 1, css(MAP_BLOCK_COLOURS[row] as number));
    if (!frame.isLowDetail) {
      const bar_width = area.width - 7 - (row % 2) * 3;
      fill_rounded_rect(ctx, area.x + 6, row_y + 1, bar_width, 1.5, 0.75, css(INK, 0.45));
    }
  }
}

/**
 * The entrance directory: a header, a map of the centre and a colour legend; the narrower
 * north-south board drops the legend.
 */
const paint_directory_face: FacePainter = (ctx, { rect, recipe, frame, isPortrait }) => {
  const header = 8;
  paint_header_band(ctx, rect, header, recipe.accent);
  label(ctx, "DIRECTORY", rect.x + rect.width / 2, rect.y + header / 2 + 0.3, {
    maxWidth: rect.width - 6,
    size: 6.5,
    colour: CREAM,
    uppercase: true,
  });
  const top = rect.y + header + 2.5;
  const map_height = rect.height - header - 5;
  if (isPortrait) {
    paint_directory_map(
      ctx,
      { x: rect.x + 2.5, y: top, width: rect.width - 5, height: map_height },
      4,
    );
    return;
  }
  const map: Rect = { x: rect.x + 3, y: top, width: rect.width * 0.58, height: map_height };
  paint_directory_map(ctx, map, 6);
  paint_legend(
    ctx,
    {
      x: map.x + map.width + 3,
      y: map.y,
      width: rect.x + rect.width - map.x - map.width - 5,
      height: map.height,
    },
    3,
    frame,
  );
};

/** The chalk menu board: a chalk title, coloured dish strips with price marks, a chalk ledge. */
const paint_menu_face: FacePainter = (ctx, { rect, frame }) => {
  const cx = rect.x + rect.width / 2;
  if (!frame.isLowDetail) {
    fill_rounded_rect(
      ctx,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      1.8,
      radial_gradient(ctx, cx, rect.y + rect.height / 2, 1, rect.width * 0.6, [
        [0, 0xffffff, 0.09],
        [1, 0xffffff, 0],
      ]),
    );
    line(ctx, cx - 8, rect.y + 9.5, cx + 8, rect.y + 9.5, css(CREAM, 0.6), 0.8);
  }
  label(ctx, "MENU", cx, rect.y + 5, {
    maxWidth: rect.width - 8,
    size: 6.5,
    colour: CREAM,
    uppercase: true,
  });
  for (let row = 0; row < MENU_STRIP_COLOURS.length; row += 1) {
    const row_y = rect.y + 11.5 + row * 4.2;
    fill_rounded_rect(ctx, rect.x + 3, row_y, 6, 2.8, 1, css(MENU_STRIP_COLOURS[row] as number));
    fill_rounded_rect(
      ctx,
      rect.x + 11,
      row_y + 0.8,
      9 + (row % 2) * 4,
      1.3,
      0.65,
      css(CREAM, 0.75),
    );
    fill_rounded_rect(ctx, rect.x + rect.width - 7, row_y + 0.8, 4, 1.3, 0.65, css(MUSTARD));
  }
  const ledge_y = rect.y + rect.height - 0.5;
  fill_rounded_rect(ctx, rect.x - 1, ledge_y, rect.width + 2, 2.4, 1, css(shade(TIMBER, 0.12)));
  fill_rounded_rect(ctx, rect.x + 3, ledge_y - 0.6, 5, 1.6, 0.8, css(CREAM));
};

/** The row marker blade: a big lettered disc, "ROW" and two chevrons pointing the way. */
const paint_row_face: FacePainter = (ctx, { rect, recipe, frame, heading, isPortrait }) => {
  const cy = rect.y + rect.height / 2;
  if (!frame.isLowDetail) {
    stroke_rounded_rect(
      ctx,
      rect.x + 1.2,
      rect.y + 1.2,
      rect.width - 2.4,
      rect.height - 2.4,
      1.5,
      css(CREAM, 0.75),
      0.9,
    );
  }
  const is_west = heading === "west";
  const radius = Math.min(7.5, rect.height / 2 - 0.5);
  const disc_x = isPortrait
    ? rect.x + radius + 3
    : is_west
      ? rect.x + rect.width - 17 - radius
      : rect.x + 17 + radius;
  fill_circle(ctx, disc_x, cy + 0.8, radius, css(shade(recipe.accent, 0.4)));
  fill_circle(
    ctx,
    disc_x,
    cy,
    radius,
    radial_gradient(ctx, disc_x - 2, cy - 2.5, 1, radius * 1.3, [
      [0, 0xffffff],
      [1, CREAM],
    ]),
  );
  label(ctx, String.fromCharCode(65 + (recipe.detailVariant % 6)), disc_x, cy + 0.6, {
    maxWidth: radius * 1.5,
    size: radius * 1.45,
    weight: 900,
    colour: shade(recipe.accent, 0.45),
  });
  if (!isPortrait) {
    label(ctx, "ROW", is_west ? rect.x + rect.width - 8.5 : rect.x + 8.5, cy + 0.3, {
      maxWidth: 13,
      size: 6,
      colour: CREAM,
      uppercase: true,
    });
  }
  const along = heading === "east" || heading === "west";
  const chevron_x = is_west ? rect.x + 9 : rect.x + rect.width - (along ? 9 : 7);
  for (const offset of [-3.2, 3.2]) {
    paint_chevron(
      ctx,
      along ? chevron_x + offset : chevron_x,
      along ? cy : cy + offset,
      along ? 4.2 : 3.6,
      heading,
      CREAM,
      1.8,
    );
  }
};

/** Width of the tray pictogram. */
const TRAY_GLYPH_WIDTH = 17;

/**
 * Paints the tray pictogram: a rimmed tray seen slightly from above, carrying a round bowl of
 * soup and a pair of chopsticks.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the tray.
 * @param y - Top edge of the tray.
 * @param accent - The sign's colour, which shows through the tray's floor and the soup.
 * @param frame - The paint frame.
 */
function paint_tray_glyph(
  ctx: PaintContext,
  x: number,
  y: number,
  accent: number,
  frame: PaintFrame,
): void {
  const cream = css(CREAM);
  const width = TRAY_GLYPH_WIDTH;
  fill_rounded_rect(ctx, x, y + 1.4, width, 9, 2.2, css(shade(CREAM, 0.3)));
  fill_rounded_rect(ctx, x, y, width, 9, 2.2, cream);
  fill_rounded_rect(ctx, x + 1.5, y + 1.5, width - 3, 6, 1.3, css(shade(accent, 0.18)));
  fill_ellipse(ctx, x + 5.6, y + 4.6, 3.7, 3, cream);
  fill_ellipse(ctx, x + 5.6, y + 4.3, 2.4, 1.8, css(shade(accent, 0.38)));
  if (!frame.isLowDetail) fill_ellipse(ctx, x + 4.6, y + 3.6, 0.9, 0.5, css(0xffffff, 0.5));
  line(ctx, x + 10, y + 7.4, x + 15.2, y + 1.6, cream, 1);
  line(ctx, x + 11.6, y + 7.6, x + 16.2, y + 2.6, cream, 1);
}

/** The tray-return sign: a tray with a bowl and chopsticks, a bold arrow and a caption. */
const paint_return_face: FacePainter = (ctx, { rect, recipe, frame, heading }) => {
  paint_caption_band(ctx, rect, "RETURN", shade(recipe.accent, 0.3));
  const is_west = heading === "west";
  paint_tray_glyph(
    ctx,
    is_west ? rect.x + rect.width - TRAY_GLYPH_WIDTH - 2 : rect.x + 2,
    rect.y + 1.8,
    recipe.accent,
    frame,
  );
  paint_arrow(
    ctx,
    is_west ? rect.x + 6.5 : rect.x + rect.width - 6.5,
    rect.y + 6.8,
    10,
    heading,
    CREAM,
  );
};

/** Scale of the access symbol on the hung sign's face. */
const ACCESS_SYMBOL_SCALE = 0.85;

/**
 * Paints the international access symbol, facing east or mirrored to face west.
 *
 * @param ctx - The paint context.
 * @param x - Left edge of the symbol's box.
 * @param y - Top edge of the symbol's box.
 * @param is_mirrored - True to face the symbol west.
 * @param frame - The paint frame.
 */
function paint_access_symbol(
  ctx: PaintContext,
  x: number,
  y: number,
  is_mirrored: boolean,
  frame: PaintFrame,
): void {
  const white = css(0xffffff);
  ctx.save();
  ctx.translate(x + 8 * ACCESS_SYMBOL_SCALE, y);
  ctx.scale(is_mirrored ? -ACCESS_SYMBOL_SCALE : ACCESS_SYMBOL_SCALE, ACCESS_SYMBOL_SCALE);
  fill_circle(ctx, -1.5, 2.6, 2.2, white);
  line(ctx, -1, 5.4, -0.5, 9.2, white, 2.2);
  line(ctx, -0.5, 9.2, 4, 9.2, white, 2);
  line(ctx, 4, 9.2, 4.5, 12.4, white, 1.8);
  if (!frame.isLowDetail) {
    line(ctx, 4.5, 12.4, 7, 12.4, white, 1.5);
    fill_circle(ctx, 6, 14.1, 1, white);
  }
  ctx.beginPath();
  ctx.ellipse(0, 11.3, 3.6, 3.6, 0, 0, Math.PI * 2);
  ctx.strokeStyle = white;
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.restore();
}

/** The accessible route sign: the international access symbol beside an arrow, on blue. */
const paint_accessible_face: FacePainter = (ctx, { rect, frame, heading }) => {
  paint_caption_band(ctx, rect, "ACCESS", shade(ACCESS_BLUE, 0.3));
  const is_west = heading === "west";
  paint_access_symbol(
    ctx,
    is_west ? rect.x + rect.width - 16 : rect.x + 3,
    rect.y + 0.8,
    is_west,
    frame,
  );
  paint_arrow(
    ctx,
    is_west ? rect.x + 7 : rect.x + rect.width - 7,
    rect.y + 6.8,
    10,
    heading,
    0xffffff,
  );
};

/** The queue courtesy sign: a header, three figures waiting in a line and the way forward. */
const paint_queue_face: FacePainter = (ctx, { rect, recipe, frame, heading }) => {
  const header = 7;
  paint_header_band(ctx, rect, header, recipe.accent);
  label(ctx, "QUEUE", rect.x + rect.width / 2, rect.y + header / 2 + 0.3, {
    maxWidth: rect.width - 8,
    size: 6,
    colour: CREAM,
    uppercase: true,
  });
  const is_west = heading === "west";
  const floor_y = rect.y + rect.height - 2.5;
  const ink = css(0x3b4a50);
  const first_x = is_west ? rect.x + 12 : rect.x + 6;
  for (let index = 0; index < 3; index += 1) {
    const figure_x = first_x + index * 7.2;
    fill_circle(ctx, figure_x, floor_y - 8.6, 1.8, ink);
    fill_rounded_rect(ctx, figure_x - 2.6, floor_y - 6.4, 5.2, 6, 2, ink);
  }
  if (!frame.isLowDetail) {
    for (let dot_x = rect.x + 4; dot_x < rect.x + rect.width - 3; dot_x += 3) {
      fill_circle(ctx, dot_x, floor_y + 1, 0.6, css(INK, 0.35));
    }
  }
  paint_chevron(
    ctx,
    is_west ? rect.x + 5 : rect.x + rect.width - 5,
    floor_y - 5,
    3.4,
    heading,
    shade(recipe.accent, 0.2),
  );
};

/**
 * Paints the identity emblem: a teal roof sheltering a vermilion bowl, two shapes and no script.
 *
 * @param ctx - The paint context.
 * @param ex - Centre x.
 * @param cy - Vertical centre.
 * @param size - Scale, 1 for the full emblem.
 */
function paint_welcome_emblem(ctx: PaintContext, ex: number, cy: number, size: number): void {
  const s = size;
  fill_polygon(
    ctx,
    [
      [ex - 9 * s, cy - 1 * s],
      [ex, cy - 9 * s],
      [ex + 9 * s, cy - 1 * s],
    ],
    css(TEAL_STEEL),
  );
  fill_polygon(
    ctx,
    [
      [ex - 9 * s, cy - 1 * s],
      [ex, cy - 9 * s],
      [ex, cy - 3 * s],
    ],
    css(tint(TEAL_STEEL, 0.3)),
  );
  ctx.beginPath();
  ctx.arc(ex, cy + 1.5 * s, 6.5 * s, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = css(VERMILION);
  ctx.fill();
  line(ctx, ex - 6.5 * s, cy + 1.5 * s, ex + 6.5 * s, cy + 1.5 * s, css(CREAM), 1.3 * s);
}

/**
 * Paints the zinc cap an identity sign wears on its top edge, which its rods hold.
 *
 * @param ctx - The paint context.
 * @param panel - The panel.
 */
function paint_zinc_cap(ctx: PaintContext, panel: Rect): void {
  fill_rounded_rect(
    ctx,
    panel.x + 1,
    panel.y - ZINC_CAP_HEIGHT,
    panel.width - 2,
    ZINC_CAP_HEIGHT,
    2,
    linear_gradient(ctx, 0, panel.y - ZINC_CAP_HEIGHT, 0, panel.y, [
      [0, tint(ZINC, 0.4)],
      [1, shade(ZINC, 0.3)],
    ]),
  );
}

/**
 * The centre identity sign: a zinc cap and "HAWKER CENTRE" between two emblems over a mustard
 * rule; north-south, the narrower panel stacks the two words.
 */
const paint_welcome_face: FacePainter = (ctx, { rect, panel, recipe, frame, isPortrait }) => {
  const cx = rect.x + rect.width / 2;
  paint_zinc_cap(ctx, panel);
  if (!frame.isLowDetail) {
    stroke_rounded_rect(
      ctx,
      rect.x + 2,
      rect.y + 2,
      rect.width - 4,
      rect.height - 4,
      1.5,
      css(recipe.accent, 0.8),
      1,
    );
  }
  if (isPortrait) {
    for (const [word, offset] of [
      ["HAWKER", 6.8],
      ["CENTRE", 14.2],
    ] as const) {
      label(ctx, word, cx, rect.y + offset, {
        maxWidth: rect.width - 4,
        size: 8,
        weight: 900,
        colour: INK,
      });
    }
    fill_rounded_rect(ctx, cx - 8, rect.y + rect.height - 3.6, 16, 1.4, 0.7, css(MUSTARD));
    return;
  }
  const cy = rect.y + rect.height / 2;
  if (!frame.isLowDetail) fill_rounded_rect(ctx, cx - 28, cy + 7, 56, 1.5, 0.75, css(MUSTARD));
  label(ctx, "HAWKER CENTRE", cx, cy - 0.5, {
    maxWidth: rect.width - 76,
    size: 12,
    weight: 900,
    colour: INK,
    uppercase: true,
  });
  paint_welcome_emblem(ctx, rect.x + 22, cy, 0.95);
  paint_welcome_emblem(ctx, rect.x + rect.width - 22, cy, 0.95);
};

/** The face painter of each sign. */
const FACE_PAINTERS = {
  directory: paint_directory_face,
  menu: paint_menu_face,
  return: paint_return_face,
  accessible: paint_accessible_face,
  queue: paint_queue_face,
  row: paint_row_face,
  welcome: paint_welcome_face,
} satisfies Record<SignageLabelStyle, FacePainter>;
