# MASTER HANDOFF → FABLE
### Build my Obsidian "brain" — the plug-and-play knowledge base that captures everything
### Read this whole file first. Then execute the TO-DO list. The vault skeleton is in the /vault folder alongside this.

---

## WHAT I'M ASKING FOR (one sentence)

Take everything known about me, my projects, and the roadmap we've built, and turn it into a
clean, portable Obsidian vault I can plug in and use immediately — structured so that any
future LLM (you today, Opus/Sonnet tomorrow) can read it and instantly know me, my system,
and what to do next.

---

## THE UPDATED MENTAL MODEL (read this before building anything)

### The Rails vs. The Reasoner
The system splits into two halves that must stay separate:

- **The Rails** = everything deterministic. Skills, the graph schema, the ladder-to-a-node
  rule, the effort-scorer thresholds, wired instrumentation, and the Persona Core's decision
  tests. These run the same way every time. They don't need intelligence to *execute* — only
  to *author*.
- **The Reasoner** = the LLM riding the rails. Fable today, Opus/Sonnet tomorrow. Swappable.

**Why this matters:** consistency doesn't come from using one expensive model forever. It
comes from moving everything that must be consistent OUT of the model and INTO the rails —
so the model choice stops affecting consistency and only affects raw capability. This is what
makes the system "live, autonomous, deterministic, and LLM-portable" all at once. Fable's job
is to LAY THE RAILS. A cheaper model then rides them and stays consistent because the
consistency lives in the structure, not the reasoner.

### The four layers (my stack)
1. **Data layer** — Obsidian vault (this) + Supabase. What's true. Declarative.
2. **ML layer** — analytics skills (forecasting, funnel modeling, recommendation).
3. **Agent layer** — Circle HQ C-suite + skills + MCP connectors + vector DB. What acts.
4. **UI/UX layer** — ArgantaLab, KinetikCircle, SIGNAL, The Wall.

### The cross-cutting spine: Persona Core
Not a fifth layer — a document every agent references. My actual decision patterns,
background, and judgment, extracted from real evidence (not invented). It's a Rail: once
written, it's deterministic, and any Reasoner can consume it.

### The two memory types (never merge them)
- **Graph (Supabase/ontology)** = structured/declarative. "What's true."
- **Vector DB (over this vault + history)** = semantic/associative. "What have I thought
  about something like this before."

### The honesty rule (inherited from my own graph, applies everywhere)
Never present simulated/placeholder as if it's live. Never let the twin sound more confident
about "knowing me" than the evidence supports. Flag inference as inference.

---

## THE TO-DO LIST (execute in this order)

### ☑ 1. Read and validate the vault skeleton
The /vault folder contains the structure I want. Read every file. Confirm the structure holds
together and nothing contradicts what you know about me. Fix errors — I'd rather you correct a
wrong fact than preserve it.

### ☑ 2. Fill the [[BRACKETED PLACEHOLDERS]] with real content
Throughout the skeleton, `[[TO FILL]]` and `[...]` markers show where content is missing.
Populate each from what's actually known — my repo, my Circle HQ graph, my session history,
this conversation. Tag anything you INFER (vs. know) with `#inferred`.

### ☑ 3. Build the Persona Core (highest-value file)
`00-CORE/persona-core.md` is the most important file in the vault. Mine my actual judgment:
decision tests I apply, how I handle uncertainty, risk tolerance on reversible vs irreversible
actions, professional background where it shapes judgment. Every claim tagged with its source.

### ☑ 4. Populate the roadmap tracker as real state
`40-ROADMAP/roadmap-tracker.md` should hold the actual Fable-class initiatives (recon+A++,
persona core, orchestration spec, media pipeline), each with: status, owner-model, ladders_to
graph node, before→after metric. This is meta-work state — keep it separate from graph nodes.

### ☑ 5. Wire the internal links
Obsidian runs on `[[wikilinks]]`. Make sure every file links to its related files so the graph
view actually shows the structure. A file with no inbound/outbound links is an orphan — same
rule as skills.

### ☑ 6. Write the daily loop as a usable file
`00-CORE/daily-loop.md` — the Orient / Route / Harvest / Verify loop, written so I can actually
follow it each day, not just read it once.

### ☑ 7. Verify and hand off
Adversarial pass: is anything invented rather than sourced? Is the structure genuinely
plug-and-play, or does it need cleanup before it works in Obsidian? Write `_INBOX/followup.md`
with anything left for Opus/Sonnet to finish.

---

## VAULT STRUCTURE (what's in the /vault folder)

```
00-CORE/          → who I am + how the system thinks (persona, daily loop, mental model)
10-PROJECTS/      → the actual products (ArgantaLab, KinetikCircle, Circle HQ)
20-SYSTEM/        → the rails (skills index, MCP connectors, effort-scorer, model ladder)
30-DATA/          → memory + measurement (graph map, sensor plan, coverage tracking)
40-ROADMAP/       → the live tracker + the Fable-class initiatives
50-PROFESSIONAL/  → career thread (paper, positioning, narrative)
_INBOX/           → zero-friction capture, followups, open threads
```

This follows my own stage convention (inbox → projects → output → wiki) — the vault is the
distilled layer, not a transcript dump. Nothing goes straight to a "wiki/output" state until
it's actually shipped and I've reviewed it.

---

## CONSTRAINTS
- Plug-and-play means: I drop the /vault folder into Obsidian and it works — valid wikilinks,
  no broken references, no half-finished files presented as done.
- Portable means: the mental model and persona core must make sense to a fresh LLM with zero
  prior context. Write for that reader.
- Honest means: #inferred tags on anything you're guessing. Source tags on persona claims.
- Don't invent facts about me to fill space. An honest gap beats a confident fabrication.

---
## EXECUTION NOTE — July 7, 2026 (Fable)
All 7 to-dos executed same day, scoped to the handoff folder (no raw session history / old vault reachable — persona sourced from curated docs + graph + live session, flagged accordingly). Adversarial pass: self-only (◐). Human review pending: persona-core #inferred claims, seed-graph confirmation, 2%-vs-4% conversion decision. Leftovers in _INBOX/followup.md.
