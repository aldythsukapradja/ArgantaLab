---
title: Circle App SDK Specification
type: doc-node
product: HQ
status: current
verdict: partial
tags: [doc, atlas]
date: 2026-07-11
---

# Circle App SDK Specification

`SPEC_CIRCLE_APP_SDK.md` · verdict **partial**

The mock SDK matches this spec almost exactly (init/circle/db.list-save-remove-on/agent/emit/on), but the 'real mode' half — Supabase auth, app_record table, RLS policies, realtime, edge-function agents — was never implemented; apps run only against localStorage.

**Lesson:** Doc declared 'This spec is locked'; the mock shipped verbatim while the production backend (the whole point) stayed a spec.

In [[00-doc-atlas]] · product [[HQ]].
