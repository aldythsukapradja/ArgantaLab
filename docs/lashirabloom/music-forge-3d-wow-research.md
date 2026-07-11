# Music Forge visualizer — "full wow" research + build options

Status: research + recommendation (2026-07-10). The Music Forge radial visualizer is live and
theme-aware, but the user wants a bigger step-up in wow (3D, GSAP). This surveys the JS landscape,
names reference sites, and recommends a concrete path. **Music Forge lives in HQ only** (React) — it
is NOT bound by the game's zero-asset/CSP-safe constraint, so heavier libraries are on the table
here (the game's ambient bed just runs the `@arganta/audio` transport, untouched).

## What's already in the repo (matters for cost)
- **GSAP `^3.15.0` is already a dependency of `apps/hq`** → zero new dep to use it.
- `d3-scale/shape` + Canvas2D power the current visualizer.
- The audio graph already exposes an `AnalyserNode` (fftSize 256) + per-note `onEvent` from the
  transport — exactly the two feeds any wow upgrade needs.

## The library landscape (surveyed)

| Library | What it gives | Fit for Music Forge |
|---|---|---|
| **Three.js** | Full WebGL 3D — geometry, GLSL shaders, particles, camera. The standard for 3D audio-reactive. | **Top pick for max wow.** New dep (~150KB gz) but HQ can take it. |
| **react-three-fiber** (+ drei) | React bindings for Three.js — declarative `<Canvas>`, hooks, `useFrame`. | Best if we go 3D *and* want it to feel native in HQ's React. Pairs with Three.js. |
| **GSAP** (already in HQ) | Buttery tweens/timelines, Draggable + Inertia plugins. Not a renderer — the *motion* layer. | **Use regardless.** Camera moves, play/pause zoom, UI inertia, orb pop. |
| **Butterchurn** | WebGL Milkdrop visualizer, 100+ presets, GPU. Drop-in psychedelic wow. | Great instant wow, but it's *its own* aesthetic (rave/Milkdrop), hard to brand to Circle HQ + doesn't map to our per-role instruments. Good as an optional "party mode," not the core. |
| **PixiJS** | Fast 2D WebGL (filters, bloom, displacement). | Middle path — richer than Canvas2D, lighter than 3D. Good if we want glow/bloom without going 3D. |
| **p5.js** | Creative-coding sandbox. | Great for prototyping, heavier/opinionated for production in a React app. |
| **ogl / curtains.js** | Tiny WebGL/shader libs. | If we want *just* a shader background (fresnel/noise) without full Three.js weight. |
| **AudioMotion-analyzer** | Polished spectrum analyzer component. | Only a spectrum; we already have a richer bespoke one. |
| **wavesurfer.js / peaks.js** | Waveform players for *files*. | Not for live generative audio — skip. |

## Reference sites (real, with this capability)
- **Codrops — "Coding a 3D Audio Visualizer with Three.js, GSAP & Web Audio API" (Jun 2025)** — an
  almost-exact blueprint for what we want: an **Icosahedron wireframe sphere** displaced by a GLSL
  **Simplex-noise vertex shader** scaled by `audioLevel`, an inner glow sphere with a **fresnel**
  fragment shader that pulses with the audio, a particle field, and **GSAP** for the camera
  zoom-on-play + draggable inertia orbit. No postprocessing lib needed — additive blending + custom
  shaders. (tympanus.net/codrops)
- **butterchurnviz.com** — the Milkdrop-in-WebGL reference (the "instant preset wow" option).
- **zoharbarzilai/Generative-3D-Audio-Visualizer** (GitHub) — React + Three.js + Web Audio, a
  generative sphere + starfield; a working r3f example to crib structure from.
- **purzbeats/viz** (GitHub) — Butterchurn integration with custom `.milk` presets.
- **AudioMotion**, **freefrontend/awesome-audio-visualization** — galleries of 2D approaches.

## Recommendation — a "Conductor Orb" in Three.js + GSAP (keep the current one as 2D fallback)
Build a **3D audio-reactive centrepiece** that keeps our *meaningful* structure (7 instrument
roles) instead of a generic blob:
1. **Center: a morphing icosahedron orb** — GLSL vertex shader displaces it with Simplex noise
   scaled by the live `audioLevel` (from the AnalyserNode), so it breathes/spikes with the music.
   A fresnel fragment shader makes its rim glow, tinted by the theme's key/mood.
2. **7 instrument satellites orbiting the orb** — each role is a small glowing 3D node (keeping the
   icon/level idea in 3D); when a role fires (transport `onEvent`), **GSAP** pops its scale + shoots
   a light-trail/particle burst from the orb to the satellite. This preserves the "you can see each
   instrument play" readability the current viz has, now in depth.
3. **Particle starfield + bloom-ish additive glow** for atmosphere; camera slow-orbits (GSAP) and
   **zooms in on play / out on pause**.
4. **Theme-aware**: scene background + fog + accent lights read the HQ light/dark tokens (light =
   airy pale scene, dark = deep space), so it still follows Circle HQ theme.
5. **Fancier type** (done this pass): role labels are now bigger, uppercase, role-coloured with the
   instrument name beneath; the track title is a gradient headline. In 3D these become billboarded
   sprites or an HTML overlay (drei `<Html>`), kept crisp.
6. **Perf/safety**: `prefers-reduced-motion` + a "2D / 3D" toggle that falls back to the current
   Canvas2D visualizer (which stays as the guaranteed-works baseline). Lazy-load Three.js so it
   doesn't bloat the rest of HQ's bundle.

**Deps to add:** `three` + `@react-three/fiber` (+ optionally `@react-three/drei` for `<Html>`
labels and helpers). GSAP already present.

## Effort / phasing
- **Phase A** (small, now-ish): the text/label upgrade — **done this pass**. Add GSAP polish to the
  *existing* Canvas2D viz (orb pop on note via `gsap`, camera-less but eased pulses) for a quick lift
  with zero new deps.
- **Phase B** (the real wow): the Three.js + r3f "Conductor Orb" above, with the 2D fallback toggle.
- **Phase C** (optional): a "Party mode" that swaps in **Butterchurn** for a full Milkdrop takeover
  when the operator just wants eye-candy.

## Honesty
Three.js/r3f are real new dependencies (~200KB gz combined) — justified because this is the HQ
operator studio (not shipped to kids' game clients) and it's lazy-loaded. The current Canvas2D viz
stays as the always-works fallback. Nothing here is built yet except the Phase-A text upgrade;
say the word and I'll build Phase B.

## Sources
- Codrops (Three.js + GSAP + Web Audio 3D visualizer, 2025) · Butterchurn (jberg/butterchurn, butterchurnviz.com) ·
  three.js docs · react-three-fiber · GSAP docs · awesome-audio-visualization · AudioMotion · MDN Web Audio visualizations.
