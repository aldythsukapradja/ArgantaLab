---
title: Prompt — Engineering Review Pass
product: HQ
type: prompt
status: living
tags: [prompt, engineering, review]
date: 2026-06-12
owner: Aldyth
confidence: high
---
# Prompt — Engineering Review Pass

Standard review pass for agent-built features across the Arganta repos.

## Prompt body
> Review the diff feature-first: (1) do the acceptance flows work end-to-end, (2) is state local-first and resilient to reload, (3) any fake buttons or dead UI, (4) type-check and build clean, (5) does it leak scope into unrelated modules. Report only defects you verified, ranked by user impact. No style nits unless they break the design system.

## Grading
- A finding without a reproduction is an opinion
- Scope-leak findings outrank style findings, always

Index: [[Fable Build Prompts]]
