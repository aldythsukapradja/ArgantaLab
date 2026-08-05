# App Inventory — what can actually appear on a slide

**This is the authoritative list.** Every component below exists in the codebase
today. If a slide needs something not on this list, mark it `NEW BUILD` so the
cost is visible.

Verified by direct inspection of the repository, not from memory.

---

## 1. Exploration workspace

### Current suite — `src/tabs/exploration/`

| Component | What it renders |
|---|---|
| `KnowledgeBank` | **The Basin Dossier** — the flagship screening view: map + petroleum-system events chart + verdict cards + creaming curve |
| `BasinCharts` | Basin chart set including the petroleum-system events chart |
| `BasinChartLibrary` | Chart catalogue — charts, basin cycles, analogues, link-only |
| `CreamingCurve` | Discovery-history creaming curve, scrubbable |
| `BasinPlateGallery` / `basin-plates` | Plate-tectonic / rift schematic gallery |
| `DepositionalSchematic` | Depositional environment schematic |
| `FigureStrip` | Figure strip from the basin atlas figure library |
| `StudyTree` | The study artefact DAG |
| `TimeRangeRail` / `geo-time` | Geologic time rail and scale |
| `basin-insight` / `basin-figures` / `doust-basin-links` | Derivation + figure-library layers behind the above |

### v1 viewers still in the codebase — `src/tabs/exploration/legacy/`

| Component | What it renders |
|---|---|
| `Risk` | **Chance-factor (GCF) editor → GCoS** |
| `Volumetrics` | Prospect volumetrics, P90/P50/P10 |
| `PlaysProspects` | Play and prospect inventory / maturity ladder |
| `Interpretation` | Seismic interpretation view |
| `Wells` | Well inventory |
| `Basemap` / `Overview` | Base map and overview canvas |

---

## 2. Field Development workspace

### Current suite — `src/tabs/fielddev/`

| Component | What it renders |
|---|---|
| `KnowledgeBank` / `AssetDossier` | **The Asset Dossier** — record + performance + readiness ledger |
| `FieldDossier` / `field-record` | Field record card |
| `FieldScene` / `Structure3D` / `StructureLayer` / `surface-mesh` | 3D field scene, structural surfaces |
| `AssetCharts` | Asset chart set |
| `contact-contour` | Fluid-contact contouring |
| `horizon-picks` / `horizon-order` | Horizon picks and ordering |
| `well-paths` / `well-activity` / `well-stats` | Well trajectories and activity |
| `WellCountPanel` | Well count vs outcome |
| `flow-series` | Flow time series |
| `PlanTree` / `PlanCard` | Development plan tree and cards |
| `KnowledgeMap` / `EvidenceStrip` | Evidence provenance surfaces |

### v1 viewers still in the codebase — `src/tabs/fielddev/legacy/`

| Component | What it renders |
|---|---|
| `LogsView` | **Well log viewer** on real LAS curves |
| `Petrophysics` | **Vsh / PHIE / Sw / net pay with cutoffs** |
| `CorrelationView` | **Well-to-well correlation panel** |
| `XSection` | Cross-section |
| `Structural` | Structural interpretation |
| `MapView` / `Map3D` | 2D and 3D field maps |
| `GridModelView` / `GridCube3D` / `GridVolume` | **Static grid model, 3D cube, grid-based volumetrics** |
| `Property` | Property population / distribution |
| `Volumetrics` | Volumetric calculation |
| `Uncertainty` | **Uncertainty / tornado** |
| `SimulationView` / `SimDrape` | **Dynamic simulation and result drape** |
| `Forecast` | Production forecast |
| `Economics` | **NPV, breakeven, price sensitivity** |
| `ProductionChartView` | Production charts |
| `Crossplot` / `Crossplot3D` | 2D and 3D crossplots |
| `FieldReview` | Integrated field review |

---

## 3. Reservoir Management workspace — `src/tabs/reservoir/`

| Component | What it renders |
|---|---|
| `KnowledgeBank` / `SurveillanceDossier` | **The Surveillance Dossier** — behaviour, efficiency, intervention; includes the Chan water-path classification card |
| `Production` | **Production history — rates, WCT, GOR; includes Hall plot** |
| `Pressure` | **Pressure history, bubble point** |
| `InjectionVrr` + `chart/VrrPanel` | **Injection and Voidage Replacement Ratio** |
| `Patterns` | **Injector–producer pattern connectivity** |
| `Surveillance` / `SurveillanceChartViews` | Surveillance chart set |
| `WellTests` + `chart/WelltestPanel` | **Well tests — WCT, GOR** |
| `WellReviewCards` / `well-review` | Per-well review cards (decline, VRR, water cut) |
| `Forecast` | **Arps decline forecasting** |
| `Opportunities` | Intervention / opportunity screening |
| `Overview` | Field overview |
| `chart/RMChart` | Shared RM chart primitive |

### Diagnostics confirmed present in code

`Chan` · `Water cut` · `WCT` · `GOR` · `Hall plot` · `VRR` · `Voidage` ·
`Decline` · `Arps` · `Bubble point`

Also present in the dossier model: water-path classes `coning` · `channelling` ·
`multilayer` · `undetermined`, and lifecycle phases `start-up` · `plateau` ·
`decline` · `tail` · `ceased`.

---

## 4. Cockpit — the spatial surface

| Capability | Detail |
|---|---|
| Map engine | MapLibre v5 + deck.gl |
| Themes | **Satellite** · Open Map · Mesh |
| Modes | 2D / 3D, plus 3D reserve towers |
| Scale | ~10,850 field points, ~1,200 polygons, 179 USGS provinces |
| Search | ~12,560 indexed entries across 6 entity types |
| Dossiers | Field / province / well dossiers on click |

This is the cold-open surface: a real satellite globe that flies to block 15/9.

---

## 5. Data & QC surfaces

| Component | What it renders |
|---|---|
| `LogViewer` | Industry-standard log viewer |
| `TrajectoryViewer` | Well trajectory viewer |
| `AssetViewer` | Generic ingested-asset viewer |
| Data QC | Ingestion, audit, availability gate |
| Knowledge → Extraction Studio | Document extraction and review |

---

## 6. The agents — `src/cosmo/agents.ts`

| Agent | State | What it claims on Volve |
|---|---|---|
| Exploration (EXP) | **BETA** | Analogue evidence and remaining trap risk connected to source |
| Field Development (FD) | **LIVE** | Fault-block connectivity supports the preferred concept with traceable confidence |
| Reservoir Management (RM) | **LIVE** | Detects the water-cut deviation and frames the next intervention |
| Well Delivery (WD) | **BETA** | Proposed well clears the depth envelope; casing window stable |
| Drilling (DRL) | **BETA** | Recommended sequence protects rig continuity and first-oil logic |

**Important honesty feature:** the agent capability layer (`agent-context.ts`)
measures what the workspace can actually evidence, and reports `NOT TOOL-BOUND`
when a capability has no measurable artefact behind it. An agent that admits a
gap is a *feature* of the demo, not a bug — Act I's agent interlude leans on it.

**Important limitation:** the in-app agent narration is deterministic and
scripted, not a live LLM call. Reliable on stage; cannot currently handle an
unscripted question from the room without new work.

---

## 7. Volve data actually loaded

| Dataset | Status |
|---|---|
| Well logs (LAS) | Loaded — 24–25 logs |
| Trajectories | Loaded — 25 wells/wellbores |
| Production history | Loaded |
| Pressure | Loaded |
| Formation pressure | Loaded |
| Drilling — MW / ECD / ROP / WOB | Loaded |
| Well tests | Loaded |
| OSDU records | ~17,300 across 5 manifests |
| Seismic volumes / Eclipse decks / RMS projects | **NOT loaded** — too large, never mirrored |

Context data beyond Volve: USGS province/assessment-unit atlas (179 provinces,
~340 assessment units, ~8,000 fields), North Sea regulator data (Sodir NO, NSTA UK).

---

## 8. Existing training assets — reusable content

A previous version of the course exists in the codebase (now parked as "Learn").
Its **content is good even though its format was wrong**:

| Asset | Volume | Quality |
|---|---|---|
| Day decks | 5 days × ~20 slides = ~100 slides | Titles are already claims, not topics. Substance is strong. |
| Facilitator notes | One per slide | **The most valuable asset.** Each names the question to ask, the wrong answer to expect, and the objection to pre-empt. |
| Quiz bank | Multi-day, scoped, with explanations | Reusable |
| Guided missions | Ordered steps with per-step evidence capture, each naming its workspace module | Reusable |
| PPTX / DOCX round-trip | Import and export | Reusable if a leave-behind is wanted |

**Recommendation carried into the brainstorm:** salvage the arguments and the
facilitator notes verbatim where they're strong; rebuild only the *form*. The
old deck failed because it was a document rendered as slides — 20 dense
bullet pages per day — not because the thinking was wrong.

---

## 9. What does NOT exist yet — the real build

| Piece | Why it's needed |
|---|---|
| Slide chrome — full-bleed frame, claim title, presenter notes, timer | No story-deck renderer exists |
| **"App in a box"** wrapper — mount an existing component read-only with exactly one live interaction | The core idea: *the slides are the app with limited functionality* |
| Story sequencer — order, transitions, act boundaries | — |
| Live binding layer — slide values read app records instead of literals | Constraint C2 |
| Personalised handoff slide — shows what *this cohort* produced | The thing no static deck can do |

---

## 10. Verification note

Component names, file locations, agent states and diagnostic coverage above were
read directly from the repository. Dataset counts come from the app's own build
output. Anything not listed here should be treated as not existing until checked.
