---
title: Arganta Visual Production Handoff v2
type: handoff
status: proposal — awaiting founder approval
date: 2026-07-17
owner: Aldyth
produced_by: Claude (art-director workspace)
ai_assisted: yes, human-directed
supersedes: design_production-handoff.md (asset sections only; role/boundary rules unchanged)
---
# Visual production handoff — v2 (full identity reinvention)

Founder unlocked everything on 2026-07-17 ("nothing locked, maximum creativity"). This pack replaces the previous marks with the **monoline constellation system**. Review canvas: `Arganta Universe Canvas.dc.html` (sections 4a > 3a > 2a > 1a, newest first).

## 1 · Universe DNA — "One sky, five constellations"
Vocabulary: **node** (star: person/idea/artifact) · **strut** (relationship, 2.5px round cap) · **orbit** (rhythm) · **spark/accent star** (the made thing — exactly one per composition).
Grounds: Night Loam `#15161B` (strip render `#101116`) · Starpaper `#F2F1EC`. Strokes: `#C4C9D4` on dark, `#3A3D45` on light — geometry is theme-agnostic (currentColor).

## 2 · Palette — "One light, five wavelengths"
One oklch recipe (L 0.76, C 0.13), hue rotated. Approx hex + gradient stops (the single allowed gradient per mark):
| Brand | Accent | Hue | Hex | Gradient |
|---|---|---|---|---|
| Arganta | Ember | 70 | #DCA254 | #DCA254 → #8F6B3C |
| ArgantaLab | Volt | 245 | #7BAEE8 | #7BAEE8 → #4C7BB8 |
| Kinetik Circle | Pulse | 350 | #EC93B5 | #EC93B5 → #B85F84 |
| LashiraBloom | Leaf | 150 | #6EC492 | #6EC492 → #3E8F63 |
| Circle HQ | Signal | 295 | #AF9BE8 | #AF9BE8 → #7A66BC |

## 3 · Type
- Wordmarks & product display: **Space Grotesk 500**, uppercase, letterspacing 0.12–0.18em
- Masterbrand editorial voice: **Source Serif 4** (belief headlines, press, build log)
- Provenance/specs: mono stack

## 4 · The five marks (final geometry in assets/)
All ≤7 primitives, ≤1 gradient, no filters/masks — transcribe directly into `packages/brand/brands/<id>/brand.json` `identity.mark`.

| id | Mark | Philosophy (KB-grounded) |
|---|---|---|
| arganta | Twin Peaks A — two interlocked A's, star at younger apex | "One substrate; the spine is the company" (00-MASTER-KB §0). Overlap = shared account/economy/world. Gradient A = the one being raised. Master promise: Grow together. |
| argantalab | Wire Cube — hexagon wireframe, gradient top face, summit star | "Engine with surfaces, not a destination app" (decision-argantalabs-as-learning-engine). Lid a kid opens; summit star = ship moment ("artifact + reward seen"). |
| kinetikcircle | Resonance Rings — outer ring, broken middle ring, gradient core, star on orbit | Identity model is literally a circle (circleId/personId, never familyId). Broken ring = participation, not tracking (vs Life360 posture, F2). |
| lashirabloom | Bloom — five wireframe leaves, gradient center leaf, seed-star at root | Retention world = sunk emotional value a family accumulates. Center leaf = newest growth fed by kids' learning; seed waits politely (no rot timers). |
| circlehq | The Bridge — ring of six office-nodes, founder star center, one signal strut | "27 agents → six offices"; read-only cockpit ("a cockpit is not an engine"); reads one honest signal at a time. **Locked** (founder 2026-07-17); Gauge & Aperture alternates archived on canvas 4a. |

## 5 · Art direction (→ kb.artDirection, verbatim)
See canvas section 4a for the five ≤120-word generation paragraphs (Arganta, ArgantaLab, Kinetik Circle, LashiraBloom, Circle HQ). Shared laws: one accent per composition; people as silhouettes/hands/from-behind; never children's faces; pipeline backgrounds text-free (postEngine composites copy); no neon washes, no gradient text plates, no invented traction.

## 6 · Model routing (agreed 2026-07-17)
- Art direction, marks, applied surfaces, this pack → **Claude art-director workspace (Opus-class)**
- SVG → brand.json transcription, engine wiring → **Claude Code (Sonnet)** — mechanical, schema-bound
- Style-anchor reference images → **image model** (Higgsfield/MJ) prompted with §5 paragraphs
- Caption/hashtag/CTA banks, EN↔ID expansion, alt-text → **Sonnet batch**, 10% founder spot-check
- Naming/tagline re-verdicts (e.g. Spark vs Seed) → **Fable/Opus**, only if triggered

## 7 · Provenance log
| Asset | Tool | AI-assisted | Date |
|---|---|---|---|
| Universe DNA (canvas 1a) | Claude workspace | yes, human-directed | 2026-07-17 |
| 15 constellation directions (2a) | Claude workspace | yes, human-directed | 2026-07-17 |
| Monoline fusion set (3a) | Claude workspace, from founder reference strip | yes, human-directed | 2026-07-17 |
| Philosophy grounding + HQ alternates (4a) | Claude workspace, sources: knowledge-base/* @main | yes, human-directed | 2026-07-17 |
| 10 final SVGs (handoff/assets/) | Claude workspace, hand-authored geometry | yes, human-directed | 2026-07-17 |

## 8 · Open decisions for the founder
1. ~~Circle HQ mark~~ — **Bridge locked** (founder, 2026-07-17)
2. Approve the five art-direction paragraphs → canonize to kb.artDirection
3. Buddy character sheet still pending an in-app reference render
