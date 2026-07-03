# Kingdom of Kin — AI Pixel-Art Pipeline

> How pixel art gets **made** (AI-generated, consistently, at volume) and **fed into** the PixiJS renderer. Researched July 2026.
>
> Clarification: this is an *asset pipeline*, not a renderer. PixiJS v8 draws the sprites at runtime; this pipeline produces them. They meet at the texture atlas + the existing art seam.

---

## Verdict: PixelLab as the generation engine

**Primary tool: [PixelLab](https://www.pixellab.ai/)** — purpose-built for game pixel art, and it matches the exact shape of our catalog:
- 4/8-directional characters from text (top-down / RO perspective).
- Animations (idle/walk/attack) via skeleton or text prompt → sprite sheets.
- Tilesets, environment tiles, isometric/top-down maps.
- **Style consistency via reference images** — the single most important feature for a coherent game.
- REST API + Python SDK (PixFlux/BitForge image gen, animation, inpainting, rotation) + an **MCP server** (drive it from Claude Code / Cursor).

**Why not just hand-draw or use a generic diffusion model:** volume (hundreds of sprites) + consistency (they must look like one game) is exactly what PixelLab's reference-conditioning + character/direction endpoints solve, and generic image models don't produce clean, palette-locked, directional game sprites.

**Supporting tools:**
- **Aseprite** — the human-in-the-loop editor for cleanup + hero-asset polish. PixelLab ships an Aseprite plugin; also `willibrandon/pixel-mcp` drives Aseprite programmatically via MCP.
- **Retro Diffusion** (Aseprite extension) — optional *offline / one-time-purchase* generator if we want local generation without per-call API cost.
- **TexturePacker** or free-tex-packer — pack sprites into atlases for Pixi.

---

## The core idea: a data-driven sprite factory

Our content is already data. `kin.ts` / `mounts.ts` / `regions.ts` hold every entity's name, color, element and blurb. So the pipeline turns **data rows into art prompts** — we don't commission sprites one by one, we generate them from the catalog we already wrote. One source of truth for both stats AND art prompts.

```
kin.ts row  →  PixelLab prompt (blurb + locked palette + style-reference.png)
            →  sprite PNG (idle + hit, optionally 4-dir walk)
            →  texture atlas
            →  existing art seam (KinSprite render key / installAtlas atlas pack)
            →  PixiJS renders it — zero engine change
```

Example — the `Countfox` row (`'A sandy fox that counts its steps'`, `#f59e0b`, element `pattern`) → *"48×48 top-down pixel sprite, sandy desert fox, warm amber palette, [style-ref.png], idle + hit frames."* Its evolution chain (Calcufox → Primefox) reuses the same reference for a consistent family.

---

## Pipeline phases

### Phase A — Style Lock (do FIRST, once; the whole thing depends on it)
The #1 risk with AI art is inconsistency. Kill it up front:
- Fix the **constraints**: character canvas (e.g. 48×48 or 64×64), tile size (16 or 32), perspective (top-down 3/4, Nexus/RO style), outline treatment.
- Lock a **~32-colour palette** aligned to the ArgantaLab brand.
- Generate a small **style bible**: ~5 reference sprites (a Kin, a hero, a ground tile, a building, a mount). Iterate in PixelLab until the LOOK is right. These references feed EVERY future generation.
- Nothing else generates until the style bible is signed off.

### Phase B — Pipeline plumbing
- PixelLab API key + Python SDK (or the MCP for in-session gen).
- `scripts/genSprites.mjs` (or `.py`): reads the content catalogs, builds a prompt per row (name + blurb + palette + style-ref), calls PixelLab, writes PNGs to `art/raw/`.
- Atlas step: pack `art/raw/` → `art/atlases/*.png + *.json`.
- Seam step: register atlas render keys so the existing `KinSprite` / `installAtlas()` seam resolves them (no engine change).

### Phase C — Human polish (AI does volume, humans do heroes)
- AI generates the long tail: ~144 Kin, biome tiles, generic buildings.
- Aseprite touch-up + hand-tuning on the **signature pieces**: the 6 Keepers' aces, the corrupted **Naga**, the 6 class heroes, key UI. These are the moments that carry the game — worth a human pass.

### Phase D — Automation via MCP
- Install the **PixelLab MCP** so Claude Code can generate/iterate sprites directly in-session (great for prototyping + filling gaps). Requires the user's PixelLab API key (paid credits).
- For production batch volume, use the scripted SDK pipeline (Phase B) rather than interactive MCP calls.

---

## Honest caveats
- **Consistency isn't automatic.** Reference-conditioning + a locked palette get you most of the way; expect a human cleanup pass, especially on hero assets and animation frames. Budget for it.
- **Cost.** PixelLab is paid (credits/API). A batch of hundreds of sprites is a real but modest cost — cheaper than an artist for volume, but an artist is better for signature pieces. Split accordingly: **AI for the long tail, AI+human for the hero moments.**
- **Animation depth.** Simple idle/walk/attack is well within PixelLab; rich multi-frame combat animation is where hand-polish earns its keep.
- **It's a pipeline, not magic.** The renderer (PixiJS) and the seam (`KinSprite`/`installAtlas`) are the fixed rails; PixelLab just fills them faster than hand-drawing.

---

## First concrete step
Lock the **style bible** (Phase A) — ~5 reference sprites + the palette + canvas sizes. Everything else is a factory once that's fixed. If we install the PixelLab MCP (needs the API key), Claude Code can generate the first candidate reference sprites in-session to kick it off.

## Sources
- [PixelLab](https://www.pixellab.ai/) · [PixelLab API](https://www.pixellab.ai/pixellab-api) · [PixelLab MCP](https://github.com/pixellab-code/pixellab-mcp) · [Python SDK](https://pypi.org/project/pixellab/) · [character options / directions](https://www.pixellab.ai/docs/options/character)
- [pixel-mcp — Aseprite via MCP](https://github.com/willibrandon/pixel-mcp) · [Retro Diffusion (Aseprite extension)](https://astropulse.itch.io/retrodiffusion)
