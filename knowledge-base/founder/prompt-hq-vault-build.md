---
title: Prompt — HQ Vault Build
product: HQ
type: prompt
status: frozen
tags: [prompt, engineering, vault]
date: 2026-07-06
owner: Aldyth
confidence: high
---
# Prompt — HQ Vault Build

The prompt that built this workspace. Kept as the house template for **feature-first agent builds**.

## Mission framing
> Build a premium Obsidian-inspired knowledge workspace inside HQ. Spend 80% of effort on the new feature, 15% integrating it, 5% on the old shell. Feature first, polish second, no fake buttons.

## Structure that made it work
1. Product context (four pillars, who each serves)
2. Explicit UX reference model (ribbon, explorer, tabs, graph, canvas, bases)
3. Legal guardrail — emulate the interaction model, never assets or branding
4. Local-first constraint: no backend, localStorage
5. Pure-function contract: parseFrontmatter, buildBacklinks, buildGraph
6. Acceptance flows the result is graded against

Related craft: [[Prompt — Engineering Review Pass]] · index: [[Fable Build Prompts]]
