---
title: App Builder — UI/UX Design
type: doc-node
product: HQ
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# App Builder — UI/UX Design

`DESIGN_APP_BUILDER_UI_UX.md` · verdict **partial**

The catalog/build/preview/publish flow shipped, but re-architected as shared builder pages (Catalogue/Studio/Analytics + Stepper) rather than the doc's dedicated TemplateCarousel/InferencePanel/ManifestPanel; the auto-inference badges (parseSDKCalls → metrics/agents) were never built.

**Lesson:** Named components (TemplateCarousel, InferencePanel) were folded into generic shared pages; the inference-badge UX, the doc's differentiator vs GameBuilder, never shipped.

In [[00-doc-atlas]] · product [[HQ]].
