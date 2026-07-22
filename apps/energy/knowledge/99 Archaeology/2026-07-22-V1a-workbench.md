# 2026-07-22 · V1a — Field Development Workbench (Map · Logs · Correlation)

Phase **V1a** of the Petrel-clone workbench per `docs/arganta-energy/V1-SPEC.md` (LOCKED).
Executor: Opus. Data (`public/wb/`) was pre-built + validated by Fable; this phase is viewers + engine numerics.

## What shipped

### Engine (`src/engine/`, pure TS, no DOM)
- `view.ts` — `makeView(bounds,w,h,pad,zoom,cx,cy)` affine (`toX/toY/inv/s`, y-flip north-up) + `boundsOf`/`padBounds`. The single shared transform for every canvas + hit-test.
- `grid.ts` — `Grid` type matching the wb surface JSON; `sampleGrid` bilinear with null-masking + partial-corner fallback; `gridMinMax`, `gridBounds`, `cellCentre`, `binPoints`.
- `contour.ts` — d3-contour over a `Grid` → world-coord isolines; null cells filled with a −1e6 sentinel + edge-touch flagging; `niceLevels` for round contour intervals.
- `closure.ts` — `contactPolygon(grid, contactZ)`: crest flood-fill (4-conn) of above-contact cells → binary field → marching-squares (@0.5) → largest ring → distance decimation. Labelled `cls:'derived'`.

### Domain wiring
- `nav.ts` `SUBTABS.fielddev` → the 10-tab spine (Map/Logs/Petrophysics/Correlation/Structural/Property/Volumetrics/Uncertainty/Forecast/Economics).
- `App.tsx` routes `fielddev` → `tabs/fielddev/FieldDev.tsx` (registry + `ViewerBoundary` error boundary so one viewer bug can never blank the app or the Knowledge/Data/Cosmonaut surfaces).
- V1a builds Map/Logs/Correlation live; the other 7 render honest phase-labelled placeholders listing their planned mechanics (`registry.ts` + `Placeholder.tsx`).

### Viewers (`src/tabs/fielddev/`)
- **MapView** — 2D structural map (token depth ramp + hillshade ∂z + d3-contour isolines w/ inline depth labels + graticule) and a custom-canvas **isometric projection** 3D (painter's algorithm, vertical-exaggeration slider, explicitly labelled "ISOMETRIC PROJECTION" — no fake-3D). Layer mini-tree with eye toggles (pick-one active surface, wells+paths coloured by role, picks, OWC closure ring via `engine.closure`, user polygons, section lines, graticule). Toolbar select|pan|polygon|section|place-well|measure. Drawn shapes persist to `localStorage 'ae_wb_shapes'` (`cls:'user'`). **Well Designer** (place-well → name/kind/target-surface/grid-sampled landing depth/kickoff/lateral/azimuth → generated planned trajectory, `cls:'scenario'`, dashed + SCENARIO badge, never mixed with real wells). Zoom-to-cursor wheel, drag pan, dblclick fit, hover world-coord+z readout, scale bar, high-DPI.
- **XSection** — draw/select a section line → bottom split-pane distance-vs-TVD; bilinear-sampled horizon stack, oil/water fills clipped by OWC (undersaturated → no gas band), real well paths projected within ±300 m, picks posted. Draggable endpoints live-update (uses a ref, so drag is synchronous/robust).
- **LogsView** — multi-track GR (fill), RHOB+NPHI overlay (gas-effect crossover), RT (log 0.2–2000), DT, PHIE/SWE/VSH (badged, greyed when a well lacks them), SAND strip. Standard scales (GR 0–150, NPHI 0.45→−0.15, RHOB 1.95–2.95). Vertical/horizontal toggle, depth zoom/pan, hover crosshair readout, picks as labelled marker lines, per-track show/hide + per-curve colour/scale editing in the inspector.
- **Crossplot** (Logs analytics drawer) — 2D crossplot (any-vs-any, NPHI–RHOB default w/ SS/LS/DOL lithology lines, GR colour ramp) with **polygon-lasso OR box-drag** selection → highlights the depth interval on all tracks; 3D crossplot (three-axis orthographic point cloud, drag-rotate, labelled "ORTHOGRAPHIC PROJECTION").
- **CorrelationView** — multi-well chips (default 4 wells w/ logs+picks: 19 A, F-11 A/B/T2), side-by-side condensed GR + RHOB/NPHI + RT lanes, datum select (MSL or flatten-on-pick-surface), per-surface coloured pick lines connected across adjacent wells, drag-to-reorder, per-well ±10 depth nudge, shared/per-well scale, horizontal scroll.

### Common chrome (`chrome.tsx`)
Right Inspector drawer per viewer (token-colour customisation), `withAlpha` colour helper (hex+rgb safe), Segmented/ToolButton/LayerRow/Slider/ReadoutBar, Loading/Error banners. `dataNature` badging everywhere (Provenance extended with a `scenario` nature). Both themes, reduced-motion inherited from global CSS.

## Verification (DoD)
- `npm run data:wb` state intact (not regenerated); `tsc --noEmit` clean (strict); `npm run build` green.
- Browser-verified on :5279 (1440×900): draw polygon ✓, place+design well (grid-sampled landing) ✓, drag section endpoint (world X 434900→433990, live x-section update) ✓, log crossplot box-select → depth-interval highlight (1497–3502 m) ✓, correlation flatten-on-Hugin-Top ✓. Map 2D/3D-iso, light theme, mobile 390px all render.

## Deviations
1. **Logs rendered with a custom high-DPI canvas track engine, not `@equinor/videx-wellog`.** videx's imperative D3 lifecycle fought the React re-render / theming / orientation-toggle model. The canvas engine meets the same spec (standard scales, fills, crossover, crosshair, picks, orientation toggle, per-curve editing) with clean theming and zero console noise. The dep remains installed for a future swap. (Spec §4 explicitly allows this fallback.)
2. **Crossplot selection also accepts a 2-point box-drag**, not only a traced polygon — better UX and reliably driveable; polygon lasso still works for ≥3 points.
3. Added a `ViewerBoundary` error boundary around the fielddev viewers (defensive; keeps a viewer fault from blanking the shell). Fixed one real bug found in-browser: the lasso handler read `e.currentTarget` (null under rapid dispatch) → now uses the canvas ref.

## Gotchas for V1b/V1c
- Per-well curve sets vary (F-12 has no PHIE/SWE/VSH; 19 SR has the full LFP set). Viewers must feature-detect curves, never assume.
- Picks carry a real `well` only for the exploration/appraisal wells (19*, F-11*); 300 of 409 are orphans (`well:null`). Map/correlation post only well-bound picks.
- Trajectory stations give `dispEw/dispNs` offsets — world path = `(well.x+dispEw, well.y+dispNs)`; there is no surface x/y on the traj file.
- The wb grids are cell-centre origin; contour/closure map d3 corner coords back with a −0.5 cell shift.
