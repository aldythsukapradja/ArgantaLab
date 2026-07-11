---
title: LashiraBloom — Progression, Character Page & the Competitive Loop
type: doc-node
product: LashiraBloom
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# LashiraBloom — Progression, Character Page & the Competitive Loop

`docs/LASHIRABLOOM-PROGRESSION-DESIGN.md` · verdict **partial**

The near-term slices shipped (live-equip Character Page with stats/equipment/skills tabs, gear buy/wear/enhance), but the design's spine — Axis B Activity Skills, per-path skill trees, prestige/hiscores/cards — is unbuilt.

**Lesson:** Documents its own mistake and fix: 'Wear restarts the game' because window.location.reload() was the lazy path; the real fix (swap g.resources via the already-standalone loadPlayerResources, no reload) shipped. Also shows scope reduction — a 3-axis RuneScape/RO-style progression was specced, only the dressing-room slice was built.

In [[00-doc-atlas]] · product [[LashiraBloom]].
