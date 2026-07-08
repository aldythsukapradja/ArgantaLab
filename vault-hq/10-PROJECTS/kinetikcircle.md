---
title: KinetikCircle
product: KinetikCircle
type: strategy
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-07
owner: aldyth
confidence: high
domain: [arganta, family]
tags: [product, family-os, pillar]
related:
  - "[[sensor-plan]]"
  - "[[circle-hq]]"
---

# KinetikCircle

> [!success] 🟢 CANONICAL v1 · updated 2026-07-07

> Family coordination OS. Part of the [[mental-model|UI/UX layer]].

## What it is
- Family OS: Today, Calendar, Moments, mini-apps, Circles/Connections/Friends. #known
- For my family — Kinara, Abdil, Keyla. #known

## Current state (July 7 pull)
- Core is live/green and RETAIN-flagged: Today, Calendar, Moments, mini-apps hub,
  Circles/Connections/Friends. Protect, don't touch. #known
- Mini-app batch confirmed all live/green: Travel, Padel, Kitchen, Vault. #known
- Blind: `sig.calendar_open_no_add` (the parent-hook health signal — Calendar itself is live,
  but "opened without adding" is unmeasured). #known
- Amber: `sig.invite_never_accepted` (partial) — flagged FIX, not instrument: the invite flow
  itself needs fixing; k-factor rides on it. #known

## Family-OS pillar — product strategy
> Merged from the seed pillar note. Strategic/product view; the sections above are the live operational state.

The household shell. Calendar, meals, chores, rituals — the boring-but-daily surface that earns the right to be opened every single morning. Inspired by (and stress-tested on) the founder's wife, the archetypal organizing parent.

### Position in the loop
KinetikCircle is the **entry pillar** of the [[product-loop|Product Loop]]: parents arrive for organization, then discover [[argantalab|ArgantaLabs]] for the kids and [[lashirabloom|LashiraBloom]] as the shared world. Founding call: [[decision-kinetikcircle-as-family-shell|Decision — KinetikCircle as Family Shell]].

### Beliefs
- The parent who plans the week is the **economic buyer** of the whole ecosystem.
- Utility first, delight second: streaks and gardens come *after* the calendar works.
- Family data never leaves the circle — trust is the moat. See [[market-research|Market Research]] for the competitor trust gap.

### Open threads (product)
- [ ] Minifarm hand-off into [[lashirabloom|LashiraBloom]]
- [ ] Weekly ritual → quest bridge with [[argantalab|ArgantaLabs]]

## Links
- Measured by: [[sensor-plan]]
