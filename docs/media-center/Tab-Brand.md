---
title: Brand Kit
tab: brand
status: built-stage0
tier_now: 0
complexity: 9 (S)
tags: [media-center, studio, brand]
---

# Brand Kit — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

> **Build this first.** It is the token source every other tab consumes
> ([[Tab-Image]], [[Tab-Website]], [[Tab-Deck]], [[Tab-Scene]], [[Tab-Campaign]]).

## Analog

Realtime Colors (product) · **Realtime Colors**, Lyft **ColorBox**, Style
Dictionary (OSS). Copy: a **live board** where the palette + type apply to a real
mini-preview, with **AA-contrast badges** on every pair.

## Current state (stage 0 — built)

`makeBrand(brief)` → seeded palette (from `media-core` PALETTES) + type pairing +
name. Rendered as 3 swatches + a type specimen. Export CSS via the drawer.

## Target state

- **Live mini-site:** the tokens applied to a hero+card preview that updates in
  place (Realtime Colors feel).
- **Contrast badges:** AA/AAA pass/fail on fg/bg pairs.
- **Token export:** CSS vars **and** a Style-Dictionary-style JSON.
- **Single source:** publish tokens so other tabs read them (a `brand` store).

## Build steps

1. Add a live preview panel (hero + card) bound to the tokens.
2. Compute WCAG contrast; render pass/fail chips.
3. Export JSON tokens (not just CSS).
4. Persist active brand to a shared store other tabs read.
5. (opt) derive palette from `theme.css` for HQ-consistent brand.

## Real data mapping

- `apps/hq/src/theme.css` variables → base tokens.
- `data/featuredGames.ts` `.hue` → per-product accent seeds.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 2 | seeded palette + contrast math |
| Data | 2 | theme.css + hues |
| UI | 3 | live board + badges |
| Providers | 1 | none |
| Infra | 1 | in-browser, token export |

**Total 9 / 25 → S · ~5 pts**

## Dependencies

[[Spine]] · `@arganta/media-core` (PALETTES) · consumed by all other tabs
