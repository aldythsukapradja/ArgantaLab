---
title: Website Studio
tab: website
status: built-stage0
tier_now: 0
complexity: 14 (M)
tags: [media-center, studio, website]
---

# Website Studio — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

## Analog

v0 / Framer (product) · **Puck** (React, JSON-export page model), GrapesJS (OSS).
**Architecture to adopt:** Puck's *document-as-JSON* seam — the page is data, the
editor and the renderer are adapters. Fits the [[Spine]]'s provider-neutral rule.

## Current state (stage 0 — built)

`makeWebsite(brief, brand)` in `apps/hq/src/surfaces/studios/engines.ts` →
self-contained landing HTML (hero + features + CTA, brand gradient) rendered in
an `<iframe srcDoc>`. Downloadable as one `.html`.

## Target state

- **Doc model:** a `SiteDoc` JSON (sections[]) instead of a string; render + edit
  from the same doc (Puck pattern).
- **Device frame:** desktop/mobile toggle around the iframe.
- **Section toggles:** hero / features / pricing / testimonial / CTA.
- **Real content:** pull product facts from the portfolio, not just the brief.
- **Stage 1:** LLM writes section copy (`@arganta/ai`), still rendered locally.

## Build steps

1. Define `SiteDoc` (nodes) + `renderSite(doc)` (replaces the string builder).
2. Add device-frame toggle + section on/off controls.
3. Map portfolio → default sections (real app names, taglines).
4. Brand-lock badge (tokens from [[Tab-Brand]]).
5. Stage-1 copy via `@arganta/ai` `localCompose`-style adapter.
6. Export = `SiteDoc` → one `.html` (already have the renderer).

## Real data mapping

- Portfolio products (the real `apps/*`) + `data/featuredGames.ts` → sections.
- [[Tab-Brand]] tokens → colors/type.
- [[Circle AI runtime|@arganta/ai]] → optional Stage-1 copy.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 3 | doc model + renderer |
| Data | 4 | real portfolio join |
| UI | 3 | device frame + section toggles |
| Providers | 2 | optional LLM copy |
| Infra | 2 | html export, no long jobs |

**Total 14 / 25 → M · ~8 pts**

## Dependencies

[[Spine]] · [[Tab-Brand]] · [[Circle AI runtime]] · portfolio data
