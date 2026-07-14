---
title: Model Rack — HQ Integration spec (WS-E)
date: 2026-07-14
category: Architecture
owner: Opus
tags: [media-center, ai, hq, model-rack, ui-spec]
---

# Model Rack — HQ Integration Spec (WS-E)

How the [[Intelligence-Router]] surfaces in Circle HQ, and how it connects to
[[Media-Center-Build-Plan|Media Center]]. Opus spec; Sonnet WS-7 builds it,
Fable reviews.

## New HQ surface: **Model Rack**

A single non-scrollable surface (same [[Spine]] discipline) showing the live
state of the four tiers — a control room for sovereign intelligence.

```
ARGANTA MODEL RACK
  Sovereign   4 models · 2 installed · 1 active · SCR 41%
  Sponsored   3 providers healthy · 82% free quota left
  Economy     2 enabled · $1.24 this month
  Frontier    2 enabled · 7 calls this month
```

Panels:
1. **Tier columns** (0–3) — models from `MODEL_REGISTRY`, lifecycle, install
   state (Tier 0), provider health dot, quota bar.
2. **Sovereign Completion Rate** gauge (target 40→65→80%) from [[ledger|agent_runs]].
3. **Runs feed** — recent runs showing **actual** provider·model·costClass·
   latency·cost·validation (never `edgeProxy`).
4. **Budget/CAPO** — spend by tier, cost-per-success, frontier dependency.

## Media Center integration

- The composer **tier pill** = `costClass` selector, sourced from the same
  ontology. Friendly labels now; canonical (Sovereign/…/Frontier) once the Rack
  ships ([[../adr/0002-media-core-costclass-alignment|ADR-0002]] open decision).
- Every Media Center generation writes an `agent_runs` row (`domain:'media'`),
  so the Rack's runs feed + CAPO cover media *and* text uniformly.
- The Media Center **provenance chip** and the Rack **runs feed** read the same
  record — one truth.

## Two routers, one spine

```
@arganta/ai   ──┐                        ┌── text models (Gemini…Claude)
                ├─ costClass ─ gateway ─ ledger ─ Model Rack
@arganta/media-core ┘                    └── media providers (Higgsfield…)
```

Shared: costClass taxonomy · truthful provider gateway · `agent_runs` ledger ·
health/quota · Model Rack UI. Distinct: the provider sets + domain engines.

## Data-class surfacing
Restricted/confidential runs are badged **"local-only"** in the runs feed and the
Media Center chip, making the privacy guarantee visible ([[../adr/0003-data-classification-governance|ADR-0003]]).
