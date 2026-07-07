# CONCEPT — CEO Orb: Circle HQ Twin Brain

Status: **Concept locked (P0)** · 2026-07-07 · UI/UX-first, deterministic-first, LLM-portable.
This is the durable concept doc for the CEO Orb landing + twin-brain program. The living
implementation plan lives in the session plan file; this doc is the committed reference.

---

## 1. Thesis

Circle HQ (`apps/hq`) is already the *body* of a founder twin brain — it just has no single face.
It has: a 5-kind chart system, 6 deterministic scenario "commands," a 27-agent roster under 6 C-level
offices, a full Obsidian-style Vault (local-only), and light/dark theming.

**The CEO Orb** is the missing membrane: a cinematic, orb-first landing that unifies all of it into one
conversational companion. You open HQ and you're looking at a living orb that greets you, briefs you,
and blooms the right diagnostic on command — the rail/surfaces become destinations the orb flies you
to, not the front door.

**Locked decisions**
- Vault → **Supabase-backed** (localStorage = offline cache). Supabase = the central unified DB.
- **Orb-first landing**; rail hidden behind a **fancy top-center "home" button** that expands it.
- Vault knowledge base **auto-generated from HQ, then curated**; later the CEO Agent writes each
  conversation back as a linked note.
- **Deterministic engine now**, LLM port later — same `Sense→Compute→Match→Generate→Deliver` contract.
- **Dependencies allowed** (server exists): premium animated chart + globe libraries.

---

## 2. Ground truth — reuse, do not rebuild

| Asset | File | Reuse as |
|---|---|---|
| Chart contract (line/bars/donut/cohort/kpis) | `src/components/charts.tsx` (`ChartData`, `ChartView`, `CHART_KINDS`) | Keep the contract; swap the renderer (§4) |
| Deterministic commands (6 scenarios) | `src/data/scenarios.ts` (`SCENARIOS`) | The command registry — extend it |
| Agent pipeline + intent router | `src/data/agents.ts` (`agentSense/Compute/Match/Generate`, `routeIntent`, `PIPELINE`) | The brain; `agentGenerate` is the LLM seam |
| 6 offices + C-level roles + chips | `src/data/graph/agents.ts` (`OFFICES`, `OFFICE_CHAT`) | Office diagnostics + deterministic questions |
| Existing floating orb | `src/components/AgentOrb.tsx` | Logic to lift into the cinematic landing |
| Reports (daily/financial/board/valuation) | `src/data/reports/*`, `command/reports/Briefing.tsx` | Deterministic long-form outputs |
| Vault (Obsidian clone) | `src/vault/*` | Knowledge base → add Supabase sync |
| Routing store | `src/shell/store.ts` (`go`, `goOffice`, `openAnalytics`, `toggleTheme`) | Orb "open/bloom a surface" actions |
| Theme (light-first, full light+dark tokens) | `src/theme.css` (`html[data-theme]`) | Extend for the orb |
| Architecture/scale model | `src/data/graph/scaleModel.ts` (`LAYERS`), `command/ArchMap.tsx` | The 5-layer backbone (§7) |
| Ownership graph | `src/data/graph/seed.ts` | App/agent nodes + provenance |

---

## 2.5 Tech stack (languages + libraries)

**Foundation** (matches all apps): **TypeScript · React 18 · Vite · Zustand** · Supabase JS client.
Surfaced on the Simple view as a "Built with" strip (and per-layer on the bands).

| Job | Library |
|---|---|
| Cinematic CEO orb (3D) | React Three Fiber + drei + `@react-three/postprocessing` (bloom) |
| Motion / choreography | GSAP (+ Flip) · Framer Motion |
| Animated charts | Apache ECharts (+ echarts-gl) · D3.js |
| Globe (coordinate arcs) | react-globe.gl (three-globe) |
| Architecture canvas | React Flow (`@xyflow/react`) + ELK.js / Dagre |
| Voice + audio-reactive | Web Speech API · Web Audio `AnalyserNode` |
| ML | **TensorFlow.js** (in-browser ML) |
| AI builders | **Claude · OpenAI** (via MCP) — the product is built primarily in **Claude Code + Codex** |
| Data / store | **PostgreSQL** via **Supabase** (BaaS) · pgvector (future RAG) |
| Edge / infra | **Vercel** (edge hosting · CDN · CI/CD) |

The Simple view surfaces this as **per-layer logo pills** (brand marks) nested directly **under each
architecture band** — UI band shows React/TS/Vite/Zustand + React Flow/D3/ECharts/Three.js/GSAP; Agent
OS shows TypeScript/MCP; AI/ML shows Claude/OpenAI/TensorFlow.js/MCP; Data shows
PostgreSQL/Supabase/Vercel; the future RAG band shows pgvector/embeddings (dashed).

**Intelligence — the MCP bridge (key):** the deterministic agent (`Sense→Compute→Match→Generate`) is
**connected via MCP to Claude and OpenAI**, so the CEO agent is **model-agnostic** — it routes reasoning
to Claude *or* GPT through MCP, with the deterministic path as the always-on, zero-cost,
never-hallucinate fallback. In-browser ML (adaptive/recommendation) uses **TensorFlow.js**. This *is*
the "LLM port" seam (P7): deterministic now → MCP-bridged Claude/OpenAI later, same contract.

## 3. Design system — cinematic HUD, light default

**Jayse Hansen FUI grammar:** one living orb in a (dark-optional) void, **radial not rectangular**,
diagnostics **bloom & collapse by altitude**, every motion communicates function, contextually
intelligent (a character, not a dashboard).

**Light default + dark, both first-class** (`theme.css` already ships both):
- **Dark:** classic Iron-Man void — near-black canvas, luminous indigo orb, glow/bloom.
- **Light:** "clean-room hologram" — soft `--canvas`, indigo orb, crisp hairline rings, restrained
  glow via low-opacity accent (not brightness). The harder one to make premium — treat as a gate.

**Orb state machine (the animation IS the status readout):** Idle (breathe) · Listening (rings
expand) · Thinking (reticle spins, ticks converge) · Revealing (arc-panel blooms, orb dims + docks) ·
Alert (amber reticle lock when a decision waits).

**Landing:** orb centered; the one persistent chrome is a **fancy top-center home pill** that expands
the rail as an overlay (theme toggle + ⌘K live there). Ambient = orb + greeting + 1–2 radial gauges.
Data appears only as **arc-panels that bloom** on command, then collapse.

**Premium stack:** React Three Fiber + drei + `@react-three/postprocessing` (orb, bloom) · GSAP
(bloom/collapse + surface fly-in) · Framer Motion (springs) · Web Audio `AnalyserNode` (voice phase) ·
ECharts + D3 + react-globe.gl (§4). Ship a **CSS/OGL lite orb** for low-power/mobile +
`prefers-reduced-motion`. Mobile: orb-first, single arc-panel, sticky bottom voice line, orb docks to
the bottom bar when a surface opens.

---

### 3.1 Landing (FINAL direction) — AI-Core Command Center, grounded

P1 shipped a minimal orb; the locked direction is richer: a **grounded AI-Core Command Center** — a
**huge** central CEO orb (dense hundreds-of-node knowledge-graph core = the Vault, polished
multi-ring radar dials) surrounded by **real-data panels**, a bottom control bar, **light + dark +
responsive**, and a **GSAP animated background** (drifting data-grid + particle drift toward the core).

**Fixes from P1 review (locked):**
- **One orb only** — hide the floating `AgentOrb` FAB on `home`; the center mic *is* the entry point.
- **Chat opens in the MIDDLE** — clicking the mic opens a **centered** conversation panel over the orb
  (not the corner AgentOrb). Reuse the agent pipeline; reposition/restyle for center.
- **Much bigger orb** (~60–70vh) with **hundreds of nodes** procedurally generated (sampled from real
  Vault size; count shown as a readout).
- **Polished radar rings** — graduated ticks, multiple counter-rotating dials, sweep (reference-grade).
- **GSAP background** — animated grid + particles flowing into the core; GSAP also drives panel
  entrance + the "reveal/bloom" choreography.
- **Light + dark, responsive** — the cockpit is theme-aware (follows HQ toggle): **dark** = deep-navy
  void + cyan/blue; **light** = near-white (`#f4f7fb`) + blue accents (`#2563eb`/`#0ea5e9`) + dark text,
  softer glows. Panels reflow (2-col → stacked) down to mobile.

**Panels → REAL data (included; no placeholder — live from RPCs):**

| Panel (ref) | Arganta panel | Source |
|---|---|---|
| AI Core Status | CEO Agent core (orb) · 27 agents · ONLINE | `agents.ts` roster + `agentSense` |
| Global Overview / world | **Reach** — Circles · Members · Active·7d | `hq_kinetik_stats` · `hq_growth_overview` |
| System Performance | **Performance** — Weekly active · Lessons/day · D1 return (sparklines) | `hq_growth_overview` · `hq_portfolio_vc` |
| North Star / alignment | **North Star** — weekly two-hook families + alignment vs target + WoW | `hq_growth_overview` |
| Predictive Insights | **Insights** — growth trend + monetization mid-case ARR / LTV:CAC | `northStar` + `monetization.ts` |
| Core Output (throughput) | **Diamond economy** — weekly mint-vs-burn bars + sink coverage | `hq_economy` (`mintBurn`, `coverage`) |
| System Health (vitals) | **AARRR vitals** — 6 pillar gauges | `hq_portfolio_vc` |
| Active Automations | **Agent OS** — scenarios running / office status | `agents.ts` `deriveStatus` + `scenarios.ts` |
| Model Status | **AI/ML** — MCP→Claude/OpenAI · builders · mastery accuracy | `agents.ts` · `hq_growth_overview.accuracyPct` |
| Resource Allocation | **Activity mix** — what kids actually do (donut) | `hq_growth_overview.activityMix` |
| Bottom bar | Voice(mic) · HUD(toggle) · Data(→Growth) · Diagnostics(→Command) | store `go()` |

**Excluded (NOT our data — dropped, not faked):** CPU/GPU/disk/temp/power hardware vitals, PFLOPS/Tbps
throughput, threat-detection, generic "confidence %", literal ETA-in-days, and literal world geo
(no lat/lng yet → the "world" panel is Circles/reach, geo arcs are a *future* layer badged `simulated`).

**Charts:** real **D3.js / ECharts** for every panel (sparklines, mint-burn bars, AARRR gauges,
activity donut, growth trend); SVG/R3F for the orb. Every value live or an honest `—`.

**Library per visual (production — the inline concept widgets are throwaway sketches):**

| Visual | Library | Panel |
|---|---|---|
| Dotted world map + animated arcs | **D3.js + TopoJSON** (`world-atlas`) — *locked* | Reach / Global Overview |
| Multi-line charts | **ECharts** | Performance |
| Circle / %-ring gauge | **ECharts gauge** | Capacity · Integrity · vitals |
| Pie / doughnut | **ECharts pie** | Activity mix · automations ring |
| Brain / neural graph | **react-force-graph-2d** (canvas, d3-force) | Model Status brain + the giant core |
| Bar chart | **ECharts bar** | Core Output · Resource allocation |
| Single line / sparkline | **ECharts** (mini line) | per-metric trends |
| North Star bar + key number | **D3 / ECharts bar** + bound value | North Star |
| Central AI-core orb | bespoke SVG/Canvas radar over the force-graph core | centre |

One custom **ECharts light theme** (white cards, `#2563eb`/`#0ea5e9`, hairline grids) + a dark theme,
switched by the HQ toggle. **Geo = placeholder** (seeded region coords + arcs, badged) that **ports to
real "usage % by region"** when circle lat/lng lands — no faked precision.

**Entry / login (ported to the look):** the existing operator gate (`auth/Login.tsx`) becomes a **core-boot
screen** — the AI-core orb powers up (GSAP: rings spin in, nodes ignite), `CIRCLE HQ` wordmark, one
operator Google sign-in, a boot line (`AUTHENTICATING OPERATOR…`); on success the orb comes online and
the cockpit reveals. Light + dark, same palette — the door matches the room.

### 3.2 Landing data map — every visual → real metric → North Star (grounded to the 3 apps)

**North Star = W2F (Weekly Two-Hook Families):** a family where, in the same week, a **kid learned**
([A] ArgantaLab hook) **AND** a **parent coordinated their week** ([K] KinetikCircle hook). [L]
LashiraBloom = the co-op farm that amplifies retention on both. Kingdom lives inside [K].

| Visual | Metrics (by app) | Look | Motion / interaction | Raw source | Why → W2F |
|---|---|---|---|---|---|
| Central AI-core orb | 27 agents online · Vault node count · health | radar dials + dense force-graph core | rings rotate · nodes pulse on refresh · click = talk | `agentSense()` + Vault count | the pane that watches W2F |
| Reach (world map) | [A] learners · [K] circles/members · [L] farms | dotted map + glowing nodes + arcs | node pulse · arc draw · hover tooltip | `hq_kinetik_stats` · `hq_growth_overview` · geo=placeholder→usage% | pool of families that can become two-hook |
| Performance (multi-line) | [A] lessons/day, WAU, accuracy · [K] cal/day, moments/wk · [L] sessions/wk | 3 thin trend lines | draw-on · live append · crosshair | `hq_growth_overview` · `hq_portfolio_vc` · `hq_kinetik_stats` · `lashira_bloom_ledger` | both hooks' momentum |
| North Star (bar+number) | W2F count · alignment vs target · WoW | big number + alignment bar + delta | count-up (GSAP) · bar fill | `hq_portfolio_vc.flywheelCount`/familiesTotal + `kinetik_*` | the North Star itself |
| Insights (trend+forecast) | [A] economy trend + learn ARPU · [K] retention + sub ARPU · [L] uplift | line + dashed projection + ARR/LTV:CAC | projection draw · band fade | `hq_growth_overview.northStar` + `monetization.ts` + `hq_economy` | trajectory + fundability |
| Economy (mint vs burn) | [A] learning mints, shop spend · [K] circle wallet · [L] farm-sell/seed | green/magenta weekly bars + coverage% | bars grow · weekly append · hover | `hq_economy` (mintBurn, coverage) · `diamond_ledger` · `lashira_bloom_ledger` | reward loop that makes kids learn |
| AARRR vitals (6 gauges) | Acq[K] · Activation[A] · Engage[A] · Retention[A/K] · Referral[K] · Monetization | 6 %-ring gauges, health-coloured | sweep to value · hover | `hq_portfolio_vc` · `hq_growth_overview.stickiness` · `monetization.ts` | the funnel that produces W2F |
| Agent OS (automations) | deterministic scenarios across all 3 apps | status task-list | dots pulse · click = run live | `agents.ts deriveStatus` · `scenarios.ts` | watches W2F levers, flags blockers |
| AI/ML (brain graph) | [A] mastery accuracy · MCP→Claude/OpenAI · builders | neural force-graph + accuracy ring | nodes fire · edges flow | `hq_growth_overview.accuracyPct` · `skill_mastery` · `item_attempts` | adaptive mastery = the depth-hook engine |
| Activity mix (donut) | [A] journeys/quests/drills/openworld/games · [K] moments · [L] farm | doughnut by kind + legend | slices sweep · click = filter | `hq_growth_overview.activityMix` · `diamond_ledger` kinds | where engagement comes from |
| Bottom bar | Voice · HUD · Data→Growth · Diagnostics→Command | control strip + core button | hover glow · route | store `go()` | act on what's surfaced |

Every value live from an `hq_*` RPC or an honest `—`; geo is the only (badged) placeholder;
CPU/GPU/temp/PFLOPS/threat/fake-confidence are dropped, not faked.

### 3.3 Strategy Room — executive OPEX/CAPEX · revenue · valuation · growth (dual lens)

A cockpit toggle flips **Operational ↔ Strategy**: a **board lens** (revenue · valuation · growth ·
unit economics) and a **founder-technical lens** (OPEX by layer · $/active · break-even · runway).
**Pre-revenue reality:** revenue + valuation are **modeled projections anchored to real current
metrics** — badged `model` (not `live`), inputs shown + editable. Reuses engines already built:
`monetization.ts` (MRR/ARR/ARPU/LTV/LTV:CAC/payback + forecast), `scaleModel.ts` (**OPEX** per layer +
$/active vs $0.08 Treasury load), the valuation model + `valuation_snapshot`, `reports/financial.ts`
(P&L/runway), and the MCP CFO tools (`financial_model`, `valuation_estimate/levers/narrative`, `scale_model`).

**Real anchors:** families (`hq_kinetik_stats.circles`), actives (`hq_growth_overview.wau`), growth
(`wowPct`+`kFactor`+`d1Retention`), diamond economy (`hq_economy` mint/burn, spend/kid = pay-intent).

| Zone | Metric | Real/Modeled | Visual | Source |
|---|---|---|---|---|
| Revenue & growth | Est. MRR/ARR (Low·Mid·High) · growth curve · ARPU/conv | Modeled *from real* | fan chart + projection | `monetization.computeScenario`/`forecastCurve` |
| Valuation | Est. valuation (range) · levers · history | Modeled | number+band · tornado · line | valuation model · `valuation_snapshot` |
| Unit economics | LTV · CAC · LTV:CAC · payback · margin | Modeled | gauges | `computeScenario` |
| OPEX | infra $/mo by layer · $/active vs $0.08 · agent(flat) · burn | Modeled | stacked-area + scale slider · gauge | `scaleModel.costCurve`/`LAYERS` |
| CAPEX | build/IP investment: content · art (PixelLab) · IP (light — mostly OPEX + sweat equity) | one-time | small tiles | internal estimate |
| Break-even & runway | families to break-even · runway (cash÷burn) · NPV | Modeled | curve crossing + number | monetization×scaleModel · `financial.ts` |
| Founder-technical | cost-vs-scale 1k→1M · per-layer drill | Modeled | interactive slider | `scaleModel.LAYERS` |

**Honest CAPEX note:** a solo software startup has ~no true CAPEX — capital = content/curriculum, art
assets, IP, and founder time (sweat equity); everything else is OPEX. Model it as a small "build & IP"
tile; do not invent a capital line. Leverage = OPEX stays tiny (deterministic agents hold the LLM bill
flat) while modeled revenue compounds. **Charts:** ECharts (fan/stacked-area/gauge/line) + D3 (tornado).
**Ties to North Star:** revenue/valuation are the *downstream* of W2F — more two-hook families → more
paying families → higher ARR → higher valuation; the Strategy Room shows that chain end-to-end.

### 3.4 Build-ready sign-off

**Layout (light default · dark toggle · responsive):** topbar (brand · CEO-core status · **Operational↔Strategy
lens toggle** · theme · ⌘K) · left column (2 panels) · giant centre AI-core orb + capacity/integrity
badges + core-output · right column (2 panels) · bottom row (4 panels) · bottom control bar
(Voice · HUD · core · Data→Growth · Diagnostics→Command). **One orb only** (FAB hidden); **mic → centred
chat**. Strategy lens swaps the panels in place (revenue/OPEX/valuation/unit-econ/break-even/CAPEX).
Responsive 3-col→2-col→stacked; orb scales.

**Locked libraries:** D3 + TopoJSON (map) · ECharts (multi-line/bar/pie/gauge/fan/stacked-area, custom
light+dark theme) · react-force-graph-2d (brain + core) · GSAP (background + reveals) · bespoke radar orb.
**Rules:** live or honest `—`; revenue/valuation badged `model` (editable inputs, real-anchored); geo the
only placeholder; ungroundable metrics dropped.

**Build model:** **Opus** for 100% of the build (one coherent thread; ~95% engineering). Runtime AI =
Claude/OpenAI via MCP (separate). **Fable = not needed** — optional scoped garnish for the CEO agent's
spoken voice much later (P6), never the engine.

**P1.5 order (on “go”):** orb + panels first → then login → then Strategy lens. All behind the perf
gates (sampled force-graph, one WebGL context, lazy charts, pause-offscreen, 60fps/Lighthouse≥90).

## 4. Charts → deterministic commands (+ premium animated renderers)

One command registry (extend `SCENARIOS`): natural-language trigger → `routeIntent` → `run()` reads an
RPC → a `ChartData` → bloomed as an arc-panel (optionally `go()/goOffice()` to the full surface).

**Renderer swap (keep the `ChartData` contract, upgrade output):**

| Library | Role |
|---|---|
| **Apache ECharts** (+ `echarts-gl`) | Workhorse: line/bars/donut → gauge/radar/sunburst/sankey/treemap/calendar-heatmap. Canvas-fast, animated, tree-shakeable. |
| **D3.js** | Bespoke radial arc-panels + reticles (the cinematic HUD look). |
| **react-globe.gl** (three-globe/Three.js) | The animated globe — coordinate points + rising arcs. Same Three ecosystem as the orb. |
| deck.gl *(later)* | Only if geospatial data outgrows react-globe.gl. |

Extend `ChartData` with `gauge · radar · sunburst · treemap · sankey · globe` and register in
`CHART_KINDS`. `ChartView` becomes a thin adapter. All charts must honor `prefers-reduced-motion` and
re-theme cleanly for light + dark (ECharts theme objects from `--acc/--ok/--warn/--bad`).

**Command map**

Already wired: `growth-review` (line), `retention-triangle` (cohort), `acquisition-funnel` (bars),
`diamond-economy` (bars), `monetization-forecast` (bars), `content-coverage` (bars).

New: `activity-mix` (donut) · `economy-trend` (line) · `aarrr-scorecard` (kpis) · `north-star`
(kpis+line) · `treasury-pnl` (bars/kpis) · `resolve-queue` (kpis) · `agent-economics` (bars) ·
`coverage-xray` (gauge) · **`world-map` (globe, points + arcs)** · `office-radar` (radar) ·
`economy-flow` (sankey).

Office chips (`OFFICE_CHAT[office].chips`) are already deterministic commands — bind them to the orb's
office context.

**Globe data gap:** `circles`/`kinetik_people` have no lat/lng yet. Ship seeded/`simulated`
coordinates (badged) until real geodata lands — never present seeded points as measured.

---

## 5. Vault → Supabase knowledge base

**Target:** the base knowledge layer of the twin brain, Supabase-backed, agent-readable.

- Tables: `hq_vault_note` (id, owner, title, frontmatter jsonb, body, updated_at), `hq_vault_canvas`
  (jsonb). RLS operator/owner (mirror `hq_is_operator()`). Edges/graph stay **derived**
  (`graph.ts buildBacklinks`) — recompute, don't persist.
- Sync: keep `store.ts` local-first; debounced push + pull-on-load; localStorage = offline cache;
  `updated_at` conflict-handling before multi-device.
- **Auto-populate then curate:** one note per agent/office/scenario/metric + schema notes from
  `hq_schema_model`, densely wikilinked. Reuse `seed.ts`'s markdown-through-real-parser pattern.
- Wire to orb: "what did we decide about X?" → search Vault + bloom the note/graph. Later: write-back.

---

## 6. C-level agents — battle-test + gaps

Six offices are the org's source of truth (`OFFICES`); 27 agents reconcile under them (`AGENT_OFFICE`).
The orb is the CEO Agent by default and becomes the chief's agent inside an office.

| Office | Chief | Battle-test question |
|---|---|---|
| Bridge | CEO | "What's the one thing today?" |
| Operations | COO | "What should we deepen or cut?" |
| Technology | CTO | "What are we blind on?" |
| Treasury | CFO | "Are we cash-positive? model a change" |
| Legal | GC | "Any hold that could freeze revenue?" |
| The Guild | CAPO | "Which agent earns its tokens?" |

**Gaps:** (1) several office SLAs are placeholder/simulated — bind to real RPCs or badge honestly.
(2) `agentGenerate` covers 7 intents but ~30 office chips exist — expand routing so every chip has a
real deterministic answer before the LLM port. (3) CAPO token/ROI is placeholder — add metering at
LLM port. (4) `AGENT_OFFICE` collapses most agents into Operations — the Bridge "who needs a decision?"
needs a real per-office signal.

---

## 7. Habit loop + gap analysis (every step)

Engine = **Compounding** (reliable reward, investment compounds in *you*), not Hooked's slot machine.

| Step | Intended | GAP | Fix (phase) |
|---|---|---|---|
| Trigger (morning) | Orb greets with the daily brief | no proactive/scheduled trigger, no clock-awareness | clock greeting (P1); scheduled brief + push (P6) |
| Action (ask) | Voice or one-tap | no voice I/O; no audio-reactive orb | Web Speech + AnalyserNode (P5) |
| Reward (answer+chart) | Grounded answer blooms as arc-panel | rendered as chat bubble; needs operator login | bloom UI (P2); sticky session |
| **Investment (write-back)** | Every talk → linked Vault note | **does not exist — no compounding** | Supabase Vault (P3) + write-back (P4/P6) |
| Close (evening) | End-of-day synthesis | no evening ritual, `verdictState` unused in a loop | evening synthesis + verdict lifecycle (P4) |

Cross-cutting: auth friction (make the operator session sticky), `hq_activity` scale (materialize +
`pg_cron`), provenance (already solid — keep every simulated number badged), globe geodata.

---

## 8. Backend / scalability

- Keep the operator-gated `security definer` RPC pattern.
- Materialize hot aggregates (`hq_activity`, DAU/WAU/MAU, retention) via views + `pg_cron`; index
  `diamond_ledger(to_user, created_at)`, `node_progress(completed_at)`, `quest_progress(updated_at)`.
- Vault tables with RLS; single-operator now.
- Client caching: cache `agentSense()` per session (stale-while-revalidate).
- LLM-port readiness: only `agentGenerate` (+ maybe `routeIntent`) changes; deterministic path stays as
  the offline/over-budget fallback (`MODEL_META.det`).

---

## 9. Architecture Map tab — the backbone (current + future)

**The operating-system framing.** The architecture isn't a stack of parts — it's one **Arganta OS**
with the **CEO-Orb as the shell/kernel** at the top, governing everything through the **6 C-level
agents** (CEO·COO·CTO·CFO·GC·CAPO). Below them: apps (user-space), 27 agents (processes), AI/ML +
builders (runtime), the Vault (memory), a **Backend-as-a-Service** platform (tool ⇄ Supabase),
**PostgreSQL** (the store), and **Edge Hosting** (tool ⇄ Vercel). The backbone exists in code (`scaleModel.ts LAYERS` +
`graph/seed.ts`). Promote it into a **first-class `architecture` surface** (C4 container view) rendered
in React Flow.

**Corrections to the model — capability names, swappable tool pills.** Layers are named by *capability*
(vendor-agnostic, since the platform may change): **Relational store** = PostgreSQL (100+ tables);
**Backend-as-a-Service** = Auth·RLS·Storage·Realtime·Edge Fns·RPC; **Edge Hosting & CDN** = edge
compute + delivery. Today's vendors are shown as small **⇄ tool pills** (⇄ Supabase, ⇄ Vercel) —
explicitly swappable later. **AI/ML is NOW**, not future: the **4 AI builders** (App·Game·Content·Agent)
+ **MCP → Claude · OpenAI** + TensorFlow.js + deterministic engines (growth·monetization·valuation·scale·RCA·mastery·pixel).

| # | Layer | Owner | NOW | NEXT |
|---|---|---|---|---|
| ① | Visualization / UI | COO | **3 products** — ArgantaLab · KinetikCircle · **LashiraBloom** · unified by Circle HQ | CEO orb landing · WebGL globe · ECharts/D3 · light+dark |
| ② | Agent | CAPO/CEO | 27-agent OS · 6 offices · CEO orchestrator · S→C→M→G (det) | LLM port via MCP (Claude/OpenAI) · Vault write-back memory |
| ③ | AI / ML + Builders | CTO | **NOW:** 4 AI builders (App·Game·Content·Agent) · **MCP → Claude · OpenAI** · TensorFlow.js · engines (growth·monetization·valuation·scale·RCA) · learning mastery · pixel | embeddings · RAG retrieval · recommendation · content-gen |
| ④ | Data + Platform | CTO | **Relational store · PostgreSQL** (100+ tables) + **Backend-as-a-Service** [tool ⇄ Supabase] · Auth·RLS·Storage·Realtime·Edge Fns·RPC | pgvector · materialized views · pg_cron · Vault tables |
| ⑤ | Edge / delivery | CFO/CTO | **Edge Hosting & CDN** [tool ⇄ Vercel] · edge compute · CI/CD · 5+ projects | dedicated compute · read-replicas |

Extend `Layer` with `now[]`/`next[]` + per-app `state: 'live'|'mvp'|'planned'`; add LashiraBloom to
`LAYERS.ui` (Kingdom lives within KinetikCircle — not a separate UI app).

### The full data backbone — fully transparent (no pop-up)

The map's foundation is the real data spine — **~100+ tables, ~12 domains, 6 storage types** — shown by
**data type** (what kind of data). **Current and Future render everything inline, fully transparent** —
every table, column, and FK is a node (no modal to hide behind):

- **① Relational (PostgreSQL):** Identity/circles · Diamond economy · Learning engine · Progress/mastery ·
  Kinetik apps · HQ · Kingdom · Lashira.
- **② Artifacts (HTML/code):** Game Builder (`games`, `game_versions`) · App Builder (`hq_app_html`,
  `app_record`).
- **③ Media (Storage buckets):** **Moments = video + images** (`kinetik_post_media`) · pixel/game
  art (`pixel_asset`, `lashira_pixel_art`) · avatars · Kingdom art (CDN).
- **④ Realtime (presence/WS):** **Kingdom MMORPG map** (`kingdom_character_position`) · co-op sessions ·
  live reactions.
- **⑤ Events (append-only):** `diamond_ledger` · `learn_event` · `hq_event` · `kingdom_session_events` ·
  `artifact_telemetry` → unioned by `hq_activity`.
- **⑥ Vector (future — pgvector):** Vault embeddings · agent memory.

**Fully transparent (semantic zoom, no pop-up):** Current and Future are the true, complete backbone —
**all 100+ tables, all 27 agents, the full Vault knowledge base, and every app's features/components
are nodes on one zoomable React Flow canvas**, grouped into collapsible clusters. Low zoom = layers +
counts; zoom in = every table/agent/note/feature. Reuse `SchemaModel.tsx`'s ERD rendering *inline* as
the DB cluster (fed by `hq_schema_model`). **Simple** stays the collapsed overview with the NOW⇄NEXT
toggle; **Current/Future** hold nothing back.

### Rail placement + premium design language

**Rail:** Analytics group, **directly below HQ Vault** → `architecture` surface. Vault (knowledge) +
Architecture (structure) are the two adjacent "brain" tabs.

**Premium stack (no constraints):** React Flow (`@xyflow/react`) canvas + semantic zoom/sub-flows ·
custom **glassmorphism** nodes (`backdrop-filter`) with **neon per-layer glow** · custom **animated
edges** (SVG gradient stroke + flowing particle) · ELK.js/Dagre auto-layout · **GSAP** (intro cascade,
camera, future "build-in") · Framer Motion (hover/expand springs, drawer) · animated mesh-gradient +
drifting blobs for depth · optional R3F CEO-Orb crown with bloom above the canvas.

**Taste (follows the HQ theme — light default, dark follows the app together, not independent):**
clean HQ surfaces + hairline borders with a polished layer (soft glass, subtle glow, spring motion);
indigo `--acc` / magenta `--mag` accents; a **mini Jarvis-style CEO orb** (concentric rotating rings +
reticle ticks + pulsing core) as the crown; **all icons are custom SVG — no emoji**; hover lifts +
glow, click spring-expands a cluster, GSAP easing (never snaps).

**Big-data readout (the brain's scale):** the Knowledge & Data lane surfaces live counts to show scale —
**Vault knowledge graph in the millions of nodes**, **PostgreSQL data lake toward billions of rows**
(+ events/day throughput). **Real data only:** every number is a live COUNT / RPC read — the build
**never invents numbers** (honest empty states when there's no signal), consistent with the HQ
analytics principle.

**Page by page:**
- **① Simple** — CEO-Orb + **North Star live tracking of the 3 products** (registered · weekly logins ·
  retention · diamond economy · time spent) over a collapsed 5-band overview + NOW⇄NEXT toggle. The pitch.
- **② Current** — full canvas, all solid; semantic zoom: layer clusters → apps→features · offices→27
  agents · AI/ML→4 builders+MCP · DB→100+ tables (inline ERD) · Vault→note graph. Animated data-flow
  edges; realtime edges pulse. Everything inline.
- **③ Future full-scale** — same canvas; NEXT nodes as **holographic dashed neon** + the RAG lanes
  (embeddings·Vector-RAG·guardrails·rerank) build in (GSAP + particle assembly); inspector shows each
  future node's plan + the gap it closes.

Shared shell: glass topbar · neon segmented view-switcher · NOW⇄NEXT toggle · glass minimap · glass
inspector drawer · ⌘K fly-to search.

### Three views (one graph, phase-filtered) — built in React Flow

The tab also renders a **node-and-edge flow diagram** (NVIDIA-RAG-blueprint style) with a
`phase: 'now'|'next'` field on every node/edge, powering three views:

1. **Simple** — the 5-layer stack with a single NOW⇄NEXT toggle (dashed = future).
2. **Current** — the real today, all solid: apps → PostgreSQL (via Supabase) → operator RPCs →
   deterministic agent → CEO orb. No RAG, no vector store.
3. **Future full-scale** — the RAG blueprint: an *ingestion pipeline* (app events → stream/CDC →
   chunk/materialize → embeddings → Vector DB + Knowledge Graph; multimodal for Kinetik moments) and a
   *retrieval pipeline* (orb → guardrails → context manager → Vector-RAG + Graph-RAG → rerank → LLM →
   response bloom).

**Build library — React Flow (`@xyflow/react`)**: custom icon nodes, container/group nodes for lanes,
auto-layout via Dagre/ELK.js, zoom/pan; the 3 views + NOW⇄NEXT flip are filters over one phase-keyed
dataset. Mermaid for static export; Reaflow fallback. Dark blueprint theme + light variant.

**RAG-blueprint mapping (the future spine):** UI = orb · Guardrails = RLS+provenance (+child-safety
NEXT) · Context Manager = `agentSense` · Short-term memory = Vault write-back (NEXT) · LLM = det NOW →
Claude/OpenAI via MCP NEXT · Vector-RAG = pgvector over Vault (NEXT) · Graph-RAG = ownership graph (exists,
query NEXT) · Ingestion = table writes NOW → event stream + embeddings NEXT.

**8 architectural gaps to reach full-scale:** (1) no vector store/embeddings (pgvector); (2) no
GraphRAG retrieval over the ownership graph; (3) no event ingestion pipeline (bus/CDC + async
chunk/embed); (4) no reranking/hybrid retrieval; (5) no formalized guardrails layer
(child-safety/prompt-injection/PII); (6) no observability/RAG eval; (7) no multimodal ingestion
(Kinetik moments → captions); (8) short-term memory is ephemeral (→ Vault write-back). These 8 are the
current→future roadmap the tab visualizes.

### 3 products, unified by Circle HQ

The application is **3 products** (Landing = static marketing; Circle HQ = the OS, not a product):
- **ArgantaLab** (`apps/web`) — identity · diamonds · learning · games. Owns the `profiles`/`diamond_ledger` spine.
- **KinetikCircle** (`apps/kinetik`) — circles · **moments (video/image)** · calendar.
- **LashiraBloom** (`apps/lashira`) — circle farm · pixel art (MVP). Embeds into KinetikCircle.

**Circle HQ** (`apps/hq`) is the unifying OS — reads ALL domains via operator RPCs; the CEO-Orb + this
Architecture tab live here. All three products share one identity + wallet + circles (no per-app drift),
rendered as a premium hub-and-spoke — not a plain box diagram.

### Theme + page layout (the 3 architecture pages)

**Theme follows the Kinetik HQ design system** — indigo (`--acc #6366f1`) + magenta (`--mag #ff3d72`),
hairline borders, clean flat surfaces, **light-default**; light and dark **follow the app theme
together** (not an independent dark canvas), just more polished (soft glass, subtle glow, spring motion).

Shared shell: **topbar** with the 3-way **view-switcher** + **NOW⇄NEXT toggle** + theme · React Flow
**canvas** · **legend** · **minimap/zoom** · **inspector drawer** · ⌘K fly-to.
- **① Simple** — the pitch: CEO-Orb + **North Star live tracking of the 3 products** (registered ·
  weekly logins · retention · diamond economy · time spent) + a collapsed 5-band layer overview with the
  NOW⇄NEXT toggle. (Replaces the old C-level row.)
- **② Current** — the full transparent architecture, all solid: Control (CEO-Orb + C-level) → 3 apps
  → Agent OS + AI/ML builders → Vault + PostgreSQL → BaaS/Edge. Health
  strip on top; semantic zoom to every node.
- **③ Future** — **Current with the dashed future overlaid** on the same graph: net-new RAG pipelines
  (Guardrails·Context·Vector-RAG·Graph-RAG·LLM + Events·Stream·Embeddings·Multimodal) plus `→ next`
  upgrade tags on live nodes (Agent OS→LLM port, Vault→write-back, PostgreSQL→pgvector).

### Full app portfolio

| App | Path | Role | State |
|---|---|---|---|
| ArgantaLab | `apps/web` | Identity, diamonds, games, KinWorld, Quests, KinQuest RPG | live |
| KinetikCircle | `apps/kinetik` | Family calendar/moments; embeds Bloom | live |
| Circle HQ | `apps/hq` | Founder OS — this twin brain | live |
| Landing | `apps/landing` | Marketing / company profile | live |
| Kingdom | `apps/kingdom` | Kingdom Command + Heroes (MMORPG lab) | live |
| **LashiraBloom** | `apps/lashira` | Farming RPG — game + Bloom Command — **locked MVP** | MVP (deployed) |

### LashiraBloom mapping (locked MVP)

Built, verified, deployed (`lashirabloom-game.vercel.app` + `lashirabloom-command.vercel.app`) but
absent from HQ. Add in 3 additive places: a 3rd **Portfolio** `AppCard`; an `app.lashira` node in the
**ownership graph** (tabs Farm/Town/City/Mining/Dungeon + economy split kid→+1 XP / adult→+Diamonds);
and the **UI layer** of the arch map. Key facts: reuses Kingdom Heroes engine; **circle-owned co-op
farm**; **Diamond-only** economy (kids earn XP not diamonds — preserves learn-to-earn); embeds via
`?embed=` + postMessage. Gaps: Tier-2 cloud save (`lashira_farm` + realtime) not built; keep art on
the procedural/PixelLab path (external-tool asset contamination has recurred).

---

## 10. Phased roadmap (UI/UX first)

- **P0** — Concept lock (this doc); orb state storyboard (5 states × light+dark); arc-panel contract.
- **P0.5** — Architecture Map tab + portfolio: promote `ArchMap` to `architecture` surface with
  NOW/NEXT; add Kingdom + LashiraBloom to UI layer, graph seed, 3rd Portfolio card. Mostly additive.
- **P1** — Cinematic shell, ambient only: `home` surface = orb-in-void + top-center home button;
  clock greeting; light+dark orb. Default landing → `home`.
- **P2** — Deterministic diagnostics + premium charts: swap `ChartView` to ECharts/D3/globe adapter;
  ask/tap → arc-panel blooms a real animated chart; add new commands incl. gauge/radar/sankey/globe.
- **P3** — Vault as Supabase knowledge base: schema + sync; auto-generate + curate; orb recalls.
- **P4** — Navigation blooms + evening close: intents fly full surfaces behind the docked orb; verdict
  loop; evening synthesis.
- **P5** — Motion & depth polish: R3F 3D orb, GSAP bloom/collapse, reticle states, mobile lite-orb.
- **P6** — Voice + write-back + proactive brief.
- **P7** — LLM port **via MCP**: route `agentGenerate`/`routeIntent` to **Claude / ChatGPT through MCP**
  (model-agnostic); deterministic path stays the always-on fallback.

**Verification per phase:** offline shell (`hq-offline`, port 5179) shows ambient + empty states;
with an operator session every command blooms a real chart or an honest empty state (no mock numbers);
light/dark both read premium; habit loop walks end-to-end; mobile orb-first + reduced-motion lite orb.

**Out of scope for first build:** real LLM calls (P7), multi-operator Vault conflict resolution, push
(P6), CAPO token accounting. All additive; none change the deterministic contract.
