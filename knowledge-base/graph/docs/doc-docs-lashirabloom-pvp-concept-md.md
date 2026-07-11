---
title: LashiraBloom — PvP Arena Concept (SIMPLE + per-path damage)
type: doc-node
product: LashiraBloom
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# LashiraBloom — PvP Arena Concept (SIMPLE + per-path damage)

`docs/lashirabloom/pvp-concept.md` · verdict **current**

Fully built 2026-07-09: per-path fairness profile, PvP HP normalization, zone-gated combat, circle rank, hearts HUD — with an extensive same-day live-playtest debugging log appended.

**Lesson:** The cluster's hardest bug: 5 rounds of same-day debugging of 'attacker shows Hit but victim stays full' — root cause was resizing+refilling HP on every PvP↔battleground zone crossing (and a faint-heal-to-full), only found by reading Kingdom Heroes' proven flat-HP receiver as the reference. Fairness by simulation alone is a direction, not truth — needs real duels.

In [[00-doc-atlas]] · product [[LashiraBloom]].
