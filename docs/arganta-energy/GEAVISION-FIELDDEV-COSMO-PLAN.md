# Field Development → GeaVision-Petrel layout on COSMO + GVSURF data pipeline
v1.0.0 · 2026-07-22 · Fable. Learned from the founder's **GeaVision_Master** (Petrel-like 3-zone Exploration Studio) and **GeaVision-Studio** (EarthVision→GVSURF data pipeline). Plan for the three stated priorities: **(1) data mapping** (left explorer ↔ canvas ↔ right inspector + the workflow tabs), **(2) visualization** (state-of-the-art 2D viewer + icon top-nav, re-skinned to COSMO), **(3) data transformation** (ingest EarthVision grid ASCII → light GVSURF → lighter 3D gridding). Keep the GeaVision *layout & logic*, adopt **COSMO component consistency (teal, COSMO tokens) — COSMO is the design authority.**

## 1 · The correlation — LEFT · CANVAS · RIGHT (the Petrel spine)
GeaVision Master is `.body = flex[ .explorer(270px) | .center(canvas) | .inspector(296px) ]`. The three zones are bound by **three shared events**:
- **Selection** — click an explorer node → it becomes the active object → the **canvas focuses/highlights** it *and* the **inspector shows its properties + provenance**. (Cross-view selection = a platform event, per the COSMO lessons IA.)
- **Visibility** — each node has an **eye toggle** (`vis` map) → the canvas shows/hides that layer live. (Explorer is the layer manager.)
- **Context** — each node has a **⋯ menu** (rename/duplicate/delete/color/export) and folders have **+ add** and **drag-drop** (e.g. drop a well into a reservoir). The inspector edits the *active* object; the explorer manages the *set*.

So: **explorer = what exists + visibility + CRUD; canvas = the picture + interaction tools; inspector = the active object's properties + evidence.** One dominant surface per COSMO IA level (Global · Workspace · Canvas · Context).

## 2 · The 11 explorer folders → our data model
GeaVision's tree (the "11 explorer stuff") maps 1:1 onto Field Development data we already load from Volve/wb:
| # | GeaVision folder | Contents | Our source |
|---|---|---|---|
| 1 | **Well Selector** (→ Global Well Logs · reservoirs → wells → Trajectory/Logs/Well-tops) | wells, roles, trajectories, logs, tops | `wb wells/traj/logs`, `schema-meta` |
| 2 | **Formation Tops** | formations by age + color | picks / formation registry |
| 3 | **Marker Collections** | grouped tops | derived from picks |
| 4 | **Custom Tops** | user picks per well | user layer |
| 5 | **Points** | interpreted/obs/infill points | user + proposals |
| 6 | **Polylines** | interpreted lines | user |
| 7 | **Polygons** | AOI + auto contact×surface closures | `engine/closure` (contactPolygon) |
| 8 | **Cross Sections** | A–B section lines | XSection viewer |
| 9 | **Maps** | top/base surface maps | `wb surfaces` |
| 10 | **Contacts** | GOC/OWC/GWC by group | `wb contacts` |
| 11 | **Volumetric Cases** | saved STOIIP/GIIP runs | Volumetrics engine |
Each folder: title + icon + count badge + **+ add**; each row: eye · color-dot icon · label · sub · **⋯**. Reservoir folders accept **drag-dropped wells**. This becomes the Field Dev left panel — reusing our existing `wb/load` + engines as the data behind each folder.

## 3 · The workflow tabs (canvas top-nav) → our subtabs
GeaVision canvas tabs (the icon nav in the screenshot): **Map · 3D Shell · Logs · Well Log Correlation · Cross Section · Static Model · Volumetrics · Uncertainty · Forecast · Injector · Economics**. Maps onto our built Field Dev subtabs (rename to match; add icons):
`Map`↔Map · `3D Shell`↔Map3D/GridCube3D · `Logs`↔Logs · `Well Log Correlation`↔Correlation · `Cross Section`↔XSection · `Static Model`↔Grid Model · `Volumetrics`↔Volumetrics · `Uncertainty`↔Uncertainty · `Forecast`↔Forecast · `Injector`↔Simulation/streamlines · `Economics`↔Economics (+ our `Field Review`). **All engines already exist and are truth-locked — this is a re-label + icon + layout move, not new logic.**

## 4 · The canvas toolbar + overlays
GeaVision `.toolbar-c` (centered, floating, pill): **select · pan · point · obs · well · polyline · polygon · section** (draw/interact tools) → these bind to the explorer add-actions (draw a polygon → adds to Polygons folder). Plus `.overlay-r`: **See all** (fit view) · **2D/3D** toggle. Plus `.hint` (bottom-left), `.legend` (bottom-right, colormap), `.evbadge`/`.crs`/`.scalebar` (evidence + spatial declaration — the COSMO "every canvas declares method·source·units·status" rule). Adopt this exact overlay grammar.

## 5 · Priority 2 — the state-of-the-art 2D viewer (fancier)
GeaVision's 2D map is Canvas2D. "Fancier" = a **WebGL 2D map** for smoothness + density, per the COSMO visual-engine matrix (maps → GL). Plan:
- **Engine:** a WebGL 2D surface renderer (PixiJS v8 — already used in KinWorld/Vault; or a small custom regl/WebGL) with **GPU-shaded surface fill** (colormap in a fragment shader over the grid), smooth pan/zoom-to-cursor, **hillshade** (normals → light) for structure legibility, crisp contour lines, well symbols, polygons, and a section line.
- **Re-skin to COSMO:** teal accent (`--teal #0FB5A6`), COSMO tokens/shadows/radii, the `.ws-canvas`/`.ws-toolbar`/`.evbadge`/`.scalebar` classes, the centered `.toolbar-c`. Colormaps from GeaVision (`spectral/depth/viridis/rainbow`) but the chrome is COSMO.
- **Top navbar with icons:** the tab bar gets a Lucide icon per tab (Map/Box/LineChart/Columns/Layers/…) — COSMO `.tab` styling first (consistency), icons second.
- Interaction: click surface → inspector readout (depth, attribute, CRS); hover → crosshair + value; draw tools add to the explorer.

## 6 · Priority 3 — GVSURF: EarthVision ASCII → light surface → light 3D grid
The founder's proven lightening stack (from GeaVision-Studio). Port it verbatim as our data-prep + a runtime decoder.

**Ingest (`parseEV`)** — EarthVision grid ASCII: lines `x y z col row`, `#`-comments carry `Z_units`. Collect xs/ys/zs/cs/rs + ncol/nrow.

**Lighten (`evToGVSURF`) — four compounding compressions:**
1. **Affine instead of coordinates.** Least-squares fit `(col,row)→x` and `→y` (`fitA` → 3 params each). World coords reconstruct as `wx = x0 + xc·col + xr·row`. Replaces N×2 float coordinates with **6 numbers**.
2. **Int16 quantization.** `offset=(zmin+zmax)/2`, `scale=max(quant, range/60000)`, `z_i = round((z−offset)/scale)`, null=`NULLV`. Float64 → **Int16 (4× smaller)**, exact to ~range/60000.
3. **gzip + base64.** `pako.gzip(int16, level 9)` → base64, `encoding:"int16-gzip-base64-rowmajor"`. Typically **5–10×** more.
4. **Downsample at ingest** (`down` stride: keep every `down`-th col/row).
Output `GVSURF` object: `{format,ncol,nrow,affine,z_units,z_offset,z_scale,z_null,z:base64}` — a multi-MB EarthVision grid becomes **~100–500 KB**. Color-by **attributes** (porosity/facies/etc.) are stored the same way, resampled onto the *same grid & node order* (so color never moves geometry — the COSMO scientific-integrity rule).

**Decode (`decodeSurface`)** — `pako.ungzip(base64)→Int16Array`; `depth(c,r)=offset+z[r·ncol+c]·scale`. O(1) node access; holes where `z===z_null`.

**Lighter 3D gridding (`rebuild`)** — render-time LOD: `st = max(1, floor(max(ncol,nrow)/180))` → **cap the mesh at ~180×180 nodes** regardless of source resolution; indexed `BufferGeometry`, skip null nodes (holes), vertex colors from colormap, `computeVertexNormals`, `MeshLambertMaterial DoubleSide`, vertical exaggeration `vex`, contours as `LineSegments`, wells/markers **batched/instanced**. (Decimation changes *display density only*, never the authoritative grid — keep the GVSURF as the source of truth for calculations.)

**Where it plugs in:** a build-time script (like our `build-workbench-data.mjs`) runs `evToGVSURF` on EarthVision exports → gitignored `public/wb/*.gvsurf.json`; a runtime `decodeSurface` in `src/engine/gvsurf.ts` feeds the 2D viewer and the 3D cube. Our existing `engine/grid.ts` (bilinear) + `contour.ts` (d3-contour) + `Map3D`/`GridCube3D` (r3f) are the consumers — GVSURF just makes the *input* tiny.

## 7 · Reuse vs build
| Need | Reuse (built) | New |
|---|---|---|
| 11 engines behind the tabs | Grid Model, Sim, Volumetrics, Uncertainty, Forecast, Review, Logs, Correlation, XSection, Map3D | — |
| Contours / grid sampling | `engine/contour.ts`, `grid.ts` | — |
| Closure polygon | `engine/closure.ts` | — |
| 3D scene patterns | `Map3D.tsx`, `GridCube3D.tsx` | — |
| **Explorer tree (11 folders + eye/⋯/drag)** | — | `FieldDevExplorer.tsx` |
| **State-of-the-art 2D WebGL map** | PixiJS lessons | `MapGL.tsx` |
| **GVSURF decode + build** | build-script pattern | `engine/gvsurf.ts` + `scripts/build-gvsurf.mjs` |
| **Icon top-nav + canvas toolbar + overlays (COSMO)** | ContextBar | re-skin |

## 8 · Roadmap (G-series, on top of the COSMO U-series)
| Phase | Ships |
|---|---|
| **G0 · GVSURF pipeline** | `engine/gvsurf.ts` (decode) + `scripts/build-gvsurf.mjs` (EarthVision→GVSURF) + truth-lock (round-trip depth within `z_scale`; affine reconstructs coords; null holes preserved) |
| **G1 · Field Dev 3-zone shell** | `FieldDevExplorer` (11 folders, eye/⋯/+/drag) · center canvas w/ COSMO icon tabs + centered toolbar + overlays · inspector — all on COSMO tokens |
| **G2 · State-of-the-art 2D MapGL** | WebGL surface fill + hillshade + contours + wells/polygons/section; draw tools wired to explorer; colormap legend |
| **G3 · Selection/visibility/context binding** | explorer↔canvas↔inspector shared events; per-layer eye; active-object inspector |
| **G4 · Tab re-label + icons** | the 11 tabs mapped to engines with Lucide icons, COSMO `.tab` |
| **G5 · 3D on GVSURF** | Map3D/GridCube3D consume decoded GVSURF + LOD-180² gridding |

**First cut G0 → G2:** the GVSURF pipeline (tiny data) + the 3-zone Petrel shell + the fancy 2D map — this is the visible, high-value core of all three priorities. Truth-lock G0 (data integrity) before wiring viewers.

## 9 · Guardrails
- COSMO is the **design authority** (teal, tokens, components) — GeaVision gives *layout + logic + data pipeline*, not the blue skin.
- GVSURF decimation is **display-only**; the authoritative grid stays the calculation source (scientific-integrity rule).
- Self-host pako/three; no CDN (CSP/offline).
- UI/data-shape work must **not touch engine numerics** — the 158-assertion truth-lock stays green.
