---
title: L5 · Agentic
type: layer-tracker
layer: agentic
status: living
health: amber
maturity: functional
leverage: low
date: 2026-07-11
tags: [arganta, layer, agentic, hq, mcp, bridge]
cssclasses: [wide-tables]
---

# L5 · Agentic — Circle HQ + The Bridge

> [!abstract] Health: 🟡 functional but empty · Leverage: 🔴 low now → 🟢 high later
> The intelligence layer: **6 offices · 27 agents · a 20-tool MCP Bridge**, all reading a command graph over the product tables. It runs, it's honest — and it's a cockpit pointed at an empty room. Its leverage is *derivative*: it can only be as valuable as the user data underneath it (see [[L7-distribution]]).

## Baseline state (2026-07-11)

- **Circle HQ** (`apps/hq`) — Command graph engine, **6 offices** (COO/CTO/CFO/GC/CAPO/Bridge) consolidating 27 agents, office cockpits, report engine (R1–R3), RCA, verdict queue, Treasury/scale models, The Actuary, Growth, Pixel Vault. Read-only over ArgantaLabs tables (`hq_*` + `SECURITY DEFINER`).
- **The Bridge** (`apps/mcp`, 941 LOC) — 20 MCP tools (`ceo_ask`, `graph_query`, `valuation_*`, `pixel_*`…), live on Render, reusing HQ's graph with zero rebuild.
- **Provenance discipline (holds):** every value carries a badge — `live` / `partial` / `simulated` / `placeholder`. Nothing fake renders as real.
- **The instrumentation is done:** `hq_growth_overview()` computes DAU/WAU/MAU/stickiness/north-star. It works. It reads `0`.

## Maturity × Leverage
- **Maturity 🟡 functional** — the machinery is built and running; provenance is mostly `simulated`/`placeholder` (debt D8) because there's no real activity to read.
- **Leverage 🔴 low *now*, 🟢 high *later*** — this is the only layer whose leverage is **downstream of another layer**. It cannot become valuable until L7 puts real users in the graph.

## What changed
*Baseline — the zero point.*
- `2026-07-11` — baseline: 6 offices, 27 agents, Bridge live (20 tools), provenance mostly simulated.

## Lessons
- [[never-render-fake-as-real]] — the provenance-badge system is this layer's defining virtue; it keeps an empty cockpit honest.
- [[build-both-sides-of-the-wire]] — the sensors (`hq_growth_overview`) exist; the *data producers* (users) don't, so the wire is half-built.

## Debt & risks
- **D8 — provenance mostly simulated.** Not a bug — an honestly-labelled placeholder. Fixing [[L7-distribution|D1]] fixes this automatically.
- Risk: investing more in HQ features *feels* like progress but can't raise leverage until users exist. Same trap as [[L3-app-ui]].

## Wayforward
1. **Don't build more HQ until it has real numbers to govern.** Its value is capped by L7, not by its own features.
2. When the first strangers arrive, the payoff is immediate: `simulated` → `live` badges flip on their own.
3. Keep the Bridge honest and read-only; it's the truthful mirror that will make the eventual real numbers credible.

## Links
[[00-stack]] · [[00-MASTER-KB#8 · The Bridge (MCP) — 20 tools]] · [[L7-distribution]] · `apps/mcp/README.md`
