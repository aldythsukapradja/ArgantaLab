# The Exploration Suite — Full Concept

2026-07-23 · Opus (rev. 2026-07-25: locked 10 tabs · Trinity in Basin Modeling · OSDU grounding · scope filter · study DAG). A **ground-up rewrite** of the Exploration lifecycle. The old 7 tabs (Overview/Basemap/Seismic/Wells/Interpretation/Plays&Prospects/Volumetrics/Risk) move to **Legacy**. Exploration becomes a **lightweight suite that reproduces the deterministic backbone of the real exploration software stack** (GeoX · **ZetaWare Trinity** · PetroMod · MOVE · Neftex · PaleoScan · Techlog · Merak), **grounded on OSDU**, driven by a **world petroleum database** for breadth and **Volve** as the deep-dive.

Realizes [EXPLORATION-PLATFORM-ARCHITECTURE](EXPLORATION-PLATFORM-ARCHITECTURE.md) as a software suite; targets the **ARWANA-II gold standard** (see *Part 1*); sits on the existing OSDU/ATLAS spine ([ATLAS-DATA-SOURCES-HANDOFF](ATLAS-DATA-SOURCES-HANDOFF.md), `contracts/osdu-pipeline.md`).

---

## Principle

> **Breadth from the world database, depth from Volve — one connected system, not ten silos.** You start on a globe of the world's basins, drill **World → Region → Basin → Country → Field → Wellbore**, and the tools light up with whatever data exists. Each tab is a **lightweight, transparent, evidence-native clone of one industry software**; all of them read the **same OSDU-grounded study object**, and the last tab assembles their outputs into the **ARWANA-standard report and presentation**.

Three non-negotiables: **(1)** every number comes from a deterministic engine, never an LLM; **(2)** every artifact carries lineage back to an OSDU record; **(3)** no tab re-derives another tab's output — it consumes it by reference.

---

## Part 1 · The 10 sub-tabs — industry software × gold-standard output

Left-to-right = the study workflow = the report order. Each tab **clones one tool** and **produces specific ARWANA sections/artifacts**.

| # | Sub-tab | Phase | Clones | Produces (ARWANA § → artifacts) |
|---|---|---|---|---|
| 1 | **Atlas** | Frame | IHS/S&P · WoodMac · Rystad · USGS | §1–2 Intro, Exploration History, Basin Performance Statistics → world basin map, creaming curve, YTF baseline, ventures screen, **scope entry** |
| 2 | **Data Room** | Frame | Petrel · GIS | §3 Database → 2D/3D seismic inventory + coverage, vintage/quality/mis-tie/well-tie QC, well DB, GIS layers |
| 3 | **Basin Framework** | Model | Neftex · Petrel | §4 (strat) + §5 → tectonic setting, mega-sequences, biostratigraphy, **Well Penetration Chart**, **Wheeler diagram**, sub-basin naming |
| 4 | **Seismic & Structure** | Model | Petrel · PaleoScan · **2D/3D MOVE** | §4 (struct + mapping) → horizon/fault interpretation, **velocity model**, **TSM/DSM per play**, **isochrone/isopach**, flattening + 2D restoration, closure detection |
| 5 | **Petrophysics** | Model | Techlog | §6 → VSH, den-neu correction, lithology, φ + crossplots, permeability, SWE, cut-offs, pay summary → **PHIE/SWE/NTG P10/P50/P90 per interval** |
| 6 | **GDE** | Model | Neftex · SAFARI | §7 → **Gross Depositional Environment map per mega-sequence** (SB-34 … SB-10) |
| 7 | **Basin Modeling** | System | **ZetaWare Trinity / T3** (primary shape) · PetroMod · KINEX | §8 → source rock (TOC/TR/Ro), burial → thermal → EasyRo maturity → generation/expulsion, **charge vs trap timing**, **PSE chart**, map maturity/**kitchen**, migration **"hairy" maps**, fill-spill + charge MC → **YTF (HCG→HCA)** |
| 8 | **Play Fairway & CRS** | System | GeoX · SLB Play Chaser · PBE | §9 → play types, **play analogs**, **PDA** (post-drill + wagon-wheel), **CRS** charge/reservoir/seal, **CCRS per play** |
| 9 | **Prospect & Risk** | Decide | **GeoX** · Merak Peep | §10–11 → leads inventory, **GRV** (two-surface), **probabilistic OGIP/OOIP P10/P50/P90**, Bo/Bg/RF, **GCF = CoSg (play × prospect)**, ranking, **resource-vs-GCF bubble maps**, economics, drill-or-drop |
| 10 | **Deliverables** | Output | *the report itself* | The **ARWANA-structured Report + Presentation**, auto-assembled from tabs 1–9's artifacts |

**Scope fences (cite, never claim):** full 3D Darcy/invasion-percolation migration, compositional PVT, geopressure/Centroid (Trinity/PetroMod) · 3D kinematic restoration + geomechanical FEA (3DMOVE) · full 3D SEG-Y volume rendering + AVO inversion · multi-mineral/NMR/image-log processing · enterprise fiscal modelling.

**The wedge:** not physics parity — **auditability + zero-install web + OSDU grounding + world-DB breadth + the cross-field calibration layer**. ZetaWare's own philosophy (*"all models are wrong, some are useful"* — interactive, geologist-usable, calibrated to real wells, deliberately not over-parameterized) **is** our positioning; Trinity is the tool whose *shape* we emulate, PetroMod the heavyweight we cite.

---

## Part 2 · The unified system — OSDU-grounded, one study, zero silos

### 2.1 OSDU is the system of record (nothing parallel)

The suite **does not create a data layer**. It reads the existing one:

- **OSDU R3** (pinned M27/v0.30.0) = canonical system-of-record; the **18-entity ATLAS spine** = a read/navigation projection over it. Code already in place: `src/osdu/{kinds,adapter,types}.ts` (`OsduRecord`, `OsduManifest`, `OSDU_KIND_BY_ENTITY`, `governanceFor()`), `src/atlas/{spine,volve,goget}.ts`, `contracts/osdu-pipeline.md`.
- **Ingested lanes (17,302 records):** GOGET 8032 · North Sea 7519 · ANP-Brazil 948 · USGS 698 · **Volve 105**. 13 standard OSDU kinds + 5 `arganta:` extensions.
- **Reads:** every tab resolves its inputs to **OSDU record IDs** — never a local copy. Cross-source duplicates are already reconciled by `cockpit-identity.json` (directional best-match crosswalk).
- **Writes:** study outputs become **first-class OSDU records** under new `arganta:exploration:*` extension kinds — `Study · Lead · Prospect · PlayDefinition · CRSMap · CCRSMap · GDEMap · MaturityMap · MigrationPath · VolumetricCase · GCFAssessment · PDARecord · Deliverable`. They inherit ACL/legal via the existing `governanceFor(dataClass, countries)` — so the **sovereign/confidential lane works for interpretations too**, not just source data.

*Consequence:* an interpretation made in Exploration is queryable, permissioned and auditable exactly like a well log — and is directly consumable by Field Development, Well Delivery and Reservoir Management.

### 2.2 The Scope Filter = the study area (one filter, every tab)

A **single global scope control** (in the shell, above the tabs) defines the working area; **every tab, canvas layer and artifact is scoped to it.** Bound to the ATLAS **two-axis** hierarchy (they run parallel and converge at Field/Well):

| Axis | Levels |
|---|---|
| **Geographic** | World → Region → Country → Block / Licence |
| **Geologic** | Basin → Petroleum System → Assessment Unit → Play |
| **Converge** | **Field → Reservoir → Well → Wellbore** |

Plus **facets** (multi-select, all OSDU-backed): operator/company · PRMS class × category · status (lead/prospect/discovery/producing/abandoned) · fuel type · discovery-year range · water depth · onshore/offshore · **data availability** (breadth-only vs full deep-dive bundle). Plus a **spatial AOI** (draw polygon / bbox) for study areas that don't follow an administrative boundary.

Backed by the shipped `cockpit-search.json` (12,559 entries across 6 types, each with fly-to coords).

> **Key insight: the scope filter *is* the study definition.** ARWANA opens by defining its AOI (*"the ARWANA-II JS Area covers the whole area of the NB Graben… ~20,000 km²"*) and every subsequent section — data inventory, CRS maps, leads — is scoped to it. So scope isn't a view preference; it is persisted **on the Study**, and changing it re-scopes every tab and marks derived artifacts stale.

### 2.3 The Study object + artifact DAG (the anti-silo mechanism)

**One `ExplorationStudy` per AOI. Tabs are transforms, not owners.** Each tab writes typed artifacts into the study; downstream tabs consume them **by reference**.

Every artifact carries: `{ id, kind, producedBy(tab · engine + version), inputs[artifactIds + osduRecordIds], dataNature, provenance(source·method·params·units·CRS·author·time), createdAt, supersededBy, stale }`.

**The dependency DAG** — every edge below is mandated by the gold standard:

```
SCOPE (AOI)  ──────────────────────────────────────────────────────────┐
   │                                                                   │
 1 Atlas ──────────► BasinStats · CreamingCurve · YTFBaseline          │
   │                                                                   │
 2 Data Room ──────► DataInventory (seismic · wells · GIS + QC)        │
   ├──────────────────────────────┬──────────────────┬─────────────────┤
 3 Basin Framework      4 Seismic & Structure   5 Petrophysics    6 GDE
   │ StratColumn          │ Horizons · Faults      │ ReservoirParams  │ GDEMap
   │ MegaSequences        │ VelocityModel          │ (PHIE/SWE/NTG    │ per
   │ WellPenetrationChart │ TSM/DSM · Isopach      │  P10/50/90)      │ sequence
   │ WheelerDiagram       │ Closures ──────┐       │                  │
   └──────────────┬───────┴────────────────┼───────┴──────────┬───────┘
                  ▼                        │                  ▼
 7 Basin Modeling (Trinity)                │        (φ cutoffs · shale%)
   SourceRock · ThermalHistory             │                  │
   MaturityMap · MigrationMap(hairy) ──┐   │                  │
   ChargeTiming · PSEChart · YTF       │   │                  │
                  │                    ▼   │                  ▼
 8 Play Fairway & CRS ◄────────────────┴───┼──────────────────┘
   PlayDefinition · PDA(wagon-wheel)       │
   ChargeCRS ◄── maturity + migration      │
   ReservoirCRS ◄── GDE + petrophysics     │
   SealCRS ◄── GDE + shale%                │
   CCRS per play ──────────┐               │
                           ▼               ▼
 9 Prospect & Risk  ◄──────┴───────────────┴──── (closures · reservoir params · Bo/Bg/RF)
   Lead/Prospect · GRV(two-surface) · VolumetricCase(P10/50/90)
   GCF = CoSg = CoS_play × CoS_prospect · Ranking · Economics
                           │
10 Deliverables ◄──────────┘   reads the WHOLE DAG → ARWANA report + deck
```

**The four rules that kill silos:**
1. **No re-derivation.** A tab consumes upstream artifacts by ID. (ARWANA is explicit: *"Source rock maturity has been carried out in basin modeling… migration was built using 'hairy maps' generated from basin modeling"* → Charge CRS **consumes**, never recomputes.)
2. **Lineage is mandatory.** Every artifact names its inputs (artifacts + OSDU records), engine and version.
3. **Staleness propagates.** Change the scope or any upstream artifact → all descendants flag `stale`. Never silently wrong.
4. **Deliverables reads the DAG, not the tabs.** The report is the *composition of artifacts*, so nothing is authored twice.

### 2.4 Handoff out

The study's approved outputs feed the cross-app contracts in [GEAVISION_FOUR_APPS_ARCHITECTURE](geavision/GEAVISION_FOUR_APPS_ARCHITECTURE.md) §7 — Discovery · ResourceDistributions · Contacts · StructuralScenarios · FaciesPriors · FluidScenarios → **Field Development**; and post-well outcomes return into the **calibration library** (Volve = entry #1).

---

## Part 3 · The Shell — the hierarchy navigator (build FIRST)

The left rail is the ATLAS two-axis hierarchy (not a flat object tree), resolved against OSDU, with the **scope filter** at its head:

```
World
└─ Region            (SE Asia · NW Europe)                  [world DB]
   └─ Basin          (West Natuna · Viking Graben)          [USGS AU · GOGET]
      └─ Country/Block (Indonesia · Norway 15/9)            [world DB / NSR]
         └─ Field/Discovery (Volve)                         [→ deep-dive bundle]
            └─ Wellbore  (15/9-19 A · 15/9-19 SR)           [full data]
```
- **Geologic axis** runs in parallel (Basin → Petroleum System → AU → Play) — drill by geography **or** geology; both converge at Field/Well.
- **Data-density badge** per node: breadth nodes show what's known; deep-dive nodes unlock the full suite. Missing data is visible, never faked.
- Selecting a node **sets the scope**; every tab + the canvas re-point to it.

---

## Part 4 · The Canvas — one continuous zoom, world → Volve (build FIRST)

A **multi-scale, context-aware viewport** — five LOD regimes that swap as you descend:

| LOD | Scope | Canvas shows | Engine |
|---|---|---|---|
| **L0 World** | globe | Basins as choropleth (resource/maturity), reserve towers | MapLibre v5 globe + deck.gl |
| **L1 Basin** | 2D map | Fields, discoveries, creaming, play fairways, **CRS/CCRS**, kitchens, licences | MapLibre + deck.gl |
| **L2 Field** | 2D map | Wells, surveys, TSM/DSM, isopach, **lead/prospect outlines** | MapLibre + canvas grids |
| **L3 Structure** | section / 3D | Cross-section, depth surface, closure, restoration, 3D structural view | three.js (reuse Map3D/GridCube3D) |
| **L4 Well/Seismic** | tracks / line | Composite logs, seismic line, well-tie, PDA wagon-wheel, prognosis | canvas (reuse Logs/XSection) |

- **Continuous transition**: zooming or clicking down the hierarchy animates between LODs. The active **tab** decides which *overlay* renders at a given LOD (Basin Modeling at L1 → maturity/kitchen; Play Fairway at L1 → CCRS; Seismic at L4 → the line).
- **The canvas is a scale router** over viewers that already exist (Map3D, GridCube3D, XSection, LogsView) + the shipped MapLibre v5 + deck.gl cockpit renderer.

---

## Part 5 · Data — OSDU breadth + deep-dive bundles

- **Breadth (every basin worldwide):** the OSDU lanes above — USGS AUs, GOGET field spine, NSR (Sodir/NSTA), ANP. Populates World/Region/Basin/Country/Field for *any* scope.
- **Depth (full suite unlocked):** a **Project Data Bundle** (`projects/<slug>/`, generalized from `/wb`) — wells, logs, tops, surfaces, seismic horizons, culture, analogues + user-created study objects. **Volve = bundle #1.**
- **Adding another deep-dive field = dropping a bundle, no code** (platform-doc north-star). ARWANA/West Natuna is the natural bundle #2 — a *frontier* basin, complementing Volve's *producing* field.

---

## Part 6 · Legacy handling

- Current `src/tabs/exploration/*` + `ExplorationExplorer.tsx` → **`src/tabs/exploration/legacy/`**, reachable via a **"Legacy (v1)"** entry. The working engines (`explore.ts` GCoS/MC/EMV + its 9 parity tests) lift into **Prospect & Risk**.
- `explData.ts` Volve constants → demoted into the `projects/volve/` bundle.
- Keep: the evidence/data-nature spine, `exploration.css` token bridge, every `src/engine/*`.

---

## Part 7 · Phasing (spine first; Basin Modeling **before** CRS)

- **S0 · Spine** — scope filter + `ExplorationStudy` + artifact DAG + OSDU read/write layer + hierarchy shell + LOD canvas router. **No analysis tabs — just scope, navigate, and see real data appear.** *(founder's "shell and canvas first")*
- **S1 · Atlas + Data Room** — frame the study: world screening, AOI, data inventory + QC.
- **S2 · Basin Framework + Seismic & Structure** — the frameworks and the maps (TSM/DSM, isopach, closures).
- **S3 · Petrophysics + GDE** — reservoir parameter distributions + depositional maps.
- **S4 · Basin Modeling (Trinity)** — `basin.ts` per [BASIN-MODELING-INTEGRATION-PLAN](BASIN-MODELING-INTEGRATION-PLAN.md): **P4a** 1D burial/maturity → **P4b** map maturity + kitchen (reuse `grid.ts`/`geostat.ts`) → **P4c** fill-spill migration (reuse `closure.ts` flood-fill) → **P4d** charge-volume MC + phase (reuse `mc.ts`). **Hard prerequisite for S5's Charge CRS.**
- **S5 · Play Fairway & CRS** — PDA, CRS ×3, CCRS per play.
- **S6 · Prospect & Risk** — leads, GRV, probabilistic volumes, GCF, ranking, economics.
- **S7 · Deliverables** — the ARWANA report + presentation assembler.
- **S8 · Analogues, calibration library, grounded agent.**

---

## Part 8 · Stack

Reuse React/TS/Vite, the existing canvas/three engines, **MapLibre GL v5 (globe) + deck.gl v9** (already shipped in the cockpit), and the OSDU/ATLAS layer. **Add:** `basin.ts` (S4), the study/DAG store, the scope-filter component, and the report assembler. Backend deferred (bundle + OSDU manifests first) per the platform doc.

---

## Acceptance

1. **One scope filter** drives all 10 tabs, the canvas, and the study — by geography *or* geology, with facets and AOI.
2. **Everything grounded in OSDU** — inputs are OSDU record IDs; outputs are governed `arganta:exploration:*` records.
3. **No silos** — artifacts flow along the DAG with lineage; upstream change marks downstream stale; nothing re-derived.
4. **Navigate world → Volve** with continuous LOD, breadth vs depth honored, missing data visible.
5. **Each tab is a recognizable lightweight of its industry analog**, deterministic and evidence-native.
6. **Deliverables reproduces the ARWANA ToC** — report + presentation composed from artifacts, not hand-authored.
7. **Second deep-dive field = a bundle, no code.**
8. **Doctrine intact** — deterministic engines own every number; the LLM retrieves, explains and drafts, never invents.
