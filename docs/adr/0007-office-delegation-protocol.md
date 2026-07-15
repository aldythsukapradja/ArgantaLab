---
title: "ADR 0007 — Office Delegation Protocol (grounded sub-agents)"
date: 2026-07-15
status: accepted (contract) · unimplemented (C6)
owner: Opus
tags: [adr, agentic, delegation, offices, governance, arganta-core]
---

# ADR 0007 — Office Delegation Protocol

## Status
Accepted as the C6 contract. Freezes *what a delegated office actually does*,
*which of the two existing office taxonomies is canonical and how they map*,
and *the governance rule for grounding an office in real data* — before Sonnet
wires it. Same posture as ADR-0004/0005/0006 (Opus writes the protocol, Sonnet
implements).

## Context
Two office systems exist today and don't meet:

- **`@arganta/agent/delegation.js`** (C1-frozen) — the 6 offices
  (`bridge/operations/technology/treasury/legal/roster` = `OfficeId`), each a
  `label`+`owns`+`keywords`. `routeConcern()` maps a question to an office.
  The `consult_office` tool (C3, `lib/core/tools.ts`) is the surface Arganta
  Core calls today: it frames the office as a **persona system prompt** ("you
  are the head of Treasury… answer concisely") and asks a Sponsored-tier model.
  Honest, but **ungrounded** — the office sees no real data, just its own name.
- **`apps/hq/src/data/agents.ts`** — a 27-agent roster with a real
  **Sense → Compute → Match → Generate → Deliver** pipeline (`agentSense` reads
  live Supabase RPCs; `agentCompute`/`agentMatch` are pure arithmetic/
  thresholds; `aiGenerate` calls a model **only at the Generate step, grounded
  in `agentFacts`** — the computed numbers, never free recall). `AGENT_OFFICE`
  already reroots all 27 agents under the 6 `OfficeId`s. But this pipeline is
  only reachable from the Agent OS surface — **never from Core's chat.**

C3's `consult_office` comment named this explicitly: *"reconciling the two
office taxonomies (OfficeId vs Tier) is C6's job; this tool's external contract
doesn't change when C6 deepens it."* This ADR is that reconciliation.

## Decision 1 — the 6 offices are the canonical lens; the roster is the depth
`OfficeId` (the 6 offices) is the **coarse lens** every delegation speaks. The
27-agent roster is the **depth under each office**, mapped by the existing
`AGENT_OFFICE`. A delegation to an office resolves to that office's **chief**
(its primary Sonnet executive) running the grounded pipeline:

| office | chief | grounded pipeline today |
|---|---|---|
| bridge | `ceo` (orchestrator) | — (synthesis role, see Decision 5) |
| operations | `coo` | ✅ growth/retention/content signals |
| technology | `cto` | 🟡 schema/telemetry (partial) |
| treasury | `cfo` | ✅ economy/monetization |
| legal | `gc` | 🟡 compliance (persona for now) |
| roster | *(no dedicated agent)* | the roster metadata itself (Decision 5) |

`consult_office`'s **external contract does not change** — it still takes
`{office?, question}` and returns a recommendation + a `delegation` block. What
changes is the *depth* behind it, exactly as C3 promised.

## Decision 2 — a delegated office is a GROUNDED advisor, not a nested actor
The whole point of C6 (vs C3's persona) is grounding. A delegation runs the
office's **Sense → Compute → Match → Generate** pipeline where one exists — the
model synthesizes over *real computed facts*, never free recall — and honestly
**degrades to the C3 persona prompt** where an office has no grounded pipeline
yet (legal, most of technology). The degrade is surfaced, not hidden
(Decision 4).

Explicitly **NOT** in C6 v1:
- **No nested tool loop.** An office is a single grounded *generation*, not a
  bounded agent loop of its own. Offices don't call `generate_image`, don't
  publish, don't spawn sub-delegations. This keeps delegation bounded (one
  extra model call), sidesteps recursion/budget explosion, and matches the
  existing `agents.ts` pipeline exactly.
- **No office-to-office / CEO-convenes-many.** The `ceo` orchestrator role
  (convene N offices, synthesize N positions) is real in the roster but is a
  *later* capability — its fan-out, budget, and conflict-resolution are their
  own design. C6 v1 is one founder question → one office → one grounded answer.

## Decision 3 — grounding in confidential data stays LOCAL (the governance call)
This is the decision that needs Opus, not wiring. The `operations`/`treasury`
pipelines read **live economy and growth data** — that is `confidential` under
ADR-0003 (the `analyze` tool is already `dataClass:'confidential'`, "real
revenue data → stays local"). A grounded office delegation is therefore a
**confidential operation**, and its rule is inherited unchanged from ADR-0003/
0004:

- A delegation that grounds in confidential live data **must run its Generate
  step at Tier 0 (`mustStayLocal`)** — the computed economy/growth facts must
  not ride an external (Sponsored+) provider. `delegationRequest` already
  threads `dataClass` for exactly this; C6 passes the *true* class
  (`confidential` when grounded in live data) instead of the current shallow
  `internal` shortcut, and lets the existing router (`selectModel` +
  governance) keep it local.
- If Tier 0 is unreachable (WebLLM is brittle — the standing audit gap), the
  delegation **degrades honestly**: it returns the deterministic
  Match-layer signals (which are pure arithmetic, no model, safe to show) with
  a clear "synthesis unavailable — local model offline" note, and **never**
  falls back to sending confidential facts to the gateway. Degrade down, never
  leak sideways — the same shape as every other honest-degrade in this system.
- A **persona-only** delegation (no live data grounding) stays `internal` and
  may use the Sponsored tier, as `consult_office` does today — there's no
  confidential data in the room, so nothing to keep local.

The dividing line is precise: **the dataClass of a delegation is the dataClass
of the data it grounds in.** Grounded-in-confidential ⇒ local-only. Persona-only
⇒ Sponsored is fine.

## Decision 4 — the delegation trail must show grounded-vs-degraded
The `delegation` block kind is already frozen (C1, `makeBlock('delegation',
{office, summary})`). C6's trail render adds, in the same provenance-chip
language the Model Rack and ArtifactCard already use, **whether the answer was
grounded or degraded**: which office + chief, the pipeline stages actually run
(Sense/Compute/Match/Generate, each with its model per `agents.ts` `PIPELINE`),
the data source (`supabase-live` / `offline`), and the tier the Generate step
ran at. "This recommendation is grounded in live data at Tier 0" and "this is a
persona opinion, no live data" are *different trust levels* and must read
differently — same truthfulness contract as every other surface.

## Decision 5 — bridge and roster are synthesis/meta, handled honestly
Two offices have no single grounded data pipeline, and C6 says so rather than
faking one:
- **`bridge` (ceo)** is orchestration/synthesis. In v1 it answers as the
  strategic persona (C3 behavior) — it does *not* secretly convene the other
  offices (that's the deferred orchestrator capability). Honest: a strategy
  question gets a strategy persona, not a fabricated multi-office consensus.
- **`roster`** is the meta-office (the agent org itself). It has no chief in
  `AGENT_OFFICE`; it answers from the **roster metadata** (`AGENTS`,
  `AGENT_OFFICE`, `agentGenerate`'s `agents` intent) — a real, grounded answer
  about the org, just grounded in static roster data rather than a live RPC.

## Alternatives considered
- **Give every office a full nested agent loop (real sub-agents that call
  tools).** Rejected for v1 — recursion, budget fan-out, and offices taking
  side-effecting actions are a much larger governance surface. A grounded
  single-generation advisor delivers the depth C6 promised without opening
  that door; the loop can come later behind its own ADR.
- **Route confidential grounding to Sponsored with a "trusted provider"
  carve-out.** Rejected — it would silently reverse ADR-0003's core rule for
  convenience. Confidential economy data does not leave Tier 0; if the local
  model is down, we show the deterministic signals and say synthesis is
  unavailable. Degrade, never leak.
- **Collapse the two taxonomies into one (drop the 6 offices, expose all 27
  agents to Core).** Rejected — 27 agents is the wrong granularity for a
  founder asking a question; the 6-office lens is the right coarse surface, and
  the roster is the depth *behind* it, not a replacement for it.
- **Merge `routeConcern` (office) and `routeIntent` (brief/economy) into one
  router.** Rejected — they're different axes. `routeConcern` picks the
  *office*; within an office, its chief + `routeIntent` picks the *framing*
  (treasury → CFO → economy-vs-monetization). Compose them, don't merge them.

## Consequences
- C6 (Sonnet) rewires `runConsultOffice` (`lib/core/tools.ts`) to resolve
  office → chief and run the grounded `agents.ts` pipeline, passing the true
  `dataClass` (confidential when grounded in live data) so the router keeps it
  local; degrading honestly to persona (internal, Sponsored OK) or to the
  deterministic Match signals (when Tier 0 is down) — never leaking confidential
  facts to the gateway. It surfaces grounded-vs-degraded in the `delegation`
  trail. The tool's **external contract is unchanged** (C3's promise kept).
- A likely **latent-gap correction**: `agents.ts aiGenerate` currently calls
  `ai.chat({task})` without an explicit `dataClass` — C6 verifies (does not
  assume) whether that already keeps confidential facts local, and fixes it if
  not. Verified at impl time against the real router, not asserted here.
- `consult_office`'s governance metadata stays `sideEffect:false`; a grounded
  advisor reads data and gives an opinion — it does not act — so it remains
  `autonomySafe:false` only for the human-eyeball reason (a delegation should
  be seen), not because it mutates anything.
- Offices-convene-offices, nested office loops, and the live `ceo` orchestrator
  remain explicitly deferred to a later batch + ADR.

## Related
- ADR-0003 (data-class governance) — the confidential-stays-local rule this
  inherits, unchanged.
- ADR-0004 (autonomous invocation) — the autonomy/dataClass threading a
  delegation reuses.
- `@arganta/agent/delegation.js` — the C1-frozen protocol surface (unchanged).
- `apps/hq/src/data/agents.ts` — the grounded 27-agent pipeline C6 routes into.
- `docs/agent-os-v2-grand-design.md` — the office/mission layer C6 is the first
  real step of.
