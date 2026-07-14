---
title: Intelligence Router (Four-Tier LLM)
date: 2026-07-14
category: Architecture
tags: [media-center, ai, llm, routing, intelligence]
---

# Intelligence Router

The **brain** under [[Media-Center-Build-Plan|Media Center]] and the wider Agent
OS. Routes every task to the **lowest-cost intelligence capable of it reliably**.
Source spec: [[20260714-Architecture-Arganta-Four-Tier-LLM-Router]].

## Four cost tiers (= media-core costClass, [[Spine]])

| costClass | tier | runs | Media Center pill |
|---|---|---|---|
| 0 | **Sovereign** | deterministic / local WebLLM — $0, private | Free · local |
| 1 | **Sponsored** | free external API quotas (Gemini/Groq/Cerebras) | Free API |
| 2 | **Economy** | cheap paid (DeepSeek/Mistral/Haiku) | Economy |
| 3 | **Frontier** | premium reasoning (Claude/OpenAI/Gemini Pro) | Premium |

Tier 0 sub-tiers: **0A deterministic · 0B local-fast (Qwen 0.8/2B) · 0C
local-strong (Qwen 4/9B, Hermes 8B)**.

## Principles (enforced in code)

> Deterministic first · Local before external · Free before paid · Economy
> before Frontier · Sensitive data stays local · High-risk has quality floors ·
> Every run shows the true provider · Every result validated · Every paid call
> metered · The model proposes, the deterministic runner executes.

## Contracts shipped — Opus batch (WS-A..D) ✅

Package `@arganta/ai`, all pure + tested (8/8):

- **`tiers.js`** — costClass · autonomyLevel · taskClass · dataClass ontology
- **`modelspec.js`** — `ModelSpec` registry contract + cost estimation
- **`policy.js`** — `TASK_POLICIES`, `selectModel()` (filter+rank, **cheapest
  capable wins**), escalation ladder
- **`governance.js`** — data-class guardrails ([[../adr/0003-data-classification-governance|ADR-0003]]), `MissionBudget`, approval policy
- **`ledger.js`** — `agent_runs` record, Sovereign Completion Rate, CAPO economics

ADRs: [[../adr/0001-four-tier-llm-router|0001]] · [[../adr/0002-media-core-costclass-alignment|0002]] · [[../adr/0003-data-classification-governance|0003]].

## What Sonnet builds next

See [[Workstream-Batch]] — WS-1 Sovereign Rack, WS-2 Registry/Router impl, WS-3
Truthful Gateway, WS-4 Validation, WS-5 Metering, WS-6 Media Center wiring,
WS-7 [[Model-Rack]] UI.

## First proof
[[Tab-Analytics]] NL→spec on a **local Qwen**, grounded on real data, $0, offline.
