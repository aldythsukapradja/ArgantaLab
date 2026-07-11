---
title: Pixel Vault → Supabase (private store)
type: doc-node
product: HQ
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# Pixel Vault → Supabase (private store)

`supabase/PIXEL_VAULT.md` · verdict **current**

Private pixel-art store is built end to end — migration, sync script, and signed-URL read path all exist and match the doc; the doc's 'next step' (point viewer at pixel_manifest) is itself already implemented.

**Lesson:** Because the whole store is login-walled and private, license tiers (T0/T1/T2) are demoted from a shipping gate to a quality/traceability signal — you can store anything, and tiers only bind the day you make something public. Any-source drop-folder + idempotent re-runnable sync beats scraping.

In [[00-doc-atlas]] · product [[HQ]].
