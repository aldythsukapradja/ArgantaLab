---
title: Jarvis OS Workstream 02 - Experience Engine
date: 2026-07-13
type: architecture
status: draft
project: Jarvis OS
workstream: 02
tags:
  - jarvis-os
  - circle-hq
  - deterministic-ai
---

# Jarvis OS Workstream 02 - Experience Engine

> [!summary]
> Build the deterministic runtime that orchestrates the real CEO Orb page.

## Preserve

Top bar, live status, six operating instruments, ReactorOrb, five product orbits, existing ProductDetail, live iframes and bottom dock.

## Runtime

`JarvisDirector` owns scene, mode, speaker, audio, subtitle, focused card, orb state, selected product, popup state, video phase, pause/resume, previous/next and recovery.

## Modes

Normal unchanged. Guided pauses for Aldyth. Auto explains cards and products, autoplays desktop/mobile recordings and continues.

## Instrument states

`normal`, `dimmed`, `focused`, `speaking`, `connected`, `alert` for World Reach, Weekly Engaged, Valuation Audit, Five Products, Access & Attention and Visit Rhythm.

## Popup extension

Add `Auto Demo` beside Overview/Desktop/Mobile. Auto sequence: metrics → desktop video → mobile video → summary → close. Guided keeps the live iframe under Aldyth control.

## Bottom-right rig

`MODE ▾  ←  PLAY/PAUSE  →  SCENE ▾  EXIT`, with current speaker and video phase.

## Media policy

Audio is master clock. Videos are silent. Subtitles remain a fallback. Any manual interaction in Auto pauses and offers Resume/Switch/Skip/Exit.

## First vertical slice

Boot → Jarvis → Five Products → ArgantaLab focus → popup → Guided takeover → resume; then add the same slice in Auto.

## Effort

28–49 focused days; 600k–1.3M cumulative tokens.

## Best delegation

Lead: Codex-class repository agent or Sonnet-class coder. Reviewer: GPT-5.6 Thinking / Opus-class.

## Acceptance

Normal remains intact; Guided and Auto recover cleanly; all six cards focus programmatically; popup/media synchronization works on desktop/mobile.