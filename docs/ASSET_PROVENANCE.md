# Asset Provenance Register

Status: Content `1.3.0` source inventory and automated recipe validation updated; human visual, cultural, and legal review pending

## Policy

All shipped art and audio must be original and reproducible from repository source or accompanied by explicit compatible license evidence. Research/reference images are never copied into runtime assets. Real hawker brands, centre layouts, menu boards, certification marks, photos, logos, music, and recordings are excluded without written permission.

| Asset class | Intended source | Runtime form | License / rights | State |
|---|---|---|---|---|
| World and expansion boundaries | Original TypeScript/Phaser procedural geometry following ART_BIBLE.md | Canvas-generated floors, walls, entrance, and exit | Project-original | Implemented; repeated-expansion development-browser evidence captured; exact-production review pending |
| Stalls and placeables | Original semantic recipes in `src/game/runtime/visuals/` (`placeable.ts` and `vendor.ts`) and procedural renderers in `src/game/runtime/render/` | Canvas geometry plus CSS catalogue previews | Project-original | Content `1.3.0` defines and automatically validates 14 stall identities and 80 placeables; exhaustive browser and human visual/cultural review remains open |
| Characters and reactions | Original modular procedural recipes with archetype and lifecycle-state variants | Canvas geometry | Project-original | Exactly 12 archetype appearances and 11 state poses covered by automated tests; moving/reduced-motion signatures present; human visual review pending |
| Food and vessels | Original dish recipes derived from authored food sprite, container, portion-colour, and steam metadata; factual reference only | Canvas geometry | Project-original | Content `1.3.0` defines and automatically validates 54 dishes with authored food/vessel metadata; the complete browser gallery and human visual/cultural review remain open |
| Queue overlays and editor | Original runtime geometry and DOM controls | Canvas lines/cells/badges plus HTML controls | Project-original | Counts, automatic routes, cardinal directions, bends, and saved custom paths implemented; development-browser screenshots captured |
| UI icons | Original geometric SVG/CSS | SVG/CSS | Project-original | Implemented |
| App icon | Repository-authored SVG | public/icons/icon.svg | Project-original; final visual review pending | Present |
| Social share card | Original fictional hawker-centre illustration for social previews | public/og.png, 1731 × 908, SHA-256 `F372FE01C02080F235962DB6FD70C76D95970CBC51018C2927C13F13A2D10F06` | Project-original | Present; text/composition inspected, human similarity/brand/cultural review pending |
| Environment/background | Original Community Courtyard kit | Canvas geometry | Project-original | Implemented; visual review pending |
| Adaptive music, ambience, and audio cues | Repository-authored deterministic synthesis in `src/game/audio/AudioDirector.ts`; filtered oscillators, seeded phrase cycle, state-aware layers, and bounded gain buses | Web Audio nodes generated at runtime; no recorded or downloaded assets | Project-original | Implemented; automated lifecycle checks and human browser/peak-level review pending |
| Fonts | System font stack | No bundled font | Platform-provided | Implemented |
| Dependencies | npm lockfile packages | Bundled code | See THIRD_PARTY_NOTICES.md and package license files | Locked; npm audit results are recorded in [TEST_REPORT.md](TEST_REPORT.md#dependency-audit); legal review pending |

Development-browser screenshots are verification artifacts rather than shipped art. They are retained in a local archive outside the repository and indexed in `GRAPHICS_VERIFICATION.md`.

## Per-asset required fields

Before an external or generated file is accepted, add:

- asset ID and exact path;
- creator/tool and creation date;
- source recipe/project file where applicable;
- source references and confirmation that no protected source was copied;
- license, attribution text, and license file/path;
- modifications;
- cultural/brand review status;
- final reviewer/date and runtime references.

## Release audit

- [ ] Every authored placeable, all 14 stalls, all 54 dishes, each archetype, and each lifecycle state expected by content `1.3.0` is represented in automated recipe inventories that pass on the supported runtime.
- [x] Development-browser captures exercise the starter scene, live service/food, queue overlays/editor, and repeated expansion geometry.
- [ ] Every runtime visual/audio path has a register row or is generated from registered code.
- [ ] No orphaned, test, debug, or starter asset ships.
- [ ] No real logo, certification mark, recognizable stall trade dress, or copied menu.
- [ ] Required notices and full licenses are bundled/published.
- [ ] Human cultural and visual review is recorded.
