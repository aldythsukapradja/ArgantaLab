---
title: MMORPG Supabase Data Schema
type: doc-node
product: LashiraBloom
status: draft
verdict: concept-unbuilt
tags: [doc, atlas]
date: 2026-07-11
---

# MMORPG Supabase Data Schema

`apps/kingdom/docs/mmorpg-supabase-schema.md` · verdict **concept-unbuilt**

Generic tables (characters, monster_templates, monster_instances, item_instances, quests, adult/kid/monster exp ledgers, diamond mirror) do not exist; a much smaller kingdom_-prefixed subset was built instead in 002.

**Lesson:** The grand schema (dozens of runtime/instance/ledger tables) was scoped down to a progression-and-presence slice — a big-design-up-front doc that shipped as ~15% of its table count.

In [[00-doc-atlas]] · product [[LashiraBloom]].
