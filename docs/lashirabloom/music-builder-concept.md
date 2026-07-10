# Music Builder — new HQ surface (concept only, no build)

Status: concept, 2026-07-10. Companion to [[CONCEPT-bloomwall-real-tower-defense.md]] (per-tower SFX)
and the SFX/backsound mapping done this session. Follows the same integration pattern as
Battle Builder / Character Forge (`docs/lashirabloom/battle-builder-plan.md`).

## 0. Why this exists

Today, sound across LashiraBloom lives in two hand-written files with no authoring UI:
`apps/lashira/web/src/audio/sfx.js` (`CUES` table — one WebAudio recipe per action) and
`apps/lashira/web/src/audio/ambient.js` (one fixed synth pad + procedural birdsong). Every new
cue is a developer editing a JS object by ear. There's no place to preview, iterate, compare, or
hand off sound design to a non-coder — and no path today from "free synthesized tone" to "real
generated audio" without a rewrite.

Music Builder is that missing surface: **author once, render through either a free synth engine
or a paid generative API, publish to both games** — mirroring how Battle Builder authors combat
numbers once and publishes to the shared `@arganta/combat` package both games boot from.

## 1. Scope: two providers, one authoring surface

The core design decision is a **provider abstraction**, so ElevenLabs can be added later without
redoing the tab:

```
SoundProvider
├─ SynthProvider   (built first, $0, runs today — WebAudio recipe, ships as code not assets)
└─ ElevenLabsProvider (added later, needs API key — Sound Effects API + Music API, ships as a
                        rendered audio file + a licensing/credits record)
```

Every cue/track authored in Music Builder has ONE definition (mood tags, duration, role) that can
be rendered through *either* provider and A/B previewed side by side. Publish writes:
- **Synth path** → a recipe object merged into `sfx.js`'s `CUES` / a new `ambient.js` track config
  (no new files shipped — same "zero assets, CSP-safe" property the game already has).
- **ElevenLabs path** → a generated `.mp3`/`.wav` written to `public/audio/`, a manifest entry
  (id → file, license/credit-cost, prompt used, regenerate button), and a `media-src` CSP note for
  whoever hooks up the `<audio>` element.

This keeps the free path always available as a fallback — same pattern the combat pipeline uses
(`loadActiveTuning` never throws, falls back to defaults).

## 2. "Max the free tier first" — what that means concretely

Per your ask: before any ElevenLabs key exists, the SynthProvider itself should be pushed as far
as WebAudio allows, so cues sound closer to "premium" than today's plain oscillator/noise pairs.
All of these are **$0, no new dependency, no asset files** — pure DSP additions to the existing
`Sfx` class:

| Technique | What it adds | Cost |
|---|---|---|
| **Procedural convolution reverb** — synthesize a short decaying-noise impulse response at boot (no `.wav` needed), route cues through a `ConvolverNode` | tails/space, the #1 thing separating "beep" from "produced sound" | $0 |
| **Layered oscillators per cue** (2-3 detuned voices instead of 1) | thickness, less thin/toy-like | $0 |
| **Micro-variation on repeat** — small random pitch (±2%) + timing (±8ms) jitter per trigger | stops repeated cues (harvest, hit) from sounding robotic/looped | $0 |
| **Soft-clip / waveshaper saturation** on transients | perceived loudness + "punch" without raising gain | $0 |
| **Sidechain-style envelope duck** on the ambient pad when an SFX fires | cues cut through instead of masking | $0 |
| **A mastering chain on `master` gain** — gentle compressor (`DynamicsCompressorNode`) + limiter ceiling | consistent perceived loudness across all cues, "polished" cohesion | $0 |

This is exactly the "free version to the max" lane — it's a real upgrade to `sfx.js`/`ambient.js`
DSP, not a UI feature, so it can land independently of the Music Builder tab whenever you want it
built. Music Builder just gives you a place to *hear and tune* it per-cue instead of editing raw
numbers.

## 3. Tab layout (HQ shell integration)

Follows the established Rail/Shell pattern exactly (`apps/hq/src/shell/store.ts` + `Rail.tsx` +
`Shell.tsx` + `MobileNav.tsx` + `CommandPalette.tsx` all need the new id, same as Battle Builder's
integration note):

- `SurfaceId` += `'music'`, `SURFACE_LABEL.music = 'Music Builder'`.
- Rail **Build group**, next to Game/App/Learn/Agent/Content/Battle/Character Builders. Icon:
  a music-note/waveform glyph (lucide `AudioWaveform` or `Music2`), matching the Swords icon
  Battle Builder uses.
- `Shell.tsx` → 'music' in the `wide` set (this is a workbench, not a dashboard — same reasoning
  as Battle/Character).

### 4 sub-tabs (`.seg` pattern, matching Battle Builder's Overview/Combat/Monster Lab shape)

**Overview** — dashboard: asset counts (cues authored / tracks authored), provider-mix pie
(synth vs generated), ElevenLabs credit balance + monthly usage bar (once key is connected),
"last published" per game (LashiraBloom, Kingdom, KinQuest — this surface is game-agnostic like
Battle Builder), attention feed (e.g. "3 cues still using default synth, no custom design").

**SFX Forge** — 3-column workbench (same skeleton as Skill Forge / Battle Builder's Monster Lab):
- Left: cue roster, grouped by the game's real cue namespace (reads `sfx.js`'s `CUES` keys
  directly so the list is never invented — action cues / emote cues / [future] per-tower cues from
  Bloomwall §7). ➕ New cue.
- Middle: **live preview stage** — big Play button, waveform/oscilloscope canvas (draw the actual
  `AnalyserNode` output so you SEE the envelope you're shaping, not just hear it), A/B toggle
  between SynthProvider render and ElevenLabsProvider render (greyed out until a key exists).
- Right: **parameter panel**, provider-dependent:
  - Synth mode: tone/noise layer editor (type, f0/f1, t, gain, delay — the exact fields `Sfx.tone`/
    `Sfx.noise` already take, just exposed as VSliders instead of hand-written numbers) + the new
    §2 DSP toggles (reverb send, layer count, jitter amount, saturation drive).
  - ElevenLabs mode: text prompt box ("soft harvest chime, kid-friendly, no assets"), duration,
    prompt-influence slider, Generate button, cost-in-credits shown before confirming (Sound
    Effects API is pay-per-generation, so surfacing cost before spend matters here).

**Music Forge** — same skeleton, for backsound/ambient instead of one-shot cues:
- Left: track roster **per realm** (Farm, Bloomwall, Arena, Festival, Keep, Kitchen — reads
  `game/realms/index.js`'s realm list so this is never invented either), since today ALL realms
  share the one ambient pad — this is the tab where "does Bloomwall get its own tenser loop"
  becomes a real per-realm authoring decision instead of a code change.
- Middle: same waveform stage, but looped playback + a loop-point marker (start/end trim) since
  music needs seamless looping, unlike one-shot SFX.
- Right: Synth mode = the existing pad-voice editor (base frequencies, detune, LFO rate, bird
  density/pitch range) exposed as controls instead of hardcoded constants. ElevenLabs mode = the
  Music API's prompt box (mood/tempo/instrumentation text, target duration) + loop-safety note
  (generated music tracks need a manual loop-point edit; not automatic).

**Publish** — summary + one button, same shape as Battle Builder's Publish tab: diff of what
changed since last publish (N cues re-tuned, M tracks re-generated), target picker (which
game(s) — LashiraBloom / Kingdom / KinQuest, since the provider abstraction is shared across
games the same way `@arganta/combat` is), Publish button. Synth-path publishes are instant
(recipe merge, no network); ElevenLabs-path publishes show the asset manifest diff (new files,
storage size, credit spend this session) before confirming — mirrors combat tuning's "disabled
offline w/ migration note" honesty pattern rather than pretending a network step doesn't exist.

## 4. Data model (concept, mirrors `@arganta/combat`'s tuning pipeline shape)

A new shared package `@arganta/audio` (parallel to `@arganta/combat`) would hold:
- `SFX_LIBRARY` — serializable per-cue definition (id, role tags, synth recipe, optional generated
  asset ref + prompt used + provider + license note).
- `MUSIC_LIBRARY` — per-realm track definition (same shape, plus loop points).
- `applyAudioLibrary()` — mutates the LIVE `CUES`/ambient config the same way `applyTuning()`
  mutates `BESTIARY`/`PATH_POWER` today, so games "just work" after boot with zero call-site
  changes in `FarmRoom.jsx`/`Hud.jsx`/etc.
- `publishAudioLibrary()` / `loadActiveAudioLibrary()` — same never-throws-falls-back-to-defaults
  contract as `tuningRepo.js`.
- A Supabase table `audio_library` + `hq_audio_publish`/`audio_library_active` RPC pair, same
  operator-gated shape as `migration_combat_tuning.sql`.

Not built. This is the seam that would let "Publish" in the tab do something real later, exactly
how the combat pipeline doc scoped Battle Builder before any of it was wired.

## 5. ElevenLabs specifics (for later, when the key lands)

- **Sound Effects API** (`POST /v1/sound-generation`) — text prompt → short SFX clip, pay-per-call,
  duration-capped, this is what SFX Forge's Generate button would call.
- **Music API** (`POST /v1/music`) — text prompt → composed track, this is what Music Forge's
  Generate button would call; loop-point trimming stays a manual step in the tab (the API doesn't
  guarantee seamless loops).
- Free tier: ElevenLabs' free plan credit pool (shared across all their APIs, not SFX-specific) —
  good enough to prototype a handful of cues/tracks and compare against the maxed-out
  SynthProvider before deciding whether the quality delta is worth the ongoing cost. This is
  exactly why the A/B preview in §3 matters — it's the decision tool, not just a nicety.
- Cost/credit tracking belongs in Overview (per §3) so spend is visible before it becomes a
  surprise, same spirit as the game's own kid-safe economy walls.

## 6. What's explicitly NOT in this pass

- No real build — `SurfaceId`, the surfaces file, `@arganta/audio`, the Supabase table: none of it
  exists yet. This doc is the plan, same status Battle Builder had before "go ahead" was said.
  Also true of the §2 free-DSP upgrade — the recipes above are examples of what would land in
  `sfx.js`/`ambient.js`, not yet written into those files (they were only mapped/read this session).
- No ElevenLabs account/key wiring — `ElevenLabsProvider` is a documented interface shape, not
  code, and needs your key + a decision on where it's stored (HQ env var, Supabase secret) before
  any of §5 can be called.
- No decision yet on whether per-realm music (Music Forge's premise) is worth the added
  complexity vs. keeping one shared ambient bed — flagged as a call for you, not decided here.
