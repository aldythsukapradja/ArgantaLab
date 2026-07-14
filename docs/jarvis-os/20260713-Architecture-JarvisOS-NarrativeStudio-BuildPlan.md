---
title: Jarvis OS Narrative Studio - Build Plan (MP3 Port)
date: 2026-07-13
type: architecture
status: draft
project: Jarvis OS
workstream: 01
tags:
  - jarvis-os
  - circle-hq
  - narrative-studio
  - build-plan
---

# Jarvis OS Narrative Studio - Build Plan (MP3 Port)

> [!summary]
> Buildable plan for a single, self-contained, Apple-keynote-style HTML that plays the 46 recorded MP3s in this folder as a Left / Right / Auto narrative. This ports the audio **directly** — no re-recording, no build step, no external assets. Reads its data from [[20260713-Architecture-JarvisOS-NarrativeStudio-SceneManifest|the Scene Manifest]]; obeys [[20260713-Architecture-JarvisOS-Workstream01-NarrativeStudio|Workstream 01]] and [[20260713-Architecture-JarvisOS-MasterPlan|Master Plan]].

## Goal

A rehearsal deck that **simulates the actual narrative** so the story can be judged before any Three.js / Experience-Engine work. It is the "story is locked" gate from Workstream 01, made real with the audio that already exists.

## Non-goals

- Not the live CEO Orb (that is Workstream 02). This deck **simulates** the orb visually.
- No re-recording. No child voices (AB/LG) — see the manifest's reconciled voice map.
- No framework, no bundler, no network calls. One HTML file that opens from disk or is served statically.

## Scope of this build

One file, to be created later (NOT in this doc set): `narrative-studio.html`, dropped in this same `apps/hq/public/audio/` folder so every `src` is a plain sibling filename (`03-11-KF-lashirabloom-intro.mp3`). Served at `/audio/narrative-studio.html` by the HQ app; also works via `file://`.

## Three modes (the core requirement)

| Mode | Trigger | Behavior |
|---|---|---|
| **Manual (Left/Right)** | `←` / `→`, on-screen arrows, click rails | Jump to any scene. The scene's clip plays once on entry; user drives pace. This is "Guided rehearsal". |
| **Auto** | `A` or Play | Plays every clip in `id` order; advances on the audio `ended` event; runs Act I -> VII unattended. This is the full simulated narrative. |
| **Paused** | `Space` | Freezes audio + progress; any manual nav during Auto drops to Paused and offers Resume. |

Audio is the master clock in every mode: scene length = clip length. Never use timers to advance.

## Apple-keynote visual language

Design target = a Jarvis/Arganta take on an Apple keynote build slide.

- **One idea per slide.** Each scene shows a single large headline (`idea` from the manifest) + a small act/speaker chip. No paragraphs.
- **Deep cinematic canvas.** Near-black background, one restrained accent per act, generous negative space, content vertically centered.
- **Big type, tight hierarchy.** Oversized display headline; small uppercase kicker (act name); subtle caption line if needed.
- **Calm motion.** Cross-dissolve + slight rise on scene change (200-360ms), respects `prefers-reduced-motion` (fallback = instant cut). No spinning, no bounce.
- **The orb as hero.** A CSS/canvas reactor stand-in that changes state per act: idle glow (I-II), product-tinted (III), splits into THINK/KNOW/DO (IV), path-trace (V), question->build (VI), recombine (VII). Purely presentational — it must never imply live intelligence.
- **Speaker identity.** JM = cool Jarvis accent; KF = warm accent. Chip shows voice + product so the LashiraBloom/Landing KF hand-off reads intentionally.
- **Progress rail.** Seven act segments; current scene marked; click-to-seek. Keyboard hint line, dismissible.

## Screen layout

```text
+--------------------------------------------------------------+
|  ACT III · PRODUCTS            [voice: KF · LashiraBloom]     |  <- kicker + speaker chip
|                                                              |
|                    (reactor orb, act-state)                  |
|                                                              |
|            One-idea headline for this scene                  |  <- manifest.idea
|            optional single caption line                      |
|                                                              |
|  [subtitle track: current clip text, fallback]               |
+--------------------------------------------------------------+
|  ◀   ⏯   ▶     ● ● ● ● ● ● ●  (act rail)     MODE ▾   ⤢     |  <- transport
+--------------------------------------------------------------+
```

## Controls (align with Workstream 01)

`←`/`→` prev/next · `Space` play/pause · `A` Auto · `G` Guided(manual) · `R` replay current clip · `S` scene selector · `F` fullscreen · `Esc` exit selector/fullscreen. All also reachable by pointer for demo use.

## Data flow

1. Embed the manifest's 46-row scene array inline (from [[20260713-Architecture-JarvisOS-NarrativeStudio-SceneManifest|Scene Manifest]] -> "Data shape the HTML consumes"). Single source; no fetch.
2. One reusable `<audio>` element; on scene entry set `src = scene.file`, `play()`.
3. `ended` -> in Auto, advance to next `id`; in Manual, hold on the last frame.
4. Missing/failed clip -> skip forward, toast a small warning, keep the deck alive (manifest invariant).
5. Subtitles: optional `subtitles/<file>.vtt` if present later; absent now, so the subtitle line can mirror `scene.title` as a graceful fallback.

## State machine

```text
BOOT -> READY
READY --(A)--> AUTO_PLAYING
READY --(→/←/S)--> MANUAL
AUTO_PLAYING --(Space/manual nav)--> PAUSED
PAUSED --(Space/Resume)--> AUTO_PLAYING
AUTO_PLAYING --(clip ended & last scene)--> END -> READY
any --(Esc)--> READY
```

Single `current` index into the ordered scene array is the whole app state; mode is a small enum; everything else derives from `scenes[current]`.

## Build phases

1. **Skeleton + data.** Inline scene array, single audio element, index state, `←`/`→` swaps clip and headline. Prove all 46 clips play in order by filename.
2. **Auto.** `ended` chaining, Play/Pause, pause-on-manual-interaction with Resume. Full unattended Act I->VII run.
3. **Apple skin.** Typography, act accents, dissolve transitions, speaker chip, progress rail, reduced-motion path.
4. **Reactor stand-in.** Per-act orb states incl. THINK/KNOW/DO split (Act IV) and recombine (Act VII).
5. **Polish.** Scene selector (`S`), fullscreen, keyboard hints, missing-clip resilience, mobile width check.

## Acceptance

- All 46 clips play, in manifest order, by exact filename, from this folder.
- Manual: any scene reachable; entering a scene (re)plays its clip once.
- Auto: unattended Act I -> VII; advances only on real `ended`; manual touch -> Paused + Resume.
- Voices render as recorded: JM throughout, KF for LashiraBloom + Landing; no AB/LG.
- Apple feel: one idea per slide, calm dissolves, reduced-motion honored, no false "live AI" implication.
- Self-contained: opens via `file://` and at `/audio/narrative-studio.html`; zero network dependency.

## Handoff notes

- This deck is the **story-lock artifact**. Once approved it feeds Workstream 02 (Experience Engine): the same scene array + `guided`/`focus` fields become the `JarvisDirector` scene list against the real orb.
- Keep the scene array identical between this deck and the eventual Director to avoid drift.
- If child voices are produced later, only manifest `file`/`voice` change; this plan is unaffected.
