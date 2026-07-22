# V1 — Field Development Workbench (Petrel-clone) · LOCKED SPEC
v1.0.0 · 2026-07-22 · Fable design. Executors: Fable (data prep + engine numerics + verification), Opus (viewers/UI in phases V1a→V1c).
Founder direction: "more than Petrel grade, fully interactive, fully customizable" — state-of-the-art O&G visuals, all real Volve data.

## Hard rules
1. Locked contracts stand: schema-meta, knowledge types, kb.json. New locked contracts in this spec: `wb/` data assets (§2), `engine` API (§3).
2. Every rendered value carries dataNature; computed products are `derived`/`scenario` — never presented as measured. No synthetic data anywhere (we have real logs/horizons/production).
3. Deterministic engine only; seeded Monte Carlo (`mulberry32`, fixed seed) for uncertainty. No LLM.
4. Design tokens only; both themes; reduced-motion safe; canvas high-DPI (devicePixelRatio).
5. Heavy data lazy-loads per well/per surface (fetch from `/wb/`), never in the main bundle.
6. New deps allowed: `d3-contour` (isolines), `@equinor/videx-wellog` (log tracks — MIT, purpose-built). deck.gl/three 3D = V1a "3D window" uses lightweight custom Canvas/SVG isometric first; true WebGL 3D may come later — label projections honestly.
7. tsc strict; production build green; browser-verified desktop+mobile, both themes, zero console errors.

## 1 · Sub-tab spine (fielddev domain — replaces its single Overview stub)
`Map · Logs · Petrophysics · Correlation · Structural · Property · Volumetrics · Uncertainty · Forecast · Economics`
(SUBTABS config; each viewer self-registers `{manifest{id,status}, render}` — registry pattern. Phases: V1a = Map/Logs/Correlation; V1b = Petrophysics/Structural/Property; V1c = Volumetrics/Uncertainty/Forecast/Economics. Later-phase tabs render honest "coming in V1b/V1c" states with their planned mechanics listed.)

## 2 · Workbench data assets (LOCKED — built by `scripts/build-workbench-data.mjs` → `public/wb/`)
- `wb/index.json` — master: wells[] {name, well, x, y, td_md, td_tvd, role(producer|injector|both|none), has:{logs,traj,picks,production,pressure}}, surfaces[] {id, name, kind, cell, nx, ny, bbox, zmin, zmax}, contacts:[{kind:'OWC', tvdss:3120, cls:'interpreted', prov:'PEER'}], pvt {Bo:1.18(curve note), Rs:114, Pi:330, Pb:273, T:110}, defaults {phi:.225, ntg:.90, sw:.20, rhoMa:2.65, archie:{a:1,m:2,n:2}}.
- `wb/surface-<id>.json` — regular grid: {nx, ny, x0, y0, cell, z:[...nx*ny]|null} — **binned mean-z from the FULL horizon point cloud** (not the 4k preview), cell ≈ 50 m. Surfaces: hugin_top, hugin_base, bcu, ty_top, shetland_top, seabed.
- `wb/logs-<well>.json` — per well, FULL sample density (no downsample): {well, md[], curves:{GR,RHOB,NPHI,RT,DT,PHIE,SWE,VSH,SAND,CALI:...{unit, values[]}}, source_id}. Prefer the LFP/CPI run; fall back COMPOSITE. RT log-scale handled at render.
- `wb/traj-<well>.json` — full definitive stations {md,tvd,incl,azi,dispNs,dispEw} + surface x/y so map can draw the path.
- `wb/picks.json` — all 409 picks {well(canonical), surface, md, tvdss} (orphans carried with well:null).
- `wb/prod-<well>.json` — monthly {ym, oil, gas, water, wi} per producing wellbore + field totals.
All emitted with source_id evidence; script prints counts + a validation block (see §5).

## 3 · Engine (`src/engine/` — pure TS, no DOM; unit-tested by `scripts/test-engine.mjs`)
- `view.ts` — `makeView(bounds,w,h,pad,zoom,cx,cy)` → {toX,toY,inv,s}; y-flip north-up. THE shared affine for all canvases + hit tests.
- `grid.ts` — `Grid {nx,ny,x0,y0,cell,z[]}`; `sampleGrid(g,x,y)` bilinear; `binPoints(pts,cell)`; `gridMinMax`.
- `contour.ts` — wraps d3-contour over Grid → world-coord isolines.
- `closure.ts` — `contactPolygon(grid, contactZ)`: mask above-contact, flood-fill largest cluster, marching-squares ring, decimate → closure polygon (cls:'derived').
- `petro.ts` — Archie recompute: Vsh (Larionov tertiary `0.083*(2^(3.7*I)-1)` + linear), PHIT `(ρma−ρb)/(ρma−ρfl)`, PHIE `clamp(PHIT−Vsh·φsh)`, Sw `((a·Rw)/(PHIEᵐ·Rt))^(1/n)`, net flag by cutoffs; `zoneAverages(md,curves,top,base,cuts)` → {ntg, phie, sw} net-weighted. DUAL MODE: interpreted (LFP curves, default) vs recompute (derived).
- `volumetrics.ts` — `grv(top,base,contactZ,polygon?)` cell integration (h=max(0,min(base,contact)−top)·cellArea, clip poly); `stoiip(grvM3,ntg,phie,sw,bo)` = `grv·ntg·phie·(1−sw)/bo` (Sm³; bbl = Sm³·6.2898); per-scope: field closure | custom polygon | well drainage circle.
- `mc.ts` — `mulberry32(seed)`; samplers uniform/triangular/**PERT** (Beta via Marsaglia-Tsang gamma, Box-Muller gauss); `monteCarlo(cfg,n,seed)` → sorted realizations; **P90=pct(10), P50=pct(50), P10=pct(90)** (oil convention); `tornado` = Pearson r per input.
- `dca.ts` — Arps: exp/harmonic/hyperbolic; monthly steps; economic limit; cum via trapezoid → EUR; `fitDca(prodSeries)` simple log-linear fit of the decline segment (derived, labeled).
- `econ.ts` — yearly: rev=oil·price; opex var+fix; capex y0; **mid-year discount** `1/(1+d)^(y+0.5)`; NPV, payback.
- **Validation gates (hard, in test-engine):** STOIIP from real Hugin grids + defaults lands in **11–44 MMSm³** (±2× of published ≈22 MMSm³ [PEER]); production cum-oil sum reconciles to **~10 MMSm³ (~63 MMbbl) ±10%**; TVD≤MD; percentile convention asserted; PERT mean ≈ (min+4·mode+max)/6 ±2%.

## 4 · Viewers (state-of-the-art interactivity bar)
**Common chrome:** every viewer = full-bleed canvas workspace + right **Inspector** drawer (settings, fully customizable: colors from token palette, scales, cutoffs) + bottom-left scale bar / readout; hover readout everywhere (world coords, values); ⌘-scroll zoom-to-cursor, drag pan, double-click fit.

### Map (V1a)
- **2D/3D window switch** (segmented control top-left). 2D: structural map. 3D: isometric surface render (custom canvas, painter's algorithm over the 50m grid, vertical exaggeration slider) — labeled "isometric projection".
- Layers panel (left mini-tree, eyes): surfaces (pick active: Hugin Top default), wells (paths from traj, colored by role, labels), picks posts, contacts, polygons, section lines, grid/graticule.
- Structural map: filled heat ramp (token-safe colormap) + d3-contour isolines w/ inline depth labels; OWC contact ring (derived closure via engine.closure); hillshade-lite (∂z shading).
- **Drawing tools** (toolbar): select | pan | polygon (click vertices, dblclick close) | polyline/section line (2+ clicks) | **place well** | measure. Drawn objects go to a `userShapes` store (persisted localStorage `ae_wb_shapes`, cls:'user').
- **Well design**: placing a well opens Inspector "Well designer": name, kind (vertical/deviated/horizontal), target surface + landing depth (sampled from grid at x,y), kickoff, lateral length/azimuth for horizontal → generates a planned trajectory (cls:'scenario', dashed on map + available in X-section). Never mixed with real wells (separate layer + badge).
- **Structural X-section**: draw/select a section line → bottom split-pane opens: distance vs TVD along the line; sampled surface horizons (bilinear), fluid fills gas/oil/water between top/base clipped by contacts, real well paths that project within tolerance hung on it, picks posted. Interactive: drag section endpoints live-updates.

### Logs (V1a) — Petrel-grade via @equinor/videx-wellog
- Multi-track: GR (green/tan **shading fill to cutoff**), RHOB+NPHI overlay (crossover shading: gas effect yellow), RT log-scale (0.2–2000 ohm·m standard), DT, PHIE/SWE/VSH (interpreted, badged), SAND flag strip. Standard O&G scale conventions (GR 0–150 API, NPHI 0.45→−0.15 reversed, RHOB 1.95–2.95).
- Fully interactive: per-track show/hide, reorder, width; per-curve color/scale/fill editing in Inspector; **vertical AND horizontal orientation toggle**; depth track MD (TVD when traj loaded); zoom/pan along depth; hover crosshair with all curve readouts; picks drawn as labeled marker lines (draggable OFF in v1 — read-only).
- **Analytics drawer** (right slide-out): **2D crossplot** (any curve vs any curve, e.g. NPHI-RHOB w/ lithology overlay lines, GR color-code, polygon-select points → highlights depth interval on tracks) and **3D crossplot** (three axes, rotatable point cloud — custom canvas orthographic projection, labeled projection). Density hexbin toggle at high point counts.

### Correlation (V1a)
- Multi-well panel: pick N wells (chips) → side-by-side condensed track sets hung on a **datum** (MSL / a chosen pick surface — flatten on marker); pick markers connected across wells with colored correlation lines per surface (16-surface bridge colors); drag well order; per-well depth shift; shared or per-well scales; horizontal scroll for many wells.

### Petrophysics (V1b) — interpreted vs Archie-recompute dual mode, param sliders (Rw from LFP_RW default), live recompute over tracks, zone-average table per Hugin interval (picks-bounded), cutoffs editing, results → Property tab.
### Structural (V1b) — surface QC: grid stats, well-tie residuals (pick tvdss vs grid sample at well x/y — honest mistie table), contact editing (scenario), closure derivation view.
### Property (V1b) — per-well zone averages posted on map, IDW/kriging-lite interpolated property maps (PHIE·NTG·Sw), HCPV map = engine.grv cellwise × property grids.
### Volumetrics (V1c) — scope selector (closure/custom polygon/well drainage), deterministic vs property mode, STOIIP/GIIP cards w/ validation banner vs published ≈22 MMSm³ [PEER], per-well recoverable (drainage × RF).
### Uncertainty (V1c) — PERT/triangular sliders per input, 10k seeded realizations, hist+CDF (P90/P50/P10 flags), tornado.
### Forecast (V1c) — real history (monthly prod) + Arps fit overlay + forecast to economic limit; per-well and field; EUR vs published RF sanity note; material-balance tank check (F-12, STOIP≈19.6 MMSm³ target).
### Economics (V1c) — price/opex/capex/discount inputs, NPV/payback/cashflow chart, tied to Forecast output.

## 5 · Verification gates
- **Fable (now):** wb data build validated (counts, STOIIP corridor 11–44 MMSm³ from real grids, cum-oil ≈63 MMbbl reconcile, grid bbox sane, TVD≤MD); engine tests all pass.
- **Per phase (Opus DoD):** tsc+build green; zero console errors; browser-verified both themes + mobile; every V1a interaction demonstrably works (draw polygon, place+design well, section drag, log crossplot select, correlation flatten); screenshots.
- **V1 exit:** the 20-task geologist battle-test (written at V1c) passes.

## What NOT to do
No LLM; no synthetic data; no seismic; no fake 3D claims (label projections); don't touch locked contracts/mirror/decoders; don't inline wb data in the bundle; no new nav frameworks.
