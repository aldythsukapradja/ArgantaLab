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

## Foundation & intelligence

- [[Spine]] — shared shell, router, maturity gate, provenance
- [[Intelligence-Router]] — the Four-Tier LLM brain (**Opus contracts shipped ✅**; Cloudflare text tier live ✅)
- [[Compute-Substrate]] — media generation substrate: Cloudflare (Sponsored, **image + TTS live ✅**) + paid programmable tier
- [[Persistence-and-Provider-Strategy]] — **persistence-first milestone** + revised provider order (fal.ai primary programmable, Modal cost-triggered, Higgsfield manual studio, Cloudflare-workhorse when async arrives)
- [[Model-Rack]] — HQ integration + the Model Rack surface (WS-E)
- [[Workstream-Batch]] — Opus/Sonnet end-to-end split
- ADRs: [[../adr/0001-four-tier-llm-router|0001]] · [[../adr/0002-media-core-costclass-alignment|0002]] · [[../adr/0003-data-classification-governance|0003]]

## Reading order

1. [[Spine]] — the shared shell, router, maturity gate, provenance
2. [[Intelligence-Router]] — the four-tier model router
3. [[Complexity-Model]] — how each tab is scored
4. Any [[Tab-Image|Tab-*]] note for that segment's plan

## Cross-cutting dependencies

- **Every tab** depends on [[Tab-Brand]] (tokens) and [[Spine]].
- [[Tab-Campaign]] orchestrates [[Tab-Website]], [[Tab-Deck]], [[Tab-Scene]], [[Tab-Image]], [[Tab-Video]], [[Tab-Audio]].
- [[Tab-Analytics]] is the only tab that must reach **live Supabase RPCs** to hit full value.

## Global next steps (shared, not per-tab)

**Milestone: Persistence-First** — the current #1, do before adding models. See
[[Persistence-and-Provider-Strategy]]. The `agent_runs` ledger + `hq_video_asset`/
`audio_library`/`music_library` already exist; the gap is that this session's new
Cloudflare **image** + **TTS** paths are ephemeral (object URL / localStorage) and
unlinked to the asset tables.

- [ ] Unify a `media_asset` shape; copy every generation's **bytes into a bucket**
      (never persist only an expiring provider URL); link each asset to its
      `agent_runs.run_id` (prompt → provider/model → cost → bytes lineage)
- [ ] Media Center **image** + Cinema **TTS** write through it (wire existing
      `cinema-audio` `uploadAudio()`); cloud-backed gallery survives refresh
- [ ] `accepted`/`approved` flag → **cost-per-accepted-asset** in [[Model-Rack]]
- [ ] **fal.ai** adapter as the primary paid programmable media API (Economy);
      Modal stays deferred/cost-triggered
- [ ] (async only, later) `status` lifecycle + webhook reconciliation for fal.ai/Veo video
- [ ] Live premium fulfilment via MCP providers (Higgsfield manual studio / ElevenLabs)
