# PLAN-followup.md — everything unfinished after the scoped Fable recon
### July 7, 2026. Ordered by dependency, each with owner-model and blocker.

| # | Task | Owner | Blocked by | Notes |
|---|------|-------|-----------|-------|
| 1 | Repo scan (the un-run Phase 0 repo subagent) | Sonnet | Mount ArgantaLab repo root | Map screens/handlers/data writes; find where each blind event should live; fill PLAN-instrumentation-wiring Step 0 |
| 2 | Wire the 15 blind nodes | Sonnet | #1 | Follow PLAN-instrumentation-wiring.md batches A→C |
| 3 | Resolve conv assumption: 2% (consult flag) vs 4% (CFO model mid-case) | Aldyth (1 decision) | — | RECON §5. Pick canonical; update whichever source is wrong |
| 4 | Fill vault `[[TO FILL]]` markers (9 files; persona-core highest value) | Fable prompt 02 today, else Opus | Session history access | Vault skeleton itself verified OK |
| 5 | Write `effort-scorer` SKILL.md (draft provided in new-skills/) | Review: Aldyth | — | Threshold values need his judgment — that's persona, not boilerplate |
| 6 | Install new-skills/*.md into `.claude/skills/` + add rows to knowledge-graph-map | Aldyth (2 min) | — | Keep the no-orphan rule: both have ladders_to |
| 7 | ~~Orchestration spec (Layer-3 router)~~ **DONE** — see ORCHESTRATION-SPEC.html + new-skills/hq-router.md | Fable (July 7) | — | P0 = run the hq-router protocol manually, 20 logged loops; P1–P3 build order in spec §05 |
| 7b | Confirm Bridge endpoint is production, not seed graph | Aldyth | — | P0-blocking for graph-laddered runs (spec §06, RECON §9.1) |
| 8 | Phase 2 activation/conversion model | Sonnet | #2 + days of signal history | Do NOT run on hours of data — RECON §5 numbers are all simulated |
| 9 | Exercise the verdict resolve loop once end-to-end | Aldyth + any model | #2 | All 76 verdicts sit at "proposed"; resolve_latency SLA is placeholder — the loop has never run |
| 10 | Vault → Obsidian install + wikilink check | Aldyth | #4 | Unzip, open graph view, confirm no orphan files |

## Open discrepancies to not lose
- 15 placeholder badges vs coverage's 14 (app.landing rollup?) — confirm in Bridge server internals.
- 5 simulated badges vs coverage's 3 (valuation nodes outside the 76 denominator?) — same place.
- Memory recon never really ran: ~/.claude/projects and Obsidian history were out of scope. If prompt 02's persona mining also lacked them, persona-core claims need re-sourcing.
