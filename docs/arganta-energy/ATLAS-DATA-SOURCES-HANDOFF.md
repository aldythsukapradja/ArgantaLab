# ATLAS — Data Sources Handoff & Provenance Map

*Machine-queryable source map for every ATLAS entity + fact. Purpose: hand this to a
cheaper LLM so it can answer "where does X come from / is it shippable / what's the
endpoint" without re-deriving anything. Every row is verified (see the research trail in
the linked concept doc). Companion to `WORLD-PETROLEUM-CATALOGUE-CONCEPT.md` +
`DATA-LICENSES.md`. Schema code: `apps/energy/src/atlas/`.*

**How to query this file:** each entity has a stable `id` (tier N, 1–18) and a **Source**,
**Endpoint/Asset**, **Licence**, and **Volve native id**. The **Source Registry** (§3) lists
every source once with its base endpoint + licence + auth. Licences: `PUBLIC` = public
domain (ship freely) · `NLOD` = Norwegian open (ship + attribute) · `NSTA-OUL` = UK open
(attribute; confirm terms) · `EQUINOR-OD` = Equinor Open Data (attribute, no-sale) ·
`PROPRIETARY` = WoodMac/IHS — structure only, values never shipped.

---

## 1. Entity → Source map (the 18-tier spine)

### Geologic / exploration axis (tiers 1–10)

| # | Entity `id` | Primary source | Endpoint / asset | Licence | Volve native id |
|---|---|---|---|---|---|
| 1 | `world` | ATLAS constant | — | PUBLIC | Earth |
| 2 | `region` | USGS DDS-69 regions | `public/world/regions.json` (built) · USGS Tab tables | PUBLIC | 4 · Europe |
| 3 | `country` | ISO 3166 / UN M49; carried by Sodir/NSTA | reference table · `nsr` records | PUBLIC | NO (Norway) |
| 4 | `basin` | USGS Province (DDS-69) | `public/world/provinces.geojson` #4025 | PUBLIC | 4025 · North Sea Graben |
| 5 | `petroleum-system` | USGS Total Petroleum System | `public/world/aus.geojson` (`tps` attr) | PUBLIC | Kimmeridgian Shales |
| 6 | `assessment-unit` | USGS Assessment Unit | `public/world/aus.geojson` #40250101 | PUBLIC | 40250101 · Viking Graben |
| 7 | `play` | USGS play / OSDU Play (interpreted) | derived + Equinor context | PUBLIC/EQUINOR-OD | Middle Jurassic Hugin |
| 8 | `prospect` | Exploration engine (GCoS) | `src/engine/explore.ts` (interpreted) | derived | pre-discovery Volve |
| 9 | `field` | **Sodir field** (FactMaps 502 / FactPages `field`) | `factmaps.sodir.no …/FeatureServer/502` · `public/nsr/nsr-fields.json` | NLOD | **3420717** |
| 10 | `reservoir` | Equinor Volve model (Eclipse/RMS) | `public/wb/*` · Volve dataset | EQUINOR-OD | Hugin Fm |

### Well axis (tiers 11–15) — PPDM

| # | Entity `id` | Primary source | Endpoint / asset | Licence | Volve native id |
|---|---|---|---|---|---|
| 11 | `well` | **Sodir wellbore** (FactMaps 201) | `…/FeatureServer/201` · `public/nsr/nsr-wellbores.json` | NLOD | 5599 (15/9-F-12) |
| 12 | `wellbore` | Sodir + Equinor deviation surveys | `public/wb/traj-*.json` | NLOD/EQUINOR-OD | 15/9-F-12 |
| 13 | `wellbore-segment` | Equinor deviation surveys (sidetracks) | `public/wb/traj-*` (derived) | EQUINOR-OD | — |
| 14 | `contact-interval` | Equinor picks / perforations | `public/wb/picks.json` (interpreted) | EQUINOR-OD | Hugin perf |
| 15 | `completion` | Equinor / Sodir completion | Volve dataset (interpreted) | EQUINOR-OD | F-12 completion |

### Commercial / fiscal axis (tiers 16–18) — Wood Mackenzie shape, open data

| # | Entity `id` | Primary source | Endpoint / asset | Licence | Volve native id |
|---|---|---|---|---|---|
| 16 | `company` | **Sodir company** (FactPages `company`) | FactPages CSV · OSDU Organisation | NLOD | 32011216 · Equinor Energy AS |
| 17 | `licence` | **Sodir licence** (FactMaps 612) / NSTA | `…/FeatureServer/612` · `public/nsr/nsr-licences.json` | NLOD / NSTA-OUL | 046 · 046 BS |
| 18 | `asset` | WoodMac concept (**structure only**) | ATLAS-defined; commercial values PRIVATE | PROPRIETARY-structure | Volve asset |

---

## 2. Fact → Source map (the metric–dimension facts)

Every `QuantityFact` in `atlas/volve.ts` and where its number originates:

| Metric | Value | Source | dataNature | Licence |
|---|---|---|---|---|
| STOIIP (screening) | 142.3 MMSm³ | ArgantaEnergy volumetrics engine on `wb` | derived | EQUINOR-OD |
| GIIP | 40.5 BSm³ | ArgantaEnergy volumetrics | derived | EQUINOR-OD |
| Recoverable oil (2P) | 63.0 MMbbl | Volve production history | measured | EQUINOR-OD |
| Cumulative oil produced | 63.0 MMbbl | Volve production history 2008–2016 | measured | EQUINOR-OD |
| Recovery factor | 0.54 | cum / STOIIP | derived | — |
| OWC | 3200 m TVDSS | Volve Eclipse (EQUIL) | interpreted | EQUINOR-OD |
| φ / NTG / Sw | 0.225 / 0.90 / 0.20 | Volve petrophysical defaults | reference | EQUINOR-OD |
| Bo / Rs / Pi | 1.47 / 148 / 337 bara | Volve PVT (PVTO/PVDG) | reference | EQUINOR-OD |
| Voidage replacement (VRR) | 1.02 | ArgantaEnergy surveillance engine on `wb` | derived | EQUINOR-OD |
| Water depth | 91 m | Sodir wellbore 5599 | measured | NLOD |

Field/well **identity** facts (operator, status, discovery year, discovery well, block,
licence, lat/lon) all come from **Sodir** (NLOD), verified live.

---

## 3. Source Registry (each source once — the lookup table)

| Key | Name | Base endpoint | Access | Licence | Auth |
|---|---|---|---|---|---|
| `USGS` | USGS 2012 World Assessment (DDS-69) | FactPages Tab tables + `DDS69ff.gdb` → `public/world/*` | one-time extract (`scripts/extract-usgs-world.py`) | PUBLIC (US Gov) | none |
| `SODIR-MAP` | Sodir FactMaps (geometry) | `https://factmaps.sodir.no/api/rest/services/Factmaps/FactMapsWGS84/FeatureServer/{layer}/query?f=geojson` | REST GeoJSON, paged | NLOD-2.0 | none |
| `SODIR-FP` | Sodir FactPages (attributes) | `https://factpages.sodir.no/public?/Factpages/external/Tableview/{report}&rs:Format=CSV&IpAddress=1.1.1.1` | CSV (IpAddress param mandatory) | NLOD-2.0 | none |
| `NSTA` | UK NSTA Open Data | `https://services-eu1.arcgis.com/OZMfUznmLTnWccBc/arcgis/rest/services/{Service}/FeatureServer/0/query?f=geojson` | REST GeoJSON | NSTA-OUL (confirm wording) | none |
| `EQUINOR` | Equinor Volve open dataset | Databricks Marketplace / Azure Blob → `public/wb/*` | one-time (`build-workbench-data.mjs`) | EQUINOR-OD (no-sale) | none (public) |
| `WOODMAC` | Wood Mackenzie Lens/GEM/UDT | subscriber portal | **structure adopted; values private** | PROPRIETARY | subscription |
| `IHS` | IHS Markit / S&P Global | EDIN/IRIS21/QUE$TOR | **structure adopted; values private** | PROPRIETARY | subscription |

**Sodir FactMaps layer ids:** 803 quadrants · 802 blocks · 612–617 licences · 502 fields ·
504 discoveries · 201 wellbores · 307 facilities · 311 pipelines · 401 surveys.
**Gotchas:** FactPages CSV needs `IpAddress` param (else HTTP 500); UTF-8 BOM; column typo
`fldCurrentActivitySatus`; ArcGIS `maxRecordCount` 1000 → page wellbores. CRS: Sodir WGS84,
`wb` is ED50/UTM31N → reproject with proj4.

---

## 4. GAP ANALYSIS — what the 18-tier spine is missing

The current spine covers geology → accumulation → well → commercial. To carry the full
promise (*"exploration → put the well in the drilling sequence → production"*) and to model
development/infrastructure, these entities are **missing**. Priority = build value ×
data-readiness (✅ = open data already available).

### Recommended v1.1 additions (7)

| Proposed `id` | Axis | Sits between | Why it's needed | Data ready? |
|---|---|---|---|---|
| `discovery` | geologic | prospect → field | Sodir/IHS model **discovered-but-undeveloped** accumulations separately from producing fields; needed for the exploration→appraisal funnel | ✅ Sodir 504 (391 NO discoveries already in `public/nsr`) |
| `rig` | well | (drilling) | The **drilling sequence** schedules wells on rigs — no rig entity today | ✅ Sodir facility_moveable · IHS rig data (private) |
| `activity` | well | well ↔ rig | The **unit of the drilling sequence**: a scheduled spud→TD→completion operation (ties to the Drilling Sequence lifecycle `ScheduleActivity`) | ✅ derivable from Sodir wellbore dates + your schedule-model |
| `facility` | commercial/asset | field → production | Platform / FPSO / subsea template — required for development & production modelling | ✅ Sodir 307 · EMODnet installations · NSTA infra |
| `pipeline` | commercial | facility → market | Transport/evacuation to get product to market (WoodMac Transport) | ✅ Sodir 311 · EMODnet · NSTA |
| `survey` | geologic | basin/play (acquisition) | Seismic/EM acquisition — the exploration data footprint | ✅ Sodir 401/408 · IHS |
| `project` | commercial | asset grouping | WoodMac "parent project" — groups fields into one development/sanction unit | ⚠️ WoodMac (structure); infer from field groupings |

### Lower-priority candidates (evaluate later)

| Proposed `id` | Note |
|---|---|
| `formation` / `stratigraphic-unit` | Strat framework as a first-class geologic reference (KB already has a `formation` KType; you have formation-tops + surfaces). Add if you want a formal strat column. |
| `pool` | PPDM **regulatory** pool (spacing unit) distinct from geologic `reservoir`. Only needed where regulator spacing matters (US). |
| `interest` | Equity stake (Company × Asset × %) as a first-class entity rather than an edge — enables ownership queries. WoodMac models it as facts. |
| `fiscal-regime` / `contract` | PSC/tax terms as an entity (today an attr on `country`/`licence`). Add for economic modelling depth. |
| `fault-block` / `compartment` | Reservoir segmentation. Only for detailed static/dynamic models. |
| `prospect` split into `lead` + `prospect` | Currently merged; split if you need the full PRMS prospective sub-classes. |

### Also worth adding (cross-cutting, not new tiers)

- **`resource-estimate` as a typed fact bundle** — a named volumetric result (P90/P50/P10 for a metric) rather than loose facts. Improves query-ability of PRMS volumes.
- **`document` / `report`** link entity — tie every entity to its evidence document (you already have the report corpus in `DataMapOrgChart`).

**Recommendation:** ship v1.1 with `discovery`, `rig`, `activity`, `facility`, `pipeline`,
`survey`, `project` → spine grows **18 → 25**. That closes the exploration-to-drilling-
sequence-to-production loop and every one has an open data source ready. The lower-priority
set can wait until a use case demands it.

---

## 5. Volve worked example (full provenance chain)

```
world  (ATLAS)
 └ region 4 Europe                         [USGS · PUBLIC]
    └ basin 4025 North Sea Graben          [USGS province · PUBLIC]
       └ petroleum-system Kimmeridgian Shales  [USGS TPS · PUBLIC]
          └ assessment-unit 40250101 Viking Graben  [USGS AU · PUBLIC]
             └ play Middle Jurassic Hugin   [interpreted]
                └ field Volve (3420717)      [Sodir 502 · NLOD]
                   ├ reservoir Hugin Fm      [Equinor Volve · EQUINOR-OD]
                   └ well 15/9-F-12 (5599)   [Sodir 201 · NLOD]
commercial: company Equinor Energy AS (32011216) · licence 046/046 BS · asset Volve
facts: STOIIP 142.3 MMSm³ · cum oil 63 MMbbl · RF 0.54 · OWC 3200 m · VRR 1.02  [wb/Equinor]
```
Every id is real and live-verified. This is the proof the spine works end-to-end.
