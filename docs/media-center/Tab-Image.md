---
title: Image Studio
tab: image
status: built-stage0
tier_now: 0
complexity: 13 (M)
tags: [media-center, studio, image]
---

# Image Studio — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

## Analog

Krea / Leonardo (product) · **ComfyUI**, AUTOMATIC1111 (OSS). Key idea worth
copying: a **seed + variation strip** so one prompt yields a small grid to pick
from, and the seed is first-class in provenance.

## Current state (stage 0 — built)

`@arganta/media-core` deterministic image adapter → real PNG via a dependency-free
encoder. Same prompt+seed → identical bytes. Renders in `<img>`, downloadable.

## Target state

- **Stage 1:** a free hosted text-to-image model (adapter registered on the
  router; no UI change).
- **Stage 3:** `higgsfield.generate_image` via MCP, approval-gated.
- **Variation strip:** render 4 seeds under the main canvas (ComfyUI feel).
- **Palette lock:** pull the active [[Tab-Brand]] palette so key-art is on-brand.

## Build steps

1. Add a **seed control** + 4-seed variation strip to the Image stage.
2. Register a **Stage-1 free-API adapter** in `media-core/registry.js`.
3. Wire **Stage-3** to the MCP `generate_image` descriptor fulfilment ([[Spine#Persistence]]).
4. Feed `spec.palette` from [[Tab-Brand]] tokens + `data/pixel` palettes.
5. Store master + thumbnail in `media_asset`; dedup by checksum.

## Real data mapping

- Brand tokens → `spec.palette` ([[Tab-Brand]]).
- `apps/hq/src/data/featuredGames.ts` `.hue` → per-product accent.
- `data/pixel` palettes (`pixel_palettes` MCP) → pixel-art style.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 2 | procedural done; adapters are thin |
| Data | 3 | brand + pixel palettes join |
| UI | 2 | img + variation strip |
| Providers | 3 | free API + premium MCP + fallback |
| Infra | 3 | asset storage, dedup, price snapshot |

**Total 13 / 25 → M · ~8 pts**

## Dependencies

[[Spine]] · [[Tab-Brand]] · `@arganta/media-core` · MCP `higgsfield.generate_image`
