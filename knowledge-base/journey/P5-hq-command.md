---
type: journey-phase
phase: P5
dates: 2026-07-01 → 2026-07-03
commits: 61
status: frozen
tags: [arganta, journey, P5]
---

# P5 · HQ Command

> [!abstract] The company built itself a cockpit — fully instrumented, provenance-honest, for a plane still on the tarmac
> Three days, 61 commits: [[Circle HQ]] went from a lean insight-seam scaffold to a full Command program — a graph engine over one ownership ontology, 27 agents folded into six offices, office cockpits, Treasury projected to 2045, R1–R3 reports, root-cause analysis, verdicts, The Actuary, the Pixel Vault, and Studio v2 — plus the read-only MCP **Bridge**, the one P5-era surface that shipped clean and stayed shipped. Its defining act is honesty: every number wears a provenance badge, which is exactly why the dashboard truthfully reports an [[00-MASTER-KB#11 · Debt Register|empty room]].

## Shipped
*(from [[00-MASTER-KB#9 · Build Timeline — 22 days|§9]])*

- **Command tab · graph engine** — surfaces/command/* over data/graph/*, one ownership ontology; `COMMAND_AUDIT_TRAIL` marks P0–P4 done and code confirms it.
- **27 agents → 6 offices** — the guild reconciled under COO / CTO / CFO / GC / CAPO / Bridge; the tier taxonomy killed.
- **Office cockpits** — a per-office read surface each.
- **Treasury to 2045** — financial + scale models (`financial_model` / `scale_model`), Low case kept structurally *unprofitable* on purpose.
- **R1–R3 reports** — one composition engine (`Briefing.tsx` / `daily.ts`): Daily Briefing, board deck, financial report, present/export.
- **RCA · verdicts** — root-cause and a verdict queue.
- **The Actuary** — valuation tooling (`valuation_*`): estimate, history, levers, narrative.
- **Pixel Vault** — private login-walled asset store, migration + sync + signed-URL read (`PIXEL_VAULT`, `pixel/import`).
- **Studio v2** — the builder surface, rebuilt as a thin `BuilderShell` wrapper.
- **Bridge (MCP)** — a 941-LOC read-only server (`apps/mcp/src/*`) reusing `apps/hq/src/data/graph/*` with zero rebuild, always-on on Render — hands an LLM a CEO seat.
- **CEO Orb landing** — cinematic R3F reactor-orb + React-Flow Architecture map + GSAP (`CONCEPT_JARVIS_CEO`).

## Tried & abandoned / superseded

> [!warning] P5 is where aspiration outran ship — a heavy stack was "locked", then the light one shipped
> `CONCEPT_JARVIS_CEO` locked a premium concept in detail. The orb landing and Architecture map made it into code; most of the rest was quietly downgraded or left as concept.

| Locked / planned | Fate | Replaced by |
|---|---|---|
| **Premium viz stack** — ECharts · react-globe.gl · react-force-graph-2d · TensorFlow.js (`CONCEPT_JARVIS_CEO`) | not adopted | **recharts / d3 / custom-SVG** |
| **Vault → Supabase** ("locked decision") | never happened | **localStorage stayed** |
| **Voice · write-back · LLM port** | unbuilt concept | — |
| **The orb itself** — P1 minimal SVG | read live as a "sparse constellation" | **rebuilt P1.6 in React-Three-Fiber** after seeing it on screen |
| **7 domain report files** + `charts.tsx` 7-chart library + R3 interactions (RangePicker, DrillPath, rootCause, verdict lifecycle) (`COMMAND_REPORTS_PLAN`) | consolidated / trimmed | **one consolidated report path** + the handful of recharts widgets reports actually needed (gauge / cashflow / bars) |
| **Line-numbered GameBuilder.tsx refactor** — CatalogView/FeaturedStrip/GameCard/BuildView + `ResponsiveContainer.tsx` + `Skeleton.tsx` + `getThumbnailUrl` (`BUILD_PLAN_MOBILE_VISUALS`) | invalidated | **Studio v2** — the monolith rewritten as a thin `BuilderShell` wrapper; none of the named files exist |
| **HQ "Architecture (P0)" scaffold** — `contract/` · `insight/` · Pulse (`apps/hq/README`) | superseded, README never regenerated | **command-graph + reactor-orb + vault** layout; the seam *idea* survived, the file scaffold didn't |

> [!success] The zero-dep call that held
> The Vault knowledge graph was battle-tested (`KNOWLEDGE_GRAPH_REVIEW`) and deliberately shipped with **no graph library** — custom canvas-2D + custom force sim over Sigma.js / G6 / Cytoscape / React-Flow — with an in-repo `?vaultStress=N` harness proving **96fps at 1k nodes** and a documented swap-to-Sigma path past 2.5k. Zero dependencies until scale actually demands them.

## Decisions made here
*(from [[00-MASTER-KB#13 · Decision Log|§13]])*

| Date | Decision | Rationale | Holds? |
|---|---|---|---|
| **2026-07-01** | **27 agents → six offices** | reduce surface; kill the tier taxonomy | ✅ |
| — | **HQ read-only over ArgantaLabs tables** | cockpit ≠ engine | ✅ |
| — | **Bridge = deterministic seed, provenance-badged** | nothing fake renders as real | ✅ |

> [!note] The decision made in code, not the table
> `COMMAND_AUDIT_TRAIL`'s sharpest call never reached §13: **"activate the existing `hq_event`, don't build `product_event`."** Like P3's swap of `AppBuilder.tsx` for a shared shell, the reuse decision that mattered most happened between commits — build on the event table you already have, don't mint a parallel one.

## What it taught

> [!tip] A provenance badge is the honesty that also writes the indictment
> HQ is a fully built, correct cockpit — and the same badges that keep it honest are what prove it serves `simulated` / `placeholder` data over zero external users ([[00-MASTER-KB#11 · Debt Register|D8]], gated by [[00-MASTER-KB#11 · Debt Register|D1]]). "Nothing fake renders as real" is the right instinct; it just renders the emptiness *legible* instead of hiding it. A cockpit for a plane on the tarmac. → [[never-render-fake-as-real|provenance badge everything]]

- **Reuse over rebuild, again.** Activate `hq_event` instead of building `product_event`; reconcile 27 agents under 6 offices instead of a new tier taxonomy. The whole Command program is a disciplined join over surfaces that already existed — the same instinct that made `@arganta/combat` compound. → [[reuse-the-spine-dont-rebuild|reuse over rebuild]]
- **A report is a saved composition over one ontology — so build ONE composition engine, everything else is config.** That thesis shipped (`Briefing.tsx` / `daily.ts`). Its counter-lesson shipped too: the ambitious 7-chart `charts.tsx` contract got trimmed to the three widgets reports actually needed. Build the engine; don't pre-build the chart library it might one day want. → [[reuse-the-spine-dont-rebuild|one engine many configs]]
- **Zero dependencies until scale demands them — and prove the threshold.** The Vault graph chose custom canvas-2D over four mature libraries, then *earned* the call with a stress harness (96fps/1k) and a written swap-path. Discipline plus an honest weakness list (O(n²) repulsion, no label collision) beats reaching for a dep on reflex. → [[dont-add-a-dependency-before-scale-demands-it|zero dep until scale demands]]
- **Lock late — a "locked" premium stack is a plan you haven't rendered yet.** `CONCEPT_JARVIS_CEO` froze ECharts / globe / force-graph / TensorFlow and a Supabase Vault; recharts / d3 / localStorage shipped. The orb was even redesigned *mid-flight* (minimal SVG → R3F) once it was seen live. The doc's own caveat — "headless preview is 0×0, the 3D reactor needs the founder's eyes" — is the tell: for visual work, offscreen renders validate logic, not scale. Freeze a design only after a screen has pushed on it. → [[declare-when-you-supersede|lock late]] · **headless preview lies for visual work**
- **Honest-failure discipline is a design choice, not an accident.** The Low financial case was kept structurally unprofitable rather than nudged green; simulated revenue was badged, never printed bare. The instrument is built to refuse to flatter the founder — the same reservoir-P90 instinct that made the KB itself honest about `external_users: 0`.

## Links

- Neighbors · [[P4-landing-kinquest]] → **P5** → [[P6-lashirabloom]]
- Master · [[00-MASTER-KB#9 · Build Timeline — 22 days|§9 timeline]] · [[00-MASTER-KB#13 · Decision Log|§13 decisions]] · [[00-MASTER-KB#11 · Debt Register|§11 debt]] (D1, D8)
- Product built here · [[Circle HQ]] (Command graph · offices · reports · Actuary · Vault · Bridge)
- Shipped clean · `COMMAND_AUDIT_TRAIL` · `KNOWLEDGE_GRAPH_REVIEW` · `PIXEL_VAULT` · `apps/mcp/README` (the Bridge)
- Partial / drifted · `COMMAND_REPORTS_PLAN` (R2/R3 trimmed) · `CONCEPT_JARVIS_CEO` (premium stack dropped) · `apps/hq/README` (stale P0 scaffold)
- Superseded · `BUILD_PLAN_MOBILE_VISUALS` (line-numbered GameBuilder plan → Studio v2 rewrite)
