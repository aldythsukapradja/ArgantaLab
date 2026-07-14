---
title: Media Center — Build Plan (MOC)
date: 20260714
category: Build
status: Living
tags: [media-center, moc, marketing-production-fabric]
---

# Media Center — Build Plan

Map of content for the **Media Center** hub in `apps/hq` — one non-scrollable
page, nine segments, each on the shared [[Spine]]: *type a prompt → instant
result*, maturity-staged (deterministic & free → premium, approval-gated),
every result carrying provenance.

This is the UI face of the [[../Arganta-Marketing-Production-Fabric-CLEAN/20260713-Strategy-ArgantaMarketingFabric-README|Arganta Marketing Production Fabric]] and consumes [[Spine#Packages|@arganta/media-core]].

## Segments

| # | Tab | Analog | Status | Complexity |
|---|-----|--------|--------|-----------|
| 1 | [[Tab-Image]] | ComfyUI / Krea | built · stage 0 | 13 / M |
| 2 | [[Tab-Audio]] | Suno / MusicGen | built · stage 0 | 15 / L |
| 3 | [[Tab-Video]] | Runway / Remotion | built · stage 0 | 19 / L |
| 4 | [[Tab-Website]] | v0 / Puck | built · stage 0 | 14 / M |
| 5 | [[Tab-Brand]] | Realtime Colors | built · stage 0 | 9 / S |
| 6 | [[Tab-Deck]] | Gamma / Slidev | built · stage 0 | 14 / M |
| 7 | [[Tab-Scene]] | Spline / R3F | built · stage 0 | 16 / L |
| 8 | [[Tab-Campaign]] | AdCreative / Mautic | built · stage 0 | 18 / L |
| 9 | [[Tab-Analytics]] | Julius / Vega-Lite | built · stage 0 | 18 / L |

Total remaining-to-full-vision: **136 pts** across 9 tabs + [[Spine]] infra.

## Reading order

1. [[Spine]] — the shared shell, router, maturity gate, provenance
2. [[Complexity-Model]] — how each tab is scored
3. Any [[Tab-Image|Tab-*]] note for that segment's plan

## Cross-cutting dependencies

- **Every tab** depends on [[Tab-Brand]] (tokens) and [[Spine]].
- [[Tab-Campaign]] orchestrates [[Tab-Website]], [[Tab-Deck]], [[Tab-Scene]], [[Tab-Image]], [[Tab-Video]], [[Tab-Audio]].
- [[Tab-Analytics]] is the only tab that must reach **live Supabase RPCs** to hit full value.

## Global next steps (shared, not per-tab)

- [ ] Supabase durable `media_job` / `media_asset` / `cost_ledger` tables ([[Spine#Persistence]])
- [ ] `localStorage` persistence for the version drawer
- [ ] Live premium fulfilment via MCP providers (Higgsfield / PixelLab / ElevenLabs)
- [ ] Provider price snapshots (estimate vs actual)
