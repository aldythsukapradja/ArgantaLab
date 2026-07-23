# Exploration Platform Architecture — Worldwide, Multi-Field

2026-07-23 · Opus. The architecture that turns Exploration from a **single-field Volve demo** into a **worldwide exploration platform**. Sits under [GEAVISION_FOUR_APPS_ARCHITECTURE](geavision/GEAVISION_FOUR_APPS_ARCHITECTURE.md) (doctrine, canonical primitives, shared stack) and supersedes the single-field framing of [EXPLORATION-CONCEPT](EXPLORATION-CONCEPT.md) (which becomes the *Volve reference project* + the teaching/calibration layer, not the product).

---

## 0 · The problem this fixes

The first Exploration build (7 COSMO tabs) is a beautifully evidence-tagged **replay of Volve** — and a working explorationist would not use it. Five structural reasons:

1. **It replays a known answer.** Exploration is the discipline of the *undrilled unknown*; Volve is a closed-out discovery. The tabs describe an answer that already exists.
2. **Welded to one field.** Everything reads `public/wb/*`. No way to bring a basin, a well, a surface — or to **create a prospect**.
3. **Fake prospects, hardcoded risk.** The leads and GCoS are invented constants. Nothing is digitized from evidence.
4. **Field-Dev volumes masquerading as exploration.** "Exploration Volumetrics" uses Volve's fully-mapped 142 MMSm³ closure — a development number. Pre-drill you have a fuzzy lead outline, not a mapped field.
5. **A vendor menu, not a workflow.** The tabs mirror the Petrel/GeoX menu bar instead of the explorer's decision pipeline.

**The reframe:** the unit of the platform is not *Volve* — it is a **Project** (basin/area) and a **Prospect** (opportunity). Volve is **project #1**: the reference implementation, the first calibration point, and the seed of the analogue library. "Worldwide" means value that **compounds with every field added** — the one thing a single-field tool, and even a per-field seat of Petrel, cannot do.

**North-star acceptance:** *a new basin/field can be imported, its prospects created, risked, and ranked in the global portfolio — with **zero code changes**, only a project bundle + config.* If adding field #2 needs a code edit, the architecture has failed.

---

## 1 · The exploration data model (the spine that makes it worldwide)

Extends the four-app canonical primitives (§2 there) with the exploration-specific hierarchy. Every object carries `dataNature` (measured|reported|interpreted|derived|forecast|scenario), full `provenance` (source·version·method·engine·author·time·units·CRS·geometry), `projectId`, and `version/supersededBy`.

**Geologic/commercial hierarchy — the "where" (a risk & value tree):**
```
Region → Basin → PetroleumSystem → Play → License/Block
                                     └→ Lead → Prospect → Segment
```
- **Play** is a *risk unit* (a reservoir–seal–charge fairway); prospects in a play share **common risk**.
- **Lead → Prospect → Segment** is the GeoX maturation chain; maturity is a first-class state with evidence gates.

**Evidence objects — the "what you know" (measured/interpreted):**
`Well(+Wellbore, LogSet, FormationTop, PressureTest, FluidSample)` · `SeismicSurvey(2D lines | 3D ref)` · `Horizon` · `Fault` · `AttributeMap` · `Surface/DepthGrid` · `CultureLayer(GIS)` · `Analogue`.

**Interpretation & decision objects — the "what you conclude" (derived/scenario):**
`PlayElementAssessment` (source·reservoir·seal·trap·migration·timing, each a CRS map + chance) · `ProspectClosure` (digitized polygon on a horizon + contact → GRV) · `VolumetricCase` (deterministic + MC inputs/distributions) · `RiskModel` (GCoS factors + dependency structure → POS) · `EconomicCase` (EMV inputs) · `Decision` (drill/appraise/drop) · `WellProposal` (→ Field Dev handoff) · `Outcome` (post-well actual → calibration).

**Project = the container/tenant.** A Project scopes a working area (a basin, a licence round, an asset). Volve = Project *"Volve · Sleipner Terrace, Viking Graben."* Users create/import projects; the portfolio spans all of them.

---

## 2 · The Project Data Bundle (generalize `/wb`, the key to no-code multi-field)

Today's `public/wb/*` (index + per-object JSON, quantized grids, GVSURF) is already a clean per-field bundle. **Promote it to the platform's interchange format** so every field is just another bundle:

```
projects/<slug>/
  project.json        # id, name, CRS, datum, units, basin, play refs, bbox, provenance
  wells/…             # LAS-derived logs, deviation, tops, tests  (measured)
  surfaces/…          # depth grids (ZMap/IRAP/GVSURF)            (interpreted)
  seismic/…           # 2D line geometry, horizon picks, attribute maps
  culture/…           # GeoJSON licences, coastlines, infrastructure
  analogues/…         # quantitative reference reservoirs
  objects/…           # user-created leads/prospects/closures/cases (mutable, versioned)
  index.json          # manifest + counts + validation + provenance
```
- **Volve's existing `/wb` bundle maps in unchanged** as `projects/volve/`.
- **Ingestion = producing a bundle**, via importers (below). Adding field #2 touches *data*, never *components*. The app loads a project by slug; a **project switcher** selects the active one; the portfolio reads all manifests.

**Ingestion contract (bring-your-own-data):** LAS 2.0/3.0 · deviation (CSV/WITSML) · tops (CSV) · surfaces (ZMap+/IRAP/GRI) · GIS (GeoJSON/shapefile) · seismic *horizons + attribute maps* first (defer heavy 3D SEG-Y volumes) · analogues (CSV/table). Each import **stamps provenance, CRS, units, dataNature** and runs validation (units sane, CRS present, geometry closed). Missing data is surfaced, never fabricated — doctrine holds at ingest.

---

## 3 · Reframed surfaces: honor the COSMO tabs, change what they operate on

The founder's `TAB_SPECS.exploration` stays the canonical per-project workspace — **but every tab now operates on the *active Project's real data + user-created objects*, not baked Volve** — and we add the two things an explorer actually lives in.

**NEW · Ventures / Portfolio (the explorer's home, above the tabs):**
The worldwide prospect inventory — every lead/prospect across every project, ranked by EMV · risk · maturity · drill-readiness, filterable by basin/play/status, on a world map + portfolio table. Project switcher lives here. *This is the surface that makes "worldwide" tangible and is impossible for a single-field tool.*

**Per-project workspace (the 8 COSMO tabs, re-pointed):**
| Tab | New semantics (project-scoped, object-creating) |
|---|---|
| **Overview** | Per-project decision cockpit over *this project's* prospects & evidence maturity |
| **Basemap** | Project GIS/wells/surveys/prospect outlines; **draw a lead/prospect polygon** |
| **Seismic** | Horizon/attribute interpretation (2D + attribute maps first); closure detection |
| **Wells** | The project's real wells (measured), correlation, prognosis-vs-actual |
| **Interpretation** | Create points/polylines/polygons/surfaces; **digitize a closure** on a horizon |
| **Plays & Prospects** | Play-element CRS maps + **Lead→Prospect→Drill-ready maturation**, GCoS *from evidence* |
| **Volumetrics** | Area-depth GRV on the **user's digitized closure** + probabilistic P90/50/10 (not the baked field) |
| **Risk & Uncertainty** | GCoS decomposition, **prospect dependency** within a play, tornado, portfolio roll-up |

**Seismic stops being a spec stub; Volumetrics stops using the mapped field; every prospect is user-created and editable.** That is the difference between a tool and a museum.

---

## 4 · The moat: cross-field intelligence (only possible worldwide)

The reason to build this at all — network effects across fields, which no per-field seat delivers:

- **Analogue engine** (extend `src/engine/analog.ts`): match a prospect/play to reference analogues by depositional system, age, depth, trap type, reservoir quality → **deterministic similarity score**; analogue distributions seed volumetric priors when local data is thin. LLM *explains* the match; the engine *scores* it. Richer with every field added.
- **Creaming & Yet-to-Find** (`creaming.ts`): per basin/play cumulative-discovery curve from the *portfolio's own* discoveries; parabolic/fractal YTF with honest caveats.
- **Portfolio EMV with dependency**: aggregate EMV across prospects sharing play-level common risk (not naive independence) → a *ranked, risk-aware drill queue* across basins.
- **Calibration library**: every closed-out field contributes a **pre-drill vs actual** data point. **Volve is calibration entry #1** — the teaching payload from the concept doc becomes the platform's *risk-calibration training set*: "are our POS estimates well-calibrated across N fields?"

---

## 5 · Engines — reuse, don't rebuild

`explore.ts` (GCoS/MC/EMV/rank) and the V1 core (`mc/volumetrics/closure/econ/grid/view/contour`) are the deterministic backbone and **survive intact** — they just run on project objects instead of constants. Add, per the concept doc, only: `basin.ts` (1D burial + EasyRo maturity + charge-timing), `analog.ts` scorer extension, `creaming.ts`. Every new module gets a `test-engine.mjs` parity block (the existing 46/46 gate). Deterministic ownership and the LLM governance wall are unchanged.

---

## 6 · Storage & scale path

- **Now (zero backend):** multiple local project bundles (JSON, like `/wb`), client-side; project switcher; portfolio reads manifests. Ships immediately, proves multi-field.
- **Next (multi-user):** Supabase **Postgres + PostGIS** (geometries: closures, faults, culture) + object storage (bundles, seismic, surfaces) + **RLS** (multi-tenant projects) + immutable `run`/`audit` tables. Matches four-app §9.
- **Heavy compute later:** Python/edge workers for SEG-Y, large MC ensembles, basin modeling. Screening-grade JS/TS is fine until then.

---

## 7 · Build order (each step ships value; multi-field proven early)

- **P0 · Project abstraction.** Introduce Project + bundle loader + project switcher. Refactor Volve → `projects/volve/`. **Prospects become project objects (creatable/editable), not hardcoded constants.** *(This alone kills the "fake data" critique.)*
- **P1 · Second field.** Import a real public dataset as project #2 (e.g. Norwegian **Diskos** or Dutch **NLOG** open field) → the Portfolio/Ventures home lights up. **Proves the north-star acceptance.**
- **P2 · Prospect-creation loop.** Digitize a closure on Basemap/Interpretation → area-depth GRV → MC P90/50/10 → GCoS from evidence → save a Prospect → rank in portfolio. The core explorer workflow, end-to-end, on any project.
- **P3 · Cross-field intelligence.** Analogue scorer + creaming/YTF + portfolio dependency + calibration library (Volve = entry #1).
- **P4 · Seismic + basin modeling.** Horizon/attribute ingestion; `basin.ts` maturity & charge timing.
- **P5 · Backend + agent.** Supabase/PostGIS migration; grounded exploration agent (retrieves evidence across the portfolio, drafts prospect evaluations, suggests analogues — never invents truth).

---

## 8 · What survives from the current build

| Asset | Verdict |
|---|---|
| `explore.ts` (GCoS/MC/EMV/rank) + parity tests | **Keep** — runs on project objects |
| The 8 COSMO tabs + shell wiring + `exploration.css` | **Keep** — re-point to active project |
| Evidence/data-nature spine, provenance chips | **Keep** — the differentiator, extend to all objects |
| `explData.ts` PROSPECTS/STRAT/PS constants | **Demote** → seed the `projects/volve/` bundle, not app code |
| Volumetrics using the mapped Volve closure | **Change** → user-digitized closure |
| Seismic spec stub | **Build** → real horizon/attribute interpretation |
| Hardcoded single-field tree | **Generalize** → project-scoped explorer |

---

## 9 · Risks

- **Scope creep toward Petrel.** Mitigation: screening/teaching grade, deterministic + auditable, defer 3D SEG-Y/migration/FEA (per concept-doc scope fences).
- **Data heterogeneity worldwide** (CRS, units, vintages). Mitigation: the bundle contract + validation + provenance stamping at ingest; missing > fabricated.
- **Analogue quality.** Mitigation: cited, quantitative, deterministic scorer; analogues are labeled interpreted/reported, never presented as local measurement.
- **Backend timing.** Mitigation: bundle-first (no backend) ships value; migrate to Supabase/PostGIS only when multi-user demands it.

---

## 10 · Acceptance

1. **No-code field #2** — a new field works end-to-end from a bundle alone.
2. **User-created prospects** — a geologist digitizes and risks their own prospect; nothing hardcoded.
3. **Portfolio across basins** — leads/prospects from ≥2 fields ranked together by EMV/risk/maturity.
4. **Evidence-native everywhere** — every value carries dataNature + provenance; missing data visible.
5. **Compounding intelligence** — analogue/creaming/calibration improve as fields are added.
6. **Doctrine intact** — deterministic engines own numbers; LLM retrieves/drafts/explains, never invents; every run auditable.
