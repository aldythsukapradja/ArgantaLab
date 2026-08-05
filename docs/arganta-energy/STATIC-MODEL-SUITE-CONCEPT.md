# The Static Model Tab + GeaVision Studio — Concept & Strategy

2026-08-05 · Opus. The `static-model-lite` stage of the Field Development suite: **structure → zones → layers → grid → upscale → facies (SIS) → properties (SGS) → contacts → volumetrics**. A Petrel workflow, on one high-performance viewport built to survive millions of cells.

Sibling: [PETROPHYSICS-SUITE-CONCEPT](PETROPHYSICS-SUITE-CONCEPT.md) — this tab consumes its output, and only its output. Reads from the workspace ([one source](FIELD-DEVELOPMENT-SUITE-CONCEPT.md)).

---

## Part 0 · Diagnosis — we are not starting from zero

Nearly every engine this workflow needs already exists in `src/engine/`, pure and truth-locked. The work is **assembly and rendering**, not algorithms.

| Need | Exists | File |
|---|---|---|
| Surface codec (int16 + gzip) | `evToGVSURF` · `decodeSurface` | `gvsurf.ts` |
| 3D grid build | `GridSpec` → `buildGrid` → `GridModel` | `grid3d.ts` |
| **Compression for rendering** | `packGrid3D` → **`PackedGrid3D`** (u8/u16 props, `stride` LOD, `bytes`) | `pack3d.ts` |
| Mesh generation | `buildShell` · `buildSection` | `gridmesh.ts` |
| Variogram · kriging · nscore | `variogram` · `simpleKrige` · `ordinaryKrige` · `buildNscore` | `geostat.ts` |
| **SGS** (porosity) | `sgs(cond, targets, vario, seed)` | `geostat.ts` |
| **SIS** (facies, 2-class) | `sis(cond, targets, vario, seed, globalP)` | `geostat.ts` |
| **Log upscaling** | `upscaleWell` · `upscaleMean` · `netFraction` · `majority` | `upscale.ts` |
| **φ→k transform** | `phiToK(phi, a, b)` · `permKv` · `fitPhiK` | `perm.ts` |
| Contacts / closure | `contactPolygon` | `closure.ts` |
| **Volumetrics** | `grvClosure` · `grvPolygon` · `stoiip` · `giip` | `volumetrics.ts` |

`PackedGrid3D` already carries `stride` for areal LOD and `bytes` for a budget readout — the "millions of cells" problem was anticipated when it was written.

**The three real gaps:**

1. **No zone/layer model.** `buildGrid` makes a box between two surfaces. Petrel's spine is *horizons → zones → layering scheme → layers*, and nothing expresses it.
2. **No viewport that scales.** The Legacy `GridCube3D` draws cells as objects. That dies in the tens of thousands. Nothing in the codebase renders a million cells.
3. **SIS is 2-facies and SGS is 2D.** Both need to run per-layer over a 3D grid, in a Worker, conditioned to upscaled logs.

---

## Part 1 · The workflow — six sub-tabs, one viewport

```
Static Model   [ Structure │ Grid │ Upscale │ Facies │ Properties │ Volumes ]     ⚙ Model rail
               └────────────────── GeaVision Studio (2D · 3D · Section) ──────────────────┘
```

The **viewport is persistent**, exactly as the Parameters rail is in Petrophysics. Every sub-tab is a different set of *controls over the same scene*, because building a model is one continuous act of looking at one object.

### 1.1 Structure — horizons → zones

| Step | What it is |
|---|---|
| **Horizons** | The ingested depth grids, ordered stratigraphically. Order is not alphabetical and not guessable — it comes from `horizon-order.ts` and the pick order in the workspace. |
| **Zones** | The interval between two consecutive horizons. A zone is the unit everything downstream is keyed to: layering, facies proportions, φ/k populations, volumetrics. |
| **Isochore QC** | Zone thickness map. Negative thickness = crossing horizons = a structural error, and it must be shown as a defect rather than clipped to zero. |
| **Contacts** | OWC/GOC/GWC per zone or per region. From the workspace's `contacts` where the delivery declares them (Volve: OWC 3200 m TVDSS, `interpreted`, from the Eclipse EQUIL deck), user-editable, always badged. |

### 1.2 Grid — layering

The pillar grid. v1 is **unfaulted and vertical-pillar** — honest about it, because a faulted corner-point grid is a different (large) project and pretending otherwise would poison every volume downstream.

Per zone, a layering scheme:

| Scheme | Use |
|---|---|
| **Proportional** (N layers) | the default — layers follow both bounding surfaces |
| **Top-conform** (fixed Δz from top) | onlap geometry |
| **Base-conform** (fixed Δz from base) | truncation geometry |
| **Fraction** | user-specified proportions per layer |

Output is the geometry half of `GridModel`, plus a **cell budget readout** (nx × ny × nz, bytes packed) that updates before you commit — you should find out you asked for 40 million cells *before* you wait for it.

### 1.3 Upscale — logs → cells

**Only three properties are upscaled, and each by the right average:**

| Property | Averaging | Why |
|---|---|---|
| **Facies** | `majority` (mode) | a facies is a label; a mean facies is meaningless |
| **Porosity φe** | arithmetic (`upscaleMean`) | φ is a volume fraction — volume-weighted arithmetic is exact |
| **Permeability k** | **geometric by default**, arithmetic and harmonic offered | k is not additive. Arithmetic over-states a layered system, harmonic under-states it; geometric is the standard screening compromise, and the choice must be explicit rather than defaulted invisibly |

Input is **ArgantaEnergy's own petrophysics result** — `runPetro` under the current parameter set, never the delivery's interpreted curves. That rule is enforced at the seam (`forwardStats` in `petro-field.ts`) and restated here because this is where it would be easiest to break.

The panel shows **raw vs upscaled** side by side per cell, because the whole risk of upscaling is losing the thing you cared about.

### 1.4 Facies — SIS

Sequential indicator simulation per zone, conditioned to the upscaled facies cells.

- Variogram per zone (range, sill, nugget, anisotropy azimuth/ratio)
- Target global proportion, defaulting to the conditioning proportion
- Seed → reproducible; N realizations
- Runs in a **Worker**, streaming layer by layer

v1 is 2-facies (sand/shale) because `geostat.sis` is 2-facies and truth-locked. Multi-facies is a real extension, listed, not faked.

### 1.5 Properties — SGS + the k transform

- **φ by SGS**, per zone, **per facies** (a sand φ population and a shale φ population are different distributions — simulating them together is the classic mistake)
- Normal-score transform in, back-transform out (`buildNscore`/`backNscore`)
- **k from φ** by `phiToK(φ, a, b)`, with `a`/`b` **fitted from data** via `fitPhiK` where core or a reference well exists, and clearly `analog` where they are not
- `kv/kh` ratio per facies

**This is the seam back into Petrophysics.** The φ–k transform belongs in the petrophysics tab as a crossplot you fit (log k vs φ, with the fitted line and its R²) — it is a petrophysical relationship, not a modelling choice. The static model *consumes* the fitted `{a, b}`. That means **one addition to the Petrophysics tab: a `PERM` track and a φ–k transform panel**, feeding `perm.fitPhiK`.

### 1.6 Volumes

`grvClosure` / `grvPolygon` → `stoiip` / `giip`, per zone × region, with the contact from §1.1.

Two numbers side by side, always:
- **Grid-based** — sum of cell HCPV (`hcpvFromPacked`)
- **Map-based** — GRV × N:G × φ × (1−Sw) / Bo

They should agree. When they do not, that difference is a QC finding about the grid, and it is displayed rather than resolved silently.

---

## Part 2 · GeaVision Studio — the viewport strategy

The hard requirement: **millions of cells, interactive, in a browser tab that also holds a log bench.** That rules out the obvious approaches. Here is the strategy, in the order it matters.

### 2.1 Never render cells — render the SHELL

A 300 × 300 × 120 grid is **10.8 million cells**. But you cannot see inside a solid. The visible surface is:

```
2·(300·300) + 2·(300·120) + 2·(300·120)  =  180,000 + 72,000 + 72,000  =  324k faces
```

**3% of the cell count**, and it does not grow with nz the way volume does. `gridmesh.buildShell` already does exactly this; `buildSection` gives the same treatment to a slice. Filters and slices rebuild the shell of the *visible subset*, so a cutoff that hides 90% of cells makes the mesh smaller, not larger.

### 2.2 Geometry static, property dynamic — a 3D texture

The naive approach re-uploads vertex colours whenever you switch φ → Sw → facies. At 324k faces that is a stall every time.

Instead:
- **Position/normal buffers are built once** and never touched
- Each vertex carries its **cell index** (one `uint32` attribute)
- The property lives in a **`R8`/`R16` 3D texture** — which is literally what `PackedProp.data` already is: a `Uint8Array`/`Uint16Array` of normalised values
- The fragment shader reads the cell's value, maps it through a **1D colormap texture**, and discards below the cutoff

Consequences, all of which matter:

| Action | Cost |
|---|---|
| Switch property | one texture upload (~10 MB for u8 at 10M cells) |
| Change colormap | **zero** — swap a 256-px 1D texture |
| Change colour range | **zero** — a uniform |
| Move a cutoff filter | **zero** — a uniform, `discard` in the shader |
| Rotate / zoom | **zero** — geometry untouched |

The packed grid is not merely a storage format here; **it is the GPU upload format**. `pack3d.ts` was written for transfer and turns out to be exactly right for texturing.

### 2.3 The memory budget, stated out loud

At 10 million cells:

| | Bytes/cell | Total |
|---|---|---|
| Naive `Float64` per property × 5 | 320 | **3.2 GB** — impossible |
| `Float32` × 5 | 160 | 1.6 GB — still impossible |
| **`PackedGrid3D`** (u16 φ/Sw/NTG, u8 facies/k) | **8** | **80 MB** — fine |

Plus per-column `topZ`/`baseZ` Float32 (8 bytes × 90k columns = 0.7 MB) and the shell mesh (~324k faces ≈ 20 MB interleaved). **~100 MB total.** That is the whole argument for the packed representation, and the HUD shows it live.

### 2.4 LOD, and being honest about it

`PackedGrid3D.stride` already provides areal decimation. Policy:

- **Orbiting/dragging** → stride chosen so the shell stays under a face budget (~400k)
- **On idle (150 ms)** → full resolution
- The HUD **always shows the current stride**, because a decimated view that looks like the model is how someone ends up quoting a number off a picture that was never the model

### 2.5 Workers, and never blocking the UI

| Job | Where |
|---|---|
| `buildGrid` | Worker → transfer `GridModel` |
| `packGrid3D` | Worker → transfer typed arrays (zero-copy) |
| `buildShell` / `buildSection` | Worker → transfer mesh buffers |
| `sis` / `sgs` | Worker, **per layer**, streaming progress |

Everything crosses the boundary as `ArrayBuffer` transfers, so nothing is copied. A 10M-cell SGS run reports layer-by-layer progress and is cancellable — a modelling run you cannot cancel is a modelling run you only start once.

### 2.6 The HUD — FPS and the honest counters

Permanently visible, top-right of the viewport:

```
 58 fps   │  10.8 M cells  │  324 k faces  │  82 MB packed  │  stride 1  │  φe · viridis
```

FPS from a rolling `requestAnimationFrame` mean. It is not decoration: it is the number that tells you whether the last thing you did was affordable, and it is the difference between a viewport and a demo.

### 2.7 Renderer choice

**Three.js + a custom `ShaderMaterial`**, on `WebGL2` (already a dependency — Legacy `GridCube3D`/`Map3D` use it).

Not deck.gl: deck.gl is superb for geospatial point/polygon layers (and stays for the map), but a corner-point grid with 3D-texture property lookup and shader-side cutoffs wants a hand-written shader.
Not WebGPU: not yet universally available, and the WebGL2 path above is sufficient for 10M cells. The renderer sits behind an interface so a WebGPU backend is a swap, not a rewrite.

---

## Part 3 · Build order

| Step | Deliverable | Test |
|---|---|---|
| **S1** | `zone-model.ts` — horizons → zones → layering schemes → `GridSpec`. Pure. | `test-zone-model.mjs` |
| **S2** | **GeaVision Studio viewport shell** — Three.js canvas, orbit, shell mesh from `packGrid3D`+`buildShell`, 3D-texture property lookup, colormap, cutoff, HUD/FPS | live + a synthetic 10M-cell bench |
| **S3** | Grid builder panel — layering controls, live cell-budget readout, Worker build | live |
| **S4** | `upscale-grid.ts` — logs → cells, facies/φ/k with explicit averaging. Pure. | `test-upscale-grid.mjs` |
| **S5** | Petrophysics: **PERM track + φ–k transform panel** (`fitPhiK`), feeding S4 | extend `test-petro-compute.mjs` |
| **S6** | Facies SIS per zone, in a Worker, N realizations | `test-sis-grid.mjs` |
| **S7** | Property SGS per zone × facies + k from the fitted transform | `test-sgs-grid.mjs` |
| **S8** | Contacts + closure per zone | `test-closure-zone.mjs` |
| **S9** | Volumetrics — grid-based vs map-based, side by side | `test-volumes.mjs` |

**S1 and S2 first, and S2 is the risky one** — if the viewport cannot hold 10M cells at an interactive frame rate, every panel above it is built on sand. So S2 gets a synthetic 10M-cell benchmark before any real grid is wired to it.

---

## Part 4 · Rules this tab does not break

1. **One source.** Surfaces, wells, picks, contacts all come from `getWorkspace(fieldId)`.
2. **Ours, forward.** The static model consumes ArgantaEnergy's petrophysics — never the delivery's interpreted curves. Those remain QC.
3. **The grid is unfaulted, and says so.** Every volume it produces carries that caveat.
4. **A decimated view is labelled.** Stride is always on the HUD.
5. **A number that came from a simulation names its seed and realization.** A P50 from one unnamed realization is not a P50.
6. **Grid volumes and map volumes are both shown.** Their disagreement is a finding, not a rounding error to hide.
