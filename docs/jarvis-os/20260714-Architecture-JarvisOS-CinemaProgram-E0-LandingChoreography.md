---
title: Jarvis OS Cinema Program - E0 Landing Choreography
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
  - landing
  - choreography
---

# Cinema Program — E0 · Landing Choreography

> [!summary]
> Concept for wiring the **Cinema scenario to the real Landing cockpit**: when a scene focuses an instrument, *what that chart actually does* — glow, enlarge, pull to centre, trace, count-up — as a controllable **animation vocabulary** the founder authors per scene from the Cinema Director. This is WS1 · E0 (staging the cinematic over the live page). Extends [[20260714-Architecture-JarvisOS-CinemaProgram-WS1-BuildPlan|the build plan]]; feeds the reactor ([[20260714-Architecture-JarvisOS-CinemaProgram-WS2-JarvisReactor|WS2]]) and nodes ([[20260714-Architecture-JarvisOS-CinemaProgram-WS3-KnowledgeNodes|WS3]]) slots the same way.

## Principle

`Landing.tsx` stays a real, live cockpit. Cinema adds a **`data-cinema` overlay mode** that *choreographs the existing panels* — it never rebuilds them, never fakes their data, and Normal mode is always one `Esc` away. The Director emits a **stage direction** per scene; the Landing applies it on the audio clock.

## The six instruments (real anchors)

Each is a `SignalFrame` / `.ld-panel` in `Landing.tsx`. Give each a stable `data-instrument` id so Cinema can target it.

| id | Panel (class) | Chart component | Signature move |
|---|---|---|---|
| `reach` | World Reach (`.ld-map-panel`) | `PortfolioWorldMap` | region dots pulse outward; arcs draw between them |
| `engaged` | Weekly Engaged (`.ld-trend-panel`) | `AreaTrend` | area path **traces left→right**; WoW metric counts up |
| `valuation` | Valuation Audit (`.ld-valuation-panel`) | `ValuationAuditPanel` | range bar fills; point-estimate counts up |
| `products` | Five Products (`.ld-products-panel`) | product buttons | rows **cascade in**; the active product lifts + glows |
| `access` | Access & Attention (`.ld-access-panel`) | `DonutD3` + `HBars` | donut **sweeps** 0→full; bars grow in sequence |
| `rhythm` | Visit Rhythm (`.ld-rhythm-panel`) | `PunchCard` | heatmap **ripples** diagonally; hot cells bloom |

`all` and `none` are also valid targets (focus every panel / clear focus).

## Animation vocabulary (the effects a scene can invoke)

One shared, composable set — each effect is a CSS class + optional GSAP tween, driven by the clip's progress so motion tracks the narration.

| Effect | What the panel does | Feels like |
|---|---|---|
| `idle` | resting live state | baseline |
| `dim` | recede: lower opacity + slight desaturate + scale .98 | "not this one" |
| `glow` | accent ring + soft bloom on the panel border | "look here" |
| `focus` | glow + lift (scale ~1.04) + raise z, neighbours `dim` | the default spotlight |
| `enlarge` | grow to ~1.5× in place, chart re-lays out larger | "this is the point" |
| `center` | **detach and fly to stage centre** over the reactor, oversized; return on exit | the hero move |
| `trace` | animate the chart's own draw-in (area path, donut sweep, bars, map arcs) | "watch it build" |
| `countup` | roll the metric numbers from 0 to live value | "the number matters" |
| `pulse` | one-shot attention beat (used on data change / callout) | "notice this" |
| `exit` | release focus, ease back to `idle` | scene hand-off |

Composability: a direction is `{ target, effect, intensity }` and a scene can hold several (e.g. `products:center` + everything-else:`dim`). Effects layer (`focus` = `glow` + lift).

## The hero move — "pull to centre"

`center` is the dramatic one you described. On a scene like *"Weekly Engaged"*, the panel **lifts out of the left rail, scales up, and glides to the stage centre** (where the reactor sits), the reactor dims behind it, the chart `trace`s itself large, the metric `countup`s — then on scene exit it glides home and the reactor returns. Purely presentational, audio-clock-timed, fully reversible.

## Contract (how scenes carry it)

Extend the scene's semantic state with stage directions — the Director emits them, the Landing consumes them (one-way, same rule as the reactor/nodes slots).

```ts
type InstrumentId = 'reach'|'engaged'|'valuation'|'products'|'access'|'rhythm'
type StageEffect = 'idle'|'dim'|'glow'|'focus'|'enlarge'|'center'|'trace'|'countup'|'pulse'|'exit'
interface StageDirection { target: InstrumentId | 'all' | 'none'; effect: StageEffect; intensity?: number }

// added to SceneState
stage: StageDirection[]   // e.g. [{target:'engaged',effect:'center'},{target:'all',effect:'dim'}]
```

`deriveState` gives sensible defaults per act (Act II already focuses instruments; Act III → `products:focus`); the Director editor overrides them per scene.

## Runtime (how it drives Landing)

- A `CinemaStage` controller mounts over `Landing` when Cinema plays it. It sets `data-cinema` on `.ld` and, each scene, applies `data-fx="<effect>"` to the targeted `[data-instrument]` panels.
- CSS handles `dim/glow/focus/enlarge/pulse`; **GSAP + FLIP** handles `center` (measure home rect → animate to centre → animate back). `trace/countup` call each chart's existing draw-in (the `booted`/`ld-entrance-*` hooks already exist — reuse them).
- All timing derives from the clip `progress` (audio master clock). `prefers-reduced-motion` → instant focus, no flight.
- **Normal mode**: no `data-cinema`, zero effect — the live cockpit is untouched.

## Authoring — full control from the Cinema Director

The editor's inspector gets a **Stage** section per scene:
- A row of the 6 instruments (+ All/None); tap to add a direction.
- Per direction: an **effect picker** (the vocabulary above) + an intensity slider.
- Live preview applies it to the real panels instantly; **Save version** snapshots it; it exports into `scenario.json` and (now that the migration is run) syncs to Supabase (`cinema_scene_edits`).

So every beat's choreography — which chart, glow vs centre vs trace — is founder-authored and versioned, no code.

## Battle-test / risks

> [!warning]
> - **`center` (FLIP) is the hard part** — measuring the panel's home rect and flying it over the reactor without layout jank. Prototype this one first; the rest are CSS.
> - **Don't fight the live refresh.** Panels refresh every 45s; pause/guard refresh-driven re-layout while a panel is mid-flight.
> - **Provenance holds.** `countup` animates to the *real* value (or shows `—`); never animate a fabricated number.
> - **Normal must survive.** Every effect is additive under `data-cinema`; a failure returns to the untouched cockpit.
> - **Perf.** Only the targeted panels animate; gate any rAF on playing + visible.
> - **Mobile.** Instruments live in a drawer on mobile — `center` degrades to `focus`.

## First slice

Wire `data-instrument` on the 6 panels → implement `dim/glow/focus` + `trace` for `engaged` and `access` → drive them from Act II scenes on the audio clock → add the Stage picker to the Director. Then build the `center` hero move for one scene.
