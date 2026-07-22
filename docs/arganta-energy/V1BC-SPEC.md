# V1b + V1c — Build Spec (Petrophysics/Structural/Property · Volumetrics/Uncertainty/Forecast/Economics)
v1.0.0 · 2026-07-22 · Fable. Parent: V1-SPEC.md. Depends on: V1a (Map/Logs/Correlation + engine view/grid/contour/closure), the LOCKED numerics in `scripts/test-engine.mjs` (12/12 pass), and `public/wb/` data.

> The numerics below are already implemented and asserted in `scripts/test-engine.mjs`. The V1c engine port is a **1:1 translation** of those reference functions into `src/engine/*.ts`; a parity block in test-engine (importing the built engine) must reproduce the same numbers. Do NOT re-derive — port and verify parity.

## Engine modules to port (src/engine/, pure TS, no DOM)
Match `test-engine.mjs` reference implementations exactly (same formulas, same constants):
- `petro.ts` — `vsh(gr, grMin, grMax, method)` (Larionov tertiary `0.083*(2^(3.7*I)-1)`, older `0.33*(2^(2*I)-1)`, linear); `phit(rhob, rhoMa, rhoFl)` = `(rhoMa-rhob)/(rhoMa-rhoFl)`; `phie(phit, vsh, phiSh)` = `clamp(phit - vsh*phiSh, 0, 1)`; `sw(phie, rt, a, m, n, rw)` = `clamp(((a*rw)/(phie**m * rt))**(1/n), 0, 1)`; `netFlag(vsh, phie, sw, cuts)`; `zoneAverages(md, curves, topMd, baseMd, cuts)` → `{ntg, phie, sw, netM, grossM}` net-weighted.
- `mc.ts` — `mulberry32`, `gauss`, `gamma` (Marsaglia-Tsang), `beta`, `samplePert(rng,min,mode,max)` (Beta a=1+4(mode-min)/(max-min), b=1+4(max-mode)/(max-min)), `sampleTri`, `percentile(sortedAsc,p)`, `monteCarlo(cfg,n,seed)` → `{realizations:sorted, p90:pct(10), p50:pct(50), p10:pct(90), mean}`, `tornado(inputs,output)` Pearson r.
- `dca.ts` — `arps(qi,Di,b,t)`, `arpsCum(qi,Di,b,months)` trapezoid, `fitArps(series)` (log-linear on the decline segment → qi,Di; b as a fitted/assumed param), `eur(qi,Di,b,qEcon)`.
- `econ.ts` — `cashflow({oilByYear, price, opexVar, opexFix, capex})`, `npv(cashflows, rate)` mid-year `1/(1+r)^(y+0.5)`, `payback(cashflows)`.
- `volumetrics.ts` — `grvClosure(top,base,owc,cell)` (crest-connected flood-fill, per test-engine), `grvPolygon(top,base,owc,cell,poly)` (point-in-polygon clip), `grvWell(top,base,owc,cell,x,y,radius)` (drainage circle ∩ closure), `stoiip(grv,ntg,phie,sw,bo)`, `giip(grv,ntg,phie,sw,bg)`. bbl = Sm³·6.2898.
**Parity gate:** extend test-engine with `import { … } from '../src/engine/…'` and assert engine outputs === reference outputs for the same inputs (STOIIP 68.4, PERT mean, percentile convention, Arps cum, NPV).

## V1b viewers
### Petrophysics
- Per-well track view (reuse Logs renderer) + **dual mode toggle**: INTERPRETED (LFP_PHIE/SWE/VSH from wb logs, `dataNature:interpreted`, cite Equinor — DEFAULT) vs RECOMPUTE (Archie via petro.ts, `dataNature:derived`). Inspector sliders bind params (grMin/grMax from LFP_GRMIN/GRMAX defaults, rw from LFP_RW default, rhoMa 2.65, a/m/n 1/2/2, phiSh, cutoffs vsh≤0.5, phie≥0.08, sw≤0.6). Live recompute overlays derived PHIE/SW/VSH curves alongside interpreted for comparison.
- **Zone-average table** bounded by picks (Hugin Top→Base interval per well): NTG, PHIE, SW, net/gross m. Writes to a shared `props` store consumed by Property + Volumetrics. Discrepancy (interpreted vs recompute) shown as a column, never hidden.
### Structural
- Surface QC per active grid: filled/null cell counts, z range, cell size, area. **Well-tie mistie table**: for each well with picks on the active surface, `residual = pickTvdss - sampleGrid(surface, wellX, wellY)` — honest mistie posting (no auto-adjust). Contact editor (OWC default 3120, `scenario` when changed). Closure derivation view (engine.closure polygon over the map, area + bulk stats).
### Property
- Per-well `props` (from Petrophysics zone averages) posted at well x/y on the map. **Interpolated property grids** (PHIE, NTG, SW) via IDW (power 2) or kriging-lite (ordinary, small — vendor a tiny kriging into a worker or IDW-only in v1 with a "kriging: later" note). **HCPV map** = cellwise `grv_cell × NTG × PHIE × (1-SW)` over the closure → sum reconciles to the deterministic STOIIP. Colormaps from tokens; legend + readout.

## V1c viewers
### Volumetrics
- **Scope selector**: field closure (crest-connected) | custom polygon (drawn on Map) | well drainage circle. **Mode**: deterministic (field-average defaults) vs property (grids from Property tab).
- STOIIP/GIIP cards (Sm³ + bbl) with a **validation banner**: "screening ≈68 MMSm³ vs published volumetric analogue 67.6 [PEER Metsebo]; faulted dynamic model ≈22 [PEER] — the ~3× gap is 29-fault compartmentalization." Per-well recoverable = drainage STOIIP × RF (0.46–0.54 published range, slider).
- Bo divisor sourced from wb `index.pvt.Bo` (updated by the PVT extraction — see V1-DATA-MAP §4b).
### Uncertainty
- Input rows with PERT/triangular (min/mode/max) sliders: GRV multiplier (0.75/1.0/1.25), NTG, PHIE, SW around field values, Bo. 10,000 seeded realizations (fixed seed 20260722). Histogram + CDF with **P90/P50/P10 flags** (oil convention). Tornado (Pearson r, sorted |r|). "reproducible — fixed seed" note.
### Forecast
- Real monthly production (wb prod-<well>.json / prod-field.json) plotted; `fitArps` overlay on the decline segment + forecast to economic limit; per-well + field toggle. EUR vs published RF/cum sanity note. **Material-balance tank check**: F-12 target STOIP ≈ 19.6 MMSm³ [PEER Metsebo] displayed as a reconciliation. Injectors (I-F-4, I-F-5) annotated on field plot. All forecast curves `dataNature:forecast`; "screening decline, not full-physics simulation" label.
### Economics
- Inputs: oil price ($/bbl), opex (var $/bbl + fix $k/yr), capex ($MM), discount %. Ties to Forecast oil-by-year. NPV (mid-year), payback, cashflow waterfall/line chart. All `scenario`.

## Common (both phases)
Right Inspector per viewer (token-only customization); hover readouts; dataNature badges on every surfaced value; both themes; reduced-motion; mobile single-column. Later-phase tabs already stubbed by V1a → replace with the live viewer.

## Founder specifics (2026-07-22) — locked into the build
Founder direction for completing Field Development, folded into the phases above:

### Structural modeling — **NO FAULTS**, WITH well-log upscaling
- Simple structural model: the Hugin Top/Base grids as-is (no fault polygons, no compartmentalization in the model — it's a single connected structure). Honest label: "unfaulted screening model."
- **Well-log upscaling** (`upscale.ts`): block the fine LFP samples within the Hugin interval (picks-bounded) per well into upscaled cell values — **arithmetic mean for continuous** (PHIE), **net-fraction for SAND**, **majority vote for discrete facies**. This is the Petrel "scale-up well logs" step feeding Property modeling. Show upscaled-vs-raw so nothing is hidden.

### Property modeling — **simple**: 1 continuous + 1 discrete
- **Porosity (continuous):** interpolate the upscaled per-well PHIE across the grid (IDW power 2; kriging-lite later) → a porosity property grid. Colormap + legend.
- **Facies (discrete):** derive from **SAND** — upscaled net-sand fraction per well → interpolate → threshold into a **sand/shale discrete facies grid** (2 facies: SAND, SHALE). This is the facies model. Discrete, distinct colors.
- HCPV/volumetrics then read porosity × facies(NTG) grids cellwise (property mode).

### Volumetrics — **oil AND gas cases**
- **Oil case (STOIIP):** `grv·ntg·phie·(1−sw)/Bo`, Bo=1.47 [deck]. Sm³ + bbl (×6.2898).
- **Gas case (GIIP, scenario):** `grv·ntg·phie·(1−sw)/Bg` with **Bg≈0.0040 rm³/Sm³** (screening default at Pi/T; refine from deck PVDG if pulled) — a "what if the trap held gas" scenario, badged `scenario`. Sm³ + scf (×35.3147).
- **Associated/solution gas** (reported alongside oil): `STOIIP × Rs`, Rs=148 Sm³/Sm³ [deck] → free-gas-equivalent context. Both fill cases selectable; scope selector (closure/polygon/well) as spec'd.

### Uncertainty — tornado + Monte-Carlo + editable parameters
- **Uncertainty parameters** (editable rows, PERT/triangular min/mode/max): GRV multiplier, NTG, PHIE, Sw, Bo, contact depth (OWC), (Bg for gas case), recovery factor. Each with a distribution picker.
- **Monte-Carlo:** 10,000 seeded (fixed seed 20260722) → P90/P50/P10 (oil convention), histogram + CDF.
- **Tornado:** Pearson r of each input vs output across realizations, sorted |r|, one-at-a-time low/high bars. Both oil (STOIIP) and gas (GIIP) selectable.

### Forecast — with **offset-well benchmark**
- Real monthly production per producing wellbore (wb prod-*.json). **Arps decline fit** on the decline segment → EUR.
- **Offset-well benchmark:** build P90/P50/P10 type-wells from the OTHER producing wellbores (the 7 producers: F-1 C, F-5, F-11, F-12, F-14, F-15 D, F-4) as analogs — nearer/similar wells weighted → a benchmark envelope the selected well/forecast is compared against. "How does this well's decline compare to its offsets?"
- Field forecast (sum) + the F-12 material-balance tank check (~19.6 MMSm³ [PEER]); injectors I-F-4/I-F-5 annotated. All `forecast`; "screening decline, not full-physics sim."

### Economics — Fable-set screening defaults (founder delegated; all `scenario`, sliders)
North Sea offshore screening basis, editable in the Inspector:
- **Oil price:** base **$70/bbl** (low $50 / high $95, 2026 Brent screening).
- **Gas price:** **$6/Mscf** (for the gas/associated case).
- **Opex:** variable **$14/bbl**, fixed **$45 MM/yr** (leased-facility offshore, Volve-scale).
- **Capex:** field **$1,200 MM** (historical Volve dev ~NOK 10 bn); per-well **$80 MM** for single-well runs — slider.
- **Discount rate:** base **10%** (show 8/10/12); NPV mid-year discounting.
- **Abandonment:** **$150 MM** decommissioning at end of life.
- **Tax:** pre-tax NPV by default + an optional **78% Norway petroleum-tax** toggle (screening; note it's a simplification, not fiscal advice).
- Outputs: NPV, payback, IRR-lite, cashflow chart (waterfall + cumulative). Tied to Forecast oil/gas-by-year. Every number badged `scenario`; a visible "screening economics — not investment advice" label (we are not a licensed advisor).

## Phase gates
- V1b DoD: engine parity block green; Petrophysics dual-mode recompute matches interpreted within reason (document typical residual); Structural mistie table renders real residuals; Property HCPV sum ≈ deterministic STOIIP (±5%); tsc+build green; screenshots.
- V1c DoD: Volumetrics validation banner correct; Uncertainty 10k reproducible (same seed → identical P50 across reloads); Forecast fits real history + tank check shown; Economics NPV matches test-engine hand-calc; the **20-task battle-test (BATTLE-TEST-V1.md) passes** → V1 exit.
