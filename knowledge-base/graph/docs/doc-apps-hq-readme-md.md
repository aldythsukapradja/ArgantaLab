---
title: Circle HQ — Founder OS
type: doc-node
product: HQ
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# Circle HQ — Founder OS

`apps/hq/README.md` · verdict **partial**

Run/deploy/operator-gate instructions are still accurate, but the 'Architecture (P0)' section describes a structure that no longer exists — the app grew past it into the command-graph + reactor-orb + vault layout.

**Lesson:** The P0 seam idea (HQDataSource mock/supabase, deterministic insight() with LLM swap-behind) survived conceptually and repeats across the whole build, but the concrete file scaffold (contract/, insight/, Pulse) was replaced and the README was never updated — a stale onboarding doc is the cost of never regenerating genesis docs.

In [[00-doc-atlas]] · product [[HQ]].
