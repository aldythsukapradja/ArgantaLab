---
title: Prompt — HQ Vault Build
product: HQ
type: prompt
class: operational
status: shipped
canonical: true
version: v1
updated: 2026-07-06
owner: aldyth
confidence: high
domain: [arganta, ai-context]
tags: [prompt, engineering, vault]
related:
  - "[[prompt-engineering-review-pass]]"
  - "[[fable-build-prompts]]"
---

# Prompt — HQ Vault Build

> [!success] 🟢 CANONICAL v1 · HQ · updated 2026-07-06

The prompt that built this workspace. Kept verbatim-in-spirit as the house template for **feature-first agent builds**.

## Mission framing
> Build a premium Obsidian-inspired knowledge workspace inside HQ. Spend 80% of effort on the new feature, 15% integrating it, 5% on the old shell. Feature first, polish second, no fake buttons.

## Structure that made it work
1. Product context (four pillars, who each serves)
2. Explicit UX reference model (ribbon, explorer, tabs, graph, canvas, bases…)
3. Legal guardrail — emulate interaction model, never assets or branding
4. Local-first constraint: no backend, no auth, IndexedDB/localStorage
5. Pure-function contract: parseFrontmatter, buildBacklinks, buildGraph…
6. 23 acceptance flows the result is graded against

## Reuse checklist
- [ ] Swap the mission paragraph
- [ ] Rewrite the acceptance flows for the new feature
- [ ] Keep the effort split line — it prevents gold-plating old screens

Related craft: [[prompt-engineering-review-pass|Prompt — Engineering Review Pass]] · index: [[fable-build-prompts|Fable Build Prompts]]
