---
title: Identity, EXP, Diamonds, And Ledgers
type: doc-node
product: LashiraBloom
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# Identity, EXP, Diamonds, And Ledgers

`apps/kingdom/docs/mmorpg-identity-exp-diamond-ledgers.md` · verdict **partial**

The two-line EXP rule (adults get capped monster XP, kids get none from combat; diamonds only from ArgantaLabs) was implemented in 002's kingdom_award_monster_xp; but the named ledger tables (adult/monster/kid_education_exp_ledger, argantalab_diamond_mirror) were not built.

**Lesson:** The safety-critical rule (kids never earn combat XP, diamonds only from ArgantaLabs) survived from concept into shipped RPC even though the surrounding ledger architecture didn't — the principle mattered more than the table design.

In [[00-doc-atlas]] · product [[LashiraBloom]].
