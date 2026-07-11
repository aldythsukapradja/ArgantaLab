---
title: Kingdom deploy — domains & auth bridge
type: doc-node
product: LashiraBloom
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# Kingdom deploy — domains & auth bridge

`apps/kingdom/DEPLOY.md` · verdict **current**

Two-surface deploy (kingdom.arganta.app Command / heroes.arganta.app Lab) with postMessage session bridge matches KB §4.1 and command/auth.js (embed+heroes handling present).

**Lesson:** Google OAuth cannot run in an iframe (403) — solved by signing into top-level Command and posting the Supabase session into the framed Lab; a reusable cross-origin auth-bridge pattern.

In [[00-doc-atlas]] · product [[LashiraBloom]].
