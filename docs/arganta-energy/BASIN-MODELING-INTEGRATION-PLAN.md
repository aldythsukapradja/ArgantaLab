# Basin & Petroleum-System Modeling — Trinity-Style 1D→3D Integration Plan

2026-07-25. Expands **P4 · Seismic + basin modeling** from [EXPLORATION-PLATFORM-ARCHITECTURE.md](EXPLORATION-PLATFORM-ARCHITECTURE.md) §7 into a concrete engine build order. Reference: [ZetaWare Trinity/T3](https://www.zetaware.com/products/t3/) — burial→maturity→migration→charge-risk workflow. `explore.ts` already names this lineage: *"the transparent GeoX/Trinity screening backbone, NOT the enterprise stack."* This plan keeps that framing literal: we build the **screening-grade 1D→3D workflow shape**, not a Trinity clone (no SEG-Y, no compositional PVT, no geomechanics, no commercial-grade compute).

**Today's gap:** `PlayElementAssessment.charge` and `.timing` (the two GCoS factors GeoX/Trinity actually compute from physics) are currently **hand-set constants** in `explore.ts`/`explData.ts` — same problem the platform pivot already fixed for prospects. This plan makes charge & timing **derived**, the same way GRV became "digitize a closure, don't hardcode a number."

---

## 0 · Scope fence

| In scope | Out of scope (Trinity has it, we don't need it) |
|---|---|
| 1D burial/thermal/maturity per well or grid cell | Full lithosphere thermal/rifting models |
| Map-based ("poor-man's 3D") maturity & kitchen-area grids | True 3D compositional PVT / geopressure (3D Centroid) |
| Screening-grade fill-spill migration + charge access | Darcy multiphase flow / capillary migration simulation |
| Deterministic charge-volume MC + simple phase prediction | Biodegradation, sorption/CBM, HotSpot correlation mining |
| Literature-sourced, cited source-rock kinetics | Proprietary kinetic libraries |

Same doctrine as everywhere else: deterministic engine owns the numbers, provenance/dataNature on every output, missing data surfaced not fabricated, parity-tested in `scripts/test-*.mjs`.

---

## 1 · Data model additions

Extends §1 of the architecture doc (interpretation/derived objects):

- **`SourceRockInterval`** — per stratigraphic unit: TOC (wt%), HI (mgHC/gTOC), kerogen type, kinetic scheme ref (e.g. Sweeney & Burnham 1990 Easy%Ro; Pepper & Corvi 1995 generic kinetics), thickness/depth. `dataNature: reported` (literature-cited per basin/play — e.g. Draupne Fm for Volve), never invented.
- **`ThermalHistory`** — heat-flow-through-time function (constant or simple stretching/McKenzie-style rift factor) + present-day calibration point (BHT/DST temp). `dataNature: interpreted`, calibrated against `wb/index.json.pvt.T`.
- **`MaturityHistory`** — %Ro / transformation-ratio vs geologic time, per horizon/cell. `dataNature: derived`.
- **`ChargeTimingResult`** — generation onset, expulsion onset, peak expulsion time; trap-formation age (from structural restoration or simple present-day-structure assumption) → **timing chance factor becomes a computed pass/fail/partial, not a guess**.
- **`MigrationPath`** — polyline(s) from kitchen cell(s) to a prospect's trap, computed by fill-spill/least-resistance over the top-seal surface grid; carries expelled-volume-allocated and access-probability. `dataNature: derived`.
- **`ChargeVolumeCase`** — MC-risked in-place charge volume + simple phase (oil/gas/condensate) call, feeding `VolumetricCase`/`RiskModel` alongside the existing GRV-based volumetrics.

These slot into the existing hierarchy (`PlayElementAssessment.charge`/`.timing` become read from `ChargeTimingResult`/`MigrationPath` instead of the current hardcoded note strings).

---

## 2 · Engine build order — four phases, each independently shippable

Mirrors how `mc.ts`/`closure.ts`/`analog.ts` were built: pure deterministic TS, seeded, parity-tested. Reuses existing grid infra (`grid.ts`, `grid3d.ts`, `gridmesh.ts`, `geostat.ts`) rather than inventing new geometry code.

### Phase A — `basin.ts`: 1D burial + maturity (the literal P4 deliverable)
**What Trinity calls single-well geohistory.**
- **Inputs:** stratigraphic column per well (ages + present-day thickness, derivable from `wb/picks.json` tops + published stage ages), lithology→porosity-depth decay (Sclater & Christie 1980 exponential compaction, standard published constants per lithology), a `ThermalHistory` (start with constant heat-flow, calibrated to `pvt.T`), and one or more `SourceRockInterval`s.
- **Algorithm:** backstrip/decompact the column → reconstruct burial depth vs time per horizon → integrate temperature history → run Easy%Ro (Sweeney & Burnham 1990) kinetics for maturity, and a transformation-ratio kinetic scheme for expulsion fraction vs time.
- **Outputs:** burial-history curve, thermal-history curve, %Ro vs time per horizon, generation/expulsion onset+peak time → `MaturityHistory` + `ChargeTimingResult`.
- **Calibration:** Volve = calibration point #1, exactly like the existing calibration-library concept — present-day BHT (`pvt.T`) + literature Draupne Fm maturity (published as marginally-to-early mature in this part of the Viking Graben) as the target the model must reproduce.
- **Test:** `scripts/test-basin.mjs`, same shape as `test-engine.mjs`/`test-analog.mjs` — reference-implementation numerics checked against decompaction/kinetics identities.

### Phase B — grid/map extension ("poor-man's 3D")
**What Trinity/T3 calls mapping maturity, not true 3D simulation — this is the actual shape of T3's speed advantage.**
- Run Phase A's kernel at every node of an existing basin/play surface grid (reuse `grid.ts`/`geostat.ts`, same pattern as reservoir property gridding) instead of one well at a time.
- **Output:** maturity **maps** through geologic time (oil-window/gas-window isochron polygons), a generation/expulsion-timing map, and a **kitchen-area** polygon per source interval per time-slice — this directly produces the CRS "charge" map the architecture doc's `PlayElementAssessment` already expects.
- Interpolates between wells using the existing geostat kriging/IDW machinery — no new interpolation code needed.

### Phase C — screening-grade migration
**What Trinity/T3 calls fill-and-spill migration — not Darcy flow.**
- Reuse the flood-fill closure algorithm already in `closure.ts` (`grvClosure`), extended: trace a least-resistance path from each kitchen cell (Phase B output) across the top-seal surface grid to the nearest closures (Dijkstra/shortest-ascent over the surface grid, buoyancy-driven — i.e. always moving toward shallower closure).
- **Output:** `MigrationPath` per prospect — which kitchen(s) can reach it, at what expelled-volume share, gated by whether the migration-timing precedes/follows trap formation (from `ChargeTimingResult`) → this is what actually answers the "timing" GCoS factor instead of a note string.

### Phase D — charge volume + simple phase prediction
- Combine Phase A/B expelled-HC-volume with Phase C's access/allocation → seeded MC (reuse `mc.ts`) → risked charge volume, same pattern as `explore.ts`'s `riskedResource`.
- Simple phase call (oil vs gas vs condensate) from source maturity/kerogen type at expulsion time (a published maturity-vs-phase correlation, e.g. Pepper & Corvi-style), not full compositional PVT.
- **Output:** feeds `ChargeVolumeCase` into `VolumetricCase`, and the `charge` GCoS factor becomes `min(1, chargeVolume / trapCapacity)`-style computed chance instead of a hand-set number.

---

## 3 · UI integration (COSMO tabs, re-pointed per §3 of the architecture doc)

| Tab | Addition |
|---|---|
| **Interpretation** | New "Basin" sub-view: pick/edit stratigraphic column + source rock intervals per project; burial-history & maturity-vs-time chart per well |
| **Plays & Prospects** | Charge/timing chance factors now **read from Phase A–D outputs** with provenance, replacing the current hardcoded GCoS notes; kitchen-area + migration-path overlay on the play map |
| **Risk & Uncertainty** | Charge-volume MC distribution shown alongside the GRV-based volumetric MC; tornado now includes charge/timing as data-driven, not assumed-P |
| **Basemap** | Kitchen-area polygons (Phase B) and migration paths (Phase C) as a togglable overlay layer |

---

## 4 · Build order (maps onto architecture doc §7, replaces the single "P4" line)

- **P4a** — `basin.ts` (Phase A), single-well, Volve-calibrated. Ships a real burial/maturity chart replacing the hardcoded charge/timing notes for the Volve reference project. *Smallest shippable slice.*
- **P4b** — grid extension (Phase B) — kitchen-area & maturity maps on the Basemap tab.
- **P4c** — migration (Phase C) — `MigrationPath` per prospect, timing gate wired into GCoS.
- **P4d** — charge-volume MC + phase call (Phase D) — `ChargeVolumeCase` wired into `VolumetricCase`/`RiskModel`.

Each phase is independently useful and testable; P4a alone already kills the "charge/timing are invented constants" gap that mirrors the original prospect-hardcoding critique.

---

## 5 · Sourcing discipline

Every source-rock/kinetic parameter is a **literature citation, not a guess**: standard published kinetic schemes (Sweeney & Burnham 1990; Pepper & Corvi 1995) are safe to name as methods since they're established public science, but the actual TOC/HI/thickness values for Draupne Fm (or any future project's source rock) must be sourced from published studies or NPD/Sodir/NLOG-equivalent public data before being entered — never invented to make the demo look complete. If unsourced, the field stays visibly `unknown`, per doctrine.

---

## 6 · Risks

- **Scope creep toward Trinity's full 3D compositional/geopressure stack.** Mitigation: the phase boundaries above are the fence — Phase D stops at simple phase prediction, deliberately short of PVT.
- **Source-rock data scarcity for new projects.** Mitigation: analogue engine (`analog.ts`) can propose a source-rock prior from basin-type analogues, tagged `interpreted`, same pattern as volumetric priors today.
- **Grid performance at basin scale (Phase B).** Mitigation: screening-grade resolution (reuse existing grid decimation), defer heavy compute to the Python/edge-worker path already flagged in architecture doc §6.
