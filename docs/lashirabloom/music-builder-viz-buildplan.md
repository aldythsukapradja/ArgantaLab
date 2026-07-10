# Music Builder — visualization + analytics build plan

Status: **plan only, no build** (2026-07-10). Companion to the shipped Music Builder surface
(`apps/hq/src/surfaces/music/`) and its already-built pieces: the `@arganta/audio` engine, the
`audio_library` publish pipeline, and the `audio_usage` live tracker. This plan covers replacing
the current utilitarian chart + leaderboard with a professional-grade audio studio + analytics
dashboard. Interactive "wow" target mockup published as an Artifact (real offline-rendered
waveform, STFT spectrogram, live reactive spectrum, animated playhead synced to playback, plus
the analytics dashboard).

## 0. Research — what professional audio tools actually visualize

Grounded in a pass over pro audio / dashboard sources (see §9). The professional set for a short
one-shot cue (<2s), roughly in order of "how much it tells you":

| View | What it shows | Tool it comes from | Our status |
|---|---|---|---|
| **Waveform** (amplitude × time) | transients, envelope shape, silence, the *real rendered* output incl. reverb tail | Audacity, iZotope RX, every DAW | current chart is an *analytic envelope*, not real samples — **upgrade** |
| **Spectrogram** (freq × time, colour = intensity) | timbre, harmonics, noise bands, where energy lives over time | iZotope RX, Sonic Visualiser, Audition | **not present — the biggest gap** |
| **Live spectrum** (instantaneous FFT bars) | reactive frequency content *during* playback — the "it's alive" moment | every visualizer, Serum | **not present** |
| **Radial / circular visualiser** | same data, high wow, reads as "premium audio product" | music visualizers | **not present** |
| **ADSR / envelope overlay** | attack/decay/sustain/release shape | FMOD, Wwise, Serum | partially (our envelope chart) |
| Mel / log-frequency scaling | perceptual axis (mirrors human hearing) | LANDR, RX, ML audio | apply to spectrogram |

**Answer to "is envelope + spectrogram enough, or is there fancier?"** Envelope alone is the
*weakest* of the set (it's what we shipped). The genuinely-fancier, genuinely-more-useful stack is:
**real waveform (offline-rendered) + STFT spectrogram (log-freq) + live reactive spectrum + radial**,
with the envelope kept as an overlay. That's the full professional picture, and it's all $0 —
WebAudio's `OfflineAudioContext` (real render) + `AnalyserNode` (live FFT) do it natively, no
samples/assets, CSP-safe. This is what the mockup demonstrates.

### The playback animation (the specific "wow" you asked for)
On Play, two things happen simultaneously, driven by one `requestAnimationFrame` loop reading a
live `AudioContext`:
1. **Animated playhead** sweeps left→right across the waveform/spectrogram, position =
   `(ctx.currentTime − startTime) / duration`, with a soft leading glow.
2. **Reactive spectrum / radial** bars pulse frame-by-frame from `analyser.getByteFrequencyData()`.

This is the real, correct way (not a CSS animation) — the bars are literally the sound's live FFT.

## 1. Library decision — the honest one

`apps/hq/package.json` already has **`recharts` (^3.9.1)** and **`d3-geo`**. Neither is right for
audio. The build should add the specific **d3 modules** (not the whole `d3` bundle):
`d3-scale`, `d3-shape`, `d3-axis`, `d3-selection`, `d3-transition` (~30KB gzip total, tree-shaken).

**Tool-per-job (this is the important part — D3 is NOT the right tool for everything):**

| Element | Tech | Why |
|---|---|---|
| Waveform, spectrogram, live spectrum, radial, playhead | **Canvas 2D + WebAudio + rAF** | per-pixel intensity images + 60fps reactive rendering — SVG/D3 would choke; this is what every real audio visualizer uses |
| Envelope curve, axes, ticks | **d3-shape (curveMonotoneX) + d3-axis (SVG)** | crisp vector line, proper scientific axes, the thing that was "ugly" done right |
| Fine-tune priority bubble scatter | **d3-scale + SVG** | correlation viz — humans read position well; d3 scales + transitions make it smooth |
| Category donut, ranked bars, area sparkline | **d3-shape (arc/area) + SVG** OR recharts | either works; d3 gives full control, recharts is faster to write |
| FFT for offline spectrogram | **~30-line radix-2 FFT** (inlined, no dep) | one Hann-windowed FFT per STFT frame; cues are <2s so it's instant |

So: **Canvas for anything animated/per-pixel, D3/SVG for the analytical charts.** The mockup proves
both halves run at $0 with no asset files.

## 2. Layout — your explicit constraints

### Overview (Analytics) — "always one page on desktop, responsive to mobile"
A **fixed dashboard grid that fits the viewport with no page scroll** on desktop; **stacks and
scrolls** on mobile. Top-rail KPI pattern (research: KPIs in the top "hot zone", F-pattern, 5–7 max).

```
Desktop (no scroll, grid rows sized with fr/minmax to fill 100vh − chrome):
┌───────────────────────────────────────────────────────────┐
│ KPI row · 5 tiles: Total plays(7d) · Cues · Most-played ·  │  ← hot zone
│                    Hot&Untuned⚑ · Silent cues              │
├──────────────────────────────┬────────────────────────────┤
│ Fine-tune priority           │ Plays by category           │
│ (bubble scatter, the         │ (donut)                     │
│  decision chart)             │                             │
├───────────────────┬──────────┴────────────────────────────┤
│ Plays over time   │ Top cues (ranked bars)                 │
│ (area, 30d)       │                                        │
└───────────────────┴────────────────────────────────────────┘
Mobile: same panels, single column, page scrolls. KPI tiles 1-per-row.
```
CSS: `.dash{display:grid; grid-template-rows:auto 1fr auto; height:calc(100dvh − topbar)}` on
desktop; a `@media(max-width:1000px)` switches to `height:auto; overflow:auto` and single-column.

### SFX Studio — "main visualization + controls always one page; only the cue list scrolls"
```
┌────────────────┬──────────────────────────────────────────┐
│ cue list       │ [▶] harvest        [plays][last][site]    │
│ 🔍 search      │ ┌───── dark scope stage ──────────────┐   │
│ (THIS column   │ │ [Waveform|Spectrogram|Spectrum|Ring] │   │
│  is the ONLY   │ │  <canvas> — playhead + reactive      │   │
│  scroller)     │ └──────────────────────────────────────┘   │
│  tap      0    │ controls (2-col grid, fits viewport)       │
│  harvest  3 ◀  │  waveform · pitch · envelope · polish       │
│  ...           │                                            │
└────────────────┴──────────────────────────────────────────┘
```
CSS: `.studio{display:grid; grid-template-columns:250px 1fr; height:calc(100dvh − topbar); overflow:hidden}`.
`.roster{overflow-y:auto}` (the only scroller). Right column `overflow:hidden`, its scope + controls
sized to fit. Mobile: stack, roster gets a capped `max-height` with its own scroll.

### Publish button — "at the top"
Move from the bottom bar to the **top bar, right-aligned**, with a pending-count badge
(`Publish · 2`). Same `publish()` handler, same single `audio_library` row. Disabled offline with
tooltip. (This replaces the bottom `PublishBar` in both forges.)

## 3. Data / schema gaps — the one honest blocker

Everything except one chart is buildable on **today's** `audio_usage` table (running total +
`last_played`): KPIs, bubble scatter, donut, ranked bars all derive from those totals.

**"Plays over time" (the area chart) needs a schema addition** — the current table has no history,
only a cumulative counter. Two options:
- **(a) daily rollup** `audio_usage_daily(cue text, day date, plays int, primary key(cue,day))` —
  the flush RPC also upserts today's row. Cheap, bounded, gives 30/90-day trends.
- **(b) event log** `audio_play_events(cue, at)` — full granularity, but unbounded growth; needs a
  retention/aggregation job. Overkill for "which cue to polish."

Recommend **(a)**. Until it exists, the area panel shows an honest "needs `audio_usage_daily`"
tag (as the mockup does) — no faked trend line.

## 4. Build phases

**Phase 1 — the chart, done right (no new dep beyond d3 modules; no schema change)**
1. Add `d3-scale d3-shape d3-axis` to `apps/hq/package.json`; `npm install`.
2. New `apps/hq/src/surfaces/music/Scope.tsx` — the dark-scope component:
   - `renderCue(name)` → `OfflineAudioContext`, schedule the recipe through the shared
     `@arganta/audio` engine, `startRendering()` → real `Float32Array` samples (incl. reverb tail).
   - Waveform: min/max-per-column Canvas draw.
   - Spectrogram: inline radix-2 `fft()`, Hann window, STFT (1024/256 hop), dB→colour, log-freq
     y-remap, drawn to an offscreen canvas, cached per cue.
   - Live spectrum + radial: `AnalyserNode` (fftSize 256), `getByteFrequencyData` each rAF.
   - Playhead: rAF loop off a live `AudioContext`; view tabs Waveform/Spectrogram/Spectrum/Radial.
3. Replace `EnvelopeChart` usage in `MusicBuilder.tsx` with `<Scope>`; keep the envelope as an
   overlay toggle on the waveform view.
4. Verify in hq-offline preview: play a cue → playhead sweeps, spectrum reacts, spectrogram renders.

**Phase 2 — SFX one-page layout + Publish-to-top**
5. Rework `music.css`: `.studio` grid fixed to viewport, roster the only scroller, controls grid
   sized to fit. Move Publish into the top bar (`.mbf-top`), delete the bottom `PublishBar` from
   the SFX/Music panes (keep the one `publish()` fn).
6. Roster rows: tiny sparkline (envelope thumbnail) + live play count already wired.

**Phase 3 — Analytics dashboard (Overview rebuild, today's data)**
7. New `apps/hq/src/surfaces/music/Analytics.tsx`:
   - KPI row (5 tiles) from `loadUsage()` totals + `CUE_CALL_SITES`/`isDynamicOnly`.
   - **Fine-tune priority bubble** (d3-scale + SVG): x = play count, y = "polish need" (unedited +
     high-play = top-right "do first" quadrant), bubble size = call-site count, colour = category
     (from `cueGroups()`). Hover tooltip. This is the chart that answers "which SFX to fine-tune".
   - Category donut (d3-shape arc) + ranked bars (top N).
   - One-page grid on desktop, responsive stack on mobile (§2).
8. Honest empty states preserved (no mock numbers offline / pre-migration).

**Phase 4 — plays-over-time (needs schema)**
9. `supabase/migration_audio_usage_daily.sql`: the daily rollup table + extend `sfx_log_plays` to
   also upsert `(cue, current_date)`; add `audio_usage_trend(days int)` read RPC.
10. Wire the area chart (d3-shape area) to real trend data; drop the "needs table" tag.

## 5. Scope honesty (kept, not overclaimed)
- Spectrogram/waveform are **real** (offline render of the actual recipe) — not analytic guesses.
- Live spectrum/radial are **real** `AnalyserNode` output during playback.
- Bubble "polish need" axis is a **heuristic** (edited-state + play frequency), not a measured
  quality score — labelled as a priority heuristic, not a fact.
- Plays-over-time is the **only** piece gated on a new table (Phase 4); everything else ships in
  Phases 1–3 on current data.
- All $0 / no asset files / CSP-safe — same properties as the shipped synth engine. The artifact
  CSP can't load the d3 CDN, so the mockup hand-builds the visuals; the real build uses actual d3.

## 6. Files touched (summary)
- NEW `apps/hq/src/surfaces/music/Scope.tsx` (waveform/spectrogram/spectrum/radial + FFT + playhead)
- NEW `apps/hq/src/surfaces/music/Analytics.tsx` (KPIs + bubble + donut + ranked + area)
- EDIT `apps/hq/src/surfaces/music/MusicBuilder.tsx` (swap chart→Scope, Overview→Analytics, Publish→top)
- EDIT `apps/hq/src/surfaces/music/music.css` (one-page grids, dark scope, dashboard panels)
- DEL  `apps/hq/src/surfaces/music/EnvelopeChart.tsx` (superseded by Scope; envelope becomes an overlay)
- EDIT `apps/hq/package.json` (+ d3-scale, d3-shape, d3-axis)
- NEW  `supabase/migration_audio_usage_daily.sql` (Phase 4 only)

## 7. Sources
- iZotope RX / Audacity / Sonic Visualiser spectrogram practice + log/Mel scaling — LANDR, Perfect Circuit, production-expert.
- WebAudio `AnalyserNode` / `OfflineAudioContext` FFT visualization — MDN, blog.scottlogic, spectrogramJS (vlandham).
- Dashboard patterns (top-rail KPI hot zone, 5–7 KPIs, quadrant, scatter for correlation, bars over pie) — DataCamp, Qlik, Sigma, datawirefra.me.
- ADSR / one-shot envelope + FMOD/Wwise/Serum visual envelopes — WolfSound, LANDR, gamedesignskills.
