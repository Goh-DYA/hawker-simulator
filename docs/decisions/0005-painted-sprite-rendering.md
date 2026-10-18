# ADR 0005: Painted Sprite Rendering

Date: 2026-10-18
Status: Accepted

## Context

ADR 0002 chose shape-led, vector-like illustrated 2D on an orthographic top-down grid, authored as code-native recipes. The first implementation drew those recipes as Phaser `Graphics` primitives, cleared and redrawn on every simulation tick. The result was functional but barebones: furniture and people were primary shapes, food was unreadable at play zoom, stalls were identical boxes with different roof strips, and the per-tick redraw limited the frame rate at high camera zoom.

A graphical overhaul was commissioned with the constraint that the game mechanics, saves and content IDs stay unchanged.

## Decision

Keep the square grid and the code-native, license-clean medium of ADR 0002, but show the grid in a 3/4 oblique view instead of a flat top-down one, and change the rendering medium from immediate-mode vector primitives to **painted sprites**. This reverses the rendering-perspective part of ADR 0002: the grid, footprints and hit testing are unchanged, but objects and people now show their south faces and height. Player feedback on the first painted pass (flat stalls, figures without legs or faces, seats as large as tables) showed that the flat top-down view could not read as realistic.

The decision in detail:

- Pure Canvas 2D painters in `src/game/runtime/art/` paint each stall, placeable, person, dish, floor and effect once per texture key, at device pixel ratio, with gradients, soft shadows, materials and baked sign text.
- Phaser renders retained sprites keyed by object and customer ID. The floor is one painted texture redrawn only when the map or route guides change. Overlays stay as `Graphics`.
- A 3/4 oblique view over the unchanged grid: horizontal surfaces are seen from above, south faces are visible, height rises upwards into a 16 px overhang above the footprint, and the light comes from the north-west with a soft contact shadow to the south-east. Footprints stay exact. Textures are painted per rotation and sprites are never rotated; stalls are painted as a back and a front layer with the vendor sprite between them; people are 3/4-view figures with legs, faces and varied builds, sitting on seats with their plates on the table top.
- Atmosphere (time-of-day tint, lamp pools, steam) is additive presentation and never feeds the simulation.

The HUD receives thumbnails painted by the same painters through the runtime controller, so the UI layer still never imports render code.

## Rationale

Painted textures give the fidelity of illustrated sprites (soft shading, material detail, legible food) while staying procedural, deterministic and free of third-party art. Retained sprites remove the per-tick redraw cost. Keeping the square grid preserves placement clarity and the accessibility overlays that ADR 0002 valued, and avoids any change to hit testing or the save format; the oblique view adds the height, faces and scale cues a flat view cannot carry, at the cost of painting directional objects once per rotation.

## Consequences

- `docs/design/ART_BIBLE.md` gains the perspective cheat sheet, material recipes and animation frames of the new medium; `docs/design/VISUAL_OVERHAUL_PLAN.md` records the audit and the work packages.
- The draw-call digests in `tests/game/runtime/createHawkerRuntime.render.test.ts` change once with this decision; painter suites pin the new output.
- The headless Phaser stub grows texture and sprite stand-ins.
- Human visual and cultural review of the new art remains open, as before.
