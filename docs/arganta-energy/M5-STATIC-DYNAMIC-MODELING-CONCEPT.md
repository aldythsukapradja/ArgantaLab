# M5 — Static-Model Hardening + Simple Dynamic Simulator (Concept)
v1.0.0 · 2026-07-22 · Fable synthesis of six deep-research streams (Petrel static-modeling capability map; streamline method + simulator market; black-oil governing eqns/TPFA; IMPES/CFL; PVT+Volve; relperm/Peaceman; solvers/Buckley-Leverett/SPE1). **Concept only — no code.** Parent: V1BC-SPEC.md, GEAVISION_FOUR_APPS_ARCHITECTURE.md. Belongs to App 2 (Field Development), extends into a shared engine that all four apps reuse.

> **The ask (founder, 2026-07-22):** harden the static side — real gridding (unfaulted) + a simple property model, in **2D and 3D**, benchmarked against actual market tools (mini-Petrel). Then add a **simple dynamic simulator — classical black-oil AND streamline**. Then let Forecast / Volumetrics / Economics run in **two modes: deterministic (as today) OR full simple-simulation**. Concept first.

---

## 0 · Honest positioning (what this is, and is not)
Every commercial streamline product (FrontSim, 3DSL) and the leading open codes (MRST, OPM Flow) implement the **same textbook recipe** we will: TPFA pressure → Pollock tracing → time-of-flight → 1D Buckley-Leverett transport → periodic re-trace (streamline); or TPFA + IMPES/sequential (finite-volume). None of it is proprietary or exotic (Datta-Gupta & King; Aziz & Settari). Our differentiators are **not** better physics — they are: (1) zero-install, instant, teaching-grade interactivity in the browser; (2) a from-scratch **FV black-oil twin and a streamline twin sharing ONE pressure kernel**, so the user sees material-balance-accurate FV and flux-rich streamlines on the *same* model; (3) **evidence-native, inspectable** output with a `dataNature` badge on every number, vs. black-box commercial decks.

We will **not** claim to compete with ECLIPSE / INTERSECT / CMG / tNavigator on compositional physics, gravity-dominated regimes, faults, or giant-model HPC scale. Screening + teaching + provenance is the lane. Honest labels everywhere ("screening — not full-physics history match").

**Volve reality (research correction):** the field stayed **undersaturated** its entire life (Pi ≈ 328–335 bara ≫ Pb ≈ 213 bar). So for Volve there is **no free gas in the reservoir** — an **oil–water two-phase** simulator is not a shortcut, it is the physically correct model. Solution gas rides out with the oil (Rs ≈ 160 Sm³/Sm³ constant). This makes our staged plan (oil-water first) land exactly on the real physics.

---

## 1 · Petrel capability map → what mini-Petrel emulates
| Petrel step | Real algorithm(s) | Our screening emulation (unfaulted) |
|---|---|---|
| Make surfaces | Convergent interp / kriging / moving-average; depth conv V=V₀+kZ | ONE interpolator done well: ordinary kriging **or** IDW, spherical variogram UI; depth conv single V₀+kZ (already have grids) |
| **Fault modeling** | fault sticks → pillar discontinuities | **SKIPPED** — single connected block, honest "unfaulted screening model" |
| Pillar gridding / corner-point | pillars + 8-corner hexahedra (COORD/ZCORN) | vertical pillars ⇒ **regular Cartesian I/J + per-column top/base Z** — a plain `nx·ny·nz` voxel grid, no corner-point data model (ECLIPSE export later) |
| Zones / layering | proportional / follow-top / follow-base / fractions | **proportional** layering, user layer count (default 10); isochore = top−base grids |
| Geometric modeling | hexahedron bulk vol, skew QC | `bulkVol = dx·dy·(topZ−baseZ)/nLayers`; skip skew QC (no distorted pillars) |
| Scale up well logs | arith/geom/harmonic; most-of/random (discrete) | **arith** (φ, Sw), **harmonic** (kᵥ), **majority** (facies) — already have `upscale.ts` |
| Facies modeling | SIS / TGS / object / MPS(SNESIM); variograms | **SIS, 2 facies** (SAND/SHALE): indicator kriging + MC draw honoring NTG; single indicator variogram |
| Petrophysical modeling | SGS / kriging / co-kriging; per-facies variograms | **SGS + ordinary kriging**, per-facies spherical variogram (anisotropy ellipse), normal-score transform; IDW fallback |
| Volume calculation | cellwise STOIIP/GIIP, cutoffs, MC P90/50/10 | already built (Volumetrics) — reconcile to grid HCPV |
| **Petrel RE** | ECLIPSE 100/300, INTERSECT, **FrontSim** (streamline) | **this concept** — our FV black-oil + streamline twins |
| 2D/3D viz | map / intersection / 3D window / filters | 2D map + cross-section slicer + **real WebGL 3D** voxel/volume + clip plane |

Market for the static side: **Petrel** (SLB), **Roxar RMS** (now AspenTech/Emerson), **SKUA-GOCAD** (implicit/DSI, faults), **Petrosys** (gridding), open: **MRST**, **GemPy** (implicit structural), **SGeMS** (dormant). We sit closest to "MRST-in-a-browser, teaching-grade."

---

## 2 · Static hardening — the geo-model spine (`src/model/`)
Today Volumetrics computes on field-average defaults + IDW property grids. M5 makes a **real 3D cell grid** the single source of truth that both volumetrics and the simulators read.

### 2.1 GridModel (the object everything shares)
```
GridModel {
  nx, ny, nz, dx, dy                     // regular areal, proportional vertical
  topZ[nx*ny], baseZ[nx*ny]              // from Hugin top/base surfaces (kriged)
  active[nx*ny*nz]                       // in-closure + above-cutoff mask
  cellZ[...] cellThk[...] bulkVol[...]    // geometric modeling
  // properties (per active cell):
  facies[]  (0 SHALE | 1 SAND)           // SIS
  phi[]     (continuous)                 // SGS
  perm[]    (kx=ky, kv=kx*kvkh)          // from φ–k transform (Kozeny-style or cloud)
  ntg[]  sw[]                            // derived / SGS
  poreVol[] = bulkVol*ntg*phi            // for MB + sim
}
```
- **Gridding:** kriging/IDW of Hugin top & base (have surfaces); proportional layering into `nz` (default 10). Vertical pillars ⇒ trivial array grid.
- **Upscaling:** block LFP φ/Sw (arith), k (harmonic vertical), SAND flag (majority) into the well-column cells (have `upscale.ts`).
- **Facies (SIS, 2-facies):** indicator kriging of upscaled net-sand + MC draw (seeded), honoring per-zone NTG; single spherical indicator variogram (range/sill/nugget/azimuth sliders). Discrete SAND/SHALE cube.
- **Petrophysics (SGS):** normal-score transform → sequential random-path ordinary kriging of local mean/variance → conditional Gaussian draw → back-transform, **per facies** (sand φ-distribution ≠ shale). Spherical variogram, anisotropy ellipse (major/minor horizontal ~500–1500 m, vertical ~3–8 m — research-typical). Seeded, reproducible. Kriging-only / IDW as deterministic fallback for teaching.
- **Perm:** φ→k transform (deterministic cloud fit from any core, else Kozeny-Carman-lite); kᵥ = kₕ·(kv/kh ratio slider). Perm is the bridge from static to dynamic.
- **Reconciliation gate:** grid HCPV Σ(bulkVol·ntg·φ·(1−Sw)) must match the deterministic STOIIP within ±5 % (already the V1b DoD) — the static model is only "hardened" when the cube and the closed-form volumetrics agree.

### 2.2 New engine modules (pure TS, DOM-free, truth-locked)
- `engine/geostat.ts` — variogram models (spherical/exponential/Gaussian), ordinary/simple kriging, SGS, SIS, normal-score transform. Reference test: kriging exactness at data points; variogram reproduction; seed determinism.
- `engine/grid3d.ts` — build GridModel from surfaces + picks + layering; geometric modeling; active mask.
- `engine/perm.ts` — φ→k transforms, kv/kh.

---

## 3 · 2D & 3D visualization (visual SOP — interactive, premium, real 3D)
Per the standing visual SOP (no static SVG; real WebGL 3D; every viewer interactive):
- **2D:** map view (top structure + property maps, colormaps + legend + readout); an **interactive cross-section slicer** (drag an I- or J- or arbitrary polyline; canvas reads the cube) showing layered facies/φ/Sw, wells projected, contacts.
- **3D (real WebGL, r3f — reuse Map3D stack):** the property cube as instanced cells / volume, **clip-plane slider**, property selector (facies/φ/perm/Sw/pressure/So-front), well trajectories, contacts, camera orbit. For dynamic runs: **animated saturation front** through time; **streamline ribbons** (animated flux, injector→producer coloring) — streamlines are the visual signature of the whole feature.
- Both themes, reduced-motion, mobile single-column, `dataNature` badges.

---

## 4 · Dynamic simulator — the shared kernel + two twins (`src/engine/sim/`)
**One pressure kernel, two transport twins.** The elliptic pressure solve (TPFA) is identical for FV and streamline — build it once, branch only on transport.

### 4.1 Shared: TPFA pressure kernel (`sim/pressure.ts`)
- Face transmissibility = harmonic half-trans: `T = T1·T2/(T1+T2)`, `Ti = ki·A/di`. 7-point stencil (3D) / 5-point (2D).
- Phase flux `F_l = T·λ_l(upstream)·(Φ1−Φ2)`, **upstream mobility** `λ=kr/μ` per phase per face, potential `Φ = p − ρ g z`.
- **Wells:** Peaceman `r₀ = 0.14·√(dx²+dy²)` (isotropic 0.2·dx), `WI = 2πkh/(ln(r₀/rw)+skin)`, `q = WI·(kr/μ/B)·(p_block−p_wf)`; BHP- or rate-control.
- **Solver:** sparse; CG when SPD (incompressible, no wells/gravity asym), **GMRES/BiCGSTAB + ILU(0)** general. ~10k–100k cells: direct sparse LU feasible with reordering at the small end; iterative Krylov at the large end. Build CSR + a small BiCGSTAB/ILU(0) in TS (JS sparse ecosystem is thin — hand-roll).

### 4.2 Twin A — Finite-Volume black-oil (`sim/fv.ts`)
- **Time stepping: IMPES first** (implicit pressure, explicit saturation) — simplest, standard teaching path (MRST/OPM introduce it before fully-implicit). Sub-step each report step under the **CFL / throughput limit** `dt ≤ PV/(q·df/dS)_max`. Sequential-implicit later to relax CFL; fully-implicit Newton only if stiffness demands.
- **Physics staging:** (1) **incompressible oil–water 2-phase** (correct for undersaturated Volve) → (2) slightly-compressible + PVT(p) → (3) 3-phase w/ Rs & bubble-point switching (only needed for the gas what-if, not Volve).
- **PVT** (`sim/pvt.ts`): Bo(p), Rs(p), Bg(p), μ(p), Bw — from deck tables when present, else Standing / Vazquez-Beggs correlations; undersaturated `Bo = Bob·exp(−co(p−pb))`; per-cell saturated/undersaturated switch at local Pb. **Volve anchors:** API 29.1°, T 107–110 °C, Pi ≈ 330 bara, Pb ≈ 213 bar, Rs ≈ 160, Bo 1.38–1.51. (Update `wb/index.pvt` — current Rs 148 → ~160, note Pb 213.)
- **Rock-fluid** (`sim/relperm.ts`): Corey `krw=krw_max·Se^nw`, `kro=kro_max·((1−Sw−Sor)/(1−Swc−Sor))^no`, `Se=(Sw−Swc)/(1−Swc−Sor)`; endpoints Swc, Sor, exponents (no 2–3, nw 4–6 water-wet), LET optional; Pc neglected at screening (documented).

### 4.3 Twin B — Streamline (`sim/streamline.ts`)
- Same TPFA pressure → cell fluxes. **Pollock tracing** (velocity linear per axis in a cell ⇒ analytic exit point + travel time), launch hundreds–thousands of streamlines from injector faces.
- **Time-of-flight** `τ = ∫ φ ds/v` accumulated analytically per cell → 1D coordinate; drainage/swept volume = volume between TOF isosurfaces; **well allocation factors** from injector→producer streamline flux fractions (flow diagnostics).
- **1D transport:** Buckley-Leverett along each streamline in τ (Welge tangent for the analytic front, or 1D upwind FV), map S back to grid; **periodic re-trace** every few pressure steps.
- **Gravity:** operator-splitting (convection along streamline + vertical segregation) — flagged limitation; weak in gravity-dominated cases (fine for a thin undersaturated waterflood screen).
- Streamlines are the **flux-diagnostic lens**: injector efficiency, swept volumes, well pairs — things a cell field can't show.

### 4.4 Validation / numerics truth-lock (extend `test-engine.mjs`)
- **1D Buckley-Leverett** analytic (Welge) — front saturation & average behind front; FV & streamline must both match.
- **Quarter five-spot** waterflood — FV vs streamline breakthrough time + recovery curve agree (the canonical streamline regression).
- **SPE1** (Odeh, 10×10×3, gas injection) — target for the 3-phase FV path; report oil rate/GOR/pressure vs published.
- Cross-checks: TPFA harmonic trans, Peaceman WI, CFL sub-stepping, seed determinism. Parity block imports the built engine (as today, 36/36 style).

---

## 5 · Unifying deterministic ↔ simulation (adopt Forecast / Volumetrics / Economics)
The founder ask: same three viewers, **two modes**.

| Viewer | Deterministic mode (today) | Simulation mode (new) |
|---|---|---|
| **Volumetrics** | closed-form STOIIP/GIIP on grid HCPV | unchanged **STOIIP is static** — but sim reports **sweep/recovery** (RF from streamline swept-vol / FV cum), replacing the RF *slider* with a *computed* RF |
| **Forecast** | Arps fit to history + offset type-wells | **FV/streamline production profile** (oil/water rate, water-cut, breakthrough) under a development strategy; history-match overlay vs real Volve prod; MB tank check reconciles |
| **Economics** | oil-by-year from Arps | oil/water-by-year **from the sim run**; NPV/payback consume simulated profile; scenario compare (deterministic vs simulated) side-by-side |

**Contract:** a `ForecastSource = 'deterministic' | 'fv' | 'streamline'` toggle. Every simulated series carries `dataNature:'forecast'` + a run-record (grid version, PVT, relperm, wells, solver, seed, exec-time) — the deterministic-ownership doctrine (§1 of the four-app arch). A run is immutable + reproducible (fixed seed, versioned inputs).

---

## 6 · Build order, phasing & model allocation
Ordered so each phase ships a verifiable increment; **Fable** designs/verifies numerics, **Opus** implements, **Sonnet** only mechanical.

| Phase | Deliverable | Lead |
|---|---|---|
| **S0** | This concept + `MODEL-ALLOCATION` update + memory (DONE here) | Fable |
| **S1 · Geostat truth-lock** | `geostat.ts` (variogram/kriging/SGS/SIS) + `grid3d.ts` + `perm.ts`; reference impls in `test-engine.mjs`; parity gate | Fable (spec+tests) → Opus (impl) |
| **S2 · Static model tab** | "Grid & Property Model" subtab: build GridModel, SIS facies + SGS φ, HCPV reconciliation banner; 2D map + cross-section slicer | Opus |
| **S3 · Real 3D** | WebGL property cube (r3f), clip plane, property selector, wells/contacts | Opus |
| **S4 · Pressure kernel** | `sim/pressure.ts` (TPFA + Peaceman + BiCGSTAB/ILU0) + `pvt.ts` + `relperm.ts`; Volve PVT correction (Rs 160, Pb 213) | Fable (numerics) → Opus |
| **S5 · FV black-oil** | `sim/fv.ts` IMPES oil-water incompressible → compressible; Buckley-Leverett + quarter-five-spot truth-lock; "Simulation" subtab w/ animated saturation front | Fable+Opus |
| **S6 · Streamline** | `sim/streamline.ts` Pollock+TOF+1D transport; streamline ribbons + allocation/swept-volume diagnostics; five-spot FV-vs-SL regression | Fable+Opus |
| **S7 · Adopt viewers** | `ForecastSource` toggle; Forecast/Volumetrics/Economics run deterministic **or** sim; history-match overlay vs real Volve; run-records | Opus |
| **S8 · (opt) 3-phase + SPE1** | Rs/bubble-point switching for the gas what-if; SPE1 benchmark | Fable+Opus |

Each phase = tsc clean + engine parity green + browser-verified + commit to **main**.

---

## 7 · Acceptance (M5 exit)
Static: GridModel builds from real surfaces; SIS/SGS seeded-reproducible; **grid HCPV ≈ deterministic STOIIP ±5 %**; 2D + real-3D interactive. Dynamic: **Buckley-Leverett analytic match**; **FV vs streamline five-spot agree** on breakthrough/recovery; Volve oil-water FV run produces a plausible water-cut/breakthrough vs real history (screening, not history-matched). Unification: the three viewers switch deterministic↔sim; every simulated value badged + run-recorded. Honest labels throughout; no fabricated physics; commit history on main.

## 8 · Risks & mitigations
- **JS sparse-solver perf** → cap sim grids (coarsen to ~10–30k cells for interactive; offer a "coarsen" slider), Web Worker off-main-thread, optional WASM later; streamline transport is grid-resolution-cheap.
- **IMPES instability** → strict CFL sub-stepping + saturation-change clamp (Appleyard-chop-lite); sequential-implicit as the escape hatch.
- **Gravity in streamlines** → operator-split + honest limitation label.
- **Over-scope** → oil-water incompressible FIRST (correct for Volve); 3-phase/SPE1 optional tail.
- **Visual perf on the cube** → instanced meshing + LOD + clip-plane culling (reuse Map3D lessons; the rAF-paused-preview readback gotcha).
