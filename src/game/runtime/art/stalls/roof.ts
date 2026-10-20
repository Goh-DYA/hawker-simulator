/**
 * The header of a stall: the roof band along the top of the texture, seen from above and the
 * south (a sloping roof surface with its front edge, fascia or valance below it), and the
 * signboard with the stall name baked in.
 *
 * The roofline comes from the stall's `STALL_ART_BY_ID` branch: a striped fabric awning with a
 * round, pointed or straight valance; corrugated zinc with a painted fascia, soot and an
 * extractor flue; an attap thatch with a ragged fringe; timber shingles under a gable; split
 * bamboo poles; glazed barrel tiles with round end caps; or a shophouse parapet faced with
 * Peranakan tiles. The sign shape comes from
 * content: a backlit lightbox, a painted timber board, a tiled panel or an awning plaque.
 */
import type { StallRoofArt } from "../../render/art";
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
  mix,
  rounded_rect_path,
  seeded,
  shade,
  SHADOW_INK,
  stroke_rounded_rect,
  tint,
  with_shadow,
  wood_grain,
} from "../canvas";
import {
  BRASS,
  clip_box,
  CREAM,
  edge_outline,
  fill_rect,
  INK,
  LAMP,
  paint_rosette,
  PLASTER,
  shade_band,
  STEEL,
  STEEL_DARK,
  TIMBER,
  TIMBER_DARK,
  type StallScene,
} from "./common";
import type { ValanceStyle } from "./identity";

/** Height of a tile-panel sign's rows of glazed tiles along its top and bottom edges. */
const TILE_PANEL_ROW = 3;
/** Font size of a tile-panel sign's lettering, as a share of the cream band between its tiles. */
const TILE_PANEL_TEXT_FILL = 1.15;

/** How an awning is cut and coloured. */
interface AwningStyle {
  readonly stripeA: number;
  readonly stripeB: number;
  /** Fabric panel count. */
  readonly stripes: number;
  readonly valance: ValanceStyle;
  readonly valanceA: number;
  readonly valanceB: number;
  /** A contrasting band sewn along the front edge of the fabric. */
  readonly band?: number;
}

/** A corrugated zinc roof's finish. */
interface ZincStyle {
  readonly sheet: number;
  /** Strength of the soot staining, 0 to 1. */
  readonly soot: number;
  readonly fascia: number;
  /** True for the harbour stall's rope trim and porthole lamps. */
  readonly isNautical: boolean;
}

/**
 * Gives the y where the roof surface meets its front edge (the fascia or valance below it).
 *
 * @param scene - The stall scene.
 * @returns The texture y.
 */
function eave_y(scene: StallScene): number {
  return Math.round(scene.geo.header.height * 0.42);
}

/**
 * Picks the awning fabric of the stalls on the generic awning branch from their palette.
 *
 * @param scene - The stall scene.
 * @returns The awning style.
 */
function generic_awning(scene: StallScene): AwningStyle {
  const { spec, dressing } = scene;
  return {
    stripeA: spec.primary,
    stripeB: tint(spec.secondary, 0.25),
    stripes: Math.max(7, Math.round(spec.width / 20) | 1),
    valance: dressing.valance,
    valanceA: spec.primary,
    valanceB: tint(spec.secondary, 0.2),
    band: dressing.valance === "straight" ? spec.accent : undefined,
  };
}

/**
 * Paints a fabric awning: striped panels sloping down to a steel front rail, and the valance
 * hanging from the rail.
 *
 * @param scene - The stall scene.
 * @param style - The fabric and valance.
 */
function paint_awning(scene: StallScene, style: AwningStyle): void {
  const { ctx, geo, isLowDetail } = scene;
  const width = geo.width;
  const eave = eave_y(scene);
  const stripeWidth = width / style.stripes;
  ctx.save();
  rounded_rect_path(ctx, 0, 0, width, eave + 2, 4);
  ctx.clip();
  fill_rect(ctx, 0, 0, width, eave + 2, css(style.stripeB));
  for (let index = 0; index < style.stripes; index += 2) {
    fill_rect(ctx, index * stripeWidth, 0, stripeWidth, eave + 2, css(style.stripeA));
  }
  if (!isLowDetail) {
    for (let index = 1; index < style.stripes; index += 1) {
      fill_rect(ctx, index * stripeWidth - 0.5, 0, 1, eave + 2, css(SHADOW_INK, 0.12));
    }
    // Sagging fabric between the frame ribs.
    for (let index = 0; index < 4; index += 1) {
      const y = (eave * (index + 0.5)) / 4;
      fill_rect(ctx, 0, y, width, 0.8, css(0xffffff, 0.08));
    }
  }
  if (style.band !== undefined) {
    fill_rect(ctx, 0, eave - 4, width, 3.5, css(style.band));
    fill_rect(ctx, 0, eave - 4, width, 0.8, css(0xffffff, 0.35));
  }
  fill_rect(
    ctx,
    0,
    0,
    width,
    eave + 2,
    linear_gradient(ctx, 0, 0, 0, eave + 2, [
      [0, 0xffffff, 0.32],
      [0.5, 0xffffff, 0.05],
      [1, SHADOW_INK, 0.16],
    ]),
  );
  ctx.restore();
  paint_valance(scene, style, eave);
  // The steel front rail of the awning frame.
  line(ctx, 1, eave, width - 1, eave, css(STEEL_DARK), 2, "butt");
  line(ctx, 1, eave - 0.7, width - 1, eave - 0.7, css(0xffffff, 0.45), 0.8, "butt");
}

/**
 * Paints the valance hanging from an awning's front rail, lit along its top and shaded where it
 * turns away from the light.
 *
 * @param scene - The stall scene.
 * @param style - The awning style.
 * @param eave - The rail y.
 */
function paint_valance(scene: StallScene, style: AwningStyle, eave: number): void {
  const { ctx, geo } = scene;
  const width = geo.width;
  const bottom = geo.header.height;
  const drop = bottom - eave;
  const count = Math.max(6, Math.round(width / 16));
  const step = width / count;
  // The valance casts a soft shadow onto whatever is below it.
  with_shadow(
    ctx,
    () => {
      for (let index = 0; index < count; index += 1) {
        const x = index * step;
        const colourValue = index % 2 === 0 ? style.valanceA : style.valanceB;
        const fill = linear_gradient(ctx, 0, eave, 0, bottom, [
          [0, tint(colourValue, 0.12)],
          [1, shade(colourValue, 0.16)],
        ]);
        if (style.valance === "round") {
          ctx.beginPath();
          ctx.moveTo(x, eave);
          ctx.lineTo(x + step, eave);
          ctx.lineTo(x + step, bottom - drop * 0.42);
          ctx.quadraticCurveTo(x + step / 2, bottom + drop * 0.32, x, bottom - drop * 0.42);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
        } else if (style.valance === "point") {
          fill_polygon(
            ctx,
            [
              [x, eave],
              [x + step, eave],
              [x + step, bottom - drop * 0.45],
              [x + step / 2, bottom],
              [x, bottom - drop * 0.45],
            ],
            fill,
          );
        } else {
          fill_rect(ctx, x, eave, step + 0.5, drop - 2, fill);
        }
      }
    },
    { blur: 3, offsetX: 1, offsetY: 3, alpha: 0.3 },
  );
  if (style.valance === "straight" && style.band !== undefined) {
    fill_rect(ctx, 0, bottom - 5, width, 2.5, css(style.band));
  }
  fill_rect(ctx, 0, eave, width, 1.4, css(0xffffff, 0.3));
}

/**
 * Paints a corrugated zinc roof with its painted fascia board, soot staining and a flue.
 *
 * @param scene - The stall scene.
 * @param style - The zinc finish.
 */
function paint_zinc(scene: StallScene, style: ZincStyle): void {
  const { ctx, geo, seed, isLowDetail } = scene;
  const width = geo.width;
  const eave = eave_y(scene);
  const bottom = geo.header.height;
  fill_rect(
    ctx,
    0,
    0,
    width,
    eave + 1,
    linear_gradient(ctx, 0, 0, 0, eave, [
      [0, tint(style.sheet, 0.32)],
      [1, shade(style.sheet, 0.12)],
    ]),
  );
  for (let x = 1; x < width; x += 4) {
    fill_rect(ctx, x, 0, 1.2, eave, css(0xffffff, 0.3));
    fill_rect(ctx, x + 2, 0, 1, eave, css(SHADOW_INK, 0.18));
  }
  // Lapped sheet joints.
  fill_rect(ctx, 0, eave * 0.45, width, 0.8, css(SHADOW_INK, 0.2));
  if (style.soot > 0 && !isLowDetail) {
    const next = seeded(seed ^ 0x5007);
    for (let index = 0; index < 6; index += 1) {
      const x = next() * width;
      fill_ellipse(
        ctx,
        x,
        eave * 0.5,
        6 + next() * 10,
        eave * 0.5,
        css(SHADOW_INK, 0.14 * style.soot),
      );
    }
    const rust = seeded(seed ^ 0x2057);
    for (let index = 0; index < 4; index += 1) {
      fill_circle(ctx, rust() * width, rust() * eave, 1 + rust(), css(0x9a5a33, 0.35));
    }
  }
  // The fascia board, its lit top edge and the drip edge.
  const fasciaTop = eave;
  const fasciaBottom = bottom - 2;
  fill_rect(
    ctx,
    0,
    fasciaTop,
    width,
    fasciaBottom - fasciaTop,
    linear_gradient(ctx, 0, fasciaTop, 0, fasciaBottom, [
      [0, tint(style.fascia, 0.14)],
      [1, shade(style.fascia, 0.2)],
    ]),
  );
  fill_rect(ctx, 0, fasciaTop, width, 1.2, css(0xffffff, 0.35));
  fill_rect(ctx, 0, fasciaBottom, width, 2, css(shade(style.fascia, 0.5)));
  if (style.soot > 0.3) shade_band(ctx, 0, fasciaTop, width, 5, 0.25 * style.soot);
  if (style.isNautical) {
    // Rope trim and porthole lamps along the fascia.
    for (let x = 2; x < width - 2; x += 5) {
      fill_ellipse(ctx, x + 2, fasciaBottom - 3, 2.6, 1.2, css(0xe8d7b0));
      line(ctx, x + 0.5, fasciaBottom - 4, x + 3.5, fasciaBottom - 2, css(0xa8916a, 0.8), 0.6);
    }
    for (const x of [12, width - 12]) {
      fill_circle(ctx, x, fasciaTop + 6, 3.4, css(BRASS));
      fill_circle(ctx, x, fasciaTop + 6, 2.4, css(scene.spec.isOpen ? 0xfff0c2 : 0xb9c4c2));
    }
  }
  paint_flue(scene, style.soot);
}

/**
 * Paints the steel flue of a kitchen extractor rising through the roof, with smoke over sooty
 * kitchens.
 *
 * @param scene - The stall scene.
 * @param soot - Soot strength of the roof.
 */
function paint_flue(scene: StallScene, soot: number): void {
  const { ctx, geo, isLowDetail } = scene;
  const main = geo.stations[0];
  const x = Math.min(geo.width - 18, Math.max(6, main.x + main.width / 2 - 4));
  const top = 1;
  const base = eave_y(scene);
  fill_rect(
    ctx,
    x,
    top + 3,
    8,
    base - top - 2,
    linear_gradient(ctx, x, 0, x + 8, 0, [
      [0, tint(STEEL, 0.3)],
      [0.5, STEEL],
      [1, shade(STEEL, 0.35)],
    ]),
  );
  fill_rounded_rect(ctx, x - 2, top, 12, 4, 1.5, css(shade(STEEL, 0.15)));
  fill_rect(ctx, x - 2, top, 12, 1, css(0xffffff, 0.4));
  fill_ellipse(ctx, x + 4, base, 6, 1.6, css(SHADOW_INK, 0.25));
  if (soot > 0.4 && !isLowDetail && scene.spec.isOpen) {
    for (let index = 0; index < 3; index += 1) {
      fill_circle(
        ctx,
        x + 6 + index * 4,
        top + 1 - index * 0.5,
        3 + index,
        css(0xd8d4cc, 0.28 - index * 0.06),
      );
    }
  }
}

/**
 * Paints an attap thatch: layered palm fronds sloping to a ragged fringe over a timber beam,
 * rising to a gentle peak at the centre.
 *
 * @param scene - The stall scene.
 */
function paint_thatch(scene: StallScene): void {
  const { ctx, geo, seed, isLowDetail } = scene;
  const width = geo.width;
  const bottom = geo.header.height;
  const beamTop = bottom - 7;
  const thatch = 0xb98d4c;
  fill_polygon(
    ctx,
    [
      [0, 5],
      [width / 2, 0],
      [width, 5],
      [width, beamTop + 1],
      [0, beamTop + 1],
    ],
    linear_gradient(ctx, 0, 0, 0, beamTop, [
      [0, tint(thatch, 0.3)],
      [1, shade(thatch, 0.18)],
    ]),
  );
  const next = seeded(seed ^ 0x7a7c);
  const rows = isLowDetail ? 3 : 5;
  for (let row = 0; row < rows; row += 1) {
    const y = 5 + ((beamTop - 5) * (row + 1)) / (rows + 0.5);
    for (let x = 0; x < width; x += 3) {
      const length = 3 + next() * 3;
      line(ctx, x, y - length, x + 0.6, y, css(row % 2 === 0 ? 0x7d5a2e : 0xd9b56f, 0.55), 0.8);
    }
  }
  // Ragged fringe hanging over the beam.
  for (let x = 0; x < width; x += 2.5) {
    const length = 2 + next() * 4;
    line(ctx, x, beamTop - 1, x + 0.4, beamTop + length, css(0x8a6534, 0.85), 1);
  }
  fill_rect(ctx, 0, beamTop + 2, width, 5, css(TIMBER_DARK));
  fill_rect(ctx, 0, beamTop + 2, width, 1, css(tint(TIMBER, 0.2), 0.8));
  line(ctx, width / 2, 0, width / 2, 4, css(0x6b4a26), 1.5);
}

/**
 * Paints timber shingles under a central gable with a carved bargeboard.
 *
 * @param scene - The stall scene.
 */
function paint_shingles(scene: StallScene): void {
  const { ctx, geo, spec, seed, isLowDetail } = scene;
  const width = geo.width;
  const bottom = geo.header.height;
  const eave = eave_y(scene) + 3;
  const shingle = 0x9a6a3e;
  fill_rect(ctx, 0, 0, width, eave, css(shade(shingle, 0.1)));
  const next = seeded(seed ^ 0x5419);
  const rowHeight = 4;
  for (let row = 0; row * rowHeight < eave; row += 1) {
    const y = row * rowHeight;
    const offset = row % 2 === 0 ? 0 : 3;
    for (let x = -offset; x < width; x += 6) {
      const tone = mix_tone(shingle, next());
      fill_rect(ctx, x + 0.4, y, 5.2, rowHeight, css(tone));
      fill_rect(ctx, x + 0.4, y + rowHeight - 1, 5.2, 1, css(SHADOW_INK, 0.25));
    }
  }
  fill_rect(
    ctx,
    0,
    0,
    width,
    eave,
    linear_gradient(ctx, 0, 0, 0, eave, [
      [0, 0xffffff, 0.2],
      [1, SHADOW_INK, 0.1],
    ]),
  );
  // Bargeboard fascia with scalloped cut-outs and a painted band.
  fill_rect(ctx, 0, eave, width, bottom - eave, css(TIMBER_DARK));
  fill_rect(ctx, 0, eave, width, 1, css(tint(TIMBER, 0.3)));
  fill_rect(ctx, 0, eave + 2, width, 2, css(spec.accent));
  if (!isLowDetail) {
    for (let x = 4; x < width; x += 8) {
      fill_circle(ctx, x, bottom - 2, 2.2, css(shade(TIMBER_DARK, 0.4)));
    }
  }
  // The gable over the sign.
  const cx = width / 2;
  const half = Math.min(42, width * 0.3);
  fill_polygon(
    ctx,
    [
      [cx - half, eave + 1],
      [cx, 0],
      [cx + half, eave + 1],
    ],
    linear_gradient(ctx, cx - half, 0, cx + half, 0, [
      [0, tint(spec.secondary, 0.1)],
      [1, shade(spec.secondary, 0.14)],
    ]),
  );
  line(ctx, cx - half - 1, eave + 2, cx, -0.5, css(TIMBER_DARK), 2.4);
  line(ctx, cx + half + 1, eave + 2, cx, -0.5, css(TIMBER_DARK), 2.4);
}

/**
 * Varies a timber tone slightly for a shingle or pole.
 *
 * @param base - The timber colour.
 * @param amount - A value from 0 to 1 picking lighter or darker.
 * @returns The varied tone.
 */
function mix_tone(base: number, amount: number): number {
  return amount > 0.5 ? tint(base, (amount - 0.5) * 0.3) : shade(base, (0.5 - amount) * 0.3);
}

/**
 * Paints a roof of split bamboo poles over a lacquered fascia beam.
 *
 * @param scene - The stall scene.
 */
function paint_bamboo(scene: StallScene): void {
  const { ctx, geo, spec, seed } = scene;
  const width = geo.width;
  const bottom = geo.header.height;
  const eave = eave_y(scene) + 2;
  const next = seeded(seed ^ 0xba3b);
  for (let x = 0; x < width; x += 5) {
    const tone = mix_tone(0xc9a85a, next());
    fill_rect(
      ctx,
      x,
      0,
      5,
      eave,
      linear_gradient(ctx, x, 0, x + 5, 0, [
        [0, tint(tone, 0.3)],
        [0.5, tone],
        [1, shade(tone, 0.3)],
      ]),
    );
    const node = 3 + next() * (eave - 6);
    fill_rect(ctx, x + 0.5, node, 4, 1, css(shade(tone, 0.35)));
  }
  // A bamboo purlin across the poles.
  fill_rect(ctx, 0, eave * 0.4, width, 2.6, css(0xa98a46));
  fill_rect(ctx, 0, eave * 0.4, width, 0.8, css(0xffffff, 0.3));
  // The lacquered fascia beam.
  fill_rect(
    ctx,
    0,
    eave,
    width,
    bottom - eave,
    linear_gradient(ctx, 0, eave, 0, bottom, [
      [0, tint(spec.primary, 0.15)],
      [1, shade(spec.primary, 0.25)],
    ]),
  );
  fill_rect(ctx, 0, eave, width, 1.2, css(0xffffff, 0.3));
  fill_rect(ctx, 0, bottom - 3, width, 1.5, css(spec.accent));
}

/**
 * Paints a shophouse parapet faced with Peranakan tiles under a stepped plaster crest.
 *
 * @param scene - The stall scene.
 */
function paint_parapet(scene: StallScene): void {
  const { ctx, geo, spec, isLowDetail } = scene;
  const width = geo.width;
  const bottom = geo.header.height;
  const crestBottom = eave_y(scene) - 2;
  const cx = width / 2;
  // Stepped plaster crest with mouldings.
  fill_polygon(
    ctx,
    [
      [0, crestBottom],
      [0, 6],
      [cx - 40, 6],
      [cx - 34, 2],
      [cx + 34, 2],
      [cx + 40, 6],
      [width, 6],
      [width, crestBottom],
    ],
    linear_gradient(ctx, 0, 0, 0, crestBottom, [
      [0, tint(PLASTER, 0.4)],
      [1, shade(PLASTER, 0.1)],
    ]),
  );
  fill_rect(ctx, 0, crestBottom - 2, width, 2, css(shade(PLASTER, 0.25)));
  fill_rect(ctx, 0, 6, width, 1, css(0xffffff, 0.6));
  // The tile band.
  const tile = 6;
  fill_rect(ctx, 0, crestBottom, width, bottom - crestBottom, css(0xf3ead6));
  for (let y = crestBottom + 1; y < bottom - 2; y += tile) {
    for (let x = 0; x < width; x += tile) {
      fill_rect(ctx, x + 0.4, y + 0.4, tile - 0.8, tile - 0.8, css(tint(spec.primary, 0.55)));
      if (!isLowDetail) {
        paint_rosette(ctx, x + tile / 2, y + tile / 2, 2.6, spec.primary, spec.secondary);
      }
    }
  }
  fill_rect(ctx, 0, bottom - 2, width, 2, css(shade(spec.accent, 0.1)));
  shade_band(ctx, 0, crestBottom, width, 4, 0.18);
}

/**
 * Paints the roof band for the stall's roof art branch.
 *
 * @param scene - The stall scene.
 */
function paint_roof(scene: StallScene): void {
  const { spec } = scene;
  const roof: StallRoofArt = spec.art.roof;
  switch (roof) {
    case "cinder":
      paint_zinc(scene, { sheet: 0x8f9b98, soot: 0.45, fascia: spec.primary, isNautical: false });
      return;
    case "satay":
      paint_zinc(scene, {
        sheet: 0x707a77,
        soot: 0.75,
        fascia: shade(spec.primary, 0.05),
        isNautical: false,
      });
      return;
    case "harbour":
      paint_zinc(scene, { sheet: 0x5f8eaa, soot: 0, fascia: spec.primary, isNautical: true });
      return;
    case "coconut":
      paint_thatch(scene);
      return;
    case "tamarind":
      paint_shingles(scene);
      return;
    case "bamboo-basket":
      paint_bamboo(scene);
      return;
    case "straits":
      paint_parapet(scene);
      return;
    case "kopi":
      paint_awning(scene, {
        stripeA: tint(spec.secondary, 0.05),
        stripeB: 0xf7f1e2,
        stripes: 7,
        valance: "round",
        valanceA: spec.primary,
        valanceB: tint(spec.primary, 0.3),
        band: spec.primary,
      });
      return;
    case "sweet-monsoon":
      paint_awning(scene, {
        stripeA: tint(spec.primary, 0.45),
        stripeB: tint(spec.secondary, 0.2),
        stripes: 9,
        valance: "round",
        valanceA: spec.primary,
        valanceB: spec.secondary,
      });
      return;
    case "tiffin":
      paint_awning(scene, {
        stripeA: spec.primary,
        stripeB: tint(spec.primary, 0.12),
        stripes: 11,
        valance: "point",
        valanceA: spec.primary,
        valanceB: shade(spec.primary, 0.16),
        band: 0xe0a348,
      });
      return;
    case "mee-pok":
      paint_awning(scene, {
        stripeA: spec.secondary,
        stripeB: tint(spec.secondary, 0.3),
        stripes: 5,
        valance: "straight",
        valanceA: spec.primary,
        valanceB: spec.primary,
        band: spec.accent,
      });
      return;
    case "jade-ladle":
      paint_glazed_tiles(scene);
      return;
    case "longan-moon":
      paint_awning(scene, {
        stripeA: spec.primary,
        stripeB: tint(spec.secondary, 0.15),
        stripes: 5,
        valance: "round",
        valanceA: spec.accent,
        valanceB: spec.primary,
        band: spec.accent,
      });
      return;
    case "lesung":
      paint_zinc(scene, { sheet: 0x9a7b62, soot: 0.15, fascia: spec.primary, isNautical: false });
      return;
    case "peppercorn":
      paint_awning(scene, {
        stripeA: spec.primary,
        stripeB: tint(spec.secondary, 0.1),
        stripes: 13,
        valance: "straight",
        valanceA: spec.primary,
        valanceB: spec.primary,
        band: spec.accent,
      });
      return;
    case "awning":
      paint_awning(scene, generic_awning(scene));
      return;
  }
}

/**
 * Paints a roof of glazed barrel tiles in the accent glaze, with round end caps along the eave
 * over a timber fascia (the Cantonese porridge stall).
 *
 * @param scene - The stall scene.
 */
function paint_glazed_tiles(scene: StallScene): void {
  const { ctx, geo, spec, isLowDetail } = scene;
  const width = geo.width;
  const bottom = geo.header.height;
  const eave = eave_y(scene) + 2;
  const glaze = spec.accent;
  fill_rect(ctx, 0, 0, width, eave, css(shade(glaze, 0.35)));
  const pitch = 7;
  for (let x = 0; x < width + pitch; x += pitch) {
    fill_rect(
      ctx,
      x - 2.6,
      0,
      5.2,
      eave,
      linear_gradient(ctx, x - 2.6, 0, x + 2.6, 0, [
        [0, shade(glaze, 0.15)],
        [0.4, tint(glaze, 0.35)],
        [1, shade(glaze, 0.25)],
      ]),
    );
    if (!isLowDetail) fill_circle(ctx, x, eave, 2.6, css(tint(glaze, 0.1)));
    if (!isLowDetail) fill_circle(ctx, x, eave, 1.2, css(shade(glaze, 0.3)));
  }
  fill_rect(ctx, 0, eave + 2.4, width, bottom - eave - 2.4, css(TIMBER_DARK));
  fill_rect(ctx, 0, eave + 2.4, width, 1, css(tint(TIMBER, 0.3)));
  fill_rect(ctx, 0, bottom - 3, width, 1.5, css(spec.primary));
  fill_rect(ctx, 0, 0, width, 2, css(shade(glaze, 0.4)));
}

/**
 * Paints the signboard with the stall name, in the content's sign shape, with its thickness
 * and its shadow on the roof band.
 *
 * @param scene - The stall scene.
 */
function paint_sign(scene: StallScene): void {
  const { ctx, spec, geo, isHighContrast, isLowDetail } = scene;
  const { x, y, width, height } = geo.sign;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const size = geo.isDeep ? 11 : 9.5;
  const isLit = spec.isOpen;
  // The sign's depth: an edge below it and a soft shadow on the roof.
  with_shadow(
    ctx,
    () => fill_rounded_rect(ctx, x, y + 1.5, width, height, 3, css(shade(spec.primary, 0.45))),
    { blur: 4, offsetX: 2, offsetY: 3, alpha: 0.35 },
  );
  switch (spec.signShape) {
    case "lightbox": {
      if (isLit && !isLowDetail && !isHighContrast) glow(ctx, cx, cy, width * 0.62, LAMP, 0.35);
      line(ctx, x + 10, y, x + 10, y - 4, css(STEEL_DARK), 1.2);
      line(ctx, x + width - 10, y, x + width - 10, y - 4, css(STEEL_DARK), 1.2);
      fill_rounded_rect(
        ctx,
        x - 1.5,
        y - 1.5,
        width + 3,
        height + 3,
        4,
        css(shade(spec.primary, 0.3)),
      );
      fill_rounded_rect(
        ctx,
        x,
        y,
        width,
        height,
        3,
        isLit
          ? linear_gradient(ctx, 0, y, 0, y + height, [
              [0, 0xfffbea],
              [1, 0xffe3a8],
            ])
          : css(0xd9d2bf),
      );
      fill_rounded_rect(ctx, x + 3, y + 3, 5, height - 6, 2, css(spec.accent));
      fill_rounded_rect(ctx, x + width - 8, y + 3, 5, height - 6, 2, css(spec.accent));
      fill_rect(ctx, x + 10, y + 2, width - 20, 1.6, css(0xffffff, isLit ? 0.6 : 0.2));
      label(ctx, spec.name, cx, cy + 0.5, {
        maxWidth: width - 22,
        size,
        colour: isHighContrast ? INK : shade(spec.primary, 0.5),
        uppercase: true,
      });
      return;
    }
    case "painted-board": {
      fill_rounded_rect(ctx, x, y, width, height, 2.5, css(TIMBER_DARK));
      fill_rounded_rect(ctx, x + 1.5, y + 1.5, width - 3, height - 3, 2, css(TIMBER));
      if (!isLowDetail) wood_grain(ctx, x + 2, y + 2, width - 4, height - 4, TIMBER, scene.seed);
      fill_rounded_rect(ctx, x + 3.5, y + 3.5, width - 7, height - 7, 1.5, css(spec.primary));
      stroke_rounded_rect(ctx, x + 5, y + 5, width - 10, height - 10, 1, css(0xe7c66d, 0.85), 0.8);
      label(ctx, spec.name, cx, cy + 0.5, {
        maxWidth: width - 16,
        size,
        colour: CREAM,
        uppercase: true,
        outline: shade(spec.primary, 0.5),
      });
      return;
    }
    case "tile-panel": {
      // Thin tile rows top and bottom leave a cream band the lettering is sized to fit.
      const tile = TILE_PANEL_ROW;
      fill_rounded_rect(ctx, x, y, width, height, 2, css(0xefe4cc));
      ctx.save();
      clip_box(ctx, { x, y, width, height });
      for (let column = 0; column * tile < width; column += 1) {
        for (const row of [0, 1]) {
          const tileY = row === 0 ? y : y + height - tile;
          const colourValue = (column + row) % 2 === 0 ? spec.primary : spec.accent;
          fill_rect(
            ctx,
            x + column * tile + 0.4,
            tileY + 0.4,
            tile - 0.8,
            tile - 0.8,
            css(colourValue),
          );
        }
      }
      ctx.restore();
      const band = height - tile * 2 - 1;
      fill_rect(ctx, x + 1, y + tile + 0.5, width - 2, band, css(0xfff8ea));
      label(ctx, spec.name, cx, cy + 0.5, {
        maxWidth: width - 12,
        size: Math.min(size - 0.5, band * TILE_PANEL_TEXT_FILL),
        colour: isHighContrast ? INK : shade(spec.primary, 0.45),
        uppercase: true,
      });
      return;
    }
    case "awning": {
      fill_rounded_rect(
        ctx,
        x,
        y,
        width,
        height,
        height / 2,
        css(mix(spec.primary, 0x3b2a22, 0.55)),
      );
      stroke_rounded_rect(
        ctx,
        x + 1.5,
        y + 1.5,
        width - 3,
        height - 3,
        (height - 3) / 2,
        css(tint(spec.accent, 0.3), 0.9),
        1.2,
      );
      fill_rounded_rect(ctx, x + 10, y + 2.5, width - 20, 1.6, 0.8, css(0xffffff, 0.25));
      label(ctx, spec.name, cx, cy + 0.5, {
        maxWidth: width - 18,
        size,
        colour: CREAM,
        uppercase: true,
      });
      return;
    }
  }
}

/**
 * Paints the header: the roof band, the shade it casts on the walls just below it, and the
 * signboard.
 *
 * @param scene - The stall scene.
 */
export function paint_header(scene: StallScene): void {
  const { ctx, geo, spec } = scene;
  // The canopy's shade on the wall and posts directly below its front edge.
  shade_band(ctx, 0, geo.header.height, geo.width, 8, 0.3);
  paint_roof(scene);
  paint_sign(scene);
  if (scene.isHighContrast) {
    edge_outline(scene, geo.header, 2, spec.primary);
    stroke_rounded_rect(
      ctx,
      geo.sign.x,
      geo.sign.y,
      geo.sign.width,
      geo.sign.height,
      3,
      css(INK),
      2,
    );
  }
  // A thin brass rule ties the signboard to awnings and boards alike.
  fill_rect(
    ctx,
    geo.sign.x + 4,
    geo.sign.y + geo.sign.height + 1.5,
    geo.sign.width - 8,
    0.8,
    css(BRASS, 0.5),
  );
}
