---
title: Campaign Studio
tab: campaign
status: built-stage0
tier_now: 0
complexity: 18 (L)
tags: [media-center, studio, campaign, orchestration]
---

# Campaign Studio — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

> **Capstone.** Build last — it orchestrates every other tab.

## Analog

AdCreative.ai / Predis (product) · **Mautic** (OSS marketing automation), n8n.
Copy: a **deliverable matrix** + a **journey** (visual canvas of steps reacting
to real behavior), plus a packaged export.

## Current state (stage 0 — built)

One brief fans out to real **brand + website + deck + image** tiles (a live
thumbnail matrix). Each tile is a genuine artifact from its sub-engine.

## Target state

- **Full fan-out:** add video + audio to the matrix.
- **Channel targets:** pick platforms (IG / TikTok / YT / web) → format presets.
- **Journey:** a Mautic-style sequence (post → wait → follow-up) as data.
- **Assemble pack:** zip all deliverables + a manifest.
- **Auto-post:** hand off to Kinetik ([[Content Builder Post Studio]]) / the
  broadcast RPCs.

## Build steps

1. Extend the matrix to all 6 media kinds (reuse each tab's engine).
2. Channel/format target picker → per-tile presets.
3. `CampaignDef` JSON (deliverables + journey steps).
4. Zip assembler (JSZip) + manifest with provenance.
5. Auto-post seam → `hq_broadcast_save` / `hq_broadcast_publish_due` RPCs.

## Real data mapping

- Orchestrates [[Tab-Website]] [[Tab-Deck]] [[Tab-Scene]] [[Tab-Image]] [[Tab-Video]] [[Tab-Audio]].
- `data/monetization.ts` + portfolio → the campaign brief context.
- `hq_broadcast_*` RPCs (real, live) → scheduling/publishing.
- [[Content Builder Post Studio]] (`postEngine`) → social pack.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 4 | orchestration + journey model |
| Data | 4 | portfolio + broadcast RPCs |
| UI | 3 | matrix + journey canvas |
| Providers | 3 | inherits sub-tab providers |
| Infra | 4 | zip, scheduling, auto-post |

**Total 18 / 25 → L · ~13 pts**

## Dependencies

[[Spine]] · all [[Media-Center-Build-Plan|sub-tabs]] · [[Content Builder Post Studio]] · `hq_broadcast_*`
