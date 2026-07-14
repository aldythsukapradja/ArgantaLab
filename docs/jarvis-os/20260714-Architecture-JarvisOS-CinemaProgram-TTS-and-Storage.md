---
title: Jarvis OS Cinema Program - TTS Tiers & Cloud Storage
date: 2026-07-14
type: architecture
status: draft
project: Jarvis OS
program: Cinema Program
workstream: WS1
tags:
  - jarvis-os
  - circle-hq
  - cinema-program
  - tts
  - supabase
---

# Cinema Program — TTS Tiers & Cloud Storage

> [!summary]
> Concept for (1) a **3-tier TTS pipeline** so narration can be re-voiced — cheap first, ElevenLabs at production — aligned with the Media Center's maturity model, and (2) moving all Cinema Director state (edits, versions, audio) from localStorage to **Supabase**. Extends [[20260714-Architecture-JarvisOS-CinemaProgram-WS1-BuildPlan|the WS1 build plan]] and the [[jarvis-os-narrative-studio|Cinema editor]].

## 1 · Three-tier TTS (aligned with Media Center)

`@arganta/media-core` already routes generation through maturity stages 0→3 and treats **voice** as a modality. The Cinema editor uses a **simplified 3-tier** view of that same model — routing always walks *down*, never silently up to a paid provider.

| Tier | Name | Provider | Cost | Produces | Runs where | Status |
|---|---|---|---|---|---|---|
| **1** | Experiment | Browser Web Speech | $0 | live speech (no file) | browser | **wired now** |
| **2** | Economical | cheap hosted TTS | low | audio bytes | API | concept |
| **3** | Premium | **ElevenLabs** | $$ | studio audio | MCP / server | concept · approval-gated |

Maps to media-core: Tier 1 ≈ stage 0 (deterministic/browser), Tier 2 ≈ stage 2 (economical), Tier 3 ≈ stage 3 (premium, `approved: true` required). Implemented in `apps/hq/src/lib/tts/tts.ts` — `synthesize(req)` returns `spoken` (tier 1), or `deferred` with a descriptor the production pipeline fulfils (tiers 2–3).

### Flow
1. **Experiment (now):** founder edits narration → hits **Speak** → hears it instantly in the picked JM/KF browser voice. Zero cost, no file — perfect for iterating wording.
2. **Economical (polish):** once wording is locked, tier 2 generates a real clip via a cheap API → uploaded to the `cinema-audio` bucket → becomes the scene's audio.
3. **Premium (production):** final pass re-voices approved scenes through **ElevenLabs** (via the media-core premium/MCP adapter) → replaces the clips. Approval-gated so no accidental paid calls.

> [!note]
> The voice map is fixed: **JM** = calm adult male, **KF** = warm adult female (the only two recorded voices). A tier only changes *how* a clip is produced, never the scene structure — so re-voicing never desyncs the timeline.

### Why browser TTS can't "bake" a file (tier 1 limit)
Web Speech `SpeechSynthesis` plays to the speakers but exposes no audio buffer, so tier 1 is **preview-only**. Baking a replaceable clip needs an API that returns bytes → that's exactly the tier 2/3 job. The editor's **Re-record text** button copies voice-tagged text for that pipeline.

## 2 · Cloud storage (Supabase)

Today the Director persists to `localStorage` (`hq_cinema_director_v1`), and replaced clips are data-URLs (≈5–10 MB cap). Production moves **edits, versions, and audio to Supabase**, keyed to the founder.

### Schema — `supabase/cinema/01_cinema.sql` (ready to run)
- **`cinema_scene_edits`** `(user_id, scene_id)` → idea / title / voice / narration / audio_path / audio_name / tts_tier. The live overrides.
- **`cinema_versions`** `(id, user_id, label, snapshot jsonb, created_at)` → point-in-time snapshots (restore/rollback).
- **Storage bucket `cinema-audio`** (private) → replacement clips at `<uid>/<scene>.<ext>`.
- **RLS**: every row/object is owned by `auth.uid()` — a founder only ever sees their own scenario.

### Adapter seam — `apps/hq/src/cinema/persistence.ts` (built, gated)
`pullScenario` · `pushSceneEdit` · `deleteSceneEdit` · `uploadAudio` · `pushVersion`. All **no-op when cloud is disabled or signed-out**, so the app never breaks offline. The store stays localStorage-first; enabling cloud is a one-flag switch **after** the migration is run and the founder signs in.

### Sync model
- **Offline-first, cloud-backed.** Edit locally (instant) → debounced `pushSceneEdit` to Supabase. On load, `pullScenario` hydrates from cloud, falling back to localStorage.
- **Audio:** `Replace` uploads to the bucket (not a data-URL) → store the object path → read via a signed URL. Removes the localStorage size cap.
- **Versions:** `Save version` writes a `cinema_versions` row; the whole history syncs across devices.

## Risks / notes

> [!warning]
> - **Migration is manual.** `supabase/cinema/01_cinema.sql` must be run in the ArgantaLab Supabase project before cloud sync does anything (matches this repo's migration convention).
> - **Private bucket reads** need signed URLs, not `getPublicUrl` — wire `createSignedUrl` when flipping to cloud.
> - **Debounce writes** so per-keystroke edits don't hammer the API.
> - **Tier 2/3 are unwired** — they return a `deferred` descriptor today; wiring them is a production task behind the media-core premium adapter.
> - **Approval gate** on premium is a real spend control — keep it.

## Next steps

1. Run the migration; flip the store to sync via `persistence.ts`.
2. Wire tier 2 (a cheap TTS API) to bake clips into the bucket.
3. Wire tier 3 through media-core's ElevenLabs/MCP adapter, approval-gated.
