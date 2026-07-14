---
title: "ADR 0003 — Data Classification Governance"
date: 2026-07-14
status: accepted
owner: Opus
tags: [adr, security, privacy, governance, data-class]
---

# ADR 0003 — Data Classification Governance

## Status
Accepted (non-negotiable guardrail).

## Context
Sensitive Arganta data (financial models, investor materials, child-sensitive
data, API keys) must never be sent to external LLM providers.

## Decision
Every routed task carries a `dataClass` ∈ `public | internal | confidential |
restricted`. `@arganta/ai/governance.js` enforces the allowed tiers:

| dataClass | allowed routes |
|---|---|
| public | Tier 0–3 |
| internal | Tier 0, approved Tier 2/3 (Tier 1 needs provider-policy approval) |
| confidential | Tier 0 only, unless explicitly enterprise-paid-approved |
| **restricted** | **deterministic / local only — never external-api** |

`isRouteAllowed(model, dataClass)` is the gate; `mustStayLocal('restricted')` is
true. Enforced *before* the cost/quality rank, so cheap external models can never
win a sensitive route.

## Consequences
- Media Center **Analytics on real revenue/financials = confidential** → local
  (Tier 0) model only. This is the headline privacy property.
- CFO / GC / financial-review flows default to local retrieval + human review.
- The gateway ([[ADR-0001]]) must refuse restricted payloads server-side too
  (defence in depth), not just in the browser router.
