# Studio Redesign Spec — Audio · Video · Pixel on the Post Studio DNA

Goal: give Video/Audio/Pixel the same success Post Studio has (great on mobile,
great on web, obvious UX) — but **tailored to each modality's center of
gravity**, benchmarked against the best software in each category, and wired to
the now-verified sovereign engines (image z-image · music ACE-Step 1.5 · video
Wan 2.2 5B, all local/zero-cost).

## Why Post Studio works (the transferable DNA)

1. **One obvious hero surface** — the canvas IS the post; you always look at
   the thing you're making, rendered true to its final size.
2. **Three-scope inspector** (Compose · Style · Post) — content vs look vs
   shipping never fight for the same panel. Desktop: right column. Mobile:
   bottom sheet opened by tapping the canvas.
3. **Bottom strip = the doc's units** (slides) — spatial, tappable, reorderable.
4. **Many ways in** (drafts inbox, Copilot, templates, batch), **one gate out**
   (export + Moment + Buffer).
5. **Offline-safe AI seams** — every AI button has a deterministic fallback.

The mistake to avoid: copying the *canvas* layout to modalities that aren't
canvases. Audio's hero is playback; generative video's hero is the generation
feed; pixel's hero is the collection. The DNA transfers; the hero doesn't.

---

## Benchmarks (2026)

| Modality | Product | What their UX teaches us |
|---|---|---|
| Music | **Suno** | Generate-first workspace: one prompt box with Simple/Custom modes (lyrics+style merged vs split), a FEED of generations you replay/extend/remix, built-in light DAW later — the song list IS the workspace. Mobile app = same feed. |
| Music | **Udio** | Speed of iteration beats feature count — regenerate is one tap, variations sit side-by-side. |
| Audio suite | **ElevenLabs Studio 3.0 / ElevenCreative** | One studio unifies voice+music+SFX+captions on a track timeline; the Voice **Library** (10k voices, per-voice cards with audition) is the registry pattern for our voice_profile. Voice Design = "describe a voice → get candidates". |
| Video | **Runway** | Generation-engine UX: left prompt/params rail, center = last generation w/ scrub, bottom/side = generations gallery; editing is a separate light timeline surface. |
| Video | **CapCut** | Mobile-first editing: vertical preview on top, timeline under thumb, tool strips as horizontally-scrolling chips. The timeline is the hero only when you HAVE footage. |
| Video | **Higgsfield** | A *suite* of purpose studios (Cinema/LipSync/Ads) over shared identity (Soul ID) — maps to our surfaces sharing the ARGANTA LoRA + voice registry. |
| Pixel | **PixelLab** | Generator-first with browser + plugin duality; prompt → sprite/rotations/animations; the OUTPUT GRID is the workspace. |
| Pixel | **Lospec / Midjourney-style galleries** | Curation UX: dense grid, facet filters, palette strips, hover-preview — a vault should feel like a gallery, not a database table. |

Synthesis per modality:
- **Audio hero = the feed + player** (Suno), with our 3D stage as the visualizer crown.
- **Video hero = split personality**: Generate mode (Runway) and Edit mode (CapCut) — one surface, a mode switch, shared library.
- **Pixel hero = the gallery grid** with Forge as a persistent side rail, not a separate tab you forget.

---

## R1 — Foundation: `comfyClient.ts` (browser → sovereign engines)

Everything below depends on this. ComfyUI already serves CORS `*`, so the
browser calls `127.0.0.1:8188` directly.

- `apps/hq/src/lib/comfyClient.ts`: browser port of the three VERIFIED graphs
  (copy from adapters — including the two gotchas: ACE needs the 1.5 nodes;
  SaveVideo outputs under `images`). API: `comfyHealth()`, `comfyImage(spec)`,
  `comfyMusic(spec)`, `comfyVideo(spec)`, each returning `{blob, meta}` with
  progress callbacks (poll `/history` + `/queue`).
- Settings: `hq_comfy_url` in localStorage (default `http://127.0.0.1:8188`),
  toggle in each studio's Ship scope + Media Center.
- **SovereignChip** shared component: green (up + models), amber (up, model
  missing), gray (offline) — with tooltip listing engines. Lives in every
  studio top bar + Media Center rack.
- Job etiquette: one heavy job at a time client-side (module-level mutex);
  UI shows queue position.

## R2 — Audio Studio v2 (music · sfx · voice) — Suno × ElevenLabs shape

Layout (desktop):
- **Top bar** (unchanged chrome family): title, SovereignChip, Composer, Ship.
- **Hero = stage + player**: the existing 3D/2D reactive stage stays (it's our
  visual signature — Suno has nothing like it), but a **player bar** docks
  under it: play/pause, scrubber, now-playing title, engine badge
  (generative-synth | sovereign-MP3 | anthem).
- **Left rail = the Suno-style FEED** (replaces "maps strip" as home): every
  audio asset — sovereign renders, recordings, anthems, SFX takes, voice
  takes — newest first, filter chips [All · Music · SFX · Voice · Maps].
  Each card: waveform strip, name, duration, engine badge, ▸ play, ⋯ (use in
  Video / set as map theme / download / archive). Backed by `audio_asset`.
  Maps become a *filter view* of the feed, not the whole world.
- **Inspector scopes** (right column / mobile bottom sheet):
  - **Compose** — the current theme editor (Feel/Chords/Orchestra) unchanged.
  - **Generate** — the Suno moment: Simple (one prompt) / Custom (tags + lyrics
    + BPM + key + duration) → **Render (Sovereign)** → progress → lands in
    feed + auto-plays. Offline-safe: falls back to composing a generative
    theme from the prompt (existing localCompose).
  - **SFX** — promote SFX Forge from Legacy: cue grid, edit first layer,
    preview, save-to-feed as sfx assets.
  - **Voice** — the ElevenLabs-Library pattern: voice cards (jarvis, lady, +)
    with audition line, engine per voice, batch re-record hook for Cinema,
    "used by: Copilot · Cinema · Video" chips. (Cinema/Copilot rewiring to
    resolve-by-id happens here, supervised.)
  - **Ship** — Record N bars, publish→maps, Sovereign settings.
- **Mobile**: feed IS the screen (Suno app pattern); stage collapses to a
  compact visualizer header; inspector = bottom sheet; player bar sticky.

Acceptance: prompt → real ACE-Step song playing in the feed on desktop AND
phone; a feed track attached to a Video Builder lane; jarvis/lady auditioned
from the Voice scope.

## R3 — Video Studio v2 — Runway × CapCut dual-mode

One surface, a **mode switch** in the top bar: `Generate | Edit`.

- **Generate mode (Runway shape)** — NEW:
  - Left rail: prompt, negative, size preset (Draft 384² / Social 480×832 /
    Wide 640×360 — 8GB-safe presets only), frames/fps, seed, style chips,
    optional start-image (from media library or Post Studio slide → i2v).
  - Center: **latest generation player** (loop, scrub) with prominent
    [Regenerate] [Variation] (Udio lesson: iteration in one tap).
  - Bottom strip: **generations gallery** — every Wan render as a card
    (thumb, prompt snippet, size, ▸) backed by the media library; actions:
    → send to Edit timeline · → save to library · → download.
  - All renders via comfyClient; progress with queue position; offline state
    points at start-comfyui.
- **Edit mode** — the existing timeline builder, upgraded not rebuilt:
  - Media drawer gains two tabs: **Generations** (Wan renders) and **Audio
    Library** (music/sfx/voice from R2 feed) — the cross-studio payoff.
  - Voice lane defaults to registry voices (jarvis) once O4 lands; formant
    synth stays as fallback.
  - Keep Moment/Buffer gate as-is (already Post-Studio-grade).
- **Mobile (CapCut shape)**: Generate mode = vertical: prompt sheet over the
  player; Edit mode = preview top, timeline under thumb, tool chips scroll
  horizontally. Inspector = bottom sheet everywhere.
- Later (kept out of this pass): storyboard drafts inbox, /video-batch,
  talking-head lane — they slot into Generate mode's left rail.

Acceptance: prompt → Wan clip in gallery → "send to Edit" → on the timeline
with a feed music track → exported MP4, on desktop and mobile layouts.

## R4 — Pixel Studio v2 — PixelLab × gallery curation

Kill the tab-parade feel; make it **gallery-first with a Forge rail**:

- **Hero = the grid** (Lospec/Midjourney lesson): one dense, virtualized
  gallery of the whole vault; big segmented filter [Library · References ·
  Ingest(n)] replaces separate tabs; facet chips (kind/theme/tier/source) in a
  collapsible filter bar; palette strip + tier dot on every card; hover =
  larger preview + quick actions.
- **Right rail = Forge** (persistent, PixelLab shape): kind, prompt, count,
  via (PixelLab/ComfyUI), style-ref (click any grid card → "use as style
  ref"), Queue brief → brief status list inline. Generating never leaves the
  gallery.
- **Ingest as a review lane**: Ingest(n) filter shows pending cards with
  ✓ promote / ✕ reject inline on the card (the S3a flow, now in the gallery).
- Usage x-ray + Palettes remain as secondary views (menu, not tab row).
- **Mobile**: 2-col grid, filter bar as sheet, Forge as a floating ✚ button →
  full-screen composer sheet.

Acceptance: queue a brief from the Forge rail using a grid card as style ref;
promote a generated sprite from the Ingest lane; grid stays smooth at 1k+ items.

## R5 — Shared polish pass

- Extract: SovereignChip, LibraryFeedCard (audio/video/pixel variants),
  BottomSheet (from Post Studio's), ProgressToast (render progress).
- One mobile QA pass across all four studios at 375×812 (Post Studio parity
  checklist: tap targets, sheet gestures, sticky player/toolbars, no
  horizontal scroll).
- Media Center "Sovereign Rack": per-engine chip + last render + test-render
  button (calls comfyClient).

## Order + sizing

R1 (½ day, blocks all) → R2 (1–1.5 days) → R3 (1.5–2 days) → R4 (1 day) →
R5 (½–1 day). Every phase browser-verified desktop + mobile viewport, one
commit each to main. Post Studio itself is NOT touched (S4 rule).

## Arganta-specific tailoring notes

- Sovereign-only stays absolute: no billing UI anywhere; premium rungs remain
  hidden seams.
- The ARGANTA LoRA (v003-high) enters via R3's start-image path (Post/image →
  i2v) and the image seam — full O1 spec wiring is its own small step.
- Everything generated lands in a library (audio_asset / media_asset /
  pixel_ingest) — the "nothing is ever lost" contract now has a UI face in
  every studio: the feed/gallery IS the library.
