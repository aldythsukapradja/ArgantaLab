---
title: Mobile-First Visual Build Plan
type: doc-node
product: HQ
status: superseded
verdict: superseded
tags: [doc, atlas]
date: 2026-07-11
---

# Mobile-First Visual Build Plan

`BUILD_PLAN_MOBILE_VISUALS.md` · verdict **superseded**

Plan targets apps/hq/src/surfaces/GameBuilder.tsx (CatalogView/FeaturedStrip/GameCard/BuildView by line number) plus new files ResponsiveContainer.tsx and Skeleton.tsx and a getThumbnailUrl helper — none exist; the game builder was rebuilt as a thin BuilderShell wrapper.

**Lesson:** A line-numbered refactor plan against one monolithic file was invalidated by a full rewrite into a shared shell — the surface was replaced, not incrementally optimized as planned.

In [[00-doc-atlas]] · product [[HQ]].
