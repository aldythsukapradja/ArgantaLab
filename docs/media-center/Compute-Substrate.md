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
| 1 **Sponsored** | Gemini/Groq free | **Cloudflare Workers AI** — edge, curated open models (FLUX-1-schnell, MeloTTS, Whisper) | free within allocation |
| 2 **Economy** | DeepSeek/Haiku | **Modal** — serverless GPU, any open container (FLUX-dev, MusicGen, AnimateDiff, XTTS) | cents/gen, scale-to-zero, no lock-in |
| 3 Frontier | Claude/Opus | closed premium (Higgsfield, Suno, ElevenLabs) | dollars, best quality |

## Per modality

- **Image:** procedural → CF FLUX-schnell (free) → Modal FLUX-dev → premium
- **Voice:** formant synth → CF MeloTTS (free) → Modal XTTS → ElevenLabs
- **Music:** `@arganta/audio` synth → *(CF thin)* → Modal MusicGen / Stable Audio → Suno
- **Video:** canvas → *(no free tier)* → Modal AnimateDiff / CogVideoX → Higgsfield / Runway

## Economy slot — candidates (Modal is the chosen v1)

| Option | Trade | Verdict |
|---|---|---|
| **Modal** (chosen) | own the container, cheapest at scale; needs `modal deploy` | v1 Economy |
| **fal.ai** | fastest inference + zero ops, per-gen pricing | best drop-in alt; faster to first demo |
| **Replicate** | broadest catalog; slower cold starts | for experimental models |

The gateway is provider-neutral, so fal.ai/Replicate are drop-in later — same
router, different upstream entry.

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

| WS | Delivers | Keys needed? |
|----|----------|--------------|
| **M1** | `media-proxy/router.js` (pure: pick provider by kind+costClass, per-provider request/response translation, pricing) + node tests | no — build + verify now |
| **M2** | `media-proxy/index.ts` (Deno: operator-gated, secrets, fetch) — CF FLUX-schnell first | no to build; CF token to run |
| **M3** | app `mediaGateway.ts` + Media Center Image segment: stage 1 → CF, stage 2 → Modal (tier pill already exists); base64→blob; honest fallback; `agent_runs` log | — |
| **M4** | `modal/media_image.py` (FLUX/SDXL web endpoint) — **founder runs `modal deploy`** | Modal account |

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
