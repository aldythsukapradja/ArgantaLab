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
| **3** | 2 | Truthful provider gateway (`llm-proxy` rewrite, real upstream adapters) | ✅ done — DeepSeek + Anthropic Haiku/Sonnet/Opus added beyond Gemini/Groq, `router.js` pure + 14 tests |
| **4** | 3 | Validation + escalation runner | ✅ done — `ai/validators.js` (schema/grounding/policy/cost/quality) + escalation loop in `intelligence.js`, every attempt metered |
| **5** | 3 | Metering impl: `agent_runs` Supabase migration + writes | ✅ done — migration **applied to the live project** (founder ran it); both LLM + media domains write |
| **6** | 4 | Media Center intelligence — "Ask AI" opt-in content assist | ✅ done — Analytics insight (confidential/sovereign-only) + **S1** Website copy, **S2** Deck outline, **S3** Video script (all `public` dataClass, free to route Sponsored/Economy too) |
| **7** | 4 | [[Model-Rack]] surface + tier UI → Fable review | ✅ done — `surfaces/rack/ModelRack.tsx`, verified live (real run appears in feed with truthful provenance) |
| **8** | 5 | Benchmarks + CAPO economics | ✅ done (v1, simplest-start) — `ai/benchmarks.js` rolls up real BenchmarkResults from validated `agent_runs`, no curated eval set; visible as a score badge in [[Model-Rack]] |
| **9** | 5 | Agent model policies ([[agent-os-v2]]) | **blocked** — depends on the AgentSpec registry, which per [[agent-os-v2]] is "grand design... NOT built" |
| **T** | 5–6 | Per-tab engines ([[Tab-Brand]]→[[Tab-Analytics]]→…) | not started — long-tail backlog, not a single atomic workstream |

## Gates
Contract Freeze after **A** ✅ · Persistence Freeze after **D+5** ✅ — both done,
`agent_runs` is live in the Supabase project.

**WS-8 resolution (2026-07-14):** founder called it — simplest way to start,
scale later. Bootstrap `BenchmarkResult`s from real validated `agent_runs`
instead of a curated eval harness (that's the "scale" half, deferred: static
test sets, human grading, model-as-judge, `benchmarks.__floor` gating). Below
`minSamples` a model has no entry and the cold-start default applies — scaling
up needs no manual flip, it just accrues.

**WS-9 remains blocked, not decision-gated** — the `AgentSpec` registry it
depends on doesn't exist yet ([[agent-os-v2]] is a design doc, not a build).
Building that registry is its own initiative, out of scope for the
intelligence router. Founder call (2026-07-14): defer to later, not this pass.

## Session goal reached (2026-07-14): generate image, video, music, website

All five requested media types are tangible **today**, each on two layers:

| Kind | Deterministic (instant, $0, always works) | AI-assisted (opt-in, "Ask AI") |
|---|---|---|
| Image | real PNG (`media-core`) | — (premium MCP path exists, gated, unverified — see S4/S5 below) |
| Video | canvas + real webm/mp4 export | **S3** — 4-line on-screen script |
| Music/sound | real synthesized playback (`@arganta/audio`) | — |
| Website | self-contained landing-page HTML | **S1** — real headline + features |
| Deck | self-contained cinematic slides | **S2** — real per-scene outline |

**Remaining, not done this session (explicitly deferred by the founder):**
- **S4/S5** — a real premium media gateway (mirrors `llm-proxy`'s truthful-gateway
  pattern for Higgsfield/ElevenLabs) so premium Image/Video/Audio generation
  actually calls out instead of returning a gated descriptor. Needs real
  provider API keys the founder would set via `supabase secrets set`.
- **WS-9** — agent model policies, blocked on the unbuilt AgentSpec registry.
- **WS-T** — deepening individual tabs further (Complexity-Model.md backlog).

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
