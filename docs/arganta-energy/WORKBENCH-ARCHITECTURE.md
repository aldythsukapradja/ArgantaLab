# ArgantaEnergy — Workbench Architecture (mini-Petrel, for O4)
Date: 2026-07-21. Mechanics learned from the founder-provided GeaVision reference (read directly), de-identified. ALL content maps to Volve; no external field/well/client names or data in our repo.

The wedge. Build the O4 Workbench on this proven shape. The key insight: **the internal state model + a pure numerical `engine` + the tab spine are directly portable; only the DATA ADAPTER and the SEED are dataset-specific.** That adapter is our seam to Volve.

## Architecture at a glance
- **Stack we'll use:** React/TS (not createElement) + raw `<canvas>` 2D for all viewers (map, logs, cross-section, mini-charts). No d3 for the geoscience canvases — hand-drawn. ECharts-equivalent (recharts, already in deps) only for Monte Carlo hist/CDF/tornado. three.js optional for a 3D surface later.
- **Shell:** 3-pane IDE — `explorer(tree, ~270px) | center(tabs + canvas + statusbar) | inspector(~296px)`. We already have the outer shell; add the 3-pane center for Workbench.
- **Separation that matters:** a **pure, stateless `engine` module** (zero React/DOM) = the reusable gold. Unit-testable, shared by every viewer AND the agent.

## The pure `engine` kernel (port to `packages`/`src/engine`, TS, deterministic)
| Function | What | Formula/method (exact) |
|---|---|---|
| `makeView(bounds,w,h,pad,zoom,cx,cy)` | fit-to-bounds affine | returns `toX/toY/inv/s`; Y flipped (north up). Powers pan/zoom, hit-test (screen→world via `inv`), all drawing |
| `gridSurface(pts,N,interp)` | interpolate scattered picks → N×N grid | IDW (power 2, default) / nearest / thin-plate-spline RBF (dense solve, fallback IDW if <3 pts) |
| `contactPolygon(grid,contact)` | **derive** trap closure | flood-fill largest above-contact cluster → pad mask → marching-squares at 0.5 iso → chain rings → pick crest-enclosing ring → decimate. Labeled `cls:'derived'` |
| `computeLogPetro(log,params)` | Archie petrophysics per sample | Vsh (Larionov `0.083*(2^(3.7*I)-1)`), PHIT `(ρma-ρb)/(ρma-ρfl)`, PHIE `clamp(PHIT-Vsh*phiSh)`, Sw `((a*Rw)/(PHIE^m*Rt))^(1/n)`, net flag = cutoffs |
| `grv(grid,scope,contact)` | gross rock volume by cell integration | `h=max(0,min(base,contact)-top)`, `GRV+=h*cellArea`; returns grv, hcCells, `hcpvMapM3` |
| STOIIP/GIIP | volumes | STOIIP(bbl)=`7758*(GRV/1233.4818)*NTG*PHIE*(1-Sw)/Bo`; GIIP(scf)=`(GRV*35.3147)*NTG*PHIE*(1-Sw)/Bg` |
| `monteCarlo(cfg,seed)` | uncertainty | `mulberry32(seed)` (fixed seed → reproducible), PERT (Beta via Marsaglia-Tsang gamma) / triangular / uniform sampling; **P90=pct(10), P50=pct(50), P10=pct(90)** (oil convention: low volume = high exceedance) |
| `_tornado` | sensitivity | Pearson r of each input vs output across realizations, sort |r| |
| `dca(qi,Di,b,...)` | Arps decline | exp `qi*e^(-Di*t)` / harmonic `qi/(1+Di*t)` / hyperbolic `qi/(1+b*Di*t)^(1/b)`; cum via trapezoid×30.44 → EUR |
| `economics(...)` | NPV | annual `ncf=rev-opex-capex`, **mid-year discount** `1/(1+disc)^(y+0.5)`, payback = first cum NCF≥0 |
| `injectorBenchmark(...)` | VRR | `vrrFactor=vrr≤1?vrr:1-0.4*(vrr-1)`; incremental oil per MMbbl water |
| `scanInfill(grid,wells)` | sweet-spot scan | HCPV-weighted, away from existing wells → candidate points (drives the agent) |

## Tab spine (workflow pipeline) — maps 1:1 to the agent steps
`Data · Map · Logs · Cross Section · Petro Model · Volumetrics · Uncertainty · Forecast · Injector · Economics · Presentation · Report`

Per-tab mechanics to reproduce:
- **Data** = two-lane governance UI (Corporate read-only ▸ User workspace); drag to promote flips `owner:'user'`.
- **Map2D** — UTM world coords; `makeView` affine; wheel zoom (clamp 0.3–8), shift-drag pan; `drawStructure` = grid heatmap + marching-squares contours; drawing tools (select/pan/point/obs/well/section/polyline/polygon), hit-test = squared-px-dist<100; wells colored by role.
- **Logs** — pure canvas multi-track (GR, RHOB, RT **log-scale** `(log10(v)-log10(.1))/(log10(1000)-log10(.1))`, Vsh, PHIE reversed via min>max, Sw); net-pay green fill where `net===1`; **draggable tops** (cache pixel pos `cv._tops`, hit within 6px, `pxToDepth` writes back `z`) = pick editing.
- **Cross Section** — line `{a,b}`, sample 80 pts, read top/base grids; **hang wells** by scalar projection `t=((w-a)·(b-a))/|b-a|²`, show if `0≤t≤1` & perp<300m; fluid `band(lo,hi,color)` gas/oil/water clipped to envelope.
- **Petro** — Inspector sliders bind `state.petro` (grMin/grMax/rhoMa/rhoFl/phiSh/a/m/n/rw/cutoffs); `zoneAverages` → NTG + net-weighted PHIE/Sw → `wellProps` → gridded to property maps.
- **Volumetrics** — `scopeRegion` (closure / custom polygon / well-drainage-circle) → one `grv` integrator; deterministic (field-avg) vs property (grids, needs ≥3 wells).
- **Uncertainty** — `mcConfig` builds PERT/triangular vars → 10k realizations → percentiles + tornado (recharts).
- **Forecast/Economics/Injector** — `dca`/`economics`/`injectorBenchmark`; `offsetBenchmarks` builds P90/P50/P10 type-wells from nearby analogs.
- **Presentation + Report** — **one `evaluate(state)` → two renderers**: `buildSlides` (array of `{kick,cap,title,src,render()}`) and report `pages` (`{tag,body}`), both reusing the same MiniMap/MiniChart canvas components as thumbnails/figures. Numbers via `fmt()` (k/MM/B).

## State + provenance (our truth law, already aligned)
Single root `state` (meta/reservoirs/wells/tops/points/polygons/sections/contacts/props/petro/forecast/econ/interp). Every entity carries:
- `owner`: `corporate|demo|enterprise|user` (governance lane; precedence **user ▸ enterprise ▸ demo**),
- `cls`: `measured|reported|interpreted|derived|forecast|scenario` (evidence class, color-coded),
- method capsule `◆ det / ▲ sto / ✦ llm` on every derived number/slide.
- `vis` map keyed by id kept **separate from data** (view state ≠ data).

## Agent step-runner (the "autonomous" feel, no LLM)
Orb → `AGENT_STEPS` (scan→place→convert wells→petro→volumetrics→MC→forecast→economics→deck). It **orchestrates the same pure `engine` tools in order**, `setTab()` at each step so the user watches, `sleep()` pacing, running log. **Human-approval gate** after the infill scan ("Approve candidates? Accept & continue / Cancel"). Threads a local `snap` copy between steps to avoid React async-state races. → This is our P4 Exploration agent shape; deterministic core, LLM only for narrative later.

## Data wiring — the seam to Volve (our main build surface)
Three layers: **demo seed** (fallback) → **enterprise adapter** (`adaptUnified` maps external tables→state) → **user edits**. For us:
- Our processed Volve tables (`data-energy/processed/*`) replace the enterprise layer. Write `adaptVolve(processed)` mapping: wells.json→wells, wellbores→child dim, formation-markers→tops (sorted by depth), trajectory→well paths, production→fact, horizons→top/base structural grids, depth `.dat` grids→the structural surface directly (we already have real horizons — no synth needed!).
- Loading path pattern: cache → fetch → seed. We generate `src/data` at build time already; extend for Workbench.
- We do NOT need `synthLog` (we have real LAS) — a big authenticity win over the reference's synthetic demo.

## Adopt / avoid
**Adopt:** the pure `engine` kernel (port verbatim to TS + unit tests); `makeView` affine everywhere; grid-once-reuse-everywhere; `contactPolygon` derived closures (labeled derived); seeded reproducible Monte Carlo; scope abstraction; provenance-everywhere; one-evaluate-two-renderers; agent-as-orchestration-with-gate.
**Avoid (their fragilities):** global mutable palette + redraw counter (make it prop/context); `window.__setProject` global bridge (use proper state/actions); `JSON.stringify` as memo keys (use ids/versions — Volve has far more points than their ~100 demo); re-running full RBF interp every redraw (cache grids, use a worker — critical at Volve scale); nearest-cell sampling (use bilinear); module-global mutable `FORMATIONS`/project arrays (per-project state).

## O4 build order (registry pattern from BUILD-METHODOLOGY)
1. Port `engine` to `apps/energy/src/engine/*.ts` + unit tests (deterministic, no DOM).
2. `adaptVolve(processed)` → internal state (real horizons/logs/markers/trajectory/production).
3. Viewer registry: each viewer = `{manifest{id,name,status}, render(container,data,ctx)}`. Build Map→Logs→CrossSection→Production first (real data), then Petro→Volumetrics→Uncertainty (engine-backed).
4. Provenance capsules + `owner`/`cls` on everything; `vis` map separate.
5. Gate O4 on the 20-task geologist battle-test.
