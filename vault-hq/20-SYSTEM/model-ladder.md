---
title: Model Ladder
product: HQ
type: strategy
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-07
owner: aldyth
confidence: high
domain: [ai-context, decisions]
tags: [rails, scaffolding, cost-engineering]
related:
  - "[[effort-scorer]]"
  - "[[mental-model]]"
  - "[[roadmap-tracker]]"
---

# Model Ladder

> [!success] 🟢 CANONICAL v1 · updated 2026-07-07

> How each model punches one tier up when you supply the missing scaffolding.
> The gap between tiers is mostly scaffolding (planning, verification, context) — not raw IQ.

## The cascade
- **Haiku → feels like Sonnet**: remove all ambiguity. Fully specified task, exact I/O, examples.
- **Sonnet → feels like Opus**: hand it a PLAN a smarter model wrote + an adversarial-review pass.
- **Opus → feels like Fable**: subagent orchestration + context compaction (harvest to vault).

Scaffolding for each rung is produced by the rung above. Fable writes the plans Opus executes;
Opus writes the plans Sonnet executes; Sonnet specs the tasks Haiku executes.

## The honest limit
Asymptotic, not magic. Can't get a cheaper model to match on genuinely OPEN-ENDED ambiguous
reasoning — ambiguity is the one thing you can't feed in from outside. That's why [[effort-scorer]]
exists: to know when the lift is achievable vs when to pay up.

## Applied to my system (Rails vs Reasoner)
Fable's job today = author the Rails (skills, persona core, orchestration spec). Cheaper models
ride them tomorrow and stay consistent because consistency lives in the rails. See [[mental-model]].

## Links
- Routes via: [[effort-scorer]]
- Governs: [[roadmap-tracker]] (owner-model column)
