# GeaVision — Four-App Architecture (canonical)
2026-07-22 · Fable synthesis of the founder handoff. **GeaVision = ArgantaEnergy** (`apps/energy`). This maps the handoff onto what's already built and defines app boundaries, doctrine, shared canonical model, cross-app handoff contracts, reuse-vs-build, and build order. It does NOT rebuild the existing validated Field Development app.

## 0 · The key alignment (we're already set up for this)
The handoff's four apps map **exactly** onto the shell's existing **Verticals** zone (built during the Command-Center-OS reorg):
```
GeaVision (apps/energy)  ·  Verticals zone
├── Exploration          ← concepted (EXPLORATION-CONCEPT.md); build per §3
├── Field Development     ← BUILT, V1 complete (commit 7564ede3) — do NOT rebuild
├── Well Delivery         ← new; build per §5
└── Reservoir Management  ← new; build per §6
```
Each app owns its workflows/decisions over a **shared evidence + data backbone** (the mothership: Intelligence zone = Data/Knowledge/Reasoning/Insight). Not one generic subsurface dashboard.

## 1 · Doctrine (already our truth stance — now canon for all four apps)
- **6 evidence states** on every technical value = `measured | reported | interpreted | derived | forecast | scenario` (our existing `dataNature` badges — already enforced across the app). **Missing data > fabricated data.**
- **Deterministic ownership:** `User/Agent intent → versioned workflow spec → deterministic engine → immutable run result → QC + provenance + interpretation`. Our `src/engine/*` + `test-engine.mjs` parity gate already embody this.
- **LLMs may** retrieve/configure-approved-workflows/explain/compare/draft-reports/find-missing-data/propose-actions. **LLMs must NOT** invent log/pressure/tops/production/geology values, change approved assumptions without recording, write canonical scientific tables without deterministic validation, present inferred causes as measured, or replace certified production/reserves. (= the M4 governance wall, MODEL-ALLOCATION deterministic-first.)
- **Every run records:** source · input-version · engine+version · method · params · unit-system · geometry/interval · author/process · exec-time · calibration · QC-state · confidence/uncertainty · superseded-by.

## 2 · Shared canonical primitives (the backbone all four apps read)
`Asset · Well · Reservoir · Formation · Interval · Evidence · Observation · Interpretation · Assumption · Scenario · Model · ModelRun · CalculationResult · Uncertainty · Decision · Approval · Action · Outcome · Document · Comment · User/Role`.
Our M1 star-schema (Well/Wellbore/Surface/EvidenceRecord + dataNature + FK ledger) is the seed; extend toward these primitives in the canonical data model (GEAVISION_CANONICAL_DATA_MODEL.md, next).

## 3 · App 1 — Exploration (concepted; build per EXPLORATION-CONCEPT.md)
Five pillars (screening/teaching grade, cited references, benchmark already in the concept doc):
- **A · PetroMod-lite 1D basin/petroleum-system** — burial→decompaction→heat-flow→temperature→EasyRo maturity→transformation ratio→generation/expulsion timing→charge-vs-trap-timing, scenario ensembles + calibration residuals. Constants already researched (EXPLORATION-CONCEPT §basin constants). Defer 2D/3D migration, compositional flow.
- **B · GeoX-lite opportunity assessment** — play→lead→prospect→target→segment hierarchy; shared+local risks, **conditional/correlated** sampling (NOT all-independent-by-default), probabilistic volumetrics P90/50/10, POS = Π(chance factors), DHI modifier, tornado, portfolio funnel/map, pre-drill vs post-drill snapshots.
- **C · MOVE-lite 2D restoration** — section digitization, line-length/area balancing, simple-shear/flexural-slip unfold, decompaction, sequential restoration playback, balance residuals, structural-transformation ledger.
- **D · Depositional + analogue intelligence** — regional framework (Neftex-style) + quantitative analogue DB (SAND/FAKTS/SAFARI-style): analogue hierarchy + deterministic match-scorer (LLM explains, engine scores).
- **E · PaleoScan-lite seismic stratigraphy** — SEG-Y viewer, horizon/fault interp, well-tie, stratal slicing, closure detection, area-depth/area-volume, prospect polygons → link to opportunity risk.
Build order: GeoX-lite → analogue lib → PetroMod-lite 1D → MOVE-lite 2D → seismic viewer.

## 4 · App 2 — Field Development (BUILT — contracts only)
V1 complete: Map(2D+WebGL 3D)/Logs/Correlation/Petrophysics/Structural(unfaulted+upscaling)/Property(porosity+facies)/Volumetrics(oil+gas)/Uncertainty(MC+tornado)/Forecast(offset benchmark)/Economics. Engine parity 36/36. **Do not rebuild.** Only wire the handoff contracts (§7).

## 5 · App 3 — Well Delivery (new)
Answers: how do we safely plan/drill/steer/monitor/document/learn per well while preserving subsurface-intent ↔ actual-execution?
- **A · DrillPlan-lite** — Well Basis of Design, objectives, targets/anti-targets, trajectory alternatives, hole sections, casing seats, mud program, offset lessons, hazard register, decision gates, plan-vs-actual, immutable approved-program snapshot. Defer full T&D/casing/cement/kick-tolerance.
- **B · PP/FG/geomechanics** — density→overburden, normal-compaction trends, Eaton (sonic/res), Bowers, MDT/RFT + kick + LOT/XLOT calibration, fracture-gradient, centroid/buoyancy, MC P10/50/90 pressure envelopes, mud-weight window vs trajectory, 1D MEM, hazard intervals, real-time recal. Combined depth display (litho/logs/PP/FG/collapse/planned+actual MW/events/uncertainty).
- **C · StarSteer-lite geosteering** — offset correlation, type-well, TVT/flattening, planned+actual trajectory, target line/window, gamma correlation, bed-boundary/dip, interpretation branches, in-zone stats, MD-tied comments, rewindable history. Defer auto-steer/inversion.
- **D · TLog-lite ops geology / mudlog** — vertical+horizontal striplogs, litho/shows/fluorescence/gas, cuttings, tops, drilling breaks, cavings, losses/gains, lag correction, daily geo report, EOW composite, observed-vs-interpreted.
- **E · DrillSpot-lite real-time** — WITSML-aligned schema, **historical replay first**, plan-vs-actual traj+activities, rig-state timeline, ROP/WOB/RPM/torque/SPP/flow/MSE, connection+trip perf, NPT+ILT classification, offset comparison, alerts, DDR, decision log. Defer closed-loop control.
- **F · Drillbench-like dynamic sim** — specialist/later external engine; don't build early.
Build order: Basis → targets/traj/offset → PP/FG/mud → ops-geo/striplog → plan-vs-actual → geosteering → replay → live WITSML → predictive → automation.

## 6 · App 4 — Reservoir Management (new)
Answers: what's the reservoir doing, where underperforming, what evidence explains it, what interventions, what next?
- **A · Avocet-lite production truth** — states `Raw→Validated→Allocated→Approved→Certified/Locked`; daily/monthly oil/gas/water/injection, well tests, downtime, deferment, allocation networks, validation rules, QC flags, approval workflow, revisions, reconciliation, period-lock, certification, audit trail. **No dashboard/AI silently replaces certified production.**
- **B · OFM-lite surveillance** — trends, normalized plots, prod/injection maps, DCA, type curves, RTA, P-depletion, PI/II, water-cut/GOR diagnostics, VRR, pattern surveillance, Hall plots, allocation comparison, operating envelopes, underperformance detection, opportunity register.
- **C · Analytical physics** — tank MB → aquifer → P/Z → Havlena-Odeh → analytical forecast → IPR/VLP nodal → deliverability → simplified network → coupled scenarios → **import ECLIPSE/INTERSECT** results. Internal numerical sim only much later; don't clone ECLIPSE early.
- **D · Cognite-style contextual graph** — canonical asset graph (Reservoir→Wells→Completions/Production/Tests/Pressure/Interventions/Events + Equipment/Facilities/Documents/Models/Forecasts/Opportunities/Actions), contextualized time-series, doc links, event timelines, lineage, cross structured+unstructured search, semantic views.
- **E · Reservoir agent (grounded)** — find underperformers + cite the measurements, run approved DCA/MB workflows, compare vs forecast, summarize pressure/saturation evidence, find missing surveillance, rank interventions, draft reviews, track actions/verify completion. Must NOT alter certified production/reserves/models silently or act without approval.
Build order: production QC → OFM surveillance → DCA → MB → pressure/injection → opp/action register → well/network models → ext-sim import → knowledge graph → agent.

## 7 · Cross-app handoff contracts (the closed learning loop)
```
Exploration → Field Dev:  Discovery · ResourceDistributions · Contacts · StructuralScenarios · FaciesPriors · FluidScenarios · PetrophysicalUncertainty · DevelopmentConstraints
Field Dev → Well Delivery: ApprovedTargets · TrajectoryCorridors · LandingWindows · CompletionObjectives · ReservoirUncertainty · PressureAssumptions · WellCount+Sequence · DevelopmentConstraints
Well Delivery → Reservoir Mgmt: AsDrilledGeometry · Logs · Mudlog · FormationTops · PressureTests · Completions · OperationalEvents · EndOfWellInterpretation
Reservoir Mgmt → Exploration/Dev: ActualPerformance · UpdatedPressure · UpdatedSaturation · WellResponse · InterventionOutcomes · LessonsLearned  (→ analogue + evidence libraries)
```
Each handoff is an explicit, versioned, evidence-tagged contract object (typed, in the canonical model) — not an implicit shared table.

## 8 · Reuse-vs-build matrix (from current repo)
| Asset | Status | Four-app use |
|---|---|---|
| M1 star-schema + evidence ledger + dataNature | BUILT | the shared canonical backbone (extend to §2 primitives) |
| `src/engine/*` (view/grid/contour/closure/petro/upscale/volumetrics/mc/dca/econ) | BUILT | reuse across all four (basin/PP/MB add new modules) |
| test-engine parity harness | BUILT | extend per new engine module |
| Map/Logs/Correlation/Property viewers + WebGL 3D | BUILT | reuse in Well Delivery (striplog/geosteering) + Reservoir (maps) |
| Knowledge graph + extraction studio | BUILT | the contextual data graph (Reservoir §D) |
| Cosmonaut deterministic router + M4 governance wall | BUILT/SPEC | the grounded agents (Reservoir §E), tier ladder |
| Shell (drawer/verticals/mobile) | BUILT | the four-app container |
| wb data pipeline + Volve mirror | BUILT | reuse; add WITSML(drilling)/production surveillance feeds |
| MapLibre/deck.gl, PostGIS/Supabase, Python workers | NOT yet | add per §8 shared stack (currently client-side canvas + wb JSON) |

## 9 · Shared stack (target)
React/TS/Vite (have); MapLibre GL + deck.gl/three (have three; add MapLibre/deck.gl for geospatial); Plotly/ECharts/D3/visx charts; Supabase Postgres + PostGIS + RLS + object storage + immutable runs/audit (currently local wb JSON — migrate when multi-user); Python workers for MC/basin/PP/MBAL/optimization (currently JS/TS — fine at screening scale); interfaces LAS/CSV/Parquet/SEG-Y/WITSML/GeoJSON, **OSDU-aligned metadata (not full OSDU)** — matches our current stance. DLIS/ZGY/RESQML/Eclipse-import later.

## 10 · Next deliverables (queued)
`GEAVISION_CANONICAL_DATA_MODEL.md` (extend M1 → §2 primitives + run/evidence schemas) · `GEAVISION_APP_HANDOFF_CONTRACTS.md` (typed §7 objects) · `GEAVISION_EXPLORATION_MVP.md` / `_WELL_DELIVERY_MVP.md` / `_RESERVOIR_MANAGEMENT_MVP.md` (smallest vertical slices per §11 acceptance) · SQL migration proposal · route/nav proposal (verticals already exist) · risk register. Field Development stays as-is (contracts only).

## 11 · Acceptance (platform)
Four apps stay separated · existing Field Dev preserved · every value has an evidence state · deterministic results reproducible · runs record inputs/method/engine/version · missing data visible not fabricated · agent actions permissioned+auditable · cross-app handoffs explicit. (Per-app MVP acceptance in the MVP docs.)
