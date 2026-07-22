# Analog + Engineering-Judgement method — scientific basis & blind test
v1.0.0 · 2026-07-22 · Fable. The approach (analog anchors, physics bands, judgement/derisk controls) is NOT ad-hoc — it maps onto four established, peer-reviewed bodies of work. This note gives the citations, the honest blind-test result, why the blend weight is what it is, and what makes the prediction good vs totally wrong.

## 1 · Is there scientific literature? Yes — four pillars
1. **Forecast combination.** Combining independent forecasts (here: physics + analog) reduces error versus either alone; the *optimal* weights are inverse-variance.
   - Bates, J.M. & Granger, C.W.J. (1969), *The Combination of Forecasts*, Operational Research Quarterly 20(4).
   - Clemen, R.T. (1989), *Combining forecasts: A review and annotated bibliography*, Int. J. Forecasting 5(4).
2. **Reference-class forecasting / the "outside view"** — the scientific basis for using analogs to correct a model's optimism, i.e. the derisk.
   - Kahneman & Tversky (1979); Lovallo & Kahneman (2003), *Delusions of Success*, Harvard Business Review.
   - Flyvbjerg, B. (2006), *From Nobel Prize to Project Management: Getting Risks Right*, Project Management Journal 37(3).
3. **Bayesian model averaging / Bayesian updating** — the analog is a *prior*; data + physics is the *likelihood*; the blend is the *posterior*.
   - Hoeting, Madigan, Raftery & Volinsky (1999), *Bayesian Model Averaging: A Tutorial*, Statistical Science 14(4).
4. **Analog-based reserves estimation (industry-sanctioned).** SPE-PRMS (Petroleum Resources Management System) explicitly endorses analogs for resource/reserves estimation, *especially when data is scarce* (early field life). Commercial analog databases (e.g. C&C Reservoirs) exist precisely for this. Recovery-factor-by-drive priors are textbook (Arps 1945; Tarek Ahmed, *Reservoir Engineering Handbook*).

So the method is: **Bayesian forecast combination of a physics estimate with a reference-class (analog) prior, precision-weighted, with an outside-view derisk.** All four legs are peer-reviewed.

## 2 · Why is the blend "40/60" (not a magic number)?
Bates-Granger optimal combination: the weight on an unbiased estimator ∝ its **precision** (1/variance). So `physicsWeight = varAnalog / (varPhysics + varAnalog)`. A 40/60 means the analog benchmark is ~1.5× more precise than the physics run *here*. Encoded as `optimalPhysicsWeight()`; the manual `dataConfidence` slider is the user override (engineering judgement can overrule the math). σ from a P10–P90 band ≈ (P90−P10)/2.563.

## 3 · Honest blind test — leave-one-out cross-validation
`crossValidate()` holds out each field, predicts its recovery factor from the *other* analogs only, and compares to the actual. Two numbers matter:
- **MAE of P50** — point accuracy.
- **P10–P90 coverage** — *calibration*: does the actual land inside the predicted range the right fraction of the time? (target ≈ 80%). This is the standard way to validate a *probabilistic* forecast (reliability), not just a point.

**Result on the current seed KB (11 analogs, mostly textbook class-priors):**
- MAE ≈ **11.5 recovery-factor points** — rough (the KB is thin).
- P10–P90 coverage ≈ **82%** — **well-calibrated**: the point is uncertain but the *range is trustworthy*.
- On a tight, informative synthetic KB: MAE drops to **3.6 points** → accuracy scales directly with KB size/quality.

**Reading of the confidence level:** today the honest message is *"I can't pin the exact recovery factor (±~11 pts on this KB), but my P10–P90 range catches reality ~82% of the time, and it tightens as you load real field analogs."* That is a defensible, explainable confidence statement — and it's measured, not asserted.

## 4 · What makes the prediction GOOD
- Many, **truly-analogous** fields (same drive mechanism, lithology, fluid, structural style) → tight, unbiased prior.
- A physics model that is actually **history-matched** (high, *earned* data-confidence).
- **Physics and analog agree** — agreement is validation; the physics sits inside the analog range.
- Blind-test **coverage ≈ 80%** and MAE small → the KB is dense and relevant.

## 5 · What makes it TOTALLY WRONG (be honest about these)
- **False analogs** — same lithology but different drive/compartmentalisation → biased anchor (garbage in). The single biggest risk.
- **Thin KB** → wide, unreliable (our seed: ±11 pts). Coverage can be right while the point is useless.
- **Over-trusting un-history-matched physics** (data-confidence set too high) — the sim's tweakable HM gives false precision.
- **Survivorship bias in the KB** — loading only successful fields → optimistic prior. Load the failures too.
- **Genuinely novel reservoir** — no true reference class exists; the outside view has nothing to stand on.
- **Non-stationarity** — analogs developed with different technology/economics/era don't transfer.

## 6 · Visualising sensitivity — tornado
`reconcileTornado()` varies each input across its range and reports the P50-answer swing, sorted. On the current setup **physics-RF and derisk dominate; data-confidence matters less** — so the two things worth arguing about are *your physics estimate* and *how hard you derisk*. Rendered as a tornado in the Field Review panel.

## 7 · What raises confidence next
- Load real field analogs (`confidence:'field'`) — they outrank class priors and tighten the prior + improve blind-test MAE.
- Auto-benchmark the physics vs real history (H3) → sets `dataConfidence` from an *earned* match score, not a guess.
- Track calibration over time — if coverage drifts from 80%, the KB or the derisk is off.
