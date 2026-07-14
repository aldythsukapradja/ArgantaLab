---
title: Complexity Model
date: 20260714
category: Build
tags: [media-center, complexity, estimation]
---

# Complexity Model

How each [[Media-Center-Build-Plan|Media Center]] tab is scored. Five dimensions,
each **1–5**, summed to **/25**, then mapped to a T-shirt size + rough points.
Scores measure the **remaining work to the full vision** (all tiers wired + real
data grounded), not the already-shipped Stage-0 slice.

## Dimensions

| Dim | 1 (trivial) | 3 (moderate) | 5 (hard) |
|-----|-------------|--------------|----------|
| **Engine** | one pure function | procedural + state machine | novel algorithm / grammar |
| **Data** | prompt only | one baked dataset | live multi-source RPC join |
| **UI/UX** | single element | interactive panel | multi-mode canvas/timeline |
| **Providers** | none | one free API | multiple paid + fallback |
| **Infra** | sync in-browser | blob/download | render worker + webhooks + storage |

## Bands

| Total | Size | ~Points | Meaning |
|-------|------|---------|---------|
| 5–9 | **S** | 3–5 | a focused session |
| 10–14 | **M** | 8 | a few sessions |
| 15–19 | **L** | 13 | a workstream |
| 20–25 | **XL** | 21 | a program slice |

## Scoreboard

| Tab | Eng | Data | UI | Prov | Infra | Total | Size | Pts |
|-----|----:|----:|---:|----:|-----:|------:|:----:|----:|
| [[Tab-Brand]] | 2 | 2 | 3 | 1 | 1 | **9** | S | 5 |
| [[Tab-Image]] | 2 | 3 | 2 | 3 | 3 | **13** | M | 8 |
| [[Tab-Website]] | 3 | 4 | 3 | 2 | 2 | **14** | M | 8 |
| [[Tab-Deck]] | 3 | 4 | 3 | 2 | 2 | **14** | M | 8 |
| [[Tab-Audio]] | 3 | 3 | 3 | 3 | 3 | **15** | L | 13 |
| [[Tab-Scene]] | 4 | 3 | 4 | 2 | 3 | **16** | L | 13 |
| [[Tab-Campaign]] | 4 | 4 | 3 | 3 | 4 | **18** | L | 13 |
| [[Tab-Analytics]] | 4 | 5 | 4 | 2 | 3 | **18** | L | 13 |
| [[Tab-Video]] | 4 | 3 | 4 | 4 | 4 | **19** | L | 13 |

**Sum:** 136 → but ~40% is shared [[Spine]] infra (providers, storage, price
snapshots) reusable across tabs — build once, amortize.

## Recommended order (value ÷ complexity)

1. [[Tab-Brand]] (S) — unblocks every other tab's tokens
2. [[Tab-Analytics]] live data (L, high value) — the differentiator
3. [[Tab-Website]] + [[Tab-Deck]] (M) — reuse portfolio + reports data
4. [[Tab-Image]] premium (M) — first paid provider proves the MCP seam
5. [[Tab-Scene]] / [[Tab-Audio]] / [[Tab-Video]] (L) — deepen richest engines
6. [[Tab-Campaign]] (L) — capstone, needs all the above
