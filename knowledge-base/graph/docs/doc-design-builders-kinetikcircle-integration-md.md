---
title: Game Builder & App Builder — KinetikCircle Data Integration
type: doc-node
product: HQ
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# Game Builder & App Builder — KinetikCircle Data Integration

`DESIGN_BUILDERS_KINETIKCIRCLE_INTEGRATION.md` · verdict **partial**

Circle-awareness partly shipped in HQ (listUserCircles loads on builder mount; hq_app gained visibility + circle_ids columns), but the live-member preview injection and per-circle publishing consumed by KinetikCircle were not wired — Kinetik doesn't read hq_app.

**Lesson:** Phase-1/2 circle plumbing landed in the builder, but the consumption side (Kinetik rendering circle-scoped apps) stayed unbuilt, so circle targeting has no runtime effect.

In [[00-doc-atlas]] · product [[HQ]].
