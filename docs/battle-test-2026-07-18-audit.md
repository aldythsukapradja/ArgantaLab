# Fable Battle-Test Audit — ChatGPT Package ⨯ Repo Reality

**Date:** 2026-07-18 · **Input:** `20260718-Arganta-Fable-Battle-Test-Audit-Package.zip` (15 files, ~5,300 lines)
**Method:** every strategy claim in the package cross-checked against the actual codebase, live
data seams, and the audits already in `docs/`. Claims tagged per the package's own rules.

---

## 1 · What the package is

A red-team brief built with ChatGPT: a Product Trinity strategy (KinetikCircle / ArgantaLab /
LashiraBloom over a shared "Arganta Core"), a 12-test red-team protocol, weighted scorecard,
per-product battle tests, safety/valuation audits, and 10 decision-output templates. Its rules
(provenance tags, never present simulated as live, kill criteria) are **exactly the doctrine
the repo already practices** — the provenance badges in Command/Architecture are this
package's philosophy, already shipped as code. **Verified.**

## 2 · Correlation map — strategy claim vs repo reality

| Package claim / concept | Repo reality | Tag |
|---|---|---|
| ArgantaLab wedge: math+logic world, ages 7–11, 5-min quests | KinQuest (apps/web): Cambridge-aligned drills, item_attempts, mastery accuracy, daily quest chain, North Star rings — **live with real telemetry** | **Verified, further along than the package assumes** |
| "Six worlds premature — start NUM + LOG" | Repo already has **8 regions/Keepers** in KinQuest — the package's own warning was violated before it was written | **Contradicted (repo overbuilt vs wedge)** |
| Quest → unlocks builder component → child creates → shares privately | Pieces exist (quests live; Arganta Studio v2 15-genre builder live; game publish/share live) but the **connective unlock loop does not exist** — learning and building are parallel, not chained | **Gap — the highest-value missing 20%** |
| Parent sees learning evidence in KinetikCircle | Partial: kid-card snapshot, cloud rings, guardian circles. No weekly evidence digest, no "skills demonstrated" feed | **Partially Verified** |
| "Argons" cross-product currency | Does not exist by that name. Repo has **diamonds 💎 (cross-app, real ledger, sinks, coverage metric) + Bloom** (two-currency rule, cosmetic-stat p2w fix). Concept is live and *more* battle-tested than the package's version — the package hasn't absorbed the two-currency lesson | **Contradicted in naming, Verified in substance** |
| "Buddy" AI learning companion | Not built. No AI tutor anywhere in apps/web. (Keepers are narrative, not tutors.) Hallucination/dependency risks flagged in the package are therefore **not yet incurred** | **Hypothesis (unbuilt)** |
| "Kin" AI family assistant | Not built. Closest: Arganta Core chat — but that is the **founder's** twin, not a family assistant | **Hypothesis (unbuilt)** |
| KinetikCircle = memory + coordination + publishing + mini-apps | Circles/moments/calendar live; native apps (Travel/Padel/Kitchen/Vault) live; CircleHQ 9-app builder built; **publishing pipeline exists but is founder-side** (Post Studio → Buffer → IG), not family-facing | **Partially Verified** |
| "Is Kinetik one product or five bundled?" | Legitimate hit — repo has already bundled the five; the package's sharpest question lands | **Founder Decision needed** |
| LashiraBloom family MMO risk — "which systems should not exist in years 1–2" | Repo already de-scoped correctly: playable farm slice, circle-scoped (not public MMO), adults-play/kids-learn XP rule. Kingdom of Kin (the actual MMO) is a separate concept, unbuilt | **Verified — repo ahead of the warning** |
| Shared "Arganta Core" = identity/memory/knowledge/agents for FAMILIES | **Naming collision.** Repo's Arganta Core = founder cockpit. The family-facing shared core actually is: Supabase one-schema + RLS + guardian circles (identity/permissions ✅), diamond ledger (currency ✅), @arganta packages (✅). Missing: family memory, family knowledge graph, family-facing agents, notifications, billing, moderation | **Partially Verified + naming decision needed** |
| Safety: age assurance, parental consent, deletion, moderation | Repo honestly badges these `placeholder` (Architecture `gov.safety[]`). Guardian-run circles = structural consent (partial). Nothing else exists. The package is right that these are **launch blockers**, and the repo already admits it | **Verified gap, both agree** |
| Valuation discipline (milestone ladders, no replacement-cost) | Repo already has `valuation.ts` + MCP `valuation_estimate/levers/narrative/history` and `financial_model`/`scale_model` — deterministic, provenance-badged | **Verified — machinery exists, package didn't know** |
| Scorecard + verdicts + contradiction register | Maps 1:1 onto the Command graph (verdict kinds, LADDERS_TO teeth, provenance). The scorecard can be **run inside the product** instead of in Obsidian | **Improvement opportunity** |
| Required experiments (activation, D1 return, share behavior) | Several are **already answerable from live data**: `agentCompute` exposes activation, d1Retention, stickiness, flywheelPct today | **Package under-informed — repo can answer now** |

## 3 · Battle-testing the package itself (it asked not to be defended; same courtesy)

1. **It audits a company that doesn't know what's built.** Written as if all three products
   are pre-MVP concepts. Reality: playable slices, live telemetry, a working economy, real
   RPCs. Half its "required experiments" are queries, not experiments.
2. **It completely misses the founder-side machine.** HQ, tri-brain, studios, the content
   pipeline (Post Studio → Buffer → IG live) — the actual distribution asset and the biggest
   real moat-in-progress — appear nowhere. A portfolio audit that omits the operating system
   that builds the portfolio is incomplete.
3. **Vocabulary drift.** Argons/Buddy/Kin/NUM World vs diamonds/Keepers/(none)/KinQuest
   regions. If both vocabularies persist, every future audit mis-joins. One canon needed.
4. **Founder-capacity test is right and the trinity framing hides it.** The package audits 3
   products; the repo contains 7 apps + HQ + Kingdom concepts. The real capacity question is
   worse than the package models — and the tri-brain/agent leverage that answers it is the
   thing the package didn't look at.
5. **Its output templates duplicate existing engines.** Contradiction register, verdict
   queue, valuation ladder, assumption register — Command + MCP already implement these as
   typed data. Producing them as Obsidian notes forks the truth again (the same drift disease
   as the two `ceo_ask` brains).

## 4 · Gaps (union of package-found and repo-found)

**Product gaps the package correctly identifies (repo confirms):**
- G1 — The learn→build unlock chain (the wedge's connective tissue) is unbuilt.
- G2 — Parent evidence digest in Kinetik is unbuilt (the monetization moment).
- G3 — Safety/consent stack is placeholder: age assurance, verifiable consent, deletion,
  moderation, incident response. Launch blockers for anything public.
- G4 — No AI tutor (Buddy) — and it should stay unbuilt until G1/G2 prove the loop.
- G5 — Kinetik identity crisis (memory vs coordination vs publishing) undecided.

**Meta gaps the repo audit adds (package missed):**
- G6 — Two strategy sources of truth (ChatGPT vault vs repo docs/memory) already drifting.
- G7 — The battle-test itself isn't executable in-product: scores, verdicts, kill criteria
  live in markdown, not in the Command graph where verdicts already have teeth.
- G8 — Family-facing "Arganta Core" (identity/memory/agents for families) is conflated with
  the founder cockpit; needs a name and a contract (the C-level revamp's graph is the seam).
- G9 — C-level offices can't run this audit: only COO/Treasury grounded (see
  `docs/agent-os-v2-c-level-revamp.md`) — a scorecard needs a grounded CTO/GC/CAPO.

## 5 · Improvements to adopt (what the brainstorm genuinely adds)

- **A1 — Kill criteria as first-class data.** Add `killCriteria`/`assumption` fields to graph
  nodes; a red signal against a kill threshold files a verdict automatically.
- **A2 — The weighted scorecard as a Command cockpit** (15 dimensions × 3 products), each
  cell provenance-badged: live metric where one exists (retention, unit economics),
  founder-scored elsewhere. Decision bands render honestly.
- **A3 — Wedge cards as product spec.** The NUM/LOG wedge loop (8 steps) becomes the
  KinQuest×Studio integration spec — repo is 6/8 steps built.
- **A4 — Safety Constitution doc** merging the package's jurisdiction matrix with the
  existing `gov.safety[]` badges; GC office (CL-3) senses it.
- **A5 — Contradiction/assumption registers in Supabase,** not Obsidian — same table family
  as the CL-6 verdicts migration.

## 6 · The consolidated build steps (everything, in order)

**Track A — Ground the C-Level (from `agent-os-v2-c-level-revamp.md`, prerequisite for
in-product auditing):**
1. CL-1 Ground CTO (comfyHealth + bridge probe + agent_runs + schema).
2. CL-2 Ground CAPO on the real ledger.
3. CL-3 Ground GC on safety badges + permission gates (feeds A4).
4. CL-4 CFO AI-spend line.
5. CL-5 One CEO brain (retire the MCP seed drift).
6. CL-6 Verdicts → Supabase migration (extend with assumption/contradiction/kill-criteria
   tables — absorbs A1/A5).
7. CL-7 Office finding → Claude bridge mission seam.
8. CL-8 Honest model badges.

**Track B — Battle-test becomes product (this package, absorbed):**
9. B1 Canonize vocabulary: diamonds (not Argons), KinQuest regions (not NUM World), decide
   Kin/Buddy names now, split "Arganta Core (founder cockpit)" from "Family Core (shared
   contract)" — one doc, `docs/canon.md`.
10. B2 Scorecard cockpit in Command (A2), fed by live metrics + founder scores, decision
    bands + kill thresholds visible.
11. B3 Run the scorecard once, honestly, with the grounded offices → the package's Final
    Recommendation per product, recorded as verdicts.

**Track C — The wedge (product work the audit says matters most):**
12. C1 Learn→build unlock chain: completing a KinQuest quest chain unlocks one Studio
    builder component; ship to the existing daily loop (G1).
13. C2 Parent evidence digest: weekly "skills demonstrated + creations" card in Kinetik,
    guardian-visible (G2) — reuses kid-card snapshot + item_attempts.
14. C3 Family share loop: child creation → private circle share → guardian reaction
    (mostly wiring; publish/share primitives exist).
15. C4 Safety stack v1 (G3): consent flow on guardian circles, deletion path, moderation
    queue for shared creations — the launch blocker set, before any public surface.
16. C5 Only after C1–C4 prove retention: Buddy/Kin AI companions (G4), designed against the
    package's dependency/hallucination criteria.

**Track D — already-agreed platform work (unchanged, runs alongside):**
17. T-track BrainSeam (kill llm-proxy dependency) + bridge missions → agent_runs.
18. Pending migrations batch (missions_engine, verdicts, post_library, ig_plan, …).

Order of tracks: **A (1–8) → B (9–11) → C (12–16)**, D interleaves. A before B because an
in-product battle-test needs grounded offices; B before heavy C investment because B3's
scorecard is what says whether C's wedge is still the right bet — that's the package's whole
point.
