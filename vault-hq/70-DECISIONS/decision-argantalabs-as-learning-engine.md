---
title: Decision — ArgantaLabs as Learning Engine
product: ArgantaLabs
type: decision
class: operational
status: shipped
canonical: true
version: v1
updated: 2026-05-20
owner: aldyth
confidence: high
domain: [arganta, learning]
tags: [decision, learning, architecture]
related:
  - "[[argantalab]]"
  - "[[kinetikcircle]]"
  - "[[lashirabloom]]"
  - "[[product-loop]]"
---

# Decision — ArgantaLabs as Learning Engine

> [!success] 🟢 CANONICAL v1 · ArgantaLabs · updated 2026-05-20

## Decision
[[argantalab|ArgantaLabs]] is built as an **engine with surfaces**, not a destination app: drills, quests, ranks and XP are services that [[kinetikcircle|KinetikCircle]] and [[lashirabloom|LashiraBloom]] call.

## Context
The learning experience kept wanting to leak into the other pillars — quests in the family planner, XP in the farm. Duplicating logic per app was already hurting at two integrations.

## Options considered
1. **Standalone app** — cleanest brand, weakest loop
2. **Engine + embedded surfaces** — one progression system, many doors
3. **Merge into the game** — fun, but learning becomes decoration

## Why option 2
The loop ([[product-loop|Product Loop]]) needs learning effort to be *legible everywhere* — a quest cleared at breakfast must move the farm by dinner. One engine, one XP ledger, one rank season, rendered wherever the family already is.

## Consequences
- Single source of truth for XP feeding the [[argons-economy|Argons Economy]]
- Rank seasons stay marathon-shaped (daily caps) across every surface
- The engine ships SDK-style; surfaces stay thin
