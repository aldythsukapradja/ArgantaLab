---
title: The Stack — layer tracker
type: layer-index
status: living
date: 2026-07-11
snapshot_commit: a00b826
tags: [arganta, layers, stack, moc]
cssclasses: [wide-tables]
---

# 🥞 THE STACK — layer tracker

> [!abstract] What this is
> The **vertical** cut of the company — sliced by layer of the stack, where [[00-MASTER-KB]] is the **horizontal** cut (by product). Each layer is a living health card scored on **Maturity × Leverage**. Today (2026-07-11) is the baseline; each card grows a *What changed* log from here.

## The layers, bottom → top

```
     ┌───────────────────────────────────────────────┐
 L7  │  DISTRIBUTION      users reaching in           │  🔴 ~zero · the gap
     ├───────────────────────────────────────────────┤
 L6  │  KNOWLEDGE BASE    docs · vault · this KB       │  🟢 fresh · meta
     ├───────────────────────────────────────────────┤
 L5  │  AGENTIC           Circle HQ · The Bridge       │  🟡 functional, empty
     ├───────────────────────────────────────────────┤
 L4  │  ASSETS / CONTENT  pixel · curriculum · audio   │  🟢 high-volume
     ├───────────────────────────────────────────────┤
 L3  │  APP / UI          7 front-ends (apps/*)        │  🟢 heavy build
     ├───────────────────────────────────────────────┤
 L2  │  ENGINE / SPINE    packages/* — the moat        │  🟢 proven
     ├───────────────────────────────────────────────┤
 L1  │  DATA              Supabase · 71 tbl · 147 rpc  │  🟢 hardened
     ├───────────────────────────────────────────────┤
 L0  │  TOOLCHAIN         React·Vite·TS · 60 deps      │  🟡 drifting
     └───────────────────────────────────────────────┘
```

## Maturity × Leverage — the money table

> [!important] Read the diagonal
> The most **mature** layers (Data, Engine, App) are only **mid-leverage**. The highest-**leverage** layer (Distribution) is the least **mature**. The whole org needs to move **down-and-right** — stop maturing what's already built, invest where leverage is high and maturity is low.

| Layer | Maturity | Leverage | Wayforward signal |
|---|---|---|---|
| [[L0-toolchain\|L0 · Toolchain]] | 🟡 drifting | 🔴 low (hygiene) | Align versions on the wedge · one charting stack · fix D7 |
| [[L1-data\|L1 · Data]] | 🟢 hardened | 🟢 high (stable) | Add migration tracker (done) · test the money paths (D5) |
| [[L2-engine-spine\|L2 · Engine / Spine]] | 🟢 proven | 🟡 medium | Extract the copied engine (D3) · widen the moat |
| [[L3-app-ui\|L3 · App / UI]] | 🟢 heavy | 🟡 medium | Stop adding surfaces — pick the wedge (M1) |
| [[L4-assets-content\|L4 · Assets / Content]] | 🟢 high-vol | 🟡 medium | Kill 3× duplication → CDN (D2/D3) · educator-validate content |
| [[L5-agentic\|L5 · Agentic]] | 🟡 functional | 🔴→🟢 low-now | Honest but empty; leverage unlocks *with users* (needs L7) |
| [[L6-knowledge-base\|L6 · Knowledge Base]] | 🟢 fresh | ⚪ meta | Keep it living — it accelerates every layer below |
| [[L7-distribution\|L7 · Distribution]] | 🔴 ~zero | 🔴🔴 highest | **The move. One app, one channel, ten strangers (M2).** |

*Maturity 🟢 hardened/proven · 🟡 functional · 🔴 unbuilt. Leverage = how much moving it moves the business right now.*

## The one-sentence read

> [!quote] 
> Six of seven layers are green-mature. The seventh — the only one that touches a stranger — is red. **Every layer below L7 is a lever with nothing pulling it.**

## How this connects

- **Down** to [[00-MASTER-KB]] (§ per layer: §2/§6 engine, §3 data, §8 agentic…) and the [[00-doc-atlas]] verdicts.
- **Sideways** to [[00-arc|the Journey]] — each layer's *Lessons* link the `journey/lessons/` that shaped it.
- **Detail maps:** [[table-map|Table Map]] (all 71 tables) under [[L1-data|L1]]; [[tech-evolution|Tech Evolution]] under [[L0-toolchain|L0]].
- Debt items (D1–D8) are tagged to the layer that owns them.

## Update ritual
When a layer moves, edit its card in place: append a dated bullet under **What changed**, re-score **Maturity × Leverage** if it shifted, and update **Wayforward**. Re-generate this table's scores if any changed. The cards are living; this index is their dashboard.
