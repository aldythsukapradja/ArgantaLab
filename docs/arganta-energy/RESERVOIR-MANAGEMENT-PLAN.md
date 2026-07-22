# Reservoir Management — Vertical Build Plan (spec)

Research base: the COSMO design authority's own doctrine
(`tabspec-data.json → verticals/tech/specs/md['reservoir-management']`, extracted
verbatim from `COSMO_Final.html`), benchmarked to **SLB OFM + tNavigator/INTERSECT
surveillance and history-match review**. Anchored to the four-app doctrine
(memory `geavision-four-app`), the built Field Development vertical (the pattern to
mirror), and the truth-locked engine already in `src/engine`. Sibling template:
`WELL-DELIVERY-PROPOSAL-SPEC.md`.

---

## 0. What this is & positioning

Reservoir Management is the **4th domain app** ("Operate & optimize") and the
**closing leg of the cross-app learning loop**: Field Dev builds the model, Well
Delivery drills it, **Reservoir Management operates it and feeds actual performance
back**. It is NOT another dashboard — it is the operational cockpit for the
closed loop:

> **Monitor → Diagnose → Forecast → Act → Track → Learn**, exception-first,
> navigating **field → reservoir → pattern → well**, with human-in-the-loop gates
> and evidence-backed actions.

It is distinct from Field Development. FD is the *build/static* side (grid, property,
volumetrics, sim, screening FDP). RM is the *operate/surveillance* side on **real
Volve production, injection and downhole-pressure time series** — the OFM/Sypher
half of the platform.

The vertical is **already declared LIVE** in the shell nav
(`CosmoShell.tsx:31`, gauge icon, purple `#7c3aed`) but currently falls through to
the generic "migrating to COSMO" placeholder (`CosmoShell.tsx:196–204`). This plan
brings it online.

---

## 1. Data that grounds it (real Volve — no synthetic)

| Signal | Source | Status | Feeds |
|---|---|---|---|
| Oil / gas / water rate, monthly, per well + field | `public/wb/prod-*.json` (`ProdMonth {oil,gas,water,wi}`) | **present** | Production, WCT/GOR, forecast |
| Water injection (`wi`) | same `ProdMonth.wi` | **present** | Injection & VRR |
| Producer/injector role | `wb/types.ts WellRole` (`producer|injector|both|none`) | **present** | Patterns, VRR |
| BHP (`avg_downhole_pressure`), THP (`avg_whp_p`) | `data-energy/processed/production.json` `daily_rows` | **MEASURED, needs build extension** — 6,667 daily BHP + 8,768 THP readings in source, not yet in wb monthly | Pressure tab |
| Uptime / deferment (`on_stream_hrs`) | same daily source | **needs build extension** — 13,397 daily rows populated | Production uptime, deferment |
| Injectors I-F-4 / I-F-5, VRR ≈ 1 | production `well_type=WI` | **present** (memory-confirmed) | VRR validation |
| PVT (undersaturated: Pb 213, Bo 1.47, Rs ~160) | `engine/sim/pvt.ts VOLVE_PVT` | **present** | VRR reservoir-volume conversion |
| Analog KB (RF by drive×lithology + Volve) | `engine/analog.ts SEED_ANALOGS` | **present** | Forecast/opportunity priors |

**Honest data gaps (badge, never fake):** Volve has **no 4D seismic vintages, no
discrete PLT / well-test build-up dataset, no RMP action tracker**. Where the COSMO
spec asks for these:
- *Well Tests* tab → use monthly-allocated rates as a **proxy** test series, badged
  `interpreted`; do not fabricate build-up transients.
- *Surveillance* 4D coverage → shown as an explicit **"no data"** state, not a mock.
- Action register / RMP → **user-authored**, persisted locally, badged `scenario`.

---

## 2. Sub-tab spine (9 — verbatim from COSMO authority)

Icons/labels follow `verticals['reservoir-management'].tabs`. For each: purpose,
build class (**reuse** existing engine / **new** engine), primary viz.

| # | Tab | Purpose (COSMO) | Build | Reuse / New engine | Viz |
|---|---|---|---|---|---|
| 1 | **Overview** | Field/reservoir health, exceptions, actions & gains, forecast confidence | new | `surveillance.ts` health roll-up | KPI cockpit + sparkline tiles |
| 2 | **Surveillance** | Acquisition status, coverage, exceptions, data gaps | new | `surveillance.ts` coverage matrix | calendar/matrix, "no-data" states |
| 3 | **Production** | Oil/water/gas, WCT/GOR, uptime/deferment, baseline variance | new + reuse | `surveillance.ts` diagnostics + baseline | **9-panel diagnostic grid** (GeaVision/WellNexus template, §4b) on `RM_CHART` SVG core |
| 4 | **Injection & VRR** | Injection rate, VRR, allocation, balance | new | `surveillance.ts vrr()` + streamline alloc | **GeaVision VRR template** (mirrored bars + VRR%-line + 100% target, §4b) + pattern map + allocation waterfall |
| 5 | **Pressure** | BHP/THP trend, depletion, connectivity, limits | new (needs data ext.) | `surveillance.ts` datum/trend | multi-well pressure trend + Hall plot + map |
| 6 | **Well Tests** | Latest vs history, KPI deviation, risk priority, validation | reuse+proxy | baseline/exception on allocated rates | **GeaVision well-test template** (dual-Y rate + WCT + PS-event pins, §4b) → WellWatch KPI/alarm |
| 7 | **Patterns** | Pattern health, producer/injector roles, connectivity, actions | **reuse + new** | `sim/streamline.ts` + `surveillance.ts` Chan/Tong diagnostics | pattern map + **Chan's/Tong's water-diagnosis** (§4b) + action register |
| 8 | **Forecast** | DCA/RoFo, potential hierarchy, uncertainty | **reuse** | `engine/review.ts` `fitDecline/blindTest/arps` | fan chart + decline diagnostics + assumptions ledger |
| 9 | **Opportunities** | Screen/mature/rank rig & rigless opportunities | **reuse** | `review.ts findOpportunity/breakEven` | funnel + ranked register (engineer decides) |

**Reuse is heavy and deliberate.** Tabs 7–9 are largely *wiring existing truth-locked
engines* (streamline allocation, DCA, opportunity/break-even solver) to real
production data behind a new surface. The genuinely new numerics live in **one**
module (`surveillance.ts`, §5).

---

## 3. Architecture — mirror the Field Development 3-zone pattern

The vertical reproduces the FD shell exactly (`CosmoShell.tsx` `isFD` branch →
`.tabs` bar + `.fd-body` [explorer | canvas]) and the FD router
(`tabs/fielddev/FieldDev.tsx`: `subtab` → viewer, `ViewerBoundary`, `registry`,
`Placeholder`).

**Shell wiring (`CosmoShell.tsx`):**
1. Add `RM_TABS` array (9 tabs, mirroring `FD_TABS:61`).
2. Add `const isRM = nav === 'reservoir-management'`.
3. New render branch (mirror `isFD`, `CosmoShell.tsx:175`): `.tabs` (RM_TABS) +
   `.fd-body` → `<ReservoirExplorer/>` + `<ReservoirMgmt subtab={rmTab}/>`.
4. Extend the subtab crumb (`:164`) from `isFD` to `isFD || isRM`.
5. Separate `rmTab` state (or reuse `tab` with a per-vertical default of `overview`).

**New files (`src/tabs/reservoir/`), mirroring `tabs/fielddev/`:**
- `ReservoirMgmt.tsx` — router (subtab → viewer + `ViewerBoundary` + `Placeholder`).
- `registry.ts` — the 9 VIEWERS (id/label/icon), same shape as fielddev registry.
- `ReservoirExplorer.tsx` — the **exception-first left tree**: Field → Reservoir
  (Hugin/Skagerrak) → Pattern (I-F-4 group, I-F-5 group) → Well, each node carrying
  a health/exception dot. (Adapt `CosmoExplorer` tree mechanics; new grouping.)
- 9 views: `Overview.tsx`, `Surveillance.tsx`, `Production.tsx`, `InjectionVrr.tsx`,
  `Pressure.tsx`, `WellTests.tsx`, `Patterns.tsx`, `Forecast.tsx`, `Opportunities.tsx`.
- Reuse the FD **chrome kit verbatim**: `tabs/fielddev/{hooks,chrome}` (`useAsync`,
  `useCanvas`, `cssVar`, `Inspector`, `Slider`, `Loading`, `ErrorBanner`) +
  `components/Provenance NatureBadge`.

**Data loaders:** reuse `wb/load loadProdField/loadProd` + `wb/types ProdJson`.
Add loaders for the two extended series (BHP, uptime) once the build emits them.

**Persistence (mirror Well Delivery localStorage pattern):**
- `energy_rm_actions_v1` — action / opportunity register (exceptions → actions →
  tracked value), badged `scenario`.
- `energy_rm_patterns_v1` — user-adjustable pattern definitions (default seeded from
  I-F-4 / I-F-5 offsets).

---

## 4. New engine module — `src/engine/surveillance.ts` (truth-locked core)

The single new deterministic module; everything else reuses locked engines. Pure TS,
validated in `scripts/test-surveillance.mjs`, chained into `npm test`.

**SHIPPED (R1):** `vrr`/`cumulativeVrr`/`patternVrr` (reservoir-voidage VRR; Volve
undersaturated ⇒ `Bo·oil + Bw·water`, no free-gas term), `hall`/`lsqSlope`,
`waterCut`/`gor`, `movingMedian`/`robustSigma`, `detectExceptions` (point residual-z +
onset-flagged CUSUM), `wellHealth`. Truth-locked 34/34, headline **VRR = 1.023 on real
Volve** + F-12 BHP physical.

**R1.5 — diagnostics extension (concept, this revision):** the water/gas-diagnosis
suite the founder asked for. New pure-TS additions to `surveillance.ts`, each
truth-locked in `test-surveillance.mjs`:
- `chanWor(series)` → **Chan's diagnostic** (SPE 30775): WOR and the log-time
  derivative WOR′ = d(WOR)/d(ln t) (Bourdet-smoothed, L-spacing) + a screening
  `classify` → `'coning' | 'channeling' | 'multilayer'` from the WOR′ slope signature
  (≈0/negative = bottom-water coning; ≈+1 unit slope = channeling; stepwise positive =
  multilayer). Returns series + mechanism + confidence.
- `chanGor(series)` → the gas twin (GOR & GOR′) for gas coning vs channeling.
- `tongWaterDrive(series)` → **Tong's chart (童氏图版)**: water cut fw vs recovery
  degree R with the water-drive characteristic straight-line (Type-A: lg(ΣLiquid) =
  a + b·Np) → movable-oil **EUR** extrapolated to an economic fw. Returns fw–R points +
  fitted line + EUR.
- `ershaghiXplot(series)` → **Ershaghi–Omoregie X-plot**: X = ln[1/(1−fw)] − 1/(1−fw);
  Np is linear in X over fw≈0.5–0.98 → slope gives movable oil, extrapolate to economic
  fw for waterflood EUR.
- `hallDerivative(hall, cumInj)` → Hall slope trend (rising = plugging/skin, falling =
  fracturing/thief zone) — the injectivity call, not just the integral.
- `trailingSlope(series, n=12)` + `worYrPct` = `(exp(slope)−1)·100` — OLS log-linear
  tail slopes (WellNexus rule-engine pattern) feeding the exception/alarm signals.
- `patternAllocation(...)` → thin wrapper over `sim/streamline.ts` (R4).
- `fieldHealth(...)` → Overview roll-up.

**Validation targets (added to `test-surveillance.mjs`):** Chan `classify` returns
`coning` on a synthetic plateauing-WOR series and `channeling` on a unit-slope series;
`tongWaterDrive`/`ershaghiXplot` straight-lines recover a known movable-oil EUR to
within tolerance on a synthetic Buckley-Leverett displacement; `worYrPct` recovers the
input rate on an exponential WOR; `hallDerivative` sign flips between a plugging and a
fracturing synthetic. Same discipline as the shipped 34 assertions.

---

## 4b. Chart templates & the diagnostic grid (ported 1:1 from the founder's references)

The founder's two reference apps already contain the exact surveillance chart
templates, hand-rolled with **zero chart-library dependency**. We port their rendering
stacks verbatim (de-identified, mapped to Volve) rather than introduce a new lib — this
honors the 1:1-fidelity mandate AND our canvas/SVG-first norm. Three template families:

**(A) `RM_CHART` — the diagnostic SVG core** (port of WellNexus `WLN_CHART`). A single
reusable inline-SVG engine, not a library:
- `mount(cell)` → `<svg viewBox>` with 5 ordered `<g>` layers (`grid / axis / cohort /
  focus / overlay`), fixed pad `{l:38,r:10,t:10,b:22}`.
- `drawAxes(ctx, xExtent, yExtent, {yLog})` → scale fns `sx,sy`; **log-Y is first-class**
  (floors at 1e-3, decade ticks) — needed for WOR/GOR panels.
- `smoothPath(pts)` = **Fritsch–Carlson monotone cubic Hermite** (no overshoot);
  `nice()` 1/2/2.5/5/10 tick stepping; `attachHover` unified nearest-point tooltip with
  bisect x-lookup + pixel→data inversion.
- **cohort-vs-focus** layering: grey background wells (`cohort`) + highlighted selected
  patterns (`focus`, oil-green / water-blue), driven by an `RM_SELECTION` global
  (reservoir/location/patterns + x-axis slider caps). Re-renders on a selection event.

**(B) The 9-panel diagnostic grid** (WellNexus `f7…f15`, the screenshot). We keep the
exact panels + formulas but **improve their 9-hardcoded-IIFEs into a config-driven
`DIAG_SPECS[]`** array (one `RM_CHART` component per spec) — our one deliberate
divergence, for maintainability. The spec:

| Panel | X | Y | Scale | Formula (verbatim from ref) |
|---|---|---|---|---|
| Oil Rate vs Cum Oil | Cum Oil (MMbbl) | Oil rate (bopd) | lin | `cumOil += oil·dt/1e6` |
| WCT vs Cum Oil | Cum Oil | Water cut (%) | lin | `water/(oil+water)` |
| Hall Plot | Cum Winj (MMbbl) | Hall integral (psi·d) | lin | `hall += THP·dt` (ref uses **THP**, forward-filled) |
| Liquid Rate vs Cum Oil | Cum Oil | Liquid rate (bld) | lin | `oil+water` |
| Cum Liquid vs Cum Oil | Cum Oil | Cum liquid (MMbbl) | lin | running Σ |
| Water Inj Rate vs Cum Winj | Cum Winj | Inj rate (bwpd) | lin | `wi` |
| WOR vs Cum Oil | Cum Oil | WOR | **log** | `max(1e-3, water/oil)` |
| GOR vs Cum Oil | Cum Oil | GOR (scf/stb) | **log** | `gas·1000/oil` |
| BHP vs Cum Winj | Cum Winj | BHP (psi) | lin | injector `fbhp` |

Δt in days (`(d−prev)/86400000`, first step 30.44); cum volumes ÷1e6 → MMbbl. Note:
we now HAVE real BHP/THP monthly (R0) — Hall can offer a THP (ref-faithful) **or** BHP
toggle, badged.

**(C) The VRR panel** (GeaVision `_dVRR`, canvas 2D). A **mirrored stacked-bar + line**
combo, not a scatter:
- zero line mid-canvas; **above** = production stacked bars (oil green / water blue /
  gas orange, reservoir bbls); **below** = injection stacked bars (water-inj cyan /
  gas-inj purple).
- **VRR% line** black smooth bezier over the production half, right axis 0–200%.
- **dashed orange target at VRR = 100%** (`setLineDash([4,3])`).
- injector-capsule strip (green patterns / blue supporting injectors / orange
  "VRR NN%") + dual-thumb date-range slider.
- VRR = ΣInjVoidage / ΣProdVoidage. The reference pre-bakes reservoir-barrel columns;
  **we supply the FVF conversion from `surveillance.ts` (`Bo·oil + Bw·water`)** — the
  honest, Volve-correct version the reference omits.

**(D) The well-test panel** (GeaVision `_dWelltest`, canvas 2D). Dual-Y **rate + water-
cut time series**, NOT a transient plot: left Y rate (Liquid purple + Oil green
polylines w/ dot markers), right Y water-cut % blue, X = date; **PS-event overlays**
(vertical dashed + triangle markers + labels for choke change / zone open-close / acid
stim / injection startup / gel treatment), GOR+WCT in the hover tooltip. For Volve:
monthly-allocated rates (badged `interpreted` proxy); events from any available Volve
event log, else the event track is an explicit empty state.

**Honest note:** the references contain **no** pressure-transient/Horner/derivative
well-test, no Chan's, no Tong's, no X-plot. Those (§4, R1.5) are ours to author — the
templates above give the surveillance *trend* views; the diagnostics give the *physics*.

---

## 5. Chart stack (revised — zero new dependency)

| Need | Pick | Reason |
|---|---|---|
| Diagnostic grid + WOR/GOR/Hall/decline trends | **port `RM_CHART`** (inline-SVG, §4b-A) | the founder's own WellNexus engine; monotone-cubic, log-Y, cohort/focus built-in; zero dep |
| VRR panel | **port GeaVision `_dVRR`** (canvas 2D, §4b-C) | 1:1 with the reference the founder named for VRR |
| Well-test panel | **port GeaVision `_dWelltest`** (canvas 2D, §4b-D) | 1:1 with the reference the founder named for well-test |
| Pattern / pressure / Hall maps | **reuse FD canvas map** (`MapView`/`Map3D`) | already have hillshade/heat; no MapLibre/deck.gl for a single field |
| Connectivity graph (optional) | defer Cytoscape/Sigma | streamline allocation + map arrows cover it |

**uPlot is dropped** — the references are hand-rolled canvas/SVG, and porting them gives
exact fidelity with **no new dependency** (better than the earlier uPlot call). All
rendering stays deterministic; engines own every number.

---

## 6. Build order (phases R0–R6)

Assignment convention: **Fable** = numerics/truth-lock, **Opus** = surface impl,
**Sonnet** = mechanical wiring.

- **R0 — data (Fable/Sonnet):** extend `scripts/build-workbench-data.mjs` to emit
  monthly **BHP + THP + uptime + role** per well (from `processed/production.json`)
  and default **pattern definitions**; verify VRR≈1 window materializes.
- **R1 — engine (Fable): ✅ SHIPPED.** `surveillance.ts` + `test-surveillance.mjs`
  34/34 (VRR=1.023 real Volve, Hall, baseline+CUSUM exceptions, health).
- **R1.5 — diagnostics engine (Fable):** extend `surveillance.ts` with the water/gas-
  diagnosis suite (§4, R1.5): `chanWor`/`chanGor`, `tongWaterDrive`, `ershaghiXplot`,
  `hallDerivative`, `trailingSlope`/`worYrPct` — each truth-locked. Pure numerics, no UI.
- **R2 — chart core + shell + spine (Opus):** port `RM_CHART` SVG engine (§4b-A) + the
  canvas VRR/well-test templates (§4b-C/D) as `src/tabs/reservoir/chart/*`; shell wiring
  (§3.1), `ReservoirMgmt` router, `ReservoirExplorer`, **Overview** cockpit, **Production**
  = the config-driven 9-panel diagnostic grid (§4b-B). First live surface.
- **R3 — balance (Opus):** **Injection & VRR** (GeaVision VRR template + allocation
  waterfall + pattern map) + **Pressure** (BHP/THP trends + Hall on real R0 data).
- **R4 — diagnosis + reuse (Opus):** **Patterns** (streamline allocation + **Chan's/
  Tong's/X-plot** water-diagnosis from R1.5) + **Forecast** (review.ts DCA/blind-test
  fan chart + assumptions ledger).
- **R5 — decision loop (Opus):** **Opportunities** (findOpportunity/breakEven funnel)
  + **Well Tests** (GeaVision well-test template §4b-D on allocated-proxy rates + PS
  events, honestly badged) + **action register** persistence + Report/Document/
  Presentation export links.
- **R6 — close-out (Opus/Sonnet):** **Surveillance** coverage matrix + exception
  engine wired to Overview; cockpit polish; provenance/honesty QC; battle-test exit;
  cross-app forward-link stub (lessons → analog KB / Field Dev model-vs-actual).

---

## 7. Honesty & provenance guardrails (non-negotiable)

- Every derived value carries a `NatureBadge`: **VRR/WCT/GOR/Hall = `derived`**,
  **DCA/RoFo = `forecast`**, **opportunities/actions/RMP = `scenario`**, raw
  rates/pressure = `reported`/`measured`.
- Depth references explicit (TVD/TVDSS/MD), never silently mixed.
- Missing data shows a **"no data" state**, never a mock (4D, PLT, RMP).
- Approved evidence is never overwritten — actions/scenarios create versions.
- The Forecast tab must keep FD's honesty posture: Volve field-aggregate DCA is a
  **weak** predictor (blind-test MAPE ~61%, injection-supported/faulted) — surface
  that, don't hide it.

---

## 8. Cross-app closed learning loop (the strategic payoff)

- **Back-link → Field Development:** model-vs-actual comparison (RM actual rates /
  pressure vs FD forecast); the RM Pressure/VRR surfaces are where the static model
  gets its reality check.
- **Forward-link → Well Delivery:** matured **Opportunities** emit a `WellProposal`
  seed (`sourceTarget`), reusing the Well Delivery spine.
- **Forward-link → Exploration/analog:** intervention outcomes + actual performance
  feed the analog KB (reference-class library), closing the loop.
- **Export:** action register + surveillance snapshots map to
  `[[Report]] · [[Document]] · [[Presentation]]`.

---

## 9. First concrete pass (if approved)

R0 + R1 together: extend the wb build to emit BHP/uptime/role + pattern defs, then
land `surveillance.ts` with a green `test-surveillance.mjs` (VRR≈1 on the real Volve
waterflood window as the headline validation). That unlocks R2 (Overview + Production)
as the first visible Reservoir Management surface — no UI is built until the numbers
are truth-locked.
