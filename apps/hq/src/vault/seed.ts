// HQ Vault — seed content, grounded to the Arganta main knowledge base
// (knowledge-base/ in the repo, snapshot commit a00b826, 2026-07-11).
// Every claim here is verified against code/schema: 96k LOC, one Supabase
// (71 tables, 147 RPCs), 7 front-ends on a shared packages spine — and
// 0 external users. Aspirational fictions removed; the notes now tell the truth
// in the main KB's format. Densely wikilinked so graph, backlinks and canvas
// stay alive on first open.

import type { VaultNote, CanvasState } from './types'
import { slugify } from './types'
import { parseFrontmatter, normalizeFrontmatter } from './markdown'

const RAW: string[] = [
// ------------------------------------------------------------------ HQ
`---
title: HQ
product: HQ
type: moc
status: living
tags: [pillar, founder-os, agentic, north-star]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# HQ — the founder operating system

HQ is the cockpit **above** the products. Where [[KinetikCircle]] serves the household, [[ArgantaLabs]] serves the kids, and [[LashiraBloom]] binds the family into one world, HQ serves exactly one user — the founder. Grounded state: 25,820 LOC, **6 offices consolidating 27 agents**, and **The Bridge** (an MCP seat) live on Render with 20 read-only tools.

## What HQ answers every morning
1. Is the family flywheel spinning? → [[Product Loop]]
2. Who used anything yesterday? → [[Family Pilot Plan]]
3. Is the economy honest? → [[The Economy]]
4. What is the real story for investors? → [[Investor Narrative]]

## The honest state
> The instrumentation is done. hq_growth_overview() computes DAU, WAU, MAU, stickiness, north-star. It runs. It reads **0**. It is a cockpit pointed at an empty room.

HQ is read-only over ArgantaLabs' tables; its provenance is mostly *simulated* / *placeholder* — not a bug, an honestly-labelled placeholder that flips to *live* the moment a real user appears. See [[Founder Decisions]] for why it stays read-only, and [[Fable Build Prompts]] for how it was built.

## Current focus
- [x] Command cockpit with six offices + Bridge live on Render
- [ ] Get the first non-household user so the dashboards stop reading 0 ([[Family Pilot Plan]])
- [ ] Name the wedge in writing ([[Product Roadmap]])
`,
// ------------------------------------------------------- KinetikCircle
`---
title: KinetikCircle
product: KinetikCircle
type: moc
status: living
tags: [pillar, family-os, retention]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# KinetikCircle — the family operating system

The household shell: calendar, moments, chores, four mini-apps (Padel, Kitchen, Travel, Vault). The boring-but-daily surface that earns the right to be opened every morning. Grounded state: 7,234 LOC, functional, ships native via Capacitor — **0 external users**.

## Position in the loop
KinetikCircle is the **entry pillar** of the [[Product Loop]]: parents arrive for organization, then discover [[ArgantaLabs]] for the kids and [[LashiraBloom]] as the shared world. Founding call: [[Decision — KinetikCircle as Family Shell]].

## The identity spine (a decision that held)
KinetikCircle reuses the existing **circles** model — circleId / personId / appId, never familyId / memberId — so one identity serves every app. See [[Founder Decisions]].

## Who it is for
| Persona | Job to be done |
| --- | --- |
| Organizing parent | Run the week without a whiteboard |
| Partner | See the plan, take a lane |
| Kids | Know what is expected, earn recognition |

## Open threads
- [ ] An invite used by someone **not** named Sukapradja (the real bar)
- [ ] Weekly ritual → quest bridge with [[ArgantaLabs]]
`,
// -------------------------------------------------------- ArgantaLabs
`---
title: ArgantaLabs
product: ArgantaLabs
type: moc
status: living
tags: [pillar, learning, kids]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# ArgantaLabs — the learning and growth engine

The kids' pillar and the **most complete product** in the repo: 34,196 LOC, 13 content packs, an adaptive learn engine, streaks, quests, badges, a parent dashboard, KinQuest, Arena and the Game Builder + Circle Game SDK. Chosen as the dedicated learning engine in [[Decision — ArgantaLabs as Learning Engine]].

## Engine, not app
ArgantaLabs is an **engine** other pillars call:
- [[KinetikCircle]] can surface today's quest inside the family plan
- [[LashiraBloom]] converts learning effort into world power
- Rewards settle in the shared [[The Economy]] — **kids earn Diamonds only from learning**, never from game actions

## The single write path
All learning flows through one RPC — log_learn_event — which updates skill mastery and the daily summary server-side. One source of truth, no client-side score fudging. See [[Founder Decisions]].

## The honest gap
> Most complete ≠ validated. There is **no educator sign-off** and **0 external learners**. Activation is the weakest lever and the landing / top-of-funnel is unmeasured — the door is dark while the room is empty.

Targets and the distribution plan: [[Product Roadmap]] and [[Family Pilot Plan]].
`,
// -------------------------------------------------------- LashiraBloom
`---
title: LashiraBloom
product: LashiraBloom
type: moc
status: living
tags: [pillar, world, rpg, retention]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# LashiraBloom — the family world

A Stardew-inspired family RPG built on the Kingdom spine over four heavy days (P6, 100+ commits): a farm loop (1–8) plus tiered combat (1–16) on a 60×48 castle-center map with an 82-asset art library. Rationale: [[Decision — LashiraBloom as Retention World]].

## The reuse bet that paid off
Combat, skills, scaling and VFX come from the shared **@arganta/combat** package — the same engine Kingdom and HQ consume. The Kingdom canvas compositor was copied in wholesale to ship fast (still un-extracted; that's debt). See [[Founder Decisions]].

## The currency, corrected
The play currency is **Bloom 🌸** — it was specced as open Diamonds, respecced as Gold, and shipped as Bloom, all inside ~24h (2026-07-08). Diamonds remain the cross-app skins currency; Bloom is Lashira's. Full model: [[The Economy]].

## Adults play, kids learn
Grown-ups farm freely; growth multipliers come from the kids' learning streaks in [[ArgantaLabs]]. No rot timers — crops wait politely.

## The honest gap
> Real farm + real combat, **0 players**. There is no onboarding for a stranger and no reason to return that isn't "dad built it." Retention (daily quests + streak) is the missing layer.
`,
// -------------------------------------------------------- Product Loop
`---
title: Product Loop
product: HQ
type: strategy
status: living
tags: [flywheel, strategy, north-star]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# The Product Loop

One family, four surfaces, a single intended flywheel:

1. **Organize** — the parent runs the week in [[KinetikCircle]]
2. **Learn** — the kid clears a quest in [[ArgantaLabs]]
3. **Bloom** — effort waters the family world in [[LashiraBloom]]
4. **Observe** — the founder reads the pulse in [[HQ]] and tunes the loop

Each hop mints or spends currency (see [[The Economy]]), so the loop is measurable end-to-end.

> The loop is the product; the apps are doors into it. Grounded caveat: the loop is **built in code but has 0 users flowing through it** — a flywheel with nothing on it. Building the loop was platform work; spinning it is distribution work, and that hasn't started.

## Loop health metrics (targets — all currently 0)
| Hop | Metric | Target |
| --- | --- | --- |
| Organize → Learn | quest-open rate from planner | 40% |
| Learn → Bloom | learning → world conversion | 90% |
| Bloom → Organize | next-morning planner return | 70% |

Distribution plan: [[Family Pilot Plan]]. Pitch framing: [[Investor Narrative]].
`,
// -------------------------------------------------- Investor Narrative
`---
title: Investor Narrative
product: Investor
type: strategy
status: living
tags: [fundraise, pitch, capital]
date: 2026-07-11
owner: Aldyth
confidence: medium
---
# Investor Narrative

**One line:** Arganta is the family operating system — organization, learning and play fused into one loop a household never wants to leave.

## The arc
1. Wedge: [[KinetikCircle]] wins the organizing parent (weekly utility)
2. Expansion: [[ArgantaLabs]] wins the kids (daily learning)
3. Moat: [[LashiraBloom]] binds the family (shared world, sunk emotional cost)
4. Proof: [[HQ]] shows one founder + agents can run all of it

## Why now — and the honest proof state
AI collapsed the cost of building a four-product ecosystem solo. The build **is** the demo: 96k LOC, one Supabase spine (71 tables, 147 RPCs), 7 front-ends, one founder — in 22 days. The build log lives in [[Fable Build Prompts]].

> The honest number is the risk: **external users = 0.** The asset is the substrate and the velocity, not traction. The raise is to buy distribution, not to keep building.

## The honest risks
- Multi-product focus risk → the [[Product Loop]] discipline, but a wedge is still unnamed
- Kids-product trust bar → circle-private data, no ads ever
- Zero-traction risk → the whole plan in [[Family Pilot Plan]]
`,
// -------------------------------------------------- Family Pilot Plan
`---
title: Family Pilot Plan
product: HQ
type: plan
status: living
tags: [distribution, validation, milestones]
date: 2026-07-11
owner: Aldyth
confidence: medium
---
# Family Pilot Plan — the distribution ladder

> Grounded correction: there is **no pilot cohort yet**. External users = 0; all activity is the founder's household. This note is not a status board of live families — it is the plan to get the first stranger. Distribution is the work; features are not.

## The rule
A milestone is not done until a person **not in the family** does the thing. Code shipping is not a milestone — behaviour is.

## The ladder (from the main KB milestone tracker)
| # | Milestone | Signal |
| --- | --- | --- |
| M0 | Repo hygiene | .git < 100 MB, CI green, one lockfile |
| M1 | Name the wedge | ONE product named as the tip of the spear, in writing |
| M2 | Stranger #1 | hq_growth_overview().learners ≥ 1 non-household |
| M3 | Ten strangers | wau ≥ 10, none named Sukapradja |
| M4 | Retention signal | D7 retention ≥ 20% on those ten |
| M5 | First revenue | 1 paid Diamond top-up from a stranger |

## Next physical step
Pick the wedge ([[Product Roadmap]]), point one channel at one audience, instrument the top of the funnel so the first stranger is actually *seen*. Feeds [[Investor Narrative]] directly.
`,
// ----------------------------------------------------- The Economy
`---
title: The Economy
product: HQ
type: spec
status: living
tags: [economy, currency, diamonds, bloom]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# The Economy — Diamonds & Bloom

Grounded correction: there is no "Argons". The real ecosystem runs **two currencies**, and the rules below are enforced in the schema (diamond_ledger, RPC wallet_*).

## Diamonds — the cross-app wallet
- **Single source of truth: [[ArgantaLabs]].** Kids earn Diamonds **only** from learning apps or approved guardian events — **never** from game actions.
- Diamonds buy **skins/cosmetics only, never power**.
- Append-only ledger (diamond_ledger); every move goes through wallet_earn / wallet_spend / wallet_reconcile.
- Diamonds never convert to real money.

## Bloom 🌸 — LashiraBloom's play currency
- Earned and spent inside [[LashiraBloom]] (farming, world events). Was Gold, renamed Bloom on 2026-07-08.
- Buys Lashira cosmetics and plot upgrades. Kept separate from Diamonds so play can't mint power.

## Balance laws
1. **Learning is the only faucet that mints Diamonds** — the economy pays kids for learning, not for playing.
2. Adults play freely; multipliers flow from the kids' learning streaks.
3. No rot timers, no real-money bridge.

See [[Founder Decisions]] for the Gold → Bloom call and the diamonds-single-source rule.
`,
// -------------------------------------------------- Founder Decisions
`---
title: Founder Decisions
product: HQ
type: decision
status: living
tags: [decisions, log, index]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# Founder Decisions — the log that held

The append-only ledger of bets, grounded to the main KB decision log (§13). These have **held** in code.

## Ratified & holding
- **2026-06-23** — KinetikCircle uses the existing **circles**, not kinetik_circles (one identity model). → [[KinetikCircle]]
- **2026-06-23** — Supabase is the single source of truth; kill placeholder UI (no fake data).
- **2026-07-01** — 27 agents consolidated into **six offices** (reduce surface). → [[HQ]]
- **2026-07-07** — **@arganta/combat** is canonical; Kingdom and [[LashiraBloom]] consume it (single source).
- **2026-07-08** — Gold → **Bloom 🌸** (brand coherence). → [[The Economy]]
- HQ is **read-only** over ArgantaLabs' tables — a cockpit is not an engine.
- The Bridge is a deterministic, provenance-badged seed — nothing fake renders as real.

## The open decision (this is M1)
- **Which product is the wedge?** Unanswered. Until one app is named the tip of the spear in writing, effort spreads thin. → [[Product Roadmap]] · [[Family Pilot Plan]]

> A decision note is cheap. Re-litigating the same argument every quarter is not.

## Founding bets (detail)
- [[Decision — KinetikCircle as Family Shell]] · [[Decision — ArgantaLabs as Learning Engine]] · [[Decision — LashiraBloom as Retention World]]
`,
// ---------------------------------------------- Fable Build Prompts
`---
title: Fable Build Prompts
product: HQ
type: prompt
status: living
tags: [prompts, ai, index, engineering]
date: 2026-07-11
owner: Aldyth
confidence: high
---
# Fable Build Prompts

The prompt library index. Arganta is built by one founder driving AI agents, which makes prompts **capital** — versioned, reusable, compounding. The 96k-LOC build log *is* the demo behind [[Investor Narrative]]. The Prompts view groups these by pillar and craft.

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
2. Pin the effort split (build vs. polish) or agents gold-plate the wrong thing.
3. Always demand acceptance criteria back.
`,
// ---------------------------------------------------- Market Research
`---
title: Market Research
product: Research
type: research
status: living
tags: [market, competitors, research]
date: 2026-07-11
owner: Aldyth
confidence: medium
---
# Market Research

Standing scan of the family-software landscape. Feeds [[Investor Narrative]] and pressure-tests the [[Product Loop]].

## The slice owners
| Category | Players | What they own | What they miss |
| --- | --- | --- | --- |
| Family organizers | Cozi, FamilyWall | The calendar | Kids bounce off |
| Kids learning | Khan Kids, Duolingo ABC | The drill | No household context |
| Family games | Minecraft Realms | The fun | No utility, no learning loop |
| Chore-reward apps | Greenlight, BusyKid | The allowance | Money ≠ meaning |

## The gap (the thesis)
Nobody owns the **loop** — organizer → learner → shared world. Each incumbent optimizes one surface and treats the family as an account, not a circle. That gap is the whole bet behind [[KinetikCircle]] + [[ArgantaLabs]] + [[LashiraBloom]].

## Economy autopsies
Every reward economy studied that died, died of an uncapped faucet or a real-money bridge. Both are banned in [[The Economy]].
`,
// ---------------------------------------------------- Product Roadmap
`---
title: Product Roadmap
product: HQ
type: plan
status: living
tags: [roadmap, distribution, planning]
date: 2026-07-11
owner: Aldyth
confidence: medium
---
# Product Roadmap — grounded

> The build phase is over; the product is built (96k LOC, 7 apps, one spine). The only roadmap rule now: **every move must produce a user, not a feature.** Polish is not progress.

## Now — get to Stranger #1
- **Name the wedge** (M1) — one product as the tip of the spear, in writing ([[Founder Decisions]])
- Instrument the top of the funnel so the first stranger is seen
- Point one channel at one audience ([[Family Pilot Plan]])

## Next — hygiene that unblocks scale
- Repo: .git < 100 MB, kill the 3× asset duplication, add CI (M0)
- Align dependency drift (React 18/19, Capacitor 6/8) on the wedge app

## Later — only after users exist
- Retention layer in [[LashiraBloom]] (daily quests + streak)
- Educator validation for [[ArgantaLabs]] content
- Seed round on real pilot data ([[Investor Narrative]])
`,
// ---------------------------------------- Decision 1: KinetikCircle
`---
title: Decision — KinetikCircle as Family Shell
product: KinetikCircle
type: decision
status: frozen
tags: [decision, wedge, strategy]
date: 2026-05-12
owner: Aldyth
confidence: high
---
# Decision — KinetikCircle as the family shell

## Decision
[[KinetikCircle]] is the ecosystem's front door: the household organizer is the candidate wedge, and every other pillar mounts into it.

## Why
The organizing parent is the economic buyer, the installer, and the enforcer of habits. Win the planner and the kids arrive by decree. Utility survives motivation dips — fun does not.

## Consequences
- [[ArgantaLabs]] and [[LashiraBloom]] surface *inside* the circle rather than standing alone
- Onboarding, billing and trust all speak parent-first
- Still open: whether the organizer is *the* wedge is M1 in [[Founder Decisions]] — proposed here, not yet proven with a user
`,
// ---------------------------------------- Decision 2: ArgantaLabs
`---
title: Decision — ArgantaLabs as Learning Engine
product: ArgantaLabs
type: decision
status: frozen
tags: [decision, learning, architecture]
date: 2026-05-20
owner: Aldyth
confidence: high
---
# Decision — ArgantaLabs as the learning engine

## Decision
[[ArgantaLabs]] is built as an **engine with surfaces**, not a destination app: drills, quests, ranks and learning events are services other pillars call.

## Why
The loop ([[Product Loop]]) needs learning effort to be legible everywhere — a quest cleared at breakfast should move the world by dinner. One engine, one event path (log_learn_event), one rank season.

## Consequences
- Single source of truth for learning feeding [[The Economy]] — Diamonds mint from learning only
- Rank seasons stay marathon-shaped (daily caps)
- The engine ships SDK-style; surfaces stay thin
`,
// ---------------------------------------- Decision 3: LashiraBloom
`---
title: Decision — LashiraBloom as Retention World
product: LashiraBloom
type: decision
status: current
tags: [decision, retention, world]
date: 2026-06-08
owner: Aldyth
confidence: medium
---
# Decision — LashiraBloom as the retention world

## Decision
[[LashiraBloom]] is the ecosystem's retention layer: a persistent family world whose growth is fed by real household activity, reusing the shared @arganta/combat engine.

## Why
Organizers get replaced; learning apps get dropped at semester's end. The ecosystem needed something a family *accumulates* — sunk emotional value that makes switching feel like loss.

## Consequences
- Adults play freely; multipliers come from kids' learning ([[ArgantaLabs]])
- All value settles in [[The Economy]] — Bloom for play, no real-money bridge
- Open risk: the retention layer (daily quests + streak) is **not yet built**, and there are 0 players to retain
`,
// -------------------------------------------------- Prompt: HQ Vault
`---
title: Prompt — HQ Vault Build
product: HQ
type: prompt
status: frozen
tags: [prompt, engineering, vault]
date: 2026-07-06
owner: Aldyth
confidence: high
---
# Prompt — HQ Vault Build

The prompt that built this workspace. Kept as the house template for **feature-first agent builds**.

## Mission framing
> Build a premium Obsidian-inspired knowledge workspace inside HQ. Spend 80% of effort on the new feature, 15% integrating it, 5% on the old shell. Feature first, polish second, no fake buttons.

## Structure that made it work
1. Product context (four pillars, who each serves)
2. Explicit UX reference model (ribbon, explorer, tabs, graph, canvas, bases)
3. Legal guardrail — emulate the interaction model, never assets or branding
4. Local-first constraint: no backend, localStorage
5. Pure-function contract: parseFrontmatter, buildBacklinks, buildGraph
6. Acceptance flows the result is graded against

Related craft: [[Prompt — Engineering Review Pass]] · index: [[Fable Build Prompts]]
`,
// -------------------------------------------- Prompt: Weekly Planner
`---
title: Prompt — Weekly Planner Flow
product: KinetikCircle
type: prompt
status: living
tags: [prompt, design, planner]
date: 2026-06-18
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
status: living
tags: [prompt, design, quests]
date: 2026-06-15
owner: Aldyth
confidence: medium
---
# Prompt — Quest Design System

For generating [[ArgantaLabs]] quest chains that respect the engine's design laws.

## Prompt body
> Design a 5-step quest chain for a 9-year-old practicing multiplication. Constraints: 12-minute daily session, daily Diamond cap (see [[The Economy]] — Diamonds mint from learning only), difficulty rises only after two clean days, and every step maps to a curriculum node a parent can read in one sentence. Deliver: chain table, reward schedule, failure-day behavior.

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
date: 2026-06-20
owner: Aldyth
confidence: low
---
# Prompt — Farm Loop Balancing

For tuning the [[LashiraBloom]] farm against the [[The Economy]] balance laws.

## Prompt body
> Simulate a family of four (two kids, streaks of 60% and 90%) playing the farm for 30 days. Apply the current Bloom faucet/sink table. Report: net Bloom balance per member per week, time-to-first-cosmetic, and any point where an adult could out-earn a learning kid in Diamonds. Flag every case where play mints power instead of skins.

## Grading
- Play never mints Diamonds (learning-only faucet holds)
- No sink priced above 2 weeks of honest play for a median kid

Index: [[Fable Build Prompts]]
`,
// ------------------------------------------ Prompt: Investor One-Pager
`---
title: Prompt — Investor One-Pager
product: Investor
type: prompt
status: living
tags: [prompt, fundraise, writing]
date: 2026-06-22
owner: Aldyth
confidence: medium
---
# Prompt — Investor One-Pager

Compresses [[Investor Narrative]] into a single page for a cold intro.

## Prompt body
> Write a one-page memo from the Investor Narrative note. Structure: one-line thesis, the loop diagram in words (from [[Product Loop]]), why-now in two sentences, the honest zero-traction risk with its answer, and the distribution plan (from [[Family Pilot Plan]]). Voice: calm, specific, zero superlatives. Hard limit 420 words.

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
status: living
tags: [prompt, research, monthly]
date: 2026-06-25
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
status: living
tags: [prompt, design, critique]
date: 2026-06-10
owner: Aldyth
confidence: high
---
# Prompt — Design Critique Pass

House critique ritual for any new Arganta surface, run before ship.

## Prompt body
> Critique this screen as three reviewers in sequence: (1) a tired parent at 9pm on a phone, (2) a design-system maintainer checking token discipline, (3) a competitor's PM looking for the weakest flow. Each reviewer: top three issues, one thing to keep. Then reconcile into a single fix list ordered by user pain, not by effort.

## Grading
- The 9pm-parent reviewer always goes first
- Fix list caps at five items — more means the screen needs a rethink

Index: [[Fable Build Prompts]]
`,
// ---------------------------------------- Prompt: Engineering Review
`---
title: Prompt — Engineering Review Pass
product: HQ
type: prompt
status: living
tags: [prompt, engineering, review]
date: 2026-06-12
owner: Aldyth
confidence: high
---
# Prompt — Engineering Review Pass

Standard review pass for agent-built features across the Arganta repos.

## Prompt body
> Review the diff feature-first: (1) do the acceptance flows work end-to-end, (2) is state local-first and resilient to reload, (3) any fake buttons or dead UI, (4) type-check and build clean, (5) does it leak scope into unrelated modules. Report only defects you verified, ranked by user impact. No style nits unless they break the design system.

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
        text: '**The loop is the product.**\nOrganize → Learn → Bloom → Observe. (0 users on it yet.)' },
      { id: 'c-econ', type: 'text', x: 468, y: 560, w: 254, h: 96, color: 'graphite',
        text: 'Diamonds mint from learning only; Bloom is play. Learning is the single faucet.' },
    ],
    edges: [
      { id: 'e1', fromCard: 'c-kin', toCard: 'c-hq', label: 'organize' },
      { id: 'e2', fromCard: 'c-labs', toCard: 'c-hq', label: 'learn' },
      { id: 'e3', fromCard: 'c-bloom', toCard: 'c-hq', label: 'bloom' },
      { id: 'e4', fromCard: 'c-hq', toCard: 'c-inv', label: 'proof' },
      { id: 'e5', fromCard: 'c-kin', toCard: 'c-bloom', label: 'minifarm' },
      { id: 'e6', fromCard: 'c-labs', toCard: 'c-bloom', label: 'learn → world' },
    ],
  }
}
