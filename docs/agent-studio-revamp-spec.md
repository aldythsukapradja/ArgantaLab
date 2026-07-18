# Agent Studio — Total Revamp Spec (was: Agent Builder)

**Date:** 2026-07-18 · **Status:** researched + battle-tested design, ready to build
**Renames:** Agent Builder → **Agent Studio** (moves Forge → Studio group) · Pixel Studio →
**Pixel Forge** (moves Studio → Forge group).
**Prime directive:** one agent registry, shared with Architecture's Agents view — the two
surfaces must read the SAME data or they drift like the two `ceo_ask` brains did.

---

## 1 · Benchmark research — what the best agent builders do

| Product | The pattern worth stealing | How it grounds into Arganta |
|---|---|---|
| **Microsoft Copilot Studio** | Left rail = named agents; center = the agent's **profile page** (instructions, knowledge, tools, triggers) with a **test pane** docked right; every agent has an Overview → Knowledge → Tools → Triggers → Analytics tab set | Agent detail view: mission/inputs/office/model + a live "consult" test pane wired to the REAL `consult_office` / bridge seam |
| **n8n** | Full-bleed node **canvas** end-to-end; executions list with per-run status/duration; pinned data; the canvas IS the product | The Map tab: React Flow canvas (already a dependency) edge-to-edge, Post-Studio chrome; `agent_runs` = the executions list |
| **LangGraph Studio / Flowise** | Graph = the actual runtime topology, not decoration; click node → state inspector | Nodes come from the live registry (offices, brains, tiers, fabric endpoints with real probes) — never a drawing |
| **Dify** | Per-app **observability**: token usage, cost, latency per run, provider breakdown | Tokenomics tab reads `agent_runs` (provider·model·costUsd·latency·status) — kills the fake $2.20 |
| **Zapier Agents / Relevance** | Agents shown as a **team you hire**: status chip, last activity, what it's allowed to do | Roster cards with derived status (live-data-lit), permission/gate badges from governance.js |

Synthesis: modern agent builders converge on **canvas + roster + per-agent profile +
executions + cost analytics**, with the canvas full-bleed and the truth coming from a runs
ledger. Arganta already owns every ingredient (React Flow, agent_runs, @arganta/ai tiers,
bridge probes, office pipelines) — they're just scattered across four files.

## 2 · Battle-testing the founder's idea (honest audit)

- **Full-bleed canvas: correct.** Current Agents.tsx is a centered card page; every
  benchmark uses edge-to-edge. Post Studio's `.pbx` chrome (rows: top bar / `minmax(0,1fr)`
  main / bottom strip; main: `1fr + 340px` inspector) is the right skeleton and keeps the
  studio-family feel. ✅ Adopt.
- **The swap (Pixel→Forge, Agents→Studio): coherent.** Forge group = things that MAKE assets
  (Game/World/Battle/Character/App/Content) — Pixel Forge fits exactly. Studio group = "X
  Studio" operating surfaces — Agent Studio fits the naming law. ✅ Adopt.
  ⚠ Risks: **CommandPalette hard-codes the surface list** (known gotcha), MobileNav
  `surfaces:` arrays, `SURFACE_LABEL`, launcher sheets — all four must move in one commit.
  Keep surface **ids** (`agents`, `pixel`) unchanged so store state/deep links survive;
  only labels and group membership change.
- **The trap to refuse:** rebuilding the v1 theater in prettier chrome. Council's debate is
  string literals; Orchestration's convening is `setTimeout` animation; Token Economics is a
  static table. The revamp DELETES these three tabs rather than restyling them — each returns
  only when its data source is real (council → multi-office consult; tokens → agent_runs).
  Honest empty beats animated fiction (house doctrine).
- **Missing from the founder's list, added:** approval/mission visibility. Copilot Studio's
  killer feature is seeing what the agent DID. The bridge already streams
  `awaiting_approval`/`done` events and persists missions — Agent Studio must show them, or
  it's a map of a country nobody lives in.

## 3 · The one-registry rule — Agent Studio ⇄ Architecture actually talking

Today there are FOUR agent sources: `data/agents.ts` (27 roster), `data/graph/agents.ts`
(6 offices), `Architecture.tsx` AGENT_NODES (25 fabric nodes + probes), MCP seed. Step one
of the build extracts a shared module:

```
apps/hq/src/data/agentFabric.ts
  export { BRAINS, TIERS, FABRIC, SURFACES }   // the AGENT_NODES data, moved out of Architecture.tsx
  export { probeBridge, probeComfy }            // the live probes, moved out too
  export { AGENT_REGISTRY }                     // roster ⨯ office ⨯ fabric join (one canonical shape)
  export { fetchRunStats }                      // agent_runs aggregates (cost, SCR, by-provider)
```

- **Architecture's Agents view** re-imports its nodes/probes from here (pure move, no visual
  change) — it becomes the *read-only atlas*.
- **Agent Studio** renders the same registry as its Map and Roster — it is the *operating
  room*. Same objects, same status dots, by construction. A node added in the registry
  appears in BOTH surfaces; drift is structurally impossible.
- `data/agents.ts` keeps the pipeline functions but its roster rows gain `fabric?: string`
  (which fabric node runs them) — closing the roster⇄infrastructure gap flagged in the
  C-level revamp doc (§2).

## 4 · The design — Post-Studio chrome, five sub-tabs

Shell: `.ags` grid rows `auto / minmax(0,1fr)`; main = `minmax(0,1fr) 340px` (canvas
end-to-end + right inspector rail; rail collapsible; ≤980px → bottom sheet). Top bar: title
capsule, sub-tab pills, live probe chips (Bridge · ComfyUI · Gateway), search.

1. **Map** *(default — the n8n moment)* — full-bleed React Flow canvas of AGENT_REGISTRY:
   Founder → Tri-Brain → Tiers → Fabric → Offices → 27 agents (collapsed per office,
   expandable), edges = control flow, live status dots. Click → inspector rail: identity,
   mission, model truth (from ledger, not labels), owning office, controls list, last runs.
2. **Roster** — the "team you hire" grid, grouped by office; status derived from live data
   (existing `deriveStatus`), gate badges, `fabric` chip. Click → same inspector.
3. **Missions** — bridge missions (persist.ts) + Core delegations: status chips
   (running/awaiting approval/done), engine mark (Claude/Codex), re-open into Core. The
   approval queue lives here.
4. **Tokenomics** — Dify-grade honesty from `agent_runs`: cost by provider/tier/office,
   Sovereign Completion Rate, fallback rate, latency; provenance-badged; honest empty state
   when the ledger is thin. (Absorbs Model Rack data via the same queries — Rack stays.)
5. **Author** — the old roster-editing intent, now real: edit an agent's mission/inputs/
   office/model floor in the registry, with a Copilot-Studio-style test pane that fires the
   REAL `consult_office` (grounded offices) or an honest "persona — not grounded yet" note
   (ties into CL-1…CL-3; as offices get grounded, the test pane lights up).

Deleted: Council, Orchestration, Pipeline-as-tab (the pipeline diagram becomes a card inside
Author), Data Map (its content folds into the inspector's per-agent "reads" list).

## 5 · Build steps

- **AS-0** Character Forge CSS fix first (separate doc) — it's the same namespace-collision
  class of bug this build must not repeat. Agent Studio prefixes everything `.ags-*`.
- **AS-1** Extract `agentFabric.ts` (registry + probes out of Architecture.tsx); Architecture
  re-imports; zero visual delta; tsc+build clean. *(the talking-to-each-other step)*
- **AS-2** Shell + renames in one commit: new `AgentStudio.tsx` with `.ags` chrome; label
  changes (Agent Studio / Pixel Forge); group moves in MobileNav MGROUPS + CommandPalette
  hard-coded list + SURFACE_LABEL + launcher sheets; surface ids unchanged.
- **AS-3** Map tab (React Flow canvas + inspector rail on the shared registry).
- **AS-4** Roster + Author tabs (registry CRUD in localStorage first, Supabase later;
  test pane on consult_office).
- **AS-5** Missions tab (bridge feed + persisted missions; approval chips).
- **AS-6** Tokenomics tab (agent_runs aggregates; delete $2.20 everywhere).
- **AS-7** Battle-test pass: bridge down → honest offline everywhere; empty ledger → honest
  empty; mobile sheets; both themes; Architecture Agents view still identical.

Dependencies: none on pending migrations (reads existing agent_runs); CL-track grounding
enriches Author/Tokenomics as it lands but doesn't block the shell.
