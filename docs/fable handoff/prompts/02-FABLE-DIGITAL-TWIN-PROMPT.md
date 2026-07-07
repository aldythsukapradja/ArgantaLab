# FABLE MASTER PROMPT — Digital Twin C-Suite Architecture
### Building the Persona Core + vector-DB agent layer on top of the existing 4-layer stack
### Paste as one message. Builds ON TOP of the recon squad + Part A++ work, doesn't replace it.

---

## CONTEXT BLOCK (paste first, verbatim)

I'm building a personal AI operating system with four layers already in place:
- **Data layer**: an Obsidian vault (second brain, inbox→projects→output→wiki staging)
  + Supabase (structured product data)
- **ML layer**: analytics skills for forecasting, funnel modeling, and recommendations
- **Agent layer**: Circle HQ — a 25-agent C-suite architecture, a live Bridge MCP server
  on Render, exposing a product ontology graph (CEO brief, six office reports, verdict
  queue). Skills and MCP connectors already mapped and partly built.
- **UI/UX layer**: ArgantaLab (gamified kids' learning), KinetikCircle (family OS), plus
  a planned SIGNAL voice interface and "The Wall" HUD display.

**What I want built now:** a Persona Core that makes the Agent layer — especially the
CEO/Bridge agent — a genuine digital twin of me: my background, my decision patterns, my
preferences, my professional judgment, usable both for running my startup and for
professional work generally. Not a personality skin — the actual reasoning discipline I use.

**Ground rule, same as always:** don't present something as "knowing me" if it's actually
generic best practice. Where the twin is inferring rather than working from something I've
actually said or done, flag it as inference, not fact.

---

## PHASE 0 — MINE MY ACTUAL JUDGMENT (don't invent a persona, extract one)

1. **Session-history subagent** — read my Claude Code session history and this
   conversation's content if available to you. Extract recurring decision patterns: what
   tests do I apply before acting (e.g., "would giving a cheaper model a written plan make
   it as good?" as a model-routing test), what do I prioritize when trading off speed vs.
   correctness, how do I react to uncertain/simulated data (I insist on flagging it,
   not rounding up).
2. **Vault subagent** — read my Obsidian vault's actual content (not just structure).
   Pull out standing preferences, values, and recurring themes across projects.
3. **Graph subagent** — pull the full Circle HQ ontology graph (`ceo_brief`, all office
   reports, verdict queue). The discipline already encoded there (no orphan opinions,
   ladder every verdict to a lever, honest provenance) IS part of my judgment — it's not
   separate from the persona, it's evidence of it.
4. **Background subagent** — note my actual professional background where it's genuinely
   relevant to judgment style: reservoir engineering trains a particular relationship with
   uncertainty (probabilistic reserves, not point estimates) and with irreversible,
   expensive-to-undo decisions (well interventions) — note if/where that shows up in how
   I approach product decisions too, but don't force the connection if it isn't real.

**Output:** `PERSONA-CORE.md` — my actual decision patterns, preferences, and background,
each tagged with its source (session history / vault / graph / inferred-and-flagged-as-such).
This is the single most important artifact from this whole prompt — get this right before
building anything on top of it.

---

## PHASE 1 — WIRE THE VECTOR DB (the technical backbone under "knowing me")

1. Stand up semantic search over the vault + session history — this is what lets an agent
   retrieve "have I thought about something like this before" instead of me re-explaining
   context every session.
2. Design the retrieval pattern: when any of the six office agents (or the CEO/Bridge
   agent) receives a request, it should query the vector DB for relevant prior context
   BEFORE reasoning, the same way it currently queries the ontology graph for state.
3. Keep this separate from the ontology graph — the graph is structured/declarative
   (what's true), the vector DB is semantic/associative (what's similar to this). Don't
   collapse them into one system.

---

## PHASE 2 — UPGRADE THE C-SUITE AGENTS TO CONSUME THE PERSONA CORE

1. For the CEO/Bridge agent specifically: rewrite its instruction set to explicitly
   reference `PERSONA-CORE.md` — it should reason using my actual decision tests, not
   generic "helpful CEO agent" behavior.
2. For the six office agents: where the persona core reveals something relevant to that
   office's domain (e.g., my risk tolerance for irreversible actions applies directly to
   Treasury/Legal), wire it in. Don't force persona references where they're not relevant
   to that office's actual job.
3. Write this as an actual skill — `persona-core-integration` — so it's maintainable and
   laddered to a graph node like everything else, not a one-off prompt hack.

---

## PHASE 3 — VERIFY THE TWIN IS HONEST, NOT FLATTERING

This is the most important check in the whole prompt:
1. Test the upgraded CEO agent against 3-5 real past decisions from my session history —
   does it actually reach the same conclusion I did, using the same reasoning, or does it
   just sound like me while reasoning differently?
2. Explicitly identify any place where the persona core is guessing at my judgment rather
   than working from real evidence — list these as open questions for me, not settled facts.
3. Flag anywhere the "twin" would make a call on something genuinely novel — per our
   standing rule, a twin should recognize the edge of its own training data and say
   "this needs the real me," not fabricate confidence.

---

## PHASE 4 — WRITE BACK TO MEMORY

1. `PERSONA-CORE.md` goes in the vault under a clearly-marked location — this is durable,
   high-value, and should be reviewed/updated periodically, not treated as a one-time file.
2. Log what was built as a distilled `/projects` entry, not directly to `/wiki` (same
   convention as always — this hasn't shipped/been reviewed by me yet).
3. Write `PLAN-<slug>.md` for anything unfinished, so Opus/Sonnet can continue without
   re-deriving context.

---

## CONSTRAINTS

- This builds ON TOP of the recon squad + instrumentation work from the earlier prompt —
  if both are running today, protect that work first; this is a "if runway allows" build,
  not a replacement priority.
- Phase 0 (mining my actual judgment) matters more than Phases 1-2 (technical wiring) —
  a well-built vector DB serving a wrong or invented persona is worse than a slower system
  serving an honest one. If you have to cut scope, cut Phase 1/2 depth before cutting
  Phase 0 rigor.
- Never let the twin sound more confident about "knowing me" than the evidence supports.
