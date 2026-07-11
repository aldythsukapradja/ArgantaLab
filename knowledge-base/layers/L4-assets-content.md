---
title: L4 · Assets / Content
type: layer-tracker
layer: assets-content
status: living
health: amber
maturity: high-volume
leverage: medium
date: 2026-07-11
tags: [arganta, layer, assets, content, pixel, curriculum]
cssclasses: [wide-tables]
---

# L4 · Assets / Content — the pixel & curriculum layer

> [!abstract] Health: 🟡 high-volume, undisciplined · Leverage: 🟡 medium
> **34,768 PNG · 5,254 GIF · 472 WAV · 132 MP3** plus a 350 KB curriculum seed. Huge output from the PixelLab pipeline and the Pixel Vault — but it's the layer carrying the repo's worst debt: the same art committed **three times**, which is what makes `.git` 939 MB.

## Baseline state (2026-07-11)

- **Pixel:** 34,768 PNG + 5,254 GIF. Generator = PixelLab MCP (`.mcp.json`); catalogue = **Pixel Vault** (`pixel_asset` + `pixel_palette`, license-tiered, 7 MCP query tools). Sources: PixelLab + Kenney CC0 (~1,726) + opt-in Lospec palettes.
- **Audio:** 472 WAV + 132 MP3 via `@arganta/audio` + `audio_library`/`music_library` tables.
- **Curriculum:** 13 content packs (`contentPack2…14`) + `seed_content.sql` (350 KB) — Cambridge Primary aligned.

> [!bug] The 3× duplication is real (verified)
> ```
> apps/kingdom/data/client/monsters/            4,026 PNG
> apps/kingdom/dist_site/data/client/monsters/  4,026 PNG   ← build output, committed
> apps/lashira/web/art-mirror/monsters/         4,026 PNG   ← mirror
> ```
> Same triple for effects / hairdec / body. This single pattern is the root cause of debt **D2** (939 MB `.git`).

## Maturity × Leverage
- **Maturity 🟡 high-volume** — enormous quantity, low *discipline* (dup, committed build output). Content is broad but **unvalidated by any educator**.
- **Leverage 🟡 medium** — assets make the games look shipped; they don't make a stranger show up. Curriculum leverage is real *but gated* on educator validation.

## What changed
*Baseline — the zero point.*
- `2026-07-11` — baseline: 34,768 PNG, 3× monster dup confirmed, 13 content packs.

## Lessons
- [[reuse-the-spine-dont-rebuild]] — mirrors/copies of assets are the same "copy-now-extract-later" debt as the engine copy.
- **AI art is strong on tiles, weak on motion** (from P6/P7) — the overnight PixelLab run produced 82 usable stills; walk-cycle/animation needed hand-wiring.

## Debt & risks
- **D2 (🔴 high)** — 939 MB `.git` from committed art + build output.
- **D3 (🔴 high)** — 3× duplication; one canonical `data/` + `VITE_*_DATA_BASE` + CDN fixes it.
- Content has **no educator validation** — the credibility gate for ArgantaLabs.

## Wayforward
1. **One canonical asset base + CDN.** Delete `dist_site/data` and `art-mirror` from git, `.gitignore` build output, point apps at `VITE_*_DATA_BASE`, BFG the history. Collapses D2 + D3 together.
2. **Get one educator to validate one content pack.** Curriculum leverage is locked until someone outside the household vouches for it.
3. Wire the Pixel Vault as the single source for new art (don't re-import into app trees).

## Links
[[00-stack]] · [[00-MASTER-KB#7 · Asset Pipeline]] · `supabase/PIXEL_VAULT.md` · [[L2-engine-spine]]
