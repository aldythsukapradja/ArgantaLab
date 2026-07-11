---
title: LashiraBloom
product: LashiraBloom
type: moc
status: living
tags: [pillar, world, rpg, retention]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# LashiraBloom — the family world

A Stardew-inspired family RPG built on the Kingdom spine over four heavy days (P6, 100+ commits): a farm loop (1–8) plus tiered combat (1–16) on a 60×48 castle-center map with an 82-asset art library. Rationale: [[Decision — LashiraBloom as Retention World]].

## The reuse bet that paid off
Combat, skills, scaling and VFX come from the shared **@arganta/combat** package — the same engine Kingdom and HQ consume. The Kingdom canvas compositor was copied in wholesale to ship fast (still un-extracted; that's debt). See [[Founder Decisions]].

## The currency, corrected
The play currency is **Bloom 🌸** — it was specced as open Diamonds, respecced as Gold, and shipped as Bloom, all inside ~24h (2026-07-08). Diamonds remain the cross-app skins currency; Bloom is Lashira's. Full model: [[The Economy]].

## Adults play, kids learn
Grown-ups farm freely; growth multipliers come from the kids' learning streaks in [[ArgantaLabs]]. No rot timers — crops wait politely.

## The honest gap
> Real farm + real combat, **0 players**. There is no onboarding for a stranger and no reason to return that isn't "dad built it." Retention (daily quests + streak) is the missing layer.
