# Circle HQ

> Founder OS — the [[mental-model|Agent layer]] itself. My "super agent."

## What it is
- 25-agent C-suite architecture. Live Bridge MCP server on Render + Supabase. #known
- Exposes a product ontology graph: CEO brief, six office reports, node queries, verdict queue. #known
- Bridge URL: circle-hq-bridge.onrender.com/mcp #known

## The promotion (roadmap)
- Currently a dashboard I QUERY. The vision: promote it to a ROUTER that ACTS —
  score → pick model → load skills → call connectors → ladder to node → run + verify. #known
- The six offices become routing paths. See [[roadmap-tracker]].

## Persona integration
- The CEO/Bridge agent should reason using [[persona-core]], not generic "helpful agent" behavior.
- Skill still to write: persona-core-integration (see [[skills-index]]).

## Open threads (July 7)
- **Orchestration spec: DONE** — ORCHESTRATION-SPEC.html in the fable-handoff folder;
  runnable P0 protocol in new-skills/hq-router.md. Router = protocol before service.
- All 76 verdicts sit at "proposed" — the resolve loop has never run once; `resolve_latency`
  SLA is itself placeholder. First real resolve is a P2 milestone.
- ⚠ The Bridge deployment self-describes as a deterministic SEED graph, read-only. Confirm
  the production endpoint before trusting badges as measured (RECON §9.1). #known (observed)
- Graph write-path (verdict resolution, provenance updates from events) doesn't exist yet — P2.

## Links
- Consumes: [[persona-core]] · [[skills-index]] · [[mcp-connectors]]
- Tracked in: [[roadmap-tracker]]
