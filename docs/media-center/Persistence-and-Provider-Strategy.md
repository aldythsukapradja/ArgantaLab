---
title: Media Center — Persistence & Provider Strategy (Diagnostic)
date: 2026-07-15
category: Architecture
status: active
tags: [media-center, cloudflare, supabase, fal-ai, higgsfield, modal, persistence, provenance, architecture]
---

# Media Center — Persistence & Provider Strategy

Reconciles the *Arganta Media Center Diagnostic and Architecture* strategy note
with what is **actually built** as of 2026-07-15. The diagnostic's headline —
*"the system executes work but does not reliably remember what happened"* — is
**half true**, and the accurate half is the real next milestone.

## The honest persistence picture (built vs. gap)

The diagnostic assumes a near-greenfield state. It isn't. Substantial memory
infrastructure already exists — but this session's two newest generation paths
bypass it.

### Already built ✅

| Layer | Reality | Doc's name for it |
|---|---|---|
| **Provenance/cost ledger** | `agent_runs` (WS-5, `migration_agent_runs.sql`) — every run's requested-vs-**actual** provider/model/costClass/costUsd/latency/status/error, operator-gated, idempotent on `run_id`, numerics clamped server-side. Powers Model Rack + CAPO. **Verified live this session.** | `media_events` + cost fields of `media_jobs` |
| **Asset library (video)** | `hq_video_asset` + `video-assets`/`video-renders` buckets (`migration_video_assets.sql`) — path/mime/bytes/w/h/duration/source/attribution/`created_by`, RLS operator-write / public-read. | `media_assets` |
| **Asset library (audio/music)** | `audio_library`, `music_library` + buckets (`migration_audio_*.sql`, `migration_music_library.sql`). | `media_assets` |
| **Cinema audio seam** | `cinema-audio` bucket + `persistence.ts uploadAudio()` — exists, **not yet wired to the Cinema UI**. | `media_assets` (scene-scoped) |

### The real gap ❌

1. **This session's new generation paths are ephemeral.** Media Center **image**
   (Cloudflare FLUX) → `URL.createObjectURL(blob)` in React state → **lost on
   refresh**. Cinema **TTS** (Cloudflare Aura-1) → localStorage data-URL override
   → survives reload *locally* but never reaches cloud storage and bloats
   localStorage. Neither writes to the asset tables above.
2. **No job→asset lineage.** `agent_runs` records *that* a media run happened and
   what it cost, but carries no pointer to a stored asset row. The ledger and the
   asset libraries are not linked.
3. **No async job lifecycle.** Everything is synchronous request→response. Fine
   for Cloudflare/Modal image+TTS (seconds); a blocker only for minutes-long
   async providers (fal.ai/Veo video) that need `queued→processing→completed`
   webhook reconciliation.
4. **Frontend reads local state, not persisted state.** The Media Center version
   drawer + history are `useState` (session-only). No cloud-backed gallery.

**Conclusion:** don't invent parallel `media_jobs`/`media_assets` tables from
scratch as the diagnostic sketches. **Extend what exists** — unify the three
asset libraries into (or behind) one `media_asset` shape, add a `job_id`/`run_id`
link to `agent_runs`, and make the new Cloudflare paths write through it.

## Provider strategy (revised)

The diagnostic changes the paid-media ordering. Prior in-session plan was
"Cloudflare Sponsored + Modal Economy." Revised:

| costClass | Role | Provider | Status |
|---|---|---|---|
| 0 Sovereign | on-device | procedural / `@arganta/audio` / canvas | built |
| 1 **Sponsored** | free edge | **Cloudflare Workers AI** — image (FLUX-schnell) ✅, TTS (Aura-1) ✅ | **done this session** |
| 2 **Economy** | primary programmable media API | **fal.ai** — broad catalog, per-gen, webhook-friendly, zero ops | **next adapter** |
| 2–3 | self-host when cost-justified | **Modal** — own the container; introduce only when a fal.ai workload's spend proves it (sensor-triggered, not first) | deferred (image endpoint written, undeployed) |
| 3 Frontier | selective cinema | premium closed (Veo / Suno / ElevenLabs) | later |
| — | **manual creative studio** | **Higgsfield** — human-driven cinematic ads/trailers/camera-motion; **not a backend**. Discoveries become reusable *recipes*. | manual |

Key shifts from `Compute-Substrate.md`:
- **fal.ai displaces Modal as the first paid integration** (was "Modal is the
  chosen v1"). Modal becomes cost-triggered, matching its own "introduce when
  sensors prove it" philosophy.
- **Higgsfield is reframed** from "Frontier API" to a **manual studio** producing
  recipes, not a programmatic backend.

## Cloudflare-as-workhorse — adopt when async/multi-user arrives

The diagnostic proposes Cloudflare Workers (Durable Objects, Workflows, Queues,
AI Gateway) as the orchestration backbone, Supabase as institutional memory. The
**memory split is already how we operate** (Supabase = truth; today's
`llm-proxy`/`media-proxy` = execution). The **runtime-move to Cloudflare Workers
is a large migration whose payoff is async + scale** — Durable Objects for
conversation state, Workflows for long-running video jobs, Queues for dispatch.
Today's workload is one operator, synchronous image/TTS through Supabase Edge
Functions, which is sufficient. **Trigger the migration when the first async
provider (fal.ai/Veo video) or real multi-user load lands** — the same
cost/complexity-triggered discipline the diagnostic applies to Modal.

## Milestone: Persistence-First (the diagnostic's Priority 1–5)

Do this **before adding more models**. Definition of done:

- [ ] `media_asset` shape unifies image/audio/music/video; carries
      `storage_provider/bucket/path/public_url/mime/bytes/w/h/duration/checksum/provenance/created_by`.
- [ ] Every generation copies bytes into a **controlled bucket** (Supabase
      Storage now; R2 an option later) — **never persist only a provider URL**
      (they expire).
- [ ] Each asset links back to its `agent_runs.run_id` (lineage: prompt →
      provider/model → cost → bytes).
- [ ] Media Center **image** writes through this instead of a throwaway object URL.
- [ ] Cinema **TTS** writes through `cinema-audio` (wire the existing
      `uploadAudio()`), replacing the localStorage data-URL.
- [ ] Frontend renders a cloud-backed **gallery/history** (reads persisted state),
      survives refresh.
- [ ] (Async only, later) `status` lifecycle + webhook reconciliation for fal.ai
      video — not needed for synchronous Cloudflare paths.

## Provenance-first, sensor-driven (already the pattern)

The diagnostic's "sensor" events (`media.image.generate`, `media.video.generate`,
cost/latency/success/retry) are **already emitted** as `agent_runs` rows with
`domain:'media'`. The missing piece is the **asset pointer**, not the sensor. Add
`run_id`↔`asset_id` and the ledger becomes the provider-benchmark / cost-per-
accepted-asset / Modal-migration-trigger source the diagnostic wants — reusing
the CAPO rollup (`agent_runs_capo`) already built.

## Cost metric that matters

Not cost-per-generation — **cost per accepted, reusable asset**. Requires an
`accepted`/`approved` flag on the asset row + the lineage link above.

## See also
- [[Compute-Substrate]] — the tier map + gateway this revises
- [[Intelligence-Router]] — the text twin (same truthful-gateway + `agent_runs`)
- [[Model-Rack]] — where the ledger surfaces; extend with cost-per-accepted-asset
- [[Media-Center-Build-Plan]] — MOC; persistence milestone promoted there
