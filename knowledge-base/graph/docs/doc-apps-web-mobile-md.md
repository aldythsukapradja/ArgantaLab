---
title: ArgantaLab — Native (Android + iOS) via Capacitor
type: doc-node
product: HQ
status: current
verdict: reference
tags: [doc, atlas]
date: 2026-07-11
---

# ArgantaLab — Native (Android + iOS) via Capacitor

`apps/web/MOBILE.md` · verdict **reference**

Setup/onboarding guide whose every claim is verified in code — capacitor.config.ts, package.json mobile scripts, src/lib/native.ts, and android/ + ios/ dirs all present and consistent; a timeless still-valid reference.

**Lesson:** One React/Vite build runs on web, Android, and iOS — no forked native codebase; Capacitor plugins web-shimmed so the native bridge is a no-op in browser and Supabase calls work unchanged over localhost origin. The reusable instinct: wrap, don't fork.

In [[00-doc-atlas]] · product [[HQ]].
