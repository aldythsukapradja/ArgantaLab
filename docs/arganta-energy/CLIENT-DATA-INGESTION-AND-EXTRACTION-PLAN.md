# Client Data Ingestion — Action Plan

2026-08-03 · Opus (rev. 2: simplified to a table plan · LAS-only · Volve as golden master · Data QC is shared across all lifecycles).

**Goal:** a user drops their own data into any lifecycle tab, and it becomes contextualised ArgantaEnergy knowledge.

---

## 1 · The pipeline

```
RAW  →  DIGESTED  →  COMPRESSED  →  LINKED  →  OSDU  →  MASTER ARGANTAENERGY
```

| # | Stage | What happens | Where it lands |
|---|---|---|---|
| 1 | **Raw** | User drops files. Hash, inventory, never mutate. | Blob + `IngestedAsset` |
| 2 | **Digested** | Deterministic parse in a Worker → typed structures. | curves · grids · blocks |
| 3 | **Compressed** | Quantise + gzip for web delivery (GVSURF for grids, WebP for figures). | IndexedDB blobs |
| 4 | **Linked** | Extraction ties documents/figures to entities → vault notes + claims. | `VaultNote` · `Claim` |
| 5 | **OSDU** | Emit governed records via existing `osdu/adapter.ts` + `governanceFor()`. | `arganta:*` manifest |

**Master ArgantaEnergy** = stage 5. Today's OSDU spine holds 17,302 records across 5 lanes (GOGET · North Sea · ANP · USGS · Volve). Client data becomes lane 6 — same envelope, same ACL/legal, same id minting. Nothing new invented.

---

## 2 · Data QC is shared, not Field Development's

Data QC is **the user-generated data interface for the whole platform** — one module, mounted by every lifecycle tab.

| | |
|---|---|
| Lives in | `src/dataqc/` (sibling of `workspace-blueprint/`, same shared-module pattern) |
| Mounted by | Exploration · Field Development · Well Delivery · Reservoir Mgmt · Drilling |
| Scoped by | `fieldId` + `vertical` — never Volve-hardcoded |
| Gate applies when | the case has user-uploaded data (`dataMode: 'client'`) |
| Gate never applies to | reference/breadth cases (any of 7,787 catalogue fields), and **Exploration** (0 of its 27 widgets are `client-gated`) |

The gate is enforcement of `WidgetDisposition = 'client-gated'`, which the blueprint already declares and currently ignores. Per-vertical counts: FD 5/27 · Well Delivery 8/27 · Reservoir 11/27 · Drilling 11/27 · **Exploration 0/27**.

---

## 3 · Volve is the golden master

**Why it proves the pipeline:** we already have the known-good *output* of this exact transform, with hard published numbers. Run raw Volve through the new pipeline; assert the result matches. If Volve reproduces, any client delivery digests.

| Assertion | Expected (from `public/wb/index.json`) |
|---|---|
| Wells | 24 |
| Surfaces | 6 (hugin_top · hugin_base · bcu · ty_top · shetland_top · seabed) |
| CRS / datum | `ED50 / UTM 31N` · `TVDSS (m)` |
| Contact | OWC 3200 m TVDSS |
| GRV / STOIIP | 1292 Mm³ · 142.3 MMSm³ (screening upper bound) |
| Cumulative oil | 10.04 MMSm³ |
| Grid cells | 9320 · crest 2725.7 m |

⚠ **Prerequisite P0 — raw Volve is not in the repo.** `build-workbench-data.mjs` reads `data-energy/raw/Geophysical_Interpretations/Horizons/Horizons_DEPTH/*.dat` and `data-energy/processed/{trajectory,log-samples}`, but `data-energy/raw/` currently holds only `anp` and `goget`. The raw set must be available locally before S2 can be tested. The `.dat` horizons are EarthVision-style XYZ point clouds — a Tier-1 format, and `build-workbench-data.mjs` is a working reference parser for them.

---

## 4 · Action plan — easy first

| S | Step | Does | Volve test | Effort | Depends |
|---|---|---|---|---|---|
| **S1** | **Shared shell** | `src/dataqc/` module: drop zone, file inventory, hash, per-vertical mount. No parsing. | Mounts in all 5 tabs; drop any file, see it listed | S | — |
| **S2** | **LAS 2.0** | Parse `~V/~W/~C/~P/~A` in a Worker → curves + header. Render with `@equinor/videx-wellog` (already a dep). | Volve LAS curves match `public/wb/logs-*.json` | M | S1, P0 |
| **S3** | **Storage** | IndexedDB (`idb`): raw blob + digested cache + `IngestedAsset` index. Survives reload. | 50 MB LAS persists, no UI freeze | M | S2 |
| **S4** | **Surfaces** | Port GVSURF codec → `engine/gvsurf.ts` (use `fflate`). Parse EarthVision `.dat` · IRAP ASCII · ZMAP+ · CPS-3 · XYZ+attrs. Scattered XYZ gridded via existing `engine/geostat.ts`. | 6 Volve horizons re-grid to match `public/wb/surface-*.json` | L | S3 |
| **S5** | **QC + gate** | Deterministic rules → typed exceptions. `qcStatus(fieldId, vertical)`. Blocks `client-gated` widgets only. | Volve passes clean; a deliberately mis-CRS'd copy blocks | M | S4 |
| **S6** | **Documents** | Mount existing `tabs/knowledge/Extraction.tsx` into Intelligence → Knowledge as 3rd tab. Rewire off orphaned `store.ts`. Mirror gate-card in Data QC. | Volve reports → vault notes with sha256 evidence | M | S3 |
| **S7** | **Figures** | Caption-anchored crop in Worker → WebP blob + `page`/`box` provenance. Add the `image` branch `extractDoc()` currently rejects. Contract M3 → v1.1.0. | Figures from a Volve PDF carry page + pixel box | M | S6 |
| **S8** | **OSDU emit** | `IngestedAsset` → OSDU records via existing `osdu/adapter.ts`, `kinds.ts`, `governanceFor()`. Client lane 6. | Volve ingest reproduces its 105-record manifest | M | S5, S7 |
| **S9** | **Intelligence** | Replace `IntelAgents` hardcoded `toolsFor`/`knowledgeFor` strings with real per-field counts. Feed `knowledge-model.ts buildGraph(FieldSeed[])`. | Agent context shows real Volve asset counts | S | S8 |
| **S10** | **Cleanup** | Delete dead D0 prototype: `registry.ts` `STAGES`/`PERSPECTIVES`/`PLAN_METRICS`, `PlanTree`, `PlanCard`, `SuiteCanvas`, `EvidenceStrip`. | Build stays green | S | — |

**S1–S3 is the spine.** Ship those and the architecture is proven; everything after is additive.

---

## 5 · Format scope

| Class | In scope now | Deferred |
|---|---|---|
| **Logs** | **LAS 2.0**, CSV/ASCII curves | LAS 3.0 · **DLIS** (binary RP66 V1, no mature browser parser) |
| **Surfaces** | EarthVision `.dat` · IRAP classic ASCII · ZMAP+ · CPS-3 · XYZ + attributes · Petrel points/polygons | IRAP binary · Petrel binary |
| **Documents** | PDF · DOCX · PPTX · XLSX · CSV · TXT/MD · images | — |
| **Not doing** | OCR (scanned PDFs — say so in UI, don't fail silently) · layout/reading-order analysis | — |

**GVSURF already solves "xyz with attributes"** — the format carries a native `attributes[]` array, each independently quantised onto the same grid and node order as geometry, plus a least-squares-fitted `affine` that handles rotated Petrel/IRAP grids.

---

## 6 · Reuse, don't rebuild

| Need | Already exists |
|---|---|
| Log rendering | `@equinor/videx-wellog@1.5.2` (dep + named in FD blueprint) |
| Gzip | `fflate` (dep — not pako) |
| Gridding scattered XYZ | `engine/geostat.ts` (kriging/SGS/SIS, truth-lock 33/33) |
| Worker pattern | `workers/geostat.worker.ts`, `sim.worker.ts` |
| Doc parsing | `knowledge/extract.ts` (pdfjs · SheetJS · JSZip · sha256) |
| Knowledge contract | `knowledge/types.ts` — `VaultNote` · `Claim` · deterministic ids (M3 LOCKED) |
| OSDU emit | `osdu/{adapter,kinds,types}.ts` — `osduId()`, `governanceFor()` |
| Surface reference parser | `scripts/build-workbench-data.mjs` (parses Volve `.dat` today) |

---

## 7 · Acceptance

1. Volve raw → pipeline → output matches every number in §3.
2. A 50 MB LAS parses without freezing the UI and survives reload.
3. Data QC mounts in all five lifecycle tabs from one module.
4. A `reference` case is never gated; **Exploration** is never gated.
5. A CRS conflict blocks downstream stages and names the offending assets.
6. Figures carry page + pixel box, stored as WebP blobs — never base64 in React state.
7. Accepting a figure does not destroy the entity layer *(the reference studio's worst bug — regression-tested)*.
8. Client ingest emits governed OSDU records under the existing envelope.
9. Adding field #2 needs no code change — only uploads.
10. No number is inferred by an LLM; parsing and QC stay deterministic.

---

## 8 · Reference material

Two founder HTML prototypes were audited. What is genuinely worth porting, and what is not:

| Source | Port | Do **not** port |
|---|---|---|
| `GeaVision-Studio.html` | GVSURF codec (int16 quantise + gzip, `attributes[]`, fitted `affine`, LOD ~180 samples/axis); merged-BufferGeometry + footprint-cull + InstancedMesh *(audit `engine/pack3d.ts` first — may already exist)* | Hand-rolled canvas log renderer (videx is better); main-thread-only parsing |
| `Latest_Cosmo Landing Page.html` (line 4501 → 2.2 MB embedded React app) | Caption-anchored figure cropping with pixel-box provenance; Obsidian-vault export shape (`_Attachments`, Dataview `key:: value`); dual ZIP + File-System-Access export; batch object *(as JSON, not `.txt`)* | "OCR" *(a label — no Tesseract exists)*; validation tab *(validates nothing)*; pipeline strips *(drive nothing)*; hard-coded governance frontmatter; base64-embed micro-frontend trick |

**Known defects in the reference — regression-test against these:** `batch.entities` always 0 (`n.entity` never written) · `rebuild()` filters on that same missing property, so **the first Accept click silently deletes every entity note** · entity filenames collide across documents (silent overwrite) · all figures attach to `note-0`.
