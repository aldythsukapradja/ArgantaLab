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

The 5-layer backbone already exists in code (`scaleModel.ts LAYERS` + `graph/seed.ts` ownership graph).
Promote it from a buried CTO cost model into a **first-class `architecture` surface** (C4 container
view) with **NOW/NEXT per layer**, rendered with D3/ECharts + the existing scale slider and layer
drawers + an ECharts sankey of data→agent→UI flow.

| # | Layer | Owner | NOW | NEXT |
|---|---|---|---|---|
| ① | Visualization / UI | COO | ArgantaLab · KinetikCircle · Circle HQ · Landing · Kingdom · **LashiraBloom** | CEO orb landing · WebGL globe · ECharts/D3 · light+dark |
| ② | Agent | CAPO/CEO | 27-agent OS · 6 offices · CEO orchestrator · S→C→M→G (det) | LLM port (Haiku+Sonnet) · Vault write-back memory |
| ③ | AI / ML *(mostly future)* | CTO | basic rules / Leitner | mastery adaptation · content-gen · recommendation · RCA |
| ④ | Data | CTO | Postgres · Auth·RLS · operator RPCs · diamond_ledger · identity spine | materialized views · pg_cron · Vault tables · geo coords · `lashira_farm` |
| ⑤ | Infra / Scale | CFO/CTO | Vercel edge · Supabase Pro | CDN · dedicated compute · read-replicas |

Extend `Layer` with `now[]`/`next[]` + per-app `state: 'live'|'mvp'|'planned'`; add Kingdom +
LashiraBloom to `LAYERS.ui`.

### Three views (one graph, phase-filtered) — built in React Flow

The tab also renders a **node-and-edge flow diagram** (NVIDIA-RAG-blueprint style) with a
`phase: 'now'|'next'` field on every node/edge, powering three views:

1. **Simple** — the 5-layer stack with a single NOW⇄NEXT toggle (dashed = future).
2. **Current** — the real today, all solid: apps → Supabase tables → operator RPCs → deterministic
   agent → CEO orb. No RAG, no vector store.
3. **Future full-scale** — the RAG blueprint: an *ingestion pipeline* (app events → stream/CDC →
   chunk/materialize → embeddings → Vector DB + Knowledge Graph; multimodal for Kinetik moments) and a
   *retrieval pipeline* (orb → guardrails → context manager → Vector-RAG + Graph-RAG → rerank → LLM →
   response bloom).

**Build library — React Flow (`@xyflow/react`)**: custom icon nodes, container/group nodes for lanes,
auto-layout via Dagre/ELK.js, zoom/pan; the 3 views + NOW⇄NEXT flip are filters over one phase-keyed
dataset. Mermaid for static export; Reaflow fallback. Dark blueprint theme + light variant.

**RAG-blueprint mapping (the future spine):** UI = orb · Guardrails = RLS+provenance (+child-safety
NEXT) · Context Manager = `agentSense` · Short-term memory = Vault write-back (NEXT) · LLM = det NOW →
Haiku+Sonnet NEXT · Vector-RAG = pgvector over Vault (NEXT) · Graph-RAG = ownership graph (exists,
query NEXT) · Ingestion = table writes NOW → event stream + embeddings NEXT.

**8 architectural gaps to reach full-scale:** (1) no vector store/embeddings (pgvector); (2) no
GraphRAG retrieval over the ownership graph; (3) no event ingestion pipeline (bus/CDC + async
chunk/embed); (4) no reranking/hybrid retrieval; (5) no formalized guardrails layer
(child-safety/prompt-injection/PII); (6) no observability/RAG eval; (7) no multimodal ingestion
(Kinetik moments → captions); (8) short-term memory is ephemeral (→ Vault write-back). These 8 are the
current→future roadmap the tab visualizes.

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
- **P7** — LLM port: swap `agentGenerate`/`routeIntent` (Haiku sense + Sonnet reason); det path stays.

**Verification per phase:** offline shell (`hq-offline`, port 5179) shows ambient + empty states;
with an operator session every command blooms a real chart or an honest empty state (no mock numbers);
light/dark both read premium; habit loop walks end-to-end; mobile orb-first + reduced-motion lite orb.

**Out of scope for first build:** real LLM calls (P7), multi-operator Vault conflict resolution, push
(P6), CAPO token accounting. All additive; none change the deterministic contract.
