---
title: Kinetik — Plans. People. Play.
type: doc-node
product: KinetikCircle
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# Kinetik — Plans. People. Play.

`apps/kinetik/README.md` · verdict **current**

The one-way Supabase→cache architecture and every named module exist in code; only the table list is stale — it names kinetik_circles (never created; the app reuses shared circles per the 2026-06-23 decision) and predates ~33 kinetik_* tables now present.

**Lesson:** The 'one source of truth, no fake seed' discipline held and compounded; but the doc froze the schema at 5 tables while it grew to ~33, and it still references kinetik_circles which was deliberately dropped for the shared circles model — foundational-doc drift.

In [[00-doc-atlas]] · product [[KinetikCircle]].
