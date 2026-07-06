// HQ Vault — seed content. A real founder vault, not lorem ipsum: the four
// Arganta pillars, the loop that connects them, the capital narrative, the
// decision log and the prompt library — densely wikilinked so backlinks,
// graph and canvas are alive on first open.

import type { VaultNote, CanvasState } from './types'
import { slugify } from './types'
import { parseFrontmatter, normalizeFrontmatter } from './markdown'

const RAW: string[] = [
// ------------------------------------------------------------------ HQ
`---
title: HQ
product: HQ
type: strategy
status: active
tags: [pillar, founder-os, north-star]
updated: 2026-07-06
owner: Aldyth
confidence: high
---
# HQ — the founder operating system

HQ is the fourth pillar of Arganta: the cockpit **above** the products. Where [[KinetikCircle]] serves the household, [[ArgantaLabs]] serves the kids, and [[LashiraBloom]] binds the family into one world, HQ serves exactly one user — the founder.

## What HQ must answer every morning
1. Is the family flywheel spinning? → [[Product Loop]]
2. What did the pilot families do yesterday? → [[Family Pilot Plan]]
3. Is the economy balanced? → [[Argons Economy]]
4. What am I telling investors this month? → [[Investor Narrative]]

## Operating principle
> One person, four products, zero headcount. Every surface in HQ exists to replace a meeting that never happened.

The Vault itself is part of HQ: decisions live in [[Founder Decisions]], reusable AI instructions live in [[Fable Build Prompts]], and the forward plan lives in [[Product Roadmap]].

## Current focus
- [ ] Ship HQ Vault (this workspace)
- [x] Command cockpit with six offices
- [ ] Wire pilot telemetry into Growth
- [ ] Draft the seed round memo from [[Investor Narrative]]
`,
// ------------------------------------------------------- KinetikCircle
`---
title: KinetikCircle
product: KinetikCircle
type: strategy
status: active
tags: [pillar, family-os, retention]
updated: 2026-07-05
owner: Aldyth
confidence: high
---
# KinetikCircle — the family operating system

The household shell. Calendar, meals, chores, rituals — the boring-but-daily surface that earns the right to be opened every single morning. Inspired by (and stress-tested on) the founder's wife, who is the archetypal organizing parent.

## Position in the loop
KinetikCircle is the **entry pillar** of the [[Product Loop]]: parents arrive for organization, then discover [[ArgantaLabs]] for the kids and [[LashiraBloom]] as the shared world. See the founding call in [[Decision — KinetikCircle as Family Shell]].

## Who it is for
| Persona | Job to be done |
| --- | --- |
| Organizing parent | Run the week without a whiteboard |
| Partner | See the plan, take a lane |
| Kids | Know what is expected, earn recognition |

## Beliefs
- The parent who plans the week is the **economic buyer** of the whole ecosystem.
- Utility first, delight second: streaks and gardens come *after* the calendar works.
- Family data never leaves the circle — trust is the moat. See [[Market Research]] for the competitor trust gap.

## Open threads
- [ ] Minifarm hand-off into [[LashiraBloom]]
- [ ] Weekly ritual → quest bridge with [[ArgantaLabs]]
`,
// -------------------------------------------------------- ArgantaLabs
`---
title: ArgantaLabs
product: ArgantaLabs
type: strategy
status: active
tags: [pillar, learning, kids]
updated: 2026-07-04
owner: Aldyth
confidence: high
---
# ArgantaLabs — the learning and growth engine

The kids' pillar, inspired by the founder's son: drills, quests, ranks and worlds that make practice feel like play. Chosen as the dedicated learning engine in [[Decision — ArgantaLabs as Learning Engine]].

## Engine, not app
ArgantaLabs is an **engine** that other pillars call:
- [[KinetikCircle]] surfaces "today's quest" inside the family plan
- [[LashiraBloom]] converts learning XP into world progress
- Rewards settle in the shared [[Argons Economy]]

## Design laws
1. A daily session must fit in 12 minutes.
2. Rank seasons are marathons, not sprints — capped daily gain, rising curve.
3. Every drill maps to a curriculum node a parent can inspect.

## Signals to watch
Weekly active learners, streak retention D30, parent-inspection rate. Targets tracked in [[Product Roadmap]] and reported through [[HQ]].
`,
// -------------------------------------------------------- LashiraBloom
`---
title: LashiraBloom
product: LashiraBloom
type: strategy
status: draft
tags: [pillar, world, mmorpg, retention]
updated: 2026-07-03
owner: Aldyth
confidence: medium
---
# LashiraBloom — the family world

A Stardew-inspired family MMORPG, inspired by the founder's daughter. The farm is the *retention layer* that makes leaving the ecosystem feel like abandoning a garden. Rationale in [[Decision — LashiraBloom as Retention World]].

## The unification bet
LashiraBloom absorbs two loose ends:
- the **Arena** progress from [[ArgantaLabs]] (kids' effort becomes world power)
- the **minifarm** from [[KinetikCircle]] (household rituals water real crops)

Adults play, kids learn: grown-ups can farm freely, but growth multipliers come from the kids' learning streaks — the household literally blooms when the children do. Currency flows through the [[Argons Economy]].

## World pillars
- A shared plot per family circle, visible to every member
- Seasons synchronized with [[ArgantaLabs]] rank seasons
- No dark-pattern timers: crops wait politely, they never rot

## Status
Playable farm slice built; economy hookup and family plot sync are next — see [[Product Roadmap]] and the pilot gates in [[Family Pilot Plan]].
`,
// -------------------------------------------------------- Product Loop
`---
title: Product Loop
product: HQ
type: strategy
status: active
tags: [flywheel, strategy, north-star]
updated: 2026-07-02
owner: Aldyth
confidence: high
---
# The Product Loop

One family, four surfaces, a single flywheel:

1. **Organize** — the parent runs the week in [[KinetikCircle]]
2. **Learn** — the kid clears a quest in [[ArgantaLabs]]
3. **Bloom** — effort waters the family plot in [[LashiraBloom]]
4. **Observe** — the founder reads the pulse in [[HQ]] and tunes the loop

Each hop mints or spends **Argons** (see [[Argons Economy]]), so the loop is measurable end-to-end.

> The loop is the product. The apps are just doors into it.

## Loop health metrics
| Hop | Metric | Target |
| --- | --- | --- |
| Organize → Learn | quest-open rate from planner | 40% |
| Learn → Bloom | XP→bloom conversion | 90% |
| Bloom → Organize | next-morning planner return | 70% |

Pilot instrumentation lives in [[Family Pilot Plan]]; the pitch version of this diagram anchors [[Investor Narrative]].
`,
// -------------------------------------------------- Investor Narrative
`---
title: Investor Narrative
product: Investor
type: strategy
status: draft
tags: [fundraise, pitch, capital]
updated: 2026-06-28
owner: Aldyth
confidence: medium
---
# Investor Narrative

**One line:** Arganta is the family operating system — organization, learning and play fused into one loop a household never wants to leave.

## The arc
1. Wedge: [[KinetikCircle]] wins the organizing parent (weekly utility)
2. Expansion: [[ArgantaLabs]] wins the kids (daily learning)
3. Moat: [[LashiraBloom]] binds the family (shared world, sunk emotional cost)
4. Proof: [[HQ]] shows one founder can run all of it with agents

## Why now
AI collapsed the cost of building a four-product ecosystem solo — the build log in [[Fable Build Prompts]] *is* the demo. Family-software incumbents each own a slice; nobody owns the loop (evidence: [[Market Research]]).

## The honest risks
- Multi-product focus risk → answered by the [[Product Loop]] flywheel discipline
- Kids-product trust bar → answered by circle-private data and no ads, ever
- Solo-founder risk → answered by the agent-run [[HQ]] cockpit

Numbers and pilot gates: [[Family Pilot Plan]] and [[Argons Economy]].
`,
// -------------------------------------------------- Family Pilot Plan
`---
title: Family Pilot Plan
product: HQ
type: plan
status: active
tags: [pilot, validation, metrics]
updated: 2026-07-01
owner: Aldyth
confidence: medium
---
# Family Pilot Plan

Five real households (starting with the founder's own) run the full loop for eight weeks. The pilot exists to prove **one number**: a family that completes onboarding is still active in all three surfaces at week 8.

## Cohort
| Family | Kids | Entry door | Status |
| --- | --- | --- | --- |
| Sukapradja (founder) | 2 | [[KinetikCircle]] | live |
| Pilot B | 1 | [[KinetikCircle]] | onboarding |
| Pilot C | 3 | [[ArgantaLabs]] | recruited |
| Pilot D | 2 | [[LashiraBloom]] | recruited |
| Pilot E | 2 | [[KinetikCircle]] | shortlist |

## Week gates
- **W1–2** — planner habit: ≥4 planner days/week
- **W3–4** — learning habit: kid streak ≥5 days via [[ArgantaLabs]]
- **W5–6** — bloom habit: family plot watered in [[LashiraBloom]]
- **W7–8** — loop proof: all three surfaces touched in one day, twice a week

Earned Argons per family are the cross-surface tracer — definitions in [[Argons Economy]]. Results feed [[Investor Narrative]] directly.
`,
// ----------------------------------------------------- Argons Economy
`---
title: Argons Economy
product: HQ
type: spec
status: draft
tags: [economy, currency, balance]
updated: 2026-06-30
owner: Aldyth
confidence: medium
---
# Argons Economy

**Argons** are the single currency that moves through every pillar — the accounting layer of the [[Product Loop]].

## Minting (sources)
| Source | Surface | Rate |
| --- | --- | --- |
| Completed chore/ritual | [[KinetikCircle]] | 5–15 ⬡ |
| Cleared drill/quest | [[ArgantaLabs]] | 10–40 ⬡ (daily-capped) |
| Harvest & world events | [[LashiraBloom]] | 5–25 ⬡ |

## Burning (sinks)
- Cosmetics, mounts and plot upgrades in [[LashiraBloom]]
- Quest re-rolls and season passes in [[ArgantaLabs]]
- Family reward shelf (parent-defined real-world treats) in [[KinetikCircle]]

## Balance laws
1. **Learning is the richest faucet** — the economy must always pay kids more per minute for learning than for anything else.
2. Daily caps everywhere; an uncapped faucet killed every economy we studied in [[Market Research]].
3. Sinks scale with family size so multi-kid circles never inflate.
4. Argons never convert to real money. Real-world rewards are parent-granted, not market-priced.

Season tuning cadence and cap curves ship with each rank season — tracked in [[Product Roadmap]].
`,
// -------------------------------------------------- Founder Decisions
`---
title: Founder Decisions
product: HQ
type: note
status: active
tags: [decisions, log, index]
updated: 2026-07-06
owner: Aldyth
confidence: high
---
# Founder Decisions

The append-only log of bets. One note per decision, frontmatter carries the metadata, the Decisions view renders the ledger.

## Ratified
- [[Decision — KinetikCircle as Family Shell]] — the organizing parent is the wedge
- [[Decision — ArgantaLabs as Learning Engine]] — learning is an engine, not an app
- [[Decision — LashiraBloom as Retention World]] — the world is the moat

## Under consideration
- Vault-first knowledge discipline: every strategic thought becomes a note in [[HQ]] Vault within 24h
- Pilot expansion beyond five families before or after the seed raise ([[Family Pilot Plan]])

> A decision note is cheap. Re-litigating the same argument every quarter is not.
`,
// ---------------------------------------------- Fable Build Prompts
`---
title: Fable Build Prompts
product: HQ
type: note
status: active
tags: [prompts, ai, index, engineering]
updated: 2026-07-06
owner: Aldyth
confidence: high
---
# Fable Build Prompts

The prompt library index. Arganta is built by one founder driving AI agents, which makes prompts **capital** — versioned, reusable, compounding. The Prompts view groups them by pillar and craft.

## Shelves
- **HQ** — [[Prompt — HQ Vault Build]]
- **KinetikCircle** — [[Prompt — Weekly Planner Flow]]
- **ArgantaLabs** — [[Prompt — Quest Design System]]
- **LashiraBloom** — [[Prompt — Farm Loop Balancing]]
- **Investor** — [[Prompt — Investor One-Pager]]
- **Research** — [[Prompt — Market Research Sweep]]
- **Design** — [[Prompt — Design Critique Pass]]
- **Engineering** — [[Prompt — Engineering Review Pass]]

## House rules for prompts
1. State the mission before the task list.
2. Pin the effort split (build vs. polish) or agents will gold-plate the wrong thing.
3. Always demand acceptance criteria back.
`,
// ---------------------------------------------------- Market Research
`---
title: Market Research
product: Research
type: research
status: active
tags: [market, competitors, research]
updated: 2026-06-25
owner: Aldyth
confidence: medium
---
# Market Research

Standing scan of the family-software landscape. Updated monthly; feeds [[Investor Narrative]] and pressure-tests the [[Product Loop]].

## The slice owners
| Category | Players | What they own | What they miss |
| --- | --- | --- | --- |
| Family organizers | Cozi, FamilyWall | The calendar | Kids bounce off |
| Kids learning | Khan Kids, Duolingo ABC | The drill | No household context |
| Family games | Minecraft Realms | The fun | No utility, no learning loop |
| Chore-reward apps | Greenlight, BusyKid | The allowance | Money ≠ meaning |

## The gap
Nobody owns the **loop** — organizer → learner → shared world. Each incumbent optimizes one surface and treats the family as an account, not a circle. That gap is the whole thesis behind [[KinetikCircle]] + [[ArgantaLabs]] + [[LashiraBloom]].

## Economy autopsies
Studied five reward economies; every one that died, died of an uncapped faucet or a real-money bridge. Both are banned in [[Argons Economy]].

## Watchlist
- [ ] Apple Family surfaces at WWDC
- [ ] Duolingo family-plan gamification moves
- [ ] EU CSAM/child-data regulation drafts (trust moat, see [[KinetikCircle]])
`,
// ---------------------------------------------------- Product Roadmap
`---
title: Product Roadmap
product: HQ
type: plan
status: active
tags: [roadmap, planning, quarters]
updated: 2026-07-05
owner: Aldyth
confidence: medium
---
# Product Roadmap

Rolling four-quarter view. The only roadmap rule: **every quarter must strengthen the loop**, not a single app. Loop definition: [[Product Loop]].

## Q3 2026 — Prove the loop
- HQ Vault ships inside [[HQ]] *(this workspace)*
- [[KinetikCircle]] minifarm → [[LashiraBloom]] plot hand-off
- [[ArgantaLabs]] season 2 with capped rank curve
- Pilot W1–W8 gates run ([[Family Pilot Plan]])

## Q4 2026 — Tighten the economy
- [[Argons Economy]] v1 across all three surfaces
- Family reward shelf in [[KinetikCircle]]
- First cross-surface season event

## Q1 2027 — Tell the story
- Seed round on pilot data ([[Investor Narrative]])
- Waitlist opens for cohort 2 families

## Q2 2027 — Widen the doors
- [[LashiraBloom]] multi-family neighborhoods
- ArgantaLabs curriculum marketplace exploration ([[Market Research]] gate first)
`,
// ---------------------------------------- Decision 1: KinetikCircle
`---
title: Decision — KinetikCircle as Family Shell
product: KinetikCircle
type: decision
status: shipped
tags: [decision, wedge, strategy]
updated: 2026-05-12
owner: Aldyth
confidence: high
---
# Decision — KinetikCircle as the family shell

## Decision
[[KinetikCircle]] is the ecosystem's front door: the household organizer is the wedge product, and every other pillar mounts into it.

## Context
Three candidate wedges: the organizer, the kids' learning app, or the game world. Only one can be the door families walk through first.

## Options considered
1. **Organizer-first** — daily utility for the buyer (the organizing parent)
2. **Learning-first** — kids love it, but parents evaluate it like homework
3. **World-first** — highest delight, hardest trust sell for a new brand

## Why option 1
The organizing parent is the economic buyer, the installer, and the enforcer of habits. Win the planner and the kids arrive by decree; win the kid and the parent still has veto. Utility survives motivation dips — fun does not.

## Consequences
- [[ArgantaLabs]] and [[LashiraBloom]] surface *inside* the circle rather than standing alone
- Onboarding, billing and trust all speak parent-first
- Pilot entry doors weighted toward the planner ([[Family Pilot Plan]])
`,
// ---------------------------------------- Decision 2: ArgantaLabs
`---
title: Decision — ArgantaLabs as Learning Engine
product: ArgantaLabs
type: decision
status: shipped
tags: [decision, learning, architecture]
updated: 2026-05-20
owner: Aldyth
confidence: high
---
# Decision — ArgantaLabs as the learning engine

## Decision
[[ArgantaLabs]] is built as an **engine with surfaces**, not a destination app: drills, quests, ranks and XP are services that [[KinetikCircle]] and [[LashiraBloom]] call.

## Context
The learning experience kept wanting to leak into the other pillars — quests in the family planner, XP in the farm. Duplicating logic per app was already hurting at two integrations.

## Options considered
1. **Standalone app** — cleanest brand, weakest loop
2. **Engine + embedded surfaces** — one progression system, many doors
3. **Merge into the game** — fun, but learning becomes decoration

## Why option 2
The loop ([[Product Loop]]) needs learning effort to be *legible everywhere* — a quest cleared at breakfast must move the farm by dinner. One engine, one XP ledger, one rank season, rendered wherever the family already is.

## Consequences
- Single source of truth for XP feeding the [[Argons Economy]]
- Rank seasons stay marathon-shaped (daily caps) across every surface
- The engine ships SDK-style; surfaces stay thin
`,
// ---------------------------------------- Decision 3: LashiraBloom
`---
title: Decision — LashiraBloom as Retention World
product: LashiraBloom
type: decision
status: active
tags: [decision, retention, world]
updated: 2026-06-08
owner: Aldyth
confidence: medium
---
# Decision — LashiraBloom as the retention world

## Decision
[[LashiraBloom]] is the ecosystem's retention layer: a persistent family world whose growth is fed by real household activity, unifying the ArgantaLabs Arena and the KinetikCircle minifarm.

## Context
Organizers get replaced by a cheaper organizer; learning apps get dropped at semester's end. The ecosystem needed something a family *accumulates* — sunk emotional value that makes switching feel like loss.

## Options considered
1. **Points & badges** — cheap, weightless, instantly forgettable
2. **Separate casual game** — fun but disconnected from real family effort
3. **Persistent world fed by the loop** — the farm only blooms when the family actually lives well

## Why option 3
A garden watered by six months of real chores, real streaks and real family rituals cannot be exported to a competitor. The world *is* the moat — and it is honest: it reflects effort, it never sells it back.

## Consequences
- Adults play freely; multipliers come from kids' learning ([[ArgantaLabs]])
- All value flows settle in [[Argons Economy]] — no rot timers, no real-money bridge
- Pilot gate W5–W6 measures the bloom habit ([[Family Pilot Plan]])
`,
// -------------------------------------------------- Prompt: HQ Vault
`---
title: Prompt — HQ Vault Build
product: HQ
type: prompt
status: shipped
tags: [prompt, engineering, vault]
updated: 2026-07-06
owner: Aldyth
confidence: high
---
# Prompt — HQ Vault Build

The prompt that built this workspace. Kept verbatim-in-spirit as the house template for **feature-first agent builds**.

## Mission framing
> Build a premium Obsidian-inspired knowledge workspace inside HQ. Spend 80% of effort on the new feature, 15% integrating it, 5% on the old shell. Feature first, polish second, no fake buttons.

## Structure that made it work
1. Product context (four pillars, who each serves)
2. Explicit UX reference model (ribbon, explorer, tabs, graph, canvas, bases…)
3. Legal guardrail — emulate interaction model, never assets or branding
4. Local-first constraint: no backend, no auth, IndexedDB/localStorage
5. Pure-function contract: parseFrontmatter, buildBacklinks, buildGraph…
6. 23 acceptance flows the result is graded against

## Reuse checklist
- [ ] Swap the mission paragraph
- [ ] Rewrite the acceptance flows for the new feature
- [ ] Keep the effort split line — it prevents gold-plating old screens

Related craft: [[Prompt — Engineering Review Pass]] · index: [[Fable Build Prompts]]
`,
// -------------------------------------------- Prompt: Weekly Planner
`---
title: Prompt — Weekly Planner Flow
product: KinetikCircle
type: prompt
status: active
tags: [prompt, design, planner]
updated: 2026-06-18
owner: Aldyth
confidence: medium
---
# Prompt — Weekly Planner Flow

For iterating the [[KinetikCircle]] weekly planner with an agent.

## Prompt body
> You are designing the Sunday-evening planning ritual for an organizing parent with two kids. The session must take under 10 minutes, produce a visible week, and assign each family member at least one lane. Respect the existing KinetikCircle design tokens. Output: flow states, empty states, and the single metric this flow moves.

## Grading
- Planner day-4 return rate is the only success metric
- Any step that needs two hands and a laptop fails the kitchen test

Index: [[Fable Build Prompts]]
`,
// --------------------------------------------- Prompt: Quest Design
`---
title: Prompt — Quest Design System
product: ArgantaLabs
type: prompt
status: active
tags: [prompt, design, quests]
updated: 2026-06-15
owner: Aldyth
confidence: medium
---
# Prompt — Quest Design System

For generating [[ArgantaLabs]] quest chains that respect the engine's design laws.

## Prompt body
> Design a 5-step quest chain for a 9-year-old practicing multiplication. Constraints: 12-minute daily session, daily XP cap (see [[Argons Economy]]), difficulty rises only after two clean days, and every step maps to a curriculum node a parent can read in one sentence. Deliver: chain table, XP schedule, failure-day behavior.

## Grading
- Marathon rule: a kid who plays every day for a week must NOT finish the season early
- Parent-legibility: each node explainable at dinner

Index: [[Fable Build Prompts]]
`,
// ----------------------------------------------- Prompt: Farm Loop
`---
title: Prompt — Farm Loop Balancing
product: LashiraBloom
type: prompt
status: draft
tags: [prompt, economy, balancing]
updated: 2026-06-20
owner: Aldyth
confidence: low
---
# Prompt — Farm Loop Balancing

For tuning the [[LashiraBloom]] farm against the [[Argons Economy]] balance laws.

## Prompt body
> Simulate a family of four (two kids, streaks of 60% and 90%) playing the farm for 30 days. Apply the current faucet/sink table from Argons Economy. Report: net Argon balance per member per week, time-to-first-mount, and any point where an adult could out-earn a learning kid. Flag every violation of the "learning is the richest faucet" law.

## Grading
- Zero faucet-law violations
- No sink priced above 2 weeks of honest play for a median kid

Index: [[Fable Build Prompts]]
`,
// ------------------------------------------ Prompt: Investor One-Pager
`---
title: Prompt — Investor One-Pager
product: Investor
type: prompt
status: active
tags: [prompt, fundraise, writing]
updated: 2026-06-22
owner: Aldyth
confidence: medium
---
# Prompt — Investor One-Pager

Compresses [[Investor Narrative]] into a single page for a cold intro.

## Prompt body
> Write a one-page memo from the Investor Narrative note. Structure: one-line thesis, the loop diagram in words (from [[Product Loop]]), why-now in two sentences, the three honest risks with their answers, and the pilot proof plan (from [[Family Pilot Plan]]). Voice: calm, specific, zero superlatives. Hard limit 420 words.

## Grading
- A stranger can repeat the thesis after one read
- Every claim traces to a vault note

Index: [[Fable Build Prompts]]
`,
// ------------------------------------------- Prompt: Research Sweep
`---
title: Prompt — Market Research Sweep
product: Research
type: prompt
status: active
tags: [prompt, research, monthly]
updated: 2026-06-25
owner: Aldyth
confidence: medium
---
# Prompt — Market Research Sweep

The monthly scan that keeps [[Market Research]] honest.

## Prompt body
> Sweep the family-software landscape for the last 30 days: family organizers, kids-learning apps, family games, chore-reward apps. For each mover: what shipped, which slice of the loop it touches, and whether it threatens the loop thesis. End with a "so what" — max three actions, each linked to a pillar note.

## Grading
- No mover listed without a "so what"
- Threats ranked against the [[Product Loop]], not against single features

Index: [[Fable Build Prompts]]
`,
// ------------------------------------------- Prompt: Design Critique
`---
title: Prompt — Design Critique Pass
product: HQ
type: prompt
status: active
tags: [prompt, design, critique]
updated: 2026-06-10
owner: Aldyth
confidence: high
---
# Prompt — Design Critique Pass

House critique ritual for any new Arganta surface, run before ship.

## Prompt body
> Critique this screen as three reviewers in sequence: (1) a tired parent at 9pm on a phone, (2) a design-system maintainer checking token discipline, (3) a competitor's PM looking for the weakest flow. Each reviewer: top three issues, one thing to keep. Then reconcile into a single fix list ordered by user pain, not by effort.

## Grading
- The 9pm-parent reviewer always goes first
- Fix list caps at five items — more means the screen needs a rethink, not fixes

Index: [[Fable Build Prompts]]
`,
// ---------------------------------------- Prompt: Engineering Review
`---
title: Prompt — Engineering Review Pass
product: HQ
type: prompt
status: active
tags: [prompt, engineering, review]
updated: 2026-06-12
owner: Aldyth
confidence: high
---
# Prompt — Engineering Review Pass

Standard review pass for agent-built features across the Arganta repos.

## Prompt body
> Review the diff feature-first: (1) do the acceptance flows actually work end-to-end, (2) is state local-first and resilient to reload, (3) any fake buttons or dead UI, (4) type-check and build clean, (5) does it leak scope into unrelated modules. Report only defects you verified, ranked by user impact. No style nits unless they break the design system.

## Grading
- A finding without a reproduction is an opinion
- Scope-leak findings outrank style findings, always

Index: [[Fable Build Prompts]]
`,
]

// ---------- Build the seed vault ----------

export function seedNotes(): Record<string, VaultNote> {
  const now = Date.now()
  const notes: Record<string, VaultNote> = {}
  RAW.forEach((raw, i) => {
    const { fm, body } = parseFrontmatter(raw)
    const full = normalizeFrontmatter(fm, 'Untitled ' + i)
    const id = slugify(full.title)
    notes[id] = {
      id, fm: full, body: body.trimStart(),
      createdAt: now - (RAW.length - i) * 86_400_000,
      updatedAt: new Date(full.updated + 'T12:00:00').getTime() || now,
    }
  })
  return notes
}

// Default canvas: HQ at the center of the constellation.
export function seedCanvas(): CanvasState {
  const N = (id: string, noteId: string, x: number, y: number, color: string, w = 240, h = 130): CanvasState['cards'][number] =>
    ({ id, type: 'note', noteId, x, y, w, h, color })
  return {
    cards: [
      N('c-hq', 'hq', 460, 300, 'iris', 270, 150),
      N('c-kin', 'kinetikcircle', 80, 90, 'sky'),
      N('c-labs', 'argantalabs', 850, 90, 'ember'),
      N('c-bloom', 'lashirabloom', 80, 530, 'jade'),
      N('c-inv', 'investor-narrative', 850, 530, 'rose'),
      { id: 'c-loop', type: 'text', x: 468, y: 66, w: 254, h: 96, color: 'graphite',
        text: '**The loop is the product.**\nOrganize → Learn → Bloom → Observe.' },
      { id: 'c-econ', type: 'text', x: 468, y: 560, w: 254, h: 96, color: 'graphite',
        text: 'Argons settle every hop — learning must stay the richest faucet.' },
    ],
    edges: [
      { id: 'e1', fromCard: 'c-kin', toCard: 'c-hq', label: 'organize' },
      { id: 'e2', fromCard: 'c-labs', toCard: 'c-hq', label: 'learn' },
      { id: 'e3', fromCard: 'c-bloom', toCard: 'c-hq', label: 'bloom' },
      { id: 'e4', fromCard: 'c-hq', toCard: 'c-inv', label: 'proof' },
      { id: 'e5', fromCard: 'c-kin', toCard: 'c-bloom', label: 'minifarm' },
      { id: 'e6', fromCard: 'c-labs', toCard: 'c-bloom', label: 'xp → bloom' },
    ],
  }
}
