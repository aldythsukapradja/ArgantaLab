# PixelLab Run — ArgantaLab avatars (separate, dedicated agent)

A **fully separate run** from the Higgsfield overnight — own subscription (PixelLab, ~1,561 gens), own clock, own dedicated agent. It must still feel like the **same Arganta design system** (`docs/arganta-design-system/`). Zero impact on the Higgsfield trial budget.

## Why separate
- Different provider + billing (PixelLab subscription, not Higgsfield credits).
- Different medium (pixel sprites) with its own generation pipeline (`create_character`, `animate_character`).
- Runs whenever — before, during, or after the Higgsfield night — without competing for the 1-video/1-image lanes.

## Dedicated agent
Spawn one agent (Agent tool) scoped ONLY to the PixelLab MCP + this brief. It generates the roster, keeps style params identical across every character, animates, tags, downloads to the PixelLab git project, and reports a contact sheet. It does not touch Higgsfield.

## Pixel Style Brief (design-feel lock — derived from [[Design-Language]])
Pixel art can't use the cinematic palette literally, so we translate the system:
- **Hero-path colors = company lights:** the 4 ArgantaLab hero paths map to `gold #E8B64C · coral #FF7A59 · energy-blue #2E7CF6 · violet #A06CE8` as primary garment/accent colors → instantly on-brand and mirrors the 3D avatars (J-3D) 1:1.
- **Neutrals:** ink/platinum for outlines and armor accents.
- **Proportions:** `heroic` for older kids / `chibi` for young — one choice, applied to the whole roster for consistency.
- **Outline/shading:** `selective outline` + `medium shading`, identical across all → the roster reads as one set.
- **View:** `low top-down` (classic 3/4 RPG) to match KinQuest + LashiraBloom.
- **Mode:** `v3`, 8 directions, size 64.

## Roster (fixed params → guaranteed cohesion)
- **16 base kid heroes** — diverse (boy/girl, 4 skin tones, varied hair) × the 4 hero paths. Same style params on every call.
- **Animations** per hero: walk + idle (`animate_character`).
- Optional: 4 companion creatures (quadruped templates) in the same palette.
- Est ~80–120 PixelLab generations — well within the 1,561 remaining.

## Coherence with the whole system
- Same hero-path colors + archetypes as the **J-3D** Higgsfield avatars → pixel and 3D avatars are the *same characters* in two mediums.
- All trace to `docs/arganta-design-system/` tokens, same as every Higgsfield asset (see `DESIGN-COHERENCE.md`).

## Launch
Say **"start the pixel avatar run"** → I spawn the dedicated PixelLab agent with this brief. Independent of the Higgsfield trial — can run today.
