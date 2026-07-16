---
title: Brand — ArgantaLab
product: ArgantaLabs
type: reference
status: living
tags: [brand, argantalab, prototype]
date: 2026-07-16
owner: Aldyth
confidence: high
---
# Brand — ArgantaLab (the prototype)

The first brand through the [[Brand OS]] mold. Source: the **ArgantaLab Instagram Profile Pack** (Downloads, 2026-07). Product context: [[ArgantaLabs]].

## Identity (from the pack)

- **Mark:** the Lab Core — gradient rounded-square, three-face cube, bright central core, orbit ring (derived from the repo's live cube logo; survives IG circular crop)
- **Palette:** Core Blue `#4D9FFF` · Lab Purple `#8B5CF6` · Spark Pink `#FF5EA0` · Signal Cyan `#34E5FF` · Growth Green `#3DE08A` · Quest Gold `#FFC24B` · Night Ink `#070A12` · Soft White `#F8FAFF`
- **Type:** Inter (must be embedded in the render engine — currently system-ui)
- **Persona:** **The Lab** — inventive, slightly mysterious, encouraging, always building. Faceless brand, recognizable character
- **Pillars:** Play the world · Learn the skill · Build the thing · Ship the result
- **Bio (recommended):** "Kids play. Learn. Build. Ship. 🎮 / KinQuest + AI creation tools. / Part of Arganta — the trusted family OS. / ↓ Enter the Lab"
- **Handle:** `@argantalab` — matches the connected Buffer channel exactly
- **Link:** `lab.arganta.app` ⚠ must be verified live before the bio ships

## Battle-test verdict (2026-07-16)

**Strong identity core, weak content system.** A profile pack, not yet a publishing system.

| ✅ Passes | ❌ Gaps |
|---|---|
| Avatar survives circular crop | No 9:16 story/reel covers |
| All dimensions IG-correct, SVG masters included | No per-pillar post templates |
| Bio fits 150 chars, 3 audience variants | No hashtag banks / caption formulas / CTA library |
| Handle = live Buffer channel | No alt-text guidance |
| `manifest.json` machine-readable | Inter not in canvas engine; grid monotone risk; link unverified |

## Pipeline collisions found — all fixed by [[Brand OS Build Plan|BF-3]]

1. ~~`postEngine.drawBrandLayer` hard-codes the KinetikCircle K-mark — every carousel queued to @argantalab carries the wrong logo~~ → **fixed**: the procedural K-mark is deleted; geometry lives in each brand's `identity.mark` and is drawn from data
2. ~~`@kinetikcircle` hard-coded in the CTA template~~ → **fixed**: the end card signs off with the doc's own handle
3. ~~No `argantalab` palette in `POST_PALETTES`~~ → **fixed**: `brandPalette()` maps `identity.palette` onto the engine's roles, per-role fallback
4. Lucky break confirmed: the engine's default plate `#FFD64B` ≈ Quest Gold `#FFC24B`, so ArgantaLab overrides it with one field and the yellow-pill rule fits unchanged

## What BF-2 canonization produces

`packages/brand/argantalab/` → `brand.json` (tokens) + `BRAND.md` (the L0.5 knowledge base: visual world in words, art direction, do/don'ts — the file any media AI reads) + `refs/` (pack covers as style anchors) + `prompts/` (ad-hero, reel-cover, OG-image briefs). Success test: **Higgsfield produces an on-brand asset from the pack alone, zero hand-holding.**

Wiring: [[Brand OS Integration Map]] · Execution: [[Brand OS Build Plan]]
