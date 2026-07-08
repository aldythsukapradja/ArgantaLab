---
title: "SKILL: instrumentation-wiring"
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
tags: [skill, reference, technology]
related:
  - "[[sensor-plan]]"
  - "[[skills-index]]"
---

# SKILL: instrumentation-wiring
Knowledge graph link: ladders_to `ns.w2f` via `lever.efficiency` (and each wired node's own lever)
Office: Technology (CTO)

## When to use
Any node in Circle HQ shows provenance `placeholder`/`blind`, or an INSTRUMENT verdict is open.

## Procedure
1. **Convention first.** Never invent a write path. Find the nearest LIVE signal in the codebase and copy its exact Supabase table, schema, and client helper. If two conventions exist, flag — don't pick silently.
2. **Classify the node.** App event (UI fires it) / derived signal (computed from other events, prefer server-side) / register (table to populate with real content) / container (rolls up children — wire children instead).
3. **Spec before code.** One line each: fire condition, double-fire guard, silent-failure mode, payload, ladders_to.
4. **Wire, then prove.** Fire the event in dev; the only accepted proof is the node's provenance moving in a fresh `office_report` pull. "Code merged" is not done.
5. **Adversarial pass** (separate context if possible): remount/refresh/two-tab double-fire, offline/unload loss, error-path coverage, convention match, no Tier-3 live-signal regression.
6. **Ladder it.** Update knowledge-graph-map row; note the verdict this closes.

## Hard rules
- Reversible code: proceed without asking. Migrations/deletions/anything irreversible: stop and flag.
- Never mark a signal live because the code exists — provenance badge is the source of truth.
- A sensor with no consumer is a log file: name which report/verdict reads it, or question wiring it at all.
