# FABLE MEGA-PROMPT — Instrumentation + Activation Root-Cause
### Combined run: #2 (wire the blind signals) + #3 (model activation against real data)
### Paste as one message. Sequenced internally so #3 runs on real data from #2, not a guess.

---

## CONTEXT BLOCK (paste first, verbatim)

I am building ArgantaLab (github.com/aldythsukapradja/ArgantaLab), a gamified children's
learning app on the Cambridge Primary curriculum, part of a product family including
KinetikCircle (family OS) and Circle HQ (founder OS with a live Bridge MCP server on
Render + Supabase, exposing a product ontology graph via CEO brief / office reports /
verdict queue).

Here is my live graph state, pulled just now — respect every provenance badge. Do not
upgrade a "simulated" or "placeholder" number to sound more finished than it is until
you've actually made it live:

- North Star: Weekly Two-Hook Families (W2F) — amber, partial provenance
- Instrumentation coverage: 78% (59/76 nodes — 35 live, 24 partial, 3 simulated, 14 placeholder)
- Weakest lever: Efficiency · activation (Technology office) — signup→active is the bottleneck
- CAC/payer: $75 — SIMULATED, not measured
- Conversion: 2% — SIMULATED, not measured
- 11 confirmed blind signals with zero data:
  - Technology: dead_end_quit, build_abandoned, broken_share_link, calendar_open_no_add
  - Operations: arganta.home (Play Home), ship.discover (Discover tab), land.home,
    land.products, land.pitch (Landing page + subpages), sig.deck_no_waitlist
  - Legal: sig.ugc_flagged
- (Note: Legal and Treasury likely have 1-2 additional blind nodes not named here —
  if you can query the Bridge MCP server directly, pull full office_report for legal
  and treasury first to confirm the complete list before finalizing wiring.)

---

## TASK SEQUENCE (do these in order — #2 must complete before #3 starts)

### PART A — Wire all 11 blind signals (this is #2)

For each of the 11 signals above:
1. Identify the exact file/component in the repo where this event should fire.
2. Identify what's currently missing (no listener, no write to Supabase, no wiring at all).
3. Implement the actual instrumentation code — not a plan, the real change.
4. Write the value through to Supabase in a way Circle HQ's Bridge server can ingest,
   matching however the other 35 "live" signals already report in.

Use subagent-orchestration for this: one subagent per office (Technology/Operations/Legal)
researching and implementing in parallel, then a verification subagent that adversarially
reviews each wired signal — does it actually fire on the right condition, does it write
correctly, does it match existing live-signal conventions in the codebase.

Do not stop to ask permission on reversible code changes. Do stop and flag before touching
anything that looks like a production data migration or anything irreversible.

### PART B — Model the real activation/conversion problem (this is #3 — run AFTER Part A)

Now that (some of) the blind signals are live, re-examine the $75 CAC / 2% conversion
numbers using whatever real data is now available, plus the existing activation flow code:

1. Trace the actual signup→active user path in the codebase end to end.
2. Cross-reference against `dead_end_quit`, `build_abandoned`, and `calendar_open_no_add` —
   these three specifically bear on whether users are dropping off mid-activation.
3. Answer directly: is the funnel broken (a UX/flow problem) or is the pricing/positioning
   broken (a value-perception problem)? Use evidence from the code and whatever real event
   data now exists — not a generic SaaS heuristic.
4. If real data is still too thin (signals just wired, no volume yet), say so explicitly
   and instead produce: (a) what the funnel *should* look like once data accumulates, and
   (b) the specific dashboard/query Circle HQ needs to answer this once data exists.

---

## PART C — Verification pass (do this last, before reporting done)

Re-read everything from Part A and B as a skeptical reviewer:
1. For each wired signal — would it survive a code review? Any silent failure modes?
2. For the activation conclusion — is it actually supported by evidence, or is there a
   place you're still guessing? Flag it explicitly if so; don't present a guess as a finding.
3. Write a short PLAN-followup.md for anything you couldn't finish, so Opus can pick it up
   tomorrow without re-deriving context — exact files, exact next steps, acceptance criteria.

---

## CONSTRAINTS

- I have limited runway left in today's window — if you can't finish everything, finish
  Part A completely before starting Part B. Real signals beat a modeled guess about them.
- Base every claim on the actual repo and graph, not generic best practice.
- Don't invent a lower CAC/conversion number to sound like progress — the win today is
  making the numbers real, not making them look better.
