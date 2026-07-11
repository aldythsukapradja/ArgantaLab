---
title: KinFarm Circle Shared Save Handoff
type: doc-node
product: KinetikCircle
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# KinFarm Circle Shared Save Handoff

`docs/KINFARM-CIRCLE-SHARED-SAVE-HANDOFF.md` · verdict **current**

The exact two-layer fix proposed (new circle_game_saves table + save/load_circle_game_state RPCs + circleBridge routing on ?circle=) was implemented as specified.

**Lesson:** The 'battle test' correctly diagnosed that changing only one layer would silently fail (Kinetik already sent the circle id; the bridge ignored it) and that a separate circle_game_saves table beat overloading game_saves with mixed auth rules — that structural call held and shipped verbatim.

In [[00-doc-atlas]] · product [[KinetikCircle]].
