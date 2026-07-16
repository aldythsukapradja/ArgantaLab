---
title: Agents and Offices
updated: 2026-07-16
type: reference
tags: [arganta-core, agents, delegation]
---

# Agents and Offices

Core can delegate a question to one of six **C-Level offices** via the `consult_office` tool (see [[Capabilities]]). An office is a *lens*; underneath sits a 27-agent roster mapped to those offices. A delegation is a single **grounded** answer, not a runaway chain of sub-agents.

## The six offices

| Office | Chief | Grounded in live data? |
|---|---|---|
| `bridge` | CEO | Strategic persona (no live pipeline in v1) |
| `operations` | COO | ✅ real Sense→Compute→Match over live Supabase |
| `technology` | CTO | Persona |
| `treasury` | CFO | ✅ real economy/growth numbers |
| `legal` | GC | Persona |
| `roster` | — | Answers from static org metadata (27 agents) |

## Grounded vs persona — and why it matters

- **Grounded** offices (`operations`, `treasury`) read your **real** numbers, compute deterministic signals, and only then ask a model to phrase the finding. Because that data is *confidential*, the phrasing step is forced to run **locally (Tier 0)** — your economy figures never leave the device. If the local model is offline it degrades honestly to the raw signals rather than sending anything out.
- **Persona** offices (`bridge`, `technology`, `legal`) give a role-informed opinion with no live data attached — useful for framing, not for numbers.

Every delegation card tells you which of these you got, so "grounded in live data" and "persona opinion" never look the same.

## How to call it

Just ask naturally — Core routes to the right office:

- `Ask treasury what our runway looks like` → grounded CFO answer
- `Consult operations on activation drop-off` → grounded COO answer
- `Ask the roster who owns growth` → static org lookup

See [[Suggested Prompts]] for more, and [[Models and Cost]] for why confidential answers stay local.

> [!note] What this is not (yet)
> v1 delegation is a single grounded advisor per call. No office-calls-office, no CEO convening everyone. That orchestration is a later batch — see [[Changelog]].

_Last reviewed 2026-07-16._
