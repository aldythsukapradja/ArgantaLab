---
title: Jarvis OS Cinema Program - WS1 Build Plan (Slot Contract & End-to-End)
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
  - build-plan
  - slot-contract
---

# Jarvis OS Cinema Program — WS1 Build Plan

> [!summary]
> The buildable plan for WS1: deliver a **complete Act I→VII cinematic on the real `apps/hq` landing page now**, using what exists today, with the **rebuilt reactor ([[20260714-Architecture-JarvisOS-CinemaProgram-WS2-JarvisReactor|WS2]]) and rebuilt 3D nodes ([[20260714-Architecture-JarvisOS-CinemaProgram-WS3-KnowledgeNodes|WS3]]) swapping in behind two stable slots** as they land in their parallel sessions. This note defines the **slot contract** all three workstreams share. Parent: [[20260714-Architecture-JarvisOS-CinemaProgram-WS1-Storyline-CinemaDirector|WS1 Storyline & Cinema Director]]. Data source: [[20260713-Architecture-JarvisOS-NarrativeStudio-SceneManifest|Scene Manifest]] (46 scenes).

## The integration principle

WS1 owns the story and two adapter seams. Each seam renders a **fallback today** and **auto-upgrades** when the parallel session ships — the cinematic is end-to-end from the first milestone; WS2/WS3 only raise fidelity.

```text
        WS1 Cinema Director (audio clock, mode, focus, staging)
              │  emits SceneState
      ┌───────┴────────┐
      ▼                ▼
  <CoreSlot>       <NodesSlot>
  legacy → ws2     placeholder → ws3
 (ReactorOrb)     (2D Vault graph)
```

## Slot contract (the one interface WS2/WS3 build to)

Published from `apps/hq/src/cinema/contract.ts`. Frozen once shipped; changes only here, then the other sessions pull.

```ts
export type Act = 1|2|3|4|5|6|7;
export type Mode = 'normal'|'guided'|'auto'|'paused'|'director';
export type Voice = 'JM'|'KF';               // only these two are recorded

// The single semantic value WS1 emits every scene. WS2/WS3 READ, never drive.
export type SceneState = {
  id: string; act: Act; mode: Mode;
  voice: Voice;
  product?: string;                          // Act III focus product id
  core: CoreState;                           // → CoreSlot
  nodes: NodesState;                         // → NodesSlot
  focusInstrument?: string;                  // Landing instrument id, or 'all'/'none'
  progress: number;                          // 0..1 within the current clip (audio clock)
};

// ── CoreSlot (WS2) ───────────────────────────────────────────────
export type CoreState =
  | 'offline' | 'booting' | 'idle' | 'listening'
  | 'jarvis-speaking' | 'specialist-speaking'
  | 'think' | 'know' | 'do'
  | 'product-focus' | 'popup-open'
  | 'vault-entry' | 'architecture-unfold' | 'return';

export type CoreSlotProps = {
  state: CoreState;
  product?: string;                          // tint / focus in product beats
  progress: number;                          // 0..1 for beat-synced motion
  renderer?: 'legacy'|'ws2'|'media';         // WS1 flips this; default auto
  reducedMotion?: boolean; quality?: 'high'|'medium'|'mobile';
};

// ── NodesSlot (WS3) ──────────────────────────────────────────────
export type NodesState = {
  visible: boolean;
  focusNode?: string;                        // node id to spotlight
  path?: string[];                           // Founder→…→Products spine to trace
  tour?: 'A'|'B'|'C'|'D';                    // active auto tour, if any
};

export type NodesSlotProps = {
  state: NodesState;
  progress: number;
  renderer?: 'placeholder'|'ws3';
  reducedMotion?: boolean; quality?: 'high'|'medium'|'mobile';
};
```

Rules: slots receive props only; they never read audio, never advance scenes, never touch each other. WS1 never reaches into Three.js.

## Renderer registry (the one-line swap)

```ts
// apps/hq/src/cinema/registry.ts
export const RENDERERS = {
  core:  'legacy',        // → 'ws2'  when WS2 ships
  nodes: 'placeholder',   // → 'ws3'  when WS3 ships
} as const;
```

The slot components read this (or auto-detect a real export) and pick their renderer. Flipping a value upgrades the whole movie with zero WS1 changes.

## Where each act's visual comes from

| Act | Beat | Today (fallback) | After WS2/WS3 |
|---|---|---|---|
| I–II | ignition, instruments | real `ld-ignition` + current `ReactorOrb` + real instruments | new reactor states |
| III | five products | **real** `ProductDetail` + instruments | unchanged |
| IV | THINK/KNOW/DO | reactor glow + caption fallback | WS2 triad-hinge split |
| V–VI | architecture graph, proof | **2D Vault graph** via `NodesSlot` | WS3 3D node tour |
| VII | recombine → return | current reactor + return to Normal | WS2 recombine |

## Milestones — every phase is a full watch-through

- **E0 · End-to-end skeleton (real page).** Contract + `scenario.ts` (46 scenes, byte-identical to the deck) + Director core (audio = master clock, Auto/Guided/Paused, keyboard, subtitles) + stage staging over the live cockpit + both slot adapters (legacy reactor, 2D-graph nodes). → Press Auto on the real HQ home, watch Act I→VII, cockpit alive underneath.
- **E1 · Reactor swap-in.** WS2 ships → `RENDERERS.core = 'ws2'`. Acts I/II/IV/VII get the rebuilt 2D→3D reactor + real THINK/KNOW/DO.
- **E2 · Nodes swap-in.** WS3 ships → `RENDERERS.nodes = 'ws3'`. Acts V/VI become the real 3D knowledge tour resolving to Vault notes.
- **E3 · Director + Higgsfield-ready.** Cinema Director authoring overlay (re-time/re-focus/export `scenario.json`) + deterministic timeline so a Higgsfield core can drop into `CoreSlot renderer='media'`.

## P0 — the first buildable step (unblocks all three sessions)

1. `cinema/contract.ts` — the frozen types above.
2. `cinema/scenario.ts` — the 46 scenes + narration, ported verbatim from the rehearsal deck (no drift).
3. `cinema/slots/CoreSlot.tsx` + `cinema/slots/NodesSlot.tsx` — adapters with the registry; legacy reactor + 2D-graph fallbacks; `ws2`/`ws3` branches ready but inert.
4. `cinema/CinemaDev.tsx` — a dev harness that lists all 46 scenes and plays each clip on the audio clock (proves data + audio wiring before any staging).

## File ownership & boundaries

| Session | Owns | Reads | Must not touch |
|---|---|---|---|
| **WS1** | `cinema/**`, `contract.ts`, `Landing.tsx` mount seams | everything | `reactor/`, `knowledge/` internals |
| **WS2** | `reactor/**` (fulfills `CoreSlotProps`) | `contract.ts`, `ReactorOrb.tsx` | `Landing.tsx`, `cinema/`, `knowledge/` |
| **WS3** | `knowledge/**` (fulfills `NodesSlotProps`) | `contract.ts`, `vault/**` | `Landing.tsx`, `cinema/`, `reactor/` |

## Battle-test / risks

> [!warning]
> - **End-to-end must never block on WS2/WS3.** Both slots ship working fallbacks in E0; a missing `ws2`/`ws3` export silently falls back, never errors.
> - **One source of scenes.** `scenario.ts` is the only scene array; CI/lint check it matches the Scene Manifest ids/order.
> - **Audio is master clock.** No timers; advance on real `ended`; skip missing clips with a toast.
> - **Normal survives.** Every stage additive + reversible; any failure returns to the live cockpit via `Esc`.
> - **Contract is frozen.** Prop-shape changes ripple to two other sessions — version and announce them.
> - **Perf.** Gate narration/subtitle rAF on `playing && !document.hidden` (the deck idled ~140fps).

## Acceptance

On the real `apps/hq` home: Auto ignites the cockpit, narrates all seven acts with reactor + products + graph reacting on the audio clock, and returns cleanly to Normal — with the rebuilt reactor and rebuilt 3D nodes plugged in through their slots when present, and working fallbacks when not.
