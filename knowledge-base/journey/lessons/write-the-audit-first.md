---
type: lesson
status: living
tags: [arganta, lesson]
---

# Write the audit first — an adversarial pass on your own plan is worth more than the plan

> [!quote] The principle
> The strongest artifact in any burst is the one that turns a critical eye on itself: a coverage scoreboard, a battle-test, a recon that predicts its own failure. That instinct outlasts every plan it audits.

## Evidence
- `docs/lashirabloom/battle-command-audit.md` — distinguished three failure kinds precisely (carried-but-inert · game-reads-but-not-tunable · not-built-at-all) and named registry-as-DATA as *the* gap. An honest scorecard that stayed accurate as a map of what shipped.
- `docs/fable handoff/RECON.md` — an adversarial §9 pass that predicted the whole cluster would ship zero code. The prediction held exactly (KB debt D8 confirms the 15 nodes are still `placeholder`). "Rigor about your own blind spots outlasts the plan."
- `AUDIT-battle-test-and-habit-loop-consolidation.md` (openworld) — caught real regressions before users could (portals shadowing the castle/market, instant-teleport, two competing HUDs); the disciplined fix-order followed from the audit.
- `apps/hq/src/vault/KNOWLEDGE_GRAPH_REVIEW.md` — a battle-test with an in-repo stress harness (`?vaultStress=N`) proving 96fps at 1k nodes *and* an honest weakness list (O(n²) repulsion, no label collision).
- `apps/hq/COMMAND_AUDIT_TRAIL.md` — the reuse call ("activate `hq_event`, don't build `product_event`") came from auditing what already existed before adding tables.
- `career-thread.md` reframes it as a cross-domain signature: "found my dashboard was 22% blind and fixed measurement before optimizing" — the reservoir P10/P50/P90 instinct applied to product data.

## The pattern
A plan describes intent; an audit measures the gap between intent and reality and names the *one* load-bearing thing missing. Auditing first (or auditing your own recon) collapses concept sprawl into a short list of what actually matters, and — crucially — catches the mismatch before you build on top of it.

## Watch for
- The audit that names a #1 risk which then never gets fixed: `IMPL-habit-loops...` flagged blob read-modify-write clobber as the #1 circle-coop production bug and specced the append-ledger RPC — never built, so the risk is live in shipped code. Naming a risk is not closing it.
- A coverage number that never moves (`coverage-tracker.md`: 78%, one row, never re-pulled). An audit you don't re-run is a snapshot, not a discipline.
- Auditing the plan-space while the code-space stays untouched (the entire Fable cluster corrected 11→15 blind nodes on paper and shipped nothing).
