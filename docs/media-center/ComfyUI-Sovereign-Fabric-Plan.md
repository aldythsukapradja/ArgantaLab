# ComfyUI Sovereign Fabric — end-to-end build plan (Opus executor)

Goal: local ComfyUI (`127.0.0.1:8188`, RTX 3070 Ti 8GB, Desktop 0.28) becomes the
**single source of truth for all generated media bytes** — image, music, SFX,
voice, video, GLB/3D assets, pixel-style images — behind the existing
maturity-staged `@arganta/media-core` router and `tools/media-gen-mcp`.
Code-shaped output (websites, app UI, Three.js) stays with Builder v2 Forge /
LLMs, which *consume* ComfyUI assets. PixelLab MCP remains the dedicated
game-pixel-art organ.

Doctrine per modality:
- Tier 0 (Sovereign) = local ComfyUI, zero marginal cost, always falls back to
  the deterministic engine on any failure (never hard-fail).
- **Sovereign-only mandate (2026-07-17): no billing solutions active.** Premium
  tiers (Modal / Higgsfield / ElevenLabs / fal.ai) are dormant code seams —
  hidden by default, never required, re-enabled only by explicit founder
  action. Modal is set aside entirely.
- Every ComfyUI output persists via the existing persist seam (Supabase
  `media-artifacts` bucket + `media_asset` lineage row) when keys are set.

Proven adapter pattern to copy for every modality
(`packages/media-core/src/adapters/comfy-sovereign.js`):
list `/models/<folder>` → build API-format graph → POST `/prompt` → poll
`/history/<id>` → GET `/view` → bytes; try/catch → deterministic fallback with
`extra.comfyError`.

---

## Phase O0 — Make ComfyUI the actual priority (wiring only, 1 session)

1. `tools/media-gen-mcp/.env`: set `MEDIA_PROVIDER_ORDER=local,cloudflare,leonardo`,
   `COMFY_URL=http://127.0.0.1:8188`. Verify with a real `generate_image` call
   that provenance says `local-comfyui`.
2. media-core: the comfy adapter only registers when `COMFY_URL` is set in
   `process.env` (registry.js:29). Add a browser path: HQ surfaces should reach
   ComfyUI through a tiny local proxy route or direct fetch (CORS is already
   `*`), controlled by a `localStorage hq_comfy_url` setting + Settings toggle
   in HQ. Fallback unchanged.
3. Health surface: add a "Sovereign Rack" status chip (server up, models
   present, VRAM) to Media Center / Architecture surface via `/system_stats`.

Acceptance: Post Studio image generation provenance = `local-comfyui` when the
server is up; graceful fallback proven by killing the server mid-run.

## Phase O1 — Soul ID completion: ARGANTA LoRA (blocker for identity work)

`loras/` is EMPTY today — nothing downstream is character-consistent until this.
1. Run the character-studio pipeline end to end
   (`arganta-character-studio/workflows/run.py` + `soul_graphs.py`): curate seed
   set → train SD1.5 character LoRA (kohya/musubi outside ComfyUI or
   train-nodes; 8GB is fine for SD1.5 rank-16) → drop into
   `ComfyUI-Shared/models/loras/arganta_v1.safetensors`.
2. Extend BOTH comfy image code paths (media-core adapter + media-gen provider)
   with optional spec fields: `loraName`, `loraStrength`, `refImage`
   (IP-Adapter plus-face), `pose` (ControlNet openpose), `faceDetail: true`
   (FaceDetailer pass). Auto-include LoRA when `character: 'arganta'`.
3. Identity test matrix in `arganta-character-studio/tests/` — contact sheet of
   poses/expressions; founder signs off visually.

Acceptance: `generate_image({character:'arganta', ...})` from MCP returns a
consistent face across 8 prompts.

## Phase O2 — Music: ACE-Step 1.5 (biggest quick win, <4GB VRAM)

1. Download ACE-Step 1.5 model set into ComfyUI model dirs (Comfy Desktop
   template `audio_ace_step_1_5` exists; nodes `EmptyAceStep1.5LatentAudio`,
   `TextEncodeAceStepAudio1.5` are built-in).
2. New adapter `packages/media-core/src/adapters/comfy-sovereign-music.js`
   (kind `music`, tier 0, node runtime): spec = { prompt/tags, lyrics?,
   durationSec, seed } → ACE graph → poll → FLAC/MP3 bytes.
3. New MCP tool `generate_music` in `tools/media-gen-mcp` (same persist seam).
4. HQ Music Builder: add "Sovereign render" button — send composer output
   (style tags + lyrics) to ComfyUI, keep the procedural engine as preview/
   fallback. Store result in media library.

Acceptance: a full 60s song generated locally, playable in Music Builder,
lineage row written.

## Phase O3 — SFX/ambient: Stable Audio Open

1. Download Stable Audio Open weights; nodes `ConditioningStableAudio` +
   `EmptyLatentAudio` are built-in.
2. Adapter `comfy-sovereign-sfx.js` (kind `sfx`): { prompt, durationSec ≤ 47 }.
3. `generate_sfx` MCP tool. Wire as tier-0 for game audio / Video Builder
   stingers.

## Phase O4 — Voice: TTS-Audio-Suite (two AI-assistant voices, NOT the founder yet)

Founder decision (2026-07-17): do **not** clone the founder's own voice yet.
Ship two neutral assistant voices first:
- **`jarvis`** — a British male AI-assistant voice (Jarvis-*style*, calm,
  crisp RP). NOTE: do not clone Paul Bettany's actual JARVIS performance
  (copyrighted). Use a built-in British-male preset or a royalty-free/self-
  generated RP reference sample — the *character* of the voice, not the actor.
- **`lady`** — a British female voice (warm, clear RP).

1. Install custom node `diodiogod/TTS-Audio-Suite` (Chatterbox + VibeVoice +
   IndexTTS-2; py3.13 friction possible — lock versions in
   `arganta-character-studio/environment/custom-nodes-lock.md`). Voice model
   weights auto-download on first node run.
2. Build two voice profiles under `arganta-character-studio/voices/`:
   `jarvis.wav` + `lady.wav` reference samples (5–15s each, RP accent). Source
   from a royalty-free British VO or a first-pass generated sample refined —
   NOT a celebrity clone. Founder approves the two samples before they're
   locked as the profiles.
3. Adapter `comfy-sovereign-voice.js` (kind `voice`): { text, voiceId:
   'jarvis'|'lady', pace, emotion? } → TTS graph → WAV bytes.
   `generate_voice` MCP tool. Voice registry is data-driven so a `founder`
   profile can be added later with zero code change.
4. Cinema TTS: local jarvis/lady becomes the DEFAULT engine
   (browser → **local jarvis/lady**; ElevenLabs dormant — sovereign-only
   mandate). Video Builder narration switches from formant synth to `jarvis`
   by default. Copilot command replies resolve through the same registry.

Acceptance: 30s of the same script rendered in BOTH `jarvis` and `lady`
locally, playing in Cinema; no billing path reachable without an explicit
re-enable; adding a third voice is a data edit, not a code change.

## Phase O5 — Video: Wan 2.2 5B / LTXV 2B draft tier

8GB reality: Wan 2.2 TI2V-5B FP8 ≈ 5s 720p with offload (needs the 32GB system
RAM you have); LTXV 2B = faster/lower quality. Modal + Higgsfield remain the
quality tiers; this is the free draft tier. Update the stale "video will OOM"
note in `tools/comfyui/README.md`.
1. Download Wan 2.2 TI2V-5B FP8 (+ its VAE/encoder) — nodes are built-in
   (`WanImageToVideo`, `Wan22ImageToVideoLatent`, FirstLastFrame).
2. Adapter `comfy-sovereign-video.js` (kind `video`): text→video and
   image→video (feed an O1 character still for identity-locked clips);
   { prompt, image?, seconds ≤ 5, fps }. Long poll (10–15 min budget),
   `run_in_background` semantics in the MCP tool (`generate_video` returns a
   job id + `video_status` tool).
3. HQ: IG Simulator / Post Studio "animate this slide" action; Video Builder
   T2 draft-polish rung before Higgsfield.
4. Stretch (flagged, only if 5B proves stable): `WanSoundImageToVideo` /
   `WanInfiniteTalkToVideo` talking-head test — ARGANTA still + O4 voice track
   → lip-synced reel. This is the mini-Higgsfield prize; treat as experiment,
   not acceptance-gated.

## Phase O6 — 3D: Hunyuan3D v2 → GLB

1. Download Hunyuan3D v2 (small variant fits 8GB, slow) — nodes built-in.
2. Adapter `comfy-sovereign-3d.js` (new kind `model3d` in media-core
   contracts): { image | prompt→O0 image first } → mesh → **GLB bytes**.
   `generate_3d_local` MCP tool (Higgsfield `generate_3d` stays premium tier).
3. Consumers: Character Forge stage (load GLB via three.js GLTFLoader),
   Forge-built games/sites get local GLB assets.

## Phase O7 — Pixel-style + UI-asset routing (routing doctrine, small)

1. Pixel art: game assets (sprites/tilesets/animations) → PixelLab MCP
   (already connected, purpose-built). One-off pixel-style *images* → ComfyUI
   with a pixel-art LoRA (download one SD1.5 pixel LoRA) + palette-quantize/
   downscale post nodes. Expose as `style: 'pixel'` on generate_image.
2. UI/UX: ComfyUI does NOT generate code. Builder v2 Forge keeps generating
   HTML/CSS/JS/React; add a Forge seam that requests hero/background/icon
   images from media-core (which now resolves to ComfyUI tier 0). Document the
   split in this file's doctrine section.

## Phase O8 — Fabric hardening + HQ command deck

1. Media Center "Sovereign Fabric" panel: per-modality status (model present?,
   last render, queue depth via `/queue`), one-click test render each.
2. Job queue etiquette: serialize heavy jobs (one video OR one music at a
   time) — simple mutex in the MCP server; interactive image jobs may
   interleave.
3. Persistence audit: every adapter path writes bucket + lineage when keys
   set; add `engine: comfyui` + graph hash to `media_asset.extra` for
   reproducibility.
4. Registry: media-core `stagesFor()` now reports tier-0 sovereign for all six
   kinds; four-tier router costClass 0 mapping verified.
5. Docs: update `tools/comfyui/README.md` (Desktop is canonical, video note),
   memory files.

---

# Track S — Studio Revamp (HQ surfaces on the Post Studio DNA)

Post Studio (`apps/hq/src/surfaces/broadcast/`, ~1900 lines + engine files) is
the maturity reference. Its DNA, which every studio must adopt:

1. **One workspace**: top bar → canvas-true stage → right inspector with THREE
   scope tabs (Compose = content, Style = look, Post/Ship = output) → bottom
   strip (units of the doc: slides/scenes/tracks).
2. **Ingest funnel** (many ways in): Drafts inbox fed by MCP tools, batch
   channel (verbatim docJson), Copilot prompt→doc, templates, Supabase media
   library + stock import, brand kit, saved style recipes.
3. **AI seams, offline-safe**: generateCopy/generateImage/polish via Arganta
   Core with deterministic local fallback; never hard-fails.
4. **Immutable Library** with publish marks (postLibrary pattern — re-publish
   marks the SAME row, no forks).
5. **Publish fan-out gate** (many ways out): exact-size export + Kinetik
   Moment + Buffer→IG, per-platform intelligence — the single gate before
   anything leaves Arganta.

Studios today vs. that bar:
- **Music Studio** (466 lines): good chrome (same top/stage/inspector/strip
  family) but a single narrow outlet — `publishMusicLibrary` → game maps only.
  No track library, no SFX authoring (SFX Forge is buried in Legacy), no
  drafts inbox, Record = local .webm download that vanishes, and no other
  surface can consume its output (Video Builder synthesizes its own SFX
  directly from @arganta/audio, bypassing Music Studio entirely).
- **Video Builder** (742 lines): has the outbound gate (Moment + Buffer) but
  no library, no drafts inbox, no templates/recipes, formant-synth voice only,
  audio is hand-rolled per project instead of pulled from a shared library.
- **Pixel Vault** (71-line shell): pure catalogue — References/Library/Ingest/
  Usage/Palettes browsing. Zero creation. Not a studio at all yet.

## Phase S1 — Arganta Audio Studio (Music Studio v2) — THE audio single source of truth

**Sovereign-only mandate (founder, 2026-07-17): NO billing paths. Every audio
capability runs local (browser engines or ComfyUI). Paid tiers (ElevenLabs,
"Premium" rungs in Cinema) are hidden/disabled by default — kept as dormant
code seams only, never the default, never required.**

Rename Music Builder → **Audio Studio**, covering **music + SFX + voice** —
one surface, three domains. Inspector scopes on the existing chrome:
**Compose** (current theme editor + Composer AI) · **SFX** (promote SFX Forge
out of Legacy: recipe grid, edit, preview, save) · **Voice** (new — see
below) · **Ship** (outputs).

**Voice tab — the centralized voice registry.** Voice is already consumed in
TWO surfaces with no home: Copilot control (52 voice commands, per-command
voice replies) and Cinema (46 scenes, JM·Jarvis / KF·Specialist picker with
Experiment/Economical/Premium tiers). The Voice tab becomes the single
registry both read:
- `voice_profile` registry (data-driven): id (`jarvis`, `lady`, later
  `founder`), display name, engine (browser preset → local TTS → dormant
  premium), reference sample path, style params. Stored with the audio
  library; Copilot + Cinema resolve voices BY ID from here instead of
  hard-coding JM/KF.
- Audition panel: type a line, hear it in each profile, A/B engines.
- Batch re-record: Cinema's 46 clips re-render against a profile in one run
  (the existing per-scene "Re-record" generalized).
- Cinema's tier buttons re-map: Experiment = browser synth, Economical =
  **local ComfyUI TTS** (was cheap-cloud), Premium = hidden until explicitly
  re-enabled. Copilot replies use the same resolution chain.
1. **Audio Library** (the core fix): every Record/render lands as a row in the
   shared media library (Supabase `media-artifacts`, kind audio: track | sfx |
   voice | anthem) with name, tags, duration, provenance — mirroring
   postLibrary's immutable + publish-marks model. Local download becomes a
   side effect, not the product.
2. **Consumers**: Video Builder's music/waveform + SFX lanes get an "Audio
   Library" picker (replacing its private SFX synthesis path); Post Studio
   reels can attach a library track; game publish (`publish → maps`) stays as
   one fan-out destination among several — Moment/Buffer audio hand-off goes
   through Video Builder.
3. **Sovereign render**: O2 (ACE-Step music) + O3 (Stable Audio SFX) + O4
   (voice) surface here — a "Render (Sovereign)" button next to Record: theme
   prompt/tags → ComfyUI → real song bytes → Audio Library. Generative
   in-browser engine stays as instant preview + fallback.
4. **Drafts inbox**: `audio_draft` briefs from MCP (same contentDrafts
   pattern) — "compose a 45s upbeat kitchen theme" authored in Claude lands in
   the inbox.

Acceptance: one track composed → library row → picked inside Video Builder's
timeline → exported in an MP4; one SFX authored in the SFX tab → used by a
game publish AND a video.

## Phase S2 — Video Studio v2

Keep the timeline (it's good); add the missing DNA:
1. **Video Library** (immutable + publish marks) — every export saved with
   thumbnail, format, provenance; re-publish marks the same row.
2. **Drafts inbox + batch channel** — storyboard briefs from MCP land in an
   inbox; a `/video-batch` skill mirrors `/post-batch`.
3. **Scene templates + style recipes** — extract look (palette, fonts, fx
   toggles, anim set) as a recipe, reapply to any project.
4. **Audio from S1**: music + SFX + voice lanes pick from the Audio Library;
   O4 cloned voice replaces formant synth as the default narrator tier.
5. **Sovereign footage**: O5 Wan/LTXV image→video clips as timeline media
   ("animate this scene"), and the talking-head experiment feeds a reel lane.
6. Post Studio cross-talk: "make a reel from this post" (slides → scenes) and
   "make a carousel from this video" (scene stills → slides).

## Phase S3 — Pixel Studio v2 (catalogue → builder) + Vault Ingest Contract

**Audit finding (2026-07-17)**: the vault has a real schema (`pixel_asset` +
`pixel_palette` + private `pixel-art` bucket, migration_pixel_vault.sql) and a
read path (cloud.ts, signed thumbs) — but **NO write path from any
generator**. `INGEST` in ingest.ts is a hard-coded 3-item seed array; there is
no `pixel_ingest` table; PixelLab MCP outputs live on PixelLab's servers and
never land in the vault; media-gen-mcp persists to the *generic*
`media-artifacts` bucket which carries none of the vault's tier/license/kind/
palette metadata. Any pixel art generated today is effectively lost to the
vault. S3 fixes this with a hard contract:

**S3a — Vault Ingest Contract (the storage rule, non-negotiable)**
- **Single destination**: ALL generated pixel art (PixelLab, ComfyUI pixel
  LoRA, any future source) writes to the `pixel-art` bucket + a new
  `pixel_ingest` table — never only to `media-artifacts`, never only on the
  generator's servers, never a bare local file. (A `media_asset` lineage row
  MAY be written additionally for run accounting, pointing at the same path.)
- **Storage layout** (organized, deterministic):
  `generated/<kind>/<yyyy-mm>/<slug>-<shortid>.png` for stills;
  animations upload the sprite sheet + a sibling `.json` (frames/fps/
  directions per the `Animation` type). Promotion MOVES nothing — the
  `pixel_asset.storage_path` points at the same object; only metadata changes.
- **Schema**: extend migration_pixel_vault.sql with `pixel_ingest`
  (id, suggested_name, generated_via, style_ref_id, prompt, size, swatch,
  suggested_tags, storage_path, animations jsonb, status
  pending|rejected|promoted, created_at). Extend `IngestItem` type with
  `storagePath` + `prompt`. Replace the seed-array ingest.ts with a cloud
  loader (same pattern as cloud.ts), seeds as offline fallback.
- **Id + provenance**: promoted items get `asset.<kind>.<slug>` ids; source =
  { name: 'pixellab'|'comfyui', sourceId: generator job id, license: 'CC0',
  tier: 'T0', fetchedAt } — generated art is always T0/owned; `styleRefId`
  recorded in relationships.derivedFrom so style lineage survives promotion.
- **MCP write tool**: `pixel_vault_ingest` in tools/media-gen-mcp (service
  key, same persist.ts posture): downloads bytes from PixelLab (or takes
  ComfyUI bytes directly), uploads to the bucket, inserts the pixel_ingest
  row. Claude-driven batch generation lands in the queue automatically —
  nothing reaches the canonical Library unreviewed (verdict-queue discipline).

**S3b — Forge tab** on the Pixel surface (keep the vault tabs — they're the
library half of the DNA, already done):
1. Builder panel: prompt + type (character/8-dir sprite/animation/tileset/
   UI asset) → **PixelLab MCP** for game assets; `style:'pixel'` ComfyUI LoRA
   (O7) for one-off stylistic pixel images. Every result goes through the
   S3a contract → appears in the Ingest tab with preview, suggested
   name/tags, style-ref link.
2. Ingest review upgrade: promote = create `pixel_asset` row (curated fields
   editable in a side form, palette auto-extracted into swatch) · reject =
   status flip, object retained 30 days. Badge counts already exist in the
   tab strip.
3. Batch briefs: "12 crop sprites for LashiraBloom" from MCP → generate →
   queue fills; founder reviews in one sitting.
4. Publish gate: promote from Library → game asset pipeline (the id-addressed
   canonical store apps consume) — same publish-marks model.

Acceptance: a PixelLab character generated from the Forge tab appears in
Ingest with its sprite sheet stored under `generated/character/…` in the
pixel-art bucket, promotes into Library with T0 provenance, and its signed
thumb renders in the References/Library browser.

## Phase S4 — Shared studio DNA extraction

After S1–S3 land, extract the repeated organs into shared modules so the next
studio is cheap: `StudioLibraryPanel` (immutable rows + publish marks),
`DraftsInbox` (contentDrafts generalized by kind), `StyleRecipes`,
`MediaPicker` (Supabase assets by kind), publish fan-out sheet
(Moment/Buffer/export). Post Studio migrates onto them LAST (it works today —
don't destabilize the mature one first).

---

## Battle-test notes (risks Opus must design around)

1. **Split-brain storage**: media-gen-mcp already persists images to
   `media-artifacts`. Without the S3a contract, pixel art would live in two
   stores with different metadata. Rule: kind decides the store — pixel art →
   pixel-art bucket (vault metadata), everything else → media-artifacts.
2. **Browser can't hold service keys**: the Forge tab must not write with the
   service role. Writes go through the MCP tool (Claude-driven) or through
   the signed-in admin session (RLS policies already gate the bucket to
   is_admin) — verify the operator's session satisfies the write policy
   before building the in-UI promote flow.
3. **ComfyUI single-flight**: one 8GB GPU. The MCP server must serialize
   heavy jobs (video/music) behind a mutex or queue-depth check
   (`/queue`); concurrent Wan + ACE jobs will OOM. Image jobs may interleave.
4. **Long jobs vs MCP timeouts**: video (10–15 min) cannot block a tool
   call — generate_video returns a job id; `video_status` polls. Same for
   LoRA training (hours; runs outside MCP entirely).
5. **Audio Library double-publish**: S1 keeps `publishMusicLibrary → maps`
   AND adds library rows. Guard against the game sanitizer picking up new
   fields; anthem-style ride-along extras are the proven pattern.
6. **py3.13 custom-node friction**: TTS-Audio-Suite may not build clean on
   the Desktop venv (insightface already failed once). Lock working versions
   in custom-nodes-lock.md; if an engine won't build, ship with the engines
   that do — the adapter contract only needs one.
7. **localStorage docs**: Post Studio's doc lives in `hq_post_studio_v1`;
   new studios must namespace their stores (`hq_audio_studio_v1`, …) and
   version-gate like loadDoc() does, or a schema change bricks the surface.
8. **Don't touch Post Studio until S4**: it is the revenue-adjacent mature
   surface. All shared-organ extraction happens by copying OUT of it, never
   by refactoring it in place before the copies are proven.

## Combined ordering for Opus
O0 → O2 → **S1** (audio OS lands with sovereign music inside) → O3 → O4 →
**S2** → O1 → O5 (feeds S2's sovereign footage) → **S3** + O7 → O6 → **S4** →
O8. Studio phases are UI-heavy: verify each in the browser preview (screenshot
proof), keep Post Studio's post.css design language (same tokens/classnames
family), commit per phase to main.

## Model download budget (all free/open)
- ACE-Step 1.5 core (~few GB) · Stable Audio Open (~2GB) · TTS-Audio-Suite
  engines (Chatterbox ~2GB) · Wan 2.2 TI2V-5B FP8 (~8–10GB on disk) · LTXV 2B
  (~5GB) · Hunyuan3D v2 small (~1–2GB) · 1 pixel-art SD1.5 LoRA (~150MB).
Disk check before O5 (Wan set is the big one).

## Order + sizing for Opus
O0 (wiring, ½ day) → O2 (music, 1 day) → O3 (sfx, ½ day) → O4 (voice, 1 day)
→ O1 (LoRA, 1–2 days incl. training time) → O5 (video, 1–2 days) → O6 (3D,
1 day) → O7 (routing, ½ day) → O8 (hardening, 1 day).
O1 is ordered after O4 only because training runs unattended overnight; start
the dataset curation early. Each phase lands as its own commit to main
(founder rule: main only), each with a verified real render as proof.
