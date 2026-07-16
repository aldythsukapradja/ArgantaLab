---
title: F4 — Voice Matrix
product: Arganta (all brands)
type: strategy
status: draft
version: 0.1
tags: [brand, voice, tone, buddy, bilingual]
date: 2026-07-16
owner: Aldyth
strategy_owner: Fable
confidence: high
---
# F4 — Voice matrix & editorial guide

Absorbs handoff §08. Home field: `voice.persona` per brand (via `brand_update`). Shared rules first, then the five voices, then Buddy.

## Shared editorial rules (all brands)

Sentence case. Contractions. Active voice, verb first. Short sentences; concrete nouns beat clever adjectives. One emoji max per line, zero in error messages. EN reading level ≈ age 10 for kid-facing, ≈ smart-friend for adults. ID copy is written natively, never machine-translated tone ("kamu" for kids/families, "Anda" only in legal/press). Numbers honest, always.

## The five voices

| | Sounds like | Never sounds like | Error tone | Celebration tone |
|---|---|---|---|---|
| **Arganta** | a founder showing you the workshop | a venture fund, a keynote | plain + fix-first | quiet pride: "shipped." |
| **ArgantaLab** ("The Lab") | inventive, slightly mysterious, encouraging | a teacher grading, an AI agency | "the Lab hiccuped — try again" | "YOU built that. 🚀" |
| **Kinetik Circle** | the calm friend who has the plan | a boss, a tracker, a guilt-trip | "that didn't save — one more try" | warm: "the week is together." |
| **LashiraBloom** | a storybook narrator at dusk | a grind-game announcer | soft, in-world: "the wind took that one" | gentle wonder: "look what grew." |
| **Circle HQ** *(internal)* | a precise chief of staff | marketing, hype | exact cause + next action | none — a green checkmark is enough |

**Preferred verbs:** build, ship, grow, plant, gather, plan, play, learn, bloom. **Banned vocabulary (all):** leverage, seamless, empower, unlock, revolutionize, "simply/just/easy", gamify (say "make it a game").

## Buddy — ArgantaLab's character (`repo-verified`: `avatar/Buddy.tsx`)

**Role:** the Lab's companion — a maker-mascot who *builds alongside* the kid, never a teacher above them. Buddy demonstrates, cheers, and fails cheerfully in public ("my tower fell over too — rebuild?").
**Voice:** first person, ≤12 words a line, curious > corrective. Buddy never says "wrong"; Buddy says "almost — try the other one."
**Boundaries:** Buddy never sells, never guilt-nudges about streaks, never speaks to parents (the Lab's adult voice does), and never appears outside ArgantaLab surfaces without founder sign-off.
**Visual:** locked to the existing in-app look; ChatGPT's P0 character sheet extends poses/stickers, does not redesign ([[ChatGPT Visual Production Handoff]]).

## Before → after (calibration examples)

- ❌ "Oops! Something went wrong! 😅" → ✅ Lab: "The Lab hiccuped. Your build is safe — try again."
- ❌ "Don't forget to complete your daily tasks!" → ✅ Circle: "Two things left for today — want them now or tonight?"
- ❌ "Unlock premium features to empower your learning journey!" → ✅ Lab: "Want more rooms in the Lab? Here's what the family plan adds."
- ❌ ID: "Jangan lupa menyelesaikan tugas harianmu!" → ✅ Bloom: "Ladangmu kangen. Ada dua bibit siap panen. 🌾"

Related: [[F3 — Messaging Library]] · [[F7 — Adoption & Lifecycle]]
