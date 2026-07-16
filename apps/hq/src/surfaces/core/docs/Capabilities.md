---
title: Capabilities
updated: 2026-07-16
type: reference
tags: [arganta-core, capabilities, tools]
---

# Capabilities

Everything below is a real **tool** Core can call. Each runs on your own Cloudflare + Supabase, saves its output, and reports true cost. See [[Suggested Prompts]] for phrasing that reliably triggers each one, and [[Models and Cost]] for which engine backs it.

## Make media

| Tool | What it makes | Engine | Cost |
|---|---|---|---|
| `generate_image` | An image from a text prompt, saved to media-artifacts | Cloudflare FLUX | free tier |
| `generate_speech` | A spoken audio clip (voice `JM` male / `KF` female) | Cloudflare Aura-1 | free tier |

## Build artifacts

| Tool | What it makes | Engine | Cost |
|---|---|---|---|
| `create_website` | A real, usable single-file website (AI-generated, validated) | Gemini + validation gate | $0 free tier |
| `create_application` | A real single-file web app (CRUD, localStorage) | Gemini + validation gate | $0 free tier |
| `make_website` | A quick deterministic landing page from a brief | local engine | $0, instant |
| `make_deck` | A cinematic HTML slide deck from a topic | local engine | $0, instant |
| `make_brand` | A seeded palette + type kit from a name/vibe | local engine | $0, instant |

> [!note] make_* vs create_*
> `make_website` is an instant deterministic template. `create_website` / `create_application` run real AI generation and are what you want for something usable. Core prefers the `create_*` tools when you ask for a real artifact.

## Understand your business

| Tool | What it does | Data class |
|---|---|---|
| `analyze` | Answers a data question with the right chart, grounded in **live** Supabase metrics | confidential — stays local |
| `search_vault` | Semantic search across your founder [[Memory and Vault|Vault]] + past threads | internal |
| `check_quota` | Today's Cloudflare Workers AI neuron usage vs the free daily cap | internal |
| `check_ledger` | Recent generation runs + spend from the truthful `agent_runs` ledger | internal |

## Delegate

| Tool | What it does |
|---|---|
| `consult_office` | Hands a question to a C-Level office and folds its recommendation back in — see [[Agents and Offices]] |

## Publish

| Tool | What it does |
|---|---|
| `publish_artifact` | Puts a built site/app on the public internet — see [[Publishing]] |

> [!warning] The only outside-world action
> `publish_artifact` is the single tool that changes something *outside* this conversation, so it always needs your explicit go-ahead — it never runs on its own.

_Last reviewed 2026-07-16._
