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

---

# COMPONENT SHARPENING (art direction pass)

## The one law: generation is a JOB, never a modal

Music ≈ 24s. Video ≈ 1–15 min on 8GB. Any design where a spinner blocks the
surface is dead on arrival. Every sovereign render follows ONE model everywhere:

**JobCard lifecycle**: press Generate → an optimistic card appears INSTANTLY at
the top of the feed/gallery in `queued` state → `rendering` (live % from
ComfyUI progress, elapsed + estimate) → `done` (auto-play music; video shows
first frame) or `failed` (reason + one-tap [Retry] [Smaller preset]). The user
keeps browsing, editing, even leaves the tab — the card is the job. On
completion while unfocused: ProgressToast bottom-left + document.title tick
("✓ song ready — Audio Studio").

Concurrency: client-side single-flight for heavy jobs (music/video). Second
Generate press ENQUEUES (card shows "queued · #2") — never disables the
button, never drops the request. Chip shows ComfyUI's real queue depth
(`/queue`), because the founder may also be running LoRA training or the
ComfyUI UI itself.

## SovereignChip (shared, top bar of every studio)

- States: ● green "Sovereign" (server up + this studio's model present) ·
  ● amber "Partial" (up, model missing → tooltip names the file + the
  download script) · ○ gray "Offline" (tooltip: "Start ComfyUI —
  start-comfyui.bat", with a copy button) · ◌ pulsing while a job runs.
- Click → popover: per-engine rows (image/music/video: model name, last render
  time), queue depth, VRAM free, [Test render] per engine, Comfy URL field.
- Poll /system_stats every 30s, backoff ×4 when offline (no console spam).

## Engine badge language (one vocabulary, all studios)

- `SOV` solid green — sovereign ComfyUI bytes (ACE/Wan/z-image)
- `GEN` outline — deterministic browser engine (synth theme, formant voice, canvas)
- `LIB` neutral — classical anthem / uploaded / stock
- Never a paid badge; premium seams stay invisible (sovereign-only mandate).
Badges are 9.5px mono uppercase pills, same geometry as Post Studio's pills.

## AudioFeedCard (R2) — anatomy, 68px tall desktop / 76px mobile

`[▸ 40px] [waveform 1fr] [meta 30%] [badge] [⋯]`
- Waveform: real peaks (decode blob → 96 buckets → 2px bars, `--acc` at 40%,
  played portion 100%). Rendering state: animated placeholder bars. Cached in
  IndexedDB beside the blob so scroll-back never re-decodes.
- Meta: name (auto: first 4 words of tags — editable inline on click), duration,
  relative time. ⋯ menu: Use in Video · Set as map theme · Download · Rename ·
  Archive (no hard delete — archive filters out; contract: nothing is lost).
- Tap targets ≥44px; whole card is the play toggle except the ⋯ zone.

## PlayerBar (R2) — singleton, docked under stage / sticky bottom on mobile

One `<audio>` element app-wide (two tracks never fight). Height 56px.
`[▸] [title — engine badge] [scrubber] [time] [⤓]`.
**Art-director requirement**: the 3D stage must dance to sovereign MP3s, not
just the synth engine — route the audio element through the existing
AnalyserNode (`ctx.createMediaElementSource`) so the stage is ONE visualizer
for every engine. A dead stage while a real song plays would read as broken.
Keyboard: space = play/pause when the studio has focus.

## Generate scope (R2) — Suno-tuned

- Simple: one textarea ("describe the song…") + duration chips [15s 30s 60s
  120s] + [Generate]. Custom: tags / lyrics (collapsible) / BPM / key /
  duration / seed (♻ randomize). Mode is a 2-tab segment, remembered.
- Under the button, live cost honesty: "≈ 25s on your GPU · queue 0".
- Offline fallback is EXPLICIT, not silent: button becomes [Compose draft
  (offline)] which runs localCompose — label tells the truth about which
  engine will run (offline-safe seam, Post Studio rule).
- Every render auto-saves: blob → IndexedDB immediately (playable this
  session even signed-out), then audio_asset upload when session allows;
  card shows a small cloud tick when the library row exists — signed-out is a
  degraded-sync state, never a data-loss state.

## VideoGenerationCard + presets (R3)

- Presets are named by INTENT with honest estimates measured on the 3070 Ti:
  `Draft 384² · 25f · ~40s` · `Social 480×832 · 49f · ~4min` · `Wide 640×360 ·
  49f · ~4min`. No free-form res on mobile; desktop Advanced discloses w/h/frames
  with a live "~time · VRAM risk" readout. Anything projected >8 min shows an
  amber "long render" note before queueing.
- Card states: queued (#n) / rendering (%, elapsed/estimate, [Cancel] via
  /queue delete) / done (hover-loop preview, duration chip) / failed. OOM
  failures are DETECTED (error string match) and the card's primary action
  becomes [Retry at Draft] — the fix is one tap, not a lecture.
- Actions: ▸ full preview · Send to Edit · Save/Download · ⟳ Variation (same
  spec, new seed — Udio one-tap law) · Use last frame as start image (chains
  clips, the poor-man's "extend").
- Gallery: newest-first grid (2-col mobile, 4-col desktop), virtualized past 40.

## Generate|Edit mode switch (R3)

Segmented control in the top bar, state in the store (survives tab-away).
"Send to Edit" = one clip payload `{blobUrl, w, h, fps, duration, prompt}` →
appears in Edit's media drawer "Generations" tab with a pulse highlight; the
switch itself flips to Edit with a 250ms crossfade. No drag-and-drop required
for v1 — tap-to-add at playhead.

## PixelGallery (R4)

- Card: art on checkerboard (image-rendering: pixelated), tier dot (T0 green /
  T1 amber / T2 red), palette strip (≤6 swatches, 4px), name on hover
  (desktop) / always (mobile). Ingest cards get a soft amber outline +
  ✓/✕ floating on the card corner — review without leaving the grid.
- Filter bar: segmented [Library · References · Ingest(n)] + facet chips;
  active facets render as removable tokens. Virtualized grid (windowed rows),
  target 60fps at 1k items.
- Forge rail: [style ref slot] — populated by clicking any card's "◎ use as
  ref" (slot shows the sprite thumbnail, not an id string). Brief status list
  under the composer with live pending/done dots.
- Signed thumb URLs expire (1h): on img error, re-sign once and swap silently.

## BottomSheet + mobile grammar (R5, extracted from Post Studio)

- Snap points 40% / 90%; drag handle; backdrop tap closes; scroll-within-sheet
  locks page scroll. Sticky elements stack bottom-up: PlayerBar above tab bar,
  toasts above PlayerBar.
- Thumb map: primary action bottom-right (Forge ✚, Generate), destructive
  never in the thumb zone.
- Reduced-motion: stage → 2D, crossfades → cuts (respects existing pref).

---

# BATTLE TEST (chief testing officer pass — failure modes designed, not hoped)

| # | Scenario | Verdict without design | Designed behavior |
|---|---|---|---|
| 1 | Video render 10 min, user switches surface | job lost, user confused | Job store is app-level (zustand), not component state — cards persist across surfaces; toast + title tick on done |
| 2 | ComfyUI not running | dead buttons, silent failure | Chip gray everywhere; Generate becomes offline-fallback (music) or CTA "Start ComfyUI" + copy command (video); zero silent failures |
| 3 | OOM on 8GB (big video) | cryptic error | Detected → [Retry at Draft] one-tap; presets prevent most cases up front |
| 4 | Second render while first runs | double GPU load → OOM | Client single-flight queue + real /queue depth in chip; card shows position |
| 5 | LoRA training / founder using ComfyUI UI concurrently | jobs collide | Same /queue is shared — our jobs enqueue behind; chip shows depth so the wait is explained |
| 6 | Signed out / Supabase down | renders lost = contract broken | IndexedDB-first: blob playable immediately, cloud sync is an upgrade with a visible tick; retry sync on sign-in |
| 7 | Refresh mid-render | orphaned job | On mount, reconcile /history for prompt_ids stored in IDB; finished renders are recovered, not lost |
| 8 | Two audio sources playing (stage synth + MP3) | cacophony | PlayerBar singleton owns the audio element; pressing sovereign play stops the generative transport (same rule the anthem player already follows) |
| 9 | Stage dead during MP3 playback | feels broken | MediaElementSource → shared AnalyserNode; one visualizer for all engines |
| 10 | 1k+ pixel items / 200 audio rows | jank | Virtualized grid/feed; waveform peaks cached; thumbs lazy + re-sign on expiry |
| 11 | Signed thumb URL expired after 1h idle | broken images | Silent single re-sign on error (R4 spec) |
| 12 | Mobile: sheet open + player + keyboard | overlap chaos | Fixed stacking order; sheet max 90%; input focus scrolls within sheet |
| 13 | Accidental archive | data loss fear | Archive is a filter, never a delete; undo toast 5s |
| 14 | First run, empty feed/gallery | blank screen | Starter prompts as tappable cards (Post Studio starter pattern): 3 music prompts, 3 video prompts, 3 pixel briefs |
| 15 | Wan model absent (fresh machine) | confusing failure | Chip amber names the missing file + script; Generate disabled with the same message inline |
| 16 | Long prompt / emoji in names | layout break | Names clamp 1 line + ellipsis; auto-name from tags truncated at 40 chars (matches slug rule) |
| 17 | Video "Send to Edit" then blob GC'd | broken clip | Payload persists blob to IDB + media library BEFORE handoff; drawer reads from storage, not memory |
| 18 | Reduced-motion users | motion sickness | Stage 2D, no crossfades, progress by text % (existing pref respected) |

**Definition of done per phase (test script, run on desktop + 375×812):**
1. Generate with ComfyUI up → card lifecycle → artifact plays/loops.
2. Kill ComfyUI mid-render → failed card + retry works after restart.
3. Generate signed-out → playable locally, syncs after sign-in.
4. Queue two jobs → both complete in order, chip depth correct.
5. Refresh mid-render → job recovered from /history.
6. Empty-state first-run shows starters; archive+undo works.
7. No console errors, no horizontal scroll, tap targets ≥44px.

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
