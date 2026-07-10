# Music Forge — generative backsound engine (research + build plan)

Status: **research + working prototype + plan, no build into the app yet** (2026-07-10). Makes
Music Forge (the "not wired yet" tab in Music Builder) real. Interactive prototype published as an
Artifact — it **actually composes and plays** cozy farm music live in the browser, themed per map,
proving the recommended approach works before any app build. Companion to
`music-builder-viz-buildplan.md` and the shipped Music Builder surface.

## 0. The question, answered

The user asked: research open-source no-copyright backsound relevant to LashiraBloom, **OR** build an
engine to create it. There are two real paths; they're not equal for this codebase.

### Path A — CC0 / royalty-free music FILES (the asset route)
Real sources exist: **OpenGameArt's CC0 "Calm/Relaxing Music"** and public-domain loop collections
(no attribution required), plus Incompetech (CC-BY, needs credit), Pixabay, Freesound. There's
genuinely usable cozy/pastoral material there.

**But it fights LashiraBloom's architecture.** The entire audio system — `ambient.js`, `sfx.js`,
the whole `@arganta/audio` package — is deliberately **synthesized, zero-asset, CSP-safe** so the
game embeds anywhere (KinetikCircle, Bloom Command) without a `media-src` allowance, storage, or
per-file licensing records. Dropping in MP3/OGG music would:
- break the CSP-clean embed guarantee (need `media-src` + a host to serve the files),
- add MB of assets + a provenance/licensing ledger (even CC0 wants attribution-of-record),
- be **fixed** — you take what exists; you can't tune a track per-map or evolve it,
- loop identically every ~30–60s, which reads as cheap.

### Path B — a GENERATIVE engine (the recommendation)
Compose the music **live in WebAudio from data**, exactly like the SFX cues are data recipes. This
is the architecturally-correct answer and it's genuinely better:
- **Copyright-free by construction** — it's generated, never sampled. No license, no attribution, ever.
- **Zero assets, CSP-safe** — same as everything else in the audio system.
- **Per-map themeable + infinitely scalable** — a "theme" is a parameter set; the 6 maps are 6
  themes, and "add a dungeon/shop/boss track" is one more object.
- **Alive** — probabilistic melody + layered loops mean it never repeats identically, instead of a
  clip on loop. This is the "make Music Forge alive" the user asked for, literally.

**Library choice:** the prototype uses a **bespoke ~300-line engine on the existing WebAudio
primitives** (no dependency), consistent with the rest of the audio. **Tone.js** (MIT, the standard
generative-music framework) is the alternative and is excellent — recommend it ONLY if you later
want sampled real instruments (`Tone.Sampler`) or its richer transport; for synthesized cozy music
it's a dependency we don't need. Documented as the fallback, not the default.

## 1. The music theory (grounded — the "cozy farming" sound)

From researching how Stardew Valley's soundtrack works (ConcernedApe), the recipe for pastoral/cozy:
- **Scales/modes:** major, minor, and **mixolydian** (folk/pastoral); **lydian** for dreamy
  brightness; **major pentatonic** for melody (every note is consonant — safe for procedural).
- **Instrumentation:** **marimba** carries the melody (hollow, fast attack, notes "pop"); acoustic
  guitar/banjo, piano, soft pad bed, a **root-and-fifth bass** (the country bassline), flute, bells.
- **Rhythm:** swing / syncopation = the laid-back feel.
- **Harmony:** simple diatonic loops (I–V–vi–IV, I–vi–IV–V); bass plays root then fifth of each chord.

The engine encodes exactly these: scale tables, chord-progression tables, a marimba patch with the
fast-attack "pop," a root+fifth bass generator, swing on the offbeats.

## 2. The engine (what the prototype proves works)

A lookahead scheduler (the standard Web Audio pattern: a 25ms `setTimeout` loop scheduling events
~120ms ahead against `AudioContext.currentTime`) drives 5 generative layers per bar:

| Layer | Generator | Patch (WebAudio) |
|---|---|---|
| **Pad** | current chord's triad, retriggered each bar | 3 detuned sawtooths → lowpass, slow attack, long release |
| **Bass** | root on beat 1, fifth on beat 3 (country root+fifth) | triangle, octave-down, short |
| **Marimba** | **euclidean** rhythm × probabilistic pentatonic walk; lands on chord tones on strong beats | triangle + octave-up sine (the "pop"), fast decay |
| **Pluck** | arpeggiates the chord on off-8ths, probability-gated | sawtooth → lowpass, short |
| **Bells** | sparse high sparkle | sine + 3rd harmonic, long decay, heavy reverb |

Everything runs through a shared synthesized-IR **reverb bus** (reused from the SFX engine's
`createMasterChain` idea) + a bus compressor. **Density** scales the probability gates; **swing**
delays the offbeat 16ths; each bar the melody re-rolls, so it evolves instead of looping. This is
`euclidean rhythm + probabilistic melody + chord-loop harmony` — the well-worn generative-ambient
toolkit (Loopstate, subsequence, Eno-style phasing), done lean.

## 3. The 6 map themes (each a parameter set = "the music theme")

| Map | Mood | Key / scale | BPM | Chord loop | Character |
|---|---|---|---|---|---|
| **Farm** | Cozy | C major-pentatonic | 82 | I–V–vi–IV | warm marimba morning |
| **Bloomwall Pass** | Adventurous | D dorian | 106 | vi–IV–I–V | driving, the pass holds |
| **Arena** | Energetic | E mixolydian | 122 | I–IV | crowd + glory, percussive |
| **Festival** | Festive | G major | 112 | I–vi–IV–V | bells + marimba, lively |
| **Keep** | Regal | A minor | 72 | vi–IV–I–V | slow pads, old stone |
| **Kitchen** | Playful | F major-pentatonic | 96 | I–IV | plucky, swung, sizzle |

"Scalable to anything" = **＋ New track** clones a theme for any new zone; the engine doesn't care
how many exist.

## 4. UI (the drafted Music Forge — see the Artifact)

Three columns, matching the SFX Forge / scope visual language already in Music Builder:
- **Left — track rail:** the 6 maps (icon + mood + bpm + inline play), then **＋ New track** for any
  zone, then a "scales to anything" note.
- **Center — stage:** big Play/Stop, now-playing readout (**live chord numeral + key + bar**), and a
  dark **visualizer**: 5 instrument "orbs" that pulse when their layer fires + a live AnalyserNode
  spectrum along the bottom. This is the "alive" made visible.
- **Right — theme editor:** Mood preset (Cozy/Adventurous/Energetic/Festive/Regal/Playful/Mysterious,
  each sets sensible scale+bpm+swing) · Key + Scale selects · Tempo/Swing/Density/Reverb sliders ·
  Chord-loop pills · per-instrument level sliders + on/off toggles.

## 5. Build plan (into the real app)

**Phase 1 — engine as a shared module (`packages/audio/src/music.js`), no UI**
1. Port the prototype engine: `SCALES`, `PROGS`, `mtof`, `degMidi`/`triad`, the 5 voice patches, the
   `euclid()` generator, the lookahead `MusicTransport` class (start/stop/setTheme). Reuse the SFX
   engine's reverb/master where possible so both share one mastering path.
2. `MUSIC_THEMES` default table (the 6 maps above), a `MusicTheme` shape (root/scale/bpm/prog/swing/
   density/reverb/layers/levels), plus `validateMusicTheme`/`mergeMusicThemes` (mirror recipes.js).
3. Node smoke test (schedules N bars headless, asserts note counts/ranges) like the SFX harness.

**Phase 2 — wire the game (`apps/lashira`)**
4. Replace `ambient.js`'s single hardcoded pad with the transport reading the **current realm's
   theme**. Realm switch (`realms/index.js` → FarmRoom/RealmRoom) calls `music.setTheme(themeFor(realm))`
   with a short crossfade. Keep the existing ambient on/off + volume Settings toggle driving it.
   Same gesture-gated start (autoplay policy) the SFX/ambient already use.
5. Boot: `MUSIC_THEMES` overridable by the published library (see Phase 3), else package defaults —
   identical fallback contract to `bootAudioLibrary`.

**Phase 3 — publish pipeline + HQ Music Forge**
6. Extend the audio library: `MUSIC_LIBRARY` (per-theme overrides) alongside `SFX_RECIPES`; the same
   `audio_library` row carries both (one publish, per the existing "one table" rule). `applyAudioLibrary`
   applies theme overrides to `MUSIC_THEMES`.
7. Build the real Music Forge tab from the Artifact: the transport drives a live preview in HQ (same
   engine, so what the operator hears is what the game plays), theme editor writes to the draft,
   Publish (top bar, already there) ships it.

**Phase 4 (optional)** — richer patches (Karplus-Strong pluck for a real guitar, a proper marimba
model), day/night or tension variants of a theme, stems the game can duck under SFX.

## 6. Honesty / scope
- The prototype's music is **real and running** (WebAudio, no external calls) — press play in the
  Artifact. It is NOT yet in the app; that's Phases 1–3.
- Generated melodies are pleasant-by-construction (pentatonic + chord-tone landing) but a
  human composer will always beat pure generation — the intent is a *living bed*, not a hero theme.
- CC0 files (Path A) remain a valid quick fallback if you ever want a specific hand-composed track
  for a key moment — the two aren't mutually exclusive, but the engine is the default for the 6 maps.

## 7. Sources
- OpenGameArt CC0 Calm/Relaxing + Public-Domain music collections (the asset route).
- Tone.js (Tonejs/Tone.js) + "Generative Music with JavaScript" (meleyal) — the library/engine route.
- Stardew Valley music theory (haakondavidsen tutorial; TV Tropes) — modes, marimba, root+fifth bass, swing.
- Generative technique refs: Loopstate, subsequence (euclidean rhythms, Markov, arpeggiators), Eno-style layered loops.
