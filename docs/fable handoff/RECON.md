# RECON.md — Full Gap Inventory
### Fable recon pass, July 7, 2026. Every item tagged with source and confidence.
### Scope note (honest): only the `fable handoff` folder was mounted. Graph recon = full (live Bridge MCP pull). Repo recon = NOT run (repo not mounted). Memory recon = partial (6 Cowork sessions, low-yield; ~/.claude/projects and Obsidian vault unreachable).

---

## 1. GRAPH STATE (source: live pull, confidence: confirmed)

- North Star `ns.w2f` — partial / amber.
- Coverage: **78%** (59/76 grounded; 35 live, 24 partial, 3 simulated, 14 placeholder). CTO SLA target is 80% — below target, open consult tech→bridge ("the graph is half-blind").
- Weakest lever: `lever.efficiency` (activation, partial/amber).
- Verdict queue: **76 open, all status "proposed", none resolved.** Breakdown: 14 INSTRUMENT, 5 FIX, 3 MONETIZE, rest RETAIN/POLISH.
- Office health: Operations, Technology, Treasury, Legal all report office-level health **blind** (each has ≥1 blind node). Bridge and Guild amber.

---

## 2. THE BLIND-NODE LIST — 15, NOT 11 (source: graph, confidence: confirmed)

The sensor plan's "11 confirmed events" was incomplete, as it itself predicted. Full placeholder-provenance list from all six office pulls:

| # | Node | Office | Kind | Ladders to | In old list of 11? |
|---|------|--------|------|-----------|--------------------|
| 1 | `sig.dead_end_quit` | Technology | signal | lever.efficiency | yes |
| 2 | `sig.build_abandoned` | Technology | signal | lever.depth | yes |
| 3 | `sig.broken_share_link` | Technology | signal | lever.breadth | yes |
| 4 | `sig.calendar_open_no_add` | Technology | signal | lever.efficiency | yes |
| 5 | `arganta.home` | Operations | tab | lever.efficiency | yes |
| 6 | `ship.discover` | Operations | tab | lever.breadth | yes |
| 7 | `land.home` | Operations | tab | lever.breadth | yes |
| 8 | `land.products` | Operations | tab | lever.breadth | yes |
| 9 | `land.pitch` | Operations | tab | lever.breadth | yes |
| 10 | `sig.deck_no_waitlist` | Operations | signal | ns.w2f | yes |
| 11 | `sig.ugc_flagged` | Legal | signal | ns.w2f | yes |
| 12 | **`sig.paywall_bounce`** | **Treasury** | signal | stage.pay | **NEW** |
| 13 | **`legal.ip`** | **Legal** | ip register | ns.w2f | **NEW** |
| 14 | **`legal.risk`** | **Legal** | risk register | ns.w2f | **NEW** |
| 15 | **`app.landing`** | **Operations** | app (container) | lever.breadth | **NEW** |

Notes:
- #13/#14 are **registers, not app events** — "wiring" them means creating a populated data source (IP assets list, open-holds list), different work type from UI instrumentation.
- #15 is the container for land.* — likely goes green automatically once its children are wired (inferred, not confirmed).
- 14 INSTRUMENT verdicts map 1:1 to nodes 1–14; `app.landing` has no verdict of its own and coverage reports 14 placeholders vs. the 15 badges above — the container probably rolls up rather than counting (inferred; can't resolve without graph internals).

## 3. SIMULATED NODES (source: graph, confidence: confirmed)

Badged `simulated`: `scale.model` (Tech), `stage.pay`, `treasury.growthlab`, `valuation.vcMethod`, `valuation.firstChicago` (Treasury). Coverage counts only 3 simulated → valuation nodes appear to sit outside the 76-node denominator (inferred).

Placeholder **SLAs** (office scorecards with no data behind them): bridge `resolve_latency`, legal `open_holds`, roster `agent_roi`. Treasury's `contribution` SLA is simulated.

## 4. FIX-CLASS GUARDRAILS (partial data, need fixing not wiring)

`sig.invite_never_accepted` (Ops — sensor plan calls this a FIX in the invite flow itself), `sig.impossible_score`, `sig.item_overexposed`, `sig.difficulty_mismatch` (open handoff tech→ops: "content needs a pass"), `sig.streak_broken` (all Tech).

## 5. MONEY-NUMBER RECONCILIATION (adversarial finding)

- The consult flag "CAC/payer $75 at 2% conv" **is internally consistent**: financial model's $1.50 CAC per family ÷ 2% conversion = $75 per payer. Not a contradiction — two views of the same simulated assumption.
- **But** the CFO mid-case model actually runs `conv: 0.04` (4%), not 2%. The flag and the model disagree on the conversion assumption — at 4% the CAC/payer is $37.50. Both are simulated; neither is measured. Resolve which assumption is canonical before any Phase 2 modeling.
- Model outputs (all simulated): break-even ~462 actives, first positive month 18, NPV −$6,230 at 24mo, infra $0.08/active (the flagged swing line).

## 6. SKILLS / VAULT GAPS (source: zip inspection, confidence: confirmed)

- Skills zip: 13 SKILL.md + map, as documented. **`instrumentation-wiring` and `effort-scorer` do not exist** — confirmed, not just claimed. None of the 13 touches the 15 blind nodes.
- Vault zip: 20-file skeleton, valid structure, **9 files carry `[[TO FILL]]` markers**: persona-core, argantalab, kinetikcircle, circle-hq, effort-scorer, coverage-tracker, career-thread, followup, HANDOFF. Persona core (the highest-value file per VAULT-HANDOFF) is still skeleton.

## 7. WHAT COULD NOT BE CONFIRMED (repo not mounted)

Everything the repo subagent was supposed to do is **open**: which components own each blind event, what the existing live-signal write conventions are (Supabase table/schema), whether events "could fire but don't." No claim in this document about repo internals — see PLAN-instrumentation-wiring.md step 0.

## 8. DID RECON CHANGE THE PICTURE? (Phase 4 answer)

Yes, materially:
1. Blind list corrected 11 → 15 (paywall_bounce, legal.ip, legal.risk, app.landing).
2. The $75-CAC "contradiction" dissolved arithmetically, but a real 2%-vs-4% assumption mismatch surfaced in its place.
3. All 76 verdicts are stuck at "proposed" — the resolve loop has never been exercised (bridge resolve_latency SLA is itself placeholder — the org can't yet measure whether it resolves anything).
4. Confirmed (not assumed) the two missing skills and the 9 unfilled vault files.

---

## 9. ADVERSARIAL PASS ON THIS RECON ITSELF (what I'd flag to a human)

1. **The biggest caveat: the Bridge deployment self-describes as serving a deterministic SEED graph, read-only.** If that's accurate, even the "live/green" badges reflect seed data, not production telemetry — which would make the honest coverage number lower than 78%, not higher. Confirm whether this endpoint is the production graph before treating any badge as measured.
2. The 11→15 correction came from the same graph the old sensor plan used — it's a completeness fix, not independent discovery. Zero repo cross-checking happened; "could fire but doesn't" was never tested.
3. Every fire-condition in PLAN-instrumentation-wiring is inferred from node labels/metrics, not read from code. Step 0 exists precisely because these guesses must be checked against the actual architecture first.
4. Memory recon was near-nil (6 low-yield Cowork sessions). Claims about "what Aldyth intended" rest entirely on the handoff docs he curated — no independent history was mined.
5. The effort-scorer draft's thresholds are uncalibrated placeholders (marked as such in the file). The instrumentation-wiring skill is untested procedure.
6. Would this survive a real code review? The PLAN yes as a plan; nothing here is wired, and nothing should be called "done" until a fresh `office_report` shows provenance moving.
