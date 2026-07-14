---
title: Spine — shared shell, router, provenance
date: 20260714
category: Build
tags: [media-center, architecture, spine]
---

# Spine

The shared substrate under every [[Media-Center-Build-Plan|Media Center]] tab.
Build a tab = provide a **prompt → artifact** engine + a **stage renderer**; the
spine gives you the cockpit, tier routing, gate, provenance, and version drawer
for free.

## UI shell — `apps/hq/src/surfaces/studios/StudioShell.tsx`

One non-scrollable grid: `[ drawer | (bar · composer · stage) ]`.

- **Composer (top):** tier pill (popup selector) · prompt textarea (Enter=run,
  Shift+Enter=newline) · polished `Make` button.
- **Stage:** the result dominates; a floating **provenance chip** (click →
  lineage popover).
- **Left drawer:** search box · **Versions** (every generation, restorable,
  hover-delete) · **Output** (download actions). Collapsible.
- **StageBoundary:** error boundary so a lost WebGL context can't white-screen.

Props are stable so a new tab only supplies `segments`, `onGenerate`, `result`,
`children` (stage), `outputActions`. See [[Tab-Brand]] for the simplest example.

## Router + gate — `@arganta/media-core`

`generate({ kind, spec, maturityStage, approved })` routes to the **cheapest
capable provider** (walks *down*, never silently upsells) and enforces the
**premium approval gate**. Result carries `provenance { provider, tier, cost,
estimated, seed, checksum, maturityLabel }`. Non-media kinds use `stub.ts`'s
`stubGenerate` with the same shape + gate.

### Maturity tiers (the pill)

| Tier | Cost | Runs where |
|------|------|-----------|
| 0 Free | $0, reproducible | Node / browser engines |
| 1 Free API | $0 | free hosted models *(unwired)* |
| 2 Economical | low | cheap paid *(unwired)* |
| 3 Premium | $$ | paid MCP — needs approval |

## Persistence (not built)

Supabase durable tables — the shared infra most tabs need for tiers ≥ 1:

- `media_job` (id, kind, tier, status, actor, correlationId)
- `provider_attempt` (idempotency key, provider event id)
- `media_asset` (uri, checksum, rights, provenance)
- `cost_ledger` (estimated vs actual, price snapshot)

Long/paid work runs async (worker or MCP), webhooks update Supabase, HQ
subscribes via Realtime. Browser never holds a provider secret. See the Fabric
[[../Arganta-Marketing-Production-Fabric-CLEAN/20260713-Strategy-BattleTestAndGapClosure|Battle Test]] gaps 1–3.

## Packages

- `@arganta/media-core` — router, contracts, deterministic image, PNG/hash
- `@arganta/audio` — [[Tab-Audio]] engine (MusicTransport, themes)
- `@arganta/video` — [[Tab-Video]] engine (canvas, voice, export)
- `three` + R3F — [[Tab-Scene]]
- `recharts` + `d3-geo` — [[Tab-Analytics]]
- local `engines.ts` — [[Tab-Website]] / [[Tab-Brand]] / [[Tab-Deck]] HTML
