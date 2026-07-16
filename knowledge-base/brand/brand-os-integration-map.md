---
title: Brand OS Integration Map
product: Arganta (all brands)
type: reference
status: living
tags: [brand, architecture, integration]
date: 2026-07-16
owner: Aldyth
confidence: high
---
# Brand OS Integration Map — what reads the registry

Every connection below replaces a hard-coded brand fact with a registry read. Add a sixth brand and all of these light up for it automatically.

## The wiring table

| # | System | What it consumes | Layer | Today (before) | After |
|---|---|---|---|---|---|
| 1 | ✅ **Content Builder / Post Studio** (`apps/hq/src/surfaces/broadcast`) | Brand mark, palette, plate colors, fonts via `postEngine`; brand switcher in the top bar. *(Pillar templates still to come — BF-7)* | L0 + L3 | ~~K-mark + `@kinetikcircle` hard-coded; single palette set; yellow plate global~~ | **Shipped BF-3**: `doc.brandId` → `RenderEnv.brand`; every slide brand-correct. The render path reads only agent-lane fields, so it needs no DB |
| 2 | ✅ **Arganta Core worker + MCP** (`workers/arganta-core-content`, `tools/arganta-core-mcp`) | `content_draft(brand, lang)` → `voiceBlock` (persona, pillars, CTAs, hashtag banks, touchy rules) into the copy prompt; `kb.artDirection` into the image prompt; `brand_get` / `brand_update` tools | L0.5 + L1 | ~~No brand concept — one generic voice~~ | **Shipped BF-5**: copy written *as* the brand, EN or ID; backgrounds art-directed. The MCP owns the DB credentials and resolves the brand; the worker stays a stateless generator that knows no brands. ⏳ needs `wrangler deploy` |
| 3 | **Buffer → Instagram** (`buffer.js`, `bufferClient.ts`) | Per-brand channel map (channelId ↔ brand); queue-only safety unchanged | L2 | One channel (`argantalab`) implicitly global | Route each draft to its brand's channel |
| 4 | **Kinetik Moments** (`momentPublish.ts` + brand-sender RPC) | Per-brand sender profile — the "Kinetik Circle" brand author pattern, repeated ×5 | L2 | One brand sender (Kinetik Circle, shipped 2026-07-16) | `brandId` → sender profile id |
| 5 | **Video Builder** (`apps/hq/src/surfaces/video`, `@arganta/video`) | Watermark corner mark, intro/outro motion rules, end-card, **audio mark sting** | L0 | No branding on exports | Every MP4 opens/closes on-brand |
| 6 | **Music Studio / @arganta/audio** | Authoring seam for the five audio marks | L0 | — | Stings stored as registry assets |
| 7 | **Higgsfield MCP + media-core** | L0.5 KB: `BRAND.md` + `refs/` + `prompts/` briefs fed to `generate_image/video/audio`; outputs land back as registry assets | L0.5 | Ad-hoc prompting per session | Any media API is on-brand from the pack alone |
| 8 | **Landing app** (`apps/landing`) | L4 discovery: meta/OG/schema.org/llms.txt per brand; L0 tokens for the site theme | L0 + L4 | Hand-maintained | Generated from registry; Landing rename = one field |
| 9 | **HQ Vault** (`knowledge-base/`) | These notes — concept + decisions live in the same Obsidian KB the vault renders | — | — | Single documentation home |
| 10 | **Growth / Portfolio analytics** | Brand dimension on `agent_runs` ledger rows (`domain:'social'` gains `brandId`) | — | Ledger rows unattributed | Per-brand publishing history in Model Rack |
| 11 | **Campaign automation** (30-day plan, [[ArgantaLabs]] cup seasons) | L5 spines drive daily `content_draft` briefs; playbooks per brand | L5 | Campaign written per-session in chat | Rhythm is data; Claude executes it |
| 12 | **Brand Forge deck** (new surface, HQ Build group) | Renders and edits ALL of the above per its lane | all | — | The cockpit |

## The consistency loop (end to end)

```
L5 spine: "Build-Log Monday"
  → MCP content_draft(brand: argantalab, pillar: build)
  → worker writes copy AS The Lab (L1 persona + formula + hashtags)
  → draft composes with L0 mark/palette/plate + L3 template
  → founder approves once in HQ (Post Studio)
  → Buffer queue (human gate) → Instagram
  → ledger row with brandId → Growth
```

## Non-goals (deliberate)

- Brand Forge does **not** publish — Post Studio owns publishing.
- Brand Forge does **not** track follower analytics — Growth owns performance.
- No platform credentials stored — the matrix tracks *state*; Buffer-connected channels verify automatically, the rest are founder checkmarks.

Master note: [[Brand OS]] · Execution: [[Brand OS Build Plan]] · Prototype: [[Brand — ArgantaLab]]
