# Followups (for Opus/Sonnet after Fable)

> Anything Fable couldn't finish on July 7. Written so a cheaper model continues with zero
> re-discovery. Full detail: fable-handoff/PLAN-followup.md (this is the vault-side mirror).

## Blocked on access (do first when repo is mounted)
1. **Repo scan** — fill PLAN-instrumentation-wiring.md Step 0 (find the live-signal Supabase
   convention, locate owning components). Acceptance: Step 0 section filled in, no guesses.
2. **Wire the 15 blind nodes** — batches A→C per the plan. Acceptance: fresh office_report
   shows provenance moved; coverage.pct ≥ 90.
3. **Re-mine [[persona-core]]** from raw session history (~/.claude/projects) + old vault —
   current version is sourced from curated docs only; the 5 open questions need evidence.

## Decisions needed from Aldyth (minutes each)
4. Canonical conversion assumption: 2% (consult flag) or 4% (CFO model mid-case)?
5. Confirm Bridge endpoint = production graph, not seed (blocks trusting any badge).
6. Review persona-core — especially the #inferred claims and open questions.
7. Install new-skills/*.md into .claude/skills/; drop this vault into Obsidian.

## Build queue (after the above)
8. persona-core-integration skill (prompt 02 Phase 2) — wire persona into Bridge agent.
9. Vector DB over vault + history (prompt 02 Phase 1) — keep separate from the graph.
10. Router P1: GitHub+Supabase connectors, run-log → Supabase under Guild (makes agent_roi live).
11. Router P2: graph write-path — first real verdict resolve (all 76 currently frozen at "proposed").
12. Media pipeline dry-run (Firecrawl → concept → Pixa/Higgsfield → Drive).

## Links
- Roadmap: [[roadmap-tracker]] · Spec: fable-handoff/ORCHESTRATION-SPEC.html
