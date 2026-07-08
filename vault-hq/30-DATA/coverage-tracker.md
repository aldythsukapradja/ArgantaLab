---
title: Coverage Tracker
product: HQ
type: note
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-07
owner: aldyth
confidence: high
domain: [ai-context, money]
tags: [measurement, metric, north-star]
related:
  - "[[sensor-plan]]"
  - "[[daily-loop]]"
---

# Coverage Tracker

> [!success] 🟢 CANONICAL v1 · updated 2026-07-07 — coverage.pct = 78% (verify Bridge = production).

> The one honest number. Watch this week over week.

## Current (last pull)
- **coverage.pct = 78%** — 59/76 nodes grounded (35 live, 24 partial, 3 simulated, 14 placeholder). #known
- Source: Circle HQ `ceo_brief`, pulled July 7, 2026.
- ⚠ Caveat: confirm the Bridge endpoint serves production data, not the seed graph (RECON §9.1).

## Target
- 95%+. Everything in [[sensor-plan]] Tier 1 + Tier 2 moves this number.

## How to use
- Re-pull after each wiring batch. This is the before/after for the whole system in one number.
- If a week's work didn't move it, that work was vanity progress (see [[daily-loop#Weekly — Verify]]).

## Log
| Date | coverage.pct | note |
|---|---|---|
| 2026-07-07 | 78% | baseline — full six-office pull; blind list corrected 11 → 15 (RECON.md) |

## Links
- Fed by: [[sensor-plan]] · Watched in: [[daily-loop]]
