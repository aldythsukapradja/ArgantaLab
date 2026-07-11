---
title: LashiraBloom
type: doc-node
product: LashiraBloom
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# LashiraBloom

`apps/lashira/web/README.md` · verdict **current**

Every architectural claim maps to real code: src/engine/{compositor,data,palettes}.js copied from Kingdom, src/net/hero.js exports fetchHeroState + loadPlayerResources, FarmRoom.jsx/farm-logic.js/farm-map.js all present, port 5185 confirmed in vite.config.js. The 'Next' list is partly stale (cloud save shipped: farm-save.js calls load/save_lashira_farm_state, 001_lashira_core.sql exists), but the core it describes is the live approach.

**Lesson:** The Kingdom avatar engine (compositor/data/palettes) was copied wholesale into Lashira with a 'Extract to a shared package later' TODO that was never done — the exact 3x-duplication instinct that becomes debt D2/D3 in the master KB. The winning instinct: 'farm as your real Kingdom Hero' (single character source) is the same single-source pattern that made @arganta/combat compound.

In [[00-doc-atlas]] · product [[LashiraBloom]].
