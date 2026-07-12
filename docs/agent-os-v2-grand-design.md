# Circle Agent OS v2 — "The Company" · Grand Design

**Status:** design (Fable, 2026-07-12). Implementation → Opus.
**Thesis:** keep the C-Level agents exactly where they are (Command's six offices), but rebuild
the child layer so every child agent is **paired to a real surface with real tools** — one build
agent per Build surface, one analytics agent per Analytics surface, plus registered slots for
future builders. The result is a genuine end-to-end agentic team: the human founder gives a
directive, the CEO Agent decomposes it, child agents *do the work with the builders' own
engines*, artifacts land in a review queue, the founder approves, the thing ships.

The one-line upgrade: **v1 agents talk about the company; v2 agents work in it.**

---

## Part 1 — Current state (audited 2026-07-12)

### 1.1 What exists (file map)

| Piece | Where | State |
|---|---|---|
| 27-agent roster (CEO + C-suite + tribes) | `apps/hq/src/data/agents.ts` | typed roster + Sense→Compute→Match→Generate→Deliver pipeline; Generate is LLM-backed with deterministic template fallback |
| 6 offices (Bridge/COO/CTO/CFO/GC/CAPO) | `apps/hq/src/data/graph/agents.ts` | offices own graph-node kinds; per-office chat briefs + chips |
| Product ontology graph + verdicts | `apps/hq/src/data/graph/{seed,engine}.ts` | verdicts **derived from node provenance** (placeholder→INSTRUMENT etc.), consults **seeded static**, verdict state in localStorage only |
| Command surface | `apps/hq/src/surfaces/command/*` | Lobby + 6 office tabs, verdict queue, consults, cockpits, reports |
| Agent Builder surface | `apps/hq/src/surfaces/Agents.tsx` | roster / orchestration / datamap / pipeline / council / tokens sub-tabs |
| LLM runtime | `packages/ai/src/{adapter,router,schemas,index}.js` | one surface (chat/chatJSON/chatTools/chatStream) over webllm / openai-compat / edge-proxy / mock; tiered router; never hard-fails |
| Runtime wiring | `apps/hq/src/lib/ai.ts` | edgeProxy when cloud on; **WEBLLM = null (off)**; mock fallback |
| Key proxy | `supabase/functions/llm-proxy/index.ts` | operator-gated, Gemini 2.0 Flash / Groq Llama-70B, keys as secrets |
| Agentic loop (P4) | `apps/hq/src/data/agentTools.ts` | 7 read-only tools + 4-step tool-calling loop `orchestrate()` |
| CEO chat orb | `apps/hq/src/components/AgentOrb.tsx` | office-aware chief chat; scenario launchers; inline reports/charts |
| MCP bridge | `apps/mcp/src/{server,bridge,tools,vault}.ts` | `ceo_ask`, `ceo_brief`, `office_report`, `graph_query`, `verdict_queue`, `root_cause`, `financial_model`, `scale_model`, `valuation_*`, `pixel_*` — read-only, deterministic seed graph |
| Prior design | `docs/circle-ai-llm-runtime-mapping.md` | the v1 runtime mapping (P1–P4, all built) |

### 1.2 Gap audit — what's real vs. theater

Tested by reading the execution paths end to end:

1. **No agent can act.** Every tool in `agentTools.ts` and `apps/mcp` is a *read*. The builders
   (Video, Music, Content/Post, Learn, Pixel, Character, Battle, Openworld, Game, App) all have
   real engines and publish pipelines — none is reachable by any agent. The org can diagnose;
   it cannot treat.
2. **The Build group has no agents.** 11 Build surfaces; the roster contains only "PM Game
   Builder" (an advisory Haiku card). Music/Video/Content/Character/Battle/Openworld/Pixel/App
   builders have **zero** paired agents.
3. **Analytics agents are partial.** Growth metrics flow through `agentSense`, but there is no
   Data agent (schema/RPC health as a charter), no Knowledge agent (HQ Vault kb is never used
   for grounding), no Architecture agent (ArchMap/scale model has no owner in the roster).
4. **Orchestration convening is cosmetic.** In `Agents.tsx → Orchestration`, the picked agents
   animate in with `setTimeout`, then `scenario.run()` executes the same deterministic query
   regardless of who was "convened." The `convene(agentIds, question)` tool designed in the v1
   mapping doc was never built.
5. **Council is hardcoded.** The debate lines in `Agents.tsx → Council` are string literals.
   Token Economics table likewise — `$2.20/mo` is a static estimate; nothing meters real usage.
6. **Two org models, weak reconciliation.** `AGENT_OFFICE` dumps 19 of 27 agents into
   `operations`. Tier taxonomy (`argantalab`/`kinetik`/`growth`/…) and office taxonomy coexist;
   the roster doesn't know about surfaces at all.
7. **No memory.** Agent outputs are never persisted. Every orb conversation starts from zero.
   No runs ledger, no artifact history, no way for CAPO to compute real ROI.
8. **No autonomy.** Agents run only when the founder opens the orb and types. No schedule
   (the daily brief is generated on demand, not delivered daily), no event triggers (a signal
   going red does not wake anyone).
9. **Verdicts don't come from agents.** They're derived from graph-node provenance by pure
   rules; agents can't file one. Resolution state lives in localStorage and feeds back nowhere.
10. **Model labels are fiction.** UI says "Sonnet 4.6 / Haiku 4.5"; the runtime serves Gemini
    Flash / Groq Llama / mock. Harmless as branding, dishonest as provenance — and this app's
    whole identity is provenance badges.
11. **The orchestrator loop is shallow.** Max 4 steps, single agent (the CEO), tool results
    truncated to 2,000 chars, no delegation, no parallelism.
12. **MCP bridge is a separate island.** `apps/mcp` re-implements CEO logic against a
    deterministic seed, disconnected from the live in-app tools. Two `ceo_ask` brains that can
    drift.

### 1.3 What is genuinely good (keep, don't rebuild)

- **The deterministic spine.** Sense→Compute→Match on live SQL, LLM only at Generate, honest
  fallback everywhere. This is the correct grounding architecture — v2 extends it, never
  replaces it.
- **`@arganta/ai`.** The adapter/router/tiering design is exactly right; it needs metering and
  a couple of task classes, not a rewrite.
- **The office model.** Six chiefs over one ontology, verdicts with mandatory LADDERS_TO,
  provenance badges. This *is* the C-Level layer the founder wants to keep.
- **The llm-proxy pattern.** Operator-gated, keys server-side.

---

## Part 2 — Target architecture

### 2.0 Design principles (unchanged + new)

1. **Deterministic-first, LLM-last** — a child agent's tools do the heavy lifting; the model
   plans and phrases.
2. **Never fabricate** — every number carries provenance; offline degrades to honest empties.
3. **Agents propose, the founder disposes** — every *write* produces a **draft artifact** in a
   review queue. Nothing publishes without an explicit human approve (or a standing per-agent
   autopilot grant, revocable, off by default).
4. **One registry** — a single `AgentSpec` describes every agent; Command operates it, Agent
   Builder authors it, CAPO meters it, MCP exposes it.
5. **Tools are the universal seam** — every surface exports a tool pack; the same pack powers
   the in-app runner, the MCP bridge, and scheduled runs.

### 2.1 Org chart v2

```
Human Founder (chairman — approves artifacts, resolves verdicts)
└── CEO Agent (Bridge) — orchestrator: decompose → delegate → synthesize
    ├── COO Agent (Operations) ──── Analytics Guild
    │     ├── Growth Agent          (Growth surface: hq_growth_overview, hq_retention, hq_acquisition, engagement pipeline)
    │     ├── Data Agent            (Data surface: hq_schema_model, hq_schema_insights, RPC health, migration status)
    │     ├── Knowledge Agent       (HQ Vault: kb search/RAG — the grounding librarian for ALL agents)
    │     └── Architecture Agent    (Architecture surface: ArchMap, scale/cost model, coverage x-ray)
    ├── CTO Agent (Technology) ──── Build Guild (one agent per Build surface)
    │     ├── Pixel Agent           (Pixel Vault: pixel_query/facets/usage + PixelLab generation)
    │     ├── Game Agent            (Game Builder: Studio v2 spec engine — 15 genres)
    │     ├── App Agent             (App Builder: CircleHQ templated apps, 9-app scope)
    │     ├── Learn Agent           (Learn Builder: content matrix, item authoring, curriculum)
    │     ├── Content Agent         (Content Builder: postEngine, 6 platform presets, Copilot)
    │     ├── Battle Agent          (Battle Builder: SKILL_MATRIX, resist model, fairness benchmark)
    │     ├── Character Agent       (Character Forge: heroes-engine, skill forge, publish to games)
    │     ├── World Agent           (Openworld Builder: map/tileset pipeline)
    │     ├── Music Agent           (Music Builder: @arganta/audio composer + publish)
    │     ├── Video Agent           (Video Builder: @arganta/video director → storyboard → MP4)
    │     └── Agent-Smith           (Agent Builder: authors/edits AgentSpecs — CAPO's hands)
    ├── CFO Agent (Treasury)        (financial model, valuation, monetization, token-spend ledger)
    ├── GC Agent (Legal)            (COPPA/GDPR-K, UGC policy, artifact-review compliance gate)
    └── CAPO Agent (The Guild)      (agent ROI from the real runs ledger, improve/replace verdicts)
```

- **C-Level: unchanged** — same six offices, same Command tabs, same chiefs.
- **The v1 advisory roster (VP ArgantaLab, Kid Tester, Brand Director, …) collapses into
  charters**, not standalone agents: they become *persona lenses* the chiefs can invoke inside
  a mission (cheap: one prompt each), not 20 more registry rows. The registry holds agents that
  have **tools**; personas are prompt fragments. This kills the 27-agent sprawl while losing
  nothing.
- **Reporting rule:** Build Guild reports to CTO, Analytics Guild to COO, but any chief can
  *request* any guild agent through the CEO (consults become real messages — see 2.5).

### 2.2 The core contract: `AgentSpec`

One registry file (later: table) replaces both `data/agents.ts` tiers and the ad-hoc office map.

```ts
// apps/hq/src/data/agentos/spec.ts
export interface AgentSpec {
  id: string                    // 'video', 'growth', 'ceo', …
  name: string                  // 'Video Agent'
  office: OfficeId              // reports-to chief
  guild: 'clevel' | 'build' | 'analytics' | 'future'
  surface?: SurfaceId           // paired HQ surface ('video', 'growth', …) — deep-linkable
  charter: string               // the system-prompt mission (1 paragraph)
  personas?: string[]           // optional lenses (kid-tester, brand, demo…) usable in missions
  tools: string[]               // ids into the ToolRegistry — sense + act
  artifacts: ArtifactKind[]     // what it may draft ('video.project', 'post.draft', …)
  triggers: Trigger[]           // 'on-demand' | {cron} | {signal: nodeId, when: 'red'}
  tier: 0 | 1 | 2               // task tier default (router)
  autopilot: boolean            // may publish without approval? default false, founder-set
  slas: { key: string; label: string; target: number }[]
}
```

`AGENT_REGISTRY: AgentSpec[]` is the **single source of truth**. Command renders offices from
it; Agent Builder edits it; CAPO meters against it; the MCP server serves it.

### 2.3 The capability layer: `ToolRegistry` + tool packs

```
packages/agentos/            ← new shared package (sibling of @arganta/ai)
  src/registry.ts            // ToolRegistry: register/get/list; zod-validated args
  src/types.ts               // Tool, ToolPack, Artifact, Mission, Run
  src/runner.ts              // the mission runner (see 2.4)
  src/artifacts.ts           // draft → review → approve/reject/publish state machine
```

Every surface contributes a **tool pack** — sense tools (read) and act tools (write→draft):

| Pack | Sense tools (examples) | Act tools (draft artifacts) |
|---|---|---|
| `growth.pack` | `growth_overview`, `retention_cohorts`, `acquisition_funnel`, `engagement_beats` | `file_verdict(kind, target, laddersTo, rationale)` |
| `data.pack` | `schema_model`, `schema_insights`, `rpc_health`, `pending_migrations` | `file_verdict` |
| `knowledge.pack` | `kb_search(q)`, `kb_doc(id)`, `kb_related(id)` (over vault kb + docs/) | `draft_note(vaultPath, md)` |
| `architecture.pack` | `arch_map`, `scale_model(families)`, `coverage_xray` | `file_verdict` |
| `video.pack` | `list_projects`, `get_project` | `draft_video(prompt) → storyboard→project` (existing director.js), `render_mp4(projectId)` |
| `music.pack` | `list_tracks` | `draft_track(spec)` (composer), `publish_track(id)` *(gated)* |
| `content.pack` | `list_posts`, `platform_presets` | `draft_post(brief, platform)` (postEngine + Copilot) |
| `learn.pack` | `content_matrix`, `item_stats` | `draft_items(skill, n)` (batch authoring → review) |
| `pixel.pack` | `pixel_query/facets/usage/similar` (exists in apps/mcp — move to pack) | `request_generation(spec)` (PixelLab job) |
| `character.pack` | `list_characters`, `skill_matrix` | `draft_character(spec)`, `benchmark_fairness(...)` |
| `battle.pack` | `skill_matrix`, `resist_model` | `draft_skill_tuning(...)` → benchmark → review |
| `world.pack` | `list_maps`, `tile_inventory` | `draft_map_patch(...)` |
| `game.pack` | `studio_genres`, `list_games`, `game_scores` | `draft_game_spec(genre, brief)` |
| `app.pack` | `list_circle_apps`, `sdk_surface` | `draft_app_config(template, circle)` |
| `treasury.pack` | `financial_model`, `valuation_*`, `monetization` (exist) | `file_verdict(MONETIZE…)` |
| `legal.pack` | `open_holds`, `consent_coverage` | `file_hold(target, reason)` — the only agent that can block others' artifacts |
| `capo.pack` | `agent_runs(agentId)`, `agent_roi`, `token_ledger` | `file_verdict(IMPROVE/REPLACE)`, `draft_agent_spec` (Agent-Smith) |
| `ceo.pack` | `ceo_brief`, `root_cause`, all sense packs | `convene(agentIds, question)`, `delegate(agentId, task)`, `plan_mission(directive)` |

Rules:
- **Act tools never publish.** They create an `Artifact` row in `draft` state. `publish_*`
  tools exist but check `autopilot || artifact.approved`.
- **Every tool result is `{ ok, data, source }`** — provenance flows through to the transcript.
- The existing `AGENT_TOOLS` (7 read tools) becomes the seed of `ceo.pack` + `growth.pack`.
- The MCP server (`apps/mcp`) is rewired to import packs from `packages/agentos` instead of
  duplicating logic — one brain, two mouths (in-app + MCP/Claude).

### 2.4 Orchestration v2: the Mission runner

Replace the 4-step single-agent loop with a persistent, delegating runner:

```
Founder directive ("we need a launch video for LashiraBloom and a post per platform")
  │
  ▼
CEO.plan_mission → Mission { goal, tasks: [{agentId:'video', task}, {agentId:'content', task}…] }
  │                                    (chatJSON against MISSION_SCHEMA; founder sees & edits plan)
  ▼  for each task (parallelizable)
Child agent run:  system = spec.charter (+ requested personas)
                  tools  = its pack (sense + act)
                  loop   ≤ 8 steps, results persisted per step
  │
  ▼
Artifacts land in the Review Queue (draft) · verdicts land in the office Verdict Queue
  │
  ▼
CEO.synthesize → one report: what was produced, what needs approval, what's blocked
  │
  ▼
Founder approves artifacts → publish_* executes the real pipeline (MP4 render, post, item batch…)
```

- **Runner lives in `packages/agentos/src/runner.ts`**, UI-agnostic; AgentOrb and Command both
  render its state. Missions survive reload (persisted — see 2.6).
- **`convene`** = parallel one-shot: n agents each answer the same question over their own
  sense tools; CEO synthesizes. This makes Council **real** (and deletes the hardcoded strings).
- **Depth limits:** CEO ≤ 12 steps/mission, children ≤ 8, one level of delegation only
  (children cannot delegate) — keeps cost and failure modes bounded.
- **GC gate:** any artifact whose kind is flagged child-facing (`post`, `video`, `items`,
  `game`) is auto-consulted to the GC agent (one cheap classify pass) before it can be approved.

### 2.5 Verdicts, consults, and the review queue become live

- `file_verdict` writes real verdict rows (still validated: no LADDERS_TO → rejected).
  Derived-from-provenance verdicts remain as a deterministic floor, tagged `source:'engine'`
  vs `source:'agent'`.
- Consults become message rows between offices (created by `convene`/`delegate`), replacing
  the seeded statics in `graph/seed.ts`.
- **New Command element: Review Queue** on the Bridge tab — every draft artifact with preview,
  provenance, GC status, [Approve → publish] / [Reject → feedback]. Feedback text is stored on
  the run → the agent's next mission sees it (cheap learning loop).

### 2.6 Persistence: `migration_agent_os.sql`

```sql
create table agent_missions ( id uuid pk, directive text, plan jsonb, status text, created_by uuid, created_at, closed_at );
create table agent_runs     ( id uuid pk, mission_id uuid fk null, agent_id text, task text,
                              steps jsonb, tool_calls int, tokens_in int, tokens_out int,
                              provider text, model text, status text, error text, created_at );
create table agent_artifacts( id uuid pk, run_id uuid fk, agent_id text, kind text, title text,
                              payload jsonb, state text check (state in ('draft','approved','rejected','published')),
                              gc_status text, feedback text, created_at, decided_at );
create table agent_verdicts ( id uuid pk, office text, agent_id text null, kind text, target_node text,
                              ladders_to text, rationale text, state text, created_at, decided_at );
create table agent_consults ( id uuid pk, from_office text, to_office text, about text, note text, status text, created_at );
```
RLS: operator-only (same pattern as existing HQ tables). Offline: runner degrades to
localStorage ring buffer — honest, but missions don't survive across devices.

**This single migration turns CAPO real:** ROI = artifacts published / tokens spent, per agent,
from `agent_runs` + `agent_artifacts`. The Tokens sub-tab reads the ledger; the $2.20 table dies.

### 2.7 Autonomy ladder (per agent, founder-controlled)

| Level | Meaning | Mechanism |
|---|---|---|
| L0 on-demand | runs when asked (today's behavior) | orb / Command |
| L1 scheduled | daily brief actually delivered daily; weekly growth review | pg_cron or scheduled Edge Function → runner (pattern exists: `broadcast-autopilot`) |
| L2 event-triggered | signal turns red → owning agent senses, files a verdict, notifies | threshold check inside the scheduled tick |
| L3 autopilot | agent may publish its artifact kind without approval | `spec.autopilot=true`, per artifact kind, revocable in Command |

Default: everything L0; the daily brief moves to L1 in P5; L3 stays off until trust is earned —
CAPO's ROI board is exactly the evidence for granting it.

### 2.8 Model policy (kill the fiction)

- Replace `MODEL_META` branding with **runtime truth**: the pill shows the *actual* provider+
  model of the run (`gemini-2.0-flash`, `llama-3.3-70b`, `webllm`, `mock`) — data already
  returned by every call.
- Spec `tier` (0/1/2) replaces the `sonnet|haiku|det` field. Router unchanged. Add task classes
  `plan` (tier 1) and `synthesize` (tier 1) to `TASK_TIER`.
- Optional Tier 2: add `ANTHROPIC_API_KEY` support to llm-proxy (Claude for `plan`/`judge`) —
  the proxy registry already supports adding a provider in ~6 lines.

### 2.9 Future-build slots (the "gap" agents)

The registry ships with **inactive placeholder specs** so a future builder lands with an agent
day one (`guild:'future'`, greyed in Command until its surface/tool pack exists):

- **Quest Agent** — KinQuest content: drafts quest chains/regions from Learn items.
- **Economy Agent** — season/rank tuning (the "marathon" rule), diamond sink design; benchmarks
  against `rank-season-tuning` constraints.
- **Event Agent** — ArgantaCup: drafts circle competitions, prize configs.
- **Release Agent** — deploy checklists, migration-pending radar, Vercel build health.
- **Localization Agent** — id-ID/en content passes over Learn + posts.

Adding a builder = add an `AgentSpec` + a tool pack. Nothing else changes. That is the whole
point of the registry.

---

## Part 3 — UI deltas (small; Command stays the shape it is)

1. **Command → Bridge:** add the **Review Queue** (artifacts) and a **Missions** panel (live
   runner state: plan, per-task status, spend).
2. **Command → each office:** verdict queue now mixes `engine` + `agent` verdicts (badge shows
   which); consults become live rows.
3. **Command → Guild (CAPO):** real ROI board from `agent_runs`/`agent_artifacts`; autonomy
   toggles (L1/L2/L3 grants) live here.
4. **Agent Builder:** becomes the **spec editor** over `AGENT_REGISTRY` (create/edit charter,
   tools, triggers, SLAs — Agent-Smith's surface). Council sub-tab → runs a real `convene`.
   Tokens sub-tab → reads the ledger. Orchestration sub-tab → launches real missions.
5. **AgentOrb:** unchanged UX, new engine — office chats keep their chips; the Bridge orb gains
   "Run as mission" for multi-agent directives; tool steps render from persisted run steps
   (the pipeline animation becomes *real* progress).

---

## Part 4 — Build plan for Opus (each phase independently shippable)

### P0 — Unify the org (½ day, no behavior change)
`packages/agentos` skeleton + `AgentSpec` + `AGENT_REGISTRY` covering: 6 chiefs, 4 analytics,
11 build, 5 future slots. `data/agents.ts` roster/tiers re-derived from the registry (keep
exports so surfaces compile); v1 tribe agents → `personas` on their chief. Delete `AGENT_OFFICE`.
**Accept:** Command + Agent Builder render from the registry; typecheck green; UI identical.

### P1 — ToolRegistry + analytics packs (1 day)
`registry.ts`, `types.ts`; port `AGENT_TOOLS` → `ceo.pack`/`growth.pack`; add `data`,
`knowledge` (kb search over `vault/kb.generated.ts` + docs), `architecture`, `treasury` packs
(all wrap existing live RPCs/models). Child runs = charter + own pack via existing `orchestrate`
loop, selectable in the orb.
**Accept:** "Ask the Data Agent what migrations are pending" answers from live tools; Knowledge
Agent cites vault docs.

### P2 — Persistence + metering (1 day)
`migration_agent_os.sql`; runner writes runs/steps/tokens (providers return usage; meter in
`@arganta/ai` `call()`); CAPO board + Tokens tab read the ledger; model pills show runtime truth.
**Accept:** every orb interaction appears in `agent_runs` with real token counts; $2.20 table gone.

### P3 — Mission runner + review queue (1–2 days)
`runner.ts` (plan_mission via chatJSON, delegate, convene, synthesize, limits), `artifacts.ts`
state machine, Bridge Review Queue + Missions panel, Council → real convene.
**Accept:** a directive fans out to ≥2 child agents, artifacts land as drafts, founder
approves/rejects, mission survives reload.

### P4 — Build-agent act tools (flagship first) (2–3 days)
Order by existing pipeline maturity: **Video** (director.js exists) → **Content** (postEngine
exists) → **Learn** (item batch) → **Music** → **Pixel** (query exists; generation via PixelLab
job) → rest. GC auto-gate on child-facing kinds.
**Accept (flagship):** "make a 30s LashiraBloom teaser" → Video Agent drafts storyboard+project
→ approve → real MP4 renders. Same mission also yields platform post drafts from Content Agent.

### P5 — Autonomy L1/L2 (1 day)
Scheduled Edge Function `agent-tick` (cron): daily COO brief → persisted + notified; red-signal
watchdog files agent verdicts. Autonomy toggles in Guild.
**Accept:** founder receives the daily brief without opening the orb; a red guardrail produces
a verdict row within one tick.

### P6 — MCP rewire + future slots (1 day)
`apps/mcp` imports packs from `packages/agentos` (sense tools + read-only mission/artifact
queries; **no act tools over MCP** until explicitly enabled). Future-slot specs land greyed-out
in Command.
**Accept:** `ceo_ask` via MCP and via orb give the same grounded answer from the same code.

Total: ~7–9 focused days. P0–P2 are pure spine (safe); P3 is the leap; P4 is the payoff.

---

## Part 5 — Risks & decisions for the founder

1. **Free-tier tool-calling quality.** Gemini Flash tool use is decent but will occasionally
   plan poorly; the mission planner is the most model-sensitive piece. Mitigation: plan is
   founder-visible/editable before execution; optional Claude key for `plan` only (§2.8).
2. **Cost creep.** Missions multiply calls. Mitigation: metering lands *before* the runner
   (P2 before P3), per-mission step caps, CAPO board makes spend visible.
3. **Write-tool blast radius.** Draft-only + approval + GC gate + autopilot-off-by-default is
   the containment. Publish tools must be idempotent and reversible where possible.
4. **Registry migration churn.** P0 touches types many surfaces import — do it as one atomic
   commit with compat exports.
5. **Open question:** should Build Guild report to CTO (as designed) or to a new "Chief Build
   Officer"? Current design says CTO to keep the six offices stable — revisit only if the CTO
   tab gets crowded.
