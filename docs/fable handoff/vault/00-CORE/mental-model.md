# Mental Model

> The portable core. If a fresh LLM reads only one file to understand my system, it's this one.

## Rails vs Reasoner (the key idea)
- **Rails** = everything deterministic: skills, graph schema, ladder rule, [[effort-scorer]]
  thresholds, wired instrumentation, [[persona-core]] decision tests. Run the same every time.
  Need intelligence only to AUTHOR, not to EXECUTE.
- **Reasoner** = the LLM riding the rails. Swappable (Fable → Opus → Sonnet).
- **Consequence**: consistency comes from moving what-must-be-consistent OUT of the model and
  INTO the rails. Model choice then affects capability, not consistency. This is what makes the
  system live, autonomous, deterministic, AND portable at once.

## The four layers
1. **Data** — [[circle-hq]] graph + Supabase + this vault. What's true.
2. **ML** — analytics skills. Raw data → signal.
3. **Agent** — C-suite + [[skills-index]] + [[mcp-connectors]] + vector DB. What acts.
4. **UI/UX** — [[argantalab]] · [[kinetikcircle]] · SIGNAL · The Wall.

## Cross-cutting spine
- [[persona-core]] — a Rail every agent references. Not a layer; a thread through all of them.

## Two memory types (never merge)
- **Graph** (Supabase/ontology): structured, declarative — "what's true."
- **Vector DB** (over vault + history): semantic, associative — "what's similar to this / have
  I thought about it before."

## The honesty rule
Never present simulated/placeholder as live. Never let the twin overclaim "knowing me." Flag
inference as inference. Inherited from the graph's own "no orphan opinions" discipline.

## Links
- Lived through: [[daily-loop]]
- Built by: [[model-ladder]] (which reasoner authors which rail)
