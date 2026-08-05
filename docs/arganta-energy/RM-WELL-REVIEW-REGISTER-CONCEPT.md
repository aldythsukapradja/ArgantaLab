# Well Review Register — concept (Reservoir Management Knowledge Bank)

Replaces the 6-row "Well watchlist" strip in the Surveillance Dossier with a full
**per-well diagnostic register**: every producer ranked, each row carrying its own
performance, decline, remaining volume, benchmark and a written observation →
insight → action. Clicking a row opens a drawer of diagnostic widgets, including
**pattern VRR** and a deterministic **root-cause** ranking.

Status: **CONCEPT — not built.** Sign-off wanted before implementation.

---

## 0. Why this exists

The dossier answers "is the *reservoir* being drained efficiently". This surface
answers the next question the engineer actually asks:

> **"Which well do I touch first, why is it under-performing, and what is the
> intervention worth?"**

The current strip only ranks health. It does not say *what is wrong* or *what to do*.

---

## 1. What is genuinely derivable (checked against the real data)

| Field asked for | Source | Verdict |
|---|---|---|
| Latest production | `RMWellSeries.oilRate` at last **live** month | ✅ derived |
| Δ vs previous period | `oilRate[li] − oilRate[li−1]` | ✅ derived |
| Decline vs last year | 12-mo trailing mean vs prior 12-mo mean, + `annualPct` log-slope | ✅ derived |
| Remaining reserves | per-well Arps fit → `expCumToLimit` (engine/review.ts) | ✅ **forecast** (carry blind-test MAPE) |
| Cum oil / share of field | `cumOilMM` ÷ field cum | ✅ derived |
| **Current recovery (%)** | needs a **per-well in-place volume** — Volve has only a *field* model OOIP (22 MMSm³) | ❌ **NOT derivable** — see §4 |
| Recovery benchmark score | percentile vs the **field peer cohort** (not vs an invented OOIP) | ✅ derived, peer-relative |
| TD length | `wb/index.json` `td_md` / `td_tvd`, `kb` | ✅ **measured** |
| Step-out / trajectory | `loadTraj(well)` stations (`dispNs/dispEw`, incl, azi) | ✅ measured |
| VRR | **pattern-level** via `patterns.json` (injector → nearest producers) | ✅ derived, labelled as the *pattern's* VRR |
| Water mechanism | `chanWor` per well (Chan's WOR/WOR′) | ✅ derived, screening |
| Uptime / deferment | `RMWellSeries.uptime` | ✅ reported |
| Observation / insight / action | rules over the above | ✅ derived text, action = `scenario` |

### Data-quality finding (already worth a QC lane)
`F-11` reports **TD = 347 m MD / 347 m TVD** with `role: observation`, yet carries a
production series. A Hugin producer bottoms near **3,000 m** — so this TD cannot be
right (the other six wells read 3,510–4,685 m MD). The register must **flag**
implausible geometry rather than print it as fact. The role vocabulary in the wb index
has also changed at least once (`producer` → `oil-producer`), which is why role is now
classified by meaning plus an actual-production fallback.

---

## 2. The register (the ranked table)

All producers, sorted by a chosen rank metric (default: **opportunity value**, see §5).

| # | Well | Latest rate | Δ prev | YoY decline | Cum oil | Share | Remaining | WCT | WOR trend | Uptime | TD (MD/TVD) | Bench | Flag |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- Sortable on every column; the default sort is stated in the header so a ranking is
  never implicit.
- **Δ prev** and **YoY** render as signed deltas with direction colour — a rise in a
  producer's water is bad, a rise in oil is good, so tone is per-metric, not per-sign.
- Rows with a QC flag (§1) show the value struck through with the reason on hover.
- The table is the *whole* population — no top-N truncation, because a silent cap reads
  as "that's all there is".

---

## 3. The per-well drawer — the widgets

Clicking a row opens a drawer. Each widget is one question.

**W1 · Rate & cut history** — the well's own mini voidage chart (oil/gas/water bars +
water-cut line), sharing the D3 `VoidageChart` class already built.

**W2 · Decline & remaining** — Arps fit over the well's history, forecast to the
economic limit, with the **blind-test MAPE printed next to the number**. A remaining
volume without its own error bar is a lie of omission.

**W3 · Chan water-path** — WOR + WOR′ on log-log with the mechanism verdict
(coning / channelling / multilayer) and the recommended remedy. Already in
`engine/surveillance.ts`.

**W4 · Pattern VRR** — the VRR of the pattern this producer belongs to, its supporting
injector(s) named, on the balanced 0.9–1.15 band. **Labelled as the pattern's VRR, never
the well's** — VRR is a voidage balance over a group, not a property of one producer.

**W5 · Peer benchmark** — where this well sits in the field cohort on recovery-per-metre,
water cut and decline rate (box/percentile, n stated). Replaces the impossible per-well
recovery % with an honest relative measure.

**W6 · Well geometry** — TD MD/TVD, KB, step-out and a small trajectory profile; QC flags
surfaced here.

**W7 · Root cause** — see §4.

**W8 · Observation → Insight → Action** — the written narrative, generated from the
evidence the widgets above computed (§5).

---

## 4. Root-cause engine (deterministic, evidence-ranked)

A rules engine that **ranks candidate causes with the evidence for each**, never a single
confident verdict. Each candidate returns `{cause, confidence, evidence[], remedy}`.

| Candidate cause | Fires when | Evidence shown |
|---|---|---|
| Channelling / thief zone | Chan slope ≈1, WOR rising, pattern VRR ≥ 1 | slope, WOR %/yr, pattern VRR |
| Bottom-water coning | Chan slope <0.3 (WOR plateau), high drawdown | slope, WCT trend, BHP |
| Multilayer channelling | Chan slope >1.4 | slope, stepwise WOR |
| Voidage deficit (under-support) | pattern VRR <0.9, BHP falling | pattern VRR, BHP Δ |
| Over-injection / fracture risk | pattern VRR >1.15, injector Hall slope falling | VRR, Hall trend |
| Mechanical / deferment | uptime <0.8, rate step with **no** WCT change | uptime, rate step |
| Natural decline | nothing else fires and decline sits inside the class band | decline vs band |
| Undetermined | insufficient history | what is missing |

Rules only — no LLM invents a cause. Confidence is the count and strength of the tests
that fired, and every card shows the numbers that drove it so an engineer can disagree.

---

## 5. Observation → Insight → Action, and how the ranking works

- **Observation** — what the data says, no interpretation.
  *"Oil 1,805 bopd, −18% on the prior month; water cut 97%; uptime 0.62."*
- **Insight** — the diagnosis, from §4.
  *"WOR′ late-time slope 1.0 with pattern VRR 1.03 indicates channelling from F-5 rather
  than drawdown-driven coning."*
- **Action / opportunity** — the candidate intervention, **badged `scenario`**, with the
  prize sized where a number is derivable (incremental oil from the DCA delta) and marked
  *not sized* where it is not.

**Rank metric (default sort) = opportunity value**, a transparent composite:
`remaining volume × deliverability upside × confidence ÷ intervention class`.
The formula is shown in the UI. Any well with a QC flag is excluded from the ranking (not
silently sorted last) and listed in a separate "cannot rank" group.

---

## 6. Layout

The register replaces the current `.rms-sd-wells` panel and gets the full lower band of
the dossier; the drawer opens over the right two columns so the map stays visible.

```
┌ header KPIs ─────────────────────────────────────────────┐
│ map │ voidage & production          │ verdict rail       │
│     ├───────────────────────────────┴────────────────────┤
│     │ WELL REVIEW REGISTER (ranked, all producers)       │
└─────┴────────────────────────────────────────────────────┘
        click a row → drawer: W1…W8
```

---

## 7. Build order (proposed)

- **R-W1** `well-review.ts` — pure derivation (per-well metrics, peer percentiles,
  root-cause rules, narrative) + `scripts/test-well-review.mjs` truth-lock. **No UI.**
- **R-W2** the ranked table + QC lane.
- **R-W3** the drawer shell + W1/W2/W3 (reusing existing D3 classes).
- **R-W4** W4 pattern VRR, W5 peer benchmark, W6 geometry.
- **R-W7** W7 root cause + W8 narrative, wired to the surveillance ledger so a well
  action appears in the dossier's ACT list.

---

## 8. Honesty rules (enforced in the derivation layer, truth-locked)

1. **No per-well recovery factor.** No per-well in-place volume exists; the register
   reports share-of-field and peer percentile instead, and raises the gap.
2. **VRR is a pattern property** — always named with its pattern and injectors.
3. **Remaining volume always travels with its blind-test error.**
4. Implausible geometry (e.g. F-11's 347 m TD) is **flagged, not rendered as fact**, and
   removes the well from the ranking.
5. Actions are `scenario`; observations are `reported`; TD is `measured`.
6. No top-N truncation — the register shows the whole population.
