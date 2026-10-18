/**
 * Stall painters: each of the fourteen stalls as a small cutaway kitchen seen in the 3/4 oblique
 * view, painted per rotation in two layers so the live vendor sprite stands between them.
 *
 * At rotation 0 (serving south) a stall reads from the top of its texture down: the roof band
 * and baked signboard rising into the overhang, the back wall face with its tiles, tube light,
 * hanging wares, menu board, shelf and extractor hood, the work bench with the stall's cooking
 * station, the interior floor in the canopy's shade, and the counter (top, chrome lip and a front
 * face of colour panels, doors, price strip, number plate and skirting) over a kerb and drain.
 * Other rotations turn the kitchen so the counter faces the serving edge, cut the walls between
 * the camera and the interior down to counter height, and keep the sign along the top. At every
 * rotation the vendor stands behind the counter opposite the rotated service tile, with a
 * counter-height slab in the front layer hiding the legs and the dishes flanking the vendor.
 *
 * The parts live in `stalls/`: the per-stall dressing (`identity.ts`), the geometry and live
 * layout per rotation (`geometry.ts`), the roof and sign (`roof.ts`), the wall and floor
 * surfaces and posts (`walls.ts`), the wall and interior props (`props.ts`), the cooking
 * stations (`stations.ts`), the counter, benches and shutter (`counter.ts`) and the layer
 * composition (`kitchen.ts`). Every painter is pure: it reads only its spec (and the stall's
 * authored service point, looked up by its ID) and takes its grain and speckle from a seed hashed
 * from the stall ID.
 */
import { stableVisualHash } from "../visuals/palette";
import { OVERHANG, type PaintPlan, type StallPaintSpec } from "./specs";
import type { StallScene } from "./stalls/common";
import { stall_geometry } from "./stalls/geometry";
import { resolve_dressing } from "./stalls/identity";
import { paint_back_layer, paint_front_layer } from "./stalls/kitchen";

export { stall_layout } from "./stalls/geometry";

/**
 * Plans a stall texture: one layer (or both, for `full`) of the stall at its rotation.
 *
 * @param spec - The stall spec.
 * @returns The plan, `width × (height + OVERHANG)` pixels of the rotated footprint.
 */
export function plan_stall(spec: StallPaintSpec): PaintPlan {
  return {
    width: spec.width,
    height: spec.height + OVERHANG,
    paint: (ctx) => {
      const scene: StallScene = {
        ctx,
        spec,
        geo: stall_geometry(spec),
        dressing: resolve_dressing(spec),
        seed: stableVisualHash(spec.definitionId),
        isLowDetail: spec.frame.isLowDetail,
        isHighContrast: spec.frame.isHighContrast,
      };
      if (spec.layer !== "front") paint_back_layer(scene);
      if (spec.layer !== "back") paint_front_layer(scene);
    },
  };
}
