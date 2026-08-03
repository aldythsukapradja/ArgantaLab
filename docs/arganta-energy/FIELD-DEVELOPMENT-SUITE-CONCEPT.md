# The Field Development Suite — Full Concept

2026-08-02 · Opus (rev. same-day: **maturity perspective** — Explore·Appraise·Develop·Produce·Rejuvenate·Retire — added as the second axis, §1.3–§1.5). A **ground-up rewrite** of the Field Development lifecycle, shell first. The current 13 tabs move to **Legacy**. Field Development becomes the **decision spine that turns subsurface evidence into a committed set of wells** — worldwide, on any basin/field/country, at **any stage of asset life**, grounded on the same OSDU/ATLAS system-of-record as [EXPLORATION-SUITE-CONCEPT](EXPLORATION-SUITE-CONCEPT.md) (locked).

**Two agnosticisms, not one.** *Agnostic to place* (§5 — any of ~7,787 catalogued fields, defaults from the analog library) and *agnostic to maturity* (§1.3 — a frontier discovery and a 30-year-old producing field run through the same ten tabs). The second is the harder one and the schema already supports it.

Sibling contract: Exploration ends where this begins. This document defines **the three seams** — Exploration → Development → Well Delivery/Drilling → Reservoir Management → back — as typed, versioned artifacts rather than the localStorage bridges in place today.

Realizes [M7-FIELD-DEVELOPMENT-PLANNER-CONCEPT](M7-FIELD-DEVELOPMENT-PLANNER-CONCEPT.md) §2.2–2.9 and [M7-HARDENING-PLAN](M7-HARDENING-PLAN.md) §2–§3 as a software suite; supersedes the tab layout in [GEAVISION-FIELDDEV-COSMO-PLAN](GEAVISION-FIELDDEV-COSMO-PLAN.md).

---

## Part 0 · Diagnosis — what we actually have

Evidence, not opinion. Three findings drive every decision below.

**0.1 The current FD tab is a subsurface workbench, not a planner.** The 13 live tabs (`CosmoShell.tsx:74-82`) are 8 modeling viewers + 4 evaluation + 1 review. Grepping `src/` for `wellCount · spacing · facility · phasing · drill centre · tieback · concept` returns nothing. The only "FDP" that exists is four hand-written options in `FieldReview.tsx:48-53` scored by `engine/review.ts:evaluateFdp`. **M7 §2.2–2.8 is entirely unbuilt.**

**0.2 Volve is not a default — it is load-bearing.** ~40 hardcoded literals across the FD tabs: `PRODUCERS = ['F-1 C','F-5',…]`, `owc ?? 3200`, `/Hugin/i`, `loadSurface('hugin_top')`, `RESERVOIR_K = 500`, the `ACTIVE FIELD · VOLVE · NORTH SEA` footer. `src/wb/load.ts` fetches a path-constant `/wb` with no field slug. Field #2 currently requires a code edit — the explicit failure condition in [EXPLORATION-PLATFORM-ARCHITECTURE](EXPLORATION-PLATFORM-ARCHITECTURE.md):19.

**0.3 The seams don't exist, and one is broken in a way that reads as working.**

| Seam | State |
|---|---|
| Exploration → Field Dev | **None.** No shared store, no types. Exploration computes GCoS/EMV in React state and discards on unmount. |
| Field Dev → Well Delivery | **None.** WD self-generates 4 hardcoded candidates from `/wb` anchors + arithmetic offsets (`wdData.ts:buildPortfolio`). |
| Well Delivery → Drilling | **Broken.** `emitToDrillingSequence()` writes 4 fields to `energy_drilling_sequence_v1`; `buildSchedule()` reaches them only via `approved.find(…)` over `energy_well_proposals_v1`, which has **no writer**. Sanctioning a well changes nothing on the Gantt. |
| Well Delivery → Reservoir Mgmt | **Write-only.** `energy_wd_rm_handover_v1` has no reader. |
| Reservoir Mgmt → Field Dev | **Hardcoded literal** `FdpOption[]` duplicated in `Opportunities.tsx:11` and `FieldReview.tsx:48`. |

Drilling therefore synthesizes everything it needs: rig lanes hardcoded to 2, spud dates = `today()` + cursor, durations = `22 + tdMd/4000*26`, sequence = "injectors first then by TD", maturation gate = a tercile split of the queue index. `earliestStart` and `dependencies[]` are the only scheduling-constraint slots in the entire codebase and both are hardcoded `null` / `[]` at every write site.

> **Conclusion:** this is not a UI revamp. It is building the planner for the first time, on a spine that does not yet exist, with the existing workbench parked behind it.

---

## Part 1 · The mental model

### 1.1 The lifecycle is three verbs, not three apps

```
EXPLORATION          FIELD DEVELOPMENT              WELL DELIVERY · DRILLING
  what is there?        what do we build?              when, with what, by whom?
  ─────────────         ─────────────────              ────────────────────────
  reduces               chooses a DESIGN               commits a SCHEDULE
  UNCERTAINTY           under CONSTRAINTS              against CAPACITY
      │                        │                              │
  produces                 produces                       produces
  DISTRIBUTIONS  ───────►  PLANNED WELLS  ───────────►   DATED ACTIVITIES
  (P10/50/90)              (+ sequence,                  (rig × time)
                            + dependencies)
                                                              │
  ◄──────────────── CALIBRATION ◄──────────────────  RESERVOIR MGMT
                    (actuals vs plan)                  produces ACTUALS
```

Exploration hands over *ranges*. Development's whole job is to convert ranges into **one committed design plus an honest band around it**. Drilling's job is to put that design on a calendar. Everything downstream of Development is scheduling; everything upstream is uncertainty. **Field Development is the only vertical that makes an irreversible choice.** That is what the UI must be shaped around.

### 1.2 Three planes — the standing mental model

Every screen in the suite answers exactly one of these, and the shell shows all three at once:

| Plane | Question | Owner | Persisted as |
|---|---|---|---|
| **WHERE** | Which piece of the world? | The **Scope** (shared with Exploration — one control, not two) | ATLAS/OSDU record IDs |
| **WHAT** | Which version of the plan? | The **Case** (`DevelopmentCase`, versioned, comparable) | OSDU WPC |
| **HOW DO WE KNOW** | Where did this number come from and is it still valid? | The **Artifact DAG** (lineage · provenance · staleness) | artifact edges + `dataNature` |

Exploration has WHERE and HOW-DO-WE-KNOW. Development adds **WHAT** — because unlike a study, a plan has *rivals*. Concept A vs Concept B vs do-nothing is the essence of the discipline, so **the Case is a first-class, comparable, forkable object**, not a view setting.

### 1.3 The maturity perspective — Explore · Appraise · Develop · Produce · Rejuvenate · Retire

§1.1 reads as a greenfield pipeline: discovery → FID → drill. That is a trap. Most of the world's fields are already producing, and **Volve itself was decommissioned in 2016** — we have been using a *brownfield* asset as a *greenfield* demo. An agnostic ArgantaEnergy needs a second axis: **where in life is this asset?**

**That axis is already in the data model.** `src/atlas/types.ts:16-19` declares SPE-PRMS resource maturity as a first-class fact dimension, and `EdgeKind` (`types.ts:25`) already carries the verb `'matures-to'`. PRMS *is* the maturity ladder — the industry's own. So the perspective is not a UI mode bolted on the side; it is **the PRMS class of everything the case produces**, promoted from a `FactDims` field to a shell control.

| Perspective | PRMS class · category | Dominant question | Primary vertical | Baseline |
|---|---|---|---|---|
| **Explore** | prospective · 1U/2U/3U | Is there anything? Drill or drop. | Exploration | — |
| **Appraise** | contingent · 1C/2C/3C | Is it commercial? Appraise, sanction, or drop. | Exploration ⟷ Field Dev | none (full-cycle) |
| **Develop** | reserves · 1P/2P/3P | What do we build, and is it worth it? | **Field Development** | none (full-cycle) |
| **Produce** | production | Are we on plan? Where's the gap? | Reservoir Mgmt | current plan |
| **Rejuvenate** | reserves + contingent | Infill, IOR, EOR, or nothing? | Field Dev ⟷ Reservoir Mgmt | **producing case** |
| **Retire** | unrecoverable | When to cease? Which decom concept? | Field Dev ⟷ Reservoir Mgmt | **producing case** |

Two consequences worth stating plainly:

- **The perspective decides which vertical is foregrounded.** It is the app's answer to *"where should I be right now?"* — so it is a shell-wide control, not a Field Development one. That makes all of ArgantaEnergy agnostic, not just this suite.
- **It is auto-detected, not chosen blind.** `FieldMasterRecord` already carries `status`, `statusDetail`, `discoveryYear`, `fidYear`, `startYear`, parsed from GOGET for 8,032 fields (`src/atlas/goget.ts:29-36`, `:119-126`). Select a field → the perspective is inferred (discovery year but no `startYear` → **Appraise**; `startYear` + declining history → **Rejuvenate**; Volve → **Retire**). The user can override, and an override is itself a scenario — *"what if we had developed this in 1995?"*

> **Amendment note:** this adds a sibling control to the shell shared with [EXPLORATION-SUITE-CONCEPT](EXPLORATION-SUITE-CONCEPT.md) (locked). It is additive — Exploration's 10 tabs, its DAG and its acceptance criteria are unchanged; Exploration simply operates at the `Explore`/`Appraise` end of the same ladder.

### 1.4 Brownfield = greenfield with a non-zero baseline

The seductive mistake is to build a second "Redevelopment" vertical. **Don't.** The physics is identical — GRV, PI, spacing, pattern, decline, NPV. What changes is the *baseline*:

```
DevelopmentCase.baseline: caseId | null
```

- **`null` → full-cycle.** Everything the case builds is counted. (Explore · Appraise · Develop)
- **set → incremental.** Every artifact is a *difference* against the baseline case. (Produce · Rejuvenate · Retire)

This is exactly the industry's full-cycle vs incremental economics distinction, and it means **one engine set, not two**. The `'Do nothing (abandon)'` option currently hardcoded at `FieldReview.tsx:48` stops being a row in a list and becomes the **structural baseline**.

**The code is already brownfield-shaped — greenfield is the missing half.** `engine/review.ts` (`incrementalAnnualBbl` · `evaluateFdp` · `recoveryTiming` · `breakEven(facilityReentryMM)` · `expCumToLimit`) is an incremental brownfield evaluator built on Volve's real decline history, and `dca.ts` fits Arps to existing production. The one FDP engine that exists is a *brownfield* engine. Meanwhile build-up/plateau/ramp — the greenfield half — does not exist anywhere. Agnostic is not a detour from what's built; it is a completion of it.

### 1.5 What the perspective changes, tab by tab

Same ten tabs, same artifacts, same engines. The **option set and the objective** switch:

| Tab | Full-cycle (Appraise · Develop) | Incremental (Rejuvenate · Retire) |
|---|---|---|
| 2 Subsurface Case | volumes from Exploration handoff | volumes from **history match + remaining-oil map** (Seam A′) |
| 3 Appraisal & VOI | which appraisal well kills most uncertainty | which **surveillance** buys most: PLT · tracer · 4D · pilot hole |
| 4 Concept Select | onshore/offshore · standalone/tieback/FPSO | **constrained by the existing host**: debottleneck · expand · tie-in · new host · cease |
| 5 Recovery & Pattern | select drive + pattern from scratch | **change** mechanism: waterflood → WAG/polymer/EOR; pattern conversion |
| 6 Well Design | full-field pattern layout from zero | **infill targeting** against bypassed pay; re-entries, sidetracks, workovers |
| 7 Facilities | size the plant to plateau | **debottleneck** against installed capacity + water-handling limit |
| 8 Forecast | build-up → plateau → decline (type curve / analog) | **decline from real history + uplift**, blind-tested |
| 9 Schedule | first oil, ramp, rig campaign | slot availability, shutdown windows, **rig on an operating field** |
| 10 Value | full-cycle NPV/IRR from FID | **incremental NPV vs baseline**, economic limit, decom liability |

Not one of these needs a new engine — E1–E8 in M7-HARDENING §3 cover both columns. What differs is the **option generator** feeding each engine, and for the incremental column that generator reads the *existing* facility, well stock and production history.

### 1.6 The join key — the single idea that makes the spine real

> **A planned well is an OSDU `Well` master-data record in `Planned` state, minted by Field Development, from birth.**

Not a `WdCandidate` in localStorage. Not a `WellProposal` in another localStorage key. Not a `WellGeo` synthesized from `/wb`. **One record**, whose `status` advances along the lifecycle and whose ancestry accumulates:

```
Planned ──► Proposed ──► Sanctioned ──► Scheduled ──► Spudded ──► Drilled ──► Producing
   │            │             │              │            │           │           │
  FD          Well          FD/WD        Drilling        WD          WD          RM
 mints       Delivery       (FID)        Sequence      steering    debrief    surveillance
```

Every downstream vertical becomes a **different view of the same record**, filtered by state:
- Well Delivery = the record in `Proposed`–`Sanctioned`, with design detail attached.
- Drilling Sequence = the record in `Sanctioned`–`Scheduled`, laid on a rig lane.
- Reservoir Mgmt = the record in `Producing`, with a performance series attached.

**All five localStorage bridges (`energy_wd_candidates_v2`, `energy_well_proposals_v1`, `energy_drilling_sequence_v1`, `energy_drilling_revisions_v1`, `energy_wd_rm_handover_v1`) die.** They exist only because there was no shared identity. Once the planned well is an OSDU record, the handoffs are queries, not messages.

This also resolves Drilling's semantic bug: today `buildSchedule()` schedules all 24 real Volve wells as if undrilled, because it cannot distinguish planned from historical. With a state on the record, it can.

---

## Part 2 · The spine

One sentence:

> **Scope selects a Field from the world catalogue; its PRMS maturity sets the perspective; the Field's evidence (bundle → regulator → analog cohort, or production history if brownfield) fills a `SubsurfaceCase`; a `DevelopmentCase` — full-cycle or incremental against a baseline — transforms that case into `PlannedWell[]` + a `DevelopmentSchedule`; both are OSDU records that Well Delivery, Drilling and Reservoir Management read directly; actuals return as calibration.**

```
        ┌──────────────────────────── SCOPE (ATLAS 3-axis, shared w/ Exploration) ─┐
        │  geologic: World→Region→Basin→PetSys→AU→Play→FIELD→Reservoir             │
        │  well:     FIELD→Well→Wellbore→Segment→Interval→Completion               │
        │  commercial: Company · Licence · Asset                                   │
        └──────────────────────────────────────┬───────────────────────────────────┘
                                               │
        ┌────── PERSPECTIVE (PRMS maturity, auto-detected) ──────────────────────┐
        │  Explore · Appraise · Develop  →  baseline = null   (full-cycle)       │
        │  Produce · Rejuvenate · Retire →  baseline = case   (incremental)      │
        └──────────────────────────────────────┬─────────────────────────────────┘
                                               │
      EXPLORATION ─────── SubsurfaceHandoff ───┤    ◄── SEAM A  (full-cycle)
      (or ANALOG SYNTHESIS if no study)        │
      RESERVOIR MGMT ──── history · pressure ──┤    ◄── SEAM A′ (incremental)
      (remaining oil · bypassed pay)           │
                                               ▼
    ╔══════════════════════ DevelopmentCase (v.n) ════════════════════════════╗
    ║  1 AssetFrame ──► 2 SubsurfaceCase ──► 3 AppraisalProgram               ║
    ║                          │                                             ║
    ║                          ├──► 4 ConceptOption[] ──► Concept (selected)  ║
    ║                          │             │                               ║
    ║                          ├──► 5 RecoveryScheme ◄──┤                     ║
    ║                          │        │               │                     ║
    ║                          └──► 6 WellDesign ◄──────┤                     ║
    ║                                   │  PlannedWell[] · PatternGeometry    ║
    ║                                   ▼                                     ║
    ║                            7 FacilityCase · DrillCentre[]               ║
    ║                                   │                                     ║
    ║                                   ▼                                     ║
    ║                            8 ProductionProfile (P10/50/90)              ║
    ║                                   │                                     ║
    ║                                   ▼                                     ║
    ║                            9 DevelopmentSchedule · WellSequence         ║
    ║                                   │                                     ║
    ║                                   ▼                                     ║
    ║                           10 EconomicCase ──► FDPDocument               ║
    ╚═══════════════════════════════════╤═════════════════════════════════════╝
                                        │
              DevelopmentCommitment ────┤    ◄── SEAM B (typed, versioned)
                                        ▼
              WELL DELIVERY ────────► DRILLING SEQUENCE
                     │                      │
                     └──────► RESERVOIR MGMT ◄───────┘
                                        │
                          Calibration ──┤    ◄── SEAM C (closes the loop)
                                        ▼
                              ANALOG LIBRARY ──► feeds every future case
```

**The four anti-silo rules carry over verbatim from Exploration** (§2.3 there):
1. **No re-derivation.** Field Development never recomputes STOIIP. It consumes `VolumetricCase` by reference.
2. **Lineage is mandatory.** Every artifact names inputs (artifact IDs + OSDU record IDs), engine, version.
3. **Staleness propagates.** Change scope or any upstream artifact → all descendants flag `stale`.
4. **The FDP reads the DAG, not the tabs.** Nothing is authored twice.

Plus one rule Development needs that Exploration does not:

5. **Cases are forkable and comparable, never edited in place.** Changing a decision on a sanctioned case creates `v.n+1` with a diff. The FID record must be immutable.

---

## Part 3 · The data schema — how it uses ATLAS, OSDU and the knowledge base

### 3.1 The rule that decides where everything lives

> **Master Data = the world. Work-Product-Components = what we concluded about it.**

This is straight OSDU and it resolves every placement question:

| Thing | OSDU category | Kind |
|---|---|---|
| Field, Basin, Country, Licence, Company | **Master Data** | existing `osdu:wks:master-data--*` (18 mapped in `src/osdu/kinds.ts`) |
| **Planned well** | **Master Data** | `osdu:wks:master-data--Well:1.4.0` with `data.WellStatus = 'Planned'` + `tags['arganta:caseId']` |
| **Planned wellbore** | **Master Data** | `osdu:wks:master-data--Wellbore:1.5.1`, `Planned` |
| Development case, concepts, schedules, forecasts, economics | **WPC** | new `arganta:wks:work-product-component--*` (below) |
| The FDP itself | **Work Product** | `arganta:wks:work-product--FieldDevelopmentPlan:1.0.0` |

### 3.2 New `arganta:development:*` extension kinds

Mirrors the `arganta:exploration:*` set specified in EXPLORATION-SUITE-CONCEPT §2.1. Both inherit ACL/legal from the **already-implemented** `governanceFor(dataClass, countries)` in `src/osdu/kinds.ts:43` — so the sovereign/confidential lane works for plans exactly as it does for source data.

```
arganta:wks:work-product-component--DevelopmentCase:1.0.0      the container
arganta:wks:work-product-component--SubsurfaceCase:1.0.0       Seam A frozen
arganta:wks:work-product-component--AppraisalProgram:1.0.0
arganta:wks:work-product-component--ConceptOption:1.0.0
arganta:wks:work-product-component--RecoveryScheme:1.0.0
arganta:wks:work-product-component--WellDesign:1.0.0           count · spacing · type · PI
arganta:wks:work-product-component--PatternGeometry:1.0.0
arganta:wks:work-product-component--DrillCentre:1.0.0
arganta:wks:work-product-component--FacilityCase:1.0.0
arganta:wks:work-product-component--ProductionProfile:1.0.0
arganta:wks:work-product-component--DevelopmentSchedule:1.0.0  Seam B core
arganta:wks:work-product-component--EconomicCase:1.0.0
arganta:wks:work-product--FieldDevelopmentPlan:1.0.0           the deliverable
```

IDs mint through the existing `osduId()` (`src/osdu/adapter.ts:8`) → `arganta:work-product-component--DevelopmentCase:<slug>`. No new minting logic.

### 3.3 ATLAS — no new tiers, two new lenses

The 18-node spine (`src/atlas/spine.ts`) is **unchanged**. Development needs no new entity types because it produces WPCs, not master data — with one exception already present: `asset` (tier 18, commercial axis, `parent: 'field'`) is the natural owner of a `DevelopmentCase`.

Two additions to the read projection:
- **`lifecycleState` on well instances** — the join key from §1.6, surfaced as an ATLAS attribute so the hierarchy rail can show `Volve › 24 drilled · 6 planned`.
- **`prmsClass` promoted from `FactDims` to a resolved attribute on field instances** — the maturity perspective (§1.3), auto-inferred from `status`/`discoveryYear`/`fidYear`/`startYear` and overridable per case.
- **`dataDensity` badge per node** — already specified in EXPLORATION-SUITE-CONCEPT Part 3; Development reuses it to drive capability tiers (Part 5).

### 3.4 The artifact envelope — identical to Exploration's

Every Development artifact carries the same shape, so one lineage viewer, one staleness engine, one provenance chip serve both verticals:

```ts
{
  id, kind, caseId,
  producedBy: { tab, engine, version },
  inputs:     { artifactIds: string[], osduRecordIds: string[] },
  dataNature: 'measured' | 'interpreted' | 'derived' | 'reference' | 'scenario',
  basis:      'bundle' | 'regulator' | 'analog' | 'user' | 'engine',   // ← Development-specific
  provenance: { source, method, params, units, crs, author, time },
  value:      { p10, p50, p90 } | scalar | geometry,
  createdAt, supersededBy, stale
}
```

`basis` is the new field and it is the de-Volve mechanism (Part 5). `dataNature` already exists end-to-end (`src/atlas/types.ts:9`, stamped into every OSDU record's `tags`).

### 3.5 The knowledge layer

Three distinct things, often conflated:

| Layer | What it is | Where it lives | Doctrine |
|---|---|---|---|
| **Ontology** | `EntityType.ktype` → knowledge-base types, per [KNOWLEDGE-BASE-ONTOLOGY-CONCEPT](KNOWLEDGE-BASE-ONTOLOGY-CONCEPT.md) | `src/atlas/spine.ts` | structural; already built |
| **Analog / calibration library** | Every field on earth as a comparable, plus every post-drill actual | `engine/analog.ts` scaled from 12 seeds → 7,787 spatial fields | **owns every default value** |
| **Rules & heuristics** | Joshi PI, mobility ratio → pattern, drainage-area spacing, coning rules, step-out reach | new `engine/develop/*.ts` | deterministic, truth-locked |

**Doctrine, unchanged from Exploration:** deterministic engines own every number; the LLM retrieves, explains and drafts, never invents. The agent's tool surface is M7-HARDENING §7's signatures — `frameVolumes · placeAppraisal · sizeDevelopment · pickWellType · pickPattern · layoutDrillCentres · phasePlan · economics` — each a call into a truth-locked engine.

---

## Part 4 · The three seams — typed contracts

GEAVISION §7 names these objects but the typed versions (`GEAVISION_APP_HANDOFF_CONTRACTS.md`) were never written. This is that specification.

### SEAM A · Exploration → Development: `SubsurfaceHandoff`

```
Discovery · ResourceDistributions · Contacts · StructuralScenarios
FaciesPriors · FluidScenarios · PetrophysicalUncertainty · DevelopmentConstraints
```

**The critical rule that unlocks worldwide operation:**

> The handoff object **always exists**. If an Exploration study covers the scope, it is resolved by reference (`basis: 'bundle'|'regulator'`). If not — you picked a field in Angola with nothing but a GOGET row — it is **synthesized from the analog cohort** (`basis: 'analog'`, `dataNature: 'derived'`), with visibly wide P10–P90 and `n = <cohort size>` on the chip.

So Development never blocks on Exploration. It degrades, visibly, and tightens as evidence arrives. This is M7-HARDENING §2's acceptance criterion made structural: *"the planner runs on the area + a play type alone, and tightens as inputs are added — the range visibly narrows."*

**Seam A′ · Reservoir Management → Development (the brownfield input path).** For `Rejuvenate` and `Retire` (§1.3), the dominant subsurface input is not an Exploration handoff — it is **production history, pressure, VRR and remaining-oil distribution**, i.e. Reservoir Management's output. So `SubsurfaceCase` has **two upstream sources**, selected by perspective:

| Perspective | Source | `basis` |
|---|---|---|
| Explore · Appraise · Develop | Exploration `VolumetricCase` · `StructuralScenarios` · `FaciesPriors` | `bundle` / `regulator` / `analog` |
| Produce · Rejuvenate · Retire | Reservoir Mgmt `RMWellSeries` · history match · pressure · VRR · bypassed pay | `measured` |

This is a correction to GEAVISION §7, which lists Reservoir Mgmt → Exploration/Dev as *lessons learned* only. In an agnostic app it is a **primary forward path**, not a back-loop — and it is the one seam where the data is already real (`src/tabs/reservoir/data.ts:loadRMData` reads genuine Volve production, injection and pressure).

### SEAM B · Development → Well Delivery / Drilling: `DevelopmentCommitment`

```
ApprovedTargets · TrajectoryCorridors · LandingWindows · CompletionObjectives
ReservoirUncertainty · PressureAssumptions · WellSequence · DevelopmentConstraints
```

The atom is `PlannedWell`, designed as the **superset** of what both downstream verticals currently synthesize — `WdCandidate.target` + `.trajectory` (WD `types.ts`), `WellGeo` + `ScheduleActivity` + `DrillingScheduleItem` (Drilling `schedule-model.ts`, `proposal-types.ts`):

| Group | Fields | Kills today's fake |
|---|---|---|
| identity | `osduWellId · name · caseId · lifecycleState` | the 3-key localStorage mismatch |
| target | `formation · reservoir · x · y · tvdss · md · anchorRecordIds[]` | `anchorA.x + 420` |
| role | `role(producer/injector/observer) · wellType(OP/WI/WD) · kind(Dev/App/WO)` | hardcoded 3P+1I |
| trajectory | `surfaceX/Y · drillCentreId · slot · kopMd · tdMd · tdTvd · maxIncl · maxDls · corridor` | `target.x - 620` template |
| **sequence** | **`earliestStart · dependencies[] · phaseId · priority`** | **no producer exists today** |
| **duration** | **`days: {p10,p50,p90}` · `rigClass`** | `22 + tdMd/4000*26` |
| maturity | `gate(SOR0…APPROVED) · basis · dataNature` | tercile split of queue index |
| objective | `objective · successCriteria[] · completionIntent · dataAcquisition[]` | hardcoded literal arrays |

Plus `RigDemand` at the case level (count · class · spread · window), which replaces Drilling's hardcoded 2 lanes.

**Acceptance for this seam:** sanction a well in Field Development → it appears on the Drilling Gantt, on the right rig, at a date derived from a real dependency chain. That is the single sharpest demo of the whole rebuild, and it is currently impossible.

### SEAM C · Reservoir Mgmt → Development: `Calibration`

```
ActualPerformance · UpdatedPressure · UpdatedSaturation · WellResponse
InterventionOutcomes · LessonsLearned
```

Keyed by ATLAS field ID, written into the analog library. **Every plan is a hypothesis; every actual is a test.** This is the cross-field calibration moat — and `engine/analog.ts` already has `crossValidate` and `optimalPhysicsWeight` waiting for it.

---

## Part 5 · De-Volve — capability tiers and the default ladder

The reason the app is welded to Volve is not laziness; it is that **there was no fallback**. Remove the fallback problem and the welding dissolves.

### 5.1 Capability tiers — what you get at each data density

| Tier | Source | You have | Suite behaviour |
|---|---|---|---|
| **T0 Breadth** | GOGET · USGS AU · world DB (7,787 spatial fields) | name, location, basin, operator, status, fuel, on/offshore, sometimes discovery year & reserves | **Full plan card, analog-derived, wide bands.** Every tab renders. |
| **T1 Regulator** | NSR (Sodir/NSTA) · ANP · national overlays | field outline, licence, wellbore list, production history | Real geometry, real well count, history-matched decline. Bands narrow. |
| **T2 Deep bundle** | `projects/<slug>/` (Volve = #1) | logs, tops, surfaces, trajectories, PVT, patterns, sim deck | Every engine at full fidelity; petrophysics-driven, grid-driven. |

**No tab is ever hidden or blank.** A tab below its ideal tier runs in analog mode with a visible badge. Missing data is *visible*, never faked — the doctrine already enforced in Exploration Part 3.

### 5.2 The default ladder — every number, three possible origins

```
  USER OVERRIDE   ──┐
                    ├──►  the number you see, with a chip saying which won
  MEASURED (bundle) ─┤
                    │
  ANALOG (cohort)  ──┘
```

Chip vocabulary, one component reused everywhere: **`M`** measured · **`R`** regulator · **`A`** analog (`n=…`) · **`U`** user · **`D`** derived. Plus a staleness dot. Hover → the lineage card.

This is the whole de-Volve strategy in one sentence: **the world database is not just breadth for browsing — it is the default-value engine that lets any field on earth be planned.** `engine/analog.ts` is promoted from a FieldReview helper to the suite's foundation.

### 5.3 Project bundles

`/wb` generalizes to `projects/<slug>/` per EXPLORATION-PLATFORM-ARCHITECTURE §2. `src/wb/load.ts`'s path-constant `BASE = ${BASE_URL}wb` becomes `projects/${slug}`. Volve's bundle maps in unchanged as `projects/volve/`. `DetailBundle` (`src/atlas/types.ts:161`) is already the declared contract, with `fieldId` as "the only required bridge".

**Acceptance: adding field #2 is dropping a bundle. If it needs a code edit, the architecture has failed.**

---

## Part 6 · The 10 sub-tabs

Left-to-right = the decision workflow = the FDP order. Each tab clones one industry tool and produces named artifacts. Symmetric with Exploration's 10.

| # | Sub-tab | Phase | Clones | Produces | Engine (M7 ref) |
|---|---|---|---|---|---|
| 1 | **Asset** | Frame | WoodMac · Rystad · IHS asset screen | `AssetFrame` · `AnalogCohort` · benchmark position | `analog.ts` (scaled) |
| 2 | **Subsurface Case** | Frame | Petrel/RMS handoff review | `SubsurfaceCase` — **Seam A receiver**; uncertainty inventory; what's measured vs analog | E1 volumetrics (reuse) |
| 3 | **Appraisal & VOI** | Reduce | GeoX · decision analysis | `AppraisalProgram` — N wells, location, objective, expected uncertainty reduction | **E2 new** (§2.2) |
| 4 | **Concept Select** | Design | Merak · Aspen concept screening | `ConceptOption[]` → `Concept` — onshore/offshore, standalone/tieback/FPSO, export | **new** (§2.3) |
| 5 | **Recovery & Pattern** | Design | Eclipse/IX + engineering judgment | `RecoveryScheme` — drive, depletion/waterflood/gas/EOR, mobility ratio, pattern, I:P, sweep | **E5 new** (§2.6) · `sim/streamline.ts` (reuse) |
| 6 | **Well Design** | Design | Petrel well design · drainage analysis | `WellDesign` · `PatternGeometry` · **`PlannedWell[]`** — count, spacing, type, Joshi PI, targets | **E3+E4 new** (§2.4–2.5) |
| 7 | **Facilities & Drill Centres** | Design | HYSYS-lite · facility sizing | `FacilityCase` · `DrillCentre[]` — plateau→capacity, water/gas handling, step-out reach, tieback | **E6 new** (§2.7) |
| 8 | **Forecast** | Predict | IX/Eclipse · Aries | `ProductionProfile` P10/50/90 — build-up → plateau → decline, per well and field | `dca.ts` · `review.ts` · `sim/fv.ts` (reuse) + **ramp/plateau new** |
| 9 | **Schedule & Phasing** | Commit | Primavera P6-lite · Merak Peep | `DevelopmentSchedule` · `WellSequence` · `RigDemand` — **Seam B emitter** | **E7 new** (§2.8) |
| 10 | **Value & FDP** | Decide/Output | Merak Peep · PlanningSpace | `EconomicCase` · `FDPDocument` — NPV/IRR/payback, tornado, break-even, case compare, FID gate | E8 `econ.ts` (reuse) + assembler |

**Scope fences (cite, never claim):** full compositional reservoir simulation · detailed process/flow-assurance modelling · geomechanical wellbore stability · enterprise fiscal regimes (PSC/tax by jurisdiction beyond a simple deck) · detailed cost estimation to AACE Class 2 · marine/installation engineering.

**The wedge:** not fidelity parity — **a plan that exists for any field on earth in 30 seconds, with every number traced to its origin and its band honestly wide when the evidence is thin.**

---

## Part 7 · The shell and canvas — the UI/UX rebuild

Founder's directive: *shell first*. Here is what the shell must be.

### 7.1 Four persistent zones — three bars, three questions

The header is three bars because the model has three planes plus the maturity axis: **where · when-in-life · which-plan**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SCOPE BAR   [geography ▾][geology ▾][facets][AOI]   ← shared with Exploration │
│ PERSPECTIVE  Explore │ Appraise │▸Develop◂│ Produce │ Rejuvenate │ Retire     │
│              ⟲ auto-detected: "producing since 2008, declining" · override    │
│ CASE BAR    Volve · Case "3P+2I waterflood" v4 ▾  vs baseline ▾  ⑂ fork ✓ FID│
├────────────┬──────────────────────────────────────────┬──────────────────────┤
│ PLAN TREE  │              CANVAS (LOD router)         │     PLAN CARD        │
│            │                                          │  (always visible)    │
│ ○ Concept  │   L0 world · L1 basin · L2 field         │  well count   12±3   │
│ ● Recovery │   L3 structure · L4 well/section         │  spacing     420 m   │
│ ● Wells    │                                          │  type       horiz    │
│ ◐ Facility │   FD's native view = L2 development       │  pattern    5-spot   │
│ ○ Schedule │   layout: producers · injectors ·         │  drill ctr       2   │
│ ○ Value    │   pattern · drill centres · outlines     │  plateau  24 kbd     │
│            │                                          │  first oil  Q3 '28   │
│ (status +  │                                          │  recovery   38 %     │
│  staleness)│                                          │  capex   $1.2 B      │
│            │                                          │  NPV10   $410 MM     │
├────────────┴──────────────────────────────────────────┴──────────────────────┤
│ EVIDENCE STRIP   lineage · basis chips · what changed · what went stale       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 The Plan Card is the product

**M7-HARDENING §5's right panel, promoted to a permanent fixture on every tab.** Ten headline numbers, each with:
- a **P10/50/90 band rendered as a bar**, not a number triplet;
- a **basis chip** (`M`/`R`/`A`/`U`/`D`) and a staleness dot;
- a one-line **"why"** on hover, plus tornado + blind-test confidence on click.

The core interaction — and the reason this design works — is that **you watch the bands collapse as you work.** Open a T0 field in Angola: every band is enormous, every chip says `A n=34`. Add a concept, a pattern, a bundle; bands narrow, chips flip to `M`. The M7 acceptance criterion becomes the primary visual feedback loop rather than a line in a spec.

### 7.3 The left rail is a decision tree, not a data tree

Today's `CosmoExplorer` is a Petrel 11-folder object tree. That is the wrong metaphor for a planner: **the folders are not the work; the decisions are.** The rail becomes the plan structure with per-node status (`untouched · draft · settled · stale · superseded`), so the rail *is* the progress meter and the staleness alarm.

Object browsing does not disappear — it moves into the canvas's L3/L4 regimes and the Data Room, where it belongs.

### 7.4 The canvas is a scale router; today's viewers become renderers

**The eight modeling tabs stop being tabs and become canvas modes.** `Map3D`, `XSection`, `GridCube3D`, `GridVolume`, `SimDrape`, `LogsView`, `Crossplot3D` are good code in the wrong container — a nav item each, when they are really *ways of looking at the current scope*. Wire them behind the same L0–L4 LOD router Exploration specifies (Part 4 there), and one router serves both verticals.

> **Fork worth flagging:** the alternative is to promote them into their own **"Subsurface Model"** vertical (the M5/M6 concept), leaving Field Development purely a planner. I recommend **canvas renderers now, own vertical later if they outgrow it** — it keeps the FD rebuild focused on the missing planner and avoids a sixth nav item before it earns one.

### 7.5 Shell mechanics to fix while we're here

- **One tab registry, not three.** Today `CosmoShell.tsx:74-82` (painted), `fielddev/registry.ts` (different order, different labels) and the orphaned `nav.ts:57-71` all describe the same 13 tabs and disagree. The new suite has exactly one source of truth, and the shell reads it.
- **Scope lives in a store, not component state.** Today `Cockpit.tsx` holds `place`/`selection` in local `useState` with a hardcoded 5-entry `PLACES` list, so selecting a field in the Cockpit changes nothing anywhere else. `useScopeStore` is shared by Exploration, Development, Well Delivery, Drilling and RM.
- **Kill the footer literal.** `ACTIVE FIELD · VOLVE · NORTH SEA` becomes scope-bound.
- **`chrome.tsx` graduates.** It already serves four verticals from inside `tabs/fielddev/`; move it to `src/ui/`.

---

## Part 8 · Legacy handling

Mirrors Exploration Part 6 and the working pattern in `apps/hq/src/surfaces/forge/ForgeShell.tsx:21` (lazy-imported, loads only if opened).

- Current `src/tabs/fielddev/*` (13 viewers) → **`src/tabs/fielddev/legacy/`**, behind a **"Legacy (v1)"** entry that renders full-bleed.
- **Every `src/engine/*` is kept and lifted**, not rewritten: `volumetrics · mc · dca · review · econ · analog · petro · upscale · grid · closure · geostat · sim/*`. Their truth-lock harnesses (`scripts/test-*.mjs`) stay green throughout — that is the safety net for the whole rebuild.
- `analog.ts` is **promoted**, not just kept (Part 5.2).
- Volve constants (`Forecast.PRODUCERS`, `owc ?? 3200`, `hugin_top`, `RESERVOIR_K`, `ECON_DEFAULTS`) → **demoted into `projects/volve/`**, never app code.
- The already-dead classic shell (`nav.ts`, `store.ts`, `components/*`, `tabs/Stub|Foundation|DataTab|…`) is **deleted**, not parked — nothing imports it and it is not a usable pattern.

---

## Part 9 · Phasing

**D0 · Spine.** Scope store (shared) · **perspective resolver** (PRMS auto-detect + override) · `DevelopmentCase` with `baseline` + artifact DAG + repo driver · `arganta:development:*` kinds · `PlannedWell` as OSDU Well · Seam A/A′/B/C types · shell three-bar layout · LOD canvas router · legacy park. **No planning tabs — just scope, set perspective, fork a case, see real data appear.**

**D1 · Asset + Subsurface Case.** The analog cohort engine at world scale; Seam A receiver with synthesis fallback; Seam A′ receiver over `loadRMData`. **This is where agnostic is proven, in both directions:** pick a frontier discovery in Brazil → full-cycle plan card, honest wide bands, `basis: analog`; pick a producing field → incremental card against its own baseline, `basis: measured`.

**D2 · Concept Select + Recovery & Pattern.** (M7 §2.3, §2.6 · engines E5)

**D3 · Well Design + Facilities & Drill Centres.** → first real `PlannedWell[]` (M7 §2.4–2.5, §2.7 · E3/E4/E6)

**D4 · Forecast.** Build-up/plateau/decline; the genuinely missing piece — today only Arps decline on existing history exists.

**D5 · Schedule & Phasing.** → **Seam B goes live; the Drilling Gantt reads real wells.** (M7 §2.8 · E7)

**D6 · Value & FDP.** Case compare, FID gate, the FDP document assembler.

**D7 · Calibration loop + appraisal VOI + grounded agent.** (M7 §2.2 · E2 · §7 tool signatures)

---

## Part 10 · Stack

Reuse React/TS/Vite, the existing canvas/three engines, MapLibre GL v5 + deck.gl v9 (shipped in the cockpit), and the OSDU/ATLAS layer. **Add:** `engine/develop/*.ts` (E2–E7), the case/DAG store with a swappable repo driver (`LocalRepo` now → `OsduRepo`/`SupabaseRepo` later), the shared scope-filter component, the Plan Card, and the FDP assembler. Backend deferred — bundles + OSDU manifests first, per the platform doc.

Every new engine ships with a truth-lock harness in `scripts/test-*.mjs` wired to `npm test`, following M7-HARDENING §3's five columns (physics basis · truth-lock · blind-test · acceptance).

---

## Acceptance

1. **Zero Volve literals** in the new `src/tabs/fielddev/**` — enforced by a CI grep gate.
2. **Any of the ~7,787 spatial fields** yields a complete Plan Card within seconds, every number carrying a basis chip and a band.
3. **One scope control** drives Exploration, Development, Well Delivery, Drilling and RM.
4. **One tab registry**, one shell, one chrome module.
5. **Staleness propagates** — change scope or an upstream artifact and descendants flag, never silently wrong.
6. **Sanctioning a well in Field Development places it on the Drilling Gantt**, on a real rig lane, at a date derived from real dependencies. All five localStorage bridges deleted.
7. **Second deep-dive field = a bundle, no code.**
8. **Cases are forkable and comparable**; a sanctioned case is immutable.
9. **Agnostic to maturity** — the same ten tabs serve a frontier discovery and a 30-year-old producing field. Perspective is auto-detected from the catalogue and overridable; `Rejuvenate`/`Retire` cases evaluate incrementally against a baseline, with **no second vertical and no second engine set**.
10. **Volumes are always PRMS-labelled** — prospective / contingent / reserves with 1U-2U-3U · 1C-2C-3C · 1P-2P-3P, never an unqualified number.
9. **Legacy reachable**, every engine lifted, every truth-lock test still green.
10. **Doctrine intact** — deterministic engines own every number; the LLM retrieves, explains and drafts, never invents.
