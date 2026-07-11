---
title: The Journey — start → baseline
type: journey-overview
status: living
date: 2026-07-11
tags: [arganta, journey, moc]
cssclasses: [wide-tables]
---

# 🧭 The Journey — 22 days, start → baseline

> [!abstract] What this is
> The development-*learning* spine, not a changelog. Eight phases from first commit (2026-06-19) to today's baseline (2026-07-11), each capturing what was **tried**, what **shipped**, what got **abandoned**, and what it **taught**. The lessons are the payload — they're what the next 22 days should carry forward.

> [!quote] The shape, in one line
> P0→P6 is compounding platform work; **P7 is not.** 96k LOC, one shared spine, five front-ends — and zero external users. The `.md` corpus is the fossil record of the thinking that got here: **58 of 130 docs shipped (fully or partial), 28 were superseded or never built.** That gap is the journey.

## The phases

| Phase | Dates | What it was |
|---|---|---|
| [[P0-genesis]] | Jun 19–20 | Static HTML → React → Supabase auth → Vercel. The substrate is chosen. |
| [[P1-labs-core]] | Jun 21–22 | ArgantaLabs core: buddy, streaks, journey, quests, circles v2. |
| [[P2-the-big-day]] | **Jun 23** | 84 commits. KinetikCircle rebuild + the Circle Game SDK spine + Builders. |
| [[P3-circles-economy]] | Jun 24–26 | Circle admin, diamonds, Moments, co-op, Broadcast/Discover, PWA. |
| [[P4-landing-kinquest]] | Jun 27–Jul 1 | arganta.app cinematic deck · Capacitor native · KinQuest. |
| [[P5-hq-command]] | Jul 1–3 | Circle HQ: graph engine, 6 offices, reports, RCA, Treasury, Pixel Vault. |
| [[P6-lashirabloom]] | Jul 5–8 | 100+ commits. Farm + tiered combat on the Kingdom spine. |
| [[P7-polish]] | Jul 9–11 | Skill Forge, Character Page, cosmetics, sprite polish. **No user delta.** |

## The lessons — what the journey earned

The distilled, reusable learnings. Each is evidenced against real docs + code in its own note.

- [[write-the-audit-first|write the audit first]] — an adversarial pass on your own plan beats the plan.
- [[the-shipped-ia-is-the-real-decision|the shipped ia is the real decision]] — prose is cheap; the decision is made in the shipped IA.
- [[declare-when-you-supersede|declare when you supersede]] — a concept must announce when it replaces its ancestors, or the churn becomes debt.
- [[database-is-the-only-source-of-truth|database is the only source of truth]] — clients are disposable views.
- [[build-both-sides-of-the-wire|build both sides of the wire]] — a sensor with no consumer is a log file; half a wire is unbuilt.
- [[never-render-fake-as-real|never render fake as real]] — provenance-badge every value so a dashboard over an empty room never lies.
- [[dont-add-a-dependency-before-scale-demands-it|dont add a dependency before scale demands it]] — activate what exists before adding a table or a dep.
- [[distribution-not-features|distribution not features]] — distribution is the work; **polish is not progress.**

## How this connects

```
00-MASTER-KB (living NOW) ──uses──▶ 00-arc (this) ──indexes──▶ P0..P7 phases
                                          │                         │
                                          └──────▶ lessons/ ◀───────┘ (each phase links the lessons it earned)
                                          
atlas/00-doc-atlas ──feeds the verdicts──▶ the "tried & abandoned" sections of each phase
```

> [!info] From tomorrow
> The journey is frozen at baseline. New learning lands as **deltas** (see [[README]]) — each a reflection, not a log line — and when a delta crystallizes a reusable insight, it becomes a new note in `lessons/`.

## Related
[[00-MASTER-KB]] · [[00-doc-atlas]] · [[README|How this KB works]]
