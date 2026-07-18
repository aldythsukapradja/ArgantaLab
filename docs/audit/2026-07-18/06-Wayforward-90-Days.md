---
date: 2026-07-18
tags: [arganta, audit, roadmap, wayforward]
title: Wayforward — 90-Day Plan + Freeze List
---

# Wayforward — 90 Days

Operationalizes [[01-Vision-Critique]] + [[03-Gap-Analysis]] + [[05-Unicorn-Path]]. One rule governs everything:

> **Definition of done = a stranger's family is using it.** Not "built+verified," not "migration pending." Live, for strangers.

## The Freeze List (decide once, stop deciding weekly)

**FROZEN until 1,000 families** (code stays, zero new hours):
- LashiraBloom, Kingdom of Kin, KinWorld, ArgantaCup expansion, Character/Skill/Pixel Forge, Music/Video/Biography/AI-Influencer Studios, Reactor Builder, Cognitive Cortex, Vault graph, Command Center scale-up, Agent OS v2, Brand Forge, CircleHQ app builder, IG Simulator, Soul Cinema.

**KEPT, in service of the wedge only:**
- `apps/kinetik` (becomes the product shell), `arganta-chat-brain`, @arganta/ai router, Post Studio + Buffer pipeline (now = launch content machine, one brand only), KinQuest engine (dormant asset for Kids Workspace, Stage 2).

**KILLED as concepts:** five influencer personas (already paused — make it permanent), Founder Workspace, separate sub-brands ([[04-Emotional-Brand-Audit]] hierarchy applies).

## Days 1–7 — Debt & truth week
1. Run **every pending migration** on live Supabase (game_scores, core_projects, post_library, ig_plan if kept, lashira_my_circles n/a-frozen, artifact_game_kind, missions, hq_engagement). Half of these die with the freeze — run the ones the wedge needs, delete the rest from the pending list forever.
2. Fix llm-proxy (known non-2xx) so the assistant path is real.
3. Move the working repo off OneDrive sync (keep OneDrive as backup, not as the live git tree).
4. Write the manifesto + positioning page from [[04-Emotional-Brand-Audit]] one-liners. One evening, not one studio.

## Days 8–30 — Assemble the wedge (assembly, not invention)
Target product, exactly four surfaces inside **one app (Arganta = evolved Kinetik)**:
1. **Assistant** — chat grounded in the family's own data (calendar, members, moments) via arganta-chat-brain. It must answer "what's today's schedule?" perfectly. That question is the founding story.
2. **Calendar** — already exists; harden it.
3. **Moments** — already exists; add "one year ago" resurfacing.
4. **Family memory** — a simple "things Arganta knows about us" list with add/edit/delete. This *is* the privacy-by-design feature, visible.
Plus the boring lethal floor: auth for a stranger's family, onboarding (<5 min to first "wow"), data export/delete, parental gate, error reporting.

## Days 31–60 — Customer development while polishing
- **20 parent interviews** (start with school/padel/family network). Script: current system for family logistics? who carries it? what breaks? would they pay $5/mo?
- **Fake-door landing page** with the whiteboard story + waitlist + price shown. This tests G1+G2+G8 in one page.
- Shoot the **launch video** — real family, real whiteboard, phone camera + your existing video pipeline for polish. Authenticity over cinema.
- Onboard **10 pilot families** by hand (white-glove). Watch them. Fix what confuses them within 48h.

## Days 61–90 — Public wedge launch
- Waitlist → 100 families. Founder-authentic content machine (Post Studio, one brand) posting the *build + family* story 3×/week.
- Instrument the five signature moments from [[04-Emotional-Brand-Audit]]; the north-star metric is **weekly active families performing the Sunday reset**.
- Week-12 review against the Stage-0 criterion in [[05-Unicorn-Path]].

## Metrics that matter (only these)
| Metric | Day-90 target |
|---|---|
| Families activated (stranger households) | 100 |
| Week-4 retention of activated families | ≥40% |
| Time-to-first-wow in onboarding | <5 min |
| Interviews done / would-pay signals | 20 / ≥8 |
| New HQ studios built | **0** |

## The one-sentence way forward
> Stop building the laboratory; ship the whiteboard-killer to 100 families, and let their retention — not your tooling — be the thing that's impressive.

Index: [[00-Arganta-Audit-Executive-Summary]]
