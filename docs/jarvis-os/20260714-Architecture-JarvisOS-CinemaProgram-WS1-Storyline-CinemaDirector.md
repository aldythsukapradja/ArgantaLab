---
title: Jarvis OS Cinema Program - WS1 Storyline & Cinema Director
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
  - storyline
  - cinema-director
---

# Jarvis OS Cinema Program — WS1 · Storyline & Cinema Director

> [!summary]
> The storyline layer. It binds the 46 recorded audio clips to explicit **cinematic stages** that transform the *real* HQ landing page (`Landing.tsx`) from a live cockpit into a cinema — and ships a **Cinema Director mode** so the founder can re-time, re-focus and re-author every beat later without touching code. Orchestrates the other two workstreams by semantic contract only.

## The three-workstream program

This is a from-scratch rebuild directly in `apps/hq`, superseding the old five-workstream split by folding it into three buildable tracks:

- **WS1 — Storyline & Cinema Director** (this note): the screenplay-to-stage binding + the authoring/iteration tool. The conductor.
- **WS2 — [[20260714-Architecture-JarvisOS-CinemaProgram-WS2-JarvisReactor|Jarvis Reactor]]**: the core visual, 2D first → 3D expansion → Higgsfield slot.
- **WS3 — [[20260714-Architecture-JarvisOS-CinemaProgram-WS3-KnowledgeNodes|3D Knowledge Nodes]]**: the spatial Vault digital twin.

Ancestors (still canonical, do not re-key): [[20260713-Architecture-JarvisOS-MasterPlan|Master Plan]], [[20260713-Architecture-JarvisOS-NarrativeStudio-SceneManifest|Scene Manifest]] (the 46-scene source of truth), [[20260713-Architecture-JarvisOS-Workstream02-ExperienceEngine|Experience Engine]], [[20260713-Architecture-JarvisOS-Workstream05-NarrativeProduction|Narrative Production]].

```text
        WS1 Cinema Director  ── emits semantic scene ──▶  WS2 Reactor
              │  (owns audio clock, mode, focus)          WS3 Nodes
              └── reads real Landing instruments ─────────▶ cockpit
```

The contract is one-directional: WS1 emits a scene's **semantic intent**; WS2 and WS3 *react*. Neither WS2 nor WS3 ever reads audio or drives the story; WS1 never manipulates Three.js internals.

## Mission

Make the live cockpit *become* the movie — not a slideshow over it — and keep the story editable forever.

## Source of truth: the audio is the clock

- 46 clips, 7 acts, order fixed by scene `id`, in `apps/hq/public/audio/`. Only **JM** (adult male Jarvis) and **KF** (adult female) were recorded — child voices AB/LG do **not** exist; the storyline must never assume four voices.
- A scene's duration = its clip length. Never hard-code seconds. Advance only on the real audio `ended` event.
- Missing/failed clip → skip forward + toast, never block. (Proven in the rehearsal deck.)

## The cinematic stages (how the cockpit turns into cinema)

Five transformation stages, each a reversible visual contract over the *existing* `Landing.tsx`:

| Stage | Name | What the page does | Real anchors |
|---|---|---|---|
| 0 | **Live cockpit** (Normal) | Untouched operational HQ. Instruments show live/partial/offline via `signalState`; provenance banner honored. | `LeftInstruments`, `RightInstruments`, `ld-dock` |
| 1 | **Ignition** | Reuse the existing `ld-ignition` boot; reactor lights; Jarvis greets by role. | `bootKey`, `onBootComplete`, `ReactorOrb` |
| 2 | **Guided** | Jarvis narrates; instruments dim/focus/speak; founder keeps product + Vault control; live iframes stay under founder hand. | instrument states, `ProductDetail` |
| 3 | **Auto cinema** | Full unattended tour Act I→VII; opens popups, plays silent desktop/mobile recordings, drives reactor + nodes. | `selectedProduct`, Auto-Demo tab |
| 4 | **Director** | Authoring overlay (see below). Non-production, founder-only. | scenario JSON |

Stage transitions are entered from the `ld-dock` mic button (`toggleAgent`, "Talk to Jarvis"). Normal is the resting state and must always be recoverable via `Esc`.

## Storyline ↔ act ↔ cockpit map

| Act | Clips | Stage behavior | Cockpit choreography |
|---|---:|---|---|
| I Ignition & cockpit | 3 | ignition → drawers open | reactor idle glow; left then right instruments arrive |
| II Six instruments | 3 | focus each instrument as named | `LeftInstruments`/`RightInstruments` focus + truth policy |
| III Five products | 25 | product tour, 5-beat pattern | orbit select → `ProductDetail` Overview → Desktop → Mobile → summary; KF for LashiraBloom + Landing |
| IV THINK / KNOW / DO | 4 | drawers close, reactor splits | WS2 triad state; caption unfolds |
| V Architecture graph | 4 | enter graph | WS3 core path trace + provenance legend |
| VI Deterministic proof | 5 | "why is activation weak?" | WS3 locate→reveal; approval-gated DO package |
| VII Recombination & return | 2 | fold back to unified | reactor recombine → Stage 0 |

## JarvisDirector runtime

A single Zustand slice owns: `current` scene index, `mode` (normal/guided/auto/paused/director), `speaker`, audio element, subtitle clock, focused instrument, orb/core state, selected product, popup + video phase, and recovery. It reads the **shared 46-scene array** (identical bytes to the rehearsal deck — no drift) and emits `sceneState` to WS2/WS3.

Controls (match the deck): `←/→` prev/next · `Space` play/pause · `A` Auto · `G` Guided · `R` replay · `S` scenes · `Esc` exit. Any manual interaction during Auto → Paused + Resume/Switch/Skip/Exit.

## Cinema Director mode (the iteration tool — the whole point)

An in-app, founder-only overlay to author the movie live and export it. No recompile.

- **Timeline scrubber** across all 46 scenes; click any beat to jump; see act rail + current clip waveform.
- **Per-scene editors**: on-screen `idea` headline + caption; subtitle text (karaoke re-chunks automatically); `guidedBehavior` (`hold`/`product-tour`/`vault-tour`/`auto`); `focus` target (which instrument / product / node); reactor state override; camera/orb note; entry/exit lead-in offset (visual only — audio stays master clock).
- **Live preview**: applies edits to the real cockpit instantly in a sandboxed Director session; Normal mode untouched.
- **Voice reassignment**: swap JM/KF per scene (and stub AB/LG for future re-records — only `voice`/`file` change).
- **Export**: writes an updated `scenario.json` (+ audio/video/subtitle/presenter manifests). This file is the single source WS1/WS2/WS3 all consume — editing here re-drives everything.
- **Provenance guard**: Director can never turn an illustrative value into a "live" claim; badges are read-only.

## Scene schema (authored/exported)

```ts
type Scene = {
  id: string; act: 1|2|3|4|5|6|7; file: string; voice: 'JM'|'KF';
  product?: string; title: string; idea: string; caption?: string;
  subtitle?: string;                     // karaoke source; falls back to idea
  guided: 'hold'|'product-tour'|'vault-tour'|'auto';
  focus?: string;                        // instrument | product | node id
  coreState?: string;                    // WS2 override
  autoMedia?: string[];                  // silent desktop/mobile recordings
  leadInMs?: number; notes?: string;     // Director authoring only
};
```

## Battle-test / risks

> [!warning]
> - **Autoplay policy.** Browsers block audio without a user gesture. Keep the Stage-1 "Begin" gate; handle `NotAllowedError` with a "press play once" toast (deck-proven).
> - **Drift.** If the scene array forks between deck, Director, WS2 and WS3, the movie desyncs. Enforce one `scenario.json` as the only source; CI check that ids/order match the manifest.
> - **Normal must survive.** Every stage is additive and reversible; a crash in Guided/Auto must fall back to Stage 0 with the live cockpit intact.
> - **Only two voices exist.** Any UI implying AB/LG must be clearly "planned," never played.
> - **Perf.** Do not leave narration/subtitle rAF loops running at 60fps when idle (the deck idled at ~140fps). Gate on `playing && !document.hidden`.
> - **Provenance law.** Instruments currently show `—` placeholders; Director must not let cinema dress them up as measured.
> - **Mobile.** `getDisplayMedia` video export is desktop-only; Director export UI hides it on mobile.

## Acceptance

Story is editable without production code; Normal stays intact and always recoverable; Guided holds at every handoff; Auto runs Act I→VII on the audio clock; Director edits export a valid `scenario.json` that re-drives WS2/WS3; JM/KF route as recorded; provenance never upgraded.

## Effort & delegation

~10–18 focused days. Narrative + Director UX lead: Opus-class. Runtime/state implementation: Sonnet/Codex-class. Reviewer: reasoning model on the semantic-contract boundary.
