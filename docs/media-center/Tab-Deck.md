---
title: Presentation (Deck) Studio
tab: deck
status: built-stage0
tier_now: 0
complexity: 14 (M)
tags: [media-center, studio, deck]
---

# Presentation Studio — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

## Analog

Gamma / Pitch (product) · **Slidev**, reveal.js, presenton/allweone (AI Gamma
alts). Complements the immersive `cinema` surface; this is the **templated deck**
builder. Copy: 16:9 stage + thumbnail rail + Present mode; scenes-as-data.

## Current state (stage 0 — built)

`makeDeck(outline, brand)` → self-contained cinematic HTML deck (scroll-snap +
auto-advance, per-scene title/body) in an `<iframe srcDoc>`. Export `.html`.

## Target state

- **Scene player:** port the canvas + timed-narration engine from
  `apps/hq/public/audio/narrative-studio.html` (your proven cinematic base).
- **Thumbnail rail:** one tile per scene, click to jump; Present button.
- **Numbers-grounded:** auto-build an investor deck from the real financial
  models, not just the outline.
- **Stage 1:** LLM expands the outline into scene scripts.

## Build steps

1. Wrap `narrative-studio.html`'s scene player as a reusable module.
2. Generate scenes from the outline (title:body per line — done) + a
   **data-deck** mode that pulls real numbers.
3. Thumbnail rail + Present (fullscreen) mode.
4. Stage-1 outline→script via `@arganta/ai`.
5. Export = the self-contained HTML (already have it).

## Real data mapping

- `data/reports/{board,financial,valuation}.ts` → an investor deck.
- `data/growth.ts` `growthInsight` / `buildScorecard` → traction slides.
- `data/monetization.ts` scenarios → the "ask" slide.
- [[Tab-Brand]] tokens → theme.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 3 | scene player + data-deck builder |
| Data | 4 | reports + growth + monetization join |
| UI | 3 | stage + thumbnail rail + present |
| Providers | 2 | optional LLM outline |
| Infra | 2 | html export |

**Total 14 / 25 → M · ~8 pts**

## Dependencies

[[Spine]] · [[Tab-Brand]] · [[Jarvis OS Narrative Studio]] (engine base) · reports data
