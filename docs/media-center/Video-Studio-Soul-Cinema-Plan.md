# Video Studio v3 — "Soul Cinema" (Soul ID + Higgsfield-class cinematic video)
## End-to-end build plan (Opus executor)

Goal: upgrade `apps/hq/src/surfaces/video/` (VideoStudio → Generate | Edit today)
into a **Soul Cinema** studio: Higgsfield's two killer capabilities — **Soul ID
character consistency** and **Cinema Studio camera control** — replicated
**sovereign-first on local ComfyUI** (RTX 3070 Ti 8GB, `127.0.0.1:8188`), with
Higgsfield itself (media-gen MCP `generate_video` premium path) as the dormant
T2 polish rung per the sovereign-only mandate (2026-07-17, no billing active).

This plan supersedes/absorbs Phase **S2 Video Studio v2** in
`ComfyUI-Sovereign-Fabric-Plan.md` and completes Phase **O1** (Soul ID LoRA
wiring) for the video path. Founder rule: commit each phase to main, browser-
verified with screenshot proof, keep the Post Studio design-token family.

---

## 1. Research digest — what Higgsfield actually does (2026)

**Soul ID** (identity layer):
- Train on **20–80 photos, ≥960px**, varied angles/expressions, no
  sunglasses/masks/extreme expressions, consistent lighting. ~3–5 min train.
- Builds an *internalized face model*, not single-image reference matching —
  that's why it survives style presets, lighting, and camera-angle changes.
- Once trained, identity auto-applies across **image AND video** generation
  (Seedance 2.0, Veo 3.1, Kling 3.0, WAN 2.6) with no re-upload.
- 20+ style presets (editorial, retro, Y2K…) applied on top of the locked face.

**Cinema Studio / WAN Camera Control** (cinematic layer):
- Deterministic camera logic executed at generation time, uniform across all
  models: **dolly in/out, orbit/360, crane up/down, tracking, pan, focus
  pulls / DoF shifts**.
- Configurable: camera path + inertia/speed curves, lens/focal-length
  emulation (35/50/85mm), sensor type, motion weight (slow=contemplative,
  fast=energetic), handheld/shake stabilization logic.
- Recommended workflow: intent → detailed prompt → pick motion preset → pick
  lens → set focus logic → **validate at 720p draft before upscaling**.

**The product insight to copy**: Higgsfield ≠ a better model. It is
(a) a trained identity asset that is *reused* across every render, plus
(b) a *preset library of named camera moves* compiled into whatever backend
runs, plus (c) a draft→final ladder. All three are replicable as UI + graph
templates on our stack.

## 2. ComfyUI replication map (8GB-honest)

| Higgsfield capability | Sovereign ComfyUI equivalent | Status |
|---|---|---|
| Soul ID training | SD1.5 rank-16 character LoRA (kohya/musubi, character-studio pipeline) — `arganta-sd15-v003-high` **already in `loras/`** | trained ✅, not wired into video |
| Soul ID stills (identity keyframes) | SD1.5 + LoRA + IP-Adapter plus-face + ControlNet openpose + FaceDetailer (character-studio graphs 00–06) | graphs exist, spec fields not exposed |
| Identity in video | **I2V bridge**: Soul still = first frame → `WanImageToVideo` (Wan 2.2 TI2V-5B, shipped O5 engine). Face carries from frame 0. | engine live ✅ |
| Identity under motion (face drift fix) | Phase 2: train a **Wan 2.2 character LoRA** (T2V-trained LoRAs work inside I2V; dataset must teach identity *under change* — varied pose/expression/angle). RunComfy/ai-toolkit recipe; cloud-train if 8GB blocks it, weights come home. | later, optional |
| Camera presets (dolly/orbit/crane/pan/track/zoom) | **Wan 2.2 Fun Camera Control** (Alibaba PAI `Wan2.2-Fun-A14B-Control-Camera` — too big for 8GB) → 8GB path = **prompt-compiled camera grammar** on TI2V-5B (motion presets compile to prompt clauses + negative prompts + fps/frame count), plus optional **LightX2V 4-step LoRA** for fast drafts. Fun-Camera stays a dormant seam for a bigger GPU / cloud runner. | build |
| Lens / DoF / film look | Prompt-compiled lens grammar ("85mm, shallow depth of field, anamorphic bokeh, film grain") + post nodes (grain, LUT via simple color nodes) | build |
| Draft→final ladder | Draft 384² 25f → Social/Wide 49f → (dormant) T2 Higgsfield polish; RIFE frame interpolation + upscale nodes as the local "final" rung | partial |

Key 8GB facts already proven in this repo: Wan 2.2 TI2V-5B FP8 renders real
MP4s via weight offload (keep ≤ 480×832 / 49 frames); image engine + LoRA
verified; single-flight GPU via jobStore/MCP mutex is mandatory.

## 3. Product design — Video Studio v3 tab structure

`VideoStudio.tsx` mode bar grows from 2 to 5 modes (same `seg` chrome):

**Soul** · **Generate** · **Cinema** · **Edit** · **Library**

1. **Soul** (new — the Soul ID tab): character manager.
   - Character cards (from a `soul_profile` registry: id, name, LoRA file,
     strength, trigger token, ref-image path, status draft|approved).
     v1 ships with `arganta` (existing LoRA).
   - **Keyframe forge**: prompt + pose preset + style preset (12 curated looks:
     editorial, film noir, golden hour, Y2K, studio portrait, …) → SD1.5
     LoRA+IP-Adapter+FaceDetailer still → contact-sheet gallery → "Approve as
     keyframe" saves to media library tagged `soul:<id>`.
   - **Identity test matrix** button: renders the 8-prompt consistency sheet
     (character-studio tests) for founder sign-off.
   - "Animate" on any keyframe → jumps to Cinema with that still preloaded.
2. **Generate** (existing, upgraded): keeps the Runway-shaped rail; adds
   optional **Character picker** (injects LoRA-rendered first frame → i2v
   instead of pure t2v) and **Look picker** (style recipes).
3. **Cinema** (new — the Higgsfield-clone tab): the camera-direction surface.
   - Left rail: source (Soul keyframe | library image | upload | none=t2v),
     prompt, then the **Camera Rack**:
     - **Move** preset grid (12 named moves w/ tiny SVG/CSS motion glyphs):
       Static, Dolly In, Dolly Out, Orbit L/R, Crane Up/Down, Pan L/R,
       Tracking, Push-in + Handheld, Slow Zoom.
     - **Lens**: 24mm wide / 35mm / 50mm / 85mm portrait / macro.
     - **Motion weight**: Slow drift / Natural / Energetic.
     - **Look**: film grain, teal-orange, noir, clean digital (post toggles).
   - Each control compiles deterministically into the prompt + graph params via
     a pure `cameraGrammar.ts` (unit-testable string builder — the "camera
     codes" of our system). Preset ladder identical to Generate (Draft first).
   - Center player + gallery reuse `VideoGenerate`'s components (extract them).
4. **Edit**: the untouched timeline builder (VideoBuilder), unchanged.
5. **Library** (new): the S2 immutable Video Library — every kept render +
   every Edit export as a row (thumb, format, provenance, publish marks);
   feeds Edit's media drawer and the publish fan-out (Moment/Buffer/export).

Cross-links: Soul→Cinema ("Animate"), Cinema/Generate→Edit ("Send to Edit",
existing pattern), Edit export→Library, Library→Post Studio reel.

## 4. Phases for Opus (each = one commit to main, browser-verified)

### V0 — Extraction + chrome (½ day)
- Extract `PlayerView`, `VideoCard`, gallery + preset-rail primitives from
  `VideoGenerate.tsx` into `surfaces/video/shared.tsx` (no behavior change).
- Mode bar → 5 segments; empty Soul/Cinema/Library shells behind them.
- Acceptance: Generate + Edit pixel-identical to today; 5 tabs render.

### V1 — Camera grammar + Cinema tab (1–1.5 days) ★ the Higgsfield clone
- `apps/hq/src/surfaces/video/cameraGrammar.ts`: pure function
  `compileShot({ move, lens, weight, look, prompt }) → { prompt, negative,
  frames, fps, extraNodes }`. Each move = ordered prompt clauses (e.g. Dolly In
  → "camera slowly dollies in toward the subject, smooth cinematic push-in,
  stable framing") + motion-weight adverbs + lens clause + look clause; negative
  always includes "jump cut, warping, morphing, flicker". Unit-test the
  compiler (Vitest, table-driven: 12 moves × 3 weights snapshot).
- Cinema tab UI per §3; renders through the SAME `jobStore.spawn({kind:'video'})`
  path (single-flight preserved). Spec gains optional `image` (base64/path) for
  i2v — the media-gen `generate_video` tool + `comfy-sovereign-video.js`
  already take Wan i2v; verify/extend the adapter to accept a start image and
  switch the graph template to the i2v variant when present.
- Post-look toggles: implement as ffmpeg-free canvas/graph-side options only if
  trivial; otherwise fold look into prompt for v1 (note the seam).
- Acceptance: same seed + same source image rendered with Dolly In vs Orbit
  produces visibly different, correct camera motion; screenshot + 2 MP4s.

### V2 — Soul tab v1: wire the existing LoRA into stills (1 day)
- Extend BOTH comfy image paths (media-core `comfy-sovereign.js` adapter +
  media-gen provider) with the O1 spec fields: `loraName`, `loraStrength`,
  `character`, `refImage` (IP-Adapter plus-face), `pose`, `faceDetail: true`
  → FaceDetailer pass. Auto-inject `arganta-sd15-v003-high` when
  `character:'arganta'`. (This IS Phase O1 item 2 — closes it.)
- `soul_profile` registry: data file first (`souls.ts`), Supabase table later;
  fields per §3. Soul tab UI: character card, keyframe forge (prompt + 12
  style presets + 6 pose presets), gallery, "Approve as keyframe" →
  `uploadAsset(kind:'image', tags:['soul:arganta'])`, identity-matrix button.
- Acceptance: 8-prompt contact sheet with a consistent ARGANTA face, rendered
  from inside the tab; one approved keyframe visible in the media library.

### V3 — Soul × Cinema fusion: identity video (½–1 day) ★ the Soul Cinema moment
- "Animate" on a keyframe → Cinema with source preloaded; character picker in
  Generate does keyframe-or-fresh-still → i2v.
- First-frame identity pipeline: Soul still (512² LoRA render, FaceDetailer)
  → resized to the video preset → `WanImageToVideo`. Prompt auto-prepends the
  character trigger token + "the same person throughout, consistent face".
- Acceptance: 3 clips of ARGANTA (dolly-in, orbit, static) where the face
  holds across frames; founder visual sign-off gate noted in BUILD LOG.

### V4 — Video Library + publish gate (1 day) — absorbs S2 items 1–2
- `video_asset` rows in the shared media library (immutable + publish marks,
  postLibrary pattern; namespace localStorage `hq_video_studio_v1`).
  "Keep" on any gallery card persists blob → Supabase `media-artifacts`
  (kind video) + library row; Edit exports auto-land here too.
- Library tab: grid w/ hover-play thumbs, provenance chip (sovereign/wan22,
  camera move, character), publish marks; fan-out sheet = Download / Send to
  Edit / Kinetik Moment / Buffer (reuse Video Builder's existing gate).
- Drafts inbox seam: `video_draft` briefs via MCP (contentDrafts pattern) —
  tool `video_brief` in tools/media-gen-mcp; inbox chip on the mode bar.
- Migration: `migration_video_library.sql` (video_asset + video_draft).
  DO NOT run — founder runs migrations; ship offline-safe fallback.
- Acceptance: render → Keep → row in Library → picked up in Edit's media
  drawer → exported → same row marked published.

### V5 — Draft→Final ladder + hardening (1 day)
- **Finalize** action on a kept clip: RIFE frame interpolation (ComfyUI
  interpolation nodes, bundled) + 1.5–2× upscale pass → "Final" variant on the
  same library row (no fork). Long-poll semantics via existing job id pattern.
- LightX2V 4-step LoRA (download, pair high/low-noise correctly with the
  matching diffusion halves) as the **Draft accelerator** — flag it; if 5B +
  LightX2V mismatch (LoRA is for A14B), skip gracefully and document.
- Dormant premium rung: "Polish via Higgsfield" button rendered but disabled
  behind the sovereign-only flag (`hq_premium_enabled` localStorage), calling
  the media-gen premium path when enabled. Never default, never required.
- GPU etiquette re-verified: one video job at a time; OOM → Retry-at-Draft
  everywhere (Cinema included).
- Acceptance: Draft clip → Finalize → smoother/larger MP4 on the same row;
  premium button provably unreachable by default.

### V6 (stretch, flagged) — Wan character LoRA + Fun Camera seam
- Train a Wan 2.2 character LoRA on the approved keyframe set (dataset teaches
  identity **under change**: varied pose/expression/angle stills from the Soul
  forge). If local 8GB training is impractical, document the ai-toolkit/
  RunComfy cloud-train path; weights land in `loras/` and the video adapter
  gains `videoLora` spec fields.
- `Wan2.2-Fun-Camera` graph template checked in as a dormant seam
  (`workflows/fun-camera.json`) with a README note: activates on ≥16GB GPU or
  cloud runner; Cinema's Camera Rack maps 1:1 onto its Camera Control Codes
  (Pan Up/Down/L/R, Zoom In/Out, combos) so the UI needs zero changes.
- Talking-head experiment (O5 stretch): ARGANTA keyframe + Audio Studio voice
  → `WanSoundImageToVideo` lip-sync test. Experiment, not acceptance-gated.

## 5. Risks / battle-test notes
1. **5B vs A14B ecosystem**: most camera-control models/LoRAs (Fun-Camera,
   LightX2V variants) target A14B. On 8GB the *prompt-compiled grammar on
   TI2V-5B* is the real product; treat model-level camera control as a seam.
   Never block the UI on a model that can't load.
2. **SD1.5 face → Wan video style gap**: the LoRA still may look "SD1.5" while
   Wan restyles it. Mitigate with photoreal-biased Soul style presets and
   FaceDetailer; the V6 Wan LoRA is the true fix.
3. **Blob lifetime**: jobStore blobUrls die on reload — Library "Keep" must
   upload bytes, not the blob URL (fetch→File→uploadAsset, pattern already in
   `sendToEdit`).
4. **Single-flight**: Cinema + Generate + Finalize all share the video mutex;
   queue position UI already exists — reuse it.
5. **Don't touch Edit/VideoBuilder internals** until V4 needs its export hook;
   integrate via the media library seam only (proven `sendToEdit` pattern).
6. **Migrations pending pile-up**: add migration_video_library.sql to the
   founder's run list; every cloud feature must no-op cleanly offline.

## 6. Order + sizing
V0 (½d) → V1 (1.5d) → V2 (1d) → V3 (1d) → V4 (1d) → V5 (1d) → V6 (stretch).
≈ 6 working days core. Each phase: commit to main, screenshot + real-render
proof in the BUILD LOG appended below this plan.

## Sources (research)
- https://higgsfield.ai/blog/sould-id-best-character-consistency
- https://higgsfield.ai/blog/Soul-ID-AI-Character-Consistency
- https://higgsfield.ai/blog/turn-your-video-into-cinema-using-wan-camera-control
- https://higgsfield.ai/soul-cinema
- https://docs.comfy.org/tutorials/video/wan/wan2-2-fun-camera
- https://www.runcomfy.com/comfyui-workflows/wan2-2-fun-camera-in-comfyui-cinematic-panning-zoom-rotation
- https://www.runcomfy.com/trainer/ai-toolkit/wan-2-2-i2v-character-consistency-lora
- https://www.nextdiffusion.ai/tutorials/fast-image-to-video-comfyui-wan2-2-lightx2v-lora
