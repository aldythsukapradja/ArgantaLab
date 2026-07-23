# GOGET → ATLAS ingestion contract

Version 1.0.0 · 2026-07-23

## Architectural boundary

GOGET is a **catalogue spine source**, not the schema for every petroleum datum.

```text
GOGET XLS (raw, immutable)
  → staging rows (all source columns retained)
  → FieldMasterRecord + FieldObservation
  → canonical ATLAS field identity
       ├─ GOGET metadata and latest reported quantities
       ├─ regulator crosswalks (Sodir/NSTA/ANP/...)
       └─ DetailBundle(s)
            └─ Volve: wells, wellbores, logs, trajectories, production,
               pressure, markers, surfaces, models and documents
```

The required bridge is `DetailBundle.fieldId → FieldMasterRecord.id`. A detail
package must never add its technical columns to the global field table.

## Layers

1. **Raw** — original March 2026 XLS, checksum, retrieval time and licence.
2. **Staging** — one JSON-like row per worksheet row; no dropped columns.
3. **Canonical master** — stable field identity and searchable attributes.
4. **Observations** — production/reserve/resource values with year, unit,
   classification, source row and release.
5. **Crosswalk** — `FieldIdentityLink` connects GOGET ↔ regulator/vendor/native
   records as `same-as`, `contains`, `part-of` or `successor-of`. Matching is
   reviewed; names alone never auto-merge records.
6. **Detail** — field-specific technical packages such as Volve.

## Identity

- Canonical GOGET field ID: `atlas:field:goget:{GEM Unit ID}`.
- Preserve the March 2026 `L1000003…` identifier verbatim.
- Preserve parent/project hierarchy separately from entity type.
- When GOGET represents an asset, phase, pool or project, retain `unitType`; do
  not silently relabel it as a geological field.
- A regulator-backed field can later become the preferred canonical record using
  an explicit crosswalk. Both native IDs remain queryable.
- Fields absent from GOGET because of its size/public-data threshold remain valid
  regulator-backed master records; GOGET is the initial global coverage spine,
  not an exclusion rule for the catalogue.

## Quantities

- Production and reserves are observations, not mutable columns on `field`.
- Retain original value/unit and any reserves classification.
- Store normalized values only in additional fields after deterministic
  conversion; never overwrite the source value.
- March 2026 exposes the most recent production/reserve year in the main output,
  so it must not be presented as a complete history.

## Provenance and quality gates

Every accepted record carries source, licence, release and workbook row. Reject:

- missing GOGET ID;
- missing unit name;
- non-numeric quantities that cannot be parsed.

Flag rather than reject:

- missing/approximate coordinates;
- unknown unit type;
- unknown reserves classification;
- unresolved parent;
- possible duplicate/crosswalk candidate.

Runtime adapter: `src/atlas/goget.ts`.
