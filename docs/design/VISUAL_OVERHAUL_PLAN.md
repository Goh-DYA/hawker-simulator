# Visual overhaul plan: "Kopitiam Noon"

Status: In progress (October 2026). This plan drives the graphical overhaul recorded in [ADR 0005](../decisions/0005-painted-sprite-rendering.md). It changes only how the game looks; the simulation, commands, saves, content IDs and UI structure stay as they are.

## 1. What the audit found

The audit booted the game, opened the centre, spawned guests and inspected every surface at the default, minimum and maximum camera zoom.

| Surface | What is drawn today | Why it reads as barebones |
|---|---|---|
| Floor and walls | Flat two-tone checker of 48 px tiles with a 1 px grid stroke; the wall is a flat green band with a lighter bar | No material, no depth, no sense of a sheltered hall; the grid stroke dominates at every zoom |
| Stalls | A rounded rectangle, a flat "window" with tile lines, a strip of coloured awning shapes, a floating name label | Every stall is the same box with a different roof strip; the sign is a UI label, not part of the building |
| Furniture | Primary-shape silhouettes: an ellipse for a table, a circle for a stool, a rectangle for a bin | Shapes carry no material (laminate, terrazzo, stainless steel, timber) and no height, so tables and bins look alike |
| People | A rounded rectangle body and a circle head, two line arms, a status bubble | No facing, hair, hands or feet; walking is a two-line leg flick |
| Food | A coloured ellipse on an ellipse, scaled to 40% on counters | Dishes are unreadable at play zoom; variants are a tiny cue |
| Effects | A pulsing circle under lamps | No steam, light, time of day or feedback animation |
| Overlays | Square tile fills for placement, a dashed white line for the predicted route | Placement shows a coloured box rather than the thing being placed |
| HUD | A sound cream-and-forest card system | Catalogue thumbnails are text glyphs (▦ ◒ ✦); dish previews are CSS blobs; the shell does not share the world's materials |
| Performance | Every tick clears two Graphics objects and redraws every primitive; labels are destroyed and recreated each render | The debug panel reads 15 FPS at the maximum camera zoom on a small map, before any art is added |

## 2. Direction

**"Kopitiam Noon"**: a warm, painterly, top-down diorama of a sheltered Singapore hawker hall at lunchtime. The references are the clean, chunky, soft-shaded management games (Two Point Hospital, Overcooked, Good Pizza Great Pizza) and the readable top-down convention of RimWorld and Prison Architect, made specific to the hawker scene through its materials and furniture rather than through borrowed trade dress.

Principles, in order:

1. **Readability first.** Footprints stay exact on the 48 px grid. Seats, interaction cells and routes remain legible through silhouette and value, not only colour.
2. **One light, one perspective.** A 3/4 oblique view over the square grid: the camera looks down at the hall from the south at roughly 55 to 60 degrees, so horizontal surfaces (floor, table tops, counter tops, roofs) are foreshortened and the south-facing vertical faces of everything (counter fronts, table aprons and legs, seat legs, stall walls, people) are visible below them. Footprints stay exact on the grid (ADR 0002's grid stands); height rises upwards from a footprint into the overhang above it. Lit from the north-west, with a soft contact shadow to the south-east.
3. **Material over outline.** Terrazzo chips, laminate with a chrome edge, brushed stainless steel, zinc roofing, timber grain, moulded plastic and living foliage each have a recipe. Outlines are thin and tinted, never black.
4. **Singapore-specific, not generic.** Round plastic stools in red, green and blue; terrazzo and mosaic tile; zinc-ribbed stall roofs; backlit signboards with the stall name; roast ducks on hooks; kopi socks and long-spout kettles; charcoal satay grills with smoke; pandan and bougainvillea planters; drain gratings along the stall apron; tray-return stations; ceiling fans. No flags, no faux-script type, no real logos.
5. **Alive but calm.** Steam, fan rotation, lamp pools, a time-of-day tint, walk cycles and small sale feedback. Reduced motion freezes every cycle and keeps the still frame; high contrast thickens outlines and raises the floor value separation.

### Palette

The Art Bible palette is kept and extended with material tones.

| Role | Hex | Use |
|---|---|---|
| Plaster | `#F4E7D3` | Base floor tone |
| Terrazzo chip | `#D9C7A8`, `#B9A58A`, `#E9DECB` | Floor speckle |
| Grout | `#CDBB9C` | Tile joints |
| Teal steel | `#167D7F` → `#0F5F61` | Structure, wall band, pillars |
| Zinc | `#9AA8A6` → `#5E6D6B` | Stall roofs, extractors |
| Stainless | `#C9D3D0` → `#7E8B88` | Counters, tray returns, bins |
| Laminate | per recipe accent, with `#F3EEE3` highlight | Table tops |
| Timber | `#B07A47` → `#6B462D` | Benches, trestles, signs |
| Ink | `#263238` | Text on signs |
| Deep shadow | `#18323B` | Shadows at 14 to 26% alpha |
| Vermilion / mustard / leaf | `#D95D39` / `#D5A021` / `#4F7D4A` | Accents and foliage |
| Lamp light | `#FFD98A` | Light pools, sign glow |

### Perspective cheat sheet

- A tile is about one metre, 48 world pixels. Objects keep real-world scale inside their footprint: a hawker stool seat is about 18 px across, a chair about 24 px, a 1×1 table top about 40 px, so a stool never looks as big as a table and the rest of its tile reads as floor.
- An object texture is its rotated footprint plus 16 px of overhang above it (`OVERHANG`). Height rises upwards: a table's top surface is its footprint lifted by `TABLE_TOP_LIFT` (12 px) with the apron and legs in the strip below; a seat's sitting surface is centred `SEAT_HEIGHT` (8 px) above its tile centre; a stall's back wall rises from its north edge into the overhang.
- Textures are painted per rotation and the sprite is never rotated, so light, shadows and front faces stay consistent. Symmetric objects ignore the rotation; directional ones (chairs, benches, booths, signs, counters, long tables, stalls) are drawn in their rotated orientation. A chair at rotation 0 has its backrest to the north and faces south; each quarter turn turns it clockwise. A stall at rotation 0 serves to the south, at 90 to the west, at 180 to the north and at 270 to the east.
- Stalls are cutaway buildings in two layers: the back layer holds everything behind the vendor (back wall, shelves, equipment, interior floor, canopy), the front layer everything in front (counter top and front, the near walls cut low), so the counter hides the vendor's legs. Walls between the camera and the interior are cut down to counter height.
- People are 3/4-view figures about 34 to 44 px tall depending on stature, with legs and shoes, a face on the south and side views, hair from behind on the north view, slim, average or broad builds, and trousers, jeans, shorts, skirts or long skirts. Sheets hold the south, north and east views; west is the east view mirrored. Three walk frames, a seated frame whose hips sit `SEAT_HEIGHT` above the feet line, and carrying frames with a level tray.
- Diners sit on their seat with the meal on the table top: the plate is placed just inside the table edge nearest the diner, lifted by `TABLE_TOP_LIFT`, and sorts in front of the table.
- Contact shadow: an ellipse or rounded rectangle offset (+3, +5), blurred 6 to 8 px, alpha about 0.22.

## 3. Rendering architecture

### From immediate-mode primitives to painted sprites

| Layer | Before | After |
|---|---|---|
| Art source | Phaser `Graphics` calls repeated every tick | Pure Canvas 2D painters in `src/game/runtime/art/`, drawn once per texture key at device pixel ratio |
| Scene graph | Clear and redraw everything | Retained Phaser sprites keyed by object or customer ID; the floor is one painted texture redrawn only on map or route-guide change |
| Labels | Phaser `Text` destroyed and recreated each render | Stall names baked into sign textures; the few live counters (queue counts, access points) are retained `Text` objects updated in place |
| Overlay | `Graphics` | Still `Graphics` (cheap and dynamic), plus a ghost sprite of the object being placed |
| Effects | None | A small pool of tinted sprites for steam, light pools and sale feedback |

The painters are pure functions over a `Canvas2D`-shaped interface, so they run in Node against a recording context: the headless render goldens keep working, and a new suite checks that every launch stall, placeable, dish and archetype paints without error and paints something distinct from its neighbours.

### Modules

```
src/game/runtime/art/            Phaser-free painters (Canvas 2D)
  canvas.ts                      Painter interface, seeded speckle, rounded paths, gradients,
                                 soft shadows, bevels, material fills, text
  floor.ts                       Hall floor, walls, pillars, aprons, drains, portals, expansion bays
  stalls.ts                      Fourteen stall fronts: roof, sign, counter, props, shutter
  furniture.ts                   Tables, seats, fixtures, tray and waste points, lighting, fans,
                                 plants, signage, dividers, facilities, decor
  people.ts                      Customer and vendor sprite sheets (facing × frame)
  food.ts                        Dish servings and nutrition variant cues
  effects.ts                     Steam puff, light pool, sparkle, selection ring
src/game/runtime/render/
  textures.ts                    TextureStudio: key → painted CanvasTexture, cached per scene
  scene.ts                       Scene, layers and camera (contract unchanged)
  world.ts                       Retained floor, object, people and effect sprites, diffed per render
  overlay.ts                     Queue paths, reserved seats, placement ghost, hover, debug footprints
  atmosphere.ts                  Time-of-day tint and lamp pools
  art.ts                         ID-keyed style tables (unchanged contract)
  stall.ts                       displayDishIdsForStall, stallServiceVisualState (unchanged)
```

`visuals/*` (the deterministic recipes) stays the identity layer; the painters read recipes and style tables and add material and construction on top.

### Layering and lint

The import rules do not change: `art/` and `render/` import Phaser as a type only (and `art/` not at all), `app/` may not import either, and `core/` is untouched. The build catalogue gets real thumbnails through a new `RuntimeController.renderPreview(definitionId)` method, which returns a data URL painted by the same painters once the runtime has loaded, so the HUD never imports render code.

## 4. Work packages

| # | Package | Scope | Done when |
|---|---|---|---|
| A | Painter toolkit | `art/canvas.ts`, palette extensions, `TextureStudio`, recording-context test helper | Primitives unit-tested; studio caches and refreshes textures per scene |
| B | Hall | Floor texture with terrazzo, zones, grout, drains, wall parapet, pillars, portals, expansion bays; atmosphere tint; lamp pools | New centre reads as a sheltered hall at every zoom |
| C | Stalls | Fourteen distinct fronts with baked signboards, roofs, counters, props, vendors, steam, shutters and an open/closed state | Every stall is identifiable at the default zoom without its label |
| D | Furniture | Eleven category painters covering all 80 placeables with their style-table branches | Each ID paints a distinct texture; tables, seats and bins are unmistakable |
| E | People | Customer sheets (6 silhouettes × 5 patterns × appearance × 4 facings × frames), vendor sheets, trays, indicators, patience arc | Guests have facing, gait and carried food; selection ring and indicators survive |
| F | Food | 54 dishes at counter and table scale, eaten-fraction frames, 14 variant-family cues | Dishes are readable on a tray at play zoom |
| G | Overlay and feedback | Placement ghost sprite, queue path, reserved seat, hover, route guides, selection glow, sale sparkle | Placement shows the item in place, tinted valid or invalid |
| H | HUD | Catalogue and dish thumbnails from the runtime; refreshed CSS tokens, cards, buttons, tutorial art and loading state | The shell shares the world's materials; thumbnails match placed objects |
| I | Tests and docs | Extended Phaser stub, regenerated render digests, painter suites, ADR 0005, Art Bible, Technical Design, Changelog, Tech Debt, screenshots | `npm run test:release` passes; the docs name only paths that exist |

## 5. Risks and mitigations

- **Golden churn.** The draw-call digests in `createHawkerRuntime.render.test.ts` will change once, intentionally, in the commit that lands the new renderer; the commit says so. The painter suites then pin the new output.
- **Texture memory.** Textures are created lazily per key and released with their scene. Customer sheets are small (about 48×64 px per frame at 1×) and are destroyed when a guest leaves.
- **Lower-end mode.** Lower-end quality skips steam and light pools, uses 1× texture scale and the two-frame walk.
- **Determinism.** Painters take seeds from the recipes and never read the clock; animation phase comes from the simulation tick as before.
- **Cultural review.** The direction keeps the Art Bible's rules on identity, skin tone and motif; the human visual and cultural review remains open and is listed in `KNOWN_ISSUES.md`.
