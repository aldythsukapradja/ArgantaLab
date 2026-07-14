---
title: "ADR 0002 — media-core maturityStage ↔ costClass"
date: 2026-07-14
status: accepted
owner: Opus
tags: [adr, media-core, cost, alignment]
---

# ADR 0002 — Align media-core maturityStage with costClass

## Status
Accepted.

## Context
`@arganta/media-core` routes MEDIA generation by `maturityStage` (0..3). The
[[ADR-0001|Four-Tier Router]] routes LLM tasks by `costClass` (0..3). These are
the **same cost model** on the same scale.

## Decision
Treat `maturityStage` as `costClass`. media-core now exports `COST_CLASS`,
`COST_LABEL` (Sovereign/Sponsored/Economy/Frontier), and `toCostClass()` as an
identity alias. No behavioural change; the tier pill in Media Center may display
either friendly labels (Free/Free API/Economy/Premium) or the canonical names.

## Consequences
- One taxonomy across text (`@arganta/ai`) and media (`@arganta/media-core`).
- Both routers write the **same** `agent_runs` ledger (`domain: 'llm' | 'media'`).
- The Media Center approval gate (stage ≥ 3) == Frontier approval — already aligned.

## Open decision (for the founder)
Whether the Media Center tier pill shows **Sovereign/Sponsored/Economy/Frontier**
(canonical, matches the Model Rack) or friendly **Free/Free API/Economy/Premium**.
Default recommendation: canonical names once the [[Model-Rack]] ships.
