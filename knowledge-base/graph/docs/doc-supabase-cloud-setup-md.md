---
title: ArgantaLab — Cloud activation (Step 2)
type: doc-node
product: HQ
status: current
verdict: reference
tags: [doc, atlas]
date: 2026-07-11
---

# ArgantaLab — Cloud activation (Step 2)

`supabase/CLOUD_SETUP.md` · verdict **reference**

Setup runbook for the gated kid cloud-account stack; every named RPC exists and is wired, cloud simply never activated for real users.

**Lesson:** Synthetic-email kid auth (<user>@kids.argantalab.app + padded PIN) forces email-confirmation OFF or kids can never sign in — a real design constraint discovered and documented. Ship gated: local cache runs everything until real credentials flip cloudEnabled, so the app never breaks half-wired.

In [[00-doc-atlas]] · product [[HQ]].
