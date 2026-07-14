---
title: Jarvis OS Cinema Program - WS3 3D Knowledge Nodes
date: 2026-07-14
type: architecture
status: draft
project: Jarvis OS
program: Cinema Program
workstream: WS3
tags:
  - jarvis-os
  - circle-hq
  - cinema-program
  - knowledge-graph
  - vault-3d
---

# Jarvis OS Cinema Program — WS3 · 3D Knowledge Nodes

> [!summary]
> A 3D spatial digital twin of Circle HQ knowledge, architecture and agentic capability, built over the **real** Vault. It exists for narrative understanding and high-level exploration; the 2D Vault stays the operational read/edit workspace. Every grounded node resolves back to a real note or system object. Driven by semantic scene state from [[20260714-Architecture-JarvisOS-CinemaProgram-WS1-Storyline-CinemaDirector|WS1]]; a sibling of [[20260714-Architecture-JarvisOS-CinemaProgram-WS2-JarvisReactor|WS2 Reactor]].

## Where it sits

Standalone module in `apps/hq` (not a prototype), the spatial companion to the reactor. Content inherited from [[20260713-Architecture-JarvisOS-Workstream04-VaultKnowledgeGraph|Vault & 3D Knowledge Graph]]; data source is the existing Vault (`apps/hq/src/vault`, graph v3 on PixiJS + d3-force) plus `vault/kb.generated.ts` and `data/ontology.ts` — **do not re-key nodes**.

## Mission

Use 3D for architecture storytelling and exploration; keep the 2D Vault for real work. The two never fight — 3D reads, 2D edits.

## Ontology (24 types)

Founder, North Star, Strategy, Product, Surface, Document, Decision, Metric, Signal, Data Source, Database, Table, API, Repository, Architecture, Agent, Office, Skill, Tool, Workflow, Task, Artifact, Approval, Deployment.

## Canonical path

```text
Founder → Jarvis → Command → Vault → Data → Architecture → Agents → Products
```

This 8-node spine is the Act V narrative and the first vertical slice.

## Provenance encoding (must be unmistakable)

| Signal | Node | Edge |
|---|---|---|
| live | solid, luminous | — |
| partial | translucent | — |
| simulated | amber wireframe | — |
| placeholder | hollow | — |
| confirmed | — | solid |
| suggested | — | dotted |

Shared vocabulary with the reactor and instruments so the whole page tells one truth.

## Layout

Macro-position by ontology / product domain; constrained local force layout; **positions stable across sessions** (seed from node id, persist). No reshuffles between visits — the founder must build spatial memory.

## Tours (Auto, WS1-driven, audio = clock)

- **A — Company anatomy** (Act V spine).
- **B — Evidence journey** (Vault → Data → Metric → Signal).
- **C — Agentic execution** (Act VI "why is activation weak?": locate → reveal unwired exits → measure-first → DO instrumentation package, stops at approval).
- **D — Product architecture** (per product → surfaces → data → agents).

Each tour: scripted camera path, per-node narration, neighbor highlight, source-note reveal, deterministic return to the CEO Orb.

## Manual mode

Search, select, orbit, zoom, local-neighborhood expand, type + provenance filters, provenance inspector, **open real note**, return to orb. Read-only: never writes the Vault.

## Data pipeline

```text
Markdown / KB → ontology enrichment → graph transform → stable semantic positions → 3D render → real-note resolution
```

## Contract

Receives semantic props from WS1 only (scene id, focused node/path, mode); never reads audio, never drives the story, never manipulates the reactor. Enter/exit is continuous with WS2's `vault-entry` / `architecture-unfold` / `return` states so the reactor dissolves into the graph and back.

## Battle-test / risks

> [!warning]
> - **Grounding is the whole promise.** Every non-placeholder node must resolve to a real note/object, or the twin becomes theater. Build resolution + a "missing source" state first.
> - **2D Vault must stay operational** throughout — this module is additive, never a replacement.
> - **Layout stability.** Force layouts drift; freeze/seed positions and persist, or spatial memory breaks.
> - **Scale/perf.** The Vault grows; use LOD, instancing, clustering, DPR cap, lazy neighborhoods, and a WebGL fallback to the existing 2D graph. Mobile auto-framing must work.
> - **Provenance honesty.** Encoding is not decoration — a simulated node rendered as live is a truth violation.
> - **Ontology creep.** New types must extend the 24-type set deliberately, not ad hoc.

## Acceptance

Grounded nodes resolve to real sources; layout is stable across sessions; all four tours run on the audio clock with deterministic return; provenance encoding is correct on every node/edge; mobile auto-framing works; the 2D Vault remains fully operational.

## Effort & delegation

~24–40 focused days. Graph/ontology architecture: Opus-class. Three.js + graph implementation: Sonnet/Codex-class. Separate performance reviewer. First slice: render the 8-node spine, correct provenance, click-opens-real-note, Tour A end to end, deterministic return.
