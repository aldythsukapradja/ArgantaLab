---
title: Scene Studio (3D)
tab: scene
status: built-stage0
tier_now: 0
complexity: 16 (L)
tags: [media-center, studio, scene, 3d]
---

# Scene Studio — Build Plan

Part of [[Media-Center-Build-Plan]] · shares the [[Spine]] · scored in [[Complexity-Model]].

## Analog

Spline / Bruno Simon (product) · **three.js editor**, R3F / **Threlte**, drei
(OSS). **Architecture to adopt:** *scene-as-data* — a JSON scene definition,
rendered by adapters (web / poster / mobile tiers), never component instances
(Fabric [[../Arganta-Marketing-Production-Fabric-CLEAN/20260713-Strategy-BattleTestAndGapClosure|gap 9]]).

## Current state (stage 0 — built)

`SceneCanvas.tsx` — a real R3F scene: brand-colored icosahedron core + wireframe
shell, orbit + auto-rotate. Guarded by the [[Spine]] error boundary (WebGL
context loss can't crash the hub).

## Target state

- **SceneDef JSON:** `{ camera, lights[], objects[], materials, timing }` — data,
  not JSX. `renderScene(def)` builds the R3F tree.
- **Quality tiers:** mobile / standard / cinematic (dpr, postprocessing).
- **Product constellation:** the real portfolio as orbiting nodes (reuse the
  `reactor` / `knowledge` spine).
- **Export:** an embeddable module + poster frame for [[Tab-Website]] / [[Tab-Deck]].

## Build steps

1. Define `SceneDef` + `renderScene(def)`; migrate the current core to a def.
2. Quality-tier switch (dpr + optional postprocessing bloom).
3. Constellation mode: map portfolio → node positions (reuse WS3 layout).
4. Export: serialize `SceneDef` + render a poster PNG.
5. Deterministic camera/timing for reproducible posters.

## Real data mapping

- `apps/hq/src/reactor` model + `apps/hq/src/knowledge` node layout.
- Portfolio products → constellation nodes.
- [[Tab-Brand]] tokens → materials/lighting.

## Complexity

| Dim | Score | Why |
|-----|:----:|-----|
| Engine | 4 | scene-as-data + R3F builder |
| Data | 3 | portfolio → node layout |
| UI | 4 | 3D viewport + tiers + inspector |
| Providers | 2 | none paid; optional gen-3D MCP |
| Infra | 3 | WebGL context budget, poster export |

**Total 16 / 25 → L · ~13 pts**

## Dependencies

[[Spine]] · `three` + R3F + drei · [[Jarvis Reactor WS2]] · [[WS3 Knowledge Nodes]] · [[Tab-Brand]]
