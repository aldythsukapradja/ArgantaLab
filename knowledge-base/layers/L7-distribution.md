---
title: L7 · Distribution
type: layer-tracker
layer: distribution
status: living
health: red
maturity: zero
leverage: highest
date: 2026-07-11
tags: [arganta, layer, distribution, growth, zero-user-problem]
cssclasses: [wide-tables]
---

# L7 · Distribution — the layer that isn't built

> [!abstract] Health: 🔴 ~zero · Leverage: 🔴🔴 highest
> The only layer that touches a stranger — and it doesn't exist yet. **External users: `0`.** Every green layer below this one is a lever with nothing pulling it. This card is deliberately in the tracker so the gap is visible every single time you open the stack.

## Baseline state (2026-07-11)

- **`hq_growth_overview()` → external users: 0.** All activity is household. #known
- **No distribution machinery:** no signup funnel, no waitlist, no store listing used by a non-family member, no channel, no measured conversion.
- **Top-of-funnel is blind** — `app.landing`, `land.home/products/pitch` unmeasured; activation is the weakest lever while it's dark.
- What *does* exist: a cinematic landing site, a pitch deck, native Capacitor builds — capability with no audience pointed at it.

## Maturity × Leverage
- **Maturity 🔴 ~zero** — nothing here is built.
- **Leverage 🔴🔴 highest** — this is the single layer whose movement changes everything. One real user flips [[L5-agentic|L5]] from simulated to live, validates [[L3-app-ui|L3]], and gives [[L4-assets-content|L4]] curriculum a reason to exist.

> [!failure] The one number
> ```sql
> select hq_growth_overview();
> -- external users: 0
> ```
> The "removed surfaces" column in the weekly log has never been non-zero. **That single cell is the whole diagnosis.**

## What changed
*Baseline — the zero point. This is the row to watch.*
- `2026-07-11` — baseline: 0 external users. (When this bullet gains a "1", the company changes state.)

## Lessons
- [[distribution-not-features]] — distribution is the work; features are not; **polish is not progress.** This layer is the lesson made into a scoreboard.

## Debt & risks
- **D1 — zero external users (🔴 existential).** Not a feature gap — a distribution gap. The fix is a channel and ten strangers, not more code. → [[00-MASTER-KB#11 · Debt Register]]

## Wayforward
> [!todo] The milestones that matter (from [[00-MASTER-KB#12 · Milestone Tracker]])
> - **M1** — name ONE product as the wedge, in writing (blocks everything).
> - **M2** — Stranger #1: `hq_growth_overview().learners ≥ 1` non-household.
> - **M3** — Ten strangers: `wau ≥ 10`, none named Sukapradja.
> - **M4** — D7 retention ≥ 20% on those ten.

1. **Pick the wedge ([[L3-app-ui|M1]]).** Until one app is the tip of the spear, there's no funnel to build.
2. **One channel, ten strangers.** Not seven apps to everyone — one app to one audience.
3. **Instrument the top of the funnel** so the first strangers are *seen* (closes the blind landing signals).

## Links
[[00-stack]] · [[00-MASTER-KB#10 · Status Board]] · [[L3-app-ui]] · [[L5-agentic]]
