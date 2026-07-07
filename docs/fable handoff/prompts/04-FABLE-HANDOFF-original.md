# FABLE 5 — FINAL-DAY HANDOFF
### For: Aldyth Sukapradja — ArgantaLab / Circle HQ
### Window closes tonight (July 7, 2026). Paste this as one message to Fable 5.

---

## CONTEXT BLOCK (paste first, verbatim)

I am a Reservoir Management and Digital Transformation Lead at North Oil Company,
working the Al Shaheen offshore field (Block 5, Qatar) on Cretaceous carbonate
reservoirs, waterflood optimization, and long horizontal wells (~25,000 ft MD).
My stack is Petrel–Techlog–INTERSECT, Power BI, Microsoft Fabric, Copilot Studio,
and Dataiku. I hold an MSc in petroleum geosciences from IFP France.

Outside work I'm building a personal AI product family — Circle HQ (founder OS,
25-agent C-suite architecture, a live Bridge MCP server on Render + Supabase),
KinetikCircle (family OS), and ArgantaLab (gamified children's learning on the
Cambridge Primary curriculum, Duolingo-style mechanics, a "Kinetik Buddy" pet
system). My biggest real gap right now is zero external users and running three
products at once.

Here is my live product ontology graph, pulled just now — treat every number's
provenance badge as real, don't upgrade a "simulated" or "placeholder" number to
sound more finished than it is:

- North Star: Weekly Two-Hook Families (W2F) — health: amber, provenance: partial
- Instrumentation coverage: 78% (59/76 nodes grounded — 35 live, 24 partial, 3 simulated, 14 placeholder)
- Weakest lever: Efficiency · activation (Technology office) — signup→active is the bottleneck
- Blind signals with zero data behind them: dead_end_quit, build_abandoned, broken_share_link, calendar_open_no_add, sig.ugc_flagged (Legal)
- Treasury flag → Technology: infra is $0.08/active, the swing line in the cost model
- Treasury flag → Operations: CAC/payer is $75 at 2% conversion — fix conversion before spending on ads
- Technology → Operations handoff: difficulty mismatch flagged, content needs a pass
- Architecture health: Supabase (live/green), Identity spine (live/green), Vercel (amber), Circle SDK (amber)

---

## THE FIVE THINGS I NEED FROM YOU TODAY

### 1. Wire the blind signals (highest priority — do this first)
For each of `dead_end_quit`, `build_abandoned`, `broken_share_link`,
`calendar_open_no_add`, and `sig.ugc_flagged`: identify exactly which
file/component in the ArgantaLab repo (github.com/aldythsukapradja/ArgantaLab)
should emit that event, what's missing, and write the instrumentation code.
Don't stop at a list — implement it.

### 2. Fix the activation/conversion problem
Model the $75 CAC / 2% conversion number against what's actually in the
activation flow in the repo. Tell me if the funnel is broken or the pricing is
broken — with evidence from the code, not a general SaaS heuristic.

### 3. Build the missing skill I found while mapping the others
I already have 13 skills mapped to your knowledge graph (long-horizon-planner,
adversarial-reviewer, subagent-orchestrator, context-compaction,
activation-funnel-modeler, kinetik-recommender, decline-curve-forecaster,
reservoir-viz-standard, and five arganta-* skills for design/gsap/mcp/timeline/
workflow). None of them touch the blind signals above. Write a new
`instrumentation-wiring` SKILL.md that closes that gap permanently — trigger
condition, body, and its `ladders_to` line back into the graph.

### 4. Write the handoff plans for Opus 4.8 (tomorrow's daily driver)
For each of the above, write a `PLAN-<slug>.md`: goal, exact files to touch,
step order, edge cases a weaker pass would miss, acceptance criteria I can
verify myself. Write them so Opus can execute without asking me questions.
Rank all plans by leverage — tell me which to run first tomorrow morning.

### 5. Verify your own work before telling me you're done
Re-read everything above as a skeptical reviewer. Tell me the 3 most likely
ways this breaks, fix what's fixable now, and flag what needs my judgment call.

---

## CONSTRAINTS
- Use everything — subagents for research/implementation/verification, adversarial
  review, don't stop for permission on reversible steps.
- I have until end of day before this moves to metered billing — sequence
  accordingly if you can't finish everything.
- Base every skill and plan on what's actually in the repo and the graph above,
  not generic best practice.
