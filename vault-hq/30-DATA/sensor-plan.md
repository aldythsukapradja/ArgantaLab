---
title: Sensor Plan
product: HQ
type: plan
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-07
owner: aldyth
confidence: high
domain: [ai-context, money]
tags: [measurement, sensors, instrumentation]
related:
  - "[[coverage-tracker]]"
  - "[[skills-index]]"
---

# Sensor Plan

> [!success] 🟢 CANONICAL v1 · updated 2026-07-07 — 15 blind signals confirmed (Tier 1).

> What's measured, what's blind. A sensor with no consumer is just a log file — see the loop below.
> Pulled from Circle HQ July 7, 2026 — full six-office pull; this list is CONFIRMED, not sampled.

## Tier 1 — BLIND (wire first, zero data) — 15 confirmed, was "11"
- **Technology (4)**: dead_end_quit, build_abandoned, broken_share_link, calendar_open_no_add
- **Operations (7)**: arganta.home, ship.discover, app.landing (container), land.home,
  land.products, land.pitch, sig.deck_no_waitlist
- **Treasury (1)**: sig.paywall_bounce ← was missing from the old list
- **Legal (3)**: sig.ugc_flagged, legal.ip, legal.risk ← registers, not events (populate, don't instrument)
- Wiring spec: PLAN-instrumentation-wiring.md (batches A–C + registers). Skill: instrumentation-wiring.

## Tier 2 — PARTIAL (tighten amber→live)
build.wizard/lab/pitch funnel, ship.library/gamestore attribution, arch.vercel, arch.sdk,
lever.breadth (k-factor — this is a FIX not an instrument: sig.invite_never_accepted).
Also FIX-class guardrails: impossible_score, item_overexposed, difficulty_mismatch, streak_broken.

## Tier 3 — LIVE (protect, don't break)
lever.depth/frequency, all Learn subtabs, KinetikCircle core, Fame/leaderboards, Diamond ledger.

## The loop (why sensors matter)
event fires → Supabase → Circle HQ ingests → node provenance updates → verdict opens if bad →
skill acts on verdict. Three of four steps already built. Missing piece = step 1 (events firing).

## Money — provenance warning
CAC $75/payer and 2% conversion are BOTH simulated ($1.50 CAC/family ÷ 2% = $75 — one assumption,
two views). Open mismatch: the CFO model's mid-case runs 4% conv, the consult flag says 2% —
decide which is canonical. First win = make these HONEST, not lower.

## Links
- Skills that act: [[skills-index]] · Tracked by: [[coverage-tracker]]
