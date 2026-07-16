---
title: Memory and Vault
updated: 2026-07-16
type: reference
tags: [arganta-core, memory, rag]
---

# Memory and Vault

Core has two ways to remember: **automatic recall** (every turn) and **explicit search** (when you ask). Both read your founder Vault + past threads, stored as vector embeddings in Supabase (`pgvector`, Cloudflare BGE embeddings).

## Auto-recall — runs every turn

Before Core even thinks, it embeds your message and pulls the most relevant Vault chunks into context. You'll see an `auto_recall` line in the trail. It's deliberately held to a **tighter trust ceiling** (`internal`) than manual search — background access earns less trust than a deliberate request.

## search_vault — when you ask

The `search_vault` tool (see [[Capabilities]]) is a deliberate, human-initiated search, so it's allowed a **higher ceiling** (`confidential`) — you can reach your most sensitive notes by explicitly asking Core to search for them.

> [!note] Same data, different trust
> Auto-recall = `internal`. Manual `search_vault` = `confidential`. How deliberate an access is shapes how much it's allowed to see.

## Keeping memory fresh

Your Vault notes only become searchable after they're **synced to Core memory**. Do that from **HQ Vault → Settings → "Sync to Core memory"**. It's manual on purpose — embedding costs stay predictable, and re-syncing an edited note replaces its old chunks instead of piling up duplicates.

## Try it

- `Search my Vault for our monetization decision`
- `What did we decide about rank season tuning?`

See [[Suggested Prompts]] for more.

_Last reviewed 2026-07-16._
