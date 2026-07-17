---
title: The Method
product: Arganta (all brands)
type: canon
status: living
version: 1.0
tags: [brand, design, method, canon, mental-models]
date: 2026-07-17
owner: Aldyth
strategy_owner: Fable
confidence: high
---
# The Method — Arganta's design canon

> **Make it data. Render it live. Name the gap. Spend boldness once.**

Twenty laws in five families. This is the single source of truth for how Arganta designs — not a style guide of swatches, but the **mental models** that decide every call. It is the page a designer, an agency, an investor or a fresh AI session reads to become fluent in the system in three minutes.

Two rules govern the canon itself:
1. **A law is only real if it can be demonstrated.** Every law below names the file that *enforces* it. If a law has no enforcement site, it is an aspiration and must be marked as one.
2. **The reference values are read from live code, never transcribed.** A design system you maintain by hand is a design system that lies — the same reason [[#II · Determinism|Law 08]] exists.

Rendered by Circle HQ → Brand Studio → **Operator** tab. The [[Brand Studio Design Spec|cinematic brand book]] is the second pill.

---

## I · Truth
*How we relate to reality. The family that makes everything else believable.*

**01 · Measured or marked.**
Every number carries its provenance. Simulated never wears measured's clothes.
`repo-verified` · Architecture v2 provenance badges; `agent_runs` ledger.

**02 · Never flatter.**
An undesigned thing scores zero. `blankBrand()` ships nulls, not placeholder greys, because a brand nobody has designed must not report progress.
`repo-verified` · `packages/brand/src/schema.js` → `blankBrand`

**03 · The demo is real.**
Embed the live thing. A mockup is a lie with good lighting — the landing deck embeds running apps; the brand book renders real carousels with the code that publishes them.
`repo-verified` · `apps/landing/src/stage/scenes.tsx` → `AppEmbed`; `surfaces/brand/scenes.tsx` → `LivePost`

**04 · Name the gap first.**
`MARK · P0`. `AWAITING VOICE`. `link — unverified`. Say what is missing before anyone else finds it. Honesty is a feature of the surface, not an apology.
`repo-verified` · `packages/brand/src/registry.js` → `matrix()`

---

## II · Determinism
*How things are made. The family that makes the system cheap to change.*

**05 · Marks are code.**
Geometry, not pixels. Diffable, infinitely scalable, identical forever. A logo is data in a viewBox — never an AI raster, never hand-copied twice.
`repo-verified` · `packages/brand/src/mark.js`; `brands/<id>/brand.json` → `identity.mark`

**06 · One source, two renderers.**
Canvas and SVG draw the same data, so they cannot drift. Proven, not claimed: every transcribed mark measures **0.0000%** against its source artwork.
`repo-verified` · `drawMark()` / `markToSvg()`

**07 · Data over hardcode.**
Brand six is a document, never a commit. Proof: handoff v2 replaced every mark, every palette and the typography — and cost **zero surface code**.
`repo-verified` · `packages/brand/src/index.js` → `BRAND_ORDER`

**08 · The audit derives.**
A checklist you maintain is a checklist that lies. Add one platform spec and every brand re-audits itself on the next render. *(This law is why the old Operator dashboard is now a specimen rather than a page.)*
`repo-verified` · `registry.js` → `readiness()` / `matrix()` ← `specs.js`

---

## III · Motion
*How it moves. The family that makes it feel like a place.*

**09 · Fly, don't scroll.**
Scenes are positions in space; the camera travels between them. Scroll is a document metaphor — this is a cockpit.
`repo-verified` · `apps/landing/src/stage/registry.tsx`; `brand-studio.css` → `.bs-camera`

**10 · Reveal on arrival.**
Nothing is merely *there*. A ring fills, a line rises — but only when the camera lands on it.
`repo-verified` · `apps/landing/src/stage/active.tsx` → `useIsActive`; `.bs-scene.in`

**11 · Ignition.**
A system announces itself once, then gets out of the way. Every ignition is skippable — ceremony that cannot be skipped is a toll.
`repo-verified` · `.bs-ignition`; Landing reactor ignition

**12 · Reduced motion is a path, not a fallback.**
The same scene, 160ms fades, nothing lost. Someone who turns motion off is not a second-class viewer.
`repo-verified` · `@media (prefers-reduced-motion: reduce)` in `brand-studio.css`

---

## IV · Surface
*How it looks. The family with the tightest constraints, on purpose.*

**13 · Cockpit chrome.**
7–9px mono micro-labels, `.14–.3em` tracking, cyan instrument eyebrows, and a status vocabulary (`LIVE SIGNAL` · `AWAITING SIGNAL` · `CONNECTION REQUIRED` · `REGISTRY · SEED`). Instruments, not decoration.
`repo-verified` · `apps/hq/src/surfaces/landing.css` → `.ld-*`

**14 · One accent per composition.**
Spend boldness once. One light, five wavelengths: a single oklch recipe (L .76, C .13) hue-rotated per brand — shared ground, different hue, so five products read as one company.
`repo-verified` · handoff v2 §2; `brands/*/brand.json` → `identity.palette.accent`

**15 · The plate rule.**
Copy never floats on artwork. Every generated line rides a solid plate — because bare white text vanished into a real generated background, and that failure is now structurally impossible.
`repo-verified` · `postEngine.ts` → `drawTextLayer` / `platePaint`

**16 · Dark ground, one lit subject.**
Vast calm negative space; the subject is lit from within; the void carries weight. Never stock photography, never a neon wash.
`kb-declared` · `brands/argantalab/BRAND.md` → art direction *(v2 replacements pending — battle-test M1)*

---

## V · Voice
*How it speaks. The family that keeps automation from sounding automated.*

**17 · Show finished things.**
The build log is the pitch. Never promise what has not shipped; never invent traction, users or partnerships.
`founder-locked` · [[F1 — Brand Foundation & Architecture]]

**18 · Silence over nonsense.**
A brand with no voice claims no persona. Telling a model to "write as X" with no idea what X is produces confident nonsense — worse than a generic voice.
`repo-verified` · `packages/brand/src/voice.js` → `voiceBlock()`

**19 · Specificity is the warmth.**
One real kid's creation beats any adjective. A post that could have been about any product is off-brand no matter how correct the colours are.
`founder-locked` · [[F5 — Social & Content OS]] → touchy rules

**20 · Never a child's face.**
Silhouettes, hands, or from behind — and always secondary to the thing they made.
`founder-locked` · [[F4 — Voice Matrix]]; every generation brief

---

## Reference

Values live in code and are read at render time — this section names *where*, never *what*.

| Family | Source of truth |
|---|---|
| Geometry | `brands/*/brand.json` → `identity.mark` (viewBox 120 · strut 2.5 · ≤1 gradient · exactly 1 accent star) |
| Colour | `identity.palette` + `identity.accents`; grounds Night Loam `#15161B` / Starpaper `#F2F1EC`; struts `#C4C9D4` / `#3A3D45` |
| Type | `identity.fonts` — Space Grotesk 500 (display) · Source Serif 4 (editorial) · mono (provenance). **Not yet embedded** — battle-test M6 |
| Motion | `brand-studio.css` → `--bs-fly` (820ms `cubic-bezier(.22,.9,.3,1)`), reveal 700ms, stagger 80ms, drift 26s |
| Chrome | `landing.css` → `.ld-*` |
| Lanes | `packages/brand/src/lanes.js` — agent (git): mark · palette · templates; founder (DB): voice · spine · bios |

## Known aspirations (not yet enforced)

Marked honestly per rule 1 — a law with no enforcement site is an aspiration:
- **16** has no v2 art direction yet (M1), so it is `kb-declared`, not `repo-verified`.
- **17 · 19 · 20** are enforced by review, not by code. When the caption pipeline gains a linter, they graduate.

Related: [[Brand OS]] · [[Brand Studio Design Spec]] · [[Handoff v2 Battle Test — the monoline constellation]] · [[F4 — Voice Matrix]]
