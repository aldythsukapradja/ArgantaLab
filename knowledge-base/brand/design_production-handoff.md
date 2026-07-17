---
title: ChatGPT Visual Production Handoff
product: Arganta (all brands)
type: handoff
status: active
tags: [brand, chatgpt, visual, production, handoff]
date: 2026-07-16
owner: Aldyth
confidence: high
---
# Visual production handoff — for ChatGPT

> **How to use:** paste this whole document into ChatGPT. It answers the "Fable Master Handoff" (2026-07-16) with the strategy verdicts already applied, and specifies exactly what visual output the Arganta Brand OS can ingest. Everything here is `founder-locked` or `repo-verified` unless marked otherwise.

## 1 · Your role and hard boundaries

You produce **visual assets and visual concepts only**. Strategy, naming, copy and taglines are decided (owner: Fable + founder). Implementation is Claude Code's.

You must NOT:
- Redesign, rename or "improve" the **ArgantaLab logo** — it is locked, in public use, and already canonized in code pixel-perfectly.
- Bake **text into any social/feed background** — the pipeline composites all copy onto solid Quest-Gold plates at render time; baked-in text is this system's known #1 failure. (Press/deck/badge assets MAY carry text — they're listed separately.)
- Produce photorealistic **children's faces** in any style, ever. People appear as silhouettes, hands, or from behind — secondary to the thing they made.
- Invent traction, partners, users or metrics in any mockup.

## 2 · The locked portfolio (public names)

| Brand | Public name | Domain | One line |
|---|---|---|---|
| Masterbrand + gateway | **Arganta** | www.arganta.app | "Grow together." — invites families, founders, partners |
| Kids create | **ArgantaLab** | lab.arganta.app | "Play. Learn. Build. **Ship.**" (Ship stays — locked) |
| Family rhythm | **Kinetik Circle** | circle.arganta.app | "Family life, in rhythm." |
| Shared world | **LashiraBloom** | bloom.arganta.app | "Grow a world together." |
| Internal founder OS | **Circle HQ** | hq.arganta.app | "Complexity into clarity." (internal-only) |

Kingdom is parked. "The Bridge"/`apps/landing` is infrastructure, never a public brand. Prototype journey name: "Arganta Spark" *(working — "Arganta Seed" is under consideration; don't letterform either yet)*.

## 3 · The one technical constraint that shapes everything

**Logos become code.** Every final mark is transcribed into declarative geometry (`brand.json`) and rendered by one engine onto every slide, favicon and export — that's how ArgantaLab's cube stays pixel-identical everywhere. So for each NEW mark you propose:

- Compose from **primitive shapes**: rounded rects, circles, polygons, lines. ≤ ~12 shapes.
- **≤ 2 gradients**, linear or radial, with explicit hex stops.
- Deliver as clean **SVG** (no filters, no masks, no raster effects) + a 1024px PNG preview.
- Filters/glows are presentation-only — the core geometry must survive without them.

App icons, favicons and PWA graphics are then **derived in code** — do not produce them.

## 4 · ArgantaLab visual DNA (the house reference)

Palette: Night Ink `#070A12` · Core Blue `#4D9FFF` · Lab Purple `#8B5CF6` · Spark Pink `#FF5EA0` · Signal Cyan `#34E5FF` · Growth Green `#3DE08A` · Quest Gold `#FFC24B` · Soft White `#F8FAFF`. Signature: the cyan→blue→purple→pink diagonal gradient, used once per composition, on the subject — never as a wash behind text. Mood: "a late-night workshop inside a nebula" — one luminous constructed object, vast calm dark space, wonder + competence. Full art direction lives in the repo (`packages/brand/brands/argantalab/BRAND.md`); sibling brands should feel like **rooms in the same universe**, not clones.

## 5 · Required return format (so your work slots straight in)

For **each brand** deliver a pack:

1. **Art-direction paragraph** (≤120 words, prose): the brand's visual world — ground, light, geometry vocabulary, mood, forbidden clichés. This is machine-injected into every future image generation for that brand, so write it as generation guidance, not marketing.
2. **4–8 style-anchor reference images** (≥1024px, text-free) that define the world.
3. **Logo concepts** (new brands only): 3 directions each, per §3's geometry rules, with a one-line meaning rationale per direction.
4. **The queued assets** (§6), each: correct dimensions, text-free unless marked 📝, filename `brand-asset-variant.png`.

Provenance note per asset: tool used, AI-assisted yes/no, date — the founder's IP evidence log needs it.

## 6 · Production queue

### P0 — unblocks everything else
| Asset | Brand | Spec |
|---|---|---|
| Master logo concepts ×3 | Arganta | §3 rules; must sit comfortably *beside* the ArgantaLab cube as its parent |
| Art direction + refs ×4 packs | Arganta, Kinetik Circle, LashiraBloom, Circle HQ | §5.1–5.2 (ArgantaLab's exists) |
| Logo concepts ×3 each | Kinetik Circle, LashiraBloom, Circle HQ | §3 rules; Circle HQ may riff on its existing reactor-orb motif; Kinetik Circle's existing ring+satellite mark may be evolved, not discarded |
| **Buddy character sheet** | ArgantaLab | The in-app companion (repo-verified: `avatar/Buddy.tsx`). Poses ×6, expressions ×6, sticker set ×8 — matched to the existing in-app look, not reinvented |

### P1 — launch surface
| Asset | Brand | Spec |
|---|---|---|
| OG / link-card images ×5 | all | 1200×630, subject right third, **left two-thirds quiet** (wordmark composited later), readable at 300px |
| IG story/reel backgrounds ×3 per brand | public 4 | 1080×1920, focal middle band, lower third quiet, text-free |
| Social banners | Arganta (LinkedIn 1128×191, X 1500×500) | text-free zones per platform crop |
| Five-product family graphic 📝 | Arganta | one image explaining the ecosystem (text allowed) |
| "Made with / Built with Arganta" badges 📝 | Arganta | horizontal + square lockups |

### P2 — growth (after launch)
Campaign key art per product · LashiraBloom Kin character cards + world posters · Kinetik Circle family-rhythm key visual · press/deck title visuals 📝 · seasonal sets · app-store screenshot frames.

## 7 · What happens to your output

Founder approves → Claude Code canonizes marks into `packages/brand/brands/<id>/brand.json` (geometry as data), art direction into `kb.artDirection`, refs into `refs/` — after which every post, favicon and export renders from that single source, and the Brand Studio tab tracks each asset's status. Your pack is the input to a machine, which is why §5's format matters more than volume.

Related: [[Brand Handoff Battle Test]] · [[Brand OS]] · [[Brand — ArgantaLab]]
