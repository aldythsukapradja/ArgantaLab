---
date: 2026-07-18
tags: [arganta, audit, logo, design, brand]
title: Logo & Design Philosophy Audit
---

# Logo & Design Philosophy Audit

Audited from the actual assets: `apps/landing/public/icon.svg` (+ favicon/maskable variants), the `@arganta/brand` mark system (`packages/brand/src/mark.js`), and the multi-brand registry.

## What the current logo is

A white geometric letter **"A"** (crossbar, rounded caps) on a rounded-square tile filled with a **blue → purple → pink diagonal gradient** (#4D9FFF → #8B5CF6 → #FF5EA0), with a glossy radial highlight and drop shadow.

## Verdict: competent execution of the wrong idea

**Craft: fine.** Clean geometry, proper maskable/favicon variants, deterministic SVG. No embarrassment at app-icon size.

**Strategy: it contradicts every brand decision this audit has made.**
1. **It is the 2024–26 "AI gradient" uniform.** Blue-purple-pink glassy tiles are the default costume of a thousand AI tools. Your own wedge doc says *"NOT glowing AI brains"* — this is the flat-icon version of a glowing AI brain. It signals *tech product* to exactly the audience ([[01-Vision-Critique]] ICP: overloaded parent) that is tired of tech products.
2. **Zero warmth, zero family, zero story.** Nothing in it says home, memory, care, or whiteboard. It is interchangeable with a crypto wallet's icon. Against [[04-Emotional-Brand-Audit]] (morning-kitchen light) and [[10-Brand-UIUX-Battle-Test]] B2 (whiteboard as the central metaphor), it fails on arrival.
3. **The "A" does no disambiguation work.** A lone geometric A doesn't aid recall of "Arganta" (B1's pronunciation problem) and collides with a crowded field of A-marks (Arc, Anthropic-adjacent marks, countless AI apps).
4. **Fragmented identity downstream:** kinetik ships its own separate icon; the brand registry still models five brands. Post-consolidation ([[03-Gap-Analysis]] G9) there must be ONE mark family.

## What is genuinely excellent and must be kept

**The mark *system* is better than the mark.** `@arganta/brand`'s philosophy — logos as deterministic geometry-data rendered identically to canvas (social posts) and SVG (press kit), "pixel-identical forever, diffable in git," theme-agnostic tokens — is professional-grade brand infrastructure most seed startups don't have. **Keep the system; replace the payload.** A redesign is: author one new shape-list, and every carousel, favicon, and press asset updates in lockstep. The redesign is cheap *because* of this system.

## Design philosophy — stated vs. practiced

| Source | Philosophy |
|---|---|
| Wedge doc (stated) | Warm · minimal · human · Apple/Pixar · not cyberpunk |
| Repo (practiced) | Cinematic · dark · gradient · reactor-glow · Jarvis |
| Current logo | Practiced, not stated |

The logo is evidence for [[10-Brand-UIUX-Battle-Test]] U5: the cockpit DNA leaks into everything by default. The redesign is the moment to install the family design tokens as law.

## Redesign brief (hand this to the future design pass — do NOT start tonight; it's a week-9 task, not a week-1 task)

- **Concept direction (pick via 3 candidates, test on pilot parents):**
  1. **The Whiteboard Mark** — an "A" formed from two hand-drawn marker strokes, or a rounded whiteboard tile with a marker-written A; ties directly to the brand device and no one else can claim it.
  2. **The Hearth/Roof A** — the A as a roofline sheltering a small warm dot (the family/memory); house-warmth without the clip-art house.
  3. **The Knot/Thread A** — one continuous line forming the A (threads of family memory tying together); pairs with "your family, remembered."
- **Palette:** kill the tri-gradient. One warm primary (candidate: warm coral/terracotta or deep warm green) + cream/off-white ground + charcoal ink; flat or near-flat, no gloss, no shadow theater. Must sit calmly on a phone home screen next to WhatsApp and Photos — that grid is the actual competitive landscape of a family app icon.
- **Type:** humanist rounded sans for the wordmark (approachable, kid-adjacent without toyish); test "Arganta" set with a slightly emphasized "Argi" head per [[10-Brand-UIUX-Battle-Test]] B1 nickname plan.
- **System deliverables (all through @arganta/brand):** app icon, favicon, wordmark, social avatar, watermark for reveal-cards, whiteboard-texture variant for the launch film. Kinetik's separate icon retires; Kids Workspace gets a *variant* (same mark, playful token set), not a different logo.
- **Acceptance test:** show 5 pilot parents the icon among 8 family/AI app icons — it must be (a) findable, (b) described with a warm word not a tech word, (c) not described as "an AI app."

## Sequencing (so this doesn't become procrastination)
Weeks 1–8: current logo is *fine to launch the pilot with* — do not let a rebrand delay users. Week 9–10 (alongside launch-film production, [[13-Social-Media-Strategy]]): run the 3-candidate redesign and ship it with the public launch, so the film, grid, and icon debut as one coherent identity.

Index: [[00-Arganta-Audit-Executive-Summary]] — dossier notes 00–15.
