# Architecture Surface v2 — "The Living Blueprint"
### Deep research: design + engineering (NO build yet)

> **Goal.** The Architecture tab must do two jobs at once: **survive a CTO's due-diligence
> scan** and **produce a wow in the first 5 seconds for an investor/angel**. Today it does
> neither fully. This doc is the research + full redesign spec. Canvas stays (React Flow
> pan/zoom, user-approved). Logos stay (open-source / platform-agnostic story). Everything
> else is on the table.

---

## 1 · Honest critique of the current three tabs (world-class-designer + CTO lens)

What ships today ([Architecture.tsx](../apps/hq/src/surfaces/Architecture.tsx)): React Flow canvas,
5 layer bands, glass cards with simple-icons logos, live Supabase chips on ~7 nodes, three views
(simple / current / future), minimap, legend.

### What already works (keep)
- **Live pulse dots + real Supabase metrics on nodes.** Nobody at seed stage has an architecture
  diagram wired to production data. This is the single most differentiating asset — it's just
  underexploited (7 tiny chips, 8.5px font).
- **Layer bands** — the vertical stack story (Control → Apps → Intelligence → Data → Platform) is
  the right mental model and matches the KB's L0–L7 thesis.
- **Brand logos** (simple-icons, CC0) — instant tech-stack credibility, zero words needed.
- **NOW solid / NEXT dashed** — an honest roadmap language. Investors are trained to distrust
  decks where everything looks shipped; this convention is quietly excellent.

### What fails
| # | Failure | Why it matters |
|---|---------|----------------|
| F1 | **The three tabs answer no one's question.** "Simple" is a lonely vertical chain floating in 80% empty canvas — it reads as *less* than the Current view, not as a distilled thesis. "Future" is Current + 3 dashed boxes — the diff is nearly invisible. | C4-model research is unambiguous: each zoom level must serve a *different audience with a different question*. Ours serve the same audience three times at three densities. |
| F2 | **Metrics whisper.** 8.5px chips ("5 WAU", "112 tables") buried inside 176px cards. An investor scanning for traction finds nothing at glance distance; a CTO finds numbers with no interpretation (112 tables — is that good or a mess?). | Investor-reporting research: charts must land in **5 seconds**, and headlines should carry the takeaway ("one schema powers 7 apps"), not raw labels. |
| F3 | **Nothing moves with meaning.** `animated: true` gives a generic marching-ants dash on *every* edge — uniform noise, not data flow. The system doesn't look *alive*, it looks like a template default. | The "wow" in every reference (PlanetScale, MagicUI beams) comes from *directional, differentiated* motion: pulses travelling *along paths that actually carry data*. |
| F4 | **Nodes are dead ends.** Clicking a card does nothing. The diagram can't answer a single follow-up question ("what's inside Agent OS?", "what breaks at 10×?"). | PlanetScale's infra diagram is the gold standard precisely because **click → live metric drilldown**. A diagram that answers follow-ups replaces 30 min of CTO Q&A. |
| F5 | **Minimap is broken** (blank white box, bottom-right — visible in every screenshot). | A visibly broken control on the page whose entire job is "we are competent engineers" is a self-own. Worse than absent. |
| F6 | **No scale / risk story.** CTO diligence checklists converge on: load headroom ("what breaks first at 10×"), single points of failure, key-person risk, vendor lock-in. The canvas answers none. | Diligence research: evaluators reward **self-awareness** — the CTO who shows where the risks are wins over the one who shows a flawless poster. |
| F7 | **Platform-agnostic story is implicit.** Logos exist but nothing *says* "every vendor here is swappable." The user's core message — open source, no lock-in, scalable — must be explicit. | Lock-in is a standard diligence red flag; preempting it on the diagram flips a risk into a strength. |

**Verdict: would not approve.** Solid v1 skeleton, but it's a *static poster with footnotes*, not an
instrument. The fix is not more decoration — it's giving each view a job, making the data flow
visible, and letting every node answer questions.

---

## 2 · Audience research — the two readers

### Reader A: the CTO / technical diligence (90-minute-call lens)
Seed-stage tech DD converges on 7 areas (madewithlove, ctoondemand, startupctobook):
architecture & scalability · code quality & delivery · **team & key-person risk** ·
security & compliance · IP / open-source licensing · data & AI exposure · roadmap credibility.
The questions a diagram *can* preempt:

1. "Draw me the system." → the canvas itself (already ✓)
2. "What breaks first at 10×?" → **needs a scale-headroom overlay** (F6)
3. "Where are your single points of failure?" → same overlay
4. "What's vendored vs. yours? Lock-in?" → **needs the swap-ready story** (F7)
5. "One person built this? What's the bus factor?" → *flip it*: the Agent OS + builders story
   ("the leverage layer is the team") — this is Arganta's genuinely novel answer
6. "Is any of this real?" → live metrics with provenance (✓, amplify)

### Reader B: the investor / angel (5-second lens)
- Needs **one headline number moving** (count-up ticker on load = "this is live, not a slide").
- Needs the **thesis in one sentence**: *one substrate → seven surfaces → built at agent speed*.
- Distrusts perfection; trusts **NOW/NEXT honesty** and consistent, reconciled numbers
  (Lucid investor-reporting research: accuracy + consistency = credibility; one wrong number
  poisons everything — aligns with the house rule **never-render-fake-as-real**).
- Small absolute numbers (5 WAU) are *fine at pre-seed* if framed as velocity + leverage, not scale.
  Lead with engineering-leverage metrics (7 apps · 112 tables · 40 games · 31 agents · 7 shared
  packages · 96k LOC · months-not-years) and *time-in-product* rather than raw WAU.

### The synthesis
One canvas, **three questions** (this is what the three tabs should become):
| Tab (new) | Audience | Question it answers | C4 analogue |
|---|---|---|---|
| **Thesis** (was Simple) | investor, 5 s | *Why is this company shaped like a weapon?* | L1 Context |
| **System** (was Current) | CTO, 5 min | *How does it actually work, and is it alive?* | L2 Container |
| **Scale** (was Future) | both, the close | *What's next and what happens at 10×?* | L2 + roadmap overlay |

---

## 3 · Design research — precedents worth stealing

### 3.1 PlanetScale's interactive infra diagram — the drilldown pattern ⭐
Their database overview page renders the *actual* cluster as a diagram where **every element is
selectable and opens expandable cards of live metrics** (connections, QPS, latency on the load
balancer; reads/writes, CPU, memory on the primary). This is the strongest known "CTO wow" in
production. Steal: **click node → right-side inspector drawer with live sparkline + facts.**

### 3.2 C4 model — progressive disclosure semantics
Context → Container → Component: each level is a *zoom-in* keyed to an audience, and every element
carries name / type / **technology** / one-line description. Steal: tab semantics (above) + the
discipline that every node states its tech and its one-liner. Our "Simple" failed because it was a
*summary*, not a *context view*.

### 3.3 MagicUI **AnimatedBeam** / Liam-ERD edge tuning — motion that means something
- MagicUI's animated beam (light travelling along an SVG path) is the de-facto "integration wow"
  on modern landing pages.
- Liam ERD / ROUTE06 perf research: **don't animate every edge's stroke-dash** (it burns paint
  time and reads as noise); instead animate **a small object along the path** (`<animateMotion>`
  or offset-path), few at a time. Steal: 3–6 concurrent "data pulses" travelling App→Telemetry→
  Postgres and AgentOS→LLM paths; pause via `document.hidden`; disable under
  `prefers-reduced-motion`.

### 3.4 Count-up tickers — the "it's alive" opener
Animated counters (CSS/rAF number tickers 0→N on mount) are a proven dashboard-credibility
pattern *when the numbers are real*. Steal: a **hero KPI strip** above the canvas that counts up
on load — tracked hours, people, tables, agents — each with provenance tooltips.

### 3.5 React Flow capability check (already in-house)
v12 (`@xyflow/react` already installed) supports everything needed: custom edges (SVG path →
particles), `useReactFlow().fitView({ nodes, duration })` for **camera tours**, minimap with
`nodeColor`/custom SVG nodes, `colorMode`, sub-flows. **No new heavy dependency required** —
motion can be hand-rolled SVG/rAF (house style: zero-dep engines) or Motion One if desired.

### 3.6 Minimap bug — root cause + fix
React Flow's MiniMap draws **every node** using measured dimensions. Our band nodes (1180×200 px
backgrounds) are included → they fill the minimap as giant near-white rectangles, visually
blanking it; light `maskColor` finishes the job. Fix (pick one):
1. `nodeColor={n => n.type === 'band' ? 'transparent' : c}` + `nodeStrokeWidth={0}` for bands, or
2. custom `MiniMapNode` SVG that skips `type==='band'`, colors cards by layer, and adds
   `bgColor`/darker mask so the viewport rectangle is visible.
Also worth: `pannable zoomable` stays; add `inversePan={false}` sanity and a border-radius token.

### 3.7 Anti-patterns (deliberately rejected)
- **3D / isometric scenes** — demo candy, destroys legibility + maintainability; the KB lesson
  `dont-add-a-dependency-before-scale-demands-it` applies.
- **Fake/placeholder numbers styled as live** — violates house rule `never-render-fake-as-real`;
  every metric chip must carry provenance (live dot = measured; no dot = static fact).
- **Replacing React Flow with bespoke WebGL** — the vault graph v3 (PixiJS) exists for organic
  graphs; the architecture map is a *curated blueprint*, where React Flow's DOM cards + CSS is
  the right tool.

---

## 4 · The redesign — "The Living Blueprint"

### 4.0 One-line concept
> A blueprint that is visibly **plugged into production**: numbers count up, pulses travel the
> real data paths, every node opens into live metrics, and the Scale view answers the 10× question
> before it's asked.

### 4.1 Hero KPI strip (above canvas, all tabs)
5 count-up tickers, real RPCs, provenance tooltips:
`⏱ tracked time·14d` (engagement.totalSeconds) · `👥 people·14d` (totalUsers) ·
`🗄 tables` (schemaModel) · `🤖 agents` (31, static fact) · `📦 shared packages` (7, static fact).
Right side: `● N nodes reporting live` (existing) + **"Tour" button** (see 4.6).
*Design*: 22–26px numbers, tabular-nums, count-up 900ms ease-out on mount, ✦ no fake values —
cards without cloud data render as static facts without the live dot.

### 4.2 Tab 1 — **Thesis** (rebuilt "Simple")
Not a vertical chain — a **poster-grade context view** (C4 L1) that fills the canvas:
- Center: **One Substrate** mega-node (Postgres + packages + Agent OS condensed) with its 3
  strongest numbers.
- Orbit: the 5 product surfaces + Circle HQ as compact satellites, each with its one live number.
- Bottom strip: the three takeaway headlines as *typography, not cards*:
  **"One schema powers 7 apps." · "31 agents are the team." · "Every vendor is swappable."**
- Edges: thick, few, animated pulses only here (max drama, min elements — this is the
  investor tab).

### 4.3 Tab 2 — **System** (evolved "Current")
Keep today's banded blueprint, upgrade in place:
- **Clickable nodes → Inspector drawer** (right, 320px, glass): title + layer chip; live
  sparkline (reuse d3 chartkit + engagement day-series where applicable); fact rows
  (tech, repo path `apps/…`/`packages/…`, "why this choice" one-liner); swap-ready row
  (see 4.5); scale note (see 4.4). PlanetScale pattern, our data.
- **Hover → path highlight**: dim non-neighbors (same interaction language as vault graph v3 —
  consistent product feel).
- **Directional pulses** replace uniform dashes: only on true data paths (apps→telemetry→postgres,
  agentos→postgres, aiml→LLM logos), 3–6 concurrent, staggered.
- Metric chips: bump to 10.5px, max 2 per card + "+ drawer" affordance; keep the pulse dot.
- Node polish: 4px left accent → gradient ring on hover; live-node glow via
  `box-shadow: 0 0 24px color-mix(var(--af-c) 20%)` (cheap, no filter).

### 4.4 Tab 3 — **Scale** (rebuilt "Future")
The 10× answer, visually distinct instead of "same map + 3 dashed boxes":
- **NOW→NEXT morph**: on tab switch, NEXT nodes *draw in* (300ms stagger: fade + rise + edge
  draw), so the diff is felt. (React Flow supports animated node mount via CSS.)
- **Headroom badges on every layer band** (the CTO chips): e.g.
  `Postgres · fine to ~100k MAU · then read replicas` · `Vercel/CDN · effectively infinite` ·
  `Agent OS · scales with compute, not headcount` · `SPOF: none critical; auth = Supabase (swap:
  any GoTrue/OIDC)`. Grounded, self-aware, pre-answering the diligence call. Content sourced from
  the existing `scaleModel.ts` seed where possible.
- Roadmap chips on NEXT nodes: quarter labels (`Q3'26`), not vague "future".

### 4.5 The platform-agnostic ribbon (user's explicit ask)
Bottom of canvas (all tabs): **"Built open, locked to no one."**
Row of current-stack logos, each paired on hover with its swap class:
`Supabase → any Postgres+GoTrue` · `Vercel → any CDN/edge` · `Claude/OpenAI → any LLM (one seam:
@arganta/ai)` · `React/Vite/TS → the open web`. One line, huge story: *we ride open source, we're
portable, model-agnostic, and cost-flexible.* This converts the logos from decoration (F7) into
an argument.

### 4.6 Presentation mode — **"Tour"** (the investor close)
One button → auto camera flight: `fitView` band-by-band (Control → Apps → Intelligence → Data →
Platform → Scale overlay), 2.5s per stop, caption card bottom-center narrating each layer's
headline + live number; Esc exits, arrows step. ~60 lines with `fitView({nodes, duration})`.
This is the single highest-wow-per-effort feature: the diagram *presents itself*.

---

## 5 · Content map (honest metrics inventory)

Available now via existing RPC wrappers (`live.ts` + types): `growthOverview` (WAU/MAU/WoW),
`engagement(14)` (per-app seconds/users/sessions, day series, punchcard), `schemaInsights`
(learners, active7d, games, diamonds float), `schemaModel` (table count), `kinetikStats`
(members/circles); types also exist for retention, economy (mint/burn), acquisition funnel.

| Node | Chips (max 2) | Drawer extras |
|---|---|---|
| CEO-Orb | WAU · MAU | WoW %, growth insight headline |
| ArgantaLab | learners · time·14d | active·7d, day sparkline |
| KinetikCircle | members · circles | time·14d sparkline |
| LashiraBloom / Landing / HQ | time·14d · users | sessions, top pages |
| PostgreSQL | tables · 💎 float | games total, mint/burn mini-flow |
| Usage telemetry | tracked·14d · people | punchcard mini |
| Agent OS | 31 agents (static) | roster by office |
| Shared packages | 7 pkgs (static) | list: ai·audio·character·combat·heroes-engine·usage·video |
| BaaS / Edge | static facts | swap-class + headroom note |

Provenance rule everywhere: pulse-dot = measured (Supabase); plain chip = static fact from repo;
no third category.

---

## 6 · Engineering plan (for the build phase — later)

**Stack**: no new deps required. Optional: `motion` (Motion One, 4kb) for springs — or hand-rolled
rAF (house style).

| Milestone | Scope | Est |
|---|---|---|
| **A0** Minimap fix + chip legibility + hover-glow polish | 3.6 fix, chip 10.5px, glow | 0.5 session |
| **A1** Hero KPI strip w/ count-up tickers + provenance | new `KpiStrip.tsx`, rAF ticker | 0.5–1 |
| **A2** Pulse edges (custom edge w/ `<animateMotion>`, visibility+reduced-motion guards) | replace `animated:true` | 1 |
| **A3** Inspector drawer (click node → live panel, d3 sparkline reuse) | `ArchInspector.tsx` + per-node fact table | 1–1.5 |
| **A4** Thesis + Scale tab rebuilds (layouts, morph-in, headroom badges) | content from §4.2/4.4 | 1–1.5 |
| **A5** Agnostic ribbon + Tour mode | §4.5, §4.6 | 1 |

Perf guards: ≤6 concurrent pulses; pause on `document.hidden`; `prefers-reduced-motion` →
static edges; drawer data fetched once (already cached in component state); no re-layout on tab
switch for shared nodes (React Flow keeps positions → smooth morph).

Open questions for the owner: (1) Tour narration copy — auto-generate from live numbers or
hand-written? (2) Scale headroom claims — I draft, you approve each sentence (they're diligence
statements). (3) Do we surface 💎 economy mint/burn on the Thesis tab or keep it in Growth?

---

## 7 · Sources
- PlanetScale — [database overview page](https://planetscale.com/blog/our-new-database-overview-page) (interactive infra diagram + per-element live metrics), [insights graph](https://planetscale.com/changelog/insights-graph)
- C4 model — [c4model.com](https://c4model.com/), [InfoQ: The C4 model](https://www.infoq.com/articles/C4-architecture-model/), [practical C4 tips](https://revision.app/blog/practical-c4-modeling-tips)
- Edge-animation perf — [Liam ERD: tuning React Flow edge animations](https://liambx.com/blog/tuning-edge-animations-reactflow-optimal-performance), [ROUTE06 dev.to version](https://dev.to/route06/tuning-edge-animations-in-reactflow-for-optimal-performance-3g32)
- React Flow — [animating edges example](https://reactflow.dev/examples/edges/animating-edges), [MiniMap API](https://reactflow.dev/api-reference/components/minimap), [showcase](https://reactflow.dev/showcase)
- MagicUI — [Animated Beam](https://magicui.design/docs/components/animated-beam)
- Diligence — [madewithlove TDD guide](https://madewithlove.com/blog/the-ultimate-guide-to-technical-due-diligence/), [startupctobook appendix D](https://www.startupctobook.com/appendix-d-technical-due-diligence.html), [ctoondemand checklist](https://ctoondemand.com/technical-due-diligence-checklist), [fcto.uk investor lens](https://fcto.uk/blog/tech-due-diligence-for-investors/)
- Investor reporting — [Lucid: investor infographics best practices](https://www.lucid.now/blog/investor-reporting-with-infographics-best-practices/), [Subframe animated counters](https://www.subframe.com/tips/css-animated-counter-examples)
