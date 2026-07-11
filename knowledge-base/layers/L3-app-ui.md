---
title: L3 · App / UI
type: layer-tracker
layer: app-ui
status: living
health: green
maturity: heavy
leverage: medium
date: 2026-07-11
tags: [arganta, layer, app, ui, frontend]
cssclasses: [wide-tables]
---

# L3 · App / UI — seven front-ends

> [!abstract] Health: 🟢 heavy build · Leverage: 🟡 medium
> **~93k of the 96k LOC** lives here — seven React front-ends on the shared spine. Enormous surface area, real polish. Also the layer most at risk of confusing *motion* for *progress*: it grew fastest in P7, the week external users grew by zero.

## Baseline state (2026-07-11)

| App | LOC | Role | Stack |
|---|---|---|---|
| `apps/web` (ArgantaLabs) | 34,196 | kids' learning — **most complete** | React · Vite · Capacitor |
| `apps/hq` (Circle HQ) | 25,820 | founder OS (also L5) | React · Vite · R3F |
| `apps/lashira` (LashiraBloom) | 14,070 | RPG / farm | React · Canvas |
| `apps/kinetik` (KinetikCircle) | 7,234 | social + calendar | React · Vite · Capacitor |
| `apps/kingdom` | 6,904 | combat lab | React · Canvas |
| `apps/landing` (arganta.app) | 4,197 | marketing / deck | React · Three · GSAP |
| `apps/mcp` (The Bridge) | 941 | MCP seat (also L5) | Node |

- **20+ surfaces in `apps/web` alone** (PlayHome, Learn, Wizard, BuilderLab, Shop, KinQuest, Arena…). Full surface index in [[00-MASTER-KB#2 · Repo Structure|§2.1]].
- **Native:** ArgantaLabs + KinetikCircle ship via Capacitor (iOS + Android).
- **Design system** exists but thin/implicit — no single tokens source across the seven.

## Maturity × Leverage
- **Maturity 🟢 heavy** — the most-built layer by far; breadth is not the problem.
- **Leverage 🟡 medium** — more surfaces don't move the one number. The atlas shows this: many UI concepts shipped *partially* or got superseded (design churn), while zero of it reached a stranger.

## What changed
*Baseline — the zero point.*
- `2026-07-11` — baseline: 7 apps, ~93k LOC. P7 (last week) added Skill Forge, Character Page, cosmetics — net external-user delta **0**.

## Lessons
- [[the-shipped-ia-is-the-real-decision]] — prose specs churned; the shipped information architecture is where design actually happened.
- [[distribution-not-features]] — this layer is where "polish is not progress" bites hardest.
- [[declare-when-you-supersede]] — the LashiraBloom battle-builder was redesigned 5× here before one shipped.

## Debt & risks
- Design fragmentation across 7 apps (no shared token/component source beyond the game spine).
- Surface sprawl: breadth without a named **wedge** (M1) means effort spreads thin.
- **D7** — 5 of these apps sit outside the root workspaces (separate lockfiles).

## Wayforward
1. **Name the wedge (M1).** One of these seven is the tip of the spear — decide it in writing (see [[L7-distribution]] and [[00-MASTER-KB#12 · Milestone Tracker]]). Everything else goes to maintenance.
2. Freeze new surfaces on non-wedge apps.
3. If a shared design system is worth it, it's worth it *only* on the wedge first.

## Links
[[00-stack]] · [[00-MASTER-KB#1 · Product Map]] · [[L2-engine-spine]] · [[L7-distribution]]
