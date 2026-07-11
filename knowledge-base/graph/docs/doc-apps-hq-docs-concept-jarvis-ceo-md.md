---
title: CONCEPT — CEO Orb: Circle HQ Twin Brain
type: doc-node
product: HQ
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# CONCEPT — CEO Orb: Circle HQ Twin Brain

`apps/hq/docs/CONCEPT_JARVIS_CEO.md` · verdict **partial**

The core cinematic orb landing and Architecture map shipped, but a large fraction of the locked concept — the premium viz stack, Supabase-backed Vault, voice, write-back, LLM port — was replaced or left unbuilt.

**Lesson:** Aspiration outran ship. A heavy premium stack was 'locked' (ECharts, react-globe.gl, react-force-graph-2d, TensorFlow.js, react-globe geo arcs) then mostly NOT adopted — recharts/d3/custom-SVG shipped. The orb itself was redesigned mid-flight (P1 minimal SVG read as a 'sparse constellation' → P1.6 rebuild in React-Three-Fiber after seeing it live), and the doc's own honesty caveat — 'headless preview is 0x0, the 3D reactor needs the founder's eyes' — flags a build-review-adjust loop, not a one-shot. The 'locked decision' Vault-to-Supabase never happened; localStorage stayed.

In [[00-doc-atlas]] · product [[HQ]].
