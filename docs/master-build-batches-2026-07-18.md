# Master Build Batches — Fable / Opus / Sonnet streams

**Date:** 2026-07-18 · Consolidates every open plan from this session:
`character-forge-display-fix.md` · `agent-studio-revamp-spec.md` (AS-0…7) ·
`agent-os-v2-c-level-revamp.md` (CL-1…8) · `battle-test-2026-07-18-audit.md` (tracks B/C) ·
Tri-Brain T-track. Assignment rule: **Fable** = cross-cutting seams, drift-sensitive
architecture, judgment calls, audits. **Opus** = large multi-file feature builds against a
frozen spec. **Sonnet** = mechanical, precisely-specced work — renames, CSS, checklists,
query wiring — where a big model burns tokens for no gain.

Every batch = one session, one commit train, ends with `tsc && vite build` clean + the
listed acceptance. Batches are ordered; parallel-safe ones are marked ∥.

---

## Batch S1 — Sonnet · "Mechanical unblockers" *(first, cheap, unblocks everything)*

| Step | Work | Spec source |
|---|---|---|
| S1.1 | **AS-0** Character Forge CSS namespace fix (`.forge→.charforge`, `.cf-*`; verify Builder Forge untouched) | character-forge-display-fix.md (exact class list) |
| S1.2 | **AS-2** Renames + group swap: Agent Studio / Pixel Forge labels, MobileNav MGROUPS, CommandPalette hard-coded list, SURFACE_LABEL, launcher sheets — one commit, surface ids unchanged | agent-studio-revamp-spec.md §5 |
| S1.3 | **Migrations batch:** run + verify pending SQL (missions_engine, post_library, ig_plan, artifact_game_kind, core_projects, lashira_my_circles) against live Supabase; record which applied | memory index (each migration named) |
| S1.4 | **CL-8** Honest model badges: replace hardcoded "Sonnet 4.6/Haiku 4.5/$2.20" literals with ledger-derived provider/model or honest "not metered" | c-level-revamp §3 |

Acceptance: Character Forge renders 3 columns again; nav shows Agent Studio in Studio +
Pixel Forge in Forge; no fictional model label remains.

## Batch F1 — Fable · "Seams & canon" *(the drift-killers; small diffs, high judgment)*

| Step | Work | Why Fable |
|---|---|---|
| F1.1 | **AS-1** Extract `data/agentFabric.ts` (AGENT_NODES + probes out of Architecture.tsx, registry join over roster/offices/fabric); Architecture re-imports with zero visual delta | one-registry rule — getting this shape wrong re-creates the drift disease |
| F1.2 | **B1** `docs/canon.md`: vocabulary canon (diamonds not Argons; KinQuest regions not NUM World; Buddy/Kin naming; Founder Core vs Family Core split) — with founder sign-off questions inline | naming decisions ripple everywhere |
| F1.3 | **CL-5** One CEO brain: point MCP `ceo_ask`/`ceo_brief` at the live sense functions or demote to demo-only; decision recorded as ADR | architecture decision + external-contract change |

## Batch O1 — Opus · "C-Level grounding" *(pipelines against frozen spec)* ∥ with O2

| Step | Work |
|---|---|
| O1.1 | **CL-1** `techSense()` — comfyHealth + bridge probe + agent_runs aggregates + schemaInsights; CTO Match rules; add to GROUNDED_OFFICES |
| O1.2 | **CL-2** `capoSense()` — agent_runs cost/provider/office aggregates, SCR trend; kills $2.20 answers |
| O1.3 | **CL-3** `gcSense()` — safety posture moved to graph data + governance.js gates + bridge permission classes |
| O1.4 | **CL-4** Treasury AI-spend line (agent_runs spend; Claude/Codex badged unmetered) |
| O1.5 | **CL-6** `migration_verdicts.sql` + assumption/contradiction/kill-criteria tables; offices file verdicts from Match; Command queue reads Supabase |
| O1.6 | **CL-7** Office finding → Claude bridge-mission seam (facts as mission context) |

Acceptance: c-level-revamp §4 (six checks — CTO names real outages, CAPO cites real cost,
verdict survives reload, one CEO brain, no fictional badges).

## Batch O2 — Opus · "Agent Studio build" *(after S1.2 + F1.1)* ∥ with O1

| Step | Work |
|---|---|
| O2.1 | **AS-3** `.ags` Post-Studio chrome + Map tab: full-bleed React Flow canvas over agentFabric, inspector rail, live probe chips |
| O2.2 | **AS-4** Roster + Author tabs (registry CRUD, Copilot-style test pane on real consult_office; ungrounded offices honestly labeled) |
| O2.3 | **AS-5** Missions tab (bridge mission feed, approval queue, engine marks) |
| O2.4 | Delete Council/Orchestration/Pipeline/DataMap theater (fold pipeline card into Author) |

## Batch S2 — Sonnet · "Analytics wiring" *(after O1.2 + O2.1; queries specced by then)*

| Step | Work |
|---|---|
| S2.1 | **AS-6** Tokenomics tab: agent_runs aggregate queries → existing d3 chartkit; provenance badges; honest empty |
| S2.2 | **AS-7** Battle-test checklist run (bridge down / empty ledger / mobile sheets / both themes / Architecture unchanged) + fix trivial finds, escalate non-trivial |

## Batch O3 — Opus · "Battle-test cockpit + wedge" *(after O1; the product track)*

| Step | Work |
|---|---|
| O3.1 | **B2** Scorecard cockpit in Command (15 dims × 3 products, provenance-badged cells, decision bands, kill thresholds) |
| O3.2 | **C1** Learn→build unlock chain (KinQuest quest → Studio builder component) |
| O3.3 | **C2** Parent evidence digest in Kinetik (weekly skills+creations card) |
| O3.4 | **C3** Family share loop (creation → circle share → guardian reaction) |
| O3.5 | **T2/T3** BrainSeam component + studio adoption (kills llm-proxy dependency) |

## Batch F2 — Fable · "The verdict" *(last)*

| Step | Work |
|---|---|
| F2.1 | **B3** Run the scorecard honestly with grounded offices → per-product verdicts filed |
| F2.2 | **C4 scope** Safety stack v1 spec (consent, deletion, moderation) → freeze for an Opus batch |
| F2.3 | Full-system audit: Architecture Agents view ⇄ Agent Studio parity check, CL acceptance re-run, update memories |

---

## Dependency graph & token economics

```
S1 (Sonnet) ─→ F1 (Fable) ─→ O1 ∥ O2 (Opus) ─→ S2 (Sonnet) ─→ O3 (Opus) ─→ F2 (Fable)
```

- Sonnet takes ~30% of the steps (S1, S2) — the precisely-specced, grep-heavy, checklist
  work where frontier reasoning adds nothing. Biggest single saving: S1 (4 mechanical jobs
  that would burn a full Opus session).
- Opus carries the three heavy build batches (O1–O3) against frozen specs.
- Fable holds the two seam batches (F1, F2) where a wrong shape or a wrong verdict is
  expensive, plus this consolidation.
- Rule for every batch: if a step's spec turns out ambiguous mid-batch, STOP and kick it
  back to Fable rather than improvising — that's how the theater got built the first time.
