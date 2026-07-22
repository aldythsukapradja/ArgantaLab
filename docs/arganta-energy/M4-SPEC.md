# M4 — Reasoning · Governance · Insight (the remaining platform surfaces)
2026-07-22 · Fable spec. Fills the three still-stub domains in the Intelligence + Command Center zones. Deterministic-first; the sovereignty/governance wall is the safety-relevant part (Fable-designed here), implementation is Opus. Visual SOP applies (interactive, premium; see `arganta-energy-visual-sop`).

## Where they sit (shell v2)
- **Reasoning** — Intelligence zone (the "smart" compute layer, distinct from the conversational Cosmonaut orb).
- **Governance** — inside Command Center (sub-tab of Core).
- **Insight** — Intelligence zone (top of the ladder: dashboards/decisions).

## 1 · Reasoning (Intelligence ▸ Reasoning) — the tier ladder & run governance
The deterministic→ML→LLM engine surface. This is the app's OWN runtime intelligence (not which Claude built it). Reconciles the sovereignty ladder with the `@arganta/ai` four-tier router.

### Tier rack (visible, honest)
| Tier | Runs | Data classes | Status in v1 |
|---|---|---|---|
| **0A Deterministic code** | engine math, extraction, keyword NLU | ALL (incl. restricted) | **ACTIVE** (everything today) |
| **0B ML (local)** | small ONNX models (anomaly, log QC, facies hint) — browser, no server | ALL | seam declared, not wired |
| **1–2 Sovereign LLM** | self-host (Ollama/vLLM) narrative synthesis on computed results | public/internal only | seam, locked |
| **3 Frontier LLM** | Claude API, exception-approved | sanitized only | seam, locked |

### The governance WALL (safety-critical — Fable-designed)
- **Data classification gate**: every context carries a class ∈ {public, internal, confidential, restricted}. A hard rule table maps class → max allowed tier. **Restricted context NEVER leaves Tier 0** ("shares code, never data"). The router refuses (and shows why) any request that would send a higher-than-allowed class to an external tier.
- **Truthful run envelope**: every reasoning run records task, actor, inputs (asset+evidence ids), the ACTUAL tier/provider/model used (never hide the real provider), route reason, typed tool calls, schema/ontology versions, validation, approval, cost/tokens, and state mutations. Rendered as an auditable run card.
- **No self-approval / no self-mutation**: an agent run cannot approve itself; mutations require an explicit approval grant + append-only audit (ties to Governance).
- **Sanitization**: when a higher tier IS permitted, the context is sanitized (strip restricted fields) and the sanitized payload is shown before send.

### Viewer
- Tier rack (live status), a **route simulator**: pick a task + data class → see which tier it routes to and why (deterministic, visible trace: classify → check class → select tier → ground → attach evidence). Run-envelope cards for past runs. All LLM tiers render as declared-but-locked seams with the exact upgrade path. Interactive, premium.

## 2 · Governance (Command Center ▸ Governance) — evidence, lineage, audit
- **Evidence ledger view**: the 1,002-file mirror manifest (path, sha256, size, retrievedAt) + which processed rows/claims resolve to each. Search + drill from any value → its evidence.
- **Lineage graph**: measured source → deterministic transform (versioned) → derived output — a DAG (interactive, Sigma/canvas, per the visual SOP) showing provenance for a selected asset/claim. dbt-docs-style.
- **Checks dashboard**: the validate.mjs / schema-check.mjs / test-engine results (orphan ledger, FK integrity, STOIIP corridor, cum-oil reconcile, TVD≤MD) as live green/red tiles with the actual numbers.
- **Contradiction & data-nature audit**: claims flagged conflict/draft/unsupported; a tally of values by dataNature (measured/reported/interpreted/derived/scenario) with the rule "nothing computed shown as measured" enforced + any violations surfaced.
- **Append-only audit trail**: mutations + approvals (there are none in read-only v1 → show the empty, ready ledger + the policy).
- **Portability readiness**: OSDU-alignment status (group-type tagging coverage), export readiness — "aligned, not certified."

## 3 · Insight (Intelligence ▸ Insight) — dashboards / decisions ("so what")
The top of the data-to-insight ladder. Synthesizes across the platform into decision-ready views.
- **Field KPI board**: production totals/rates, well coverage, reserves screening (STOIIP spread + the honest screening/volumetric/dynamic anchors), data completeness — live from wb/processed, each tile evidence-linked + dataNature-badged.
- **Briefing generator (deterministic)**: a one-page field brief assembled from computed facts (no LLM) — "state of Volve" with the numbers + provenance; optional LLM narrative behind the Tier gate (locked in v1).
- **Decision cards**: e.g. "next-well candidate" (from coverage gaps / sweet-spot scan), "surveillance flags" — each a deterministic recommendation with evidence + a truthful "screening, not advice" label.
- Premium interactive charts (visx/canvas), both themes.

## Engine/shared additions
- `src/reasoning/router.ts` — data-class → tier gate + route trace + run-envelope type (reuses the Cosmonaut router's classification; formalizes the wall). Pure, testable (assert restricted→Tier0 always).
- Governance reads existing manifests/validation outputs — mostly a viewer over data we already produce.
- Insight reuses foundation.json + wb + engine; briefing is a deterministic template.

## Phasing
Lower urgency than V1 (the flagship). But **Governance is the cheapest high-credibility win** — it's mostly a premium viewer over the evidence/validation we ALREADY generate, and it directly showcases the wedge (evidence-grounded, auditable). Suggest: Governance first (quick, high-wedge-value), then Reasoning (the tier-ladder + wall), then Insight (after more verticals exist to synthesize).

## Acceptance
Reasoning: route simulator correctly refuses restricted→external, run cards truthful, tiers honestly locked. Governance: evidence drill-through works, lineage DAG interactive, checks tiles show real numbers, dataNature audit enforced. Insight: KPI board live from real data, briefing deterministic + provenance. All: interactive/premium per SOP, both themes, tsc+build green, no console errors.
