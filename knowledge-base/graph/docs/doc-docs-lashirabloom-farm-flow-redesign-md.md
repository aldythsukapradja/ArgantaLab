---
title: LashiraBloom — Farm Flow + Combat + Audio Redesign
type: doc-node
product: LashiraBloom
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# LashiraBloom — Farm Flow + Combat + Audio Redesign

`docs/lashirabloom/farm-flow-redesign.md` · verdict **current**

A 15-phase pass; phases 13 (multi-farm), 14 (attack/skill cooldowns), 15 (tile popup/shop qty/bag) are marked built and all verify in code.

**Lesson:** Recurring 'build clean but not clicked-through live' honesty — the headless preview throttles requestAnimationFrame so canvas g.cam never populates, forcing code-review-sound-but-not-e2e-verified as the standing caveat.

In [[00-doc-atlas]] · product [[LashiraBloom]].
