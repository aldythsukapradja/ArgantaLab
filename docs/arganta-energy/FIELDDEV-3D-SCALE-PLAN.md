---
title: Field Development 3D — Scale to Millions (surfaces + grids)
status: way-forward plan (build)
asset: Volve (v1) · scalable to any field
grounded_in:
  - apps/energy current viewers (Map3D · GridCube3D · GridModelView · Crossplot3D)
  - src/engine/gvsurf.ts (surface compression — built, NOT yet wired to viewers)
  - GeaVision-DataLayer-v12 (BufferGeometry + GPU Points reference)
  - GEAVISION-GO-FORWARD-SPEC-for-Opus.md
---

# Field Development 3D — Way Forward to Millions of Datapoints

Goal: render **millions of nodes** — both **surfaces** (regular Z-grids) and **3D property grids**
(nx·ny·nz cells) — at 60 fps in the browser, with a **pipeline that converts Petrel/Eclipse
grids into a compact, LOD-tiled, web-friendly format**. Grounded in what we already have.

---

## 1. Lessons learnt from GeaVision (the 3D render)

1. **One draw call, not N.** GeaVision renders large data as a **single `BufferGeometry`**
   (GPU `Points` with `gl_PointSize`, or one merged/indexed mesh) — never one mesh per cell.
   *Our Map3D already does this for surfaces; our **GridCube3D does not** (it uses
   `InstancedMesh` boxes, which dies ~100k cells).*
2. **Regular-grid geometry is the superpower.** On a regular (nx,ny) lattice, X/Y are
   **implied by an affine** — you only store/transmit **Z (1 number/node)**, not 3. This is
   what makes millions tractable. *This is exactly the `GVSURF` affine we built.*
3. **Separate the data pipeline from the render.** Compress hard at **ingest** (affine +
   Int16 quantise + gzip → ~28× on surfaces), decode **O(1)**, keep bytes tiny over the wire.
   *`gvsurf.ts` exists but is **not wired into the viewers yet** — that's step G1.*
4. **Property as a texture, not geometry.** Encode depth/φ/Sw/pressure into a `DataTexture`
   and sample in the shader. Geometry stays fixed; **recoloring/palette-swap is free** (no
   rebuild). The go-forward spec's palette selector + 2D/3D toggle rely on this.
5. **LOD at render.** Decimate by stride for overview/far; full-res on zoom. **Cap mesh
   vertex count**; swap LOD on camera distance. Never triangulate a million nodes for a
   thumbnail.
6. **Build geometry off the main thread.** Decode + triangulate + normals in a **Web Worker**,
   transfer `ArrayBuffer`s (zero-copy). *We have **no workers** today — every build blocks the
   UI. This is the single biggest scaling fix.*
7. **You never see interior cells.** For a 3D grid, render only the **exterior shell +
   active slice planes**, not every voxel — turning millions of cells into O(nx·ny + ny·nz +
   nx·nz) faces. (Alternative: GPU point-cloud of cell centres.)
8. **Graceful fallback + cache.** WebGL→canvas fallback if blocked; **IndexedDB cache** of
   decoded buffers so a re-open is instant (per the go-forward spec).

---

## 2. Current state (what we have) — honest assessment

| Piece | Today | Ceiling |
|---|---|---|
| **Surfaces** (`Map3D`) | single indexed `BufferGeometry`, `computeVertexNormals` — **good primitive** | main-thread, **full-res, no LOD, no worker**; surfaces are coarse (16k–27k nodes, 50 m cell) |
| **Surface pipeline** (`gvsurf.ts`) | affine + Int16 + gzip + base64, O(1) decode, ~28× — **built** | **NOT wired into viewers**; no render-time LOD/skirts |
| **3D grid** (`GridCube3D`) | `InstancedMesh` box-per-cell + scissor slices | **dies ~100k cells**; no millions |
| **Grid model** (`grid.ts`) | regular `{nx,ny,x0,y0,cell,z[]}` (2.5D surfaces only) | **no true 3D (nz) grid format** yet |
| **Threading** | none | every decode/build blocks the main thread |
| **Stack** | R3F + three + drei (installed) | fine — keep it |

**Verdict:** the surface path has the right shape but needs the pipeline wired + a worker +
LOD; the 3D-grid path needs a **new format + a new render strategy** (shell/slices or points).

---

## 3. The pipeline — Petrel/Eclipse grid → web-friendly (the missing spine)

A single **ingest → GRID3D → serve → worker-decode → render** pipeline, mirroring GVSURF but
for 3D.

```
Petrel / Eclipse export                build step (Node, offline)                served (static)
─────────────────────────   ───────────────────────────────────────────   ──────────────────────
· surfaces: EarthVision ASCII  →  gvsurf (affine+Int16+gzip)              →  public/wb/surf-*.gvs
· 3D grid: GRDECL / RESQML /   →  GRID3D encoder:                          →  public/wb/grid-<f>/
  ECLIPSE (COORD/ZCORN + props)      · dims nx·ny·nz                            manifest.json
                                     · geometry: pillar affine + per-k         L0.bin L1.bin L2.bin
                                       Z-surfaces (reuse gvsurf per layer)      prop-<name>.bin
                                     · properties → per-prop Int8/Int16
                                       (min/max normalised) + gzip
                                     · LOD pyramid (stride 1,2,4,8)
                                     · optional spatial tiles for huge grids
```

**GRID3D format (new — `engine/grid3d.ts` + `scripts/build-grid3d.mjs`):**
- `manifest.json`: `{nx,ny,nz, affine, zUnits, props:[{name,min,max,dtype}], lods:[{stride,bytes}], tiles?}`.
- Geometry: **corner-point via pillar affine + nz Z-surfaces** (each a GVSURF layer) — reconstructs cell corners on GPU/worker without shipping XYZ per cell.
- Properties: one `.bin` per property, **Int8 (256 levels) or Int16**, min/max in manifest → shader/worker dequantises. gzip on the wire.
- LOD: precomputed strides; the viewer picks a level from camera distance + a vertex budget.
- **Never fabricate:** missing cells → mask sentinel (like GVSURF `NULLV`); absent property → "not in dataset".

**Budget math (why this works):** a 200·200·50 = **2 M-cell** grid → geometry is nz=50 GVSURF
surfaces (~each 40k Z, ~Int16) ≈ a few MB gzipped; one Int8 property ≈ 2 MB → ~1 MB gzipped.
Render only the **shell + 3 slices** ≈ ~120k faces (one BufferGeometry) → 60 fps. The full 2 M
cells never hit the GPU as geometry.

---

## 4. Render architecture (the viewer side)

- **Surfaces:** worker decodes GVSURF → transfers `position`/`normal`/`prop` `ArrayBuffer`s →
  one indexed `BufferGeometry`; **skirts** (drape edges) to hide gaps; **property in a
  `DataTexture`** so palette/attribute swaps don't rebuild; **LOD stride** by distance.
- **3D grid:** two interchangeable renderers behind one component —
  - **`ShellSlice`** (default): a single `BufferGeometry` of exterior faces + the active
    I/J/K slice planes, colored from the property `DataTexture`; scissor/clip for cutaways.
  - **`PointCloud`** (dense/overview): cell centres as GPU `Points` (`gl_PointSize`), one draw
    call — millions of points fine; great for "show everything, colour by φ".
- **Interactions (no rebuild):** GPU **color-id picking** for hover/select at millions scale;
  palette + attribute + Z-exag as **uniforms/textures**; 2D↔3D toggle shares the palette.
- **Resilience:** WebGL-context-loss handler; **canvas fallback**; **IndexedDB cache** of
  decoded buffers keyed by `{field,grid,lod}`; memory guard (dispose on unmount, cap live LOD).

---

## 5. Build plan (phased · each with a validation gate)

| Phase | Deliverable | Gate |
|---|---|---|
| **G0 · Bench** | Instrument Map3D/GridCube3D — measure vertex count, build ms, FPS; a synthetic 1 M-node surface + 1 M-cell grid harness | numbers on the table; know the real ceiling |
| **G1 · Surface at scale** | Wire `gvsurf` into a **worker** → single BufferGeometry + skirts + **LOD stride** + property `DataTexture` | 1 M-node surface loads < 500 ms, pans at 60 fps, no main-thread jank |
| **G2 · GRID3D format** | `scripts/build-grid3d.mjs` (GRDECL/RESQML/ASCII → manifest + LOD `.bin`) + `engine/grid3d.ts` decoder + tests | round-trip a real grid; coverage/quantise error bounded; manifest validates |
| **G3 · Grid render** | `ShellSlice` renderer (shell + slices, one BufferGeometry, property texture, clip slicing) | 2 M-cell grid renders < 1 s, slices interactively at 60 fps |
| **G4 · Point-cloud + LOD swap** | `PointCloud` renderer (GPU points) + camera-distance LOD swap + budget cap | 5 M points colour-by-property at 60 fps; smooth LOD transitions |
| **G5 · Streaming + cache** | lazy tile/LOD fetch + Worker pool + IndexedDB cache | re-open instant; huge grid streams without stalling |
| **G6 · Interactivity** | GPU color-id picking (hover/select), palette/attribute/Z-exag uniforms, 2D↔3D | pick a cell in a 2 M grid < 16 ms; recolour with zero rebuild |
| **G7 · Fallback + polish** | WebGL-loss/canvas fallback, reduced-motion, memory guards, provenance footnotes | passes on a low-end GPU; no leaks over 10 min |

**Method each phase:** measure before/after (FPS + build ms + bytes), keep the truth-lock
tests green, verify on the real Volve data first, then the synthetic million-scale harness.

---

## 6. Way forward (recommended sequence)

1. **G0 + G1 first** — the highest-leverage, lowest-risk win: move surface build into a Worker,
   wire the **already-built GVSURF pipeline** into Map3D, add LOD + a property texture. This
   alone unblocks million-node **surfaces** and removes main-thread jank — mostly plumbing we
   already have.
2. **G2 + G3** — stand up the **GRID3D format + ShellSlice renderer**: the real unlock for
   million-**cell** 3D grids. Replace `GridCube3D`'s InstancedMesh.
3. **G4–G7** — point-cloud LOD, streaming/cache, GPU picking, fallback: production hardening.

**Net:** one compression-first data pipeline (GVSURF for surfaces, GRID3D for grids), one
worker-decode seam, and two GPU-scale renderers (surface mesh + shell/point grid) — the app
handles millions on commodity hardware, and any new field flows through the same pipeline.

> Concept/plan only — no build yet. On approval, start G0+G1 (surface worker + GVSURF wire-in),
> since it reuses the most existing code and de-risks the rest.

---

## 7. Library selection — the optimum stack (decision)

Evaluated against our five real needs. **Verdict: keep three.js / R3F as the core, add custom
GLSL + a Worker + a texture-based property/fluid path.** (three.js/R3F/drei already installed.)

| Need | three.js / R3F (core) | VTK.js | deck.gl |
|---|---|---|---|
| Surfaces (M nodes) | BufferGeometry / Points — have it | ok | TerrainLayer ok |
| 3D grid (M cells) | shell+slices / GPU Points — ✅ | native cell data | columns/points |
| Volumetric fluid | Data3DTexture + ray-march shader — ✅ | native volume ✅✅ | ✗ |
| X-section (cut) | clippingPlanes (built-in) + section quad — ✅ | native cutting ✅✅ | weak |
| Time animation (fluid) | upload Sw(t)→Data3DTexture, shader lerp — ✅ | possible | possible |
| Bundle / theming / R3F fit | smallest, installed, themeable ✅ | MBs, own scene graph | geospatial-2.5D |

**Chosen stack:** `three` + `@react-three/fiber` + `@react-three/drei` (OrbitControls); **custom
GLSL** for property color / volume ray-march / section sampling / temporal lerp;
**`THREE.Data3DTexture`** (WebGL2) for the property+fluid volume; **`material.clippingPlanes`**
(built-in) for the X-section cut; a **Web Worker** to decode+build off-thread; **compression** =
`gvsurf.ts` (surfaces) + a new packed Int8 volume (per-frame Sw, delta+gzip via `fflate`).
**Optional later:** KTX2/basis (textures), meshoptimizer/draco (meshes), three `WebGPURenderer`+TSL
(compute fluid). **Not chosen:** VTK.js (reserve for an optional scientific/volume power-mode —
too heavy/opinionated as the core), deck.gl (only if we go massive map-tiled multi-field clouds),
raw regl/WebGPU (only if three.js hits a wall).

## 8. Static Model tab — complete implementation (compression → visualization)

The tab already builds a real `GridModel` (nz layers · SIS facies · SGS φ · perm — `grid3d.ts`
+ `geostat.ts`). This pipeline replaces the InstancedMesh box render with a GPU-scale one,
reusing that model:

- `engine/pack3d.ts` — `packGrid3D(model,{props,lod})` → geometry as **pillar affine + nz
  Z-surfaces** (reuse `gvsurf` per layer) + properties as **Int8** (min/max normalised) + active
  mask + LOD strides — all typed arrays (transferable). Pure + unit-tested (round-trip HCPV must
  match `grid3d.ts`).
- `workers/grid.worker.ts` — builds the **shell + I/J/K slice `BufferGeometry`** (positions from
  the affine + Z-surfaces) and the property **`Data3DTexture`** bytes; transfers the ArrayBuffers.
- `tabs/fielddev/GridVolume.tsx` (R3F) — replaces `GridCube3D`: one BufferGeometry + a
  `ShaderMaterial` sampling the property texture through the `colormap.ts` palette; `clippingPlanes`
  for the X-section slider; Z-exag; **GPU color-id picking** for hover/select. The 2D layer map
  stays and shares the same palette+property.
- Segmented **2D layer · 3D volume · X-section**, all reading one packed grid+property+palette —
  recolour/attribute/timestep = a texture swap, **never a rebuild**.

**Why it scales:** shell+slice = O(nx·ny+ny·nz+nx·nz) faces (~100k for a 2 M-cell grid), one draw
call; the property lives in a texture → **millions of cells are colour, not geometry**.

## 9. Simulation tab — fluid movement in 2D · 3D · X-section (the goal)

`engine/sim/fv.ts` already produces the time-varying **Sw(cell, t)**; `SimulationView` animates it
on 2D canvas. We lift that field into one shared source driving all three views:

- `engine/pack-sim.ts` — `packSimFrames(frames)` → per-timestep Sw as **Int8**, **delta-encoded
  vs the previous frame** (fluid changes slowly → deltas gzip small) + manifest `{nt,dt,dims,min,max}`.
- GPU: keep **two `Data3DTexture`s** (t and t+1); the shader **lerps** by sub-frame fraction →
  smooth playback even at coarse dt. Advancing time = upload the next Int8 delta (cheap).
- One `SimField` context feeds three views in lockstep: **2D** areal map (keep, + streamlines);
  **3D** `<GridVolume>` bound to the Sw texture (front sweeps the reservoir volume; oil amber →
  water blue; optional volume ray-march); **X-section** a vertical section quad along the
  injector→producer line sampling the same texture (front advancing in cross-section) + a
  `clippingPlane` cut in 3D. One play/pause/scrub/speed timeline drives all three + PVI/recovery.
- **Result:** press play → the waterflood front moves through 2D map, 3D volume, and cross-section
  simultaneously, from one deterministic, mass-conservative sim — no fabricated animation.

## 10. Updated build plan (folds in temporal + 3 views)

`G0` bench → `G1` surface worker+GVSURF → **`G2` pack3d + worker** → **`G3` GridVolume (Static
Model 2D/3D/X-section)** → **`G4` pack-sim + SimField (Int8 delta frames, two-texture lerp)** →
**`G5` fluid movement (Sim 2D/3D/X-section, one timeline)** → `G6` volume ray-march polish →
`G7` streaming + IndexedDB cache + WebGL-loss fallback + memory guards. Truth-lock (HCPV, mass
conservation, Buckley-Leverett) stays green throughout.

## 11. Which LLM to build this with

- **Opus 4.8 — the hard core.** GLSL shaders (volume ray-march, section sampling, temporal lerp),
  the pack/compression formats, the Worker/GPU seam, 3D math, sim-physics correctness. Use for
  **G0–G5 design + all shader/pipeline code** — novel, correctness-critical work.
- **Sonnet — the mechanical shell.** Timeline scrubber, palette/attribute pickers, tab wiring,
  tests, pattern-porting once Opus set the architecture. Cheaper + fast for G5/G7 UI and G6 iteration.
- **Rule:** Opus writes the shader/pipeline/GPU core + the format specs; Sonnet wires the UI and
  tests around them. (The *in-app* assistant is separate — it runs on Arganta's own tier ladder.)
