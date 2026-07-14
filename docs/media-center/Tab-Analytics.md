---
title: Analytics Studio
tab: analytics
status: built-stage0
tier_now: 0
complexity: 18 (L)
tags: [media-center, studio, analytics, charts]
---

# Analytics Studio — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

> **The differentiator.** Highest value ÷ complexity once wired to live data.

## Analog

Julius.ai / ThoughtSpot / Rill (product) · **Vega-Lite + NL4DV**, Observable
Plot, Evidence, Metabase (OSS). **Architecture to adopt:** NL4DV's *question →
spec* grammar — a typed `Analysis` that the renderer consumes, so new chart types
and live data don't churn the UI.

## Current state (stage 0 — built)

`analytics.ts` — deterministic picker (question keywords → chart type + dataset)
→ `AnalyticsChart.tsx` renders **bar / line / area / pie / scatter** (recharts),
a **d3-geo world map**, and an **SVG heatmap**. Grounded in real repo models
(`monetization.ts`, `featuredGames.ts`). Shows the picked chart, its reason, and
the data source.

## Target state

- **Live data:** swap baked datasets for Supabase RPCs (same `Analysis` shape).
- **Data-table panel:** the underlying rows beside the chart (drawer or right).
- **More types:** stacked bar, funnel, cohort, treemap.
- **Robust picker:** optional `@arganta/ai` NL→spec pass behind the heuristic
  (NL4DV-style), still deterministic-first.
- **Drill-down:** click a bar → filtered follow-up.

## Build steps

1. Add a `datasets` layer with a `source: 'baked' | 'rpc'` switch.
2. Wire RPCs: `increment_plays` (plays), `hq_broadcast_*` (content perf),
   `app_usage_beats` / `hq_engagement` (engagement — migration pending).
3. Render an underlying **data table** for any Analysis.
4. Add stacked-bar / funnel / treemap to `AnalyticsChart`.
5. Optional `@arganta/ai` NL→spec fallback when the heuristic is unsure.
6. CEO-office MCP for finance: `valuation_*`, `financial_model`, `graph_query`.

## Real data mapping

- **Now (baked):** `data/monetization.ts` (`forecastCurve`, `computeScenario`,
  `PRESETS`), `data/featuredGames.ts`, `data/growth.ts`, `data/richness.ts`.
- **Live (RPC):** `increment_plays`, `hq_broadcast_*`, `app_usage_beats` →
  `hq_engagement` (see [[HQ engagement pipeline]], migration pending).
- **MCP:** CEO-office `financial_model` / `valuation_estimate` / `graph_query`.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 4 | picker robustness + NL→spec |
| Data | 5 | live multi-source RPC join |
| UI | 4 | many chart types + geo + table |
| Providers | 2 | optional LLM picker |
| Infra | 3 | RPC auth, caching, drill-down |

**Total 18 / 25 → L · ~13 pts**

## Dependencies

[[Spine]] · `recharts` + `d3-geo` · [[HQ engagement pipeline]] · [[HQ analytics architecture]] · CEO-office MCP
