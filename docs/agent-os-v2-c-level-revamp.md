# C-Level Revamp — Step 1: Architecture ⨯ Office Mapping

**Status:** research + design (2026-07-18). Extends `docs/agent-os-v2-grand-design.md` §1.2
(gap audit of 2026-07-12) with everything that shipped since: tri-brain bridge, agent_runs
ledger, ComfyUI sovereign fabric, the Architecture → Agents view (real status probes).
**Thesis:** before the build/analytics child agents (v2 Part 2), revamp the SIX C-LEVEL
offices first — because today they are the *least grounded* layer of the whole agentic
system while claiming the *most authority*.

---

## 1 · Where each office stands today (audited, execution paths read)

Grounding levels: **grounded** = runs a real pipeline over live data ·
**persona** = LLM roleplay with no data spine · **static** = hardcoded/seed data.

| Office | Chief | In-app (`consult_office`, C6) | MCP server (`apps/mcp`) | Command surface | Honest grade |
|---|---|---|---|---|---|
| The Bridge | CEO | **persona** (no pipeline) | `ceo_ask`/`ceo_brief` on a **deterministic seed graph** | lobby + verdict queue (localStorage) | ⚠ persona with two drifting brains |
| Operations | COO | **grounded** — Sense→Compute→Match→Generate over live RPCs | seed | office tab + chips | ✅ best-in-class, keep |
| Technology | CTO | **persona** | seed | office tab | ⚠ worst gap — see §2 |
| Treasury | CFO | **grounded** — economy + monetization model | seed | office tab | ✅ good, missing AI-spend |
| Legal | GC | **persona** | seed | office tab | ⚠ persona; safety badges exist elsewhere |
| The Guild | CAPO | **static roster** | seed | office tab | ⚠ ROI is a hardcoded $2.20/mo |

Cross-cutting defects (all six):
- **Two `ceo_ask` brains** — the in-app tool loop and the MCP server answer the same
  questions from different data (live RPCs vs deterministic seed). They drift.
- **Verdicts don't persist** — localStorage only, no feedback loop, agents can't file them.
- **No office can act** — read-only everywhere; and none of them knows the tri-brain exists.
- **Model labels are fiction** — UI badges say Sonnet/Haiku; runtime serves Gemini/Groq/mock.

## 2 · The correlation map — architecture nodes × owning office

Every node in the Architecture surface (System + Agents views), assigned to the office that
should govern it, with what that office can actually SEE today. This is the target ownership
model for the revamp (add `office:` to `NodeDef` in step 2).

### The Bridge · CEO
| Architecture node | Status | CEO can see it today? |
|---|---|---|
| Founder / Command Core (`founder`, `core`) | partial | partially — orb chat, no mission overview |
| Tri-Brain seam (`ag-sovereign/claude/codex`) | built | **no** — CEO Agent doesn't know the brains exist |
| North Star + verdict queue | localStorage | yes (volatile) |

### Operations · COO
| Architecture node | Status | COO can see it today? |
|---|---|---|
| Client apps (`hqb/arganta/kinetik/lashira/landing`) | partial | yes — growthOverview, engagement RPCs |
| Usage telemetry (`beats`) | partial (migration pending) | partially |
| Controlled Surfaces / studios (`ag-s*`) | built | **no** — no studio output metrics (posts drafted, songs made) |

### Technology · CTO — *the biggest grounding gap*
| Architecture node | Status | CTO can see it today? |
|---|---|---|
| PostgreSQL / schema (`postgres`) | live | yes — schemaModel |
| Four-Tier Router (`router`, `ag-router`) | live, tested | **no** |
| LLM Gateway (`gateway`) — *known flaky* | partial | **no** — nobody watches the thing that silently mocks |
| Arganta Bridge (`ag-bridge`) | built, probe-able | **no** |
| ComfyUI (`ag-comfy`) — *probe exists: `comfyHealth()`* | built | **no** |
| CF Workers AI (`cfai`) | live | **no** |
| agent_runs ledger (`ledger`) | partial | **no** |
| Supabase/Cloudflare/Vercel spine + util | live | **no** |
The CTO office claims "efficiency + instrumentation coverage" and cannot see a single piece
of AI infrastructure. Meanwhile the **Agents view already probes bridge + ComfyUI live** —
the data exists in the same app, unwired to the office.

### Treasury · CFO
| Architecture node | Status | CFO can see it today? |
|---|---|---|
| Diamond economy (`hq_economy`, ledger) | live | yes |
| Monetization model | simulated (honest) | yes |
| AI spend: agent_runs costUsd, tier mix | partial | **no** — the "money lens on every lever" excludes the AI cost line |
| Claude/Codex plan usage (bridge missions) | unmetered | **no** — two ungoverned brains, invisible spend |

### Legal · GC
| Architecture node | Status | GC can see it today? |
|---|---|---|
| Trust & safety badges (Architecture `gov.safety[]`: consent/COPPA/retention) | encoded, static | **no** — badges live in Architecture.tsx, GC is pure persona |
| Autonomy gates / permissions.ts (bridge) | built | **no** |
| Data-class guardrails (governance.js) | live, tested | **no** |

### The Guild · CAPO
| Architecture node | Status | CAPO can see it today? |
|---|---|---|
| Agent roster (`roster`, 27 agents) | static | yes (static) |
| agent_runs ledger → real per-run cost/status | partial | **no** — ROI answer is a string literal |
| Bridge missions (persist.ts, engine field) | built | **no** |
| Sovereign Completion Rate (rack) | partial | **no** |

## 3 · The revamp — C-level first, step by step

Principle: **keep the COO/Treasury pattern (deterministic Sense→Compute→Match, LLM only at
Generate) and extend it to the other four offices.** No new org model, no new UI paradigm —
grounding, then teeth, then hands.

- **CL-1 · Ground the CTO (highest leverage, data already exists).**
  New `techSense()`: `comfyHealth()` + bridge WS probe + `agent_runs` aggregates (SCR,
  fallback rate, gateway failure rate) + schemaInsights + Supabase util. Match rules:
  "gateway failure > n% → FIX verdict", "bridge offline > 24h → INSTRUMENT". Add
  `technology` to `GROUNDED_OFFICES`. The Agents-view probes and the CTO now read one seam.
- **CL-2 · Ground CAPO on the real ledger.** `capoSense()` over `agent_runs`: cost by
  provider/tier, run counts by office/tool, SCR trend; bridge missions by engine.
  Kills the $2.20 literal. CAPO's IMPROVE/REPLACE verdicts get real denominators.
- **CL-3 · Ground the GC.** Move the safety posture (Architecture `gov.safety[]`) into
  graph data with provenance; `gcSense()` reads it + governance.js constants + bridge
  permission classes. GC chips answer from real gate configuration, not vibes.
- **CL-4 · CFO gets the AI cost line.** Extend `treasurySense()` with agent_runs spend and
  a plan-usage note for Claude/Codex (unmetered — badge it `placeholder` honestly until
  bridge missions log to agent_runs).
- **CL-5 · One CEO brain.** Bridge = synthesis over the five grounded offices (stack their
  Computed facts, one Generate). Retire the MCP seed-graph duplicate: point `apps/mcp`
  `ceo_ask` at the same sense functions (or mark it demo-only in its description).
- **CL-6 · Verdicts get a spine.** `migration_verdicts.sql` (office, kind, targetNode,
  laddersTo, status, rationale, created_by run_id). Offices FILE verdicts from Match rules;
  founder resolves in Command; resolution feeds back into the graph.
- **CL-7 · Offices meet the tri-brain.** Each office card in Command gets a "brief → mission"
  action: a grounded office finding can be handed to the Claude brain as a bridge mission
  (draft the fix, draft the content) with the office's facts as mission context. This is the
  C-level on-ramp to Agent OS v2's act-layer — advisory finding → gated action.
- **CL-8 · Honest model badges.** Replace hardcoded "Sonnet 4.6/Haiku 4.5" labels with the
  actual provider/model from each run (the ledger already carries it).

Step 2 of the broader plan (after CL-1…8): add `office:` ownership to Architecture NodeDefs
so the Agents view can color/filter by owning office — the map in §2 becomes visible
in-product. Step 3: Agent OS v2 child agents (build/analytics) under the now-grounded chiefs.

## 4 · Acceptance for the revamp

1. All six offices in `GROUNDED_OFFICES` (roster's grounding = the ledger, bridge's = synthesis).
2. Ask the CTO "what is broken right now?" with the bridge off and ComfyUI on → answer names
   the bridge as offline and the gateway failure rate, from probes/ledger, not persona.
3. Ask CAPO "what does the agent OS cost?" → real number from agent_runs, provider-attributed.
4. Verdict filed by an office survives a reload and appears in Command's queue from Supabase.
5. `ceo_ask` (in-app) and MCP `ceo_brief` cite the same numbers for the same question.
6. No UI badge names a model that didn't actually run.
