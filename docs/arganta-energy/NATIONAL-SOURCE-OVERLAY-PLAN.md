# National Source Overlay & Multi-Source Basin Reconciliation

**Reference implementation: Indonesia — GeoMigas / ESDM (Badan Geologi, KESDM)**
**Status: PLAN — no code written. 2026-07-23.**

---

## 0. The problem in one paragraph

USGS gives us **global, public-domain, numeric** basin coverage (179 world provinces + 340 assessment units, with `oilMean` / `gasMean` / `boeMean`). GeoMigas gives us **128 Indonesian basins** with far richer *local* content — maturity status, tectonic classification, area, and petroleum-system narrative — but **no geometry**, a **no-resell licence**, and a **finer granularity** than USGS (128 ESDM basins vs a dozen-odd USGS Indonesian provinces). The two describe the *same physical basins* with **complementary strengths**. The task is not "merge and overwrite USGS." It is to design a reconciliation model where **each source is authoritative for what it is actually good at**, one basin identity is presented to the user, provenance is visible per attribute, and — critically — **the same pattern works for every future country** where a national source out-details the global baseline (Brazil/ANP, Norway/Sodir, UK/NSTA today; Malaysia, Australia, Nigeria tomorrow).

This is a **data-federation / authority** problem, not a merge problem.

---

## 1. What GeoMigas actually is (source characterization)

| Attribute class | GeoMigas / ESDM | USGS | Winner (Indonesia) |
|---|---|---|---|
| **Basin inventory** | 128 basins (finer split; includes many USGS never assessed) | ~12–20 Indonesian provinces | **ESDM** (superset) |
| **Geometry (polygon)** | ❌ none (`geometry_recovered: false`) | ✅ province polygons | **USGS** (proxy only) |
| **Area (km²)** | ✅ authoritative national number | ❌ (derivable from polygon) | **ESDM** |
| **Maturity / status** | ✅ 6-level (Producing/Discovery/Proven PS/HC Indication/G&G Data/Unexplored) | ❌ | **ESDM** |
| **Tectonic classification** | ✅ national code scheme (A–K, `I-` rift prefix) | ✅ geologic province type | **both → canonical map** |
| **Petroleum-system narrative, exploration history, regional geology** | ✅ per-basin prose | ❌ | **ESDM** |
| **Resource assessment (risked recoverable oil/gas)** | ❌ (reports are *recommendation*-type, not numeric AU assessments) | ✅ `boeMean` etc. | **USGS** |
| **Licence / WK / blocks** | ⚠️ recommendation reports only; **not authoritative for WK** | ❌ | **Ditjen Migas** (separate connector) |
| **Confidence / QC metadata** | ✅ `record_confidence`, `qc_notes`, catalogue-vs-detail rule | source-level | **carry through** |

**Licence:** *"Use with PSG attribution; raw source data must not be resold."* → `dataClass: public`, but a distinct licence string + mandatory attribution surfacing + a no-redistribution flag. Not the same as USGS "Public Domain."

**Built-in governance we must honour:** the package already ships `record_confidence` (high/medium/low), `qc_notes`, two provisional records (Biak-Yapen, Flores), and an explicit rule: *"Catalogue and basin-detail pages can disagree; preserve both values and never silently overwrite."* This is **exactly** the OSDU doctrine (`osdu-pipeline.md`: *"source records are not overwritten"*). We keep both `catalogue_area_km2` and `detail_page_area_km2` as separate sourced facts.

---

## 2. The central design decision — Authority Matrix + composed golden view

### 2.1 Why not the existing mechanism

The implemented reconciliation (`scripts/lib/identity-resolve.mjs`) is **spatial** (Haversine ≤15 km) + **name** (Dice), country-gated, GOGET-vs-authoritative. It **cannot** resolve GeoMigas basins because GeoMigas has **no coordinates or polygons** to match on, and it operates at *field* level, not *basin* level. So GeoMigas needs a **different resolution layer**: a **curated basin crosswalk**, not an automatic spatial join.

The existing provenance model is also **record-level**, not per-attribute. Delivering "best of both" (USGS numbers *and* ESDM geology *on one basin*) requires per-attribute provenance. We add this **without** breaking the no-overwrite rule by composing at **read time**.

### 2.2 The model

```
                 ┌─────────────────────────────────────────────┐
   IMMUTABLE     │  OSDU source records (never merged/overwritten)│
   SOURCE        │  usgs-basin-3611        geomigas-basin-kutai   │
   RECORDS       │  (polygon, boeMean)     (area, status, prose)  │
                 └───────────────┬─────────────────────────────┘
                                 │  reviewed crosswalk edges
                                 │  (same-as | contains | part-of)
                 ┌───────────────▼─────────────────────────────┐
   AUTHORITY     │  authority-matrix.json                        │
   MATRIX        │  per country × attribute-class → who wins      │
                 └───────────────┬─────────────────────────────┘
                                 │  read-time composition
                 ┌───────────────▼─────────────────────────────┐
   COMPOSED      │  Golden Basin View (per-attribute provenance) │
   GOLDEN VIEW   │  geometry←USGS  area←ESDM  status←ESDM         │
                 │  assessment←USGS  narrative←ESDM  +confidence  │
                 └─────────────────────────────────────────────┘
```

- **Source records stay immutable** (honours OSDU doctrine + GeoMigas "never silently overwrite").
- **The Authority Matrix** is the one new registry that generalizes. Default row: `{country:"*", authority:"USGS"}` — the global baseline. National rows override *specific attribute-classes only*.
- **The composed view is computed, not stored** — so provenance is per-attribute by construction (each attribute carries the source it was pulled from + that source's confidence + licence).

### 2.3 Authority Matrix — proposed shape

`apps/energy/data-energy/authority/authority-matrix.json` (new):

```jsonc
{
  "attributeClasses": [
    "geometry", "area", "maturity", "tectonics",
    "narrative", "assessment", "licensing", "fieldRoster"
  ],
  "sources": {
    "USGS": { "tier": "global-baseline", "licence": "Public Domain (US Geological Survey)" },
    "ESDM": { "tier": "national", "country": "ID",
              "licence": "PSG attribution; raw source data must not be resold",
              "attributionRequired": true, "redistributable": false },
    "DitjenMigas": { "tier": "national-regulator", "country": "ID", "licence": "TBD" }
  },
  "rules": [
    { "country": "*",  "attributeClass": "*",          "authority": "USGS" },        // baseline
    { "country": "ID", "attributeClass": "area",        "authority": "ESDM" },
    { "country": "ID", "attributeClass": "maturity",    "authority": "ESDM" },
    { "country": "ID", "attributeClass": "tectonics",   "authority": "ESDM", "keepAlso": ["USGS"] },
    { "country": "ID", "attributeClass": "narrative",   "authority": "ESDM" },
    { "country": "ID", "attributeClass": "geometry",    "authority": "USGS", "quality": "proxy" },
    { "country": "ID", "attributeClass": "assessment",  "authority": "USGS" },
    { "country": "ID", "attributeClass": "licensing",   "authority": "DitjenMigas" }
  ]
}
```

Onboarding a new country = **add rows**, nothing more. This *is* the answer to "same thing will happen for other countries."

---

## 3. Basin identity & the crosswalk (ESDM ↔ USGS)

### 3.1 Decision: mint ESDM basins as their own OSDU records

Follow the **ANP precedent** (`buildAnp` mints `anp-basin-${NOM_BACIA}` with `BasinID:'ANP:<name>'`). GeoMigas basins become:

- OSDU kind `osdu:wks:master-data--Basin:1.2.0`
- nativeId `geomigas-basin-<slug>` (e.g. `geomigas-basin-kutai`)
- canonical projection id `atlas:basin:esdm:kutai`
- `legal.otherRelevantDataCountries: ["ID"]`
- `data.ExtensionProperties`: `{ tectonicSetting, tectonicCode, basinStatus, catalogueAreaKm2, detailAreaKm2, introduction, explorationHistory, regionalGeology, petroleumSystem, recordConfidence, qcNotes }`
- OSDU `tags`: `arganta:source=GeoMigas`, `arganta:sourceLicence=...`, `arganta:dataNature=reported`, `arganta:dataClass=public`, `arganta:confidence=<high|medium|low>`

**Why mint, not reuse `prvCode`:** the 128↔~15 granularity mismatch makes a shared identifier impossible — many ESDM basins map to one USGS province, and many ESDM basins (the "Unexplored" tail) map to *no* USGS province at all. Reusing codes would force lossy lumping. Minting + crosswalk edges preserves both truths.

### 3.2 The crosswalk file

`apps/energy/data-energy/crosswalk/indonesia-basin-crosswalk.json` (new) — a **curated, reviewed** table (not auto-generated, because there's no geometry to auto-match on):

```jsonc
[
  { "geomigasBasinId": "geomigas-basin-kutai", "geomigasName": "Kutai",
    "usgsPrvCode": ["3803"], "relation": "same-as",
    "matchConfidence": "high", "matchMethod": "name+geographic-review", "reviewed": false,
    "note": "USGS Kutei Basin Province" },

  { "geomigasBasinId": "geomigas-basin-sumatera-selatan", "geomigasName": "Sumatera Selatan",
    "usgsPrvCode": ["3810"], "relation": "same-as",
    "matchConfidence": "high", "matchMethod": "name+geographic-review", "reviewed": false,
    "note": "USGS South Sumatra Basin" },

  { "geomigasBasinId": "geomigas-basin-natuna-barat", "geomigasName": "Natuna Barat",
    "usgsPrvCode": ["3705"], "relation": "part-of",
    "matchConfidence": "medium", "matchMethod": "geographic-review", "reviewed": false,
    "note": "ESDM splits West/South/East Natuna; USGS lumps as West Natuna province — part-of" },

  { "geomigasBasinId": "geomigas-basin-akimeugah", "geomigasName": "Akimeugah",
    "usgsPrvCode": [], "relation": "none",
    "matchConfidence": "high", "matchMethod": "review", "reviewed": false,
    "note": "No USGS assessed province — ESDM-authority basin, no USGS numbers available" }
]
```

- `relation` reuses the existing `FieldIdentityLink` enum semantics (`same-as | contains | part-of | successor-of`) — the crosswalk emits **basin-level identity edges** in the same shape, so it slots into the existing identity model rather than inventing a parallel one.
- `relation: "none"` is a **first-class, expected outcome** — this is precisely the "local source has more content" case: ESDM basins with no global equivalent enter the catalogue on ESDM authority alone, with USGS assessment shown as `Not reported`.
- **Provenance of the match itself** is recorded (`matchMethod`, `matchConfidence`, `reviewed`). Nothing is `reviewed:true` until a human confirms — matching what GeoMigas' own package demanded for Biak-Yapen / Flores.

### 3.3 How USGS numbers reach an ESDM basin

At compose time, for a `same-as` / `part-of` edge, the golden view reads `assessment` (`boeMean`, `oilMean`, `gasMean`) from the linked `usgs-basin-<prvCode>` record. For `part-of` (many ESDM → one USGS), the USGS assessment is shown at province level with an explicit **"assessment covers the wider USGS province, not this sub-basin"** disclaimer — never silently divided.

---

## 4. Geometry strategy (staged)

GeoMigas has area but no shape; the Cockpit is map-first (points + polygons). Three stages:

1. **Now — points + proxy polygon.** Place each ESDM basin as a **centroid point** (hand-seeded lat/lon from the detail-page "Location" text, ~128 rows; a bounded one-time curation) carrying `area_km2` as a bubble scale. Where a `same-as` USGS edge exists, borrow the **USGS province polygon as a proxy footprint**, badged `geometry: proxy (USGS province NNNN)`. Basins with `relation:none` show as point-only until Stage 3.
2. **Later — real ESDM polygons.** Source Indonesian basin outlines from ESDM One Map / the published *Cekungan Sedimen Indonesia* basin map. Own connector; replaces the proxy; flips the `geometry` authority row from USGS→ESDM.
3. **Rule:** every rendered footprint carries a `geometryQuality` chip (`exact | proxy | point-only`) so a proxy USGS polygon is **never** mistaken for an ESDM boundary. Missing values render as `Not reported`, never zero (existing Cockpit mandate).

---

## 5. WK / Blocks — explicitly separate, deferred

Per the package's own `WK_BLOCKS_STATUS.md`: **GeoMigas is not authoritative for WK.** So:

- WK/blocks are a **separate connector** (`DitjenMigas`), a **separate OSDU entity** (license/block → `master-data--Agreement:1.1.0` or an `arganta:CommercialAsset` extension), with its own authority-matrix row (`licensing → DitjenMigas`).
- The 13-name 2026 tender seed lands as **evidence-only** metadata (no polygons, `geometry_recovered:false`, `contract_status_verified:false`) — not as authoritative WK records.
- GeoMigas *recommendation reports* (Kutai, Bone, Banggai, Pembuang PDFs) attach to their basin as **supporting-evidence document links**, gated behind the sign-in/attribution workflow — **we do not bypass auth or host the PDFs**; we store metadata + the basin page URL + licence.
- Source order for the real WK layer (from the package): Ditjen Migas bidding portal → ESDM One Map GIS → Migas Data Repository → bid documents → GeoMigas as geological support only.

---

## 6. Confidence & QC propagation

- `record_confidence` → `tags['arganta:confidence']` on the OSDU record → surfaced as a chip on the composed view.
- `qc_notes` → carried on the record, shown in the dossier "data quality" line.
- **Provisional records (Biak-Yapen, Flores):** ingest with `confidence:low` and a visible "requires live-page verification" flag; **excluded from any headline count/ranking** until reviewed. Completeness is honest, not silent.
- **Catalogue vs detail disagreement:** both values kept as separate sourced facts (`catalogueAreaKm2`, `detailAreaKm2`); the composed view prefers detail, shows the delta, never overwrites.

---

## 7. Surfacing in the Cockpit (read side)

- **Search** (`cockpit-search.json`): add `type:"basin"` entries (the DESIGN-HANDOFF already mandates indexing "basin and block"). ESDM basins searchable by name + tectonic setting + status.
- **Map:** ESDM basin points (centroid, area-scaled) + proxy province polygons, provenance-badged.
- **Dossier** (`CockpitDossier.tsx`): a **Basin dossier** rendering the composed golden view with **per-attribute provenance chips** — e.g. `Area 130,970 km² · ESDM` / `Assessment 3,816 MMBOE · USGS 3803` / `Status Producing · ESDM` / `Geometry proxy · USGS`.
- **Insights** (`cockpit-insights.json`): a new **Indonesia maturity lens** — the ESDM 6-status distribution (19 Producing / 27 Discovery / 8 Proven PS / 4 HC Indication / 27 G&G / 43 Unexplored) as a portfolio-maturity view no other country currently has. This is the visible "local data has more content" payoff.

---

## 8. Phased build order (when we do build)

| Phase | Deliverable | Touches |
|---|---|---|
| **P0 — Land & attribute** | Copy raw catalogue + PDF manifest + crawler + attribution into `data-energy/raw/geomigas/`. Add GeoMigas licence to `docs/arganta-energy/DATA-LICENSES.md`. | new files only |
| **P1 — Authority framework** *(the generalizable core)* | `authority-matrix.json` + a `composeGoldenView()` read-model function. Add `indonesia`/`id`→`ID` to `identity-resolve.mjs` COUNTRY map. Define the 8 attribute-classes + per-attribute provenance in the composed view type. | `src/atlas/`, `scripts/lib/` |
| **P2 — GeoMigas basin lane** | `buildGeoMigas()` in `build-osdu.mjs` → `geomigas.manifest.json` (128 Basin records). Register in `public/osdu/index.json`. Optional `src/atlas/geomigas.ts` alias-map adapter (goget.ts shape). | `scripts/`, `public/osdu/index.json` |
| **P3 — Crosswalk** | `indonesia-basin-crosswalk.json` (curated, `reviewed:false` seed) + emit basin identity edges + review workflow. | `data-energy/crosswalk/` |
| **P4 — Compose & surface** | Wire golden view into `build-cockpit-spatial.mjs`: basin search entries, centroid points, proxy polygons, dossier panel, Indonesia maturity insight. | `scripts/build-cockpit-spatial.mjs`, `src/cosmo/CockpitDossier.tsx` |
| **P5 — Real geometry** *(deferred)* | ESDM One Map / published basin-outline connector → replace proxy footprints; flip `geometry` authority ID→ESDM. | new connector |
| **P6 — WK / blocks** *(deferred, separate authority)* | Ditjen Migas connector: WK polygons/status/operators; GeoMigas recs as evidence edges. | new connector |
| **P7 — Generalize** | "Onboard a national source" playbook doc: baseline USGS + national overlay + authority rows + crosswalk template. Re-express ANP/NSTA/Sodir as overlays under the same matrix. | docs |

**P1 is the keystone.** Everything national — Indonesia now, Malaysia/Nigeria/Australia later — plugs into the Authority Matrix + composed-view + crosswalk triad built in P1/P3. Indonesia is the reference implementation that proves the pattern.

---

## 9. The generalization (why this is the real deliverable)

The reusable abstraction is **"Global baseline + National overlays, reconciled by a per-country × per-attribute Authority Matrix over immutable source records, joined by curated identity crosswalks, composed into a per-attribute-provenanced golden view."**

To onboard any future country where a local source out-details USGS:

1. Land the raw source under `data-energy/raw/<source>/` with its licence.
2. Add a source entry + national attribute-class rows to `authority-matrix.json`.
3. Add the country to the `identity-resolve.mjs` COUNTRY map.
4. Write a `build<Source>()` lane minting national OSDU records (basins/fields), ANP-style.
5. Author a curated `<country>-basin-crosswalk.json` (`same-as`/`part-of`/`contains`/`none`).
6. The composed golden view + Cockpit surfaces pick it up with **zero bespoke UI**.

USGS is never discarded — it remains the floor that guarantees every country has *some* comparable, numeric, redistributable assessment. National sources are additive precision on top. `relation:none` basins are the honest record that the local source simply knows about places the global baseline never assessed.

---

## 10. Open decisions (recommended answers baked in above, flag if you disagree)

1. **Mint ESDM basins vs reuse USGS `prvCode`** → **mint** (granularity mismatch + ANP precedent). *Recommended.*
2. **Golden record at build time vs composed view at read time** → **read-time composed view** over immutable sources (honours OSDU + GeoMigas no-overwrite). *Recommended.*
3. **Per-attribute provenance** → **yes**, scoped to the composed view only (source records stay record-level). *Recommended.*
4. **Centroid seeding** → **hand-seed 128 lat/lons once** from detail-page "Location" (bounded, one-time) vs defer basins off-map until real polygons. *Recommended: hand-seed* — gets Indonesia on the map immediately.
5. **PDF recommendation reports** → **metadata + attribution only, never bypass GeoMigas auth / never host the binaries.** *Non-negotiable (licence).*

---

## Appendix — source files

- Raw package (this handoff): `geomigas_full_catalogue_128.{json,csv}`, `geomigas_pdf_manifest.{json,csv}`, `wk_blocks_2026_tender_seed.csv`, `geomigas_crawler.py`, `VALIDATION_REPORT.json`, `WK_BLOCKS_STATUS.md`, `PDF_ACCESS_README.md`.
- Attribution: *Pusat Survei Geologi, Badan Geologi, KESDM* — `https://geologi.esdm.go.id/geomigas/pages/basincatalogue`.
- Existing code anchored: `src/osdu/types.ts`, `src/atlas/{types.ts,spine.ts,goget.ts,volve.ts}`, `scripts/build-osdu.mjs` (`buildUsgs` L27-72, `buildAnp` L274-341), `scripts/build-cockpit-spatial.mjs`, `scripts/lib/identity-resolve.mjs`, `public/osdu/index.json`, `public/world/{provinces,aus}.geojson`.
- Aligned docs: `WORLD-PETROLEUM-CATALOGUE-CONCEPT.md`, `COCKPIT-DESIGN-HANDOFF.md`, `COCKPIT-WAYFORWARD.md` (Stream A / identity resolution), `contracts/osdu-pipeline.md`, `qc/identity-mastering.md`.
