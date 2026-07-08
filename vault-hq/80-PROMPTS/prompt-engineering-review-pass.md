---
title: Prompt — Engineering Review Pass
product: HQ
type: prompt
class: operational
status: active
canonical: true
version: v1
updated: 2026-06-12
owner: aldyth
confidence: high
domain: [arganta, ai-context]
tags: [prompt, engineering, review]
related:
  - "[[fable-build-prompts]]"
---

# Prompt — Engineering Review Pass

> [!success] 🟢 CANONICAL v1 · HQ · updated 2026-06-12

Standard review pass for agent-built features across the Arganta repos.

## Prompt body
> Review the diff feature-first: (1) do the acceptance flows actually work end-to-end, (2) is state local-first and resilient to reload, (3) any fake buttons or dead UI, (4) type-check and build clean, (5) does it leak scope into unrelated modules. Report only defects you verified, ranked by user impact. No style nits unless they break the design system.

## Grading
- A finding without a reproduction is an opinion
- Scope-leak findings outrank style findings, always

Index: [[fable-build-prompts|Fable Build Prompts]]
