# Asset Provenance Register

Status: Working register; final audit pending

## Policy

All shipped art and audio must be original and reproducible from repository source or accompanied by explicit compatible license evidence. Research/reference images are never copied into runtime assets. Real hawker brands, centre layouts, menu boards, certification marks, photos, logos, music, and recordings are excluded without written permission.

| Asset class | Intended source | Runtime form | License / rights | State |
|---|---|---|---|---|
| World, stalls, furniture | Original TypeScript/Phaser procedural geometry following ART_BIBLE.md | Canvas-generated shapes | Project-original | Implemented; visual/cultural review pending |
| Characters and reactions | Original modular procedural shape recipes | Canvas geometry | Project-original | Implemented; visual review pending |
| Food and vessels | Original simplified shape recipes; factual reference only | Canvas geometry | Project-original | Implemented; cultural review pending |
| UI icons | Original geometric SVG/CSS | SVG/CSS | Project-original | Implemented |
| App icon | Repository-authored SVG | public/icons/icon.svg | Project-original; final visual review pending | Present |
| Social share card | Original fictional hawker-centre illustration for social previews | public/og.png | Project-original | Present; human similarity/brand/cultural review pending |
| Environment/background | Original Community Courtyard kit | Canvas geometry | Project-original | Implemented; visual review pending |
| Audio cues/ambience | Repository-authored Web Audio synthesis | Web Audio nodes | Project-original | Implemented; browser/audio review pending |
| Fonts | System font stack | No bundled font | Platform-provided | Implemented |
| Dependencies | npm lockfile packages | Bundled code | See THIRD_PARTY_NOTICES.md and package license files | Locked; automated audit passed; legal review pending |

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

- [ ] Every runtime visual/audio path has a register row or is generated from registered code.
- [ ] No orphaned, test, debug, or starter asset ships.
- [ ] No real logo, certification mark, recognizable stall trade dress, or copied menu.
- [ ] Required notices and full licenses are bundled/published.
- [ ] Human cultural and visual review is recorded.
