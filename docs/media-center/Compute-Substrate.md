---
title: Media Compute Substrate (Sponsored + Economy)
date: 2026-07-15
category: Architecture
tags: [media-center, ai, compute, cloudflare, modal, fal, replicate, gateway]
---

# Media Compute Substrate

The media twin of the [[Intelligence-Router]]. Text leans on cheap closed APIs
(Gemini/DeepSeek/Claude) because they're a good deal; **media** closed APIs
(Higgsfield/ElevenLabs) are expensive and lock you in — but a huge ecosystem of
**open media models** (FLUX, SDXL, MusicGen, Stable Audio, AnimateDiff, XTTS,
Whisper) can be run on rented compute. Cloudflare and Modal are the two ways to
run them without owning GPUs, and they slot straight onto the existing
`costClass` tiers ([[Spine]], [[../adr/0001-four-tier-llm-router|ADR-0001]]).

## Tier map (media)

| costClass | Text (built) | **Media substrate** | Economics |
|---|---|---|---|
| 0 Sovereign | browser WebLLM | procedural / on-device (canvas, `@arganta/audio`) | $0, private |
| 1 **Sponsored** | Gemini/Groq/**CF** free ✅ | **Cloudflare Workers AI** — image (FLUX-1-schnell ✅), TTS (Aura-1 ✅) | free within allocation |
| 2 **Economy** | DeepSeek/Haiku | **fal.ai** — per-gen, broad catalog, zero ops (Modal deferred/cost-triggered) | cents/gen |
| 3 Frontier | Claude/Opus | closed premium (Veo/Suno/ElevenLabs); **Higgsfield = manual studio** | dollars, best quality |

## Per modality (✅ = live this session)

- **Image:** procedural → **CF FLUX-schnell ✅** → fal.ai (FLUX-dev etc.) → premium
- **Voice:** formant synth → **CF Aura-1 ✅** → fal.ai / XTTS → ElevenLabs
- **Music:** `@arganta/audio` synth → *(no CF music model)* → fal.ai MusicGen / Stable Audio → Suno
- **Video:** canvas → *(no free tier)* → fal.ai (async, webhook) → Veo / Higgsfield studio

> Note: CF's catalog has **no music-generation and no video model** — image + TTS
> are its full media surface, both now live. Music/video jump straight to fal.ai.

## Economy slot — REVISED: fal.ai is the primary programmable API

Superseded by [[Persistence-and-Provider-Strategy]] (2026-07-15). Earlier this
note picked Modal as v1 Economy; the strategy review flips that.

| Option | Trade | Verdict |
|---|---|---|
| **fal.ai** (chosen) | fastest inference + zero ops, per-gen pricing, webhook-friendly, broad catalog | **v1 paid programmable media API** |
| **Modal** | own the container, cheapest at scale; needs `modal deploy` | **deferred — cost-triggered** (introduce only when a fal.ai workload's spend proves self-hosting; image endpoint written but undeployed) |
| **Replicate** | broadest catalog; slower cold starts | experimental models, later |
| **Higgsfield** | cinematic camera control, ads/trailers | **manual creative studio, not a backend** — outputs become reusable recipes |

The gateway is provider-neutral, so fal.ai/Replicate/Modal are interchangeable
upstream entries — same router, different adapter.

## Architecture — reuses everything from WS-3

```
browser → media-core (Stage-0 deterministic, pure)          costClass 0
        → mediaGateway (app) → media-proxy Edge Function     costClass 1–3
                                  ↓ router.js (pure, tested)
                                  ├─ Cloudflare Workers AI    (Sponsored)
                                  ├─ Modal web endpoint       (Economy)
                                  └─ closed premium (later)   (Frontier)
                                  → returns real bytes + provenance
                                  → agent_runs (domain:'media')
```

Same **truthful gateway** pattern as `supabase/functions/llm-proxy` (real
provider/model/cost/latency, never a generic label). Same **governance**
(restricted → Tier-0 on-device only). Same **metering** (`agent_runs`). Same
**Model Rack** visibility. It is the media mirror of what already runs for text.

## Build plan → [[Workstream-Batch]] "Media Substrate (M)"

| WS | Delivers | Status |
|----|----------|--------|
| **M1** | `media-proxy/router.js` (pure: pick provider by kind+costClass, translation, pricing) + node tests | ✅ done (15 tests) |
| **M2** | `media-proxy/index.ts` (Deno: operator-gated, secrets, fetch) — CF FLUX-schnell | ✅ deployed |
| **M3** | app `mediaGateway.ts` + Media Center Image: stage 1 → CF; base64→blob; honest fallback; `agent_runs` log | ✅ **live-verified** |
| **M4** | `modal/media_image.py` (FLUX/SDXL web endpoint) | ✅ written; **deferred** (see strategy — fal.ai leads) |
| **M5** | **TTS**: CF Aura-1 in `media-proxy` (`kind:'tts'`) + `generateSpeechViaGateway` + Cinema economical tier | ✅ **live-verified** |
| **M6** | **Persistence-first** — bytes→bucket, `run_id`↔`asset_id` lineage, cloud gallery | ⬜ next (see [[Persistence-and-Provider-Strategy]]) |
| **M7** | **fal.ai** adapter (Economy programmable) | ⬜ next |

## What the founder provides
- **Cloudflare (Sponsored):** account ID + Workers-AI API token →
  `supabase secrets set CF_ACCOUNT_ID=… CF_API_TOKEN=…`, then
  `supabase functions deploy media-proxy`.
- **Modal (Economy):** sign up, `modal deploy modal/media_image.py`, then set the
  returned endpoint URL + auth as Supabase secrets.

## Honest caveats
- **Live testing needs the cloud path** — real Supabase keys + operator sign-in
  (the secret-holding proxy can't run in `hq-offline`). This is a shift from the
  offline testing used so far.
- **Modal cold-start** is seconds (warm) to ~a minute (cold) — a tier-selection
  input, not a blocker.
- CF Workers AI has a **fixed catalog** (no custom models, no video) — the reason
  Modal exists alongside it.
