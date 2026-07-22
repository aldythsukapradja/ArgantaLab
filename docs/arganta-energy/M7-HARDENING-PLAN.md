# M7 Hardening Plan — "Discovery → Development Vision"
v1.0.0 · 2026-07-22 · Fable. Parent: M7-FIELD-DEVELOPMENT-PLANNER-CONCEPT.md. The plan to harden the field-development planner around the **exploration quick-look moat**: from a fresh discovery, instantly see how the *full* development could look — well count/type/pattern/spacing/drill-centres/recovery/economics — **quick and dirty, but science-backed, with an honest range on every number.** The speed of a back-of-envelope with the defensibility of a study.

## 0 · The moat, sharpened
An explorationist types ~10 discovery numbers (or pulls them from the discovery well) and in <1 s sees a **complete development vision** — a map with wells and a flood pattern, a well count and type, drill centres, a recovery and an NPV — where **every value is physics- or analog-backed, carries a P10/P50/P90 range, and states the one thing that would change it.** Not a black box; a reasoned sketch you can defend.

## 1 · Hardening principles (what "hardened" means here)
1. **Deterministic / physics / analog first; LLM last.** Only the engines produce numbers.
2. **Minimal input, inferred rest** — every inferred value shows its *source* (input · analog · default) and its *range*.
3. **Truth-locked AND blind-tested** — each engine validated against textbook cases *and* real developed-field analogs (leave-one-out).
4. **Calibrated uncertainty** — the recommendation ranges must be honest (P10–P90 coverage ≈ 80%, measured — same bar as the analog engine).
5. **Provenance + reproducibility** — deterministic, seeded; every plan is an immutable, versioned `DevelopmentPlan` object.
6. **Honest guardrails** — flag out-of-range inputs, no-analog cases, and low-confidence outputs *loudly*.

## 2 · The input contract — "10 numbers to a field"
The minimal input set; everything else is inferred with a stated source. Hardening = defining sane defaults, physical bounds, and analog fallbacks for each.

| Input | If missing → inferred from |
|---|---|
| Area (km²) / GRV | seismic closure or a stated range |
| Net pay (m), porosity, Sw, Bo | discovery-well logs → else analog by play |
| Depth, oil-column height, contacts | discovery well → else analog |
| Drive (aquifer/gas-cap/depletion) | pressure/analog by basin |
| Environment (onshore / offshore + water depth) | user (drives cost + concept) |
| Oil-rate / plateau target | user or analog by field size |

Acceptance: the planner runs on the **area + a play type alone** (everything else analog-defaulted, ranges wide), and tightens as inputs are added — the range visibly narrows.

## 3 · Engine hardening — each: physics basis · truth-lock · blind-test · acceptance
| # | Engine | Physics / rule basis | Truth-lock | Blind-test (analog) | Acceptance |
|---|---|---|---|---|---|
| E1 | **Volumetric framing** (reuse) | GRV·NTG·φ·(1−Sw)/Bo, MC | built (Volumetrics) | — | P10/50/90 STOIIP |
| E2 | **Appraisal VOI placement** | kriging variance + contact/connectivity risk → info-value | variance map monotonic; VOI ranks high-uncertainty | vs where appraisal wells were actually drilled | wells target the top-uncertainty zones |
| E3 | **Well count & spacing** | drainage-area ∩ deliverability (PI∝kh); NPV-optimal | count = area/spacing; optimum at marginal NPV=0 | vs real fields' well counts | count within analog range |
| E4 | **Well type & PI** | Joshi horizontal PI vs Darcy radial; coning/thin-pay/anisotropy rules | Joshi PI formula; rule table | vs real fields' well type by pay/coning | type matches analog majority |
| E5 | **Drive & flood pattern** | mobility ratio + geometry → peripheral/pattern/line-drive; VRR | pattern rules; sweep via streamlines (built) | vs real fields' recovery scheme | pattern + I:P sane vs analog |
| E6 | **Drill-centre geometry** | step-out reach circles cover well set; min centres | cover-set count; reach constraint | vs real offshore drill-centre counts | centres reachable, count minimal |
| E7 | **Phasing** | appraise→pilot→ramp; real-options pilot value | schedule monotone; pilot de-risks | vs real field phasing | staged, pilot present when flood |
| E8 | **Economics** (reuse) | mid-year NPV, capex/opex, break-even | built (FDP/econ) | — | NPV + break-even levers |

Each new engine (E2–E7) is **small, rule/physics-based, and gets its own truth-lock test file** (the discipline that got us to 158 assertions). Each ships with its **honest failure modes** documented (§9).

## 4 · The Development Knowledge Base + blind test (the science backing)
The core credibility engine, and where the founder's knowledge pours in:
- A KB of **real developed fields**: discovery-stage params → the development actually chosen (well count/type/pattern/spacing/drill-centres) + the outcome (RF, plateau, plateau length).
- **Leave-one-out cross-validation of the *recommendation***: hold out a field, feed its discovery params, predict its development, compare to what was really done. Report per-decision **hit-rate + range coverage** ("we'd say 10–15 wells; reality 12 ✓", "we'd say horizontal; reality horizontal ✓").
- This is the honest proof the *whole planner* is sane, not just each formula. It reuses the analog `crossValidate` pattern (built). Coverage ≈ 80% target.
- Hardening: KB schema + provenance + survivorship-bias controls (load the *failed/uneconomic* developments too) + governance.

## 5 · The quick-vision UX (one screen, <1 s)
- **Left**: the ~10-input panel (each field shows source + range chips).
- **Centre**: the auto-generated **development layout** — field outline, producers/injectors, flood pattern, drill centres — on a 2D map, with a 3D and a cross-section toggle (reuse Map/Grid/3D viewers).
- **Right**: the **plan card** — well count · type · pattern · spacing · drill-centres · recovery · plateau · NPV — each with its P10/P50/P90 and a **"why" one-liner**; a **tornado** of what drives the plan; and the **blind-test confidence** for this class of field.
- Recompute on any input change in <1 s; **coarsen/analog-only mode** when data is scarce.
- `Explain` / `Challenge` buttons (LLM seam, §7) — deferred but wired.

## 6 · Uncertainty & decision-quality hardening
- **MC over the inferred inputs** → P10/P50/P90 on *every plan output* (well count, reserves, NPV) — not just a point plan.
- **VOI** on the appraisal program (what each appraisal well is worth to the decision).
- **Real-options** value of the pilot/phasing (flexibility to stop/expand).
- Every recommendation ships **basis + range + what-flips-it** (reuse reconcile/tornado). No naked numbers.

## 7 · LLM ladder seam (deferred, seam-ready now)
- Each engine gets a **typed tool signature** (`frameVolumes · placeAppraisal · sizeDevelopment · pickWellType · pickPattern · layoutDrillCentres · phasePlan · economics`) so the digital brain can call them.
- **Tier-1 sovereign**: explains each decision + drafts the FDP narrative + interactive what-if. **Tier-2 frontier**: red-teams the plan + concept trade-offs + global-analog cross-check.
- **Guardrail (enforced in code):** LLM output is *narrative only*; every number in the narrative is a token that references an engine run. No number originates in the LLM.

## 8 · Robustness / QA hardening
- **Input validation + physical-bound guardrails** (φ∈[0,0.4], Sw∈[0,1], sane depths/areas) with clear rejects, not silent garbage.
- **Deterministic + seeded** → identical plan for identical inputs (reproducibility test).
- **Provenance**: the immutable, versioned `DevelopmentPlan` object records every input, its source, every engine + version, and the run — the audit trail.
- **Edge cases**: tiny/huge fields, no analog match, extreme mobility, zero oil column → each returns an honest "low confidence / out of scope" not a wrong number.
- **Performance budget** <1 s (analog-only) / <3 s (with MC); enforced in a perf test.
- **Coverage**: per-engine truth-lock + an integration test (discovery → full plan) + the §4 blind test.

## 9 · Honest failure modes (documented per engine, shown to the user)
- Wrong analog class → biased plan (the #1 risk; guardrail = show the analogs used + let the user reject).
- Thin/absent KB → wide ranges (honest, not hidden).
- Concept-select grade only — no drilling engineering, geomechanics, facilities detail, or reservoir HM.
- Rules are screening heuristics — they encode typical practice, not every reservoir's exception.
- Non-stationary analogs (old tech/economics) → flagged.

## 10 · Roadmap with acceptance gates (H-series over M7)
| Phase | Ships | Gate to pass |
|---|---|---|
| **M7-H0** | input contract + `DevelopmentPlan` object + provenance skeleton | runs on area+play alone; reproducible |
| **M7-H1** | E2 appraisal VOI + the uncertainty-map visual | wells hit top-uncertainty zones; truth-lock |
| **M7-H2** | E3 well count/spacing + E8 economics wired | count in analog range; NPV-optimal spacing |
| **M7-H3** | E4 well type/PI + E5 drive/pattern (+ streamline sweep) | Joshi PI locked; pattern sane vs analog |
| **M7-H4** | E6 drill centres + E7 phasing + the quick-vision one-screen UX | full plan in <1 s; layout renders |
| **M7-H5** | Development KB + **blind test** + calibration report | coverage ≈ 80%; per-decision hit-rate shown |
| **M7-H6** | MC uncertainty on all outputs + VOI + tornado | every output has P10/50/90 + what-flips-it |
| **M7-H7** | LLM tool seam + sovereign explain/narrative | narrative cites runs; no LLM-origin numbers |
| **M7-H8** | frontier red-team + executive synthesis | plan challenged; risks surfaced |

**Recommended first cut: H0 → H2** gives a reproducible discovery→sized-development with economics; **H4** delivers the *visual "wow"* (the one-screen development vision); **H5** is the credibility unlock (the blind test proving the recommendations are sane). Everything reuses the built, truth-locked engines — this is disciplined assembly + validation, not new science.

## 11 · The honest north star
Quick and dirty is the *feeling*; **truth-locked + blind-tested + calibrated + provenanced** is the *substance*. The moat isn't that it's fast — lots of things are fast. It's that it's fast **and** every number survives a blind test and states its own uncertainty. That's the thing incumbents (slow, expert-only) and toy tools (fast, unbacked) both miss.
