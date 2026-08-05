# The Petrophysics Tab — Full Concept

2026-08-04 · Opus. The `petrophysics-lite` stage of the Field Development suite, built for real. Replaces the blueprint card the way `client-data-qc` was replaced by the Data Explorer.

Reads from **one source**: the workspace (`src/tabs/fielddev/workspace.ts`) — the ingested asset store, nothing else. Every number below was measured from the live Volve workspace on 2026-08-04, not assumed.

Sibling: [FIELD-DEVELOPMENT-SUITE-CONCEPT](FIELD-DEVELOPMENT-SUITE-CONCEPT.md) §3 (the ten stages). Consumes [CLIENT-DATA-INGESTION-AND-EXTRACTION-PLAN](CLIENT-DATA-INGESTION-AND-EXTRACTION-PLAN.md).

---

## Part 0 · Diagnosis — what the delivery actually contains

Not opinion. This is the Volve workspace, queried live.

| Fact | Value |
|---|---|
| Wellbores | **25** |
| CRS / datum | ED50 / UTM 31N — declared, parsed, never assumed |
| Curve types | **17** |
| Pick surfaces | **16** |
| Fluid contacts | **1** — OWC at 3200 m TVDSS, `interpreted`, from the Eclipse `EQUIL` deck |
| Depth grids | 6 (BCU · Hugin Top/Base · Seabed · Shetland Top · Ty Top) |

**Curve coverage, per wellbore:**

| Curve | Wells | What it unlocks |
|---|---|---|
| GR | 24 | Vsh — every model |
| RT | 24 | Sw — every model |
| RHOB | 20 | density porosity |
| NPHI | 20 | density–neutron porosity, gas crossover |
| DT | 17 | sonic porosity, the fallback when RHOB is bad |
| **PHIE · SWE · VSH · RW · GRMIN · GRMAX · RHOMA** | **3** | **Equinor's own LFP interpretation** |

### 0.1 The finding that shapes the whole design

**20 of 25 bores carry the full Archie quartet (GR · RT · RHOB · NPHI). Only 3 carry an interpretation.**

Those three are the 19-series exploration wells — `19 A`, `19 BT2`, `19 SR` — and they do not merely ship an answer. They ship **Equinor's parameters, as depth-varying curves**:

| LFP curve | Range (19 A) | Median | What it is |
|---|---|---|---|
| `RW` | 0.0185 – 0.0211 ohm·m | **0.0197** | formation-water resistivity, temperature-corrected with depth |
| `GRMIN` | 7.4 – 53.6 API | 24.5 | the clean-sand endpoint, **picked per depth, not a constant** |
| `GRMAX` | 57.6 – 193.0 API | 80.3 | the shale endpoint, likewise |
| `RHOMA` | 2.65 – 3.04 g/cm³ | 2.65 | matrix density — sandstone, with heavy-mineral excursions |
| `PHIE` | 0.01 – 0.38 v/v | 0.0695 | the answer |
| `VSH` | 0 – 0.99 v/v | 0.153 | the answer |

> **This is not a dataset with a gap. It is a dataset with a calibration set.**
>
> Three wells where the right answer is known, seventeen where it is not. That turns interactive petrophysics from "pick some numbers and hope" into a **transfer problem**: tune your parameter set until it reproduces Equinor's answer on the three wells that have one, then apply that *same, now-defensible* set to the seventeen that don't. The workspace already knows exactly which wells are in which group — that is what §1 is built on.

### 0.2 What exists to build on

| Asset | State |
|---|---|
| `src/engine/petro.ts` | `vsh` (linear · Larionov ×2) · `phit` · `phie` · `sw` (Archie) · `netFlag` · `zoneAverages`. Pure, truth-locked in `test-engine.mjs`. **Reuse, do not rewrite.** |
| `src/dataqc/petro.ts` | quick-look screening flags (litho, fluid, D–N separation). Screening only — labelled as such. |
| `src/tabs/fielddev/workspace.ts` | the single source. `bores[].curves`, `bores[].tops`, `commonCurveTypes()`, `commonTops()`. |
| `src/dataqc/viewers/LogViewer.tsx` | a working multi-track log plot with family scales and RHOB–NPHI shading. **Adapt.** |
| Legacy `Petrophysics.tsx` · `Crossplot.tsx` · `Crossplot3D.tsx` · `CorrelationView.tsx` | live, Volve-hardcoded, `wb/load.ts`-bound. **Read for behaviour, rebuild on the workspace.** |

**The gap:** every one of those legacy views computes with fixed constants. There is no parameter object, no scope, no provenance, no calibration, and no way to compare two interpretations. That is the entire build.

---

## Part 1 · The mental model

### 1.1 Petrophysics is a parameter argument, not a curve

A log viewer shows what was measured. Petrophysics is the argument about what it *means* — and the argument is entirely in the parameters: which Vsh transform, which endpoints, which matrix density, which Rw, which saturation model, which cutoffs. The curves are inputs. **The parameter set is the deliverable**, and it must therefore be a first-class, versioned, provenanced object — not React state.

### 1.2 Four scopes, most-specific wins

```
FIELD default   ──►   ZONE override   ──►   WELL override   ──►   INTERVAL override
(one per field)      (per pick pair)      (per wellbore)        (hand-picked depths)
```

A resolved parameter at any depth is the innermost scope that names it. The UI always shows **which scope won and why** — a value inherited from the field default looks different from one you set on this well, because confusing the two is how an interpretation quietly becomes untraceable.

### 1.3 Every parameter carries its nature

The same badge vocabulary the rest of the platform uses:

| Nature | Meaning |
|---|---|
| `measured` | read from a curve (`RHOMA` where the LFP ships one) |
| `interpreted` | Equinor's LFP answer — **never** silently mixed with ours |
| `derived` | our recompute from our parameter set |
| `calibrated` | our value, tuned against the LFP wells (§3) — the strongest thing we can produce |
| `analog` | a prior from the analog library |
| `user` | typed in, no other backing |

A well showing `PHIE` must always say which of these it is. Two `PHIE` curves on one track — Equinor's and ours — is the *point*, not a bug.

### 1.4 Absence is a result

20 bores can run Archie. **Five cannot**, and the tab says so, per well, with the missing curve named. A saturation for a well with no RT is not a conservative estimate; it is a fabrication. Same for zones: a well with no Hugin pick reports no Hugin net pay, however many curves it has.

---

## Part 2 · The surface — four sub-tabs

```
Petrophysics    [ Single Well │ Correlation │ Analytics │ Zonation ]     ⚙ Parameters
```

The **Parameters rail** is not a sub-tab. It is a right-hand rail present on all four, because changing `m` while looking at a crossplot and changing it while looking at a log are the same act. Every edit recomputes everything visible, live.

### 2.1 Single Well — the interpretation bench

The Techlog screen. Multi-track, depth-synchronised, MD/TVDSS switchable.

| Track | Contents |
|---|---|
| Depth + zones | MD/TVD, pick surfaces from the workspace as filled zone bands |
| Lithology | GR with the **active** GRMIN/GRMAX endpoints drawn as vertical lines you can drag |
| Resistivity | RT (log scale), RMED, RXO |
| Porosity | RHOB + NPHI with the standard limestone-compatible crossover fill |
| **Computed** | Vsh · PHIT · PHIE · Sw — ours (`derived`), with Equinor's overlaid dashed where it exists |
| Net / Pay | the cutoff flag as a two-colour ribbon; the thing the cutoffs actually produce |
| Cores / points | pressure stations, core plugs when a delivery ships them |

Interactions that matter: drag the GR endpoints and every downstream track redraws; drag a cutoff and the net ribbon redraws; click a depth and the crossplots highlight that sample.

### 2.2 Correlation — the multi-well panel

The wells you selected in the Input tree, side by side.

- **Datum**: hang on MD, on TVDSS, or **flatten on a pick surface** — the classic move. The surface list is `commonTops(ws.tops, selectedWells)`: only horizons picked in *every* selected well, so flattening can never produce a panel with a hole.
- **Tracks**: `commonCurveTypes(ws.curveTypes, selectedWells)` for the same reason.
- Correlation lines drawn between picks; zone fills carried across; a well missing a pick shows the gap rather than an interpolated line.
- Section geometry comes from the existing `xsection.ts` when the wells were picked from a traced section — the panel and the map agree because they are the same trace.

### 2.3 Analytics — crossplots

Both plots read one shared primitive: a flattened **sample table** built once from the workspace — `{ well, md, tvdss, zone, ...curves }` per depth sample, filtered by well set / zone / net flag. Everything else is a projection of it. Brushing in any view selects rows in that table, and every other view — including the log tracks and the field map — reflects the selection. One selection, many pictures.

**2D crossplot** — any curve vs any curve, colour by a third, with the templates that carry meaning:

| Template | Axes | Reads |
|---|---|---|
| Density–neutron | NPHI vs RHOB | lithology; sandstone/limestone/dolomite lines + gas crossover |
| **Pickett** | PHIE vs RT, log–log | **`m` is the slope, `Rw` is the intercept — you read the parameters off the plot** |
| Hingle | RHOB vs RT^(−1/m) | Rw and matrix on a linear grid |
| Buckles | PHIE vs Sw | irreducible-water hyperbolas; `PHIE·Sw = const` identifies the transition zone |
| Vsh–PHIE | VSH vs PHIE | where the cutoffs actually cut |

**3D crossplot** — GPU point cloud, three curves as axes plus colour, orbit and box-select. It is not decoration: `GR × RHOB × RT` coloured by zone separates facies that any two of the three overlap on.

### 2.4 Zonation — the deliverable

Per zone × per well: gross, net, N:G, mean PHIE, mean Sw, net pay, from `engine/petro.zoneAverages`. Plus the summary the static model consumes, plus the honest empty rows for wells that lack the pick or the curves. This is the `PetrophysicalModel` artifact the FD workflow declares.

---

## Part 3 · The interactive engine

### 3.1 Vsh

| Control | Options |
|---|---|
| Method | linear (IGR) · Larionov tertiary · Larionov older · Clavier · Steiber |
| Endpoints | **auto** (well's own P5/P95) · **manual** (drag on the log or the histogram) · **from curve** (`GRMIN`/`GRMAX` where the LFP ships them) |

Auto-endpoints are per-well by default, because a fixed API cutoff misfires across a basin — and Volve proves the point: Equinor's own endpoints vary *with depth*, 7–54 API clean and 58–193 API shale.

### 3.2 Porosity

- **Density**: `PHIT = (ρma − ρb)/(ρma − ρfl)`, with ρma per zone (2.65 sand / 2.71 lime / 2.87 dolo, or `RHOMA` curve) and ρfl from the mud filtrate.
- **Density–neutron**: `√((φD² + φN²)/2)` — the gas-tolerant form.
- **Sonic**: Wyllie or Raymer–Hunt, for the 17 wells with DT and the intervals where RHOB is washed out.
- `PHIE = PHIT − Vsh·φsh`, φsh from a shale-baseline pick.

### 3.3 Saturation — and why Archie alone is not enough here

Volve's Vsh median is 0.153 but its tail reaches 0.99. Archie assumes clean sand; in shaly intervals it over-estimates Sw. So four models, chosen per zone:

| Model | Use |
|---|---|
| **Archie** | clean sand — `Sw = ((a·Rw)/(φ^m · Rt))^(1/n)` |
| **Simandoux** | moderate shale, laminated |
| **Indonesia** (Poupon–Leveaux) | high, dispersed shale — the North Sea workhorse |
| **Waxman–Smits** | when CEC/Qv data exists (it does not in this delivery — the model is offered and reports its own missing input) |

`a`, `m`, `n` are parameters with the standard defaults (1.0 / 2.0 / 2.0) and three ways to improve them: type them, read `m` off the Pickett plot, or take them from `wb` `defaults.archie` where the delivery declares them.

### 3.4 Rw and salinity — the panel the user asked for

Rw is where a saturation is won or lost, and it is temperature-dependent, so it is never one number. Three routes, all live in one panel:

1. **Direct** — enter Rw at a stated formation temperature.
2. **From salinity** — enter NaCl-equivalent ppm; Rw computed by **Arps** (temperature conversion) over the **Bateman–Konen** salinity relation. Temperature at depth from a geothermal gradient the user sets, anchored on any measured BHT in the delivery. The panel draws the resulting **Rw-vs-depth curve**, because that is what the answer actually is.
3. **From the Pickett plot** — pick the 100 %-Sw line; the intercept *is* Rw. Reads the parameter off the data rather than off a table.

**And then it is checked.** The three LFP wells ship an `RW` curve: 0.0185–0.0211 ohm·m, varying with depth. The panel overlays your Rw-vs-depth against Equinor's measured one and reports the misfit. A salinity that reproduces that curve is a *calibrated* salinity; one that does not is a guess, and it is labelled as one.

### 3.5 Cutoffs

`Vsh ≤ · PHIE ≥ · Sw ≤`, per zone, with net and pay recomputed live and the sensitivity shown — a small "net metres vs cutoff" sparkline beside each slider, so you can see whether the answer hinges on the number you just picked.

---

## Part 4 · The calibration loop — the differentiator

This is what §0.1 makes possible, and no other tool in this class does it because no other tool knows its own data coverage well enough to.

```
   ┌─ 3 wells with Equinor's LFP answer ─┐        ┌─ 17 wells with curves only ─┐
   │  19 A · 19 BT2 · 19 SR              │        │  F-1 … F-15 D               │
   └──────────────┬──────────────────────┘        └──────────────┬──────────────┘
                  │                                              │
        run OUR parameter set                                    │
                  │                                              │
        ┌─────────▼──────────┐                                   │
        │  misfit vs LFP     │   PHIE · VSH · SW                 │
        │  per depth + RMS   │   scatter, 1:1 line, R²           │
        └─────────┬──────────┘                                   │
                  │  tune until it reproduces                    │
                  ▼                                              ▼
        ╔═════════════════════════╗   apply    ╔════════════════════════════════╗
        ║ CALIBRATED parameter set║ ─────────► ║ 17 derived interpretations that║
        ║ (nature: `calibrated`)  ║            ║  carry their calibration proof ║
        ╚═════════════════════════╝            ╚════════════════════════════════╝
```

The calibration report — which wells, which curves, what RMS, what the parameters ended up as — travels **with** the resulting interpretation as its provenance. An `PetrophysicalModel` artifact that was calibrated says so and shows its numbers; one that was not says *that*, equally plainly.

Honest limits, stated in the UI, not buried: the three calibration wells are **exploration** wells in the 19-series, not the F-series producers. They sample the same formations but not the same structural position. Calibration transfer is a defensible assumption, and it is an assumption — the report names it.

---

## Part 5 · Build order

| Step | Deliverable | Test |
|---|---|---|
| **P1** | `petro-model.ts` — parameter object, 4-scope resolution, provenance. Pure. | `test-petro-model.mjs` |
| **P2** | `petro-compute.ts` — Vsh ×5, porosity ×3, Sw ×4, Rw/Arps/Bateman, cutoffs. Pure; wraps `engine/petro.ts`. | `test-petro-compute.mjs` — **including a run against the real 19 A LFP curves as a regression fixture** |
| **P3** | `sample-table.ts` — the flattened analytics primitive + brush selection store | `test-sample-table.mjs` |
| **P4** | Single Well bench (adapt `LogViewer`) + the Parameters rail | live |
| **P5** | 2D crossplot with the five templates, brushed to P3 | live |
| **P6** | Correlation panel on `commonTops` / `commonCurveTypes` | live |
| **P7** | 3D crossplot | live |
| **P8** | Zonation table → `PetrophysicalModel` artifact | live |
| **P9** | The calibration loop (§4) + its report | `test-petro-calibration.mjs` |

P1–P3 are pure modules and land with truth-locks before a pixel is drawn — the same order the workspace itself was built in.

---

## Part 6 · Rules this tab does not break

1. **One source.** Every curve, pick, well and contact comes from `getWorkspace(fieldId)`. No `wb/load.ts`, no fetch, no constant.
2. **No result without its inputs.** A well missing RT gets no Sw, and the UI names the missing curve.
3. **`interpreted` ≠ `derived`.** Equinor's curves and ours are never averaged, never merged, never plotted without a badge distinguishing them.
4. **Parameters are visible.** No number reaches a chart without the panel being able to say where it came from and which scope set it.
5. **Calibration is a claim with evidence.** `calibrated` means a misfit was measured against a known answer. Nothing else may use the word.
