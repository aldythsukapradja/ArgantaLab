---
title: "SKILL: effort-scorer"
product: HQ
type: spec
class: reference
status: draft
canonical: false
version: v1
updated: 2026-07-07
owner: aldyth
confidence: medium
domain: [ai-context]
tags: [skill, reference, guild, draft-thresholds]
related:
  - "[[effort-scorer]]"
  - "[[skills-index]]"
---

# SKILL: effort-scorer
Knowledge graph link: ladders_to `hq.agents` (Guild/CAPO — agent ROI) and `ns.w2f`
Status: DRAFT — threshold values are placeholders pending Aldyth's calibration. Do not present scores as calibrated.

## When to use
Before any non-trivial task: pick the model tier AND the scaffolding that makes it perform one tier up.

## Score five axes (0–2 each)
- **Ambiguity** — 0: fully specified · 1: shape known, details open · 2: must invent the frame
- **Horizon** — 0: one turn · 1: multi-step, one session · 2: hours/many tool calls
- **Stakes/reversibility** — 0: freely undoable · 1: annoying to undo · 2: prod/money/irreversible
- **Context volume** — 0: fits easily · 1: needs curation · 2: needs big window + compaction
- **Verification cost** — 0: cheap to check · 1: needs review · 2: wrong is expensive to catch

## Route (draft thresholds — calibrate against real usage)
- Ambiguity 2 → highest tier available; scaffolding can't buy this axis. Everything below assumes ambiguity ≤1.
- Total ≤3 → Haiku, with fully specified spec + examples (removes the deciding).
- Total 4–6 → Sonnet, with a PLAN-<slug>.md from a higher tier + adversarial-review pass.
- Total 7–8 → Opus, with subagent-orchestrator + context-compaction.
- Total 9–10, or stakes 2 + verification 2 → top tier (metered if needed) — this is the "pay up" case.

## Output format
`score: A_ H_ S_ C_ V_ = total | model: X | scaffolding: <what makes X behave like X+1> | escalate-if: <observable trigger>`

## Log the verdict
Append each scoring to the vault (30-DATA/coverage-tracker or a scorer log) so over-/under-provisioning patterns become visible — same discipline as Treasury cost flags.

## Honest limit
This is asymptotic, not magic: a fed-in plan can't buy open-ended judgment. If the executing model is guessing at the frame rather than filling one, stop and escalate — that's the signal, not a score.
