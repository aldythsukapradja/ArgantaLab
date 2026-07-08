---
title: Knowledge Graph Map
product: HQ
type: note
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-07
owner: aldyth
confidence: high
domain: [ai-context]
tags: [measurement, index, graph]
related:
  - "[[skills-index]]"
  - "[[sensor-plan]]"
---

# Knowledge Graph Map

> [!success] 🟢 CANONICAL v1 · updated 2026-07-07

> Reverse index: the graph's view of the skills. Keep in sync with [[skills-index]].
> Rule: no orphan skills. Every skill carries a ladders_to line. Health column = July 7 pull.

| Skill | ladders_to | Office | Health |
|---|---|---|---|
| long-horizon-planner | ns.w2f via lever.efficiency | Technology | amber |
| adversarial-reviewer | ns.w2f (gate) | Bridge | amber |
| subagent-orchestrator | hq.builders | Technology | amber |
| context-compaction | hq.data | Technology | green |
| activation-funnel-modeler | lever.efficiency | Technology | amber (weakest lever) |
| kinetik-recommender | lever.depth | Operations | green |
| arganta-design-system | hq.builders + arch.vercel | Technology | amber |
| arganta-gsap-cinematic | hq.builders | Technology | amber |
| arganta-mcp-connector | arch.sdk | Technology | amber |
| arganta-timeline | ns.w2f | Bridge | amber |
| arganta-workflow | ns.w2f via hq.builders | Technology | amber |
| decline-curve-forecaster | (external — reservoir) | — | — |
| reservoir-viz-standard | (external — reservoir) | — | — |
| **instrumentation-wiring** (draft 7/7) | ns.w2f via lever.efficiency + each wired node's lever | Technology | blind targets |
| **effort-scorer** (draft 7/7, uncalibrated) | hq.agents + ns.w2f | Guild | amber |
| **hq-router** (draft 7/7, P0 protocol) | hq.agents + ns.w2f | Guild | placeholder (0 runs) |

## Blind nodes with no skill yet — CLOSED July 7
The 15-node blind list (see [[sensor-plan]]) is now owned by **instrumentation-wiring**.
Remaining skill to write: **persona-core-integration** (wires [[persona-core]] into the C-suite).

## Links
- Skills: [[skills-index]] · Blind list detail: [[sensor-plan]]
