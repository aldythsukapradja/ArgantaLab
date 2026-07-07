# FABLE MASTER PROMPT — Full Recon Squad + Part A++
### Fable-class: max effort, full subagent squad, nothing held back
### Paste as one message. This supersedes the earlier mega-prompt — it's the same idea, scoped to everything, not just the known 11 signals.

---

## CONTEXT BLOCK (paste first, verbatim)

I am building a product family: ArgantaLab (github.com/aldythsukapradja/ArgantaLab —
gamified children's learning, Cambridge Primary curriculum), KinetikCircle (family OS),
and Circle HQ (founder OS — a live Bridge MCP server on Render + Supabase, exposing a
product ontology graph via CEO brief, six office reports, node queries, and a verdict
queue). I also keep an Obsidian vault as a second brain (inbox → projects → output → wiki
staging) and a Claude Code session history at ~/.claude/projects/.

You have tool access to the Bridge MCP server (Circle HQ), the repo, and my local files.
Use all of it. This is the last day you're available on my plan before metered billing —
use everything, go deep, don't hold back.

**Ground rule inherited from my own graph:** never present a simulated or placeholder
number as if it's live. Where you don't have real data, say so — don't round up to sound
more finished than you are.

---

## PHASE 0 — FORM THE SQUAD, THEN RECON EVERYTHING (do this first, don't skip)

Split into subagents by domain, run in parallel, ~100-subagent budget if the task needs it:

1. **Repo subagent(s)** — read the entire ArgantaLab codebase. Map every screen, event
   handler, and data write. Note every place an event *could* fire but doesn't.
2. **Graph subagent** — pull `ceo_brief`, then `office_report` for **every office**
   (Technology, Operations, Legal, Treasury, and any others that exist — don't assume the
   set I've described to you before is complete). For every amber/blind/placeholder node,
   pull `node_get` for full detail. Also pull `verdict_queue` in full.
3. **Memory subagent** — read my Claude Code session history (~/.claude/projects/
   transcripts + history.jsonl) for the last 30-60 days, and my Obsidian vault's current
   structure. Identify: repeated requests, decisions I've made, threads left open,
   anything I've said I wanted that never got built.
4. **Cross-reference subagent** — synthesize the above three into ONE list: every gap
   between what the graph claims, what the repo actually does, and what my own history
   says I intended. This list supersedes anything I've told you already — if my prior
   description of "11 blind signals" was incomplete or wrong, correct it here.

**Output of Phase 0:** a single `RECON.md` — the full, real gap inventory, each item tagged
with source (graph / repo / memory) and confidence (confirmed by code vs. inferred).

---

## PHASE 1 — PART A++ (expanded instrumentation wiring — supersedes the earlier "11 signals")

For **every** blind/placeholder/inconsistent signal found in Phase 0 (not just the ones I
knew about going in):

1. Identify the exact file/component that should own it.
2. Implement the real instrumentation — actual code, writing through to Supabase in a
   format the Bridge server can ingest, matching existing live-signal conventions.
3. Run this as parallel subagents per office/domain, same pattern as before, but sized to
   the real Phase 0 list, not a pre-guessed count.
4. A dedicated **adversarial-verification subagent** reviews every wired signal: does it
   fire on the right condition, could it double-fire, does it fail silently, does it match
   conventions elsewhere in the codebase.

Do not stop to ask permission on reversible code changes. Stop and flag anything touching
production data migrations, deletions, or anything irreversible.

---

## PHASE 2 — MODEL WHAT'S NOW VISIBLE

Once Phase 1 signals are live (or partially live), revisit the activation/conversion
picture ($75 CAC, 2% conversion — both currently simulated):

1. Trace the real signup→active path using whatever new signal data exists.
2. Say explicitly if data volume is still too thin to conclude anything — don't force a
   confident finding out of a few hours of new signal history.
3. If there's enough to say something real, say whether the funnel or the pricing is the
   actual problem, with evidence.

---

## PHASE 3 — WRITE BACK TO MEMORY (this is the part that makes today compound)

1. Update the knowledge-graph-map / skills folder if Phase 0 found gaps the existing 13
   skills don't cover — write any new SKILL.md needed (not just instrumentation-wiring;
   whatever Phase 0 actually surfaced).
2. Write a distilled session summary into the Obsidian vault under `/projects`, following
   my own vault convention: decided facts, what shipped, what's still open. Do NOT write
   directly to `/wiki` — that only happens after something is fully shipped and reviewed.
3. Write `PLAN-<slug>.md` files for anything unfinished — exact files, steps, edge cases,
   acceptance criteria — so Opus can pick up tomorrow with zero re-discovery cost.

---

## PHASE 4 — FINAL ADVERSARIAL PASS (before you say "done")

Re-read everything from Phases 0-3 as a skeptical reviewer:
- Did Phase 0's recon actually change my understanding of the gaps, or just confirm what
  I already told you? Say which.
- For every wired signal — would this survive a real code review?
- For Phase 2 — is the conclusion actually evidence-backed, or still a guess wearing
  more confidence than it's earned?
- List anything you'd flag to a human before trusting it.

---

## CONSTRAINTS

- Max effort. Use the full subagent budget if the recon justifies it — don't under-scope
  this because a smaller run would be "good enough."
- Runway is limited today — if forced to cut scope, finish Phase 0 + Phase 1 completely
  before spending time on Phase 2. Real, wired signals beat a modeled guess about them,
  every time.
- Everything here should be traceable to something real — the repo, the graph, or my own
  history — not invented to fill a template.
