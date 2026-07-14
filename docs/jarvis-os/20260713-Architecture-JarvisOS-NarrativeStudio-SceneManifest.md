---
title: Jarvis OS Narrative Studio - Scene Manifest
date: 2026-07-13
type: architecture
status: draft
project: Jarvis OS
workstream: 01
tags:
  - jarvis-os
  - circle-hq
  - narrative-studio
  - scene-manifest
---

# Jarvis OS Narrative Studio - Scene Manifest

> [!summary]
> Canonical, port-ready mapping of every recorded MP3 in this folder to a presentation scene. This is the single data source the Narrative Studio HTML consumes. Related: [[20260713-Architecture-JarvisOS-Workstream01-NarrativeStudio|Workstream 01]] and [[20260713-Architecture-JarvisOS-MasterPlan|Master Plan]].

## Source of truth

The **recorded MP3 filenames are canonical.** Where the Master Plan voice table and the recordings disagree, the recording wins. Do not rename clips to match the old spec; update the spec to match the clips.

## Reconciled voice map (as recorded)

Only two voices were actually produced:

| ID | Voice | Recorded scope | Spec said |
|---|---|---|---|
| **JM** | Adult male "Jarvis" | System, instruments, ArgantaLab, KinetikCircle, Circle HQ, THINK/KNOW/DO, architecture, agentic proof, close | System/Landing/HQ/Vault |
| **KF** | Adult female | LashiraBloom, Landing | KinetikCircle only |
| ~~AB~~ | Child male | **not produced** | ArgantaLab |
| ~~LG~~ | Child female | **not produced** | LashiraBloom |

> [!note]
> Deviations vs the Master Plan five-product table: ArgantaLab AB→JM, KinetikCircle KF→JM, LashiraBloom LG→KF, Landing JM→KF. Circle HQ (JM) is unchanged. If child voices are re-recorded later, only the `voice` and `file` fields below change; scene structure is stable.

## Filename convention

`<act>-<cue>-<voice>-<slug>.mp3` — one idea per clip, 3-10s, audio is the master clock (a scene ends when its clip fires `ended`). Videos referenced by scenes are silent.

## Acts

Seven acts, 46 clips, mirroring [[20260713-Architecture-JarvisOS-Workstream05-NarrativeProduction|Workstream 05]] starter acts.

| Act | Title | Clips |
|---|---|---:|
| I | Ignition & cockpit | 3 |
| II | Six instruments | 3 |
| III | Five products | 25 |
| IV | THINK / KNOW / DO | 4 |
| V | Architecture graph | 4 |
| VI | Deterministic agentic proof | 5 |
| VII | Recombination & return | 2 |

## Canonical scene table

`id` = source-of-truth scene key. `voice` = as recorded. `guided` = what Guided mode does at this beat (Auto plays the clip + any media and advances automatically). `focus` = the real CEO Orb element the scene should spotlight (for later Experience-Engine wiring; the standalone Studio simulates it visually).

### Act I - Ignition & cockpit

| id | file | voice | title | on-screen idea | guided |
|---|---|---|---|---|---|
| 1.1 | 01-01-JM-system-awakening.mp3 | JM | System awakening | Reactor ignites; the cockpit boots | hold |
| 1.2 | 01-02-JM-founder-recognition.mp3 | JM | Founder recognition | Jarvis greets the founder by role | hold |
| 1.3 | 01-03-JM-reactor-anatomy.mp3 | JM | Reactor anatomy | Left / Center / Right layout named | hold |

### Act II - Six instruments

| id | file | voice | title | on-screen idea | focus |
|---|---|---|---|---|---|
| 2.1 | 02-01-JM-left-instruments.mp3 | JM | Left instruments | World Reach, Weekly Engaged, Valuation Audit | left column |
| 2.2 | 02-02-JM-right-instruments.mp3 | JM | Right instruments | Five Products, Access & Attention, Visit Rhythm | right column |
| 2.3 | 02-03-JM-instrument-truth-policy.mp3 | JM | Truth policy | Cards stay honest; avoid volatile numbers | all six |

### Act III - Five products

Product pattern per Workstream 05: intro -> overview/story -> demo-cue -> summary -> strategic-close. Guided replaces demo videos with live takeover; Auto plays desktop/mobile recordings.

| id | file | voice | product | beat | guided |
|---|---|---|---|---|---|
| 3.1 | 03-01-JM-argantalab-intro.mp3 | JM | ArgantaLab | intro | hold |
| 3.2 | 03-02-JM-argantalab-overview.mp3 | JM | ArgantaLab | overview | product-tour |
| 3.3 | 03-03-JM-argantalab-demo-cue.mp3 | JM | ArgantaLab | demo cue | product-tour |
| 3.4 | 03-04-JM-argantalab-summary.mp3 | JM | ArgantaLab | summary | hold |
| 3.5 | 03-05-JM-argantalab-strategic-close.mp3 | JM | ArgantaLab | strategic close | auto |
| 3.6 | 03-06-JM-kinetikcircle-intro.mp3 | JM | KinetikCircle | intro | hold |
| 3.7 | 03-07-JM-kinetikcircle-overview.mp3 | JM | KinetikCircle | overview | product-tour |
| 3.8 | 03-08-JM-kinetikcircle-demo-cue.mp3 | JM | KinetikCircle | demo cue | product-tour |
| 3.9 | 03-09-JM-kinetikcircle-summary.mp3 | JM | KinetikCircle | summary | hold |
| 3.10 | 03-10-JM-kinetikcircle-strategic-close.mp3 | JM | KinetikCircle | strategic close | auto |
| 3.11 | 03-11-KF-lashirabloom-intro.mp3 | KF | LashiraBloom | intro | hold |
| 3.12 | 03-12-KF-lashirabloom-overview.mp3 | KF | LashiraBloom | overview | product-tour |
| 3.13 | 03-13-KF-lashirabloom-demo-cue.mp3 | KF | LashiraBloom | demo cue | product-tour |
| 3.14 | 03-14-KF-lashirabloom-summary.mp3 | KF | LashiraBloom | summary | hold |
| 3.15 | 03-15-KF-lashirabloom-strategic-close.mp3 | KF | LashiraBloom | strategic close | auto |
| 3.16 | 03-16-KF-landing-intro.mp3 | KF | Landing | intro | hold |
| 3.17 | 03-17-KF-landing-public-story.mp3 | KF | Landing | public story | product-tour |
| 3.18 | 03-18-KF-landing-demo-cue.mp3 | KF | Landing | demo cue | product-tour |
| 3.19 | 03-19-KF-landing-partnership-pathway.mp3 | KF | Landing | partnership pathway | hold |
| 3.20 | 03-20-KF-landing-strategic-close.mp3 | KF | Landing | strategic close | auto |
| 3.21 | 03-21-JM-arganta-head-quarters-intro.mp3 | JM | Circle HQ | intro | hold |
| 3.22 | 03-22-JM-arganta-head-quarters-anatomy.mp3 | JM | Circle HQ | anatomy | product-tour |
| 3.23 | 03-23-JM-arganta-head-quarters-demo-cue.mp3 | JM | Circle HQ | demo cue | product-tour |
| 3.24 | 03-24-JM-arganta-head-quarters-governance.mp3 | JM | Circle HQ | governance | hold |
| 3.25 | 03-25-JM-arganta-head-quarters-strategic-close.mp3 | JM | Circle HQ | strategic close | auto |

### Act IV - THINK / KNOW / DO

| id | file | voice | title | on-screen idea |
|---|---|---|---|---|
| 4.1 | 04-01-JM-think-know-do-unfold.mp3 | JM | The unfold | Orb splits into THINK / KNOW / DO |
| 4.2 | 04-02-JM-think-explanation.mp3 | JM | THINK | Founder intent, command, reasoning, routing |
| 4.3 | 04-03-JM-know-explanation.mp3 | JM | KNOW | Vault, evidence, telemetry, provenance |
| 4.4 | 04-04-JM-do-explanation.mp3 | JM | DO | Architecture, agents, tools, controlled execution |

### Act V - Architecture graph

Core path: Founder -> Jarvis -> Command -> Vault -> Data -> Architecture -> Agents -> Products.

| id | file | voice | title | on-screen idea |
|---|---|---|---|---|
| 5.1 | 05-01-JM-founder-command-path.mp3 | JM | Founder -> Command | Intent enters the system |
| 5.2 | 05-02-JM-vault-data-path.mp3 | JM | Vault -> Data | Evidence and telemetry resolve |
| 5.3 | 05-03-JM-architecture-agents-products.mp3 | JM | Architecture -> Agents -> Products | Execution reaches the products |
| 5.4 | 05-04-JM-graph-provenance.mp3 | JM | Provenance | Live / partial / simulated / placeholder legend |

### Act VI - Deterministic agentic proof

Scenario: "Why is activation weak?" THINK locates -> KNOW reveals -> THINK selects measure-first -> DO builds instrumentation -> stops at founder approval.

| id | file | voice | title | on-screen idea |
|---|---|---|---|---|
| 6.1 | 06-01-JM-activation-question.mp3 | JM | The question | "Why is activation weak?" |
| 6.2 | 06-02-JM-activation-think.mp3 | JM | THINK locates | Activation isolated in the graph |
| 6.3 | 06-03-JM-activation-know.mp3 | JM | KNOW reveals | Unwired exits surfaced from evidence |
| 6.4 | 06-04-JM-measure-before-redesign.mp3 | JM | Measure first | Choose instrumentation over guesswork |
| 6.5 | 06-05-JM-instrumentation-package.mp3 | JM | DO builds | Package drafted; stops at approval gate |

### Act VII - Recombination & return

| id | file | voice | title | on-screen idea |
|---|---|---|---|---|
| 7.1 | 07-01-JM-architecture-recombination.mp3 | JM | Recombination | THINK / KNOW / DO fold back into one orb |
| 7.2 | 07-02-JM-closing.mp3 | JM | Closing | Return to the live cockpit |

## Data shape the HTML consumes

Port the table above into one array (embedded in the HTML, no build step). Minimum fields:

```ts
type Scene = {
  id: string;          // "3.11"
  act: 1|2|3|4|5|6|7;
  file: string;        // relative to this folder, e.g. "03-11-KF-lashirabloom-intro.mp3"
  voice: 'JM'|'KF';    // as recorded
  product?: string;    // Act III only
  title: string;
  idea: string;        // one-line on-screen headline (Apple style: one idea per slide)
  guided: 'hold'|'product-tour'|'auto';
  autoMedia?: string[];// optional silent video paths for Auto mode
};
```

## Invariants

- 46 scenes, seven acts, order fixed by `id`.
- Audio is the master clock: a scene's duration = its clip length; never hard-code seconds.
- Numbers stay out of narration; on-screen headlines paraphrase, never quote volatile metrics.
- If a clip is missing at runtime, skip forward and log; never block the deck.
