---
title: Brand Studio — Audit & Way-Forward
type: audit
updated: 2026-07-22
tags: [audit, brand-studio, hq]
---

# Brand Studio — Audit & Way-Forward

Audit of the HQ design surfaces (`apps/hq/src/surfaces/brand/` + `packages/brand`) against the new [[00-Home|design system]]. Back to [[00-Home]]. Verdict: **strong architecture, generic output, stale structure.**

## What's actually there (and worth keeping)
`BrandStudio.tsx` = 3 pills (BRANDING "fitting room" · OPERATOR "the method" · CINEMATIC "flight"). Genuinely good bones:
- ✅ **Registry-driven** — one source (`brand_registry` + `@arganta/brand` bases), everything derived.
- ✅ **Two-lane governance** — agent-lane (git: mark/palette) vs founder-lane (DB: text), enforced at write.
- ✅ **Provenance discipline** — rendered live by the *same* code that ships (`drawMark`, `drawSlide`); nothing simulated shown as real.
- ✅ **Kit export** — `compose.ts` renders every asset at spec size on demand.
Keep all of this. The problem isn't the engine — it's what the engine draws.

## Why it feels generic (the findings)
| # | Finding | Cause |
|---|---|---|
| **F1** | **Stale brand architecture** | `BRAND_ORDER = [arganta, argantalab, kinetikcircle, lashirabloom, circlehq]` — the *old 5 product-brands*. The new structure is **Arganta.ai → Life / Energy / Studio** (3 companies × 3 products). **ArgantaEnergy and ArgantaStudio don't exist here**; Kinetik/Lab/Lashira are now *products under Life*, not peer brands. See [[Brand-Architecture]]. |
| **F2** | **All-procedural = generic by construction** | Marks are canvas glyphs (`drawMark`), the "World" scene is flat color bands, "In the wild" posts are zero-asset `drawSlide` templates. No real logo, imagery, 3D, or photography — so it *cannot* look premium. |
| **F3** | **No reactor / no signature** | The unifying motif ([[The-Reactor]]) is absent. The master mark is a generic procedural glyph, not the 7-layer reactor. |
| **F4** | **Palette not unified** | Colors live per-brand in the registry, disconnected from [[Design-Language]] tokens (`@arganta/design-tokens`). Two sources of truth → drift. |
| **F5** | **"Executable style guide" is text-only** | `kb.artDirection` ships a *prompt paragraph* into generations, but isn't wired to real anchor **Elements/Souls** (see [[00-Home]] → DESIGN-COHERENCE). The loop is open. |
| **F6** | **No real content surface** | "In the wild" shows procedural slide mockups, not the real posts/reels the pipeline produces. |

**One-line diagnosis:** it's a beautifully-governed registry rendering the *wrong structure* with *no real assets*.

## Way-forward
| # | Move | Ties to |
|---|---|---|
| **WF1** | **Re-architect to the 3-company endorsed house.** `BRAND_ORDER = [arganta, argantalife, argantaenergy, argantastudio]`; each carries its 3 products. Migrate Kinetik/Lab/Lashira to products under Life. | [[Brand-Architecture]] |
| **WF2** | **Single palette source.** Registry reads `@arganta/design-tokens` — same tokens as apps, website, films. Kill the per-brand palette drift. | [[Design-Language]] |
| **WF3** | **Real assets replace procedural marks.** Add a registry asset slot (logo image, brand-world image) filled by the Higgsfield run; `drawMark` glyph becomes fallback only. Vectorize the master wordmark in-repo. | Higgsfield IB3, `TRIAL-RUN-QUEUE` |
| **WF4** | **Reactor as the signature.** Master mark + the "World" scene lead with the reactor motif, company-tinted rings — not color bands. | [[The-Reactor]] |
| **WF5** | **Close the executable-style loop.** `kb.artDirection` references the real anchor **Brand/Reactor/Energy Elements** so "ships into every generation" uses the actual reference, not just prose. | DESIGN-COHERENCE |
| **WF6** | **Real content in the Wild.** Feed the run's real posts/reels/films into the "In the wild" scene instead of `drawSlide` mockups. | [[Cinematic-Launch]] |

## Sequence & status
1. **WF1 — DONE ✅ (2026-07-22, 52/52 tests).** `packages/brand` re-architected to the endorsed house: `BRAND_ORDER` = `[arganta, argantalife, argantaenergy, argantastudio, circlehq]`; products moved under `MEMBERS`/`PARENT`; 3 company docs + GeaVision authored (reactor-ring marks, company lights on the shared ground). The Brand Studio constellation now auto-renders the **3 companies**, not the stale product brands. *(Opus set structure + exemplar; Sonnet authored the fill — verified.)*
2. **WF2 — PARTIAL.** New brands share the system ground + design-system accent hues, but the ground token is still `#15161B` (existing) vs the design-system `#0B0D12`. Remaining: extract `@arganta/design-tokens` as the single source and reconcile the ground across doc + registry.
3. **WF3 + WF4** — after the Higgsfield run: swap real logo/brand-world assets in; make the reactor the signature mark (procedural rings are the current fallback).
4. **WF5 + WF6** — wire the executable-style loop to the anchor Elements; put real posts/reels in "In the wild."
5. **UI drill-down** — wire `MEMBERS` so a company reveals its products in the constellation (mechanical — Sonnet-able).

Net: same great governance engine, now rendering the **right architecture**; real reactor-anchored assets land as the Higgsfield run delivers them.
