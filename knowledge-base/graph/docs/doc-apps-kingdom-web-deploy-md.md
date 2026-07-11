---
title: Kingdom web — deploy notes (MP-0)
type: doc-node
product: LashiraBloom
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# Kingdom web — deploy notes (MP-0)

`apps/kingdom/web/DEPLOY.md` · verdict **current**

MP-0 deploy notes (build-deploy.mjs assembling dist_site from command/+data/+web/dist) match the actual scripts and vercel.json; the two-app-as-one-static-site layout is real.

**Lesson:** Choosing to track the ~953MB/14.7k-file data bundle in git 'to keep deploy simple' is the direct root cause of KB debt D2 (939MB .git) and D3 (3x asset duplication) — convenience now, history bloat forever.

In [[00-doc-atlas]] · product [[LashiraBloom]].
