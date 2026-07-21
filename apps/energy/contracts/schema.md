# ArgantaEnergy — Canonical Schema Contract (M1)
Version 1.0.0 · 2026-07-21 · **LOCKED** · derived from the real decoded Volve tables in `data-energy/processed/`.
Companion: `ontology.md` (column dictionary), `../src/data/schema-meta.ts` (generated runtime single-source-of-truth).

> Rule (from the reference's hard-won lesson): **define the shape first; consumers match it.** Edge ids are auto-generated from `from|to` (never hand-typed — hand ids collide). The alias layer absorbs physical name drift; entities are never silently merged.

## Entity hierarchy (star, well-centred)
```
Field (VOLVE / Q0015 SLEIPNER, CRS ED50/UTM31N)
 └─ Well  (hub · 11 · well_name)
     └─ Wellbore (child · 24 · wellbore_name, FK well_name, sidetrack via drilled_from)
         ├─ ProductionRecord (fact · 15,634 daily / 526 monthly)
         ├─ LogSample        (fact · 223 runs · LAS+DLIS+LAS3.0)
         ├─ PressureSample   (fact · 48 runs · LAS3.0 MDT/RFT)
         ├─ TrajectorySurvey (detail · 29 definitive · 3,332 stations)
         └─ FormationMarker  (detail · 409 · 317 resolved / 92 orphan)
 └─ DepthHorizon (gis · 6 · field-level interpreted surfaces, 1.59M pts)
Surface (bridge · 16 · formation/interval names) ← markers + horizons
EvidenceRecord (evidence · 1,002 · mirror-manifest path+sha256) ← EVERY row.source_id
```

## Table roles
| id | entity | role | rows | key | source_id domain |
|---|---|---|---|---|---|
| `well` | Well | **hub** | 11 | well_name | Well_technical_data/WellWellbore |
| `wellbore` | Wellbore | **child dim** | 24 | wellbore_name (FK well_name; drilled_from→parent) | Well_technical_data/WellWellbore |
| `production` | ProductionRecord | fact | 15,634 | (wellbore, date) | Production_data |
| `log_sample` | LogSample | fact | 223 runs | (well, run, md, curve) | Well_logs_pr_WELL |
| `pressure` | PressureSample | fact | 48 runs | (well, run, index) | Well_logs_pr_WELL/03.PRESSURE |
| `trajectory` | TrajectorySurvey/Station | detail | 29 / 3,332 | (wellbore, station_i) | WITSML/trajectory |
| `marker` | FormationMarker | detail | 409 (317 resolved / 92 orphan) | (source_well, surface, obs) | Geophysical_Interpretations/Wells |
| `horizon` | DepthHorizon | gis | 6 | name | Geophysical_Interpretations/Horizons_DEPTH |
| `surface` | Surface | **bridge** | 16 | surface_name | (derived from markers+horizons) |
| `evidence` | EvidenceRecord | **evidence** | 1,002 | volumePath (+sha256) | mirror-manifest.json |

Centers (hubs): `well` (primary), `wellbore` (secondary). Groups (source systems): `WELLTECH`, `PROD`, `LOGS`, `WITSML`, `GEOINT`, `DERIVED`, `EVIDENCE`.

## Rule-ordered join hierarchy
- **R1** — table has a wellbore-identity column → `normalizeWellbore()` → join `wellbore`.
- **R2** — else has a well-identity column → `normalizeWell()` → join `well`.
- **R3** — chain `wellbore.well_name → well.well_name` (any wellbore-keyed row reaches the hub).
- **R4** — sidetrack lineage: `wellbore.drilled_from → wellbore.wellbore_name` (parent branch; null on main wellbores).
- **R5** — `marker.surface` / `horizon.name` → `surface` bridge (surface name lookup).
- **R6** — **orphan rule**: if wellbore/well identity does not resolve after alias normalization, carry `source_well` verbatim, leave `well_id`/`wellbore_id` = null, flag `unresolved`. **Never force-merge.** Ambiguity → human-confirm.
- **R7** (universal) — every row's `source_id` → `evidence.volumePath` (path + sha256). This is the truth guarantee; a row whose source_id does not resolve is invalid.

## Alias layer — FIVE physical naming systems for one logical wellbore
| System | Example | Normalization |
|---|---|---|
| production | `15/9-F-1 C` | canonical form (target) |
| trajectory | `NO 15/9-F-1 C`, `15/9-F-15S`, `15/9-F-9 A` | strip `NO `; insert space before trailing branch letter (`F-15S`→`F-15 S`) |
| logs | `15_9-F-1 C`, `15_9-19 B&BT2` | `_`→`/`; split `&`-combined branches (`B&BT2` → `B`, `BT2`) |
| pressure | `15_9-F-10` | `_`→`/` |
| markers | `15/9-F-1 C` + regional (`15/5-7 A`, `15/9-C-2 H`…) | canonical; regional wells (not in field) → orphan |
Canonical wellbore form: `15/9-F-<n>[ <branch>]`. `normalizeWellbore()`/`normalizeWell()` live in `schema-meta.ts`.

## FK ledger (edge id = auto from `from|to`; real orphan counts = the data-quality truth)
| # | from | → to | card | orphans | note |
|---|---|---|---|---|---|
| FK01 | wellbore.well_name | well.well_name | *-1 | **0** | all 24 wellbores map to 11 wells |
| FK02 | wellbore.drilled_from | wellbore.wellbore_name | *-1 | n/a | sidetrack parent; null on mains |
| FK03 | production.wellbore | wellbore | *-1 | **0** | 7 producing wellbores, alias-normalized |
| FK04 | log_sample.well | wellbore | *-1 | **2** | 24 log-wells (underscore alias); 2 orphan = `19 B` / `19 S` (`&`-combined exploration branch splits with no exact master entry) |
| FK05 | pressure.well | wellbore | *-1 | 0 | 7 wells |
| FK06 | trajectory.wellbore | wellbore | *-1 | **1** | 29; NO-prefix/branch-glue alias; 1 orphan = `F-15 S` sidetrack absent from master |
| FK07 | marker.source_well | wellbore | *-1 | **92 of 409** | 317 resolved; 92 orphan = 12 regional/pilot wells outside the Volve field (`15/5-7 A`, `15/9-C-2*`, `-A-15`, `-B-6`, `-4/-8/-11/-17`, `F-12 pilot`). Carried verbatim, never merged. (NB: the decoder's raw exact-match left 300 null — the alias layer resolves 208 of those; the true semantic orphan is 92.) |
| FK08 | marker.surface | surface | *-1 | 0 | 409 → 16 surfaces |
| FK09 | horizon.name | surface | *-1 | — | field-level; fuzzy surface-name match |
| FK10 | *.source_id | evidence.volumePath | *-1 | **0** | universal — every processed row resolves to a sha256'd source file |

## Data-nature per table (never simulated-as-measured)
production=`reported` · log_sample=`measured` · pressure=`measured` · trajectory=`measured` (definitive; plans excluded) · marker=`interpreted` · horizon=`interpreted` · well/wellbore=`reported` · (workbench-computed volumes/forecasts=`derived`/`forecast`/`scenario`).

## Versioning
Bump this file's version on any structural change; `schema-meta.ts` is regenerated from it (Sonnet codegen). The alias layer absorbs physical name drift so the data export can change keys without a schema version bump. Orphan counts are re-measured by `validate.mjs` and must match this ledger (a changed count is a real data event, surfaced not hidden).
