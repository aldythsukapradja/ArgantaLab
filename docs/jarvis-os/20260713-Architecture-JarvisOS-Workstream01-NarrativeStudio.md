---
title: Jarvis OS Workstream 01 - Narrative Studio
date: 2026-07-13
type: architecture
status: draft
project: Jarvis OS
workstream: 01
tags:
  - jarvis-os
  - circle-hq
  - deterministic-ai
---

# Jarvis OS Workstream 01 - Narrative Studio

> [!summary]
> Build the permanent storyboard and rehearsal environment used to lock the story before production.

## Mission

Separate fast narrative iteration from expensive Three.js and production React work.

## Core interface

Left/right scene navigation, Guided/Auto rehearsal, speaker labels, copy-ready ElevenLabs text, suggested narration, Aldyth notes, visual/component focus, popup/video placeholders, subtitles, audio preview and scenario export.

## Scene schema

```ts
type Scene = {
 id: string; act: string; title: string; purpose: string;
 speaker: 'JM'|'KF'|'AB'|'LG';
 elevenLabsText: string[]; voiceDirection: string;
 visual: string; componentFocus: string[];
 guidedBehavior: 'auto'|'hold'|'product-tour'|'vault-tour';
 autoMedia?: string[]; aldythNotes?: string;
 exitCondition: string; next?: string;
}
```

## Voice routing

Jarvis owns system/cards/Landing/HQ/Vault. Adult female owns Kinetik. Child male owns ArgantaLab. Child female owns LashiraBloom.

## Landing story

Landing must rehearse three jobs: explain Arganta, enable product discovery and open the solo-founder partnership pathway to KinetikCircle Apps/community testing/live launch.

## Controls

Arrow keys previous/next; Space play/pause; A Auto; G Guided; R replay; S scene selector; Escape exit.

## Outputs

`scenario.json`, audio manifest, video manifest, subtitles, presenter notes and speaker manifest.

## Effort

14–25 focused days; 300k–700k cumulative LLM tokens.

## Best delegation

Narrative lead: GPT-5.6 Thinking or Opus-class. UI implementation: Codex or Sonnet-class.

## Acceptance

Story can be changed without production code; Guided holds at every handoff; Auto runs end to end; every line is copy-ready and assigned to a speaker.