---
title: Video Studio
tab: video
status: built-stage0
tier_now: 0
complexity: 19 (L)
tags: [media-center, studio, video]
---

# Video Studio — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

## Analog

Runway / CapCut (product) · **Remotion**, Revideo (OSS — video as code). Copy:
a **scrubbable scene timeline** under a format-framed player, and a real file
export.

## Current state (stage 0 — built)

`@arganta/video`: prompt → project (bg + text layers) → live canvas preview
(`drawFrame`) + **real export** (`exportVideo` → webm/mp4 blob). Letterboxed
via `object-fit`.

## Target state

- **Timeline:** thumbnail-per-scene strip, click to seek, drag to reorder.
- **Voice track:** `renderVoice(script)` + waveform layer + caption sync.
- **Image layers:** drop a [[Tab-Image]] asset as a Ken-Burns background.
- **Stage 3:** `higgsfield.generate_video` (text→video), gated, async.
- **Render worker:** long renders off the browser lifetime ([[Spine#Persistence]]).

## Build steps

1. Add a scene **timeline** UI bound to `project.layers`.
2. Wire **voice** (`renderVoice`) + caption layer.
3. Accept an [[Tab-Image]] result as an `imageLayer`.
4. Register Stage-3 video MCP adapter (returns a durable job).
5. Move export to a worker; webhook → `media_asset`.
6. Auto-post hook → Kinetik ([[Tab-Campaign]]).

## Real data mapping

- `@arganta/video` engine (deterministic, zero-asset).
- `data/reports/*` + portfolio descriptions → launch-film copy.
- [[Tab-Brand]] palette → project palette.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 4 | timeline + layers + export |
| Data | 3 | copy + brand |
| UI | 4 | player + timeline + tracks |
| Providers | 4 | premium video, async, fallback |
| Infra | 4 | render worker, webhooks, large files |

**Total 19 / 25 → L · ~13 pts**

## Dependencies

[[Spine]] · `@arganta/video` · [[Tab-Image]] · [[Video Builder]] · MCP `higgsfield.generate_video`
