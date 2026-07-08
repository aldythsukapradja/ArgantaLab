---
title: ArgantaLab
product: ArgantaLabs
type: strategy
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-07
owner: aldyth
confidence: high
domain: [arganta, learning]
tags: [product, learning-engine, pillar]
related:
  - "[[sensor-plan]]"
  - "[[coverage-tracker]]"
  - "[[circle-hq]]"
---

# ArgantaLab

> [!success] 🟢 CANONICAL v1 · updated 2026-07-07

> Gamified children's learning. Part of the [[mental-model|UI/UX layer]].

## What it is
- Cambridge Primary curriculum, Duolingo-style mechanics, "Kinetik Buddy" pet system. #known
- Repo: github.com/aldythsukapradja/ArgantaLab #known
- Learn subtabs: NumberDash, WordQuest, WonderLab, LogicLand, WorldTrail, LifeQuest. #known

## Current state (from the graph)
- Weakest lever: activation/efficiency. Landing page fully blind. #known
- See [[sensor-plan]] for the full blind-signal list.

## Open threads (July 7 pull — Operations office_report)
- App node `app.arganta` is partial/amber; Learn core all live/green (RETAIN — protect).
- Build pipeline (wizard→lab→pitch) all partial — funnel between them untracked.
- Blind on Arganta surfaces: `arganta.home`, `ship.discover` + the four Tech signals
  (dead_end_quit, build_abandoned, broken_share_link) that live in its flows.
- Landing (`app.landing`, land.home/products/pitch, deck_no_waitlist) fully blind —
  top-of-funnel is dark while activation is the weakest lever.
- Open handoff tech→ops: difficulty_mismatch — content needs a pass.
- Wiring plan exists: PLAN-instrumentation-wiring.md (repo scan is the blocker).

## Learning-engine pillar — product strategy
> Merged from the seed pillar note. Strategic/product view; the sections above are the live operational state.

The kids' pillar, inspired by the founder's son: drills, quests, ranks and worlds that make practice feel like play. Chosen as the dedicated learning engine in [[decision-argantalabs-as-learning-engine|Decision — ArgantaLabs as Learning Engine]].

### Engine, not app
ArgantaLabs is an **engine** that other pillars call:
- [[kinetikcircle|KinetikCircle]] surfaces "today's quest" inside the family plan
- [[lashirabloom|LashiraBloom]] converts learning XP into world progress
- Rewards settle in the shared [[argons-economy|Argons Economy]]

### Design laws
1. A daily session must fit in 12 minutes.
2. Rank seasons are marathons, not sprints — capped daily gain, rising curve.
3. Every drill maps to a curriculum node a parent can inspect.

## Links
- Measured by: [[sensor-plan]] · [[coverage-tracker]]
- Design: [[skills-index#arganta-design-system]]
