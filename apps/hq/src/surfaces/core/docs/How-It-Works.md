---
title: How It Works
updated: 2026-07-16
type: reference
tags: [arganta-core, architecture, loop]
---

# How It Works

One page on the machinery, so nothing feels like magic.

## The turn loop

1. **Recall** — your message is embedded and relevant Vault chunks are pulled in ([[Memory and Vault]]).
2. **Plan** — the brain ([[Models and Cost|Gemini]]) reads the message + the tool list and decides: answer in text, or call a tool.
3. **Act** — if it calls a tool, the tool runs for real (image, site, query…) and the *actual* result goes back to the brain.
4. **Finish** — the brain writes a short reply about what it did. Every turn ends with a text reply.

The loop is bounded (a few steps, a cost budget) so it can't spin forever.

## Honest degrade — the core promise

Core never presents a fake answer as real. Concretely:

- If **no live model** is reachable, it says so — it does not invent a reply.
- If a **tool fails**, it reports the failure instead of claiming success.
- If a tool **succeeded** but the follow-up caption call couldn't reach a model, it tells you the artifact is real and saved, and that only the caption is missing (this was fixed 2026-07-16 — see [[Changelog]]).
- Every reply's footer shows the **true** provider, model and cost — never a generic label.

## Governance built in

Each tool declares its own data sensitivity. The `analyze` tool and grounded offices ([[Agents and Offices]]) work with **confidential** live numbers, so the router forces those to run **locally** — real revenue data never leaves the device. Publishing ([[Publishing]]) is the single outside-world action and always needs your confirmation.

## Where this lives

- Chat surface: `apps/hq/src/surfaces/core/`
- Turn orchestration: `apps/hq/src/lib/core/`
- The pure agent loop + tool contracts: `@arganta/agent`
- The model router: `@arganta/ai`

_Last reviewed 2026-07-16._
