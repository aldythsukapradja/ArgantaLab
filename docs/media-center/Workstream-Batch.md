---
title: Workstream Batch — Opus / Sonnet split
date: 2026-07-14
category: Build
tags: [media-center, workstream, opus, sonnet, program]
---

# Workstream Batch

End-to-end split for the [[Intelligence-Router]] + [[Spine|foundation]] +
[[Media-Center-Build-Plan|Media Center]] tabs. **Opus** owns
architecture/contracts/governance; **Sonnet** owns TS/React/Supabase/adapters/
tests; **Fable** reviews only after a working creative milestone. One workstream
= one branch, one worktree, one handoff.

## Opus batch — DONE ✅ (contract freeze)

| WS | Delivers | Artifacts |
|----|----------|-----------|
| **A** | Tier & Task ontology + ModelSpec/TaskPolicy contracts; media-core costClass alias | `ai/tiers.js`, `ai/modelspec.js`, `media-core` alias |
| **B** | Routing & escalation policy (selectModel, ladder) | `ai/policy.js` |
| **C** | Data-class & cost governance (restricted→local, budgets, approval) | `ai/governance.js`, [[../adr/0003-data-classification-governance|ADR-0003]] |
| **D** | Metering & provenance ledger (agent_runs, CAPO, Sovereign Rate) | `ai/ledger.js` |
| **E** | HQ integration + Model Rack spec | [[Model-Rack]] |

8/8 contract tests pass. ADRs [[../adr/0001-four-tier-llm-router|0001–0003]].

## Sonnet batch — NEXT

| WS | Wave | Delivers | Branch |
|----|:----:|----------|--------|
| **1** | 1 | Sovereign Rack: WebLLM/WebGPU worker, Qwen loaders, device profiling | `feat/ai-sovereign-rack` |
| **2** | 2 | `MODEL_REGISTRY` + `selectModel` wired (kills `edgeProxy`) | `feat/ai-registry-router` |
| **3** | 2 | Truthful provider gateway (`llm-proxy` rewrite, real adapters) | `feat/ai-provider-gateway` |
| **4** | 3 | Validation + escalation runner | `feat/ai-validation` |
| **5** | 3 | Metering impl: `agent_runs` migration + writes | `feat/ai-metering-impl` |
| **6** | 4 | Media Center intelligence (Analytics NL, copy, storyboard) | `feat/mc-intelligence` |
| **7** | 4 | [[Model-Rack]] surface + tier UI → Fable review | `feat/hq-model-rack` |
| **8** | 5 | Benchmarks + CAPO economics | `feat/ai-benchmarks` |
| **9** | 5 | Agent model policies ([[agent-os-v2]]) | `feat/agent-model-policies` |
| **T** | 5–6 | Per-tab engines ([[Tab-Brand]]→[[Tab-Analytics]]→…) | `feat/mc-tab-engines` |

## Gates
Contract Freeze after **A** (done) · Persistence Freeze after **D+5**.

## First shippable slice
**A ✅ → 1-min (one Qwen) → 2-min (registry) → 6-slice (Analytics NL)** →
local model picks a chart on real data, $0, offline.
