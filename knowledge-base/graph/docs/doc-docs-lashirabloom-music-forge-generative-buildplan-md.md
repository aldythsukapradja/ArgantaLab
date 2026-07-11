---
title: Music Forge — generative backsound engine
type: doc-node
product: HQ
status: current
verdict: current
tags: [doc, atlas]
date: 2026-07-11
---

# Music Forge — generative backsound engine

`docs/lashirabloom/music-forge-generative-buildplan.md` · verdict **current**

The generative music engine (MUSIC_THEMES, MusicTransport lookahead scheduler, euclidean rhythm + probabilistic pentatonic melody, 6 per-map themes) was ported into the shared @arganta/audio package.

**Lesson:** Chose generation-by-construction over CC0 asset files specifically to preserve the game's CSP-clean, zero-asset, embed-anywhere guarantee — the architecture constraint drove the creative choice, not the reverse.

In [[00-doc-atlas]] · product [[HQ]].
