---
title: App Builder Architecture — Modular & Scalable
type: doc-node
product: HQ
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# App Builder Architecture — Modular & Scalable

`ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE.md` · verdict **partial**

The core 'SDK spine + templates-as-data' insight shipped, but the specific module architecture this doc 'locked' (standalone AppBuilder.tsx, parseSDK.ts, components/AppBuilder/*, hq_app_html + hq_app_template + app_record tables) was superseded by a unified config-driven BuilderShell shared with the Game Builder, with app HTML stored inline on hq_app.

**Lesson:** A bespoke per-builder architecture was 'locked' then abandoned mid-build for far more reuse — one shared shell instead of a parallel AppBuilder tree.

In [[00-doc-atlas]] · product [[HQ]].
