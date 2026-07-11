---
title: Character Lab Polish And DB-Backed Progression Plan
type: doc-node
product: LashiraBloom
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# Character Lab Polish And DB-Backed Progression Plan

`apps/kingdom/docs/CHARACTER-LAB-POLISH-DB-BACKED-PLAN.md` · verdict **current**

This plan was actually built: apps/kingdom/supabase/002 contains every proposed table/RPC (xp_ledger, sessions, guardians, caps) and account.js calls the RPCs.

**Lesson:** 'This order avoids polishing UI around fake data' — plus the battle-test finding that game_grant() used floor(1+sqrt(xp/100)) while the client used floor(xp/500)+1: two competing level formulas were caught before build, forcing a single argantalab_level_from_xp() authority.

In [[00-doc-atlas]] · product [[LashiraBloom]].
