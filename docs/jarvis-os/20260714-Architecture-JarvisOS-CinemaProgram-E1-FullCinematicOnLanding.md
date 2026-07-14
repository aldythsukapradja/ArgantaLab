---
title: Jarvis OS Cinema Program - E1 Full Cinematic on Landing
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
  - integration
---

# Cinema Program — E1 · Full Cinematic on Landing

> [!summary]
> Build plan to port the **reactor (center), the 3D knowledge (deep dive), and the narration/Director (the cinematic)** onto the real `Landing.tsx` CEO Orb — so the live cockpit *becomes* the movie. The Director orchestrates; the reactor core is the centre; the 3D knowledge is the "how it works" deep dive. Assembles [[20260714-Architecture-JarvisOS-CinemaProgram-WS1-BuildPlan|WS1]] + [[20260714-Architecture-JarvisOS-CinemaProgram-WS2-JarvisReactor|WS2]] + [[20260714-Architecture-JarvisOS-CinemaProgram-WS3-KnowledgeNodes|WS3]] + [[20260714-Architecture-JarvisOS-CinemaProgram-E0-LandingChoreography|E0 choreography]].

## The three components

| Component | Role | Lives now | Ported onto Landing as |
|---|---|---|---|
| **Director** (WS1) | the full cinematic — audio clock, 46 scenes, modes, karaoke, scenario/versions | `cinema/` (Cinema tab) | a `CinemaStage` controller mounted over `Landing`, driving everything |
| **Reactor** (WS2) | the centre core | `reactor/` · `RENDERERS.core='ws2'` (live) | the `ld-stage` centre via `CoreSlot`, driven by `CoreState` per scene |
| **3D Knowledge** (WS3) | deep-dive: show how it works | `knowledge/KnowledgeSurface` (own surface) | an overlay entered on the architecture acts, returns to the cockpit |

## Current state (what's already done)

- Director runtime, 46-scene scenario, karaoke, editor, versioning, Supabase migration **run** — built + verified.
- Reactor flipped to `ws2` (real WS2 core in the slot). 3D `KnowledgeSurface` shipped. E0 choreography **concept** ready.
- Missing: the **assembly on the real Landing** — that's this plan.

## Build plan

| Phase | Deliverable | Ports (from → to) | Depends on | You'll see | Effort |
|---|---|---|---|---|---|
| **P1** | **Director on Landing** — mount the scene runner over the live cockpit; Normal / Auto / Guided; enter from the `ld-dock` mic | `cinema/director.ts` + `scenario.ts` → `Landing.tsx` overlay | — | Press "Play cinematic" on the CEO Orb → it narrates Act I→VII, cockpit alive underneath | 3–5d |
| **P2** | **Core = centre** — Director's `CoreState` drives the reactor in `ld-stage` | `CoreSlot(ws2)` → `Landing` centre | WS2 reactor props | Reactor ignites / THINK·KNOW·DO / product-focus / recombine on cue | 2–4d |
| **P3** | **Instrument choreography** — `data-instrument` on the 6 panels + `dim/glow/focus/trace/countup` from `StageDirection` | E0 concept → `Landing.tsx` + `landing.css` | E0 | Left/right charts glow, trace, count-up as narration hits them | 4–6d |
| **P4** | **Narration layer** — karaoke subtitle + speaker chip + provenance over the real stage | `lib/karaoke` → `Landing` | P1 | Word-by-word subtitle synced to the clip on the live page | 2–3d |
| **P5** | **3D Knowledge deep-dive** — enter `KnowledgeSurface` on `vault-entry`/architecture acts, deterministic return | `knowledge/` → `Landing` overlay | WS3 `NodesSlot` | Acts V/VI dive into the 3D graph "how it works", then fold back to the orb | 5–8d |
| **P6** | **`center` hero move** — a focused panel flies over the reactor (GSAP+FLIP), returns on exit | E0 → `Landing` | P3 | The signature "chart pulls to centre" beat | 3–5d |
| **P7** | **Author on Landing** — the Director Stage picker + scenario edits apply to the live page | `cinema` editor → `Landing` | P1–P3 | Re-time / re-focus / re-choreograph any beat, no code | 3–5d |
| **P8** | **Cloud + polish** — flip persistence to Supabase, reduced-motion, mobile, video export | `persistence.ts` → store; polish pass | migration (done) | Scenario syncs across devices; robust on mobile; export the film | 3–5d |

## Contract (one seam holds it together)

The Director emits one **`SceneState`** per scene; three consumers *react*, never drive:
`core` → reactor · `nodes` → 3D knowledge · `stage[]` → the 6 instruments. Audio is the master clock; `scenario.json` (⇄ Supabase) is the single source; Normal mode is always recoverable.

## Delivery order & dependencies

```text
P1 Director ─┬─▶ P2 Core(reactor) ─▶ P6 center hero
             ├─▶ P3 Instruments ────▶ P7 Author on Landing
             ├─▶ P4 Narration
             └─▶ P5 Knowledge deep-dive ──▶ P8 Cloud + polish
```

P1 unblocks everything; P2/P3/P4/P5 are independent and parallelizable; P6/P7/P8 are polish/finish.

## Battle-test / risks

> [!warning]
> - **Normal cockpit is sacred** — every phase is additive under a `data-cinema` flag; a crash returns to the live orb.
> - **One reactor** — Landing already renders `ReactorOrb`; P2 must route through the `CoreSlot(ws2)` seam, not run two reactors.
> - **Deep-dive continuity** (P5) — the reactor must dissolve *into* the 3D graph and back without a jarring surface switch; share a transition, don't hard-cut between surfaces.
> - **`center` FLIP** (P6) is the hardest bit — prototype early; guard the 45s live-refresh during a flight.
> - **Provenance** — choreography animates real values or `—`, never fabricated numbers.
> - **Mobile** — instruments are a drawer; `center` degrades to `focus`; deep-dive is auto-framed.

## First slice

P1 + P2: press play on the real CEO Orb → it narrates Act I→VII with the **real reactor** reacting at centre and the cockpit alive underneath. That alone is the "it's alive" moment; P3–P8 layer the richness.
