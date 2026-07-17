---
title: Handoff v2 Battle Test — the monoline constellation
product: Arganta (all brands)
type: review
status: living
version: 1.0
tags: [brand, battle-test, handoff, marks, design]
date: 2026-07-17
owner: Aldyth
strategy_owner: Fable
confidence: high
---
# Battle test — Visual Production Handoff v2

Source: `Downloads/Design production handoff.zip` → `handoff/HANDOFF-v2.md` + 10 SVGs (5 brands × dark/light), produced by the Claude art-director workspace 2026-07-17. Tested against the shipped Brand OS (`packages/brand`), postEngine, and the deployment surfaces the marks must actually survive.

## Verdict

**Accept the system. It is a genuine level-up.** The monoline constellation is coherent, philosophically grounded in the real KB (not invented), and the one-oklch-recipe palette is the first thing in this project that makes five brands feel like one company without making them identical. Three things block transcription and four deliverables are missing — none fatal, all specific.

**The architectural vindication:** a *total identity reinvention* — every mark, every palette, the typography — costs **zero surface code**. It is edits to five `brand.json` files and one engine capability. That is what the registry was for.

## ✅ What's excellent

1. **Philosophy is KB-grounded, not decorative.** Twin Peaks A ← "one substrate" (00-MASTER-KB §0). Wire Cube ← "engine, not destination app" (decision-argantalabs-as-learning-engine). Resonance Rings' *broken* ring ← "participation, not tracking" (F2's anti-Life360 posture) — the break literally encodes the strategy. Bloom's "seed waits politely (no rot timers)" ← the no-dark-patterns rule. This is the rarest thing in brand work: geometry that argues.
2. **One light, five wavelengths.** A single oklch recipe (L .76, C .13) hue-rotated is a *system*, not a swatch set — it guarantees equal perceptual weight across brands. Systematically better than the old ad-hoc per-brand palettes.
3. **Constraint discipline** — ≤1 gradient, no filters/masks, theme-agnostic geometry with only the stroke token swapping (verified: dark/light files are byte-identical apart from the stroke hex). This is exactly the "marks are code" contract, met.
4. **Model routing (§6) is right** and matches how this project actually works.
5. **Provenance log (§7)** — ships F8's requirement without being asked.

## ⛔ Blockers — the engine cannot draw 3 of 5 marks today

`mark.js` supports `roundRect · polygon · line · circle · group`. Measured against the delivered SVGs:

| Mark | Primitives | Uses | Transcribes today? |
|---|---|---|---|
| arganta | 4 | 2 closed polygons + circle | ✅ yes |
| circlehq | 10 | circles + line | ✅ yes *(pack claims ≤7 — it is 10; harmless, but the claim is wrong)* |
| argantalab | 6 | **2 open polylines** (`M28 37 L60 56 L92 37`) | ❌ `polygon` auto-closes → phantom edge |
| kinetikcircle | 5 | **elliptical arc** (`A24 24 0 1 1 …`) | ❌ no arc support |
| lashirabloom | 8 | **5 quadratic béziers** (`Q…`) | ❌ no curve support |

Also unsupported: `stroke-linecap` (used by kinetikcircle + lashirabloom).

**Fix (small, one-time):** add a `path` shape kind backed by **`Path2D(d)`** — browsers rasterize the same path data the SVG does, so canvas and SVG stay pixel-identical by construction, and *any* future mark works forever. Two riders: `strokeLinecap`, and an explicit `bbox` per path (Path2D exposes no bounds, and gradients resolve against `objectBoundingBox` — the exact subtlety that already bit us once in BF-2).

## ⛔ The size ladder — the marks die where they live

Measured, not asserted (see the size-ladder artifact): at a 120 viewBox, a 2.5px stroke is **2.08% of the mark**.

| Deployment | Rendered stroke | Accent star (r=4) | Verdict |
|---|---|---|---|
| 1024px pack | 21px | 34px | ✅ beautiful |
| 128px | 2.7px | 4.3px | ✅ holds |
| **40px — the Instagram avatar** | **0.83px** | **1.3px** | ⚠️ grey mush; the star vanishes |
| **16px — favicon** | **0.33px** | **0.5px** | ❌ gone |

The outgoing Lab Core cube was a *filled gradient tile* — it survived a circular 40px crop by construction. The incoming monoline system is strictly more beautiful at 1024 and strictly worse at 40. **A brand system is judged at its smallest deployment, not its largest.**

This is not a reason to reject the system — it is a reason to finish it. Every serious identity has a **responsive mark ladder**: `full → compact → glyph`. Needed:
- **compact** variant per brand (fewer struts, thicker relative stroke ~4–5px @120) for 24–96px
- **glyph** variant (the single most ownable element — Bloom's leaf, Lab's cube summit, HQ's centre star) for ≤24px
- **avatar lockup**: the mark on a **Night Loam disc/tile**. A naked monoline mark on transparency inherits whatever Instagram puts behind it — and an avatar is ONE file that must work on both light and dark feeds. Undecidable without a ground.

## ⚠️ The plate gap — the new palette has no text plate

postEngine composites every line of copy onto a solid plate (the yellow-pill rule). The v2 palette defines grounds, strokes and five accents — **no plate colour** — and §5 bans "gradient text plates" without naming the solid replacement. The engine default is `#FFD64B`, a bright electric yellow that will look *wrong* against Ember/Volt/Pulse/Leaf/Signal (all L .76, C .13 — muted, sophisticated). Left unspecified, every post ships with a plate from the old system.

Needs: **one plate token per brand** (my recommendation: Starpaper `#F2F1EC` with Night Loam ink — a paper plate suits the monoline/editorial world far better than a yellow highlighter), founder-approved.

## ⚠️ Consequences the pack doesn't mention

1. **The ArgantaLab lock is revoked** — "nothing locked, maximum creativity" reverses the standing decision. Real cost, worth taking consciously: F8 names @argantalab's live IG use (2026-07) as the **strongest first-use evidence** in the portfolio. Replacing the cube **resets that clock** and orphans the mark on every live post, the profile, and the 6 highlight covers. Do it — the new system is better — but log it as a superseding decision, and re-do the avatar/highlights in the same pass.
2. **Every existing draft carries the old identity.** The 3 drafts in HQ's inbox and the pack's covers are pre-v2. They re-render correctly after transcription (the registry is the source) — but the *uploaded* IG assets don't.
3. **Fonts are named, not shipped.** Space Grotesk 500 + Source Serif 4 — the readiness check "fonts embedded in engine" is FALSE, so postEngine silently falls back to system-ui. Naming a face and shipping it are different jobs; without woff2 files self-hosted, the typography is decorative only.

## ❌ Missing — what must come back from the design workspace

| # | Missing | Why it blocks | Owner |
|---|---|---|---|
| M1 | **The five art-direction paragraphs.** §5 says "see canvas section 4a" — **the canvas is not in the zip.** | `kb.artDirection` is the L0.5 payload injected into every image generation. Without it, generated backgrounds ignore the new world entirely | art-director workspace |
| M2 | **Compact + glyph variants ×5, and the avatar lockup** | the marks fail at 40px/16px (measured above) | art-director workspace |
| M3 | **Plate token ×5** | every post's legibility; the engine default clashes | art-director + founder |
| M4 | **Style-anchor reference images ×5** (≥1024px, text-free) | `kb.refs` — the consistency anchor for image-to-image | image model, prompted with M1 |
| M5 | **Buddy character sheet** (pack §8.3, still open) | ArgantaLab's character is repo-real (`avatar/Buddy.tsx`) and un-briefed | art-director + in-app render |
| M6 | **Font files** (Space Grotesk + Source Serif 4 woff2 + licence) | embedded ≠ named | founder / Sonnet |
| M7 | **Wordmark lockups** | pack gives marks only; §3 specifies wordmark type but no lockup geometry/spacing | art-director workspace |

## Model routing (accepting the pack's §6, with one correction)

| Work | Model | Why |
|---|---|---|
| `mark.js` path/Path2D/bbox/linecap extension | **Opus** | engine contract; the gradient-bbox subtlety already caused one bug. Not mechanical — the pack's §6 assigns "engine wiring" to Sonnet; I disagree for *this* file only |
| 5 SVG → brand.json transcriptions + pixel-diff verification | **Sonnet** | mechanical and schema-bound once the schema exists; a proven pixel-diff harness already exists |
| Palette/plate/type token swap across 5 brands + seed migration | **Sonnet** | data edits against a typed contract |
| Art direction, compact/glyph ladder, avatar lockups, wordmarks, Buddy | **Claude art-director workspace (Opus-class)** | taste work; the pack proves the workspace is good at it |
| Style-anchor refs | **image model** (Higgsfield/fal) | prompted with M1 verbatim |
| Caption/hashtag/CTA banks, EN↔ID, alt-text | **Sonnet batch**, 10% founder spot-check | volume with a spec |
| IP consequence (first-use reset), decision log, naming re-verdicts | **Fable/Opus** | judgement + narrative |

Related: [[Brand OS]] · [[Brand Studio Design Spec]] · [[Brand — ArgantaLab]] · [[F8 — IP & Provenance Program]] · [[ChatGPT Visual Production Handoff]]
