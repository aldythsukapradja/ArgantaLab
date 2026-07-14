---
title: Handoff — Media Core & Provider Router (Stage 0 slice)
date: 20260714
category: Handoff
status: Delivered
owner_llm: Opus
---

# Handoff — Media Core & Provider Router

## Summary

First vertical slice of the Marketing Production Fabric's Media Core. One public
call, `generate({ kind, spec, maturityStage, approved })`, routes media
generation to the **cheapest capable provider** and enforces the **premium
approval gate**. Deterministic image generation runs end-to-end in Node today;
the other modalities are routed and gated, deferring to engines/providers that
already exist.

## Files added

- `packages/media-core/` — new `@arganta/media-core` package (plain JS ESM,
  matches `@arganta/audio` / `video` / `ai`).
  - `src/contracts.js` — MaturityStage, MediaJob result, provenance, DomainError.
  - `src/router.js` — kind+stage → adapter; walks DOWN to cheapest available.
  - `src/registry.js` — (kind, stage) → adapter map; runtime-extendable.
  - `src/core.js` — `generate()` orchestrator + approval gate + checksum.
  - `src/png.js` — dependency-free PNG encoder (Node `zlib`).
  - `src/adapters/image-deterministic.js` — Stage-0 procedural image (Node).
  - `src/adapters/browser-engines.js` — Stage-0 music/video/voice/sfx →
    `@arganta/audio` + `@arganta/video` (deferred, browser runtime).
  - `src/adapters/premium-mcp.js` — Stage-3 gated descriptors → paid MCP tools.
  - `test/media-core.test.js` — 8 tests. `demo.js` — runnable proof.

## Public API

`generate(req, opts)` → MediaJob. `createRegistry(extra)`, `route()`,
`generateImage()`, `encodePNG()`, `MATURITY`, `MEDIA_KINDS` also exported.

## Contracts consumed

None external yet — this package currently DEFINES its media contracts inline.
When `packages/media-contracts` (Shared Contract Standard) lands, migrate the
shapes in `src/contracts.js` to import from it (additive, no behavior change).

## Tests / evidence

`node --test` → 8/8 pass. `node demo.js` → writes a valid 512×512 PNG
(`file` confirms `PNG image data, 512 x 512, 8-bit/color RGBA`) and prints the
routing + approval gate for every modality.

## Feature flag

Not wired into HQ yet. Recommend `marketingFabric.mediaCore` when integrating.

## Known limitations / next steps

1. **Stage 1 & 2 (free-api / economical) are unimplemented** — router supports
   them; no adapters registered. Add free-API image/voice adapters next.
2. **Music/video/voice are `deferred`** — the HQ browser runtime must execute the
   descriptor against `@arganta/audio` / `@arganta/video`. Wiring that into a
   HQ Media Studio surface is the next integration task.
3. **Premium is stubbed** — descriptor only; no live Higgsfield/ElevenLabs call.
   Wire the operator/worker fulfilment + real price snapshots (BattleTest Gap 3).
4. **Persistence not yet added** — Supabase durable job/attempt/cost/provenance
   tables (BattleTest Gap 1/2) are still to build.

## Rollback

Delete `packages/media-core/`. No other files touched; no migrations, no schema,
no secrets, no changes to existing packages or apps.
