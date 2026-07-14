---
title: "ADR 0001 — Adopt the Four-Tier LLM Router"
date: 2026-07-14
status: accepted
owner: Opus
tags: [adr, ai, llm, routing, cost]
---

# ADR 0001 — Adopt the Four-Tier LLM Router

## Status
Accepted (Opus contract batch WS-A..D).

## Context
Arganta needs one provider-independent AI layer that routes every task to the
lowest-cost intelligence capable of completing it reliably. See the source spec
[[20260714-Architecture-Arganta-Four-Tier-LLM-Router]] and [[Intelligence-Router]].

## Decision
Adopt a **four cost-class** model, orthogonal to **autonomy**:

| costClass | name | runs |
|---|---|---|
| 0 | Sovereign | deterministic / local (WebLLM, Ollama) — $0, private |
| 1 | Sponsored | free external API quotas |
| 2 | Economy | cheap paid production inference |
| 3 | Frontier | premium reasoning, high-impact judgment |

Tier 0 has sub-tiers **0A deterministic · 0B local-fast · 0C local-strong**.

Canonical taxonomy lives in `@arganta/ai/tiers.js`. Routing is a **pure
filter+rank** (`policy.js`): filter by lifecycle, data permission, capability,
cost band, runtime, health, quota, benchmark floor; then **cheapest capable
tier wins** (cost class is the dominant sort — the floor already removed
insufficient models). Escalation walks 0→1→2→3→human on validation failure.

## Consequences
- media-core's `maturityStage` is aliased to `costClass` (see [[ADR-0002|0002]]).
- The gateway must return the **true** provider/model — never a generic
  `edgeProxy` label (metered in `agent_runs`, [[ledger]]).
- High-risk tasks (legal/security/release review) carry a **paid floor** and
  `requireHumanOnFailure`.

## Contracts delivered (Opus)
`tiers.js` · `modelspec.js` · `policy.js` · `governance.js` · `ledger.js` +
8 passing contract tests. Sonnet builds the rack/registry/gateway against these.
