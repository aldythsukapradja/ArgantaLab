---
title: Roadmap Tracker
product: HQ
type: plan
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-07
owner: aldyth
confidence: high
domain: [arganta, decisions]
tags: [roadmap, meta-work, tracker]
related:
  - "[[fable-initiatives]]"
  - "[[model-ladder]]"
  - "[[persona-core]]"
---

# Roadmap Tracker

> [!success] 🟢 CANONICAL v1 · updated 2026-07-07 — live vs my check-ins, not real-time telemetry.

> Live status of the Fable-class initiatives. This is META-WORK state — kept separate from graph
> nodes (initiatives aren't product ontology). Cross-linked to nodes, not living inside them.

## Legend
- Status: `not-started` / `fable-in-progress` / `done-scoped` / `verified` / `handed-to-sonnet`
- Owner: which model does the work ([[model-ladder]] discipline)
- Verify: ⬜ claimed-done · ◐ self-adversarial pass only · ✅ human-reviewed

| Initiative | Status | Owner | ladders_to | Before → After | Verify |
|---|---|---|---|---|---|
| Recon (Phase 0) | **done-scoped** 7/7 — graph full, repo NOT scanned | Fable → Sonnet finishes | coverage.pct | "11 blind" guess → 15 confirmed (RECON.md) | ◐ |
| Part A++ (wire blind signals) | **blocked → planned** — repo unmounted; PLAN-instrumentation-wiring.md ready | Sonnet | lever.efficiency, coverage.pct | 15 blind → 0; 78% → 90%+ | ⬜ |
| Persona Core | **done-scoped** 7/7 — from docs+graph+session, NOT raw history | Fable → re-mine later | (cross-cutting) | skeleton → [[persona-core]] w/ 5 open questions | ◐ |
| Orchestration Spec (Layer 3) | **done** 7/7 — ORCHESTRATION-SPEC.html + hq-router P0 protocol | Fable | hq.agents, hq.* routing | dashboard → router protocol | ◐ |
| Media Pipeline | not-started | Sonnet (plan exists in [[mcp-connectors]]) | hq.builders, lever.breadth | concept → runnable chain | ⬜ |
| Vector DB / agent layer | not-started | Sonnet/Opus | (agent layer) | none → semantic recall | ⬜ |
| persona-core-integration skill | not-started | Sonnet | ns.w2f | persona unused → wired into Bridge agent | ⬜ |

## The honesty tension
"Live tracking" here = live relative to my check-ins, NOT real-time telemetry. Nothing above
is ✅ until Aldyth reviews it. ◐ items had an adversarial pass by the producing model only.

## Router run-log (hq-router step 9 — append here until Supabase home exists)
| run_id | date | request | node | goal_office | exec_path | score | model | outcome | verify | graph_moved? | cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 001 | 2026-07-07 | Recon+plans+spec+vault (this session) | ns.w2f | bridge | technology | A2_H2_S1_C2_V1=8 | Fable | shipped | pass (self) | no (read-only) | high |

## Links
- Initiatives detail: [[fable-initiatives]]
- Owner logic: [[model-ladder]] · Serves: [[persona-core]]
