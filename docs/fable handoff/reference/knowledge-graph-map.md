# Skills ↔ Circle HQ Knowledge Graph Map

Every skill in this folder carries a `Knowledge graph link` line in its body.
This file is the reverse index — the graph's view of the skills, not the skills' view of the graph.
Keep both in sync when either changes.

| Skill file | ladders_to node | Office | Current health (as of this pull) |
|---|---|---|---|
| long-horizon-planner.md | `ns.w2f` via `lever.efficiency` | Technology | amber |
| adversarial-reviewer.md | `ns.w2f` (cross-office gate) | Bridge | amber |
| subagent-orchestrator.md | `hq.builders` | Technology | amber (partial) |
| context-compaction.md | `hq.data` | Technology | green (live) |
| activation-funnel-modeler.md | `lever.efficiency` | Technology | amber — **weakest lever in the graph** |
| kinetik-recommender.md | `lever.depth` | Operations | green (currently RETAIN, not growth) |
| arganta-design-system.md | `hq.builders`, `arch.vercel` | Technology | amber |
| arganta-gsap-cinematic.md | `hq.builders` | Technology | amber |
| arganta-mcp-connector.md | `arch.sdk` | Technology | amber (partial) |
| arganta-timeline.md | `ns.w2f` | Bridge | amber |
| arganta-workflow.md | `ns.w2f` via `hq.builders` | Technology | amber |
| decline-curve-forecaster.md | *(external — reservoir domain)* | — | — |
| reservoir-viz-standard.md | *(external — reservoir domain)* | — | — |

## Why this matters
The graph already has a rule: **no orphan opinions** — every verdict ladders to a lever/stage/coverage node.
Skills should follow the same discipline. A skill with no `ladders_to` line is a capability with no accountability —
it can run forever without ever showing up as progress in `ceo_brief` or `office_report`.

## How to keep this alive
1. When you add a skill, add its row here and its `Knowledge graph link` line in the SKILL.md.
2. When a node's health changes (pull `office_report` again), update the health column here —
   this file should always answer "which skills matter most right now" by pointing at amber/blind nodes.
3. Blind nodes with no skill pointed at them yet are your next skill to write. Right now that's:
   `sig.dead_end_quit`, `sig.build_abandoned`, `sig.broken_share_link`, `sig.calendar_open_no_add`,
   `sig.ugc_flagged` (Legal) — none of the 13 skills above touch these. **That's the actual next skill: an `instrumentation-wiring` skill.**
