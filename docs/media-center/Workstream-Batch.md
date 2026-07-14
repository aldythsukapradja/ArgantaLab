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

## Sonnet batch — IN PROGRESS

| WS | Wave | Delivers | Status |
|----|:----:|----------|--------|
| **1** | 1 | Sovereign Rack: real `@mlc-ai/web-llm` dep, curated Qwen3.5/Hermes manifest matching the source doc exactly (verified against MLC's real prebuilt catalog), WebGPU device profiling | ✅ done — `ai/rack.js`, 7/7 tests |
| **2** | 2 | `MODEL_REGISTRY` builder + `selectModel`-driven `intelligence.ask()` facade, truthful per-call model override in `adapter.js` | ✅ done — `ai/registry.js`, `ai/intelligence.js`, 10/10 tests |
| **3** | 2 | Truthful provider gateway (`llm-proxy` rewrite, real upstream adapters) | not started |
| **4** | 3 | Validation + escalation runner | not started |
| **5** | 3 | Metering impl: `agent_runs` Supabase migration + writes | not started (ledger is in-memory only so far) |
| **6** | 4 | Media Center intelligence — Analytics "Ask AI" insight (opt-in, sovereign-only) | ✅ slice done — `analytics-intelligence.ts`; copy/storyboard for other tabs not started |
| **7** | 4 | [[Model-Rack]] surface + tier UI → Fable review | not started |
| **8** | 5 | Benchmarks + CAPO economics | not started |
| **9** | 5 | Agent model policies ([[agent-os-v2]]) | not started |
| **T** | 5–6 | Per-tab engines ([[Tab-Brand]]→[[Tab-Analytics]]→…) | not started |

## Gates
Contract Freeze after **A** (done) · Persistence Freeze after **D+5** (D done, 5 not started — ledger is in-memory, no Supabase writes yet).

## First shippable slice — BUILT, verified honest
**A ✅ → 1 ✅ → 2 ✅ → 6-slice ✅.** Real pipeline wired end-to-end: type a
question in Analytics → click "🧠 Ask AI for an insight" → confidential
financial data is forced to the sovereign tier by governance → the real
`@mlc-ai/web-llm` + Qwen3.5-0.8B path is attempted.

Verified live in-browser: the sandboxed preview's headless WebGPU can't
complete the real ~1.6GB model load, and — critically — the pipeline reports
this **honestly** (a retry prompt) instead of fabricating an answer. This
caught and fixed a real bug: the adapter's mock-degrade fallback was initially
being displayed as if it were a genuine local-model reply; `intelligence.js`
now explicitly rejects that case (see commit `90459e7b`). Real end-to-end model
inference needs verification on a real desktop GPU outside this sandbox.
