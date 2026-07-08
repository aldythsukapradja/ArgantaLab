---
title: Circle HQ
product: HQ
type: strategy
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-07
owner: aldyth
confidence: high
domain: [arganta, ai-context]
tags: [product, agent-layer, founder-os, pillar]
related:
  - "[[persona-core]]"
  - "[[skills-index]]"
  - "[[mcp-connectors]]"
  - "[[roadmap-tracker]]"
---

# Circle HQ

> [!success] 🟢 CANONICAL v1 · updated 2026-07-07

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

## Founder-OS pillar — product strategy
> Merged from the seed pillar note. Strategic/product view; the sections above are the live operational state.

HQ is the fourth pillar of Arganta: the cockpit **above** the products. Where [[kinetikcircle|KinetikCircle]] serves the household, [[argantalab|ArgantaLabs]] serves the kids, and [[lashirabloom|LashiraBloom]] binds the family into one world, HQ serves exactly one user — the founder.

### What HQ must answer every morning
1. Is the family flywheel spinning? → [[product-loop|Product Loop]]
2. What did the pilot families do yesterday? → [[family-pilot-plan|Family Pilot Plan]]
3. Is the economy balanced? → [[argons-economy|Argons Economy]]
4. What am I telling investors this month? → [[investor-narrative|Investor Narrative]]

### Operating principle
> One person, four products, zero headcount. Every surface in HQ exists to replace a meeting that never happened.

The Vault itself is part of HQ: decisions live in [[founder-decisions|Founder Decisions]], reusable AI instructions live in [[fable-build-prompts|Fable Build Prompts]], and the forward plan lives in [[product-roadmap|Product Roadmap]].

## Links
- Consumes: [[persona-core]] · [[skills-index]] · [[mcp-connectors]]
- Tracked in: [[roadmap-tracker]]
