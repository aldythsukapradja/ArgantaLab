---
title: Audio Studio
tab: music
status: built-stage0
tier_now: 0
complexity: 15 (L)
tags: [media-center, studio, audio]
---

# Audio Studio — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

## Analog

Suno / Udio (product) · **Meta MusicGen**, Strudel / Tone.js (OSS). Copy: a big
**waveform/spectrum visualizer** with transport + role lanes, and a one-click
**publish to the game music library**.

## Current state (stage 0 — built)

`localCompose(prompt)` → theme → `@arganta/audio` `MusicTransport` plays live
(Web Audio). Deterministic from the prompt. Stop control present.

## Target state

- **Visualizer:** spectrum/waveform (OfflineAudioContext render, like Music
  Studio's `Scope.tsx`) filling the stage.
- **Role lanes:** toggle pad/bass/lead/drums; edits apply live.
- **Publish:** `publishMusicLibrary(supabase, themes)` so the generated theme
  ships in-game.
- **Stage 3:** MCP `higgsfield.generate_audio` / ElevenLabs SFX, gated.
- **Voice sub-mode:** reuse `@arganta/video` `renderVoice(text)` for narration.

## Build steps

1. Port `Scope.tsx` visualizer into the Audio stage.
2. Add role-lane toggles bound to the theme.
3. Wire **Publish** → `publishMusicLibrary` (real, ships to games).
4. Add **voice** sub-mode (text → speech via `renderVoice`).
5. Register Stage-3 audio MCP adapter.

## Real data mapping

- `@arganta/audio` `MUSIC_THEMES`, `ACTIVE_THEMES` — the real in-game library.
- `publishMusicLibrary` — writes the live theme consumed by [[../../lashirabloom|LashiraBloom]] + Kingdom.
- `classical.js` pieces — anthem presets.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 3 | transport + compose + publish |
| Data | 3 | live music library write |
| UI | 3 | visualizer + lanes + transport |
| Providers | 3 | premium audio MCP + fallback |
| Infra | 3 | publish pipeline, autoplay gesture |

**Total 15 / 25 → L · ~13 pts**

## Dependencies

[[Spine]] · `@arganta/audio` · `@arganta/video` (voice) · [[Music Builder]] (shared engine)
