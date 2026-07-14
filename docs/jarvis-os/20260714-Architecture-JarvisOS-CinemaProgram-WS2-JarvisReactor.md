---
title: Jarvis OS Cinema Program - WS2 Jarvis Reactor
date: 2026-07-14
type: architecture
status: draft
project: Jarvis OS
program: Cinema Program
workstream: WS2
tags:
  - jarvis-os
  - circle-hq
  - cinema-program
  - reactor
  - reactor-core
---

# Jarvis OS Cinema Program — WS2 · Jarvis Reactor

> [!summary]
> The hero core, rebuilt from scratch in `apps/hq` as one swappable **core slot**: **2D first**, then an **expanded 3D** machine with several selectable expansion choreographies, and finally a **Higgsfield media slot** the generative pipeline can drop into without touching the shell. Driven only by semantic scene state from [[20260714-Architecture-JarvisOS-CinemaProgram-WS1-Storyline-CinemaDirector|WS1]].

## Where it sits

Sibling of WS1 and [[20260714-Architecture-JarvisOS-CinemaProgram-WS3-KnowledgeNodes|WS3 Knowledge Nodes]]. Inherits the visual grammar of [[20260713-Architecture-JarvisOS-Workstream03-OrbVisualSystem|Orb & Visual System]] and the "70% physical / 20% controlled energy / 10% holographic — not an Iron Man copy" target from the true-3D prototype's embedded brief.

## Mission

A reactor that reads as a real Arganta industrial-spatial machine, states are unmistakable, the five products stay usable, and the whole thing is one component a Higgsfield asset can later replace.

## What exists today (reuse, don't worship)

`surfaces/ReactorOrb.tsx` (~1081 lines) is already R3F + real `@react-three/postprocessing` Bloom + GSAP ignition + custom GLSL (core/point/ring-dust) + Vault `KB_NOTES` particles + product orbits + live/partial/offline signal + boot replay. **Harvest** its shaders, bloom, particle field and product orbit. **Rebuild** the anatomy around THINK · KNOW · DO and behind the new slot API. Preserve its props so `Landing.tsx` keeps working: `{ dark, selectedProduct, onSelectProduct, onHoverProduct, signalState, bootKey, quickBoot, skipBoot, reducedMotion, onBootComplete }`.

## The core slot (one interface, three renderers)

```tsx
<CoreSlot renderer={'2d' | 'r3f' | 'media'} state={sceneState} />
```

- **`2d`** — ship first. Canvas/SVG: layered rings, additive glow, energy pulses on the audio clock, a 2D THINK/KNOW/DO triad. Cheap, controllable, mobile-safe. Permanent low-tier fallback.
- **`r3f`** — the expanded 3D machine (below). Same `state` in.
- **`media`** — a **Higgsfield-generated MP4 loop or GLB**, keyed to the same `state`. This is how "Higgsfield takes over": swap `renderer`, nothing else moves.

WS1 never sees which renderer is active. The slot owns a **deterministic timeline** (per-scene start/duration from the audio clock) so the tour can be captured and a Higgsfield asset aligned frame-accurately.

## Semantic states (from Orb & Visual System)

`offline · booting · idle · listening · jarvis-speaking · specialist-speaking · THINK · KNOW · DO · product-focus · popup-open · vault-entry · architecture-unfold · return`. Anatomy: **THINK** inner precision & decision pulses · **KNOW** particle memory & provenance · **DO** outer mechanics & outward execution energy.

## Build order

1. **2D core** speaking the full state API; wire WS1 to it; demo the whole cinema in 2D before any 3D.
2. **3D core** behind the same API: ACES tonemapping, soft shadows, warm/cool studio lights, believable metallic thickness, Z-depth layers, real `EffectComposer`/`UnrealBloomPass` (the true-3D prototype only *faked* bloom with additive sprites — this is the biggest wow lever).
3. **Media slot** contract + deterministic timeline for Higgsfield handoff.

## 3D expansion — choreography options (pick per beat)

> [!note]
> The unified emblem is front-facing and compressed; expansion must reveal genuine depth. These are selectable presets so the founder can iterate in the [[20260714-Architecture-JarvisOS-CinemaProgram-WS1-Storyline-CinemaDirector|Cinema Director]].

| # | Choreography | Motion | Feels like | Best beat |
|---|---|---|---|---|
| 1 | **Axial spine / accordion** | layers slide apart on Z; camera to three-quarter | a real machine opening | default Reveal |
| 2 | **Vertical tower / exploded stack** | layers lift into floors on Y; camera tilts up | a system with levels/hierarchy | Founder→…→Products |
| 3 | **Radial iris bloom** | rings fan out in XY then tilt to depth | holographic / AI | elegant intro |
| 4 | **Triad hinge** | core cracks; THINK/KNOW/DO hinge to a triangle at 3 depths/tilts | cognition splitting | Act IV |
| 5 | **Orbital scatter** | everything drifts into slow spatial orbit; 5 products take a 3D field | architecture coming online | Act V bridge |
| 6 | **Helix / knowledge spiral** | layers spiral around a vertical axis | knowledge unwinding | hand-off into WS3 |

Recommended signature set: **#1 axial** as the default reveal, **#4 triad** for Act IV, **#5 orbital** as the bridge into the [[20260714-Architecture-JarvisOS-CinemaProgram-WS3-KnowledgeNodes|3D nodes]].

## Contract

WS2 receives semantic props from WS1 only and never reads audio or drives the story. GSAP master timelines for authored transitions; `useFrame` for idle spin/energy/particles/signal travel; each animated layer is an independent named group so a GLB (or Higgsfield node) can replace it 1:1.

## Battle-test / risks

> [!warning]
> - **Don't regress the live orb.** `Landing.tsx` renders `ReactorOrb` today; keep the prop surface stable or ship the new core behind a flag until parity.
> - **Real bloom cost.** `EffectComposer` + bloom is the wow but also the frame budget; enforce quality tiers (high/medium/mobile), DPR cap, reduced-motion crossfade path, and WebGL fallback to the 2D core.
> - **Two renderers, one truth.** 2D and 3D must express each state identically enough that a Director preview in 2D matches the 3D show.
> - **Higgsfield seam is real work.** Define the media contract (state → asset id + in/out frames) *before* generating, or assets won't align to the audio clock.
> - **No false intelligence.** Visuals must never imply live AI reasoning; the reactor is presentational.

## Acceptance

Each semantic state is unmistakable in both 2D and 3D; the five products stay clickable; ignition/unfold/vault-entry/recombination are continuous; 30–60fps on target tiers with a clean reduced-motion path; the `media` renderer can swap in a Higgsfield asset with no shell/Director change.

## Effort & delegation

~16–28 focused days across the 2D→3D→media ladder. Visual director: Opus-class. R3F/shader implementation: Sonnet creative frontend. Perf reviewer: separate. Debug: Codex-class.
