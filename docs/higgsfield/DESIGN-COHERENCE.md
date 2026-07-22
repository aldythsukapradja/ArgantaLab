# Design Coherence — how every visual "talks to each other"

The rule that makes ~700 overnight generations feel like **one design system** instead of 700 unrelated images. This is the difference between a coherent brand and a pile of AI art. Enforced by the autonomous driver (`AUTONOMOUS-RUN.md`).

## The principle: one visual DNA, shared anchors
Nothing is generated in isolation. First we create a small set of **anchors**; then **every** later generation references them — same palette, same lighting, same material language, and a *literal shared reference embedding*. Coherence is structural, not hoped-for.

## Phase A — Anchors (generated FIRST, gate everything else)
The driver will NOT start Phase B until these exist:
| Anchor | Built from | Becomes |
|---|---|---|
| **Brand Style Element** | best 3–4 master brand-world frames (IB3) | the master look every image/video references |
| **Reactor Element** | best reactor hero frame (VB1/IB4) | reactor DNA for films, web, energy |
| **Energy Element** | best subsurface/cosmic frame (IB7) | ArgantaEnergy visual language |
| **5 persona Souls** | IB0 bootstrap sets | identity lock for all influencer content |
| **STYLE suffix + tokens** | `docs/arganta-design-system/Design-Language.md` | appended to every prompt |

Elements are created via `show_reference_elements(create)`; Souls via `show_characters(train)`. Both return IDs the driver stores in `queue.json`.

## Phase B — everything references the anchors
Every Phase-B prompt embeds the relevant anchor Element(s) as `<<<element_id>>>` + the STYLE suffix. Cross-reference matrix:

| Batch | References |
|---|---|
| Influencer looks/scenes/reels (IB1/IB2/VB4/VB5) | persona **Soul** + STYLE |
| Branding / logo / icons (IB3) | **Brand Element** + STYLE |
| Reactor renders/films (VB1/E) | **Reactor Element** + STYLE |
| App components ×5 (IB5) | **Brand Element** (per-app light) + STYLE |
| Website (IB6, VB6) | **Brand Element** + **Reactor Element** + STYLE |
| Cinematic films (VB3, VB8, Track I) | **Reactor** + persona **Souls** + **Brand** |
| Cosmic/energy/subsurface (IB7, VB7) | **Energy Element** + STYLE |
| Avatars 3D (J-3D) | **Brand Element** (chibi/heroic) + STYLE |

Result: the logo shares DNA with the app icons, which share it with the website, which shares it with the films, which share it with the reactor. **They all talk to each other.**

## Coherence QA (in the loop)
- The driver periodically samples finished outputs; if a batch drifts (wrong palette/feel), it re-fires that item with the anchor Element weighted higher.
- Optional end-of-run **coherence critic**: one agent reviews a contact sheet of all hero assets and flags any outlier to regenerate.

## The single source
All anchors derive from `docs/arganta-design-system/` — palette, type, motion, reactor. That vault is upstream of Higgsfield AND of the PixelLab run (`PIXELLAB-RUN.md`), so 2D pixel, 3D, and cinematic all trace to the same tokens.

**Machine source = `@arganta/brand`.** The per-brand facts (palette, `kb.artDirection`, mark) live in the brand registry — the SAME one HQ Brand Studio renders (WF1 endorsed house: `arganta`, `argantalife`, `argantaenergy`, `argantastudio` + products). The run reads each brand's `artDirection` into its Brand Element and writes finished assets back to that brand's registry slot. So the automated flow and HQ share one source; neither drifts.
